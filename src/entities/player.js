/**
 * The player entity: movement, build state, resources, and resolved stats.
 *
 * GDD refs: 5.1 (Starting profile — every default here is quoted from that
 *           table), 5.4 (core stat rules), 4.1-4.2 (controls and aiming),
 *           6.5 (active item recharge), 8.1 (collectible classes and slots),
 *           9.1 (pocket slot), 9.2 (resource counters), 16.6 (employee profiles),
 *           R-PLY-002 (movement stays responsive while firing),
 *           R-PLY-003 (stat clamps), R-PLY-005 (readable when surrounded),
 *           R-PLY-006 (no reputation meter).
 */

import {
  ALLEGIANCE, CLAMPS, COLLECTIBLE_CLASS, DIR, LAYER,
} from '../core/constants.js';
import { clamp, clampStat, damp, normalizeInto } from '../core/math.js';
import { Timer } from '../core/loop.js';
import { Health } from './health.js';
import { StatusContainer } from './status.js';

/**
 * Baseline stats, straight from GDD 5.1. These are the balance reference for the
 * whole game, so they live in exactly one place and nothing else hardcodes them.
 */
export const BASE_STATS = Object.freeze({
  moveSpeed: 5.5,          // world units / second
  damage: 10,              // base hit units before weapon multipliers
  attackInterval: 0.45,    // seconds between Keyboard shots
  projectileSpeed: 9.0,    // world units / second
  range: 0.95,             // projectile lifetime in seconds
  luck: 0,                 // hidden; only consulted by effects that say so
  invulnerabilitySeconds: 0.75,
  projectileSize: 1.0,
  knockback: 1.0,
  pierce: 0,
  bounce: 0,
  spread: 1.0,
  contactDamageResistMul: 1.0,
  explosionDamageResistMul: 1.0,
  incomingKnockbackMul: 1.0,
  armorPierceFraction: 0,
  critChance: 0,
  critMultiplier: 2,
  activeChargeCapacityBonus: 0,
});

export class Player {
  constructor({ id = 'player', profile = null } = {}) {
    this.id = id;
    this.allegiance = ALLEGIANCE.PLAYER;
    this.collisionLayer = LAYER.PLAYER;

    // --- transform -------------------------------------------------------
    this.x = 0;
    this.y = 0;
    this.velocity = { x: 0, y: 0 };
    /** Collision radius in world units. Tuned so a 3-unit door is comfortable. */
    this.radius = 0.42;
    this.facing = DIR.SOUTH;
    /** Last aim direction that produced a shot; drives held-weapon rendering. */
    this.aimDirection = DIR.SOUTH;

    // --- vitals ----------------------------------------------------------
    this.health = new Health({ composureContainers: 3 });
    this.status = new StatusContainer(true);
    this.invulnerability = new Timer(BASE_STATS.invulnerabilitySeconds);
    this.dead = false;
    /** PRF-006 Executive Assistant: a regenerating briefcase shield. */
    this.shield = null;
    this.hazardImmunity = false;
    /** CARD-012 Remote Day: flight over hazards and furniture for one room. */
    this.flying = false;

    // --- build (GDD 8.1 slot table) ---------------------------------------
    this.weaponId = null;
    /** Ordered acquisition list; order is part of deterministic effect sorting. */
    this.passiveIds = [];
    this.passiveCounts = new Map();
    this.activeId = null;
    this.activeCharge = 0;
    /** One Action Card OR one Supplement (GDD 9.1). */
    this.pocket = null;
    this.pocketCapacity = 1;
    this.charmId = null;
    this.transformationIds = [];

    // --- resources (GDD 9.2, visible integers per R-ECO-001) --------------
    this.credits = 0;
    this.accessCards = 0;
    this.tonerCharges = 0;
    /** ITM-059 Corporate Card: temporary debt, never persisted between runs. */
    this.creditDebt = 0;

    // --- combat timing ----------------------------------------------------
    this.attackCooldown = 0;
    this.chargeHeld = 0;
    this.isCharging = false;
    /** Counters owned by rhythm items (ITM-018 Caps Lock, ITM-019 Shift Key). */
    this.attackCounter = 0;
    this.alternateState = false;

    // --- resolved stats ---------------------------------------------------
    /** Rebuilt by the attack graph whenever the build changes. */
    this.stats = { ...BASE_STATS };
    /** Per-floor and per-room bookkeeping used by many items. */
    this.floorFlags = new Map();
    this.roomFlags = new Map();

    this.profileId = profile?.id ?? null;
    if (profile) this.applyProfile(profile);
  }

