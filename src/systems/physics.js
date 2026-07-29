/**
 * Collision and movement.
 *
 * GDD refs: 6.4 (collision priorities), 6.3 (projectile collision mask),
 *           R-ENV-001 (object collision matches the visible shape), R-ROM-006
 *           (templates declare valid navigation regions), R-PLY-002 (movement
 *           stays responsive while firing), 13.2 (object classes: what blocks
 *           movement, projectiles, flying, and line of sight).
 *
 * Two deliberate choices:
 *
 *   1. **Axis-separated sweeps.** Movement resolves x then y independently, so
 *      running diagonally into a wall slides along it instead of stopping dead.
 *      In a twin-stick roguelike, catching on geometry reads as unfair damage,
 *      and GDD 2.10 says unavoidable damage is a bug.
 *
 *   2. **A static solidity grid per room.** Walls come from the authored geometry
 *      string grid, which the room already owns, so there is no second source of
 *      truth to drift out of sync with what the renderer draws. Dynamic objects
 *      are a separate short list checked after the grid.
 */

import { LAYER, TILE } from '../core/constants.js';
import { circleBoxOverlap, clamp } from '../core/math.js';

/** Geometry characters and what they block. */
const SOLID_CHARS = new Set(['#']);
const PIT_CHARS = new Set(['x']);
/** Low cover blocks ground projectiles but not movement or flying entities. */
const LOW_COVER_CHARS = new Set(['~']);

/**
 * Static collision for one room instance, derived from its template geometry.
 */
export class RoomCollision {
  /**
   * @param {string[]} geometry template geometry rows
   * @param {{x:number,y:number}} origin room interior origin in world units
   */
  constructor(geometry, origin) {
    this.origin = origin;
    this.w = geometry[0].length;
    this.h = geometry.length;
    this.solid = new Uint8Array(this.w * this.h);
    this.pit = new Uint8Array(this.w * this.h);
    this.lowCover = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        const ch = geometry[y][x];
        const i = y * this.w + x;
        if (SOLID_CHARS.has(ch)) this.solid[i] = 1;
        else if (PIT_CHARS.has(ch)) this.pit[i] = 1;
        else if (LOW_COVER_CHARS.has(ch)) this.lowCover[i] = 1;
      }
    }
    /** Dynamic obstacles: `{x, y, w, h, blocksMovement, blocksProjectiles, blocksFlying, id}`. */
    this.objects = [];
    /** Door openings punched into the wall ring while a door is open. */
    this.openings = [];
  }

  /** Local tile coordinates for a world position. */
  toLocal(wx, wy) {
    return [Math.floor(wx - this.origin.x), Math.floor(wy - this.origin.y)];
  }

  inBounds(lx, ly) {
    return lx >= 0 && ly >= 0 && lx < this.w && ly < this.h;
  }

  /** Is `(lx, ly)` inside any carved door opening? */
  #isOpening(lx, ly) {
    for (const o of this.openings) {
      if (lx >= o.x0 && lx <= o.x1 && ly >= o.y0 && ly <= o.y1) return true;
    }
    return false;
  }

  isSolidTile(lx, ly) {
    // Openings are checked FIRST, before the bounds test.
    //
    // This grid covers the room INTERIOR only — the wall ring lives at local -1 and at
    // w/h, both out of bounds. Door openings are carved exactly there, so testing bounds
    // first meant every opening was unreachable and the player bounced off walls where a
    // door plainly was. It read as "sometimes" rather than "always" because only NORTH
    // and WEST doors put their trigger point outside the grid; EAST and SOUTH doors sit
    // on the last interior tile and happened to work.
    if (this.#isOpening(lx, ly)) return false;
    if (!this.inBounds(lx, ly)) return true; // outside the room is solid
    return Boolean(this.solid[ly * this.w + lx]);
  }

  isPitTile(lx, ly) {
    return this.inBounds(lx, ly) && this.pit[ly * this.w + lx] === 1;
  }

  isLowCoverTile(lx, ly) {
    return this.inBounds(lx, ly) && this.lowCover[ly * this.w + lx] === 1;
  }

  /** True when a walkable tile exists at this world position. */
  isWalkable(wx, wy, { flying = false } = {}) {
    const [lx, ly] = this.toLocal(wx, wy);
    if (this.isSolidTile(lx, ly)) return false;
    if (!flying && this.isPitTile(lx, ly)) return false;
    return true;
  }

  /**
   * Circle vs static geometry.
   * Samples the tiles overlapping the circle's bounding box, which is exact for
   * axis-aligned tile grids and cheaper than per-tile distance tests.
   */
  circleHitsGeometry(wx, wy, radius, { flying = false } = {}) {
    const minX = Math.floor(wx - radius - this.origin.x);
    const maxX = Math.floor(wx + radius - this.origin.x);
    const minY = Math.floor(wy - radius - this.origin.y);
    const maxY = Math.floor(wy + radius - this.origin.y);
    for (let ly = minY; ly <= maxY; ly += 1) {
      for (let lx = minX; lx <= maxX; lx += 1) {
        const blocked = this.isSolidTile(lx, ly) || (!flying && this.isPitTile(lx, ly));
        if (!blocked) continue;
        // Tile box in world units.
        const box = {
          x: this.origin.x + lx + 0.5,
          y: this.origin.y + ly + 0.5,
          w: 1, h: 1,
        };
        if (circleBoxOverlap(wx, wy, radius, box)) return true;
      }
    }
    return false;
  }

  /** Circle vs dynamic objects that block movement. */
  circleHitsObject(wx, wy, radius, { flying = false } = {}) {
    for (const obj of this.objects) {
      if (obj.destroyed) continue;
      if (!obj.blocksMovement) continue;
      if (flying && !obj.blocksFlying) continue;
      if (circleBoxOverlap(wx, wy, radius, obj)) return obj;
    }
    return null;
  }

  /** Full movement blocking test. */
  isBlocked(wx, wy, radius, opts = {}) {
    if (this.circleHitsGeometry(wx, wy, radius, opts)) return true;
    return Boolean(this.circleHitsObject(wx, wy, radius, opts));
  }

  /**
   * Register a door opening so an open door is walkable.
   * @param {{x0:number,y0:number,x1:number,y1:number}} rect local tile rect
   */
  addOpening(rect) {
    this.openings.push(rect);
  }

  clearOpenings() {
    this.openings.length = 0;
  }

  addObject(obj) {
    this.objects.push(obj);
    return obj;
  }

  removeObject(id) {
    const idx = this.objects.findIndex((o) => o.id === id);
    if (idx >= 0) this.objects.splice(idx, 1);
  }
}

