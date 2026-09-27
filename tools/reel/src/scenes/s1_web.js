// S1 — STRONY WWW (B8–B16): telefon 3D z prawdziwymi stronami przewijanymi na beatach,
// za nim helisa ze zrzutami desktopowymi, w tle tunel z okien przeglądarki.
import * as THREE from 'three';
import {
  W, H, CX, BEAT, S16, bt, C, M, Y, INK, GREY, BORDER, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eInOutExpo, eOutBack, eInOutCubic, eInCubic, eOutCubic, decay, pulse, hash,
  inkText, inkOff, scramble, measure, rrect, canvas2d,
} from '../core.js';
import { IMG, TEX, pixelCam, wx, wy, planeMat, imagePlane, sectionTitle, bgEntry } from '../common.js';

const B0 = 8;
const SITES = [
  { key: 'sscar', name: 'SSCAR.PL', cat: 'SERWIS AUTO · SYSTEM REZERWACJI', at: 0 },
  { key: 'bodycreator', name: 'BODYCREATOR.COM.PL', cat: 'STUDIO TRENINGOWE', at: 2 },
  { key: 'handybruk', name: 'HANDYBRUK.PL', cat: 'FIRMA USŁUGOWA · WROCŁAW', at: 4 },
  { key: 'rmax', name: 'R-MAX AUTO', cat: 'SERWIS SAMOCHODOWY', at: 6 },
];
const DESK = ['web_sscar', 'web_bodycreator', 'web_handybruk', 'web_rmax', 'web_autofutura', 'web_fault_08', 'web_sentracker_trc01', 'web_steam1'];
const PH_W = 470, PH_H = 960, PH_S = 1.3, PH_Y = 1115;

let scene, cam, phone, phoneMat, phC, phG, phTex, helix = [], helixGroup;

function siteAt(L) { let i = 0; for (let k = 0; k < SITES.length; k++) if (L >= SITES[k].at - 0.001) i = k; return i; }

// przewinięcie strony (w px obrazka): dwa "flicki" na stronę, zsynchronizowane z beatami
function scrollOf(i, L) {
  const s = SITES[i];
  let y = 0;
  for (const [b, d] of [[s.at + 0.5, 820], [s.at + 1.25, 900]]) y += d * eOutExpo(seg(L, b, b + 0.9));
  return y;
}

