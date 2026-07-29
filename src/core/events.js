/**
 * Deterministic event bus and simulation phase order.
 *
 * GDD refs: 20.5 (Event ordering), 4.4 (Feedback hierarchy), R-CMB-005,
 *           R-TEC-007 (presentation reduction cannot alter combat results).
 *
 * Two mechanisms live here:
 *
 *  1. `PHASE` — the fixed simulation phase order. Systems register work against
 *     a phase, and the scheduler always runs phases in ascending numeric order.
 *     Two systems in the same phase run in registration order, which is stable
 *     because registration happens at boot from static module imports.
 *
 *  2. `EventBus` — a synchronous, priority-ordered signal bus for gameplay
 *     events. Listener priority is explicit, never insertion-luck. Emissions
 *     made while an event is being dispatched are queued and drained after the
 *     current dispatch completes, so callback order never depends on call depth.
 */

/** Canonical simulation phases, straight from GDD 20.5. */
export const PHASE = Object.freeze({
  INPUT: 10,
  MOVEMENT_INTENT: 20,
  AI_INTENT: 30,
  ATTACK_CREATION: 40,
  PHYSICS: 50,
  DAMAGE: 60,
  DEATH: 70,
  ON_HIT_EFFECTS: 80,
  ROOM_CLEAR: 90,
  REWARD_UNLOCK: 100,
  PRESENTATION: 110,
});

const PHASE_ORDER = Object.freeze(
  Object.entries(PHASE)
    .sort((a, b) => a[1] - b[1])
    .map(([name, value]) => ({ name, value })),
);

/** Runs registered per-phase work in strict GDD order every simulation tick. */
export class PhaseScheduler {
  constructor() {
    /** @type {Map<number, Array<{label: string, fn: Function}>>} */
    this.byPhase = new Map();
    for (const { value } of PHASE_ORDER) this.byPhase.set(value, []);
  }

  /**
   * @param {number} phase one of PHASE
   * @param {string} label diagnostic name, shown in traces
   * @param {(dt:number, ctx:object)=>void} fn
   */
  register(phase, label, fn) {
    const bucket = this.byPhase.get(phase);
    if (!bucket) throw new Error(`Unknown simulation phase ${phase} for "${label}".`);
    bucket.push({ label, fn });
    return this;
  }

  /** Run one full tick. `dt` is the fixed simulation step in seconds. */
  tick(dt, ctx) {
    for (const { value } of PHASE_ORDER) {
      const bucket = this.byPhase.get(value);
      for (let i = 0; i < bucket.length; i += 1) bucket[i].fn(dt, ctx);
    }
  }

  /** Phase list for debug overlays. */
  describe() {
    return PHASE_ORDER.map(({ name, value }) => ({
      phase: name,
      order: value,
      systems: this.byPhase.get(value).map((s) => s.label),
    }));
  }
}

/**
 * Listener priority bands. Lower runs first. Gameplay always resolves before
 * presentation, which is what makes R-TEC-007 hold: turning particles off cannot
 * reorder or skip a mechanical callback.
 */
export const LISTENER_PRIORITY = Object.freeze({
  GUARD: 0,        // veto / validation, may cancel
  MECHANIC: 100,   // core rules: health, doors, room state
  ITEM: 200,       // item and charm reactions
  PROGRESSION: 300, // unlocks, counters, collection
  PRESENTATION: 400, // vfx, audio, banners, screen shake
});

/** Synchronous priority-ordered event bus. */
export class EventBus {
  constructor() {
    /** @type {Map<string, Array<{priority:number, seq:number, fn:Function, once:boolean, tag:string}>>} */
    this.listeners = new Map();
    this.queue = [];
    this.dispatching = false;
    this.seq = 0;
    /** Optional trace sink for debug builds; receives every dispatched event. */
    this.trace = null;
  }

  /**
   * @param {string} type event name
   * @param {Function} fn handler, receives the event payload
   * @param {{priority?: number, once?: boolean, tag?: string}} [opts]
   * @returns {() => void} unsubscribe
   */
  on(type, fn, opts = {}) {
    const entry = {
      priority: opts.priority ?? LISTENER_PRIORITY.MECHANIC,
      seq: this.seq++,
      fn,
      once: Boolean(opts.once),
      tag: opts.tag || fn.name || 'anonymous',
    };
    let bucket = this.listeners.get(type);
    if (!bucket) {
      bucket = [];
      this.listeners.set(type, bucket);
    }
    bucket.push(entry);
    // Stable sort: priority first, then registration order.
    bucket.sort((a, b) => (a.priority - b.priority) || (a.seq - b.seq));
    return () => this.off(type, fn);
  }

  once(type, fn, opts = {}) {
    return this.on(type, fn, { ...opts, once: true });
  }

  off(type, fn) {
    const bucket = this.listeners.get(type);
    if (!bucket) return;
    const idx = bucket.findIndex((e) => e.fn === fn);
    if (idx >= 0) bucket.splice(idx, 1);
  }

