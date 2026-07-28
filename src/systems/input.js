/**
 * Input.
 *
 * GDD refs: 4.1 (baseline controls table), 4.2 (aiming rules), 17.6 (fully
 *           remappable keyboard and controller; dead-zone and cardinal-aim snap
 *           adjustment; hold/toggle alternatives for sustained firing and map),
 *           R-PLY-002 (movement stays responsive while firing), 6.2 (enemy
 *           attacks never read controller input to cheat reactions).
 *
 * The subtle rule is GDD 4.2's: "Simultaneous cardinal inputs resolve according to
 * weapon capability. Without a diagonal-enabling modifier, the most recent valid
 * direction wins." So this module keeps aim keys in a press-order stack rather than
 * a set — holding Right then pressing Up must aim up, and releasing Up must fall
 * back to right. A set cannot express that.
 *
 * Movement is separate and always eight-way: only *aim* is restricted to cardinals
 * until the Numeric Keypad passive is owned.
 */

import { OCTANT_ANGLE, OCTANTS } from '../core/constants.js';
import { clamp, vectorToCardinal, vectorToOctant } from '../core/math.js';

/** Logical actions. Bindings map physical inputs onto these. */
export const ACTION = Object.freeze({
  MOVE_UP: 'MOVE_UP',
  MOVE_DOWN: 'MOVE_DOWN',
  MOVE_LEFT: 'MOVE_LEFT',
  MOVE_RIGHT: 'MOVE_RIGHT',
  AIM_UP: 'AIM_UP',
  AIM_DOWN: 'AIM_DOWN',
  AIM_LEFT: 'AIM_LEFT',
  AIM_RIGHT: 'AIM_RIGHT',
  USE_ACTIVE: 'USE_ACTIVE',
  USE_POCKET: 'USE_POCKET',
  INTERACT: 'INTERACT',
  DROP: 'DROP',
  MAP: 'MAP',
  PAUSE: 'PAUSE',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
});

/** Default keyboard bindings, straight from the GDD 4.1 table. */
export const DEFAULT_KEYBOARD = Object.freeze({
  KeyW: ACTION.MOVE_UP,
  KeyS: ACTION.MOVE_DOWN,
  KeyA: ACTION.MOVE_LEFT,
  KeyD: ACTION.MOVE_RIGHT,
  ArrowUp: ACTION.AIM_UP,
  ArrowDown: ACTION.AIM_DOWN,
  ArrowLeft: ACTION.AIM_LEFT,
  ArrowRight: ACTION.AIM_RIGHT,
  Space: ACTION.USE_ACTIVE,
  KeyQ: ACTION.USE_POCKET,
  KeyE: ACTION.INTERACT,
  Enter: ACTION.CONFIRM,
  ControlLeft: ACTION.DROP,
  Tab: ACTION.MAP,
  Escape: ACTION.PAUSE,
  Backspace: ACTION.CANCEL,
});

/** Default gamepad bindings (standard mapping button indices). */
export const DEFAULT_GAMEPAD = Object.freeze({
  0: ACTION.INTERACT,   // south face
  1: ACTION.CANCEL,     // east face
  4: ACTION.USE_ACTIVE, // left bumper
  5: ACTION.USE_POCKET, // right bumper
  7: ACTION.DROP,       // right trigger
  8: ACTION.MAP,        // view / select
  9: ACTION.PAUSE,      // menu
  12: ACTION.MOVE_UP,
  13: ACTION.MOVE_DOWN,
  14: ACTION.MOVE_LEFT,
  15: ACTION.MOVE_RIGHT,
});

const AIM_ACTIONS = Object.freeze({
  [ACTION.AIM_UP]: 'NORTH',
  [ACTION.AIM_DOWN]: 'SOUTH',
  [ACTION.AIM_LEFT]: 'WEST',
  [ACTION.AIM_RIGHT]: 'EAST',
});

const CARDINAL_VECTOR = Object.freeze({
  NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0],
});

/**
 * One frame's worth of resolved intent. The simulation reads only this, never the
 * raw devices, which keeps replay and headless testing possible.
 */
export class InputState {
  constructor() {
    this.moveX = 0;
    this.moveY = 0;
    /** Analog magnitude 0..1. Keyboard normalises to 1 (GDD 4.1). */
    this.moveMagnitude = 0;
    /** Whether the attack input is held at all. */
    this.firing = false;
    /** Resolved aim direction name, or null. */
    this.aimDirection = null;
    /** Aim angle in radians, derived from aimDirection. */
    this.aimAngle = 0;
    /** Raw aim vector before cardinal/octant resolution (right stick). */
    this.aimRawX = 0;
    this.aimRawY = 0;
    /** Edge-triggered actions consumed once. */
    this.pressed = new Set();
    /** Held actions. */
    this.held = new Set();
  }

