/**
 * ENM-001..ENM-024 — Open Office and IT rosters.
 *
 * Content kind: enemy. `src/schemas.js` (enemySchema) is normative; GDD Appendix
 * D.1/D.2 is the design authority for cost, behaviour archetype and approved
 * variants.
 *
 * GDD refs: 14.1 (individually readable, collectively dangerous), 14.2 (the
 *           thirteen-behaviour taxonomy and its counterplay column), 14.3
 *           (readability contract: unique silhouette, authored wind-up / active /
 *           recovery states, visible support links), 14.4 (department
 *           continuity), 14.5 (R-ENM-001..008), 6.6 (difficulty budget — `cost`
 *           is the currency encounters spend), 5.1 (player baseline: 10 damage
 *           per hit, 0.45s interval, 5.5 wu/s), 5.2 (health in half-units),
 *           3.6 (the first hostile rooms use generous telegraphs), 18.2 (32px
 *           reference grid; 1 world unit = 32px), D.1 (cost table, used verbatim).
 *
 * Authoring conventions used throughout this file:
 *
 * - **`cost` is copied verbatim from Appendix D.1.** It is an encounter-budget
 *   estimate, not a difficulty claim, and it is deliberately *not* re-derived
 *   from health or damage. Where a cost looks odd next to its stats (ENM-018
 *   Server Rack Turret at 1.0 is a genuinely dangerous stationary threat) the
 *   table still wins — D.1 says production tuning may change these later.
 * - **`health` is expressed in player hits.** Baseline damage is 10 (GDD 5.1),
 *   so 24 health is three Keyboard hits, 45 is five, 130 is thirteen. Trash
 *   sits at 2-3 hits, ranged anchors at 3-4, the ENM-010 tank at 13.
 * - **`contactDamage` is in half-units** (6 half-units = 3 Composure icons).
 *   Almost everything is 1 — a normal touch. 2 is reserved for a committed
 *   high-speed body: the Rolling Chair Rider's charge and the Coffee Sprinter's
 *   dash. Support and coward units are 0 or 1 so they never punish the player
 *   for prioritising them.
 * - **`radius` is in world units** (1 unit = 32px). An ordinary humanoid is
 *   0.40. Interns and small bots are smaller, the tank and the racks larger.
 *   The value matches the authored sprite's occupied width, not its bounding box
 *   (R-ENV-001's spirit applied to hostiles).
 * - **Telegraphs.** Open Office (depths 1-2) never telegraphs faster than 0.45s;
 *   GDD 3.6 asks for generous telegraphs in the first hostile rooms and this is
 *   where that promise is kept. IT tightens to 0.30-0.40s but never below the
 *   0.12s floor the schema enforces (R-CMB-002).
 * - **`ai.states` are authored, not implied** (14.3). Every damaging enemy
 *   carries a wind-up, an active window and a recovery, because "recovery" is
 *   where the counterplay column cashes out.
 * - `movement.controller`, `ai.states` entries and `attacks[].module` are names
 *   that `src/entities/enemy-controllers.js` implements separately. Nothing in
 *   this file branches on an id (R-TEC-001/006).
 * - `dropTable` is `OLT-ENEMY_COMMON` for trash and `OLT-ENEMY_ELITE` for the
 *   units an encounter treats as its centrepiece (support, tank, teleporter,
 *   healer, blocker). Elite variants do not override the table; the base unit
 *   already sits in the band its role deserves.
 * - `audio.telegraph` / `audio.death` only ever reference sounds that exist in
 *   `content/audio/sounds.js`. Where no bespoke cue exists the generic telegraph
 *   is used deliberately rather than inventing an id — 14.3 says audio
 *   supplements the visual telegraph, it never carries it alone.
 */

