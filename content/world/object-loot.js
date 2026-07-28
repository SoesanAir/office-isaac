/**
 * OLT-* object outcome tables. GDD 13.4.
 *
 * Content kind: objectLootTable. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * GDD refs: 13.1 (office-rock principle and the exploration rule), 13.4 (outcome
 *           bands), 8.3/8.4 (pools and quality gates), R-ENV-003 (object-scoped
 *           RNG), R-QA-005 (no zero-weight required tables).
 *
 * Authoring conventions used throughout this file:
 *
 * - **Every table sums to exactly 100**, so a weight reads directly as a percent
 *   and a reviewer can check the §13.4 bands by eye instead of doing arithmetic.
 *   The schema caps a single weight at 100, so this is also the largest total
 *   that keeps every band expressible in one entry.
 * - §13.4 bands, enforced by hand on every table below:
 *     NOTHING 65-82 | MINOR_PICKUP 12-25 | HAZARD + HOSTILE_SURPRISE 2-8
 *     MACHINE_EVENT 0-5 | PREMIUM < 1 | PEDESTAL_ITEM normally 0
 *   `tests/` should assert this; until then the comment above each table states
 *   its band totals so a diff that breaks one is obvious in review.
 * - §13.1's exploration rule is the reason NOTHING never drops below 65 even for
 *   paid containers: breaking everything must stay a *choice*, not the optimum.
 *   Where a paid interaction needs to feel worth paying for (ENV-018), the
 *   guarantee lives in the interaction hook's `guaranteedRewards`, and this table
 *   only rolls the bonus on top. That keeps the reward curve generous without
 *   inflating the table's MINOR_PICKUP band past 25.
 * - PEDESTAL_ITEM appears in exactly one table, OLT-PREMIUM_TROPHY, at 0.6% —
 *   §13.4 "normally zero; only explicit rare variants may roll it", and it is
 *   further gated to ENV020_AWARD_WALL and depth 4+.
 * - Id note: the schema id pattern is `OLT-[A-Z0-9_]+`, so exactly one hyphen is
 *   allowed. Multi-word names use underscores (`OLT-ENEMY_COMMON`).
 * - Payloads are behaviour-free data bags. Hostile surprises name a *role*, not
 *   an enemy id, so this file has no dangling reference into enemy content and an
 *   encounter author stays free to pick the actual mimic per department.
 */

