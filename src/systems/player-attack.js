/**
 * Player attack execution: turns a resolved AttackPlan into live attacks.
 *
 * GDD refs: 7.2 (the eight attack archetypes and their data), 7.5 (final damage is
 *           calculated from the full interaction graph even when visual particles are
 *           merged; repeated micro-projectiles may be represented by a stream after a
 *           threshold), 4.2 (aiming rules), R-PLY-002 (movement stays responsive while
 *           firing), R-CMB-004 (caps come from pooling and aggregation, never silent
 *           deletion), R-CMB-005 (all random combat procs use deterministic scoped
 *           RNG), 6.3 (projectile model), 6.4 (collision priorities).
 *
 * The attack graph decides *what* the attack is; this decides *when* it happens and
 * spawns it. Keeping those apart is what lets the graph be a pure function the tests
 * can interrogate without a room, a pool, or a frame.
 *
 * The rhythm items are resolved here rather than in the graph because they are
 * properties of the attack *event*, not of the pattern: Caps Lock counts attacks,
 * Shift Key alternates between them, Macro Pad repeats one. A plan does not know how
 * many times it has been fired, and it should not.
 */

import { RNG_STREAMS } from '../core/rng.js';
import { ALLEGIANCE, ARCHETYPE, DAMAGE_TAG, STATUS } from '../core/constants.js';
import { EVENTS } from '../core/events.js';
import { IMPACT_ACTION } from '../entities/projectile.js';
import { directionAngle, distance, angleDelta, rotateToward } from '../core/math.js';
import { BUDGETS } from '../core/constants.js';

/** Weapon sound per archetype, used when the weapon names none. */
const FALLBACK_FIRE_SFX = {
  [ARCHETYPE.PROJECTILE]: 'SFX-WPN_KEYBOARD',
  [ARCHETYPE.MELEE_ARC]: 'SFX-WPN_MOUSE_SWING',
  [ARCHETYPE.BEAM]: 'SFX-WPN_BEAM',
  [ARCHETYPE.TETHER]: 'SFX-WPN_PHONE_THROW',
  [ARCHETYPE.CONE_STREAM]: 'SFX-WPN_SHREDDER',
  [ARCHETYPE.AREA_SLAM]: 'SFX-WPN_STAMP',
  [ARCHETYPE.PLACED_AREA]: 'SFX-WPN_PROJECTOR',
  [ARCHETYPE.CHARGE_WAVE]: 'SFX-WPN_COPIER_WAVE',
};

export class PlayerAttackSystem {
  /**
   * @param {object} deps
   * @param {object} deps.registry
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {import('./attack-graph.js').AttackGraphResolver} deps.attackGraph
   * @param {() => object} deps.getRun
   * @param {() => object} deps.getRuntime encounter runtime, for spawning
   */
  constructor({ registry, events, attackGraph, getRun, getRuntime }) {
    this.registry = registry;
    this.events = events;
    this.attackGraph = attackGraph;
    this.getRun = getRun;
    this.getRuntime = getRuntime;

    /** Live melee arcs and beams, so they can tick damage over their active window. */
    this.arcs = [];
    this.beams = [];
    /** Placed areas (WPN-014 Projector). One instance policy is per-weapon data. */
    this.placements = [];
    /** Queued repeats from Macro Pad and friends. */
    this.pending = [];
  }

  /** Drop transient state on room change so nothing leaks across a threshold. */
  reset() {
    this.arcs.length = 0;
    this.beams.length = 0;
    this.placements.length = 0;
    this.pending.length = 0;
  }

  /**
   * Advance cooldowns and fire if the player is holding a direction.
   *
   * @param {number} dt
   * @param {object} input resolved InputState
   */
  update(dt, input) {
    const run = this.getRun();
    const player = run?.player;
    if (!player || player.health.isDead) return;

    // Repeats first, so a queued echo lands on time rather than a frame late.
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      const entry = this.pending[i];
      entry.remaining -= dt;
      if (entry.remaining <= 0) {
        this.pending.splice(i, 1);
        entry.fn();
      }
    }

    this.#tickArcs(dt);
    this.#tickBeams(dt, input);
    this.#tickPlacements(dt);

    if (player.attackCooldown > 0) player.attackCooldown -= dt;

