/**
 * Headless render smoke test.
 *
 * GDD refs: 23.1 (Integration and Visual/readability test layers), 22.6 (a feature
 *           is not done without a playable smoke test), R-CAM-001/002 (the camera
 *           frames the room), R-ART-001 (sprites readable at native scale).
 *
 * Why this exists: `beginFrame()` clears the canvas to near-black, so *any*
 * exception thrown later in a frame leaves the player looking at a black screen
 * with no error visible in the game itself. That failure mode is indistinguishable
 * from a camera bug by eye, so it needs a test that actually runs the render path
 * for every room of a real generated floor and fails loudly on a throw.
 *
 * The canvas is a recording stub rather than a real one: this asserts that the
 * render path completes and draws where it claims to, not that pixels look right.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { EventBus } from '../src/core/events.js';
import { Run } from '../src/systems/run.js';
import { Camera } from '../src/render/camera.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT, TILE } from '../src/core/constants.js';

/** Minimal 2D context recorder. Records draw calls; ignores appearance. */
function makeContext() {
  const calls = { drawImage: 0, fillRect: 0, fillText: 0, strokeRect: 0, arc: 0 };
  const ctx = {
    canvas: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    imageSmoothingEnabled: false,
    calls,
    drawImage(...args) { calls.drawImage += 1; calls.lastDrawImage = args.slice(1); },
    fillRect() { calls.fillRect += 1; },
    strokeRect() { calls.strokeRect += 1; },
    fillText() { calls.fillText += 1; },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    arc() { calls.arc += 1; },
    rect() {}, clip() {}, save() {}, restore() {}, translate() {}, scale() {},
    setLineDash() {},
    createRadialGradient() { return { addColorStop() {} }; },
    bezierCurveTo() {},
  };
  return ctx;
}

/** Stub canvas element good enough for both the renderer and sprite baking. */
function makeCanvas(width = LOGICAL_WIDTH, height = LOGICAL_HEIGHT) {
  const ctx = makeContext();
  return {
    width,
    height,
    style: {},
    getContext: () => ctx,
    _ctx: ctx,
  };
}

/**
 * Install a `document.createElement('canvas')` shim so sprite baking and the
 * renderer's offscreen room bake work without a browser.
 */
function installDomShim() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error(`unexpected createElement(${tag})`);
      return makeCanvas(1, 1);
    },
  };
  globalThis.innerWidth = 1920;
  globalThis.innerHeight = 1080;
}

async function makeGame(seed) {
  installDomShim();
  const { Renderer } = await import('../src/render/renderer.js');
  const { Hud } = await import('../src/ui/hud.js');
  const registry = loadContent({ strict: false });
  const events = new EventBus();
  const run = new Run({ registry, events });
  const camera = new Camera();
  const canvas = makeCanvas();
  const renderer = new Renderer(canvas, { camera });
  const hud = new Hud({ renderer, registry, loc: (k) => k });
  events.on('room:entered', () => {
    if (run.room) camera.setRoom(run.room.rect, run.player);
  });
  run.start({ seed });
  return { run, camera, renderer, hud, canvas, registry };
}

/** Run one full frame the way main.js does. Throws if any draw call throws. */
function renderFrame({ run, renderer, hud, camera }) {
  renderer.beginFrame();
  const room = run.room;
  if (room) {
    renderer.drawRoom(run.roomNode, room.template, room.department, room.rect);
    for (const obj of room.objects) {
      if (obj.destroyed) continue;
      renderer.drawSprite(
        run.registry?.get('envObject', obj.defId)?.spriteId ?? 'obj_desk',
        obj.x, obj.y + obj.h / 2, {},
      );
    }
    for (const [, pos] of room.doorWorldPositions) {
      if (!pos.door.discovered) continue;
      renderer.drawDoor(pos.door, pos.x, pos.y, 'OPEN');
    }
    renderer.drawSprite('player_idle_south', run.player.x, run.player.y, { outline: 'PLAYER' });
    renderer.drawLighting(room.department);
  }
  hud.draw({ player: run.player, run });
  renderer.endFrame();
  return renderer.ctx.calls;
}

test('a frame renders in the start room without throwing', async () => {
  const game = await makeGame('OFFICE-RNDR-0001');
  const calls = renderFrame(game);
  assert.ok(calls.drawImage > 0, 'nothing was blitted; the room never drew');
});

test('every room on a real floor renders without throwing', async () => {
  const game = await makeGame('OFFICE-RNDR-0002');
  const { run } = game;
  const visited = [];
  for (const node of run.floor.nodes.values()) {
    // Enter through the graph rather than teleporting, so door binding is exercised.
    run.enterRoom(node, node.doors[0]?.socketId ?? null);
    assert.doesNotThrow(() => renderFrame(game), `render threw in ${node.id} (${node.role})`);
    visited.push(node.id);
  }
  assert.ok(visited.length >= 10, `only rendered ${visited.length} rooms`);
});

test('R-CAM-001: the camera frames every room it enters', async () => {
  const game = await makeGame('OFFICE-RNDR-0003');
  const { run, camera } = game;
  for (const node of run.floor.nodes.values()) {
    run.enterRoom(node, null);
    camera.setRoom(run.room.rect, run.player);
    const rect = run.room.rect;
    // The room centre must land inside the viewport, or the screen shows void.
    const centre = camera.worldToScreen(rect.x + rect.w / 2, rect.y + rect.h / 2, { x: 0, y: 0 });
    assert.ok(
      centre.x > 0 && centre.x < LOGICAL_WIDTH && centre.y > 0 && centre.y < LOGICAL_HEIGHT,
      `${node.id} (${node.sizeClass}) centre off screen at ${centre.x.toFixed(0)},${centre.y.toFixed(0)}`,
    );
    // The player must be on screen too.
    const p = camera.worldToScreen(run.player.x, run.player.y, { x: 0, y: 0 });
    assert.ok(
      p.x > 0 && p.x < LOGICAL_WIDTH && p.y > 0 && p.y < LOGICAL_HEIGHT,
      `${node.id} player off screen at ${p.x.toFixed(0)},${p.y.toFixed(0)}`,
    );
  }
});

test('R-ART-001: the player reads at roughly one world unit tall', async () => {
  installDomShim();
  const { bakeSprite } = await import('../src/render/sprites.js');
  loadContent({ strict: false });
  const baked = bakeSprite('player_idle_south');
  // GDD 18.2 sets a 32px reference grid for ordinary characters. A player drawn at
  // half that reads as a distant doll in a 672px-wide room, which is the bug this
  // test locks down.
  assert.ok(
    baked.height >= TILE * 0.9,
    `player sprite is ${baked.height}px tall; the 32px reference grid wants ~${TILE}px`,
  );
  assert.ok(
    baked.height <= TILE * 2.2,
    `player sprite is ${baked.height}px tall, which overwhelms a ${TILE}px grid`,
  );
});
