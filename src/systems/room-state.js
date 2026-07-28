/**
 * Room state machine.
 *
 * GDD refs: 6.1 (Combat room lifecycle — the state list below is that pseudocode
 *           turned into states), 12.3 (Combat entry and doors table), 12.5
 *           (required room rewards), 6.5 (active recharge), 3.3 (run states),
 *           R-CMB-001 (door locks are deterministic and tied to the encounter
 *           state machine; no door stays locked after a valid clear and no locked
 *           room can be bypassed without an explicit effect),
 *           R-CMB-006 (prevent impossible clears from unreachable enemies),
 *           R-ENM-002 (readable grace interval before first damage),
 *           R-ROM-002 (zero enemies, one encounter, or a wave sequence),
 *           R-ROM-003 (a large room is one room for clear state and charge),
 *           R-ROM-005 (revisiting restores destroyed-object and pickup state),
 *           R-LOOP-004 (clear rewards are deterministic from the run seed and
 *           room stream), R-LOOP-005 (the floor exit does not force transition).
 */

import { EVENTS } from '../core/events.js';
import { RNG_STREAMS } from '../core/rng.js';
import { ROOM_ROLE } from '../core/constants.js';
import { Timer } from '../core/loop.js';

export const ROOM_STATE = Object.freeze({
  /** Non-hostile, or hostile-but-already-cleared. Doors open. */
  IDLE: 'IDLE',
  /** Player crossed the threshold; doors shut and the grace window runs. */
  GRACE: 'GRACE',
  /** Enemies live, doors sealed. */
  COMBAT: 'COMBAT',
  /** A wave finished but another remains; doors stay sealed (GDD 12.3). */
  WAVE_INTERVAL: 'WAVE_INTERVAL',
  /** Clear condition satisfied; lingering hazards resolving, reward rolling. */
  RESOLVING: 'RESOLVING',
  /** Fully cleared. Doors open and stay open on revisit. */
  CLEARED: 'CLEARED',
  /** Boss sealed until victory or an explicit boss-escape effect. */
  BOSS: 'BOSS',
});

/** How long lingering hazards get to resolve before the reward appears. */
const RESOLVE_SECONDS = 0.35;

export class RoomController {
  /**
   * @param {object} deps
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {import('../core/rng.js').RngSource} deps.rng
   * @param {object} deps.registry content registry
   * @param {object} deps.spawner encounter spawner: { spawn(roomInstance, wave), despawnAll() }
   * @param {object} deps.rewards reward service: { rollClearReward(...), placePedestal(...) }
   */
  constructor({ events, rng, registry, spawner, rewards }) {
    this.events = events;
    this.rng = rng;
    this.registry = registry;
    this.spawner = spawner;
    this.rewards = rewards;

    /** @type {object|null} the live room instance */
    this.room = null;
    this.state = ROOM_STATE.IDLE;
    this.graceTimer = new Timer(0);
    this.resolveTimer = new Timer(RESOLVE_SECONDS);
    this.waveIntervalTimer = new Timer(0);
    this.currentWave = 0;
    /** Watchdog for R-CMB-006. */
    this.stallTimer = 0;
  }

  get isSealed() {
    return this.state === ROOM_STATE.GRACE
      || this.state === ROOM_STATE.COMBAT
      || this.state === ROOM_STATE.WAVE_INTERVAL
      || this.state === ROOM_STATE.BOSS;
  }

  get isCleared() {
    return this.state === ROOM_STATE.CLEARED || this.state === ROOM_STATE.IDLE;
  }

  // -------------------------------------------------------------------------
  // Entry
  // -------------------------------------------------------------------------

