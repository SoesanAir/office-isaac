/**
 * Content schemas for every content kind.
 *
 * GDD refs: Appendix G (Data Schema Examples), R-TEC-005, R-WPN-003
 *           (weapon must declare archetype, cadence, compatible modifier tags,
 *           explicit overrides), R-ENM-001 (enemy declares cost, movement class,
 *           attack states, tags, room compatibility), R-ENM-005 (variants carry a
 *           functional delta field), R-FLR-004/005 (footprints and sockets),
 *           R-ROM-001/006, R-BSS-005/007, R-PRG-002/005, 20.6 (id format).
 *
 * These schemas are normative. A content batch that does not validate does not
 * ship — see tools/validate-content.js.
 */

import { Schema, t } from './core/schema.js';
import {
  ALLEGIANCE, ARCHETYPE, COLLECTIBLE_CLASS, DAMAGE_TAG, DOOR_CLASS, MOVEMENT_CLASS,
  POOL, ROOM_ROLE, ROOM_SIZE, SPAWN_ZONE, STATUS,
} from './core/constants.js';

const ID = {
  weapon: /^WPN-\d{3}$/,
  passive: /^ITM-\d{3}$/,
  active: /^ACT-\d{3}$/,
  card: /^CARD-\d{3}$/,
  supplement: /^SUP-\d{3}$/,
  charm: /^CHR-\d{3}$/,
  transformation: /^TRN-\d{3}$/,
  enemy: /^ENM-\d{3}$/,
  enemyVariant: /^ENMVAR-[A-Z0-9_]+$/,
  boss: /^BSS-\d{3}$/,
  encounter: /^ENC-[A-Z0-9_]+$/,
  department: /^DPT-\d{3}$/,
  floor: /^FLOOR-[A-Z0-9_]+$/,
  route: /^ROUTE-[A-Z0-9_]+$/,
  roomTemplate: /^TPL-[A-Z0-9_]+$/,
  envObject: /^ENV-\d{3}$/,
  hazard: /^HAZ-[A-Z0-9_]+$/,
  lootPool: /^POOL-[A-Z_]+$/,
  objectLootTable: /^OLT-[A-Z0-9_]+$/,
  unlock: /^UNLOCK-[A-Z0-9_]+$/,
  ending: /^END-\d{3}$/,
  profile: /^PRF-\d{3}$/,
  challenge: /^CHL-\d{3}$/,
  sound: /^SFX-[A-Z0-9_]+$/,
  music: /^MUS-[A-Z0-9_]+$/,
};

/** Controlled tag registry (GDD 20.6: "Tags use a controlled registry"). */
export const TAGS = Object.freeze({
  attack: [
    'PROJECTILE', 'MELEE_ARC', 'BEAM', 'TETHER', 'CONE_STREAM', 'AREA_SLAM',
    'PLACED_AREA', 'CHARGE_WAVE', 'DIRECTED', 'REPEATABLE', 'SUSTAINED',
    'CHARGED', 'BURST', 'AREA', 'STICKY', 'RETURNING',
  ],
  department: [
    'OPEN_OFFICE', 'IT', 'OPERATIONS', 'EXECUTIVE', 'FINANCE', 'MARKETING',
    'LEGAL', 'FACILITIES', 'RND', 'BOARD', 'PARENT_COMPANY', 'CONGLOMERATE',
    'OWNERSHIP', 'CROSS_DEPARTMENT', 'HR', 'SECRET', 'SERVICE_SHARED',
  ],
  item: [
    'COFFEE', 'TECHNOLOGY', 'PAPER', 'MANAGEMENT', 'STATIONERY', 'ACCESS',
    'DEFENSE', 'SUSTAIN', 'ECONOMY', 'FAMILIAR', 'LIABILITY', 'TRADEOFF',
    'MODIFIER', 'STAT', 'INFORMATION', 'REROLL', 'REVIVAL', 'FORBIDDEN',
  ],
  enemy: [
    'GROUND', 'FLYING', 'STATIONARY', 'WALL_HUGGER', 'LANE_BOUND', 'TELEPORTER',
    'CHASER', 'SHOOTER', 'BURST_MOVER', 'CHARGER', 'COWARD', 'SUPPORT',
    'SPLITTER', 'PREDICTIVE', 'ZONE_CONTROLLER', 'MIMIC', 'LINKED_FORMATION',
    'RULE_ENEMY', 'HEALER', 'SHIELDER', 'SUMMONER', 'ELITE', 'SWARM',
    'ARMORED', 'THIEF', 'BLOCKER', 'DEBUFFER',
  ],
  room: [
    'COMBAT_CAPABLE', 'NORMAL', 'LARGE_ROOM', 'TINY', 'HALLWAY', 'CORRIDOR',
    'SPECIAL', 'BOSS_ARENA', 'SAFE', 'SHOP', 'PEDESTAL', 'SECRET', 'DASH_LANE',
    'OPEN_CENTRE', 'COVER_HEAVY', 'CONVEYOR', 'MULTI_LEVEL_POWER',
    'TIGHT_CORRIDOR_ONLY', 'WALL_PERIMETER', 'MOVING_GEOMETRY',
  ],
  hazardFamily: [
    'ELECTRICITY', 'CABLES', 'MACHINE_STATES', 'SPILLS', 'CONVEYORS',
    'SCANNERS', 'FIRE', 'GLASS', 'PRESSURE', 'DARKNESS', 'RED_TAPE',
    'PAPER', 'FOAM', 'VOTE',
  ],
});

const attackTag = t.enum(TAGS.attack);
const departmentTag = t.enum(TAGS.department);
const itemTag = t.enum(TAGS.item);
const enemyTag = t.enum(TAGS.enemy);
const roomTag = t.enum(TAGS.room);

/** Localization key. R-TEC-006: behaviour never reads these. */
const locKey = t.string({ required: true, pattern: /^[a-z0-9_]+(\.[a-z0-9_]+)+$/ });

/** Shared fields for anything that can be rolled out of a loot pool. */
const generationFields = {
  quality: t.int({ required: true, min: 0, max: 4 }),
  baseWeight: t.number({ required: true, min: 0, max: 100 }),
  minFloor: t.int({ required: true, min: 1, max: 40 }),
  maxFloor: t.int({ min: 1, max: 40 }),
  pools: t.array(t.enum(POOL), { required: true, minItems: 0, unique: true }),
  unlockId: t.ref('unlock'),
  repeatable: t.bool({ required: true }),
  earlyJackpotEligible: t.bool(),
};

/** Inclusive integer range, e.g. count: [2, 3]. */
const intRange = t.tuple([t.int({ required: true, min: 0 }), t.int({ required: true, min: 0 })]);
const numRange = t.tuple([t.number({ required: true }), t.number({ required: true })]);

// ---------------------------------------------------------------------------
// Weapons (GDD 7, Appendix B, G.1)
// ---------------------------------------------------------------------------

