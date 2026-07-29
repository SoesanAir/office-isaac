/**
 * World effect hooks: what happens when environmental objects break or are used.
 *
 * GDD refs: 13.1 (the office-rock principle: the player should never be certain
 *           whether breaking an object yields nothing, a resource, a hazard, or a
 *           hostile surprise), 13.3 (per-object destruction behaviour), 13.4
 *           (hidden contents), R-ENV-003 (object contents use object-scoped RNG),
 *           R-ECO-004 (a destroyed object rolls from its OWN scoped loot table; the
 *           room-clear and pedestal pools are unreachable from here, which is why these
 *           hooks take a hazard or pickup kind rather than a pool id),
 *           R-ENV-004 (no required door, blast point, pickup, or spawn is
 *           permanently blocked), R-ENV-006 (chain reactions use bounded
 *           propagation), 9.2 (pickups), 22.5 (no switch statements on content).
 *
 * Every hook here is reusable by *any* object that declares it. ENV-002 Water Cooler
 * and a future burst pipe both call SPAWN_WATER_SPILL, and neither the hook nor the
 * combat system knows which object invoked it. That is what keeps R-GOV-003 true:
 * adding an object is a data change.
 *
 * Context contract for ON_OBJECT_BREAK and ON_USE:
 *   ctx.run, ctx.room, ctx.object, ctx.objectDef, ctx.player, ctx.events, ctx.rng
 * `ctx.rng` is always an OBJECT_CONTENT stream scoped to the object instance, so
 * breaking furniture can never shift a pedestal or boss roll (R-ENV-003).
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { EVENTS } from '../../core/events.js';

/**
 * Chain-reaction depth ceiling. R-ENV-006 requires bounded propagation: a water
 * spill touching a power strip touching another spill must terminate, and it should
 * terminate at a depth a player can actually reason about rather than at some
 * arbitrary large number.
 */
const MAX_CHAIN_DEPTH = 4;

// ---------------------------------------------------------------------------
// Helpers. The only way hooks touch the room, so the mutation surface stays small.
// ---------------------------------------------------------------------------

/**
 * Add a hazard patch to the room.
 *
 * Same-family hazards within half a unit merge rather than stacking, because GDD
 * 18.5 asks for effect aggregation and forty overlapping spill decals is both
 * unreadable and a performance problem.
 */
function spawnHazard(ctx, hazardId, { x, y, w = 2, h = 2, seconds = 0, depth = 0 } = {}) {
  if (depth > MAX_CHAIN_DEPTH) return null;
  const room = ctx.room;
  if (!room) return null;
  const def = ctx.run?.registry?.get('hazard', hazardId);
  // A missing hazard id is a content bug the validator catches; at runtime the
  // safest action is to do nothing visible rather than throw mid-combat.
  if (!def) return null;

  const existing = room.hazards.find(
    (h) => h.defId === hazardId && Math.hypot(h.x + h.w / 2 - x, h.y + h.h / 2 - y) < 0.5,
  );
  if (existing) {
    existing.w = Math.max(existing.w, w);
    existing.h = Math.max(existing.h, h);
    if (seconds > 0) existing.expiresIn = Math.max(existing.expiresIn ?? 0, seconds);
    return existing;
  }

  const hazard = {
    id: `${room.nodeId}-hazdyn${room.hazards.length}`,
    defId: hazardId,
    x: x - w / 2,
    y: y - h / 2,
    w,
    h,
    active: true,
    phase: 0,
    disabled: false,
    chainDepth: depth,
    ...(seconds > 0 ? { expiresIn: seconds } : {}),
  };
  room.hazards.push(hazard);
  ctx.events?.emit(EVENTS.HAZARD_TRIGGERED, { hazardId, x, y, source: ctx.object?.id });
  return hazard;
}

