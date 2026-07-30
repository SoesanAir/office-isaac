/**
 * Full-stack integration test: boots the real `Game` and plays it headlessly.
 *
 * GDD refs: 22.6 ("Run tests and a playable smoke test"), 6.1 (combat room
 *           lifecycle), 12.3 (door table: doors seal during combat and reopen on a
 *           clear), R-CMB-001 (no door stays locked after a valid clear, and no
 *           locked room can be bypassed), R-CMB-002 (grace interval before first
 *           damage), R-CMB-006 (no impossible clears), R-LOOP-005 (the exit does not
 *           force a transition), 20.5 (phase ordering), 20.7 (frame budget).
 *
 * Every other suite tests one system in isolation. This one exists because the bugs
 * that actually reached the player — a NaN camera, a player left at the origin, an
 * empty health bar — were all *wiring* bugs that each isolated system passed. So this
 * drives the same `Game` class the browser does, through the same scheduler, and
 * asserts the things a person would notice in the first thirty seconds.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { LOGICAL_WIDTH, LOGICAL_HEIGHT, SIM_DT } from '../src/core/constants.js';
import { SCREEN as SCREENS } from '../src/ui/menus.js';

const SCREEN_TITLE = SCREENS.TITLE;

// ---------------------------------------------------------------------------
// Minimal DOM so the renderer and sprite baker can run under node
// ---------------------------------------------------------------------------

function makeCtx() {
  const calls = { drawImage: 0, fillRect: 0, fillText: 0 };
  return {
    calls,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '', textAlign: 'left', textBaseline: 'top', imageSmoothingEnabled: false,
    canvas: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
    drawImage() { calls.drawImage += 1; },
    fillRect() { calls.fillRect += 1; },
    fillText() { calls.fillText += 1; },
    strokeRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    stroke() {}, fill() {}, arc() {}, rect() {}, clip() {}, save() {}, restore() {},
    translate() {}, scale() {}, setLineDash() {}, bezierCurveTo() {},
    createRadialGradient() { return { addColorStop() {} }; },
  };
}

/**
 * A canvas stub that looks like a canvas.
 *
 * Wraps the local context stub in the same surface the shared helper provides — listeners, a
 * dataset, a bounding rect — because the touch layer attaches to the canvas and a stub without
 * those quietly excluded the whole input path from this test. That is how an undefined canvas
 * reached production: the integration test constructs a real Game, so it *should* have caught it,
 * and only failed to because the stub was too thin to notice.
 */
function makeCanvas(w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT) {
  const ctx = makeCtx();
  const handlers = new Map();
  return {
    width: w,
    height: h,
    style: {},
    dataset: {},
    offsetWidth: w,
    offsetHeight: h,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener: (type, fn) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    dispatch: (type, event) => {
      for (const fn of handlers.get(type) || []) fn({ preventDefault() {}, ...event });
    },
    getContext: () => ctx,
    _ctx: ctx,
  };
}

function installDom() {
  // Keep main.js a module: importing it must not start a second live game.
  globalThis.__OI_NO_AUTOBOOT = true;
  if (globalThis.document?.__oiShim) return;
  globalThis.document = {
    __oiShim: true,
    readyState: 'complete',
    createElement: (tag) => {
      if (tag !== 'canvas') throw new Error(`unexpected createElement(${tag})`);
      return makeCanvas(1, 1);
    },
    getElementById: () => makeCanvas(),
    addEventListener() {},
  };
  globalThis.innerWidth = 1920;
  globalThis.innerHeight = 1080;
  // The input system attaches to globalThis; a no-op listener surface is enough
  // because the test drives input by writing frameInput directly.
  if (!globalThis.addEventListener) globalThis.addEventListener = () => {};
  if (!globalThis.removeEventListener) globalThis.removeEventListener = () => {};
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
}

/** Construct a real Game without starting the render loop. */
async function bootGame(seed = 'OFFICE-INTG-0001') {
  installDom();
  const { Game } = await import('../src/main.js');
  const game = new Game(makeCanvas());
  game.run.start({ seed });
  game.combat.installGuards?.();
  return game;
}

