/**
 * Run manager.
 *
 * GDD refs: 20.2 (Run Manager: creates seed, route, profile, difficulty, run
 *           state, transitions, endings, and run persistence), 3.3 (run states),
 *           10.2 (two-floor chapter rule), 11.4 step 14 (persist the complete
 *           generated floor before the player gains control), 21.3 (seed modes),
 *           R-LOOP-005 (the floor exit does not force an immediate transition),
 *           R-TEC-008 (floors are persisted instances, not regenerated on
 *           revisit), R-SAV-003 (entered-seed runs do not unlock by default).
 *
 * This is the integration hub: it owns the seed, the RNG source, the route
 * position, the current floor and room, and the player. Everything else is a
 * service it calls. Keeping transitions in one place is what makes the state
 * machine in GDD 3.3 auditable rather than emergent.
 */

import { RngSource, generateSeed, isValidSeed, formatSeed, RNG_STREAMS } from '../core/rng.js';
import { EVENTS } from '../core/events.js';
import { ROOM_ROLE, DOOR_CLASS } from '../core/constants.js';
import { Player } from '../entities/player.js';
import { FloorGenerator } from './floorgen.js';
import { makeFloorValidator } from './floor-validate.js';
import { TemplateIndex } from './template-index.js';
import { buildRoom, NON_HOSTILE_ROLES } from './room-build.js';

/** Run states from GDD 3.3. */
export const RUN_STATE = Object.freeze({
  SETUP: 'NEW_RUN_SETUP',
  FLOOR_EXPLORATION: 'FLOOR_EXPLORATION',
  ROOM_COMBAT: 'ROOM_COMBAT',
  ROOM_RESOLUTION: 'ROOM_RESOLUTION',
  BOSS_RESOLUTION: 'BOSS_RESOLUTION',
  APPARENT_ENDING: 'APPARENT_ENDING',
  RUN_END: 'RUN_END',
});

/** Seed modes from GDD 21.3 and whether unlocks are eligible. */
export const SEED_MODE = Object.freeze({
  NORMAL: { id: 'NORMAL', unlocks: true },
  ENTERED: { id: 'ENTERED', unlocks: false },
  CHALLENGE: { id: 'CHALLENGE', unlocks: true },
  DAILY: { id: 'DAILY', unlocks: false },
  DEBUG: { id: 'DEBUG', unlocks: false },
});

export class Run {
  /**
   * @param {object} deps
   * @param {object} deps.registry content registry
   * @param {import('../core/events.js').EventBus} deps.events
   */
  constructor({ registry, events }) {
    this.registry = registry;
    this.events = events;

    this.seed = null;
    this.rng = null;
    this.mode = SEED_MODE.NORMAL;
    this.state = RUN_STATE.SETUP;
    this.profileId = 'PRF-001';
    this.routeId = 'ROUTE-BASE';
    this.routeStep = 0;
    /** Unlock flags visible to generation gates. */
    this.unlockFlags = new Set();

    this.player = null;
    this.floor = null;
    this.floorDef = null;
    this.department = null;
    this.room = null;
    this.roomNode = null;

    /** Floors already generated this run, keyed by route step (R-TEC-008). */
    this.floorCache = new Map();
    /** Rooms visited this run, for the map and the results screen. */
    this.roomsVisited = 0;
    this.bossesDefeated = [];
    this.elapsedSeconds = 0;

    this._templateIndex = null;
    this._generator = null;
  }

  /** Lazily built so content can be registered after the Run is constructed. */
  get templateIndex() {
    if (!this._templateIndex) {
      this._templateIndex = new TemplateIndex(this.registry.all('roomTemplate'));
    }
    return this._templateIndex;
  }

  get generator() {
    if (!this._generator) {
      this._generator = new FloorGenerator({ templateIndex: this.templateIndex });
    }
    return this._generator;
  }

  /**
   * Begin a new run.
   *
   * @param {object} [opts]
   * @param {string} [opts.seed] omit for a fresh random seed
   * @param {string} [opts.profileId]
   * @param {string} [opts.routeId]
   * @param {object} [opts.mode] one of SEED_MODE
   * @param {Set<string>} [opts.unlockFlags]
   */
  start(opts = {}) {
    const requested = opts.seed;
    if (requested && !isValidSeed(requested)) {
      // Accept loose input from the seed entry field but normalise it, so a
      // shared seed always maps to exactly one run (GDD 21.3).
      this.seed = formatSeed(requested);
      this.mode = opts.mode || SEED_MODE.ENTERED;
    } else if (requested) {
      this.seed = requested.toUpperCase();
      this.mode = opts.mode || SEED_MODE.ENTERED;
    } else {
      this.seed = generateSeed();
      this.mode = opts.mode || SEED_MODE.NORMAL;
    }

    this.rng = new RngSource(this.seed);
    this.profileId = opts.profileId || 'PRF-001';
    this.routeId = opts.routeId || 'ROUTE-BASE';
    this.unlockFlags = new Set(opts.unlockFlags || []);
    this.routeStep = 0;
    this.floorCache.clear();
    this.roomsVisited = 0;
    this.bossesDefeated = [];
    this.elapsedSeconds = 0;

    const profile = this.registry.get('profile', this.profileId);
    this.player = new Player({ profile });
    if (profile) this.player.applyProfile(profile);

    this.state = RUN_STATE.FLOOR_EXPLORATION;
    this.events.emit(EVENTS.RUN_STARTED, {
      seed: this.seed, mode: this.mode.id, profileId: this.profileId, routeId: this.routeId,
    });

    this.enterFloor(0);
    return this;
  }

