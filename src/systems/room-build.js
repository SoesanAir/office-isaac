/**
 * Room instantiation: turn a generated graph node into a playable room.
 *
 * GDD refs: 11.4 step 12 (populate environmental objects, hazards, decorations,
 *           rewards, and machines from separate layers), 12.1 (the layered room
 *           instance), 12.2 (the same template is reused with different object
 *           states, hazards, and decoration variants), R-ROM-005 (revisiting a
 *           cleared room restores its destroyed-object and pickup state),
 *           R-ENV-003 (object contents use object-scoped RNG), R-ENV-004 (no
 *           required door, blast point, pickup, or spawn is permanently blocked).
 *
 * The layering from GDD 12.1 is preserved as distinct arrays rather than one merged
 * entity list, because the same template must be able to appear empty, hostile,
 * hazardous, or decorated purely by which layers were populated (D-006).
 *
 * Persistence: a room is built once and cached on the node. R-ROM-005 requires a
 * revisit to show the same broken cabinets and uncollected pickups, and R-TEC-008
 * requires floors to be persisted instances rather than regenerated on revisit, so
 * rebuilding on every entry would be a defect, not an optimisation.
 */

import { RNG_STREAMS } from '../core/rng.js';
import {
  CELL_W, CELL_H, WALL, DOOR_CLASS, ROOM_ROLE, SPAWN_ZONE,
} from '../core/constants.js';
import { RoomCollision } from './physics.js';

const STRIDE_X = CELL_W + WALL;
const STRIDE_Y = CELL_H + WALL;

/** Door opening width in tiles, centred on the socket position. */
const OPENING_HALF = 1;

/**
 * A playable room instance.
 */
export class RoomInstance {
  constructor({ node, template, department, rect }) {
    this.node = node;
    this.nodeId = node.id;
    this.role = node.role;
    this.template = template;
    this.department = department;
    /** Interior rect in world units. */
    this.rect = rect;
    this.collision = new RoomCollision(template.geometry, { x: rect.x, y: rect.y });

    // GDD 12.1 layers, kept separate on purpose.
    this.objects = [];
    this.hazards = [];
    this.decorations = [];
    this.pickups = [];
    this.spawnPoints = new Map();
    this.rewardAnchor = null;
    this.doorWorldPositions = new Map();

    /**
     * state_layer (GDD 12.1).
     *
     * `visited` and `cleared` delegate to the graph node rather than shadowing it.
     * They are floor-level facts: the map reads them, the generator's validation reads
     * them, and the run save persists them with the floor instance (R-TEC-008,
     * R-ROM-005). Two copies would drift the moment one system updated only its own —
     * which is exactly what happened before this.
     */
    this.state = {
      get visited() { return node.visited; },
      set visited(v) { node.visited = v; },
      get cleared() { return node.cleared; },
      set cleared(v) { node.cleared = v; },
      doorsSealed: false,
      wave: 0,
      destroyedObjectIds: new Set(),
      collectedPickupIds: new Set(),
      rewardSpawned: false,
    };
  }

