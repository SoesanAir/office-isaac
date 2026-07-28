/**
 * Sprite domain: Open Office enemies (ENM-001..012). Owns `enemy_` ids in this range.
 *
 * GDD refs: 14.3 ("Each enemy has a unique silhouette at gameplay scale"), 18.3
 *           (each enemy family has a distinct silhouette *before* palette
 *           differences are considered), 18.1 (chunky, slightly grotesque
 *           corporate-cartoon tone), R-ART-001 (readable at native gameplay scale),
 *           R-ART-004 / R-DPT-005 (readable in grayscale), R-VIS-002 (a veteran can
 *           identify most common enemies and their attack intent at a glance).
 *
 * `npm run validate` compares `silhouetteSignature()` across every `enemy_*` sprite
 * and fails on a collision, so uniqueness is enforced rather than hoped for. But
 * passing that check is the floor, not the goal: the real target is R-VIS-002, which
 * means the silhouette has to say what the enemy *does*.
 *
 * So each entry owns a different shape language:
 *   drone            plain upright humanoid — the baseline everything reads against
 *   desk shooter     seated torso on a wide desk slab; visibly anchored
 *   paper pusher     mass shoved to one side by the box it drives
 *   coffee sprinter  lean and pitched onto a diagonal
 *   nervous intern   smallest body, hunched
 *   chair rider      wheeled base, no legs at all
 *   team player      T-shape, the widest arm span in the department
 *   HR rep           flat folder slab across the chest
 *   meeting cluster  several small bodies, no single mass
 *   burned-out drone wider than tall, slumped
 *   cubicle camper   upper body only, over a solid divider
 *   reply guy        top-heavy, lit screen above the head
 *
 * Grids are authored at half the 32px reference grid and baked at `scale: 2`.
 */

const SCALE = 2;

const enemy = (slug, silhouette, frames) => ({
  id: `enemy_${slug}`,
  anchor: [0.5, 0.92],
  scale: SCALE,
  silhouette,
  frames,
});

