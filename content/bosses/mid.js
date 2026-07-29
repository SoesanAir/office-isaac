/**
 * Bosses BSS-011..020: late Operations, Executive, Finance, and Marketing.
 *
 * GDD refs: Appendix E (BSS-011..020; each Core fight line is quoted above its boss),
 *           15.2 (selection from floor pools), 15.3 (the R-BSS-001..007 contract),
 *           15.4 (the phase template), 16.2 / Appendix F (ending hooks), 18.3
 *           (silhouette readability), H.2 (originality review).
 *
 * BSS-016 CEO is the hinge of the whole game. Appendix E calls it the "first apparent
 * final boss" and gives it three named phases — charismatic presentation, hostile
 * restructuring with adds, and exposed machine-like corporate core — so those are its
 * three phase ids verbatim. Its defeat "triggers ending logic, not always credits",
 * which is why it carries END-002 Promotion rather than a terminal ending: the elevator
 * keeps going.
 *
 * Health assumes the player reaching Executive has real modifiers, so roughly 3-6x the
 * 20-damage-per-second unmodified baseline. These are 90-150 second fights, phase-gated
 * rather than merely large.
 */

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
  healthScalingPerDepth: spec.healthScalingPerDepth ?? 0.16,
  radius: spec.radius,
  contactDamage: spec.contactDamage,
  phases: spec.phases,
  telegraphMinimumSeconds: spec.telegraphMinimumSeconds ?? 0.6,
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
  // BSS-011 Supply Chain — Operations II
  // Core fight: "Linked cart-and-worker segments circulate the room. Destroying
  // segments changes route and attack pattern."
  // -------------------------------------------------------------------------
  boss('BSS-011', 'supply_chain', {
    departments: ['OPERATIONS'],
    floorPools: ['BOSSPOOL-OPERATIONS_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'CONVEYOR'],
    maxHealth: 560,
    radius: 1.8,
    contactDamage: 3,
    phases: [
      {
        id: 'circulating',
        entryCondition: { type: 'START' },
        patternWeights: [
          // HEAD_ROTATION drives the segments: each one is an independently disableable
          // part taking its turn, which is exactly the cart-train structure.
          { pattern: 'HEAD_ROTATION', weight: 3, params: { fallbackPattern: 'AIMED_VOLLEY' } },
          { pattern: 'CONVEYOR_SHIFT', weight: 2, params: { direction: 'REVERSE', speedMul: 1.3, seconds: 5 } },
        ],
        // Appendix E: "no off-screen damage". Orbiting the centre keeps the whole train
        // inside the arena rather than looping out of view.
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'rerouted',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          { pattern: 'HEAD_ROTATION', weight: 3, params: { fallbackPattern: 'FAN_SWEEP' } },
          { pattern: 'OBSTACLE_DEPLOY', weight: 2, params: { count: 3, safeGapCount: 2 } },
          { pattern: 'CROSS_LANES', weight: 1, params: { axis: 'HORIZONTAL', safeGapCount: 2 } },
        ],
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: the train advances in discrete steps rather than gliding.',
      'REDUCED_EFFECTS: each segment keeps a fixed colour so the destroyed ones stay obvious.',
    ],
    testSeeds: ['OFFICE-BSS011-0001', 'OFFICE-BSS011-0011'],
    music: 'MUS-OPERATIONS',
    silhouette: 'A long articulated chain of carts, the only boss whose outline is wider than the screen is tall.',
    coreIdea: 'A boss you shorten rather than weaken: every destroyed segment changes both its route and its attack.',
    original: 'A supply chain as a segmented train where breaking a link genuinely reroutes the rest.',
  }),

  // -------------------------------------------------------------------------
  // BSS-012 Quarter End — Operations II
  // Core fight: "A clock-driven boss that accelerates selected patterns but exposes a
  // weak point at each deadline."
  // -------------------------------------------------------------------------
  boss('BSS-012', 'quarter_end', {
    departments: ['OPERATIONS'],
    floorPools: ['BOSSPOOL-OPERATIONS_2'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 600,
    radius: 1.6,
    contactDamage: 2,
    phases: [
      // Appendix E's role note is a warning as much as a description: "Not a global run
      // timer; the fight itself owns the clock." So every phase here uses TIME_AFTER
      // conditions internally and nothing touches the run.
      {
        id: 'week_one',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'AIMED_VOLLEY', weight: 3, params: { count: 3, speed: 7 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 12 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'TIME_AFTER', value: 18 },
        invulnerable: false,
      },
      {
        id: 'first_deadline',
        entryCondition: { type: 'TIME_AFTER', value: 18 },
        patternWeights: [
          // The deadline PAYS the player: the weak point is the reward for surviving the
          // acceleration, and R-BSS-004 requires it be drawn rather than implied.
          { pattern: 'WEAK_POINT_EXPOSE', weight: 3, params: { radius: 1.4, damageMul: 2.5, seconds: 3.5 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 16, speed: 7 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        invulnerable: false,
      },
      {
        id: 'crunch',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        patternWeights: [
          { pattern: 'RADIAL_BURST', weight: 3, params: { count: 18, speed: 8 } },
          { pattern: 'SPIRAL_STREAM', weight: 2, params: { arms: 3, stepRadians: 0.4 } },
          { pattern: 'WEAK_POINT_EXPOSE', weight: 2, params: { radius: 1.2, damageMul: 3, seconds: 2.5 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-ALTERNATE_FINANCE'],
    accessibilityVariants: [
      'REDUCED_MOTION: the deadline clock ticks in whole units instead of sweeping.',
      'REDUCED_EFFECTS: acceleration is signalled by a border colour change rather than a screen pulse.',
    ],
    testSeeds: ['OFFICE-BSS012-0001', 'OFFICE-BSS012-0012'],
    music: 'MUS-OPERATIONS',
    silhouette: 'A figure fused to a wall clock; the clock face is the readable centre of mass.',
    coreIdea: 'The clock hurries the boss and helps the player: every deadline both accelerates it and opens it up.',
    original: 'Quarter-end pressure as a timer that is entirely local to the fight, never a run clock.',
  }),

  // -------------------------------------------------------------------------
  // BSS-013 VP of Everything — Executive I
  // Core fight: "Cycles through diluted versions of earlier department mechanics and
  // delegates attacks to assistants."
  // -------------------------------------------------------------------------
  boss('BSS-013', 'vp_of_everything', {
    departments: ['EXECUTIVE'],
    floorPools: ['BOSSPOOL-EXECUTIVE_1'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    maxHealth: 700,
    radius: 1.7,
    contactDamage: 2,
    phases: [
      {
        id: 'delegating',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SUMMON_ADDS', weight: 3, params: { enemyId: 'ENM-008', count: 2, maxAlive: 4, graceSeconds: 0.9 } },
          { pattern: 'BUFF_ADDS', weight: 2, params: { radius: 5.5, seconds: 4 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.65 },
        invulnerable: false,
      },
      {
        id: 'recognition_exam',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.65 },
        patternWeights: [
          // Appendix E's role: "A recognition exam, not a random pattern soup."
          // ECHO_RUN_MECHANIC draws from what this run has actually shown the player, and
          // caps damage, so the echoes are the diluted versions the spec asks for.
          { pattern: 'ECHO_RUN_MECHANIC', weight: 4, params: { damage: 2 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3 } },
        ],
        movementRule: 'TELEPORT_STATIONS',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        invulnerable: false,
      },
      {
        id: 'personally_involved',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        patternWeights: [
          { pattern: 'ECHO_RUN_MECHANIC', weight: 3, params: { damage: 3 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 16 } },
          { pattern: 'SUMMON_ADDS', weight: 1, params: { enemyId: 'ENM-007', count: 1, maxAlive: 2 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-PROFILE_EXEC_ASSISTANT'],
    accessibilityVariants: [
      'REDUCED_MOTION: teleports cut rather than blur between stations.',
      'REDUCED_EFFECTS: each echoed mechanic keeps its source department colour, so the exam stays legible.',
    ],
    testSeeds: ['OFFICE-BSS013-0001', 'OFFICE-BSS013-0013'],
    music: 'MUS-EXECUTIVE',
    silhouette: 'Immaculate suit, no tools, no machine: the plainest humanoid outline in the Executive tier.',
    coreIdea: 'A quiz on the run so far: every attack is something the player has already been taught to handle.',
    original: 'A VP whose only real skill is having been present in every other department, expressed as borrowed attacks.',
  }),

  // -------------------------------------------------------------------------
  // BSS-014 Chief Operating Officer — Executive I-II
  // Core fight: "Controls room zones, security, and moving executive furniture while
  // attacking in measured phases."
  // -------------------------------------------------------------------------
  boss('BSS-014', 'chief_operating_officer', {
    departments: ['EXECUTIVE'],
    floorPools: ['BOSSPOOL-EXECUTIVE_1', 'BOSSPOOL-EXECUTIVE_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'MOVING_GEOMETRY'],
    maxHealth: 780,
    radius: 1.7,
    contactDamage: 2,
    // "Measured phases" — the telegraph is deliberately unhurried for a late boss.
    telegraphMinimumSeconds: 0.9,
    phases: [
      {
        id: 'zoning',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'ZONE_CONTROL', weight: 3, params: { count: 4, safeGapCount: 2, delaySeconds: 2.2 } },
          { pattern: 'SWEEPING_BEAM', weight: 2, params: { sweepRadians: 1.8, sweepSeconds: 2.4 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.65 },
        invulnerable: false,
      },
      {
        id: 'security_sweep',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.65 },
        patternWeights: [
          { pattern: 'SWEEPING_BEAM', weight: 3, params: { sweepRadians: 2.4, sweepSeconds: 2.0 } },
          { pattern: 'OBSTACLE_DEPLOY', weight: 2, params: { count: 4, safeGapCount: 2 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 4 } },
        ],
        movementRule: 'TELEPORT_STATIONS',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        invulnerable: false,
      },
      {
        id: 'restructure',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        patternWeights: [
          { pattern: 'SWEEPING_WALL', weight: 3, params: { axis: 'HORIZONTAL', gapCount: 2, seconds: 6 } },
          { pattern: 'ZONE_CONTROL', weight: 2, params: { count: 5, safeGapCount: 2 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 18 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-ALTERNATE_LEGAL'],
    // Appendix E: "Drops a high-quality Manager Reward and may open a post-boss offer
    // room." The override is what makes the reward high-quality rather than default.
    managerRewardOverride: 'EXECUTIVE_DEAL',
    accessibilityVariants: [
      'REDUCED_MOTION: executive furniture fades between positions rather than sliding.',
      'REDUCED_EFFECTS: security beams draw as solid bands with a hard edge, no bloom.',
    ],
    testSeeds: ['OFFICE-BSS014-0001', 'OFFICE-BSS014-0014'],
    music: 'MUS-EXECUTIVE',
    silhouette: 'Broad-shouldered figure flanked by two floor-to-ceiling glass panels that move with them.',
    coreIdea: 'Never hurried and never surprised: it wins by owning where you are allowed to stand.',
    original: 'An operations chief who fights by facilities management, with the office itself as the weapon.',
  }),

  // -------------------------------------------------------------------------
  // BSS-015 The Boardroom — Executive II
  // Core fight: "Several chair-bound members vote to enable synchronized patterns.
  // Defeating members changes the vote balance."
  // -------------------------------------------------------------------------
  boss('BSS-015', 'the_boardroom', {
    departments: ['EXECUTIVE', 'BOARD'],
    // Appendix E: "May appear as alternate pre-CEO boss or hidden Board preview." The
    // Board route's first floor has no boss of its own in Appendix E, and this entry is
    // the stated preview — without BOSSPOOL-BOARD_1 here, FLOOR-BOARD_1 has nothing to
    // draw and the route dead-ends.
    floorPools: ['BOSSPOOL-EXECUTIVE_2', 'BOSSPOOL-BOARD_1'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    maxHealth: 820,
    radius: 2.0,
    contactDamage: 2,
    phases: [
      {
        id: 'first_vote',
        entryCondition: { type: 'START' },
        patternWeights: [
          {
            // VOTE_SELECT recomputes its tally from surviving members, so killing one
            // genuinely removes an option rather than just reducing health. That is the
            // "changes the vote balance" the spec asks for.
            pattern: 'VOTE_SELECT',
            weight: 4,
            params: {
              options: [
                { pattern: 'RADIAL_BURST', params: { count: 14 } },
                { pattern: 'CROSS_LANES', params: { axis: 'BOTH', safeGapCount: 2 } },
                { pattern: 'FAN_SWEEP', params: { count: 11, arcRadians: 1.6 } },
              ],
            },
          },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        invulnerable: false,
      },
      {
        id: 'synchronized',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        patternWeights: [
          { pattern: 'HEAD_ROTATION', weight: 3, params: { fallbackPattern: 'AIMED_VOLLEY' } },
          {
            pattern: 'VOTE_SELECT',
            weight: 3,
            params: {
              options: [
                { pattern: 'SPIRAL_STREAM', params: { arms: 3 } },
                { pattern: 'ZONE_CONTROL', params: { count: 5, safeGapCount: 2 } },
                { pattern: 'DELAYED_RULING', params: { count: 3 } },
              ],
            },
          },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: the tally appears complete rather than counting up.',
      'REDUCED_EFFECTS: each member is outlined with a distinct pattern rather than a coloured glow.',
    ],
    testSeeds: ['OFFICE-BSS015-0001', 'OFFICE-BSS015-0015'],
    music: 'MUS-EXECUTIVE',
    silhouette: 'Four seated figures in a shallow arc, reading as one wide committee rather than individuals.',
    coreIdea: 'You edit its moveset by choosing who to kill; the tally is public the whole time.',
    original: 'A board vote as target priority. Appears as an alternate pre-CEO boss or a hidden preview of BSS-025.',
  }),

  // -------------------------------------------------------------------------
  // BSS-016 CEO — Executive II final
  // Core fight: "Three phases: charismatic presentation, hostile restructuring with
  // adds, and exposed machine-like corporate core."
  // -------------------------------------------------------------------------
  boss('BSS-016', 'ceo', {
    departments: ['EXECUTIVE'],
    floorPools: ['BOSSPOOL-EXECUTIVE_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    // The first apparent final boss. Long, but gated by three distinct phases rather
    // than by a single large number.
    maxHealth: 1050,
    healthScalingPerDepth: 0.18,
    radius: 1.8,
    contactDamage: 3,
    phases: [
      // Phase ids are Appendix E's three names verbatim.
      {
        id: 'charismatic_presentation',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'FAN_SWEEP', weight: 3, params: { count: 11, arcRadians: 1.5 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 14 } },
          { pattern: 'AIMED_VOLLEY', weight: 2, params: { count: 3, speed: 8 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.7 },
        invulnerable: false,
      },
      {
        id: 'hostile_restructuring',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.7 },
        patternWeights: [
          // ENM-007 Team Player for now. Appendix D's ENM-040 Middle Manager would be the
          // thematically right add, but only ENM-001..024 are authored — swap it here
          // when the Executive enemies land rather than referencing a missing id.
          { pattern: 'SUMMON_ADDS', weight: 3, params: { enemyId: 'ENM-007', count: 2, maxAlive: 4, graceSeconds: 0.9 } },
          { pattern: 'BUFF_ADDS', weight: 2, params: { radius: 6, seconds: 5 } },
          { pattern: 'ZONE_CONTROL', weight: 2, params: { count: 4, safeGapCount: 2 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 16 } },
        ],
        movementRule: 'TELEPORT_STATIONS',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.35 },
        invulnerable: false,
      },
      {
        id: 'corporate_core',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.35 },
        patternWeights: [
          // "Exposed machine-like": the human patterns stop and the mechanical ones take
          // over. The weak point is what "exposed" means, and it is drawn (R-BSS-004).
          { pattern: 'WEAK_POINT_EXPOSE', weight: 2, params: { radius: 1.3, damageMul: 2.5, seconds: 3 } },
          { pattern: 'SPIRAL_STREAM', weight: 3, params: { arms: 4, stepRadians: 0.4 } },
          { pattern: 'SWEEPING_BEAM', weight: 2, params: { sweepRadians: 2.6, sweepSeconds: 2.2 } },
          { pattern: 'CROSS_LANES', weight: 2, params: { axis: 'BOTH', safeGapCount: 2 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: [
      'UNLOCK-CEO_CLEAR_FIRST',
      'UNLOCK-CEO_CLEAR_THREE',
      'UNLOCK-CEO_CLEAR_FIVE',
      'UNLOCK-CEO_CLEAR_SEVEN',
      'UNLOCK-BOARD_ROUTE',
      'UNLOCK-PROFILE_BURNED_OUT',
    ],
    // Appendix E: "Defeat triggers ending logic, not always credits." END-002 Promotion
    // is the apparent ending; the elevator keeps going, which is END-004's job later.
    endingHooks: ['END-002'],
    accessibilityVariants: [
      'REDUCED_MOTION: the phase-three transformation is a cut rather than an animated unfolding.',
      'REDUCED_EFFECTS: the presentation phase drops its lighting sweep and keeps a flat backdrop.',
      'AUDIO_CAPTIONS: each phase transition prints its name; the stinger is otherwise the only cue.',
    ],
    testSeeds: ['OFFICE-BSS016-0001', 'OFFICE-BSS016-0016', 'OFFICE-BSS016-0099'],
    music: 'MUS-EXECUTIVE',
    silhouette: 'Tallest humanoid in the game, whose upper body visibly splits open in phase three to show machinery.',
    coreIdea: 'The apparent end of the game: a person for two phases and a mechanism for the third.',
    original: 'A chief executive who turns out to be infrastructure. The reveal is the phase transition, not a cutscene.',
  }),

  // -------------------------------------------------------------------------
  // BSS-017 The Auditor — Finance
  // Core fight: "Tracks spending, marks pickups, and creates ledger lanes that
  // reconcile after a delay."
  // -------------------------------------------------------------------------
  boss('BSS-017', 'the_auditor', {
    departments: ['FINANCE'],
    floorPools: ['BOSSPOOL-FINANCE_1', 'BOSSPOOL-FINANCE_2'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 720,
    radius: 1.5,
    contactDamage: 2,
    telegraphMinimumSeconds: 0.9,
    phases: [
      {
        id: 'fieldwork',
        entryCondition: { type: 'START' },
        patternWeights: [
          // RESOURCE_THEFT steals rather than destroys, and the boss runtime drops the
          // stolen credits back on death — a permanent deletion would be a run-ender
          // disguised as a mechanic.
          { pattern: 'RESOURCE_THEFT', weight: 2, params: { credits: 4, markChance: 0.5 } },
          { pattern: 'CROSS_LANES', weight: 3, params: { axis: 'BOTH', safeGapCount: 2, seconds: 3 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'reconciliation',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          // "Reconcile after a delay" is DELAYED_RULING: the lane is marked now and
          // settles later, so the fight is about reading the ledger before it closes.
          { pattern: 'DELAYED_RULING', weight: 3, params: { count: 4, delaySeconds: 1.6 } },
          { pattern: 'CROSS_LANES', weight: 3, params: { axis: 'BOTH', safeGapCount: 2 } },
          { pattern: 'RESOURCE_THEFT', weight: 1, params: { credits: 5 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    setDrop: {
      // Appendix E: "Set drop: Corporate Card or Red Pen."
      contentId: 'ITM-059',
      chance: 0.12,
      replacesManagerReward: false,
    },
    accessibilityVariants: [
      'REDUCED_MOTION: ledger lanes appear at full length instead of drawing across.',
      'REDUCED_EFFECTS: marked pickups carry a corner tick rather than a pulsing outline.',
    ],
    testSeeds: ['OFFICE-BSS017-0001', 'OFFICE-BSS017-0017'],
    music: 'MUS-FINANCE',
    silhouette: 'Narrow figure behind a floating ledger sheet that stays between them and the player.',
    coreIdea: 'The only boss that attacks your resources: it takes credits, marks drops, and gives them back when it dies.',
    original: 'An audit as combat: everything it does is announced, recorded, and settled on a delay.',
  }),

  // -------------------------------------------------------------------------
  // BSS-018 Budget Committee — Finance
  // Core fight: "Three members allocate armor, projectiles, and resource theft through
  // a visible rotating budget."
  // -------------------------------------------------------------------------
  boss('BSS-018', 'budget_committee', {
    departments: ['FINANCE'],
    floorPools: ['BOSSPOOL-FINANCE_1', 'BOSSPOOL-FINANCE_2'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 760,
    radius: 1.9,
    contactDamage: 2,
    phases: [
      {
        id: 'allocation',
        entryCondition: { type: 'START' },
        patternWeights: [
          {
            // Appendix E's role: "Defeating one member changes allocation, creating
            // player choice." The three options ARE the three budget lines, so removing
            // a member removes a line.
            pattern: 'VOTE_SELECT',
            weight: 4,
            params: {
              options: [
                { pattern: 'AIMED_VOLLEY', params: { count: 5, spread: 0.14, speed: 8 } },
                { pattern: 'RESOURCE_THEFT', params: { credits: 5, markChance: 0.6 } },
                { pattern: 'RADIAL_BURST', params: { count: 16 } },
              ],
            },
          },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        invulnerable: false,
      },
      {
        id: 'reallocation',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        patternWeights: [
          { pattern: 'HEAD_ROTATION', weight: 3, params: { fallbackPattern: 'AIMED_VOLLEY' } },
          { pattern: 'DELAYED_RULING', weight: 2, params: { count: 3 } },
          { pattern: 'RESOURCE_THEFT', weight: 1, params: { credits: 4 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: the budget wheel jumps between allocations rather than rotating.',
      'REDUCED_EFFECTS: each allocation is labelled with an icon rather than a coloured wash.',
    ],
    testSeeds: ['OFFICE-BSS018-0001', 'OFFICE-BSS018-0018'],
    music: 'MUS-FINANCE',
    silhouette: 'Three seated figures around a visible pie-chart wheel that dominates the centre.',
    coreIdea: 'A three-way trade-off you can rewrite: kill the armour vote and the whole committee gets softer.',
    original: 'Budget allocation as a boss whose defences and attacks come out of the same visible pot.',
  }),

  // -------------------------------------------------------------------------
  // BSS-019 Brand Manager — Marketing
  // Core fight: "Creates decoy bosses and false reward silhouettes while the real
  // attacks remain identifiable by shadow and audio."
  // -------------------------------------------------------------------------
  boss('BSS-019', 'brand_manager', {
    departments: ['MARKETING'],
    floorPools: ['BOSSPOOL-MARKETING_1', 'BOSSPOOL-MARKETING_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    maxHealth: 700,
    radius: 1.6,
    contactDamage: 2,
    phases: [
      {
        id: 'campaign_launch',
        entryCondition: { type: 'START' },
        patternWeights: [
          // Appendix E's role is a fairness clause: "Fairness depends on consistent tell,
          // never pure guessing." DECOY_SPAWN flags every decoy identifiable by shadow
          // and audio, and presentation is obliged to honour those flags.
          { pattern: 'DECOY_SPAWN', weight: 3, params: { count: 2, health: 6 } },
          { pattern: 'AIMED_VOLLEY', weight: 2, params: { count: 3, speed: 8 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'saturation',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          { pattern: 'DECOY_SPAWN', weight: 3, params: { count: 3, health: 6 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 16 } },
          { pattern: 'FAN_SWEEP', weight: 2, params: { count: 11, arcRadians: 1.6 } },
        ],
        movementRule: 'TELEPORT_STATIONS',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-ALTERNATE_MARKETING'],
    accessibilityVariants: [
      'REDUCED_MOTION: decoys appear without the flourish, keeping their shadow tell intact.',
      'REDUCED_EFFECTS: the real boss keeps a hard drop shadow while decoys have none — the tell is never removed by this setting.',
      'AUDIO_CAPTIONS: the real attack cue prints a caption, since one of the two tells is audio.',
    ],
    testSeeds: ['OFFICE-BSS019-0001', 'OFFICE-BSS019-0019'],
    music: 'MUS-MARKETING',
    silhouette: 'Identical to its own decoys by design — the difference is the drop shadow, which only the real one casts.',
    coreIdea: 'A target-identification fight where the tell is deliberately never visual-only.',
    original: 'Brand confusion as a mechanic, with a hard fairness rule: two independent tells, and no accessibility setting removes either.',
  }),

  // -------------------------------------------------------------------------
  // BSS-020 Viral Campaign — Marketing
  // Core fight: "A central campaign spreads copies through ad nodes. Destroying nodes
  // limits pattern replication."
  // -------------------------------------------------------------------------
  boss('BSS-020', 'viral_campaign', {
    departments: ['MARKETING'],
    floorPools: ['BOSSPOOL-MARKETING_1', 'BOSSPOOL-MARKETING_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'OPEN_CENTRE'],
    maxHealth: 740,
    radius: 1.8,
    contactDamage: 2,
    phases: [
      {
        id: 'seeding',
        entryCondition: { type: 'START' },
        patternWeights: [
          // Nodes here REPLICATE patterns rather than shield the boss, so destroying them
          // reduces incoming volume directly. Appendix E: "Escalates visually but uses
          // bounded entity counts."
          { pattern: 'NODE_ACTIVATION', weight: 3, params: { count: 3, health: 9, firesPattern: 'AIMED_VOLLEY' } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 12 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'going_viral',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          { pattern: 'NODE_ACTIVATION', weight: 3, params: { count: 4, health: 9, firesPattern: 'RADIAL_BURST' } },
          { pattern: 'SPIRAL_STREAM', weight: 2, params: { arms: 3 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 18 } },
        ],
        movementRule: 'ORBIT_CENTRE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: node replication is a fade-in rather than an outward spread.',
      'REDUCED_EFFECTS: active nodes show a filled ring rather than a shimmering halo.',
    ],
    testSeeds: ['OFFICE-BSS020-0001', 'OFFICE-BSS020-0020'],
    music: 'MUS-MARKETING',
    silhouette: 'A small bright core surrounded by evenly spaced satellite nodes; the ring is the read.',
    coreIdea: 'Incoming volume is a number you can lower: every node destroyed removes a copy of the pattern.',
    original: 'Virality as literal pattern replication, with a hard entity cap so escalation stays readable.',
  }),
];

export default bosses;
