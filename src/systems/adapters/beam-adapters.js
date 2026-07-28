/**
 * Beam, cone stream, and placed-area modifier adapters.
 *
 * GDD refs: 7.2 (Beam: "Bend, fork, pulse, range, status"; Cone stream: "Widen,
 *           status, push, aggregate projectiles"; Placed area: "Angle, duration,
 *           reveal, status"), 7.3 (adapter contract), 8.5 (Big Laser Pointer + Pen
 *           Laser: the beam endpoint tracks a target with capped angular speed),
 *           7.5 (repeated micro-projectiles may be represented by a stream after a
 *           threshold; final damage still comes from the full graph),
 *           Appendix B.2 (per-weapon adapter notes).
 *
 * The recurring problem this family solves: multiplicity means something different
 * for a sustained weapon. Doubling a projectile doubles the shots; doubling a beam
 * would double a *continuous* damage source, which is not a 2x item, it is a 2x
 * weapon. So sustained archetypes translate multiplicity into coverage — forks, wider
 * cones, paired narrow beams — rather than into raw ticks.
 */

import { defineAdapter } from '../adapters.js';
import { ARCHETYPE, STATUS } from '../../core/constants.js';
import { ORDER } from './projectile-adapters.js';

const BEAM_TAGS = [ARCHETYPE.BEAM, 'BEAM', 'SUSTAINED', 'DIRECTED'];
const CONE_TAGS = [ARCHETYPE.CONE_STREAM, 'CONE_STREAM', 'SUSTAINED', 'DIRECTED'];
const PLACED_TAGS = [ARCHETYPE.PLACED_AREA, 'PLACED_AREA', 'AREA'];

// ---------------------------------------------------------------------------
// Beam
// ---------------------------------------------------------------------------

defineAdapter('TrackingBeamAdapter', {
  supports: BEAM_TAGS,
  order: ORDER.TRAJECTORY,
  note: 'WPN-003 + Pen Laser: the beam endpoint tracks a target, angular speed capped.',
  fn: (plan, params) => {
    // GDD 8.5 says "with capped angular speed", and the cap is the design: an
    // instant-snap beam would trivialise every stationary shooter in the game.
    plan.beamTracking = {
      maxAngularSpeed: Math.min(params.maxAngularSpeed ?? 1.8, 3.0),
      radius: params.radius ?? 7,
    };
  },
});

defineAdapter('ForkBeamAdapter', {
  supports: BEAM_TAGS,
  order: ORDER.MULTIPLICITY,
  note: 'ITM-013 USB Hub on WPN-003: the beam forks after first contact.',
  fn: (plan, params) => {
    // Appendix B.2: "USB Hub forks the beam after first contact." Forking on contact
    // rather than at the origin is what keeps this a coverage item instead of a
    // blanket damage multiplier.
    plan.forkOnContact += params.forks ?? 1;
    plan.forkAngle = params.angle ?? 0.4;
    plan.forkDamageScale = params.damageScale ?? 0.55;
  },
});

defineAdapter('PulseBeamAdapter', {
  supports: [...BEAM_TAGS, ...CONE_TAGS],
  order: ORDER.EVENT,
  note: 'ITM-018 Caps Lock on a sustained weapon: a periodic power tick.',
  fn: (plan, params) => {
    // Appendix C.2: "Sustained weapons emit a periodic power tick" rather than an
    // eighth-attack crit, because a sustained weapon has no discrete attack to count.
    plan.pulse = {
      everySeconds: params.everySeconds ?? 1.6,
      damageScale: params.damageScale ?? 2,
      sizeScale: params.sizeScale ?? 1.4,
    };
  },
});

defineAdapter('RangeBeamAdapter', {
  supports: BEAM_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-026 Extension Cord on a beam: greater reach, still clipped by the room.',
  fn: (plan, params) => {
    // ITM-026 explicitly "does not increase room-boundary beam clipping", so the
    // beam gets longer but still stops at the wall.
    plan.range *= (params.rangeMul ?? 1.3) ** (params.stacks ?? 1);
    plan.clipsAtBoundary = true;
  },
});

