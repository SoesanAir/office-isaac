/**
 * Encounter runtime: turns a selected encounter into live, thinking enemies.
 *
 * GDD refs: 6.1 (combat room lifecycle), 6.3 (projectile model), 6.4 (collision
 *           priorities), 20.2 (Entity Runtime: player, enemy, projectile, pickup,
 *           object, hazard lifecycle), 20.5 (event ordering), R-CMB-002 (grace
 *           interval before the first damage), R-CMB-004 (pooling and aggregation,
 *           never silent deletion), R-CMB-006 (no impossible clears), R-ENM-006
 *           (bounded quantity), R-ENM-008 (no spawns in unreachable regions),
 *           R-TEC-004 (pooling prevents allocation spikes).
 *
 * This is the object the enemy controllers were written against. Every `ctx.*` method
 * they call lives here, which keeps the controllers pure behaviour: they decide what
 * should happen, and this decides whether the world can accommodate it.
 *
 * It also implements the `spawner` interface the RoomController drives, so the room
 * lifecycle in GDD 6.1 stays the single authority on doors, waves, and clears — this
 * module never decides a room is finished, it only reports what is still alive.
 */

import { RNG_STREAMS } from '../core/rng.js';
import {
  ALLEGIANCE, LAYER, DAMAGE_TAG, SPAWN_ZONE, BUDGETS, STATUS,
} from '../core/constants.js';
import { EVENTS } from '../core/events.js';
import { distance, pointSegmentDistance, normalizeInto, clamp } from '../core/math.js';
import { StatusContainer } from '../entities/status.js';
import { ProjectileSystem, IMPACT_ACTION } from '../entities/projectile.js';
import {
  getController, getAttackModule, getBehaviorModule, AI_STATE,
} from '../entities/enemy-controllers.js';
import { projectileHitsWorld, bounceProjectile, resolveOverlap, moveWithCollision } from './physics.js';
import { selectEncounter, resolveSpawns, waveCount } from './encounter-select.js';
import { BossRuntime } from './boss-runtime.js';

/** How long a spawned-but-staged enemy stays inert. GDD 6.1's telegraph grace. */
const STAGE_FADE_SECONDS = 0.35;

export class EncounterRuntime {
  /**
   * @param {object} deps
   * @param {object} deps.registry
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {import('./combat.js').CombatResolver} deps.combat
   * @param {() => object} deps.getRun
   */
  constructor({ registry, events, combat, getRun }) {
    this.registry = registry;
    this.events = events;
    this.combat = combat;
    this.getRun = getRun;

    this.projectiles = new ProjectileSystem({ events });
    /** Drives boss phases. Shares this runtime's projectiles, pulses, and context. */
    this.boss = new BossRuntime({ runtime: this, registry, events, getRun });
    /** @type {object[]} live hostiles, in spawn order for deterministic iteration. */
    this.hostiles = [];
    /** Transient area effects: pulses, beams, damage paths. */
    this.pulses = [];
    /** Delayed callbacks, so a death effect can telegraph before it fires. */
    this.pending = [];
    /** Temporary obstacles created by attacks. */
    this.tempObstacles = [];
    /** The last simple pattern any enemy fired; ENM-012 copies from this. */
    this.lastEnemyPattern = null;

    this.nextEntityId = 1;
    this.activated = false;
    this.currentRoom = null;
    this.currentEncounter = null;
  }

  // -------------------------------------------------------------------------
  // Spawner interface consumed by RoomController (GDD 6.1)
  // -------------------------------------------------------------------------