/** Advance the simulation, supplying an input state each tick. */
function step(game, seconds, input = null) {
  const ticks = Math.round(seconds / SIM_DT);
  for (let i = 0; i < ticks; i += 1) {
    // Bypass the real input device: the scheduler's INPUT phase overwrites
    // frameInput, so the override is applied after that phase has run.
    game.scheduler.byPhase.get(10)[0].fn(SIM_DT, game);
    if (input) game.frameInput = input;
    for (const [phase, systems] of game.scheduler.byPhase) {
      if (phase === 10) continue;
      for (const s of systems) s.fn(SIM_DT, game);
    }
    game.run.tick(SIM_DT);
    game.run.player.tick(SIM_DT);
    game.camera.update(SIM_DT, game.run.player);
  }
}

const IDLE_INPUT = {
  moveX: 0, moveY: 0, moveMagnitude: 0, firing: false, aimDirection: null,
  aimAngle: 0, aimRawX: 0, aimRawY: 0, pressed: new Set(), held: new Set(),
  justPressed: () => false, isHeld: () => false,
};

const FIRING_EAST = { ...IDLE_INPUT, firing: true, aimDirection: 'EAST', aimAngle: 0 };

// ---------------------------------------------------------------------------

test('the game boots, generates a floor, and places the player in the start room', async () => {
  const game = await bootGame();
  assert.equal(game.fatalError, null, `boot failed: ${game.fatalError?.message}`);
  assert.ok(game.run.floor.nodes.size >= 10);
  assert.equal(game.run.roomNode.role, 'ROOM-001');
  assert.ok(Number.isFinite(game.run.player.x) && Number.isFinite(game.run.player.y));
  // GDD 5.1: three full Composure icons on the default profile.
  assert.deepEqual(game.run.player.health.describeIcons().map((i) => i.state), ['FULL', 'FULL', 'FULL']);
});

test('a full frame renders and blits something', async () => {
  const game = await bootGame();
  game.render(0, SIM_DT);
  assert.ok(game.renderer.ctx.calls.drawImage > 0, 'nothing was drawn');
});

test('the simulation runs for several seconds without throwing', async () => {
  const game = await bootGame();
  assert.doesNotThrow(() => step(game, 3, IDLE_INPUT));
  assert.doesNotThrow(() => game.render(0, SIM_DT));
});

test('walking into a hostile room spawns enemies and seals the doors', async () => {
  const game = await bootGame('OFFICE-INTG-0042');
  // Find a room the encounter layer actually populates, and enter it directly.
  let found = null;
  for (const node of game.run.floor.nodes.values()) {
    if (node.role !== 'ROOM-002' && node.role !== 'ROOM-004') continue;
    game.run.enterRoom(node, null);
    step(game, 0.1, IDLE_INPUT);
    if (game.runtime.aliveCount > 0) { found = node; break; }
  }
  assert.ok(found, 'no room on this floor produced any hostiles');
  // GDD 12.3 / R-CMB-001: normal doors seal while the encounter is live.
  assert.equal(game.roomController.isSealed, true, 'doors did not seal for a live encounter');
  // R-CMB-002: nothing may damage the player during the grace window.
  assert.equal(game.run.player.health.composure, 6, 'player took damage inside the grace window');
});

test('R-CMB-002: staged enemies cannot act before the grace window elapses', async () => {
  const game = await bootGame('OFFICE-INTG-0042');
  for (const node of game.run.floor.nodes.values()) {
    if (node.role !== 'ROOM-002') continue;
    game.run.enterRoom(node, null);
    step(game, 0.05, IDLE_INPUT);
    if (game.runtime.aliveCount === 0) continue;
    // Immediately after entry every enemy is staged and inert.
    assert.ok(
      game.runtime.hostiles.every((h) => h.staged),
      'an enemy was already active during the grace window',
    );
    return;
  }
});

