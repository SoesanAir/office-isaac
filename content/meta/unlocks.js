/**
 * Unlocks.
 *
 * GDD refs: 16.1 (meta progression expands the possibility space, never universal
 *           raw power), 16.3 (unlock condition families), 16.4 (repeated CEO
 *           victories), 16.5 (the deeper hidden route), R-PRG-001 (no account-wide
 *           damage level), R-PRG-002 (an unlock enters a pool only once its
 *           condition is met), R-PRG-003 (major hidden continuations do not use
 *           ordinary unlock banners), R-PRG-005 (evaluation is idempotent),
 *           R-QA-007 (fresh-save UI does not reveal undiscovered routes).
 *
 * The rule that shapes this file is R-PRG-003 combined with D-015/D-016. The player
 * is *never told* that CEO victories are counting toward anything. So every unlock
 * on the hidden ladder carries `hidden: true` and `announcement: 'NONE'`, and the
 * schema enforces that pairing — a hidden unlock that announces itself is rejected
 * at load. The tenth CEO victory simply opens a different elevator.
 *
 * Nothing here grants a stat. Every action either adds content to a pool, records
 * an ending, sets a route flag, or unlocks a profile or challenge (R-PRG-001).
 */

/** Terse builder. Every unlock is idempotent, so it is defaulted rather than repeated. */
function unlock(id, spec) {
  return {
    id,
    schemaVersion: 1,
    hidden: spec.hidden ?? false,
    family: spec.family,
    trigger: spec.trigger,
    ...(spec.condition ? { condition: spec.condition } : {}),
    actions: spec.actions,
    announcement: spec.announcement ?? (spec.hidden ? 'NONE' : 'BANNER'),
    idempotent: true,
    descriptionLoc: spec.descriptionLoc,
  };
}

const onBoss = (bossId) => ({ event: 'BOSS_DEFEATED', bossId });
const ceoClears = (n) => ({ counter: 'CEO_CLEAR_COUNT', comparison: 'GREATER_OR_EQUAL', value: n });

