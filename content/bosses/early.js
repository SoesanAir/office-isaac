/**
 * Bosses BSS-001..010: Open Office, IT, and early Operations.
 *
 * GDD refs: Appendix E (BSS-001..010; each Core fight line is quoted above its boss),
 *           15.2 (selection from floor pools), 15.3 (the R-BSS-001..007 contract),
 *           15.4 (the phase template), 3.6 (the first ten minutes use generous
 *           telegraphs and one or two clearly different behaviours), 18.3 (silhouette
 *           readability), H.2 (originality review).
 *
 * Health is calibrated against the player's unmodified baseline of roughly 20 damage per
 * second — 10 per Keyboard shot at a 0.45s interval. BSS-001 at 240 health is therefore
 * about a 60-second fight for a player who found nothing, which is the introductory pace
 * GDD 3.6 asks for. Later entries scale up from there rather than from a curve.
 *
 * The through-line of this file is that the early bosses each teach exactly one thing:
 * BSS-001 teaches "kill the support first", BSS-003 teaches timed windows, BSS-005
 * teaches "destroy the objective to shorten the wait", BSS-008 teaches "make your own
 * firing lane". None of them teach two things at once.
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
  healthScalingPerDepth: spec.healthScalingPerDepth ?? 0.15,
  radius: spec.radius,
  contactDamage: spec.contactDamage,
  phases: spec.phases,
  telegraphMinimumSeconds: spec.telegraphMinimumSeconds ?? 0.6,
  // R-BSS-006 is not a per-boss decision; the schema rejects false. Stated once.
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
  // BSS-001 The Team Lead — Open Office I
  // Core fight: "Buffs Office Drones with visible buzzword rings, fires simple radial
  // notes, and becomes aggressive when alone."
  // -------------------------------------------------------------------------
  boss('BSS-001', 'team_lead', {
    departments: ['OPEN_OFFICE'],
    floorPools: ['BOSSPOOL-OPEN_OFFICE_1'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    // The simplest thing in the file, on purpose. GDD 3.6: the first ten minutes get
    // "one or two clearly different enemy behaviours and generous telegraphs".
    maxHealth: 240,
    healthScalingPerDepth: 0.12,
    radius: 1.3,
    contactDamage: 1,
    // The most generous telegraph in the game. This is the first boss a player meets.
    telegraphMinimumSeconds: 1.0,
    phases: [
      {
        id: 'delegating',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SUMMON_ADDS', weight: 2, params: { enemyId: 'ENM-001', count: 2, maxAlive: 3, graceSeconds: 1.0 } },
          { pattern: 'BUFF_ADDS', weight: 3, params: { radius: 5, seconds: 4, magnitude: 0.25 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 8, speed: 5.5, damage: 2 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        // "Becomes aggressive when alone" — the exit is the adds dying, not a health
        // threshold, so the player controls when phase two starts. That is the lesson.
        exitCondition: { type: 'ADDS_CLEARED', value: 0 },
        invulnerable: false,
      },
      {
        id: 'hands_on',
        entryCondition: { type: 'ADDS_CLEARED', value: 0 },
        patternWeights: [
          { pattern: 'RADIAL_BURST', weight: 3, params: { count: 10, speed: 6, damage: 2 } },
          { pattern: 'AIMED_VOLLEY', weight: 2, params: { count: 3, spread: 0.2 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    unlockHooks: ['UNLOCK-TEAM_PLAYER_BADGE'],
    setDrop: {
      // Appendix E: "Drops a normal Manager Reward; rare set drop: Team Player Badge."
      // replacesManagerReward is false, so R-BSS-002's single reward still appears.
      contentId: 'CHR-014',
      chance: 0.08,
      replacesManagerReward: false,
    },
    accessibilityVariants: [
      'REDUCED_MOTION: buzzword rings pulse in place rather than expanding outward.',
      'REDUCED_EFFECTS: buffed drones carry a small chevron badge instead of an animated aura.',
    ],
    testSeeds: ['OFFICE-BSS001-0001', 'OFFICE-BSS001-0002'],
    music: 'MUS-OPEN_OFFICE',
    silhouette: 'Ordinary office worker proportions but a head taller than a drone, holding a rolled-up agenda.',
    coreIdea: 'Teaches one habit and nothing else: kill the support before the thing it supports.',
    original: 'A team lead whose only real power is other people, and who is genuinely worse at the job alone.',
  }),

  // -------------------------------------------------------------------------
  // BSS-002 Copy Chief — Open Office I-II
  // Core fight: "A giant copier rotates between paper fan, straight sheet wave, jammed
  // add spawn, and toner burst."
  // -------------------------------------------------------------------------
  boss('BSS-002', 'copy_chief', {
    departments: ['OPEN_OFFICE'],
    floorPools: ['BOSSPOOL-OPEN_OFFICE_1', 'BOSSPOOL-OPEN_OFFICE_2'],
    arenaTags: ['BOSS_ARENA', 'COVER_HEAVY'],
    maxHealth: 320,
    radius: 2.0,
    contactDamage: 2,
    telegraphMinimumSeconds: 0.9,
    phases: [
      {
        id: 'collating',
        entryCondition: { type: 'START' },
        // "Rotates between" four named attacks. Equal weights make the rotation feel
        // like a machine cycling modes rather than a fighter choosing.
        patternWeights: [
          { pattern: 'FAN_SWEEP', weight: 2, params: { count: 9, arcRadians: 1.4 } },
          { pattern: 'SHEET_WAVE', weight: 2, params: { count: 9, speed: 3.2 } },
          { pattern: 'TONER_BURST', weight: 2, params: { size: 4, seconds: 3.5 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        invulnerable: false,
      },
      {
        id: 'jammed',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        patternWeights: [
          { pattern: 'SUMMON_ADDS', weight: 2, params: { enemyId: 'ENM-003', count: 2, maxAlive: 4 } },
          { pattern: 'FAN_SWEEP', weight: 2, params: { count: 11, arcRadians: 1.6 } },
          { pattern: 'SHEET_WAVE', weight: 3, params: { count: 11, speed: 3.6 } },
          { pattern: 'TONER_BURST', weight: 1, params: { size: 5, seconds: 4 } },
        ],
        movementRule: 'LANE_BOUND',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    setDrop: {
      // Appendix E offers "Printer Ink or Copier weapon". Printer Ink is the safer of
      // the two here: a guaranteed weapon this early would flatten the weapon economy.
      contentId: 'ITM-034',
      chance: 0.1,
      replacesManagerReward: false,
    },
    accessibilityVariants: [
      'REDUCED_MOTION: the paper fan appears as a static arc that fades rather than sweeping.',
      'REDUCED_EFFECTS: the toner cloud uses a stippled border instead of a drifting particle field.',
    ],
    testSeeds: ['OFFICE-BSS002-0001', 'OFFICE-BSS002-0005'],
    music: 'MUS-OPEN_OFFICE',
    silhouette: 'The widest low box in the early game, with a lid that visibly lifts before each mode change.',
    coreIdea: 'A machine, not a person: it announces its mode with a mechanical action and never bluffs.',
    original: 'The office copier as a boss whose four attacks are its four documented functions.',
  }),

  // -------------------------------------------------------------------------
  // BSS-003 Scrum Master — Open Office II
  // Core fight: "Creates timed stand-up zones, dashes at the end of each countdown, and
  // summons brief Meeting Clusters."
  // -------------------------------------------------------------------------
  boss('BSS-003', 'scrum_master', {
    departments: ['OPEN_OFFICE'],
    floorPools: ['BOSSPOOL-OPEN_OFFICE_2'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 360,
    radius: 1.3,
    contactDamage: 2,
    // Appendix E's role: "Teaches timed windows without long invulnerability." So the
    // telegraph is long and NO phase here is invulnerable at all.
    telegraphMinimumSeconds: 1.0,
    phases: [
      {
        id: 'stand_up',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'ZONE_CONTROL', weight: 3, params: { count: 4, safeGapCount: 2, delaySeconds: 2.2 } },
          { pattern: 'TARGETED_SLAM', weight: 2, params: { radius: 2.2, damage: 2, delaySeconds: 0.35 } },
        ],
        movementRule: 'CHARGE_AND_RECOVER',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        invulnerable: false,
      },
      {
        id: 'sprint',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        patternWeights: [
          { pattern: 'ZONE_CONTROL', weight: 3, params: { count: 5, safeGapCount: 2, delaySeconds: 1.8 } },
          { pattern: 'CONTACT_CHARGE', weight: 3, params: { speed: 12, recoverySeconds: 1.0 } },
          { pattern: 'SUMMON_ADDS', weight: 1, params: { enemyId: 'ENM-009', count: 1, maxAlive: 2 } },
        ],
        movementRule: 'CHARGE_AND_RECOVER',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: zone countdowns show a numeral rather than a shrinking ring.',
      'REDUCED_EFFECTS: the dash draws a single straight streak instead of a motion trail.',
    ],
    testSeeds: ['OFFICE-BSS003-0001', 'OFFICE-BSS003-0003'],
    music: 'MUS-OPEN_OFFICE',
    silhouette: 'Lean figure in constant motion, one arm always raised holding a timer.',
    coreIdea: 'Every attack is on a visible clock; the fight is about where you are when it hits zero.',
    original: 'The daily stand-up as a timed floor hazard, with the dash arriving exactly on schedule.',
  }),

  // -------------------------------------------------------------------------
  // BSS-004 The Open Plan — Open Office II
  // Core fight: "The room itself shifts cubicle dividers while a central manager node
  // fires patterns and exposes weak points."
  // -------------------------------------------------------------------------
  boss('BSS-004', 'the_open_plan', {
    departments: ['OPEN_OFFICE'],
    floorPools: ['BOSSPOOL-OPEN_OFFICE_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'MOVING_GEOMETRY'],
    maxHealth: 420,
    // Anchored and central: the boss IS the room, so it never moves and never chases.
    radius: 1.8,
    contactDamage: 2,
    phases: [
      {
        id: 'reconfiguring',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SWEEPING_WALL', weight: 3, params: { axis: 'HORIZONTAL', gapCount: 2, gapWidth: 3, seconds: 6 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 12 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'exposed_node',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          // The weak point is the reward for surviving the wall phase, and it is drawn
          // explicitly — R-BSS-004 forbids an invisible damage multiplier.
          { pattern: 'WEAK_POINT_EXPOSE', weight: 2, params: { radius: 1.4, damageMul: 2.5, seconds: 3 } },
          { pattern: 'SWEEPING_WALL', weight: 2, params: { axis: 'VERTICAL', gapCount: 2, seconds: 6 } },
          { pattern: 'SPIRAL_STREAM', weight: 2, params: { arms: 2 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: dividers fade between positions rather than sliding.',
      'REDUCED_EFFECTS: the weak point is a solid marker rather than a pulsing glow.',
    ],
    testSeeds: ['OFFICE-BSS004-0001', 'OFFICE-BSS004-0004'],
    music: 'MUS-OPEN_OFFICE',
    silhouette: 'Barely a body at all: a low central hub, read mainly by the moving walls around it.',
    coreIdea: 'The architecture attacks and the boss is a fixture; the fight is about lane discipline.',
    original: 'Open-plan redesign as an enemy. The walls move, the manager does not, and the gaps are always there.',
  }),

  // -------------------------------------------------------------------------
  // BSS-005 Sysadmin — IT I
  // Core fight: "Activates terminal nodes, deploys firewall lines, and uses a
  // predictable command cycle."
  // -------------------------------------------------------------------------
  boss('BSS-005', 'sysadmin', {
    departments: ['IT'],
    floorPools: ['BOSSPOOL-IT_1'],
    arenaTags: ['BOSS_ARENA', 'COVER_HEAVY', 'MULTI_LEVEL_POWER'],
    maxHealth: 400,
    radius: 1.4,
    contactDamage: 2,
    phases: [
      {
        id: 'command_cycle',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SWEEPING_BEAM', weight: 2, params: { sweepRadians: 1.8, sweepSeconds: 2.2 } },
          { pattern: 'SHOCK_LINE', weight: 2, params: { count: 2, length: 8 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 3 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        invulnerable: false,
      },
      {
        id: 'shielded',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        patternWeights: [
          // Appendix E: "Destroying nodes shortens shield phases." The nodes are what
          // make this invulnerable phase legal at all under R-BSS-004 — there is always
          // something to shoot, and the cap means failing to break them cannot strand
          // the fight.
          { pattern: 'NODE_ACTIVATION', weight: 3, params: { count: 3, health: 10 } },
          { pattern: 'SHOCK_LINE', weight: 2, params: { count: 3 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'NODES_DESTROYED', value: 3 },
        invulnerable: true,
        attackableDuringInvuln: true,
        maxInvulnerableSeconds: 5,
      },
      {
        id: 'root_access',
        entryCondition: { type: 'NODES_DESTROYED', value: 3 },
        patternWeights: [
          { pattern: 'SWEEPING_BEAM', weight: 3, params: { sweepRadians: 2.4, sweepSeconds: 2.0 } },
          { pattern: 'SHOCK_LINE', weight: 2, params: { count: 3, length: 10 } },
        ],
        movementRule: 'TELEPORT_STATIONS',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    setDrop: {
      // "Rare set drop: Master Access fragment" — ITM-041 Master Access Badge is the
      // finished article, so it is the fragment's payoff and gated at a low chance.
      contentId: 'ITM-041',
      chance: 0.05,
      replacesManagerReward: false,
    },
    accessibilityVariants: [
      'REDUCED_MOTION: the beam snaps between angles in discrete steps rather than sweeping.',
      'REDUCED_EFFECTS: firewall lines draw as dashed borders instead of animated arcs.',
      'AUDIO_CAPTIONS: each command in the cycle prints its name, since the tell is partly audio.',
    ],
    testSeeds: ['OFFICE-BSS005-0001', 'OFFICE-BSS005-0006'],
    music: 'MUS-IT',
    silhouette: 'Seated figure surrounded by three floating terminal nodes; the nodes dominate the outline.',
    coreIdea: 'Teaches that an objective can be shorter than a timer: break the nodes and the wait ends early.',
    original: 'A sysadmin whose defence is infrastructure you can unplug, with a predictable command rotation as the tell.',
  }),

  // -------------------------------------------------------------------------
  // BSS-006 Helpdesk Hydra — IT I-II
  // Core fight: "Multiple phone heads perform distinct calls: tickets, shock lines,
  // summons, and repair. Heads can be disabled independently."
  // -------------------------------------------------------------------------
  boss('BSS-006', 'helpdesk_hydra', {
    departments: ['IT'],
    floorPools: ['BOSSPOOL-IT_1', 'BOSSPOOL-IT_2'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 460,
    // "Head count and pattern scale by floor", so this scales harder than its neighbours.
    healthScalingPerDepth: 0.2,
    radius: 1.9,
    contactDamage: 2,
    phases: [
      {
        id: 'all_lines_open',
        entryCondition: { type: 'START' },
        patternWeights: [
          // HEAD_ROTATION is round-robin, not random: Appendix E says the heads "perform
          // distinct calls", so the player is meant to learn the order and disable the
          // worst head first. A weighted roll would erase that decision.
          { pattern: 'HEAD_ROTATION', weight: 4, params: { fallbackPattern: 'AIMED_VOLLEY' } },
          { pattern: 'SHOCK_LINE', weight: 1, params: { count: 2 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        invulnerable: false,
      },
      {
        id: 'escalated',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.5 },
        patternWeights: [
          { pattern: 'HEAD_ROTATION', weight: 4, params: { fallbackPattern: 'AIMED_VOLLEY' } },
          { pattern: 'SUMMON_ADDS', weight: 2, params: { enemyId: 'ENM-015', count: 2, maxAlive: 4 } },
          { pattern: 'SHOCK_LINE', weight: 2, params: { count: 3, length: 9 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: heads snap to their firing pose instead of rearing back.',
      'REDUCED_EFFECTS: each head keeps a distinct fixed colour so its call type stays identifiable.',
    ],
    testSeeds: ['OFFICE-BSS006-0001', 'OFFICE-BSS006-0007'],
    music: 'MUS-IT',
    silhouette: 'A tangle of cords rising into several handsets; the only multi-headed outline in the early game.',
    coreIdea: 'A target-priority puzzle: four attack types on one body, each disableable on its own.',
    original: 'A helpdesk queue as a hydra, where the repair head is the one that undoes your progress.',
  }),

  // -------------------------------------------------------------------------
  // BSS-007 Legacy System — IT II
  // Core fight: "Large old server with slow, punishing phases, rotating obsolete
  // patterns, and a final overclock meltdown."
  // -------------------------------------------------------------------------
  boss('BSS-007', 'legacy_system', {
    departments: ['IT'],
    floorPools: ['BOSSPOOL-IT_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'COVER_HEAVY'],
    // Appendix E: "Deliberately predictable once learned; high health but generous
    // tells." The highest health in this file, paired with the longest telegraph.
    maxHealth: 640,
    radius: 2.3,
    contactDamage: 3,
    telegraphMinimumSeconds: 1.1,
    phases: [
      {
        id: 'obsolete_rotation',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SPIRAL_STREAM', weight: 3, params: { arms: 2, stepRadians: 0.28, speed: 5 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 14, speed: 5.5 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'degraded',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          { pattern: 'SPIRAL_STREAM', weight: 3, params: { arms: 3, stepRadians: 0.34 } },
          { pattern: 'SHOCK_LINE', weight: 2, params: { count: 3 } },
          { pattern: 'TONER_BURST', weight: 1, params: { size: 5, seconds: 4 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.25 },
        invulnerable: false,
      },
      {
        id: 'overclock_meltdown',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.25 },
        patternWeights: [
          { pattern: 'RADIAL_BURST', weight: 3, params: { count: 20, speed: 7 } },
          { pattern: 'SPIRAL_STREAM', weight: 3, params: { arms: 4, stepRadians: 0.42 } },
          { pattern: 'SHOCK_LINE', weight: 2, params: { count: 4 } },
        ],
        movementRule: 'ANCHORED',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: the meltdown screen shake is replaced by a border flash.',
      'REDUCED_EFFECTS: spiral arms draw as discrete dots rather than a continuous stream.',
    ],
    testSeeds: ['OFFICE-BSS007-0001', 'OFFICE-BSS007-0002'],
    music: 'MUS-IT',
    silhouette: 'A tall cabinet twice player height, indicator lights climbing as the meltdown approaches.',
    coreIdea: 'The endurance fight of the early game: nothing here is surprising, and that is the point.',
    original: 'Unmaintained infrastructure as a slow heavy boss whose escalation is legible from its own status lights.',
  }),

  // -------------------------------------------------------------------------
  // BSS-008 Firewall — IT II
  // Core fight: "Mobile shield walls divide the room while a core fires through
  // approved gaps."
  // -------------------------------------------------------------------------
  boss('BSS-008', 'firewall', {
    departments: ['IT'],
    floorPools: ['BOSSPOOL-IT_2'],
    arenaTags: ['BOSS_ARENA', 'LARGE_ROOM', 'MOVING_GEOMETRY'],
    maxHealth: 520,
    radius: 1.7,
    contactDamage: 2,
    phases: [
      {
        id: 'default_deny',
        entryCondition: { type: 'START' },
        patternWeights: [
          // The gap is the mechanic here, not a safety valve: the core fires THROUGH the
          // approved gap, so the safe lane and the firing lane are the same lane.
          { pattern: 'SWEEPING_WALL', weight: 3, params: { axis: 'VERTICAL', gapCount: 2, gapWidth: 3, seconds: 7 } },
          { pattern: 'AIMED_VOLLEY', weight: 3, params: { count: 4, spread: 0.12, speed: 8 } },
        ],
        movementRule: 'LANE_BOUND',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        invulnerable: false,
      },
      {
        id: 'open_ports',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.55 },
        patternWeights: [
          // Appendix E: "Player can destroy temporary ports to create attack lanes." The
          // ports are nodes, so the counterplay is to make your own lane.
          { pattern: 'NODE_ACTIVATION', weight: 3, params: { count: 4, health: 8 } },
          { pattern: 'SWEEPING_WALL', weight: 2, params: { axis: 'HORIZONTAL', gapCount: 2, seconds: 6 } },
          { pattern: 'SWEEPING_BEAM', weight: 2, params: { sweepRadians: 1.6 } },
        ],
        movementRule: 'LANE_BOUND',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: shield walls jump to their next position with a hold frame.',
      'REDUCED_EFFECTS: approved gaps are outlined in a solid colour rather than shimmering.',
    ],
    testSeeds: ['OFFICE-BSS008-0001', 'OFFICE-BSS008-0008'],
    music: 'MUS-IT',
    silhouette: 'A small hard core flanked by two tall slabs; the slabs are what you see first.',
    coreIdea: 'The only fight where the safe lane and the firing lane are the same lane.',
    original: 'Default-deny networking as level geometry, with destroying a port as the way to open your own line of fire.',
  }),

  // -------------------------------------------------------------------------
  // BSS-009 The Bottleneck — Operations I
  // Core fight: "Deploys pallets, narrows movement, and launches charges through the
  // remaining lane."
  // -------------------------------------------------------------------------
  boss('BSS-009', 'the_bottleneck', {
    departments: ['OPERATIONS'],
    floorPools: ['BOSSPOOL-OPERATIONS_1'],
    arenaTags: ['BOSS_ARENA', 'COVER_HEAVY', 'CONVEYOR'],
    maxHealth: 480,
    radius: 2.1,
    contactDamage: 3,
    phases: [
      {
        id: 'stacking',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'OBSTACLE_DEPLOY', weight: 3, params: { count: 4, safeGapCount: 2, health: 14 } },
          { pattern: 'AIMED_VOLLEY', weight: 2, params: { count: 3, speed: 7 } },
        ],
        movementRule: 'LANE_BOUND',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        invulnerable: false,
      },
      {
        id: 'single_lane',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.6 },
        patternWeights: [
          // Charges come down the lane the pallets left, so the fight rewards clearing
          // your own escape route. safeGapCount stays at two so a charge is dodgeable.
          { pattern: 'CONTACT_CHARGE', weight: 3, params: { speed: 14, recoverySeconds: 1.1 } },
          { pattern: 'OBSTACLE_DEPLOY', weight: 2, params: { count: 3, safeGapCount: 2 } },
          { pattern: 'CROSS_LANES', weight: 1, params: { axis: 'HORIZONTAL', safeGapCount: 2 } },
        ],
        movementRule: 'CHARGE_AND_RECOVER',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    setDrop: {
      // Appendix E: "Set drop: Extension Cord or Supply Cart charm."
      contentId: 'ITM-026',
      chance: 0.1,
      replacesManagerReward: false,
    },
    accessibilityVariants: [
      'REDUCED_MOTION: pallets drop in with no bounce settle.',
      'REDUCED_EFFECTS: the charge path is a flat filled band rather than a blurred streak.',
    ],
    testSeeds: ['OFFICE-BSS009-0001', 'OFFICE-BSS009-0009'],
    music: 'MUS-OPERATIONS',
    silhouette: 'A blocky loader whose front face is always the widest thing on screen.',
    coreIdea: 'The arena shrinks and the boss charges down what is left; managing objects IS the fight.',
    original: 'A logistics bottleneck as a boss that wins by leaving you one route and then using it.',
  }),

  // -------------------------------------------------------------------------
  // BSS-010 Shift Manager — Operations I-II
  // Core fight: "Schedules enemy waves on a visible board and joins combat between
  // calls."
  // -------------------------------------------------------------------------
  boss('BSS-010', 'shift_manager', {
    departments: ['OPERATIONS'],
    floorPools: ['BOSSPOOL-OPERATIONS_1', 'BOSSPOOL-OPERATIONS_2'],
    arenaTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    maxHealth: 500,
    radius: 1.4,
    contactDamage: 2,
    phases: [
      {
        id: 'scheduling',
        entryCondition: { type: 'START' },
        patternWeights: [
          { pattern: 'SUMMON_ADDS', weight: 4, params: { enemyId: 'ENM-004', count: 2, maxAlive: 4, graceSeconds: 0.9 } },
          { pattern: 'BUFF_ADDS', weight: 2, params: { radius: 5, seconds: 4 } },
          { pattern: 'AIMED_VOLLEY', weight: 1, params: { count: 2 } },
        ],
        movementRule: 'RETREAT_WHEN_CLOSE',
        // Appendix E's role: "Killing scheduled adds early creates safe downtime." The
        // exit is add-driven, so clearing fast is materially rewarded.
        exitCondition: { type: 'ADDS_CLEARED', value: 0 },
        invulnerable: false,
      },
      {
        id: 'covering_a_shift',
        entryCondition: { type: 'ADDS_CLEARED', value: 0 },
        patternWeights: [
          { pattern: 'AIMED_VOLLEY', weight: 3, params: { count: 4, spread: 0.16 } },
          { pattern: 'CONTACT_CHARGE', weight: 2, params: { speed: 11, recoverySeconds: 1.0 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        invulnerable: false,
      },
      {
        id: 'mandatory_overtime',
        entryCondition: { type: 'HEALTH_BELOW', value: 0.3 },
        patternWeights: [
          { pattern: 'SUMMON_ADDS', weight: 3, params: { enemyId: 'ENM-006', count: 2, maxAlive: 4 } },
          { pattern: 'RADIAL_BURST', weight: 2, params: { count: 14 } },
          { pattern: 'CONTACT_CHARGE', weight: 2, params: { speed: 13 } },
        ],
        movementRule: 'SLOW_PURSUE',
        exitCondition: { type: 'DEATH' },
        invulnerable: false,
      },
    ],
    accessibilityVariants: [
      'REDUCED_MOTION: the schedule board updates instantly rather than scrolling.',
      'REDUCED_EFFECTS: upcoming waves are listed as static icons instead of animated tickets.',
    ],
    testSeeds: ['OFFICE-BSS010-0001', 'OFFICE-BSS010-0010'],
    music: 'MUS-OPERATIONS',
    silhouette: 'Figure with a clipboard, standing beside a board taller than they are.',
    coreIdea: 'It tells you what is coming and when, then fights you personally in the gaps.',
    original: 'A shift rota as a boss mechanic: the schedule is public, and beating it early buys you quiet.',
  }),
];

export default bosses;