  /**
   * Enter a room. Implements GDD 6.1 steps 1-5 and the 12.3 door table.
   *
   * @param {object} roomInstance the generated room, carrying its own persistent
   *        state layer (visited, cleared, doors, destroyedObjects, waves)
   * @param {{fromSocketId?: string}} [opts]
   */
  enter(roomInstance, opts = {}) {
    this.room = roomInstance;
    this.currentWave = 0;
    this.stallTimer = 0;

    const state = roomInstance.state;
    const firstVisit = !state.visited;
    state.visited = true;

    // R-ROM-005: a revisited room restores its persistent state rather than
    // regenerating. Nothing here rerolls anything on a second visit.
    if (state.cleared) {
      this.state = ROOM_STATE.CLEARED;
      this.#openDoors('revisit-cleared');
      this.events.emit(EVENTS.ROOM_ENTERED, { room: roomInstance, firstVisit, cleared: true });
      return;
    }

    const isBossRoom = roomInstance.role === ROOM_ROLE.MANAGER_OFFICE
      || roomInstance.role === ROOM_ROLE.CRISIS
      || Boolean(roomInstance.bossId);

    // GDD 12.3: an unvisited non-hostile room keeps its doors open.
    const hostile = Boolean(roomInstance.encounterId) || isBossRoom;
    if (!hostile) {
      this.state = ROOM_STATE.IDLE;
      state.cleared = true;
      this.#openDoors('non-hostile');
      this.events.emit(EVENTS.ROOM_ENTERED, { room: roomInstance, firstVisit, cleared: true });
      return;
    }

    this.events.emit(EVENTS.ROOM_ENTERED, { room: roomInstance, firstVisit, cleared: false });

    // Doors close after the player crosses the entry threshold, and the grace
    // window begins (GDD 12.3, R-ENM-002).
    this.#lockDoors(opts.fromSocketId);

    if (isBossRoom) {
      this.state = ROOM_STATE.BOSS;
      this.spawner.spawnBoss(roomInstance);
      this.events.emit(EVENTS.BOSS_SPAWNED, { room: roomInstance, bossId: roomInstance.bossId });
      return;
    }

    const encounter = this.registry.get('encounter', roomInstance.encounterId);
    const grace = encounter?.constraints?.minEntryGraceSeconds ?? 0.8;
    this.graceTimer.start(grace);
    this.state = ROOM_STATE.GRACE;
    // Enemies are staged during grace so the player can read the composition
    // before anything can hurt them — that is the whole point of the window.
    this.spawner.spawn(roomInstance, 0, { staged: true });
    this.events.emit(EVENTS.ROOM_WAVE_STARTED, { room: roomInstance, wave: 0, staged: true });
  }

  /** GDD R-LOOP-005: leaving a cleared floor room is always allowed. */
  exit() {
    if (this.room) this.events.emit(EVENTS.ROOM_EXITED, { room: this.room });
    this.room = null;
    this.state = ROOM_STATE.IDLE;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {object} ctx { player, hostiles, activeDef }
   */
  tick(dt, ctx) {
    if (!this.room) return;

    switch (this.state) {
      case ROOM_STATE.GRACE: {
        if (this.graceTimer.tick(dt)) {
          this.state = ROOM_STATE.COMBAT;
          this.spawner.activate(this.room);
        }
        break;
      }

      case ROOM_STATE.COMBAT: {
        this.#watchdog(dt, ctx);
        if (this.#waveCleared(ctx)) {
          if (this.#hasMoreWaves()) {
            this.currentWave += 1;
            this.waveIntervalTimer.start(0.6);
            this.state = ROOM_STATE.WAVE_INTERVAL;
          } else {
            this.#beginResolution(ctx);
          }
        }
        break;
      }

      case ROOM_STATE.WAVE_INTERVAL: {
        if (this.waveIntervalTimer.tick(dt)) {
          this.spawner.spawn(this.room, this.currentWave, { staged: false });
          this.events.emit(EVENTS.ROOM_WAVE_STARTED, {
            room: this.room, wave: this.currentWave, staged: false,
          });
          this.state = ROOM_STATE.COMBAT;
        }
        break;
      }

      case ROOM_STATE.RESOLVING: {
        if (this.resolveTimer.tick(dt)) this.#completeClear(ctx);
        break;
      }

      case ROOM_STATE.BOSS: {
        this.#watchdog(dt, ctx);
        if (this.#waveCleared(ctx)) this.#beginResolution(ctx);
        break;
      }

      default:
        break;
    }
  }

  /**
   * R-CMB-006: prevent impossible clears. If the required-enemy count stops
   * changing for long enough while unreachable enemies exist, relocate them to a
   * valid spawn zone. Releasing them is the last resort, and either way it is
   * logged rather than silent.
   */
  #watchdog(dt, ctx) {
    const remaining = ctx.hostiles.filter((e) => !e.dead && e.required).length;
    if (remaining === this.#lastRemaining) {
      this.stallTimer += dt;
    } else {
      this.stallTimer = 0;
      this.#lastRemaining = remaining;
    }
    if (this.stallTimer > 8) {
      const stuck = ctx.hostiles.filter((e) => !e.dead && e.required && e.unreachable);
      for (const enemy of stuck) {
        const relocated = this.spawner.relocate(this.room, enemy);
        if (!relocated) {
          enemy.required = false;
          this.events.emit(EVENTS.SHAKE_REQUESTED, { reason: 'watchdog-release' });
        }
      }
      this.stallTimer = 0;
    }
  }

  #lastRemaining = -1;

  /**
   * GDD 6.2: a clear waits for required enemies and waves, not decorative
   * entities or unreachable non-threats.
   */
  #waveCleared(ctx) {
    for (const enemy of ctx.hostiles) {
      if (!enemy.dead && enemy.required) return false;
    }
    return true;
  }

