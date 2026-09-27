// Elementy wspólne scen: materiał płaszczyzn z obrazami (z symulacją druku CMYK), kamera "pikselowa",
// nagłówki sekcji, HUD, pomocnicze efekty 2D.
import * as THREE from 'three';
import {
  W, H, CX, CY, BEAT, S16, DUR, bt, C, M, Y, INK, GREY, DIM, BORDER,
  clamp, lerp, seg, rad, eOutExpo, eInExpo, eOutBack, eInOutCubic, eOutCubic, decay, pulse, hash,
  inkText, inkOff, scramble, setFont, measure, loadImage, rrect,
} from './core.js';

// ------------------------------------------------------------------ środowisko (ustawiane w main.js)
export const ENV = { renderer: null, pipeline: null };

// kalendarz ze sceny "systemy" — S4 zrzuca pociski dokładnie na środki jego komórek
export const CAL = { x: 100, y: 540, w: 880, h: 540, cols: 7, rows: 5, gx: 130, gy: 670, cw: 108, ch: 72, gap: 10 };
export function calCell(r, c) { return [CAL.gx + c * (CAL.cw + CAL.gap) + CAL.cw / 2, CAL.gy + r * (CAL.ch + CAL.gap) + CAL.ch / 2]; }

// ------------------------------------------------------------------ assety
export const IMG = {};
export const TEX = {};
const texLoader = new THREE.TextureLoader();
export async function loadAssets(list) {
  await Promise.all(list.map(async name => {
    const src = `assets/img/${name}.webp`;
    IMG[name] = await loadImage(src);
    const t = new THREE.Texture(IMG[name]);
    t.colorSpace = THREE.NoColorSpace;          // wartości "ekranowe" — kompozycja liczy w sRGB jak CSS
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    TEX[name] = t;
  }));
}
export async function loadMobile(names) {
  await Promise.all(names.map(async n => { IMG['m_' + n] = await loadImage(`assets/mobile/${n}.webp`); }));
}

// ------------------------------------------------------------------ kamera: 1 jednostka = 1 px na z=0
export function pixelCam(fov = 30) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 10, 30000);
  cam.position.set(0, 0, (H / 2) / Math.tan(rad(fov / 2)));
  cam.lookAt(0, 0, 0);
  return cam;
}
export const wx = x => x - CX;           // px → świat
export const wy = y => CY - y;

// ------------------------------------------------------------------ materiał obrazu (+ druk CMYK)
const PLANE_VS = /* glsl */`
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PLANE_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
varying float vDepth;
uniform sampler2D tMap;
uniform float uOpacity, uBright, uRound, uAspect, uBackDim;
uniform vec2 uUvScale, uUvOffset;
uniform float uPlates, uHalftone, uCells;
uniform vec2 uOff[4];
uniform vec3 uPaper;
uniform vec2 uFog;
uniform float uScan, uScanLines;
float sdRBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec4 cmyk(vec3 c) { float k = 1.0 - max(c.r, max(c.g, c.b)); float d = max(1.0 - k, 1e-4); return vec4((1.0 - c.r - k) / d, (1.0 - c.g - k) / d, (1.0 - c.b - k) / d, k); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec2 mapUv(vec2 uv) { return uv * uUvScale + uUvOffset; }
float dotScreen(vec2 uv, float ang, float cov) {
  vec2 q = rot(ang) * (uv * vec2(uAspect, 1.0)) * uCells;
  vec2 f = fract(q) - 0.5;
  float r = sqrt(clamp(cov, 0.0, 1.0)) * 0.72;
  float d = length(f) - r;
  float aa = fwidth(d) * 1.2;
  return 1.0 - smoothstep(-aa, aa, d);
}
void main() {
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float d = sdRBox(p, vec2(uAspect * 0.5, 0.5), uRound);
  float mask = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
  vec3 col;
  if (uPlates < 0.0) {
    col = texture2D(tMap, mapUv(uv)).rgb;
  } else {
    float cv[4];
    float angs[4];
    angs[0] = radians(15.0); angs[1] = radians(75.0); angs[2] = 0.0; angs[3] = radians(45.0);
    for (int j = 0; j < 4; j++) {
      float vis = clamp(uPlates - float(j), 0.0, 1.0);
      vec4 k = cmyk(texture2D(tMap, mapUv(uv + uOff[j])).rgb);
      float c = (j == 0 ? k.x : j == 1 ? k.y : j == 2 ? k.z : k.w) * vis;
      cv[j] = mix(c, dotScreen(uv + uOff[j], angs[j], c), uHalftone);
    }
    col = uPaper * vec3((1.0 - cv[0]) * (1.0 - cv[3]), (1.0 - cv[1]) * (1.0 - cv[3]), (1.0 - cv[2]) * (1.0 - cv[3]));
  }
  if (uScanLines > 0.0) col *= 1.0 - uScanLines * (0.5 + 0.5 * sin(uv.y * 900.0));
  if (uScan > 0.0) col += vec3(0.0, 1.0, 1.0) * exp(-pow((uv.y - uScan) * 40.0, 2.0)) * 0.6;
  col *= uBright * (gl_FrontFacing ? 1.0 : uBackDim);
  float fog = clamp((vDepth - uFog.x) / max(uFog.y - uFog.x, 1.0), 0.0, 1.0);
  col *= 1.0 - fog;
  gl_FragColor = vec4(col, mask * uOpacity);
}`;

