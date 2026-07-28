/**
 * Deterministic scoped random number generation.
 *
 * GDD refs: 20.4 (Deterministic RNG streams), R-TEC-002, R-CMB-005, R-ENV-003,
 *           22.5 ("Do not use unseeded randomness in gameplay code",
 *                 "Do not mix cosmetic RNG with loot or generation RNG").
 *
 * Every random decision in gameplay code must come from a named stream obtained
 * through `RngSource.stream(name, ...context)`. Streams are isolated: consuming
 * numbers from OBJECT_CONTENT can never shift the sequence seen by LOOT_ITEM or
 * BOSS. All arithmetic is 32-bit integer math so results are bit-identical on
 * every platform and JS engine.
 */

/** Canonical stream names. Using an unlisted name is a validation error. */
export const RNG_STREAMS = Object.freeze({
  RUN_ROUTE: 'RUN_ROUTE',
  FLOOR_LAYOUT: 'FLOOR_LAYOUT',
  ROOM_TEMPLATE: 'ROOM_TEMPLATE',
  ENCOUNTER: 'ENCOUNTER',
  LOOT_ITEM: 'LOOT_ITEM',
  LOOT_PICKUP: 'LOOT_PICKUP',
  OBJECT_CONTENT: 'OBJECT_CONTENT',
  BOSS: 'BOSS',
  COMBAT_PROC: 'COMBAT_PROC',
  COSMETIC: 'COSMETIC',
});

const STREAM_NAMES = Object.freeze(Object.keys(RNG_STREAMS));

/** 32-bit FNV-1a over a string. Stable, fast, dependency-free. */
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
    // Mix the high byte of multi-byte code units so unicode ids stay distinct.
    const hi = text.charCodeAt(i) >>> 8;
    if (hi !== 0) {
      h ^= hi;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

/** Avalanche mixer used to spread a single 32-bit seed into generator state. */
function mix32(x) {
  let z = x >>> 0;
  z = (z + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

/**
 * One deterministic random stream.
 *
 * Uses sfc32: four 32-bit words, well-distributed, trivially serializable, and
 * far better than a bare LCG for the volume of rolls a floor generator makes.
 */
export class Rng {
  constructor(a, b, c, d) {
    this.a = a >>> 0;
    this.b = b >>> 0;
    this.c = c >>> 0;
    this.d = d >>> 0;
    this.count = 0;
  }

  /** Build a stream from an arbitrary string key. */
  static fromKey(key) {
    const h = hashString(key);
    const a = mix32(h ^ 0x9e3779b9);
    const b = mix32(a ^ 0x85ebca6b);
    const c = mix32(b ^ 0xc2b2ae35);
    const d = mix32(c ^ 0x27d4eb2f);
    const rng = new Rng(a, b, c, d);
    // Warm up so short keys with similar hashes diverge immediately.
    for (let i = 0; i < 12; i += 1) rng.nextUint32();
    rng.count = 0;
    return rng;
  }

  /** Raw generator step. Every other method funnels through this one. */
  nextUint32() {
    let { a, b, c, d } = this;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    d = (d + 1) >>> 0;
    const out = (t + d) >>> 0;
    c = (c + out) >>> 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    this.count += 1;
    return out;
  }

  /** Float in [0, 1). */
  next() {
    return this.nextUint32() / 4294967296;
  }

  /** Float in [min, max). */
  float(min, max) {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. Returns min when the range is empty. */
  int(min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi <= lo) return lo;
    const span = hi - lo + 1;
    // Rejection sampling keeps the distribution exactly uniform.
    const limit = Math.floor(4294967296 / span) * span;
    let r = this.nextUint32();
    while (r >= limit) r = this.nextUint32();
    return lo + (r % span);
  }

  /** True with probability `p` (0..1). */
  chance(p) {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }

  /** Uniform pick. Returns undefined for an empty list. */
  pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[this.int(0, list.length - 1)];
  }

  /**
   * Weighted pick over `[{weight}]`-shaped entries.
   * `weightOf` lets callers supply an effective weight without mutating data.
   * Entries with weight <= 0 are ignored. Returns undefined if nothing is eligible.
   */
  pickWeighted(entries, weightOf = (e) => e.weight) {
    let total = 0;
    for (const entry of entries) {
      const w = weightOf(entry);
      if (w > 0) total += w;
    }
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const entry of entries) {
      const w = weightOf(entry);
      if (w <= 0) continue;
      roll -= w;
      if (roll < 0) return entry;
    }
    // Floating point tail: return the last eligible entry.
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (weightOf(entries[i]) > 0) return entries[i];
    }
    return undefined;
  }

  /** In-place Fisher-Yates. Returns the same array for chaining. */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  /** Random unit-ish angle in radians. */
  angle() {
    return this.next() * Math.PI * 2;
  }

  /** Serializable snapshot (save/continue, debug export). */
  save() {
    return { a: this.a, b: this.b, c: this.c, d: this.d, count: this.count };
  }

  /** Restore from a snapshot produced by `save()`. */
  load(state) {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
    this.count = state.count | 0;
    return this;
  }

  /** Independent child stream. Does not disturb this stream's sequence. */
  fork(label) {
    return Rng.fromKey(`${this.a}:${this.b}:${this.c}:${this.d}:${label}`);
  }
}

