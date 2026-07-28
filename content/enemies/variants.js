/**
 * Enemy variants for ENM-001..024.
 *
 * GDD refs: 14.6 / Appendix D.2 (the approved variant list per enemy), R-ENM-005
 *           ("Variants change at least one behavior, pattern, death effect, or
 *           support relationship, not only health"), 18.3 (elite variants preserve
 *           the base silhouette and add ONE clear marker: size, colour accent,
 *           accessory, or aura), 14.4 (variants used sparingly so new departments
 *           still feel new), R-ENM-003 (no permanent invulnerability loops).
 *
 * R-ENM-005 is enforced by the schema, not by good intentions: a variant whose only
 * overrides are health and cost is rejected at load. That is the right bar. A tougher
 * Office Drone is not new content — it is the same fight with a longer timer. So every
 * entry here either adds a behaviour module or changes something a player can *see
 * and respond to*, and `functionalDelta` states what that is in words.
 *
 * `visualMarker` is deliberately a single value rather than a list, because GDD 18.3
 * allows exactly one marker: recognition of the base silhouette has to survive.
 */

const variant = (id, spec) => ({
  id,
  schemaVersion: 1,
  baseEnemy: spec.base,
  nameLoc: `enemy.${spec.slug}.name`,
  functionalDelta: spec.delta,
  visualMarker: spec.marker,
  ...(spec.paletteSwap ? { paletteSwap: spec.paletteSwap } : {}),
  ...(spec.scale ? { scale: spec.scale } : {}),
  ...(spec.overrides ? { overrides: spec.overrides } : {}),
  behaviorModules: spec.modules ?? [],
  minFloor: spec.minFloor,
  weight: spec.weight,
});

/** Accent palettes reused across elites so a marker reads consistently. */
const ELITE_GOLD = { b: '#8a6a1a', B: '#e0be4a' };
const ELITE_RED = { b: '#8a2a2a', B: '#e04a54' };
const CORRUPT_PURPLE = { t: '#6a3a9a', T: '#c78af0' };