export function planeMat(tex, aspect, o = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: PLANE_VS, fragmentShader: PLANE_FS,
    uniforms: {
      tMap: { value: tex }, uOpacity: { value: 1 }, uBright: { value: 1 }, uRound: { value: o.round ?? 0.02 }, uAspect: { value: aspect },
      uBackDim: { value: 0.45 }, uUvScale: { value: new THREE.Vector2(1, 1) }, uUvOffset: { value: new THREE.Vector2(0, 0) },
      uPlates: { value: -1 }, uHalftone: { value: 0 }, uCells: { value: 70 },
      uOff: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
      uPaper: { value: new THREE.Vector3(0.973, 0.965, 0.957) }, uFog: { value: new THREE.Vector2(1e6, 2e6) },
      uScan: { value: -1 }, uScanLines: { value: 0 },
    },
    transparent: true, side: THREE.DoubleSide, depthWrite: o.depthWrite ?? true,
  });
}
export function imagePlane(name, width, o = {}) {
  const img = IMG[name];
  const aspect = img.width / img.height;
  const geo = new THREE.PlaneGeometry(width, width / aspect, 1, 1);
  const mesh = new THREE.Mesh(geo, planeMat(TEX[name], aspect, o));
  mesh.userData.aspect = aspect;
  return mesh;
}

// ------------------------------------------------------------------ nagłówek sekcji
/**
 * num: '01', label: 'WEB DESIGN', lines: ['STRONY','WWW'], b0: beat startu, bOut: beat wyjścia
 */
