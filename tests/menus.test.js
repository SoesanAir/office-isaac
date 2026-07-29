/**
 * Menu tests.
 *
 * GDD refs: 17.1 (the UI law), 17.5 (the required menus and their functions), 17.6
 *           (accessibility: hold/toggle alternatives, scalable text, colour-vision presets,
 *           reduced motion), 21.1 (settings and profile are save domains), 21.2 (restart
 *           uses hold confirmation and deliberately discards the run), R-PRG-004 / D-016
 *           (the collection never shows a denominator), R-UIX-005 (no mechanic depends on
 *           colour alone).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { MenuSystem, SCREEN } from '../src/ui/menus.js';
import { ACTION } from '../src/systems/input.js';
import { SaveService, emptyProfile, emptySettings } from '../src/systems/save.js';
import { makeCanvas, installDomShim } from './helpers/canvas.js';

const registry = loadContent({ strict: false });

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function makeMenus({ profile = emptyProfile(), settings = emptySettings() } = {}) {
  installDomShim();
  const calls = [];
  const save = new SaveService({ storage: memStorage() });
  const renderer = {
    push(layer, fn) { fn(makeCanvas()._ctx); },
  };
  const menus = new MenuSystem({
    renderer,
    registry,
    settings,
    profile,
    save,
    loc: (k) => k,
    actions: {
      newRun: () => calls.push('newRun'),
      continueRun: () => calls.push('continueRun'),
      restart: () => calls.push('restart'),
      quitToTitle: () => calls.push('quitToTitle'),
      settingsChanged: () => calls.push('settingsChanged'),
    },
  });
  return { menus, calls, save, settings, profile };
}

/** A sampled-input stand-in: `pressed` this frame plus a set of held actions. */
const input = (pressed = [], held = []) => ({
  pressed: new Set(pressed),
  isHeld: (a) => held.includes(a),
});

// ---------------------------------------------------------------------------
// The stack
// ---------------------------------------------------------------------------

test('a menu suspends gameplay, and closing it resumes', () => {
  const { menus } = makeMenus();
  assert.equal(menus.blocksGameplay, false);
  menus.open(SCREEN.PAUSE);
  assert.equal(menus.blocksGameplay, true);
  menus.back();
  assert.equal(menus.blocksGameplay, false);
});

test('blocksGameplay is derived, so it can never disagree with the stack', () => {
  // A stored boolean can drift out of step with which screens are open — "options up but
  // pause closed" is a state that simply cannot be represented here.
  const { menus } = makeMenus();
  menus.open(SCREEN.PAUSE);
  menus.open(SCREEN.OPTIONS);
  assert.equal(menus.current, SCREEN.OPTIONS);
  assert.equal(menus.blocksGameplay, true);
  menus.back();
  assert.equal(menus.current, SCREEN.PAUSE, 'back skipped a level');
  assert.equal(menus.blocksGameplay, true, 'closing options resumed the game under pause');
  menus.back();
  assert.equal(menus.blocksGameplay, false);
});

test('Escape backs out one screen at a time, but never off the title', () => {
  // Backing off the title would leave the player looking at a suspended game with no menu
  // and no way to reach one.
  const { menus } = makeMenus();
  menus.open(SCREEN.TITLE);
  menus.update(0.016, input([ACTION.CANCEL]));
  assert.equal(menus.current, SCREEN.TITLE, 'the title screen was dismissed');

  menus.open(SCREEN.OPTIONS);
  menus.update(0.016, input([ACTION.CANCEL]));
  assert.equal(menus.current, SCREEN.TITLE);
});

test('Pause opens only when there is a run to pause', () => {
  const { menus } = makeMenus();
  menus.hasRun = false;
  assert.equal(menus.update(0.016, input([ACTION.PAUSE])), false, 'paused with no run');
  assert.equal(menus.current, null);

  menus.hasRun = true;
  assert.equal(menus.update(0.016, input([ACTION.PAUSE])), true);
  assert.equal(menus.current, SCREEN.PAUSE);
});

