/**
 * Encounter aggregator.
 *
 * GDD refs: 12.1 (the encounter layer is selected independently of architecture),
 *           R-FLR-007 / D-006 (a room is a place, not an enemy list).
 *
 * One file per department group. Still to author: Operations, Executive, and the
 * alternate and secret departments, once their enemies exist.
 */

import openOfficeIt from './open-office-it.js';
import departments from './departments.js';

export default [
  ...openOfficeIt,
  ...departments,
];
