/**
 * Bosses BSS-021..029: Legal, Facilities, R&D, and the post-CEO ownership chain.
 *
 * GDD refs: Appendix E (BSS-021..029; every Core fight line is quoted above its boss),
 *           15.2 (boss selection from floor pools), 15.3 (the R-BSS-001..007 contract),
 *           15.4 (the phase template), 10.4 (the alternate routes these bosses gate),
 *           16.2/Appendix F (endings), 18.3 (silhouette readability), H.2 (originality).
 *
 * These nine are the end of the game, and two things about them are unusual.
 *
 * **Three of them are built by quoting other content.** BSS-027 Parent Company
 * "reconstructs sanitized versions of earlier bosses", BSS-028 The Conglomerate uses
 * "carefully sequenced cross-department mechanics", and BSS-029 The Beneficial Owner
 * "echoes selected mechanics from the current run". They use `ECHO_RUN_MECHANIC` and
 * `MODULE_CYCLE` against a pool the run itself filled in, which is the whole reason the
 * pattern vocabulary in src/entities/boss-patterns.js is mechanical rather than named
 * after individual bosses.
 *
 * **BSS-029 gets simpler as it goes.** Appendix E: "removes layers until only movement
 * and core weapon skill remain." Its later phases have FEWER patterns and lower health
 * contribution than its earlier ones. That looks like a data mistake and is not one — a
 * final boss that peaked in complexity would contradict the stated design.
 *
 * Health is calibrated against the player's unmodified baseline of roughly 20 damage per
 * second (10 per Keyboard shot at a 0.45s interval). These are floor 9+ fights where a
 * surviving player has real modifiers, so the numbers assume perhaps 3-6x baseline
 * output; the intent is 2-4 minutes, phase-gated rather than merely large.
 */

/** Shared boss audio. Only these three boss sfx exist (content/audio). */
const bossAudio = (music) => ({
  intro: 'SFX-BOSS_INTRO',
  phase: 'SFX-BOSS_PHASE',
  death: 'SFX-BOSS_DEATH',
  music,
});

const boss = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `boss.${slug}.name`,
  spriteId: `boss_${slug}`,
  departments: spec.departments,
  floorPools: spec.floorPools,
  arenaTags: spec.arenaTags,
  maxHealth: spec.maxHealth,
  healthScalingPerDepth: spec.healthScalingPerDepth ?? 0.15,
  radius: spec.radius,
  contactDamage: spec.contactDamage,
  phases: spec.phases,
  telegraphMinimumSeconds: spec.telegraphMinimumSeconds ?? 0.6,
  // R-BSS-006 is not optional and the schema rejects false, so it is stated once here
  // rather than repeated as a per-boss decision that could be got wrong.
  guaranteesSafePath: true,
  ...(spec.managerRewardOverride ? { managerRewardOverride: spec.managerRewardOverride } : {}),
  ...(spec.setDrop ? { setDrop: spec.setDrop } : {}),
  unlockHooks: spec.unlockHooks ?? [],
  endingHooks: spec.endingHooks ?? [],
  accessibilityVariants: spec.accessibilityVariants,
  testSeeds: spec.testSeeds,
  audio: bossAudio(spec.music),
  silhouetteNote: spec.silhouette,
  coreIdea: spec.coreIdea,
  originalityNote: spec.original,
});

