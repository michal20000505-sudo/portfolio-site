// 02 — laboratorium geometrii 3D (B26–B46). Ten sam model i ta sama kinematyka co na sscar.pl/geometria-3d.html:
// widoki kamery strony (izometria, camber od tyłu, zbieżność z góry, caster z boku), adnotacje kątów jak
// drawOverlay() strony, odcisk opony na jezdni wg modelu zużycia. Suwak zmienia wartość na beatach,
// licznik przebiegu opony reaguje na żywo, obok zdjęcie prawdziwego zużycia bieżnika ze strony.
// Na koniec "Ustawienia fabryczne", pełny przebieg i zdjęcie stanowiska 3D z hali SSCAR.
import {
  W, H, bt, RED, RED_HI, INK, MUTED, DIM, OK, S1, BORDER, BORDER_ACC, OK_RGB, RED_RGB,
  clamp, lerp, seg, keys, pulse, rad, eOutExpo, eInExpo, eOutBack, eInOutCubic, eInOutQuint, eOutCubic, spring,
  text, setFont, rrect, ramp, rgb, nf, sf, drawCover,
} from '../core.js';
import { ENV, IMG, Panel, icon, label, card, cardShadow, button, tap } from '../common.js';
import { CH } from '../director.js';
import { VIEWS, SPEC, R, HW, mv } from '../wheel.js';
import { slideX } from './world.js';

export const LE = {                                   // zdarzenia (beaty) — te same w music.py
  camView: 27.0, camber: [28, 28.5, 29, 29.5, 30], wear1: 30.25, camberBack: 31.5,
  toeView: 31.75, toe: [32.5, 33, 33.5, 34], wear2: 34.25, toeBack: 35.5,
  casterView: 35.75, caster: [36.5, 37, 37.5], steerView: 37.9, steer: [38.25, 38.75, 39.25, 39.75],
  reset: 40.0, life: 40.5, stand: 42.5,
};
const PARAMS = {
  camber: { name: 'CAMBER', sub: 'kąt pochylenia koła', min: -3, max: 3, spec: [-0.5, 0.5], fmt: v => sf(v, 1, '°'), lo: '−3,0°', hi: '+3,0°', norm: 'norma ±0,5°' },
  toe: { name: 'ZBIEŻNOŚĆ', sub: 'toe, suma na osi', min: -6, max: 6, spec: [-0.6, 0.6], fmt: v => sf(v, 1, ' mm'), lo: '−6 mm', hi: '+6 mm', norm: 'norma ±0,6 mm' },
  caster: { name: 'CASTER', sub: 'wyprzedzenie sworznia', min: 0, max: 10, spec: [3, 8], fmt: v => nf(v, 1) + '°', lo: '0°', hi: '+10°', norm: 'norma 3–8°' },
  steer: { name: 'SKRĘT KOŁA', sub: 'tu widać, co robi caster', min: -34, max: 34, spec: null, fmt: v => Math.abs(v) < 0.5 ? '0°' : sf(v, 0, '°'), lo: '34° w lewo', hi: '34° w prawo', norm: '' },
};
const km = v => (Math.round(v / 1000) * 1000).toLocaleString('pl-PL').replace(/ /g, ' ');

let wear1, wear2, stand;

function kinAt(B) {
  const bo = x => eOutBack(x, 1.4);
  return {
    camber: keys(B, [[28, -0.3], [28.5, -1.0, bo], [29, -1.6, bo], [29.5, -2.2, bo], [30, -2.5, bo], [31.5, -2.5], [32.1, -0.3, bo]]),
    toe: keys(B, [[32.5, 0.2], [33, 1.4, bo], [33.5, 2.6, bo], [34, 4.0, bo], [35.5, 4.0], [36.1, 0.2, bo]]),
    caster: keys(B, [[36.5, 4.5], [37, 5.8, bo], [37.5, 7.0, bo], [40.0, 7.0], [40.6, 4.5, bo]]),
    steer: keys(B, [[38.25, 0], [38.75, 24, eInOutCubic], [39.25, -24, eInOutCubic], [39.75, 0, eInOutCubic]]),
    press: 2.2,
  };
}
const active = B => B < 27.5 ? null : B < 31.9 ? 'camber' : B < 35.9 ? 'toe' : B < 38.1 ? 'caster' : B < 40.0 ? 'steer' : null;