/**
 * Move a circular entity with wall sliding.
 *
 * @param {{x:number, y:number, radius:number, flying?:boolean}} entity
 * @param {number} dx desired delta in world units
 * @param {number} dy desired delta in world units
 * @param {RoomCollision} collision
 * @returns {{movedX:boolean, movedY:boolean, hitObject:object|null}}
 */
export function moveWithCollision(entity, dx, dy, collision) {
  const r = entity.radius;
  const flying = Boolean(entity.flying);
  const opts = { flying };
  let hitObject = null;
  let movedX = false;
  let movedY = false;

  if (dx !== 0) {
    const targetX = entity.x + dx;
    if (!collision.isBlocked(targetX, entity.y, r, opts)) {
      entity.x = targetX;
      movedX = true;
    } else {
      // Sub-step so an entity ends up flush against the wall rather than a
      // fraction of a tile away, which otherwise looks like a floating gap.
      const step = Math.sign(dx) * 0.02;
      let moved = 0;
      while (Math.abs(moved) < Math.abs(dx)
        && !collision.isBlocked(entity.x + step, entity.y, r, opts)) {
        entity.x += step;
        moved += step;
        movedX = true;
      }
      hitObject = hitObject || collision.circleHitsObject(entity.x + Math.sign(dx) * r, entity.y, 0.05, opts);
    }
  }

  if (dy !== 0) {
    const targetY = entity.y + dy;
    if (!collision.isBlocked(entity.x, targetY, r, opts)) {
      entity.y = targetY;
      movedY = true;
    } else {
      const step = Math.sign(dy) * 0.02;
      let moved = 0;
      while (Math.abs(moved) < Math.abs(dy)
        && !collision.isBlocked(entity.x, entity.y + step, r, opts)) {
        entity.y += step;
        moved += step;
        movedY = true;
      }
      hitObject = hitObject || collision.circleHitsObject(entity.x, entity.y + Math.sign(dy) * r, 0.05, opts);
    }
  }

  return { movedX, movedY, hitObject };
}

/**
 * Push an entity out of geometry it is already inside.
 *
 * Needed after teleports, knockback, and room transitions: GDD R-CMB-006 wants no
 * entity stuck where it cannot act, and a spawn overlapping a desk corner is
 * exactly that. Searches outward in a deterministic spiral.
 */
