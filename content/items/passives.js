/**
 * Passive items ITM-001..ITM-060.
 *
 * GDD refs: Appendix C.1 (the generation registry: quality, weight, min floor, pools —
 *           used verbatim), Appendix C.2 (the behaviour registry: every magnitude here
 *           is the number the GDD states), 8.5 (the three synergy layers), 8.6
 *           (liability items), 8.7 (catalogue categories), 17.3 (item language),
 *           R-ITM-001 (passives stack without an inventory cap), R-ITM-002 (unique
 *           sprite, fixed class), R-ITM-005 (pickup phrases hide raw numbers),
 *           R-ITM-007 (a liability can be declined and cannot make a run unwinnable).
 *
 * Three things to know before editing:
 *
 * 1. **The numbers are not mine.** Appendix C.2 specifies them. Where a value looks
 *    oddly precise (0.88, 0.72, 0.62) it is quoted, not invented, and changing one is a
 *    GDD revision rather than a tuning tweak.
 *
 * 2. **Most items need no code.** A `stats` block is applied directly by the attack
 *    graph and a `modifier` block routes through the adapter system that already
 *    exists. Only genuinely conditional effects reach for a hook, which is why
 *    two-thirds of this file is pure data.
 *
 * 3. **Pickup phrases contain no numbers.** The phrase describes the feel; the
 *    collection entry may be longer, still without a stat sheet (R-ITM-005).
 */

import { COLLECTIBLE_CLASS, POOL, STATUS } from '../../src/core/constants.js';

const P = COLLECTIBLE_CLASS.PASSIVE;

/** Builder. `slug` drives loc keys and sprite id so the three can never disagree. */
const item = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `item.${slug}.name`,
  pickupPhraseLoc: `item.${slug}.phrase`,
  collectionLoc: `item.${slug}.collection`,
  class: P,
  spriteId: `item_${slug}`,
  quality: spec.q,
  baseWeight: spec.w,
  minFloor: spec.floor ?? 1,
  pools: spec.pools,
  repeatable: spec.repeatable ?? false,
  ...(spec.jackpot ? { earlyJackpotEligible: true } : {}),
  tags: spec.tags,
  category: spec.category,
  ...(spec.stats ? { stats: spec.stats } : {}),
  ...(spec.health ? { health: spec.health } : {}),
  ...(spec.modifier ? { modifier: spec.modifier } : {}),
  ...(spec.effects ? { effects: spec.effects } : {}),
  liability: spec.liability ?? false,
  stacking: spec.stacking ?? 'NONE',
  ...(spec.stackCap ? { stackCap: spec.stackCap } : {}),
  interactionNotes: spec.notes,
  originalityNote: spec.original,
});

/** Standard modifier block. Adapter ids come from docs/ID_REGISTRY.md. */
const mod = (mechanic, defaultAdapter, opts = {}) => ({
  mechanic,
  supportedAttackTags: opts.tags ?? ['PROJECTILE', 'MELEE_ARC', 'BEAM', 'TETHER', 'CHARGE_WAVE'],
  defaultAdapter,
  weaponOverrides: opts.overrides ?? {},
  // NO_EFFECT is the right answer when a relationship is genuinely nonsensical
  // (R-WPN-005). FALLBACK_STAT is for items whose fantasy survives without the mechanic.
  unsupportedBehavior: opts.unsupported ?? 'NO_EFFECT',
  ...(opts.params ? { params: opts.params } : {}),
});

const SUPPLY = [POOL.SUPPLY_CLOSET];
const SUPPLY_LAB = [POOL.SUPPLY_CLOSET, POOL.INNOVATION_LAB];
const SUPPLY_SHOP = [POOL.SUPPLY_CLOSET, POOL.OFFICE_SUPPLY_SHOP];
const SUPPLY_UNION = [POOL.SUPPLY_CLOSET, POOL.UNION_BREAKROOM];
const SUPPLY_RECORDS = [POOL.SUPPLY_CLOSET, POOL.RESTRICTED_RECORDS];

