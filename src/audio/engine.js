/**
 * Audio engine: turns the procedural recipes in content/audio into sound.
 *
 * GDD refs: 19.1 (audio direction: the office is the instrument), 19.2 (the six mix
 *           priority bands, where a lower band ducks a higher one and never the reverse),
 *           19.3 (music layers gate in as the run escalates), 19.4 (localised text ids),
 *           R-AUD-001 (no binary audio assets in the repository — every sound is a recipe),
 *           R-AUD-002 (a high-cadence sound needs variation and a concurrency cap, or it
 *           becomes a buzz), R-AUD-003 (every audio-only cue has a caption),
 *           R-TEC-003 (bounded per-frame cost), 17.6 (accessibility settings).
 *
 * ## Why synthesis rather than files
 *
 * R-AUD-001 keeps the repository text-only, so every sound here is built from an oscillator,
 * an envelope, and optionally a filter, described by data in content/audio/sounds.js. That
 * has a pleasant side effect: a sound can be *varied* per play for free (see `detuneCents`),
 * which is exactly what R-AUD-002 asks for.
 *
 * ## The three rules that shape this file
 *
 * **Concurrency caps are per sound, not global.** A keyboard firing ten times a second is
 * the single most likely thing to turn into a buzz, so each recipe declares `maxConcurrent`
 * and the engine refuses beyond it rather than mixing forty copies. Refusing is audible as
 * "the sound did not retrigger", which is far better than the alternative.
 *
 * **Ducking runs one direction.** GDD 19.2: a lower priority band ducks the higher ones.
 * Band 1 is a boss telegraph and band 6 is ambience, so a telegraph is never buried under
 * footsteps — the mix is a safety feature, not a taste one.
 *
 * **Captions are not optional.** R-AUD-003 requires every audio-only cue to have a caption,
 * and the engine emits one whenever a recipe declares `captionLoc`. A player with sound off
 * gets the same information, which is the whole point.
 *
 * ## Headless
 *
 * There is no AudioContext under Node. Every entry point checks `this.ready` and returns
 * quietly, so the same code path runs in tests and the caption events still fire — which is
 * how the caption contract is testable at all.
 */

import { EVENTS } from '../core/events.js';

/** GDD 19.2's bands. A sound in a lower band ducks everything numerically above it. */
const DUCK_AMOUNT = 0.55;
const DUCK_SECONDS = 0.18;

/** Sixteen steps per music bar, matching the pattern length in content/audio/music.js. */
const STEPS_PER_BAR = 16;

/** How far ahead the music scheduler queues notes. Long enough to survive a frame spike. */
const SCHEDULE_AHEAD_SECONDS = 0.25;

/** Semitone offsets for the note names music definitions use in `key`. */
const NOTE_OFFSET = Object.freeze({
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
});

/** Middle-A reference. Everything is derived from this so a key change is one number. */
const A4 = 440;

/** MIDI-ish semitone to frequency. */
const freqOf = (semitonesFromA4) => A4 * (2 ** (semitonesFromA4 / 12));

export class AudioEngine {
  /**
   * @param {object} deps
   * @param {object} deps.registry content registry
   * @param {import('../core/events.js').EventBus} deps.events
   * @param {object} deps.settings mutable settings save domain
   * @param {(key: string) => string} [deps.loc] localiser, for caption text
   */
  constructor({ registry, events, settings, loc = (k) => k }) {
    this.registry = registry;
    this.events = events;
    this.settings = settings;
    this.loc = loc;

    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.ready = false;

    /** soundId -> count currently sounding, for R-AUD-002's caps. */
    this.playing = new Map();
    /** Ducking state per band, so a telegraph can hold the mix down while it rings. */
    this.duckUntil = 0;

    /** Music scheduler state. */
    this.music = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.intensity = 'ALWAYS';

    this.#subscribe();
  }

