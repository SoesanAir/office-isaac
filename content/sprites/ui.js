/**
 * Sprite domain: HUD status icons. Owns the `ui_` id prefix.
 *
 * GDD refs: 5.5 (the status table, whose "Visual rule" column is the brief for each icon
 *           below), 17.2 (HUD layout), 18.4 (layer priority — active status is "mechanic
 *           critical", tier 2, above identity and decoration), R-UIX-005 (no mechanic depends
 *           on colour alone), R-ART-001 (readable at native gameplay scale).
 *
 * These were referenced long before they existed. `STATUS_RULES` in src/entities/status.js names
 * an `iconId` for all nine statuses and `describe()` is even commented "HUD-ready list" — but
 * nothing authored the sprites and nothing drew them. The player had no way to see they were
 * burning.
 *
 * Content validation could not catch it: the validator checks `spriteId` fields on content
 * definitions, and these ids live in a *code* table instead. tests/sprites.test.js now scans
 * source for sprite ids as well, which is the durable half of this fix.
 *
 * ## Shape carries the meaning, colour only confirms it
 *
 * R-UIX-005 matters more here than anywhere else in the game. Slow and Shock are both blue, Burn
 * and Marked are both warm, and a status icon is the smallest thing on the HUD — so all nine are
 * different silhouettes, each legible with the colour removed:
 *
 *   slow       double chevron pointing down       deceleration
 *   haste      two forward streaks                 GDD's "short motion streaks"
 *   burn       flame                               GDD's "orange edge flame"
 *   shock      lightning bolt                      GDD's "white-blue snap"
 *   marked     four corner brackets round a dot    GDD's "highlighter outline"
 *   confused   question hook, rotating             GDD's "spinning icon"
 *   rooted     binder clip over a pin              GDD names the binder clip explicitly
 *   silenced   speaker crossed by a slash          GDD's "muted speaker icon"
 *   charmed    heart                               not in GDD 5.5's table (enemy-only), so
 *                                                  authored to the convention players expect
 *
 * Authored on an 8x8 grid at `scale: 2` for a 16px icon, close enough to the 14px glyph pitch the
 * rest of the HUD uses to sit in the same column without a second layout rule.
 */

const SCALE = 2;

const icon = (slug, silhouette, frames) => ({
  id: `ui_status_${slug}`,
  // Top-left anchored: the HUD lays these out on a grid, and a centred anchor would make every
  // position calculation carry a half-icon offset.
  anchor: [0, 0],
  scale: SCALE,
  silhouette,
  frames,
});

const ui = [
  // Slow — GDD 5.5: "Blue-gray trail". Pointing down, because deceleration reads as downward.
  icon('slow', 'Double chevron pointing down.', [[
    '.bb..bb.',
    '..bbbb..',
    '...bb...',
    '........',
    '.bb..bb.',
    '..bbbb..',
    '...bb...',
    '........',
  ]]),

  // Haste — GDD 5.5: "Short motion streaks". Deliberately the opposite direction to Slow, so the
  // two opposed effects read as opposed arrows.
  icon('haste', 'Two forward-leaning motion streaks.', [[
    '........',
    '.y...y..',
    '..y...y.',
    '...y...y',
    '..y...y.',
    '.y...y..',
    '........',
    '........',
  ]]),

  // Burn — GDD 5.5: "Orange edge flame, low particle count". Two frames, because a flame that
  // does not move reads as a leaf.
  icon('burn', 'Flame with a pale core.', [[
    '...O....',
    '..OO....',
    '..OOO...',
    '.OyOO...',
    '.OyyO...',
    '.OOyOO..',
    '..OOO...',
    '........',
  ], [
    '....O...',
    '....OO..',
    '...OOO..',
    '...OOyO.',
    '...OyyO.',
    '..OOyOO.',
    '...OOO..',
    '........',
  ]]),

  // Shock — GDD 5.5: "White-blue snap with clear chain line".
  icon('shock', 'Lightning bolt.', [[
    '....CC..',
    '...CC...',
    '..CCC...',
    '.CCCC...',
    '...CC...',
    '..CC....',
    '.CC.....',
    '........',
  ]]),

  // Marked — GDD 5.5: "Highlighter outline". Corner brackets rather than a filled shape, so it
  // reads as something drawn *around* the target rather than as another projectile.
  icon('marked', 'Four corner brackets around a centre dot.', [[
    'yy....yy',
    'y......y',
    '........',
    '...yy...',
    '...yy...',
    '........',
    'y......y',
    'yy....yy',
  ]]),

  // Confused — GDD 5.5: "Spinning icon and altered gait". Two frames that mirror the hook, so it
  // visibly turns rather than merely existing.
  icon('confused', 'A question hook that rotates.', [[
    '..MMM...',
    '.M...M..',
    '.....M..',
    '....M...',
    '...M....',
    '...M....',
    '........',
    '...M....',
  ], [
    '...MMM..',
    '..M...M.',
    '..M.....',
    '...M....',
    '....M...',
    '....M...',
    '........',
    '....M...',
  ]]),

  // Rooted — GDD 5.5 names the shape outright: "Binder-clip icon and floor pin".
  icon('rooted', 'Binder clip above a floor pin.', [[
    '..gggg..',
    '.g....g.',
    '.g....g.',
    '.gggggg.',
    '...gg...',
    '...gg...',
    '..gGGg..',
    '........',
  ]]),

  // Silenced — GDD 5.5: "Muted speaker icon". The slash is drawn in the hostile red so "something
  // was taken from you" reads before the icon itself is identified.
  icon('silenced', 'Speaker crossed by a slash.', [[
    '...hh..r',
    '..hhh.r.',
    '.hhhhr..',
    '.hhhr...',
    '.hhrh...',
    '.hrhh...',
    '..rhh...',
    '.r......',
  ]]),

  // Charmed — absent from GDD 5.5's table because it is enemy-only, so this follows the
  // convention every player already knows rather than inventing a private symbol.
  icon('charmed', 'Heart.', [[
    '.pp..pp.',
    'pppppppp',
    'pppppppp',
    '.pppppp.',
    '..pppp..',
    '...pp...',
    '........',
    '........',
  ]]),
];

export default ui;