  /** Centre of the room in world units. */
  get centre() {
    return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 };
  }

  /**
   * The room's doors.
   *
   * Doors belong to the graph node, because the graph is what connects rooms — but
   * the RoomController operates on a room instance and has no business reaching
   * through to the node. So the instance exposes them directly, and there is still
   * exactly one copy of the data (GDD 11.2: a door edge is a property of the graph).
   */
  get doors() {
    return this.node.doors;
  }

  /**
   * The encounter chosen for this room, if any.
   *
   * Assigned by the Run during floor generation (GDD 11.4 step 11) and stored on the
   * graph node, because it has to survive a save and a revisit alongside the rest of
   * the floor instance (R-TEC-008). Exposed here so the room lifecycle can ask a room
   * whether it is hostile without reaching through to the graph.
   */
  get encounterId() {
    return this.node.encounterId;
  }

  /** Boss assigned to this arena, once boss content exists. */
  get bossId() {
    return this.node.bossId ?? null;
  }

  /** Spawn zone rects in world coordinates. */
  zonesOf(zoneKind) {
    return this.spawnPoints.get(zoneKind) || [];
  }

  /**
   * Entry position for a player arriving through a door, placed just inside it.
   * Passing `null` (a fresh floor) uses the room centre.
   */
  entryPosition(fromSocketId) {
    if (fromSocketId && this.doorWorldPositions.has(fromSocketId)) {
      const door = this.doorWorldPositions.get(fromSocketId);
      // Step in by 1.5 units so the player is never standing in the doorway,
      // which would leave them clipped when the door seals (GDD 12.3).
      const inward = { NORTH: [0, 1.5], SOUTH: [0, -1.5], EAST: [-1.5, 0], WEST: [1.5, 0] };
      const [dx, dy] = inward[door.side] || [0, 0];
      return { x: door.x + dx, y: door.y + dy };
    }
    const c = this.centre;
    return { x: c.x, y: c.y };
  }
}

/**
 * World position of a door socket, in world units.
 *
 * Sockets sit in the wall ring. Cell (cx, cy) starts at interior offset
 * (cx * STRIDE_X, cy * STRIDE_Y); the socket offset selects a position along the
 * relevant edge.
 */
export function doorWorldPosition(rect, cell, side, offset) {
  const [cx, cy] = cell;
  const baseX = rect.x + cx * STRIDE_X;
  const baseY = rect.y + cy * STRIDE_Y;
  const alongX = baseX + Math.min(CELL_W - 0.5, offset * CELL_W);
  const alongY = baseY + Math.min(CELL_H - 0.5, offset * CELL_H);
  switch (side) {
    case 'NORTH': return { x: alongX, y: baseY - 0.5, side };
    case 'SOUTH': return { x: alongX, y: baseY + CELL_H - 0.5, side };
    case 'WEST': return { x: baseX - 0.5, y: alongY, side };
    case 'EAST': return { x: baseX + CELL_W - 0.5, y: alongY, side };
    default: return { x: alongX, y: alongY, side };
  }
}

/**
 * Build (or return the cached) room instance for a graph node.
 *
 * @param {object} args
 * @param {object} args.floor generated floor
 * @param {object} args.node graph node
 * @param {object} args.registry content registry
 * @param {object} args.rngSource run RNG source
 * @returns {RoomInstance}
 */
