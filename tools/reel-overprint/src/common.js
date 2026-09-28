// Zasoby i wspólne elementy: zrzuty strony/gry, rigi gry, arkusz papieru, logo w trzech farbach, ikony pikselowe,
// podpisy w stylu gry (panel #0d0d0f, Space Grotesk, cyjan), przejścia kleksem.
import {
  W, H, canvas2d, loadImage, hash, TAU, clamp, lerp, text, measure, rrect, blobPath,
  PAPER, INK_C, INK_M, INK_Y, INK_K, CYAN, MAGENTA, YELLOW, WHITE, PANEL, BORDER, MUTED, BLACK,
} from './core.js';
import { Rig } from './rig.js';
import { ICONS } from '../../../shooter/data.js?v=20260928c';

export const IMG = {};
export const JSONS = {};
export const RIG = {};

export async function loadAssets() {
  const names = ['site_hero', 'site_strip', 'gry', 'game_menu', 'card_0', 'card_1', 'card_2', 'offer_0', 'offer_1', 'offer_2', 'offer_3'];
  await Promise.all(names.map(async n => { IMG[n] = await loadImage(`assets/img/${n}.webp`); }));
  for (const n of ['site', 'gry', 'game_menu']) JSONS[n] = await (await fetch(`assets/img/${n}.json`)).json();
  RIG.main = new Rig(4, W, 2340, H);                // wyższy kadr: ekran telefonu najeżdża na cały kadr (scena strony)
  RIG.alt = new Rig(4, W, H);
  for (const k of ['c', 'm', 'y']) RIG[k] = new Rig(4, 720, 720);
  makePaper();
}

// ------------------------------------------------------------------ arkusz (jak Paper.reset w grze, w rozdzielczości reelsa)
let paperC = null;
const GRID = 96;
function makePaper() {
  const [c, g] = canvas2d(W + GRID * 2, H + GRID * 2);
  g.fillStyle = PAPER; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = hash(i, 1) < .5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.5)';
    g.fillRect(hash(i, 2) * c.width, hash(i, 3) * c.height, 2 + hash(i, 4) * 4, 2);
  }
  g.strokeStyle = 'rgba(80,170,215,.22)'; g.lineWidth = 2;
  for (let x = 0; x <= c.width; x += GRID) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y <= c.height; y += GRID) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.fillStyle = 'rgba(80,170,215,.35)';
  for (let x = 0; x <= c.width; x += GRID) for (let y = 0; y <= c.height; y += GRID) g.fillRect(x - 3, y - 3, 6, 6);
  paperC = c;
}
/** Arkusz na całym kadrze; (ox, oy) przesuwa siatkę (ruch "po papierze"). */
export function paper(g, ox = 0, oy = 0, alpha = 1) {
  const mx = ((ox % GRID) + GRID) % GRID, my = ((oy % GRID) + GRID) % GRID;
  g.save(); g.globalAlpha *= alpha;
  g.drawImage(paperC, -GRID + mx, -GRID + my);
  g.restore();
}
/** Znaczniki cięcia i pasery w rogach (jak na arkuszu w grze). */
export function cropMarks(g, m = 56, L = 70, color = '#111', alpha = 1) {
  g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = 4;
  for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    g.beginPath(); g.moveTo(cx - sx * L * .3, cy); g.lineTo(cx + sx * L, cy); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - sy * L * .3); g.lineTo(cx, cy + sy * L); g.stroke();
  }
  g.restore();
}
export function regMark(g, x, y, r, color = '#111', alpha = 1) {
  g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = 3.5;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(x - r * 1.8, y); g.lineTo(x + r * 1.8, y); g.moveTo(x, y - r * 1.8); g.lineTo(x, y + r * 1.8); g.stroke();
  g.restore();
}
/** Pasek kontrolny CMYK. */
export function cmykBar(g, x, y, s, alpha = 1) {
  g.save(); g.globalAlpha *= alpha;
  [INK_C, INK_M, INK_Y, INK_K].forEach((c, i) => { g.fillStyle = c; g.fillRect(x + i * s * 1.18, y, s, s); });
  g.restore();
}

// ------------------------------------------------------------------ logo OVERPRINT: trzy płyty C, M, Y
// k: pasowanie 0 (płyty rozjechane) → 1 (prawie w rejestrze); na papierze mieszają się multiply, na czerni screen.
const PLATES = [[INK_C, CYAN, -9, 5], [INK_M, MAGENTA, 8, -4], [INK_Y, YELLOW, 3, 9]];
export function logo(g, str, x, y, size, { k = 1, dark = false, alpha = [1, 1, 1], spacing = -.035, align = 'center', drift = 0 } = {}) {
  g.save();
  g.globalCompositeOperation = dark ? 'screen' : 'multiply';
  const sc = size / 80;
  PLATES.forEach(([ink, light, dx, dy], i) => {
    const a = alpha[i];
    if (a <= 0) return;
    const off = (4 * (1 - k) + .25 + drift * Math.sin(i * 2.1 + drift * 3)) * sc;
    text(g, str, x + dx * off, y + dy * off, { size, weight: 700, color: dark ? light : ink, alpha: a, align, spacing: size * spacing, baseline: 'middle' });
  });
  g.restore();
}

// ------------------------------------------------------------------ ikony pikselowe z gry (9×9)
const iconCache = new Map();
export function icon(name, px, color = WHITE, accent = CYAN) {
  const key = name + px + color + accent;
  if (iconCache.has(key)) return iconCache.get(key);
  const rows = ICONS[name] || ICONS.ink;
  const [c, g] = canvas2d(9 * px, 9 * px);
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    g.fillStyle = ch === '+' ? accent : color;
    g.fillRect(i * px, j * px, px, px);
  }));
  iconCache.set(key, c);
  return c;
}

