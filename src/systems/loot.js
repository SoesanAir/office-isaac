/**
 * Loot service.
 *
 * GDD refs: 8.3 (item quality bands and the ten pools), 8.4 (the weighted generation
 *           algorithm, verbatim, including the quality gate table and seen decay),
 *           R-ITM-003 (odds are data-driven and never player configurable),
 *           R-ITM-004 (floor 1 can produce a quality-4 jackpot at 0.10 percent),
 *           R-ITM-008 (strong builds are NOT secretly balanced downward),
 *           R-LOOP-004 (clear rewards are deterministic from the run seed and room
 *           stream), 9.2 (pickups and counters), 9.3 (credit economy),
 *           13.4 (object outcome bands), 20.4 (scoped RNG streams).
 *
 * GDD 8.4 is written as numbered pseudocode, and `rollItem` follows it step for step
 * with the step numbers in the comments. That is deliberate: this is the function most
 * likely to drift from the design under pressure, because every balance conversation
 * ends up here.
 *
 * The rule this module exists to protect is R-ITM-008. There is no term anywhere in
 * this file that reads the player's current power. A run that is going well and a run
 * that is going badly draw from identical odds — the only inputs are the pool, the
 * depth, what has already been generated, and the seed.
 */

import { RNG_STREAMS } from '../core/rng.js';
import {
  EARLY_JACKPOT_CHANCE, POOL, QUALITY, COLLECTIBLE_CLASS,
} from '../core/constants.js';
import { EVENTS } from '../core/events.js';

/**
 * Normal maximum quality by floor depth (GDD 8.4's table).
 *
 * Floors 1-2 cap at quality 3; everything above is reachable only through the early
 * jackpot roll or an explicit set drop. From floor 3 the gate opens and rarity is
 * carried by pool weight rather than by a hard ceiling.
 */
export function qualityGateFor(depth) {
  return depth <= 2 ? QUALITY.MAJOR : QUALITY.JACKPOT;
}

/** Pickup kinds a clear reward or container can produce (GDD 9.2). */
export const PICKUP = Object.freeze({
  CREDIT: 'CREDIT',
  ACCESS_CARD: 'ACCESS_CARD',
  TONER_CHARGE: 'TONER_CHARGE',
  BATTERY: 'BATTERY',
  COMPOSURE: 'COMPOSURE',
  CAFFEINE: 'CAFFEINE',
  SPITE: 'SPITE',
  GOLDEN_CUSHION: 'GOLDEN_CUSHION',
  SUPPLEMENT: 'SUPPLEMENT',
  HEALTH: 'COMPOSURE',
});

/**
 * Weighted clear-reward table (GDD R-LOOP-004: "Normal room clears may produce a
 * pickup reward from a weighted clear pool").
 *
 * Nothing is the most common outcome on purpose. GDD 13.1's exploration rule wants
 * rewards tempting rather than guaranteed, and a room that always pays turns clearing
 * into a chore rather than a decision.
 */
const CLEAR_REWARD_TABLE = Object.freeze([
  { kind: null, weight: 46 },
  { kind: PICKUP.CREDIT, weight: 24, count: [1, 3] },
  { kind: PICKUP.COMPOSURE, weight: 10 },
  { kind: PICKUP.ACCESS_CARD, weight: 6 },
  { kind: PICKUP.TONER_CHARGE, weight: 6 },
  { kind: PICKUP.CAFFEINE, weight: 4 },
  { kind: PICKUP.BATTERY, weight: 3 },
  { kind: PICKUP.SUPPLEMENT, weight: 1 },
]);

/** Richer table for challenge rooms and multi-wave encounters. */
const RICH_REWARD_TABLE = Object.freeze([
  { kind: PICKUP.CREDIT, weight: 30, count: [3, 6] },
  { kind: PICKUP.COMPOSURE, weight: 18 },
  { kind: PICKUP.ACCESS_CARD, weight: 14 },
  { kind: PICKUP.TONER_CHARGE, weight: 12 },
  { kind: PICKUP.CAFFEINE, weight: 10 },
  { kind: PICKUP.BATTERY, weight: 8 },
  { kind: PICKUP.SUPPLEMENT, weight: 5 },
  { kind: PICKUP.GOLDEN_CUSHION, weight: 3 },
]);

