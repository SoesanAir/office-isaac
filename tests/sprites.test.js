/**
 * Sprite integrity (GDD 18.1-18.5, R-ART-001/002, R-ITM-002, R-QA-005).
 *
 * Art in this project is data — palette-indexed character grids in .js files — which means it
 * can be wrong in ways image files cannot: a row one character short, a character that is not
 * in the palette, two definitions claiming the same id, a `spriteId` in content that no sprite
 * answers to.
 *
 * None of those crash. A short row silently shifts every pixel after it; an unknown character
 * bakes as magenta; a missing sprite draws a placeholder box. The game keeps running and looks
 * broken, which is the failure mode most likely to reach a player. So each one is a test.
 *
 * The boss-scale check exists because bosses are drawn through the *enemy* path (BossRuntime
 * puts the boss in `hostiles` so combat treats it as an enemy with a large radius), and the
 * enemy path used a fixed scale suited to a 16x16 grid. That drew a radius-2.6 boss at a fifth
 * of the hitbox the player was dodging. The scale is now derived from radius and grid width,
 * and this test pins the relationship.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import spriteDefs from '../content/sprites/index.js';
import { PALETTE } from '../src/render/sprites.js';
import { TILE } from '../src/core/constants.js';
import { bossSpriteScale } from '../src/main.js';

const registry = loadContent({ strict: false });

test('every sprite grid is rectangular', () => {
  const broken = [];
  for (const def of spriteDefs) {
    for (const [fi, grid] of (def.frames || []).entries()) {
      if (!Array.isArray(grid) || grid.length === 0) {
        broken.push(`${def.id} frame ${fi} has no rows`);
        continue;
      }
      const width = grid[0].length;
      for (const [ri, row] of grid.entries()) {
        // One short row shifts every pixel after it and reads as a corrupt sprite rather than
        // as a typo, so it is worth naming the exact row.
        if (row.length !== width) {
          broken.push(`${def.id} frame ${fi} row ${ri} is ${row.length} chars, expected ${width}`);
        }
      }
      // Deliberately NOT asserting square. The player is 16x18 because a standing figure is
      // taller than it is wide, and projectiles are small odd sizes. Only *ragged* is a bug.
    }
  }
  assert.deepEqual(broken, [], `malformed grids:\n  ${broken.join('\n  ')}`);
});

test('every sprite frame of a definition is the same size', () => {
  const broken = [];
  for (const def of spriteDefs) {
    const sizes = new Set((def.frames || []).map((g) => `${g[0]?.length}x${g.length}`));
    // Frames of different sizes make the animation jump, because the anchor is per-definition.
    if (sizes.size > 1) broken.push(`${def.id}: ${[...sizes].join(', ')}`);
  }
  assert.deepEqual(broken, [], `definitions with mismatched frame sizes:\n  ${broken.join('\n  ')}`);
});

test('R-ART-001: every character used is in the shared palette', () => {
  const unknown = new Map();
  for (const def of spriteDefs) {
    const local = def.palette || {};
    for (const grid of def.frames || []) {
      for (const row of grid) {
        for (const ch of row) {
          if (ch in PALETTE || ch in local) continue;
          // An unknown character bakes to loud magenta on purpose, but the point of the loud
          // colour is that someone sees it — a test sees it before a player does.
          if (!unknown.has(ch)) unknown.set(ch, new Set());
          unknown.get(ch).add(def.id);
        }
      }
    }
  }
  const report = [...unknown].map(([ch, ids]) => `'${ch}' in ${[...ids].slice(0, 4).join(', ')}`);
  assert.deepEqual(report, [], `characters outside the palette:\n  ${report.join('\n  ')}`);
});

test('sprite ids are unique', () => {
  const seen = new Map();
  const dupes = [];
  for (const def of spriteDefs) {
    // Domain files own id prefixes precisely so two authors cannot collide; a duplicate means
    // that split has broken down, and the later definition silently wins.
    if (seen.has(def.id)) dupes.push(def.id);
    seen.set(def.id, true);
  }
  assert.deepEqual(dupes, [], `duplicate sprite ids: ${dupes.join(', ')}`);
});

test('R-QA-005: every spriteId referenced by content resolves', () => {
  const have = new Set(spriteDefs.map((d) => d.id));
  const kinds = ['enemy', 'boss', 'passive', 'active', 'card', 'supplement', 'charm',
    'transformation', 'weapon', 'roomObject', 'hazard'];
  // Boss art is the project's one outstanding content gap. It is recorded in the README and
  // already treated as a warning rather than an error by tools/qa-gate.js, on the grounds that a
  // placeholder is a visible, obviously-unfinished state rather than a correctness defect — and
  // a gate that is permanently red is a gate nobody reads.
  //
  // This encodes that policy as a rule rather than a list of names. A missing *boss* sprite is
  // the known gap and gets reported; a missing sprite of any other kind is a regression and
  // fails. Expressed as a rule so it cannot rot: as boss sprites land, the tolerated count falls
  // to zero on its own and nobody has to remember to prune an allowlist.
  const missing = [];
  for (const kind of kinds) {
    for (const def of registry.all(kind)) {
      if (def.spriteId && !have.has(def.spriteId)) {
        missing.push({ kind, ref: `${def.id} -> ${def.spriteId}` });
      }
    }
  }

  const regressions = missing.filter((m) => m.kind !== 'boss').map((m) => m.ref);
  assert.deepEqual(
    regressions,
    [],
    `content referencing sprites that do not exist:\n  ${regressions.join('\n  ')}`,
  );

  const pending = missing.filter((m) => m.kind === 'boss');
  if (pending.length > 0) {
    // Printed rather than swallowed. This number is the honest measure of how finished the
    // game looks, so it belongs in the test output where it is seen on every run.
    console.log(`    note: ${pending.length} boss sprites unauthored, drawing as placeholders`);
  }
});

test('R-ART-002 / R-ITM-002: no two collectibles share a sprite', () => {
  const owners = new Map();
  const shared = [];
  for (const kind of ['passive', 'active', 'card', 'supplement', 'charm', 'transformation', 'weapon']) {
    for (const def of registry.all(kind)) {
      if (!def.spriteId) continue;
      if (owners.has(def.spriteId)) shared.push(`${def.spriteId}: ${owners.get(def.spriteId)} and ${def.id}`);
      else owners.set(def.spriteId, def.id);
    }
  }
  assert.deepEqual(shared, [], `collectibles sharing a sprite:\n  ${shared.join('\n  ')}`);
});

/*
 * Deliberately absent: a test that every hostile has two frames.
 *
 * It was written and then removed. Most of the shipped roster is single-frame, and nothing in
 * GDD 18.x asks for an idle animation — so the test was not finding a defect, it was inventing
 * a requirement and would have forced twenty sprites to be padded to satisfy it. Recorded here
 * so the next person does not add it back believing it was an oversight.
 */

