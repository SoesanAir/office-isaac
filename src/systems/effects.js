/**
 * Effect hook registry.
 *
 * GDD refs: R-GOV-003 / R-TEC-001 (content is data, not code branches),
 *           22.5 ("Do not place normal item, enemy, or room data directly in
 *           switch statements"), R-TEC-006 (never dispatch on display names),
 *           8.5 (synergy layers), 20.5 (deterministic event ordering).
 *
 * Content declares `effects: [{ hook: 'HOOK_NAME', params: {...} }]`. This module
 * is the only place a hook name is bound to behaviour. Adding an item is
 * therefore a data change plus, at most, one new reusable hook — never an edit to
 * combat, loot, or room logic.
 *
 * Hooks are grouped by the moment they fire. Every hook receives a context
 * object; the fields available per group are documented below and asserted in
 * development builds.
 */

/**
 * Canonical hook timing points. A hook must declare exactly one.
 *
 * STAT            — recomputed whenever the attack graph rebuilds. Pure: read
 *                   ctx.stats, write ctx.stats. No side effects, no RNG.
 * ATTACK_PATTERN  — shapes the attack pattern after the weapon produces it.
 * ON_FIRE         — fires once per attack event.
 * ON_HIT          — a player attack struck something.
 * ON_KILL         — an enemy died to the player.
 * ON_DAMAGED      — the player took damage (after resolution).
 * ON_DAMAGE_GUARD — before damage resolves; may cancel or reduce. Cancellable.
 * ON_ROOM_CLEAR   — a hostile room finished.
 * ON_ROOM_ENTER   — the player entered any room.
 * ON_FLOOR_START  — a new floor became playable.
 * ON_PICKUP       — a resource or health pickup was collected.
 * ON_PURCHASE     — a shop transaction completed.
 * ON_DOOR_COST    — a locked door is about to charge the player. Cancellable.
 * ON_LOOT_ROLL    — the loot service is selecting from a pool. May reweight.
 * ON_DEATH_GUARD  — fatal damage is about to resolve. May revive. Cancellable.
 * TICK            — per simulation step while owned. Use sparingly.
 * ON_USE          — an active item, card, or supplement was triggered.
 * ON_OBJECT_BREAK — an environmental object was destroyed.
 * ON_STATUS       — a status effect was applied by or to the player.
 */
export const HOOK_TIMING = Object.freeze({
  STAT: 'STAT',
  ATTACK_PATTERN: 'ATTACK_PATTERN',
  ON_FIRE: 'ON_FIRE',
  ON_HIT: 'ON_HIT',
  ON_KILL: 'ON_KILL',
  ON_DAMAGED: 'ON_DAMAGED',
  ON_DAMAGE_GUARD: 'ON_DAMAGE_GUARD',
  ON_ROOM_CLEAR: 'ON_ROOM_CLEAR',
  ON_ROOM_ENTER: 'ON_ROOM_ENTER',
  ON_FLOOR_START: 'ON_FLOOR_START',
  ON_PICKUP: 'ON_PICKUP',
  ON_PURCHASE: 'ON_PURCHASE',
  ON_DOOR_COST: 'ON_DOOR_COST',
  ON_LOOT_ROLL: 'ON_LOOT_ROLL',
  ON_DEATH_GUARD: 'ON_DEATH_GUARD',
  TICK: 'TICK',
  ON_USE: 'ON_USE',
  ON_OBJECT_BREAK: 'ON_OBJECT_BREAK',
  ON_STATUS: 'ON_STATUS',
});

/** hookName -> { timing, fn, priority, note, deterministic } */
const hooks = new Map();

/**
 * Register one effect hook.
 *
 * @param {string} name UPPER_SNAKE hook id referenced by content data
 * @param {object} spec
 * @param {string} spec.timing one of HOOK_TIMING
 * @param {(ctx:object, params:object, owner:object)=>any} spec.fn
 * @param {number} [spec.priority] lower runs first within the same timing
 * @param {string} spec.note one-line description for the content browser
 * @param {boolean} [spec.usesRng] true if the hook consumes COMBAT_PROC
 */
