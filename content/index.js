/**
 * Content registration entry point.
 *
 * GDD refs: R-GOV-003, R-TEC-001, R-TEC-005 (validated at load time), 20.6.
 *
 * Every content module default-exports an array of definitions. This file is the
 * only place they are wired into the registry, which keeps "add content" a
 * one-line change and gives the validator a single graph to walk.
 *
 * Ordering note: registration order does not matter for cross-references —
 * `registry.link()` resolves them in a second pass — but sprite and sound
 * definitions are registered first so a content author gets a "missing sprite"
 * error from the linker rather than a mystery undefined at bake time.
 */

import { registry } from '../src/core/registry.js';
import { installSchemas } from '../src/schemas.js';

// -- presentation content ---------------------------------------------------
import sprites from './sprites/index.js';
import sounds from './audio/sounds.js';
import music from './audio/music.js';
import localization from './loc/en.js';

// -- world ------------------------------------------------------------------
import envObjects from './world/objects.js';
import hazards from './world/hazards.js';
import objectLootTables from './world/object-loot.js';
import roomTemplates from './rooms/index.js';
import departments from './departments/departments.js';
import floors from './departments/floors.js';
import routes from './departments/routes.js';

// -- combat content ---------------------------------------------------------
import weapons from './weapons/index.js';
import enemies from './enemies/index.js';
import enemyVariants from './enemies/variants.js';
import encounters from './encounters/index.js';
import bosses from './bosses/index.js';

// -- collectibles -----------------------------------------------------------
import passives from './items/passives.js';
import actives from './items/actives.js';
import cards from './items/cards.js';
import supplements from './items/supplements.js';
import charms from './items/charms.js';
import transformations from './items/transformations.js';
import lootPools from './pools/index.js';

// -- meta -------------------------------------------------------------------
import unlocks from './meta/unlocks.js';
import endings from './meta/endings.js';
import profiles from './meta/profiles.js';
import challenges from './meta/challenges.js';

let installed = false;

/**
 * Register all content and resolve cross-references.
 * @param {{strict?: boolean}} [opts] strict throws on validation errors
 * @returns {import('../src/core/registry.js').ContentRegistry}
 */
export function loadContent(opts = {}) {
  if (installed) return registry;
  installSchemas(registry);

  registry.addAll('sprite', sprites);
  registry.addAll('sound', sounds);
  registry.addAll('music', music);
  registry.addAll('localization', localization);

  registry.addAll('envObject', envObjects);
  registry.addAll('hazard', hazards);
  registry.addAll('objectLootTable', objectLootTables);
  registry.addAll('roomTemplate', roomTemplates);
  registry.addAll('department', departments);
  registry.addAll('floor', floors);
  registry.addAll('route', routes);

  registry.addAll('weapon', weapons);
  registry.addAll('enemy', enemies);
  registry.addAll('enemyVariant', enemyVariants);
  registry.addAll('encounter', encounters);
  registry.addAll('boss', bosses);

  registry.addAll('passive', passives);
  registry.addAll('active', actives);
  registry.addAll('card', cards);
  registry.addAll('supplement', supplements);
  registry.addAll('charm', charms);
  registry.addAll('transformation', transformations);
  registry.addAll('lootPool', lootPools);

  registry.addAll('unlock', unlocks);
  registry.addAll('ending', endings);
  registry.addAll('profile', profiles);
  registry.addAll('challenge', challenges);

  registry.link();
  registry.assertValid({ strict: opts.strict ?? false });
  installed = true;
  return registry;
}

export { registry };
