/**
 * Attack graph: resolves the player's final attack from weapon + build.
 *
 * GDD refs: 20.2 (Attack Graph module: "Combines weapon definition, passive
 *           modifiers, transformations, profile effects, and temporary statuses"),
 *           7.1-7.3 (slot rules, archetypes, the modifier adapter contract),
 *           8.5 (the three synergy layers: systemic, handcrafted override,
 *           transformation), R-WPN-006 (a weapon swap recalculates the whole graph
 *           from owned passives; no stale effects survive), R-PLY-003 (stat changes
 *           clamp; no negative intervals, NaN, or infinite speed), R-ITM-001
 *           (passives stack without an inventory cap), R-ITM-006 (unsupported
 *           interactions are deterministic and silent), 7.5 (final damage is
 *           calculated from the full graph even when particles are merged).
 *
 * The resolution order is fixed and documented below because it is the difference
 * between a build that behaves the same every run and one that depends on pickup
 * order. GDD 8.4 explicitly forbids the loot system from caring about current
 * power, and this module is the other half of that promise: two players holding the
 * same items get the same attack, regardless of the order they found them in.
 *
 * Resolution order:
 *   1. Weapon base           — the archetype's own numbers
 *   2. Additive stats        — every passive's flat contributions, summed
 *   3. Multiplicative stats  — every passive's factors, multiplied
 *   4. STAT hooks            — declarative stat effects from content
 *   5. Base pattern          — one shot, or the weapon's own multi-shot
 *   6. Modifier adapters     — sorted by adapter order, NOT pickup order
 *   7. ATTACK_PATTERN hooks  — content-declared pattern edits
 *   8. Transformations       — GDD 8.5 layer three
 *   9. Temporary statuses    — Haste, Slow, Adrenaline, room-long buffs
 *  10. Clamp                 — R-PLY-003
 */

import { ARCHETYPE, CLAMPS, DAMAGE_TAG } from '../core/constants.js';
import { clampStat, StatAccumulator } from '../core/math.js';
import { HOOK_TIMING, runEffects } from './effects.js';
import { resolveAdapter, ADAPTER_RESULT, getAdapter } from './adapters.js';

/**
 * One shot within an attack pattern.
 *
 * A "shot" is archetype-agnostic: for PROJECTILE it is a projectile, for MELEE_ARC
 * an arc centre, for BEAM a beam origin. That is what lets one multiplicity adapter
 * (Dual Monitors) express itself as two projectiles, two arcs, or two beams without
 * knowing which weapon it is attached to.
 */
export function makeShot({ angleOffset = 0, damageScale = 1, sizeScale = 1, speedScale = 1, tag = null } = {}) {
  return { angleOffset, damageScale, sizeScale, speedScale, tag };
}

/** The resolved attack. Rebuilt whenever the build changes, never mutated in place. */
export class AttackPlan {
  constructor(weapon) {
    this.weaponId = weapon.id;
    this.archetype = weapon.attack.archetype;
    this.inputMode = weapon.attack.inputMode;
    this.damageTags = [...weapon.attack.damageTags];

    // Core numbers
    this.interval = weapon.attack.intervalSeconds;
    this.damage = 0; // filled from player damage * weapon multiplier
    this.speed = weapon.attack.projectileSpeed ?? 0;
    this.lifetime = weapon.attack.projectileLifetime ?? 0;
    this.size = weapon.attack.projectileSize ?? 1;
    this.range = weapon.attack.beamRange ?? weapon.attack.arcRadius ?? 0;
    this.pierce = weapon.attack.pierce ?? 0;
    this.bounce = weapon.attack.bounce ?? 0;
    this.knockback = weapon.attack.knockback ?? 0;
    this.spread = weapon.attack.spreadRadians ?? 0;

    // Archetype extras, copied so adapters can edit them freely
    this.arcRadius = weapon.attack.arcRadius ?? 0;
    this.arcAngle = weapon.attack.arcAngle ?? 0;
    this.windup = weapon.attack.windupSeconds ?? 0;
    this.activeSeconds = weapon.attack.activeSeconds ?? 0;
    this.recovery = weapon.attack.recoverySeconds ?? 0;
    this.beamWidth = weapon.attack.beamWidth ?? 0;
    this.tickRate = weapon.attack.tickRate ?? 0;
    this.coneAngle = weapon.attack.coneAngle ?? 0;
    this.chargeTiers = weapon.attack.chargeTiers ? weapon.attack.chargeTiers.map((t) => ({ ...t })) : null;
    this.placementLifetime = weapon.attack.placementLifetime ?? 0;
    this.maxInstances = weapon.attack.maxInstances ?? 1;
    this.burstCount = weapon.attack.burstCount ?? 0;
    this.burstReload = weapon.attack.burstReloadSeconds ?? 0;

    /** The pattern. Adapters add, split, and offset entries here. */
    this.shots = [makeShot()];

    // Behaviour flags set by trajectory and payload adapters.
    this.homing = null;              // { strength, radius }
    this.eightDirection = false;
    this.returns = false;
    this.returnDamageScale = 0.6;
    this.sticky = null;              // { seconds, burstDamageScale }
    this.trail = null;               // { hazardId, chance }
    this.nearMissSteer = null;       // { radius }
    this.ignoreFurniture = 0;
    this.wallPass = false;
    this.forkOnContact = 0;
    this.pulse = null;
    this.reveals = false;

    // Event-level modifiers.
    this.duplicateChance = 0;
    this.repeatEvery = 0;
    this.repeatDelay = 0.08;
    this.repeatDamageScale = 0.65;
    this.chargedEvery = 0;
    this.chargedDamageScale = 2;
    this.alternating = false;
    this.alternateDamageScale = 1.35;
    this.critChance = 0;
    this.critMultiplier = 2;
    this.armorPierceFraction = 0;
    this.extraShotEvery = 0;

    /** Status payloads applied on hit: `{ status, chance, seconds, magnitude }`. */
    this.statusPayload = [];

    /** Adapter resolutions, for the debug overlay and the synergy tests. */
    this.adapterLog = [];
  }

