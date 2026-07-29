/**
 * Office Supply Shop: stock generation and purchase.
 *
 * GDD refs: 9.3 (the credit economy and the six price bands, used verbatim), 9.4
 *           (exactly one shop per normal floor; three sale slots plus one pickup slot;
 *           purchases are immediate with visible prices and no confirmation dialog),
 *           8.4 (loot selection; shop stock is rolled from POOL.OFFICE_SUPPLY_SHOP),
 *           R-ECO-001 (counters are visible integers), R-ECO-002 (a standard purchase
 *           never asks twice), R-ITM-008 (selection never accounts for current power),
 *           R-TEC-002 (same seed, same stock).
 *
 * Two things about this file are deliberate and easy to "fix" wrongly.
 *
 * **Prices are visible and stated.** GDD 9.3 is unusually blunt about it: "a purchase
 * without a number is not mysterious; it is merely accounting malpractice." So unlike
 * item pickup text, which R-ITM-005 keeps numberless, a shop price IS a number on
 * screen. Do not route it through the qualitative-phrasing rules.
 *
 * **There is no confirm step.** R-ECO-002 makes walking into the purchase zone with
 * enough credits complete the transaction, once. The `purchased` latch is what makes
 * "once" true while the player is still standing there; it is not a debounce hack.
 */

import { EVENTS } from '../core/events.js';
import { POOL, COLLECTIBLE_CLASS } from '../core/constants.js';
import { RNG_STREAMS } from '../core/rng.js';

/**
 * GDD 9.3's price bands, quoted. Inclusive credit ranges.
 *
 * `DISCOUNT` is not a band but a multiplier range applied to a band, which is why it
 * lives in its own constant rather than as a seventh row.
 */
export const PRICE_BAND = Object.freeze({
  BASIC_PICKUP: [3, 7],
  DESK_CHARM: [7, 12],
  STANDARD_ITEM: [12, 18],
  PREMIUM_ITEM: [20, 30],
  MACHINE_USE: [1, 5],
});

/** GDD 9.3: "Discount stock: 50-70 percent of normal." */
export const DISCOUNT_RANGE = Object.freeze([0.5, 0.7]);

/** GDD 9.4: "Base inventory is three sale slots plus one pickup slot." */
export const BASE_SALE_SLOTS = 3;
export const BASE_PICKUP_SLOTS = 1;

/** Pickup kinds a basic-pickup slot may stock (GDD 9.3, "Basic pickup" row). */
const BASIC_PICKUPS = Object.freeze(['COMPOSURE', 'ACCESS_CARD', 'TONER_CHARGE', 'CAFFEINE']);

/**
 * Which band an offer falls into.
 *
 * Quality drives it, not class, because GDD 9.3's "Premium item" row says
 * "high-quality or rare stock" — a quality-4 charm is premium even though charms have
 * their own band, and a quality-1 passive is not premium even though passives usually
 * sit in the standard band.
 */
function bandFor(def) {
  if (def.quality >= 4) return 'PREMIUM_ITEM';
  if (def.class === COLLECTIBLE_CLASS.DESK_CHARM) return 'DESK_CHARM';
  if (def.quality === 3) return 'PREMIUM_ITEM';
  return 'STANDARD_ITEM';
}

export class ShopService {
  /**
   * @param {object} deps
   * @param {import('../core/registry.js').Registry} deps.registry
   * @param {import('./loot.js').LootService} deps.loot
   * @param {import('../core/events.js').EventBus} deps.events
   */
  constructor({ registry, loot, events, getRun }) {
    this.registry = registry;
    this.loot = loot;
    this.events = events;
    this.getRun = getRun;
  }