// ---------------------------------------------------------------------------
// GDD 17.5: required functions
// ---------------------------------------------------------------------------

test('GDD 17.5: the title screen offers every required function', () => {
  const { menus } = makeMenus();
  menus.open(SCREEN.TITLE);
  const labels = menus.items().map((i) => i.label);
  for (const required of ['New run', 'Employee', 'Options', 'Collection']) {
    assert.ok(labels.includes(required), `title is missing "${required}" — has ${labels.join(', ')}`);
  }
});

test('Continue appears only when a resumable run exists', () => {
  // Offering it and then failing would be worse than not offering it (GDD 21.2).
  const { menus, save } = makeMenus();
  menus.open(SCREEN.TITLE);
  assert.equal(menus.items().some((i) => i.label === 'Continue'), false);

  save.saveRun({ seed: 'OFFICE-MENU-0001' });
  assert.equal(menus.items().some((i) => i.label === 'Continue'), true);
});

test('GDD 17.5: the pause screen offers every required function', () => {
  const { menus } = makeMenus();
  menus.open(SCREEN.PAUSE);
  const labels = menus.items().map((i) => i.label);
  for (const required of ['Resume', 'Controls', 'Options', 'Collection', 'Restart run', 'Exit to title']) {
    assert.ok(labels.includes(required), `pause is missing "${required}"`);
  }
});

test('GDD 21.2: restart needs a sustained hold, and a release resets it', () => {
  const { menus, calls } = makeMenus();
  menus.open(SCREEN.PAUSE);
  const at = menus.items().findIndex((i) => i.label === 'Restart run');
  menus.cursor = at;

  // A single press does nothing at all.
  menus.update(0.016, input([ACTION.CONFIRM], [ACTION.CONFIRM]));
  assert.deepEqual(calls, [], 'a tap restarted the run');

  // Most of the way, then let go: the progress must not be banked.
  for (let i = 0; i < 40; i += 1) menus.update(0.016, input([], [ACTION.CONFIRM]));
  menus.update(0.016, input([], []));
  assert.deepEqual(calls, [], 'releasing still restarted the run');
  assert.equal(menus.holdTimer, 0, 'the hold was not reset on release');

  // A continuous hold does fire.
  for (let i = 0; i < 80; i += 1) menus.update(0.016, input([], [ACTION.CONFIRM]));
  assert.deepEqual(calls, ['restart']);
});

test('an action item runs on confirm', () => {
  const { menus, calls } = makeMenus();
  menus.open(SCREEN.TITLE);
  menus.cursor = menus.items().findIndex((i) => i.label === 'New run');
  menus.update(0.016, input([ACTION.CONFIRM]));
  assert.deepEqual(calls, ['newRun']);
});

// ---------------------------------------------------------------------------
// GDD 17.6: accessibility surface
// ---------------------------------------------------------------------------

test('GDD 17.6: every accessibility setting is reachable from Options', () => {
  // The settings existed and were honoured before this screen did; without it the player had
  // no way to change any of them, which makes the accessibility work unreachable.
  const { menus } = makeMenus();
  menus.open(SCREEN.OPTIONS);
  const labels = menus.items().map((i) => i.label);
  for (const required of [
    'Master volume', 'Music volume', 'Sound volume', 'Audio captions',
    'High contrast', 'Grayscale', 'Reduced motion', 'Reduced effects',
    'Text size', 'Fire', 'Map', 'Share diagnostics',
  ]) {
    assert.ok(labels.includes(required), `options is missing "${required}"`);
  }
});

test('a toggle flips the underlying setting and reports the change', () => {
  const { menus, settings, calls } = makeMenus();
  menus.open(SCREEN.OPTIONS);
  menus.cursor = menus.items().findIndex((i) => i.label === 'Grayscale');
  const before = settings.grayscale;

  menus.update(0.016, input([ACTION.CONFIRM]));
  assert.equal(settings.grayscale, !before);
  // The audio engine needs telling immediately, or a volume change waits for the next sound.
  assert.ok(calls.includes('settingsChanged'));
});

