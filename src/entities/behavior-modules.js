/**
 * Variant behaviour modules.
 *
 * GDD refs: R-ENM-005 (a variant changes behaviour, pattern, death effect, or
 *           support relationship — never only health), 20.3 (behaviour composed from
 *           curated data modules; arbitrary runtime AI generation is prohibited),
 *           14.3 (readability contract), 18.3 (elites keep the base silhouette),
 *           R-ENM-003 (no permanent invulnerability or infinite-heal loops),
 *           R-CMB-001 (door locks are deterministic and tied to encounter state),
 *           6.1 (a room clear stops hostile spawning).
 *
 * These are the *deltas* that make a variant a variant. Each one is small on purpose:
 * R-ENM-005 asks for one real behavioural change, not a redesign, and a module that
 * did too much would make the elite unrecognisable — which GDD 18.3 forbids from the
 * other direction.
 *
 * Lifecycle hooks, all optional:
 *   onSpawn(enemy, params, ctx)          once, after placement
 *   onUpdate(enemy, params, ctx, dt)     every simulation step
 *   onDeath(enemy, params, ctx)          after death resolves, before removal
 *   onDamaged(enemy, params, ctx, dmg)   may return a modified damage number
 *   onHitPlayer(enemy, params, ctx, hit) after this enemy damages the player
 *   onProjectileImpact(enemy, params, ctx, projectile)
 */

import { registerBehaviorModule, AI_STATE, enterState, stepToward } from './enemy-controllers.js';
import { STATUS } from '../core/constants.js';
import { distance, normalizeInto } from '../core/math.js';

const scratch = { x: 0, y: 0 };

// ---------------------------------------------------------------------------
// Defence and durability
// ---------------------------------------------------------------------------

registerBehaviorModule('KnockbackImmune', {
  note: 'Ignores displacement, so it cannot be kited into a corner.',
  onSpawn: (enemy) => { enemy.knockbackImmune = true; },
});

registerBehaviorModule('ArmorPlate', {
  note: 'Ignores the first hit of each attack event, so multiplicity beats it.',
  onSpawn: (enemy, params) => {
    enemy.armorIgnorePerEvent = params.ignoreHitsPerEvent ?? 1;
  },
  onDamaged: (enemy, params, ctx, dmg) => {
    // Per *event*, not per projectile: a single big hit is absorbed, a wide pattern
    // gets through. That asymmetry is the counterplay the variant advertises.
    if (enemy.armorConsumedThisEvent === undefined) enemy.armorConsumedThisEvent = 0;
    if (enemy.armorConsumedThisEvent < enemy.armorIgnorePerEvent) {
      enemy.armorConsumedThisEvent += 1;
      return 0;
    }
    return dmg;
  },
});

registerBehaviorModule('ShieldedWhileObjectAlive', {
  note: 'Invulnerable until a named environmental object is destroyed.',
  onUpdate: (enemy, params, ctx) => {
    const alive = (ctx.room?.objects || []).some(
      (o) => o.defId === params.object && !o.destroyed,
    );
    // R-ENM-003 forbids permanent invulnerability. This is bounded because the
    // object is always destructible and always in the room, so the shield has an
    // answer the player can reach.
    enemy.shielded = alive;
  },
});

registerBehaviorModule('MobileShield', {
  note: 'Walks its shield around instead of anchoring, changing who is protected.',
  onUpdate: (enemy, params, ctx, dt) => {
    const ward = ctx.hostiles.find((h) => h !== enemy && !h.dead && h.health < h.maxHealth)
      || ctx.hostiles.find((h) => h !== enemy && !h.dead);
    if (ward) stepToward(enemy, ward.x, ward.y, dt, ctx, 0.8);
  },
});

registerBehaviorModule('RotatingShieldArc', {
  note: 'Rotates a shield arc, so there is always an exposed angle to find.',
  onUpdate: (enemy, params, ctx, dt) => {
    enemy.shieldAngle = ((enemy.shieldAngle ?? 0) + ((params.degreesPerSecond ?? 40) * Math.PI / 180) * dt)
      % (Math.PI * 2);
    enemy.shieldArc = params.arcRadians ?? 2.1;
  },
  onDamaged: (enemy, params, ctx, dmg) => {
    if (enemy.shieldArc === undefined) return dmg;
    // Blocked only from inside the arc: attacking from behind always works, which is
    // what makes this readable rather than a damage sponge.
    const incoming = Math.atan2((ctx.player?.y ?? 0) - enemy.y, (ctx.player?.x ?? 0) - enemy.x);
    let delta = Math.abs(incoming - (enemy.shieldAngle ?? 0)) % (Math.PI * 2);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    return delta < enemy.shieldArc / 2 ? 0 : dmg;
  },
});