function drawPhone(t, L) {
  const g = phG, w = phC.width, h = phC.height, s = PH_S;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  rrect(g, 0, 0, w, h, 72 * s);
  g.fillStyle = '#0b0b0b'; g.fill();
  g.lineWidth = 4 * s; g.strokeStyle = '#3c3c3c'; g.stroke();
  const bx = 13 * s, by = 13 * s, bw = w - 2 * bx, bh = h - 2 * by, sb = 46 * s;
  g.save();
  rrect(g, bx, by, bw, bh, 60 * s); g.clip();
  g.fillStyle = '#000000'; g.fillRect(bx, by, bw, bh);
  const cur = siteAt(L);
  const drawSite = (i, ox) => {
    const img = IMG['m_' + SITES[i].key];
    const sc = bw / img.width;
    const vis = (bh - sb) / sc;
    const sy = clamp(scrollOf(i, L), 0, img.height - vis);
    g.drawImage(img, 0, sy, img.width, vis, bx + ox, by + sb, bw, bh - sb);
  };
  // przesunięcie palcem między stronami (L2 i L6); w L4 zmiana w połowie obrotu 3D
  const sw = SITES[cur].at;
  const swipe = (sw === 2 || sw === 6) ? eInOutCubic(seg(L, sw - 0.12, sw + 0.3)) : 1;
  if (swipe < 1 && cur > 0) {
    drawSite(cur - 1, -swipe * bw);
    drawSite(cur, (1 - swipe) * bw);
  } else drawSite(cur, 0);
  // pasek statusu
  g.fillStyle = '#000000'; g.fillRect(bx, by, bw, sb);
  g.fillStyle = '#ffffff';
  g.font = `600 ${17 * s}px "Space Grotesk"`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('9:41', bx + 34 * s, by + sb * 0.55);
  for (let k = 0; k < 4; k++) g.fillRect(w - bx - 88 * s + k * 7 * s, by + sb * 0.7 - (4 + k * 3) * s, 4.5 * s, (4 + k * 3) * s);
  rrect(g, w - bx - 50 * s, by + sb * 0.38, 26 * s, 13 * s, 3.5 * s); g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 * s; g.stroke();
  g.fillRect(w - bx - 47.5 * s, by + sb * 0.38 + 2.5 * s, 19 * s, 8 * s);
  // dotyk + gest przewijania
  const site = SITES[cur];
  for (const b of [site.at + 0.5, site.at + 1.25]) {
    const u = seg(L, b - 0.05, b + 0.55);
    if (u <= 0 || u >= 1) continue;
    const fy = by + bh * lerp(0.78, 0.42, eOutCubic(seg(L, b - 0.05, b + 0.3)));
    const fx_ = bx + bw * 0.58;
    g.globalAlpha = (1 - u) * 0.8;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.arc(fx_, fy, 30 * s, 0, TAU); g.fill();
    g.strokeStyle = C; g.lineWidth = 3 * s;
    g.beginPath(); g.arc(fx_, fy, (30 + 70 * eOutExpo(u)) * s, 0, TAU); g.stroke();
    g.globalAlpha = 1;
  }
  g.restore();
  // wyspa
  rrect(g, w / 2 - 62 * s, by + 10 * s, 124 * s, 34 * s, 17 * s); g.fillStyle = '#000000'; g.fill();
  // odblask szkła
  const gl = g.createLinearGradient(0, 0, w, h);
  gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0.04)');
  g.fillStyle = gl; rrect(g, bx, by, bw, bh, 60 * s); g.fill();
  phTex.needsUpdate = true;
}

function chip(g, t, L) {
  const i = siteAt(L), s = SITES[i];
  const t0 = bt(B0 + s.at + (i === 0 ? 0.4 : 0.05));
  const tNext = i < 3 ? bt(B0 + SITES[i + 1].at - 0.08) : bt(B0 + 7.4);
  const e = eOutExpo(seg(t, t0, t0 + 0.4)), out = eInExpo(seg(t, tNext, tNext + 0.14));
  if (e <= 0 || out >= 1) return;
  const x = 70 - (1 - e) * 420 - out * 600, y = 1452;
  const name = scramble(s.name, t, t0, 0.3, i + 2);
  const nw = measure(g, s.name, 700, 36, 0), cw = measure(g, s.cat, 500, 19, 2.6);
  const w = Math.max(nw, cw) + 64, h = 104;
  rrect(g, x, y - h / 2, w, h, 16);
  g.fillStyle = 'rgba(12,12,12,0.94)'; g.fill();
  g.strokeStyle = BORDER; g.lineWidth = 2; g.stroke();
  g.fillStyle = INK[i % 3]; g.fillRect(x, y - h / 2 + 18, 5, h - 36);
  inkText(g, name, x + 32, y - 4, { weight: 700, size: 36, align: 'left' });
  inkText(g, s.cat, x + 32, y + 30, { weight: 500, size: 19, align: 'left', color: GREY, spacing: 2.6 });
}

