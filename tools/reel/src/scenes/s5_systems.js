// S5 — SYSTEMY I AUTOMATYZACJE (B40–B48, breakdown): kalendarz rezerwacji (komórki z pocisków S4),
// kursor rezerwuje termin, lista funkcji pisana na beatach, build z przyspieszającą falą kafli, cisza i czerń przed dropem.
import * as THREE from 'three';
import {
  W, H, CX, BEAT, S16, bt, C, M, Y, INK, GREY, DIM, BORDER, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eOutBack, eInOutCubic, eInCubic, eOutCubic, decay, pulse, hash,
  inkText, inkOff, scramble, rrect, measure,
} from '../core.js';
import { pixelCam, wx, wy, imagePlane, sectionTitle, tapeLabel, bgEntry, calCell, CAL } from '../common.js';

const B0 = 40;
const FIRST_COL = 3;          // 1 października 2026 = czwartek
const PICK = 15;              // dzień klikany kursorem
const ITEMS = [
  { txt: 'REZERWACJE ONLINE', b: 2 },
  { txt: 'PANELE ADMINISTRACYJNE', b: 3 },
  { txt: 'DEKODER VIN', b: 4 },
  { txt: 'INTEGRACJA Z GOOGLE CALENDAR', b: 5 },
];
let scene, cam, shotA, shotB;

function dayCell(d) { const i = FIRST_COL + d - 1; return [Math.floor(i / 7), i % 7]; }

function drawCalendar(g, t, L) {
  const build = seg(L, 4, 7.5);
  const appear = eOutExpo(seg(L, -0.05, 0.5));
  // panel
  g.save();
  g.globalAlpha = appear;
  rrect(g, CAL.x, CAL.y, CAL.w, CAL.h, 26);
  g.fillStyle = 'rgba(12,12,12,0.94)'; g.fill();
  g.strokeStyle = BORDER; g.lineWidth = 2; g.stroke();
  inkText(g, scramble('PAŹDZIERNIK 2026', t, bt(B0), 0.4, 7), CAL.x + 40, CAL.y + 62, { weight: 700, size: 34, align: 'left' });
  inkText(g, 'REZERWACJA ONLINE', CAL.x + CAL.w - 40, CAL.y + 60, { weight: 500, size: 19, align: 'right', color: C, spacing: 3 });
  const days = ['PN', 'WT', 'ŚR', 'CZ', 'PT', 'SB', 'ND'];
  days.forEach((d, c) => inkText(g, d, calCell(0, c)[0], CAL.gy - 22, { weight: 500, size: 18, color: GREY, spacing: 2 }));
  g.globalAlpha = 1;
  // komórki: odwracają się falą; w buildzie coraz szybciej
  const booked = new Set();
  for (let k = 0; k < 14; k++) {
    const tk = bt(B0 + 0.9) + k * S16 * (k < 8 ? 1 : 0.7);
    if (t >= tk) booked.add(1 + Math.floor(hash(k, 42) * 31));
  }
  for (let d = 1; d <= 31; d++) {
    const [r, c] = dayCell(d);
    const [x, y] = calCell(r, c);
    const tIn = bt(B0) + (r + c) * 0.028;
    const e = eOutBack(seg(t, tIn, tIn + 0.35), 2.2);
    if (e <= 0) continue;
    // flip w buildzie: kąt obrotu wokół osi X
    let flip = 0;
    if (build > 0) {
      const rate = lerp(1.2, 9, build * build);        // obroty na beat
      flip = Math.sin(((t - bt(B0 + 4)) / BEAT * rate - (r + c) * 0.18) * Math.PI) * build;
    }
    const sy = Math.max(0.04, e * Math.abs(Math.cos(flip * 1.2)));
    const picked = d === PICK && L >= 2;
    const isBooked = booked.has(d);
    g.save(); g.translate(x, y); g.scale(e, sy);
    rrect(g, -CAL.cw / 2, -CAL.ch / 2, CAL.cw, CAL.ch, 12);
    g.fillStyle = picked ? C : isBooked ? 'rgba(0,255,255,0.14)' : '#161616';
    g.fill();
    g.lineWidth = 2; g.strokeStyle = picked ? C : isBooked ? 'rgba(0,255,255,0.8)' : '#2a2a2a'; g.stroke();
    inkText(g, String(d), 0, 11, { weight: 500, size: 30, color: picked ? '#050505' : isBooked ? '#ffffff' : '#9a9a9a' });
    if (isBooked && !picked) { g.fillStyle = C; g.beginPath(); g.arc(CAL.cw / 2 - 16, -CAL.ch / 2 + 16, 5, 0, TAU); g.fill(); }
    g.restore();
  }
  g.restore();
  // popover z godzinami przy klikniętym dniu
  const pe = eOutBack(seg(L, 2.05, 2.45), 1.6) * (1 - eInExpo(seg(L, 3.9, 4.15)));
  if (pe > 0) {
    const [r, c] = dayCell(PICK);
    const [x, y] = calCell(r, c);
    const px = x - 150, py = y + 58;
    g.save(); g.translate(px + 150, py); g.scale(pe, pe); g.translate(-(px + 150), -py);
    rrect(g, px, py, 300, 200, 18); g.fillStyle = '#101010'; g.fill(); g.strokeStyle = C; g.lineWidth = 2; g.stroke();
    ['09:00', '10:30', '12:00'].forEach((h, i) => {
      const sel = i === 1 && L >= 2.6;
      rrect(g, px + 20, py + 18 + i * 60, 260, 48, 24);
      g.fillStyle = sel ? C : '#1d1d1d'; g.fill();
      inkText(g, h, px + 44, py + 52 + i * 60, { weight: 700, size: 26, align: 'left', color: sel ? '#050505' : '#ffffff' });
      inkText(g, sel ? 'ZAREZERWOWANE' : i === 0 ? 'ZAJĘTE' : 'WOLNE', px + 262, py + 50 + i * 60, { weight: 500, size: 15, align: 'right', color: sel ? '#050505' : GREY, spacing: 2 });
    });
    g.restore();
  }
}

