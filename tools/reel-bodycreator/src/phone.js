// Telefon 3D ze stroną Body Creator: bryła (wyciągnięty zaokrąglony prostokąt, czarny tytan),
// ekran = canvas składany co klatkę ze zrzutów sekcji (DPR 2), pozy telefonu w funkcji beatu.
// Pozy są czystymi funkcjami czasu — scena otwarcia liczy z nich, gdzie jest ekran, żeby napis "wpadł" w nagłówek strony.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  W, H, CX, CY, GOLD, OBSIDIAN, ICE, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eInOutCubic, eOutCubic, eInOutQuint, eOutBack, noise1, rrect, canvas2d, setFont,
} from './core.js';
import { IMG, META, ENV, cardMat, wx, wy } from './common.js';

// ------------------------------------------------------------------ wymiary (px kadru przy skali 1)
export const PH = { CSS_W: 390, CSS_H: 844, SB: 47, SW: 520, BEZ: 15, R: 68, DEPTH: 40, Y: 1040 };
PH.K = PH.SW / PH.CSS_W;                  // px kadru na px CSS strony
PH.SH = PH.CSS_H * PH.K;
PH.VIEW = PH.CSS_H - PH.SB;               // wysokość widocznej strony pod paskiem statusu (CSS)
export const PULL0 = 1.55, PULL1 = 2.0;   // beaty: odjazd kamery z pełnego kadru do telefonu
export const S_FULL = W / PH.SW;          // skala, przy której ekran ma szerokość kadru

// ------------------------------------------------------------------ strona: sekcje ułożone jedna pod drugą
export const PAGE = [];
export function pageLayout() {
  const s = META.site.sections;
  let y = 0;
  for (const [key, img] of [['hero', 'sec_hero_2x'], ['offer', 'sec_offer_2x'], ['team2', 'sec_team2_2x'], ['reviews', 'sec_reviews_2x'], ['pagesnav', 'sec_pagesnav_2x']]) {
    PAGE.push({ key, img, y, h: s[key].h });
    y += s[key].h;
  }
  PAGE.total = y;
}
export const secTop = key => PAGE.find(p => p.key === key).y;
// element strony (z site.json) w CSS wirtualnej strony
export function elemRect(name) {
  const e = META.site.elements[name];
  return { x: e.x, y: secTop(e.sec) + e.y, w: e.w, h: e.h };
}
const centerScroll = r => clamp(r.y + r.h / 2 - PH.VIEW / 2, 0, PAGE.total - PH.VIEW);

// przewijanie (CSS px) — szybkie "flicki" między elementami, zsynchronizowane z beatami
export const SCROLL_KEYS = [];
export function scrollInit() {
  const team = elemRect('team0'), team3 = elemRect('team3');
  const tr = { x: team.x, y: team.y, w: team3.x + team3.w - team.x, h: team3.y + team3.h - team.y };
  SCROLL_KEYS.push(
    [2.35, 2.9, centerScroll(elemRect('service0'))],
    [3.95, 4.4, centerScroll(tr) + 12],
    [5.4, 5.85, centerScroll(elemRect('review')) - 40],
    [6.62, 7.0, centerScroll(elemRect('cta')) + 60],
  );
}
export function scrollAt(B) {
  let y = 0;
  for (const [b0, b1, v] of SCROLL_KEYS) y = lerp(y, v, eInOutCubic(seg(B, b0, b1)));
  return y;
}