test('a boss sprite is drawn at roughly the size of its hitbox', () => {
  const have = new Map(spriteDefs.map((d) => [d.id, d]));
  const wrong = [];
  for (const def of registry.all('boss')) {
    const sprite = have.get(def.spriteId);
    if (!sprite) continue;
    const grid = sprite.frames[0][0].length;
    const drawn = grid * bossSpriteScale({ def, radius: def.radius });
    const hitbox = def.radius * 2 * TILE;
    const ratio = drawn / hitbox;
    // Within a quarter either way. Exact equality is impossible — the scale is an integer
    // pixel multiple — but a boss drawn at half or double its hitbox is a fight the player
    // cannot read, and that is what this catches.
    if (ratio < 0.75 || ratio > 1.25) {
      wrong.push(`${def.id} draws ${drawn}px for a ${hitbox}px body (${(ratio * 100).toFixed(0)}%)`);
    }
  }
  assert.deepEqual(wrong, [], `bosses whose art does not match their body:\n  ${wrong.join('\n  ')}`);
});

test('R-VIS-002: no two hostiles in the same department share a silhouette description', () => {
  // A weak proxy for the real requirement — a human still has to look — but it catches the
  // failure mode of authoring twelve enemies by copying one entry and changing the palette.
  const have = new Map(spriteDefs.map((d) => [d.id, d]));
  const byText = new Map();
  const dupes = [];
  for (const def of registry.all('enemy')) {
    const text = have.get(def.spriteId)?.silhouette;
    if (!text) continue;
    const key = text.trim().toLowerCase();
    if (byText.has(key)) dupes.push(`${byText.get(key)} and ${def.id}: "${text}"`);
    else byText.set(key, def.id);
  }
  assert.deepEqual(dupes, [], `enemies described identically:\n  ${dupes.join('\n  ')}`);
});
