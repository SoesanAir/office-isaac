/**
 * World, viewport, and simulation constants.
 *
 * GDD refs: 4.3 (Camera), 18.2 (Technical art assumptions), 20.7 (Performance
 *           targets), 11.2 (Logical entities), 5.1 (Starting profile units).
 *
 * The unit system is deliberately explicit because the GDD quotes player stats
 * in "world units per second" (move speed 5.5, projectile speed 9.0). One world
 * unit is one 32-pixel sprite reference cell, so a value of 5.5 wu/s is 176
 * logical pixels per second.
 */

/** Pixels per world unit. Matches the 32px sprite reference grid (GDD 18.2). */
export const TILE = 32;

/** Logical render resolution. 16:9, integer-scales cleanly to 1920x1080 (x2). */
export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 540;

/**
 * One logical grid cell of a floor graph, in world units, measured as the
 * playable interior. A single-cell room is CELL_W x CELL_H of floor space.
 * Odd dimensions guarantee an exact centre tile for pedestals and boss anchors.
 */
export const CELL_W = 21;
export const CELL_H = 11;

/** Wall ring thickness in world units. Shared between adjacent cells. */
export const WALL = 1;

/** Door opening width/height in world units. */
export const DOOR_SPAN = 3;

/**
 * Interior extent of a room footprint spanning `cells` grid cells on one axis.
 * Cells share one wall, so N cells give N*CELL + (N-1) interior units.
 */
export function interiorWidth(cells) {
  return CELL_W * cells + (cells - 1);
}
export function interiorHeight(cells) {
  return CELL_H * cells + (cells - 1);
}

/** Fixed simulation step. GDD 20.7: 60 updates per second. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

/** Never simulate more than this many catch-up steps in one frame. */
export const MAX_CATCHUP_STEPS = 5;

/** Entity budgets. GDD 20.7 / R-CMB-004 / R-ENM-006. */
export const BUDGETS = Object.freeze({
  maxHostilesPerRoom: 30,
  maxLogicalProjectiles: 600,
  maxPickups: 120,
  maxObjects: 160,
  maxParticles: 900,
  /** Repeated micro-projectiles batch into a stream above this count (GDD 7.5). */
  projectileAggregationThreshold: 24,
  /** Particle aggregation threshold (GDD 18.5). */
  particleAggregationThreshold: 120,
});

/** Room transition budget. R-CAM-004 / 20.7: under 0.5 seconds. */
export const ROOM_TRANSITION_SECONDS = 0.28;

/** Floor generation time budget in ms. 20.7. */
export const FLOOR_GEN_BUDGET_MS = 250;

/** Collision layers. Bit flags so projectile masks stay cheap and explicit. */
export const LAYER = Object.freeze({
  PLAYER: 1 << 0,
  ENEMY: 1 << 1,
  PLAYER_PROJECTILE: 1 << 2,
  ENEMY_PROJECTILE: 1 << 3,
  NEUTRAL_PROJECTILE: 1 << 4,
  OBSTACLE: 1 << 5,
  WALL: 1 << 6,
  DOOR: 1 << 7,
  PICKUP: 1 << 8,
  HAZARD: 1 << 9,
  FAMILIAR: 1 << 10,
  NPC: 1 << 11,
  SECRET_WALL: 1 << 12,
  PIT: 1 << 13,
});

/** Allegiance of a damage source or projectile (GDD 6.3 "Owner"). */
export const ALLEGIANCE = Object.freeze({
  PLAYER: 'PLAYER',
  ENEMY: 'ENEMY',
  NEUTRAL: 'NEUTRAL',
  ENVIRONMENT: 'ENVIRONMENT',
});

/**
 * Outline family per allegiance (GDD 18.5, R-ART-003). Player attacks and hostile
 * attacks must never share the same outline language, so this mapping is the one
 * place that decision is made.
 */
export const OUTLINE_BY_ALLEGIANCE = Object.freeze({
  PLAYER: 'FRIENDLY',
  ENEMY: 'HOSTILE',
  NEUTRAL: 'NEUTRAL',
  ENVIRONMENT: 'ENVIRONMENT',
});

/** Cardinal directions. Index order is stable and used by sprite/adapter tables. */
export const DIR = Object.freeze({
  NORTH: 'NORTH',
  SOUTH: 'SOUTH',
  EAST: 'EAST',
  WEST: 'WEST',
});

export const DIR_VECTOR = Object.freeze({
  NORTH: Object.freeze({ x: 0, y: -1 }),
  SOUTH: Object.freeze({ x: 0, y: 1 }),
  EAST: Object.freeze({ x: 1, y: 0 }),
  WEST: Object.freeze({ x: -1, y: 0 }),
});

