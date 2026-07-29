/**
 * Room templates are self-consistent as authored, independent of any floor.
 *
 * GDD refs: 12 (room templates), R-ROM-006 (every door approach sits in one connected
 *           walkable region), R-QA-003 (generation is stress-tested), R-QA-005 (no invalid
 *           references).
 *
 * ## Why this exists as a separate layer
 *
 * `validateFloor` already enforces R-ROM-006 — but only for the sockets a *particular* floor
 * happened to connect, and only after the floor is fully built. A template that declares a
 * door it cannot reach through its own interior therefore passes content validation, gets
 * picked by the generator, and fails validation at the very last step. The generator's only
 * recourse is to throw the whole floor away and start over.
 *
 * That is exactly how the department floors ended up regenerating 18-33% of the time against a
 * 15% ceiling: two hallway variants carved a single-axis corridor while still advertising
 * sockets on all four walls. Nothing was broken at runtime, so nothing failed loudly — the
 * cost showed up only as generation churn, which is the hardest kind of defect to trace back
 * to its cause.
 *
 * Checking the property here, against the template alone, means a template like that fails the
 * moment it is authored rather than becoming a statistical drag on floor generation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { doorInnerTile, WALKABLE } from '../src/systems/floor-validate.js';
import { IndexedTemplate } from '../src/systems/template-index.js';

const registry = loadContent({ strict: false });
// doorInnerTile resolves a socket through the indexed wrapper's normalised-cell lookup, so
// the definitions are wrapped exactly as the generator sees them.
const templates = registry.all('roomTemplate').map((def) => new IndexedTemplate(def));

/** Flood fill the walkable region containing `start`. */
function region(grid, start) {
  const h = grid.length;
  const w = grid[0].length;
  const seen = new Set([`${start[0]},${start[1]}`]);
  const queue = [start];
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
  return seen;
}

test('R-ROM-006: every declared socket opens onto a walkable tile', () => {
  const broken = [];
  for (const tpl of templates) {
    const grid = tpl.def.geometry;
    if (!Array.isArray(grid) || grid.length === 0) continue;
    const h = grid.length;
    const w = grid[0].length;
    for (const socket of tpl.def.doorSockets || []) {
      const tile = doorInnerTile(socket.cell, socket.side, tpl, socket.id);
      if (!tile) {
        broken.push(`${tpl.def.id} socket ${socket.id} (${socket.side}) has no inner tile`);
        continue;
      }
      const [tx, ty] = tile;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) {
        broken.push(`${tpl.def.id} socket ${socket.id} (${socket.side}) inner tile is out of bounds`);
        continue;
      }
      if (!WALKABLE.has(grid[ty][tx])) {
        broken.push(`${tpl.def.id} socket ${socket.id} (${socket.side}) opens onto '${grid[ty][tx]}'`);
      }
    }
  }
  assert.deepEqual(broken, [], `sockets opening onto solid geometry:\n  ${broken.join('\n  ')}`);
});

test('R-ROM-006: all of a template\'s sockets share one walkable region', () => {
  // The bug this pins: a socket the generator is allowed to connect, on a wall the interior
  // never reaches. It costs a full floor regeneration every time it is chosen.
  const broken = [];
  for (const tpl of templates) {
    const grid = tpl.def.geometry;
    if (!Array.isArray(grid) || grid.length === 0) continue;
    const seeds = [];
    for (const socket of tpl.def.doorSockets || []) {
      const tile = doorInnerTile(socket.cell, socket.side, tpl, socket.id);
      if (!tile) continue;
      const [tx, ty] = tile;
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) continue;
      if (!WALKABLE.has(grid[ty][tx])) continue;
      seeds.push({ socket, tile });
    }
    if (seeds.length < 2) continue;
    const reachable = region(grid, seeds[0].tile);
    const stranded = seeds
      .filter(({ tile }) => !reachable.has(`${tile[0]},${tile[1]}`))
      .map(({ socket }) => `${socket.id}/${socket.side}`);
    if (stranded.length > 0) {
      broken.push(`${tpl.def.id}: ${stranded.join(', ')} unreachable from ${seeds[0].socket.side}`);
    }
  }
  assert.deepEqual(
    broken,
    [],
    `templates whose doors are in separate regions:\n  ${broken.join('\n  ')}`,
  );
});

test('R-ENM-008: every spawn zone intersects the walkable region behind a door', () => {
  // An isolated spawn zone is an enemy the player cannot reach, which is the impossible-clear
  // case R-CMB-006 exists to prevent. Checked here as well as per-floor for the same reason as
  // above: it is a property of the template, so it should fail at authoring time.
  const broken = [];
  for (const tpl of templates) {
    const grid = tpl.def.geometry;
    if (!Array.isArray(grid) || grid.length === 0) continue;
    const first = (tpl.def.doorSockets || [])
      .map((s) => doorInnerTile(s.cell, s.side, tpl, s.id))
      .find((t) => {
        if (!t) return false;
        const [tx, ty] = t;
        return ty >= 0 && ty < grid.length && tx >= 0 && tx < grid[0].length
          && WALKABLE.has(grid[ty][tx]);
      });
    if (!first) continue;
    const reachable = region(grid, first);
    for (const zone of tpl.def.spawnZones || []) {
      const cells = [];
      for (let y = zone.rect[1]; y < zone.rect[1] + zone.rect[3]; y += 1) {
        for (let x = zone.rect[0]; x < zone.rect[0] + zone.rect[2]; x += 1) {
          if (reachable.has(`${x},${y}`)) cells.push([x, y]);
        }
      }
      if (cells.length === 0) broken.push(`${tpl.def.id} zone ${zone.kind} is unreachable`);
    }
  }
  assert.deepEqual(broken, [], `unreachable spawn zones:\n  ${broken.join('\n  ')}`);
});

test('every template the generator can pick is authored for a real department', () => {
  // A template tagged for a department that does not exist is silently never picked, which
  // reads as "that department has thin coverage" rather than as a typo.
  const departmentTags = new Set(registry.all('department').map((d) => d.tag));
  departmentTags.add('SERVICE_SHARED');
  const unknown = [];
  for (const tpl of templates) {
    for (const tag of tpl.def.departmentTags || []) {
      if (!departmentTags.has(tag)) unknown.push(`${tpl.def.id} -> ${tag}`);
    }
  }
  assert.deepEqual(unknown, [], `templates tagged for unknown departments:\n  ${unknown.join('\n  ')}`);
});
