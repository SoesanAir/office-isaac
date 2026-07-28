/**
 * Room template authoring helpers.
 *
 * GDD refs: 11.6 (door patterns), 12.1 (layered room instance), 12.2 (templates
 *           are handcrafted and reused with different encounters, object states,
 *           hazards and decoration variants), R-FLR-004 (multi-cell footprints,
 *           multiple sockets per side), R-FLR-007 (no encounter in architecture),
 *           R-ROM-006 (declared navigation regions), F.3 (template pack minimums).
 *
 * What is authored and what is derived:
 *
 *   Authored  — the interior layout (cover, obstacles, pits, lanes), which door
 *               sides exist, spawn zone intent, object anchors, hazard anchors,
 *               the vignette, and the weight.
 *   Derived   — the wall ring, geometry grid dimensions, and the default socket
 *               at the middle of each perimeter cell edge.
 *
 * Deriving the boring parts is what makes the F.3 pack minimums (350+ templates)
 * achievable without hand-typing 21x11 character grids for every room. The
 * interesting part, the interior, stays hand-drawn.
 *
 * A template normally offers a socket on **every** perimeter cell edge. The
 * generator decides which of those become real doors, so one authored crossroads
 * room serves as a dead end, corridor, corner, junction, or crossroads depending
 * on topology (GDD 11.6). This is why the same architecture can appear many times
 * across a run without reading as a repeat.
 */

import { CELL_W, CELL_H, WALL, DOOR_CLASS, ROOM_SIZE, SPAWN_ZONE } from '../../src/core/constants.js';

const STRIDE_X = CELL_W + WALL;
const STRIDE_Y = CELL_H + WALL;

/** Interior grid dimensions for a footprint span. */
export function interiorDims(cells) {
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const spanX = Math.max(...xs) + 1;
  const spanY = Math.max(...ys) + 1;
  return {
    spanX,
    spanY,
    w: CELL_W * spanX + (spanX - 1),
    h: CELL_H * spanY + (spanY - 1),
  };
}

/** Size class implied by a footprint, matching the schema's own invariant. */
export function sizeClassFor(cells, { tiny = false } = {}) {
  if (tiny) return ROOM_SIZE.TINY;
  if (cells.length === 1) return ROOM_SIZE.NORMAL;
  if (cells.length === 2) return ROOM_SIZE.DOUBLE;
  return ROOM_SIZE.LARGE;
}

/**
 * Build the geometry grid.
 *
 * Cells inside the footprint are floor. Everything outside is wall, which is how
 * an L-shaped footprint gets its concave corner without the author drawing it.
 * `paint` then overlays the authored interior features.
 *
 * @param {Array<[number,number]>} cells footprint
 * @param {(x:number,y:number,ctx:object)=>string|null} [paint] returns a char to
 *        place at interior coordinate (x,y), or null to leave the default
 */