const passives = [
  // =========================================================================
  // Coffee and body: the plain stat items that anchor the curve
  // =========================================================================
  item('ITM-001', 'espresso_shot', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['COFFEE', 'STAT'], category: 'Stat',
    stats: { intervalMul: 0.88 },
    notes: 'With Milk Carton, activates the Latte transformation.',
    original: 'A single office espresso as a cadence item; the transformation set is original to this game.',
  }),
  item('ITM-002', 'milk_carton', {
    q: 2, w: 1.0, pools: SUPPLY_UNION, tags: ['COFFEE', 'SUSTAIN'], category: 'Health',
    health: { composureContainersAdd: 1, composureHealHalfUnits: 2 },
    notes: 'With Espresso Shot, activates Latte.',
    original: 'Break-room milk as a health container, paired with espresso for an office-native set.',
  }),
  item('ITM-003', 'sugar_packets', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['COFFEE', 'STAT'], category: 'Stat',
    stats: { projectileSpeedMul: 1.2 },
    // Appendix C.2: melee weapons shorten their wind-up instead, since projectile speed
    // is meaningless to an arc. The fantasy survives; the mechanic changes.
    modifier: mod('CADENCE', 'SpreadControlAdapter', {
      tags: ['MELEE_ARC', 'AREA_SLAM'], params: { spreadReduction: 0.1 },
    }),
    notes: 'For melee weapons, slightly shortens wind-up instead of changing projectile speed.',
    original: 'Sachets of sugar as projectile velocity; the melee wind-up translation is original.',
  }),
  item('ITM-004', 'mechanical_switches', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'STAT'], category: 'Stat',
    stats: { intervalMul: 0.9 },
    notes: 'Keyboard uses a distinct click sample. Clamped after all interval modifiers.',
    original: 'Aftermarket key switches as a cadence upgrade, with an audible identity.',
  }),
  item('ITM-005', 'heavy_keycaps', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'STAT'], category: 'Stat',
    stats: { damageMul: 1.25, projectileSpeedMul: 0.85 },
    notes: 'Stapler override changes the visuals to heavy staples.',
    original: 'Weighted keycaps trading speed for impact; a tradeoff stat item, not a pure upgrade.',
  }),
  item('ITM-006', 'ergonomic_chair', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'STAT'], category: 'Stat',
    stats: { moveSpeedAdd: 0.45, incomingKnockbackMul: 0.85 },
    notes: 'Rolling hazards impart less knockback.',
    original: 'A good chair as mobility. The hazard interaction is original office logic.',
  }),
  item('ITM-007', 'standing_desk', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'STAT'], category: 'Stat',
    stats: { moveSpeedAdd: 0.25 },
    notes: 'Also reduces stationary enemy targeting accuracy. The accuracy benefit does not stack.',
    original: 'Standing to work as evasion; the targeting penalty is an original translation.',
  }),
  item('ITM-008', 'blue_light_glasses', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'INFORMATION'], category: 'Range',
    stats: { rangeMul: 1.25 },
    notes: 'Beam and melee weapons gain reach. Player attacks go slightly transparent where they overlap hostile fire.',
    original: 'Screen glasses as range, with a readability benefit that serves GDD 2.9 rather than raw power.',
  }),
  item('ITM-009', 'wrist_rest', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'DEFENSE'], category: 'Control',
    stats: { spreadMul: 0.65, incomingKnockbackMul: 0.7 },
    modifier: mod('SPREAD_CONTROL', 'SpreadControlAdapter', { params: { spreadReduction: 0.35 } }),
    notes: 'Removes the Espresso Shot cosmetic tremor without removing its benefit.',
    original: 'A wrist rest as accuracy and stability; the cosmetic interaction is original.',
  }),

  // =========================================================================
  // Multiplicity and trajectory: the modifier core (GDD 8.5 layer one)
  // =========================================================================
  item('ITM-010', 'dual_monitors', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Multiplicity',
    modifier: mod('MULTIPLY_DUAL', 'DualProjectileAdapter', {
      overrides: {
        'WPN-002': 'OffsetArcAdapter',
        'WPN-003': 'ForkBeamAdapter',
        'WPN-012': 'PairedWaveAdapter',
      },
      params: { damageScale: 0.72 },
    }),
    notes: 'Beam weapons create two narrow beams; melee weapons create offset arcs. Each copy deals reduced damage.',
    original: 'A second monitor as a paired attack pattern, expressed differently per weapon family.',
  }),
  item('ITM-011', 'pen_laser_pointer', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Trajectory modifier',
    modifier: mod('HOMING', 'HomingProjectileAdapter', {
      overrides: {
        'WPN-002': 'HomingArcAdapter',
        'WPN-003': 'TrackingBeamAdapter',
        'WPN-010': 'CurvingTetherAdapter',
        'WPN-012': 'SteeringWaveAdapter',
      },
    }),
    notes: 'A pen-sized pointer is always a modifier; the presentation model is always a weapon (R-WPN-004). Some area weapons receive no effect.',
    original: 'The pointer/weapon split is a deliberate original distinction, not a mode toggle.',
  }),
  item('ITM-012', 'numeric_keypad', {
    q: 2, w: 1.0, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Aim modifier',
    modifier: mod('EIGHT_DIRECTION', 'EightDirectionAdapter', {
      tags: ['PROJECTILE', 'MELEE_ARC', 'BEAM', 'AREA_SLAM', 'PLACED_AREA'],
      overrides: {
        'WPN-002': 'EightDirectionArcAdapter',
        'WPN-007': 'EightDirectionSlamAdapter',
        'WPN-014': 'AnglePlacementAdapter',
      },
    }),
    notes: 'Input resolves to the nearest 45-degree direction. Keyboard, Mouse, beams, stamps, and placement angles each use explicit adapters.',
    original: 'A detached numpad as the diagonal-aim unlock; office-native and mechanically legible.',
  }),
  item('ITM-013', 'usb_hub', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Multiplicity modifier',
    modifier: mod('SPLIT', 'SplitProjectileAdapter', {
      overrides: { 'WPN-003': 'ForkBeamAdapter', 'WPN-008': 'WidenConeAdapter' },
      params: { damageScale: 0.55 },
    }),
    notes: 'Splits once, never recursively. Cone weapons widen rather than splitting every particle, which protects the projectile budget.',
    original: 'More ports as more attacks; the per-archetype translation is original.',
  }),
  item('ITM-014', 'wireless_dongle', {
    q: 2, w: 1.0, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Collision modifier',
    modifier: mod('WALL_PASS', 'WallPassProjectileAdapter', { params: { count: 1 } }),
    notes: 'Ignores the first furniture-class obstacle only. Boundary walls and secret walls stay solid, and it never reveals or opens a hidden room.',
    original: 'Going wireless as furniture pass-through, with the secret-wall exclusion as an explicit design guard.',
  }),
  item('ITM-015', 'macro_pad', {
    q: 3, w: 0.65, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Cadence modifier',
    modifier: mod('REPEAT_ECHO', 'MacroRepeatAdapter', {
      overrides: { 'WPN-007': 'EchoSlamAdapter', 'WPN-003': 'PulseBeamAdapter' },
      params: { every: 5, delay: 0.08, damageScale: 0.65 },
    }),
    notes: 'Charge weapons repeat a partial charge; sustained weapons pulse instead.',
    original: 'A macro key as a repeated attack; the charge and sustained translations are original.',
  }),
  item('ITM-016', 'sticky_keys', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Payload modifier',
    modifier: mod('STICK', 'StickProjectileAdapter'),
    notes: 'Existing sticky weapons gain duration and burst size instead. Does not attach to invulnerable scenery.',
    original: 'Sticky keys as an attaching payload with a delayed pop.',
  }),
  item('ITM-017', 'autocorrect', {
    q: 2, w: 1.0, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Trajectory modifier',
    modifier: mod('NEAR_MISS_STEER', 'NearMissSteerAdapter'),
    notes: 'Stacks with Pen Laser by increasing acquisition radius, not steering strength.',
    original: 'Autocorrect as a second chance at a near miss; the stacking rule keeps it from doubling homing.',
  }),
  item('ITM-018', 'caps_lock', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Rhythm modifier',
    modifier: mod('RHYTHM_CHARGED', 'ChargedEighthAdapter', {
      overrides: { 'WPN-003': 'PulseBeamAdapter', 'WPN-008': 'PulseBeamAdapter', 'WPN-012': 'SizeWaveAdapter' },
      params: { every: 8, damageScale: 2 },
    }),
    notes: 'The counter persists across rooms but resets on floor transition, so a charge cannot be banked through the elevator. Sustained weapons emit a periodic power tick.',
    original: 'Caps lock as a periodic emphasised attack. The shouting joke stays mechanical.',
  }),
  item('ITM-019', 'shift_key', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Rhythm modifier',
    modifier: mod('RHYTHM_ALTERNATE', 'AlternatingAdapter', { params: { damageScale: 1.35 } }),
    notes: 'Dual attacks share one alternation state, so a paired pattern empowers both shots together.',
    original: 'A shift key as an alternating empowered attack, with a distinct effect colour.',
  }),
  item('ITM-020', 'space_bar', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Force modifier',
    modifier: mod('KNOCKBACK', 'KnockbackProjectileAdapter', {
      overrides: { 'WPN-002': 'KnockbackArcAdapter', 'WPN-007': 'KnockbackArcAdapter' },
    }),
    notes: 'Melee and area weapons gain stronger displacement. Boss displacement remains capped.',
    original: 'The space bar as literal space-making; the boss cap keeps it from trivialising arenas.',
  }),
  item('ITM-021', 'backspace', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Trajectory modifier',
    modifier: mod('RETURN', 'ReturnProjectileAdapter', {
      overrides: { 'WPN-002': 'ReturnTetherAdapter', 'WPN-010': 'ReturnTetherAdapter' },
      params: { returnDamageScale: 0.6 },
    }),
    notes: 'Mouse and Desk Phone instead return faster and gain a second-path bonus. With Sticky Keys, stuck attacks detach and return.',
    original: 'Backspace as a returning attack; the tether variants get a genuinely better deal.',
  }),
  item('ITM-022', 'ctrl_c', {
    q: 3, w: 0.65, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Multiplicity modifier',
    modifier: mod('DUPLICATE', 'DuplicateProjectileAdapter', { params: { chance: 0.18 } }),
    notes: 'The copy uses scoped RNG and cannot recursively copy itself. With USB Hub, the whole split pattern may duplicate.',
    original: 'Copy as a chance to duplicate an attack event; the no-recursion rule is the balance.',
  }),

  // =========================================================================
  // Cables, clips, and payloads
  // =========================================================================
  item('ITM-023', 'rubber_bands', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'MODIFIER'], category: 'Bounce modifier',
    modifier: mod('BOUNCE', 'BounceProjectileAdapter', {
      tags: ['PROJECTILE'],
      params: { bounces: 2 },
    }),
    notes: 'Staples ricochet with a sharper angle and a metal snap. Presentation Remote gains three bounces instead of two.',
    original: 'A drawer of rubber bands as ricochet; the per-weapon feel differences are original.',
  }),
  item('ITM-024', 'binder_clip', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'MODIFIER'], category: 'Pierce modifier',
    modifier: mod('PIERCE', 'PierceProjectileAdapter', {
      overrides: { 'WPN-008': 'AggregateConeAdapter' },
      params: { pierce: 1, speedMul: 0.9 },
    }),
    notes: 'Paper Shredder converts a controlled subset of strips into piercing metal clips rather than converting all of them.',
    original: 'A binder clip as pierce, with a cone-weapon translation that keeps the weapon identity.',
  }),
  item('ITM-025', 'ethernet_cable', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Payload modifier',
    modifier: mod('STATUS_SHOCK', 'StatusProjectileAdapter', {
      overrides: { 'WPN-010': 'ShockTetherAdapter' },
      params: { status: STATUS.SHOCK, chance: 1, seconds: 0.3 },
    }),
    effects: [{ hook: 'CHAIN_SHOCK_ON_HIT', params: { scale: 0.45, radius: 3.2 } }],
    notes: 'A cooldown prevents repeated chains from the same attack tick. Desk Phone shocks tethered targets continuously at a limited rate.',
    original: 'A patch cable as chain lightning, rate-limited so a wide pattern cannot exploit it.',
  }),
  item('ITM-026', 'extension_cord', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'MODIFIER'], category: 'Range modifier',
    modifier: mod('RANGE', 'RangeProjectileAdapter', {
      overrides: {
        'WPN-002': 'ReachArcAdapter',
        'WPN-003': 'RangeBeamAdapter',
        'WPN-010': 'LengthTetherAdapter',
        'WPN-013': 'RangeBeamAdapter',
      },
      params: { rangeMul: 1.3 },
    }),
    notes: 'Increases range, tether length, cone reach, or melee reach through the weapon adapter. Does not increase room-boundary beam clipping.',
    original: 'An extension cord as reach, translated per archetype rather than as one number.',
  }),
  item('ITM-027', 'rechargeable_battery', {
    q: 2, w: 1.0, pools: SUPPLY_SHOP, tags: ['TECHNOLOGY', 'ACCESS'], category: 'Active support',
    stats: { activeChargeCapacityAdd: 1 },
    modifier: mod('RANGE', 'UptimePlacementAdapter', {
      tags: ['PLACED_AREA'], params: { uptimeMul: 1.35 },
    }),
    notes: 'Actives with time cooldowns gain faster recharge instead. On the Projector, increases uptime.',
    original: 'A battery pack as active-item support, with a placed-area translation.',
  }),
  item('ITM-028', 'red_staple_remover', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'MODIFIER'], category: 'Armor modifier',
    stats: { armorPierceFraction: 0.25 },
    modifier: mod('ARMOR_PIERCE', 'ArmorPierceAdapter', { params: { fraction: 0.25 } }),
    notes: 'Does not bypass invulnerability phases. Multiple armour items compose as independent reductions rather than summing past total.',
    original: 'A staple remover as armour penetration; the little jaws are the joke and the mechanic.',
  }),
  item('ITM-029', 'lucky_paperclip', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'DEFENSE', 'FAMILIAR'], category: 'Familiar',
    repeatable: true, stacking: 'CAPPED', stackCap: 3,
    stats: { luckAdd: 1 },
    effects: [{ hook: 'ORBITAL_FAMILIAR', params: { count: 1, max: 3, reformClears: 4 } }],
    notes: 'Blocks one hostile projectile, then reforms after four cleared rooms. Additional copies add orbitals up to three.',
    original: 'A bent paperclip as an orbiting shield; the reform-on-clear cost is original.',
  }),
  item('ITM-030', 'whiteboard_eraser', {
    q: 2, w: 1.0, pools: SUPPLY_UNION, tags: ['DEFENSE'], category: 'Defense',
    effects: [{ hook: 'ERASE_NEAR_MISS', params: { chance: 0.12, radius: 1.1 } }],
    notes: 'Luck-scaled. Never erases boss-critical scripted objects.',
    original: 'Erasing incoming attacks like marker on a board; the boss exclusion keeps fights fair.',
  }),
  item('ITM-031', 'correction_fluid', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'MODIFIER'], category: 'Status modifier',
    modifier: mod('STATUS_SLOW', 'StatusProjectileAdapter', {
      params: { status: STATUS.SLOW, chance: 0.15, seconds: 2.5 },
    }),
    effects: [{ hook: 'CHANCE_ON_HIT_STATUS', params: { status: STATUS.SLOW, chance: 0.15, seconds: 2.5 } }],
    notes: 'Marker trails become white slowing trails with lower direct damage.',
    original: 'Correction fluid as a slowing agent, with a weapon-specific trail change.',
  }),
  item('ITM-032', 'highlighter', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'MODIFIER'], category: 'Status modifier',
    modifier: mod('STATUS_MARK', 'StatusProjectileAdapter', {
      params: { status: STATUS.MARKED, chance: 1, seconds: 4, damageBonus: 0.15 },
    }),
    effects: [{ hook: 'MARK_ON_FIRST_HIT', params: { seconds: 4, damageBonus: 0.15 } }],
    notes: 'Refreshing does not stack magnitude.',
    original: 'Highlighting a target as a damage-amplification mark.',
  }),
  item('ITM-033', 'paperweight', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY', 'STAT'], category: 'Stat',
    stats: { damageMul: 1.3, intervalMul: 1.12, knockbackMul: 1.4 },
    modifier: mod('KNOCKBACK', 'WeightWaveAdapter', { tags: ['CHARGE_WAVE'] }),
    notes: 'Copier sheets become denser and slower.',
    original: 'A desk paperweight trading cadence for force; the charge-wave translation is original.',
  }),
  item('ITM-034', 'printer_ink', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['PAPER', 'MODIFIER'], category: 'Projectile size',
    modifier: mod('SIZE', 'SizeProjectileAdapter', {
      overrides: { 'WPN-007': 'SizeSlamAdapter', 'WPN-012': 'SizeWaveAdapter' },
      params: { sizeMul: 1.25, damageMul: 1.1, rangeMul: 0.92 },
    }),
    notes: 'Marker trails become wider.',
    original: 'A fresh cartridge as bolder, heavier output at slightly shorter range.',
  }),
  item('ITM-035', 'toner_dust', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['PAPER', 'MODIFIER'], category: 'Hazard modifier',
    modifier: mod('TRAIL_HAZARD', 'TrailProjectileAdapter', { params: { chance: 0.2 } }),
    notes: 'Paper Shredder creates fewer, larger patches to protect performance.',
    original: 'Spilled toner as a lingering hazard left by destroyed attacks.',
  }),

  // =========================================================================
  // Defence, sustain, and access
  // =========================================================================
  item('ITM-036', 'noise_canceling_headphones', {
    q: 2, w: 1.0, pools: SUPPLY_UNION, tags: ['TECHNOLOGY', 'DEFENSE'], category: 'Defense',
    stats: { explosionDamageResistMul: 0.75 },
    notes: 'Prevents aim-wobble effects. Audio stays readable: the item does not literally mute danger cues (R-AUD-003).',
    original: 'Headphones as blast resistance and focus, without ever hiding an audio warning.',
  }),
  item('ITM-037', 'mini_fridge', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['SUSTAIN', 'ECONOMY'], category: 'Pickup modifier',
    effects: [
      { hook: 'PICKUP_WEIGHT_BIAS', params: { kinds: ['COMPOSURE', 'CAFFEINE'], multiplier: 1.8 } },
      { hook: 'STORE_EXCESS_HEAL', params: { max: 1 } },
    ],
    notes: 'Cannot store more than one half-unit, released at the next floor start.',
    original: 'A desk fridge as health economy: it biases drops and saves one wasted heal.',
  }),
  item('ITM-038', 'lunchbox', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['ECONOMY', 'SUSTAIN'], category: 'Floor reward',
    effects: [{
      hook: 'SPAWN_PICKUP_ON_FLOOR_START',
      params: { kinds: ['CREDIT', 'ACCESS_CARD', 'TONER_CHARGE', 'COMPOSURE'] },
    }],
    notes: 'Can spawn credits, Access Cards, Toner Charges, or health; never a pedestal item.',
    original: 'A packed lunch as a guaranteed small floor-start reward.',
  }),
  item('ITM-039', 'company_hoodie', {
    q: 2, w: 1.0, pools: SUPPLY_UNION, tags: ['DEFENSE'], category: 'Buffer health',
    repeatable: true, stacking: 'CAPPED', stackCap: 6,
    health: { caffeineIconsAdd: 1 },
    notes: 'Additional copies grant another icon up to the buffer cap.',
    original: 'Branded merchandise as buffer health; the comfort joke stays mechanical.',
  }),
  item('ITM-040', 'visitor_badge', {
    q: 2, w: 1.0, pools: SUPPLY_SHOP, tags: ['ACCESS'], category: 'Access utility',
    effects: [{ hook: 'FREE_DOOR_PER_FLOOR', params: {} }],
    notes: 'Does not open double-card, executive, or secret locks.',
    original: 'A visitor badge as limited access; the exclusions keep it from being the master badge.',
  }),
  item('ITM-041', 'master_access_badge', {
    q: 4, w: 0.15, floor: 3, jackpot: true,
    pools: [POOL.SUPPLY_CLOSET, POOL.OFFICE_SUPPLY_SHOP, POOL.SECRET_MAINTENANCE, POOL.EXECUTIVE_DEAL],
    tags: ['ACCESS'], category: 'Access utility',
    effects: [{ hook: 'FREE_DOOR_ALWAYS', params: {} }],
    notes: 'Standard single-card doors cost zero for the rest of the run. Does not open manager seals, hidden walls, or story locks.',
    original: 'A master badge as a run-defining access jackpot, with explicit limits so it cannot skip secrets.',
  }),
  item('ITM-042', 'office_plant', {
    q: 2, w: 1.0, pools: SUPPLY_UNION, tags: ['SUSTAIN'], category: 'Sustain',
    effects: [{ hook: 'HEAL_ON_ROOM_CLEAR', params: { chance: 0.05, cap: 0.2, halfUnits: 1 } }],
    notes: 'Chance increases slightly with luck, and is capped so luck stacking cannot become full sustain.',
    original: 'The office plant nobody waters as slow recovery.',
  }),
  item('ITM-043', 'desk_cactus', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['DEFENSE'], category: 'Contact offense',
    stats: { contactDamageResistMul: 0.85 },
    effects: [{ hook: 'CONTACT_DAMAGE_AURA', params: { damage: 3, intervalSeconds: 0.4 } }],
    notes: 'Does not protect against projectiles.',
    original: 'A spiky desk plant that hurts whatever brushes it; the projectile exclusion is explicit.',
  }),
  item('ITM-044', 'stress_ball', {
    q: 3, w: 0.65, pools: SUPPLY_UNION, tags: ['DEFENSE'], category: 'Damage buffer',
    effects: [{ hook: 'SHIELD_FIRST_HIT_PER_FLOOR', params: { halfUnits: 1 } }],
    notes: 'Sacrifice and self-damage ignore the reduction, because the item protects from the room rather than from the player.',
    original: 'A stress ball absorbing the first blow of each floor.',
  }),

  // =========================================================================
  // Familiars and information
  // =========================================================================
  item('ITM-045', 'company_laptop', {
    q: 3, w: 0.65, pools: SUPPLY, tags: ['TECHNOLOGY', 'FAMILIAR'], category: 'Familiar',
    effects: [{
      hook: 'SHOOTING_FAMILIAR',
      params: {
        id: 'ITM-045', intervalSeconds: 0.95, damageScale: 0.4,
        inheritsTrajectory: true, inheritsMultiplicity: false,
      },
    }],
    notes: 'Inherits trajectory modifiers but not multiplicity by default, so a familiar cannot multiply an already-multiplied pattern.',
    original: 'Work following you home as a familiar that keeps typing.',
  }),
  item('ITM-046', 'webcam', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['TECHNOLOGY', 'INFORMATION'], category: 'Information',
    effects: [{ hook: 'REVEAL_ROOM_CATEGORY', params: {} }],
    modifier: mod('RANGE', 'RevealPlacementAdapter', { tags: ['PLACED_AREA', 'CONE_STREAM'] }),
    notes: 'Reveals adjacent normal and special room categories after entering a room. Does not reveal secret rooms. The Projector weapon reveals cloaked enemies in its cone.',
    original: 'A webcam as reconnaissance, with secrets explicitly excluded to protect discovery.',
  }),
  item('ITM-047', 'confidential_stamp', {
    q: 2, w: 1.0, pools: [POOL.SUPPLY_CLOSET, POOL.SECRET_MAINTENANCE],
    tags: ['STATIONERY', 'FORBIDDEN'], category: 'Critical',
    effects: [{ hook: 'CRIT_VS_FULL_HEALTH', params: { bonus: 0.25 } }],
    notes: 'Slightly improves rare Secret Maintenance item weights. Rubber Stamp gains a special red impact visual.',
    original: 'A confidential stamp that hits hardest on an untouched target.',
  }),
  item('ITM-048', 'calendar_reminder', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['INFORMATION'], category: 'Map utility',
    effects: [{ hook: 'REVEAL_BOSS_ROOM', params: {} }],
    notes: 'Reveals the boss-room icon and elevator direction. Does not reveal the path between rooms.',
    original: 'A calendar reminder as navigation; withholding the path keeps exploration meaningful.',
  }),

  // =========================================================================
  // Liabilities and tradeoffs (GDD 8.6, R-ITM-007)
  // =========================================================================
  item('ITM-049', 'reply_all', {
    q: 3, w: 0.65,
    pools: [POOL.SUPPLY_CLOSET, POOL.RESTRICTED_RECORDS, POOL.EXECUTIVE_DEAL],
    tags: ['LIABILITY', 'MODIFIER'], category: 'Liability', liability: true,
    effects: [{ hook: 'DUPLICATE_HOSTILE_PROJECTILES', params: { playerScale: 0.45, echoScale: 0.3 } }],
    notes: 'Duplicates every player projectile at reduced damage AND every enemy projectile at full damage. Melee and beam weapons gain a weaker echo while enemy patterns still duplicate. Powerful but genuinely dangerous.',
    original: 'The reply-all catastrophe as a symmetric duplication effect; the room becomes a regrettable email thread.',
  }),
  item('ITM-050', 'open_calendar', {
    q: 0, w: 0.75, pools: SUPPLY_RECORDS, tags: ['LIABILITY', 'TRADEOFF'],
    category: 'Liability', liability: true,
    effects: [{ hook: 'SHORTEN_ENEMY_COOLDOWNS', params: { mul: 0.85 } }],
    notes: 'Enemies act faster, and clear rewards become more likely. Boss phase timers are not shortened unless explicitly tagged.',
    original: 'A wide-open calendar as a risk-reward tempo item: everyone gets to you sooner.',
  }),
  item('ITM-051', 'wet_keyboard', {
    q: 0, w: 0.75, pools: SUPPLY_RECORDS, tags: ['LIABILITY'],
    category: 'Liability', liability: true,
    stats: { intervalMul: 1.25 },
    notes: 'Player shock effects deal more damage. A rare drying event or a replacement weapon can reduce the pain, but the passive remains in the collection.',
    original: 'A spilled drink as a lasting cadence penalty with one electrical upside.',
  }),
  item('ITM-052', 'cheap_chair', {
    q: 1, w: 1.0, pools: SUPPLY_RECORDS, tags: ['TRADEOFF', 'DEFENSE'], category: 'Tradeoff',
    stats: { moveSpeedAdd: -0.35, contactDamageResistMul: 0.75, incomingKnockbackMul: 0 },
    notes: 'Grants knockback immunity. A visual wobble sells the joke without affecting input.',
    original: 'The bad chair nobody wants: slower, sturdier, and immovable.',
  }),
  item('ITM-053', 'burnout', {
    q: 1, w: 1.0, pools: SUPPLY_RECORDS, tags: ['TRADEOFF'], category: 'Tradeoff',
    health: { composureContainersAdd: -1 },
    effects: [{ hook: 'DAMAGE_SCALE_ON_LOW_HEALTH', params: { minBonus: 0.15, maxBonus: 0.55 } }],
    notes: 'Cannot reduce maximum Composure below one full icon, so it can never make a run unwinnable on its own (R-ITM-007).',
    original: 'Burnout as a risk curve: less to lose, more to give.',
  }),
  item('ITM-054', 'mandatory_training', {
    q: 0, w: 0.75, pools: SUPPLY_RECORDS, tags: ['LIABILITY', 'TRADEOFF'],
    category: 'Liability', liability: true,
    effects: [{ hook: 'DISABLE_ACTIVE_UNTIL_CLEARS', params: { clears: 3 } }],
    notes: 'Disables active-item use for the first three hostile clears of each floor, then grants a floor-long damage increase. Charge still accumulates while disabled.',
    original: 'Compulsory training as a delayed reward: sit through it, then get the benefit.',
  }),

  // =========================================================================
  // Late additions
  // =========================================================================
  item('ITM-055', 'three_hole_punch', {
    q: 3, w: 0.65, pools: SUPPLY_LAB, tags: ['STATIONERY', 'MODIFIER'], category: 'Multiplicity modifier',
    modifier: mod('MULTIPLY_TRIPLE', 'TripleProjectileAdapter', { params: { damageScale: 0.62, spread: 0.2 } }),
    notes: 'Overrides the Dual Monitors pattern; the stronger pattern is not multiplied again, so the two together give three shots rather than six.',
    original: 'A three-hole punch as a triple shot, with an explicit override rule instead of exponential stacking.',
  }),
  item('ITM-056', 'sticky_notes', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['PAPER', 'FAMILIAR'], category: 'Familiar',
    effects: [{
      hook: 'SHOOTING_FAMILIAR',
      params: { id: 'ITM-056', kind: 'ORBIT_LAUNCH', count: 3, intervalSeconds: 1.4, damageScale: 0.35 },
    }],
    notes: 'Three notes orbit loosely and launch one at a time, reforming after a room clear. Trajectory modifiers apply after launch.',
    original: 'A fan of sticky notes as launchable orbitals.',
  }),
  item('ITM-057', 'red_pen', {
    q: 2, w: 1.0, pools: SUPPLY, tags: ['STATIONERY'], category: 'Critical',
    effects: [{ hook: 'CRIT_CHANCE', params: { chance: 0.1, multiplier: 2, markedBonus: 0.08 } }],
    notes: 'Chance increases modestly against Marked enemies. Critical damage is never shown as a number in the normal HUD (D-013).',
    original: 'A red pen as critical hits: the correction that really lands.',
  }),
  item('ITM-058', 'spare_keyboard', {
    q: 4, w: 0.15, floor: 3, jackpot: true,
    pools: [POOL.SUPPLY_CLOSET, POOL.SECRET_MAINTENANCE, POOL.EXECUTIVE_DEAL],
    tags: ['REVIVAL'], category: 'Extra life',
    effects: [{ hook: 'REVIVE_ONCE', params: { icons: 1 } }],
    notes: 'On fatal damage, revives once at one full Composure icon, replaces the current weapon with the Keyboard, and destroys itself. Revival occurs before run-end persistence.',
    original: 'A spare keyboard in a drawer as an extra life, with the weapon reset as the price.',
  }),
  item('ITM-059', 'corporate_card', {
    q: 3, w: 0.65, pools: SUPPLY_SHOP, tags: ['ECONOMY'], category: 'Economy',
    effects: [{ hook: 'CREDIT_DEBT_LINE', params: { limit: 15 } }],
    notes: 'Shop items may be bought on a temporary debt balance. Future credit pickups pay the debt first. Debt does not persist between runs.',
    original: 'Putting it on expenses as a credit line, with the debt visible in the HUD.',
  }),
  item('ITM-060', 'suggestion_box', {
    q: 3, w: 0.65, pools: [POOL.SUPPLY_CLOSET, POOL.SECRET_MAINTENANCE],
    tags: ['REROLL'], category: 'Reroll support',
    effects: [{ hook: 'REROLL_LEFT_PEDESTAL', params: {} }],
    notes: 'The first uncollected pedestal item left on each floor is rerolled once when the player exits and re-enters its room. Uses the same pool and cannot reroll into the same item.',
    original: 'A suggestion box as a second opinion on an item you walked away from.',
  }),
];

export default passives;
