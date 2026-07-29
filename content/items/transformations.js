/**
 * Transformations TRN-001..004. Appendix C.7.
 *
 * GDD refs: Appendix C.7 (condition and additional effect for all four), 8.5
 *           ("Transformations provide rare, readable milestones" — the third and
 *           thinnest synergy layer), 18.4 (a transformation shows a visible player
 *           body state), R-ITM-001 (a transformation is additive: it never removes
 *           the base effects of the items that triggered it).
 *
 * Four transformations against sixty passives is the correct ratio. GDD 8.5 puts most
 * depth in systemic modifiers and reserves transformations for milestones the player
 * can *see*, which is why every entry here has a `playerVisual`: if it does not change
 * the character on screen, it should have been an item interaction instead.
 *
 * TRN-002..004 use ANY_N_OF rather than ALL_OF. That is what makes them reachable —
 * three of six is a run that leaned a direction, while a fixed six-item set would
 * almost never complete.
 */

const transformation = (id, slug, spec) => ({
  id,
  schemaVersion: 1,
  nameLoc: `transformation.${slug}.name`,
  descriptionLoc: `transformation.${slug}.description`,
  spriteId: `trn_${slug}`,
  condition: spec.condition,
  effects: spec.effects,
  playerVisual: spec.visual,
  originalityNote: spec.original,
});

const transformations = [
  transformation('TRN-001', 'latte', {
    // The only ALL_OF in the set, and the GDD's own worked example (8.5): two specific
    // coffee items, both cheap, both common. It is the tutorial transformation.
    condition: { mode: 'ALL_OF', itemIds: ['ITM-001', 'ITM-002'] },
    effects: [
      { hook: 'STAT_MODIFY', params: { moveSpeedAdd: 0.2 } },
      // C.7: "removes cadence-related accuracy penalties from future coffee items."
      // Expressed as a spread floor rather than by naming the items, so a coffee item
      // added later inherits the benefit without editing this entry.
      { hook: 'STAT_MODIFY', params: { spreadMul: 0.75 } },
    ],
    visual: 'A foam-topped cup accessory rides in the player-s off hand, with a thin steam wisp.',
    original: 'Espresso plus milk as the game-s introductory set, retaining both base effects.',
  }),
  transformation('TRN-002', 'power_user', {
    condition: {
      mode: 'ANY_N_OF',
      count: 3,
      // Mechanical Switches, Macro Pad, Numeric Keypad, USB Hub, Wireless Dongle,
      // Rechargeable Battery — the six technology-modifier items, verbatim from C.7.
      itemIds: ['ITM-004', 'ITM-015', 'ITM-012', 'ITM-013', 'ITM-014', 'ITM-027'],
    },
    effects: [
      // "Compatible modifiers gain slightly stronger adapter values" — a global adapter
      // scalar, so it lifts whatever combination the player actually assembled rather
      // than a hand-picked list of favoured pairs.
      { hook: 'PATTERN_MODIFY', params: { adapterStrengthMul: 1.12 } },
    ],
    visual: 'A faint keyboard-shortcut aura of drifting key glyphs orbits the player at ankle height.',
    original: 'Three of six technology modifiers as a power-user milestone that strengthens the build you chose.',
  }),
  transformation('TRN-003', 'paper_trail', {
    condition: {
      mode: 'ANY_N_OF',
      count: 3,
      // Sticky Notes, Binder Clip, Lucky Paperclip, Paperweight, Printer Ink, Toner Dust.
      itemIds: ['ITM-056', 'ITM-024', 'ITM-029', 'ITM-033', 'ITM-034', 'ITM-035'],
    },
    effects: [
      {
        hook: 'TRAIL_ON_ATTACK_DESTROYED',
        // C.7: "Effect count is aggregated for performance." A wide pattern would
        // otherwise spawn a trail per projectile, so the cap and the merge radius are
        // part of the design rather than an optimisation bolted on later.
        params: { damage: 2, seconds: 1.4, maxConcurrent: 12, mergeRadius: 0.6 },
      },
    ],
    visual: 'Torn paper scraps trail behind the player and drift down after every attack.',
    original: 'Three of six paper items as a trail that lightly damages, aggregated so it stays performant.',
  }),
  transformation('TRN-004', 'middle_management', {
    condition: {
      mode: 'TAG_COUNT',
      // C.7 says "any three management-tag items or manager set drops", so this counts a
      // TAG rather than listing ids. New management items join it automatically, which
      // is the point of the controlled tag registry.
      tag: 'MANAGEMENT',
      count: 3,
    },
    effects: [
      { hook: 'ASSISTANT_FAMILIAR', params: { collectRadius: 3.5, bossKillBonus: 0.25, bonusSeconds: 20 } },
    ],
    visual: 'A small assistant follows a step behind the player, carrying a clipboard.',
    original: 'A tiny assistant familiar as the management payoff. C.7 is explicit that this is a visual joke, not a reputation system.',
  }),
];

export default transformations;