/** Queue a pickup drop. The loot service resolves the actual contents. */
function spawnPickup(ctx, kind, count = 1) {
  const room = ctx.room;
  if (!room) return;
  const obj = ctx.object;
  for (let i = 0; i < count; i += 1) {
    room.pickups.push({
      id: `${room.nodeId}-pk${room.pickups.length}`,
      kind,
      // Scatter slightly so a multi-drop is countable at a glance.
      x: (obj?.x ?? room.centre.x) + ctx.rng.float(-0.6, 0.6),
      y: (obj?.y ?? room.centre.y) + ctx.rng.float(-0.6, 0.6),
      collected: false,
    });
  }
}

/** Push entities away from a point. Used by foam, blasts, and HVAC bursts. */
function pushEntities(ctx, x, y, radius, force) {
  const targets = [ctx.player, ...(ctx.hostiles || [])].filter(Boolean);
  for (const t of targets) {
    const dx = t.x - x;
    const dy = t.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > radius || dist < 1e-4) continue;
    // Linear falloff: readable, and it cannot fling anything across the room.
    const scale = (1 - dist / radius) * force;
    t.velocity.x += (dx / dist) * scale;
    t.velocity.y += (dy / dist) * scale;
  }
}

/** Remove hazards in a radius. The Fire Extinguisher's whole reason to exist. */
function eraseHazards(ctx, x, y, radius, families) {
  const room = ctx.room;
  if (!room) return 0;
  const before = room.hazards.length;
  room.hazards = room.hazards.filter((h) => {
    const def = ctx.run?.registry?.get('hazard', h.defId);
    if (families && def && !families.includes(def.family)) return true;
    const cx = h.x + h.w / 2;
    const cy = h.y + h.h / 2;
    return Math.hypot(cx - x, cy - y) > radius;
  });
  return before - room.hazards.length;
}

/** Live objects within a radius, for chain reactions. */
function objectsNear(ctx, x, y, radius) {
  return (ctx.room?.objects || []).filter(
    (o) => !o.destroyed && o.id !== ctx.object?.id && Math.hypot(o.x - x, o.y - y) <= radius,
  );
}

const at = (ctx) => ({
  x: ctx.object?.x ?? ctx.room?.centre.x ?? 0,
  y: ctx.object?.y ?? ctx.room?.centre.y ?? 0,
});

// ---------------------------------------------------------------------------
// Destruction hooks (ON_OBJECT_BREAK)
// ---------------------------------------------------------------------------

defineHook('SPAWN_DEBRIS_BURST', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Purely cosmetic debris. The default break effect for solid furniture.',
  fn: (ctx, params) => {
    ctx.events?.emit(EVENTS.SFX_REQUESTED, {
      sound: params?.heavy ? 'SFX-OBJECT_BREAK_HEAVY' : 'SFX-OBJECT_BREAK_LIGHT',
    });
  },
});

defineHook('SPAWN_PAPER_SCATTER', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Scatters loose paper decals. Decoration only, never collision.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    const count = params?.count ?? 6;
    for (let i = 0; i < count; i += 1) {
      ctx.room?.decorations.push({
        set: 'PAPER_OVERFLOW',
        x: x + ctx.rng.float(-1.4, 1.4),
        y: y + ctx.rng.float(-1.0, 1.0),
        variant: ctx.rng.int(0, 3),
      });
    }
  },
});

defineHook('LAUNCH_PAPER_DEBRIS', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Paper burst that can trigger adjacent reactive objects (ENV-004).',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    // GDD ENV-004 says a bin "sometimes launches paper debris that can trigger
    // nearby objects". Depth-limited so a row of bins cannot cascade for ever.
    const depth = (ctx.object?.chainDepth ?? 0) + 1;
    if (depth > MAX_CHAIN_DEPTH) return;
    for (const other of objectsNear(ctx, x, y, params?.radius ?? 1.8)) {
      const def = ctx.run?.registry?.get('envObject', other.defId);
      if (def?.objectClass !== 'REACTIVE') continue;
      other.chainDepth = depth;
      ctx.events?.emit(EVENTS.OBJECT_DESTROYED, { objectId: other.id, cause: 'CHAIN', depth });
    }
  },
});

