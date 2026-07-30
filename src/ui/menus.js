/**
 * Menus: title, pause, options, collection, and run results.
 *
 * GDD refs: 17.1 (the UI law: the player sees what they need now, and is not asked to
 *           manage a dashboard), 17.5 (the menu table below is that table), 17.6
 *           (accessibility: remappable input, hold/toggle alternatives, scalable text,
 *           colour-vision presets, reduced motion), 21.1 (settings and profile are save
 *           domains), 21.2 (restarting a run uses hold confirmation and deliberately
 *           discards it), R-PRG-004 / D-016 (the collection shows what was found and never
 *           a denominator), R-UIX-005 (no mechanic depends on colour alone),
 *           R-UIX-003 (unknown content totals stay hidden — see #collectionItems),
 *           R-UIX-004 (accessibility settings expose no loot-weight or rarity tuning:
 *           #optionsItems deliberately holds audio, display, input and privacy rows and
 *           nothing that reaches generation).
 *
 * ## One screen at a time, and one owner of "is the game paused"
 *
 * A stack rather than a set of booleans. Pause opens over gameplay, Options opens over
 * Pause, and Cancel always means "back one screen" — with a boolean per menu, the state
 * "options open but pause closed" exists and has to be reasoned about. With a stack it
 * cannot be represented.
 *
 * `blocksGameplay` is derived from the stack rather than stored, so it is impossible for the
 * simulation to keep running under a menu because someone forgot to set a flag.
 *
 * ## Why the collection has no totals
 *
 * D-016 forbids the game announcing its own size, so the collection lists what the player
 * has found and stops. No "12 of 60", no locked silhouettes with question marks, no
 * percentage. This is easy to regress by adding a helpful counter, and there is a test that
 * fails if a denominator appears.
 */

import { LAYER_ORDER } from '../render/renderer.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../core/constants.js';
import { ACTION } from '../systems/input.js';

/** GDD 17.5's menus. */
export const SCREEN = Object.freeze({
  TITLE: 'TITLE',
  PAUSE: 'PAUSE',
  OPTIONS: 'OPTIONS',
  COLLECTION: 'COLLECTION',
  CONTROLS: 'CONTROLS',
  RESULTS: 'RESULTS',
});

/** How long Restart must be held. GDD 21.2 wants a deliberate act, not a stray keypress. */
const HOLD_SECONDS = 0.9;

const PAD = 28;

/**
 * One menu item.
 *
 * `kind` decides how it renders and what left/right do: an ACTION runs on confirm, a TOGGLE
 * flips a setting, a SLIDER nudges a number, a CHOICE cycles a list.
 */
const item = (kind, label, spec = {}) => ({ kind, label, ...spec });

/**
 * Which actions the Controls screen offers, in the order GDD 4.1 lists them.
 *
 * CONFIRM and CANCEL are deliberately absent. They are the keys the menus themselves run on,
 * so binding them from inside a menu is the one rebind that can remove the player's way out
 * of the screen they are standing in. Everything reachable during play is here.
 */
const BINDABLE = Object.freeze([
  [ACTION.MOVE_UP, 'Move up'],
  [ACTION.MOVE_DOWN, 'Move down'],
  [ACTION.MOVE_LEFT, 'Move left'],
  [ACTION.MOVE_RIGHT, 'Move right'],
  [ACTION.AIM_UP, 'Fire up'],
  [ACTION.AIM_DOWN, 'Fire down'],
  [ACTION.AIM_LEFT, 'Fire left'],
  [ACTION.AIM_RIGHT, 'Fire right'],
  [ACTION.USE_ACTIVE, 'Active item'],
  [ACTION.USE_POCKET, 'Pocket item'],
  [ACTION.INTERACT, 'Interact'],
  [ACTION.DROP, 'Drop weapon'],
  [ACTION.MAP, 'Map'],
  [ACTION.PAUSE, 'Pause'],
]);

const LABEL_FOR_ACTION = Object.fromEntries(BINDABLE);

/** A KeyboardEvent.code turned into what is printed on the key. */
function keyLabel(code) {
  if (!code) return 'unbound';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Arrow')) return `${code.slice(5)} arrow`;
  return {
    Space: 'Space', Enter: 'Enter', Tab: 'Tab', Escape: 'Escape', Backspace: 'Backspace',
    ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl',
    ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
    AltLeft: 'Left Alt', AltRight: 'Right Alt',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
    Backquote: '`', CapsLock: 'Caps Lock',
  }[code] ?? code;
}

