/**
 * TPL-OPEN_OFFICE_* room architecture for DPT-001 Open Office I-II.
 *
 * Content kind: roomTemplate. `src/schemas.js` holds the normative schema and
 * `content/rooms/_builder.js` holds the authoring helper this file is written
 * through — geometry grids, the wall ring and the default perimeter sockets are
 * all derived there, never hand-typed here.
 *
 * GDD refs: A.DPT-001 (cubicles, carpet grids, fluorescent light, meeting rooms,
 *           printers, coffee stains; cover objects and cardinal shooters),
 *           11.6 (door patterns: one socket per perimeter cell edge, so the
 *           generator can use the same architecture as dead end, corridor,
 *           corner, junction or crossroads), 11.7 (secret entrances sit at
 *           *authored* blast locations, hence `secretSides`), 11.8 (room-size
 *           distribution), 12.1 (layered room instance — this file authors the
 *           geometry, object-anchor and spawn-zone layers only), 12.2 (templates
 *           are handcrafted and reused with different encounters, object states,
 *           hazards and decoration variants), 12.4 (ROOM-001..028 role catalog),
 *           12.5 (required room rewards — the REWARD zone the builder derives),
 *           12.6 (environmental storytelling), F.3 (template pack minimums),
 *           R-FLR-004, R-FLR-007 / R-ROM-001 (no encounter is ever named here),
 *           R-ROM-004 (decoration never hides collision or telegraphs),
 *           R-ROM-006 / R-ENM-008 (one connected navigation region),
 *           R-ENV-004 (nothing certain ever occupies a blast point),
 *           R-BSS-006 (no arena is a maze).
 *
 * ---------------------------------------------------------------------------
 * How to read a template here
 * ---------------------------------------------------------------------------
 * Only three things in each entry are creative work:
 *
 *   `interior`   the cover layout, drawn with the painters below in interior
 *                world-unit coordinates. A single cell interior is 21x11, so a
 *                1x1 room's usable field is x 0..20, y 0..10.
 *   `vignette`   the one-line environmental story (GDD 12.6). Original scenes,
 *                not the GDD's own examples.
 *   `weight`     how ordinary the room is. Plain bullpens are ~2.0-2.5, shaped
 *                combat rooms ~1.0-1.6, gimmicks 0.5-0.8.
 *
 * Everything else is declared intent: which sides may hide a blast entrance,
 * which encounter shapes the geometry can host, which object families may fill
 * an anchor, and the department/role tags the generator queries.
 *
 * ---------------------------------------------------------------------------
 * The two rules every painter in this file obeys
 * ---------------------------------------------------------------------------
 * 1. **Doors always open onto floor.** Every template layers `doorClear(cells)`
 *    first, which forces the tile each socket opens onto — plus one tile inward —
 *    back to floor. A wall that would seal an entrance instead gets a doorway
 *    punched through it, which is what a real office wall would have anyway.
 * 2. **One walkable region.** Free-standing dividers never touch the opposite
 *    wall (`dividersV` keeps the top and bottom rows open, `dividersH` keeps the
 *    left and right columns open), teeth are always shorter than the room, and
 *    carved corridor rooms list every arm explicitly. Low cover uses '~', which
 *    blocks shots but not movement, so it can never divide a room at all.
 */

import {
  CELL_W, CELL_H, DOOR_CLASS, ROOM_ROLE, SPAWN_ZONE,
} from '../../src/core/constants.js';
import {
  makeTemplate, buildSockets, layers, quadrantCover, cubicleRows, centreIsland,
  pillars, laneDividers, STRIDE_X, STRIDE_Y,
} from './_builder.js';

const DEPT = 'OPEN_OFFICE';

/** Geometry characters (see roomTemplateSchema.geometry). */
const WALL = '#';
const LOW = '~';
const PIT = 'x';
const FLOOR = '.';

/** Footprints used repeatedly. */
const CELLS_1X1 = [[0, 0]];
const CELLS_2X1 = [[0, 0], [1, 0]];
const CELLS_1X2 = [[0, 0], [0, 1]];
const CELLS_2X2 = [[0, 0], [1, 0], [0, 1], [1, 1]];
/** The four three-cell L rotations, so a large room can fit any corner. */
const CELLS_L_NE = [[0, 0], [1, 0], [0, 1]];
const CELLS_L_SE = [[0, 0], [1, 0], [1, 1]];
const CELLS_L_SW = [[0, 0], [0, 1], [1, 1]];
const CELLS_L_NW = [[1, 0], [0, 1], [1, 1]];
const CELLS_3X1 = [[0, 0], [1, 0], [2, 0]];

/**
 * Door classes a gated special room must accept.
 *
 * The access *cost* is a floor-definition decision (GDD 11.3 `supply_closet_cost`,
 * `shop_door_cost`, `optional_rooms[].access_cost`), so a special room's socket has
 * to accept every class the generator might translate that cost into. Refusing
 * them here would silently drop the room from any floor that charges for it.
 */
const GATED_CLASSES = [
  DOOR_CLASS.NORMAL, DOOR_CLASS.LOCKED_CARD, DOOR_CLASS.LOCKED_DOUBLE,
  DOOR_CLASS.SHOP, DOOR_CLASS.RESTRICTED, DOOR_CLASS.ROUTE,
];

/** Env object families (GDD F.2). Named so anchors read as intent, not ids. */
const CABINET = 'ENV-001';
const COOLER = 'ENV-002';
const PRINTER = 'ENV-003';
const BIN = 'ENV-004';
const VENDING = 'ENV-005';
const PLANT = 'ENV-006';
const DIVIDER = 'ENV-007';
const DESK = 'ENV-008';
const CHAIR = 'ENV-009';
const RACK = 'ENV-010';
const CABLES = 'ENV-011';
const GLASS = 'ENV-012';
const SHELF = 'ENV-013';
const BOARD = 'ENV-014';
const COFFEE = 'ENV-015';
const EXTINGUISHER = 'ENV-016';
const CART = 'ENV-017';
const LOCKBOX = 'ENV-018';
const STRIP = 'ENV-019';
const TROPHY = 'ENV-020';
const STAIN = 'ENV-021';
const PAPER = 'ENV-022';
const SCANNER = 'ENV-023';

// ---------------------------------------------------------------------------
// Painters
// ---------------------------------------------------------------------------

/**
 * Force the tile each door opens onto — and one tile further in — back to floor.
 *
 * `doorInnerTile()` in floor-validate.js resolves a socket at offset 0.5 to the
 * middle of that cell edge, so those tiles are known ahead of time and can be
 * protected instead of hoped for. Layering this first means a wall drawn across
 * an entrance becomes a doorway rather than a validation failure (R-ROM-006).
 *
 * @param {Array<[number,number]>} cells footprint
 */
function doorClear(cells) {
  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));
  const keep = new Set();
  const mid = Math.min(CELL_W - 1, Math.floor(0.5 * CELL_W));
  const midY = Math.min(CELL_H - 1, Math.floor(0.5 * CELL_H));
  for (const [cx, cy] of cells) {
    const bx = cx * STRIDE_X;
    const by = cy * STRIDE_Y;
    const edges = [
      [[0, -1], [bx + mid, by], [bx + mid, by + 1]],
      [[0, 1], [bx + mid, by + CELL_H - 1], [bx + mid, by + CELL_H - 2]],
      [[-1, 0], [bx, by + midY], [bx + 1, by + midY]],
      [[1, 0], [bx + CELL_W - 1, by + midY], [bx + CELL_W - 2, by + midY]],
    ];
    for (const [[dx, dy], door, inward] of edges) {
      // An edge shared with another cell of the same room can never host a door.
      if (cellSet.has(`${cx + dx},${cy + dy}`)) continue;
      keep.add(`${door[0]},${door[1]}`);
      keep.add(`${inward[0]},${inward[1]}`);
    }
  }
  return (x, y) => (keep.has(`${x},${y}`) ? FLOOR : null);
}

/** Rect list painter: `[x, y, w, h]` in interior coordinates. */
function rects(list, char = WALL) {
  return (x, y) => {
    for (const [rx, ry, rw, rh] of list) {
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return char;
    }
    return null;
  };
}

/** Solid fill. Layered last, it turns everything not yet claimed into wall. */
function solid(char = WALL) {
  return () => char;
}

/**
 * Free-standing vertical dividers at the given columns.
 *
 * The top and bottom interior rows stay open, so any column set remains one
 * connected region no matter how many dividers are stacked. `openRows` cuts
 * extra crossings through them.
 */
function dividersV(cols, openRows = [], char = WALL) {
  const set = new Set(cols);
  const open = new Set(openRows);
  return (x, y, ctx) => (
    set.has(x) && y > 0 && y < ctx.h - 1 && !open.has(y) ? char : null
  );
}

/** Free-standing horizontal dividers; the left and right columns stay open. */
function dividersH(rows, openCols = [], char = WALL) {
  const set = new Set(rows);
  const open = new Set(openCols);
  return (x, y, ctx) => (
    set.has(y) && x > 0 && x < ctx.w - 1 && !open.has(x) ? char : null
  );
}

/**
 * Teeth hanging off the north or south wall, `len` tiles deep.
 *
 * Keep `len` at most h-3 so the far side always has a clear run connecting every
 * bay — that run is what makes a comb room readable instead of a maze.
 */
function teeth(side, cols, len, char = WALL) {
  const set = new Set(cols);
  return (x, y, ctx) => {
    if (!set.has(x)) return null;
    if (side === 'NORTH') return y < len ? char : null;
    return y >= ctx.h - len ? char : null;
  };
}

/** Cover blocks in the four corners, leaving every edge midpoint clear. */
function corners(size = 2, char = WALL) {
  return (x, y, ctx) => {
    const left = x >= 1 && x < 1 + size;
    const right = x >= ctx.w - 1 - size && x < ctx.w - 1;
    const top = y >= 1 && y < 1 + size;
    const bottom = y >= ctx.h - 1 - size && y < ctx.h - 1;
    return (left || right) && (top || bottom) ? char : null;
  };
}

/** Carve a room out of solid: only the listed rects (and the doors) are floor. */
function carve(open, obstacles = null) {
  return layers(obstacles, rects(open, FLOOR), solid(WALL));
}

/** Object anchor shorthand. */
function at(x, y, allow, chance, variantHint) {
  return {
    at: [x, y],
    allow: Array.isArray(allow) ? allow : [allow],
    chance,
    ...(variantHint ? { variantHint } : {}),
  };
}

/** Hazard anchor shorthand. */
function haz(hazard, rect, chance) {
  return { hazard, rect, chance };
}

/**
 * Build one Open Office template.
 *
 * Wraps `makeTemplate` so every entry gets the department tag and the door-clear
 * guard without repeating them 117 times.
 */
function oo(spec) {
  const cells = spec.cells || CELLS_1X1;
  const guard = doorClear(cells);
  return makeTemplate({
    ...spec,
    departments: [DEPT],
    cells,
    interior: spec.interior ? layers(guard, spec.interior) : guard,
  });
}

// ---------------------------------------------------------------------------
// Pack: Start rooms (ROOM-001)
// ---------------------------------------------------------------------------
// The lift lobby. No combat, no encounter tags, and the room-map origin. Two of
// the four allow a blast side so Maintenance Access can hang off the lobby, which
// GDD 11.7 permits and which teaches the mechanic early.

const startPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_START_1X1_A',
    roles: [ROOM_ROLE.START, 'SAFE'],
    decorationSets: ['GENERIC', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 2, PLANT, 0.7),
      at(16, 8, BIN, 0.5),
      at(17, 2, BOARD, 0.4),
    ],
    vignette: 'The lift doors close behind you on a floor plan sign with one arrow scratched off.',
    weight: 2.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_START_1X1_B',
    roles: [ROOM_ROLE.START, 'SAFE'],
    interior: corners(2),
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['GENERIC', 'CARPET_GRID'],
    objectAnchors: [
      at(5, 8, PLANT, 0.6, 'DUSTY'),
      at(15, 2, COOLER, 0.5),
      at(10, 8, STAIN, 0.4),
    ],
    vignette: 'Four planters boxed into the corners, each one a different shade of dying.',
    weight: 1.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_START_1X1_C',
    roles: [ROOM_ROLE.START, 'SAFE'],
    // A reception counter across the middle: the room reads as a threshold.
    interior: rects([[7, 4, 7, 1]]),
    decorationSets: ['GENERIC', 'ONBOARDING_CORNER'],
    objectAnchors: [
      at(8, 6, CHAIR, 0.6, 'TIPPED'),
      at(13, 3, BOARD, 0.5),
      at(3, 8, PLANT, 0.5),
    ],
    vignette: 'A reception desk with a visitor book open at a page of identical signatures.',
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_START_1X1_D',
    roles: [ROOM_ROLE.START, 'SAFE'],
    interior: pillars({ stepX: 5, stepY: 4 }),
    socketOpts: { secretSides: ['NORTH', 'SOUTH', 'EAST'] },
    decorationSets: ['GENERIC', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(3, 2, EXTINGUISHER, 0.6),
      at(17, 8, BIN, 0.5),
      at(6, 8, STAIN, 0.35),
    ],
    vignette: 'A columned lobby lit by one working tube in six; the rest hum without light.',
    weight: 1.2,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Normal single-cell combat (ROOM-002) — F.3 minimum 24
// ---------------------------------------------------------------------------
// The working set. Each entry is a different *combat* problem, not a different
// decoration: open arenas, cover on one side only, long firing lanes, chokepoints
// with flanks, sight-blocking low cover you can still walk through, comb bays that
// force flanking, and warrens that punish standing still. Roughly two thirds
// declare blast sides, spread across all four compass directions, because GDD 11.7
// finds Maintenance Access by looking for an authored blast wall on a neighbour.

const combatRoles = [ROOM_ROLE.WORKROOM, 'COMBAT_CAPABLE', 'NORMAL'];

const normalPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_A',
    roles: combatRoles,
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'OPEN_CENTRE'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['GENERIC', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 2, [DESK, CHAIR], 0.5),
      at(16, 8, [DESK, BIN], 0.5),
      at(10, 2, STAIN, 0.3),
    ],
    weight: 2.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_B',
    roles: combatRoles,
    interior: quadrantCover(4, 2),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL'],
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['GENERIC', 'CUBICLE_FARM'],
    objectAnchors: [
      at(4, 4, DESK, 0.8),
      at(16, 6, DESK, 0.8),
      at(10, 5, CHAIR, 0.4),
    ],
    weight: 2.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_C',
    roles: combatRoles,
    interior: cubicleRows(),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'EAST', 'SOUTH', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(5, 3, DIVIDER, 0.9),
      at(15, 8, DIVIDER, 0.9),
      at(3, 6, CHAIR, 0.5),
      at(18, 2, BIN, 0.4),
    ],
    vignette: 'Three cubicle rows, and only the middle one still has anybody in the photos.',
    weight: 2.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_D',
    roles: combatRoles,
    interior: cubicleRows({ spacing: 7, gapEvery: 5 }),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['WEST', 'EAST'] },
    decorationSets: ['CUBICLE_FARM', 'HOT_DESKING'],
    objectAnchors: [
      at(7, 4, DIVIDER, 0.8),
      at(14, 6, DIVIDER, 0.8),
      at(3, 2, PLANT, 0.4),
    ],
    weight: 1.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_E',
    roles: combatRoles,
    interior: centreIsland(5, 3),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'WALL_PERIMETER'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH', 'WEST'] },
    decorationSets: ['GENERIC', 'PRINT_STATION'],
    objectAnchors: [
      at(8, 4, PRINTER, 0.7),
      at(12, 6, CABINET, 0.6),
      at(3, 8, BIN, 0.4),
    ],
    hazardAnchors: [haz('HAZ-MACHINE_TONER_CLOUD', [8, 3, 5, 5], 0.2)],
    weight: 1.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_F',
    roles: combatRoles,
    // Two islands with a central corridor: cover to hide behind, and one lane
    // that lets a ranged enemy punish anyone who stands in it.
    interior: rects([[4, 3, 4, 5], [13, 3, 4, 5]]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(5, 4, DESK, 0.7),
      at(15, 6, DESK, 0.7),
      at(10, 2, CHAIR, 0.4, 'TIPPED'),
    ],
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_G',
    roles: combatRoles,
    interior: pillars({ stepX: 4, stepY: 3 }),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'DASH_LANE'],
    socketOpts: { secretSides: ['NORTH', 'WEST'] },
    decorationSets: ['GENERIC', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 3, PLANT, 0.4),
      at(16, 6, PLANT, 0.4),
      at(8, 6, STAIN, 0.3),
    ],
    vignette: 'Structural columns wearing a decade of shoulder scuffs at exactly one height.',
    weight: 1.6,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_H',
    roles: combatRoles,
    // Two long dividers make three east-west lanes with a single central crossing:
    // ranged enemies own a lane, the player has to change lane to answer them.
    interior: dividersH([3, 7], [9, 10, 11]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'DASH_LANE'],
    socketOpts: { secretSides: ['EAST', 'SOUTH'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 3, DIVIDER, 0.8),
      at(16, 7, DIVIDER, 0.8),
      at(10, 5, CHAIR, 0.4),
    ],
    weight: 1.5,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_I',
    roles: combatRoles,
    // A chokepoint with three ways through it, so it pressures without trapping.
    interior: dividersV([10], [5]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    decorationSets: ['GLASS_PARTITIONS', 'CARPET_GRID'],
    objectAnchors: [
      at(10, 3, DIVIDER, 0.9),
      at(10, 8, DIVIDER, 0.9),
      at(5, 5, DESK, 0.5),
      at(15, 5, DESK, 0.5),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_J',
    roles: combatRoles,
    // Glass: '~' blocks shots but not movement, so the room is one space to walk
    // and two spaces to shoot in. R-ROM-004 holds because the partition is a
    // mechanical object with its own collision, not a decal.
    interior: layers(rects([[10, 1, 1, 9]], LOW), rects([[5, 3, 2, 1], [14, 7, 2, 1]])),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['GLASS_PARTITIONS', 'MEETING_AFTERMATH'],
    objectAnchors: [
      at(10, 3, GLASS, 0.9),
      at(10, 7, GLASS, 0.9),
      at(5, 3, DESK, 0.6),
      at(15, 7, DESK, 0.6),
    ],
    hazardAnchors: [haz('HAZ-GLASS_SHARD_FIELD', [9, 2, 3, 7], 0.15)],
    vignette: 'A glazed partition polished on one side only; nobody agreed whose side it was.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_K',
    roles: combatRoles,
    // All the cover is west. Entering from the east means crossing open ground.
    interior: rects([[3, 2, 3, 2], [3, 7, 3, 2], [7, 4, 2, 3]]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['WEST'] },
    decorationSets: ['CUBICLE_FARM', 'HOT_DESKING'],
    objectAnchors: [
      at(4, 2, DESK, 0.8),
      at(4, 7, DESK, 0.8),
      at(7, 5, CABINET, 0.6),
      at(16, 5, STAIN, 0.3),
    ],
    vignette: 'Every desk shoved against one wall, as if the floor were about to be measured.',
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_L',
    roles: combatRoles,
    // Four L-nests: cover you can occupy but not shoot out of in every direction.
    interior: rects([
      [2, 2, 4, 1], [2, 3, 1, 2], [15, 2, 4, 1], [18, 3, 1, 2],
      [2, 8, 4, 1], [2, 6, 1, 2], [15, 8, 4, 1], [18, 6, 1, 2],
    ]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'WALL_PERIMETER'],
    socketOpts: { secretSides: ['NORTH', 'EAST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(3, 3, CHAIR, 0.5),
      at(17, 3, CHAIR, 0.5),
      at(3, 7, CABINET, 0.5),
      at(17, 7, CABINET, 0.5),
    ],
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_M',
    roles: combatRoles,
    // A floor void where the carpet was lifted. Pits block ground movement and
    // shots, leaving a cross of floor: flyers ignore it, chasers cannot.
    interior: rects([[6, 2, 2, 3], [6, 6, 2, 3], [13, 2, 2, 3], [13, 6, 2, 3]], PIT),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'DASH_LANE'],
    decorationSets: ['GENERIC', 'MAINTENANCE_GREY'],
    objectAnchors: [
      at(10, 2, CART, 0.4),
      at(10, 8, EXTINGUISHER, 0.4),
    ],
    vignette: 'The carpet tiles are stacked in the corner and the void below is still open.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_N',
    roles: combatRoles,
    // Comb bays off the north wall: fighting inside a bay is a mistake.
    interior: teeth('NORTH', [4, 8, 12, 16], 5),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['SOUTH', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(6, 2, DESK, 0.8),
      at(14, 2, DESK, 0.8),
      at(10, 8, BIN, 0.4),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_O',
    roles: combatRoles,
    interior: teeth('SOUTH', [3, 7, 13, 17], 5),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'EAST'] },
    decorationSets: ['CUBICLE_FARM', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(5, 8, DESK, 0.8),
      at(15, 8, DESK, 0.8),
      at(10, 2, PAPER, 0.5),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_P',
    roles: combatRoles,
    // Interlocking combs. Every route bends, and no route is ever closed.
    interior: layers(teeth('NORTH', [5, 15], 6), teeth('SOUTH', [8, 12], 6)),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY', 'TIGHT_CORRIDOR_ONLY'],
    decorationSets: ['CUBICLE_FARM', 'HOT_DESKING'],
    objectAnchors: [
      at(3, 3, DIVIDER, 0.7),
      at(10, 8, DIVIDER, 0.7),
      at(18, 3, CHAIR, 0.4),
    ],
    vignette: 'A cubicle block reconfigured so often that the carpet remembers three layouts.',
    weight: 0.7,
    minDepth: 2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_Q',
    roles: combatRoles,
    // Pods marching diagonally: no firing lane runs straight through the room.
    interior: rects([[3, 1, 3, 2], [7, 4, 3, 2], [11, 7, 3, 2], [15, 1, 3, 2]]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['SOUTH', 'EAST', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 1, DESK, 0.7),
      at(8, 4, DESK, 0.7),
      at(12, 7, DESK, 0.7),
      at(16, 1, PLANT, 0.4),
    ],
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_R',
    roles: combatRoles,
    interior: cubicleRows({ spacing: 4, gapEvery: 3 }),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY', 'TIGHT_CORRIDOR_ONLY'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH', 'EAST', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(4, 2, DIVIDER, 0.9),
      at(8, 5, DIVIDER, 0.9),
      at(12, 2, DIVIDER, 0.9),
      at(16, 5, DIVIDER, 0.9),
    ],
    vignette: 'Density targets met: four aisles where the plan allowed two.',
    weight: 0.8,
    minDepth: 2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_S',
    roles: combatRoles,
    // A ring of desks with north and south gaps: an inner room without a door.
    interior: rects([
      [3, 2, 6, 1], [12, 2, 6, 1], [3, 8, 6, 1], [12, 8, 6, 1],
      [3, 3, 1, 5], [17, 3, 1, 5],
    ]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'WALL_PERIMETER'],
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['MEETING_AFTERMATH', 'CARPET_GRID'],
    objectAnchors: [
      at(6, 2, DESK, 0.8),
      at(14, 8, DESK, 0.8),
      at(10, 5, BOARD, 0.5),
    ],
    vignette: 'Desks pushed into a square for a workshop; the sticky notes never came down.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_T',
    roles: combatRoles,
    // Hourglass: wide at the ends, pinched in the middle.
    interior: rects([[2, 4, 5, 3], [14, 4, 5, 3]]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'DASH_LANE'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(3, 5, CABINET, 0.7),
      at(17, 5, CABINET, 0.7),
      at(10, 1, CHAIR, 0.4),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_U',
    roles: combatRoles,
    // Sight-blocking low cover only: total freedom of movement, no free shots.
    interior: rects([
      [4, 3, 3, 2], [14, 3, 3, 2], [4, 6, 3, 2], [14, 6, 3, 2], [9, 4, 3, 3],
    ], LOW),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['EAST', 'NORTH'] },
    decorationSets: ['CUBICLE_FARM', 'HOT_DESKING'],
    objectAnchors: [
      at(5, 3, DIVIDER, 0.8),
      at(15, 6, DIVIDER, 0.8),
      at(10, 5, PAPER, 0.4),
    ],
    weight: 1.5,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_V',
    roles: combatRoles,
    // A copier bank on both sides of a central crossroads.
    interior: rects([[6, 1, 3, 3], [12, 1, 3, 3], [6, 7, 3, 3], [12, 7, 3, 3]]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'DASH_LANE'],
    socketOpts: { secretSides: ['WEST', 'SOUTH'] },
    decorationSets: ['PRINT_STATION', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(7, 2, PRINTER, 0.8),
      at(13, 8, PRINTER, 0.8),
      at(13, 2, PAPER, 0.6, 'OVERFLOWING'),
      at(7, 8, BIN, 0.5),
    ],
    hazardAnchors: [haz('HAZ-MACHINE_TONER_CLOUD', [6, 1, 9, 3], 0.18)],
    vignette: 'Four machines, one queue, and a note reading "use the one on the left".',
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_W',
    roles: combatRoles,
    // A broken diagonal: partial cover that never fully crosses the room.
    interior: rects([
      [4, 2, 2, 1], [6, 3, 2, 1], [8, 4, 2, 1],
      [12, 6, 2, 1], [14, 7, 2, 1], [16, 8, 2, 1],
    ]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL'],
    decorationSets: ['GENERIC', 'CARPET_GRID'],
    objectAnchors: [
      at(5, 2, DESK, 0.6),
      at(15, 7, DESK, 0.6),
      at(10, 5, STAIN, 0.3),
    ],
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X1_X',
    roles: combatRoles,
    // Cubicles pushed to the walls, plaza in the middle: the readable default for
    // a big encounter that still needs somewhere to break line of sight.
    interior: rects([
      [2, 1, 3, 2], [16, 1, 3, 2], [2, 8, 3, 2], [16, 8, 3, 2],
      [6, 1, 3, 1], [12, 1, 3, 1], [6, 9, 3, 1], [12, 9, 3, 1],
    ]),
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'OPEN_CENTRE', 'WALL_PERIMETER'],
    socketOpts: { secretSides: ['NORTH', 'EAST', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(3, 1, DESK, 0.7),
      at(17, 8, DESK, 0.7),
      at(7, 1, CABINET, 0.5),
      at(13, 9, CABINET, 0.5),
    ],
    weight: 1.6,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Normal empty / story (ROOM-002) — F.3 minimum 8
// ---------------------------------------------------------------------------
// Architecture that reads as a scene rather than an arena. These declare no
// encounter tags, so the encounter layer has nothing compatible to place and the
// room stays empty — GDD 12.2's "an empty version is valid" expressed as data
// rather than as a special case in the room state machine. Every vignette is an
// original scene in the spirit of GDD 12.6, and none of the props sit where they
// could hide a door, a pickup or a telegraph (R-ROM-004).

const storyRoles = [ROOM_ROLE.WORKROOM, 'NORMAL', 'SAFE'];

const storyPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_A',
    roles: storyRoles,
    // The table is the room. Sight lines around it stay open on all four sides.
    interior: rects([[7, 4, 7, 3]]),
    socketOpts: { secretSides: ['NORTH', 'WEST'] },
    decorationSets: ['MEETING_AFTERMATH', 'CARPET_GRID'],
    objectAnchors: [
      at(10, 5, DESK, 0.95),
      at(6, 4, CHAIR, 0.8, 'TIPPED'),
      at(14, 6, CHAIR, 0.8),
      at(6, 7, CHAIR, 0.6),
      at(16, 2, BOARD, 0.8),
      at(9, 8, STAIN, 0.6),
    ],
    hazardAnchors: [haz('HAZ-SPILL_DRY_STAIN', [8, 8, 5, 2], 0.5)],
    vignette: 'Fourteen chairs, one still turning. The agenda ends at "quick update" and the room booking says it never released.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_B',
    roles: storyRoles,
    // Paper drifts are low cover: you wade, you do not climb.
    interior: layers(
      rects([[9, 4, 3, 3]]),
      rects([[3, 2, 4, 2], [14, 2, 4, 2], [3, 7, 4, 2], [14, 7, 4, 2]], LOW),
    ),
    decorationSets: ['PAPER_OVERFLOW', 'PRINT_STATION'],
    objectAnchors: [
      at(10, 5, PRINTER, 0.95, 'OVERFLOWING'),
      at(4, 2, PAPER, 0.9),
      at(16, 8, PAPER, 0.9),
      at(4, 8, BIN, 0.6, 'OVERFLOWING'),
      at(17, 2, PAPER, 0.7),
    ],
    hazardAnchors: [haz('HAZ-PAPER_DRIFT_BANK', [3, 7, 5, 2], 0.4)],
    vignette: 'The copier finished a job nobody collected: four thousand pages of one blank slide, still warm.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_C',
    roles: storyRoles,
    // Two tables shoved together for a party that stopped mid-sentence.
    interior: rects([[8, 3, 5, 1], [8, 7, 5, 1]]),
    socketOpts: { secretSides: ['EAST', 'SOUTH'] },
    decorationSets: ['CELEBRATION_LEFTOVERS', 'BREAK_AREA'],
    objectAnchors: [
      at(10, 3, DESK, 0.9),
      at(10, 7, DESK, 0.9),
      at(6, 5, CHAIR, 0.7, 'TIPPED'),
      at(15, 5, BIN, 0.7, 'OVERFLOWING'),
      at(4, 2, PLANT, 0.5),
      at(13, 9, STAIN, 0.5),
    ],
    vignette: 'A sheet cake with two slices gone and a leaving card open at the page where the signatures stop.',
    weight: 0.7,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_D',
    roles: storyRoles,
    // Two rack runs make an aisle with alleys behind them; the aisle is the story.
    interior: rects([[3, 1, 2, 9], [17, 1, 2, 9]]),
    decorationSets: ['OVERTIME_NEST', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(3, 3, RACK, 0.9),
      at(17, 6, RACK, 0.9),
      at(10, 7, DESK, 0.8),
      at(11, 8, CHAIR, 0.6),
      at(8, 2, COFFEE, 0.5),
      at(13, 2, CABLES, 0.5),
    ],
    hazardAnchors: [haz('HAZ-CABLE_TRIP_BUNDLE', [8, 4, 6, 3], 0.25)],
    vignette: 'Somebody built a bed from a desk and two coats in the server aisle, and set an alarm for 04:50.',
    weight: 0.7,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_E',
    roles: storyRoles,
    // A pinboard wall with a gap in the middle: the gap is the entrance.
    interior: rects([[2, 1, 7, 1], [12, 1, 7, 1]]),
    socketOpts: { secretSides: ['SOUTH', 'EAST', 'WEST'] },
    decorationSets: ['LOST_PROPERTY', 'CARPET_GRID'],
    objectAnchors: [
      at(5, 1, BOARD, 0.9),
      at(15, 1, BOARD, 0.9),
      at(10, 6, DESK, 0.6),
      at(3, 8, BIN, 0.5),
      at(17, 8, PLANT, 0.5, 'DUSTY'),
    ],
    vignette: 'A wall of leaving cards, each signed by fewer people than the one beside it.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_F',
    roles: storyRoles,
    interior: rects([[2, 2, 2, 2], [2, 7, 2, 2], [17, 2, 2, 2], [17, 7, 2, 2]], LOW),
    decorationSets: ['DEAD_PLANTS', 'CARPET_GRID'],
    objectAnchors: [
      at(2, 2, PLANT, 0.9, 'DUSTY'),
      at(2, 8, PLANT, 0.9, 'DUSTY'),
      at(18, 2, PLANT, 0.9, 'DUSTY'),
      at(18, 8, PLANT, 0.6),
      at(10, 5, COOLER, 0.5),
    ],
    hazardAnchors: [haz('HAZ-SPILL_WATER_SLICK', [9, 4, 4, 3], 0.2)],
    vignette: 'The watering rota ended in March. One planter is thriving and nobody will admit to it.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_G',
    roles: storyRoles,
    interior: rects([
      [4, 2, 3, 1], [4, 4, 3, 1], [4, 6, 3, 1], [4, 8, 3, 1],
      [14, 2, 3, 1], [14, 4, 3, 1], [14, 6, 3, 1], [14, 8, 3, 1],
    ]),
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['HOT_DESKING', 'CARPET_GRID'],
    objectAnchors: [
      at(5, 2, DESK, 0.9),
      at(5, 6, DESK, 0.9),
      at(15, 4, DESK, 0.9),
      at(15, 8, DESK, 0.9),
      at(10, 5, CHAIR, 0.5),
      at(10, 2, STRIP, 0.4),
    ],
    vignette: 'Eight clean desks with the name labels peeled off and the adhesive shadow left behind.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORY_1X1_H',
    roles: storyRoles,
    interior: rects([[5, 1, 3, 1], [13, 1, 3, 1], [5, 9, 3, 1], [13, 9, 3, 1]]),
    decorationSets: ['GENERIC', 'MAINTENANCE_GREY'],
    objectAnchors: [
      at(6, 1, CHAIR, 0.9),
      at(14, 9, CHAIR, 0.9),
      at(2, 5, EXTINGUISHER, 0.7),
      at(18, 5, BOARD, 0.6),
      at(10, 5, STAIN, 0.4),
    ],
    vignette: 'Chairs stacked four high against the walls for a drill that was cancelled and never rescheduled.',
    weight: 0.9,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Hallways and tiny rooms (ROOM-003) — F.3 minimum 12
// ---------------------------------------------------------------------------
// The generator turns a `tiny` size roll into ROOM-003, and it may then hang a
// door on any of the four sides, so a corridor here is never a single straight
// run: each layout is a small *network* that reaches all four edge midpoints.
// That is what lets one authored hallway serve as dead end, corner, T or
// crossroads (GDD 11.6) without a second template per door pattern.
//
// Tiny rooms are also the natural neighbours of a secret, so most of them offer
// blast sides; the carved corridors guarantee the blast point opens onto floor.

const hallRoles = [ROOM_ROLE.HALLWAY, 'COMBAT_CAPABLE', 'HALLWAY', 'TINY'];
const hallQuietRoles = [ROOM_ROLE.HALLWAY, 'HALLWAY', 'TINY', 'CORRIDOR'];

const hallPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_A',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    interior: carve([[0, 5, 21, 1], [10, 0, 1, 11]]),
    encounterTags: ['TINY', 'HALLWAY', 'TIGHT_CORRIDOR_ONLY'],
    socketOpts: { secretSides: ['NORTH', 'EAST', 'SOUTH', 'WEST'] },
    decorationSets: ['CARPET_GRID', 'FLUORESCENT_FLICKER'],
    objectAnchors: [at(4, 5, EXTINGUISHER, 0.4), at(16, 5, BOARD, 0.3)],
    weight: 1.6,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_B',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    interior: carve([[0, 4, 21, 3], [9, 0, 3, 11]]),
    encounterTags: ['TINY', 'HALLWAY', 'DASH_LANE'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['CARPET_GRID', 'GENERIC'],
    objectAnchors: [at(4, 4, PLANT, 0.5), at(16, 6, BIN, 0.5), at(10, 8, STAIN, 0.3)],
    weight: 2.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_C',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    // A loop around a sealed core: two ways to everywhere, so nothing corners you.
    // The ring is three tiles wide so every declared spawn zone still lands on
    // floor — a one-tile ring would isolate them (R-ENM-008).
    interior: rects([[3, 3, 15, 5]]),
    spawnInset: 1,
    encounterTags: ['TINY', 'HALLWAY', 'WALL_PERIMETER'],
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['CARPET_GRID', 'MAINTENANCE_GREY'],
    objectAnchors: [at(5, 1, CABINET, 0.5), at(15, 9, BIN, 0.5)],
    vignette: 'A corridor that goes all the way around a room with no door in it.',
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_D',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    interior: carve([[0, 4, 21, 3], [9, 0, 3, 5], [6, 7, 9, 4]]),
    encounterTags: ['TINY', 'HALLWAY'],
    socketOpts: { secretSides: ['SOUTH', 'WEST'] },
    decorationSets: ['BREAK_AREA', 'CARPET_GRID'],
    objectAnchors: [at(8, 8, COOLER, 0.6), at(13, 8, BIN, 0.5), at(2, 5, PLANT, 0.4)],
    hazardAnchors: [haz('HAZ-SPILL_WATER_SLICK', [7, 7, 4, 3], 0.25)],
    vignette: 'The water cooler bay, where two people at once is a negotiation.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_E',
    roles: [...hallQuietRoles],
    tiny: true,
    // A genuine dogleg: no shot crosses this room end to end.
    interior: carve([
      [0, 4, 7, 3], [4, 1, 3, 6], [4, 1, 12, 3], [9, 0, 3, 3],
      [13, 1, 3, 9], [13, 4, 8, 3], [9, 7, 7, 3], [9, 8, 3, 3],
    ]),
    socketOpts: { secretSides: ['NORTH', 'EAST', 'SOUTH', 'WEST'] },
    decorationSets: ['MAINTENANCE_GREY', 'FLUORESCENT_FLICKER'],
    objectAnchors: [at(5, 2, CABINET, 0.5), at(14, 8, CART, 0.4), at(1, 5, EXTINGUISHER, 0.4)],
    vignette: 'A route that was a straight corridor until three teams each needed a wall.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_F',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    interior: carve([
      [0, 4, 21, 3], [9, 0, 3, 11],
      [2, 1, 3, 3], [16, 1, 3, 3], [2, 7, 3, 3], [16, 7, 3, 3],
    ]),
    encounterTags: ['TINY', 'HALLWAY', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH', 'EAST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(3, 2, DESK, 0.6), at(17, 2, CABINET, 0.6),
      at(3, 8, PAPER, 0.5), at(17, 8, PLANT, 0.5),
    ],
    vignette: 'Four one-person nooks off a crossroads; three still have a mug in them.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_G',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    interior: carve(
      [[0, 3, 21, 5], [9, 0, 3, 11]],
      rects([[5, 5, 1, 1], [15, 5, 1, 1], [10, 3, 1, 1], [10, 7, 1, 1]]),
    ),
    encounterTags: ['TINY', 'HALLWAY', 'DASH_LANE'],
    socketOpts: { secretSides: ['WEST', 'EAST'] },
    decorationSets: ['CARPET_GRID', 'GENERIC'],
    objectAnchors: [at(5, 5, PLANT, 0.6), at(15, 5, PLANT, 0.6), at(10, 3, BIN, 0.4)],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_H',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    interior: carve([[0, 3, 21, 3], [9, 0, 3, 4], [9, 6, 3, 5], [15, 6, 6, 3]]),
    encounterTags: ['TINY', 'HALLWAY'],
    socketOpts: { secretSides: ['SOUTH', 'EAST'] },
    decorationSets: ['PRINT_STATION', 'CARPET_GRID'],
    objectAnchors: [at(17, 7, PRINTER, 0.6), at(19, 7, PAPER, 0.5), at(3, 4, BIN, 0.4)],
    hazardAnchors: [haz('HAZ-MACHINE_TONER_CLOUD', [15, 6, 5, 3], 0.15)],
    vignette: 'The print bay that ended up in a corridor because the floor plan ran out of rooms.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_I',
    roles: [...hallRoles],
    tiny: true,
    interior: carve([[0, 5, 21, 1], [10, 0, 1, 11], [2, 6, 5, 4], [14, 1, 5, 4]]),
    encounterTags: ['TINY', 'HALLWAY', 'TIGHT_CORRIDOR_ONLY'],
    socketOpts: { secretSides: ['NORTH', 'WEST'] },
    decorationSets: ['LOST_PROPERTY', 'CARPET_GRID'],
    objectAnchors: [at(4, 7, CABINET, 0.6), at(16, 2, SHELF, 0.6), at(10, 5, STAIN, 0.3)],
    vignette: 'Two bays of lost property either side of a corridor one person wide.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_J',
    roles: [...hallRoles, 'CORRIDOR'],
    tiny: true,
    // Two parallel runs joined at both ends: the classic office racetrack.
    interior: carve([
      [0, 2, 21, 2], [0, 7, 21, 2], [0, 2, 2, 7], [19, 2, 2, 7],
      [9, 0, 3, 3], [9, 7, 3, 4],
    ]),
    encounterTags: ['TINY', 'HALLWAY', 'DASH_LANE'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH', 'EAST', 'WEST'] },
    decorationSets: ['CARPET_GRID', 'CUBICLE_FARM'],
    objectAnchors: [at(6, 2, DIVIDER, 0.5), at(14, 8, DIVIDER, 0.5), at(2, 3, PLANT, 0.4)],
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_K',
    roles: [...hallQuietRoles],
    tiny: true,
    interior: carve([[0, 4, 21, 3], [9, 0, 3, 5], [9, 7, 3, 4], [2, 1, 2, 3], [17, 7, 2, 3]]),
    socketOpts: { secretSides: ['NORTH', 'EAST', 'SOUTH', 'WEST'] },
    decorationSets: ['MAINTENANCE_GREY', 'GENERIC'],
    objectAnchors: [at(2, 2, CABINET, 0.5), at(18, 8, CART, 0.5), at(10, 5, CABLES, 0.3)],
    vignette: 'A service run with two nooks the floor plan labels "riser" and does not draw.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_HALLWAY_1X1_L',
    roles: [...hallRoles],
    tiny: true,
    // A small open landing rather than a corridor: the light, quick room.
    interior: corners(2),
    encounterTags: ['TINY', 'HALLWAY', 'OPEN_CENTRE'],
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['CARPET_GRID', 'GENERIC'],
    objectAnchors: [at(2, 2, PLANT, 0.5), at(18, 8, BIN, 0.5), at(10, 5, STAIN, 0.3)],
    weight: 1.8,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Double rooms — F.3 minimum 10
// ---------------------------------------------------------------------------
// Two cells: 43x11 laid out east-west, or 21x23 laid out north-south. These carry
// ROOM-002 as well as LARGE_ROOM because the generator attaches a `double` size
// roll as an ordinary workroom and only relabels three-cell rooms as ROOM-004.
//
// The extra length is the design opportunity: a 43-wide room can hold a firing
// lane no single cell can, and a 23-tall room can stack two distinct fights.
// Spawn inset 3 pushes ranged spawns deep enough that the far end matters.

const doubleRoles = [ROOM_ROLE.WORKROOM, 'COMBAT_CAPABLE', 'NORMAL', 'LARGE_ROOM'];

const doublePack = [
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_2X1_A',
    roles: doubleRoles,
    cells: CELLS_2X1,
    interior: cubicleRows({ spacing: 6 }),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(6, 4, DIVIDER, 0.9), at(18, 7, DIVIDER, 0.9), at(30, 4, DIVIDER, 0.9),
      at(36, 8, DIVIDER, 0.8), at(2, 5, PLANT, 0.4), at(40, 2, BIN, 0.4),
    ],
    vignette: 'Six identical aisles; the wayfinding sign at the end says only "row 4".',
    weight: 1.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_2X1_B',
    roles: doubleRoles,
    cells: CELLS_2X1,
    // Glazed spine on the cell seam: one room to walk, two rooms to shoot in.
    interior: layers(
      rects([[21, 1, 1, 9]], LOW),
      rects([[6, 3, 3, 2], [34, 6, 3, 2]]),
    ),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['GLASS_PARTITIONS', 'MEETING_AFTERMATH'],
    objectAnchors: [
      at(21, 3, GLASS, 0.9), at(21, 8, GLASS, 0.9),
      at(7, 3, DESK, 0.7), at(35, 6, DESK, 0.7), at(28, 2, BOARD, 0.5),
    ],
    hazardAnchors: [haz('HAZ-GLASS_SHARD_FIELD', [20, 2, 3, 7], 0.15)],
    vignette: 'A glass wall dropped down the middle of one room so it could be booked as two.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_2X1_C',
    roles: doubleRoles,
    cells: CELLS_2X1,
    // Three long lanes with one crossing in the middle: the longest sight lines
    // in the department, and a real reason to close distance.
    interior: dividersH([3, 7], [20, 21, 22]),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'DASH_LANE'],
    socketOpts: { secretSides: ['NORTH', 'EAST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(8, 3, DIVIDER, 0.9), at(34, 7, DIVIDER, 0.9),
      at(21, 5, CHAIR, 0.4), at(2, 9, BIN, 0.4),
    ],
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_2X1_D',
    roles: doubleRoles,
    cells: CELLS_2X1,
    interior: pillars({ stepX: 6, stepY: 4 }),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'DASH_LANE', 'OPEN_CENTRE'],
    socketOpts: { secretSides: ['SOUTH', 'WEST'] },
    decorationSets: ['CARPET_GRID', 'GENERIC'],
    objectAnchors: [
      at(12, 4, PLANT, 0.4), at(24, 8, PLANT, 0.4),
      at(30, 4, EXTINGUISHER, 0.4), at(6, 8, STAIN, 0.3),
    ],
    weight: 1.5,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_2X1_E',
    roles: doubleRoles,
    cells: CELLS_2X1,
    // Three chambers, four ways between each pair: pressure without a trap.
    interior: dividersV([14, 28], [3, 7]),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY', 'TIGHT_CORRIDOR_ONLY'],
    decorationSets: ['CUBICLE_FARM', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(14, 5, DIVIDER, 0.9), at(28, 5, DIVIDER, 0.9),
      at(7, 2, DESK, 0.6), at(36, 8, DESK, 0.6),
    ],
    vignette: 'Two partitions turned one floor into three teams who stopped speaking.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_2X1_F',
    roles: doubleRoles,
    cells: CELLS_2X1,
    // Four bays of filing, centre row clear: cover everywhere, lanes nowhere.
    interior: rects([
      [4, 2, 4, 2], [4, 7, 4, 2], [14, 2, 4, 2], [14, 7, 4, 2],
      [25, 2, 4, 2], [25, 7, 4, 2], [35, 2, 4, 2], [35, 7, 4, 2],
    ]),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH', 'EAST', 'WEST'] },
    decorationSets: ['RECORDS_ROWS', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(5, 2, CABINET, 0.9), at(15, 8, CABINET, 0.9),
      at(26, 2, CABINET, 0.9), at(36, 8, CABINET, 0.9),
      at(21, 5, CART, 0.4), at(10, 5, PAPER, 0.4),
    ],
    vignette: 'Filing for a retention policy nobody has read since the cabinets were bought.',
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X2_A',
    roles: doubleRoles,
    cells: CELLS_1X2,
    interior: centreIsland(5, 5),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'WALL_PERIMETER'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['GENERIC', 'CARPET_GRID'],
    objectAnchors: [
      at(9, 10, COOLER, 0.7), at(11, 12, PLANT, 0.6),
      at(3, 4, DESK, 0.5), at(17, 18, DESK, 0.5),
    ],
    hazardAnchors: [haz('HAZ-SPILL_WATER_SLICK', [7, 8, 7, 7], 0.2)],
    vignette: 'A two-storey light well with a service core in the middle and a rota taped to it.',
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X2_B',
    roles: doubleRoles,
    cells: CELLS_1X2,
    interior: laneDividers({ spacing: 6 }),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(6, 6, DIVIDER, 0.9), at(12, 12, DIVIDER, 0.9), at(9, 18, DIVIDER, 0.9),
      at(19, 3, PLANT, 0.4), at(1, 20, BIN, 0.4),
    ],
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X2_C',
    roles: doubleRoles,
    cells: CELLS_1X2,
    // Desk blocks stepping down the room: every fight is fought at an angle.
    interior: rects([
      [3, 2, 4, 2], [8, 6, 4, 2], [13, 10, 4, 2], [8, 14, 4, 2], [3, 18, 4, 2],
    ]),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'EAST'] },
    decorationSets: ['HOT_DESKING', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 2, DESK, 0.8), at(9, 6, DESK, 0.8), at(14, 10, DESK, 0.8),
      at(9, 14, DESK, 0.8), at(4, 18, DESK, 0.8), at(17, 20, CHAIR, 0.4),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NORMAL_1X2_D',
    roles: doubleRoles,
    cells: CELLS_1X2,
    // A print bank across the waist: two fights joined by two flanking routes.
    interior: rects([[6, 10, 9, 3]]),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'DASH_LANE'],
    socketOpts: { secretSides: ['SOUTH', 'WEST'] },
    decorationSets: ['PRINT_STATION', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(7, 11, PRINTER, 0.9), at(13, 11, PRINTER, 0.9),
      at(10, 11, PAPER, 0.7, 'OVERFLOWING'), at(3, 14, BIN, 0.5), at(17, 8, PLANT, 0.4),
    ],
    hazardAnchors: [haz('HAZ-MACHINE_TONER_CLOUD', [5, 9, 11, 5], 0.18)],
    vignette: 'The print bank splits the floor in half, and both halves blame the other for the queue.',
    weight: 1.2,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Large and L-shaped rooms (ROOM-004) — F.3 minimum 8
