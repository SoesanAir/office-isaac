/**
 * Sound effects. All procedurally synthesised — no binary audio in the repository.
 *
 * GDD refs: 19.1 (turn office sounds into rhythm and texture; a sound can be funny
 *           once and still has to survive the thousandth run), 19.2 (mix priority
 *           1-6), R-AUD-001 (critical attack cues stay audible above music at the
 *           default mix), R-AUD-002 (repeated weapon sounds support high cadence
 *           without harsh stacking — variation, pooling, concurrency limits),
 *           R-AUD-003 (audio-only cues have captions or visual equivalents),
 *           R-AUD-004 (secret discoveries get a unique confirmation sting).
 *
 * `mixPriority` maps directly onto GDD 19.2's numbered list, and the mixer ducks
 * higher numbers under lower ones. That ordering is why a stapler volley can never
 * bury the sound of the player taking damage.
 *
 * `maxConcurrent` is the R-AUD-002 safeguard: a 0.05s keyboard tap at maximum
 * cadence with Ctrl+C and Dual Monitors would otherwise try to start dozens of
 * identical voices per second and turn into white noise. `detuneCents` supplies the
 * variation that keeps a repeated cue from sounding mechanical.
 */

/** Terse builder so the table below stays readable. */
function sfx(id, spec) {
  return {
    id,
    voice: spec.voice,
    duration: spec.duration,
    gain: spec.gain,
    mixPriority: spec.priority,
    maxConcurrent: spec.max ?? 4,
    ...(spec.freq !== undefined ? { frequency: spec.freq } : {}),
    ...(spec.freqEnd !== undefined ? { frequencyEnd: spec.freqEnd } : {}),
    ...(spec.attack !== undefined ? { attack: spec.attack } : {}),
    ...(spec.decay !== undefined ? { decay: spec.decay } : {}),
    ...(spec.filter ? { filter: spec.filter } : {}),
    ...(spec.detune !== undefined ? { detuneCents: spec.detune } : {}),
    ...(spec.caption ? { captionLoc: spec.caption } : {}),
  };
}

