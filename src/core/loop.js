/**
 * Fixed-step simulation loop with decoupled rendering.
 *
 * GDD refs: 20.7 (60 updates/second on target profile; rendering may be higher),
 *           18.2 (gameplay animations use authored frame timing independent of
 *           simulation frame rate), R-TEC-002 (determinism).
 *
 * The simulation advances in whole SIM_DT steps only. That is what allows a seed
 * replay to reproduce a run: variable frame times never leak into gameplay math.
 * Rendering receives an interpolation alpha so visuals stay smooth above 60 FPS.
 *
 * `optional game-speed assist presets` (GDD 17.6) are implemented as a timeScale
 * on the accumulator, which slows the simulation without changing any per-step
 * math — loot and unlock rules are therefore untouched.
 */

import { SIM_DT, MAX_CATCHUP_STEPS } from './constants.js';

export class GameLoop {
  /**
   * @param {(dt:number)=>void} update fixed-step simulation
   * @param {(alpha:number, frameDt:number)=>void} render presentation
   */
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.accumulator = 0;
    this.timeScale = 1;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.frame = 0;
    this.simSteps = 0;
    /** Rolling frame-time samples for the debug overlay (GDD 20.2 Debug/QA). */
    this.frameTimes = new Float32Array(120);
    this.frameTimeIndex = 0;
    this._tick = this._tick.bind(this);
    this._raf = null;
  }

  start(now = performance.now()) {
    if (this.running) return;
    this.running = true;
    this.lastTime = now;
    this.accumulator = 0;
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf !== null) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  /** Pause freezes the simulation but keeps rendering (menus overlay the world). */
  setPaused(paused) {
    this.paused = paused;
    if (!paused) this.accumulator = 0;
  }

  /** 1.0 = normal. Lower values are the accessibility slow-down presets. */
  setTimeScale(scale) {
    this.timeScale = Math.max(0.1, Math.min(2, scale));
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);

    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Guard against tab-switch spikes and debugger pauses.
    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
    if (frameDt > 0.25) frameDt = 0.25;

    this.frameTimes[this.frameTimeIndex] = frameDt * 1000;
    this.frameTimeIndex = (this.frameTimeIndex + 1) % this.frameTimes.length;
    this.frame += 1;

    if (!this.paused) {
      this.accumulator += frameDt * this.timeScale;
      let steps = 0;
      while (this.accumulator >= SIM_DT && steps < MAX_CATCHUP_STEPS) {
        this.accumulator -= SIM_DT;
        this.update(SIM_DT);
        this.simSteps += 1;
        steps += 1;
      }
      // Heavy hitch: drop the backlog rather than fast-forwarding forever.
      if (this.accumulator > SIM_DT * MAX_CATCHUP_STEPS) this.accumulator = 0;
    }

    const alpha = this.paused ? 0 : this.accumulator / SIM_DT;
    this.render(alpha, frameDt);
  }

  /** Headless deterministic advance, used by tests and tools. */
  advance(seconds) {
    let remaining = seconds;
    while (remaining >= SIM_DT - 1e-9) {
      this.update(SIM_DT);
      this.simSteps += 1;
      remaining -= SIM_DT;
    }
    return remaining;
  }

  averageFrameMs() {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < this.frameTimes.length; i += 1) {
      if (this.frameTimes[i] > 0) {
        sum += this.frameTimes[i];
        count += 1;
      }
    }
    return count === 0 ? 0 : sum / count;
  }
}

/**
 * Deterministic countdown timer used all over combat (telegraphs, cooldowns,
 * invulnerability, phase timers). Stored as plain numbers so it serialises into
 * the run save without special handling.
 */
export class Timer {
  constructor(duration = 0) {
    this.duration = duration;
    this.remaining = 0;
  }

  start(duration = this.duration) {
    this.duration = duration;
    this.remaining = duration;
    return this;
  }

  stop() {
    this.remaining = 0;
    return this;
  }

  get active() {
    return this.remaining > 0;
  }

  /** Normalised progress 0..1 where 1 means complete. */
  get progress() {
    if (this.duration <= 0) return 1;
    return 1 - Math.max(0, this.remaining) / this.duration;
  }

  /** Returns true on the tick the timer completes. */
  tick(dt) {
    if (this.remaining <= 0) return false;
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      return true;
    }
    return false;
  }

  save() {
    return { duration: this.duration, remaining: this.remaining };
  }

  load(state) {
    this.duration = state.duration;
    this.remaining = state.remaining;
    return this;
  }
}
