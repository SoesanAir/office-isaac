/**
 * Melee arc, area slam, and tether modifier adapters.
 *
 * GDD refs: 7.2 (Melee arc: "Aim adapters, reach, repeat, mark, knockback";
 *           Area slam: "Diagonal aim, repeat, size, mark"; Tether: "Length, curve,
 *           shock, pull, return"), 7.3 (adapter contract), 8.5 (Mouse + Pen Laser
 *           rotates the whip arc modestly toward the nearest target inside an
 *           acquisition cone), Appendix B.2 (per-weapon adapter notes),
 *           R-ITM-006 (NO_EFFECT is a legitimate outcome).
 *
 * Why these are separate from the projectile family: a mechanic like HOMING means
 * something genuinely different here. A homing projectile changes its velocity; a
 * homing *arc* rotates its centre before it swings; a homing *tether* curves its
 * outbound path. Faking one with another would produce exactly the "meaningless stat
 * change" GDD 7.3's no-effect rule exists to forbid.
 */

import { defineAdapter } from '../adapters.js';
import { ARCHETYPE, STATUS } from '../../core/constants.js';
import { ORDER } from './projectile-adapters.js';

const MELEE_TAGS = [ARCHETYPE.MELEE_ARC, 'MELEE_ARC', 'DIRECTED'];
const SLAM_TAGS = [ARCHETYPE.AREA_SLAM, 'AREA_SLAM', 'AREA', 'DIRECTED'];
const TETHER_TAGS = [ARCHETYPE.TETHER, 'TETHER', 'DIRECTED'];

// ---------------------------------------------------------------------------
// Melee arc
// ---------------------------------------------------------------------------

defineAdapter('HomingArcAdapter', {
  supports: MELEE_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'WPN-002 + Pen Laser: the whip arc rotates toward the nearest target.',
  fn: (plan, params) => {
    // GDD 8.5 is specific: "rotates *modestly* toward the nearest target inside an
    // acquisition cone". A full snap would remove the aiming skill the weapon is
    // built around, so both the rotation and the cone are capped.
    plan.arcAim = {
      maxRotation: Math.min(params.maxRotation ?? 0.5, 0.9),
      acquisitionCone: params.acquisitionCone ?? 1.1,
      radius: params.radius ?? 4,
    };
  },
});

defineAdapter('ReachArcAdapter', {
  supports: MELEE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-026 Extension Cord on a melee weapon: the cable reaches farther.',
  fn: (plan, params) => {
    plan.arcRadius *= (params.reachMul ?? 1.3) ** (params.stacks ?? 1);
  },
});

defineAdapter('RepeatArcAdapter', {
  supports: MELEE_TAGS,
  order: ORDER.EVENT,
  note: 'Swings a second, weaker arc shortly after the first.',
  fn: (plan, params) => {
    plan.repeatEvery = params.every ?? 1;
    plan.repeatDelay = params.delay ?? 0.12;
    plan.repeatDamageScale = params.damageScale ?? 0.6;
  },
});

defineAdapter('OffsetArcAdapter', {
  supports: MELEE_TAGS,
  order: ORDER.MULTIPLICITY,
  note: 'ITM-010 Dual Monitors on a melee weapon: two offset arc centres.',
  fn: (plan, params) => {
    const offset = params.offset ?? 0.45;
    const damageScale = params.damageScale ?? 0.72;
    // Appendix C.2: "melee weapons create offset arcs". Two arcs rather than one
    // wider arc, so the coverage gain is real but the sweep still has gaps.
    plan.shots = plan.shots.flatMap((shot) => [-1, 1].map((dir) => ({
      ...shot,
      angleOffset: shot.angleOffset + dir * offset,
      damageScale: shot.damageScale * damageScale,
      tag: 'DUAL',
    })));
  },
});

defineAdapter('EightDirectionArcAdapter', {
  supports: MELEE_TAGS,
  order: ORDER.TRAJECTORY - 5,
  note: 'ITM-012 Numeric Keypad on a melee weapon: arc centres snap to eight ways.',
  fn: (plan) => {
    // GDD 8.5: "Whip centres snap to eight directions, including diagonals."
    plan.eightDirection = true;
  },
});

