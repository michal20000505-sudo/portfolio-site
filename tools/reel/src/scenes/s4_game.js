// S4 — GAME DEV (B32–B40): warp, boss z geometrii strzelający spiralami pocisków (bullet hell = hipnoza),
// statek gracza, ekran z prawdziwym gameplayem, slam logo SPACEFIGHTER, "MOJA GRA / NA STEAM".
// Na końcu pociski zamrażają się i wskakują na siatkę kalendarza z następnej sceny.
import * as THREE from 'three';
import {
  W, H, CX, BEAT, S16, bt, C, M, Y, INK, GREY, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eInOutExpo, eOutBack, eInOutCubic, eInCubic, eOutCubic, decay, pulse, hash, noise1,
  inkText, inkOff, canvas2d, polyPath,
} from '../core.js';
import { IMG, TEX, pixelCam, wx, wy, imagePlane, sectionTitle, tapeLabel, bgEntry, shockRings, makeBurst, drawBurst, calCell, CAL } from '../common.js';

const B0 = 32;
const SHOTS = ['game_boss2', 'game_hivefleetwave', 'game_irontidewave', 'game_the_hunter'];
const FREEZE = bt(B0 + 7.45), SNAP = bt(B0 + 8);
let scene, cam, screen, bullets = [], pix, pixG;
const burst = makeBurst(77, 150, 2400);

function bossPos(t) {
  const L = t / BEAT - B0;
  const e = eOutBack(seg(L, 0.25, 1.0), 1.4);
  return [CX + 70 * Math.sin(t * 1.3) * e, lerp(-260, 640, e) + 16 * Math.sin(t * 2.2)];
}

function buildBullets() {
  const out = [];
  const dt = S16 / 2;
  // E1: spirala 4 ramion
  for (let n = 0; ; n++) {
    const te = bt(B0 + 1) + n * dt; if (te >= bt(B0 + 3)) break;
    for (let j = 0; j < 4; j++) out.push({ te, th: n * 0.23 + j * Math.PI / 2, v: 560, cv: 0.35, col: j % 2 ? C : '#ffffff' });
  }
  // E2: pierścienie co ósemkę
  for (let k = 0; k < 4; k++) {
    const te = bt(B0 + 3) + k * BEAT / 2;
    for (let i = 0; i < 28; i++) out.push({ te, th: i * TAU / 28 + (k % 2) * Math.PI / 28, v: 430, cv: k % 2 ? 0.42 : -0.42, col: INK[k % 3] });
  }
  // E3: dwie przeciwbieżne spirale po 5 ramion
  for (let n = 0; ; n++) {
    const te = bt(B0 + 5) + n * dt; if (te >= FREEZE) break;
    for (let j = 0; j < 5; j++) {
      out.push({ te, th: n * 0.17 + j * TAU / 5, v: 520, cv: 0.55, col: j % 2 ? C : Y });
      out.push({ te, th: -n * 0.17 + j * TAU / 5 + 0.3, v: 500, cv: -0.55, col: j % 2 ? M : '#ffffff' });
    }
  }
  // cel po zamrożeniu: komórki kalendarza (S5)
  out.forEach((b, i) => {
    const r = Math.floor(hash(i, 1) * CAL.rows), c = Math.floor(hash(i, 2) * CAL.cols);
    const [cx, cy] = calCell(r, c);
    b.tx = cx + (hash(i, 3) - 0.5) * 60; b.ty = cy + (hash(i, 4) - 0.5) * 30;
  });
  return out;
}

function bulletPos(b, t) {
  const tt = Math.min(t, FREEZE);
  const age = tt - b.te;
  const [ox, oy] = b.origin || (b.origin = bossPos(b.te));
  const th = b.th + b.cv * age;
  const r = b.v * age + 40;
  let x = ox + Math.cos(th) * r, y = oy + Math.sin(th) * r;
  if (t > FREEZE) {
    const e = eInOutCubic(seg(t, FREEZE + 0.03, SNAP));
    x = lerp(x, b.tx, e); y = lerp(y, b.ty, e);
  }
  return [x, y];
}

function drawBoss(g, t, L) {
  if (L < 0.2 || L > 4.2) return;
  const [x, y] = bossPos(t);
  const k = 1 + 0.08 * pulse(t, bt(B0 + Math.floor(L)), 0.12);
  const fade = 1 - seg(L, 3.9, 4.2);
  g.save(); g.translate(x, y); g.scale(k, k); g.globalAlpha = fade;
  // obracający się sześciokąt + trójkąt + rdzeń
  g.lineWidth = 4; g.strokeStyle = '#ffffff';
  polyPath(g, 0, 0, 150, 6, t * 0.8); g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#555555';
  polyPath(g, 0, 0, 175, 6, -t * 0.5); g.stroke();
  g.fillStyle = 'rgba(255,0,255,0.25)'; g.strokeStyle = M; g.lineWidth = 4;
  polyPath(g, 0, 0, 92, 3, -t * 1.6); g.fill(); g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = t * 1.1 + i * TAU / 6;
    g.save(); g.translate(Math.cos(a) * 205, Math.sin(a) * 205); g.rotate(a + t * 3);
    g.fillStyle = i % 2 ? Y : C; g.fillRect(-11, -11, 22, 22); g.restore();
  }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(0, 0, 38 + 6 * Math.sin(t * 20), 0, TAU); g.fill();
  g.restore();
}