export function defineHook(name, spec) {
  if (hooks.has(name)) throw new Error(`Duplicate effect hook "${name}".`);
  if (!HOOK_TIMING[spec.timing]) {
    throw new Error(`Hook "${name}" has unknown timing "${spec.timing}".`);
  }
  if (typeof spec.fn !== 'function') {
    throw new Error(`Hook "${name}" needs an implementation function.`);
  }
  if (!spec.note || spec.note.length < 6) {
    throw new Error(`Hook "${name}" needs a descriptive note.`);
  }
  hooks.set(name, Object.freeze({
    name,
    timing: spec.timing,
    fn: spec.fn,
    priority: spec.priority ?? 100,
    note: spec.note,
    usesRng: Boolean(spec.usesRng),
  }));
  return name;
}

export function getHook(name) {
  return hooks.get(name);
}

export function hasHook(name) {
  return hooks.has(name);
}

export function allHooks() {
  return [...hooks.values()];
}

export function hookNames() {
  return [...hooks.keys()];
}

/**
 * Collect every registered effect for a timing point across all owned content,
 * sorted deterministically: hook priority, then owner acquisition order.
 *
 * `owners` is a list of `{ id, order, effects: [{hook, params}] }`. Passives,
 * charms, transformations, and the profile all use the same shape, so one code
 * path serves them all.
 */
export function collectEffects(owners, timing) {
  const out = [];
  for (const owner of owners) {
    const effects = owner.effects;
    if (!effects) continue;
    for (let i = 0; i < effects.length; i += 1) {
      const entry = effects[i];
      const hook = hooks.get(entry.hook);
      if (!hook) continue; // validated at load; skip defensively at runtime
      if (hook.timing !== timing) continue;
      out.push({
        hook,
        params: entry.params || {},
        owner,
        sortKey: [hook.priority, owner.order ?? 0, i],
      });
    }
  }
  out.sort((a, b) => {
    for (let i = 0; i < 3; i += 1) {
      if (a.sortKey[i] !== b.sortKey[i]) return a.sortKey[i] - b.sortKey[i];
    }
    return a.owner.id < b.owner.id ? -1 : a.owner.id > b.owner.id ? 1 : 0;
  });
  return out;
}

/**
 * Run every effect registered for `timing`. Returns the context so callers can
 * chain. A hook that returns `false` on a cancellable timing sets `ctx.cancelled`.
 */
export function runEffects(owners, timing, ctx) {
  const entries = collectEffects(owners, timing);
  for (const entry of entries) {
    if (ctx.cancelled) break;
    const result = entry.hook.fn(ctx, entry.params, entry.owner);
    if (result === false) ctx.cancelled = true;
  }
  return ctx;
}

/** Validation seam: report content hooks that have no implementation. */
export function findMissingHooks(registry) {
  const missing = [];
  const kinds = ['passive', 'charm', 'transformation'];
  for (const kind of kinds) {
    for (const def of registry.all(kind)) {
      for (const entry of def.effects || []) {
        if (!hooks.has(entry.hook)) {
          missing.push({ kind, id: def.id, hook: entry.hook });
        }
      }
    }
  }
  for (const kind of ['active', 'card', 'supplement']) {
    for (const def of registry.all(kind)) {
      if (def.effectHook && !hooks.has(def.effectHook)) {
        missing.push({ kind, id: def.id, hook: def.effectHook });
      }
    }
  }
  for (const def of registry.all('envObject')) {
    for (const entry of def.onDestroy || []) {
      if (!hooks.has(entry.hook)) missing.push({ kind: 'envObject', id: def.id, hook: entry.hook });
    }
    if (def.onInteract?.hook && !hooks.has(def.onInteract.hook)) {
      missing.push({ kind: 'envObject', id: def.id, hook: def.onInteract.hook });
    }
  }
  return missing;
}

/** Test seam. */
export function resetHooks() {
  hooks.clear();
}
