/**
 * Procedural floor generation.
 *
 * GDD refs: §11 in full. Specifically 11.1 (connected graph on a logical grid),
 *           11.2 (logical entities), 11.3 (target room count), 11.4 (the
 *           fourteen-step generation sequence, implemented step by step below),
 *           11.5 (R-FLR-001..010), 11.6 (door patterns), 11.7 (secret placement),
 *           11.8 (room-size distribution), 20.7 (under 250ms), R-TEC-008
 *           (floors are persisted as instances, not regenerated on revisit).
 *
 * Two separations are load-bearing and must survive any future refactor:
 *
 *   1. **Topology before architecture.** The generator decides which grid cells a
 *      room occupies and which of its edges carry doors, then asks the template
 *      index for an authored room that fits. It never synthesises geometry
 *      (GDD §0.3).
 *
 *   2. **Architecture before encounters.** A room is a place, not an enemy list
 *      (D-006, R-FLR-007). Encounter selection is a later layer and lives in
 *      encounter-select.js. This module only records the tags an encounter may
 *      later be matched against.
 *
 * Determinism: every roll comes from the FLOOR_LAYOUT or ROOM_TEMPLATE stream
 * keyed by floor id and attempt number, so a failed attempt reproduces exactly
 * and the next attempt is a different but equally reproducible draw (R-FLR-008).
 */

import { RNG_STREAMS } from '../core/rng.js';
import {
  DOOR_CLASS, ROOM_ROLE, ROOM_SIZE, CELL_W, CELL_H, WALL,
  interiorWidth, interiorHeight,
} from '../core/constants.js';
import {
  TemplateIndex, cellKey, socketKey, sideDelta, normaliseFootprint, footprintShapeId,
} from './template-index.js';

const OPPOSITE = { NORTH: 'SOUTH', SOUTH: 'NORTH', EAST: 'WEST', WEST: 'EAST' };

/** Roles that are appended as leaves off the normal graph. */
const SPECIAL_ROLES = new Set([
  ROOM_ROLE.SUPPLY_CLOSET, ROOM_ROLE.SHOP, ROOM_ROLE.MANAGER_OFFICE,
  ROOM_ROLE.BREAK_ROOM, ROOM_ROLE.DEADLINE, ROOM_ROLE.CRISIS,
  ROOM_ROLE.UNSCHEDULED_REVIEW, ROOM_ROLE.RESTRICTED_RECORDS, ROOM_ROLE.OVERTIME,
  ROOM_ROLE.ARCHIVE, ROOM_ROLE.INNOVATION_LAB, ROOM_ROLE.REC_ROOM,
  ROOM_ROLE.STRATEGY, ROOM_ROLE.WELLNESS, ROOM_ROLE.EXECUTIVE_STORAGE,
  ROOM_ROLE.SHADOW_PROCUREMENT, ROOM_ROLE.EXECUTIVE_DEAL,
  ROOM_ROLE.UNION_BREAKROOM, ROOM_ROLE.QUARTER_END_CRUNCH,
  ROOM_ROLE.SERVICE_ELEVATOR, ROOM_ROLE.NPC_OFFICE,
]);

/** Size-class keys as they appear in floorDef.roomSizeDistribution. */
const SIZE_KEYS = [
  ['single', ROOM_SIZE.NORMAL],
  ['double', ROOM_SIZE.DOUBLE],
  ['large', ROOM_SIZE.LARGE],
  ['tiny', ROOM_SIZE.TINY],
];

/** Access cost -> door class used for a special room's entrance. */
const COST_TO_DOOR_CLASS = {
  NONE: DOOR_CLASS.NORMAL,
  ONE_CARD: DOOR_CLASS.LOCKED_CARD,
  TWO_CARDS: DOOR_CLASS.LOCKED_DOUBLE,
  HEALTH: DOOR_CLASS.RESTRICTED,
  CREDITS: DOOR_CLASS.SHOP,
  BLAST: DOOR_CLASS.BLAST_SECRET,
};

export class GenerationError extends Error {
  constructor(message, stage) {
    super(message);
    this.name = 'GenerationError';
    this.stage = stage;
  }
}

/** One room instance in the floor graph (GDD 11.2, 12.1). */
class RoomNode {
  constructor({ id, role, sizeClass, footprint, origin }) {
    this.id = id;
    this.role = role;
    this.sizeClass = sizeClass;
    /** Normalised footprint (translation-independent shape). */
    this.footprint = footprint;
    /** Grid position of the normalised (0,0) cell. */
    this.origin = origin;
    /** Absolute grid cells this room occupies. */
    this.cells = footprint.map(([x, y]) => [origin[0] + x, origin[1] + y]);
    this.shapeId = footprintShapeId(footprint);
    this.templateId = null;
    /** socketKey (normalised cell edge) -> door class required there. */
    this.requiredSockets = new Map();
    /** Resolved doors, filled once a template is chosen. */
    this.doors = [];
    /** Edge ids incident to this node. */
    this.edgeIds = [];
    this.hidden = false;
    this.accessCost = 'NONE';
    this.graphDistance = Infinity;
    this.tags = [];
    /** Encounter layer fills this in later; never set here (R-FLR-007). */
    this.encounterId = null;
    this.cleared = false;
    this.visited = false;
  }