export function buildRoom({ floor, node, registry, rngSource }) {
  if (node._instance) return node._instance;

  const template = registry.require('roomTemplate', node.templateId);
  const department = registry.all('department').find((d) => d.tag === floor.department);
  const rect = floor.interiorRect(node);
  const room = new RoomInstance({ node, template, department, rect });

  // ---- door openings -----------------------------------------------------
  for (const door of node.doors) {
    const socket = template.doorSockets.find((s) => s.id === door.socketId);
    if (!socket) continue;
    const pos = doorWorldPosition(rect, socket.cell, socket.side, socket.offset);
    room.doorWorldPositions.set(socket.id, { ...pos, door });
    // Punch a hole in the wall ring. Secret doors stay solid until revealed
    // (GDD 12.3: "no visible door; valid wall reacts only to reveal or blast").
    const sealed = door.doorClass === DOOR_CLASS.BLAST_SECRET && !door.discovered;
    if (!sealed) addDoorOpening(room, socket, rect);
  }

  // ---- spawn zone layer --------------------------------------------------
  for (const zone of template.spawnZones || []) {
    const [zx, zy, zw, zh] = zone.rect;
    const list = room.spawnPoints.get(zone.zone) || [];
    list.push({ x: rect.x + zx, y: rect.y + zy, w: zw, h: zh });
    room.spawnPoints.set(zone.zone, list);
  }
  const rewardZone = room.zonesOf(SPAWN_ZONE.REWARD)[0];
  room.rewardAnchor = rewardZone
    ? { x: rewardZone.x + rewardZone.w / 2, y: rewardZone.y + rewardZone.h / 2 }
    : room.centre;

  // ---- object layer ------------------------------------------------------
  // OBJECT_CONTENT keeps furniture placement isolated from loot and encounter
  // sequences, so a room full of cabinets cannot shift the next pedestal roll.
  const objectRng = rngSource.stream(RNG_STREAMS.OBJECT_CONTENT, floor.id, node.id, 'place');
  let objectSeq = 0;
  for (const anchor of template.objectAnchors || []) {
    if (!objectRng.chance(anchor.chance)) continue;
    const objectId = objectRng.pick([...anchor.allow]);
    const def = registry.get('envObject', objectId);
    if (!def) continue;
    const worldX = rect.x + anchor.at[0] + 0.5;
    const worldY = rect.y + anchor.at[1] + 0.5;
    const instance = {
      id: `${node.id}-obj${objectSeq++}`,
      defId: def.id,
      variantId: pickVariant(def, anchor.variantHint, objectRng),
      x: worldX,
      y: worldY,
      w: def.collision.w,
      h: def.collision.h,
      blocksMovement: def.collision.blocksMovement,
      blocksProjectiles: def.collision.blocksProjectiles,
      blocksFlying: def.collision.blocksFlying,
      blocksLineOfSight: def.collision.blocksLineOfSight,
      health: def.health ?? 0,
      maxHealth: def.health ?? 0,
      requiresBlast: def.requiresBlast,
      destroyed: false,
    };
    // R-ENV-004: never let a populated object seal a door approach or a blast
    // point. Placement is skipped rather than nudged, because moving it could
    // silently violate the authored layout.
    if (blocksCriticalAccess(room, instance)) continue;
    room.objects.push(instance);
    room.collision.addObject(instance);
  }

  // ---- hazard layer ------------------------------------------------------
  const hazardRng = rngSource.stream(RNG_STREAMS.ROOM_TEMPLATE, floor.id, node.id, 'hazard');
  let hazardSeq = 0;
  for (const anchor of template.hazardAnchors || []) {
    if (!hazardRng.chance(anchor.chance)) continue;
    const def = registry.get('hazard', anchor.hazard);
    if (!def) continue;
    const [hx, hy, hw, hh] = anchor.rect;
    room.hazards.push({
      id: `${node.id}-haz${hazardSeq++}`,
      defId: def.id,
      x: rect.x + hx,
      y: rect.y + hy,
      w: hw,
      h: hh,
      active: def.cycle.mode === 'ALWAYS_ON',
      phase: hazardRng.float(0, 1),
      disabled: false,
    });
  }

  // ---- decoration layer --------------------------------------------------
  // Cosmetic only, so it draws from COSMETIC and can never affect gameplay
  // sequences (GDD 20.4, 22.5).
  const cosmeticRng = rngSource.stream(RNG_STREAMS.COSMETIC, floor.id, node.id);
  room.decorations = buildDecorations(template, rect, cosmeticRng);

  node._instance = room;
  return room;
}

/** Carve a walkable opening through the wall ring at a door socket. */
function addDoorOpening(room, socket, rect) {
  const [cx, cy] = socket.cell;
  const baseX = cx * STRIDE_X;
  const baseY = cy * STRIDE_Y;
  const alongX = baseX + Math.floor(socket.offset * CELL_W);
  const alongY = baseY + Math.floor(socket.offset * CELL_H);
  switch (socket.side) {
    case 'NORTH':
      room.collision.addOpening({
        x0: alongX - OPENING_HALF, x1: alongX + OPENING_HALF,
        y0: baseY - WALL, y1: baseY - 1,
      });
      break;
    case 'SOUTH':
      room.collision.addOpening({
        x0: alongX - OPENING_HALF, x1: alongX + OPENING_HALF,
        y0: baseY + CELL_H, y1: baseY + CELL_H + WALL,
      });
      break;
    case 'WEST':
      room.collision.addOpening({
        x0: baseX - WALL, x1: baseX - 1,
        y0: alongY - OPENING_HALF, y1: alongY + OPENING_HALF,
      });
      break;
    case 'EAST':
      room.collision.addOpening({
        x0: baseX + CELL_W, x1: baseX + CELL_W + WALL,
        y0: alongY - OPENING_HALF, y1: alongY + OPENING_HALF,
      });
      break;
    default:
      break;
  }
}

