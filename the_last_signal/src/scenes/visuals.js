/**
 * visuals.js — procedural artwork for the archive.
 *
 * Every fragment image is generated here at runtime. Nothing is a photograph
 * and nothing is downloaded: the whole chapter weighs what its code weighs.
 * Each generator is deterministic, so a fragment looks the same on every visit
 * and at every size — a record that changed appearance would not be a record.
 */

import { mulberry32, clamp, lerp, TAU } from '../core/math.js';

const INK = '232,232,228';
const SILVER = '167,171,178';
const AMBER = '255,158,66';
const SPECTRAL = '154,138,230';
const ALERT = '218,49,40';

const rgba = (c, a) => `rgba(${c},${a})`;

/** Seeded 2D value noise — enough structure without importing a library. */
function makeNoise(seed) {
  const r = mulberry32(seed);
  const table = new Float32Array(512);
  for (let i = 0; i < table.length; i++) table[i] = r();
  const at = (x, y) => table[(((x * 73856093) ^ (y * 19349663)) >>> 0) % table.length];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}

function fbm2(noise, x, y, octaves = 4) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x, y);
    norm += amp;
    x *= 2.03; y *= 2.03; amp *= 0.5;
  }
  return sum / norm;
}

/* ── 07 · Atmospheric recording ───────────────────────────────────────── */
function spectrogram(ctx, w, h, seed) {
  const noise = makeNoise(seed);
  const cols = Math.floor(w / 3.2);
  const rows = Math.floor(h / 3.6);
  const cw = w / cols;
  const ch = h / rows;

  // Two events where the level collapses — something passed the microphone.
  const events = [0.31, 0.72];

  for (let x = 0; x < cols; x++) {
    const u = x / cols;
    let gate = 1;
    for (const e of events) gate *= clamp(Math.abs(u - e) / 0.035, 0.12, 1);

    for (let y = 0; y < rows; y++) {
      const v = y / rows;
      let energy = fbm2(noise, x * 0.09, y * 0.16, 4);
      // Low frequencies carry most of the power — wind, not speech.
      energy *= Math.pow(1 - v, 1.6) * 1.5 + 0.06;
      // Absorption lines: whatever their atmosphere was, it ate these bands.
      energy *= 1 - 0.85 * Math.exp(-Math.pow((v - 0.42) * 40, 2));
      energy *= 1 - 0.7 * Math.exp(-Math.pow((v - 0.63) * 55, 2));
      energy *= gate;

      if (energy < 0.035) continue;
      const hot = clamp((energy - 0.28) / 0.4);
      ctx.fillStyle = rgba(hot > 0.4 ? AMBER : INK, clamp(energy * 1.5) * 0.85);
      ctx.fillRect(x * cw, h - (y + 1) * ch, Math.max(1, cw - 0.6), Math.max(1, ch - 0.6));
    }
  }

  // Time ruler.
  ctx.fillStyle = rgba(SILVER, 0.35);
  for (let i = 0; i <= 8; i++) {
    ctx.fillRect((i / 8) * (w - 1), h - 4, 1, 4);
  }
}