defineHook('SPAWN_WATER_SPILL', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Water slick. Slippery, and conducts shock when it meets a live cable.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    const hazard = spawnHazard(ctx, params?.hazard ?? 'HAZ-SPILL_WATER_SLICK', {
      x, y, w: params?.w ?? 3, h: params?.h ?? 3,
      depth: (ctx.object?.chainDepth ?? 0) + 1,
    });
    if (!hazard) return;
    // Water plus power is the GDD's named interaction (ENV-002 / ENV-019). Flagging
    // the puddle rather than immediately electrifying it keeps the danger legible:
    // the player sees water, then sees it energise.
    const live = objectsNear(ctx, x, y, 2.5).some((o) => {
      const def = ctx.run?.registry?.get('envObject', o.defId);
      return def?.chainReaction?.propagates?.includes('SHOCK');
    });
    if (live) hazard.energised = true;
  },
});

defineHook('SPILL_HOT_COFFEE', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Scalding coffee: brief damage, then it cools into a harmless stain.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    spawnHazard(ctx, params?.hazard ?? 'HAZ-SPILL_COFFEE_SCALD', {
      x, y, w: 2.5, h: 2.5, seconds: params?.seconds ?? 6,
      depth: (ctx.object?.chainDepth ?? 0) + 1,
    });
  },
});

defineHook('SPAWN_TONER_CLOUD', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Lingering toner dust that obscures nothing but stings on contact.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    spawnHazard(ctx, params?.hazard ?? 'HAZ-MACHINE_TONER_CLOUD', {
      x, y, w: params?.w ?? 3.5, h: params?.h ?? 3.5, seconds: params?.seconds ?? 8,
      depth: (ctx.object?.chainDepth ?? 0) + 1,
    });
  },
});

defineHook('SPAWN_GLASS_SHARDS', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Shard field. Brief, sharply outlined, and gone before it feels unfair.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    spawnHazard(ctx, params?.hazard ?? 'HAZ-GLASS_SHARD_FIELD', {
      x, y, w: params?.w ?? 3, h: params?.h ?? 2,
      // ENV-012 calls this "a brief floor hazard". A permanent one beside a door
      // would be unavoidable damage, which GDD 2.10 classifies as a bug.
      seconds: params?.seconds ?? 5,
      depth: (ctx.object?.chainDepth ?? 0) + 1,
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-GLASS_SHATTER' });
  },
});

defineHook('SCATTER_SOIL_PATCH', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Plant soil. Decorative: the GDD says office plants are usually empty.',
  fn: (ctx) => {
    const { x, y } = at(ctx);
    ctx.room?.decorations.push({ set: 'GENERIC', x, y, variant: 0 });
  },
});

defineHook('COLLAPSE_DIRECTIONAL', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Tall shelf falls in one cardinal direction, changing navigation (ENV-013).',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    const room = ctx.room;
    if (!room) return;
    const named = { EAST: [1, 0], WEST: [-1, 0], SOUTH: [0, 1], NORTH: [0, -1] };
    const options = params?.directions
      ? params.directions.map((d) => named[d]).filter(Boolean)
      : Object.values(named);
    const [dx, dy] = ctx.rng.pick(options) || [1, 0];
    const length = params?.length ?? 3;
    const fallen = {
      id: `${room.nodeId}-collapse${room.objects.length}`,
      defId: ctx.object.defId,
      variantId: 'COLLAPSED',
      x: x + (dx * length) / 2,
      y: y + (dy * length) / 2,
      w: dx !== 0 ? length : 1,
      h: dy !== 0 ? length : 1,
      blocksMovement: true,
      blocksProjectiles: false,
      blocksFlying: false,
      blocksLineOfSight: false,
      health: 0,
      maxHealth: 0,
      requiresBlast: false,
      destroyed: false,
      collapsed: true,
    };
    // R-ENV-004: a collapse must never seal a door. If the debris would land badly,
    // the shelf just breaks apart instead of falling.
    const blocksDoor = [...room.doorWorldPositions.values()].some(
      (d) => Math.abs(d.x - fallen.x) < 2 && Math.abs(d.y - fallen.y) < 2,
    );
    if (blocksDoor) {
      ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-OBJECT_BREAK_HEAVY' });
      return;
    }
    room.objects.push(fallen);
    room.collision.addObject(fallen);
  },
});

