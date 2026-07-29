/**
 * Encounters for the departments above IT.
 *
 * GDD refs: 6.6 (the difficulty budget; `cost` is the currency and `budgetRange` is the
 *           band of rooms an encounter suits), 12.1 / D-006 / R-FLR-007 (a room is a place,
 *           not an enemy list — architecture and encounters are separate layers), 14.4
 *           (department continuity), 14.5 / R-ENM-003 (no mutually shielding or infinitely
 *           healing groups), R-ENM-006 (bounded quantity), R-ROM-001 (one template hosts
 *           several encounters plus empty), Appendix D.1 (per-enemy cost).
 *
 * ## Why this file exists
 *
 * Every floor from Operations onward had **zero** populated rooms. Encounters only covered
 * Open Office and IT, and `isCompatible()` requires a department match — correctly — so
 * fifty-eight authored enemies were unreachable and two thirds of the building was empty.
 * That is not a tuning problem; the content simply was not there.
 *
 * ## Shape
 *
 * Six encounters per department, built from the department's own roster:
 *
 *   TRASH     a handful of the cheapest bodies. Teaches the room.
 *   PAIR      two of the department's ranged or specialist units.
 *   MIXED     melee plus ranged, the standard mid-floor fight.
 *   ANCHOR    one expensive centrepiece plus cheap support.
 *   SWARM     many cheap bodies, for open rooms only.
 *   SPECIALIST the department's signature oddity, alone or nearly so.
 *
 * The six deliberately overlap in `budgetRange` so any given room has several candidates
 * (R-ROM-001) rather than exactly one, which is what makes a re-entered floor feel authored
 * rather than deterministic.
 *
 * Costs come from Appendix D.1 via each enemy definition, so `budgetRange` here is checked
 * against the real sum by tests/encounters.test.js rather than guessed.
 *
 * ## Budget ranges are derived, not written
 *
 * GDD 6.6: a room's budget is `(3.5 + depth * 1.35) * roomMultiplier * difficulty`. At depth
 * 8 that is around 14 and at depth 13 around 21, so hand-written ranges topping out at 14
 * silently excluded every deep floor — Executive II and the whole ownership chain came out
 * with zero populated rooms while Executive I was at ninety percent. The band is now computed
 * from each department's own depth, wide enough to cover the tiny-to-large room multipliers
 * (0.55x to 1.45x) plus a couple of depth steps either side.
 */

/** GDD 6.6's budget formula, so ranges cannot drift from the selector's own arithmetic. */
const budgetAtDepth = (depth) => 3.5 + depth * 1.35;

/**
 * The band of rooms a department's encounters should suit.
 *
 * Deliberately generous. `budgetRange` is a suitability hint the selector scores against, not
 * a hard cost assertion — an encounter that fits no room at all is worse than one that fits
 * a slightly wider spread than intended.
 */
function bandFor(depth) {
  const base = budgetAtDepth(depth);
  return [Math.max(1.5, base * 0.45), base * 1.9];
}

/**
 * How much to multiply a fight's head-count by at a given depth.
 *
 * A depth-7 room has a budget near 13, so two 1.0-cost enemies is not a fight — it is a
 * rounding error. Rather than authoring eleven separate rosters with hand-tuned counts, the
 * shape of each fight is fixed and its size scales with the department's depth.
 *
 * Capped at 4: R-ENM-006 bounds simultaneous hostiles, and past a certain point more bodies
 * stop being harder and start being unreadable (GDD 2.9).
 */
const countScale = (depth) => Math.min(4, Math.max(1, Math.round(budgetAtDepth(depth) / 6)));

/** Scale a `[min, max]` count pair, keeping a zero floor meaningful. */
const scaled = (n, min, max) => [min === 0 ? 0 : min * n, max * n];

/**
 * Build one encounter.
 *
 * `groups` is a list of `[zone, enemyId, min, max]`, which keeps a whole fight on one line
 * and makes the composition rules below easy to read at a glance.
 */
