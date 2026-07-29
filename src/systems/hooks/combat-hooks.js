/**
 * Combat reaction hooks: on-hit, on-kill, on-damaged, and the death guard.
 *
 * GDD refs: Appendix C.2 (per-item magnitudes), 5.3 (damage resolution order: on-hit
 *           items run at step 4, after buffers are consumed), R-CMB-005 (all random
 *           combat procs use deterministic scoped RNG), R-ITM-007 (a liability must be
 *           mechanically legible and cannot create an unwinnable run), 5.5 (status
 *           rules including the player-side restrictions), ITM-058 (revival happens
 *           before run-end persistence).
 *
 * Every hook that rolls a chance takes its RNG from `ctx.rng`, which the combat
 * resolver scopes per damage event. Reaching for a fresh stream here would break seed
 * replay; reaching for Math.random would break it silently.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { EVENTS } from '../../core/events.js';
import { STATUS, DAMAGE_TAG } from '../../core/constants.js';
import { distance } from '../../core/math.js';

defineHook('CHANCE_ON_HIT_STATUS', {
  timing: HOOK_TIMING.ON_HIT,
  usesRng: true,
  note: 'A chance to apply a status on hit. ITM-031 Correction Fluid and kin.',
  fn: (ctx, params) => {
    if (!ctx.target || !ctx.rng) return;
    if (!ctx.rng.chance(params.chance ?? 0.15)) return;
    ctx.target.status?.apply(params.status ?? STATUS.SLOW, {
      seconds: params.seconds ?? 2.5,
      magnitude: params.magnitude ?? 0.35,
      sourceId: ctx.sourceId,
    });
  },
});

defineHook('MARK_ON_FIRST_HIT', {
  timing: HOOK_TIMING.ON_HIT,
  note: 'ITM-032 Highlighter: the first hit marks a target; refreshing does not stack.',
  fn: (ctx, params) => {
    const target = ctx.target;
    if (!target?.status) return;
    // Appendix C.2: "Refreshing does not stack magnitude." The status container merges
    // rather than adds, so re-applying is idempotent by construction.
    target.status.apply(STATUS.MARKED, {
      seconds: params.seconds ?? 4,
      magnitude: params.damageBonus ?? 0.15,
      sourceId: ctx.sourceId,
    });
  },
});

defineHook('CHANCE_ON_HIT_DAMAGE', {
  timing: HOOK_TIMING.ON_HIT,
  usesRng: true,
  note: 'A chance for bonus damage on hit, independent of the crit system.',
  fn: (ctx, params) => {
    if (!ctx.target || !ctx.rng) return;
    if (!ctx.rng.chance(params.chance ?? 0.1)) return;
    ctx.bonusDamage = (ctx.bonusDamage ?? 0) + (ctx.dealt ?? 0) * (params.scale ?? 0.5);
  },
});

defineHook('CHAIN_SHOCK_ON_HIT', {
  timing: HOOK_TIMING.ON_HIT,
  note: 'ITM-025 Ethernet Cable: chains reduced damage to one nearby enemy.',
  fn: (ctx, params) => {
    const target = ctx.target;
    const hostiles = ctx.hostiles || [];
    if (!target) return;
    // Appendix C.2: a cooldown prevents repeated chains from the same attack tick.
    // Without it a wide pattern would chain once per projectile, turning a modest item
    // into the strongest damage source in the game.
    if (ctx.chainedThisTick) return;
    ctx.chainedThisTick = true;

    let best = null;
    let bestD = params.radius ?? 3.2;
    for (const enemy of hostiles) {
      if (enemy === target || enemy.dead) continue;
      const d = distance(target.x, target.y, enemy.x, enemy.y);
      if (d < bestD) { bestD = d; best = enemy; }
    }
    if (!best) return;
    ctx.chainTo = {
      enemy: best,
      amount: (ctx.dealt ?? 0) * (params.scale ?? 0.45),
      status: { status: STATUS.SHOCK, chance: 1, seconds: 0.3, magnitude: 1 },
    };
  },
});

defineHook('CONTACT_DAMAGE_AURA', {
  timing: HOOK_TIMING.TICK,
  note: 'ITM-043 Desk Cactus: hurts enemies that touch you, and blunts contact damage.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player || !ctx.hostiles) return;
    // Rate-limited: an aura ticking every frame would delete anything that brushed the
    // player, which is not what a cactus on a desk should do.
    ctx.auraTimer = (ctx.auraTimer ?? 0) - (ctx.dt ?? 0);
    if (ctx.auraTimer > 0) return;
    ctx.auraTimer = params.intervalSeconds ?? 0.4;
    for (const enemy of ctx.hostiles) {
      if (enemy.dead) continue;
      if (distance(player.x, player.y, enemy.x, enemy.y) > player.radius + enemy.radius + 0.1) continue;
      ctx.damageEnemy?.(enemy, {
        amount: params.damage ?? 3,
        tags: [DAMAGE_TAG.CONTACT],
        sourceId: 'aura',
      });
    }
  },
});

defineHook('SHIELD_FIRST_HIT_PER_FLOOR', {
  timing: HOOK_TIMING.ON_DAMAGE_GUARD,
  note: 'ITM-044 Stress Ball: reduces the first normal hit on each floor.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    // Sacrifice and self-damage bypass it (Appendix C.2): the item protects from the
    // room, not from the player's own decisions.
    const tags = ctx.tags || [];
    if (tags.includes(DAMAGE_TAG.SACRIFICE) || tags.includes(DAMAGE_TAG.SELF)) return;
    if (player.floorFlags.get('stressBallUsed')) return;
    player.floorFlags.set('stressBallUsed', true);
    ctx.reduction = (ctx.reduction ?? 0) + (params.halfUnits ?? 1);
  },
});

defineHook('ERASE_NEAR_MISS', {
  timing: HOOK_TIMING.TICK,
  usesRng: true,
  note: 'ITM-030 Whiteboard Eraser: near-miss hostile shots may be erased.',
  fn: (ctx, params) => {
    if (!ctx.player || !ctx.projectiles || !ctx.rng) return;
    const radius = params.radius ?? 1.1;
    const luck = ctx.player.stats?.luck ?? 0;
    const chance = Math.min(0.5, (params.chance ?? 0.12) + luck * 0.01);
    ctx.projectiles.pool.forEach((p) => {
      if (p.__dead || p.owner === 'PLAYER') return;
      // Never erase a boss-critical scripted object (Appendix C.2).
      if (p.bossCritical) return;
      if (distance(p.x, p.y, ctx.player.x, ctx.player.y) > radius + ctx.player.radius) return;
      if (!ctx.rng.chance(chance)) return;
      ctx.projectiles.release(p);
      ctx.events?.emit(EVENTS.PROJECTILE_DESTROYED, { reason: 'ERASED' });
    });
  },
});

defineHook('REVIVE_ONCE', {
  timing: HOOK_TIMING.ON_DEATH_GUARD,
  note: 'ITM-058 Spare Keyboard: revive once, and the item is consumed.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    if (player.floorFlags.get('spareKeyboardUsed')) return;
    player.floorFlags.set('spareKeyboardUsed', true);
    player.health.reviveTo(params.icons ?? 1);
    // Appendix C.2: "replace current weapon with Keyboard, and destroy this item."
    player.equipWeapon('WPN-001');
    const idx = player.passiveIds.indexOf('ITM-058');
    if (idx >= 0) player.passiveIds.splice(idx, 1);
    ctx.events?.emit(EVENTS.PLAYER_REVIVED, { by: 'ITM-058' });
    // Revival happens BEFORE run-end persistence, which is why this is a guard that
    // cancels the death rather than a reaction to it.
    return false;
  },
});

defineHook('HEAL_ON_ROOM_CLEAR', {
  timing: HOOK_TIMING.ON_ROOM_CLEAR,
  usesRng: true,
  note: 'ITM-042 Office Plant: a small chance to heal after a hostile clear.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player || !ctx.rng) return;
    if (player.health.composure >= player.health.composureMax) return;
    const luck = player.stats?.luck ?? 0;
    // Capped, so luck stacking cannot turn this into full sustain (Appendix C.2).
    const chance = Math.min(params.cap ?? 0.2, (params.chance ?? 0.05) + luck * 0.01);
    if (!ctx.rng.chance(chance)) return;
    player.health.healComposure(params.halfUnits ?? 1);
    ctx.events?.emit(EVENTS.PLAYER_HEALED, { by: 'ITM-042' });
  },
});

defineHook('DISABLE_ACTIVE_UNTIL_CLEARS', {
  timing: HOOK_TIMING.ON_FLOOR_START,
  note: 'ITM-054 Mandatory Training: actives are locked for the first N clears.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    // Charge still accumulates while disabled (Appendix C.2), so this blocks use only.
    player.floorFlags.set('activeLockedClears', params.clears ?? 3);
  },
});

defineHook('SHORTEN_ENEMY_COOLDOWNS', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  note: 'ITM-050 Open Calendar: enemies act faster. The liability half of the item.',
  fn: (ctx, params) => {
    // Applied to the room rather than per enemy, so it also covers enemies that spawn
    // in a later wave. Boss phase timers are NOT shortened unless explicitly tagged
    // (Appendix C.2); the boss controller checks that separately.
    if (ctx.room) ctx.room.enemyCooldownMul = params.mul ?? 0.85;
  },
});