export function buildGeometry(cells, paint) {
  const { w, h, spanX, spanY } = interiorDims(cells);
  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    let row = '';
    for (let x = 0; x < w; x += 1) {
      // Which grid cell does this interior tile belong to?
      const cx = Math.floor(x / STRIDE_X);
      const cy = Math.floor(y / STRIDE_Y);
      // Tiles in the shared seam between two cells belong to whichever side is
      // occupied; the seam is floor only when both neighbours are in the room.
      const inSeamX = x % STRIDE_X === CELL_W;
      const inSeamY = y % STRIDE_Y === CELL_H;
      let inside;
      if (inSeamX && inSeamY) {
        inside = cellSet.has(`${cx},${cy}`) && cellSet.has(`${cx + 1},${cy}`)
          && cellSet.has(`${cx},${cy + 1}`) && cellSet.has(`${cx + 1},${cy + 1}`);
      } else if (inSeamX) {
        inside = cellSet.has(`${cx},${cy}`) && cellSet.has(`${cx + 1},${cy}`);
      } else if (inSeamY) {
        inside = cellSet.has(`${cx},${cy}`) && cellSet.has(`${cx},${cy + 1}`);
      } else {
        inside = cellSet.has(`${cx},${cy}`);
      }
      if (!inside) {
        row += '#';
        continue;
      }
      const painted = paint
        ? paint(x, y, { w, h, spanX, spanY, cellX: cx, cellY: cy,
          localX: x % STRIDE_X, localY: y % STRIDE_Y })
        : null;
      row += painted ?? '.';
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Door classes an ordinary room's wall socket can host.
 *
 * The door class is a property of the *edge*, not of the wall: the same stretch of
 * cubicle wall becomes a plain doorway, a badge-locked door, a shop entrance, or
 * the manager's office door depending on what the generator connects to it. So an
 * ordinary socket accepts all of them.
 *
 * BLAST_SECRET is the deliberate exception — GDD 11.7 requires hidden entrances to
 * sit at *authored* blast locations, so a template must opt in via `secretSides`.
 */
export const ORDINARY_DOOR_CLASSES = Object.freeze([
  DOOR_CLASS.NORMAL,
  DOOR_CLASS.BOSS,
  DOOR_CLASS.LOCKED_CARD,
  DOOR_CLASS.LOCKED_DOUBLE,
  DOOR_CLASS.SHOP,
  DOOR_CLASS.RESTRICTED,
  DOOR_CLASS.ROUTE,
]);

/**
 * Default door sockets: one at the middle of every perimeter cell edge.
 *
 * @param {Array<[number,number]>} cells
 * @param {object} [opts]
 * @param {string[]} [opts.classes] door classes every socket accepts
 * @param {string[]} [opts.secretSides] sides that may also host a blast secret
 */
export function buildSockets(cells, opts = {}) {
  const classes = opts.classes || ORDINARY_DOOR_CLASSES;
  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));
  const sockets = [];
  const counters = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
  const deltas = { NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0] };
  // Stable authoring order: row-major cells, then N/E/S/W.
  const ordered = [...cells].sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
  for (const [cx, cy] of ordered) {
    for (const side of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      const [dx, dy] = deltas[side];
      if (cellSet.has(`${cx + dx},${cy + dy}`)) continue;
      const socketClasses = [...classes];
      if ((opts.secretSides || []).includes(side) && !socketClasses.includes(DOOR_CLASS.BLAST_SECRET)) {
        socketClasses.push(DOOR_CLASS.BLAST_SECRET);
      }
      sockets.push({
        id: `${side[0]}${counters[side]++}`,
        side,
        cell: [cx, cy],
        offset: 0.5,
        classes: socketClasses,
      });
    }
  }
  return sockets;
}

/**
 * Default spawn zones for a combat-capable room.
 *
 * ENTRY_SAFE hugs the perimeter so a player crossing a threshold is never inside
 * a spawn (R-ENM-002's grace window depends on this). Ranged spawns sit deep,
 * melee spawns mid-field, and REWARD marks the centre where a clear reward or
 * pedestal appears.
 */
export function buildSpawnZones(cells, opts = {}) {
  const { w, h } = interiorDims(cells);
  const inset = opts.inset ?? 2;
  const [rx, ry] = rewardAnchor(w, h, opts.geometry);
  const zones = [
    { zone: SPAWN_ZONE.ENTRY_SAFE, rect: [1, 1, w - 2, h - 2] },
    { zone: SPAWN_ZONE.GROUND_MELEE, rect: [inset, inset, w - inset * 2, h - inset * 2] },
    {
      zone: SPAWN_ZONE.GROUND_RANGED,
      rect: [inset + 1, inset + 1, Math.max(2, w - (inset + 1) * 2), Math.max(2, h - (inset + 1) * 2)],
    },
    { zone: SPAWN_ZONE.AIR, rect: [inset, inset, w - inset * 2, h - inset * 2] },
    /**
     * WALL_EDGE and OBJECT_ANCHOR are declared on every room because every room
     * has walls and furniture positions. Wall-hugging enemies (ENM-013 Cable
     * Snake) and anchored machines (ENM-018 Server Rack Turret) name these zones
     * in their `spawnZones`, and the encounter selector refuses any encounter
     * asking for a zone the template does not declare — so omitting them here
     * would silently make a third of the IT roster unspawnable.
     */
    { zone: SPAWN_ZONE.WALL_EDGE, rect: [1, 1, w - 2, h - 2] },
    { zone: SPAWN_ZONE.OBJECT_ANCHOR, rect: [inset, inset, w - inset * 2, h - inset * 2] },
    { zone: SPAWN_ZONE.REWARD, rect: [rx - 1, ry - 1, 3, 3] },
  ];
  if (opts.extra) zones.push(...opts.extra);
  return zones;
}

