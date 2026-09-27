// Elementy wspólne scen: assety (zrzuty strony, zdjęcia, logo, klatki klipu), kamera "pikselowa",
// materiał kart z zaokrąglonymi rogami, komponenty w stylu strony (złota etykieta, pigułka), dotyk, pył.
import * as THREE from 'three';
import {
  W, H, CX, CY, BEAT, bt, GOLD, GOLD_HI, ICE, OBSIDIAN,
  clamp, lerp, seg, rad, TAU, eOutExpo, eInExpo, eOutCubic, eOutBack, decay, hash, rng,
  text, setFont, measure, loadImage, rrect,
} from './core.js';

// ------------------------------------------------------------------ środowisko (ustawiane w main.js)
export const ENV = { renderer: null, pipeline: null };

// ------------------------------------------------------------------ assety
export const IMG = {};
export const TEX = {};
export const META = { site: null, logo: null };
export const CLIP = {};
const FPS_CLIP = 24;

function texOf(img, mips = true) {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.NoColorSpace;          // wartości "ekranowe" — kompozycja liczy w sRGB jak CSS
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mips;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export async function loadAssets() {
  const [site, logo, clips] = await Promise.all([
    fetch('assets/site/site.json').then(r => r.json()),
    fetch('assets/logo/logo.json').then(r => r.json()),
    fetch('assets/clip/clip.json').then(r => r.json()),
  ]);
  META.site = site; META.logo = logo;
  const list = [
    ...['sec_hero_2x', 'sec_hero_notitle_2x', 'sec_offer_2x', 'sec_team2_2x', 'sec_reviews_2x', 'sec_pagesnav_2x', 'nav_2x', 'nav_scrolled_2x'].map(n => [n, `assets/site/${n}.webp`, false]),
    ...['el_service_0', 'el_service_1', 'el_service_2', 'el_service_3', 'el_service_4', 'el_team_0', 'el_team_1', 'el_team_2', 'el_team_3', 'el_review', 'el_cta']
      .map(n => [n, `assets/site/${n}.webp`, true]),
    ...['studio', 'studio2'].map(n => [n, `assets/img/${n}.webp`, true]),
    ...['b', 'c', 'word', 'tag'].map(n => ['logo_' + n, `assets/logo/${n}.png`, true]),
  ];
  await Promise.all(list.map(async ([key, src, tex]) => {
    IMG[key] = await loadImage(src);
    if (tex) TEX[key] = texOf(IMG[key]);
  }));
  // klatki czarno-białych ujęć ze studia (tło strony)
  for (const [name, n] of Object.entries(clips)) {
    const imgs = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`assets/clip/${name}_${String(i + 1).padStart(3, '0')}.jpg`)));
    CLIP[name] = imgs.map(im => texOf(im, false));
    CLIP[name].aspect = imgs[0].width / imgs[0].height;
  }
}
// klatka klipu dla czasu (od początku ujęcia)
export function clipFrame(name, tc) {
  const fr = CLIP[name];
  return fr[clamp(Math.floor(tc * FPS_CLIP), 0, fr.length - 1)];
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
// świat → px ekranu (do kotwiczenia 2D przy obiektach 3D)
const _v = new THREE.Vector3();
export function toScreen(obj, cam, x = 0, y = 0, z = 0) {
  _v.set(x, y, z);
  obj.localToWorld(_v);
  _v.project(cam);
  return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H];
}

