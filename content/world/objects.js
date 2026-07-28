/**
 * ENV-001..024. GDD 13.3 / F.2.
 *
 * Content kind: envObject. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * GDD refs: 13.1 (office-rock principle), 13.2 (object classes), 13.3 (catalog),
 *           13.4 (hidden contents), R-ENV-001 (collision matches visible shape),
 *           R-ENV-002 (mechanical vs decorative), R-ENV-003 (object-scoped loot),
 *           R-ENV-005 (never reads as hostile), R-ENV-006 (bounded chains).
 *
 * Authoring conventions used throughout this file:
 *
 * - `collision.w/h` is the **ground footprint in world units** (1 wu = TILE =
 *   32px), centred on the object anchor. Upright furniture is drawn with its
 *   base band inside that footprint and its body rising above the anchor, so the
 *   collision overlay review (R-ENV-001) sees no invisible extension: the box is
 *   exactly the part of the sprite that stands on the floor. Objects that
 *   genuinely occupy two tiles of floor (server rack) declare h = 2.
 * - Class choice follows the §13.2 table, not the §13.3 prose label. Where §13.3
 *   says "Destructible hazard" (ENV-002) the mechanical class is the destructible
 *   one and the hazard is the *consequence*, declared through onDestroy.
 * - `onDestroy` carries only the physical consequences of breaking (spill,
 *   shards, collapse, cloud). Contents — including hostile surprises — come from
 *   the referenced OLT table so every content roll uses the OBJECT_CONTENT stream
 *   (R-ENV-003) and never perturbs the pedestal sequence.
 * - `chainReaction` is declared only on the three objects §13.3 says link
 *   (ENV-002 water, ENV-016 foam, ENV-019 power). `maxDepth` stays at 2-3 so
 *   propagation provably terminates (R-ENV-006).
 * - Every object is a matte, statically lit fixture. Status lamps are baked into
 *   the chassis, never free-floating, because a glowing dot travelling over the
 *   floor is projectile language (R-ENV-005).
 */

