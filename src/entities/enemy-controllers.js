/**
 * Enemy movement controllers and attack modules.
 *
 * GDD refs: 14.2 (the behaviour taxonomy and its counterplay column), 14.3 (the
 *           readability contract: movement style visible before the first dangerous
 *           action; wind-up, active, recovery and cooldown are authored states),
 *           6.2 ("Enemy attacks use authored patterns and data-defined timing. They
 *           do not directly read controller input to cheat reactions."),
 *           R-CMB-002 / R-ENM-002 (an authored telegraph precedes the first damaging
 *           frame), R-ENM-007 (predictive attacks commit to a telegraphed target
 *           BEFORE movement or damage, so changing direction after the lock evades),
 *           R-ENM-003 (no permanent invulnerability or infinite-heal loops),
 *           20.3 (behaviour composed from curated modules; runtime AI generation is
 *           prohibited for release content).
 *
 * Two rules shape every controller here.
 *
 * **Nothing reads input.** Controllers receive the player's *position and velocity*,
 * never the input state. GDD 6.2 forbids reading the controller to cheat reactions,
 * and the surest way to guarantee that is for input state to be unreachable from this
 * file — which it is.
 *
 * **Prediction commits, then telegraphs, then fires.** R-ENM-007 is precise: the
 * chosen vector is locked and shown before anything moves. So predictive controllers
 * sample the player once, at lock time, and never re-aim during the telegraph. That is
 * what makes "change direction after the lock" a real counterplay rather than a
 * hopeful one.
 */

import { STATUS } from '../core/constants.js';
import { normalizeInto, distance } from '../core/math.js';
import { moveWithCollision, hasLineOfSight, resolveOverlap } from '../systems/physics.js';

/** Authored AI states. Every enemy moves through these, never ad hoc booleans. */
export const AI_STATE = Object.freeze({
  IDLE: 'IDLE',
  TELEGRAPH: 'TELEGRAPH',
  ATTACK: 'ATTACK',
  ACTIVE: 'ACTIVE',
  RECOVER: 'RECOVER',
  DASH: 'DASH',
  CHANNEL: 'CHANNEL',
  RELOCATE: 'RELOCATE',
});

const controllers = new Map();
const attackModules = new Map();
const behaviorModules = new Map();

/**
 * Register a movement/AI controller.
 * @param {string} id name referenced by `enemy.movement.controller`
 * @param {{note: string, update: (enemy, ctx, dt) => void}} spec
 */
export function registerController(id, spec) {
  if (controllers.has(id)) throw new Error(`Duplicate enemy controller "${id}".`);
  if (!spec.note) throw new Error(`Controller "${id}" needs a note.`);
  controllers.set(id, Object.freeze({ id, ...spec }));
  return id;
}

/** Register an attack module referenced by `enemy.attacks[].module`. */
export function registerAttackModule(id, spec) {
  if (attackModules.has(id)) throw new Error(`Duplicate attack module "${id}".`);
  attackModules.set(id, Object.freeze({ id, ...spec }));
  return id;
}

/** Register a variant behaviour module referenced by `enemyVariant.behaviorModules`. */
export function registerBehaviorModule(id, spec) {
  if (behaviorModules.has(id)) throw new Error(`Duplicate behaviour module "${id}".`);
  behaviorModules.set(id, Object.freeze({ id, ...spec }));
  return id;
}

export const getController = (id) => controllers.get(id);
export const getAttackModule = (id) => attackModules.get(id);
export const getBehaviorModule = (id) => behaviorModules.get(id);
export const allControllers = () => [...controllers.values()];
export const allAttackModules = () => [...attackModules.values()];
export const allBehaviorModules = () => [...behaviorModules.values()];

