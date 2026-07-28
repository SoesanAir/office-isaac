/**
 * Floor validation.
 *
 * GDD refs: 11.4 step 13 (run graph, collision, navigation, door, reward, and
 *           soft-lock validation; regenerate if it fails), 11.5 (R-FLR-001..010),
 *           23.2 (procedural test suite: connectivity, role counts, dead-end
 *           minimums, footprint non-overlap, socket alignment, critical-path
 *           access, navigation, secret blast points), R-ROM-006, R-ENM-008,
 *           R-ENV-004, R-QA-001 (no soft locks).
 *
 * Every check returns a human-readable error string rather than throwing, so the
 * generator can retry deterministically and the stress harness can report which
 * rule a floor definition tends to violate.
 */

import { DOOR_CLASS, ROOM_ROLE, SPAWN_ZONE, CELL_W, CELL_H, WALL } from '../core/constants.js';
import { sideDelta } from './template-index.js';

/** Door classes that a player may not be able to pay for on the critical path. */
const GATED_DOOR_CLASSES = new Set([
  DOOR_CLASS.LOCKED_CARD,
  DOOR_CLASS.LOCKED_DOUBLE,
  DOOR_CLASS.BLAST_SECRET,
  DOOR_CLASS.RESTRICTED,
]);

/** Interior stride per grid cell: the cell plus the shared wall between cells. */
const STRIDE_X = CELL_W + WALL;
const STRIDE_Y = CELL_H + WALL;

/** Characters that an entity can stand on. */
const WALKABLE = new Set(['.', '~', ',', 'o']);

/**
 * Build a validator bound to a template index.
 *
 * @param {{templateIndex: import('./template-index.js').TemplateIndex, floorDef: object}} deps
 * @returns {(floor: object) => {ok: boolean, errors: string[], warnings: string[]}}
 */
export function makeFloorValidator({ templateIndex, floorDef }) {
  const byId = new Map(templateIndex.all.map((t) => [t.id, t]));
  return (floor) => validateFloor(floor, { byId, floorDef });
}