function drawCursor(g, t, L) {
  if (L < 0.8 || L > 4.2) return;
  const [r, c] = dayCell(PICK);
  const [tx, ty] = calCell(r, c);
  const path = [[980, 1500, 0.8], [tx + 10, ty + 8, 1.9], [tx - 20, ty + 140, 2.55], [990, 1300, 3.8]];
  let x = path[0][0], y = path[0][1];
  for (let i = 1; i < path.length; i++) {
    const e = eInOutCubic(seg(L, path[i - 1][2] + 0.1, path[i][2]));
    x = lerp(x, path[i][0], e); y = lerp(y, path[i][1], e);
  }
  const click = pulse(t, bt(B0 + 2), 0.12) + pulse(t, bt(B0 + 2.6), 0.12);
  // pierścień kliknięcia
  for (const b of [2, 2.6]) {
    const u = seg(L, b, b + 0.5);
    if (u > 0 && u < 1) { g.globalAlpha = 1 - u; g.strokeStyle = C; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 12 + 60 * eOutExpo(u), 0, TAU); g.stroke(); g.globalAlpha = 1; }
  }
  g.save(); g.translate(x, y); g.scale(1 - 0.15 * click, 1 - 0.15 * click);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 44); g.lineTo(12, 33); g.lineTo(21, 52); g.lineTo(29, 48); g.lineTo(20, 30); g.lineTo(36, 30); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#050505'; g.stroke();
  g.restore();
}

function checkIcon(g, x, y, s, e) {
  g.save(); g.translate(x, y);
  g.strokeStyle = C; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, s, -Math.PI / 2, -Math.PI / 2 + TAU * e); g.stroke();
  if (e > 0.5) {
    const k = eOutExpo((e - 0.5) * 2);
    g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-s * 0.45, 0); g.lineTo(-s * 0.1, s * 0.35 * Math.min(1, k * 2)); if (k > 0.5) g.lineTo(-s * 0.1 + s * 0.6 * (k - 0.5) * 2, s * 0.35 - s * 0.7 * (k - 0.5) * 2); g.stroke();
  }
  g.restore();
}

