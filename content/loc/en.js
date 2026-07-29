/**
 * English localization.
 *
 * GDD refs: 17.3 (item language: qualitative phrasing, never raw deltas),
 *           R-ITM-005 (pickup text hides stat deltas; an automated string scan
 *           flags percent signs and numeric deltas), R-AUD-003 (every audio-only
 *           cue has a caption), 19.4 (localization-ready text ids are mandatory
 *           even for jokes), R-TEC-006 (no system branches on this text),
 *           R-PRG-004 / D-016 (no copy states a total count of endings, items, or
 *           secrets), 2.8 (theme everywhere), 25 (office joke fatigue: prefer a
 *           specific observation over a buzzword pun).
 *
 * Two rules govern the writing here:
 *
 *  1. **No pickup phrase may contain a number.** `npm run validate` scans these
 *     strings for digits, percent signs, and signed deltas and fails the build.
 *     "Typing faster", never "-12% fire delay".
 *  2. **No copy may imply how much content exists.** Ending text never says
 *     "1 of 9"; the collection has no denominators. The game does not announce its
 *     own size (D-016).
 */

/**
 * Derive a display name from an id slug: `filing_cabinet` -> `Filing Cabinet`.
 *
 * Used only where the name genuinely is the noun — office objects, hazards. Anything
 * with voice or a joke in it is written longhand below, because deriving personality
 * from a slug produces exactly the flat buzzword output GDD 25 warns against.
 */
