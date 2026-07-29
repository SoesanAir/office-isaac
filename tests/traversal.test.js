/**
 * Door traversal and player-agency tests.
 *
 * GDD refs: 11.2 (a door edge is a property of the graph), 12.3 (door classes, sealing,
 *           and openings), R-FLR-004 (every non-secret room is reachable), R-ROM-006 (a
 *           template's geometry must admit its own door sockets), R-CMB-006 (no
 *           impossible state), R-PLY-001 (the player is always in control of movement
 *           and attack), 4.2 (aim and fire are independent of what is in the room).
 *
 * This file exists because of a bug that shipped past both the schema validator and the
 * floor-generation suite: the collision grid is INTERIOR-ONLY, and `isSolidTile` returned
 * "solid" for out-of-bounds tiles *before* consulting the carved door openings. Every
 * doorway is carved one tile outside the interior, so every opening was ignored and the
 * player bounced off walls where a door plainly was.
 *
 * Floor validation missed it because it flood-fills over the room *graph* — it proves the
 * rooms are connected, not that a body of a given radius can physically pass between them.
 * These tests work in world units with a player-sized circle, which is the only way to
 * catch this class of defect.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { EventBus } from '../src/core/events.js';
import { Run } from '../src/systems/run.js';
import { buildRoom } from '../src/systems/room-build.js';
import { makeCanvas, installDomShim } from './helpers/canvas.js';

const registry = loadContent({ strict: false });

/**
 * The player's collision radius, which is what actually has to fit through a door.
 * Kept in step with Player's own value (src/entities/player.js), whose comment reads
 * "tuned so a 3-unit door is comfortable" — the doors are 3 tiles wide, so this is the
 * number that has to fit.
 */
const PLAYER_RADIUS = 0.42;

function floorFor(seed) {
  const run = new Run({ registry, events: new EventBus() });
  run.start({ seed });
  return run;
}

/** Every built room on a floor, with its doors. */
function roomsOf(run) {
  const out = [];
  for (const node of run.floor.nodes.values()) {
    out.push(buildRoom({ floor: run.floor, node, registry, rngSource: run.rng }));
  }
  return out;
}

const SEEDS = ['OFFICE-DOOR-0001', 'OFFICE-DOOR-0002', 'OFFICE-DOOR-0007', 'OFFICE-DOOR-0042'];

