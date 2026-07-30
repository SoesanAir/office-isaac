/**
 * Sprite domain: alternate / late-route enemies (ENM-049..058). Owns `enemy_` ids
 * in this range.
 *
 * GDD refs: 14.3 (unique silhouette per enemy at gameplay scale), 18.3 (silhouette
 *           reads before palette; elites keep the base shape), R-VIS-002 (a veteran
 *           identifies the enemy and its attack intent at a glance), R-ART-004 /
 *           R-DPT-005 (grayscale and material legibility), 18.1 (chunky shapes,
 *           slightly grotesque corporate-cartoon tone).
 *
 * This roster's design problem is that it is not a department, it is six of them —
 * Marketing doubles, Legal red tape, Facilities, R&D prototypes, and the ownership
 * chain (Board, Secret, Conglomerate). There is no shared costume to hang
 * recognition on, so recognition has to come entirely from outline geometry.
 *
 * The deeper problem is tonal, and it is the reason this file looks the way it does.
 * These are the later and hidden floors, where the building stops obeying office
 * logic: impossible scale, conflicting ownership, service spaces that do not fit
 * inside the building. So these are deliberately the strangest silhouettes in the
 * game. A roll of tape with a trail longer than its body. A floating clause. A leak
 * that is barely taller than its own puddle. A shade with no legs. An eye with no
 * body at all. An abomination fused down a seam. Only the Janitor and the Focus
 * Tester read as ordinary people, and that contrast is the point — by this floor a
 * person-shaped enemy is the exception, and the player should feel it.
 *
 * Each silhouette also has to telegraph the behaviour, not just the identity:
 *
 *   brand double        the PLAYER's outline in the wrong palette; hard cast shadow
 *   focus tester        seated person whose face is a flat reflective pane
 *   red tape roll       low cylinder with an unspooling strip longer than the body
 *   clause              small floating document, torn hem, one huge rule icon
 *   janitor             person plus a long diagonal mop reaching the grid corner
 *   the leak            the lowest, widest, flattest shape in the game
 *   prototype           lopsided open frame; mast one side, emitter the other
 *   archive shade       tall legless column with a ragged top, sunk in paper
 *   shareholder eye     a lone lens, no body, trailing a thin targeting line
 *   merger abomination  two enemies fused down a vertical seam; legs and treads
 *
 * ENM-049 Brand Double is the one intentional violation of "distinct silhouette",
 * because being a near-copy of `player_idle_south` is its entire mechanic. It keeps
 * the player's proportions — the broad shoulders, the lanyard block, the forward
 * head — and swaps the corporate blues for marketing purple and the skin for grey.
 * The tell is the ground shadow the real one casts and the copy does not (see the
 * `realCastsShadow` fairness rule in content/enemies/alternate.js); the outline is
 * deliberately no help, which is why this file makes no attempt to differentiate it.
 *
 * Every sprite here carries a black `k` outline on its own edge and a `K` contact
 * row, including the four that float or lie flat — the Clause, the Leak, the Archive
 * Shade and the Shareholder Eye. Those four are where a shadow does the most work:
 * with no legs and no ground contact, the `K` row is the only thing that says how
 * high off the floor the body is, and for the Eye it also marks where the targeting
 * line lands. The Archive Shade's shadow falls on the paper drift it rises out of
 * rather than on the floor, because that is the surface it is actually touching.
 *
 * Grids are authored at half the 32px reference grid and baked at `scale: 2`.
 */

const SCALE = 2;

const enemy = (slug, silhouette, frames, anchor = [0.5, 0.92]) => ({
  id: `enemy_${slug}`,
  anchor,
  scale: SCALE,
  silhouette,
  frames,
});

