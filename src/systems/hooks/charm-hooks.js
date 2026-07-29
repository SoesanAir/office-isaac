/**
 * Desk Charm effects. CHR-001..018.
 *
 * GDD refs: Appendix C.6 (the effect table; the twelve-percent and twentieth-attack
 *           figures are quoted from it), 9.8 (charms occupy one dedicated slot and
 *           are "usually weaker, narrower, or less reliable than full passive
 *           items"), R-ECO-005 (starvation protection must be subtle and
 *           data-defined, and must not raise a message), R-FLR-010 (secrets stay
 *           secret), 13.3 (machine payout behaviour).
 *
 * Several charms reuse shared hooks rather than getting their own: CHR-002 uses
 * RETAIN_SPENT_CARD, CHR-009 uses RESHAPE_CHAIN, CHR-010 uses EXTRA_SHOT_EVERY_N,
 * CHR-015 uses CLEAR_REWARD_QUALITY_BIAS. That is the point of GDD 9.8 — a charm is
 * usually a narrower version of something the game already does.
 *
 * The thing to be careful about in this file is CHR-018 Lucky Lanyard. It is
 * starvation protection, and R-ECO-005 requires that to be invisible: no toast, no
 * "lucky!" flourish, and it must not change item quality. A card simply turns up.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { EVENTS } from '../../core/events.js';
import { STATUS } from '../../core/constants.js';

defineHook('PICKUP_BONUS_CHANCE', {
  timing: HOOK_TIMING.ON_PICKUP,
  usesRng: true,
  note: 'CHR-001 Coffee Sleeve: a caffeine pickup sometimes gives a little more.',
  fn: (ctx, params) => {
    if (ctx.kind !== (params?.kind ?? 'CAFFEINE')) return;
    if (!ctx.rng?.chance(params?.chance ?? 0.2)) return;
    ctx.bonusAmount = (ctx.bonusAmount ?? 0) + (params?.bonusHalfUnits ?? 1);
  },
});

defineHook('PICKUP_OVERFLOW_CHARGE', {
  timing: HOOK_TIMING.ON_PICKUP,
  note: 'CHR-003 USB Cap: a battery pickup at full charge is not wasted.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player || ctx.kind !== 'TONER_CHARGE') return;
    // Only when the charge would otherwise have been thrown away, and it "persists
    // until used" (C.6) rather than expiring on a timer.
    if ((player.activeCharge ?? 0) < (player.activeChargeMax ?? 1)) return;
    const held = player.runFlags?.get?.('usbCapOverflow') ?? 0;
    if (held >= (params?.max ?? 1)) return;
    player.runFlags?.set?.('usbCapOverflow', held + 1);
    ctx.consumed = true;
  },
});

defineHook('DAMAGE_VS_STATUS', {
  timing: HOOK_TIMING.STAT,
  note: 'CHR-004 Red Pushpin: more damage against a target already marked.',
  fn: (ctx, params) => {
    const status = params?.status ?? STATUS.MARKED;
    if (!ctx.target?.status?.has?.(status)) return;
    ctx.damageMul = (ctx.damageMul ?? 1) * (1 + (params?.bonus ?? 0.1));
  },
});

defineHook('FIRST_PICKUP_BONUS_PER_FLOOR', {
  timing: HOOK_TIMING.ON_PICKUP,
  note: 'CHR-005 Tiny Plant: the first health pickup of each floor gives more.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player || ctx.kind !== (params?.kind ?? 'COMPOSURE')) return;
    if (player.floorFlags.get('tinyPlantUsed')) return;
    // "if possible" (C.6): a bonus half-unit that would overflow is not granted, and
    // the charm stays armed rather than being spent on nothing.
    if (player.health.composure + 1 >= player.health.composureMax) return;
    player.floorFlags.set('tinyPlantUsed', true);
    ctx.bonusAmount = (ctx.bonusAmount ?? 0) + (params?.bonusHalfUnits ?? 1);
  },
});

defineHook('BIAS_ROOM_ROLE', {
  timing: HOOK_TIMING.ON_FLOOR_START,
  note: 'CHR-006 Meeting Token: mini-boss rooms are a little more likely.',
  fn: (ctx, params) => {
    // Applied at floor start so it influences generation weights for the NEXT floor
    // rather than mutating a floor already built — a charm must never rewrite a layout
    // the player is standing in.
    const run = ctx.run;
    if (!run) return;
    run.roleWeightBias = run.roleWeightBias || {};
    const role = params?.role ?? 'ROOM-013';
    run.roleWeightBias[role] = (run.roleWeightBias[role] ?? 1) * (params?.multiplier ?? 1.35);
    run.rewardQualityBias = (run.rewardQualityBias ?? 1) * (params?.rewardMultiplier ?? 1.15);
  },
});

defineHook('REDUCE_SLIDING', {
  timing: HOOK_TIMING.STAT,
  note: 'CHR-007 Rubber Foot: spills and conveyors move you less.',
  fn: (ctx, params) => {
    ctx.slideMul = (ctx.slideMul ?? 1) * (params?.mul ?? 0.6);
  },
});

defineHook('SHIELD_FIRST_HIT_IN_BOSS_ROOM', {
  timing: HOOK_TIMING.ON_DAMAGE_GUARD,
  note: 'CHR-008 Cracked Screen Protector: one softened projectile hit per boss.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player || !ctx.room?.node?.bossId) return;
    if (!(ctx.tags || []).includes('PROJECTILE')) return;
    if (player.floorFlags.get('screenProtectorUsed')) return;
    // "then the charm goes dormant until next floor" (C.6). A floor flag is exactly
    // that dormancy, and it clears on the elevator like every other floor flag.
    player.floorFlags.set('screenProtectorUsed', true);
    ctx.reduction = (ctx.reduction ?? 0) + (params?.halfUnits ?? 1);
  },
});

defineHook('REVEAL_ROLE_AFTER_DISCOVERY', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  note: 'CHR-011 Mini Calendar: challenge doors appear once you find the closet.',
  fn: (ctx, params) => {
    const floor = ctx.run?.floor;
    const room = ctx.room;
    if (!floor || !room) return;
    const trigger = params?.afterRole ?? 'ROOM-004';
    if (room.node?.role === trigger) ctx.player?.runFlags?.set?.('miniCalendarArmed', true);
    if (!ctx.player?.runFlags?.get?.('miniCalendarArmed')) return;
    for (const node of floor.nodes.values()) {
      // Never a secret room, even though a challenge room and a secret can look
      // similar on the map (R-FLR-010).
      if (node.hidden || node.role !== (params?.revealRole ?? 'ROOM-011')) continue;
      node.mapRevealed = true;
    }
  },
});

defineHook('SHOP_DISCOUNT_CHANCE', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  usesRng: true,
  note: 'CHR-012 Nameplate: a stocked price may be lower the first time you see it.',
  fn: (ctx, params) => {
    const room = ctx.room;
    if (!room?.shopStock || room.state.pricesSeen) return;
    // "when FIRST seen" (C.6): the roll happens once and then the room remembers, so
    // a player cannot re-enter to reroll a discount.
    room.state.pricesSeen = true;
    for (const entry of room.shopStock) {
      if (!ctx.rng.chance(params?.chance ?? 0.25)) continue;
      entry.price = Math.max(1, Math.round(entry.price * (params?.mul ?? 0.7)));
      entry.discounted = true;
    }
  },
});

defineHook('FLOOR_START_HASTE', {
  timing: HOOK_TIMING.ON_FLOOR_START,
  note: 'CHR-013 Transit Pass: the elevator leaves you moving.',
  fn: (ctx, params) => {
    ctx.player?.status?.apply(STATUS.HASTE, {
      seconds: params?.seconds ?? 4,
      magnitude: params?.magnitude ?? 0.3,
      sourceId: 'CHR-013',
    });
  },
});

defineHook('BOSS_BONUS_CREDITS_IF_UNHURT', {
  timing: HOOK_TIMING.ON_ROOM_CLEAR,
  note: 'CHR-014 Employee of the Month Pin: a clean boss pays a little extra.',
  fn: (ctx, params) => {
    const room = ctx.room;
    if (!room?.node?.bossId) return;
    // The room tracks whether the player took damage in it, which is the same signal
    // the no-damage unlocks read. One source of truth for "clean fight".
    if (room.state.playerTookDamage) return;
    ctx.spawnPickup?.('CREDIT', params?.credits ?? 5);
  },
});

defineHook('CLEAR_REWARD_QUALITY_BIAS', {
  timing: HOOK_TIMING.ON_LOOT_ROLL,
  note: 'CHR-015 Paper Star: rare clear rewards are slightly more likely.',
  fn: (ctx, params) => {
    // Biases the RARE band of an existing table rather than adding a term to the roll,
    // and never touches item quality (R-ITM-008 forbids power-sensitive selection).
    if (!ctx.weights) return;
    for (const kind of params?.kinds || ['RARE']) {
      if (ctx.weights[kind] !== undefined) ctx.weights[kind] *= params?.multiplier ?? 1.3;
    }
  },
});

defineHook('LOOSEN_BLAST_TOLERANCE', {
  timing: HOOK_TIMING.STAT,
  note: 'CHR-016 Old Password: secret walls forgive a less precise blast.',
  fn: (ctx, params) => {
    // Tolerance only. It does not reveal the wall, so the charm makes opening a secret
    // easier without making finding one easier — which is the part worth protecting.
    ctx.blastToleranceMul = (ctx.blastToleranceMul ?? 1) * (params?.mul ?? 1.5);
  },
});

defineHook('MACHINE_PAYOUT_BIAS', {
  timing: HOOK_TIMING.ON_LOOT_ROLL,
  note: 'CHR-017 Snack Wrapper: vending machines break a little later.',
  fn: (ctx, params) => {
    if (!ctx.weights || ctx.source !== 'MACHINE') return;
    if (ctx.weights.FAIL !== undefined) ctx.weights.FAIL *= params?.failMul ?? 0.6;
  },
});

defineHook('PITY_ACCESS_CARD', {
  timing: HOOK_TIMING.ON_ROOM_CLEAR,
  note: 'CHR-018 Lucky Lanyard: a card-less floor eventually produces one.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    if (player.floorFlags.get('accessCardSeenThisFloor')) return;
    const clears = (player.floorFlags.get('lanyardClears') ?? 0) + 1;
    player.floorFlags.set('lanyardClears', clears);
    if (clears < (params?.clears ?? 4)) return;
    player.floorFlags.set('accessCardSeenThisFloor', true);
    // R-ECO-005: subtle, and no message. The card is spawned as an ordinary pickup and
    // the player is never told why. Announcing it would advertise that the game is
    // helping, which the requirement explicitly forbids.
    ctx.spawnPickup?.('ACCESS_CARD', 1);
  },
});

// CHR-018's companion: notice when a card DOES drop, so the pity counter stays honest.
defineHook('NOTE_PICKUP_SEEN', {
  timing: HOOK_TIMING.ON_PICKUP,
  note: 'Bookkeeping for starvation protection. Records that a kind was seen.',
  fn: (ctx, params) => {
    if (ctx.kind !== (params?.kind ?? 'ACCESS_CARD')) return;
    ctx.player?.floorFlags?.set?.('accessCardSeenThisFloor', true);
  },
});

export { EVENTS };
