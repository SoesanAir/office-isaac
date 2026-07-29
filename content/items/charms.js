/**
 * Desk Charms CHR-001..018. Appendix C.6.
 *
 * GDD refs: Appendix C.6 (the effect table; the twelve-percent retain and the
 *           twentieth-attack shot are quoted), 9.8 (one dedicated charm slot, swapped
 *           on the floor; charms are "usually weaker, narrower, or less reliable than
 *           full passive items"), R-ECO-005 (starvation protection stays subtle),
 *           8.3 (quality bands).
 *
 * Every charm here is quality 1 or 2. That is not caution — GDD 9.8 defines the class
 * as narrower than a passive, so a charm that competed with a quality-3 item would be
 * in the wrong class. The two most valuable ones (Meeting Token, Lucky Lanyard) buy
 * their strength with a condition rather than with a bigger number.
 *
 * Most charms reuse hooks the game already has. That is the design working: CHR-004 is
 * DAMAGE_VS_STATUS and CHR-010 is EXTRA_SHOT_EVERY_N, both shared, both parameterised.
 */

import { COLLECTIBLE_CLASS, POOL, STATUS } from '../../src/core/constants.js';

const H = COLLECTIBLE_CLASS.DESK_CHARM;

const charm = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `charm.${slug}.name`,
  descriptionLoc: `charm.${slug}.description`,
  class: H,
  spriteId: `charm_${slug}`,
  quality: spec.q ?? 1,
  baseWeight: spec.w ?? 1.0,
  minFloor: spec.floor ?? 1,
  pools: spec.pools ?? [POOL.SUPPLY_CLOSET, POOL.OFFICE_SUPPLY_SHOP],
  repeatable: false,
  tags: spec.tags,
  effects: spec.effects,
  originalityNote: spec.original,
});

const SHOP = [POOL.SUPPLY_CLOSET, POOL.OFFICE_SUPPLY_SHOP];
const SECRET = [POOL.SUPPLY_CLOSET, POOL.SECRET_MAINTENANCE];

