/**
 * Remappable controls (GDD 17.6, R-UIX-002).
 *
 * The Controls screen is the one menu that can break the player's ability to use menus. These
 * tests pin the three ways that happens, because none of them are visible in ordinary play:
 *
 *   1. Binding a key that already belongs to another action leaves that action unbound. The
 *      old code did this silently. It must be reported.
 *   2. A capture that never ends swallows every key. Escape has to end it, and leaving the
 *      screen has to end it.
 *   3. A rebind that is not persisted is a rebind the player makes again every session.
 *
 * The screen also used to hard-code its labels, and they had drifted out of step with the
 * actual defaults — it advertised Interact on F while the binding was E. So there is a test
 * that the displayed key comes from the live bindings and cannot drift again.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { InputSystem, ACTION, DEFAULT_KEYBOARD } from '../src/systems/input.js';
import { MenuSystem, SCREEN } from '../src/ui/menus.js';
import { emptySettings } from '../src/systems/save.js';

/** A MenuSystem with just enough around it to drive the Controls screen. */
function fixture() {
  const settings = emptySettings();
  const written = [];
  const input = new InputSystem();
  const menus = new MenuSystem({
    renderer: null,
    registry: { all: () => [], get: () => null },
    settings,
    profile: { discovered: [], endings: [] },
    save: { saveSettings: (s) => written.push(s) },
    loc: (k) => k,
    input,
  });
  menus.open(SCREEN.CONTROLS);
  return { menus, input, settings, written };
}

const rowFor = (menus, action) => menus.items().find((i) => i.action === action);

test('R-UIX-002: every control row shows the key that is actually bound', () => {
  const { menus, input } = fixture();
  // The regression: labels were written by hand and said F for Interact while the default was
  // E. Reading through codeFor makes the two impossible to disagree.
  assert.equal(rowFor(menus, ACTION.INTERACT).value, 'E');
  assert.equal(DEFAULT_KEYBOARD.KeyE, ACTION.INTERACT);

  input.rebindKey('KeyF', ACTION.INTERACT);
  assert.equal(rowFor(menus, ACTION.INTERACT).value, 'F');
});

test('GDD 17.6: pressing a key while capturing rebinds the action', () => {
  const { menus, input } = fixture();
  menus.beginRebind(ACTION.INTERACT);
  assert.equal(input.capturing, true);

  const target = makeTarget();
  input.attach(target);
  target.dispatch('keydown', { code: 'KeyZ' });
  assert.equal(input.capturing, false);
  assert.equal(input.codeFor(ACTION.INTERACT), 'KeyZ');
  assert.equal(rowFor(menus, ACTION.INTERACT).value, 'Z');
});

test('a rebind that displaces another action says so', () => {
  const { menus, input } = fixture();
  // W is Move up. Binding it to Interact must not quietly cost the player Move up.
  menus.beginRebind(ACTION.INTERACT);
  const target = makeTarget();
  input.attach(target);
  target.dispatch('keydown', { code: 'KeyW' });

  assert.equal(input.codeFor(ACTION.INTERACT), 'KeyW');
  assert.equal(input.codeFor(ACTION.MOVE_UP), undefined);
  assert.match(menus.rebindNote, /Move up is now unbound/);
  assert.equal(rowFor(menus, ACTION.MOVE_UP).value, 'unbound');
});

test('Escape cancels a capture instead of binding itself', () => {
  const { menus, input } = fixture();
  const before = input.codeFor(ACTION.INTERACT);
  menus.beginRebind(ACTION.INTERACT);
  const target = makeTarget();
  input.attach(target);
  target.dispatch('keydown', { code: 'Escape' });

  // Binding Escape to a gameplay action would remove the only key that closes a menu, and the
  // screen that could undo it is behind that key.
  assert.equal(input.capturing, false);
  assert.equal(input.codeFor(ACTION.INTERACT), before);
  assert.equal(input.keyboard.Escape, ACTION.PAUSE);
});

test('leaving the Controls screen ends any capture', () => {
  const { menus, input } = fixture();
  menus.beginRebind(ACTION.INTERACT);
  menus.back();
  // Otherwise the capture outlives its screen and eats every key with nothing on screen
  // explaining why.
  assert.equal(input.capturing, false);
});

test('Confirm and Cancel are not offered for rebinding', () => {
  const { menus } = fixture();
  assert.equal(rowFor(menus, ACTION.CONFIRM), undefined);
  assert.equal(rowFor(menus, ACTION.CANCEL), undefined);
});

test('while capturing, the game receives no input at all', () => {
  const { input } = fixture();
  const target = makeTarget();
  input.attach(target);
  target.dispatch('keydown', { code: 'KeyD' });   // walk right
  input.beginCapture(ACTION.INTERACT);

  const s = input.sample();
  // Holding D while assigning a key must not also walk the player into a hazard.
  assert.equal(s.moveX, 0);
  assert.equal(s.moveMagnitude, 0);
  assert.equal(s.pressed.size, 0);
});

test('R-SAV-001: a rebind is written to the settings domain', () => {
  const { menus, input, settings, written } = fixture();
  menus.beginRebind(ACTION.INTERACT);
  const target = makeTarget();
  input.attach(target);
  target.dispatch('keydown', { code: 'KeyZ' });

  assert.equal(settings.input.keyboard.KeyZ, ACTION.INTERACT);
  assert.ok(written.length > 0, 'the settings domain should have been saved');

  // And it comes back: a fresh system loaded from those settings has the same layout.
  const reloaded = new InputSystem().load(settings.input);
  assert.equal(reloaded.codeFor(ACTION.INTERACT), 'KeyZ');
});

test('restoring defaults recovers from a layout the player cannot navigate', () => {
  const { menus, input } = fixture();
  const digits = ['Digit1', 'Digit2', 'Digit3'];
  [ACTION.MOVE_UP, ACTION.MOVE_DOWN, ACTION.PAUSE].forEach((action, i) => {
    input.rebindKey(digits[i], action);
  });
  const reset = menus.items().find((i) => i.kind === 'HOLD');
  assert.ok(reset, 'the Controls screen must offer a restore-defaults row');
  reset.run();

  assert.equal(input.codeFor(ACTION.MOVE_UP), 'KeyW');
  assert.equal(input.codeFor(ACTION.PAUSE), 'Escape');
});

test('gamepad buttons rebind through the same list', () => {
  const { menus, input } = fixture();
  menus.controlsDevice = 'GAMEPAD';
  // GDD 17.6 asks for controller remapping too, and the action list is shared so the two
  // devices cannot drift apart.
  assert.equal(rowFor(menus, ACTION.INTERACT).value, 'Bottom face');

  const result = input.rebindButton(3, ACTION.INTERACT);
  assert.equal(result.previousCode, '0');
  assert.equal(rowFor(menus, ACTION.INTERACT).value, 'Top face');
});

/** A minimal EventTarget stand-in that records handlers and can fire them. */
function makeTarget() {
  const handlers = new Map();
  const target = {
    addEventListener: (type, fn) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      const list = handlers.get(type) || [];
      const at = list.indexOf(fn);
      if (at >= 0) list.splice(at, 1);
    },
    dispatch: (type, event) => {
      for (const fn of handlers.get(type) || []) fn({ preventDefault() {}, ...event });
      return target;
    },
  };
  return target;
}