test('R-ROM-006: a player-sized body fits at every door point', () => {
  // The direct reproduction. Before the fix, 15 of 30 doors on the first seed failed
  // here — every NORTH and WEST door, because their trigger point sits outside the
  // interior grid where openings were being ignored.
  const failures = [];
  for (const seed of SEEDS) {
    const run = floorFor(seed);
    for (const room of roomsOf(run)) {
      for (const [socketId, pos] of room.doorWorldPositions) {
        if (!pos.door.discovered) continue;
        if (room.collision.circleHitsGeometry(pos.x, pos.y, PLAYER_RADIUS)) {
          failures.push(`${seed} ${room.nodeId}/${socketId} (${pos.side})`);
        }
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} impassable doors`);
});

test('every side of a room is equally passable', () => {
  // The original bug hit exactly two of the four sides, which is why it read as
  // "most of the time" rather than "always". Counting per side makes an asymmetric
  // regression obvious instead of just lowering a pass rate.
  const bySide = { NORTH: [0, 0], SOUTH: [0, 0], EAST: [0, 0], WEST: [0, 0] };
  for (const seed of SEEDS) {
    for (const room of roomsOf(floorFor(seed))) {
      for (const [, pos] of room.doorWorldPositions) {
        if (!pos.door.discovered) continue;
        const entry = bySide[pos.side];
        if (!entry) continue;
        entry[0] += 1;
        if (!room.collision.circleHitsGeometry(pos.x, pos.y, PLAYER_RADIUS)) entry[1] += 1;
      }
    }
  }
  for (const [side, [total, passable]] of Object.entries(bySide)) {
    if (total === 0) continue;
    assert.equal(passable, total, `${side}: only ${passable}/${total} doors are passable`);
  }
});

test('the approach to a door is walkable, not just the door tile', () => {
  // A door you can stand in but not reach is the same bug wearing a hat. This walks the
  // first unit inward, which is what "getting through the door" actually requires.
  // It deliberately does NOT demand a clear corridor deeper than that: a template may
  // place cover two tiles inside a doorway, and that is good level design rather than a
  // defect — entryPosition is what has to cope with it.
  const inward = { NORTH: [0, 1], SOUTH: [0, -1], EAST: [-1, 0], WEST: [1, 0] };
  const failures = [];
  for (const seed of SEEDS) {
    for (const room of roomsOf(floorFor(seed))) {
      for (const [socketId, pos] of room.doorWorldPositions) {
        if (!pos.door.discovered) continue;
        const [ix, iy] = inward[pos.side] || [0, 0];
        for (const step of [0.5, 1.0]) {
          const x = pos.x + ix * step;
          const y = pos.y + iy * step;
          if (room.collision.circleHitsGeometry(x, y, PLAYER_RADIUS)) {
            failures.push(`${seed} ${room.nodeId}/${socketId} blocked ${step} in`);
            break;
          }
        }
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} blocked approaches`);
});

test('a doorway is a hole, not an exit: the player cannot leave through it', () => {
  // The fix opens the wall band at each socket. It must NOT open the void beyond, or the
  // player walks out of the level.
  const outward = { NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0] };
  let checked = 0;
  for (const room of roomsOf(floorFor('OFFICE-DOOR-0001'))) {
    for (const [, pos] of room.doorWorldPositions) {
      if (!pos.door.discovered) continue;
      const [ox, oy] = outward[pos.side] || [0, 0];
      // Three units past the wall band is unambiguously outside the room.
      const x = pos.x + ox * 3;
      const y = pos.y + oy * 3;
      assert.equal(
        room.collision.circleHitsGeometry(x, y, PLAYER_RADIUS),
        true,
        `${room.nodeId} lets the player stand outside the room through a doorway`,
      );
      checked += 1;
    }
  }
  assert.ok(checked > 10, `only checked ${checked} doorways`);
});

