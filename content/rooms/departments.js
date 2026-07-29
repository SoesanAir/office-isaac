/**
 * Core room templates for the twelve departments above Open Office.
 *
 * GDD refs: 10.x (the department ladder), 12.2 (room roles), 13.x (department objects and
 *           hazards), R-DPT-001 (each department has a distinct primary mechanic),
 *           R-DPT-005 (a department is identifiable from a single screenshot), R-ROM-001
 *           (templates and encounters are separate assets), Appendix E (the arenas these
 *           bosses were authored against).
 *
 * Each entry is a *flavour spec*, not a room. `departmentCoreSet` in _department-core.js
 * expands it into the four roles whose architecture is department-specific: start, normal
 * combat (five footprints), hallway, and boss arena. Read that file's header for why this
 * is a factory while Open Office is hand-written.
 *
 * The `signature` painter is the load-bearing field. It is the department's primary
 * mechanic — the one from its own `gameplayIdentity` — turned into geometry, and it is what
 * makes R-DPT-005 true: aisles of racks read as IT, conveyor benches read as Operations,
 * a ring around an empty middle reads as a boardroom. `secondary` exists so a department
 * is not one room repeated fifteen times.
 *
 * `objects` is each department's own `objectSets` from content/departments/departments.js,
 * quoted rather than re-picked, so a department's rooms contain the furniture the
 * department is defined by. `hazards` names real ids from content/world/hazards.js — two
 * per department, used by the wide and large rooms only, because a hazard in every room
 * stops being a feature.
 */

import { departmentCoreSet, aisles, benches, ringed, posts, corners, trench, LOW } from './_department-core.js';

/**
 * IT — powered state. Racks in aisles, and the aisles are where the current runs.
 */
const IT = {
  dept: 'IT', slug: 'IT',
  signature: aisles({ spacing: 5 }),
  secondary: posts({ stepX: 5, stepY: 3 }),
  decorationSets: ['MAINTENANCE_GREY', 'FLUORESCENT_FLICKER'],
  objects: ['ENV-001', 'ENV-008', 'ENV-009', 'ENV-010', 'ENV-011', 'ENV-012', 'ENV-016', 'ENV-019', 'ENV-023'],
  hazards: ['HAZ-ELEC_SHOCK_LANE', 'HAZ-CABLE_LIVE_RUN'],
  vignettes: {
    start: 'A cold aisle with one fan louder than the rest, and a login prompt nobody has answered.',
    normal: 'Racks in rows, status lights out of sync, and a cable run you should not step on.',
    normalAlt: 'Half the machines here are labelled DO NOT POWER OFF in three different hands.',
    empty: 'An aisle stripped to the rails. Whatever lived here was decommissioned properly.',
    hall: 'A cable tray overhead and a floor tile that clicks under one particular step.',
    boss: 'The cold aisle opens into a room where every rack faces one chair.',
  },
};

/**
 * Operations — imposed movement. Benches and belt lines run across the room, so the floor
 * decides where you end up.
 */
const OPERATIONS = {
  dept: 'OPERATIONS', slug: 'OPERATIONS',
  signature: benches({ spacing: 4 }),
  secondary: aisles({ spacing: 6 }),
  decorationSets: ['MAINTENANCE_GREY', 'SUPPLY_SHELVING'],
  objects: ['ENV-001', 'ENV-004', 'ENV-009', 'ENV-013', 'ENV-016', 'ENV-017', 'ENV-018', 'ENV-022', 'ENV-024'],
  hazards: ['HAZ-CONVEYOR_BELT_RUN', 'HAZ-CONVEYOR_REVERSING_BELT'],
  vignettes: {
    start: 'A goods lift with a weight limit painted on the floor and a scuff mark well past it.',
    normal: 'Belt lines cross the room at knee height, all of them still moving.',
    normalAlt: 'Pallets stacked to shoulder height in a grid somebody clearly measured.',
    empty: 'The belts here have been stopped. It is the quietest room on the floor.',
    hall: 'A roller lane narrow enough that you have to pick a side.',
    boss: 'Every belt on the floor terminates here, at a desk with a clipboard on it.',
  },
};

