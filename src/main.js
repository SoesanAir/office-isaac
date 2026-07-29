/**
 * Browser entry point.
 *
 * GDD refs: 3.3 (run states), 4.1 (controls), 4.3 (camera), 4.4 (feedback
 *           hierarchy), 12.3 (combat entry and doors), 17.2 (HUD), 20.2 (module
 *           responsibilities), 20.5 (event ordering), 20.7 (performance targets).
 *
 * This wires the modules together and owns nothing itself. Every rule lives in the
 * system that owns it: the Run owns transitions, the RoomController owns the combat
 * lifecycle, the CombatResolver owns damage. Keeping this file thin is what makes
 * the GDD 20.2 module table true rather than aspirational.
 */

import { EventBus, EVENTS, PhaseScheduler, PHASE, LISTENER_PRIORITY } from './core/events.js';
import { GameLoop } from './core/loop.js';
import { SIM_DT, LOGICAL_WIDTH, LOGICAL_HEIGHT, DOOR_CLASS, ROOM_ROLE } from './core/constants.js';
import { Camera } from './render/camera.js';
import { Renderer, LAYER_ORDER } from './render/renderer.js';
import { InputSystem, ACTION } from './systems/input.js';
import { Run, RUN_STATE, doorCost } from './systems/run.js';
import { moveWithCollision, resolveOverlap, clampToRoom } from './systems/physics.js';
import { CombatResolver } from './systems/combat.js';
import { RoomController, ROOM_STATE } from './systems/room-state.js';
import { EncounterRuntime } from './systems/encounter-runtime.js';
import { AttackGraphResolver } from './systems/attack-graph.js';
import { PlayerAttackSystem } from './systems/player-attack.js';
import { runEffects } from './systems/effects.js';
import { LootService, applyPickup, PICKUP, POOL_FOR_ROLE } from './systems/loot.js';
import { Hud } from './ui/hud.js';
import { loadContent } from '../content/index.js';
import './register-all.js';

/** Distance in world units at which touching a door triggers traversal. */
/**
 * How close the player must be to a door to use it.
 *
 * Exported so tests assert against the real value rather than a copy that can drift.
 *
 * 1.2 rather than 0.9. The old value was knife-edge: after clampToRoom() the closest a
 * player could get to a NORTH or WEST door was 0.92, so those doors were untriggerable by
 * two hundredths of a unit and a dead-end room facing either way could not be left. The
 * clamp is fixed too (physics.js), but a threshold that depends on sub-tile precision is a
 * bug waiting to recur.
 */
export const DOOR_TRIGGER_RADIUS = 1.2;

