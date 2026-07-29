/**
 * Active items ACT-001..015. Appendix C.3.
 *
 * GDD refs: Appendix C.3 (recharge, pickup phrase, and effect for all fifteen),
 *           6.5 (most actives recharge by clearing hostile rooms), 9.4 (one active
 *           slot; picking up a second offers a swap), R-CON-001 (the charge state is
 *           always visible), R-BSS-004 (no single consumable trivialises a boss),
 *           8.3 (quality bands).
 *
 * Recharge mode is the balance lever, not damage. Desk Bell recharges every two rooms
 * and does almost nothing; Ctrl+Z recharges every twelve and undoes a mistake. The
 * effects live in src/systems/hooks/active-hooks.js and the params here are the only
 * place their magnitudes are stated.
 */

import { COLLECTIBLE_CLASS, POOL } from '../../src/core/constants.js';

const A = COLLECTIBLE_CLASS.ACTIVE;

const active = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `active.${slug}.name`,
  pickupPhraseLoc: `active.${slug}.phrase`,
  class: A,
  spriteId: `active_${slug}`,
  quality: spec.q,
  baseWeight: spec.w,
  minFloor: spec.floor ?? 1,
  pools: spec.pools,
  repeatable: false,
  tags: spec.tags,
  recharge: spec.recharge,
  effectHook: spec.hook,
  ...(spec.params ? { params: spec.params } : {}),
  originalityNote: spec.original,
});

/** Rooms-cleared recharge, the default in GDD 6.5. */
const rooms = (n, note) => ({ mode: 'ROOMS', rooms: n, ...(note ? { note } : {}) });

const SUPPLY = [POOL.SUPPLY_CLOSET];
const SUPPLY_SHOP = [POOL.SUPPLY_CLOSET, POOL.OFFICE_SUPPLY_SHOP];
const SUPPLY_LAB = [POOL.SUPPLY_CLOSET, POOL.INNOVATION_LAB];

