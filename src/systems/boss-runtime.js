/**
 * Boss runtime: turns a boss definition's phase list into a live fight.
 *
 * GDD refs: 15.3 (the boss combat contract), 15.4 (a phase is a weighted pattern set
 *           plus a movement rule), Appendix E (phase names and failure conditions),
 *           R-BSS-001 (every normal floor ends in one boss encounter), R-BSS-002 (a
 *           defeat produces exactly ONE Manager Reward, idempotently), R-BSS-003 (boss
 *           attacks obey the same damage and telegraph rules as enemies), R-BSS-004
 *           (invulnerability is short, purposeful, and visually explicit), R-BSS-006
 *           (a safe path survives every zone and wall phase), 6.1 (room lifecycle),
 *           20.5 (phase ordering), R-TEC-002 (deterministic replay from a seed).
 *
 * This is a *driver*, not a second combat system. It borrows the EncounterRuntime's
 * projectile pool, pulse list, hazard spawner, and controller context, so a boss shot and
 * a drone shot travel through identical code — which is what R-BSS-003 actually demands.
 * The patterns themselves live in src/entities/boss-patterns.js.
 *
 * ## Three things worth knowing before changing this
 *
 * **The telegraph gate is unconditional.** A pattern cannot fire until its own
 * `telegraphSeconds` (or the boss's `telegraphMinimumSeconds`, whichever is longer) has
 * elapsed with the wind-up visible. Appendix E lists "off-screen attack without cue" as a
 * failure condition for every boss in the game, so there is no fast path around this.
 *
 * **Phase exit is checked before pattern selection.** Otherwise a boss could fire a
 * phase-three pattern on the frame it entered phase three, before the transition had been
 * shown — Appendix E's "unreadable phase transition".
 *
 * **The reward latch is on the room, not the boss.** R-BSS-002 requires idempotency
 * across save and continue, and a boss entity does not survive a reload. `room.state`
 * does.
 */

import { RNG_STREAMS } from '../core/rng.js';
import { ALLEGIANCE, LAYER, DAMAGE_TAG, SPAWN_ZONE } from '../core/constants.js';
import { EVENTS } from '../core/events.js';
import { StatusContainer } from '../entities/status.js';
import { AI_STATE } from '../entities/enemy-controllers.js';
import { getBossPattern, getMovementRule } from '../entities/boss-patterns.js';
import { resolveOverlap } from './physics.js';

/**
 * Pause after a phase transition before the new phase may attack.
 *
 * Appendix E's "unreadable phase transition" failure condition is about the player being
 * given a moment to notice. Short enough not to feel like a cutscene, long enough that
 * the phase stinger and the visual change land before the first new attack.
 */
const PHASE_SETTLE_SECONDS = 0.7;

/** Gap between pattern activations, on top of each pattern's own telegraph. */
const DEFAULT_PATTERN_GAP = 0.45;

export class BossRuntime {
  /**
   * @param {object} deps
   * @param {import('./encounter-runtime.js').EncounterRuntime} deps.runtime
   *   The encounter runtime whose projectile pool, hazards, and context this borrows.
   * @param {object} deps.registry
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {() => object} deps.getRun
   */
  constructor({ runtime, registry, events, getRun }) {
    this.runtime = runtime;
    this.registry = registry;
    this.events = events;
    this.getRun = getRun;

    /** @type {object|null} the live boss entity, or null between fights. */
    this.boss = null;
    /** @type {object|null} the boss definition currently driving phases. */
    this.def = null;
    /** Destructible phase objectives: nodes, heads, and voting members. */
    this.nodes = [];
    this.phaseIndex = -1;
    this.phaseTimer = 0;
    this.settleTimer = 0;
    this.telegraph = null;
  }

  get active() {
    return Boolean(this.boss) && !this.boss.dead;
  }

  get phase() {
    return this.def?.phases?.[this.phaseIndex] ?? null;
  }

