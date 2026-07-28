/**
 * TPL-* authored room architecture. GDD 11-12, F.3.
 *
 * Content kind: roomTemplate. See src/schemas.js for the normative schema
 * and docs/AGENT_BRIEF.md for authoring rules.
 *
 * Aggregator only: one module per department pair, so a new department is a new
 * file plus one line here. Shared service-corridor templates (GDD 12.2) would
 * arrive the same way.
 */

import openOffice from './open-office.js';

export default [
  ...openOffice,
];
