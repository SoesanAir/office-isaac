/**
 * Employee profiles.
 *
 * GDD refs: 16.6 (the profile table, all eight), 5.1 (starting profile is the
 *           balance reference), R-PRG-001 (meta progression adds content, not raw
 *           universal power), 16.1 (profiles reward mastery without adding control
 *           complexity — every profile uses the same core input set).
 *
 * PRF-001 Employee is the balance reference for the entire game: every number in
 * GDD 5.1 describes this profile, and no other profile may be strictly better than
 * it. Each alternative trades something real away — health for speed, damage for a
 * shield, economy for buffers.
 */

const profile = (id, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `profile.${spec.slug}.name`,
  identityLoc: `profile.${spec.slug}.identity`,
  spriteId: spec.spriteId ?? 'player_idle_south',
  ...(spec.unlockId ? { unlockId: spec.unlockId } : {}),
  starting: {
    weapon: spec.weapon ?? 'WPN-001',
    composureContainers: spec.composure,
    caffeineIcons: spec.caffeine ?? 0,
    spiteIcons: spec.spite ?? 0,
    passives: spec.passives ?? [],
    ...(spec.active ? { active: spec.active } : {}),
    ...(spec.charm ? { charm: spec.charm } : {}),
    ...(spec.card ? { card: spec.card } : {}),
    ...(spec.randomCharmTag ? { randomCharmTag: spec.randomCharmTag } : {}),
    ...(spec.statOverrides ? { statOverrides: spec.statOverrides } : {}),
    ...(spec.resources ? { resources: spec.resources } : {}),
    rules: spec.rules ?? [],
  },
  isDefault: spec.isDefault ?? false,
});

const profiles = [
  profile('PRF-001', {
    slug: 'employee',
    // GDD 5.1 verbatim: 6 half-units = 3 Composure icons, and no overrides at all.
    // Anything set here would silently redefine the game's balance baseline.
    composure: 3,
    isDefault: true,
  }),
  profile('PRF-002', {
    slug: 'intern',
    unlockId: 'UNLOCK-PROFILE_INTERN',
    // "Fast, fragile, access-focused": one fewer container, faster, free first door.
    composure: 2,
    passives: ['ITM-040'],
    statOverrides: { moveSpeed: 6.4 },
    rules: [],
  }),
  profile('PRF-003', {
    slug: 'it_specialist',
    unlockId: 'UNLOCK-PROFILE_IT_SPECIALIST',
    composure: 3,
    passives: ['ITM-027'],
    // GDD 16.6 says "one random technology-tag Desk Charm", so the charm is rolled
    // from a tag rather than fixed. That keeps the profile varied run to run.
    randomCharmTag: 'TECHNOLOGY',
    rules: [],
  }),
  profile('PRF-004', {
    slug: 'contractor',
    unlockId: 'UNLOCK-PROFILE_CONTRACTOR',
    // "Temporary protection, harsher resource economy": buffer health that cannot
    // be refilled as containers, and no free first Supply Closet.
    composure: 2,
    caffeine: 2,
    rules: ['NO_FREE_FIRST_SUPPLY', 'STARTS_WITH_DEBT'],
  }),
  profile('PRF-005', {
    slug: 'burned_out_veteran',
    unlockId: 'UNLOCK-PROFILE_BURNED_OUT',
    // Four containers before Burnout removes one, leaving three — the same as
    // baseline, but with damage that scales as health drops. High risk, high reward.
    composure: 4,
    passives: ['ITM-053'],
    rules: [],
  }),
  profile('PRF-006', {
    slug: 'executive_assistant',
    unlockId: 'UNLOCK-PROFILE_EXEC_ASSISTANT',
    // "Defensive positioning and boss knowledge": a regenerating shield paid for
    // with lower base damage.
    composure: 3,
    statOverrides: { damage: 8 },
    rules: ['REGENERATING_SHIELD'],
  }),
  profile('PRF-007', {
    slug: 'remote_worker',
    unlockId: 'UNLOCK-PROFILE_REMOTE_WORKER',
    // Starts on the bouncing weapon rather than the Keyboard, which changes how the
    // whole run plays from the first room.
    weapon: 'WPN-009',
    composure: 3,
    card: 'CARD-017',
    statOverrides: { contactResistMul: 1.25 },
    rules: [],
  }),
  profile('PRF-008', {
    slug: 'facilities_tech',
    unlockId: 'UNLOCK-PROFILE_FACILITIES_TECH',
    // "Close range and environmental control": the Mouse plus a Toner Charge to
    // open something on floor one.
    weapon: 'WPN-002',
    composure: 3,
    charm: 'CHR-007',
    resources: { tonerCharges: 1 },
    rules: [],
  }),
];

export default profiles;
