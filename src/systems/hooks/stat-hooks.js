/**
 * Stat and attack-pattern effect hooks.
 *
 * GDD refs: 8.7 (the passive catalogue categories), Appendix C.2 (the exact magnitude
 *           each item declares), 20.2 (Attack Graph combines weapon, passives,
 *           transformations, profile effects, and temporary statuses), R-PLY-003
 *           (clamps), R-ITM-001 (passives stack without an inventory cap),
 *           R-GOV-003 / 22.5 (content is data, never a switch statement).
 *
 * Most passives need no hook at all: a `stats` block on the definition is applied
 * directly by the attack graph, which is why `ITM-001 Espresso Shot` is pure data. The
 * hooks here exist for the items whose effect is *conditional* — it depends on health,
 * on a counter, or on which weapon is equipped — because a static multiplier cannot
 * express those.
 *
 * STAT hooks are pure: read `ctx.plan` and `ctx.player`, write `ctx.plan`. No RNG, no
 * events, no side effects. That purity is what lets the attack graph cache a resolved
 * plan and only rebuild when the build actually changes.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';

defineHook('STAT_MODIFY', {
  timing: HOOK_TIMING.STAT,
  note: 'Generic multiplier/addition set, for items whose stats block cannot express it.',
  fn: (ctx, params) => {
    const plan = ctx.plan;
    if (params.damageMul) plan.damage *= params.damageMul;
    if (params.damageAdd) plan.damage += params.damageAdd;
    if (params.intervalMul) plan.interval *= params.intervalMul;
    if (params.speedMul && plan.speed > 0) plan.speed *= params.speedMul;
    if (params.sizeMul) plan.size *= params.sizeMul;
    if (params.rangeMul) {
      if (plan.lifetime > 0) plan.lifetime *= params.rangeMul;
      if (plan.range > 0) plan.range *= params.rangeMul;
    }
    if (params.knockbackAdd) plan.knockback += params.knockbackAdd;
  },
});

defineHook('DAMAGE_SCALE_ON_LOW_HEALTH', {
  timing: HOOK_TIMING.STAT,
  note: 'ITM-053 Burnout: damage scales up as total health falls.',
  fn: (ctx, params) => {
    const health = ctx.player?.health;
    if (!health) return;
    // Appendix C.2: "+15 to +55 percent as total health decreases." Interpolated on
    // the fraction of health remaining, so the curve is smooth rather than stepped —
    // a step would make one specific hit feel arbitrarily punishing.
    const max = Math.max(1, health.composureMax + health.caffeine + health.spite);
    const missing = 1 - Math.min(1, health.total / max);
    const min = params.minBonus ?? 0.15;
    const peak = params.maxBonus ?? 0.55;
    ctx.plan.damage *= 1 + min + (peak - min) * missing;
  },
});

defineHook('CRIT_VS_FULL_HEALTH', {
  timing: HOOK_TIMING.STAT,
  note: 'ITM-047 Confidential Stamp: more damage against enemies still at full health.',
  fn: (ctx, params) => {
    // Stored on the plan rather than applied here, because "is the target at full
    // health" is only knowable at the moment of impact.
    ctx.plan.fullHealthBonus = (ctx.plan.fullHealthBonus ?? 0) + (params.bonus ?? 0.25);
  },
});

defineHook('CRIT_CHANCE', {
  timing: HOOK_TIMING.STAT,
  note: 'ITM-057 Red Pen: a chance to deal double damage.',
  fn: (ctx, params) => {
    const plan = ctx.plan;
    const per = params.chance ?? 0.1;
    // Independent rolls compose, so stacking approaches but never reaches certainty.
    plan.critChance = 1 - (1 - plan.critChance) * (1 - per);
    plan.critMultiplier = Math.max(plan.critMultiplier, params.multiplier ?? 2);
  },
});

defineHook('EXTRA_SHOT_EVERY_N', {
  timing: HOOK_TIMING.STAT,
  note: 'CHR-010 Spare Button: every Nth attack event produces a small extra shot.',
  fn: (ctx, params) => {
    ctx.plan.extraShotEvery = params.every ?? 20;
    ctx.plan.extraShotDamageScale = params.damageScale ?? 0.4;
  },
});

defineHook('PATTERN_MODIFY', {
  timing: HOOK_TIMING.ATTACK_PATTERN,
  note: 'Adjusts the resolved pattern: spread, pierce, bounce, or shot scaling.',
  fn: (ctx, params) => {
    const plan = ctx.plan;
    if (params.pierceAdd) plan.pierce += params.pierceAdd;
    if (params.bounceAdd) plan.bounce += params.bounceAdd;
    if (params.spreadMul) plan.spread *= params.spreadMul;
    if (params.shotDamageScale) {
      for (const shot of plan.shots) shot.damageScale *= params.shotDamageScale;
    }
  },
});

defineHook('DUPLICATE_HOSTILE_PROJECTILES', {
  timing: HOOK_TIMING.ATTACK_PATTERN,
  note: 'ITM-049 Reply All: duplicates player output AND hostile projectiles.',
  fn: (ctx, params) => {
    const plan = ctx.plan;
    // The liability half is the point: GDD ITM-049 duplicates the player's projectiles
    // at reduced damage and the ENEMY's at FULL damage. Flagging it on the plan lets
    // the encounter runtime apply the hostile half, so the drawback is real rather
    // than decorative (R-ITM-007: a liability must be mechanically legible).
    plan.duplicatePlayerScale = params.playerScale ?? 0.45;
    plan.duplicateHostileProjectiles = true;
    // Melee and beam weapons get a weaker echo while hostile patterns still duplicate.
    plan.echoScale = params.echoScale ?? 0.3;
  },
});