/**
 * Pick the reward anchor: the walkable tile closest to the room centre.
 *
 * Anchoring blindly on the geometric centre is a trap — a template with a central
 * cover island would put its pedestal inside a wall, and the pedestal would be
 * unreachable. Searching outward from the centre keeps rewards central *and*
 * reachable regardless of what the author drew, which is what R-ENM-008 and
 * R-ROM-006 require of every declared zone.
 */
function rewardAnchor(w, h, geometry) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  if (!geometry) return [cx, cy];
  const walkable = (x, y) =>
    y >= 0 && y < geometry.length && x >= 0 && x < geometry[y].length
    && (geometry[y][x] === '.' || geometry[y][x] === ',');
  if (walkable(cx, cy)) return [cx, cy];
  // Expanding ring search: deterministic and always finds the nearest open tile.
  for (let radius = 1; radius < Math.max(w, h); radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        // Keep a one-tile margin so the 3x3 zone stays inside the room.
        if (x < 2 || y < 2 || x > w - 3 || y > h - 3) continue;
        if (walkable(x, y)) return [x, y];
      }
    }
  }
  return [cx, cy];
}

/** Centre tile of a footprint, used for pedestals and boss anchors. */
export function centreOf(cells) {
  const { w, h } = interiorDims(cells);
  return [Math.floor(w / 2), Math.floor(h / 2)];
}

/**
 * Assemble a full template definition.
 *
 * Only `interior` is genuinely creative work; everything else is either declared
 * intent or derived. Pass `interior` as a paint callback, or omit for an open room.
 *
 * @param {object} spec
 * @param {string} spec.id                    TPL-* id
 * @param {string[]} spec.departments          department tags
 * @param {string[]} spec.roles                role tags, e.g. ['ROOM-002','COMBAT_CAPABLE','NORMAL']
 * @param {Array<[number,number]>} [spec.cells] footprint, default [[0,0]]
 * @param {Function} [spec.interior]           paint callback
 * @param {object} [spec.socketOpts]           passed to buildSockets
 * @param {Array} [spec.objectAnchors]
 * @param {Array} [spec.hazardAnchors]
 * @param {Array} [spec.extraSpawnZones]
 * @param {string[]} [spec.encounterTags]      allowed encounter tags
 * @param {string[]} [spec.prohibitedEnemyTags]
 * @param {string[]} [spec.decorationSets]
 * @param {string} [spec.vignette]
 * @param {number} [spec.weight]
 * @param {number} [spec.minDepth]
 * @param {boolean} [spec.tiny]
 * @param {number} [spec.spawnInset]
 */
export function makeTemplate(spec) {
  const cells = spec.cells || [[0, 0]];
  const sizeClass = spec.sizeClass || sizeClassFor(cells, { tiny: spec.tiny });
  // Geometry first: spawn-zone placement needs to know where the walls ended up.
  const geometry = buildGeometry(cells, spec.interior);
  return {
    id: spec.id,
    schemaVersion: 1,
    departmentTags: spec.departments,
    roleTags: spec.roles,
    footprintCells: cells,
    sizeClass,
    doorSockets: spec.doorSockets || buildSockets(cells, spec.socketOpts),
    geometry,
    objectAnchors: spec.objectAnchors || [],
    spawnZones: spec.spawnZones
      || buildSpawnZones(cells, { inset: spec.spawnInset, extra: spec.extraSpawnZones, geometry }),
    allowedEncounterTags: spec.encounterTags || [],
    prohibitedEnemyTags: spec.prohibitedEnemyTags || [],
    decorationSets: spec.decorationSets || ['GENERIC'],
    hazardAnchors: spec.hazardAnchors || [],
    ...(spec.vignette ? { vignette: spec.vignette } : {}),
    weight: spec.weight ?? 1.0,
    ...(spec.minDepth ? { minDepth: spec.minDepth } : {}),
  };
}