// ------------------------------------------------------------------ materiał karty (zrzut elementu strony)
const CARD_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CARD_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform float uOpacity, uBright, uRound, uAspect, uShine, uShinePos, uDark;
uniform vec4 uCrop;          // wycinek tekstury: x, y, w, h (uv, y od góry)
float sdRBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 srgb2lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float d = sdRBox(p, vec2(uAspect * 0.5, 0.5), uRound);
  float mask = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
  vec2 tuv = vec2(uCrop.x + uv.x * uCrop.z, 1.0 - (uCrop.y + (1.0 - uv.y) * uCrop.w));
  vec3 col = texture2D(tMap, tuv).rgb;
  // przesuwający się połysk (światło przesuwa się po "szkle" karty)
  float band = exp(-pow((uv.x + (1.0 - uv.y) * 0.6 - uShinePos) / 0.12, 2.0));
  col += vec3(1.0, 0.95, 0.8) * band * uShine;
  col *= uBright * (gl_FrontFacing ? 1.0 : 0.35);
  col = mix(col, vec3(0.0), uDark);
  gl_FragColor = vec4(srgb2lin(clamp(col, 0.0, 1.0)), mask * uOpacity);
}`;
export function cardMat(tex, aspect, roundPx, heightPx) {
  return new THREE.ShaderMaterial({
    vertexShader: CARD_VS, fragmentShader: CARD_FS,
    uniforms: {
      tMap: { value: tex }, uOpacity: { value: 1 }, uBright: { value: 1 }, uRound: { value: roundPx / heightPx }, uAspect: { value: aspect },
      uShine: { value: 0 }, uShinePos: { value: -1 }, uDark: { value: 0 }, uCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
    },
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
}
// karta z obrazka IMG[name]: szerokość w px świata, zaokrąglenie w px CSS strony (zrzuty są w DPR 3)
export function cardMesh(name, width, roundCss = 16) {
  const img = IMG[name];
  const aspect = img.width / img.height;
  const h = width / aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), cardMat(TEX[name], aspect, roundCss * 3 * (h / img.height), h));
  mesh.userData = { aspect, w: width, h };
  return mesh;
}
// miękki cień pod kartą (ciemny, rozmyty prostokąt z przezroczystością)
let shadowTex = null;
export function shadowMesh(w, h) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.filter = 'blur(22px)';
    g.fillStyle = '#000';
    rrect(g, 48, 48, 160, 160, 24); g.fill();
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, h * 1.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.6, depthWrite: false, color: 0x000000 }));
  return m;
}

// ------------------------------------------------------------------ komponenty w stylu strony
/** Złota etykieta sekcji (.section-label): caps, szeroki odstęp; lines = kreski po bokach jak w "— NASZ ZESPÓŁ —". */
export function goldLabel(g, str, x, y, o = {}) {
  const { size = 28, reveal = 1, alpha = 1, lines = true, align = 'center', color = GOLD } = o;
  if (reveal <= 0 || alpha <= 0) return;
  const sp = size * 0.3 * (1 + 0.8 * (1 - reveal));
  const w = measure(g, str, 700, size, sp);
  const x0 = align === 'center' ? x - w / 2 : x;
  g.save();
  g.beginPath(); g.rect(x0 - 200, y - size * 1.2, (w + 400) * eOutCubic(reveal), size * 2); g.clip();
  text(g, str, x0, y, { weight: 700, size, spacing: sp, color, alpha: alpha * clamp(reveal * 2) });
  if (lines) {
    const lw = 64 * eOutExpo(reveal), gap = 24;
    g.globalAlpha = alpha * 0.9;
    g.fillStyle = color;
    g.fillRect(x0 - gap - lw, y - size * 0.36, lw, 2.5);
    g.fillRect(x0 + w + gap, y - size * 0.36, lw, 2.5);
    g.globalAlpha = 1;
  }
  g.restore();
}

/** Przycisk-pigułka jak .btn-primary: złote tło, ciemny tekst caps, strzałka. */
export function pill(g, x, y, w, h, str, o = {}) {
  const { size = 34, alpha = 1, press = 0, glow = 0, arrow = true, fill = GOLD, fg = OBSIDIAN } = o;
  if (alpha <= 0) return;
  const s = 1 - 0.04 * press;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y); g.scale(s, s); g.translate(-x, -y);
  if (glow > 0) {       // CTA Glow ze strony: 0 10px 30px rgba(242,201,76,.3)
    g.shadowColor = `rgba(247,181,0,${0.55 * glow})`; g.shadowBlur = 60 * glow; g.shadowOffsetY = 14 * glow;
  }
  rrect(g, x - w / 2, y - h / 2, w, h, h / 2);
  g.fillStyle = fill; g.fill();
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  const sp = size * 0.03;
  const tw = measure(g, str, 700, size, sp);
  const aw = arrow ? size * 1.25 : 0;
  const tx = x - (tw + aw) / 2;
  text(g, str, tx, y + size * 0.36, { weight: 700, size, spacing: sp, color: fg, alpha });
  if (arrow) arrowGlyph(g, tx + tw + aw * 0.62, y, size * 0.62, fg, size * 0.11);
  g.restore();
}
export function arrowGlyph(g, x, y, s, color, lw) {
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x - s * 0.55, y); g.lineTo(x + s * 0.5, y);
  g.moveTo(x + s * 0.05, y - s * 0.45); g.lineTo(x + s * 0.5, y); g.lineTo(x + s * 0.05, y + s * 0.45);
  g.stroke();
}

/** Wskaźnik dotyku (jak "pokaż dotknięcia" przy nagraniu ekranu): miękki krąg, przy tapnięciu wciśnięcie + złoty pierścień. */
export function touch(g, t, x, y, o = {}) {
  const { t0 = -9, tTap = -9, t1 = 9, r = 42 } = o;
  const inA = eOutCubic(seg(t, t0, t0 + 0.12)), out = seg(t, t1, t1 + 0.15);
  const a = inA * (1 - out);
  if (a > 0.001) {
    const press = Math.exp(-Math.pow((t - tTap - 0.03) / 0.07, 2));
    const rr = r * (1 - 0.22 * press) * (0.85 + 0.15 * inA);
    g.save();
    g.globalAlpha = a;
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 24; g.shadowOffsetY = 6;
    g.fillStyle = `rgba(255,255,255,${0.30 + 0.25 * press})`;
    g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke();
    g.restore();
  }
  // pierścień po tapnięciu
  const u = seg(t, tTap, tTap + 0.5);
  if (u > 0 && u < 1) {
    for (let k = 0; k < 2; k++) {
      const e = eOutExpo(seg(t, tTap + k * 0.05, tTap + 0.5));
      g.globalAlpha = Math.pow(1 - e, 1.4) * 0.9;
      g.strokeStyle = k ? GOLD_HI : GOLD; g.lineWidth = 5 * (1 - e) + 1;
      g.beginPath(); g.arc(x, y, r * (1 + 2.6 * e), 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ złoty pył (drobinki w powietrzu, 3 plany głębi)
const DUST = [];
{
  const r = rng(77);
  for (let i = 0; i < 150; i++) DUST.push({ x: r() * W, y: r() * H, z: r(), ph: r() * TAU, sp: 0.4 + r() * 0.8, gold: r() < 0.7 });
}
export function dust(g, t, amount = 1, o = {}) {
  if (amount <= 0) return;
  const { rise = 38, drift = 1, zoom = 1 } = o;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const p of DUST) {
    const depth = 0.35 + p.z * 1.3;                    // bliżej = większe, szybsze
    let y = (p.y - t * rise * depth * p.sp) % H; if (y < 0) y += H;
    const x = p.x + Math.sin(t * 0.6 * p.sp + p.ph) * 26 * depth * drift;
    const sx = CX + (x - CX) * zoom, sy = CY + (y - CY) * zoom;
    const tw = 0.55 + 0.45 * Math.sin(t * 2.3 * p.sp + p.ph * 3);
    const r = (1.2 + p.z * p.z * 5.5) * zoom;
    const a = amount * tw * (0.1 + 0.28 * (1 - Math.abs(p.z - 0.45)));
    const grd = g.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2);
    const col = p.gold ? '255,214,90' : '255,255,255';
    grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd;
    g.fillRect(sx - r * 2.2, sy - r * 2.2, r * 4.4, r * 4.4);
  }
  g.restore();
}

// iskry / drobinki wybuchu (deterministyczne) — smugi w kierunku ruchu
export function makeBurst(seed, n, speed, life = [0.35, 0.9], spread = [0, TAU]) {
  const r = rng(seed * 9973 + 11);
  const ps = [];
  for (let i = 0; i < n; i++) {
    ps.push({ a: spread[0] + r() * (spread[1] - spread[0]), sp: speed * (0.25 + 0.75 * Math.sqrt(r())), life: life[0] + r() * (life[1] - life[0]), w: 1.5 + r() * 3.5, hi: r() < 0.35 });
  }
  return ps;
}
export function drawBurst(g, ps, t, t0, x, y, o = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.6) return;
  const K = o.drag ?? 5, r0 = o.r0 ?? 20, grav = o.grav ?? 260;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (const p of ps) {
    const u = dt / p.life;
    if (u >= 1) continue;
    const dd = p.sp * (1 - Math.exp(-K * dt)) / K, v = p.sp * Math.exp(-K * dt);
    const cx = Math.cos(p.a), sy = Math.sin(p.a);
    const px = x + cx * (dd + r0), py = y + sy * (dd + r0) + 0.5 * grav * dt * dt;
    const vy = sy * v + grav * dt;
    const vl = Math.hypot(cx * v, vy) || 1;
    const tail = Math.max(2, vl * 0.025);
    g.strokeStyle = p.hi ? GOLD_HI : GOLD; g.globalAlpha = Math.pow(1 - u, 1.3); g.lineWidth = p.w * (1 - u * 0.6);
    g.beginPath(); g.moveTo(px, py); g.lineTo(px - cx * v / vl * tail, py - vy / vl * tail); g.stroke();
  }
  g.restore();
}
export function ring(g, x, y, r, w, color, alpha) {
  if (alpha <= 0.002 || r <= 0) return;
  g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.globalAlpha = 1;
}
export function shockRing(g, t, t0, x, y, R, dur = 0.6, w = 7) {
  if (t < t0 || t > t0 + dur + 0.1) return;
  for (let k = 0; k < 2; k++) {
    const e = eOutExpo(seg(t, t0 + k * 0.04, t0 + dur));
    ring(g, x, y, R * e * (1 + k * 0.08), w * (1 - e) + 0.8, k ? GOLD_HI : GOLD, Math.pow(1 - e, 1.3) * 0.9);
  }
}

// ------------------------------------------------------------------ "skrzydło" z logo BC — ukośne cięcie przejść
export const SLASH = Math.tan(rad(34));      // nachylenie krawędzi skrzydeł w logo (dx/dy)
// wielokąt pasa ukośnego "\" (jak lewe krawędzie skrzydeł B): krawędź w x = e na wysokości środka kadru, szerokość w
export function slashPath(g, e, w) {
  const k = H / 2 * SLASH;
  g.beginPath();
  g.moveTo(e - w - k, 0); g.lineTo(e - k, 0);
  g.lineTo(e + k, H); g.lineTo(e - w + k, H);
  g.closePath();
}

// ------------------------------------------------------------------ pomocnicze do bg
export const bgEntry = (tex, aspect, w, o = {}) => ({ tex, aspect, w, ...o });
