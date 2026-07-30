/**
 * Menus are drivable by touch (GDD 17.5, R-TEC-001).
 *
 * This exists because of a shipped bug that made the game unplayable on a phone, and neither the
 * 17 touch tests nor the 270-test suite noticed. Three things were true at once:
 *
 *   1. `this.canvas` was never assigned in the Game constructor, so `attach(this.canvas)` got
 *      undefined, hit its own defensive guard, and bound no listeners at all.
 *   2. The touch overlay only became visible after a touch it could therefore never receive.
 *   3. Even with both fixed, the game opens on the TITLE screen — and menus were driven only by
 *      CONFIRM and the movement keys, while the touch layer deliberately offers no CONFIRM
 *      button. A phone player reached the title screen and had no way past it.
 *
 * Every one of those was invisible to the existing tests, because each tested a unit in isolation
 * and the failure lived in the seams between them. So these tests drive the real startup path: a
 * menu is drawn, a tap lands on a row, and the thing that row promises has to happen.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MenuSystem, SCREEN } from '../src/ui/menus.js';
import { emptyProfile, emptySettings } from '../src/systems/save.js';
import { LOGICAL_WIDTH } from '../src/core/constants.js';

/**
 * A 2D context stand-in that accepts every call the menu draw path makes.
 *
 * The point is not to check pixels — it is that `draw()` runs to completion, because row
 * hitboxes are recorded as a side effect of drawing and a tap cannot resolve without them.
 */
function fakeCtx() {
  return new Proxy({}, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      // Every canvas method used by the menus is a no-op; every property assignment sticks.
      return () => {};
    },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
}

function fixture({ hasRun = false } = {}) {
  const calls = [];
  const menus = new MenuSystem({
    renderer: {
      push: (layer, fn) => fn(fakeCtx()),
      drawText: () => {},
    },
    registry: { all: () => [], get: () => null },
    // The real save shapes, not hand-rolled stand-ins. A fixture that is missing fields the
    // product relies on tests a game that does not exist — the first version of this omitted
    // `profile.profiles` and every draw threw.
    settings: emptySettings(),
    profile: emptyProfile(),
    save: { saveSettings: () => {}, hasRun: () => hasRun },
    loc: (k) => k,
    actions: {
      newRun: () => calls.push('newRun'),
      continueRun: () => calls.push('continueRun'),
      quitToTitle: () => calls.push('quitToTitle'),
      restart: () => calls.push('restart'),
      settingsChanged: () => calls.push('settingsChanged'),
    },
  });
  menus.touchActive = true;
  return { menus, calls };
}

/** The vertical centre of a drawn row, which is where a thumb would land. */
function rowCentre(menus, index) {
  const box = menus.rowHitboxes.find((r) => r.index === index);
  assert.ok(box, `row ${index} was not drawn`);
  return (box.top + box.bottom) / 2;
}

test('tapping New run on the title screen starts a run', () => {
  // The exact path a phone player takes on first load, and the one that was impossible.
  const { menus, calls } = fixture();
  menus.open(SCREEN.TITLE);
  menus.draw();

  const items = menus.items();
  const index = items.findIndex((i) => i.label === 'New run');
  assert.ok(index >= 0, 'the title screen must offer New run');

  menus.touchAt(LOGICAL_WIDTH / 2, rowCentre(menus, index), 'DOWN');
  assert.deepEqual(calls, ['newRun']);
});

test('a tap moves the cursor to the row it landed on', () => {
  const { menus } = fixture();
  menus.open(SCREEN.TITLE);
  menus.draw();

  // A row that does NOT navigate. Tapping "Collection" opens a screen, and open() resets the
  // cursor by design, so asserting on it there would be testing the wrong thing.
  const index = menus.items().findIndex((i) => i.kind === 'CHOICE');
  assert.ok(index > 0, 'the title screen should have a choice row below the first action');
  menus.touchAt(LOGICAL_WIDTH / 2, rowCentre(menus, index), 'DOWN');
  // Selecting and acting are one gesture on glass, so the cursor must follow the finger — a
  // player who then reaches for a keyboard has to continue from where they last touched.
  assert.equal(menus.cursor, index);
});

