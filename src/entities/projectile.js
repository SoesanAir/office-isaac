/**
 * Projectile model and pool.
 *
 * GDD refs: 6.3 (Projectile model — every field in that table exists here),
 *           6.4 (Collision priorities), 7.5 (performance and readability),
 *           18.5 (friendly vs hostile outline families),
 *           R-CMB-004 (counts capped through pooling and effect aggregation, not
 *           silent mechanical deletion), 20.7 (600 simultaneous logical
 *           projectiles).
 */

import { ALLEGIANCE, BUDGETS, LAYER, OUTLINE_BY_ALLEGIANCE } from '../core/constants.js';
import { Pool } from '../core/pool.js';

/** On-impact actions from GDD 6.3. */
/**
 * How long a projectile spends visibly falling before it expires.
 *
 * Short enough that it reads as the shot running out of energy rather than as a separate
 * arc, long enough to see at 60fps. Presentation only.
 */
const FALL_SECONDS = 0.22;

export const IMPACT_ACTION = Object.freeze({
  DESTROY: 'DESTROY',
  STICK: 'STICK',
  SPLIT: 'SPLIT',
  EXPLODE: 'EXPLODE',
  RETURN: 'RETURN',
  SPAWN: 'SPAWN',
  CONTINUE: 'CONTINUE',
});

/** Blank projectile shape. One object layout keeps the pool monomorphic. */
function makeProjectile() {
  return {
    id: 0,
    // Owner and allegiance (GDD 6.3 "Owner")
    owner: ALLEGIANCE.NEUTRAL,
    ownerId: '',
    // Transform
    x: 0, y: 0, prevX: 0, prevY: 0,
    vx: 0, vy: 0,
    angle: 0,
    radius: 0.22,
    size: 1,
    // Damage
    damage: 0,
    damageTags: null,
    critChance: 0,
    critMultiplier: 2,
    armorPierceFraction: 0,
    knockback: 0,
    // Lifetime
    lifetime: 0,
    maxLifetime: 0,
    /** 0..1 over the final moments of flight. Presentation only. */
    fall: 0,
    // Collision
    collisionMask: 0,
    // Behaviour counters
    pierce: 0,
    bounce: 0,
    // Status payload (GDD 6.3)
    statusPayload: null,
    // Behaviour
    onImpact: IMPACT_ACTION.DESTROY,
    // Homing / steering
    homingStrength: 0,
    homingTargetId: null,
    homingAcquireRadius: 0,
    // Return behaviour (ITM-021 Backspace)
    returning: false,
    returnDamageScale: 0.6,
    // Split behaviour
    splitCount: 0,
    splitDamageScale: 0.55,
    // Trail behaviour (WPN-006 Marker, ITM-035 Toner Dust)
    trailHazardId: null,
    trailChance: 0,
    trailAccum: 0,
    // Sticky behaviour (ITM-016 Sticky Keys, WPN-011 Label Maker)
    stuckToId: null,
    stickSeconds: 0,
    popDamage: 0,
    // Wall interaction
    passesFurniture: 0,
    // Presentation
    spriteId: '',
    outlineFamily: '',
    visualPriority: 0,
    /** True for projectiles merged into an aggregated stream (GDD 7.5). */
    aggregated: false,
    // Hit memory so pierce cannot double-tap one target on consecutive frames
    hitIds: null,
    __pooled: false,
    __dead: false,
  };
}

function resetProjectile(p) {
  p.owner = ALLEGIANCE.NEUTRAL;
  p.ownerId = '';
  p.x = 0; p.y = 0; p.prevX = 0; p.prevY = 0;
  p.vx = 0; p.vy = 0; p.angle = 0;
  p.radius = 0.22; p.size = 1;
  p.damage = 0; p.damageTags = null;
  p.critChance = 0; p.critMultiplier = 2; p.armorPierceFraction = 0; p.knockback = 0;
  p.lifetime = 0; p.maxLifetime = 0; p.fall = 0;
  p.collisionMask = 0;
  p.pierce = 0; p.bounce = 0;
  p.statusPayload = null;
  p.onImpact = IMPACT_ACTION.DESTROY;
  p.homingStrength = 0; p.homingTargetId = null; p.homingAcquireRadius = 0;
  p.returning = false; p.returnDamageScale = 0.6;
  p.splitCount = 0; p.splitDamageScale = 0.55;
  p.trailHazardId = null; p.trailChance = 0; p.trailAccum = 0;
  p.stuckToId = null; p.stickSeconds = 0; p.popDamage = 0;
  p.passesFurniture = 0;
  p.spriteId = ''; p.outlineFamily = ''; p.visualPriority = 0;
  p.aggregated = false;
  if (p.hitIds) p.hitIds.clear(); else p.hitIds = new Set();
  p.__dead = false;
}

