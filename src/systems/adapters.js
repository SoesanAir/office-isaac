/**
 * Modifier adapter registry.
 *
 * GDD refs: 7.3 (Modifier adapter contract), R-WPN-005 (unsupported modifiers
 *           have no weapon interaction and never prompt), R-ITM-006 (unsupported
 *           interactions are allowed and deterministic; resolution returns
 *           NO_EFFECT without an error or prompt), 8.5 (three synergy layers),
 *           D-010 (a modifier may affect weapons differently and may have no
 *           interaction with some), 7.4 / 8.5 required synergy table.
 *
 * The "no-effect rule" is a design rule, not a bug: a passive doing nothing with
 * the current weapon is correct when the relationship is genuinely nonsensical.
 * The game must never fake a meaningless stat change to claim compatibility.
 */

/** Resolution outcomes for a modifier against a weapon. */
export const ADAPTER_RESULT = Object.freeze({
  APPLIED: 'APPLIED',
  NO_EFFECT: 'NO_EFFECT',
  FALLBACK_STAT: 'FALLBACK_STAT',
});

/** adapterId -> { fn, supports, note } */
const adapters = new Map();

/**
 * Register an adapter.
 *
 * @param {string} id e.g. 'HomingProjectileAdapter'
 * @param {object} spec
 * @param {string[]} spec.supports attack tags this adapter can translate
 * @param {(pattern:object, params:object, ctx:object)=>void} spec.fn mutates the
 *        resolved attack pattern in place
 * @param {string} spec.note one-line description
 * @param {number} [spec.order] lower applies first; keeps modifier stacking
 *        order deterministic regardless of pickup order
 */
export function defineAdapter(id, spec) {
  if (adapters.has(id)) throw new Error(`Duplicate adapter "${id}".`);
  if (!Array.isArray(spec.supports) || spec.supports.length === 0) {
    throw new Error(`Adapter "${id}" must declare supported attack tags.`);
  }
  if (typeof spec.fn !== 'function') throw new Error(`Adapter "${id}" needs an implementation.`);
  if (!spec.note) throw new Error(`Adapter "${id}" needs a note.`);
  adapters.set(id, Object.freeze({
    id,
    supports: Object.freeze([...spec.supports]),
    fn: spec.fn,
    note: spec.note,
    order: spec.order ?? 100,
  }));
  return id;
}

export function getAdapter(id) {
  return adapters.get(id);
}

export function hasAdapter(id) {
  return adapters.has(id);
}

export function allAdapters() {
  return [...adapters.values()];
}

/**
 * Resolve which adapter a modifier uses for a weapon.
 *
 * Order of precedence, exactly as GDD 7.3 specifies:
 *   1. `modifier.weaponOverrides[weapon.id]`  — handcrafted per-weapon behaviour
 *   2. `modifier.defaultAdapter`              — systemic behaviour
 *   3. `modifier.unsupportedBehavior`         — NO_EFFECT or FALLBACK_STAT
 *
 * A weapon must also declare the mechanic in its own `adapters` map OR share at
 * least one attack tag with `supportedAttackTags`; otherwise the modifier has no
 * legitimate translation and resolves to NO_EFFECT.
 *
 * @returns {{result: string, adapter?: object, reason: string}}
 */
export function resolveAdapter(modifier, weapon) {
  if (!modifier) return { result: ADAPTER_RESULT.NO_EFFECT, reason: 'no modifier block' };

  const override = modifier.weaponOverrides?.[weapon.id];
  if (override) {
    const adapter = adapters.get(override);
    if (!adapter) {
      // Content validation catches this; at runtime prefer silence over a crash.
      return { result: ADAPTER_RESULT.NO_EFFECT, reason: `override "${override}" not registered` };
    }
    return { result: ADAPTER_RESULT.APPLIED, adapter, reason: 'weapon override' };
  }

  // A weapon may explicitly claim a mechanic by name (GDD G.1 `adapters` map).
  const claimed = weapon.adapters?.[modifier.mechanic];
  if (claimed) {
    const adapter = adapters.get(claimed);
    if (adapter) return { result: ADAPTER_RESULT.APPLIED, adapter, reason: 'weapon-declared adapter' };
  }

  const shareTag = (weapon.modifierTags || []).some((tag) =>
    (modifier.supportedAttackTags || []).includes(tag));
  if (!shareTag) {
    return {
      result: modifier.unsupportedBehavior === 'FALLBACK_STAT'
        ? ADAPTER_RESULT.FALLBACK_STAT
        : ADAPTER_RESULT.NO_EFFECT,
      reason: 'no shared attack tag',
    };
  }

  const adapter = adapters.get(modifier.defaultAdapter);
  if (!adapter) {
    return { result: ADAPTER_RESULT.NO_EFFECT, reason: `default adapter "${modifier.defaultAdapter}" not registered` };
  }
  // The adapter itself may still refuse an archetype it cannot express.
  const adapterSupports = adapter.supports.includes(weapon.attack.archetype) ||
    adapter.supports.some((tag) => (weapon.modifierTags || []).includes(tag));
  if (!adapterSupports) {
    return {
      result: modifier.unsupportedBehavior === 'FALLBACK_STAT'
        ? ADAPTER_RESULT.FALLBACK_STAT
        : ADAPTER_RESULT.NO_EFFECT,
      reason: `adapter does not support ${weapon.attack.archetype}`,
    };
  }
  return { result: ADAPTER_RESULT.APPLIED, adapter, reason: 'default adapter' };
}

/** Validation seam: adapters referenced by content but never registered. */
export function findMissingAdapters(registry) {
  const missing = [];
  for (const def of registry.all('passive')) {
    const mod = def.modifier;
    if (!mod) continue;
    if (!adapters.has(mod.defaultAdapter)) {
      missing.push({ id: def.id, adapter: mod.defaultAdapter, where: 'defaultAdapter' });
    }
    for (const [weaponId, adapterId] of Object.entries(mod.weaponOverrides || {})) {
      if (!adapters.has(adapterId)) {
        missing.push({ id: def.id, adapter: adapterId, where: `weaponOverrides.${weaponId}` });
      }
      if (!registry.has('weapon', weaponId)) {
        missing.push({ id: def.id, adapter: weaponId, where: 'weaponOverrides key is not a weapon id' });
      }
    }
  }
  for (const def of registry.all('weapon')) {
    for (const [mechanic, adapterId] of Object.entries(def.adapters || {})) {
      if (!adapters.has(adapterId)) {
        missing.push({ id: def.id, adapter: adapterId, where: `adapters.${mechanic}` });
      }
    }
  }
  return missing;
}

export function resetAdapters() {
  adapters.clear();
}
