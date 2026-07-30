/**
 * Touch controls: twin floating sticks and a contextual button set.
 *
 * GDD refs: 4.1 (the baseline control set every device must express), 4.2 (aiming rules —
 *           cardinal by default, eight-way only with the modifier), 17.6 (accessibility:
 *           remappable input, dead zones, reduced motion), 18.2 (the 960x540 logical frame),
 *           21.2 (a destructive act uses hold confirmation), R-PLY-002 (movement stays
 *           responsive while firing), R-UIX-001 (the player is never asked to manage a
 *           dashboard), R-UIX-005 (no mechanic depends on colour alone).
 *
 * ## Twin floating sticks, because glass has no edges you can feel
 *
 * The layout follows The Binding of Isaac's mobile build, for the same reason it does: this is
 * a twin-stick game where movement and fire are genuinely independent (R-PLY-002), so it needs
 * two analog inputs and a small number of buttons, and nothing else.
 *
 * Both sticks *float* — the centre is wherever the thumb lands, not a ring painted on the
 * glass. A fixed pad asks the player to look at their thumbs to find it, and on a surface with
 * no tactile landmarks the thumb drifts within seconds; every input after that is offset by
 * however far it drifted. Anchoring to the touch-down point makes drift structurally
 * impossible, because the stick is always exactly where the thumb already is.
 *
 * ## Physical size is computed, not hard-coded
 *
 * Apple HIG and Material both put the floor for a touch target at 44pt / 48dp, and a radius in
 * *logical* pixels cannot satisfy that on its own: the 960x540 frame is scaled to fit the
 * screen, so one logical pixel is 0.72pt on a 390pt-tall phone and 0.59pt on a 320pt one. A
 * fixed radius that clears 44pt on the first fails on the second.
 *
 * So `layout()` measures the canvas and solves for the radius that yields a 44pt target on
 * *this* device, then places the buttons around it. The consequence is that buttons occupy more
 * of the frame on a small screen, which is the correct trade: a control you cannot reliably hit
 * is worth less than the pixels it saves.
 *
 * ## Colour is never the only difference (R-UIX-005)
 *
 * The two sticks would be indistinguishable to a red-green colourblind player if tint were the
 * only cue, and they are the two inputs it matters most not to confuse. So the movement stick
 * carries four direction ticks and the fire stick carries a crosshair: different silhouettes,
 * legible with no colour at all.
 *
 * ## Contextual, not crowded
 *
 * A button for something the player cannot currently do is noise. Active item, pocket item and
 * interact dim to a disabled state when there is nothing to use or nothing in reach, rather
 * than disappearing — a button that moves or vanishes costs more than a dim one, because the
 * player has already learned where it is.
 *
 * ## Dropping your weapon is the one destructive act here
 *
 * It is a hold, not a tap, matching the hold-to-confirm the menus already use for restarting a
 * run (GDD 21.2). A mis-tap during a fight would otherwise cost the player the weapon the whole
 * run is built around, and there is no undo in a roguelike.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../core/constants.js';
import { ACTION } from './input.js';
import { LAYER_ORDER } from '../render/renderer.js';
import { clamp } from '../core/math.js';

/**
 * The platform floor for a touch target, as a radius.
 *
 * 44pt across is Apple HIG's minimum and Material's 48dp is close enough that one number
 * serves both. Everything else in the layout is derived from it.
 */
const TARGET_RADIUS_PT = 22;

/**
 * Bounds on the derived radius, in logical pixels.
 *
 * The floor keeps buttons visible on a desktop window, where the canvas is large and the
 * physical minimum would be satisfied by something too small to see. The ceiling stops a very
 * small screen from being consumed by controls — past that point the buttons stop growing and
 * the honest answer is that the device is smaller than the game's comfortable minimum.
 */
const RADIUS_MIN = 24;
const RADIUS_MAX = 46;

/** Stick geometry as multiples of the button radius, so it scales with everything else. */
const STICK = Object.freeze({
  baseRadius: 1.75,
  knobRadius: 0.78,
  maxTravel: 1.6,
  /**
   * Deflection below which the stick reports nothing, in logical pixels.
   *
   * Small, because a floating stick is not fighting hardware slop — the thumb defines the
   * origin, so the only thing to reject is the wobble of a thumb that meant to tap.
   */
  deadZone: 9,
});