export function resolveOverlap(entity, collision, maxRadius = 4) {
  if (!collision.isBlocked(entity.x, entity.y, entity.radius, { flying: entity.flying })) {
    return true;
  }
  for (let ring = 1; ring <= maxRadius * 4; ring += 1) {
    const dist = ring * 0.25;
    // Eight directions, cardinals first so pushes look intentional.
    for (const [dx, dy] of [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707],
    ]) {
      const nx = entity.x + dx * dist;
      const ny = entity.y + dy * dist;
      if (!collision.isBlocked(nx, ny, entity.radius, { flying: entity.flying })) {
        entity.x = nx;
        entity.y = ny;
        return true;
      }
    }
  }
  return false;
}

/**
 * Projectile collision against room geometry and objects.
 *
 * GDD 6.3 gives projectiles a collision mask and 6.4 resolves wall interaction
 * according to projectile tags, so `ignoreFurniture` (Wireless Dongle, ITM-014)
 * is honoured here while boundary walls stay solid — the item explicitly must not
 * let attacks leave the room or open secrets.
 */
export function projectileHitsWorld(p, collision) {
  const [lx, ly] = collision.toLocal(p.x, p.y);
  if (!collision.inBounds(lx, ly)) return { kind: 'WALL' };

  if (collision.isSolidTile(lx, ly)) return { kind: 'WALL' };

  // Low cover stops ground-level shots only.
  if (collision.isLowCoverTile(lx, ly) && !(p.mask & LAYER.PIT) && !p.overLowCover) {
    return { kind: 'LOW_COVER' };
  }

  for (const obj of collision.objects) {
    if (obj.destroyed || !obj.blocksProjectiles) continue;
    if (!circleBoxOverlap(p.x, p.y, p.radius, obj)) continue;
    if (p.ignoreFurnitureRemaining > 0) {
      // Consume one pass-through and keep flying (ITM-014's "first obstacle").
      p.ignoreFurnitureRemaining -= 1;
      continue;
    }
    return { kind: 'OBJECT', object: obj };
  }
  return null;
}

/**
 * Reflect a projectile off the surface it struck.
 *
 * Chooses the axis by testing which neighbouring tile is solid, which handles
 * corners correctly: a shot into an inside corner reverses both components
 * instead of tunnelling through.
 */
export function bounceProjectile(p, collision) {
  const [lx, ly] = collision.toLocal(p.x, p.y);
  const solidX = collision.isSolidTile(lx + Math.sign(p.velocity.x || 1), ly);
  const solidY = collision.isSolidTile(lx, ly + Math.sign(p.velocity.y || 1));
  if (solidX && solidY) {
    p.velocity.x = -p.velocity.x;
    p.velocity.y = -p.velocity.y;
  } else if (solidX) {
    p.velocity.x = -p.velocity.x;
  } else if (solidY) {
    p.velocity.y = -p.velocity.y;
  } else {
    // Struck an object rather than the grid: reverse the dominant component.
    if (Math.abs(p.velocity.x) >= Math.abs(p.velocity.y)) p.velocity.x = -p.velocity.x;
    else p.velocity.y = -p.velocity.y;
  }
  // Nudge out of the surface so the next tick does not re-collide immediately.
  p.x += Math.sign(p.velocity.x) * 0.06;
  p.y += Math.sign(p.velocity.y) * 0.06;
}

/**
 * Line of sight between two world points, sampled against the geometry grid.
 * Used by cover-peeking enemies (ENM-011) and vision-cone guards (ENM-041).
 */
export function hasLineOfSight(x0, y0, x1, y1, collision, { blockOnLowCover = false } = {}) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return true;
  const steps = Math.ceil(dist * 2);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const [lx, ly] = collision.toLocal(x0 + dx * t, y0 + dy * t);
    if (collision.isSolidTile(lx, ly)) return false;
    if (blockOnLowCover && collision.isLowCoverTile(lx, ly)) return false;
    for (const obj of collision.objects) {
      if (obj.destroyed || !obj.blocksLineOfSight) continue;
      if (circleBoxOverlap(x0 + dx * t, y0 + dy * t, 0.05, obj)) return false;
    }
  }
  return true;
}

/**
 * Clamp an entity inside the room's walkable interior.
 * A last-resort guard: knockback and conveyor pushes should never be able to
 * shove an entity into the void even if a frame's math goes wrong.
 */
export function clampToRoom(entity, collision) {
  const minX = collision.origin.x + entity.radius;
  const minY = collision.origin.y + entity.radius;
  const maxX = collision.origin.x + collision.w - entity.radius;
  const maxY = collision.origin.y + collision.h - entity.radius;
  entity.x = clamp(entity.x, minX, maxX);
  entity.y = clamp(entity.y, minY, maxY);
}

export { SOLID_CHARS, PIT_CHARS, LOW_COVER_CHARS, TILE };