defineAdapter('StatusBeamAdapter', {
  supports: BEAM_TAGS,
  order: ORDER.PAYLOAD,
  note: 'Status payload on a beam, rate-limited so ticks cannot re-apply per frame.',
  fn: (plan, params) => {
    const status = params.status ?? STATUS.BURN;
    // A beam ticks many times a second; applying a status on every tick would make
    // any chance-based status effectively certain. The cooldown is the fix.
    plan.addStatus(status, params.chance ?? 0.2, params.seconds ?? 2, params.magnitude ?? 1);
    plan.statusCooldownSeconds = Math.max(plan.statusCooldownSeconds ?? 0, params.cooldown ?? 0.5);
  },
});

// ---------------------------------------------------------------------------
// Cone stream
// ---------------------------------------------------------------------------

defineAdapter('WidenConeAdapter', {
  supports: CONE_TAGS,
  order: ORDER.MULTIPLICITY,
  note: 'ITM-013 USB Hub on WPN-008: widens the cone instead of splitting particles.',
  fn: (plan, params) => {
    // Appendix C.2: "Cone weapons widen rather than recursively splitting every
    // particle." A shredder emitting hundreds of split strips would blow the
    // projectile budget (GDD 20.7) for no readability gain at all.
    plan.coneAngle = Math.min((plan.coneAngle || 0.6) * (params.widenMul ?? 1.35), Math.PI * 0.9);
  },
});

defineAdapter('StatusConeAdapter', {
  supports: CONE_TAGS,
  order: ORDER.PAYLOAD,
  note: 'Status payload on a cone, rate-limited like the beam version.',
  fn: (plan, params) => {
    plan.addStatus(params.status ?? STATUS.SLOW, params.chance ?? 0.18,
      params.seconds ?? 2, params.magnitude ?? 1);
    plan.statusCooldownSeconds = Math.max(plan.statusCooldownSeconds ?? 0, params.cooldown ?? 0.4);
  },
});

defineAdapter('AggregateConeAdapter', {
  supports: CONE_TAGS,
  order: ORDER.GEOMETRY,
  note: 'Converts a subset of cone particles into a stronger piercing element.',
  fn: (plan, params) => {
    // Appendix B.2 for WPN-008: "Binder Clip converts some strips into piercing
    // metal clips." A *subset*, not all of them, so the weapon keeps its identity as
    // many small hits with a few that punch through.
    plan.aggregate = {
      fraction: Math.min(0.5, params.fraction ?? 0.25),
      pierce: params.pierce ?? 1,
      damageScale: params.damageScale ?? 1.6,
    };
  },
});

// ---------------------------------------------------------------------------
// Placed area
// ---------------------------------------------------------------------------

defineAdapter('AnglePlacementAdapter', {
  supports: PLACED_TAGS,
  order: ORDER.TRAJECTORY - 5,
  note: 'ITM-012 Numeric Keypad on WPN-014: diagonal placement angles.',
  fn: (plan) => {
    plan.eightDirection = true;
  },
});

defineAdapter('UptimePlacementAdapter', {
  supports: PLACED_TAGS,
  order: ORDER.GEOMETRY,
  note: 'ITM-027 Rechargeable Battery on WPN-014: the projector runs longer.',
  fn: (plan, params) => {
    plan.placementLifetime *= (params.uptimeMul ?? 1.35) ** (params.stacks ?? 1);
  },
});

defineAdapter('RevealPlacementAdapter', {
  supports: [...PLACED_TAGS, ...CONE_TAGS],
  order: ORDER.PAYLOAD,
  note: 'ITM-046 Webcam on WPN-014: the cone reveals cloaked threats.',
  fn: (plan) => {
    // Reveal is a real mechanic, not decoration: Marketing decoys and cloaked IT
    // enemies become distinguishable inside the cone.
    plan.reveals = true;
  },
});