// ---------------------------------------------------------------------------
// Reusable interior painters
// ---------------------------------------------------------------------------

/** Nothing but floor. Valid and useful: an empty room is a legitimate state. */
export const openFloor = null;

/**
 * Rectangular block of low cover, in interior coordinates.
 * '~' is walkable low cover: it blocks ground shots but not movement, which is
 * how cubicle dividers behave in GDD ENV-007.
 */
export function block(x0, y0, w, h, char = '#') {
  return (x, y) => (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h ? char : null);
}

/** Compose painters left to right; the first non-null wins. */
export function layers(...painters) {
  const list = painters.filter(Boolean);
  return (x, y, ctx) => {
    for (const paint of list) {
      const ch = paint(x, y, ctx);
      if (ch !== null && ch !== undefined) return ch;
    }
    return null;
  };
}

/**
 * Four symmetric cover blocks, one per quadrant. The classic readable combat
 * room: cover exists, but every firing lane through the centre stays open, which
 * is what R-ROM-004 and GDD 12.6 demand of decoration.
 */
export function quadrantCover(inset = 4, size = 2, char = '#') {
  return (x, y, ctx) => {
    const { w, h } = ctx;
    const right = w - inset - size;
    const bottom = h - inset - size;
    const inX = (x >= inset && x < inset + size) || (x >= right && x < right + size);
    const inY = (y >= inset && y < inset + size) || (y >= bottom && y < bottom + size);
    return inX && inY ? char : null;
  };
}

/** A central island of cover with clear space all around it. */
export function centreIsland(w = 5, h = 3, char = '#') {
  return (x, y, ctx) => {
    const x0 = Math.floor((ctx.w - w) / 2);
    const y0 = Math.floor((ctx.h - h) / 2);
    return x >= x0 && x < x0 + w && y >= y0 && y < y0 + h ? char : null;
  };
}

/**
 * Vertical cubicle rows: the Open Office signature. Gaps keep every row
 * traversable so no enemy can be walled off (R-ENM-008).
 */
export function cubicleRows({ spacing = 5, thickness = 1, gapEvery = 4, char = '#' } = {}) {
  return (x, y, ctx) => {
    if (x % spacing >= thickness) return null;
    if (x <= 1 || x >= ctx.w - 2) return null;
    // Periodic gaps so each aisle connects to the next.
    if (y % gapEvery === Math.floor(gapEvery / 2)) return null;
    if (y <= 1 || y >= ctx.h - 2) return null;
    return char;
  };
}

/** Horizontal lanes, used by Operations conveyor rooms. */
export function laneDividers({ spacing = 4, char = '#' } = {}) {
  return (x, y, ctx) => {
    if (y % spacing !== 0) return null;
    if (y <= 1 || y >= ctx.h - 2) return null;
    // Leave both ends open so lanes are enterable from either side.
    if (x <= 2 || x >= ctx.w - 3) return null;
    return char;
  };
}

/** Pillars on a grid: readable, symmetric, and never seals a lane. */
export function pillars({ stepX = 6, stepY = 4, char = '#' } = {}) {
  return (x, y, ctx) => {
    if (x <= 2 || y <= 1 || x >= ctx.w - 3 || y >= ctx.h - 2) return null;
    return x % stepX === 0 && y % stepY === 0 ? char : null;
  };
}

export { STRIDE_X, STRIDE_Y };
