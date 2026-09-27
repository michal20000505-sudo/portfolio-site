// Wspólne: czas/siatka muzyki, kolory marki, easing, losowość, typografia, obrazki.
export const W = 1080, H = 1920, CX = W / 2, CY = H / 2;
export const BPM = 120, BEAT = 60 / BPM, S16 = BEAT / 4, BAR = BEAT * 4;
export const bt = b => b * BEAT;                 // beat → sekundy

// Przytrzymania: choreografia jest pisana w "beatach sceny" (pierwotna wersja 8 s), a w tych odcinkach
// czas sceny zwalnia, żeby napisy dało się przeczytać. [od, do (beat sceny), ile beatów dodać]
// Dodatki są całymi beatami — uderzenia dalej lądują na siatce muzyki (music.py ma tę samą listę).
export const HOLDS = [[1.26, 1.3, 2], [3.62, 3.85, 2], [5.2, 5.3, 2], [6.52, 6.6, 2], [7.1, 7.2, 1], [12.42, 12.6, 2], [15.3, 15.5, 2]];
const EXTRA = HOLDS.reduce((s, h) => s + h[2], 0);
export const DUR = (16 + EXTRA) * BEAT;
// beat sceny → beat rzeczywisty (muzyki)
export function realBeat(b) {
  let add = 0;
  for (const [a, c, x] of HOLDS) {
    if (b >= c) add += x;
    else if (b > a) add += x * (b - a) / (c - a);
  }
  return b + add;
}
// beat rzeczywisty → beat sceny (odwrotność, liniowo na odcinkach)
export function sceneBeat(r) {
  let off = 0;
  for (const [a, c, x] of HOLDS) {
    const ra = a + off, rc = c + off + x;
    if (r < ra) return r - off;
    if (r < rc) return a + (r - ra) * (c - a) / (rc - ra);
    off += x;
  }
  return r - off;
}
export const rt = b => realBeat(b) * BEAT;       // beat sceny → sekundy rzeczywiste

// paleta z DESIGN.md strony ("The Forge Palette"); złoto = --yellow z CSS strony
export const GOLD = '#F5CA00', GOLD_DEEP = '#DEA300', GOLD_HI = '#FFE380';
export const OBSIDIAN = '#0A0A0A', ANTHRACITE = '#111111', CHARCOAL = '#1A1A1A', GRAPHITE = '#222222';
export const ICE = '#FFFFFF', ASH = '#CCCCCC', SLATE = '#999999', IRON = '#444444';
export const GOLD_RGB = [245 / 255, 202 / 255, 0];

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
export const eOutBack = (x, s = 1.70158) => { const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const eInBack = (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x;
export const decay = (t, t0, tau) => t < t0 ? 0 : Math.exp(-(t - t0) / tau);
export const pulse = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau)) * clamp((t - t0) / 0.012);  // z miękkim atakiem
export const smooth = x => x * x * (3 - 2 * x);
// tłumiona sprężyna 0 → 1 (ciężkie lądowanie z małym dobiciem)
export const spring = (x, k = 7, damp = 5.5) => x <= 0 ? 0 : 1 - Math.exp(-damp * x) * Math.cos(k * x);
// "upadek ciężaru": przyspieszenie, uderzenie w x = 1, dwa malejące odbicia
export function drop(x) {
  if (x <= 0) return 0;
  if (x < 1) return x * x;
  const u = x - 1;
  const b1 = 0.22, b2 = 0.1;
  if (u < b1) return 1 - 0.055 * Math.sin(Math.PI * u / b1);
  if (u < b1 + b2) return 1 - 0.015 * Math.sin(Math.PI * (u - b1) / b2);
  return 1;
}

export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// gładki szum 1D (do dryfów kamery i unoszenia się elementów)
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}

// ---------------------------------------------------------------- typografia (Inter, jak na stronie)
export const FONT = 'Inter, system-ui, sans-serif';
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
  const w = measure(g, text, weight, maxSize, spacingEm * maxSize);
  return w > maxW ? maxSize * maxW / w : maxSize;
}

/** Tekst z odstępem liter; przy wyrównaniu do środka/prawej kompensuje odstęp doklejany za ostatnią literą. */
export function text(g, str, x, y, o = {}) {
  const { weight = 700, size = 40, align = 'left', spacing = 0, color = ICE, alpha = 1, baseline = 'alphabetic' } = o;
  setFont(g, weight, size, spacing);
  g.textAlign = align;
  g.textBaseline = baseline;
  g.globalAlpha = alpha;
  const dx = align === 'center' ? spacing / 2 : align === 'right' ? spacing : 0;
  if (o.shadow) {
    g.shadowColor = o.shadow; g.shadowBlur = o.shadowBlur ?? size * 0.3;
  }
  g.fillStyle = color;
  g.fillText(str, x + dx, y);
  g.shadowColor = 'transparent'; g.shadowBlur = 0;
  g.globalAlpha = 1;
  g.letterSpacing = '0px';
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
export function drawCover(g, img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const sw = w / s, sh = h / s;
  const sx = (img.width - sw) * fx, sy = (img.height - sh) * fy;
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
export function star(g, x, y, r, inner = 0.45) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * inner : r;
    i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
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
