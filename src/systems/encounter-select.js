/**
 * Encounter selection.
 *
 * GDD refs: 11.4 step 11 ("Select encounter definitions independently for
 *           hostile-capable rooms using budget and compatibility tags"),
 *           6.6 (the difficulty budget formula and its constraints),
 *           12.1 (the encounter layer is chosen independently of architecture),
 *           14.5 (encounter composition rules), R-FLR-007 / D-006 (architecture
 *           does not encode an encounter), R-ROM-001 (the same template
 *           instantiates with at least three different encounters and an empty
 *           state), R-ENM-003 (no mutually shielding or infinitely healing groups),
 *           R-ENM-006 (bounded quantity per room), R-ENM-008 (no unreachable spawns).
 *
 * This module is the *entire* reason a room can be a place rather than an enemy
 * list. The floor generator finishes without knowing what will fight there, and this
 * runs afterwards, reading only the room's declared tags and the floor's budget.
 *
 * GDD 6.6 is explicit that the generator "does not pour random enemies into a room
 * until a number is full" — so this picks one *authored* encounter whose declared
 * budget range contains the room's budget, and rejects anything the room cannot
 * support. If nothing fits, the room is empty, which R-ROM-002 and 12.2 both allow
 * as a legitimate state.
 */

import { RNG_STREAMS } from '../core/rng.js';
import { ROOM_SIZE_MULTIPLIER, DIFFICULTY_MULTIPLIER, BUDGETS, ROOM_ROLE } from '../core/constants.js';

/**
 * Encounter budget for one room. GDD 6.6, verbatim.
 *
 *   base_budget = 3.5 + (floor_depth * 1.35)
 *   encounter_budget = base_budget * room_multiplier * difficulty_multiplier
 */
export function encounterBudget({ depth, sizeClass, difficulty = 'standard' }) {
  const base = 3.5 + depth * 1.35;
  const room = ROOM_SIZE_MULTIPLIER[sizeClass] ?? 1.0;
  const diff = DIFFICULTY_MULTIPLIER[difficulty] ?? 1.0;
  return base * room * diff;
}

/** Total cost of an encounter's spawn list, using each enemy's authored cost. */
export function encounterCost(encounter, registry) {
  let total = 0;
  for (const group of encounter.spawnGroups) {
    for (const entry of group.entries) {
      const def = registry.get('enemy', entry.enemy);
      if (!def) continue;
      // Use the midpoint of the count range: the low end would let a heavy
      // encounter sneak under a tight budget and spike when it rolls high.
      const [lo, hi] = entry.count;
      total += def.cost * ((lo + hi) / 2);
    }
  }
  return total;
}

/** Maximum simultaneous hostiles an encounter can put on screen. */
export function maxSimultaneous(encounter) {
  const perWave = new Map();
  for (const group of encounter.spawnGroups) {
    const wave = group.wave ?? 0;
    let count = perWave.get(wave) ?? 0;
    for (const entry of group.entries) count += entry.count[1];
    perWave.set(wave, count);
  }
  let max = 0;
  for (const [, count] of perWave) if (count > max) max = count;
  return max;
}

/**
 * Is this encounter legal in this room?
 *
 * Every rejection here maps to a specific GDD rule, so a "no" is always
 * explainable rather than a vibe.
 */
export function isCompatible(encounter, { room, template, depth, department, registry }) {
  // Depth gates.
  if (encounter.minFloor > depth) return { ok: false, reason: 'minFloor' };
  if (encounter.maxFloor && encounter.maxFloor < depth) return { ok: false, reason: 'maxFloor' };

  // Department eligibility (GDD 6.6 "use department-eligible enemy tags").
  if (!encounter.departmentTags.includes(department)) {
    return { ok: false, reason: 'department' };
  }

  const roleTags = new Set(template.roleTags);
  const allowed = new Set(template.allowedEncounterTags || []);
  const prohibitedEnemyTags = new Set(template.prohibitedEnemyTags || []);

  // Required room tags must all be present.
  for (const tag of encounter.roomTagsRequired) {
    if (!roleTags.has(tag) && !allowed.has(tag)) return { ok: false, reason: `missing ${tag}` };
  }
  // At least one of the "any" tags, when the encounter names some.
  if (encounter.roomTagsAny.length > 0) {
    const anyMatch = encounter.roomTagsAny.some((t) => roleTags.has(t) || allowed.has(t));
    if (!anyMatch) return { ok: false, reason: 'no matching room tag' };
  }
  // Explicit exclusions.
  for (const tag of encounter.roomTagsProhibited || []) {
    if (roleTags.has(tag) || allowed.has(tag)) return { ok: false, reason: `prohibited ${tag}` };
  }

  const zonesAvailable = new Set((template.spawnZones || []).map((z) => z.zone));
  let supportCount = 0;
  const healers = [];
  const shielders = [];

  for (const group of encounter.spawnGroups) {
    // R-ENM-008: an encounter cannot ask for a zone this template does not declare,
    // because the enemy would land somewhere the navigation validator never checked.
    if (!zonesAvailable.has(group.zone)) {
      return { ok: false, reason: `no ${group.zone} zone` };
    }
    for (const entry of group.entries) {
      const def = registry.get('enemy', entry.enemy);
      if (!def) return { ok: false, reason: `unknown enemy ${entry.enemy}` };

      // The template can veto behaviours its geometry cannot support: a room with no
      // clear lane cannot host a charger, and a room with no perimeter cannot host a
      // wall follower.
      for (const tag of def.tags) {
        if (prohibitedEnemyTags.has(tag)) return { ok: false, reason: `enemy tag ${tag} prohibited` };
      }
      // The enemy's own room requirements must be satisfied.
      for (const req of def.roomRequirements || []) {
        if (!roleTags.has(req) && !allowed.has(req)) {
          return { ok: false, reason: `${def.id} needs ${req}` };
        }
      }
      if (def.tags.includes('SUPPORT')) supportCount += entry.count[1];
      if (def.tags.includes('HEALER')) healers.push(def.id);
      if (def.tags.includes('SHIELDER')) shielders.push(def.id);
    }
  }

  // GDD 6.6 "avoid prohibited support combinations" and R-ENM-003.
  if (supportCount > encounter.constraints.maxSupport) {
    return { ok: false, reason: 'support over declared cap' };
  }
  // Two healers can trade heals faster than a player can burst either down; two
  // shielders of the same kind can cover each other. Both are the infinite loops
  // R-ENM-003 names, so they are refused regardless of what the data declares.
  if (healers.length > 1) return { ok: false, reason: 'multiple healers (R-ENM-003)' };
  if (shielders.length > 1 && new Set(shielders).size === 1) {
    return { ok: false, reason: 'mutually shielding pair (R-ENM-003)' };
  }

  // R-ENM-006 / GDD 20.7: bounded quantity per room.
  const simultaneous = maxSimultaneous(encounter);
  const cap = encounter.constraints.maxSimultaneousHostiles ?? BUDGETS.maxHostilesPerRoom;
  if (simultaneous > Math.min(cap, BUDGETS.maxHostilesPerRoom)) {
    return { ok: false, reason: 'over hostile cap' };
  }

  return { ok: true };
}