const sounds = [
  // -------------------------------------------------------------------------
  // Priority 1: player damage and imminent lethal danger (GDD 19.2)
  // -------------------------------------------------------------------------
  sfx('SFX-PLAYER_HURT', {
    voice: 'SAW', freq: 320, freqEnd: 90, duration: 0.26, attack: 0.001, decay: 0.22,
    gain: 0.75, priority: 1, max: 2, filter: { type: 'lowpass', frequency: 2200, q: 1.2 },
    caption: 'caption.player_hurt',
  }),
  sfx('SFX-PLAYER_DEATH', {
    voice: 'SAW', freq: 220, freqEnd: 40, duration: 1.4, attack: 0.005, decay: 1.3,
    gain: 0.8, priority: 1, max: 1, filter: { type: 'lowpass', frequency: 1400, q: 0.8 },
    caption: 'caption.player_death',
  }),
  sfx('SFX-LOW_HEALTH', {
    // A slow heartbeat thud, not an alarm. GDD 19.1 wants this survivable at run
    // one thousand, and a beeping alarm is not.
    voice: 'SINE', freq: 90, freqEnd: 55, duration: 0.32, attack: 0.01, decay: 0.28,
    gain: 0.5, priority: 1, max: 1, caption: 'caption.low_health',
  }),
  sfx('SFX-SHIELD_BREAK', {
    voice: 'NOISE', duration: 0.4, attack: 0.001, decay: 0.36, gain: 0.62, priority: 1,
    max: 2, filter: { type: 'highpass', frequency: 1800, q: 1.5 }, caption: 'caption.shield_break',
  }),
  sfx('SFX-SPITE_BURST', {
    voice: 'FM', freq: 180, freqEnd: 620, duration: 0.5, attack: 0.002, decay: 0.44,
    gain: 0.7, priority: 1, max: 2, caption: 'caption.spite_burst',
  }),

  // -------------------------------------------------------------------------
  // Priority 2: enemy telegraphs and boss phase cues
  // -------------------------------------------------------------------------
  sfx('SFX-TELEGRAPH_GENERIC', {
    voice: 'TRIANGLE', freq: 480, freqEnd: 760, duration: 0.3, attack: 0.02, decay: 0.2,
    gain: 0.5, priority: 2, max: 6, detune: 60, caption: 'caption.telegraph',
  }),
  sfx('SFX-TELEGRAPH_CHARGE', {
    voice: 'SAW', freq: 140, freqEnd: 420, duration: 0.55, attack: 0.05, decay: 0.3,
    gain: 0.55, priority: 2, max: 4, caption: 'caption.charge_windup',
  }),
  sfx('SFX-TELEGRAPH_SLAM', {
    voice: 'SQUARE', freq: 200, freqEnd: 120, duration: 0.42, attack: 0.03, decay: 0.3,
    gain: 0.58, priority: 2, max: 4, caption: 'caption.slam_windup',
  }),
  sfx('SFX-COFFEE_SPRINTER_SHAKE', {
    // ENM-004's tell: a rattling cup. Deliberately distinct from every other
    // wind-up, because GDD 14.3 says audio supplements but never replaces the
    // visual telegraph, and a shared cue would make two enemies sound identical.
    voice: 'NOISE', duration: 0.34, attack: 0.01, decay: 0.3, gain: 0.45, priority: 2,
    max: 5, filter: { type: 'bandpass', frequency: 2600, q: 4 }, detune: 120,
    caption: 'caption.sprinter_shake',
  }),
  sfx('SFX-PRINTER_WINDUP', {
    voice: 'SAW', freq: 90, freqEnd: 240, duration: 0.7, attack: 0.08, decay: 0.4,
    gain: 0.5, priority: 2, max: 3, filter: { type: 'lowpass', frequency: 1600, q: 2 },
    caption: 'caption.printer_windup',
  }),
  sfx('SFX-SHOCK_ARM', {
    voice: 'SQUARE', freq: 900, freqEnd: 1500, duration: 0.24, attack: 0.005, decay: 0.2,
    gain: 0.48, priority: 2, max: 6, caption: 'caption.shock_arming',
  }),
  sfx('SFX-BOSS_PHASE', {
    voice: 'FM', freq: 110, freqEnd: 330, duration: 1.1, attack: 0.02, decay: 0.9,
    gain: 0.72, priority: 2, max: 1, caption: 'caption.boss_phase',
  }),
  sfx('SFX-BOSS_INTRO', {
    voice: 'SAW', freq: 60, freqEnd: 180, duration: 1.8, attack: 0.2, decay: 1.4,
    gain: 0.75, priority: 2, max: 1, caption: 'caption.boss_intro',
  }),
  sfx('SFX-BOSS_DEATH', {
    voice: 'NOISE', duration: 1.6, attack: 0.01, decay: 1.5, gain: 0.78, priority: 2,
    max: 1, filter: { type: 'lowpass', frequency: 900, q: 1 }, caption: 'caption.boss_death',
  }),

  // -------------------------------------------------------------------------
  // Priority 3: player weapon cadence, active use, impact confirmation
  // -------------------------------------------------------------------------
  // Detune plus a low concurrency cap is the R-AUD-002 answer for tap-fire weapons.
  sfx('SFX-WPN_KEYBOARD', {
    voice: 'CLICK', freq: 1400, duration: 0.06, attack: 0.001, decay: 0.05,
    gain: 0.34, priority: 3, max: 5, detune: 180,
  }),
  sfx('SFX-WPN_KEYBOARD_MECH', {
    // ITM-004 Mechanical Switches uses a distinct click sample (Appendix C.2).
    voice: 'CLICK', freq: 2100, duration: 0.05, attack: 0.001, decay: 0.04,
    gain: 0.36, priority: 3, max: 5, detune: 140,
  }),
  sfx('SFX-WPN_MOUSE_SWING', {
    voice: 'NOISE', duration: 0.16, attack: 0.005, decay: 0.13, gain: 0.4, priority: 3,
    max: 4, filter: { type: 'bandpass', frequency: 1800, q: 2 }, detune: 100,
  }),
  sfx('SFX-WPN_STAPLER', {
    voice: 'CLICK', freq: 620, duration: 0.1, attack: 0.001, decay: 0.09, gain: 0.5,
    priority: 3, max: 4, detune: 80,
  }),
  sfx('SFX-WPN_STAPLER_RELOAD', {
    voice: 'PLUCK', freq: 340, duration: 0.22, attack: 0.005, decay: 0.2, gain: 0.4,
    priority: 3, max: 2,
  }),
  sfx('SFX-WPN_HOLE_PUNCH', {
    voice: 'CLICK', freq: 480, duration: 0.09, attack: 0.001, decay: 0.08, gain: 0.46,
    priority: 3, max: 4, detune: 90,
  }),
  sfx('SFX-WPN_MARKER', {
    voice: 'TRIANGLE', freq: 700, freqEnd: 460, duration: 0.14, attack: 0.005, decay: 0.12,
    gain: 0.36, priority: 3, max: 5, detune: 120,
  }),
  sfx('SFX-WPN_STAMP', {
    voice: 'SQUARE', freq: 150, freqEnd: 80, duration: 0.2, attack: 0.002, decay: 0.17,
    gain: 0.56, priority: 3, max: 3,
  }),
  sfx('SFX-WPN_SHREDDER', {
    // Sustained weapons use one long looping voice rather than many short ones,
    // which is the only way GDD 7.5's "many small hits" stays listenable.
    voice: 'NOISE', duration: 0.5, attack: 0.04, decay: 0.1, gain: 0.3, priority: 3,
    max: 1, filter: { type: 'highpass', frequency: 2400, q: 1 },
  }),
  sfx('SFX-WPN_BEAM', {
    voice: 'SINE', freq: 880, duration: 0.5, attack: 0.05, decay: 0.1, gain: 0.28,
    priority: 3, max: 1, filter: { type: 'bandpass', frequency: 1200, q: 3 },
  }),
  sfx('SFX-WPN_REMOTE', {
    voice: 'CLICK', freq: 1100, duration: 0.07, attack: 0.001, decay: 0.06, gain: 0.38,
    priority: 3, max: 4, detune: 100,
  }),
  sfx('SFX-WPN_PHONE_THROW', {
    voice: 'PLUCK', freq: 420, freqEnd: 260, duration: 0.28, attack: 0.005, decay: 0.24,
    gain: 0.44, priority: 3, max: 3,
  }),
  sfx('SFX-WPN_LABEL_CHARGE', {
    voice: 'SAW', freq: 300, freqEnd: 900, duration: 0.6, attack: 0.05, decay: 0.1,
    gain: 0.3, priority: 3, max: 1,
  }),
  sfx('SFX-WPN_COPIER_WAVE', {
    voice: 'NOISE', duration: 0.45, attack: 0.02, decay: 0.4, gain: 0.42, priority: 3,
    max: 2, filter: { type: 'lowpass', frequency: 1200, q: 1.4 },
  }),
  sfx('SFX-WPN_FAN', {
    voice: 'NOISE', duration: 0.5, attack: 0.08, decay: 0.1, gain: 0.24, priority: 3,
    max: 1, filter: { type: 'lowpass', frequency: 700, q: 0.9 },
  }),
  sfx('SFX-WPN_PROJECTOR', {
    voice: 'FM', freq: 260, freqEnd: 340, duration: 0.4, attack: 0.03, decay: 0.3,
    gain: 0.34, priority: 3, max: 2,
  }),
  sfx('SFX-IMPACT_SOFT', {
    voice: 'CLICK', freq: 300, duration: 0.06, attack: 0.001, decay: 0.05, gain: 0.3,
    priority: 3, max: 8, detune: 200,
  }),
  sfx('SFX-IMPACT_HARD', {
    voice: 'NOISE', duration: 0.12, attack: 0.001, decay: 0.11, gain: 0.44, priority: 3,
    max: 6, filter: { type: 'lowpass', frequency: 2600, q: 1 }, detune: 150,
  }),
  sfx('SFX-IMPACT_CRIT', {
    voice: 'FM', freq: 520, freqEnd: 1040, duration: 0.18, attack: 0.001, decay: 0.16,
    gain: 0.55, priority: 3, max: 3,
  }),
  sfx('SFX-ENEMY_DEATH', {
    voice: 'NOISE', duration: 0.3, attack: 0.002, decay: 0.27, gain: 0.42, priority: 3,
    max: 6, filter: { type: 'lowpass', frequency: 1600, q: 1.2 }, detune: 160,
  }),
  sfx('SFX-ACTIVE_USE', {
    voice: 'FM', freq: 400, freqEnd: 900, duration: 0.4, attack: 0.005, decay: 0.35,
    gain: 0.58, priority: 3, max: 2, caption: 'caption.active_used',
  }),
  sfx('SFX-CARD_USE', {
    voice: 'PLUCK', freq: 660, freqEnd: 880, duration: 0.3, attack: 0.005, decay: 0.26,
    gain: 0.5, priority: 3, max: 2, caption: 'caption.card_used',
  }),
  sfx('SFX-TONER_FUSE', {
    voice: 'NOISE', duration: 0.6, attack: 0.05, decay: 0.5, gain: 0.4, priority: 3,
    max: 3, filter: { type: 'highpass', frequency: 3000, q: 2 }, caption: 'caption.toner_fuse',
  }),
  sfx('SFX-TONER_BLAST', {
    voice: 'NOISE', duration: 0.7, attack: 0.001, decay: 0.68, gain: 0.8, priority: 3,
    max: 3, filter: { type: 'lowpass', frequency: 800, q: 0.9 }, caption: 'caption.toner_blast',
  }),

  // -------------------------------------------------------------------------
  // Priority 4: door state, room clear, reward, secret, elevator
  // -------------------------------------------------------------------------
  sfx('SFX-DOOR_SEAL', {
    // GDD 3.2 names locked doors as the tension tool of the combat phase, so this
    // is deliberately heavier than the unseal.
    voice: 'SQUARE', freq: 180, freqEnd: 70, duration: 0.4, attack: 0.005, decay: 0.36,
    gain: 0.6, priority: 4, max: 2, caption: 'caption.doors_sealed',
  }),
  sfx('SFX-DOOR_UNSEAL', {
    voice: 'PLUCK', freq: 260, freqEnd: 520, duration: 0.34, attack: 0.005, decay: 0.3,
    gain: 0.56, priority: 4, max: 2, caption: 'caption.doors_open',
  }),
  sfx('SFX-DOOR_LOCKED', {
    voice: 'SQUARE', freq: 140, duration: 0.14, attack: 0.002, decay: 0.12, gain: 0.45,
    priority: 4, max: 2, caption: 'caption.door_locked',
  }),
  sfx('SFX-BADGE_SPEND', {
    voice: 'CLICK', freq: 1600, duration: 0.09, attack: 0.001, decay: 0.08, gain: 0.42,
    priority: 4, max: 2, caption: 'caption.badge_spent',
  }),
  sfx('SFX-ROOM_CLEAR', {
    voice: 'PLUCK', freq: 520, freqEnd: 780, duration: 0.5, attack: 0.005, decay: 0.45,
    gain: 0.6, priority: 4, max: 1, caption: 'caption.room_cleared',
  }),
  sfx('SFX-PICKUP_CREDIT', {
    voice: 'CLICK', freq: 1900, duration: 0.07, attack: 0.001, decay: 0.06, gain: 0.36,
    priority: 4, max: 6, detune: 200,
  }),
  sfx('SFX-PICKUP_HEALTH', {
    voice: 'SINE', freq: 620, freqEnd: 930, duration: 0.26, attack: 0.005, decay: 0.22,
    gain: 0.5, priority: 4, max: 3, caption: 'caption.health_gained',
  }),
  sfx('SFX-PICKUP_GENERIC', {
    voice: 'PLUCK', freq: 740, duration: 0.16, attack: 0.002, decay: 0.14, gain: 0.42,
    priority: 4, max: 4, detune: 120,
  }),
  sfx('SFX-ITEM_COLLECT', {
    // The pedestal moment. GDD 3.2 calls this the anticipation beat, so it is the
    // longest non-boss cue in the game.
    voice: 'FM', freq: 330, freqEnd: 990, duration: 0.9, attack: 0.01, decay: 0.8,
    gain: 0.68, priority: 4, max: 1, caption: 'caption.item_collected',
  }),
  sfx('SFX-PURCHASE', {
    voice: 'CLICK', freq: 1200, duration: 0.12, attack: 0.001, decay: 0.11, gain: 0.44,
    priority: 4, max: 2, caption: 'caption.purchased',
  }),
  sfx('SFX-SECRET_FOUND', {
    /**
     * R-AUD-004: the one cue that must be unmistakable. A long rising FM chime,
     * cleaner and far longer than any object break, so a player can tell a
     * successful blast from ordinary destruction without looking at the screen.
     */
    voice: 'FM', freq: 440, freqEnd: 1760, duration: 1.3, attack: 0.01, decay: 1.2,
    gain: 0.75, priority: 4, max: 1, caption: 'caption.secret_found',
  }),
  sfx('SFX-ELEVATOR_ARRIVE', {
    voice: 'SINE', freq: 300, freqEnd: 200, duration: 0.8, attack: 0.05, decay: 0.7,
    gain: 0.5, priority: 4, max: 1, caption: 'caption.elevator_arrive',
  }),
  sfx('SFX-ELEVATOR_DEPART', {
    voice: 'SAW', freq: 80, freqEnd: 160, duration: 1.6, attack: 0.3, decay: 1.2,
    gain: 0.48, priority: 4, max: 1, caption: 'caption.elevator_depart',
  }),
  sfx('SFX-UNLOCK_GRANTED', {
    voice: 'FM', freq: 520, freqEnd: 1040, duration: 0.7, attack: 0.01, decay: 0.62,
    gain: 0.6, priority: 4, max: 1, caption: 'caption.unlock_granted',
  }),
  sfx('SFX-OBJECT_BREAK_LIGHT', {
    voice: 'NOISE', duration: 0.2, attack: 0.001, decay: 0.18, gain: 0.4, priority: 4,
    max: 5, filter: { type: 'highpass', frequency: 1600, q: 1.2 }, detune: 200,
  }),
  sfx('SFX-OBJECT_BREAK_HEAVY', {
    voice: 'NOISE', duration: 0.42, attack: 0.001, decay: 0.4, gain: 0.55, priority: 4,
    max: 4, filter: { type: 'lowpass', frequency: 1100, q: 1 }, detune: 140,
  }),
  sfx('SFX-GLASS_SHATTER', {
    voice: 'NOISE', duration: 0.5, attack: 0.001, decay: 0.48, gain: 0.5, priority: 4,
    max: 4, filter: { type: 'highpass', frequency: 3600, q: 2 }, detune: 220,
  }),
  sfx('SFX-MACHINE_VEND', {
    voice: 'SQUARE', freq: 220, freqEnd: 330, duration: 0.5, attack: 0.02, decay: 0.44,
    gain: 0.44, priority: 4, max: 2, caption: 'caption.machine_dispense',
  }),
  sfx('SFX-MACHINE_FAIL', {
    voice: 'SQUARE', freq: 200, freqEnd: 110, duration: 0.34, attack: 0.01, decay: 0.3,
    gain: 0.44, priority: 4, max: 2, caption: 'caption.machine_jammed',
  }),

  // -------------------------------------------------------------------------
  // Priority 5: department ambience and transition stings (GDD 19.3)
  // -------------------------------------------------------------------------
  // Ambience beds are long, quiet, single-voice drones. The department character
  // comes from the filter, not the volume, so ambience can never crowd a telegraph.
  ...[
    ['OPEN_OFFICE', 'NOISE', 0.10, { type: 'bandpass', frequency: 320, q: 0.7 }],
    ['IT', 'SAW', 0.11, { type: 'lowpass', frequency: 240, q: 1.4 }],
    ['OPERATIONS', 'NOISE', 0.12, { type: 'lowpass', frequency: 420, q: 1.1 }],
    ['EXECUTIVE', 'SINE', 0.07, { type: 'lowpass', frequency: 180, q: 0.6 }],
    ['FINANCE', 'TRIANGLE', 0.09, { type: 'bandpass', frequency: 520, q: 1.8 }],
    ['MARKETING', 'SQUARE', 0.09, { type: 'bandpass', frequency: 760, q: 2.4 }],
    ['LEGAL', 'NOISE', 0.08, { type: 'lowpass', frequency: 300, q: 0.9 }],
    ['FACILITIES', 'NOISE', 0.13, { type: 'lowpass', frequency: 200, q: 1.6 }],
    ['RND', 'FM', 0.10, { type: 'bandpass', frequency: 900, q: 3 }],
    ['BOARD', 'SINE', 0.08, { type: 'lowpass', frequency: 120, q: 0.7 }],
    ['PARENT_COMPANY', 'SINE', 0.06, { type: 'lowpass', frequency: 150, q: 0.5 }],
    ['CONGLOMERATE', 'SAW', 0.10, { type: 'bandpass', frequency: 400, q: 2.2 }],
    ['OWNERSHIP', 'SINE', 0.05, { type: 'lowpass', frequency: 100, q: 0.4 }],
  ].map(([dept, voice, gain, filter]) => sfx(`SFX-AMB_${dept}`, {
    voice, duration: 4.0, attack: 1.2, decay: 1.2, gain, priority: 5, max: 1, filter,
  })),

  // Stings mark a chapter change. GDD 10.2 wants the department transition to feel
  // stronger than floor I -> II, so these are the longest cues in the file.
  ...[
    ['OPEN_OFFICE', 'PLUCK', 330, 660],
    ['IT', 'SQUARE', 220, 880],
    ['OPERATIONS', 'SAW', 165, 495],
    ['EXECUTIVE', 'SINE', 440, 550],
    ['FINANCE', 'TRIANGLE', 392, 784],
    ['MARKETING', 'SQUARE', 523, 1046],
    ['LEGAL', 'PLUCK', 294, 392],
    ['FACILITIES', 'NOISE', 110, 110],
    ['RND', 'FM', 370, 1480],
    ['BOARD', 'SINE', 110, 165],
    // The hidden hierarchy loses its branding as it climbs (GDD 19.3), so these
    // stings descend and thin out instead of resolving upward.
    ['PARENT_COMPANY', 'SINE', 220, 110],
    ['CONGLOMERATE', 'SAW', 330, 82],
    ['OWNERSHIP', 'SINE', 55, 55],
  ].map(([dept, voice, freq, freqEnd]) => sfx(`SFX-STING_${dept}`, {
    voice, freq, freqEnd, duration: 2.2, attack: 0.02, decay: 2.0, gain: 0.55,
    priority: 5, max: 1, caption: `caption.sting_${dept.toLowerCase()}`,
  })),

  // -------------------------------------------------------------------------
  // Priority 6: decorative props and non-essential chatter
  // -------------------------------------------------------------------------
  sfx('SFX-PROP_PHONE_DISTANT', {
    voice: 'TRIANGLE', freq: 800, freqEnd: 800, duration: 0.5, attack: 0.02, decay: 0.4,
    gain: 0.14, priority: 6, max: 1,
  }),
  sfx('SFX-PROP_KEYBOARD_DISTANT', {
    voice: 'CLICK', freq: 1200, duration: 0.05, attack: 0.001, decay: 0.04, gain: 0.1,
    priority: 6, max: 3, detune: 300,
  }),
  sfx('SFX-PROP_FLUORESCENT_BUZZ', {
    voice: 'SQUARE', freq: 100, duration: 2.0, attack: 0.5, decay: 0.5, gain: 0.07,
    priority: 6, max: 1, filter: { type: 'bandpass', frequency: 3000, q: 6 },
  }),
  sfx('SFX-PROP_VENT', {
    voice: 'NOISE', duration: 3.0, attack: 0.8, decay: 0.8, gain: 0.09, priority: 6,
    max: 1, filter: { type: 'lowpass', frequency: 500, q: 0.8 },
  }),
  sfx('SFX-UI_MOVE', {
    voice: 'CLICK', freq: 900, duration: 0.04, attack: 0.001, decay: 0.03, gain: 0.28,
    priority: 6, max: 2,
  }),
  sfx('SFX-UI_CONFIRM', {
    voice: 'PLUCK', freq: 660, duration: 0.12, attack: 0.002, decay: 0.11, gain: 0.36,
    priority: 6, max: 2,
  }),
  sfx('SFX-UI_BACK', {
    voice: 'PLUCK', freq: 330, duration: 0.12, attack: 0.002, decay: 0.11, gain: 0.32,
    priority: 6, max: 2,
  }),
];

export default sounds;