/**
 * Executive — controlled access. Glass rings around open floor: you can see everything and
 * approach almost none of it directly.
 */
const EXECUTIVE = {
  dept: 'EXECUTIVE', slug: 'EXECUTIVE',
  signature: ringed({ inset: 3 }),
  secondary: corners(3),
  decorationSets: ['GLASS_PARTITIONS', 'MANAGER_TRAPPINGS'],
  objects: ['ENV-006', 'ENV-008', 'ENV-012', 'ENV-013', 'ENV-015', 'ENV-018', 'ENV-020', 'ENV-023'],
  hazards: ['HAZ-SCANNER_SWEEP_LINE', 'HAZ-GLASS_SHARD_FIELD'],
  vignettes: {
    start: 'Thick carpet, and a reception desk with nobody behind it and a visitor book open.',
    normal: 'Glass partitions on three sides. You are visible from everywhere and cornered nowhere.',
    normalAlt: 'A waiting area arranged so that every chair faces one closed door.',
    empty: 'An office cleared to the carpet, with four indentations where a desk used to be.',
    hall: 'A corridor with framed values on both walls and a scanner arch at one end.',
    boss: 'The corner office. Two walls of glass, one of them cracked from the inside.',
  },
};

/**
 * Finance — reconciliation. Long filing aisles, and paper as terrain.
 */
const FINANCE = {
  dept: 'FINANCE', slug: 'FINANCE',
  signature: aisles({ spacing: 4, gapAt: 0.35 }),
  secondary: benches({ spacing: 5 }),
  decorationSets: ['RECORDS_ROWS', 'PAPER_OVERFLOW'],
  objects: ['ENV-001', 'ENV-012', 'ENV-013', 'ENV-018', 'ENV-020', 'ENV-022', 'ENV-023'],
  hazards: ['HAZ-PAPER_DRIFT_BANK', 'HAZ-SCANNER_MARK_PULSE'],
  vignettes: {
    start: 'A counting room with a coin tray bolted to the desk and no coins in it.',
    normal: 'Filing aisles deep enough to lose a person, numbered but not in order.',
    normalAlt: 'Receipt printers along one wall, all of them still feeding paper onto the floor.',
    empty: 'Boxes gone, labels left behind. The shelf numbers skip from nine to eleven.',
    hall: 'A passage between two record walls, wide enough for one trolley.',
    boss: 'A reconciliation room with one long table and a ledger open at both ends.',
  },
};

/**
 * Marketing — attention. Open studio floor with staging posts and bright empty middles.
 */
const MARKETING = {
  dept: 'MARKETING', slug: 'MARKETING',
  signature: posts({ stepX: 5, stepY: 3 }),
  secondary: ringed({ inset: 4 }),
  decorationSets: ['CELEBRATION_LEFTOVERS', 'GLASS_PARTITIONS'],
  objects: ['ENV-004', 'ENV-006', 'ENV-009', 'ENV-012', 'ENV-014', 'ENV-016', 'ENV-022'],
  hazards: ['HAZ-FIRE_PAPER_BLAZE', 'HAZ-DARKNESS_OUTAGE_ZONE'],
  vignettes: {
    start: 'A brand wall in three colours, the third of which was clearly a compromise.',
    normal: 'Studio lights on stands, most of them pointed at nothing in particular.',
    normalAlt: 'A launch set half struck down, with the good half kept for photographs.',
    empty: 'A rebrand happened here. There is nothing left to say what it was before.',
    hall: 'A corridor of mounted campaign boards, each one superseded by the next.',
    boss: 'A presentation floor with seating for forty and a stage for one.',
  },
};

/**
 * Legal — conditional zones. Marked bands across the floor, and paper that holds you up.
 */