  /** GDD 16.6: profiles change starting conditions, never the control set. */
  applyProfile(profile) {
    const s = profile.starting;
    this.health = new Health({
      composureContainers: s.composureContainers,
      caffeineIcons: s.caffeineIcons,
      spiteIcons: s.spiteIcons,
    });
    this.weaponId = s.weapon;
    this.passiveIds = [...(s.passives || [])];
    for (const id of this.passiveIds) {
      this.passiveCounts.set(id, (this.passiveCounts.get(id) || 0) + 1);
    }
    this.activeId = s.active ?? null;
    this.charmId = s.charm ?? null;
    if (s.card) this.pocket = { class: COLLECTIBLE_CLASS.ACTION_CARD, id: s.card };
    this.credits = s.resources?.credits ?? 0;
    this.accessCards = s.resources?.accessCards ?? 0;
    this.tonerCharges = s.resources?.tonerCharges ?? 0;
    if ((s.rules || []).includes('REGENERATING_SHIELD')) {
      this.shield = { charges: 1, maxCharges: 1, rechargeSeconds: 12, rechargeTimer: 0 };
    }
    this.profileRules = new Set(s.rules || []);
    this.profileStatOverrides = s.statOverrides || null;
    this.profileId = profile.id;
  }

  // -------------------------------------------------------------------------
  // Movement
  // -------------------------------------------------------------------------

  /**
   * Apply movement intent.
   *
   * GDD 4.1: eight-direction movement is allowed; speed is analog on stick and
   * normalised on keyboard. R-PLY-002: no baseline attack animation locks
   * movement, so this never consults attack state.
   *
   * @param {number} ix intent x in [-1, 1]
   * @param {number} iy intent y in [-1, 1]
   * @param {number} dt
   */
  applyMovement(ix, iy, dt) {
    const speed = this.effectiveMoveSpeed();
    const magnitude = Math.min(1, Math.hypot(ix, iy));
    if (magnitude > 0.001 && !this.status.blocksMovement()) {
      const dir = normalizeInto({ x: 0, y: 0 }, ix, iy);
      // Target velocity, approached with a short acceleration so the character
      // has weight without feeling laggy. ITM-006 Ergonomic Chair lowers turn
      // friction by raising this rate.
      const accel = this.turnRate();
      this.velocity.x = damp(this.velocity.x, dir.x * speed * magnitude, accel, dt);
      this.velocity.y = damp(this.velocity.y, dir.y * speed * magnitude, accel, dt);
      this.facing = Math.abs(ix) >= Math.abs(iy)
        ? (ix >= 0 ? DIR.EAST : DIR.WEST)
        : (iy >= 0 ? DIR.SOUTH : DIR.NORTH);
    } else {
      // Friction to a stop. Cheap Chair (ITM-052) grants knockback immunity but
      // its speed penalty is a stat, not extra friction, so this stays uniform.
      this.velocity.x = damp(this.velocity.x, 0, 18, dt);
      this.velocity.y = damp(this.velocity.y, 0, 18, dt);
    }
  }

  effectiveMoveSpeed() {
    const base = clampStat(this.stats.moveSpeed, CLAMPS.moveSpeed, BASE_STATS.moveSpeed);
    return base * this.status.movementMultiplier();
  }

  turnRate() {
    return this.stats.turnFriction ?? 22;
  }

  // -------------------------------------------------------------------------
  // Build mutation
  // -------------------------------------------------------------------------

  /**
   * Add a passive. GDD R-ITM-001: passives stack without a normal inventory cap.
   * @returns {number} the new stack count for that id
   */
  addPassive(id) {
    this.passiveIds.push(id);
    const count = (this.passiveCounts.get(id) || 0) + 1;
    this.passiveCounts.set(id, count);
    return count;
  }

  hasPassive(id) {
    return this.passiveCounts.has(id);
  }

  passiveCount(id) {
    return this.passiveCounts.get(id) || 0;
  }

  /**
   * Equip a weapon and report the one being displaced.
   * GDD R-WPN-002: the previous weapon stays available on that pedestal.
   */
  equipWeapon(id) {
    const previous = this.weaponId;
    this.weaponId = id;
    // R-WPN-006: a swap recalculates the attack graph from owned passives, and no
    // stale timing survives the change.
    this.attackCooldown = 0;
    this.chargeHeld = 0;
    this.isCharging = false;
    return previous;
  }

  /** @returns {string|null} the displaced active id */
  equipActive(id) {
    const previous = this.activeId;
    this.activeId = id;
    this.activeCharge = 0;
    return previous;
  }

  /** @returns {string|null} the displaced charm id */
  equipCharm(id) {
    const previous = this.charmId;
    this.charmId = id;
    return previous;
  }

  /**
   * GDD R-CON-001: picking up a second pocket item is a physical swap on the
   * floor, never an inventory menu.
   * @returns {{class:string,id:string}|null} the displaced pocket item
   */
  setPocket(entry) {
    const previous = this.pocket;
    this.pocket = entry;
    return previous;
  }

  // -------------------------------------------------------------------------
  // Active item charge (GDD 6.5)
  // -------------------------------------------------------------------------

  activeChargeCapacity(activeDef) {
    if (!activeDef) return 0;
    const base = activeDef.recharge.rooms ?? 1;
    return base + (this.stats.activeChargeCapacityBonus ?? 0);
  }