/**
 * Projectile pool with the GDD's mechanical cap.
 *
 * When the cap is reached the pool does NOT drop the shot silently. It reports
 * exhaustion; the attack system responds by aggregating presentation (many small
 * strips become one stream sprite) while still resolving damage, which is exactly
 * what R-CMB-004 requires.
 */
export class ProjectileSystem {
  constructor({ events, capacity = BUDGETS.maxLogicalProjectiles } = {}) {
    this.events = events;
    this.pool = new Pool(makeProjectile, resetProjectile, capacity, 'projectiles');
    this.nextId = 1;
    /** Count of shots that had to be aggregated rather than instanced. */
    this.aggregatedCount = 0;
  }

  get active() {
    return this.pool.active;
  }

  get count() {
    return this.pool.size;
  }

  /**
   * Spawn a projectile from a template. Returns null only when the cap forced
   * aggregation, in which case the caller must still resolve the damage.
   */
  spawn(template) {
    const p = this.pool.acquire();
    if (!p) {
      this.aggregatedCount += 1;
      return null;
    }
    Object.assign(p, template);
    p.id = this.nextId++;
    p.prevX = p.x;
    p.prevY = p.y;
    p.lifetime = 0;
    if (!p.hitIds) p.hitIds = new Set(); else p.hitIds.clear();
    p.collisionMask = p.collisionMask || defaultMaskFor(p.owner);
    p.outlineFamily = p.outlineFamily || OUTLINE_BY_ALLEGIANCE[p.owner] || 'NEUTRAL';
    return p;
  }

  release(p) {
    this.pool.release(p);
  }

  /** Advance positions. Collision resolution lives in the physics system. */
  integrate(dt) {
    this.pool.forEach((p) => {
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime += dt;
      // Fall phase. Over the last FALL_SECONDS of its life a projectile arcs toward the
      // floor and shrinks, so it visibly *lands* instead of blinking out of existence.
      // `fall` is 0..1 and purely presentational — collision and damage are unchanged,
      // because a shot that stopped hurting before it expired would be a stealth nerf to
      // every weapon in the game.
      if (p.maxLifetime > 0) {
        const left = p.maxLifetime - p.lifetime;
        p.fall = left < FALL_SECONDS ? Math.min(1, 1 - left / FALL_SECONDS) : 0;
      }
      if (p.maxLifetime > 0 && p.lifetime >= p.maxLifetime) {
        if (p.onImpact === IMPACT_ACTION.RETURN && !p.returning) {
          // ITM-021 Backspace: reverse at the range limit rather than expiring.
          p.returning = true;
          p.vx = -p.vx;
          p.vy = -p.vy;
          p.damage *= p.returnDamageScale;
          p.lifetime = 0;
          p.hitIds.clear();
        } else {
          this.pool.release(p);
        }
      }
    });
  }

  sweep(onRelease) {
    this.pool.sweep(onRelease);
  }

  clear(onRelease) {
    this.pool.clear(onRelease);
    this.aggregatedCount = 0;
  }

  stats() {
    return { ...this.pool.stats(), aggregated: this.aggregatedCount };
  }
}

/** Default collision mask by owner, per GDD 6.3 "Collision mask". */
export function defaultMaskFor(owner) {
  if (owner === ALLEGIANCE.PLAYER) {
    return LAYER.ENEMY | LAYER.OBSTACLE | LAYER.WALL | LAYER.DOOR | LAYER.SECRET_WALL;
  }
  if (owner === ALLEGIANCE.ENEMY) {
    return LAYER.PLAYER | LAYER.OBSTACLE | LAYER.WALL | LAYER.DOOR;
  }
  return LAYER.PLAYER | LAYER.ENEMY | LAYER.OBSTACLE | LAYER.WALL;
}
