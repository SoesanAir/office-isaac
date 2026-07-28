/**
 * Endings.
 *
 * GDD refs: 16.7 (ending registry, all nine), 16.4 (repeated CEO victories),
 *           16.5 (deeper hidden route), D-015 (the first apparent ending is not
 *           the real end), D-016 (the game never announces the total number of
 *           endings), R-PRG-004 (no denominator anywhere in the UI),
 *           R-QA-007 (fresh-save UI reveals nothing undiscovered).
 *
 * Endings are authored as beat sequences rather than code so no ending is
 * hardcoded, and so END-004's trick works: it plays CREDITS, then interrupts them
 * with CREDITS_INTERRUPT and an ELEVATOR beat. That single beat is the whole
 * structural surprise of GDD 16.4, and it is data.
 *
 * `terminal` marks whether an ending closes the run. Note that END-007 Subsidiary
 * is deliberately non-terminal despite appearing final — GDD 16.7 says it "appears
 * terminal but is not".
 */

const ending = (id, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `ending.${spec.slug}.name`,
  conditionLoc: `ending.${spec.slug}.condition`,
  beats: spec.beats,
  terminal: spec.terminal,
  hidden: spec.hidden ?? false,
});

const endings = [
  ending('END-001', {
    slug: 'termination',
    terminal: true,
    beats: [
      { kind: 'SCENE', seconds: 3.0, params: { scene: 'ceo_office_after' } },
      { kind: 'TEXT', seconds: 4.0, textLoc: 'ending.termination.beat_1' },
      { kind: 'SCENE', seconds: 3.0, params: { scene: 'security_escort' } },
      { kind: 'CREDITS', seconds: 20 },
    ],
  }),
  ending('END-002', {
    slug: 'promotion',
    terminal: true,
    beats: [
      { kind: 'TEXT', seconds: 3.5, textLoc: 'ending.promotion.beat_1' },
      // The office that looks suspiciously like a cell (GDD 16.7). The joke lands
      // visually, so the text stays short.
      { kind: 'SCENE', seconds: 4.5, params: { scene: 'corner_office_cell' } },
      { kind: 'CREDITS', seconds: 20 },
    ],
  }),
  ending('END-003', {
    slug: 'golden_handshake',
    terminal: true,
    beats: [
      { kind: 'SCENE', seconds: 3.0, params: { scene: 'settlement_table' } },
      { kind: 'TEXT', seconds: 4.0, textLoc: 'ending.golden_handshake.beat_1' },
      { kind: 'FADE', seconds: 1.5 },
      { kind: 'CREDITS', seconds: 20 },
    ],
  }),
  ending('END-004', {
    slug: 'elevator_keeps_going',
    // The pivot of the whole game. Not terminal, and deliberately unannounced.
    terminal: false,
    hidden: true,
    beats: [
      { kind: 'TEXT', seconds: 3.0, textLoc: 'ending.elevator_keeps_going.beat_1' },
      { kind: 'CREDITS', seconds: 6 },
      // Credits begin, then stop (GDD END-004). No banner, no fanfare.
      { kind: 'CREDITS_INTERRUPT', seconds: 2.0 },
      { kind: 'ELEVATOR', seconds: 4.0, params: { destination: 'ROUTE-BOARD', announce: false } },
    ],
  }),
  ending('END-005', {
    slug: 'quorum',
    terminal: false,
    hidden: true,
    beats: [
      { kind: 'SCENE', seconds: 3.5, params: { scene: 'empty_boardroom' } },
      { kind: 'TEXT', seconds: 4.0, textLoc: 'ending.quorum.beat_1' },
      { kind: 'SCENE', seconds: 3.0, params: { scene: 'ownership_documents' } },
      { kind: 'FADE', seconds: 1.5 },
    ],
  }),
  ending('END-006', {
    slug: 'hostile_takeover',
    terminal: true,
    hidden: true,
    beats: [
      // "The player becomes the acquiring entity for one frame before being
      // acquired again" (GDD 16.7). The timing is the joke, so it is exact.
      { kind: 'SCENE', seconds: 0.05, params: { scene: 'player_as_owner' } },
      { kind: 'SCENE', seconds: 3.5, params: { scene: 'player_reacquired' } },
      { kind: 'TEXT', seconds: 3.5, textLoc: 'ending.hostile_takeover.beat_1' },
      { kind: 'CREDITS', seconds: 18 },
    ],
  }),
  ending('END-007', {
    slug: 'subsidiary',
    // Appears terminal but is not (GDD 16.7). It even rolls credits.
    terminal: false,
    hidden: true,
    beats: [
      { kind: 'SCENE', seconds: 3.5, params: { scene: 'org_chart_zoom_out' } },
      { kind: 'TEXT', seconds: 4.5, textLoc: 'ending.subsidiary.beat_1' },
      { kind: 'SCENE', seconds: 3.0, params: { scene: 'company_logo_erased' } },
      { kind: 'CREDITS', seconds: 14 },
      { kind: 'FADE', seconds: 2.0 },
    ],
  }),
  ending('END-008', {
    slug: 'consolidated',
    terminal: false,
    hidden: true,
    beats: [
      { kind: 'SCENE', seconds: 4.0, params: { scene: 'logos_merging' } },
      { kind: 'TEXT', seconds: 4.0, textLoc: 'ending.consolidated.beat_1' },
      { kind: 'FADE', seconds: 2.0 },
    ],
  }),
  ending('END-009', {
    slug: 'beneficial_ownership',
    terminal: true,
    hidden: true,
    beats: [
      { kind: 'SCENE', seconds: 4.0, params: { scene: 'empty_room_above' } },
      { kind: 'TEXT', seconds: 5.0, textLoc: 'ending.beneficial_ownership.beat_1' },
      { kind: 'SCENE', seconds: 4.0, params: { scene: 'single_chair' } },
      { kind: 'TEXT', seconds: 4.0, textLoc: 'ending.beneficial_ownership.beat_2' },
      // R-PRG-004 / D-016: completion shows no total. The credits simply roll.
      { kind: 'CREDITS', seconds: 24 },
    ],
  }),
];

export default endings;
