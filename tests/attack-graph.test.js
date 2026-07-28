/**
 * Attack graph and modifier adapter tests.
 *
 * GDD refs: 8.5 ("Required synergy examples" — this suite is that table, executed),
 *           7.3 (adapter contract and the no-effect rule), R-WPN-005 / R-ITM-006
 *           (unsupported modifiers resolve to NO_EFFECT deterministically, with no
 *           prompt and no faked stat change), R-WPN-006 (a weapon swap recalculates
 *           from owned passives), R-PLY-003 (clamps), R-ITM-008 (no hidden penalty
 *           based on current power), 23.3 (combat test matrix: every weapon with no
 *           modifiers, core modifiers, incompatible modifiers, and extreme values).
 *
 * Fixtures rather than shipped content: this suite has to pin adapter *behaviour*,
 * and it must keep working while the weapon and item catalogues are still being
 * authored. The fixtures use the real schemas and the real adapter registry, so a
 * broken adapter still fails here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import '../src/register-all.js';
import { AttackGraphResolver } from '../src/systems/attack-graph.js';
import { resolveAdapter, ADAPTER_RESULT } from '../src/systems/adapters.js';
import { ARCHETYPE, CLAMPS, DAMAGE_TAG, STATUS } from '../src/core/constants.js';

// ---------------------------------------------------------------------------
// Fixtures mirroring the real GDD numbers
// ---------------------------------------------------------------------------

/** WPN-001 Keyboard, using GDD 5.1's baseline values verbatim. */
const KEYBOARD = {
  id: 'WPN-001',
  attack: {
    archetype: ARCHETYPE.PROJECTILE,
    inputMode: 'CARDINAL_TAP',
    baseDamageMultiplier: 1.0,
    intervalSeconds: 0.45,
    projectileSpeed: 9.0,
    projectileLifetime: 0.95,
    projectileSize: 1,
    damageTags: [DAMAGE_TAG.PROJECTILE],
  },
  modifierTags: ['PROJECTILE', 'DIRECTED', 'REPEATABLE'],
  adapters: {
    HOMING: 'HomingProjectileAdapter',
    EIGHT_DIRECTION: 'EightDirectionAdapter',
    SPLIT: 'SplitProjectileAdapter',
    RETURN: 'ReturnProjectileAdapter',
  },
};

/** WPN-007 Rubber Stamp: an area weapon that "ignores projectile-only modifiers". */
const RUBBER_STAMP = {
  id: 'WPN-007',
  attack: {
    archetype: ARCHETYPE.AREA_SLAM,
    inputMode: 'CARDINAL_TAP',
    baseDamageMultiplier: 1.8,
    intervalSeconds: 0.8,
    arcRadius: 2.2,
    arcAngle: 1.6,
    windupSeconds: 0.25,
    activeSeconds: 0.12,
    recoverySeconds: 0.2,
    damageTags: [DAMAGE_TAG.MELEE],
  },
  modifierTags: ['AREA_SLAM', 'AREA', 'DIRECTED'],
  adapters: { EIGHT_DIRECTION: 'EightDirectionSlamAdapter' },
};

const modifier = (mechanic, defaultAdapter, params = {}, overrides = {}) => ({
  mechanic,
  supportedAttackTags: ['PROJECTILE', 'MELEE_ARC', 'BEAM', 'TETHER', 'CHARGE_WAVE'],
  defaultAdapter,
  weaponOverrides: overrides,
  unsupportedBehavior: 'NO_EFFECT',
  params,
});

