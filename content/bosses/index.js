/**
 * Boss aggregator. BSS-001..029, Appendix E.
 *
 * Split by tier so several authors can work without id collisions, and because the three
 * groups genuinely differ in kind:
 *
 *   early.js  BSS-001..010  Open Office, IT, early Operations. Each teaches exactly one
 *                           thing, with the most generous telegraphs in the game.
 *   mid.js    BSS-011..020  Operations, Executive, Finance, Marketing. BSS-016 CEO is
 *                           the "first apparent final boss" and the hinge of the routes.
 *   late.js   BSS-021..029  Legal, Facilities, R&D, and the post-CEO ownership chain.
 *                           Three of these are built by quoting earlier content.
 *
 * File order is for readability only; selection is by `floorPools` (GDD 15.2).
 */

import early from './early.js';
import mid from './mid.js';
import late from './late.js';

export default [...early, ...mid, ...late];
