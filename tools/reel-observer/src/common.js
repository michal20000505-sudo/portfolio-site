// Elementy wspólne scen: assety, kamera "pikselowa", materiał kart z drukiem rastrowym CMY, gwiazdy, pierścienie, snop światła.
import * as THREE from 'three';
import {
  W, H, CX, CY, C, M, Y, WHITE, clamp, lerp, seg, rad, TAU, hash, noise1, loadImage, eOutExpo, pulse,
} from './core.js';

export const ENV = { renderer: null, pipeline: null };
export const IMG = {};
export const TEX = {};

export const WORKS = [
  ['web_steam1', 'SPACEFIGHTER', 'GRA · STEAM'],
  ['web_sscar', 'SSCAR', 'WEB · SERWIS AUTO'],
  ['web_bodycreator', 'BODY CREATOR', 'WEB · STUDIO'],
  ['web_rmax', 'R-MAX AUTO', 'WEB · SERWIS AUTO'],
  ['web_fault_08', 'FAULT / 08', 'EKSPERYMENT'],
  ['web_sentracker_trc01', 'SENTRACKER', 'EKSPERYMENT'],
  ['web_handybruk', 'HANDYBRUK', 'WEB · USŁUGI'],
  ['poster_digicamo', 'DIGICAMO', 'GRAFIKA · PRINT'],
];

function texOf(img) {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.NoColorSpace;          // wartości "ekranowe"; materiał sam przelicza na liniowe
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
export function canvasTex(c) { return texOf(c); }

export async function loadAssets() {
  await Promise.all(WORKS.map(async ([key]) => {
    IMG[key] = await loadImage(`assets/img/${key}.webp`);
    TEX[key] = texOf(IMG[key]);
  }));
}

// ------------------------------------------------------------------ kamera: 1 jednostka = 1 px na z=0
export function pixelCam(fov = 30) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 10, 30000);
  cam.position.set(0, 0, (H / 2) / Math.tan(rad(fov / 2)));
  cam.lookAt(0, 0, 0);
  return cam;
}
export const wx = x => x - CX;
export const wy = y => CY - y;
const _v = new THREE.Vector3();
export function toScreen(obj, cam, x = 0, y = 0, z = 0) {
  _v.set(x, y, z);
  obj.localToWorld(_v);
  _v.project(cam);
  return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H];
}

