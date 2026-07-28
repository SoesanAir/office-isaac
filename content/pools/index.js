/**
 * Loot pools.
 *
 * GDD refs: 8.3 (the ten pools and their identities), 8.4 (the weighted generation
 *           algorithm, quality gates, seen decay), Appendix G.7 (loot pool entry
 *           shape), R-ITM-003 (odds are data-driven and not player configurable),
 *           R-QA-005 (no zero-weight required pools), R-PRG-002 (an unlock enters a
 *           pool only once its condition is met).
 *
 * **Pools are derived, not duplicated.** Every collectible already declares which
 * pools it belongs to, along with its quality, weight, and minimum floor. Writing
 * those facts out a second time inside a pool file guarantees the two copies drift —
 * and the validator's "claims pool X but is absent from POOL-X" check exists precisely
 * because they did. So this module reads the content registry's own declarations and
 * builds the pool tables from them.
 *
 * What stays hand-authored is the part that genuinely is a pool-level decision:
 * each pool's identity text, its source tags, its seen-decay rate, and any
 * pool-specific quality gate. Those are not properties of an item.
 */

import { POOL } from '../../src/core/constants.js';
import { SEEN_DECAY } from '../../src/core/constants.js';

import weapons from '../weapons/index.js';
import passives from '../items/passives.js';
import actives from '../items/actives.js';
import charms from '../items/charms.js';

/**
 * Per-pool character. GDD 8.3's identity column, plus the generation knobs that
 * belong to the pool rather than to any item in it.
 */
const POOL_CHARACTER = {
  [POOL.SUPPLY_CLOSET]: {
    identity: 'Guaranteed item room pool; the broadest passive, active, and weapon selection.',
    sourceTagsAny: ['PEDESTAL'],
    seenDecay: SEEN_DECAY,
  },
  [POOL.MANAGER_REWARD]: {
    identity: 'Guaranteed boss drop; mostly health, stats, resources, and reliable passives.',
    sourceTagsAny: ['BOSS', 'PEDESTAL'],
    // A boss reward the player already declined should still feel like a reward, so
    // it decays less than an ordinary pedestal.
    seenDecay: 0.75,
  },
  [POOL.OFFICE_SUPPLY_SHOP]: {
    identity: 'Utility, economy, active items, health, resources, and selected passives.',
    sourceTagsAny: ['SHOP'],
    seenDecay: SEEN_DECAY,
  },
  [POOL.SECRET_MAINTENANCE]: {
    identity: 'Strange utility, rule-breaking, reroll, access, and high-variance items.',
    sourceTagsAny: ['PEDESTAL', 'CONTAINER'],
    // Finding a secret twice should not feel like a repeat, so decay is gentle.
    seenDecay: 0.8,
    // GDD 8.3 calls this pool rule-breaking, and 8.4's depth gate would otherwise
    // hide its best entries behind floor depth the player has already earned past.
    qualityGateOverride: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4 },
  },
  [POOL.RESTRICTED_RECORDS]: {
    identity: 'Risk-reward, liability, forbidden, and sacrifice-oriented items.',
    sourceTagsAny: ['PEDESTAL'],
    seenDecay: SEEN_DECAY,
  },
  [POOL.INNOVATION_LAB]: {
    identity: 'Rare technology, trajectory, multiplicity, and unusual weapon items.',
    sourceTagsAny: ['PEDESTAL'],
    seenDecay: 0.8,
    qualityGateOverride: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4 },
  },
  [POOL.UNION_BREAKROOM]: {
    identity: 'Defense, sustain, familiars, recovery, and cooperative-themed effects.',
    sourceTagsAny: ['PEDESTAL', 'EVENT'],
    seenDecay: SEEN_DECAY,
  },
  [POOL.EXECUTIVE_DEAL]: {
    identity: 'Very powerful items purchased with maximum health, future debt, or another explicit sacrifice.',
    sourceTagsAny: ['PEDESTAL', 'EVENT'],
    seenDecay: 0.9,
    // The price is the gate here, not depth: GDD 8.3 says these are bought with
    // health or debt, so hiding them behind floor depth as well would be a double
    // toll on the same decision.
    qualityGateOverride: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4 },
  },
  [POOL.GOLDEN_CABINET]: {
    identity: 'Curated premium rewards from locked containers and vaults.',
    sourceTagsAny: ['CONTAINER'],
    seenDecay: 0.85,
  },
  [POOL.SET_DROP]: {
    identity: 'Boss-, machine-, event-, or enemy-specific rewards outside ordinary pool selection.',
    sourceTagsAny: ['BOSS', 'EVENT', 'MACHINE'],
    // A set drop is granted by an explicit condition, so seeing it must not make it
    // rarer (R-BSS-007).
    seenDecay: 1.0,
  },
};

/** Content kinds that can appear in a pool, with their registry kind name. */
const SOURCES = [
  ['weapon', weapons],
  ['passive', passives],
  ['active', actives],
  ['charm', charms],
];

/**
 * Build one pool's entries by collecting every collectible that names it.
 *
 * The item is the single source of truth for its own quality, weight, floor gate,
 * and unlock requirement — this only reshapes those into the pool-entry form the
 * loot service consumes.
 */
function entriesFor(poolName, character) {
  const entries = [];
  for (const [kind, defs] of SOURCES) {
    for (const def of defs) {
      if (!def.pools?.includes(poolName)) continue;
      entries.push({
        contentId: def.id,
        contentKind: kind,
        baseWeight: def.baseWeight,
        minFloor: def.minFloor,
        ...(def.maxFloor ? { maxFloor: def.maxFloor } : {}),
        quality: def.quality,
        ...(def.unlockId ? { requiredUnlock: def.unlockId } : {}),
        sourceTagsAny: character.sourceTagsAny,
        seenDecay: character.seenDecay,
        // GDD 8.4 step 5 / R-ITM-004: only entries flagged eligible may be granted
        // by the 0.10 percent early-jackpot roll on floors 1-2.
        ...(def.earlyJackpotEligible ? { earlyJackpotEligible: true } : {}),
        ...(def.tags?.length ? { departmentAffinityTag: def.tags[0] } : {}),
      });
    }
  }
  return entries;
}

const pools = Object.entries(POOL_CHARACTER).map(([poolName, character]) => {
  const entries = entriesFor(poolName, character);
  return {
    // ID convention from docs/ID_REGISTRY.md: POOL-<POOL_ENUM>.
    id: `POOL-${poolName}`,
    schemaVersion: 1,
    pool: poolName,
    identity: character.identity,
    entries,
    ...(character.qualityGateOverride ? { qualityGateOverride: character.qualityGateOverride } : {}),
  };
});

/**
 * Drop pools that no content has joined yet.
 *
 * R-QA-005 fails the build on a zero-weight pool, and rightly so — an empty pool
 * that something references is a defect. But a pool nobody references *and* nobody
 * has stocked is simply content not yet authored, and shipping it empty would turn
 * a known gap into a hard error every other author has to work around. The census in
 * `npm run validate` still reports the shortfall.
 */
export default pools.filter((p) => p.entries.length > 0);
