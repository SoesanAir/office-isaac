/**
 * Player health model.
 *
 * GDD refs: 5.2 (Health language), 5.3 (Damage resolution order), 9.2 (health
 *           pickups), R-PLY-001 (numeric internally, qualitative in UI),
 *           R-ECO-001 (obvious counters may be numeric), 17.2 (HUD layout).
 *
 * Everything is counted in **half-units**. Two half-units make one icon, and the
 * default employee starts with 6 half-units, i.e. three Composure icons. Combat
 * readability is the reason this model exists at all: the player must always be
 * able to answer "will the next hit kill me?" without arithmetic.
 *
 * Buffer types (Caffeine, Spite) are consumed before Composure and are stored as
 * separate stacks rather than as bonus Composure, because their *depletion* has
 * distinct consequences — Spite retaliates, Golden Cushion pays out.
 */

import { HEALTH } from '../core/constants.js';

/** Two half-units per icon, everywhere. */
export const HALVES_PER_ICON = 2;

export class Health {
  /**
   * @param {{composureContainers?: number, caffeineIcons?: number, spiteIcons?: number}} [opts]
   */
  constructor(opts = {}) {
    /** Maximum Composure capacity in half-units. */
    this.composureMax = (opts.composureContainers ?? 3) * HALVES_PER_ICON;
    /** Current Composure in half-units. */
    this.composure = this.composureMax;
    /** Buffer stacks in half-units. */
    this.caffeine = (opts.caffeineIcons ?? 0) * HALVES_PER_ICON;
    this.spite = (opts.spiteIcons ?? 0) * HALVES_PER_ICON;
    /**
     * Golden Cushion overlays. Each entry protects one icon: when that icon is
     * lost, the cushion pays out instead of simply vanishing (GDD 5.2).
     */
    this.goldenCushions = 0;
    /** Hard caps so absurd builds stay renderable in the HUD (GDD 17.2). */
    this.composureContainerCap = 12;
    this.bufferIconCap = 6;
  }

  get composureContainers() {
    return this.composureMax / HALVES_PER_ICON;
  }

  get total() {
    return this.composure + this.caffeine + this.spite;
  }

  get isDead() {
    return this.total <= 0;
  }

  /** True when a single half-unit hit would be fatal. Drives the low-health cue. */
  get isCritical() {
    return this.total <= 1;
  }

  // -- capacity -------------------------------------------------------------

  /**
   * Add or remove Composure containers.
   * GDD ITM-053 Burnout: "Cannot reduce maximum Composure below one full icon."
   * @returns {number} containers actually applied
   */
  addComposureContainers(count) {
    const current = this.composureContainers;
    const target = Math.max(1, Math.min(this.composureContainerCap, current + count));
    const applied = target - current;
    this.composureMax = target * HALVES_PER_ICON;
    if (this.composure > this.composureMax) this.composure = this.composureMax;
    return applied;
  }

  /** Heal Composure up to current capacity. Returns half-units actually healed. */
  healComposure(halfUnits) {
    const before = this.composure;
    this.composure = Math.min(this.composureMax, this.composure + halfUnits);
    return this.composure - before;
  }

  /** Fill every existing container (CARD-003 Sick Day, SUP-009 Full Recovery). */
  fillComposure() {
    return this.healComposure(this.composureMax - this.composure);
  }

  /**
   * Add buffer health. Caffeine and Spite normally cannot be added as
   * *containers*, only as filled icons (GDD 5.2).
   * @returns {number} half-units applied
   */
  addBuffer(kind, halfUnits) {
    const cap = this.bufferIconCap * HALVES_PER_ICON;
    if (kind === HEALTH.CAFFEINE) {
      const before = this.caffeine;
      this.caffeine = Math.min(cap, this.caffeine + halfUnits);
      return this.caffeine - before;
    }
    if (kind === HEALTH.SPITE) {
      const before = this.spite;
      this.spite = Math.min(cap, this.spite + halfUnits);
      return this.spite - before;
    }
    return 0;
  }

  addGoldenCushion(count = 1) {
    this.goldenCushions = Math.min(this.composureContainers, this.goldenCushions + count);
  }

  // -- damage ---------------------------------------------------------------

