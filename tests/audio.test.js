/**
 * Audio engine tests.
 *
 * GDD refs: 19.1 (audio direction), 19.2 (the six mix bands; a lower band ducks the higher
 *           ones and never the reverse), 19.3 (music layers gate in as the run escalates),
 *           R-AUD-001 (no binary audio assets — every sound is a recipe), R-AUD-002 (a
 *           high-cadence sound needs variation and a concurrency cap), R-AUD-003 (every
 *           audio-only cue has a caption), 17.6 (accessibility settings).
 *
 * The AudioContext is a recording stub, so the real synthesis path runs and is inspectable:
 * these assert which nodes were built and how they were connected, not what it sounds like.
 * The alternative — mocking the engine — would test nothing, since the whole risk here is in
 * the graph construction.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { EventBus, EVENTS } from '../src/core/events.js';
import { AudioEngine } from '../src/audio/engine.js';
import { emptySettings } from '../src/systems/save.js';

const registry = loadContent({ strict: false });

/** A recording AudioContext. Every node records what was done to it. */
function fakeContext() {
  const log = { oscillators: [], buffers: [], gains: [], filters: [], started: 0, stopped: 0 };

  const param = () => {
    const p = {
      value: 0,
      calls: [],
      setValueAtTime(v, t) { p.value = v; p.calls.push(['set', v, t]); return p; },
      linearRampToValueAtTime(v, t) { p.calls.push(['linear', v, t]); return p; },
      exponentialRampToValueAtTime(v, t) { p.calls.push(['exp', v, t]); return p; },
      cancelScheduledValues(t) { p.calls.push(['cancel', t]); return p; },
    };
    return p;
  };

  const node = (extra = {}) => ({
    connect() {}, disconnect() {}, ...extra,
  });

  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running',
    destination: node(),
    createGain() {
      const g = node({ gain: param() });
      log.gains.push(g);
      return g;
    },
    createBiquadFilter() {
      const f = node({ type: 'lowpass', frequency: param(), Q: param() });
      log.filters.push(f);
      return f;
    },
    createOscillator() {
      const o = node({
        type: 'sine',
        frequency: param(),
        detune: param(),
        start() { log.started += 1; },
        stop() { log.stopped += 1; },
        onended: null,
      });
      log.oscillators.push(o);
      return o;
    },
    createBuffer(channels, frames, rate) {
      const data = new Float32Array(frames);
      const b = { length: frames, sampleRate: rate, getChannelData: () => data };
      log.buffers.push(b);
      return b;
    },
    createBufferSource() {
      const s = node({
        buffer: null,
        start() { log.started += 1; },
        stop() { log.stopped += 1; },
        onended: null,
      });
      log.oscillators.push(s);
      return s;
    },
    suspend() { ctx.state = 'suspended'; },
    resume() { ctx.state = 'running'; },
  };
  return { ctx, log };
}

function makeEngine({ withContext = true, settings = emptySettings() } = {}) {
  const events = new EventBus();
  const { ctx, log } = fakeContext();
  if (withContext) globalThis.AudioContext = function AudioContextStub() { return ctx; };
  else delete globalThis.AudioContext;
  const engine = new AudioEngine({ registry, events, settings, loc: (k) => `[${k}]` });
  if (withContext) engine.unlock();
  return { engine, events, ctx, log, settings };
}

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

test('R-AUD-001: every sound is built from a recipe, with no asset fetch', () => {
  // Synthesis, not playback. If this ever became a file load, the repository would stop
  // being text-only and diffable.
  const { engine, log } = makeEngine();
  assert.equal(engine.play('SFX-TELEGRAPH_GENERIC'), true);
  assert.equal(log.oscillators.length, 1, 'no voice was created');
  assert.ok(log.gains.length >= 1, 'no envelope was created');
  assert.equal(log.started, 1);
});

test('every authored sound recipe actually plays', () => {
  // 90-odd recipes, each exercising the real graph builder. A recipe with an unsupported
  // voice or an impossible envelope fails here rather than in the one room that uses it.
  const { engine } = makeEngine();
  const failed = [];
  for (const def of registry.all('sound')) {
    // Reset the concurrency ledger so a cap does not mask a genuine failure.
    engine.playing.clear();
    if (!engine.play(def.id)) failed.push(def.id);
  }
  assert.deepEqual(failed, [], `${failed.length} recipes did not play`);
});

