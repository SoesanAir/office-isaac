/**
 * Touch controls (GDD 4.1, 4.2, 17.6, 21.2, R-PLY-002, R-UIX-005).
 *
 * These tests exist because none of the failures here are visible on a desktop, and the
 * developer machine is a desktop. A touch layout can be wrong in ways that only show up under
 * a thumb: targets below the platform minimum, a stick that keeps walking after the OS steals
 * the gesture, an accidental weapon drop mid-fight.
 *
 * The physical-size test is the important one. It is the requirement most easily broken by a
 * later "let me just make the buttons a bit smaller" tweak, and the one nobody can eyeball,
 * because the answer depends on the device the game is running on rather than on the numbers
 * in the file.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TouchControls, TARGET_RADIUS_PT, HOLD_SECONDS, MOVE_ZONE_MAX_X } from '../src/systems/touch.js';
import { ACTION } from '../src/systems/input.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../src/core/constants.js';

/**
 * A canvas stand-in reporting a chosen CSS size.
 *
 * `cssHeight` is what drives the whole layout, since it sets how many points one logical pixel
 * is worth.
 */
function fakeCanvas(cssWidth, cssHeight) {
  const handlers = new Map();
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: cssWidth, height: cssHeight }),
    addEventListener: (type, fn) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    /** Fire a synthetic touch event in CSS pixel space. */
    fire(type, { id = 1, x = 0, y = 0, pointerType = 'touch' } = {}) {
      for (const fn of handlers.get(type) || []) {
        fn({ pointerId: id, pointerType, clientX: x, clientY: y, preventDefault() {} });
      }
    },
  };
}

/** Convert logical coordinates to the CSS coordinates a touch would arrive in. */
const toCss = (logical, cssSize, logicalSize) => logical * (cssSize / logicalSize);

test('every button clears the 44pt platform minimum on a small landscape phone', () => {
  // iPhone SE in landscape is about the smallest screen anyone will try this on.
  for (const [w, h] of [[568, 320], [844, 390], [1024, 768], [1920, 1080]]) {
    const touch = new TouchControls().attach(fakeCanvas(w, h));
    const ptPerLogical = h / LOGICAL_HEIGHT;
    for (const b of touch.layout()) {
      const diameterPt = b.radius * 2 * ptPerLogical;
      // Apple HIG's floor. A control below it is one the player misses under pressure, and
      // "the buttons don't work" is indistinguishable from a bug.
      assert.ok(
        diameterPt >= TARGET_RADIUS_PT * 2 - 0.5,
        `${b.label} is ${diameterPt.toFixed(1)}pt across at ${w}x${h}; needs ${TARGET_RADIUS_PT * 2}pt`,
      );
    }
  }
});

test('buttons never overlap, and keep a usable gap', () => {
  for (const [w, h] of [[568, 320], [844, 390], [1920, 1080]]) {
    const placed = new TouchControls().attach(fakeCanvas(w, h)).layout();
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
        // Material's 8dp minimum, expressed in logical pixels at this scale. Adjacent targets
        // that touch produce presses the player did not intend and cannot explain.
        const minGap = 8 / (h / LOGICAL_HEIGHT);
        assert.ok(gap >= minGap - 1, `${a.label}/${b.label} gap ${gap.toFixed(1)} at ${w}x${h}`);
      }
    }
  }
});

test('buttons stay inside the frame', () => {
  for (const [w, h] of [[568, 320], [844, 390]]) {
    for (const b of new TouchControls().attach(fakeCanvas(w, h)).layout()) {
      assert.ok(b.x - b.radius >= 0 && b.x + b.radius <= LOGICAL_WIDTH, `${b.label} x out of frame`);
      assert.ok(b.y - b.radius >= 0 && b.y + b.radius <= LOGICAL_HEIGHT, `${b.label} y out of frame`);
    }
  }
});

test('buttons keep clear of the bottom third, where thumbs rest on the sticks', () => {
  const placed = new TouchControls().attach(fakeCanvas(844, 390)).layout();
  for (const b of placed) {
    assert.ok(
      b.y + b.radius < LOGICAL_HEIGHT * 0.72,
      `${b.label} reaches into the stick area at y=${b.y}`,
    );
  }
});

