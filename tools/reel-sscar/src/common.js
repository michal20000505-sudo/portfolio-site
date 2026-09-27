// Elementy wspólne: assety, ikony (Font Awesome jak na stronie), komponenty interfejsu w stylu sscar.pl,
// panele 3D (canvas → tekstura na płaszczyźnie w kamerze "pikselowej").
import * as THREE from 'three';
import {
  W, H, CX, CY, RED, RED_HI, RED_GLOW, INK, MUTED, DIM, S1, S2, S3, BORDER, BORDER_ACC, OK,
  clamp, lerp, seg, rad, TAU, loadImage, eOutExpo, eOutBack, eOutCubic, text, setFont, rrect, canvas2d,
} from './core.js';
import { ICONS } from './icons.js';

export const ENV = { renderer: null, pipeline: null, rig: null };
export const IMG = {};

const IMAGES = ['logo', 'm3_hall', 'm3_front', 'geo_stand', 'stacja', 'wear_inner', 'wear_saw', 'wear_center', 'wear_both', 'wear_outer'];
export async function loadAssets() {
  await Promise.all(IMAGES.map(async k => { IMG[k] = await loadImage(`assets/img/${k}.${k === 'logo' ? 'png' : 'webp'}`); }));
}

// ------------------------------------------------------------------ ikony
const PATHS = {};
export function icon(g, name, x, y, size, color = RED, alpha = 1) {
  const ic = ICONS[name];
  if (!ic) return;
  const p = PATHS[name] || (PATHS[name] = new Path2D(ic.d));
  const s = size / Math.max(ic.w, ic.h);
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x - ic.w * s / 2, y - ic.h * s / 2);
  g.scale(s, s);
  g.fillStyle = color;
  g.fill(p);
  g.restore();
}

// ------------------------------------------------------------------ typografia strony
// etykieta: Barlow Condensed 700, wersaliki, rozstrzelenie 0,12 em
export function label(g, str, x, y, o = {}) {
  const size = o.size || 22;
  text(g, str.toUpperCase(), x, y, { family: 'cond', weight: 700, size, spacing: size * 0.12, color: o.color || MUTED, align: o.align, alpha: o.alpha ?? 1 });
}
// nagłówek: Barlow Condensed 900, wersaliki
export function head(g, str, x, y, o = {}) {
  const size = o.size || 72;
  text(g, str.toUpperCase(), x, y, { family: 'cond', weight: 900, size, spacing: size * (o.sp ?? 0.02), color: o.color || INK, align: o.align, alpha: o.alpha ?? 1, italic: o.italic });
}
export function body(g, str, x, y, o = {}) {
  text(g, str, x, y, { family: 'body', weight: o.weight || 500, size: o.size || 32, color: o.color || MUTED, align: o.align, alpha: o.alpha ?? 1 });
}
// czerwona kreska pod h2 (60×3 px na stronie → tu 84×4)
export function rule(g, x, y, p, w = 84, h = 4, color = RED) {
  if (p <= 0) return;
  g.fillStyle = color;
  g.fillRect(x, y, w * eOutExpo(clamp(p)), h);
}

