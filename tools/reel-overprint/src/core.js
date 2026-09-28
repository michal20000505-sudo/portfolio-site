// Wspólne: siatka muzyki, kolory i typografia (DESIGN.md strony + farby gry), easing, losowość, rysowanie 2D.
export const W = 1080, H = 1920, CX = W / 2, CY = H / 2;
export const BPM = 128, BEAT = 60 / BPM, S16 = BEAT / 4, BAR = BEAT * 4;
export const BEATS = 72, DUR = BEATS * BEAT;      // 33,75 s
export const bt = b => b * BEAT;                  // beat → sekundy

// strona (DESIGN.md) i gra (shooter.html: --ink-*, --paper)
export const BLACK = '#050505', PANEL = '#0d0d0f', RAISED = '#1a1a1a', BORDER = '#333333';
export const WHITE = '#ffffff', MUTED = '#888888', DIM = '#666666', SOFT = '#cfcfcf';
export const CYAN = '#00ffff', MAGENTA = '#ff00ff', YELLOW = '#ffff00';
export const INK_C = '#00aeef', INK_M = '#ec008c', INK_Y = '#ffd200', INK_K = '#161616';
export const PAPER = '#f1ede4', GRIDBLUE = 'rgba(80,170,215,.35)';
export const INK_BLUE = '#3a3fc4', INK_RED = '#ef3a2d', INK_GREEN = '#17b35a';

// ---------------------------------------------------------------- matematyka
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const raw = (t, a, b) => (t - a) / (b - a);            // jak seg, ale bez przycięcia (tap: poza 0..1 nic nie rysuje)
export const TAU = Math.PI * 2;
export const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
export const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
export const eInOutExpo = x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
export const eOutCubic = x => 1 - Math.pow(1 - x, 3);
export const eInCubic = x => x * x * x;
export const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const eOutQuart = x => 1 - Math.pow(1 - x, 4);
export const eOutQuint = x => 1 - Math.pow(1 - x, 5);
export const eInQuint = x => x ** 5;
export const eInOutQuint = x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
export const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
export const eOutBack = (x, s = 1.70158) => { const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const pulse = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau)) * clamp((t - t0) / 0.012);
export const smooth = x => x * x * (3 - 2 * x);
export const spring = (x, k = 9, damp = 6) => x <= 0 ? 0 : 1 - Math.exp(-damp * x) * Math.cos(k * x);

export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}
export function keys(t, list, ease = eInOutCubic) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [t1, v1, e] = list[i];
    if (t < t1) {
      const [t0, v0] = list[i - 1];
      const k = (e || ease)(clamp((t - t0) / (t1 - t0)));
      return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], k)) : lerp(v0, v1, k);
    }
  }
  return list[list.length - 1][1];
}

// generator liczb losowych z ziarnem (gra używa Math.random — podmieniamy je, żeby każde ujęcie było powtarzalne)
let rs = 1;
export function seedRandom(s) { rs = (s * 2654435761) >>> 0 || 1; }
export function rnd() {
  rs |= 0; rs = rs + 0x6D2B79F5 | 0;
  let t = Math.imul(rs ^ rs >>> 15, 1 | rs);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- typografia: Space Grotesk (jak strona i gra)
export const FONT = '"Space Grotesk", system-ui, sans-serif';
export function setFont(g, o) {
  const { weight = 700, size = 40, spacing = 0 } = o;
  g.font = `${weight} ${size}px ${FONT}`;
  g.letterSpacing = spacing + 'px';
}
export function measure(g, str, o) { setFont(g, o); const w = g.measureText(str).width; g.letterSpacing = '0px'; return w - (o.spacing || 0); }
export function text(g, str, x, y, o = {}) {
  const { align = 'left', color = WHITE, alpha = 1, baseline = 'alphabetic', spacing = 0 } = o;
  setFont(g, o);
  g.textAlign = align; g.textBaseline = baseline;
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * alpha;
  g.fillStyle = color;
  const dx = align === 'center' ? spacing / 2 : align === 'right' ? spacing : 0;
  g.fillText(str, x + dx, y);
  g.globalAlpha = a0;
  g.letterSpacing = '0px';
}
const SCR = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
export function scramble(str, t, t0, dur, seed = 0, rate = 30) {
  let s = '';
  const n = str.length;
  for (let i = 0; i < n; i++) {
    const ch = str[i];
    if (t < t0 + dur * i / n - 0.05) s += ' ';
    else if (t < t0 + dur * (i + 1) / n && ch !== ' ') s += SCR[Math.floor(hash(i + seed * 97, Math.floor(t * rate)) * SCR.length)];
    else s += ch;
  }
  return s;
}

// ---------------------------------------------------------------- kształty i obrazy
export function rrect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => im.decode().then(() => res(im), () => res(im));
    im.onerror = () => rej(new Error('img ' + src));
    im.src = src;
  });
}
export function canvas2d(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
// nieregularny kleks (jak Paper.splat w grze): deterministyczny kształt z ziarna
export function blobPath(g, cx, cy, r, seed, pts = 14, wob = .22) {
  g.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = i / pts * TAU, rr = r * (1 - wob / 2 + hash(seed, i % pts) * wob);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
