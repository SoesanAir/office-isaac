/**
 * Sprite domain: items. Owns the `item_` prefix (plus `active_`, `card_`, `sup_`,
 * `charm_`, `trn_` when those land).
 *
 * GDD refs: 18.2 / R-ART-001 (readable at native gameplay scale - these bake to
 *           32x32 logical px, so silhouette beats detail), R-ART-002 / R-ITM-002
 *           (every collectible gets a visually distinct sprite), 8.2 (the item's
 *           shape is read off the pedestal before pickup), 18.5 (1px `k` outline
 *           family, `K` underside shadow so nothing looks flat).
 *
 * 60 office objects would collapse into "60 grey rectangles" if drawn honestly, so
 * each one is assigned a *shape language* first and a palette second: the wrist rest
 * is the widest flattest bar, the standing desk the only I-beam, the paperweight the
 * only dome, the laser pointer the only diagonal, the rubber bands the only tangle,
 * the reply-all the only swarm. Colour is reinforcement - every pair here still
 * separates in grayscale.
 *
 * Liability items (open_calendar, wet_keyboard, mandatory_training, reply_all) are
 * deliberately drawn *wrong* - gaping, dripping, padlocked, swarming - so the art
 * agrees with the red frame the UI puts around them.
 *
 * Grids are authored at half the 32px reference grid and baked at `scale: 2`.
 */

const SCALE = 2;

const item = (slug, silhouette, grid) => ({
  id: `item_${slug}`,
  anchor: [0.5, 0.75],
  scale: SCALE,
  silhouette,
  frames: [grid],
});

