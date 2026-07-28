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
  // Misc world text
  // -------------------------------------------------------------------------
  'clue.whiteboard.generic': 'Someone has drawn a load-bearing wall in the wrong place.',
};

export default [{ id: 'loc-en', language: 'en', strings }];
