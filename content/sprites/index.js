/**
 * Sprite aggregator.
 *
 * GDD refs: 18.1-18.5 (visual direction, readability, unique collectible
 *           sprites), R-ART-001/002, R-ITM-002, R-DPT-005.
 *
 * Sprites are authored as palette-indexed character grids (see
 * src/render/sprites.js for the DSL and the shared PALETTE). Ownership is split
 * by domain so several authors can work at once without id collisions: each
 * domain module owns a documented id prefix and nothing else may use it.
 *
 * | module                | owns id prefix                              |
 * |-----------------------|---------------------------------------------|
 * | player.js             | player_                                     |
 * | tiles.js              | tile_, wall_, door_, elevator_, pedestal_   |
 * | pickups.js            | pickup_                                     |
 * | ui.js                 | ui_, map_                                   |
 * | vfx.js                | fx_, prj_                                   |
 * | weapons.js            | weapon_                                     |
 * | items.js              | item_                                       |
 * | collectibles.js       | active_, card_, sup_                         |
 * | collectibles-charms.js| charm_, trn_                                |
 * | objects.js            | obj_                                        |
 * | hazards.js            | haz_                                        |
 * | enemies-*.js          | enemy_                                      |
 * | bosses.js             | boss_                                       |
 */

import player from './player.js';
import tiles from './tiles.js';
import pickups from './pickups.js';
import ui from './ui.js';
import vfx from './vfx.js';
import weapons from './weapons.js';
import items from './items.js';
import collectibles from './collectibles.js';
import collectibleCharms from './collectibles-charms.js';
import objects from './objects.js';
import hazards from './hazards.js';
import enemiesOpenOffice from './enemies-open-office.js';
import enemiesIt from './enemies-it.js';
import enemiesOperations from './enemies-operations.js';
import enemiesExecutive from './enemies-executive.js';
import enemiesAlternate from './enemies-alternate.js';
import bosses from './bosses.js';

export default [
  ...player,
  ...tiles,
  ...pickups,
  ...ui,
  ...vfx,
  ...weapons,
  ...items,
  ...collectibles,
  ...collectibleCharms,
  ...objects,
  ...hazards,
  ...enemiesOpenOffice,
  ...enemiesIt,
  ...enemiesOperations,
  ...enemiesExecutive,
  ...enemiesAlternate,
  ...bosses,
];