class Game {
  constructor(canvas) {
    this.events = new EventBus();
    this.scheduler = new PhaseScheduler();
    this.camera = new Camera();
    this.renderer = new Renderer(canvas, { camera: this.camera });
    this.input = new InputSystem().attach(globalThis);
    this.registry = loadContent({ strict: false });
    this.loc = makeLocalizer(this.registry);
    this.hud = new Hud({ renderer: this.renderer, registry: this.registry, loc: this.loc });
    this.run = new Run({ registry: this.registry, events: this.events });

    this.debug = { visible: true, lastGenMs: 0, genAttempts: 0 };
    /** Cooldown so walking through a door does not immediately re-trigger it. */
    this.doorCooldown = 0;
    this.fatalError = null;
    /**
     * Presentation-only state. Deliberately not on the Player: walk cadence and
     * hit flash are cosmetic, and R-TEC-007 means nothing here may influence the
     * simulation or appear in a save.
     */
    this.fx = { walkPhase: 0, hitFlash: 0 };

    // --- combat stack -------------------------------------------------------
    // Order matters only for construction: the runtime needs the resolver, and the
    // resolver needs to be able to ask the runtime for the live hostile list, so the
    // cycle is broken with accessor functions rather than by reordering.
    this.runtime = new EncounterRuntime({
      registry: this.registry, events: this.events, combat: null, getRun: () => this.run,
    });
    this.combat = new CombatResolver({
      events: this.events,
      rng: null, // assigned when the run creates its RNG source
      getRun: () => this.run,
      getHostiles: () => this.runtime.hostiles,
      // Bridges damage events into the declarative effect registry, so items react
      // without the resolver knowing what an item is (R-TEC-006).
      runItemEffects: (ctx) => runEffects(this.#effectOwners(), ctx.timing, ctx),
    });
    this.runtime.combat = this.combat;

    this.loot = new LootService({
      registry: this.registry, events: this.events, getRun: () => this.run,
    });
    this.attackGraph = new AttackGraphResolver({ registry: this.registry });
    this.playerAttack = new PlayerAttackSystem({
      registry: this.registry,
      events: this.events,
      attackGraph: this.attackGraph,
      getRun: () => this.run,
      getRuntime: () => this.runtime,
    });
    this.roomController = new RoomController({
      events: this.events,
      rng: null,
      registry: this.registry,
      spawner: this.runtime,
      rewards: this.loot,
    });

    this.#installSystems();
    this.#installListeners();
    this.loop = new GameLoop((dt) => this.update(dt), (alpha, frameDt) => this.render(alpha, frameDt));
  }

  /** Register per-phase work in GDD 20.5 order. */
  #installSystems() {
    this.scheduler
      .register(PHASE.INPUT, 'sampleInput', () => {
        this.frameInput = this.input.sample({
          eightDirection: this.run.player?.hasPassive('ITM-012') ?? false,
        });
      })
      .register(PHASE.MOVEMENT_INTENT, 'playerMovement', (dt) => this.#movePlayer(dt))
      // GDD 20.5 puts AI intent after movement intent and before attack creation, so
      // an enemy always reacts to where the player is *this* tick, never last tick's.
      .register(PHASE.AI_INTENT, 'encounterRuntime', (dt) => this.runtime.update(dt))
      .register(PHASE.ATTACK_CREATION, 'playerAttack', (dt) => {
        this.playerAttack.update(dt, this.frameInput);
        // A charge releases the moment the aim input drops.
        if (!this.frameInput?.firing) this.playerAttack.releaseCharge(this.frameInput);
      })
      .register(PHASE.PHYSICS, 'projectileSteering', (dt) => this.playerAttack.steerProjectiles(dt))
      .register(PHASE.PHYSICS, 'pickups', () => this.#collectPickups())
      .register(PHASE.PHYSICS, 'doorTraversal', (dt) => this.#checkDoors(dt))
      .register(PHASE.ROOM_CLEAR, 'roomLifecycle', (dt) => {
        this.roomController.tick(dt, { hostiles: this.runtime.hostiles, player: this.run.player });
      })
      .register(PHASE.PRESENTATION, 'hudBanners', (dt) => {
        this.hud.update(dt, this.roomController.isSealed);
        // The compact map is always drawn (hud.showMap defaults true), so the MAP
        // action expands it to the full-screen overlay instead of toggling visibility.
        this.hud.mapExpanded = this.input.mapRequested();
      });
  }

  #installListeners() {
    // Presentation-priority listeners so they can never reorder a mechanic
    // (R-TEC-007).
    this.events.on(EVENTS.FLOOR_GENERATED, (e) => {
      this.debug.lastGenMs = e.elapsedMs;
      this.debug.genAttempts = e.attempts;
    }, { priority: LISTENER_PRIORITY.PRESENTATION });

    // MECHANIC priority: the room lifecycle has to start before anything presentational
    // reads its state, and before the first simulation tick of the new room.
    this.events.on(EVENTS.ROOM_ENTERED, (e) => {
      const room = this.run.room;
      if (!room) return;
      // The run creates its RNG source during start(), and start() enters the first
      // room before returning — so the services that need scoped streams are wired
      // here, at the first point where the source is guaranteed to exist.
      if (!this.combat.rng) {
        this.combat.rng = this.run.rng;
        this.roomController.rng = this.run.rng;
      }
      resolveOverlap(this.run.player, room.collision);
      // Transient attack state must not survive a threshold: a beam left running or an
      // arc mid-swing would deal damage in a room the player has already left.
      this.playerAttack.reset();
      this.runtime.despawnAll();
      room.entrySocketId = e.fromSocketId ?? null;
      this.roomController.enter(room, { fromSocketId: e.fromSocketId });
    }, { priority: LISTENER_PRIORITY.MECHANIC });

    this.events.on(EVENTS.ROOM_ENTERED, () => {
      const room = this.run.room;
      if (!room) return;
      this.camera.setRoom(room.rect, this.run.player);
    }, { priority: LISTENER_PRIORITY.PRESENTATION });

    // A rolled clear reward becomes a real pickup on the floor. MECHANIC priority,
    // because the pickup is a mechanic and the banner below is not.
    this.events.on(EVENTS.ROOM_REWARD_ROLLED, (e) => {
      const room = e.room || this.run.room;
      if (!room || !e.reward) return;
      const anchor = room.rewardAnchor ?? room.centre;
      room.pickups.push({
        id: `${room.nodeId}-clear${room.pickups.length}`,
        kind: e.reward.kind,
        count: e.reward.count ?? 1,
        x: anchor.x,
        y: anchor.y,
        collected: false,
      });
    }, { priority: LISTENER_PRIORITY.MECHANIC });

    this.events.on(EVENTS.ROOM_CLEARED, () => {
      // The shake is the whole notification. The doors opening already says the room is
      // finished, and a banner on top of that is telling the player something they can
      // see — GDD 17.2 reserves the centre banner for information the world cannot show.
      this.camera.shake(0.12, 0.14);
    }, { priority: LISTENER_PRIORITY.PRESENTATION });

    // Pedestal rooms place their item on first entry (GDD 12.5's reward table).
    this.events.on(EVENTS.ROOM_ENTERED, () => {
      const room = this.run.room;
      if (!room || room.pedestal || room.state.rewardSpawned) return;
      const pool = POOL_FOR_ROLE[room.role];
      if (!pool) return;
      room.state.rewardSpawned = true;
      const placed = this.loot.placePedestal({ room, depth: this.run.floorDef.depth, poolId: pool });
      // A pool with nothing eligible left is a real outcome, not an error: the room
      // simply has an empty pedestal, and GDD 8.4 step 2 is what emptied it.
      if (placed) this.loot.markSeen(placed.id);
    }, { priority: LISTENER_PRIORITY.MECHANIC });

    this.events.on(EVENTS.PLAYER_DAMAGED, () => {
      this.fx.hitFlash = 0.14;
      this.camera.shake(0.22, 0.16);
    }, { priority: LISTENER_PRIORITY.PRESENTATION });

    this.events.on(EVENTS.SECRET_REVEALED, () => {
      // R-AUD-004 wants a unique confirmation; the shake stands in until audio
      // lands, and is deliberately stronger than an object break.
      this.camera.shake(0.35, 0.3);
      this.hud.queueBanner({ title: 'Maintenance access', priority: 50 });
    }, { priority: LISTENER_PRIORITY.PRESENTATION });
  }

  /**
   * Everything that can react to an item, in a stable order.
   * The combat resolver calls this rather than reaching into the player, so item
   * reactions stay declarative (R-GOV-003, R-TEC-006).
   */
  #effectOwners() {
    const player = this.run?.player;
    if (!player) return [];
    const owners = [];
    let order = 0;
    for (const id of player.passiveIds) {
      const def = this.registry.get('passive', id);
      if (def) owners.push({ id, order: order++, effects: def.effects, def });
    }
    if (player.charmId) {
      const def = this.registry.get('charm', player.charmId);
      if (def) owners.push({ id: def.id, order: order++, effects: def.effects, def });
    }
    for (const id of player.transformationIds) {
      const def = this.registry.get('transformation', id);
      if (def) owners.push({ id: def.id, order: order++, effects: def.effects, def });
    }
    return owners;
  }

  /**
   * Collect pickups and pedestal items the player is standing on.
   *
   * GDD R-LOOP-003: no standard pedestal item is forced by contact with the room's
   * entrance or exit path — so a pedestal needs the player to walk *onto* it, and its
   * radius is deliberately tighter than a loose pickup's.
   */
  #collectPickups() {
    const room = this.run.room;
    const player = this.run.player;
    if (!room || !player || player.health.isDead) return;

    for (const pickup of room.pickups) {
      if (pickup.collected) continue;
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > player.radius + 0.5) continue;
      // A health pickup the player cannot use is left on the floor rather than
      // consumed, because GDD 9.2 refills "up to current capacity" — silently eating
      // it at full health would feel like theft.
      if (!applyPickup(player, pickup.kind, pickup.count ?? 1)) continue;
      pickup.collected = true;
      room.state.collectedPickupIds.add(pickup.id);
      this.events.emit(EVENTS.PICKUP_COLLECTED, { kind: pickup.kind, count: pickup.count ?? 1 });
      this.events.emit(EVENTS.SFX_REQUESTED, { sound: PICKUP_SFX[pickup.kind] ?? 'SFX-PICKUP_GENERIC' });
    }