const alternate = [
  // ENM-049 Brand Double — the player's own outline, wrong palette, real shadow.
  enemy('brand_double', "A near-copy of the player's silhouette in marketing purple; only it casts the hard shadow.", [[
    '.....kkkkkk.....',
    '....kvvvvvvk....',
    '....kHHHHHHk....',
    '....kHkHHkHk....',
    '....kHHHHHHk....',
    '.....kHhhHk.....',
    '......khhk......',
    '...kkmMVVMmkk...',
    '..kmMMMVVMMMmk..',
    '..kmMMMVVMMMmk..',
    '..kmMMMMMMMMmk..',
    '...kMMMMMMMMk...',
    '....kggggggk....',
    '....kgkkkkgk....',
    '....kk....kk....',
    '...KKKK..KKKK...',
  ], [
    '.....kkkkkk.....',
    '....kvvvvvvk....',
    '....kHHHHHHk....',
    '....kHkHHkHk....',
    '....kHHHHHHk....',
    '.....kHhhHk.....',
    '......khhk......',
    '...kkmMVVMmkk...',
    '..kmMMMVVMMMmk..',
    '..kmMMMVVMMMmk..',
    '..kmMMMMMMMMmk..',
    '...kMMMMMMMMk...',
    '...kggggggk.....',
    '...kgkkkkgk.....',
    '...kk....kk.....',
    '..KKKK..KKKK....',
  ]]),

  // ENM-050 Focus Tester — a seated person whose face is a one-way pane. Never moves.
  enemy('focus_tester', 'Seated person whose head is replaced by a wide reflective pane; chair legs, no feet.', [[
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kHHHHHHHHHHk..',
    '..kHwwwwwwwwHk..',
    '..kHwCCCCCCwHk..',
    '..kHwwwwwwwwHk..',
    '..kkkkkkkkkkkk..',
    '....kkkkkkkk....',
    '...kbbbbbbbbk...',
    '...kbBBBBBBbk...',
    '...kbbbbbbbbk...',
    '....kkgggkkk....',
    '.....kgggk......',
    '....kkgkgkk.....',
    '...KKKK.KKKK....',
  ], [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kHHHHHHHHHHk..',
    '..kHwwCCwwwwHk..',
    '..kHwwwwwwwwHk..',
    '..kHwwwwwwwwHk..',
    '..kkkkkkkkkkkk..',
    '....kkkkkkkk....',
    '...kbbbbbbbbk...',
    '...kbBBBBBBbk...',
    '...kbbbbbbbbk...',
    '....kkgggkkk....',
    '.....kgggk......',
    '....kkgkgkk.....',
    '...KKKK.KKKK....',
  ]]),

  // ENM-051 Red Tape Roll — the trail is longer than the body, which is the read.
  enemy('red_tape_roll', 'Low cylinder on its side with an unspooling strip trailing far behind it.', [[
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........kkkk..',
    '.........kRRRRk.',
    '.........kRppRk.',
    '.........kRppRk.',
    'kkkkkkkkkkRRRRk.',
    'krrrrrrrrkRRRRk.',
    'kkkkkkkkkkkkkkk.',
    '..KKKKKKKKKKKK..',
    '................',
  ], [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........kkkk..',
    '.........kRRRRk.',
    '.........kpRRpk.',
    '.........kpRRpk.',
    'kkkkkkkkkkRRRRk.',
    'krrrpprrrkRRRRk.',
    'kkkkkkkkkkkkkkk.',
    '..KKKKKKKKKKKK..',
    '................',
  ]]),

  // ENM-052 Clause — a floating document that is mostly one large rule icon.
  enemy('clause', 'Small floating document with a torn hem and one huge prohibition icon on its face.', [[
    '................',
    '....kkkkkkkk....',
    '....kwwwwwwk....',
    '....kwkkkkwk....',
    '....kwwwwwwk....',
    '....kwRRRRwk....',
    '....kwRkkRwk....',
    '....kwRkkRwk....',
    '....kwRRRRwk....',
    '....kwwkkwwk....',
    '....kwwwwwwk....',
    '....kwkkkkwk....',
    '....kwwwwwwk....',
    '....kkwkwkkk....',
    '.....kkrkk......',
    '....KKkrkKK.....',
  ], [
    '....kkkkkkkk....',
    '....kwwwwwwk....',
    '....kwkkkkwk....',
    '....kwwwwwwk....',
    '....kwRRRRwk....',
    '....kwRwwRwk....',
    '....kwRwwRwk....',
    '....kwRRRRwk....',
    '....kwwRRwwk....',
    '....kwwwwwwk....',
    '....kwkkkkwk....',
    '....kwwwwwwk....',
    '....kkwkwkkk....',
    '.....kkrkk......',
    '......krk.......',
    '....KKKKKKK.....',
  ]]),

  // ENM-053 Janitor — an ordinary person, but with visible reach out of frame.
  enemy('janitor', 'Ordinary person holding a long mop diagonally; the only melee shape with visible reach.', [[
    '...........kkkk.',
    '..........khHHhk',
    '..........khhHhk',
    '...kkkkkkk.kOk..',
    '...knnnnnkkOk...',
    '...kSSSSSkkOk...',
    '...kSkSkSkOk....',
    '....kSSSkkOk....',
    '..kkeeeekkkOk...',
    '..keeEEeeksOk...',
    '..keeEEeekkOk...',
    '...keeeek.kkk...',
    '...kggggk.......',
    '...kgkkgk.......',
    '...kk..kk.......',
    '..KKKKKKKK......',
  ], [
    '................',
    '...........kkkk.',
    '..........khHHhk',
    '...kkkkkkkkhhHhk',
    '...knnnnnk.kOk..',
    '...kSSSSSkkOk...',
    '...kSkSkSkkOk...',
    '....kSSSkkOk....',
    '..kkeeeekksOk...',
    '..keeEEeekkOk...',
    '..keeEEeek.kkk..',
    '...keeeek.......',
    '...kggggk.......',
    '..kgkkkgk.......',
    '..kk...kk.......',
    '.KKKKKKKK.......',
  ]]),

  // ENM-054 The Leak — the lowest, widest, flattest silhouette in the game.
  enemy('the_leak', 'Barely a body: the lowest and widest shape in the game, read almost entirely by its spread.', [[
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kk........',
    '.....kCCk.......',
    '....kCCCCk......',
    '..kkCCcccCkk....',
    '.kccCcccccCcck..',
    'kcccccccccccccck',
    '.kkkkkkkkkkkkkk.',
    '..KKKKKKKKKKKK..',
  ], [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kk........',
    '.....kCCk.......',
    '...kkCCCCkk.....',
    '.kccccCcccCcck..',
    'kcccccccccccccck',
    '.kkkkkkkkkkkkkk.',
    '..KKKKKKKKKKKK..',
  ]]),

  // ENM-055 Prototype — lopsided open frame; the bolted-on module is the signpost.
  enemy('prototype', 'Lopsided exposed frame with a module mast on one side and an emitter on the other.', [[
    '................',
    '...kk...........',
    '..kAAk..........',
    '..kAAkkkkkk.....',
    '..kAAkHHHHk.....',
    '..kAAkHkkHk.....',
    '..kkkkHHHHkkkk..',
    '....kHkHkHkYYk..',
    '....kHHHHHHkkk..',
    '....kHkkkkHk....',
    '....kHHHHHHk....',
    '.....kkHHkk.....',
    '......kHHk......',
    '.....kkHHkk.....',
    '....kGGkkGGk....',
    '....KKK..KKK....',
  ], [
    '................',
    '...kk...........',
    '..kqqk..........',
    '..kqqkkkkkk.....',
    '..kqqkHHHHk.....',
    '..kqqkHkkHk.....',
    '..kkkkHHHHkkkk..',
    '....kHkHkHkyyk..',
    '....kHHHHHHkkk..',
    '....kHkkkkHk....',
    '....kHHHHHHk....',
    '.....kkHHkk.....',
    '......kHHk......',
    '.....kkHHkk.....',
    '...kGGkkGGk.....',
    '...KKK..KKK.....',
  ]]),

  // ENM-056 Archive Shade — legless, ragged-topped, and sunk into the paperwork.
  enemy('archive_shade', 'Tall legless column with a ragged upper edge, rising out of a drift of paper.', [[
    '....kk..kk......',
    '...kkmk.kmkk....',
    '...kmmmkkmmmk...',
    '...kmmmmmmmk....',
    '...kmmmmmmmk....',
    '...kmwmmmwmk....',
    '...kmmmmmmmk....',
    '...kmmmmmmmk....',
    '...kmmmmmmmk....',
    '..kkmmmmmmmkk...',
    '..kmmmmmmmmmk...',
    '..kmmmmmmmmmk...',
    '.kkmmmmmmmmmkk..',
    'kwwwkkkkkkkwwwwk',
    'kwwKKKKKKKKKwwwk',
    '.kkkkkkkkkkkkkk.',
  ], [
    '................',
    '.....kk..kk.....',
    '....kkmk.kmkk...',
    '...kmmmkkmmmk...',
    '...kmmmmmmmk....',
    '...kmmmmmmmk....',
    '...kmwmmmwmk....',
    '...kmmmmmmmk....',
    '...kmmmmmmmk....',
    '..kkmmmmmmmkk...',
    '..kmmmmmmmmmk...',
    '.kkmmmmmmmmmkk..',
    'kwwwkkkkkkkwwwwk',
    'kwwKKKKKKKKKwwwk',
    'kwwwwwwwwwwwwwwk',
    '.kkkkkkkkkkkkkk.',
  ]]),

  // ENM-057 Shareholder Eye — no body at all, and the aim line is part of the shape.
  enemy('shareholder_eye', 'A single floating lens with no body, trailing a thin targeting line off one side.', [[
    '................',
    '.....kkkkkk.....',
    '...kkAAAAAAkk...',
    '..kAAAAAAAAAAk..',
    '.kAAAwwwwwwAAAk.',
    '.kAAwwkkkkwwAAk.',
    'kAAwwkkkkkkwwAAk',
    'kAAwwkkkkkkwwAAk',
    '.kAAwwkkkkwwAAk.',
    '.kAAAwwwwwwAAAk.',
    '..kAAAAAAAAAAk..',
    '...kkAAAAAAkk...',
    '.....kkkkkk.....',
    '........q.......',
    '.......q........',
    '....KKqKKKKK....',
  ], [
    '................',
    '.....kkkkkk.....',
    '...kkAAAAAAkk...',
    '..kAAAAAAAAAAk..',
    '.kAAAwwwwwwAAAk.',
    '.kAAwwwkkwwwAAk.',
    'kAAwwwkkkkwwwAAk',
    'kAAwwwkkkkwwwAAk',
    '.kAAwwwkkwwwAAk.',
    '.kAAAwwwwwwAAAk.',
    '..kAAAAAAAAAAk..',
    '...kkAAAAAAkk...',
    '.....kkkkkk.....',
    '........q.......',
    '.........q......',
    '....KKKKKKqK....',
  ]]),

  // ENM-058 Merger Abomination — two outlines fused down a seam; legs one side, treads the other.
  enemy('merger_abomination', 'Two enemies fused down a vertical seam: a suited half on legs, a machine half on treads.', [[
    '................',
    '..kkkk...kkkkk..',
    '.knnnnk.kGGGGGk.',
    '.kSSSSk.kGkkkGk.',
    '.kSkSSk.kGGGGGk.',
    '.kSSSSk.kkGGGkk.',
    '..kssk..kkkkkkk.',
    '.kkbbkk.kGGGGGGk',
    'kbbbbbbkkGGGGGGk',
    'kbBBBbbkkGkkkkGk',
    'kbBBBbbkkGGGGGGk',
    'kbbbbbbkkGGGGGGk',
    '.kbbbbkkkGGGGGGk',
    '.kggggk.kGkkkkGk',
    '.kk..kk.kkGkGkGk',
    '..KKKK...KKKKKK.',
  ], [
    '................',
    '..kkkk...kkkkk..',
    '.knnnnk.kGGGGGk.',
    '.kSSSSk.kGkkkGk.',
    '.kSkSSk.kGGGGGk.',
    '.kSSSSk.kkGGGkk.',
    '..kssk..kkkkkkk.',
    '.kkbbkk.kGGGGGGk',
    'kbbbbbbkkGGGGGGk',
    'kbBBBbbkkGGkkGGk',
    'kbBBBbbkkGGGGGGk',
    'kbbbbbbkkGGGGGGk',
    '.kbbbbkkkGGGGGGk',
    'kggggk..kGGkkGGk',
    'kk..kk..kkkGkGkk',
    '.KKKK....KKKKKK.',
  ]]),
];

export default alternate;
