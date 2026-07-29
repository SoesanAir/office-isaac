/**
 * Department core room-template factory.
 *
 * GDD refs: 11.4 step 10 (a node is matched to an authored template by footprint, socket
 *           mask, department, role, and tags), 11.6 (door patterns), 12.1 (the room
 *           layers), 12.2 (room roles), 13.x (department objects and hazards), R-DPT-001
 *           (each department has a distinct primary mechanic), R-DPT-005 (a department is
 *           identifiable from one screenshot), R-ROM-001 (templates and encounters are
 *           separate assets), R-ROM-004 (decoration never obscures mandatory
 *           information), R-FLR-005 (sockets connect with matching world positions),
 *           §0.3 (the generator never synthesises geometry).
 *
 * ## Why this is a factory and not twelve hand-written files
 *
 * Open Office is authored longhand in open-office.js — 117 templates, each with its own
 * vignette and object placement. That is the right treatment for the department every
 * player sees first and spends the most time in.
 *
 * The other twelve need something different. What actually distinguishes them, per GDD
 * 10.x and each department's own `gameplayIdentity`, is a *primary mechanic*: IT is about
 * powered state, Operations about imposed movement, Legal about conditional zones. That
 * mechanic lives in the interior painter, the hazard anchors, and the object set — not in
 * the room's outline. Twelve near-identical hand-written files would bury that difference
 * in boilerplate and make it impossible to see at a glance which department does what.
 *
 * So this file takes one *flavour spec* per department and expands it into the core roles
 * generation needs. This is still authoring: every painter, anchor, and weight is a
 * decision recorded in data, and nothing is generated at runtime (§0.3). The factory only
 * removes repetition, exactly as `oo()` does inside open-office.js.
 *
 * ## What "core" means
 *
 * Only the four roles whose *architecture* is department-specific:
 *
 *   ROOM-001 START            the lift lobby you arrive in
 *   ROOM-002 NORMAL           the department's ordinary combat room, in five shapes
 *   ROOM-003 HALLWAY          its connective tissue
 *   ROOM-007 MANAGER_OFFICE   its boss arena
 *
 * Supply closets, shops, break rooms, maintenance access and the one-off specials are
 * deliberately NOT here. A supply closet is a supply closet on every floor of the
 * building, which is why the GDD gives every department a `TPL_SHARED_SERVICE` pool —
 * those templates carry the SERVICE_SHARED department tag and are drawn by all thirteen.
 */

import { ROOM_ROLE, SPAWN_ZONE, DOOR_CLASS, CELL_W, CELL_H } from '../../src/core/constants.js';
import { makeTemplate, layers, STRIDE_X, STRIDE_Y } from './_builder.js';

export const WALL = '#';
export const LOW = '~';
export const PIT = 'x';

/** Footprints. The five shapes generation asks for, plus the two boss arenas. */
const CELLS_1X1 = [[0, 0]];
const CELLS_2X1 = [[0, 0], [1, 0]];
const CELLS_1X2 = [[0, 0], [0, 1]];
const CELLS_2X2 = [[0, 0], [1, 0], [0, 1], [1, 1]];
const CELLS_L_NE = [[0, 0], [1, 0], [0, 1]];

/** Object anchor shorthand, matching open-office.js. */
export const at = (x, y, allow, chance, variantHint) => ({
  at: [x, y],
  allow: Array.isArray(allow) ? allow : [allow],
  chance,
  ...(variantHint ? { variantHint } : {}),
});

/** Hazard anchor shorthand. */
export const haz = (hazard, rect, chance) => ({ hazard, rect, chance });

/**
 * Keep the tile in front of every possible door walkable.
 *
 * The same guard open-office.js applies. Without it a painter can put cover exactly in a
 * doorway, and the room becomes a soft lock the moment that socket is used — so it is
 * applied to every template here rather than trusted to each painter.
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
      if (cellSet.has(`${cx + dx},${cy + dy}`)) continue;
      keep.add(`${door[0]},${door[1]}`);
      keep.add(`${inward[0]},${inward[1]}`);
    }
  }
  return (x, y) => (keep.has(`${x},${y}`) ? '.' : null);
}

// ---------------------------------------------------------------------------
// Painters. Each one is a department's primary mechanic expressed as geometry.
// ---------------------------------------------------------------------------

/** Solid blocks inset from the corners. Generic cover; the fallback shape. */
export const corners = (size = 2, char = WALL) => (x, y, ctx) => {
  const left = x >= 1 && x < 1 + size;
  const right = x >= ctx.w - 1 - size && x < ctx.w - 1;
  const top = y >= 1 && y < 1 + size;
  const bottom = y >= ctx.h - 1 - size && y < ctx.h - 1;
  return (left || right) && (top || bottom) ? char : null;
};