/** Validation seam: controllers and modules content references but nobody built. */
export function findMissingBehaviours(registry) {
  const missing = [];
  for (const def of registry.all('enemy')) {
    if (!controllers.has(def.movement.controller)) {
      missing.push({ id: def.id, kind: 'controller', name: def.movement.controller });
    }
    for (const attack of def.attacks) {
      if (!attackModules.has(attack.module)) {
        missing.push({ id: def.id, kind: 'attackModule', name: attack.module });
      }
    }
  }
  for (const def of registry.all('enemyVariant')) {
    for (const mod of def.behaviorModules) {
      if (!behaviorModules.has(mod.module)) {
        missing.push({ id: def.id, kind: 'behaviorModule', name: mod.module });
      }
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const scratch = { x: 0, y: 0 };

/** Effective speed after statuses. Slow and Haste are the only movement modifiers. */
function speedOf(enemy) {
  return enemy.baseSpeed * enemy.status.movementMultiplier();
}

/** Move toward a point, honouring collision. True if any progress was made. */
function stepToward(enemy, tx, ty, dt, ctx, speedMul = 1) {
  if (enemy.status.blocksMovement()) return false;
  normalizeInto(scratch, tx - enemy.x, ty - enemy.y);
  const speed = speedOf(enemy) * speedMul;
  const moved = moveWithCollision(enemy, scratch.x * speed * dt, scratch.y * speed * dt, ctx.room.collision);
  if (scratch.x !== 0 || scratch.y !== 0) {
    enemy.facing = Math.abs(scratch.x) >= Math.abs(scratch.y)
      ? (scratch.x >= 0 ? 'EAST' : 'WEST')
      : (scratch.y >= 0 ? 'SOUTH' : 'NORTH');
  }
  return moved.movedX || moved.movedY;
}

function stepAway(enemy, tx, ty, dt, ctx, speedMul = 1) {
  return stepToward(enemy, enemy.x * 2 - tx, enemy.y * 2 - ty, dt, ctx, speedMul);
}

/**
 * Lock a predictive target once, at telegraph start.
 *
 * R-ENM-007's whole point: the vector is chosen and shown before the attack commits,
 * so a player who changes direction after the lock escapes. Re-sampling during the
 * telegraph would silently break that and make the attack unavoidable.
 */
function lockPredictedTarget(enemy, ctx, seconds) {
  const p = ctx.player;
  enemy.lockedTarget = {
    x: p.x + (p.velocity?.x ?? 0) * seconds,
    y: p.y + (p.velocity?.y ?? 0) * seconds,
  };
  return enemy.lockedTarget;
}

/** Advance the state timer; true on the tick the state completes. */
function tickState(enemy, dt) {
  enemy.stateTimer -= dt;
  if (enemy.stateTimer <= 0) {
    enemy.stateTimer = 0;
    return true;
  }
  return false;
}

function enterState(enemy, state, seconds) {
  enemy.state = state;
  enemy.stateTimer = seconds;
}

/** Begin a telegraphed attack if its cooldown has elapsed. */
function tryAttack(enemy, ctx, attackId) {
  const attack = attackId
    ? enemy.def.attacks.find((a) => a.id === attackId)
    : enemy.def.attacks[0];
  if (!attack) return false;
  if ((enemy.cooldowns.get(attack.id) ?? 0) > 0) return false;
  const module = attackModules.get(attack.module);
  if (!module) return false;
  // GDD 5.5: Silenced blocks support abilities only, so ordinary attacks continue.
  if (enemy.status.has(STATUS.SILENCED) && attack.support) return false;
  enemy.cooldowns.set(attack.id, attack.cooldownSeconds);
  enemy.pendingAttack = { attack, module };
  enterState(enemy, AI_STATE.TELEGRAPH, attack.telegraphSeconds);
  ctx.events?.emit('fx:sfx', { sound: enemy.def.audio?.telegraph ?? 'SFX-TELEGRAPH_GENERIC' });
  return true;
}

/** Resolve a telegraphed attack once its wind-up completes. */
function releaseAttack(enemy, ctx) {
  const pending = enemy.pendingAttack;
  enemy.pendingAttack = null;
  if (!pending) return;
  pending.module.fire(enemy, ctx, pending.attack.params || {}, pending.attack);
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

registerController('ChaseController', {
  note: 'Chaser (GDD 14.2): walks directly at the player. Counterplay is kiting.',
  update: (enemy, ctx, dt) => {
    // No telegraph: contact damage is the attack and the approach IS the warning,
    // which is why GDD 14.2 answers it with "kite, use cover, control distance".
    stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx);
  },
});

registerController('SlowAdvanceController', {
  note: 'Tank advance: slow, relentless, and unbothered by being shot.',
  update: (enemy, ctx, dt) => stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx, 0.65),
});

registerController('AnchoredTurretController', {
  note: 'Stationary shooter: never moves, fires on an authored cadence.',
  update: (enemy, ctx, dt) => {
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.RECOVER, 0.2);
      }
      return;
    }
    if (enemy.state === AI_STATE.RECOVER) {
      if (tickState(enemy, dt)) enterState(enemy, AI_STATE.IDLE, 0);
      return;
    }
    tryAttack(enemy, ctx);
  },
});

registerController('AnchoredSupportController', {
  note: 'Stationary support: holds position and applies its effect to nearby allies.',
  update: (enemy, ctx, dt) => {
    if (enemy.state === AI_STATE.TELEGRAPH && tickState(enemy, dt)) {
      releaseAttack(enemy, ctx);
      enterState(enemy, AI_STATE.IDLE, 0);
      return;
    }
    if (enemy.state === AI_STATE.IDLE) tryAttack(enemy, ctx);
  },
});