  /**
   * Spawn the boss named by the room's node.
   *
   * @returns {number} 1 when a boss was spawned, 0 when there is nothing to spawn.
   *   The room controller reads this: zero must leave the room completable rather than
   *   waiting forever on a boss that will never arrive (R-CMB-006).
   */
  spawn(roomInstance) {
    const bossId = roomInstance.bossId ?? roomInstance.node?.bossId ?? null;
    if (!bossId) return 0;
    const def = this.registry.get('boss', bossId);
    if (!def) {
      // A missing definition is a content defect, and the validator will already have
      // said so. Refusing to hang the room is the right runtime behaviour.
      console.error(`Boss "${bossId}" has no definition; the arena will resolve empty.`);
      return 0;
    }

    const run = this.getRun();
    const depth = run.floorDef?.depth ?? 1;
    // Scaling is multiplicative per depth step above the boss's first appearance, so a
    // boss met late in a long route is meaningfully harder than the same boss met early.
    const scale = 1 + (def.healthScalingPerDepth ?? 0) * Math.max(0, depth - 1);
    const health = def.maxHealth * scale;

    const at = this.#arenaCentre(roomInstance);
    const boss = {
      id: `boss${bossId}`,
      defId: def.id,
      def,
      // Deliberately shaped like an enemy. Physics, the combat resolver, the renderer,
      // and every on-hit item then treat a boss as an enemy with a large radius, which
      // is exactly what R-BSS-003 asks for.
      isBoss: true,
      allegiance: ALLEGIANCE.ENEMY,
      collisionLayer: LAYER.ENEMY,
      x: at.x,
      y: at.y,
      velocity: { x: 0, y: 0 },
      radius: def.radius,
      facing: 'SOUTH',
      health,
      maxHealth: health,
      contactDamage: def.contactDamage,
      baseSpeed: 2,
      dead: false,
      invulnerable: false,
      shieldHp: 0,
      shielded: false,
      status: new StatusContainer(false),
      state: AI_STATE.IDLE,
      stateTimer: 0,
      cooldowns: new Map(),
      pendingAttack: null,
      staged: false,
      stageTimer: 0,
      required: true,
      unreachable: false,
      tags: new Set(['ELITE']),
      hitFlash: 0,
      // Pattern bookkeeping the patterns themselves write into.
      volleyIndex: 0,
      heads: [],
      members: [],
      inheritedPatterns: [],
      layersRemaining: 3,
      weakPoint: null,
      charge: null,
      lockedTarget: null,
      // Variant behaviour modules do not apply to bosses, but the shared hostile loop
      // iterates this for every entity in `hostiles` — an absent array is a crash on
      // frame one, not a missing feature.
      modules: [],
    };

    // Its own deterministic stream, so a boss's rolls cannot shift a pedestal or an
    // encounter (GDD 20.4).
    boss.rng = run.rng.stream(RNG_STREAMS.BOSS, def.id, roomInstance.nodeId);

    if (!resolveOverlap(boss, roomInstance.collision)) {
      // A boss wedged in geometry would be unkillable. R-BSS-005 says arenas are
      // authored for the boss, so this is a content error worth shouting about.
      console.error(`Boss "${bossId}" could not be placed in ${roomInstance.nodeId}.`);
      return 0;
    }

    this.boss = boss;
    this.def = def;
    this.nodes = [];
    this.phaseIndex = -1;
    this.telegraph = null;

    this.runtime.hostiles.push(boss);
    this.events?.emit(EVENTS.BOSS_SPAWNED, { boss: def.id, health, depth });
    this.events?.emit(EVENTS.SFX_REQUESTED, { sound: def.audio.intro });

    // Enter the START phase. Every boss has one; the schema rejects a boss without it.
    const startIndex = def.phases.findIndex((p) => p.entryCondition?.type === 'START');
    this.#enterPhase(startIndex >= 0 ? startIndex : 0);
    return 1;
  }

