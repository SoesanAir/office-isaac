/**
 * WPN-001..014. Appendix B.
 *
 * Content kind: weapon. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * GDD refs: 7.1 (one primary slot, pedestal swap), 7.2 (the eight attack
 *           archetypes and their primary data), 7.3 (modifier adapter contract),
 *           7.4 (starter roster), 7.5 (performance and readability),
 *           5.1 (baseline balance anchor), Appendix B.1/B.2 (generation registry
 *           and per-weapon behaviour), Appendix G.1 (definition shape),
 *           R-WPN-003 (a weapon declares archetype, cadence, compatible modifier
 *           tags, and explicit overrides), R-WPN-004 (a weapon is never also a
 *           modifier — the Big Laser Pointer is always WPN-003 and never ITM-011),
 *           R-WPN-005 (an unsupported modifier resolves to NO_EFFECT silently),
 *           Appendix H.2 (originality note on every definition).
 *
 * Authoring conventions used throughout this file:
 *
 * - **The Keyboard is the ruler.** WPN-001 is exactly GDD 5.1: interval 0.45 s,
 *   projectile speed 9.0 wu/s, lifetime 0.95 s, damage multiplier 1.0. That is
 *   8.55 wu of reach and 2.22 damage-multiplier per second. Every other weapon is
 *   priced against those two numbers: slower cadence buys damage, wider coverage
 *   buys back range, and nothing gets both.
 * - **Range is expressed once per archetype, never twice.** The attack graph reads
 *   reach as `beamRange ?? arcRadius`, and it scales `projectileLifetime` in
 *   preference to that reach when a lifetime exists (src/systems/attack-graph.js).
 *   So travelling-projectile weapons declare `projectileSpeed` +
 *   `projectileLifetime` and no `beamRange`; volume weapons (beam, cone, tether,
 *   placed) declare `beamRange` and no `projectileLifetime`. Otherwise an
 *   Extension Cord would silently lengthen the wrong number.
 * - **Sustained weapons keep `intervalSeconds` and `tickRate` in agreement.**
 *   For every CARDINAL_HOLD weapon `intervalSeconds === 1 / tickRate`, so a
 *   cadence item that scales the interval and a tick-rate reading of the same
 *   attack cannot disagree about how often damage lands.
 * - **`adapters` claims only what the weapon genuinely re-expresses.** GDD 7.3
 *   resolution already falls back to the modifier's own `defaultAdapter` when the
 *   attack tags overlap, so listing every mechanic here would be noise. Each entry
 *   is either named by Appendix B.2 for this weapon or is a translation the
 *   archetype needs because the projectile-family default cannot express it.
 *   Mechanics deliberately left out resolve to NO_EFFECT, which R-WPN-005 says is
 *   a correct outcome and not a gap.
 * - **No `modifier` block, ever (R-WPN-004).** The schema rejects one. A weapon
 *   that wants a modifier's fantasy asks for it through `adapters`.
 * - Projectile sprite ids are recorded in the comment above each weapon rather
 *   than in a field: the normative schema has no `projectileId`, and Appendix G.1's
 *   `projectile_id` line has no home yet. content/sprites/weapons.js authors them.
 */

