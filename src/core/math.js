/**
 * Small deterministic math helpers.
 *
 * GDD refs: R-PLY-003 (stat clamps: no negative intervals, NaN, infinite speed),
 *           6.4 (collision priorities), 4.2 (aiming rules).
 *
 * Everything here is pure and allocation-light. No Math.random, ever.
 */

import { CARDINALS, DIR_VECTOR, OCTANTS, OCTANT_ANGLE } from './constants.js';

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential approach. `rate` is per-second. */
export function damp(current, target, rate, dt) {
  if (rate <= 0) return target;
  return target + (current - target) * Math.exp(-rate * dt);
}

export function sign(value) {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

/**
 * Guards a stat against NaN/Infinity and applies a clamp band.
 * @param {number} value
 * @param {{min:number,max:number}} band from CLAMPS
 * @param {number} fallback used when value is not finite
 */
export function clampStat(value, band, fallback) {
  if (!Number.isFinite(value)) return fallback ?? band.min;
  return clamp(value, band.min, band.max);
}

export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Normalises into `out` to avoid allocating in hot loops. */
export function normalizeInto(out, x, y) {
  const len = Math.sqrt(x * x + y * y);
  if (len < 1e-8) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  out.x = x / len;
  out.y = y / len;
  return out;
}

/** Shortest signed angular difference from `from` to `to`, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotates `from` toward `to` by at most `maxStep` radians. */
export function rotateToward(from, to, maxStep) {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + sign(d) * maxStep;
}

/** Nearest cardinal name for a vector. Ties resolve to the horizontal axis. */
export function vectorToCardinal(x, y) {
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? 'EAST' : 'WEST';
  return y >= 0 ? 'SOUTH' : 'NORTH';
}

/** Nearest of the eight compass directions for a vector (GDD ITM-012). */
export function vectorToOctant(x, y) {
  const a = Math.atan2(y, x);
  let best = OCTANTS[0];
  let bestDelta = Infinity;
  for (const name of OCTANTS) {
    const delta = Math.abs(angleDelta(a, OCTANT_ANGLE[name]));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = name;
    }
  }
  return best;
}

/** Angle in radians for a cardinal or octant name. */
export function directionAngle(name) {
  if (OCTANT_ANGLE[name] !== undefined) return OCTANT_ANGLE[name];
  const v = DIR_VECTOR[name];
  if (!v) return 0;
  return Math.atan2(v.y, v.x);
}

/** Axis-aligned box overlap. Boxes are `{x, y, w, h}` with x/y at the centre. */
export function boxesOverlap(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h
  );
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return distanceSq(ax, ay, bx, by) < r * r;
}

/** Circle vs centre-anchored box. Used for projectile vs furniture. */
export function circleBoxOverlap(cx, cy, r, box) {
  const halfW = box.w / 2;
  const halfH = box.h / 2;
  const dx = Math.abs(cx - box.x) - halfW;
  const dy = Math.abs(cy - box.y) - halfH;
  if (dx > r || dy > r) return false;
  if (dx <= 0 || dy <= 0) return true;
  return dx * dx + dy * dy <= r * r;
}

/** Shortest distance from point to segment. Used by beam and scanner hazards. */
export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-9) return distance(px, py, ax, ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = clamp01(t);
  return distance(px, py, ax + abx * t, ay + aby * t);
}

/** True when `angle` lies inside a cone of half-width `halfWidth` around `center`. */
export function inCone(angle, center, halfWidth) {
  return Math.abs(angleDelta(center, angle)) <= halfWidth;
}

/**
 * Multiplicative stat accumulator. Items declare multipliers and additions;
 * this keeps the resolution order explicit and reproducible: all additive terms
 * first, then all multiplicative terms, then the clamp.
 */
export class StatAccumulator {
  constructor(base) {
    this.base = base;
    this.add = 0;
    this.mul = 1;
  }

  addFlat(value) {
    this.add += value;
    return this;
  }

  multiply(factor) {
    this.mul *= factor;
    return this;
  }

  resolve(band) {
    const raw = (this.base + this.add) * this.mul;
    return band ? clampStat(raw, band, this.base) : raw;
  }
}

/** Stable numeric sort key comparator; keeps deterministic ordering by id. */
export function byPriorityThenId(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export { CARDINALS };
