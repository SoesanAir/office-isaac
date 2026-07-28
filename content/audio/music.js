/**
 * Department music. Procedurally sequenced — no binary audio in the repository.
 *
 * GDD refs: 19.3 (department palette, verbatim per department), 19.1 (give each
 *           department a musical identity while maintaining a coherent corporate
 *           score; escalate from mundane office ambience to surreal mechanical and
 *           ownership spaces), 19.2 (music sits at mix priority 5, under every
 *           combat cue), R-AUD-001.
 *
 * Each track is a set of layers that gate in by run state: `ALWAYS` plays in a
 * quiet room, `COMBAT` adds when hostiles are live, `BOSS` only in an arena, and
 * `LOW_HEALTH` adds a final tension layer. Patterns are scale-degree indices
 * (-1 = rest) so one pattern transposes across departments and the score stays
 * recognisably the same company throughout, which is what GDD 19.1 asks for.
 *
 * The escalation from Open Office to Ownership is structural, not just faster: the
 * hidden hierarchy progressively loses layers and settles onto fewer, longer notes
 * until Ownership is almost silent. GDD 19.3 calls for themes that "recombine, lose
 * branding, and become increasingly sparse or impossible".
 */

/** Scale sets, in semitones from the root. */
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12];
const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10, 12];
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const WHOLE_TONE = [0, 2, 4, 6, 8, 10, 12];
const CHROMATIC_FRAGMENT = [0, 1, 2, 3, 6, 7, 8, 11];

