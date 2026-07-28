/**
 * Room template index.
 *
 * GDD refs: 11.4 step 10 (select an authored room template for each node matching
 *           footprint, socket mask, department, role, and tags), 11.6 (door
 *           patterns), R-FLR-004 (a footprint may occupy multiple cells and expose
 *           multiple sockets per side), R-FLR-005 (sockets connect with matching
 *           world positions and opposite orientations), R-FLR-007 (architecture
 *           does not encode an encounter), R-ROM-001 (templates and encounters are
 *           separate assets).
 *
 * The generator never invents geometry. It decides *topology* — which cells a room
 * occupies and which of its edges must carry a door — and then asks this index for
 * an authored template that can satisfy that shape. GDD §0.3 explicitly forbids
 * assembling rooms from arbitrary geometry during combat, so a topology with no
 * matching authored template is a generation failure to retry, never a licence to
 * synthesise a room.
 */

import { DIR_OPPOSITE, ROOM_SIZE } from '../core/constants.js';

/** Canonical key for a socket requirement: which cell edge must carry a door. */
export function socketKey(cellX, cellY, side) {
  return `${cellX},${cellY},${side}`;
}

/** Canonical key for a grid cell. */
export function cellKey(x, y) {
  return `${x},${y}`;
}

/**
 * Normalise a footprint so shape comparison is translation-independent: shift so
 * the minimum x and y are both zero, then sort.
 */
export function normaliseFootprint(cells) {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
}

/** Stable shape id, e.g. "0,0|1,0" for a horizontal double room. */
export function footprintShapeId(cells) {
  return normaliseFootprint(cells).map(([x, y]) => `${x},${y}`).join('|');
}

/**
 * Wraps one authored template with the derived lookup data the generator needs.
 */
export class IndexedTemplate {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.sizeClass = def.sizeClass;
    this.weight = def.weight;
    this.minDepth = def.minDepth ?? 1;
    this.footprint = normaliseFootprint(def.footprintCells);
    this.shapeId = footprintShapeId(def.footprintCells);
    this.cellSet = new Set(this.footprint.map(([x, y]) => cellKey(x, y)));
    this.departmentTags = new Set(def.departmentTags);
    this.roleTags = new Set(def.roleTags);

    /** socketKey -> socket definitions available at that cell edge. */
    this.socketsByEdge = new Map();
    /** Offset applied to raw template cells to reach normalised coordinates. */
    const [rawMinX, rawMinY] = def.footprintCells.reduce(
      ([mx, my], [x, y]) => [Math.min(mx, x), Math.min(my, y)],
      [Infinity, Infinity],
    );
    for (const socket of def.doorSockets) {
      const nx = socket.cell[0] - rawMinX;
      const ny = socket.cell[1] - rawMinY;
      const key = socketKey(nx, ny, socket.side);
      let list = this.socketsByEdge.get(key);
      if (!list) {
        list = [];
        this.socketsByEdge.set(key, list);
      }
      list.push({ ...socket, normCell: [nx, ny] });
    }

    /**
     * Every cell edge that faces outside the footprint. These are the only edges
     * that could ever carry a door, and the generator uses this to enumerate
     * candidate expansion directions.
     */
    this.perimeterEdges = [];
    for (const [x, y] of this.footprint) {
      for (const side of ['NORTH', 'SOUTH', 'EAST', 'WEST']) {
        const [dx, dy] = sideDelta(side);
        if (!this.cellSet.has(cellKey(x + dx, y + dy))) {
          this.perimeterEdges.push({ cell: [x, y], side });
        }
      }
    }
  }

  /** Does this template offer a door at the given normalised cell edge? */
  hasSocketAt(cellX, cellY, side, doorClass) {
    const list = this.socketsByEdge.get(socketKey(cellX, cellY, side));
    if (!list) return false;
    if (!doorClass) return true;
    return list.some((s) => s.classes.includes(doorClass));
  }

  /** All sockets at a cell edge, for picking a specific one deterministically. */
  socketsAt(cellX, cellY, side) {
    return this.socketsByEdge.get(socketKey(cellX, cellY, side)) || [];
  }

  /** Total door sockets, used to prefer junction-rich rooms when branching. */
  get socketCount() {
    return this.def.doorSockets.length;
  }
}

/** Grid delta for a side. Y grows southward, matching screen space. */
export function sideDelta(side) {
  switch (side) {
    case 'NORTH': return [0, -1];
    case 'SOUTH': return [0, 1];
    case 'EAST': return [1, 0];
    case 'WEST': return [-1, 0];
    default: throw new Error(`Unknown side "${side}".`);
  }
}

export { DIR_OPPOSITE };

/**
 * Queryable index over all authored templates.
 */
export class TemplateIndex {
  /**
   * @param {Array<object>} templateDefs raw definitions from the content registry
   */
  constructor(templateDefs) {
    this.all = templateDefs.map((def) => new IndexedTemplate(def));
    /** departmentTag -> IndexedTemplate[] */
    this.byDepartment = new Map();
    for (const tpl of this.all) {
      for (const tag of tpl.departmentTags) {
        let list = this.byDepartment.get(tag);
        if (!list) {
          list = [];
          this.byDepartment.set(tag, list);
        }
        list.push(tpl);
      }
    }
  }

  get size() {
    return this.all.length;
  }

  /**
   * Candidate templates for a node.
   *
   * @param {object} query
   * @param {string} query.department department tag
   * @param {string} [query.role] required role tag, e.g. 'ROOM-005'
   * @param {string} [query.sizeClass] one of ROOM_SIZE
   * @param {string} [query.shapeId] exact footprint shape
   * @param {Array<{cell:[number,number], side:string, doorClass?:string}>} [query.requiredSockets]
   *        normalised cell edges that MUST carry a compatible door
   * @param {number} [query.depth] floor depth, filters minDepth
   * @param {string[]} [query.anyRoleTags] at least one of these role tags
   * @returns {IndexedTemplate[]}
   */
  candidates(query) {
    const out = [];
    const pool = query.department ? (this.byDepartment.get(query.department) || []) : this.all;
    for (const tpl of pool) {
      if (query.depth !== undefined && tpl.minDepth > query.depth) continue;
      if (query.sizeClass && tpl.sizeClass !== query.sizeClass) continue;
      if (query.shapeId && tpl.shapeId !== query.shapeId) continue;
      if (query.role && !tpl.roleTags.has(query.role)) continue;
      if (query.anyRoleTags && !query.anyRoleTags.some((tag) => tpl.roleTags.has(tag))) continue;
      if (query.requiredSockets) {
        let ok = true;
        for (const req of query.requiredSockets) {
          if (!tpl.hasSocketAt(req.cell[0], req.cell[1], req.side, req.doorClass)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
      out.push(tpl);
    }
    return out;
  }

  /** Shape ids available for a size class in a department, for growth planning. */
  shapesFor(department, sizeClass, depth) {
    const seen = new Map();
    for (const tpl of this.byDepartment.get(department) || []) {
      if (tpl.sizeClass !== sizeClass) continue;
      if (depth !== undefined && tpl.minDepth > depth) continue;
      if (!seen.has(tpl.shapeId)) seen.set(tpl.shapeId, tpl.footprint);
    }
    return [...seen.entries()].map(([shapeId, footprint]) => ({ shapeId, footprint }));
  }

  /** Diagnostic: template coverage report used by the stress harness. */
  coverage(department, depth) {
    const report = {};
    for (const sizeClass of Object.values(ROOM_SIZE)) {
      report[sizeClass] = this.candidates({ department, sizeClass, depth }).length;
    }
    return report;
  }
}