const LEGAL = {
  dept: 'LEGAL', slug: 'LEGAL',
  signature: benches({ spacing: 3, char: LOW }),
  secondary: aisles({ spacing: 5, gapAt: 0.65 }),
  decorationSets: ['RECORDS_ROWS', 'PAPER_OVERFLOW'],
  objects: ['ENV-001', 'ENV-012', 'ENV-013', 'ENV-014', 'ENV-018', 'ENV-022', 'ENV-023'],
  hazards: ['HAZ-REDTAPE_COMPLIANCE_BAND', 'HAZ-PAPER_DRIFT_BANK'],
  vignettes: {
    start: 'A reception with a sign-in sheet, a pen on a chain, and a clause about the pen.',
    normal: 'Compliance bands taped across the floor in a pattern with a legend nobody kept.',
    normalAlt: 'Case boxes at waist height, stacked so the aisles are technically compliant.',
    empty: 'A room emptied under instruction. Even the tape has been lifted.',
    hall: 'A corridor with a floor marking that changes colour halfway along.',
    boss: 'A room where the table is the only thing not covered in paper.',
  },
};

/**
 * Facilities — the building's underside. Service trenches and utility runs.
 */
const FACILITIES = {
  dept: 'FACILITIES', slug: 'FACILITIES',
  signature: trench({ half: 1 }),
  secondary: aisles({ spacing: 6, gapAt: 0.5 }),
  decorationSets: ['MAINTENANCE_GREY', 'LOST_PROPERTY'],
  objects: ['ENV-004', 'ENV-010', 'ENV-011', 'ENV-016', 'ENV-017', 'ENV-019', 'ENV-022', 'ENV-024'],
  hazards: ['HAZ-SPILL_WATER_SLICK', 'HAZ-ELEC_FLOOR_ARC'],
  vignettes: {
    start: 'A plant room entry with a key hook, one key on it, and eleven empty hooks.',
    normal: 'A service trench down the middle with two plates laid across it.',
    normalAlt: 'Pipework at head height and a drain that is doing most of the work.',
    empty: 'A pump bay with the pump removed and the bolts left standing.',
    hall: 'A service passage with a light every third fitting.',
    boss: 'The boiler room, where every valve on this floor has a handle.',
  },
};

/**
 * R&D — unstable experiments. Test-chamber posts and containment rings.
 */
const RND = {
  dept: 'RND', slug: 'RND',
  signature: posts({ stepX: 4, stepY: 3 }),
  secondary: ringed({ inset: 3 }),
  decorationSets: ['MAINTENANCE_GREY', 'FLUORESCENT_FLICKER'],
  objects: ['ENV-009', 'ENV-010', 'ENV-012', 'ENV-014', 'ENV-016', 'ENV-019', 'ENV-022', 'ENV-023'],
  hazards: ['HAZ-FOAM_DISCHARGE_CLOUD', 'HAZ-MACHINE_STEAM_VENT'],
  vignettes: {
    start: 'A test-chamber airlock with a whiteboard reading DAY 1 and, under it, DAY 1 again.',
    normal: 'Instrument posts in a grid, each one measuring something that has stopped.',
    normalAlt: 'A containment ring with the foam discharge already spent across the floor.',
    empty: 'A chamber scrubbed clean. The extraction is still running.',
    hall: 'A pressure corridor with a door at each end and a sign about using only one.',
    boss: 'Prototype bay one. The floor markings suggest something larger than the door.',
  },
};

/**
 * The Board — deliberation. A ring of seats, and the middle is the point.
 */
const BOARD = {
  dept: 'BOARD', slug: 'BOARD',
  signature: ringed({ inset: 4 }),
  secondary: corners(4),
  decorationSets: ['MANAGER_TRAPPINGS', 'GLASS_PARTITIONS'],
  objects: ['ENV-006', 'ENV-008', 'ENV-012', 'ENV-013', 'ENV-020', 'ENV-023'],
  hazards: ['HAZ-VOTE_QUORUM_CIRCLE', 'HAZ-DARKNESS_OUTAGE_ZONE'],
  vignettes: {
    start: 'An anteroom with more chairs than the room beyond has places.',
    normal: 'Seating arranged in a ring, all of it facing a space with nothing in it.',
    normalAlt: 'A committee room where the table has been removed and the chairs have not.',
    empty: 'A chamber between sessions. The minutes on the floor are from years apart.',
    hall: 'A panelled corridor with no windows and very good acoustics.',
    boss: 'A room larger than the building it is in, with a quorum circle marked on the floor.',
  },
};