test('a left-half drag moves and does not fire; a right-half drag fires', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const cx = (lx) => toCss(lx, 844, LOGICAL_WIDTH);
  const cy = (ly) => toCss(ly, 390, LOGICAL_HEIGHT);

  canvas.fire('pointerdown', { id: 1, x: cx(200), y: cy(400) });
  canvas.fire('pointermove', { id: 1, x: cx(260), y: cy(400) });
  let s = touch.sample();
  assert.ok(s.moveX > 0.5, 'dragging right should move right');
  assert.equal(s.aimY, 0);
  assert.equal(s.aimX, 0, 'the movement stick must never fire (R-PLY-002 keeps them separate)');

  canvas.fire('pointerdown', { id: 2, x: cx(760), y: cy(400) });
  canvas.fire('pointermove', { id: 2, x: cx(760), y: cy(340) });
  s = touch.sample();
  assert.ok(s.aimY < -0.5, 'dragging up on the right should fire up');
  assert.ok(s.moveX > 0.5, 'and movement must be unaffected — both thumbs work at once');
});

test('a tap without a drag fires nothing', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  // A player reaching for a button and missing must not spend a shot.
  canvas.fire('pointerdown', { id: 1, x: toCss(700, 844, LOGICAL_WIDTH), y: toCss(400, 390, LOGICAL_HEIGHT) });
  const s = touch.sample();
  assert.equal(s.aimX, 0);
  assert.equal(s.aimY, 0);
});

test('the stick zones split the screen and the fire stick owns the right half', () => {
  assert.equal(MOVE_ZONE_MAX_X, LOGICAL_WIDTH * 0.5);
});

test('a cancelled pointer releases the stick', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  canvas.fire('pointerdown', { id: 1, x: toCss(200, 844, LOGICAL_WIDTH), y: toCss(400, 390, LOGICAL_HEIGHT) });
  canvas.fire('pointermove', { id: 1, x: toCss(300, 844, LOGICAL_WIDTH), y: toCss(400, 390, LOGICAL_HEIGHT) });
  assert.ok(touch.sample().moveX > 0.5);

  // The OS taking the gesture for a notification shade must not leave the player walking into
  // a wall for the rest of the run.
  canvas.fire('pointercancel', { id: 1 });
  assert.equal(touch.sample().moveX, 0);
});

test('a mouse never drives touch controls', () => {
  const canvas = fakeCanvas(1920, 1080);
  const touch = new TouchControls().attach(canvas);
  canvas.fire('pointerdown', { id: 1, x: 400, y: 800, pointerType: 'mouse' });
  // A desktop player dragging on the canvas would otherwise walk and shoot, and would see a
  // thumb-stick overlay appear over the game.
  assert.equal(touch.active, false);
  assert.equal(touch.sample(), null);
});

test('GDD 21.2: dropping a weapon needs a hold, not a tap', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const drop = touch.layout().find((b) => b.action === ACTION.DROP);
  assert.ok(drop, 'there must be a DROP button');

  canvas.fire('pointerdown', {
    id: 1,
    x: toCss(drop.x, 844, LOGICAL_WIDTH),
    y: toCss(drop.y, 390, LOGICAL_HEIGHT),
  });
  // A tap alone must not discard the weapon the whole run is built around.
  assert.equal(touch.takeEdges().has(ACTION.DROP), false);

  touch.update(HOLD_SECONDS * 0.6);
  assert.equal(touch.takeEdges().has(ACTION.DROP), false, 'a partial hold must not drop');

  touch.update(HOLD_SECONDS);
  assert.equal(touch.takeEdges().has(ACTION.DROP), true, 'a completed hold drops');
});

test('a completed hold fires exactly once, however long it is held', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const drop = touch.layout().find((b) => b.action === ACTION.DROP);
  canvas.fire('pointerdown', {
    id: 1,
    x: toCss(drop.x, 844, LOGICAL_WIDTH),
    y: toCss(drop.y, 390, LOGICAL_HEIGHT),
  });
  touch.update(HOLD_SECONDS * 2);
  assert.equal(touch.takeEdges().has(ACTION.DROP), true);
  touch.update(HOLD_SECONDS * 2);
  assert.equal(touch.takeEdges().has(ACTION.DROP), false, 'holding longer must not repeat');
});