test('R-AUD-002: a sound refuses to exceed its own concurrency cap', () => {
  // The keyboard at ten shots a second is exactly this case. Refusing is audible as "it did
  // not retrigger", which is far better than forty copies summing into a buzz.
  const { engine } = makeEngine();
  const def = registry.all('sound').find((s) => s.maxConcurrent <= 4 && s.voice !== 'NOISE');
  assert.ok(def, 'no capped sound to test');

  let played = 0;
  for (let i = 0; i < def.maxConcurrent + 5; i += 1) {
    if (engine.play(def.id)) played += 1;
  }
  assert.equal(played, def.maxConcurrent, `played ${played}, cap is ${def.maxConcurrent}`);
});

test('R-AUD-002: a repeated sound is varied rather than bit-identical', () => {
  // Detune is randomised per play, so a rapid-fire weapon does not phase against itself.
  const { engine, log } = makeEngine();
  const def = registry.all('sound').find((s) => s.detuneCents > 0 && s.voice !== 'NOISE');
  assert.ok(def, 'no detuned sound to test');

  const detunes = new Set();
  for (let i = 0; i < 6; i += 1) {
    engine.playing.clear();
    engine.play(def.id);
  }
  for (const osc of log.oscillators) detunes.add(osc.detune.value);
  assert.ok(detunes.size > 1, 'every play used an identical detune');
});

test('R-AUD-003: a captioned cue emits its caption', () => {
  const { engine, events } = makeEngine();
  const captions = [];
  events.on(EVENTS.CAPTION_SHOWN, (e) => captions.push(e));

  const def = registry.all('sound').find((s) => s.captionLoc);
  assert.ok(def, 'no captioned sound exists');
  engine.play(def.id);

  assert.equal(captions.length, 1);
  assert.equal(captions[0].key, def.captionLoc);
  assert.equal(captions[0].text, `[${def.captionLoc}]`, 'the caption was not localised');
});

test('R-AUD-003: the caption fires even when no audio is available at all', () => {
  // The accessibility contract cannot depend on the mix, on a free voice, or on audio having
  // started. A player with sound off gets the same information — that is the whole point.
  const { engine, events } = makeEngine({ withContext: false });
  const captions = [];
  events.on(EVENTS.CAPTION_SHOWN, (e) => captions.push(e));

  const def = registry.all('sound').find((s) => s.captionLoc);
  assert.equal(engine.ready, false, 'the fixture unexpectedly has audio');
  assert.equal(engine.play(def.id), false, 'claimed to play without a context');
  assert.equal(captions.length, 1, 'the caption was skipped when audio was unavailable');
});

test('R-AUD-003: a caption still fires when the sound is refused by its cap', () => {
  const { engine, events } = makeEngine();
  const def = registry.all('sound').find((s) => s.captionLoc && s.maxConcurrent <= 4);
  assert.ok(def, 'no captioned capped sound to test');

  const captions = [];
  events.on(EVENTS.CAPTION_SHOWN, (e) => captions.push(e));
  for (let i = 0; i < def.maxConcurrent + 3; i += 1) engine.play(def.id);

  assert.equal(captions.length, def.maxConcurrent + 3, 'captions were dropped with the audio');
});

test('captions can be turned off without silencing the game', () => {
  const settings = { ...emptySettings(), captions: false };
  const { engine, events } = makeEngine({ settings });
  let captions = 0;
  events.on(EVENTS.CAPTION_SHOWN, () => { captions += 1; });

  const def = registry.all('sound').find((s) => s.captionLoc);
  assert.equal(engine.play(def.id), true, 'disabling captions silenced the sound');
  assert.equal(captions, 0);
});

test('GDD 19.2: a high-priority cue ducks the music, and a low one does not', () => {
  const { engine } = makeEngine();
  const musicGain = engine.musicBus.gain;

  const low = registry.all('sound').find((s) => s.mixPriority >= 4);
  if (low) {
    const before = musicGain.calls.length;
    engine.play(low.id);
    assert.equal(musicGain.calls.length, before, `band ${low.mixPriority} ducked the music`);
  }

  const high = registry.all('sound').find((s) => s.mixPriority <= 2);
  assert.ok(high, 'no high-priority sound exists');
  const before = musicGain.calls.length;
  engine.play(high.id);
  assert.ok(musicGain.calls.length > before, `band ${high.mixPriority} did not duck the music`);
});