// ------------------------------------------------------------------ komponenty
export function card(g, x, y, w, h, o = {}) {
  rrect(g, x, y, w, h, o.r ?? 10);
  g.fillStyle = o.fill || S1;
  g.fill();
  if (o.border !== null) {
    g.lineWidth = o.lw || 2;
    g.strokeStyle = o.border || BORDER;
    g.stroke();
  }
}
// cień pod kartą (rysowany osobno, żeby nie brudził przezroczystych brzegów)
export function cardShadow(g, x, y, w, h, r = 10, a = 0.55, blur = 60, dy = 24) {
  g.save();
  g.shadowColor = `rgba(0,0,0,${a})`;
  g.shadowBlur = blur;
  g.shadowOffsetY = dy;
  rrect(g, x, y, w, h, r);
  g.fillStyle = '#000';
  g.fill();
  g.restore();
}
// numer kroku w kółku (rezerwacja): aktywny = czerwone koło, zablokowany = obrys
export function stepNum(g, n, x, y, state, doneP = 0) {
  const r = 27;
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  if (state === 'active' || state === 'done') { g.fillStyle = RED; g.fill(); }
  else { g.lineWidth = 2; g.strokeStyle = BORDER_ACC; g.stroke(); }
  g.restore();
  if (doneP > 0) {
    checkMark(g, x, y, 26, doneP, INK, 4);
    if (doneP < 1) text(g, String(n), x, y + 10, { family: 'cond', weight: 900, size: 30, align: 'center', color: INK, alpha: 1 - doneP });
  } else text(g, String(n), x, y + 10, { family: 'cond', weight: 900, size: 30, align: 'center', color: state === 'locked' ? RED : INK });
}
// ptaszek rysowany kreską (p: 0 → 1)
export function checkMark(g, x, y, s, p, color = INK, lw = 5) {
  if (p <= 0) return;
  const pts = [[-0.42, 0.02], [-0.12, 0.32], [0.46, -0.3]];
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const L = (l1 + l2) * clamp(p);
  g.save();
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x + pts[0][0] * s, y + pts[0][1] * s);
  if (L <= l1) { const k = L / l1; g.lineTo(x + lerp(pts[0][0], pts[1][0], k) * s, y + lerp(pts[0][1], pts[1][1], k) * s); }
  else {
    g.lineTo(x + pts[1][0] * s, y + pts[1][1] * s);
    const k = (L - l1) / l2;
    g.lineTo(x + lerp(pts[1][0], pts[2][0], k) * s, y + lerp(pts[1][1], pts[2][1], k) * s);
  }
  g.stroke();
  g.restore();
}
// przycisk w stylu strony (czerwony, Barlow Condensed 800, wersaliki); press: 0..1 wciśnięcia
export function button(g, x, y, w, h, str, o = {}) {
  const press = o.press || 0, glow = o.glow || 0;
  const s = 1 - 0.035 * press;
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.scale(s, s);
  if (glow > 0) { g.shadowColor = `rgba(226,32,32,${0.55 * glow})`; g.shadowBlur = 40 * glow; }
  rrect(g, -w / 2, -h / 2, w, h, o.r ?? 8);
  g.fillStyle = o.fill || RED;
  g.fill();
  g.shadowBlur = 0;
  if (o.border) { g.lineWidth = 2; g.strokeStyle = o.border; g.stroke(); }
  const size = o.size || 32;
  const tw = (o.icon ? size * 1.25 : 0);
  setFont(g, { family: 'cond', weight: 800, size, spacing: size * 0.08 });
  const lw = g.measureText(str.toUpperCase()).width;
  if (o.icon) icon(g, o.icon, -(lw + tw) / 2 + size * 0.45, 0, size * 0.95, o.color || INK);
  text(g, str.toUpperCase(), tw / 2, size * 0.36, { family: 'cond', weight: 800, size, spacing: size * 0.08, align: 'center', color: o.color || INK });
  g.restore();
}
// tapnięcie palcem: pierścień rozchodzący się + kropka
export function tap(g, x, y, t, t0) {
  const d = t - t0;
  if (d < -0.12 || d > 0.6) return;
  g.save();
  if (d < 0) {                       // palec nadlatuje
    const k = clamp(-d / 0.12);
    g.globalAlpha = 1 - k;
    g.beginPath(); g.arc(x, y, 30 + 30 * k, 0, TAU);
    g.fillStyle = 'rgba(242,237,236,0.22)'; g.fill();
  } else {
    const k = clamp(d / 0.6);
    g.beginPath(); g.arc(x, y, 30 + 70 * eOutCubic(k), 0, TAU);
    g.lineWidth = 3 * (1 - k); g.strokeStyle = `rgba(242,237,236,${0.7 * (1 - k)})`; g.stroke();
    const k2 = clamp(d / 0.25);
    g.beginPath(); g.arc(x, y, 30 * (1 - 0.2 * k2), 0, TAU);
    g.fillStyle = `rgba(242,237,236,${0.3 * (1 - k2)})`; g.fill();
  }
  g.restore();
}

