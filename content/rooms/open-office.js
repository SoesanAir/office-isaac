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

export default [
  ...startPack,
  ...normalPack,
];
