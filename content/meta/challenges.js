/**
 * Challenges CHL-001..006. GDD 16.8.
 *
 * GDD refs: 16.8 ("predefined runs with a starting profile, weapon, items, route, and
 *           rules... They teach unusual mechanics and unlock specific content. Challenges
 *           may remove item rooms, force a liability, limit firing directions, or require a
 *           route. They may not rely on hidden arbitrary failure conditions."),
 *           16.1 (progression adds content, never raw power), 21.3 (a challenge seed usually
 *           enables only its designated completion unlock), R-PRG-002 (a challenge never
 *           alters an ordinary run).
 *
 * ## The one rule that shapes every entry
 *
 * "They may not rely on hidden arbitrary failure conditions." So every constraint here is
 * either visible before the player moves — a forced weapon, a missing item room, a locked
 * firing axis — or stated in the challenge description. `failureConditions` never names
 * anything the player could not have known. The schema even warns on a condition that does
 * not mention death, a timer, damage, a route, or a resource, which is its way of catching
 * exactly this class of mistake.
 *
 * Each of the six also exists to *teach* something the ordinary game only implies:
 *
 *   CHL-001  the Keyboard is genuinely sufficient; items are optional, not required
 *   CHL-002  a liability is a real trade rather than a punishment
 *   CHL-003  two firing directions is a positioning game, not a handicap
 *   CHL-004  the Facilities hazards are tools, not just damage
 *   CHL-005  credits are for spending; hoarding is its own loss condition
 *   CHL-006  the ownership chain on one weapon, as a mastery test
 *
 * `unlocksEnabled: false` on all six: GDD 21.3 gives a challenge its designated completion
 * unlock only, which `completionUnlock` expresses. Leaving general unlocks on would make
 * challenges the fastest route to everything in the game.
 */

const challenge = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `challenge.${slug}.name`,
  descriptionLoc: `challenge.${slug}.description`,
  profile: spec.profile,
  route: spec.route ?? 'ROUTE-BASE',
  ...(spec.unlockId ? { unlockId: spec.unlockId } : {}),
  ...(spec.completionUnlock ? { completionUnlock: spec.completionUnlock } : {}),
  rules: {
    ...(spec.forcedWeapon ? { forcedWeapon: spec.forcedWeapon } : {}),
    forcedPassives: spec.forcedPassives ?? [],
    bannedRoles: spec.bannedRoles ?? [],
    firingDirections: spec.firingDirections ?? 'CARDINAL',
    ...(spec.startingResources ? { startingResources: spec.startingResources } : {}),
    failureConditions: spec.failureConditions,
  },
  unlocksEnabled: false,
});

const challenges = [
  // -- CHL-001 --------------------------------------------------------------
  // The baseline claim, tested. GDD 5.1 makes the Keyboard the yardstick every other weapon
  // is measured against; if the building cannot be climbed with it, that is a balance bug
  // rather than a hard challenge.
  challenge('CHL-001', 'standard_issue', {
    profile: 'PRF-001',
    forcedWeapon: 'WPN-001',
    // No supply closets and no shop: the run is exactly the baseline, all the way up.
    bannedRoles: ['ROOM-005', 'ROOM-006'],
    failureConditions: ['Player death ends the run.'],
    completionUnlock: 'UNLOCK-PROFILE_INTERN',
  }),

  // -- CHL-002 --------------------------------------------------------------
  // A liability is priced, not punitive (GDD 8.6, R-ITM-007). Burnout removes a container and
  // pays for it in damage, and the whole point is that this is a run you can still win.
  challenge('CHL-002', 'performance_review', {
    profile: 'PRF-005',
    forcedPassives: ['ITM-053'],
    failureConditions: ['Player death ends the run.'],
    completionUnlock: 'UNLOCK-PROFILE_CONTRACTOR',
  }),

  // -- CHL-003 --------------------------------------------------------------
  // Two axes instead of four. GDD 4.2 keeps aim independent of movement, so losing half the
  // firing directions is a positioning problem rather than a damage one — which is the
  // lesson, and why the compensating item is mobility rather than damage.
  challenge('CHL-003', 'locked_orientation', {
    profile: 'PRF-002',
    firingDirections: 'HORIZONTAL_ONLY',
    forcedPassives: ['ITM-006'],
    failureConditions: ['Player death ends the run.'],
    completionUnlock: 'UNLOCK-PROFILE_REMOTE_WORKER',
  }),

  // -- CHL-004 --------------------------------------------------------------
  // The Facilities branch. Every hazard there is something the player can turn around —
  // water conducts, and the department's own Leak refuses to approach electricity — so the
  // starting Toner Charges are a hint rather than a handout.
  challenge('CHL-004', 'below_code', {
    profile: 'PRF-008',
    route: 'ROUTE-FACILITIES_BRANCH',
    startingResources: { credits: 0, accessCards: 0, tonerCharges: 3 },
    failureConditions: [
      'Player death ends the run.',
      'Leaving the Facilities route ends the run.',
    ],
    completionUnlock: 'UNLOCK-PROFILE_FACILITIES_TECH',
  }),

  // -- CHL-005 --------------------------------------------------------------
  // Credits are for spending. The ceiling is a resource condition and R-ECO-001 keeps the
  // count on screen at all times, so the player can always see how close they are — a rule,
  // not a trap.
  challenge('CHL-005', 'expense_audit', {
    profile: 'PRF-001',
    startingResources: { credits: 40, accessCards: 0, tonerCharges: 0 },
    failureConditions: [
      'Player death ends the run.',
      'Holding more than sixty credits at a floor transition ends the run.',
    ],
    completionUnlock: 'UNLOCK-SHADOW_PROCUREMENT',
  }),

  // -- CHL-006 --------------------------------------------------------------
  // The mastery test, and the only one gated behind an unlock of its own: it requires the
  // ownership route, which the player must already have earned. One weapon, no shop, the
  // whole chain.
  challenge('CHL-006', 'beneficial_owner', {
    profile: 'PRF-005',
    route: 'ROUTE-OWNERSHIP',
    unlockId: 'UNLOCK-OWNERSHIP_ROUTE',
    forcedWeapon: 'WPN-001',
    bannedRoles: ['ROOM-006'],
    failureConditions: [
      'Player death ends the run.',
      'Leaving the ownership route ends the run.',
    ],
    completionUnlock: 'UNLOCK-BENEFICIAL_OWNERSHIP',
  }),
];

export default challenges;
