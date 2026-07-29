/**
 * Boss attack patterns and movement rules.
 *
 * GDD refs: 15.3 (the boss combat contract), 15.4 (the phase template: a phase is a
 *           weighted set of patterns plus a movement rule), Appendix E (all 29 core
 *           fights), R-BSS-003 (boss attacks use the same damage and telegraph rules
 *           as enemies — nothing here may invent an untagged damage source),
 *           R-BSS-004 (invulnerability is short, purposeful, and visually explicit),
 *           R-BSS-006 (moving-wall and zone phases always leave a safe route),
 *           20.3 (behaviour is composed from curated modules; runtime AI generation is
 *           prohibited), 22.5 (no switch statements on content).
 *
 * This is the closed vocabulary boss data draws from. `phase.patternWeights[].pattern`
 * and `phase.movementRule` must both name something registered here, and
 * `findMissingBossPatterns` is the validation seam that proves it.
 *
 * ## The constraint that shaped the vocabulary
 *
 * Appendix E's roster is emphatic that these are twenty-nine *different fights*. But it
 * is equally emphatic that three of them are built by quoting the others: BSS-013 VP of
 * Everything "cycles through diluted versions of earlier department mechanics", BSS-027
 * Parent Company "reconstructs sanitized versions of earlier bosses", and BSS-029 The
 * Beneficial Owner "echoes selected mechanics from the current run".
 *
 * Those three are impossible to hand-author and trivial to express as data — but only if
 * the patterns are genuinely reusable. So the vocabulary is deliberately mechanical
 * (`RADIAL_BURST`, `SWEEPING_WALL`, `NODE_ACTIVATION`) and a boss's identity lives in
 * which patterns it weights, how it moves, and what its arena does. A pattern called
 * `TeamLeadBuzzwordRing` would have been unusable by the three bosses whose entire
 * concept is quoting other bosses.
 *
 * ## R-BSS-006 is enforced here, not in data
 *
 * Every pattern that places walls, zones, or seals routes its gap count through
 * `safeGaps()`, which cannot return zero. A boss cannot express "seal the arena" even by
 * mistake, because the pattern will not do it. Data cannot opt out.
 */

import { EVENTS } from '../core/events.js';
import { DAMAGE_TAG, STATUS } from '../core/constants.js';
import { normalizeInto, distance, TAU } from '../core/math.js';

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

const patterns = new Map();
const movementRules = new Map();

/**
 * Register a boss attack pattern.
 *
 * @param {string} id name used by `phase.patternWeights[].pattern`
 * @param {object} spec
 * @param {string} spec.note what it does, for the readability review
 * @param {number} spec.telegraphSeconds minimum wind-up; a phase may lengthen it
 * @param {boolean} [spec.reshapesArena] true if it places walls, zones, or seals
 * @param {(boss:object, ctx:object, params:object)=>void} spec.run
 */
export function registerBossPattern(id, spec) {
  if (patterns.has(id)) throw new Error(`Duplicate boss pattern "${id}".`);
  if (typeof spec.run !== 'function') throw new Error(`Boss pattern "${id}" has no run().`);
  // R-BSS-003: a boss attack obeys the same telegraph rules as an enemy attack, so a
  // pattern with no wind-up is a defect rather than a design choice.
  if (!(spec.telegraphSeconds > 0)) {
    throw new Error(`Boss pattern "${id}" must declare a positive telegraphSeconds (R-BSS-003).`);
  }
  patterns.set(id, Object.freeze({ id, ...spec }));
  return id;
}

/** Register a movement rule named by `phase.movementRule`. */
export function registerMovementRule(id, spec) {
  if (movementRules.has(id)) throw new Error(`Duplicate boss movement rule "${id}".`);
  movementRules.set(id, Object.freeze({ id, ...spec }));
  return id;
}

export const getBossPattern = (id) => patterns.get(id);
export const getMovementRule = (id) => movementRules.get(id);
export const allBossPatterns = () => [...patterns.values()];
export const allMovementRules = () => [...movementRules.values()];

/**
 * Validation seam: patterns and movement rules boss data names but nobody built.
 * Mirrors `findMissingBehaviours` so tools/validate-content.js treats both alike.
 */
