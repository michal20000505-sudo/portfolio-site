/**
 * archive.js — the single source of narrative truth.
 *
 * Every number on the site derives from these constants so the fiction stays
 * internally consistent. If you change DISTANCE_LY, the transmission age, the
 * arrival estimate and the star-map labels all follow.
 */

/* ── Primary record ─────────────────────────────────────────────────────── */

export const RECORD = {
  designation: 'TLS-4812',
  catalogue: 'VELA / UNLISTED',
  distanceLy: 4812,
  /** Right ascension, declination — fixed, but rendered with live jitter. */
  ra: { h: 9, m: 27, s: 41.6 },
  dec: { d: -54, m: 18, s: 7.2 },
  frequencyMHz: 1420.405,
  noiseFloorDbm: -118.4,
  acquiredUtc: '2031-03-11T02:47:19Z',
  sourceStatus: 'EXTINCT',
  collapseClass: 'TYPE II-P / CORE COLLAPSE',
  classification: 'ARCHIVE / RESTRICTED / PERMANENT',
  responseArrivalYears: 9624,
};

/** Telemetry rendered in Chapter 00. Values marked `live` drift each frame. */
export const TELEMETRY = [
  { key: 'signal', label: 'Signal strength', value: '−118.4 dBm', live: 'signal' },
  { key: 'received', label: 'Reception', value: '2031·03·11 · 02:47:19 UTC' },
  { key: 'ra', label: 'Right ascension', value: '09h 27m 41.6s', live: 'ra' },
  { key: 'dec', label: 'Declination', value: '−54° 18′ 07.2″', live: 'dec' },
  { key: 'distance', label: 'Estimated distance', value: '4,812 ly' },
  { key: 'status', label: 'Source status', value: 'EXTINCT', tone: 'warn' },
  { key: 'age', label: 'Transmission age', value: '4,812 years' },
  { key: 'class', label: 'Classification', value: 'ARCHIVE / RESTRICTED' },
];

/* ── Chapter 01: the four observed states of the source ─────────────────── */

export const SOURCE_STATES = [
  {
    id: 'observed',
    index: '01.1',
    label: 'Observed',
    note: 'Recorded through 4,812 years of intervening dust. Everything here is late.',
  },
  {
    id: 'reconstructed',
    index: '01.2',
    label: 'Reconstructed',
    note: 'Extinction removed. Granulation resolved to 41 km. This is the star as it was seen by no one.',
  },
  {
    id: 'collapse',
    index: '01.3',
    label: 'Collapse',
    note: 'Core failure at T+0. The photosphere had nine minutes left and did not know it.',
  },
  {
    id: 'origin',
    index: '01.4',
    label: 'Origin point',
    note: 'The transmission left from here, 71 hours before the light did.',
  },
];

/* ── Chapter 02: fragments of the transmission itself ───────────────────── */

export const TRANSMISSION_TOKENS = [
  { t: 'ᛜ ᛝ ᛡ', kind: 'glyph' },
  { t: '…still receiving?', kind: 'translated' },
  { t: '0x7F41 0x0000 0x7F41', kind: 'numeric' },
  { t: 'we cou—', kind: 'partial' },
  { t: '△ ▽ △ ▽ △', kind: 'glyph' },
  { t: 'ERR: TIMESTAMP BEFORE EPOCH', kind: 'corrupt' },
  { t: 'the water is', kind: 'partial' },
  { t: '1 1 2 3 5 8 13 21', kind: 'numeric' },
  { t: '⟟ ⏃ ⌇ ⏁', kind: 'glyph' },
  { t: 'nine hundred and ——', kind: 'partial' },
  { t: 'do not answer / answer', kind: 'translated' },
  { t: '−0000-00-00T00:00:00Z', kind: 'corrupt' },
  { t: 'ᚦ ᚨ ᚱ', kind: 'glyph' },
  { t: '…if anything is left…', kind: 'translated' },
  { t: '2.718 3.141 1.618', kind: 'numeric' },
];

export const TRANSMISSION_BANDS = [
  { hz: 1420.1, label: 'CARRIER' },
  { hz: 1420.4, label: 'PRIMARY' },
  { hz: 1420.9, label: 'HARMONIC' },
  { hz: 1421.6, label: 'ARTEFACT' },
];

/* ── Chapter 03: the recovered archive ──────────────────────────────────── */