function shipPos(t, L) {
  const dodge = [1, 2, 3, 5, 6].reduce((s, b, i) => s + (i % 2 ? -1 : 1) * 130 * eInOutCubic(seg(L, b - 0.15, b + 0.1)), 0);
  return [CX + 180 * Math.sin(t * 1.7) + dodge * 0.6, 1500 + 14 * Math.sin(t * 5)];
}
function drawShip(g, add, t, L) {
  if (L < 0.4 || L > 7.5) return;
  const [x, y] = shipPos(t, L);
  const e = eOutExpo(seg(L, 0.4, 1.0)) * (1 - seg(L, 7.2, 7.5));
  g.save(); g.translate(x, y + (1 - e) * 400); g.globalAlpha = e;
  // płomień silnika
  const fl = 40 + 20 * hash(Math.floor(t * 60), 3);
  const gr = g.createLinearGradient(0, 30, 0, 30 + fl);
  gr.addColorStop(0, 'rgba(0,255,255,0.95)'); gr.addColorStop(1, 'rgba(0,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(-14, 28); g.lineTo(0, 30 + fl); g.lineTo(14, 28); g.fill();
  g.fillStyle = '#ffffff'; g.strokeStyle = C; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, -46); g.lineTo(36, 34); g.lineTo(0, 20); g.lineTo(-36, 34); g.closePath(); g.fill(); g.stroke();
  g.restore();
  // lasery na 16tkach
  if (L > 1 && L < 7.4) {
    const k = Math.floor((t - bt(B0)) / S16);
    const tl = bt(B0) + k * S16;
    const a = 1 - seg(t, tl, tl + 0.09);
    add.globalAlpha = a; add.strokeStyle = C; add.lineWidth = 5; add.lineCap = 'round';
    add.beginPath(); add.moveTo(x, y - 50); add.lineTo(x, y - 50 - 900 * seg(t, tl, tl + 0.06)); add.stroke();
    add.globalAlpha = 1;
  }
}

function drawBullets(front, add, t) {
  const cols = {};
  for (const b of bullets) {
    if (t < b.te) continue;
    const [x, y] = bulletPos(b, t);
    if (t < FREEZE && (x < -40 || x > W + 40 || y < -40 || y > H + 40)) continue;
    (cols[b.col] ||= []).push(x, y);
  }
  const snapFade = 1 - seg(t, SNAP - 0.05, SNAP + 0.18);
  for (const col in cols) {
    const P = cols[col];
    add.fillStyle = col; add.globalAlpha = 0.22 * snapFade;
    add.beginPath();
    for (let i = 0; i < P.length; i += 2) { add.moveTo(P[i] + 24, P[i + 1]); add.arc(P[i], P[i + 1], 24, 0, TAU); }
    add.fill();
    front.globalAlpha = snapFade;
    front.fillStyle = col;
    front.beginPath();
    for (let i = 0; i < P.length; i += 2) { front.moveTo(P[i] + 11, P[i + 1]); front.arc(P[i], P[i + 1], 11, 0, TAU); }
    front.fill();
    front.fillStyle = '#ffffff';
    front.beginPath();
    for (let i = 0; i < P.length; i += 2) { front.moveTo(P[i] + 5.5, P[i + 1]); front.arc(P[i], P[i + 1], 5.5, 0, TAU); }
    front.fill();
  }
  add.globalAlpha = 1; front.globalAlpha = 1;
}

function drawLogo(g, t, L) {
  if (L < 4) return;
  const img = IMG.game_logo;
  const tb = bt(B0 + 4);
  const e = eOutExpo(seg(t, tb, tb + 0.35));
  const out = eInExpo(seg(L, 7.35, 7.75));
  const w = 960 * lerp(1.7, 1, e) * (1 + 0.03 * pulse(t, bt(B0 + Math.floor(L)), 0.1)) * (1 - out * 0.3);
  const h = w * img.height / img.width;
  const x = CX - w / 2, y = 820 - h / 2 - out * 300;
  // pikselizacja na wejściu (klocki 48 px → ostro)
  const bs = Math.max(1, Math.round(lerp(56, 1, eOutExpo(seg(t, tb, tb + 0.4)))));
  g.globalAlpha = seg(t, tb - 0.01, tb + 0.05) * (1 - out);
  if (bs > 1) {
    const sw = Math.max(2, Math.round(w / bs)), sh = Math.max(2, Math.round(h / bs));
    pixG.clearRect(0, 0, pix.width, pix.height);
    pixG.imageSmoothingEnabled = true;
    pixG.drawImage(img, 0, 0, sw, sh);
    g.imageSmoothingEnabled = false;
    g.drawImage(pix, 0, 0, sw, sh, x, y, w, h);
    g.imageSmoothingEnabled = true;
  } else g.drawImage(img, x, y, w, h);
  g.globalAlpha = 1;
}

