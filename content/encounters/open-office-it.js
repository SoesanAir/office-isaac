/**
 * Encounters for Open Office I-II and IT I-II.
 *
 * GDD refs: 6.6 (the difficulty budget: an encounter is *authored* and selected by
 *           budget, never poured in until a number fills), 14.5 (composition rules),
 *           3.6 (First ten minutes: the first hostile rooms use one or two clearly
 *           different behaviours and generous telegraphs), 14.4 (department
 *           continuity: mostly native, limited cross-department), R-ENM-003 (no
 *           mutually shielding or infinitely healing groups), R-ENM-006 (bounded
 *           quantity), R-ROM-001 (a template must support several encounters),
 *           Appendix G.4 (the canonical encounter shape).
 *
 * Budgets, from GDD 6.6's `3.5 + depth * 1.35` times the room multiplier:
 *
 *   depth 1  tiny 2.67  normal 4.85  double 7.52  large 10.43
 *   depth 2  tiny 3.41  normal 6.20  double 9.61  large 13.33
 *   depth 3  tiny 4.15  normal 7.55  double 11.70 large 16.24
 *   depth 4  tiny 4.90  normal 8.90  double 13.80 large 19.14
 *
 * `budgetRange` must CONTAIN the room's budget, so ranges are written to span a
 * band rather than to match one number — that is what lets a single encounter serve
 * both floors of a chapter while still refusing a room from the wrong depth.
 *
 * The teaching curve is deliberate and follows GDD 3.6: depth 1 encounters use one
 * or two behaviours with nothing that predicts or shields, depth 2 adds support and
 * density, and IT introduces turrets, teleporters, and its first shielder.
 */

const enc = (id, spec) => ({
  id,
  schemaVersion: 1,
  departmentTags: spec.departments,
  roomTagsRequired: spec.required ?? ['COMBAT_CAPABLE'],
  roomTagsAny: spec.any ?? [],
  ...(spec.prohibited ? { roomTagsProhibited: spec.prohibited } : {}),
  budgetRange: spec.budget,
  minFloor: spec.minFloor,
  ...(spec.maxFloor ? { maxFloor: spec.maxFloor } : {}),
  spawnGroups: spec.groups,
  constraints: {
    maxSupport: spec.maxSupport ?? 0,
    minEntryGraceSeconds: spec.grace ?? 0.8,
    requirePlayerPathBetweenEntries: true,
    ...(spec.maxHostiles ? { maxSimultaneousHostiles: spec.maxHostiles } : {}),
  },
  clearRule: spec.clearRule ?? 'ALL_REQUIRED_ENEMIES',
  rewardProfile: spec.reward ?? 'NORMAL_CLEAR',
  weight: spec.weight ?? 1.0,
});

const OO = ['OPEN_OFFICE'];
const IT = ['IT'];