/**
 * Choose an encounter for one room, or null for an empty room.
 *
 * @param {object} args
 * @param {object} args.node graph node
 * @param {object} args.template its chosen room template
 * @param {object} args.floorDef
 * @param {object} args.registry
 * @param {import('../core/rng.js').RngSource} args.rngSource
 * @param {number} [args.emptyChance] probability the room is deliberately empty
 * @returns {{encounter: object|null, budget: number, reason?: string}}
 */
export function selectEncounter({
  node, template, floorDef, registry, rngSource, emptyChance = 0.16,
}) {
  const depth = floorDef.depth;
  const department = floorDef.departmentTag;
  const budget = encounterBudget({ depth, sizeClass: node.sizeClass, difficulty: floorDef.difficulty });

  // ENCOUNTER owns this decision, so an encounter roll can never shift floor
  // layout, template choice, or loot (GDD 20.4).
  const rng = rngSource.stream(RNG_STREAMS.ENCOUNTER, floorDef.id, node.id);

  // GDD 12.2 / R-ROM-001: "An empty version of a combat-capable room is valid."
  // Some rooms being quiet is what gives the floor rhythm (GDD 3.2's "Clear:
  // relief" beat), so it is a deliberate roll rather than an accident of filtering.
  if (node.role !== ROOM_ROLE.MANAGER_OFFICE && rng.chance(emptyChance)) {
    return { encounter: null, budget, reason: 'authored empty' };
  }

  const all = registry.all('encounter');
  const candidates = [];
  for (const encounter of all) {
    const compat = isCompatible(encounter, { room: node, template, depth, department, registry });
    if (!compat.ok) continue;
    // The room's budget must fall inside the encounter's declared range. This is the
    // GDD 6.6 rule that keeps a floor-one room from receiving a floor-six fight.
    const [lo, hi] = encounter.budgetRange;
    if (budget < lo || budget > hi) continue;
    candidates.push(encounter);
  }

  if (candidates.length === 0) {
    // No authored encounter fits. An empty room is the correct outcome — inventing
    // one by pouring in enemies is exactly what GDD 6.6 forbids.
    return { encounter: null, budget, reason: 'no compatible encounter' };
  }

  const chosen = rng.pickWeighted(candidates, (e) => e.weight);
  return { encounter: chosen ?? null, budget };
}

/**
 * Resolve an encounter's spawn list into concrete spawn requests.
 *
 * Counts are rolled here rather than at spawn time so the whole room's composition
 * is known before anything is placed, which is what lets the caller verify the
 * hostile cap before committing (R-ENM-006).
 */
export function resolveSpawns({ encounter, node, floorDef, rngSource, wave = 0 }) {
  const rng = rngSource.stream(RNG_STREAMS.ENCOUNTER, floorDef.id, node.id, 'spawns', wave);
  const out = [];
  for (const group of encounter.spawnGroups) {
    if ((group.wave ?? 0) !== wave) continue;
    for (const entry of group.entries) {
      const count = rng.int(entry.count[0], entry.count[1]);
      for (let i = 0; i < count; i += 1) {
        out.push({ enemyId: entry.enemy, variantId: entry.variant ?? null, zone: group.zone });
      }
    }
  }
  return out;
}

/** Highest wave index an encounter declares. */
export function waveCount(encounter) {
  let max = 0;
  for (const group of encounter.spawnGroups) {
    const wave = group.wave ?? 0;
    if (wave > max) max = wave;
  }
  return max + 1;
}
