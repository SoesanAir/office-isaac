/**
 * DPT-001..013. Appendix A.
 *
 * Content kind: department. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * GDD refs: 10.2 (two-floor chapter rule), 10.4 (department design contract),
 *           10.5 (department roadmap), Appendix A (department database),
 *           R-DPT-001 (two-floor pairs), R-DPT-003 (HR is not a base chapter,
 *           so HR pressure ships as a shared roving encounter pool rather than
 *           a chapter), R-DPT-004 (hidden departments absent from undiscovered
 *           maps), R-DPT-005 (grayscale readability), R-DPT-006 (insertable
 *           without touching the generator).
 *
 * ---------------------------------------------------------------------------
 * Palette slot convention
 * ---------------------------------------------------------------------------
 * `presentation.palette` extends `PALETTE` in src/render/sprites.js with the
 * department's *material* tones. Every department fills the same ten slots, so
 * a shared room template can reference `f`/`l`/`u` and still come out wearing
 * the correct department. Those ten characters were chosen because none of them
 * are claimed by the core palette — the structural characters (`k` outline,
 * `K` shadow, `w` paper, `h`/`H` grey) are deliberately NOT overridden, which
 * is what keeps outlines consistent across the whole game.
 *
 *   f  floor base            F  floor pattern / grid line
 *   l  wall lower / wainscot L  wall upper / cap
 *   u  primary material      U  primary material highlight
 *   i  department accent     I  accent highlight
 *   D  department deep shade P  secondary prop material
 *
 * R-DPT-005: colour is never the identity signal. Each `visualIdentity` states
 * the grayscale signal explicitly — silhouette height, footprint rhythm, and
 * surface texture — because the art review is run on desaturated captures.
 *
 * `itemAffinities` keys are item tags from TAGS.item and are multipliers where
 * 1.0 is neutral (GDD 10.4, "Item affinity").
 */