  /** Total shots after multiplicity, used by the aggregation threshold (GDD 7.5). */
  get shotCount() {
    return this.shots.length;
  }

  addStatus(status, chance, seconds, magnitude = 1) {
    // Refreshing never stacks magnitude (GDD ITM-032), so merge instead of push.
    const existing = this.statusPayload.find((s) => s.status === status);
    if (existing) {
      existing.chance = Math.max(existing.chance, chance);
      existing.seconds = Math.max(existing.seconds, seconds);
      existing.magnitude = Math.max(existing.magnitude, magnitude);
      return;
    }
    this.statusPayload.push({ status, chance, seconds, magnitude });
  }

  /** Clamp every numeric field. R-PLY-003. */
  clampAll() {
    this.interval = clampStat(this.interval, CLAMPS.attackInterval, 0.45);
    this.damage = clampStat(this.damage, CLAMPS.damage, 10);
    this.speed = this.speed > 0 ? clampStat(this.speed, CLAMPS.projectileSpeed, 9) : 0;
    this.lifetime = this.lifetime > 0 ? clampStat(this.lifetime, CLAMPS.range, 0.95) : 0;
    this.size = clampStat(this.size, CLAMPS.size, 1);
    this.knockback = clampStat(this.knockback, CLAMPS.knockback, 0);
    this.pierce = Math.round(clampStat(this.pierce, CLAMPS.pierce, 0));
    this.bounce = Math.round(clampStat(this.bounce, CLAMPS.bounce, 0));
    this.critChance = Math.min(1, Math.max(0, this.critChance));
    this.armorPierceFraction = Math.min(1, Math.max(0, this.armorPierceFraction));
    this.duplicateChance = Math.min(1, Math.max(0, this.duplicateChance));
    // A pattern that grew past the readability budget is capped here rather than in
    // the renderer, because GDD 7.5 says damage must survive visual merging: the
    // cap has to be a mechanical decision, made once, in the open.
    if (this.shots.length > MAX_SHOTS) {
      const kept = this.shots.slice(0, MAX_SHOTS);
      // Preserve total output by folding the dropped shots' damage into the rest.
      const droppedDamage = this.shots.slice(MAX_SHOTS)
        .reduce((sum, s) => sum + s.damageScale, 0);
      const perShot = droppedDamage / kept.length;
      for (const shot of kept) shot.damageScale += perShot;
      this.shots = kept;
      this.aggregated = true;
    }
    for (const shot of this.shots) {
      shot.damageScale = clampStat(shot.damageScale, { min: 0.05, max: 20 }, 1);
      shot.sizeScale = clampStat(shot.sizeScale, { min: 0.1, max: 8 }, 1);
      shot.speedScale = clampStat(shot.speedScale, { min: 0.1, max: 4 }, 1);
    }
    return this;
  }
}