const charms = [
  charm('CHR-001', 'coffee_sleeve', {
    tags: ['COFFEE', 'SUSTAIN'],
    effects: [{ hook: 'PICKUP_BONUS_CHANCE', params: { kind: 'CAFFEINE', chance: 0.2, bonusHalfUnits: 1 } }],
    original: 'A cardboard sleeve that occasionally means a slightly bigger coffee.',
  }),
  charm('CHR-002', 'bent_keycard', {
    tags: ['ACCESS'],
    // C.6 states twelve percent exactly. Reuses the shared hook the passives already
    // use rather than defining a charm-specific one.
    effects: [{ hook: 'RETAIN_SPENT_CARD', params: { chance: 0.12 } }],
    original: 'A bent card that sometimes does not get eaten by the reader.',
  }),
  charm('CHR-003', 'usb_cap', {
    tags: ['TECHNOLOGY'],
    effects: [{ hook: 'PICKUP_OVERFLOW_CHARGE', params: { max: 1 } }],
    original: 'A lost port cap that keeps one overflow charge until you need it.',
  }),
  charm('CHR-004', 'red_pushpin', {
    tags: ['STATIONERY'],
    effects: [{ hook: 'DAMAGE_VS_STATUS', params: { status: STATUS.MARKED, bonus: 0.1 } }],
    original: 'A pushpin that makes marked targets slightly worse off.',
  }),
  charm('CHR-005', 'tiny_plant', {
    tags: ['SUSTAIN'],
    effects: [{ hook: 'FIRST_PICKUP_BONUS_PER_FLOOR', params: { kind: 'COMPOSURE', bonusHalfUnits: 1 } }],
    original: 'A desk succulent that makes the first health of a floor go slightly further.',
  }),
  charm('CHR-006', 'meeting_token', {
    q: 2, w: 0.7, floor: 2, tags: ['MANAGEMENT', 'INFORMATION'],
    effects: [{ hook: 'BIAS_ROOM_ROLE', params: { role: 'ROOM-013', multiplier: 1.35, rewardMultiplier: 1.15 } }],
    original: 'A meeting token that makes optional fights more common and better paid.',
  }),
  charm('CHR-007', 'rubber_foot', {
    tags: ['DEFENSE'],
    effects: [{ hook: 'REDUCE_SLIDING', params: { mul: 0.6 } }],
    original: 'A chair foot that keeps you where you put yourself on a wet floor.',
  }),
  charm('CHR-008', 'cracked_screen_protector', {
    q: 2, w: 0.8, tags: ['TECHNOLOGY', 'DEFENSE'],
    effects: [{ hook: 'SHIELD_FIRST_HIT_IN_BOSS_ROOM', params: { halfUnits: 1 } }],
    original: 'Already-cracked glass that takes one projectile hit per boss, then gives up until next floor.',
  }),
  charm('CHR-009', 'frayed_cable', {
    tags: ['TECHNOLOGY'],
    effects: [{ hook: 'RESHAPE_CHAIN', params: { radiusMul: 1.4, damageMul: 0.85 } }],
    original: 'A damaged cable that spreads current further for less: a reshape, not an upgrade.',
  }),
  charm('CHR-010', 'spare_button', {
    tags: ['STATIONERY'],
    // C.6 says every twentieth attack event. Twenty is a long wait, which is exactly
    // what makes it a charm and not a passive.
    effects: [{ hook: 'EXTRA_SHOT_EVERY_N', params: { every: 20, damageScale: 0.5 } }],
    original: 'The spare button sewn inside a shirt: one extra shot, very occasionally.',
  }),
  charm('CHR-011', 'mini_calendar', {
    tags: ['INFORMATION'], pools: SHOP,
    effects: [{ hook: 'REVEAL_ROLE_AFTER_DISCOVERY', params: { afterRole: 'ROOM-004', revealRole: 'ROOM-011' } }],
    original: 'A pocket calendar that shows challenge doors, but only once you have found the closet.',
  }),
  charm('CHR-012', 'nameplate', {
    q: 2, w: 0.8, tags: ['ECONOMY'], pools: SHOP,
    effects: [{ hook: 'SHOP_DISCOUNT_CHANCE', params: { chance: 0.25, mul: 0.7 } }],
    original: 'A desk nameplate that sometimes gets you a better first price. Rolled once per shop.',
  }),
  charm('CHR-013', 'transit_pass', {
    tags: ['ACCESS'],
    effects: [{ hook: 'FLOOR_START_HASTE', params: { seconds: 4, magnitude: 0.3 } }],
    original: 'A transit pass that carries momentum out of the elevator.',
  }),
  charm('CHR-014', 'employee_of_the_month_pin', {
    q: 2, w: 0.7, floor: 2, tags: ['ECONOMY'],
    effects: [{ hook: 'BOSS_BONUS_CREDITS_IF_UNHURT', params: { credits: 5 } }],
    original: 'A recognition pin that pays out only for a boss fought without taking a hit.',
  }),
  charm('CHR-015', 'paper_star', {
    tags: ['PAPER'],
    effects: [{ hook: 'CLEAR_REWARD_QUALITY_BIAS', params: { kinds: ['RARE'], multiplier: 1.3 } }],
    original: 'A folded paper star that nudges clear rewards toward the rare band.',
  }),
  charm('CHR-016', 'old_password', {
    tags: ['INFORMATION', 'ACCESS'], pools: SECRET,
    effects: [{ hook: 'LOOSEN_BLAST_TOLERANCE', params: { mul: 1.5 } }],
    original: 'A password on a sticky note: it forgives imprecise blast placement without revealing anything.',
  }),
  charm('CHR-017', 'snack_wrapper', {
    tags: ['ECONOMY'],
    effects: [{ hook: 'MACHINE_PAYOUT_BIAS', params: { failMul: 0.6 } }],
    original: 'A kept wrapper that makes the vending machine break slightly later.',
  }),
  charm('CHR-018', 'lucky_lanyard', {
    q: 2, w: 0.6, tags: ['ACCESS'],
    // Starvation protection. R-ECO-005 requires it to be subtle and silent, so the pity
    // hook spawns an ordinary card with no message, and NOTE_PICKUP_SEEN keeps the
    // counter honest when a card drops normally.
    effects: [
      { hook: 'PITY_ACCESS_CARD', params: { clears: 4 } },
      { hook: 'NOTE_PICKUP_SEEN', params: { kind: 'ACCESS_CARD' } },
    ],
    original: 'A lanyard that quietly guarantees a card on a floor that refused to give one.',
  }),
];

export default charms;