registerBehaviorModule('ReflectOnOverload', {
  note: 'Returns one absorbed shot after overloading, punishing raw damage dumps.',
  onSpawn: (enemy, params) => {
    enemy.absorbCapacity = params.capacity ?? 4;
    enemy.absorbed = 0;
    enemy.reflectShots = params.shots ?? 1;
  },
  onProjectileImpact: (enemy, params, ctx) => {
    enemy.absorbed = (enemy.absorbed ?? 0) + 1;
    if (enemy.absorbed < enemy.absorbCapacity) return;
    enemy.absorbed = 0;
    normalizeInto(scratch, ctx.player.x - enemy.x, ctx.player.y - enemy.y);
    for (let i = 0; i < enemy.reflectShots; i += 1) {
      ctx.spawnEnemyProjectile(enemy, {
        dx: scratch.x, dy: scratch.y,
        speed: 7, damage: 1, damageTags: ['PROJECTILE'],
        spriteId: 'prj_paper_disc', lifetime: 2,
      });
    }
  },
});

registerBehaviorModule('CloakUntilNear', {
  note: 'Invisible until the player is close, then reveals with a full telegraph.',
  onSpawn: (enemy) => { enemy.cloaked = true; enemy.cloakSeconds = 0; },
  onUpdate: (enemy, params, ctx, dt) => {
    if (!enemy.cloaked) return;
    // A cloak is an ambush, not a hiding place.
    //
    // The room stays sealed while any required enemy lives, and a cloaked enemy is not
    // drawn — so an ambusher the player never happens to walk near left them locked in a
    // room that looked completely empty. R-CMB-006 forbids that, so the cloak times out
    // and the enemy reveals itself on its own.
    enemy.cloakSeconds = (enemy.cloakSeconds ?? 0) + (dt ?? 0);
    const patience = params.maxCloakSeconds ?? 6;
    if (enemy.cloakSeconds >= patience) {
      enemy.cloaked = false;
      enterState(enemy, AI_STATE.TELEGRAPH, params.telegraphSeconds ?? 0.4);
      ctx.events?.emit('fx:sfx', { sound: 'SFX-TELEGRAPH_GENERIC' });
      return;
    }
    if (distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y) <= (params.revealRadius ?? 3)) {
      enemy.cloaked = false;
      // GDD 14.3: the reveal is a warning, not the damage. The enemy is forced into
      // a telegraph state so its first action is still announced.
      enterState(enemy, AI_STATE.TELEGRAPH, params.telegraphSeconds ?? 0.4);
      ctx.events?.emit('fx:sfx', { sound: 'SFX-TELEGRAPH_GENERIC' });
    }
  },
});

// ---------------------------------------------------------------------------
// Movement deltas
// ---------------------------------------------------------------------------

registerBehaviorModule('AccelerateWhileVisible', {
  note: 'Speeds up while it has line of sight, so ignoring it is punished.',
  onUpdate: (enemy, params, ctx, dt) => {
    const max = params.maxSpeedMul ?? 1.9;
    const ramp = params.rampSeconds ?? 3;
    enemy.visibleFor = (enemy.visibleFor ?? 0) + dt;
    const t = Math.min(1, enemy.visibleFor / ramp);
    enemy.baseSpeed = enemy.baseSpeedOriginal * (1 + (max - 1) * t);
  },
  onSpawn: (enemy) => { enemy.baseSpeedOriginal = enemy.baseSpeed; },
});

registerBehaviorModule('AccelerateOverTime', {
  note: 'Escalates the longer the room stays uncleared; it sets the pace of the fight.',
  onSpawn: (enemy) => { enemy.baseSpeedOriginal = enemy.baseSpeed; },
  onUpdate: (enemy, params, ctx, dt) => {
    enemy.aliveFor = (enemy.aliveFor ?? 0) + dt;
    const mul = Math.min(params.maxMul ?? 2, 1 + (params.perSecond ?? 0.06) * enemy.aliveFor);
    enemy.baseSpeed = enemy.baseSpeedOriginal * mul;
  },
});