// kamera: widoki strony (yaw, pitch, dist) + kadr w reelsie (FOC, cx, cy)
const V = (v, foc, cx, cy) => [v.yaw, v.pitch, v.dist, foc, cx, cy];
const CAM = [
  [26.0, V(VIEWS.iso, 1120, 540, 935)],
  [27.0, V(VIEWS.iso, 1120, 540, 935)],
  [27.6, V(VIEWS.camber, 1180, 650, 925)],
  [31.75, V(VIEWS.camber, 1180, 650, 925)],
  [32.35, V(VIEWS.toe, 1180, 650, 860)],
  [35.75, V(VIEWS.toe, 1180, 650, 860)],
  [36.35, V(VIEWS.caster, 1120, 540, 935)],
  [37.9, V(VIEWS.caster, 1120, 540, 935)],
  [38.4, V(VIEWS.iso, 1120, 540, 935)],
  [40.5, V(VIEWS.iso, 1120, 540, 935)],
  [42.5, V({ yaw: VIEWS.iso.yaw - 0.5, pitch: 0.3, dist: 4.45 }, 1120, 540, 935)],
  [46.0, V({ yaw: VIEWS.iso.yaw - 1.2, pitch: 0.26, dist: 4.45 }, 1120, 540, 935)],
];
const camAt = B => keys(B, CAM.map(([b, v], i) => [b, v, i >= 10 ? (x => x) : eInOutCubic]));