// ------------------------------------------------------------------ kamera "pikselowa": 1 jednostka = 1 px na z = 0
export function pixelCam(fov = 30) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 10, 40000);
  cam.position.set(0, 0, (H / 2) / Math.tan(rad(fov / 2)));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}
export const wx = x => x - CX;
export const wy = y => CY - y;

// ------------------------------------------------------------------ panele 3D
const PANEL_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PANEL_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D map;
uniform float opacity, sheen, sheenPos, bright;
void main() {
  vec4 c = texture2D(map, vUv);                 // mnożone alfa
  float band = exp(-pow((vUv.x * 0.75 + (1.0 - vUv.y) * 0.45 - sheenPos) / 0.07, 2.0)) * sheen;
  c.rgb = c.rgb * bright + band * c.a * 0.22;
  gl_FragColor = c * opacity;
}`;

export class PanelLayer {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = pixelCam(30);
    this.list = [];
  }
  item() {
    const any = this.list.some(p => p.mesh.visible);
    return any ? { scene: this.scene, camera: this.cam } : null;
  }
  hideAll() { for (const p of this.list) p.mesh.visible = false; }
}

// Panel: płaszczyzna w − pad…w + pad; rysujemy w układzie panelu (0,0 = lewy górny róg treści).
export class Panel {
  constructor(layer, w, h, o = {}) {
    this.w = w; this.h = h; this.pad = o.pad ?? 60; this.scale = o.scale ?? 1;
    const cw = Math.ceil((w + this.pad * 2) * this.scale), ch = Math.ceil((h + this.pad * 2) * this.scale);
    [this.c, this.g] = canvas2d(cw, ch);
    const t = this.tex = new THREE.CanvasTexture(this.c);
    t.colorSpace = THREE.NoColorSpace;
    t.premultiplyAlpha = true;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PANEL_VS, fragmentShader: PANEL_FS,
      uniforms: { map: { value: t }, opacity: { value: 1 }, sheen: { value: 0 }, sheenPos: { value: 0 }, bright: { value: 1 } },
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w + this.pad * 2, h + this.pad * 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.pivot = new THREE.Group();
    this.pivot.add(this.mesh);
    layer.scene.add(this.pivot);
    layer.list.push(this);
    this.static = false;
    this.drawn = false;
  }
  // fn(g) rysuje treść; dla paneli statycznych rysujemy raz
  draw(fn) {
    if (this.static && this.drawn) return;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.clearRect(0, 0, this.c.width, this.c.height);
    g.setTransform(this.scale, 0, 0, this.scale, this.pad * this.scale, this.pad * this.scale);
    fn(g);
    this.tex.needsUpdate = true;
    this.drawn = true;
  }
  // x, y: środek treści w px kadru; rx/ry/rz w radianach; z w px (dodatnie = bliżej kamery); ox/oy: punkt obrotu względem środka
  place({ x = CX, y = CY, z = 0, rx = 0, ry = 0, rz = 0, s = 1, opacity = 1, sheen = 0, sheenPos = 0, bright = 1, ox = 0, oy = 0, order = 0 }) {
    const vis = opacity > 0.002;
    this.mesh.visible = vis;
    if (!vis) return;
    this.pivot.position.set(wx(x + ox), wy(y + oy), z);
    this.pivot.rotation.set(rx, ry, rz, 'YXZ');
    this.pivot.scale.setScalar(s);
    this.mesh.position.set(-ox, oy, 0);
    this.mesh.renderOrder = order;
    const u = this.mat.uniforms;
    u.opacity.value = opacity; u.sheen.value = sheen; u.sheenPos.value = sheenPos; u.bright.value = bright;
  }
}
