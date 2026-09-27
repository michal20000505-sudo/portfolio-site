// S0 — HOOK (B0–B8): "PROJEKTUJĘ / RZECZY, / NA KTÓRE / CHCE SIĘ / PATRZEĆ." + mechaniczne oko + nurkowanie w źrenicę.
import {
  W, H, CX, BEAT, bt, C, M, Y, INK, GREY, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eOutBack, eInOutCubic, eOutCubic, decay, pulse, hash, inkText, inkOff, fitSize,
} from '../core.js';
import { bgEntry, shockRings, ring } from '../common.js';

const WORDS = ['PROJEKTUJĘ', 'RZECZY,', 'NA KTÓRE', 'CHCE SIĘ', 'PATRZEĆ.'];
const EYE_X = CX, EYE_Y = 1080, R = 330;
const LOOK = [[5.0, 0, 0], [5.5, -46, -14], [6.0, 50, 8], [6.5, -8, -26], [7.0, 0, 0]];

function pupilOffset(B) {
  let x = 0, y = 0;
  for (let i = 0; i < LOOK.length; i++) {
    const [b, tx, ty] = LOOK[i];
    const e = eOutExpo(seg(B, b, b + 0.28));
    x = lerp(x, tx, e); y = lerp(y, ty, e);
  }
  return [x, y];
}