registerBehaviorModule('ChainDash', {
  note: 'Chains an extra dash off the first, so the dodge must be committed twice.',
  onSpawn: (enemy, params) => { enemy.extraDashes = params.extraDashes ?? 1; },
  onUpdate: (enemy, params, ctx) => {
    // Re-arm one more dash when the first recovery begins, rather than extending the
    // dash itself: the second dash gets its own visible commit.
    if (enemy.state === AI_STATE.RECOVER && (enemy.dashesUsed ?? 0) < enemy.extraDashes) {
      enemy.dashesUsed = (enemy.dashesUsed ?? 0) + 1;
      enemy.idleTimer = params.recoverySeconds ?? 0.35;
    } else if (enemy.state === AI_STATE.IDLE) {
      enemy.dashesUsed = 0;
    }
  },
});

registerBehaviorModule('ChargeBounce', {
  note: 'Ricochets off the far wall instead of stopping, so the space behind is unsafe.',
  onSpawn: (enemy, params) => { enemy.chargeBouncesLeft = params.bounces ?? 1; },
  onUpdate: (enemy) => {
    if (enemy.state === AI_STATE.RECOVER && enemy.chargeBouncesLeft > 0 && enemy.chargeVector) {
      enemy.chargeBouncesLeft -= 1;
      enemy.chargeVector = { x: -enemy.chargeVector.x, y: -enemy.chargeVector.y };
      enterState(enemy, AI_STATE.DASH, 0.8);
    }
    if (enemy.state === AI_STATE.IDLE) enemy.chargeBouncesLeft = 1;
  },
});

registerBehaviorModule('BreaksLowCover', {
  note: 'Smashes through low cover rather than stopping, rewriting the room mid-fight.',
  onUpdate: (enemy, params, ctx) => {
    if (enemy.state !== AI_STATE.DASH) return;
    for (const obj of ctx.room?.objects || []) {
      if (obj.destroyed || obj.h >= 1.5) continue;
      if (distance(obj.x, obj.y, enemy.x, enemy.y) > enemy.radius + 0.8) continue;
      ctx.destroyObject(obj, 'CHARGE');
    }
  },
});

registerBehaviorModule('DoubleSnap', {
  note: 'Two snap-dashes per commit, each separately telegraphed.',
  onSpawn: (enemy, params) => { enemy.snapsRemaining = 1; enemy.snapGap = params.gapSeconds ?? 0.5; },
  onUpdate: (enemy) => {
    if (enemy.state === AI_STATE.RECOVER && enemy.snapsRemaining > 0) {
      enemy.snapsRemaining -= 1;
      // R-ENM-007 still applies to the second snap: it gets its own telegraph and its
      // own lock, so it is dodgeable on its own terms.
      enemy.idleTimer = enemy.snapGap;
    } else if (enemy.state === AI_STATE.IDLE) {
      enemy.snapsRemaining = 1;
    }
  },
});

registerBehaviorModule('ShotsBeforeTeleport', {
  note: 'Fires more than once before fading, widening the punish window.',
  onSpawn: (enemy, params) => { enemy.shotsPerAppearance = params.shots ?? 2; },
  onUpdate: (enemy) => {
    if (enemy.state === AI_STATE.RELOCATE && (enemy.shotsFired ?? 0) < enemy.shotsPerAppearance) {
      enemy.shotsFired = (enemy.shotsFired ?? 0) + 1;
      enterState(enemy, AI_STATE.IDLE, 0);
      enemy.idleTimer = 0.25;
    } else if (enemy.state === AI_STATE.IDLE && enemy.stateTimer === 0) {
      enemy.shotsFired = enemy.shotsFired ?? 0;
    }
  },
});

