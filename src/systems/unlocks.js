/**
 * Unlock service: watches the event bus and grants unlocks.
 *
 * GDD refs: 16.1 (progression philosophy: unlocks add content, never raw power),
 *           16.2 (fresh-save content), 16.3 (the seven unlock condition families),
 *           16.4 (repeated CEO victories), 16.5 (the deeper hidden route), 16.7 (the
 *           ending registry), R-PRG-001 (an unlock is granted exactly once and is
 *           idempotent across save and reload), R-PRG-002 (an unlock never alters an
 *           in-progress run's difficulty), R-PRG-004 / D-016 (no copy states a total
 *           count of endings, items, or secrets), 21.1 (the Profile save domain owns
 *           unlock flags, counters, endings, and discoveries), 21.3 (an entered seed
 *           disables unlock conditions).
 *
 * ## The shape of the problem
 *
 * Every unlock in content/meta/unlocks.js is `{ trigger, actions }` — an event name plus
 * some fields to match on, and a list of things to do. So this service is a small matcher,
 * not a pile of special cases: adding an unlock is a data change (R-GOV-003), and the only
 * code that ever needs touching is the action table below.
 *
 * ## Two rules that are easy to get wrong
 *
 * **Idempotence is per profile, not per run.** R-PRG-001 requires an unlock to be granted
 * exactly once *ever*. So the guard is the profile's granted set, which the save owns —
 * checking a run-scoped set would re-grant everything on the next launch and re-fire every
 * banner the player has already seen.
 *
 * **An entered seed does not unlock.** GDD 21.3 disables unlock conditions for a shared
 * seed, because otherwise a seed containing a rare boss becomes a way to hand someone the
 * unlock rather than the run. Counters and discoveries still accumulate; only grants stop.
 */

import { EVENTS, LISTENER_PRIORITY } from '../core/events.js';

/** Seed modes that may grant unlocks (GDD 21.3's table). */
const UNLOCKING_SEED_MODES = new Set(['NORMAL', 'CHALLENGE']);


// ---------------------------------------------------------------------------
// Condition hooks
// ---------------------------------------------------------------------------

/**
 * Extra gates an unlock may declare beyond its trigger, keyed by `condition.hook`.
 *
 * The trigger says *when* to look; the condition says *whether it counts*. Ignoring these
 * was a real bug with a nasty shape — three profiles the GDD gates behind real feats
 * ("defeat every IT boss", "complete a run carrying debt", "complete the Facilities
 * branch") unlocked on the player's first boss kill and first death instead, because their
 * triggers are deliberately broad and the condition was carrying all the meaning.
 *
 * Each predicate receives `(payload, ctx)` where ctx is `{ profile, run, params, registry }`
 * and returns a boolean. An unknown hook returns FALSE and logs: refusing to grant is the
 * safe direction, since granting free would hand the player content they never earned and
 * R-PRG-001 means it can never be taken back.
 */
const CONDITIONS = Object.freeze({
  /** Every boss belonging to a department has been defeated at least once, ever. */
  ALL_BOSSES_OF_DEPARTMENT_DEFEATED: (payload, { profile, params, registry }) => {
    const dept = params?.department;
    if (!dept) return false;
    const wanted = registry.all('boss')
      .filter((b) => b.departments.includes(dept))
      .map((b) => b.id);
    if (wanted.length === 0) return false;
    const seen = profile.bossesDefeated || [];
    return wanted.every((id) => seen.includes(id));
  },

  /** The boss that just died was fought without the player taking a hit. */
  BOSS_DEFEATED_WITHOUT_DAMAGE: (payload) => Boolean(payload.noDamageTaken),

  /** Reached a depth without ever taking a Manager Reward (PRF-002 Intern). */
  CLEARED_CHAPTER_WITHOUT_MANAGER_REWARD: (payload, { run, params }) => {
    const depth = params?.throughDepth ?? 2;
    if ((run?.floorDef?.depth ?? 0) < depth) return false;
    return !run?.tookManagerReward;
  },

  /** Finished a run having reached the end of the Facilities branch. */
  COMPLETED_FACILITIES_BRANCH: (payload, { run }) => (
    run?.routeId === 'ROUTE-FACILITIES_BRANCH' && payload.reason === 'ROUTE_COMPLETE'
  ),

  /** Finished a run while still owing on the Corporate Card (PRF-004 Contractor). */
  COMPLETED_RUN_CARRYING_DEBT: (payload, { run }) => (
    payload.reason === 'ROUTE_COMPLETE' && (run?.player?.creditDebt ?? 0) > 0
  ),

  /** Killed a boss while at or under a health floor (PRF-005 Burned-Out Veteran). */
  DEFEATED_AT_OR_BELOW_HEALTH: (payload, { run, params }) => {
    const icons = params?.icons ?? 1;
    const health = run?.player?.health;
    if (!health) return false;
    // Health is in half-units and an icon is two, so this compares like with like.
    return health.composure <= icons * 2;
  },

  /** Holding every ownership key found this run. */
  HAS_ALL_OWNERSHIP_KEYS_THIS_RUN: (payload, { run, params }) => (
    (run?.ownershipKeys?.length ?? 0) >= (params?.count ?? 3)
  ),

  /** Holding enough distinct ownership fragments this run, behind a flag. */
  HAS_DISTINCT_FRAGMENTS_THIS_RUN: (payload, { run, profile, params }) => {
    if (params?.requiresFlag && !profile.flags.includes(params.requiresFlag)) return false;
    const distinct = new Set(run?.ownershipFragments || []);
    return distinct.size >= (params?.count ?? 2);
  },

  /** The deep-route condition: no Executive Deal debt, and a secret found per chapter. */
  NO_DEAL_DEBT_AND_SECRET_PER_CHAPTER: (payload, { run }) => (
    (run?.player?.creditDebt ?? 0) === 0 && Boolean(run?.secretPerChapter)
  ),
});