const variants = [
  // -------------------------------------------------------------------------
  // ENM-001 Office Drone — the enemy every other Open Office enemy is read against
  // -------------------------------------------------------------------------
  variant('ENMVAR-DRONE_VETERAN', {
    base: 'ENM-001', slug: 'office_drone_veteran', marker: 'SIZE', scale: 1.3,
    delta: 'Larger and slower, and shrugs off knockback entirely, so it cannot be kited into a corner the way a normal drone can.',
    overrides: { health: 44, cost: 1.8, baseSpeed: 2.2 },
    modules: [{ module: 'KnockbackImmune', params: {} }],
    minFloor: 2, weight: 1.0,
  }),
  variant('ENMVAR-DRONE_CAFFEINATED', {
    base: 'ENM-001', slug: 'office_drone_caffeinated', marker: 'COLOR_ACCENT',
    paletteSwap: { b: '#b06a2c', B: '#e09a4a' },
    delta: 'Accelerates the longer it has line of sight, so ignoring it is punished rather than merely delayed.',
    overrides: { baseSpeed: 3.4, cost: 1.5 },
    modules: [{ module: 'AccelerateWhileVisible', params: { maxSpeedMul: 1.9, rampSeconds: 3 } }],
    minFloor: 2, weight: 1.0,
  }),
  variant('ENMVAR-DRONE_EXECUTIVE', {
    base: 'ENM-001', slug: 'office_drone_executive', marker: 'ACCESSORY',
    paletteSwap: ELITE_GOLD,
    delta: 'Wears plating that ignores the first hit from any single attack event, so multiplicity beats it where raw damage does not.',
    overrides: { health: 52, cost: 2.4, tagsAdd: ['ARMORED', 'ELITE'] },
    modules: [{ module: 'ArmorPlate', params: { ignoreHitsPerEvent: 1 } }],
    minFloor: 4, weight: 0.55,
  }),

  // -------------------------------------------------------------------------
  // ENM-002 Desk Shooter
  // -------------------------------------------------------------------------
  variant('ENMVAR-DESK_DIAGONAL', {
    base: 'ENM-002', slug: 'desk_shooter_diagonal', marker: 'COLOR_ACCENT',
    paletteSwap: { c: '#9a6ad4', C: '#c8a8f0' },
    delta: 'Fires on the diagonals instead of the cardinals, so the safe lanes are exactly the ones the base version denies.',
    modules: [{ module: 'RotatePatternOffset', params: { radians: Math.PI / 4 } }],
    minFloor: 3, weight: 1.0,
  }),
  variant('ENMVAR-DESK_ROTARY', {
    base: 'ENM-002', slug: 'desk_shooter_rotary', marker: 'AURA',
    paletteSwap: ELITE_RED,
    delta: 'Rotates a continuous four-way pattern rather than bursting, converting a timing puzzle into a positioning one.',
    overrides: { health: 40, cost: 2.6, tagsAdd: ['ELITE'] },
    modules: [{ module: 'RotatingFourWay', params: { degreesPerSecond: 55 } }],
    minFloor: 4, weight: 0.6,
  }),

  // -------------------------------------------------------------------------
  // ENM-003 Paper Pusher
  // -------------------------------------------------------------------------
  variant('ENMVAR-PUSHER_JAMMED', {
    base: 'ENM-003', slug: 'paper_pusher_jammed', marker: 'ACCESSORY',
    delta: 'Leaves a slowing paper pile everywhere it walks, so its path becomes terrain the player has to plan around.',
    modules: [{ module: 'TrailHazard', params: { hazard: 'HAZ-PAPER_DRIFT_BANK', everySeconds: 1.4 } }],
    minFloor: 2, weight: 1.0,
  }),
  variant('ENMVAR-PUSHER_BULK', {
    base: 'ENM-003', slug: 'paper_pusher_bulk', marker: 'SIZE', scale: 1.25,
    delta: 'Throws a three-page spread instead of a single sheet, so sidestepping in the open stops being enough.',
    overrides: { health: 34, cost: 1.6 },
    modules: [{ module: 'SpreadShot', params: { count: 3, spreadRadians: 0.5 } }],
    minFloor: 3, weight: 0.9,
  }),

  // -------------------------------------------------------------------------
  // ENM-004 Coffee Sprinter
  // -------------------------------------------------------------------------
  variant('ENMVAR-SPRINTER_DOUBLE_DASH', {
    base: 'ENM-004', slug: 'coffee_sprinter_double', marker: 'AURA',
    paletteSwap: ELITE_RED,
    delta: 'Chains a second dash off the first with no fresh telegraph gap, so the dodge has to be committed to twice.',
    overrides: { cost: 2.4, tagsAdd: ['ELITE'] },
    modules: [{ module: 'ChainDash', params: { extraDashes: 1, recoverySeconds: 0.35 } }],
    minFloor: 3, weight: 0.7,
  }),
  variant('ENMVAR-SPRINTER_SPILL', {
    base: 'ENM-004', slug: 'coffee_sprinter_spill', marker: 'COLOR_ACCENT',
    paletteSwap: { b: '#b06a2c', B: '#e09a4a' },
    delta: 'Bursts into a scalding spill on death, so killing it at close range costs something.',
    modules: [{ module: 'DeathHazard', params: { hazard: 'HAZ-SPILL_COFFEE_SCALD', radius: 1.6, seconds: 5 } }],
    minFloor: 2, weight: 1.0,
  }),

  // -------------------------------------------------------------------------
  // ENM-005 Nervous Intern
  // -------------------------------------------------------------------------
  variant('ENMVAR-INTERN_RUNNER', {
    base: 'ENM-005', slug: 'nervous_intern_runner', marker: 'COLOR_ACCENT',
    paletteSwap: { b: '#2f7a4a', B: '#54b070' },
    delta: 'Flees faster and drops a guaranteed pickup, turning it from a nuisance into a reward worth cornering.',
    overrides: { baseSpeed: 4.6 },
    modules: [{ module: 'GuaranteedDrop', params: { kind: 'CREDIT', count: 2 } }],
    minFloor: 1, weight: 1.0,
  }),
  variant('ENMVAR-INTERN_PANICKED', {
    base: 'ENM-005', slug: 'nervous_intern_panicked', marker: 'ACCESSORY',
    delta: 'Throws in a wide fan while retreating, so chasing it down a corridor is no longer free.',
    modules: [{ module: 'SpreadShot', params: { count: 5, spreadRadians: 1.2 } }],
    minFloor: 3, weight: 0.9,
  }),

  // -------------------------------------------------------------------------
  // ENM-006 Rolling Chair Rider
  // -------------------------------------------------------------------------
  variant('ENMVAR-CHAIR_BOUNCER', {
    base: 'ENM-006', slug: 'chair_rider_bouncer', marker: 'COLOR_ACCENT',
    paletteSwap: { g: '#2f5aa8', G: '#4a7fd4' },
    delta: 'Ricochets once off the far wall instead of stopping, so the space behind the charge is no longer safe.',
    modules: [{ module: 'ChargeBounce', params: { bounces: 1 } }],
    minFloor: 2, weight: 1.0,
  }),
  variant('ENMVAR-CHAIR_ARMORED', {
    base: 'ENM-006', slug: 'chair_rider_armored', marker: 'ACCESSORY',
    paletteSwap: ELITE_GOLD,
    delta: 'Smashes through cubicle dividers rather than stopping at them, rewriting the room mid-fight.',
    overrides: { health: 46, cost: 2.6, tagsAdd: ['ARMORED'] },
    modules: [{ module: 'BreaksLowCover', params: {} }],
    minFloor: 4, weight: 0.6,
  }),

  // -------------------------------------------------------------------------
  // ENM-007 Team Player — support, so R-ENM-003 governs these
  // -------------------------------------------------------------------------
  variant('ENMVAR-TEAM_SENIOR', {
    base: 'ENM-007', slug: 'team_player_senior', marker: 'ACCESSORY',
    delta: 'Buffs two attributes at once instead of one, making it a clearer priority target than the base version.',
    overrides: { cost: 3.4 },
    modules: [{ module: 'BuffAllies', params: { attributes: ['SPEED', 'CADENCE'], magnitude: 0.2 } }],
    minFloor: 3, weight: 0.85,
  }),
  variant('ENMVAR-TEAM_MEETING_AURA', {
    base: 'ENM-007', slug: 'team_player_meeting', marker: 'AURA',
    paletteSwap: ELITE_GOLD,
    delta: 'Projects a visible meeting aura that only buffs allies standing inside it, so breaking the formation disarms it without killing it.',
    overrides: { cost: 3.8, tagsAdd: ['ELITE'] },
    modules: [{ module: 'AuraBuff', params: { radius: 3.2, magnitude: 0.28, visible: true } }],
    minFloor: 4, weight: 0.6,
  }),

  // -------------------------------------------------------------------------
  // ENM-008 HR Representative
  // -------------------------------------------------------------------------
  variant('ENMVAR-HR_BUSINESS_PARTNER', {
    base: 'ENM-008', slug: 'hr_business_partner', marker: 'ACCESSORY',
    paletteSwap: ELITE_RED,
    delta: 'Seals one door until it is defeated, converting a room the player could leave into one they must finish.',
    overrides: { health: 38, cost: 2.4, tagsAdd: ['ELITE', 'RULE_ENEMY'] },
    // R-CMB-001: the seal is tied to this enemy's life, so a valid clear always
    // releases it and no door can stay locked after the encounter resolves.
    modules: [{ module: 'SealOneDoor', params: { releaseOnDeath: true } }],
    minFloor: 3, weight: 0.7,
  }),

  // -------------------------------------------------------------------------
  // ENM-009 Meeting Cluster
  // -------------------------------------------------------------------------
  variant('ENMVAR-CLUSTER_ALL_HANDS', {
    base: 'ENM-009', slug: 'meeting_cluster_all_hands', marker: 'SIZE', scale: 1.2,
    delta: 'Orbits with more bodies at a wider radius, so the gap the player slips through has to be timed rather than found.',
    overrides: { cost: 1.8 },
    modules: [{ module: 'OrbitFormation', params: { members: 6, radius: 2.4 } }],
    minFloor: 2, weight: 1.0,
  }),
  variant('ENMVAR-CLUSTER_CHAIRED', {
    base: 'ENM-009', slug: 'meeting_cluster_chaired', marker: 'AURA',
    delta: 'Orbits a live Team Player instead of an empty point, so the formation has a centre worth killing.',
    overrides: { cost: 3.6 },
    modules: [{ module: 'OrbitFormation', params: { members: 4, radius: 2.0, centreEnemy: 'ENM-007' } }],
    minFloor: 4, weight: 0.6,
  }),

  // -------------------------------------------------------------------------
  // ENM-010 Burned-Out Drone
  // -------------------------------------------------------------------------
  variant('ENMVAR-BURNOUT_DEADLINE', {
    base: 'ENM-010', slug: 'burned_out_deadline', marker: 'COLOR_ACCENT',
    paletteSwap: ELITE_RED,
    delta: 'Explodes on collapse instead of splitting, so the reward for killing it is space rather than two new problems.',
    modules: [{ module: 'DeathExplosion', params: { radius: 2.2, damage: 1, telegraphSeconds: 0.45 } }],
    minFloor: 3, weight: 0.9,
  }),
  variant('ENMVAR-BURNOUT_PLATED', {
    base: 'ENM-010', slug: 'burned_out_plated', marker: 'ACCESSORY',
    paletteSwap: ELITE_GOLD,
    delta: 'Splits into three smaller thoughts rather than two, and the children inherit its armour.',
    overrides: { health: 70, cost: 3.6, tagsAdd: ['ARMORED'] },
    modules: [{ module: 'SplitOnDeath', params: { count: 3, inheritArmor: true } }],
    minFloor: 5, weight: 0.5,
  }),

  // -------------------------------------------------------------------------
  // ENM-011 Cubicle Camper
  // -------------------------------------------------------------------------
  variant('ENMVAR-CAMPER_SENIOR', {
    base: 'ENM-011', slug: 'cubicle_camper_senior', marker: 'COLOR_ACCENT',
    paletteSwap: ELITE_GOLD,
    delta: 'Fires twice per peek, so the punish window after its shot is halved.',
    modules: [{ module: 'BurstPerPeek', params: { shots: 2, gapSeconds: 0.22 } }],
    minFloor: 2, weight: 1.0,
  }),
  variant('ENMVAR-CAMPER_DECOY', {
    base: 'ENM-011', slug: 'cubicle_camper_decoy', marker: 'ACCESSORY',
    delta: 'Sets up behind a false cubicle that breaks in one hit, teaching the player to test cover before committing.',
    modules: [{ module: 'DecoyCover', params: { fakeCoverHealth: 1 } }],
    minFloor: 4, weight: 0.7,
  }),

  // -------------------------------------------------------------------------
  // ENM-012 Reply Guy
  // -------------------------------------------------------------------------
  variant('ENMVAR-REPLY_ALL', {
    base: 'ENM-012', slug: 'reply_guy_all', marker: 'AURA',
    paletteSwap: ELITE_RED,
    delta: 'Copies boss adds as well as ordinary enemies, but never a boss-unique attack, so it scales with the room without inventing new patterns.',
    overrides: { health: 30, cost: 2.6, tagsAdd: ['ELITE'] },
    // Appendix D.2 is explicit: elite Reply Guy "can repeat boss-add patterns but
    // never boss-unique attacks". The exclusion is the balance.
    modules: [{ module: 'CopyLastPattern', params: { includeBossAdds: true, excludeBossUnique: true } }],
    minFloor: 5, weight: 0.5,
  }),

  // -------------------------------------------------------------------------
  // IT: ENM-013..024
  // -------------------------------------------------------------------------
  variant('ENMVAR-SNAKE_BRANCHING', {
    base: 'ENM-013', slug: 'cable_snake_branching', marker: 'SIZE', scale: 1.15,
    delta: 'Splits into two shorter snakes at a wall corner, so one electrified trail becomes two lanes to track.',
    overrides: { cost: 1.9 },
    modules: [{ module: 'SplitAtCorner', params: { children: 2 } }],
    minFloor: 4, weight: 0.8,
  }),
  variant('ENMVAR-SNAKE_CORRUPTED', {
    base: 'ENM-013', slug: 'cable_snake_corrupted', marker: 'COLOR_ACCENT',
    paletteSwap: CORRUPT_PURPLE,
    delta: 'Stays invisible until the player is close, then reveals with a full telegraph rather than an instant hit.',
    // GDD 14.3: audio and telegraph rules still apply to a hidden enemy, so the
    // reveal is a warning, not the damage itself.
    modules: [{ module: 'CloakUntilNear', params: { revealRadius: 3, telegraphSeconds: 0.4 } }],
    minFloor: 4, weight: 0.75,
  }),
  variant('ENMVAR-PRINTER_LASER', {
    base: 'ENM-014', slug: 'printer_beast_laser', marker: 'COLOR_ACCENT',
    paletteSwap: ELITE_RED,
    delta: 'Replaces the paper fan with a single straight beam, swapping a spread dodge for a lane dodge.',
    modules: [{ module: 'BeamAttack', params: { width: 0.7, telegraphSeconds: 0.7, seconds: 0.9 } }],
    minFloor: 3, weight: 1.0,
  }),
  variant('ENMVAR-PRINTER_COLOR', {
    base: 'ENM-014', slug: 'printer_beast_color', marker: 'AURA',
    paletteSwap: CORRUPT_PURPLE,
    delta: 'Its pages apply a slow on hit, so the spread punishes the player twice over.',
    overrides: { cost: 2.2 },
    modules: [{ module: 'StatusOnHit', params: { status: 'SLOW', chance: 0.5, seconds: 2 } }],
    minFloor: 4, weight: 0.8,
  }),
  variant('ENMVAR-TICKET_ESCALATED', {
    base: 'ENM-015', slug: 'ticket_bot_escalated', marker: 'ACCESSORY',
    delta: 'Its tickets split into two on impact, so cover stops being a full answer.',
    modules: [{ module: 'SplitProjectileOnImpact', params: { count: 2, damageScale: 0.6 } }],
    minFloor: 4, weight: 0.85,
  }),
  variant('ENMVAR-TICKET_OVERDUE', {
    base: 'ENM-015', slug: 'ticket_bot_overdue', marker: 'COLOR_ACCENT',
    paletteSwap: ELITE_RED,
    delta: 'Accelerates the longer the room stays uncleared, so it sets the pace of the fight.',
    modules: [{ module: 'AccelerateOverTime', params: { perSecond: 0.06, maxMul: 2.0 } }],
    minFloor: 4, weight: 0.8,
  }),
  variant('ENMVAR-FIREWALL_MOBILE', {
    base: 'ENM-016', slug: 'firewall_node_mobile', marker: 'COLOR_ACCENT',
    paletteSwap: { t: '#1f6f76', T: '#3fb0b8' },
    delta: 'Walks its shield around the room instead of anchoring it, so the shielded ally keeps changing.',
    overrides: { baseSpeed: 1.6, cost: 4.6 },
    modules: [{ module: 'MobileShield', params: {} }],
    minFloor: 4, weight: 0.7,
  }),
  variant('ENMVAR-FIREWALL_ARC', {
    base: 'ENM-016', slug: 'firewall_node_arc', marker: 'AURA',
    delta: 'Rotates a shield arc rather than a full bubble, so there is always an exposed angle to find.',
    overrides: { cost: 4.0 },
    // R-ENM-003: it still cannot shield another Firewall Node, so no pair of these
    // can produce a permanent invulnerability loop.
    modules: [{ module: 'RotatingShieldArc', params: { arcRadians: 2.1, degreesPerSecond: 40 } }],
    minFloor: 5, weight: 0.65,
  }),
  variant('ENMVAR-MALWARE_DAMAGING_DECOY', {
    base: 'ENM-017', slug: 'malware_popup_damaging', marker: 'COLOR_ACCENT',
    paletteSwap: ELITE_RED,
    delta: 'Its decoy deals real damage, so the tell shifts from "which one is real" to "both are".',
    overrides: { cost: 2.8, tagsAdd: ['ELITE'] },
    modules: [{ module: 'DamagingDecoy', params: { decoyDamage: 1 } }],
    minFloor: 4, weight: 0.7,
  }),
  variant('ENMVAR-MALWARE_ADWARE', {
    base: 'ENM-017', slug: 'malware_popup_adware', marker: 'SIZE', scale: 0.8,
    delta: 'Arrives as a swarm of small weak pop-ups instead of one, trading burst threat for area denial.',
    overrides: { health: 8, cost: 0.9 },
    modules: [{ module: 'SwarmSpawn', params: { count: 4 } }],
    minFloor: 3, weight: 0.9,
  }),
  variant('ENMVAR-RACK_OCTO', {
    base: 'ENM-018', slug: 'server_rack_octo', marker: 'ACCESSORY',
    delta: 'Fires on eight lanes rather than four, so the diagonals stop being the safe approach.',
    overrides: { cost: 1.8 },
    modules: [{ module: 'EightWayTurret', params: {} }],
    minFloor: 4, weight: 0.85,
  }),
  variant('ENMVAR-RACK_POWERED', {
    base: 'ENM-018', slug: 'server_rack_powered', marker: 'AURA',
    paletteSwap: CORRUPT_PURPLE,
    delta: 'Shielded while its power strip is intact, which makes an environmental object the actual objective.',
    overrides: { cost: 3.0, tagsAdd: ['SHIELDER'] },
    modules: [{ module: 'ShieldedWhileObjectAlive', params: { object: 'ENV-019' } }],
    minFloor: 5, weight: 0.6,
  }),
  variant('ENMVAR-HELPDESK_SENIOR', {
    base: 'ENM-019', slug: 'helpdesk_agent_senior', marker: 'ACCESSORY',
    paletteSwap: ELITE_GOLD,
    delta: 'Repairs shields as well as health, so leaving it alive undoes progress rather than merely slowing it.',
    overrides: { cost: 3.4 },
    // Appendix D.2: cannot heal bosses beyond add-specific caps, which is what stops
    // a healer from making a boss fight unwinnable.
    modules: [{ module: 'RepairBeam', params: { repairsShields: true, bossHealCap: 0 } }],
    minFloor: 4, weight: 0.75,
  }),
  variant('ENMVAR-CURSOR_DOUBLE_CLICK', {
    base: 'ENM-020', slug: 'cursor_double_click', marker: 'AURA',
    paletteSwap: ELITE_RED,
    delta: 'Performs two snap-dashes per commit, each separately telegraphed, so the first dodge is not the last.',
    overrides: { cost: 3.0, tagsAdd: ['ELITE'] },
    modules: [{ module: 'DoubleSnap', params: { gapSeconds: 0.5 } }],
    minFloor: 4, weight: 0.7,
  }),
  variant('ENMVAR-BLUESCREEN_CORRUPTED', {
    base: 'ENM-021', slug: 'blue_screen_corrupted', marker: 'COLOR_ACCENT',
    paletteSwap: CORRUPT_PURPLE,
    delta: 'Spawns Malware Pop-ups on death instead of a shock burst, so where it dies matters more than when.',
    overrides: { cost: 2.4 },
    modules: [{ module: 'SpawnOnDeath', params: { enemy: 'ENM-017', count: 2 } }],
    minFloor: 4, weight: 0.8,
  }),
  variant('ENMVAR-REMOTE_TWO_SHOT', {
    base: 'ENM-022', slug: 'remote_worker_two_shot', marker: 'COLOR_ACCENT',
    paletteSwap: ELITE_GOLD,
    delta: 'Fires twice before fading, so the window to punish its arrival is a real decision rather than automatic.',
    modules: [{ module: 'ShotsBeforeTeleport', params: { shots: 2 } }],
    minFloor: 4, weight: 0.9,
  }),
  variant('ENMVAR-REMOTE_LAPTOP', {
    base: 'ENM-022', slug: 'remote_worker_laptop', marker: 'ACCESSORY',
    delta: 'Leaves a laptop familiar that keeps firing briefly after death, so the kill is not the end of the threat.',
    overrides: { cost: 2.6 },
    modules: [{ module: 'LeaveFamiliarOnDeath', params: { seconds: 4 } }],
    minFloor: 5, weight: 0.7,
  }),
  variant('ENMVAR-PATCH_EMERGENCY', {
    base: 'ENM-023', slug: 'patch_tuesday_emergency', marker: 'AURA',
    paletteSwap: ELITE_RED,
    delta: 'Also repairs one ally while it patches machines, so it becomes a support target rather than an ambient nuisance.',
    overrides: { cost: 2.2, tagsAdd: ['HEALER'] },
    modules: [{ module: 'RepairBeam', params: { targets: 1, bossHealCap: 0 } }],
    minFloor: 4, weight: 0.8,
  }),
  variant('ENMVAR-SPAM_REFLECTOR', {
    base: 'ENM-024', slug: 'spam_filter_reflector', marker: 'AURA',
    paletteSwap: CORRUPT_PURPLE,
    delta: 'Returns one absorbed shot after overloading, so dumping damage into it is punished and timing is rewarded.',
    overrides: { cost: 2.8, tagsAdd: ['ELITE'] },
    modules: [{ module: 'ReflectOnOverload', params: { shots: 1, damageScale: 1.0 } }],
    minFloor: 4, weight: 0.7,
  }),
];

export default variants;
