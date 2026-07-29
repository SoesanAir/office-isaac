/**
 * Active item effects. ACT-001..015, all ON_USE.
 *
 * GDD refs: Appendix C.3 (the effect and recharge table; every number here is
 *           quoted from it), 6.5 (actives recharge by clearing hostile rooms),
 *           9.4 (the active slot), R-CON-001 (an active is a deliberate, legible
 *           button press with a visible charge state), R-CMB-005 (random effects
 *           use scoped RNG), R-BSS-004 (a boss must never be trivialised by a
 *           single consumable), 5.5 (status rules).
 *
 * Context contract for ON_USE:
 *   ctx.run, ctx.room, ctx.player, ctx.hostiles, ctx.projectiles, ctx.events,
 *   ctx.rng, ctx.damageEnemy(enemy, req), ctx.spawnPickup(kind, count)
 *
 * The recurring theme in this file is the boss exception. Task Manager executes
 * ordinary enemies but only chips a boss; Out of Office passes through drones but
 * not a boss; All Hands charms normals but only slows a boss. Every one of those is
 * R-BSS-004 written as code: an active is a strong answer to a room and a partial
 * answer to a fight that is supposed to be a fight.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { EVENTS } from '../../core/events.js';
import { STATUS, DAMAGE_TAG } from '../../core/constants.js';
import { distance } from '../../core/math.js';

/** Enemies that are alive and can be affected. Boss/elite handled per hook. */
function living(ctx) {
  return (ctx.hostiles || []).filter((e) => !e.dead);
}

/** True for anything the GDD treats as a headline fight rather than a room filler. */
function isMajor(enemy) {
  return Boolean(enemy.isBoss || enemy.tags?.includes('ELITE'));
}

defineHook('EXECUTE_LOW_HEALTH_ENEMIES', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-001 Task Manager: ends the process on anything already failing.',
  fn: (ctx, params) => {
    const threshold = params?.threshold ?? 0.25;
    for (const enemy of living(ctx)) {
      if (isMajor(enemy)) {
        // C.3: "Deals a fixed burst to bosses and elites." A percentage execute on a
        // boss would be exactly the trivialisation R-BSS-004 forbids.
        ctx.damageEnemy?.(enemy, {
          amount: params?.bossBurst ?? 24,
          tags: [DAMAGE_TAG.ITEM],
          sourceId: 'ACT-001',
        });
        continue;
      }
      if (enemy.health / enemy.healthMax > threshold) continue;
      ctx.damageEnemy?.(enemy, {
        amount: enemy.health,
        tags: [DAMAGE_TAG.ITEM, DAMAGE_TAG.EXECUTE],
        sourceId: 'ACT-001',
      });
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_TASK_MANAGER' });
  },
});

defineHook('FREEZE_HOSTILES', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-002 Print Screen: freezes enemies and hostile fire; you keep attacking.',
  fn: (ctx, params) => {
    const seconds = params?.seconds ?? 3;
    if (ctx.room) ctx.room.hostileFreezeSeconds = seconds;
    for (const enemy of living(ctx)) enemy.frozenSeconds = seconds;
    // C.3: "Player attacks remain active." Freezing hostile projectiles in place
    // rather than deleting them is what makes the frozen frame readable — the danger
    // is still on screen, which is the whole point of a screenshot.
    ctx.projectiles?.pool.forEach((p) => {
      if (!p.__dead && p.owner !== 'PLAYER') p.frozenSeconds = seconds;
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_FREEZE' });
  },
});

defineHook('REWIND_ROOM', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-003 Ctrl+Z: restores the room-entry snapshot.',
  fn: (ctx) => {
    const room = ctx.room;
    if (!room?.entrySnapshot) return;
    // C.3 is explicit that pickups, purchases, and item swaps are NOT restored or
    // duplicated. Restoring them would make this a credit duplicator, so the snapshot
    // deliberately covers only health, position, enemies, and projectiles.
    ctx.restoreSnapshot?.(room.entrySnapshot);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_REWIND' });
  },
});

defineHook('INVULNERABLE_PHASE_THROUGH', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-004 Out of Office: invulnerable and non-solid to normal enemies.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.invulnerableSeconds = Math.max(player.invulnerableSeconds ?? 0, params?.seconds ?? 5);
    // C.3: "Boss contact still blocks movement." Phasing through a boss would let a
    // player walk out of a scripted arena position, so the flag names normals only.
    player.phaseThroughNormals = true;
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_OUT_OF_OFFICE' });
  },
});

defineHook('ROOM_HASTE_BURST', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-005 Emergency Coffee Pot: a strong cadence and speed surge for the room.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.status?.apply(STATUS.HASTE, {
      // Room-long rather than timed: the fantasy is a fresh pot lasting the meeting,
      // and a room boundary is a beat the player already understands.
      seconds: params?.seconds ?? 999,
      roomScoped: true,
      magnitude: params?.magnitude ?? 0.4,
      sourceId: 'ACT-005',
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_COFFEE_POT' });
  },
});