registerController('StandoffShooterController', {
  note: 'Holds a preferred range: closes when far, backs off when crowded.',
  update: (enemy, ctx, dt) => {
    const preferred = enemy.def.movement.params?.preferredRange ?? 5;
    const d = distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.RECOVER, 0.25);
      }
      return;
    }
    if (enemy.state === AI_STATE.RECOVER) {
      if (tickState(enemy, dt)) enterState(enemy, AI_STATE.IDLE, 0);
      return;
    }
    // Holding the band before shooting means the player reads intent from spacing
    // rather than guessing (GDD 14.3).
    if (d > preferred * 1.2) stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx);
    else if (d < preferred * 0.7) stepAway(enemy, ctx.player.x, ctx.player.y, dt, ctx);
    else if (hasLineOfSight(enemy.x, enemy.y, ctx.player.x, ctx.player.y, ctx.room.collision)) {
      tryAttack(enemy, ctx);
    }
  },
});

registerController('StrafeShooterController', {
  note: 'Mobile shooter: circles laterally while throwing, never straight at you.',
  update: (enemy, ctx, dt) => {
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.RECOVER, 0.3);
      }
      return;
    }
    if (enemy.state === AI_STATE.RECOVER && tickState(enemy, dt)) {
      enterState(enemy, AI_STATE.IDLE, 0);
    }
    // Perpendicular drift keeps it readable: never on a collision course, so the
    // player learns it is a shooter and not a chaser.
    const dx = ctx.player.x - enemy.x;
    const dy = ctx.player.y - enemy.y;
    const dir = enemy.strafeDir ?? (enemy.strafeDir = 1);
    if (!stepToward(enemy, enemy.x - dy * dir, enemy.y + dx * dir, dt, ctx, 0.8)) {
      enemy.strafeDir = -dir; // blocked: reverse rather than grind into the wall
    }
    if (enemy.state === AI_STATE.IDLE) tryAttack(enemy, ctx);
  },
});

registerController('ChaseShooterController', {
  note: 'Chaser shooter (ENM-015): pursues at medium speed and fires at intervals.',
  update: (enemy, ctx, dt) => {
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.IDLE, 0);
      }
      // Keeps walking through its own wind-up: this enemy is a pursuer first.
      stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx, 0.5);
      return;
    }
    stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx, 0.85);
    tryAttack(enemy, ctx);
  },
});

registerController('BurstDashController', {
  note: 'Burst mover (ENM-004): pause, shake, then dash a locked vector.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    switch (enemy.state) {
      case AI_STATE.TELEGRAPH:
        // Deliberately motionless: the shake IS the telegraph, and drifting during
        // it would blur the tell (GDD 14.3).
        if (tickState(enemy, dt)) enterState(enemy, AI_STATE.DASH, params.dashSeconds ?? 0.35);
        return;
      case AI_STATE.DASH: {
        const target = enemy.lockedTarget;
        if (target) {
          normalizeInto(scratch, target.x - enemy.x, target.y - enemy.y);
          const speed = params.dashSpeed ?? 8.5;
          moveWithCollision(enemy, scratch.x * speed * dt, scratch.y * speed * dt, ctx.room.collision);
        }
        if (tickState(enemy, dt)) enterState(enemy, AI_STATE.RECOVER, params.recoverSeconds ?? 0.5);
        return;
      }
      case AI_STATE.RECOVER:
        // The punish window GDD 14.2 promises for "move after the telegraph commits".
        if (tickState(enemy, dt)) enterState(enemy, AI_STATE.IDLE, 0);
        return;
      default: {
        const idle = params.idleSeconds ?? 0.6;
        enemy.idleTimer = (enemy.idleTimer ?? idle) - dt;
        if (enemy.idleTimer <= 0) {
          enemy.idleTimer = idle;
          lockPredictedTarget(enemy, ctx, enemy.def.ai.predictionSeconds ?? 0.25);
          enterState(enemy, AI_STATE.TELEGRAPH, enemy.def.ai.telegraphSeconds);
          ctx.events?.emit('fx:sfx', { sound: enemy.def.audio?.telegraph ?? 'SFX-TELEGRAPH_CHARGE' });
        }
      }
    }
  },
});