export function findMissingBossPatterns(registry) {
  const missing = [];
  for (const boss of registry.all('boss')) {
    for (const phase of boss.phases || []) {
      for (const entry of phase.patternWeights || []) {
        if (!patterns.has(entry.pattern)) {
          missing.push({ id: boss.id, phase: phase.id, kind: 'pattern', name: entry.pattern });
        }
      }
      if (phase.movementRule && !movementRules.has(phase.movementRule)) {
        missing.push({ id: boss.id, phase: phase.id, kind: 'movementRule', name: phase.movementRule });
      }
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Reused vector scratch, so a 24-projectile pattern allocates nothing. */
const scratch = { x: 0, y: 0 };

/**
 * The minimum number of gaps any arena-reshaping pattern must leave.
 *
 * R-BSS-006: "Bosses preserve safe response routes during moving-wall and zone phases."
 * Clamping here rather than validating in data means a boss physically cannot seal an
 * arena, which is stronger than a rule someone has to remember.
 */
const MIN_SAFE_GAPS = 1;

const safeGaps = (params) => Math.max(MIN_SAFE_GAPS, params?.safeGapCount ?? MIN_SAFE_GAPS);

/** Fire one boss projectile. Every boss shot goes through here, so all are tagged. */
function shoot(boss, ctx, dx, dy, params) {
  normalizeInto(scratch, dx, dy);
  ctx.spawnEnemyProjectile(boss, {
    dx: scratch.x,
    dy: scratch.y,
    speed: params?.speed ?? 6.5,
    damage: params?.damage ?? 2,
    size: params?.size ?? 1,
    lifetime: params?.lifetime ?? 3,
    // R-BSS-003: tagged like any other projectile, so on-hit items, the combat log, and
    // Return to Sender all treat a boss shot as a projectile rather than a special case.
    tags: [DAMAGE_TAG.PROJECTILE],
    sourceId: boss.def?.id ?? 'boss',
    heavy: Boolean(params?.heavy),
    bossCritical: Boolean(params?.bossCritical),
  });
}

const aimAtPlayer = (boss, ctx) => ({ dx: ctx.player.x - boss.x, dy: ctx.player.y - boss.y });

// ---------------------------------------------------------------------------
// Projectile patterns
// ---------------------------------------------------------------------------

registerBossPattern('RADIAL_BURST', {
  note: 'Evenly spaced ring. BSS-001 radial notes, and the readable default opener.',
  telegraphSeconds: 0.8,
  run: (boss, ctx, params) => {
    const count = params?.count ?? 12;
    // Half-step rotation per volley, so successive rings never leave a permanently safe
    // lane the player can simply stand in.
    const offset = params?.rotateEachVolley === false
      ? 0
      : (boss.volleyIndex ?? 0) * (TAU / count / 2);
    for (let i = 0; i < count; i += 1) {
      const a = offset + (i / count) * TAU;
      shoot(boss, ctx, Math.cos(a), Math.sin(a), params);
    }
    boss.volleyIndex = (boss.volleyIndex ?? 0) + 1;
  },
});

registerBossPattern('AIMED_VOLLEY', {
  note: 'A short burst straight at the player. The honest baseline threat.',
  telegraphSeconds: 0.6,
  run: (boss, ctx, params) => {
    const { dx, dy } = aimAtPlayer(boss, ctx);
    const count = params?.count ?? 3;
    const spread = params?.spread ?? 0.18;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < count; i += 1) {
      const a = base + (i - (count - 1) / 2) * spread;
      shoot(boss, ctx, Math.cos(a), Math.sin(a), params);
    }
  },
});

registerBossPattern('SPIRAL_STREAM', {
  note: 'A continuous rotating arm. BSS-007 obsolete patterns, BSS-025 pattern families.',
  telegraphSeconds: 0.9,
  run: (boss, ctx, params) => {
    const arms = params?.arms ?? 2;
    boss.spiralAngle = (boss.spiralAngle ?? 0) + (params?.stepRadians ?? 0.35);
    for (let i = 0; i < arms; i += 1) {
      const a = boss.spiralAngle + (i / arms) * TAU;
      shoot(boss, ctx, Math.cos(a), Math.sin(a), params);
    }
  },
});

registerBossPattern('FAN_SWEEP', {
  note: 'A wide arc swept across the arena. BSS-002 paper fan.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    const count = params?.count ?? 9;
    const arc = params?.arcRadians ?? 1.4;
    const { dx, dy } = aimAtPlayer(boss, ctx);
    const base = Math.atan2(dy, dx) - arc / 2;
    for (let i = 0; i < count; i += 1) {
      const a = base + (i / Math.max(1, count - 1)) * arc;
      shoot(boss, ctx, Math.cos(a), Math.sin(a), params);
    }
  },
});

registerBossPattern('SHEET_WAVE', {
  note: 'A wide slow line of paper crossing the room. BSS-002 straight sheet wave.',
  telegraphSeconds: 1.2,
  run: (boss, ctx, params) => {
    // Modelled as a dense line of slow projectiles rather than a moving wall, because
    // the player must be able to destroy or slip between sheets. A solid wall would need
    // an R-BSS-006 gap; a permeable one is honest without needing the exception.
    const count = params?.count ?? 11;
    const { dx, dy } = aimAtPlayer(boss, ctx);
    normalizeInto(scratch, dx, dy);
    const dirX = scratch.x;
    const dirY = scratch.y;
    const px = -dirY;
    const py = dirX;
    const spacing = params?.spacing ?? 0.9;
    for (let i = 0; i < count; i += 1) {
      const t = (i - (count - 1) / 2) * spacing;
      ctx.spawnEnemyProjectile(boss, {
        x: boss.x + px * t,
        y: boss.y + py * t,
        dx: dirX,
        dy: dirY,
        speed: params?.speed ?? 3.4,
        damage: params?.damage ?? 2,
        size: params?.size ?? 1.4,
        lifetime: params?.lifetime ?? 4.5,
        tags: [DAMAGE_TAG.PROJECTILE],
        sourceId: boss.def?.id ?? 'boss',
      });
    }
  },
});

registerBossPattern('DELAYED_RULING', {
  note: 'Marked ground that resolves after a countdown. BSS-021 clauses, BSS-017 reconcile.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    const count = params?.count ?? 3;
    for (let i = 0; i < count; i += 1) {
      const at = ctx.room?.randomWalkablePoint?.(ctx.rng) || { x: boss.x, y: boss.y };
      // The countdown IS the telegraph, and it is visible. Appendix E lists "off-screen
      // attack without cue" as a failure condition, so the marker is placed now and
      // resolves later rather than resolving on placement.
      ctx.spawnDelayedBlast?.({
        x: at.x,
        y: at.y,
        radius: params?.radius ?? 2,
        delaySeconds: params?.delaySeconds ?? 1.6,
        damage: params?.damage ?? 2,
        tags: [DAMAGE_TAG.EXPLOSION],
        sourceId: boss.def?.id ?? 'boss',
      });
    }
  },
});

