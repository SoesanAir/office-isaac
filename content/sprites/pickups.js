/**
 * Sprite domain: pickups. Owns the `pickup_` and `pedestal_` id prefixes.
 *
 * GDD refs: 9.2 (the pickup table and its office expressions), 5.2 (health icon
 *           language: stress-ball heart, coffee cup, cracked mug, gold outline),
 *           8.2 (a pedestal's sprite and item silhouette are visible before pickup),
 *           R-UIX-005 (every colour cue has a non-colour cue), R-ART-001 (readable at
 *           native gameplay scale), 18.5 (pickups use their own outline family).
 *
 * Pickups are the smallest thing the player is ever asked to identify at a glance in a
 * busy room, so each one has a distinct *shape*, not just a distinct colour: the credit
 * is a disc, the badge a rectangle, the toner a canister with warning tape, the battery
 * a stubby cylinder, health a heart, caffeine a tapered cup, spite a squat mug with a
 * crack. That holds up in grayscale and under every colour-vision preset.
 *
 * Grids are authored at half the 32px reference grid and baked at `scale: 2`.
 */

const SCALE = 2;

const pickup = (slug, silhouette, frames) => ({
  id: `pickup_${slug}`,
  anchor: [0.5, 0.6],
  scale: SCALE,
  silhouette,
  frames,
});

const pickups = [
  pickup('credit', 'A round coin with a centre notch; the only pure disc.', [[
    '..kkkk..',
    '.kAAAAk.',
    'kAqqqqAk',
    'kAqkkqAk',
    'kAqkkqAk',
    'kAqqqqAk',
    '.kAAAAk.',
    '..kkkk..',
  ]]),

  pickup('access_card', 'A wide rectangle with a punched slot; unmistakably a card.', [[
    '........',
    'kkkkkkkk',
    'kBBBBBBk',
    'kBkkBBBk',
    'kBBBBBBk',
    'kBCCBBBk',
    'kkkkkkkk',
    '........',
  ]]),

  pickup('toner_charge', 'A canister banded with warning tape; the only striped pickup.', [[
    '..kkkk..',
    '.kMMMMk.',
    'kyyyyyyk',
    'kkkkkkkk',
    'kyyyyyyk',
    'kMMMMMMk',
    '.kMMMMk.',
    '..kkkk..',
  ]]),

  pickup('battery', 'A stubby cylinder with a terminal nub on top.', [[
    '...kk...',
    '..kEEk..',
    'kkkkkkkk',
    'kEEEEEEk',
    'kEkkkkEk',
    'kEEEEEEk',
    'kEEEEEEk',
    'kkkkkkkk',
  ]]),

  pickup('composure', 'A stress-ball heart. The core health shape (GDD 5.2).', [[
    '.kk..kk.',
    'kRRkkRRk',
    'kRRRRRRk',
    'kRppRRRk',
    '.kRRRRk.',
    '..kRRk..',
    '...kk...',
    '........',
  ]]),

  pickup('caffeine', 'A tapered takeaway cup with a lid; narrows downward.', [[
    'kkkkkkkk',
    'kwwwwwwk',
    'kkkkkkkk',
    '.kcccck.',
    '.kcccck.',
    '..kcck..',
    '..kcck..',
    '..kkkk..',
  ]]),

  pickup('spite', 'A squat dark mug with a handle and a visible crack.', [[
    '........',
    'kkkkkk..',
    'krrkrrk.',
    'krkkrrkk',
    'krrkrrkr',
    'krrrrrkr',
    'krrrrrkk',
    'kkkkkk..',
  ]]),

  pickup('golden_cushion', 'A gold ring around a soft square; an overlay, not an icon.', [[
    'kAAAAAAk',
    'AkqqqqkA',
    'AqYYYYqA',
    'AqYYYYqA',
    'AqYYYYqA',
    'AqYYYYqA',
    'AkqqqqkA',
    'kAAAAAAk',
  ]]),

  pickup('supplement', 'A blister pack: two bubbles on a foil card. Identity unknown.', [[
    '........',
    'kkkkkkkk',
    'kHHHHHHk',
    'kHVVHVVk',
    'kHVVHVVk',
    'kHHHHHHk',
    'kkkkkkkk',
    '........',
  ]]),

  /**
   * The pedestal itself. GDD 8.2 wants the pedestal language consistent everywhere, so
   * one shape serves every item class and the item above it carries the identity.
   */
  {
    id: 'pedestal_base',
    anchor: [0.5, 0.85],
    scale: SCALE,
    silhouette: 'A low plinth, wider at the base; reads as an offer, not furniture.',
    frames: [[
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....kkkkkkkk....',
      '...kHHHHHHHHk...',
      '...kHhhhhhhHk...',
      '...kHHHHHHHHk...',
      '....kGGGGGGk....',
      '....kGGGGGGk....',
      '..kkGGGGGGGGkk..',
      '..kGGGGGGGGGGk..',
      '..kkkkkkkkkkkk..',
      '................',
    ]],
  },
];

export default pickups;