registerController('LineChargeController', {
  note: 'Charger (ENM-006): locks a straight line, crosses the room, recovers hard.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    switch (enemy.state) {
      case AI_STATE.TELEGRAPH:
        if (tickState(enemy, dt)) enterState(enemy, AI_STATE.DASH, params.chargeSeconds ?? 1.2);
        return;
      case AI_STATE.DASH: {
        const v = enemy.chargeVector || { x: 1, y: 0 };
        const speed = params.chargeSpeed ?? 10;
        const moved = moveWithCollision(enemy, v.x * speed * dt, v.y * speed * dt, ctx.room.collision);
        // Hitting a wall ends the charge early, which is the "exploit collision"
        // counterplay GDD 14.2 lists for this archetype.
        if ((!moved.movedX && !moved.movedY) || tickState(enemy, dt)) {
          enterState(enemy, AI_STATE.RECOVER, params.recoverSeconds ?? 0.9);
        }
        return;
      }
      case AI_STATE.RECOVER:
        if (tickState(enemy, dt)) enterState(enemy, AI_STATE.IDLE, 0);
        return;
      default: {
        const idle = params.idleSeconds ?? 1.0;
        enemy.idleTimer = (enemy.idleTimer ?? idle) - dt;
        if (enemy.idleTimer <= 0) {
          enemy.idleTimer = idle;
          // A locked straight line, not a homing vector: a charge the player cannot
          // sidestep would be unavoidable damage (GDD 2.10).
          normalizeInto(scratch, ctx.player.x - enemy.x, ctx.player.y - enemy.y);
          enemy.chargeVector = { x: scratch.x, y: scratch.y };
          enterState(enemy, AI_STATE.TELEGRAPH, enemy.def.ai.telegraphSeconds);
          ctx.events?.emit('fx:sfx', { sound: enemy.def.audio?.telegraph ?? 'SFX-TELEGRAPH_CHARGE' });
        }
      }
    }
  },
});

registerController('FleeController', {
  note: 'Coward (ENM-005): keeps distance, and only fights when cornered.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    const flee = params.fleeRange ?? 4.5;
    const d = distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.IDLE, 0);
      }
      return;
    }
    if (d < flee) {
      const moved = stepAway(enemy, ctx.player.x, ctx.player.y, dt, ctx, 1.15);
      // Cornered: nowhere left to run, so it turns and throws. GDD 14.2's answer is
      // "control escape lanes", which only means something if cornering changes it.
      if (!moved) tryAttack(enemy, ctx);
    } else if (d > flee * 1.6) {
      tryAttack(enemy, ctx);
    }
  },
});

registerController('CoverPeekController', {
  note: 'Cover peeker (ENM-011): hides, peeks to fire, relocates when cover breaks.',
  update: (enemy, ctx, dt) => {
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.RECOVER, 0.4);
      }
      return;
    }
    if (enemy.state === AI_STATE.RECOVER && tickState(enemy, dt)) {
      enterState(enemy, AI_STATE.IDLE, 0);
    }
    const inCover = !hasLineOfSight(
      enemy.x, enemy.y, ctx.player.x, ctx.player.y, ctx.room.collision, { blockOnLowCover: true },
    );
    if (inCover) {
      if (enemy.state === AI_STATE.IDLE) tryAttack(enemy, ctx);
    } else {
      // Cover destroyed or flanked: relocate rather than stand in the open, which is
      // exactly the behaviour Appendix D.2 specifies for this enemy.
      stepToward(enemy, enemy.x * 2 - ctx.player.x, enemy.y * 2 - ctx.player.y, dt, ctx, 0.9);
    }
  },
});

registerController('PredictiveSnapController', {
  note: 'Predictive dash (ENM-020): traces velocity, marks a destination, then snaps.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    switch (enemy.state) {
      case AI_STATE.TELEGRAPH:
        // The destination marker is already visible and will NOT move. R-ENM-007.
        if (tickState(enemy, dt)) {
          const t = enemy.lockedTarget;
          if (t) {
            enemy.pathFrom = { x: enemy.x, y: enemy.y };
            enemy.x = t.x;
            enemy.y = t.y;
            resolveOverlap(enemy, ctx.room.collision);
            releaseAttack(enemy, ctx);
          }
          enterState(enemy, AI_STATE.RECOVER, params.recoverSeconds ?? 0.6);
        }
        return;
      case AI_STATE.RECOVER:
        if (tickState(enemy, dt)) enterState(enemy, AI_STATE.IDLE, 0);
        return;
      default: {
        const idle = params.idleSeconds ?? 1.1;
        enemy.idleTimer = (enemy.idleTimer ?? idle) - dt;
        if (enemy.idleTimer <= 0) {
          enemy.idleTimer = idle;
          lockPredictedTarget(enemy, ctx, enemy.def.ai.predictionSeconds ?? 0.4);
          tryAttack(enemy, ctx);
        }
      }
    }
  },
});

