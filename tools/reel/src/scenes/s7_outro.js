// S7 — OUTRO (B56–B64): z punktu wybuchają trzy kształty C/M/Y i wkręcają się w logo "MJ."
// (morfing konturów fontu), "CREATIVE DESIGNER", CTA: przycisk M-JARO.PL + e-mail w kolorach CMY ze strony.
import {
  W, H, CX, CY, BEAT, S16, DUR, bt, C, M, Y, INK, GREY, DIM, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eOutBack, eInOutCubic, eInCubic, decay, pulse, hash,
  inkText, inkOff, scramble, rrect, measure, setFont,
} from '../core.js';
import { bgEntry, shockRings, makeBurst, drawBurst, ring } from '../common.js';

const B0 = 56;
const LOGO_Y = 650, G = 150, FS = 428 / 1000, TRACK = -30;
const NP = 420;
const LAG = [0, 0.022, 0.044];
const REGD = [[-1, -0.55], [1, 0.55], [0.35, -1]];
const SH = {};
const burst = makeBurst(505, 200, 2300);
let svg;

function sample(d, tf) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); svg.appendChild(p);
  const len = p.getTotalLength(), out = new Float32Array(NP * 2);
  for (let i = 0; i < NP; i++) {
    const q = p.getPointAtLength(len * i / NP);
    const [x, y] = tf ? tf(q.x, q.y) : [q.x, q.y];
    out[2 * i] = x; out[2 * i + 1] = y;
  }
  let a = 0;
  for (let i = 0; i < NP; i++) { const j = (i + 1) % NP; a += out[2 * i] * out[2 * j + 1] - out[2 * j] * out[2 * i + 1]; }
  if (a < 0) { const r = new Float32Array(NP * 2); for (let i = 0; i < NP; i++) { const j = (NP - i) % NP; r[2 * i] = out[2 * j]; r[2 * i + 1] = out[2 * j + 1]; } return r; }
  return out;
}
function norm(a) {
  let cx = 0, cy = 0; for (let i = 0; i < NP; i++) { cx += a[2 * i]; cy += a[2 * i + 1]; } cx /= NP; cy /= NP;
  let r = 0; for (let i = 0; i < NP; i++) r += (a[2 * i] - cx) ** 2 + (a[2 * i + 1] - cy) ** 2; r = Math.sqrt(r / NP);
  const o = new Float32Array(NP * 2); for (let i = 0; i < NP; i++) { o[2 * i] = (a[2 * i] - cx) / r; o[2 * i + 1] = (a[2 * i + 1] - cy) / r; } return o;
}
const shiftCache = {};
function shift(from, to) {
  const k = from + '>' + to; if (k in shiftCache) return shiftCache[k];
  const A = norm(SH[from]), Bn = norm(SH[to]); let best = 0, bc = Infinity;
  for (let s = 0; s < NP; s += 2) { let c = 0; for (let i = 0; i < NP; i += 3) { const j = (i + s) % NP; c += (A[2 * i] - Bn[2 * j]) ** 2 + (A[2 * i + 1] - Bn[2 * j + 1]) ** 2; } if (c < bc) { bc = c; best = s; } }
  return shiftCache[k] = best;
}
const OBJ = [['circle', 'gDot'], ['square', 'gM'], ['triangle', 'gJ']];
const tmp = new Float32Array(NP * 2), pts = new Float32Array(NP * 2);

