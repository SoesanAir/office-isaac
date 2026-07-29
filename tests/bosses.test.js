/**
 * Boss system tests: the 29 definitions plus the runtime that executes them.
 *
 * GDD refs: 15.2 (selection from floor pools), 15.3 (the R-BSS-001..007 contract),
 *           15.4 (the phase template), Appendix E (every Core fight and the shared
 *           failure-conditions row), R-BSS-001 (every normal floor ends in a boss),
 *           R-BSS-002 (exactly one Manager Reward, idempotently), R-BSS-003 (boss
 *           attacks use the same damage and telegraph rules as enemies), R-BSS-004
 *           (bounded, purposeful, visible invulnerability), R-BSS-005 (arenas are
 *           authored for the boss), R-BSS-006 (a safe path survives every wall and zone
 *           phase), R-BSS-007 (set drops are declared in data), 23.1 (schema layer).
 *
 * The point of this file is the gap between "data validates" and "data works". The
 * schema can prove a phase has a pattern name; only running the fight proves the pattern
 * fires, the telegraph gates it, and the phase actually advances.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { EventBus, EVENTS } from '../src/core/events.js';
import { Run } from '../src/systems/run.js';
import { CombatResolver } from '../src/systems/combat.js';
import { EncounterRuntime } from '../src/systems/encounter-runtime.js';
import { buildRoom } from '../src/systems/room-build.js';
import {
  allBossPatterns, allMovementRules, findMissingBossPatterns,
} from '../src/entities/boss-patterns.js';

const registry = loadContent({ strict: false });
const bosses = registry.all('boss');
const PATTERNS = new Set(allBossPatterns().map((p) => p.id));
const MOVEMENT = new Set(allMovementRules().map((m) => m.id));

// ---------------------------------------------------------------------------
// Census and references
// ---------------------------------------------------------------------------

test('GDD 24: all 29 bosses are defined, with no gaps in the numbering', () => {
  assert.equal(bosses.length, 29);
  const ids = bosses.map((b) => b.id).sort();
  for (let i = 1; i <= 29; i += 1) {
    const want = `BSS-${String(i).padStart(3, '0')}`;
    assert.ok(ids.includes(want), `${want} is missing`);
  }
});

test('every pattern and movement rule named by boss data is registered', () => {
  // The same check tools/validate-content.js runs, asserted here so a broken reference
  // fails the test suite rather than only the validator.
  const missing = findMissingBossPatterns(registry);
  assert.deepEqual(missing, [], `unregistered: ${missing.map((m) => m.name).join(', ')}`);
});

test('nested pattern references inside params also resolve', () => {
  // MODULE_CYCLE, VOTE_SELECT, and HEAD_ROTATION name patterns inside their params,
  // which findMissingBossPatterns does not walk. A typo there would fail silently at
  // runtime — the pattern simply would not fire and the phase would look inert.
  for (const boss of bosses) {
    for (const phase of boss.phases) {
      for (const entry of phase.patternWeights) {
        for (const step of entry.params?.sequence || []) {
          assert.ok(PATTERNS.has(step.pattern), `${boss.id}.${phase.id} sequence: ${step.pattern}`);
        }
        for (const option of entry.params?.options || []) {
          assert.ok(PATTERNS.has(option.pattern), `${boss.id}.${phase.id} vote: ${option.pattern}`);
        }
        const fallback = entry.params?.fallbackPattern;
        if (fallback) assert.ok(PATTERNS.has(fallback), `${boss.id}.${phase.id} fallback: ${fallback}`);
      }
      assert.ok(MOVEMENT.has(phase.movementRule), `${boss.id}.${phase.id}: ${phase.movementRule}`);
    }
  }
});

test('R-BSS-007: every set drop names content that exists', () => {
  for (const boss of bosses) {
    if (!boss.setDrop) continue;
    const id = boss.setDrop.contentId;
    const found = ['passive', 'active', 'charm', 'card', 'weapon', 'supplement']
      .some((kind) => registry.get(kind, id));
    assert.ok(found, `${boss.id} set drop "${id}" does not exist`);
    // A set drop that replaced the Manager Reward AND was near-certain would make
    // R-BSS-002's single guaranteed reward meaningless.
    if (boss.setDrop.replacesManagerReward) {
      assert.ok(boss.setDrop.chance <= 0.35, `${boss.id} set drop replaces the reward at ${boss.setDrop.chance}`);
    }
  }
});

test('every add a boss summons is an enemy that exists', () => {
  // A missing enemy id makes SUMMON_ADDS a no-op, which turns an add phase into an
  // empty phase — and a phase whose exit is ADDS_CLEARED would then complete instantly.
  for (const boss of bosses) {
    for (const phase of boss.phases) {
      for (const entry of phase.patternWeights) {
        const collect = [entry.params, ...(entry.params?.options || []).map((o) => o.params)];
        for (const params of collect) {
          if (!params?.enemyId) continue;
          assert.ok(registry.get('enemy', params.enemyId), `${boss.id}.${phase.id} summons missing ${params.enemyId}`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// The R-BSS contract
// ---------------------------------------------------------------------------

test('R-BSS-006: guaranteesSafePath is true for all 29', () => {
  for (const boss of bosses) assert.equal(boss.guaranteesSafePath, true, boss.id);
});

test('R-BSS-006: no arena-reshaping pattern is ever asked for zero gaps', () => {
  // boss-patterns.js clamps this at runtime, so data cannot actually seal a room. This
  // asserts the *intent* is also right, because a zero in data means someone believed
  // sealing was allowed.
  const reshaping = new Set(allBossPatterns().filter((p) => p.reshapesArena).map((p) => p.id));
  for (const boss of bosses) {
    for (const phase of boss.phases) {
      for (const entry of phase.patternWeights) {
        const check = (pattern, params) => {
          if (!reshaping.has(pattern) || !params) return;
          const gaps = params.safeGapCount ?? params.gapCount;
          if (gaps === undefined) return;
          assert.ok(gaps >= 1, `${boss.id}.${phase.id} asks ${pattern} for ${gaps} gaps`);
        };
        check(entry.pattern, entry.params);
        for (const step of entry.params?.sequence || []) check(step.pattern, step.params);
        for (const option of entry.params?.options || []) check(option.pattern, option.params);
      }
    }
  }
});

test('R-BSS-004: every invulnerable phase is bounded or has something attackable', () => {
  for (const boss of bosses) {
    for (const phase of boss.phases) {
      if (!phase.invulnerable) continue;
      const bounded = phase.maxInvulnerableSeconds > 0 && phase.maxInvulnerableSeconds <= 6;
      assert.ok(
        bounded || phase.attackableDuringInvuln,
        `${boss.id}.${phase.id} is invulnerable with neither a bound nor a target`,
      );
      // Belt and braces: an attackable invulnerable phase should still pair with nodes,
      // or "attackable" is a claim with nothing behind it.
      if (phase.attackableDuringInvuln) {
        const hasObjective = phase.patternWeights.some((w) => w.pattern === 'NODE_ACTIVATION')
          || phase.patternWeights.some((w) => w.pattern === 'SUMMON_ADDS');
        assert.ok(hasObjective, `${boss.id}.${phase.id} claims attackable but spawns no target`);
      }
    }
  }
});

test('R-BSS-003: every boss telegraph is at least as long as its patterns need', () => {
  // A boss may be MORE generous than its patterns, never less. The runtime takes the
  // max of the two, so a low boss minimum is not a bug — but a boss whose minimum is
  // below the early-game floor would be.
  for (const boss of bosses) {
    assert.ok(boss.telegraphMinimumSeconds >= 0.2, `${boss.id} telegraph ${boss.telegraphMinimumSeconds}`);
  }
  // GDD 3.6: the first ten minutes get "generous telegraphs". The Open Office I boss is
  // the first one a player ever meets.
  const first = bosses.find((b) => b.id === 'BSS-001');
  assert.ok(first.telegraphMinimumSeconds >= 0.9, `BSS-001 telegraph is only ${first.telegraphMinimumSeconds}s`);
});

test('every phase list has exactly one START and reaches a DEATH exit', () => {
  for (const boss of bosses) {
    const starts = boss.phases.filter((p) => p.entryCondition.type === 'START');
    assert.equal(starts.length, 1, `${boss.id} has ${starts.length} START phases`);
    // Without a DEATH exit somewhere, the last phase has no terminal condition and the
    // fight could sit in it forever.
    assert.ok(
      boss.phases.some((p) => p.exitCondition.type === 'DEATH'),
      `${boss.id} never exits on DEATH`,
    );
  }
});

test('GDD 15.2: every floor pool a boss claims is claimed by at least one floor', () => {
  const claimed = new Set();
  for (const floor of registry.all('floor')) {
    if (floor.bossPool) claimed.add(floor.bossPool);
    for (const pool of floor.bossPools || []) claimed.add(pool);
  }
  for (const dept of registry.all('department')) {
    for (const pool of dept.bossPools || []) claimed.add(pool);
  }
  const orphans = new Set();
  for (const boss of bosses) {
    for (const pool of boss.floorPools) if (!claimed.has(pool)) orphans.add(pool);
  }
  // An orphan pool means a boss that can never be selected — dead content that still
  // shows in the collection.
  assert.deepEqual([...orphans], [], `no floor draws from: ${[...orphans].join(', ')}`);
});

test('R-BSS-001: every normal floor can actually draw a boss', () => {
  const byPool = new Map();
  for (const boss of bosses) {
    for (const pool of boss.floorPools) {
      byPool.set(pool, (byPool.get(pool) ?? 0) + 1);
    }
  }
  for (const floor of registry.all('floor')) {
    const pools = [floor.bossPool, ...(floor.bossPools || [])].filter(Boolean);
    if (!pools.length) continue;
    const total = pools.reduce((sum, p) => sum + (byPool.get(p) ?? 0), 0);
    assert.ok(total >= 1, `${floor.id} draws from ${pools.join(',')} which stocks no boss`);
  }
});

// ---------------------------------------------------------------------------
// The runtime, actually running
// ---------------------------------------------------------------------------

/**
 * Build a real boss arena and drop `bossId` into it.
 *
 * Two details here were learned the hard way, and both matter:
 *
 * 1. **It uses the floor's actual boss node**, not an arbitrary room. R-BSS-005 says
 *    arenas are authored for their boss with large footprints, and the Manager Office
 *    template is 43x23 with a BOSS_ANCHOR zone. An ordinary 21x11 room cannot hold
 *    BSS-028 at radius 2.6 at all, so testing in one would assert the wrong thing.
 * 2. **It moves the player off the anchor.** A freshly constructed Run leaves the player
 *    at the room centre, which is exactly where the boss spawns — so every projectile
 *    hit the player on its spawn frame and the pool read as empty. That was a fixture
 *    artifact, not a product bug, but it hid whether patterns fired at all.
 */
