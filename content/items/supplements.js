/**
 * Supplements SUP-001..014. Appendix C.5.
 *
 * GDD refs: Appendix C.5 (internal result and identified message for all fourteen),
 *           9.7 (wrapper appearances are shuffled onto effects at run start; the
 *           player learns an identity only by consuming one), R-CON-003 (the mapping
 *           is randomized per run and consistent within it), R-CON-004 (once
 *           identified, every matching wrapper shows the known name).
 *
 * `spriteId` here is the *effect* icon, not the wrapper. That is deliberate and it is
 * the one thing to understand before editing this file: the wrapper the player sees on
 * the floor is assigned by the run at start time from a separate appearance pool, so
 * nothing in this data can leak which pill is which. The sprite named here is only ever
 * drawn after identification — in the collection and in the pocket HUD.
 *
 * `valence` is likewise internal. It exists so SUP-013 Placebo can find "the last
 * identified POSITIVE effect", and so the identification UI can colour a known wrapper.
 * It must never reach an unidentified ground label.
 *
 * The eight paired stat effects share one hook (PERMANENT_STAT_SHIFT) with a signed
 * magnitude, because Focus Up and Focus Down differ by exactly that sign.
 */

import { COLLECTIBLE_CLASS } from '../../src/core/constants.js';

const S = COLLECTIBLE_CLASS.SUPPLEMENT;

const supplement = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `supplement.${slug}.name`,
  identifiedPhraseLoc: `supplement.${slug}.identified`,
  class: S,
  spriteId: `sup_${slug}`,
  baseWeight: spec.w,
  valence: spec.valence,
  permanent: spec.permanent,
  effectHook: spec.hook,
  ...(spec.params ? { params: spec.params } : {}),
  originalityNote: spec.original,
});

/** The eight permanent stat pairs. `magnitude` carries the direction. */
const statShift = (id, slug, valence, stat, magnitude, original) => supplement(id, slug, {
  w: 1.0, valence, permanent: true, hook: 'PERMANENT_STAT_SHIFT',
  params: { stat, magnitude },
  original,
});

const supplements = [
  // C.5 says "slightly" in all eight rows. These are permanent, so they compound
  // across a run — a large magnitude here would dominate the item system.
  statShift('SUP-001', 'focus_up', 'POSITIVE', 'intervalMul', -0.05,
    'A focus supplement as a small permanent cadence gain, paired with an equal loss.'),
  statShift('SUP-002', 'focus_down', 'NEGATIVE', 'intervalMul', 0.05,
    'The downside twin of Focus Up: identical magnitude, opposite sign, same wrapper pool.'),
  statShift('SUP-003', 'energy_up', 'POSITIVE', 'moveSpeedAdd', 0.2,
    'An energy supplement as a small permanent speed gain.'),
  statShift('SUP-004', 'energy_crash', 'NEGATIVE', 'moveSpeedAdd', -0.2,
    'The crash: the same speed the up gave, taken away.'),
  statShift('SUP-005', 'heavy_dose', 'POSITIVE', 'damageMul', 0.06,
    'A heavy dose as a small permanent damage gain.'),
  statShift('SUP-006', 'numb_hands', 'NEGATIVE', 'damageMul', -0.06,
    'Numb hands: the damage twin, and the reason a heavy dose is a gamble.'),
  statShift('SUP-007', 'clear_eyes', 'POSITIVE', 'rangeMul', 0.1,
    'Clear eyes as permanent reach, which reads as range on a beam and reach on an arc.'),
  statShift('SUP-008', 'dry_eyes', 'NEGATIVE', 'rangeMul', -0.1,
    'Dry eyes: everything gets closer, permanently.'),

  supplement('SUP-009', 'full_recovery', {
    w: 0.9, valence: 'POSITIVE', permanent: false, hook: 'RESTORE_ALL_COMPOSURE',
    original: 'A recovery supplement that refills existing containers and never adds one.',
  }),
  supplement('SUP-010', 'bad_reaction', {
    w: 0.9, valence: 'NEGATIVE', permanent: false, hook: 'SELF_DAMAGE_NON_LETHAL',
    // A full icon, floored at one half-unit. C.5 states the floor explicitly, and it is
    // what makes the whole gamble acceptable: a Supplement can hurt but cannot end a run.
    params: { halfUnits: 2 },
    original: 'A bad reaction that costs a full icon but is guaranteed not to kill you.',
  }),
  supplement('SUP-011', 'telework', {
    w: 0.7, valence: 'MIXED', permanent: false, hook: 'TELEPORT_RANDOM_ROOM',
    params: { errorRoomChance: 0.02 },
    original: 'Telework as a random teleport with a rare door onto the 13th Floor error room.',
  }),
  supplement('SUP-012', 'adrenaline', {
    w: 0.7, valence: 'MIXED', permanent: false, hook: 'ADRENALINE_THEN_CRASH',
    params: { damageMul: 1.5, haste: 0.45, crashSeconds: 2.5 },
    original: 'Adrenaline as a room-long surge with a crash queued to the end of it, not to a timer.',
  }),
  supplement('SUP-013', 'placebo', {
    w: 0.6, valence: 'MIXED', permanent: false, hook: 'REPEAT_LAST_POSITIVE_SUPPLEMENT',
    original: 'A placebo that repeats your last good result, or genuinely does nothing.',
  }),
  supplement('SUP-014', 'mystery_snack', {
    w: 0.8, valence: 'MIXED', permanent: false, hook: 'RANDOM_PICKUP_AND_STATUS',
    params: { seconds: 3 },
    original: 'An unlabelled snack: a pickup and a short status, rolled independently of each other.',
  }),
];

export default supplements;