export const FRAGMENTS = [
  {
    id: '07',
    title: 'Atmospheric recording',
    visual: 'spectrogram',
    integrity: 0.62,
    duration: '00:04:11',
    medium: 'Pressure-modulated carrier',
    stamp: 'REC · 4812 BP ± 40',
    note:
      'Four minutes of an atmosphere moving. Wind, most probably. Twice, something crosses the ' +
      'microphone and the recording level drops — an object, or a body, or weather.',
    /** Position in the archive field, in viewport-relative units. */
    x: -0.201, y: 0.056, depth: 0.35, rot: -2.4,
  },
  {
    id: '12',
    title: 'Unknown orbital structure',
    visual: 'orbital',
    integrity: 0.81,
    duration: '—',
    medium: 'Occultation photometry',
    stamp: 'DERIVED · 2031',
    note:
      'Periodic dimming that no natural body accounts for. The structure is thin, wide, and ' +
      'held in an orbit too circular to be debris. It was still there when the star died.',
    x: 0.236, y: -0.278, depth: 0.72, rot: 1.6,
  },
  {
    id: '19',
    title: 'Repeating biological pattern',
    visual: 'lattice',
    integrity: 0.44,
    duration: '—',
    medium: 'Encoded raster, 233 × 233',
    stamp: 'PARTIAL RECOVERY',
    note:
      'A lattice that repeats at prime intervals and then, without warning, stops repeating. ' +
      'Growth, or a script, or a map of something that grew. The distinction may not have existed for them.',
    x: -0.025, y: 0.252, depth: 0.52, rot: 3.1,
  },
  {
    id: '24',
    title: 'Final translated sentence',
    visual: 'plate',
    integrity: 0.97,
    duration: '—',
    medium: 'Phase-encoded text',
    stamp: 'VERIFIED · 3 PASSES',
    note:
      'The last complete grammatical unit in the transmission. It arrives after eleven minutes ' +
      'of silence and is not repeated.',
    x: 0.319, y: 0.189, depth: 0.90, rot: -1.1,
  },
  {
    id: '31',
    title: 'Unverified visual reconstruction',
    visual: 'reconstruction',
    integrity: 0.19,
    duration: '—',
    medium: 'Inferred — do not cite',
    stamp: 'UNVERIFIED',
    note:
      'Assembled from amplitude residue by a process that is permitted to guess. Nineteen percent ' +
      'of this image is recovered. The rest is the archive imagining what it wants to see.',
    x: 0.076, y: -0.033, depth: 0.14, rot: 0.6,
  },
];

/** Unlocked only by listening to the decoded message long enough to sit with it. */
export const HIDDEN_FRAGMENT = {
  id: '00',
  title: 'First acquisition',
  visual: 'firstlight',
  integrity: 1.0,
  duration: '00:00:02',
  medium: 'Unmodulated carrier',
  stamp: 'RESTORED BY PATIENCE',
  note:
    'Two seconds of clean tone before the message begins. No content, no encoding. ' +
    'They were checking whether the channel existed at all.',
  x: 0.167, y: 0.240, depth: 1.0, rot: -0.4,
  hidden: true,
};

/* ── Chapter 04: the decode ─────────────────────────────────────────────── */

export const DECODE = {
  message: 'WE LOOKED FOR YOU UNTIL THE LIGHT RAN OUT.',
  /** Slider definitions. `target` is the value that resolves the message. */
  controls: [
    { id: 'frequency', label: 'Frequency', unit: 'MHz', min: 1418.0, max: 1422.8, step: 0.1, start: 1418.6, target: 1420.4, tolerance: 0.34 },
    { id: 'phase', label: 'Phase', unit: '°', min: 0, max: 359, step: 1, start: 44, target: 137, tolerance: 22 },
    { id: 'alignment', label: 'Alignment', unit: '', min: -1, max: 1, step: 0.01, start: -0.62, target: 0, tolerance: 0.16 },
  ],
  hints: {
    frequency: 'Neutral hydrogen sits at 1420.4. Anyone signalling across this distance would start there.',
    phase: 'The carrier drifted during 4,812 years of travel. Correct for it.',
    alignment: 'Two receivers, one wavefront. Bring them level.',
  },
};

/* ── Chapter 05 ─────────────────────────────────────────────────────────── */

export const CREDITS = [
  ['Concept & direction', 'The Last Signal'],
  ['Interface & code', 'Michał Jarosiński'],
  ['Observatory record', 'TLS-4812 · fictional'],
  ['Type', 'Space Grotesk · system grotesk · system mono'],
  ['Imagery', 'Generated in-browser — WebGL, Canvas, SVG'],
  ['Sound', 'Synthesised at runtime — Web Audio'],
];

/* ── Chapter table ──────────────────────────────────────────────────────── */

export const CHAPTERS = [
  { id: 'acquisition', index: '00', title: 'Acquisition', length: 2.0, mobile: 1.6 },
  { id: 'source', index: '01', title: 'The Source', length: 4.4, mobile: 3.2 },
  { id: 'transmission', index: '02', title: 'The Transmission', length: 4.0, mobile: 3.0 },
  { id: 'fragments', index: '03', title: 'Fragments', length: 3.6, mobile: 3.4 },
  { id: 'decoding', index: '04', title: 'Decoding', length: 3.2, mobile: 3.2 },
  { id: 'afterlight', index: '05', title: 'Afterlight', length: 2.8, mobile: 2.6 },
];