const objectLootTables = [
  // -- ENV-001 Filing Cabinet ------------------------------------------------
  // Bands: NOTHING 74 | MINOR 21 | HAZ+HOSTILE 4.5 | MACHINE 0 | PREMIUM 0.5
  // The reference table. Every other object is described as "more or less
  // generous than the cabinet".
  {
    id: 'OLT-CABINET',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 74, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 12, payload: { kind: 'CREDITS', count: [1, 4] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'TONER_CHARGE', count: [1, 1] } },
      { band: 'MINOR_PICKUP', weight: 3, payload: { kind: 'HALF_COMPOSURE', count: [1, 1] } },
      {
        band: 'MINOR_PICKUP',
        weight: 2,
        payload: { kind: 'ACCESS_CARD', count: [1, 1] },
        conditions: { minDepth: 2 },
      },
      { band: 'HAZARD', weight: 1.5, payload: { kind: 'HAZARD', hazardId: 'HAZ-MACHINE_TONER_CLOUD' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 3,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'CABINET_MIMIC', count: 1 },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-002 Water Cooler --------------------------------------------------
  // Bands: NOTHING 78 | MINOR 14 | HAZ+HOSTILE 6 | MACHINE 1.5 | PREMIUM 0.5
  // Stingy on contents because the spill it leaves behind is the real payload.
  {
    id: 'OLT-COOLER',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 78, payload: { kind: 'DEBRIS_ONLY' } },
      // §13.3: "Rarely contains a Caffeine pickup because office logic has
      // already left the building."
      { band: 'MINOR_PICKUP', weight: 8, payload: { kind: 'CAFFEINE', count: [1, 1] } },
      { band: 'MINOR_PICKUP', weight: 6, payload: { kind: 'CREDITS', count: [1, 3] } },
      { band: 'HAZARD', weight: 5, payload: { kind: 'HAZARD', hazardId: 'HAZ-SPILL_WATER_SLICK', radiusBonus: 0.8 } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 1,
        payload: { kind: 'HOSTILE', hook: 'RELEASE_BUG_SWARM', role: 'DRAIN_SWARM', count: 3 },
      },
      { band: 'MACHINE_EVENT', weight: 1.5, payload: { kind: 'MACHINE_EVENT', hook: 'SPAWN_WATER_SPILL', floodLane: true } },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-003 Printer -------------------------------------------------------
  // Bands: NOTHING 70 | MINOR 18 | HAZ+HOSTILE 7 | MACHINE 4.5 | PREMIUM 0.5
  // A machine, so it carries the fullest MACHINE_EVENT band in the file.
  {
    id: 'OLT-PRINTER',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 70, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 9, payload: { kind: 'TONER_CHARGE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 7, payload: { kind: 'CREDITS', count: [1, 4] } },
      { band: 'MINOR_PICKUP', weight: 2, payload: { kind: 'HALF_COMPOSURE', count: [1, 1] } },
      { band: 'HAZARD', weight: 3, payload: { kind: 'HAZARD', hazardId: 'HAZ-MACHINE_TONER_CLOUD' } },
      // §13.3: "or a Printer Beast variant when destroyed".
      {
        band: 'HOSTILE_SURPRISE',
        weight: 4,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_PRINTER_BEAST', role: 'MACHINE_BEAST', count: 1 },
      },
      { band: 'MACHINE_EVENT', weight: 4.5, payload: { kind: 'MACHINE_EVENT', hook: 'JAM_MACHINE', reprintsPickup: true } },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'TONER_CACHE' } },
    ],
  },

  // -- ENV-004 Recycling Bin -------------------------------------------------
  // Bands: NOTHING 80 | MINOR 15 | HAZ+HOSTILE 4 | MACHINE 0.8 | PREMIUM 0.2
  // §13.3: "Easy to break, low-value contents." Cheapest table in the file.
  {
    id: 'OLT-BIN',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 80, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 10, payload: { kind: 'CREDITS', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 5, payload: { kind: 'PAPER_SCRAP', count: [1, 1] } },
      { band: 'HAZARD', weight: 2, payload: { kind: 'HAZARD', hazardId: 'HAZ-PAPER_DRIFT_BANK' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 2,
        payload: { kind: 'HOSTILE', hook: 'RELEASE_BUG_SWARM', role: 'PAPER_SWARM', count: 2 },
      },
      { band: 'MACHINE_EVENT', weight: 0.8, payload: { kind: 'MACHINE_EVENT', hook: 'LAUNCH_PAPER_DEBRIS', chainNearby: true } },
      { band: 'PREMIUM', weight: 0.2, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-005 Vending Machine ----------------------------------------------
  // Bands: NOTHING 67.2 | MINOR 22 | HAZ+HOSTILE 5 | MACHINE 5 | PREMIUM 0.8
  // This is the *destruction* table. Paid vending odds live in ENV-005's
  // onInteract params and are deliberately much kinder than these.
  {
    id: 'OLT-VENDING',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 67.2, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 12, payload: { kind: 'SNACK_HEALTH', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 7, payload: { kind: 'CREDITS', count: [2, 6] } },
      { band: 'MINOR_PICKUP', weight: 3, payload: { kind: 'CAFFEINE', count: [1, 1] } },
      { band: 'HAZARD', weight: 2, payload: { kind: 'HAZARD', hazardId: 'HAZ-GLASS_SHARD_FIELD' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 3,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'MACHINE_MIMIC', count: 1 },
      },
      // §13.3: "very rarely reveal a passage or enemy".
      {
        band: 'MACHINE_EVENT',
        weight: 5,
        payload: { kind: 'MACHINE_EVENT', hook: 'REVEAL_HIDDEN_PASSAGE', neverGatesProgress: true },
      },
      { band: 'PREMIUM', weight: 0.8, payload: { kind: 'PREMIUM_PICKUP', pickup: 'SUPPLEMENT_CRATE' } },
    ],
  },

  // -- ENV-006 Office Plant --------------------------------------------------
  // Bands: NOTHING 79 | MINOR 14 | HAZ+HOSTILE 6.5 | MACHINE 0 | PREMIUM 0.5
  // §13.3: "Usually empty; may conceal health, a bug swarm, or a story item."
  {
    id: 'OLT-PLANT',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 79, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 8, payload: { kind: 'HALF_COMPOSURE', count: [1, 1] } },
      { band: 'MINOR_PICKUP', weight: 6, payload: { kind: 'STORY_TRINKET', count: [1, 1] } },
      { band: 'HAZARD', weight: 1.5, payload: { kind: 'HAZARD', hazardId: 'HAZ-PAPER_DRIFT_BANK' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 5,
        payload: { kind: 'HOSTILE', hook: 'RELEASE_BUG_SWARM', role: 'PLANT_SWARM', count: 3 },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-007 Cubicle Divider ----------------------------------------------
  // Bands: NOTHING 82 | MINOR 13 | HAZ+HOSTILE 4.5 | MACHINE 0 | PREMIUM 0.5
  // Sits at the top of the NOTHING band on purpose: dividers are placed in bulk,
  // so a generous table here would make clearing walls mandatory (§13.1).
  {
    id: 'OLT-DIVIDER',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 82, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 9, payload: { kind: 'CREDITS', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'PAPER_SCRAP', count: [1, 1] } },
      { band: 'HAZARD', weight: 1, payload: { kind: 'HAZARD', hazardId: 'HAZ-PAPER_DRIFT_BANK' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 3.5,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'CUBICLE_LURKER', count: 1 },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-008 Desk ----------------------------------------------------------
  // Bands: NOTHING 71 | MINOR 23 | HAZ+HOSTILE 5.2 | MACHINE 0 | PREMIUM 0.8
  // Desks are expensive to break (48 half-units), so the drawers pay near the
  // top of the MINOR band. Effort, not luck, is what is being rewarded.
  {
    id: 'OLT-DESK',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 71, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 10, payload: { kind: 'CREDITS', count: [2, 5] } },
      { band: 'MINOR_PICKUP', weight: 5, payload: { kind: 'TONER_CHARGE', count: [1, 1] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'HALF_COMPOSURE', count: [1, 1] } },
      {
        band: 'MINOR_PICKUP',
        weight: 4,
        payload: { kind: 'ACCESS_CARD', count: [1, 1] },
        conditions: { minDepth: 2 },
      },
      { band: 'HAZARD', weight: 2, payload: { kind: 'HAZARD', hazardId: 'HAZ-ELEC_FLOOR_ARC' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 3.2,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'DESK_LURKER', count: 1 },
      },
      { band: 'PREMIUM', weight: 0.8, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-009 Rolling Chair -------------------------------------------------
  // Bands: NOTHING 81 | MINOR 14 | HAZ+HOSTILE 4.5 | MACHINE 0 | PREMIUM 0.5
  // A chair is worth more as a pushable weapon than as a container.
  {
    id: 'OLT-CHAIR',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 81, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 10, payload: { kind: 'CREDITS', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'STORY_TRINKET', count: [1, 1] } },
      { band: 'HAZARD', weight: 1, payload: { kind: 'HAZARD', hazardId: 'HAZ-CABLE_TRIP_BUNDLE' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 3.5,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'CHAIR_MIMIC', count: 1 },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-012 Glass Partition ----------------------------------------------
  // Bands: NOTHING 80 | MINOR 12 | HAZ+HOSTILE 7.5 | MACHINE 0 | PREMIUM 0.5
  // MINOR sits at the band floor and HAZARD near the ceiling: breaking a wall is
  // a navigation decision that costs you a shard field, not a loot decision.
  {
    id: 'OLT-GLASS',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 80, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 8, payload: { kind: 'CREDITS', count: [1, 3] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'PAPER_SCRAP', count: [1, 1] } },
      { band: 'HAZARD', weight: 6, payload: { kind: 'HAZARD', hazardId: 'HAZ-GLASS_SHARD_FIELD', radiusBonus: 0.6 } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 1.5,
        payload: { kind: 'HOSTILE', hook: 'SUMMON_SECURITY_RESPONSE', role: 'SECURITY_PATROL', count: 1 },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-013 Archive Shelf -------------------------------------------------
  // Bands: NOTHING 72.1 | MINOR 20 | HAZ+HOSTILE 7 | MACHINE 0 | PREMIUM 0.9
  {
    id: 'OLT-SHELF',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 72.1, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 9, payload: { kind: 'CREDITS', count: [2, 5] } },
      { band: 'MINOR_PICKUP', weight: 5, payload: { kind: 'TONER_CHARGE', count: [1, 1] } },
      {
        band: 'MINOR_PICKUP',
        weight: 4,
        payload: { kind: 'ACCESS_CARD', count: [1, 1] },
        conditions: { minDepth: 3 },
      },
      { band: 'MINOR_PICKUP', weight: 2, payload: { kind: 'HALF_COMPOSURE', count: [1, 1] } },
      { band: 'HAZARD', weight: 3, payload: { kind: 'HAZARD', hazardId: 'HAZ-PAPER_DRIFT_BANK', radiusBonus: 1 } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 4,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'ARCHIVE_LURKER', count: 2 },
      },
      { band: 'PREMIUM', weight: 0.9, payload: { kind: 'PREMIUM_CONTAINER', container: 'ENV-018' } },
    ],
  },

  // -- ENV-014 Whiteboard ---------------------------------------------------
  // Bands: NOTHING 76 | MINOR 15 | HAZ+HOSTILE 4 | MACHINE 4.5 | PREMIUM 0.5
  // The MACHINE_EVENT band here is the information payoff (a clue), never a key:
  // §13.3 says a whiteboard is "never required for normal progression".
  {
    id: 'OLT-WHITEBOARD',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 76, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 9, payload: { kind: 'CREDITS', count: [1, 3] } },
      { band: 'MINOR_PICKUP', weight: 6, payload: { kind: 'PAPER_SCRAP', count: [1, 2] } },
      { band: 'HAZARD', weight: 3, payload: { kind: 'HAZARD', hazardId: 'HAZ-MACHINE_TONER_CLOUD' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 1,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'MEETING_LURKER', count: 1 },
      },
      {
        band: 'MACHINE_EVENT',
        weight: 4.5,
        payload: { kind: 'MACHINE_EVENT', hook: 'REVEAL_WHITEBOARD_CLUE', neverGatesProgress: true },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- ENV-015 Coffee Machine -----------------------------------------------
  // Bands: NOTHING 68 | MINOR 20 | HAZ+HOSTILE 7 | MACHINE 4.5 | PREMIUM 0.5
  {
    id: 'OLT-COFFEE_MACHINE',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 68, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 12, payload: { kind: 'CAFFEINE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 8, payload: { kind: 'CREDITS', count: [1, 4] } },
      { band: 'HAZARD', weight: 4, payload: { kind: 'HAZARD', hazardId: 'HAZ-SPILL_COFFEE_SCALD' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 3,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'BREAKROOM_MIMIC', count: 1 },
        conditions: { departmentTags: ['IT', 'OPERATIONS', 'EXECUTIVE', 'RND'] },
      },
      { band: 'MACHINE_EVENT', weight: 4.5, payload: { kind: 'MACHINE_EVENT', hook: 'JAM_MACHINE', ventsSteam: true } },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'SUPPLEMENT_CRATE' } },
    ],
  },

  // -- ENV-017 Supply Cart ---------------------------------------------------
  // Bands: NOTHING 66.2 | MINOR 25 | HAZ+HOSTILE 8 | MACHINE 0 | PREMIUM 0.8
  // Both the MINOR ceiling and the HAZ+HOSTILE ceiling. A cart is a bet: it is
  // the most generous ordinary object and also the most likely to bite.
  {
    id: 'OLT-CART',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 66.2, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 10, payload: { kind: 'CREDITS', count: [2, 6] } },
      { band: 'MINOR_PICKUP', weight: 6, payload: { kind: 'TONER_CHARGE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 5, payload: { kind: 'HALF_COMPOSURE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'ACCESS_CARD', count: [1, 1] } },
      { band: 'HAZARD', weight: 2, payload: { kind: 'HAZARD', hazardId: 'HAZ-GLASS_SHARD_FIELD' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 6,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'CART_MIMIC', count: 1 },
      },
      { band: 'PREMIUM', weight: 0.8, payload: { kind: 'PREMIUM_PICKUP', pickup: 'SUPPLEMENT_CRATE' } },
    ],
  },

  // -- ENV-018 Locked Cabinet ------------------------------------------------
  // Bands: NOTHING 65.1 | MINOR 25 | HAZ+HOSTILE 6 | MACHINE 3 | PREMIUM 0.9
  // Both bands are pushed to their generous edge (NOTHING at the 65 floor, MINOR
  // at the 25 ceiling). The Access Card is still repaid by UNLOCK_CABINET's
  // `guaranteedRewards`; this table is the bonus roll on top, which is how a paid
  // container feels fair without breaking §13.4.
  {
    id: 'OLT-CABINET_LOCKED',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 65.1, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 10, payload: { kind: 'CREDITS', count: [4, 9] } },
      { band: 'MINOR_PICKUP', weight: 6, payload: { kind: 'TONER_CHARGE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 5, payload: { kind: 'HALF_COMPOSURE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'ACCESS_CARD', count: [1, 1] } },
      { band: 'HAZARD', weight: 2, payload: { kind: 'HAZARD', hazardId: 'HAZ-MACHINE_TONER_CLOUD' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 4,
        payload: { kind: 'HOSTILE', hook: 'SPAWN_DISGUISED_ENEMY', role: 'RECORDS_MIMIC', count: 1 },
      },
      {
        band: 'MACHINE_EVENT',
        weight: 3,
        payload: { kind: 'MACHINE_EVENT', hook: 'REVEAL_HIDDEN_PASSAGE', neverGatesProgress: true },
        conditions: { minDepth: 3 },
      },
      { band: 'PREMIUM', weight: 0.9, payload: { kind: 'PREMIUM_PICKUP', pickup: 'SUPPLEMENT_CRATE' } },
    ],
  },

  // -- ENV-020 Trophy Case ---------------------------------------------------
  // Bands: NOTHING 65.5 | MINOR 21 | HAZ+HOSTILE 8 | MACHINE 4 | PREMIUM 0.9
  //        PEDESTAL_ITEM 0.6  <-- the only PEDESTAL_ITEM entry in the game
  // §13.4 allows a pedestal roll only for "explicit rare variants", so the entry
  // is gated to ENV020_AWARD_WALL and depth 4+, and it sits under the 1% cap the
  // schema enforces. The HAZ+HOSTILE ceiling is the price of a premium table.
  {
    id: 'OLT-PREMIUM_TROPHY',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 65.5, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 12, payload: { kind: 'CREDITS', count: [4, 10] } },
      { band: 'MINOR_PICKUP', weight: 5, payload: { kind: 'HALF_COMPOSURE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'ACCESS_CARD', count: [1, 1] } },
      { band: 'HAZARD', weight: 5, payload: { kind: 'HAZARD', hazardId: 'HAZ-GLASS_SHARD_FIELD', radiusBonus: 0.8 } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 3,
        payload: { kind: 'HOSTILE', hook: 'SUMMON_SECURITY_RESPONSE', role: 'SECURITY_PATROL', count: 2 },
      },
      {
        band: 'MACHINE_EVENT',
        weight: 4,
        payload: { kind: 'MACHINE_EVENT', hook: 'TRIGGER_SECURITY_ALARM', respectsSafePath: true },
      },
      { band: 'PREMIUM', weight: 0.9, payload: { kind: 'PREMIUM_CONTAINER', container: 'ENV-018' } },
      {
        band: 'PEDESTAL_ITEM',
        weight: 0.6,
        payload: { kind: 'PEDESTAL_ITEM', pool: 'RESTRICTED_RECORDS' },
        conditions: { variant: 'ENV020_AWARD_WALL', minDepth: 4 },
      },
    ],
  },

  // -- ENV-022 Paper Pile ----------------------------------------------------
  // Bands: NOTHING 77 | MINOR 16 | HAZ+HOSTILE 6.5 | MACHINE 0 | PREMIUM 0.5
  // §13.3: "may hide a tiny pickup, Toner Charge, or swarm".
  {
    id: 'OLT-PAPER_PILE',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 77, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 8, payload: { kind: 'CREDITS', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 6, payload: { kind: 'TONER_CHARGE', count: [1, 1] } },
      { band: 'MINOR_PICKUP', weight: 2, payload: { kind: 'PAPER_SCRAP', count: [1, 2] } },
      { band: 'HAZARD', weight: 2, payload: { kind: 'HAZARD', hazardId: 'HAZ-FIRE_PAPER_BLAZE' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 4.5,
        payload: { kind: 'HOSTILE', hook: 'RELEASE_BUG_SWARM', role: 'PAPER_SWARM', count: 3 },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // =========================================================================
  // Shared tables
  // =========================================================================

  // -- Common enemy drops ----------------------------------------------------
  // Bands: NOTHING 82 | MINOR 15 | HAZ+HOSTILE 2.5 | MACHINE 0 | PREMIUM 0.5
  // Referenced by enemy content as OLT-ENEMY_COMMON. Sits at the NOTHING ceiling
  // because a room clear already pays out; per-kill drops are the garnish.
  {
    id: 'OLT-ENEMY_COMMON',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 82, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 10, payload: { kind: 'CREDITS', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 3, payload: { kind: 'HALF_COMPOSURE', count: [1, 1] } },
      { band: 'MINOR_PICKUP', weight: 2, payload: { kind: 'TONER_CHARGE', count: [1, 1] } },
      { band: 'HAZARD', weight: 1.5, payload: { kind: 'HAZARD', hazardId: 'HAZ-SPILL_WATER_SLICK' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 1,
        payload: { kind: 'HOSTILE', hook: 'RELEASE_BUG_SWARM', role: 'SPLIT_REMNANT', count: 2 },
      },
      { band: 'PREMIUM', weight: 0.5, payload: { kind: 'PREMIUM_PICKUP', pickup: 'CREDIT_CACHE' } },
    ],
  },

  // -- Elite enemy drops -----------------------------------------------------
  // Bands: NOTHING 66.1 | MINOR 24 | HAZ+HOSTILE 7 | MACHINE 2 | PREMIUM 0.9
  // Referenced by enemy content as OLT-ENEMY_ELITE.
  {
    id: 'OLT-ENEMY_ELITE',
    schemaVersion: 1,
    outcomes: [
      { band: 'NOTHING', weight: 66.1, payload: { kind: 'DEBRIS_ONLY' } },
      { band: 'MINOR_PICKUP', weight: 12, payload: { kind: 'CREDITS', count: [3, 8] } },
      { band: 'MINOR_PICKUP', weight: 6, payload: { kind: 'HALF_COMPOSURE', count: [1, 2] } },
      { band: 'MINOR_PICKUP', weight: 4, payload: { kind: 'ACCESS_CARD', count: [1, 1] } },
      { band: 'MINOR_PICKUP', weight: 2, payload: { kind: 'TONER_CHARGE', count: [1, 2] } },
      { band: 'HAZARD', weight: 3, payload: { kind: 'HAZARD', hazardId: 'HAZ-ELEC_FLOOR_ARC' } },
      {
        band: 'HOSTILE_SURPRISE',
        weight: 4,
        payload: { kind: 'HOSTILE', hook: 'RELEASE_BUG_SWARM', role: 'SPLIT_REMNANT', count: 3 },
      },
      {
        band: 'MACHINE_EVENT',
        weight: 2,
        payload: { kind: 'MACHINE_EVENT', hook: 'CUT_POWER_LINK', disablesRoomHazards: true },
      },
      { band: 'PREMIUM', weight: 0.9, payload: { kind: 'PREMIUM_CONTAINER', container: 'ENV-018' } },
    ],
  },
];

export default objectLootTables;