  /** Clear all boss state. Called on despawn and between floors. */
  reset() {
    this.boss = null;
    this.def = null;
    this.nodes = [];
    this.phaseIndex = -1;
    this.telegraph = null;
    this.settleTimer = 0;
  }

  /**
   * Advance the fight one step.
   *
   * @param {number} dt seconds
   * @param {object} ctx the EncounterRuntime controller context, extended with the boss
   *   helpers in `bossContext()`
   */
  update(dt, ctx) {
    const boss = this.boss;
    if (!boss) return;
    if (boss.dead) {
      this.#onDeath(ctx);
      return;
    }

    this.phaseTimer += dt;
    if (this.settleTimer > 0) {
      this.settleTimer -= dt;
      // Movement still runs during the settle window: a boss frozen mid-transition reads
      // as a hitch rather than as a phase change.
      this.#applyMovement(boss, ctx, dt);
      return;
    }

    // Exit BEFORE selecting, so a phase-three pattern can never fire on the frame the
    // boss entered phase three (Appendix E: "unreadable phase transition").
    if (this.#checkPhaseTransition(ctx)) {
      this.#applyMovement(boss, ctx, dt);
      return;
    }

    this.#applyMovement(boss, ctx, dt);
    this.#tickWeakPoint(boss, dt);
    this.#tickTeleport(boss, dt);
    this.#tickTelegraph(boss, ctx, dt);
  }

  // -------------------------------------------------------------------------
  // Phases
  // -------------------------------------------------------------------------

  #enterPhase(index) {
    const phase = this.def.phases[index];
    if (!phase) return;
    this.phaseIndex = index;
    this.phaseTimer = 0;
    this.telegraph = null;
    this.settleTimer = PHASE_SETTLE_SECONDS;

    const boss = this.boss;
    // R-BSS-004: invulnerability comes from the phase and is bounded there. The schema
    // already refused any phase that is invulnerable, uncapped, AND has nothing
    // attackable, so trusting the flag here is safe.
    boss.invulnerable = Boolean(phase.invulnerable);
    boss.invulnerableRemaining = phase.invulnerable ? (phase.maxInvulnerableSeconds ?? 0) : 0;

