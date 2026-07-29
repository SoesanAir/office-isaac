/**
 * ENM-037..ENM-048 — Executive, Finance, and the cross-department managers.
 *
 * GDD refs: Appendix D.1 (cost, verbatim), D.2 / 14.2 (behaviour rows and counterplay),
 *           14.3 (readability contract), 14.4 (department continuity), 14.5
 *           (R-ENM-001..008), 6.6 (cost as encounter currency), 5.1 (player baseline),
 *           9.2 (credits, for the two thief units).
 *
 * **What makes Executive different.** Open Office teaches movement, IT teaches target
 * priority, Operations teaches space. Executive is about *permission*: half this roster
 * decides when you are allowed to deal damage. ENM-037 intercepts your shots, ENM-038
 * cycles invulnerability, ENM-041 only attacks if it saw you, ENM-042 anchors you in
 * place. The counterplay column therefore keeps returning to timing and to breaking a
 * visible link, rather than to dodging.
 *
 * Two of these are deliberately about the economy rather than health — ENM-044 Expense
 * Ghost and ENM-048 Collector attack your credits. Both drop what they took on death
 * (D.2 says so explicitly for both), because a permanent resource deletion would be a
 * run-ender wearing a mechanic's clothes.
 *
 * ENM-045 Golden Drone is the one continuity enemy: D.2 calls it a "rare continuity
 * enemy, never common enough to replace new content", which is why its weight lives in
 * encounter data rather than here, and why it reuses the Drone silhouette on purpose.
 */