defineHook('PULL_TO_CENTER', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-006 Meeting Invite: gathers movable enemies and roots them briefly.',
  fn: (ctx, params) => {
    const room = ctx.room;
    if (!room) return;
    const cx = room.centerX;
    const cy = room.centerY;
    for (const enemy of living(ctx)) {
      // "Movable" excludes turrets, anchored formations, and bosses. Yanking a
      // stationary enemy off its authored position would break the room's design.
      if (enemy.immovable || enemy.isBoss || enemy.tags?.includes('STATIONARY')) continue;
      enemy.pullTo = { x: cx, y: cy, strength: params?.strength ?? 9 };
      enemy.interruptLightAction?.();
      enemy.status?.apply(STATUS.ROOTED, { seconds: params?.rootSeconds ?? 1.2, sourceId: 'ACT-006' });
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_MEETING_INVITE' });
  },
});

defineHook('RESET_AI_AND_HAZARDS', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-007 Power Cycle: turn it off and on again.',
  fn: (ctx, params) => {
    for (const enemy of living(ctx)) {
      if (enemy.isBoss) continue; // C.3: non-boss AI states only.
      enemy.resetState?.();
      enemy.status?.clearBuffs?.();
    }
    // Disabling machine hazards is the half of this item that saves a bad room. It is
    // time-boxed rather than permanent so the room's authored danger comes back.
    for (const hazard of ctx.room?.hazards || []) {
      if (hazard.def?.family === 'MACHINE_STATES') hazard.disabledSeconds = params?.seconds ?? 5;
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_POWER_CYCLE' });
  },
});

defineHook('CONSUME_FED_ITEM', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'ACT-008 Shredder Bin: eats a pickup or pedestal item for a benefit.',
  fn: (ctx, params) => {
    const fed = ctx.fedItem;
    if (!fed) return;
    // The benefit is looked up by CATEGORY from data, not branched on in code
    // (GDD 22.5). A new pickup kind therefore needs a table row, not a code change.
    const table = params?.byCategory || {};
    const reward = table[fed.category] || table.DEFAULT;
    if (!reward) return;
    if (reward.stat) ctx.player?.addTemporaryStat?.(reward.stat, reward.magnitude, reward.seconds);
    if (reward.pickup) ctx.spawnPickup?.(reward.pickup, reward.count ?? 1);
    if (reward.permanent) ctx.player?.addPermanentStat?.(reward.permanent, reward.magnitude);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_SHREDDER_BIN' });
  },
});

defineHook('FORCE_CONE_CLEANSE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-009 Fire Extinguisher: a shoving cone that also puts things out.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    const range = params?.range ?? 5.5;
    const halfAngle = (params?.coneAngle ?? 1.1) / 2;
    const aim = player.aim ?? { x: 1, y: 0 };
    const inCone = (x, y) => {
      const dx = x - player.x;
      const dy = y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > range || d < 1e-6) return false;
      const dot = (dx / d) * aim.x + (dy / d) * aim.y;
      return Math.acos(Math.max(-1, Math.min(1, dot))) <= halfAngle;
    };
    for (const enemy of living(ctx)) {
      if (!inCone(enemy.x, enemy.y)) continue;
      enemy.applyKnockback?.(aim.x, aim.y, params?.knockback ?? 14);
      enemy.status?.remove?.(STATUS.BURN);
    }
    // "Erases LIGHT hostile projectiles" — heavy and boss-critical shots survive, so
    // the extinguisher is a panic button and not a full screen wipe.
    ctx.projectiles?.pool.forEach((p) => {
      if (p.__dead || p.owner === 'PLAYER' || p.heavy || p.bossCritical) return;
      if (!inCone(p.x, p.y)) return;
      ctx.projectiles.release(p);
    });
    for (const hazard of ctx.room?.hazards || []) {
      if (!inCone(hazard.x, hazard.y)) continue;
      if (hazard.def?.family === 'FIRE') hazard.extinguished = true;
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_EXTINGUISHER' });
  },
});