  justPressed(action) {
    return this.pressed.has(action);
  }

  isHeld(action) {
    return this.held.has(action);
  }
}

export class InputSystem {
  constructor(opts = {}) {
    this.keyboard = { ...DEFAULT_KEYBOARD, ...(opts.keyboard || {}) };
    this.gamepad = { ...DEFAULT_GAMEPAD, ...(opts.gamepad || {}) };
    /** Accessibility: stick dead zone (GDD 17.6). */
    this.deadZone = opts.deadZone ?? 0.22;
    /**
     * Accessibility: how strongly right-stick aim snaps to cardinals. 1 means a
     * full snap, 0 means raw. Weapons that only accept cardinals snap regardless;
     * this affects weapons that support eight directions.
     */
    this.aimSnap = opts.aimSnap ?? 1;
    /** Hold-to-fire vs toggle-to-fire (GDD 17.6). */
    this.fireMode = opts.fireMode ?? 'HOLD';
    this.mapMode = opts.mapMode ?? 'HOLD';

    /** Physical key -> down. */
    this.keysDown = new Set();
    /** Press-order stack of aim directions; last entry wins (GDD 4.2). */
    this.aimStack = [];
    /** Actions that went down this frame. */
    this.edge = new Set();
    /** Latched state for toggle modes. */
    this.fireToggle = false;
    this.mapToggle = false;

    this.state = new InputState();
    this.gamepadIndex = null;
    /** True while a rebinding UI is capturing, so gameplay ignores input. */
    this.capturing = false;
    this._listeners = [];
  }

  /** Attach DOM listeners. Browser only. */
  attach(target = globalThis) {
    const onKeyDown = (e) => {
      if (this.capturing) return;
      const action = this.keyboard[e.code];
      // Tab and Space would otherwise scroll or move focus out of the canvas.
      if (action) e.preventDefault();
      if (this.keysDown.has(e.code)) return; // ignore auto-repeat
      this.keysDown.add(e.code);
      if (!action) return;
      this.edge.add(action);
      const dir = AIM_ACTIONS[action];
      if (dir) {
        // Most recent valid direction wins: move it to the top of the stack.
        const existing = this.aimStack.indexOf(dir);
        if (existing >= 0) this.aimStack.splice(existing, 1);
        this.aimStack.push(dir);
      }
      if (action === ACTION.MAP && this.mapMode === 'TOGGLE') this.mapToggle = !this.mapToggle;
    };
    const onKeyUp = (e) => {
      this.keysDown.delete(e.code);
      const action = this.keyboard[e.code];
      const dir = action && AIM_ACTIONS[action];
      if (dir) {
        const existing = this.aimStack.indexOf(dir);
        if (existing >= 0) this.aimStack.splice(existing, 1);
      }
    };
    // Losing focus mid-hold would otherwise leave the player walking forever.
    const onBlur = () => this.reset();

    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
    this._listeners = [
      ['keydown', onKeyDown], ['keyup', onKeyUp], ['blur', onBlur],
    ].map(([type, fn]) => () => target.removeEventListener(type, fn));
    return this;
  }

  detach() {
    for (const off of this._listeners) off();
    this._listeners = [];
  }

  reset() {
    this.keysDown.clear();
    this.aimStack.length = 0;
    this.edge.clear();
    this.state.held.clear();
    this.state.pressed.clear();
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.state.moveMagnitude = 0;
    this.state.firing = false;
    this.state.aimDirection = null;
  }

  /**
   * Resolve one frame of intent.
   *
   * @param {object} caps weapon/build capabilities
   * @param {boolean} caps.eightDirection Numeric Keypad owned (ITM-012)
   * @returns {InputState}
   */
  sample(caps = {}) {
    const s = this.state;
    s.pressed = new Set(this.edge);
    this.edge.clear();
    s.held.clear();

    const heldActions = new Set();
    for (const code of this.keysDown) {
      const action = this.keyboard[code];
      if (action) heldActions.add(action);
    }

    const pad = this.#readGamepad(heldActions);

    for (const action of heldActions) s.held.add(action);

    // ---- movement: always eight-way, normalised on keyboard (GDD 4.1) ------
    let mx = 0;
    let my = 0;
    if (heldActions.has(ACTION.MOVE_LEFT)) mx -= 1;
    if (heldActions.has(ACTION.MOVE_RIGHT)) mx += 1;
    if (heldActions.has(ACTION.MOVE_UP)) my -= 1;
    if (heldActions.has(ACTION.MOVE_DOWN)) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      s.moveX = mx / len;
      s.moveY = my / len;
      s.moveMagnitude = 1;
    } else if (pad && (pad.moveX !== 0 || pad.moveY !== 0)) {
      // Analog on stick (GDD 4.1), so a gentle push walks slowly.
      const len = Math.hypot(pad.moveX, pad.moveY);
      s.moveX = pad.moveX / len;
      s.moveY = pad.moveY / len;
      s.moveMagnitude = clamp(len, 0, 1);
    } else {
      s.moveX = 0;
      s.moveY = 0;
      s.moveMagnitude = 0;
    }

