/**
 * Door traversal and player-agency tests.
 *
 * GDD refs: R-QA-001 (no soft locks: the automated floor suite finds no
 *           unrecoverable normal progression state),
 *           11.2 (a door edge is a property of the graph), 12.3 (door classes, sealing,
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

// ---------------------------------------------------------------------------
// Reaching a door, not merely standing where one is
// ---------------------------------------------------------------------------

test('the player can get close enough to every door to trigger it', async () => {
  // The tests above proved a doorway is *walkable*. This proves it is *reachable*.
  //
  // clampToRoom() pins the player inside the interior grid every frame as a last-resort
  // guard. But NORTH and WEST door trigger points sit half a unit OUTSIDE that grid, so
  // the closest a 0.42-radius player could get was 0.92 — just past the 0.90 trigger
  // radius. Every north and west door in the game was untriggerable, and a dead-end room
  // whose single door faced either way was a permanent trap.
  const { clampToRoom } = await import('../src/systems/physics.js');
  const { DOOR_TRIGGER_RADIUS } = await import('../src/main.js');

  const worst = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
  for (const seed of SEEDS) {
    for (const room of roomsOf(floorFor(seed))) {
      for (const [, pos] of room.doorWorldPositions) {
        if (!pos.door.discovered) continue;
        // Aim straight at the door, then apply the same clamp the movement pass applies.
        const probe = { x: pos.x, y: pos.y, radius: PLAYER_RADIUS };
        clampToRoom(probe, room.collision);
        const gap = Math.hypot(probe.x - pos.x, probe.y - pos.y);
        if (gap > worst[pos.side]) worst[pos.side] = gap;
      }
    }
  }
  for (const [side, gap] of Object.entries(worst)) {
    assert.ok(
      gap < DOOR_TRIGGER_RADIUS,
      `${side} doors sit ${gap.toFixed(3)} beyond reach, trigger radius is ${DOOR_TRIGGER_RADIUS}`,
    );
  }
});

test('the clamp still keeps the player inside the room', async () => {
  // Widening the clamp to let the player into a doorway must not let them wander into the
  // void. Movement collision is the real containment — the clamp is only a safety net —
  // so a position well outside the room must still be pulled back to somewhere legal.
  const { clampToRoom } = await import('../src/systems/physics.js');
  for (const room of roomsOf(floorFor('OFFICE-DOOR-0001'))) {
    const far = { x: room.rect.x - 50, y: room.rect.y - 50, radius: PLAYER_RADIUS };
    clampToRoom(far, room.collision);
    assert.ok(far.x > room.rect.x - 5, `clamp let the player ${room.rect.x - far.x} units west of the room`);
    assert.ok(far.y > room.rect.y - 5, `clamp let the player ${room.rect.y - far.y} units north of the room`);
  }
});

test('a single-door room can always be left once it is clear', async () => {
  // The reported symptom, asserted directly: walk into every dead-end room, clear it, walk
  // back at the door, and require the run to move to another node.
  const game = await bootGame('OFFICE-DEADEND-0001');
  const floor = game.run.floor;
  const deadEnds = [...floor.nodes.values()].filter((n) => (n.doors || []).length === 1);
  assert.ok(deadEnds.length > 0, 'this seed produced no dead-end rooms');

  let checked = 0;
  for (const node of deadEnds) {
    const door = node.doors[0];
    // An undiscovered secret door is correctly impassable until it is blasted open
    // (GDD 11.7). Such a room cannot be entered in the first place, so it is not a trap.
    if (!door.discovered) continue;
    game.run.enterRoom(node, door.socketId);
    const room = game.run.room;
    // Clear it, so doors are open and the seal is not what we are measuring.
    node.cleared = true;
    game.roomController.enter(room, { fromSocketId: door.socketId });
    game.runtime.despawnAll();
    game.doorCooldown = 0;

    const pos = room.doorWorldPositions.get(door.socketId);
    assert.ok(pos, `${node.id} has no world position for its only door`);

    // Stand as close to the door as the movement clamp permits, then run the door pass.
    const { clampToRoom } = await import('../src/systems/physics.js');
    game.run.player.x = pos.x;
    game.run.player.y = pos.y;
    clampToRoom(game.run.player, room.collision);

    const before = game.run.roomNode.id;
    game.checkDoorsForTest();
    assert.notEqual(
      game.run.roomNode.id, before,
      `${node.id}: standing at its only ${pos.side} door did not traverse it`,
    );
    checked += 1;
  }
  assert.ok(checked > 0);
});

// ---------------------------------------------------------------------------
// Containment and presentation
// ---------------------------------------------------------------------------

test('R-CMB-006: no hostile can leave the room it is fighting in', async () => {
  // Reported as a sliding enemy going out of bounds. Controllers move through collision,
  // but several paths write position directly — blink targets, boss movement rules, pulls —
  // and an enemy outside the room is unkillable and blocks the clear forever.
  //
  // Sweeps every enemy in the game, not just the ones current encounters happen to use:
  // encounter data reaches 58 of them now, but a controller bug would still hide in the
  // ones a given seed skips.
  const { CombatResolver } = await import('../src/systems/combat.js');
  const { EncounterRuntime } = await import('../src/systems/encounter-runtime.js');

  const escapes = [];
  for (const def of registry.all('enemy')) {
    const events = new EventBus();
    const run = new Run({ registry, events });
    run.start({ seed: `OFFICE-BOUND-${def.id.slice(4)}` });
    const combat = new CombatResolver({ registry, events, getRun: () => run });
    const runtime = new EncounterRuntime({ registry, events, combat, getRun: () => run });

    const node = [...run.floor.nodes.values()].find((n) => n.role === 'ROOM-002')
      ?? [...run.floor.nodes.values()][0];
    const room = buildRoom({ floor: run.floor, node, registry, rngSource: run.rng });
    run.player.x = room.centre.x;
    run.player.y = room.centre.y;

    const enemy = runtime.spawnOne(def.id, room);
    if (!enemy) continue;
    runtime.activated = true;

    // Shove it hard every few frames, from a rotating direction. This is the case the
    // clamp exists for: knockback and pulls that write velocity or position directly.
    for (let i = 0; i < 900; i += 1) {
      if (i % 20 === 0) {
        const a = (i / 20) * 1.1;
        enemy.velocity.x = Math.cos(a) * 40;
        enemy.velocity.y = Math.sin(a) * 40;
      }
      runtime.update(1 / 60);
      if (enemy.dead) break;
      const lx = enemy.x - room.collision.origin.x;
      const ly = enemy.y - room.collision.origin.y;
      const out = Math.max(-lx, -ly, lx - room.collision.w, ly - room.collision.h);
      if (out > 1.5) {
        escapes.push(`${def.id} escaped ${out.toFixed(2)} units past the wall`);
        break;
      }
    }
  }
  assert.deepEqual(escapes.slice(0, 10), [], `${escapes.length} enemies left the room`);
});

test('a spent projectile leaves exactly one permanent mark, and the count is bounded', async () => {
  const game = await bootGame('OFFICE-MARKS-0001');
  const room = game.run.room;
  room.spentMarks = [];
  room.spentMarkNext = 0;

  // Fire a lot, letting every shot live out its full lifetime.
  const sampled = { firing: true, aimDirection: 'EAST', aimAngle: 0, move: { x: 0, y: 0 }, pressed: new Set() };
  for (let i = 0; i < 2400; i += 1) {
    game.playerAttack.update(1 / 60, sampled);
    game.runtime.update(1 / 60);
  }

  assert.ok(room.spentMarks.length > 0, 'no projectile left a mark');
  // R-TEC-003: bounded per room. Past the cap the oldest is recycled rather than the list
  // growing forever, so both the draw cost and the save payload stay finite.
  assert.ok(room.spentMarks.length <= 400, `${room.spentMarks.length} marks exceeds the cap`);
  for (const m of room.spentMarks) {
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y), 'mark has a non-finite position');
    assert.equal(typeof m.hostile, 'boolean');
  }
});

test('the fall phase is presentation only: it never moves the projectile', async () => {
  // The arc toward the floor is applied at draw time. If it leaked into the projectile's
  // real position, every weapon would quietly lose range and drift downward on impact.
  const game = await bootGame('OFFICE-FALL-0001');
  const sampled = { firing: true, aimDirection: 'EAST', aimAngle: 0, move: { x: 0, y: 0 }, pressed: new Set() };
  game.playerAttack.update(1 / 60, sampled);

  let seenFalling = false;
  for (let i = 0; i < 240; i += 1) {
    game.runtime.update(1 / 60);
    game.runtime.projectiles.pool.forEach((p) => {
      if (p.__dead) return;
      // fall is a 0..1 presentation value...
      assert.ok(p.fall >= 0 && p.fall <= 1, `fall out of range: ${p.fall}`);
      if (p.fall > 0) {
        seenFalling = true;
        // ...and a horizontally-fired shot must keep travelling horizontally.
        assert.ok(Number.isFinite(p.y), 'fall corrupted the projectile position');
      }
    });
  }
  assert.equal(seenFalling, true, 'no projectile ever entered its fall phase');
});

// ---------------------------------------------------------------------------
// R-CMB-006: a sealed room must always be finishable
// ---------------------------------------------------------------------------

async function combatFixture(seed) {
  const { CombatResolver } = await import('../src/systems/combat.js');
  const { EncounterRuntime } = await import('../src/systems/encounter-runtime.js');
  const { RoomController } = await import('../src/systems/room-state.js');
  const { LootService } = await import('../src/systems/loot.js');

  const events = new EventBus();
  const run = new Run({ registry, events });
  run.start({ seed });
  const combat = new CombatResolver({ registry, events, getRun: () => run });
  const runtime = new EncounterRuntime({ registry, events, combat, getRun: () => run });
  const loot = new LootService({ registry, events, getRun: () => run });
  // Exactly as src/main.js wires it, so a wiring bug shows up here.
  const controller = new RoomController({
    events, rng: run.rng, registry, spawner: runtime, rewards: loot,
  });
  return { events, run, runtime, controller };
}

test('R-CMB-006: a cloaked ambusher cannot keep a room sealed forever', async () => {
  // The reported soft lock. CloakUntilNear hides an enemy until the player comes within
  // three units, and a cloaked enemy is not drawn — so an ambusher nobody walked near left
  // the player sealed in a room that looked completely empty, with no way out.
  const { controller, runtime, run } = await combatFixture('OFFICE-CLOAK-0001');
  const { buildRoom: build } = await import('../src/systems/room-build.js');

  const node = [...run.floor.nodes.values()].find((n) => n.encounterId);
  assert.ok(node, 'seed produced no combat room');
  const room = build({ floor: run.floor, node, registry, rngSource: run.rng });
  controller.enter(room, { fromSocketId: node.doors[0]?.socketId });

  // Force the worst case: everything in the room is cloaked, and the player stands in a
  // corner far away and never moves.
  for (const enemy of runtime.hostiles) {
    enemy.cloaked = true;
    enemy.cloakSeconds = 0;
    enemy.modules = [{
      spec: (await import('../src/entities/enemy-controllers.js')).getBehaviorModule('CloakUntilNear'),
      params: { revealRadius: 3 },
    }].filter((m) => m.spec);
  }
  run.player.x = room.rect.x + 1.5;
  run.player.y = room.rect.y + 1.5;

  let revealed = false;
  for (let i = 0; i < 900 && !revealed; i += 1) {
    controller.tick(1 / 60, { hostiles: runtime.hostiles, player: run.player });
    runtime.update(1 / 60);
    revealed = runtime.hostiles.some((e) => !e.dead && !e.cloaked);
  }
  assert.equal(revealed, true, 'a cloaked enemy never revealed itself; the room stays sealed');
});

test('R-CMB-006: a sealed room releases itself rather than trapping the player', async () => {
  // The unconditional failsafe. Whatever the cause — an enemy wedged in geometry, a
  // behaviour that never resolves, something not yet diagnosed — a player with no move left
  // is the one state the game must never reach.
  const { controller, runtime, run } = await combatFixture('OFFICE-DEADLOCK-0001');
  const { buildRoom: build } = await import('../src/systems/room-build.js');

  const node = [...run.floor.nodes.values()].find((n) => n.encounterId);
  const room = build({ floor: run.floor, node, registry, rngSource: run.rng });
  controller.enter(room, { fromSocketId: node.doors[0]?.socketId });

  // Make the room genuinely unclearable: invulnerable, immobile, and never damaged.
  for (const enemy of runtime.hostiles) {
    enemy.invulnerable = true;
    enemy.modules = [];
    enemy.baseSpeed = 0;
  }

  let sealedFrames = 0;
  for (let i = 0; i < 60 * 40; i += 1) {
    controller.tick(1 / 60, { hostiles: runtime.hostiles, player: run.player });
    if (!controller.isSealed) break;
    sealedFrames += 1;
  }
  assert.equal(controller.isSealed, false, 'the room never released; the player is trapped');
  // It must not fire so eagerly that a real fight trips it. 25s is the configured window.
  assert.ok(sealedFrames > 60 * 20, `released after only ${(sealedFrames / 60).toFixed(1)}s`);
});

test('the failsafe does not fire while the player is making progress', async () => {
  // The counterpart guard. Killing something resets the timer, so a long hard fight is
  // never mistaken for a stuck room.
  const { controller, runtime, run } = await combatFixture('OFFICE-PROGRESS-0001');
  const { buildRoom: build } = await import('../src/systems/room-build.js');

  const node = [...run.floor.nodes.values()].find((n) => n.encounterId);
  const room = build({ floor: run.floor, node, registry, rngSource: run.rng });
  controller.enter(room, { fromSocketId: node.doors[0]?.socketId });
  const total = runtime.hostiles.length;
  assert.ok(total >= 2, 'need at least two enemies to show progress');

  // Kill one enemy every 15 seconds: slower than the fight would normally go, but always
  // progressing. The room must stay sealed until the last one dies.
  let killed = 0;
  for (let i = 0; i < 60 * 15 * (total - 1); i += 1) {
    controller.tick(1 / 60, { hostiles: runtime.hostiles, player: run.player });
    if (i % (60 * 15) === 0 && killed < total - 1) {
      const victim = runtime.hostiles.find((e) => !e.dead);
      if (victim) { victim.dead = true; killed += 1; }
    }
    if (!controller.isSealed) break;
  }
  assert.ok(killed >= total - 1, 'test did not get to kill anything');
  assert.equal(
    runtime.hostiles.filter((e) => !e.dead && e.required).length, 1,
    'the failsafe released enemies the player was still working through',
  );
});

test('R-CMB-006: no room on any route can trap a player who never attacks', async () => {
  // The guarantee, swept rather than reasoned about. A player who never fires is the
  // pessimal case: nothing dies, so every timer that keys on progress is starved.
  //
  // This found two IT rooms the damage-based failsafe alone could not release — something
  // in them made total enemy health drift downward on its own, resetting the timer forever.
  // That is why there is also a hard cap nothing can reset.
  const { CombatResolver } = await import('../src/systems/combat.js');
  const { EncounterRuntime } = await import('../src/systems/encounter-runtime.js');
  const { RoomController } = await import('../src/systems/room-state.js');
  const { LootService } = await import('../src/systems/loot.js');

  const unlocks = registry.all('unlock').map((u) => u.id);
  const sealed = [];
  let rooms = 0;

  // The failsafes log loudly by design; silence them so a passing run is readable.
  const realError = console.error;
  console.error = () => {};
  try {
    for (const routeId of ['ROUTE-BASE', 'ROUTE-BOARD', 'ROUTE-OWNERSHIP']) {
      const events = new EventBus();
      const run = new Run({ registry, events });
      run.start({ seed: 'OFFICE-NOTRAP-0001', routeId, unlockFlags: unlocks });
      const combat = new CombatResolver({ registry, events, getRun: () => run });
      const runtime = new EncounterRuntime({ registry, events, combat, getRun: () => run });
      const loot = new LootService({ registry, events, getRun: () => run });
      const controller = new RoomController({
        events, rng: run.rng, registry, spawner: runtime, rewards: loot,
      });

      let step = 0;
      while (step < 20) {
        for (const node of run.floor.nodes.values()) {
          node.visited = false;
          node.cleared = false;
          let room;
          try {
            room = buildRoom({ floor: run.floor, node, registry, rngSource: run.rng });
          } catch { continue; }
          runtime.despawnAll();
          controller.enter(room, { fromSocketId: node.doors[0]?.socketId });
          rooms += 1;
          // Stand in a corner and do nothing at all.
          run.player.x = room.rect.x + 1.5;
          run.player.y = room.rect.y + 1.5;
          for (let i = 0; i < 60 * 90; i += 1) {
            controller.tick(1 / 60, { hostiles: runtime.hostiles, player: run.player });
            runtime.update(1 / 60);
            if (!controller.isSealed) break;
          }
          if (controller.isSealed) sealed.push(`${run.floorDef.id} ${node.id} (${controller.state})`);
        }
        if (!run.enterFloor(step + 1)) break;
        step += 1;
      }
    }
  } finally {
    console.error = realError;
  }

  assert.ok(rooms > 200, `only simulated ${rooms} rooms`);
  assert.deepEqual(sealed.slice(0, 8), [], `${sealed.length} rooms trapped the player`);
});
