/**
 * Projectile-family modifier adapters.
 *
 * GDD refs: 7.2 (Projectile archetype: "Homing, split, bounce, pierce, return,
 *           stick, duplicate"), 7.3 (adapter contract), 8.5 (required synergy
 *           table), Appendix C.2 (the exact magnitude each item declares),
 *           R-ITM-006 (unsupported interactions resolve deterministically),
 *           R-CMB-004 (caps come from pooling and aggregation, never from silent
 *           mechanical deletion).
 *
 * Every default here matches the number Appendix C.2 states for the item that owns
 * the mechanic, so an adapter behaves correctly even before its item passes explicit
 * `params`. Where the GDD names a per-weapon exception (Presentation Remote gets
 * three bounces rather than two) that belongs in the item's `weaponOverrides`, not in
 * a conditional here — adapters stay weapon-agnostic.
 */

import { defineAdapter } from '../adapters.js';
import { ARCHETYPE, STATUS } from '../../core/constants.js';
import { makeShot } from '../attack-graph.js';

/**
 * Adapter ordering bands.
 *
 * Multiplicity runs before trajectory so a split shot inherits homing, and payload
 * runs last so every shot in the final pattern carries it. Fixing the bands here is
 * what makes a build independent of pickup order.
 */
export const ORDER = Object.freeze({
  MULTIPLICITY: 10,
  TRAJECTORY: 30,
  GEOMETRY: 50,
  PAYLOAD: 70,
  EVENT: 90,
});

const PROJECTILE_TAGS = [ARCHETYPE.PROJECTILE, 'PROJECTILE', 'DIRECTED', 'REPEATABLE'];

// ---------------------------------------------------------------------------
// Trajectory
// ---------------------------------------------------------------------------

defineAdapter('HomingProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'ITM-011 Pen Laser Pointer: keys steer toward nearby enemies after launch.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    // GDD 8.5: "Keys steer toward nearby enemies while preserving cardinal launch
    // input." So this sets steering only, never the launch direction — the player's
    // cardinal input still decides where the shot leaves the keyboard.
    plan.homing = {
      strength: (params.strength ?? 0.12) * stacks,
      radius: params.radius ?? 5.5,
    };
  },
});

defineAdapter('ReturnProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'ITM-021 Backspace: attacks return after their range limit, hitting again.',
  fn: (plan, params) => {
    plan.returns = true;
    // Appendix C.2: returning attacks hit again at 60 percent damage.
    plan.returnDamageScale = params.returnDamageScale ?? 0.6;
  },
});

defineAdapter('BounceProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'ITM-023 Rubber Bands: two wall or obstacle bounces.',
  fn: (plan, params) => {
    plan.bounce += (params.bounces ?? 2) * (params.stacks ?? 1);
  },
});

defineAdapter('NearMissSteerAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'ITM-017 Autocorrect: a near miss may redirect once toward that enemy.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    // Appendix C.2: stacks with Pen Laser by increasing acquisition radius, not
    // steering strength — so this only ever widens a radius.
    const radius = (params.radius ?? 1.4) * stacks;
    plan.nearMissSteer = { radius: Math.max(plan.nearMissSteer?.radius ?? 0, radius) };
    if (plan.homing) plan.homing.radius += radius;
  },
});

// ---------------------------------------------------------------------------
// Multiplicity
// ---------------------------------------------------------------------------

defineAdapter('SplitProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.MULTIPLICITY,
  note: 'ITM-013 USB Hub: the attack splits once; secondaries deal 55 percent.',
  fn: (plan, params) => {
    const angle = params.angle ?? 0.28;
    const damageScale = params.damageScale ?? 0.55;
    const added = [];
    for (const shot of plan.shots) {
      // Split once, not recursively. GDD ITM-013 says "splits once according to
      // weapon adapter"; recursion here would let two Hubs quadruple output.
      if (shot.tag === 'SPLIT') continue;
      for (const dir of [-1, 1]) {
        added.push(makeShot({
          angleOffset: shot.angleOffset + dir * angle,
          damageScale: shot.damageScale * damageScale,
          sizeScale: shot.sizeScale * 0.85,
          speedScale: shot.speedScale,
          tag: 'SPLIT',
        }));
      }
    }
    plan.shots.push(...added);
  },
});

defineAdapter('DualProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.MULTIPLICITY,
  note: 'ITM-010 Dual Monitors: a paired pattern, each copy at 0.72 base damage.',
  fn: (plan, params) => {
    const offset = params.lateralOffset ?? 0.35;
    const damageScale = params.damageScale ?? 0.72;
    const paired = [];
    for (const shot of plan.shots) {
      for (const dir of [-1, 1]) {
        paired.push(makeShot({
          angleOffset: shot.angleOffset + dir * offset * 0.5,
          damageScale: shot.damageScale * damageScale,
          sizeScale: shot.sizeScale,
          speedScale: shot.speedScale,
          tag: 'DUAL',
        }));
      }
    }
    plan.shots = paired;
  },
});