// stan obiektu j w czasie t (lokalne kształty w jednostkach G, wspólny środek logo)
function objPoints(j, t) {
  const tb = bt(B0);
  const e = eOutExpo(seg(t, tb, tb + 0.6));
  const [fromN, toN] = OBJ[j];
  const from = SH[fromN], to = SH[toN], s = shift(fromN, toN);
  for (let i = 0; i < NP; i++) {
    const q = (i + s) % NP;
    tmp[2 * i] = lerp(from[2 * i] * 0.35, to[2 * q], e);
    tmp[2 * i + 1] = lerp(from[2 * i + 1] * 0.35, to[2 * q + 1], e);
  }
  const rot = rad(-(360 + 120 * j)) * (1 - eOutExpo(seg(t, tb, tb + 0.75)));
  const size = G * lerp(0.2, 1, eOutBack(seg(t, tb, tb + 0.5), 1.6)) * (1 + 0.035 * seg(t, bt(B0 + 1), DUR) + 0.04 * pulse(t, bt(B0 + 4), 0.12));
  const c = Math.cos(rot) * size, sn = Math.sin(rot) * size;
  const jl = 0.03 * decay(t, tb, 0.2);
  for (let i = 0; i < NP; i++) {
    const w = 1 + jl * Math.sin(i / NP * TAU * 3 + t * 18);
    const lx = tmp[2 * i] * w, ly = tmp[2 * i + 1] * w;
    pts[2 * i] = CX + lx * c - ly * sn;
    pts[2 * i + 1] = LOGO_Y + lx * sn + ly * c;
  }
  return pts;
}
function trace(g, p, ox, oy) {
  g.beginPath();
  for (let i = 0; i < NP; i++) { const x = p[2 * i] + ox, y = p[2 * i + 1] + oy; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}

export default {
  name: 'outro', b0: 56, b1: 64, pre: 0, post: 0.5,
  async load() {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    document.body.appendChild(svg);
    const GL = await (await fetch('assets/glyphs.json')).json();
    SH.circle = sample('M0,-1 A1,1 0 1 1 0,1 A1,1 0 1 1 0,-1 Z');
    SH.square = sample('M0,-.9 L.9,-.9 L.9,.9 L-.9,.9 L-.9,-.9 Z');
    const tr = k => [Math.cos(rad(-90 + k * 120)) * 1.25, Math.sin(rad(-90 + k * 120)) * 1.25 + 0.18];
    SH.triangle = sample(`M${tr(0)}L${tr(1)}L${tr(2)}Z`);
    const xM = 0, xJ = GL.M.adv + TRACK, xD = xJ + GL.J.adv + TRACK;
    const cx = (GL.M.bounds[0] + xD + GL['.'].bounds[2]) / 2, cy = 350;
    const tf = off => (x, y) => [((x + off) - cx) * FS / G, -(y - cy) * FS / G];
    SH.gM = sample(GL.M.d, tf(xM)); SH.gJ = sample(GL.J.d, tf(xJ)); SH.gDot = sample(GL['.'].d, tf(xD));
  },
  frame(S, Ls) {
    const { t, B } = S, L = B - B0, fx = S.fx;
    const front = Ls.front.g, add = Ls.add.g;
    S.bgs.push(bgEntry(8, [eOutExpo(seg(L, 0, 1)), t, 0, 0], [0, 0, 0, 0]));
    // pierścienie za logo
    const re = eOutExpo(seg(L, 0.1, 1.2));
    for (let k = 0; k < 3; k++) {
      const r = (420 + k * 46) * re;
      add.strokeStyle = INK[k]; add.globalAlpha = 0.35; add.lineWidth = 2;
      const rot = t * (0.2 + k * 0.12) * (k % 2 ? -1 : 1);
      for (let d = 0; d < 36; d++) { const a = rot + d / 36 * TAU; add.beginPath(); add.arc(CX, LOGO_Y, r, a, a + TAU / 36 * 0.5); add.stroke(); }
    }
    add.globalAlpha = 1;
    shockRings(add, t, bt(B0), CX, LOGO_Y, 1500, 0.9, 14);
    drawBurst(add, burst, t, bt(B0), CX, LOGO_Y, { drag: 4.2, r0: 40 });
    // logo: każda farba osobno, z opóźnieniem — w ruchu kolorowe smugi, w spoczynku biel
    front.globalCompositeOperation = 'screen';
    let amt = 50 * decay(t, bt(B0), 0.12) + 22 * decay(t, bt(B0 + 4), 0.1);
    for (let k = 0; k < 3; k++) {
      front.fillStyle = INK[k];
      const jit = (hash(Math.floor(t * 30), k) - 0.5) * 0.8;
      const ox = REGD[k][0] * amt * (1 + jit), oy = REGD[k][1] * amt * (1 - jit);
      for (let j = 0; j < 3; j++) {
        if (j === 0 && k !== 0) continue;       // kropka zostaje cyjanowa
        trace(front, objPoints(j, t - LAG[k]), ox, oy); front.fill();
      }
    }
    front.globalCompositeOperation = 'source-over';
    // CREATIVE DESIGNER
    if (L >= 1) {
      const tb = bt(B0 + 1);
      inkText(front, scramble('CREATIVE DESIGNER', t, tb, 0.42, 9), CX, 915, { weight: 700, size: 84, spacing: -1, inks: inkOff(14 * decay(t, tb + 0.4, 0.1), 0.5, 3) });
      front.globalAlpha = seg(t, tb + 0.25, tb + 0.5);
      inkText(front, scramble('MICHAŁ JAROSIŃSKI', t, tb + 0.25, 0.4, 4), CX, 985, { weight: 500, size: 28, color: GREY, spacing: 6 });
      front.globalAlpha = 1;
    }
    // CTA
    if (L >= 3.8) {
      const tb = bt(B0 + 4);
      const e = eOutExpo(seg(t, tb - 0.1, tb + 0.35));
      front.globalAlpha = e;
      inkText(front, scramble('ROZPOCZNIJMY WSPÓŁPRACĘ', t, tb - 0.1, 0.4, 6), CX, 1140, { weight: 500, size: 26, color: GREY, spacing: 5 });
      // przycisk jak na stronie: obrys cyan → wypełnienie na uderzeniu
      const bw = 660, bh = 128, bx = CX - bw / 2, by = 1260 - bh / 2;
      const sc = lerp(0.85, 1, e) * (1 + 0.05 * pulse(t, tb, 0.12));
      front.save(); front.translate(CX, 1260); front.scale(sc, sc); front.translate(-CX, -1260);
      rrect(front, bx, by, bw, bh, 22);
      front.lineWidth = 4; front.strokeStyle = C; front.stroke();
      const fill = eOutExpo(seg(t, tb + 0.02, tb + 0.4));
      inkText(front, 'M-JARO.PL', CX, 1260 + 24, { weight: 700, size: 68, spacing: 2 });
      front.save(); front.beginPath(); front.rect(bx, by, bw * fill, bh); front.clip();
      rrect(front, bx, by, bw, bh, 22); front.fillStyle = C; front.fill();
      inkText(front, 'M-JARO.PL', CX, 1260 + 24, { weight: 700, size: 68, spacing: 2, color: '#050505' });
      front.restore();
      front.restore();
      // e-mail w kolorach CMY (jak sekcja kontakt na stronie)
      const ea = seg(t, tb + 0.2, tb + 0.5);
      if (ea > 0) {
        front.globalAlpha = ea;
        const parts = [['graf.m.jar', C], ['@', M], ['gmail.com', Y]];
        const sz = 46;
        const tot = parts.reduce((s, [p]) => s + measure(front, p, 500, sz, 0), 0);
        let x = CX - tot / 2;
        for (const [p, col] of parts) { inkText(front, p, x, 1400, { weight: 500, size: sz, align: 'left', color: col }); x += measure(front, p, 500, sz, 0); }
      }
      front.globalAlpha = 1;
    }
    // efekty
    fx.flash += 0.75 * pulse(t, bt(B0), 0.12) + 0.2 * pulse(t, bt(B0 + 4), 0.08);
    fx.ripple = Math.max(fx.ripple, 1.0 * decay(t, bt(B0), 0.35), 0.6 * decay(t, bt(B0 + 4), 0.3));
    fx.rippleR = L < 4 ? (t - bt(B0)) * 2600 : (t - bt(B0 + 4)) * 2400;
    fx.rippleY = L < 4 ? LOGO_Y : 1260;
    fx.aberr += 30 * pulse(t, bt(B0), 0.14) + 12 * pulse(t, bt(B0 + 4), 0.1);
    fx.glitch += 0.35 * pulse(t, bt(B0), 0.06);
    fx.glitchSeed = Math.floor(t * 40);
    fx.shakeX += 16 * decay(t, bt(B0), 0.1) * Math.sin(t * 97);
    fx.shakeY += 16 * decay(t, bt(B0), 0.1) * Math.cos(t * 83);
    fx.fade = eInCubic(seg(t, DUR - 0.55, DUR));
  },
};
