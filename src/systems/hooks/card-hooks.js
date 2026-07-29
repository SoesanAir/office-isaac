/**
 * Action Card effects. CARD-001..018, all ON_USE.
 *
 * GDD refs: Appendix C.4 (the effect table; the numbers here are its numbers),
 *           9.5 (the pocket slot holds one card or one Supplement), 9.6 (the
 *           starter set and CARD-015's boss-room restriction), R-CON-002 (a card's
 *           identity and effect are visible when discovered — so unlike a
 *           Supplement, nothing here is hidden), R-BSS-004 (no consumable
 *           trivialises a boss), R-FLR-010 (secrets stay secret).
 *
 * Context contract for ON_USE:
 *   ctx.run, ctx.room, ctx.player, ctx.hostiles, ctx.projectiles, ctx.events,
 *   ctx.rng, ctx.damageEnemy(enemy, req), ctx.spawnPickup(kind, count),
 *   ctx.teleportTo(nodeId), ctx.loot
 *
 * A card is a one-use tactic the player chose to carry, which is why almost every
 * effect here is scoped to "the current room": the card answers the situation in
 * front of you, and carrying it into the next room would make the pocket slot a
 * savings account instead of a decision.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { EVENTS } from '../../core/events.js';
import { STATUS, DAMAGE_TAG, DOOR_CLASS } from '../../core/constants.js';

const alive = (ctx) => (ctx.hostiles || []).filter((e) => !e.dead);

defineHook('RETURN_TO_START_ROOM', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-001 Meeting Canceled: back to the floor start room.',
  fn: (ctx) => {
    const floor = ctx.run?.floor;
    if (!floor) return;
    ctx.teleportTo?.(floor.startNodeId);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_TELEPORT' });
  },
});

defineHook('DAMAGE_ALL_HOSTILES', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-002 Company-Wide Email: heavy damage to everything hostile.',
  fn: (ctx, params) => {
    for (const enemy of alive(ctx)) {
      // Bosses take the same flat amount as everyone else. That is not an oversight:
      // a flat number is a meaningful chunk of a drone and a modest chunk of a boss,
      // which is R-BSS-004 falling out of the maths rather than needing a special case.
      ctx.damageEnemy?.(enemy, {
        amount: params?.amount ?? 18,
        tags: [DAMAGE_TAG.ITEM],
        sourceId: 'CARD-002',
      });
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_EMAIL' });
  },
});

defineHook('FULL_HEAL_AND_GRACE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-003 Sick Day: refill existing containers, plus a moment of grace.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    // "All empty Composure in EXISTING containers" — it never adds a container, so
    // this is recovery and not growth (GDD 5.2 keeps those two things separate).
    player.health.healComposure(player.health.composureMax - player.health.composure);
    player.invulnerableSeconds = Math.max(player.invulnerableSeconds ?? 0, params?.graceSeconds ?? 2);
    ctx.events?.emit(EVENTS.PLAYER_HEALED, { by: 'CARD-003' });
  },
});

defineHook('ROOM_DAMAGE_AND_CADENCE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-004 Approved Overtime: hit harder and faster for this room.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.addTemporaryStat?.('damageMul', params?.damageMul ?? 1.35, null, { roomScoped: true });
    player.addTemporaryStat?.('intervalMul', params?.intervalMul ?? 0.8, null, { roomScoped: true });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_OVERTIME' });
  },
});

defineHook('SPAWN_CREDIT_BURST', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'CARD-005 Expense Approved: a weighted burst of credits.',
  fn: (ctx, params) => {
    const [lo, hi] = params?.range ?? [8, 16];
    const count = lo + Math.floor(ctx.rng.next() * (hi - lo + 1));
    ctx.spawnPickup?.('CREDIT', count);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-PICKUP_CREDIT' });
  },
});

defineHook('SLOW_ROOM', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-006 Budget Freeze: enemies and their fire slow for the room.',
  fn: (ctx, params) => {
    const magnitude = params?.magnitude ?? 0.45;
    for (const enemy of alive(ctx)) {
      enemy.status?.apply(STATUS.SLOW, { seconds: 999, roomScoped: true, magnitude, sourceId: 'CARD-006' });
    }
    // Applied to the room too, so projectiles fired later in the fight are also slow.
    // Without this the card would weaken as the encounter went on, which is backwards.
    if (ctx.room) ctx.room.hostileProjectileSpeedMul = 1 - magnitude;
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_FREEZE' });
  },
});

defineHook('REROLL_ROOM_OFFERS', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-007 Reorganization: rerolls what this room is still offering.',
  fn: (ctx) => {
    const room = ctx.room;
    if (!room) return;
    // "From their ORIGINAL pools" (C.4). Rerolling from a different pool would let a
    // player launder a cheap room into an expensive one, so each offer remembers where
    // it came from and the reroll asks that pool again.
    ctx.loot?.rerollRoomOffers?.(room);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_REROLL' });
  },
});

defineHook('TIMED_INVULNERABILITY', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-008 Calendar Block: eight seconds, and no door skipping.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.invulnerableSeconds = Math.max(player.invulnerableSeconds ?? 0, params?.seconds ?? 8);
    // C.4: "without allowing door bypass". Invulnerability is not permission, so the
    // flag is explicit rather than inferred from the damage state.
    player.canBypassDoors = false;
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_BLOCK' });
  },
});

defineHook('OPEN_ADJACENT_LOCKS', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-009 Access Granted: opens the standard locks touching this room.',
  fn: (ctx) => {
    const room = ctx.room;
    if (!room) return;
    for (const door of room.doors) {
      // Standard card locks only. Boss seals, story locks, and secret walls are not
      // "standard locked doors" and opening them here would skip authored gating.
      if (door.doorClass !== DOOR_CLASS.LOCKED_CARD) continue;
      door.locked = false;
      ctx.events?.emit(EVENTS.DOOR_UNLOCKED, { free: true, by: 'CARD-009' });
    }
  },
});

defineHook('CHARM_NORMALS_SLOW_BOSSES', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-010 All Hands: normals turn, bosses just slow down.',
  fn: (ctx, params) => {
    for (const enemy of alive(ctx)) {
      if (enemy.isBoss) {
        // C.4 states the boss substitution outright. A charmed boss would fight its
        // own arena scripting and produce nonsense.
        enemy.status?.apply(STATUS.SLOW, { seconds: params?.seconds ?? 5, magnitude: 0.4, sourceId: 'CARD-010' });
        continue;
      }
      enemy.status?.apply(STATUS.CHARMED, { seconds: params?.seconds ?? 5, sourceId: 'CARD-010' });
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_ALL_HANDS' });
  },
});

defineHook('REVEAL_BOSS_AND_MINIBOSSES', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-011 Performance Review: shows every fight that matters on this floor.',
  fn: (ctx) => {
    const floor = ctx.run?.floor;
    if (!floor) return;
    for (const node of floor.nodes.values()) {
      if (node.hidden) continue;
      if (node.bossId || node.miniBoss) { node.mapRevealed = true; node.categoryRevealed = true; }
    }
  },
});

defineHook('GRANT_FLIGHT', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-012 Remote Day: over the floor and the furniture, for this room.',
  fn: (ctx) => {
    const player = ctx.player;
    if (!player) return;
    // Flight clears floor hazards and furniture only. Walls still stop you, or the
    // card would be a room-skip rather than a movement upgrade.
    player.flying = true;
    player.flyingRoomScoped = true;
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_FLIGHT' });
  },
});

defineHook('REVEAL_BOSS_ROUTE_AND_HASTE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-013 Hard Deadline: the shortest way there, and speed to take it.',
  fn: (ctx, params) => {
    const floor = ctx.run?.floor;
    const player = ctx.player;
    if (!floor || !player) return;
    const path = ctx.run?.shortestPathTo?.(floor.bossNodeId) || [];
    for (const nodeId of path) {
      const node = floor.nodes.get(nodeId);
      if (node && !node.hidden) node.routeHighlighted = true;
    }
    // The haste lasts "until the player enters it" (C.4), so it is a reward for
    // actually committing to the deadline rather than a free floor-long buff.
    player.status?.apply(STATUS.HASTE, {
      seconds: 999,
      untilNodeId: floor.bossNodeId,
      magnitude: params?.magnitude ?? 0.3,
      sourceId: 'CARD-013',
    });
  },
});

defineHook('REFLECT_PROJECTILES', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-014 Return to Sender: three seconds of everything going back.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.reflectSeconds = Math.max(player.reflectSeconds ?? 0, params?.seconds ?? 3);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_REFLECT' });
  },
});

defineHook('SPAWN_OPTIONAL_MINIBOSS', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'CARD-015 Escalation: an optional fight for a real reward.',
  fn: (ctx, params) => {
    const room = ctx.room;
    if (!room) return;
    // The card data also declares NOT_IN_BOSS_ROOM, and the usage layer enforces it.
    // The guard is repeated here because a hook must be safe to call directly (GDD
    // 9.6 makes this restriction normative, not advisory).
    if (room.node?.bossId) return;
    const bossId = ctx.spawnMiniBoss?.({ pool: params?.pool ?? 'MINIBOSS_STANDARD' });
    if (!bossId) return;
    room.pendingEscalationReward = params?.reward ?? 'PREMIUM';
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_ESCALATION' });
  },
});

defineHook('REPEAT_LAST_CARD', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-016 Meeting Minutes: does whatever the last card did.',
  fn: (ctx, hookParams) => {
    const last = ctx.run?.lastCardUsed;
    // C.4 excludes itself explicitly, which is the only thing standing between this
    // card and an infinite loop.
    if (!last || last.id === 'CARD-016') return;
    ctx.invokeHook?.(last.effectHook, { ...last.params, ...(hookParams?.override || {}) });
  },
});

defineHook('TELEPORT_TO_CLEARED_ROOM', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'CARD-017 Desk Move: somewhere you have already been.',
  fn: (ctx) => {
    const floor = ctx.run?.floor;
    if (!floor) return;
    // Cleared NORMAL rooms only: teleporting into an uncleared room would skip a
    // fight, and into a special room would skip its cost.
    const candidates = [...floor.nodes.values()]
      .filter((n) => n.cleared && !n.hidden && n.role === 'ROOM-002' && n.id !== ctx.room?.nodeId);
    if (!candidates.length) return;
    ctx.teleportTo?.(ctx.rng.pick(candidates).id);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_TELEPORT' });
  },
});

defineHook('START_WAVE_CHALLENGE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'CARD-018 Quarter-End: turns this room into a timed challenge.',
  fn: (ctx, params) => {
    const room = ctx.room;
    if (!room || room.node?.bossId) return;
    ctx.startWaveChallenge?.({
      room,
      waves: params?.waves ?? 3,
      seconds: params?.seconds ?? 90,
      reward: params?.reward ?? 'PREMIUM',
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-CARD_QUARTER_END' });
  },
});