/** How long DROP must be held. Matches menus.js's hold-to-confirm. */
const HOLD_SECONDS = 0.55;

/** Idle fade: these controls are furniture, not information, so they recede when unused. */
const IDLE_FADE_SECONDS = 2.5;

/**
 * Button definitions, positioned by anchor rather than absolute coordinates.
 *
 * `col` is the index down a corner-anchored column, so the whole set reflows when the derived
 * radius changes. Nothing here is a magic number tuned to one screen.
 *
 * DROP sits beside Pause at the top left, far from where a thumb rests, and requires a hold.
 * The bottom two thirds of both sides stay clear for the sticks.
 */
const BUTTONS = Object.freeze([
  { action: ACTION.PAUSE, anchor: 'TL', col: 0, label: 'II', glyph: 'pause' },
  { action: ACTION.DROP, anchor: 'TL', col: 1, label: 'DROP', hold: true, glyph: 'drop' },
  { action: ACTION.MAP, anchor: 'TR', col: 0, label: 'MAP', glyph: 'map' },
  { action: ACTION.USE_ACTIVE, anchor: 'RC', col: 0, label: 'ITEM', context: 'hasActive' },
  { action: ACTION.USE_POCKET, anchor: 'RC', col: 1, label: 'PKT', context: 'hasPocket' },
  // Deliberately no INTERACT button.
  //
  // GDD 4.1 lists Interact in the binding table and it is rebindable on the keyboard, but
  // nothing in the game consumes it: pickups resolve on contact in the PHYSICS phase, shop
  // purchases take no confirmation (R-ECO-002), and `onInteract` on an environment object is
  // validated but never dispatched. A button that does nothing is worse than an absent one —
  // the player presses it during a fight, nothing happens, and they stop trusting the controls.
  // If an interact verb is ever wired up, this is where its button goes.
]);

/** Where the movement stick may start; everything right of it starts the fire stick. */
const MOVE_ZONE_MAX_X = LOGICAL_WIDTH * 0.5;

export class TouchControls {
  constructor({ haptics = true } = {}) {
    /**
     * Set once a real touch has been seen.
     *
     * The overlay stays hidden until then, so a desktop player never sees thumb sticks and a
     * phone player never has to enable anything.
     */
    this.active = false;
    this.idleSeconds = 0;
    this.haptics = haptics;
    /** Reduced motion switches the idle fade off rather than animating opacity. */
    this.reducedMotion = false;

    /** pointerId -> { role, ... } */
    this.pointers = new Map();
    this.held = new Set();
    this.edge = new Set();

    /**
     * What the player can currently do, pushed in each frame by the game.
     *
     * Defaults to true so a caller that never sets context gets working buttons rather than a
     * screen of disabled ones.
     */
    this.context = { hasActive: true, hasPocket: true };

    /** Derived each layout pass. */
    this.radius = RADIUS_MIN;
    this.placed = [];
    this._rectKey = '';

    this.canvas = null;
    this._listeners = [];
  }