  /** Resolve which floor definition a route step uses, honouring alternates. */
  #resolveFloorDef(step) {
    const route = this.registry.get('route', this.routeId);
    if (!route) throw new Error(`Unknown route "${this.routeId}".`);
    const entry = route.steps[step];
    if (!entry) return null;

    const alternates = (entry.alternates || []).filter(
      (alt) => !alt.requiresUnlock || this.unlockFlags.has(alt.requiresUnlock),
    );
    if (alternates.length === 0) return this.registry.require('floor', entry.floor);

    // RUN_ROUTE owns high-level route choices so an alternate department cannot
    // shift floor layout or loot sequences (GDD 20.4).
    const rng = this.rng.stream(RNG_STREAMS.RUN_ROUTE, this.routeId, step);
    const options = [
      { floor: entry.floor, weight: 1 },
      ...alternates.map((alt) => ({ floor: alt.floor, weight: alt.weight })),
    ];
    const picked = rng.pickWeighted(options, (o) => o.weight);
    return this.registry.require('floor', picked.floor);
  }

  /**
   * Generate (or restore) a floor and place the player in its start room.
   * GDD 11.4 step 14: the floor is fully persisted before control is handed over.
   */
  enterFloor(step) {
    const floorDef = this.#resolveFloorDef(step);
    if (!floorDef) {
      this.state = RUN_STATE.APPARENT_ENDING;
      this.events.emit(EVENTS.RUN_ENDED, { reason: 'ROUTE_COMPLETE', seed: this.seed });
      return null;
    }
    this.routeStep = step;
    this.floorDef = floorDef;
    this.department = this.registry.get('department', floorDef.department);

    let floor = this.floorCache.get(step);
    if (!floor) {
      const resolved = { ...floorDef, departmentTag: this.department?.tag ?? floorDef.department };
      const validate = makeFloorValidator({ templateIndex: this.templateIndex, floorDef: resolved });
      const result = this.generator.generate({
        floorDef: resolved,
        rngSource: this.rng,
        validate,
        unlockFlags: this.unlockFlags,
      });
      floor = result.floor;
      this.floorCache.set(step, floor);
      this.events.emit(EVENTS.FLOOR_GENERATED, {
        floorId: floor.id, depth: floorDef.depth, metrics: floor.metrics,
        attempts: result.attempts, elapsedMs: result.elapsedMs,
      });
    }
    this.floor = floor;

    this.player.beginFloor();
    const startNode = floor.nodes.get(floor.startNodeId);
    this.enterRoom(startNode, null);
    this.state = RUN_STATE.FLOOR_EXPLORATION;
    this.events.emit(EVENTS.FLOOR_ENTERED, {
      floorId: floor.id, depth: floorDef.depth, department: this.department?.id,
    });
    return floor;
  }

  /** Advance to the next route step. Only the elevator calls this. */
  takeElevator() {
    this.events.emit(EVENTS.ELEVATOR_USED, { fromStep: this.routeStep });
    return this.enterFloor(this.routeStep + 1);
  }

  /**
   * Move the player into a room.
   * @param {object} node graph node
   * @param {string|null} fromSocketId socket the player arrived through
   */
  enterRoom(node, fromSocketId) {
    const room = buildRoom({
      floor: this.floor, node, registry: this.registry, rngSource: this.rng,
    });
    this.roomNode = node;
    this.room = room;

    if (!node.visited) {
      node.visited = true;
      room.state.visited = true;
      this.roomsVisited += 1;
    }

    const entry = room.entryPosition(fromSocketId);
    this.player.px = entry.x;
    this.player.py = entry.y;
    this.player.beginRoom();

    const hostile = this.canBeHostile(node);
    this.state = hostile && !node.cleared ? RUN_STATE.ROOM_COMBAT : RUN_STATE.ROOM_RESOLUTION;
    this.events.emit(EVENTS.ROOM_ENTERED, {
      nodeId: node.id, role: node.role, hostile, cleared: node.cleared, fromSocketId,
    });
    return room;
  }

  /** Can this room role ever hold hostiles? Architecture-independent. */
  canBeHostile(node) {
    if (NON_HOSTILE_ROLES.has(node.role)) return false;
    return true;
  }

  /**
   * Traverse a door. Returns the destination node, or null when refused.
   * The cost check lives in the room controller; this only performs the move.
   */
  useDoor(door) {
    const target = this.floor.nodes.get(door.toNodeId);
    if (!target) return null;
    const edge = this.floor.edges.get(door.edgeId);
    // The far endpoint tells us which socket the player emerges from.
    const farEndpoint = edge.a.nodeId === target.id ? edge.a : edge.b;
    this.events.emit(EVENTS.ROOM_EXITED, { nodeId: this.roomNode.id, toNodeId: target.id });
    return this.enterRoom(target, farEndpoint.socketId);
  }

  /** Reveal a secret door after a successful blast (GDD 11.7, R-AUD-004). */
  revealSecret(edgeId) {
    const edge = this.floor.edges.get(edgeId);
    if (!edge || edge.discovered) return false;
    edge.discovered = true;
    // A discovered hidden room becomes an ordinary traversable node for the rest
    // of the floor (GDD 11.7), so both sides need their openings punched.
    for (const endpoint of [edge.a, edge.b]) {
      const node = this.floor.nodes.get(endpoint.nodeId);
      if (!node) continue;
      const door = node.doors.find((d) => d.edgeId === edgeId);
      if (door) door.discovered = true;
      // Force a rebuild so the wall opening appears.
      if (node._instance) node._instance = null;
    }
    const hidden = this.floor.nodes.get(edge.a.nodeId)?.hidden
      ? edge.a.nodeId : edge.b.nodeId;
    this.events.emit(EVENTS.SECRET_REVEALED, { edgeId, nodeId: hidden });
    return true;
  }

  /** Boss defeated on this floor. */
  recordBossDefeat(bossId) {
    this.bossesDefeated.push(bossId);
    this.state = RUN_STATE.BOSS_RESOLUTION;
    this.events.emit(EVENTS.BOSS_DEFEATED, {
      bossId, floorId: this.floor.id, depth: this.floorDef.depth,
      noDamageTaken: this.player.damageTakenThisRoom === 0,
    });
  }

  /** Player died. */
  endRun(reason) {
    this.state = RUN_STATE.RUN_END;
    this.events.emit(EVENTS.RUN_ENDED, {
      reason,
      seed: this.seed,
      mode: this.mode.id,
      unlocksEligible: this.mode.unlocks,
      depth: this.floorDef?.depth ?? 0,
      floorsReached: this.routeStep + 1,
      roomsVisited: this.roomsVisited,
      bossesDefeated: [...this.bossesDefeated],
      elapsedSeconds: this.elapsedSeconds,
    });
  }

  /** Advance the run clock. Called once per simulation step. */
  tick(dt) {
    this.elapsedSeconds += dt;
  }

  /** Is the floor exit usable? R-LOOP-005: available, never forced. */
  get exitAvailable() {
    const boss = this.floor?.nodes.get(this.floor.bossNodeId);
    return Boolean(boss?.cleared);
  }

  /** Doors the player may currently traverse, with their cost. */
  availableDoors() {
    if (!this.roomNode) return [];
    return this.roomNode.doors
      .filter((d) => d.discovered)
      .map((d) => ({
        ...d,
        cost: doorCost(d.doorClass),
        affordable: this.canAffordDoor(d),
      }));
  }

  canAffordDoor(door) {
    const cost = doorCost(door.doorClass);
    if (cost.accessCards > 0) return this.player.resources.accessCards >= cost.accessCards;
    return true;
  }

  /** Serialisable run save (GDD 21.1 "Run continue", G.9). */
  save() {
    return {
      schemaVersion: 1,
      contentVersion: this.registry.contentVersion,
      seed: this.seed,
      mode: this.mode.id,
      profileId: this.profileId,
      routeId: this.routeId,
      routeStep: this.routeStep,
      floorDefId: this.floorDef?.id ?? null,
      currentNodeId: this.roomNode?.id ?? null,
      rngStreamStates: this.rng.save(),
      player: this.player.save(),
      floors: [...this.floorCache.entries()].map(([step, floor]) => ({ step, floor: floor.save() })),
      unlockFlags: [...this.unlockFlags],
      roomsVisited: this.roomsVisited,
      bossesDefeated: [...this.bossesDefeated],
      elapsedSeconds: this.elapsedSeconds,
      state: this.state,
    };
  }
}

/** Access cost per door class (GDD 9.2, 12.4). */
export function doorCost(doorClass) {
  switch (doorClass) {
    case DOOR_CLASS.LOCKED_CARD: return { accessCards: 1, credits: 0, health: 0 };
    case DOOR_CLASS.LOCKED_DOUBLE: return { accessCards: 2, credits: 0, health: 0 };
    case DOOR_CLASS.RESTRICTED: return { accessCards: 0, credits: 0, health: 1 };
    default: return { accessCards: 0, credits: 0, health: 0 };
  }
}

export { ROOM_ROLE };
