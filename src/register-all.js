/**
 * Registration aggregator.
 *
 * Importing this module has one job: make sure every effect hook, modifier
 * adapter, enemy/boss behaviour module, and sprite definition is registered
 * before anything tries to resolve one by id.
 *
 * GDD refs: R-TEC-001 (content outside core logic), R-TEC-005 (fail loudly at
 *           load), 20.3 (behaviour composed from curated modules; arbitrary
 *           runtime AI generation is prohibited).
 *
 * Both the browser entry point and the headless tools import this, so the two
 * environments always see an identical behaviour surface.
 */

import { defineSprite, getSpriteDef } from './render/sprites.js';
import spriteDefs from '../content/sprites/index.js';

// Behaviour modules. Each of these files calls defineHook / defineAdapter /
// registerController at import time.
import './systems/hooks/stat-hooks.js';
import './systems/hooks/combat-hooks.js';
import './systems/hooks/economy-hooks.js';
import './systems/hooks/world-hooks.js';
import './systems/hooks/active-hooks.js';
import './systems/hooks/card-hooks.js';
import './systems/hooks/supplement-hooks.js';
import './systems/hooks/charm-hooks.js';
import './systems/hooks/transformation-hooks.js';
import './systems/adapters/projectile-adapters.js';
import './systems/adapters/melee-adapters.js';
import './systems/adapters/beam-adapters.js';
import './systems/adapters/pattern-adapters.js';
import './entities/enemy-controllers.js';
import './entities/behavior-modules.js';
import './entities/boss-patterns.js';

let spritesRegistered = false;

/** Idempotent: the aggregator may be imported from several entry points. */
export function registerSprites() {
  if (spritesRegistered) return;
  for (const def of spriteDefs) {
    if (!getSpriteDef(def.id)) defineSprite(def);
  }
  spritesRegistered = true;
}

registerSprites();