  get doorCount() {
    return this.requiredSockets.size;
  }

  /** A dead end has exactly one ordinary connection (GDD glossary). */
  isDeadEnd(floor) {
    let ordinary = 0;
    for (const edgeId of this.edgeIds) {
      const edge = floor.edges.get(edgeId);
      if (edge && edge.doorClass !== DOOR_CLASS.BLAST_SECRET) ordinary += 1;
    }
    return ordinary === 1;
  }
}

/** The generated floor instance. Serialised whole (R-TEC-008). */
class Floor {
  constructor({ id, floorDef, depth, attempt }) {
    this.id = id;
    this.floorDefId = floorDef.id;
    this.department = floorDef.departmentTag;
    this.depth = depth;
    this.tier = floorDef.tier;
    this.difficulty = floorDef.difficulty;
    this.attempt = attempt;
    /** @type {Map<string, RoomNode>} */
    this.nodes = new Map();
    /** @type {Map<string, object>} */
    this.edges = new Map();
    /** cellKey -> nodeId */
    this.grid = new Map();
    this.startNodeId = null;
    this.bossNodeId = null;
    this.nextNodeSeq = 1;
    this.nextEdgeSeq = 1;
    /** Structural facts about this floor. Deterministic, so safe to serialise. */
    this.metrics = {};
    /**
     * Generation diagnostics: wall-clock timing, attempt count, retry reasons.
     * Deliberately NOT part of save(), because timing varies run to run and would
     * make an otherwise identical floor compare unequal, breaking the seed-replay
     * guarantee in R-TEC-002.
     */
    this.diagnostics = {};
  }

  occupied(x, y) {
    return this.grid.has(cellKey(x, y));
  }

  nodeAt(x, y) {
    const id = this.grid.get(cellKey(x, y));
    return id ? this.nodes.get(id) : undefined;
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    for (const [x, y] of node.cells) this.grid.set(cellKey(x, y), node.id);
    return node;
  }

  removeNode(node) {
    this.nodes.delete(node.id);
    for (const [x, y] of node.cells) this.grid.delete(cellKey(x, y));
  }

  /** Roles present, for the R-FLR-006 role-count assertion. */
  roleCounts() {
    const counts = {};
    for (const node of this.nodes.values()) {
      counts[node.role] = (counts[node.role] || 0) + 1;
    }
    return counts;
  }

  nodesWithRole(role) {
    return [...this.nodes.values()].filter((n) => n.role === role);
  }

  /** Adjacency list over traversable (non-secret) edges. */
  adjacency({ includeSecret = false } = {}) {
    const adj = new Map();
    for (const id of this.nodes.keys()) adj.set(id, []);
    for (const edge of this.edges.values()) {
      if (!includeSecret && edge.doorClass === DOOR_CLASS.BLAST_SECRET) continue;
      adj.get(edge.a.nodeId)?.push(edge.b.nodeId);
      adj.get(edge.b.nodeId)?.push(edge.a.nodeId);
    }
    return adj;
  }

  /**
   * BFS graph distance from a node.
   * @param {string} fromId
   * @param {{includeSecret?: boolean, blockedDoorClasses?: Set<string>}} [opts]
   */
  distances(fromId, opts = {}) {
    const blocked = opts.blockedDoorClasses;
    const adj = new Map();
    for (const id of this.nodes.keys()) adj.set(id, []);
    for (const edge of this.edges.values()) {
      if (!opts.includeSecret && edge.doorClass === DOOR_CLASS.BLAST_SECRET) continue;
      if (blocked && blocked.has(edge.doorClass)) continue;
      adj.get(edge.a.nodeId)?.push(edge.b.nodeId);
      adj.get(edge.b.nodeId)?.push(edge.a.nodeId);
    }
    const dist = new Map([[fromId, 0]]);
    const queue = [fromId];
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      const d = dist.get(current);
      for (const next of adj.get(current) || []) {
        if (!dist.has(next)) {
          dist.set(next, d + 1);
          queue.push(next);
        }
      }
    }
    return dist;
  }

  /** World-space interior rect of a node, in world units. */
  interiorRect(node) {
    const xs = node.cells.map(([x]) => x);
    const ys = node.cells.map(([, y]) => y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX + 1;
    const spanY = Math.max(...ys) - minY + 1;
    return {
      x: minX * (CELL_W + WALL),
      y: minY * (CELL_H + WALL),
      w: interiorWidth(spanX),
      h: interiorHeight(spanY),
      spanX,
      spanY,
    };
  }

  /** Plain serialisable snapshot for the run save. */
  save() {
    return {
      id: this.id,
      floorDefId: this.floorDefId,
      department: this.department,
      depth: this.depth,
      tier: this.tier,
      difficulty: this.difficulty,
      attempt: this.attempt,
      startNodeId: this.startNodeId,
      bossNodeId: this.bossNodeId,
      metrics: this.metrics,
      nodes: [...this.nodes.values()].map((n) => ({
        id: n.id, role: n.role, sizeClass: n.sizeClass, footprint: n.footprint,
        origin: n.origin, templateId: n.templateId, doors: n.doors, hidden: n.hidden,
        accessCost: n.accessCost, graphDistance: n.graphDistance, tags: n.tags,
        encounterId: n.encounterId, cleared: n.cleared, visited: n.visited,
        edgeIds: n.edgeIds,
      })),
      edges: [...this.edges.values()],
    };
  }
}