/** Long vertical runs with staggered gaps. Racks, shelving, filing. */
export const aisles = ({ spacing = 5, gapAt = 0.5, char = WALL } = {}) => (x, y, ctx) => {
  if (x % spacing !== 2) return null;
  const gapRow = Math.floor(ctx.h * gapAt);
  if (y === gapRow || y === gapRow + 1) return null;
  return y > 0 && y < ctx.h - 1 ? char : null;
};

/** Horizontal bands of low cover. Counters, benches, conveyor edges. */
export const benches = ({ spacing = 4, char = LOW } = {}) => (x, y, ctx) => {
  if (y % spacing !== 2) return null;
  if (x < 2 || x > ctx.w - 3) return null;
  // A break in the middle so a band never becomes a wall across the room.
  if (Math.abs(x - Math.floor(ctx.w / 2)) < 2) return null;
  return char;
};

/** A ring of cover around an open middle. Boardrooms, arenas, atria. */
export const ringed = ({ inset = 3, char = WALL } = {}) => (x, y, ctx) => {
  const onRing = x === inset || x === ctx.w - 1 - inset || y === inset || y === ctx.h - 1 - inset;
  if (!onRing) return null;
  // Gaps on the axes, so the ring is cover rather than a second wall (R-BSS-006's
  // spirit applied to ordinary rooms: never enclose the player).
  if (Math.abs(x - Math.floor(ctx.w / 2)) < 2) return null;
  if (Math.abs(y - Math.floor(ctx.h / 2)) < 2) return null;
  return char;
};

/** Scattered single pillars. Open rooms that still break sight lines. */
export const posts = ({ stepX = 6, stepY = 4, char = WALL } = {}) => (x, y, ctx) => {
  if (x < 2 || y < 2 || x > ctx.w - 3 || y > ctx.h - 3) return null;
  return x % stepX === 3 && y % stepY === 2 ? char : null;
};

/** Open floor with a hazardous strip down the middle. Machine and utility rooms. */
export const trench = ({ half = 1, char = PIT } = {}) => (x, y, ctx) => {
  const midY = Math.floor(ctx.h / 2);
  if (Math.abs(y - midY) > half) return null;
  // Two crossings, so the trench divides the room without cutting it in half.
  if (x % 7 === 3) return null;
  return x > 2 && x < ctx.w - 3 ? char : null;
};

/** Only the listed rects are floor; everything else is solid. Corridors. */
export const carve = (rects) => (x, y) => {
  for (const [rx, ry, rw, rh] of rects) {
    if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return null;
  }
  return WALL;
};

// ---------------------------------------------------------------------------
// The factory
// ---------------------------------------------------------------------------

const NORMAL_ROLES = [ROOM_ROLE.WORKROOM, 'COMBAT_CAPABLE', 'NORMAL'];
const LARGE_ROLES = [ROOM_ROLE.WORKROOM, ROOM_ROLE.LARGE_WORKROOM, 'COMBAT_CAPABLE', 'LARGE_ROOM'];
const HALL_ROLES = [ROOM_ROLE.HALLWAY, 'COMBAT_CAPABLE', 'HALLWAY', 'TINY'];
const BOSS_ROLES = [ROOM_ROLE.MANAGER_OFFICE, 'BOSS_ARENA', 'OPEN_CENTRE'];

const bossAnchor = (rect) => [{ zone: SPAWN_ZONE.BOSS_ANCHOR, rect }];

/**
 * Expand one department flavour spec into its core template set.
 *
 * @param {object} spec
 * @param {string} spec.dept department tag, e.g. 'IT'
 * @param {string} spec.slug id fragment, e.g. 'IT'
 * @param {Function} spec.signature the painter carrying the department's primary
 *   mechanic. Used by most normal rooms, so it is the shape a player learns.
 * @param {Function} [spec.secondary] a contrasting painter, so a department is not one
 *   room repeated. Defaults to `posts()`.
 * @param {string[]} spec.decorationSets decoration ids from the controlled list
 * @param {string[]} spec.objects env object ids this department places (its `objectSets`)
 * @param {string[]} [spec.hazards] hazard ids for the two rooms that carry one
 * @param {string[]} [spec.prohibitedEnemyTags] enemy tags this architecture cannot host
 * @param {Record<string,string>} spec.vignettes one line each for start/normal/hall/boss
 * @returns {object[]} authored templates
 */