const departments = [
  // -- DPT-001 Open Office (core chapter 1) ----------------------------------
  {
    id: 'DPT-001',
    schemaVersion: 1,
    nameLoc: 'department.open_office.name',
    tag: 'OPEN_OFFICE',
    routeRole: 'Core chapter 1',
    floors: ['FLOOR-OPEN_OFFICE_1', 'FLOOR-OPEN_OFFICE_2'],
    roomTemplatePools: ['TPL_OPEN_OFFICE_CORE', 'TPL_OPEN_OFFICE_SPECIAL', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-OPEN_OFFICE_1', 'BOSSPOOL-OPEN_OFFICE_2'],
    objectSets: [
      'ENV-001', 'ENV-002', 'ENV-003', 'ENV-004', 'ENV-006',
      'ENV-007', 'ENV-008', 'ENV-009', 'ENV-021', 'ENV-022',
    ],
    hazardSets: ['SPILLS', 'PAPER', 'CABLES'],
    itemAffinities: {
      COFFEE: 1.5, PAPER: 1.3, STATIONERY: 1.25, MANAGEMENT: 0.9,
      TECHNOLOGY: 0.8, ACCESS: 1.0, ECONOMY: 1.0, FORBIDDEN: 0.5,
    },
    presentation: {
      palette: {
        f: '#7a7f8c', // grey-blue loop-pile carpet tile
        F: '#8d93a1', // the seam between tiles, one step lighter
        l: '#c4c2ba', // painted drywall, warm off-white
        L: '#dedcd4', // ceiling-adjacent wall cap
        u: '#9aa2ae', // cubicle fabric, coarse weave
        U: '#b6bcc6',
        i: '#3f6bb8', // corporate blue trim on dividers and binders
        I: '#7fa4e4',
        D: '#4a4d57',
        P: '#b9a583', // beech laminate desk tops
      },
      floorPattern: 'carpet_tile_grid_500mm',
      wallPattern: 'painted_drywall_with_vinyl_wainscot',
      lighting: { tint: '#eef2ff', strength: 0.10, vignette: 0.08 },
      music: 'MUS-OPEN_OFFICE',
      ambience: 'SFX-AMB_OPEN_OFFICE',
      transitionSting: 'SFX-STING_OPEN_OFFICE',
    },
    narrativeImplication:
      'Nothing here is personalised and nothing here is owned: identical desks, unnamed pigeonholes, and a rail of unclaimed coats say the company treats staff as interchangeable seat-fillers long before any boss says it out loud.',
    gameplayIdentity:
      'Primary mechanic is cubicle cover: waist-high dividers cut firing lanes so the player learns to shoot around geometry. Secondary mechanics are cardinal-facing shooters plus simple HR debuff applicators that punish standing still.',
    visualIdentity:
      'Grayscale signal is uniformity of height: every obstacle stops at the same waist line, so the room reads as one flat horizon of identical boxes on a strict repeating grid. Surface is matte, low-contrast, fibrous loop pile with visible tile seams and no specular highlight anywhere.',
    hidden: false,
    originalityNote:
      'Built from real open-plan office ergonomics — 500mm carpet tiles, systems furniture, shared pigeonholes — as a readability tutorial about cover height. It borrows no layout, creature, or naming language from any existing roguelike; the "first area" identity comes from office standardisation, not from a basement or dungeon vocabulary.',
  },

  // -- DPT-002 IT (core chapter 2) -------------------------------------------
  {
    id: 'DPT-002',
    schemaVersion: 1,
    nameLoc: 'department.it.name',
    tag: 'IT',
    routeRole: 'Core chapter 2',
    floors: ['FLOOR-IT_1', 'FLOOR-IT_2'],
    roomTemplatePools: ['TPL_IT_CORE', 'TPL_IT_SPECIAL', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-IT_1', 'BOSSPOOL-IT_2'],
    objectSets: [
      'ENV-001', 'ENV-008', 'ENV-009', 'ENV-010', 'ENV-011',
      'ENV-012', 'ENV-016', 'ENV-019', 'ENV-023',
    ],
    hazardSets: ['ELECTRICITY', 'CABLES', 'MACHINE_STATES', 'DARKNESS'],
    itemAffinities: {
      TECHNOLOGY: 1.6, MODIFIER: 1.3, ACCESS: 1.2, INFORMATION: 1.15,
      COFFEE: 1.0, PAPER: 0.7, SUSTAIN: 0.85, ECONOMY: 0.9,
    },
    presentation: {
      palette: {
        f: '#3c4148', // raised anti-static floor panel, perforated
        F: '#4d545c', // panel edge trim and lifting slots
        l: '#2f343a', // acoustic foam wall lining
        L: '#464d55',
        u: '#5a626b', // powder-coated rack steel
        U: '#7d858f',
        i: '#2fa8b0', // status-light teal on every powered surface
        I: '#79e2e8',
        D: '#1b1f24',
        P: '#26292e', // cable tray and conduit
      },
      floorPattern: 'raised_access_floor_perforated_panels',
      wallPattern: 'acoustic_foam_with_exposed_cable_tray',
      lighting: { tint: '#8fd8e0', strength: 0.30, vignette: 0.34 },
      music: 'MUS-IT',
      ambience: 'SFX-AMB_IT',
      transitionSting: 'SFX-STING_IT',
    },
    narrativeImplication:
      'The machines get the climate control, the redundancy, and the locked cages that the people two floors down do not, and half the racks are still running systems nobody employed here can name.',
    gameplayIdentity:
      'Primary mechanic is powered state: racks, strips, and cable runs are either live or dead, and shooting the wrong one electrifies the lane you were about to use. Secondary mechanics are stationary turret coverage and a teleporting harasser that punishes camping one aisle.',
    visualIdentity:
      'Grayscale signal is verticality and rhythm: tall full-height slabs standing in long parallel aisles, so the silhouette is a barcode of narrow gaps rather than the flat horizon of chapter one. Surfaces are hard, perforated, and specular — punched metal and gloss panels — which reads as sharp speckle in desaturated captures.',
    hidden: false,
    originalityNote:
      'Original content derived from real data-centre practice: hot/cold aisle containment, raised access flooring, and under-floor cable runs become cover, hazard, and navigation. The "electric second area" idea is expressed through office power infrastructure the player can actually switch off, not through a generic elemental theme lifted from another game.',
  },

  // -- DPT-003 Operations (core chapter 3) -----------------------------------
  {
    id: 'DPT-003',
    schemaVersion: 1,
    nameLoc: 'department.operations.name',
    tag: 'OPERATIONS',
    routeRole: 'Core chapter 3',
    floors: ['FLOOR-OPERATIONS_1', 'FLOOR-OPERATIONS_2'],
    roomTemplatePools: ['TPL_OPERATIONS_CORE', 'TPL_OPERATIONS_SPECIAL', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-OPERATIONS_1', 'BOSSPOOL-OPERATIONS_2'],
    objectSets: [
      'ENV-001', 'ENV-004', 'ENV-009', 'ENV-013', 'ENV-016',
      'ENV-017', 'ENV-018', 'ENV-022', 'ENV-024',
    ],
    hazardSets: ['CONVEYORS', 'PRESSURE', 'MACHINE_STATES', 'SPILLS'],
    itemAffinities: {
      ECONOMY: 1.3, DEFENSE: 1.2, STAT: 1.15, MANAGEMENT: 1.1,
      PAPER: 1.05, TECHNOLOGY: 0.95, COFFEE: 0.9, FAMILIAR: 1.1,
    },
    presentation: {
      palette: {
        f: '#6b6559', // sealed concrete with painted lane markings
        F: '#d8b342', // hazard-yellow floor lane paint
        l: '#7d7466', // breeze-block and mesh cage wall
        L: '#95897a',
        u: '#8a6a44', // corrugated cardboard and pallet timber
        U: '#a98a60',
        i: '#c8641e', // safety orange on every moving mechanism
        I: '#f0a05a',
        D: '#3f3a33',
        P: '#5f6a6e', // galvanised roller and cage steel
      },
      floorPattern: 'sealed_concrete_with_painted_traffic_lanes',
      wallPattern: 'breeze_block_and_wire_cage_partition',
      lighting: { tint: '#ffe9c2', strength: 0.18, vignette: 0.22 },
      music: 'MUS-OPERATIONS',
      ambience: 'SFX-AMB_OPERATIONS',
      transitionSting: 'SFX-STING_OPERATIONS',
    },
    narrativeImplication:
      'This is where the tower physically moves things, and the shift boards show the same handful of names covering every rota — the floor above it does not appear to know this floor exists.',
    gameplayIdentity:
      'Primary mechanic is imposed movement: conveyor lanes and pushable carts constantly relocate the player, enemies, and objects, so position becomes something you fight for rather than pick. Secondary mechanics are chargers that commit down cleared lanes and splitting units that flood the gaps.',
    visualIdentity:
      'Grayscale signal is directional geometry: long unbroken lane bands with chevron tread and diagonal hatching all pointing the same way, so travel direction is legible with zero colour. Silhouettes mix very low flat lanes against very tall stacked cages, giving the most extreme height contrast of any base chapter, on gritty aggregate and ribbed rubber textures.',
    hidden: false,
    originalityNote:
      'Original take on a logistics floor: warehouse traffic-management practice (marked lanes, cage stock, roller decks, shift boards) is turned into a movement-authorship mechanic. The conveyor is authored as a navigation negotiation with visible direction and state rather than as an imported instant-death belt trope.',
  },

  // -- DPT-004 Executive (core chapter 4) ------------------------------------
  {
    id: 'DPT-004',
    schemaVersion: 1,
    nameLoc: 'department.executive.name',
    tag: 'EXECUTIVE',
    routeRole: 'Core chapter 4',
    floors: ['FLOOR-EXECUTIVE_1', 'FLOOR-EXECUTIVE_2'],
    roomTemplatePools: ['TPL_EXECUTIVE_CORE', 'TPL_EXECUTIVE_SPECIAL', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-EXECUTIVE_1', 'BOSSPOOL-EXECUTIVE_2'],
    objectSets: [
      'ENV-006', 'ENV-008', 'ENV-012', 'ENV-013', 'ENV-015',
      'ENV-018', 'ENV-020', 'ENV-023',
    ],
    hazardSets: ['GLASS', 'SCANNERS', 'PRESSURE', 'FIRE'],
    itemAffinities: {
      MANAGEMENT: 1.6, ACCESS: 1.35, DEFENSE: 1.2, ECONOMY: 1.15,
      LIABILITY: 1.1, COFFEE: 1.0, PAPER: 0.85, TECHNOLOGY: 0.9,
    },
    presentation: {
      palette: {
        f: '#4a413c', // deep pile broadloom, no seams
        F: '#5a4f48', // subtle tonal border inlay
        l: '#6f5f4e', // walnut veneer panelling
        L: '#8a7860',
        u: '#2b2b31', // smoked structural glass frame
        U: '#575765',
        i: '#c8a233', // brushed brass fittings and door furniture
        I: '#f2dc8e',
        D: '#241f1c',
        P: '#a89a86', // stone reception surfaces
      },
      floorPattern: 'seamless_deep_pile_broadloom_with_stone_thresholds',
      wallPattern: 'walnut_veneer_panels_and_full_height_glazing',
      lighting: { tint: '#ffe6b4', strength: 0.22, vignette: 0.30 },
      music: 'MUS-EXECUTIVE',
      ambience: 'SFX-AMB_EXECUTIVE',
      transitionSting: 'SFX-STING_EXECUTIVE',
    },
    narrativeImplication:
      'Space itself is the salary up here: the rooms are enormous and nearly empty, every threshold is a checkpoint, and the artwork on the walls costs more than the floors below it earn in a year.',
    gameplayIdentity:
      'Primary mechanic is access control: scanner lines and gated thresholds decide which part of a room the player is allowed to occupy, so the fight is about earning space. Secondary mechanics are elite support networks that shield each other and cloned assistants that must be broken by positioning rather than raw damage.',
    visualIdentity:
      'Grayscale signal is emptiness and long unbroken lines: very few, very large objects on wide clean floor, with full-height glass giving razor-thin vertical frames and huge open spans instead of clutter. Materials are polished and reflective against seamless matte carpet, so desaturated captures read as high-gloss slabs floating in negative space.',
    hidden: false,
    originalityNote:
      'Original executive-floor content built from corporate real-estate signalling: floor area per head, controlled thresholds, and curated art as a status display become a spatial-denial mechanic. The final visible chapter is authored as an architecture of permission, not as a borrowed throne-room or citadel motif.',
  },

  // -- DPT-005 Finance (unlockable alternate chapter 3) ----------------------
  {
    id: 'DPT-005',
    schemaVersion: 1,
    nameLoc: 'department.finance.name',
    tag: 'FINANCE',
    routeRole: 'Unlockable alternate chapter 3',
    floors: ['FLOOR-FINANCE_1', 'FLOOR-FINANCE_2'],
    roomTemplatePools: ['TPL_FINANCE_CORE', 'TPL_FINANCE_SPECIAL', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-FINANCE_1', 'BOSSPOOL-FINANCE_2'],
    objectSets: [
      'ENV-001', 'ENV-012', 'ENV-013', 'ENV-018', 'ENV-020',
      'ENV-022', 'ENV-023',
    ],
    hazardSets: ['SCANNERS', 'PAPER', 'PRESSURE', 'GLASS'],
    itemAffinities: {
      ECONOMY: 1.8, REROLL: 1.3, LIABILITY: 1.25, TRADEOFF: 1.2,
      ACCESS: 1.1, SUSTAIN: 0.8, COFFEE: 0.85, FAMILIAR: 0.9,
    },
    presentation: {
      palette: {
        f: '#5e5a52', // dark linoleum, polished by counter traffic
        F: '#6d685e',
        l: '#8f8878', // wall of bound ledger spines, floor to ceiling
        L: '#a39b89',
        u: '#4c4a46', // grey filing steel and vault mesh
        U: '#6f6d67',
        i: '#2e7a52', // ledger-green ruling and till accents
        I: '#63bd8b',
        D: '#2c2a26',
        P: '#c9c2ac', // receipt paper and thermal roll
      },
      floorPattern: 'polished_linoleum_with_worn_counter_tracks',
      wallPattern: 'floor_to_ceiling_ledger_spines_and_vault_mesh',
      lighting: { tint: '#e4f0d8', strength: 0.16, vignette: 0.26 },
      music: 'MUS-FINANCE',
      ambience: 'SFX-AMB_FINANCE',
      transitionSting: 'SFX-STING_FINANCE',
    },
    narrativeImplication:
      'Every action taken anywhere in the tower has already been priced, filed, and depreciated here, and the ledgers are still running for cost centres whose departments no longer exist.',
    gameplayIdentity:
      'Primary mechanic is resource attrition: enemies steal credits, spend them on their own armour, and interest timers make hesitation expensive, so the player must trade economy against safety. Secondary mechanics are greed-risk rooms that pay more the longer you stay and audit marks that tax one specific behaviour.',
    visualIdentity:
      'Grayscale signal is dense horizontal stratification: everything is a stack of thin identical layers — ledger spines, receipt rolls, coin trays — so surfaces read as fine repeating stripes at every scale. Silhouettes are narrow, tall, and columnar with hard right angles and no curves at all, which separates it instantly from the low grid of Open Office and the lane bands of Operations.',
    hidden: false,
    originalityNote:
      'Original alternate chapter built from accounting practice — cost centres, depreciation, audit trails, interest accrual — turned into an economy-pressure mechanic where the enemy buys upgrades with money taken from the player. No vault, coin, or greed content is modelled on another game; the pressure comes from bookkeeping, not from treasure hoards.',
  },

  // -- DPT-006 Marketing (unlockable alternate chapter 3) --------------------
  {
    id: 'DPT-006',
    schemaVersion: 1,
    nameLoc: 'department.marketing.name',
    tag: 'MARKETING',
    routeRole: 'Unlockable alternate chapter 3',
    floors: ['FLOOR-MARKETING_1', 'FLOOR-MARKETING_2'],
    roomTemplatePools: ['TPL_MARKETING_CORE', 'TPL_MARKETING_SPECIAL', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-MARKETING_1', 'BOSSPOOL-MARKETING_2'],
    objectSets: [
      'ENV-004', 'ENV-006', 'ENV-009', 'ENV-012', 'ENV-014',
      'ENV-016', 'ENV-022',
    ],
    hazardSets: ['FIRE', 'GLASS', 'DARKNESS', 'FOAM'],
    itemAffinities: {
      INFORMATION: 1.4, MODIFIER: 1.25, TRADEOFF: 1.2, FAMILIAR: 1.2,
      STATIONERY: 1.1, DEFENSE: 0.85, ECONOMY: 1.0, PAPER: 1.1,
    },
    presentation: {
      palette: {
        f: '#2a2a2e', // matte black studio floor
        F: '#d9d4c4', // gaffer-tape floor marks and set outlines
        l: '#3a3a40', // blackout drape over pinboard wall
        L: '#55555e',
        u: '#cfc4a8', // foam-core board and mount card
        U: '#eee6cf',
        i: '#c8358e', // brand magenta, used only on printed surfaces
        I: '#f78fc8',
        D: '#15151a',
        P: '#8e8ea0', // lighting rig and stand aluminium
      },
      floorPattern: 'matte_studio_floor_with_gaffer_tape_marks',
      wallPattern: 'blackout_drape_over_campaign_pinboard',
      lighting: { tint: '#fff4e0', strength: 0.34, vignette: 0.40 },
      music: 'MUS-MARKETING',
      ambience: 'SFX-AMB_MARKETING',
      transitionSting: 'SFX-STING_MARKETING',
    },
    narrativeImplication:
      'The company keeps entire rooms built as convincing three-quarter facades of products that were never manufactured, and the campaign walls are dated years ahead of the calendar.',
    gameplayIdentity:
      'Primary mechanic is attention manipulation: hard practical lighting and staged sets direct the eye, and decoys, false pickups, and mirrored enemies exploit where the player is already looking. Every deception carries a physical tell — a stand leg, a tape mark, an unpainted back face — so trickery stays fair and telegraphed. Secondary mechanics are temporary clones and short-lived spotlight zones that reward looking away.',
    visualIdentity:
      'Grayscale signal is the contrast between finished front faces and unfinished backs: props are built at three-quarter depth, so any fake reads by its exposed bracing and its cast-shadow direction with no colour needed. Silhouettes are thin flat panels on visible tripod legs inside pooled hard light and deep black falloff, unlike every other department where cover is solid.',
    hidden: false,
    originalityNote:
      'Original alternate chapter built from photo-studio and set-dressing craft: gaffer marks, foam-core mock-ups, three-quarter builds, and practical lighting become the fairness contract for a deception mechanic. Illusions are grounded in physical stagecraft the player can inspect, rather than reusing any existing game mirror-or-doppelganger device.',
  },

  // -- DPT-007 Legal and Compliance (unlockable alternate chapter 4) ---------
  {
    id: 'DPT-007',
    schemaVersion: 1,
    nameLoc: 'department.legal.name',
    tag: 'LEGAL',
    routeRole: 'Unlockable alternate chapter 4',
    floors: ['FLOOR-LEGAL_1', 'FLOOR-LEGAL_2'],
    roomTemplatePools: ['TPL_LEGAL_CORE', 'TPL_LEGAL_SPECIAL', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-LEGAL_1', 'BOSSPOOL-LEGAL_2'],
    objectSets: [
      'ENV-001', 'ENV-012', 'ENV-013', 'ENV-014', 'ENV-018',
      'ENV-022', 'ENV-023',
    ],
    hazardSets: ['RED_TAPE', 'PAPER', 'SCANNERS', 'PRESSURE'],
    itemAffinities: {
      PAPER: 1.6, DEFENSE: 1.3, INFORMATION: 1.2, LIABILITY: 1.2,
      ACCESS: 1.15, MANAGEMENT: 1.1, COFFEE: 0.8, REROLL: 0.85,
    },
    presentation: {
      palette: {
        f: '#6a6255', // cork tile, sound-deadened, slightly springy
        F: '#786f60',
        l: '#7f7462', // oak archive casework with seal doors
        L: '#968a76',
        u: '#b5aa93', // banker boxes and document stacks
        U: '#d3c9b2',
        i: '#a83a30', // sealing-wax red, used only on binding tape
        I: '#e0776a',
        D: '#332e27',
        P: '#5d5648', // wrought archive cage bars
      },
      floorPattern: 'cork_tile_with_numbered_archive_bay_markings',
      wallPattern: 'oak_casework_with_seal_doors_and_cage_bays',
      lighting: { tint: '#f0e2c8', strength: 0.14, vignette: 0.28 },
      music: 'MUS-LEGAL',
      ambience: 'SFX-AMB_LEGAL',
      transitionSting: 'SFX-STING_LEGAL',
    },
    narrativeImplication:
      'Someone has been documenting everything the tower does for far longer than the tower has plausibly existed, and the settled cases outnumber the employees by an order of magnitude.',
    gameplayIdentity:
      'Primary mechanic is binding: red-tape zones and seal doors restrict which actions the player may take, not just where they may stand, so options are removed rather than space. Secondary mechanics are delayed penalties that resolve several rooms later and contract projectiles that attach a rule to whatever they hit.',
    visualIdentity:
      'Grayscale signal is the flat unbroken vertical wall: bay after bay of identical boxed document faces with numbered bands and almost no depth, so a room reads as a papered corridor with recessed cage bays. Materials are soft, dusty, and fibrous with taut tape spans stretched across openings, so desaturated captures show hard straight lines cutting a matte field.',
    hidden: false,
    originalityNote:
      'Original alternate chapter built from records management and compliance work: retention schedules, sealed exhibit bays, and binding orders become an action-restriction mechanic where the hazard limits verbs. The department reads as a corporate archive under active litigation, an identity taken from paperwork practice rather than from any existing game area.',
  },

  // -- DPT-008 Facilities (secret branch) ------------------------------------
  // hidden: true. Facilities is a secret branch, so R-DPT-004 applies to it for
  // the same reason it applies to DPT-010..013 — an undiscovered map must not
  // hint that it exists.
  {
    id: 'DPT-008',
    schemaVersion: 1,
    nameLoc: 'department.facilities.name',
    tag: 'FACILITIES',
    routeRole: 'Secret branch',
    floors: ['FLOOR-FACILITIES_1'],
    roomTemplatePools: ['TPL_FACILITIES_CORE', 'TPL_FACILITIES_SERVICE', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-FACILITIES'],
    objectSets: [
      'ENV-004', 'ENV-010', 'ENV-011', 'ENV-016', 'ENV-017',
      'ENV-019', 'ENV-022', 'ENV-024',
    ],
    hazardSets: ['PRESSURE', 'DARKNESS', 'SPILLS', 'FIRE', 'ELECTRICITY', 'FOAM'],
    itemAffinities: {
      ACCESS: 1.5, SUSTAIN: 1.2, DEFENSE: 1.15, TECHNOLOGY: 1.1,
      ECONOMY: 1.0, MANAGEMENT: 0.6, COFFEE: 1.1, FORBIDDEN: 1.2,
    },
    presentation: {
      palette: {
        f: '#4f4a44', // bare screed with painted service-route stripes
        F: '#8d8577',
        l: '#585049', // unfinished blockwork and lagged pipework
        L: '#6b625a',
        u: '#3f4a4d', // cast-iron plant and boiler shells
        U: '#637174',
        i: '#c6a52c', // caution-yellow lagging bands and valve tags
        I: '#eed878',
        D: '#191713',
        P: '#7c6a52', // janitorial timber and stained board
      },
      floorPattern: 'bare_screed_with_painted_service_route_stripes',
      wallPattern: 'unfinished_blockwork_with_lagged_pipe_runs',
      lighting: { tint: '#ffd08a', strength: 0.26, vignette: 0.56 },
      music: 'MUS-FACILITIES',
      ambience: 'SFX-AMB_FACILITIES',
      transitionSting: 'SFX-STING_FACILITIES',
    },
    narrativeImplication:
      'The service spaces run behind and between every department and connect floors the directory does not list, which is the first hard evidence that the building is larger inside than the tower can hold.',
    gameplayIdentity:
      'Primary mechanic is infrastructure manipulation: the player breaks, moves, and re-routes the environment itself — valves, strips, carts, lagging — to change what a room does before fighting in it. Secondary mechanics are worked darkness where the light source is a destructible object, and hazards that chain along real service runs.',
    visualIdentity:
      'Grayscale signal is exposed structure and low headroom: pipe runs, brackets, and ducts crowd the top of frame so every corridor reads as pinched from above, and nothing is finished or aligned to the office grid. Textures are rough, wet, and streaked with mineral staining, giving mottled irregular value noise instead of the clean repeats used everywhere else in the tower.',
    hidden: true,
    originalityNote:
      'Original secret branch built from building-services reality: risers, plant rooms, lagging, and janitorial storage become a route-alteration toolkit that bypasses normal floors. It is the tower behind the tower expressed through maintenance practice, borrowing no sewer, mine, or catacomb vocabulary from other games.',
  },

  // -- DPT-009 Research and Development (secret branch) ----------------------
  {
    id: 'DPT-009',
    schemaVersion: 1,
    nameLoc: 'department.rnd.name',
    tag: 'RND',
    routeRole: 'Secret branch',
    floors: ['FLOOR-RND_1'],
    roomTemplatePools: ['TPL_RND_CORE', 'TPL_RND_TEST_CHAMBER', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-RND'],
    objectSets: [
      'ENV-009', 'ENV-010', 'ENV-012', 'ENV-014', 'ENV-016',
      'ENV-019', 'ENV-022', 'ENV-023',
    ],
    hazardSets: ['MACHINE_STATES', 'ELECTRICITY', 'FOAM', 'PRESSURE', 'FIRE'],
    itemAffinities: {
      TECHNOLOGY: 1.7, MODIFIER: 1.6, TRADEOFF: 1.4, FORBIDDEN: 1.3,
      INFORMATION: 1.2, STAT: 0.8, ECONOMY: 0.8, MANAGEMENT: 0.7,
    },
    presentation: {
      palette: {
        f: '#a9a6a0', // poured resin, coved at every edge
        F: '#bcb9b3',
        l: '#c6c9cc', // white wipe-clean panel with gasket seams
        L: '#e2e5e8',
        u: '#8d9296', // stainless bench and test-rig frame
        U: '#b9bec2',
        i: '#7a3fd0', // prototype indigo on every unreleased device
        I: '#bb95f2',
        D: '#4c4e52',
        P: '#e8e2cc', // whiteboard and marker-scarred laminate
      },
      floorPattern: 'poured_resin_coved_seamless_with_test_grid_decals',
      wallPattern: 'gasketed_wipe_clean_panels_and_observation_glazing',
      lighting: { tint: '#e8ecff', strength: 0.20, vignette: 0.18 },
      music: 'MUS-RND',
      ambience: 'SFX-AMB_RND',
      transitionSting: 'SFX-STING_RND',
    },
    narrativeImplication:
      'The prototypes solve office problems nobody has, the whiteboards are covered in confident nonsense, and several devices on the benches are dated as having already shipped.',
    gameplayIdentity:
      'Primary mechanic is rule mutation: a test chamber declares one altered room rule on entry and holds it for the duration, so the player re-learns the space in every room. Secondary mechanics are unstable modifiers with a visible failure state and experimental weapon pedestals that pay high variance.',
    visualIdentity:
      'Grayscale signal is clinical seamlessness broken by wrongness: coved floor-to-wall junctions with no visible joins, then a single object of impossible proportion per room. Every surface is uniformly bright and low-texture, so desaturated captures are near-flat white with hard black rig outlines — the highest-key department in the game and unmistakable against IT and Facilities.',
    hidden: true,
    originalityNote:
      'Original secret branch built from corporate innovation theatre: test chambers, coved cleanroom detailing, observation glazing, and confident whiteboard nonsense host a room-rule mutation mechanic. The prototypes are exaggerated office products, not weapons or artefacts referencing another game, and the wing reads as internal product development rather than a science-facility trope.',
  },

  // -- DPT-010 The Board (hidden post-CEO chapter) ---------------------------
  {
    id: 'DPT-010',
    schemaVersion: 1,
    nameLoc: 'department.board.name',
    tag: 'BOARD',
    routeRole: 'Hidden post-CEO chapter',
    floors: ['FLOOR-BOARD_1', 'FLOOR-BOARD_2'],
    roomTemplatePools: ['TPL_BOARD_CORE', 'TPL_BOARD_CHAMBER', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-BOARD_1', 'BOSSPOOL-BOARD_2'],
    objectSets: [
      'ENV-006', 'ENV-008', 'ENV-012', 'ENV-013', 'ENV-020', 'ENV-023',
    ],
    hazardSets: ['VOTE', 'DARKNESS', 'PRESSURE', 'GLASS'],
    itemAffinities: {
      MANAGEMENT: 1.7, DEFENSE: 1.35, ACCESS: 1.2, REVIVAL: 1.2,
      LIABILITY: 1.15, SUSTAIN: 1.1, ECONOMY: 0.8, STATIONERY: 0.7,
    },
    presentation: {
      palette: {
        f: '#3a3630', // near-black inlaid parquet, radial to the table
        F: '#4a453d',
        l: '#2b2823', // dark stained panelling that never meets a corner
        L: '#3d3830',
        u: '#463f36', // one continuous table mass
        U: '#635a4d',
        i: '#b89a48', // aged gilt on chair backs and vote plates
        I: '#e8cd82',
        D: '#0f0e0c',
        P: '#6d6558', // cracked upholstery leather
      },
      floorPattern: 'radial_inlaid_parquet_centred_on_the_table',
      wallPattern: 'stained_panelling_receding_past_the_building_footprint',
      lighting: { tint: '#ffd9a0', strength: 0.28, vignette: 0.68 },
      music: 'MUS-BOARD',
      ambience: 'SFX-AMB_BOARD',
      transitionSting: 'SFX-STING_BOARD',
    },
    narrativeImplication:
      'Beating the CEO changed nothing, because the chamber that instructs the CEO is longer than the building is wide and there are more seats at the table than the company has staff.',
    gameplayIdentity:
      'Primary mechanic is the vote: seated elites raise motions the player must physically deny or accept by destroying or defending specific positions, and a passed motion rewrites the arena rule for the rest of the fight. Secondary mechanics are synchronised multi-elite patterns and sustained resource pressure with no free recovery.',
    visualIdentity:
      'Grayscale signal is impossible depth: one continuous table mass runs out of frame with rows of identical high-backed chair silhouettes shrinking to a vanishing point, so scale is the identity. Materials are dark, waxed, and deeply grained with pooled light only at the seats, producing an almost-black field punctured by regular bright discs no other department produces.',
    hidden: true,
    originalityNote:
      'Original hidden chapter built from corporate governance: motions, seconding, quorum, and minuted decisions become a mechanic where the enemy group legislates against the player mid-fight. The reveal that the defeated leader was an employee of a longer table is drawn from real ownership structure, not from any existing game post-boss area.',
  },

  // -- DPT-011 Parent Company (deep hidden chapter) --------------------------
  {
    id: 'DPT-011',
    schemaVersion: 1,
    nameLoc: 'department.parent_company.name',
    tag: 'PARENT_COMPANY',
    routeRole: 'Deep hidden chapter',
    floors: ['FLOOR-PARENT_COMPANY_1'],
    roomTemplatePools: [
      'TPL_PARENT_COMPANY_CORE', 'TPL_PARENT_COMPANY_RECOMBINANT', 'TPL_SHARED_SERVICE',
    ],
    bossPools: ['BOSSPOOL-PARENT'],
    objectSets: [
      'ENV-001', 'ENV-006', 'ENV-008', 'ENV-012', 'ENV-018',
      'ENV-021', 'ENV-023',
    ],
    hazardSets: ['SCANNERS', 'MACHINE_STATES', 'RED_TAPE', 'ELECTRICITY'],
    itemAffinities: {
      ACCESS: 1.4, MANAGEMENT: 1.3, MODIFIER: 1.25, INFORMATION: 1.2,
      DEFENSE: 1.15, TRADEOFF: 1.1, COFFEE: 0.7, STATIONERY: 0.7,
    },
    presentation: {
      palette: {
        f: '#b0aeaa', // uniform pale terrazzo with no wear pattern at all
        F: '#bcbab6',
        l: '#c9c8c5', // flawless plaster, unbranded, unlabelled
        L: '#dcdbd9',
        u: '#9c9b98', // anonymous grey systems furniture
        U: '#c0bfbc',
        i: '#5d7d8f', // a corporate blue-grey that is almost the known brand
        I: '#9dbccb',
        D: '#66655f',
        P: '#a8a49a', // brushed signage blanks
      },
      floorPattern: 'uniform_pale_terrazzo_without_wear_paths',
      wallPattern: 'flawless_plaster_with_blank_signage_plates',
      lighting: { tint: '#f4f6f4', strength: 0.12, vignette: 0.14 },
      music: 'MUS-PARENT_COMPANY',
      ambience: 'SFX-AMB_PARENT_COMPANY',
      transitionSting: 'SFX-STING_PARENT_COMPANY',
    },
    narrativeImplication:
      'The company the player has been fighting through is a subsidiary: this complex is newer, cleaner, entirely unbranded, and it holds correctly filed records of departments that were destroyed hours ago.',
    gameplayIdentity:
      'Primary mechanic is recombination: each room imports one earlier department rule and applies it in an unfamiliar architecture, so mastery transfers but memorised rooms do not. Secondary mechanics are upgraded continuity variants of earlier enemies and false ending doors that must be identified and refused.',
    visualIdentity:
      'Grayscale signal is the absence of history: no wear paths, no scuffs, no stains, no signage, and perfectly equal spacing, so the department reads as an unnaturally clean value field with almost zero texture noise. Silhouettes quote earlier chapters but are stripped of every ornament and set at identical pitch, which makes the recombination legible without any colour cue.',
    hidden: true,
    originalityNote:
      'Original deep-hidden chapter built from holding-company reality: shared-service centres, unbranded corporate campuses, and consolidated reporting produce an area whose horror is that it is tidy and correctly filed. The recombination of earlier rules is framed as group standardisation, not as a remixed boss-rush device from another game.',
  },

  // -- DPT-012 The Conglomerate (ultra hidden chapter) ----------------------
  {
    id: 'DPT-012',
    schemaVersion: 1,
    nameLoc: 'department.conglomerate.name',
    tag: 'CONGLOMERATE',
    routeRole: 'Ultra hidden chapter',
    floors: ['FLOOR-CONGLOMERATE_1'],
    roomTemplatePools: ['TPL_CONGLOMERATE_CORE', 'TPL_CONGLOMERATE_MERGED', 'TPL_SHARED_SERVICE'],
    bossPools: ['BOSSPOOL-CONGLOMERATE'],
    objectSets: [
      'ENV-008', 'ENV-010', 'ENV-012', 'ENV-013', 'ENV-017',
      'ENV-019', 'ENV-023', 'ENV-024',
    ],
    hazardSets: ['CONVEYORS', 'ELECTRICITY', 'RED_TAPE', 'GLASS', 'VOTE'],
    itemAffinities: {
      MODIFIER: 1.5, FORBIDDEN: 1.4, TRADEOFF: 1.35, MANAGEMENT: 1.25,
      DEFENSE: 1.2, ACCESS: 1.2, SUSTAIN: 1.0, COFFEE: 0.6,
    },
    presentation: {
      palette: {
        f: '#57525c', // four floor finishes meeting at wrong angles
        F: '#6f6976',
        l: '#4a4753', // spliced wall systems, mismatched datum lines
        L: '#615d6b',
        u: '#6b6472', // furniture from four companies, welded together
        U: '#8f8899',
        i: '#a53f6b', // merged-logo magenta bleeding into corporate blue
        I: '#dd85ab',
        D: '#211f27',
        P: '#84809b',
      },
      floorPattern: 'spliced_finishes_meeting_at_non_orthogonal_seams',
      wallPattern: 'merged_wall_systems_with_mismatched_datum_lines',
      lighting: { tint: '#e0d0f0', strength: 0.30, vignette: 0.52 },
      music: 'MUS-CONGLOMERATE',
      ambience: 'SFX-AMB_CONGLOMERATE',
      transitionSting: 'SFX-STING_CONGLOMERATE',
    },
    narrativeImplication:
      'Several whole companies have been merged without anyone reconciling the buildings, so rooms occupy the same coordinates twice and both versions are still in operation.',
    gameplayIdentity:
      'Primary mechanic is unstable topology: room connections and finishes belong to more than one department at once, and a cleared room may re-present another company layout on re-entry, always announced by a visible seam warning first. Secondary mechanics are cross-department hazard combinations and earlier elite bosses fielded as ordinary enemies.',
    visualIdentity:
      'Grayscale signal is the seam: every surface is visibly spliced from two or more incompatible systems at non-orthogonal angles, with datum lines, skirting heights, and grid pitches failing to line up across the joint. Silhouettes are chimeric — a rack welded to a boardroom chair — so the department is identified purely by mismatched construction logic and never by tone.',
    hidden: true,
    originalityNote:
      'Original ultra-hidden chapter built from post-merger integration failure: duplicate coordinates, unreconciled estates, and clashing fit-out standards become an unstable-topology mechanic. The impossible architecture is authored as a documentation problem between real companies rather than as any existing game glitch or corrupted-world area.',
  },

  // -- DPT-013 Ownership (terminal hidden arena) ----------------------------
  {
    id: 'DPT-013',
    schemaVersion: 1,
    nameLoc: 'department.ownership.name',
    tag: 'OWNERSHIP',
    routeRole: 'Terminal hidden arena',
    floors: ['FLOOR-OWNERSHIP_1'],
    roomTemplatePools: ['TPL_OWNERSHIP_ARENA', 'TPL_OWNERSHIP_APPROACH'],
    bossPools: ['BOSSPOOL-OWNERSHIP'],
    objectSets: ['ENV-006', 'ENV-008', 'ENV-012', 'ENV-020', 'ENV-021'],
    hazardSets: ['GLASS', 'PRESSURE', 'DARKNESS', 'VOTE'],
    itemAffinities: {
      REVIVAL: 1.3, DEFENSE: 1.25, MANAGEMENT: 1.2, MODIFIER: 1.1,
      ECONOMY: 0.5, STATIONERY: 0.5, COFFEE: 0.5, PAPER: 0.5,
    },
    presentation: {
      palette: {
        f: '#d8d4cc', // one enormous slab of pale stone, no joints
        F: '#e2ded6',
        l: '#e6e2da', // full-height plaster with nothing on it
        L: '#f2efe9',
        u: '#c2bcb0', // one object per room, stone or nothing
        U: '#e0dad0',
        i: '#a8925c', // a single thin metal line at eye height, room-wide
        I: '#d8c898',
        D: '#8e887c',
        P: '#b4aca0',
      },
      floorPattern: 'single_jointless_pale_stone_plane',
      wallPattern: 'full_height_plaster_with_one_datum_line',
      lighting: { tint: '#fffaf0', strength: 0.10, vignette: 0.12 },
      music: 'MUS-OWNERSHIP',
      ambience: 'SFX-AMB_OWNERSHIP',
      transitionSting: 'SFX-STING_OWNERSHIP',
    },
    narrativeImplication:
      'Above every structure the player has fought through is a room with no desks, no staff, no signage, and no work being done, which is what actually owning the tower looks like.',
    gameplayIdentity:
      'Primary mechanic is pure pattern mastery: the arena offers no cover, no hazards to exploit, and no resources, so survival is read-and-dodge against patterns that deliberately quote earlier bosses back at the player. Secondary mechanic is selective echo, where a short recital of one earlier department rule is announced and then enforced.',
    visualIdentity:
      'Grayscale signal is total emptiness at maximum brightness: an unbroken pale plane with one continuous datum line and at most one object, so the player silhouette and the projectiles are the only shapes on screen. It is the exact inverse of The Board, which is near-black and crowded, and it is identified by having nothing to read rather than by any colour.',
    hidden: true,
    originalityNote:
      'Original terminal arena built from the observation that ultimate ownership is invisible and does no work: the reward for reaching the top of a corporate hierarchy is a room with nothing in it. The emptiness is a legibility mechanic for pattern mastery, and the space, its occupant, and its framing are authored from ownership structure rather than from any existing game final arena.',
  },
];

export default departments;