export class FloorGenerator {
  /**
   * @param {{templateIndex: TemplateIndex}} deps
   */
  constructor({ templateIndex }) {
    this.templateIndex = templateIndex;
  }

  /**
   * Generate one validated floor.
   *
   * @param {object} args
   * @param {object} args.floorDef floor definition (see floorSchema)
   * @param {import('../core/rng.js').RngSource} args.rngSource
   * @param {(floor: Floor) => {ok: boolean, errors: string[]}} [args.validate]
   * @param {number} [args.maxAttempts] GDD R-FLR-008: deterministic retry
   * @param {Set<string>} [args.unlockFlags]
   * @returns {{floor: Floor, attempts: number, elapsedMs: number, validation: object}}
   */
  generate({ floorDef, rngSource, validate, maxAttempts = 24, unlockFlags = new Set() }) {
    const started = nowMs();
    const failures = [];
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      // Step 1: deterministic streams from run seed, floor id, and attempt salt.
      const layoutRng = rngSource.stream(RNG_STREAMS.FLOOR_LAYOUT, floorDef.id, attempt);
      const templateRng = rngSource.stream(RNG_STREAMS.ROOM_TEMPLATE, floorDef.id, attempt);
      let floor;
      try {
        floor = this.#attempt({ floorDef, layoutRng, templateRng, attempt, unlockFlags });
      } catch (err) {
        if (!(err instanceof GenerationError)) throw err;
        failures.push(`attempt ${attempt} (${err.stage}): ${err.message}`);
        // A failed attempt must not leave partial state in the cached streams.
        rngSource.resetContext(RNG_STREAMS.FLOOR_LAYOUT, floorDef.id, attempt);
        rngSource.resetContext(RNG_STREAMS.ROOM_TEMPLATE, floorDef.id, attempt);
        continue;
      }

      const validation = validate ? validate(floor) : { ok: true, errors: [] };
      if (validation.ok) {
        floor.diagnostics = { attempts: attempt + 1, elapsedMs: nowMs() - started, failures };
        return { floor, attempts: attempt + 1, elapsedMs: floor.diagnostics.elapsedMs, validation };
      }
      failures.push(`attempt ${attempt} validation: ${validation.errors.join('; ')}`);
      rngSource.resetContext(RNG_STREAMS.FLOOR_LAYOUT, floorDef.id, attempt);
      rngSource.resetContext(RNG_STREAMS.ROOM_TEMPLATE, floorDef.id, attempt);
    }
    throw new GenerationError(
      `no valid floor for ${floorDef.id} in ${maxAttempts} attempts:\n${failures.join('\n')}`,
      'exhausted',
    );
  }

  // -------------------------------------------------------------------------
  // One attempt: GDD 11.4 steps 2-12. Step 13 is the caller's validator.
  // -------------------------------------------------------------------------
  #attempt({ floorDef, layoutRng, templateRng, attempt, unlockFlags }) {
    const depth = floorDef.depth;
    const department = floorDef.departmentTag;
    const floor = new Floor({
      id: `${floorDef.id}#${attempt}`,
      floorDef: { ...floorDef, departmentTag: department },
      depth,
      attempt,
    });

    // Step 2: target node count (GDD 11.3).
    const [minNodes, maxNodes] = floorDef.targetNodes;
    const rawTarget = Math.round(6.5 + depth * 1.35 + layoutRng.int(-1, 2));
    const targetNormalNodes = clamp(rawTarget, minNodes, maxNodes);

    // Step 3: place the Start Room at the grid origin.
    const startTemplates = this.templateIndex.candidates({
      department, role: ROOM_ROLE.START, depth,
    });
    if (startTemplates.length === 0) {
      throw new GenerationError(`no START template for ${department}`, 'start');
    }
    const startShape = layoutRng.pickWeighted(startTemplates, (t) => t.weight);
    const start = floor.addNode(new RoomNode({
      id: this.#nodeId(floor),
      role: ROOM_ROLE.START,
      sizeClass: startShape.sizeClass,
      footprint: startShape.footprint,
      origin: [0, 0],
    }));
    floor.startNodeId = start.id;

    // Step 4: grow the connected normal-room graph.
    this.#grow({ floor, floorDef, layoutRng, targetNormalNodes, department, depth });

    // Step 5: guarantee the dead-end minimum (R-FLR-003) and a non-boss branch.
    this.#ensureDeadEnds({ floor, floorDef, layoutRng, department, depth });

    // Step 6: boss room at the greatest traversable distance (R-FLR-002).
    this.#placeBoss({ floor, layoutRng, department, depth });

    // Steps 7-8: guaranteed then optional special rooms.
    this.#placeGuaranteedSpecials({ floor, floorDef, layoutRng, department, depth });
    this.#placeOptionalSpecials({ floor, floorDef, layoutRng, department, depth, unlockFlags });

    // Step 9: hidden rooms (GDD 11.7).
    this.#placeSecrets({ floor, floorDef, layoutRng, department, depth });

    // Step 10: select an authored template for every node.
    this.#selectTemplates({ floor, templateRng, department, depth });

    // Steps 11-12 are separate layers by design. Record what they need.
    this.#finalise(floor, targetNormalNodes);
    return floor;
  }

  #nodeId(floor) {
    return `r${floor.nextNodeSeq++}`;
  }

  /**
   * Enumerate every open perimeter edge in the floor: a cell edge of an existing
   * node whose neighbouring cell is empty.
   */
  #openEdges(floor, { rolesAllowed = null } = {}) {
    const out = [];
    for (const node of floor.nodes.values()) {
      if (node.hidden) continue;
      if (rolesAllowed && !rolesAllowed.has(node.role)) continue;
      for (let i = 0; i < node.footprint.length; i += 1) {
        const [fx, fy] = node.footprint[i];
        const ax = node.origin[0] + fx;
        const ay = node.origin[1] + fy;
        for (const side of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
          const [dx, dy] = sideDelta(side);
          // Inside the same room? Not a perimeter edge.
          if (node.footprint.some(([px, py]) => px === fx + dx && py === fy + dy)) continue;
          if (floor.occupied(ax + dx, ay + dy)) continue;
          if (node.requiredSockets.has(socketKey(fx, fy, side))) continue;
          out.push({ nodeId: node.id, normCell: [fx, fy], absCell: [ax, ay], side });
        }
      }
    }
    return out;
  }

  /** Roll a size class from the floor's distribution (GDD 11.8). */
  #rollSizeClass(floorDef, rng) {
    const dist = floorDef.roomSizeDistribution;
    const entries = SIZE_KEYS.map(([key, sizeClass]) => ({ sizeClass, weight: dist[key] ?? 0 }));
    const picked = rng.pickWeighted(entries, (e) => e.weight);
    return picked ? picked.sizeClass : ROOM_SIZE.NORMAL;
  }

  /**
   * Try to attach a new room through an open edge.
   *
   * Returns the new node, or null when no authored template can satisfy the
   * resulting socket requirements on either side. Rejecting here rather than at
   * template-selection time is what guarantees step 10 always succeeds.
   */
  #tryAttach({
    floor, edge, sizeClass, role, department, depth, rng,
    doorClass = DOOR_CLASS.NORMAL, hidden = false, roleTagQuery = null,
  }) {
    const host = floor.nodes.get(edge.nodeId);
    // The host must be able to offer a door of this class at this edge.
    const hostRequired = [
      ...[...host.requiredSockets].map(([key, cls]) => decodeSocketReq(key, cls)),
      { cell: edge.normCell, side: edge.side, doorClass },
    ];
    const hostCandidates = this.templateIndex.candidates({
      department, depth, shapeId: host.shapeId,
      role: host.role, requiredSockets: hostRequired,
    });
    if (hostCandidates.length === 0) return null;

    const shapes = this.templateIndex.shapesFor(department, sizeClass, depth);
    if (shapes.length === 0) return null;

    const entrySide = OPPOSITE[edge.side];
    const [dx, dy] = sideDelta(edge.side);
    const targetCell = [edge.absCell[0] + dx, edge.absCell[1] + dy];

    for (const shape of rng.shuffle([...shapes])) {
      // Any cell of the new shape may be the one that lands on targetCell.
      for (const entry of rng.shuffle([...shape.footprint])) {
        const origin = [targetCell[0] - entry[0], targetCell[1] - entry[1]];
        // All cells must be free.
        let free = true;
        for (const [fx, fy] of shape.footprint) {
          if (floor.occupied(origin[0] + fx, origin[1] + fy)) { free = false; break; }
        }
        if (!free) continue;

        const query = {
          department, depth, shapeId: shape.shapeId,
          requiredSockets: [{ cell: entry, side: entrySide, doorClass }],
        };
        if (role) query.role = role;
        if (roleTagQuery) query.anyRoleTags = roleTagQuery;
        const candidates = this.templateIndex.candidates(query);
        if (candidates.length === 0) continue;

        const node = floor.addNode(new RoomNode({
          id: this.#nodeId(floor),
          role: role || ROOM_ROLE.WORKROOM,
          sizeClass,
          footprint: shape.footprint,
          origin,
        }));
        node.hidden = hidden;
        this.#connect(floor, host, edge.normCell, edge.side, node, entry, entrySide, doorClass);
        return node;
      }
    }
    return null;
  }

  /** Create the bidirectional door edge between two nodes (R-FLR-005). */
  #connect(floor, a, aCell, aSide, b, bCell, bSide, doorClass) {
    const id = `d${floor.nextEdgeSeq++}`;
    const edge = {
      id,
      doorClass,
      locked: doorClass === DOOR_CLASS.LOCKED_CARD || doorClass === DOOR_CLASS.LOCKED_DOUBLE,
      discovered: doorClass !== DOOR_CLASS.BLAST_SECRET,
      a: { nodeId: a.id, cell: aCell, side: aSide, socketId: null },
      b: { nodeId: b.id, cell: bCell, side: bSide, socketId: null },
    };
    floor.edges.set(id, edge);
    a.requiredSockets.set(socketKey(aCell[0], aCell[1], aSide), doorClass);
    b.requiredSockets.set(socketKey(bCell[0], bCell[1], bSide), doorClass);
    a.edgeIds.push(id);
    b.edgeIds.push(id);
    return edge;
  }

  /**
   * Step 4. Grow the normal graph.
   *
   * "Prefer branching while preserving space for large rooms": edges belonging to
   * nodes with fewer doors are weighted up, which spreads the graph outward
   * instead of growing one corridor, and leaves empty cells for later large rooms
   * and for the Maintenance Access adjacency search.
   */
  #grow({ floor, floorDef, layoutRng, targetNormalNodes, department, depth }) {
    let placed = 1; // start room
    let stalls = 0;
    const maxStalls = 60;

    while (placed < targetNormalNodes && stalls < maxStalls) {
      const open = this.#openEdges(floor);
      if (open.length === 0) break;

      const weighted = open.map((edge) => {
        const host = floor.nodes.get(edge.nodeId);
        // Fewer existing doors -> more attractive, encouraging branching.
        const branchBonus = 1 / (1 + host.doorCount * host.doorCount);
        return { edge, weight: branchBonus };
      });
      const choice = layoutRng.pickWeighted(weighted, (w) => w.weight);
      if (!choice) break;

      const sizeClass = this.#rollSizeClass(floorDef, layoutRng);
      const node = this.#tryAttach({
        floor, edge: choice.edge, sizeClass, role: ROOM_ROLE.WORKROOM,
        department, depth, rng: layoutRng,
        roleTagQuery: ['COMBAT_CAPABLE', 'NORMAL', 'HALLWAY', 'LARGE_ROOM', 'TINY'],
      });
      if (node) {
        // Hallways and large rooms carry their own role tag for encounter matching.
        if (sizeClass === ROOM_SIZE.LARGE) node.role = ROOM_ROLE.LARGE_WORKROOM;
        else if (sizeClass === ROOM_SIZE.TINY) node.role = ROOM_ROLE.HALLWAY;
        placed += 1;
        stalls = 0;
      } else {
        stalls += 1;
      }
    }

    if (placed < Math.max(4, Math.floor(targetNormalNodes * 0.6))) {
      throw new GenerationError(
        `graph stalled at ${placed}/${targetNormalNodes} normal nodes`, 'grow',
      );
    }
    floor.metrics.normalNodes = placed;
    floor.metrics.targetNormalNodes = targetNormalNodes;
  }

  /**
   * Step 5. R-FLR-003 requires at least five usable dead ends before optional
   * special-room assignment, because every guaranteed and optional special room
   * wants one.
   */
  #ensureDeadEnds({ floor, floorDef, layoutRng, department, depth }) {
    const needed = floorDef.minDeadEnds;
    let guard = 0;
    while (this.#countDeadEnds(floor) < needed && guard < 80) {
      guard += 1;
      const open = this.#openEdges(floor);
      if (open.length === 0) break;
      // Attach single-cell rooms: a fresh leaf is a dead end by construction.
      const weighted = open.map((edge) => {
        const host = floor.nodes.get(edge.nodeId);
        return { edge, weight: 1 / (1 + host.doorCount) };
      });
      const choice = layoutRng.pickWeighted(weighted, (w) => w.weight);
      if (!choice) break;
      this.#tryAttach({
        floor, edge: choice.edge, sizeClass: ROOM_SIZE.NORMAL,
        role: ROOM_ROLE.WORKROOM, department, depth, rng: layoutRng,
        roleTagQuery: ['COMBAT_CAPABLE', 'NORMAL'],
      });
    }
    floor.metrics.deadEndsBeforeSpecials = this.#countDeadEnds(floor);
    if (floor.metrics.deadEndsBeforeSpecials < Math.min(3, needed)) {
      throw new GenerationError(
        `only ${floor.metrics.deadEndsBeforeSpecials} dead ends, need ${needed}`, 'deadEnds',
      );
    }
  }

  #countDeadEnds(floor) {
    let count = 0;
    for (const node of floor.nodes.values()) {
      if (node.hidden) continue;
      if (node.role === ROOM_ROLE.START) continue;
      if (node.isDeadEnd(floor)) count += 1;
    }
    return count;
  }

  /**
   * Step 6. Manager Office at or near the greatest traversable graph distance
   * from Start among eligible dead ends (R-FLR-002).
   *
   * The arena is appended as a new room rather than converting the dead end,
   * because R-BSS-005 allows boss arenas to use large authored footprints and a
   * one-cell dead end could not host them.
   */
  #placeBoss({ floor, layoutRng, department, depth }) {
    const dist = floor.distances(floor.startNodeId);
    const anchors = [...floor.nodes.values()]
      .filter((n) => !n.hidden && n.role !== ROOM_ROLE.START && dist.has(n.id))
      .sort((a, b) => {
        const d = (dist.get(b.id) ?? 0) - (dist.get(a.id) ?? 0);
        if (d !== 0) return d;
        // Prefer dead ends at equal distance, then stable id order.
        const aDead = a.isDeadEnd(floor) ? 0 : 1;
        const bDead = b.isDeadEnd(floor) ? 0 : 1;
        if (aDead !== bDead) return aDead - bDead;
        return a.id < b.id ? -1 : 1;
      });

    for (const anchor of anchors) {
      const edges = this.#openEdges(floor).filter((e) => e.nodeId === anchor.id);
      for (const edge of layoutRng.shuffle(edges)) {
        for (const sizeClass of [ROOM_SIZE.LARGE, ROOM_SIZE.DOUBLE, ROOM_SIZE.NORMAL]) {
          const node = this.#tryAttach({
            floor, edge, sizeClass, role: ROOM_ROLE.MANAGER_OFFICE,
            department, depth, rng: layoutRng, doorClass: DOOR_CLASS.BOSS,
          });
          if (node) {
            floor.bossNodeId = node.id;
            node.graphDistance = (dist.get(anchor.id) ?? 0) + 1;
            floor.metrics.bossDistance = node.graphDistance;
            return;
          }
        }
      }
    }
    throw new GenerationError('could not place Manager Office', 'boss');
  }

  /**
   * Step 7. Supply Closet and Shop on remaining eligible dead ends or near-dead
   * ends, as far from Start as the graph allows so they are a detour, not a
   * doorstep (R-FLR-006 guarantees exactly one of each).
   */
  #placeGuaranteedSpecials({ floor, floorDef, layoutRng, department, depth }) {
    const plan = [
      { role: ROOM_ROLE.SUPPLY_CLOSET, cost: floorDef.supplyClosetCost },
      { role: ROOM_ROLE.SHOP, cost: floorDef.shopDoorCost },
    ];
    for (const { role, cost } of plan) {
      const placedNode = this.#appendSpecial({
        floor, layoutRng, department, depth, role,
        doorClass: COST_TO_DOOR_CLASS[cost] ?? DOOR_CLASS.NORMAL,
        accessCost: cost,
        preferFar: true,
      });
      if (!placedNode) throw new GenerationError(`could not place ${role}`, 'specials');
    }
  }

  /**
   * Step 8. Optional special rooms by probability, access requirement, dead-end
   * rule, and mutual exclusion.
   */
  #placeOptionalSpecials({ floor, floorDef, layoutRng, department, depth, unlockFlags }) {
    const placedRoles = new Set();
    for (const spec of floorDef.optionalRooms) {
      if (spec.minDepth && depth < spec.minDepth) continue;
      if (spec.requiresUnlock && !unlockFlags.has(spec.requiresUnlock)) continue;
      if ((spec.mutuallyExclusiveWith || []).some((r) => placedRoles.has(r))) continue;
      if (!layoutRng.chance(spec.chance)) continue;
      const node = this.#appendSpecial({
        floor, layoutRng, department, depth, role: spec.role,
        doorClass: COST_TO_DOOR_CLASS[spec.accessCost ?? 'NONE'] ?? DOOR_CLASS.NORMAL,
        accessCost: spec.accessCost ?? 'NONE',
        requireDeadEnd: spec.requiresDeadEnd,
        preferFar: false,
      });
      if (node) placedRoles.add(spec.role);
    }
    floor.metrics.optionalRoles = [...placedRoles];
  }

  /** Shared placement for any leaf special room. */
  #appendSpecial({
    floor, layoutRng, department, depth, role, doorClass, accessCost,
    requireDeadEnd = false, preferFar = false,
  }) {
    const dist = floor.distances(floor.startNodeId);
    // Never hang a special room off the boss arena or another special room:
    // specials are destinations, not corridors.
    const hostRoles = new Set([
      ROOM_ROLE.WORKROOM, ROOM_ROLE.LARGE_WORKROOM, ROOM_ROLE.HALLWAY, ROOM_ROLE.START,
    ]);
    let hosts = [...floor.nodes.values()].filter(
      (n) => !n.hidden && hostRoles.has(n.role) && dist.has(n.id),
    );
    if (requireDeadEnd) {
      const deadEnds = hosts.filter((n) => n.isDeadEnd(floor) && n.role !== ROOM_ROLE.START);
      if (deadEnds.length > 0) hosts = deadEnds;
    }
    // Start room is a last resort host.
    hosts.sort((a, b) => {
      const aStart = a.role === ROOM_ROLE.START ? 1 : 0;
      const bStart = b.role === ROOM_ROLE.START ? 1 : 0;
      if (aStart !== bStart) return aStart - bStart;
      const da = dist.get(a.id) ?? 0;
      const db = dist.get(b.id) ?? 0;
      if (da !== db) return preferFar ? db - da : da - db;
      return a.id < b.id ? -1 : 1;
    });

    for (const host of hosts) {
      const edges = this.#openEdges(floor).filter((e) => e.nodeId === host.id);
      for (const edge of layoutRng.shuffle(edges)) {
        for (const sizeClass of [ROOM_SIZE.NORMAL, ROOM_SIZE.TINY, ROOM_SIZE.DOUBLE]) {
          const node = this.#tryAttach({
            floor, edge, sizeClass, role, department, depth, rng: layoutRng, doorClass,
          });
          if (node) {
            node.accessCost = accessCost;
            node.graphDistance = (dist.get(host.id) ?? 0) + 1;
            return node;
          }
        }
      }
    }
    return null;
  }

  /**
   * Step 9. Hidden rooms (GDD 11.7).
   *
   * Maintenance Access prefers an empty grid position adjacent to two to four
   * ordinary rooms, so a player who suspects a gap in the map has several walls
   * worth trying. Forgotten Cubicle attaches to a single non-special room near a
   * distant dead end.
   */
  #placeSecrets({ floor, floorDef, layoutRng, department, depth }) {
    const secrets = floorDef.secretRooms || {};
    floor.metrics.secrets = [];

    if (layoutRng.chance(secrets.maintenanceAccess ?? 0)) {
      const node = this.#placeMaintenanceAccess({ floor, layoutRng, department, depth });
      if (node) floor.metrics.secrets.push(ROOM_ROLE.MAINTENANCE_ACCESS);
    }

    if (layoutRng.chance(secrets.forgottenCubicle ?? 0)) {
      const dist = floor.distances(floor.startNodeId);
      const ordinaryRoles = new Set([ROOM_ROLE.WORKROOM, ROOM_ROLE.LARGE_WORKROOM, ROOM_ROLE.HALLWAY]);
      const hosts = [...floor.nodes.values()]
        .filter((n) => !n.hidden && ordinaryRoles.has(n.role) && dist.has(n.id))
        .sort((a, b) => (dist.get(b.id) ?? 0) - (dist.get(a.id) ?? 0));
      for (const host of hosts) {
        const edges = this.#openEdges(floor).filter((e) => e.nodeId === host.id);
        let done = false;
        for (const edge of layoutRng.shuffle(edges)) {
          const node = this.#tryAttach({
            floor, edge, sizeClass: ROOM_SIZE.TINY, role: ROOM_ROLE.FORGOTTEN_CUBICLE,
            department, depth, rng: layoutRng,
            doorClass: DOOR_CLASS.BLAST_SECRET, hidden: true,
          });
          if (node) {
            floor.metrics.secrets.push(ROOM_ROLE.FORGOTTEN_CUBICLE);
            done = true;
            break;
          }
        }
        if (done) break;
      }
    }
  }

  #placeMaintenanceAccess({ floor, layoutRng, department, depth }) {
    // Collect empty cells adjacent to 2..4 distinct ordinary rooms.
    const counts = new Map();
    for (const node of floor.nodes.values()) {
      if (node.hidden) continue;
      // A hidden room reached by blasting a boss arena or shop wall would break
      // the fiction and the door contract, so only ordinary rooms qualify.
      if (SPECIAL_ROLES.has(node.role) && node.role !== ROOM_ROLE.START) continue;
      for (const [ax, ay] of node.cells) {
        for (const side of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
          const [dx, dy] = sideDelta(side);
          const nx = ax + dx;
          const ny = ay + dy;
          if (floor.occupied(nx, ny)) continue;
          const key = cellKey(nx, ny);
          let entry = counts.get(key);
          if (!entry) {
            entry = { cell: [nx, ny], neighbours: new Map() };
            counts.set(key, entry);
          }
          if (!entry.neighbours.has(node.id)) {
            entry.neighbours.set(node.id, { node, absCell: [ax, ay], side });
          }
        }
      }
    }

    const candidates = [...counts.values()]
      .filter((c) => c.neighbours.size >= 2 && c.neighbours.size <= 4)
      // More adjacent rooms means more walls worth blasting: strictly better.
      .sort((a, b) => b.neighbours.size - a.neighbours.size
        || (a.cell[0] - b.cell[0]) || (a.cell[1] - b.cell[1]));

    for (const candidate of candidates) {
      const templates = this.templateIndex.candidates({
        department, depth, role: ROOM_ROLE.MAINTENANCE_ACCESS,
      });
      if (templates.length === 0) return null;
      // Try each adjacent room as the blast entrance.
      for (const neighbour of layoutRng.shuffle([...candidate.neighbours.values()])) {
        const host = neighbour.node;
        const hostNorm = [
          neighbour.absCell[0] - host.origin[0],
          neighbour.absCell[1] - host.origin[1],
        ];
        const edge = {
          nodeId: host.id,
          normCell: hostNorm,
          absCell: neighbour.absCell,
          side: neighbour.side,
        };
        if (host.requiredSockets.has(socketKey(hostNorm[0], hostNorm[1], neighbour.side))) continue;
        const node = this.#tryAttach({
          floor, edge, sizeClass: ROOM_SIZE.NORMAL, role: ROOM_ROLE.MAINTENANCE_ACCESS,
          department, depth, rng: layoutRng,
          doorClass: DOOR_CLASS.BLAST_SECRET, hidden: true,
        });
        if (node) {
          node.metrics = { adjacentOrdinaryRooms: candidate.neighbours.size };
          return node;
        }
      }
    }
    return null;
  }

  /**
   * Step 10. Select an authored template per node satisfying footprint, socket
   * mask, department, role, and depth. Uses the ROOM_TEMPLATE stream so template
   * variation is independent of layout topology.
   */
  #selectTemplates({ floor, templateRng, department, depth }) {
    // Deterministic node order: template choice must not depend on Map insertion.
    const nodes = [...floor.nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const node of nodes) {
      const requiredSockets = [...node.requiredSockets].map(([key, cls]) => decodeSocketReq(key, cls));
      const candidates = this.templateIndex.candidates({
        department, depth, shapeId: node.shapeId, role: node.role, requiredSockets,
      });
      if (candidates.length === 0) {
        throw new GenerationError(
          `no template for ${node.role} shape ${node.shapeId} with ${requiredSockets.length} sockets`,
          'template',
        );
      }
      const chosen = templateRng.pickWeighted(candidates, (t) => t.weight);
      node.templateId = chosen.id;
      node.tags = [...chosen.roleTags];

      // Bind each edge endpoint to a concrete authored socket id.
      for (const edgeId of node.edgeIds) {
        const edge = floor.edges.get(edgeId);
        const endpoint = edge.a.nodeId === node.id ? edge.a : edge.b;
        const options = chosen.socketsAt(endpoint.cell[0], endpoint.cell[1], endpoint.side)
          .filter((s) => s.classes.includes(edge.doorClass));
        if (options.length === 0) {
          throw new GenerationError(
            `template ${chosen.id} lacks a ${edge.doorClass} socket at ${endpoint.side}`,
            'template',
          );
        }
        endpoint.socketId = templateRng.pick(options).id;
      }
    }
  }

  /** Record derived data the later layers and the map UI consume. */
  #finalise(floor, targetNormalNodes) {
    const dist = floor.distances(floor.startNodeId);
    for (const node of floor.nodes.values()) {
      if (dist.has(node.id)) node.graphDistance = dist.get(node.id);
      node.doors = node.edgeIds.map((edgeId) => {
        const edge = floor.edges.get(edgeId);
        const near = edge.a.nodeId === node.id ? edge.a : edge.b;
        const far = edge.a.nodeId === node.id ? edge.b : edge.a;
        return {
          edgeId,
          socketId: near.socketId,
          side: near.side,
          cell: near.cell,
          doorClass: edge.doorClass,
          toNodeId: far.nodeId,
          locked: edge.locked,
          discovered: edge.discovered,
        };
      });
    }
    floor.metrics.nodeCount = floor.nodes.size;
    floor.metrics.edgeCount = floor.edges.size;
    floor.metrics.targetNormalNodes = targetNormalNodes;
    floor.metrics.deadEnds = this.#countDeadEnds(floor);
    floor.metrics.roleCounts = floor.roleCounts();
    floor.metrics.sizeCounts = [...floor.nodes.values()].reduce((acc, n) => {
      acc[n.sizeClass] = (acc[n.sizeClass] || 0) + 1;
      return acc;
    }, {});
  }
}

function decodeSocketReq(key, doorClass) {
  const [x, y, side] = key.split(',');
  return { cell: [Number(x), Number(y)], side, doorClass };
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export { Floor, RoomNode, TemplateIndex };
