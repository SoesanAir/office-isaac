/**
 * HAZ-* hazard families. GDD 13.
 *
 * Content kind: hazard. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * GDD refs: 13.2 (Hazard class), 13.3 (ENV-002/011/016/019/021/023/024 emit
 *           these), 18.5 (outline families), R-ENV-002 (mechanical vs
 *           decorative), R-ENV-006 (bounded propagation), R-CMB-002 (every
 *           damaging thing declares a telegraph — here `cycle.warningSeconds`),
 *           R-UIX-005 (every colour cue has a non-colour cue).
 *
 * Authoring conventions used throughout this file:
 *
 * - `damage` is in **half-units** (6 half-units = 3 Composure icons). 1 is a
 *   normal hazard tick, 2 is severe and reserved for machinery a player is never
 *   forced to stand in. Nothing here exceeds 2.
 * - `cycle.warningSeconds` is the visible ramp before a damaging phase. Damaging
 *   hazards use >= 0.3s and anything on damage 2 uses >= 0.6s.
 * - Id note: the schema id pattern is `HAZ-[A-Z0-9_]+`, so exactly one hyphen is
 *   allowed. Family and name segments are therefore separated with underscores.
 * - R-ENV-002 shape rule, applied to every entry below: **mechanical hazards get
 *   a dashed border plus an interior hatch or chevron — thin single dash for
 *   "costs tempo", heavy double dash for "costs health". Decorative decals are
 *   borderless soft blobs at floor contrast with no hatch at all.** Colour is the
 *   third cue and never the first, so the distinction survives a grayscale and
 *   colour-blind review (R-UIX-005). Decorative entries carry damage 0 and no
 *   statuses by schema invariant; they exist so the office looks lived-in without
 *   teaching the player to fear floor art.
 * - `outlineFamily`: HAZARD for anything the building runs, ENVIRONMENT for
 *   decoration, HOSTILE only where a hostile entity or an ownership rule owns the
 *   zone (GDD 18.5 forbids sharing outline language across allegiances).
 */