export default {
  name: 'game', b0: 32, b1: 40, pre: 0.3, post: 0.02,
  async load() {
    scene = new THREE.Scene();
    cam = pixelCam(30);
    screen = imagePlane(SHOTS[0], 920, { round: 0.012 });
    screen.material.uniforms.uScanLines.value = 0.12;
    scene.add(screen);
    bullets = buildBullets();
    [pix, pixG] = canvas2d(1400, 600);
  },
  frame(S, Ls) {
    const { t, B } = S, L = B - B0, fx = S.fx;
    const front = Ls.front.g, add = Ls.add.g;
    if (L < 0) {   // pre: tylko błysk "press start" (rysuje S3)
      return;
    }
    // ---- tło: warp
    const phase = 0.55 * (t - bt(B0)) + 2.4 * eOutExpo(seg(L, 0, 1.4)) + [1, 2, 3, 4, 5, 6, 7].reduce((s, b) => s + 0.25 * eOutExpo(seg(L, b, b + 0.4)), 0);
    const len = 0.12 + 0.55 * decay(t, bt(B0), 0.45) + 0.12 * pulse(t, bt(B0 + Math.floor(L)), 0.1);
    const inten = (0.85 - 0.3 * seg(L, 1, 2)) * (1 - seg(L, 7.45, 7.9));
    S.bgs.push(bgEntry(5, [inten, phase, len, 0.9], [0, 0.2 * decay(t, bt(B0), 0.4), 0, 0]));
    // ---- ekran z gameplayem (L2–L4)
    const se = eOutBack(seg(L, 1.95, 2.3), 1.5), sx = eInExpo(seg(L, 3.7, 3.98));
    screen.visible = L > 1.9 && L < 4.0;
    if (screen.visible) {
      const idx = Math.min(3, Math.floor((L - 2) * 2));
      screen.material.uniforms.tMap.value = TEX[SHOTS[Math.max(0, idx)]];
      screen.position.set(wx(CX), wy(1120), 0);
      screen.rotation.set(rad(6), rad(-14) + rad(28) * seg(L, 2, 4) + rad(90) * sx, rad(-3));
      screen.scale.setScalar(Math.max(0.001, lerp(0.5, 1, se)));
      screen.material.uniforms.uBright.value = 1 + 0.6 * pulse(t, bt(B0 + 2) + Math.max(0, idx) * BEAT / 2, 0.06);
    }
    S.list3d.push({ scene, camera: cam });
    fx.tone3d = 0;
    // ---- boss, statek, pociski
    drawBoss(front, t, L);
    drawBullets(front, add, t);
    drawShip(front, add, t, L);
    // ---- logo + podpisy
    drawLogo(front, t, L);
    if (L >= 4) {
      shockRings(add, t, bt(B0 + 4), CX, 820, 1100, 0.8, 10);
      drawBurst(add, burst, t, bt(B0 + 4), CX, 820, { drag: 4.5, r0: 80 });
    }
    const out = eInExpo(seg(L, 7.35, 7.7));
    if (L >= 5) {
      const tb = bt(B0 + 5);
      tapeLabel(front, 'MOJA GRA', CX, 1150 - out * 80, { size: 92, reveal: eOutExpo(seg(t, tb, tb + 0.22)) * (1 - out), inks: inkOff(18 * decay(t, tb, 0.08), 0.5, 4), skew: -0.08 });
    }
    if (L >= 5.5) {
      const tb = bt(B0 + 5.5);
      tapeLabel(front, 'NA STEAM', CX, 1285 - out * 80, { size: 92, bg: C, fg: '#050505', reveal: eOutExpo(seg(t, tb, tb + 0.22)) * (1 - out), skew: -0.08 });
    }
    sectionTitle(front, S, { num: '04', label: 'GAME DEV · SPACEFIGHTER', lines: [], b0: B0 + 0.2, bOut: B0 + 7.3, y: 240, size: 150 });
    // ---- akcenty
    fx.flash += 0.35 * decay(t, bt(B0), 0.1) + 0.35 * pulse(t, bt(B0 + 4), 0.1);
    fx.flashCol = [0.85, 1, 1];
    fx.aberr += 26 * pulse(t, bt(B0 + 4), 0.12);
    fx.ripple = Math.max(fx.ripple, 0.9 * decay(t, bt(B0 + 4), 0.3));
    if (L >= 4) { fx.rippleR = (t - bt(B0 + 4)) * 2400; fx.rippleY = 820; }
    fx.glitch += 0.4 * pulse(t, bt(B0 + 4), 0.05) + 0.25 * pulse(t, FREEZE, 0.06);
    fx.glitchSeed = Math.floor(t * 40);
    fx.shakeX += 14 * decay(t, bt(B0 + 4), 0.1) * Math.sin(t * 97);
    fx.shakeY += 14 * decay(t, bt(B0 + 4), 0.1) * Math.cos(t * 83);
  },
};