const bosses = [
  // -------------------------------------------------------------------------
  // BSS-021 General Counsel — Legal
  // Core fight: "Uses clauses, binding zones, and delayed rulings with explicit icons
  // and countdowns."
  // -------------------------------------------------------------------------
  boss('BSS-021', 'general_counsel', {
    departments: ['LEGAL'],
    floorPools: ['BOSSPOOL-LEGAL_1', 'BOSSPOOL-LEGAL_2'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 620,
    radius: 1.6,
    contactDamage: 2,
    // "Explicit icons and countdowns" is the fight, so the telegraph floor is the
    // highest in the file. Appendix E's role for this boss is "rewards reading simple
    // conditions under pressure" — unreadable would make it a coin flip.
    telegraphMinimumSeconds: 1.0,
    phases: [
      {
        id: 'opening_statement',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'DELAYED_RULING', weight: 3, params: { count: 2, delaySeconds: 1.8, radius: 2 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3, damage: 2 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.65 },
        invulnerable: false,
      },
      {
        id: 'binding_zones',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.65 },
        patternWeights: [
          // safeGapCount is passed explicitly to make the intent visible, though
          // boss-patterns.js clamps it to at least one regardless (R-BSS-006).
          { pattern: 'ZONE_CONTROL', weight: 3, params: { count: 4, safeGapCount: 1, delaySeconds: 2.2 } },
          { pattern: 'DELAYED_RULING', weight: 2, params: { count: 3, delaySeconds: 1.6 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        invulnerable: false,
      },
      {
        id: 'summary_judgment',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        patternWeights: [
          { pattern: 'CROSS_LANES', weight: 3, params: { axis: 'BOTH', safeGapCount: 2, seconds: 3 } },
          { pattern: 'DELAYED_RULING', weight: 3, params: { count: 4, delaySeconds: 1.4 } },
          { pattern: 'RADIAL_BURST', weight: 1, params: { count: 14 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-LEGAL_ESCALATION'],
    accessibilityVariants: [
      'REDUCED_MOTION: ruling countdown rings pulse in place instead of contracting.',
      'REDUCED_EFFECTS: binding zones use a flat tint plus a corner icon rather than a hatched overlay.',
    ],
    testSeeds: ['OFFICE-BSS021-0001', 'OFFICE-BSS021-0002', 'OFFICE-BSS021-0009'],
    music: 'MUS-LEGAL',
    silhouette: 'Tallest narrow humanoid in the game, carrying a bound folio that hangs open at chest height.',
    coreIdea: 'The only boss whose attacks are announced in writing before they resolve; the fight is comprehension under time pressure rather than reaction speed.',
    original: 'Legal process as a combat mechanic: the danger is stated, timed, and enforceable. Original translation of contract review into telegraphed zones.',
  }),

  // -------------------------------------------------------------------------
  // BSS-022 Red Tape — Legal
  // Core fight: "A giant living roll creates walls, knots, and temporary seals around
  // the arena."
  // -------------------------------------------------------------------------
  boss('BSS-022', 'red_tape', {
    departments: ['LEGAL'],
    floorPools: ['BOSSPOOL-LEGAL_1', 'BOSSPOOL-LEGAL_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'MOVING_GEOMETRY'],
    maxHealth: 700,
    radius: 2.2,
    contactDamage: 2,
    phases: [
      {
        id: 'unrolling',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'OBSTACLE_DEPLOY', weight: 2, params: { count: 3, safeGapCount: 2, health: 12 } },
          { pattern: 'TARGETED_SLAM', weight: 2, params: { radius: 2.4, damage: 2 } },
        ],
        movementRule: 'DRIFT_WANDER',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'sealing',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          // Appendix E for this boss: "Cut points open lanes; no phase can fully trap
          // the player." The cut points ARE the nodes, which is also what makes the
          // following invulnerable phase legal under R-BSS-004.
          { pattern: 'SWEEPING_WALL', weight: 3, params: { axis: 'HORIZONTAL', gapCount: 2, gapWidth: 3, seconds: 7 } },
          { pattern: 'NODE_ACTIVATION', weight: 2, params: { count: 3, health: 8 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'NODES_DESTROYED', value: 3 },
        invulnerable: true,
        // Attackable throughout: the nodes are the objective, so the player is never
        // merely waiting for a timer to expire.
        attackableDuringInvuln: true,
        maxInvulnerableSeconds: 5,
      },
      {
        id: 'knotting',
        entryCondition: { type: 'NODES_DESTROYED', value: 3 },
        patternWeights: [
          { pattern: 'TARGETED_SLAM', weight: 3, params: { radius: 3, damage: 3, delaySeconds: 0.4 } },
          { pattern: 'CROSS_LANES', weight: 2, params: { axis: 'BOTH', safeGapCount: 2 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: walls appear at their destination with a hold frame instead of sliding.',
      'REDUCED_EFFECTS: knots draw as solid blocks without the fibre texture.',
    ],
    testSeeds: ['OFFICE-BSS022-0001', 'OFFICE-BSS022-0004'],
    music: 'MUS-LEGAL',
    silhouette: 'A single thick coiling band with no head or limbs; reads as one continuous stroke.',
    coreIdea: 'The arena is the enemy: the boss body is almost incidental and the fight is about keeping a lane open.',
    original: 'Bureaucratic obstruction as literal physical obstruction, with the counterplay being to cut rather than to outdamage.',
  }),

  // -------------------------------------------------------------------------
  // BSS-023 Head of Facilities — Facilities
  // Core fight: "Manipulates water, power, doors, and movable objects while remaining
  // physically vulnerable."
  // -------------------------------------------------------------------------
  boss('BSS-023', 'head_of_facilities', {
    departments: ['FACILITIES'],
    floorPools: ['BOSSPOOL-FACILITIES'],
    arenaTags: ['BOSS_ARENA', 'COVER_HEAVY', 'MULTI_LEVEL_POWER'],
    // Deliberately the lowest health of the nine. Appendix E: "remaining physically
    // vulnerable", and the role is "environmental boss with multiple valid solutions" —
    // a player who ignores the environment and simply shoots the boss SHOULD win.
    maxHealth: 420,
    healthScalingPerDepth: 0.12,
    radius: 1.5,
    contactDamage: 1,
    phases: [
      {
        id: 'water_and_power',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SHOCK_LINE', weight: 3, params: { count: 2, length: 9, seconds: 2.5 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 2 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        invulnerable: false,
      },
      {
        id: 'doors_and_objects',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        patternWeights: [
          { pattern: 'OBSTACLE_DEPLOY', weight: 3, params: { count: 4, safeGapCount: 2 } },
          { pattern: 'SHOCK_LINE', weight: 2, params: { count: 3 } },
          { pattern: 'TONER_BURST', weight: 1, params: { size: 4, seconds: 3.5 } },
        ],
        movementRule: 'TELEPORT_STATIONS',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-FACILITIES_BRANCH'],
    accessibilityVariants: [
      'REDUCED_MOTION: doors snap between open and closed with no swing animation.',
      'REDUCED_EFFECTS: electrified water uses a border pattern instead of animated arcs.',
      'AUDIO_CAPTIONS: each power switch throw prints a caption, since the cue is otherwise audio-only.',
    ],
    testSeeds: ['OFFICE-BSS023-0001', 'OFFICE-BSS023-0003'],
    music: 'MUS-FACILITIES',
    silhouette: 'Stocky figure with a heavy tool belt and a wall-mounted panel always within reach.',
    coreIdea: 'The one boss you can beat by fighting the building instead of the boss, or by ignoring the building entirely.',
    original: 'A maintenance lead who wins by knowing the infrastructure, deliberately given the frailest body in the late roster.',
  }),

  // -------------------------------------------------------------------------
  // BSS-024 Prototype Zero — R&D
  // Core fight: "Cycles through a curated sequence of experimental weapon and room-rule
  // modules."
  // -------------------------------------------------------------------------
  boss('BSS-024', 'prototype_zero', {
    departments: ['RND'],
    floorPools: ['BOSSPOOL-RND'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE', 'MOVING_GEOMETRY'],
    maxHealth: 760,
    radius: 1.9,
    contactDamage: 2,
    phases: [
      {
        id: 'module_sequence_a',
        entryCondition: { type: 'START' },
        // MODULE_CYCLE steps a FIXED list rather than rolling weights. Appendix E's role
        // for this boss is "seeded module order supports learning within attempts", so
        // the order must be learnable — a weighted roll would destroy the whole point.
        patternWeights: [
          {
            pattern: 'MODULE_CYCLE',
            weight: 1,
            params: {
              sequence: [
                { pattern: 'SPIRAL_STREAM', params: { arms: 2, stepRadians: 0.32 } },
                { pattern: 'SHEET_WAVE', params: { count: 9, speed: 3.6 } },
                { pattern: 'SWEEPING_BEAM', params: { sweepRadians: 2.0, sweepSeconds: 2.4 } },
                { pattern: 'RADIAL_BURST', params: { count: 16 } },
              ],
            },
          },
        ],
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        invulnerable: false,
      },
      {
        id: 'module_sequence_b',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        patternWeights: [
          {
            pattern: 'MODULE_CYCLE',
            weight: 1,
            params: {
              // A different sequence, not a faster one. The second half is a new thing to
              // learn rather than a reflex check on the first.
              sequence: [
                { pattern: 'CONVEYOR_SHIFT', params: { direction: 'REVERSE', speedMul: 1.5, seconds: 5 } },
                { pattern: 'FAN_SWEEP', params: { count: 11, arcRadians: 1.6 } },
                { pattern: 'ZONE_CONTROL', params: { count: 4, safeGapCount: 1 } },
                { pattern: 'TARGETED_SLAM', params: { radius: 2.6, damage: 3 } },
                { pattern: 'SPIRAL_STREAM', params: { arms: 3, stepRadians: 0.4 } },
              ],
            },
          },
        ],
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-RND_BRANCH'],
    accessibilityVariants: [
      'REDUCED_MOTION: conveyor reversal is instant with a held direction arrow rather than an animated flip.',
      'REDUCED_EFFECTS: each module announces itself with a labelled icon instead of a screen-wide flourish.',
    ],
    testSeeds: ['OFFICE-BSS024-0001', 'OFFICE-BSS024-0002', 'OFFICE-BSS024-0011'],
    music: 'MUS-RND',
    silhouette: 'An unfinished chassis with exposed internals and one module bay visibly swapping contents.',
    coreIdea: 'A boss that is a playlist: every attack belongs to another fight, and the skill is recognising which one is loading.',
    original: 'An unshipped prototype as a boss made of other bosses parts, with a fixed learnable order as the counterplay.',
  }),

  // -------------------------------------------------------------------------
  // BSS-025 The Board — The Board II
  // Core fight: "A coordinated multi-entity boss whose votes select pattern families and
  // rewrite arena priorities."
  // -------------------------------------------------------------------------
  boss('BSS-025', 'the_board', {
    departments: ['BOARD'],
    floorPools: ['BOSSPOOL-BOARD_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    maxHealth: 980,
    healthScalingPerDepth: 0.18,
    radius: 2.0,
    contactDamage: 2,
    phases: [
      {
        id: 'first_motion',
        entryCondition: { type: 'START' },
        patternWeights: [
          {
            pattern: 'VOTE_SELECT',
            weight: 3,
            params: {
              // The tally is recomputed from surviving members, so killing a member
              // genuinely changes what gets voted for. That is the player's lever.
              options: [
                { pattern: 'RADIAL_BURST', params: { count: 16 } },
                { pattern: 'CROSS_LANES', params: { axis: 'BOTH', safeGapCount: 2 } },
                { pattern: 'SUMMON_ADDS', params: { enemyId: 'ENM-008', count: 2, maxAlive: 4 } },
              ],
            },
          },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'closed_session',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          { pattern: 'HEAD_ROTATION', weight: 3, params: { fallbackPattern: 'AIMED_VOLLEY' } },
          { pattern: 'ZONE_CONTROL', weight: 2, params: { count: 5, safeGapCount: 2 } },
        ],
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.25 },
        invulnerable: false,
      },
      {
        id: 'unanimous',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.25 },
        patternWeights: [
          {
            pattern: 'VOTE_SELECT',
            weight: 3,
            params: {
              options: [
                { pattern: 'SPIRAL_STREAM', params: { arms: 3 } },
                { pattern: 'SWEEPING_WALL', params: { gapCount: 2, seconds: 6 } },
                { pattern: 'DELAYED_RULING', params: { count: 4 } },
              ],
            },
          },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 20 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-OWNERSHIP_DOCUMENTS', 'UNLOCK-PARENT_COMPANY_ROUTE'],
    endingHooks: ['END-005'],
    accessibilityVariants: [
      'REDUCED_MOTION: the vote tally updates instantly rather than tallying up.',
      'REDUCED_EFFECTS: each member is outlined in a distinct pattern rather than a coloured aura.',
    ],
    testSeeds: ['OFFICE-BSS025-0001', 'OFFICE-BSS025-0005'],
    music: 'MUS-BOARD',
    silhouette: 'Several seated figures around one table edge, reading as a single wide mass rather than individuals.',
    coreIdea: 'The only boss you negotiate with by subtraction: which attacks it can use depends on which members are still alive.',
    original: 'Governance as a targeting problem. Killing a member does not weaken the boss so much as change its vocabulary.',
  }),

  // -------------------------------------------------------------------------
  // BSS-026 Hostile Takeover — The Board II alternate
  // Core fight: "Aggressive merger entity absorbs adds and inherits one attack from
  // each."
  // -------------------------------------------------------------------------
  boss('BSS-026', 'hostile_takeover', {
    departments: ['BOARD'],
    floorPools: ['BOSSPOOL-BOARD_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    maxHealth: 900,
    radius: 2.1,
    contactDamage: 3,
    phases: [
      {
        id: 'acquisition',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SUMMON_ADDS', weight: 3, params: { enemyId: 'ENM-003', count: 3, maxAlive: 5, graceSeconds: 0.9 } },
          { pattern: 'CONTACT_CHARGE', weight: 2, params: { speed: 12, recoverySeconds: 1.0 } },
        ],
        movementRule: 'CHARGE_AND_RECOVER',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'integration',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          // Appendix E's role note is the counterplay: "Player may kill adds before
          // absorption to limit the final kit." So absorption is slow and visible, and
          // ABSORB_ADDS caps inheritance at four so a long fight cannot hand it
          // everything in the game.
          { pattern: 'ABSORB_ADDS', weight: 3, params: { radius: 4, maxInherited: 4, healPerAdd: 4 } },
          { pattern: 'SUMMON_ADDS', weight: 2, params: { enemyId: 'ENM-015', count: 2, maxAlive: 4 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        invulnerable: false,
      },
      {
        id: 'synergies',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        patternWeights: [
          { pattern: 'ECHO_RUN_MECHANIC', weight: 3, params: { damage: 2 } },
          { pattern: 'CONTACT_CHARGE', weight: 2, params: { speed: 14, recoverySeconds: 0.8 } },
          { pattern: 'RADIAL_BURST', weight: 1, params: { count: 18 } },
        ],
        movementRule: 'CHARGE_AND_RECOVER',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-HOSTILE_TAKEOVER_ENDING'],
    endingHooks: ['END-006'],
    accessibilityVariants: [
      'REDUCED_MOTION: absorption is a fade rather than a pull-in.',
      'REDUCED_EFFECTS: inherited attacks keep their original colour so their source stays identifiable.',
    ],
    testSeeds: ['OFFICE-BSS026-0001', 'OFFICE-BSS026-0007'],
    music: 'MUS-BOARD',
    silhouette: 'An accreting mass that visibly gains a limb per absorbed add; the outline changes during the fight.',
    coreIdea: 'The only boss whose final moveset the player determines, by choosing which adds to kill before it eats them.',
    original: 'A merger that literally consumes its acquisitions and keeps one habit from each; the player writes the third phase.',
  }),

  // -------------------------------------------------------------------------
  // BSS-027 Parent Company — Parent Company
  // Core fight: "Reconstructs sanitized versions of earlier bosses and erases its own
  // branding between phases."
  // -------------------------------------------------------------------------
  boss('BSS-027', 'parent_company', {
    departments: ['PARENT_COMPANY'],
    floorPools: ['BOSSPOOL-PARENT'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    maxHealth: 1100,
    healthScalingPerDepth: 0.2,
    radius: 2.2,
    contactDamage: 2,
    phases: [
      {
        id: 'branded',
        entryCondition: { type: 'START' },
        patternWeights: [
          // "Sanitized versions" is why ECHO_RUN_MECHANIC caps damage: the echo is
          // deliberately weaker than the original boss's version was.
          { pattern: 'ECHO_RUN_MECHANIC', weight: 3, params: { damage: 2 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3 } },
        ],
        movementRule: 'TELEPORT_STATIONS',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.7 },
        invulnerable: false,
      },
      {
        id: 'rebranding',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.7 },
        patternWeights: [
          { pattern: 'STRIP_LAYER', weight: 1, params: { layers: 3 } },
          { pattern: 'NODE_ACTIVATION', weight: 3, params: { count: 4, health: 12 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'NODES_DESTROYED', value: 4 },
        // Legal because the nodes are attackable and the phase is capped: R-BSS-004
        // needs both purpose and a bound, and "erases its own branding" is the purpose.
        invulnerable: true,
        attackableDuringInvuln: true,
        maxInvulnerableSeconds: 4,
      },
      {
        id: 'unbranded',
        entryCondition: { type: 'NODES_DESTROYED', value: 4 },
        patternWeights: [
          { pattern: 'ECHO_RUN_MECHANIC', weight: 3, params: { damage: 3 } },
          { pattern: 'SPIRAL_STREAM', weight: 2, params: { arms: 3, stepRadians: 0.38 } },
          { pattern: 'SWEEPING_WALL', weight: 1, params: { gapCount: 2, seconds: 6 } },
        ],
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-OWNERSHIP_KEYS', 'UNLOCK-CONGLOMERATE_ROUTE'],
    // Appendix E: "Defeat reveals the subsidiary structure and a false terminal ending."
    // END-007 Subsidiary is that false ending — it presents as terminal and is not.
    endingHooks: ['END-007'],
    accessibilityVariants: [
      'REDUCED_MOTION: branding removal is a cut rather than a dissolve.',
      'REDUCED_EFFECTS: echoed attacks carry a small source icon so their origin stays readable.',
    ],
    testSeeds: ['OFFICE-BSS027-0001', 'OFFICE-BSS027-0006'],
    music: 'MUS-PARENT_COMPANY',
    silhouette: 'A featureless corporate mass that loses detail as the fight goes on, ending as a blank outline.',
    coreIdea: 'A boss that quotes the run back at you with the personality removed, and gets less identifiable as it loses health.',
    original: 'Corporate consolidation as visual erasure: the fight literally becomes generic, and the false ending sells it.',
  }),

  // -------------------------------------------------------------------------
  // BSS-028 The Conglomerate — The Conglomerate
  // Core fight: "Massive composite boss using carefully sequenced cross-department
  // mechanics and arena transformations."
  // -------------------------------------------------------------------------
  boss('BSS-028', 'the_conglomerate', {
    departments: ['CONGLOMERATE'],
    floorPools: ['BOSSPOOL-CONGLOMERATE'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'MOVING_GEOMETRY', 'CONVEYOR'],
    maxHealth: 1400,
    healthScalingPerDepth: 0.2,
    radius: 2.6,
    contactDamage: 3,
    phases: [
      {
        id: 'operations_division',
        entryCondition: { type: 'START' },
        // Appendix E: "No random module mixing during the fight." Every phase here is a
        // MODULE_CYCLE with a fixed sequence, and each phase is one department's
        // vocabulary — so the mastery boss is memorisable rather than chaotic.
        patternWeights: [
          {
            pattern: 'MODULE_CYCLE',
            weight: 1,
            params: {
              sequence: [
                { pattern: 'CONVEYOR_SHIFT', params: { direction: 'REVERSE', speedMul: 1.5, seconds: 5 } },
                { pattern: 'OBSTACLE_DEPLOY', params: { count: 4, safeGapCount: 2 } },
                { pattern: 'CONTACT_CHARGE', params: { speed: 13 } },
              ],
            },
          },
        ],
        movementRule: 'LANE_BOUND',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.75 },
        invulnerable: false,
      },
      {
        id: 'finance_division',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.75 },
        patternWeights: [
          {
            pattern: 'MODULE_CYCLE',
            weight: 1,
            params: {
              sequence: [
                { pattern: 'CROSS_LANES', params: { axis: 'BOTH', safeGapCount: 2 } },
                { pattern: 'RESOURCE_THEFT', params: { credits: 5, markChance: 0.5 } },
                { pattern: 'DELAYED_RULING', params: { count: 3 } },
              ],
            },
          },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        invulnerable: false,
      },
      {
        id: 'legal_division',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        patternWeights: [
          {
            pattern: 'MODULE_CYCLE',
            weight: 1,
            params: {
              sequence: [
                { pattern: 'SWEEPING_WALL', params: { gapCount: 2, seconds: 6 } },
                { pattern: 'ZONE_CONTROL', params: { count: 5, safeGapCount: 2 } },
                { pattern: 'DELAYED_RULING', params: { count: 4, delaySeconds: 1.5 } },
              ],
            },
          },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.25 },
        invulnerable: false,
      },
      {
        id: 'consolidated',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.25 },
        patternWeights: [
          {
            pattern: 'MODULE_CYCLE',
            weight: 1,
            params: {
              // The final sequence takes one step from each earlier phase, in order.
              // That is the mastery test: the player has already learned all three.
              sequence: [
                { pattern: 'CONVEYOR_SHIFT', params: { direction: 'FORWARD', speedMul: 1.6, seconds: 4 } },
                { pattern: 'CROSS_LANES', params: { axis: 'BOTH', safeGapCount: 2 } },
                { pattern: 'SWEEPING_WALL', params: { gapCount: 2, seconds: 5 } },
                { pattern: 'RADIAL_BURST', params: { count: 22 } },
              ],
            },
          },
        ],
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-OWNERSHIP_ROUTE'],
    endingHooks: ['END-008'],
    accessibilityVariants: [
      'REDUCED_MOTION: arena transformations hold a still frame at each end state.',
      'REDUCED_EFFECTS: each division phase uses one flat colour so the current vocabulary stays obvious.',
      'AUDIO_CAPTIONS: division changes print a caption; the phase stinger is otherwise the only cue.',
    ],
    testSeeds: ['OFFICE-BSS028-0001', 'OFFICE-BSS028-0002', 'OFFICE-BSS028-0013'],
    music: 'MUS-CONGLOMERATE',
    silhouette: 'The largest silhouette in the game: a composite mass whose four quadrants each read as a different department.',
    coreIdea: 'Four fights in fixed order inside one body, each quoting a department the player has already survived.',
    original: 'A conglomerate as a boss literally assembled from its holdings, sequenced rather than shuffled so mastery is possible.',
  }),

  // -------------------------------------------------------------------------
  // BSS-029 The Beneficial Owner — Ownership
  // Core fight: "Minimalist final duel that echoes selected mechanics from the current
  // run, then removes layers until only movement and core weapon skill remain."
  // -------------------------------------------------------------------------
  boss('BSS-029', 'the_beneficial_owner', {
    departments: ['OWNERSHIP'],
    floorPools: ['BOSSPOOL-OWNERSHIP'],
    // No large room, no moving geometry, no cover. The arena is deliberately the
    // plainest in the game, because Appendix E wants "only movement and core weapon
    // skill" by the end.
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 1200,
    healthScalingPerDepth: 0.15,
    radius: 1.4,
    contactDamage: 2,
    phases: [
      {
        id: 'everything_you_brought',
        entryCondition: { type: 'START' },
        // The most complex phase is the FIRST one. Each subsequent phase has fewer
        // patterns. This inversion is the boss.
        patternWeights: [
          { pattern: 'ECHO_RUN_MECHANIC', weight: 4, params: { damage: 2 } },
          { pattern: 'DELAYED_RULING', weight: 2, params: { count: 3 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 18 } },
          { pattern: 'SWEEPING_BEAM', weight: 1, params: { sweepRadians: 2.2 } },
        ],
        movementRule: 'DRIFT_WANDER',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.7 },
        invulnerable: false,
      },
      {
        id: 'first_removal',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.7 },
        patternWeights: [
          { pattern: 'STRIP_LAYER', weight: 1, params: { layers: 3 } },
          { pattern: 'ECHO_RUN_MECHANIC', weight: 3, params: { damage: 2 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 16 } },
        ],
        movementRule: 'DRIFT_WANDER',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.45 },
        invulnerable: false,
      },
      {
        id: 'second_removal',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.45 },
        patternWeights: [
          { pattern: 'STRIP_LAYER', weight: 1, params: { layers: 2 } },
          { pattern: 'RADIAL_BURST', weight: 3, params: { count: 14 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.2 },
        invulnerable: false,
      },
      {
        id: 'nothing_left',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.2 },
        // One pattern, aimed, no zones, no walls, no adds. Movement and the weapon.
        patternWeights: [
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3, spread: 0.22, speed: 8, damage: 2 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-BENEFICIAL_OWNERSHIP'],
    endingHooks: ['END-009'],
    accessibilityVariants: [
      'REDUCED_MOTION: layer removal is a cut with a held frame rather than a dissolve.',
      'REDUCED_EFFECTS: echoed mechanics keep their source colour so the final phase still reads as a stripped-down version.',
    ],
    testSeeds: ['OFFICE-BSS029-0001', 'OFFICE-BSS029-0008', 'OFFICE-BSS029-0029'],
    music: 'MUS-OWNERSHIP',
    silhouette: 'Smallest late-game silhouette: a plain seated figure that loses one detail per phase until it is an outline.',
    coreIdea: 'The final boss gets simpler, not harder — it spends the fight taking its own mechanics away until only the fundamentals are left.',
    original: 'An ownership figure who wins by subtraction. Ending a roguelike on the least mechanically busy fight is the deliberate inversion.',
  }),
];

export default bosses;