registerController('EdgeBlinkController', {
  note: 'Edge teleporter (ENM-017/022): fires from an edge, fades, reappears elsewhere.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    switch (enemy.state) {
      case AI_STATE.TELEGRAPH:
        if (tickState(enemy, dt)) {
          releaseAttack(enemy, ctx);
          enterState(enemy, AI_STATE.RELOCATE, params.fadeSeconds ?? 0.5);
        }
        return;
      case AI_STATE.RELOCATE:
        // Appendix D.2: the teleport target is SHOWN by a status icon, so it is
        // chosen at fade start and published, never decided on arrival.
        if (!enemy.blinkTarget) enemy.blinkTarget = pickEdgePoint(enemy, ctx);
        if (tickState(enemy, dt)) {
          enemy.x = enemy.blinkTarget.x;
          enemy.y = enemy.blinkTarget.y;
          enemy.blinkTarget = null;
          resolveOverlap(enemy, ctx.room.collision);
          enterState(enemy, AI_STATE.IDLE, 0);
        }
        return;
      default: {
        const idle = params.idleSeconds ?? 1.4;
        enemy.idleTimer = (enemy.idleTimer ?? idle) - dt;
        if (enemy.idleTimer <= 0) {
          enemy.idleTimer = idle;
          tryAttack(enemy, ctx);
        }
      }
    }
  },
});

/** A walkable point near the room perimeter, away from the player. */
function pickEdgePoint(enemy, ctx) {
  const rect = ctx.room.rect;
  const inset = 2;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const onVertical = ctx.rng.chance(0.5);
    const x = onVertical
      ? (ctx.rng.chance(0.5) ? rect.x + inset : rect.x + rect.w - inset)
      : ctx.rng.float(rect.x + inset, rect.x + rect.w - inset);
    const y = onVertical
      ? ctx.rng.float(rect.y + inset, rect.y + rect.h - inset)
      : (ctx.rng.chance(0.5) ? rect.y + inset : rect.y + rect.h - inset);
    if (!ctx.room.collision.isWalkable(x, y)) continue;
    // Never reappear on top of the player: that is undodgeable contact damage.
    if (distance(x, y, ctx.player.x, ctx.player.y) < 3) continue;
    return { x, y };
  }
  return { x: enemy.x, y: enemy.y };
}

registerController('WallFollowController', {
  note: 'Wall follower (ENM-013): tracks along walls and furniture edges.',
  update: (enemy, ctx, dt) => {
    // Follows the perimeter, turning when blocked. Predictable by design: GDD 14.2's
    // counterplay for a wall follower is knowing where it will be next.
    const dir = enemy.wallDir ?? (enemy.wallDir = 0);
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [dx, dy] = dirs[dir % 4];
    const speed = speedOf(enemy);
    const moved = moveWithCollision(enemy, dx * speed * dt, dy * speed * dt, ctx.room.collision);
    if (!moved.movedX && !moved.movedY) enemy.wallDir = (dir + 1) % 4;
    enemy.facing = dx !== 0 ? (dx > 0 ? 'EAST' : 'WEST') : (dy > 0 ? 'SOUTH' : 'NORTH');
    // Leaves its electrified trail on a cadence rather than every frame, so the
    // hazard reads as discrete patches the player can thread between.
    const every = enemy.def.movement.params?.trailIntervalSeconds ?? 0.6;
    enemy.idleTimer = (enemy.idleTimer ?? every) - dt;
    if (enemy.idleTimer <= 0) {
      enemy.idleTimer = every;
      tryAttack(enemy, ctx);
    }
    if (enemy.state === AI_STATE.TELEGRAPH && tickState(enemy, dt)) {
      releaseAttack(enemy, ctx);
      enterState(enemy, AI_STATE.IDLE, 0);
    }
  },
});

registerController('PatrolController', {
  note: 'Patrols the room, applying its effect as it passes (ENM-023).',
  update: (enemy, ctx, dt) => {
    if (!enemy.patrolTarget
      || distance(enemy.x, enemy.y, enemy.patrolTarget.x, enemy.patrolTarget.y) < 0.6) {
      enemy.patrolTarget = pickEdgePoint(enemy, ctx);
    }
    stepToward(enemy, enemy.patrolTarget.x, enemy.patrolTarget.y, dt, ctx, 0.7);
    const idle = enemy.def.movement.params?.effectIntervalSeconds ?? 3.5;
    enemy.idleTimer = (enemy.idleTimer ?? idle) - dt;
    if (enemy.idleTimer <= 0) {
      enemy.idleTimer = idle;
      tryAttack(enemy, ctx);
    }
    if (enemy.state === AI_STATE.TELEGRAPH && tickState(enemy, dt)) {
      releaseAttack(enemy, ctx);
      enterState(enemy, AI_STATE.IDLE, 0);
    }
  },
});