/**
 * Hard cap on pattern entries.
 *
 * GDD 20.7 allows 600 logical projectiles across the room; one attack event
 * producing more than this many shots is a build that has stopped being readable
 * long before it stops being fun. R-CMB-004 forbids dropping the mechanics, so
 * `clampAll` folds the excess damage back into the surviving shots.
 */
const MAX_SHOTS = 32;

export class AttackGraphResolver {
  /**
   * @param {{registry: object}} deps
   */
  constructor({ registry }) {
    this.registry = registry;
    /** Cache keyed by build signature so we rebuild only when the build changes. */
    this._cache = new Map();
  }

  /**
   * A stable signature of everything that can affect the attack.
   * Deliberately excludes room state and position: those change every frame and
   * must never trigger a rebuild.
   */
  static signature(player) {
    return [
      player.weaponId,
      player.passiveIds.join(','),
      player.transformationIds.join(','),
      player.charmId ?? '',
      player.profileId ?? '',
      // Statuses that alter the attack, sorted so order cannot matter.
      [...player.status.active.keys()].sort().join(','),
    ].join('|');
  }

  /** Drop the cache. Called on weapon swap so no stale graph survives (R-WPN-006). */
  invalidate() {
    this._cache.clear();
  }

  /**
   * Resolve the player's attack plan.
   * @param {import('../entities/player.js').Player} player
   * @returns {AttackPlan}
   */
  resolve(player) {
    const key = AttackGraphResolver.signature(player);
    const cached = this._cache.get(key);
    if (cached) return cached;

    const weapon = this.registry.get('weapon', player.weaponId);
    if (!weapon) {
      // No weapon is a defect upstream, not a state to handle silently, but the
      // player must still be able to move, so return a harmless empty plan.
      const empty = new AttackPlan(FALLBACK_WEAPON);
      empty.damage = 0;
      return empty;
    }

    const plan = new AttackPlan(weapon);
    const owners = this.#ownedEffectSources(player);

    // --- steps 2-3: stat contributions ------------------------------------
    const damage = new StatAccumulator(player.stats.damage ?? 10);
    const interval = new StatAccumulator(weapon.attack.intervalSeconds);
    const speed = new StatAccumulator(plan.speed);
    const size = new StatAccumulator(plan.size);
    const range = new StatAccumulator(plan.lifetime > 0 ? plan.lifetime : plan.range);
    const knockback = new StatAccumulator(plan.knockback);

    for (const owner of owners) {
      const s = owner.stats;
      if (!s) continue;
      const stacks = owner.stacks ?? 1;
      for (let i = 0; i < stacks; i += 1) {
        if (s.damageAdd) damage.addFlat(s.damageAdd);
        if (s.damageMul) damage.multiply(s.damageMul);
        if (s.intervalMul) interval.multiply(s.intervalMul);
        if (s.projectileSpeedMul) speed.multiply(s.projectileSpeedMul);
        if (s.sizeMul) size.multiply(s.sizeMul);
        if (s.rangeMul) range.multiply(s.rangeMul);
        if (s.knockbackMul) knockback.multiply(s.knockbackMul);
        if (s.pierceAdd) plan.pierce += s.pierceAdd;
        if (s.bounceAdd) plan.bounce += s.bounceAdd;
        if (s.spreadMul) plan.spread *= s.spreadMul;
        if (s.armorPierceFraction) {
          // Fractions compose as independent reductions rather than summing past
          // 100%, which keeps two armour items from trivialising all armour.
          plan.armorPierceFraction = 1 - (1 - plan.armorPierceFraction) * (1 - s.armorPierceFraction);
        }
      }
    }

    plan.damage = damage.resolve(CLAMPS.damage) * weapon.attack.baseDamageMultiplier;
    plan.interval = interval.resolve(CLAMPS.attackInterval);
    if (plan.speed > 0) plan.speed = speed.resolve(CLAMPS.projectileSpeed);
    plan.size = size.resolve(CLAMPS.size);
    if (plan.lifetime > 0) plan.lifetime = range.resolve(CLAMPS.range);
    else plan.range = range.resolve({ min: 0.5, max: 30 });
    plan.knockback = knockback.resolve(CLAMPS.knockback);

    // --- step 4: declarative STAT hooks -----------------------------------
    runEffects(owners, HOOK_TIMING.STAT, { plan, player, registry: this.registry });

    // --- step 5: the weapon's own base pattern ----------------------------
    const baseCount = weapon.attack.projectileCount ?? 1;
    if (baseCount > 1) {
      plan.shots = [];
      const spread = plan.spread || 0;
      for (let i = 0; i < baseCount; i += 1) {
        // Symmetric fan around the aim direction.
        const t = baseCount === 1 ? 0 : (i / (baseCount - 1)) - 0.5;
        plan.shots.push(makeShot({ angleOffset: t * spread }));
      }
    }

    // --- step 6: modifier adapters ----------------------------------------
    this.#applyAdapters(plan, player, owners, weapon);

    // --- step 7: declarative pattern hooks --------------------------------
    runEffects(owners, HOOK_TIMING.ATTACK_PATTERN, { plan, player, registry: this.registry });

    // --- step 9: temporary statuses ---------------------------------------
    // Haste may affect attack cadence when its source says so (GDD 5.5).
    const haste = player.status.get('HASTE');
    if (haste?.affectsCadence) plan.interval *= 1 - Math.min(0.5, haste.magnitude ?? 0.15);
    const slow = player.status.get('SLOW');
    if (slow?.affectsCadence) plan.interval *= 1 + Math.min(1, slow.magnitude ?? 0.2);

    plan.clampAll();
    this._cache.set(key, plan);
    return plan;
  }