export class LootService {
  /**
   * @param {object} deps
   * @param {object} deps.registry
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {() => object} deps.getRun
   */
  constructor({ registry, events, getRun }) {
    this.registry = registry;
    this.events = events;
    this.getRun = getRun;

    /** Content generated this run, so non-repeatables leave the pools (GDD 8.4). */
    this.generated = new Set();
    /** Content collected this run. */
    this.collected = new Set();
    /** Seen but left behind: stays eligible at reduced weight (GDD 8.4). */
    this.seen = new Set();
    /** Supplement appearance -> effect, shuffled once per run (R-CON-003). */
    this.supplementMap = new Map();
    this.identifiedSupplements = new Set();
  }

  /** Fresh run state. Called when a run starts. */
  reset() {
    this.generated.clear();
    this.collected.clear();
    this.seen.clear();
    this.supplementMap.clear();
    this.identifiedSupplements.clear();
    this.#shuffleSupplements();
  }

  /**
   * GDD 9.7 / R-CON-003: Supplement identities are shuffled onto appearances at run
   * start, and stay consistent within the run.
   */
  #shuffleSupplements() {
    const run = this.getRun();
    if (!run?.rng) return;
    const supplements = this.registry.all('supplement');
    if (supplements.length === 0) return;
    const rng = run.rng.stream(RNG_STREAMS.LOOT_ITEM, 'supplement-shuffle');
    // Appearances are just indices into the wrapper sprite set; the mapping is what
    // matters, and it must not be derivable from the effect id.
    const appearances = supplements.map((_, i) => `WRAPPER_${i}`);
    const effects = rng.shuffle(supplements.map((s) => s.id));
    appearances.forEach((appearance, i) => this.supplementMap.set(appearance, effects[i]));
  }

  /**
   * Roll one item from a pool. GDD 8.4, step by step.
   *
   * @param {object} args
   * @param {string} args.poolId one of POOL
   * @param {number} args.depth floor depth
   * @param {string} args.sourceKey stable id for the RNG context (room id, shop slot)
   * @param {string} [args.sourceTag] PEDESTAL / SHOP / CONTAINER / BOSS / MACHINE / EVENT
   * @param {string[]} [args.excludeIds] ids this roll must not return (reroll support)
   * @returns {{id: string, kind: string, quality: number, jackpot: boolean}|null}
   */
  rollItem({ poolId, depth, sourceKey, sourceTag = 'PEDESTAL', excludeIds = [] }) {
    const run = this.getRun();
    const pool = this.registry.all('lootPool').find((p) => p.pool === poolId);
    if (!pool) return null;

    // LOOT_ITEM keyed by pool and source, so a shop roll cannot shift a pedestal roll
    // and neither can shift the boss (GDD 20.4).
    const rng = run.rng.stream(RNG_STREAMS.LOOT_ITEM, poolId, depth, sourceKey);

    // --- step 1: load the pool's entries -----------------------------------
    let candidates = pool.entries.slice();

    // --- step 2: remove locked and already-collected non-repeatables -------
    candidates = candidates.filter((entry) => {
      const def = this.registry.get(entry.contentKind, entry.contentId);
      if (!def) return false;
      if (entry.requiredUnlock && !run.unlockFlags.has(entry.requiredUnlock)) return false;
      // A collected non-repeatable leaves every ordinary pool for the rest of the run.
      if (!def.repeatable && this.collected.has(entry.contentId)) return false;
      if (excludeIds.includes(entry.contentId)) return false;
      return true;
    });

    // --- step 3: source restrictions and required tags ---------------------
    candidates = candidates.filter((entry) => entry.sourceTagsAny.includes(sourceTag));

    // --- step 4: the normal quality gate for this depth --------------------
    const gate = pool.qualityGateOverride?.[depth] ?? qualityGateFor(depth);

    // --- step 5: the early jackpot roll (R-ITM-004) ------------------------
    // Rolled BEFORE the gate is applied, and it only *permits* quality 4 — it never
    // guarantees one. On floors 1-2 this is the 0.10 percent that makes an early
    // pedestal worth walking to (GDD 2.6: every run can become the run).
    let jackpot = false;
    if (depth <= 2 && rng.chance(EARLY_JACKPOT_CHANCE)) {
      jackpot = candidates.some((e) => e.quality === QUALITY.JACKPOT && e.earlyJackpotEligible);
    }

    // --- step 6: otherwise remove candidates above the gate ---------------
    if (!jackpot) {
      candidates = candidates.filter((entry) => entry.quality <= gate);
    } else {
      // A successful jackpot roll narrows to the jackpot tier: the whole point is
      // that this pedestal is exceptional, not merely unrestricted.
      candidates = candidates.filter((e) => e.quality === QUALITY.JACKPOT && e.earlyJackpotEligible);
    }

    // Depth gates from the entry itself.
    candidates = candidates.filter(
      (entry) => entry.minFloor <= depth && (!entry.maxFloor || entry.maxFloor >= depth),
    );
    if (candidates.length === 0) return null;

    // --- step 7: effective weight -----------------------------------------
    const weightOf = (entry) => {
      let weight = entry.baseWeight;
      // Depth shaping: high-quality entries stay rare early and become gradually more
      // available, which is GDD 8.4's "extremely low / low / moderate" progression
      // without a second table to keep in sync.
      if (entry.quality >= QUALITY.MAJOR) {
        weight *= Math.min(1, 0.25 + depth * 0.12);
      }
      // Seen but left behind: half weight (GDD 8.4's seen decay).
      if (this.seen.has(entry.contentId)) weight *= entry.seenDecay;
      // A repeatable already generated this run is slightly less likely again, so a
      // run does not fill up with copies of one item.
      if (this.generated.has(entry.contentId)) weight *= 0.6;
      // Department affinity (GDD 10.4 item_affinities).
      const affinity = run.department?.itemAffinities?.[entry.departmentAffinityTag];
      if (affinity) weight *= affinity;
      return weight;
    };

    // --- step 8: select with the source-specific stream --------------------
    const chosen = rng.pickWeighted(candidates, weightOf);
    if (!chosen) return null;

    // --- step 9: mark as generated ----------------------------------------
    this.generated.add(chosen.contentId);
    return {
      id: chosen.contentId,
      kind: chosen.contentKind,
      quality: chosen.quality,
      jackpot,
    };
  }

  /**
   * GDD 8.4: "Rerolls use the original room pool and cannot return the exact item
   * currently displayed."
   */
  rerollItem({ poolId, depth, sourceKey, currentId, sourceTag = 'PEDESTAL' }) {
    return this.rollItem({
      poolId, depth, sourceTag,
      // A different context key, so the reroll is a genuinely new draw rather than a
      // replay of the same one.
      sourceKey: `${sourceKey}:reroll`,
      excludeIds: currentId ? [currentId] : [],
    });
  }

  /** An item was seen on a pedestal but not taken (GDD 8.4 seen decay). */
  markSeen(contentId) {
    if (!contentId) return;
    this.seen.add(contentId);
    this.events.emit(EVENTS.ITEM_SEEN, { contentId });
  }

  /** An item was picked up. Non-repeatables leave the pools from here on. */
  markCollected(contentId) {
    if (!contentId) return;
    this.collected.add(contentId);
    this.seen.delete(contentId);
  }

  /**
   * Roll a room-clear reward (R-LOOP-004).
   *
   * @param {object} args
   * @param {object} args.room
   * @param {string} [args.profile] reward profile from the encounter
   * @returns {{kind: string, count: number}|null}
   */
  rollClearReward({ room, profile = 'NORMAL_CLEAR' }) {
    if (profile === 'NONE') return null;
    const run = this.getRun();
    // LOOT_PICKUP, not LOOT_ITEM: a clear reward must never shift the pedestal
    // sequence (GDD 20.4).
    const rng = run.rng.stream(RNG_STREAMS.LOOT_PICKUP, run.floor.id, room.nodeId);
    const table = profile === 'RICH_CLEAR' || profile === 'PREMIUM' || profile === 'CHALLENGE'
      ? RICH_REWARD_TABLE
      : CLEAR_REWARD_TABLE;

    let entries = table;
    // GDD ITM-050 Open Calendar raises the clear reward chance, and ITM-037 Mini
    // Fridge biases health. Both act by reweighting rather than by adding a term to
    // the roll, so the table stays the single description of what can drop.
    const bias = this.#rewardBias();
    if (bias.noneMultiplier !== 1 || bias.healthMultiplier !== 1) {
      entries = table.map((e) => ({
        ...e,
        weight: e.weight
          * (e.kind === null ? bias.noneMultiplier : 1)
          * (e.kind === PICKUP.COMPOSURE || e.kind === PICKUP.CAFFEINE ? bias.healthMultiplier : 1),
      }));
    }

    const picked = rng.pickWeighted(entries, (e) => e.weight);
    if (!picked || picked.kind === null) return null;
    const count = picked.count ? rng.int(picked.count[0], picked.count[1]) : 1;
    return { kind: picked.kind, count };
  }

  /** Item-driven reward reweighting. Never reads current power (R-ITM-008). */
  #rewardBias() {
    const player = this.getRun()?.player;
    const bias = { noneMultiplier: 1, healthMultiplier: 1 };
    if (!player) return bias;
    // ITM-050 Open Calendar: "Hostile room clear reward chance is 15 percentage points
    // higher." Expressed as a reduction in the nothing weight, which is the same thing
    // and keeps the other proportions intact.
    if (player.hasPassive?.('ITM-050')) bias.noneMultiplier *= 0.55;
    // ITM-037 Mini Fridge: "Increase health pickup weight after combat."
    if (player.hasPassive?.('ITM-037')) bias.healthMultiplier *= 1.8;
    return bias;
  }

  /**
   * Place the pedestal item for a room role. GDD 12.5's required-reward table.
   * @returns {{id: string, kind: string, quality: number, jackpot: boolean}|null}
   */
  placePedestal({ room, depth, poolId }) {
    const pool = poolId ?? POOL_FOR_ROLE[room.role] ?? POOL.SUPPLY_CLOSET;
    const rolled = this.rollItem({
      poolId: pool, depth, sourceKey: room.nodeId, sourceTag: 'PEDESTAL',
    });
    if (!rolled) return null;
    room.pedestal = {
      ...rolled,
      x: room.rewardAnchor.x,
      y: room.rewardAnchor.y,
      taken: false,
    };
    return rolled;
  }

  /** Resolve a Supplement wrapper to its effect for this run (R-CON-003). */
  resolveSupplement(appearance) {
    return this.supplementMap.get(appearance) ?? null;
  }

  /**
   * R-CON-004: once identified, every matching wrapper shows the known effect for the
   * rest of the run.
   */
  identifySupplement(appearance) {
    const id = this.supplementMap.get(appearance);
    if (id) this.identifiedSupplements.add(appearance);
    return id;
  }

  isSupplementIdentified(appearance) {
    return this.identifiedSupplements.has(appearance);
  }

  /** Serialise for the run save. */
  save() {
    return {
      generated: [...this.generated],
      collected: [...this.collected],
      seen: [...this.seen],
      supplementMap: [...this.supplementMap.entries()],
      identifiedSupplements: [...this.identifiedSupplements],
    };
  }

  load(state) {
    if (!state) return this;
    this.generated = new Set(state.generated || []);
    this.collected = new Set(state.collected || []);
    this.seen = new Set(state.seen || []);
    this.supplementMap = new Map(state.supplementMap || []);
    this.identifiedSupplements = new Set(state.identifiedSupplements || []);
    return this;
  }
}