registerController('OrbitFormationController', {
  note: 'Linked formation (ENM-009): orbits a shared centre, then breaks toward you.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    const radius = params.orbitRadius ?? 2.2;
    if (!enemy.orbitCentre) enemy.orbitCentre = { x: enemy.x, y: enemy.y };
    if (enemy.state === AI_STATE.DASH) {
      stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx, 1.3);
      if (tickState(enemy, dt)) enterState(enemy, AI_STATE.IDLE, 0);
      return;
    }
    enemy.orbitAngle = (enemy.orbitAngle ?? 0) + (params.angularSpeed ?? 1.4) * dt;
    stepToward(
      enemy,
      enemy.orbitCentre.x + Math.cos(enemy.orbitAngle) * radius,
      enemy.orbitCentre.y + Math.sin(enemy.orbitAngle) * radius,
      dt, ctx, 1.4,
    );
    const breakEvery = params.breakEverySeconds ?? 3.2;
    enemy.idleTimer = (enemy.idleTimer ?? breakEvery) - dt;
    if (enemy.idleTimer <= 0) {
      enemy.idleTimer = breakEvery;
      enterState(enemy, AI_STATE.DASH, params.breakSeconds ?? 0.8);
    }
  },
});

registerController('AllyAnchorController', {
  note: 'Support buffer (ENM-007): stays behind allies, turns aggressive when alone.',
  update: (enemy, ctx, dt) => {
    const allies = ctx.hostiles.filter((h) => h !== enemy && !h.dead);
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.IDLE, 0);
      }
      return;
    }
    if (allies.length === 0) {
      // Appendix D.2: "Weak alone." Turning aggressive stops a lone support from
      // stalling a room the player has otherwise cleared.
      stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx, 0.9);
      tryAttack(enemy, ctx);
      return;
    }
    let best = allies[0];
    let bestD = Infinity;
    for (const ally of allies) {
      const d = distance(enemy.x, enemy.y, ally.x, ally.y);
      if (d < bestD) { bestD = d; best = ally; }
    }
    // Tuck in behind the ally, relative to the player.
    normalizeInto(scratch, best.x - ctx.player.x, best.y - ctx.player.y);
    stepToward(enemy, best.x + scratch.x * 1.4, best.y + scratch.y * 1.4, dt, ctx, 0.85);
    const idle = enemy.def.movement.params?.buffIntervalSeconds ?? 2.5;
    enemy.idleTimer = (enemy.idleTimer ?? idle) - dt;
    if (enemy.idleTimer <= 0) {
      enemy.idleTimer = idle;
      tryAttack(enemy, ctx);
    }
  },
});

registerController('ChannelSupportController', {
  note: 'Healer (ENM-019): channels a visible beam, and breaks it when threatened.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    const threatRange = params.breakChannelRange ?? 3;
    const damaged = ctx.hostiles.find((h) => h !== enemy && !h.dead && h.health < h.maxHealth);

    if (enemy.state === AI_STATE.CHANNEL) {
      // Appendix D.2: "Breaks channel when threatened." That is the counterplay —
      // pressure the healer rather than trying to out-damage its output.
      if (distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y) < threatRange || !damaged) {
        enemy.channelTarget = null;
        enterState(enemy, AI_STATE.IDLE, 0);
        return;
      }
      enemy.channelTarget = damaged;
      // R-ENM-003: healing is capped to the ally's own maximum, so no pair of
      // support enemies can produce an unkillable loop.
      damaged.health = Math.min(damaged.maxHealth, damaged.health + (params.healPerSecond ?? 6) * dt);
      return;
    }
    if (!damaged) {
      stepAway(enemy, ctx.player.x, ctx.player.y, dt, ctx, 0.7);
      return;
    }
    if (distance(enemy.x, enemy.y, damaged.x, damaged.y) > (params.channelRange ?? 5)) {
      stepToward(enemy, damaged.x, damaged.y, dt, ctx, 0.9);
      return;
    }
    enterState(enemy, AI_STATE.CHANNEL, 0);
  },
});

registerController('InterposeController', {
  note: 'Projectile blocker (ENM-024): puts itself between the player and its allies.',
  update: (enemy, ctx, dt) => {
    const shooters = ctx.hostiles.filter(
      (h) => h !== enemy && !h.dead && h.def?.tags?.includes('SHOOTER'),
    );
    if (shooters.length === 0) {
      stepToward(enemy, ctx.player.x, ctx.player.y, dt, ctx, 0.6);
      return;
    }
    const ally = shooters[0];
    stepToward(enemy, (ctx.player.x + ally.x) / 2, (ctx.player.y + ally.y) / 2, dt, ctx, 1.0);
  },
});

