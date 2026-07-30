/**
 * Sprite domain: Operations enemies (ENM-025..036). Owns `enemy_` ids in this range.
 *
 * GDD refs: 14.3 (unique silhouette per enemy at gameplay scale, telegraph readable
 *           from the outline), 18.3 (silhouette before palette; elites keep the base
 *           shape), R-VIS-002 (a veteran names the enemy and its intent at a glance),
 *           R-ART-004 / R-DPT-005 (grayscale-legible), Appendix A DPT-003 (conveyors,
 *           pallet racking, shipping labels, shift boards).
 *
 * Operations poses the opposite problem to IT. IT's roster is equipment that started
 * acting on its own, so the shapes could be as strange as they liked. Operations is a
 * department of *people doing physical work with things* — and the things are all boxes.
 * Left alone, a warehouse roster bakes into twelve brown rectangles, or twelve people
 * carrying one. So the silhouettes are separated on three axes instead of one:
 *
 *   1. FOOTPRINT. Where the shape's mass sits. Cart Train and Forklift Clerk are wide
 *      and floor-bound; Bottleneck and Shift Lead put their mass high; Conveyor Gremlin
 *      is a horizontal smear at ankle height; Inventory Swarm is a fist-sized cube.
 *   2. CARGO POSITION. Four of these carry something, and no two carry it in the same
 *      place: Courier at chest (and the outline visibly narrows when it drops it),
 *      Bottleneck on its back, Labeler at hip, Shift Lead raised overhead.
 *   3. STANCE. Courier leans forward off its rear foot, Overtime Zombie slumps with
 *      hands below its waist, Temp Worker is the thinnest body in the game, Safety
 *      Officer is the only helmeted outline.
 *
 * Because the department's threat is usually *where you are standing*, the frame-2
 * animations carry locomotion rather than wind-up: rolling, hopping, shuffling, a
 * spinning spool. The one exception is Pallet Mimic, whose two frames are the whole
 * design — the outline does not change at all between them, only a single slat opens
 * and shows an eye, because the mimic must stay furniture until it moves.
 *
 *   courier            forward-leaning runner, boxy parcel at chest
 *   forklift clerk     wide low chassis under a canopy, two floor-level tines
 *   conveyor gremlin   ankle-height horizontal smear, bolt raised to one side
 *   inventory swarm    a single small taped cube, no limbs, no face
 *   bottleneck         stooped body under a tall slatted hump on its back
 *   shift lead         upright, hi-vis chest band, clipboard held overhead
 *   pallet mimic       a stacked pallet, full width, no head — until a slat opens
 *   safety officer     hard hat with a wide brim, diagonal sash across the torso
 *   temp worker        the thinnest humanoid, badge flapping off a lanyard
 *   overtime zombie    slumped, arms past the waist, one foot dragging behind
 *   cart train         three linked low carts; wider than anything else on the floor
 *   labeler            compact body with a hip-slung gun and a tape spool on top
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

const operations = [
  // ENM-025 Courier — the lean is the telegraph. Upper body is twice the width of the
  // legs because of the parcel, so the sprint reads as top-heavy and committed.
  enemy('courier', 'Forward-leaning runner with a boxy parcel at chest height; top-heavy, legs far narrower than the load.', [[
    '................',
    '.......kkkk.....',
    '......knnnnk....',
    '......kSSSSk....',
    '.....kkSkSkk....',
    '......kSSSk.....',
    '..kkkkkkkkkkkk..',
    '..kOOOOOOOOOOk..',
    '..kOOkkOOkkOOk..',
    '..kOOOOOOOOOOk..',
    '..kkkkkkkkkkkk..',
    '....kbbbbbk.....',
    '....kbbbbbk.....',
    '...kbk.kbk......',
    '..kggk..kggk....',
    '..KKKK..KKKK....',
  ], [
    '................',
    '.......kkkk.....',
    '......knnnnk....',
    '......kSSSSk....',
    '.....kkSkSkk....',
    '......kSSSk.....',
    '..kkkkkkkkkkkk..',
    '..kOOOOOOOOOOk..',
    '..kOOkkOOkkOOk..',
    '..kOOOOOOOOOOk..',
    '..kkkkkkkkkkkk..',
    '....kbbbbbk.....',
    '....kbbbbbk.....',
    '.....kbkbk......',
    '....kkgkkgkk....',
    '....KKKKKKKK....',
  ]]),

  // ENM-026 Forklift Clerk — the only hostile whose widest point is at floor level. The
  // two tines are the outline's furthest reach, so the charge lane is visible in the shape.
  enemy('forklift_clerk', 'Wide low chassis under an overhead canopy with two forward tines at floor level; widest below knee height.', [[
    '..kkkkkkkkkk....',
    '..kyyyyyyyyk....',
    '..kk.kkkk.kk....',
    '..ky.kSSk.yk....',
    '..ky.kSkk.yk....',
    '..kykkkkkkyk....',
    '..kyyOOOOyyk....',
    'kkkkkkkkkkkkkk..',
    'kyyyyyyyyyyyyyk.',
    'kykkkkkkkkkkkyk.',
    'kykGGGGGGGGGkyk.',
    'kykkkkkkkkkkkyk.',
    'kyyyyyyyyyyyyyk.',
    'kkkkkkkkkkkkkkk.',
    'kHHHHHkkkkHHHHHk',
    '.KKKKK....KKKKK.',
  ], [
    '..kkkkkkkkkk....',
    '..kyyyyyyyyk....',
    '..kk.kkkk.kk....',
    '..ky.kSSk.yk....',
    '..ky.kkSk.yk....',
    '..kykkkkkkyk....',
    '..kyyOOOOyyk....',
    'kkkkkkkkkkkkkk..',
    'kyyyyyyyyyyyyyk.',
    'kykkkkkkkkkkkyk.',
    'kykGGGGGGGGGkyk.',
    'kykkkkkkkkkkkyk.',
    'kyyyyyyyyyyyyyk.',
    'kHHHHHkkkkHHHHHk',
    'kkkkkkkkkkkkkkk.',
    '.KKKKKKKKKKKKK..',
  ]]),

  // ENM-027 Conveyor Gremlin — nothing else in the game is this low and this long. The
  // raised bolt is the emitter, held out to the side because it throws perpendicular.
  enemy('conveyor_gremlin', 'Ankle-height horizontal smear of a hunched body, one bolt raised out to the side; never upright.', [[
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..kGk...........',
    '.kGGGk.kkkk.....',
    '..kkk.knnnnk....',
    '..kEk.kSkSkk....',
    '.kEEkkkEEEEk....',
    'kEEEEEEEEEEEk...',
    'kEEEEEEEEEEEEk..',
    'kkEEEEEEEEEEkk..',
    '.kkgkkgkkgkk....',
    '..KKKKKKKKKK....',
  ], [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......kkkk.....',
    '......knnnnk....',
    '.kGk..kSkSkk....',
    '.kkkkkkEEEEk....',
    'kEEEEEEEEEEEk...',
    'kEEEEEEEEEEEEk..',
    'kkEEEEEEEEEEkk..',
    '..kkgkkgkkgkk...',
    '...KKKKKKKKKK...',
  ]]),

  // ENM-028 Inventory Swarm — deliberately the least characterful sprite in the game. No
  // limbs, no face, smallest footprint; frame 2 is the hop, with the shadow left behind.
  enemy('inventory_swarm', 'A single small taped cube with no limbs and no face; the smallest footprint in the roster.', [[
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '....koOOOOok....',
    '....kokkkkok....',
    '....koOOOOok....',
    '....kooooook....',
    '....kkkkkkkk....',
    '.....KKKKKK.....',
    '................',
  ], [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '....koOOOOok....',
    '....kokkkkok....',
    '....koOOOOok....',
    '....kooooook....',
    '....kkkkkkkk....',
    '................',
    '................',
    '.....KKKKKK.....',
    '................',
  ]]),

  // ENM-029 Bottleneck — the mass is all high and all on its back. The slatted hump is a
  // folded pallet, so the thing it will put in your way is already visible in the outline.
  enemy('bottleneck', 'Stooped body under a tall slatted pallet hump carried on its back; mass sits high and behind.', [[
    '................',
    '................',
    '.kkkkkkkkkk.....',
    '.kokokokokk.....',
    '.kkkkkkkkkk.....',
    '.kooooooook.....',
    '.kkkkkkkkkk.....',
    '.kokokokokkkkk..',
    '.kkkkkkkkknnnk..',
    '..kbbbbbbkSSSk..',
    '..kbbbbbbkSkSk..',
    '..kbbbbbbkkSkk..',
    '..kbbbbbbbbk....',
    '...kbbbbbbk.....',
    '...kgk.kgk......',
    '...KKK.KKK......',
  ], [
    '................',
    '................',
    '.kkkkkkkkkk.....',
    '.kooooooook.....',
    '.kkkkkkkkkk.....',
    '.kokokokokk.....',
    '.kkkkkkkkkk.....',
    '.kooooooookkkk..',
    '.kkkkkkkkknnnk..',
    '..kbbbbbbkSSSk..',
    '..kbbbbbbkSkSk..',
    '..kbbbbbbkkSkk..',
    '..kbbbbbbbbk....',
    '...kbbbbbbk.....',
    '....kgkkgk......',
    '....KKKKKK......',
  ]]),

  // ENM-030 Shift Lead — the only silhouette with something held ABOVE the head. The raised
  // clipboard plus the hi-vis chest band say "this one is giving orders, not fighting".
  enemy('shift_lead', 'Upright figure with a bright horizontal chest band and a clipboard raised overhead on one straight arm.', [[
    '...kkkkkk.......',
    '...kwwwwk.......',
    '...kwkkwk.......',
    '...kwwwwk.......',
    '...kkkkkk.......',
    '....kSk.kkkk....',
    '....kSk.knnnk...',
    '....kSkkkSSSk...',
    '....kSSkkSkSk...',
    '...kkkkkkkSkk...',
    '...kbbbbbbbbk...',
    '...kAAAAAAAAk...',
    '...kAAAAAAAAk...',
    '...kbbbbbbbbk...',
    '....kgk.kgk.....',
    '....KKK.KKK.....',
  ], [
    '...kkkkkk.......',
    '...kwwwwk.......',
    '...kwkkwk.......',
    '...kwwwwk.......',
    '...kkkkkk.......',
    '....kSk.kkkk....',
    '....kSk.knnnk...',
    '....kSkkkSSSk...',
    '....kSSkkSkSk...',
    '...kkkkkkkSkk...',
    '...kbbbbbbbbk...',
    '...kqqqqqqqqk...',
    '...kAAAAAAAAk...',
    '...kbbbbbbbbk...',
    '.....kgkgk......',
    '.....KKKKK......',
  ]]),

  // ENM-031 Pallet Mimic — the two frames have an IDENTICAL outline on purpose. It is a
  // full-width stacked pallet with no head and no limbs; the only tell is one slat opening.
  enemy('pallet_mimic', 'A full-width stacked pallet, no head and no limbs; the outline never changes, one slat just opens an eye.', [[
    '................',
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    'kokokokokokokook',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    'kokokokokokokook',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    'KKKKKKKKKKKKKKKK',
    '................',
  ], [
    '................',
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    'kokokokokokokook',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    'kokokRRrRRkokook',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    'KKKKKKKKKKKKKKKK',
    '................',
  ]]),

  // ENM-032 Safety Officer — the only helmeted outline in the department. The brim is wider
  // than the shoulders, and the sash runs corner to corner so the torso reads as a diagonal.
  enemy('safety_officer', 'Hard hat with a brim wider than its shoulders, and a reflective sash cutting a diagonal across the torso.', [[
    '................',
    '.....kkkkkk.....',
    '....kkAAAAkk....',
    '..kkkkkkkkkkkk..',
    '..kAAAAAAAAAAk..',
    '..kkkkkkkkkkkk..',
    '.....kSSSSk.....',
    '.....kkSSkk.....',
    '......kSSk......',
    '...kkkkkkkkkk...',
    '...kAOOOOOOOk...',
    '...kOAAOOOOOk...',
    '...kOOOAAOOOk...',
    '...kOOOOOAAOk...',
    '....kgk.kgk.....',
    '....KKK.KKK.....',
  ], [
    '................',
    '.....kkkkkk.....',
    '....kkAAAAkk....',
    '..kkkkkkkkkkkk..',
    '..kAAAAAAAAAAk..',
    '..kkkkkkkkkkkk..',
    '.....kSSSSk.....',
    '.....kkSSkk.....',
    '......kSSk......',
    '...kkkkkkkkkk...',
    '...kqOOOOOOOk...',
    '...kOqqOOOOOk...',
    '...kOOOqqOOOk...',
    '...kOOOOOqqOk...',
    '.....kgkgk......',
    '.....KKKKK......',
  ]]),

  // ENM-033 Temp Worker — the thinnest body in the game, four pixels of torso. The lanyard
  // badge sticks out to one side and flips sides between frames, which is the split tell.
  enemy('temp_worker', 'The thinnest humanoid in the roster, with a lanyard badge flapping off one side of its chest.', [[
    '................',
    '......kkkk......',
    '.....knnnnk.....',
    '.....kSSSSk.....',
    '.....kkSSkk.....',
    '......kSSk......',
    '....kkkkkkkk....',
    '...kskwwwwksk...',
    '...kskwccwksk...',
    '...kskwccwksk...',
    '.....kwwwwkCk...',
    '.....kwwwwk.....',
    '.....kbbbbk.....',
    '.....kbbbbk.....',
    '.....kgkkgk.....',
    '.....KKKKKK.....',
  ], [
    '................',
    '......kkkk......',
    '.....knnnnk.....',
    '.....kSSSSk.....',
    '.....kkSSkk.....',
    '......kSSk......',
    '....kkkkkkkk....',
    '...kskwwwwksk...',
    '...kskwccwksk...',
    '...kskwccwksk...',
    '...kCkwwwwk.....',
    '.....kwwwwk.....',
    '.....kbbbbk.....',
    '.....kbbbbk.....',
    '......kggk......',
    '......KKKK......',
  ]]),

  // ENM-034 Overtime Zombie — the head sits a row lower than any other upright body and the
  // hands hang past the waist. The trailing shadow smear is the dragging foot.
  enemy('overtime_zombie', 'Slumped body with the head dropped low, hands hanging past the waist, and one foot dragging a shadow behind it.', [[
    '................',
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '.....kSSSSk.....',
    '...kkkkkkkkkk...',
    '...kGGGGGGGGk...',
    '..ksGGGGGGGGsk..',
    '..kskGGGGGGksk..',
    '..kskGGGGGGksk..',
    '..kskkGGGGkksk..',
    '..kdk.kggk.kdk..',
    '.....kgk.kgk....',
    '..KKKKKK.KKK....',
  ], [
    '................',
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '.....kSSSSk.....',
    '...kkkkkkkkkk...',
    '...kGGGGGGGGk...',
    '..ksGGGGGGGGsk..',
    '..kskGGGGGGksk..',
    '..kskGGGGGGksk..',
    '..kskkGGGGkksk..',
    '..kdk.kggk.kdk..',
    '.....kgkkgk.....',
    '.....KKKKKKKK...',
  ]]),

  // ENM-035 Cart Train — three identical low carts in a line, the full width of the grid and
  // barely a third of its height. Nothing else in the game is this wide or this repetitive.
  enemy('cart_train', 'Three identical low carts linked in a line spanning the full width; wider than the player is tall.', [[
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.kkkk.kkkk.kkkk.',
    '.kwwk.kwwk.kwwk.',
    '.kwwkgkwwkgkwwk.',
    '.kkkk.kkkk.kkkk.',
    '.kGGk.kGGk.kGGk.',
    '.kkkk.kkkk.kkkk.',
    '.k..k.k..k.k..k.',
    '.KKKK.KKKK.KKKK.',
    '................',
  ], [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.kkkk.kkkk.kkkk.',
    '.kwwk.kwwk.kwwk.',
    '.kwwkGkwwkGkwwk.',
    '.kkkk.kkkk.kkkk.',
    '.kGGk.kGGk.kGGk.',
    '.kkkk.kkkk.kkkk.',
    '..k.k..k.k..k.k.',
    '.KKKK.KKKK.KKKK.',
    '................',
  ]]),

  // ENM-036 Labeler — compact and unremarkable except for the device slung at its hip and the
  // tape spool sitting on top of it. The spool is the only part that animates: it turns.
  enemy('labeler', 'Compact body with a chunky device slung at hip height and a tape spool turning on top of it.', [[
    '................',
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '.....kSSSSk.....',
    '...kkkkkkkkkk...',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbkkqk',
    '...kbbbbbbbbkkak',
    '..kskbbbbbbkkkkk',
    '..kskbbbbbbkGGGk',
    '...kkbbbbbbkkkkk',
    '....kgkkgk......',
    '....KKKKKK......',
  ], [
    '................',
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '.....kSSSSk.....',
    '...kkkkkkkkkk...',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbkkak',
    '...kbbbbbbbbkkqk',
    '..kskbbbbbbkkkkk',
    '..kskbbbbbbkGGGk',
    '...kkbbbbbbkkkkk',
    '.....kggk.......',
    '.....KKKK.......',
  ]]),
];

export default operations;