  /**
   * Emit an event. Nested emits are queued and drained in FIFO order after the
   * current dispatch, so behaviour never depends on how deep a callback chain
   * happens to be.
   *
   * A listener may set `event.cancelled = true`; later listeners are skipped.
   */
  emit(type, payload = {}) {
    const event = payload;
    event.type = type;
    if (this.dispatching) {
      this.queue.push(event);
      return event;
    }
    this.dispatching = true;
    try {
      this.#dispatch(event);
      while (this.queue.length > 0) {
        this.#dispatch(this.queue.shift());
      }
    } finally {
      this.dispatching = false;
    }
    return event;
  }

  #dispatch(event) {
    if (this.trace) this.trace(event);
    const bucket = this.listeners.get(event.type);
    if (!bucket || bucket.length === 0) return;
    // Snapshot: listeners added during dispatch do not see this event.
    const snapshot = bucket.slice();
    for (let i = 0; i < snapshot.length; i += 1) {
      const entry = snapshot[i];
      if (event.cancelled) break;
      entry.fn(event);
      if (entry.once) this.off(event.type, entry.fn);
    }
  }

  /** Remove every listener. Used between runs so nothing leaks across sessions. */
  clear() {
    this.listeners.clear();
    this.queue.length = 0;
    this.seq = 0;
  }
}

/**
 * Canonical gameplay event names. Systems must use these constants instead of
 * raw strings so typos fail at import time rather than silently never firing.
 */
export const EVENTS = Object.freeze({
  // Run lifecycle
  RUN_STARTED: 'run:started',
  RUN_ENDED: 'run:ended',
  FLOOR_ENTERED: 'floor:entered',
  FLOOR_GENERATED: 'floor:generated',
  ELEVATOR_USED: 'elevator:used',

  // Room lifecycle (GDD 6.1)
  ROOM_ENTERED: 'room:entered',
  ROOM_DOORS_LOCKED: 'room:doorsLocked',
  ROOM_WAVE_STARTED: 'room:waveStarted',
  ROOM_CLEARED: 'room:cleared',
  ROOM_DOORS_UNLOCKED: 'room:doorsUnlocked',
  ROOM_REWARD_ROLLED: 'room:rewardRolled',
  ROOM_EXITED: 'room:exited',

  // Combat
  ATTACK_FIRED: 'combat:attackFired',
  PROJECTILE_SPAWNED: 'combat:projectileSpawned',
  PROJECTILE_DESTROYED: 'combat:projectileDestroyed',
  DAMAGE_PROPOSED: 'combat:damageProposed', // cancellable guard point
  DAMAGE_APPLIED: 'combat:damageApplied',
  ENTITY_KILLED: 'combat:entityKilled',
  STATUS_APPLIED: 'combat:statusApplied',
  STATUS_EXPIRED: 'combat:statusExpired',

  // Player
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_HEALED: 'player:healed',
  PLAYER_DIED: 'player:died',
  PLAYER_REVIVED: 'player:revived',
  PLAYER_INVULN_STARTED: 'player:invulnStarted',
  PLAYER_INVULN_ENDED: 'player:invulnEnded',

  // Collectibles and economy
  ITEM_COLLECTED: 'loot:itemCollected',
  ITEM_SEEN: 'loot:itemSeen',
  WEAPON_EQUIPPED: 'loot:weaponEquipped',
  ACTIVE_USED: 'loot:activeUsed',
  ACTIVE_CHARGED: 'loot:activeCharged',
  POCKET_USED: 'loot:pocketUsed',
  CHARM_EQUIPPED: 'loot:charmEquipped',
  TRANSFORMATION_GAINED: 'loot:transformationGained',
  PICKUP_COLLECTED: 'economy:pickupCollected',
  CREDITS_CHANGED: 'economy:creditsChanged',
  PURCHASE_MADE: 'economy:purchaseMade',
  DOOR_UNLOCKED: 'economy:doorUnlocked',
  TONER_DETONATED: 'economy:tonerDetonated',

  // World
  OBJECT_DESTROYED: 'world:objectDestroyed',
  HAZARD_TRIGGERED: 'world:hazardTriggered',
  SECRET_REVEALED: 'world:secretRevealed',
  MACHINE_USED: 'world:machineUsed',

  // Boss
  BOSS_SPAWNED: 'boss:spawned',
  BOSS_PHASE_CHANGED: 'boss:phaseChanged',
  BOSS_DEFEATED: 'boss:defeated',

  // Progression
  UNLOCK_GRANTED: 'meta:unlockGranted',
  ENDING_RECORDED: 'meta:endingRecorded',
  DISCOVERY_RECORDED: 'meta:discoveryRecorded',
  COUNTER_CHANGED: 'meta:counterChanged',

  // Presentation only (never carries mechanics)
  BANNER_REQUESTED: 'fx:banner',
  SHAKE_REQUESTED: 'fx:shake',
  SFX_REQUESTED: 'fx:sfx',
  MUSIC_REQUESTED: 'fx:music',
  /**
   * R-AUD-003: every audio-only cue has a caption. Emitted by the audio engine whenever a
   * sound recipe declares `captionLoc`, and deliberately emitted even when nothing sounded —
   * a player with audio off must get the same information regardless of the mix.
   */
  CAPTION_SHOWN: 'fx:caption',
});

export { PHASE_ORDER };