/**
 * A standard-mapping gamepad button index turned into a name.
 *
 * Face buttons are given by position rather than by letter, because the same index is A on an
 * Xbox pad and Cross on a PlayStation one, and printing the wrong letter is worse than
 * printing none.
 */
function padLabel(index) {
  if (index === undefined || index === null) return 'unbound';
  return {
    0: 'Bottom face', 1: 'Right face', 2: 'Left face', 3: 'Top face',
    4: 'Left bumper', 5: 'Right bumper', 6: 'Left trigger', 7: 'Right trigger',
    8: 'View / Select', 9: 'Menu / Start', 10: 'Left stick', 11: 'Right stick',
    12: 'D-pad up', 13: 'D-pad down', 14: 'D-pad left', 15: 'D-pad right',
  }[index] ?? `Button ${index}`;
}

export class MenuSystem {
  /**
   * @param {object} deps
   * @param {object} deps.renderer
   * @param {object} deps.registry
   * @param {object} deps.settings mutable settings save domain
   * @param {object} deps.profile mutable profile save domain
   * @param {object} deps.save SaveService
   * @param {(key: string) => string} deps.loc
   * @param {object} deps.actions callbacks the menus invoke: newRun, resume, restart, quitToTitle
   */
  constructor({ renderer, registry, settings, profile, save, loc, input = null, actions = {} }) {
    this.renderer = renderer;
    /** The live InputSystem, so the Controls screen reads and writes real bindings. */
    this.input = input;
    /** Which device the Controls screen is editing. */
    this.controlsDevice = 'KEYBOARD';
    /** One line of feedback under the Controls list: what was just bound, or what was lost. */
    this.rebindNote = '';
    this.registry = registry;
    this.settings = settings;
    this.profile = profile;
    this.save = save;
    this.loc = loc || ((k) => k);
    this.actions = actions;

    /** Screen stack. The top of the stack is what the player sees and drives. */
    this.stack = [];
    this.cursor = 0;
    this.holdTimer = 0;
    this.scroll = 0;
    /** Set while a run is live, so Title offers Continue and Pause is reachable. */
    this.hasRun = false;
  }

  /**
   * Is a menu swallowing gameplay right now?
   *
   * Derived, never stored. A stored flag can disagree with the stack; this cannot.
   */
  get blocksGameplay() {
    return this.stack.length > 0;
  }

  get current() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  open(screen) {
    if (this.current === screen) return;
    this.stack.push(screen);
    this.cursor = 0;
    this.scroll = 0;
    this.holdTimer = 0;
  }

  /** Back one screen. Returns false when there was nothing to close. */
  back() {
    if (this.stack.length === 0) return false;
    // A capture that outlives its screen would swallow every key with no UI explaining why.
    if (this.input?.capturing) this.input.cancelCapture();
    this.rebindNote = '';
    this.stack.pop();
    this.cursor = 0;
    this.scroll = 0;
    this.holdTimer = 0;
    // Settings are a save domain (GDD 21.1), so leaving Options is a natural commit point.
    if (this.save) this.save.saveSettings(this.settings);
    return true;
  }

  closeAll() {
    this.stack.length = 0;
    this.cursor = 0;
    this.holdTimer = 0;
  }

  // -------------------------------------------------------------------------
  // Item lists
  // -------------------------------------------------------------------------

  /** The items for the current screen, rebuilt each frame so state changes show. */
  items() {
    switch (this.current) {
      case SCREEN.TITLE: return this.#titleItems();
      case SCREEN.PAUSE: return this.#pauseItems();
      case SCREEN.OPTIONS: return this.#optionsItems();
      case SCREEN.CONTROLS: return this.#controlsItems();
      case SCREEN.COLLECTION: return this.#collectionItems();
      case SCREEN.RESULTS: return [item('ACTION', 'Continue', { run: () => this.actions.quitToTitle?.() })];
      default: return [];
    }
  }