  attach(canvas) {
    if (!canvas?.addEventListener) return this;
    this.canvas = canvas;

    const onDown = (e) => {
      if (e.pointerType !== 'touch') return;
      // The canvas owns the gesture from here. Without this the browser may still decide it
      // was a scroll or a double-tap zoom and stop delivering moves partway through.
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      this.active = true;
      this.idleSeconds = 0;
      this.#begin(e.pointerId, this.#toLogical(e));
    };
    const onMove = (e) => {
      if (e.pointerType !== 'touch') return;
      if (!this.pointers.has(e.pointerId)) return;
      e.preventDefault();
      this.idleSeconds = 0;
      this.#move(e.pointerId, this.#toLogical(e));
    };
    const onUp = (e) => {
      if (e.pointerType !== 'touch') return;
      this.#end(e.pointerId);
    };

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    // A cancelled pointer is the case that strands a stick: the OS takes the gesture for a
    // notification shade or an incoming call, and without this the player keeps walking.
    canvas.addEventListener('pointercancel', onUp, { passive: false });
    canvas.addEventListener('lostpointercapture', onUp, { passive: false });

    this._listeners = [
      ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp],
      ['pointercancel', onUp], ['lostpointercapture', onUp],
    ].map(([type, fn]) => () => canvas.removeEventListener(type, fn));
    return this;
  }

  detach() {
    for (const off of this._listeners) off();
    this._listeners = [];
  }

  /** Drop every touch, so no stick stays stuck on after focus loss. */
  reset() {
    this.pointers.clear();
    this.held.clear();
    this.edge.clear();
  }

  /** What the player can currently do, so contextual buttons can dim (see class comment). */
  setContext(ctx = {}) {
    Object.assign(this.context, ctx);
  }

  /**
   * Solve the button radius and positions for the current canvas size.
   *
   * Recomputed only when the canvas rect changes, because `getBoundingClientRect` forces
   * layout and this would otherwise run twice a frame for no reason.
   */
  layout() {
    const rect = this.canvas?.getBoundingClientRect?.();
    const cssHeight = rect?.height || LOGICAL_HEIGHT;
    const key = `${Math.round(rect?.width || 0)}x${Math.round(cssHeight)}`;
    if (key === this._rectKey && this.placed.length > 0) return this.placed;
    this._rectKey = key;

    // CSS pixels per logical pixel. CSS px and pt are the same unit for layout purposes here,
    // which is what makes the 44pt floor expressible.
    const ptPerLogical = cssHeight / LOGICAL_HEIGHT;
    this.radius = clamp(TARGET_RADIUS_PT / (ptPerLogical || 1), RADIUS_MIN, RADIUS_MAX);

    const r = this.radius;
    // A gap of 8pt is the platform minimum between targets; 0.4r is comfortably above it at
    // every radius this can produce, and keeps the column visually grouped rather than sparse.
    const gap = Math.max(r * 0.4, 12);
    const step = r * 2 + gap;
    const margin = r + Math.max(r * 0.3, 10);

    this.placed = BUTTONS.map((b) => {
      let x = margin;
      let y = margin;
      if (b.anchor === 'TL') x = margin + b.col * step;
      else if (b.anchor === 'TR') x = LOGICAL_WIDTH - margin - b.col * step;
      else if (b.anchor === 'RC') {
        x = LOGICAL_WIDTH - margin;
        // Below the top row, and stopping well short of the bottom third where thumbs rest.
        y = margin + step + b.col * step;
      }
      return { ...b, x, y, radius: r };
    });
    return this.placed;
  }

  /**
   * Client coordinates to logical 960x540 coordinates.
   *
   * The backing store is always 960x540 and CSS scales it, so this ratio is the only
   * conversion needed and stays correct at any scale, device pixel ratio, or safe-area inset.
   */
  #toLogical(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) * (LOGICAL_WIDTH / rect.width),
      y: (e.clientY - rect.top) * (LOGICAL_HEIGHT / rect.height),
    };
  }

  /** Is a button currently usable? A contextual button with nothing to do is not. */
  #enabled(b) {
    return b.context ? Boolean(this.context[b.context]) : true;
  }

  #buttonAt(pt) {
    for (const b of this.layout()) {
      // The touch radius exceeds the drawn radius: a fingertip is wider than the circle it is
      // aiming at, and hitting a button early is far better than missing it.
      const r = b.radius * 1.2;
      if ((pt.x - b.x) ** 2 + (pt.y - b.y) ** 2 <= r * r) return b;
    }
    return null;
  }

  /** A short pulse on press. Confirmation the player feels without looking (Apple HIG). */
  #buzz(ms = 8) {
    if (!this.haptics) return;
    try {
      globalThis.navigator?.vibrate?.(ms);
    } catch {
      // A browser that refuses to vibrate is not a reason to drop the input.
    }
  }

  #begin(id, pt) {
    // Buttons first, or a thumb landing on the item button also starts an aim stick and the
    // player fires a shot they did not ask for.
    const button = this.#buttonAt(pt);
    if (button) {
      if (!this.#enabled(button)) {
        // Consume the touch so it cannot fall through and start a stick under the button.
        this.pointers.set(id, { role: 'BUTTON', action: null });
        return;
      }
      this.pointers.set(id, {
        role: 'BUTTON', action: button.action, hold: Boolean(button.hold), holdTimer: 0,
      });
      this.held.add(button.action);
      // A hold does not act until it completes, so no edge is emitted yet.
      if (!button.hold) this.edge.add(button.action);
      this.#buzz(button.hold ? 4 : 9);
      return;
    }

    const role = pt.x < MOVE_ZONE_MAX_X ? 'MOVE' : 'FIRE';
    // One stick per side: a second thumb in the same half is ignored rather than allowed to
    // hijack a stick the first thumb is still driving.
    for (const p of this.pointers.values()) if (p.role === role) return;
    this.pointers.set(id, { role, originX: pt.x, originY: pt.y, x: pt.x, y: pt.y });
  }

  #move(id, pt) {
    const p = this.pointers.get(id);
    if (!p || p.role === 'BUTTON') return;
    p.x = pt.x;
    p.y = pt.y;
  }

  #end(id) {
    const p = this.pointers.get(id);
    if (!p) return;
    if (p.role === 'BUTTON' && p.action) this.held.delete(p.action);
    this.pointers.delete(id);
  }

  #stick(role) {
    for (const p of this.pointers.values()) if (p.role === role) return p;
    return null;
  }

  /**
   * Resolve a stick to a unit vector and magnitude.
   *
   * Deflection is rescaled so the dead zone is not a dead *step*: magnitude is 0 at the dead
   * zone edge and climbs smoothly to 1 at full travel. Without the rescale, clearing the dead
   * zone would snap the player straight to a noticeable speed.
   */
  #resolve(role) {
    const p = this.#stick(role);
    if (!p) return null;
    const dx = p.x - p.originX;
    const dy = p.y - p.originY;
    const dist = Math.hypot(dx, dy);
    if (dist < STICK.deadZone) return null;
    const maxTravel = this.radius * STICK.maxTravel;
    const travel = clamp((dist - STICK.deadZone) / (maxTravel - STICK.deadZone), 0, 1);
    return { x: (dx / dist) * travel, y: (dy / dist) * travel, magnitude: travel };
  }

  /** Advance hold timers. Separate from sample() so a paused game does not complete a hold. */
  update(dt) {
    if (!this.active) return;
    if (this.pointers.size === 0) this.idleSeconds += dt;
    else this.idleSeconds = 0;

    for (const p of this.pointers.values()) {
      if (p.role !== 'BUTTON' || !p.hold || !p.action) continue;
      p.holdTimer += dt;
      if (p.holdTimer >= HOLD_SECONDS && !p.fired) {
        p.fired = true;
        this.edge.add(p.action);
        // A longer pulse than a tap: this one committed to something irreversible.
        this.#buzz(24);
      }
    }
  }

  /**
   * One frame of touch intent, shaped exactly like `#readGamepad`'s return value.
   *
   * Returns null when touch is not in use, so `InputSystem` skips it entirely and a desktop
   * session is bit-for-bit unaffected.
   */
  sample() {
    if (!this.active) return null;
    const move = this.#resolve('MOVE');
    const fire = this.#resolve('FIRE');
    return {
      moveX: move ? move.x : 0,
      moveY: move ? move.y : 0,
      // Fire only past the dead zone, so a tap on the right half aims and shoots nothing. A
      // player reaching for a button and missing should not spend a shot.
      aimX: fire ? fire.x : 0,
      aimY: fire ? fire.y : 0,
    };
  }

  heldActions() {
    // A hold that has not completed is not "held" as far as the game is concerned, or DROP
    // would repeat every frame once the timer elapsed.
    const out = new Set();
    for (const p of this.pointers.values()) {
      if (p.role === 'BUTTON' && p.action && !p.hold) out.add(p.action);
    }
    return out;
  }

  takeEdges() {
    const out = new Set(this.edge);
    this.edge.clear();
    return out;
  }

  /**
   * Draw the overlay.
   *
   * Faint, and fainter when idle. These controls must be visible enough to find and quiet
   * enough to ignore: GDD 17.1 says the player is shown what they need now, and a bright
   * gamepad painted permanently over a dark office is not that. Colours are the HUD's own
   * (`#141420` panel, `#9a9aae` stroke, `#e8c246` active) rather than a second palette.
   */
  draw(renderer) {
    if (!this.active || !renderer?.push) return;
    const buttons = this.layout();
    const fade = this.reducedMotion
      ? 1
      : 1 - clamp(this.idleSeconds / IDLE_FADE_SECONDS, 0, 1) * 0.55;

    renderer.push(LAYER_ORDER.HUD, (ctx) => {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const b of buttons) {
        const enabled = this.#enabled(b);
        const pointer = [...this.pointers.values()].find((p) => p.action === b.action);
        const down = Boolean(pointer);
        // Material puts a disabled control at 0.38-0.5 opacity: clearly present, clearly not
        // available, and never mistakable for merely dim.
        const alpha = (enabled ? (down ? 0.9 : 0.4) : 0.2) * fade;
        // A press scales the button slightly rather than moving anything, so feedback never
        // shifts the layout.
        const r = b.radius * (down ? 1.05 : 1);

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fillStyle = down ? '#e8c246' : '#141420';
        ctx.fill();
        ctx.strokeStyle = down ? '#f7e07a' : (enabled ? '#9a9aae' : '#4a4a5e');
        ctx.stroke();

        // Hold progress, drawn as an arc closing around the button: the player can see how
        // much longer to hold, which is what makes a hold feel deliberate rather than laggy.
        if (b.hold && pointer && !pointer.fired) {
          const progress = clamp(pointer.holdTimer / HOLD_SECONDS, 0, 1);
          ctx.globalAlpha = fade;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r + 4, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.strokeStyle = '#e04a54';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.lineWidth = 2;
        }

        ctx.globalAlpha = (enabled ? (down ? 1 : 0.85) : 0.45) * fade;
        ctx.fillStyle = down ? '#141420' : '#c8c8d6';
        ctx.font = `${Math.round(r * 0.5)}px "Courier New", monospace`;
        ctx.fillText(b.label, b.x, b.y + 1);
      }

      // Sticks are drawn only while held: an empty ring painted on the glass would be a lie,
      // because the stick is not there until a thumb puts it there.
      for (const role of ['MOVE', 'FIRE']) {
        const p = this.#stick(role);
        if (!p) continue;
        const resolved = this.#resolve(role);
        const travel = this.radius * STICK.maxTravel;
        const knobX = p.originX + (resolved ? resolved.x * travel : 0);
        const knobY = p.originY + (resolved ? resolved.y * travel : 0);
        const base = this.radius * STICK.baseRadius;
        const knob = this.radius * STICK.knobRadius;
        const fire = role === 'FIRE';
        const tint = fire ? '#e04a54' : '#4a7fd4';

        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(p.originX, p.originY, base, 0, Math.PI * 2);
        ctx.fillStyle = '#141420';
        ctx.fill();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = tint;
        ctx.stroke();

        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(knobX, knobY, knob, 0, Math.PI * 2);
        ctx.fillStyle = tint;
        ctx.fill();
        ctx.strokeStyle = '#05050a';
        ctx.stroke();

        // R-UIX-005: the two sticks differ in SHAPE, not only in tint. Fire wears a crosshair,
        // movement wears four direction ticks, so they stay distinguishable with no colour
        // information at all.
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#05050a';
        ctx.beginPath();
        if (fire) {
          ctx.moveTo(knobX - knob * 0.62, knobY);
          ctx.lineTo(knobX + knob * 0.62, knobY);
          ctx.moveTo(knobX, knobY - knob * 0.62);
          ctx.lineTo(knobX, knobY + knob * 0.62);
        } else {
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            ctx.moveTo(knobX + dx * knob * 0.34, knobY + dy * knob * 0.34);
            ctx.lineTo(knobX + dx * knob * 0.66, knobY + dy * knob * 0.66);
          }
        }
        ctx.stroke();
      }

      ctx.restore();
    });
  }
}

export { STICK, BUTTONS, MOVE_ZONE_MAX_X, TARGET_RADIUS_PT, RADIUS_MIN, RADIUS_MAX, HOLD_SECONDS };
