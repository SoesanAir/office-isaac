/**
 * Sprite domain: Desk Charms CHR-001..018 and Transformations TRN-001..004.
 * Owns the `charm_` and `trn_` id prefixes, split out of collectibles.js so the
 * eighteen trinkets can be compared against each other in one screenful.
 *
 * GDD refs: 18.2 (16px working grid, x2 scale), R-ART-001 (readable at native
 *           gameplay scale), R-ART-002 / R-ITM-002 (a unique sprite per
 *           collectible), 9.8 (a charm is the narrow class), 8.5 / 18.4 (a
 *           transformation is a rare, *visible* milestone), 8.7 (catalogue).
 *
 * Family rules, inherited from collectibles.js and not renegotiated here:
 *   charm_   trinkets, kept inside the middle 10x10 (rows and cols 3..12) so the
 *            class reads as "small thing" before it reads as any one object.
 *   trn_     the most elaborate class; rare milestones, free to fill the grid.
 *
 * THE PROBLEM. Eighteen small mundane office objects, all of them roughly the
 * same real-world size, all of them drawn in a 10x10 box. Colour cannot carry the
 * difference: a red pushpin and a red snack wrapper are the same sprite in
 * grayscale, and R-ART-002 is a *shape* requirement, not a palette one. So the
 * charms are separated by OUTLINE FIRST. Nine silhouette archetypes are spread
 * across the eighteen — hollow band, dogleg, open bracket, tack, forked, disc,
 * ring, dome, square, tent, plinth, notched strip, tailed medal, star, folded
 * square, pinched waist, hanging loop — and no archetype is used twice. Colour is
 * then applied only as confirmation of an already-distinct shape. The test used
 * while drawing: paint every glyph a single grey and the eighteen must still be
 * eighteen. Where two collided, the shape moved, never the hue:
 *   - spare_button lost its four holes and became a hollow RING, because a
 *     four-hole disc was meeting_token's solid disc with dots on it;
 *   - mini_calendar became a folded A-frame TENT rather than a third square,
 *     since cracked_screen_protector already owns the flat pane and old_password
 *     owns the square with a lifted corner;
 *   - bent_keycard runs DIAGONALLY with a crease and transit_pass runs
 *     HORIZONTALLY with a punched hole and a pointed end, so the two flat strips
 *     never share a bounding box;
 *   - employee_of_the_month_pin keeps two ribbon tails, which is what stops the
 *     third round object in the set from being the first two.
 *
 * The charms are built through `charm()`, which takes a 10x10 box and pads it out
 * to the 16x16 grid. The family constraint is therefore enforced by the helper
 * rather than trusted to eighteen hand-typed grids — the same trick `card()` uses
 * in collectibles.js to guarantee a shared card outline.
 *
 * The four transformations are the opposite brief: the rarest thing in the game,
 * and each one has to read as a permanent change to the player, so each fills the
 * grid and quotes its own effect — the latte's speed streaks, the power user's
 * orbiting key glyphs, the paper trail's shedding scraps, the manager's second
 * body. Nothing in this file is a wrapper or a container: a transformation badge
 * shows the change, never the item that caused it.
 *
 * id                             shape
 * ------------------------------ --------------------------------------------
 * charm_coffee_sleeve            hollow band, open through the middle
 * charm_bent_keycard             thin diagonal strip with a dogleg crease
 * charm_usb_cap                  open-ended bracket, bitten out underneath
 * charm_red_pushpin              round head over a single-pixel needle
 * charm_tiny_plant               forked leaves above a tapered pot
 * charm_meeting_token            solid disc with one notch bitten from the rim
 * charm_rubber_foot              wide flat-bottomed dome, wider than it is tall
 * charm_cracked_screen_protector flat pane, zigzag crack, chipped corner
 * charm_frayed_cable             serpentine cord splitting into three strands
 * charm_spare_button             ring, hollow to the background
 * charm_mini_calendar            A-frame tent standing on the floor
 * charm_nameplate                low engraved bar on a wide dark plinth
 * charm_transit_pass             horizontal strip, punched hole, pointed end
 * charm_employee_of_the_month_pin round medal with two forked ribbon tails
 * charm_paper_star                five-pointed star
 * charm_old_password              square note with one corner folded up
 * charm_snack_wrapper             two lobes pinched to a twisted waist
 * charm_lucky_lanyard             tall hanging loop closed by a clip
 * trn_latte                      cup, foam crown, steam, speed streaks
 * trn_power_user                 keycap under an orbit of loose key glyphs
 * trn_paper_trail                torn sheet shedding scraps to the lower left
 * trn_middle_management          two bodies, the small one holding a clipboard
 */