  #hasMoreWaves() {
    const encounter = this.registry.get('encounter', this.room.encounterId);
    if (!encounter) return false;
    const maxWave = encounter.spawnGroups.reduce((m, g) => Math.max(m, g.wave ?? 0), 0);
    return this.currentWave < maxWave;
  }

  /** GDD 6.1: stop hostile spawning and resolve lingering hazards. */
  #beginResolution(ctx) {
    this.spawner.stopSpawning(this.room);
    this.resolveTimer.start(RESOLVE_SECONDS);
    this.state = ROOM_STATE.RESOLVING;
  }

  /** GDD 6.1 tail: unlock doors, roll clear reward, charge actives, record cleared. */
  #completeClear(ctx) {
    const room = this.room;
    room.state.cleared = true;

    this.#openDoors('cleared');

    // R-LOOP-004: the reward roll is deterministic from the run seed and the room
    // stream, so a replay of the same seed produces the same reward.
    const encounter = this.registry.get('encounter', room.encounterId);
    const profile = encounter?.rewardProfile ?? 'NORMAL_CLEAR';
    if (profile !== 'NONE') {
      const rng = this.rng.stream(RNG_STREAMS.LOOT_PICKUP, room.floorId, room.id, 'clear');
      const reward = this.rewards.rollClearReward({ room, profile, rng });
      if (reward) this.events.emit(EVENTS.ROOM_REWARD_ROLLED, { room, reward });
    }

    // GDD 6.5 / R-CMB-003: one charge unit for a normal room; two only when the
    // room is explicitly tagged high-effort. Size alone never grants free charge.
    const units = room.highEffort ? 2 : 1;
    this.events.emit(EVENTS.ACTIVE_CHARGED, { room, units });

    this.state = room.bossId ? ROOM_STATE.CLEARED : ROOM_STATE.CLEARED;
    this.events.emit(EVENTS.ROOM_CLEARED, { room, wave: this.currentWave });
  }

  // -------------------------------------------------------------------------
  // Doors
  // -------------------------------------------------------------------------

  /**
   * Seal the room. The entry door is sealed too — GDD 6.2 says hostile rooms lock
   * their normal exits when combat begins, and letting the player back out the
   * way they came would make every encounter optional.
   */
  #lockDoors(fromSocketId) {
    for (const door of this.room.doors) {
      door.combatLocked = true;
    }
    this.events.emit(EVENTS.ROOM_DOORS_LOCKED, { room: this.room, fromSocketId });
  }

  #openDoors(reason) {
    for (const door of this.room.doors) {
      door.combatLocked = false;
    }
    this.events.emit(EVENTS.ROOM_DOORS_UNLOCKED, { room: this.room, reason });
  }

  /**
   * Explicit escape override (GDD 6.2, 12.3: "Exceptional escape effects use
   * explicit override hooks"). CARD-001 Meeting Canceled and CARD-017 Desk Move
   * call this rather than mutating door state directly, which keeps R-CMB-001's
   * "no locked room can be bypassed without an explicit effect" auditable.
   */
  forceEscape(reason) {
    if (!this.isSealed) return true;
    if (this.state === ROOM_STATE.BOSS && !this.room.allowBossEscape) return false;
    this.#openDoors(`escape:${reason}`);
    return true;
  }

  /** True when a door may currently be traversed. */
  canTraverse(door, player) {
    if (door.combatLocked) return false;
    if (door.locked) {
      // Access-card doors are opened by an explicit interaction, not by walking.
      return false;
    }
    return true;
  }

  save() {
    return {
      roomId: this.room?.id ?? null,
      state: this.state,
      currentWave: this.currentWave,
      graceTimer: this.graceTimer.save(),
      resolveTimer: this.resolveTimer.save(),
      waveIntervalTimer: this.waveIntervalTimer.save(),
    };
  }

  load(state, roomInstance) {
    this.room = roomInstance;
    this.state = state.state;
    this.currentWave = state.currentWave;
    this.graceTimer.load(state.graceTimer);
    this.resolveTimer.load(state.resolveTimer);
    this.waveIntervalTimer.load(state.waveIntervalTimer);
    return this;
  }
}
