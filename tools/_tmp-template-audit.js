#!/usr/bin/env node
/** TEMPORARY authoring audit. Delete before hand-off. */
import templates from '../content/rooms/index.js';
import { TemplateIndex } from '../src/systems/template-index.js';
import { doorInnerTile, WALKABLE } from '../src/systems/floor-validate.js';
import { roomTemplateSchema } from '../src/schemas.js';

const index = new TemplateIndex(templates);
let problems = 0;

for (const tpl of index.all) {
  const grid = tpl.def.geometry;
  const h = grid.length;
  const w = grid[0].length;
  const seeds = [];
  for (const socket of tpl.def.doorSockets) {
    const tile = doorInnerTile(socket.cell, socket.side, tpl, socket.id);
    if (!tile) { console.log(`${tpl.id}: socket ${socket.id} has no inner tile`); problems++; continue; }
    const [tx, ty] = tile;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) {
      console.log(`${tpl.id}: socket ${socket.id} inner tile ${tile} out of bounds`); problems++; continue;
    }
    if (!WALKABLE.has(grid[ty][tx])) {
      console.log(`${tpl.id}: socket ${socket.id} (${socket.side}) opens onto '${grid[ty][tx]}' at ${tile}`);
      problems++; continue;
    }
    seeds.push(tile);
  }
  if (seeds.length === 0) { console.log(`${tpl.id}: no usable doors`); problems++; continue; }
  const seen = new Set([`${seeds[0][0]},${seeds[0][1]}`]);
  const queue = [seeds[0]];
  while (queue.length) {
    const [cx, cy] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx; const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !WALKABLE.has(grid[ny][nx])) continue;
      seen.add(k); queue.push([nx, ny]);
    }
  }
  for (const [sx, sy] of seeds) {
    if (!seen.has(`${sx},${sy}`)) {
      console.log(`${tpl.id}: door at ${sx},${sy} is in a separate walkable region`);
      problems++; break;
    }
  }
  for (const zone of tpl.def.spawnZones) {
    const [zx, zy, zw, zh] = zone.rect;
    let ok = false;
    for (let y = Math.floor(zy); y < Math.ceil(zy + zh) && !ok; y += 1) {
      for (let x = Math.floor(zx); x < Math.ceil(zx + zw); x += 1) {
        if (seen.has(`${x},${y}`)) { ok = true; break; }
      }
    }
    if (!ok) { console.log(`${tpl.id}: spawn zone ${zone.zone} isolated`); problems++; }
  }
  // An anchor may sit on '#' (the wall block IS that cover object's footprint),
  // but never on a pit, off the grid, or on a door approach at chance 1.
  const doorTiles = new Set(seeds.map(([x, y]) => `${x},${y}`));
  for (const a of tpl.def.objectAnchors) {
    const [ax, ay] = a.at.map(Math.floor);
    if (ay >= h || ax >= w || ay < 0 || ax < 0) {
      console.log(`${tpl.id}: object anchor ${a.at} out of bounds`); problems++; continue;
    }
    if (grid[ay][ax] === 'x') {
      console.log(`${tpl.id}: object anchor ${a.at} floats over a pit`); problems++;
    }
    if (a.chance >= 1 && doorTiles.has(`${ax},${ay}`)) {
      console.log(`${tpl.id}: certain anchor on a door approach ${a.at} (R-ENV-004)`); problems++;
    }
  }
  for (const hz of tpl.def.hazardAnchors) {
    const [hx, hy, hw, hh] = hz.rect;
    let ok = false;
    for (let y = Math.floor(hy); y < Math.ceil(hy + hh) && !ok; y += 1) {
      for (let x = Math.floor(hx); x < Math.ceil(hx + hw); x += 1) {
        if (seen.has(`${x},${y}`)) { ok = true; break; }
      }
    }
    if (!ok) { console.log(`${tpl.id}: hazard ${hz.hazard} covers no walkable tile`); problems++; }
  }
  const { issues } = roomTemplateSchema.validate(tpl.def);
  for (const e of issues.errors || []) { console.log(`${tpl.id}: SCHEMA ${e.path}: ${e.message}`); problems++; }
}

const byRole = new Map();
for (const tpl of index.all) {
  for (const r of tpl.roleTags) {
    if (!r.startsWith('ROOM-')) continue;
    const key = `${r} ${tpl.shapeId}`;
    byRole.set(key, (byRole.get(key) || 0) + 1);
  }
}
console.log(`\ntemplates: ${templates.length}  problems: ${problems}`);
console.log('coverage:', JSON.stringify(index.coverage('OPEN_OFFICE', 1)));
console.log([...byRole.entries()].sort().map(([k, v]) => `  ${k}: ${v}`).join('\n'));
process.exit(problems ? 1 : 0);