test('a slider clamps at both ends and never drifts off a round value', () => {
  // Repeated floating-point steps otherwise land on 0.7000000000000001 and the readout
  // flickers between 70% and 71%.
  const { menus, settings } = makeMenus();
  menus.open(SCREEN.OPTIONS);
  menus.cursor = menus.items().findIndex((i) => i.label === 'Master volume');

  for (let i = 0; i < 40; i += 1) menus.update(0.016, input([ACTION.MOVE_RIGHT]));
  assert.equal(settings.masterVolume, 1, 'the slider passed its maximum');

  for (let i = 0; i < 60; i += 1) menus.update(0.016, input([ACTION.MOVE_LEFT]));
  assert.equal(settings.masterVolume, 0, 'the slider passed its minimum');

  menus.update(0.016, input([ACTION.MOVE_RIGHT]));
  assert.equal(settings.masterVolume, 0.05, `unrounded value ${settings.masterVolume}`);
});

test('a choice cycles and wraps in both directions', () => {
  const { menus, settings } = makeMenus();
  menus.open(SCREEN.OPTIONS);
  menus.cursor = menus.items().findIndex((i) => i.label === 'Fire');
  assert.equal(settings.fireMode, 'HOLD');
  menus.update(0.016, input([ACTION.MOVE_RIGHT]));
  assert.equal(settings.fireMode, 'TOGGLE');
  menus.update(0.016, input([ACTION.MOVE_RIGHT]));
  assert.equal(settings.fireMode, 'HOLD', 'the choice did not wrap');
  menus.update(0.016, input([ACTION.MOVE_LEFT]));
  assert.equal(settings.fireMode, 'TOGGLE', 'the choice did not wrap backwards');
});

test('GDD 21.1: leaving Options commits the settings to disk', () => {
  const { menus, settings, save } = makeMenus();
  menus.open(SCREEN.OPTIONS);
  settings.grayscale = true;
  menus.back();
  assert.equal(save.loadSettings().grayscale, true, 'settings did not persist');
});

// ---------------------------------------------------------------------------
// Collection (D-016)
// ---------------------------------------------------------------------------

test('D-016: the collection shows what was found and never a total', () => {
  const profile = emptyProfile();
  profile.discovered.push('WPN-001', 'ITM-001', 'ENM-001');
  profile.endings.push('END-001');
  const { menus } = makeMenus({ profile });
  menus.open(SCREEN.COLLECTION);

  const rendered = menus.items().map((i) => `${i.label} ${i.value ?? ''}`).join('\n');
  assert.ok(rendered.includes('Weapons'), 'no weapon section');
  assert.ok(rendered.includes('Endings'), 'no endings section');
  // No denominators, no percentages, no locked counts.
  assert.equal(/\d+\s*\/\s*\d+/.test(rendered), false, `collection shows a ratio: ${rendered}`);
  assert.equal(/\bof\s+\d+\b/i.test(rendered), false, 'collection states a total');
  assert.equal(/%/.test(rendered), false, 'collection shows a percentage');
});

test('an undiscovered category is absent rather than shown locked', () => {
  // A row of question marks is itself a statement about how much content exists.
  const profile = emptyProfile();
  profile.discovered.push('WPN-001');
  const { menus } = makeMenus({ profile });
  menus.open(SCREEN.COLLECTION);
  const labels = menus.items().map((i) => i.label);
  assert.ok(labels.includes('Weapons'));
  assert.equal(labels.includes('Managers'), false, 'an empty category was still listed');
  assert.equal(labels.some((l) => l.includes('?')), false, 'a locked placeholder was drawn');
});

test('an empty collection says so plainly', () => {
  const { menus } = makeMenus();
  menus.open(SCREEN.COLLECTION);
  const labels = menus.items().map((i) => i.label);
  assert.equal(labels.length, 1);
  assert.ok(labels[0].toLowerCase().includes('nothing'));
});