test('an unknown sound is reported rather than silently dropped', () => {
  const { engine } = makeEngine();
  const errors = [];
  const realError = console.error;
  console.error = (m) => errors.push(String(m));
  try {
    assert.equal(engine.play('SFX-DOES_NOT_EXIST'), false);
  } finally {
    console.error = realError;
  }
  assert.equal(errors.length, 1, 'a missing recipe was dropped silently');
});

// ---------------------------------------------------------------------------
// Music (GDD 19.3)
// ---------------------------------------------------------------------------

test('every authored track schedules notes', () => {
  const { engine, ctx, log } = makeEngine();
  for (const def of registry.all('music')) {
    engine.stopMusic();
    assert.equal(engine.playMusic(def.id), true, `${def.id} would not start`);
    const before = log.oscillators.length;
    ctx.currentTime = 0;
    engine.nextNoteTime = 0;
    engine.update();
    assert.ok(log.oscillators.length > before, `${def.id} scheduled nothing`);
  }
});

test('GDD 19.3: layers gate in as the run escalates', () => {
  const { engine, ctx, log } = makeEngine();
  engine.playMusic('MUS-OPEN_OFFICE');

  const countOverOneBar = () => {
    const before = log.oscillators.length;
    ctx.currentTime = 0;
    engine.nextNoteTime = 0;
    engine.musicStep = 0;
    engine.update();
    return log.oscillators.length - before;
  };

  engine.setIntensity('ALWAYS');
  const calm = countOverOneBar();
  engine.setIntensity('COMBAT');
  const combat = countOverOneBar();
  engine.setIntensity('LOW_HEALTH');
  const desperate = countOverOneBar();

  assert.ok(combat > calm, `combat added no layers (${calm} -> ${combat})`);
  assert.ok(desperate >= combat, `low health lost layers (${combat} -> ${desperate})`);
});

test('switching to the track already playing is a no-op', () => {
  // Room re-entry re-emits the department music, and restarting the bar every time would make
  // the score stutter on every door.
  const { engine } = makeEngine();
  engine.playMusic('MUS-IT');
  engine.musicStep = 7;
  engine.playMusic('MUS-IT');
  assert.equal(engine.musicStep, 7, 'the bar restarted');
});

test('the scheduler is bounded, so a long stall cannot queue thousands of notes', () => {
  const { engine, ctx, log } = makeEngine();
  engine.playMusic('MUS-OPEN_OFFICE');
  engine.nextNoteTime = 0;
  // Simulate the tab being backgrounded for a minute.
  ctx.currentTime = 60;
  engine.update();
  // R-TEC-003: bounded per-frame cost. 64 steps is the guard; each step schedules at most
  // one note per active layer.
  assert.ok(log.oscillators.length < 64 * 8, `queued ${log.oscillators.length} notes`);
});

// ---------------------------------------------------------------------------
// Settings (GDD 17.6)
// ---------------------------------------------------------------------------

test('volume settings reach the graph', () => {
  const settings = { ...emptySettings(), masterVolume: 0.5, musicVolume: 0.25, sfxVolume: 0.75 };
  const { engine } = makeEngine({ settings });
  assert.equal(engine.master.gain.value, 0.5);
  assert.equal(engine.musicBus.gain.value, 0.25);
  assert.equal(engine.sfxBus.gain.value, 0.75);

  settings.masterVolume = 0;
  engine.applySettings();
  assert.equal(engine.master.gain.value, 0, 'muting did not reach the master bus');
});

test('the engine is inert but safe with no audio support at all', () => {
  const { engine } = makeEngine({ withContext: false });
  assert.equal(engine.ready, false);
  // None of these may throw: a browser without audio still has to be playable.
  assert.equal(engine.play('SFX-TELEGRAPH_GENERIC'), false);
  assert.equal(engine.playMusic('MUS-IT'), true, 'track selection should still be recorded');
  engine.update();
  engine.applySettings();
  engine.setIntensity('BOSS');
  engine.suspend();
  engine.resume();
});