function drawEye(g, t, B) {
  const open = eOutBack(seg(B, 4.45, 5.15), 1.3) * (1 - 0.1 * (pulse(t, bt(5), 0.12) + pulse(t, bt(6), 0.12) + pulse(t, bt(7), 0.12)));
  const appear = eOutExpo(seg(B, 4.4, 5.0));
  if (appear <= 0) return;
  const sc = lerp(0.82, 1, appear);
  g.save();
  g.translate(EYE_X, EYE_Y); g.scale(sc, sc);
  const steps = [5, 6, 7].reduce((s, b) => s + eOutBack(seg(B, b, b + 0.45), 1.6), 0);
  // zewnętrzny pierścień z podziałką
  const rot1 = 0.25 * t + rad(15) * steps;
  const nt = 72, vis = Math.floor(nt * appear);
  for (let j = 0; j < vis; j++) {
    const a = rot1 + j / nt * TAU;
    const long = j % 6 === 0;
    const r0 = R - (long ? 36 : 18);
    g.strokeStyle = long ? '#ffffff' : C;
    g.globalAlpha = long ? 0.95 : 0.7;
    g.lineWidth = long ? 3.5 : 2;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke();
  }
  g.globalAlpha = 1;
  ring(g, 0, 0, R + 10, 1.5, '#555555', appear);
  // przerywany pierścień magenty (obrót przeciwny)
  const rot2 = -0.6 * t - rad(30) * steps;
  g.strokeStyle = M; g.lineWidth = 6; g.globalAlpha = 0.9 * appear;
  for (let j = 0; j < 24; j++) {
    const a = rot2 + j / 24 * TAU;
    g.beginPath(); g.arc(0, 0, R * 0.855, a, a + TAU / 24 * 0.55); g.stroke();
  }
  g.globalAlpha = 1;
  ring(g, 0, 0, R * 0.78, 2, '#333333', appear);
  // przysłona: 8 listków
  const Rb = R * 0.74, n = 8;
  const rh = lerp(R * 0.035, R * 0.6, clamp(open, 0, 1.2));
  const phi = lerp(1.1, 0, clamp(open, 0, 1)) + rot1 * 0.15;
  const V = [];
  for (let i = 0; i < n; i++) { const a = phi + i / n * TAU; V.push([Math.cos(a) * rh, Math.sin(a) * rh]); }
  // tęczówka widoczna w otworze
  g.save();
  g.beginPath(); V.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
  const gr = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 0.62);
  gr.addColorStop(0, '#06262a'); gr.addColorStop(0.55, '#0b4a55'); gr.addColorStop(1, '#2a0630');
  g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
  const [px, py] = pupilOffset(B);
  for (let j = 0; j < 140; j++) {
    const a = j / 140 * TAU + 0.3 * Math.sin(j * 1.7);
    const r0 = R * (0.2 + 0.04 * hash(j, 3)), r1 = R * (0.45 + 0.17 * hash(j, 5));
    g.strokeStyle = j % 3 === 0 ? C : j % 3 === 1 ? '#7fffff' : M;
    g.globalAlpha = 0.35 + 0.4 * hash(j, 9);
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(px * 0.5 + Math.cos(a) * r0, py * 0.5 + Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
  }
  g.globalAlpha = 1;
  // źrenica
  const pr = R * (0.2 + 0.03 * pulse(t, bt(6), 0.2));
  g.fillStyle = '#000000';
  g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
  ring(g, px, py, pr + 3, 2, C, 0.8);
  g.fillStyle = '#ffffff'; g.globalAlpha = 0.9;
  g.beginPath(); g.arc(px - pr * 0.38, py - pr * 0.42, pr * 0.13, 0, TAU); g.fill();
  g.globalAlpha = 1;
  g.restore();
  // listki: pierścień z otworem wielokątnym
  g.beginPath();
  g.arc(0, 0, Rb, 0, TAU);
  g.moveTo(V[0][0], V[0][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(V[i][0], V[i][1]);
  g.closePath();
  const bg = g.createRadialGradient(0, 0, rh, 0, 0, Rb);
  bg.addColorStop(0, '#2b2b2b'); bg.addColorStop(1, '#101010');
  g.fillStyle = bg; g.fill('evenodd');
  // krawędzie listków — przedłużenia boków wielokąta do obręczy
  for (let i = 0; i < n; i++) {
    const [x0, y0] = V[i], [x1, y1] = V[(i + 1) % n];
    let dx = x1 - x0, dy = y1 - y0; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const bq = x0 * dx + y0 * dy, cq = x0 * x0 + y0 * y0 - Rb * Rb;
    const s = -bq + Math.sqrt(Math.max(0, bq * bq - cq));
    g.strokeStyle = i % 2 ? '#5a5a5a' : '#8a8a8a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * s, y0 + dy * s); g.stroke();
  }
  g.strokeStyle = '#ffffff'; g.globalAlpha = 0.25 + 0.6 * pulse(t, bt(Math.floor(B)), 0.15); g.lineWidth = 2;
  g.beginPath(); V.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

export default {
  name: 'hook', b0: 0, b1: 8, pre: 0, post: 0.02,
  async load() {},
  frame(S, L) {
    const { t, B } = S, fx = S.fx;
    const front = L.front.g, add = L.add.g;
    // ---- tło: wir
    const dive = eInExpo(seg(B, 6.9, 8.0));
    let spin = 0.22 * t;
    for (let b = 0; b < 8; b++) spin += rad(22) * eOutBack(seg(B, b, b + 0.55), 1.6) * (b % 2 ? -1 : 1);
    let twist = 0.16 + 0.05 * Math.sin(t * 1.3);
    for (let b = 0; b < 8; b++) twist += 0.16 * pulse(t, bt(b), 0.22);
    const zoomPh = 1.3 * t + 26 * dive;
    const inten = (B < 4.4 ? 1 : lerp(1, 0.5, seg(B, 4.4, 5))) * (1 + 0.5 * dive);
    S.bgs.push(bgEntry(1, [inten * 0.85, zoomPh, twist, spin], [3, 0.0042, 0, 1]));

    // ---- słowa
    const wi = Math.min(4, Math.floor(B));
    const tw = bt(wi);
    let wy0 = 985, ws = 1;
    const word = WORDS[wi];
    const size = fitSize(front, word, 700, 900, 235, -0.02);
    const e = eOutExpo(seg(t, tw, tw + 0.32));
    ws = lerp(1.32, 1, e);
    let wx = CX;
    if (wi === 4) {
      const m = eInOutCubic(seg(B, 4.42, 4.95));
      wy0 = lerp(985, 555, m);
      ws *= lerp(1, 0.56, m);
    }
    const amt = 38 * decay(t, tw, 0.085) + 26 * dive;
    front.save();
    front.translate(wx, wy0);
    front.rotate(rad((wi % 2 ? 1 : -1) * 3) * (1 - e));
    front.scale(ws, ws);
    inkText(front, word, 0, size * 0.35, { size, weight: 700, inks: inkOff(amt, 0.8, wi * 13 + Math.floor(t * 30)), spacing: -size * 0.02, knock: true });
    front.restore();
    // akcent pod słowem
    const ul = eOutExpo(seg(t, tw + 0.04, tw + 0.3));
    front.fillStyle = INK[wi % 3];
    const uw = 120 * ul * ws;
    front.fillRect(wx - uw / 2, wy0 + size * 0.55 * ws, uw, 6 * ws);
    shockRings(add, t, tw, wx, wy0, 520 + wi * 40, 0.55, 5);

    // ---- oko
    drawEye(front, t, B);

    // ---- efekty
    fx.ripple = 0.9 * decay(t, 0, 0.35) + 0.7 * decay(t, bt(4), 0.3);
    fx.rippleR = (t < bt(4) ? t : t - bt(4)) * 2200;
    fx.rippleY = t < bt(4) ? 985 : 985;
    fx.aberr += 10 * pulse(t, bt(wi), 0.08) + 22 * pulse(t, bt(4), 0.12);
    fx.glitch = 0.35 * pulse(t, bt(4), 0.06);
    fx.glitchSeed = Math.floor(t * 30);
    fx.flash = 0.2 * pulse(t, bt(4), 0.08);
    // nurkowanie w źrenicę
    const [px, py] = pupilOffset(B);
    fx.focusX = EYE_X + px; fx.focusY = EYE_Y + py;
    fx.zoom *= Math.exp(dive * Math.log(60));
    fx.rot += rad(-25) * dive;
  },
};