export class UnlockService {
  /**
   * @param {object} deps
   * @param {object} deps.registry content registry
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {object} deps.profile mutable profile save domain (see save.js)
   * @param {() => object} deps.getRun
   */
  constructor({ registry, events, profile, getRun }) {
    this.registry = registry;
    this.events = events;
    this.profile = profile;
    this.getRun = getRun;

    /** event name -> unlock definitions watching it, so a grant is one map lookup. */
    this.byEvent = new Map();
    for (const unlock of registry.all('unlock')) {
      const key = unlock.trigger?.event;
      if (!key) continue;
      const list = this.byEvent.get(key) || [];
      list.push(unlock);
      this.byEvent.set(key, list);
    }

    this.#subscribe();
  }

  #subscribe() {
    for (const eventName of this.byEvent.keys()) {
      const busEvent = EVENTS[eventName];
      if (!busEvent) {
        // A trigger naming an event the bus does not have can never fire, which makes the
        // unlock dead content. Loud, because the validator cannot see this — trigger.event
        // is a plain string, not a typed reference.
        console.error(`Unlock trigger references unknown event "${eventName}"; it will never fire.`);
        continue;
      }
      this.events.on(busEvent, (payload) => this.#onEvent(eventName, payload || {}), {
        // PROGRESSION runs after mechanics have settled but before presentation, so a
        // banner announcing an unlock cannot beat the thing that caused it.
        priority: LISTENER_PRIORITY.PROGRESSION,
      });
    }
  }

  #onEvent(eventName, payload) {
    // Record the boss before evaluating conditions, so an unlock gated on "every boss of
    // this department" can see the kill that just completed the set.
    if (eventName === 'BOSS_DEFEATED' && payload.bossId) {
      this.profile.bossesDefeated = this.profile.bossesDefeated || [];
      if (!this.profile.bossesDefeated.includes(payload.bossId)) {
        this.profile.bossesDefeated.push(payload.bossId);
      }
    }

    for (const unlock of this.byEvent.get(eventName) || []) {
      if (!this.#matches(unlock, payload)) continue;
      // The condition was already satisfied by #matches; pass the payload so grant's own
      // re-check sees the same facts rather than an empty object.
      this.grant(unlock, { payload });
    }
  }

  /**
   * Does this payload satisfy the trigger?
   *
   * Every field on `trigger` other than `event` is a match condition, compared literally.
   * Keeping it generic rather than switching on family means a new trigger field is a data
   * change; `counter`/`atLeast` are the one exception, since they read accumulated state
   * rather than the payload.
   */
  #matches(unlock, payload) {
    const trigger = unlock.trigger;
    for (const [key, want] of Object.entries(trigger)) {
      if (key === 'event') continue;
      if (key === 'counter') {
        const have = this.profile.counters?.[want] ?? 0;
        if (have < (trigger.atLeast ?? 1)) return false;
        continue;
      }
      if (key === 'atLeast') continue;
      if (key === 'requiresFlag') {
        if (!this.profile.flags?.includes(want)) return false;
        continue;
      }
      if (payload[key] !== want) return false;
    }
    return this.#conditionMet(unlock, payload);
  }

  /**
   * Evaluate an unlock's optional `condition` hook.
   *
   * Absent condition means the trigger alone is the gate, which is correct for the unlocks
   * whose trigger already names a specific boss or floor.
   */
  #conditionMet(unlock, payload) {
    const condition = unlock.condition;
    if (!condition?.hook) return true;
    const predicate = CONDITIONS[condition.hook];
    if (!predicate) {
      // Refusing is the safe direction. Granting free would hand over content the player
      // never earned, and R-PRG-001 means it could never be taken back.
      console.error(`Unlock ${unlock.id} uses unknown condition hook "${condition.hook}"; refusing to grant.`);
      return false;
    }
    return Boolean(predicate(payload, {
      profile: this.profile,
      run: this.getRun?.(),
      params: condition.params,
      registry: this.registry,
    }));
  }

  /** True when the current run is allowed to grant unlocks at all (GDD 21.3). */
  get unlocksEnabled() {
    const run = this.getRun?.();
    if (!run) return true;
    if (run.unlocksDisabled) return false;
    return UNLOCKING_SEED_MODES.has(run.mode ?? 'NORMAL');
  }

  /**
   * Grant an unlock, once.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.force] skip the condition check (challenge completion, debug)
   * @param {object} [opts.payload] event payload the condition may read
   * @returns {boolean} true when this call was the one that granted it
   */
  grant(unlock, { force = false, payload = {} } = {}) {
    const def = typeof unlock === 'string' ? this.registry.get('unlock', unlock) : unlock;
    if (!def) return false;

    // Conditions are checked here too, not only on the event path. A caller reaching for
    // grant() directly — a challenge completion, a debug command — should not be able to
    // hand over a gated unlock by accident. `force` exists for the cases that genuinely mean
    // "award this regardless", and has to be asked for explicitly.
    if (!force && !this.#conditionMet(def, payload)) return false;

    // Counters and discoveries accumulate even on a non-unlocking seed, because they are
    // records of what the player has seen rather than rewards. Only the grant is gated.
    if (this.profile.granted.includes(def.id)) return false;
    if (!this.unlocksEnabled) {
      this.#applyActions(def, { countersOnly: true });
      return false;
    }

    this.profile.granted.push(def.id);
    this.#applyActions(def, { countersOnly: false });

    this.events.emit(EVENTS.UNLOCK_GRANTED, {
      unlockId: def.id,
      family: def.family,
      // R-PRG-004 / D-016: the payload carries no total, so no banner can imply how much
      // content exists.
      announcement: def.announcement,
      hidden: def.hidden,
      descriptionLoc: def.descriptionLoc,
    });
    return true;
  }

  #applyActions(def, { countersOnly }) {
    for (const action of def.actions || []) {
      switch (action.type) {
        case 'INCREMENT_COUNTER': {
          const key = typeof action.value === 'string' ? action.value : action.value?.counter;
          if (!key) break;
          this.profile.counters[key] = (this.profile.counters[key] ?? 0) + (action.value?.by ?? 1);
          break;
        }
        case 'REVEAL_COLLECTION': {
          const id = typeof action.value === 'string' ? action.value : action.value?.content;
          if (id && !this.profile.discovered.includes(id)) this.profile.discovered.push(id);
          break;
        }
        default:
          if (countersOnly) break;
          this.#applyRewardAction(action);
          break;
      }
    }
  }

  /** Actions that change what a future run contains. Skipped on a non-unlocking seed. */
  #applyRewardAction(action) {
    switch (action.type) {
      case 'SET_FLAG':
        if (!this.profile.flags.includes(action.value)) this.profile.flags.push(action.value);
        break;

      case 'ADD_TO_POOL': {
        const { pool, content } = action.value || {};
        if (!pool || !content) break;
        const list = this.profile.pools[pool] || [];
        if (!list.includes(content)) list.push(content);
        this.profile.pools[pool] = list;
        break;
      }

      case 'UNLOCK_PROFILE':
        if (!this.profile.profiles.includes(action.value)) this.profile.profiles.push(action.value);
        break;

      case 'RECORD_ENDING':
        // R-PRG-003: an ending is recorded once and the collection shows it without a
        // denominator (D-016). Order of discovery is kept because it is the only history
        // the collection has.
        if (!this.profile.endings.includes(action.value)) this.profile.endings.push(action.value);
        break;

      case 'TRANSITION_ROUTE':
        // R-PRG-002 forbids changing the run in progress, so this records permission for
        // the NEXT run rather than redirecting this one.
        if (!this.profile.routes.includes(action.value)) this.profile.routes.push(action.value);
        break;

      default:
        console.error(`Unlock action "${action.type}" has no handler; nothing was applied.`);
        break;
    }
  }

  /** Flags a starting run should be given, so generation can gate alternate floors. */
  activeFlags() {
    return new Set([...this.profile.flags, ...this.profile.granted]);
  }
}