// ------------------------------------------------------------------ adnotacje (drawOverlay strony, większe)
function P(rig, p) { return rig.view.proj(p); }
function dash(g, rig, a, b, col, lw = 2.4) {
  const pa = P(rig, a), pb = P(rig, b);
  g.save(); g.setLineDash([10, 8]); g.strokeStyle = col; g.lineWidth = lw;
  g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke(); g.restore();
}
function tube(g, rig, a, b, w, col) {
  const pa = P(rig, a), pb = P(rig, b);
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke();
}
function tag(g, x, y, txt, col, align = 'center', size = 25) {
  setFont(g, { family: 'cond', weight: 800, size, spacing: size * 0.06 });
  const w = g.measureText(txt).width;
  const bx = align === 'left' ? x - 8 : align === 'right' ? x - w - 8 : x - w / 2 - 8;
  g.fillStyle = 'rgba(14,13,13,0.82)';
  g.fillRect(bx, y - size * 0.72, w + 16, size * 1.44);
  text(g, txt, align === 'center' ? x : align === 'right' ? x : x, y + size * 0.36, { family: 'cond', weight: 800, size, spacing: size * 0.06, color: col, align });
}
function label3(g, rig, p, txt, col, dx = 0, dy = 0, size = 25) { const q = P(rig, p); tag(g, q[0] + dx, q[1] + dy, txt, col, 'center', size); }
function arc2(g, rig, c3, a3, b3, col, txt) {
  const c = P(rig, c3), pa = P(rig, a3), pb = P(rig, b3);
  const a1 = Math.atan2(pa[1] - c[1], pa[0] - c[0]), a2 = Math.atan2(pb[1] - c[1], pb[0] - c[0]);
  let d = a2 - a1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const reach = Math.hypot(pa[0] - c[0], pa[1] - c[1]);
  const Lr = Math.min(330, Math.max(190, reach * 0.8)), rr = Lr * 0.62;
  g.fillStyle = 'rgba(189,0,1,0.22)';
  g.beginPath(); g.moveTo(c[0], c[1]);
  g.lineTo(c[0] + Math.cos(a1) * Lr, c[1] + Math.sin(a1) * Lr);
  g.lineTo(c[0] + Math.cos(a1 + d) * Lr, c[1] + Math.sin(a1 + d) * Lr);
  g.closePath(); g.fill();
  g.strokeStyle = col; g.lineWidth = 3.5;
  g.beginPath(); g.arc(c[0], c[1], rr, a1, a1 + d, d < 0); g.stroke();
  if (txt) {
    const am = a1 + d / 2;
    tag(g, c[0] + Math.cos(am) * (rr + 52), c[1] + Math.sin(am) * (rr + 52), txt, col, 'center', 34);
  }
}
function overlay(g, rig, act, alpha) {
  const K = rig.kin, S = K.S, M = K.Mtot, gs = K.groundShift, ct = K.contact;
  const red = RED_HI, soft = 'rgba(226,32,32,0.85)', white = 'rgba(255,255,255,0.4)';
  g.save();
  g.globalAlpha = alpha;
  if (act === 'camber') {
    const up = [ct[0], R * 2.05 + gs, ct[2]];
    const wAx = mv(M, [0, R * 1.05, 0]);
    const whUp = [ct[0] + wAx[0], R + gs + wAx[1], ct[2] + wAx[2]];
    dash(g, rig, ct, up, white);
    tube(g, rig, ct, whUp, 4, soft);
    arc2(g, rig, ct, up, whUp, red, sf(S.camber, 1, '°'));
    label3(g, rig, up, 'PION', 'rgba(255,255,255,0.6)', 0, -24);
  } else if (act === 'toe') {
    const fw = [ct[0], 0.012, ct[2] + 1.45];
    const wf0 = mv(M, [0, 0, 1.45]);
    const whFw = [ct[0] + wf0[0], 0.012, ct[2] + wf0[2]];
    dash(g, rig, ct, fw, white);
    tube(g, rig, ct, whFw, 4, soft);
    arc2(g, rig, ct, fw, whFw, red, sf(S.toe, 1, ' mm'));
    label3(g, rig, fw, 'KIERUNEK JAZDY', 'rgba(255,255,255,0.6)', 0, -26);
  } else if (act === 'caster' || act === 'steer') {
    const gy = R + gs, tt = gy / (K.kpDir[1] || 1);
    const hit = K.axisPt(-tt); hit[1] = 0.012;
    const top = K.axisPt(1.42), hub = K.axisPt(0);
    tube(g, rig, hit, top, 4.5, red);
    const qh = P(rig, hit); g.fillStyle = red; g.beginPath(); g.arc(qh[0], qh[1], 7, 0, Math.PI * 2); g.fill();
    dash(g, rig, [ct[0], 0.012, ct[2]], hit, 'rgba(226,32,32,0.6)');
    const vTop = [hub[0], gy + 1.05, hub[2]];
    if (act === 'caster') {
      dash(g, rig, [hub[0], 0.012, hub[2]], vTop, 'rgba(255,255,255,0.35)');
      if (S.caster > 0.4) arc2(g, rig, hub, vTop, top, red, nf(S.caster, 1) + '°');
      label3(g, rig, top, 'OŚ SWORZNIA', red, 0, -28);
      const midZ = [(ct[0] + hit[0]) / 2, 0.012, (ct[2] + hit[2]) / 2];
      label3(g, rig, midZ, 'wyprzedzenie ' + Math.round(K.model.trailMM) + ' mm', red, 0, 34, 24);
    }
    if (act === 'steer' && Math.abs(S.steer) > 1) {
      const lift = K.liftMM;
      label3(g, rig, [ct[0], gy * 1.72, ct[2]], (lift >= 0 ? 'podnosi nadwozie o ' : 'opuszcza nadwozie o ') + nf(Math.abs(lift), 1) + ' mm', Math.abs(lift) > 0.3 ? red : 'rgba(255,255,255,0.6)', 0, 0, 27);
    }
  }
  g.restore();
}
function patch(g, rig, alpha) {
  for (const { q, t } of rig.patchQuads()) {
    g.beginPath();
    g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]);
    g.closePath();
    g.fillStyle = rgb(ramp(t), (0.2 + 0.4 * t) * alpha);
    g.fill();
  }
}

