/**
 * Status effect container.
 *
 * GDD refs: 5.5 (Status effects table and its per-status rules), 6.3 (status
 *           payload on projectiles), 14.2 (rule enemies), R-PLY-003 (clamps),
 *           R-UIX-005 (every colour cue has a non-colour cue — statuses carry an
 *           icon id, never colour alone).
 *
 * The GDD constrains several statuses far more tightly on the player than on
 * enemies, and those asymmetries are encoded here rather than left to callers:
 *
 *  - Confused MUST NOT invert player direction in baseline content. Player-side
 *    Confused only produces aim wobble.
 *  - Rooted is not used on the player in normal combat.
 *  - Silenced only blocks player active use inside clearly telegraphed special
 *    encounters, so it requires an explicit `telegraphed` flag.
 *  - Shock only disrupts player input for exceptional hazards, and never as a
 *    long stun.
 *  - Burn cannot kill the player below one half-unit unless tagged lethal.
 */

import { STATUS } from '../core/constants.js';
import { clamp } from '../core/math.js';

/** Per-status rules. `playerAllowed: false` means the effect is enemy-only. */
export const STATUS_RULES = Object.freeze({
  [STATUS.SLOW]: {
    playerAllowed: true,
    stacking: 'REFRESH',
    maxSeconds: 8,
    /** Movement multiplier floor so Slow can never immobilise (R-PLY-003). */
    playerMoveMulFloor: 0.55,
    enemyMoveMulFloor: 0.3,
    iconId: 'ui_status_slow',
  },
  [STATUS.HASTE]: {
    playerAllowed: true,
    stacking: 'REFRESH',
    maxSeconds: 30,
    iconId: 'ui_status_haste',
  },
  [STATUS.BURN]: {
    playerAllowed: true,
    stacking: 'REFRESH',
    maxSeconds: 10,
    tickSeconds: 0.75,
    /** GDD 5.5: non-lethal on the player unless the source is tagged lethal. */
    playerNonLethal: true,
    iconId: 'ui_status_burn',
  },
  [STATUS.SHOCK]: {
    playerAllowed: true,
    stacking: 'REFRESH',
    /** Deliberately tiny: "no long stun" (GDD 5.5). */
    maxSeconds: 0.4,
    requiresExceptionalSource: true,
    iconId: 'ui_status_shock',
  },
  [STATUS.MARKED]: {
    playerAllowed: true,
    stacking: 'REFRESH_NO_MAGNITUDE_STACK',
    maxSeconds: 12,
    iconId: 'ui_status_marked',
  },
  [STATUS.CONFUSED]: {
    playerAllowed: true,
    stacking: 'REFRESH',
    maxSeconds: 5,
    /** GDD 5.5: direction inversion prohibited in baseline; wobble only. */
    playerInversionProhibited: true,
    iconId: 'ui_status_confused',
  },
  [STATUS.ROOTED]: {
    playerAllowed: false,
    stacking: 'REFRESH',
    maxSeconds: 4,
    iconId: 'ui_status_rooted',
  },
  [STATUS.SILENCED]: {
    playerAllowed: true,
    stacking: 'REFRESH',
    maxSeconds: 6,
    requiresTelegraph: true,
    iconId: 'ui_status_silenced',
  },
  [STATUS.CHARMED]: {
    playerAllowed: false,
    stacking: 'REFRESH',
    maxSeconds: 8,
    iconId: 'ui_status_charmed',
  },
});

/**
 * One active status instance.
 * @typedef {{status: string, remaining: number, duration: number,
 *            magnitude: number, sourceId: string, tickAccum: number,
 *            lethal: boolean}} StatusInstance
 */

export class StatusContainer {
  /** @param {boolean} isPlayer applies the player-side restrictions from GDD 5.5 */
  constructor(isPlayer = false) {
    this.isPlayer = isPlayer;
    /** @type {Map<string, StatusInstance>} */
    this.active = new Map();
  }

  has(status) {
    return this.active.has(status);
  }

  get(status) {
    return this.active.get(status);
  }

  get size() {
    return this.active.size;
  }