registerBossPattern('TARGETED_SLAM', {
  note: 'A telegraphed press onto a locked position. BSS-022 knots, BSS-003 dash.',
  telegraphSeconds: 0.9,
  run: (boss, ctx, params) => {
    // Sampled once at telegraph start, like enemy predictive attacks (R-ENM-007). A slam
    // that re-aimed during its wind-up would be unavoidable, which Appendix E lists as a
    // failure condition.
    const target = boss.lockedTarget ?? { x: ctx.player.x, y: ctx.player.y };
    ctx.spawnDelayedBlast?.({
      x: target.x,
      y: target.y,
      radius: params?.radius ?? 2.4,
      delaySeconds: params?.delaySeconds ?? 0.35,
      damage: params?.damage ?? 3,
      tags: [DAMAGE_TAG.EXPLOSION],
      sourceId: boss.def?.id ?? 'boss',
    });
    boss.lockedTarget = null;
  },
});

registerBossPattern('CONTACT_CHARGE', {
  note: 'A committed straight rush with recovery. BSS-026 merger, BSS-010 joins combat.',
  telegraphSeconds: 0.8,
  run: (boss, ctx, params) => {
    const target = boss.lockedTarget ?? { x: ctx.player.x, y: ctx.player.y };
    normalizeInto(scratch, target.x - boss.x, target.y - boss.y);
    boss.charge = {
      dx: scratch.x,
      dy: scratch.y,
      speed: params?.speed ?? 13,
      seconds: params?.seconds ?? 0.7,
      // The recovery window is the counterplay. Without it a charge boss is merely a
      // faster contact-damage boss.
      recoverySeconds: params?.recoverySeconds ?? 0.9,
    };
    boss.lockedTarget = null;
  },
});

// ---------------------------------------------------------------------------
// Beam, lane, and cloud patterns
// ---------------------------------------------------------------------------