// ---------------------------------------------------------------------------
// Three or four cells. All four L rotations exist so the generator can fit a
// large room into whatever corner the graph leaves free, plus a 3x1 gallery for
// the rare long run. `buildGeometry` walls off the missing cell of an L on its
// own, so the concave corner is derived, not drawn.

const largeRoles = [ROOM_ROLE.WORKROOM, ROOM_ROLE.LARGE_WORKROOM, 'COMBAT_CAPABLE', 'LARGE_ROOM'];

const largePack = [
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_2X2_A',
    roles: largeRoles,
    cells: CELLS_2X2,
    interior: quadrantCover(6, 3),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'OPEN_CENTRE'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(7, 7, DESK, 0.8), at(35, 7, DESK, 0.8), at(7, 15, DESK, 0.8), at(35, 15, DESK, 0.8),
      at(21, 11, BOARD, 0.4), at(2, 11, PLANT, 0.4), at(40, 11, BIN, 0.4),
    ],
    vignette: 'The whole floorplate, four desk clusters, and a plaza in the middle for announcements.',
    weight: 1.6,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_2X2_B',
    roles: largeRoles,
    cells: CELLS_2X2,
    interior: pillars({ stepX: 7, stepY: 5 }),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'DASH_LANE', 'OPEN_CENTRE'],
    socketOpts: { secretSides: ['EAST', 'WEST'] },
    decorationSets: ['CARPET_GRID', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(14, 10, PLANT, 0.4), at(28, 15, PLANT, 0.4),
      at(7, 20, EXTINGUISHER, 0.4), at(35, 5, STAIN, 0.3),
    ],
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_2X2_C',
    roles: largeRoles,
    cells: CELLS_2X2,
    // Cubicle city with a plaza carved back out of it. The forced-floor rect is
    // layered before the painter so the plaza always wins.
    interior: layers(rects([[15, 8, 14, 7]], FLOOR), cubicleRows({ spacing: 5 })),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'EAST', 'SOUTH', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'HOT_DESKING'],
    objectAnchors: [
      at(5, 4, DIVIDER, 0.9), at(10, 16, DIVIDER, 0.9), at(35, 4, DIVIDER, 0.9),
      at(40, 19, DIVIDER, 0.8), at(21, 11, COFFEE, 0.6), at(24, 12, CHAIR, 0.5),
    ],
    vignette: 'Eight aisles of cubicles and one clearing with a coffee machine at the centre of it.',
    weight: 0.6,
    minDepth: 2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_L2X2_A',
    roles: largeRoles,
    cells: CELLS_L_NE,
    interior: quadrantCover(5, 3),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['NORTH', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(6, 6, DESK, 0.8), at(36, 6, DESK, 0.8), at(6, 16, DESK, 0.8),
      at(21, 3, BOARD, 0.4), at(15, 20, BIN, 0.4),
    ],
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_L2X2_B',
    roles: largeRoles,
    cells: CELLS_L_SE,
    interior: laneDividers({ spacing: 5 }),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY', 'DASH_LANE'],
    socketOpts: { secretSides: ['SOUTH', 'WEST'] },
    decorationSets: ['CUBICLE_FARM', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(8, 5, DIVIDER, 0.8), at(30, 10, DIVIDER, 0.8), at(30, 20, DIVIDER, 0.8),
      at(24, 15, PAPER, 0.5), at(2, 2, PLANT, 0.4),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_L2X2_C',
    roles: largeRoles,
    cells: CELLS_L_SW,
    interior: pillars({ stepX: 6, stepY: 6 }),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'OPEN_CENTRE'],
    socketOpts: { secretSides: ['NORTH', 'EAST'] },
    decorationSets: ['CARPET_GRID', 'GENERIC'],
    objectAnchors: [
      at(12, 12, PLANT, 0.4), at(6, 18, EXTINGUISHER, 0.4),
      at(30, 18, DESK, 0.5), at(10, 3, DESK, 0.5),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_L2X2_D',
    roles: largeRoles,
    cells: CELLS_L_NW,
    interior: quadrantCover(6, 3),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'COVER_HEAVY'],
    socketOpts: { secretSides: ['SOUTH', 'EAST'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(35, 7, DESK, 0.8), at(7, 15, DESK, 0.8), at(35, 15, DESK, 0.8),
      at(28, 20, CHAIR, 0.4), at(24, 3, BIN, 0.4),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LARGE_3X1_A',
    roles: largeRoles,
    cells: CELLS_3X1,
    // The gallery: 65 world units wide, two dividers, three very long lanes.
    interior: laneDividers({ spacing: 4 }),
    spawnInset: 3,
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'DASH_LANE'],
    socketOpts: { secretSides: ['NORTH', 'SOUTH'] },
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(10, 4, DIVIDER, 0.8), at(32, 8, DIVIDER, 0.8), at(54, 4, DIVIDER, 0.8),
      at(2, 5, PLANT, 0.4), at(62, 5, BIN, 0.4), at(43, 2, BOARD, 0.4),
    ],
    vignette: 'A hundred desks in a straight line, and one office at the far end with a door.',
    weight: 0.8,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Supply Closet (ROOM-005) — F.3 minimum 4