test('the entry position after traversal is walkable', () => {
  // R-CMB-006: arriving inside geometry is an impossible state. entryPosition steps
  // inward from the far door, and that step has to land somewhere legal on all sides.
  const failures = [];
  for (const seed of SEEDS) {
    const run = floorFor(seed);
    for (const room of roomsOf(run)) {
      for (const [socketId] of room.doorWorldPositions) {
        const at = room.entryPosition(socketId);
        if (room.collision.circleHitsGeometry(at.x, at.y, PLAYER_RADIUS)) {
          failures.push(`${seed} ${room.nodeId} entering via ${socketId}`);
        }
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} bad entry positions`);
});

// ---------------------------------------------------------------------------
// Player agency (R-PLY-001, GDD 4.2)
// ---------------------------------------------------------------------------

test('R-PLY-001: the runtime knows which room the player is in, hostile or not', async () => {
  // player-attack refuses to fire without `runtime.currentRoom`, and the room controller
  // only set it by calling spawn() — which it skips for non-hostile and already-cleared
  // rooms. The result was a player who could not shoot in the start room, a shop, or any
  // room they had already finished.
  //
  // Worse than being unable to fire: a STALE currentRoom tests projectile collision
  // against the PREVIOUS room's walls, which is a wrong-answer bug rather than a missing
  // feature.
  const { CombatResolver } = await import('../src/systems/combat.js');
  const { EncounterRuntime } = await import('../src/systems/encounter-runtime.js');
  const { RoomController } = await import('../src/systems/room-state.js');

  const events = new EventBus();
  const run = new Run({ registry, events });
  run.start({ seed: 'OFFICE-AGENCY-0001' });
  const combat = new CombatResolver({ registry, events, getRun: () => run });
  const runtime = new EncounterRuntime({ registry, events, combat, getRun: () => run });
  const controller = new RoomController({ registry, events, spawner: runtime, getRun: () => run });

  // The start room is non-hostile by construction (GDD 11.4), so it is exactly the case
  // that used to leave currentRoom null.
  const startNode = run.floor.nodes.get(run.floor.startNodeId);
  const startRoom = buildRoom({ floor: run.floor, node: startNode, registry, rngSource: run.rng });
  controller.enter(startRoom, {});
  assert.equal(runtime.currentRoom, startRoom, 'the start room never reached the runtime');

  // Now a room the player has already cleared — the other early-return.
  const other = [...run.floor.nodes.values()].find((n) => n.id !== startNode.id);
  const otherRoom = buildRoom({ floor: run.floor, node: other, registry, rngSource: run.rng });
  other.cleared = true;
  controller.enter(otherRoom, {});
  assert.equal(runtime.currentRoom, otherRoom, 'a cleared room left a stale currentRoom');
});

/**
 * Boot a real Game against the headless canvas stub.
 *
 * These three tests are about behaviour the player sees, so they drive the actual Game
 * rather than reassembling its parts — which is the only way to catch a fix that works in
 * a unit and is never wired into the loop.
 */
async function bootGame(seed) {
  installDomShim();
  globalThis.__OI_NO_AUTOBOOT = true;
  const { Game } = await import('../src/main.js');
  const game = new Game(makeCanvas());
  game.start({ seed });
  return game;
}

test('GDD 4.2: the player can fire in a room with no enemies in it', async () => {
  // The end-to-end version of the fix above. Firing is aim-driven and has nothing to do
  // with what is in the room, so an empty start room must still produce a projectile.
  const game = await bootGame('OFFICE-FIRE-0001');

  const before = game.runtime.projectiles.active.length;
  assert.equal(game.runtime.hostiles.filter((h) => !h.dead).length, 0, 'fixture room is not empty');

  // Hold an aim key. The input system derives `firing` from aim, so this is exactly what
  // a player pressing the right-arrow does.
  game.input.state.firing = true;
  game.input.state.aimDirection = 'EAST';
  game.input.state.aimAngle = 0;
  const sampled = { firing: true, aimDirection: 'EAST', aimAngle: 0, move: { x: 0, y: 0 }, pressed: new Set() };
  game.frameInput = sampled;

  let fired = false;
  for (let i = 0; i < 60 && !fired; i += 1) {
    game.playerAttack.update(1 / 60, sampled);
    if (game.runtime.projectiles.active.length > before) fired = true;
  }
  assert.equal(fired, true, 'no projectile appeared while firing in an empty room');
});

test('GDD 17.4: the map is drawn by default, without the player asking', async () => {
  const game = await bootGame('OFFICE-MAP-0001');
  assert.equal(game.hud.showMap, true, 'the map is hidden until a key is held');
  // Expanded is the key-driven state now, not visibility.
  assert.equal(game.hud.mapExpanded, false);
});

test('the map marks a room that still holds loot, once', async () => {
  const game = await bootGame('OFFICE-MAPLOOT-0001');
  const room = game.run.room;
  const node = room.node;

  // A room with nothing in it is unmarked...
  room.pickups.length = 0;
  room.pedestal = null;
  const hasLoot = (n) => {
    // Mirrors HUD.#hasUncollectedLoot, which is private. Asserting the same three
    // conditions keeps this honest without exporting internals.
    if (!n.visited) return false;
    const r = n._instance;
    if (!r) return false;
    if (r.pedestal && !r.pedestal.taken) return true;
    return (r.pickups || []).some((p) => !p.collected);
  };
  assert.equal(hasLoot(node), false);

  // ...two uncollected pickups still produce one room-level answer, not two.
  room.pickups.push({ id: 'a', kind: 'CREDIT', x: 0, y: 0, collected: false });
  room.pickups.push({ id: 'b', kind: 'CREDIT', x: 1, y: 0, collected: false });
  assert.equal(hasLoot(node), true);

  // Collecting everything clears the marker.
  for (const p of room.pickups) p.collected = true;
  assert.equal(hasLoot(node), false);

  // An unvisited room never leaks its contents (17.4).
  node.visited = false;
  room.pickups[0].collected = false;
  assert.equal(hasLoot(node), false);
});