registerBossPattern('SWEEPING_BEAM', {
  note: 'A rotating beam. BSS-005 command cycle, BSS-014 security.',
  telegraphSeconds: 1.2,
  run: (boss, ctx, params) => {
    boss.beamAngle = boss.beamAngle ?? Math.atan2(ctx.player.y - boss.y, ctx.player.x - boss.x);
    ctx.spawnEnemyBeam?.({
      owner: boss,
      angle: boss.beamAngle,
      sweepRadians: params?.sweepRadians ?? 1.8,
      sweepSeconds: params?.sweepSeconds ?? 2.2,
      width: params?.width ?? 0.9,
      range: params?.range ?? 14,
      damage: params?.damage ?? 2,
      tags: [DAMAGE_TAG.BEAM],
      sourceId: boss.def?.id ?? 'boss',
    });
  },
});

registerBossPattern('SHOCK_LINE', {
  note: 'Electrified floor lines. BSS-006 shock lines, BSS-023 power manipulation.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    const lines = params?.count ?? 2;
    for (let i = 0; i < lines; i += 1) {
      const at = ctx.room?.randomWalkablePoint?.(ctx.rng) || { x: boss.x, y: boss.y };
      ctx.spawnHazardPatch?.({
        hazardId: params?.hazardId ?? 'HAZ-ELECTRICITY_SHOCK_LANE',
        x: at.x,
        y: at.y,
        w: params?.length ?? 8,
        h: params?.width ?? 1,
        seconds: params?.seconds ?? 2.5,
        sourceId: boss.def?.id ?? 'boss',
      });
    }
  },
});

registerBossPattern('CROSS_LANES', {
  note: 'Cardinal lanes of denial. BSS-017 ledger lanes, BSS-009 remaining lane.',
  telegraphSeconds: 1.1,
  reshapesArena: true,
  run: (boss, ctx, params) => {
    const lanes = ctx.room?.laneAnchors?.(params?.axis ?? 'BOTH') || [];
    if (!lanes.length) return;
    // Leave `safeGaps` lanes clear, chosen from the boss's own stream so a replay of the
    // seed produces the same safe lane.
    const clear = new Set();
    const want = Math.min(safeGaps(params), lanes.length);
    while (clear.size < want) clear.add(ctx.rng.int(0, lanes.length - 1));
    lanes.forEach((lane, i) => {
      if (clear.has(i)) return;
      ctx.spawnHazardPatch?.({
        hazardId: params?.hazardId ?? 'HAZ-RED_TAPE_COMPLIANCE_BAND',
        x: lane.x,
        y: lane.y,
        w: lane.w,
        h: lane.h,
        seconds: params?.seconds ?? 3,
        sourceId: boss.def?.id ?? 'boss',
      });
    });
  },
});

registerBossPattern('TONER_BURST', {
  note: 'A lingering cloud. BSS-002 toner burst.',
  telegraphSeconds: 0.9,
  run: (boss, ctx, params) => {
    ctx.spawnHazardPatch?.({
      hazardId: 'HAZ-MACHINE_TONER_CLOUD',
      x: boss.x,
      y: boss.y,
      w: params?.size ?? 4,
      h: params?.size ?? 4,
      seconds: params?.seconds ?? 4,
      sourceId: boss.def?.id ?? 'boss',
    });
  },
});

// ---------------------------------------------------------------------------
// Arena-reshaping patterns. Every one honours MIN_SAFE_GAPS.
// ---------------------------------------------------------------------------

registerBossPattern('SWEEPING_WALL', {
  note: 'Moving walls that narrow the arena. BSS-008 shield walls, BSS-004 dividers.',
  telegraphSeconds: 1.3,
  reshapesArena: true,
  run: (boss, ctx, params) => {
    // R-BSS-006 in code: the wall is requested WITH its gaps and the count cannot be
    // zero. BSS-008's core fight is literally "a core fires through approved gaps", so
    // the gap is the mechanic rather than a safety valve bolted on.
    ctx.moveArenaWalls?.({
      axis: params?.axis ?? 'HORIZONTAL',
      inset: params?.inset ?? 2,
      gapCount: safeGaps(params),
      gapWidth: params?.gapWidth ?? 3,
      seconds: params?.seconds ?? 6,
      sourceId: boss.def?.id ?? 'boss',
    });
  },
});