// ------------------------------------------------------------------ materiał karty: obraz z zaokrąglonymi rogami,
// który "drukuje się" rastrem trzech farb (C, M, Y pod kątami 15°/75°/45°) i przechodzi w pełny obraz.
// Na czarnym tle strony farby są światłem: C+M+Y = biel, więc paleta strony składa się z nich dokładnie.
const CARD_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CARD_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D map;
uniform vec2 uSize;          // px karty
uniform float uRadius, uOpacity, uPrint, uCell, uBright;
uniform vec3 uInk;           // odsłonięcie rastra C, M, Y
uniform vec2 uOffC, uOffM, uOffY;   // przesunięcia płyt (px) — pasery rozjechane / w rejestrze
uniform vec4 uBorder;        // kolor + krycie ramki
uniform vec4 uScan;          // y (0..1 od góry), siła, szerokość, —
uniform vec4 uCrop;          // wycinek obrazu: u0, v0, u1, v1
vec3 srgb2lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 img(vec2 p) {                 // p: px od lewego górnego rogu karty
  vec2 uv = p / uSize;
  uv = mix(uCrop.xy, uCrop.zw, clamp(uv, 0.0, 1.0));
  return texture2D(map, vec2(uv.x, 1.0 - uv.y)).rgb;
}
float ink(vec3 c, int k) {
  if (k == 0) return clamp((c.g + c.b - c.r) * 0.5, 0.0, 1.0);
  if (k == 1) return clamp((c.r + c.b - c.g) * 0.5, 0.0, 1.0);
  return clamp((c.r + c.g - c.b) * 0.5, 0.0, 1.0);
}
float dots(vec2 p, float ang, int k, float reveal) {
  if (reveal <= 0.001) return 0.0;
  mat2 R = rot(ang);
  vec2 q = R * p;
  vec2 cell = (floor(q / uCell) + 0.5) * uCell;
  vec3 c = img(rot(-ang) * cell);
  float i = ink(c, k) * uBright;
  float r = uCell * sqrt(i / 3.14159) * 1.2 * reveal;
  float d = length(q - cell);
  return smoothstep(r + 0.9, r - 0.9, d);
}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  // zaokrąglone rogi (SDF)
  vec2 h = uSize * 0.5;
  vec2 dq = abs(p - h) - (h - uRadius);
  float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - uRadius;
  float a = smoothstep(0.8, -0.8, sd);
  if (a <= 0.0) discard;
  vec3 full = img(p) * uBright;
  vec3 ht = vec3(0.0, 1.0, 1.0) * dots(p + uOffC, 0.2618, 0, uInk.x)
          + vec3(1.0, 0.0, 1.0) * dots(p + uOffM, 1.309, 1, uInk.y)
          + vec3(1.0, 1.0, 0.0) * dots(p + uOffY, 0.7854, 2, uInk.z);
  vec3 col = mix(ht, full, uPrint);
  float bgA = mix(max(max(ht.r, ht.g), ht.b), 1.0, uPrint);     // przed drukiem: tylko kropki (tło przezroczyste)
  // skaner oka: jasna linia z poświatą schodzącą w dół
  if (uScan.y > 0.001) {
    float y = vUv.y; float sy = 1.0 - uScan.x;
    float dl = (y - sy) * uSize.y;
    float line = exp(-dl * dl / (uScan.z * uScan.z));
    float trail = dl > 0.0 ? exp(-dl / (uScan.z * 14.0)) * 0.35 : 0.0;
    col += vec3(0.0, 1.0, 1.0) * (line * 1.2 + trail) * uScan.y;
  }
  // ramka
  float bw = 2.0;
  float edge = smoothstep(-bw - 0.8, -bw + 0.8, sd);
  col = mix(col, uBorder.rgb, edge * uBorder.a);
  float alpha = a * uOpacity * clamp(bgA + edge * uBorder.a, 0.0, 1.0);
  gl_FragColor = vec4(srgb2lin(max(col, 0.0)), alpha);
}`;

export function cardMat(tex, w, h, o = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: CARD_VS, fragmentShader: CARD_FS, transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms: {
      map: { value: tex }, uSize: { value: new THREE.Vector2(w, h) }, uRadius: { value: o.radius ?? 18 },
      uOpacity: { value: 1 }, uPrint: { value: 1 }, uCell: { value: o.cell ?? 9 }, uBright: { value: 1 },
      uInk: { value: new THREE.Vector3(1, 1, 1) },
      uOffC: { value: new THREE.Vector2() }, uOffM: { value: new THREE.Vector2() }, uOffY: { value: new THREE.Vector2() },
      uBorder: { value: new THREE.Vector4(0.2, 0.2, 0.2, 1) }, uScan: { value: new THREE.Vector4(0, 0, 3, 0) },
      uCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
    },
  });
}
export function cardMesh(tex, w, h, o = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cardMat(tex, w, h, o));
  return mesh;
}
// wycinek obrazu "cover" dla proporcji karty
export function coverCrop(img, w, h) {
  const ia = img.width / img.height, ca = w / h;
  if (ia > ca) { const k = ca / ia; return [(1 - k) / 2, 0, (1 + k) / 2, 1]; }
  const k = ia / ca; return [0, 0, 1, k];      // wysokie obrazy: od góry
}

// ------------------------------------------------------------------ gwiazdy (jak #starfield strony: C, M, Y, biel, biel)
const STAR_COLS = [C, M, Y, WHITE, WHITE];
const STARS = Array.from({ length: 190 }, (_, i) => ({
  x: hash(i, 1) * W, y: hash(i, 2) * H, z: 0.25 + 0.75 * hash(i, 3), s: 1.2 + 3.6 * hash(i, 4),
  c: STAR_COLS[Math.floor(hash(i, 5) * 5)], tw: hash(i, 6) * TAU, ts: 0.6 + 1.8 * hash(i, 7),
  vx: (hash(i, 8) - 0.5) * 14, vy: (hash(i, 9) - 0.5) * 14,
}));
/**
 * pushes: [{ cx, cy, w(t) }] — promieniowe odepchnięcie od punktu (ułamek odległości; ujemne ciągnie do środka).
 * Smuga = droga gwiazdy w oknie migawki (dt).
 */
export function drawStars(g, t, o = {}) {
  const { pushes = [], alpha = 1, dt = 1 / 45 } = o;
  const pos = (s, tt) => {
    let x = ((s.x + s.vx * tt) % W + W) % W, y = ((s.y + s.vy * tt) % H + H) % H;
    let px = x, py = y;
    for (const p of pushes) { const k = p.w(tt) * s.z; px += (x - p.cx) * k; py += (y - p.cy) * k; }
    return [px, py];
  };
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.ts + s.tw));
    const a = alpha * tw;
    if (a < 0.02) continue;
    const [x0, y0] = pos(s, t - dt), [x1, y1] = pos(s, t);
    if (Math.abs(x1 - x0) > W / 2 || Math.abs(y1 - y0) > H / 2) continue;   // zawinięcie przy krawędzi
    g.globalAlpha = a;
    g.strokeStyle = g.fillStyle = s.c;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len > 1.5) {
      g.lineWidth = s.s * s.z;
      g.globalAlpha = a * Math.min(1, 6 / len + 0.35);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    } else {
      g.beginPath(); g.arc(x1, y1, s.s * s.z * 0.6, 0, TAU); g.fill();
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ drobne elementy 2D
export function ring(g, x, y, r, w, color, a = 1) {
  if (a <= 0 || r <= 0) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.restore();
}
// fala uderzeniowa w trzech farbach (lekko rozjechanych, jak pasery w druku)
export function shock(g, t, t0, x, y, maxR = 700, dur = 0.55, w = 10, inks = [C, M, Y]) {
  const k = (t - t0) / dur;
  if (k < 0 || k > 1) return;
  const e = eOutExpo(k);
  inks.forEach((col, i) => ring(g, x + (i - 1) * 6 * (1 - e), y + (i - 1) * 3 * (1 - e), maxR * e * (1 - i * 0.04), w * (1 - k), col, (1 - k) * 0.9));
}
// znacznik pasowania drukarskiego ⊕
export function regMark(g, x, y, s, a = 1, color = WHITE) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = color; g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, s * 0.55, 0, TAU);
  g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
  g.restore();
}
// pasek kontrolny CMYK
export function colorBar(g, x, y, s, a = 1, n = 4) {
  if (a <= 0) return;
  const cols = [C, M, Y, WHITE];
  g.save(); g.globalAlpha = a;
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i]; g.fillRect(x + i * (s + 4), y, s, s); }
  g.restore();
}

/** Snop światła z oka (jak #eye-beam strony): stożek od soczewki do celu + łuna na celu. Rysowany na "mid" w trybie lighter. */
export function beam(g, x0, y0, x1, y1, o = {}) {
  const { a = 1, w0 = 18, w1 = 260, color = [0, 255, 255], glowR = 320 } = o;
  if (a <= 0.01) return;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const rgb = color.join(',');
  gr.addColorStop(0, `rgba(${rgb},${0.34 * a})`);
  gr.addColorStop(0.65, `rgba(${rgb},${0.12 * a})`);
  gr.addColorStop(1, `rgba(${rgb},${0.04 * a})`);
  g.fillStyle = gr;
  for (const k of [1, 0.55]) {
    g.beginPath();
    g.moveTo(x0 + nx * w0 * k, y0 + ny * w0 * k);
    g.lineTo(x1 + nx * w1 * k, y1 + ny * w1 * k);
    g.lineTo(x1 - nx * w1 * k, y1 - ny * w1 * k);
    g.lineTo(x0 - nx * w0 * k, y0 - ny * w0 * k);
    g.closePath(); g.fill();
  }
  const rg = g.createRadialGradient(x1, y1, 0, x1, y1, glowR);
  rg.addColorStop(0, `rgba(${rgb},${0.22 * a})`);
  rg.addColorStop(0.55, `rgba(${rgb},${0.07 * a})`);
  rg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rg;
  g.fillRect(x1 - glowR, y1 - glowR, glowR * 2, glowR * 2);
  g.restore();
}

/** Iskry: promieniście od punktu, z grawitacją; kolor z palety CMY. */
export function sparks(g, t, t0, x, y, n = 18, o = {}) {
  const { speed = 900, life = 0.5, seed = 1, grav = 900, cols = [C, M, Y, WHITE] } = o;
  const k = t - t0;
  if (k < 0 || k > life) return;
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed) * TAU, v = speed * (0.4 + 0.6 * hash(i, seed + 1));
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 0.5 * grav * k * k;
    const px0 = x + Math.cos(a) * v * Math.max(0, k - 0.035), py0 = y + Math.sin(a) * v * Math.max(0, k - 0.035) + 0.5 * grav * Math.max(0, k - 0.035) ** 2;
    g.globalAlpha = (1 - k / life);
    g.strokeStyle = cols[i % cols.length];
    g.lineWidth = 3.2 * (1 - k / life) + 0.6;
    g.beginPath(); g.moveTo(px0, py0); g.lineTo(px, py); g.stroke();
  }
  g.restore();
}