const enc = (id, spec) => ({
  id,
  schemaVersion: 1,
  departmentTags: spec.departments,
  roomTagsRequired: spec.required ?? ['COMBAT_CAPABLE'],
  roomTagsAny: spec.any ?? [],
  budgetRange: spec.budget,
  minFloor: spec.minFloor ?? 1,
  ...(spec.maxFloor ? { maxFloor: spec.maxFloor } : {}),
  spawnGroups: spec.groups.map(([zone, enemy, min, max]) => ({
    zone,
    entries: [{ enemy, count: [min, max] }],
  })),
  constraints: {
    maxSupport: spec.maxSupport ?? 1,
    // R-CMB-002: the player reads the room before anything can hurt them. Later floors
    // tighten this, but never below the schema's floor.
    minEntryGraceSeconds: spec.grace ?? 0.9,
    requirePlayerPathBetweenEntries: true,
    ...(spec.maxSimultaneous ? { maxSimultaneousHostiles: spec.maxSimultaneous } : {}),
  },
  clearRule: 'ALL_REQUIRED_ENEMIES',
  rewardProfile: spec.reward ?? 'NORMAL_CLEAR',
  weight: spec.weight ?? 1.0,
});

const MELEE = 'GROUND_MELEE';
const RANGED = 'GROUND_RANGED';
const AIR = 'AIR';

/**
 * Six encounters for one department.
 *
 * @param {object} d
 * @param {string} d.dept department tag
 * @param {string} d.slug id fragment
 * @param {number} d.minFloor first depth this department appears at
 * @param {string} d.trash cheap melee body
 * @param {string} d.ranged its ranged or specialist unit
 * @param {string} d.anchor its most expensive unit
 * @param {string} d.odd its signature oddity
 * @param {string} [d.swarm] a very cheap body for the swarm fight; defaults to trash
 */
function departmentEncounters(d) {
  const swarm = d.swarm ?? d.trash;
  const f = d.minFloor;
  const band = bandFor(d.minFloor);
  const n = countScale(d.minFloor);
  return [
    enc(`ENC-${d.slug}_TRASH`, {
      departments: [d.dept], minFloor: f,
      budget: band, weight: 2.4, grace: 1.0,
      groups: [[MELEE, d.trash, ...scaled(n, 2, 4)]],
    }),
    enc(`ENC-${d.slug}_PAIR`, {
      departments: [d.dept], minFloor: f,
      budget: band, weight: 2.0,
      groups: [[RANGED, d.ranged, ...scaled(n, 2, 3)]],
    }),
    enc(`ENC-${d.slug}_MIXED`, {
      departments: [d.dept], minFloor: f,
      budget: band, weight: 2.2,
      groups: [[MELEE, d.trash, ...scaled(n, 1, 3)], [RANGED, d.ranged, ...scaled(n, 1, 2)]],
    }),
    enc(`ENC-${d.slug}_ANCHOR`, {
      departments: [d.dept], minFloor: f,
      budget: band, weight: 1.6,
      // One centrepiece plus cheap support. R-ENM-003's "no two healers" is enforced by
      // encounter-select regardless of data, but keeping support at one here means the
      // rule never has to reject a fight the author intended.
      groups: [[RANGED, d.anchor, 1, 1], [MELEE, d.trash, ...scaled(n, 1, 3)]],
      maxSupport: 1,
    }),
    enc(`ENC-${d.slug}_SWARM`, {
      departments: [d.dept], minFloor: f,
      // Open rooms only: a swarm in a corridor is a wall, not a fight.
      any: ['OPEN_CENTRE', 'LARGE_ROOM'],
      budget: band, weight: 1.3,
      groups: [[MELEE, swarm, Math.min(6, 4 * n), Math.min(10, 7 * n)]],
      maxSimultaneous: 10,
    }),
    enc(`ENC-${d.slug}_SPECIALIST`, {
      departments: [d.dept], minFloor: f,
      budget: band, weight: 1.5,
      groups: [[d.oddZone ?? RANGED, d.odd, ...scaled(n, 1, 2)], [MELEE, d.trash, ...scaled(n, 0, 2)]],
    }),
  ];
}

/**
 * Per-department rosters, drawn from each enemy's own `homeDepartments`.
 *
 * `minFloor` is each department's SHALLOWEST floor depth (see content/departments/floors.js),
 * so an Executive fight cannot appear on an Open Office floor — and, just as importantly, a
 * Marketing fight is not excluded from Marketing I. Setting it one tier too high is silent:
 * the floor simply generates empty.
 */
