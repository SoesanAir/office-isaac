/**
 * Headless canvas stub shared by the render and traversal suites.
 *
 * Not a test file: `npm test` globs `tests/*.test.js`, so this sits one level down and is
 * only ever imported.
 *
 * The context is a *recorder* rather than a renderer. These suites assert that the render
 * path completes and draws where it claims to, never that pixels look right — the sprite
 * grids in content/sprites are where appearance is reviewed.
 *
 * `beginFrame()` clears to near-black, so any exception later in a frame leaves the player
 * staring at a black screen with nothing in the game to explain it. That failure mode is
 * indistinguishable from a camera bug by eye, which is why a stub good enough to run the
 * whole path is worth maintaining.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../../src/core/constants.js';

/** Minimal 2D context recorder. Records draw calls; ignores appearance. */
export function makeContext() {
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
export function makeCanvas(width = LOGICAL_WIDTH, height = LOGICAL_HEIGHT) {
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
 * Install a `document.createElement('canvas')` shim so sprite baking and the renderer's
 * offscreen room bake work without a browser.
 */
export function installDomShim() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error(`unexpected createElement(${tag})`);
      return makeCanvas(1, 1);
    },
  };
  globalThis.innerWidth = 1920;
  globalThis.innerHeight = 1080;
  // InputSystem.attach(globalThis) binds keydown/keyup/blur. Node's globalThis has no
  // addEventListener, so a no-op listener registry is enough: these suites drive input by
  // setting state directly rather than by dispatching synthetic key events.
  if (typeof globalThis.addEventListener !== 'function') {
    globalThis.addEventListener = () => {};
    globalThis.removeEventListener = () => {};
  }
  // GameLoop.start schedules a frame. Returning 0 without ever calling back means the
  // loop is created and never runs itself, so a test steps the systems it cares about
  // explicitly and nothing advances behind its back.
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = () => 0;
    globalThis.cancelAnimationFrame = () => {};
  }
}
