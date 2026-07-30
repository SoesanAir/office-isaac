/**
 * Progression tests: unlocks, save domains, and challenges.
 *
 * GDD refs: R-QA-004 (save integrity: atomic write, backup recovery,
 *           migration and continue), R-QA-003 (readability under accessibility presets),
 *           16.1-16.8 (progression, unlock families, employee profiles, endings,
 *           challenges), 21.1 (save domains), 21.2 (autosave policy), 21.3 (seed modes and
 *           what each may unlock), R-PRG-001 (an unlock is granted exactly once and is
 *           idempotent across save and reload), R-PRG-002 (an unlock never alters an
 *           in-progress run), R-PRG-003 (an ending is recorded once), R-PRG-004 / D-016
 *           (no total counts), R-TEC-007 (a save from another content version loads or is
 *           rejected cleanly, never half-applied).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { EventBus, EVENTS } from '../src/core/events.js';
import { UnlockService } from '../src/systems/unlocks.js';
import {
  SaveService, DOMAIN, emptyProfile, emptySettings, emptyStatistics,
} from '../src/systems/save.js';

const registry = loadContent({ strict: false });

/** A storage stub that behaves like localStorage, including throwing on demand. */
function fakeStorage({ failOnSet = null } = {}) {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (failOnSet && k.includes(failOnSet)) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
}

function makeUnlocks({ mode = 'NORMAL', profile = emptyProfile() } = {}) {
  const events = new EventBus();
  const run = { mode, unlocksDisabled: false };
  const service = new UnlockService({ registry, events, profile, getRun: () => run });
  return { events, service, profile, run };
}

// ---------------------------------------------------------------------------
// Unlock matching and idempotence
// ---------------------------------------------------------------------------

test('a boss defeat grants the unlock that names that boss, and only that one', () => {
  const { events, profile } = makeUnlocks();
  const granted = [];
  events.on(EVENTS.UNLOCK_GRANTED, (e) => granted.push(e.unlockId));

  events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: true });

  assert.ok(granted.includes('UNLOCK-TEAM_PLAYER_BADGE'), `granted: ${granted.join(', ')}`);
  // A different boss's unlocks must not come along for the ride.
  assert.equal(granted.some((id) => id === 'UNLOCK-CEO_CLEAR_FIRST'), false);
  assert.deepEqual(profile.granted, granted);
});

test('R-PRG-001: an unlock is granted exactly once, however many times it fires', () => {
  const { events, profile } = makeUnlocks();
  let count = 0;
  events.on(EVENTS.UNLOCK_GRANTED, (e) => { if (e.unlockId === 'UNLOCK-TEAM_PLAYER_BADGE') count += 1; });

  for (let i = 0; i < 5; i += 1) events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: true });

  assert.equal(count, 1, `granted ${count} times`);
  assert.equal(profile.granted.filter((id) => id === 'UNLOCK-TEAM_PLAYER_BADGE').length, 1);
});

test('R-PRG-001: idempotence survives a reload, because the guard lives in the profile', () => {
  // The subtle half of R-PRG-001. A run-scoped guard would re-grant everything on the next
  // launch and re-fire every banner the player has already dismissed.
  const first = makeUnlocks();
  first.events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: true });
  assert.equal(first.profile.granted.length >= 1, true);

  // Simulate a reload: brand new service and event bus, same persisted profile.
  const reloaded = makeUnlocks({ profile: first.profile });
  let regranted = 0;
  reloaded.events.on(EVENTS.UNLOCK_GRANTED, () => { regranted += 1; });
  reloaded.events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: true });
  assert.equal(regranted, 0, 'a reload re-granted an unlock the player already had');
});

test('GDD 21.3: an entered seed records progress but grants nothing', () => {
  // A shared seed containing a rare boss must not become a way to hand someone the unlock
  // instead of the run.
  const { events, profile } = makeUnlocks({ mode: 'ENTERED' });
  let granted = 0;
  events.on(EVENTS.UNLOCK_GRANTED, () => { granted += 1; });

  events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-016' });

  assert.equal(granted, 0, 'an entered seed granted an unlock');
  assert.deepEqual(profile.granted, []);
  assert.deepEqual(profile.flags, [], 'an entered seed set a flag');
  // Counters are a record of what was seen, not a reward, so they still accumulate.
  const counters = Object.keys(profile.counters);
  assert.ok(counters.length > 0, 'an entered seed did not record any counter');
});

