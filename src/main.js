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
import { SIM_DT, LOGICAL_WIDTH, LOGICAL_HEIGHT, DOOR_CLASS, ROOM_ROLE, TILE } from './core/constants.js';
import { Camera } from './render/camera.js';
import { Renderer, LAYER_ORDER } from './render/renderer.js';
import { getSpriteDef } from './render/sprites.js';
import { InputSystem, ACTION } from './systems/input.js';
import { TouchControls } from './systems/touch.js';
import { Run, RUN_STATE, doorCost } from './systems/run.js';
import { moveWithCollision, resolveOverlap, clampToRoom } from './systems/physics.js';
import { CombatResolver } from './systems/combat.js';
import { RoomController, ROOM_STATE } from './systems/room-state.js';
import { UnlockService } from './systems/unlocks.js';
import { SaveService } from './systems/save.js';
import { AudioEngine } from './audio/engine.js';
import { MenuSystem, SCREEN } from './ui/menus.js';
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

/**
 * How many screen pixels one authored pixel of a boss sprite covers.
 *
 * Bosses share the enemy render path — BossRuntime pushes the boss into `hostiles` so every
 * collision, on-hit and draw pass treats it as an enemy with a large radius — but they do not
 * share the enemy *scale*. An enemy is a 16x16 grid at scale 2, which is one world unit; a
 * boss body is 2.6 to 5.2 units across, so the same fixed scale would draw the final boss at
 * a fifth of the hitbox the player is dodging.
 *
 * Derived from the authored grid width and the boss's own collision radius rather than tuned
 * per sprite, so art and collision stay in step by construction: change a boss's radius and
 * its sprite follows, and a boss authored on a different grid size still fills its body.
 */
export function bossSpriteScale(boss) {
  const grid = getSpriteDef(boss.def?.spriteId)?.width || 24;
  return Math.max(2, Math.round((boss.radius * 2 * TILE) / grid));
}