// ------------------------------------------------------------------ poza telefonu
// zwraca środek ekranu w px kadru (x, y), głębokość z, skalę s i obroty (rad)
export function phonePose(B, t) {
  const p = { x: CX, y: CY, z: 0, s: S_FULL, rx: 0, ry: 0, rz: 0 };
  if (B < PULL0) return p;
  const e = eInOutCubic(seg(B, PULL0, PULL1));
  p.s = Math.exp(lerp(Math.log(S_FULL), 0, e));
  p.y = lerp(CY, PH.Y, e);
  if (B <= PULL1) return p;
  // swobodny ruch w trakcie przeglądu strony
  const turn = eOutCubic(seg(B, 2.05, 2.8));
  const face = eInOutCubic(seg(B, 6.55, 7.05));          // przodem do kamery przed tapnięciem
  const live = turn * (1 - face);
  p.ry = rad(-15) * live + rad(5) * seg(B, 2.8, 6.5) * live;
  p.rx = rad(6) * live + rad(2) * Math.sin(t * 1.1) * live;
  p.rz = rad(-2.2) * live;
  p.y += 10 * Math.sin(t * 1.7) * live;
  p.x += 6 * noise1(t * 0.8, 3) * live;
  // cofnięcie przy wyskakujących elementach
  const pop = popWeight(B);
  p.s *= 1 - 0.05 * pop;
  p.z -= 90 * pop;
  // nurkowanie w kartę "Darmowa konsultacja"
  const u = seg(B, DIVE0, DIVE1);
  if (u > 0) {
    const r = elemRect('cta');
    const sc = scrollAt(B);
    const cx = (r.x + r.w / 2 - PH.CSS_W / 2) * PH.K;
    const cy = (PH.SB + r.y + r.h / 2 - sc - PH.CSS_H / 2) * PH.K;
    p.s = Math.exp(Math.log(11) * Math.pow(u, 2.2));      // przyspieszający najazd; karta zakrywa kadr ok. B7.92
    const e2 = eInOutCubic(u);
    const fx = lerp(p.x + cx, CX, e2), fy = lerp(p.y + cy, CY, e2);
    p.x = fx - cx * p.s;
    p.y = fy - cy * p.s;
  }
  return p;
}
export const DIVE0 = 7.3, DIVE1 = 7.95;
export const TAP_B = 7.25;
// jak mocno "wyskoczył" któryś element (0..1) — telefon się wtedy cofa i przygasa
export const POPS = [
  { b0: 3.0, b1: 3.85 }, { b0: 4.5, b1: 5.3 }, { b0: 6.0, b1: 6.6 },
];
export function popWeight(B) {
  let w = 0;
  for (const p of POPS) w = Math.max(w, eOutCubic(seg(B, p.b0, p.b0 + 0.3)) * (1 - eInOutCubic(seg(B, p.b1, p.b1 + 0.25))));
  return w;
}
// prostokąt ekranu w px kadru — ważny, gdy telefon stoi przodem (do B = PULL1)
export function screenRect(B, t) {
  const p = phonePose(B, t);
  const w = PH.SW * p.s, h = PH.SH * p.s;
  return { x: p.x - w / 2, y: p.y - h / 2, w, h, s: p.s };
}
// punkt strony (CSS, przy danym przewinięciu) → px kadru, gdy telefon stoi przodem
export function cssToFrame(B, t, x, y, scroll = 0) {
  const r = screenRect(B, t);
  const k = PH.K * r.s;
  return [r.x + x * k, r.y + (PH.SB + y - scroll) * k];
}

// ------------------------------------------------------------------ budowa
let group, body, screen, scrC, scrG, scrTex;
export function buildPhone(scene) {
  const pm = new THREE.PMREMGenerator(ENV.renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  group = new THREE.Group();
  scene.add(group);
  // bryła
  const bw = PH.SW + 2 * PH.BEZ, bh = PH.SH + 2 * PH.BEZ, r = PH.R;
  const shape = new THREE.Shape();
  shape.moveTo(-bw / 2 + r, -bh / 2);
  shape.lineTo(bw / 2 - r, -bh / 2); shape.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + r);
  shape.lineTo(bw / 2, bh / 2 - r); shape.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - r, bh / 2);
  shape.lineTo(-bw / 2 + r, bh / 2); shape.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - r);
  shape.lineTo(-bw / 2, -bh / 2 + r); shape.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + r, -bh / 2);
  const bev = 7;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: PH.DEPTH - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 6, curveSegments: 24 });
  geo.translate(0, 0, -(PH.DEPTH - 2 * bev) / 2);
  body = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x17171a, metalness: 0.92, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 1.1 }));
  group.add(body);
  // przyciski boczne
  const btnMat = new THREE.MeshPhysicalMaterial({ color: 0x1c1c20, metalness: 0.95, roughness: 0.3 });
  for (const [x, y, h] of [[-bw / 2 - 2, 250, 60], [-bw / 2 - 2, 150, 95], [-bw / 2 - 2, 40, 95], [bw / 2 + 2, 170, 150]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, h, 14), btnMat);
    b.position.set(x, y, 0);
    group.add(b);
  }
  // ekran
  [scrC, scrG] = canvas2d(PH.CSS_W * 2, PH.CSS_H * 2);
  scrTex = new THREE.CanvasTexture(scrC);
  scrTex.colorSpace = THREE.NoColorSpace;
  scrTex.minFilter = THREE.LinearMipmapLinearFilter;
  scrTex.anisotropy = 8;
  const mat = cardMat(scrTex, PH.SW / PH.SH, PH.R - PH.BEZ, PH.SH);
  mat.depthWrite = true;
  screen = new THREE.Mesh(new THREE.PlaneGeometry(PH.SW, PH.SH), mat);
  screen.position.z = PH.DEPTH / 2 + 0.6;
  group.add(screen);
  // światła: chłodne z przodu, złote kontry na krawędziach
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-600, 900, 1400); scene.add(key);
  const rim1 = new THREE.DirectionalLight(0xf5ca00, 3.2); rim1.position.set(1200, 500, -500); scene.add(rim1);
  const rim2 = new THREE.DirectionalLight(0xffd76a, 1.6); rim2.position.set(-1300, -300, -400); scene.add(rim2);
  return group;
}
export const phone = () => ({ group, screen, body });