export default {
  name: 'systems', b0: 40, b1: 48, pre: 0, post: 0.02,
  async load() {
    scene = new THREE.Scene();
    cam = pixelCam(30);
    shotA = imagePlane('sys_rezerwacje', 760, { round: 0.02 });
    shotB = imagePlane('sys_kalendarz', 900, { round: 0.02 });
    scene.add(shotA, shotB);
  },
  frame(S, Ls) {
    const { t, B } = S, L = B - B0, fx = S.fx;
    const front = Ls.front.g, back = Ls.back.g;
    const gap = L >= 7.5;          // cisza przed dropem: tylko punkt
    // ---- tło: fala kafli (przyspiesza w buildzie)
    const build = seg(L, 4, 7.5);
    const phase = 0.8 * (t - bt(B0)) + 14 * eInCubic(build);
    S.bgs.push(bgEntry(6, [gap ? 0 : lerp(0.13, 0.5, build * build), 96, phase, 0], [3.2, 1, 0, 0]));
    if (gap) {
      const u = seg(L, 7.5, 8);
      const w = lerp(700, 8, eOutExpo(u * 1.6));
      front.fillStyle = '#ffffff';
      front.fillRect(CX - w / 2, H / 2 - 3, w, 6);
      fx.bloomW = [0, 0, 1, 1];
      return;
    }
    // ---- prawdziwe zrzuty systemów, przygaszone w tle
    const sa = eOutExpo(seg(L, 0.3, 1.2));
    shotA.position.set(wx(300) - 200 * (1 - sa), wy(1330), -700);
    shotA.rotation.set(rad(-6), rad(28), rad(3));
    shotB.position.set(wx(800) + 200 * (1 - sa), wy(760), -900);
    shotB.rotation.set(rad(5), rad(-26), rad(-2));
    for (const s of [shotA, shotB]) { s.material.uniforms.uOpacity.value = sa * 0.55; s.material.uniforms.uBright.value = 0.7; s.position.y += 30 * Math.sin(t * 0.8); }
    S.list3d.push({ scene, camera: cam });
    fx.tone3d = 0;
    // ---- kalendarz + kursor
    drawCalendar(front, t, L);
    drawCursor(front, t, L);
    // ---- lista funkcji
    ITEMS.forEach((it, i) => {
      if (L < it.b - 0.05) return;
      const tb = bt(B0 + it.b);
      const y = 1180 + i * 68;
      checkIcon(front, 130, y - 12, 20, seg(t, tb, tb + 0.3));
      const typed = it.txt.slice(0, Math.ceil(it.txt.length * seg(t, tb + 0.05, tb + 0.42)));
      inkText(front, typed + (seg(t, tb, tb + 0.5) < 1 && Math.floor(t * 8) % 2 ? '▌' : ''), 172, y, { weight: 500, size: 38, align: 'left' });
    });
    if (L >= 6) {
      const tb = bt(B0 + 6);
      tapeLabel(front, 'BEZ ZBĘDNYCH ABONAMENTÓW.', CX, 1475, { size: 58, bg: Y, fg: '#050505', reveal: eOutExpo(seg(t, tb, tb + 0.3)), skew: -0.08, inks: null });
    }
    sectionTitle(front, S, { num: '05', label: 'DLA BIZNESU', lines: ['SYSTEMY I', 'AUTOMATYZACJE'], b0: B0 + 0.1, bOut: B0 + 7.4, y: 230, size: 108, lh: 0.95 });
    // ---- build: kamera wjeżdża, trzęsie, aberracja rośnie
    fx.zoom *= 1 + 0.07 * eInCubic(build);
    const sh = 7 * eInCubic(build);
    fx.shakeX += sh * Math.sin(t * 91); fx.shakeY += sh * Math.cos(t * 77);
    fx.aberr += 14 * eInCubic(build) + 8 * pulse(t, bt(B0), 0.1);
    fx.glitch += 0.18 * build * (Math.floor(t * 16) % 3 === 0 ? 1 : 0);
    fx.glitchSeed = Math.floor(t * 30);
  },
};