const weapons = [
  // -- WPN-001 Keyboard ------------------------------------------------------
  // The balance anchor (GDD 5.1). Every number here is quoted, not chosen, and
  // must not drift: the other thirteen weapons are only meaningful relative to it.
  // Emits: prj_keycap.
  {
    id: 'WPN-001',
    schemaVersion: 1,
    nameLoc: 'weapon.keyboard.name',
    descriptionLoc: 'weapon.keyboard.description',
    spriteId: 'weapon_keyboard',
    heldSpriteId: 'weapon_keyboard_held',
    quality: 1,
    baseWeight: 1.00,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET'],
    repeatable: false,
    attack: {
      archetype: 'PROJECTILE',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 1.0,
      intervalSeconds: 0.45,
      projectileSpeed: 9.0,
      projectileLifetime: 0.95,
      projectileSize: 0.35,
      projectileCount: 1,
      spreadRadians: 0,
      pierce: 0,
      bounce: 0,
      knockback: 2.0,
      damageTags: ['PROJECTILE'],
    },
    modifierTags: ['PROJECTILE', 'DIRECTED', 'REPEATABLE'],
    // The reference weapon claims the whole projectile vocabulary, because it is
    // the weapon every modifier is prototyped against (Appendix B.2 acceptance).
    adapters: {
      HOMING: 'HomingProjectileAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      SPLIT: 'SplitProjectileAdapter',
      RETURN: 'ReturnProjectileAdapter',
      BOUNCE: 'BounceProjectileAdapter',
      PIERCE: 'PierceProjectileAdapter',
      STICK: 'StickProjectileAdapter',
      DUPLICATE: 'DuplicateProjectileAdapter',
      MULTIPLY_DUAL: 'DualProjectileAdapter',
      MULTIPLY_TRIPLE: 'TripleProjectileAdapter',
      SIZE: 'SizeProjectileAdapter',
      RANGE: 'RangeProjectileAdapter',
    },
    audio: { fire: 'SFX-WPN_KEYBOARD', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'A shed keycap is the smallest unit of office attrition; the fantasy is a '
      + 'keyboard disassembling itself under pressure, not a borrowed starter gun.',
  },

  // -- WPN-002 Mouse --------------------------------------------------------
  // Melee arc. Reach collapses to 2.2 wu, a quarter of the Keyboard, so cadence
  // and per-swing damage both rise and the arc sweeps several targets at once.
  // Emits: no projectile; the cable traces the arc.
  {
    id: 'WPN-002',
    schemaVersion: 1,
    nameLoc: 'weapon.mouse.name',
    descriptionLoc: 'weapon.mouse.description',
    spriteId: 'weapon_mouse',
    heldSpriteId: 'weapon_mouse_held',
    quality: 2,
    baseWeight: 0.85,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET'],
    repeatable: false,
    attack: {
      archetype: 'MELEE_ARC',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 1.15,
      intervalSeconds: 0.40,
      arcRadius: 2.2,
      arcAngle: 2.10,
      windupSeconds: 0.06,
      activeSeconds: 0.14,
      recoverySeconds: 0.10,
      // The cable is one continuous hit volume, so a swing does not stop at the
      // first body it finds. Hit memory keeps it to one hit per target per swing.
      pierce: -1,
      knockback: 5.0,
      damageTags: ['MELEE'],
    },
    modifierTags: ['MELEE_ARC', 'DIRECTED', 'REPEATABLE', 'AREA'],
    adapters: {
      // GDD 7.3 names this override explicitly: homing rotates the arc, it does
      // not turn the mouse into a guided projectile.
      HOMING: 'HomingArcAdapter',
      EIGHT_DIRECTION: 'EightDirectionArcAdapter',
      RANGE: 'ReachArcAdapter',
      SIZE: 'ReachArcAdapter',
      REPEAT_ECHO: 'RepeatArcAdapter',
      KNOCKBACK: 'KnockbackArcAdapter',
      MULTIPLY_DUAL: 'OffsetArcAdapter',
      // Appendix B.2 wants Sticky Keys to add a brief tether. The closed adapter
      // vocabulary has no StickArcAdapter, and the tether family is where a cord
      // that holds a target for a moment already lives.
      STICK: 'ReturnTetherAdapter',
    },
    audio: { fire: 'SFX-WPN_MOUSE_SWING', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'The joke is the wired mouse nobody replaced: the cable, not the puck, is '
      + 'the weapon, so the reach is exactly as embarrassing as the desk it came from.',
  },

  // -- WPN-003 Big Laser Pointer --------------------------------------------
  // R-WPN-004 anchor: this is a weapon and only ever a weapon. ITM-011 Pen Laser
  // Pointer is separate content and is the thing that bends beams.
  // Quality 4, so it out-ranges everything (11 wu) and out-damages the baseline,
  // but it is a single line with no coverage and demands the input held.
  // Emits: prj_beam_segment.
  {
    id: 'WPN-003',
    schemaVersion: 1,
    nameLoc: 'weapon.big_laser_pointer.name',
    descriptionLoc: 'weapon.big_laser_pointer.description',
    spriteId: 'weapon_big_laser_pointer',
    heldSpriteId: 'weapon_big_laser_pointer_held',
    quality: 4,
    baseWeight: 0.12,
    minFloor: 3,
    pools: ['SUPPLY_CLOSET', 'INNOVATION_LAB'],
    repeatable: false,
    // minFloor 3 already excludes floors 1-2, so the early-jackpot window
    // (GDD 8.4 step 5) must not reopen them.
    earlyJackpotEligible: false,
    attack: {
      archetype: 'BEAM',
      inputMode: 'CARDINAL_HOLD',
      // Per damage tick, not per second: 8 ticks x 0.40 = 3.2/s against one target.
      baseDamageMultiplier: 0.40,
      intervalSeconds: 0.125,
      beamRange: 11.0,
      beamWidth: 0.45,
      tickRate: 8,
      pierce: -1,
      knockback: 0,
      damageTags: ['BEAM'],
    },
    modifierTags: ['BEAM', 'DIRECTED', 'SUSTAINED'],
    adapters: {
      HOMING: 'TrackingBeamAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      SPLIT: 'ForkBeamAdapter',
      DUPLICATE: 'ForkBeamAdapter',
      MULTIPLY_DUAL: 'ForkBeamAdapter',
      REPEAT_ECHO: 'PulseBeamAdapter',
      RANGE: 'RangeBeamAdapter',
      STATUS_SLOW: 'StatusBeamAdapter',
      STATUS_MARK: 'StatusBeamAdapter',
      STATUS_SHOCK: 'StatusBeamAdapter',
    },
    audio: { fire: 'SFX-WPN_BEAM', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'Scaled up from the all-hands slide deck rather than from any sci-fi rifle: '
      + 'it is a presentation tool held wrong, and the beam is violet so it can '
      + 'never be mistaken for hostile red fire.',
  },

  // -- WPN-004 Stapler ------------------------------------------------------
  // Heavy projectile with a cadence gate. Three staples at 0.32 s then a 0.85 s
  // reload: 3 x 1.55 damage per 1.81 s cycle, 2.57/s, above the Keyboard because
  // the staple is slow (7.0 wu/s) and the rhythm is a real commitment.
  // Emits: prj_staple.
  {
    id: 'WPN-004',
    schemaVersion: 1,
    nameLoc: 'weapon.stapler.name',
    descriptionLoc: 'weapon.stapler.description',
    spriteId: 'weapon_stapler',
    heldSpriteId: 'weapon_stapler_held',
    quality: 2,
    baseWeight: 0.85,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET', 'OFFICE_SUPPLY_SHOP'],
    repeatable: false,
    attack: {
      archetype: 'PROJECTILE',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 1.55,
      intervalSeconds: 0.32,
      projectileSpeed: 7.0,
      projectileLifetime: 1.15,
      projectileSize: 0.30,
      projectileCount: 1,
      pierce: 1,
      bounce: 0,
      knockback: 6.5,
      burstCount: 3,
      burstReloadSeconds: 0.85,
      damageTags: ['PROJECTILE'],
    },
    modifierTags: ['PROJECTILE', 'DIRECTED', 'BURST', 'REPEATABLE'],
    adapters: {
      BOUNCE: 'BounceProjectileAdapter',
      PIERCE: 'PierceProjectileAdapter',
      // Heavy Keycaps become Heavy Staples: the item declares the WPN-004 override
      // on its own side (GDD 7.3), the weapon only states that size is expressible.
      SIZE: 'SizeProjectileAdapter',
      ARMOR_PIERCE: 'ArmorPierceAdapter',
      HOMING: 'HomingProjectileAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      MULTIPLY_DUAL: 'DualProjectileAdapter',
      MULTIPLY_TRIPLE: 'TripleProjectileAdapter',
      KNOCKBACK: 'KnockbackProjectileAdapter',
      RANGE: 'RangeProjectileAdapter',
      RHYTHM_ALTERNATE: 'AlternatingAdapter',
      REPEAT_ECHO: 'MacroRepeatAdapter',
    },
    // The burst reload is the weapon's readability cue and the audio slot list has
    // no 'reload' field, so it rides in `charge`: it plays before the next burst.
    audio: {
      fire: 'SFX-WPN_STAPLER',
      impact: 'SFX-IMPACT_HARD',
      charge: 'SFX-WPN_STAPLER_RELOAD',
    },
    originalityNote:
      'Built from the one desk object that already has a magazine and a reload '
      + 'ritual; the rhythm is stationery logistics, not a borrowed firearm cadence.',
  },

  // -- WPN-005 Hole Punch ---------------------------------------------------
  // Twin discs, 3.36 wu of reach — the shortest ranged weapon in the roster. Both
  // discs landing is 3.57/s, one disc is 1.79/s, so the weapon rewards standing
  // close enough that the 0.16 rad gap has not opened yet.
  // Emits: prj_paper_disc.
  {
    id: 'WPN-005',
    schemaVersion: 1,
    nameLoc: 'weapon.hole_punch.name',
    descriptionLoc: 'weapon.hole_punch.description',
    spriteId: 'weapon_hole_punch',
    heldSpriteId: 'weapon_hole_punch_held',
    quality: 2,
    baseWeight: 0.85,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET', 'OFFICE_SUPPLY_SHOP'],
    repeatable: false,
    attack: {
      archetype: 'PROJECTILE',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 0.75,
      intervalSeconds: 0.42,
      projectileSpeed: 8.0,
      projectileLifetime: 0.42,
      projectileSize: 0.32,
      projectileCount: 2,
      spreadRadians: 0.16,
      pierce: 0,
      knockback: 9.0,
      damageTags: ['PROJECTILE'],
    },
    modifierTags: ['PROJECTILE', 'DIRECTED', 'REPEATABLE', 'BURST'],
    adapters: {
      SPLIT: 'SplitProjectileAdapter',
      RETURN: 'ReturnProjectileAdapter',
      // Appendix B.2: either disc marking the target must mark both, which is a
      // weapon-specific translation and exactly why this entry exists.
      STATUS_MARK: 'StatusProjectileAdapter',
      HOMING: 'HomingProjectileAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      KNOCKBACK: 'KnockbackProjectileAdapter',
      RANGE: 'RangeProjectileAdapter',
      SPREAD_CONTROL: 'SpreadControlAdapter',
      MULTIPLY_DUAL: 'DualProjectileAdapter',
      PIERCE: 'PierceProjectileAdapter',
      SIZE: 'SizeProjectileAdapter',
    },
    audio: { fire: 'SFX-WPN_HOLE_PUNCH', impact: 'SFX-IMPACT_HARD' },
    originalityNote:
      'The ammunition is the waste product: two paper chads punched out of nothing '
      + 'in particular, which is the most office thing a projectile can be.',
  },

  // -- WPN-006 Marker -------------------------------------------------------
  // Direct damage sits just under the Keyboard (2.25/s) because the ink line
  // behind the stroke keeps dealing damage after the stroke has gone. The trail is
  // the weapon; the projectile is the delivery.
  // Emits: prj_ink_stroke.
  {
    id: 'WPN-006',
    schemaVersion: 1,
    nameLoc: 'weapon.marker.name',
    descriptionLoc: 'weapon.marker.description',
    spriteId: 'weapon_marker',
    heldSpriteId: 'weapon_marker_held',
    quality: 2,
    baseWeight: 0.85,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET', 'OFFICE_SUPPLY_SHOP'],
    repeatable: false,
    attack: {
      archetype: 'PROJECTILE',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 0.90,
      intervalSeconds: 0.40,
      projectileSpeed: 8.5,
      projectileLifetime: 0.85,
      projectileSize: 0.40,
      projectileCount: 1,
      pierce: 0,
      knockback: 1.5,
      // HAZARD covers the wet ink line the stroke leaves behind; the stroke itself
      // is an ordinary player projectile.
      damageTags: ['PROJECTILE', 'HAZARD'],
    },
    modifierTags: ['PROJECTILE', 'DIRECTED', 'REPEATABLE', 'AREA'],
    adapters: {
      TRAIL_HAZARD: 'TrailProjectileAdapter',
      // Correction Fluid overwrites the ink with slowing whiteout.
      STATUS_SLOW: 'StatusProjectileAdapter',
      STATUS_MARK: 'StatusProjectileAdapter',
      HOMING: 'HomingProjectileAdapter',
      WALL_PASS: 'WallPassProjectileAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      SPLIT: 'SplitProjectileAdapter',
      RANGE: 'RangeProjectileAdapter',
      SIZE: 'SizeProjectileAdapter',
      MULTIPLY_DUAL: 'DualProjectileAdapter',
      PIERCE: 'PierceProjectileAdapter',
    },
    audio: { fire: 'SFX-WPN_MARKER', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'A permanent marker used on a surface it should not be used on: the residue '
      + 'is the point, and it is the reason facilities repaints that wall quarterly.',
  },

  // -- WPN-007 Rubber Stamp -------------------------------------------------
  // Area slam, 1.8 wu of reach and a 0.18 s wind-up you cannot cancel. 3.39/s in
  // exchange, which is the highest single-target output in the common band and the
  // easiest to whiff. Deliberately carries no PROJECTILE tag (Appendix B.2 role
  // note), so projectile-only modifiers resolve to NO_EFFECT (R-WPN-005).
  // Emits: prj_stamp_impression.
  {
    id: 'WPN-007',
    schemaVersion: 1,
    nameLoc: 'weapon.rubber_stamp.name',
    descriptionLoc: 'weapon.rubber_stamp.description',
    spriteId: 'weapon_rubber_stamp',
    heldSpriteId: 'weapon_rubber_stamp_held',
    quality: 2,
    baseWeight: 0.85,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET'],
    repeatable: false,
    attack: {
      archetype: 'AREA_SLAM',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 2.10,
      intervalSeconds: 0.62,
      // The stamp face is rectangular; arcRadius carries the reach the attack
      // graph reads as range, arcAngle approximates the width of that face.
      arcRadius: 1.8,
      arcAngle: 1.25,
      windupSeconds: 0.18,
      activeSeconds: 0.09,
      recoverySeconds: 0.16,
      pierce: -1,
      knockback: 8.0,
      damageTags: ['MELEE'],
    },
    modifierTags: ['AREA_SLAM', 'DIRECTED', 'AREA', 'REPEATABLE'],
    adapters: {
      EIGHT_DIRECTION: 'EightDirectionSlamAdapter',
      REPEAT_ECHO: 'EchoSlamAdapter',
      MULTIPLY_DUAL: 'EchoSlamAdapter',
      SIZE: 'SizeSlamAdapter',
      RANGE: 'ReachArcAdapter',
      KNOCKBACK: 'KnockbackArcAdapter',
      CRIT: 'CritAdapter',
    },
    originalityNote:
      'Approval as violence: the attack is a decision being made on top of someone, '
      + 'and the impression it leaves is a form field, not a crater.',
    audio: { fire: 'SFX-WPN_STAMP', impact: 'SFX-IMPACT_HARD' },
  },

  // -- WPN-008 Paper Shredder -----------------------------------------------
  // Coverage weapon, and the effect-budget stress case named in Appendix B.2.
  // 3.2 wu of reach — barely past arm's length — buys a 0.70 rad cone, five strip
  // lanes, and 2.6/s against every single body inside it.
  // Emits: prj_paper_strip.
  {
    id: 'WPN-008',
    schemaVersion: 1,
    nameLoc: 'weapon.paper_shredder.name',
    descriptionLoc: 'weapon.paper_shredder.description',
    spriteId: 'weapon_paper_shredder',
    heldSpriteId: 'weapon_paper_shredder_held',
    quality: 3,
    baseWeight: 0.45,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET'],
    repeatable: false,
    attack: {
      archetype: 'CONE_STREAM',
      inputMode: 'CARDINAL_HOLD',
      // Per tick. 10 ticks x 0.26 = 2.6/s per target inside the cone.
      baseDamageMultiplier: 0.26,
      intervalSeconds: 0.10,
      coneAngle: 0.70,
      beamRange: 3.2,
      tickRate: 10,
      // Five strip lanes fanned across exactly the cone, so the readable
      // representation and the hit volume describe the same shape (GDD 7.5).
      // No projectileLifetime: the strips expire at beamRange, which keeps reach
      // as the one number a range modifier can move.
      projectileCount: 5,
      spreadRadians: 0.70,
      projectileSpeed: 6.0,
      projectileSize: 0.18,
      pierce: -1,
      knockback: 1.5,
      damageTags: ['PROJECTILE'],
    },
    modifierTags: ['CONE_STREAM', 'DIRECTED', 'SUSTAINED', 'AREA'],
    adapters: {
      DUPLICATE: 'WidenConeAdapter',
      SIZE: 'WidenConeAdapter',
      // Binder Clip aggregates loose strips into piercing metal clips.
      PIERCE: 'AggregateConeAdapter',
      MULTIPLY_DUAL: 'AggregateConeAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      // No RangeConeAdapter exists in the closed vocabulary; a cone and a beam
      // share the same notion of reach, so the beam adapter owns it.
      RANGE: 'RangeBeamAdapter',
      STATUS_SLOW: 'StatusConeAdapter',
      STATUS_MARK: 'StatusConeAdapter',
      // Toner Dust's lingering cloud is a status field left in the cone; there is
      // no TrailConeAdapter, and the cone status adapter is where a persisting
      // volume already lives.
      TRAIL_HAZARD: 'StatusConeAdapter',
      SPREAD_CONTROL: 'SpreadControlAdapter',
    },
    audio: { fire: 'SFX-WPN_SHREDDER', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'A compliance appliance turned outward: the weapon is the confetti of destroyed '
      + 'records, so its coverage is enormous and its reach is one desk away.',
  },

  // -- WPN-009 Presentation Remote ------------------------------------------
  // Slow (5.5 wu/s) and long-lived (2.6 s), so the pulse spends most of its life
  // ricocheting. Direct output is baseline (2.27/s); the bounces are the profit,
  // and the price is that aiming it is a bank shot.
  // Emits: prj_click_pulse.
  {
    id: 'WPN-009',
    schemaVersion: 1,
    nameLoc: 'weapon.presentation_remote.name',
    descriptionLoc: 'weapon.presentation_remote.description',
    spriteId: 'weapon_presentation_remote',
    heldSpriteId: 'weapon_presentation_remote_held',
    quality: 2,
    baseWeight: 0.85,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET', 'INNOVATION_LAB'],
    repeatable: false,
    attack: {
      archetype: 'PROJECTILE',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 1.25,
      intervalSeconds: 0.55,
      projectileSpeed: 5.5,
      projectileLifetime: 2.60,
      projectileSize: 0.50,
      projectileCount: 1,
      pierce: 0,
      bounce: 3,
      knockback: 3.0,
      damageTags: ['PROJECTILE'],
    },
    modifierTags: ['PROJECTILE', 'DIRECTED', 'REPEATABLE'],
    adapters: {
      BOUNCE: 'BounceProjectileAdapter',
      HOMING: 'HomingProjectileAdapter',
      NEAR_MISS_STEER: 'NearMissSteerAdapter',
      DUPLICATE: 'DuplicateProjectileAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      RANGE: 'RangeProjectileAdapter',
      SIZE: 'SizeProjectileAdapter',
      MULTIPLY_DUAL: 'DualProjectileAdapter',
      PIERCE: 'PierceProjectileAdapter',
      RETURN: 'ReturnProjectileAdapter',
      KNOCKBACK: 'KnockbackProjectileAdapter',
      // WALL_PASS is intentionally absent: a pulse that ignores walls has no walls
      // left to bounce off, which deletes the weapon instead of modifying it.
      // R-WPN-005 says NO_EFFECT is the correct answer there.
    },
    audio: { fire: 'SFX-WPN_REMOTE', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'The clicker that advances someone else\'s slides, now advancing through the '
      + 'room off every wall; the fantasy is a meeting that will not end.',
  },

  // -- WPN-010 Desk Phone ---------------------------------------------------
  // Tether. 5.5 wu of cord, 1.93/s outbound and up to 3.86/s when the return path
  // catches the same target, which is the whole skill of the weapon. The slow
  // 0.75 s cycle is the cost of a hit that can be collected twice.
  // Emits: prj_phone_receiver.
  {
    id: 'WPN-010',
    schemaVersion: 1,
    nameLoc: 'weapon.desk_phone.name',
    descriptionLoc: 'weapon.desk_phone.description',
    spriteId: 'weapon_desk_phone',
    heldSpriteId: 'weapon_desk_phone_held',
    quality: 3,
    baseWeight: 0.45,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET', 'INNOVATION_LAB'],
    repeatable: false,
    attack: {
      archetype: 'TETHER',
      inputMode: 'CARDINAL_TAP',
      baseDamageMultiplier: 1.45,
      intervalSeconds: 0.75,
      // Cord length. No projectileLifetime, so Extension Cord lengthens the cord
      // rather than the receiver's flight timer.
      beamRange: 5.5,
      projectileSpeed: 11.0,
      projectileSize: 0.55,
      pierce: 1,
      knockback: 7.0,
      damageTags: ['MELEE', 'PROJECTILE'],
    },
    modifierTags: ['TETHER', 'DIRECTED', 'RETURNING', 'REPEATABLE'],
    adapters: {
      HOMING: 'CurvingTetherAdapter',
      RANGE: 'LengthTetherAdapter',
      STATUS_SHOCK: 'ShockTetherAdapter',
      RETURN: 'ReturnTetherAdapter',
      // The wrap is the receiver adhering to one target, so the projectile-family
      // stick adapter is the honest translation: the receiver is the entity.
      STICK: 'StickProjectileAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      KNOCKBACK: 'KnockbackProjectileAdapter',
      SIZE: 'SizeProjectileAdapter',
      MULTIPLY_DUAL: 'DualProjectileAdapter',
    },
    audio: { fire: 'SFX-WPN_PHONE_THROW', impact: 'SFX-IMPACT_HARD' },
    originalityNote:
      'The handset is still attached to the desk it belongs to, so every attack is '
      + 'a call the player has to reel back in; the cord is the weapon\'s leash.',
  },

  // -- WPN-011 Label Maker --------------------------------------------------
  // Charge projectile. Tier 2 is 1.5 x 1.8 = 2.7 damage per 1.10 s cycle, 2.45/s;
  // tapping at tier 1 is 2.31/s. Charging is close to output-neutral on purpose:
  // it converts a stream of small hits into one delayed, stickable burst.
  // Emits: prj_label.
  {
    id: 'WPN-011',
    schemaVersion: 1,
    nameLoc: 'weapon.label_maker.name',
    descriptionLoc: 'weapon.label_maker.description',
    spriteId: 'weapon_label_maker',
    heldSpriteId: 'weapon_label_maker_held',
    quality: 2,
    baseWeight: 0.85,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET', 'OFFICE_SUPPLY_SHOP'],
    repeatable: false,
    attack: {
      archetype: 'PROJECTILE',
      inputMode: 'CHARGE',
      baseDamageMultiplier: 1.50,
      // Minimum re-arm after release, not the cadence: the charge tiers set that.
      intervalSeconds: 0.30,
      projectileSpeed: 10.0,
      projectileLifetime: 0.90,
      projectileSize: 0.45,
      projectileCount: 1,
      pierce: 0,
      knockback: 2.0,
      chargeTiers: [
        { seconds: 0.00, damageMultiplier: 0.55, sizeMultiplier: 0.70 },
        { seconds: 0.35, damageMultiplier: 1.00, sizeMultiplier: 1.00 },
        { seconds: 0.80, damageMultiplier: 1.80, sizeMultiplier: 1.40 },
      ],
      // EXPLOSION covers the delayed pop once the label has attached.
      damageTags: ['PROJECTILE', 'EXPLOSION'],
    },
    modifierTags: ['PROJECTILE', 'DIRECTED', 'CHARGED', 'STICKY'],
    adapters: {
      STICK: 'StickProjectileAdapter',
      SIZE: 'SizeProjectileAdapter',
      // Autocorrect redirects a label that failed to claim a target.
      NEAR_MISS_STEER: 'NearMissSteerAdapter',
      HOMING: 'HomingProjectileAdapter',
      // A label already is a mark, so marking modifiers read as printed text.
      STATUS_MARK: 'StatusProjectileAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      RHYTHM_CHARGED: 'ChargedEighthAdapter',
      RANGE: 'RangeProjectileAdapter',
      MULTIPLY_DUAL: 'DualProjectileAdapter',
      SPLIT: 'SplitProjectileAdapter',
    },
    // No dedicated label-print fire cue exists; SFX-WPN_STAPLER is the closest
    // existing mechanical eject click. The charge cue is exact.
    audio: {
      fire: 'SFX-WPN_STAPLER',
      impact: 'SFX-IMPACT_SOFT',
      charge: 'SFX-WPN_LABEL_CHARGE',
    },
    originalityNote:
      'Naming a thing is the attack: the label sticks, the target is now categorised, '
      + 'and the categorisation is what eventually goes off.',
  },

  // -- WPN-012 Copier -------------------------------------------------------
  // Charge wave. 2.2/s against one target at top tier, but the sheet is 2.4 wu
  // wide and pierces everything, so a lined-up row is hit for full damage. Slow
  // (4.2 wu/s) and short (6.7 wu) so the push is dodgeable and readable.
  // Emits: prj_copy_sheet.
  {
    id: 'WPN-012',
    schemaVersion: 1,
    nameLoc: 'weapon.copier.name',
    descriptionLoc: 'weapon.copier.description',
    spriteId: 'weapon_copier',
    heldSpriteId: 'weapon_copier_held',
    quality: 3,
    baseWeight: 0.45,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET'],
    repeatable: false,
    attack: {
      archetype: 'CHARGE_WAVE',
      inputMode: 'CHARGE',
      baseDamageMultiplier: 1.60,
      intervalSeconds: 0.35,
      projectileSpeed: 4.2,
      projectileLifetime: 1.60,
      projectileSize: 2.40,
      projectileCount: 1,
      pierce: -1,
      knockback: 12.0,
      chargeTiers: [
        { seconds: 0.25, damageMultiplier: 0.70, sizeMultiplier: 0.80 },
        { seconds: 0.70, damageMultiplier: 1.30, sizeMultiplier: 1.30 },
        { seconds: 1.25, damageMultiplier: 2.20, sizeMultiplier: 1.90 },
      ],
      damageTags: ['PROJECTILE'],
    },
    modifierTags: ['CHARGE_WAVE', 'DIRECTED', 'CHARGED', 'AREA'],
    adapters: {
      HOMING: 'SteeringWaveAdapter',
      MULTIPLY_DUAL: 'PairedWaveAdapter',
      MULTIPLY_TRIPLE: 'PairedWaveAdapter',
      KNOCKBACK: 'WeightWaveAdapter',
      SIZE: 'SizeWaveAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      RHYTHM_CHARGED: 'ChargedEighthAdapter',
      PIERCE: 'PierceProjectileAdapter',
    },
    // No dedicated copier charge cue exists; SFX-WPN_LABEL_CHARGE is the generic
    // rising charge in the library, and the release cue is exact.
    audio: {
      fire: 'SFX-WPN_COPIER_WAVE',
      impact: 'SFX-IMPACT_SOFT',
      charge: 'SFX-WPN_LABEL_CHARGE',
    },
    originalityNote:
      'The output tray as artillery: a warm sheet-shaped wave of duplicated paperwork '
      + 'that shoves people aside, which is what a copier does to a corridor anyway.',
  },

  // -- WPN-013 Desk Fan -----------------------------------------------------
  // The defensive weapon. 1.28/s per target is 58% of baseline and by far the
  // lowest in the roster; the payment is a 5.5 wu cone of continuous 14-knockback
  // push that also turns light hostile projectiles around.
  // Emits: prj_air_gust.
  {
    id: 'WPN-013',
    schemaVersion: 1,
    nameLoc: 'weapon.desk_fan.name',
    descriptionLoc: 'weapon.desk_fan.description',
    spriteId: 'weapon_desk_fan',
    heldSpriteId: 'weapon_desk_fan_held',
    quality: 3,
    baseWeight: 0.45,
    minFloor: 1,
    pools: ['SUPPLY_CLOSET'],
    repeatable: false,
    attack: {
      archetype: 'CONE_STREAM',
      inputMode: 'CARDINAL_HOLD',
      // Per tick. 8 ticks x 0.16 = 1.28/s per target held in the stream.
      baseDamageMultiplier: 0.16,
      intervalSeconds: 0.125,
      coneAngle: 0.52,
      beamRange: 5.5,
      tickRate: 8,
      pierce: -1,
      knockback: 14.0,
      // Airflow is neither a projectile nor a contact hit: it is a ticked directed
      // volume, which is mechanically the beam damage class even though the
      // fiction is moving air. No projectile fields, so nothing travels.
      damageTags: ['BEAM'],
    },
    modifierTags: ['CONE_STREAM', 'DIRECTED', 'SUSTAINED', 'AREA'],
    adapters: {
      // Highlighter marks whatever the stream is currently holding.
      STATUS_MARK: 'StatusConeAdapter',
      STATUS_SLOW: 'StatusConeAdapter',
      RANGE: 'RangeBeamAdapter',
      SIZE: 'WidenConeAdapter',
      EIGHT_DIRECTION: 'EightDirectionAdapter',
      WALL_PASS: 'WallPassProjectileAdapter',
      MULTIPLY_DUAL: 'AggregateConeAdapter',
      SPREAD_CONTROL: 'SpreadControlAdapter',
    },
    audio: { fire: 'SFX-WPN_FAN', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'The one desk appliance whose entire purpose is moving air at people, promoted '
      + 'to crowd control; it wins arguments by position, not by damage.',
  },

  // -- WPN-014 Projector ----------------------------------------------------
  // Placed area, one instance (Appendix B.2). 3.0/s inside the cone while the
  // placement lives, which is the highest sustained figure in the roster — but the
  // cone does not follow the player, so the damage only exists where enemies
  // already are. Placement, not aim, is the skill.
  // Emits: prj_light_wedge.
  {
    id: 'WPN-014',
    schemaVersion: 1,
    nameLoc: 'weapon.projector.name',
    descriptionLoc: 'weapon.projector.description',
    spriteId: 'weapon_projector',
    heldSpriteId: 'weapon_projector_held',
    quality: 4,
    baseWeight: 0.12,
    minFloor: 3,
    pools: ['SUPPLY_CLOSET', 'INNOVATION_LAB'],
    repeatable: false,
    earlyJackpotEligible: false,
    attack: {
      archetype: 'PLACED_AREA',
      inputMode: 'PLACE',
      // Per tick. 5 ticks x 0.60 = 3.0/s inside the cone.
      baseDamageMultiplier: 0.60,
      // Placement cooldown, not a firing cadence.
      intervalSeconds: 1.30,
      placementLifetime: 4.5,
      maxInstances: 1,
      coneAngle: 0.85,
      beamRange: 7.0,
      tickRate: 5,
      pierce: -1,
      knockback: 0,
      damageTags: ['BEAM'],
    },
    modifierTags: ['PLACED_AREA', 'CONE_STREAM', 'AREA', 'SUSTAINED'],
    adapters: {
      EIGHT_DIRECTION: 'AnglePlacementAdapter',
      MULTIPLY_DUAL: 'AnglePlacementAdapter',
      // Rechargeable Battery buys uptime rather than power; CADENCE is the closed
      // vocabulary's name for how often and how long an attack runs.
      CADENCE: 'UptimePlacementAdapter',
      // Webcam makes the cone reveal cloaked threats, which is a mark that shows
      // rather than a mark that scales damage.
      STATUS_MARK: 'RevealPlacementAdapter',
      STATUS_SLOW: 'StatusConeAdapter',
      SIZE: 'WidenConeAdapter',
      RANGE: 'RangeBeamAdapter',
    },
    audio: { fire: 'SFX-WPN_PROJECTOR', impact: 'SFX-IMPACT_SOFT' },
    originalityNote:
      'Left running in an empty meeting room, aimed at the door: the weapon is an '
      + 'unattended slide deck that hurts whoever walks into the light.',
  },
];

export default weapons;
