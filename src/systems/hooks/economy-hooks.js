/**
 * Economy, access, and loot-influence hooks.
 *
 * GDD refs: 9.2 (pickups and counters), 9.3 (credit economy and the shop price bands),
 *           Appendix C.2 (per-item magnitudes), R-ECO-001 (counters are visible
 *           integers), R-ECO-005 (resource-starvation protection must be subtle and
 *           data-defined, and must not alter item quality or raise a message),
 *           R-ITM-008 (loot selection has no current-power penalty), 8.4 (rerolls use
 *           the original pool and cannot return the item on display).
 *
 * The constraint that shapes this file is R-ITM-008. A hook here may reweight a *pool*
 * or waive a *cost*, but nothing may consult how well the run is going. `PICKUP_WEIGHT_BIAS`
 * biases toward a category the item names; it never asks whether the player is winning.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { EVENTS } from '../../core/events.js';

defineHook('FREE_DOOR_PER_FLOOR', {
  timing: HOOK_TIMING.ON_DOOR_COST,
  note: 'ITM-040 Visitor Badge: the first standard badge door each floor is free.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player || ctx.cost?.accessCards !== 1) return;
    // Appendix C.2: does NOT open double-card, executive, or secret locks. Restricting
    // to a single-card cost is what enforces that without naming door classes here.
    if (player.floorFlags.get('visitorBadgeUsed')) return;
    player.floorFlags.set('visitorBadgeUsed', true);
    ctx.waived = true;
    ctx.events?.emit(EVENTS.DOOR_UNLOCKED, { free: true, by: params?.itemId ?? 'ITM-040' });
    return false; // cancels the charge
  },
});

defineHook('FREE_DOOR_ALWAYS', {
  timing: HOOK_TIMING.ON_DOOR_COST,
  note: 'ITM-041 Master Access Badge: single-card doors cost nothing for the run.',
  fn: (ctx) => {
    // Appendix C.2: still does not open manager seals, hidden walls, or story locks —
    // again enforced by only matching a one-card cost.
    if (ctx.cost?.accessCards !== 1) return;
    ctx.waived = true;
    return false;
  },
});

defineHook('RETAIN_SPENT_CARD', {
  timing: HOOK_TIMING.ON_DOOR_COST,
  usesRng: true,
  note: 'CHR-002 Bent Keycard: a spent Access Card may be kept.',
  fn: (ctx, params) => {
    if (!ctx.rng || !ctx.player) return;
    if (!(ctx.cost?.accessCards > 0)) return;
    if (!ctx.rng.chance(params.chance ?? 0.12)) return;
    // Refunded rather than waived, so the door still visibly consumes a card and the
    // charm reads as luck rather than as a permanent discount.
    ctx.refundAccessCards = (ctx.refundAccessCards ?? 0) + ctx.cost.accessCards;
  },
});

defineHook('CREDIT_DEBT_LINE', {
  timing: HOOK_TIMING.ON_PURCHASE,
  note: 'ITM-059 Corporate Card: purchases may run a temporary debt balance.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    // Appendix C.2: up to 15 credits of debt, and future pickups pay it first. Debt
    // does not persist between runs, which is why it lives on the player rather than
    // in the profile save.
    player.debtLimit = Math.max(player.debtLimit ?? 0, params.limit ?? 15);
  },
});

defineHook('PICKUP_WEIGHT_BIAS', {
  timing: HOOK_TIMING.ON_LOOT_ROLL,
  note: 'Biases a pickup category. ITM-037 Mini Fridge, CHR-015 Paper Star.',
  fn: (ctx, params) => {
    // Reweights the table the loot service already owns rather than adding a term to
    // the roll, so the table stays the single description of what can drop.
    if (!ctx.weights) return;
    for (const kind of params.kinds || []) {
      if (ctx.weights[kind] !== undefined) ctx.weights[kind] *= params.multiplier ?? 1.5;
    }
  },
});

defineHook('STORE_EXCESS_HEAL', {
  timing: HOOK_TIMING.ON_PICKUP,
  note: 'ITM-037 Mini Fridge: keeps one excess half-heal for the next floor start.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    if (ctx.kind !== 'COMPOSURE') return;
    // Only fires when the heal would have been wasted, and stores at most one
    // half-unit (Appendix C.2: "Cannot store more than one half-unit").
    if (player.health.composure < player.health.composureMax) return;
    const stored = player.runFlags?.get?.('fridgeStored') ?? 0;
    if (stored >= (params.max ?? 1)) return;
    player.runFlags?.set?.('fridgeStored', stored + 1);
    ctx.consumed = true;
  },
});

defineHook('SPAWN_PICKUP_ON_FLOOR_START', {
  timing: HOOK_TIMING.ON_FLOOR_START,
  note: 'ITM-038 Lunchbox: one weighted pickup in each new start room.',
  fn: (ctx, params) => {
    // Appendix C.2: can spawn credits, cards, toner, or health — never a pedestal item.
    // The exclusion is the balance, so the kind list is fixed here rather than deferred
    // to a pool that might later gain items.
    const kinds = params.kinds || ['CREDIT', 'ACCESS_CARD', 'TONER_CHARGE', 'COMPOSURE'];
    const kind = ctx.rng ? ctx.rng.pick(kinds) : kinds[0];
    ctx.spawnPickup?.(kind, 1);
  },
});

defineHook('REROLL_LEFT_PEDESTAL', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  note: 'ITM-060 Suggestion Box: rerolls the first pedestal left behind each floor.',
  fn: (ctx, params) => {
    const room = ctx.room;
    const player = ctx.player;
    if (!room?.pedestal || room.pedestal.taken || !player) return;
    if (player.floorFlags.get('suggestionBoxUsed')) return;
    // Only on RE-entry: the item rerolls something the player already declined, which
    // means the room must have been visited and left (Appendix C.2).
    if (!room.state.rerollEligible) {
      room.state.rerollEligible = true;
      return;
    }
    player.floorFlags.set('suggestionBoxUsed', true);
    const rolled = ctx.loot?.rerollItem({
      poolId: params.poolId ?? ctx.poolId,
      depth: ctx.depth,
      sourceKey: room.nodeId,
      currentId: room.pedestal.id,
    });
    // GDD 8.4: a reroll cannot return the exact item on display, which rerollItem
    // enforces by excluding it. A null result means the pool had nothing else, and
    // leaving the original is the honest outcome.
    if (rolled) Object.assign(room.pedestal, rolled);
  },
});

defineHook('REVEAL_ROOM_CATEGORY', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  note: 'ITM-046 Webcam: reveals adjacent room categories, but never secrets.',
  fn: (ctx) => {
    const room = ctx.room;
    const floor = ctx.run?.floor;
    if (!room || !floor) return;
    for (const door of room.doors) {
      const node = floor.nodes.get(door.toNodeId);
      // R-FLR-010 / Appendix C.2: secret rooms stay hidden. Revealing them would
      // remove the discovery this whole system exists to protect.
      if (!node || node.hidden) continue;
      node.categoryRevealed = true;
    }
  },
});

defineHook('REVEAL_BOSS_ROOM', {
  timing: HOOK_TIMING.ON_FLOOR_START,
  note: 'ITM-048 Calendar Reminder: reveals the boss room and elevator direction.',
  fn: (ctx) => {
    const floor = ctx.run?.floor;
    if (!floor) return;
    const boss = floor.nodes.get(floor.bossNodeId);
    // Appendix C.2: reveals the icon, NOT the path between rooms — the player still
    // has to find their way there.
    if (boss) boss.categoryRevealed = true;
  },
});

defineHook('ORBITAL_FAMILIAR', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  note: 'ITM-029 Lucky Paperclip: an orbiting blocker that reforms after N clears.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    // Capped at three orbitals (Appendix C.2), so stacking is useful but bounded.
    const want = Math.min(params.max ?? 3, params.count ?? 1);
    player.orbitals = player.orbitals ?? [];
    while (player.orbitals.length < want) {
      player.orbitals.push({ angle: player.orbitals.length * 2.1, blocked: false, reformIn: 0 });
    }
  },
});

defineHook('SHOOTING_FAMILIAR', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  note: 'ITM-045 Company Laptop and ITM-056 Sticky Notes: a familiar that fires.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.familiars = player.familiars ?? [];
    if (player.familiars.some((f) => f.id === params.id)) return;
    player.familiars.push({
      id: params.id,
      kind: params.kind ?? 'SHOOTER',
      intervalSeconds: params.intervalSeconds ?? 0.9,
      damageScale: params.damageScale ?? 0.4,
      count: params.count ?? 1,
      timer: 0,
      // Appendix C.2 (ITM-045): inherits trajectory modifiers but NOT multiplicity by
      // default, so a familiar cannot multiply an already-multiplied pattern.
      inheritsTrajectory: params.inheritsTrajectory !== false,
      inheritsMultiplicity: Boolean(params.inheritsMultiplicity),
    });
  },
});