const openOffice = [
  // ENM-001 Office Drone — the reference silhouette; every other body differs from it.
  enemy('office_drone', 'Plain upright humanoid, narrow shoulders. The baseline body.', [[
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '....kSSSSSSk....',
    '.....kSSSSk.....',
    '......kssk......',
    '....kkbbbbkk....',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    '....kbbbbbbk....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kg..gk.....',
    '.....kk..kk.....',
    '................',
  ], [
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '....kSSSSSSk....',
    '.....kSSSSk.....',
    '......kssk......',
    '....kkbbbbkk....',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    '....kbbbbbbk....',
    '.....kggggk.....',
    '....kgggggk.....',
    '....kg...gk.....',
    '....kk...kk.....',
    '................',
  ]]),

  // ENM-002 Desk Shooter — the wide slab is the whole read: it will never chase you.
  enemy('desk_shooter', 'Torso rising from a wide desk slab; visibly anchored, never walking.', [[
    '................',
    '................',
    '......kkkkk.....',
    '.....knnnnnk....',
    '.....kSSSSSk....',
    '.....kSkSkSk....',
    '.....kSSSSSk....',
    '......kSSSk.....',
    '....kkbbbbkk....',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    'kkkkkkkkkkkkkkkk',
    'kGGGGGGGGGGGGGGk',
    'kGwwGwwGwwGwwGGk',
    'kGGGGGGGGGGGGGGk',
    'kkkkkkkkkkkkkkkk',
    '.kk..........kk.',
    '................',
  ]]),

  // ENM-003 Paper Pusher — off-centre mass; the copier leads, the body follows.
  enemy('paper_pusher', 'Body displaced to one side by the copier it pushes; off-centre mass.', [[
    '................',
    '.........kkkkk..',
    '........knnnnnk.',
    '........kSSSSSk.',
    '........kSkSkSk.',
    '........kSSSSSk.',
    '.........kSSSk..',
    '.kkkkkk..kkbbkk.',
    'kGGGGGGkkbbbbbbk',
    'kGwwwwGkbbbbbbbk',
    'kGwwwwGkbbbbbbbk',
    'kGGGGGGk.kbbbbk.',
    'kkkkkkkk..kggak.',
    '.kk..kk...kggak.',
    '..........kg.gk.',
    '..........kk.kk.',
    '................',
    '................',
  ]]),

  // ENM-004 Coffee Sprinter — the only body pitched onto a diagonal.
  enemy('coffee_sprinter', 'Lean body pitched forward on a diagonal, cup thrust ahead.', [[
    '................',
    '.......kkkkk....',
    '......knnnnnk...',
    '......kSSSSSk...',
    '......kSkSkSk...',
    '.......kSSSk....',
    '...kk...kssk....',
    '..kOOk.kbbbbk...',
    '..kOOkkbbbbbbk..',
    '...kkbbbbbbbk...',
    '....kbbbbbbk....',
    '...kbbbbbbk.....',
    '...kggak........',
    '..kggak.........',
    '..kg.k..........',
    '..kk.kk.........',
    '................',
    '................',
  ]]),

  // ENM-005 Nervous Intern — smallest body in the roster, permanently hunched.
  enemy('nervous_intern', 'Smallest humanoid, hunched and narrow; occupies very little space.', [[
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....knnnnk.....',
    '.....kSSSSk.....',
    '.....kSkkSk.....',
    '......kSSk......',
    '......kssk......',
    '.....kcccck.....',
    '....kcccccck....',
    '....kcccccck....',
    '.....kcccck.....',
    '......kggk......',
    '......kggk......',
    '......kk.k......',
    '................',
    '................',
  ]]),

  // ENM-006 Rolling Chair Rider — wheels instead of legs, so no walk cycle exists.
  enemy('rolling_chair_rider', 'Seated on a wheeled base; no legs, castors instead.', [[
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '.....kSSSSk.....',
    '......kssk......',
    '...kkkbbbbkkk...',
    '..kGbbbbbbbbGk..',
    '..kGbbbbbbbbGk..',
    '..kGGkbbbbkGGk..',
    '...kkkkGGkkkk...',
    '......kGGk......',
    '...kkkkGGkkkk...',
    '..kGGGGGGGGGGk..',
    '..kkkkkkkkkkkk..',
    '..kk..kk..kk....',
    '................',
  ]]),

  // ENM-007 Team Player — a T-shape. Widest arm span in the department.
  enemy('team_player', 'T-shape with arms raised wide; the broadest span in the roster.', [[
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '....kSSSSSSk....',
    '.....kSSSSk.....',
    '......kssk......',
    'kSkkkkbbbbkkkkSk',
    'kSkbbbbbbbbbbkSk',
    'kSkbbbbbbbbbbkSk',
    'kkkbbbbbbbbbbkkk',
    '....kbbbbbbk....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kg..gk.....',
    '.....kk..kk.....',
    '................',
  ]]),

  // ENM-008 HR Representative — a horizontal folder bar across the mid-body.
  enemy('hr_representative', 'Flat folder slab held across the chest; a horizontal bar mid-body.', [[
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '....kSSSSSSk....',
    '.....kSSSSk.....',
    '......kssk......',
    '....kkrrrrkk....',
    '...krrrrrrrrk...',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkwwkkwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '.....kggggk.....',
    '.....kg..gk.....',
    '.....kk..kk.....',
    '................',
  ]]),

  // ENM-009 Meeting Cluster — no single mass; the empty centre is the tell.
  enemy('meeting_cluster', 'Several small bodies orbiting an empty centre; no single mass.', [[
    '................',
    '......kkkk......',
    '.....kSSSSk.....',
    '.....kbbbbk.....',
    '......kkkk......',
    '.kkkk......kkkk.',
    'kSSSSk....kSSSSk',
    'kbbbbk....kbbbbk',
    '.kkkk......kkkk.',
    '................',
    '.kkkk......kkkk.',
    'kSSSSk....kSSSSk',
    'kbbbbk....kbbbbk',
    '.kkkk......kkkk.',
    '......kkkk......',
    '.....kSSSSk.....',
    '.....kbbbbk.....',
    '......kkkk......',
  ]]),

  // ENM-010 Burned-Out Drone — wider than tall. Reads as a tank before it moves.
  enemy('burned_out_drone', 'Wider than tall and slumped; visibly a tank on sight.', [[
    '................',
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kdkddkdk....',
    '....kddddddk....',
    '.....kddddk.....',
    '..kkkkkddkkkkk..',
    '.kggggggggggggk.',
    'kggggggggggggggk',
    'kggggggggggggggk',
    'kggggggggggggggk',
    'kggggggggggggggk',
    '.kggggggggggggk.',
    '..kkkgggggkkkk..',
    '....kkk..kkk....',
    '................',
    '................',
  ]]),

  // ENM-011 Cubicle Camper — upper body only; the divider hides the legs entirely.
  enemy('cubicle_camper', 'Upper body only, peeking over a solid divider that hides the legs.', [[
    '................',
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSSSSSSk....',
    '....kSkSSkSk....',
    '....kSSSSSSk....',
    '.....kSSSSk.....',
    '......kssk......',
    '....kkbbbbkk....',
    '...kbbbbbbbbk...',
    'kkkkkkkkkkkkkkkk',
    'kGGGGGGGGGGGGGGk',
    'kGGGGGGGGGGGGGGk',
    'kGGGGGGGGGGGGGGk',
    'kGGGGGGGGGGGGGGk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ]]),

  // ENM-012 Reply Guy — top-heavy: a lit screen floats above a small body.
  enemy('reply_guy', 'Top-heavy: a lit screen hovers above a small body.', [[
    '..kkkkkkkkkkkk..',
    '..kCCCCCCCCCCk..',
    '..kCwwwwwwwwCk..',
    '..kCwwwwwwwwCk..',
    '..kCCCCCCCCCCk..',
    '..kkkkkkkkkkkk..',
    '.......kk.......',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....kSkSSkSk....',
    '.....kSSSSk.....',
    '......kssk......',
    '....kkbbbbkk....',
    '...kbbbbbbbbk...',
    '....kbbbbbbk....',
    '.....kggggk.....',
    '.....kk..kk.....',
    '................',
  ]]),
];

export default openOffice;