test('firing produces projectiles that damage enemies', async () => {
  const game = await bootGame('OFFICE-INTG-0042');
  let target = null;
  for (const node of game.run.floor.nodes.values()) {
    if (node.role !== 'ROOM-002' && node.role !== 'ROOM-004') continue;
    game.run.enterRoom(node, null);
    step(game, 1.5, IDLE_INPUT); // let the grace window pass
    if (game.runtime.aliveCount > 0) { target = node; break; }
  }
  assert.ok(target, 'no populated room found');

  const enemy = game.runtime.hostiles.find((h) => !h.dead);
  // Stand the player just west of the enemy and fire east into it.
  game.run.player.x = enemy.x - 2.2;
  game.run.player.y = enemy.y;
  const healthBefore = enemy.health;

  step(game, 1.2, FIRING_EAST);

  assert.ok(
    game.playerAttack.arcs.length > 0 || game.runtime.projectiles.count > 0 || enemy.health < healthBefore,
    'firing produced no projectile, arc, or damage',
  );
  assert.ok(enemy.health < healthBefore, `enemy took no damage (still ${enemy.health})`);
});

test('R-CMB-001: killing everything reopens the doors', async () => {
  const game = await bootGame('OFFICE-INTG-0042');
  let target = null;
  for (const node of game.run.floor.nodes.values()) {
    if (node.role !== 'ROOM-002' && node.role !== 'ROOM-004') continue;
    game.run.enterRoom(node, null);
    step(game, 1.5, IDLE_INPUT);
    if (game.runtime.aliveCount > 0) { target = node; break; }
  }
  assert.ok(target, 'no populated room found');
  assert.equal(game.roomController.isSealed, true);

  // Kill every required hostile outright, then let the lifecycle resolve.
  for (const enemy of game.runtime.hostiles) {
    game.runtime.damageEnemy(enemy, { amount: 99999, tags: ['PROJECTILE'], sourceId: 'test' });
  }
  step(game, 1.5, IDLE_INPUT);

  assert.equal(game.runtime.requiredAlive, 0, 'required enemies survived a lethal hit');
  // No door may stay locked after a valid clear.
  assert.equal(game.roomController.isSealed, false, 'doors stayed sealed after the clear');
  assert.equal(game.run.roomNode.cleared, true, 'the node was not marked cleared');
});

test('a cleared room stays cleared and does not respawn on re-entry', async () => {
  const game = await bootGame('OFFICE-INTG-0042');
  let target = null;
  for (const node of game.run.floor.nodes.values()) {
    if (node.role !== 'ROOM-002') continue;
    game.run.enterRoom(node, null);
    step(game, 1.5, IDLE_INPUT);
    if (game.runtime.aliveCount > 0) { target = node; break; }
  }
  assert.ok(target, 'no populated room found');
  for (const enemy of game.runtime.hostiles) {
    game.runtime.damageEnemy(enemy, { amount: 99999, tags: ['PROJECTILE'], sourceId: 'test' });
  }
  step(game, 1.5, IDLE_INPUT);
  assert.equal(target.cleared, true);

  // Leave and come back. GDD 12.3: a cleared room's doors stay open on revisit.
  const start = game.run.floor.nodes.get(game.run.floor.startNodeId);
  game.run.enterRoom(start, null);
  step(game, 0.5, IDLE_INPUT);
  game.run.enterRoom(target, null);
  step(game, 1.0, IDLE_INPUT);

  assert.equal(game.runtime.aliveCount, 0, 'a cleared room respawned its encounter');
  assert.equal(game.roomController.isSealed, false, 'a cleared room re-sealed its doors');
});