test('every unlock action type has a handler', () => {
  // An unhandled action is silent content: the unlock fires, the banner shows, and nothing
  // actually changes. The service logs an error for these; this asserts none exist.
  const errors = [];
  const realError = console.error;
  console.error = (msg) => errors.push(String(msg));
  try {
    const { service, profile } = makeUnlocks();
    for (const unlock of registry.all('unlock')) {
      profile.granted.length = 0;
      // force: these two tests probe the action and condition TABLES, not the gates.
      service.grant(unlock, { force: true });
    }
  } finally {
    console.error = realError;
  }
  const unhandled = errors.filter((e) => e.includes('has no handler'));
  assert.deepEqual(unhandled, [], unhandled.join('; '));
});

test('every unlock trigger names an event the bus actually has', () => {
  // trigger.event is a plain string, so the content validator cannot check it. An unknown
  // event means the unlock can never fire — dead content that still shows in the collection.
  const errors = [];
  const realError = console.error;
  console.error = (msg) => errors.push(String(msg));
  try {
    makeUnlocks();
  } finally {
    console.error = realError;
  }
  const unknown = errors.filter((e) => e.includes('unknown event'));
  assert.deepEqual(unknown, [], unknown.join('; '));
});

test('R-PRG-003: an ending is recorded once, and no total is stored', () => {
  const { events, profile } = makeUnlocks();
  const recorder = registry.all('unlock').find((u) => u.actions.some((a) => a.type === 'RECORD_ENDING'));
  assert.ok(recorder, 'no unlock records an ending');

  const { service } = makeUnlocks({ profile });
  service.grant(recorder, { force: true });
  service.grant(recorder, { force: true });
  const ending = recorder.actions.find((a) => a.type === 'RECORD_ENDING').value;
  assert.deepEqual(profile.endings.filter((e) => e === ending), [ending]);

  // D-016: the profile stores what was seen, never how much exists.
  const serialised = JSON.stringify(profile);
  assert.equal(/"total|"of\d|denominator/i.test(serialised), false, 'the profile stores a total');
  assert.equal(events !== null, true);
});

test('R-PRG-002: granting an unlock does not touch the run in progress', () => {
  // TRANSITION_ROUTE records permission for a FUTURE run. Redirecting the current one would
  // change its difficulty mid-flight, which R-PRG-002 forbids.
  const { service, profile, run } = makeUnlocks();
  const before = JSON.stringify(run);
  const router = registry.all('unlock').find((u) => u.actions.some((a) => a.type === 'TRANSITION_ROUTE'));
  if (router) {
    service.grant(router, { force: true });
    const route = router.actions.find((a) => a.type === 'TRANSITION_ROUTE').value;
    assert.ok(profile.routes.includes(route), 'the route was not recorded for a future run');
  }
  assert.equal(JSON.stringify(run), before, 'the unlock mutated the active run');
});

// ---------------------------------------------------------------------------
// Save domains (GDD 21.1, 21.2)
// ---------------------------------------------------------------------------

test('GDD 21.1: each domain round-trips independently', () => {
  const save = new SaveService({ storage: fakeStorage() });
  const profile = emptyProfile();
  profile.flags.push('ALTERNATE_FINANCE_ENABLED');
  profile.counters.ceoClears = 3;

  save.saveProfile(profile);
  save.saveSettings({ ...emptySettings(), grayscale: true });
  save.saveStatistics({ ...emptyStatistics(), runs: 7 });

  assert.deepEqual(save.loadProfile().flags, ['ALTERNATE_FINANCE_ENABLED']);
  assert.equal(save.loadProfile().counters.ceoClears, 3);
  assert.equal(save.loadSettings().grayscale, true);
  assert.equal(save.loadStatistics().runs, 7);
});

test('a save gains defaults for fields that did not exist when it was written', () => {
  const storage = fakeStorage();
  const save = new SaveService({ storage });
  // An old profile missing several of today's fields.
  storage.setItem('officeIsaac:profile', JSON.stringify({
    schemaVersion: 1, contentVersion: 'dev', data: { granted: ['UNLOCK-TEAM_PLAYER_BADGE'] },
  }));

  const loaded = save.loadProfile();
  assert.deepEqual(loaded.granted, ['UNLOCK-TEAM_PLAYER_BADGE']);
  // Merged over the fallback rather than returned raw, so nothing downstream sees undefined.
  assert.deepEqual(loaded.flags, []);
  assert.deepEqual(loaded.profiles, ['PRF-001']);
  assert.equal(typeof loaded.counters, 'object');
});

