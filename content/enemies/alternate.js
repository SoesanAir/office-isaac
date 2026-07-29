/**
 * ENM-049..ENM-058 — Marketing, Legal, Facilities, R&D, and the hidden departments.
 *
 * GDD refs: Appendix D.1 (cost, verbatim), D.2 / 14.2 (behaviour rows and counterplay),
 *           14.3 (readability contract), 14.4 (department continuity), 14.5
 *           (R-ENM-001..008), 20.3 (behaviour composed from curated modules; runtime AI
 *           generation is prohibited), 13.2 (hazard families).
 *
 * These ten cover six departments, so they are less a roster than a set of one-off ideas.
 * Two of them need their constraints stated plainly, because both are the kind of design
 * that becomes unfair if implemented literally:
 *
 * **ENM-049 Brand Double** creates a visual duplicate, and D.2 says "only the real one
 * casts the correct shadow and damage telegraph". Two independent tells, and neither may
 * be removed by an accessibility setting — the same rule BSS-019 Brand Manager follows.
 *
 * **ENM-058 Merger Abomination** combines two behaviour modules, and D.2 is explicit that
 * it is "generated only from curated compatibility pairs, not arbitrary AI assembly".
 * The pair list is authored data here, which is what keeps GDD 20.3 true.
 *
 * ENM-055 Prototype has the same shape of constraint: "one clearly signposted
 * experimental behavior selected from a curated list per spawn". Curated, signposted, and
 * one at a time.
 */

