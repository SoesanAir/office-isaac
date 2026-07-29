/**
 * Combat resolver: the single authority on damage, invulnerability, status
 * application, death, and proc ordering.
 *
 * GDD refs: 5.3 (Damage resolution order — implemented literally, step by step),
 *           5.5 (status rules), 6.2 (baseline combat rules), 6.3 (projectile
 *           model), 6.4 (Collision priorities), 20.5 (event ordering),
 *           R-PLY-004 (damage sources carry tags and a source entity id),
 *           R-CMB-005 (all random combat procs use deterministic scoped RNG),
 *           R-ITM-008 / 2.12 (no invisible fun police), R-TEC-007 (presentation
 *           reduction cannot alter combat results).
 *
 * Two damage paths exist because the two sides of combat are measured
 * differently, and conflating them is how roguelikes end up with mysterious
 * one-shots:
 *
 *   - `damagePlayer` works in **half-units** of health (GDD 5.2).
 *   - `damageEnemy` works in **hit units** (GDD 5.1: base damage 10).
 */

import { ALLEGIANCE, DAMAGE_TAG, STATUS } from '../core/constants.js';
import { EVENTS, LISTENER_PRIORITY } from '../core/events.js';
import { RNG_STREAMS } from '../core/rng.js';
import { HALVES_PER_ICON } from '../entities/health.js';

/** Outcome codes so callers can react without re-deriving state. */
export const DAMAGE_RESULT = Object.freeze({
  APPLIED: 'APPLIED',
  BLOCKED_INVULNERABLE: 'BLOCKED_INVULNERABLE',
  BLOCKED_SHIELD: 'BLOCKED_SHIELD',
  BLOCKED_ALLEGIANCE: 'BLOCKED_ALLEGIANCE',
  BLOCKED_GUARD: 'BLOCKED_GUARD',
  BLOCKED_IMMUNE: 'BLOCKED_IMMUNE',
  ZERO: 'ZERO',
  FATAL: 'FATAL',
  REVIVED: 'REVIVED',
});

export class CombatResolver {
  /**
   * @param {object} deps
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {import('../core/rng.js').RngSource} deps.rng
   * @param {() => object} deps.getRun run state accessor
   * @param {() => object[]} deps.getHostiles live hostiles in the current room
   * @param {(ctx:object)=>void} [deps.runItemEffects] bridges to the effect registry
   */
  constructor({ events, rng, getRun, getHostiles, runItemEffects }) {
    this.events = events;
    this.rng = rng;
    this.getRun = getRun;
    this.getHostiles = getHostiles;
    this.runItemEffects = runItemEffects || (() => {});
    /** Monotonic damage sequence, used for deterministic proc keys. */
    this.damageSeq = 0;
    /** Development-only log; the debug export ships this for repro (R-SAV-004). */
    this.log = [];
    this.logging = false;
  }