defineHook('STRIKE_PRIORITY_TARGET', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-010 Red Phone: escalate to whoever matters most in the room.',
  fn: (ctx, params) => {
    const alive = living(ctx);
    if (!alive.length) return;
    // Priority is boss, then elite, then highest encounter cost. Cost is the honest
    // measure of "who is the problem here" because it is the same number encounter
    // selection used to build the room.
    let target = alive.find((e) => e.isBoss)
      || alive.find((e) => e.tags?.includes('ELITE'))
      || alive.reduce((a, b) => ((b.def?.cost ?? 0) > (a.def?.cost ?? 0) ? b : a));
    ctx.damageEnemy?.(target, {
      amount: params?.amount ?? 30,
      tags: [DAMAGE_TAG.ITEM],
      sourceId: 'ACT-010',
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_RED_PHONE' });
  },
});

defineHook('SPEND_CREDITS_FOR_DAMAGE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-011 Expense Report: convert credits into a room-long damage increase.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    const max = params?.maxCredits ?? 10;
    const spend = Math.min(max, player.credits ?? 0);
    if (spend <= 0) return;
    player.credits -= spend;
    // Proportional to the amount spent (C.3), so a player who saved up gets a real
    // spike and a broke player still gets something rather than a wasted charge.
    player.addTemporaryStat?.('damageMul', 1 + spend * (params?.perCredit ?? 0.05), null, { roomScoped: true });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_EXPENSE_REPORT' });
  },
});

defineHook('SPAWN_COVER_OBJECTS', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-012 Copier Jam: temporary breakable cover.',
  fn: (ctx, params) => {
    const room = ctx.room;
    const player = ctx.player;
    if (!room || !player) return;
    // "In a VALID pattern" is the load-bearing word: R-ENV-004 forbids blocking a
    // required door, blast point, or spawn, so placement asks the room rather than
    // dropping cover wherever the player is standing.
    const spots = room.findFreeCoverSpots?.({
      around: { x: player.x, y: player.y },
      count: params?.count ?? 3,
      radius: params?.radius ?? 3,
    }) || [];
    for (const spot of spots) {
      room.addTemporaryObject?.({
        objectId: params?.objectId ?? 'ENV-021',
        x: spot.x,
        y: spot.y,
        health: params?.health ?? 12,
        blocksProjectiles: true,
      });
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_COPIER_JAM' });
  },
});

defineHook('REVEAL_FLOOR_MAP', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-013 Floor Plan: reveals the layout, minus the secrets.',
  fn: (ctx) => {
    const floor = ctx.run?.floor;
    if (!floor) return;
    for (const node of floor.nodes.values()) {
      // Secret rooms stay off the map (R-FLR-010). Everything else, including
      // branches the player has not walked yet, becomes visible.
      if (node.hidden) continue;
      node.mapRevealed = true;
      node.categoryRevealed = true;
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_FLOOR_PLAN' });
  },
});

defineHook('MARK_ALL_FOR_REWARD', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-014 Performance Improvement Plan: faster enemies, guaranteed reward.',
  fn: (ctx, params) => {
    const room = ctx.room;
    for (const enemy of living(ctx)) {
      enemy.status?.apply(STATUS.MARKED, {
        seconds: params?.seconds ?? 999,
        roomScoped: true,
        magnitude: params?.damageBonus ?? 0.15,
        sourceId: 'ACT-014',
      });
      enemy.status?.apply(STATUS.HASTE, {
        seconds: params?.seconds ?? 999,
        roomScoped: true,
        magnitude: params?.hasteMagnitude ?? 0.2,
        sourceId: 'ACT-014',
      });
    }
    // The trade is the whole item: a harder room in exchange for a certain reward.
    // Setting it on the room means it survives enemies that spawn in later waves.
    if (room) room.guaranteedClearReward = true;
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_PIP' });
  },
});

defineHook('TAUNT_AND_PUNISH_APPROACH', {
  timing: HOOK_TIMING.ON_USE,
  note: 'ACT-015 Desk Bell: calls them in, then rewards you for it.',
  fn: (ctx, params) => {
    const player = ctx.player;
    for (const enemy of living(ctx)) {
      if (enemy.isBoss) continue;
      enemy.tauntTarget = player;
      enemy.tauntSeconds = params?.seconds ?? 3;
    }
    // The bonus only applies to enemies actually closing distance, so the item
    // rewards the player for using the taunt rather than for ringing the bell.
    if (player) {
      player.approachDamageBonus = params?.bonus ?? 0.3;
      player.approachBonusSeconds = params?.seconds ?? 3;
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_DESK_BELL' });
  },
});

// Referenced by CHR-009 Frayed Cable, which reshapes the Ethernet Cable chain rather
// than adding a second one. Lives here because it is a use-time reshape of an active
// behaviour rather than a passive stat.
defineHook('RESHAPE_CHAIN', {
  timing: HOOK_TIMING.STAT,
  note: 'CHR-009 Frayed Cable: chains travel farther for slightly less damage.',
  fn: (ctx, params) => {
    ctx.chainRadiusMul = (ctx.chainRadiusMul ?? 1) * (params?.radiusMul ?? 1.4);
    ctx.chainDamageMul = (ctx.chainDamageMul ?? 1) * (params?.damageMul ?? 0.85);
  },
});

export { living, isMajor, distance };
