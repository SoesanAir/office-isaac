/**
 * Aim, rhythm, and charge-wave modifier adapters.
 *
 * GDD refs: 4.2 (aiming rules; the Numeric Keypad enables eight-direction aim for
 *           compatible weapons), 7.2 (Charge wave: "Paired waves, bend, weight,
 *           size"), 7.3 (adapter contract), 8.5 (Keyboard + Numeric Keypad launches
 *           keys in eight directions; Mouse + Numeric Keypad snaps whip centres),
 *           Appendix C.2 (Caps Lock, Shift Key, Macro Pad, Red Pen, Red Staple
 *           Remover, Wrist Rest magnitudes), R-PLY-003 (clamps).
 *
 * These are the weapon-agnostic adapters: they operate on the attack *event* rather
 * than on projectile geometry, so a crit chance or an eighth-attack power tick means
 * the same thing whether the weapon fires keycaps or swings a mouse. That is why they
 * declare every archetype as supported — unlike the family adapters, there is nothing
 * archetype-specific to translate.
 */

import { defineAdapter } from '../adapters.js';
import { ARCHETYPE } from '../../core/constants.js';
import { ORDER } from './projectile-adapters.js';

/** Every archetype, plus the loose tags weapons use in `modifierTags`. */
const ALL_ARCHETYPES = [
  ...Object.values(ARCHETYPE),
  'DIRECTED', 'REPEATABLE', 'SUSTAINED', 'CHARGED', 'BURST', 'AREA',
];

const WAVE_TAGS = [ARCHETYPE.CHARGE_WAVE, 'CHARGE_WAVE', 'CHARGED', 'DIRECTED'];

// ---------------------------------------------------------------------------
// Aim
// ---------------------------------------------------------------------------

defineAdapter('EightDirectionAdapter', {
  supports: ALL_ARCHETYPES,
  // Before trajectory, because a homing adapter needs to know the launch set.
  order: ORDER.TRAJECTORY - 5,
  note: 'ITM-012 Numeric Keypad: enables eight-direction aim for compatible weapons.',
  fn: (plan) => {
    // The input system reads this to decide whether held aim keys combine into a
    // diagonal or resolve to the most recent cardinal (GDD 4.2). The adapter only
    // states the capability; it never picks a direction.
    plan.eightDirection = true;
  },
});

defineAdapter('SpreadControlAdapter', {
  supports: ALL_ARCHETYPES,
  order: ORDER.GEOMETRY,
  note: 'ITM-009 Wrist Rest: tighter spread and less incoming knockback.',
  fn: (plan, params) => {
    // Appendix C.2: reduce weapon spread by 35 percent. Compounding per stack rather
    // than subtracting keeps it from ever reaching a nonsensical negative spread.
    plan.spread *= (1 - (params.spreadReduction ?? 0.35)) ** (params.stacks ?? 1);
  },
});

// ---------------------------------------------------------------------------
// Rhythm and cadence
// ---------------------------------------------------------------------------

defineAdapter('MacroRepeatAdapter', {
  supports: ALL_ARCHETYPES,
  order: ORDER.EVENT,
  note: 'ITM-015 Macro Pad: every fifth attack repeats shortly after, weaker.',
  fn: (plan, params) => {
    // Appendix C.2: every fifth valid attack repeats after 0.08s at 65 percent.
    plan.repeatEvery = params.every ?? 5;
    plan.repeatDelay = params.delay ?? 0.08;
    plan.repeatDamageScale = params.damageScale ?? 0.65;
    // "Charge weapons repeat a partial charge; sustained weapons pulse instead."
    // The weapon's own adapter map redirects those cases to PulseBeamAdapter or
    // EchoSlamAdapter, so this only has to describe the discrete-attack case.
    if (plan.chargeTiers) plan.repeatPartialCharge = true;
  },
});

defineAdapter('ChargedEighthAdapter', {
  supports: ALL_ARCHETYPES,
  order: ORDER.EVENT,
  note: 'ITM-018 Caps Lock: every eighth attack is larger and deals double damage.',
  fn: (plan, params) => {
    plan.chargedEvery = params.every ?? 8;
    plan.chargedDamageScale = params.damageScale ?? 2;
    plan.chargedSizeScale = params.sizeScale ?? 1.5;
    // Appendix C.2: the counter persists across rooms but resets on floor
    // transition, so the player cannot bank a charge through the elevator.
    plan.chargedResetsOnFloor = true;
  },
});