export function departmentCoreSet(spec) {
  const {
    dept, slug, signature, secondary = posts(), decorationSets, objects,
    hazards = [], prohibitedEnemyTags = [], vignettes,
  } = spec;

  /** Wrap makeTemplate with the department tag and the door guard. */
  const t = (partial) => {
    const cells = partial.cells || CELLS_1X1;
    const guard = doorClear(cells);
    return makeTemplate({
      ...partial,
      departments: [dept],
      cells,
      interior: partial.interior ? layers(guard, partial.interior) : guard,
      decorationSets: partial.decorationSets || decorationSets,
      prohibitedEnemyTags: partial.prohibitedEnemyTags || prohibitedEnemyTags,
    });
  };

  /** Object anchors drawn from this department's own set, at generic positions. */
  const scatter = (positions) => positions.map(([x, y, chance], i) => at(x, y, objects[i % objects.length], chance));

  return [
    // ---- ROOM-001 START ---------------------------------------------------
    // No combat and no encounter tags: the lobby is where the player reads the floor
    // before anything can hurt them (GDD 12.2).
    t({
      id: `TPL-${slug}_START_1X1_A`,
      roles: [ROOM_ROLE.START, 'SAFE'],
      objectAnchors: scatter([[4, 2, 0.7], [16, 8, 0.5]]),
      vignette: vignettes.start,
      weight: 2.2,
    }),
    t({
      id: `TPL-${slug}_START_1X1_B`,
      roles: [ROOM_ROLE.START, 'SAFE'],
      interior: corners(2),
      // A blast side on the lobby lets Maintenance Access hang off it, which GDD 11.7
      // permits and which teaches the Toner Charge mechanic early.
      socketOpts: { secretSides: ['EAST', 'WEST'] },
      objectAnchors: scatter([[5, 8, 0.6], [15, 2, 0.5]]),
      vignette: vignettes.startAlt ?? vignettes.start,
      weight: 1.6,
    }),

    // ---- ROOM-002 NORMAL --------------------------------------------------
    // Five shapes, because the generator asks for footprints it cannot substitute:
    // 1x1, 2x1, 1x2, an L, and a 2x2 large. A missing shape is a generation failure.
    t({
      id: `TPL-${slug}_NORMAL_1X1_A`,
      roles: NORMAL_ROLES,
      interior: signature,
      encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
      objectAnchors: scatter([[3, 3, 0.6], [17, 7, 0.6], [10, 2, 0.4]]),
      vignette: vignettes.normal,
      weight: 2.6,
    }),
    t({
      id: `TPL-${slug}_NORMAL_1X1_B`,
      roles: NORMAL_ROLES,
      interior: secondary,
      encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'OPEN_CENTRE'],
      objectAnchors: scatter([[4, 8, 0.5], [16, 3, 0.5]]),
      vignette: vignettes.normalAlt ?? vignettes.normal,
      weight: 2.2,
    }),
    t({
      id: `TPL-${slug}_NORMAL_1X1_C`,
      roles: NORMAL_ROLES,
      // Deliberately empty. GDD 3.2 and R-ROM-002 both want quiet rooms, and an
      // unpainted room is a valid authored choice rather than an unfinished one.
      encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'OPEN_CENTRE', 'WALL_PERIMETER'],
      objectAnchors: scatter([[10, 5, 0.35]]),
      vignette: vignettes.empty ?? vignettes.normal,
      weight: 1.4,
    }),
    t({
      id: `TPL-${slug}_NORMAL_2X1_A`,
      roles: [...NORMAL_ROLES, ROOM_ROLE.LARGE_WORKROOM, 'LARGE_ROOM'],
      cells: CELLS_2X1,
      interior: signature,
      encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY', 'DASH_LANE'],
      objectAnchors: scatter([[5, 3, 0.6], [30, 7, 0.6], [18, 5, 0.4]]),
      ...(hazards.length
        ? { hazardAnchors: [haz(hazards[0], [12, 3, 8, 5], 0.35)] }
        : {}),
      vignette: vignettes.wide ?? vignettes.normal,
      weight: 1.8,
    }),
    t({
      id: `TPL-${slug}_NORMAL_1X2_A`,
      roles: [...NORMAL_ROLES, ROOM_ROLE.LARGE_WORKROOM, 'LARGE_ROOM'],
      cells: CELLS_1X2,
      interior: secondary,
      encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'WALL_PERIMETER'],
      objectAnchors: scatter([[4, 4, 0.6], [16, 16, 0.6]]),
      vignette: vignettes.tall ?? vignettes.normal,
      weight: 1.8,
    }),
    t({
      id: `TPL-${slug}_NORMAL_L2X2_A`,
      // Both roles: a three-cell footprint is sizeClass LARGE, so the generator may ask for
      // it either as an ordinary workroom or as the floor's required large room.
      roles: LARGE_ROLES,
      cells: CELLS_L_NE,
      interior: signature,
      encounterTags: ['COMBAT_CAPABLE', 'NORMAL', 'COVER_HEAVY'],
      objectAnchors: scatter([[5, 4, 0.55], [30, 4, 0.55], [5, 16, 0.55]]),
      vignette: vignettes.corner ?? vignettes.normal,
      weight: 1.2,
    }),
    t({
      id: `TPL-${slug}_LARGE_2X2_A`,
      roles: LARGE_ROLES,
      cells: CELLS_2X2,
      interior: ringed({ inset: 4 }),
      spawnInset: 3,
      encounterTags: ['COMBAT_CAPABLE', 'LARGE_ROOM', 'OPEN_CENTRE'],
      objectAnchors: scatter([[3, 3, 0.6], [38, 19, 0.6], [3, 19, 0.5], [38, 3, 0.5]]),
      ...(hazards.length > 1
        ? { hazardAnchors: [haz(hazards[1], [16, 9, 10, 5], 0.4)] }
        : {}),
      vignette: vignettes.large ?? vignettes.normal,
      weight: 1.4,
    }),

    // ---- ROOM-003 HALLWAY -------------------------------------------------
    t({
      id: `TPL-${slug}_HALLWAY_1X1_A`,
      roles: [...HALL_ROLES, 'CORRIDOR'],
      tiny: true,
      // A cross corridor: the only shape that can carry a door on all four sides while
      // staying a corridor rather than a room.
      interior: carve([[0, 5, 21, 1], [10, 0, 1, 11]]),
      encounterTags: ['TINY', 'HALLWAY', 'TIGHT_CORRIDOR_ONLY'],
      socketOpts: { secretSides: ['NORTH', 'EAST', 'SOUTH', 'WEST'] },
      objectAnchors: [],
      vignette: vignettes.hall,
      weight: 2.0,
    }),
    t({
      id: `TPL-${slug}_HALLWAY_1X1_B`,
      roles: [ROOM_ROLE.HALLWAY, 'HALLWAY', 'TINY', 'CORRIDOR'],
      tiny: true,
      interior: carve([[0, 4, 21, 3]]),
      // No encounter tags: a quiet corridor between fights is a beat, not a gap.
      encounterTags: [],
      objectAnchors: scatter([[6, 5, 0.4], [15, 5, 0.4]]),
      vignette: vignettes.hallAlt ?? vignettes.hall,
      weight: 1.6,
    }),

    // ---- ROOM-007 MANAGER_OFFICE -----------------------------------------
    // R-BSS-005: arenas are authored for their boss and may use large footprints. Both
    // declare a BOSS_ANCHOR zone clear of the walls, which is where BossRuntime places
    // a body of up to 2.6 radius.
    t({
      id: `TPL-${slug}_BOSS_2X2_A`,
      roles: BOSS_ROLES,
      cells: CELLS_2X2,
      interior: corners(3),
      spawnInset: 3,
      extraSpawnZones: bossAnchor([17, 8, 9, 7]),
      socketOpts: { classes: [DOOR_CLASS.BOSS] },
      encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
      objectAnchors: scatter([[2, 2, 0.6], [39, 20, 0.6]]),
      vignette: vignettes.boss,
      weight: 2.0,
    }),
    t({
      id: `TPL-${slug}_BOSS_2X1_A`,
      roles: BOSS_ROLES,
      cells: CELLS_2X1,
      interior: posts({ stepX: 8, stepY: 5 }),
      spawnInset: 2,
      extraSpawnZones: bossAnchor([16, 3, 11, 6]),
      socketOpts: { classes: [DOOR_CLASS.BOSS] },
      encounterTags: ['BOSS_ARENA', 'OPEN_CENTRE'],
      objectAnchors: scatter([[3, 2, 0.5], [38, 8, 0.5]]),
      vignette: vignettes.bossAlt ?? vignettes.boss,
      weight: 1.5,
    }),
  ];
}
