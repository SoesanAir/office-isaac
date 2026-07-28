/**
 * Object pooling and stable-order active sets.
 *
 * GDD refs: R-TEC-004 (pooling prevents allocation spikes), R-CMB-004
 *           (projectile/entity counts capped through pooling and aggregation,
 *           not silent mechanical deletion), 20.7 (600 logical projectiles).
 *
 * The important rule from R-CMB-004: when a pool is exhausted the game must not
 * quietly drop mechanics. `acquire()` reports exhaustion so callers can either
 * aggregate presentation (correct) or recycle the oldest entry under an explicit
 * policy (also correct, and logged), never silently swallow damage.
 */

export class Pool {
  /**
   * @param {() => object} factory creates a blank instance
   * @param {(obj:object) => void} reset returns an instance to a blank state
   * @param {number} capacity hard mechanical cap
   * @param {string} label diagnostics
   */
  constructor(factory, reset, capacity, label = 'pool') {
    this.factory = factory;
    this.reset = reset;
    this.capacity = capacity;
    this.label = label;
    /** @type {object[]} */
    this.free = [];
    /** @type {object[]} */
    this.active = [];
    this.created = 0;
    this.exhaustions = 0;
    this.peakActive = 0;
  }

  get size() {
    return this.active.length;
  }

  /** True when another acquire would exceed the mechanical cap. */
  get isFull() {
    return this.active.length >= this.capacity;
  }

  /**
   * Take an instance. Returns null when the cap is reached; the caller decides
   * how to degrade (aggregate visuals, or call `recycleOldest`).
   */
  acquire() {
    if (this.active.length >= this.capacity) {
      this.exhaustions += 1;
      return null;
    }
    let obj = this.free.pop();
    if (!obj) {
      obj = this.factory();
      this.created += 1;
    }
    obj.__pooled = true;
    obj.__dead = false;
    this.active.push(obj);
    if (this.active.length > this.peakActive) this.peakActive = this.active.length;
    return obj;
  }

  /**
   * Explicit overflow policy: free the oldest active instance and hand it back.
   * Only for entities whose mechanical contribution has already been applied
   * (e.g. decorative debris), never for undelivered damage.
   */
  recycleOldest() {
    if (this.active.length === 0) return this.acquire();
    const oldest = this.active.shift();
    this.reset(oldest);
    oldest.__dead = false;
    this.active.push(oldest);
    return oldest;
  }

  /** Mark an instance for removal at the next `sweep()`. */
  release(obj) {
    obj.__dead = true;
  }

  /**
   * Compact the active list, returning dead instances to the free list.
   * Order of surviving entries is preserved, which keeps iteration
   * deterministic across ticks.
   */
  sweep(onRelease) {
    let write = 0;
    for (let read = 0; read < this.active.length; read += 1) {
      const obj = this.active[read];
      if (obj.__dead) {
        if (onRelease) onRelease(obj);
        this.reset(obj);
        this.free.push(obj);
      } else {
        this.active[write] = obj;
        write += 1;
      }
    }
    this.active.length = write;
  }

  /** Iterate active instances in stable order. */
  forEach(fn) {
    for (let i = 0; i < this.active.length; i += 1) {
      const obj = this.active[i];
      if (!obj.__dead) fn(obj, i);
    }
  }

  /** Release everything. Used on room exit and run end. */
  clear(onRelease) {
    for (const obj of this.active) {
      if (onRelease) onRelease(obj);
      this.reset(obj);
      this.free.push(obj);
    }
    this.active.length = 0;
  }

  stats() {
    return {
      label: this.label,
      active: this.active.length,
      free: this.free.length,
      created: this.created,
      capacity: this.capacity,
      peakActive: this.peakActive,
      exhaustions: this.exhaustions,
    };
  }
}

/**
 * Monotonic entity id allocator. Ids are per-run and deterministic because they
 * come from a counter, not a random source (GDD R-PLY-004 wants a stable
 * `source entity ID` on every damage event).
 */
export class IdAllocator {
  constructor(prefix = 'e') {
    this.prefix = prefix;
    this.next = 1;
  }

  allocate() {
    return `${this.prefix}${this.next++}`;
  }

  save() {
    return { prefix: this.prefix, next: this.next };
  }

  load(state) {
    this.prefix = state.prefix;
    this.next = state.next;
    return this;
  }
}