test('only unlocked employee profiles and challenges are offered', () => {
  // GDD 16.6 gates profiles behind feats, and a challenge may require an unlock of its own.
  const profile = emptyProfile();
  const { menus } = makeMenus({ profile });
  menus.open(SCREEN.TITLE);
  const employee = menus.items().find((i) => i.label === 'Employee');
  assert.deepEqual(employee.values, ['PRF-001'], 'a locked profile was selectable');

  const gated = registry.all('challenge').filter((c) => c.unlockId);
  assert.ok(gated.length > 0, 'no challenge is unlock-gated, so this proves nothing');
  const challenge = menus.items().find((i) => i.label === 'Challenge');
  if (challenge) {
    for (const c of gated) {
      assert.equal(challenge.values.includes(c.id), false, `${c.id} was offered without its unlock`);
    }
  }
});

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

test('every screen draws without throwing, at every text scale', () => {
  // The menus are the one place a player can be stuck with no way out, so a draw that throws
  // is unrecoverable rather than ugly.
  const profile = emptyProfile();
  profile.discovered.push('WPN-001', 'ITM-001');
  profile.endings.push('END-001');
  for (const scale of [0.8, 1, 1.6]) {
    const { menus, settings } = makeMenus({ profile });
    settings.textScale = scale;
    for (const screen of Object.values(SCREEN)) {
      menus.closeAll();
      menus.open(screen);
      menus.draw({ results: { floorsReached: 3, bossesDefeated: 1, seed: 'OFFICE-TEST-0001' } });
    }
  }
});

test('navigation cannot run off either end of a list', () => {
  const { menus } = makeMenus();
  menus.open(SCREEN.OPTIONS);
  for (let i = 0; i < 50; i += 1) menus.update(0.016, input([ACTION.MOVE_DOWN]));
  assert.ok(menus.cursor < menus.items().length, 'cursor ran past the last item');
  for (let i = 0; i < 50; i += 1) menus.update(0.016, input([ACTION.MOVE_UP]));
  assert.equal(menus.cursor, 0, 'cursor ran past the first item');
});

// ---------------------------------------------------------------------------
// GDD 17.6: the settings have to actually do something
// ---------------------------------------------------------------------------

test('an accessibility toggle reaches the renderer and the camera', async () => {
  // The bug this catches: the renderer and camera each keep their own settings object, and
  // nothing read the SAVED ones. Every toggle in Options changed a value on disk and nothing
  // on screen — an accessibility screen that was decorative.
  installDomShim();
  globalThis.__OI_NO_AUTOBOOT = true;
  const { Game } = await import('../src/main.js');
  const game = new Game(makeCanvas());

  game.settings.grayscale = true;
  game.settings.reducedMotion = true;
  game.settings.reducedEffects = true;
  game.applyDisplaySettings();

  assert.equal(game.renderer.settings.grayscale, true, 'grayscale never reached the renderer');
  assert.ok(game.renderer.settings.particleDensity < 1, 'reduced effects did not thin particles');
  assert.ok(game.renderer.settings.flashIntensity < 1, 'reduced motion did not calm flashes');
  assert.equal(game.camera.shakeScale, 0, 'reduced motion did not stop screen shake');

  // And back again, so the settings are genuinely two-way.
  game.settings.grayscale = false;
  game.settings.reducedMotion = false;
  game.settings.reducedEffects = false;
  game.applyDisplaySettings();
  assert.equal(game.renderer.settings.grayscale, false);
  assert.equal(game.renderer.settings.particleDensity, 1);
  assert.equal(game.camera.shakeScale, 1);
});

test('every setting the Options screen exposes exists in the save', () => {
  // An Options row bound to a field the save does not have would read as undefined, display
  // as "[off]", and silently fail to persist.
  const { menus } = makeMenus();
  menus.open(SCREEN.OPTIONS);
  const defaults = emptySettings();
  for (const entry of menus.items()) {
    if (!entry.get) continue;
    const value = entry.get();
    assert.notEqual(value, undefined, `"${entry.label}" is bound to a field missing from the save`);
  }
  // Spot-check the two added late, since those are the ones most likely to have been missed.
  assert.notEqual(defaults.highContrast, undefined);
  assert.notEqual(defaults.textScale, undefined);
});
