/**
 * Enemy aggregator.
 *
 * GDD refs: §14 (Enemy System), Appendix D.
 *
 * One file per department group, so several authors can work without collisions and
 * this file stays the single place they are joined. The grouping is also a difficulty
 * curriculum, which is why the order matters to a reader even though it does not matter
 * to the loader:
 *
 *   open-office-it.js  ENM-001..024  Open Office, then IT. Movement reading, then target
 *                                    priority.
 *   operations.js      ENM-025..036  Operations. Space: lanes, obstacles, and rooms that
 *                                    narrow while you fight in them.
 *   executive.js       ENM-037..048  Executive, Finance, and the cross-department
 *                                    managers. Permission — half the roster decides when
 *                                    you are allowed to deal damage.
 *   alternate.js       ENM-049..058  Marketing, Legal, Facilities, R&D, and the hidden
 *                                    departments. Six departments in ten enemies, so
 *                                    these are one-off ideas rather than a roster.
 */

import openOfficeIt from './open-office-it.js';
import operations from './operations.js';
import executive from './executive.js';
import alternate from './alternate.js';

export default [
  ...openOfficeIt,
  ...operations,
  ...executive,
  ...alternate,
];