defineHook('RELEASE_MARKER_HAZARD', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'A broken whiteboard sprays marker ink into a small slowing patch.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    spawnHazard(ctx, params?.hazard ?? 'HAZ-SPILL_DRY_STAIN', {
      x, y, w: 2, h: 2, seconds: params?.seconds ?? 7,
      depth: (ctx.object?.chainDepth ?? 0) + 1,
    });
  },
});

defineHook('REVEAL_WHITEBOARD_CLUE', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Shows a clue phrase. ENV-014: never required for normal progression.',
  fn: (ctx, params) => {
    ctx.events?.emit(EVENTS.BANNER_REQUESTED, {
      titleLoc: params?.clueLoc ?? 'clue.whiteboard.generic',
      priority: 10,
    });
    ctx.events?.emit(EVENTS.DISCOVERY_RECORDED, { kind: 'WHITEBOARD_CLUE', id: params?.clueId });
  },
});

defineHook('EXPLODE_FOAM_CONE', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Fire extinguisher bursts: pushes entities and erases fire (ENV-016).',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    const radius = params?.radius ?? 3.5;
    pushEntities(ctx, x, y, radius, params?.force ?? 9);
    eraseHazards(ctx, x, y, radius, ['FIRE', 'SPILLS']);
    spawnHazard(ctx, params?.hazard ?? 'HAZ-FOAM_DISCHARGE_CLOUD', {
      x, y, w: radius, h: radius, seconds: params?.seconds ?? 4,
      depth: (ctx.object?.chainDepth ?? 0) + 1,
    });
  },
});

defineHook('ERASE_HAZARDS_IN_RADIUS', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Clears nearby hazards. Generous on purpose, so it reads as a solution.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    eraseHazards(ctx, x, y, params?.radius ?? 3, params?.families);
  },
});

defineHook('DROP_CART_CONTENTS', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Supply cart spills its contents as loose pickups (ENV-017).',
  fn: (ctx, params) => {
    spawnPickup(ctx, params?.kind ?? 'CREDIT', ctx.rng.int(params?.min ?? 2, params?.max ?? 4));
  },
});

defineHook('CUT_POWER_LINK', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Destroying a power strip disables the electrical hazards it fed.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    const radius = params?.radius ?? 5;
    let disabled = 0;
    for (const hazard of ctx.room?.hazards || []) {
      const def = ctx.run?.registry?.get('hazard', hazard.defId);
      if (!def || def.family !== 'ELECTRICITY') continue;
      const cx = hazard.x + hazard.w / 2;
      const cy = hazard.y + hazard.h / 2;
      if (Math.hypot(cx - x, cy - y) > radius) continue;
      // GDD 13.3 makes power strips a lever the player can pull, so this disable is
      // permanent rather than timed: the decision should stick.
      hazard.disabled = true;
      hazard.active = false;
      disabled += 1;
    }
    ctx.events?.emit(EVENTS.MACHINE_USED, { kind: 'POWER_CUT', disabled });
  },
});

defineHook('SPAWN_SHOCK_ARC', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'A short-lived arc. Energises water it touches, once.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    const depth = (ctx.object?.chainDepth ?? 0) + 1;
    spawnHazard(ctx, params?.hazard ?? 'HAZ-ELEC_FLOOR_ARC', {
      x, y, w: 2, h: 2, seconds: params?.seconds ?? 3, depth,
    });
    if (depth > MAX_CHAIN_DEPTH) return;
    // Energise touching water instead of spawning more arcs: propagation stays
    // bounded and the visual stays one hazard per puddle (R-ENV-006).
    for (const hazard of ctx.room?.hazards || []) {
      const def = ctx.run?.registry?.get('hazard', hazard.defId);
      if (def?.family !== 'SPILLS') continue;
      const cx = hazard.x + hazard.w / 2;
      const cy = hazard.y + hazard.h / 2;
      if (Math.hypot(cx - x, cy - y) > 3.5) continue;
      hazard.energised = true;
      hazard.chainDepth = depth;
    }
  },
});