test('GDD 20.7: a simulation tick stays well inside the frame budget', async () => {
  const game = await bootGame('OFFICE-INTG-0042');
  // Put the player in the busiest room available so the measurement is honest.
  for (const node of game.run.floor.nodes.values()) {
    if (node.role !== 'ROOM-004' && node.role !== 'ROOM-002') continue;
    game.run.enterRoom(node, null);
    step(game, 1.5, IDLE_INPUT);
    if (game.runtime.aliveCount >= 3) break;
  }
  const started = Date.now();
  const ticks = 600; // ten seconds of simulation
  step(game, ticks * SIM_DT, FIRING_EAST);
  const perTick = (Date.now() - started) / ticks;
  // The budget is 16.67ms for simulation AND render; simulation alone should be a
  // small fraction of it.
  assert.ok(perTick < 4, `simulation cost ${perTick.toFixed(2)}ms per tick`);
});

test('the player can die, and death freezes further mutation', async () => {
  const game = await bootGame();
  const player = game.run.player;
  game.combat.damagePlayer(player, { amount: 99, tags: ['SACRIFICE'], sourceId: 'test' });
  assert.equal(player.health.isDead, true);
  // GDD 5.3 step 6: the death sequence freezes further pickup or room-state mutation,
  // so continuing to tick must not throw or revive anything.
  assert.doesNotThrow(() => step(game, 1.0, FIRING_EAST));
  assert.equal(player.health.isDead, true);
});

// ---------------------------------------------------------------------------
// The phone path, end to end
// ---------------------------------------------------------------------------

/**
 * A real Game, driven only by touch, on a simulated phone.
 *
 * This is the test that was missing. Three separate defects shipped together and made the game
 * completely unplayable on a phone — no visible controls, nothing moved — and every one of them
 * lived in a seam that unit tests do not cover:
 *
 *   1. main.js passed `this.canvas`, which was never assigned, so TouchControls.attach received
 *      undefined and bound no listeners.
 *   2. The overlay only became visible after a touch it could never receive.
 *   3. Menus were driven by CONFIRM alone, and touch has no CONFIRM button, so the title screen
 *      was a dead end.
 *
 * Each unit passed its own tests. What nothing checked was whether a finger on the glass could
 * start a run and move the player, so that is what this checks.
 */
test('a phone can start a run and move the player with touch alone', async () => {
  const previousMatchMedia = globalThis.matchMedia;
  // Report a coarse pointer, which is what makes the overlay live from the first frame.
  globalThis.matchMedia = (q) => ({ matches: q.includes('coarse') });
  try {
    installDom();
    const { Game } = await import('../src/main.js');
    const canvas = makeCanvas();
    const game = new Game(canvas);

    // Listeners actually bound. This is the assertion the original bug would have failed.
    assert.equal(game.touch.canvas, canvas, 'touch must be attached to the real canvas');
    assert.equal(game.touch.active, true, 'the overlay must be live on a touch device');

    // The game opens on the title screen, exactly as a player finds it.
    game.menus.open(SCREEN_TITLE);
    game.menus.touchActive = true;
    game.menus.draw();
    const rows = game.menus.rowHitboxes;
    const items = game.menus.items();
    const newRun = items.findIndex((i) => i.label === 'New run');
    const box = rows.find((r) => r.index === newRun);
    assert.ok(box, 'New run must be a drawn, tappable row');

    // Tap it. On a phone this is the only way in.
    game.menus.touchAt(LOGICAL_WIDTH / 2, (box.top + box.bottom) / 2, 'DOWN');
    assert.equal(game.menus.blocksGameplay, false, 'tapping New run should leave the menus');
    assert.ok(game.run?.player, 'a run should be live');

    // Now drive the player with the left thumb stick and nothing else.
    const player = game.run.player;
    const startX = player.x;
    canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 400 });
    canvas.dispatch('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 320, clientY: 400 });

    for (let i = 0; i < 40; i += 1) game.update(SIM_DT);

    assert.ok(
      player.x > startX + 0.2,
      `the player should have moved right; x went ${startX.toFixed(2)} -> ${player.x.toFixed(2)}`,
    );
  } finally {
    if (previousMatchMedia) globalThis.matchMedia = previousMatchMedia;
    else delete globalThis.matchMedia;
  }
});