const encounters = [
  // =========================================================================
  // Open Office I — depth 1. GDD 3.6: generous telegraphs, one or two behaviours.
  // =========================================================================
  enc('ENC-OO_DRONES_SMALL', {
    departments: OO, any: [], budget: [2.2, 5.4], minFloor: 1, maxFloor: 2,
    // The very first fight the game is likely to show: one behaviour, no ranged
    // pressure, nothing that predicts. Movement reading, and nothing else.
    groups: [{ zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [2, 4] }] }],
    grace: 1.2, weight: 2.4,
  }),
  enc('ENC-OO_DESK_PAIR', {
    departments: OO, any: [], budget: [3.8, 6.6], minFloor: 1, maxFloor: 2,
    // Introduces "stand out of the lane" against a target that cannot follow you.
    groups: [
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-002', count: [2, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [1, 2] }] },
    ],
    grace: 1.1, weight: 2.0,
  }),
  enc('ENC-OO_PAPER_DUO', {
    departments: OO, any: [], budget: [3.8, 6.6], minFloor: 1,
    groups: [
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-003', count: [2, 3] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [1, 1] }] },
    ],
    weight: 1.8,
  }),
  enc('ENC-OO_SPRINTERS', {
    departments: OO, required: ['COMBAT_CAPABLE', 'DASH_LANE'], any: ['NORMAL'],
    budget: [3.8, 6.6], minFloor: 1,
    // Needs a lane, and teaches the "move after the telegraph commits" lesson that
    // every later predictive enemy builds on.
    groups: [{ zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-004', count: [3, 4] }] }],
    grace: 1.2, weight: 1.6,
  }),
  enc('ENC-OO_INTERNS_FLEE', {
    departments: OO, any: [], budget: [2.2, 5.4], minFloor: 1,
    // A soft room on purpose: GDD 3.2 wants relief beats between tension beats.
    groups: [{ zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-005', count: [2, 4] }] }],
    reward: 'NORMAL_CLEAR', weight: 1.3,
  }),
  enc('ENC-OO_CHAIR_CHARGE', {
    departments: OO, required: ['COMBAT_CAPABLE', 'DASH_LANE'], any: ['NORMAL', 'LARGE_ROOM'],
    budget: [4.2, 7.0], minFloor: 1,
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-006', count: [2, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [1, 1] }] },
    ],
    grace: 1.1, weight: 1.5,
  }),
  enc('ENC-OO_CAMPERS', {
    departments: OO, required: ['COMBAT_CAPABLE', 'COVER_HEAVY'], any: ['NORMAL'],
    budget: [3.8, 6.6], minFloor: 1,
    // Only legal in cover-heavy rooms, which is the whole point of the enemy.
    groups: [
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-011', count: [2, 3] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [1, 2] }] },
    ],
    weight: 1.5,
  }),
  enc('ENC-OO_CLUSTER_OPEN', {
    departments: OO, required: ['COMBAT_CAPABLE', 'OPEN_CENTRE'], any: ['NORMAL', 'LARGE_ROOM'],
    budget: [4.0, 8.0], minFloor: 1,
    groups: [{ zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-009', count: [4, 5] }] }],
    grace: 1.0, weight: 1.4,
  }),
  enc('ENC-OO_HALLWAY_PINCH', {
    departments: OO, any: ['TINY', 'HALLWAY'], budget: [2.2, 4.2], minFloor: 1,
    // Tiny rooms get tiny fights: two bodies in a corridor is already tense.
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [1, 2] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-003', count: [1, 1] }] },
    ],
    maxHostiles: 4, weight: 1.6,
  }),

  // =========================================================================
  // Open Office II — depth 2. Support enemies and real density arrive.
  // =========================================================================
  enc('ENC-OO_SUPPORTED_DRONES', {
    departments: OO, any: [], budget: [5.4, 8.4], minFloor: 2,
    // The first encounter that rewards target priority: kill the buffer or fight
    // faster drones. GDD 14.2's counterplay for support, made concrete.
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [3, 4] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-007', count: [1, 1] }] },
    ],
    maxSupport: 1, weight: 1.8,
  }),
  enc('ENC-OO_HR_POLICY', {
    departments: OO, any: [], budget: [5.4, 8.4], minFloor: 2,
    // HR appears as a roamer rather than a chapter (R-DPT-003).
    groups: [
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-008', count: [1, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [2, 3] }] },
    ],
    weight: 1.5,
  }),
  enc('ENC-OO_BURNOUT_TANK', {
    departments: OO, any: ['NORMAL', 'LARGE_ROOM'], budget: [5.6, 9.8], minFloor: 2,
    // A splitter needs space to split into, so it stays out of tiny rooms.
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-010', count: [1, 2] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-002', count: [1, 1] }] },
    ],
    weight: 1.4,
  }),
  enc('ENC-OO_REPLY_THREAD', {
    departments: OO, any: ['NORMAL'], budget: [5.4, 8.4], minFloor: 2,
    // Reply Guy is only interesting with something worth copying, so it always
    // arrives alongside a shooter.
    groups: [
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-002', count: [1, 2] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-012', count: [1, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [1, 1] }] },
    ],
    weight: 1.3,
  }),
  enc('ENC-OO_MIXED_PRESSURE', {
    departments: OO, any: [], budget: [6.0, 10.8], minFloor: 2,
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-004', count: [2, 2] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-003', count: [2, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-005', count: [1, 2] }] },
    ],
    weight: 1.2,
  }),
  enc('ENC-OO_LARGE_MEETING', {
    departments: OO, required: ['COMBAT_CAPABLE', 'OPEN_CENTRE'], any: ['LARGE_ROOM'],
    budget: [9.0, 14.5], minFloor: 2,
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-009', count: [4, 6] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-007', count: [1, 1] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-002', count: [1, 2] }] },
    ],
    maxSupport: 1, grace: 1.0, weight: 1.1,
  }),
  enc('ENC-OO_DOUBLE_ROOM_SWEEP', {
    departments: OO, any: [], budget: [7.0, 10.4], minFloor: 1,
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [3, 5] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-002', count: [2, 2] }] },
    ],
    weight: 1.6,
  }),
  enc('ENC-OO_WAVES_DEADLINE', {
    departments: OO, any: ['NORMAL', 'LARGE_ROOM'], budget: [5.4, 11.0], minFloor: 2,
    // Two distinct waves, which the schema requires for ALL_WAVES.
    groups: [
      { zone: 'GROUND_MELEE', wave: 0, entries: [{ enemy: 'ENM-001', count: [2, 3] }] },
      { zone: 'GROUND_RANGED', wave: 1, entries: [{ enemy: 'ENM-003', count: [2, 2] }] },
      { zone: 'GROUND_MELEE', wave: 1, entries: [{ enemy: 'ENM-004', count: [1, 2] }] },
    ],
    clearRule: 'ALL_WAVES', reward: 'RICH_CLEAR', weight: 0.8,
  }),

  // =========================================================================
  // IT I — depth 3. Turrets, cables, and the department's electrical language.
  // =========================================================================
  enc('ENC-IT_TICKET_QUEUE', {
    departments: IT, any: [], budget: [6.6, 9.6], minFloor: 3,
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [3, 4] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-014', count: [1, 1] }] },
    ],
    weight: 2.0,
  }),
  enc('ENC-IT_RACK_LANES', {
    departments: IT, any: ['NORMAL', 'COVER_HEAVY'], budget: [6.6, 9.6], minFloor: 3,
    // Turrets make the room a lane puzzle, so a chaser is added to deny camping.
    groups: [
      { zone: 'OBJECT_ANCHOR', entries: [{ enemy: 'ENM-018', count: [2, 3] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [1, 2] }] },
    ],
    weight: 1.9,
  }),
  enc('ENC-IT_CABLE_PERIMETER', {
    departments: IT, required: ['COMBAT_CAPABLE', 'WALL_PERIMETER'], any: ['NORMAL'],
    budget: [6.2, 9.6], minFloor: 3,
    // Cable Snakes own the edges, which pushes the fight into the middle — the
    // opposite of the cover-heavy rooms, and that contrast is the point.
    groups: [
      { zone: 'WALL_EDGE', entries: [{ enemy: 'ENM-013', count: [2, 3] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [2, 2] }] },
    ],
    weight: 1.7,
  }),
  enc('ENC-IT_POPUP_SWARM', {
    departments: IT, any: [], budget: [6.6, 11.0], minFloor: 3,
    groups: [
      { zone: 'AIR', entries: [{ enemy: 'ENM-017', count: [2, 3] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [1, 2] }] },
    ],
    weight: 1.6,
  }),
  enc('ENC-IT_BLUESCREEN_CLUSTER', {
    departments: IT, any: [], budget: [6.6, 9.6], minFloor: 3,
    // Death hazards, so the player has to choose *where* to kill things.
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-021', count: [2, 3] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-014', count: [1, 1] }] },
    ],
    weight: 1.5,
  }),
  enc('ENC-IT_TINY_SERVER_AISLE', {
    departments: IT, any: ['TINY', 'HALLWAY'], budget: [3.4, 5.6], minFloor: 3,
    groups: [
      { zone: 'OBJECT_ANCHOR', entries: [{ enemy: 'ENM-018', count: [1, 1] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [1, 2] }] },
    ],
    maxHostiles: 4, weight: 1.6,
  }),
  enc('ENC-IT_PATCH_WINDOW', {
    departments: IT, any: ['NORMAL'], budget: [6.6, 9.6], minFloor: 3,
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-023', count: [1, 1] }] },
      { zone: 'OBJECT_ANCHOR', entries: [{ enemy: 'ENM-018', count: [1, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [1, 2] }] },
    ],
    maxSupport: 1, weight: 1.3,
  }),

  // =========================================================================
  // IT II — depth 4. Shields, healers, and prediction. One support per room.
  // =========================================================================
  enc('ENC-IT_FIREWALL_HOLD', {
    departments: IT, any: [], budget: [7.8, 14.2], minFloor: 4,
    // Exactly one Firewall Node: R-ENM-003 forbids a mutually shielding pair, and
    // the enemy itself cannot shield another node.
    groups: [
      { zone: 'WALL_EDGE', entries: [{ enemy: 'ENM-016', count: [1, 1] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-014', count: [1, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [1, 2] }] },
    ],
    maxSupport: 1, weight: 1.4,
  }),
  enc('ENC-IT_HELPDESK_SUSTAIN', {
    departments: IT, any: [], budget: [7.8, 14.2], minFloor: 4,
    // One healer only, and it is the priority target. Two would let them trade heals
    // faster than the player can burst either down (R-ENM-003).
    groups: [
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-019', count: [1, 1] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [2, 3] }] },
      { zone: 'OBJECT_ANCHOR', entries: [{ enemy: 'ENM-018', count: [1, 1] }] },
    ],
    maxSupport: 1, weight: 1.4,
  }),
  enc('ENC-IT_CURSOR_HUNT', {
    departments: IT, any: ['NORMAL', 'OPEN_CENTRE'], budget: [7.8, 12.0], minFloor: 4,
    // Prediction as the headline threat, with only slow company so the player can
    // give the Cursor their full attention.
    groups: [
      { zone: 'AIR', entries: [{ enemy: 'ENM-020', count: [2, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-021', count: [1, 2] }] },
    ],
    grace: 1.0, weight: 1.3,
  }),
  enc('ENC-IT_REMOTE_STANDOFF', {
    departments: IT, required: ['COMBAT_CAPABLE', 'WALL_PERIMETER'], any: ['NORMAL'],
    budget: [7.4, 12.0], minFloor: 4,
    groups: [
      { zone: 'WALL_EDGE', entries: [{ enemy: 'ENM-022', count: [2, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [2, 2] }] },
    ],
    weight: 1.3,
  }),
  enc('ENC-IT_SPAM_WALL', {
    departments: IT, any: ['NORMAL'], budget: [7.8, 11.0], minFloor: 4,
    // A blocker in front of shooters: the player has to reposition rather than
    // out-damage, which is the counterplay GDD 14.2 gives for a projectile blocker.
    groups: [
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-024', count: [1, 2] }] },
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-014', count: [2, 2] }] },
    ],
    maxSupport: 2, weight: 1.3,
  }),
  enc('ENC-IT_LARGE_CORRUPTED', {
    departments: IT, any: ['LARGE_ROOM'], budget: [13.0, 20.0], minFloor: 4,
    groups: [
      { zone: 'OBJECT_ANCHOR', entries: [{ enemy: 'ENM-018', count: [2, 3] }] },
      { zone: 'AIR', entries: [{ enemy: 'ENM-017', count: [2, 2] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-015', count: [2, 3] }] },
      { zone: 'WALL_EDGE', entries: [{ enemy: 'ENM-013', count: [1, 2] }] },
    ],
    grace: 1.1, maxHostiles: 14, weight: 1.0,
  }),
  enc('ENC-IT_WAVES_ESCALATION', {
    departments: IT, any: ['NORMAL', 'LARGE_ROOM'], budget: [7.8, 14.2], minFloor: 4,
    groups: [
      { zone: 'GROUND_MELEE', wave: 0, entries: [{ enemy: 'ENM-015', count: [2, 3] }] },
      { zone: 'AIR', wave: 1, entries: [{ enemy: 'ENM-017', count: [1, 2] }] },
      { zone: 'OBJECT_ANCHOR', wave: 1, entries: [{ enemy: 'ENM-018', count: [1, 1] }] },
    ],
    clearRule: 'ALL_WAVES', reward: 'RICH_CLEAR', weight: 0.8,
  }),

  // =========================================================================
  // Cross-department roamers (GDD 14.4: no more than 25% continuity)
  // =========================================================================
  enc('ENC-XD_MANAGEMENT_VISIT', {
    departments: ['CROSS_DEPARTMENT', 'OPEN_OFFICE', 'IT'], any: ['NORMAL'],
    budget: [5.4, 9.6], minFloor: 2,
    // Deliberately low weight: continuity should feel like a cameo, not a staple.
    groups: [
      { zone: 'GROUND_RANGED', entries: [{ enemy: 'ENM-008', count: [1, 1] }] },
      { zone: 'GROUND_MELEE', entries: [{ enemy: 'ENM-001', count: [2, 3] }] },
    ],
    weight: 0.5,
  }),
];

export default encounters;