export function applyPose(p) {
  group.position.set(wx(p.x), wy(p.y), p.z);
  group.rotation.set(p.rx, p.ry, p.rz);
  group.scale.setScalar(p.s);
  group.updateMatrixWorld(true);
}

// ------------------------------------------------------------------ zawartość ekranu
/**
 * holes: [{r: prostokąt CSS strony, a: 0..1}] — miejsca po wyskoczonych elementach (przyciemnione)
 * press: {r, a} — wciśnięta karta
 */
export function drawScreen(t, B, o = {}) {
  const g = scrG, k = 2;
  const scroll = scrollAt(B);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = OBSIDIAN;
  g.fillRect(0, 0, scrC.width, scrC.height);
  // strona
  const top = PH.SB;
  for (const p of PAGE) {
    const y0 = top + p.y - scroll;
    if (y0 > PH.CSS_H || y0 + p.h < top - 2) continue;
    const img = IMG[p.key === 'hero' && o.heroNoTitle ? 'sec_hero_notitle_2x' : p.img];
    g.drawImage(img, 0, y0 * k, scrC.width, p.h * k);
  }
  for (const hole of o.holes || []) {
    if (hole.a <= 0) continue;
    const { x, y, w, h } = hole.r;
    g.save();
    rrect(g, x * k, (top + y - scroll) * k, w * k, h * k, (hole.round ?? 16) * k);
    g.fillStyle = `rgba(0,0,0,${0.72 * hole.a})`;
    g.fill();
    g.lineWidth = 2; g.strokeStyle = `rgba(245,202,0,${0.35 * hole.a})`; g.setLineDash([8, 8]); g.stroke();
    g.restore();
  }
  if (o.press && o.press.a > 0) {
    const { x, y, w, h } = o.press.r;
    rrect(g, x * k, (top + y - scroll) * k, w * k, h * k, 16 * k);
    g.fillStyle = `rgba(0,0,0,${0.16 * o.press.a})`; g.fill();
  }
  // stała nawigacja (przezroczysta nad hero, ciemna po przewinięciu — jak .navbar.scrolled)
  const navImg = scroll > 50 ? IMG.nav_scrolled_2x : IMG.nav_2x;
  const nh = (scroll > 50 ? META.site.navScrolled.h : META.site.nav.h);
  g.drawImage(navImg, 0, top * k, scrC.width, nh * k);
  // pasek statusu + wyspa + wskaźnik "home"
  g.fillStyle = OBSIDIAN; g.fillRect(0, 0, scrC.width, top * k);
  setFont(g, 600, 16 * k);
  g.fillStyle = ICE; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('9:41', 58 * k, 26 * k);
  for (let i = 0; i < 4; i++) g.fillRect((300 + i * 6) * k, (30 - 3 - i * 2.4) * k, 4 * k, (4 + i * 2.4) * k);
  rrect(g, 332 * k, 20 * k, 25 * k, 12 * k, 3.5 * k); g.strokeStyle = ICE; g.lineWidth = 1.2 * k; g.stroke();
  rrect(g, 334 * k, 22 * k, 18 * k, 8 * k, 2 * k); g.fill();
  g.fillRect(358 * k, 24 * k, 1.6 * k, 4 * k);
  rrect(g, (195 - 62) * k, 11 * k, 124 * k, 36 * k, 18 * k); g.fillStyle = '#000'; g.fill();
  rrect(g, (195 - 67) * k, (PH.CSS_H - 13) * k, 134 * k, 5 * k, 2.5 * k); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  scrTex.needsUpdate = true;
  return scroll;
}
export function screenUniforms() { return screen.material.uniforms; }