export const weaponSchema = new Schema('weapon', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  descriptionLoc: locKey,
  spriteId: t.string({ required: true }),
  heldSpriteId: t.string(),
  ...generationFields,
  attack: t.object({
    archetype: t.enum(ARCHETYPE, { required: true }),
    inputMode: t.enum(['CARDINAL_TAP', 'CARDINAL_HOLD', 'CHARGE', 'PLACE'], { required: true }),
    baseDamageMultiplier: t.number({ required: true, min: 0.05, max: 12 }),
    intervalSeconds: t.number({ required: true, min: 0.03, max: 6 }),
    // Projectile archetypes
    projectileSpeed: t.number({ min: 0.5, max: 40 }),
    projectileLifetime: t.number({ min: 0.05, max: 12 }),
    projectileSize: t.number({ min: 0.1, max: 6 }),
    projectileCount: t.int({ min: 1, max: 24 }),
    spreadRadians: t.number({ min: 0, max: Math.PI }),
    pierce: t.int({ min: -1, max: 64 }),
    bounce: t.int({ min: 0, max: 32 }),
    knockback: t.number({ min: 0, max: 40 }),
    // Melee / area archetypes
    arcRadius: t.number({ min: 0.2, max: 10 }),
    arcAngle: t.number({ min: 0, max: Math.PI * 2 }),
    windupSeconds: t.number({ min: 0, max: 3 }),
    activeSeconds: t.number({ min: 0, max: 5 }),
    recoverySeconds: t.number({ min: 0, max: 3 }),
    // Beam / cone / stream archetypes
    beamWidth: t.number({ min: 0.05, max: 6 }),
    beamRange: t.number({ min: 0.5, max: 30 }),
    tickRate: t.number({ min: 1, max: 60 }),
    coneAngle: t.number({ min: 0, max: Math.PI }),
    // Charge archetypes
    chargeTiers: t.array(t.object({
      seconds: t.number({ required: true, min: 0, max: 6 }),
      damageMultiplier: t.number({ required: true, min: 0.1, max: 12 }),
      sizeMultiplier: t.number({ required: true, min: 0.1, max: 8 }),
    })),
    // Placed area archetypes
    placementLifetime: t.number({ min: 0.2, max: 30 }),
    maxInstances: t.int({ min: 1, max: 8 }),
    // Cadence shaping (Stapler's rhythmic reload)
    burstCount: t.int({ min: 1, max: 12 }),
    burstReloadSeconds: t.number({ min: 0, max: 4 }),
    damageTags: t.array(t.enum(DAMAGE_TAG), { required: true, minItems: 1 }),
  }, { required: true }),
  modifierTags: t.array(attackTag, { required: true, minItems: 1, unique: true }),
  /** mechanic name -> adapter id. GDD 7.3. */
  adapters: t.map(t.string({ required: true }), { required: true }),
  audio: t.object({
    fire: t.ref('sound'),
    impact: t.ref('sound'),
    charge: t.ref('sound'),
  }, { required: true }),
  /** Free-text authoring note recorded for the originality review (GDD H.2). */
  originalityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.weapon,
  invariants: [
    (def, issues, label) => {
      const a = def.attack;
      if (!a) return;
      const needsProjectile = a.archetype === ARCHETYPE.PROJECTILE;
      if (needsProjectile && (a.projectileSpeed === undefined || a.projectileLifetime === undefined)) {
        issues.error(`${label}.attack`, 'PROJECTILE archetype requires projectileSpeed and projectileLifetime');
      }
      if (a.archetype === ARCHETYPE.BEAM && (a.beamRange === undefined || a.tickRate === undefined)) {
        issues.error(`${label}.attack`, 'BEAM archetype requires beamRange and tickRate');
      }
      if (a.archetype === ARCHETYPE.MELEE_ARC && (a.arcRadius === undefined || a.arcAngle === undefined)) {
        issues.error(`${label}.attack`, 'MELEE_ARC archetype requires arcRadius and arcAngle');
      }
      if (a.archetype === ARCHETYPE.CHARGE_WAVE && !a.chargeTiers?.length) {
        issues.error(`${label}.attack`, 'CHARGE_WAVE archetype requires chargeTiers');
      }
      if (a.archetype === ARCHETYPE.PLACED_AREA && a.placementLifetime === undefined) {
        issues.error(`${label}.attack`, 'PLACED_AREA archetype requires placementLifetime');
      }
      // R-WPN-004: a weapon is never also a modifier.
      if (def.modifier) issues.error(`${label}`, 'a weapon must not declare a modifier block (R-WPN-004)');
    },
  ],
});

// ---------------------------------------------------------------------------
// Passive items (GDD 8, Appendix C, G.2)
// ---------------------------------------------------------------------------