const ITEMS = {
  'ITM-011': { id: 'ITM-011', modifier: modifier('HOMING', 'HomingProjectileAdapter', {}, { 'WPN-002': 'HomingArcAdapter', 'WPN-003': 'TrackingBeamAdapter' }) },
  'ITM-012': { id: 'ITM-012', modifier: { ...modifier('EIGHT_DIRECTION', 'EightDirectionAdapter'), supportedAttackTags: ['PROJECTILE', 'MELEE_ARC', 'BEAM', 'AREA_SLAM', 'PLACED_AREA'] } },
  'ITM-010': { id: 'ITM-010', modifier: modifier('MULTIPLY_DUAL', 'DualProjectileAdapter') },
  'ITM-013': { id: 'ITM-013', modifier: modifier('SPLIT', 'SplitProjectileAdapter') },
  'ITM-055': { id: 'ITM-055', modifier: modifier('MULTIPLY_TRIPLE', 'TripleProjectileAdapter') },
  'ITM-021': { id: 'ITM-021', modifier: modifier('RETURN', 'ReturnProjectileAdapter') },
  'ITM-023': { id: 'ITM-023', modifier: modifier('BOUNCE', 'BounceProjectileAdapter') },
  'ITM-024': { id: 'ITM-024', modifier: modifier('PIERCE', 'PierceProjectileAdapter') },
  'ITM-022': { id: 'ITM-022', modifier: modifier('DUPLICATE', 'DuplicateProjectileAdapter') },
  'ITM-032': { id: 'ITM-032', modifier: modifier('STATUS_MARK', 'StatusProjectileAdapter', { status: STATUS.MARKED, chance: 1, seconds: 4, damageBonus: 0.15 }) },
  'ITM-057': { id: 'ITM-057', modifier: modifier('CRIT', 'CritAdapter') },
  // A deliberately incompatible pairing: a projectile-only trajectory item on an
  // area weapon. GDD 7.3 requires this to be NO_EFFECT, not a token stat bump.
  'ITM-PROJ_ONLY': {
    id: 'ITM-PROJ_ONLY',
    modifier: {
      mechanic: 'BOUNCE',
      supportedAttackTags: ['PROJECTILE'],
      defaultAdapter: 'BounceProjectileAdapter',
      weaponOverrides: {},
      unsupportedBehavior: 'NO_EFFECT',
    },
  },
  // Pure stat item, no modifier block at all.
  'ITM-001': { id: 'ITM-001', stats: { intervalMul: 0.88 } },
  'ITM-005': { id: 'ITM-005', stats: { damageMul: 1.25, projectileSpeedMul: 0.85 } },
};

const WEAPONS = { 'WPN-001': KEYBOARD, 'WPN-007': RUBBER_STAMP };

/** Registry stub: only the lookups the resolver actually performs. */
const registry = {
  get(kind, id) {
    if (kind === 'weapon') return WEAPONS[id];
    if (kind === 'passive') return ITEMS[id];
    return undefined;
  },
};

function makePlayer(weaponId, passiveIds = []) {
  return {
    weaponId,
    passiveIds: [...passiveIds],
    transformationIds: [],
    charmId: null,
    profileId: 'PRF-001',
    stats: { damage: 10 },
    status: { active: new Map(), get: () => undefined },
  };
}