// ------------------------------------------------------------------ panele i podpisy w stylu UI gry
export function panel(g, x, y, w, h, { r = 22, fill = PANEL, stroke = BORDER, lw = 2, alpha = 1 } = {}) {
  g.save(); g.globalAlpha *= alpha;
  rrect(g, x, y, w, h, r);
  g.fillStyle = fill; g.fill();
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  g.restore();
}
/** Mała etykieta (label strony: wersaliki, rozstrzelone). */
export function label(g, str, x, y, { size = 26, color = MUTED, alpha = 1, align = 'left' } = {}) {
  text(g, str.toUpperCase(), x, y, { size, weight: 500, spacing: size * .2, color, alpha, align });
}
/** Chip z ramką (jak .chip / przycisk strony). */
export function chip(g, str, cx, cy, { size = 30, color = CYAN, fill = null, alpha = 1, padX = 30, h = null, r = 16, weight = 700 } = {}) {
  const w = measure(g, str, { size, weight, spacing: size * .12 }) + padX * 2, hh = h || size * 2.1;
  g.save(); g.globalAlpha *= alpha;
  rrect(g, cx - w / 2, cy - hh / 2, w, hh, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.lineWidth = 3; g.strokeStyle = color; g.stroke();
  g.restore();
  text(g, str, cx, cy + 1, { size, weight, spacing: size * .12, color: fill ? BLACK : color, alpha, align: 'center', baseline: 'middle' });
  return w;
}

// ------------------------------------------------------------------ przejścia
/** Kleks farby rozlewający się z (x, y): k 0..1; kształt z ziarna. Zwraca ścieżkę do clip lub wypełnia. */
export function inkBlob(g, x, y, k, color, seed = 1, maxR = 2400) {
  if (k <= 0) return;
  const r = maxR * k;
  g.save();
  g.fillStyle = color;
  blobPath(g, x, y, r, seed, 18, .35);
  g.fill();
  // satelity
  for (let i = 0; i < 9; i++) {
    const a = hash(seed, i, 7) * TAU, d = r * (1.05 + hash(seed, i, 8) * .5);
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (.04 + hash(seed, i, 9) * .1), 0, TAU); g.fill();
  }
  g.restore();
}
export function blobClip(g, x, y, r, seed = 1) { blobPath(g, x, y, r, seed, 18, .3); g.clip(); }

/** Tapnięcie palcem: kółko, które się rozchodzi. */
export function tap(g, x, y, k, color = WHITE) {
  if (k < 0 || k > 1) return;
  g.save();
  g.globalAlpha = (1 - k) * .9;
  g.strokeStyle = color; g.lineWidth = 6;
  g.beginPath(); g.arc(x, y, 30 + k * 70, 0, TAU); g.stroke();
  g.globalAlpha = clamp(1 - k * 2.5) * .5;
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ nagłówki "z drukarni"
/** Tekst w czarnej farbie z płytami C i M rozjechanymi o `mis` px (na papierze: multiply). */
export function printText(g, str, x, y, size, { mis = 4, alpha = 1, align = 'left', weight = 700, spacing = -.02, color = INK_K, plates = true } = {}) {
  const o = { size, weight, align, spacing: size * spacing, baseline: 'alphabetic', alpha };
  if (plates && mis > .05) {
    g.save(); g.globalCompositeOperation = 'multiply';
    text(g, str, x - mis, y + mis * .6, { ...o, color: INK_C, alpha: alpha * .9 });
    text(g, str, x + mis * .8, y - mis * .4, { ...o, color: INK_M, alpha: alpha * .9 });
    g.restore();
  }
  text(g, str, x, y, { ...o, color });
}
/** Biały tekst na czerni z poświatą C/M jak "CREATIVE DESIGNER" na stronie (screen). */
export function glowText(g, str, x, y, size, { mis = 3, alpha = 1, align = 'left', weight = 700, spacing = -.02, color = WHITE } = {}) {
  const o = { size, weight, align, spacing: size * spacing, baseline: 'alphabetic', alpha };
  if (mis > .05) {
    g.save(); g.globalCompositeOperation = 'screen';
    text(g, str, x - mis, y, { ...o, color: CYAN, alpha: alpha * .85 });
    text(g, str, x + mis, y + mis * .3, { ...o, color: MAGENTA, alpha: alpha * .85 });
    g.restore();
  }
  text(g, str, x, y, { ...o, color });
}
/** Naklejka: kartka papieru z tekstem, lekko obrócona; wbija się jak stempel (k: 0 → 1). */
export function sticker(g, lines, cx, cy, { size = 92, k = 1, rot = -.03, pad = 34, lead = 1.0, alpha = 1, fill = PAPER, color = INK_K, mis = 0, sub = null } = {}) {
  if (k <= 0) return;
  const ws = lines.map(l => measure(g, l, { size, weight: 700, spacing: -size * .02 }));
  const w = Math.max(...ws) + pad * 2;
  const lh = size * lead;
  const subH = sub ? size * .42 : 0;
  const h = lines.length * lh + pad * 1.4 + subH;
  const s = 1 + (1 - k) * .35;
  g.save();
  g.globalAlpha *= alpha * clamp(k * 3);
  g.translate(cx, cy); g.rotate(rot * (1 + (1 - k) * 2)); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-w / 2 + 12, -h / 2 + 14, w, h);
  g.fillStyle = fill; g.fillRect(-w / 2, -h / 2, w, h);
  let y = -h / 2 + pad * .7 + size * .86;
  for (const l of lines) { printText(g, l, -w / 2 + pad, y, size, { mis, color }); y += lh; }
  if (sub) label(g, sub, -w / 2 + pad + 4, y - lh + size * .5, { size: size * .26, color: '#555' });
  g.restore();
}