  /**
   * Grant charge units for clearing a room.
   * GDD 6.5: a normal room grants one unit; a large high-effort room may grant
   * two; empty and already-cleared rooms grant none (R-CMB-003).
   */
  grantActiveCharge(units, activeDef) {
    if (!activeDef || units <= 0) return 0;
    const cap = this.activeChargeCapacity(activeDef);
    const before = this.activeCharge;
    this.activeCharge = Math.min(cap, this.activeCharge + units);
    return this.activeCharge - before;
  }

  isActiveReady(activeDef) {
    if (!activeDef) return false;
    if (this.status.blocksActiveUse()) return false;
    if (this.floorFlags.get('activeDisabled')) return false; // ITM-054 Mandatory Training
    if (activeDef.recharge.mode === 'ROOMS') {
      return this.activeCharge >= this.activeChargeCapacity(activeDef);
    }
    if (activeDef.recharge.mode === 'CREDITS') return this.credits > 0;
    if (activeDef.recharge.mode === 'FED_ITEMS') return true;
    return this.activeCharge >= this.activeChargeCapacity(activeDef);
  }

  // -------------------------------------------------------------------------
  // Resources (GDD 9.2, 9.3)
  // -------------------------------------------------------------------------

  /** ITM-059: future credit pickups pay debt first. */
  addCredits(amount) {
    let value = amount;
    if (this.creditDebt > 0 && value > 0) {
      const paid = Math.min(this.creditDebt, value);
      this.creditDebt -= paid;
      value -= paid;
    }
    this.credits = clamp(this.credits + value, 0, 999);
    return this.credits;
  }

  canAfford(cost) {
    return this.credits + this.availableDebtRoom() >= cost;
  }

  availableDebtRoom() {
    return this.stats.debtLimit ?? 0;
  }

  spendCredits(cost) {
    if (this.credits >= cost) {
      this.credits -= cost;
      return true;
    }
    const shortfall = cost - this.credits;
    if (shortfall <= this.availableDebtRoom() - this.creditDebt) {
      this.creditDebt += shortfall;
      this.credits = 0;
      return true;
    }
    return false;
  }

  addAccessCards(n) {
    this.accessCards = clamp(this.accessCards + n, 0, 99);
  }

  addTonerCharges(n) {
    this.tonerCharges = clamp(this.tonerCharges + n, 0, 99);
  }

  // -------------------------------------------------------------------------
  // Per-scope bookkeeping
  // -------------------------------------------------------------------------

  /** Called on floor entry. Resets per-floor item state (Stress Ball, etc.). */
  beginFloor() {
    this.floorFlags.clear();
    this.attackCounter = 0; // ITM-018: counter resets on floor transition
  }

  beginRoom() {
    this.roomFlags.clear();
  }

  tick(dt) {
    this.invulnerability.tick(dt);
    if (this.shield && this.shield.charges < this.shield.maxCharges) {
      this.shield.rechargeTimer -= dt;
      if (this.shield.rechargeTimer <= 0) {
        this.shield.charges += 1;
        this.shield.rechargeTimer = this.shield.rechargeSeconds;
      }
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
  }

  /** Serialise into the run save (GDD 21.1, G.9). */
  save() {
    return {
      x: this.x, y: this.y,
      facing: this.facing,
      health: this.health.save(),
      status: this.status.save(),
      invulnerability: this.invulnerability.save(),
      dead: this.dead,
      shield: this.shield ? { ...this.shield } : null,
      weaponId: this.weaponId,
      passiveIds: [...this.passiveIds],
      activeId: this.activeId,
      activeCharge: this.activeCharge,
      pocket: this.pocket ? { ...this.pocket } : null,
      charmId: this.charmId,
      transformationIds: [...this.transformationIds],
      resources: {
        credits: this.credits,
        accessCards: this.accessCards,
        tonerCharges: this.tonerCharges,
        creditDebt: this.creditDebt,
      },
      attackCounter: this.attackCounter,
      alternateState: this.alternateState,
      profileId: this.profileId,
      floorFlags: [...this.floorFlags],
    };
  }

  load(state) {
    this.x = state.x; this.y = state.y;
    this.facing = state.facing;
    this.health.load(state.health);
    this.status.load(state.status);
    this.invulnerability.load(state.invulnerability);
    this.dead = state.dead;
    this.shield = state.shield ? { ...state.shield } : null;
    this.weaponId = state.weaponId;
    this.passiveIds = [...state.passiveIds];
    this.passiveCounts.clear();
    for (const id of this.passiveIds) {
      this.passiveCounts.set(id, (this.passiveCounts.get(id) || 0) + 1);
    }
    this.activeId = state.activeId;
    this.activeCharge = state.activeCharge;
    this.pocket = state.pocket ? { ...state.pocket } : null;
    this.charmId = state.charmId;
    this.transformationIds = [...state.transformationIds];
    this.credits = state.resources.credits;
    this.accessCards = state.resources.accessCards;
    this.tonerCharges = state.resources.tonerCharges;
    this.creditDebt = state.resources.creditDebt ?? 0;
    this.attackCounter = state.attackCounter ?? 0;
    this.alternateState = Boolean(state.alternateState);
    this.profileId = state.profileId;
    this.floorFlags = new Map(state.floorFlags || []);
    return this;
  }
}