    const pedestal = room.pedestal;
    if (!pedestal || pedestal.taken) return;
    const near = Math.hypot(player.x - pedestal.x, player.y - pedestal.y) < player.radius + 0.35;
    if (!near) {
      // Stepping off re-arms the pedestal. R-WPN-002 makes a weapon swap reversible,
      // which means the pedestal stays active after a swap — so without this latch the
      // player would swap back and forth every single tick while standing on it.
      pedestal.armed = true;
      return;
    }
    if (pedestal.armed === false) return;
    pedestal.armed = false;
    this.#takePedestal(room, pedestal);
  }

  /** Equip or absorb a pedestal item. GDD 8.1's slot rules decide which. */
  #takePedestal(room, pedestal) {
    const player = this.run.player;
    const def = this.registry.get(pedestal.kind, pedestal.id);
    if (!def) return;

    if (pedestal.kind === 'weapon') {
      // R-WPN-002: the previous weapon stays on the pedestal, so the swap is
      // reversible until the player leaves.
      const previous = player.weaponId;
      player.equipWeapon(pedestal.id);
      this.attackGraph.invalidate();
      pedestal.id = previous;
      pedestal.kind = 'weapon';
      this.events.emit(EVENTS.WEAPON_EQUIPPED, { weaponId: def.id, previous });
    } else if (pedestal.kind === 'active') {
      const previous = player.activeId;
      player.equipActive(pedestal.id);
      pedestal.id = previous;
      if (!previous) pedestal.taken = true;
    } else if (pedestal.kind === 'charm') {
      const previous = player.charmId;
      player.equipCharm(pedestal.id);
      pedestal.id = previous;
      if (!previous) pedestal.taken = true;
    } else {
      player.addPassive(pedestal.id);
      this.attackGraph.invalidate();
      pedestal.taken = true;
    }

    this.loot.markCollected(def.id);
    this.events.emit(EVENTS.ITEM_COLLECTED, { contentId: def.id, kind: pedestal.kind });
    this.events.emit(EVENTS.SFX_REQUESTED, { sound: 'SFX-ITEM_COLLECT' });
    // GDD 17.2 / 17.3: the banner shows a name and a short qualitative phrase, never
    // a stat delta.
    this.hud.queueBanner({
      title: this.loc(def.nameLoc),
      subtitle: def.pickupPhraseLoc ? this.loc(def.pickupPhraseLoc) : undefined,
      priority: 30,
    });
  }

  start() {
    try {
      this.run.start();
      this.combat.installGuards?.();
    } catch (err) {
      this.fatalError = err;
      // Surface content gaps loudly rather than showing a black screen
      // (R-TEC-005: invalid content fails loudly in development).
      console.error('Run failed to start:', err);
    }
    this.loop.start();
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  update(dt) {
    if (this.fatalError) return;
    this.run.tick(dt);
    this.scheduler.tick(dt, this);
    this.run.player.tick(dt);
    this.camera.update(dt, this.run.player);
    if (this.doorCooldown > 0) this.doorCooldown -= dt;
    if (this.fx.hitFlash > 0) this.fx.hitFlash -= dt;
    // Accumulate walk phase from distance travelled, not frame count, so the step
    // cadence does not speed up with framerate (GDD 18.2 authored frame timing).
    const p = this.run.player;
    this.fx.walkPhase += Math.hypot(p.velocity.x, p.velocity.y) * dt;
  }

  #movePlayer(dt) {
    const player = this.run.player;
    const room = this.run.room;
    const input = this.frameInput;
    if (!player || !room || !input) return;
    if (player.health.isDead) return;

    // applyMovement resolves speed, statuses, and clamps; this file must not
    // duplicate that math (R-PLY-003 lives in the player model).
    player.applyMovement(input.moveX * input.moveMagnitude, input.moveY * input.moveMagnitude, dt);
    const dx = player.velocity.x * dt;
    const dy = player.velocity.y * dt;
    moveWithCollision(player, dx, dy, room.collision);
    clampToRoom(player, room.collision);
    if (input.aimDirection) player.facing = input.aimDirection;
    else if (dx !== 0 || dy !== 0) player.facing = facingFromVector(dx, dy);
  }

  /** Run one door-traversal pass. Test seam: the loop is not stepped in tests. */
  checkDoorsForTest() {
    this.#checkDoors(0);
  }

  /**
   * Door traversal.
   *
   * GDD 12.3: doors seal during active combat, so traversal is refused while the
   * room is hostile and uncleared. Cost is charged once, on the frame of the move.
   */
  #checkDoors(dt) {
    if (this.doorCooldown > 0) return;
    const room = this.run.room;
    const player = this.run.player;
    if (!room || !player) return;
    // GDD 12.3: normal doors are sealed during active combat.
    if (this.roomController.isSealed) return;

    for (const [socketId, pos] of room.doorWorldPositions) {
      const door = pos.door;
      if (!door.discovered) continue;
      if (Math.hypot(player.x - pos.x, player.y - pos.y) > DOOR_TRIGGER_RADIUS) continue;

      const cost = doorCost(door.doorClass);
      if (cost.accessCards > 0) {
        if (player.accessCards < cost.accessCards) {
          this.hud.queueBanner({ title: 'Locked', subtitle: 'Needs a badge', seconds: 1.1 });
          this.doorCooldown = 0.8;
          return;
        }
        player.addAccessCards(-cost.accessCards);
        this.events.emit(EVENTS.DOOR_UNLOCKED, { edgeId: door.edgeId, cost });
      }
      this.doorCooldown = 0.35;
      this.run.useDoor(door);
      return;
    }
  }

  // -------------------------------------------------------------------------
  // Presentation
  // -------------------------------------------------------------------------

  render() {
    const r = this.renderer;
    r.beginFrame();

    if (this.fatalError) {
      this.#renderFatal();
      r.endFrame();
      return;
    }

    const room = this.run.room;
    const player = this.run.player;
    if (room) {
      r.drawRoom(this.run.roomNode, room.template, room.department, room.rect);
      this.#renderDecorations(room);
      this.#renderObjects(room);
      this.#renderHazards(room);
      this.#renderDoors(room);
      r.drawDebugZones(room.template, room.rect);
      this.#renderPickups(room);
      this.#renderEnemies();
      this.#renderPlayer(player);
      // Projectiles draw above every entity so a hostile shot can never be hidden
      // behind a body or a cabinet (GDD 18.2 layer order, R-ART-003).
      this.#renderProjectiles();
      this.#renderPlayerAttacks();
      r.drawLighting(room.department);
    }

    this.hud.draw({ player, run: this.run });
    if (this.debug.visible) this.#renderDebug();
    r.endFrame();
  }

  /**
   * A small contact shadow under an entity.
   *
   * Grounding, not lighting: a flat dark ellipse a touch narrower than the body, drawn on
   * the decal layer so it can never sit over a mechanic (R-ROM-004) and never competes with
   * the outline families that carry allegiance (GDD 18.5). Deliberately subtle — the game is
   * read by silhouette and outline colour, and a heavy shadow muddies both.
   */
  #renderShadow(x, y, radius, { alpha = 0.28 } = {}) {
    this.renderer.drawEllipse(x, y + radius * 0.72, radius * 0.85, radius * 0.4, '#05050a', {
      layer: LAYER_ORDER.FLOOR_DECAL,
      alpha,
    });
  }

  /** Spent-projectile marks: where every shot this room has seen came to rest. */
  #renderSpentMarks(room) {
    const marks = room.spentMarks;
    if (!marks || marks.length === 0) return;
    for (const m of marks) {
      // Hostile and friendly marks are tinted apart, so a cleared room reads as a record of
      // who was shooting from where rather than as undifferentiated grime.
      this.renderer.drawEllipse(m.x, m.y, m.size, m.size * 0.55,
        m.hostile ? '#4a1c1c' : '#1c2a3a',
        { layer: LAYER_ORDER.FLOOR_DECAL, alpha: 0.4 });
    }
  }

  #renderDecorations(room) {
    this.#renderSpentMarks(room);
    for (const deco of room.decorations) {
      // Floor decals only; GDD R-ROM-004 forbids decoration obscuring mechanics,
      // so these are flat, dim, and never above the entity layer.
      this.renderer.drawRect(deco.x, deco.y, 0.7, 0.5, '#2b2b36', {
        layer: LAYER_ORDER.FLOOR_DECAL, alpha: 0.5,
      });
    }
  }

  #renderObjects(room) {
    for (const obj of room.objects) {
      if (obj.destroyed) continue;
      const def = this.registry.get('envObject', obj.defId);
      const spriteId = def?.spriteId;
      // Tall objects draw above entities so cover reads as cover; short ones below.
      const layer = obj.h >= 1.5 ? LAYER_ORDER.HIGH_OBJECT : LAYER_ORDER.LOW_OBJECT;
      if (spriteId) {
        this.renderer.drawSprite(spriteId, obj.x, obj.y + obj.h / 2, { layer });
      } else {
        this.renderer.drawRect(obj.x, obj.y, obj.w, obj.h, '#6d6d84', { layer });
      }
      if (obj.health < obj.maxHealth && obj.maxHealth > 0) {
        // Damage state must be visible before destruction so breaking heavy cover
        // is a readable decision, not a guess (GDD 13.2).
        this.renderer.drawRect(obj.x, obj.y - obj.h / 2 - 0.3, obj.w * (obj.health / obj.maxHealth), 0.12,
          '#e8c246', { layer: LAYER_ORDER.VFX });
      }
    }
  }

  #renderDoors(room) {
    const sealed = this.roomController.isSealed;
    for (const [, pos] of room.doorWorldPositions) {
      const door = pos.door;
      if (!door.discovered) continue;
      let state = 'OPEN';
      if (sealed) state = 'SEALED';
      else if (door.doorClass === DOOR_CLASS.LOCKED_CARD) state = 'LOCKED_CARD';
      else if (door.doorClass === DOOR_CLASS.LOCKED_DOUBLE) state = 'LOCKED_DOUBLE';
      else if (door.doorClass === DOOR_CLASS.BOSS) state = 'BOSS';
      this.renderer.drawDoor(door, pos.x, pos.y, state);

      // World label for a cost, shown only near the relevant object (GDD 17.2).
      const cost = doorCost(door.doorClass);
      if (cost.accessCards > 0 && !sealed) {
        const near = Math.hypot(this.run.player.x - pos.x, this.run.player.y - pos.y) < 3;
        if (near) {
          this.renderer.drawWorldLabel(`${cost.accessCards} badge`, pos.x, pos.y - 1.2, {
            color: '#4a9ad0',
          });
        }
      }
    }
  }

  #renderHazards(room) {
    for (const hazard of room.hazards) {
      if (hazard.disabled) continue;
      const def = this.registry.get('hazard', hazard.defId);
      if (!def) continue;
      // R-ENV-002: a mechanical hazard must be visually distinct from a decorative
      // decal, so only mechanical ones get the hazard outline and full opacity.
      const alpha = def.mechanical ? (hazard.active ? 0.7 : 0.35) : 0.25;
      this.renderer.drawRect(
        hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, hazard.w, hazard.h,
        def.mechanical ? '#ff9a2a' : '#3a3a4a',
        { layer: LAYER_ORDER.FLOOR_DECAL, alpha },
      );
      if (def.mechanical) {
        // A hard outlined edge is the non-colour cue (R-UIX-005): the player can see
        // exactly where the dangerous region stops.
        this.renderer.drawRect(
          hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, hazard.w, hazard.h,
          '#ffe9a8', { layer: LAYER_ORDER.FLOOR_DECAL, fill: false, width: 1, alpha: 0.9 },
        );
      }
    }
  }

  #renderPickups(room) {
    for (const pickup of room.pickups) {
      if (pickup.collected) continue;
      this.renderer.drawSprite(PICKUP_SPRITE[pickup.kind] ?? 'pickup_credit', pickup.x, pickup.y, {
        outline: 'PICKUP', layer: LAYER_ORDER.PICKUP,
      });
      // Multi-credit drops show a count, because credits are one of the "obvious
      // counters" GDD D-013 allows to be numeric.
      if ((pickup.count ?? 1) > 1) {
        this.renderer.drawWorldLabel(`x${pickup.count}`, pickup.x, pickup.y - 0.9, { size: 9 });
      }
    }

    const pedestal = room.pedestal;
    if (!pedestal || pedestal.taken || !pedestal.id) return;
    const def = this.registry.get(pedestal.kind, pedestal.id);
    // GDD 8.2: the pedestal sprite and item silhouette are visible BEFORE pickup, so
    // the player can decide whether to walk over at all (R-LOOP-003).
    this.renderer.drawSprite('pedestal_base', pedestal.x, pedestal.y + 0.35, {
      layer: LAYER_ORDER.LOW_OBJECT,
    });
    if (def?.spriteId) {
      // Bob the item so a pedestal reads as an offer rather than as furniture.
      const bob = Math.sin(this.fx.walkPhase * 1.5 + pedestal.x) * 0.08;
      this.renderer.drawSprite(def.spriteId, pedestal.x, pedestal.y - 0.55 + bob, {
        outline: def.liability ? 'HOSTILE' : 'PICKUP',
        layer: LAYER_ORDER.PICKUP,
      });
    }
    if (Math.hypot(this.run.player.x - pedestal.x, this.run.player.y - pedestal.y) < 2.5 && def) {
      this.renderer.drawWorldLabel(this.loc(def.nameLoc), pedestal.x, pedestal.y - 1.6, { size: 10 });
    }
  }

  #renderEnemies() {
    for (const enemy of this.runtime.hostiles) {
      if (enemy.dead) continue;
      if (enemy.cloaked) continue;
      const variant = enemy.variant;
      this.#renderShadow(enemy.x, enemy.y, enemy.radius);
      this.renderer.drawSprite(enemy.def.spriteId, enemy.x, enemy.y, {
        // Hostile outline family, always. GDD 18.5 makes this the single signal for
        // allegiance, so it is never conditional on state or palette.
        outline: 'HOSTILE',
        layer: LAYER_ORDER.ENTITY,
        swap: variant?.paletteSwap,
        scale: variant?.scale ? Math.max(1, Math.round(2 * variant.scale)) : undefined,
        flash: enemy.hitFlash > 0,
        alpha: enemy.staged ? 0.55 : 1,
      });

      // Telegraph ring: the authored wind-up made visible (R-CMB-002, GDD 14.3).
      if (enemy.state === 'TELEGRAPH' && enemy.pendingAttack) {
        const total = enemy.pendingAttack.attack.telegraphSeconds || 0.3;
        const progress = 1 - enemy.stateTimer / total;
        this.renderer.drawCircle(enemy.x, enemy.y, enemy.radius + 0.35 + progress * 0.4,
          '#ff5a4a', { fill: false, width: 2, alpha: 0.35 + progress * 0.5, layer: LAYER_ORDER.VFX });
      }
      // A locked predictive destination is shown, because R-ENM-007 requires the
      // target to be committed AND visible before the attack resolves.
      if (enemy.lockedTarget && (enemy.state === 'TELEGRAPH' || enemy.state === 'DASH')) {
        this.renderer.drawCircle(enemy.lockedTarget.x, enemy.lockedTarget.y, 0.5,
          '#ff5a4a', { fill: false, width: 2, alpha: 0.6, layer: LAYER_ORDER.VFX });
      }
      if (enemy.blinkTarget) {
        this.renderer.drawCircle(enemy.blinkTarget.x, enemy.blinkTarget.y, 0.6,
          '#c78af0', { fill: false, width: 2, alpha: 0.7, layer: LAYER_ORDER.VFX });
      }
      // Shield state has to be legible or "why did that do nothing" becomes a bug
      // report rather than a lesson.
      if (enemy.shielded || enemy.shieldHp > 0) {
        this.renderer.drawCircle(enemy.x, enemy.y, enemy.radius + 0.28,
          '#3fb0b8', { fill: false, width: 2, alpha: 0.8, layer: LAYER_ORDER.VFX });
      }
      // Damaged enemies show a thin bar: GDD D-013 allows obvious counters, and
      // "is this nearly dead" is the most useful one in a crowded room.
      if (enemy.health < enemy.maxHealth) {
        const frac = Math.max(0, enemy.health / enemy.maxHealth);
        this.renderer.drawRect(enemy.x, enemy.y - enemy.radius - 0.45, 1.1, 0.12,
          '#2a1420', { layer: LAYER_ORDER.VFX, alpha: 0.8 });
        this.renderer.drawRect(
          enemy.x - (1.1 * (1 - frac)) / 2, enemy.y - enemy.radius - 0.45, 1.1 * frac, 0.12,
          '#e04a54', { layer: LAYER_ORDER.VFX },
        );
      }
    }
  }

  #renderProjectiles() {
    this.runtime.projectiles.pool.forEach((p) => {
      if (p.__dead) return;
      const hostile = p.owner !== 'PLAYER';
      const fall = p.fall || 0;
      // The shadow stays on the ground while the sprite arcs down toward it, which is what
      // sells the fall as gravity rather than as a fade. It also tightens as the shot lands,
      // so the two meet.
      this.#renderShadow(p.x, p.y, (p.radius ?? 0.22) * (1 - fall * 0.35), {
        alpha: 0.18 + fall * 0.16,
      });
      // Fall phase: drop toward the floor and shrink over the last fraction of flight, so a
      // shot visibly lands instead of blinking out. Purely visual — the projectile's
      // collision position is unchanged (see projectile.js).
      this.renderer.drawSprite(p.spriteId || 'prj_keycap', p.x, p.y + fall * fall * 0.45, {
        outline: hostile ? 'HOSTILE' : 'FRIENDLY',
        layer: LAYER_ORDER.PROJECTILE,
        scale: hostile ? 3 : 2,
        alpha: 1 - fall * 0.25,
      });
    });
  }

  #renderPlayerAttacks() {
    // Melee arcs and slams: brief, bright, and gone.
    for (const arc of this.playerAttack.arcs) {
      this.renderer.drawCircle(arc.x, arc.y, arc.radius, '#bfe4ff', {
        fill: false, width: arc.isSlam ? 3 : 2, alpha: 0.5, layer: LAYER_ORDER.VFX,
      });
    }
    for (const beam of this.playerAttack.beams) {
      const x2 = beam.x + Math.cos(beam.angle) * beam.range;
      const y2 = beam.y + Math.sin(beam.angle) * beam.range;
      this.renderer.drawLine(beam.x, beam.y, x2, y2, '#bfe4ff', {
        width: Math.max(2, beam.width * 8), alpha: 0.75, layer: LAYER_ORDER.PROJECTILE,
      });
    }
    for (const place of this.playerAttack.placements) {
      const x2 = place.x + Math.cos(place.angle) * place.range;
      const y2 = place.y + Math.sin(place.angle) * place.range;
      this.renderer.drawLine(place.x, place.y, x2, y2, '#c8a8f0', {
        width: 6, alpha: 0.4, layer: LAYER_ORDER.VFX,
      });
    }
    // Enemy pulses read as expanding rings so their radius is unambiguous.
    for (const pulse of this.runtime.pulses) {
      const t = 1 - pulse.remaining / pulse.seconds;
      this.renderer.drawCircle(pulse.x, pulse.y, pulse.radius * (0.5 + t * 0.5), '#ff5a4a', {
        fill: false, width: 3, alpha: 1 - t, layer: LAYER_ORDER.VFX,
      });
    }
  }

  #renderPlayer(player) {
    if (!player) return;
    if (player.health.isDead) {
      this.renderer.drawSprite('player_collapsed', player.x, player.y, {
        outline: 'PLAYER', layer: LAYER_ORDER.ENTITY,
      });
      return;
    }
    this.#renderShadow(player.x, player.y, player.radius);
    const spriteId = PLAYER_SPRITE_BY_FACING[player.facing] || 'player_idle_south';
    const moving = Math.abs(player.velocity.x) + Math.abs(player.velocity.y) > 0.3;
    const frame = moving ? Math.floor(this.fx.walkPhase * 2.2) % 2 : 0;
    const blinking = player.invulnerability.active
      && Math.floor(player.invulnerability.remaining * 20) % 2 === 0;

    this.renderer.drawSprite(spriteId, player.x, player.y, {
      frame,
      // R-PLY-005 / 18.3: the outline is persistent, not conditional.
      outline: 'PLAYER',
      layer: LAYER_ORDER.ENTITY,
      // Invulnerability blinks rather than fading out, so the silhouette never
      // disappears entirely while the player is repositioning.
      alpha: blinking ? 0.45 : 1,
      flash: this.fx.hitFlash > 0,
    });
  }

  #renderDebug() {
    const run = this.run;
    const lines = [
      `seed ${run.seed}  mode ${run.mode.id}`,
      `floor ${run.floorDef?.id ?? '-'}  depth ${run.floorDef?.depth ?? '-'}`,
      `room ${run.roomNode?.id ?? '-'} ${run.roomNode?.role ?? ''} ${run.roomNode?.templateId ?? ''}`,
      `state ${run.state}  rooms ${run.roomsVisited}/${run.floor?.nodes.size ?? 0}`,
      `gen ${this.debug.lastGenMs?.toFixed?.(1) ?? '-'}ms x${this.debug.genAttempts}`,
      `frame ${this.loop.averageFrameMs().toFixed(1)}ms`,
    ];
    let y = LOGICAL_HEIGHT - 8 - lines.length * 10;
    for (const line of lines) {
      this.renderer.drawText(line, 8, y, { size: 9, color: '#9a9aae' });
      y += 10;
    }
  }

  #renderFatal() {
    const msg = String(this.fatalError?.message || this.fatalError);
    this.renderer.drawText('Content is not ready yet.', LOGICAL_WIDTH / 2, 160, {
      size: 16, align: 'center', color: '#e04a54', weight: 'bold',
    });
    const wrapped = wrapText(msg, 72);
    let y = 200;
    for (const line of wrapped.slice(0, 14)) {
      this.renderer.drawText(line, LOGICAL_WIDTH / 2, y, { size: 10, align: 'center', color: '#c8c8d6' });
      y += 13;
    }
    this.renderer.drawText('Run `npm run validate` for the full report.', LOGICAL_WIDTH / 2, y + 10, {
      size: 10, align: 'center', color: '#9a9aae',
    });
  }
}