registerBossPattern('ZONE_CONTROL', {
  note: 'Timed floor zones to leave or enter. BSS-003 stand-up zones, BSS-014 zones.',
  telegraphSeconds: 1.0,
  reshapesArena: true,
  run: (boss, ctx, params) => {
    const zones = ctx.room?.partitionZones?.(params?.count ?? 4) || [];
    if (!zones.length) return;
    // Mark all but `safeGaps` zones. The countdown is shown, so this teaches timing
    // rather than punishing position — BSS-003's stated role is "teaches timed windows
    // without long invulnerability".
    const keep = Math.min(safeGaps(params), zones.length);
    zones.slice(0, zones.length - keep).forEach((zone) => {
      ctx.spawnDelayedBlast?.({
        x: zone.x,
        y: zone.y,
        w: zone.w,
        h: zone.h,
        radius: params?.radius ?? 0,
        delaySeconds: params?.delaySeconds ?? 2,
        damage: params?.damage ?? 2,
        tags: [DAMAGE_TAG.HAZARD],
        sourceId: boss.def?.id ?? 'boss',
      });
    });
  },
});

registerBossPattern('OBSTACLE_DEPLOY', {
  note: 'Drops cover that narrows movement. BSS-009 pallets, BSS-022 seals.',
  telegraphSeconds: 1.1,
  reshapesArena: true,
  run: (boss, ctx, params) => {
    // Placement asks the room, which already refuses to block a required door, blast
    // point, or spawn (R-ENV-004). A boss gets no exemption from that.
    const spots = ctx.room?.findFreeCoverSpots?.({
      around: { x: boss.x, y: boss.y },
      count: params?.count ?? 4,
      radius: params?.radius ?? 6,
      preserveGaps: safeGaps(params),
    }) || [];
    for (const spot of spots) {
      ctx.room.addTemporaryObject?.({
        objectId: params?.objectId ?? 'ENV-017',
        x: spot.x,
        y: spot.y,
        health: params?.health ?? 14,
        blocksProjectiles: true,
        seconds: params?.seconds ?? 0,
      });
    }
  },
});

registerBossPattern('CONVEYOR_SHIFT', {
  note: 'Reverses or accelerates arena conveyors. BSS-011 route change, BSS-028.',
  telegraphSeconds: 1.0,
  reshapesArena: true,
  run: (boss, ctx, params) => {
    ctx.room?.setConveyorState?.({
      direction: params?.direction ?? 'REVERSE',
      speedMul: params?.speedMul ?? 1.4,
      seconds: params?.seconds ?? 5,
    });
  },
});

// ---------------------------------------------------------------------------
// Structural patterns: nodes, adds, heads, votes
// ---------------------------------------------------------------------------

registerBossPattern('NODE_ACTIVATION', {
  note: 'Destructible nodes that shorten a shield phase. BSS-005 terminals, BSS-020 ads.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    const count = params?.count ?? 3;
    for (let i = 0; i < count; i += 1) {
      const at = ctx.room?.randomWalkablePoint?.(ctx.rng) || { x: boss.x, y: boss.y };
      ctx.spawnBossNode?.({
        owner: boss,
        x: at.x,
        y: at.y,
        health: params?.health ?? 10,
        // This is what makes an invulnerable phase legal under R-BSS-004: there is always
        // something attackable, so the player is never merely waiting.
        shortensPhase: true,
        firesPattern: params?.firesPattern ?? null,
      });
    }
  },
});

registerBossPattern('SUMMON_ADDS', {
  note: 'A bounded wave of ordinary enemies. BSS-001, BSS-010, BSS-016.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    // maxAlive is enforced by the spawner, so the room hostile cap (R-ENM-006) applies to
    // boss adds exactly as it does to an encounter.
    ctx.spawnBossAdds?.({
      owner: boss,
      enemyId: params?.enemyId,
      count: params?.count ?? 2,
      maxAlive: params?.maxAlive ?? 4,
      // Appendix E lists "unavoidable spawn damage" as a failure condition, so adds
      // arrive with a grace window and never on top of the player.
      graceSeconds: params?.graceSeconds ?? 0.8,
      minPlayerDistance: params?.minPlayerDistance ?? 3,
    });
  },
});

