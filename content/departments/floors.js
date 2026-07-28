/**
 * FLOOR-* per-tier floor definitions. GDD 10.2, 11.3.
 *
 * Content kind: floor. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * GDD refs: 10.2 (two-floor chapter rule), 10.3 (base visible route order),
 *           11.3 (target room count per floor band), 11.7 (hidden rooms: one
 *           Maintenance Access per floor, Forgotten Cubicle probability rises),
 *           11.8 (room-size distribution per band), 12.4 (room role catalog),
 *           12.5 (required room rewards), 6.6 (difficulty multiplier is a floor
 *           property), R-FLR-003 (>=5 usable dead ends), R-LOOP-001 (Start,
 *           Supply Closet, Shop and Manager Office are guaranteed every floor),
 *           ROOM-005 (supply closet is free on Open Office I only),
 *           9.4 (shop door costs one Access Card after Open Office I).
 *
 * ---------------------------------------------------------------------------
 * Authoring notes
 * ---------------------------------------------------------------------------
 * `depth` is the ordered progression index that GDD 6.6 feeds into
 * `base_budget = 3.5 + (floor_depth * 1.35)`, so escalation between Floor I and
 * Floor II of a chapter is already paid for by depth. `difficulty` is the
 * separate 1.0/1.18 multiplier, so it stays `standard` for the whole base route
 * and is only spent on hidden floors and on the harder alternate variant —
 * doubling up would over-scale tier II of every chapter.
 *
 * Alternate chapters share the depth of the step they replace: Finance I and
 * Marketing I sit at depth 5 alongside Operations I, and Legal sits at depth 7
 * alongside Executive I. That keeps the budget curve identical whichever branch
 * the route picks (GDD 10.5).
 *
 * `optionalRooms` deliberately does not list ROOM-012 Maintenance Access or
 * ROOM-013 Forgotten Cubicle: those are hidden rooms with their own placement
 * rules and live in `secretRooms` (GDD 11.7). Everything else in the optional
 * band comes from the ROOM-008..ROOM-028 catalog in GDD 12.4, gated so the
 * risky and double-locked rooms only appear once the player has the resources
 * to consider them.
 */

import { ROOM_ROLE } from '../../src/core/constants.js';

/** R-LOOP-001: identical on every floor, including hidden ones. */
const GUARANTEED_ROLES = [
  ROOM_ROLE.START,          // ROOM-001 safe arrival + map origin
  ROOM_ROLE.SUPPLY_CLOSET,  // ROOM-005 one pedestal from the Supply Closet pool
  ROOM_ROLE.SHOP,           // ROOM-006 data-defined stock with visible prices
  ROOM_ROLE.MANAGER_OFFICE, // ROOM-007 boss arena + Manager Reward + floor exit
];

/** R-FLR-003: five usable dead ends before optional special-room assignment. */
const MIN_DEAD_ENDS = 5;

/**
 * Compact optional-room entry.
 *
 * @param {string} role ROOM_ROLE value
 * @param {number} chance 0..1 per-floor placement chance
 * @param {{deadEnd?: boolean, cost?: string, excl?: string[], minDepth?: number}} [o]
 */
const opt = (role, chance, o = {}) => ({
  role,
  chance,
  requiresDeadEnd: o.deadEnd ?? false,
  accessCost: o.cost ?? 'NONE',
  ...(o.excl ? { mutuallyExclusiveWith: o.excl } : {}),
  ...(o.minDepth ? { minDepth: o.minDepth } : {}),
});