  /**
   * Apply a status.
   *
   * @param {string} status one of STATUS
   * @param {{seconds: number, magnitude?: number, sourceId?: string,
   *          lethal?: boolean, exceptional?: boolean, telegraphed?: boolean}} opts
   * @returns {boolean} true when the status was applied
   */
  apply(status, opts) {
    const rules = STATUS_RULES[status];
    if (!rules) return false;
    if (this.isPlayer && !rules.playerAllowed) return false;
    // Gate the statuses the GDD restricts to exceptional or telegraphed sources.
    if (this.isPlayer && rules.requiresExceptionalSource && !opts.exceptional) return false;
    if (this.isPlayer && rules.requiresTelegraph && !opts.telegraphed) return false;

    const seconds = clamp(opts.seconds, 0, rules.maxSeconds);
    if (seconds <= 0) return false;
    const magnitude = opts.magnitude ?? 1;
    const existing = this.active.get(status);

    if (existing) {
      // Refresh duration; only magnitude-stacking statuses raise magnitude, and
      // MARKED explicitly does not (GDD ITM-032: "Refreshing does not stack
      // magnitude").
      existing.remaining = Math.max(existing.remaining, seconds);
      existing.duration = Math.max(existing.duration, seconds);
      if (rules.stacking !== 'REFRESH_NO_MAGNITUDE_STACK') {
        existing.magnitude = Math.max(existing.magnitude, magnitude);
      }
      existing.lethal = existing.lethal || Boolean(opts.lethal);
      return true;
    }

    this.active.set(status, {
      status,
      remaining: seconds,
      duration: seconds,
      magnitude,
      sourceId: opts.sourceId || 'unknown',
      tickAccum: 0,
      lethal: Boolean(opts.lethal),
    });
    return true;
  }

  remove(status) {
    return this.active.delete(status);
  }

  clear() {
    this.active.clear();
  }

  /**
   * Advance timers.
   * @param {number} dt
   * @returns {{expired: string[], ticks: Array<{status:string, magnitude:number, lethal:boolean, sourceId:string}>}}
   */
  tick(dt) {
    const expired = [];
    const ticks = [];
    for (const instance of this.active.values()) {
      const rules = STATUS_RULES[instance.status];
      if (rules.tickSeconds) {
        instance.tickAccum += dt;
        while (instance.tickAccum >= rules.tickSeconds) {
          instance.tickAccum -= rules.tickSeconds;
          ticks.push({
            status: instance.status,
            magnitude: instance.magnitude,
            lethal: instance.lethal,
            sourceId: instance.sourceId,
          });
        }
      }
      instance.remaining -= dt;
      if (instance.remaining <= 0) expired.push(instance.status);
    }
    for (const status of expired) this.active.delete(status);
    return { expired, ticks };
  }

  /**
   * Combined movement multiplier from Slow and Haste, clamped so no combination
   * can immobilise an entity or send it to infinity (R-PLY-003).
   */
  movementMultiplier() {
    let mul = 1;
    const slow = this.active.get(STATUS.SLOW);
    if (slow) {
      const rules = STATUS_RULES[STATUS.SLOW];
      const floor = this.isPlayer ? rules.playerMoveMulFloor : rules.enemyMoveMulFloor;
      mul *= Math.max(floor, 1 - 0.3 * slow.magnitude);
    }
    const haste = this.active.get(STATUS.HASTE);
    if (haste) mul *= 1 + 0.25 * haste.magnitude;
    return clamp(mul, 0.25, 2.5);
  }

  /** Incoming-damage multiplier. Marked amplifies damage taken (GDD 5.5). */
  incomingDamageMultiplier() {
    const marked = this.active.get(STATUS.MARKED);
    if (!marked) return 1;
    return 1 + 0.15 * marked.magnitude;
  }

  /**
   * Aim wobble in radians. This is the player-side expression of Confused,
   * because direction inversion is prohibited in baseline content (GDD 5.5).
   */
  aimWobbleRadians() {
    const confused = this.active.get(STATUS.CONFUSED);
    if (!confused) return 0;
    return 0.18 * confused.magnitude;
  }

  /** True when the player cannot use an active item right now. */
  blocksActiveUse() {
    return this.active.has(STATUS.SILENCED);
  }

  /** True when movement input is suppressed. Enemy-only in practice. */
  blocksMovement() {
    return this.active.has(STATUS.ROOTED);
  }

  /** HUD-ready list. Icon ids give the non-colour cue required by R-UIX-005. */
  describe() {
    const out = [];
    for (const instance of this.active.values()) {
      out.push({
        status: instance.status,
        iconId: STATUS_RULES[instance.status].iconId,
        progress: instance.duration > 0 ? instance.remaining / instance.duration : 0,
      });
    }
    return out;
  }

  save() {
    return [...this.active.values()].map((i) => ({ ...i }));
  }

  load(list) {
    this.active.clear();
    for (const instance of list || []) this.active.set(instance.status, { ...instance });
    return this;
  }
}
