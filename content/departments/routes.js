/**
 * ROUTE-* base and hidden routes. GDD 10.3, 16.5.
 *
 * Content kind: route. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * GDD refs: 10.3 (base visible route), 10.5 (alternate departments replace a
 *           step after unlock), 16.4 (CEO clear 10 interrupts the apparent
 *           ending and the elevator enters The Board I), 16.5 (deeper hidden
 *           route: Board -> Parent Company -> Conglomerate -> Ownership),
 *           R-DPT-002 (four departments and eight generated floors before the
 *           CEO on a fresh save), R-DPT-004 (hidden routes absent from
 *           undiscovered maps and completion summaries), R-DPT-006 (route data
 *           controls insertion; the generator core is untouched).
 *
 * ---------------------------------------------------------------------------
 * Authoring notes
 * ---------------------------------------------------------------------------
 * A `steps[].alternates` entry replaces exactly one step, so an alternate
 * chapter contributes one floor per step it can occupy. Finance and Marketing
 * therefore alternate both Operations steps (depth 5 and depth 6) and stay a
 * two-floor chapter, while Legal alternates the single Executive I step and
 * keeps Executive II and the CEO in place exactly as GDD 10.5 requires.
 *
 * `alternates[].weight` is relative to the other alternates on that step; the
 * base floor is chosen when no alternate is rolled, and GDD 16.4 (CEO clear 5)
 * raises alternate selection weight at runtime rather than in this data.
 *
 * `continuations` are appended when the flag holds, which is the GDD 16.5 chain.
 * The two secret *branches* are not continuations: Facilities and R&D are
 * entered mid-floor through a ROOM-026 Service Elevator and returned from, so
 * they are authored as their own short hidden routes that the service-elevator
 * room targets. They deliberately declare no continuations of their own.
 *
 * Flags are read by the unlock/save systems and never by presentation code.
 */