function bossFixture(bossId, seed) {
  const events = new EventBus();
  const run = new Run({ registry, events });
  run.start({ seed });
  const combat = new CombatResolver({ registry, events, getRun: () => run });
  const runtime = new EncounterRuntime({ registry, events, combat, getRun: () => run });

  const node = run.floor.nodes.get(run.floor.bossNodeId) ?? [...run.floor.nodes.values()][0];
  node.bossId = bossId;
  const room = buildRoom({ floor: run.floor, node, registry, rngSource: run.rng });
  room.node.bossId = bossId;

  // Stand the player near one edge of the arena, which is where a door would put them.
  const anchor = room.zonesOf('BOSS_ANCHOR')[0];
  const centre = room.centre;
  run.player.x = anchor ? anchor.x - 4 : centre.x - 6;
  run.player.y = anchor ? anchor.y + anchor.h / 2 : centre.y;

  return { events, run, runtime, room };
}

test('a boss spawns, and lands somewhere the player can reach', () => {
  const { runtime, room } = bossFixture('BSS-001', 'OFFICE-BOSS-0001');
  const spawned = runtime.spawnBoss(room);
  assert.equal(spawned, 1, 'BSS-001 failed to spawn');
  const boss = runtime.boss.boss;
  assert.ok(boss, 'no boss entity');
  assert.equal(boss.isBoss, true);
  assert.ok(Number.isFinite(boss.x) && Number.isFinite(boss.y), 'non-finite position');
  assert.equal(boss.unreachable, false);
  // Shaped like an enemy on purpose (R-BSS-003), so physics and the renderer need no
  // special case for it.
  assert.ok(runtime.hostiles.includes(boss), 'boss is not in the hostile list');
});