defineAdapter('TripleProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  // Just after Dual, so its override lands on an already-paired pattern.
  order: ORDER.MULTIPLICITY + 5,
  note: 'ITM-055 Three-Hole Punch: a three-shot narrow spread at 62 percent each.',
  fn: (plan, params) => {
    const spread = params.spread ?? 0.2;
    const damageScale = params.damageScale ?? 0.62;
    // Appendix C.2: "Overrides Dual Monitors pattern; the stronger pattern is not
    // multiplied again." So this replaces the pattern rather than expanding it,
    // which is the difference between a strong item and an exponential one.
    const base = plan.shots[0] ?? makeShot();
    plan.shots = [-1, 0, 1].map((i) => makeShot({
      angleOffset: base.angleOffset + i * spread,
      damageScale,
      sizeScale: base.sizeScale * 0.9,
      speedScale: base.speedScale,
      tag: 'TRIPLE',
    }));
  },
});

defineAdapter('DuplicateProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.EVENT,
  note: 'ITM-022 Ctrl+C: an attack event may duplicate after pattern creation.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    const per = params.chance ?? 0.18;
    // Independent rolls compose rather than summing past certainty. Copies never
    // recursively copy themselves (ITM-022); the combat resolver enforces that.
    plan.duplicateChance = 1 - (1 - plan.duplicateChance) * (1 - per) ** stacks;
  },
});

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

defineAdapter('PierceProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-024 Binder Clip: one extra pierce, at the cost of some speed.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    plan.pierce += (params.pierce ?? 1) * stacks;
    // Appendix C.2 pairs the pierce with a 10 percent speed loss. The tradeoff *is*
    // the item, so it belongs here rather than being quietly dropped.
    plan.speed *= (params.speedMul ?? 0.9) ** stacks;
  },
});

defineAdapter('SizeProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-034 Printer Ink: bolder, slightly stronger, slightly shorter-ranged.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    plan.size *= (params.sizeMul ?? 1.25) ** stacks;
    plan.damage *= (params.damageMul ?? 1.1) ** stacks;
    if (plan.lifetime > 0) plan.lifetime *= (params.rangeMul ?? 0.92) ** stacks;
  },
});

defineAdapter('RangeProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-026 Extension Cord: longer reach through the weapon adapter.',
  fn: (plan, params) => {
    const mul = (params.rangeMul ?? 1.3) ** (params.stacks ?? 1);
    if (plan.lifetime > 0) plan.lifetime *= mul;
    if (plan.range > 0) plan.range *= mul;
  },
});

defineAdapter('KnockbackProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-020 Space Bar: stronger displacement on impact.',
  fn: (plan, params) => {
    plan.knockback += (params.knockback ?? 3) * (params.stacks ?? 1);
  },
});

defineAdapter('WallPassProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-014 Wireless Dongle: attacks ignore the first furniture obstacle.',
  fn: (plan, params) => {
    // Boundary and secret walls stay solid: ITM-014 explicitly must not reveal or
    // open hidden rooms, so only furniture is passed through.
    plan.ignoreFurniture += (params.count ?? 1) * (params.stacks ?? 1);
  },
});

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

defineAdapter('StickProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.PAYLOAD,
  note: 'ITM-016 Sticky Keys: attacks attach briefly, then deal a delayed pop.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    plan.sticky = {
      seconds: (params.seconds ?? 0.8) * stacks,
      burstDamageScale: (params.burstDamageScale ?? 0.5) * stacks,
    };
  },
});

defineAdapter('TrailProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.PAYLOAD,
  note: 'ITM-035 Toner Dust: destroyed attacks may leave a damaging dust patch.',
  fn: (plan, params) => {
    plan.trail = {
      hazardId: params.hazardId ?? 'HAZ-MACHINE_TONER_CLOUD',
      // Capped because Appendix C.2 asks Paper Shredder to create *fewer, larger*
      // patches to protect performance; an uncapped chance would carpet the room.
      chance: Math.min(0.6, (params.chance ?? 0.2) * (params.stacks ?? 1)),
      seconds: params.seconds ?? 2.5,
    };
  },
});

defineAdapter('StatusProjectileAdapter', {
  supports: PROJECTILE_TAGS,
  order: ORDER.PAYLOAD,
  note: 'Generic status payload: Correction Fluid slow, Highlighter mark, and kin.',
  fn: (plan, params) => {
    const status = params.status ?? STATUS.SLOW;
    const stacks = params.stacks ?? 1;
    // Chance composes; magnitude and duration do not stack (GDD ITM-032).
    const chance = 1 - (1 - (params.chance ?? 0.15)) ** stacks;
    plan.addStatus(status, chance, params.seconds ?? 2.5, params.magnitude ?? 1);
    if (status === STATUS.MARKED) {
      plan.markDamageBonus = Math.max(plan.markDamageBonus ?? 0, params.damageBonus ?? 0.15);
    }
  },
});