export const DIR_OPPOSITE = Object.freeze({
  NORTH: 'SOUTH',
  SOUTH: 'NORTH',
  EAST: 'WEST',
  WEST: 'EAST',
});

export const CARDINALS = Object.freeze(['NORTH', 'EAST', 'SOUTH', 'WEST']);

/** Eight-direction set used by the Numeric Keypad adapter (GDD 4.2, ITM-012). */
export const OCTANTS = Object.freeze([
  'EAST', 'NORTHEAST', 'NORTH', 'NORTHWEST', 'WEST', 'SOUTHWEST', 'SOUTH', 'SOUTHEAST',
]);

export const OCTANT_ANGLE = Object.freeze({
  EAST: 0,
  NORTHEAST: -Math.PI / 4,
  NORTH: -Math.PI / 2,
  NORTHWEST: (-3 * Math.PI) / 4,
  WEST: Math.PI,
  SOUTHWEST: (3 * Math.PI) / 4,
  SOUTH: Math.PI / 2,
  SOUTHEAST: Math.PI / 4,
});

/** Health kinds (GDD 5.2). */
export const HEALTH = Object.freeze({
  COMPOSURE: 'COMPOSURE',
  CAFFEINE: 'CAFFEINE',
  SPITE: 'SPITE',
});

/** Damage source tags (GDD R-PLY-004). */
export const DAMAGE_TAG = Object.freeze({
  PROJECTILE: 'PROJECTILE',
  CONTACT: 'CONTACT',
  EXPLOSION: 'EXPLOSION',
  HAZARD: 'HAZARD',
  SACRIFICE: 'SACRIFICE',
  SELF: 'SELF',
  BEAM: 'BEAM',
  MELEE: 'MELEE',
  STATUS: 'STATUS',
  LETHAL: 'LETHAL',
});

/** Item quality bands (GDD 8.3). Hidden from normal UI. */
export const QUALITY = Object.freeze({ LIABILITY: 0, MINOR: 1, RELIABLE: 2, MAJOR: 3, JACKPOT: 4 });

/** Floor 1-2 chance to permit a quality-4 item (GDD 8.4 step 5, R-ITM-004). */
export const EARLY_JACKPOT_CHANCE = 0.001;

/** Weight retained by an item that was seen but left behind (GDD 8.4). */
export const SEEN_DECAY = 0.5;

/** Loot pools (GDD 8.3). */
export const POOL = Object.freeze({
  SUPPLY_CLOSET: 'SUPPLY_CLOSET',
  MANAGER_REWARD: 'MANAGER_REWARD',
  OFFICE_SUPPLY_SHOP: 'OFFICE_SUPPLY_SHOP',
  SECRET_MAINTENANCE: 'SECRET_MAINTENANCE',
  RESTRICTED_RECORDS: 'RESTRICTED_RECORDS',
  INNOVATION_LAB: 'INNOVATION_LAB',
  UNION_BREAKROOM: 'UNION_BREAKROOM',
  EXECUTIVE_DEAL: 'EXECUTIVE_DEAL',
  GOLDEN_CABINET: 'GOLDEN_CABINET',
  SET_DROP: 'SET_DROP',
});

/** Collectible classes (GDD 8.1). */
export const COLLECTIBLE_CLASS = Object.freeze({
  WEAPON: 'WEAPON',
  PASSIVE: 'PASSIVE',
  ACTIVE: 'ACTIVE',
  ACTION_CARD: 'ACTION_CARD',
  SUPPLEMENT: 'SUPPLEMENT',
  DESK_CHARM: 'DESK_CHARM',
  PICKUP: 'PICKUP',
});

/** Attack archetypes (GDD 7.2). */
export const ARCHETYPE = Object.freeze({
  PROJECTILE: 'PROJECTILE',
  MELEE_ARC: 'MELEE_ARC',
  BEAM: 'BEAM',
  TETHER: 'TETHER',
  CONE_STREAM: 'CONE_STREAM',
  AREA_SLAM: 'AREA_SLAM',
  PLACED_AREA: 'PLACED_AREA',
  CHARGE_WAVE: 'CHARGE_WAVE',
});