test('GDD 21.2: a failed write leaves the previous save intact', () => {
  // The whole point of write-temp-then-promote. A quota error mid-save must not destroy
  // what was already there — GDD 21.2 says ordinary failure never costs a valid save.
  const storage = fakeStorage();
  const save = new SaveService({ storage });
  const good = emptyProfile();
  good.flags.push('KEEP_ME');
  save.saveProfile(good);

  // Now make every write throw, and try again with different data.
  const failing = new SaveService({ storage: { ...storage, setItem: () => { throw new Error('QuotaExceededError'); } } });
  const realError = console.error;
  console.error = () => {};
  const ok = failing.saveProfile({ ...emptyProfile(), flags: ['LOSE_ME'] });
  console.error = realError;

  assert.equal(ok, false, 'a failing write reported success');
  assert.deepEqual(save.loadProfile().flags, ['KEEP_ME'], 'the previous save was destroyed');
});

test('a corrupt live save is recovered from its backup', () => {
  const storage = fakeStorage();
  const save = new SaveService({ storage });
  save.saveProfile({ ...emptyProfile(), flags: ['FIRST'] });
  save.saveProfile({ ...emptyProfile(), flags: ['SECOND'] });

  // Corrupt the live key. The backup still holds the previous good value.
  storage.setItem('officeIsaac:profile', '{not json');
  const realError = console.error;
  console.error = () => {};
  const loaded = save.loadProfile();
  console.error = realError;

  assert.deepEqual(loaded.flags, ['FIRST'], 'the backup was not used');
});

test('R-TEC-007: a run from another content version is refused, not half-applied', () => {
  const storage = fakeStorage();
  const written = new SaveService({ storage, contentVersion: 'v1' });
  written.saveRun({ seed: 'OFFICE-TEST-0001', routeStep: 3 });
  assert.ok(written.loadRun(), 'the run did not round-trip within its own version');

  const other = new SaveService({ storage, contentVersion: 'v2' });
  const realError = console.error;
  console.error = () => {};
  const loaded = other.loadRun();
  console.error = realError;
  assert.equal(loaded, null, 'a run from another content version was accepted');

  // The profile is a different domain and must survive the mismatch.
  written.saveProfile({ ...emptyProfile(), flags: ['SURVIVES'] });
  assert.deepEqual(other.loadProfile().flags, ['SURVIVES']);
});

test('GDD 21.2: clearing a run discards only the run', () => {
  const save = new SaveService({ storage: fakeStorage() });
  save.saveProfile({ ...emptyProfile(), flags: ['KEEP'] });
  save.saveRun({ seed: 'OFFICE-TEST-0002' });
  assert.equal(save.hasRun(), true);

  save.clearRun();

  assert.equal(save.hasRun(), false);
  assert.equal(save.loadRun(), null);
  assert.deepEqual(save.loadProfile().flags, ['KEEP'], 'clearing the run took the profile with it');
});

test('the service survives storage being unavailable entirely', () => {
  // Private browsing and a full quota both make localStorage throw on write. Falling back to
  // memory loses persistence, which is bad; crashing on the first autosave is worse.
  const hostile = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('SecurityError'); },
    removeItem: () => {},
  };
  const realError = console.error;
  console.error = () => {};
  const save = new SaveService({ storage: hostile });
  const ok = save.saveProfile(emptyProfile());
  const loaded = save.loadProfile();
  console.error = realError;

  assert.equal(ok, false);
  // Still returns a usable profile rather than throwing into the caller.
  assert.deepEqual(loaded.profiles, ['PRF-001']);
});

// ---------------------------------------------------------------------------
// Content wiring
// ---------------------------------------------------------------------------

test('GDD 16.6: every profile an unlock grants exists, and PRF-001 needs no unlock', () => {
  for (const unlock of registry.all('unlock')) {
    for (const action of unlock.actions) {
      if (action.type !== 'UNLOCK_PROFILE') continue;
      assert.ok(registry.get('profile', action.value), `${unlock.id} unlocks missing ${action.value}`);
    }
  }
  // GDD 16.2: a fresh save is playable, so the starting profile is never gated.
  assert.deepEqual(emptyProfile().profiles, ['PRF-001']);
  assert.ok(registry.get('profile', 'PRF-001'));
});

test('every ending an unlock records exists', () => {
  for (const unlock of registry.all('unlock')) {
    for (const action of unlock.actions) {
      if (action.type !== 'RECORD_ENDING') continue;
      assert.ok(registry.get('ending', action.value), `${unlock.id} records missing ${action.value}`);
    }
  }
});