export function sectionTitle(g, S, o) {
  const { num, label, lines, b0, bOut = 1e9, x = 90, y = 250, size = 150, lh = 0.9, align = 'left' } = o;
  const t = S.t, t0 = bt(b0), tOut = bt(bOut);
  if (t < t0 - 0.05) return;
  const out = eInExpo(seg(t, tOut, tOut + 0.32));
  if (out >= 1) return;
  const xa = align === 'center' ? CX : x;
  // przyciemnienie pod tytułem (tło i 3D nie walczą z literami)
  if (o.backdrop !== false) {
    const top = y - 130, bot = y + 40 + lines.length * size * lh + 90;
    const gr = g.createLinearGradient(0, top, 0, bot);
    const k = 0.78 * seg(t, t0, t0 + 0.25) * (1 - out);
    gr.addColorStop(0, 'rgba(5,5,5,0)'); gr.addColorStop(0.3, `rgba(5,5,5,${k})`); gr.addColorStop(0.75, `rgba(5,5,5,${k})`); gr.addColorStop(1, 'rgba(5,5,5,0)');
    g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
  }
  // wiersz etykiety
  const la = seg(t, t0, t0 + 0.15) * (1 - out);
  g.globalAlpha = la;
  inkText(g, scramble(num, t, t0, 0.18, 3), xa, y - out * 40, { weight: 500, size: 36, align: align === 'center' ? 'right' : 'left', color: C, spacing: 2 });
  const lx0 = align === 'center' ? xa + 18 : xa + 64;
  const lw = 70 * eOutExpo(seg(t, t0 + 0.05, t0 + 0.4));
  g.fillStyle = BORDER; g.globalAlpha = la;
  g.fillRect(lx0, y - 13 - out * 40, lw, 2);
  inkText(g, scramble(label, t, t0 + 0.08, 0.35, 5), lx0 + 88, y - out * 40, { weight: 500, size: 30, align: 'left', color: GREY, spacing: 3.5 });
  g.globalAlpha = 1;
  // duże linie z maską
  lines.forEach((line, i) => {
    const ti = t0 + 0.06 + i * 0.07;
    const e = eOutExpo(seg(t, ti, ti + 0.55));
    if (e <= 0) return;
    const base = y + 40 + (i + 1) * size * lh;
    const top = base - size * 0.95, h = size * 1.12;
    g.save();
    g.beginPath(); g.rect(0, top, W, h); g.clip();
    const dy = (1 - e) * size * 1.05 - out * size * 1.1;
    const amt = 26 * decay(t, ti, 0.1) + 30 * out;
    inkText(g, line, xa, base + dy, { weight: 700, size, align, inks: inkOff(amt, 0.6, i + b0 * 7), spacing: -size * 0.02 });
    g.restore();
  });
}

// ------------------------------------------------------------------ etykieta-"taśma" (czarny prostokąt z tekstem)
export function tapeLabel(g, text, x, y, o = {}) {
  const { size = 90, weight = 700, bg = '#050505', fg = '#ffffff', padX = 26, padY = 16, reveal = 1, inks = null, align = 'center', skew = 0 } = o;
  const w = measure(g, text, weight, size, -size * 0.01);
  const bw = w + padX * 2, bh = size * 0.78 + padY * 2;
  const bx = align === 'center' ? x - bw / 2 : x, by = y - bh / 2;
  g.save();
  g.translate(x, y); g.transform(1, 0, skew, 1, 0, 0); g.translate(-x, -y);
  g.beginPath(); g.rect(bx, by - size * 0.5, bw * reveal, bh + size); g.clip();
  g.fillStyle = bg; g.fillRect(bx, by, bw, bh);
  inkText(g, text, bx + padX, y + size * 0.36, { size, weight, align: 'left', color: fg, inks, spacing: -size * 0.01 });
  g.restore();
  return { w: bw, h: bh };
}

