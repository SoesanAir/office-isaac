/**
 * Camera.
 *
 * GDD refs: 4.3 (Camera), R-CAM-001 (entering a normal room centres and LOCKS the
 *           camera; it must not drift during normal-room combat), R-CAM-002
 *           (large-room cameras stay inside authored bounds and use soft follow;
 *           no position may expose void space or hide a valid door), R-CAM-003
 *           (shake is event-based, brief, and separately adjustable), R-CAM-004
 *           (transitions are fast and do not remove control longer than needed).
 *
 * The distinction that matters: a normal room is a *fixed frame*. Any drift, even
 * a pixel of parallax, breaks the genre's read — the player learns a room as a
 * single stable picture. Only rooms too large to fit the viewport follow the
 * player, and then only inside bounds that guarantee no wall edge or door leaves
 * the frame.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT, TILE } from '../core/constants.js';
import { clamp, damp } from '../core/math.js';

/** Follow stiffness for bounded large rooms. Per-second, frame-rate independent. */
const FOLLOW_RATE = 9;

export class Camera {
  constructor() {
    /** Centre of the view, in world units. */
    this.x = 0;
    this.y = 0;
    /** Locked target when the whole room fits the viewport. */
    this.lockX = 0;
    this.lockY = 0;
    this.locked = true;
    /** Follow bounds in world units, inclusive of the camera centre. */
    this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    /** Integer pixel scale. Recomputed on resize. */
    this.scale = 1;
    /** Shake state (R-CAM-003). */
    this.shakeRemaining = 0;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
    this.shakeSeed = 0;
    /** Accessibility multiplier, 0 disables shake entirely. */
    this.shakeScale = 1;
    /** Applied offset for this frame, in world units. */
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /** Viewport size in world units. */
  get viewW() {
    return LOGICAL_WIDTH / TILE;
  }

  get viewH() {
    return LOGICAL_HEIGHT / TILE;
  }

  /**
   * Bind the camera to a room.
   *
   * @param {{x:number,y:number,w:number,h:number}} rect room interior in world units
   * @param {{x:number, y:number}} [player] used to seat a large-room camera immediately
   */
  setRoom(rect, player) {
    /**
     * Guard against a non-finite player position.
     *
     * `beginFrame()` clears to near-black, so a NaN camera position renders an
     * entirely black screen with no error anywhere the player can see it. A silent
     * blank screen is a far worse failure than a visibly mis-framed room, so this
     * falls back to centring and complains loudly in development.
     */
    if (player && (!Number.isFinite(player.x) || !Number.isFinite(player.y))) {
      console.error('Camera.setRoom got a non-finite player position; centring instead.', player);
      player = null;
    }
    // Margin so walls, doors, and the door frame's outer edge stay on screen.
    const margin = 1.5;
    const contentW = rect.w + margin * 2;
    const contentH = rect.h + margin * 2;
    const centreX = rect.x + rect.w / 2;
    const centreY = rect.y + rect.h / 2;

    const fitsX = contentW <= this.viewW;
    const fitsY = contentH <= this.viewH;
    this.locked = fitsX && fitsY;

    if (this.locked) {
      // R-CAM-001: one fixed frame for the whole room.
      this.lockX = centreX;
      this.lockY = centreY;
      this.bounds = { minX: centreX, maxX: centreX, minY: centreY, maxY: centreY };
      this.x = centreX;
      this.y = centreY;
      return;
    }

    // R-CAM-002: clamp the centre so the view never leaves the room's content box.
    // When an axis fits, that axis stays centred rather than following.
    const halfW = this.viewW / 2;
    const halfH = this.viewH / 2;
    this.bounds = {
      minX: fitsX ? centreX : rect.x - margin + halfW,
      maxX: fitsX ? centreX : rect.x + rect.w + margin - halfW,
      minY: fitsY ? centreY : rect.y - margin + halfH,
      maxY: fitsY ? centreY : rect.y + rect.h + margin - halfH,
    };
    // Degenerate bounds (content barely larger than the view) collapse to centre.
    if (this.bounds.minX > this.bounds.maxX) {
      this.bounds.minX = centreX;
      this.bounds.maxX = centreX;
    }
    if (this.bounds.minY > this.bounds.maxY) {
      this.bounds.minY = centreY;
      this.bounds.maxY = centreY;
    }

    const targetX = player ? clamp(player.x, this.bounds.minX, this.bounds.maxX) : centreX;
    const targetY = player ? clamp(player.y, this.bounds.minY, this.bounds.maxY) : centreY;
    // Seat instantly on entry so a transition never shows a pan (R-CAM-004).
    this.x = targetX;
    this.y = targetY;
  }

  /** Advance follow and shake. `dt` is the fixed simulation step. */
  update(dt, player) {
    if (!this.locked && player) {
      const targetX = clamp(player.x, this.bounds.minX, this.bounds.maxX);
      const targetY = clamp(player.y, this.bounds.minY, this.bounds.maxY);
      this.x = damp(this.x, targetX, FOLLOW_RATE, dt);
      this.y = damp(this.y, targetY, FOLLOW_RATE, dt);
    } else if (this.locked) {
      // Snap: a locked camera has no business easing anywhere.
      this.x = this.lockX;
      this.y = this.lockY;
    }

    if (this.shakeRemaining > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
      const t = this.shakeDuration > 0 ? this.shakeRemaining / this.shakeDuration : 0;
      // Decay quadratically: a sharp hit that settles fast reads as impact,
      // a lingering wobble reads as a bug.
      const amp = this.shakeMagnitude * this.shakeScale * t * t;
      // Deterministic pseudo-noise: shake must not consume gameplay RNG.
      this.shakeSeed = (this.shakeSeed * 1103515245 + 12345) & 0x7fffffff;
      const a = (this.shakeSeed / 0x7fffffff) * Math.PI * 2;
      this.offsetX = Math.cos(a) * amp;
      this.offsetY = Math.sin(a * 1.7) * amp;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  /**
   * Request a shake.
   * @param {number} magnitude in world units
   * @param {number} seconds keep this brief; R-CAM-003 says event-based and short
   */
  shake(magnitude, seconds = 0.18) {
    // Never let a weaker overlapping event shorten a stronger one.
    if (magnitude * seconds < this.shakeMagnitude * this.shakeRemaining) return;
    this.shakeMagnitude = magnitude;
    this.shakeDuration = seconds;
    this.shakeRemaining = seconds;
  }

  /** 0 disables shake, 1 is full. Accessibility setting (GDD 17.6). */
  setShakeScale(scale) {
    this.shakeScale = clamp(scale, 0, 1);
    if (this.shakeScale === 0) this.shakeRemaining = 0;
  }

  /** World units -> logical pixels. */
  worldToScreen(wx, wy, out = { x: 0, y: 0 }) {
    out.x = (wx - (this.x + this.offsetX)) * TILE + LOGICAL_WIDTH / 2;
    out.y = (wy - (this.y + this.offsetY)) * TILE + LOGICAL_HEIGHT / 2;
    return out;
  }

  /** Logical pixels -> world units. */
  screenToWorld(sx, sy, out = { x: 0, y: 0 }) {
    out.x = (sx - LOGICAL_WIDTH / 2) / TILE + this.x + this.offsetX;
    out.y = (sy - LOGICAL_HEIGHT / 2) / TILE + this.y + this.offsetY;
    return out;
  }

  /** Visible world rect, used for render culling. */
  visibleRect() {
    const halfW = this.viewW / 2;
    const halfH = this.viewH / 2;
    return {
      x0: this.x + this.offsetX - halfW,
      y0: this.y + this.offsetY - halfH,
      x1: this.x + this.offsetX + halfW,
      y1: this.y + this.offsetY + halfH,
    };
  }
}

/**
 * Integer scale factor that fits the logical canvas into a window.
 *
 * GDD 18.2 demands pixel-perfect or nearest-neighbour integer scaling with no
 * smoothing that blurs silhouettes, so this deliberately returns an integer and
 * accepts letterboxing rather than scaling fractionally.
 */
export function integerScaleFor(windowW, windowH) {
  const scale = Math.min(windowW / LOGICAL_WIDTH, windowH / LOGICAL_HEIGHT);
  // Below 1x there is no integer to floor to, and returning 1 would lay the canvas out larger
  // than the viewport — which on a landscape phone (390pt tall against a 540px frame) cut the
  // bottom of the play area off the screen entirely.
  //
  // GDD 18.2 asks for integer scaling so nearest-neighbour sampling never softens the pixel
  // art, and that is honoured wherever it is achievable: at 1x and above this still floors. On
  // a screen physically smaller than the logical frame the choice is between a fractional scale
  // and cropping the room, and GDD 4.3 makes the room the frame — so the art gives way rather
  // than the playfield. Phone device-pixel ratios are 2-3x, so a 0.72 CSS scale is still
  // oversampled in real pixels and holds up.
  if (scale < 1) return scale;
  return Math.floor(scale);
}