// ---------------------------------------------------------------------------
// One pedestal from the Supply Closet pool (GDD 12.5), so the derived REWARD zone
// at the room centre must stay clear in every layout. Sockets accept the whole
// gated set because `floor.supplyClosetCost` is free on Open Office I and one
// Access Card everywhere afterwards (GDD 9.4, ROOM-005).

const supplyPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_SUPPLY_1X1_A',
    roles: [ROOM_ROLE.SUPPLY_CLOSET, 'SPECIAL', 'PEDESTAL', 'SAFE'],
    interior: rects([
      [2, 1, 4, 1], [2, 3, 4, 1], [15, 1, 4, 1], [15, 3, 4, 1],
      [2, 7, 4, 1], [2, 9, 4, 1], [15, 7, 4, 1], [15, 9, 4, 1],
    ]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['SUPPLY_SHELVING', 'GENERIC'],
    objectAnchors: [
      at(3, 1, SHELF, 0.9), at(17, 3, SHELF, 0.9), at(3, 9, SHELF, 0.9),
      at(17, 7, CABINET, 0.7), at(7, 8, CART, 0.5),
    ],
    vignette: 'Shelves labelled by quarter. Everything after Q2 is empty and still labelled.',
    weight: 1.6,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_SUPPLY_1X1_B',
    roles: [ROOM_ROLE.SUPPLY_CLOSET, 'SPECIAL', 'PEDESTAL', 'SAFE'],
    interior: rects([[3, 2, 2, 3], [16, 6, 2, 3], [7, 8, 3, 1], [12, 2, 3, 1]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['SUPPLY_SHELVING', 'LOST_PROPERTY'],
    objectAnchors: [
      at(3, 3, SHELF, 0.8, 'RANSACKED'), at(17, 7, CABINET, 0.8, 'RANSACKED'),
      at(8, 8, CART, 0.6, 'TIPPED'), at(13, 2, BIN, 0.6, 'OVERFLOWING'),
      at(6, 5, PAPER, 0.5),
    ],
    vignette: 'Somebody took what they needed and left the door swinging; the sign-out sheet is untouched.',
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_SUPPLY_1X1_C',
    roles: [ROOM_ROLE.SUPPLY_CLOSET, 'SPECIAL', 'PEDESTAL', 'SAFE'],
    // Boxes to the ceiling as low cover: you can wade in, you cannot see out.
    interior: rects([[2, 1, 5, 3], [14, 1, 5, 3], [2, 7, 5, 3], [14, 7, 5, 3]], LOW),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['PAPER_OVERFLOW', 'SUPPLY_SHELVING'],
    objectAnchors: [
      at(3, 2, PAPER, 0.9), at(17, 2, PAPER, 0.9), at(3, 8, PAPER, 0.9),
      at(17, 8, SHELF, 0.7), at(10, 2, BIN, 0.4),
    ],
    hazardAnchors: [haz('HAZ-PAPER_DRIFT_BANK', [2, 7, 5, 3], 0.3)],
    vignette: 'Overflow storage, stacked to the ceiling tiles, with a narrow path worn through it.',
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_SUPPLY_1X1_D',
    roles: [ROOM_ROLE.SUPPLY_CLOSET, 'SPECIAL', 'PEDESTAL', 'SAFE'],
    // A cage with one way in: the pedestal sits inside it.
    interior: rects([
      [4, 2, 5, 1], [12, 2, 5, 1], [4, 8, 5, 1], [12, 8, 5, 1],
      [4, 3, 1, 5], [16, 3, 1, 5],
    ]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['SUPPLY_SHELVING', 'GENERIC'],
    objectAnchors: [
      at(6, 2, SHELF, 0.9), at(14, 8, SHELF, 0.9),
      at(4, 5, LOCKBOX, 0.6), at(16, 5, LOCKBOX, 0.6), at(2, 8, CART, 0.4),
    ],
    vignette: 'A mesh cage for the expensive stationery, padlocked to a bracket that came away years ago.',
    weight: 1.0,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Shop (ROOM-006) — F.3 minimum 4
// ---------------------------------------------------------------------------
// Data-defined stock with visible prices (GDD 12.5), so the layouts differ in how
// the stock is *presented*: a counter, a machine wall, a stall, an honour table.
// None of them narrows the room enough to hide a price tag behind an object.

const shopPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_SHOP_1X1_A',
    roles: [ROOM_ROLE.SHOP, 'SPECIAL', 'SHOP', 'SAFE'],
    interior: rects([[6, 3, 9, 1]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['SHOPFRONT', 'GENERIC'],
    objectAnchors: [
      at(10, 3, DESK, 0.9), at(7, 2, SHELF, 0.7), at(14, 2, SHELF, 0.7),
      at(3, 8, PLANT, 0.5), at(17, 8, BIN, 0.4),
    ],
    vignette: 'A counter, a card reader, and a laminated price list corrected three times in biro.',
    weight: 1.6,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_SHOP_1X1_B',
    roles: [ROOM_ROLE.SHOP, 'SPECIAL', 'SHOP', 'SAFE'],
    interior: rects([[2, 1, 5, 2], [14, 1, 5, 2]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['SHOPFRONT', 'BREAK_AREA'],
    objectAnchors: [
      at(3, 1, VENDING, 0.9), at(16, 1, VENDING, 0.9),
      at(10, 8, COOLER, 0.6), at(6, 8, BIN, 0.5),
    ],
    hazardAnchors: [haz('HAZ-ELEC_OUTLET_SPARK', [2, 1, 5, 3], 0.15)],
    vignette: 'Two machines, one working keypad, and an out-of-order note that predates the machines.',
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_SHOP_1X1_C',
    roles: [ROOM_ROLE.SHOP, 'SPECIAL', 'SHOP', 'SAFE'],
    interior: rects([[3, 3, 2, 5], [16, 3, 2, 5]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['SHOPFRONT', 'CUBICLE_FARM'],
    objectAnchors: [
      at(3, 4, SHELF, 0.8), at(17, 6, SHELF, 0.8),
      at(10, 4, CART, 0.7), at(10, 8, BOARD, 0.5),
    ],
    vignette: 'A stall run out of a cleared cubicle; the dividers are still numbered for the old occupant.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_SHOP_1X1_D',
    roles: [ROOM_ROLE.SHOP, 'SPECIAL', 'SHOP', 'SAFE'],
    interior: rects([[8, 4, 5, 3]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['SHOPFRONT', 'BREAK_AREA'],
    objectAnchors: [
      at(10, 5, DESK, 0.9), at(8, 2, SHELF, 0.6), at(13, 8, LOCKBOX, 0.6),
      at(3, 5, PLANT, 0.4), at(17, 2, BOARD, 0.5),
    ],
    vignette: 'An honour-system table with a tin, a tally sheet, and a tally that stops in week three.',
    weight: 1.2,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Maintenance Access (ROOM-012) — F.3 minimum 8
// ---------------------------------------------------------------------------
// Blast-only entrances (GDD 11.7): sockets accept BLAST_SECRET and nothing else,
// so the generator can never wire one of these into the ordinary graph. The
// layouts belong to the building rather than to the company — risers, cable runs,
// the space between two walls — which is what sells the reveal.
//
// The door-clear guard matters most here: 11.7 requires the blast point to open
// onto floor, and `checkBlastPoints` rejects a pit or a certain object on it.

const secretDoor = { classes: [DOOR_CLASS.BLAST_SECRET] };

const maintPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_A',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET', 'COMBAT_CAPABLE'],
    interior: pillars({ stepX: 4, stepY: 3 }),
    socketOpts: secretDoor,
    encounterTags: ['COMBAT_CAPABLE', 'TIGHT_CORRIDOR_ONLY'],
    decorationSets: ['MAINTENANCE_GREY', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(4, 3, RACK, 0.6), at(12, 6, CABLES, 0.7), at(16, 3, STRIP, 0.5),
      at(8, 8, BIN, 0.4),
    ],
    hazardAnchors: [haz('HAZ-DARKNESS_OUTAGE_ZONE', [3, 2, 15, 7], 0.3)],
    vignette: 'A riser shaft with four service tags on the wall and no light fitting at all.',
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_B',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET'],
    interior: rects([[3, 2, 4, 2], [14, 2, 4, 2], [3, 7, 4, 2], [14, 7, 4, 2]], LOW),
    socketOpts: secretDoor,
    decorationSets: ['MAINTENANCE_GREY', 'GENERIC'],
    objectAnchors: [
      at(4, 2, CABLES, 0.9), at(16, 8, CABLES, 0.9),
      at(10, 5, STRIP, 0.6), at(17, 2, RACK, 0.5),
    ],
    hazardAnchors: [haz('HAZ-CABLE_TRIP_BUNDLE', [3, 2, 15, 7], 0.35)],
    vignette: 'Coils of cable for a network upgrade that was descoped, still bagged and dated.',
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_C',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET'],
    // Literally the space between two walls: a corridor network with two nooks.
    interior: carve([[0, 4, 21, 3], [9, 0, 3, 11], [2, 1, 3, 3], [16, 7, 3, 3]]),
    spawnInset: 1,
    socketOpts: secretDoor,
    decorationSets: ['MAINTENANCE_GREY', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(3, 2, CABINET, 0.6), at(17, 8, CART, 0.6), at(10, 5, CABLES, 0.4),
    ],
    vignette: 'The gap between two partitions, wide enough for one person and a ladder.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_D',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET'],
    interior: rects([[2, 1, 3, 2], [2, 8, 3, 2], [16, 1, 3, 2], [16, 8, 3, 2], [9, 4, 3, 3]]),
    socketOpts: secretDoor,
    decorationSets: ['MAINTENANCE_GREY', 'SUPPLY_SHELVING'],
    objectAnchors: [
      at(3, 1, SHELF, 0.8), at(17, 8, SHELF, 0.8), at(10, 5, COOLER, 0.5),
      at(3, 8, BIN, 0.6), at(17, 1, EXTINGUISHER, 0.6),
    ],
    hazardAnchors: [haz('HAZ-SPILL_WATER_SLICK', [8, 3, 5, 5], 0.3)],
    vignette: 'A mop sink, a bucket rota with four names crossed out, and one still ticked every week.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_E',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET'],
    interior: rects([[2, 1, 7, 1], [12, 1, 7, 1]]),
    socketOpts: secretDoor,
    decorationSets: ['MAINTENANCE_GREY', 'LOST_PROPERTY'],
    objectAnchors: [
      at(5, 1, BOARD, 0.9), at(15, 1, BOARD, 0.9),
      at(10, 7, DESK, 0.6), at(4, 8, CHAIR, 0.5), at(17, 8, PAPER, 0.5),
    ],
    vignette: 'A drawn floor plan of this floor with one room on it that has no door anywhere.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_F',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET', 'COMBAT_CAPABLE'],
    interior: centreIsland(7, 5),
    socketOpts: secretDoor,
    encounterTags: ['COMBAT_CAPABLE', 'WALL_PERIMETER'],
    decorationSets: ['MAINTENANCE_GREY', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(9, 4, RACK, 0.8), at(13, 6, RACK, 0.8), at(2, 5, STRIP, 0.6),
      at(18, 5, CABLES, 0.6),
    ],
    hazardAnchors: [haz('HAZ-ELEC_OUTLET_SPARK', [2, 4, 17, 3], 0.2)],
    vignette: 'An air handler the size of a car, switched off, with a warmth it should not still have.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_G',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET'],
    // A void where the slab was cut. Pits never reach a door: the guard forbids it.
    interior: rects([[7, 3, 3, 5]], PIT),
    socketOpts: secretDoor,
    decorationSets: ['MAINTENANCE_GREY', 'GENERIC'],
    objectAnchors: [
      at(4, 5, CART, 0.6), at(14, 4, PAPER, 0.7), at(16, 8, BIN, 0.5),
      at(12, 2, EXTINGUISHER, 0.4),
    ],
    vignette: 'Rolls of the old carpet, and the hole in the slab that nobody filed a permit for.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_MAINT_1X1_H',
    roles: [ROOM_ROLE.MAINTENANCE_ACCESS, 'SECRET', 'COMBAT_CAPABLE'],
    interior: corners(3),
    socketOpts: secretDoor,
    encounterTags: ['COMBAT_CAPABLE', 'OPEN_CENTRE'],
    decorationSets: ['MAINTENANCE_GREY', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(2, 2, CABINET, 0.8), at(18, 8, CABINET, 0.8), at(2, 8, PAPER, 0.7),
      at(18, 2, LOCKBOX, 0.5), at(10, 5, STAIN, 0.4),
    ],
    hazardAnchors: [haz('HAZ-FIRE_SCORCH_MARK', [8, 4, 5, 3], 0.4)],
    vignette: 'The wall here has been opened and patched before, and the patch is a different colour again.',
    weight: 1.0,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Forgotten Cubicle (ROOM-013) — F.3 minimum 6
// ---------------------------------------------------------------------------
// GDD 12.5: "one authored surprise layout from its room library". Each of these is
// a scene rather than a fight — one cubicle that outlived its occupant, reached by
// blasting a wall near a far dead end.

const cubiclePack = [
  oo({
    id: 'TPL-OPEN_OFFICE_CUBICLE_1X1_A',
    roles: [ROOM_ROLE.FORGOTTEN_CUBICLE, 'SECRET', 'TINY'],
    tiny: true,
    interior: rects([[6, 3, 1, 5], [6, 3, 9, 1], [14, 3, 1, 5]]),
    socketOpts: secretDoor,
    decorationSets: ['OVERTIME_NEST', 'CUBICLE_FARM'],
    objectAnchors: [
      at(10, 6, DESK, 0.95), at(11, 7, CHAIR, 0.8),
      at(8, 5, STRIP, 0.7, 'POWERED'), at(13, 5, PLANT, 0.6),
      at(3, 8, BIN, 0.5),
    ],
    vignette: 'One cubicle, three walls, and a monitor still cycling a screensaver of the company logo.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CUBICLE_1X1_B',
    roles: [ROOM_ROLE.FORGOTTEN_CUBICLE, 'SECRET', 'TINY'],
    tiny: true,
    interior: rects([[3, 2, 3, 2], [3, 7, 3, 2], [15, 2, 3, 2], [15, 7, 3, 2]], LOW),
    socketOpts: secretDoor,
    decorationSets: ['PAPER_OVERFLOW', 'LOST_PROPERTY'],
    objectAnchors: [
      at(4, 2, PAPER, 0.9), at(16, 7, PAPER, 0.9), at(10, 5, DESK, 0.8),
      at(4, 8, CABINET, 0.6), at(16, 2, BOARD, 0.6),
    ],
    vignette: 'Printed tickets stacked by age, the oldest at the bottom, all of them still open.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CUBICLE_1X1_C',
    roles: [ROOM_ROLE.FORGOTTEN_CUBICLE, 'SECRET', 'TINY'],
    tiny: true,
    interior: rects([[4, 3, 13, 1], [4, 7, 13, 1]]),
    socketOpts: secretDoor,
    decorationSets: ['CELEBRATION_LEFTOVERS', 'CUBICLE_FARM'],
    objectAnchors: [
      at(6, 3, CHAIR, 0.9, 'TIPPED'), at(14, 7, CHAIR, 0.9, 'TIPPED'),
      at(10, 5, DESK, 0.7), at(17, 5, BIN, 0.5), at(3, 5, PLANT, 0.4),
    ],
    vignette: 'Rolling chairs stacked into two walls, the way an intern builds a fort on a quiet Friday.',
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CUBICLE_1X1_D',
    roles: [ROOM_ROLE.FORGOTTEN_CUBICLE, 'SECRET', 'TINY'],
    tiny: true,
    interior: rects([[2, 1, 6, 1], [13, 1, 6, 1], [2, 9, 6, 1], [13, 9, 6, 1]]),
    socketOpts: secretDoor,
    decorationSets: ['PAPER_OVERFLOW', 'MAINTENANCE_GREY'],
    objectAnchors: [
      at(4, 1, BOARD, 0.9), at(16, 9, BOARD, 0.9), at(10, 5, DESK, 0.7),
      at(6, 9, PAPER, 0.7), at(15, 1, PAPER, 0.7),
    ],
    vignette: 'Every wall papered with memos, each one marked "for information only" and initialled once.',
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CUBICLE_1X1_E',
    roles: [ROOM_ROLE.FORGOTTEN_CUBICLE, 'SECRET', 'TINY'],
    tiny: true,
    interior: centreIsland(3, 3),
    socketOpts: secretDoor,
    decorationSets: ['DEAD_PLANTS', 'GENERIC'],
    objectAnchors: [
      at(10, 5, PLANT, 0.95), at(4, 3, PLANT, 0.7, 'DUSTY'),
      at(16, 7, PLANT, 0.7, 'DUSTY'), at(4, 8, COOLER, 0.5), at(16, 2, BIN, 0.4),
    ],
    hazardAnchors: [haz('HAZ-SPILL_WATER_SLICK', [8, 3, 5, 5], 0.25)],
    vignette: 'A sealed room with one plant in the middle of it, green to the tip, and a drip feed nobody set up.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CUBICLE_1X1_F',
    roles: [ROOM_ROLE.FORGOTTEN_CUBICLE, 'SECRET', 'TINY'],
    tiny: true,
    interior: rects([[7, 4, 7, 3]]),
    socketOpts: secretDoor,
    decorationSets: ['GENERIC', 'CARPET_GRID'],
    objectAnchors: [
      at(10, 5, DESK, 0.95, 'PRISTINE'), at(6, 5, CHAIR, 0.8, 'PRISTINE'),
      at(14, 3, CABINET, 0.6), at(3, 8, BIN, 0.4), at(17, 2, PLANT, 0.4),
    ],
    vignette: 'A desk squared to the carpet grid, nothing personal on it, and a chair pushed exactly in.',
    weight: 0.9,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Challenge and Crisis (ROOM-009, ROOM-010, ROOM-011) — F.3 minimum 8
// ---------------------------------------------------------------------------
// Rooms whose fight is the point. A Deadline Room seals when its reward is
// accepted and runs waves or a timer (ROOM-009), a Crisis Room hosts an elite
// wave (ROOM-010), and an Unscheduled Review hides a mini-boss behind an
// ordinary-looking door (ROOM-011) — so the two Review layouts are deliberately
// indistinguishable from a workroom until you are inside.
//
// All of them keep a wide entry band and a clear centre: waves need somewhere to
// arrive that is not on top of the player (R-ENM-002) and the reward needs
// somewhere to land.

const challengePack = [
  oo({
    id: 'TPL-OPEN_OFFICE_DEADLINE_1X1_A',
    roles: [ROOM_ROLE.DEADLINE, 'SPECIAL', 'COMBAT_CAPABLE'],
    interior: corners(3),
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'OPEN_CENTRE'],
    decorationSets: ['DEADLINE_WARROOM', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(2, 2, DESK, 0.8), at(18, 8, DESK, 0.8), at(2, 8, PAPER, 0.7),
      at(18, 2, BOARD, 0.7), at(10, 8, BIN, 0.5, 'OVERFLOWING'),
    ],
    vignette: 'A countdown written on the glass in marker, and every number before it wiped out.',
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_DEADLINE_1X1_B',
    roles: [ROOM_ROLE.DEADLINE, 'SPECIAL', 'COMBAT_CAPABLE'],
    interior: pillars({ stepX: 5, stepY: 4 }),
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'DASH_LANE', 'OPEN_CENTRE'],
    decorationSets: ['DEADLINE_WARROOM', 'CARPET_GRID'],
    objectAnchors: [
      at(5, 4, PLANT, 0.4), at(15, 8, EXTINGUISHER, 0.5),
      at(10, 2, BOARD, 0.6), at(3, 8, STAIN, 0.4),
    ],
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_DEADLINE_1X1_C',
    roles: [ROOM_ROLE.DEADLINE, 'SPECIAL', 'COMBAT_CAPABLE'],
    interior: dividersH([3, 7], [9, 10, 11]),
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'DASH_LANE'],
    decorationSets: ['DEADLINE_WARROOM', 'CUBICLE_FARM'],
    objectAnchors: [
      at(5, 3, DIVIDER, 0.8), at(15, 7, DIVIDER, 0.8),
      at(10, 5, DESK, 0.6), at(17, 1, PAPER, 0.5),
    ],
    vignette: 'Three rows set up as a war room, each with the same printout and a different date on it.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CRISIS_1X1_A',
    roles: [ROOM_ROLE.CRISIS, 'SPECIAL', 'COMBAT_CAPABLE'],
    interior: centreIsland(7, 3),
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'WALL_PERIMETER'],
    decorationSets: ['DEADLINE_WARROOM', 'MEETING_AFTERMATH'],
    objectAnchors: [
      at(8, 5, DESK, 0.8), at(12, 5, BOARD, 0.7),
      at(2, 2, CHAIR, 0.5), at(18, 8, CHAIR, 0.5), at(10, 9, STAIN, 0.4),
    ],
    vignette: 'An incident bridge that never stood down: a table, a speakerphone, and nobody on the line.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CRISIS_1X1_B',
    roles: [ROOM_ROLE.CRISIS, 'SPECIAL', 'COMBAT_CAPABLE'],
    interior: quadrantCover(4, 2),
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'OPEN_CENTRE'],
    decorationSets: ['DEADLINE_WARROOM', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 4, DESK, 0.8), at(16, 6, DESK, 0.8), at(10, 2, BOARD, 0.6),
      at(10, 8, EXTINGUISHER, 0.5),
    ],
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_CRISIS_2X1_A',
    roles: [ROOM_ROLE.CRISIS, 'SPECIAL', 'COMBAT_CAPABLE', 'LARGE_ROOM'],
    cells: CELLS_2X1,
    interior: rects([[8, 3, 4, 5], [31, 3, 4, 5]]),
    spawnInset: 3,
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'OPEN_CENTRE'],
    decorationSets: ['DEADLINE_WARROOM', 'MEETING_AFTERMATH'],
    objectAnchors: [
      at(9, 4, DESK, 0.8), at(32, 6, DESK, 0.8), at(21, 5, BOARD, 0.6),
      at(21, 9, BIN, 0.4), at(2, 2, CHAIR, 0.4), at(40, 8, CHAIR, 0.4),
    ],
    vignette: 'Two teams pulled into one room for an escalation, with an empty aisle between them.',
    weight: 0.9,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_REVIEW_1X1_A',
    roles: [ROOM_ROLE.UNSCHEDULED_REVIEW, 'SPECIAL', 'COMBAT_CAPABLE'],
    // Deliberately a plain workroom. ROOM-011 must not read as a threat from the
    // doorway, so the architecture gives nothing away.
    interior: quadrantCover(4, 2),
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'NORMAL'],
    decorationSets: ['CUBICLE_FARM', 'CARPET_GRID'],
    objectAnchors: [
      at(4, 4, DESK, 0.8), at(16, 6, DESK, 0.8), at(10, 5, CHAIR, 0.4),
    ],
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_REVIEW_1X1_B',
    roles: [ROOM_ROLE.UNSCHEDULED_REVIEW, 'SPECIAL', 'COMBAT_CAPABLE'],
    interior: rects([[7, 4, 7, 3]]),
    socketOpts: { classes: GATED_CLASSES },
    encounterTags: ['COMBAT_CAPABLE', 'WALL_PERIMETER'],
    decorationSets: ['MEETING_AFTERMATH', 'CARPET_GRID'],
    objectAnchors: [
      at(10, 5, DESK, 0.9), at(6, 5, CHAIR, 0.8), at(14, 5, CHAIR, 0.8),
      at(17, 2, BOARD, 0.6), at(3, 8, PLANT, 0.4),
    ],
    vignette: 'A meeting room booked for one hour under a title of two initials and a full stop.',
    weight: 1.1,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Other special and NPC rooms — F.3 minimum 12
// ---------------------------------------------------------------------------
// The optional band from GDD 12.4. Open Office I and II between them ask for
// Break Room, Deadline, NPC Office, Rec Room, Wellness, Archive and Union
// Breakroom (content/departments/floors.js), and the remaining roles are authored
// here so the same pack serves the harder floors that reuse the department.
// All of them accept the gated door classes, because the access cost is the floor
// definition's decision, not the room's.

const specialPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_BREAK_1X1_A',
    roles: [ROOM_ROLE.BREAK_ROOM, 'SPECIAL', 'SAFE'],
    interior: rects([[2, 1, 4, 2], [15, 1, 4, 2], [8, 5, 5, 2]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['BREAK_AREA', 'GENERIC'],
    objectAnchors: [
      at(3, 1, VENDING, 0.8), at(16, 1, COFFEE, 0.8), at(10, 5, DESK, 0.8),
      at(7, 7, CHAIR, 0.7), at(13, 7, CHAIR, 0.7), at(10, 9, BIN, 0.6),
    ],
    hazardAnchors: [haz('HAZ-SPILL_COFFEE_SCALD', [8, 4, 5, 4], 0.2)],
    vignette: 'A kitchen table, a fridge note about labelling your food, and a labelled lunch from last month.',
    weight: 1.5,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BREAK_1X1_B',
    roles: [ROOM_ROLE.BREAK_ROOM, 'SPECIAL', 'SAFE'],
    interior: rects([[3, 3, 2, 2], [16, 3, 2, 2], [3, 7, 2, 2], [16, 7, 2, 2]], LOW),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['BREAK_AREA', 'DEAD_PLANTS'],
    objectAnchors: [
      at(10, 3, COOLER, 0.8), at(10, 7, COFFEE, 0.7), at(3, 3, PLANT, 0.6),
      at(17, 8, CHAIR, 0.6), at(6, 8, BIN, 0.5),
    ],
    hazardAnchors: [haz('HAZ-SPILL_WATER_SLICK', [8, 2, 6, 3], 0.25)],
    vignette: 'Soft seating chosen from a catalogue, arranged so that no two chairs face each other.',
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NPC_1X1_A',
    roles: [ROOM_ROLE.NPC_OFFICE, 'SPECIAL', 'SAFE'],
    interior: rects([[8, 4, 5, 1]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['ONBOARDING_CORNER', 'GENERIC'],
    objectAnchors: [
      at(10, 4, DESK, 0.9), at(10, 2, CHAIR, 0.8), at(10, 7, CHAIR, 0.8),
      at(3, 2, SHELF, 0.6), at(17, 8, PLANT, 0.6),
    ],
    vignette: 'One desk, two chairs on the visitor side, and a jar of sweets kept deliberately full.',
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_NPC_1X1_B',
    roles: [ROOM_ROLE.NPC_OFFICE, 'SPECIAL', 'SAFE'],
    interior: rects([[3, 2, 1, 7], [17, 2, 1, 7]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['ONBOARDING_CORNER', 'LOST_PROPERTY'],
    objectAnchors: [
      at(3, 3, SHELF, 0.8), at(17, 7, CABINET, 0.8), at(10, 6, DESK, 0.8),
      at(10, 8, CHAIR, 0.6), at(10, 2, BOARD, 0.6),
    ],
    vignette: 'A borrowed office with somebody else name on the door and a queue of one.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_WELLNESS_1X1_A',
    roles: [ROOM_ROLE.WELLNESS, 'SPECIAL', 'SAFE'],
    interior: rects([[2, 2, 3, 3], [16, 6, 3, 3]], LOW),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['WELLNESS_QUIET', 'DEAD_PLANTS'],
    objectAnchors: [
      at(3, 3, PLANT, 0.8), at(17, 7, PLANT, 0.8), at(10, 5, CHAIR, 0.7),
      at(10, 8, COOLER, 0.5), at(16, 2, BOARD, 0.5),
    ],
    vignette: 'A quiet room with the lights on the lowest setting and a booking sheet signed once.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_REC_1X1_A',
    roles: [ROOM_ROLE.REC_ROOM, 'SPECIAL', 'SAFE'],
    interior: rects([[2, 1, 3, 2], [16, 1, 3, 2], [7, 5, 7, 3]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['BREAK_AREA', 'CELEBRATION_LEFTOVERS'],
    objectAnchors: [
      at(3, 1, VENDING, 0.8), at(17, 1, VENDING, 0.8), at(10, 6, DESK, 0.9),
      at(6, 9, CHAIR, 0.6), at(14, 9, BIN, 0.6),
    ],
    vignette: 'A table football with three players and a scoreboard that has run out of columns.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_ARCHIVE_1X1_A',
    roles: [ROOM_ROLE.ARCHIVE, 'SPECIAL', 'PEDESTAL', 'SAFE'],
    interior: dividersV([4, 7, 13, 16], [5]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['RECORDS_ROWS', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(4, 3, SHELF, 0.9), at(7, 7, SHELF, 0.9), at(13, 3, SHELF, 0.9),
      at(16, 7, SHELF, 0.9), at(10, 5, CART, 0.5), at(10, 9, PAPER, 0.5),
    ],
    vignette: 'Shelving by year, four aisles deep, and the index card drawer left open at the letter H.',
    weight: 1.1,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_RECORDS_1X1_A',
    roles: [ROOM_ROLE.RESTRICTED_RECORDS, 'SPECIAL', 'PEDESTAL'],
    interior: rects([[2, 2, 3, 2], [2, 7, 3, 2], [16, 2, 3, 2], [16, 7, 3, 2]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['RECORDS_ROWS', 'MAINTENANCE_GREY'],
    objectAnchors: [
      at(3, 2, LOCKBOX, 0.9), at(17, 7, LOCKBOX, 0.9), at(3, 8, CABINET, 0.7),
      at(17, 2, SCANNER, 0.7), at(10, 8, PAPER, 0.5),
    ],
    hazardAnchors: [haz('HAZ-SCANNER_SWEEP_LINE', [6, 3, 9, 5], 0.4)],
    vignette: 'Four locked cabinets, one reader at head height, and a log of entries with no names in it.',
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_OVERTIME_1X1_A',
    roles: [ROOM_ROLE.OVERTIME, 'SPECIAL'],
    interior: rects([[4, 2, 3, 2], [4, 7, 3, 2], [14, 2, 3, 2], [14, 7, 3, 2]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['OVERTIME_NEST', 'FLUORESCENT_FLICKER'],
    objectAnchors: [
      at(5, 2, DESK, 0.9), at(15, 7, DESK, 0.9), at(5, 8, CHAIR, 0.7),
      at(15, 2, COFFEE, 0.7), at(10, 5, STAIN, 0.5),
    ],
    hazardAnchors: [haz('HAZ-SPILL_COFFEE_SCALD', [8, 4, 5, 3], 0.25)],
    vignette: 'Four desks still lit at this hour, each with a mug ring where a mug used to be returned.',
    weight: 1.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_LAB_1X1_A',
    roles: [ROOM_ROLE.INNOVATION_LAB, 'SPECIAL', 'PEDESTAL'],
    interior: rects([[3, 3, 4, 1], [14, 3, 4, 1], [3, 7, 4, 1], [14, 7, 4, 1]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['GENERIC', 'MAINTENANCE_GREY'],
    objectAnchors: [
      at(4, 3, DESK, 0.9), at(16, 7, DESK, 0.9), at(4, 7, RACK, 0.7),
      at(16, 3, CABLES, 0.7), at(10, 2, BOARD, 0.6), at(10, 8, STRIP, 0.5),
    ],
    hazardAnchors: [haz('HAZ-ELEC_OUTLET_SPARK', [3, 6, 15, 3], 0.2)],
    vignette: 'Benches of half-built prototypes, each labelled with a project name and a killed date.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STRATEGY_1X1_A',
    roles: [ROOM_ROLE.STRATEGY, 'SPECIAL'],
    interior: rects([[6, 4, 9, 3]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['MEETING_AFTERMATH', 'GLASS_PARTITIONS'],
    objectAnchors: [
      at(10, 5, DESK, 0.9), at(5, 5, CHAIR, 0.7), at(16, 5, CHAIR, 0.7),
      at(10, 2, BOARD, 0.8), at(10, 8, BOARD, 0.6), at(2, 8, PLANT, 0.4),
    ],
    vignette: 'A long table under three whiteboards, all of them showing the same diagram at different sizes.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_STORAGE_1X1_A',
    roles: [ROOM_ROLE.EXECUTIVE_STORAGE, 'SPECIAL', 'PEDESTAL'],
    interior: rects([[2, 1, 2, 3], [17, 1, 2, 3], [2, 7, 2, 3], [17, 7, 2, 3], [9, 4, 3, 3]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['MANAGER_TRAPPINGS', 'SUPPLY_SHELVING'],
    objectAnchors: [
      at(2, 1, TROPHY, 0.8), at(18, 8, TROPHY, 0.8), at(2, 8, LOCKBOX, 0.8),
      at(18, 1, LOCKBOX, 0.8), at(10, 5, CABINET, 0.7),
    ],
    hazardAnchors: [haz('HAZ-GLASS_SHARD_FIELD', [2, 1, 3, 4], 0.2)],
    vignette: 'Awards in a locked case, every plate engraved and every employee name filed flat again.',
    weight: 0.8,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_UNION_1X1_A',
    roles: [ROOM_ROLE.UNION_BREAKROOM, 'SPECIAL', 'SAFE'],
    interior: rects([[5, 3, 11, 1], [5, 7, 11, 1]]),
    socketOpts: { classes: GATED_CLASSES },
    decorationSets: ['BREAK_AREA', 'LOST_PROPERTY'],
    objectAnchors: [
      at(7, 3, CHAIR, 0.9), at(13, 7, CHAIR, 0.9), at(10, 5, DESK, 0.7),
      at(3, 5, BOARD, 0.8), at(17, 5, COFFEE, 0.6), at(17, 9, BIN, 0.4),
    ],
    vignette: 'Folding chairs set out in two rows, a kettle, and a notice with no letterhead on it.',
    weight: 0.9,
  }),
];

// ---------------------------------------------------------------------------
// Pack: Boss arenas (ROOM-007) — one per boss plus shared validated arenas
// ---------------------------------------------------------------------------
// The Open Office boss pool is Team Lead, Copy Chief, Scrum Master and The Open
// Plan (GDD A.DPT-001), so eight arenas across five footprints gives every boss a
// compatible space and gives the generator a fallback whenever the deepest dead
// end has no room for a 2x2.
//
// R-BSS-006 is the constraint that shapes all of them: a safe path must always
// exist, so no arena may be a maze. Cover here is peripheral, low, or a handful
// of free-standing pylons — never a partition, never a pit, and never anything
// within reach of the declared BOSS_ANCHOR. Which boss occupies an arena is the
// boss layer's decision, not this file's (R-FLR-007).

const bossRoles = [ROOM_ROLE.MANAGER_OFFICE, 'BOSS_ARENA', 'OPEN_CENTRE'];
const bossDoor = { classes: [DOOR_CLASS.BOSS] };
const bossAnchor = (rect) => [{ zone: SPAWN_ZONE.BOSS_ANCHOR, rect }];

const bossPack = [
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_2X2_A',
    roles: bossRoles,
    cells: CELLS_2X2,
    interior: corners(3),
    spawnInset: 3,
    extraSpawnZones: bossAnchor([17, 8, 9, 7]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    decorationSets: ['MANAGER_TRAPPINGS', 'CARPET_GRID'],
    objectAnchors: [
      at(2, 2, DESK, 0.7), at(39, 20, CABINET, 0.7), at(2, 20, PLANT, 0.5),
      at(39, 2, BOARD, 0.6),
    ],
    vignette: 'The whole corner of the floor cleared for one desk and a view of the car park.',
    weight: 2.0,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_2X2_B',
    roles: bossRoles,
    cells: CELLS_2X2,
    // Four free-standing pylons well clear of the centre: cover for the player,
    // never a wall for the boss to hide behind.
    interior: rects([[10, 7, 2, 2], [31, 7, 2, 2], [10, 14, 2, 2], [31, 14, 2, 2]]),
    spawnInset: 3,
    extraSpawnZones: bossAnchor([17, 8, 9, 7]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE', 'DASH_LANE'],
    decorationSets: ['MANAGER_TRAPPINGS', 'GLASS_PARTITIONS'],
    objectAnchors: [
      at(10, 7, GLASS, 0.7), at(32, 15, GLASS, 0.7), at(21, 3, BOARD, 0.6),
      at(21, 19, BIN, 0.4),
    ],
    weight: 1.6,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_2X1_A',
    roles: bossRoles,
    cells: CELLS_2X1,
    interior: rects([[8, 2, 3, 2], [32, 7, 3, 2]]),
    spawnInset: 3,
    extraSpawnZones: bossAnchor([18, 3, 7, 5]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE', 'DASH_LANE'],
    decorationSets: ['MANAGER_TRAPPINGS', 'PRINT_STATION'],
    objectAnchors: [
      at(9, 2, PRINTER, 0.7), at(33, 8, CABINET, 0.7), at(21, 9, PAPER, 0.5),
      at(2, 5, PLANT, 0.4),
    ],
    vignette: 'A room long enough that whoever works at the far end never has to look up.',
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_1X2_A',
    roles: bossRoles,
    cells: CELLS_1X2,
    interior: rects([[3, 4, 2, 2], [16, 4, 2, 2], [3, 17, 2, 2], [16, 17, 2, 2]]),
    spawnInset: 3,
    extraSpawnZones: bossAnchor([8, 9, 5, 5]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    decorationSets: ['MANAGER_TRAPPINGS', 'CARPET_GRID'],
    objectAnchors: [
      at(3, 4, CABINET, 0.7), at(17, 18, DESK, 0.7), at(10, 2, BOARD, 0.6),
      at(10, 20, PLANT, 0.4),
    ],
    weight: 1.4,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_L2X2_A',
    roles: bossRoles,
    cells: CELLS_L_NE,
    interior: corners(3),
    spawnInset: 3,
    extraSpawnZones: bossAnchor([15, 3, 7, 5]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    decorationSets: ['MANAGER_TRAPPINGS', 'MEETING_AFTERMATH'],
    objectAnchors: [
      at(2, 2, DESK, 0.7), at(39, 2, CABINET, 0.7), at(2, 20, TROPHY, 0.5),
      at(21, 6, BOARD, 0.5),
    ],
    vignette: 'A bent suite that took two teams walls to build and now holds one meeting at a time.',
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_L2X2_B',
    roles: bossRoles,
    cells: CELLS_L_SE,
    interior: rects([[5, 4, 3, 2], [35, 17, 3, 2]]),
    spawnInset: 3,
    extraSpawnZones: bossAnchor([26, 8, 9, 7]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    decorationSets: ['MANAGER_TRAPPINGS', 'CARPET_GRID'],
    objectAnchors: [
      at(6, 4, DESK, 0.7), at(36, 18, CABINET, 0.7), at(24, 3, PLANT, 0.5),
      at(30, 20, BIN, 0.4),
    ],
    weight: 1.3,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_1X1_A',
    roles: bossRoles,
    // The fallback arena: a single cell with one desk. Tight, but never a maze.
    interior: rects([[13, 2, 4, 2]]),
    extraSpawnZones: bossAnchor([6, 3, 7, 5]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
    decorationSets: ['MANAGER_TRAPPINGS', 'CARPET_GRID'],
    objectAnchors: [
      at(14, 2, DESK, 0.8), at(18, 8, CABINET, 0.6), at(3, 2, PLANT, 0.5),
      at(3, 8, BOARD, 0.5),
    ],
    vignette: 'A manager office with the door taken off its hinges and leaned against the inside wall.',
    weight: 1.2,
  }),
  oo({
    id: 'TPL-OPEN_OFFICE_BOSS_1X1_B',
    roles: bossRoles,
    interior: rects([[3, 2, 3, 1], [15, 2, 3, 1], [3, 8, 3, 1], [15, 8, 3, 1]]),
    extraSpawnZones: bossAnchor([7, 3, 7, 5]),
    socketOpts: bossDoor,
    encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE', 'WALL_PERIMETER'],
    decorationSets: ['MANAGER_TRAPPINGS', 'PAPER_OVERFLOW'],
    objectAnchors: [
      at(4, 2, DESK, 0.8), at(16, 8, DESK, 0.8), at(4, 8, PAPER, 0.6),
      at(16, 2, CABINET, 0.6),
    ],
    vignette: 'Desks dragged into a barricade around the middle of the room, from the inside.',
    weight: 1.1,
  }),
];

export default [
  ...startPack,
  ...normalPack,
  ...storyPack,
  ...hallPack,
  ...doublePack,
  ...largePack,
  ...supplyPack,
  ...shopPack,
  ...maintPack,
  ...cubiclePack,
  ...challengePack,
  ...specialPack,
  ...bossPack,
];