registerBehaviorModule('SplitAtCorner', {
  note: 'Splits into two shorter bodies at a wall corner; one trail becomes two.',
  onUpdate: (enemy, params, ctx) => {
    if (enemy.splitDone) return;
    if (enemy.wallDir === undefined || enemy.lastWallDir === enemy.wallDir) {
      enemy.lastWallDir = enemy.wallDir;
      return;
    }
    enemy.lastWallDir = enemy.wallDir;
    enemy.cornersTurned = (enemy.cornersTurned ?? 0) + 1;
    if (enemy.cornersTurned < (params.afterCorners ?? 2)) return;
    enemy.splitDone = true;
    for (let i = 0; i < (params.children ?? 2); i += 1) {
      ctx.spawnEnemy(enemy.defId, {
        x: enemy.x + (i === 0 ? 0.6 : -0.6),
        y: enemy.y,
        healthMul: 0.5,
        inheritStatus: false,
      });
    }
    ctx.killEnemy(enemy, 'SPLIT');
  },
});

// ---------------------------------------------------------------------------
// Attack-pattern deltas
// ---------------------------------------------------------------------------

registerBehaviorModule('RotatePatternOffset', {
  note: 'Rotates the firing pattern, so the base version-s safe lanes become unsafe.',
  onSpawn: (enemy, params) => { enemy.patternOffset = params.radians ?? Math.PI / 4; },
});

registerBehaviorModule('RotatingFourWay', {
  note: 'Continuous rotating four-way fire: a positioning problem, not a timing one.',
  onUpdate: (enemy, params, ctx, dt) => {
    enemy.patternOffset = ((enemy.patternOffset ?? 0)
      + ((params.degreesPerSecond ?? 55) * Math.PI / 180) * dt) % (Math.PI * 2);
  },
});

registerBehaviorModule('EightWayTurret', {
  note: 'Fires on eight lanes instead of four; the diagonals stop being safe.',
  onSpawn: (enemy) => { enemy.radialCountOverride = 8; },
});

registerBehaviorModule('SpreadShot', {
  note: 'Replaces a single shot with a fan, so sidestepping in the open is not enough.',
  onSpawn: (enemy, params) => {
    enemy.attackOverride = {
      module: 'SpreadProjectileAttack',
      params: { count: params.count ?? 3, spreadRadians: params.spreadRadians ?? 0.5 },
    };
  },
});

registerBehaviorModule('BeamAttack', {
  note: 'Swaps a spread for a straight beam: a lane dodge instead of a gap dodge.',
  onSpawn: (enemy, params) => {
    enemy.attackOverride = {
      module: 'CardinalBurstAttack',
      params: { count: 1, speed: 14, lifetime: params.seconds ?? 0.9 },
      telegraphSeconds: params.telegraphSeconds ?? 0.7,
    };
  },
});

registerBehaviorModule('BurstPerPeek', {
  note: 'Fires twice per peek, halving the punish window after its shot.',
  onSpawn: (enemy, params) => {
    enemy.attackOverride = {
      module: 'CardinalBurstAttack',
      params: { count: params.shots ?? 2, gapSeconds: params.gapSeconds ?? 0.22 },
    };
  },
});

registerBehaviorModule('SplitProjectileOnImpact', {
  note: 'Its shots split on impact, so cover stops being a complete answer.',
  onSpawn: (enemy, params) => {
    enemy.projectileSplit = { count: params.count ?? 2, damageScale: params.damageScale ?? 0.6 };
  },
});

registerBehaviorModule('StatusOnHit', {
  note: 'Adds a status payload to its shots, punishing a hit twice over.',
  onSpawn: (enemy, params) => {
    enemy.projectileStatus = {
      status: params.status ?? STATUS.SLOW,
      chance: params.chance ?? 0.5,
      seconds: Math.min(params.seconds ?? 2, 4),
      magnitude: params.magnitude ?? 0.3,
    };
  },
});

registerBehaviorModule('CopyLastPattern', {
  note: 'Copies boss adds too, but never a boss-unique attack (Appendix D.2).',
  onSpawn: (enemy, params) => {
    enemy.copyIncludesBossAdds = Boolean(params.includeBossAdds);
    // The exclusion is the balance: without it, an elite Reply Guy could reproduce a
    // signature boss pattern in an ordinary room.
    enemy.copyExcludesBossUnique = params.excludeBossUnique !== false;
  },
});

registerBehaviorModule('DamagingDecoy', {
  note: 'Its decoy deals real damage, moving the tell from "which" to "both".',
  onSpawn: (enemy, params) => { enemy.decoyDamage = params.decoyDamage ?? 1; },
});