const hazards = [
  // =========================================================================
  // ELECTRICITY — IT floors, and the payoff of every water/power chain.
  // =========================================================================
  {
    id: 'HAZ-ELEC_FLOOR_ARC',
    schemaVersion: 1,
    nameLoc: 'hazard.floor_arc.name',
    family: 'ELECTRICITY',
    spriteId: 'haz_elec_floor_arc',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'SHOCK', chance: 0.6, seconds: 1.6, magnitude: 1 }],
    cycle: { mode: 'TIMED', warningSeconds: 0.4, activeSeconds: 0.7, idleSeconds: 1.8 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Two fixed floor contacts joined by a dashed-border plate. Idle shows the contacts with an empty '
      + 'hatched gap; the warning fills the gap with a widening zigzag before any damage lands, so the '
      + 'arc is announced by shape change, not colour change.',
  },
  {
    id: 'HAZ-ELEC_SHOCK_LANE',
    schemaVersion: 1,
    nameLoc: 'hazard.shock_lane.name',
    family: 'ELECTRICITY',
    spriteId: 'haz_elec_shock_lane',
    mechanical: true,
    damage: 2,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'SHOCK', chance: 0.85, seconds: 2.2, magnitude: 2 }],
    // Severe damage, so the longest warning in the file, and a POWERED cycle the
    // player can switch off at ENV-019.
    cycle: { mode: 'POWERED', warningSeconds: 0.9, activeSeconds: 1.4, idleSeconds: 2.6 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL', 'MOVABLE_OBJECT'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A full-tile-wide lane between two server bays, bordered by heavy dashed rails with chevron '
      + 'hatching pointing along the lane. Powered-off drops the hatch entirely and greys the rails, so '
      + '"safe lane" and "live lane" differ in fill pattern as well as tone.',
  },
  {
    id: 'HAZ-ELEC_OUTLET_SPARK',
    schemaVersion: 1,
    nameLoc: 'hazard.outlet_spark.name',
    family: 'ELECTRICITY',
    spriteId: 'haz_elec_outlet_spark',
    // Decorative: the office is falling apart, but this particular wall is not.
    mechanical: false,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['NEUTRAL'],
    disableable: false,
    outlineFamily: 'ENVIRONMENT',
    readabilityNote:
      'Set dressing around a wall outlet: soft borderless smudge, no hatch, no floor plate, and it sits '
      + 'on the wall band rather than the walkable floor. Because every mechanical electrical hazard is '
      + 'a dashed-border hatched floor plate, a player never has to test this one by walking into it '
      + '(R-ENV-002).',
  },

  // =========================================================================
  // CABLES — ENV-011 emits these.
  // =========================================================================
  {
    id: 'HAZ-CABLE_TRIP_BUNDLE',
    schemaVersion: 1,
    nameLoc: 'hazard.trip_bundle.name',
    family: 'CABLES',
    spriteId: 'haz_cable_trip_bundle',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [{ status: 'SLOW', chance: 1, seconds: 0.6, magnitude: 1 }],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['PLAYER', 'ENEMY'],
    disableable: false,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Dashed-border strand field on the floor. It never flashes and never damages, and its border is '
      + 'the thin single dash rather than the heavy double dash used by damaging plates — the authored '
      + 'tell for "this costs tempo, not health".',
  },
  {
    id: 'HAZ-CABLE_LIVE_RUN',
    schemaVersion: 1,
    nameLoc: 'hazard.live_cable_run.name',
    family: 'CABLES',
    spriteId: 'haz_cable_live_run',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'SHOCK', chance: 0.5, seconds: 1.4, magnitude: 1 }],
    cycle: { mode: 'POWERED', warningSeconds: 0.45, activeSeconds: 0.9, idleSeconds: 2.2 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'The same strand field as the trip bundle but with the heavy double-dash border and travelling '
      + 'tick marks along each strand during the warning ramp. Border weight separates damage from '
      + 'inconvenience before the player is in range.',
  },
  {
    id: 'HAZ-CABLE_SLACK_COIL',
    schemaVersion: 1,
    nameLoc: 'hazard.slack_coil.name',
    family: 'CABLES',
    spriteId: 'haz_cable_slack_coil',
    mechanical: false,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['NEUTRAL'],
    disableable: false,
    outlineFamily: 'ENVIRONMENT',
    readabilityNote:
      'A tidy coil of spare cable zip-tied to itself. No border, no hatch, and drawn tucked against '
      + 'furniture instead of spanning a walkable lane, so it never takes the shape or the position '
      + 'that mechanical cable hazards take.',
  },

  // =========================================================================
  // MACHINE_STATES — Operations, and every broken office machine.
  // =========================================================================
  {
    id: 'HAZ-MACHINE_STEAM_VENT',
    schemaVersion: 1,
    nameLoc: 'hazard.steam_vent.name',
    family: 'MACHINE_STATES',
    spriteId: 'haz_machine_steam_vent',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'BURN', chance: 0.35, seconds: 2, magnitude: 1 }],
    cycle: { mode: 'TIMED', warningSeconds: 0.6, activeSeconds: 1.1, idleSeconds: 2.4 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A grille plate with a heavy dashed border. The warning phase grows a hard-edged white plume '
      + 'outline out of the grille that reaches full length before the first damage tick, so the plume '
      + 'itself is the countdown.',
  },
  {
    id: 'HAZ-MACHINE_TONER_CLOUD',
    schemaVersion: 1,
    nameLoc: 'hazard.toner_cloud.name',
    family: 'MACHINE_STATES',
    spriteId: 'haz_machine_toner_cloud',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'CONFUSED', chance: 0.4, seconds: 2.5 }],
    cycle: { mode: 'TRIGGERED', warningSeconds: 0.35, activeSeconds: 3.5 },
    affects: ['PLAYER', 'ENEMY'],
    disableable: false,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Dark stippled cloud with a hard dashed outer edge that shrinks visibly as it dissipates, so its '
      + 'remaining lifetime is readable from its size. It draws above the floor plane but below the '
      + 'entity plane at partial coverage, so player and enemy silhouettes stay legible through it.',
  },
  {
    id: 'HAZ-MACHINE_STAMP_PRESS',
    schemaVersion: 1,
    nameLoc: 'hazard.stamp_press.name',
    family: 'MACHINE_STATES',
    spriteId: 'haz_machine_stamp_press',
    mechanical: true,
    damage: 2,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'SLOW', chance: 0.5, seconds: 1, magnitude: 1 }],
    cycle: { mode: 'TIMED', warningSeconds: 0.8, activeSeconds: 0.4, idleSeconds: 2.2 },
    affects: ['PLAYER', 'ENEMY', 'MOVABLE_OBJECT'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A square anvil plate with corner brackets. During the 0.8s warning a shrinking inset square '
      + 'closes on the plate centre, giving an exact colour-independent impact frame; the strike itself '
      + 'is a single flat frame that leaves no lingering zone.',
  },

  // =========================================================================
  // SPILLS — Open Office, break rooms, and every broken ENV-002 / ENV-015.
  // =========================================================================
  {
    id: 'HAZ-SPILL_WATER_SLICK',
    schemaVersion: 1,
    nameLoc: 'hazard.water_slick.name',
    family: 'SPILLS',
    spriteId: 'haz_spill_water_slick',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [{ status: 'SLOW', chance: 1, seconds: 0.8, magnitude: 1 }],
    // Harmless alone. It only becomes dangerous when an ELECTRICITY hazard
    // propagates into it, and that is bounded by ENV-002/ENV-019 maxDepth 3.
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL'],
    disableable: false,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Thin single-dash border with a diagonal streak hatch that reads as "slippery" rather than '
      + '"burning". While shock is conducting through it the hatch swaps to the electrical zigzag and '
      + 'the border thickens to the damaging double dash, so the electrified state is a different '
      + 'pattern and not merely a different tint.',
  },
  {
    id: 'HAZ-SPILL_COFFEE_SCALD',
    schemaVersion: 1,
    nameLoc: 'hazard.coffee_scald.name',
    family: 'SPILLS',
    spriteId: 'haz_spill_coffee_scald',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'BURN', chance: 0.45, seconds: 2, magnitude: 1 }],
    cycle: { mode: 'TIMED', warningSeconds: 0.35, activeSeconds: 4, idleSeconds: 1.2 },
    affects: ['PLAYER', 'ENEMY'],
    disableable: false,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Heavy double-dash border, dense bubble hatch, and a steam tick along the top edge that fades as '
      + 'the puddle cools into a harmless ENV-021 stain. The cooling transition is a shape change: '
      + 'bubbles thin out and the border drops to a single dash before it is safe.',
  },
  {
    id: 'HAZ-SPILL_DRY_STAIN',
    schemaVersion: 1,
    nameLoc: 'hazard.dry_stain.name',
    family: 'SPILLS',
    spriteId: 'haz_spill_dry_stain',
    mechanical: false,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['NEUTRAL'],
    disableable: false,
    outlineFamily: 'ENVIRONMENT',
    readabilityNote:
      'The decorative half of the ENV-021 pair: borderless soft blob, no hatch, low contrast against '
      + 'the floor tile. Every mechanical spill has a dashed border and an interior hatch, so a player '
      + 'identifies this as safe from across the room without testing it (R-ENV-002).',
  },

  // =========================================================================
  // CONVEYORS — Operations. ENV-024 emits these.
  // =========================================================================
  {
    id: 'HAZ-CONVEYOR_BELT_RUN',
    schemaVersion: 1,
    nameLoc: 'hazard.belt_run.name',
    family: 'CONVEYORS',
    spriteId: 'haz_conveyor_belt_run',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL', 'MOVABLE_OBJECT'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Recessed lane of scrolling chevron slats. Direction is the chevron point, speed is the scroll '
      + 'rate, and the idle state replaces chevrons with flat stop bands — three non-colour cues for '
      + 'the three things the player needs to know (direction, speed, on/off).',
  },
  {
    id: 'HAZ-CONVEYOR_REVERSING_BELT',
    schemaVersion: 1,
    nameLoc: 'hazard.reversing_belt.name',
    family: 'CONVEYORS',
    spriteId: 'haz_conveyor_reversing_belt',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    // The "warning" here is the direction-flip ramp: chevrons stall, then invert.
    cycle: { mode: 'TIMED', warningSeconds: 0.7, activeSeconds: 4, idleSeconds: 0.8 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL', 'MOVABLE_OBJECT'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Identical slats to the straight belt, but the reversal is telegraphed by chevrons collapsing to '
      + 'flat bars for 0.7s before they re-point the other way. A player reading only shape still gets '
      + 'a full warning before being carried the other direction.',
  },
  {
    id: 'HAZ-CONVEYOR_PINCH_ROLLER',
    schemaVersion: 1,
    nameLoc: 'hazard.pinch_roller.name',
    family: 'CONVEYORS',
    spriteId: 'haz_conveyor_pinch_roller',
    mechanical: true,
    damage: 2,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'ROOTED', chance: 0.3, seconds: 0.5 }],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.6 },
    affects: ['PLAYER', 'ENEMY', 'MOVABLE_OBJECT'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'The one-tile roller mouth at the end of a belt: two counter-rotating drum outlines with heavy '
      + 'double-dash brackets and a hard black bite line between them. It is always the terminal tile '
      + 'of a lane, so its position teaches its function, and the 0.6s ramp starts the moment an entity '
      + 'enters the tile before the mouth.',
  },

  // =========================================================================
  // SCANNERS — Executive and security rooms. ENV-023 emits these.
  // =========================================================================
  {
    id: 'HAZ-SCANNER_SWEEP_LINE',
    schemaVersion: 1,
    nameLoc: 'hazard.sweep_line.name',
    family: 'SCANNERS',
    spriteId: 'haz_scanner_sweep_line',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'MARKED', chance: 0.7, seconds: 4 }],
    cycle: { mode: 'SWEEP', warningSeconds: 0.5, activeSeconds: 2.6, idleSeconds: 1.6 },
    affects: ['PLAYER', 'NEUTRAL'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A narrow travelling line with a dashed leading edge and a dotted track that shows the entire '
      + 'path it will take before it moves. Because the track is painted first, the sweep is '
      + 'predictable from the doorway; the line is a floor decal that never leaves the floor plane, so '
      + 'it cannot be read as a beam attack from an entity.',
  },
  {
    id: 'HAZ-SCANNER_MARK_PULSE',
    schemaVersion: 1,
    nameLoc: 'hazard.mark_pulse.name',
    family: 'SCANNERS',
    spriteId: 'haz_scanner_mark_pulse',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [{ status: 'MARKED', chance: 1, seconds: 6 }],
    cycle: { mode: 'TIMED', warningSeconds: 0.4, activeSeconds: 0.5, idleSeconds: 3 },
    affects: ['PLAYER'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A concentric ring pulse from a floor plate: no damage, thin single-dash border. Rings expand in '
      + 'discrete steps so the player can count them, and the resulting mark is shown on the player '
      + 'rather than on the floor, which keeps the decal itself unambiguous.',
  },
  {
    id: 'HAZ-SCANNER_IDLE_READER',
    schemaVersion: 1,
    nameLoc: 'hazard.idle_reader.name',
    family: 'SCANNERS',
    spriteId: 'haz_scanner_idle_reader',
    mechanical: false,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['NEUTRAL'],
    disableable: false,
    outlineFamily: 'ENVIRONMENT',
    readabilityNote:
      'A dead badge reader beside a door: borderless, no floor plate, no dotted track. Every live '
      + 'scanner paints its future path on the floor before it fires, so the absence of a track is the '
      + 'tell that this one is scenery (R-ENV-002).',
  },

  // =========================================================================
  // FIRE — spreads through PAPER, erased by FOAM.
  // =========================================================================
  {
    id: 'HAZ-FIRE_PAPER_BLAZE',
    schemaVersion: 1,
    nameLoc: 'hazard.paper_blaze.name',
    family: 'FIRE',
    spriteId: 'haz_fire_paper_blaze',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'BURN', chance: 0.8, seconds: 3, magnitude: 1 }],
    cycle: { mode: 'TIMED', warningSeconds: 0.4, activeSeconds: 5, idleSeconds: 0.5 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Hard-edged flame tongues on a dashed-border scorch plate, animated on three frames. It shrinks '
      + 'frame by frame as it burns out, so remaining lifetime is readable from footprint size; ENV-016 '
      + 'foam deletes it outright in a single white wipe frame.',
  },
  {
    id: 'HAZ-FIRE_SCORCH_MARK',
    schemaVersion: 1,
    nameLoc: 'hazard.scorch_mark.name',
    family: 'FIRE',
    spriteId: 'haz_fire_scorch_mark',
    mechanical: false,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['NEUTRAL'],
    disableable: false,
    outlineFamily: 'ENVIRONMENT',
    readabilityNote:
      'What a fire leaves behind, and what an older incident left behind: a borderless soft dark smear '
      + 'with no flame tongues at all. Live fire is defined by animated tongues, so a still flameless '
      + 'smear is unambiguously safe (R-ENV-002).',
  },

  // =========================================================================
  // GLASS — the aftermath of ENV-005 / ENV-012 / ENV-020.
  // =========================================================================
  {
    id: 'HAZ-GLASS_SHARD_FIELD',
    schemaVersion: 1,
    nameLoc: 'hazard.shard_field.name',
    family: 'GLASS',
    spriteId: 'haz_glass_shard_field',
    mechanical: true,
    damage: 1,
    damageTags: ['CONTACT'],
    statusApplied: [{ status: 'SLOW', chance: 0.4, seconds: 0.8, magnitude: 1 }],
    cycle: { mode: 'TIMED', warningSeconds: 0.3, activeSeconds: 7, idleSeconds: 0.5 },
    affects: ['PLAYER', 'ENEMY'],
    disableable: false,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Scattered angular shard shapes inside a heavy double-dash boundary; shards thin out visibly over '
      + 'the field lifetime so it is obvious when the floor has swept clear. Shards are static specks '
      + 'that never travel, so they cannot be mistaken for projectiles.',
  },

  // =========================================================================
  // PRESSURE — Facilities airflow. Moves things, never damages.
  // =========================================================================
  {
    id: 'HAZ-PRESSURE_HVAC_BLAST',
    schemaVersion: 1,
    nameLoc: 'hazard.hvac_blast.name',
    family: 'PRESSURE',
    spriteId: 'haz_pressure_hvac_blast',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'TIMED', warningSeconds: 0.55, activeSeconds: 1.6, idleSeconds: 2.8 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL', 'MOVABLE_OBJECT'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A vent grille with directional streak lines that lengthen through the warning phase and then '
      + 'scroll during the blast. It pushes and never damages, and it says so by carrying no hatch fill '
      + 'at all — only motion streaks, the shared language for displacement.',
  },

  // =========================================================================
  // DARKNESS — Facilities and secret floors. Removes information, not health.
  // =========================================================================
  {
    id: 'HAZ-DARKNESS_OUTAGE_ZONE',
    schemaVersion: 1,
    nameLoc: 'hazard.outage_zone.name',
    family: 'DARKNESS',
    spriteId: 'haz_darkness_outage_zone',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [],
    cycle: { mode: 'POWERED', warningSeconds: 0.6, activeSeconds: 6, idleSeconds: 3 },
    affects: ['PLAYER'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A dimmed floor region bounded by a dashed edge with corner ticks, so its extent stays visible '
      + 'even while its interior is dark. Hostile outlines inside the zone keep full contrast '
      + '(R-ART-003): the zone hides scenery, never threats.',
  },

  // =========================================================================
  // RED_TAPE — Legal. Denies movement without dealing damage.
  // =========================================================================
  {
    id: 'HAZ-REDTAPE_COMPLIANCE_BAND',
    schemaVersion: 1,
    nameLoc: 'hazard.compliance_band.name',
    family: 'RED_TAPE',
    spriteId: 'haz_redtape_compliance_band',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [
      { status: 'ROOTED', chance: 0.35, seconds: 0.7 },
      { status: 'SLOW', chance: 1, seconds: 1, magnitude: 2 },
    ],
    cycle: { mode: 'TRIGGERED', warningSeconds: 0.45, activeSeconds: 2.5 },
    affects: ['PLAYER', 'ENEMY'],
    disableable: true,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'Barrier tape stretched across a lane in hard diagonal stripes, drawn on the floor plane with a '
      + 'thin dashed border. The striped band is reserved across the whole game for movement denial and '
      + 'never for damage, so its pattern alone tells the player what it costs.',
  },

  // =========================================================================
  // PAPER — Open Office. The soft, cheap movement tax.
  // =========================================================================
  {
    id: 'HAZ-PAPER_DRIFT_BANK',
    schemaVersion: 1,
    nameLoc: 'hazard.paper_drift.name',
    family: 'PAPER',
    spriteId: 'haz_paper_drift_bank',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [{ status: 'SLOW', chance: 1, seconds: 0.5, magnitude: 1 }],
    cycle: { mode: 'ALWAYS_ON', warningSeconds: 0.2 },
    affects: ['PLAYER', 'ENEMY'],
    disableable: false,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A drift of loose sheets with a thin single-dash border, ankle high, no animation beyond a slow '
      + 'edge flutter. Single dash plus zero flash is the file-wide signature for "slows you, costs no '
      + 'health". It is flammable, and igniting replaces it with HAZ-FIRE_PAPER_BLAZE, which brings its '
      + 'own warning ramp.',
  },

  // =========================================================================
  // FOAM — ENV-016's output. Pushes, cleans, does not hurt.
  // =========================================================================
  {
    id: 'HAZ-FOAM_DISCHARGE_CLOUD',
    schemaVersion: 1,
    nameLoc: 'hazard.foam_discharge.name',
    family: 'FOAM',
    spriteId: 'haz_foam_discharge_cloud',
    mechanical: true,
    damage: 0,
    damageTags: [],
    statusApplied: [{ status: 'SLOW', chance: 0.8, seconds: 1.2, magnitude: 1 }],
    cycle: { mode: 'TRIGGERED', warningSeconds: 0.25, activeSeconds: 2.2 },
    affects: ['PLAYER', 'ENEMY', 'NEUTRAL', 'MOVABLE_OBJECT'],
    disableable: false,
    outlineFamily: 'HAZARD',
    readabilityNote:
      'A bright white bubble mass with a scalloped hard edge, expanding as a cone from wherever the '
      + 'canister stood. It is the brightest floor effect in the game and it erases FIRE, SPILLS, and '
      + 'PAPER decals as it passes, so the cleanup is self-evident: the floor visibly loses its other '
      + 'markings.',
  },

  // =========================================================================
  // VOTE — Board floors. Owned by a hostile rule, so HOSTILE outline (18.5).
  // =========================================================================
  {
    id: 'HAZ-VOTE_QUORUM_CIRCLE',
    schemaVersion: 1,
    nameLoc: 'hazard.quorum_circle.name',
    family: 'VOTE',
    spriteId: 'haz_vote_quorum_circle',
    mechanical: true,
    damage: 1,
    damageTags: ['HAZARD'],
    statusApplied: [{ status: 'MARKED', chance: 1, seconds: 5 }],
    cycle: { mode: 'TRIGGERED', warningSeconds: 0.75, activeSeconds: 1.2, idleSeconds: 3.5 },
    affects: ['PLAYER'],
    disableable: false,
    // A board rule enforces this zone, not the building, so it uses the hostile
    // outline family rather than the environment one (GDD 18.5, R-ART-003).
    outlineFamily: 'HOSTILE',
    readabilityNote:
      'A ring of seat markers that closes inward over 0.75s before it resolves. Seat markers are static '
      + 'wedges painted on the floor and nothing ever detaches from the ring, so no part of it reads as '
      + 'a shot; the hostile outline tells the player a rule and not the building is enforcing it.',
  },
];

export default hazards;