const enemies = [
  // -- ENM-037 Executive Assistant ------------------------------------------
  // D.2: "Shield escort: Follows a high-cost ally and intercepts shots with a briefcase
  // shield, then counterattacks."
  {
    id: 'ENM-037',
    schemaVersion: 1,
    nameLoc: 'enemy.executive_assistant.name',
    spriteId: 'enemy_executive_assistant',
    homeDepartments: ['EXECUTIVE'],
    tags: ['GROUND', 'SHIELDER', 'SUPPORT'],
    cost: 3.6,
    health: 46,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'InterposeController',
      movementClass: 'GROUND',
      baseSpeed: 3.4,
      // Faster than the ally it protects, or it could never get in front of anything.
      // The escort link is visible (14.3) so the player can see what to break.
      params: { escortsHighestCostAlly: true, interposeDistance: 1.2 },
    },
    ai: {
      states: ['SPAWN', 'ESCORT', 'INTERPOSE', 'COUNTER', 'RECOVER'],
      telegraphSeconds: 0.4,
      params: {},
    },
    attacks: [{
      id: 'counter_swing',
      module: 'RadialPulseAttack',
      cooldownSeconds: 3.0,
      telegraphSeconds: 0.4,
      damage: 1,
      damageTags: ['MELEE'],
      // Counterattacks only after intercepting (D.2), so shooting the shield is what
      // arms it. Ignoring the assistant costs nothing.
      params: { radius: 1.5, requiresRecentBlock: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Upright figure holding a large flat briefcase edge-on across the body; the case reads as a solid rectangle that hides most of the torso.',
    audio: { telegraph: 'SFX-TELEGRAPH_SUPPORT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It only blocks along one facing and only counters after a block. Move to the ally-s flank and shoot past it, or bait a block and hit it during the counter recovery.',
    originalityNote:
      'An assistant whose job is standing between you and their principal. The briefcase is the shield, and its facing is the exploit.',
  },

  // -- ENM-038 Compliance Officer -------------------------------------------
  // D.2: "Invulnerability cycle: Files paperwork behind a shield, then lowers it to fire
  // a strict cardinal pattern."
  {
    id: 'ENM-038',
    schemaVersion: 1,
    nameLoc: 'enemy.compliance_officer.name',
    spriteId: 'enemy_compliance_officer',
    homeDepartments: ['EXECUTIVE', 'LEGAL'],
    tags: ['STATIONARY', 'SHOOTER', 'ARMORED'],
    cost: 1.0,
    health: 32,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'NEAREST_CARDINAL', reaimSeconds: 0.8 },
    },
    ai: {
      // The cycle is the enemy: shielded, then open, then shielded. Both halves are
      // visible, so the player is never guessing whether damage will land.
      states: ['SPAWN', 'SHIELDED_FILING', 'LOWER', 'FIRE', 'RAISE'],
      telegraphSeconds: 0.45,
      params: { shieldedSeconds: 2.4, openSeconds: 1.8 },
    },
    attacks: [{
      id: 'cardinal_filing',
      module: 'CardinalBurstAttack',
      cooldownSeconds: 2.2,
      telegraphSeconds: 0.45,
      damage: 1,
      damageTags: ['PROJECTILE'],
      params: { speed: 6.5, size: 0.9 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Seated behind a raised document board that occludes the lower half while shielded; the board visibly drops to expose the body.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Only vulnerable while firing, and only fires on the cardinals. Stand off-axis, hold damage through the shielded phase, and unload the moment the board drops.',
    originalityNote:
      'Compliance as an invulnerability cycle you can read off a piece of furniture. The strict cardinal pattern is the joke: it will not fire at an angle because that is not the form.',
  },

  // -- ENM-039 Consultant ----------------------------------------------------
  // D.2: "Player-pattern mimic: Observes the player primary attack briefly, then fires a
  // simplified hostile version with a clear color and delay."
  {
    id: 'ENM-039',
    schemaVersion: 1,
    nameLoc: 'enemy.consultant.name',
    spriteId: 'enemy_consultant',
    homeDepartments: ['EXECUTIVE'],
    tags: ['GROUND', 'MIMIC', 'SHOOTER'],
    cost: 2.8,
    health: 42,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'ObserveAndEchoController',
      movementClass: 'GROUND',
      baseSpeed: 2.6,
      params: { preferredDistance: 6.5, observeSeconds: 1.6 },
    },
    ai: {
      states: ['SPAWN', 'OBSERVE', 'ECHO', 'RECOVER'],
      telegraphSeconds: 0.5,
      params: {},
    },
    attacks: [{
      id: 'echoed_pattern',
      module: 'EchoLastPatternAttack',
      cooldownSeconds: 3.2,
      telegraphSeconds: 0.5,
      damage: 1,
      damageTags: ['PROJECTILE'],
      // "Simplified", with "a clear color and delay" (D.2). The echo is weaker than the
      // original and unmistakably hostile — a perfect copy would be unreadable, since
      // the player would have to distinguish their own bullets from incoming ones.
      params: { simplify: true, damageScale: 0.6, outlineFamily: 'HOSTILE', delaySeconds: 0.35 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Immaculate suit with a slim portfolio under one arm and no other prop; the cleanest, least-cluttered humanoid outline in the roster.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It copies whatever you last used, so a build that is hard to dodge becomes hard for you to dodge. Kill it during its observe phase, or switch to a pattern you can read coming back.',
    originalityNote:
      'A consultant who adds no ideas and repeats yours back at a markup. Making the echo visibly worse than the original is both the balance and the joke.',
  },

  // -- ENM-040 Middle Manager ------------------------------------------------
  // D.2: "Buff and retreat: Boosts nearby enemies, retreats from the player, and throws
  // weak buzzword projectiles."
  {
    id: 'ENM-040',
    schemaVersion: 1,
    nameLoc: 'enemy.middle_manager.name',
    spriteId: 'enemy_middle_manager',
    homeDepartments: ['CROSS_DEPARTMENT'],
    tags: ['GROUND', 'SUPPORT', 'COWARD'],
    cost: 1.0,
    health: 28,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'FleeController',
      movementClass: 'GROUND',
      baseSpeed: 3.0,
      params: { preferredDistance: 8, hidesBehindAllies: true },
    },
    ai: {
      states: ['SPAWN', 'BUFF', 'RETREAT', 'THROW'],
      telegraphSeconds: 0.45,
      params: {},
    },
    attacks: [{
      id: 'buzzword',
      module: 'AimedProjectileAttack',
      cooldownSeconds: 2.0,
      telegraphSeconds: 0.45,
      damage: 1,
      damageTags: ['PROJECTILE'],
      // Deliberately weak. The buff is the threat; the projectile exists so the manager
      // is not literally harmless while it runs away.
      params: { speed: 5.0, size: 0.85 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'ENTRY_SAFE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Slightly rounded torso, one arm permanently raised mid-gesture, and a visible aura band at ankle height marking its buff radius.',
    audio: { telegraph: 'SFX-TELEGRAPH_SUPPORT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The buff radius is drawn on the floor, and it always runs rather than fights. Cut the corner it is retreating toward, or clear its escorts and it becomes trivial.',
    originalityNote:
      'Cross-department by design, so the same manager appears everywhere as continuity. It flees rather than fights, which makes it a chase decision rather than a threat.',
  },

  // -- ENM-041 Security Guard ------------------------------------------------
  // D.2: "Cone scan / charge: Sweeps a visible vision cone. If the player is detected
  // when the sweep ends, charges or fires a stun shot."
  {
    id: 'ENM-041',
    schemaVersion: 1,
    nameLoc: 'enemy.security_guard.name',
    spriteId: 'enemy_security_guard',
    homeDepartments: ['EXECUTIVE'],
    tags: ['GROUND', 'CHARGER', 'ARMORED'],
    cost: 2.0,
    health: 50,
    contactDamage: 2,
    radius: 0.48,
    movement: {
      controller: 'PatrolController',
      movementClass: 'GROUND',
      baseSpeed: 2.2,
      params: { scanConeRadians: 1.1, scanRange: 8, scanSweepSeconds: 2.4, chargeSpeed: 10 },
    },
    ai: {
      // Detection resolves at the END of the sweep, not continuously. That single choice
      // is what turns the cone into a stealth beat the player can play around.
      states: ['SPAWN', 'SCAN', 'DETECT', 'CHARGE_OR_FIRE', 'RECOVER'],
      telegraphSeconds: 0.4,
      params: { resolvesAtSweepEnd: true },
    },
    attacks: [{
      id: 'stun_shot',
      module: 'StatusProjectileAttack',
      cooldownSeconds: 3.4,
      telegraphSeconds: 0.4,
      damage: 1,
      damageTags: ['PROJECTILE'],
      // Root rather than a full stun: GDD 5.5 keeps hard control off the player, and
      // being unable to move is already a serious punishment.
      params: { status: 'ROOTED', seconds: 0.7, speed: 8, size: 0.9 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    prohibitedRoomTags: ['TINY'],
    spawnZones: ['GROUND_MELEE', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Peaked cap and a broad flat torso, with the scan cone drawn on the floor ahead of it — the cone is a bigger read than the body.',
    audio: { telegraph: 'SFX-TELEGRAPH_HEAVY', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Detection is only checked when the sweep finishes, so leaving the cone before it ends costs you nothing. Break line of sight behind cover and it resets to patrol.',
    originalityNote:
      'A guard whose attention is a visible, timed thing you can step out of. Resolving detection at the sweep end rather than continuously is what makes it fair.',
  },

  // -- ENM-042 Legal Eagle ---------------------------------------------------
  // D.2: "Tether shooter: Fires contract pages that tether the player to a point or enemy
  // until broken by movement or damage."
  {
    id: 'ENM-042',
    schemaVersion: 1,
    nameLoc: 'enemy.legal_eagle.name',
    spriteId: 'enemy_legal_eagle',
    homeDepartments: ['EXECUTIVE', 'LEGAL'],
    tags: ['FLYING', 'SHOOTER', 'DEBUFFER'],
    cost: 1.0,
    health: 24,
    contactDamage: 1,
    radius: 0.36,
    movement: {
      controller: 'StandoffShooterController',
      movementClass: 'FLYING',
      baseSpeed: 2.8,
      params: { preferredDistance: 7 },
    },
    ai: {
      states: ['SPAWN', 'AIM', 'FIRE', 'RECOVER'],
      telegraphSeconds: 0.45,
      params: {},
    },
    attacks: [{
      id: 'contract_tether',
      module: 'StatusProjectileAttack',
      cooldownSeconds: 4.0,
      telegraphSeconds: 0.45,
      damage: 1,
      damageTags: ['PROJECTILE'],
      // Breakable by movement OR damage (D.2), so there are always two answers. A tether
      // with one answer would be a soft stun.
      params: { tether: true, breakByMovementUnits: 4.5, breakByDamage: true, speed: 7 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['AIR', 'GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Airborne, with two wide paper-sheet wings that make it far broader than tall — the only wide flying silhouette in the roster.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The tether breaks if you keep walking or if you shoot it, and the eagle itself dies in three hits. Never a threat alone; dangerous only while something else is closing.',
    originalityNote:
      'A contract as a physical leash. Giving it two independent break conditions keeps it an inconvenience rather than a stun.',
  },

  // -- ENM-043 Board Member --------------------------------------------------
  // D.2: "Rotating pattern: Sits stationary and rotates a deliberate projectile pattern
  // around the chair."
  {
    id: 'ENM-043',
    schemaVersion: 1,
    nameLoc: 'enemy.board_member.name',
    spriteId: 'enemy_board_member',
    homeDepartments: ['EXECUTIVE', 'BOARD'],
    tags: ['STATIONARY', 'SHOOTER'],
    cost: 1.0,
    health: 34,
    contactDamage: 1,
    radius: 0.46,
    movement: {
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'FREE_ROTATE', rotationSpeed: 0.5 },
    },
    ai: {
      states: ['SPAWN', 'ROTATE', 'FIRE', 'RECOVER'],
      telegraphSeconds: 0.5,
      params: {},
    },
    attacks: [{
      id: 'rotating_spokes',
      module: 'RadialProjectileAttack',
      cooldownSeconds: 1.9,
      telegraphSeconds: 0.5,
      damage: 1,
      damageTags: ['PROJECTILE'],
      // A slowly rotating spoke pattern, not a ring: the gaps are wide, they move
      // predictably, and walking with the rotation is always safe.
      params: { count: 5, rotationPerVolley: 0.22, speed: 5.5, size: 0.9 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'OBJECT_ANCHOR'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Seated in a tall high-backed chair whose back rises well above the head; reads as furniture with a person in it rather than a person.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Cannot move and rotates slowly in one direction. Walk with the rotation and the gap stays in front of you the whole time.',
    originalityNote:
      'A board member who will not get out of the chair. Anchoring the pattern to the chair rather than the body makes it a piece of level geometry that shoots.',
  },

  // -- ENM-044 Expense Ghost -------------------------------------------------
  // D.2: "Resource thief: Floats through furniture and steals credits on contact,
  // dropping them when killed."
  {
    id: 'ENM-044',
    schemaVersion: 1,
    nameLoc: 'enemy.expense_ghost.name',
    spriteId: 'enemy_expense_ghost',
    homeDepartments: ['EXECUTIVE', 'FINANCE'],
    tags: ['FLYING', 'THIEF', 'CHASER'],
    cost: 1.0,
    health: 22,
    contactDamage: 0,
    radius: 0.38,
    movement: {
      controller: 'ChaseController',
      movementClass: 'FLYING',
      baseSpeed: 3.0,
      // Passes through furniture (D.2), so cover does not work against it — the only
      // roster member for which that is true.
      params: { ignoresObstacles: true, separationRadius: 0.5 },
    },
    ai: {
      states: ['SPAWN', 'PURSUE', 'STEAL', 'FLEE_WITH_LOOT'],
      telegraphSeconds: 0.35,
      params: {},
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['AIR', 'GROUND_MELEE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Semi-transparent hovering form with a trailing lower edge and no legs; the only hostile that visibly overlaps furniture rather than being occluded by it.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Deals no contact damage at all — it only takes credits, and it drops every one of them when killed. Ignore it safely, or kill it and lose nothing.',
    originalityNote:
      'An unreconciled expense that comes to collect. Zero contact damage makes it purely an economic threat, and the guaranteed drop makes chasing it worthwhile rather than obligatory.',
  },

  // -- ENM-045 Golden Drone --------------------------------------------------
  // D.2: "Elite chaser: Fast, armored Office Drone with a guaranteed premium pickup
  // chance." Variant note: "Rare continuity enemy, never common enough to replace new
  // content."
  {
    id: 'ENM-045',
    schemaVersion: 1,
    nameLoc: 'enemy.golden_drone.name',
    spriteId: 'enemy_golden_drone',
    homeDepartments: ['EXECUTIVE'],
    tags: ['GROUND', 'CHASER', 'ELITE', 'ARMORED'],
    cost: 2.0,
    health: 70,
    contactDamage: 2,
    radius: 0.42,
    movement: {
      controller: 'ChaseController',
      movementClass: 'GROUND',
      // Faster than the player at 5.5 would be unfair for a pure chaser, so it sits just
      // under and relies on its health instead.
      baseSpeed: 4.4,
      params: { separationRadius: 0.65, avoidObstacles: true },
    },
    ai: {
      states: ['SPAWN', 'PURSUE', 'CONTACT_RECOVER'],
      telegraphSeconds: 0.4,
      params: {},
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'ENTRY_SAFE'],
    // The guaranteed premium drop is the whole reason to fight it rather than flee.
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Exactly the Office Drone outline, rendered in the gold ramp with a faint outline glow. The shape is intentionally identical: recognition is the point.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'A known shape with more health and speed. Kite it exactly as you would a Drone, just for longer; the reward is guaranteed if you commit.',
    originalityNote:
      'Deliberate continuity rather than a new idea: the first enemy in the game, returning as an elite. Its rarity is set in encounter data so it can never crowd out new content.',
  },

  // -- ENM-046 HR Business Partner ------------------------------------------
  // D.2: "Room rule debuffer: Applies one clearly displayed policy to the room, such as
  // slower active recharge or reduced pickup attraction, until defeated."
  {
    id: 'ENM-046',
    schemaVersion: 1,
    nameLoc: 'enemy.hr_business_partner.name',
    spriteId: 'enemy_hr_business_partner',
    homeDepartments: ['CROSS_DEPARTMENT'],
    tags: ['GROUND', 'RULE_ENEMY', 'DEBUFFER'],
    cost: 2.4,
    health: 40,
    contactDamage: 1,
    radius: 0.42,
    movement: {
      controller: 'FleeController',
      movementClass: 'GROUND',
      baseSpeed: 2.6,
      params: { preferredDistance: 7, hidesBehindAllies: true },
    },
    ai: {
      // The policy is applied on spawn and removed on death, so the enemy IS the rule.
      // D.2's variant note limits this to one policy enemy per normal room, which
      // encounter selection enforces rather than this file.
      states: ['SPAWN', 'ANNOUNCE_POLICY', 'MAINTAIN', 'RETREAT'],
      telegraphSeconds: 0.5,
      params: { policyAppliesOnSpawn: true, policyEndsOnDeath: true },
    },
    attacks: [{
      id: 'policy_memo',
      module: 'AimedProjectileAttack',
      cooldownSeconds: 2.6,
      telegraphSeconds: 0.5,
      damage: 1,
      damageTags: ['PROJECTILE'],
      params: { speed: 5.5, size: 0.9 },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED'],
    dropTable: 'OLT-ENEMY_ELITE',
    variants: [],
    silhouetteNote:
      'Holds a large open folder at chest height with a visible policy card floating above it; the card is a HUD-adjacent element and is always legible.',
    audio: { telegraph: 'SFX-TELEGRAPH_SUPPORT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'The policy is written on screen and ends the instant it dies. It is a priority target by construction: killing it restores the room to normal.',
    originalityNote:
      'A rule enemy whose debuff is a displayed corporate policy rather than a status icon. Making the rule readable text is what keeps it fair.',
  },

  // -- ENM-047 Auditor -------------------------------------------------------
  // D.2: "Counter / punish: Marks a credit or pickup and fires when the player collects
  // it, with a visible audit line."
  {
    id: 'ENM-047',
    schemaVersion: 1,
    nameLoc: 'enemy.auditor.name',
    spriteId: 'enemy_auditor',
    homeDepartments: ['FINANCE'],
    tags: ['STATIONARY', 'SHOOTER', 'DEBUFFER'],
    cost: 1.0,
    health: 30,
    contactDamage: 1,
    radius: 0.4,
    movement: {
      controller: 'AnchoredTurretController',
      movementClass: 'STATIONARY',
      baseSpeed: 0,
      params: { facingMode: 'TRACK_MARK', reaimSeconds: 0.4 },
    },
    ai: {
      states: ['SPAWN', 'MARK', 'WATCH', 'PUNISH', 'RECOVER'],
      telegraphSeconds: 0.4,
      params: { marksOnePickup: true },
    },
    attacks: [{
      id: 'audit_line',
      module: 'PathDamageAttack',
      cooldownSeconds: 2.0,
      telegraphSeconds: 0.4,
      damage: 1,
      damageTags: ['BEAM'],
      // The line is drawn from auditor to marked pickup BEFORE the player touches it, so
      // taking the credit is an informed decision rather than an ambush.
      params: { firesOnMarkedPickupCollected: true, width: 0.5, visibleWhileWatching: true },
    }],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_RANGED', 'WALL_EDGE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Narrow standing figure with a permanent thin beam-line drawn from its eye to whichever pickup it has marked; the line is the silhouette.',
    audio: { telegraph: 'SFX-TELEGRAPH_LIGHT', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'It only fires when you take the thing it marked, and the audit line shows you which one. Kill it first, or simply leave that credit until it is dead.',
    originalityNote:
      'A punish enemy that punishes greed specifically. Drawing the line in advance turns the trap into a priced choice.',
  },

  // -- ENM-048 Collector ----------------------------------------------------
  // D.2: "Debt chaser: Grows faster for each credit the player carries and drops a
  // portion of stolen credits on death."
  {
    id: 'ENM-048',
    schemaVersion: 1,
    nameLoc: 'enemy.collector.name',
    spriteId: 'enemy_collector',
    homeDepartments: ['FINANCE'],
    tags: ['GROUND', 'THIEF', 'CHASER'],
    cost: 1.0,
    health: 38,
    contactDamage: 1,
    radius: 0.44,
    movement: {
      controller: 'ChaseController',
      movementClass: 'GROUND',
      // Slow when you are broke, alarming when you are rich. Capped below player speed
      // so a wealthy run is threatened rather than doomed.
      baseSpeed: 1.8,
      params: { separationRadius: 0.6, speedPerPlayerCredit: 0.035, maxSpeed: 5.0 },
    },
    ai: {
      states: ['SPAWN', 'PURSUE', 'CONTACT_RECOVER'],
      telegraphSeconds: 0.45,
      params: {},
    },
    attacks: [],
    roomRequirements: ['COMBAT_CAPABLE'],
    spawnZones: ['GROUND_MELEE', 'ENTRY_SAFE'],
    dropTable: 'OLT-ENEMY_COMMON',
    variants: [],
    silhouetteNote:
      'Heavy-set figure carrying a locked cash box in both hands at waist height; the box is squarer and lower than the Courier-s parcel.',
    audio: { telegraph: 'SFX-TELEGRAPH_GENERIC', death: 'SFX-ENEMY_DEATH' },
    counterplay:
      'Its speed is a readout of your own wallet. Spend before entering, or kill it early while it is still slow — and it gives the credits back when it dies.',
    originalityNote:
      'Debt collection as an enemy whose difficulty the player sets by saving. The only hostile in the game tuned by a resource counter rather than by depth.',
  },
];

export default enemies;