/* ── 12 · Unknown orbital structure ──────────────────────────────────── */
function orbital(ctx, w, h, seed) {
  const r = mulberry32(seed);
  const cx = w * 0.5;
  const cy = h * 0.46;
  const scale = Math.min(w, h);
  const tilt = 0.32;

  const ellipse = (rx, alpha, dash) => {
    ctx.save();
    ctx.strokeStyle = rgba(SILVER, alpha);
    ctx.lineWidth = 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, rx * tilt, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };

  ellipse(scale * 0.19, 0.22, [2, 5]);
  ellipse(scale * 0.30, 0.30);
  ellipse(scale * 0.42, 0.16, [1, 7]);

  // The structure: too thin, too circular, and populated with regular nodes.
  ctx.strokeStyle = rgba(AMBER, 0.75);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, scale * 0.30, scale * 0.30 * tilt, 0, 0, TAU);
  ctx.stroke();

  const nodes = 48;
  for (let i = 0; i < nodes; i++) {
    const a = (i / nodes) * TAU;
    const x = cx + Math.cos(a) * scale * 0.30;
    const y = cy + Math.sin(a) * scale * 0.30 * tilt;
    const front = Math.sin(a) > 0;
    const size = front ? 2.1 : 1.2;
    ctx.fillStyle = rgba(i % 8 === 0 ? SPECTRAL : INK, front ? 0.9 : 0.34);
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }

  // Primary.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.09);
  g.addColorStop(0, rgba(INK, 0.95));
  g.addColorStop(0.35, rgba(AMBER, 0.45));
  g.addColorStop(1, rgba(AMBER, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, scale * 0.09, 0, TAU);
  ctx.fill();

  // Light curve: the periodic dimming that gave the structure away.
  const base = h * 0.88;
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) {
    const u = x / w;
    let dip = 0;
    for (let k = 0; k < 4; k++) {
      const at = 0.12 + k * 0.25;
      dip += Math.exp(-Math.pow((u - at) * 46, 2)) * (k === 2 ? 1.25 : 1);
    }
    const y = base - h * 0.03 + dip * h * 0.07 + (r() - 0.5) * 1.2;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/* ── 19 · Repeating biological pattern ───────────────────────────────── */
function lattice(ctx, w, h, seed) {
  const r = mulberry32(seed);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const count = 620;
  const scale = Math.min(w, h) * 0.031;

  // The pattern is regular until it abruptly is not.
  const breakAt = 0.63;

  for (let i = 0; i < count; i++) {
    const u = i / count;
    const a = i * golden;
    const rad = scale * Math.sqrt(i);
    if (rad > Math.min(w, h) * 0.48) break;

    const broken = u > breakAt;
    const jitter = broken ? (u - breakAt) * 26 : 0;
    const x = cx + Math.cos(a) * rad + (r() - 0.5) * jitter;
    const y = cy + Math.sin(a) * rad + (r() - 0.5) * jitter;

    // Emphasis on prime indices — the repeat interval that flagged this as signal.
    let prime = i > 1;
    for (let d = 2; d * d <= i; d++) if (i % d === 0) { prime = false; break; }

    if (broken && r() > 0.55) continue;

    const size = prime ? 2.6 : 1.5;
    ctx.fillStyle = rgba(prime ? AMBER : INK, broken ? 0.26 : prime ? 0.95 : 0.55);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }

  ctx.strokeStyle = rgba(ALERT, 0.30);
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, scale * Math.sqrt(count * breakAt), 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ── 24 · Final translated sentence ──────────────────────────────────── */
function plate(ctx, w, h, seed) {
  const r = mulberry32(seed);
  const pad = w * 0.09;
  const lineH = h * 0.052;
  const gap = lineH * 0.85;
  let y = h * 0.14;
  let line = 0;

  while (y < h * 0.84) {
    let x = pad;
    const words = 3 + Math.floor(r() * 5);
    // One line survives intact. Everything above and below it is redacted.
    const legible = line === 6;
    for (let i = 0; i < words && x < w - pad; i++) {
      const width = Math.min((0.06 + r() * 0.16) * w, w - pad - x);
      ctx.fillStyle = legible ? rgba(AMBER, 0.85) : rgba(SILVER, 0.16 + r() * 0.12);
      ctx.fillRect(x, y, width, legible ? lineH * 0.5 : lineH * 0.42);
      x += width + w * 0.022;
    }
    if (legible) {
      ctx.fillStyle = rgba(AMBER, 0.55);
      ctx.fillRect(pad, y + lineH * 0.78, w - pad * 2, 1);
    }
    y += lineH + gap;
    line++;
  }

  // Verification marks in the margin.
  ctx.fillStyle = rgba(INK, 0.5);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(w - pad * 0.55, h * 0.2 + i * 9, 6, 1);
  }
}

/* ── 31 · Unverified visual reconstruction ───────────────────────────── */
function reconstruction(ctx, w, h, seed) {
  const noise = makeNoise(seed);
  const r = mulberry32(seed + 11);
  const cell = 3;
  const cx = w * 0.5;
  const cy = h * 0.52;

  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      // A form: two overlapping ellipses. Deliberately unreadable as anything specific.
      const dx = (x - cx) / (w * 0.20);
      const dy = (y - cy) / (h * 0.34);
      const body = 1 - Math.hypot(dx, dy);
      const head = 1 - Math.hypot((x - cx) / (w * 0.095), (y - cy + h * 0.28) / (h * 0.13));
      const shape = Math.max(body, head);

      const grain = fbm2(noise, x * 0.035, y * 0.035, 4);
      const value = shape * 0.85 + grain * 0.4 - 0.28;
      if (value < 0.02) continue;

      // Only 19% of the image is genuinely recovered. The archive drops the rest.
      if (r() > 0.19 + value * 0.22) continue;

      ctx.fillStyle = rgba(value > 0.42 ? INK : SILVER, clamp(value) * 0.8);
      ctx.fillRect(x, y, cell - 0.5, cell - 0.5);
    }
  }

  // Confidence hatching over the invented regions.
  ctx.strokeStyle = rgba(ALERT, 0.14);
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += 11) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h, h);
    ctx.stroke();
  }
}

/* ── 00 · First acquisition (hidden) ─────────────────────────────────── */
function firstlight(ctx, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const scale = Math.min(w, h);

  for (let i = 3; i >= 1; i--) {
    ctx.strokeStyle = rgba(SPECTRAL, 0.10 * i);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 0.09 * i, 0, TAU);
    ctx.stroke();
  }

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.13);
  g.addColorStop(0, rgba(INK, 1));
  g.addColorStop(0.18, rgba(AMBER, 0.5));
  g.addColorStop(1, rgba(AMBER, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, scale * 0.13, 0, TAU);
  ctx.fill();

  // Two seconds of clean tone, ruled.
  const y = h * 0.86;
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, y);
  ctx.lineTo(w * 0.88, y);
  ctx.stroke();
  ctx.fillStyle = rgba(AMBER, 0.8);
  for (let i = 0; i <= 2; i++) {
    const x = lerp(w * 0.12, w * 0.88, i / 2);
    ctx.fillRect(x - 0.5, y - 5, 1, 10);
  }
}

const GENERATORS = { spectrogram, orbital, lattice, plate, reconstruction, firstlight };

/**
 * Draw a fragment's artwork into a canvas at device resolution.
 * @param {HTMLCanvasElement} canvas
 * @param {string} kind key of GENERATORS
 * @param {number} seed
 */
export function paintFragment(canvas, kind, seed = 1) {
  const gen = GENERATORS[kind];
  if (!gen) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (!w || !h) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  gen(ctx, w, h, seed);
}