const floors = [
  // =========================================================================
  // DPT-001 Open Office — base route depth 1-2 (GDD 11.3 floors 1 and 2)
  // =========================================================================
  {
    id: 'FLOOR-OPEN_OFFICE_1',
    schemaVersion: 1,
    department: 'DPT-001',
    tier: 1,
    depth: 1,
    nameLoc: 'floor.open_office_1.name',
    targetNodes: [10, 13],
    roomSizeDistribution: { single: 0.76, double: 0.17, large: 0.04, tiny: 0.03 },
    requiredRoles: [...GUARANTEED_ROLES],
    // Opening floor: only friendly optional rooms, no access cost anywhere, so
    // the player meets the special-room grammar before it starts charging.
    optionalRooms: [
      opt(ROOM_ROLE.BREAK_ROOM, 0.55),
      opt(ROOM_ROLE.DEADLINE, 0.28, { deadEnd: true }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.22, { deadEnd: true }),
      opt(ROOM_ROLE.REC_ROOM, 0.18, { deadEnd: true }),
      opt(ROOM_ROLE.WELLNESS, 0.10, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: ['OPEN_OFFICE_1_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS'],
    bossPool: 'OPEN_OFFICE_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'NONE', // ROOM-005: the only unlocked supply closet in the game
    shopDoorCost: 'NONE',     // GDD 9.4: free on Open Office I only
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.35 },
    hidden: false,
  },
  {
    id: 'FLOOR-OPEN_OFFICE_2',
    schemaVersion: 1,
    department: 'DPT-001',
    tier: 2,
    depth: 2,
    nameLoc: 'floor.open_office_2.name',
    targetNodes: [11, 15],
    roomSizeDistribution: { single: 0.76, double: 0.17, large: 0.04, tiny: 0.03 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.BREAK_ROOM, 0.50),
      opt(ROOM_ROLE.DEADLINE, 0.34, { deadEnd: true }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.22, { deadEnd: true }),
      opt(ROOM_ROLE.REC_ROOM, 0.20, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.16),
      opt(ROOM_ROLE.ARCHIVE, 0.14, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'OPEN_OFFICE_2_ENCOUNTERS', 'CROSS_DEPARTMENT_EARLY_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'OPEN_OFFICE_2_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.42 },
    hidden: false,
  },

  // =========================================================================
  // DPT-002 IT — base route depth 3-4
  // =========================================================================
  {
    id: 'FLOOR-IT_1',
    schemaVersion: 1,
    department: 'DPT-002',
    tier: 1,
    depth: 3,
    nameLoc: 'floor.it_1.name',
    targetNodes: [13, 17],
    roomSizeDistribution: { single: 0.68, double: 0.21, large: 0.07, tiny: 0.04 },
    requiredRoles: [...GUARANTEED_ROLES],
    // Depth 3 is where paid risk opens: health-cost rooms, the first locked
    // knowledge rooms, and the service elevator that reveals Facilities exists.
    optionalRooms: [
      opt(ROOM_ROLE.BREAK_ROOM, 0.45),
      opt(ROOM_ROLE.DEADLINE, 0.36, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.20),
      opt(ROOM_ROLE.NPC_OFFICE, 0.20, { deadEnd: true }),
      opt(ROOM_ROLE.ARCHIVE, 0.18, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.18, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.REC_ROOM, 0.18, { deadEnd: true }),
      opt(ROOM_ROLE.OVERTIME, 0.16, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.WELLNESS, 0.14, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.12, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.08, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.03, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'IT_1_ENCOUNTERS', 'CROSS_DEPARTMENT_EARLY_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'IT_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.48 },
    hidden: false,
  },
  {
    id: 'FLOOR-IT_2',
    schemaVersion: 1,
    department: 'DPT-002',
    tier: 2,
    depth: 4,
    nameLoc: 'floor.it_2.name',
    targetNodes: [13, 17],
    roomSizeDistribution: { single: 0.68, double: 0.21, large: 0.07, tiny: 0.04 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.BREAK_ROOM, 0.42),
      opt(ROOM_ROLE.DEADLINE, 0.38, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.22),
      opt(ROOM_ROLE.ARCHIVE, 0.20, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.20, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.18, { deadEnd: true }),
      opt(ROOM_ROLE.OVERTIME, 0.18, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.REC_ROOM, 0.16, { deadEnd: true }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.14, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.WELLNESS, 0.14, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.10, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.08, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.035, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'IT_2_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'IT_2_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.54 },
    hidden: false,
  },

  // =========================================================================
  // DPT-003 Operations — base route depth 5-6
  // =========================================================================
  {
    id: 'FLOOR-OPERATIONS_1',
    schemaVersion: 1,
    department: 'DPT-003',
    tier: 1,
    depth: 5,
    nameLoc: 'floor.operations_1.name',
    targetNodes: [15, 20],
    roomSizeDistribution: { single: 0.61, double: 0.24, large: 0.10, tiny: 0.05 },
    requiredRoles: [...GUARANTEED_ROLES],
    // ROOM-010 Crisis is "optional late" in GDD 12.4, so depth 5 is its floor.
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.40, { deadEnd: true }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.38),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.24),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.22, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.20, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.ARCHIVE, 0.18, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.18, { deadEnd: true }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.REC_ROOM, 0.16, { deadEnd: true }),
      opt(ROOM_ROLE.CRISIS, 0.14, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.WELLNESS, 0.14, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.10, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.10, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.06, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.035, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'OPERATIONS_1_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'OPERATIONS_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.60 },
    hidden: false,
  },
  {
    id: 'FLOOR-OPERATIONS_2',
    schemaVersion: 1,
    department: 'DPT-003',
    tier: 2,
    depth: 6,
    nameLoc: 'floor.operations_2.name',
    targetNodes: [15, 20],
    roomSizeDistribution: { single: 0.61, double: 0.24, large: 0.10, tiny: 0.05 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.42, { deadEnd: true }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.36),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.26),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.24, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.22, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.CRISIS, 0.18, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.ARCHIVE, 0.18, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.18, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.16, { deadEnd: true }),
      opt(ROOM_ROLE.REC_ROOM, 0.16, { deadEnd: true }),
      opt(ROOM_ROLE.WELLNESS, 0.14, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.12, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.10, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.07, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.035, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'OPERATIONS_2_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'OPERATIONS_2_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.66 },
    hidden: false,
  },

  // =========================================================================
  // DPT-004 Executive — base route depth 7-8 (Executive II ends the visible run)
  // =========================================================================
  {
    id: 'FLOOR-EXECUTIVE_1',
    schemaVersion: 1,
    department: 'DPT-004',
    tier: 1,
    depth: 7,
    nameLoc: 'floor.executive_1.name',
    targetNodes: [17, 23],
    roomSizeDistribution: { single: 0.55, double: 0.25, large: 0.14, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    // The double-locked premium rooms (Strategy, Executive Storage) exist only
    // here and on depth 8, where two Access Cards is a real but payable price.
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.42, { deadEnd: true }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.32),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.28),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.26, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.24, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.CRISIS, 0.22, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.18, { cost: 'HEALTH', minDepth: 7 }),
      opt(ROOM_ROLE.ARCHIVE, 0.16, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.14, { deadEnd: true }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.14, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.REC_ROOM, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.12, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.10, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.08, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.STRATEGY, 0.07, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.07, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.035, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'EXECUTIVE_1_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'EXECUTIVE_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.72 },
    hidden: false,
  },
  {
    id: 'FLOOR-EXECUTIVE_2',
    schemaVersion: 1,
    department: 'DPT-004',
    tier: 2,
    depth: 8,
    nameLoc: 'floor.executive_2.name',
    targetNodes: [17, 23],
    roomSizeDistribution: { single: 0.55, double: 0.25, large: 0.14, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.44, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.30),
      opt(ROOM_ROLE.BREAK_ROOM, 0.30),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.28, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.CRISIS, 0.26, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.OVERTIME, 0.26, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.22, { cost: 'HEALTH', minDepth: 7 }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.ARCHIVE, 0.16, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.14, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.14, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.10, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.REC_ROOM, 0.10, { deadEnd: true }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.10, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.STRATEGY, 0.09, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.08, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.04, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'EXECUTIVE_2_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'EXECUTIVE_2_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.78 },
    hidden: false,
  },

  // =========================================================================
  // DPT-005 Finance — alternate chapter 3, shares depth 5-6 with Operations
  // =========================================================================
  {
    id: 'FLOOR-FINANCE_1',
    schemaVersion: 1,
    department: 'DPT-005',
    tier: 1,
    depth: 5,
    nameLoc: 'floor.finance_1.name',
    targetNodes: [15, 20],
    roomSizeDistribution: { single: 0.61, double: 0.24, large: 0.10, tiny: 0.05 },
    requiredRoles: [...GUARANTEED_ROLES],
    // Finance biases towards paid and greed-risk rooms; a CREDITS access cost
    // exists nowhere else in the tower and is this branch's signature.
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.40, { deadEnd: true }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.30, { deadEnd: true, cost: 'CREDITS' }),
      opt(ROOM_ROLE.OVERTIME, 0.28, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.26),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.24),
      opt(ROOM_ROLE.ARCHIVE, 0.22, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.REC_ROOM, 0.22, { deadEnd: true, cost: 'CREDITS' }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.CRISIS, 0.14, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.14, { deadEnd: true }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.14, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.WELLNESS, 0.10, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.08, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.035, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'FINANCE_1_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'FINANCE_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.60 },
    hidden: false,
  },
  {
    id: 'FLOOR-FINANCE_2',
    schemaVersion: 1,
    department: 'DPT-005',
    tier: 2,
    depth: 6,
    nameLoc: 'floor.finance_2.name',
    targetNodes: [15, 20],
    roomSizeDistribution: { single: 0.61, double: 0.24, large: 0.10, tiny: 0.05 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.42, { deadEnd: true }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.32, { deadEnd: true, cost: 'CREDITS' }),
      opt(ROOM_ROLE.OVERTIME, 0.30, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.26),
      opt(ROOM_ROLE.BREAK_ROOM, 0.24),
      opt(ROOM_ROLE.REC_ROOM, 0.24, { deadEnd: true, cost: 'CREDITS' }),
      opt(ROOM_ROLE.ARCHIVE, 0.22, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.CRISIS, 0.18, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.18, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.14, { deadEnd: true }),
      opt(ROOM_ROLE.WELLNESS, 0.10, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.09, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.035, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'FINANCE_2_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'FINANCE_2_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.66 },
    hidden: false,
  },

  // =========================================================================
  // DPT-006 Marketing — alternate chapter 3, shares depth 5-6 with Operations
  // =========================================================================
  {
    id: 'FLOOR-MARKETING_1',
    schemaVersion: 1,
    department: 'DPT-006',
    tier: 1,
    depth: 5,
    nameLoc: 'floor.marketing_1.name',
    targetNodes: [15, 20],
    roomSizeDistribution: { single: 0.61, double: 0.24, large: 0.10, tiny: 0.05 },
    requiredRoles: [...GUARANTEED_ROLES],
    // Marketing leans on rooms that present a choice under misdirection, so
    // Rec Room and NPC Office are the most common optional rooms in the tower.
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.38, { deadEnd: true }),
      opt(ROOM_ROLE.REC_ROOM, 0.34, { deadEnd: true }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.30, { deadEnd: true }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.28),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.26),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.20, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.18, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.WELLNESS, 0.18, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.ARCHIVE, 0.16, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.CRISIS, 0.14, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.14, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.12, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.10, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.06, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.045, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'MARKETING_1_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'MARKETING_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.60 },
    hidden: false,
  },
  {
    id: 'FLOOR-MARKETING_2',
    schemaVersion: 1,
    department: 'DPT-006',
    tier: 2,
    depth: 6,
    nameLoc: 'floor.marketing_2.name',
    targetNodes: [15, 20],
    roomSizeDistribution: { single: 0.61, double: 0.24, large: 0.10, tiny: 0.05 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.DEADLINE, 0.40, { deadEnd: true }),
      opt(ROOM_ROLE.REC_ROOM, 0.36, { deadEnd: true }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.30, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.30),
      opt(ROOM_ROLE.BREAK_ROOM, 0.26),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.22, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.20, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.WELLNESS, 0.18, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.CRISIS, 0.18, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.ARCHIVE, 0.16, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.14, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.10, { deadEnd: true, cost: 'ONE_CARD', minDepth: 3 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.10),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.07, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.05, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'MARKETING_2_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'MARKETING_2_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.66 },
    hidden: false,
  },

  // =========================================================================
  // DPT-007 Legal and Compliance — alternate chapter 4 at depth 7
  //
  // GDD 10.5 says Legal "may replace Executive I while still leading to
  // Executive II and the CEO", and routeSchema alternates replace exactly one
  // step, so both Legal floors are authored at depth 7 as two variants of the
  // same step: FLOOR-LEGAL_1 is the standard swap, FLOOR-LEGAL_2 is the rarer
  // escalated variant and is the only non-hidden floor that spends the GDD 6.6
  // `hard` multiplier.
  // =========================================================================
  {
    id: 'FLOOR-LEGAL_1',
    schemaVersion: 1,
    department: 'DPT-007',
    tier: 1,
    depth: 7,
    nameLoc: 'floor.legal_1.name',
    targetNodes: [17, 23],
    roomSizeDistribution: { single: 0.55, double: 0.25, large: 0.14, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.ARCHIVE, 0.40, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.DEADLINE, 0.38, { deadEnd: true }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.34, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.28),
      opt(ROOM_ROLE.OVERTIME, 0.24, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.24),
      opt(ROOM_ROLE.CRISIS, 0.20, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.16, { cost: 'HEALTH', minDepth: 7 }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.14, { deadEnd: true }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.14, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.12, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.WELLNESS, 0.10, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.REC_ROOM, 0.10, { deadEnd: true }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.08, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.STRATEGY, 0.07, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.07, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.035, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'LEGAL_1_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'LEGAL_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.72 },
    hidden: false,
  },
  {
    id: 'FLOOR-LEGAL_2',
    schemaVersion: 1,
    department: 'DPT-007',
    tier: 2,
    depth: 7,
    nameLoc: 'floor.legal_2.name',
    targetNodes: [17, 23],
    roomSizeDistribution: { single: 0.55, double: 0.25, large: 0.14, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    // Escalated variant: more binding rooms, more premium locks, fewer soft
    // recovery rooms, and the `hard` encounter multiplier.
    optionalRooms: [
      opt(ROOM_ROLE.ARCHIVE, 0.44, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.40, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.DEADLINE, 0.40, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.32),
      opt(ROOM_ROLE.CRISIS, 0.28, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.OVERTIME, 0.26, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.20, { cost: 'HEALTH', minDepth: 7 }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.18),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 3 }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.16, { deadEnd: true, cost: 'BLAST', minDepth: 4 }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.14, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.12, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.STRATEGY, 0.10, { deadEnd: true, cost: 'TWO_CARDS', minDepth: 7 }),
      opt(ROOM_ROLE.WELLNESS, 0.10, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.08, { deadEnd: true, minDepth: 5 }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.04, { minDepth: 3 }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'LEGAL_2_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS', 'HR_ROVING_ENCOUNTERS',
    ],
    bossPool: 'LEGAL_2_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.76 },
    hidden: false,
  },

  // =========================================================================
  // DPT-008 Facilities — secret branch
  //
  // Depth 4 is the earliest point a maintenance route can realistically be
  // opened (the Service Elevator optional room appears from depth 3), so the
  // branch is budgeted as a depth-4 floor wherever it is entered from. It is
  // deliberately short and corridor-heavy rather than wide.
  // =========================================================================
  {
    id: 'FLOOR-FACILITIES_1',
    schemaVersion: 1,
    department: 'DPT-008',
    tier: 1,
    depth: 4,
    nameLoc: 'floor.facilities_1.name',
    targetNodes: [8, 12],
    // Definition-specific per GDD 11.8 "Hidden": service space is almost all
    // corridor, with closets instead of large rooms.
    roomSizeDistribution: { single: 0.40, double: 0.44, large: 0.06, tiny: 0.10 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.85, { cost: 'BLAST' }),
      opt(ROOM_ROLE.OVERTIME, 0.30, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.28, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.24, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.OVERTIME],
      }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.22, { deadEnd: true }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.20),
      opt(ROOM_ROLE.WELLNESS, 0.18, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.DEADLINE, 0.18, { deadEnd: true }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.18),
      opt(ROOM_ROLE.ARCHIVE, 0.14, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.09),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: ['FACILITIES_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS'],
    bossPool: 'FACILITIES_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.85 },
    hidden: true,
  },

  // =========================================================================
  // DPT-009 Research and Development — secret branch
  //
  // Budgeted at depth 6: reaching it requires an established run, and it is the
  // primary home of the Innovation Lab pool (GDD Appendix A, DPT-009).
  // =========================================================================
  {
    id: 'FLOOR-RND_1',
    schemaVersion: 1,
    department: 'DPT-009',
    tier: 1,
    depth: 6,
    nameLoc: 'floor.rnd_1.name',
    targetNodes: [7, 11],
    // Definition-specific: discrete test chambers, so unusually few connectors
    // and an unusually high share of large single-purpose rooms.
    roomSizeDistribution: { single: 0.58, double: 0.18, large: 0.16, tiny: 0.08 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.INNOVATION_LAB, 0.80, { cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.STRATEGY, 0.24, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.24, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.22),
      opt(ROOM_ROLE.OVERTIME, 0.20, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.REC_ROOM, 0.20, { deadEnd: true }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.20, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.NPC_OFFICE, 0.18, { deadEnd: true }),
      opt(ROOM_ROLE.CRISIS, 0.16, { deadEnd: true, cost: 'ONE_CARD', minDepth: 5 }),
      opt(ROOM_ROLE.BREAK_ROOM, 0.16),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.14, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true, excl: [ROOM_ROLE.BREAK_ROOM] }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.12),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: ['RND_ENCOUNTERS', 'CROSS_DEPARTMENT_MID_ENCOUNTERS'],
    bossPool: 'RND_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.80 },
    hidden: true,
  },

  // =========================================================================
  // DPT-010 The Board — hidden post-CEO chapter, depth 9-10
  // =========================================================================
  {
    id: 'FLOOR-BOARD_1',
    schemaVersion: 1,
    department: 'DPT-010',
    tier: 1,
    depth: 9,
    nameLoc: 'floor.board_1.name',
    targetNodes: [17, 22],
    // Definition-specific: chamber architecture, so large rooms outnumber
    // everything the base route ever offered.
    roomSizeDistribution: { single: 0.48, double: 0.26, large: 0.20, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.CRISIS, 0.44, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.DEADLINE, 0.40, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.34),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.30, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.26, { cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.24, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.20, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.18, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.STRATEGY, 0.16, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.16, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.ARCHIVE, 0.14, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.10, { deadEnd: true }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.06),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: ['BOARD_1_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS'],
    bossPool: 'BOARD_1_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.82 },
    hidden: true,
  },
  {
    id: 'FLOOR-BOARD_2',
    schemaVersion: 1,
    department: 'DPT-010',
    tier: 2,
    depth: 10,
    nameLoc: 'floor.board_2.name',
    targetNodes: [18, 24],
    roomSizeDistribution: { single: 0.44, double: 0.26, large: 0.24, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.CRISIS, 0.50, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.DEADLINE, 0.42, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.36),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.32, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.28, { cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.26, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.24, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.STRATEGY, 0.20, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.18, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.18, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.ARCHIVE, 0.14, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.06),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: ['BOARD_2_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS'],
    bossPool: 'BOARD_2_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.86 },
    hidden: true,
  },

  // =========================================================================
  // DPT-011 Parent Company — deep hidden chapter, depth 11
  // =========================================================================
  {
    id: 'FLOOR-PARENT_COMPANY_1',
    schemaVersion: 1,
    department: 'DPT-011',
    tier: 1,
    depth: 11,
    nameLoc: 'floor.parent_company_1.name',
    targetNodes: [16, 21],
    // Definition-specific: group-standard fit-out, so the mix is deliberately
    // bland and even — the architecture stops telling the player where they are.
    roomSizeDistribution: { single: 0.52, double: 0.28, large: 0.14, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.CRISIS, 0.46, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.DEADLINE, 0.40, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.36),
      opt(ROOM_ROLE.ARCHIVE, 0.30, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.30, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.24, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.22, { cost: 'HEALTH' }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.22, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.20, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.STRATEGY, 0.18, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.18, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.16, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.14, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.10, { deadEnd: true }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.08),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'PARENT_COMPANY_ENCOUNTERS', 'ECHO_VARIANT_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS',
    ],
    bossPool: 'PARENT_COMPANY_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.90 },
    hidden: true,
  },

  // =========================================================================
  // DPT-012 The Conglomerate — ultra hidden chapter, depth 12
  // =========================================================================
  {
    id: 'FLOOR-CONGLOMERATE_1',
    schemaVersion: 1,
    department: 'DPT-012',
    tier: 1,
    depth: 12,
    nameLoc: 'floor.conglomerate_1.name',
    targetNodes: [18, 24],
    // Definition-specific: two estates occupying the same coordinates, so
    // oversized merged rooms dominate and single cells are the minority.
    roomSizeDistribution: { single: 0.40, double: 0.28, large: 0.26, tiny: 0.06 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.CRISIS, 0.55, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.DEADLINE, 0.42, { deadEnd: true }),
      opt(ROOM_ROLE.UNSCHEDULED_REVIEW, 0.38),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.32, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.SERVICE_ELEVATOR, 0.30, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.EXECUTIVE_DEAL, 0.26, { cost: 'HEALTH' }),
      opt(ROOM_ROLE.OVERTIME, 0.26, {
        deadEnd: true, cost: 'HEALTH', excl: [ROOM_ROLE.RESTRICTED_RECORDS],
      }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.24, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.STRATEGY, 0.22, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.SHADOW_PROCUREMENT, 0.20, { deadEnd: true, cost: 'BLAST' }),
      opt(ROOM_ROLE.INNOVATION_LAB, 0.18, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.ARCHIVE, 0.18, { deadEnd: true, cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.16, { excl: [ROOM_ROLE.EXECUTIVE_DEAL] }),
      opt(ROOM_ROLE.WELLNESS, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.QUARTER_END_CRUNCH, 0.12, { deadEnd: true }),
      opt(ROOM_ROLE.THIRTEENTH_FLOOR, 0.12),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: [
      'CONGLOMERATE_ENCOUNTERS', 'ECHO_VARIANT_ENCOUNTERS', 'CROSS_DEPARTMENT_LATE_ENCOUNTERS',
    ],
    bossPool: 'CONGLOMERATE_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.94 },
    hidden: true,
  },

  // =========================================================================
  // DPT-013 Ownership — terminal hidden arena, depth 13
  //
  // The only floor in the game with no secret rooms: GDD 11.7 says Maintenance
  // Access is "normally" once per floor, and a service closet would contradict
  // a space that visibly contains no work. The §16.5 secret-room-per-chapter
  // condition is evaluated before the Ownership elevator appears, so nothing
  // depends on secrets here.
  // =========================================================================
  {
    id: 'FLOOR-OWNERSHIP_1',
    schemaVersion: 1,
    department: 'DPT-013',
    tier: 1,
    depth: 13,
    nameLoc: 'floor.ownership_1.name',
    targetNodes: [5, 8],
    // Definition-specific: an approach and an arena, nothing else. Large rooms
    // are the majority because the floor is essentially two enormous voids.
    roomSizeDistribution: { single: 0.30, double: 0.20, large: 0.46, tiny: 0.04 },
    requiredRoles: [...GUARANTEED_ROLES],
    optionalRooms: [
      opt(ROOM_ROLE.CRISIS, 0.35, { cost: 'ONE_CARD' }),
      opt(ROOM_ROLE.WELLNESS, 0.30, { deadEnd: true }),
      opt(ROOM_ROLE.RESTRICTED_RECORDS, 0.20, { deadEnd: true, cost: 'HEALTH' }),
      opt(ROOM_ROLE.EXECUTIVE_STORAGE, 0.18, { deadEnd: true, cost: 'TWO_CARDS' }),
      opt(ROOM_ROLE.UNION_BREAKROOM, 0.16),
      opt(ROOM_ROLE.STRATEGY, 0.14, { deadEnd: true, cost: 'TWO_CARDS' }),
    ],
    minDeadEnds: MIN_DEAD_ENDS,
    encounterPools: ['OWNERSHIP_ENCOUNTERS', 'ECHO_VARIANT_ENCOUNTERS'],
    bossPool: 'OWNERSHIP_BOSSES',
    difficulty: 'hard',
    supplyClosetCost: 'ONE_CARD',
    shopDoorCost: 'ONE_CARD',
    secretRooms: { maintenanceAccess: 0.0, forgottenCubicle: 0.0 },
    hidden: true,
  },
];

export default floors;