/** Pickup sprite and sound per kind, keyed off the loot service's PICKUP enum. */
const PICKUP_SPRITE = Object.freeze({
  CREDIT: 'pickup_credit',
  ACCESS_CARD: 'pickup_access_card',
  TONER_CHARGE: 'pickup_toner_charge',
  BATTERY: 'pickup_battery',
  COMPOSURE: 'pickup_composure',
  CAFFEINE: 'pickup_caffeine',
  SPITE: 'pickup_spite',
  GOLDEN_CUSHION: 'pickup_golden_cushion',
  SUPPLEMENT: 'pickup_supplement',
});

const PICKUP_SFX = Object.freeze({
  CREDIT: 'SFX-PICKUP_CREDIT',
  COMPOSURE: 'SFX-PICKUP_HEALTH',
  CAFFEINE: 'SFX-PICKUP_HEALTH',
  SPITE: 'SFX-PICKUP_HEALTH',
  ACCESS_CARD: 'SFX-PICKUP_GENERIC',
  TONER_CHARGE: 'SFX-PICKUP_GENERIC',
  BATTERY: 'SFX-PICKUP_GENERIC',
  GOLDEN_CUSHION: 'SFX-PICKUP_GENERIC',
  SUPPLEMENT: 'SFX-PICKUP_GENERIC',
});