registerController('ObserveAndEchoController', {
  note: 'Reactive copier (ENM-012): watches, then repeats the last pattern it saw.',
  update: (enemy, ctx, dt) => {
    const params = enemy.def.movement.params || {};
    if (enemy.state === AI_STATE.TELEGRAPH) {
      if (tickState(enemy, dt)) {
        releaseAttack(enemy, ctx);
        enterState(enemy, AI_STATE.IDLE, 0);
      }
      return;
    }
    // Keeps its distance while observing, so it reads as a mimic, not a threat.
    if (distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y) < (params.preferredRange ?? 6)) {
      stepAway(enemy, ctx.player.x, ctx.player.y, dt, ctx, 0.7);
    }
    // An unfed Reply Guy is harmless, which is exactly the joke.
    if (ctx.lastEnemyPattern) tryAttack(enemy, ctx);
  },
});

// ---------------------------------------------------------------------------
// Attack modules
// ---------------------------------------------------------------------------

registerAttackModule('AimedProjectileAttack', {
  note: 'One shot toward the player, aimed at telegraph release.',
  fire: (enemy, ctx, params, attack) => {
    normalizeInto(scratch, ctx.player.x - enemy.x, ctx.player.y - enemy.y);
    ctx.spawnEnemyProjectile(enemy, {
      dx: scratch.x, dy: scratch.y,
      speed: params.speed ?? 6,
      damage: attack.damage,
      damageTags: attack.damageTags,
      spriteId: params.spriteId ?? 'prj_paper_disc',
      lifetime: params.lifetime ?? 2.2,
    });
    ctx.noteEnemyPattern('AIMED', { speed: params.speed ?? 6 });
  },
});