  /** Scoped stream for a single damage event's procs (R-CMB-005). */
  #procRng(sourceId, seq) {
    return this.rng.stream(RNG_STREAMS.COMBAT_PROC, sourceId, seq);
  }

  #record(entry) {
    if (!this.logging) return;
    this.log.push(entry);
    if (this.log.length > 4000) this.log.shift();
  }

  // -------------------------------------------------------------------------
  // Player damage — GDD 5.3, in order
  // -------------------------------------------------------------------------

  /**
   * @param {object} player
   * @param {object} req
   * @param {number} req.halfUnits damage in half-units
   * @param {string[]} req.tags DAMAGE_TAG values
   * @param {string} req.sourceId entity id (R-PLY-004)
   * @param {string} [req.sourceAllegiance]
   * @param {boolean} [req.bypassInvuln] sacrifices and self-damage ignore i-frames
   * @param {boolean} [req.bypassBuffers]
   * @param {boolean} [req.nonLethal] Burn and SUP-010 leave one half-unit
   * @param {{x:number,y:number,strength:number}} [req.knockback]
   * @param {Array<{status:string,chance:number,seconds:number,magnitude?:number,exceptional?:boolean,telegraphed?:boolean}>} [req.statusPayload]
   * @returns {{result: string, dealt: number, detail?: object}}
   */
  damagePlayer(player, req) {
    const seq = this.damageSeq++;
    const tags = req.tags || [DAMAGE_TAG.CONTACT];

    // --- 5.3 step 1: reject invalid, invulnerable, or shielded damage --------
    if (player.dead) return { result: DAMAGE_RESULT.BLOCKED_IMMUNE, dealt: 0 };
    if (!req.bypassInvuln && player.invulnerability.remaining > 0) {
      return { result: DAMAGE_RESULT.BLOCKED_INVULNERABLE, dealt: 0 };
    }
    if (player.shield && player.shield.charges > 0 && !req.bypassInvuln) {
      player.shield.charges -= 1;
      player.shield.rechargeTimer = player.shield.rechargeSeconds;
      this.events.emit(EVENTS.PLAYER_DAMAGED, { player, blockedByShield: true, tags, sourceId: req.sourceId });
      return { result: DAMAGE_RESULT.BLOCKED_SHIELD, dealt: 0 };
    }

    // A cancellable guard point so items (and only items) can veto or reshape
    // damage before it resolves. Listeners run GUARD -> MECHANIC -> ITEM.
    /**
     * Player health is measured in half-units and enemy health in hit points, so the
     * two damage entry points deliberately name their magnitude differently. That is a
     * trap for callers: passing `amount` here used to leave `halfUnits` undefined, and
     * the resulting NaN failed every `> 0` comparison downstream — so the hit reported
     * APPLIED while dealing nothing at all.
     *
     * Both names are now accepted, and a magnitude that is neither is a programming
     * error rather than a silently harmless hit.
     */
    const magnitude = req.halfUnits ?? req.amount;
    if (!Number.isFinite(magnitude)) {
      throw new Error(
        `damagePlayer needs a finite halfUnits (or amount); got ${JSON.stringify(req.halfUnits ?? req.amount)}`,
      );
    }

    const proposal = {
      player,
      halfUnits: magnitude,
      tags,
      sourceId: req.sourceId,
      sourceAllegiance: req.sourceAllegiance || ALLEGIANCE.ENEMY,
      reduction: 0,
      cancelled: false,
    };
    this.events.emit(EVENTS.DAMAGE_PROPOSED, proposal);
    if (proposal.cancelled) {
      return { result: DAMAGE_RESULT.BLOCKED_GUARD, dealt: 0 };
    }

    // --- 5.3 step 2: source-specific modifiers ------------------------------
    let amount = proposal.halfUnits;
    const stats = player.stats;
    if (tags.includes(DAMAGE_TAG.CONTACT)) amount *= stats.contactDamageResistMul ?? 1;
    if (tags.includes(DAMAGE_TAG.EXPLOSION)) amount *= stats.explosionDamageResistMul ?? 1;
    if (tags.includes(DAMAGE_TAG.HAZARD) && player.hazardImmunity) {
      return { result: DAMAGE_RESULT.BLOCKED_IMMUNE, dealt: 0 };
    }
    amount -= proposal.reduction;
    // Damage is quantised to half-units: a hit that survives resistance still
    // lands for at least one half-unit, so resistance can never silently make a
    // threat harmless without an explicit immunity.
    amount = amount <= 0 ? 0 : Math.max(1, Math.round(amount));

    if (req.nonLethal) amount = player.health.clampNonLethal(amount);
    if (amount <= 0) return { result: DAMAGE_RESULT.ZERO, dealt: 0 };

    // --- 5.3 step 3: consume buffers before Composure -----------------------
    const detail = player.health.consume(amount, { bypassBuffers: req.bypassBuffers });

    // --- 5.3 step 4: depletion effects, on-hit items, feedback ---------------
    if (detail.spiteIconsDepleted > 0) this.#triggerSpite(player, detail.spiteIconsDepleted);
    if (detail.cushionsTriggered > 0) this.#triggerGoldenCushion(player, detail.cushionsTriggered, seq);

    if (req.knockback && (stats.incomingKnockbackMul ?? 1) > 0) {
      const mul = stats.incomingKnockbackMul ?? 1;
      player.velocity.x += req.knockback.x * req.knockback.strength * mul;
      player.velocity.y += req.knockback.y * req.knockback.strength * mul;
    }

    this.#applyStatusPayload(player.status, req.statusPayload, req.sourceId, seq);

    this.events.emit(EVENTS.PLAYER_DAMAGED, {
      player, dealt: detail.total, detail, tags, sourceId: req.sourceId,
    });
    this.#record({ kind: 'playerDamage', seq, amount: detail.total, tags, sourceId: req.sourceId });

    // --- 5.3 step 5: begin the invulnerability window ------------------------
    if (!req.bypassInvuln) {
      player.invulnerability.start(stats.invulnerabilitySeconds);
      this.events.emit(EVENTS.PLAYER_INVULN_STARTED, { player });
    }

    // --- 5.3 step 6: death -------------------------------------------------
    if (player.health.isDead) {
      const guard = { player, revived: false, cancelled: false, sourceId: req.sourceId, tags };
      // ITM-058 Spare Keyboard revives here, before run-end persistence.
      this.events.emit(EVENTS.PLAYER_DIED, guard);
      if (guard.revived) {
        this.events.emit(EVENTS.PLAYER_REVIVED, { player });
        return { result: DAMAGE_RESULT.REVIVED, dealt: detail.total, detail };
      }
      player.dead = true;
      return { result: DAMAGE_RESULT.FATAL, dealt: detail.total, detail };
    }

    return { result: DAMAGE_RESULT.APPLIED, dealt: detail.total, detail };
  }

  /** GDD 5.2: a depleted Spite icon damages all hostile enemies in the room. */
  #triggerSpite(player, icons) {
    const hostiles = this.getHostiles();
    const damage = 18 * icons;
    for (const enemy of hostiles) {
      if (enemy.dead) continue;
      this.damageEnemy(enemy, {
        amount: damage,
        tags: [DAMAGE_TAG.STATUS],
        sourceId: `${player.id}:spite`,
        sourceAllegiance: ALLEGIANCE.PLAYER,
      });
    }
    this.events.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-PLAYER_SPITE_BURST' });
  }

  /** GDD 5.2: a protected icon lost produces credits or a small reward burst. */
  #triggerGoldenCushion(player, count, seq) {
    const rng = this.#procRng(`${player.id}:cushion`, seq);
    for (let i = 0; i < count; i += 1) {
      this.events.emit(EVENTS.PICKUP_COLLECTED, {
        player,
        pickup: 'CREDITS',
        amount: rng.int(3, 7),
        source: 'GOLDEN_CUSHION',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Enemy damage
  // -------------------------------------------------------------------------

  /**
   * @param {object} enemy
   * @param {object} req
   * @param {number} req.amount hit units
   * @param {string[]} req.tags
   * @param {string} req.sourceId
   * @param {number} [req.armorPierceFraction] ITM-028 Red Staple Remover
   * @param {number} [req.critChance] 0..1, rolled on COMBAT_PROC
   * @param {number} [req.critMultiplier] default 2
   * @param {Array} [req.statusPayload]
   * @param {{x:number,y:number,strength:number}} [req.knockback]
   * @returns {{result: string, dealt: number, killed: boolean, crit: boolean}}
   */
  damageEnemy(enemy, req) {
    const seq = this.damageSeq++;
    if (enemy.dead) return { result: DAMAGE_RESULT.BLOCKED_IMMUNE, dealt: 0, killed: false, crit: false };

    // --- 6.4 step 1: allegiance and invulnerability -------------------------
    if (enemy.invulnerable) {
      this.events.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-IMPACT_ARMOR_DEFLECT' });
      return { result: DAMAGE_RESULT.BLOCKED_INVULNERABLE, dealt: 0, killed: false, crit: false };
    }
    // Firewall Node / Executive Assistant style directed shields (ENM-016, 037).
    if (enemy.shieldHp > 0) {
      const absorbed = Math.min(enemy.shieldHp, req.amount);
      enemy.shieldHp -= absorbed;
      const leftover = req.amount - absorbed;
      if (leftover <= 0) {
        this.events.emit(EVENTS.DAMAGE_APPLIED, { target: enemy, dealt: 0, absorbedByShield: absorbed });
        return { result: DAMAGE_RESULT.BLOCKED_SHIELD, dealt: 0, killed: false, crit: false };
      }
      req = { ...req, amount: leftover };
    }

    let amount = req.amount;
    let crit = false;

    // --- 6.4 step 3: apply damage and status --------------------------------
    // Crit roll uses a scoped stream keyed to the damage sequence so replaying a
    // seed with identical inputs reproduces proc outcomes (R-CMB-005).
    if (req.critChance > 0) {
      const rng = this.#procRng(`${req.sourceId}:crit`, seq);
      if (rng.chance(req.critChance)) {
        crit = true;
        amount *= req.critMultiplier ?? 2;
      }
    }

    // Armour is a flat fractional reduction; Red Staple Remover ignores part of it.
    const armor = enemy.armor ?? 0;
    if (armor > 0) {
      const pierce = Math.min(1, req.armorPierceFraction ?? 0);
      amount *= 1 - armor * (1 - pierce);
    }

    // Marked amplification lives on the target's own status container so every
    // damage source benefits identically (GDD 5.5, ITM-032).
    amount *= enemy.status ? enemy.status.incomingDamageMultiplier() : 1;
    amount = Math.max(0, amount);

    enemy.health -= amount;
    this.#applyStatusPayload(enemy.status, req.statusPayload, req.sourceId, seq);

    if (req.knockback && !enemy.knockbackImmune) {
      const cap = enemy.isBoss ? 0.15 : 1; // GDD ITM-020: boss displacement is capped
      enemy.velocity.x += req.knockback.x * req.knockback.strength * cap;
      enemy.velocity.y += req.knockback.y * req.knockback.strength * cap;
    }

    this.events.emit(EVENTS.DAMAGE_APPLIED, {
      target: enemy, dealt: amount, crit, tags: req.tags, sourceId: req.sourceId,
    });
    this.#record({ kind: 'enemyDamage', seq, target: enemy.id, amount, crit, sourceId: req.sourceId });

    // --- 6.4 step 4-5: death, then on-hit/on-death callbacks ----------------
    if (enemy.health <= 0) {
      // GDD 6.2: dead enemies stop dealing contact damage immediately.
      enemy.dead = true;
      enemy.contactDamage = 0;
      this.events.emit(EVENTS.ENTITY_KILLED, { target: enemy, sourceId: req.sourceId, crit });
      return { result: DAMAGE_RESULT.FATAL, dealt: amount, killed: true, crit };
    }

    return { result: DAMAGE_RESULT.APPLIED, dealt: amount, killed: false, crit };
  }

  /**
   * Roll and apply a projectile's status payload (GDD 6.3 "Status payload").
   * Each entry has its own scoped roll so adding a status to a weapon cannot
   * shift another status's outcome.
   */
  #applyStatusPayload(container, payload, sourceId, seq) {
    if (!container || !payload || payload.length === 0) return;
    for (let i = 0; i < payload.length; i += 1) {
      const entry = payload[i];
      if (entry.chance < 1) {
        const rng = this.#procRng(`${sourceId}:status:${entry.status}`, seq + i);
        if (!rng.chance(entry.chance)) continue;
      }
      const applied = container.apply(entry.status, {
        seconds: entry.seconds,
        magnitude: entry.magnitude ?? 1,
        sourceId,
        lethal: entry.lethal,
        exceptional: entry.exceptional,
        telegraphed: entry.telegraphed,
      });
      if (applied) {
        this.events.emit(EVENTS.STATUS_APPLIED, { container, status: entry.status, sourceId });
      }
    }
  }

  /**
   * Advance status timers for one entity and apply damage-over-time ticks.
   * Called from the DAMAGE phase so DoT obeys the same resolution order.
   */
  tickStatuses(entity, dt, isPlayer) {
    if (!entity.status || entity.status.size === 0) return;
    const { expired, ticks } = entity.status.tick(dt);
    for (const status of expired) {
      this.events.emit(EVENTS.STATUS_EXPIRED, { entity, status });
    }
    for (const tick of ticks) {
      if (tick.status !== STATUS.BURN) continue;
      if (isPlayer) {
        this.damagePlayer(entity, {
          halfUnits: 1,
          tags: [DAMAGE_TAG.STATUS, ...(tick.lethal ? [DAMAGE_TAG.LETHAL] : [])],
          sourceId: tick.sourceId,
          bypassInvuln: true,
          nonLethal: !tick.lethal,
        });
      } else {
        this.damageEnemy(entity, {
          amount: 6 * tick.magnitude,
          tags: [DAMAGE_TAG.STATUS],
          sourceId: tick.sourceId,
        });
      }
    }
  }

  /**
   * Convenience for hazards, which need the same resolution path as any other
   * damage source so R-PLY-004's tagging stays intact.
   */
  applyHazard(target, hazardDef, sourceId, isPlayer) {
    if (hazardDef.damage <= 0 && hazardDef.statusApplied.length === 0) return null;
    const statusPayload = hazardDef.statusApplied.map((s) => ({
      ...s, exceptional: true, telegraphed: true,
    }));
    if (isPlayer) {
      return this.damagePlayer(target, {
        halfUnits: hazardDef.damage,
        tags: hazardDef.damageTags,
        sourceId,
        statusPayload,
      });
    }
    return this.damageEnemy(target, {
      amount: hazardDef.damage * 10,
      tags: hazardDef.damageTags,
      sourceId,
      statusPayload,
    });
  }

  /**
   * Explicitly priced health sacrifice (Restricted Records, Overtime Room,
   * Executive Deal). GDD 2.10: unavoidable damage is a bug *unless a clearly
   * priced sacrifice caused it*, so sacrifices bypass i-frames and buffers and
   * ignore Stress Ball style reductions (ITM-044).
   */
  sacrificeHealth(player, icons, sourceId) {
    return this.damagePlayer(player, {
      halfUnits: icons * HALVES_PER_ICON,
      tags: [DAMAGE_TAG.SACRIFICE],
      sourceId,
      bypassInvuln: true,
      bypassBuffers: true,
    });
  }

  /**
   * Register the standing guard listeners this resolver relies on.
   * Kept explicit so the wiring is greppable rather than implicit.
   */
  installGuards() {
    // Nothing beyond the resolver's own emissions by default; item hooks attach
    // themselves at ITEM priority. This method exists so future systems have an
    // obvious, ordered place to add MECHANIC-priority guards.
    this.events.on(EVENTS.DAMAGE_PROPOSED, () => {}, {
      priority: LISTENER_PRIORITY.MECHANIC,
      tag: 'combat:noop-anchor',
    });
  }
}