/**
 * Owns every stream for one run. Streams are cached by context key so repeated
 * lookups continue the same sequence rather than restarting it.
 */
export class RngSource {
  constructor(seed) {
    this.seed = String(seed);
    /** @type {Map<string, Rng>} */
    this.streams = new Map();
  }

  static contextKey(name, context) {
    return context.length === 0 ? name : `${name}|${context.join('|')}`;
  }

  /**
   * Fetch (or lazily create) a stream.
   * @param {string} name one of RNG_STREAMS
   * @param {...(string|number)} context stable identifiers: floor index, room id, pool id...
   */
  stream(name, ...context) {
    if (!RNG_STREAMS[name]) {
      throw new Error(`Unknown RNG stream "${name}". Add it to RNG_STREAMS first.`);
    }
    const key = RngSource.contextKey(name, context);
    let rng = this.streams.get(key);
    if (!rng) {
      rng = Rng.fromKey(`${this.seed}#${key}`);
      this.streams.set(key, rng);
    }
    return rng;
  }

  /** Drop cached streams matching a context prefix (e.g. a regenerated floor). */
  resetContext(name, ...context) {
    const prefix = RngSource.contextKey(name, context);
    for (const key of [...this.streams.keys()]) {
      if (key === prefix || key.startsWith(`${prefix}|`)) this.streams.delete(key);
    }
  }

  /** Snapshot every live stream for the run save. */
  save() {
    const out = {};
    for (const [key, rng] of this.streams) out[key] = rng.save();
    return { seed: this.seed, streams: out };
  }

  /** Restore a snapshot produced by `save()`. */
  load(state) {
    this.seed = String(state.seed);
    this.streams.clear();
    for (const [key, snapshot] of Object.entries(state.streams || {})) {
      const rng = Rng.fromKey(`${this.seed}#${key}`);
      rng.load(snapshot);
      this.streams.set(key, rng);
    }
    return this;
  }
}

// ---------------------------------------------------------------------------
// Human-shareable seeds (GDD 21.3)
// ---------------------------------------------------------------------------

/** Crockford-style alphabet: no I, L, O, U so spoken seeds survive transcription. */
const SEED_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SEED_PREFIX = 'OFFICE';

/** Format: OFFICE-XXXX-XXXX. */
export function formatSeed(raw) {
  const clean = String(raw).toUpperCase().replace(/[^0-9A-Z]/g, '');
  const body = clean.startsWith(SEED_PREFIX) ? clean.slice(SEED_PREFIX.length) : clean;
  const padded = (body + '00000000').slice(0, 8);
  return `${SEED_PREFIX}-${padded.slice(0, 4)}-${padded.slice(4, 8)}`;
}

/** Generate a fresh shareable seed. `entropy` is injectable for testing. */
export function generateSeed(entropy) {
  let bits;
  if (typeof entropy === 'number') {
    bits = mix32(entropy);
  } else if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    bits = buf[0] >>> 0;
  } else {
    bits = mix32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  }
  let body = '';
  let x = bits >>> 0;
  for (let i = 0; i < 8; i += 1) {
    body += SEED_ALPHABET[x % SEED_ALPHABET.length];
    x = mix32(x);
  }
  return formatSeed(body);
}

/** True when a string is a syntactically valid shareable seed. */
export function isValidSeed(text) {
  return /^OFFICE-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(String(text).toUpperCase());
}

export { STREAM_NAMES };
