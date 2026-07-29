/**
 * Supplement effects. SUP-001..014, all ON_USE.
 *
 * GDD refs: Appendix C.5 (the effect table and identified messages), 9.7 (wrapper
 *           appearances are shuffled onto effects at run start), R-CON-003 (the
 *           appearance-to-effect mapping is randomized per run but consistent
 *           within it), R-CON-004 (once identified, every matching wrapper shows
 *           the known name), 5.2 (health containers), 5.4 (exact-lethal rules).
 *
 * Context contract for ON_USE:
 *   ctx.run, ctx.room, ctx.player, ctx.events, ctx.rng, ctx.spawnPickup(kind, count)
 *
 * The pairs are the design. Focus Up and Focus Down are the same magnitude in
 * opposite directions, and they share a wrapper pool, so the gamble is real: GDD 9.7
 * says "positive and negative results share the same presentation rules", and eight of
 * these fourteen exist purely so the other six have something to hide behind.
 *
 * Note that SUP-001..008 are PERMANENT stat changes. That is why their magnitudes are
 * small — a permanent effect compounds across a run, and Appendix C.5 says "slightly"
 * in all eight rows.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { EVENTS } from '../../core/events.js';
import { STATUS } from '../../core/constants.js';

/**
 * The permanent-stat pairs, SUP-001..008.
 *
 * One hook rather than eight, because the difference between Focus Up and Focus Down
 * is a sign on a number, and eight near-identical hooks would be eight places to fix
 * the same bug. The item data supplies stat, magnitude, and direction.
 */
defineHook('PERMANENT_STAT_SHIFT', {
  timing: HOOK_TIMING.ON_USE,
  note: 'SUP-001..008: a small permanent stat change, up or down.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player || !params?.stat) return;
    player.addPermanentStat?.(params.stat, params.magnitude);
    ctx.identified = true;
    ctx.events?.emit(EVENTS.SFX_REQUESTED, {
      sound: params.magnitude >= 1 || params.magnitude > 0 ? 'SFX-SUPPLEMENT_GOOD' : 'SFX-SUPPLEMENT_BAD',
    });
  },
});

defineHook('RESTORE_ALL_COMPOSURE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'SUP-009 Full Recovery: refills the containers you have.',
  fn: (ctx) => {
    const player = ctx.player;
    if (!player) return;
    // Existing containers only (C.5), same as CARD-003. Nothing in the Supplement set
    // grows maximum health; that belongs to passives.
    player.health.healComposure(player.health.composureMax - player.health.composure);
    ctx.events?.emit(EVENTS.PLAYER_HEALED, { by: 'SUP-009' });
  },
});

defineHook('SELF_DAMAGE_NON_LETHAL', {
  timing: HOOK_TIMING.ON_USE,
  note: 'SUP-010 Bad Reaction: one full icon, but it will not kill you.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    const halfUnits = params?.halfUnits ?? 2;
    // C.5: "if this would kill the player, reduce health to one half-unit instead."
    // A gamble that can end the run on a coin flip is a different, worse item, and the
    // floor at one half-unit is what keeps the Supplement system worth gambling on.
    if (player.health.composure <= halfUnits) {
      player.health.setComposure(1);
      ctx.events?.emit(EVENTS.PLAYER_DAMAGED, { by: 'SUP-010', floored: true });
      return;
    }
    ctx.damagePlayer?.({ halfUnits, tags: ['SELF'], sourceId: 'SUP-010' });
  },
});

defineHook('TELEPORT_RANDOM_ROOM', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'SUP-011 Telework: somewhere else, possibly somewhere wrong.',
  fn: (ctx, params) => {
    const floor = ctx.run?.floor;
    if (!floor) return;
    // The 13th Floor error room is a rare, deliberate secret (GDD 11.7). The chance is
    // tiny and rolled first, so the ordinary teleport never eats the special case.
    if (ctx.rng.chance(params?.errorRoomChance ?? 0.02)) {
      if (ctx.enterErrorRoom?.()) return;
    }
    const candidates = [...floor.nodes.values()].filter((n) => !n.hidden && n.id !== ctx.room?.nodeId);
    if (!candidates.length) return;
    ctx.teleportTo?.(ctx.rng.pick(candidates).id);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_TELEPORT' });
  },
});

defineHook('ADRENALINE_THEN_CRASH', {
  timing: HOOK_TIMING.ON_USE,
  note: 'SUP-012 Adrenaline: strong for the room, then you pay for it.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.addTemporaryStat?.('damageMul', params?.damageMul ?? 1.5, null, { roomScoped: true });
    player.status?.apply(STATUS.HASTE, {
      seconds: 999, roomScoped: true, magnitude: params?.haste ?? 0.45, sourceId: 'SUP-012',
    });
    // The crash is queued rather than timed, so it lands when the surge ends no matter
    // how long the room takes. A fixed timer would let a fast player dodge the cost.
    player.queueOnEffectEnd?.('SUP-012', () => {
      player.status?.apply(STATUS.SLOW, {
        seconds: params?.crashSeconds ?? 2.5, magnitude: 0.35, sourceId: 'SUP-012',
      });
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-SUPPLEMENT_GOOD' });
  },
});

defineHook('REPEAT_LAST_POSITIVE_SUPPLEMENT', {
  timing: HOOK_TIMING.ON_USE,
  note: 'SUP-013 Placebo: does whatever the last good one did, or nothing.',
  fn: (ctx) => {
    const last = ctx.run?.lastIdentifiedPositiveSupplement;
    // C.5: "If none exists, do nothing." Doing nothing is a real outcome here, and it
    // is exactly the joke — so it must not silently fall back to something useful.
    if (!last || last.id === 'SUP-013') return;
    ctx.invokeHook?.(last.effectHook, last.params);
  },
});

defineHook('RANDOM_PICKUP_AND_STATUS', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'SUP-014 Mystery Snack: something, plus something else.',
  fn: (ctx, params) => {
    const kinds = params?.kinds || ['CREDIT', 'ACCESS_CARD', 'TONER_CHARGE', 'COMPOSURE', 'CAFFEINE'];
    ctx.spawnPickup?.(ctx.rng.pick(kinds), 1);
    // A short status either way (C.5), and the roll is a separate draw from the pickup
    // so a good pickup does not imply a good status.
    const statuses = params?.statuses || [STATUS.HASTE, STATUS.SLOW, STATUS.SHOCK, STATUS.MARKED];
    ctx.player?.status?.apply(ctx.rng.pick(statuses), {
      seconds: params?.seconds ?? 3,
      magnitude: 0.25,
      sourceId: 'SUP-014',
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-SUPPLEMENT_UNKNOWN' });
  },
});