  /**
   * Roll a shop's stock.
   *
   * Deterministic for a given (seed, node) pair: the RNG comes from the LOOT_ITEM
   * stream scoped by node id, so re-entering a shop shows the same stock and a replayed
   * seed shows the same shop (R-TEC-002).
   *
   * @param {object} args
   * @param {object} args.room the shop RoomInstance
   * @param {number} args.depth current floor depth
   * @param {number} [args.saleSlots] persistent upgrades may raise this (GDD 9.4)
   * @returns {Array<object>} stock entries, each with a price and a payload
   */
  stock({ room, depth, saleSlots = BASE_SALE_SLOTS, pickupSlots = BASE_PICKUP_SLOTS }) {
    // Same stream the loot service uses, keyed on the shop node, so pricing and pickup
    // choice replay with the seed and cannot shift a pedestal roll (GDD 20.4).
    const rng = this.getRun().rng.stream(RNG_STREAMS.LOOT_ITEM, 'shop', room.nodeId);
    const entries = [];
    const offered = new Set();

    for (let slot = 0; slot < saleSlots; slot += 1) {
      const rolled = this.loot.rollItem({
        poolId: POOL.OFFICE_SUPPLY_SHOP,
        depth,
        // Each slot gets its own source key so two slots cannot collapse onto the same
        // roll, and the key is stable so the roll survives leaving and returning.
        sourceTag: 'SHOP',
        sourceKey: `shop:${room.nodeId}:${slot}`,
        excludeIds: [...offered],
      });
      // A pool that ran dry is a content problem, not a runtime one: leaving the slot
      // empty is honest and the validator's pool-reachability check is where it gets
      // caught. Substituting a random item here would hide the defect.
      if (!rolled) continue;
      offered.add(rolled.id);
      entries.push(this.#priceEntry(rolled, rng));
    }

    for (let slot = 0; slot < pickupSlots; slot += 1) {
      const kind = rng.pick(BASIC_PICKUPS);
      entries.push({
        slot: entries.length,
        kind: 'PICKUP',
        pickupKind: kind,
        count: 1,
        price: this.#roll(rng, PRICE_BAND.BASIC_PICKUP),
        discounted: false,
        purchased: false,
      });
    }

    room.shopStock = entries;
    return entries;
  }

  /** Build one priced sale entry, applying the discount roll. */
  #priceEntry(rolled, rng) {
    const def = this.registry.get(rolled.kind ?? 'passive', rolled.id) ?? rolled;
    const band = bandFor(def);
    let price = this.#roll(rng, PRICE_BAND[band]);
    // GDD 9.3: discount stock is "clearly marked by sticker or damaged packaging", so
    // the flag is part of the entry and the renderer is obliged to show it.
    const discounted = rng.chance(0.15);
    if (discounted) {
      const [lo, hi] = DISCOUNT_RANGE;
      price = Math.max(1, Math.round(price * (lo + rng.next() * (hi - lo))));
    }
    return {
      slot: -1,
      kind: 'ITEM',
      itemId: def.id,
      itemKind: rolled.kind ?? 'passive',
      band,
      price,
      discounted,
      purchased: false,
    };
  }

  #roll(rng, [lo, hi]) {
    return lo + Math.floor(rng.next() * (hi - lo + 1));
  }

  /**
   * Attempt a purchase.
   *
   * R-ECO-002: no confirmation. This is called from the physics/pickup pass while the
   * player stands in the entry zone, so it must be idempotent for an already-bought
   * slot — hence the `purchased` latch rather than removing the entry, which would also
   * lose the "sold out" plinth the player needs to see.
   *
   * @returns {{ok: boolean, reason?: string, entry?: object}}
   */
  purchase({ player, entry, room }) {
    if (!entry || entry.purchased) return { ok: false, reason: 'ALREADY_PURCHASED' };

    // ITM-059 Corporate Card lets a purchase run into debt, which is why affordability
    // asks the player rather than comparing credits directly.
    if (!player.canAfford(entry.price)) {
      // Deliberately quiet. GDD 9.4 lets the player walk away without dialogs, and a
      // modal "insufficient credits" would be exactly the dialog it forbids.
      this.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-UI_DENIED' });
      return { ok: false, reason: 'CANNOT_AFFORD' };
    }

    const purchaseCtx = { player, entry, room, cost: entry.price, events: this.events };
    this.events?.emit(EVENTS.PURCHASE_MADE, purchaseCtx);

    player.spendCredits(entry.price);
    entry.purchased = true;

    if (entry.kind === 'PICKUP') {
      this.events?.emit(EVENTS.PICKUP_COLLECTED, { kind: entry.pickupKind, count: entry.count, player });
    } else {
      this.events?.emit(EVENTS.ITEM_COLLECTED, { id: entry.itemId, kind: entry.itemKind, player, fromShop: true });
    }
    this.events?.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-UI_PURCHASE' });
    return { ok: true, entry };
  }
}