const actives = [
  active('ACT-001', 'task_manager', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['TECHNOLOGY'],
    recharge: rooms(6),
    hook: 'EXECUTE_LOW_HEALTH_ENEMIES',
    // C.3: below 25 percent for normals, a FIXED burst for bosses and elites. The
    // asymmetry is the requirement, not a tuning choice.
    params: { threshold: 0.25, bossBurst: 24 },
    original: 'Ending the process as an execute; the fixed boss burst keeps it from being a boss skip.',
  }),
  active('ACT-002', 'print_screen', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'DEFENSE'],
    recharge: rooms(6),
    hook: 'FREEZE_HOSTILES',
    params: { seconds: 3 },
    original: 'A screenshot as a freeze frame: the danger stays visible while it stops moving.',
  }),
  active('ACT-003', 'ctrl_z', {
    q: 4, w: 0.15, floor: 3, pools: [POOL.SUPPLY_CLOSET, POOL.SECRET_MAINTENANCE], tags: ['TECHNOLOGY'],
    recharge: rooms(12, 'The longest recharge in the set: undoing a room is the strongest thing an active does.'),
    hook: 'REWIND_ROOM',
    original: 'Undo as a room rewind, deliberately excluding pickups so it cannot duplicate resources.',
  }),
  active('ACT-004', 'out_of_office', {
    q: 3, w: 0.65, pools: SUPPLY, tags: ['DEFENSE', 'ACCESS'],
    recharge: rooms(6),
    hook: 'INVULNERABLE_PHASE_THROUGH',
    params: { seconds: 5 },
    original: 'An out-of-office reply as temporary non-existence; boss contact still stops you.',
  }),
  active('ACT-005', 'emergency_coffee_pot', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['COFFEE'],
    recharge: rooms(4),
    hook: 'ROOM_HASTE_BURST',
    params: { magnitude: 0.4 },
    original: 'A fresh pot as a room-long surge, scoped to the room rather than a timer.',
  }),
  active('ACT-006', 'meeting_invite', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['MANAGEMENT'],
    recharge: rooms(4),
    hook: 'PULL_TO_CENTER',
    params: { strength: 9, rootSeconds: 1.2 },
    original: 'A calendar invite as a forced gather; turrets and bosses decline to attend.',
  }),
  active('ACT-007', 'power_cycle', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['TECHNOLOGY'],
    recharge: rooms(8),
    hook: 'RESET_AI_AND_HAZARDS',
    params: { seconds: 5 },
    original: 'Turning it off and on again as an AI and hazard reset, time-boxed so the room stays dangerous.',
  }),
  active('ACT-008', 'shredder_bin', {
    q: 3, w: 0.65, pools: SUPPLY, tags: ['PAPER', 'ECONOMY'],
    // The only fed-item active in the set. It never recharges on rooms, which is why
    // it can afford permanent rewards (C.3).
    recharge: { mode: 'FED_ITEMS', note: 'Offer a pickup or pedestal item to it directly.' },
    hook: 'CONSUME_FED_ITEM',
    params: {
      byCategory: {
        COMPOSURE: { permanent: 'damageMul', magnitude: 0.04 },
        CAFFEINE: { stat: 'moveSpeedAdd', magnitude: 0.5, seconds: 30 },
        CREDIT: { pickup: 'TONER_CHARGE', count: 1 },
        ACCESS_CARD: { pickup: 'CREDIT', count: 6 },
        PASSIVE: { permanent: 'damageMul', magnitude: 0.1 },
        DEFAULT: { pickup: 'CREDIT', count: 3 },
      },
    },
    original: 'A shredder that pays you for what you feed it, with the reward looked up by category from data.',
  }),
  active('ACT-009', 'fire_extinguisher', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['DEFENSE'],
    recharge: rooms(3),
    hook: 'FORCE_CONE_CLEANSE',
    params: { range: 5.5, coneAngle: 1.1, knockback: 14 },
    original: 'An extinguisher as a shoving cone that also puts fires out and erases light fire.',
  }),
  active('ACT-010', 'red_phone', {
    q: 3, w: 0.65, pools: [POOL.SUPPLY_CLOSET, POOL.EXECUTIVE_DEAL], tags: ['MANAGEMENT'],
    recharge: rooms(8),
    hook: 'STRIKE_PRIORITY_TARGET',
    params: { amount: 30 },
    original: 'Escalating to the top as a single heavy strike on whoever the room considers important.',
  }),
  active('ACT-011', 'expense_report', {
    q: 2, w: 1.0, pools: SUPPLY_SHOP, tags: ['ECONOMY'],
    recharge: { mode: 'CREDITS', creditsMax: 10, note: 'Spend up to ten credits per use.' },
    hook: 'SPEND_CREDITS_FOR_DAMAGE',
    params: { maxCredits: 10, perCredit: 0.05 },
    original: 'Converting budget directly into damage, proportional to what you actually spend.',
  }),
  active('ACT-012', 'copier_jam', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['PAPER', 'DEFENSE'],
    recharge: rooms(5),
    hook: 'SPAWN_COVER_OBJECTS',
    params: { count: 3, radius: 3, health: 12, objectId: 'ENV-021' },
    original: 'A jam as portable cover; placement asks the room so it cannot block a required door.',
  }),
  active('ACT-013', 'floor_plan', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['INFORMATION'],
    recharge: rooms(6),
    hook: 'REVEAL_FLOOR_MAP',
    original: 'A floor plan as full map reveal, with secret rooms excluded so discovery survives.',
  }),
  active('ACT-014', 'performance_improvement_plan', {
    q: 3, w: 0.65, pools: [POOL.SUPPLY_CLOSET, POOL.RESTRICTED_RECORDS], tags: ['MANAGEMENT', 'TRADEOFF'],
    recharge: rooms(8),
    hook: 'MARK_ALL_FOR_REWARD',
    params: { damageBonus: 0.15, hasteMagnitude: 0.2 },
    original: 'A PIP that makes the room harder in exchange for a certain reward: pressure as a resource.',
  }),
  active('ACT-015', 'desk_bell', {
    q: 1, w: 1.0, pools: SUPPLY, tags: ['MANAGEMENT'],
    // The shortest recharge in the set, because it is the smallest effect (GDD 6.5).
    recharge: rooms(2),
    hook: 'TAUNT_AND_PUNISH_APPROACH',
    params: { seconds: 3, bonus: 0.3 },
    original: 'A service bell as a taunt that only pays off against enemies actually coming at you.',
  }),
];

export default actives;