/**
 * Parent Company — sanitised. Everything is generic on purpose, which is the tell.
 */
const PARENT_COMPANY = {
  dept: 'PARENT_COMPANY', slug: 'PARENT_COMPANY',
  signature: corners(3),
  secondary: posts({ stepX: 7, stepY: 4 }),
  decorationSets: ['GENERIC', 'CARPET_GRID'],
  objects: ['ENV-001', 'ENV-006', 'ENV-008', 'ENV-012', 'ENV-018', 'ENV-021', 'ENV-023'],
  hazards: ['HAZ-SCANNER_IDLE_READER', 'HAZ-REDTAPE_COMPLIANCE_BAND'],
  vignettes: {
    start: 'A lobby with no logo anywhere, in a building that clearly had one.',
    normal: 'An office fitted out to a specification, with nothing chosen by anyone here.',
    normalAlt: 'Identical desks at identical spacing. The measurements are the decoration.',
    empty: 'A room to standard. It is impossible to tell which floor you are on.',
    hall: 'A corridor of unbranded doors, each with a number and no name.',
    boss: 'A room built to be any room, holding something built to be any company.',
  },
};

/**
 * The Conglomerate — merged. Two departments' architecture in one room, badly joined.
 */
const CONGLOMERATE = {
  dept: 'CONGLOMERATE', slug: 'CONGLOMERATE',
  // Aisles down one half, benches across the other: the seam is the mechanic, and it is
  // the same seam ENM-058 Merger Abomination wears on its silhouette.
  signature: (x, y, ctx) => (x < Math.floor(ctx.w / 2)
    ? aisles({ spacing: 4 })(x, y, ctx)
    : benches({ spacing: 4 })(x, y, ctx)),
  secondary: trench({ half: 1 }),
  decorationSets: ['MAINTENANCE_GREY', 'GLASS_PARTITIONS'],
  objects: ['ENV-008', 'ENV-010', 'ENV-012', 'ENV-013', 'ENV-017', 'ENV-019', 'ENV-023', 'ENV-024'],
  hazards: ['HAZ-CONVEYOR_PINCH_ROLLER', 'HAZ-ELEC_OUTLET_SPARK'],
  vignettes: {
    start: 'Two reception desks, back to back, with different company names still on them.',
    normal: 'Racks down one half and belt lines across the other, meeting at an angle.',
    normalAlt: 'A floor where the carpet changes pattern halfway and the ceiling height does not match.',
    empty: 'A merged room emptied twice, once by each side.',
    hall: 'A corridor joining two buildings that were never the same height.',
    boss: 'Four departments of floor plan, sequenced into one room.',
  },
};

/**
 * Ownership — almost nothing. The plainest architecture in the game, deliberately.
 */
const OWNERSHIP = {
  dept: 'OWNERSHIP', slug: 'OWNERSHIP',
  // Nearly empty. BSS-029's arena is the plainest in the game because Appendix E strips
  // the final duel down to movement and weapon skill, and the approach should match.
  signature: corners(2),
  secondary: posts({ stepX: 9, stepY: 6 }),
  decorationSets: ['GENERIC'],
  objects: ['ENV-006', 'ENV-008', 'ENV-012', 'ENV-020', 'ENV-021'],
  hazards: ['HAZ-GLASS_SHARD_FIELD'],
  vignettes: {
    start: 'A room with a chair in it. The chair is the only thing that has been chosen.',
    normal: 'Bare floor, good light, and two objects placed a long way apart.',
    normalAlt: 'A space kept empty at what must be considerable expense.',
    empty: 'Nothing at all. The room is the point.',
    hall: 'A short passage with no signage, because anyone here already knows.',
    boss: 'The top. One seat, one window, and nothing else in the room.',
  },
};

const SPECS = [
  IT, OPERATIONS, EXECUTIVE, FINANCE, MARKETING, LEGAL,
  FACILITIES, RND, BOARD, PARENT_COMPANY, CONGLOMERATE, OWNERSHIP,
];

export default SPECS.flatMap((spec) => departmentCoreSet(spec));