registerBossPattern('BUFF_ADDS', {
  note: 'Visible rings that empower nearby adds. BSS-001 buzzword rings, BSS-040-style.',
  telegraphSeconds: 0.7,
  run: (boss, ctx, params) => {
    const radius = params?.radius ?? 5;
    for (const enemy of ctx.hostiles || []) {
      if (enemy === boss || enemy.dead) continue;
      if (distance(boss.x, boss.y, enemy.x, enemy.y) > radius) continue;
      enemy.status?.apply(STATUS.HASTE, {
        seconds: params?.seconds ?? 4,
        magnitude: params?.magnitude ?? 0.25,
        sourceId: boss.def?.id ?? 'boss',
      });
    }
    // The ring is drawn, not implied: "visible buzzword rings" is the tell that tells the
    // player to kill either the adds or the lead.
    ctx.spawnTelegraphRing?.({ x: boss.x, y: boss.y, radius, seconds: params?.seconds ?? 4 });
  },
});

registerBossPattern('HEAD_ROTATION', {
  note: 'Independently disableable parts take turns. BSS-006 phone heads.',
  telegraphSeconds: 0.9,
  run: (boss, ctx, params) => {
    const heads = (boss.heads || []).filter((h) => !h.disabled);
    if (!heads.length) return;
    // Round-robin rather than random, because Appendix E says heads "perform distinct
    // calls" — the player is meant to learn the order and disable the worst one.
    boss.headIndex = ((boss.headIndex ?? -1) + 1) % heads.length;
    const head = heads[boss.headIndex];
    const inner = patterns.get(head.pattern ?? params?.fallbackPattern ?? 'AIMED_VOLLEY');
    if (inner) inner.run({ ...boss, x: head.x, y: head.y }, ctx, head.params ?? params);
  },
});

registerBossPattern('VOTE_SELECT', {
  note: 'A visible tally picks the next pattern. BSS-015, BSS-018, BSS-025.',
  telegraphSeconds: 1.2,
  run: (boss, ctx, params) => {
    const options = params?.options || [];
    if (!options.length) return;
    const members = (boss.members || []).filter((m) => !m.dead);
    // Defeating members changes the balance (Appendix E, BSS-015), so the tally is
    // recomputed from who is still alive rather than fixed at spawn.
    const tally = new Map();
    for (const member of members) {
      const choice = member.votesFor ?? options[0].pattern;
      tally.set(choice, (tally.get(choice) ?? 0) + 1);
    }
    let winner = options[0].pattern;
    let best = -1;
    for (const [pattern, votes] of tally) {
      if (votes > best) { best = votes; winner = pattern; }
    }
    ctx.spawnVoteDisplay?.({ tally: [...tally], winner });
    const inner = patterns.get(winner);
    if (inner) inner.run(boss, ctx, options.find((o) => o.pattern === winner)?.params ?? params);
  },
});

registerBossPattern('DECOY_SPAWN', {
  note: 'False bosses and false reward silhouettes. BSS-019 decoys.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    // Appendix E is explicit that "the real attacks remain identifiable by shadow and
    // audio". A truly indistinguishable decoy would be unfair, so the decoy carries the
    // flags and the renderer and audio layers are obliged to honour them.
    ctx.spawnBossDecoy?.({
      owner: boss,
      count: params?.count ?? 2,
      identifiableByShadow: true,
      identifiableByAudio: true,
      health: params?.health ?? 6,
    });
  },
});

registerBossPattern('ABSORB_ADDS', {
  note: 'Consumes its own adds and inherits one attack from each. BSS-026.',
  telegraphSeconds: 1.1,
  run: (boss, ctx, params) => {
    const radius = params?.radius ?? 4;
    for (const enemy of ctx.hostiles || []) {
      if (enemy === boss || enemy.dead || enemy.isBoss) continue;
      if (distance(boss.x, boss.y, enemy.x, enemy.y) > radius) continue;
      const inherited = enemy.def?.attack?.module;
      boss.inheritedPatterns = boss.inheritedPatterns || [];
      // Bounded: without a cap a long fight gives the merger every attack in the game,
      // which is unreadable rather than threatening.
      if (inherited
        && !boss.inheritedPatterns.includes(inherited)
        && boss.inheritedPatterns.length < (params?.maxInherited ?? 4)) {
        boss.inheritedPatterns.push(inherited);
      }
      ctx.absorbEnemy?.(boss, enemy, { healHalfUnits: params?.healPerAdd ?? 4 });
    }
  },
});