  #titleItems() {
    const out = [];
    // Continue only appears when there is something to continue. Offering it and then
    // failing would be worse than not offering it (GDD 21.2).
    if (this.save?.hasRun?.()) {
      out.push(item('ACTION', 'Continue', { run: () => this.actions.continueRun?.() }));
    }
    out.push(item('ACTION', 'New run', { run: () => this.actions.newRun?.() }));
    out.push(item('CHOICE', 'Employee', {
      // Only unlocked profiles are offered (GDD 16.6). PRF-001 is always present.
      values: this.profile.profiles,
      get: () => this.profile.selectedProfile ?? this.profile.profiles[0],
      set: (v) => { this.profile.selectedProfile = v; },
      display: (v) => this.loc(this.registry.get('profile', v)?.nameLoc ?? v),
    }));
    const challenges = this.#availableChallenges();
    if (challenges.length > 0) {
      out.push(item('CHOICE', 'Challenge', {
        values: ['NONE', ...challenges.map((c) => c.id)],
        get: () => this.profile.selectedChallenge ?? 'NONE',
        set: (v) => { this.profile.selectedChallenge = v === 'NONE' ? null : v; },
        display: (v) => (v === 'NONE' ? 'None' : this.loc(this.registry.get('challenge', v)?.nameLoc ?? v)),
      }));
    }
    out.push(item('ACTION', 'Options', { run: () => this.open(SCREEN.OPTIONS) }));
    out.push(item('ACTION', 'Collection', { run: () => this.open(SCREEN.COLLECTION) }));
    return out;
  }

  /** A challenge is offered when it needs no unlock, or the player has that unlock. */
  #availableChallenges() {
    return this.registry.all('challenge').filter((c) => (
      !c.unlockId || this.profile.granted.includes(c.unlockId)
    ));
  }

  #pauseItems() {
    return [
      item('ACTION', 'Resume', { run: () => this.closeAll() }),
      item('ACTION', 'Controls', { run: () => this.open(SCREEN.CONTROLS) }),
      item('ACTION', 'Options', { run: () => this.open(SCREEN.OPTIONS) }),
      item('ACTION', 'Collection', { run: () => this.open(SCREEN.COLLECTION) }),
      // GDD 21.2: restarting is deliberate, so it is a hold rather than a press.
      item('HOLD', 'Restart run', { run: () => this.actions.restart?.() }),
      item('HOLD', 'Exit to title', { run: () => this.actions.quitToTitle?.() }),
    ];
  }

  #optionsItems() {
    const s = this.settings;
    const pct = (v) => `${Math.round(v * 100)}%`;
    return [
      item('SLIDER', 'Master volume', { get: () => s.masterVolume, set: (v) => { s.masterVolume = v; }, display: pct }),
      item('SLIDER', 'Music volume', { get: () => s.musicVolume, set: (v) => { s.musicVolume = v; }, display: pct }),
      item('SLIDER', 'Sound volume', { get: () => s.sfxVolume, set: (v) => { s.sfxVolume = v; }, display: pct }),
      // GDD 17.6's accessibility list. Every one of these is honoured somewhere in the
      // renderer, the camera, or the audio engine — none is a placeholder.
      item('TOGGLE', 'Audio captions', { get: () => s.captions, set: (v) => { s.captions = v; } }),
      item('TOGGLE', 'High contrast', { get: () => s.highContrast, set: (v) => { s.highContrast = v; } }),
      item('TOGGLE', 'Grayscale', { get: () => s.grayscale, set: (v) => { s.grayscale = v; } }),
      item('TOGGLE', 'Reduced motion', { get: () => s.reducedMotion, set: (v) => { s.reducedMotion = v; } }),
      item('TOGGLE', 'Reduced effects', { get: () => s.reducedEffects, set: (v) => { s.reducedEffects = v; } }),
      item('SLIDER', 'Text size', {
        get: () => s.textScale ?? 1, set: (v) => { s.textScale = v; },
        min: 0.8, max: 1.6, step: 0.1, display: (v) => `${v.toFixed(1)}x`,
      }),
      item('CHOICE', 'Fire', {
        values: ['HOLD', 'TOGGLE'], get: () => s.fireMode, set: (v) => { s.fireMode = v; },
      }),
      item('CHOICE', 'Map', {
        values: ['HOLD', 'TOGGLE'], get: () => s.mapMode, set: (v) => { s.mapMode = v; },
      }),
      // GDD 21.4: telemetry is opt-in and visible, never assumed.
      item('TOGGLE', 'Share diagnostics', { get: () => s.telemetry, set: (v) => { s.telemetry = v; } }),
    ];
  }

  /**
   * Controls, remappable (GDD 17.6).
   *
   * Every row reads its key from the live bindings rather than from a written-down list.
   * The previous version hard-coded the labels, and they had already drifted — it advertised
   * Interact on F when the default is E — which is worse than no screen at all, because a
   * player who cannot make the listed key work concludes the game is broken.
   *
   * `device` is a CHOICE at the top rather than two separate screens: the action list is the
   * same for both, and duplicating it would let the two lists disagree.
   */
  #controlsItems() {
    if (!this.input) {
      return [item('LABEL', 'Controls unavailable', { value: '' })];
    }
    const gamepad = this.controlsDevice === 'GAMEPAD';
    const out = [
      item('CHOICE', 'Device', {
        values: ['KEYBOARD', 'GAMEPAD'],
        get: () => this.controlsDevice,
        set: (v) => { this.controlsDevice = v; },
        display: (v) => (v === 'GAMEPAD' ? 'Controller' : 'Keyboard'),
      }),
      item('HEADER', gamepad ? 'Controller buttons' : 'Keyboard keys'),
    ];

    for (const [action, label] of BINDABLE) {
      const bound = gamepad ? this.input.buttonFor(action) : this.input.codeFor(action);
      out.push(item('REBIND', label, {
        action,
        // An unbound action is stated plainly. It is a legitimate state — displacing a key
        // leaves its old owner unbound — and hiding it is how a player loses Pause silently.
        value: bound === undefined
          ? 'unbound'
          : (gamepad ? padLabel(bound) : keyLabel(bound)),
        run: () => this.beginRebind(action),
      }));
    }

    out.push(item('HEADER', ''));
    out.push(item('HOLD', 'Hold to restore defaults', {
      run: () => {
        this.input.resetBindings(this.controlsDevice);
        this.rebindNote = 'Defaults restored.';
        this.#commitBindings();
      },
    }));
    return out;
  }

  /**
   * Enter capture mode for one action.
   *
   * The note is set before capture begins so the prompt is on screen for the frame the player
   * is deciding on, not one frame late.
   */
  beginRebind(action) {
    if (!this.input) return;
    this.rebindNote = this.controlsDevice === 'GAMEPAD'
      ? 'Press a controller button. Escape cancels.'
      : 'Press a key. Escape cancels.';
    this.input.beginCapture(action, this.controlsDevice, (result) => {
      if (!result) {
        this.rebindNote = 'Unchanged.';
        return;
      }
      const label = this.controlsDevice === 'GAMEPAD'
        ? padLabel(result.button)
        : keyLabel(result.code);
      this.rebindNote = result.displaced
        ? `${label} bound. ${LABEL_FOR_ACTION[result.displaced] ?? result.displaced} is now unbound.`
        : `${label} bound.`;
      this.#commitBindings();
    });
  }

  /** Bindings live in the settings save domain, so a rebind is written through immediately. */
  #commitBindings() {
    if (!this.input || !this.settings) return;
    this.settings.input = this.input.save();
    this.save?.saveSettings?.(this.settings);
    this.actions.settingsChanged?.();
  }

  /**
   * The collection.
   *
   * D-016: what the player has found, and nothing about what they have not. No totals, no
   * locked rows, no percentage. A category with nothing in it is simply absent.
   */
  #collectionItems() {
    const found = new Set(this.profile.discovered);
    const out = [];
    const section = (label, kind) => {
      const rows = this.registry.all(kind).filter((d) => found.has(d.id));
      if (rows.length === 0) return;
      out.push(item('HEADER', label));
      for (const def of rows) {
        out.push(item('LABEL', this.loc(def.nameLoc), { value: '' }));
      }
    };
    section('Weapons', 'weapon');
    section('Items', 'passive');
    section('Active items', 'active');
    section('Action Cards', 'card');
    section('Supplements', 'supplement');
    section('Desk Charms', 'charm');
    section('Enemies', 'enemy');
    section('Managers', 'boss');

    // Endings are recorded separately, in the order they were seen.
    if (this.profile.endings.length > 0) {
      out.push(item('HEADER', 'Endings'));
      for (const id of this.profile.endings) {
        const def = this.registry.get('ending', id);
        out.push(item('LABEL', this.loc(def?.nameLoc ?? id), { value: '' }));
      }
    }
    if (out.length === 0) out.push(item('LABEL', 'Nothing recorded yet.', { value: '' }));
    return out;
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  /**
   * Drive the current menu.
   *
   * @param {number} dt
   * @param {object} input sampled input state, with `pressed` and `isHeld`
   * @returns {boolean} true when a menu consumed the input
   */
  update(dt, input) {
    if (!this.current) {
      // Pause is the only way in from gameplay.
      if (input?.pressed?.has?.(ACTION.PAUSE) && this.hasRun) {
        this.open(SCREEN.PAUSE);
        return true;
      }
      return false;
    }

    const items = this.items();
    const selectable = items.filter((i) => i.kind !== 'HEADER' && i.kind !== 'LABEL');
    const pressed = input?.pressed ?? new Set();

    if (pressed.has(ACTION.CANCEL) || pressed.has(ACTION.PAUSE)) {
      // Escape from the title screen would leave the player nowhere, so the title has no
      // "back".
      if (this.current !== SCREEN.TITLE) this.back();
      return true;
    }

    // Navigation works on the scrollable list including labels, so a long collection can be
    // read; confirm only ever lands on something selectable.
    const navMax = Math.max(0, items.length - 1);
    if (pressed.has(ACTION.MOVE_UP) || pressed.has(ACTION.AIM_UP)) this.cursor = Math.max(0, this.cursor - 1);
    if (pressed.has(ACTION.MOVE_DOWN) || pressed.has(ACTION.AIM_DOWN)) this.cursor = Math.min(navMax, this.cursor + 1);

    const active = items[this.cursor];
    if (!active) return true;

    const left = pressed.has(ACTION.MOVE_LEFT) || pressed.has(ACTION.AIM_LEFT);
    const right = pressed.has(ACTION.MOVE_RIGHT) || pressed.has(ACTION.AIM_RIGHT);
    if (left || right) this.#nudge(active, right ? 1 : -1);

    if (active.kind === 'HOLD') {
      // The hold has to be continuous: releasing resets it, so a leaned-on key cannot
      // gradually restart the run.
      if (input?.isHeld?.(ACTION.CONFIRM)) {
        this.holdTimer += dt;
        if (this.holdTimer >= HOLD_SECONDS) {
          this.holdTimer = 0;
          active.run?.();
        }
      } else {
        this.holdTimer = 0;
      }
      return true;
    }

    if (pressed.has(ACTION.CONFIRM)) {
      if (active.kind === 'ACTION' || active.kind === 'REBIND') active.run?.();
      else if (active.kind === 'TOGGLE') this.#nudge(active, 1);
      else if (active.kind === 'CHOICE') this.#nudge(active, 1);
    }
    return true;
  }

  /** Apply a left/right adjustment, and tell the game so audio can react immediately. */
  #nudge(entry, direction) {
    if (entry.kind === 'TOGGLE') {
      entry.set(!entry.get());
    } else if (entry.kind === 'SLIDER') {
      const step = entry.step ?? 0.05;
      const min = entry.min ?? 0;
      const max = entry.max ?? 1;
      const next = Math.min(max, Math.max(min, entry.get() + direction * step));
      // Rounded, or repeated floating-point steps drift to values like 0.7000000000000001
      // and the display flickers between 70% and 71%.
      entry.set(Math.round(next * 1000) / 1000);
    } else if (entry.kind === 'CHOICE') {
      const values = entry.values || [];
      if (values.length === 0) return;
      const at = Math.max(0, values.indexOf(entry.get()));
      entry.set(values[(at + direction + values.length) % values.length]);
    } else {
      return;
    }
    this.actions.settingsChanged?.();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  draw({ results } = {}) {
    if (!this.current) return;
    const items = this.items();
    const title = this.current === SCREEN.TITLE ? 'OFFICE ISAAC' : this.#screenTitle();
    const scale = this.settings.textScale ?? 1;
    const rowHeight = Math.round(15 * scale);

    // Keep the cursor on screen in a long list.
    const visibleRows = Math.floor((LOGICAL_HEIGHT - PAD * 3 - 40) / rowHeight);
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    if (this.cursor >= this.scroll + visibleRows) this.scroll = this.cursor - visibleRows + 1;

    this.renderer.push(LAYER_ORDER.OVERLAY, (c) => {
      c.fillStyle = 'rgba(4,4,9,0.9)';
      c.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = `${Math.round(20 * scale)}px "Courier New", monospace`;
      c.fillStyle = '#eef0f6';
      c.fillText(title, PAD, PAD + 6);

      c.font = `${Math.round(12 * scale)}px "Courier New", monospace`;
      let y = PAD + 40;
      for (let i = this.scroll; i < items.length && i < this.scroll + visibleRows; i += 1) {
        const entry = items[i];
        const selected = i === this.cursor;

        if (entry.kind === 'HEADER') {
          c.fillStyle = '#7fb0ee';
          c.fillText(entry.label, PAD, y);
        } else {
          // Selection is marked with a caret AND a brightness change: R-UIX-005 forbids a
          // state that reads only as colour.
          c.fillStyle = selected ? '#ffffff' : '#9a9aae';
          c.fillText(`${selected ? '>' : ' '} ${entry.label}`, PAD, y);
          const value = this.#valueText(entry);
          if (value !== null) {
            c.textAlign = 'right';
            c.fillText(value, LOGICAL_WIDTH - PAD, y);
            c.textAlign = 'left';
          }
          if (entry.kind === 'HOLD' && selected && this.holdTimer > 0) {
            const width = (LOGICAL_WIDTH - PAD * 2) * (this.holdTimer / HOLD_SECONDS);
            c.fillStyle = '#e04a54';
            c.fillRect(PAD, y + rowHeight * 0.42, width, 2);
          }
        }
        y += rowHeight;
      }

      if (results) this.#drawResults(c, results, scale);

      c.textAlign = 'center';

      // What the last rebind did, including anything it unbound. Drawn above the hint and in
      // a brighter colour, because "Pause is now unbound" is the one message on this screen
      // the player must not miss.
      if (this.rebindNote && this.current === SCREEN.CONTROLS) {
        c.fillStyle = '#e8c246';
        c.font = `${Math.round(11 * scale)}px "Courier New", monospace`;
        c.fillText(this.rebindNote, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - PAD - Math.round(16 * scale));
      }

      c.fillStyle = '#6d6d84';
      c.font = `${Math.round(10 * scale)}px "Courier New", monospace`;
      let hint = 'arrows to move, Enter to select, Esc to go back';
      if (this.input?.capturing) hint = 'listening for an input — Esc cancels';
      else if (items[this.cursor]?.kind === 'HOLD') hint = 'hold Enter to confirm';
      else if (items[this.cursor]?.kind === 'REBIND') hint = 'Enter to rebind this action';
      c.fillText(hint, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - PAD);
    });
  }

  #screenTitle() {
    return {
      [SCREEN.PAUSE]: 'Paused',
      [SCREEN.OPTIONS]: 'Options',
      [SCREEN.COLLECTION]: 'Collection',
      [SCREEN.CONTROLS]: 'Controls',
      [SCREEN.RESULTS]: 'Run over',
    }[this.current] ?? '';
  }

  #valueText(entry) {
    if (entry.kind === 'TOGGLE') return entry.get() ? '[on]' : '[off]';
    if (entry.kind === 'SLIDER' || entry.kind === 'CHOICE') {
      const raw = entry.get();
      return entry.display ? entry.display(raw) : String(raw);
    }
    if (entry.kind === 'REBIND') {
      // The row being captured says so in place of its key, so the prompt is where the
      // player is already looking rather than only at the bottom of the screen.
      const listening = this.input?.capturing && this.input.captureAction === entry.action;
      return listening ? 'press a key...' : (entry.value ?? 'unbound');
    }
    if (entry.kind === 'LABEL') return entry.value ?? null;
    return null;
  }

  /**
   * Run results (GDD 17.5).
   *
   * Floors reached, bosses defeated, the seed, and what was newly discovered. Explicitly no
   * grade — the GDD says none is required, and a letter grade on a death screen turns a
   * roguelike run into a report card.
   */
  #drawResults(c, results, scale) {
    c.textAlign = 'left';
    c.font = `${Math.round(12 * scale)}px "Courier New", monospace`;
    c.fillStyle = '#c8c8d6';
    let y = LOGICAL_HEIGHT / 2;
    const line = (text) => { c.fillText(text, LOGICAL_WIDTH / 2, y); y += Math.round(16 * scale); };
    c.textAlign = 'center';
    line(results.endingName ? this.loc(results.endingName) : 'Terminated');
    line(`Floors reached: ${results.floorsReached ?? 0}`);
    line(`Managers defeated: ${results.bossesDefeated ?? 0}`);
    line(`Seed: ${results.seed ?? '-'}`);
    c.textAlign = 'left';
  }
}