const PLAYER_SPRITE_BY_FACING = Object.freeze({
  NORTH: 'player_idle_north',
  SOUTH: 'player_idle_south',
  EAST: 'player_idle_east',
  WEST: 'player_idle_west',
  NORTHEAST: 'player_idle_east',
  SOUTHEAST: 'player_idle_east',
  NORTHWEST: 'player_idle_west',
  SOUTHWEST: 'player_idle_west',
});

function facingFromVector(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'EAST' : 'WEST';
  return dy >= 0 ? 'SOUTH' : 'NORTH';
}

/**
 * Localizer. R-TEC-006: no system may branch on display text, so this is the only
 * place a loc key becomes a string, and it is used for presentation only.
 */
function makeLocalizer(registry) {
  const tables = registry.all('localization');
  const table = tables.find((t) => t.language === 'en') || tables[0];
  return (key) => {
    if (!key) return '';
    return table?.strings?.[key] ?? key;
  };
}

function wrapText(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + word).length > width) {
      lines.push(line.trim());
      line = '';
    }
    line += `${word} `;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  globalThis.__officeIsaac = game; // debug handle, harmless in release
  globalThis.addEventListener('resize', () => game.renderer.resize());
  // F1 toggles the debug readout; the map is on Tab per GDD 4.1.
  globalThis.addEventListener('keydown', (e) => {
    if (e.code === 'F1') {
      e.preventDefault();
      game.debug.visible = !game.debug.visible;
    }
    if (e.code === 'F2') {
      e.preventDefault();
      game.renderer.setSetting('debugCollision', !game.renderer.settings.debugCollision);
    }
    if (e.code === 'F3') {
      e.preventDefault();
      game.renderer.setSetting('grayscale', !game.renderer.settings.grayscale);
    }
  });
  game.start();
}

/**
 * Auto-boot in the browser, but never when a harness has asked us not to.
 *
 * Importing this module used to start a game immediately, which meant a test that
 * imported `Game` to construct its own instance ended up with two live games sharing
 * one document — both attaching input listeners, both ticking. Tests set
 * `globalThis.__OI_NO_AUTOBOOT` before importing, so the module stays a module.
 */
if (typeof document !== 'undefined' && !globalThis.__OI_NO_AUTOBOOT) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

export { Game, boot };