defineAdapter('AlternatingAdapter', {
  supports: ALL_ARCHETYPES,
  order: ORDER.EVENT,
  note: 'ITM-019 Shift Key: attacks alternate between normal and empowered.',
  fn: (plan, params) => {
    plan.alternating = true;
    plan.alternateDamageScale = params.damageScale ?? 1.35;
    // Appendix C.2: "Dual attacks share one alternation state", so the flag lives on
    // the plan rather than on each shot — every shot in a pattern is empowered
    // together, or none is.
  },
});

defineAdapter('CritAdapter', {
  supports: ALL_ARCHETYPES,
  order: ORDER.EVENT,
  note: 'ITM-057 Red Pen: a chance to deal double damage, better against Marked.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    const per = params.chance ?? 0.1;
    // Independent rolls compose, so two crit items approach but never reach certainty.
    plan.critChance = 1 - (1 - plan.critChance) * (1 - per) ** stacks;
    plan.critMultiplier = Math.max(plan.critMultiplier, params.multiplier ?? 2);
    plan.critBonusVsMarked = (plan.critBonusVsMarked ?? 0) + (params.markedBonus ?? 0.08) * stacks;
    // GDD R-UIX-001 / D-013: crit text is never shown as a number in the normal HUD.
  },
});

defineAdapter('ArmorPierceAdapter', {
  supports: ALL_ARCHETYPES,
  order: ORDER.EVENT,
  note: 'ITM-028 Red Staple Remover: ignores part of tagged armour and shielding.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    const fraction = params.fraction ?? 0.25;
    // Compose as independent reductions so two armour items cannot exceed 100 percent
    // and trivialise every armoured variant in the game.
    for (let i = 0; i < stacks; i += 1) {
      plan.armorPierceFraction = 1 - (1 - plan.armorPierceFraction) * (1 - fraction);
    }
    // ITM-028 explicitly "does not bypass invulnerability phases" (R-BSS-004), which
    // the combat resolver enforces before armour is ever consulted.
  },
});

// ---------------------------------------------------------------------------
// Charge wave
// ---------------------------------------------------------------------------

defineAdapter('SteeringWaveAdapter', {
  supports: WAVE_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'WPN-012 + Pen Laser: the sheet wave rotates gently toward a target.',
  fn: (plan, params) => {
    // Appendix B.2 says "gently rotates" — a wide slow wave that tracked sharply
    // would be unavoidable rather than readable.
    plan.waveSteer = {
      maxRotation: Math.min(params.maxRotation ?? 0.3, 0.6),
      radius: params.radius ?? 6,
    };
  },
});

defineAdapter('PairedWaveAdapter', {
  supports: WAVE_TAGS,
  order: ORDER.MULTIPLICITY,
  note: 'ITM-010 Dual Monitors on WPN-012: two narrow sheets instead of one broad.',
  fn: (plan, params) => {
    const offset = params.offset ?? 0.3;
    // Appendix B.2: "Dual Monitors launches paired narrow sheets." Narrower, not
    // merely doubled, so total coverage is roughly preserved and the item reads as a
    // change in shape rather than a straight damage increase.
    plan.shots = plan.shots.flatMap((shot) => [-1, 1].map((dir) => ({
      ...shot,
      angleOffset: shot.angleOffset + dir * offset,
      damageScale: shot.damageScale * (params.damageScale ?? 0.72),
      sizeScale: shot.sizeScale * (params.narrowMul ?? 0.6),
      tag: 'DUAL',
    })));
  },
});

defineAdapter('WeightWaveAdapter', {
  supports: WAVE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-033 Paperweight on WPN-012: denser, slower, harder-hitting sheets.',
  fn: (plan, params) => {
    const stacks = params.stacks ?? 1;
    plan.damage *= (params.damageMul ?? 1.3) ** stacks;
    plan.knockback += (params.knockback ?? 4) * stacks;
    // Appendix C.2: "Copier sheets become denser and slower." The speed loss is the
    // price, so it is applied here rather than being silently skipped.
    if (plan.speed > 0) plan.speed *= (params.speedMul ?? 0.85) ** stacks;
  },
});

defineAdapter('SizeWaveAdapter', {
  supports: WAVE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'A broader sheet. ITM-034 Printer Ink and ITM-018 Caps Lock on WPN-012.',
  fn: (plan, params) => {
    plan.size *= (params.sizeMul ?? 1.25) ** (params.stacks ?? 1);
  },
});