test('R-CMB-006: a room with no boss resolves instead of hanging', () => {
  const { runtime, room } = bossFixture('BSS-001', 'OFFICE-BOSS-0002');
  room.node.bossId = null;
  assert.equal(runtime.spawnBoss(room), 0);
});

test('a missing boss definition does not hang the room', () => {
  // A content defect must not become a soft-lock. The validator is where this gets
  // caught; the runtime's job is to stay completable.
  const { runtime, room } = bossFixture('BSS-001', 'OFFICE-BOSS-0003');
  room.node.bossId = 'BSS-999';
  assert.equal(runtime.spawnBoss(room), 0);
});

test('the telegraph gates the first attack: nothing fires on frame one', () => {
  const { runtime, room } = bossFixture('BSS-001', 'OFFICE-BOSS-0004');
  runtime.spawnBoss(room);
  const boss = runtime.boss.boss;

  // Step a single frame. BSS-001's telegraph floor is 1.0s and every pattern it owns is
  // at least 0.7s, so a projectile appearing here would mean the gate is broken.
  runtime.update(1 / 60);
  let live = 0;
  runtime.projectiles.pool.forEach((p) => { if (!p.__dead) live += 1; });
  assert.equal(live, 0, 'a boss attack fired before its telegraph elapsed');
  assert.ok(boss.health > 0);
});