const enemies = [
  // =========================================================================
  // Open Office (ENM-001..ENM-012). Department: OPEN_OFFICE.
  // Teaching floor. Every behaviour here is legible in isolation before the
  // roster is allowed to combine (GDD 14.1).
  // =========================================================================

  // -- ENM-001 Office Drone --------------------------------------------------
  // The reference enemy. Cost 1.0 is the unit of the entire budget system, so
  // every other cost in D.1 reads as "worth this many drones".
  {
    id: 'ENM-001',
    schemaVersion: 1,
    nameLoc: 'enemy.office_drone.name',
    spriteId: 'enemy_office_drone',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'CHASER'],
    cost: 1.0,
    // 24 = three Keyboard hits. GDD 14.6 calls this the core movement-reading
    // enemy, so it has to survive long enough to be read while walking.
    health: 24,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'ChaseController',
      movementClass: 'GROUND',
      baseSpeed: 2.4,
      params: {
        // Slower than the player's 5.5 so kiting always works (14.2 counterplay).
        separationRadius: 0.65,
        avoidObstacles: true,
      },
    },
    ai: {
      states: ['SPAWN', 'PURSUE', 'CONTACT_RECOVER'],
      // No ranged attack, but contact still needs a readable approach beat.
      telegraphSeconds: 0.5,
      params: { reacquireSeconds: 0.35 },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-DRONE_VETERAN', 'ENMVAR-DRONE_CAFFEINATED', 'ENMVAR-DRONE_EXECUTIVE'],
    silhouetteNote:
      'Narrow upright office worker, arms hanging straight down, flat shoulder line and no held prop. The plainest hostile shape in the game: everything else is read against it.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Walks in a straight line at well under player speed. Back away and fire; use a desk or divider to break contact and reset spacing.',
    originalityNote:
      'A commuting office worker who has not registered that anything has changed. Built from the corporate-drudgery premise in GDD 2.16, not from any existing game character.',
  },

  // -- ENM-002 Desk Shooter --------------------------------------------------
  {
    id: 'ENM-002',
    schemaVersion: 1,
    nameLoc: 'enemy.desk_shooter.name',
    spriteId: 'enemy_desk_shooter',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['STATIONARY', 'SHOOTER'],
    cost: 1.0,
    // Anchored, so it cannot flee: 30 keeps it a three-hit kill at any range.
    health: 30,
    contactDamage: 1,
    radius: 0.45,
    movement: {
      // STATIONARY requires baseSpeed 0 (schema invariant).
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'NEAREST_CARDINAL', reaimSeconds: 0.6 },
    },
    ai: {
      states: ['IDLE', 'AIM', 'BURST', 'RELOAD_PAUSE'],
      // 0.62s is the most generous telegraph in the roster on purpose: this is
      // usually the player's first ranged threat (GDD 3.6).
      telegraphSeconds: 0.62,
      params: { burstPauseSeconds: 1.5, onlyFiresCardinals: true },
    },
    attacks: [
      {
        id: 'paper_burst',
        module: 'CardinalBurstAttack',
        cooldownSeconds: 2.4,
        telegraphSeconds: 0.62,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: {
          // "three straight paper shots with a clear pause" (GDD 14.6).
          shots: 3,
          shotIntervalSeconds: 0.22,
          projectileSpeed: 6.0,
          projectileLifetime: 1.6,
        },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['GROUND_RANGED', 'OBJECT_ANCHOR'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-DESK_DIAGONAL', 'ENMVAR-DESK_ROTARY'],
    silhouetteNote:
      'Seated half-figure: only head, shoulders and forearms rise above a wide horizontal desk slab. The widest, lowest profile in the Open Office roster and the only one that reads as furniture plus a person.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Fires only on cardinals with a long pause between bursts. Stand off-axis, or close during the reload pause; it cannot reposition.',
    originalityNote:
      'A colleague who will not leave his desk even for this, weaponising the office paper supply. Original office-furniture framing for the stationary-shooter role.',
  },

  // -- ENM-003 Paper Pusher -------------------------------------------------
  {
    id: 'ENM-003',
    schemaVersion: 1,
    nameLoc: 'enemy.paper_pusher.name',
    spriteId: 'enemy_paper_pusher',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'SHOOTER'],
    cost: 1.0,
    health: 28,
    contactDamage: 1,
    radius: 0.5,
    movement: {
      controller: 'StrafeShooterController',
      movementClass: 'GROUND',
      baseSpeed: 1.9,
      params: {
        // Lateral movement relative to the player, so its own shots stay readable.
        strafeDirectionFlipSeconds: 2.2,
        preferredRange: 5.0,
        pushesObject: true,
      },
    },
    ai: {
      states: ['ADVANCE', 'STRAFE', 'AIM', 'THROW', 'RECOVER'],
      telegraphSeconds: 0.5,
      params: { firesWhileMoving: false },
    },
    attacks: [
      {
        id: 'paper_throw',
        module: 'AimedProjectileAttack',
        cooldownSeconds: 1.9,
        telegraphSeconds: 0.5,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 1, projectileSpeed: 5.2, projectileLifetime: 1.8, leadsTarget: false },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-PUSHER_JAMMED', 'ENMVAR-PUSHER_BULK'],
    silhouetteNote:
      'Figure bent forward at forty-five degrees behind a chest-high boxy copier cart, so the mass sits in front of the body. Reads as a person shoving a machine, never as a standing worker.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Stops moving to throw. Punish the stationary throw window, or approach along its strafe axis where the copier blocks its own line.',
    originalityNote:
      'Literal "paper pusher" — the office idiom turned into a machine-shoving mobile shooter. Original phrasing and staging.',
  },

  // -- ENM-004 Coffee Sprinter ----------------------------------------------
  // Appendix G.5 uses this enemy as the canonical example; its shape here follows
  // that example (BurstDashController, IDLE/TELEGRAPH/DASH/RECOVER, DASH_LANE)
  // with cost taken from D.1 rather than G.5's illustrative 1.9.
  {
    id: 'ENM-004',
    schemaVersion: 1,
    nameLoc: 'enemy.coffee_sprinter.name',
    spriteId: 'enemy_coffee_sprinter',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'BURST_MOVER', 'PREDICTIVE'],
    cost: 1.0,
    health: 24,
    // 2 half-units: a committed high-speed body. The 0.55s shake is the price.
    contactDamage: 2,
    radius: 0.38,
    movement: {
      controller: 'BurstDashController',
      movementClass: 'GROUND',
      baseSpeed: 1.8,
      params: { dashSpeed: 8.5, dashSeconds: 0.45, recoverSeconds: 0.7, locksVectorAfterTelegraph: true },
    },
    ai: {
      states: ['IDLE', 'TELEGRAPH', 'DASH', 'RECOVER'],
      telegraphSeconds: 0.55,
      // R-ENM-007: the lock happens at the end of the telegraph, so changing
      // direction after the shake commits is a clean dodge.
      predictionSeconds: 0.25,
      params: { dashesThroughContact: false },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE', 'DASH_LANE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-SPRINTER_DOUBLE_DASH', 'ENMVAR-SPRINTER_SPILL'],
    silhouetteNote:
      'Compact forward-leaning runner, narrowest body in the roster, one arm held out holding a tall cup that breaks the head line on the right. Lean plus cup make the dash direction readable while stationary.',
    audio: { telegraph: 'SFX-COFFEE_SPRINTER_SHAKE', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The shake locks a vector. Move after it commits and the dash passes behind you; the recovery window is the free damage.',
    originalityNote:
      'Over-caffeinated colleague crossing the floor in one burst. Original coffee-cup tell and shake-then-commit staging.',
  },

  // -- ENM-005 Nervous Intern -----------------------------------------------
  {
    id: 'ENM-005',
    schemaVersion: 1,
    nameLoc: 'enemy.nervous_intern.name',
    spriteId: 'enemy_nervous_intern',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'COWARD', 'SHOOTER'],
    cost: 1.0,
    // Two hits. A coward that also survives is just a chore.
    health: 18,
    contactDamage: 1,
    radius: 0.33,
    movement: {
      controller: 'FleeController',
      movementClass: 'GROUND',
      baseSpeed: 3.6,
      params: {
        fleeRadius: 4.5,
        // Cornered means "no flee vector with this much clearance left".
        corneredClearance: 1.2,
        prefersRoomEdges: true,
      },
    },
    ai: {
      states: ['FLEE', 'CORNERED', 'THROW', 'RECOVER'],
      telegraphSeconds: 0.45,
      params: { throwsOnlyWhenCornered: true },
    },
    attacks: [
      {
        id: 'supply_toss',
        module: 'AimedProjectileAttack',
        cooldownSeconds: 1.3,
        telegraphSeconds: 0.45,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 1, projectileSpeed: 4.4, projectileLifetime: 1.2, weak: true },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-INTERN_RUNNER', 'ENMVAR-INTERN_PANICKED'],
    silhouetteNote:
      'Smallest humanoid in the game: short, thin, head tucked into raised shoulders, both arms clutched across the chest. Height alone separates it from the Office Drone at a glance.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Runs until it has nowhere to go. Cut the escape lane against a wall or a cubicle run instead of chasing it around the room.',
    originalityNote:
      'An intern who was not briefed on any of this. Original coward-shooter framing built from office hierarchy rather than any existing bestiary.',
  },

  // -- ENM-006 Rolling Chair Rider ------------------------------------------
  {
    id: 'ENM-006',
    schemaVersion: 1,
    nameLoc: 'enemy.rolling_chair_rider.name',
    spriteId: 'enemy_rolling_chair_rider',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'CHARGER'],
    cost: 1.7,
    health: 38,
    contactDamage: 2,
    radius: 0.52,
    movement: {
      controller: 'LineChargeController',
      movementClass: 'GROUND',
      baseSpeed: 1.4,
      params: {
        chargeSpeed: 10.0,
        // Charges until it hits something, then pays for it (14.2 counterplay).
        stopsOnCollision: true,
        stunOnWallSeconds: 1.1,
        alignsToCardinal: true,
      },
    },
    ai: {
      states: ['LINE_UP', 'LOCK', 'CHARGE', 'CRASH_RECOVER'],
      telegraphSeconds: 0.7,
      params: { lineUpToleranceUnits: 0.6 },
    },
    attacks: [],
    // Needs a run-up. A room with no lane cannot host it (R-ENM-001).
    roomRequirements: ['COMBAT_CAPABLE', 'DASH_LANE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY', 'COVER_HEAVY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-CHAIR_BOUNCER', 'ENMVAR-CHAIR_ARMORED'],
    silhouetteNote:
      'Seated figure on a five-star castor base: wide low wheel splay under a narrow torso, tall backrest slab behind the head. Bottom-heavy triangle, unlike any standing enemy.',
    audio: { telegraph: 'SFX-TELEGRAPH_CHARGE', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Locks one direction during a long line-up. Sidestep once it commits and hit it while it is stunned against the wall it crashed into.',
    originalityNote:
      'Office chair racing taken seriously. Original charger framing; the castor-base silhouette and crash-stun are authored here.',
  },

  // -- ENM-007 Team Player ---------------------------------------------------
  // Cost 2.6 for a unit with no attack: D.1 is pricing the buff it hands out,
  // which is exactly why R-ENM-003 caps support per encounter.
  {
    id: 'ENM-007',
    schemaVersion: 1,
    nameLoc: 'enemy.team_player.name',
    spriteId: 'enemy_team_player',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'SUPPORT'],
    cost: 2.6,
    health: 26,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'AllyAnchorController',
      movementClass: 'GROUND',
      baseSpeed: 2.2,
      params: {
        // Stays with the group, so killing the group kills the buff too.
        followAllyRadius: 3.2,
        retreatsFromPlayer: true,
        abandonsIsolated: false,
      },
    },
    ai: {
      states: ['SEEK_ALLY', 'MAINTAIN_AURA', 'REPOSITION'],
      // No damaging frame, but the aura link still needs a visible onset (14.3).
      telegraphSeconds: 0.5,
      params: {
        // 14.3: support links are drawn between source and beneficiary.
        buff: 'CADENCE_AND_SPEED',
        auraRadius: 3.2,
        maxBeneficiaries: 3,
        drawsVisibleLink: true,
        // R-ENM-003: never buffs another support unit, so no mutual loop.
        excludesTags: ['SUPPORT', 'HEALER', 'SHIELDER'],
      },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-TEAM_SENIOR', 'ENMVAR-TEAM_MEETING_AURA'],
    silhouetteNote:
      'Upright figure with both arms raised outward in a permanent presenting gesture, forming a wide low-set T. Widest arm span in the Open Office roster and the only enemy whose arms leave the body outline.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Weak alone and the buff links are drawn on screen. Follow a link back and kill the source first, but only when the buffed threat is not already on top of you.',
    originalityNote:
      'The colleague whose entire contribution is enthusiasm. Original support-buffer framing; the presenting pose is authored for this roster.',
  },

  // -- ENM-008 HR Representative --------------------------------------------
  // CROSS_DEPARTMENT home (D.1). Declared on both OPEN_OFFICE and IT so it can
  // rove without breaking GDD 14.4's native-content targets.
  {
    id: 'ENM-008',
    schemaVersion: 1,
    nameLoc: 'enemy.hr_representative.name',
    spriteId: 'enemy_hr_representative',
    homeDepartments: ['CROSS_DEPARTMENT', 'HR', 'OPEN_OFFICE', 'IT'],
    tags: ['GROUND', 'SHOOTER', 'DEBUFFER'],
    cost: 1.0,
    health: 32,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'StandoffShooterController',
      movementClass: 'GROUND',
      baseSpeed: 2.0,
      params: { preferredRange: 6.0, minRange: 3.5, repositionSeconds: 1.8 },
    },
    ai: {
      states: ['APPROACH', 'HOLD_RANGE', 'FILE', 'RECOVER'],
      telegraphSeconds: 0.58,
      params: { statusDurationSeconds: 2.5, statusIsShownOnHud: true },
    },
    attacks: [
      {
        id: 'policy_folder',
        module: 'StatusProjectileAttack',
        cooldownSeconds: 2.6,
        telegraphSeconds: 0.58,
        // Deliberately low damage: the folder is a debuff delivery, not a hit.
        damage: 1,
        damageTags: ['PROJECTILE', 'STATUS'],
        params: {
          shots: 1,
          // Slow enough to walk out of. GDD 14.6: "slow policy folders".
          projectileSpeed: 3.6,
          projectileLifetime: 2.6,
          status: 'SLOW',
          statusSeconds: 2.5,
          statusMagnitude: 1,
          // R-UIX-005: a duration the player can see, not a mystery.
          showsDurationRing: true,
        },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-HR_BUSINESS_PARTNER'],
    silhouetteNote:
      'Tall narrow figure with a rigid vertical clipboard held flat against the chest, squared shoulders, no lean. The only enemy whose torso is broken by a straight vertical edge.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The folder is slow and the slow duration is displayed. Step out of its path, or accept the hit and use the remaining icons of the timer to close.',
    originalityNote:
      'Human Resources as a debuff delivery system. The policy folder is an original prop; the effect is a short, visible slow rather than a hidden penalty.',
  },

  // -- ENM-009 Meeting Cluster ----------------------------------------------
  // One definition, several bodies (LINKED_FORMATION). Cost 1.0 covers the whole
  // rotating group, which is why encounters list it at count [1,1] per ring.
  {
    id: 'ENM-009',
    schemaVersion: 1,
    nameLoc: 'enemy.meeting_cluster.name',
    spriteId: 'enemy_meeting_cluster',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'SWARM', 'LINKED_FORMATION'],
    cost: 1.0,
    // Per-body health. Break the ring one attendee at a time.
    health: 14,
    contactDamage: 1,
    radius: 0.3,
    movement: {
      controller: 'OrbitFormationController',
      movementClass: 'GROUND',
      baseSpeed: 2.6,
      params: {
        memberCount: 4,
        orbitRadius: 1.6,
        orbitSecondsPerRevolution: 3.4,
        // The centre is empty: there is no meeting, only the meeting.
        centreIsEmpty: true,
        centreDriftSpeed: 0.8,
      },
    },
    ai: {
      states: ['ORBIT', 'BREAK_TELEGRAPH', 'BREAK_OUT', 'REJOIN'],
      telegraphSeconds: 0.52,
      params: { breakIntervalSeconds: 4.0, membersPerBreak: 1, rejoinSeconds: 1.6 },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE', 'OPEN_CENTRE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-CLUSTER_ALL_HANDS', 'ENMVAR-CLUSTER_CHAIRED'],
    silhouetteNote:
      'Several very small round-shouldered bodies at a fixed spacing around a visibly empty centre. The formation is the silhouette; no single member resembles a standalone enemy.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Only one attendee leaves the ring at a time and it telegraphs first. Hold a position off the orbit and kill each breakaway during its return.',
    originalityNote:
      'A standing meeting that never ends and has no subject. The empty centre is the joke and the mechanic; original formation design.',
  },

  // -- ENM-010 Burned-Out Drone ---------------------------------------------
  {
    id: 'ENM-010',
    schemaVersion: 1,
    nameLoc: 'enemy.burned_out_drone.name',
    spriteId: 'enemy_burned_out_drone',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'CHASER', 'SPLITTER', 'ARMORED'],
    cost: 2.9,
    // Thirteen Keyboard hits. GDD 14.6 asks it to "absorb damage"; at baseline
    // damage that is roughly six seconds of uninterrupted fire, which is the
    // upper bound before a tank stops being a tank and becomes a wall.
    health: 130,
    contactDamage: 1,
    radius: 0.58,
    movement: {
      controller: 'SlowAdvanceController',
      movementClass: 'GROUND',
      baseSpeed: 1.2,
      params: { neverRetreats: true, pushesThroughSmallEnemies: true },
    },
    ai: {
      states: ['TRUDGE', 'COLLAPSE_TELEGRAPH', 'SPLIT'],
      // The collapse is announced: 0.8s is the longest telegraph in the roster
      // because the split is what actually threatens the player.
      telegraphSeconds: 0.8,
      params: {
        splitsOnDeath: true,
        // "two aggressive smaller Exhausted Thoughts" (GDD 14.6). They are
        // spawned by the split module as a role, not as a separate ENM id.
        spawnRole: 'EXHAUSTED_THOUGHT',
        spawnCount: 2,
        spawnRadius: 0.9,
        spawnsInheritNothing: true,
      },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-BURNOUT_DEADLINE', 'ENMVAR-BURNOUT_PLATED'],
    silhouetteNote:
      'Heaviest Open Office body: hunched sagging mass a head shorter than the Office Drone but nearly twice as wide, shoulders rounded down past the neckline. Reads as a slumped boulder in a shirt.',
    audio: { telegraph: 'SFX-TELEGRAPH_SLAM', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Slow enough to ignore. Kill it with room to spare, never in a doorway, and pick the two remnants off as they scatter.',
    originalityNote:
      'Burnout rendered literally: the body keeps walking and what is left of the mind comes out when it stops. Original tank/splitter framing.',
  },

  // -- ENM-011 Cubicle Camper -----------------------------------------------
  {
    id: 'ENM-011',
    schemaVersion: 1,
    nameLoc: 'enemy.cubicle_camper.name',
    spriteId: 'enemy_cubicle_camper',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'SHOOTER', 'ZONE_CONTROLLER'],
    cost: 1.0,
    health: 26,
    contactDamage: 1,
    radius: 0.38,
    movement: {
      controller: 'CoverPeekController',
      movementClass: 'GROUND',
      baseSpeed: 2.8,
      params: {
        // Bound to cover, so destroying the divider is a real tactic (GDD 13.1).
        requiresCoverAnchor: true,
        relocatesOnCoverDestroyed: true,
        relocateSearchRadius: 6.0,
        exposedSeconds: 0.9,
      },
    },
    ai: {
      states: ['HIDDEN', 'PEEK', 'FIRE', 'DUCK', 'RELOCATE'],
      telegraphSeconds: 0.48,
      params: { peekIntervalSeconds: 2.0, peekSide: 'ALTERNATES' },
    },
    attacks: [
      {
        id: 'peek_shot',
        module: 'AimedProjectileAttack',
        cooldownSeconds: 2.0,
        telegraphSeconds: 0.48,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 1, projectileSpeed: 6.4, projectileLifetime: 1.5, firesOnlyWhileExposed: true },
      },
    ],
    // Needs something to hide behind.
    roomRequirements: ['COMBAT_CAPABLE', 'COVER_HEAVY'],
    prohibitedRoomTags: ['OPEN_CENTRE'],
    spawnZones: ['OBJECT_ANCHOR', 'GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-CAMPER_SENIOR', 'ENMVAR-CAMPER_DECOY'],
    silhouetteNote:
      'Half a body only: head and one shoulder leaning out past a tall vertical divider edge, the rest occluded. The asymmetric one-sided outline is unique in the roster.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Only vulnerable and only dangerous while peeking. Destroy its cover to force a relocation, then punish the run.',
    originalityNote:
      'Someone using a cubicle divider as a firing position. Original cover-peek staging tied to this game destructible furniture.',
  },

  // -- ENM-012 Reply Guy ----------------------------------------------------
  {
    id: 'ENM-012',
    schemaVersion: 1,
    nameLoc: 'enemy.reply_guy.name',
    spriteId: 'enemy_reply_guy',
    homeDepartments: ['OPEN_OFFICE'],
    tags: ['GROUND', 'MIMIC', 'SHOOTER'],
    cost: 1.0,
    health: 26,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'ObserveAndEchoController',
      movementClass: 'GROUND',
      baseSpeed: 2.1,
      params: { staysWithinObserveRadius: 5.5, driftsTowardLoudestAlly: true },
    },
    ai: {
      states: ['OBSERVE', 'QUOTE_TELEGRAPH', 'ECHO', 'RECOVER'],
      telegraphSeconds: 0.5,
      params: {
        // Repeats the last simple pattern fired nearby, after a delay, so the
        // player can already recognise what is coming (GDD 14.1).
        copyDelaySeconds: 0.9,
        observeRadius: 5.5,
        // Never copies a boss-unique attack (GDD 14.6 constraint on the elite).
        copyableModules: ['CardinalBurstAttack', 'AimedProjectileAttack', 'StatusProjectileAttack'],
        fallbackModule: 'AimedProjectileAttack',
      },
    },
    attacks: [
      {
        id: 'echo_pattern',
        module: 'EchoLastPatternAttack',
        cooldownSeconds: 2.2,
        telegraphSeconds: 0.5,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { usesObservedParams: true, degradesSpeedMultiplier: 0.9 },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-REPLY_ALL'],
    silhouetteNote:
      'Standing figure with a phone held up flat in front of the face, so the head reads as a small square block above the shoulders. Only enemy whose head outline is squared off.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It only ever repeats something you have already seen, a beat late. Kill the original pattern source and it has nothing to say.',
    originalityNote:
      'The colleague who adds nothing but volume, mechanised as a delayed pattern echo. Original reactive-copier design.',
  },

  // =========================================================================
  // IT (ENM-013..ENM-024). Department: IT. Depths 3-4.
  // Telegraphs tighten from Open Office's 0.45-0.80s band to 0.30-0.55s, and the
  // roster shifts from bodies to machines: lanes, turrets, shields and hazards.
  // =========================================================================

  // -- ENM-013 Cable Snake --------------------------------------------------
  {
    id: 'ENM-013',
    schemaVersion: 1,
    nameLoc: 'enemy.cable_snake.name',
    spriteId: 'enemy_cable_snake',
    homeDepartments: ['IT'],
    tags: ['GROUND', 'WALL_HUGGER', 'ZONE_CONTROLLER'],
    cost: 1.0,
    health: 26,
    contactDamage: 1,
    radius: 0.28,
    movement: {
      controller: 'WallFollowController',
      movementClass: 'WALL_HUGGER',
      baseSpeed: 3.2,
      params: {
        // Follows walls and furniture edges, so the room centre stays safe from
        // it — that is the whole counterplay.
        followsFurnitureEdges: true,
        turnDirection: 'CONSISTENT_PER_INSTANCE',
        hugDistance: 0.35,
      },
    },
    ai: {
      states: ['SLITHER', 'ARC_TELEGRAPH', 'TRAIL_ACTIVE', 'TRAIL_DECAY'],
      telegraphSeconds: 0.35,
      params: { trailSeconds: 1.4, trailWidth: 0.5 },
    },
    attacks: [
      {
        id: 'electrified_trail',
        module: 'TrailHazardAttack',
        cooldownSeconds: 0.9,
        telegraphSeconds: 0.35,
        damage: 1,
        damageTags: ['HAZARD', 'STATUS'],
        params: {
          // A short trail, not a growing maze. R-ENV-006's spirit: it terminates.
          segmentLifetimeSeconds: 1.4,
          maxSegments: 6,
          status: 'SHOCK',
          statusSeconds: 0.8,
        },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE', 'WALL_PERIMETER'],
    spawnZones: ['WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-SNAKE_BRANCHING', 'ENMVAR-SNAKE_CORRUPTED'],
    silhouetteNote:
      'Long low horizontal ribbon, three cells tall and fourteen wide, with a slightly bulbous plug head. The only ground-level linear silhouette in the game; nothing else reads as a floor cable.',
    audio: { telegraph: 'SFX-SHOCK_ARM', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It never leaves the perimeter. Fight from the room centre, and cross its lane behind the head where the trail has already decayed.',
    originalityNote:
      'Under-desk cable management as a hostile. Original wall-follower design; the trail is short and decaying so it controls space without sealing it.',
  },

  // -- ENM-014 Printer Beast ------------------------------------------------
  {
    id: 'ENM-014',
    schemaVersion: 1,
    nameLoc: 'enemy.printer_beast.name',
    spriteId: 'enemy_printer_beast',
    homeDepartments: ['IT'],
    tags: ['STATIONARY', 'SHOOTER', 'ZONE_CONTROLLER', 'ARMORED'],
    cost: 1.0,
    // Anchored and loud, so it can afford to be tougher than IT trash.
    health: 48,
    contactDamage: 1,
    radius: 0.62,
    movement: {
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'TRACK_SLOW', reaimSeconds: 1.2 },
    },
    ai: {
      states: ['IDLE', 'WINDUP', 'SPREAD_FIRE', 'JAM_RECOVER'],
      // The audible wind-up is long: this is the loudest tell in IT.
      telegraphSeconds: 0.72,
      params: { jamRecoverSeconds: 1.5 },
    },
    attacks: [
      {
        id: 'paper_fan',
        module: 'SpreadProjectileAttack',
        cooldownSeconds: 3.0,
        telegraphSeconds: 0.72,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 5, spreadRadians: 1.05, projectileSpeed: 5.6, projectileLifetime: 1.7 },
      },
      {
        id: 'paper_pile_spit',
        module: 'PlaceObstacleAttack',
        cooldownSeconds: 6.0,
        telegraphSeconds: 0.5,
        // Non-damaging: it places an obstacle, it does not hit.
        damage: 0,
        damageTags: ['HAZARD'],
        params: {
          hazard: 'HAZ-PAPER_DRIFT_BANK',
          // R-BSS-006's spirit applied to a normal enemy: never seals the room.
          maxInstances: 2,
          neverBlocksAllLanes: true,
          lifetimeSeconds: 12,
        },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['OBJECT_ANCHOR', 'GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-PRINTER_LASER', 'ENMVAR-PRINTER_COLOR'],
    silhouetteNote:
      'Squat wide box on stubby legs with a raised output tray lip on top, no head and no arms. Broader than tall and entirely mechanical — the only faceless wide box in the IT roster.',
    audio: { telegraph: 'SFX-PRINTER_WINDUP', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The wind-up is long and audible and the fan has gaps between shots. Move inside the spread or behind its slow turn, and attack during the jam recovery.',
    originalityNote:
      'The office printer, finally acting the way everyone already treats it. Original stationary-spread design with an obstacle-placing second attack.',
  },

  // -- ENM-015 Ticket Bot ---------------------------------------------------
  {
    id: 'ENM-015',
    schemaVersion: 1,
    nameLoc: 'enemy.ticket_bot.name',
    spriteId: 'enemy_ticket_bot',
    homeDepartments: ['IT'],
    tags: ['GROUND', 'CHASER', 'SHOOTER'],
    cost: 1.0,
    health: 30,
    contactDamage: 1,
    radius: 0.36,
    movement: {
      controller: 'ChaseShooterController',
      movementClass: 'GROUND',
      baseSpeed: 2.8,
      params: { preferredRange: 4.0, closesWhileReloading: true },
    },
    ai: {
      states: ['PURSUE', 'AIM', 'FIRE', 'RECOVER'],
      telegraphSeconds: 0.4,
      params: { firesWhileMoving: false },
    },
    attacks: [
      {
        id: 'ticket_shot',
        module: 'AimedProjectileAttack',
        cooldownSeconds: 1.6,
        telegraphSeconds: 0.4,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 1, projectileSpeed: 6.8, projectileLifetime: 1.6 },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-TICKET_ESCALATED', 'ENMVAR-TICKET_OVERDUE'],
    silhouetteNote:
      'Small wheeled service unit: single castor stem under a rounded canister body with a thin ticket slot ridge across the front. Tall and narrow where the Printer Beast is wide and squat.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It stops to fire and closes while reloading. Strafe across its aim, and use the stop to land damage instead of retreating.',
    originalityNote:
      'A helpdesk queue given wheels. Original chaser-shooter framing; the ticket slot is the readability tell.',
  },

  // -- ENM-016 Firewall Node ------------------------------------------------
  // The most expensive unit in this range (4.2) and the strictest constraint:
  // R-ENM-003 and GDD 14.6 both forbid it shielding another Firewall Node, and
  // encounters never place two.
  {
    id: 'ENM-016',
    schemaVersion: 1,
    nameLoc: 'enemy.firewall_node.name',
    spriteId: 'enemy_firewall_node',
    homeDepartments: ['IT'],
    tags: ['STATIONARY', 'SUPPORT', 'SHIELDER'],
    cost: 4.2,
    health: 40,
    contactDamage: 1,
    radius: 0.44,
    movement: {
      controller: 'AnchoredSupportController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { anchorsToWallOrRack: true },
    },
    ai: {
      states: ['IDLE', 'LINK_TELEGRAPH', 'PROJECT_SHIELD', 'OVERLOAD_RECOVER'],
      telegraphSeconds: 0.45,
      params: {
        shieldRadius: 3.6,
        shieldAbsorbHalfUnits: 20,
        maxBeneficiaries: 2,
        drawsVisibleLink: true,
        // R-ENM-003: the loop is broken at the data level, not by tuning.
        excludesTags: ['SHIELDER'],
        cannotShieldSelf: true,
        // Bounded downtime after the shield pops: no permanent invulnerability.
        overloadRecoverSeconds: 3.0,
      },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['WALL_EDGE', 'OBJECT_ANCHOR'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-FIREWALL_MOBILE', 'ENMVAR-FIREWALL_ARC'],
    silhouetteNote:
      'Tall thin vertical pylon, two cells wide, with a wider flat base plate and a notched crown. Reads as a standing bollard, not a creature: no head, no limbs, perfectly symmetrical.',
    audio: { telegraph: 'SFX-SHOCK_ARM', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The shield link is drawn on screen and the node cannot shield itself or another node. Shoot the node, not the shielded ally, or wait out the overload recovery.',
    originalityNote:
      'Network security as a physical shield projector. Original shielder design; the no-self-shield and no-node-to-node rules are authored to satisfy R-ENM-003.',
  },

  // -- ENM-017 Malware Pop-up -----------------------------------------------
  {
    id: 'ENM-017',
    schemaVersion: 1,
    nameLoc: 'enemy.malware_popup.name',
    spriteId: 'enemy_malware_popup',
    homeDepartments: ['IT'],
    tags: ['FLYING', 'TELEPORTER', 'SHOOTER', 'MIMIC'],
    cost: 2.2,
    health: 22,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'EdgeBlinkController',
      movementClass: 'TELEPORTER',
      // TELEPORTER, not STATIONARY: it has a small drift between blinks.
      baseSpeed: 0.8,
      params: {
        // 14.2: "relocates between attacks with a visible destination cue".
        showsDestinationSeconds: 0.4,
        prefersRoomEdges: true,
        minBlinkDistance: 4.0,
        neverBlinksOntoPlayer: true,
      },
    },
    ai: {
      states: ['APPEAR', 'WARN_FLASH', 'FIRE', 'FADE', 'BLINK'],
      telegraphSeconds: 0.42,
      params: {
        blinkIntervalSeconds: 3.2,
        // A single harmless visual decoy (GDD 14.6). Harmless is load-bearing:
        // R-ENV-005's readability logic applied to a hostile's own duplicate.
        decoyCount: 1,
        decoyIsHarmless: true,
        decoyHasDistinctOutline: true,
      },
    },
    attacks: [
      {
        id: 'popup_burst',
        module: 'RadialProjectileAttack',
        cooldownSeconds: 3.2,
        telegraphSeconds: 0.42,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 4, spreadRadians: Math.PI * 2, projectileSpeed: 5.0, projectileLifetime: 1.4 },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['AIR', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-MALWARE_DAMAGING_DECOY', 'ENMVAR-MALWARE_ADWARE'],
    silhouetteNote:
      'Floating rectangular window panel with a stepped title bar along the top and a small notched close-box in the corner. Hard right angles and no organic edge anywhere; nothing else in the game is a rectangle in the air.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The destination is shown before the blink and the warning flash precedes every shot. Pre-position off the marked spot; the decoy has a different outline and can be ignored.',
    originalityNote:
      'An unwanted dialog box that will not be dismissed. Original teleporter design; the decoy is deliberately harmless so it teaches outline-reading.',
  },

  // -- ENM-018 Server Rack Turret -------------------------------------------
  {
    id: 'ENM-018',
    schemaVersion: 1,
    nameLoc: 'enemy.server_rack_turret.name',
    spriteId: 'enemy_server_rack_turret',
    homeDepartments: ['IT'],
    tags: ['STATIONARY', 'SHOOTER', 'ZONE_CONTROLLER', 'ARMORED'],
    cost: 1.0,
    health: 52,
    contactDamage: 1,
    radius: 0.66,
    movement: {
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'FIXED_CARDINAL', reaimSeconds: 0 },
    },
    ai: {
      states: ['IDLE', 'CLOCK_TELEGRAPH', 'VOLLEY', 'CYCLE_PAUSE'],
      telegraphSeconds: 0.4,
      params: {
        // A repeating clock pattern: predictable by design, so the player learns
        // the rhythm rather than reacting to each shot (GDD 14.2).
        rotationStepRadians: Math.PI / 2,
        stepsPerCycle: 4,
        cyclePauseSeconds: 1.2,
      },
    },
    attacks: [
      {
        id: 'cardinal_volley',
        module: 'RadialProjectileAttack',
        cooldownSeconds: 1.8,
        telegraphSeconds: 0.4,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 4, spreadRadians: Math.PI * 2, projectileSpeed: 5.4, projectileLifetime: 2.2, alignedToCardinals: true },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['OBJECT_ANCHOR', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-RACK_OCTO', 'ENMVAR-RACK_POWERED'],
    silhouetteNote:
      'Tall narrow cabinet, full body height, with four evenly spaced horizontal blade slots cutting across the front. A striped vertical monolith — the tallest stationary shape in IT.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It fires only on the four cardinals in a fixed clock order. Stand on a diagonal, walk the pattern, and use the cycle pause to close.',
    originalityNote:
      'A server rack that has taken over its own cooling schedule. Original four-way turret framing; the clock pattern is authored to be learnable.',
  },

  // -- ENM-019 Helpdesk Agent -----------------------------------------------
  // R-ENM-003 hard constraint: encounters never pair this with another healer.
  {
    id: 'ENM-019',
    schemaVersion: 1,
    nameLoc: 'enemy.helpdesk_agent.name',
    spriteId: 'enemy_helpdesk_agent',
    homeDepartments: ['IT'],
    tags: ['GROUND', 'SUPPORT', 'HEALER', 'COWARD'],
    cost: 2.6,
    health: 28,
    contactDamage: 0,
    radius: 0.4,
    movement: {
      controller: 'ChannelSupportController',
      movementClass: 'GROUND',
      baseSpeed: 2.4,
      params: { staysBehindAllies: true, breaksChannelRange: 5.5, fleeThresholdUnits: 2.4 },
    },
    ai: {
      states: ['SEEK_DAMAGED_ALLY', 'CHANNEL_TELEGRAPH', 'CHANNEL', 'BREAK', 'RETREAT'],
      telegraphSeconds: 0.5,
      params: {
        // A channel, not a tick: interrupting it is the counterplay, so the
        // repair only lands if the player lets it finish.
        channelSeconds: 1.8,
        healHalfUnitsPerChannel: 12,
        breaksWhenDamaged: true,
        breaksWhenPlayerWithinUnits: 2.4,
        drawsVisibleLink: true,
        // Never a loop: it cannot heal itself or another healer.
        cannotHealSelf: true,
        excludesTags: ['HEALER'],
        // GDD 14.6: no healing bosses beyond add-specific caps.
        cannotTargetBoss: true,
        maxHealsPerAlly: 2,
      },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-HELPDESK_SENIOR'],
    silhouetteNote:
      'Standing figure wearing a thin headset band above the head and holding a small flat tablet low at the waist, both arms angled down and inward. The headset arc over the skull is the unique feature.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The repair beam is a visible channel that breaks on damage or on proximity. Interrupt it once, or step toward the agent and it retreats instead of healing.',
    originalityNote:
      'Deskside support triaging its own side. Original healer design; the interruptible channel and the self-heal ban are authored for R-ENM-003.',
  },

  // -- ENM-020 Cursor -------------------------------------------------------
  {
    id: 'ENM-020',
    schemaVersion: 1,
    nameLoc: 'enemy.cursor.name',
    spriteId: 'enemy_cursor',
    homeDepartments: ['IT'],
    tags: ['FLYING', 'PREDICTIVE', 'BURST_MOVER'],
    cost: 2.2,
    health: 34,
    contactDamage: 1,
    radius: 0.46,
    movement: {
      controller: 'PredictiveSnapController',
      movementClass: 'FLYING',
      baseSpeed: 1.6,
      params: {
        // Traces velocity, marks a destination, then snaps. The mark is the
        // commitment point, which is exactly what R-ENM-007 requires.
        traceSeconds: 0.6,
        snapSeconds: 0.12,
        recoverSeconds: 0.8,
        damagesAlongPath: true,
        ignoresLowCover: true,
      },
    },
    ai: {
      states: ['TRACE', 'MARK', 'SNAP', 'RECOVER'],
      telegraphSeconds: 0.45,
      // Predicts where the player is going, not where they are.
      predictionSeconds: 0.35,
      params: { markIsDrawnOnFloor: true, markLocksAtTelegraphEnd: true },
    },
    attacks: [
      {
        id: 'snap_path',
        module: 'PathDamageAttack',
        cooldownSeconds: 2.6,
        telegraphSeconds: 0.45,
        damage: 1,
        damageTags: ['CONTACT'],
        params: { pathWidth: 0.7, hitsOncePerSnap: true },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['AIR', 'GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-CURSOR_DOUBLE_CLICK'],
    silhouetteNote:
      'A single large arrowhead: hard diagonal point, wide at the tail, notched heel. Entirely non-anatomical and the only pure triangle in the roster.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It marks the destination before it moves. Change direction after the mark appears and the snap path misses; hit it during the recovery.',
    originalityNote:
      'A mouse pointer that has stopped waiting for input. Original predictive-dash design; the floor mark exists so the prediction is fair (R-ENM-007).',
  },

  // -- ENM-021 Blue Screen --------------------------------------------------
  {
    id: 'ENM-021',
    schemaVersion: 1,
    nameLoc: 'enemy.blue_screen.name',
    spriteId: 'enemy_blue_screen',
    homeDepartments: ['IT'],
    tags: ['GROUND', 'SPLITTER', 'ZONE_CONTROLLER'],
    cost: 1.6,
    health: 36,
    contactDamage: 1,
    radius: 0.48,
    movement: {
      controller: 'SlowAdvanceController',
      movementClass: 'GROUND',
      baseSpeed: 1.3,
      params: { neverRetreats: true, pushesThroughSmallEnemies: false },
    },
    ai: {
      states: ['DRIFT', 'PULSE_TELEGRAPH', 'PULSE', 'DEATH_ARM', 'DEATH_BURST'],
      telegraphSeconds: 0.38,
      params: {
        // The death burst is delayed and armed visibly: killing it is safe if
        // you leave, which is the whole decision.
        deathDelaySeconds: 1.2,
        deathBurstRadius: 2.6,
        disablesMachinesSeconds: 3.0,
        armIsVisibleOnFloor: true,
      },
    },
    attacks: [
      {
        id: 'weak_pulse',
        module: 'RadialPulseAttack',
        cooldownSeconds: 2.4,
        telegraphSeconds: 0.38,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { radius: 1.8, expandSeconds: 0.3 },
      },
      {
        id: 'crash_burst',
        module: 'DelayedDeathBurstAttack',
        cooldownSeconds: 0.05,
        // The arm ring is the telegraph and it is far longer than the floor.
        telegraphSeconds: 1.2,
        damage: 2,
        damageTags: ['EXPLOSION', 'STATUS'],
        params: {
          radius: 2.6,
          status: 'SHOCK',
          statusSeconds: 1.0,
          // Also briefly disables nearby machines (GDD 14.6), including hostile
          // ones: killing it next to a turret is a real play.
          disablesTaggedMachinesSeconds: 3.0,
          affectsHostileMachines: true,
        },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-BLUESCREEN_CORRUPTED'],
    silhouetteNote:
      'Upright flat monitor slab on a narrow neck above a small rectangular foot, top corners square and the screen slightly wider than the base. Screen-on-a-stand outline shared with nothing else.',
    audio: { telegraph: 'SFX-SHOCK_ARM', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Slow, weak, and lethal only after it dies. Kill it at range or step out of the armed ring; drop it next to a turret to disable the turret.',
    originalityNote:
      'A crashed terminal still walking its rounds. Original death-hazard design; the delayed burst doubles as an anti-machine tool rather than a pure punish.',
  },

  // -- ENM-022 Remote Worker ------------------------------------------------
  {
    id: 'ENM-022',
    schemaVersion: 1,
    nameLoc: 'enemy.remote_worker.name',
    spriteId: 'enemy_remote_worker',
    homeDepartments: ['IT'],
    tags: ['GROUND', 'TELEPORTER', 'SHOOTER', 'COWARD'],
    cost: 2.2,
    health: 28,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'EdgeBlinkController',
      movementClass: 'TELEPORTER',
      baseSpeed: 0,
      params: {
        // Fires from an edge, fades, reappears on a *different* edge.
        edgeOnly: true,
        showsDestinationSeconds: 0.5,
        destinationShownAsStatusIcon: true,
        minBlinkDistance: 6.0,
        neverBlinksOntoPlayer: true,
      },
    },
    ai: {
      states: ['ARRIVE', 'AIM', 'FIRE', 'FADE', 'TRANSIT'],
      telegraphSeconds: 0.44,
      params: { shotsPerAppearance: 1, fadeSeconds: 0.5, invulnerableWhileFading: false },
    },
    attacks: [
      {
        id: 'remote_shot',
        module: 'AimedProjectileAttack',
        cooldownSeconds: 2.2,
        telegraphSeconds: 0.44,
        damage: 1,
        damageTags: ['PROJECTILE'],
        params: { shots: 1, projectileSpeed: 6.2, projectileLifetime: 2.4 },
      },
    ],
    roomRequirements: ['COMBAT_CAPABLE', 'WALL_PERIMETER'],
    spawnZones: ['WALL_EDGE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-REMOTE_TWO_SHOT', 'ENMVAR-REMOTE_LAPTOP'],
    silhouetteNote:
      'Seated figure at knee height behind an open laptop wedge, so the outline is a low horizontal triangle with a small head above it. Sits lower than any other IT body and never stands.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The next edge is shown by a status icon before the fade. Walk toward the marked edge and it arrives inside your range instead of outside it.',
    originalityNote:
      'Attending from elsewhere, mechanically. Original edge-teleporter design; the telegraph is a status icon so the destination is never a surprise.',
  },

  // -- ENM-023 Patch Tuesday ------------------------------------------------
  {
    id: 'ENM-023',
    schemaVersion: 1,
    nameLoc: 'enemy.patch_tuesday.name',
    spriteId: 'enemy_patch_tuesday',
    homeDepartments: ['IT'],
    tags: ['GROUND', 'RULE_ENEMY', 'SUPPORT'],
    cost: 1.0,
    health: 34,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'PatrolController',
      movementClass: 'GROUND',
      baseSpeed: 1.7,
      params: { patrolMode: 'NEAREST_MACHINE_CIRCUIT', ignoresPlayerUntilAttacked: true },
    },
    ai: {
      states: ['PATROL', 'PATCH_TELEGRAPH', 'TOGGLE', 'COOLDOWN'],
      telegraphSeconds: 0.55,
      params: {
        // Flips one tagged machine or hazard between powered states. A rule
        // change, not damage — the icon and the machine both change visibly.
        toggleIntervalSeconds: 6.0,
        affectsTags: ['MULTI_LEVEL_POWER'],
        affectsHazardFamilies: ['ELECTRICITY', 'MACHINE_STATES', 'CONVEYORS', 'SCANNERS'],
        togglesOneTargetPerCycle: true,
        // R-BSS-006's spirit: a rule enemy may never make the room unsolvable.
        neverSealsAllLanes: true,
        showsRuleIcon: true,
      },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'OBJECT_ANCHOR'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: ['ENMVAR-PATCH_EMERGENCY'],
    silhouetteNote:
      'Boxy maintenance figure with a broad flat toolbelt slab across the hips that overhangs both sides, giving a distinct T-junction at the waist rather than at the shoulders.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It carries a visible rule icon and patrols machines rather than the player. Kill it to freeze the room state, or let it patch and use the state it just created.',
    originalityNote:
      'Scheduled maintenance arriving mid-fight. Original rule-enemy design; the toggle is bounded and always leaves a traversable room.',
  },

  // -- ENM-024 Spam Filter --------------------------------------------------
  {
    id: 'ENM-024',
    schemaVersion: 1,
    nameLoc: 'enemy.spam_filter.name',
    spriteId: 'enemy_spam_filter',
    homeDepartments: ['IT'],
    tags: ['GROUND', 'BLOCKER', 'SUPPORT', 'ARMORED'],
    cost: 2.0,
    health: 44,
    contactDamage: 1,
    radius: 0.5,
    movement: {
      controller: 'InterposeController',
      movementClass: 'GROUND',
      baseSpeed: 2.6,
      params: {
        // Puts itself on the line between the player and a ranged ally.
        interposeBetween: ['PLAYER', 'RANGED_ALLY'],
        interposeSlackUnits: 0.8,
        abandonsWhenNoRangedAlly: true,
      },
    },
    ai: {
      states: ['SEEK_LINE', 'HOLD_LINE', 'OVERLOAD_TELEGRAPH', 'OVERLOADED'],
      telegraphSeconds: 0.42,
      params: {
        // Absorbs low-priority shots until a budget is spent, then drops for a
        // bounded window. No permanent projectile immunity (R-ENM-003 spirit).
        absorbBudgetHalfUnits: 30,
        absorbsOnly: ['PROJECTILE'],
        // Big single hits and non-projectile damage go straight through, which
        // is the answer for a player without small-shot weapons.
        passesThroughTags: ['BEAM', 'EXPLOSION', 'MELEE'],
        overloadedSeconds: 2.5,
        showsAbsorbMeter: true,
      },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: ['ENMVAR-SPAM_REFLECTOR'],
    silhouetteNote:
      'Wide upright mesh screen carried like a riot shield: a tall rectangle two-thirds the width of the sprite with a visible grid lattice and two small feet beneath. Reads as a portable wall.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It only eats small projectiles and shows its absorb meter. Flank the ally it is covering, overload the filter, or use a beam, blast, or melee hit that ignores it.',
    originalityNote:
      'A mail filter standing physically in front of its colleagues. Original blocker design; the pass-through tag list guarantees every build has an answer.',
  },
];

export default enemies;
