/**
 * TPL-* authored room architecture. GDD 11-12, F.3.
 *
 * Content kind: roomTemplate. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * Aggregator only. Open Office is authored longhand; the other twelve departments are
 * expanded from flavour specs in departments.js (see _department-core.js for why).
 * Shared service templates live in the Open Office packs and carry the SERVICE_SHARED
 * department tag, so every department draws them without a copy per floor.
 */

import openOffice from './open-office.js';
import departments from './departments.js';

export default [
  ...openOffice,
  ...departments,
];
