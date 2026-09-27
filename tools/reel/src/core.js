// Wspólne: czas/siatka muzyki, easing, losowość, typografia, obrazki.
export const W = 1080, H = 1920, CX = W / 2, CY = H / 2;
export const BPM = 128, BEAT = 60 / BPM, S16 = BEAT / 4, BAR = BEAT * 4, DUR = 30;
export const bt = b => b * BEAT;                 // beat → sekundy

export const C = '#00ffff', M = '#ff00ff', Y = '#ffff00', BG = '#050505';
export const INK = [C, M, Y];
export const GREY = '#888888', DIM = '#666666', RAISED = '#1a1a1a', MID = '#222222', BORDER = '#333333';

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
export const eInOutQuint = x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
export const eOutBack = (x, s = 1.70158) => { const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const eInBack = (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x;
export const eOutElastic = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1;
export const decay = (t, t0, tau) => t < t0 ? 0 : Math.exp(-(t - t0) / tau);
export const pulse = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau)) * clamp((t - t0) / 0.012);  // z miękkim atakiem
export const smooth = x => x * x * (3 - 2 * x);

export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// gładki szum 1D (do dryfów)
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}

// ---------------------------------------------------------------- typografia
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
// największy rozmiar mieszczący tekst w szerokości
export function fitSize(g, text, weight, maxW, maxSize, spacingEm = 0) {
  let s = maxSize;
  const w = measure(g, text, weight, s, spacingEm * s);
  if (w > maxW) s = s * maxW / w;
  return s;
}

const SCR = 'ABCDEFGHIJKLMNOPRSTUWXYZ0123456789#/<>%&*+';
export function scramble(text, t, t0, dur, seed = 0, rate = 30) {
  let s = '';
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ti = t0 + dur * (i + 1) / n;
    const ch = text[i];
    if (t < t0 + dur * i / n - 0.06) s += ' ';
    else if (t < ti && ch !== ' ') s += SCR[Math.floor(hash(i + seed * 97, Math.floor(t * rate)) * SCR.length)];
    else s += ch;
  }
  return s;
}

/**
 * Tekst z "farbami" CMY: przy przesunięciu rysuje trzy kopie w trybie screen (białe tam, gdzie się pokrywają).
 * o: {weight,size,align,spacing,color,alpha,inks:[[dx,dy]*3] | null, baseline}
 */
export function inkText(g, text, x, y, o = {}) {
  const { weight = 700, size = 100, align = 'center', spacing = 0, color = '#ffffff', alpha = 1, inks = null, baseline = 'alphabetic' } = o;
  setFont(g, weight, size, spacing);
  g.textAlign = align;
  g.textBaseline = baseline;
  g.globalAlpha = alpha;
  // przy wyrównaniu do środka letterSpacing dokleja odstęp na końcu — kompensujemy
  const dx = align === 'center' ? spacing / 2 : align === 'right' ? spacing : 0;
  const split = inks && inks.some(([a, b]) => Math.abs(a) + Math.abs(b) > 0.4);
  if (o.knock) {   // ciemny obrys pod literami — czytelność na ruchliwym tle
    g.lineJoin = 'round';
    g.lineWidth = o.knock === true ? size * 0.16 : o.knock;
    g.strokeStyle = 'rgba(5,5,5,0.92)';
    g.strokeText(text, x + dx, y);
  }
  if (!split) {
    g.fillStyle = color;
    g.fillText(text, x + dx, y);
  } else {
    const prev = g.globalCompositeOperation;
    g.globalCompositeOperation = 'screen';
    for (let k = 0; k < 3; k++) {
      g.fillStyle = INK[k];
      g.fillText(text, x + dx + inks[k][0], y + inks[k][1]);
    }
    g.globalCompositeOperation = prev;
  }
  g.globalAlpha = 1;
  g.letterSpacing = '0px';
}

// kierunki pasera dla trzech farb
export const REG = [[-1, -0.55], [1, 0.55], [0.35, -1]];
export const inkOff = (amt, jitter = 0, seed = 0) => REG.map(([a, b], k) => [a * amt * (1 + jitter * (hash(seed, k) - .5)), b * amt * (1 + jitter * (hash(seed, k + 7) - .5))]);

// ---------------------------------------------------------------- kształty / obrazki
export function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export function polyPath(g, cx, cy, r, n, rot = 0) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = rot + i / n * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
export function drawCover(g, img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const sw = w / s, sh = h / s;
  const sx = (img.width - sw) * fx, sy = (img.height - sh) * fy;
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
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