registerAttackModule('CardinalBurstAttack', {
  note: 'ENM-002: three straight shots down one lane, with a clear pause between.',
  fire: (enemy, ctx, params, attack) => {
    const dirs = params.diagonal
      ? [[0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Choose the lane that best faces the player: aimed enough to matter, still
    // lane-shaped enough to sidestep.
    normalizeInto(scratch, ctx.player.x - enemy.x, ctx.player.y - enemy.y);
    let best = dirs[0];
    let bestDot = -Infinity;
    for (const d of dirs) {
      const dot = d[0] * scratch.x + d[1] * scratch.y;
      if (dot > bestDot) { bestDot = dot; best = d; }
    }
    const count = params.count ?? 3;
    for (let i = 0; i < count; i += 1) {
      ctx.spawnEnemyProjectile(enemy, {
        dx: best[0], dy: best[1],
        speed: params.speed ?? 6.5,
        damage: attack.damage,
        damageTags: attack.damageTags,
        spriteId: params.spriteId ?? 'prj_paper_disc',
        lifetime: params.lifetime ?? 2.4,
        // Spaced by delay rather than position, so the lane stays a single lane.
        delay: i * (params.gapSeconds ?? 0.16),
      });
    }
    ctx.noteEnemyPattern('CARDINAL_BURST', { count });
  },
});

registerAttackModule('SpreadProjectileAttack', {
  note: 'A fan of shots, symmetric around the aim line.',
  fire: (enemy, ctx, params, attack) => {
    const count = params.count ?? 3;
    const spread = params.spreadRadians ?? 0.6;
    normalizeInto(scratch, ctx.player.x - enemy.x, ctx.player.y - enemy.y);
    const base = Math.atan2(scratch.y, scratch.x);
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
      const a = base + t * spread;
      ctx.spawnEnemyProjectile(enemy, {
        dx: Math.cos(a), dy: Math.sin(a),
        speed: params.speed ?? 5.5,
        damage: attack.damage,
        damageTags: attack.damageTags,
        spriteId: params.spriteId ?? 'prj_paper_disc',
        lifetime: params.lifetime ?? 2.2,
      });
    }
    ctx.noteEnemyPattern('SPREAD', { count, spreadRadians: spread });
  },
});

registerAttackModule('RadialProjectileAttack', {
  note: 'A ring of shots, capped so the gaps stay wide enough to walk through.',
  fire: (enemy, ctx, params, attack) => {
    // GDD 2.10: unavoidable damage is a bug, and a dense ring around a stationary
    // enemy is exactly that. The cap keeps a walkable gap at every radius.
    const count = Math.min(params.count ?? 8, 12);
    const offset = params.offset ?? 0;
    for (let i = 0; i < count; i += 1) {
      const a = offset + (i / count) * Math.PI * 2;
      ctx.spawnEnemyProjectile(enemy, {
        dx: Math.cos(a), dy: Math.sin(a),
        speed: params.speed ?? 4.5,
        damage: attack.damage,
        damageTags: attack.damageTags,
        spriteId: params.spriteId ?? 'prj_paper_disc',
        lifetime: params.lifetime ?? 2.6,
      });
    }
    ctx.noteEnemyPattern('RADIAL', { count });
  },
});

registerAttackModule('StatusProjectileAttack', {
  note: 'ENM-008: a slow folder that applies a briefly-shown debuff on hit.',
  fire: (enemy, ctx, params, attack) => {
    normalizeInto(scratch, ctx.player.x - enemy.x, ctx.player.y - enemy.y);
    ctx.spawnEnemyProjectile(enemy, {
      dx: scratch.x, dy: scratch.y,
      speed: params.speed ?? 3.6,
      damage: attack.damage,
      damageTags: attack.damageTags,
      spriteId: params.spriteId ?? 'prj_label',
      lifetime: params.lifetime ?? 3.2,
      status: {
        status: params.status ?? STATUS.SLOW,
        chance: params.chance ?? 1,
        // GDD 5.5 insists player-side debuffs are brief and clearly shown.
        seconds: Math.min(params.seconds ?? 2.5, 4),
        magnitude: params.magnitude ?? 0.3,
      },
    });
    ctx.noteEnemyPattern('STATUS_SHOT', {});
  },
});

registerAttackModule('RadialPulseAttack', {
  note: 'A short expanding pulse around the caster; space is the dodge, not timing.',
  fire: (enemy, ctx, params, attack) => {
    ctx.spawnPulse(enemy, {
      radius: params.radius ?? 2.4,
      damage: attack.damage,
      damageTags: attack.damageTags,
      seconds: params.seconds ?? 0.3,
    });
    ctx.noteEnemyPattern('PULSE', {});
  },
});

registerAttackModule('DelayedDeathBurstAttack', {
  note: 'ENM-021: a burst that fires after a readable delay, not on contact.',
  fire: (enemy, ctx, params, attack) => {
    // The delay is the fairness: dying next to a Blue Screen has to be survivable
    // if the player reacts, which an instant burst would not be.
    ctx.scheduleDelayed(params.delaySeconds ?? 0.8, () => {
      ctx.spawnPulse(enemy, {
        radius: params.radius ?? 2.8,
        damage: attack.damage,
        damageTags: attack.damageTags,
        seconds: 0.3,
      });
    });
  },
});

registerAttackModule('TrailHazardAttack', {
  note: 'Leaves a hazard patch under the enemy (ENM-013 electrified trail).',
  fire: (enemy, ctx, params) => {
    ctx.spawnHazardAt(enemy.x, enemy.y, params.hazard ?? 'HAZ-ELEC_FLOOR_ARC', {
      seconds: params.seconds ?? 2.0,
      w: params.w ?? 1.4,
      h: params.h ?? 1.4,
    });
  },
});

registerAttackModule('PathDamageAttack', {
  note: 'ENM-020: damages along the path just travelled, after the snap resolves.',
  fire: (enemy, ctx, params, attack) => {
    const from = enemy.pathFrom || { x: enemy.x, y: enemy.y };
    ctx.damageAlongPath(from, { x: enemy.x, y: enemy.y }, {
      width: params.width ?? 0.8,
      damage: attack.damage,
      damageTags: attack.damageTags,
    });
  },
});

registerAttackModule('PlaceObstacleAttack', {
  note: 'Drops a temporary barrier that narrows the room (ENM-029 family).',
  fire: (enemy, ctx, params) => {
    ctx.spawnTempObstacle(enemy.x, enemy.y, {
      w: params.w ?? 2,
      h: params.h ?? 1,
      seconds: params.seconds ?? 8,
      health: params.health ?? 12,
    });
  },
});

registerAttackModule('EchoLastPatternAttack', {
  note: 'ENM-012: replays the last simple pattern another enemy fired.',
  fire: (enemy, ctx, params, attack) => {
    const last = ctx.lastEnemyPattern;
    if (!last) return;
    // Only simple patterns are copyable, never a boss-unique one. Appendix D.2 is
    // explicit about that exclusion, and it is what keeps this enemy fair.
    const module = attackModules.get(ECHOABLE[last.kind]);
    if (!module) return;
    module.fire(enemy, ctx, { ...last.params, spriteId: 'prj_label' }, attack);
  },
});

/** Which observed patterns a Reply Guy may reproduce, and with which module. */
const ECHOABLE = Object.freeze({
  AIMED: 'AimedProjectileAttack',
  CARDINAL_BURST: 'CardinalBurstAttack',
  SPREAD: 'SpreadProjectileAttack',
  RADIAL: 'RadialProjectileAttack',
});

export {
  speedOf, stepToward, stepAway, tryAttack, releaseAttack, enterState, tickState,
  lockPredictedTarget, pickEdgePoint,
};