registerBehaviorModule('DecoyCover', {
  note: 'Sets up behind fake cover that breaks in one hit; teaches testing cover.',
  onSpawn: (enemy, params, ctx) => {
    ctx.spawnTempObstacle(enemy.x, enemy.y + 0.9, {
      w: 2, h: 0.5, seconds: 999, health: params.fakeCoverHealth ?? 1, fake: true,
    });
  },
});

// ---------------------------------------------------------------------------
// Support deltas
// ---------------------------------------------------------------------------

registerBehaviorModule('BuffAllies', {
  note: 'Buffs several attributes at once, making it a clearer priority target.',
  onUpdate: (enemy, params, ctx, dt) => {
    enemy.buffTimer = (enemy.buffTimer ?? 0) - dt;
    if (enemy.buffTimer > 0) return;
    enemy.buffTimer = params.intervalSeconds ?? 2.5;
    for (const ally of ctx.hostiles) {
      if (ally === enemy || ally.dead) continue;
      ctx.applyEnemyBuff(ally, params.attributes ?? ['SPEED'], params.magnitude ?? 0.2, 3);
    }
  },
});

registerBehaviorModule('AuraBuff', {
  note: 'Buffs only allies inside a visible radius, so breaking formation disarms it.',
  onUpdate: (enemy, params, ctx, dt) => {
    enemy.auraRadius = params.radius ?? 3.2;
    enemy.buffTimer = (enemy.buffTimer ?? 0) - dt;
    if (enemy.buffTimer > 0) return;
    enemy.buffTimer = 1.0;
    for (const ally of ctx.hostiles) {
      if (ally === enemy || ally.dead) continue;
      if (distance(ally.x, ally.y, enemy.x, enemy.y) > enemy.auraRadius) continue;
      ctx.applyEnemyBuff(ally, ['SPEED', 'CADENCE'], params.magnitude ?? 0.28, 1.4);
    }
  },
});

registerBehaviorModule('RepairBeam', {
  note: 'Repairs allies, and shields too where the variant says so.',
  onUpdate: (enemy, params, ctx, dt) => {
    const targets = ctx.hostiles
      .filter((h) => h !== enemy && !h.dead && h.health < h.maxHealth)
      .slice(0, params.targets ?? 1);
    for (const t of targets) {
      // R-ENM-003 / Appendix D.2: bosses are capped out entirely by bossHealCap 0, so
      // a healer can never make a boss fight unwinnable.
      if (t.isBoss && (params.bossHealCap ?? 0) <= 0) continue;
      t.health = Math.min(t.maxHealth, t.health + (params.healPerSecond ?? 5) * dt);
      if (params.repairsShields) t.shielded = true;
    }
  },
});

registerBehaviorModule('SealOneDoor', {
  note: 'Seals one door until defeated, turning a room the player could leave into one they must finish.',
  onSpawn: (enemy, params, ctx) => {
    // R-CMB-001: the seal is tied to encounter state and released on death, so no
    // door can outlive a valid clear.
    enemy.sealedDoorId = ctx.sealOneDoor?.(enemy) ?? null;
  },
  onDeath: (enemy, params, ctx) => {
    if (enemy.sealedDoorId) ctx.releaseDoor?.(enemy.sealedDoorId);
  },
});

registerBehaviorModule('OrbitFormation', {
  note: 'Reshapes the orbit: more bodies, wider radius, or a live centre.',
  onSpawn: (enemy, params, ctx) => {
    enemy.orbitMembers = params.members ?? 4;
    if (!params.centreEnemy) return;
    // A live centre gives the formation something worth killing.
    ctx.spawnEnemy(params.centreEnemy, { x: enemy.x, y: enemy.y, isFormationCentre: true });
  },
});