test('tapping a header or a label does nothing but is still consumed', () => {
  const { menus, calls } = fixture();
  menus.open(SCREEN.COLLECTION);
  menus.draw();
  const label = menus.rowHitboxes.find((r) => r.kind === 'LABEL' || r.kind === 'HEADER');
  if (!label) return; // an empty collection has neither; nothing to assert
  // Consumed, not ignored: a tap that falls through to the game underneath would fire a shot
  // through the pause screen.
  assert.equal(menus.touchAt(LOGICAL_WIDTH / 2, (label.top + label.bottom) / 2, 'DOWN'), true);
  assert.deepEqual(calls, []);
});

test('a CHOICE row cycles on tap', () => {
  const { menus } = fixture();
  menus.open(SCREEN.OPTIONS);
  menus.draw();
  const items = menus.items();
  const index = items.findIndex((i) => i.kind === 'CHOICE');
  if (index < 0) return;
  const before = items[index].get();
  menus.touchAt(LOGICAL_WIDTH / 2, rowCentre(menus, index), 'DOWN');
  assert.notEqual(menus.items()[index].get(), before, 'a tap should advance the choice');
});

test('GDD 21.2: a HOLD row needs a sustained press, not a tap', () => {
  const { menus, calls } = fixture();
  menus.hasRun = true;
  menus.open(SCREEN.PAUSE);
  menus.draw();
  const items = menus.items();
  const index = items.findIndex((i) => i.kind === 'HOLD');
  assert.ok(index >= 0, 'Pause must offer a hold-to-restart row');

  const y = rowCentre(menus, index);
  menus.touchAt(LOGICAL_WIDTH / 2, y, 'DOWN');
  assert.deepEqual(calls, [], 'contact alone must not restart the run');

  menus.tickTouchHold(0.3);
  assert.deepEqual(calls, [], 'a partial hold must not restart the run');

  menus.tickTouchHold(1.0);
  assert.ok(calls.length > 0, 'a completed hold acts');
});

test('lifting a finger cancels a hold in progress', () => {
  const { menus, calls } = fixture();
  menus.hasRun = true;
  menus.open(SCREEN.PAUSE);
  menus.draw();
  const index = menus.items().findIndex((i) => i.kind === 'HOLD');
  const y = rowCentre(menus, index);

  menus.touchAt(LOGICAL_WIDTH / 2, y, 'DOWN');
  menus.tickTouchHold(0.5);
  menus.touchAt(LOGICAL_WIDTH / 2, y, 'UP');
  menus.tickTouchHold(1.0);
  // Otherwise a finger lifted halfway would keep filling and restart the run on its own.
  assert.deepEqual(calls, []);
});

test('the back affordance closes a screen but never appears on the title', () => {
  const { menus } = fixture();
  menus.open(SCREEN.TITLE);
  menus.open(SCREEN.OPTIONS);
  menus.draw();

  const r = menus.backButtonRect;
  assert.equal(menus.touchAt(r.x + r.w / 2, r.y + r.h / 2, 'DOWN'), true);
  assert.equal(menus.current, SCREEN.TITLE, 'back should return to the title screen');

  // On the title there is nowhere to go back to, so the affordance is not offered and a tap
  // there must not pop the last screen and leave the player looking at nothing.
  menus.draw();
  menus.touchAt(r.x + r.w / 2, r.y + r.h / 2, 'DOWN');
  assert.equal(menus.current, SCREEN.TITLE);
});

test('the back affordance is not offered when touch is not in use', () => {
  const { menus } = fixture();
  menus.touchActive = false;
  menus.open(SCREEN.TITLE);
  menus.open(SCREEN.OPTIONS);
  menus.draw();
  const r = menus.backButtonRect;
  menus.touchAt(r.x + r.w / 2, r.y + r.h / 2, 'DOWN');
  // A desktop player's stray click must not close their screen via an invisible button.
  assert.equal(menus.current, SCREEN.OPTIONS);
});

test('row hitboxes track the text scale', () => {
  // The rows are laid out from settings.textScale, and the hitboxes are derived from the same
  // number rather than a second copy of it — so a player using large text still hits the row
  // they aimed at.
  const small = fixture();
  small.menus.settings.textScale = 1;
  small.menus.open(SCREEN.TITLE);
  small.menus.draw();
  const smallHeight = small.menus.rowHitboxes[0].bottom - small.menus.rowHitboxes[0].top;

  const large = fixture();
  large.menus.settings.textScale = 1.6;
  large.menus.open(SCREEN.TITLE);
  large.menus.draw();
  const largeHeight = large.menus.rowHitboxes[0].bottom - large.menus.rowHitboxes[0].top;

  assert.ok(largeHeight > smallHeight, `${largeHeight} should exceed ${smallHeight}`);
});