    const plan = this.attackGraph.resolve(player);
    if (!input?.firing || !input.aimDirection) {
      player.isCharging = false;
      player.chargeHeld = 0;
      return;
    }

    // Charge weapons hold instead of tapping (GDD 7.2 Charge wave / charge projectile).
    if (plan.inputMode === 'CHARGE') {
      player.isCharging = true;
      player.chargeHeld += dt;
      return;
    }
    // Sustained weapons re-arm a beam or cone rather than firing discrete shots.
    if (plan.archetype === ARCHETYPE.BEAM || plan.archetype === ARCHETYPE.CONE_STREAM) {
      this.#sustain(plan, player, input, dt);
      return;
    }

    if (player.attackCooldown > 0) return;
    this.fire(plan, player, input.aimDirection);
  }

  /** Release a held charge. Called when the aim input drops. */
  releaseCharge(input) {
    const run = this.getRun();
    const player = run?.player;
    if (!player?.isCharging) return;
    const plan = this.attackGraph.resolve(player);
    const held = player.chargeHeld;
    player.isCharging = false;
    player.chargeHeld = 0;
    // Pick the highest tier the hold time reached (GDD 7.2 charge tiers).
    let tier = plan.chargeTiers?.[0] ?? { damageMultiplier: 1, sizeMultiplier: 1 };
    for (const candidate of plan.chargeTiers || []) {
      if (held >= candidate.seconds) tier = candidate;
    }
    this.fire(plan, player, input?.aimDirection ?? player.facing, {
      damageMul: tier.damageMultiplier,
      sizeMul: tier.sizeMultiplier,
    });
  }

  /**
   * Fire one attack event.
   *
   * @param {object} plan resolved AttackPlan
   * @param {object} player
   * @param {string} direction cardinal or octant name
   * @param {{damageMul?: number, sizeMul?: number, isRepeat?: boolean}} [mods]
   */
  fire(plan, player, direction, mods = {}) {
    const run = this.getRun();
    const runtime = this.getRuntime();
    if (!runtime?.currentRoom) return;

    // Eight-direction aim is a capability, not a default: without the modifier the
    // input system has already collapsed the aim to a cardinal (GDD 4.2).
    const baseAngle = directionAngle(direction);
    player.aimDirection = direction;
    player.facing = direction;

    // --- rhythm items, which are properties of the EVENT ---------------------
    let damageMul = mods.damageMul ?? 1;
    let sizeMul = mods.sizeMul ?? 1;
    if (!mods.isRepeat) {
      player.attackCounter += 1;
      if (plan.chargedEvery > 0 && player.attackCounter % plan.chargedEvery === 0) {
        // ITM-018 Caps Lock.
        damageMul *= plan.chargedDamageScale;
        sizeMul *= plan.chargedSizeScale ?? 1.5;
      }
      if (plan.alternating) {
        // ITM-019 Shift Key. One alternation state for the whole pattern, so a dual
        // attack empowers both shots together (Appendix C.2).
        player.alternateState = !player.alternateState;
        if (player.alternateState) damageMul *= plan.alternateDamageScale;
      }
    }

    // COMBAT_PROC keyed by the attack counter, so a crit roll is reproducible on a
    // seed replay and cannot shift the loot or generation streams (R-CMB-005).
    const rng = run.rng.stream(RNG_STREAMS.COMBAT_PROC, 'attack', player.attackCounter);

    let critMul = 1;
    if (plan.critChance > 0 && rng.chance(plan.critChance)) {
      critMul = plan.critMultiplier;
      this.events.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-IMPACT_CRIT' });
    }

    const damage = plan.damage * damageMul * critMul;
    this.#emit(plan, player, baseAngle, damage, sizeMul, rng);

    // ITM-022 Ctrl+C: duplicate the whole pattern after normal creation. Copies never
    // recursively copy, which is why the repeat passes isRepeat.
    if (plan.duplicateChance > 0 && rng.chance(plan.duplicateChance)) {
      this.pending.push({
        remaining: 0.05,
        fn: () => this.#emit(plan, player, baseAngle, damage * 0.9, sizeMul, rng),
      });
    }
    // ITM-015 Macro Pad: every Nth attack repeats, weaker.
    if (plan.repeatEvery > 0 && player.attackCounter % plan.repeatEvery === 0) {
      this.pending.push({
        remaining: plan.repeatDelay,
        fn: () => this.fire(plan, player, direction, {
          damageMul: plan.repeatDamageScale, sizeMul, isRepeat: true,
        }),
      });
    }

    if (!mods.isRepeat) player.attackCooldown = plan.interval;
    this.events.emit(EVENTS.ATTACK_FIRED, {
      weaponId: plan.weaponId, archetype: plan.archetype, shots: plan.shotCount, damage,
    });
  }

  /** Spawn the actual pattern for one archetype. */
  #emit(plan, player, baseAngle, damage, sizeMul, rng) {
    const runtime = this.getRuntime();
    this.events.emit(EVENTS.SFX_REQUESTED, {
      sound: this.#fireSound(plan),
    });

    switch (plan.archetype) {
      case ARCHETYPE.MELEE_ARC:
        this.arcs.push({
          x: player.x, y: player.y, angle: baseAngle,
          radius: plan.arcRadius, arc: plan.arcAngle,
          damage, remaining: plan.activeSeconds || 0.14, hitIds: new Set(),
          knockback: plan.knockback, statusPayload: plan.statusPayload,
        });
        return;

      case ARCHETYPE.AREA_SLAM:
        // A slam lands after its wind-up, which is what makes it readable to enemies
        // and to the player alike (GDD 7.2 wind-up / active / recovery).
        this.pending.push({
          remaining: plan.windup || 0.2,
          fn: () => this.arcs.push({
            x: player.x + Math.cos(baseAngle) * plan.arcRadius * 0.6,
            y: player.y + Math.sin(baseAngle) * plan.arcRadius * 0.6,
            angle: baseAngle, radius: plan.arcRadius * sizeMul, arc: Math.PI * 2,
            damage, remaining: plan.activeSeconds || 0.12, hitIds: new Set(),
            knockback: plan.knockback, statusPayload: plan.statusPayload, isSlam: true,
          }),
        });
        return;

      case ARCHETYPE.PLACED_AREA: {
        // GDD WPN-014: one projector at a time.
        while (this.placements.length >= (plan.maxInstances || 1)) this.placements.shift();
        this.placements.push({
          x: player.x, y: player.y, angle: baseAngle,
          cone: plan.coneAngle || 0.9, range: plan.range || 6,
          damage, remaining: plan.placementLifetime, tickTimer: 0,
          reveals: plan.reveals,
        });
        return;
      }

      case ARCHETYPE.TETHER:
      case ARCHETYPE.CHARGE_WAVE:
      case ARCHETYPE.PROJECTILE:
      default: {
        // Everything else spawns projectiles, one per shot in the pattern.
        const aggregateThreshold = BUDGETS.projectileAggregationThreshold;
        let spawned = 0;
        for (const shot of plan.shots) {
          const angle = baseAngle + shot.angleOffset;
          const shotDamage = damage * shot.damageScale;
          const p = runtime.projectiles.spawn({
            owner: ALLEGIANCE.PLAYER,
            x: player.x, y: player.y,
            vx: Math.cos(angle) * plan.speed * shot.speedScale,
            vy: Math.sin(angle) * plan.speed * shot.speedScale,
            damage: shotDamage,
            damageTags: plan.damageTags,
            radius: 0.2 * plan.size * shot.sizeScale * sizeMul,
            maxLifetime: plan.lifetime,
            pierce: plan.pierce,
            bounce: plan.bounce,
            knockback: plan.knockback,
            spriteId: this.#projectileSprite(plan),
            onImpact: plan.returns ? IMPACT_ACTION.RETURN : IMPACT_ACTION.DESTROY,
            returnDamageScale: plan.returnDamageScale,
            statusPayload: plan.statusPayload,
            homing: plan.homing,
            trail: plan.trail,
            trailRng: rng,
            ignoreFurnitureRemaining: plan.ignoreFurniture,
            sourceId: 'player',
          });
          if (p) spawned += 1;
          else {
            // R-CMB-004: the cap forced aggregation, so resolve the damage directly
            // rather than losing it. GDD 7.5 wants the stream to be a visual merge,
            // never a mechanical one.
            this.#resolveAggregatedShot(player, angle, shotDamage, plan);
          }
        }
        if (plan.shots.length > aggregateThreshold) {
          this.events.emit(EVENTS.PROJECTILE_SPAWNED, { aggregated: true, count: spawned });
        }
      }
    }
  }

  /** A shot the pool could not instance still has to hurt something. */
  #resolveAggregatedShot(player, angle, damage, plan) {
    const runtime = this.getRuntime();
    const reach = plan.lifetime * plan.speed;
    const tx = player.x + Math.cos(angle) * reach;
    const ty = player.y + Math.sin(angle) * reach;
    for (const enemy of runtime.hostiles) {
      if (enemy.dead || enemy.staged) continue;
      // Cheap segment test: the merged stream is visually a cone, so the nearest
      // enemy along the vector takes the hit.
      const along = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (along > reach) continue;
      const projected = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      if (Math.abs(angleDelta(angle, projected)) > 0.25) continue;
      runtime.damageEnemy(enemy, {
        amount: damage, tags: plan.damageTags, sourceId: 'player',
        statusPayload: plan.statusPayload,
      });
      return;
    }
    // Nothing in the way: the damage is genuinely spent on empty air, which is the
    // same outcome an instanced shot would have had.
    void tx; void ty;
  }

  /** Beam and cone weapons: re-armed every frame the input is held. */
  #sustain(plan, player, input, dt) {
    const angle = directionAngle(input.aimDirection);
    let beam = this.beams[0];
    if (!beam) {
      beam = { hitTimer: 0 };
      this.beams.push(beam);
      this.events.emit(EVENTS.SFX_REQUESTED, { sound: this.#fireSound(plan) });
    }
    beam.x = player.x;
    beam.y = player.y;
    beam.angle = angle;
    beam.range = plan.archetype === ARCHETYPE.BEAM ? (plan.range || 9) : (plan.range || 4);
    beam.width = plan.beamWidth || 0.5;
    beam.cone = plan.archetype === ARCHETYPE.CONE_STREAM ? (plan.coneAngle || 0.6) : 0;
    beam.alive = 0.1;
    // Damage is applied in controlled ticks (GDD WPN-003), not per frame, so tick
    // rate is a balance number rather than a function of the player's framerate.
    beam.tickRate = plan.tickRate || 10;
    beam.damage = plan.damage / beam.tickRate;
    beam.statusPayload = plan.statusPayload;
    beam.statusCooldown = plan.statusCooldownSeconds ?? 0;
    void dt;
  }

  #tickArcs(dt) {
    const runtime = this.getRuntime();
    for (let i = this.arcs.length - 1; i >= 0; i -= 1) {
      const arc = this.arcs[i];
      arc.remaining -= dt;
      for (const enemy of runtime.hostiles) {
        if (enemy.dead || enemy.staged || arc.hitIds.has(enemy.id)) continue;
        const d = distance(arc.x, arc.y, enemy.x, enemy.y);
        if (d > arc.radius + enemy.radius) continue;
        if (arc.arc < Math.PI * 2) {
          const toEnemy = Math.atan2(enemy.y - arc.y, enemy.x - arc.x);
          if (Math.abs(angleDelta(arc.angle, toEnemy)) > arc.arc / 2) continue;
        }
        // Hit memory per swing (GDD 7.2 melee arc "hit memory"), so one swing cannot
        // tick an enemy every frame it overlaps.
        arc.hitIds.add(enemy.id);
        runtime.damageEnemy(enemy, {
          amount: arc.damage, tags: [DAMAGE_TAG.MELEE], sourceId: 'player',
          statusPayload: arc.statusPayload, knockback: arc.knockback,
          knockbackX: enemy.x - arc.x, knockbackY: enemy.y - arc.y,
        });
      }
      if (arc.remaining <= 0) this.arcs.splice(i, 1);
    }
  }

  #tickBeams(dt, input) {
    const runtime = this.getRuntime();
    for (let i = this.beams.length - 1; i >= 0; i -= 1) {
      const beam = this.beams[i];
      beam.alive -= dt;
      // The beam expires unless #sustain refreshed it this frame.
      if (beam.alive <= 0 || !input?.firing) { this.beams.splice(i, 1); continue; }

      beam.hitTimer -= dt;
      if (beam.hitTimer > 0) continue;
      beam.hitTimer = 1 / beam.tickRate;

      for (const enemy of runtime.hostiles) {
        if (enemy.dead || enemy.staged) continue;
        const toEnemy = Math.atan2(enemy.y - beam.y, enemy.x - beam.x);
        const d = distance(beam.x, beam.y, enemy.x, enemy.y);
        if (d > beam.range + enemy.radius) continue;
        const halfWidth = beam.cone > 0 ? beam.cone / 2 : Math.atan2(beam.width, Math.max(0.5, d));
        if (Math.abs(angleDelta(beam.angle, toEnemy)) > halfWidth) continue;
        runtime.damageEnemy(enemy, {
          amount: beam.damage, tags: [DAMAGE_TAG.BEAM], sourceId: 'player',
          statusPayload: beam.statusPayload,
        });
      }
    }
  }

  #tickPlacements(dt) {
    const runtime = this.getRuntime();
    for (let i = this.placements.length - 1; i >= 0; i -= 1) {
      const place = this.placements[i];
      place.remaining -= dt;
      place.tickTimer -= dt;
      if (place.tickTimer <= 0) {
        place.tickTimer = 0.2;
        for (const enemy of runtime.hostiles) {
          if (enemy.dead || enemy.staged) continue;
          const d = distance(place.x, place.y, enemy.x, enemy.y);
          if (d > place.range + enemy.radius) continue;
          const toEnemy = Math.atan2(enemy.y - place.y, enemy.x - place.x);
          if (Math.abs(angleDelta(place.angle, toEnemy)) > place.cone / 2) continue;
          runtime.damageEnemy(enemy, {
            amount: place.damage * 0.2, tags: [DAMAGE_TAG.BEAM], sourceId: 'player',
          });
          if (place.reveals) enemy.cloaked = false;
        }
      }
      if (place.remaining <= 0) this.placements.splice(i, 1);
    }
  }

  #fireSound(plan) {
    const weapon = this.registry.get('weapon', plan.weaponId);
    return weapon?.audio?.fire ?? FALLBACK_FIRE_SFX[plan.archetype] ?? 'SFX-WPN_KEYBOARD';
  }

  #projectileSprite(plan) {
    const weapon = this.registry.get('weapon', plan.weaponId);
    return weapon?.attack?.projectileId
      ? weapon.attack.projectileId.toLowerCase().replace('prj_', 'prj_')
      : (PROJECTILE_BY_WEAPON[plan.weaponId] ?? 'prj_keycap');
  }

  /** Homing steering, applied to player projectiles that carry it. */
  steerProjectiles(dt) {
    const runtime = this.getRuntime();
    runtime.projectiles.pool.forEach((p) => {
      if (p.owner !== ALLEGIANCE.PLAYER || !p.homing) return;
      let best = null;
      let bestD = p.homing.radius;
      for (const enemy of runtime.hostiles) {
        if (enemy.dead || enemy.staged) continue;
        const d = distance(p.x, p.y, enemy.x, enemy.y);
        if (d < bestD) { bestD = d; best = enemy; }
      }
      if (!best) return;
      const speed = Math.hypot(p.vx, p.vy);
      const current = Math.atan2(p.vy, p.vx);
      const desired = Math.atan2(best.y - p.y, best.x - p.x);
      // Capped angular speed keeps homing a nudge rather than a guarantee, which is
      // what GDD 8.5 means by "steer toward" rather than "track".
      const next = rotateToward(current, desired, p.homing.strength * dt * 12);
      p.vx = Math.cos(next) * speed;
      p.vy = Math.sin(next) * speed;
    });
  }
}

/** Projectile sprite per weapon, matching the authored `prj_*` set. */
const PROJECTILE_BY_WEAPON = Object.freeze({
  'WPN-001': 'prj_keycap',
  'WPN-004': 'prj_staple',
  'WPN-005': 'prj_paper_disc',
  'WPN-006': 'prj_ink_stroke',
  'WPN-008': 'prj_paper_strip',
  'WPN-009': 'prj_click_pulse',
  'WPN-010': 'prj_receiver',
  'WPN-011': 'prj_label',
  'WPN-012': 'prj_paper_sheet',
});

export { PROJECTILE_BY_WEAPON, STATUS };
