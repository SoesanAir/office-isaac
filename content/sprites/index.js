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
 * The table below is now descriptive rather than aspirational, which it was not before. It
 * claimed tiles.js owned `pedestal_` and vfx.js owned `prj_` while both actually live in
 * pickups.js and weapons.js, and it promised `tile_`, `wall_`, `door_`, `fx_` and `map_`
 * prefixes that nothing defines and nothing asks for — rooms, doors and VFX are drawn
 * procedurally from geometry characters and canvas primitives, not from sprites. tiles.js and
 * vfx.js were empty scaffolds standing in for work that turned out not to be needed, so they
 * are gone. An ownership table that misstates who owns what is how two authors collide on
 * an id, so it is worth keeping honest.
 *
 * | module                | owns id prefix                              |
 * |-----------------------|---------------------------------------------|
 * | player.js             | player_                                     |
 * | pickups.js            | pickup_, pedestal_                          |
 * | ui.js                 | ui_                                         |
 * | weapons.js            | weapon_, prj_                               |
 * | items.js              | item_                                       |
 * | collectibles.js       | active_, card_, sup_                         |
 * | collectibles-charms.js| charm_, trn_                                |
 * | objects.js            | obj_                                        |
 * | hazards.js            | haz_                                        |
 * | enemies-*.js          | enemy_                                      |
 * | bosses-early.js       | boss_ (BSS-001..015)                        |
 * | bosses-late.js        | boss_ (BSS-016..029)                        |
 */

import player from './player.js';
import pickups from './pickups.js';
import ui from './ui.js';
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
import bossesEarly from './bosses-early.js';
import bossesLate from './bosses-late.js';

export default [
  ...player,
  ...pickups,
  ...ui,
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
  ...bossesEarly,
  ...bossesLate,
];
