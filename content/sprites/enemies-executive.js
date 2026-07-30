/**
 * Sprite domain: Executive enemies (ENM-037..048). Owns `enemy_` ids in this range.
 *
 * GDD refs: 14.3 (unique silhouette per enemy at gameplay scale), 18.3 (distinct
 *           silhouette before palette is considered), R-VIS-002 (a veteran identifies
 *           most common enemies and their attack intent at a glance), R-ART-004 /
 *           R-DPT-005 (grayscale-legible), Appendix A DPT-004 (executive floors:
 *           panelling, gold trim, glass, closed doors).
 *
 * IT's roster could lean on "half of these are not people". Executive cannot: it is the
 * department of authority, and authority in an office is expressed by *people in suits*. Ten
 * of these twelve are humanoid and all ten wear roughly the same clothes, so the palette
 * carries almost none of the difference — a dark suit in grayscale is a dark suit.
 *
 * The difference is therefore carried entirely by four things, and every enemy here is given a
 * distinct value for at least two of them:
 *
 *   HEADWEAR / HEAD SHAPE  a peaked cap wider than the shoulders, a visor band, a lens
 *   SHOULDER LINE          squared, hunched, narrow, or absent
 *   CARRIED OBJECT         a raised chart, an open binder, a sack, a torch beam
 *   WHERE THE MASS SITS    above the head, at the chest, at the floor, behind the body
 *
 * The three stationary turrets (compliance officer, board member, auditor) all have to read as
 * *planted*, so none of them has visible legs: one is fused to a lectern, one is seated in a
 * chair whose back is the dominant shape, and one is a body too thin to walk on. That is the
 * intent telegraph R-VIS-002 asks for — if it has no legs, it will not chase you.
 *
 * The two fleeing enemies are the pair most at risk of reading alike, so they are separated
 * deliberately: the middle manager turns away and hunches, while the HR business partner keeps
 * its shoulders square and hides behind a binder. Same behaviour, opposite postures.
 *
 * Gold (`a`, `A`, `q`) is the department's status colour and appears only as an accent. A gold
 * body would look like the golden drone and would flatten to the same grey as everything else,
 * which is exactly the trap this roster sets.
 *
 *   executive_assistant  upright, arms out sideways, tray held clear of the body
 *   compliance_officer   visored head above a lectern; no legs at all
 *   consultant           a chart panel held high beside the head — mass above the shoulders
 *   middle_manager       hunched and turned away, hands up, the narrowest shoulders
 *   security_guard       peaked cap wider than the shoulders, torch beam leaving the frame
 *   legal_eagle          the only winged silhouette; a document with wings and no legs
 *   board_member         seated; the high chair back is bigger than the occupant
 *   expense_ghost        translucent, legless, tapering to a wisp
 *   golden_drone         no body — two rotors, a bar, and a lens
 *   hr_business_partner  an open binder across the chest, the widest mass at chest height
 *   auditor              a magnifier lens where the head should be, on a body too thin to walk
 *   collector            stooped and heavy, dragging a sack that is half the sprite
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

const executive = [
  // ENM-037 Executive Assistant — InterposeController: it steps in front of a costlier ally.
  // The arms are out sideways so the widest part of the silhouette is the part that blocks.
  enemy('executive_assistant', 'Upright figure with arms out sideways, tray held clear of the body.', [[
    '................',
    '.....kkkk.......',
    '....kSSSSk......',
    '....kSnnSk......',
    '....kkSSkk......',
    '.....kwwk.......',
    '..kkkGGGGkkkkkk.',
    '.kGGGGGGGGkwwwk.',
    '.kGGkwwkGGkkkkk.',
    '..kGGwwGGk......',
    '..kGGGGGGk......',
    '..kGGGGGGk......',
    '..kgg..ggk......',
    '..kgg..ggk......',
    '..kkk..kkk......',
    '..KKK..KKK......',
  ], [
    '................',
    '.....kkkk.......',
    '....kSSSSk......',
    '....kSnnSk......',
    '....kkSSkk......',
    '.....kwwk.......',
    '..kkkGGGGkkkkk..',
    '.kGGGGGGGGkwwk..',
    '.kGGkwwkGGkkkk..',
    '..kGGwwGGk......',
    '..kGGGGGGk......',
    '..kGGGGGGk......',
    '..kgg..ggk......',
    '..kgg..ggk......',
    '..kkk..kkk......',
    '..KKK..KKK......',
  ]]),

  // ENM-038 Compliance Officer — AnchoredTurretController, NEAREST_CARDINAL facing. Fused to a
  // lectern: no legs, and a flat visor band that shows which way it is aimed.
  enemy('compliance_officer', 'Visored head above a lectern; no legs, a flat front that faces you.', [[
    '................',
    '................',
    '.....kkkkk......',
    '....kSSSSSk.....',
    '....kkwwwkk.....',
    '.....kGGGk......',
    '....kGGGGGk.....',
    '...kGGwwwGGk....',
    '...kGGGGGGGk....',
    '..kkkkkkkkkkk...',
    '..kHHHHHHHHHk...',
    '..kHwwwwwwwHk...',
    '..kHHHHHHHHHk...',
    '..kkkkkkkkkkk...',
    '...KKKKKKKKK....',
    '................',
  ], [
    '................',
    '................',
    '.....kkkkk......',
    '....kSSSSSk.....',
    '....kkHHHkk.....',
    '.....kGGGk......',
    '....kGGGGGk.....',
    '...kGGwwwGGk....',
    '...kGGGGGGGk....',
    '..kkkkkkkkkkk...',
    '..kHHHHHHHHHk...',
    '..kHwwwwwwwHk...',
    '..kHHHHHHHHHk...',
    '..kkkkkkkkkkk...',
    '...KKKKKKKKK....',
    '................',
  ]]),

  // ENM-039 Consultant — ObserveAndEchoController: it watches from 6.5 units, then repeats what
  // it saw. The chart is held high and to one side, putting the mass above the shoulders.
  enemy('consultant', 'A chart panel held high beside the head; mass above the shoulders.', [[
    '................',
    '..kkkkkkk.......',
    '..kwwwwwk.......',
    '..kwGGGwk.......',
    '..kwwwwwk.......',
    '..kkkkkkk...kkk.',
    '.......k...kSSk.',
    '.......k..kSnnSk',
    '.......kkkkkSSk.',
    '........kGGGGk..',
    '.......kGGGGGGk.',
    '.......kGGwwGGk.',
    '.......kGGGGGGk.',
    '........kgggggk.',
    '........kkk.kkk.',
    '........KKK.KKK.',
  ], [
    '................',
    '..kkkkkkk.......',
    '..kwwwwwk.......',
    '..kwwGGwk.......',
    '..kwwwwwk.......',
    '..kkkkkkk...kkk.',
    '.......k...kSSk.',
    '.......k..kSnnSk',
    '.......kkkkkSSk.',
    '........kGGGGk..',
    '.......kGGGGGGk.',
    '.......kGGwwGGk.',
    '.......kGGGGGGk.',
    '........kgggggk.',
    '........kkk.kkk.',
    '........KKK.KKK.',
  ]]),

  // ENM-040 Middle Manager — FleeController, hidesBehindAllies. Turned away, hunched, hands up:
  // the only suit in the roster whose posture is retreat rather than authority.
  enemy('middle_manager', 'Hunched and turned away, hands raised, the narrowest shoulders.', [[
    '................',
    '................',
    '......kkkk......',
    '.....kSnnnk.....',
    '.....kSnnnk.....',
    '....kkkGGkk.....',
    '..kkGGGGGGGkk...',
    '.kSSkGGGGGGkSSk.',
    '.kkkkGGGGGGkkkk.',
    '....kGGGGGGk....',
    '....kGGGGGGk....',
    '.....kgggggk....',
    '.....kgg.ggk....',
    '.....kgg.ggk....',
    '.....kkk.kkk....',
    '.....KKK.KKK....',
  ], [
    '................',
    '................',
    '......kkkk......',
    '.....kSnnnk.....',
    '.....kSnnnk.....',
    '....kkkGGkk.....',
    '.kkkGGGGGGGkkk..',
    'kSSkkGGGGGGkkSSk',
    '.kkkkGGGGGGkkkk.',
    '....kGGGGGGk....',
    '....kGGGGGGk....',
    '.....kgggggk....',
    '.....kgg.ggk....',
    '.....kgg.ggk....',
    '.....kkk.kkk....',
    '.....KKK.KKK....',
  ]]),

  // ENM-041 Security Guard — PatrolController with a scan cone, then a 10-speed charge. The cap
  // brim is wider than the shoulders, and the torch beam leaves the frame on the scan side, so
  // which way it is looking is readable before it commits.
  enemy('security_guard', 'Peaked cap wider than the shoulders, torch beam leaving the frame.', [[
    '................',
    '...kkkkkkkkk....',
    '...kbbbbbbbk....',
    '....kkSSSkk.....',
    '.....kSSSk......',
    '...kkkkkkkkk....',
    '..kbbbbbbbbbk...',
    '..kbbkwwkbbbk...',
    '..kbbbbbbbbbk..y',
    '..kbbbbbbbbbkyYy',
    '...kbbbbbbbk..y.',
    '...kAAAAAAAk....',
    '...kgggggggk....',
    '...kgg...ggk....',
    '...kkk...kkk....',
    '...KKK...KKK....',
  ], [
    '................',
    '...kkkkkkkkk....',
    '...kbbbbbbbk....',
    '....kkSSSkk.....',
    '.....kSSSk......',
    '...kkkkkkkkk....',
    '..kbbbbbbbbbk...',
    '..kbbkwwkbbbk...',
    '..kbbbbbbbbbk.y.',
    '..kbbbbbbbbbkYyY',
    '...kbbbbbbbk...y',
    '...kAAAAAAAk....',
    '...kgggggggk....',
    '...kgg...ggk....',
    '...kkk...kkk....',
    '...KKK...KKK....',
  ]]),

  // ENM-042 Legal Eagle — StandoffShooterController, FLYING. The only winged silhouette in the
  // entire game, and legless, so "this one does not walk" is unmistakable.
  enemy('legal_eagle', 'A document with spread wings and no legs; the only winged shape.', [[
    '................',
    '................',
    '.kk..........kk.',
    'kwwk........kwwk',
    'kwwwk..kk..kwwwk',
    '.kwwwkkwwkkwwwk.',
    '..kwwwkwwkwwwk..',
    '...kkwkwwkwkk...',
    '.....kwwwwk.....',
    '....kwwwwwwk....',
    '....kwGGGGwk....',
    '....kwwwwwwk....',
    '.....kwwwwk.....',
    '......kkkk......',
    '.......KK.......',
    '................',
  ], [
    '................',
    '.kk..........kk.',
    'kwwk........kwwk',
    'kwwwk......kwwwk',
    '.kwwwk.kk.kwwwk.',
    '..kwwwkwwkwwwk..',
    '...kwwkwwkwwk...',
    '....kkkwwkkk....',
    '.....kwwwwk.....',
    '....kwwwwwwk....',
    '....kwGGGGwk....',
    '....kwwwwwwk....',
    '.....kwwwwk.....',
    '......kkkk......',
    '.......KK.......',
    '................',
  ]]),

  // ENM-043 Board Member — AnchoredTurretController, FREE_ROTATE. Seated, and the chair back is
  // deliberately larger than the person in it.
  enemy('board_member', 'Seated figure in a high-backed chair; the chair outweighs the occupant.', [[
    '................',
    '..kkkkkkkkkkk...',
    '..kggggggggggk..',
    '..kgkkkkkkkgggk.',
    '..kgkSSSSSkgggk.',
    '..kgkSnnnSkgggk.',
    '..kgkkSSSkkgggk.',
    '..kgkGGGGGkgggk.',
    '..kgGGwwwGGgggk.',
    '..kgGGGGGGGgggk.',
    '..kkGGGGGGGkkkk.',
    '...kkkkkkkkk....',
    '....kk...kk.....',
    '....kk...kk.....',
    '....kk...kk.....',
    '....KK...KK.....',
  ], [
    '................',
    '..kkkkkkkkkkk...',
    '..kggggggggggk..',
    '..kgkkkkkkkgggk.',
    '..kgkSSSSSkgggk.',
    '..kgkSnnnSkgggk.',
    '..kgkkSSSkkgggk.',
    '..kgkGGGGGkgggk.',
    '..kgGGwHwGGgggk.',
    '..kgGGGGGGGgggk.',
    '..kkGGGGGGGkkkk.',
    '...kkkkkkkkk....',
    '....kk...kk.....',
    '....kk...kk.....',
    '....kk...kk.....',
    '....KK...KK.....',
  ]]),

  // ENM-044 Expense Ghost — ChaseController, FLYING, ignoresObstacles. Drawn in the light greys
  // so it reads as translucent, legless, and tapering to nothing.
  //
  // No baked `K` contact shadow, unlike every other sprite here: it is not touching the floor,
  // and main.js #renderShadow already draws a soft ground ellipse per hostile. A baked contact
  // shadow would contradict the one thing this silhouette exists to say.
  enemy('expense_ghost', 'Translucent legless drift tapering to a wisp, with a receipt band.', [[
    '................',
    '.....hhhh.......',
    '....hHHHHh......',
    '....hHwwHh......',
    '....hHHHHh......',
    '.....hHHh.......',
    '...hhHHHHhh.....',
    '..hHwwwwwwHh....',
    '..hHwGGGGwHh....',
    '..hHwwwwwwHh....',
    '...hHHHHHHh.....',
    '....hHHHHh......',
    '.....hHHh.......',
    '......hh........',
    '.......h........',
    '................',
  ], [
    '................',
    '.....hhhh.......',
    '....hHHHHh......',
    '....hHwwHh......',
    '....hHHHHh......',
    '.....hHHh.......',
    '...hhHHHHhh.....',
    '..hHwwwwwwHh....',
    '..hHwGGGGwHh....',
    '..hHwwwwwwHh....',
    '...hHHHHHHh.....',
    '....hHHHHh......',
    '.....hHHh.......',
    '.......hh.......',
    '.......h........',
    '................',
  ]]),

  // ENM-045 Golden Drone — Appendix D marks this as the roster's one deliberate reuse, held at a
  // rarity that cannot crowd out new content. No body at all: two rotors, a bar, a lens.
  enemy('golden_drone', 'No body — two rotors on a bar above a single gold lens.', [[
    '................',
    '................',
    '................',
    '..kkk......kkk..',
    '.kAAAk....kAAAk.',
    '..kkk......kkk..',
    '...k..kkkk..k...',
    '...kkkAAAAkkk...',
    '......kAAk......',
    '.....kAAAAk.....',
    '.....kAqqAk.....',
    '.....kAAAAk.....',
    '......kkkk......',
    '.......KK.......',
    '................',
    '................',
  ], [
    '................',
    '................',
    '................',
    '..kkk......kkk..',
    '.kaaak....kaaak.',
    '..kkk......kkk..',
    '...k..kkkk..k...',
    '...kkkAAAAkkk...',
    '......kAAk......',
    '.....kAAAAk.....',
    '.....kAqqAk.....',
    '.....kAAAAk.....',
    '......kkkk......',
    '.......KK.......',
    '................',
    '................',
  ]]),

  // ENM-046 HR Business Partner — FleeController like the middle manager, so the two must not
  // read alike: this one keeps its shoulders square and puts an open binder across the chest,
  // making the widest mass chest-height rather than shoulder-height.
  enemy('hr_business_partner', 'An open binder held across the chest; widest mass at chest height.', [[
    '................',
    '......kkkk......',
    '.....kSSSSk.....',
    '.....kSNNSk.....',
    '.....kkSSkk.....',
    '....kkGGGGkk....',
    '...kGGGGGGGGk...',
    '..kkkkkkkkkkkk..',
    '..kwwwwkwwwwwk..',
    '..kwGGwkwGGGwk..',
    '..kwwwwkwwwwwk..',
    '..kkkkkkkkkkkk..',
    '....kGGGGGGk....',
    '....kgg..ggk....',
    '....kkk..kkk....',
    '....KKK..KKK....',
  ], [
    '................',
    '......kkkk......',
    '.....kSSSSk.....',
    '.....kSNNSk.....',
    '.....kkSSkk.....',
    '....kkGGGGkk....',
    '...kGGGGGGGGk...',
    '..kkkkkkkkkkkk..',
    '..kwwwwkwwwwwk..',
    '..kwGGGwkGGwwk..',
    '..kwwwwkwwwwwk..',
    '..kkkkkkkkkkkk..',
    '....kGGGGGGk....',
    '....kgg..ggk....',
    '....kkk..kkk....',
    '....KKK..KKK....',
  ]]),

  // ENM-047 Auditor — AnchoredTurretController, TRACK_MARK: it re-aims at whatever it has
  // marked, in 0.4s. The head IS the lens, and the body is too narrow to walk on.
  enemy('auditor', 'A magnifier lens where the head should be, on a body too thin to walk.', [[
    '.......kk.......',
    '.....kkCCkk.....',
    '....kCCCCCCk....',
    '....kCwwwwCk....',
    '....kCwwwwCk....',
    '....kCCCCCCk....',
    '.....kkCCkk.....',
    '.......kk.......',
    '......kGGk......',
    '.....kGGGGk.....',
    '.....kGwwGk.....',
    '.....kGGGGk.....',
    '.....kGGGGk.....',
    '.....kg..gk.....',
    '.....kk..kk.....',
    '.....KK..KK.....',
  ], [
    '.......kk.......',
    '.....kkCCkk.....',
    '....kCCCCCCk....',
    '....kCwwCCCk....',
    '....kCCwwwCk....',
    '....kCCCCCCk....',
    '.....kkCCkk.....',
    '.......kk.......',
    '......kGGk......',
    '.....kGGGGk.....',
    '.....kGwwGk.....',
    '.....kGGGGk.....',
    '.....kGGGGk.....',
    '.....kg..gk.....',
    '.....kk..kk.....',
    '.....KK..KK.....',
  ]]),

  // ENM-048 Collector — ChaseController whose speed rises with the player's credits. Slow,
  // stooped, and dragging a sack that takes up half the sprite: the threat is that it does not
  // stop, and the sack is what it is coming for.
  enemy('collector', 'Stooped and heavy, dragging a roped sack half the size of the sprite.', [[
    '................',
    '................',
    '........kkkk....',
    '.......kSSSSk...',
    '.......kSnnSk...',
    '......kkkSSkk...',
    '.....kGGGGGGk...',
    '....kGGGGGGGk...',
    '..kkkGGwwGGGk...',
    '.kaaakGGGGGGk...',
    'kaaaaakGGGGGk...',
    'kaAAAakGGGGGk...',
    'kaAAAakgg.ggk...',
    'kaaaaakkk.kkk...',
    '.kaaak.KK.KKK...',
    '..KKK...........',
  ], [
    '................',
    '................',
    '........kkkk....',
    '.......kSSSSk...',
    '.......kSnnSk...',
    '......kkkSSkk...',
    '.....kGGGGGGk...',
    '....kGGGGGGGk...',
    '..kkkGGwwGGGk...',
    '.kaaakGGGGGGk...',
    'kaaaaakGGGGGk...',
    'kaAAAakGGGGGk...',
    'kaAAAakgg.ggk...',
    'kaaaaakk.kkkk...',
    '.kaaak.K.KKKK...',
    '..KKK...........',
  ]]),
];

export default executive;