defineAdapter('KnockbackArcAdapter', {
  supports: [...MELEE_TAGS, ...SLAM_TAGS],
  order: ORDER.GEOMETRY,
  note: 'ITM-020 Space Bar on melee and area weapons: stronger displacement.',
  fn: (plan, params) => {
    // GDD ITM-020: "Melee and area weapons gain stronger displacement", so the
    // value here is deliberately larger than the projectile equivalent.
    plan.knockback += (params.knockback ?? 5) * (params.stacks ?? 1);
  },
});

// ---------------------------------------------------------------------------
// Area slam
// ---------------------------------------------------------------------------

defineAdapter('EchoSlamAdapter', {
  supports: SLAM_TAGS,
  order: ORDER.EVENT,
  note: 'ITM-015 Macro Pad on WPN-007: repeats a weaker echo stamp.',
  fn: (plan, params) => {
    plan.repeatEvery = params.every ?? 5;
    plan.repeatDelay = params.delay ?? 0.14;
    plan.repeatDamageScale = params.damageScale ?? 0.5;
  },
});

defineAdapter('SizeSlamAdapter', {
  supports: SLAM_TAGS,
  order: ORDER.GEOMETRY,
  note: 'A larger stamp footprint. ITM-018 Caps Lock and ITM-034 Printer Ink.',
  fn: (plan, params) => {
    const mul = (params.sizeMul ?? 1.25) ** (params.stacks ?? 1);
    plan.size *= mul;
    if (plan.arcRadius > 0) plan.arcRadius *= mul;
  },
});

defineAdapter('EightDirectionSlamAdapter', {
  supports: SLAM_TAGS,
  order: ORDER.TRAJECTORY - 5,
  note: 'ITM-012 Numeric Keypad on WPN-007/WPN-014: diagonal stamp angles.',
  fn: (plan) => {
    plan.eightDirection = true;
  },
});

// ---------------------------------------------------------------------------
// Tether
// ---------------------------------------------------------------------------

defineAdapter('CurvingTetherAdapter', {
  supports: TETHER_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'WPN-010 + Pen Laser: the outbound receiver curves toward a target.',
  fn: (plan, params) => {
    plan.tetherCurve = {
      strength: params.strength ?? 0.22,
      radius: params.radius ?? 5,
    };
  },
});

defineAdapter('LengthTetherAdapter', {
  supports: TETHER_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-026 Extension Cord on WPN-010: a longer throw.',
  fn: (plan, params) => {
    plan.range *= (params.lengthMul ?? 1.3) ** (params.stacks ?? 1);
  },
});

defineAdapter('ShockTetherAdapter', {
  supports: TETHER_TAGS,
  order: ORDER.PAYLOAD,
  note: 'ITM-025 Ethernet Cable on WPN-010: shocks the tethered target.',
  fn: (plan, params) => {
    // Appendix C.2: the Desk Phone "shocks tethered targets continuously at a
    // limited rate". That rate cap is why this is not merely a status payload — an
    // uncapped continuous tether would tick every simulation frame.
    plan.tetherShock = {
      damageScale: params.damageScale ?? 0.45,
      tickSeconds: Math.max(0.2, params.tickSeconds ?? 0.35),
    };
    plan.addStatus(STATUS.SHOCK, params.chance ?? 1, params.seconds ?? 0.4, 1);
  },
});

defineAdapter('ReturnTetherAdapter', {
  supports: TETHER_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'ITM-021 Backspace on a tether: returns faster with a second-path bonus.',
  fn: (plan, params) => {
    plan.returns = true;
    // Appendix C.2: "Mouse and Desk Phone instead return faster and gain a
    // second-path bonus" — a different and better deal than the generic 60 percent.
    plan.returnDamageScale = params.returnDamageScale ?? 0.85;
    plan.returnSpeedMul = params.returnSpeedMul ?? 1.4;
  },
});