const routes = [
  // =========================================================================
  // ROUTE-BASE — the eight visible floors before the CEO (GDD 10.3)
  // =========================================================================
  {
    id: 'ROUTE-BASE',
    schemaVersion: 1,
    nameLoc: 'route.base.name',
    steps: [
      // Chapter 1 — Open Office. Never replaceable: it is the tutorial grammar.
      { floor: 'FLOOR-OPEN_OFFICE_1', alternates: [] },
      { floor: 'FLOOR-OPEN_OFFICE_2', alternates: [] },

      // Chapter 2 — IT. Never replaceable: it owns the electricity vocabulary
      // that later departments recombine.
      { floor: 'FLOOR-IT_1', alternates: [] },
      { floor: 'FLOOR-IT_2', alternates: [] },

      // Chapter 3 — Operations, or Finance / Marketing once unlocked (GDD 10.5).
      {
        floor: 'FLOOR-OPERATIONS_1',
        alternates: [
          { floor: 'FLOOR-FINANCE_1', weight: 1.0, requiresUnlock: 'UNLOCK-ALTERNATE_FINANCE' },
          { floor: 'FLOOR-MARKETING_1', weight: 1.0, requiresUnlock: 'UNLOCK-ALTERNATE_MARKETING' },
        ],
      },
      {
        floor: 'FLOOR-OPERATIONS_2',
        alternates: [
          { floor: 'FLOOR-FINANCE_2', weight: 1.0, requiresUnlock: 'UNLOCK-ALTERNATE_FINANCE' },
          { floor: 'FLOOR-MARKETING_2', weight: 1.0, requiresUnlock: 'UNLOCK-ALTERNATE_MARKETING' },
        ],
      },

      // Chapter 4 — Executive I, or Legal once unlocked. FLOOR-LEGAL_2 is the
      // rarer escalated variant of the same swap and needs its own unlock.
      {
        floor: 'FLOOR-EXECUTIVE_1',
        alternates: [
          { floor: 'FLOOR-LEGAL_1', weight: 1.0, requiresUnlock: 'UNLOCK-ALTERNATE_LEGAL' },
          { floor: 'FLOOR-LEGAL_2', weight: 0.35, requiresUnlock: 'UNLOCK-LEGAL_ESCALATION' },
        ],
      },

      // Executive II always terminates the visible route and holds the CEO.
      { floor: 'FLOOR-EXECUTIVE_2', alternates: [] },
    ],
    // GDD 16.4: at CEO clear 10 the apparent ending is interrupted.
    continuations: [
      { route: 'ROUTE-BOARD', requiresFlag: 'FLAG_CEO_CLEARS_TEN' },
    ],
    hidden: false,
  },

  // =========================================================================
  // ROUTE-BOARD — hidden post-CEO chapter (GDD 16.4, 16.5 step 1)
  // =========================================================================
  {
    id: 'ROUTE-BOARD',
    schemaVersion: 1,
    nameLoc: 'route.board.name',
    steps: [
      { floor: 'FLOOR-BOARD_1', alternates: [] },
      { floor: 'FLOOR-BOARD_2', alternates: [] },
    ],
    // GDD 16.5 step 2: two distinct ownership-document fragments collected in
    // one run after a Board clear open Parent Company instead of the Board
    // ending.
    continuations: [
      { route: 'ROUTE-PARENT_COMPANY', requiresFlag: 'FLAG_OWNERSHIP_DOCUMENT_FRAGMENTS_TWO' },
    ],
    hidden: true,
  },

  // =========================================================================
  // ROUTE-PARENT_COMPANY — deep hidden chapter (GDD 16.5 steps 2-3)
  // =========================================================================
  {
    id: 'ROUTE-PARENT_COMPANY',
    schemaVersion: 1,
    nameLoc: 'route.parent_company.name',
    steps: [
      { floor: 'FLOOR-PARENT_COMPANY_1', alternates: [] },
    ],
    // GDD 16.5 step 4: three Ownership Key fragments assembled in one run open
    // The Conglomerate after Parent Company. The three fragment conditions live
    // in Facilities, R&D, and an Executive Deal route (16.5 step 3).
    continuations: [
      { route: 'ROUTE-CONGLOMERATE', requiresFlag: 'FLAG_OWNERSHIP_KEY_FRAGMENTS_THREE' },
    ],
    hidden: true,
  },

  // =========================================================================
  // ROUTE-CONGLOMERATE — ultra hidden chapter (GDD 16.5 steps 4-5)
  // =========================================================================
  {
    id: 'ROUTE-CONGLOMERATE',
    schemaVersion: 1,
    nameLoc: 'route.conglomerate.name',
    steps: [
      { floor: 'FLOOR-CONGLOMERATE_1', alternates: [] },
    ],
    // GDD 16.5 step 5: the Ownership elevator appears only with no Executive
    // Deal debt and at least one discovered secret room in every chapter of
    // that run. Both halves are evaluated into one flag by the unlock system.
    continuations: [
      { route: 'ROUTE-OWNERSHIP', requiresFlag: 'FLAG_OWNERSHIP_ELEVATOR_CONDITION' },
    ],
    hidden: true,
  },

  // =========================================================================
  // ROUTE-OWNERSHIP — terminal hidden arena (GDD 16.5 step 6)
  // =========================================================================
  {
    id: 'ROUTE-OWNERSHIP',
    schemaVersion: 1,
    nameLoc: 'route.ownership.name',
    steps: [
      { floor: 'FLOOR-OWNERSHIP_1', alternates: [] },
    ],
    // Terminal: The Beneficial Owner and END-009. Nothing follows.
    continuations: [],
    hidden: true,
  },

  // =========================================================================
  // Secret branches — entered and exited mid-run through ROOM-026, not appended
  // =========================================================================
  {
    id: 'ROUTE-FACILITIES_BRANCH',
    schemaVersion: 1,
    nameLoc: 'route.facilities_branch.name',
    steps: [
      { floor: 'FLOOR-FACILITIES_1', alternates: [] },
    ],
    continuations: [],
    hidden: true,
  },
  {
    id: 'ROUTE-RND_BRANCH',
    schemaVersion: 1,
    nameLoc: 'route.rnd_branch.name',
    steps: [
      { floor: 'FLOOR-RND_1', alternates: [] },
    ],
    continuations: [],
    hidden: true,
  },
];

export default routes;