const envObjects = [
  // -- ENV-001 Filing Cabinet ------------------------------------------------
  // The reference "office rock" (§13.1). Everything else is balanced relative to
  // this one: 18 half-units is roughly three unmodified basic shots.
  {
    id: 'ENV-001',
    schemaVersion: 1,
    nameLoc: 'object.filing_cabinet.name',
    spriteId: 'obj_filing_cabinet',
    objectClass: 'DESTRUCTIBLE_HEAVY',
    collision: {
      w: 1, h: 1,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: false,
    },
    health: 18,
    requiresBlast: false,
    lootTable: 'OLT-CABINET',
    onDestroy: [
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'PAINTED_STEEL', pieces: 6 } },
      { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 4, decorative: true }, chance: 0.35 },
    ],
    variants: [
      {
        id: 'ENV001_METAL',
        label: 'Metal Filing Cabinet',
        paletteSwap: { G: '#5a5a70', h: '#8a8a9e' },
        // §13.3: "Metal variants require multiple hits or a blast."
        overrides: { health: 44, requiresBlast: true },
      },
      {
        id: 'ENV001_DAMAGED',
        label: 'Dented Filing Cabinet',
        overrides: { health: 8, spriteId: 'obj_filing_cabinet_damaged' },
      },
      {
        id: 'ENV001_OVERSTUFFED',
        label: 'Overstuffed Filing Cabinet',
        overrides: {
          onDestroy: [
            { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'PAINTED_STEEL', pieces: 6 } },
            { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 12, decorative: true } },
          ],
        },
      },
    ],
    readabilityNote:
      'Squat static box, matte grey, no limbs, eyes, or emissive parts; the drawer slots read as '
      + 'horizontal recesses rather than a face. It never moves, so at combat scale it cannot be '
      + 'confused with a chaser or a projectile.',
  },

  // -- ENV-002 Water Cooler -------------------------------------------------
  {
    id: 'ENV-002',
    schemaVersion: 1,
    nameLoc: 'object.water_cooler.name',
    spriteId: 'obj_water_cooler',
    objectClass: 'DESTRUCTIBLE_LIGHT',
    collision: {
      w: 0.8, h: 0.8,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 10,
    requiresBlast: false,
    lootTable: 'OLT-COOLER',
    onDestroy: [
      { hook: 'SPAWN_WATER_SPILL', params: { hazardId: 'HAZ-SPILL_WATER_SLICK', radius: 1.6, seconds: 14 } },
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'WHITE_PLASTIC', pieces: 5 } },
    ],
    // §13.3: the spill "conducts shock effects". Depth 3 caps the cascade at
    // water -> strip -> one adjacent device; it can never walk a whole room.
    chainReaction: { propagates: ['WATER', 'SHOCK'], maxDepth: 3 },
    variants: [
      {
        id: 'ENV002_FULL',
        label: 'Full Water Cooler',
        overrides: {
          onDestroy: [
            { hook: 'SPAWN_WATER_SPILL', params: { hazardId: 'HAZ-SPILL_WATER_SLICK', radius: 2.4, seconds: 22 } },
            { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'WHITE_PLASTIC', pieces: 5 } },
          ],
        },
      },
      {
        id: 'ENV002_EMPTY',
        label: 'Empty Water Cooler',
        paletteSwap: { c: '#c8c8d6', C: '#eef0f6' },
        overrides: {
          onDestroy: [{ hook: 'SPAWN_DEBRIS_BURST', params: { material: 'WHITE_PLASTIC', pieces: 5 } }],
          chainReaction: null,
        },
      },
      {
        id: 'ENV002_PRE_BROKEN',
        label: 'Already-Broken Water Cooler',
        overrides: { spriteId: 'obj_water_cooler_broken', health: 4, lootTable: null },
      },
    ],
    readabilityNote:
      'The bottle-on-column silhouette is unique among objects and shares no outline with any enemy. '
      + 'The pale blue bottle is a flat fill with no rim light, so it cannot be mistaken for a '
      + 'travelling projectile.',
  },

  // -- ENV-003 Printer ------------------------------------------------------
  {
    id: 'ENV-003',
    schemaVersion: 1,
    nameLoc: 'object.printer.name',
    spriteId: 'obj_printer',
    objectClass: 'DESTRUCTIBLE_HEAVY',
    collision: {
      w: 1.4, h: 1,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: false,
    },
    health: 26,
    requiresBlast: false,
    lootTable: 'OLT-PRINTER',
    onDestroy: [
      { hook: 'SPAWN_TONER_CLOUD', params: { hazardId: 'HAZ-MACHINE_TONER_CLOUD', radius: 1.5, seconds: 4 }, chance: 0.5 },
      { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 10, decorative: true } },
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'BEIGE_PLASTIC', pieces: 7 } },
    ],
    variants: [
      {
        id: 'ENV003_JAMMED',
        label: 'Jammed Printer',
        // §13.3: "Jammed variants periodically fire paper until broken."
        overrides: {
          spriteId: 'obj_printer_jammed',
          emitsHazard: 'HAZ-PAPER_DRIFT_BANK',
          ambientAttack: { hook: 'SPAWN_PAPER_SCATTER', intervalSeconds: 2.4, telegraphSeconds: 0.45 },
        },
      },
      {
        id: 'ENV003_TONER_HEAVY',
        label: 'Toner-Loaded Printer',
        overrides: {
          onDestroy: [
            { hook: 'SPAWN_TONER_CLOUD', params: { hazardId: 'HAZ-MACHINE_TONER_CLOUD', radius: 2.2, seconds: 6 } },
            { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'BEIGE_PLASTIC', pieces: 7 } },
          ],
        },
      },
      {
        id: 'ENV003_PLOTTER',
        label: 'Wide-Format Plotter',
        paletteSwap: { G: '#4a4a5e', h: '#8a8a9e' },
        overrides: {
          collision: {
            w: 2.2, h: 1,
            blocksMovement: true,
            blocksProjectiles: true,
            blocksFlying: true,
            blocksLineOfSight: false,
          },
          health: 56,
          requiresBlast: true,
        },
      },
    ],
    readabilityNote:
      'Wide low slab, wider than tall, with a horizontal output slot. No enemy uses a landscape slab '
      + 'silhouette, and the panel lamp is a two-pixel notch inside the chassis outline rather than a '
      + 'floating glow.',
  },

  // -- ENV-004 Recycling Bin ------------------------------------------------
  {
    id: 'ENV-004',
    schemaVersion: 1,
    nameLoc: 'object.recycling_bin.name',
    spriteId: 'obj_recycling_bin',
    objectClass: 'DESTRUCTIBLE_LIGHT',
    collision: {
      w: 0.8, h: 0.8,
      blocksMovement: true,
      blocksProjectiles: true,
      // Knee-high tub: ground shots bury into it, flyers pass over.
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 6,
    requiresBlast: false,
    lootTable: 'OLT-BIN',
    onDestroy: [
      // §13.3: "sometimes launches paper debris that can trigger nearby objects".
      { hook: 'LAUNCH_PAPER_DEBRIS', params: { pieces: 8, impulse: 3.2, canTriggerObjects: true } },
    ],
    variants: [
      {
        id: 'ENV004_OVERFLOWING',
        label: 'Overflowing Recycling Bin',
        overrides: {
          onDestroy: [
            { hook: 'LAUNCH_PAPER_DEBRIS', params: { pieces: 14, impulse: 3.6, canTriggerObjects: true } },
            { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 8, decorative: true } },
          ],
        },
      },
      {
        id: 'ENV004_METAL',
        label: 'Metal Waste Bin',
        paletteSwap: { B: '#6d6d84', b: '#4a4a5e' },
        overrides: { health: 26, requiresBlast: true },
      },
    ],
    readabilityNote:
      'Tapered tub with a pale rim, half a tile tall, drawn flat with no highlight. Its blocky '
      + 'recycling glyph is a static interior mark, not an eye or a mouth, and it never animates.',
  },

  // -- ENV-005 Vending Machine ----------------------------------------------
  {
    id: 'ENV-005',
    schemaVersion: 1,
    nameLoc: 'object.vending_machine.name',
    spriteId: 'obj_vending_machine',
    objectClass: 'INTERACTIVE',
    collision: {
      w: 1.1, h: 1,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: true,
    },
    health: 34,
    requiresBlast: false,
    lootTable: 'OLT-VENDING',
    onDestroy: [
      { hook: 'SPAWN_GLASS_SHARDS', params: { hazardId: 'HAZ-GLASS_SHARD_FIELD', radius: 1.4, seconds: 6 } },
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'RED_STEEL', pieces: 8 } },
    ],
    onInteract: {
      hook: 'VEND_WEIGHTED_SNACK',
      cost: { credits: 5 },
      // Purchase odds are deliberately *not* the §13.4 destruction bands: the
      // player paid, so the machine mostly delivers. The OLT table above is the
      // "smash it instead" path, and that one keeps NOTHING dominant.
      params: {
        maxUses: 3,
        outcomes: [
          { kind: 'SNACK_HEALTH', weight: 46 },
          { kind: 'SUPPLEMENT', weight: 18 },
          { kind: 'CREDITS_REFUND', weight: 12 },
          { kind: 'COFFEE_TAG_PICKUP', weight: 12 },
          { kind: 'JAM_NO_ITEM', weight: 12 },
        ],
      },
    },
    variants: [
      {
        id: 'ENV005_JAMMED',
        label: 'Jammed Vending Machine',
        overrides: { onInteract: { hook: 'JAM_MACHINE', params: { shakeToFree: true, freeChance: 0.25 } } },
      },
      {
        id: 'ENV005_SOLD_OUT',
        label: 'Sold-Out Vending Machine',
        overrides: { spriteId: 'obj_vending_machine_empty', onInteract: null, lootTable: 'OLT-BIN' },
      },
      {
        id: 'ENV005_UNBRANDED',
        label: 'Unbranded Vending Machine',
        paletteSwap: { R: '#6d6d84', r: '#4a4a5e' },
        // Cheaper, worse odds, and the only variant that can hide a passage.
        overrides: {
          onInteract: {
            hook: 'VEND_WEIGHTED_SNACK',
            cost: { credits: 2 },
            params: {
              maxUses: 2,
              outcomes: [
                { kind: 'SNACK_HEALTH', weight: 30 },
                { kind: 'SUPPLEMENT', weight: 10 },
                { kind: 'JAM_NO_ITEM', weight: 46 },
                { kind: 'REVEAL_HIDDEN_PASSAGE', weight: 14 },
              ],
            },
          },
        },
      },
    ],
    readabilityNote:
      'Tall rectangle with a sign band and a lit product window; the window contents are a static grid '
      + 'of flat colour blocks locked inside the frame. It is the only object with a saturated red '
      + 'chassis and it always stands flush against a wall, so it never reads as an approach.',
  },

  // -- ENV-006 Office Plant -------------------------------------------------
  {
    id: 'ENV-006',
    schemaVersion: 1,
    nameLoc: 'object.office_plant.name',
    spriteId: 'obj_office_plant',
    objectClass: 'DESTRUCTIBLE_LIGHT',
    collision: {
      w: 0.8, h: 0.8,
      blocksMovement: true,
      blocksProjectiles: false,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 5,
    requiresBlast: false,
    lootTable: 'OLT-PLANT',
    onDestroy: [
      { hook: 'SCATTER_SOIL_PATCH', params: { radius: 0.9, decorative: true } },
    ],
    variants: [
      {
        id: 'ENV006_CACTUS',
        label: 'Cactus Plant',
        // §13.3: "Cactus variant deals contact damage."
        overrides: {
          spriteId: 'obj_office_plant_cactus',
          contactDamage: 1,
          contactDamageTags: ['CONTACT'],
          health: 9,
        },
      },
      {
        id: 'ENV006_FICUS',
        label: 'Tall Ficus',
        overrides: {
          collision: {
            w: 0.9, h: 0.9,
            blocksMovement: true,
            blocksProjectiles: false,
            blocksFlying: false,
            blocksLineOfSight: true,
          },
          health: 7,
        },
      },
      {
        id: 'ENV006_DEAD',
        label: 'Dead Office Plant',
        paletteSwap: { e: '#6a5a2a', E: '#a08a3a' },
        overrides: { lootTable: 'OLT-BIN' },
      },
    ],
    readabilityNote:
      'Leaf crown over a terracotta pot. The foliage is a single flat green mass with a hard outline '
      + 'and zero idle motion, which separates it from any organic hostile; the cactus variant adds '
      + 'pale static spine ticks that read as surface texture, not as fired spines.',
  },

  // -- ENV-007 Cubicle Divider ----------------------------------------------
  {
    id: 'ENV-007',
    schemaVersion: 1,
    nameLoc: 'object.cubicle_divider.name',
    spriteId: 'obj_cubicle_divider',
    objectClass: 'DESTRUCTIBLE_LIGHT',
    collision: {
      w: 3, h: 0.4,
      blocksMovement: true,
      blocksProjectiles: true,
      // §13.3: "Blocks movement and low projectiles" -> flyers cross freely.
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 14,
    requiresBlast: false,
    lootTable: 'OLT-DIVIDER',
    onDestroy: [
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'FABRIC_PANEL', pieces: 6 } },
    ],
    variants: [
      {
        id: 'ENV007_FIXED',
        label: 'Fixed Cubicle Divider',
        overrides: { objectClass: 'INDESTRUCTIBLE', health: null, lootTable: null },
      },
      {
        id: 'ENV007_SLIDING',
        label: 'Sliding Cubicle Divider',
        // Lane changes: pushed along its long axis to open or close a route.
        overrides: { objectClass: 'MOVABLE', pushable: true, pushAxis: 'LONG', pushSpeed: 2.4 },
      },
      {
        id: 'ENV007_DAMAGED',
        label: 'Damaged Cubicle Divider',
        overrides: { spriteId: 'obj_cubicle_divider_damaged', health: 6, hasAuthoredGap: true },
      },
      {
        id: 'ENV007_BLASTABLE',
        label: 'Blastable Cubicle Divider',
        paletteSwap: { G: '#7a6a4a' },
        overrides: { requiresBlast: true, health: 20 },
      },
    ],
    readabilityNote:
      'Long thin fabric panel, always axis-aligned, three tiles wide and less than half a tile deep. '
      + 'Nothing hostile in the game is a straight wall segment, and the panel carries no interior '
      + 'detail that could resolve into a charging silhouette.',
  },

  // -- ENV-008 Desk ---------------------------------------------------------
  {
    id: 'ENV-008',
    schemaVersion: 1,
    nameLoc: 'object.desk.name',
    spriteId: 'obj_desk',
    objectClass: 'DESTRUCTIBLE_HEAVY',
    collision: {
      w: 2, h: 1,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: false,
    },
    health: 48,
    requiresBlast: false,
    lootTable: 'OLT-DESK',
    onDestroy: [
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'LAMINATE', pieces: 9 } },
      { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 6, decorative: true }, chance: 0.4 },
    ],
    variants: [
      {
        id: 'ENV008_INTACT',
        label: 'Intact Desk',
        overrides: { hasAuthoredGap: true },
      },
      {
        id: 'ENV008_OVERTURNED',
        label: 'Overturned Desk',
        // On its side: still cover for ground shots, no longer a ceiling.
        overrides: {
          spriteId: 'obj_desk_overturned',
          collision: {
            w: 2, h: 0.6,
            blocksMovement: true,
            blocksProjectiles: true,
            blocksFlying: false,
            blocksLineOfSight: false,
          },
          health: 32,
        },
      },
      {
        id: 'ENV008_ELECTRIFIED',
        label: 'Electrified Desk',
        paletteSwap: { o: '#1f6f76', O: '#3fb0b8' },
        overrides: {
          contactDamage: 1,
          contactDamageTags: ['HAZARD'],
          emitsHazard: 'HAZ-ELEC_FLOOR_ARC',
          poweredBy: 'ENV-019',
        },
      },
      {
        id: 'ENV008_BREAKABLE',
        label: 'Flat-Pack Desk',
        overrides: { health: 20 },
      },
    ],
    readabilityNote:
      'Two-tile landscape slab with a visible leg shadow and drawer seams. It is the largest static '
      + 'footprint in a normal room and never changes shape unless destroyed, so the eye files it as '
      + 'architecture rather than as a creature.',
  },

  // -- ENV-009 Rolling Chair ------------------------------------------------
  {
    id: 'ENV-009',
    schemaVersion: 1,
    nameLoc: 'object.rolling_chair.name',
    spriteId: 'obj_rolling_chair',
    objectClass: 'MOVABLE',
    collision: {
      w: 0.7, h: 0.7,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 8,
    requiresBlast: false,
    lootTable: 'OLT-CHAIR',
    onDestroy: [
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'MESH_AND_CHROME', pieces: 5 } },
    ],
    variants: [
      {
        id: 'ENV009_TASK_CHAIR',
        label: 'Task Chair',
        overrides: { mass: 1, impactDamage: 1, pushSpeed: 6 },
      },
      {
        id: 'ENV009_EXECUTIVE',
        label: 'Executive Chair',
        paletteSwap: { G: '#8a6a1a', h: '#e0be4a' },
        overrides: { mass: 2, impactDamage: 1, pushSpeed: 4, health: 16 },
      },
      {
        id: 'ENV009_SEIZED',
        label: 'Seized Rolling Chair',
        overrides: { pushable: false, impactDamage: 0, health: 5 },
      },
    ],
    readabilityNote:
      'A rolling chair does move, so it is drawn with a hard neutral outline, no facing, no eyes, and '
      + 'a wheelbase kept flat on the floor plane. Its motion is always pure physics drift along the '
      + 'push vector, never the accelerating intercept curve an enemy uses.',
  },

  // -- ENV-010 Server Rack --------------------------------------------------
  // §13.3 offers "Indestructible or high-health". The base object is the
  // indestructible wall-of-bays used for firing geometry; the decommissioned
  // variant is the high-health destructible.
  {
    id: 'ENV-010',
    schemaVersion: 1,
    nameLoc: 'object.server_rack.name',
    spriteId: 'obj_server_rack',
    objectClass: 'INDESTRUCTIBLE',
    collision: {
      w: 1, h: 2,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: true,
    },
    requiresBlast: false,
    onDestroy: [
      // Only reachable through ENV010_DECOMMISSIONED, which overrides the class
      // to DESTRUCTIBLE_HEAVY. Declared at this level on purpose so the hook is
      // covered by hook-coverage validation instead of hiding in an overrides bag.
      { hook: 'CUT_POWER_LINK', params: { network: 'ROOM_ELECTRICAL' } },
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'RACK_STEEL', pieces: 10 } },
    ],
    variants: [
      {
        id: 'ENV010_POWERED',
        label: 'Powered Server Rack',
        overrides: { emitsHazard: 'HAZ-ELEC_SHOCK_LANE', disableableBy: ['ENV-019'] },
      },
      {
        id: 'ENV010_DECOMMISSIONED',
        label: 'Decommissioned Server Rack',
        paletteSwap: { T: '#6d6d84', t: '#4a4a5e' },
        overrides: {
          objectClass: 'DESTRUCTIBLE_HEAVY',
          health: 140,
          requiresBlast: true,
          lootTable: 'OLT-CABINET',
        },
      },
      {
        id: 'ENV010_TURRET_HOST',
        label: 'Turret-Host Server Rack',
        overrides: { spawnsOnRoomEnter: { role: 'STATIONARY_TURRET', count: 1 }, disableableBy: ['ENV-019'] },
      },
    ],
    readabilityNote:
      'A two-tile-tall louvred column of dark bays. Its status LEDs are baked into the bezel as a '
      + 'fixed vertical dotted column, so they read as machine texture; nothing ever detaches from '
      + 'the rack, so a lit bay cannot be mistaken for an incoming shot.',
  },

  // -- ENV-011 Cable Bundle -------------------------------------------------
  {
    id: 'ENV-011',
    schemaVersion: 1,
    nameLoc: 'object.cable_bundle.name',
    spriteId: 'obj_cable_bundle',
    objectClass: 'HAZARD',
    collision: {
      w: 2, h: 0.6,
      // Floor hazard: slows, never blocks (§13.2 "Hazard | May not block").
      blocksMovement: false,
      blocksProjectiles: false,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    requiresBlast: false,
    onDestroy: [],
    variants: [
      {
        id: 'ENV011_LOOSE',
        label: 'Loose Cable Bundle',
        overrides: { emitsHazard: 'HAZ-CABLE_TRIP_BUNDLE' },
      },
      {
        id: 'ENV011_POWERED',
        label: 'Live Cable Bundle',
        paletteSwap: { g: '#1f6f76', G: '#3fb0b8' },
        overrides: { emitsHazard: 'HAZ-CABLE_LIVE_RUN', poweredBy: 'ENV-019' },
      },
      {
        id: 'ENV011_NEST',
        label: 'Cable Nest',
        // §13.3: "Cable Snakes may disguise themselves among bundles." The
        // disguise is an encounter placement decision; the object stays inert.
        overrides: { mimicHost: true, mimicRole: 'CABLE_MIMIC' },
      },
    ],
    readabilityNote:
      'Flat floor decal of parallel strands with a hard dark outline, drawn entirely below the entity '
      + 'plane and never overlapping a body silhouette. Live variants use the shared teal electrical '
      + 'accent that every powered hazard uses, not any enemy palette.',
  },

  // -- ENV-012 Glass Partition ----------------------------------------------
  {
    id: 'ENV-012',
    schemaVersion: 1,
    nameLoc: 'object.glass_partition.name',
    spriteId: 'obj_glass_partition',
    objectClass: 'DESTRUCTIBLE_HEAVY',
    collision: {
      w: 3, h: 0.3,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      // It is glass: you can see and aim through it, you just cannot shoot past.
      blocksLineOfSight: false,
    },
    health: 30,
    requiresBlast: false,
    lootTable: 'OLT-GLASS',
    onDestroy: [
      { hook: 'SPAWN_GLASS_SHARDS', params: { hazardId: 'HAZ-GLASS_SHARD_FIELD', radius: 1.8, seconds: 7 } },
    ],
    variants: [
      {
        id: 'ENV012_CLEAR',
        label: 'Clear Glass Partition',
        overrides: { crackStates: 3 },
      },
      {
        id: 'ENV012_CRACKED',
        label: 'Cracked Glass Partition',
        overrides: { spriteId: 'obj_glass_partition_cracked', health: 10, crackStates: 1 },
      },
      {
        id: 'ENV012_FROSTED',
        label: 'Frosted Glass Partition',
        paletteSwap: { C: '#c8c8d6' },
        overrides: {
          collision: {
            w: 3, h: 0.3,
            blocksMovement: true,
            blocksProjectiles: true,
            blocksFlying: true,
            blocksLineOfSight: true,
          },
        },
      },
    ],
    readabilityNote:
      'A thin bright frame with a barely tinted interior and explicit crack states: intact, hairline, '
      + 'spidered. As a straight framed wall segment it belongs to the architecture vocabulary, and '
      + 'the crack overlay is grey line art rather than a hostile telegraph colour.',
  },

  // -- ENV-013 Archive Shelf ------------------------------------------------
  {
    id: 'ENV-013',
    schemaVersion: 1,
    nameLoc: 'object.archive_shelf.name',
    spriteId: 'obj_archive_shelf',
    objectClass: 'DESTRUCTIBLE_HEAVY',
    collision: {
      w: 2, h: 0.8,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: true,
    },
    health: 56,
    requiresBlast: false,
    lootTable: 'OLT-SHELF',
    onDestroy: [
      // §13.3: "May collapse in a cardinal direction ... changing navigation."
      // R-ENV-004 forbids sealing a required route, so the hook must refuse any
      // direction that would block a door or a required approach lane.
      {
        hook: 'COLLAPSE_DIRECTIONAL',
        params: { spanTiles: 2, respectsRequiredPaths: true, rubbleBlocksFlying: false },
      },
      { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 14, decorative: true } },
    ],
    variants: [
      {
        id: 'ENV013_ARCHIVE',
        label: 'Archive Shelf',
        overrides: {},
      },
      {
        id: 'ENV013_OVERLOADED',
        label: 'Overloaded Archive Shelf',
        overrides: {
          spriteId: 'obj_archive_shelf_overloaded',
          health: 40,
          onDestroy: [
            {
              hook: 'COLLAPSE_DIRECTIONAL',
              params: { spanTiles: 3, respectsRequiredPaths: true, crushDamage: 1, rubbleBlocksFlying: false },
            },
            { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 22, decorative: true } },
          ],
        },
      },
      {
        id: 'ENV013_BOLTED',
        label: 'Bolted Archive Shelf',
        overrides: {
          requiresBlast: true,
          health: 96,
          onDestroy: [{ hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 14, decorative: true } }],
        },
      },
    ],
    readabilityNote:
      'Tall two-tile bookcase of stacked horizontal box rows; it is the one common object that '
      + 'occludes line of sight, and it announces that by being the tallest flat mass in the room. '
      + 'The rows are even and static, giving no limb or head reading at combat scale.',
  },

  // -- ENV-014 Whiteboard ---------------------------------------------------
  {
    id: 'ENV-014',
    schemaVersion: 1,
    nameLoc: 'object.whiteboard.name',
    spriteId: 'obj_whiteboard',
    objectClass: 'DESTRUCTIBLE_LIGHT',
    collision: {
      w: 2, h: 0.3,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: true,
    },
    health: 12,
    requiresBlast: false,
    lootTable: 'OLT-WHITEBOARD',
    onDestroy: [
      { hook: 'RELEASE_MARKER_HAZARD', params: { hazardId: 'HAZ-MACHINE_TONER_CLOUD', radius: 1.1, seconds: 3 }, chance: 0.35 },
      // §13.3: "Never required for normal progression" — the clue is a bonus.
      { hook: 'REVEAL_WHITEBOARD_CLUE', params: { scope: 'FLOOR', neverGatesProgress: true }, chance: 0.25 },
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'MELAMINE', pieces: 4 } },
    ],
    variants: [
      {
        id: 'ENV014_CLUE',
        label: 'Annotated Whiteboard',
        overrides: {
          onDestroy: [
            { hook: 'REVEAL_WHITEBOARD_CLUE', params: { scope: 'FLOOR', neverGatesProgress: true } },
            { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'MELAMINE', pieces: 4 } },
          ],
        },
      },
      {
        id: 'ENV014_BLANK',
        label: 'Blank Whiteboard',
        overrides: { lootTable: 'OLT-BIN' },
      },
      {
        id: 'ENV014_MARKER_RACK',
        label: 'Marker-Laden Whiteboard',
        overrides: {
          onDestroy: [
            { hook: 'RELEASE_MARKER_HAZARD', params: { hazardId: 'HAZ-MACHINE_TONER_CLOUD', radius: 1.6, seconds: 5 } },
            { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'MELAMINE', pieces: 4 } },
          ],
        },
      },
    ],
    readabilityNote:
      'A bright white rectangle in a thin tray frame, standing flush inside its footprint. Whatever is '
      + 'drawn on it is rendered as low-contrast grey scribble at a stroke weight below the enemy '
      + 'outline weight, so the marks never resolve into a creature or a projectile.',
  },

  // -- ENV-015 Coffee Machine -----------------------------------------------
  {
    id: 'ENV-015',
    schemaVersion: 1,
    nameLoc: 'object.coffee_machine.name',
    spriteId: 'obj_coffee_machine',
    objectClass: 'INTERACTIVE',
    collision: {
      w: 0.8, h: 0.8,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 14,
    requiresBlast: false,
    lootTable: 'OLT-COFFEE_MACHINE',
    onDestroy: [
      { hook: 'SPILL_HOT_COFFEE', params: { hazardId: 'HAZ-SPILL_COFFEE_SCALD', radius: 1.2, seconds: 8 } },
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'CHROME_AND_PLASTIC', pieces: 5 } },
    ],
    onInteract: {
      hook: 'BREW_CAFFEINE_DOSE',
      cost: { credits: 3 },
      params: {
        grantsTag: 'COFFEE',
        maxUses: 2,
        overheatAfterUses: 2,
        outcomes: [
          { kind: 'CAFFEINE_HEALTH', weight: 58 },
          { kind: 'COFFEE_TAG_EFFECT', weight: 26 },
          { kind: 'OVERHEAT_SCALD', weight: 16 },
        ],
      },
    },
    variants: [
      {
        id: 'ENV015_STANDARD',
        label: 'Break Room Coffee Machine',
        overrides: {},
      },
      {
        id: 'ENV015_OVERHEATING',
        label: 'Overheating Coffee Machine',
        paletteSwap: { H: '#e04a54' },
        overrides: {
          emitsHazard: 'HAZ-MACHINE_STEAM_VENT',
          onInteract: { hook: 'BREW_CAFFEINE_DOSE', cost: { credits: 1, health: 1 } },
        },
      },
      {
        id: 'ENV015_CORRUPTED',
        label: 'Corrupted Coffee Machine',
        paletteSwap: { G: '#6a3a9a', h: '#c78af0' },
        // §13.3: corrupted variants can "produce an enemy".
        overrides: {
          onInteract: { hook: 'BREW_CAFFEINE_DOSE', cost: { credits: 3 }, params: { enemyChance: 0.3 } },
        },
      },
    ],
    readabilityNote:
      'Small chrome-and-dark box with a recessed cup bay and a carafe outline. Steam is drawn as a '
      + 'looping pale wisp above the chassis in the environment outline colour, never the hostile '
      + 'outline, so an idling machine cannot be misread as an enemy wind-up.',
  },

  // -- ENV-016 Fire Extinguisher --------------------------------------------
  {
    id: 'ENV-016',
    schemaVersion: 1,
    nameLoc: 'object.fire_extinguisher.name',
    spriteId: 'obj_fire_extinguisher',
    objectClass: 'REACTIVE',
    collision: {
      w: 0.4, h: 0.5,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 4,
    requiresBlast: false,
    onDestroy: [
      {
        hook: 'EXPLODE_FOAM_CONE',
        params: {
          hazardId: 'HAZ-FOAM_DISCHARGE_CLOUD',
          coneDegrees: 70,
          range: 3.5,
          push: 7,
          telegraphSeconds: 0.25,
        },
      },
      // §13.3: "Can extinguish fire and erase selected hazards."
      { hook: 'ERASE_HAZARDS_IN_RADIUS', params: { radius: 2.6, families: ['FIRE', 'SPILLS', 'PAPER'] } },
    ],
    // Foam shoving another canister may set it off; depth 2 stops the cascade one
    // object later (R-ENV-006).
    chainReaction: { propagates: ['FOAM', 'BLAST'], maxDepth: 2 },
    variants: [
      {
        id: 'ENV016_WALL',
        label: 'Wall-Mounted Fire Extinguisher',
        overrides: { anchorTo: 'WALL' },
      },
      {
        id: 'ENV016_FLOOR',
        label: 'Floor-Standing Fire Extinguisher',
        overrides: { anchorTo: 'FLOOR', pushable: true },
      },
      {
        id: 'ENV016_OVERPRESSURED',
        label: 'Overpressured Extinguisher',
        paletteSwap: { r: '#a06a10', R: '#e0be4a' },
        overrides: {
          onDestroy: [
            {
              hook: 'EXPLODE_FOAM_CONE',
              params: { hazardId: 'HAZ-FOAM_DISCHARGE_CLOUD', coneDegrees: 90, range: 5, push: 10, telegraphSeconds: 0.3 },
            },
            { hook: 'ERASE_HAZARDS_IN_RADIUS', params: { radius: 3.6, families: ['FIRE', 'SPILLS', 'PAPER', 'GLASS'] } },
          ],
        },
      },
    ],
    readabilityNote:
      'A small red canister with a black hose loop, under half a tile wide, always parked against a '
      + 'wall or fixture. It is the smallest object in the catalog and shares the flat red of the '
      + 'vending chassis, tying it to fixtures rather than hostiles; the foam cone it produces is '
      + 'white with the environment outline, not a hostile telegraph.',
  },

  // -- ENV-017 Supply Cart --------------------------------------------------
  {
    id: 'ENV-017',
    schemaVersion: 1,
    nameLoc: 'object.supply_cart.name',
    spriteId: 'obj_supply_cart',
    objectClass: 'MOVABLE',
    collision: {
      w: 1.2, h: 1,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 24,
    requiresBlast: false,
    lootTable: 'OLT-CART',
    onDestroy: [
      { hook: 'DROP_CART_CONTENTS', params: { rolls: 2 } },
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'WIRE_AND_CARDBOARD', pieces: 7 } },
    ],
    variants: [
      {
        id: 'ENV017_SUPPLY',
        label: 'Supply Cart',
        overrides: { mass: 3, pushSpeed: 3.2, crushDamage: 1, crushRequiresSpeed: 2.4 },
      },
      {
        id: 'ENV017_MAIL',
        label: 'Mail Cart',
        paletteSwap: { o: '#b06a2c', O: '#e09a4a' },
        overrides: { mass: 2, pushSpeed: 4, crushDamage: 1, lootTable: 'OLT-PAPER_PILE' },
      },
      {
        id: 'ENV017_HEAVY',
        label: 'Loaded Pallet Cart',
        overrides: { mass: 5, pushSpeed: 2.2, crushDamage: 2, health: 44, requiresBlast: true },
      },
    ],
    readabilityNote:
      'Wire cage on castors with a push bar, drawn as an open lattice so the floor shows through it. '
      + 'An open interior plus a horizontal bar is a shape no enemy uses, and it only ever slides '
      + 'along the push axis at constant roll speed, never on an intercept curve.',
  },

  // -- ENV-018 Locked Cabinet -----------------------------------------------
  {
    id: 'ENV-018',
    schemaVersion: 1,
    nameLoc: 'object.locked_cabinet.name',
    spriteId: 'obj_locked_cabinet',
    objectClass: 'INTERACTIVE',
    collision: {
      w: 1, h: 1,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: false,
    },
    health: 40,
    // §13.3: "Consumes an Access Card or blast depending on variant." The base
    // object shrugs off ordinary gunfire so the Access Card keeps its value.
    requiresBlast: true,
    lootTable: 'OLT-CABINET_LOCKED',
    onDestroy: [
      { hook: 'SPAWN_DEBRIS_BURST', params: { material: 'PAINTED_STEEL', pieces: 8 } },
    ],
    onInteract: {
      hook: 'UNLOCK_CABINET',
      cost: { accessCards: 1 },
      // The card is repaid by `guaranteedRewards` here; OLT-CABINET_LOCKED then
      // rolls a *bonus* on top. That is how a paid container stays worth paying
      // for while its outcome table still sits inside the §13.4 bands.
      params: { guaranteedRewards: [{ kind: 'CREDITS', count: [4, 7] }], bonusRolls: 1 },
    },
    variants: [
      {
        id: 'ENV018_CARD',
        label: 'Card-Locked Cabinet',
        overrides: {},
      },
      {
        id: 'ENV018_LEGAL_HOLD',
        label: 'Legal Hold Cabinet',
        paletteSwap: { G: '#6a3a9a', h: '#c78af0' },
        overrides: {
          health: 88,
          onInteract: {
            hook: 'UNLOCK_CABINET',
            cost: { accessCards: 2 },
            params: { guaranteedRewards: [{ kind: 'CREDITS', count: [8, 14] }], bonusRolls: 2 },
          },
        },
      },
      {
        id: 'ENV018_PRE_DAMAGED',
        label: 'Pre-Damaged Locked Cabinet',
        overrides: { requiresBlast: false, health: 24 },
      },
      {
        id: 'ENV018_EXECUTIVE_SAFE',
        label: 'Executive Safe',
        paletteSwap: { G: '#8a6a1a', h: '#e0be4a' },
        overrides: { health: 120, requiresBlast: true, lootTable: 'OLT-PREMIUM_TROPHY' },
      },
    ],
    readabilityNote:
      'Cabinet body with a heavy vertical hasp plate and a keyhole notch — the hasp is the readable '
      + 'difference from ENV-001 at combat scale. Locked state is shown by that plate, not by a '
      + 'coloured glow, so it reads as furniture with a lock rather than as an armed entity.',
  },

  // -- ENV-019 Power Strip --------------------------------------------------
  {
    id: 'ENV-019',
    schemaVersion: 1,
    nameLoc: 'object.power_strip.name',
    spriteId: 'obj_power_strip',
    objectClass: 'REACTIVE',
    collision: {
      w: 0.9, h: 0.4,
      blocksMovement: false,
      blocksProjectiles: false,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 4,
    requiresBlast: false,
    onDestroy: [
      { hook: 'CUT_POWER_LINK', params: { network: 'ROOM_ELECTRICAL' } },
      {
        hook: 'SPAWN_SHOCK_ARC',
        params: { hazardId: 'HAZ-ELEC_FLOOR_ARC', radius: 1.2, seconds: 2, telegraphSeconds: 0.3 },
        chance: 0.4,
      },
    ],
    onInteract: {
      // §13.3: "Can be turned off, destroyed, or overloaded." Free to toggle.
      hook: 'TOGGLE_POWER_STRIP',
      params: { togglesNetwork: 'ROOM_ELECTRICAL', overloadOnRepeat: 3 },
    },
    // §13.3: "Powered strips link electrical devices and water spills." Depth 3
    // is strip -> device -> one touching spill, and then it stops (R-ENV-006).
    chainReaction: { propagates: ['SHOCK', 'WATER'], maxDepth: 3 },
    variants: [
      {
        id: 'ENV019_POWERED',
        label: 'Live Power Strip',
        overrides: { powered: true },
      },
      {
        id: 'ENV019_SWITCHED_OFF',
        label: 'Switched-Off Power Strip',
        paletteSwap: { T: '#4a4a5e' },
        overrides: { powered: false, chainReaction: null },
      },
      {
        id: 'ENV019_OVERLOADED',
        label: 'Overloaded Power Strip',
        paletteSwap: { T: '#e04a54' },
        overrides: {
          powered: true,
          emitsHazard: 'HAZ-ELEC_FLOOR_ARC',
          onDestroy: [
            { hook: 'CUT_POWER_LINK', params: { network: 'ROOM_ELECTRICAL' } },
            {
              hook: 'SPAWN_SHOCK_ARC',
              params: { hazardId: 'HAZ-ELEC_FLOOR_ARC', radius: 2, seconds: 3, telegraphSeconds: 0.35 },
            },
          ],
        },
      },
    ],
    readabilityNote:
      'A flat floor bar with evenly spaced socket squares and one switch square, drawn below the '
      + 'entity plane. Its single lamp is a filled square inside the bar outline using the shared '
      + 'electrical teal every powered hazard uses, so the player reads "wiring", not "creature".',
  },

  // -- ENV-020 Trophy Case --------------------------------------------------
  {
    id: 'ENV-020',
    schemaVersion: 1,
    nameLoc: 'object.trophy_case.name',
    spriteId: 'obj_trophy_case',
    objectClass: 'DESTRUCTIBLE_HEAVY',
    collision: {
      w: 1.2, h: 0.6,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksFlying: true,
      blocksLineOfSight: false,
    },
    health: 24,
    requiresBlast: false,
    lootTable: 'OLT-PREMIUM_TROPHY',
    onDestroy: [
      { hook: 'SPAWN_GLASS_SHARDS', params: { hazardId: 'HAZ-GLASS_SHARD_FIELD', radius: 1.6, seconds: 8 } },
      {
        hook: 'TRIGGER_SECURITY_ALARM',
        params: { summonHook: 'SUMMON_SECURITY_RESPONSE', delaySeconds: 1.6, respectsSafePath: true },
        chance: 0.4,
      },
    ],
    variants: [
      {
        id: 'ENV020_TROPHY',
        label: 'Trophy Case',
        overrides: {},
      },
      {
        id: 'ENV020_ALARMED',
        label: 'Alarmed Trophy Case',
        paletteSwap: { A: '#e04a54' },
        overrides: {
          onDestroy: [
            { hook: 'SPAWN_GLASS_SHARDS', params: { hazardId: 'HAZ-GLASS_SHARD_FIELD', radius: 1.6, seconds: 8 } },
            {
              hook: 'TRIGGER_SECURITY_ALARM',
              params: { summonHook: 'SUMMON_SECURITY_RESPONSE', delaySeconds: 1.2, respectsSafePath: true },
            },
          ],
        },
      },
      {
        id: 'ENV020_AWARD_WALL',
        label: 'Award Wall Case',
        // The one pedestal-eligible object in the catalog (§13.4).
        overrides: { health: 40, requiresBlast: true, pedestalEligible: true },
      },
    ],
    readabilityNote:
      'Gold-framed glass box, half a tile deep, with two or three static award shapes on a shelf line '
      + 'inside. The awards are flat gold blocks fixed to the shelf and are never animated or ejected, '
      + 'so nothing inside the case can read as a projectile.',
  },

  // -- ENV-021 Coffee Stain -------------------------------------------------
  // R-ENV-002 lives or dies here: the decorative base and the mechanical variants
  // must be separable by eye, so they use different sprites, not a palette swap.
  {
    id: 'ENV-021',
    schemaVersion: 1,
    nameLoc: 'object.coffee_stain.name',
    spriteId: 'obj_coffee_stain',
    objectClass: 'DECORATION',
    collision: {
      w: 1, h: 0.8,
      blocksMovement: false,
      blocksProjectiles: false,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    requiresBlast: false,
    onDestroy: [],
    variants: [
      {
        id: 'ENV021_DECORATIVE',
        label: 'Dry Coffee Stain',
        overrides: { mechanical: false },
      },
      {
        id: 'ENV021_SLIPPERY',
        label: 'Wet Coffee Slick',
        overrides: {
          spriteId: 'obj_coffee_stain_slick',
          objectClass: 'HAZARD',
          mechanical: true,
          emitsHazard: 'HAZ-SPILL_WATER_SLICK',
        },
      },
      {
        id: 'ENV021_STICKY',
        label: 'Sticky Syrup Patch',
        overrides: {
          spriteId: 'obj_coffee_stain_sticky',
          objectClass: 'HAZARD',
          mechanical: true,
          emitsHazard: 'HAZ-PAPER_DRIFT_BANK',
        },
      },
    ],
    readabilityNote:
      'The decorative stain is an irregular soft blob with no border, at low contrast against the '
      + 'floor tile. Mechanical variants keep the footprint but gain a hard dashed hazard-family '
      + 'border plus an interior hatch, so a player identifies a slippery or sticky zone by outline '
      + 'and texture alone, without stepping in it (R-ENV-002). Neither version has volume, so '
      + 'neither can be confused with an entity.',
  },

  // -- ENV-022 Paper Pile ---------------------------------------------------
  {
    id: 'ENV-022',
    schemaVersion: 1,
    nameLoc: 'object.paper_pile.name',
    spriteId: 'obj_paper_pile',
    objectClass: 'DESTRUCTIBLE_LIGHT',
    collision: {
      w: 1, h: 1,
      // Soft obstacle: it slows rather than stops, but low shots bury in it.
      blocksMovement: false,
      blocksProjectiles: true,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    health: 4,
    requiresBlast: false,
    lootTable: 'OLT-PAPER_PILE',
    onDestroy: [
      { hook: 'SPAWN_PAPER_SCATTER', params: { sheets: 16, decorative: true } },
      {
        hook: 'IGNITE_PAPER_FIRE',
        params: { hazardId: 'HAZ-FIRE_PAPER_BLAZE', requiresFireSource: true, seconds: 6 },
        chance: 0.15,
      },
    ],
    variants: [
      {
        id: 'ENV022_PILE',
        label: 'Paper Pile',
        overrides: { slowMultiplier: 0.7 },
      },
      {
        id: 'ENV022_BANKERS_BOXES',
        label: "Stacked Banker's Boxes",
        paletteSwap: { w: '#d8c8a8', H: '#b8a888' },
        overrides: {
          collision: {
            w: 1, h: 1,
            blocksMovement: true,
            blocksProjectiles: true,
            blocksFlying: true,
            blocksLineOfSight: true,
          },
          health: 12,
        },
      },
      {
        id: 'ENV022_SHREDDED',
        label: 'Shredded Paper Drift',
        overrides: {
          collision: {
            w: 2, h: 1.4,
            blocksMovement: false,
            blocksProjectiles: false,
            blocksFlying: false,
            blocksLineOfSight: false,
          },
          slowMultiplier: 0.55,
          health: 3,
        },
      },
    ],
    readabilityNote:
      'A low fan of overlapping white sheets that never rises above ankle height and holds a fixed '
      + 'shape. As pure white paper on the floor plane with no outline glow it reads as floor clutter; '
      + 'the swarm that sometimes hides inside is a separate hostile silhouette that must visibly '
      + 'emerge from the pile before it can act.',
  },

  // -- ENV-023 Security Scanner ---------------------------------------------
  {
    id: 'ENV-023',
    schemaVersion: 1,
    nameLoc: 'object.security_scanner.name',
    spriteId: 'obj_security_scanner',
    objectClass: 'HAZARD',
    collision: {
      w: 1, h: 0.5,
      // Flush floor emitter plate: the swept line is the threat, the plate is not.
      blocksMovement: false,
      blocksProjectiles: false,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    requiresBlast: false,
    onDestroy: [],
    variants: [
      {
        id: 'ENV023_SWEEP',
        label: 'Sweeping Security Scanner',
        overrides: { emitsHazard: 'HAZ-SCANNER_SWEEP_LINE', disableableBy: ['ENV-019'] },
      },
      {
        id: 'ENV023_PULSE',
        label: 'Pulsing Badge Scanner',
        overrides: { emitsHazard: 'HAZ-SCANNER_MARK_PULSE', disableableBy: ['ENV-019'] },
      },
      {
        id: 'ENV023_LOCKDOWN',
        label: 'Lockdown Scanner',
        paletteSwap: { T: '#e04a54' },
        overrides: {
          emitsHazard: 'HAZ-SCANNER_SWEEP_LINE',
          onCross: { hook: 'SUMMON_SECURITY_RESPONSE', params: { locksDoorsSeconds: 8, respectsSafePath: true } },
        },
      },
    ],
    readabilityNote:
      'A flush metal plate with two bracket posts, drawn on the floor plane at floor contrast. The '
      + 'dangerous part is the emitted line, which is a separate hazard decal with its own warning '
      + 'ramp; the plate itself never moves or emits, so it cannot be mistaken for a turret.',
  },

  // -- ENV-024 Conveyor Lane ------------------------------------------------
  {
    id: 'ENV-024',
    schemaVersion: 1,
    nameLoc: 'object.conveyor_lane.name',
    spriteId: 'obj_conveyor_lane',
    objectClass: 'HAZARD',
    collision: {
      w: 4, h: 1,
      blocksMovement: false,
      blocksProjectiles: false,
      blocksFlying: false,
      blocksLineOfSight: false,
    },
    requiresBlast: false,
    onDestroy: [],
    variants: [
      {
        id: 'ENV024_STRAIGHT',
        label: 'Straight Conveyor Lane',
        overrides: { emitsHazard: 'HAZ-CONVEYOR_BELT_RUN', disableableBy: ['ENV-019'] },
      },
      {
        id: 'ENV024_REVERSING',
        label: 'Reversing Conveyor Lane',
        overrides: { emitsHazard: 'HAZ-CONVEYOR_REVERSING_BELT', disableableBy: ['ENV-019'] },
      },
      {
        id: 'ENV024_PINCH',
        label: 'Pinch-Roller Conveyor',
        paletteSwap: { g: '#8a2a2a' },
        overrides: { emitsHazard: 'HAZ-CONVEYOR_PINCH_ROLLER', disableableBy: ['ENV-019'] },
      },
    ],
    readabilityNote:
      'A recessed floor lane with chevron slats that point the travel direction, plus a stop-band '
      + 'pattern when idle, so direction and active state are legible at a glance. It is inset into '
      + 'the floor with no volume, and the chevrons scroll at belt speed instead of tracking the '
      + 'player.',
  },
];

export default envObjects;
