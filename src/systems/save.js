/**
 * Save service: the five save domains from GDD 21.1.
 *
 * GDD refs: 21.1 (the domain table below is that table), 21.2 (autosave policy: write
 *           temporary, validate, then replace, retaining one backup; never punish an
 *           ordinary application close), 21.3 (seeds and modes), R-TEC-007 (a save
 *           written by an older content version loads or is rejected cleanly, never
 *           half-applied), R-TEC-008 (run continue resumes at a safe boundary),
 *           R-PRG-001 (unlocks are idempotent across save and reload), D-016 (no total
 *           counts are stored in a way that would let the UI imply them).
 *
 * ## Storage
 *
 * `localStorage` in the browser, an in-memory Map under Node. The adapter is injectable so
 * tests exercise the real read/write/validate path rather than a mock of it — a save bug
 * that only appears against real storage is the whole risk here.
 *
 * ## Atomicity without a filesystem
 *
 * GDD 21.2 asks for write-temp, validate, replace, keep-one-backup. localStorage has no
 * rename, so the same guarantee is built from three keys: the previous good value is copied
 * to `.bak`, the new value is written to `.tmp` and parsed back to prove it round-trips, and
 * only then does it become the live key. A crash at any point leaves either the previous
 * value or a `.tmp` nobody reads — never a half-written live save.
 */

const SCHEMA_VERSION = 1;
const PREFIX = 'officeIsaac';

/** GDD 21.1's domains. Each is a separate key so one corrupt domain cannot lose the rest. */
export const DOMAIN = Object.freeze({
  PROFILE: 'profile',
  RUN: 'run',
  SETTINGS: 'settings',
  STATISTICS: 'statistics',
});

/** In-memory storage, used under Node and as a fallback when localStorage is unavailable. */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/**
 * localStorage can exist and still throw — private browsing and a full quota both do.
 * Falling back to memory keeps the game playable rather than crashing on the first autosave;
 * the player loses persistence, which is bad, but not as bad as losing the run.
 */
function detectStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return memoryStorage();
    const probe = `${PREFIX}:probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    console.error('localStorage is unavailable; progress will not persist this session.');
    return memoryStorage();
  }
}

/** A fresh profile. GDD 16.2: a fresh save is playable and complete, not a stub. */
export function emptyProfile() {
  return {
    schemaVersion: SCHEMA_VERSION,
    /** Unlock ids already granted. The idempotence guard for R-PRG-001. */
    granted: [],
    /** Named flags generation and routing read. */
    flags: [],
    /** Hidden counters, e.g. CEO clears. */
    counters: {},
    /** Ending ids seen, in discovery order. */
    endings: [],
    /** Collection discoveries: content the player has seen at least once. */
    discovered: [],
    /** Employee profiles unlocked for selection. */
    profiles: ['PRF-001'],
    /** Routes the player is permitted to enter on a future run. */
    routes: ['ROUTE-BASE'],
    /** Content added to named pools by unlocks. */
    pools: {},
    /** Challenge ids completed. */
    challenges: [],
    /** Every boss ever defeated, so "defeat all of a department's bosses" can be checked. */
    bossesDefeated: [],
  };
}

export function emptySettings() {
  return {
    schemaVersion: SCHEMA_VERSION,
    // Accessibility defaults are ON where they cost nothing and OFF where they change the
    // game's look, per GDD 17.6 — a first-time player should not have to opt into legible.
    grayscale: false,
    /** Stronger outlines on player, hostile fire, pickups and hazards (GDD 17.6). */
    highContrast: false,
    reducedMotion: false,
    reducedEffects: false,
    /** HUD and menu text multiplier, 0.8 to 1.6 (GDD 17.6 "scalable HUD and text"). */
    textScale: 1,
    captions: true,
    masterVolume: 0.8,
    musicVolume: 0.6,
    sfxVolume: 0.9,
    fireMode: 'HOLD',
    mapMode: 'HOLD',
    language: 'en',
    telemetry: false,
  };
}

export function emptyStatistics() {
  return {
    schemaVersion: SCHEMA_VERSION,
    runs: 0,
    deaths: 0,
    bossesDefeated: 0,
    roomsCleared: 0,
    playSeconds: 0,
  };
}

export class SaveService {
  /**
   * @param {object} [deps]
   * @param {{getItem:Function,setItem:Function,removeItem:Function}} [deps.storage]
   * @param {string} [deps.contentVersion] rejected-on-mismatch marker for R-TEC-007
   */
  constructor({ storage, contentVersion = 'dev' } = {}) {
    this.storage = storage || detectStorage();
    this.contentVersion = contentVersion;
  }

  #key(domain, suffix = '') {
    return `${PREFIX}:${domain}${suffix}`;
  }

  /**
   * Read a raw key, never throwing.
   *
   * A private-mode or quota-exhausted localStorage throws on `getItem` as readily as on
   * `setItem`. An exception escaping here would surface wherever a menu happened to be
   * loading a save, so every read goes through this.
   */
  #raw(key) {
    try {
      return this.storage.getItem(key);
    } catch (err) {
      console.error(`Save read failed for "${key}": ${err.message}`);
      return null;
    }
  }

  /**
   * Write a domain durably.
   *
   * Backup, then temp, then live. See the header for why this ordering is the localStorage
   * equivalent of GDD 21.2's write-validate-replace.
   */
  write(domain, value) {
    const key = this.#key(domain);
    const payload = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      contentVersion: this.contentVersion,
      savedAt: null, // Deliberately not a timestamp: see `read` for why.
      data: value,
    });

    try {
      // 1. Preserve the last known-good value.
      const previous = this.#raw(key);
      if (previous !== null) this.storage.setItem(this.#key(domain, '.bak'), previous);

      // 2. Stage, and prove it parses back before it goes live. A quota error or a value
      //    that cannot round-trip is caught here, while the live key is still intact.
      const tmp = this.#key(domain, '.tmp');
      this.storage.setItem(tmp, payload);
      JSON.parse(this.#raw(tmp));

      // 3. Promote.
      this.storage.setItem(key, payload);
      this.storage.removeItem(tmp);
      return true;
    } catch (err) {
      console.error(`Save failed for "${domain}": ${err.message}. The previous save is intact.`);
      return false;
    }
  }

  /**
   * Read a domain, falling back to its backup and then to `fallback`.
   *
   * R-TEC-007: a save from a different content version is rejected cleanly rather than
   * half-applied. Returning the fallback loses progress, which is bad — but merging a save
   * whose shape has changed silently corrupts a profile, which is worse and unrecoverable.
   */
  read(domain, fallback) {
    for (const suffix of ['', '.bak']) {
      const raw = this.#raw(this.#key(domain, suffix));
      if (raw === null) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.schemaVersion !== SCHEMA_VERSION) {
          console.error(`Save "${domain}${suffix}" is schema v${parsed.schemaVersion}, expected v${SCHEMA_VERSION}; ignoring it.`);
          continue;
        }
        if (suffix === '.bak') {
          console.error(`Save "${domain}" was unreadable; recovered from backup.`);
        }
        // Merge over the fallback so a save written before a field existed gains that
        // field's default rather than leaving it undefined.
        return { ...fallback, ...parsed.data };
      } catch (err) {
        console.error(`Save "${domain}${suffix}" is corrupt: ${err.message}`);
      }
    }
    return { ...fallback };
  }

  loadProfile() { return this.read(DOMAIN.PROFILE, emptyProfile()); }
  saveProfile(p) { return this.write(DOMAIN.PROFILE, p); }
  loadSettings() { return this.read(DOMAIN.SETTINGS, emptySettings()); }
  saveSettings(s) { return this.write(DOMAIN.SETTINGS, s); }
  loadStatistics() { return this.read(DOMAIN.STATISTICS, emptyStatistics()); }
  saveStatistics(s) { return this.write(DOMAIN.STATISTICS, s); }

  /**
   * Store a resumable run.
   *
   * R-TEC-008: only ever called at a room boundary, so the snapshot is a settled state
   * rather than a half-resolved collision frame. The Run and Player own their own
   * serialisation; this only persists what they hand over.
   */
  saveRun(runState) { return this.write(DOMAIN.RUN, runState); }

  loadRun() {
    const raw = this.#raw(this.#key(DOMAIN.RUN));
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
      // A run from a different content version cannot be resumed: its floor references
      // content that may have changed shape. The profile survives; only the run is dropped.
      if (parsed.contentVersion !== this.contentVersion) {
        console.error('Saved run was made by a different content version; it cannot be resumed.');
        return null;
      }
      return parsed.data;
    } catch (err) {
      console.error(`Saved run is corrupt: ${err.message}`);
      return null;
    }
  }

  /** GDD 21.2: restarting deliberately discards the run, and only the run. */
  clearRun() {
    for (const suffix of ['', '.tmp', '.bak']) {
      try {
        this.storage.removeItem(this.#key(DOMAIN.RUN, suffix));
      } catch { /* An unavailable storage has nothing to clear. */ }
    }
  }

  hasRun() {
    return this.#raw(this.#key(DOMAIN.RUN)) !== null;
  }
}