const music = [
  {
    id: 'MUS-OPEN_OFFICE',
    nameLoc: 'music.open_office.name',
    // A plodding, workable tempo. Nothing here should feel urgent yet.
    bpm: 96,
    key: 'A',
    scale: MINOR,
    ambienceLoc: 'music.open_office.ambience',
    layers: [
      {
        // "Restrained bass" (GDD 19.3): root and fifth, almost no movement.
        role: 'BASS', voice: 'TRIANGLE', octave: -1, gain: 0.34, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, 4, -1, -1, -1, 0, -1, -1, -1, 2, -1, -1, -1],
      },
      {
        // "Dry percussion from typing and staplers": clicks on the offbeat.
        role: 'PERCUSSION', voice: 'CLICK', octave: 1, gain: 0.2, activeFrom: 'ALWAYS',
        pattern: [-1, 0, -1, 0, -1, 0, -1, 2, -1, 0, -1, 0, -1, 0, -1, 4],
      },
      {
        role: 'PAD', voice: 'SINE', octave: 0, gain: 0.16, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        // Combat adds a stapler-like snap on the beat, so the room reads as hostile
        // before the player has parsed the enemy layout.
        role: 'PERCUSSION', voice: 'SQUARE', octave: 0, gain: 0.22, activeFrom: 'COMBAT',
        pattern: [0, -1, 3, -1, 0, -1, 3, -1, 0, -1, 3, -1, 0, 3, 0, 3],
      },
      {
        role: 'LEAD', voice: 'PLUCK', octave: 1, gain: 0.18, activeFrom: 'COMBAT',
        pattern: [0, 2, 3, 2, 0, -1, 3, -1, 4, 3, 2, 0, -1, -1, -1, -1],
      },
      {
        role: 'TEXTURE', voice: 'NOISE', octave: 0, gain: 0.12, activeFrom: 'LOW_HEALTH',
        pattern: [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, 0, 0, 0],
      },
    ],
  },
  {
    id: 'MUS-IT',
    nameLoc: 'music.it.name',
    bpm: 124,
    key: 'D',
    scale: DORIAN,
    ambienceLoc: 'music.it.ambience',
    layers: [
      {
        // "Low industrial rhythm" and "fan drones".
        role: 'BASS', voice: 'SAW', octave: -1, gain: 0.32, activeFrom: 'ALWAYS',
        pattern: [0, 0, -1, 0, -1, 0, 0, -1, 0, 0, -1, 0, -1, 3, 3, -1],
      },
      {
        // "Digital pulses": a steady sixteenth that never quite resolves.
        role: 'TEXTURE', voice: 'SQUARE', octave: 1, gain: 0.14, activeFrom: 'ALWAYS',
        pattern: [0, -1, 2, -1, 4, -1, 2, -1, 0, -1, 2, -1, 5, -1, 2, -1],
      },
      {
        role: 'PAD', voice: 'FM', octave: 0, gain: 0.15, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, 3, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        // "Electrical transients": sharp, irregular, unmistakably not percussion.
        role: 'PERCUSSION', voice: 'CLICK', octave: 2, gain: 0.2, activeFrom: 'COMBAT',
        pattern: [0, -1, -1, 4, -1, 0, -1, -1, 2, -1, -1, 4, -1, 0, 6, -1],
      },
      {
        role: 'LEAD', voice: 'SQUARE', octave: 1, gain: 0.2, activeFrom: 'COMBAT',
        pattern: [7, 5, 4, 2, 0, 2, 4, 5, 7, -1, 5, -1, 4, 2, -1, -1],
      },
      {
        // "Modem-like artifacts" arrive only when the run is going badly.
        role: 'TEXTURE', voice: 'NOISE', octave: 0, gain: 0.14, activeFrom: 'LOW_HEALTH',
        pattern: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, -1, 0, 0, 0, -1, 0],
      },
    ],
  },
  {
    id: 'MUS-OPERATIONS',
    nameLoc: 'music.operations.name',
    // "Faster mechanical percussion" — the quickest of the core four.
    bpm: 138,
    key: 'E',
    scale: MINOR,
    ambienceLoc: 'music.operations.ambience',
    layers: [
      {
        // "Conveyor rhythm": relentless, never syncopated.
        role: 'PERCUSSION', voice: 'NOISE', octave: 0, gain: 0.22, activeFrom: 'ALWAYS',
        pattern: [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, 0],
      },
      {
        role: 'BASS', voice: 'SQUARE', octave: -1, gain: 0.3, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, 3, -1, -1, 0, -1, 5, -1, -1, 3, -1, -1, 0, -1],
      },
      {
        // "Cart impacts": heavy accents landing off the conveyor pulse.
        role: 'PERCUSSION', voice: 'SAW', octave: 0, gain: 0.2, activeFrom: 'COMBAT',
        pattern: [-1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, 0, -1, 0, -1],
      },
      {
        // "Scanner beeps".
        role: 'LEAD', voice: 'TRIANGLE', octave: 2, gain: 0.16, activeFrom: 'COMBAT',
        pattern: [7, -1, -1, -1, 5, -1, -1, -1, 7, -1, 4, -1, 3, -1, -1, -1],
      },
      {
        role: 'TEXTURE', voice: 'SAW', octave: -2, gain: 0.16, activeFrom: 'LOW_HEALTH',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1],
      },
    ],
  },
  {
    id: 'MUS-EXECUTIVE',
    nameLoc: 'music.executive.name',
    // "Polished minimal music" with "unsettling silence between cues": the slowest
    // core tempo and by far the sparsest patterns.
    bpm: 72,
    key: 'C',
    scale: MAJOR,
    ambienceLoc: 'music.executive.ambience',
    layers: [
      {
        role: 'PAD', voice: 'SINE', octave: 0, gain: 0.2, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        role: 'BASS', voice: 'SINE', octave: -2, gain: 0.28, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        // Expensive materials: a single clean bell, never a rhythm section.
        role: 'LEAD', voice: 'PLUCK', octave: 2, gain: 0.14, activeFrom: 'COMBAT',
        pattern: [4, -1, -1, -1, 2, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        role: 'PERCUSSION', voice: 'CLICK', octave: 1, gain: 0.12, activeFrom: 'COMBAT',
        pattern: [0, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, 0, -1, -1, -1],
      },
      {
        // The polish cracks: a semitone against the major key.
        role: 'TEXTURE', voice: 'SAW', octave: -1, gain: 0.15, activeFrom: 'LOW_HEALTH',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      },
    ],
  },
  {
    id: 'MUS-FINANCE',
    nameLoc: 'music.finance.name',
    bpm: 112,
    key: 'G',
    scale: MINOR,
    ambienceLoc: 'music.finance.ambience',
    layers: [
      {
        // "Counting rhythms" and a "tightening metronome": even, insistent, dry.
        role: 'PERCUSSION', voice: 'CLICK', octave: 1, gain: 0.22, activeFrom: 'ALWAYS',
        pattern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        role: 'BASS', voice: 'TRIANGLE', octave: -1, gain: 0.3, activeFrom: 'ALWAYS',
        pattern: [0, -1, 2, -1, 3, -1, 2, -1, 0, -1, 2, -1, 5, -1, 3, -1],
      },
      {
        // "Coin and receipt textures".
        role: 'LEAD', voice: 'PLUCK', octave: 2, gain: 0.17, activeFrom: 'COMBAT',
        pattern: [0, 3, 5, 3, 0, 3, 5, 7, 5, 3, 0, -1, 2, -1, -1, -1],
      },
      {
        role: 'TEXTURE', voice: 'NOISE', octave: 0, gain: 0.1, activeFrom: 'COMBAT',
        pattern: [-1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0],
      },
      {
        role: 'BOSS', voice: 'SAW', octave: -1, gain: 0.2, activeFrom: 'BOSS',
        pattern: [0, 0, 3, 3, 5, 5, 3, 3, 0, 0, 5, 5, 7, 7, 5, 3],
      },
    ],
  },
  {
    id: 'MUS-MARKETING',
    nameLoc: 'music.marketing.name',
    bpm: 128,
    key: 'F',
    scale: MAJOR,
    ambienceLoc: 'music.marketing.ambience',
    layers: [
      {
        // "Catchy fragments that distort": a genuinely hooky line, deliberately so.
        role: 'LEAD', voice: 'SQUARE', octave: 1, gain: 0.2, activeFrom: 'ALWAYS',
        pattern: [0, 2, 4, 2, 0, -1, 4, -1, 5, 4, 2, 0, -1, -1, -1, -1],
      },
      {
        role: 'BASS', voice: 'SAW', octave: -1, gain: 0.3, activeFrom: 'ALWAYS',
        pattern: [0, -1, 0, -1, 4, -1, 4, -1, 5, -1, 5, -1, 2, -1, 2, -1],
      },
      {
        // "Synthetic gloss".
        role: 'PAD', voice: 'FM', octave: 0, gain: 0.15, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, 4, -1, -1, -1, 5, -1, -1, -1, 2, -1, -1, -1],
      },
      {
        // "Applause samples" stand in as a bright noise burst on the downbeat.
        role: 'PERCUSSION', voice: 'NOISE', octave: 0, gain: 0.18, activeFrom: 'COMBAT',
        pattern: [0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, 0, 0],
      },
      {
        // The distortion: the same hook a semitone out of tune (GDD 19.3).
        role: 'TEXTURE', voice: 'SAW', octave: 1, gain: 0.13, activeFrom: 'LOW_HEALTH',
        pattern: [1, 3, 5, 3, 1, -1, 5, -1, 6, 5, 3, 1, -1, -1, -1, -1],
      },
    ],
  },
  {
    id: 'MUS-LEGAL',
    nameLoc: 'music.legal.name',
    // "Measured pulses" and "delayed impacts": deliberate, never hurried.
    bpm: 84,
    key: 'B',
    scale: PHRYGIAN,
    ambienceLoc: 'music.legal.ambience',
    layers: [
      {
        role: 'BASS', voice: 'SINE', octave: -2, gain: 0.3, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, 1, -1, 0, -1, -1, -1, -1, -1, 3, -1],
      },
      {
        // "Restrained strings" as a slow saw pad.
        role: 'PAD', voice: 'SAW', octave: 0, gain: 0.14, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, 3, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        // "Paper movement" and "seals".
        role: 'PERCUSSION', voice: 'NOISE', octave: 0, gain: 0.16, activeFrom: 'ALWAYS',
        pattern: [-1, -1, 0, -1, -1, -1, -1, 0, -1, -1, 0, -1, -1, -1, -1, 0],
      },
      {
        role: 'LEAD', voice: 'PLUCK', octave: 1, gain: 0.17, activeFrom: 'COMBAT',
        pattern: [0, 1, 3, -1, 5, -1, 3, 1, 0, -1, -1, -1, 3, -1, 1, -1],
      },
      {
        role: 'BOSS', voice: 'SQUARE', octave: -1, gain: 0.2, activeFrom: 'BOSS',
        pattern: [0, -1, 1, -1, 3, -1, 1, -1, 0, -1, 5, -1, 3, -1, 1, -1],
      },
    ],
  },
  {
    id: 'MUS-FACILITIES',
    nameLoc: 'music.facilities.name',
    // Service spaces: almost no melody, just infrastructure.
    bpm: 90,
    key: 'C',
    scale: MINOR,
    ambienceLoc: 'music.facilities.ambience',
    layers: [
      {
        role: 'BASS', voice: 'SAW', octave: -2, gain: 0.34, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        role: 'TEXTURE', voice: 'NOISE', octave: 0, gain: 0.18, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, 0, -1, -1, 0, -1, -1, 0, -1, -1, 0, -1, -1, -1],
      },
      {
        // Dripping water, as an irregular high pluck.
        role: 'PERCUSSION', voice: 'PLUCK', octave: 2, gain: 0.12, activeFrom: 'COMBAT',
        pattern: [-1, -1, -1, 0, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, 0, -1],
      },
    ],
  },
  {
    id: 'MUS-RND',
    nameLoc: 'music.rnd.name',
    // Experimental space, so the scale itself is unstable.
    bpm: 116,
    key: 'F#',
    scale: WHOLE_TONE,
    ambienceLoc: 'music.rnd.ambience',
    layers: [
      {
        role: 'BASS', voice: 'FM', octave: -1, gain: 0.3, activeFrom: 'ALWAYS',
        pattern: [0, -1, 2, -1, -1, 4, -1, -1, 0, -1, 3, -1, -1, 5, -1, -1],
      },
      {
        role: 'TEXTURE', voice: 'FM', octave: 2, gain: 0.14, activeFrom: 'ALWAYS',
        pattern: [0, 3, -1, 5, -1, 1, 4, -1, 2, -1, 5, -1, 0, -1, -1, 3],
      },
      {
        role: 'LEAD', voice: 'SQUARE', octave: 1, gain: 0.18, activeFrom: 'COMBAT',
        pattern: [5, 3, 0, 3, 5, -1, 2, -1, 4, 2, 0, -1, 5, -1, -1, -1],
      },
      {
        role: 'PERCUSSION', voice: 'CLICK', octave: 1, gain: 0.16, activeFrom: 'COMBAT',
        pattern: [0, -1, 0, -1, -1, 0, -1, 0, 0, -1, -1, 0, -1, 0, 0, -1],
      },
    ],
  },
  {
    id: 'MUS-BOARD',
    nameLoc: 'music.board.name',
    // Post-CEO. The corporate score is still recognisable but has lost its polish.
    bpm: 78,
    key: 'A',
    scale: PHRYGIAN,
    ambienceLoc: 'music.board.ambience',
    layers: [
      {
        role: 'BASS', voice: 'SINE', octave: -2, gain: 0.36, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        role: 'PAD', voice: 'SAW', octave: -1, gain: 0.16, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, 3, -1, -1, -1, -1, -1, 1, -1, -1, -1],
      },
      {
        // A vote, as a struck chord tone. Ties into BSS-025's vote mechanic.
        role: 'PERCUSSION', voice: 'SQUARE', octave: 0, gain: 0.18, activeFrom: 'COMBAT',
        pattern: [0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, 0, 0, -1],
      },
      {
        role: 'BOSS', voice: 'SAW', octave: 0, gain: 0.22, activeFrom: 'BOSS',
        pattern: [0, 1, 3, 1, 0, -1, 5, -1, 7, 5, 3, 1, 0, -1, -1, -1],
      },
    ],
  },
  {
    id: 'MUS-PARENT_COMPANY',
    nameLoc: 'music.parent_company.name',
    // "A clean, anonymous complex whose branding contradicts the known company"
    // (Appendix A). Sanitised: major key, but hollowed out.
    bpm: 68,
    key: 'Eb',
    scale: MAJOR,
    ambienceLoc: 'music.parent_company.ambience',
    layers: [
      {
        role: 'PAD', voice: 'SINE', octave: 0, gain: 0.18, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        role: 'BASS', voice: 'SINE', octave: -2, gain: 0.26, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1],
      },
      {
        role: 'BOSS', voice: 'PLUCK', octave: 1, gain: 0.16, activeFrom: 'BOSS',
        pattern: [0, -1, 2, -1, 4, -1, 2, -1, 0, -1, -1, -1, -1, -1, -1, -1],
      },
    ],
  },
  {
    id: 'MUS-CONGLOMERATE',
    nameLoc: 'music.conglomerate.name',
    // "Architecture from multiple companies at once": every earlier department's
    // interval language colliding, hence the chromatic fragment.
    bpm: 104,
    key: 'D',
    scale: CHROMATIC_FRAGMENT,
    ambienceLoc: 'music.conglomerate.ambience',
    layers: [
      {
        role: 'BASS', voice: 'SAW', octave: -2, gain: 0.32, activeFrom: 'ALWAYS',
        pattern: [0, -1, 3, -1, 6, -1, 3, -1, 0, -1, 4, -1, 7, -1, 4, -1],
      },
      {
        role: 'TEXTURE', voice: 'FM', octave: 1, gain: 0.15, activeFrom: 'ALWAYS',
        pattern: [0, 2, -1, 5, -1, 3, 6, -1, 1, -1, 4, -1, 7, -1, 2, -1],
      },
      {
        role: 'PERCUSSION', voice: 'NOISE', octave: 0, gain: 0.2, activeFrom: 'COMBAT',
        pattern: [0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0],
      },
      {
        role: 'BOSS', voice: 'SQUARE', octave: 0, gain: 0.22, activeFrom: 'BOSS',
        pattern: [7, 6, 4, 3, 2, 1, 0, -1, 7, 6, 4, 3, 2, 1, 0, -1],
      },
    ],
  },
  {
    id: 'MUS-OWNERSHIP',
    nameLoc: 'music.ownership.name',
    /**
     * "Minimal, luxurious, almost empty space above every known hierarchy"
     * (Appendix A). BSS-029 removes layers until only movement and core weapon
     * skill remain, so the music does the same: two voices, one note each, and no
     * combat layer at all. The absence is the point.
     */
    bpm: 56,
    key: 'A',
    scale: MINOR,
    ambienceLoc: 'music.ownership.ambience',
    layers: [
      {
        role: 'PAD', voice: 'SINE', octave: -1, gain: 0.16, activeFrom: 'ALWAYS',
        pattern: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      },
      {
        role: 'BASS', voice: 'SINE', octave: -2, gain: 0.2, activeFrom: 'ALWAYS',
        pattern: [-1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1],
      },
    ],
  },
];

export default music;