  #subscribe() {
    this.events.on(EVENTS.SFX_REQUESTED, (e) => this.play(e?.sound, e));
  }

  /**
   * Create the AudioContext.
   *
   * Must be called from a user gesture: every browser refuses to start audio otherwise, and
   * a context created at page load starts suspended and stays that way. So this is wired to
   * the first key press rather than to boot.
   */
  unlock() {
    if (this.ready) return true;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      // `ready` is set BEFORE applySettings, because applySettings early-returns on
      // !ready. With the order reversed the graph was built at gain zero and the game was
      // silent no matter what the settings said — the volumes were never applied once.
      this.ready = true;
      this.applySettings();
      return true;
    } catch (err) {
      // A refused or unavailable context must not stop the game. Silent is playable.
      console.error(`Audio unavailable: ${err.message}`);
      return false;
    }
  }

  /** Push the current settings into the graph (GDD 17.6). */
  applySettings() {
    if (!this.ready) return;
    const s = this.settings;
    this.master.gain.value = s.masterVolume ?? 0.8;
    this.sfxBus.gain.value = s.sfxVolume ?? 0.9;
    this.musicBus.gain.value = s.musicVolume ?? 0.6;
  }

  suspend() { if (this.ready) this.ctx.suspend?.(); }
  resume() { if (this.ready) this.ctx.resume?.(); }

  // -------------------------------------------------------------------------
  // Sound effects
  // -------------------------------------------------------------------------

  /**
   * Play one sound by id.
   *
   * Returns false when nothing sounded — unknown id, at its concurrency cap, or no audio
   * context. The caption still fires in every case except an unknown id, because a player
   * with sound off must not depend on whether a voice happened to be free (R-AUD-003).
   */
  play(soundId, payload = {}) {
    if (!soundId) return false;
    const def = this.registry.get('sound', soundId);
    if (!def) {
      // A missing recipe is a content defect and silently dropping it hides the defect.
      console.error(`Unknown sound "${soundId}"; nothing played.`);
      return false;
    }

    // The caption comes first and unconditionally. R-AUD-003 is an accessibility contract,
    // so it must not depend on voice availability, the mix, or whether audio started.
    if (def.captionLoc && this.settings.captions !== false) {
      this.events.emit(EVENTS.CAPTION_SHOWN, {
        key: def.captionLoc,
        text: this.loc(def.captionLoc),
        priority: def.mixPriority,
      });
    }

    if (!this.ready) return false;

    // R-AUD-002: refuse past the cap rather than stacking copies. A keyboard at ten shots a
    // second is exactly the case this exists for, and "did not retrigger" beats "buzz".
    const live = this.playing.get(soundId) ?? 0;
    if (live >= def.maxConcurrent) return false;

    try {
      this.#synthesise(def, payload);
      return true;
    } catch (err) {
      console.error(`Failed to play "${soundId}": ${err.message}`);
      return false;
    }
  }

  #synthesise(def, payload) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = def.duration;
    const attack = Math.min(def.attack ?? 0.01, duration * 0.5);
    const decay = Math.max(0.01, def.decay ?? duration - attack);

    const gainNode = ctx.createGain();
    // Bands 1-2 duck the rest of the mix while they ring (GDD 19.2). A boss telegraph is
    // information the player cannot afford to miss.
    if (def.mixPriority <= 2) this.#duck(now, duration);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(def.gain, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    let tail = gainNode;
    if (def.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = def.filter.type;
      filter.frequency.value = def.filter.frequency;
      if (def.filter.q !== undefined) filter.Q.value = def.filter.q;
      gainNode.connect(filter);
      tail = filter;
    }
    tail.connect(this.sfxBus);

    const source = this.#makeVoice(def, now, duration, payload);
    source.connect(gainNode);

    const id = def.id;
    this.playing.set(id, (this.playing.get(id) ?? 0) + 1);
    source.onended = () => this.playing.set(id, Math.max(0, (this.playing.get(id) ?? 1) - 1));
    source.start(now);
    source.stop(now + duration);
  }

  /** Build the oscillator or noise burst a recipe's `voice` asks for. */
  #makeVoice(def, now, duration, payload) {
    const ctx = this.ctx;

    if (def.voice === 'NOISE') {
      // A short noise buffer, generated per play. Cheap at these durations, and it means
      // two impacts are never bit-identical — the free variation R-AUD-002 wants.
      const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      return node;
    }

    const osc = ctx.createOscillator();
    // CLICK and PLUCK are envelope shapes rather than waveforms; the recipe's envelope
    // already produces them, so they map onto the nearest real oscillator type.
    const TYPE = {
      SQUARE: 'square', SAW: 'sawtooth', SINE: 'sine', TRIANGLE: 'triangle',
      FM: 'sine', PLUCK: 'triangle', CLICK: 'square',
    };
    osc.type = TYPE[def.voice] ?? 'sine';

    const base = payload.frequency ?? def.frequency ?? 440;
    osc.frequency.setValueAtTime(base, now);
    if (def.frequencyEnd !== undefined) {
      // Exponential, because pitch is perceived logarithmically — a linear sweep sounds
      // like it slows down at the top.
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, def.frequencyEnd), now + duration);
    }
    if (def.detuneCents) {
      // Random within the declared range, so a repeated sound never phases against itself.
      osc.detune.setValueAtTime((Math.random() * 2 - 1) * def.detuneCents, now);
    }
    return osc;
  }

  /** Hold the music bus down briefly so a high-priority cue cuts through (GDD 19.2). */
  #duck(now, seconds) {
    const until = now + seconds;
    if (until <= this.duckUntil) return;
    this.duckUntil = until;
    const bus = this.musicBus.gain;
    const target = (this.settings.musicVolume ?? 0.6) * DUCK_AMOUNT;
    bus.cancelScheduledValues(now);
    bus.linearRampToValueAtTime(target, now + 0.02);
    bus.linearRampToValueAtTime(this.settings.musicVolume ?? 0.6, until + DUCK_SECONDS);
  }

  // -------------------------------------------------------------------------
  // Music (GDD 19.3)
  // -------------------------------------------------------------------------

  /** Start (or switch to) a track. Passing the same id is a no-op, so re-entry is safe. */
  playMusic(musicId) {
    const def = this.registry.get('music', musicId);
    if (!def) {
      if (musicId) console.error(`Unknown music "${musicId}".`);
      return false;
    }
    if (this.music?.id === def.id) return true;
    this.music = def;
    this.musicStep = 0;
    this.nextNoteTime = this.ready ? this.ctx.currentTime : 0;
    return true;
  }

  stopMusic() {
    this.music = null;
  }

  /**
   * Which layers are audible right now.
   *
   * GDD 19.3 gates layers on run state rather than crossfading whole tracks, so a room
   * getting dangerous *adds* a percussion line to the music already playing. That is why the
   * layers share a key and a bar length.
   */
  setIntensity(level) {
    this.intensity = level;
  }

  #layerActive(layer) {
    if (layer.activeFrom === 'ALWAYS') return true;
    if (layer.activeFrom === 'COMBAT') return this.intensity !== 'ALWAYS';
    if (layer.activeFrom === 'BOSS') return this.intensity === 'BOSS' || this.intensity === 'LOW_HEALTH';
    if (layer.activeFrom === 'LOW_HEALTH') return this.intensity === 'LOW_HEALTH';
    return false;
  }

  /**
   * Advance the music scheduler.
   *
   * Called once a frame, but it does not schedule per frame: it queues every step that falls
   * inside the lookahead window. Frame timing and audio timing are independent clocks, and
   * scheduling on the frame clock is what makes browser music stutter.
   */
  update() {
    if (!this.ready || !this.music) return;
    const secondsPerStep = 60 / this.music.bpm / (STEPS_PER_BAR / 4);
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD_SECONDS;
    // Bounded: a long stall must not queue thousands of notes trying to catch up.
    let guard = 64;
    while (this.nextNoteTime < horizon && guard > 0) {
      this.#scheduleStep(this.musicStep, this.nextNoteTime);
      this.musicStep = (this.musicStep + 1) % STEPS_PER_BAR;
      this.nextNoteTime += secondsPerStep;
      guard -= 1;
    }
    if (guard === 0) this.nextNoteTime = this.ctx.currentTime;
  }

  #scheduleStep(step, when) {
    const def = this.music;
    const root = NOTE_OFFSET[def.key] ?? 0;
    for (const layer of def.layers) {
      if (!this.#layerActive(layer)) continue;
      const degree = layer.pattern[step % layer.pattern.length];
      if (degree === undefined || degree < 0) continue;

      // A pattern value indexes the scale rather than naming a semitone, so a track stays
      // in key however its patterns are edited.
      const semitone = def.scale[degree % def.scale.length] + Math.floor(degree / def.scale.length) * 12;
      const frequency = freqOf(root - 9 + semitone + layer.octave * 12);
      this.#scheduleNote(layer, frequency, when);
    }
  }

  #scheduleNote(layer, frequency, when) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    const length = layer.role === 'PAD' ? 0.9 : 0.16;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(layer.gain, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    gain.connect(this.musicBus);

    if (layer.voice === 'NOISE' || layer.voice === 'CLICK') {
      const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(gain);
      node.start(when);
      return;
    }

    const osc = ctx.createOscillator();
    const TYPE = {
      SQUARE: 'square', SAW: 'sawtooth', SINE: 'sine', TRIANGLE: 'triangle',
      FM: 'sine', PLUCK: 'triangle',
    };
    osc.type = TYPE[layer.voice] ?? 'sine';
    osc.frequency.setValueAtTime(frequency, when);
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + length);
  }
}
