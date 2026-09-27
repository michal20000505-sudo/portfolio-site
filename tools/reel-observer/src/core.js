// Wspólne: czas/siatka muzyki, kolory strony (triada CMYK), easing, losowość, typografia, obrazki.
export const W = 1080, H = 1920, CX = W / 2, CY = H / 2;
export const BPM = 120, BEAT = 60 / BPM, S16 = BEAT / 4, BAR = BEAT * 4;
export const BEATS = 46, DUR = BEATS * BEAT;      // 23 s
export const bt = b => b * BEAT;                  // beat → sekundy

// DESIGN.md strony: czerń "płyty drukarskiej" + triada CMY, jedna rodzina (Space Grotesk)
export const C = '#00ffff', M = '#ff00ff', Y = '#ffff00', K = '#050505', PAPER = '#f8f6f4';
export const INK = [C, M, Y];
export const INK_RGB = [[0, 1, 1], [1, 0, 1], [1, 1, 0]];
export const WHITE = '#ffffff', GREY = '#888888', DIM = '#666666', RAISED = '#1a1a1a', MID = '#222222', BORDER = '#333333';

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
export const eOutQuint = x => 1 - Math.pow(1 - x, 5);
export const eInQuint = x => x ** 5;
export const eInOutQuint = x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
export const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
export const eOutBack = (x, s = 1.70158) => { const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const eInBack = (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x;
export const decay = (t, t0, tau) => t < t0 ? 0 : Math.exp(-(t - t0) / tau);
export const pulse = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau)) * clamp((t - t0) / 0.012);  // z miękkim atakiem
export const smooth = x => x * x * (3 - 2 * x);
export const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);
// tłumiona sprężyna 0 → 1 (dobicie z małym przestrzeleniem)
export const spring = (x, k = 9, damp = 6) => x <= 0 ? 0 : 1 - Math.exp(-damp * x) * Math.cos(k * x);

export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// gładki szum 1D (dryfy, unoszenie się)
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}
// przejście przez kolejne klucze [[czas, wartość], ...] z easingiem na każdym odcinku
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

// ---------------------------------------------------------------- typografia (Space Grotesk, jak na stronie)
export const FONT = '"Space Grotesk", system-ui, sans-serif';
export const font = (weight, size) => `${weight} ${size}px ${FONT}`;

export function setFont(g, weight, size, spacing = 0) {
  g.font = font(weight, size);
  g.letterSpacing = spacing + 'px';
}
export function measure(g, text, weight, size, spacing = 0) {
  setFont(g, weight, size, spacing);
  return g.measureText(text).width - spacing;
}
export function fitSize(g, text, weight, maxW, maxSize, spacingEm = 0) {
  const w = measure(g, text, weight, maxSize, spacingEm * maxSize);
  return w > maxW ? maxSize * maxW / w : maxSize;
}
export function text(g, str, x, y, o = {}) {
  const { weight = 500, size = 40, align = 'left', spacing = 0, color = WHITE, alpha = 1, baseline = 'alphabetic' } = o;
  setFont(g, weight, size, spacing);
  g.textAlign = align;
  g.textBaseline = baseline;
  g.globalAlpha = alpha;
  const dx = align === 'center' ? spacing / 2 : align === 'right' ? spacing : 0;
  g.fillStyle = color;
  g.fillText(str, x + dx, y);
  g.globalAlpha = 1;
  g.letterSpacing = '0px';
}

const SCR = 'ABCDEFGHIJKLMNOPRSTUWXYZ0123456789#/<>%&*+';
// litery "przewijają się" losowo, zanim ustawią się na swoim miejscu
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

// ---------------------------------------------------------------- kształty / obrazki
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