const SCALE = 2;

const spr = (id, silhouette, grid) => ({
  id,
  anchor: [0.5, 0.75],
  scale: SCALE,
  silhouette,
  frames: [grid],
});

const BLANK = '................';
const PAD = '...';

// -- 18 charms: a 10x10 box, padded. The box IS the family signal ------------
//
// `box` is 10 rows of 10 characters, landing on rows and columns 3..12. Anything
// a charm wants to say has to fit there, which is the point: the player must know
// it is a charm before working out which charm it is.

const charm = (slug, silhouette, box) => spr(`charm_${slug}`, silhouette, [
  BLANK,
  BLANK,
  BLANK,
  ...box.map((row) => `${PAD}${row}${PAD}`),
  BLANK,
  BLANK,
  BLANK,
]);

const charms = [
  charm('coffee_sleeve', 'A corrugated band, hollow through the middle, sat on its shadow.', [
    '..........',
    '..kkkkkk..',
    '.kkOOOOkk.',
    '.kO....Ok.',
    '.kO....Ok.',
    '.kO....Ok.',
    '.kO....Ok.',
    '.kkooookk.',
    '..kkkkkk..',
    '..KKKKKK..',
  ]),

  charm('bent_keycard', 'A thin card running corner to corner with a crease kinking it.', [
    '..........',
    '.kkkk.....',
    '.kHHHkk...',
    '.kHbbHkk..',
    '.kkHbbHkk.',
    '..kkHbbHk.',
    '...kkHHHk.',
    '....kkkkk.',
    '.....KKK..',
    '..........',
  ]),

  charm('usb_cap', 'A squat cap, open underneath, showing the socket it came off.', [
    '..........',
    '..........',
    '..kkkkkk..',
    '..kbbbbk..',
    '..kbBBbk..',
    '..kbBBbk..',
    '..kbkkbk..',
    '..kb..bk..',
    '..kk..kk..',
    '..KKKKKK..',
  ]),

  charm('red_pushpin', 'A round red head narrowing to a one-pixel needle.', [
    '..........',
    '...kkkk...',
    '..krrrrk..',
    '..krRRrk..',
    '..krrrrk..',
    '...kkkk...',
    '....hk....',
    '....hk....',
    '.....k....',
    '....KKK...',
  ]),

  charm('tiny_plant', 'Two leaves forking off a stem in a tapered pot.', [
    '..e....e..',
    '..eE..Ee..',
    '...eEEe...',
    '....ee....',
    '..kkkkkk..',
    '..kOOOOk..',
    '..kooook..',
    '...kkkk...',
    '...KKKK...',
    '..........',
  ]),

  charm('meeting_token', 'A solid gold disc with one notch bitten out of the rim.', [
    '..........',
    '...kkkk...',
    '..kAAAAk..',
    '.kAAqqAAk.',
    '.kAqqqAk..',
    '.kAqqqAk..',
    '.kAAqqAAk.',
    '..kAAAAk..',
    '...kkkk...',
    '...KKKK...',
  ]),

  charm('rubber_foot', 'A wide grey dome, flat on the floor and wider than it is tall.', [
    '..........',
    '..........',
    '..........',
    '...kkkk...',
    '..kGGGGk..',
    '.kGGGGGGk.',
    '.kGGGGGGk.',
    'kkGGGGGGkk',
    'kkkkkkkkkk',
    '.KKKKKKKK.',
  ]),

  charm('cracked_screen_protector', 'A flat pane split by a zigzag crack, one corner chipped away.', [
    '..........',
    '.kkkkkkkk.',
    '.kCCCCCCk.',
    '.kCkCCCCk.',
    '.kCCkCCCk.',
    '.kCCCkCCk.',
    '.kCCkCCkk.',
    '.kCkCCkk..',
    '..kkkkk...',
    '..KKKKK...',
  ]),

  charm('frayed_cable', 'A cord curving up the grid, its far end split into three strands.', [
    '......o.o.',
    '.....okok.',
    '.....kGk..',
    '....kGGk..',
    '....kGk...',
    '...kGk....',
    '..kGGk....',
    '..kGk.....',
    '..kk......',
    '..KK......',
  ]),

  charm('spare_button', 'A ring: a button drawn as pure outline, hollow to the background.', [
    '..........',
    '...kkkk...',
    '..kwwwwk..',
    '.kwwkkwwk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kwwkkwwk.',
    '..kwwwwk..',
    '...kkkk...',
    '...KKKK...',
  ]),

  charm('mini_calendar', 'A folded desk calendar standing as a tent, one date blocked red.', [
    '..........',
    '....kk....',
    '...kkkk...',
    '...kwwk...',
    '..kwwwwk..',
    '..kwkkwk..',
    '.kwwrrwwk.',
    '.kwkkkkwk.',
    'kkkkkkkkkk',
    '.KKKKKKKK.',
  ]),

  charm('nameplate', 'A short engraved bar sat on a plinth wider than itself.', [
    '..........',
    '..........',
    '..........',
    '..kkkkkk..',
    '..kaAAak..',
    '..kAqqAk..',
    '..kaAAak..',
    '.kkkkkkkk.',
    'kkkkkkkkkk',
    '.KKKKKKKK.',
  ]),

  charm('transit_pass', 'A flat horizontal strip, punched through once, pointed at one end.', [
    '..........',
    '..........',
    '..........',
    '.kkkkkkk..',
    '.kBkkBBkk.',
    '.kBkkBBBBk',
    '.kBBBBBkk.',
    '.kkkkkkk..',
    '..KKKKK...',
    '..........',
  ]),

  charm('employee_of_the_month_pin', 'A round medal hanging over two forked ribbon tails.', [
    '..........',
    '...kkkk...',
    '..kAAAAk..',
    '.kAAqqAAk.',
    '.kAAAAAAk.',
    '..kAAAAk..',
    '...kkkk...',
    '..kr..rk..',
    '..kr..rk..',
    '..KK..KK..',
  ]),

  charm('paper_star', 'Five points folded out of one sheet of paper.', [
    '..........',
    '....k.....',
    '...kwk....',
    'kkkwwwkkk.',
    '.kwwwwwwk.',
    '..kwwwwk..',
    '..kwwwwk..',
    '.kwk..kwk.',
    '.kk....kk.',
    '.KK....KK.',
  ]),

  charm('old_password', 'A square note scrawled on, its bottom corner curling up.', [
    '..........',
    '..........',
    '.kkkkkkkk.',
    '.kyyyyyyk.',
    '.kykkyyyk.',
    '.kyyykkyk.',
    '.kykkyyyk.',
    '.kyyyykYk.',
    '.kkkkkYk..',
    '.KKKKKK...',
  ]),

  charm('snack_wrapper', 'Two crumpled lobes pinched to a twisted waist in the middle.', [
    '..........',
    '..........',
    '..........',
    'kkk....kkk',
    'kRRk..kRRk',
    'kRRRppRRRk',
    'kRRk..kRRk',
    'kkk....kkk',
    '.KK....KK.',
    '..........',
  ]),

  charm('lucky_lanyard', 'A tall loop of cord hanging open, closed at the bottom by a clip.', [
    '..........',
    '...kkkk...',
    '..kbkkbk..',
    '.kbk..kbk.',
    '.kbk..kbk.',
    '.kbk..kbk.',
    '.kbbkkbbk.',
    '..kbGGbk..',
    '..kkkkkk..',
    '..KKKKKK..',
  ]),
];