export default {
  name: 'web', b0: 8, b1: 16, pre: 0, post: 0.02,
  async load() {
    scene = new THREE.Scene();
    cam = pixelCam(30);
    [phC, phG] = canvas2d(Math.round(PH_W * PH_S), Math.round(PH_H * PH_S));
    phTex = new THREE.CanvasTexture(phC);
    phTex.colorSpace = THREE.NoColorSpace; phTex.minFilter = THREE.LinearFilter; phTex.generateMipmaps = false; phTex.anisotropy = 8;
    phoneMat = planeMat(phTex, PH_W / PH_H, { round: 72 / PH_H });
    phone = new THREE.Mesh(new THREE.PlaneGeometry(PH_W, PH_H), phoneMat);
    phone.renderOrder = 10;
    scene.add(phone);
    helixGroup = new THREE.Group();
    scene.add(helixGroup);
    for (let i = 0; i < 14; i++) {
      const m = imagePlane(DESK[i % DESK.length], 600, { round: 0.03 });
      m.material.uniforms.uFog.value.set(4300, 6300);
      m.material.uniforms.uBackDim.value = 0.4;
      helix.push(m);
      helixGroup.add(m);
    }
  },
  frame(S, Ls) {
    const { t, B } = S, L = B - B0, fx = S.fx;
    const front = Ls.front.g;
    // tło: tunel okien
    S.bgs.push(bgEntry(2, [0.34 * seg(L, 0, 0.6), 1.1 * t, 0.035 + 0.05 * Math.sin(t), 0.1 * Math.sin(t * 0.7)], [0.52, 0.09, 0.006, 0]));
    // telefon
    drawPhone(t, L);
    const enter = eOutExpo(seg(L, -0.02, 1.1));
    let ry = rad(38) * (1 - eOutBack(seg(L, 0, 1.2), 1.2));
    ry += TAU * eInOutExpo(seg(L, 3.7, 4.35));                 // pełny obrót przy zmianie strony w L4
    ry += rad(90) * eInCubic(seg(L, 7.45, 8.0));                // wyjście: bokiem, do sceny druku
    const rz = rad(-9) * (1 - enter) + rad(2) * Math.sin(t * 1.3) * (1 - seg(L, 7, 8));
    const sc = lerp(0.2, 1, enter) * (1 + 0.025 * pulse(t, bt(Math.floor(B)), 0.12));
    phone.position.set(wx(CX) + 8 * Math.sin(t * 1.7), wy(PH_Y) + 10 * Math.sin(t * 2.1), 0);
    phone.rotation.set(rad(4) * Math.sin(t * 1.1), ry + rad(6) * Math.sin(t * 0.9), rz);
    phone.scale.setScalar(sc);
    phoneMat.uniforms.uOpacity.value = seg(L, -0.02, 0.25);
    // helisa zrzutów
    let spin = 0.55 * t;
    for (let b = 0; b < 8; b++) spin += rad(26) * eOutBack(seg(L, b, b + 0.6), 1.5);
    spin += 3.5 * eInCubic(seg(L, 6.8, 8));
    const lift = 140 * t + 260 * eInCubic(seg(L, 6.8, 8));
    const spread = eOutExpo(seg(L, 0.1, 1.4));
    helixGroup.position.set(0, wy(1000), -1550);
    helixGroup.rotation.set(rad(9), 0, rad(-7));
    helix.forEach((m, i) => {
      const a = i * TAU / 5.3 + spin;
      const R = 820 * lerp(0.35, 1, spread) * (1 + 0.6 * eInCubic(seg(L, 7.2, 8)));
      let y = ((i * 190 + lift) % (14 * 190)) - 7 * 190;
      m.position.set(Math.sin(a) * R, y, Math.cos(a) * R);
      m.rotation.set(0, a, 0);
      m.material.uniforms.uOpacity.value = spread * clamp((1 - Math.abs(y) / 1300) * 2);
      m.material.uniforms.uBright.value = 0.62;
    });
    S.list3d.push({ scene, camera: cam });
    S.fx.tone3d = 0;
    // tytuł + etykieta strony
    sectionTitle(front, S, { num: '01', label: 'WEB DESIGN', lines: ['STRONY', 'WWW'], b0: B0 + 0.2, bOut: B0 + 7.35, y: 240, size: 150 });
    chip(front, t, L);
    // akcenty
    for (const b of [0, 2, 4, 6]) fx.aberr += 12 * pulse(t, bt(B0 + b), 0.08);
    fx.glitch += 0.25 * pulse(t, bt(B0 + 4), 0.05) + 0.2 * pulse(t, bt(B0 + 7.5), 0.06);
    fx.glitchSeed = Math.floor(t * 40);
  },
};