registerBehaviorModule('SwarmSpawn', {
  note: 'Arrives as several small weak bodies instead of one, trading burst for denial.',
  onSpawn: (enemy, params, ctx) => {
    if (enemy.isSwarmChild) return;
    for (let i = 1; i < (params.count ?? 4); i += 1) {
      ctx.spawnEnemy(enemy.defId, {
        x: enemy.x + Math.cos(i) * 1.2,
        y: enemy.y + Math.sin(i) * 1.2,
        isSwarmChild: true,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Death effects
// ---------------------------------------------------------------------------

registerBehaviorModule('DeathExplosion', {
  note: 'Explodes on death after a readable warning, so proximity is a decision.',
  onDeath: (enemy, params, ctx) => {
    // The telegraph on a death effect is what separates "interesting" from "unfair":
    // GDD 2.10 wants the player to be able to see it coming and step away.
    ctx.scheduleDelayed(params.telegraphSeconds ?? 0.45, () => {
      ctx.spawnPulse(enemy, {
        radius: params.radius ?? 2.2,
        damage: params.damage ?? 1,
        damageTags: ['EXPLOSION'],
        seconds: 0.3,
      });
    });
    ctx.events?.emit('fx:sfx', { sound: 'SFX-TELEGRAPH_SLAM' });
  },
});

registerBehaviorModule('DeathHazard', {
  note: 'Leaves a hazard where it died, so killing it up close costs something.',
  onDeath: (enemy, params, ctx) => {
    ctx.spawnHazardAt(enemy.x, enemy.y, params.hazard ?? 'HAZ-SPILL_COFFEE_SCALD', {
      seconds: params.seconds ?? 5,
      w: (params.radius ?? 1.6) * 2,
      h: (params.radius ?? 1.6) * 2,
    });
  },
});

registerBehaviorModule('SplitOnDeath', {
  note: 'Splits into smaller bodies on death; the children may inherit armour.',
  onDeath: (enemy, params, ctx) => {
    // GDD 6.1: a room clear stops hostile spawning, so a split that lands after the
    // last enemy dies must not resurrect the encounter.
    if (ctx.room?.state.cleared) return;
    for (let i = 0; i < (params.count ?? 2); i += 1) {
      ctx.spawnEnemy(params.childEnemy ?? enemy.defId, {
        x: enemy.x + Math.cos((i / (params.count ?? 2)) * Math.PI * 2) * 0.8,
        y: enemy.y + Math.sin((i / (params.count ?? 2)) * Math.PI * 2) * 0.8,
        healthMul: params.healthMul ?? 0.4,
        inheritArmor: Boolean(params.inheritArmor),
        isSplitChild: true,
      });
    }
  },
});

registerBehaviorModule('SpawnOnDeath', {
  note: 'Spawns a different enemy on death, so where it dies matters.',
  onDeath: (enemy, params, ctx) => {
    if (ctx.room?.state.cleared) return;
    for (let i = 0; i < (params.count ?? 1); i += 1) {
      ctx.spawnEnemy(params.enemy, {
        x: enemy.x + (i - 0.5) * 1.2,
        y: enemy.y,
      });
    }
  },
});

registerBehaviorModule('LeaveFamiliarOnDeath', {
  note: 'Leaves a briefly-firing familiar, so the kill is not the end of the threat.',
  onDeath: (enemy, params, ctx) => {
    if (ctx.room?.state.cleared) return;
    // Bounded lifetime, and it does not count toward the clear condition: GDD 6.1
    // says a clear waits for required enemies, not for decorative leftovers.
    ctx.spawnTemporaryTurret?.(enemy.x, enemy.y, {
      seconds: params.seconds ?? 4,
      damage: 1,
      intervalSeconds: 1.2,
    });
  },
});

registerBehaviorModule('GuaranteedDrop', {
  note: 'Always drops a specific pickup, turning a nuisance into a reward.',
  onDeath: (enemy, params, ctx) => {
    ctx.spawnPickupAt(enemy.x, enemy.y, params.kind ?? 'CREDIT', params.count ?? 1);
  },
});

registerBehaviorModule('TrailHazard', {
  note: 'Leaves hazard patches as it walks, so its path becomes terrain.',
  onUpdate: (enemy, params, ctx, dt) => {
    enemy.trailTimer = (enemy.trailTimer ?? 0) - dt;
    if (enemy.trailTimer > 0) return;
    enemy.trailTimer = params.everySeconds ?? 1.4;
    ctx.spawnHazardAt(enemy.x, enemy.y, params.hazard ?? 'HAZ-PAPER_DRIFT_BANK', {
      seconds: params.seconds ?? 6, w: 1.6, h: 1.6,
    });
  },
});