const enemies = [
  // -- ENM-049 Brand Double --------------------------------------------------
  // D.2: "Decoy: Creates a visual duplicate of itself; only the real one casts the correct
  // shadow and damage telegraph."
  {
    id: 'ENM-049',
    schemaVersion: 1,
    nameLoc: 'enemy.brand_double.name',
    spriteId: 'enemy_brand_double',
    homeDepartments: ['MARKETING'],
    tags: ['GROUND', 'MIMIC', 'SHOOTER'],
    cost: 1.0,
    health: 26,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'StrafeShooterController',
      movementClass: 'GROUND',
      baseSpeed: 2.8,
      params: { preferredDistance: 6, strafeHz: 0.9 },
    },
    ai: {
      states: ['SPAWN', 'DUPLICATE', 'AIM', 'FIRE', 'RECOVER'],
      telegraphSeconds: 0.45,
      params: {
        // Two independent tells, and both are mandatory. A decoy identifiable only by
        // shadow would break for a player with reduced effects; only by audio would
        // break for a player with sound off. Requiring both is the fairness rule.
        decoyCount: 1,
        realCastsShadow: true,
        realCastsTelegraph: true,
      },
    },
    attacks: [{
      id: 'campaign_shot',
      module: 'AimedProjectileAttack',
      cooldownSeconds: 2.2,
      telegraphSeconds: 0.45,
      damage: 1,
      damageTags: ['PROJECTILE'],
      params: { speed: 6.5, size: 0.9 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Identical to its own decoy by design; the difference is a hard drop shadow the copy does not cast. The outline is deliberately not the tell.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The copy has no shadow and never winds up. Watch the floor rather than the body, or wait one telegraph and only one of them will have moved.',
    originalityNote:
      'Brand confusion as a target-identification problem, with the fairness rule baked in: two independent tells, and no setting removes either.',
  },

  // -- ENM-050 Focus Tester --------------------------------------------------
  // D.2: "Attention controller: Projects a gaze cone that slows attack cadence if the
  // player remains inside after warning."
  {
    id: 'ENM-050',
    schemaVersion: 1,
    nameLoc: 'enemy.focus_tester.name',
    spriteId: 'enemy_focus_tester',
    homeDepartments: ['MARKETING'],
    tags: ['STATIONARY', 'DEBUFFER', 'ZONE_CONTROLLER'],
    cost: 1.0,
    health: 28,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'TRACK_PLAYER', reaimSeconds: 1.2 },
    },
    ai: {
      states: ['SPAWN', 'PROJECT_GAZE', 'WARN', 'APPLY', 'RECOVER'],
      telegraphSeconds: 0.6,
      // The debuff needs you to STAY in the cone past the warning, so it is a positional
      // tax rather than something that happens to you.
      params: { coneRadians: 0.9, coneRange: 7, warnSeconds: 0.8, requiresDwell: true },
    },
    attacks: [{
      id: 'attention_drain',
      module: 'StatusProjectileAttack',
      cooldownSeconds: 3.0,
      telegraphSeconds: 0.6,
      damage: 0,
      damageTags: ['STATUS'],
      // Zero damage. Its whole effect is cadence, which R-PLY-003's clamps bound, so it
      // can slow you but never lock you out.
      params: { status: 'SLOW', seconds: 2.0, magnitude: 0.3, affectsCadence: true, coneOnly: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Seated behind a one-way glass panel, so the upper body is a flat reflective rectangle rather than a head and shoulders.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Deals no damage and cannot move. Step out of the cone during the warning and nothing happens at all; it reaims slowly enough that circling defeats it.',
    originalityNote:
      'A focus group as attention denial. Being unable to deal damage is the point: it makes the room harder without ever being the thing that kills you.',
  },

  // -- ENM-051 Red Tape Roll -------------------------------------------------
  // D.2: "Growing obstacle: Rolls a strip across the floor that temporarily becomes a
  // collision wall, then retracts."
  {
    id: 'ENM-051',
    schemaVersion: 1,
    nameLoc: 'enemy.red_tape_roll.name',
    spriteId: 'enemy_red_tape_roll',
    homeDepartments: ['LEGAL'],
    tags: ['GROUND', 'BLOCKER', 'LANE_BOUND'],
    cost: 1.0,
    health: 32,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'PatrolController',
      movementClass: 'LANE_BOUND',
      baseSpeed: 3.4,
      params: { reverseAtEnd: true, laysTrail: true },
    },
    ai: {
      states: ['SPAWN', 'ROLL', 'HARDEN', 'RETRACT'],
      telegraphSeconds: 0.5,
      params: {},
    },
    attacks: [{
      id: 'tape_wall',
      module: 'PlaceObstacleAttack',
      cooldownSeconds: 4.0,
      telegraphSeconds: 0.5,
      damage: 0,
      damageTags: ['CONTACT'],
      // Temporary and always retracting (D.2), and PlaceObstacleAttack refuses to block
      // a required door or blast point (R-ENV-004). A permanent tape wall would be a
      // room-sealing enemy, which nothing in the game is allowed to be.
      params: { objectId: 'ENV-017', seconds: 4.5, health: 10, preserveGaps: 1, retractsAutomatically: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TINY', 'TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'A squat cylinder lying on its side with a visible unspooling strip trailing behind it; the trail is longer than the body.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The walls it lays always retract on a timer and never cover an exit. Wait one cycle, or break the strip, or shoot the roll while it is committed to a run.',
    originalityNote:
      'Red tape as a rolling, temporary collision wall. Making it retract on its own means the enemy inconveniences without ever trapping.',
  },

  // -- ENM-052 Clause --------------------------------------------------------
  // D.2: "Conditional attacker: Displays a simple icon condition such as moving or firing;
  // violates it and the Clause launches a punishment shot."
  {
    id: 'ENM-052',
    schemaVersion: 1,
    nameLoc: 'enemy.clause.name',
    spriteId: 'enemy_clause',
    homeDepartments: ['LEGAL'],
    tags: ['STATIONARY', 'SHOOTER', 'RULE_ENEMY'],
    cost: 1.0,
    health: 26,
    contactDamage: 0,
    radius: 0.34,
    movement: {
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'TRACK_PLAYER', reaimSeconds: 0.5 },
    },
    ai: {
      states: ['SPAWN', 'DISPLAY_CONDITION', 'WATCH', 'PUNISH', 'RECOVER'],
      telegraphSeconds: 0.35,
      // ONE condition at a time — D.2's variant note says even the elite "cycles two
      // conditions, never simultaneous". Two live conditions would be a contradiction
      // the player could not satisfy.
      params: { conditionPool: ['NO_MOVING', 'NO_FIRING'], oneAtATime: true },
    },
    attacks: [{
      id: 'punishment_shot',
      module: 'AimedProjectileAttack',
      cooldownSeconds: 1.4,
      telegraphSeconds: 0.35,
      damage: 1,
      damageTags: ['PROJECTILE'],
      params: { firesOnConditionViolated: true, speed: 8, size: 0.85 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'A small floating document with a large condition icon on its face; the icon occupies most of the silhouette and is the readable element.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The condition is drawn on it and only one applies at a time. Obey it for a moment to close distance, or eat one shot and kill it in three hits.',
    originalityNote:
      'A contract clause as a rule you can choose to break. Never more than one live condition is what separates it from an unfair puzzle.',
  },

  // -- ENM-053 Janitor -------------------------------------------------------
  // D.2: "Hazard manipulator: Moves spills, pushes debris, and swings a mop in a short
  // arc."
  {
    id: 'ENM-053',
    schemaVersion: 1,
    nameLoc: 'enemy.janitor.name',
    spriteId: 'enemy_janitor',
    homeDepartments: ['FACILITIES'],
    tags: ['GROUND', 'ZONE_CONTROLLER', 'CHASER'],
    cost: 1.0,
    health: 34,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'ChaseController',
      movementClass: 'GROUND',
      baseSpeed: 2.6,
      // Pushes hazards around rather than creating them, so a room with no spills makes
      // this enemy much weaker. Its danger is a property of the room.
      params: { separationRadius: 0.6, pushesHazards: true, pushesDebris: true },
    },
    ai: {
      states: ['SPAWN', 'APPROACH', 'SWING', 'RECOVER'],
      telegraphSeconds: 0.45,
      params: {},
    },
    attacks: [{
      id: 'mop_arc',
      module: 'RadialPulseAttack',
      cooldownSeconds: 2.0,
      telegraphSeconds: 0.45,
      damage: 1,
      damageTags: ['MELEE'],
      params: { radius: 1.6, arcRadians: 1.8 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Carries a long mop held diagonally, extending the silhouette well past the body outline in one direction — the only melee hostile with visible reach.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Short reach and a clear wind-up. Stay outside the mop arc, and note that it can only relocate hazards the room already has.',
    originalityNote:
      'A janitor who fights by rearranging the mess rather than adding to it, so how dangerous it is depends entirely on the room it spawns in.',
  },

  // -- ENM-054 The Leak ------------------------------------------------------
  // D.2: "Spawned hazard entity: A moving puddle source that creates water paths and
  // retreats from electricity."
  {
    id: 'ENM-054',
    schemaVersion: 1,
    nameLoc: 'enemy.the_leak.name',
    spriteId: 'enemy_the_leak',
    homeDepartments: ['FACILITIES'],
    tags: ['GROUND', 'ZONE_CONTROLLER', 'COWARD'],
    cost: 1.0,
    health: 24,
    contactDamage: 0,
    radius: 0.36,
    movement: {
      controller: 'FleeController',
      movementClass: 'GROUND',
      baseSpeed: 2.0,
      // "Retreats from electricity" (D.2) is the counterplay written into movement: an
      // electrified room chases it into a corner for you.
      params: { preferredDistance: 5, avoidsHazardFamily: 'ELECTRICITY' },
    },
    ai: {
      states: ['SPAWN', 'SEEP', 'RETREAT'],
      telegraphSeconds: 0.4,
      params: {},
    },
    attacks: [{
      id: 'water_path',
      module: 'TrailHazardAttack',
      cooldownSeconds: 1.2,
      telegraphSeconds: 0.4,
      damage: 0,
      damageTags: ['HAZARD'],
      // Water alone does not damage — it makes you slide. It becomes lethal only in
      // combination with the department's electrical hazards, which is the point.
      params: { hazardId: 'HAZ-SPILL_WATER_SLICK', seconds: 6, alongPath: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Barely a body: a low spreading form no taller than the puddle it leaves, read almost entirely by its trail.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Harmless on its own — water only makes you slide. Kill it before the room electrifies, or herd it toward an outlet, which it will refuse to approach.',
    originalityNote:
      'A plumbing leak as an enemy that manufactures a hazard combination rather than damage. Its fear of electricity turns the room into the weapon.',
  },

  // -- ENM-055 Prototype ----------------------------------------------------
  // D.2: "Unstable behavior: Uses one clearly signposted experimental behavior selected
  // from a curated list per spawn."
  {
    id: 'ENM-055',
    schemaVersion: 1,
    nameLoc: 'enemy.prototype.name',
    spriteId: 'enemy_prototype',
    homeDepartments: ['RND'],
    tags: ['GROUND', 'SHOOTER'],
    cost: 1.0,
    health: 30,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'StrafeShooterController',
      movementClass: 'GROUND',
      baseSpeed: 2.8,
      params: { preferredDistance: 5.5, strafeHz: 0.8 },
    },
    ai: {
      states: ['SPAWN', 'SIGNPOST', 'AIM', 'FIRE', 'RECOVER'],
      telegraphSeconds: 0.5,
      // CURATED and one per spawn (D.2), chosen once at spawn from an authored list.
      // GDD 20.3 prohibits runtime behaviour generation, so "unstable" means "one of
      // these five, picked by the seed", never "assembled on the fly".
      params: {
        experimentPool: ['SpreadShot', 'BeamAttack', 'RotatingFourWay', 'SplitProjectileOnImpact', 'ChargeBounce'],
        pickOnePerSpawn: true,
        signpostSeconds: 0.6,
      },
    },
    attacks: [{
      id: 'experimental_fire',
      module: 'SpreadProjectileAttack',
      cooldownSeconds: 2.4,
      telegraphSeconds: 0.5,
      damage: 1,
      damageTags: ['PROJECTILE'],
      params: { count: 3, spreadRadians: 0.35, speed: 6.5 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Exposed frame with one visibly different module bolted to its back; the module changes shape per spawn and is the signpost for which experiment it is running.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Signposts which experiment it is running before it fires, and it only ever runs one. Read the module on its back and treat it as whichever enemy that makes it.',
    originalityNote:
      'An unfinished prototype whose variety comes from a curated list rather than from randomness. The signpost is what makes an unstable enemy fair.',
  },

  // -- ENM-056 Archive Shade ------------------------------------------------
  // D.2: "Phase ambusher: Moves beneath paper piles, then rises with a radial burst after
  // a warning rustle."
  {
    id: 'ENM-056',
    schemaVersion: 1,
    nameLoc: 'enemy.archive_shade.name',
    spriteId: 'enemy_archive_shade',
    homeDepartments: ['SECRET'],
    tags: ['GROUND', 'TELEPORTER', 'SHOOTER'],
    cost: 1.0,
    health: 28,
    contactDamage: 1,
    radius: 0.38,
    movement: {
      controller: 'EdgeBlinkController',
      movementClass: 'TELEPORTER',
      baseSpeed: 0,
      // Submerged travel with a surfacing rustle: the warning is audible AND visual
      // (the paper moves), because an invisible ambusher would be pure damage.
      params: { submergedTravel: true, surfaceWarnSeconds: 0.7 },
    },
    ai: {
      states: ['SUBMERGED', 'RUSTLE_WARN', 'RISE', 'BURST', 'SUBMERGE'],
      telegraphSeconds: 0.7,
      params: {},
    },
    attacks: [{
      id: 'rising_burst',
      module: 'RadialProjectileAttack',
      cooldownSeconds: 3.6,
      telegraphSeconds: 0.7,
      damage: 1,
      damageTags: ['PROJECTILE'],
      params: { count: 8, speed: 5.5, size: 0.9 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'OBJECT_ANCHOR'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'While submerged, only a moving ridge in the paper. Risen, a tall thin form with a ragged upper edge and no legs.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The rustle warns you before it surfaces and the burst is radial, so gaps are wide. Step off the ridge and shoot it during the rise, when it cannot submerge.',
    originalityNote:
      'Something living in the archive that travels under the paperwork. The rustle exists so an ambusher is never actually a surprise.',
  },

  // -- ENM-057 Shareholder Eye ----------------------------------------------
  // D.2: "Tracking turret: Floats above obstacles and follows the player with a thin
  // targeting line before firing."
  {
    id: 'ENM-057',
    schemaVersion: 1,
    nameLoc: 'enemy.shareholder_eye.name',
    spriteId: 'enemy_shareholder_eye',
    homeDepartments: ['BOARD'],
    tags: ['FLYING', 'SHOOTER', 'PREDICTIVE'],
    cost: 2.0,
    health: 30,
    contactDamage: 0,
    radius: 0.34,
    movement: {
      controller: 'StandoffShooterController',
      movementClass: 'FLYING',
      baseSpeed: 2.4,
      // Floats above obstacles (D.2), so cover stops its shot but not its approach.
      params: { preferredDistance: 8, ignoresObstacles: true },
    },
    ai: {
      states: ['SPAWN', 'TRACK', 'LOCK', 'FIRE', 'RECOVER'],
      // The targeting line IS the telegraph and it is long, which is what makes a
      // tracking turret readable rather than oppressive.
      telegraphSeconds: 0.8,
      predictionSeconds: 0.2,
      params: { drawsTargetingLine: true },
    },
    attacks: [{
      id: 'tracked_shot',
      module: 'PathDamageAttack',
      cooldownSeconds: 3.0,
      telegraphSeconds: 0.8,
      damage: 1,
      damageTags: ['BEAM'],
      params: { width: 0.4, visibleWhileTracking: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['AIR'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'A single floating lens with no body, trailing a thin bright line to wherever it is aiming; the line is longer than anything else on screen.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The targeting line shows exactly where the shot will land, well before it lands. Break the line with cover, or move once it locks.',
    originalityNote:
      'Shareholder attention as a floating eye that shows its aim. No contact damage at all, so it is purely a positioning threat.',
  },

  // -- ENM-058 Merger Abomination -------------------------------------------
  // D.2: "Composite elite: Combines two approved enemy behavior modules and a fused
  // corporate silhouette." Variant note: "Generated only from curated compatibility
  // pairs, not arbitrary AI assembly."
  {
    id: 'ENM-058',
    schemaVersion: 1,
    nameLoc: 'enemy.merger_abomination.name',
    spriteId: 'enemy_merger_abomination',
    homeDepartments: ['CONGLOMERATE'],
    tags: ['GROUND', 'ELITE', 'ARMORED', 'CHASER'],
    cost: 2.0,
    health: 90,
    contactDamage: 2,
    radius: 0.6,
    movement: {
      controller: 'ChaseShooterController',
      movementClass: 'GROUND',
      baseSpeed: 2.8,
      params: { separationRadius: 0.7, preferredDistance: 4 },
    },
    ai: {
      states: ['SPAWN', 'PURSUE', 'AIM', 'FIRE', 'RECOVER'],
      telegraphSeconds: 0.5,
      params: {
        // The compatibility pairs are AUTHORED, which is the whole of GDD 20.3's
        // requirement: no arbitrary assembly, no runtime AI generation. Each pair is a
        // combination a designer signed off on, and the fused silhouette has to read as
        // both halves.
        compatibilityPairs: [
          ['ArmorPlate', 'SpreadShot'],
          ['MobileShield', 'RotatingFourWay'],
          ['AccelerateOverTime', 'DeathExplosion'],
          ['SplitOnDeath', 'StatusOnHit'],
        ],
        pickOnePairPerSpawn: true,
      },
    },
    attacks: [{
      id: 'fused_volley',
      module: 'SpreadProjectileAttack',
      cooldownSeconds: 2.6,
      telegraphSeconds: 0.5,
      damage: 1,
      damageTags: ['PROJECTILE'],
      params: { count: 3, spreadRadians: 0.4, speed: 6.5 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TINY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Visibly two enemies fused down one vertical seam, each half keeping its original outline; the asymmetry is the read and it tells you which two modules it has.',
    audio: { telegraph: 'SFX-TELEGRAPH_HEAVY', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Its silhouette announces both halves, so it is two known enemies rather than an unknown one. Answer whichever half is more dangerous to your build.',
    originalityNote:
      'A merger as a literal fusion of two staff members. Authoring the compatibility pairs rather than generating them is what keeps it honest under GDD 20.3.',
  },
];

export default enemies;