function title(slug) {
  return slug
    .split('_')
    .map((w) => (SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
const SMALL_WORDS = new Set(['and', 'of', 'the']);

/** Expand `prefix.<slug>.<field>` -> derived value for a list of slugs. */
function derive(prefix, field, slugs, transform = title) {
  const out = {};
  for (const slug of slugs) out[`${prefix}.${slug}.${field}`] = transform(slug);
  return out;
}

const DEPARTMENT_NAMES = {
  'department.open_office.name': 'Open Office',
  'department.it.name': 'IT',
  'department.operations.name': 'Operations',
  'department.executive.name': 'Executive',
  'department.finance.name': 'Finance',
  'department.marketing.name': 'Marketing',
  'department.legal.name': 'Legal and Compliance',
  'department.facilities.name': 'Facilities',
  'department.rnd.name': 'Research and Development',
  'department.board.name': 'The Board',
  'department.parent_company.name': 'Parent Company',
  'department.conglomerate.name': 'The Conglomerate',
  'department.ownership.name': 'Ownership',
};

/** Floors read as "Open Office I" and "Open Office II" (GDD 10.2). */
const FLOOR_NAMES = (() => {
  const out = {};
  const roman = { 1: 'I', 2: 'II' };
  for (const key of Object.keys(DEPARTMENT_NAMES)) {
    const slug = key.split('.')[1];
    for (const tier of [1, 2]) {
      out[`floor.${slug}_${tier}.name`] = `${DEPARTMENT_NAMES[key]} ${roman[tier]}`;
    }
  }
  return out;
})();

const OBJECT_SLUGS = [
  'filing_cabinet', 'water_cooler', 'printer', 'recycling_bin', 'vending_machine',
  'office_plant', 'cubicle_divider', 'desk', 'rolling_chair', 'server_rack',
  'cable_bundle', 'glass_partition', 'archive_shelf', 'whiteboard', 'coffee_machine',
  'fire_extinguisher', 'supply_cart', 'locked_cabinet', 'power_strip', 'trophy_case',
  'coffee_stain', 'paper_pile', 'security_scanner', 'conveyor_lane',
];

const HAZARD_SLUGS = [
  'floor_arc', 'shock_lane', 'outlet_spark', 'trip_bundle', 'live_cable_run',
  'slack_coil', 'steam_vent', 'toner_cloud', 'stamp_press', 'water_slick',
  'coffee_scald', 'dry_stain', 'belt_run', 'reversing_belt', 'pinch_roller',
  'sweep_line', 'mark_pulse', 'idle_reader', 'paper_blaze', 'scorch_mark',
  'shard_field', 'hvac_blast', 'outage_zone', 'compliance_band', 'paper_drift',
  'foam_discharge', 'quorum_circle',
];

const strings = {
  // -------------------------------------------------------------------------
  // World
  // -------------------------------------------------------------------------
  ...DEPARTMENT_NAMES,
  ...FLOOR_NAMES,
  ...derive('object', 'name', OBJECT_SLUGS),
  ...derive('hazard', 'name', HAZARD_SLUGS),

  'route.base.name': 'The Building',
  'route.board.name': 'Above the Building',
  'route.parent_company.name': 'Elsewhere',
  'route.conglomerate.name': 'Everywhere',
  'route.ownership.name': 'The Top',
  'route.facilities_branch.name': 'Service Access',
  'route.rnd_branch.name': 'Prototype Wing',

  // -------------------------------------------------------------------------
  // Music. Titles are corporate-document dry on purpose.
  // -------------------------------------------------------------------------
  'music.open_office.name': 'Standard Working Hours',
  'music.open_office.ambience': 'Fluorescent hum, distant phones, someone typing too hard',
  'music.it.name': 'Scheduled Maintenance Window',
  'music.it.ambience': 'Fan drone, status lights, a cold aisle',
  'music.operations.name': 'Throughput',
  'music.operations.ambience': 'Conveyor rhythm, cart impacts, barcode chirps',
  'music.executive.name': 'Closed Session',
  'music.executive.ambience': 'Thick carpet, glass, a silence you can feel',
  'music.finance.name': 'Reconciliation',
  'music.finance.ambience': 'Coin counters, receipt printers, a tightening metronome',
  'music.marketing.name': 'Brand Refresh',
  'music.marketing.ambience': 'Studio lights, applause loops, a hook that will not leave',
  'music.legal.name': 'Pending Review',
  'music.legal.ambience': 'Paper movement, seals, delayed impacts',
  'music.facilities.name': 'Below Code',
  'music.facilities.ambience': 'Boiler pressure, dripping water, one dying bulb',
  'music.rnd.name': 'Prototype Zero',
  'music.rnd.ambience': 'Test-chamber tones, unstable equipment, whiteboard nonsense',
  'music.board.name': 'Quorum',
  'music.board.ambience': 'A room larger than the building it is in',
  'music.parent_company.name': 'Unbranded',
  'music.parent_company.ambience': 'Clean, anonymous, wrong',
  'music.conglomerate.name': 'Merged Entity',
  'music.conglomerate.ambience': 'Several buildings pretending to be one',
  'music.ownership.name': 'Beneficial',
  'music.ownership.ambience': 'Almost nothing',

  // -------------------------------------------------------------------------
  // Employee profiles (GDD 16.6)
  // -------------------------------------------------------------------------
  'profile.employee.name': 'Employee',
  'profile.employee.identity': 'Entirely ordinary. Everything else is measured against you.',
  'profile.intern.name': 'Intern',
  'profile.intern.identity': 'Faster, thinner, and somehow already has a badge that works.',
  'profile.it_specialist.name': 'IT Specialist',
  'profile.it_specialist.identity': 'Carries a spare battery and an opinion about the printer.',
  'profile.contractor.name': 'Contractor',
  'profile.contractor.identity': 'Protected on paper. Nothing here is really yours, including the coffee.',
  'profile.burned_out_veteran.name': 'Burned-Out Veteran',
  'profile.burned_out_veteran.identity': 'Hits hardest with the least left, and has stopped pretending otherwise.',
  'profile.executive_assistant.name': 'Executive Assistant',
  'profile.executive_assistant.identity': 'Blocks more than you throw. Knows where everyone will be standing.',
  'profile.remote_worker.name': 'Remote Worker',
  'profile.remote_worker.identity': 'Attends from somewhere else. Attacks arrive by bouncing.',
  'profile.facilities_tech.name': 'Facilities Tech',
  'profile.facilities_tech.identity': 'Close range, and a strong sense of which walls are load-bearing.',

  // -------------------------------------------------------------------------
  // Endings (GDD 16.7). No copy states a total (D-016, R-PRG-004).
  // -------------------------------------------------------------------------
  'ending.termination.name': 'Termination',
  'ending.termination.condition': 'Defeat the CEO.',
  'ending.termination.beat_1': 'Your access is revoked at 4:58pm. Nobody schedules a meeting about it.',

  'ending.promotion.name': 'Promotion',
  'ending.promotion.condition': 'Defeat the CEO again. And again.',
  'ending.promotion.beat_1': 'You are given a corner office. It has one door and no handle on the inside.',

  'ending.golden_handshake.name': 'Golden Handshake',
  'ending.golden_handshake.condition': 'Take the deal, then finish the job.',
  'ending.golden_handshake.beat_1': 'The company pays for your silence. The amount is not negotiable, and neither is the silence.',

  'ending.elevator_keeps_going.name': 'The Elevator Keeps Going',
  'ending.elevator_keeps_going.condition': 'Keep coming back.',
  'ending.elevator_keeps_going.beat_1': 'You have done this before. The building has noticed.',

  'ending.quorum.name': 'Quorum',
  'ending.quorum.condition': 'Meet the people who hired the CEO.',
  'ending.quorum.beat_1': 'Eleven chairs, nine of them occupied. The paperwork on the table is not about this company.',

  'ending.hostile_takeover.name': 'Hostile Takeover',
  'ending.hostile_takeover.condition': 'Acquire, briefly.',
  'ending.hostile_takeover.beat_1': 'For an instant you own all of it. Then something larger completes its own paperwork.',

  'ending.subsidiary.name': 'Subsidiary',
  'ending.subsidiary.condition': 'Find out who owns the owners.',
  'ending.subsidiary.beat_1': 'The company you destroyed was a line item. It has already been replaced with an identical one.',

  'ending.consolidated.name': 'Consolidated',
  'ending.consolidated.condition': 'Assemble what does not want assembling.',
  'ending.consolidated.beat_1': 'Every logo you have seen resolves into one shape. It was always this shape.',

  'ending.beneficial_ownership.name': 'Beneficial Ownership',
  'ending.beneficial_ownership.condition': 'Arrive somewhere with no floor above it.',
  'ending.beneficial_ownership.beat_1': 'The room is empty, expensive, and clean. There is no desk. Nothing here has ever been worked in.',
  'ending.beneficial_ownership.beat_2': 'Someone has been here recently. The chair is still warm.',

  // -------------------------------------------------------------------------
  // Unlock descriptions. Shown in the collection only after discovery.
  // -------------------------------------------------------------------------
  'unlock.alternate_finance.description': 'Finance will now take calls during chapter three.',
  'unlock.alternate_marketing.description': 'Marketing has expressed interest in your numbers.',
  'unlock.alternate_legal.description': 'Legal has requested a meeting before the executive floor.',
  'unlock.legal_escalation.description': 'Compliance has escalated. There is more of it now.',
  'unlock.ceo_clear_first.description': 'The chief executive has been removed from the org chart.',
  'unlock.ceo_clear_three.description': 'The executive floor has learned from your last few visits.',
  'unlock.ceo_clear_five.description': 'Other departments are willing to be on your route.',
  'unlock.ceo_clear_seven.description': 'The elevator sounds different on the way up.',
  'unlock.board_route.description': 'The elevator does not stop where it used to.',
  'unlock.ownership_documents.description': 'Documents about ownership can now be found in the service spaces.',
  'unlock.parent_company_route.description': 'Two fragments, one visit, and a different set of doors.',
  'unlock.hostile_takeover.description': 'You were acquired mid-acquisition.',
  'unlock.ownership_keys.description': 'Three keys exist. They are not kept together.',
  'unlock.conglomerate_route.description': 'All three keys in one run. Something merges.',
  'unlock.ownership_route.description': 'No debt, and a secret found in every chapter. The last elevator appears.',
  'unlock.beneficial_ownership.description': 'You have met the owner.',
  'unlock.facilities_branch.description': 'The service elevator answers now.',
  'unlock.rnd_branch.description': 'The prototype wing is accepting visitors.',
  'unlock.profile_intern.description': 'Cleared the first chapter without taking a manager reward.',
  'unlock.profile_it_specialist.description': 'Defeated everything IT could escalate to.',
  'unlock.profile_contractor.description': 'Finished a run still owing money.',
  'unlock.profile_burned_out.description': 'Won on almost nothing.',
  'unlock.profile_exec_assistant.description': 'Took no damage from a vice president.',
  'unlock.profile_remote_worker.description': 'Attended from a floor that does not exist.',
  'unlock.profile_facilities_tech.description': 'Completed the service route.',
  'unlock.transformation_latte.description': 'Coffee and milk, combined correctly.',
  'unlock.team_player_badge.description': 'Beat a team lead without being touched.',
  'unlock.shadow_procurement.description': 'Found the supplier who is not on the supplier list.',

  // -------------------------------------------------------------------------
  // Captions (R-AUD-003). Every audio-only cue needs a non-audio equivalent.
  // Short bracketed observations, the way subtitles read.
  // -------------------------------------------------------------------------
  'caption.player_hurt': '[hit]',
  'caption.player_death': '[you collapse]',
  'caption.low_health': '[heartbeat]',
  'caption.shield_break': '[shield breaks]',
  'caption.spite_burst': '[spite discharges]',
  'caption.telegraph': '[attack winding up]',
  'caption.charge_windup': '[something is charging]',
  'caption.slam_windup': '[slam incoming]',
  'caption.sprinter_shake': '[cup rattling]',
  'caption.printer_windup': '[printer spinning up]',
  'caption.shock_arming': '[electricity arming]',
  'caption.boss_intro': '[manager arrives]',
  'caption.boss_phase': '[manager changes tactics]',
  'caption.boss_death': '[manager defeated]',
  'caption.active_used': '[item activated]',
  'caption.card_used': '[card played]',
  'caption.toner_fuse': '[toner fuse lit]',
  'caption.toner_blast': '[toner detonates]',
  'caption.doors_sealed': '[doors seal]',
  'caption.doors_open': '[doors open]',
  'caption.door_locked': '[locked]',
  'caption.badge_spent': '[badge accepted]',
  'caption.room_cleared': '[room clear]',
  'caption.health_gained': '[composure restored]',
  'caption.item_collected': '[item collected]',
  'caption.purchased': '[purchased]',
  'caption.machine_dispense': '[machine dispenses]',
  'caption.machine_jammed': '[machine jams]',
  'caption.secret_found': '[maintenance access found]',
  'caption.elevator_arrive': '[elevator arrives]',
  'caption.elevator_depart': '[elevator ascends]',
  'caption.unlock_granted': '[something new is available]',
  'caption.sting_open_office': '[entering Open Office]',
  'caption.sting_it': '[entering IT]',
  'caption.sting_operations': '[entering Operations]',
  'caption.sting_executive': '[entering Executive]',
  'caption.sting_finance': '[entering Finance]',
  'caption.sting_marketing': '[entering Marketing]',
  'caption.sting_legal': '[entering Legal]',
  'caption.sting_facilities': '[entering Facilities]',
  'caption.sting_rnd': '[entering Research and Development]',
  'caption.sting_board': '[entering the Board]',
  'caption.sting_parent_company': '[entering the parent company]',
  'caption.sting_conglomerate': '[entering the conglomerate]',
  'caption.sting_ownership': '[entering Ownership]',

  // -------------------------------------------------------------------------
  // Weapons (Appendix B).
  //
  // Names are the plain office noun — the joke is that these are real objects, and
  // renaming them would throw that away. Descriptions say what the weapon FEELS
  // like, never what it scores: GDD 17.3 and R-ITM-005 keep numbers out of
  // player-facing copy, and the validator scans these strings for digits.
  // -------------------------------------------------------------------------
  'weapon.keyboard.name': 'Keyboard',
  'weapon.keyboard.description': 'Fires keycaps in whichever direction you are pointing. Everything else in the building is measured against it.',
  'weapon.mouse.name': 'Mouse',
  'weapon.mouse.description': 'Swung on its cord in a short arc. No reach at all, and it sweeps everything standing next to you.',
  'weapon.big_laser_pointer.name': 'Big Laser Pointer',
  'weapon.big_laser_pointer.description': 'The presentation model, not the pen. Holds a continuous beam across the room for as long as you keep the button down.',
  'weapon.stapler.name': 'Stapler',
  'weapon.stapler.description': 'Heavy metal, slow and deliberate, with a reload you can feel. Staples go through things that ought to stop them.',
  'weapon.hole_punch.name': 'Hole Punch',
  'weapon.hole_punch.description': 'Fires two paper discs on a narrow gap. Short-lived, and they shove whatever they hit backwards.',
  'weapon.marker.name': 'Marker',
  'weapon.marker.description': 'Leaves a wet stroke behind every shot. The line keeps working after the shot has stopped.',
  'weapon.rubber_stamp.name': 'Rubber Stamp',
  'weapon.rubber_stamp.description': 'A committed downward slam with a wind-up. Nothing subtle, and nothing in the rectangle survives it.',
  'weapon.paper_shredder.name': 'Paper Shredder',
  'weapon.paper_shredder.description': 'Sprays strips in a loud short cone. Terrible at distance, overwhelming at arm-s length.',
  'weapon.presentation_remote.name': 'Presentation Remote',
  'weapon.presentation_remote.description': 'A slow click pulse that bounces off walls and furniture. Rewards knowing the room.',
  'weapon.desk_phone.name': 'Desk Phone',
  'weapon.desk_phone.description': 'Throws the receiver on its cord and drags it back. Both directions hurt, and it can wrap around one target.',
  'weapon.label_maker.name': 'Label Maker',
  'weapon.label_maker.description': 'Charges, then sticks a label to something. The label is patient. Then it is not.',
  'weapon.copier.name': 'Copier',
  'weapon.copier.description': 'Charges and launches a broad sheet-shaped wave. Slow, wide, and it pushes.',
  'weapon.desk_fan.name': 'Desk Fan',
  'weapon.desk_fan.description': 'A sustained airflow that shoves enemies and turns incoming paper around. Control first, damage second.',
  'weapon.projector.name': 'Projector',
  'weapon.projector.description': 'Set it down and it holds a burning cone in one direction until it gives out. One at a time.',

  // -------------------------------------------------------------------------
  // Passive items (Appendix C).
  //
  // Three strings each. `.name` is the plain office noun. `.phrase` is the single
  // line shown on pickup — GDD 17.3 and R-ITM-005: qualitative, never a delta, and
  // the validator rejects a digit or a percent sign here. `.collection` is the
  // longer catalogue entry, which may say what the item *does* but still never
  // states a magnitude, because the collection is not a spreadsheet.
  //
  // GDD 25 warns about office joke fatigue, so these prefer a specific observation
  // over a buzzword pun: the espresso is the fourth of the morning, the plant is
  // the one nobody waters, the chair is the one nobody wants.
  // -------------------------------------------------------------------------
  'item.espresso_shot.name': 'Espresso Shot',
  'item.espresso_shot.phrase': 'Typing faster than you can think.',
  'item.espresso_shot.collection': 'The fourth one of the morning. Your hands get ahead of your hands.',
  'item.milk_carton.name': 'Milk Carton',
  'item.milk_carton.phrase': 'Something in your stomach for once.',
  'item.milk_carton.collection': 'Taken from the shared fridge. It was probably yours. You have decided it was yours.',
  'item.sugar_packets.name': 'Sugar Packets',
  'item.sugar_packets.phrase': 'Everything leaves your hand quicker.',
  'item.sugar_packets.collection': 'A fistful from the bowl by the machine. Nobody counts these.',
  'item.mechanical_switches.name': 'Mechanical Switches',
  'item.mechanical_switches.phrase': 'A sharper, louder rhythm.',
  'item.mechanical_switches.collection': 'You brought these in yourself and installed them at your desk. Two people have complained.',
  'item.heavy_keycaps.name': 'Heavy Keycaps',
  'item.heavy_keycaps.phrase': 'Slower, and it lands harder.',
  'item.heavy_keycaps.collection': 'Thick and dense. Each press is a decision, and each one arrives with weight.',
  'item.ergonomic_chair.name': 'Ergonomic Chair',
  'item.ergonomic_chair.phrase': 'You move like someone whose back does not hurt.',
  'item.ergonomic_chair.collection': 'Requisitioned properly, through a form. It is startling how much of you was the chair.',
  'item.standing_desk.name': 'Standing Desk',
  'item.standing_desk.phrase': 'Up, and harder to pin down.',
  'item.standing_desk.collection': 'Standing all day is worse. Standing all day is also much harder to aim at.',
  'item.blue_light_glasses.name': 'Blue Light Glasses',
  'item.blue_light_glasses.phrase': 'You can see further, and see it sooner.',
  'item.blue_light_glasses.collection': 'The screen stops fighting you. So does the far end of the room.',
  'item.wrist_rest.name': 'Wrist Rest',
  'item.wrist_rest.phrase': 'Steadier hands, harder to shove.',
  'item.wrist_rest.collection': 'A soft bar of gel that quietly removes the tremor from everything you do.',
  'item.dual_monitors.name': 'Dual Monitors',
  'item.dual_monitors.phrase': 'Everything happens twice now.',
  'item.dual_monitors.collection': 'Two of everything, each a little weaker than the one you had. Worth it.',
  'item.pen_laser_pointer.name': 'Pen Laser Pointer',
  'item.pen_laser_pointer.phrase': 'What you throw goes looking.',
  'item.pen_laser_pointer.collection': 'The pen model, not the presentation one. It does not shoot; it decides where things land.',
  'item.numeric_keypad.name': 'Numeric Keypad',
  'item.numeric_keypad.phrase': 'You can aim into the corners.',
  'item.numeric_keypad.collection': 'The keys nobody uses turn out to be the diagonals.',
  'item.usb_hub.name': 'USB Hub',
  'item.usb_hub.phrase': 'One becomes several on the way there.',
  'item.usb_hub.collection': 'More ports than the machine has any business having. Everything divides.',
  'item.wireless_dongle.name': 'Wireless Dongle',
  'item.wireless_dongle.phrase': 'Furniture stops mattering quite so much.',
  'item.wireless_dongle.collection': 'Passes through the first thing in the way. Walls are still walls.',
  'item.macro_pad.name': 'Macro Pad',
  'item.macro_pad.phrase': 'Every so often it does it again by itself.',
  'item.macro_pad.collection': 'You recorded the macro once and forgot about it. It has not forgotten.',
  'item.sticky_keys.name': 'Sticky Keys',
  'item.sticky_keys.phrase': 'It sticks, waits, then goes off.',
  'item.sticky_keys.collection': 'Something sweet got into the switches. Now everything you throw attaches and waits.',
  'item.autocorrect.name': 'Autocorrect',
  'item.autocorrect.phrase': 'A miss gets quietly fixed.',
  'item.autocorrect.collection': 'It nudges a near miss back on target. Sometimes it is even right.',
  'item.caps_lock.name': 'Caps Lock',
  'item.caps_lock.phrase': 'Now and then you shout.',
  'item.caps_lock.collection': 'A counter you cannot see fills, and then one attack arrives in a completely different register.',
  'item.shift_key.name': 'Shift Key',
  'item.shift_key.phrase': 'Every other one is emphasised.',
  'item.shift_key.collection': 'Alternating. Held, released, held. The emphasised ones glow a different colour.',
  'item.space_bar.name': 'Space Bar',
  'item.space_bar.phrase': 'Things go backwards when you hit them.',
  'item.space_bar.collection': 'The widest key in the building, used for exactly what it sounds like: making space.',
  'item.backspace.name': 'Backspace',
  'item.backspace.phrase': 'It comes back through them.',
  'item.backspace.collection': 'What you sent returns along its own path, and the return trip still counts.',
  'item.ctrl_c.name': 'Ctrl+C',
  'item.ctrl_c.phrase': 'Sometimes there are two.',
  'item.ctrl_c.collection': 'A copy, occasionally, unpredictably. It cannot copy the copy. It has tried.',
  'item.rubber_bands.name': 'Rubber Bands',
  'item.rubber_bands.phrase': 'It comes off the walls.',
  'item.rubber_bands.collection': 'From the drawer everyone raids. Corners become part of the plan.',
  'item.binder_clip.name': 'Binder Clip',
  'item.binder_clip.phrase': 'It goes through the first one and keeps going.',
  'item.binder_clip.collection': 'Slower, heavier, and it does not stop at the first thing it meets.',
  'item.ethernet_cable.name': 'Ethernet Cable',
  'item.ethernet_cable.phrase': 'It jumps to whatever is standing nearby.',
  'item.ethernet_cable.collection': 'A patch cable with more current in it than the specification allows. Contact spreads.',
  'item.extension_cord.name': 'Extension Cord',
  'item.extension_cord.phrase': 'Longer reach, whatever you are holding.',
  'item.extension_cord.collection': 'Reach is reach, whether that means a beam, a cord, an arc, or a throw.',
  'item.rechargeable_battery.name': 'Rechargeable Battery',
  'item.rechargeable_battery.phrase': 'You can hold another use.',
  'item.rechargeable_battery.collection': 'Room for one more charge on whatever you are carrying in the other hand.',
  'item.red_staple_remover.name': 'Red Staple Remover',
  'item.red_staple_remover.phrase': 'Armour matters less.',
  'item.red_staple_remover.collection': 'The little jaws are for getting under things that were fastened shut.',
  'item.lucky_paperclip.name': 'Lucky Paperclip',
  'item.lucky_paperclip.phrase': 'Something orbits you and takes a hit.',
  'item.lucky_paperclip.collection': 'Bent out of shape years ago and kept anyway. It stops one thing, then reshapes itself over the following rooms.',
  'item.whiteboard_eraser.name': 'Whiteboard Eraser',
  'item.whiteboard_eraser.phrase': 'A close call sometimes just stops existing.',
  'item.whiteboard_eraser.collection': 'Whatever passes near you may simply be wiped off the board. It will not erase anything a boss needs.',
  'item.correction_fluid.name': 'Correction Fluid',
  'item.correction_fluid.phrase': 'What you hit slows down.',
  'item.correction_fluid.collection': 'White, thick, and slow to dry. So is anything wearing it.',
  'item.highlighter.name': 'Highlighter',
  'item.highlighter.phrase': 'The first hit marks them for the rest.',
  'item.highlighter.collection': 'Marked things take more from everything, including from the people you brought with you.',
  'item.paperweight.name': 'Paperweight',
  'item.paperweight.phrase': 'Slower, heavier, and it moves them.',
  'item.paperweight.collection': 'Glass, dense, and entirely decorative until it is not.',
  'item.printer_ink.name': 'Printer Ink',
  'item.printer_ink.phrase': 'Bigger and bolder, slightly shorter.',
  'item.printer_ink.collection': 'A full cartridge. Everything comes out heavier and does not travel quite as far.',
  'item.toner_dust.name': 'Toner Dust',
  'item.toner_dust.phrase': 'It leaves a mess where it lands.',
  'item.toner_dust.collection': 'Fine black powder that hangs in the air after the attack is gone. It gets everywhere. It always does.',
  'item.noise_canceling_headphones.name': 'Noise-Canceling Headphones',
  'item.noise_canceling_headphones.phrase': 'Blasts hurt less and cannot rattle your aim.',
  'item.noise_canceling_headphones.collection': 'The room gets quieter without getting less clear. You still hear the warnings.',
  'item.mini_fridge.name': 'Mini Fridge',
  'item.mini_fridge.phrase': 'More food turns up, and none of it goes to waste.',
  'item.mini_fridge.collection': 'Under the desk, against policy. Anything you could not eat at the time keeps until the next floor.',
  'item.lunchbox.name': 'Lunchbox',
  'item.lunchbox.phrase': 'Something is waiting on every new floor.',
  'item.lunchbox.collection': 'Packed the night before. Whatever is in it is small, and it is always there.',
  'item.company_hoodie.name': 'Company Hoodie',
  'item.company_hoodie.phrase': 'A little more to lose before it counts.',
  'item.company_hoodie.collection': 'Given out at an all-hands. The logo is enormous. It is also, unexpectedly, padding.',
  'item.visitor_badge.name': 'Visitor Badge',
  'item.visitor_badge.phrase': 'One door a floor stops asking.',
  'item.visitor_badge.collection': 'Signed in as a guest. It works on the ordinary doors, once per floor, and on nothing that matters more than that.',
  'item.master_access_badge.name': 'Master Access Badge',
  'item.master_access_badge.phrase': 'Ordinary doors stop asking entirely.',
  'item.master_access_badge.collection': 'Facilities carries one of these. You are not Facilities. The standard doors cannot tell the difference; the sealed ones can.',
  'item.office_plant.name': 'Office Plant',
  'item.office_plant.phrase': 'Clearing a room sometimes helps.',
  'item.office_plant.collection': 'The one nobody waters and nobody throws out. It gives a little back after a fight.',
  'item.desk_cactus.name': 'Desk Cactus',
  'item.desk_cactus.phrase': 'Touching you costs them.',
  'item.desk_cactus.collection': 'Chosen because it could not be killed by neglect. Anything that closes in finds out why.',
  'item.stress_ball.name': 'Stress Ball',
  'item.stress_ball.phrase': 'The first hit on each floor lands softer.',
  'item.stress_ball.collection': 'From a conference. It absorbs the first thing that reaches you, then needs a floor to recover.',
  'item.company_laptop.name': 'Company Laptop',
  'item.company_laptop.phrase': 'Something follows you and helps.',
  'item.company_laptop.collection': 'Work came home with you and never went back. It types on its own, and it copies your habits.',
  'item.webcam.name': 'Webcam',
  'item.webcam.phrase': 'You know what is next door.',
  'item.webcam.collection': 'Always on. It tells you what kind of room is through each door. It has never once found a hidden one.',
  'item.confidential_stamp.name': 'Confidential Stamp',
  'item.confidential_stamp.phrase': 'Hits hardest on something untouched.',
  'item.confidential_stamp.collection': 'The first mark on a clean page is the one that lands. Restricted shelves seem friendlier while you carry it.',
  'item.calendar_reminder.name': 'Calendar Reminder',
  'item.calendar_reminder.phrase': 'You know where the meeting is.',
  'item.calendar_reminder.collection': 'The invite you did not accept. It shows you which room the manager is in, and nothing about how to get there.',
  'item.reply_all.name': 'Reply All',
  'item.reply_all.phrase': 'Everything is duplicated. Everything.',
  'item.reply_all.collection': 'Your attacks are copied at a discount. So are theirs, at full price. The room becomes a thread nobody can leave.',
  'item.open_calendar.name': 'Open Calendar',
  'item.open_calendar.phrase': 'Everyone gets to you sooner. There is more in it for you.',
  'item.open_calendar.collection': 'No blocked time, no buffer, no excuse. They act faster, and clearing a room pays out more often.',
  'item.wet_keyboard.name': 'Wet Keyboard',
  'item.wet_keyboard.phrase': 'Slower. Everything is slower. But the current carries.',
  'item.wet_keyboard.collection': 'Someone put a mug down on it. It will never be the same, and neither will your timing. Anything electrical hurts more.',
  'item.cheap_chair.name': 'Cheap Chair',
  'item.cheap_chair.phrase': 'Slower, sturdier, and impossible to move.',
  'item.cheap_chair.collection': 'The chair left over after everyone else chose. It wobbles, it is slow, and nothing on this floor can shift you out of it.',
  'item.burnout.name': 'Burnout',
  'item.burnout.phrase': 'Less left, and much more behind it.',
  'item.burnout.collection': 'You have less to give and you give it harder. The lower it gets, the worse you are to be near. It will not take your last icon.',
  'item.mandatory_training.name': 'Mandatory Training',
  'item.mandatory_training.phrase': 'Sit through it first. Then the floor is yours.',
  'item.mandatory_training.collection': 'No tools until the training is done. The charge still accumulates while you wait, and afterwards the whole floor goes better.',
  'item.three_hole_punch.name': 'Three-Hole Punch',
  'item.three_hole_punch.phrase': 'A wider spread, weaker each.',
  'item.three_hole_punch.collection': 'It replaces the paired pattern rather than multiplying it. There is a limit to how many holes a page can take.',
  'item.sticky_notes.name': 'Sticky Notes',
  'item.sticky_notes.phrase': 'They orbit, then go one at a time.',
  'item.sticky_notes.collection': 'A fan of squares that circles you and launches, then reassembles itself once the room is quiet.',
  'item.red_pen.name': 'Red Pen',
  'item.red_pen.phrase': 'Occasionally a correction really lands.',
  'item.red_pen.collection': 'The pen kept for marking other people-s work. Marked targets attract it.',
  'item.spare_keyboard.name': 'Spare Keyboard',
  'item.spare_keyboard.phrase': 'There is one more in the drawer.',
  'item.spare_keyboard.collection': 'Still in the wrap. When it is over, it is not: you come back holding the keyboard again, and the spare is gone.',
  'item.corporate_card.name': 'Corporate Card',
  'item.corporate_card.phrase': 'You can buy what you cannot afford.',
  'item.corporate_card.collection': 'Expenses. The balance shows in the corner, and the next credits you find go to it first. Nobody will ever ask about it.',
  'item.suggestion_box.name': 'Suggestion Box',
  'item.suggestion_box.phrase': 'Something you walked away from changes its mind.',
  'item.suggestion_box.collection': 'Come back to a pedestal you left and it will be offering something else. Once per floor. Never the same thing twice.',

  // -------------------------------------------------------------------------
  // Active items (Appendix C).
  //
  // Two strings each. `.name` is the plain object or the key combination, because
  // that is what the thing is. `.phrase` is the line shown on pickup, and it is
  // scanned by the validator for digits and percent signs (GDD 17.3, R-ITM-005),
  // so it never says how long, how much, or how often. These read as the short
  // imperative someone would actually say while doing it.
  // -------------------------------------------------------------------------
  'active.task_manager.name': 'Task Manager',
  'active.task_manager.phrase': 'End the process.',
  'active.print_screen.name': 'Print Screen',
  'active.print_screen.phrase': 'Freeze the frame.',
  'active.ctrl_z.name': 'Ctrl+Z',
  'active.ctrl_z.phrase': 'Undo the mistake.',
  'active.out_of_office.name': 'Out of Office',
  'active.out_of_office.phrase': 'Not available.',
  'active.emergency_coffee_pot.name': 'Emergency Coffee Pot',
  'active.emergency_coffee_pot.phrase': 'Fresh batch.',
  'active.meeting_invite.name': 'Meeting Invite',
  'active.meeting_invite.phrase': 'Everyone to the center.',
  'active.power_cycle.name': 'Power Cycle',
  'active.power_cycle.phrase': 'Turn it off and on.',
  'active.shredder_bin.name': 'Shredder Bin',
  'active.shredder_bin.phrase': 'Nothing goes to waste.',
  'active.fire_extinguisher.name': 'Fire Extinguisher',
  'active.fire_extinguisher.phrase': 'Clear a path.',
  'active.red_phone.name': 'Red Phone',
  'active.red_phone.phrase': 'Escalate immediately.',
  'active.expense_report.name': 'Expense Report',
  'active.expense_report.phrase': 'Convert the budget.',
  'active.copier_jam.name': 'Copier Jam',
  'active.copier_jam.phrase': 'Make a barrier.',
  'active.floor_plan.name': 'Floor Plan',
  'active.floor_plan.phrase': 'Know the layout.',
  'active.performance_improvement_plan.name': 'Performance Improvement Plan',
  'active.performance_improvement_plan.phrase': 'Under review.',
  'active.desk_bell.name': 'Desk Bell',
  'active.desk_bell.phrase': 'Next.',

  // -------------------------------------------------------------------------
  // Action Cards (Appendix C).
  //
  // Cards are fully identified the moment they are found (R-CON-002), so unlike a
  // pickup phrase the description may say plainly what the card does. It still
  // never states a magnitude or a duration — a card is a favour someone did for
  // you, not a line in a spreadsheet.
  // -------------------------------------------------------------------------
  'card.meeting_canceled.name': 'Meeting Canceled',
  'card.meeting_canceled.description': 'Returns you to the room the elevator left you in. Everything you were in the middle of stays exactly where it was.',
  'card.company_wide_email.name': 'Company-Wide Email',
  'card.company_wide_email.description': 'Sent to the whole room at once. Everything hostile in here takes it badly.',
  'card.sick_day.name': 'Sick Day',
  'card.sick_day.description': 'Refills every empty Composure in the containers you are carrying, then gives you a short stretch of grace. Nobody asks for a note.',
  'card.approved_overtime.name': 'Approved Overtime',
  'card.approved_overtime.description': 'You hit harder and faster until the room is finished. It was approved, which is the surprising part.',
  'card.expense_approved.name': 'Expense Approved',
  'card.expense_approved.description': 'Credits arrive all at once, with no explanation of which line they came out of.',
  'card.budget_freeze.name': 'Budget Freeze',
  'card.budget_freeze.description': 'Enemies slow down for the rest of the room, and so does everything they throw. The freeze lands on them, for once.',
  'card.reorganization.name': 'Reorganization',
  'card.reorganization.description': 'Rerolls whatever this room is still offering, drawn from the same places as before. The names change and the structure does not.',
  'card.calendar_block.name': 'Calendar Block',
  'card.calendar_block.description': 'Nothing can touch you for a short while. It does not open a door, so the block is worth exactly as much as the room you are standing in.',
  'card.access_granted.name': 'Access Granted',
  'card.access_granted.description': 'Opens the standard locks on the doors touching this room. Anything sealed for a better reason stays sealed.',
  'card.all_hands.name': 'All Hands',
  'card.all_hands.description': 'For a moment the ordinary staff decide the problem is each other. Management only slows down and watches.',
  'card.performance_review.name': 'Performance Review',
  'card.performance_review.description': 'Marks the manager room and every optional fight on this floor. Knowing where the review is does not make it shorter.',
  'card.remote_day.name': 'Remote Day',
  'card.remote_day.description': 'You spend the room above the floor, clear of spills, cables and furniture. It ends when the room does.',
  'card.hard_deadline.name': 'Hard Deadline',
  'card.hard_deadline.description': 'Lights up the shortest way to the manager and keeps you quick until you arrive. It has no opinion about what is on the route.',
  'card.return_to_sender.name': 'Return to Sender',
  'card.return_to_sender.description': 'For a few seconds everything fired at you turns around and goes home. Good aim becomes a problem for whoever had it.',
  'card.escalation.name': 'Escalation',
  'card.escalation.description': 'Calls in a fight nobody asked for, and pays properly if you win it. It will not work in a room that is already an escalation.',
  'card.meeting_minutes.name': 'Meeting Minutes',
  'card.meeting_minutes.description': 'Repeats whichever card you played last. It cannot repeat itself, which is the one thing minutes are usually for.',
  'card.desk_move.name': 'Desk Move',
  'card.desk_move.description': 'Relocates you to an ordinary room you have already cleared. You do not get to say which one.',
  'card.quarter_end.name': 'Quarter-End',
  'card.quarter_end.description': 'The room becomes a timed run of waves with something good waiting at the end. There is no version of this where you get an extension.',

  // -------------------------------------------------------------------------
  // Supplements (Appendix C).
  //
  // Unidentified until taken, so `.identified` is the line that appears the instant
  // the body works out what it was. Short and sensory on purpose: this is a
  // sensation, not a readout, and the validator scans these keys too.
  // -------------------------------------------------------------------------
  'supplement.focus_up.name': 'Focus Up',
  'supplement.focus_up.identified': 'Typing faster',
  'supplement.focus_down.name': 'Focus Down',
  'supplement.focus_down.identified': 'Slower hands',
  'supplement.energy_up.name': 'Energy Up',
  'supplement.energy_up.identified': 'More energy',
  'supplement.energy_crash.name': 'Energy Crash',
  'supplement.energy_crash.identified': 'Sudden crash',
  'supplement.heavy_dose.name': 'Heavy Dose',
  'supplement.heavy_dose.identified': 'Hits harder',
  'supplement.numb_hands.name': 'Numb Hands',
  'supplement.numb_hands.identified': 'Weak grip',
  'supplement.clear_eyes.name': 'Clear Eyes',
  'supplement.clear_eyes.identified': 'Can see farther',
  'supplement.dry_eyes.name': 'Dry Eyes',
  'supplement.dry_eyes.identified': 'Everything feels closer',
  'supplement.full_recovery.name': 'Full Recovery',
  'supplement.full_recovery.identified': 'Feeling normal',
  'supplement.bad_reaction.name': 'Bad Reaction',
  'supplement.bad_reaction.identified': 'Bad reaction',
  'supplement.telework.name': 'Telework',
  'supplement.telework.identified': 'Working elsewhere',
  'supplement.adrenaline.name': 'Adrenaline',
  'supplement.adrenaline.identified': 'Too much energy',
  'supplement.placebo.name': 'Placebo',
  'supplement.placebo.identified': 'Seems familiar',
  'supplement.mystery_snack.name': 'Mystery Snack',
  'supplement.mystery_snack.identified': 'Questionable choice',

  // -------------------------------------------------------------------------
  // Desk Charms (Appendix C).
  //
  // Charms are deliberately small and unreliable (GDD 9.8), and the copy says so
  // rather than overselling them. One sentence each, and every sentence that
  // describes a chance admits it is a chance.
  // -------------------------------------------------------------------------
  'charm.coffee_sleeve.name': 'Coffee Sleeve',
  'charm.coffee_sleeve.description': 'Sometimes a caffeine pickup goes a little further, and sometimes the sleeve is just cardboard.',
  'charm.bent_keycard.name': 'Bent Keycard',
  'charm.bent_keycard.description': 'Now and then the reader forgets to keep an Access Card it has already accepted.',
  'charm.usb_cap.name': 'USB Cap',
  'charm.usb_cap.description': 'A battery picked up at full charge gets put away instead of thrown out.',
  'charm.red_pushpin.name': 'Red Pushpin',
  'charm.red_pushpin.description': 'Anything you have marked takes a little more. Small, and it adds up over a long fight.',
  'charm.tiny_plant.name': 'Tiny Plant',
  'charm.tiny_plant.description': 'The first bit of recovery you find on a floor goes a little further than it should.',
  'charm.meeting_token.name': 'Meeting Token',
  'charm.meeting_token.description': 'Optional fights turn up more often and pay better, if you consider that an upside.',
  'charm.rubber_foot.name': 'Rubber Foot',
  'charm.rubber_foot.description': 'Spills and conveyor belts have less say in where you end up.',
  'charm.cracked_screen_protector.name': 'Cracked Screen Protector',
  'charm.cracked_screen_protector.description': 'Takes the edge off one shot in a manager room, then does nothing at all until the next floor.',
  'charm.frayed_cable.name': 'Frayed Cable',
  'charm.frayed_cable.description': 'Electrical chains reach further and land weaker, which is exactly what a frayed cable does everywhere else.',
  'charm.spare_button.name': 'Spare Button',
  'charm.spare_button.description': 'Very occasionally an extra shot leaves your hand for no reason you could explain.',
  'charm.mini_calendar.name': 'Mini Calendar',
  'charm.mini_calendar.description': 'Challenge doors appear on the map, but only after you have found the supply closet.',
  'charm.nameplate.name': 'Nameplate',
  'charm.nameplate.description': 'A price is sometimes lower the first time you look at it, and never lower the second.',
  'charm.transit_pass.name': 'Transit Pass',
  'charm.transit_pass.description': 'You come off the elevator already moving, which saves less time than it feels like.',
  'charm.employee_of_the_month_pin.name': 'Employee of the Month Pin',
  'charm.employee_of_the_month_pin.description': 'Beating a manager without being touched pays a little extra, and nobody puts your photo up.',
  'charm.paper_star.name': 'Paper Star',
  'charm.paper_star.description': 'The better clear rewards are slightly less rare, in a way you would need a long afternoon to prove.',
  'charm.old_password.name': 'Old Password',
  'charm.old_password.description': 'A blast near a secret wall does not have to be well placed, and nothing here tells you where the walls are.',
  'charm.snack_wrapper.name': 'Snack Wrapper',
  'charm.snack_wrapper.description': 'Vending machines put up with slightly more from you before they give up.',
  'charm.lucky_lanyard.name': 'Lucky Lanyard',
  'charm.lucky_lanyard.description': 'A floor that keeps refusing to hand over an Access Card eventually runs out of ways to refuse.',

  // -------------------------------------------------------------------------
  // Transformations (Appendix C).
  //
  // These fire once, rarely, after a set has quietly assembled itself, so the copy
  // is allowed to sound like an occasion. Two sentences: what happened, then what
  // you are now carrying or trailing behind you.
  // -------------------------------------------------------------------------
  'transformation.latte.name': 'Latte',
  'transformation.latte.description': 'The espresso and the milk finally meet in the same cup. Both effects stay, your hands settle, you move a little quicker, and there is foam on top.',
  'transformation.power_user.name': 'Power User',
  'transformation.power_user.description': 'Enough of the hardware has been replaced that the machine stops arguing with you. Everything you have modified works a little harder, and loose key glyphs drift around you where people can see them.',
  'transformation.paper_trail.name': 'Paper Trail',
  'transformation.paper_trail.description': 'You have accumulated a paper trail, and a paper trail does not tidy itself away. Attacks that break apart leave scraps behind, and the scraps hurt whatever walks through them.',
  'transformation.middle_management.name': 'Middle Management',
  'transformation.middle_management.description': 'Somewhere in all the paperwork you acquired a direct report. A small assistant trails after you, picks up what you drop, and becomes briefly and visibly thrilled every time a manager goes down.',


  // -------------------------------------------------------------------------
  // Bosses (Appendix E). Names are the job titles from the roster, verbatim.
  //
  // The comedy is that these are real corporate roles rather than invented monsters,
  // so renaming them would throw away the whole joke — the same rule the weapon and
  // enemy sections follow. No name hints at a phase count or a mechanic (D-016).
  // -------------------------------------------------------------------------
  'boss.team_lead.name': 'The Team Lead',
  'boss.copy_chief.name': 'Copy Chief',
  'boss.scrum_master.name': 'Scrum Master',
  'boss.the_open_plan.name': 'The Open Plan',
  'boss.sysadmin.name': 'Sysadmin',
  'boss.helpdesk_hydra.name': 'Helpdesk Hydra',
  'boss.legacy_system.name': 'Legacy System',
  'boss.firewall.name': 'Firewall',
  'boss.the_bottleneck.name': 'The Bottleneck',
  'boss.shift_manager.name': 'Shift Manager',
  'boss.supply_chain.name': 'Supply Chain',
  'boss.quarter_end.name': 'Quarter End',
  'boss.vp_of_everything.name': 'VP of Everything',
  'boss.chief_operating_officer.name': 'Chief Operating Officer',
  'boss.the_boardroom.name': 'The Boardroom',
  'boss.ceo.name': 'CEO',
  'boss.the_auditor.name': 'The Auditor',
  'boss.budget_committee.name': 'Budget Committee',
  'boss.brand_manager.name': 'Brand Manager',
  'boss.viral_campaign.name': 'Viral Campaign',
  'boss.general_counsel.name': 'General Counsel',
  'boss.red_tape.name': 'Red Tape',
  'boss.head_of_facilities.name': 'Head of Facilities',
  'boss.prototype_zero.name': 'Prototype Zero',
  'boss.the_board.name': 'The Board',
  'boss.hostile_takeover.name': 'Hostile Takeover',
  'boss.parent_company.name': 'Parent Company',
  'boss.the_conglomerate.name': 'The Conglomerate',
  'boss.the_beneficial_owner.name': 'The Beneficial Owner',
  // -------------------------------------------------------------------------
  // Enemies (Appendix D). Names are job titles, because that is the joke.
  // -------------------------------------------------------------------------
  'enemy.office_drone.name': 'Office Drone',
  'enemy.desk_shooter.name': 'Desk Shooter',
  'enemy.paper_pusher.name': 'Paper Pusher',
  'enemy.coffee_sprinter.name': 'Coffee Sprinter',
  'enemy.nervous_intern.name': 'Nervous Intern',
  'enemy.rolling_chair_rider.name': 'Rolling Chair Rider',
  'enemy.team_player.name': 'Team Player',
  'enemy.hr_representative.name': 'HR Representative',
  'enemy.meeting_cluster.name': 'Meeting Cluster',
  'enemy.burned_out_drone.name': 'Burned-Out Drone',
  'enemy.cubicle_camper.name': 'Cubicle Camper',
  'enemy.reply_guy.name': 'Reply Guy',
  'enemy.cable_snake.name': 'Cable Snake',
  'enemy.printer_beast.name': 'Printer Beast',
  'enemy.ticket_bot.name': 'Ticket Bot',
  'enemy.firewall_node.name': 'Firewall Node',
  'enemy.malware_popup.name': 'Malware Pop-up',
  'enemy.server_rack_turret.name': 'Server Rack Turret',
  'enemy.helpdesk_agent.name': 'Helpdesk Agent',
  'enemy.cursor.name': 'Cursor',
  'enemy.blue_screen.name': 'Blue Screen',
  'enemy.remote_worker.name': 'Remote Worker',
  'enemy.patch_tuesday.name': 'Patch Tuesday',
  'enemy.spam_filter.name': 'Spam Filter',

  // Variant names. Shown in the collection after discovery, so each one still reads
  // as a promotion, a job change, or something having gone wrong with the hardware.
  'enemy.office_drone_veteran.name': 'Senior Office Drone',
  'enemy.office_drone_caffeinated.name': 'Overcaffeinated Drone',
  'enemy.office_drone_executive.name': 'Executive Drone',
  'enemy.desk_shooter_diagonal.name': 'Corner Desk Shooter',
  'enemy.desk_shooter_rotary.name': 'Rotating Desk Shooter',
  'enemy.paper_pusher_jammed.name': 'Jammed Paper Pusher',
  'enemy.paper_pusher_bulk.name': 'Bulk Paper Pusher',
  'enemy.coffee_sprinter_double.name': 'Double-Shot Sprinter',
  'enemy.coffee_sprinter_spill.name': 'Spilling Sprinter',
  'enemy.nervous_intern_runner.name': 'Fleeing Intern',
  'enemy.nervous_intern_panicked.name': 'Panicked Intern',
  'enemy.chair_rider_bouncer.name': 'Ricocheting Chair Rider',
  'enemy.chair_rider_armored.name': 'Reinforced Chair Rider',
  'enemy.team_player_senior.name': 'Senior Team Player',
  'enemy.team_player_meeting.name': 'Meeting Facilitator',
  'enemy.hr_business_partner.name': 'HR Business Partner',
  'enemy.meeting_cluster_all_hands.name': 'All-Hands Cluster',
  'enemy.meeting_cluster_chaired.name': 'Chaired Cluster',
  'enemy.burned_out_deadline.name': 'Deadline Casualty',
  'enemy.burned_out_plated.name': 'Plated Burnout',
  'enemy.cubicle_camper_senior.name': 'Senior Cubicle Camper',
  'enemy.cubicle_camper_decoy.name': 'Decoy Camper',
  'enemy.reply_guy_all.name': 'Reply All',
  'enemy.cable_snake_branching.name': 'Branching Cable Snake',
  'enemy.cable_snake_corrupted.name': 'Corrupted Cable Snake',
  'enemy.printer_beast_laser.name': 'Laser Printer Beast',
  'enemy.printer_beast_color.name': 'Colour Printer Beast',
  'enemy.ticket_bot_escalated.name': 'Escalated Ticket Bot',
  'enemy.ticket_bot_overdue.name': 'Overdue Ticket Bot',
  'enemy.firewall_node_mobile.name': 'Mobile Firewall Node',
  'enemy.firewall_node_arc.name': 'Rotating Firewall Node',
  'enemy.malware_popup_damaging.name': 'Aggressive Pop-up',
  'enemy.malware_popup_adware.name': 'Adware Swarm',
  'enemy.server_rack_octo.name': 'Eight-Lane Rack Turret',
  'enemy.server_rack_powered.name': 'Powered Rack Turret',
  'enemy.helpdesk_agent_senior.name': 'Senior Helpdesk Agent',
  'enemy.cursor_double_click.name': 'Double-Click Cursor',
  'enemy.blue_screen_corrupted.name': 'Corrupted Blue Screen',
  'enemy.remote_worker_two_shot.name': 'Persistent Remote Worker',
  'enemy.remote_worker_laptop.name': 'Remote Worker with Laptop',
  'enemy.patch_tuesday_emergency.name': 'Emergency Patch',
  'enemy.spam_filter_reflector.name': 'Reflecting Spam Filter',

  // -------------------------------------------------------------------------
  // Misc world text
  // -------------------------------------------------------------------------
  'enemy.courier.name': 'Courier',
  'enemy.forklift_clerk.name': 'Forklift Clerk',
  'enemy.conveyor_gremlin.name': 'Conveyor Gremlin',
  'enemy.inventory_swarm.name': 'Inventory Swarm',
  'enemy.bottleneck.name': 'Bottleneck',
  'enemy.shift_lead.name': 'Shift Lead',
  'enemy.pallet_mimic.name': 'Pallet Mimic',
  'enemy.safety_officer.name': 'Safety Officer',
  'enemy.temp_worker.name': 'Temp Worker',
  'enemy.overtime_zombie.name': 'Overtime Zombie',
  'enemy.cart_train.name': 'Cart Train',
  'enemy.labeler.name': 'Labeler',
  'enemy.executive_assistant.name': 'Executive Assistant',
  'enemy.compliance_officer.name': 'Compliance Officer',
  'enemy.consultant.name': 'Consultant',
  'enemy.middle_manager.name': 'Middle Manager',
  'enemy.security_guard.name': 'Security Guard',
  'enemy.legal_eagle.name': 'Legal Eagle',
  'enemy.board_member.name': 'Board Member',
  'enemy.expense_ghost.name': 'Expense Ghost',
  'enemy.golden_drone.name': 'Golden Drone',
  'enemy.hr_business_partner.name': 'HR Business Partner',
  'enemy.auditor.name': 'Auditor',
  'enemy.collector.name': 'Collector',
  'enemy.brand_double.name': 'Brand Double',
  'enemy.focus_tester.name': 'Focus Tester',
  'enemy.red_tape_roll.name': 'Red Tape Roll',
  'enemy.clause.name': 'Clause',
  'enemy.janitor.name': 'Janitor',
  'enemy.the_leak.name': 'The Leak',
  'enemy.prototype.name': 'Prototype',
  'enemy.archive_shade.name': 'Archive Shade',
  'enemy.shareholder_eye.name': 'Shareholder Eye',
  'enemy.merger_abomination.name': 'Merger Abomination',

  'caption.telegraph_heavy': '[heavy wind-up]',
  'caption.telegraph_light': '[quick wind-up]',
  'caption.telegraph_support': '[support acting]',

  'clue.whiteboard.generic': 'Someone has drawn a load-bearing wall in the wrong place.',
};

export default [{ id: 'loc-en', language: 'en', strings }];