/** Which pool a room role draws its pedestal from (GDD 8.3, 12.5). */
export const POOL_FOR_ROLE = Object.freeze({
  'ROOM-005': POOL.SUPPLY_CLOSET,
  'ROOM-007': POOL.MANAGER_REWARD,
  'ROOM-006': POOL.OFFICE_SUPPLY_SHOP,
  'ROOM-012': POOL.SECRET_MAINTENANCE,
  'ROOM-013': POOL.SECRET_MAINTENANCE,
  'ROOM-014': POOL.RESTRICTED_RECORDS,
  'ROOM-017': POOL.INNOVATION_LAB,
  'ROOM-021': POOL.GOLDEN_CABINET,
  'ROOM-023': POOL.EXECUTIVE_DEAL,
  'ROOM-024': POOL.UNION_BREAKROOM,
});

/**
 * Apply a collected pickup to the player.
 *
 * Kept here rather than on the Player because the *meaning* of a pickup is an economy
 * decision (GDD 9.2, 9.3) while the Player only owns its own counters.
 */
export function applyPickup(player, kind, count = 1) {
  switch (kind) {
    case PICKUP.CREDIT:
      player.addCredits(count);
      return true;
    case PICKUP.ACCESS_CARD:
      player.addAccessCards(count);
      return true;
    case PICKUP.TONER_CHARGE:
      player.addTonerCharges(count);
      return true;
    case PICKUP.BATTERY:
      // Batteries are wasted with no active equipped, which is honest: the HUD shows
      // no active slot, so there is nothing misleading about the pickup existing.
      player.grantActiveCharge?.(count, null);
      return true;
    case PICKUP.COMPOSURE:
      // Refills up to current capacity only (GDD 9.2).
      return player.health.healComposure(count * 2) > 0;
    case PICKUP.CAFFEINE:
      player.health.addBuffer('CAFFEINE', count * 2);
      return true;
    case PICKUP.SPITE:
      player.health.addBuffer('SPITE', count * 2);
      return true;
    case PICKUP.GOLDEN_CUSHION:
      player.health.addGoldenCushion(count);
      return true;
    default:
      return false;
  }
}

export { CLEAR_REWARD_TABLE, RICH_REWARD_TABLE, COLLECTIBLE_CLASS };
