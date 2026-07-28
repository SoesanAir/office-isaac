/**
 * Sprite domain: IT enemies (ENM-013..024). Owns `enemy_` ids in this range.
 *
 * GDD refs: 14.3 (unique silhouette per enemy at gameplay scale), 18.3 (distinct
 *           silhouette before palette is considered; elites keep the base shape),
 *           R-VIS-002 (a veteran identifies most common enemies and their attack
 *           intent at a glance), R-ART-004 / R-DPT-005 (grayscale-legible),
 *           Appendix A DPT-002 (server racks, cable trays, blinking status lights).
 *
 * IT's design problem is that half the roster is *not humanoid*, which is the
 * department's whole identity: Open Office is people, IT is equipment that has
 * started acting on its own. That difference is carried in the silhouettes rather
 * than only in the palette, so it survives the grayscale review:
 *
 *   cable snake     long serpentine horizontal, no legs and no head mass
 *   printer beast   squat wide machine with an open mouth
 *   ticket bot      small boxy body on treads
 *   firewall node   thin pylon under a wide shield bracket
 *   malware pop-up  a dialog window with a title bar and a close box
 *   rack turret     tall narrow rack with barrels on four sides
 *   helpdesk agent  humanoid with a headset boom — the one clear person
 *   cursor          a giant arrow, no body at all
 *   blue screen     a flat text panel; wider than anything else and featureless
 *   remote worker   a body inside a call frame, never touching the border
 *   patch tuesday   a small floating gear, the only round free-floater
 *   spam filter     a lattice panel; the only see-through silhouette
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

const it = [
  // ENM-013 Cable Snake — horizontal, legless, and hugs the wall it travels.
  enemy('cable_snake', 'Long serpentine horizontal; no legs, no head mass, hugs walls.', [[
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..kkk...........',
    '.kTTTkk.........',
    'kTTtTTTkk...kkk.',
    'kTTTTtTTTkkkTTTk',
    '.kTTTTTTTTTTTTk.',
    '..kkkTTTTTTkkk..',
    '.....kkkkkk.....',
    '................',
    '................',
  ], [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..kkk...........',
    '.kTTTkk.........',
    'kTTtTTTkk.......',
    'kTTTTtTTTkk.kkk.',
    '.kTTTTTTTTTkTTTk',
    '..kkkTTTTTTTTTk.',
    '.....kkkTTTkkk..',
    '........kkk.....',
    '................',
    '................',
  ]]),

  // ENM-014 Printer Beast — squat, wide, and unmistakably a machine with a mouth.
  enemy('printer_beast', 'Squat wide machine with an open paper mouth; no head, no limbs.', [[
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kHHHHHHHHHHHHk.',
    '.kHkEkHHHHkEkHk.',
    '.kHHHHHHHHHHHHk.',
    'kkkkkkkkkkkkkkkk',
    'kKKKKKKKKKKKKKKk',
    'kKkkkkkkkkkkkkKk',
    'kKKKKKKKKKKKKKKk',
    'kkkkkkkkkkkkkkkk',
    '.kHHHHHHHHHHHHk.',
    '.kHHwwwwwwwwHHk.',
    '.kHHHHHHHHHHHHk.',
    '.kkkkkkkkkkkkkk.',
    '..kk........kk..',
    '................',
  ]]),

  // ENM-015 Ticket Bot — small boxy body on treads. Compact and obviously mobile.
  enemy('ticket_bot', 'Small boxy body on treads; compact, obviously mobile machinery.', [[
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '....kHHHHHHk....',
    '....kHEHHEHk....',
    '....kHHHHHHk....',
    '...kkkkkkkkkk...',
    '..kHHHHHHHHHHk..',
    '..kHwwwwwwwwHk..',
    '..kHHHHHHHHHHk..',
    '..kkkkkkkkkkkk..',
    '.kGGGGGGGGGGGGk.',
    '.kGkGkGkGkGkGGk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ]]),

  // ENM-016 Firewall Node — thin pylon under a wide bracket. Vertical, then wide.
  enemy('firewall_node', 'Thin pylon under a wide shield bracket; narrow base, broad top.', [[
    'kkkkkkkkkkkkkkkk',
    'kTTTTTTTTTTTTTTk',
    'kTkkkkkkkkkkkkTk',
    'kTTTTTTTTTTTTTTk',
    'kkkkkkkkkkkkkkkk',
    '......kkkk......',
    '......kTTk......',
    '......kTTk......',
    '......kTTk......',
    '......kTTk......',
    '......kTTk......',
    '......kTTk......',
    '.....kkTTkk.....',
    '....kGGGGGGk....',
    '....kGGGGGGk....',
    '....kkkkkkkk....',
    '................',
  ]]),

  // ENM-017 Malware Pop-up — a dialog window. Title bar and close box are the tell.
  enemy('malware_popup', 'A dialog window with a title bar and a close box; pure interface.', [[
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kmmmmmmmmmmkRk.',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkkwwkkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkkkkkkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkMMkkMMwwk.',
    '.kwwwwMMwwMMwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ], [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kmmmmmmmmmmkRk.',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkkwwkkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkkkkkkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkMMkkMMwwk.',
    '.kwwwwMMwwMMwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
  ]]),

  // ENM-018 Server Rack Turret — tall, narrow, and bristling on four sides.
  enemy('server_rack_turret', 'Tall narrow rack with barrels on four sides; strictly vertical.', [[
    '................',
    '.....kkkkkk.....',
    '.....kGGGGk.....',
    '..kkkkkkkkkkkk..',
    '..kkGTTTTTTGkk..',
    '..kkGGGGGGGGkk..',
    '..kkGTTTTTTGkk..',
    'kkkkGGGGGGGGkkkk',
    'kTTTGTTTTTTGTTTk',
    'kkkkGGGGGGGGkkkk',
    '..kkGTTTTTTGkk..',
    '..kkGGGGGGGGkk..',
    '..kkGTTTTTTGkk..',
    '..kkkkkkkkkkkk..',
    '.....kGGGGk.....',
    '.....kkkkkk.....',
    '................',
  ]]),

  // ENM-019 Helpdesk Agent — the one clear person in IT, marked by a headset boom.
  enemy('helpdesk_agent', 'Humanoid with a headset boom arm; the one clear person in IT.', [[
    '................',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '...kTkSSSSSk....',
    '...kTkSkSkSk....',
    '...kTTSSSSSk....',
    '....kTkSSSk.....',
    '.....kkssk......',
    '....kkttttkk....',
    '...kttttttttk...',
    '...kttttttttk...',
    '...ktTTTTTTtk...',
    '....kttttttk....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kg..gk.....',
    '.....kk..kk.....',
    '................',
  ]]),

  // ENM-020 Cursor — a giant arrow and nothing else. No body anywhere.
  enemy('cursor', 'A giant arrow pointer; no body at all, the most abstract silhouette.', [[
    '................',
    '...kk...........',
    '...kwk..........',
    '...kwwk.........',
    '...kwwwk........',
    '...kwwwwk.......',
    '...kwwwwwk......',
    '...kwwwwwwk.....',
    '...kwwwwwwwk....',
    '...kwwwwwwwwk...',
    '...kwwwwkkkkk...',
    '...kwwkwwk......',
    '...kwkkwwk......',
    '...kk..kwwk.....',
    '.......kwwk.....',
    '........kk......',
    '................',
  ]], [0.5, 0.5]),

  // ENM-021 Blue Screen — a flat featureless panel, wider than anything else.
  enemy('blue_screen', 'A flat text panel; the widest, most featureless silhouette in IT.', [[
    '................',
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kbbbbbbbbbbbbbbk',
    'kbwwwwwwwwwwwwbk',
    'kbbbbbbbbbbbbbbk',
    'kbwwwwwwwwbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbwwwwwwwwwwwbbk',
    'kbbbbbbbbbbbbbbk',
    'kbwwwwwwbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................',
  ]]),

  // ENM-022 Remote Worker — a body inside a call frame, never touching the border.
  enemy('remote_worker', 'A small body floating inside a call frame; never touches the border.', [[
    'kkkkkkkkkkkkkkkk',
    'kK............Kk',
    'k....kkkkkk....k',
    'k...knnnnnnk...k',
    'k...kSkSSkSk...k',
    'k....kSSSSk....k',
    'k.....kssk.....k',
    'k...kkbbbbkk...k',
    'k..kbbbbbbbbk..k',
    'k..kbbbbbbbbk..k',
    'k...kbbbbbbk...k',
    'k......kk......k',
    'kK............Kk',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................',
  ]]),

  // ENM-023 Patch Tuesday — a small round free-floater; the only gear shape.
  enemy('patch_tuesday', 'A small floating gear; the only round free-floating silhouette.', [[
    '................',
    '................',
    '................',
    '......kkk.......',
    '....kkGGGkk.....',
    '...kGGGGGGGk....',
    '..kkGGkkkGGkk...',
    '..kGGkk.kkGGk...',
    '..kGGk...kGGk...',
    '..kGGkk.kkGGk...',
    '..kkGGkkkGGkk...',
    '...kGGGGGGGk....',
    '....kkGGGkk.....',
    '......kkk.......',
    '................',
    '................',
  ]], [0.5, 0.5]),

  // ENM-024 Spam Filter — a lattice. The only silhouette you can see through.
  enemy('spam_filter', 'A lattice panel; the only see-through silhouette in the roster.', [[
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kTkTkTkTkTkTTk.',
    '.kkkkkkkkkkkkkk.',
    '.kTkTkTkTkTkTTk.',
    '.kkkkkkkkkkkkkk.',
    '.kTkTkTkTkTkTTk.',
    '.kkkkkkkkkkkkkk.',
    '.kTkTkTkTkTkTTk.',
    '.kkkkkkkkkkkkkk.',
    '.kTkTkTkTkTkTTk.',
    '.kkkkkkkkkkkkkk.',
    '....kk....kk....',
    '....kk....kk....',
    '................',
    '................',
  ]]),
];

export default it;