  /**
   * Everything that can contribute effects, in a deterministic order.
   *
   * Order is acquisition order for passives, then charm, then transformations. The
   * `order` field is what `collectEffects` sorts on, so this list defines the tie
   * break — and because it is derived from `passiveIds` (append-only), it is stable
   * across a save/load cycle.
   */
  #ownedEffectSources(player) {
    const owners = [];
    let order = 0;
    for (const id of player.passiveIds) {
      const def = this.registry.get('passive', id);
      if (!def) continue;
      // Repeatable items appear once with a stack count rather than N times, so a
      // stacking item's multiplicative factor is applied exactly `stacks` times.
      const existing = owners.find((o) => o.id === id);
      if (existing) {
        existing.stacks += 1;
        continue;
      }
      owners.push({
        id, order: order++, stacks: 1,
        stats: def.stats, effects: def.effects, modifier: def.modifier, def,
      });
    }
    if (player.charmId) {
      const def = this.registry.get('charm', player.charmId);
      if (def) owners.push({ id: def.id, order: order++, stacks: 1, effects: def.effects, def });
    }
    for (const id of player.transformationIds) {
      const def = this.registry.get('transformation', id);
      if (def) owners.push({ id: def.id, order: order++, stacks: 1, effects: def.effects, def });
    }
    return owners;
  }

  /**
   * Resolve and apply every modifier adapter.
   *
   * Sorted by `adapter.order`, not by pickup order. GDD 8.4 promises the loot system
   * never accounts for current power; this promises the *build* never accounts for
   * acquisition sequence. Multiplicity before trajectory before payload, always.
   */
  #applyAdapters(plan, player, owners, weapon) {
    const pending = [];
    for (const owner of owners) {
      const modifier = owner.modifier;
      if (!modifier) continue;
      const resolution = resolveAdapter(modifier, weapon);
      plan.adapterLog.push({
        item: owner.id,
        mechanic: modifier.mechanic,
        result: resolution.result,
        adapter: resolution.adapter?.id ?? null,
        reason: resolution.reason,
      });
      if (resolution.result === ADAPTER_RESULT.APPLIED) {
        pending.push({ adapter: resolution.adapter, owner, modifier });
      } else if (resolution.result === ADAPTER_RESULT.FALLBACK_STAT) {
        // The explicit alternative to NO_EFFECT: a small, honest damage bump rather
        // than a fake version of the mechanic (GDD 7.3's no-effect rule).
        plan.damage *= 1 + 0.04 * (owner.stacks ?? 1);
      }
      // NO_EFFECT is intentional and silent (R-WPN-005, R-ITM-006).
    }

    pending.sort((a, b) => (a.adapter.order - b.adapter.order)
      || (a.owner.order - b.owner.order));

    for (const entry of pending) {
      const params = { ...(entry.modifier.params || {}), stacks: entry.owner.stacks };
      entry.adapter.fn(plan, params, { player, weapon, registry: this.registry, owner: entry.owner });
    }
  }
}

/** Used only when a weapon id fails to resolve, so movement still works. */
const FALLBACK_WEAPON = Object.freeze({
  id: 'WPN-MISSING',
  attack: Object.freeze({
    archetype: ARCHETYPE.PROJECTILE,
    inputMode: 'CARDINAL_TAP',
    baseDamageMultiplier: 1,
    intervalSeconds: 0.45,
    damageTags: [DAMAGE_TAG.PROJECTILE],
  }),
});

export { MAX_SHOTS, getAdapter };