test('a boss actually attacks once its telegraph and settle window elapse', () => {
  const { runtime, room } = bossFixture('BSS-002', 'OFFICE-BOSS-0005');
  runtime.spawnBoss(room);

  // Four seconds is comfortably past the 0.7s phase settle plus BSS-002's 0.9s minimum,
  // even for its longest pattern. If nothing has happened by now, patterns never run.
  let fired = false;
  for (let i = 0; i < 240 && !fired; i += 1) {
    runtime.update(1 / 60);
    runtime.projectiles.pool.forEach((p) => { if (!p.__dead) fired = true; });
    if (runtime.currentRoom?.hazards?.length) fired = true;
    if (runtime.pulses.length) fired = true;
  }
  assert.equal(fired, true, 'BSS-002 never produced an attack in four seconds');
});

test('phases advance when their exit condition is met', () => {
  const { events, runtime, room } = bossFixture('BSS-007', 'OFFICE-BOSS-0006');
  const seen = [];
  events.on(EVENTS.BOSS_PHASE_CHANGED, (e) => { if (e.phase) seen.push(e.phase); });
  runtime.spawnBoss(room);
  const boss = runtime.boss.boss;

  runtime.update(1 / 60);
  assert.deepEqual(seen, ['obsolete_rotation'], 'did not start in the START phase');

  // Drop it past the phase-two threshold. BSS-007 exits phase one below 60% health.
  boss.health = boss.maxHealth * 0.5;
  for (let i = 0; i < 120 && seen.length < 2; i += 1) runtime.update(1 / 60);
  assert.equal(seen[1], 'degraded', `expected 'degraded', got ${seen[1]}`);

  boss.health = boss.maxHealth * 0.1;
  for (let i = 0; i < 120 && seen.length < 3; i += 1) runtime.update(1 / 60);
  assert.equal(seen[2], 'overclock_meltdown', `expected the meltdown, got ${seen[2]}`);
});

test('R-BSS-002: a defeated boss grants exactly one reward, even if ticked again', () => {
  const { events, runtime, room } = bossFixture('BSS-001', 'OFFICE-BOSS-0007');
  let defeats = 0;
  events.on(EVENTS.BOSS_DEFEATED, () => { defeats += 1; });
  runtime.spawnBoss(room);
  const boss = runtime.boss.boss;

  boss.health = 0;
  boss.dead = true;
  // Ticked repeatedly, as it would be while the death animation plays. The latch lives
  // on room.state precisely so this stays one reward across a reload too.
  for (let i = 0; i < 30; i += 1) runtime.update(1 / 60);
  assert.equal(defeats, 1, `emitted ${defeats} defeat events`);
});