// ------------------------------------------------------------------ HUD (znaczniki pasera, pasek postępu)
const SECTIONS = ['HOOK', 'WEB DESIGN', 'BRANDING', 'DESIGN 3D', 'GAME DEV', 'SYSTEMY', 'KLIENCI', 'KONTAKT'];
export function drawHud(g, S) {
  const t = S.t;
  const a = seg(t, bt(1), bt(1.6)) * (1 - seg(t, DUR - 0.5, DUR - 0.1));
  if (a <= 0) return;
  g.globalAlpha = a;
  const m = 54;
  const d = eOutExpo(seg(t, bt(1), bt(2)));
  g.strokeStyle = DIM; g.lineWidth = 2;
  for (const [x, y] of [[m, m + 150], [W - m, m + 150], [m, H - m - 60], [W - m, H - m - 60]]) {
    g.beginPath(); g.moveTo(x - 14 * d, y); g.lineTo(x + 14 * d, y); g.moveTo(x, y - 14 * d); g.lineTo(x, y + 14 * d); g.stroke();
    g.beginPath(); g.arc(x, y, 7 * d, 0, Math.PI * 2); g.stroke();
  }
  // pionowy pasek postępu po lewej
  const x = 38, y0 = 420, y1 = 1520;
  g.fillStyle = '#222222'; g.fillRect(x - 1.5, y0, 3, (y1 - y0) * d);
  const p = clamp(t / DUR);
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, C); gr.addColorStop(0.5, M); gr.addColorStop(1, Y);
  g.fillStyle = gr; g.fillRect(x - 1.5, y0, 3, (y1 - y0) * p * d);
  for (let k = 0; k <= 8; k++) {
    const yy = y0 + (y1 - y0) * k / 8;
    g.fillStyle = k / 8 <= p ? '#ffffff' : '#444444';
    g.fillRect(x - 7, yy - 1, 14, 2);
  }
  const sec = Math.min(7, Math.floor(S.B / 8));
  const yy = y0 + (y1 - y0) * p;
  g.save(); g.translate(x + 22, yy); g.rotate(-Math.PI / 2);
  inkText(g, `0${sec} ${SECTIONS[sec]}`, 0, 0, { weight: 500, size: 17, align: 'center', color: GREY, spacing: 2.5 });
  g.restore();
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ drobne efekty 2D
export function ring(g, x, y, r, w, color, alpha) {
  if (alpha <= 0.002 || r <= 0) return;
  g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
}
export function shockRings(g, t, t0, x, y, R, dur = 0.7, w = 8) {
  if (t < t0 || t > t0 + dur + 0.1) return;
  for (let k = 0; k < 3; k++) {
    const e = eOutExpo(seg(t, t0 + k * 0.025, t0 + dur));
    ring(g, x, y, R * e * (1 + k * 0.06), w * (1 - e) + 0.6, INK[k], Math.pow(1 - e, 1.3));
  }
}
// cząsteczki (deterministyczne) — smugi w kierunku ruchu
export function makeBurst(seed, n, speed, life = [0.4, 1.1]) {
  let s = seed * 9973 + 11;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const ps = [];
  for (let i = 0; i < n; i++) {
    ps.push({ a: r() * Math.PI * 2, sp: speed * (0.25 + 0.75 * Math.sqrt(r())), life: life[0] + r() * (life[1] - life[0]), w: 1.5 + r() * 3.5, col: r() < 0.3 ? '#ffffff' : INK[i % 3] });
  }
  return ps;
}
export function drawBurst(g, ps, t, t0, x, y, o = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.6) return;
  const K = o.drag ?? 5.5, r0 = o.r0 ?? 30;
  g.lineCap = 'round';
  for (const p of ps) {
    const u = dt / p.life;
    if (u >= 1) continue;
    const dd = p.sp * (1 - Math.exp(-K * dt)) / K, v = p.sp * Math.exp(-K * dt);
    const cx = Math.cos(p.a), sy = Math.sin(p.a);
    const px = x + cx * (dd + r0), py = y + sy * (dd + r0);
    const tail = Math.max(2, v * 0.03);
    g.strokeStyle = p.col; g.globalAlpha = Math.pow(1 - u, 1.4); g.lineWidth = p.w * (1 - u * 0.6);
    g.beginPath(); g.moveTo(px, py); g.lineTo(px - cx * tail, py - sy * tail); g.stroke();
  }
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ znacznik pasera
export function regMark(g, x, y, r, a = 1, color = '#ffffff', lw = 2.5) {
  g.globalAlpha = a; g.strokeStyle = color; g.lineWidth = lw;
  g.beginPath(); g.moveTo(x - r * 1.6, y); g.lineTo(x + r * 1.6, y); g.moveTo(x, y - r * 1.6); g.lineTo(x, y + r * 1.6); g.stroke();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ pomocnicze do bg
export const bgEntry = (mode, a0, a1, w = 1) => ({ mode, a0, a1, w });