/**
 * Would this object block a door approach, the reward anchor, or a blast point?
 *
 * The tolerance is generous (2 world units around doors) because a cabinet that
 * merely *narrows* a doorway is fine and interesting, while one centred in it is a
 * soft lock waiting to happen.
 */
function blocksCriticalAccess(room, obj) {
  if (!obj.blocksMovement) return false;
  for (const door of room.doorWorldPositions.values()) {
    if (Math.abs(door.x - obj.x) < 2 && Math.abs(door.y - obj.y) < 2) return true;
  }
  if (room.rewardAnchor
    && Math.abs(room.rewardAnchor.x - obj.x) < 1.5
    && Math.abs(room.rewardAnchor.y - obj.y) < 1.5) {
    return true;
  }
  return false;
}

function pickVariant(def, hint, rng) {
  const variants = def.variants || [];
  if (variants.length === 0) return null;
  if (hint) {
    const match = variants.find((v) => v.id === hint || v.label === hint);
    if (match) return match.id;
  }
  // Most objects should appear in their plain state most of the time, so the
  // base form wins unless the roll lands in the variant band.
  if (!rng.chance(0.28)) return null;
  return rng.pick(variants).id;
}

/**
 * Scatter decorative props from the template's declared decoration sets.
 * GDD R-ROM-004 / R-ENV-005: decoration must never obscure mandatory information,
 * so these carry no collision and are drawn on the floor-decal layer.
 */
function buildDecorations(template, rect, rng) {
  const out = [];
  const sets = template.decorationSets || [];
  if (sets.length === 0) return out;
  const chosen = rng.pick(sets);
  const grid = template.geometry;
  const count = rng.int(2, 7);
  for (let i = 0; i < count; i += 1) {
    // Only place on open floor, and only after confirming the tile is walkable,
    // so a decal never lands inside a wall.
    for (let tries = 0; tries < 12; tries += 1) {
      const lx = rng.int(1, grid[0].length - 2);
      const ly = rng.int(1, grid.length - 2);
      if (grid[ly][lx] !== '.') continue;
      out.push({
        set: chosen,
        x: rect.x + lx + 0.5,
        y: rect.y + ly + 0.5,
        variant: rng.int(0, 3),
      });
      break;
    }
  }
  return out;
}

/**
 * Room roles that never contain hostiles, so the room controller can skip the
 * combat lifecycle entirely (GDD 12.3 "Unvisited non-hostile").
 */
export const NON_HOSTILE_ROLES = new Set([
  ROOM_ROLE.START, ROOM_ROLE.SUPPLY_CLOSET, ROOM_ROLE.SHOP, ROOM_ROLE.BREAK_ROOM,
  ROOM_ROLE.ARCHIVE, ROOM_ROLE.WELLNESS, ROOM_ROLE.NPC_OFFICE, ROOM_ROLE.REC_ROOM,
  ROOM_ROLE.MAINTENANCE_ACCESS, ROOM_ROLE.FORGOTTEN_CUBICLE, ROOM_ROLE.INNOVATION_LAB,
  ROOM_ROLE.EXECUTIVE_STORAGE, ROOM_ROLE.STRATEGY, ROOM_ROLE.SHADOW_PROCUREMENT,
  ROOM_ROLE.EXECUTIVE_DEAL, ROOM_ROLE.UNION_BREAKROOM, ROOM_ROLE.SERVICE_ELEVATOR,
]);

export { STRIDE_X, STRIDE_Y };
