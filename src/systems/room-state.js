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

/**
 * How long a sealed room may go with nothing changing before it releases itself.
 *
 * Generously long. The count resets this on every kill and every spawn, so tripping it
 * means the player has neither killed nor been given anything for the whole window — which
 * is not a hard fight, it is a stuck room.
 */
const DEADLOCK_SECONDS = 25;

/**
 * Absolute ceiling on how long an ordinary room may hold the player, in seconds.
 *
 * Nothing resets this — that is the point. The damage-based failsafe above can be defeated
 * by anything that makes total enemy health drift downward on its own (a splitter's
 * children, an add dying to a hazard), and two IT rooms did exactly that in a sweep. This
 * one cannot be gamed by any enemy behaviour.
 *
 * Deliberately long: a normal encounter resolves in fifteen to thirty seconds, so seventy-five
 * is well past "hard" and firmly into "broken". BOSS rooms are exempt — Appendix E designs
 * those as two-to-four-minute fights, and the damage-based failsafe still covers them.
 */
const SEALED_HARD_CAP_SECONDS = 75;

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
    this.deadlockTimer = 0;
    this.deadlockReleased = false;
    this.sealedSeconds = 0;
    this.#lastHealth = Infinity;

    // Tell the spawner which room the player is in FIRST, unconditionally.
    //
    // This used to happen only as a side effect of spawn()/spawnBoss(), both of which the
    // early returns below skip for non-hostile and already-cleared rooms. Two consequences,
    // and the second is worse than the first: the player could not attack at all in a start
    // room, a shop, or any room they had already finished (player-attack refuses to fire
    // without a current room), and a stale value meant projectiles were tested against the
    // PREVIOUS room's geometry.
    this.spawner.setRoom?.(roomInstance);

    const state = roomInstance.state;
    state.visited = true;

    // R-ROM-005: a revisited room restores its persistent state rather than
    // regenerating. Nothing here rerolls anything on a second visit.
    if (state.cleared) {
      this.state = ROOM_STATE.CLEARED;
      this.#openDoors('revisit-cleared');
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
      return;
    }

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

    // The unconditional failsafe. R-CMB-006 admits no impossible clears, and the
    // relocation pass above only helps enemies already flagged `unreachable` — it did
    // nothing for a cloaked ambusher the player never walked near, an enemy wedged in a
    // doorway, or any cause not yet diagnosed. A player locked in a room they cannot
    // finish has no move left, which is the one state the game must never reach.
    //
    // So: if nothing about the room has changed for a long time, release whatever is left
    // and let the doors open. Long enough that no real fight trips it — a stalled count
    // means no enemy has died and none has spawned for this whole window — and the release
    // is announced with a shake so it never looks like the room silently gave up.
    // Keyed on damage dealt, not on the head-count.
    //
    // Counting bodies looked right and was wrong twice over. A summoner or splitter changes
    // the count on its own, so those rooms never tripped the failsafe at all — two IT rooms
    // stayed sealed indefinitely in a sweep. And a hard fight where the player is dodging
    // rather than killing would have tripped it while they were still perfectly able to win.
    //
    // Total enemy health going DOWN is the honest signal that the player can affect the
    // room. If that has not moved at all for the whole window, the room is not hard — it is
    // unwinnable.
    let health = 0;
    for (const enemy of ctx.hostiles) {
      if (!enemy.dead && enemy.required) health += enemy.health;
    }
    if (health < this.#lastHealth) this.deadlockTimer = 0;
    else this.deadlockTimer = remaining > 0 ? this.deadlockTimer + dt : 0;
    this.#lastHealth = health;

    // The un-resettable ceiling, checked first so no behaviour can starve it.
    this.sealedSeconds += dt;
    const bossFight = this.state === ROOM_STATE.BOSS;
    if (!bossFight && this.sealedSeconds > SEALED_HARD_CAP_SECONDS && remaining > 0) {
      this.#releaseRequired(ctx, `${SEALED_HARD_CAP_SECONDS}s hard cap`);
      return;
    }

    if (this.deadlockTimer > DEADLOCK_SECONDS) {
      this.deadlockTimer = 0;
      // The release is not a clear. Skipping the reward removes any incentive to stand
      // still and wait for the doors, so the failsafe cannot become a strategy.
      this.#releaseRequired(ctx, `${DEADLOCK_SECONDS}s without damage dealt`);
    }
  }

  /**
   * Open the room by giving up on whatever is left in it.
   *
   * The last line of defence for R-CMB-006. A player who cannot finish a room and cannot
   * leave it has no move at all, which is the one state the game must never reach — so this
   * always prefers letting them out over preserving the encounter. It logs loudly because
   * reaching here is a defect somewhere else, not a feature.
   */
  #releaseRequired(ctx, why) {
    this.deadlockReleased = true;
    let released = 0;
    for (const enemy of ctx.hostiles) {
      if (!enemy.dead && enemy.required) { enemy.required = false; released += 1; }
    }
    console.error(
      `Room ${this.room?.nodeId} released (${why}) with ${released} required hostiles alive. `
      + 'This is a failsafe, not a design: something kept the room from being clearable.',
    );
    this.events.emit(EVENTS.SHAKE_REQUESTED, { reason: 'deadlock-release' });
  }

  #lastRemaining = -1;

  /** Seconds without the player reducing any required enemy's health. */
  deadlockTimer = 0;

  /** Set when the failsafe opened the doors, so the clear grants no reward. */
  deadlockReleased = false;

  #lastHealth = Infinity;

  /** Seconds since this room sealed. Never reset by enemy behaviour. */
  sealedSeconds = 0;

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
    // A room the failsafe released was never actually fought, so it pays nothing.
    const profile = this.deadlockReleased ? 'NONE' : (encounter?.rewardProfile ?? 'NORMAL_CLEAR');
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