    // ---- aim: cardinal by default, eight-way only with the modifier ---------
    let direction = null;
    if (this.aimStack.length > 0) {
      const eight = Boolean(caps.eightDirection);
      if (eight) {
        // Combine every held aim key, then snap to the nearest octant so
        // Up+Right produces a real diagonal (GDD 8.5 Keyboard + Numeric Keypad).
        let ax = 0;
        let ay = 0;
        for (const dir of this.aimStack) {
          const [dx, dy] = CARDINAL_VECTOR[dir];
          ax += dx;
          ay += dy;
        }
        direction = (ax === 0 && ay === 0)
          ? this.aimStack[this.aimStack.length - 1]
          : vectorToOctant(ax, ay);
      } else {
        // Most recent valid direction wins.
        direction = this.aimStack[this.aimStack.length - 1];
      }
      s.aimRawX = 0;
      s.aimRawY = 0;
    } else if (pad && (pad.aimX !== 0 || pad.aimY !== 0)) {
      s.aimRawX = pad.aimX;
      s.aimRawY = pad.aimY;
      if (caps.eightDirection) {
        direction = this.aimSnap >= 0.5
          ? vectorToOctant(pad.aimX, pad.aimY)
          : vectorToOctant(pad.aimX, pad.aimY);
      } else {
        direction = vectorToCardinal(pad.aimX, pad.aimY);
      }
    }

    s.aimDirection = direction;
    s.aimAngle = direction ? (OCTANT_ANGLE[direction] ?? 0) : s.aimAngle;

    // ---- firing -----------------------------------------------------------
    const rawFiring = direction !== null;
    if (this.fireMode === 'TOGGLE') {
      // Toggle mode: a fresh aim press flips sustained fire on or off.
      for (const action of s.pressed) {
        if (AIM_ACTIONS[action]) this.fireToggle = !this.fireToggle;
      }
      s.firing = this.fireToggle && direction !== null;
    } else {
      s.firing = rawFiring;
    }

    return s;
  }

  /** Is the map currently requested, honouring hold vs toggle? */
  mapRequested() {
    return this.mapMode === 'TOGGLE' ? this.mapToggle : this.state.isHeld(ACTION.MAP);
  }

  #readGamepad(heldActions) {
    const getPads = globalThis.navigator?.getGamepads?.bind(globalThis.navigator);
    if (!getPads) return null;
    const pads = getPads();
    let pad = null;
    for (const candidate of pads) {
      if (candidate && candidate.connected) { pad = candidate; break; }
    }
    if (!pad) return null;
    this.gamepadIndex = pad.index;

    for (let i = 0; i < pad.buttons.length; i += 1) {
      const action = this.gamepad[i];
      if (!action) continue;
      const down = pad.buttons[i].pressed;
      if (down) {
        heldActions.add(action);
        if (!this._padDown?.has(i)) {
          this.edge.add(action);
          (this._padDown ||= new Set()).add(i);
        }
      } else {
        this._padDown?.delete(i);
      }
    }

    const dz = this.deadZone;
    const axis = (v) => (Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz));
    return {
      moveX: axis(pad.axes[0] ?? 0),
      moveY: axis(pad.axes[1] ?? 0),
      aimX: axis(pad.axes[2] ?? 0),
      aimY: axis(pad.axes[3] ?? 0),
    };
  }

  /** Rebind an action. Returns the previous binding, if any (GDD 17.6). */
  rebindKey(code, action) {
    const previous = Object.entries(this.keyboard).find(([, a]) => a === action)?.[0];
    if (previous) delete this.keyboard[previous];
    this.keyboard[code] = action;
    return previous;
  }

  /** Serialise bindings and accessibility settings for the settings save. */
  save() {
    return {
      keyboard: this.keyboard,
      gamepad: this.gamepad,
      deadZone: this.deadZone,
      aimSnap: this.aimSnap,
      fireMode: this.fireMode,
      mapMode: this.mapMode,
    };
  }

  load(state) {
    if (!state) return this;
    if (state.keyboard) this.keyboard = { ...state.keyboard };
    if (state.gamepad) this.gamepad = { ...state.gamepad };
    if (typeof state.deadZone === 'number') this.deadZone = state.deadZone;
    if (typeof state.aimSnap === 'number') this.aimSnap = state.aimSnap;
    if (state.fireMode) this.fireMode = state.fireMode;
    if (state.mapMode) this.mapMode = state.mapMode;
    return this;
  }
}

export { OCTANTS, AIM_ACTIONS };