export function validateFloor(floor, { byId, floorDef }) {
  const errors = [];
  const warnings = [];

  checkFootprints(floor, errors);
  checkSocketAlignment(floor, errors);
  checkConnectivity(floor, errors);
  checkRoleCounts(floor, errors);
  checkDeadEnds(floor, floorDef, errors, warnings);
  checkBossDistance(floor, floorDef, errors, warnings);
  checkCriticalPath(floor, errors);
  checkHiddenRooms(floor, errors);
  checkEncounterSeparation(floor, errors);
  if (byId) {
    checkTemplateBinding(floor, byId, errors);
    checkNavigation(floor, byId, errors, warnings);
    checkBlastPoints(floor, byId, errors, warnings);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** No two rooms may claim the same grid cell (GDD 11.2, 23.2). */
function checkFootprints(floor, errors) {
  const owner = new Map();
  for (const node of floor.nodes.values()) {
    for (const [x, y] of node.cells) {
      const key = `${x},${y}`;
      if (owner.has(key)) {
        errors.push(`footprint overlap at ${key}: ${owner.get(key)} and ${node.id}`);
      } else {
        owner.set(key, node.id);
      }
    }
    if (node.cells.length !== node.footprint.length) {
      errors.push(`${node.id} cell count does not match its footprint`);
    }
  }
}

/**
 * R-FLR-005: door edges connect compatible sockets with matching world positions
 * and opposite orientations. Validation rejects misaligned, one-way, or orphaned
 * ordinary doors.
 */
function checkSocketAlignment(floor, errors) {
  const seenEndpoints = new Set();
  for (const edge of floor.edges.values()) {
    const a = floor.nodes.get(edge.a.nodeId);
    const b = floor.nodes.get(edge.b.nodeId);
    if (!a || !b) {
      errors.push(`edge ${edge.id} references a missing node`);
      continue;
    }
    if (a.id === b.id) {
      errors.push(`edge ${edge.id} connects ${a.id} to itself`);
      continue;
    }
    // Opposite orientations.
    const expected = { NORTH: 'SOUTH', SOUTH: 'NORTH', EAST: 'WEST', WEST: 'EAST' };
    if (expected[edge.a.side] !== edge.b.side) {
      errors.push(`edge ${edge.id} sides ${edge.a.side}/${edge.b.side} are not opposite`);
    }
    // Matching world positions: the two cells must be grid-adjacent across the side.
    const aAbs = [a.origin[0] + edge.a.cell[0], a.origin[1] + edge.a.cell[1]];
    const bAbs = [b.origin[0] + edge.b.cell[0], b.origin[1] + edge.b.cell[1]];
    const [dx, dy] = sideDelta(edge.a.side);
    if (aAbs[0] + dx !== bAbs[0] || aAbs[1] + dy !== bAbs[1]) {
      errors.push(
        `edge ${edge.id} misaligned: ${aAbs} + ${edge.a.side} does not reach ${bAbs}`,
      );
    }
    // Each cell edge may host at most one door.
    for (const [node, endpoint] of [[a, edge.a], [b, edge.b]]) {
      const key = `${node.id}|${endpoint.cell[0]},${endpoint.cell[1]},${endpoint.side}`;
      if (seenEndpoints.has(key)) {
        errors.push(`two doors share cell edge ${key}`);
      }
      seenEndpoints.add(key);
    }
    // Bidirectional registration: no one-way doors.
    if (!a.edgeIds.includes(edge.id) || !b.edgeIds.includes(edge.id)) {
      errors.push(`edge ${edge.id} is not registered on both nodes (one-way door)`);
    }
  }
  // Orphan detection: every required socket must correspond to a real edge.
  for (const node of floor.nodes.values()) {
    if (node.edgeIds.length !== node.requiredSockets.size) {
      errors.push(
        `${node.id} has ${node.requiredSockets.size} required sockets but ${node.edgeIds.length} edges`,
      );
    }
    if (node.edgeIds.length === 0 && node.id !== floor.startNodeId) {
      errors.push(`${node.id} is orphaned (no doors)`);
    }
  }
}

/** R-FLR-001: connected from Start to all non-hidden ordinary rooms. */
function checkConnectivity(floor, errors) {
  if (!floor.startNodeId || !floor.nodes.has(floor.startNodeId)) {
    errors.push('floor has no start room');
    return;
  }
  const reached = floor.distances(floor.startNodeId, { includeSecret: false });
  for (const node of floor.nodes.values()) {
    if (node.hidden) continue;
    if (!reached.has(node.id)) {
      errors.push(`${node.id} (${node.role}) is unreachable from Start (R-FLR-001)`);
    }
  }
  // Hidden rooms must be reachable once their secret door is opened.
  const withSecrets = floor.distances(floor.startNodeId, { includeSecret: true });
  for (const node of floor.nodes.values()) {
    if (!node.hidden) continue;
    if (!withSecrets.has(node.id)) {
      errors.push(`hidden ${node.id} is unreachable even through secret doors`);
    }
  }
}

/** R-FLR-006 / R-LOOP-001: the guaranteed roles appear exactly once. */
function checkRoleCounts(floor, errors) {
  const counts = floor.roleCounts();
  for (const role of [ROOM_ROLE.START, ROOM_ROLE.SUPPLY_CLOSET, ROOM_ROLE.SHOP, ROOM_ROLE.MANAGER_OFFICE]) {
    const n = counts[role] || 0;
    if (n !== 1) errors.push(`role ${role} appears ${n} times, expected exactly 1 (R-FLR-006)`);
  }
  if (!floor.bossNodeId || !floor.nodes.has(floor.bossNodeId)) {
    errors.push('floor has no boss node');
  }
}

/** R-FLR-003: at least the configured number of usable dead ends. */
function checkDeadEnds(floor, floorDef, errors, warnings) {
  let count = 0;
  for (const node of floor.nodes.values()) {
    if (node.hidden || node.role === ROOM_ROLE.START) continue;
    if (node.isDeadEnd(floor)) count += 1;
  }
  floor.metrics.deadEnds = count;
  // Specials consume dead ends, so the post-assignment count is naturally lower.
  // The rule is about the pre-assignment graph, recorded during generation.
  const before = floor.metrics.deadEndsBeforeSpecials ?? count;
  if (before < floorDef.minDeadEnds) {
    warnings.push(
      `${before} dead ends before specials, floor wants ${floorDef.minDeadEnds} (R-FLR-003)`,
    );
  }
  if (count === 0) errors.push('floor has no dead ends at all');
}

/** R-FLR-002: Manager Office at or near the greatest traversable distance. */
function checkBossDistance(floor, floorDef, errors, warnings) {
  const boss = floor.nodes.get(floor.bossNodeId);
  if (!boss) return;
  const dist = floor.distances(floor.startNodeId);
  let max = 0;
  for (const [, d] of dist) if (d > max) max = d;
  const bossDist = dist.get(boss.id) ?? 0;
  floor.metrics.bossDistance = bossDist;
  floor.metrics.maxDistance = max;
  // Tolerance of 2: a special room hung off a far branch can legitimately sit
  // one or two steps deeper than the boss without making the boss feel close.
  if (bossDist < max - 2) {
    warnings.push(
      `boss at distance ${bossDist} but max is ${max} (R-FLR-002 tolerance)`,
    );
  }
  if (bossDist < 3) {
    errors.push(`boss is only ${bossDist} rooms from Start; too close to be a climax`);
  }
}

/**
 * R-FLR-009 / R-QA-001: no generated floor requires an unavailable resource to
 * reach its boss. Optional locked rooms are ignored; the critical path is what
 * matters.
 */
function checkCriticalPath(floor, errors) {
  const reachable = floor.distances(floor.startNodeId, {
    includeSecret: false,
    blockedDoorClasses: GATED_DOOR_CLASSES,
  });
  if (!reachable.has(floor.bossNodeId)) {
    errors.push('boss room is not reachable without spending gated resources (R-FLR-009)');
  }
  // The Shop may cost a card, but it must not be the only way onward.
  for (const node of floor.nodes.values()) {
    if (node.hidden) continue;
    if (node.role !== ROOM_ROLE.WORKROOM && node.role !== ROOM_ROLE.LARGE_WORKROOM) continue;
    if (!reachable.has(node.id)) {
      errors.push(`ordinary room ${node.id} is only reachable through a gated door (R-FLR-009)`);
    }
  }
}

/** R-FLR-010: hidden rooms are absent from the map until discovered. */
function checkHiddenRooms(floor, errors) {
  for (const node of floor.nodes.values()) {
    if (!node.hidden) continue;
    if (node.visited) errors.push(`hidden ${node.id} starts visited`);
    for (const edgeId of node.edgeIds) {
      const edge = floor.edges.get(edgeId);
      if (edge.discovered) {
        errors.push(`hidden ${node.id} has a pre-discovered door ${edgeId} (R-FLR-010)`);
      }
      if (edge.doorClass !== DOOR_CLASS.BLAST_SECRET) {
        errors.push(`hidden ${node.id} uses a non-secret door class ${edge.doorClass}`);
      }
    }
  }
}

/** R-FLR-007 / D-006: architecture must not carry an encounter at generation. */
function checkEncounterSeparation(floor, errors) {
  for (const node of floor.nodes.values()) {
    if (node.encounterId !== null && node.encounterId !== undefined) {
      errors.push(`${node.id} has an encounter bound during layout (R-FLR-007)`);
    }
  }
}

/** Every node has a template whose sockets cover its edges. */
function checkTemplateBinding(floor, byId, errors) {
  for (const node of floor.nodes.values()) {
    if (!node.templateId) {
      errors.push(`${node.id} has no template selected`);
      continue;
    }
    const tpl = byId.get(node.templateId);
    if (!tpl) {
      errors.push(`${node.id} references unknown template ${node.templateId}`);
      continue;
    }
    if (tpl.shapeId !== node.shapeId) {
      errors.push(`${node.id} template shape ${tpl.shapeId} != node shape ${node.shapeId}`);
    }
    for (const edgeId of node.edgeIds) {
      const edge = floor.edges.get(edgeId);
      const near = edge.a.nodeId === node.id ? edge.a : edge.b;
      if (!near.socketId) {
        errors.push(`${node.id} edge ${edgeId} has no bound socket id`);
        continue;
      }
      const options = tpl.socketsAt(near.cell[0], near.cell[1], near.side);
      const match = options.find((s) => s.id === near.socketId);
      if (!match) {
        errors.push(`${node.id} socket ${near.socketId} is not in template ${tpl.id}`);
      } else if (!match.classes.includes(edge.doorClass)) {
        errors.push(
          `${node.id} socket ${near.socketId} does not accept ${edge.doorClass}`,
        );
      }
    }
  }
}

/**
 * R-ROM-006 / R-ENM-008: every door approach and every spawn zone must sit in one
 * connected walkable region. An isolated spawn zone means an enemy the player
 * cannot reach, which is exactly the impossible-clear case R-CMB-006 guards.
 */
function checkNavigation(floor, byId, errors, warnings) {
  for (const node of floor.nodes.values()) {
    const tpl = byId.get(node.templateId);
    if (!tpl) continue;
    const grid = tpl.def.geometry;
    if (!Array.isArray(grid) || grid.length === 0) {
      errors.push(`template ${tpl.id} has no geometry`);
      continue;
    }
    const h = grid.length;
    const w = grid[0].length;

    // Geometry must match the footprint span.
    const xs = tpl.footprint.map(([x]) => x);
    const ys = tpl.footprint.map(([, y]) => y);
    const spanX = Math.max(...xs) + 1;
    const spanY = Math.max(...ys) + 1;
    const expectedW = CELL_W * spanX + (spanX - 1);
    const expectedH = CELL_H * spanY + (spanY - 1);
    if (w !== expectedW || h !== expectedH) {
      errors.push(
        `template ${tpl.id} geometry is ${w}x${h}, expected ${expectedW}x${expectedH}`,
      );
      continue;
    }

    // Seed points: the interior tile just inside each door.
    const seeds = [];
    for (const edgeId of node.edgeIds) {
      const edge = floor.edges.get(edgeId);
      const near = edge.a.nodeId === node.id ? edge.a : edge.b;
      const tile = doorInnerTile(near.cell, near.side, tpl, near.socketId);
      if (!tile) continue;
      const [tx, ty] = tile;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) {
        errors.push(`template ${tpl.id} door ${near.socketId} inner tile is out of bounds`);
        continue;
      }
      if (!WALKABLE.has(grid[ty][tx])) {
        errors.push(
          `template ${tpl.id} door ${near.socketId} opens onto '${grid[ty][tx]}', not walkable`,
        );
        continue;
      }
      seeds.push(tile);
    }
    if (seeds.length === 0) continue;

    // Flood fill from the first door.
    const seen = new Set();
    const queue = [seeds[0]];
    seen.add(`${seeds[0][0]},${seeds[0][1]}`);
    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        if (!WALKABLE.has(grid[ny][nx])) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }

    // All doors must share one region, or a room can be entered and not exited.
    for (const [sx, sy] of seeds) {
      if (!seen.has(`${sx},${sy}`)) {
        errors.push(`template ${tpl.id} has doors in separate walkable regions (R-ROM-006)`);
        break;
      }
    }

    // Spawn zones must intersect the walkable region.
    for (const zone of tpl.def.spawnZones || []) {
      const [zx, zy, zw, zh] = zone.rect;
      let anyWalkable = false;
      for (let y = Math.floor(zy); y < Math.ceil(zy + zh) && !anyWalkable; y += 1) {
        for (let x = Math.floor(zx); x < Math.ceil(zx + zw); x += 1) {
          if (seen.has(`${x},${y}`)) { anyWalkable = true; break; }
        }
      }
      if (!anyWalkable) {
        const severity = zone.zone === SPAWN_ZONE.AIR ? warnings : errors;
        severity.push(
          `template ${tpl.id} spawn zone ${zone.zone} is isolated from the walkable region (R-ENM-008)`,
        );
      }
    }
  }
}