  /**
   * Consume `halfUnits` of health following GDD 5.3 step 3: buffers before
   * Composure, unless the source explicitly bypasses buffer health.
   *
   * This method performs no invulnerability, resistance, or event work — the
   * combat resolver owns those steps so the ordering in 5.3 stays in one place.
   *
   * @param {number} halfUnits
   * @param {{bypassBuffers?: boolean}} [opts]
   * @returns {{
   *   composureLost: number, caffeineLost: number, spiteLost: number,
   *   spiteIconsDepleted: number, cushionsTriggered: number, total: number
   * }}
   */
  consume(halfUnits, opts = {}) {
    const result = {
      composureLost: 0,
      caffeineLost: 0,
      spiteLost: 0,
      spiteIconsDepleted: 0,
      cushionsTriggered: 0,
      total: 0,
    };
    let remaining = Math.max(0, halfUnits);
    if (remaining === 0) return result;

    if (!opts.bypassBuffers) {
      // Caffeine first: it is the plain buffer and has no depletion payload, so
      // spending it before Spite preserves Spite's retaliation for later hits.
      if (this.caffeine > 0) {
        const take = Math.min(this.caffeine, remaining);
        this.caffeine -= take;
        remaining -= take;
        result.caffeineLost = take;
      }
      if (remaining > 0 && this.spite > 0) {
        const before = this.spite;
        const take = Math.min(this.spite, remaining);
        this.spite -= take;
        remaining -= take;
        result.spiteLost = take;
        // GDD 5.2: "When a full icon is depleted, damages all hostile enemies."
        result.spiteIconsDepleted =
          Math.floor(before / HALVES_PER_ICON) - Math.floor(this.spite / HALVES_PER_ICON);
      }
    }

    if (remaining > 0 && this.composure > 0) {
      const iconsBefore = Math.ceil(this.composure / HALVES_PER_ICON);
      const take = Math.min(this.composure, remaining);
      this.composure -= take;
      remaining -= take;
      result.composureLost = take;
      const iconsAfter = Math.ceil(this.composure / HALVES_PER_ICON);
      const iconsLost = iconsBefore - iconsAfter;
      if (iconsLost > 0 && this.goldenCushions > 0) {
        result.cushionsTriggered = Math.min(this.goldenCushions, iconsLost);
        this.goldenCushions -= result.cushionsTriggered;
      }
    }

    result.total = result.composureLost + result.caffeineLost + result.spiteLost;
    return result;
  }

  /**
   * Non-lethal damage floor used by Burn (GDD 5.5: "cannot kill the player below
   * one half-unit unless explicitly tagged lethal") and SUP-010 Bad Reaction.
   * @returns {number} half-units that may safely be dealt
   */
  clampNonLethal(halfUnits) {
    return Math.max(0, Math.min(halfUnits, this.total - 1));
  }

  /** ITM-058 Spare Keyboard: revive at one full Composure icon. */
  reviveTo(icons = 1) {
    this.caffeine = 0;
    this.spite = 0;
    this.composure = Math.min(this.composureMax, icons * HALVES_PER_ICON);
  }

  /**
   * HUD-ready icon description. The UI never needs raw half-units, and this
   * keeps R-UIX-001 honest: no numeric stat sheet, just icons.
   */
  describeIcons() {
    const icons = [];
    const composureIcons = this.composureContainers;
    for (let i = 0; i < composureIcons; i += 1) {
      const filled = this.composure - i * HALVES_PER_ICON;
      icons.push({
        kind: HEALTH.COMPOSURE,
        state: filled >= 2 ? 'FULL' : filled === 1 ? 'HALF' : 'EMPTY',
        golden: i < this.goldenCushions,
      });
    }
    for (let i = 0; i < Math.ceil(this.caffeine / HALVES_PER_ICON); i += 1) {
      const filled = this.caffeine - i * HALVES_PER_ICON;
      icons.push({ kind: HEALTH.CAFFEINE, state: filled >= 2 ? 'FULL' : 'HALF', golden: false });
    }
    for (let i = 0; i < Math.ceil(this.spite / HALVES_PER_ICON); i += 1) {
      const filled = this.spite - i * HALVES_PER_ICON;
      icons.push({ kind: HEALTH.SPITE, state: filled >= 2 ? 'FULL' : 'HALF', golden: false });
    }
    return icons;
  }

  save() {
    return {
      composureMax: this.composureMax,
      composure: this.composure,
      caffeine: this.caffeine,
      spite: this.spite,
      goldenCushions: this.goldenCushions,
    };
  }

  load(state) {
    this.composureMax = state.composureMax;
    this.composure = state.composure;
    this.caffeine = state.caffeine;
    this.spite = state.spite;
    this.goldenCushions = state.goldenCushions ?? 0;
    return this;
  }
}