defineHook('TRIGGER_SECURITY_ALARM', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Trophy case alarm. Greed has a price (ENV-020).',
  fn: (ctx, params) => {
    ctx.events?.emit(EVENTS.HAZARD_TRIGGERED, {
      kind: 'SECURITY_ALARM',
      respondWith: params?.enemy ?? 'ENM-041',
      delay: params?.delay ?? 1.5,
    });
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-MACHINE_FAIL' });
  },
});

defineHook('IGNITE_PAPER_FIRE', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Paper pile catches. Burns out on a timer so it cannot trap the player.',
  fn: (ctx, params) => {
    const { x, y } = at(ctx);
    spawnHazard(ctx, params?.hazard ?? 'HAZ-FIRE_PAPER_BLAZE', {
      x, y, w: params?.w ?? 2.5, h: params?.h ?? 2.5,
      seconds: params?.seconds ?? 6,
      depth: (ctx.object?.chainDepth ?? 0) + 1,
    });
  },
});

// ---------------------------------------------------------------------------
// Interaction hooks (ON_USE)
// ---------------------------------------------------------------------------

defineHook('VEND_WEIGHTED_SNACK', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'Vending machine. Can pay out, jam, or break (ENV-005).',
  fn: (ctx, params) => {
    const outcomes = params?.outcomes || [
      { kind: 'HEALTH', weight: 45 },
      { kind: 'SUPPLEMENT', weight: 20 },
      { kind: 'CREDIT', weight: 20 },
      { kind: 'FAIL', weight: 15 },
    ];
    const picked = ctx.rng.pickWeighted(outcomes, (o) => o.weight);
    if (!picked || picked.kind === 'FAIL') {
      ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-MACHINE_FAIL' });
      // GDD 13.3 lets machines jam. Marking the instance means the player learns
      // not to keep feeding it, which is the interesting outcome.
      if (ctx.object) ctx.object.jammed = true;
      return;
    }
    spawnPickup(ctx, picked.kind, picked.count ?? 1);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-MACHINE_VEND' });
  },
});

defineHook('BREW_CAFFEINE_DOSE', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'Coffee machine: trades credits for Caffeine buffer health (ENV-015).',
  fn: (ctx, params) => {
    // Overheating is the interesting failure: it turns a safe recovery spot into a
    // hazard, which is exactly the GDD 13.1 uncertainty this system wants.
    if (ctx.rng.chance(params?.overheatChance ?? 0.12)) {
      const { x, y } = at(ctx);
      spawnHazard(ctx, 'HAZ-SPILL_COFFEE_SCALD', { x, y, w: 2, h: 2, seconds: 5 });
      ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-MACHINE_FAIL' });
      if (ctx.object) ctx.object.jammed = true;
      return;
    }
    spawnPickup(ctx, 'CAFFEINE', params?.count ?? 1);
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-MACHINE_VEND' });
  },
});

defineHook('UNLOCK_CABINET', {
  timing: HOOK_TIMING.ON_USE,
  usesRng: true,
  note: 'Locked cabinet: repays the Access Card with a guaranteed reward (ENV-018).',
  fn: (ctx, params) => {
    // A locked container that could roll "nothing" would make spending a scarce
    // Access Card feel like a scam, so the guaranteed portion is paid first and the
    // loot table rolls a bonus on top of it.
    for (const reward of params?.guaranteedRewards || [{ kind: 'CREDIT', count: 3 }]) {
      spawnPickup(ctx, reward.kind, reward.count ?? 1);
    }
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-PICKUP_GENERIC' });
    if (ctx.object) ctx.object.opened = true;
  },
});