/**
 * R-ECO-003 / 11.7: a hidden entrance cannot be blocked by indestructible scenery
 * or a pit at the blast point, or the secret is undiscoverable.
 */
function checkBlastPoints(floor, byId, errors, warnings) {
  for (const edge of floor.edges.values()) {
    if (edge.doorClass !== DOOR_CLASS.BLAST_SECRET) continue;
    let anyOpen = false;
    for (const endpoint of [edge.a, edge.b]) {
      const node = floor.nodes.get(endpoint.nodeId);
      const tpl = byId.get(node?.templateId);
      if (!tpl) continue;
      const tile = doorInnerTile(endpoint.cell, endpoint.side, tpl, endpoint.socketId);
      if (!tile) continue;
      const grid = tpl.def.geometry;
      const [tx, ty] = tile;
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) continue;
      const ch = grid[ty][tx];
      if (ch === 'x') {
        errors.push(`secret door ${edge.id} blast point sits on a pit (11.7)`);
      } else if (WALKABLE.has(ch)) {
        anyOpen = true;
      }
      // An object anchor exactly on the blast point would block placement.
      const blocked = (tpl.def.objectAnchors || []).some(
        (a) => Math.floor(a.at[0]) === tx && Math.floor(a.at[1]) === ty && a.chance >= 1,
      );
      if (blocked) {
        errors.push(`secret door ${edge.id} blast point is always occupied by an object (R-ENV-004)`);
      }
    }
    if (!anyOpen) {
      warnings.push(`secret door ${edge.id} has no confirmed reachable blast point`);
    }
  }
}

/**
 * Interior tile immediately inside a door.
 *
 * Cell (cx, cy) starts at interior (cx * STRIDE_X, cy * STRIDE_Y) and spans
 * CELL_W x CELL_H. The socket offset selects a position along that edge.
 */
function doorInnerTile(cell, side, tpl, socketId) {
  const [cx, cy] = cell;
  const sockets = tpl.socketsAt(cx, cy, side);
  const socket = sockets.find((s) => s.id === socketId) || sockets[0];
  if (!socket) return null;
  const baseX = cx * STRIDE_X;
  const baseY = cy * STRIDE_Y;
  const alongX = baseX + Math.min(CELL_W - 1, Math.floor(socket.offset * CELL_W));
  const alongY = baseY + Math.min(CELL_H - 1, Math.floor(socket.offset * CELL_H));
  switch (side) {
    case 'NORTH': return [alongX, baseY];
    case 'SOUTH': return [alongX, baseY + CELL_H - 1];
    case 'WEST': return [baseX, alongY];
    case 'EAST': return [baseX + CELL_W - 1, alongY];
    default: return null;
  }
}

export { doorInnerTile, WALKABLE, STRIDE_X, STRIDE_Y };