registerBossPattern('ECHO_RUN_MECHANIC', {
  note: 'Replays a mechanic already met this run. BSS-013, BSS-027, BSS-029.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    // The three "quotes earlier content" bosses. The pool comes from the RUN, so the
    // final duel is genuinely about the route the player took — and it is the reason
    // every pattern in this file had to stay mechanical and parameterised.
    const seen = ctx.run?.mechanicsSeen ? [...ctx.run.mechanicsSeen] : [];
    const pool = seen.filter((name) => patterns.has(name) && name !== 'ECHO_RUN_MECHANIC');
    const chosen = pool.length ? ctx.rng.pick(pool) : (params?.fallbackPattern ?? 'RADIAL_BURST');
    const inner = patterns.get(chosen);
    if (!inner) return;
    ctx.events?.emit(EVENTS.BOSS_PHASE_CHANGED, { boss: boss.def?.id, echoed: chosen });
    // Sanitised: BSS-027 "reconstructs sanitized versions", so an echo is deliberately
    // weaker than the original was.
    inner.run(boss, ctx, { ...(params?.override || {}), damage: params?.damage ?? 2 });
  },
});

registerBossPattern('MODULE_CYCLE', {
  note: 'Steps through a curated fixed sequence. BSS-024 experimental modules.',
  telegraphSeconds: 1.0,
  run: (boss, ctx, params) => {
    const sequence = params?.sequence || [];
    if (!sequence.length) return;
    // A fixed sequence, not a weighted roll: BSS-024's identity is that the order is
    // learnable, which is the counterplay to how strange the modules are.
    boss.moduleIndex = ((boss.moduleIndex ?? -1) + 1) % sequence.length;
    const step = sequence[boss.moduleIndex];
    const inner = patterns.get(step.pattern);
    if (inner) inner.run(boss, ctx, step.params ?? {});
  },
});

registerBossPattern('WEAK_POINT_EXPOSE', {
  note: 'Opens a timed vulnerable spot. BSS-004 weak points, BSS-012 deadline.',
  telegraphSeconds: 0.8,
  run: (boss, ctx, params) => {
    boss.weakPoint = {
      x: boss.x + (params?.offsetX ?? 0),
      y: boss.y + (params?.offsetY ?? 0),
      radius: params?.radius ?? 1.2,
      damageMul: params?.damageMul ?? 2.5,
      seconds: params?.seconds ?? 3,
    };
    // Visibly explicit, per R-BSS-004. A weak point the player cannot see is just a
    // hidden damage multiplier.
    ctx.spawnTelegraphRing?.({
      x: boss.weakPoint.x,
      y: boss.weakPoint.y,
      radius: boss.weakPoint.radius,
      seconds: boss.weakPoint.seconds,
      kind: 'WEAK_POINT',
    });
  },
});

registerBossPattern('RESOURCE_THEFT', {
  note: 'Marks or takes pickups and credits. BSS-017 marks pickups, BSS-018 theft.',
  telegraphSeconds: 0.9,
  run: (boss, ctx, params) => {
    // Steals rather than destroys, and the stolen amount drops back on death. A boss that
    // permanently deleted resources would be a run-ender disguised as a mechanic.
    const taken = Math.min(ctx.player?.credits ?? 0, params?.credits ?? 4);
    if (taken > 0) {
      ctx.player.addCredits(-taken);
      boss.stolenCredits = (boss.stolenCredits ?? 0) + taken;
    }
    for (const pickup of ctx.room?.pickups || []) {
      if (!ctx.rng.chance(params?.markChance ?? 0.5)) continue;
      pickup.marked = true;
    }
  },
});

registerBossPattern('STRIP_LAYER', {
  note: 'Removes one of its own layers. BSS-029 removes layers, BSS-027 erases branding.',
  telegraphSeconds: 0.6,
  run: (boss, ctx, params) => {
    // The final duel's whole shape: it gets simpler, not harder. The event lets
    // presentation strip a visual layer at the same moment.
    boss.layersRemaining = Math.max(0, (boss.layersRemaining ?? params?.layers ?? 3) - 1);
    ctx.events?.emit(EVENTS.BOSS_PHASE_CHANGED, {
      boss: boss.def?.id,
      layersRemaining: boss.layersRemaining,
      stripped: true,
    });
  },
});

// ---------------------------------------------------------------------------
// Movement rules
// ---------------------------------------------------------------------------

registerMovementRule('ANCHORED', {
  note: 'Does not move. Machines, turret bosses, and arena-is-the-boss fights.',
  update: () => {},
});

registerMovementRule('SLOW_PURSUE', {
  note: 'Advances steadily. The default for a physically present boss.',
  update: (boss, ctx, dt, params) => {
    normalizeInto(scratch, ctx.player.x - boss.x, ctx.player.y - boss.y);
    const speed = params?.speed ?? 1.8;
    boss.x += scratch.x * speed * dt;
    boss.y += scratch.y * speed * dt;
  },
});