defineHook('TOGGLE_POWER_STRIP', {
  timing: HOOK_TIMING.ON_USE,
  note: 'Switch a power strip on or off, changing linked hazard state (ENV-019).',
  fn: (ctx, params) => {
    const obj = ctx.object;
    if (!obj) return;
    obj.powered = !(obj.powered ?? true);
    const { x, y } = at(ctx);
    const radius = params?.radius ?? 5;
    for (const hazard of ctx.room?.hazards || []) {
      const def = ctx.run?.registry?.get('hazard', hazard.defId);
      if (!def || def.family !== 'ELECTRICITY') continue;
      const cx = hazard.x + hazard.w / 2;
      const cy = hazard.y + hazard.h / 2;
      if (Math.hypot(cx - x, cy - y) > radius) continue;
      hazard.disabled = !obj.powered;
      hazard.active = obj.powered && def.cycle.mode === 'ALWAYS_ON';
    }
    ctx.events?.emit(EVENTS.MACHINE_USED, { kind: 'POWER_TOGGLE', powered: obj.powered });
  },
});

// ---------------------------------------------------------------------------
// Hooks referenced from loot payloads and variant overrides
// ---------------------------------------------------------------------------

defineHook('SPAWN_DISGUISED_ENEMY', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'The hostile-surprise band of GDD 13.4. Never fires in a cleared room.',
  fn: (ctx, params) => {
    // A hostile appearing after a clear would re-lock doors and break the clear
    // contract in GDD 6.1, so this is refused outright.
    if (ctx.room?.state.cleared) return;
    ctx.events?.emit(EVENTS.HAZARD_TRIGGERED, {
      kind: 'SPAWN_ENEMY',
      enemy: params?.enemy ?? 'ENM-001',
      x: ctx.object?.x,
      y: ctx.object?.y,
      telegraphSeconds: params?.telegraph ?? 0.5,
    });
  },
});

defineHook('RELEASE_BUG_SWARM', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Small swarm from a plant or paper pile. Low cost, high surprise.',
  fn: (ctx, params) => {
    if (ctx.room?.state.cleared) return;
    ctx.events?.emit(EVENTS.HAZARD_TRIGGERED, {
      kind: 'SPAWN_ENEMY',
      enemy: params?.enemy ?? 'ENM-028',
      count: params?.count ?? 3,
      x: ctx.object?.x,
      y: ctx.object?.y,
      telegraphSeconds: params?.telegraph ?? 0.4,
    });
  },
});

defineHook('SPAWN_PRINTER_BEAST', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'ENV-003 can release a Printer Beast instead of loot.',
  fn: (ctx, params) => {
    if (ctx.room?.state.cleared) return;
    ctx.events?.emit(EVENTS.HAZARD_TRIGGERED, {
      kind: 'SPAWN_ENEMY',
      enemy: params?.enemy ?? 'ENM-014',
      x: ctx.object?.x,
      y: ctx.object?.y,
      telegraphSeconds: params?.telegraph ?? 0.7,
    });
  },
});

defineHook('SUMMON_SECURITY_RESPONSE', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Alarm response wave: the priced consequence of a premium container.',
  fn: (ctx, params) => {
    if (ctx.room?.state.cleared) return;
    ctx.events?.emit(EVENTS.HAZARD_TRIGGERED, {
      kind: 'SPAWN_ENEMY',
      enemy: params?.enemy ?? 'ENM-041',
      count: params?.count ?? 2,
      telegraphSeconds: params?.telegraph ?? 1.2,
    });
  },
});

defineHook('JAM_MACHINE', {
  timing: HOOK_TIMING.ON_USE,
  note: 'Marks a machine unusable for the rest of the floor.',
  fn: (ctx) => {
    if (ctx.object) ctx.object.jammed = true;
    ctx.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-MACHINE_FAIL' });
  },
});

defineHook('REVEAL_HIDDEN_PASSAGE', {
  timing: HOOK_TIMING.ON_OBJECT_BREAK,
  note: 'Very rare: a machine hides a secret door (ENV-005).',
  fn: (ctx) => {
    // Delegated to the Run so the reveal takes exactly the same code path as a
    // Toner Charge blast, including the R-AUD-004 confirmation sting.
    const secret = (ctx.room?.node?.doors || []).find(
      (d) => d.doorClass === 'BLAST_SECRET' && !d.discovered,
    );
    if (secret) ctx.run?.revealSecret(secret.edgeId);
  },
});

export { MAX_CHAIN_DEPTH, spawnHazard, spawnPickup, pushEntities, eraseHazards };