    this.events?.emit(EVENTS.BOSS_PHASE_CHANGED, {
      boss: this.def.id,
      phase: phase.id,
      index,
      invulnerable: boss.invulnerable,
    });
    this.events?.emit(EVENTS.SFX_REQUESTED, { sound: this.def.audio.phase });
  }

  /** @returns {boolean} true when a transition happened this frame. */
  #checkPhaseTransition(ctx) {
    const phase = this.phase;
    const boss = this.boss;
    if (!phase || !boss) return false;

    // A bounded invulnerable phase expires on its own even if its objective is never
    // met. Without this, failing to break the nodes would strand the fight (R-BSS-004).
    if (boss.invulnerable && boss.invulnerableRemaining > 0) {
      boss.invulnerableRemaining = Math.max(0, boss.invulnerableRemaining - ctx.dt ?? 0);
    }

    if (!this.#conditionMet(phase.exitCondition, ctx)) return false;
    if (phase.exitCondition.type === 'DEATH') return false;

    // The next phase is the first one whose entry condition is now satisfied, searched
    // forward from here. Data order is the authored order, so this respects it.
    for (let i = this.phaseIndex + 1; i < this.def.phases.length; i += 1) {
      const candidate = this.def.phases[i];
      if (candidate.entryCondition.type === 'START') continue;
      if (this.#conditionMet(candidate.entryCondition, ctx)) {
        this.#enterPhase(i);
        return true;
      }
    }
    return false;
  }

  #conditionMet(condition, ctx) {
    if (!condition) return false;
    const boss = this.boss;
    switch (condition.type) {
      case 'START':
        return true;
      case 'HEALTH_BELOW':
        return boss.health / boss.maxHealth <= condition.value;
      case 'TIME_AFTER':
        return this.phaseTimer >= condition.value;
      case 'ADDS_CLEARED':
        return this.#aliveAdds(ctx) === 0;
      case 'NODES_DESTROYED':
        return this.nodes.filter((n) => n.dead).length >= (condition.value ?? 1);
      case 'DEATH':
        return boss.dead;
      default:
        return false;
    }
  }

  #aliveAdds(ctx) {
    let n = 0;
    for (const e of ctx.hostiles || []) if (!e.dead && !e.isBoss && e.spawnedByBoss) n += 1;
    return n;
  }

  // -------------------------------------------------------------------------
  // Pattern selection and telegraphing
  // -------------------------------------------------------------------------

  #tickTelegraph(boss, ctx, dt) {
    if (this.telegraph) {
      this.telegraph.remaining -= dt;
      if (this.telegraph.remaining > 0) {
        boss.state = AI_STATE.TELEGRAPH;
        return;
      }
      const { pattern, params } = this.telegraph;
      this.telegraph = null;
      boss.state = AI_STATE.ATTACK;
      pattern.run(boss, ctx, params || {});
      // Remember what the run has seen, so ECHO_RUN_MECHANIC and the BSS-013/027/029
      // "quotes earlier content" bosses have a pool to draw from.
      const run = this.getRun();
      if (run) {
        run.mechanicsSeen = run.mechanicsSeen || new Set();
        run.mechanicsSeen.add(pattern.id);
      }
      boss.cooldowns.set('pattern', DEFAULT_PATTERN_GAP);
      return;
    }

    const gap = boss.cooldowns.get('pattern') ?? 0;
    if (gap > 0) {
      boss.cooldowns.set('pattern', gap - dt);
      boss.state = AI_STATE.IDLE;
      return;
    }

    const chosen = this.#selectPattern(ctx);
    if (!chosen) return;
    const pattern = getBossPattern(chosen.pattern);
    if (!pattern) return;

    // The gate: the LONGER of the pattern's own telegraph and the boss's declared
    // minimum. A boss may be more generous than its patterns, never less.
    const seconds = Math.max(pattern.telegraphSeconds, this.def.telegraphMinimumSeconds ?? 0);
    this.telegraph = { pattern, params: chosen.params, remaining: seconds };
    boss.state = AI_STATE.TELEGRAPH;

    // Sampled once, here, at telegraph start. TARGETED_SLAM and CONTACT_CHARGE read this
    // so they cannot re-aim during their own wind-up (R-ENM-007, and Appendix E's
    // "unavoidable spawn damage" sibling failure).
    boss.lockedTarget = { x: ctx.player.x, y: ctx.player.y };

    ctx.spawnTelegraphRing?.({
      x: boss.x, y: boss.y, radius: boss.radius + 0.6, seconds, kind: 'BOSS_WINDUP',
    });
  }

  #selectPattern(ctx) {
    const phase = this.phase;
    if (!phase?.patternWeights?.length) return null;
    const total = phase.patternWeights.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
    if (total <= 0) return null;
    // The boss's own stream, so a replayed seed produces the same pattern order.
    let roll = this.boss.rng.next() * total;
    for (const entry of phase.patternWeights) {
      roll -= Math.max(0, entry.weight);
      if (roll <= 0) return entry;
    }
    return phase.patternWeights[phase.patternWeights.length - 1];
  }

  // -------------------------------------------------------------------------
  // Movement, weak points, teleports
  // -------------------------------------------------------------------------

  #applyMovement(boss, ctx, dt) {
    const phase = this.phase;
    const rule = getMovementRule(phase?.movementRule);
    if (!rule?.update) return;
    if (boss.status.blocksMovement?.()) return;
    const before = { x: boss.x, y: boss.y };
    rule.update(boss, ctx, dt, phase.movementParams || {});
    // Bosses are large and arenas have walls. Reverting on a failed resolve is better
    // than letting a boss drift into geometry where the player cannot reach it.
    if (!resolveOverlap(boss, ctx.room?.collision)) {
      boss.x = before.x;
      boss.y = before.y;
    }
  }

  #tickWeakPoint(boss, dt) {
    if (!boss.weakPoint) return;
    boss.weakPoint.seconds -= dt;
    if (boss.weakPoint.seconds <= 0) boss.weakPoint = null;
  }

  #tickTeleport(boss, dt) {
    const pending = boss.pendingTeleport;
    if (!pending) return;
    pending.inSeconds -= dt;
    if (pending.inSeconds > 0) return;
    boss.x = pending.x;
    boss.y = pending.y;
    boss.pendingTeleport = null;
  }

  // -------------------------------------------------------------------------
  // Death and reward
  // -------------------------------------------------------------------------

  #onDeath(ctx) {
    const def = this.def;
    const boss = this.boss;
    if (!def || boss.rewardResolved) return;

    // R-BSS-002: exactly one Manager Reward, idempotent across save and continue. The
    // latch lives on the ROOM because a boss entity does not survive a reload and
    // `room.state` does — putting it on the boss is how you get a duplicated reward,
    // which Appendix E lists as a failure condition.
    boss.rewardResolved = true;
    const room = ctx.room;
    if (room?.state?.bossRewardGranted) return;
    if (room?.state) room.state.bossRewardGranted = true;

    // BSS-017/018 RESOURCE_THEFT gives back what it took, so the mechanic is a temporary
    // denial rather than permanent deletion.
    if (boss.stolenCredits > 0) {
      ctx.spawnPickupAt?.(boss.x, boss.y, 'CREDIT', boss.stolenCredits);
      boss.stolenCredits = 0;
    }

    this.events?.emit(EVENTS.SFX_REQUESTED, { sound: def.audio.death });
    this.events?.emit(EVENTS.BOSS_DEFEATED, {
      boss: def.id,
      setDrop: def.setDrop ?? null,
      managerRewardOverride: def.managerRewardOverride ?? null,
      unlockHooks: def.unlockHooks,
      endingHooks: def.endingHooks,
      // The room clear pass reads these; the boss runtime deliberately does not grant
      // rewards itself, so GDD 6.1 stays the single authority on room resolution.
      x: boss.x,
      y: boss.y,
    });
  }

  // -------------------------------------------------------------------------
  // The extra context boss patterns need
  // -------------------------------------------------------------------------

  /**
   * Extend the EncounterRuntime's controller context with the helpers boss patterns
   * call. Kept separate so an ordinary enemy can never reach `moveArenaWalls`.
   */
  bossContext(base) {
    const self = this;
    return {
      ...base,
      run: this.getRun(),

      spawnBossNode: ({ owner, x, y, health, shortensPhase, firesPattern }) => {
        const node = {
          id: `node${self.nodes.length}`,
          owner, x, y, health, maxHealth: health,
          dead: false,
          shortensPhase: Boolean(shortensPhase),
          firesPattern: firesPattern ?? null,
          radius: 0.7,
          allegiance: ALLEGIANCE.ENEMY,
          collisionLayer: LAYER.ENEMY,
          isBossNode: true,
          status: new StatusContainer(false),
          modules: [],
          cooldowns: new Map(),
          tags: new Set(),
          required: false,
          hitFlash: 0,
        };
        self.nodes.push(node);
        // Pushed into `hostiles` so the existing combat and render passes see it. That is
        // the whole reason an invulnerable phase is legal: there is a real, shootable
        // target in the normal target list.
        base.hostiles.push(node);
        return node;
      },

      spawnBossAdds: ({ owner, enemyId, count, maxAlive, graceSeconds, minPlayerDistance }) => {
        if (!enemyId) return 0;
        let alive = 0;
        for (const e of base.hostiles) if (!e.dead && e.spawnedByBoss) alive += 1;
        let spawned = 0;
        for (let i = 0; i < count && alive + spawned < maxAlive; i += 1) {
          const enemy = base.spawnEnemy(enemyId, {
            // Appendix E: "unavoidable spawn damage" is a failure condition, so adds
            // arrive staged and away from the player rather than on top of them.
            zone: SPAWN_ZONE.GROUND_MELEE,
            minPlayerDistance,
            spawnedByBoss: true,
            required: false,
            staged: true,
            stageTimer: graceSeconds,
          });
          if (enemy) spawned += 1;
        }
        return spawned;
      },

      absorbEnemy: (boss, enemy, { healHalfUnits }) => {
        base.killEnemy(enemy, 'ABSORBED');
        boss.health = Math.min(boss.maxHealth, boss.health + (healHalfUnits ?? 0));
      },

      spawnBossDecoy: ({ owner, count, health, identifiableByShadow, identifiableByAudio }) => {
        for (let i = 0; i < count; i += 1) {
          const at = base.room?.randomWalkablePoint?.(base.rng) || { x: owner.x, y: owner.y };
          const decoy = {
            id: `decoy${i}`,
            owner,
            x: at.x, y: at.y,
            radius: owner.radius * 0.9,
            health, maxHealth: health,
            dead: false,
            isBossDecoy: true,
            // Appendix E requires the real one stay identifiable "by shadow and audio",
            // so the flags travel with the entity and presentation must honour them.
            identifiableByShadow,
            identifiableByAudio,
            allegiance: ALLEGIANCE.ENEMY,
            collisionLayer: LAYER.ENEMY,
            status: new StatusContainer(false),
            modules: [],
            cooldowns: new Map(),
            tags: new Set(),
            required: false,
            hitFlash: 0,
          };
          base.hostiles.push(decoy);
        }
      },

      spawnDelayedBlast: (spec) => {
        // Routed through the shared pulse list on a delay, so the blast uses the same
        // damage path as an enemy explosion (R-BSS-003).
        self.runtime.schedule?.(spec.delaySeconds ?? 0, () => {
          self.runtime.pulses.push({
            x: spec.x, y: spec.y,
            radius: spec.radius || Math.max(spec.w ?? 0, spec.h ?? 0) / 2 || 1,
            damage: spec.damage ?? 2,
            damageTags: spec.tags || [DAMAGE_TAG.EXPLOSION],
            remaining: 0.25, seconds: 0.25,
            sourceId: spec.sourceId ?? 'boss',
            hit: false,
          });
        });
      },

      spawnHazardPatch: (spec) => base.spawnHazardAt(spec.x, spec.y, spec.hazardId, spec),

      spawnTelegraphRing: (spec) => {
        self.runtime.telegraphs = self.runtime.telegraphs || [];
        self.runtime.telegraphs.push({ ...spec, remaining: spec.seconds });
      },

      spawnVoteDisplay: (spec) => {
        self.runtime.voteDisplay = { ...spec, remaining: 1.5 };
      },

      moveArenaWalls: (spec) => {
        // R-BSS-006 lives in boss-patterns.js, which clamps gapCount to at least one
        // before this is ever called. Asserting here too because a silent zero would
        // produce an unwinnable room and this is the last place to catch it.
        if (!(spec.gapCount >= 1)) {
          console.error('moveArenaWalls refused: gapCount must be >= 1 (R-BSS-006).');
          return;
        }
        base.room?.setArenaWalls?.(spec);
      },

      spawnEnemyBeam: (spec) => {
        self.runtime.beams = self.runtime.beams || [];
        self.runtime.beams.push({ ...spec, elapsed: 0 });
      },
    };
  }

  #arenaCentre(roomInstance) {
    // Bosses start at the arena centre unless the template names a boss anchor. R-BSS-005
    // lets an arena be authored for its boss, so an explicit anchor wins.
    const anchor = roomInstance.zonesOf?.(SPAWN_ZONE.BOSS_ANCHOR)?.[0];
    if (anchor) return { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2 };
    const c = roomInstance.centre;
    return { x: c.x, y: c.y };
  }
}
