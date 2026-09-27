// Wspólne: czas/siatka muzyki, kolory i typografia SSCAR (DESIGN.md strony), easing, losowość, rysowanie.
export const W = 1080, H = 1920, CX = W / 2, CY = H / 2;
export const BPM = 120, BEAT = 60 / BPM, S16 = BEAT / 4, BAR = BEAT * 4;
export const BEATS = 76, DUR = BEATS * BEAT;      // 38 s
export const bt = b => b * BEAT;                  // beat → sekundy

// Tokeny strony (oklch z DESIGN.md przeliczone na sRGB). Czerń i szarości są lekko podgrzane ku czerwieni.
export const RED = '#bd0001';          // --primary-red: oklch(48.5% 0.222 25.8)
export const RED_HI = '#e22020';       // czerwień logo (Logo-SSCAR.png)
export const RED_GLOW = '#ff2d1e';     // do świecących linii (bloom)
export const BG = '#090706';           // --dark-bg
export const S1 = '#120f0e';           // --surface-1
export const S2 = '#181515';           // --surface-2
export const S3 = '#1f1b1a';
export const BORDER = '#221e1e';       // --border-subtle
export const BORDER_ACC = '#52302d';   // --border-accent
export const INK = '#f2edec';          // --text-main
export const MUTED = '#9b9796';        // --text-muted
export const DIM = '#5d5857';
export const OK = '#3eac64';           // "w normie" z laboratorium geometrii
export const WARN = '#d6982e';
export const RED_RGB = [189, 0, 1], OK_RGB = [62, 172, 100], WARN_RGB = [214, 152, 46];

// ---------------------------------------------------------------- matematyka
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const rad = d => d * Math.PI / 180;
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
export const eInBack = (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x;
// ease-out strony (cubic-bezier 0.22, 0.61, 0.36, 1) — przybliżenie
export const eSite = x => 1 - Math.pow(1 - clamp(x), 3.2);
export const decay = (t, t0, tau) => t < t0 ? 0 : Math.exp(-(t - t0) / tau);
export const pulse = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau)) * clamp((t - t0) / 0.012);
export const smooth = x => x * x * (3 - 2 * x);
export const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);
// tłumiona sprężyna 0 → 1 (dobicie z małym przestrzeleniem)
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
// przejście przez kolejne klucze [[czas, wartość, easing?], ...]
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
export const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
// skala zużycia z laboratorium: zielony → bursztyn → czerwony
export const ramp = t => t < 0.5 ? mixRGB(OK_RGB, WARN_RGB, t * 2) : mixRGB(WARN_RGB, RED_RGB, (t - 0.5) * 2);
// liczby po polsku: przecinek dziesiętny, prawdziwy minus
export const nf = (v, d) => v.toFixed(d).replace('.', ',');
export const sf = (v, d, u = '') => (v > 0.0001 ? '+' : v < -0.0001 ? '−' : '') + nf(Math.abs(v), d) + u;

// ---------------------------------------------------------------- typografia (Barlow Condensed + Barlow, jak strona)
export const COND = '"Barlow Condensed", "Barlow", sans-serif';
export const BODY = '"Barlow", sans-serif';

export function setFont(g, o) {
  const { family = 'cond', weight = 700, size = 40, italic = false, spacing = 0 } = o;
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family === 'cond' ? COND : BODY}`;
  g.letterSpacing = spacing + 'px';
}
export function measure(g, str, o) {
  setFont(g, o);
  return g.measureText(str).width - (o.spacing || 0);
}
export function fitSize(g, str, o, maxW) {
  const w = measure(g, str, o);
  return w > maxW ? o.size * maxW / w : o.size;
}
export function text(g, str, x, y, o = {}) {
  const { align = 'left', color = INK, alpha = 1, baseline = 'alphabetic', spacing = 0 } = o;
  setFont(g, o);
  g.textAlign = align;
  g.textBaseline = baseline;
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * alpha;
  g.fillStyle = color;
  const dx = align === 'center' ? spacing / 2 : align === 'right' ? spacing : 0;
  g.fillText(str, x + dx, y);
  g.globalAlpha = a0;
  g.letterSpacing = '0px';
}

const SCR = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
// litery przewijają się jak na tablicy klapkowej, zanim ustawią się na swoim miejscu
export function scramble(str, t, t0, dur, seed = 0, rate = 30) {
  let s = '';
  const n = str.length;
  for (let i = 0; i < n; i++) {
    const ti = t0 + dur * (i + 1) / n;
    const ch = str[i];
    if (t < t0 + dur * i / n - 0.05) s += ' ';
    else if (t < ti && ch !== ' ') s += SCR[Math.floor(hash(i + seed * 97, Math.floor(t * rate)) * SCR.length)];
    else s += ch;
  }
  return s;
}

// ---------------------------------------------------------------- kształty
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
// obraz "cover" w prostokącie (z kadrowaniem i przesunięciem ogniska fx, fy ∈ 0..1)
export function drawCover(g, img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const sw = w / s, sh = h / s;
  const sx = clamp((img.width - sw) * fx, 0, img.width - sw), sy = clamp((img.height - sh) * fy, 0, img.height - sh);
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