const unlocks = [
  // -------------------------------------------------------------------------
  // Alternate departments (GDD 10.5). Referenced by ROUTE-BASE's alternates.
  // -------------------------------------------------------------------------
  unlock('UNLOCK-ALTERNATE_FINANCE', {
    family: 'BOSS_DEFEAT',
    // Beating Operations' clock boss is what earns the right to skip Operations.
    trigger: onBoss('BSS-012'),
    actions: [
      { type: 'SET_FLAG', value: 'ALTERNATE_FINANCE_ENABLED' },
      { type: 'ADD_TO_POOL', value: { pool: 'ROUTE_ALTERNATES', content: 'FLOOR-FINANCE_1' } },
    ],
    descriptionLoc: 'unlock.alternate_finance.description',
  }),
  unlock('UNLOCK-ALTERNATE_MARKETING', {
    family: 'RUN_FEAT',
    trigger: { event: 'RUN_ENDED', params: { reachedDepth: 6, creditsAtLeast: 60 } },
    actions: [
      { type: 'SET_FLAG', value: 'ALTERNATE_MARKETING_ENABLED' },
      { type: 'ADD_TO_POOL', value: { pool: 'ROUTE_ALTERNATES', content: 'FLOOR-MARKETING_1' } },
    ],
    descriptionLoc: 'unlock.alternate_marketing.description',
  }),
  unlock('UNLOCK-ALTERNATE_LEGAL', {
    family: 'BOSS_DEFEAT',
    trigger: onBoss('BSS-014'),
    actions: [
      { type: 'SET_FLAG', value: 'ALTERNATE_LEGAL_ENABLED' },
      { type: 'ADD_TO_POOL', value: { pool: 'ROUTE_ALTERNATES', content: 'FLOOR-LEGAL_1' } },
    ],
    descriptionLoc: 'unlock.alternate_legal.description',
  }),
  unlock('UNLOCK-LEGAL_ESCALATION', {
    family: 'BOSS_DEFEAT',
    // The harder Legal variant is gated behind clearing the easier one, so the
    // difficulty step is always something the player has already seen once.
    trigger: onBoss('BSS-021'),
    actions: [
      { type: 'SET_FLAG', value: 'LEGAL_ESCALATION_ENABLED' },
      { type: 'ADD_TO_POOL', value: { pool: 'ROUTE_ALTERNATES', content: 'FLOOR-LEGAL_2' } },
    ],
    descriptionLoc: 'unlock.legal_escalation.description',
  }),

  // -------------------------------------------------------------------------
  // Repeated CEO victories (GDD 16.4). Every one of these is silent.
  // -------------------------------------------------------------------------
  unlock('UNLOCK-CEO_CLEAR_FIRST', {
    hidden: false,
    family: 'BOSS_DEFEAT',
    trigger: onBoss('BSS-016'),
    condition: ceoClears(1),
    actions: [
      { type: 'INCREMENT_COUNTER', value: 'CEO_CLEAR_COUNT' },
      { type: 'RECORD_ENDING', value: 'END-001' },
      { type: 'ADD_TO_POOL', value: { pool: 'EXECUTIVE_DEAL', content: 'POST_BOSS_OFFERS' } },
    ],
    // The first victory is a real, announced ending. Only the *ladder* is secret.
    announcement: 'RESULTS_ONLY',
    descriptionLoc: 'unlock.ceo_clear_first.description',
  }),
  unlock('UNLOCK-CEO_CLEAR_THREE', {
    hidden: true,
    family: 'REPEATED_VICTORY',
    trigger: onBoss('BSS-016'),
    condition: ceoClears(3),
    actions: [
      { type: 'RECORD_ENDING', value: 'END-002' },
      { type: 'SET_FLAG', value: 'EXECUTIVE_HARD_VARIANTS' },
      { type: 'ADD_TO_POOL', value: { pool: 'BOSS_PATTERNS', content: 'CEO_EXTRA_ATTACKS' } },
    ],
    descriptionLoc: 'unlock.ceo_clear_three.description',
  }),
  unlock('UNLOCK-CEO_CLEAR_FIVE', {
    hidden: true,
    family: 'REPEATED_VICTORY',
    trigger: onBoss('BSS-016'),
    condition: ceoClears(5),
    actions: [
      { type: 'SET_FLAG', value: 'END_003_AVAILABLE' },
      // GDD 16.4: alternate departments gain higher selection weight, they do not
      // become mandatory. Route variety is the reward, not raw power.
      { type: 'SET_FLAG', value: 'ALTERNATE_WEIGHT_BONUS' },
    ],
    descriptionLoc: 'unlock.ceo_clear_five.description',
  }),
  unlock('UNLOCK-CEO_CLEAR_SEVEN', {
    hidden: true,
    family: 'REPEATED_VICTORY',
    trigger: onBoss('BSS-016'),
    condition: ceoClears(7),
    // GDD 16.4 is explicit that clear 7 changes no route: it only permits Board
    // imagery and elevator audio foreshadowing. Atmosphere as a breadcrumb.
    actions: [{ type: 'SET_FLAG', value: 'BOARD_FORESHADOWING' }],
    descriptionLoc: 'unlock.ceo_clear_seven.description',
  }),
  unlock('UNLOCK-BOARD_ROUTE', {
    hidden: true,
    family: 'REPEATED_VICTORY',
    trigger: onBoss('BSS-016'),
    condition: ceoClears(10),
    actions: [
      { type: 'SET_FLAG', value: 'FLAG_CEO_CLEARS_TEN' },
      { type: 'RECORD_ENDING', value: 'END-004' },
      // END-004: credits begin, then stop, and the elevator opens on The Board.
      { type: 'TRANSITION_ROUTE', value: 'ROUTE-BOARD' },
    ],
    descriptionLoc: 'unlock.board_route.description',
  }),

  // -------------------------------------------------------------------------
  // The deeper hidden route (GDD 16.5). Each step gates the next.
  // -------------------------------------------------------------------------
  unlock('UNLOCK-OWNERSHIP_DOCUMENTS', {
    hidden: true,
    family: 'BOSS_DEFEAT',
    trigger: onBoss('BSS-025'),
    actions: [
      { type: 'RECORD_ENDING', value: 'END-005' },
      // Step 1: fragments become findable in secret and alternate routes. They are
      // not granted; the player still has to go looking.
      { type: 'ADD_TO_POOL', value: { pool: 'SECRET_MAINTENANCE', content: 'OWNERSHIP_FRAGMENT' } },
      { type: 'SET_FLAG', value: 'OWNERSHIP_FRAGMENTS_ENABLED' },
    ],
    descriptionLoc: 'unlock.ownership_documents.description',
  }),
  unlock('UNLOCK-PARENT_COMPANY_ROUTE', {
    hidden: true,
    family: 'COMBINATION',
    // Step 2: two distinct fragments in ONE run, after a Board clear.
    trigger: { event: 'ITEM_COLLECTED', params: { tag: 'OWNERSHIP_FRAGMENT' } },
    condition: {
      hook: 'HAS_DISTINCT_FRAGMENTS_THIS_RUN',
      params: { count: 2, requiresFlag: 'OWNERSHIP_FRAGMENTS_ENABLED' },
    },
    actions: [
      { type: 'SET_FLAG', value: 'FLAG_OWNERSHIP_DOCUMENT_FRAGMENTS_TWO' },
      { type: 'TRANSITION_ROUTE', value: 'ROUTE-PARENT_COMPANY' },
    ],
    descriptionLoc: 'unlock.parent_company_route.description',
  }),
  unlock('UNLOCK-HOSTILE_TAKEOVER_ENDING', {
    hidden: true,
    family: 'BOSS_DEFEAT',
    trigger: onBoss('BSS-026'),
    actions: [{ type: 'RECORD_ENDING', value: 'END-006' }],
    descriptionLoc: 'unlock.hostile_takeover.description',
  }),
  unlock('UNLOCK-OWNERSHIP_KEYS', {
    hidden: true,
    family: 'BOSS_DEFEAT',
    trigger: onBoss('BSS-027'),
    actions: [
      { type: 'RECORD_ENDING', value: 'END-007' },
      // Step 3: three key-fragment conditions, one each in Facilities, R&D, and an
      // Executive Deal route. Spreading them across branches is what forces the
      // player to learn the whole building rather than one optimal line.
      { type: 'SET_FLAG', value: 'OWNERSHIP_KEY_FACILITIES_ENABLED' },
      { type: 'SET_FLAG', value: 'OWNERSHIP_KEY_RND_ENABLED' },
      { type: 'SET_FLAG', value: 'OWNERSHIP_KEY_DEAL_ENABLED' },
    ],
    descriptionLoc: 'unlock.ownership_keys.description',
  }),
  unlock('UNLOCK-CONGLOMERATE_ROUTE', {
    hidden: true,
    family: 'COMBINATION',
    // Step 4: all three key fragments assembled in one run.
    trigger: { event: 'ITEM_COLLECTED', params: { tag: 'OWNERSHIP_KEY' } },
    condition: { hook: 'HAS_ALL_OWNERSHIP_KEYS_THIS_RUN', params: { count: 3 } },
    actions: [
      { type: 'SET_FLAG', value: 'FLAG_OWNERSHIP_KEY_FRAGMENTS_THREE' },
      { type: 'TRANSITION_ROUTE', value: 'ROUTE-CONGLOMERATE' },
    ],
    descriptionLoc: 'unlock.conglomerate_route.description',
  }),
  unlock('UNLOCK-OWNERSHIP_ROUTE', {
    hidden: true,
    family: 'BOSS_DEFEAT',
    trigger: onBoss('BSS-028'),
    condition: {
      /**
       * Step 5, the final concealed condition from GDD 16.5: no Executive Deal debt
       * and at least one discovered secret room in every chapter of that run. It is
       * checked by a hook rather than a counter because it spans the whole run and
       * needs the floor history, not a single number.
       */
      hook: 'NO_DEAL_DEBT_AND_SECRET_PER_CHAPTER',
    },
    actions: [
      { type: 'RECORD_ENDING', value: 'END-008' },
      { type: 'SET_FLAG', value: 'FLAG_OWNERSHIP_ELEVATOR_CONDITION' },
      { type: 'TRANSITION_ROUTE', value: 'ROUTE-OWNERSHIP' },
    ],
    descriptionLoc: 'unlock.ownership_route.description',
  }),
  unlock('UNLOCK-BENEFICIAL_OWNERSHIP', {
    hidden: true,
    family: 'BOSS_DEFEAT',
    trigger: onBoss('BSS-029'),
    actions: [
      { type: 'RECORD_ENDING', value: 'END-009' },
      // GDD END-009: completion deliberately does not display a total ending count,
      // so this records the ending and nothing else (R-PRG-004).
      { type: 'REVEAL_COLLECTION', value: 'OWNERSHIP' },
    ],
    descriptionLoc: 'unlock.beneficial_ownership.description',
  }),

  // -------------------------------------------------------------------------
  // Secret branches (GDD 10.5 DPT-008/009)
  // -------------------------------------------------------------------------
  unlock('UNLOCK-FACILITIES_BRANCH', {
    hidden: true,
    family: 'DISCOVERY',
    // Found by using the service elevator, which itself only appears in secret
    // infrastructure. Discovery, not achievement (GDD 2.7).
    trigger: { event: 'ROOM_ENTERED', params: { role: 'ROOM-026' } },
    actions: [
      { type: 'SET_FLAG', value: 'FACILITIES_BRANCH_ENABLED' },
      { type: 'ADD_TO_POOL', value: { pool: 'ROUTE_ALTERNATES', content: 'ROUTE-FACILITIES_BRANCH' } },
    ],
    descriptionLoc: 'unlock.facilities_branch.description',
  }),
  unlock('UNLOCK-RND_BRANCH', {
    hidden: true,
    family: 'DISCOVERY',
    trigger: { event: 'ROOM_ENTERED', params: { role: 'ROOM-017' } },
    actions: [
      { type: 'SET_FLAG', value: 'RND_BRANCH_ENABLED' },
      { type: 'ADD_TO_POOL', value: { pool: 'ROUTE_ALTERNATES', content: 'ROUTE-RND_BRANCH' } },
    ],
    descriptionLoc: 'unlock.rnd_branch.description',
  }),

  // -------------------------------------------------------------------------
  // Employee profiles (GDD 16.6). Conditions come straight from that table.
  // -------------------------------------------------------------------------
  unlock('UNLOCK-PROFILE_INTERN', {
    family: 'RUN_FEAT',
    trigger: { event: 'FLOOR_ENTERED', params: { afterDepth: 2 } },
    condition: { hook: 'CLEARED_CHAPTER_WITHOUT_MANAGER_REWARD', params: { throughDepth: 2 } },
    actions: [{ type: 'UNLOCK_PROFILE', value: 'PRF-002' }],
    descriptionLoc: 'unlock.profile_intern.description',
  }),
  unlock('UNLOCK-PROFILE_IT_SPECIALIST', {
    family: 'EMPLOYEE_COMPLETION',
    trigger: { event: 'BOSS_DEFEATED' },
    condition: { hook: 'ALL_BOSSES_OF_DEPARTMENT_DEFEATED', params: { department: 'IT' } },
    actions: [{ type: 'UNLOCK_PROFILE', value: 'PRF-003' }],
    descriptionLoc: 'unlock.profile_it_specialist.description',
  }),
  unlock('UNLOCK-PROFILE_CONTRACTOR', {
    family: 'RUN_FEAT',
    trigger: { event: 'RUN_ENDED' },
    condition: { hook: 'COMPLETED_RUN_CARRYING_DEBT' },
    actions: [{ type: 'UNLOCK_PROFILE', value: 'PRF-004' }],
    descriptionLoc: 'unlock.profile_contractor.description',
  }),
  unlock('UNLOCK-PROFILE_BURNED_OUT', {
    family: 'RUN_FEAT',
    trigger: onBoss('BSS-016'),
    condition: { hook: 'DEFEATED_AT_OR_BELOW_HEALTH', params: { icons: 1 } },
    actions: [{ type: 'UNLOCK_PROFILE', value: 'PRF-005' }],
    descriptionLoc: 'unlock.profile_burned_out.description',
  }),
  unlock('UNLOCK-PROFILE_EXEC_ASSISTANT', {
    family: 'RUN_FEAT',
    trigger: onBoss('BSS-013'),
    condition: { hook: 'BOSS_DEFEATED_WITHOUT_DAMAGE' },
    actions: [{ type: 'UNLOCK_PROFILE', value: 'PRF-006' }],
    descriptionLoc: 'unlock.profile_exec_assistant.description',
  }),
  unlock('UNLOCK-PROFILE_REMOTE_WORKER', {
    hidden: true,
    family: 'DISCOVERY',
    // The 13th Floor is a teleport-only anomaly, so reaching it is inherently a
    // discovery and should not be spoiled by a banner beforehand.
    trigger: { event: 'ROOM_ENTERED', params: { role: 'ROOM-027' } },
    actions: [
      { type: 'UNLOCK_PROFILE', value: 'PRF-007' },
      { type: 'SET_FLAG', value: 'THIRTEENTH_FLOOR_SEEN' },
    ],
    descriptionLoc: 'unlock.profile_remote_worker.description',
  }),
  unlock('UNLOCK-PROFILE_FACILITIES_TECH', {
    family: 'CHALLENGE_COMPLETION',
    trigger: { event: 'BOSS_DEFEATED' },
    condition: { hook: 'COMPLETED_FACILITIES_BRANCH' },
    actions: [{ type: 'UNLOCK_PROFILE', value: 'PRF-008' }],
    descriptionLoc: 'unlock.profile_facilities_tech.description',
  }),

  // -------------------------------------------------------------------------
  // Set drops and combination unlocks (GDD 16.3)
  // -------------------------------------------------------------------------
  unlock('UNLOCK-TRANSFORMATION_LATTE', {
    family: 'COMBINATION',
    trigger: { event: 'TRANSFORMATION_GAINED', params: { transformation: 'TRN-001' } },
    actions: [{ type: 'REVEAL_COLLECTION', value: 'TRN-001' }],
    descriptionLoc: 'unlock.transformation_latte.description',
  }),
  unlock('UNLOCK-TEAM_PLAYER_BADGE', {
    family: 'BOSS_DEFEAT',
    // BSS-001's rare set drop enters normal pools once seen, per GDD 16.3's
    // "a specific item enters normal pools" reward pattern.
    trigger: onBoss('BSS-001'),
    condition: { hook: 'BOSS_DEFEATED_WITHOUT_DAMAGE' },
    actions: [{ type: 'ADD_TO_POOL', value: { pool: 'MANAGER_REWARD', content: 'SET_TEAM_PLAYER_BADGE' } }],
    descriptionLoc: 'unlock.team_player_badge.description',
  }),
  unlock('UNLOCK-SHADOW_PROCUREMENT', {
    hidden: true,
    family: 'DISCOVERY',
    trigger: { event: 'ROOM_ENTERED', params: { role: 'ROOM-022' } },
    actions: [
      { type: 'SET_FLAG', value: 'SHADOW_PROCUREMENT_SEEN' },
      { type: 'ADD_TO_POOL', value: { pool: 'SECRET_MAINTENANCE', content: 'BLACK_MARKET_STOCK' } },
    ],
    descriptionLoc: 'unlock.shadow_procurement.description',
  }),
];

export default unlocks;