/** Stat clamps (GDD R-PLY-003: no negative intervals, NaN, or infinite speed). */
export const CLAMPS = Object.freeze({
  attackInterval: { min: 0.05, max: 4.0 },
  moveSpeed: { min: 1.2, max: 16.0 },
  damage: { min: 0.5, max: 4000 },
  projectileSpeed: { min: 2.0, max: 40.0 },
  range: { min: 0.15, max: 12.0 },
  luck: { min: -10, max: 40 },
  size: { min: 0.25, max: 6.0 },
  knockback: { min: 0, max: 40 },
  pierce: { min: -1, max: 64 },
  bounce: { min: 0, max: 32 },
});

/** Room roles (GDD 12.4 / F.1). */
export const ROOM_ROLE = Object.freeze({
  START: 'ROOM-001',
  WORKROOM: 'ROOM-002',
  HALLWAY: 'ROOM-003',
  LARGE_WORKROOM: 'ROOM-004',
  SUPPLY_CLOSET: 'ROOM-005',
  SHOP: 'ROOM-006',
  MANAGER_OFFICE: 'ROOM-007',
  BREAK_ROOM: 'ROOM-008',
  DEADLINE: 'ROOM-009',
  CRISIS: 'ROOM-010',
  UNSCHEDULED_REVIEW: 'ROOM-011',
  MAINTENANCE_ACCESS: 'ROOM-012',
  FORGOTTEN_CUBICLE: 'ROOM-013',
  RESTRICTED_RECORDS: 'ROOM-014',
  OVERTIME: 'ROOM-015',
  ARCHIVE: 'ROOM-016',
  INNOVATION_LAB: 'ROOM-017',
  REC_ROOM: 'ROOM-018',
  STRATEGY: 'ROOM-019',
  WELLNESS: 'ROOM-020',
  EXECUTIVE_STORAGE: 'ROOM-021',
  SHADOW_PROCUREMENT: 'ROOM-022',
  EXECUTIVE_DEAL: 'ROOM-023',
  UNION_BREAKROOM: 'ROOM-024',
  QUARTER_END_CRUNCH: 'ROOM-025',
  SERVICE_ELEVATOR: 'ROOM-026',
  THIRTEENTH_FLOOR: 'ROOM-027',
  NPC_OFFICE: 'ROOM-028',
});

/** Door classes used by socket compatibility (GDD 11.2). */
export const DOOR_CLASS = Object.freeze({
  NORMAL: 'NORMAL',
  LOCKED_CARD: 'LOCKED_CARD',
  LOCKED_DOUBLE: 'LOCKED_DOUBLE',
  BOSS: 'BOSS',
  BLAST_SECRET: 'BLAST_SECRET',
  SHOP: 'SHOP',
  RESTRICTED: 'RESTRICTED',
  ROUTE: 'ROUTE',
});

/** Room size classes and their encounter budget multipliers (GDD 6.6). */
export const ROOM_SIZE = Object.freeze({
  TINY: 'tiny',
  NORMAL: 'normal',
  DOUBLE: 'double',
  LARGE: 'large',
});

export const ROOM_SIZE_MULTIPLIER = Object.freeze({
  tiny: 0.55,
  normal: 1.0,
  double: 1.55,
  large: 2.15,
});

export const DIFFICULTY_MULTIPLIER = Object.freeze({ standard: 1.0, hard: 1.18 });

/** Status effect ids (GDD 5.5). */
export const STATUS = Object.freeze({
  SLOW: 'SLOW',
  HASTE: 'HASTE',
  BURN: 'BURN',
  SHOCK: 'SHOCK',
  MARKED: 'MARKED',
  CONFUSED: 'CONFUSED',
  ROOTED: 'ROOTED',
  SILENCED: 'SILENCED',
  CHARMED: 'CHARMED',
});

/** Spawn zone kinds declared by room templates (GDD 12.1, G.3). */
export const SPAWN_ZONE = Object.freeze({
  ENTRY_SAFE: 'ENTRY_SAFE',
  GROUND_MELEE: 'GROUND_MELEE',
  GROUND_RANGED: 'GROUND_RANGED',
  AIR: 'AIR',
  WALL_EDGE: 'WALL_EDGE',
  REWARD: 'REWARD',
  BOSS_ANCHOR: 'BOSS_ANCHOR',
  OBJECT_ANCHOR: 'OBJECT_ANCHOR',
});

/** Movement classes for navigation validation (GDD R-ROM-006, R-ENM-008). */
export const MOVEMENT_CLASS = Object.freeze({
  GROUND: 'GROUND',
  FLYING: 'FLYING',
  WALL_HUGGER: 'WALL_HUGGER',
  STATIONARY: 'STATIONARY',
  LANE_BOUND: 'LANE_BOUND',
  TELEPORTER: 'TELEPORTER',
});