class Game {
  constructor(canvas) {
    this.events = new EventBus();
    this.scheduler = new PhaseScheduler();
    this.camera = new Camera();
    this.renderer = new Renderer(canvas, { camera: this.camera });
    this.input = new InputSystem().attach(globalThis);
    // Touch listens on the canvas rather than the window: it needs canvas-relative coordinates,
    // and it must not swallow gestures aimed at the page around the game.
    this.touch = new TouchControls().attach(this.canvas);
    this.input.touch = this.touch;
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
      // The Run owns the seed, so the controller borrows its stream source rather than
      // holding a null until start() patches it in. Passing null here meant any clear that
      // resolved before start() reassigned it threw inside the reward roll.
      rng: this.run.rng,
      registry: this.registry,
      spawner: this.runtime,
      rewards: this.loot,
    });

    // Persistence and progression. The save is read before anything else needs it, so a
    // returning player's unlocks are in place before the first floor generates.
    this.save = new SaveService();
    this.profileSave = this.save.loadProfile();
    this.settings = this.save.loadSettings();
    this.statistics = this.save.loadStatistics();
    this.unlocks = new UnlockService({
      registry: this.registry,
      events: this.events,
      profile: this.profileSave,
      getRun: () => this.run,
    });

    this.audio = new AudioEngine({
      registry: this.registry,
      events: this.events,
      settings: this.settings,
      loc: (key) => this.loc(key),
    });

    this.menus = new MenuSystem({
      renderer: this.renderer,
      registry: this.registry,
      settings: this.settings,
      profile: this.profileSave,
      save: this.save,
      loc: this.loc,
      // The live input system, so the Controls screen edits the real bindings rather than a
      // copy that would have to be synchronised back (GDD 17.6).
      input: this.input,
      actions: {
        newRun: () => this.beginRun({}),
        continueRun: () => this.beginRun({ resume: true }),
        restart: () => this.beginRun({ seed: this.run.seed, mode: this.run.mode }),
        quitToTitle: () => this.toTitle(),
        settingsChanged: () => this.applyDisplaySettings(),
      },
    });

    this.#installSystems();
    this.#installPersistence();
    this.#installAudio();
    // Saved bindings, before the first frame. GDD 17.6's remapping is only worth anything if
    // it survives a reload, and the Controls screen writes into this same settings domain.
    if (this.settings.input) this.input.load(this.settings.input);
    this.applyDisplaySettings();
    this.#installListeners();
    this.loop = new GameLoop((dt) => this.update(dt), (alpha, frameDt) => this.render(alpha, frameDt));
  }

  /**
   * Advance touch holds and tell the overlay what the player can currently do.
   *
   * The context is what lets ITEM, PKT and USE dim instead of offering actions that would do
   * nothing — a button for something unavailable is noise, and on a screen this small noise is
   * expensive.
   */
  #updateTouch(dt) {
    if (!this.touch?.active) return;
    this.touch.reducedMotion = Boolean(this.settings?.reducedMotion);
    this.touch.update(dt);
    const player = this.run?.player;
    this.touch.setContext({
      // `activeId` and `pocket`, not `activeItemId`/`pocket.length` — the pocket is a single
      // slot holding one entry or null (R-CON-005), never a list.
      hasActive: Boolean(player?.activeId),
      hasPocket: Boolean(player?.pocket),
    });
  }

  /**
   * Autosave and statistics.
   *
   * GDD 21.2 names the moments: entering a room, resolving a pickup or purchase, a boss
   * victory, a floor transition, and any unlock-critical event. All of those are room
   * boundaries or discrete events rather than mid-frame states, which is what makes
   * R-TEC-008's "resume at a safe boundary" achievable — the save is never taken during a
   * half-resolved collision frame because it is never taken during a frame at all.
   */
  #installPersistence() {
    const persist = () => {
      this.save.saveProfile(this.profileSave);
      this.save.saveStatistics(this.statistics);
    };

    // An unlock is the one event that MUST reach disk immediately: losing it would break
    // R-PRG-001's "granted exactly once" from the player's side, by asking them to earn the
    // same thing twice.
    this.events.on(EVENTS.UNLOCK_GRANTED, persist, { priority: LISTENER_PRIORITY.PROGRESSION });

    this.events.on(EVENTS.ROOM_CLEARED, () => {
      this.statistics.roomsCleared += 1;
      persist();
    }, { priority: LISTENER_PRIORITY.PROGRESSION });

    this.events.on(EVENTS.BOSS_DEFEATED, () => {
      this.statistics.bossesDefeated += 1;
      persist();
    }, { priority: LISTENER_PRIORITY.PROGRESSION });

    this.events.on(EVENTS.FLOOR_ENTERED, () => {
      persist();
      this.#saveRun();
    }, { priority: LISTENER_PRIORITY.PROGRESSION });

    this.events.on(EVENTS.ROOM_ENTERED, () => this.#saveRun(), {
      priority: LISTENER_PRIORITY.PROGRESSION,
    });

    this.events.on(EVENTS.RUN_ENDED, (e) => {
      this.statistics.runs += 1;
      if (e?.reason === 'DEATH') this.statistics.deaths += 1;
      persist();
      // GDD 21.2: a finished run is not resumable, and leaving it on disk would offer the
      // player a continue that drops them into a dead run.
      this.save.clearRun();
    }, { priority: LISTENER_PRIORITY.PROGRESSION });
  }

  /** Write the resumable run. Only ever called at a room or floor boundary. */
  #saveRun() {
    if (!this.run?.save) return;
    try {
      this.save.saveRun(this.run.save());
    } catch (err) {
      // A run that cannot be serialised must not take the frame down with it. The player
      // keeps playing; they lose only the ability to resume.
      console.error(`Could not serialise the run for continue: ${err.message}`);
    }
  }

  /**
   * Audio wiring.
   *
   * The context is created on first input rather than at boot: every browser refuses to start
   * audio outside a user gesture, and one created at page load begins suspended and stays
   * that way. So the game is silent until the player touches a key, which is both required
   * and reasonable.
   */
  #installAudio() {
    // Music follows the department, and layers gate on room state (GDD 19.3) rather than the
    // track crossfading — a room turning dangerous adds a line to what is already playing.
    this.events.on(EVENTS.FLOOR_ENTERED, () => {
      const music = this.run.department?.presentation?.music
        ?? this.registry.get('department', this.run.floorDef?.department)?.presentation?.music;
      if (music) this.audio.playMusic(music);
    }, { priority: LISTENER_PRIORITY.PRESENTATION });

    this.events.on(EVENTS.ROOM_WAVE_STARTED, () => this.audio.setIntensity('COMBAT'), {
      priority: LISTENER_PRIORITY.PRESENTATION,
    });
    this.events.on(EVENTS.BOSS_SPAWNED, () => this.audio.setIntensity('BOSS'), {
      priority: LISTENER_PRIORITY.PRESENTATION,
    });
    this.events.on(EVENTS.ROOM_CLEARED, () => this.audio.setIntensity('ALWAYS'), {
      priority: LISTENER_PRIORITY.PRESENTATION,
    });

    // R-AUD-003: the caption is the audio for a player who has it off, so it goes through
    // the same banner queue as anything else the player must read.
    this.events.on(EVENTS.CAPTION_SHOWN, (e) => {
      this.hud.queueCaption?.(e);
    }, { priority: LISTENER_PRIORITY.PRESENTATION });
  }

  /** Register per-phase work in GDD 20.5 order. */
  #installSystems() {
    this.scheduler
      .register(PHASE.INPUT, 'sampleInput', () => {
        // First real input is the gesture the browser wants before it will start audio.
        if (!this.audio.ready && this.input.hadAnyInput?.()) this.audio.unlock();
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
      .register(PHASE.PRESENTATION, 'music', () => this.audio.update())
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

  /**
   * Start a run.
   *
   * @param {object} [opts] forwarded to Run.start: `seed`, `routeId`, `profileId`, `mode`.
   *   This used to take no arguments and silently discard whatever it was passed, so
   *   `game.start({ seed })` generated a random seed instead — including in tests, which
   *   therefore were not reproducing what they claimed to.
   */
  start(opts = {}) {
    try {
      // A returning player's unlocks decide which floors and routes generation may use, so
      // they go in before the run starts. R-PRG-002 forbids changing a run in progress, so
      // there is no "apply unlocks afterwards" path to fall back on.
      this.run.start({
        unlockFlags: [...this.unlocks.activeFlags()],
        profileId: this.profileSave.profiles[0] ?? 'PRF-001',
        ...opts,
      });
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
    this.#updateTouch(dt);
    // Menus take input before the simulation and suspend it while open.
    //
    // Gated here rather than inside each phase: a phase that forgot the check would keep
    // running under the pause screen, and "the game kept playing while I was in Options" is
    // the exact bug this shape makes impossible.
    const menuInput = this.input.sample({ menuOnly: true });
    if (this.menus.update(dt, menuInput)) {
      if (this.audio.ready) this.audio.suspend();
      return;
    }
    if (this.audio.ready) this.audio.resume();
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

  /**
   * Push the saved settings into the systems that own display state.
   *
   * The renderer and camera each keep their own settings — the renderer because a grayscale
   * change has to invalidate baked sprites and the room cache, the camera because shake is
   * a scalar it applies per frame. Nothing read the SAVED settings, so every accessibility
   * toggle in Options changed a value on disk and nothing on screen.
   *
   * Called on boot and whenever a setting changes, so the effect is immediate rather than
   * waiting for the next room.
   */
  applyDisplaySettings() {
    const s = this.settings;
    this.renderer.setSetting('grayscale', Boolean(s.grayscale));
    this.renderer.setSetting('highContrast', Boolean(s.highContrast));
    // Reduced effects thins particles; reduced motion calms flashes and shake. They are
    // separate settings because they help different people: one is about visual noise, the
    // other about vestibular comfort.
    this.renderer.setSetting('particleDensity', s.reducedEffects ? 0.3 : 1);
    this.renderer.setSetting('flashIntensity', s.reducedMotion ? 0.25 : 1);
    this.camera.setShakeScale?.(s.reducedMotion ? 0 : 1);
    this.audio.applySettings();
  }

  /**
   * Start or resume a run from the menus.
   *
   * The selected employee profile and challenge come from the title screen, and unlock flags
   * from the profile save — all three have to be settled before generation, since R-PRG-002
   * forbids changing a run once it is in progress.
   */
  beginRun({ seed, mode, resume = false } = {}) {
    const challengeId = this.profileSave.selectedChallenge;
    const challenge = challengeId ? this.registry.get('challenge', challengeId) : null;

    this.menus.closeAll();
    this.menus.hasRun = true;
    this.run.start({
      unlockFlags: [...this.unlocks.activeFlags()],
      profileId: challenge?.profile ?? this.profileSave.selectedProfile ?? 'PRF-001',
      routeId: challenge?.route ?? 'ROUTE-BASE',
      // GDD 21.3: a challenge run is its own seed mode, and only enables its own unlock.
      ...(challenge ? { mode: 'CHALLENGE' } : {}),
      ...(seed ? { seed } : {}),
      ...(mode ? { mode } : {}),
    });
    if (!resume) this.save.clearRun();
    this.combat.installGuards?.();
  }

  /** Back to the title screen. Does not touch the saved run: Continue may still want it. */
  toTitle() {
    this.menus.closeAll();
    this.menus.hasRun = false;
    this.menus.open(SCREEN.TITLE);
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
    // Above the HUD, below the menus: a pause screen must cover the thumb sticks, or the player
    // sees controls for a game that is not currently running.
    if (!this.menus.blocksGameplay) this.touch.draw(this.renderer);
    this.menus.draw({ results: this.runResults });
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
        scale: enemy.isBoss
          ? bossSpriteScale(enemy)
          : (variant?.scale ? Math.max(1, Math.round(2 * variant.scale)) : undefined),
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