  /**
   * Populate a room with its selected encounter.
   * `staged: true` means spawn inert — R-CMB-002's grace window has not elapsed, so
   * nothing may act or deal damage yet.
   */
  spawn(roomInstance, wave = 0, { staged = false } = {}) {
    const run = this.getRun();
    this.currentRoom = roomInstance;

    if (wave === 0) {
      // The Run assigned this during floor generation (GDD 11.4 step 11). The runtime
      // does not choose: if it did, the room lifecycle could not know whether to seal
      // the doors before the first enemy existed.
      this.currentEncounter = roomInstance.node.encounterId
        ? this.registry.get('encounter', roomInstance.node.encounterId)
        : null;
      if (!this.currentEncounter) return 0;
    }
    if (!this.currentEncounter) return 0;

    const requests = resolveSpawns({
      encounter: this.currentEncounter,
      node: roomInstance.node,
      floorDef: run.floorDef,
      rngSource: run.rng,
      wave,
    });

    let spawned = 0;
    for (const req of requests) {
      // R-ENM-006: refuse to exceed the cap rather than trusting the data.
      if (this.aliveCount >= BUDGETS.maxHostilesPerRoom) break;
      const enemy = this.#instantiate(req.enemyId, req.variantId, {
        zone: req.zone, roomInstance, staged,
      });
      if (enemy) spawned += 1;
    }
    return spawned;
  }

  /** Release the grace window: enemies may now act (GDD 6.1 step 5). */
  activate() {
    this.activated = true;
    for (const enemy of this.hostiles) enemy.staged = false;
  }

  /** GDD 6.1: a clear stops hostile spawning. */
  stopSpawning() {
    this.currentEncounter = null;
  }

  /**
   * R-CMB-006 watchdog: relocate an enemy the player cannot reach.
   * Returns true when the enemy was successfully moved somewhere valid.
   */
  relocate(roomInstance, enemy) {
    const zone = this.#pickZoneRect(roomInstance, SPAWN_ZONE.GROUND_MELEE)
      || this.#pickZoneRect(roomInstance, SPAWN_ZONE.ENTRY_SAFE);
    if (!zone) return false;
    enemy.x = zone.x + zone.w / 2;
    enemy.y = zone.y + zone.h / 2;
    const ok = resolveOverlap(enemy, roomInstance.collision);
    enemy.unreachable = !ok;
    return ok;
  }

  /**
   * Bosses arrive through their own path, but share the entity model.
   *
   * Returns 0 when there is no boss to spawn, which the room controller reads as
   * "resolve normally" rather than waiting forever (R-CMB-006). A floor whose boss is
   * missing stays completable.
   */
  spawnBoss(roomInstance) {
    this.currentRoom = roomInstance;
    return this.boss.spawn(roomInstance);
  }

  despawnAll() {
    this.boss.reset();
    this.hostiles.length = 0;
    this.pulses.length = 0;
    this.pending.length = 0;
    this.tempObstacles.length = 0;
    this.projectiles.clear();
    this.lastEnemyPattern = null;
    this.activated = false;
    this.currentEncounter = null;
  }

  get aliveCount() {
    let n = 0;
    for (const e of this.hostiles) if (!e.dead) n += 1;
    return n;
  }

  /** Required hostiles still alive. The room controller's clear condition. */
  get requiredAlive() {
    let n = 0;
    for (const e of this.hostiles) if (!e.dead && e.required) n += 1;
    return n;
  }

  get totalWaves() {
    return this.currentEncounter ? waveCount(this.currentEncounter) : 1;
  }

  // -------------------------------------------------------------------------
  // Entity construction
  // -------------------------------------------------------------------------

  #instantiate(enemyId, variantId, { zone, roomInstance, staged, at, overrides = {} }) {
    const def = this.registry.get('enemy', enemyId);
    if (!def) return null;
    const variant = variantId ? this.registry.get('enemyVariant', variantId) : null;
    const run = this.getRun();

    const position = at || this.#pickSpawnPoint(roomInstance, zone, def);
    if (!position) return null;

    const ov = variant?.overrides || {};
    const health = (overrides.healthMul ?? 1) * (ov.health ?? def.health);
    const enemy = {
      id: `h${this.nextEntityId++}`,
      defId: def.id,
      def,
      variantId: variant?.id ?? null,
      variant,
      allegiance: ALLEGIANCE.ENEMY,
      collisionLayer: LAYER.ENEMY,
      x: position.x,
      y: position.y,
      velocity: { x: 0, y: 0 },
      radius: def.radius * (variant?.scale ?? 1),
      facing: 'SOUTH',
      health,
      maxHealth: health,
      contactDamage: ov.contactDamage ?? def.contactDamage,
      baseSpeed: ov.baseSpeed ?? def.movement.baseSpeed,
      dead: false,
      invulnerable: false,
      shieldHp: 0,
      shielded: false,
      status: new StatusContainer(false),
      state: AI_STATE.IDLE,
      stateTimer: 0,
      cooldowns: new Map(),
      pendingAttack: null,
      /** Staged enemies are visible but inert during the grace window. */
      staged,
      stageTimer: staged ? STAGE_FADE_SECONDS : 0,
      /** Decorative entities do not gate the clear (GDD 6.1). */
      required: overrides.required ?? true,
      unreachable: false,
      tags: new Set([...(def.tags || []), ...((ov.tagsAdd) || [])]),
      hitFlash: 0,
      ...overrides,
    };
    for (const tag of ov.tagsRemove || []) enemy.tags.delete(tag);

    // Give the enemy a deterministic personal stream so its own rolls cannot shift
    // any other entity's sequence (GDD 20.4).
    enemy.rng = run.rng.stream(RNG_STREAMS.COMBAT_PROC, run.floor?.id ?? 'x', enemy.id);

    // Variant behaviour modules attach here, and get their onSpawn immediately.
    enemy.modules = (variant?.behaviorModules || [])
      .map((m) => ({ spec: getBehaviorModule(m.module), params: m.params || {} }))
      .filter((m) => m.spec);

    if (!resolveOverlap(enemy, roomInstance.collision)) {
      // R-ENM-008: rather than leaving an enemy inside geometry, refuse the spawn.
      // The room is slightly easier; an unreachable enemy would be unclearable.
      return null;
    }

    this.hostiles.push(enemy);
    const ctx = this.#context();
    for (const mod of enemy.modules) mod.spec.onSpawn?.(enemy, mod.params, ctx);
    return enemy;
  }

  /** A walkable point inside the requested spawn zone, away from the player. */
  #pickSpawnPoint(roomInstance, zoneKind, def) {
    const run = this.getRun();
    const rng = run.rng.stream(RNG_STREAMS.ENCOUNTER, roomInstance.nodeId, 'place');
    const rects = roomInstance.zonesOf(zoneKind);
    const candidates = rects.length > 0 ? rects : roomInstance.zonesOf(SPAWN_ZONE.GROUND_MELEE);
    if (!candidates || candidates.length === 0) return null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const rect = rng.pick(candidates);
      const x = rng.float(rect.x + 0.5, rect.x + rect.w - 0.5);
      const y = rng.float(rect.y + 0.5, rect.y + rect.h - 0.5);
      if (!roomInstance.collision.isWalkable(x, y, { flying: def.movement.movementClass === 'FLYING' })) {
        continue;
      }
      // R-CMB-002: the player gets a readable response window, which means nothing
      // may spawn on top of them.
      if (run.player && distance(x, y, run.player.x, run.player.y) < 3.5) continue;
      return { x, y };
    }
    return null;
  }

  #pickZoneRect(roomInstance, zoneKind) {
    const rects = roomInstance.zonesOf(zoneKind);
    return rects && rects.length > 0 ? rects[0] : null;
  }

  // -------------------------------------------------------------------------
  // The controller context
  // -------------------------------------------------------------------------

  #context() {
    const run = this.getRun();
    const self = this;
    return {
      player: run.player,
      room: this.currentRoom,
      hostiles: this.hostiles,
      events: this.events,
      registry: this.registry,
      rng: run.rng.stream(RNG_STREAMS.COMBAT_PROC, 'ctx'),
      get lastEnemyPattern() { return self.lastEnemyPattern; },

      noteEnemyPattern: (kind, params) => { this.lastEnemyPattern = { kind, params }; },

      spawnEnemyProjectile: (enemy, spec) => this.#spawnEnemyProjectile(enemy, spec),
      spawnPulse: (enemy, spec) => this.pulses.push({
        x: enemy.x, y: enemy.y, radius: spec.radius, damage: spec.damage,
        damageTags: spec.damageTags || [DAMAGE_TAG.EXPLOSION],
        remaining: spec.seconds ?? 0.3, seconds: spec.seconds ?? 0.3,
        sourceId: enemy.id, hit: false,
      }),
      spawnHazardAt: (x, y, hazardId, opts) => this.#spawnHazard(x, y, hazardId, opts),
      spawnTempObstacle: (x, y, opts) => this.#spawnTempObstacle(x, y, opts),
      spawnPickupAt: (x, y, kind, count) => this.#spawnPickup(x, y, kind, count),
      spawnEnemy: (defId, opts) => this.#instantiate(defId, opts?.variantId ?? null, {
        zone: SPAWN_ZONE.GROUND_MELEE,
        roomInstance: this.currentRoom,
        staged: false,
        at: (opts?.x !== undefined) ? { x: opts.x, y: opts.y } : null,
        overrides: opts || {},
      }),
      killEnemy: (enemy, reason) => this.#kill(enemy, reason),
      damageAlongPath: (from, to, spec) => this.#damageAlongPath(from, to, spec),
      applyEnemyBuff: (ally, attributes, magnitude, seconds) => {
        // Buffs are statuses so they expire, show an icon, and cannot stack forever.
        ally.status.apply(STATUS.HASTE, { seconds, magnitude, affectsCadence: attributes.includes('CADENCE') });
      },
      destroyObject: (obj, cause) => this.#destroyObject(obj, cause),
      scheduleDelayed: (seconds, fn) => this.pending.push({ remaining: seconds, fn }),
      spawnTemporaryTurret: (x, y, opts) => this.#spawnTurret(x, y, opts),
      sealOneDoor: (enemy) => this.#sealDoor(enemy),
      releaseDoor: (id) => this.#releaseDoor(id),
    };
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  /**
   * Queue a callback. Shared with BossRuntime so a delayed boss blast lands through the
   * same pending list as a telegraphed enemy death burst — one ordering, one bug surface.
   */
  schedule(seconds, fn) {
    this.pending.push({ remaining: seconds, fn });
  }

  /** One fixed step. Called from the PHYSICS/AI phases of the scheduler. */
  update(dt) {
    const run = this.getRun();
    if (!run?.player || !this.currentRoom) return;
    const ctx = this.#context();

    // Delayed callbacks first, so a telegraphed death burst lands on schedule.
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      const entry = this.pending[i];
      entry.remaining -= dt;
      if (entry.remaining <= 0) {
        this.pending.splice(i, 1);
        entry.fn();
      }
    }

    // The boss runs BEFORE the ordinary hostile loop, so a pattern that spawns adds this
    // frame gets them ticked in the same frame rather than one frame late. dt is put on
    // the context because the phase-transition check needs it for invulnerability decay.
    if (this.boss.boss) {
      ctx.dt = dt;
      this.boss.update(dt, this.boss.bossContext(ctx));
    }

    for (const enemy of this.hostiles) {
      if (enemy.dead) continue;
      if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
      this.combat.tickStatuses(enemy, dt, false);

      // Staged enemies are visible but inert: the player gets to read the room
      // before anything can hurt them (R-CMB-002).
      if (enemy.staged) {
        enemy.stageTimer -= dt;
        if (enemy.stageTimer <= 0 && this.activated) enemy.staged = false;
        continue;
      }

      for (const [id, remaining] of enemy.cooldowns) {
        if (remaining > 0) enemy.cooldowns.set(id, remaining - dt);
      }

      for (const mod of enemy.modules) mod.spec.onUpdate?.(enemy, mod.params, ctx, dt);

      // Bosses, their nodes, and their decoys live in `hostiles` so that physics,
      // collision, damage, and rendering treat them as enemies (R-BSS-003) — but they
      // have no enemy definition and no movement controller. BossRuntime drives them,
      // and reaching for `enemy.def.movement` here is what crashed every boss fight.
      if (enemy.isBoss || enemy.isBossNode || enemy.isBossDecoy) continue;

      const controller = getController(enemy.def.movement.controller);
      if (controller && !enemy.status.blocksMovement()) controller.update(enemy, ctx, dt);
      else if (controller && enemy.state === AI_STATE.TELEGRAPH) controller.update(enemy, ctx, dt);

      // Contact damage. GDD 6.2: a dead enemy stops dealing contact damage
      // immediately, which the `dead` guard above already guarantees.
      if (enemy.contactDamage > 0) {
        const touching = distance(enemy.x, enemy.y, run.player.x, run.player.y)
          < enemy.radius + run.player.radius;
        if (touching) {
          this.combat.damagePlayer(run.player, {
            amount: enemy.contactDamage,
            tags: [DAMAGE_TAG.CONTACT],
            sourceId: enemy.id,
          });
        }
      }
    }

    this.#updateProjectiles(dt, ctx, run);
    this.#updatePulses(dt, run);
    this.#updateTempObstacles(dt);

    // Compact the hostile list once per tick, preserving order.
    if (this.hostiles.some((e) => e.removeMe)) {
      this.hostiles = this.hostiles.filter((e) => !e.removeMe);
    }
  }

  #spawnEnemyProjectile(enemy, spec) {
    if (spec.delay > 0) {
      this.pending.push({
        remaining: spec.delay,
        fn: () => this.#spawnEnemyProjectile(enemy, { ...spec, delay: 0 }),
      });
      return null;
    }
    const status = spec.status || enemy.projectileStatus || null;
    const p = this.projectiles.spawn({
      owner: ALLEGIANCE.ENEMY,
      x: enemy.x,
      y: enemy.y,
      vx: spec.dx * spec.speed,
      vy: spec.dy * spec.speed,
      damage: spec.damage,
      damageTags: spec.damageTags || [DAMAGE_TAG.PROJECTILE],
      radius: spec.radius ?? 0.22,
      maxLifetime: spec.lifetime ?? 2.2,
      pierce: 0,
      bounce: 0,
      spriteId: spec.spriteId ?? 'prj_paper_disc',
      onImpact: IMPACT_ACTION.DESTROY,
      sourceId: enemy.id,
      statusPayload: status ? [status] : [],
      splitOnImpact: enemy.projectileSplit ?? null,
    });
    // R-CMB-004: when the pool is full the shot is aggregated rather than dropped.
    // For an enemy shot that means resolving it as an immediate short-range check,
    // so the damage still exists even though no instance was created.
    if (!p) this.#resolveAggregatedEnemyShot(enemy, spec);
    return p;
  }

  #resolveAggregatedEnemyShot(enemy, spec) {
    const run = this.getRun();
    if (!run?.player) return;
    // Treat it as a hitscan along the intended vector: mechanically present,
    // visually merged into the stream the renderer already draws.
    const dist = pointSegmentDistance(
      run.player.x, run.player.y,
      enemy.x, enemy.y,
      enemy.x + spec.dx * 6, enemy.y + spec.dy * 6,
    );
    if (dist < run.player.radius + 0.3) {
      this.combat.damagePlayer(run.player, {
        amount: spec.damage,
        tags: spec.damageTags || [DAMAGE_TAG.PROJECTILE],
        sourceId: enemy.id,
      });
    }
  }

  #updateProjectiles(dt, ctx, run) {
    this.projectiles.integrate(dt);
    const room = this.currentRoom;

    this.projectiles.pool.forEach((p) => {
      if (p.__dead) return;

      // World geometry first (GDD 6.4 step 2).
      const worldHit = projectileHitsWorld(p, room.collision);
      if (worldHit) {
        if (p.bounce > 0) {
          p.bounce -= 1;
          bounceProjectile(p, room.collision);
        } else {
          if (worldHit.kind === 'OBJECT' && worldHit.object) {
            this.#damageObject(worldHit.object, p.damage, p.owner);
          }
          this.#onProjectileEnd(p, ctx);
          this.projectiles.release(p);
          return;
        }
      }

      if (p.owner === ALLEGIANCE.ENEMY) {
        if (distance(p.x, p.y, run.player.x, run.player.y) < p.radius + run.player.radius) {
          this.combat.damagePlayer(run.player, {
            amount: p.damage,
            tags: p.damageTags,
            sourceId: p.sourceId,
            statusPayload: p.statusPayload,
          });
          this.#onProjectileEnd(p, ctx);
          this.projectiles.release(p);
        }
        return;
      }

      // Player projectile vs hostiles.
      for (const enemy of this.hostiles) {
        if (enemy.dead || enemy.staged) continue;
        if (p.hitIds.has(enemy.id)) continue;
        if (distance(p.x, p.y, enemy.x, enemy.y) > p.radius + enemy.radius) continue;

        p.hitIds.add(enemy.id);
        this.damageEnemy(enemy, {
          amount: p.damage,
          tags: p.damageTags,
          sourceId: 'player',
          statusPayload: p.statusPayload,
          knockback: p.knockback,
          knockbackX: p.vx,
          knockbackY: p.vy,
        });

        if (p.pierce > 0) {
          p.pierce -= 1;
        } else if (p.pierce === -1) {
          // Unlimited pierce: keep flying.
        } else {
          this.#onProjectileEnd(p, ctx);
          this.projectiles.release(p);
          return;
        }
      }
    });

    this.projectiles.sweep();
  }

  /** Trail hazards and impact splits fire when a projectile ends its life. */
  #onProjectileEnd(p, ctx) {
    if (p.trail && p.trailRng?.chance?.(p.trail.chance)) {
      this.#spawnHazard(p.x, p.y, p.trail.hazardId, { seconds: p.trail.seconds, w: 1.4, h: 1.4 });
    }
    const split = p.splitOnImpact;
    if (split && !p.wasSplit) {
      for (let i = 0; i < split.count; i += 1) {
        const a = (i / split.count) * Math.PI * 2;
        this.projectiles.spawn({
          ...p,
          x: p.x, y: p.y,
          vx: Math.cos(a) * 4, vy: Math.sin(a) * 4,
          damage: p.damage * split.damageScale,
          maxLifetime: 0.8,
          wasSplit: true,
          hitIds: new Set(),
        });
      }
    }
  }

  #updatePulses(dt, run) {
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.pulses[i];
      pulse.remaining -= dt;
      // A pulse damages once, on its first tick, so a lingering visual cannot
      // re-damage every frame.
      if (!pulse.hit) {
        pulse.hit = true;
        if (distance(pulse.x, pulse.y, run.player.x, run.player.y) < pulse.radius + run.player.radius) {
          this.combat.damagePlayer(run.player, {
            amount: pulse.damage, tags: pulse.damageTags, sourceId: pulse.sourceId,
          });
        }
      }
      if (pulse.remaining <= 0) this.pulses.splice(i, 1);
    }
  }

  #updateTempObstacles(dt) {
    for (let i = this.tempObstacles.length - 1; i >= 0; i -= 1) {
      const obj = this.tempObstacles[i];
      obj.seconds -= dt;
      if (obj.seconds <= 0 || obj.destroyed) {
        this.currentRoom?.collision.removeObject(obj.id);
        this.tempObstacles.splice(i, 1);
      }
    }
  }

  #damageAlongPath(from, to, spec) {
    const run = this.getRun();
    const d = pointSegmentDistance(run.player.x, run.player.y, from.x, from.y, to.x, to.y);
    if (d < (spec.width ?? 0.8) + run.player.radius) {
      this.combat.damagePlayer(run.player, {
        amount: spec.damage, tags: spec.damageTags, sourceId: 'path',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Damage and death
  // -------------------------------------------------------------------------

  /** Damage a hostile, honouring variant modules that can reduce it. */
  damageEnemy(enemy, req) {
    const ctx = this.#context();
    let amount = req.amount;
    // Variant modules get first refusal: armour plating and shield arcs both work by
    // reducing an incoming number rather than by flipping an invulnerable flag, which
    // keeps R-BSS-004's "no untagged invulnerability" honest for enemies too.
    for (const mod of enemy.modules) {
      if (!mod.spec.onDamaged) continue;
      const result = mod.spec.onDamaged(enemy, mod.params, ctx, amount);
      if (typeof result === 'number') amount = result;
    }
    // Reset the per-event armour counter after the whole event resolves.
    enemy.armorConsumedThisEvent = 0;
    if (amount <= 0) {
      this.events.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-IMPACT_SOFT' });
      return { dealt: 0, killed: false };
    }

    const result = this.combat.damageEnemy(enemy, { ...req, amount });
    enemy.hitFlash = 0.08;
    if (req.knockback > 0 && !enemy.knockbackImmune) {
      normalizeInto({ x: 0, y: 0 }, req.knockbackX ?? 0, req.knockbackY ?? 0);
      const push = clamp(req.knockback, 0, 12) * 0.06;
      moveWithCollision(
        enemy,
        (req.knockbackX ?? 0) * push * 0.02,
        (req.knockbackY ?? 0) * push * 0.02,
        this.currentRoom.collision,
      );
    }
    if (enemy.health <= 0 && !enemy.dead) this.#kill(enemy, 'DAMAGE');
    return result;
  }

  #kill(enemy, reason) {
    if (enemy.dead) return;
    enemy.dead = true;
    // GDD 6.2: a dead enemy stops dealing contact damage immediately.
    enemy.contactDamage = 0;
    const ctx = this.#context();
    for (const mod of enemy.modules) mod.spec.onDeath?.(enemy, mod.params, ctx);
    this.events.emit(EVENTS.ENTITY_KILLED, { entityId: enemy.id, defId: enemy.defId, reason });
    this.events.emit(EVENTS.SFX_REQUESTED, { sound: enemy.def.audio?.death ?? 'SFX-ENEMY_DEATH' });
    // Kept in the list for one tick so death effects can read its position, then
    // compacted by `update`.
    enemy.removeMe = true;
  }

  // -------------------------------------------------------------------------
  // World mutation helpers
  // -------------------------------------------------------------------------

  #spawnHazard(x, y, hazardId, opts = {}) {
    const room = this.currentRoom;
    if (!room) return null;
    const def = this.registry.get('hazard', hazardId);
    if (!def) return null;
    const w = opts.w ?? 1.5;
    const h = opts.h ?? 1.5;
    const hazard = {
      id: `${room.nodeId}-rt${room.hazards.length}`,
      defId: hazardId,
      x: x - w / 2, y: y - h / 2, w, h,
      active: true, phase: 0, disabled: false,
      expiresIn: opts.seconds ?? 3,
    };
    room.hazards.push(hazard);
    return hazard;
  }

  #spawnTempObstacle(x, y, opts = {}) {
    const room = this.currentRoom;
    if (!room) return null;
    const obj = {
      id: `${room.nodeId}-tmp${this.tempObstacles.length}`,
      defId: 'TEMP',
      x, y,
      w: opts.w ?? 2, h: opts.h ?? 1,
      blocksMovement: true,
      blocksProjectiles: !opts.fake,
      blocksFlying: false,
      blocksLineOfSight: !opts.fake,
      health: opts.health ?? 12,
      maxHealth: opts.health ?? 12,
      requiresBlast: false,
      destroyed: false,
      seconds: opts.seconds ?? 8,
      temporary: true,
      fake: Boolean(opts.fake),
    };
    this.tempObstacles.push(obj);
    room.collision.addObject(obj);
    return obj;
  }

  #spawnPickup(x, y, kind, count = 1) {
    const room = this.currentRoom;
    if (!room) return;
    for (let i = 0; i < count; i += 1) {
      room.pickups.push({
        id: `${room.nodeId}-drop${room.pickups.length}`,
        kind, x: x + (i - count / 2) * 0.5, y, collected: false,
      });
    }
  }

  #spawnTurret(x, y, opts = {}) {
    // A temporary turret is modelled as a non-required hostile so it can be shot,
    // but it never gates the clear (GDD 6.1: a clear waits for required enemies).
    const enemy = this.#instantiate('ENM-018', null, {
      zone: SPAWN_ZONE.GROUND_RANGED,
      roomInstance: this.currentRoom,
      staged: false,
      at: { x, y },
      overrides: { required: false, healthMul: 0.3 },
    });
    if (enemy) this.pending.push({ remaining: opts.seconds ?? 4, fn: () => this.#kill(enemy, 'EXPIRED') });
    return enemy;
  }

  #damageObject(obj, amount, owner) {
    if (obj.destroyed || obj.maxHealth <= 0) return;
    if (obj.requiresBlast && owner !== ALLEGIANCE.ENVIRONMENT) return;
    obj.health -= amount;
    if (obj.health <= 0) this.#destroyObject(obj, 'ATTACK');
  }

  #destroyObject(obj, cause) {
    if (obj.destroyed) return;
    obj.destroyed = true;
    this.currentRoom?.state.destroyedObjectIds.add(obj.id);
    this.events.emit(EVENTS.OBJECT_DESTROYED, { objectId: obj.id, defId: obj.defId, cause });
  }

  #sealDoor(enemy) {
    const room = this.currentRoom;
    if (!room) return null;
    // Never seal the door the player came through, or the room becomes a trap with
    // no readable exit. R-CMB-001 requires the lock to be explainable.
    for (const [socketId, pos] of room.doorWorldPositions) {
      if (pos.door.doorClass === 'BOSS') continue;
      if (socketId === room.entrySocketId) continue;
      pos.door.sealedBy = enemy.id;
      return socketId;
    }
    return null;
  }

  #releaseDoor(socketId) {
    const room = this.currentRoom;
    const pos = room?.doorWorldPositions.get(socketId);
    if (pos) pos.door.sealedBy = null;
  }

  stats() {
    return {
      hostiles: this.aliveCount,
      required: this.requiredAlive,
      projectiles: this.projectiles.count,
      pulses: this.pulses.length,
      encounter: this.currentEncounter?.id ?? null,
    };
  }
}
