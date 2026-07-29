/**
 * ENM-025..ENM-036 — the Operations roster.
 *
 * GDD refs: Appendix D.1 (cost table, copied verbatim), D.2 / 14.2 (behaviour rows and
 *           the counterplay column), 14.3 (readability contract: unique silhouette,
 *           authored wind-up/active/recovery, visible support links), 14.4 (department
 *           continuity), 14.5 (R-ENM-001..008), 6.6 (cost is the currency encounters
 *           spend), 5.1 (player baseline: 10 damage per hit, 0.45s interval, 5.5 wu/s),
 *           5.2 (health in half-units), 13.2 (conveyors and machine hazards).
 *
 * The conventions from content/enemies/open-office-it.js apply unchanged: cost is quoted
 * from D.1 rather than re-derived, health is expressed in player hits, contactDamage is
 * in half-units, and every damaging attack carries a real telegraph.
 *
 * **What makes Operations different as a department.** Open Office teaches movement
 * reading and IT teaches target priority. Operations is about *space*: nearly everything
 * here either moves along a lane, narrows the room, or turns the floor into a schedule.
 * Four of the twelve deploy or become obstacles (Courier's parcel, Forklift's push,
 * Bottleneck's pallets, Cart Train's body), and the department's hazard families are
 * conveyors and machine states. So the counterplay column leans on positioning rather
 * than on dodging, and telegraphs sit at 0.4-0.55s — tighter than Open Office, looser
 * than IT, because the threat is usually where you are standing rather than a projectile.
 *
 * Costs from D.1 are notably flat here: eight of the twelve are 1.0. ENM-030 Shift Lead
 * at 4.4 is the most expensive enemy in the game so far, which is what stops an encounter
 * fielding it alongside much else.
 */