registerMovementRule('ORBIT_CENTRE', {
  note: 'Circles the arena centre at a fixed radius. BSS-011 circulating segments.',
  update: (boss, ctx, dt, params) => {
    const cx = ctx.room?.centre?.x ?? boss.x;
    const cy = ctx.room?.centre?.y ?? boss.y;
    boss.orbitAngle = (boss.orbitAngle ?? 0) + (params?.angularSpeed ?? 0.6) * dt;
    const r = params?.radius ?? 5;
    boss.x = cx + Math.cos(boss.orbitAngle) * r;
    boss.y = cy + Math.sin(boss.orbitAngle) * r;
  },
});

registerMovementRule('TELEPORT_STATIONS', {
  note: 'Blinks between authored arena stations. BSS-013, BSS-025.',
  update: (boss, ctx, dt, params) => {
    boss.stationTimer = (boss.stationTimer ?? 0) - dt;
    if (boss.stationTimer > 0) return;
    boss.stationTimer = params?.intervalSeconds ?? 4;
    const stations = ctx.room?.bossStations || [];
    if (!stations.length) return;
    boss.stationIndex = ((boss.stationIndex ?? -1) + 1) % stations.length;
    const next = stations[boss.stationIndex];
    // Telegraphed, not instant: the arrival ring goes up first, so the player is never
    // hit by a boss materialising on top of them.
    ctx.spawnTelegraphRing?.({ x: next.x, y: next.y, radius: boss.radius ?? 2, seconds: 0.4 });
    boss.pendingTeleport = { x: next.x, y: next.y, inSeconds: 0.4 };
  },
});

registerMovementRule('RETREAT_WHEN_CLOSE', {
  note: 'Keeps a standoff distance. BSS-019, BSS-018.',
  update: (boss, ctx, dt, params) => {
    const d = distance(boss.x, boss.y, ctx.player.x, ctx.player.y);
    const want = params?.preferredDistance ?? 7;
    if (Math.abs(d - want) < 0.4) return;
    const sign = d < want ? -1 : 1;
    normalizeInto(scratch, ctx.player.x - boss.x, ctx.player.y - boss.y);
    const speed = params?.speed ?? 2.4;
    boss.x += scratch.x * sign * speed * dt;
    boss.y += scratch.y * sign * speed * dt;
  },
});

registerMovementRule('LANE_BOUND', {
  note: 'Slides along one axis only. BSS-009, BSS-028 sequenced mechanics.',
  update: (boss, ctx, dt, params) => {
    const speed = params?.speed ?? 3;
    if ((params?.axis ?? 'HORIZONTAL') === 'HORIZONTAL') {
      boss.x += Math.sign(ctx.player.x - boss.x) * speed * dt;
    } else {
      boss.y += Math.sign(ctx.player.y - boss.y) * speed * dt;
    }
  },
});

registerMovementRule('CHARGE_AND_RECOVER', {
  note: 'Stationary except during a committed charge. Pairs with CONTACT_CHARGE.',
  update: (boss, ctx, dt) => {
    const charge = boss.charge;
    if (!charge) return;
    if (charge.seconds > 0) {
      charge.seconds -= dt;
      boss.x += charge.dx * charge.speed * dt;
      boss.y += charge.dy * charge.speed * dt;
      return;
    }
    // The recovery window is where the player gets their damage in, so it belongs to the
    // movement rule rather than being something the pattern hopes for.
    charge.recoverySeconds -= dt;
    boss.recovering = charge.recoverySeconds > 0;
    if (!boss.recovering) boss.charge = null;
  },
});

registerMovementRule('DRIFT_WANDER', {
  note: 'Slow aimless drift. BSS-022 living roll, BSS-029 minimalist duel.',
  update: (boss, ctx, dt, params) => {
    boss.driftTimer = (boss.driftTimer ?? 0) - dt;
    if (boss.driftTimer <= 0) {
      boss.driftTimer = params?.changeSeconds ?? 2.5;
      const a = ctx.rng.angle();
      boss.driftX = Math.cos(a);
      boss.driftY = Math.sin(a);
    }
    const speed = params?.speed ?? 1.2;
    boss.x += (boss.driftX ?? 0) * speed * dt;
    boss.y += (boss.driftY ?? 0) * speed * dt;
  },
});