const items = [
  // ITM-001 Espresso Shot - tiny cup riding a wide saucer. Smallest cup + widest plate.
  item('espresso_shot', 'A tiny cup on an oversized saucer; the only cup-on-plate profile.', [
    '................',
    '................',
    '................',
    '....kkkkkk......',
    '...kwwwwwwk.....',
    '...kwoooook.kk..',
    '...kwoooook.kHk.',
    '....kwooowk.kk..',
    '.....kwwwk......',
    '......kkk.......',
    '..kkkkkkkkkk....',
    '..kHHHHHHHHk....',
    '..kKKKKKKKKk....',
    '...kkkkkkkk.....',
    '................',
    '................',
  ]),

  // ITM-002 Milk Carton - gable top. The only sprite that comes to a roof peak.
  item('milk_carton', 'A gable-topped carton; the only silhouette with a roof peak.', [
    '................',
    '................',
    '.....kkkk.......',
    '....kwwwwk......',
    '...kwwwwwwk.....',
    '...kwwwwwwk.....',
    '..kkkkkkkkkk....',
    '..kwwwwwwwwk....',
    '..kwwbbbbwwk....',
    '..kwwbbbbwwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kKKKKKKKKk....',
    '..kkkkkkkkkk....',
    '................',
  ]),

  // ITM-003 Sugar Packets - a cascade of sachets stepping down to the left.
  item('sugar_packets', 'Three paper sachets fanned in a descending stair-step cascade.', [
    '................',
    '................',
    '................',
    '.......kkkkk....',
    '......kwwwwk....',
    '.....kkwwwwk....',
    '.....kwwwwkk....',
    '....kkwwwwk.....',
    '....kwHHwkk.....',
    '...kkwHHwk......',
    '...kwwwwk.......',
    '...kkkkkk.......',
    '................',
    '................',
    '................',
    '................',
  ]),

  // ITM-004 Mechanical Switches - loose parts cluster, stems up. Not a slab: three bodies.
  item('mechanical_switches', 'A loose cluster of three small bodies with stems poking up.', [
    '................',
    '................',
    '.....kk.........',
    '.....hh.........',
    '....kkkkkk......',
    '....kRRRRk......',
    '....kRRRRk......',
    '....kkkkkk......',
    '..kk......kk....',
    '..hh......hh....',
    '.kkkkkk.kkkkkk..',
    '.kRRRRk.kRRRRk..',
    '.kRRRRk.kRRRRk..',
    '.kkkkkk.kkkkkk..',
    '................',
    '................',
  ]),

  // ITM-005 Heavy Keycaps - two thick slabs stacked. Reads as mass, not as a keyboard.
  item('heavy_keycaps', 'Two thick slabs stacked into a double-decker block; reads heavy.', [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kHHHHHHHHHHk..',
    '..kHHHHHHHHHHk..',
    '..kGGGGGGGGGGk..',
    '..kKKKKKKKKKKk..',
    '..kkkkkkkkkkkk..',
    '..kkkkkkkkkkkk..',
    '..kHHHHHHHHHHk..',
    '..kHHHHHHHHHHk..',
    '..kGGGGGGGGGGk..',
    '..kKKKKKKKKKKk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ]),

  // ITM-006 Ergonomic Chair - tall mesh back over a five-star caster base.
  item('ergonomic_chair', 'Tall mesh back above a single post and a five-star caster base.', [
    '................',
    '..kkkkkkkkkkk...',
    '..kGhhhhhhhGk...',
    '..kGhkhkhkhGk...',
    '..kGhhhhhhhGk...',
    '..kGhkhkhkhGk...',
    '..kkkkkkkkkkk...',
    '.kkkkkkkkkkkkk..',
    '.kGGGGGGGGGGGk..',
    '.kkkkkkkkkkkkk..',
    '......kkkk......',
    '......kGHk......',
    '......kGHk......',
    '..kkkkkkkkkkkk..',
    '..kKKkkKKkkKKk..',
    '..k..kk..kk..k..',
  ]),

  // ITM-007 Standing Desk - full-width top on one tall column. The only I-beam.
  item('standing_desk', 'A full-width top on one tall centre column; the only I-beam shape.', [
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    '......kkkk......',
    '......kGHk......',
    '......kGHk......',
    '......kGHk......',
    '......kGHk......',
    '......kGHk......',
    '......kGHk......',
    '....kkkkkkkk....',
    '....kGGGGGGk....',
    '....kkkkkkkk....',
    '................',
  ]),

  // ITM-008 Blue Light Glasses - two round tinted lenses bridged, temples at the edges.
  item('blue_light_glasses', 'Two round tinted lenses joined by a bridge, temples out to the edges.', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..kkkk....kkkk..',
    '.kcccck..kcccck.',
    'kkcCcckkkkcCcckk',
    '.kcccck..kcccck.',
    '.kcccck..kcccck.',
    '..kkkk....kkkk..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),

  // ITM-009 Wrist Rest - edge to edge, five rows tall. The flattest thing in the set.
  item('wrist_rest', 'An edge-to-edge padded bar; the widest and flattest silhouette here.', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kHHHHHHHHHHHHHHk',
    'kHhhhhhhhhhhhhHk',
    'kKKKKKKKKKKKKKKk',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),

  // ITM-010 Dual Monitors - two panels side by side, each on its own foot. Mirrored pair.
  item('dual_monitors', 'A mirrored pair of panels, each on its own stand and foot.', [
    '................',
    '..kkkkkk.kkkkkk.',
    '..kbbbbk.kbbbbk.',
    '..kbCCbk.kbCCbk.',
    '..kbbbbk.kbbbbk.',
    '..kbbbbk.kbbbbk.',
    '..kkkkkk.kkkkkk.',
    '....kGk....kGk..',
    '....kGk....kGk..',
    '..kkkkkk.kkkkkk.',
    '..kGGGGk.kGGGGk.',
    '..kkkkkk.kkkkkk.',
    '................',
    '................',
    '................',
    '................',
  ]),

  // ITM-011 Pen Laser Pointer - the only diagonal in the set, red beam dot off the tip.
  item('pen_laser_pointer', 'A slim diagonal barrel with a red beam dot floating off the tip.', [
    '................',
    '..............R.',
    '...........kkk..',
    '..........kRRk..',
    '.........kHHk...',
    '........kHHk....',
    '.......kHHk.....',
    '......kHGk......',
    '.....kHGk.......',
    '....kHGkk.......',
    '...kHGkk........',
    '..kHGk..........',
    '..kGk...........',
    '..kk............',
    '................',
    '................',
  ]),

  // ITM-012 Numeric Keypad - tall block ruled into a fine 4x4 key grid.
  item('numeric_keypad', 'A tall narrow block ruled into a fine four-by-four key grid.', [
    '................',
    '.kkkkkkkkkkkkk..',
    '.kwwgwwgwwgwwk..',
    '.kwwgwwgwwgwwk..',
    '.kgggggggggggk..',
    '.kwwgwwgwwgwwk..',
    '.kwwgwwgwwgwwk..',
    '.kgggggggggggk..',
    '.kwwgwwgwwgwwk..',
    '.kwwgwwgwwgwwk..',
    '.kgggggggggggk..',
    '.kwwgwwgwwgwwk..',
    '.kwwgwwgwwgwwk..',
    '.kKKKKKKKKKKKk..',
    '.kkkkkkkkkkkkk..',
    '................',
  ]),
];

export default items;