function resolve(weaponId, passiveIds) {
  return new AttackGraphResolver({ registry }).resolve(makePlayer(weaponId, passiveIds));
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

test('GDD 5.1: an unmodified Keyboard matches the documented baseline', () => {
  const plan = resolve('WPN-001', []);
  assert.equal(plan.interval, 0.45);
  assert.equal(plan.speed, 9.0);
  assert.equal(plan.lifetime, 0.95);
  assert.equal(plan.damage, 10);
  assert.equal(plan.shotCount, 1);
  assert.equal(plan.homing, null);
  assert.equal(plan.eightDirection, false);
});

// ---------------------------------------------------------------------------
// GDD 8.5's required synergy table, one test per row
// ---------------------------------------------------------------------------

test('8.5: Keyboard + Pen Laser Pointer steers keys without changing launch input', () => {
  const plan = resolve('WPN-001', ['ITM-011']);
  assert.ok(plan.homing, 'no homing applied');
  assert.ok(plan.homing.strength > 0);
  // The launch pattern must be untouched: cardinal input still decides direction.
  assert.equal(plan.shotCount, 1);
  assert.equal(plan.shots[0].angleOffset, 0);
});

test('8.5: Keyboard + Numeric Keypad enables eight-direction launches', () => {
  const plan = resolve('WPN-001', ['ITM-012']);
  assert.equal(plan.eightDirection, true);
});

test('8.5: Ctrl+C duplicates the whole pattern, and copies never re-copy', () => {
  const plan = resolve('WPN-001', ['ITM-022']);
  // Appendix C.2 states 18 percent.
  assert.ok(Math.abs(plan.duplicateChance - 0.18) < 1e-9, `got ${plan.duplicateChance}`);
  // Two copies compose as independent rolls rather than summing to 36 percent.
  const twice = resolve('WPN-001', ['ITM-022', 'ITM-022']);
  assert.ok(twice.duplicateChance > 0.18 && twice.duplicateChance < 0.36);
});

test('8.5: Ctrl+C + USB Hub — the split pattern is what duplicates', () => {
  const plan = resolve('WPN-001', ['ITM-022', 'ITM-013']);
  assert.equal(plan.shotCount, 3, 'expected the original plus two split shots');
  assert.ok(plan.duplicateChance > 0);
  // The split shots exist in the pattern, so duplicating the event duplicates all
  // three — which is the synergy the GDD names.
  assert.equal(plan.shots.filter((s) => s.tag === 'SPLIT').length, 2);
});

test('8.5: Sticky Keys + Backspace — stuck attacks detach and return', () => {
  const sticky = { id: 'ITM-016', modifier: modifier('STICK', 'StickProjectileAdapter') };
  const local = { get: (k, id) => (k === 'weapon' ? WEAPONS[id] : (id === 'ITM-016' ? sticky : ITEMS[id])) };
  const plan = new AttackGraphResolver({ registry: local })
    .resolve(makePlayer('WPN-001', ['ITM-016', 'ITM-021']));
  assert.ok(plan.sticky, 'stick payload missing');
  assert.equal(plan.returns, true);
  assert.ok(plan.returnDamageScale > 0 && plan.returnDamageScale < 1);
});

// ---------------------------------------------------------------------------
// Multiplicity interactions
// ---------------------------------------------------------------------------

test('Dual Monitors produces a paired pattern at the documented 0.72 damage', () => {
  const plan = resolve('WPN-001', ['ITM-010']);
  assert.equal(plan.shotCount, 2);
  for (const shot of plan.shots) {
    assert.ok(Math.abs(shot.damageScale - 0.72) < 1e-9, `got ${shot.damageScale}`);
  }
  // Two copies must be offset in opposite directions, not stacked on one another.
  assert.ok(plan.shots[0].angleOffset < 0 && plan.shots[1].angleOffset > 0);
});

test('Three-Hole Punch OVERRIDES Dual Monitors rather than multiplying it', () => {
  // Appendix C.2: "Overrides Dual Monitors pattern; the stronger pattern is not
  // multiplied again." Without this, the pair would become six shots.
  const plan = resolve('WPN-001', ['ITM-010', 'ITM-055']);
  assert.equal(plan.shotCount, 3, `expected 3 shots, got ${plan.shotCount}`);
  assert.ok(plan.shots.every((s) => s.tag === 'TRIPLE'));
});

test('USB Hub splits once, never recursively', () => {
  const one = resolve('WPN-001', ['ITM-013']);
  assert.equal(one.shotCount, 3);
  // A second Hub may add its own split of the originals, but must not split splits.
  const two = resolve('WPN-001', ['ITM-013', 'ITM-013']);
  assert.ok(two.shotCount <= 5, `runaway split produced ${two.shotCount} shots`);
});

// ---------------------------------------------------------------------------
// The no-effect rule
// ---------------------------------------------------------------------------

test('R-WPN-005 / R-ITM-006: an incompatible modifier resolves to NO_EFFECT', () => {
  const resolution = resolveAdapter(ITEMS['ITM-PROJ_ONLY'].modifier, RUBBER_STAMP);
  assert.equal(resolution.result, ADAPTER_RESULT.NO_EFFECT);
});

test('R-ITM-006: NO_EFFECT changes nothing at all, and fakes no stat', () => {
  const without = resolve('WPN-007', []);
  const withItem = resolve('WPN-007', ['ITM-PROJ_ONLY']);
  // GDD 7.3: "The game must never fake a meaningless stat change just to claim
  // universal compatibility." So every number must be identical.
  assert.equal(withItem.damage, without.damage);
  assert.equal(withItem.interval, without.interval);
  assert.equal(withItem.bounce, without.bounce);
  assert.equal(withItem.shotCount, without.shotCount);
  // But the resolution is still recorded, so the collection screen and the debug
  // overlay can tell the player it is owned and simply not interacting.
  const logged = withItem.adapterLog.find((e) => e.item === 'ITM-PROJ_ONLY');
  assert.ok(logged, 'the no-effect resolution was not recorded');
  assert.equal(logged.result, ADAPTER_RESULT.NO_EFFECT);
});

test('a weapon-specific override beats the default adapter', () => {
  const beam = {
    id: 'WPN-003',
    attack: { archetype: ARCHETYPE.BEAM, inputMode: 'CARDINAL_HOLD', baseDamageMultiplier: 1, intervalSeconds: 0.1, beamRange: 9, tickRate: 12, damageTags: [DAMAGE_TAG.BEAM] },
    modifierTags: ['BEAM', 'SUSTAINED', 'DIRECTED'],
    adapters: {},
  };
  const resolution = resolveAdapter(ITEMS['ITM-011'].modifier, beam);
  assert.equal(resolution.result, ADAPTER_RESULT.APPLIED);
  assert.equal(resolution.adapter.id, 'TrackingBeamAdapter');
});

// ---------------------------------------------------------------------------
// Order independence: the central promise of this module
// ---------------------------------------------------------------------------

test('the resolved attack is independent of pickup order', () => {
  const build = ['ITM-011', 'ITM-013', 'ITM-024', 'ITM-023', 'ITM-005', 'ITM-001'];
  const forward = resolve('WPN-001', build);
  const reversed = resolve('WPN-001', [...build].reverse());
  const shuffled = resolve('WPN-001', ['ITM-024', 'ITM-001', 'ITM-013', 'ITM-005', 'ITM-023', 'ITM-011']);

  const summary = (p) => ({
    damage: p.damage.toFixed(6),
    interval: p.interval.toFixed(6),
    speed: p.speed.toFixed(6),
    pierce: p.pierce,
    bounce: p.bounce,
    shots: p.shotCount,
    homing: Boolean(p.homing),
  });
  assert.deepEqual(summary(reversed), summary(forward));
  assert.deepEqual(summary(shuffled), summary(forward));
});

// ---------------------------------------------------------------------------
// Stats, stacking, and clamps
// ---------------------------------------------------------------------------

test('stat items compose multiplicatively in a fixed order', () => {
  const plan = resolve('WPN-001', ['ITM-001', 'ITM-005']);
  // Espresso 0.88 interval, Heavy Keycaps 1.25 damage and 0.85 speed.
  assert.ok(Math.abs(plan.interval - 0.45 * 0.88) < 1e-9, `interval ${plan.interval}`);
  assert.ok(Math.abs(plan.damage - 10 * 1.25) < 1e-9, `damage ${plan.damage}`);
  assert.ok(Math.abs(plan.speed - 9 * 0.85) < 1e-9, `speed ${plan.speed}`);
});

test('a repeatable item applies once per stack, not once per list entry', () => {
  const single = resolve('WPN-001', ['ITM-005']);
  const doubled = resolve('WPN-001', ['ITM-005', 'ITM-005']);
  assert.ok(Math.abs(doubled.damage - single.damage * 1.25) < 1e-6,
    `expected ${single.damage * 1.25}, got ${doubled.damage}`);
});

test('R-PLY-003: extreme stacks clamp instead of producing absurd values', () => {
  const many = Array.from({ length: 40 }, () => 'ITM-001');
  const plan = resolve('WPN-001', many);
  assert.ok(Number.isFinite(plan.interval));
  assert.ok(plan.interval >= CLAMPS.attackInterval.min, `interval ${plan.interval}`);
  assert.ok(plan.interval <= CLAMPS.attackInterval.max);

  const heavy = Array.from({ length: 40 }, () => 'ITM-005');
  const heavyPlan = resolve('WPN-001', heavy);
  assert.ok(Number.isFinite(heavyPlan.damage));
  assert.ok(heavyPlan.damage <= CLAMPS.damage.max);
  assert.ok(heavyPlan.speed >= CLAMPS.projectileSpeed.min, `speed ${heavyPlan.speed}`);
});

test('R-CMB-004: a runaway pattern is capped but its damage is preserved', () => {
  const many = Array.from({ length: 8 }, () => 'ITM-013');
  const plan = resolve('WPN-001', many);
  assert.ok(plan.shotCount <= 32, `shot count ${plan.shotCount} exceeded the cap`);
  // The cap must aggregate rather than delete: total damage output survives.
  const total = plan.shots.reduce((sum, s) => sum + s.damageScale, 0);
  assert.ok(total > 1, `aggregation lost damage: total scale ${total}`);
});

test('R-WPN-006: swapping the weapon rebuilds the graph from owned passives', () => {
  const resolver = new AttackGraphResolver({ registry });
  const player = makePlayer('WPN-001', ['ITM-011', 'ITM-023']);
  const before = resolver.resolve(player);
  assert.ok(before.homing);
  assert.ok(before.bounce > 0);

  // Swap to the area weapon: neither projectile trajectory item should apply.
  player.weaponId = 'WPN-007';
  const after = resolver.resolve(player);
  assert.equal(after.archetype, ARCHETYPE.AREA_SLAM);
  assert.equal(after.bounce, 0, 'stale bounce survived a weapon swap');
  assert.equal(after.homing, null, 'stale homing survived a weapon swap');
});

test('status payloads merge rather than stacking magnitude', () => {
  const plan = resolve('WPN-001', ['ITM-032', 'ITM-032']);
  const marks = plan.statusPayload.filter((s) => s.status === STATUS.MARKED);
  assert.equal(marks.length, 1, 'mark payload duplicated');
  assert.equal(marks[0].magnitude, 1, 'mark magnitude stacked');
});

test('crit chance composes below certainty no matter how many crit items stack', () => {
  const plan = resolve('WPN-001', Array.from({ length: 30 }, () => 'ITM-057'));
  assert.ok(plan.critChance < 1, `crit reached ${plan.critChance}`);
  assert.ok(plan.critChance > 0.9, `expected high crit, got ${plan.critChance}`);
});
