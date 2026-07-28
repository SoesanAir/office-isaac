/**
 * Content registry: the single place every content definition is loaded,
 * validated, cross-linked, and indexed.
 *
 * GDD refs: R-GOV-003 (adding normal content must not require editing core
 *           logic), R-TEC-001 (content lives outside core logic in versioned
 *           data), R-TEC-005 (validated at build and load time), R-TEC-006 (no
 *           core system checks display names), R-ITM-002 (unique sprite ids,
 *           fixed class), 20.6 (stable ASCII ids, reserved removed ids).
 *
 * Core systems only ever ask the registry for ids, tags, and interfaces. If a
 * system ever needs a display name to decide behaviour, that is a defect.
 */

import { Issues } from './schema.js';

/** Every content kind the game knows about. */
export const CONTENT_KINDS = Object.freeze([
  'weapon',
  'passive',
  'active',
  'card',
  'supplement',
  'charm',
  'transformation',
  'enemy',
  'enemyVariant',
  'boss',
  'encounter',
  'department',
  'floor',
  'route',
  'roomTemplate',
  'envObject',
  'hazard',
  'lootPool',
  'objectLootTable',
  'unlock',
  'ending',
  'profile',
  'challenge',
  'sprite',
  'sound',
  'music',
  'localization',
]);

/**
 * Ids that once existed and must never be reused for different content.
 * GDD 20.6: "Removed content IDs remain reserved and migrate explicitly."
 */
export const RESERVED_IDS = Object.freeze(new Set([]));

export class ContentRegistry {
  constructor() {
    /** @type {Map<string, Map<string, object>>} kind -> id -> definition */
    this.byKind = new Map();
    /** @type {Map<string, Schema>} kind -> schema */
    this.schemas = new Map();
    /** @type {Map<string, string>} id -> kind, for global uniqueness */
    this.kindOfId = new Map();
    /** Deferred cross-references, resolved by `link()`. */
    this.pendingRefs = [];
    this.issues = new Issues();
    this.linked = false;
    /** Content version stamped into saves and debug exports (GDD 21.1). */
    this.contentVersion = '1.0.0';

    for (const kind of CONTENT_KINDS) this.byKind.set(kind, new Map());
  }

  /** Register the schema used to validate one content kind. */
  defineSchema(kind, schema) {
    if (!this.byKind.has(kind)) {
      throw new Error(`Unknown content kind "${kind}". Add it to CONTENT_KINDS.`);
    }
    this.schemas.set(kind, schema);
    return this;
  }

  /**
   * Add one definition. Validation runs immediately so a bad content file fails
   * at load with a precise path instead of producing a mystery crash mid-run.
   */
  add(kind, def) {
    const table = this.byKind.get(kind);
    if (!table) {
      this.issues.error(`${kind}`, 'unknown content kind');
      return this;
    }
    const schema = this.schemas.get(kind);
    if (!schema) {
      this.issues.error(`${kind}:${def?.id}`, 'no schema registered for this kind');
      return this;
    }

    const { issues, refs } = schema.validate(def);
    this.issues.merge(issues);

    const id = def?.id;
    if (typeof id === 'string') {
      if (table.has(id)) {
        this.issues.error(`${kind}:${id}`, 'duplicate id within kind');
      }
      const existingKind = this.kindOfId.get(id);
      if (existingKind && existingKind !== kind) {
        this.issues.error(`${kind}:${id}`, `id already used by kind "${existingKind}"`);
      }
      table.set(id, Object.freeze(def));
      this.kindOfId.set(id, kind);
      for (const ref of refs) this.pendingRefs.push({ ...ref, fromKind: kind, fromId: id });
    }
    return this;
  }

  /** Bulk add. Accepts an array or an id-keyed object. */
  addAll(kind, defs) {
    const list = Array.isArray(defs) ? defs : Object.values(defs);
    for (const def of list) this.add(kind, def);
    return this;
  }

  get(kind, id) {
    return this.byKind.get(kind)?.get(id);
  }

  /** Throwing accessor for code paths where a missing id is a programming error. */
  require(kind, id) {
    const def = this.get(kind, id);
    if (!def) throw new Error(`Missing ${kind} "${id}" in content registry.`);
    return def;
  }

  has(kind, id) {
    return Boolean(this.byKind.get(kind)?.has(id));
  }

  /** All definitions of a kind, in insertion order (deterministic). */
  all(kind) {
    return [...(this.byKind.get(kind)?.values() ?? [])];
  }

  ids(kind) {
    return [...(this.byKind.get(kind)?.keys() ?? [])];
  }

  count(kind) {
    return this.byKind.get(kind)?.size ?? 0;
  }

  /** Filter helper used by pool builders and department weight tables. */
  filter(kind, predicate) {
    return this.all(kind).filter(predicate);
  }

  /**
   * Resolve every deferred cross-reference and run global invariants.
   * Call once after all content modules have registered.
   */
  link() {
    for (const ref of this.pendingRefs) {
      if (!this.has(ref.refKind, ref.id)) {
        this.issues.error(ref.path, `references unknown ${ref.refKind} "${ref.id}"`);
      }
    }
    this.pendingRefs.length = 0;
    this.#checkSpriteUniqueness();
    this.#checkReservedIds();
    this.linked = true;
    return this.issues;
  }

  /** R-ITM-002 / R-ART-002: every collectible needs its own sprite. */
  #checkSpriteUniqueness() {
    const collectibleKinds = ['weapon', 'passive', 'active', 'card', 'supplement', 'charm'];
    const seen = new Map();
    for (const kind of collectibleKinds) {
      for (const def of this.all(kind)) {
        const spriteId = def.spriteId;
        if (!spriteId) continue;
        if (seen.has(spriteId)) {
          this.issues.error(
            `${kind}:${def.id}.spriteId`,
            `sprite "${spriteId}" already used by ${seen.get(spriteId)} (R-ITM-002)`,
          );
        } else {
          seen.set(spriteId, `${kind}:${def.id}`);
        }
      }
    }
  }

  #checkReservedIds() {
    for (const [id, kind] of this.kindOfId) {
      if (RESERVED_IDS.has(id)) {
        this.issues.error(`${kind}:${id}`, 'id is reserved by a removed content entry (GDD 20.6)');
      }
    }
  }

  /**
   * Throw if the registry has errors. Development and CI call this; a release
   * build logs instead so a single bad content entry cannot brick the title
   * screen.
   */
  assertValid({ strict = true } = {}) {
    if (this.issues.errors.length > 0) {
      const message = `Content validation failed with ${this.issues.errors.length} error(s):\n${this.issues.format()}`;
      if (strict) throw new Error(message);
      console.error(message);
    } else if (this.issues.warnings.length > 0) {
      console.warn(`Content validation warnings:\n${this.issues.format()}`);
    }
    return this;
  }

  /** Content census, used by the QA report and README content table. */
  census() {
    const out = {};
    for (const kind of CONTENT_KINDS) out[kind] = this.count(kind);
    return out;
  }
}

/** Process-wide registry. Content modules import this and register into it. */
export const registry = new ContentRegistry();