// ------------------------------------------------------------------ karta sterowania (suwak jak .ctl strony) + przebieg opony
const CY0 = 1096;
function controlCard(g, t, B, key, v, kin, alpha, swap) {
  const p = PARAMS[key];
  g.save();
  g.globalAlpha = alpha;
  cardShadow(g, 70, CY0, 940, 178, 12, 0.6, 40, 16);
  card(g, 70, CY0, 940, 178, { fill: 'rgba(18,15,14,0.94)', border: '#2a2322', r: 12 });
  g.save();
  g.beginPath(); g.rect(70, CY0, 940, 178); g.clip();
  g.translate(0, 26 * (1 - swap));
  g.globalAlpha = alpha * swap;
  const out = p.spec ? (v < p.spec[0] - 1e-6 || v > p.spec[1] + 1e-6) : false;
  text(g, p.name, 104, CY0 + 56, { family: 'cond', weight: 900, size: 36, spacing: 36 * 0.06, color: INK });
  setFont(g, { family: 'cond', weight: 900, size: 36, spacing: 36 * 0.06 });
  text(g, p.sub, 104 + g.measureText(p.name).width + 14, CY0 + 56, { family: 'body', weight: 400, size: 25, color: MUTED });
  text(g, p.fmt(v), 976, CY0 + 62, { family: 'cond', weight: 900, size: 58, align: 'right', color: out ? RED_HI : INK });
  // tor suwaka
  const x0 = 104, x1 = 976, ty = CY0 + 104;
  const X = u => lerp(x0, x1, (u - p.min) / (p.max - p.min));
  g.fillStyle = '#2a2322'; rrect(g, x0, ty - 4, x1 - x0, 8, 4); g.fill();
  if (p.spec) { g.fillStyle = 'rgba(62,172,100,0.55)'; rrect(g, X(p.spec[0]), ty - 4, X(p.spec[1]) - X(p.spec[0]), 8, 4); g.fill(); }
  const zero = p.min < 0 && p.max > 0 ? 0 : p.min;
  g.fillStyle = RED; g.fillRect(Math.min(X(zero), X(v)), ty - 4, Math.abs(X(v) - X(zero)), 8);
  const kx = X(v);
  g.beginPath(); g.arc(kx, ty, 19, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  g.beginPath(); g.arc(kx, ty, 13, 0, Math.PI * 2); g.fillStyle = RED; g.fill();
  text(g, p.lo, x0, ty + 46, { family: 'body', weight: 500, size: 21, color: DIM });
  text(g, p.hi, x1, ty + 46, { family: 'body', weight: 500, size: 21, color: DIM, align: 'right' });
  if (p.norm) text(g, p.norm, (X(p.spec[0]) + X(p.spec[1])) / 2, ty + 46, { family: 'body', weight: 600, size: 21, color: OK, align: 'center' });
  g.restore();
  g.restore();
}
// przebieg opony (licznik żywy): etykieta i liczba nad kartą
function lifeTag(g, kin, alpha, x = 1010, y = 626) {
  const life = kin.model.life, kmv = kin.model.kmLeft;
  const col = rgb(ramp(clamp((100 - life) / 62, 0, 1)));
  g.save(); g.globalAlpha = alpha;
  label(g, 'Przebieg opony', x, y - 58, { size: 21, align: 'right', color: MUTED });
  text(g, km(kmv) + ' km', x, y, { family: 'cond', weight: 900, size: 52, align: 'right', color: col });
  g.restore();
}

// ------------------------------------------------------------------ karty zużycia (zdjęcia ze strony) i zdjęcie stanowiska
function wearCard(g, img, title, tagTxt, desc) {
  const w = 430, h = 470;
  cardShadow(g, 0, 0, w, h, 12, 0.7, 50, 20);
  card(g, 0, 0, w, h, { fill: '#151211', border: '#342a28', r: 12 });
  g.save(); rrect(g, 12, 12, w - 24, 300, 8); g.clip(); drawCover(g, img, 12, 12, w - 24, 300); g.restore();
  text(g, title, 26, 362, { family: 'cond', weight: 900, size: 30, spacing: 1, color: INK });
  rrect(g, 26, 384, 118, 34, 4); g.fillStyle = 'rgba(189,0,1,0.85)'; g.fill();
  text(g, tagTxt, 85, 408, { family: 'cond', weight: 800, size: 20, spacing: 2.4, color: INK, align: 'center' });
  text(g, desc, 158, 408, { family: 'body', weight: 500, size: 23, color: MUTED });
  text(g, 'Opona zapisuje błąd wcześniej niż kierowca.', 26, 450, { family: 'body', weight: 400, size: 21, color: DIM });
}
function standCard(g) {
  const w = 940, h = 760;
  cardShadow(g, 0, 0, w, h, 14, 0.75, 70, 30);
  card(g, 0, 0, w, h, { fill: '#151211', border: '#342a28', r: 14 });
  g.save(); rrect(g, 14, 14, w - 28, 580, 10); g.clip(); drawCover(g, IMG.geo_stand, 14, 14, w - 28, 580, 0.5, 0.6); g.restore();
  label(g, 'Na stanowisku w SSCAR', 40, 642, { size: 22, color: RED_HI });
  text(g, 'Pomiar 3D na urządzeniu HANWAY', 40, 690, { family: 'cond', weight: 900, size: 42, spacing: 1, color: INK });
  text(g, 'Pomiar geometrii', 40, 734, { family: 'body', weight: 500, size: 27, color: MUTED });
  text(g, '150 zł', w - 40, 736, { family: 'cond', weight: 900, size: 46, color: RED_HI, align: 'right' });
}

export default {
  name: 'lab', b0: CH.lab - 0.5, b1: CH.vin + 0.3,
  load() {
    const UI = ENV.uiTop;
    wear1 = new Panel(UI, 430, 470, { pad: 70 }); wear1.static = true;
    wear2 = new Panel(UI, 430, 470, { pad: 70 }); wear2.static = true;
    stand = new Panel(UI, 940, 760, { pad: 90 }); stand.static = true;
  },
  frame(S, L) {
    const { t, B } = S;
    const rig = ENV.rig, K = rig.kin;
    const sx = slideX(B, CH.lab, CH.vin);
    // ---- kinematyka i kamera
    K.S = kinAt(B);
    rig.spin = -0.25 * Math.max(0, t - bt(40.5));          // po resecie koło powoli się toczy
    const [yaw, pitch, dist, foc, cx, cy] = camAt(B);
    rig.view.orbit(yaw, pitch, dist);
    const standK = eInOutCubic(seg(t, bt(LE.stand), bt(LE.stand + 0.6)));
    rig.view.frame(foc * (1 - 0.18 * standK), cx + sx, cy - 60 * standK);
    rig.showSusp = pitch < 1.15;
    rig.opacity = 1 - eInOutCubic(seg(t, bt(LE.stand + 0.1), bt(LE.stand + 0.7)));
    rig.floorOpacity = 1;
    rig.floorFade = 1;
    rig.sweep = 0;
    rig.fadeY = [470, 660];
    rig.rimCol.set(0.5 * pulse(t, bt(LE.reset), 0.5), 0.02, 0.01);
    if (rig.opacity > 0.002) S.wheel3d.push(rig.item()); else { rig.pose(); rig.view.apply(); }
    S.bg.lab = [540 + sx, 900, 1150, 0.6 * (1 - 0.5 * standK)];

    // ---- adnotacje i odcisk opony (nad kołem)
    const g = L.front.g;
    const act = active(B);
    g.save();
    g.translate(0, 0);
    const pa = eOutExpo(seg(t, bt(27), bt(27.6))) * (1 - eInExpo(seg(t, bt(LE.stand - 0.2), bt(LE.stand + 0.3))));
    patch(g, rig, pa);
    const swapIn = b => eOutExpo(seg(t, bt(b), bt(b + 0.4)));
    const ovK = act === 'camber' ? swapIn(27.6) : act === 'toe' ? swapIn(32.35) : act === 'caster' ? swapIn(36.35) : act === 'steer' ? swapIn(38.4) : 0;
    const ovOut = act === 'camber' ? 1 - seg(t, bt(31.6), bt(31.8)) : act === 'toe' ? 1 - seg(t, bt(35.6), bt(35.8)) : 1;
    if (act) overlay(g, rig, act, ovK * ovOut);
    g.restore();

    // ---- karta sterowania
    const cardIn = eOutExpo(seg(t, bt(27.4), bt(28.0)));
    const cardOut = eInExpo(seg(t, bt(LE.stand - 0.2), bt(LE.stand + 0.3)));
    const ca = cardIn * (1 - cardOut);
    if (ca > 0) {
      g.save(); g.translate(sx, 0);
      if (B < LE.reset) {
        const key = act || 'camber';
        const sw = key === 'camber' ? 1 : key === 'toe' ? swapIn(31.9) : key === 'caster' ? swapIn(35.9) : swapIn(38.1);
        controlCard(g, t, B, key, K.S[key], K, ca, sw);
        lifeTag(g, K, ca * eOutExpo(seg(t, bt(28), bt(28.4))));
      } else {
        // wynik po resecie: przycisk "Ustawienia fabryczne" → pełny przebieg i werdykt
        const rk = eOutExpo(seg(t, bt(LE.reset + 0.1), bt(LE.reset + 0.6)));
        cardShadow(g, 70, CY0, 940, 178, 12, 0.6, 40, 16);
        card(g, 70, CY0, 940, 178, { fill: 'rgba(18,15,14,0.94)', border: '#2a2322', r: 12 });
        const lifeK = eOutCubic(seg(t, bt(LE.life), bt(LE.life + 1.2)));
        label(g, 'Trwałość opony', 104, CY0 + 52, { size: 22, color: MUTED, alpha: rk });
        const life = K.model.life;
        const kmv = lerp(21000, K.model.kmLeft, lifeK);
        text(g, km(kmv) + ' km', 976, CY0 + 60, { family: 'cond', weight: 900, size: 56, color: rgb(ramp(clamp((100 - lerp(40, life, lifeK)) / 62))), align: 'right', alpha: rk });
        g.fillStyle = '#2a2322'; rrect(g, 104, CY0 + 88, 872, 12, 6); g.fill();
        g.fillStyle = rgb(ramp(clamp((100 - lerp(40, life, lifeK)) / 62))); rrect(g, 104, CY0 + 88, 872 * lerp(0.4, life / 100, lifeK) * rk, 12, 6); g.fill();
        const vk = eOutExpo(seg(t, bt(LE.life + 0.8), bt(LE.life + 1.4)));
        g.beginPath(); g.arc(114, CY0 + 140, 8, 0, Math.PI * 2); g.fillStyle = OK; g.globalAlpha = vk; g.fill(); g.globalAlpha = 1;
        text(g, 'Ustawienie w normie. Nacisk równo na całej szerokości bieżnika.', 134, CY0 + 149, { family: 'body', weight: 500, size: 25, color: INK, alpha: vk });
        // przycisk resetu (na karcie, znika po wciśnięciu)
      }
      g.restore();
    }
    // przycisk "Ustawienia fabryczne" nad kartą (B39.25–B40.4)
    const bk = eOutExpo(seg(t, bt(39.4), bt(39.8))) * (1 - eInExpo(seg(t, bt(40.2), bt(40.6))));
    if (bk > 0) {
      g.save(); g.globalAlpha = bk; g.translate(sx, 0);
      button(g, 610, CY0 - 86, 400, 66, 'Ustawienia fabryczne', { fill: '#171312', border: INK, size: 26, press: pulse(t, bt(LE.reset), 0.12), color: INK });
      g.restore();
      tap(g, 810 + sx, CY0 - 53, t, bt(LE.reset));
    }

    // ---- karty zużycia (zdjęcia ze strony) — z lewej, lekko obrócone w 3D
    const wcard = (P_, img, title, tg, desc, b0, b1) => {
      const k = eOutExpo(seg(t, bt(b0), bt(b0 + 0.5))), o = eInExpo(seg(t, bt(b1), bt(b1 + 0.35)));
      if (k <= 0 || o >= 1) return;
      P_.draw(gg => wearCard(gg, img, title, tg, desc));
      P_.place({ x: 70 + 215 + sx - 520 * (1 - k) - 400 * o, y: 540 + 240, z: 60, ry: rad(18) * (1 - k) + rad(-10) * o, rz: rad(-2.5), opacity: clamp(k * 2) * (1 - o), sheen: 0.6 * (1 - k), sheenPos: lerp(-0.3, 1.3, k) });
    };
    wcard(wear1, IMG.wear_inner, 'STARTA KRAWĘDŹ WEWNĘTRZNA', 'GEOMETRIA', 'zbyt duży ujemny camber', LE.wear1, LE.camberBack);
    wcard(wear2, IMG.wear_saw, 'PIŁOWANIE BIEŻNIKA', 'GEOMETRIA', 'błędna zbieżność', LE.wear2, LE.toeBack);

    // ---- zdjęcie prawdziwego stanowiska 3D (B42.5)
    const sk = eOutExpo(seg(t, bt(LE.stand), bt(LE.stand + 0.7)));
    if (sk > 0) {
      stand.draw(gg => standCard(gg));
      stand.place({ x: 540 + sx, y: 530 + 380 + 80 * (1 - sk), z: -500 * (1 - sk), rx: rad(-14) * (1 - sk), opacity: clamp(sk * 1.6), sheen: 0.7 * (1 - sk * 0.5), sheenPos: lerp(-0.3, 1.4, seg(t, bt(LE.stand), bt(LE.stand + 1.2))) });
    }
  },
};