export const passiveSchema = new Schema('passive', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  pickupPhraseLoc: locKey,
  collectionLoc: locKey,
  class: t.enum([COLLECTIBLE_CLASS.PASSIVE], { required: true }),
  spriteId: t.string({ required: true }),
  ...generationFields,
  tags: t.array(itemTag, { required: true, unique: true }),
  /** Primary catalogue category (GDD 8.7 table). */
  category: t.string({ required: true }),
  /** Flat/multiplicative stat contributions applied by the attack graph. */
  stats: t.object({
    damageMul: t.number({ min: 0.1, max: 8 }),
    damageAdd: t.number({ min: -50, max: 200 }),
    intervalMul: t.number({ min: 0.1, max: 4 }),
    moveSpeedAdd: t.number({ min: -4, max: 8 }),
    moveSpeedMul: t.number({ min: 0.2, max: 4 }),
    projectileSpeedMul: t.number({ min: 0.2, max: 4 }),
    rangeMul: t.number({ min: 0.2, max: 4 }),
    sizeMul: t.number({ min: 0.2, max: 6 }),
    luckAdd: t.number({ min: -10, max: 20 }),
    knockbackMul: t.number({ min: 0, max: 8 }),
    pierceAdd: t.int({ min: -1, max: 16 }),
    bounceAdd: t.int({ min: 0, max: 16 }),
    spreadMul: t.number({ min: 0, max: 4 }),
    contactDamageResistMul: t.number({ min: 0, max: 2 }),
    explosionDamageResistMul: t.number({ min: 0, max: 2 }),
    incomingKnockbackMul: t.number({ min: 0, max: 2 }),
    armorPierceFraction: t.number({ min: 0, max: 1 }),
    activeChargeCapacityAdd: t.int({ min: 0, max: 6 }),
  }),
  /** Health container changes applied once on pickup (GDD 5.2). */
  health: t.object({
    composureContainersAdd: t.int({ min: -6, max: 6 }),
    composureHealHalfUnits: t.int({ min: 0, max: 24 }),
    caffeineIconsAdd: t.int({ min: 0, max: 6 }),
    spiteIconsAdd: t.int({ min: 0, max: 6 }),
  }),
  /** Attack-graph modifier block (GDD 7.3, G.2). Absent for pure stat items. */
  modifier: t.object({
    mechanic: t.string({ required: true }),
    supportedAttackTags: t.array(attackTag, { required: true, minItems: 1 }),
    defaultAdapter: t.string({ required: true }),
    weaponOverrides: t.map(t.string({ required: true })),
    unsupportedBehavior: t.enum(['NO_EFFECT', 'FALLBACK_STAT'], { required: true }),
    params: t.any(),
  }),
  /** Declarative behaviour hooks resolved by the effect registry. */
  effects: t.array(t.object({
    hook: t.string({ required: true }),
    params: t.any(),
  }, { required: true })),
  /** GDD 8.6 / R-ITM-007: liabilities carry a red frame after identification. */
  liability: t.bool({ required: true }),
  /** GDD 12.5 stacking contract for repeatable items. */
  stacking: t.enum(['NONE', 'LINEAR', 'DIMINISHING', 'CAPPED'], { required: true }),
  stackCap: t.int({ min: 1, max: 16 }),
  interactionNotes: t.string({ required: true, minLength: 4 }),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.passive,
  invariants: [
    (def, issues, label) => {
      if (def.stacking !== 'NONE' && !def.repeatable) {
        issues.warn(`${label}.stacking`, 'declares stacking but is not repeatable');
      }
      if (def.repeatable && def.stacking === 'NONE') {
        issues.error(`${label}.stacking`, 'repeatable items must declare stacking behaviour (GDD 8.4)');
      }
      if (def.quality === 0 && !def.liability && !def.tags.includes('TRADEOFF')) {
        issues.warn(`${label}.quality`, 'quality 0 without LIABILITY or TRADEOFF tag');
      }
      // R-ITM-005: pickup phrasing must not leak raw numbers. The literal copy is
      // checked in the localization pass; here we guard the loc key naming.
      if (/percent|_pct|plus\d/.test(def.pickupPhraseLoc)) {
        issues.error(`${label}.pickupPhraseLoc`, 'pickup phrase key hints at raw numbers (R-ITM-005)');
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Active items, Action Cards, Supplements, Desk Charms, Transformations
// ---------------------------------------------------------------------------

export const activeSchema = new Schema('active', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  pickupPhraseLoc: locKey,
  class: t.enum([COLLECTIBLE_CLASS.ACTIVE], { required: true }),
  spriteId: t.string({ required: true }),
  ...generationFields,
  tags: t.array(itemTag, { required: true, unique: true }),
  recharge: t.object({
    // GDD 6.5: most actives recharge by clearing hostile rooms.
    mode: t.enum(['ROOMS', 'TIME', 'CREDITS', 'FED_ITEMS', 'CONDITIONAL'], { required: true }),
    rooms: t.int({ min: 1, max: 24 }),
    seconds: t.number({ min: 1, max: 300 }),
    creditsMax: t.int({ min: 1, max: 60 }),
    note: t.string(),
  }, { required: true }),
  effectHook: t.string({ required: true }),
  params: t.any(),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, { idPattern: ID.active });

export const cardSchema = new Schema('card', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  descriptionLoc: locKey,
  class: t.enum([COLLECTIBLE_CLASS.ACTION_CARD], { required: true }),
  spriteId: t.string({ required: true }),
  baseWeight: t.number({ required: true, min: 0, max: 100 }),
  minFloor: t.int({ required: true, min: 1 }),
  unlockId: t.ref('unlock'),
  effectHook: t.string({ required: true }),
  params: t.any(),
  /** CARD-015 cannot be used in boss rooms (GDD 9.6). */
  usageRestrictions: t.array(t.enum(['NOT_IN_BOSS_ROOM', 'NOT_IN_SHOP', 'REQUIRES_CLEARED_ROOM', 'NOT_IN_START_ROOM']), { required: true }),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, { idPattern: ID.card });

export const supplementSchema = new Schema('supplement', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  identifiedPhraseLoc: locKey,
  class: t.enum([COLLECTIBLE_CLASS.SUPPLEMENT], { required: true }),
  /** Wrapper appearance is assigned per run, so the sprite is the *effect* icon. */
  spriteId: t.string({ required: true }),
  baseWeight: t.number({ required: true, min: 0, max: 100 }),
  valence: t.enum(['POSITIVE', 'NEGATIVE', 'MIXED'], { required: true }),
  permanent: t.bool({ required: true }),
  effectHook: t.string({ required: true }),
  params: t.any(),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, { idPattern: ID.supplement });

export const charmSchema = new Schema('charm', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  descriptionLoc: locKey,
  class: t.enum([COLLECTIBLE_CLASS.DESK_CHARM], { required: true }),
  spriteId: t.string({ required: true }),
  ...generationFields,
  tags: t.array(itemTag, { required: true, unique: true }),
  effects: t.array(t.object({
    hook: t.string({ required: true }),
    params: t.any(),
  }), { required: true, minItems: 1 }),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, { idPattern: ID.charm });

export const transformationSchema = new Schema('transformation', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  descriptionLoc: locKey,
  spriteId: t.string({ required: true }),
  condition: t.object({
    /** Either an explicit set, or N-of-M over a tagged group (GDD C.7). */
    mode: t.enum(['ALL_OF', 'ANY_N_OF', 'TAG_COUNT'], { required: true }),
    itemIds: t.array(t.ref('passive')),
    count: t.int({ min: 1, max: 12 }),
    tag: itemTag,
  }, { required: true }),
  effects: t.array(t.object({
    hook: t.string({ required: true }),
    params: t.any(),
  }), { required: true, minItems: 1 }),
  /** GDD 18.4: transformations show a visible player body state. */
  playerVisual: t.string({ required: true }),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.transformation,
  invariants: [
    (def, issues, label) => {
      const c = def.condition;
      if (!c) return;
      if (c.mode === 'ALL_OF' && !(c.itemIds?.length >= 2)) {
        issues.error(`${label}.condition`, 'ALL_OF requires at least two itemIds');
      }
      if (c.mode === 'ANY_N_OF' && !(c.itemIds?.length >= 2 && c.count >= 1)) {
        issues.error(`${label}.condition`, 'ANY_N_OF requires itemIds and count');
      }
      if (c.mode === 'TAG_COUNT' && !(c.tag && c.count >= 1)) {
        issues.error(`${label}.condition`, 'TAG_COUNT requires tag and count');
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Enemies (GDD 14, Appendix D, G.5)
// ---------------------------------------------------------------------------

export const enemySchema = new Schema('enemy', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  spriteId: t.string({ required: true }),
  homeDepartments: t.array(departmentTag, { required: true, minItems: 1, unique: true }),
  tags: t.array(enemyTag, { required: true, minItems: 1, unique: true }),
  /** Encounter budget cost (GDD 6.6, D.1). */
  cost: t.number({ required: true, min: 0.2, max: 12 }),
  health: t.number({ required: true, min: 1, max: 4000 }),
  /** Half-unit contact damage (GDD 5.2 health is measured in half-units). */
  contactDamage: t.int({ required: true, min: 0, max: 6 }),
  radius: t.number({ required: true, min: 0.15, max: 4 }),
  movement: t.object({
    controller: t.string({ required: true }),
    movementClass: t.enum(MOVEMENT_CLASS, { required: true }),
    baseSpeed: t.number({ required: true, min: 0, max: 20 }),
    params: t.any(),
  }, { required: true }),
  ai: t.object({
    states: t.array(t.string({ required: true }), { required: true, minItems: 1 }),
    /** R-CMB-002 / R-ENM-002: authored telegraph before the first damaging frame. */
    telegraphSeconds: t.number({ required: true, min: 0.12, max: 4 }),
    predictionSeconds: t.number({ min: 0, max: 2 }),
    params: t.any(),
  }, { required: true }),
  attacks: t.array(t.object({
    id: t.string({ required: true }),
    module: t.string({ required: true }),
    cooldownSeconds: t.number({ required: true, min: 0.05, max: 30 }),
    telegraphSeconds: t.number({ required: true, min: 0.12, max: 4 }),
    damage: t.int({ required: true, min: 0, max: 6 }),
    damageTags: t.array(t.enum(DAMAGE_TAG), { required: true, minItems: 1 }),
    params: t.any(),
  }), { required: true }),
  /** Which room templates this enemy may occupy (R-ENM-001, R-ROM-006). */
  roomRequirements: t.array(roomTag, { required: true, unique: true }),
  prohibitedRoomTags: t.array(roomTag, { unique: true }),
  spawnZones: t.array(t.enum(SPAWN_ZONE), { required: true, minItems: 1, unique: true }),
  dropTable: t.ref('objectLootTable'),
  variants: t.array(t.ref('enemyVariant'), { required: true }),
  /** GDD 14.3: unique silhouette note, reviewed in the readability pass. */
  silhouetteNote: t.string({ required: true, minLength: 8 }),
  audio: t.object({
    telegraph: t.ref('sound'),
    death: t.ref('sound'),
  }, { required: true }),
  /** GDD 14.2 counterplay column — mandatory so every enemy has an answer. */
  counterplay: t.string({ required: true, minLength: 8 }),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.enemy,
  invariants: [
    (def, issues, label) => {
      if (def.tags.includes('SUPPORT') && !def.attacks.length && !def.ai.params) {
        issues.warn(`${label}`, 'support enemy declares no attacks and no ai params');
      }
      if (def.movement.movementClass === 'STATIONARY' && def.movement.baseSpeed > 0) {
        issues.error(`${label}.movement`, 'STATIONARY movement class must have baseSpeed 0');
      }
      for (const attack of def.attacks) {
        if (attack.damage > 0 && attack.telegraphSeconds < 0.12) {
          issues.error(`${label}.attacks.${attack.id}`, 'damaging attack needs >=0.12s telegraph (R-CMB-002)');
        }
      }
    },
  ],
});

export const enemyVariantSchema = new Schema('enemyVariant', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  baseEnemy: t.ref('enemy', { required: true }),
  nameLoc: locKey,
  /** R-ENM-005: a variant MUST change behaviour, not only numbers. */
  functionalDelta: t.string({ required: true, minLength: 12 }),
  /** GDD 18.3: elites keep the base silhouette and add exactly one marker. */
  visualMarker: t.enum(['SIZE', 'COLOR_ACCENT', 'ACCESSORY', 'AURA', 'NONE'], { required: true }),
  paletteSwap: t.map(t.string()),
  scale: t.number({ min: 0.5, max: 3 }),
  overrides: t.object({
    health: t.number({ min: 1, max: 6000 }),
    cost: t.number({ min: 0.2, max: 16 }),
    contactDamage: t.int({ min: 0, max: 6 }),
    baseSpeed: t.number({ min: 0, max: 24 }),
    tagsAdd: t.array(enemyTag, { unique: true }),
    tagsRemove: t.array(enemyTag, { unique: true }),
  }),
  behaviorModules: t.array(t.object({
    module: t.string({ required: true }),
    params: t.any(),
  }), { required: true }),
  minFloor: t.int({ required: true, min: 1 }),
  weight: t.number({ required: true, min: 0, max: 10 }),
}, {
  idPattern: ID.enemyVariant,
  invariants: [
    (def, issues, label) => {
      const onlyStats =
        def.behaviorModules.length === 0 &&
        (!def.overrides || Object.keys(def.overrides).every((k) => ['health', 'cost'].includes(k)));
      if (onlyStats) {
        issues.error(
          `${label}`,
          'variant changes only health/cost; R-ENM-005 requires a behaviour, pattern, death effect, or support delta',
        );
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Bosses (GDD 15, Appendix E)
// ---------------------------------------------------------------------------

export const bossSchema = new Schema('boss', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  spriteId: t.string({ required: true }),
  departments: t.array(departmentTag, { required: true, minItems: 1 }),
  /** Floor pools this boss may be drawn from (GDD 15.2). */
  floorPools: t.array(t.string({ required: true }), { required: true, minItems: 1 }),
  arenaTags: t.array(roomTag, { required: true, minItems: 1 }),
  maxHealth: t.number({ required: true, min: 40, max: 20000 }),
  healthScalingPerDepth: t.number({ required: true, min: 0, max: 2 }),
  radius: t.number({ required: true, min: 0.5, max: 8 }),
  contactDamage: t.int({ required: true, min: 0, max: 6 }),
  phases: t.array(t.object({
    id: t.string({ required: true }),
    entryCondition: t.object({
      type: t.enum(['START', 'HEALTH_BELOW', 'TIME_AFTER', 'ADDS_CLEARED', 'NODES_DESTROYED'], { required: true }),
      value: t.number(),
    }, { required: true }),
    /** Weighted attack pattern selection inside the phase (GDD 15.4). */
    patternWeights: t.array(t.object({
      pattern: t.string({ required: true }),
      weight: t.number({ required: true, min: 0 }),
      params: t.any(),
    }), { required: true, minItems: 1 }),
    movementRule: t.string({ required: true }),
    adds: t.array(t.object({
      enemy: t.ref('enemy', { required: true }),
      count: intRange,
      intervalSeconds: t.number({ min: 0.5, max: 60 }),
      maxAlive: t.int({ min: 1, max: 12 }),
    })),
    environment: t.array(t.string()),
    exitCondition: t.object({
      type: t.enum(['HEALTH_BELOW', 'TIME_AFTER', 'ADDS_CLEARED', 'NODES_DESTROYED', 'DEATH'], { required: true }),
      value: t.number(),
    }, { required: true }),
    /** R-BSS-004: bounded, purposeful, visually explicit invulnerability. */
    invulnerable: t.bool({ required: true }),
    maxInvulnerableSeconds: t.number({ min: 0, max: 6 }),
    attackableDuringInvuln: t.bool(),
  }), { required: true, minItems: 1 }),
  telegraphMinimumSeconds: t.number({ required: true, min: 0.2, max: 3 }),
  /** R-BSS-006: at least one safe path must survive every zone/wall phase. */
  guaranteesSafePath: t.bool({ required: true }),
  managerRewardOverride: t.string(),
  setDrop: t.object({
    contentId: t.string({ required: true }),
    chance: t.number({ required: true, min: 0, max: 1 }),
    replacesManagerReward: t.bool({ required: true }),
    conditionHook: t.string(),
  }),
  unlockHooks: t.array(t.ref('unlock'), { required: true }),
  endingHooks: t.array(t.ref('ending'), { required: true }),
  accessibilityVariants: t.array(t.string(), { required: true }),
  testSeeds: t.array(t.string(), { required: true, minItems: 1 }),
  audio: t.object({
    intro: t.ref('sound'),
    phase: t.ref('sound'),
    death: t.ref('sound'),
    music: t.ref('music'),
  }, { required: true }),
  silhouetteNote: t.string({ required: true, minLength: 8 }),
  coreIdea: t.string({ required: true, minLength: 12 }),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.boss,
  invariants: [
    (def, issues, label) => {
      if (!def.guaranteesSafePath) {
        issues.error(`${label}.guaranteesSafePath`, 'must be true (R-BSS-006)');
      }
      for (const phase of def.phases || []) {
        if (phase.invulnerable) {
          const bounded = (phase.maxInvulnerableSeconds ?? 0) > 0 && phase.maxInvulnerableSeconds <= 6;
          if (!bounded && !phase.attackableDuringInvuln) {
            issues.error(
              `${label}.phases.${phase.id}`,
              'invulnerable phase needs maxInvulnerableSeconds <= 6 or an attackable add/objective (R-BSS-004)',
            );
          }
        }
      }
      const hasStart = (def.phases || []).some((p) => p.entryCondition?.type === 'START');
      if (!hasStart) issues.error(`${label}.phases`, 'no phase has a START entry condition');
    },
  ],
});

// ---------------------------------------------------------------------------
// Encounters (GDD 12, 14.5, G.4)
// ---------------------------------------------------------------------------

export const encounterSchema = new Schema('encounter', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  departmentTags: t.array(departmentTag, { required: true, minItems: 1 }),
  roomTagsRequired: t.array(roomTag, { required: true }),
  roomTagsAny: t.array(roomTag, { required: true }),
  roomTagsProhibited: t.array(roomTag),
  budgetRange: numRange,
  minFloor: t.int({ required: true, min: 1 }),
  maxFloor: t.int({ min: 1 }),
  spawnGroups: t.array(t.object({
    zone: t.enum(SPAWN_ZONE, { required: true }),
    /** Optional wave index; absent means wave 0. */
    wave: t.int({ min: 0, max: 8 }),
    entries: t.array(t.object({
      enemy: t.ref('enemy', { required: true }),
      variant: t.ref('enemyVariant'),
      count: intRange,
    }), { required: true, minItems: 1 }),
  }), { required: true, minItems: 1 }),
  constraints: t.object({
    maxSupport: t.int({ required: true, min: 0, max: 4 }),
    minEntryGraceSeconds: t.number({ required: true, min: 0.4, max: 3 }),
    requirePlayerPathBetweenEntries: t.bool({ required: true }),
    maxSimultaneousHostiles: t.int({ min: 1, max: 30 }),
  }, { required: true }),
  clearRule: t.enum(['ALL_REQUIRED_ENEMIES', 'ALL_WAVES', 'TIMER', 'OBJECTIVE'], { required: true }),
  rewardProfile: t.enum(['NONE', 'NORMAL_CLEAR', 'RICH_CLEAR', 'PREMIUM', 'CHALLENGE'], { required: true }),
  weight: t.number({ required: true, min: 0, max: 10 }),
}, {
  idPattern: ID.encounter,
  invariants: [
    (def, issues, label) => {
      if (def.budgetRange && def.budgetRange[0] > def.budgetRange[1]) {
        issues.error(`${label}.budgetRange`, 'min exceeds max');
      }
      // R-ENM-003: no mutually shielding / infinitely healing groups.
      const waves = new Set((def.spawnGroups || []).map((g) => g.wave ?? 0));
      if (def.clearRule === 'ALL_WAVES' && waves.size < 2) {
        issues.error(`${label}.clearRule`, 'ALL_WAVES requires at least two distinct wave indices');
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Departments, floors, routes (GDD 10, Appendix A, G.6)
// ---------------------------------------------------------------------------

export const departmentSchema = new Schema('department', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  tag: departmentTag,
  routeRole: t.string({ required: true }),
  floors: t.array(t.ref('floor'), { required: true, minItems: 1, maxItems: 2 }),
  roomTemplatePools: t.array(t.string({ required: true }), { required: true, minItems: 1 }),
  bossPools: t.array(t.string({ required: true }), { required: true, minItems: 1 }),
  objectSets: t.array(t.ref('envObject'), { required: true, minItems: 3 }),
  hazardSets: t.array(t.enum(TAGS.hazardFamily), { required: true, minItems: 3 }),
  itemAffinities: t.map(t.number({ required: true, min: 0, max: 4 }), { required: true }),
  presentation: t.object({
    palette: t.map(t.string({ required: true }), { required: true }),
    floorPattern: t.string({ required: true }),
    wallPattern: t.string({ required: true }),
    lighting: t.object({
      tint: t.string({ required: true }),
      strength: t.number({ required: true, min: 0, max: 0.75 }),
      vignette: t.number({ required: true, min: 0, max: 0.9 }),
    }, { required: true }),
    music: t.ref('music', { required: true }),
    ambience: t.ref('sound'),
    transitionSting: t.ref('sound'),
  }, { required: true }),
  /** GDD 10.4: what this department reveals without dialogue. */
  narrativeImplication: t.string({ required: true, minLength: 12 }),
  gameplayIdentity: t.string({ required: true, minLength: 12 }),
  visualIdentity: t.string({ required: true, minLength: 12 }),
  hidden: t.bool({ required: true }),
  originalityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.department,
  invariants: [
    (def, issues, label) => {
      // R-ART-004 / R-DPT-005: lighting must not be the only identity signal.
      if (def.presentation?.lighting?.strength > 0.6) {
        issues.warn(`${label}.presentation.lighting`, 'very strong tint may hide combat elements (GDD 18.2)');
      }
    },
  ],
});

export const floorSchema = new Schema('floor', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  department: t.ref('department', { required: true }),
  /** 1 or 2 within the chapter pair (GDD 10.2). */
  tier: t.int({ required: true, min: 1, max: 2 }),
  /** Ordered progression index used by budgets and quality gates (GDD 26). */
  depth: t.int({ required: true, min: 1, max: 40 }),
  nameLoc: locKey,
  targetNodes: intRange,
  roomSizeDistribution: t.object({
    single: t.number({ required: true, min: 0, max: 1 }),
    double: t.number({ required: true, min: 0, max: 1 }),
    large: t.number({ required: true, min: 0, max: 1 }),
    tiny: t.number({ required: true, min: 0, max: 1 }),
  }, { required: true }),
  requiredRoles: t.array(t.enum(ROOM_ROLE), { required: true, minItems: 1 }),
  optionalRooms: t.array(t.object({
    role: t.enum(ROOM_ROLE, { required: true }),
    chance: t.number({ required: true, min: 0, max: 1 }),
    requiresDeadEnd: t.bool({ required: true }),
    mutuallyExclusiveWith: t.array(t.enum(ROOM_ROLE)),
    accessCost: t.enum(['NONE', 'ONE_CARD', 'TWO_CARDS', 'HEALTH', 'CREDITS', 'BLAST']),
    minDepth: t.int({ min: 1 }),
  }), { required: true }),
  minDeadEnds: t.int({ required: true, min: 1, max: 12 }),
  encounterPools: t.array(t.string({ required: true }), { required: true, minItems: 1 }),
  bossPool: t.string({ required: true }),
  difficulty: t.enum(['standard', 'hard'], { required: true }),
  /** Supply closet door cost: free on Open Office I only (GDD ROOM-005). */
  supplyClosetCost: t.enum(['NONE', 'ONE_CARD'], { required: true }),
  shopDoorCost: t.enum(['NONE', 'ONE_CARD'], { required: true }),
  secretRooms: t.object({
    maintenanceAccess: t.number({ required: true, min: 0, max: 1 }),
    forgottenCubicle: t.number({ required: true, min: 0, max: 1 }),
  }, { required: true }),
  hidden: t.bool({ required: true }),
}, {
  idPattern: ID.floor,
  invariants: [
    (def, issues, label) => {
      const d = def.roomSizeDistribution;
      if (d) {
        const sum = d.single + d.double + d.large + d.tiny;
        if (Math.abs(sum - 1) > 0.02) {
          issues.error(`${label}.roomSizeDistribution`, `weights sum to ${sum.toFixed(3)}, expected 1.0`);
        }
      }
      // R-LOOP-001 / R-FLR-006: the three guaranteed roles must be present.
      for (const role of [ROOM_ROLE.START, ROOM_ROLE.SUPPLY_CLOSET, ROOM_ROLE.SHOP, ROOM_ROLE.MANAGER_OFFICE]) {
        if (!def.requiredRoles?.includes(role)) {
          issues.error(`${label}.requiredRoles`, `missing guaranteed role ${role} (R-LOOP-001)`);
        }
      }
      if (def.targetNodes && def.targetNodes[0] > def.targetNodes[1]) {
        issues.error(`${label}.targetNodes`, 'min exceeds max');
      }
    },
  ],
});

export const routeSchema = new Schema('route', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  /** Ordered floor sequence. Alternates are chosen by RUN_ROUTE stream. */
  steps: t.array(t.object({
    floor: t.ref('floor'),
    /** Weighted alternates that may replace this step after unlock (GDD 10.5). */
    alternates: t.array(t.object({
      floor: t.ref('floor', { required: true }),
      weight: t.number({ required: true, min: 0 }),
      requiresUnlock: t.ref('unlock'),
    })),
  }), { required: true, minItems: 1 }),
  /** Continuation appended when a hidden condition is satisfied (GDD 16.5). */
  continuations: t.array(t.object({
    route: t.string({ required: true }),
    requiresFlag: t.string({ required: true }),
  }), { required: true }),
  hidden: t.bool({ required: true }),
}, { idPattern: ID.route });

// ---------------------------------------------------------------------------
// Room templates (GDD 11-12, G.3)
// ---------------------------------------------------------------------------

export const roomTemplateSchema = new Schema('roomTemplate', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  departmentTags: t.array(departmentTag, { required: true, minItems: 1 }),
  roleTags: t.array(t.enum([...Object.values(ROOM_ROLE), ...TAGS.room]), { required: true, minItems: 1 }),
  /** Occupied grid cells relative to the room origin (GDD R-FLR-004). */
  footprintCells: t.array(t.tuple([t.int({ required: true }), t.int({ required: true })]), {
    required: true, minItems: 1, maxItems: 9, unique: true,
  }),
  sizeClass: t.enum(ROOM_SIZE, { required: true }),
  doorSockets: t.array(t.object({
    id: t.string({ required: true }),
    side: t.enum(['NORTH', 'SOUTH', 'EAST', 'WEST'], { required: true }),
    cell: t.tuple([t.int({ required: true }), t.int({ required: true })]),
    /** Normalised position along that cell's edge. */
    offset: t.number({ required: true, min: 0.1, max: 0.9 }),
    classes: t.array(t.enum(DOOR_CLASS), { required: true, minItems: 1, unique: true }),
  }), { required: true, minItems: 1 }),
  /**
   * Interior geometry as a character grid, one row per world unit of the
   * footprint interior. '.' floor, '#' wall, 'x' pit, '~' low cover.
   */
  geometry: t.array(t.string({ required: true }), { required: true, minItems: 3 }),
  objectAnchors: t.array(t.object({
    /** Interior cell coordinates in world units. */
    at: t.tuple([t.number({ required: true }), t.number({ required: true })]),
    /** Which object families may occupy this anchor. */
    allow: t.array(t.ref('envObject'), { required: true, minItems: 1 }),
    chance: t.number({ required: true, min: 0, max: 1 }),
    variantHint: t.string(),
  }), { required: true }),
  spawnZones: t.array(t.object({
    zone: t.enum(SPAWN_ZONE, { required: true }),
    /** Rect in interior world units: [x, y, w, h]. */
    rect: t.tuple([
      t.number({ required: true }), t.number({ required: true }),
      t.number({ required: true, min: 0.5 }), t.number({ required: true, min: 0.5 }),
    ]),
  }), { required: true, minItems: 1 }),
  allowedEncounterTags: t.array(roomTag, { required: true }),
  prohibitedEnemyTags: t.array(roomTag, { required: true }),
  decorationSets: t.array(t.string({ required: true }), { required: true }),
  hazardAnchors: t.array(t.object({
    hazard: t.ref('hazard', { required: true }),
    rect: t.tuple([
      t.number({ required: true }), t.number({ required: true }),
      t.number({ required: true, min: 0.5 }), t.number({ required: true, min: 0.5 }),
    ]),
    chance: t.number({ required: true, min: 0, max: 1 }),
  }), { required: true }),
  /** GDD 12.6: an optional one-line environmental story. */
  vignette: t.string(),
  weight: t.number({ required: true, min: 0, max: 10 }),
  minDepth: t.int({ min: 1 }),
}, {
  idPattern: ID.roomTemplate,
  invariants: [
    (def, issues, label) => {
      // Geometry rectangle must be consistent.
      if (Array.isArray(def.geometry) && def.geometry.length > 0) {
        const w = def.geometry[0].length;
        for (let y = 0; y < def.geometry.length; y += 1) {
          if (def.geometry[y].length !== w) {
            issues.error(`${label}.geometry[${y}]`, `row width ${def.geometry[y].length}, expected ${w}`);
          }
        }
      }
      // Every socket cell must be part of the footprint (R-FLR-005).
      const cells = new Set((def.footprintCells || []).map(([x, y]) => `${x},${y}`));
      for (const socket of def.doorSockets || []) {
        const key = `${socket.cell?.[0]},${socket.cell?.[1]}`;
        if (!cells.has(key)) {
          issues.error(`${label}.doorSockets.${socket.id}`, `cell ${key} is not in footprintCells`);
        }
      }
      // Duplicate socket ids would make edges ambiguous.
      const seen = new Set();
      for (const socket of def.doorSockets || []) {
        if (seen.has(socket.id)) issues.error(`${label}.doorSockets`, `duplicate socket id "${socket.id}"`);
        seen.add(socket.id);
      }
      // R-FLR-007: architecture must not hard-link an encounter.
      if (def.encounterId) {
        issues.error(`${label}`, 'room templates must not declare an encounter id (R-FLR-007)');
      }
      // R-ROM-006 / R-ENM-008: combat rooms need an entry-safe zone.
      const isCombat = def.allowedEncounterTags?.length > 0 || def.roleTags?.includes('COMBAT_CAPABLE');
      if (isCombat) {
        const zones = new Set((def.spawnZones || []).map((z) => z.zone));
        if (!zones.has(SPAWN_ZONE.ENTRY_SAFE)) {
          issues.error(`${label}.spawnZones`, 'combat-capable template needs an ENTRY_SAFE zone (R-ENM-002)');
        }
      }
      // Size class must agree with the footprint.
      const cellCount = def.footprintCells?.length ?? 0;
      if (def.sizeClass === ROOM_SIZE.NORMAL && cellCount !== 1) {
        issues.error(`${label}.sizeClass`, `normal rooms occupy 1 cell, got ${cellCount}`);
      }
      if (def.sizeClass === ROOM_SIZE.DOUBLE && cellCount !== 2) {
        issues.error(`${label}.sizeClass`, `double rooms occupy 2 cells, got ${cellCount}`);
      }
      if (def.sizeClass === ROOM_SIZE.LARGE && cellCount < 3) {
        issues.error(`${label}.sizeClass`, `large rooms occupy 3+ cells, got ${cellCount}`);
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Environmental objects and hazards (GDD 13, F.2)
// ---------------------------------------------------------------------------

export const envObjectSchema = new Schema('envObject', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  spriteId: t.string({ required: true }),
  objectClass: t.enum([
    'INDESTRUCTIBLE', 'DESTRUCTIBLE_LIGHT', 'DESTRUCTIBLE_HEAVY', 'MOVABLE',
    'REACTIVE', 'INTERACTIVE', 'HAZARD', 'DECORATION',
  ], { required: true }),
  /** R-ENV-001: collision must match the visible shape. */
  collision: t.object({
    /** Extent in world units, centred on the anchor. */
    w: t.number({ required: true, min: 0, max: 8 }),
    h: t.number({ required: true, min: 0, max: 8 }),
    blocksMovement: t.bool({ required: true }),
    blocksProjectiles: t.bool({ required: true }),
    /** Low cover blocks ground shots but not flying entities (ENV-007). */
    blocksFlying: t.bool({ required: true }),
    blocksLineOfSight: t.bool({ required: true }),
  }, { required: true }),
  health: t.number({ min: 0, max: 400 }),
  requiresBlast: t.bool({ required: true }),
  lootTable: t.ref('objectLootTable'),
  /** Destruction/interaction side effects, e.g. spill, shock, spawn enemy. */
  onDestroy: t.array(t.object({
    hook: t.string({ required: true }),
    params: t.any(),
    chance: t.number({ min: 0, max: 1 }),
  }), { required: true }),
  onInteract: t.object({
    hook: t.string({ required: true }),
    cost: t.object({
      credits: t.int({ min: 0, max: 60 }),
      accessCards: t.int({ min: 0, max: 4 }),
      health: t.int({ min: 0, max: 8 }),
    }),
    params: t.any(),
  }),
  variants: t.array(t.object({
    id: t.string({ required: true }),
    label: t.string({ required: true }),
    paletteSwap: t.map(t.string()),
    overrides: t.any(),
  }), { required: true }),
  /** R-ENV-006: chain reactions must terminate. */
  chainReaction: t.object({
    propagates: t.array(t.enum(['WATER', 'SHOCK', 'FIRE', 'BLAST', 'FOAM']), { required: true }),
    maxDepth: t.int({ required: true, min: 1, max: 6 }),
  }),
  /** R-ENV-005: must not resemble a hostile entity at combat scale. */
  readabilityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.envObject,
  invariants: [
    (def, issues, label) => {
      const destructible = def.objectClass.startsWith('DESTRUCTIBLE');
      if (destructible && !(def.health > 0)) {
        issues.error(`${label}.health`, 'destructible objects need health > 0');
      }
      if (def.objectClass === 'INDESTRUCTIBLE' && def.health) {
        issues.error(`${label}.health`, 'indestructible objects must not declare health');
      }
      if (def.objectClass === 'DECORATION' && (def.collision?.blocksMovement || def.collision?.blocksProjectiles)) {
        issues.error(`${label}.collision`, 'decoration must not block movement or projectiles (GDD 13.2)');
      }
      if (def.objectClass === 'INTERACTIVE' && !def.onInteract) {
        issues.error(`${label}.onInteract`, 'interactive objects require an interaction hook');
      }
    },
  ],
});

export const hazardSchema = new Schema('hazard', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  family: t.enum(TAGS.hazardFamily, { required: true }),
  spriteId: t.string({ required: true }),
  /** R-ENV-002: mechanical zones are visually distinct from decorative decals. */
  mechanical: t.bool({ required: true }),
  /** Damage in half-units; 0 for pure movement hazards. */
  damage: t.int({ required: true, min: 0, max: 4 }),
  damageTags: t.array(t.enum(DAMAGE_TAG), { required: true }),
  statusApplied: t.array(t.object({
    status: t.enum(STATUS, { required: true }),
    chance: t.number({ required: true, min: 0, max: 1 }),
    seconds: t.number({ required: true, min: 0.1, max: 20 }),
    magnitude: t.number({ min: 0, max: 4 }),
  }), { required: true }),
  cycle: t.object({
    mode: t.enum(['ALWAYS_ON', 'TIMED', 'TRIGGERED', 'SWEEP', 'POWERED'], { required: true }),
    warningSeconds: t.number({ required: true, min: 0.2, max: 4 }),
    activeSeconds: t.number({ min: 0.1, max: 20 }),
    idleSeconds: t.number({ min: 0.1, max: 20 }),
  }, { required: true }),
  affects: t.array(t.enum([...Object.values(ALLEGIANCE), 'MOVABLE_OBJECT']), { required: true, minItems: 1 }),
  disableable: t.bool({ required: true }),
  outlineFamily: t.enum(['HAZARD', 'ENVIRONMENT', 'HOSTILE'], { required: true }),
  readabilityNote: t.string({ required: true, minLength: 8 }),
}, {
  idPattern: ID.hazard,
  invariants: [
    (def, issues, label) => {
      if (def.damage > 0 && def.cycle?.warningSeconds < 0.2) {
        issues.error(`${label}.cycle.warningSeconds`, 'damaging hazards need a >=0.2s warning (R-CMB-002)');
      }
      if (!def.mechanical && (def.damage > 0 || def.statusApplied.length > 0)) {
        issues.error(`${label}.mechanical`, 'decorative hazard must not deal damage or status (R-ENV-002)');
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Loot pools and object loot tables (GDD 8.3, 8.4, 13.4, G.7)
// ---------------------------------------------------------------------------

export const lootPoolSchema = new Schema('lootPool', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  pool: t.enum(POOL, { required: true }),
  identity: t.string({ required: true, minLength: 8 }),
  entries: t.array(t.object({
    contentId: t.string({ required: true }),
    contentKind: t.enum(['weapon', 'passive', 'active', 'charm', 'card', 'supplement'], { required: true }),
    baseWeight: t.number({ required: true, min: 0, max: 100 }),
    minFloor: t.int({ required: true, min: 1 }),
    maxFloor: t.int({ min: 1 }),
    quality: t.int({ required: true, min: 0, max: 4 }),
    requiredUnlock: t.ref('unlock'),
    sourceTagsAny: t.array(t.enum(['PEDESTAL', 'SHOP', 'CONTAINER', 'BOSS', 'MACHINE', 'EVENT']), { required: true }),
    seenDecay: t.number({ required: true, min: 0, max: 1 }),
    earlyJackpotEligible: t.bool(),
    departmentAffinityTag: itemTag,
  }), { required: true, minItems: 1 }),
  /** Quality gate override; null uses the global depth table (GDD 8.4). */
  qualityGateOverride: t.map(t.int({ min: 0, max: 4 })),
}, {
  idPattern: ID.lootPool,
  invariants: [
    (def, issues, label) => {
      // R-QA-005: no zero-weight required pools.
      const total = (def.entries || []).reduce((sum, e) => sum + e.baseWeight, 0);
      if (total <= 0) issues.error(`${label}.entries`, 'pool total weight is zero (R-QA-005)');
      const seen = new Set();
      for (const e of def.entries || []) {
        if (seen.has(e.contentId)) issues.error(`${label}.entries`, `duplicate content ${e.contentId}`);
        seen.add(e.contentId);
      }
    },
  ],
});

export const objectLootTableSchema = new Schema('objectLootTable', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  /** GDD 13.4 outcome bands. Weights are relative, not percentages. */
  outcomes: t.array(t.object({
    band: t.enum(['NOTHING', 'MINOR_PICKUP', 'HAZARD', 'HOSTILE_SURPRISE', 'MACHINE_EVENT', 'PREMIUM', 'PEDESTAL_ITEM'], { required: true }),
    weight: t.number({ required: true, min: 0, max: 100 }),
    payload: t.any(),
    /** Optional gate on department, depth, variant, or luck. */
    conditions: t.object({
      minDepth: t.int({ min: 1 }),
      maxDepth: t.int({ min: 1 }),
      departmentTags: t.array(departmentTag),
      variant: t.string(),
      minLuck: t.number(),
    }),
  }), { required: true, minItems: 1 }),
}, {
  idPattern: ID.objectLootTable,
  invariants: [
    (def, issues, label) => {
      // GDD 13.4: pedestal items are normally zero for ordinary objects.
      const total = (def.outcomes || []).reduce((s, o) => s + o.weight, 0);
      const pedestal = (def.outcomes || []).filter((o) => o.band === 'PEDESTAL_ITEM')
        .reduce((s, o) => s + o.weight, 0);
      if (total > 0 && pedestal / total > 0.01) {
        issues.error(`${label}.outcomes`, 'PEDESTAL_ITEM exceeds 1% of table weight (GDD 13.4)');
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Unlocks, endings, profiles, challenges (GDD 16, G.8)
// ---------------------------------------------------------------------------

export const unlockSchema = new Schema('unlock', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  /** R-PRG-003: major hidden continuations use no banner. */
  hidden: t.bool({ required: true }),
  family: t.enum([
    'BOSS_DEFEAT', 'REPEATED_VICTORY', 'RUN_FEAT', 'DISCOVERY', 'COMBINATION',
    'CHALLENGE_COMPLETION', 'EMPLOYEE_COMPLETION',
  ], { required: true }),
  trigger: t.object({
    event: t.string({ required: true }),
    bossId: t.ref('boss'),
    params: t.any(),
  }, { required: true }),
  condition: t.object({
    counter: t.string(),
    comparison: t.enum(['EQUAL', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL']),
    value: t.number(),
    hook: t.string(),
    params: t.any(),
  }),
  actions: t.array(t.object({
    type: t.enum([
      'SET_FLAG', 'RECORD_ENDING', 'TRANSITION_ROUTE', 'ADD_TO_POOL',
      'UNLOCK_PROFILE', 'UNLOCK_CHALLENGE', 'INCREMENT_COUNTER', 'REVEAL_COLLECTION',
    ], { required: true }),
    value: t.any(),
  }), { required: true, minItems: 1 }),
  announcement: t.enum(['NONE', 'BANNER', 'RESULTS_ONLY'], { required: true }),
  idempotent: t.bool({ required: true }),
  descriptionLoc: locKey,
}, {
  idPattern: ID.unlock,
  invariants: [
    (def, issues, label) => {
      if (!def.idempotent) {
        issues.error(`${label}.idempotent`, 'unlocks must be idempotent (R-PRG-005)');
      }
      if (def.hidden && def.announcement !== 'NONE') {
        issues.error(`${label}.announcement`, 'hidden unlocks must not announce (R-PRG-003)');
      }
    },
  ],
});

export const endingSchema = new Schema('ending', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  conditionLoc: locKey,
  /** Sequence of presentation beats. Data-driven so no ending is hardcoded. */
  beats: t.array(t.object({
    kind: t.enum(['TEXT', 'SCENE', 'CREDITS', 'CREDITS_INTERRUPT', 'ELEVATOR', 'FADE'], { required: true }),
    textLoc: t.string(),
    seconds: t.number({ min: 0.2, max: 30 }),
    params: t.any(),
  }), { required: true, minItems: 1 }),
  terminal: t.bool({ required: true }),
  hidden: t.bool({ required: true }),
}, { idPattern: ID.ending });

export const profileSchema = new Schema('profile', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  identityLoc: locKey,
  spriteId: t.string({ required: true }),
  unlockId: t.ref('unlock'),
  starting: t.object({
    weapon: t.ref('weapon', { required: true }),
    composureContainers: t.int({ required: true, min: 1, max: 12 }),
    caffeineIcons: t.int({ required: true, min: 0, max: 6 }),
    spiteIcons: t.int({ required: true, min: 0, max: 6 }),
    passives: t.array(t.ref('passive'), { required: true }),
    active: t.ref('active'),
    charm: t.ref('charm'),
    card: t.ref('card'),
    /** Random selection from a tag, resolved by RUN_ROUTE (GDD PRF-003). */
    randomCharmTag: itemTag,
    statOverrides: t.object({
      moveSpeed: t.number({ min: 1.2, max: 16 }),
      damage: t.number({ min: 1, max: 200 }),
      attackInterval: t.number({ min: 0.05, max: 4 }),
      luck: t.number({ min: -10, max: 20 }),
      contactResistMul: t.number({ min: 0, max: 3 }),
    }),
    resources: t.object({
      credits: t.int({ min: 0, max: 99 }),
      accessCards: t.int({ min: 0, max: 9 }),
      tonerCharges: t.int({ min: 0, max: 9 }),
    }),
    rules: t.array(t.enum(['NO_FREE_FIRST_SUPPLY', 'REGENERATING_SHIELD', 'STARTS_WITH_DEBT']), { required: true }),
  }, { required: true }),
  isDefault: t.bool({ required: true }),
}, { idPattern: ID.profile });

export const challengeSchema = new Schema('challenge', {
  id: t.string({ required: true }),
  schemaVersion: t.int({ required: true, min: 1 }),
  nameLoc: locKey,
  descriptionLoc: locKey,
  profile: t.ref('profile', { required: true }),
  route: t.ref('route', { required: true }),
  unlockId: t.ref('unlock'),
  /** Reward granted on completion; a specific item entering normal pools. */
  completionUnlock: t.ref('unlock'),
  rules: t.object({
    forcedWeapon: t.ref('weapon'),
    forcedPassives: t.array(t.ref('passive'), { required: true }),
    bannedRoles: t.array(t.enum(ROOM_ROLE), { required: true }),
    firingDirections: t.enum(['CARDINAL', 'HORIZONTAL_ONLY', 'VERTICAL_ONLY', 'EIGHT'], { required: true }),
    startingResources: t.object({
      credits: t.int({ min: 0 }),
      accessCards: t.int({ min: 0 }),
      tonerCharges: t.int({ min: 0 }),
    }),
    /** GDD 16.8: no hidden arbitrary failure conditions. */
    failureConditions: t.array(t.string(), { required: true }),
  }, { required: true }),
  unlocksEnabled: t.bool({ required: true }),
}, {
  idPattern: ID.challenge,
  invariants: [
    (def, issues, label) => {
      for (const cond of def.rules?.failureConditions || []) {
        if (!/death|timer|damage|route|resource/i.test(cond)) {
          issues.warn(`${label}.rules.failureConditions`, `"${cond}" may be an arbitrary hidden condition (GDD 16.8)`);
        }
      }
    },
  ],
});

// ---------------------------------------------------------------------------
// Presentation content
// ---------------------------------------------------------------------------

export const spriteSchema = new Schema('sprite', {
  id: t.string({ required: true }),
  frames: t.array(t.array(t.string({ required: true }), { required: true, minItems: 1 }), { required: true, minItems: 1 }),
  palette: t.map(t.union([t.string(), t.any()])),
  anchor: t.tuple([t.number({ required: true, min: 0, max: 1 }), t.number({ required: true, min: 0, max: 1 })]),
  scale: t.int({ min: 1, max: 8 }),
  frameDurations: t.array(t.number({ min: 0.02, max: 4 })),
  silhouette: t.string(),
}, { idPattern: /^[a-z][a-z0-9_]*$/ });

export const soundSchema = new Schema('sound', {
  id: t.string({ required: true }),
  /** Procedural synthesis recipe: no binary assets in the repository. */
  voice: t.enum(['NOISE', 'SQUARE', 'SAW', 'SINE', 'TRIANGLE', 'FM', 'PLUCK', 'CLICK'], { required: true }),
  frequency: t.number({ min: 20, max: 12000 }),
  frequencyEnd: t.number({ min: 20, max: 12000 }),
  duration: t.number({ required: true, min: 0.01, max: 6 }),
  attack: t.number({ min: 0, max: 2 }),
  decay: t.number({ min: 0, max: 4 }),
  gain: t.number({ required: true, min: 0, max: 1 }),
  filter: t.object({
    type: t.enum(['lowpass', 'highpass', 'bandpass', 'notch'], { required: true }),
    frequency: t.number({ required: true, min: 40, max: 16000 }),
    q: t.number({ min: 0.1, max: 24 }),
  }),
  /** GDD 19.2 mix priority band. Lower ducks later bands, never the reverse. */
  mixPriority: t.int({ required: true, min: 1, max: 6 }),
  /** R-AUD-002: high cadence needs variation and concurrency caps. */
  detuneCents: t.number({ min: 0, max: 400 }),
  maxConcurrent: t.int({ required: true, min: 1, max: 16 }),
  /** R-AUD-003: every audio-only cue needs a caption id. */
  captionLoc: t.string(),
}, { idPattern: ID.sound });

export const musicSchema = new Schema('music', {
  id: t.string({ required: true }),
  nameLoc: locKey,
  bpm: t.int({ required: true, min: 50, max: 200 }),
  key: t.string({ required: true }),
  scale: t.array(t.int({ required: true, min: 0, max: 24 }), { required: true, minItems: 4 }),
  layers: t.array(t.object({
    role: t.enum(['BASS', 'PERCUSSION', 'PAD', 'LEAD', 'TEXTURE', 'BOSS'], { required: true }),
    voice: t.enum(['NOISE', 'SQUARE', 'SAW', 'SINE', 'TRIANGLE', 'FM', 'PLUCK', 'CLICK'], { required: true }),
    pattern: t.array(t.int({ min: -1, max: 48 }), { required: true, minItems: 4 }),
    gain: t.number({ required: true, min: 0, max: 1 }),
    octave: t.int({ required: true, min: -2, max: 3 }),
    /** Layers gate in as the run escalates (GDD 19.3). */
    activeFrom: t.enum(['ALWAYS', 'COMBAT', 'BOSS', 'LOW_HEALTH'], { required: true }),
  }), { required: true, minItems: 2 }),
  ambienceLoc: t.string(),
}, { idPattern: ID.music });

export const localizationSchema = new Schema('localization', {
  id: t.string({ required: true }),
  language: t.string({ required: true }),
  strings: t.map(t.string({ required: true }), { required: true }),
}, { idPattern: /^loc-[a-z]{2}(-[A-Z]{2})?$/ });

/** Register every schema onto a registry instance. */
export function installSchemas(registry) {
  registry
    .defineSchema('weapon', weaponSchema)
    .defineSchema('passive', passiveSchema)
    .defineSchema('active', activeSchema)
    .defineSchema('card', cardSchema)
    .defineSchema('supplement', supplementSchema)
    .defineSchema('charm', charmSchema)
    .defineSchema('transformation', transformationSchema)
    .defineSchema('enemy', enemySchema)
    .defineSchema('enemyVariant', enemyVariantSchema)
    .defineSchema('boss', bossSchema)
    .defineSchema('encounter', encounterSchema)
    .defineSchema('department', departmentSchema)
    .defineSchema('floor', floorSchema)
    .defineSchema('route', routeSchema)
    .defineSchema('roomTemplate', roomTemplateSchema)
    .defineSchema('envObject', envObjectSchema)
    .defineSchema('hazard', hazardSchema)
    .defineSchema('lootPool', lootPoolSchema)
    .defineSchema('objectLootTable', objectLootTableSchema)
    .defineSchema('unlock', unlockSchema)
    .defineSchema('ending', endingSchema)
    .defineSchema('profile', profileSchema)
    .defineSchema('challenge', challengeSchema)
    .defineSchema('sprite', spriteSchema)
    .defineSchema('sound', soundSchema)
    .defineSchema('music', musicSchema)
    .defineSchema('localization', localizationSchema);
  return registry;
}

export { ID as ID_PATTERNS };