test('a tap button fires on press', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const item = touch.layout().find((b) => b.action === ACTION.USE_ACTIVE);
  canvas.fire('pointerdown', {
    id: 1,
    x: toCss(item.x, 844, LOGICAL_WIDTH),
    y: toCss(item.y, 390, LOGICAL_HEIGHT),
  });
  assert.equal(touch.takeEdges().has(ACTION.USE_ACTIVE), true);
});

test('a disabled contextual button does nothing and does not start a stick underneath', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  touch.setContext({ hasActive: false });
  const item = touch.layout().find((b) => b.action === ACTION.USE_ACTIVE);
  canvas.fire('pointerdown', {
    id: 1,
    x: toCss(item.x, 844, LOGICAL_WIDTH),
    y: toCss(item.y, 390, LOGICAL_HEIGHT),
  });
  assert.equal(touch.takeEdges().has(ACTION.USE_ACTIVE), false);
  // The touch must be swallowed rather than falling through: an item button in the fire zone
  // would otherwise become an unintended shot.
  canvas.fire('pointermove', {
    id: 1,
    x: toCss(item.x - 60, 844, LOGICAL_WIDTH),
    y: toCss(item.y, 390, LOGICAL_HEIGHT),
  });
  assert.equal(touch.sample().aimX, 0);
});

test('pressing a button does not also start an aim stick', () => {
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const item = touch.layout().find((b) => b.action === ACTION.USE_ACTIVE);
  // ITEM sits in the right-hand half, so without button-first hit-testing this press would
  // both use the item and fire.
  assert.ok(item.x > MOVE_ZONE_MAX_X);
  canvas.fire('pointerdown', {
    id: 1,
    x: toCss(item.x, 844, LOGICAL_WIDTH),
    y: toCss(item.y, 390, LOGICAL_HEIGHT),
  });
  canvas.fire('pointermove', {
    id: 1,
    x: toCss(item.x, 844, LOGICAL_WIDTH),
    y: toCss(item.y - 80, 390, LOGICAL_HEIGHT),
  });
  assert.equal(touch.sample().aimY, 0);
});

test('touch feeds the input system through the gamepad branch', async () => {
  const { InputSystem } = await import('../src/systems/input.js');
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const input = new InputSystem();
  input.touch = touch;

  canvas.fire('pointerdown', { id: 1, x: toCss(200, 844, LOGICAL_WIDTH), y: toCss(400, 390, LOGICAL_HEIGHT) });
  canvas.fire('pointermove', { id: 1, x: toCss(280, 844, LOGICAL_WIDTH), y: toCss(400, 390, LOGICAL_HEIGHT) });

  const s = input.sample({});
  // Analog, not binary: a gentle push walks slowly, exactly as an analog stick does (GDD 4.1).
  assert.ok(s.moveX > 0.5, 'movement should reach the resolved input state');
  assert.ok(s.moveMagnitude > 0 && s.moveMagnitude <= 1);
});

test('touch aim resolves to a cardinal through the existing aiming rules', async () => {
  const { InputSystem } = await import('../src/systems/input.js');
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const input = new InputSystem();
  input.touch = touch;

  canvas.fire('pointerdown', { id: 1, x: toCss(760, 844, LOGICAL_WIDTH), y: toCss(400, 390, LOGICAL_HEIGHT) });
  canvas.fire('pointermove', { id: 1, x: toCss(860, 844, LOGICAL_WIDTH), y: toCss(404, 390, LOGICAL_HEIGHT) });

  const s = input.sample({});
  // GDD 4.2's rules are implemented once, for the keyboard and the pad, and touch inherits
  // them by handing over a raw vector rather than resolving a direction itself.
  assert.equal(s.aimDirection, 'EAST');
  assert.equal(s.firing, true);
});

test('a touch counts as the gesture that unlocks audio', async () => {
  const { InputSystem } = await import('../src/systems/input.js');
  const canvas = fakeCanvas(844, 390);
  const touch = new TouchControls().attach(canvas);
  const input = new InputSystem();
  input.touch = touch;
  assert.equal(input.hadAnyInput(), false);

  canvas.fire('pointerdown', { id: 1, x: 100, y: 200 });
  // Browsers gate the audio graph on a user gesture. Without touch counting here, a phone
  // player would reach the first room in silence.
  assert.equal(input.hadAnyInput(), true);
});