const enemies = [
  // -- ENM-025 Courier -------------------------------------------------------
  // D.2: "Predictive burst: Carries a parcel, pauses, then sprints toward the player
  // predicted position and drops the parcel as an obstacle."
  {
    id: 'ENM-025',
    schemaVersion: 1,
    nameLoc: 'enemy.courier.name',
    spriteId: 'enemy_courier',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'PREDICTIVE', 'BURST_MOVER'],
    cost: 2.2,
    health: 34,
    contactDamage: 2,
    radius: 0.42,
    movement: {
      controller: 'PredictiveSnapController',
      movementClass: 'GROUND',
      baseSpeed: 2.0,
      // The sprint is fast, but it commits: 0.9s of recovery is where the player gets
      // their damage in, which is the whole counterplay (14.2).
      params: { dashSpeed: 9.5, dashSeconds: 0.45, recoverySeconds: 0.9 },
    },
    ai: {
      states: ['SPAWN', 'CARRY', 'AIM_PREDICT', 'SPRINT', 'DROP_RECOVER'],
      telegraphSeconds: 0.5,
      // R-ENM-007: the prediction is sampled ONCE when the pause begins. A courier that
      // re-aimed mid-sprint would be undodgeable.
      predictionSeconds: 0.35,
      params: { pauseSeconds: 0.5 },
    },
    attacks: [{
      id: 'drop_parcel',
      module: 'PlaceObstacleAttack',
      cooldownSeconds: 4.5,
      telegraphSeconds: 0.4,
      damage: 0,
      damageTags: ['CONTACT'],
      // The parcel is the lasting threat, not the sprint. It blocks a lane and has to be
      // broken or walked around, so the courier changes the room every time it delivers.
      params: { objectId: 'ENV-017', health: 8, seconds: 0, blocksProjectiles: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['GROUND_MELEE', 'ENTRY_SAFE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Leaning-forward runner with a boxy parcel held at chest height; the parcel makes the upper body twice as wide as the legs, and the silhouette visibly narrows once it is dropped.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The pause before the sprint is long and the sprint is a straight line. Strafe perpendicular during the pause and the sprint misses entirely; then punish the recovery.',
    originalityNote:
      'An internal-mail courier whose delivery is the attack. The obstacle it leaves behind is the point, so the enemy reshapes the room rather than just dealing damage.',
  },

  // -- ENM-026 Forklift Clerk ------------------------------------------------
  // D.2: "Heavy charger: Slowly lines up, then charges while pushing movable objects and
  // light enemies."
  {
    id: 'ENM-026',
    schemaVersion: 1,
    nameLoc: 'enemy.forklift_clerk.name',
    spriteId: 'enemy_forklift_clerk',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'CHARGER', 'ARMORED'],
    cost: 1.7,
    health: 60,
    contactDamage: 2,
    radius: 0.75,
    movement: {
      controller: 'LineChargeController',
      movementClass: 'GROUND',
      baseSpeed: 1.4,
      // Pushes objects AND light enemies (D.2), which means a forklift can accidentally
      // clear a lane for the player or shove its own allies into a bad position.
      params: { chargeSpeed: 11, alignSeconds: 0.8, pushesObjects: true, pushesLightEnemies: true },
    },
    ai: {
      states: ['SPAWN', 'ALIGN', 'CHARGE', 'STALL_RECOVER'],
      telegraphSeconds: 0.55,
      params: { stallSeconds: 1.1 },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TINY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Wide low chassis with two forward-projecting tines at floor level; the only hostile whose widest point is below knee height.',
    audio: { telegraph: 'SFX-TELEGRAPH_HEAVY', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The align phase is long and the charge is committed to one axis. Step off the line and it drives past into a stall you can freely punish.',
    originalityNote:
      'Warehouse equipment operated with more enthusiasm than care. Its habit of shoving its own allies is the original wrinkle.',
  },

  // -- ENM-027 Conveyor Gremlin ---------------------------------------------
  // D.2: "Lane skirmisher: Moves quickly along conveyor directions and throws bolts
  // sideways."
  {
    id: 'ENM-027',
    schemaVersion: 1,
    nameLoc: 'enemy.conveyor_gremlin.name',
    spriteId: 'enemy_conveyor_gremlin',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'LANE_BOUND', 'SHOOTER'],
    cost: 1.0,
    health: 20,
    contactDamage: 1,
    radius: 0.3,
    movement: {
      controller: 'PatrolController',
      movementClass: 'LANE_BOUND',
      baseSpeed: 4.6,
      // Fast, but only along the lane. Off-lane it is nearly helpless, which is why the
      // room's conveyors decide how dangerous it is.
      params: { followsConveyor: true, reverseAtEnd: true },
    },
    ai: {
      states: ['SPAWN', 'PATROL', 'THROW', 'RECOVER'],
      telegraphSeconds: 0.4,
      params: {},
    },
    attacks: [{
      id: 'sideways_bolt',
      module: 'AimedProjectileAttack',
      cooldownSeconds: 1.6,
      telegraphSeconds: 0.4,
      damage: 1,
      damageTags: ['PROJECTILE'],
      // Fired perpendicular to travel, so the threat is a line across the lane rather
      // than at the player. Standing out of the lane is genuinely safe.
      params: { perpendicular: true, speed: 7.5, size: 0.8 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Small hunched figure well under player height, always oriented along its lane so it reads as a horizontal smear rather than an upright body.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Bound to its lane and throws only sideways. Step off the belt and it cannot reach you at all; kill it while it is committed to a run.',
    originalityNote:
      'Something small living in the conveyor machinery. Being lane-bound makes it a positional puzzle rather than a chase.',
  },

  // -- ENM-028 Inventory Swarm ----------------------------------------------
  // D.2: "Small swarm: Several animated boxes hop toward the player with simple
  // staggered timing."
  {
    id: 'ENM-028',
    schemaVersion: 1,
    nameLoc: 'enemy.inventory_swarm.name',
    spriteId: 'enemy_inventory_swarm',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'SWARM', 'CHASER'],
    cost: 1.0,
    // A single hop-box. An encounter fields several, and R-ENM-006's room cap is what
    // stops "several" becoming forty.
    health: 8,
    contactDamage: 1,
    radius: 0.26,
    movement: {
      controller: 'BurstDashController',
      movementClass: 'GROUND',
      baseSpeed: 0,
      // Staggered timing (D.2) is the readability device: the hops are offset so the
      // swarm arrives as a rhythm rather than a wall.
      params: { hopSpeed: 6, hopSeconds: 0.22, restSeconds: 0.5, staggerBySpawnIndex: 0.12 },
    },
    ai: {
      states: ['SPAWN', 'REST', 'HOP', 'LAND'],
      telegraphSeconds: 0.25,
      params: {},
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'A plain cube with no limbs or face, smaller than any other hostile. Reads purely as a shape on the floor.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'One hit each, and the rest between hops is long. Any area or piercing attack clears the group; a corner turns their staggered timing into a queue.',
    originalityNote:
      'Stock that has started moving on its own. Deliberately the least characterful enemy in the game — it is a quantity, not a personality.',
  },

  // -- ENM-029 Bottleneck ----------------------------------------------------
  // D.2: "Path blocker: Deploys temporary barrier pallets that narrow routes, then
  // retreats behind them."
  {
    id: 'ENM-029',
    schemaVersion: 1,
    nameLoc: 'enemy.bottleneck.name',
    spriteId: 'enemy_bottleneck',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'BLOCKER', 'COWARD'],
    cost: 1.0,
    health: 30,
    contactDamage: 1,
    radius: 0.45,
    movement: {
      controller: 'FleeController',
      movementClass: 'GROUND',
      baseSpeed: 2.8,
      // Retreats behind its own barrier (D.2), which is what makes it a priority target
      // rather than a nuisance: leave it alive and the room keeps shrinking.
      params: { preferredDistance: 6, hidesBehindCover: true },
    },
    ai: {
      states: ['SPAWN', 'PLACE', 'RETREAT', 'IDLE'],
      telegraphSeconds: 0.45,
      params: {},
    },
    attacks: [{
      id: 'barrier_pallet',
      module: 'PlaceObstacleAttack',
      cooldownSeconds: 5.5,
      telegraphSeconds: 0.45,
      damage: 0,
      damageTags: ['CONTACT'],
      // R-ENV-004 forbids blocking a required door, blast point, or spawn, and
      // PlaceObstacleAttack asks the room rather than placing blindly. "Narrows routes"
      // is allowed; sealing one is not.
      params: { objectId: 'ENV-017', health: 12, seconds: 14, count: 1, preserveGaps: 1 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TINY', 'TIGHT_CORRIDOR_ONLY'],
    spawnZones: ['GROUND_RANGED', 'ENTRY_SAFE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Stooped figure permanently carrying a folded pallet on its back, giving it a distinctive high square hump.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Deals almost no damage itself; the barriers are the threat. Its barriers are breakable, and killing it early is always better than clearing them.',
    originalityNote:
      'A process bottleneck personified as someone who keeps putting things in the way and then standing behind them.',
  },

  // -- ENM-030 Shift Lead ----------------------------------------------------
  // D.2: "Summoner / support: Calls one low-cost Operations enemy from a marked entry
  // point and buffs nearby workers."
  {
    id: 'ENM-030',
    schemaVersion: 1,
    nameLoc: 'enemy.shift_lead.name',
    spriteId: 'enemy_shift_lead',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'SUMMONER', 'SUPPORT'],
    // 4.4 is the highest cost in the roster so far. That is the balance: an encounter
    // that fields a Shift Lead cannot afford much else (GDD 6.6).
    cost: 4.4,
    health: 55,
    contactDamage: 1,
    radius: 0.45,
    movement: {
      controller: 'AnchoredSupportController',
      movementClass: 'GROUND',
      baseSpeed: 1.6,
      params: { preferredDistance: 7, repositionSeconds: 3 },
    },
    ai: {
      states: ['SPAWN', 'CALL', 'BUFF', 'RECOVER'],
      telegraphSeconds: 0.5,
      params: {},
    },
    attacks: [{
      id: 'call_worker',
      module: 'AimedProjectileAttack',
      cooldownSeconds: 6.5,
      telegraphSeconds: 0.5,
      damage: 0,
      damageTags: ['CONTACT'],
      // "From a MARKED entry point" (D.2) — the summon location is shown before the
      // enemy arrives, so a summon can never be unavoidable spawn damage.
      params: { summonsEnemy: 'ENM-028', markSeconds: 0.8, maxAlive: 3 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Upright figure with a high-visibility vest reading as a bright horizontal band across the chest, plus a raised clipboard arm.',
    audio: { telegraph: 'SFX-TELEGRAPH_SUPPORT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Its buff aura and summon marker are both visible, and it keeps its distance rather than fighting. Push through the workers and kill it, or the room refills faster than you clear it.',
    originalityNote:
      'A shift lead who manages rather than fights. Its cost, not its stats, is what makes it dangerous.',
  },

  // -- ENM-031 Pallet Mimic --------------------------------------------------
  // D.2: "Object mimic: Appears as a normal pallet until approached or attacked, then
  // unfolds and charges."
  {
    id: 'ENM-031',
    schemaVersion: 1,
    nameLoc: 'enemy.pallet_mimic.name',
    spriteId: 'enemy_pallet_mimic',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'MIMIC', 'CHARGER'],
    cost: 1.8,
    health: 40,
    contactDamage: 2,
    radius: 0.55,
    movement: {
      controller: 'LineChargeController',
      movementClass: 'GROUND',
      baseSpeed: 0.9,
      params: { chargeSpeed: 10, alignSeconds: 0.5, wakesOnProximity: 2.2 },
    },
    ai: {
      states: ['DISGUISED', 'UNFOLD', 'CHARGE', 'RECOVER'],
      // The unfold IS the telegraph, and it is generous. GDD 13.1's office-rock principle
      // wants uncertainty about objects, not unavoidable damage from them.
      telegraphSeconds: 0.6,
      params: { revealOnDamage: true },
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE', 'COVER_HEAVY'],
    spawnZones: ['OBJECT_ANCHOR'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'While disguised, exactly a stacked pallet — the tell is a single mismatched slat, not a different shape. Unfolded, it is taller than it was wide.',
    audio: { telegraph: 'SFX-TELEGRAPH_HEAVY', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Wakes on proximity with a long unfold before it can move. Shooting suspicious furniture from range costs nothing and defuses it entirely.',
    originalityNote:
      'The office-rock principle turned hostile: a piece of scenery that was worth being suspicious of. The tell is deliberately a visual detail rather than an outline change.',
  },

  // -- ENM-032 Safety Officer ------------------------------------------------
  // D.2: "Zone controller: Projects striped no-go zones that activate after a warning
  // and deal damage or Slow."
  {
    id: 'ENM-032',
    schemaVersion: 1,
    nameLoc: 'enemy.safety_officer.name',
    spriteId: 'enemy_safety_officer',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'ZONE_CONTROLLER', 'DEBUFFER'],
    cost: 2.2,
    health: 38,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'StandoffShooterController',
      movementClass: 'GROUND',
      baseSpeed: 2.0,
      params: { preferredDistance: 6.5 },
    },
    ai: {
      states: ['SPAWN', 'PROJECT', 'HOLD', 'RECOVER'],
      telegraphSeconds: 0.55,
      params: {},
    },
    attacks: [{
      id: 'no_go_zone',
      module: 'TrailHazardAttack',
      cooldownSeconds: 4.0,
      telegraphSeconds: 0.55,
      damage: 1,
      damageTags: ['HAZARD'],
      // D.2's variant note says even the elite "cannot fully seal all exits", so the
      // base unit places a bounded number of zones and never covers an exit.
      params: { hazardId: 'HAZ-REDTAPE_COMPLIANCE_BAND', count: 2, seconds: 3.5, preserveExits: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TINY'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Hard hat and a wide reflective sash forming a bold diagonal across the torso; the only Operations hostile with a helmet outline.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Zones are striped and warned before they activate, and they never cover every exit. Walk out during the warning, or close the distance it is trying to keep.',
    originalityNote:
      'Workplace safety enforcement as area denial: it hurts you by telling you where you are not allowed to stand.',
  },

  // -- ENM-033 Temp Worker ---------------------------------------------------
  // D.2: "Splitter: Runs erratically and breaks into two smaller contract workers when
  // killed."
  {
    id: 'ENM-033',
    schemaVersion: 1,
    nameLoc: 'enemy.temp_worker.name',
    spriteId: 'enemy_temp_worker',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'SPLITTER', 'CHASER'],
    cost: 1.8,
    health: 28,
    contactDamage: 1,
    radius: 0.38,
    movement: {
      controller: 'ChaseController',
      movementClass: 'GROUND',
      baseSpeed: 3.2,
      // Erratic (D.2): the wobble is a movement param, not a separate controller, so it
      // stays readable as "a chaser that is bad at walking straight".
      params: { wanderAmplitude: 0.55, wanderHz: 1.8, separationRadius: 0.6 },
    },
    ai: {
      states: ['SPAWN', 'PURSUE', 'CONTACT_RECOVER'],
      telegraphSeconds: 0.4,
      params: {},
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Same height as an Office Drone but visibly thinner, with a lanyard badge that flaps as it runs — the flapping badge is the tell that it will split.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Splits into two weaker halves, so killing it in an open space is better than in a doorway. Area damage handles the halves in one pass.',
    originalityNote:
      'Short-term contracting as a splitter: one temp becomes two, each doing less. The split is announced by the badge rather than hidden.',
  },

  // -- ENM-034 Overtime Zombie ----------------------------------------------
  // D.2: "Escalating chaser: Starts slow and becomes faster the longer the room remains
  // uncleared."
  {
    id: 'ENM-034',
    schemaVersion: 1,
    nameLoc: 'enemy.overtime_zombie.name',
    spriteId: 'enemy_overtime_zombie',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'CHASER'],
    cost: 1.0,
    health: 36,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'ChaseController',
      movementClass: 'GROUND',
      // Starts well below player speed and ends above it. That inversion is the enemy:
      // it converts a slow, safe room into an unsafe one without ever spawning anything.
      baseSpeed: 1.2,
      params: { separationRadius: 0.6, accelerationPerSecond: 0.09, maxSpeed: 6.2 },
    },
    ai: {
      states: ['SPAWN', 'PURSUE', 'CONTACT_RECOVER'],
      telegraphSeconds: 0.5,
      params: {},
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'ENTRY_SAFE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Slumped posture with both arms hanging well below the waist and a visibly dragging foot; the only hostile whose stance is lower than a Drone at the same height.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Harmless early and lethal late, so it is a clock rather than a threat. Kill it first, or accept that the room now has a deadline.',
    originalityNote:
      'Unpaid overtime as an escalating chaser. It is the only enemy that punishes taking your time, which is why its base speed is almost comically slow.',
  },

  // -- ENM-035 Cart Train ----------------------------------------------------
  // D.2: "Linked segments: A lead cart follows a route while trailing carts deal contact
  // damage. Destroyed segments change its turning behavior."
  {
    id: 'ENM-035',
    schemaVersion: 1,
    nameLoc: 'enemy.cart_train.name',
    spriteId: 'enemy_cart_train',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'LINKED_FORMATION', 'LANE_BOUND'],
    cost: 2.2,
    health: 44,
    contactDamage: 2,
    radius: 0.5,
    movement: {
      controller: 'OrbitFormationController',
      movementClass: 'LANE_BOUND',
      baseSpeed: 3.0,
      // Destroying a segment changes turning (D.2), so the player edits the route rather
      // than just reducing its health.
      params: { segments: 3, segmentSpacing: 0.9, turnRadiusPerSegment: 0.6 },
    },
    ai: {
      states: ['SPAWN', 'ROUTE', 'TURN', 'RECOVER'],
      telegraphSeconds: 0.45,
      params: {},
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TINY'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'A chain of three identical low carts moving as one long body — the only hostile whose silhouette is wider than the player is tall.',
    audio: { telegraph: 'SFX-TELEGRAPH_HEAVY', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The body is the threat and the route is predictable. Break a trailing segment to widen its turns, then cross behind it where the tail has already passed.',
    originalityNote:
      'A train of supply carts as a segmented enemy whose handling degrades as you dismantle it, so damage changes its behaviour rather than only its health.',
  },

  // -- ENM-036 Labeler -------------------------------------------------------
  // D.2: "Delayed mark shooter: Fires labels that stick to the floor or player location
  // and detonate after a readable delay."
  {
    id: 'ENM-036',
    schemaVersion: 1,
    nameLoc: 'enemy.labeler.name',
    spriteId: 'enemy_labeler',
    homeDepartments: ['OPERATIONS'],
    tags: ['GROUND', 'SHOOTER', 'ZONE_CONTROLLER'],
    cost: 1.0,
    health: 26,
    contactDamage: 1,
    radius: 0.36,
    movement: {
      controller: 'StrafeShooterController',
      movementClass: 'GROUND',
      baseSpeed: 2.2,
      params: { preferredDistance: 5.5, strafeHz: 0.7 },
    },
    ai: {
      states: ['SPAWN', 'AIM', 'FIRE', 'RECOVER'],
      telegraphSeconds: 0.4,
      params: {},
    },
    attacks: [{
      id: 'delayed_label',
      module: 'StatusProjectileAttack',
      cooldownSeconds: 2.4,
      telegraphSeconds: 0.4,
      damage: 1,
      damageTags: ['PROJECTILE'],
      // "Readable delay" (D.2) is the whole design: the label lands harmlessly and the
      // countdown is the attack, so the damage is always avoidable by moving.
      params: { sticksToFloor: true, detonateAfterSeconds: 1.3, blastRadius: 1.6, speed: 6.5 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Compact figure holding a chunky handheld device at hip height with a visible tape spool on top; the spool is the read.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Labels do nothing on landing and announce their detonation. Keep moving and none of them matter; stand still to fight something else and they all do.',
    originalityNote:
      'A label gun as a delayed-blast placer. It never threatens where you are, only where you were, which makes it a movement tax rather than a damage source.',
  },
];

export default enemies;