// -- 4 transformations: the opposite brief ------------------------------------
//
// The rarest thing in the game, so each fills the whole 16x16 grid rather than the
// charms' 10x10 box — the size difference alone tells a player which class they are
// looking at before they read the shape.
//
// Each badge quotes its own `visual` line from content/items/transformations.js, so
// the icon and the thing that appears on the player agree. A transformation shows the
// CHANGE, never the items that caused it: the latte badge is not two coffee items.

const trn = (slug, silhouette, grid) => spr(`trn_${slug}`, silhouette, grid);

const transformations = [
  // TRN-001 Latte — "a foam-topped cup accessory... with a thin steam wisp".
  // The speed streaks behind it are the +0.2 move speed made visible.
  trn('latte', 'A tall cup with a foam crown and a steam wisp, trailing speed streaks.', [
    '................',
    '.......ww.......',
    '......w..w......',
    '.....w..w.......',
    '......ww........',
    '................',
    '..kkkkkkkkkkkk..',
    '.kWWWWWWWWWWWWk.',
    '.kwHHHHHHHHHHwk.',
    'hkoOOOOOOOOOOok.',
    '.kooOOOOOOOOok..',
    'h.koooOOOOoook..',
    '..hkoooooooook..',
    '...kkoooooookk..',
    '....kkkkkkkkk...',
    '.....KKKKKKK....',
  ]),

  // TRN-002 Power User — "a faint keyboard-shortcut aura of drifting key glyphs".
  // A ring of keycaps around a central switch: the aura, not a keyboard.
  trn('power_user', 'A ring of floating keycaps orbiting a single lit switch.', [
    '................',
    '...kkk....kkk...',
    '..kHHHk..kHHHk..',
    '..kHwHk..kHwHk..',
    '..kkkkk..kkkkk..',
    '...KKK....KKK...',
    '......kkkk......',
    '.....kTTTTk.....',
    '....kTTwwTTk....',
    '....kTTwwTTk....',
    '.....kTTTTk.....',
    '......kkkk......',
    '...kkk.KK.kkk...',
    '..kHwHk..kHwHk..',
    '..kkkkk..kkkkk..',
    '...KKK....KKK...',
  ]),

  // TRN-003 Paper Trail — "torn paper scraps trail behind the player and drift down".
  // Scraps in descent, largest at the top, so the badge reads as falling.
  trn('paper_trail', 'Torn paper scraps in staggered descent, each smaller than the last.', [
    '................',
    '..kkkkkkkkk.....',
    '.kwwwwwwwwwk....',
    '.kwGGGGGGwwk....',
    '.kwwwwwwwGwk....',
    '.kwGGGGwwwkk....',
    '..kkwwwwkk......',
    '...KKKKKK.......',
    '......kkkkkk....',
    '.....kwwwwwwk...',
    '.....kwGGGwwk...',
    '.....kwwwwkk....',
    '......kkkk......',
    '.......KKK..kkk.',
    '...........kwwk.',
    '............kk..',
  ]),

  // TRN-004 Middle Management — "a small assistant follows a step behind the player,
  // carrying a clipboard". Two figures, the front one larger: the relationship IS the
  // sprite, and C.7 is explicit that this is a joke rather than a reputation system.
  trn('middle_management', 'Two figures in file, the rear one smaller and holding a clipboard.', [
    '................',
    '....kkkk........',
    '...kSSSSk.......',
    '...kSnnSk.......',
    '...kkSSkk.......',
    '..kbbbbbbk..kkk.',
    '.kbbbbbbbbkkSSk.',
    '.kbbbbbbbbkSnSk.',
    '.kbbbbbbbbkkSkk.',
    '.kkbbbbbbkbbbbk.',
    '..kbbbbbbkbbwwk.',
    '..kbbbbbbkbbwwk.',
    '..kgg..ggkkbbbk.',
    '..kgg..ggk.kgkg.',
    '..kkk..kkk.kk.k.',
    '..KKK..KKK.KK.K.',
  ]),
];

export default [...charms, ...transformations];