test('every boss survives a spawn and a second of simulation', () => {
  // 29 fights, one second each. The cheap version of GDD 23.3's boss matrix: it will not
  // find balance problems, but it does find a pattern that throws on a real arena, which
  // is the failure mode that turns a floor into a dead end.
  for (const def of bosses) {
    const { runtime, room } = bossFixture(def.id, `OFFICE-BSSALL-${def.id.slice(4)}`);
    const spawned = runtime.spawnBoss(room);
    assert.equal(spawned, 1, `${def.id} failed to spawn`);
    for (let i = 0; i < 60; i += 1) runtime.update(1 / 60);
    const boss = runtime.boss.boss;
    assert.ok(Number.isFinite(boss.x), `${def.id} drifted to a non-finite x`);
    assert.ok(Number.isFinite(boss.y), `${def.id} drifted to a non-finite y`);
    assert.ok(boss.health > 0, `${def.id} died to its own fight`);
    runtime.despawnAll();
  }
});

test('R-TEC-002: the same seed produces the same boss behaviour', () => {
  const trace = (seed) => {
    const { runtime, room } = bossFixture('BSS-005', seed);
    runtime.spawnBoss(room);
    const out = [];
    for (let i = 0; i < 180; i += 1) {
      runtime.update(1 / 60);
      const t = runtime.boss.telegraph;
      if (t) out.push(t.pattern.id);
    }
    // Collapse runs, so the trace records the ORDER of patterns rather than how many
    // frames each telegraph happened to occupy.
    return out.filter((v, i) => v !== out[i - 1]).join('>');
  };
  const a = trace('OFFICE-BOSSDET-0001');
  const b = trace('OFFICE-BOSSDET-0001');
  assert.equal(a, b);
  assert.ok(a.length > 0, 'the trace captured no patterns at all');
});

// ---------------------------------------------------------------------------
// Authoring quality (GDD 18.3, H.2)
// ---------------------------------------------------------------------------

test('GDD 18.3 / H.2: every boss records a silhouette, core idea, and originality note', () => {
  const seenIdeas = new Set();
  for (const boss of bosses) {
    assert.ok(boss.silhouetteNote.length >= 20, `${boss.id} silhouette note is too thin`);
    assert.ok(boss.coreIdea.length >= 30, `${boss.id} core idea is too thin`);
    assert.ok(boss.originalityNote.length >= 20, `${boss.id} originality note is too thin`);
    assert.ok(
      !/^(original|n\/a|todo|tbd)\.?$/i.test(boss.originalityNote.trim()),
      `${boss.id} has a placeholder originality note`,
    );
    // A duplicated core idea means two bosses are the same fight with different art,
    // which is what Appendix E's roster exists to prevent.
    assert.equal(seenIdeas.has(boss.coreIdea), false, `${boss.id} reuses another core idea`);
    seenIdeas.add(boss.coreIdea);
  }
});

test('every boss declares at least one accessibility variant', () => {
  for (const boss of bosses) {
    assert.ok(boss.accessibilityVariants.length >= 1, `${boss.id} has no accessibility variant`);
    for (const v of boss.accessibilityVariants) {
      assert.ok(v.length >= 20, `${boss.id} has a stub accessibility variant: "${v}"`);
    }
  }
});

test('BSS-019 never lets an accessibility setting remove a fairness tell', () => {
  // Appendix E: "the real attacks remain identifiable by shadow and audio", and the role
  // note is "fairness depends on consistent tell, never pure guessing". A reduced-effects
  // mode that removed the shadow would make the fight a coin flip.
  const brand = bosses.find((b) => b.id === 'BSS-019');
  const text = brand.accessibilityVariants.join(' ').toLowerCase();
  assert.ok(text.includes('shadow'), 'BSS-019 does not mention preserving the shadow tell');
  assert.ok(
    brand.accessibilityVariants.some((v) => /caption/i.test(v)),
    'BSS-019 has an audio tell but no caption variant (R-AUD-003)',
  );
});
