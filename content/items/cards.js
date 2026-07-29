/**
 * Action Cards CARD-001..018. Appendix C.4.
 *
 * GDD refs: Appendix C.4 (the effect table), 9.5 (the pocket slot holds one card OR
 *           one Supplement), 9.6 (the starter set; CARD-015 cannot be used in boss
 *           rooms), R-CON-002 (a card's identity and effect are visible on discovery,
 *           which is the whole difference between a card and a Supplement).
 *
 * Cards have no `quality` or `pools` field: they are not rolled from item pools, they
 * drop into the pocket slot from clears, objects, and rewards. `baseWeight` is their
 * relative frequency inside those tables, and `minFloor` gates the strong ones.
 *
 * `usageRestrictions` is the interesting column. Most cards are empty arrays, and each
 * non-empty one exists for a stated reason: Escalation would stack a mini-boss on a
 * boss, Meeting Canceled from the start room does nothing, Reorganization in a shop
 * would let you reroll stock you already priced.
 */

import { COLLECTIBLE_CLASS } from '../../src/core/constants.js';

const C = COLLECTIBLE_CLASS.ACTION_CARD;

const card = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `card.${slug}.name`,
  descriptionLoc: `card.${slug}.description`,
  class: C,
  spriteId: `card_${slug}`,
  baseWeight: spec.w,
  minFloor: spec.floor ?? 1,
  effectHook: spec.hook,
  ...(spec.params ? { params: spec.params } : {}),
  usageRestrictions: spec.restrict ?? [],
  originalityNote: spec.original,
});

const cards = [
  card('CARD-001', 'meeting_canceled', {
    w: 1.0, hook: 'RETURN_TO_START_ROOM',
    // Using it in the start room would be a wasted card with no feedback, so the
    // restriction is a usability guard as much as a rule.
    restrict: ['NOT_IN_START_ROOM'],
    original: 'A cancelled meeting as an escape back to the start room.',
  }),
  card('CARD-002', 'company_wide_email', {
    w: 1.0, hook: 'DAMAGE_ALL_HOSTILES', params: { amount: 18 },
    original: 'A mass email as room-wide damage; the flat amount is what keeps it fair against a boss.',
  }),
  card('CARD-003', 'sick_day', {
    w: 0.8, hook: 'FULL_HEAL_AND_GRACE', params: { graceSeconds: 2 },
    original: 'A sick day as a full refill of what you already have, plus a moment to move.',
  }),
  card('CARD-004', 'approved_overtime', {
    w: 1.0, hook: 'ROOM_DAMAGE_AND_CADENCE', params: { damageMul: 1.35, intervalMul: 0.8 },
    original: 'Approved overtime as a room-long output increase.',
  }),
  card('CARD-005', 'expense_approved', {
    w: 1.0, hook: 'SPAWN_CREDIT_BURST', params: { range: [8, 16] },
    original: 'An approved expense as a credit burst, weighted rather than fixed.',
  }),
  card('CARD-006', 'budget_freeze', {
    w: 1.0, hook: 'SLOW_ROOM', params: { magnitude: 0.45 },
    original: 'A budget freeze as a room-wide slow that also covers later waves.',
  }),
  card('CARD-007', 'reorganization', {
    w: 0.8, hook: 'REROLL_ROOM_OFFERS',
    // A shop reroll would let a player re-price stock they had already seen, which is
    // a different (and much stronger) card than the one C.4 describes.
    restrict: ['NOT_IN_SHOP'],
    original: 'A reorg as a reroll of everything this room is still offering, from the original pools.',
  }),
  card('CARD-008', 'calendar_block', {
    w: 0.8, hook: 'TIMED_INVULNERABILITY', params: { seconds: 8 },
    original: 'Blocked time as eight seconds of untouchability that still cannot open a door.',
  }),
  card('CARD-009', 'access_granted', {
    w: 1.0, hook: 'OPEN_ADJACENT_LOCKS',
    original: 'Access granted as a local unlock of standard card doors only.',
  }),
  card('CARD-010', 'all_hands', {
    w: 0.8, floor: 2, hook: 'CHARM_NORMALS_SLOW_BOSSES', params: { seconds: 5 },
    original: 'An all-hands as brief charm on normals, downgraded to a slow on bosses.',
  }),
  card('CARD-011', 'performance_review', {
    w: 1.0, hook: 'REVEAL_BOSS_AND_MINIBOSSES',
    original: 'A performance review as a reveal of every fight that matters on the floor.',
  }),
  card('CARD-012', 'remote_day', {
    w: 1.0, hook: 'GRANT_FLIGHT',
    original: 'A remote day as flight over hazards and furniture for one room.',
  }),
  card('CARD-013', 'hard_deadline', {
    w: 0.8, hook: 'REVEAL_BOSS_ROUTE_AND_HASTE', params: { magnitude: 0.3 },
    original: 'A hard deadline as a highlighted route plus speed that lasts exactly until you arrive.',
  }),
  card('CARD-014', 'return_to_sender', {
    w: 0.8, hook: 'REFLECT_PROJECTILES', params: { seconds: 3 },
    original: 'Return to sender as three seconds of reflection.',
  }),
  card('CARD-015', 'escalation', {
    w: 0.5, floor: 2, hook: 'SPAWN_OPTIONAL_MINIBOSS',
    params: { pool: 'MINIBOSS_STANDARD', reward: 'PREMIUM' },
    // GDD 9.6 makes this normative, not advisory. Two headline fights at once is not a
    // harder version of the room, it is an unreadable one.
    restrict: ['NOT_IN_BOSS_ROOM'],
    original: 'Escalation as an optional extra fight you choose to start for a real reward.',
  }),
  card('CARD-016', 'meeting_minutes', {
    w: 0.5, floor: 2, hook: 'REPEAT_LAST_CARD',
    original: 'Minutes as a repeat of the last card, excluding itself so it cannot loop.',
  }),
  card('CARD-017', 'desk_move', {
    w: 1.0, hook: 'TELEPORT_TO_CLEARED_ROOM',
    restrict: ['REQUIRES_CLEARED_ROOM'],
    original: 'A desk move as a teleport limited to rooms you already finished.',
  }),
  card('CARD-018', 'quarter_end', {
    w: 0.5, floor: 3, hook: 'START_WAVE_CHALLENGE',
    params: { waves: 3, seconds: 90, reward: 'PREMIUM' },
    // A boss room is already a wave challenge with a premium reward.
    restrict: ['NOT_IN_BOSS_ROOM', 'NOT_IN_START_ROOM'],
    original: 'Quarter-end as an opt-in timed wave challenge in an ordinary room.',
  }),
];

export default cards;