test('every floor an unlock adds to a pool exists', () => {
  for (const unlock of registry.all('unlock')) {
    for (const action of unlock.actions) {
      if (action.type !== 'ADD_TO_POOL') continue;
      const content = action.value?.content;
      if (!content || !content.startsWith('FLOOR-')) continue;
      assert.ok(registry.get('floor', content), `${unlock.id} adds missing ${content}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Wiring into the running game
// ---------------------------------------------------------------------------

/**
 * Boot a game.
 *
 * `mode` matters and is easy to get wrong: Run.start treats any explicitly supplied seed as
 * an ENTERED seed, which GDD 21.3 correctly bars from granting unlocks. So a test that wants
 * to watch an unlock land has to ask for NORMAL mode while still pinning the seed.
 */
async function bootGame(seed, mode = 'NORMAL') {
  const { installDomShim, makeCanvas } = await import('./helpers/canvas.js');
  installDomShim();
  globalThis.__OI_NO_AUTOBOOT = true;
  const { Game } = await import('../src/main.js');
  const game = new Game(makeCanvas());
  game.start({ seed, mode });
  return game;
}

test('Game.start honours its options', async () => {
  // It used to take no arguments and silently discard whatever it was passed, so every
  // caller asking for a specific seed got a random one — including the tests that thought
  // they were reproducing a layout.
  const a = await bootGame('OFFICE-SEEDHONOUR-0001');
  const b = await bootGame('OFFICE-SEEDHONOUR-0001');
  assert.equal(a.run.seed, b.run.seed);
  assert.deepEqual([...a.run.floor.nodes.keys()], [...b.run.floor.nodes.keys()]);
});

test('a run starts with the profile unlock flags already applied', async () => {
  // R-PRG-002: unlocks gate what generation may use, so they must be in place before the
  // floor exists. There is deliberately no path that applies them to a run in progress.
  const game = await bootGame('OFFICE-FLAGS-0001');
  game.profileSave.flags.push('ALTERNATE_FINANCE_ENABLED');
  game.profileSave.granted.push('UNLOCK-ALTERNATE_FINANCE');

  game.start({ seed: 'OFFICE-FLAGS-0002' });
  assert.equal(game.run.unlockFlags.has('ALTERNATE_FINANCE_ENABLED'), true);
  assert.equal(game.run.unlockFlags.has('UNLOCK-ALTERNATE_FINANCE'), true);
});

test('GDD 21.2: clearing a room persists progress and the resumable run', async () => {
  const game = await bootGame('OFFICE-AUTOSAVE-0001');
  const before = game.statistics.roomsCleared;

  game.events.emit(EVENTS.ROOM_CLEARED, { room: game.run.room, wave: 0 });
  assert.equal(game.statistics.roomsCleared, before + 1, 'the clear was not counted');
  assert.equal(game.save.loadStatistics().roomsCleared, before + 1, 'statistics did not reach storage');

  game.events.emit(EVENTS.ROOM_ENTERED, { room: game.run.room });
  assert.equal(game.save.hasRun(), true, 'entering a room did not write a resumable run');
});

test('GDD 21.2: a finished run is not left on disk to be resumed', async () => {
  // Leaving it would offer the player a continue that drops them into a dead run.
  const game = await bootGame('OFFICE-RUNEND-0001');
  game.events.emit(EVENTS.ROOM_ENTERED, { room: game.run.room });
  assert.equal(game.save.hasRun(), true);

  game.events.emit(EVENTS.RUN_ENDED, { reason: 'DEATH', seed: game.run.seed });

  assert.equal(game.save.hasRun(), false, 'a finished run is still resumable');
  assert.equal(game.statistics.runs >= 1, true);
  assert.equal(game.statistics.deaths >= 1, true);
  // The profile is a separate domain and must survive.
  assert.ok(game.save.loadProfile().profiles.includes('PRF-001'));
});

test('GDD 21.3: a seed entered by the player grants no unlocks in the real game', async () => {
  // End-to-end confirmation of the rule, and the reason bootGame takes a mode: supplying a
  // seed makes the run an ENTERED one, so a shared seed cannot hand someone an unlock.
  const game = await bootGame('OFFICE-ENTERED-0001', 'ENTERED');
  game.events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: true });
  assert.deepEqual(game.profileSave.granted, [], 'an entered seed granted an unlock');
});

test('an unlock earned in play reaches storage immediately', async () => {
  // The one event that must not wait for the next autosave: losing it would ask the player
  // to earn the same thing twice, which breaks R-PRG-001 from their side.
  const game = await bootGame('OFFICE-UNLOCKSAVE-0001');
  game.events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: true });

  const persisted = game.save.loadProfile();
  assert.ok(persisted.granted.includes('UNLOCK-TEAM_PLAYER_BADGE'), `granted: ${persisted.granted.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Challenges (GDD 16.8)
// ---------------------------------------------------------------------------

test('GDD 16.8: every challenge names content that exists', () => {
  const challenges = registry.all('challenge');
  assert.ok(challenges.length >= 6, `only ${challenges.length} challenges`);
  for (const c of challenges) {
    assert.ok(registry.get('profile', c.profile), `${c.id} uses missing profile ${c.profile}`);
    assert.ok(registry.get('route', c.route), `${c.id} uses missing route ${c.route}`);
    if (c.rules.forcedWeapon) {
      assert.ok(registry.get('weapon', c.rules.forcedWeapon), `${c.id} forces missing weapon`);
    }
    for (const id of c.rules.forcedPassives) {
      assert.ok(registry.get('passive', id), `${c.id} forces missing passive ${id}`);
    }
    if (c.completionUnlock) {
      assert.ok(registry.get('unlock', c.completionUnlock), `${c.id} awards missing unlock`);
    }
  }
});

test('GDD 16.8: no challenge relies on a hidden failure condition', () => {
  // "They may not rely on hidden arbitrary failure conditions." Every condition has to name
  // something the player can see: death, a timer, damage, a route, or a named resource.
  const legible = /death|timer|damage|route|resource|credit|access card|toner|composure/i;
  for (const c of registry.all('challenge')) {
    assert.ok(c.rules.failureConditions.length > 0, `${c.id} states no failure condition`);
    for (const cond of c.rules.failureConditions) {
      assert.ok(legible.test(cond), `${c.id}: "${cond}" is not a legible condition`);
    }
  }
});

test('GDD 21.3: a challenge does not enable general unlocks', () => {
  // Otherwise challenges become the fastest route to everything, since each one is a short
  // predefined run.
  for (const c of registry.all('challenge')) {
    assert.equal(c.unlocksEnabled, false, `${c.id} enables general unlocks`);
  }
});

test('every challenge is described in words the player can read before starting', () => {
  const loc = registry.all('localization').find((t) => t.language === 'en');
  for (const c of registry.all('challenge')) {
    const name = loc.strings[c.nameLoc];
    const desc = loc.strings[c.descriptionLoc];
    assert.ok(name, `${c.id} has no name`);
    assert.ok(desc && desc.length > 30, `${c.id} has no meaningful description`);
    // D-016: no copy states how much content exists.
    assert.equal(/\bone of\s+\d|\ball\s+\d+\b/i.test(desc), false, `${c.id} states a total`);
  }
});

test('an unlock condition gates the grant, not just the trigger', () => {
  // The defect this suite originally hid. UNLOCK-TEAM_PLAYER_BADGE triggers on ANY boss
  // defeat and carries `condition: BOSS_DEFEATED_WITHOUT_DAMAGE` — the condition is the whole
  // requirement. Ignoring it meant three GDD-gated profiles unlocked on the first boss kill
  // and the first death.
  const damaged = makeUnlocks();
  damaged.events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: false });
  assert.deepEqual(damaged.profile.granted, [], 'a damaged kill still granted the badge');

  const clean = makeUnlocks();
  clean.events.emit(EVENTS.BOSS_DEFEATED, { bossId: 'BSS-001', noDamageTaken: true });
  assert.ok(clean.profile.granted.includes('UNLOCK-TEAM_PLAYER_BADGE'));
});

test('every condition hook named by content has an implementation', () => {
  // An unimplemented hook refuses to grant rather than granting free, so this failing means
  // an unlock is unreachable — not that the player got something they should not have.
  const errors = [];
  const realError = console.error;
  console.error = (msg) => errors.push(String(msg));
  try {
    const { service, profile } = makeUnlocks();
    for (const unlock of registry.all('unlock')) {
      profile.granted.length = 0;
      // force: these two tests probe the action and condition TABLES, not the gates.
      service.grant(unlock, { force: true });
    }
  } finally {
    console.error = realError;
  }
  const unknown = errors.filter((e) => e.includes('unknown condition hook'));
  assert.deepEqual(unknown, [], unknown.join('; '));
});

test('a partly-satisfied department condition does not grant early', () => {
  // "Defeat every IT boss at least once" must mean every one of them.
  const { service, profile } = makeUnlocks();
  const itBosses = registry.all('boss').filter((b) => b.departments.includes('IT')).map((b) => b.id);
  assert.ok(itBosses.length > 1, 'IT has too few bosses to test partial progress');

  const unlock = registry.get('unlock', 'UNLOCK-PROFILE_IT_SPECIALIST');
  profile.bossesDefeated = itBosses.slice(0, -1);
  assert.equal(service.grant(unlock), false, 'granted with one IT boss still standing');

  profile.bossesDefeated = itBosses;
  assert.equal(service.grant(unlock), true, 'did not grant once every IT boss was defeated');
});
