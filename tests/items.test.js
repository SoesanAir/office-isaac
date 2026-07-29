/**
 * Item catalogue tests: the six collectible classes as shipped content.
 *
 * GDD refs: 8.3 (quality bands), 8.4 (the loot algorithm; quality 4 is gated before
 *           floor 3), 8.5 (synergy layers), 8.6 / R-ITM-007 (a liability must be
 *           declinable and can never make a run unwinnable), 8.7 (catalogue
 *           categories), 9.4-9.8 (active, pocket, and charm slots), 9.6 (CARD-015
 *           cannot be used in a boss room), 9.7 / R-CON-003 (Supplement identities
 *           are randomized per run), R-ITM-001 (passives stack with no inventory
 *           cap), R-ITM-002 (unique sprite per collectible), R-ITM-004 (early-floor
 *           jackpot gate), R-ITM-005 (no raw numbers in pickup text), R-ITM-006 /
 *           R-WPN-005 (unsupported modifiers resolve to NO_EFFECT), R-ITM-008 (no
 *           power-sensitive selection), C.1-C.7 (the authored magnitudes), 23.1
 *           (schema layer), 23.3 (combat matrix).
 *
 * Unlike tests/attack-graph.test.js, this suite runs against the REAL catalogue. Its
 * job is to catch the class of bug a schema cannot express: a charm that is secretly
 * as strong as a passive, a transformation whose set can never complete, a Supplement
 * pair that is not actually a pair.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { AttackGraphResolver } from '../src/systems/attack-graph.js';
import { allHooks } from '../src/systems/effects.js';
import { CLAMPS, POOL, QUALITY } from '../src/core/constants.js';

const registry = loadContent({ strict: false });

const passives = registry.all('passive');
const actives = registry.all('active');
const cards = registry.all('card');
const supplements = registry.all('supplement');
const charms = registry.all('charm');
const transformations = registry.all('transformation');

const HOOK_NAMES = new Set(allHooks().map((h) => h.name));
const localization = registry.all('localization').find((t) => t.language === 'en');

// ---------------------------------------------------------------------------
// Census. The GDD §24 seed catalogue is a contract, not an aspiration.
// ---------------------------------------------------------------------------

test('GDD 24: every item class meets its seed-catalogue count', () => {
  assert.equal(passives.length, 60, 'passives');
  assert.equal(actives.length, 15, 'actives');
  assert.equal(cards.length, 18, 'Action Cards');
  assert.equal(supplements.length, 14, 'Supplements');
  assert.equal(charms.length, 18, 'Desk Charms');
  assert.equal(transformations.length, 4, 'transformations');
});

test('R-ITM-002: every collectible has its own sprite id', () => {
  const seen = new Map();
  for (const def of [...passives, ...actives, ...cards, ...supplements, ...charms, ...transformations]) {
    const prior = seen.get(def.spriteId);
    assert.equal(prior, undefined, `${def.id} reuses the sprite of ${prior}`);
    seen.set(def.spriteId, def.id);
  }
});

// ---------------------------------------------------------------------------
// Quality and generation rules (GDD 8.3, 8.4, R-ITM-004)
// ---------------------------------------------------------------------------

test('R-ITM-004: no quality-4 item can be rolled before floor three', () => {
  // GDD 8.4 step 5 gates jackpots on early floors. An item that is quality 4 but
  // minFloor 1 would bypass that gate entirely, because the gate reads minFloor.
  for (const def of [...passives, ...actives]) {
    if (def.quality !== QUALITY.JACKPOT) continue;
    assert.ok(def.minFloor >= 3, `${def.id} is quality 4 but available from floor ${def.minFloor}`);
  }
});

test('GDD 8.3: quality and weight move in opposite directions', () => {
  // Not a strict ordering — pools differ — but a quality-4 item must never be more
  // common than a quality-2 one, or the bands mean nothing.
  const heaviestByQuality = new Map();
  for (const def of [...passives, ...actives]) {
    const cur = heaviestByQuality.get(def.quality) ?? 0;
    heaviestByQuality.set(def.quality, Math.max(cur, def.baseWeight));
  }
  const jackpot = heaviestByQuality.get(QUALITY.JACKPOT);
  const reliable = heaviestByQuality.get(QUALITY.RELIABLE);
  if (jackpot !== undefined && reliable !== undefined) {
    assert.ok(jackpot < reliable, `a quality-4 item weighs ${jackpot}, a quality-2 one ${reliable}`);
  }
});

test('R-ITM-007: every liability is flagged, and none removes the last health icon', () => {
  for (const def of passives) {
    const looksBad = def.quality === QUALITY.LIABILITY;
    if (looksBad) {
      assert.ok(
        def.liability || def.tags.includes('TRADEOFF'),
        `${def.id} is quality 0 but claims to be neither a liability nor a tradeoff`,
      );
    }
    // A container removal is the only way a passive can approach unwinnability. The
    // player starts with three, so a single item may take at most two.
    const removed = -(def.health?.composureContainersAdd ?? 0);
    assert.ok(removed <= 2, `${def.id} removes ${removed} containers, which can strand a run`);
  }
});

test('GDD 9.8: a Desk Charm never competes with a full passive item', () => {
  // The class is defined as "weaker, narrower, or less reliable". Quality 3+ would put
  // a charm in the same band as Dual Monitors while costing a different slot.
  for (const def of charms) {
    assert.ok(def.quality <= QUALITY.RELIABLE, `${def.id} is quality ${def.quality}`);
  }
});

// ---------------------------------------------------------------------------
// Hook and adapter wiring
// ---------------------------------------------------------------------------

test('every effect hook named by content is actually registered', () => {
  const check = (id, hook, where) => {
    assert.ok(HOOK_NAMES.has(hook), `${id} references unregistered hook "${hook}" (${where})`);
  };
  for (const def of [...passives, ...charms, ...transformations]) {
    for (const e of def.effects || []) check(def.id, e.hook, 'effects[]');
  }
  for (const def of [...actives, ...cards, ...supplements]) check(def.id, def.effectHook, 'effectHook');
});

test('R-ITM-006: an item whose mechanic a weapon lacks resolves to NO_EFFECT', () => {
  // Declared per item rather than inferred. FALLBACK_STAT is a deliberate exception and
  // should stay rare, because a silent stat substitution is exactly the "faked change"
  // R-WPN-005 forbids.
  const fallbacks = passives.filter((p) => p.modifier?.unsupportedBehavior === 'FALLBACK_STAT');
  assert.ok(fallbacks.length <= 3, `${fallbacks.length} items silently fall back to a stat`);
  for (const def of passives) {
    if (!def.modifier) continue;
    assert.ok(
      ['NO_EFFECT', 'FALLBACK_STAT'].includes(def.modifier.unsupportedBehavior),
      `${def.id} has an unknown unsupportedBehavior`,
    );
  }
});

// ---------------------------------------------------------------------------
// The attack graph under the real catalogue
// ---------------------------------------------------------------------------

function makePlayer(weaponId, passiveIds) {
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

test('every weapon resolves against every single passive without throwing', () => {
  // 14 x 60 = 840 combinations. This is the cheapest possible version of GDD 23.3's
  // combat matrix and it has already earned its keep: a modifier that assumes a field
  // only projectile weapons have will fail here rather than in a player-s run.
  const resolver = new AttackGraphResolver({ registry });
  for (const weapon of registry.all('weapon')) {
    for (const passive of passives) {
      const plan = resolver.resolve(makePlayer(weapon.id, [passive.id]));
      assert.ok(Number.isFinite(plan.damage), `${weapon.id} + ${passive.id} gave a non-finite damage`);
      assert.ok(plan.damage >= 0, `${weapon.id} + ${passive.id} gave negative damage`);
      assert.ok(plan.interval >= CLAMPS.attackInterval.min, `${weapon.id} + ${passive.id} broke the interval clamp`);
    }
  }
});

test('R-PLY-003: holding every passive at once still lands inside the clamps', () => {
  // The pathological case. R-ITM-001 puts no cap on how many passives a player may
  // stack, so "all sixty" is a state the game must survive rather than an absurdity.
  const resolver = new AttackGraphResolver({ registry });
  const all = passives.map((p) => p.id);
  for (const weapon of registry.all('weapon')) {
    const plan = resolver.resolve(makePlayer(weapon.id, all));
    assert.ok(plan.interval >= CLAMPS.attackInterval.min, `${weapon.id} interval ${plan.interval}`);
    assert.ok(plan.interval <= CLAMPS.attackInterval.max, `${weapon.id} interval ${plan.interval}`);
    assert.ok(plan.damage <= CLAMPS.damage.max * 20, `${weapon.id} damage ran away to ${plan.damage}`);
    assert.ok(plan.shots.length <= 32, `${weapon.id} produced ${plan.shots.length} shots, over the budget`);
  }
});

test('R-ITM-008: pickup order never changes the resolved plan', () => {
  // Adapters sort by their ORDER band, not by the order the player collected them, so
  // a reversed inventory must produce an identical plan.
  const resolver = new AttackGraphResolver({ registry });
  const set = ['ITM-010', 'ITM-013', 'ITM-055', 'ITM-011', 'ITM-024', 'ITM-023'];
  const forward = resolver.resolve(makePlayer('WPN-001', set));
  const backward = resolver.resolve(makePlayer('WPN-001', [...set].reverse()));
  assert.equal(forward.damage, backward.damage);
  assert.equal(forward.interval, backward.interval);
  assert.equal(forward.shots.length, backward.shots.length);
});

test('GDD C.2: Three-Hole Punch replaces the Dual Monitors pattern rather than multiplying it', () => {
  // Stated in Appendix C.2 for ITM-055. Without the override the pair would give six
  // shots, which is the single most likely way this system produces a broken build.
  const resolver = new AttackGraphResolver({ registry });
  const dual = resolver.resolve(makePlayer('WPN-001', ['ITM-010'])).shots.length;
  const triple = resolver.resolve(makePlayer('WPN-001', ['ITM-055'])).shots.length;
  const both = resolver.resolve(makePlayer('WPN-001', ['ITM-010', 'ITM-055'])).shots.length;
  assert.equal(dual, 2, 'Dual Monitors should give two shots');
  assert.equal(triple, 3, 'Three-Hole Punch should give three shots');
  assert.equal(both, 3, `together they gave ${both} shots, not three`);
});

// ---------------------------------------------------------------------------
// Actives (GDD 6.5, 9.4, C.3)
// ---------------------------------------------------------------------------

test('C.3: every active declares a recharge its mode can satisfy', () => {
  for (const def of actives) {
    const r = def.recharge;
    if (r.mode === 'ROOMS') assert.ok(r.rooms >= 1, `${def.id} recharges on rooms but names none`);
    if (r.mode === 'TIME') assert.ok(r.seconds >= 1, `${def.id} recharges on time but names none`);
    if (r.mode === 'CREDITS') assert.ok(r.creditsMax >= 1, `${def.id} recharges on credits but names no cap`);
    if (r.mode === 'FED_ITEMS') assert.ok(r.note, `${def.id} is fed items but explains nothing`);
  }
});

test('GDD 6.5: recharge cost tracks effect strength', () => {
  // The room count IS the balance for this class, so the strongest effect in the set
  // must not also be the cheapest. Ctrl+Z rewinds a room; Desk Bell rings a bell.
  const byId = new Map(actives.map((a) => [a.id, a]));
  assert.ok(
    byId.get('ACT-003').recharge.rooms > byId.get('ACT-015').recharge.rooms,
    'Ctrl+Z should cost more rooms than Desk Bell',
  );
  assert.equal(byId.get('ACT-003').recharge.rooms, 12);
  assert.equal(byId.get('ACT-015').recharge.rooms, 2);
});

test('R-BSS-004: no active is a pure boss delete', () => {
  // Task Manager is the only execute in the set, and Appendix C.3 requires it to fall
  // back to a fixed burst against a boss. If that param ever disappears, the execute
  // would apply to bosses and this is where we find out.
  const taskManager = actives.find((a) => a.id === 'ACT-001');
  assert.ok(taskManager.params?.bossBurst > 0, 'ACT-001 lost its fixed boss burst');
  assert.ok(taskManager.params?.threshold <= 0.25, 'ACT-001 execute threshold drifted upward');
});

// ---------------------------------------------------------------------------
// Action Cards (GDD 9.5, 9.6, C.4)
// ---------------------------------------------------------------------------

test('GDD 9.6: Escalation refuses to run in a boss room', () => {
  const escalation = cards.find((c) => c.id === 'CARD-015');
  assert.ok(
    escalation.usageRestrictions.includes('NOT_IN_BOSS_ROOM'),
    'CARD-015 must declare NOT_IN_BOSS_ROOM; the GDD makes this normative',
  );
});

test('C.4: Meeting Minutes cannot repeat itself', () => {
  // The only guard against an infinite card loop. The hook enforces it at runtime; this
  // asserts the hook is the one the card actually points at.
  const minutes = cards.find((c) => c.id === 'CARD-016');
  assert.equal(minutes.effectHook, 'REPEAT_LAST_CARD');
});

test('every card restriction comes from the closed vocabulary', () => {
  const allowed = new Set(['NOT_IN_BOSS_ROOM', 'NOT_IN_SHOP', 'REQUIRES_CLEARED_ROOM', 'NOT_IN_START_ROOM']);
  for (const def of cards) {
    for (const r of def.usageRestrictions) {
      assert.ok(allowed.has(r), `${def.id} declares unknown restriction "${r}"`);
    }
  }
});

// ---------------------------------------------------------------------------
// Supplements (GDD 9.7, C.5, R-CON-003)
// ---------------------------------------------------------------------------

test('C.5: the eight permanent stat Supplements form four equal-and-opposite pairs', () => {
  const byId = new Map(supplements.map((s) => [s.id, s]));
  const pairs = [['SUP-001', 'SUP-002'], ['SUP-003', 'SUP-004'], ['SUP-005', 'SUP-006'], ['SUP-007', 'SUP-008']];
  for (const [up, down] of pairs) {
    const a = byId.get(up);
    const b = byId.get(down);
    assert.equal(a.params.stat, b.params.stat, `${up} and ${down} affect different stats`);
    assert.equal(
      a.params.magnitude, -b.params.magnitude,
      `${up} (${a.params.magnitude}) and ${down} (${b.params.magnitude}) are not equal and opposite`,
    );
    assert.equal(a.valence, 'POSITIVE');
    assert.equal(b.valence, 'NEGATIVE');
    assert.equal(a.permanent, true);
    assert.equal(b.permanent, true);
  }
});

test('GDD 9.7: the gamble is real — negatives are as common as positives', () => {
  // If the good ones outweighed the bad ones, the wrapper shuffle would stop being a
  // decision and become a free reward.
  const weight = (v) => supplements.filter((s) => s.valence === v)
    .reduce((sum, s) => sum + s.baseWeight, 0);
  const positive = weight('POSITIVE');
  const negative = weight('NEGATIVE');
  assert.ok(negative >= positive * 0.8, `positives weigh ${positive}, negatives only ${negative}`);
});

test('C.5: Bad Reaction cannot be lethal', () => {
  const bad = supplements.find((s) => s.id === 'SUP-010');
  assert.equal(bad.effectHook, 'SELF_DAMAGE_NON_LETHAL');
  assert.equal(bad.params.halfUnits, 2, 'C.5 specifies one full icon, which is two half-units');
});

test('R-CON-003: no Supplement leaks its identity through its sprite id', () => {
  // The sprite is the EFFECT icon and is only drawn after identification. If a sprite id
  // ever became the wrapper id, the appearance shuffle would be predictable from data.
  for (const def of supplements) {
    assert.ok(def.spriteId.startsWith('sup_'), `${def.id} has a non-Supplement sprite id`);
    assert.ok(!/wrapper|blister|pack_[a-z]$/.test(def.spriteId), `${def.id} names a wrapper`);
  }
});

// ---------------------------------------------------------------------------
// Transformations (GDD 8.5, C.7)
// ---------------------------------------------------------------------------

test('C.7: every transformation set is actually reachable', () => {
  const passiveIds = new Set(passives.map((p) => p.id));
  for (const def of transformations) {
    const c = def.condition;
    for (const id of c.itemIds || []) {
      assert.ok(passiveIds.has(id), `${def.id} requires ${id}, which does not exist`);
    }
    if (c.mode === 'ANY_N_OF') {
      // A count larger than the candidate list can never complete, which would make the
      // transformation dead content that still shows in the collection.
      assert.ok(
        c.itemIds.length >= c.count,
        `${def.id} needs ${c.count} of only ${c.itemIds.length} items`,
      );
      assert.ok(c.itemIds.length > c.count, `${def.id} is an ALL_OF wearing an ANY_N_OF costume`);
    }
    if (c.mode === 'TAG_COUNT') {
      const tagged = passives.filter((p) => p.tags.includes(c.tag)).length;
      assert.ok(tagged >= c.count, `${def.id} needs ${c.count} ${c.tag} items but only ${tagged} exist`);
    }
  }
});

test('GDD 18.4: every transformation changes the player visibly', () => {
  // The distinction between a transformation and an item interaction is that the player
  // can see it. Without a visual it should have been authored as a synergy override.
  for (const def of transformations) {
    assert.ok(def.playerVisual.length > 20, `${def.id} has no meaningful player visual`);
  }
});

test('GDD 8.5: transformations stay rare relative to the passive catalogue', () => {
  // "Rare, readable milestones". Four against sixty is the shipped ratio; a drift toward
  // one-per-five items would make them ordinary.
  assert.ok(transformations.length * 10 <= passives.length, 'too many transformations to be milestones');
});

// ---------------------------------------------------------------------------
// Pools and reachability (GDD 8.2, R-QA-005)
// ---------------------------------------------------------------------------

test('R-QA-005: every loot pool an item claims is a real pool with stock', () => {
  const valid = new Set(Object.values(POOL));
  const stocked = new Map();
  for (const def of [...passives, ...actives, ...charms]) {
    for (const pool of def.pools) {
      assert.ok(valid.has(pool), `${def.id} claims unknown pool "${pool}"`);
      stocked.set(pool, (stocked.get(pool) ?? 0) + 1);
    }
  }
  // The four pools GDD 8.2 says a normal run must be able to draw from.
  for (const pool of [POOL.SUPPLY_CLOSET, POOL.OFFICE_SUPPLY_SHOP, POOL.SECRET_MAINTENANCE, POOL.RESTRICTED_RECORDS]) {
    assert.ok(stocked.get(pool) >= 3, `${pool} only has ${stocked.get(pool) ?? 0} items`);
  }
});

test('GDD 8.2: the Restricted Records pool really is risk-weighted', () => {
  // The pool exists for "risk-reward, liability, forbidden, and sacrifice-oriented
  // items". If it filled up with ordinary stat items it would stop being a decision.
  const stock = passives.filter((p) => p.pools.includes(POOL.RESTRICTED_RECORDS));
  const risky = stock.filter((p) => p.liability || p.tags.includes('TRADEOFF') || p.tags.includes('LIABILITY'));
  assert.ok(stock.length >= 4, `Restricted Records only stocks ${stock.length} items`);
  assert.ok(
    risky.length / stock.length >= 0.6,
    `only ${risky.length} of ${stock.length} Restricted Records items carry risk`,
  );
});

// ---------------------------------------------------------------------------
// Player-facing copy (GDD 17.3, R-ITM-005, D-016)
// ---------------------------------------------------------------------------

test('R-ITM-005: no pickup phrase exposes a raw number', () => {
  assert.ok(localization, 'no English localization table');
  const RAW = /[%]|[+-]\s*\d|\d+\s*(percent|pct)|x\s*\d*\.\d|\d/;
  for (const def of [...passives, ...actives]) {
    const text = localization.strings[def.pickupPhraseLoc];
    assert.ok(text, `${def.id} has no pickup phrase`);
    assert.ok(!RAW.test(text), `${def.id} pickup phrase leaks a number: "${text}"`);
  }
  for (const def of supplements) {
    const text = localization.strings[def.identifiedPhraseLoc];
    assert.ok(text, `${def.id} has no identified message`);
    assert.ok(!RAW.test(text), `${def.id} identified message leaks a number: "${text}"`);
  }
});

test('D-016: no item copy states how much content exists', () => {
  // The game never announces its own size. "One of eighteen cards" would do exactly
  // that, and it is the kind of line that gets added late by accident.
  const TOTALS = /\b(one|two|three|\d+)\s+of\s+(the\s+)?(\d+|many|all)\b|\ball\s+\d+\b/i;
  for (const def of [...passives, ...actives, ...cards, ...supplements, ...charms, ...transformations]) {
    for (const key of [def.nameLoc, def.pickupPhraseLoc, def.descriptionLoc, def.collectionLoc, def.identifiedPhraseLoc]) {
      if (!key) continue;
      const text = localization.strings[key];
      if (!text) continue;
      assert.ok(!TOTALS.test(text), `${def.id} states a total: "${text}"`);
    }
  }
});

test('GDD H.2: every item records an originality note', () => {
  // The originality review is a shipping gate, and a note added after the fact is worth
  // less than one written while authoring. Requiring it here keeps it honest.
  for (const def of [...passives, ...actives, ...cards, ...supplements, ...charms, ...transformations]) {
    assert.ok(def.originalityNote?.length >= 8, `${def.id} has no originality note`);
    assert.ok(
      !/^(original|n\/a|todo|tbd)\.?$/i.test(def.originalityNote.trim()),
      `${def.id} has a placeholder originality note`,
    );
  }
});