const ROSTERS = [
  {
    dept: 'OPERATIONS', slug: 'OPS', minFloor: 5,
    trash: 'ENM-034', ranged: 'ENM-027', anchor: 'ENM-030', odd: 'ENM-031',
    swarm: 'ENM-028',
  },
  {
    dept: 'EXECUTIVE', slug: 'EXEC', minFloor: 7,
    trash: 'ENM-045', ranged: 'ENM-043', anchor: 'ENM-037', odd: 'ENM-039',
    swarm: 'ENM-045',
  },
  {
    dept: 'FINANCE', slug: 'FIN', minFloor: 5,
    trash: 'ENM-048', ranged: 'ENM-047', anchor: 'ENM-046', odd: 'ENM-044',
    oddZone: AIR, swarm: 'ENM-048',
  },
  {
    dept: 'MARKETING', slug: 'MKT', minFloor: 5,
    trash: 'ENM-049', ranged: 'ENM-050', anchor: 'ENM-046', odd: 'ENM-049',
    swarm: 'ENM-049',
  },
  {
    dept: 'LEGAL', slug: 'LEG', minFloor: 7,
    trash: 'ENM-051', ranged: 'ENM-052', anchor: 'ENM-038', odd: 'ENM-042',
    oddZone: AIR, swarm: 'ENM-051',
  },
  {
    dept: 'FACILITIES', slug: 'FAC', minFloor: 4,
    trash: 'ENM-053', ranged: 'ENM-054', anchor: 'ENM-046', odd: 'ENM-054',
    swarm: 'ENM-053',
  },
  {
    dept: 'RND', slug: 'RND', minFloor: 6,
    trash: 'ENM-055', ranged: 'ENM-055', anchor: 'ENM-046', odd: 'ENM-055',
    swarm: 'ENM-055',
  },
  {
    dept: 'BOARD', slug: 'BOARD', minFloor: 9,
    trash: 'ENM-045', ranged: 'ENM-043', anchor: 'ENM-037', odd: 'ENM-057',
    oddZone: AIR, swarm: 'ENM-045',
  },
  {
    dept: 'PARENT_COMPANY', slug: 'PARENT', minFloor: 10,
    trash: 'ENM-045', ranged: 'ENM-038', anchor: 'ENM-039', odd: 'ENM-056',
    swarm: 'ENM-045',
  },
  {
    dept: 'CONGLOMERATE', slug: 'CONGLOM', minFloor: 11,
    trash: 'ENM-058', ranged: 'ENM-043', anchor: 'ENM-037', odd: 'ENM-058',
    swarm: 'ENM-045',
  },
  {
    dept: 'OWNERSHIP', slug: 'OWN', minFloor: 12,
    trash: 'ENM-045', ranged: 'ENM-057', anchor: 'ENM-037', odd: 'ENM-057',
    oddZone: AIR, swarm: 'ENM-045',
  },
];

/**
 * Cross-department roamers.
 *
 * ENM-040 Middle Manager and ENM-046 HR Business Partner are tagged CROSS_DEPARTMENT in
 * Appendix D precisely so they can appear anywhere, which is what makes them continuity
 * rather than filler. One encounter each, available to every department from mid-run.
 */
const CROSS = [
  enc('ENC-CROSS_MANAGER_ESCORT', {
    departments: [
      'OPEN_OFFICE', 'IT', 'OPERATIONS', 'EXECUTIVE', 'FINANCE', 'MARKETING',
      'LEGAL', 'FACILITIES', 'RND', 'BOARD', 'PARENT_COMPANY', 'CONGLOMERATE',
    ],
    // Spans depths 4 to 12, so its band covers that whole stretch rather than one depth.
    minFloor: 4, budget: [2.5, budgetAtDepth(12) * 1.9], weight: 1.1,
    groups: [[RANGED, 'ENM-040', 1, 1], [MELEE, 'ENM-001', 2, 4]],
    maxSupport: 1,
  }),
  enc('ENC-CROSS_HR_POLICY', {
    departments: [
      'OPERATIONS', 'EXECUTIVE', 'FINANCE', 'MARKETING', 'LEGAL', 'FACILITIES',
      'RND', 'BOARD', 'PARENT_COMPANY', 'CONGLOMERATE',
    ],
    // D.2's variant note limits this to one policy enemy per normal room; encounter
    // selection enforces that, and fielding exactly one here means it never has to.
    minFloor: 6, budget: [2.5, budgetAtDepth(12) * 1.9], weight: 1.0,
    groups: [[RANGED, 'ENM-046', 1, 1], [MELEE, 'ENM-008', 1, 3]],
    maxSupport: 1,
  }),
];

export default [...ROSTERS.flatMap(departmentEncounters), ...CROSS];
