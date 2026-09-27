// Świat przez cały reels: poświaty strony, gwiazdy płynące promieniście (wciągane przy składaniu, wyrzucane przy wybuchach),
// "wizjer" obserwatora (narożniki, REC, pasek CMYK) oraz efekty kamery na stopach i wybuchach.
import { W, H, CX, BEAT, DUR, bt, C, M, Y, WHITE, GREY, clamp, lerp, seg, TAU, pulse, decay, eOutExpo, smooth, text, setFont } from '../core.js';
import { drawStars, colorBar } from '../common.js';
import { kickPulse, eyePos, scatterLevel } from '../director.js';

// odepchnięcia gwiazd: intro — gwiazdy zjeżdżają się do środka razem z częściami oka; wybuchy — fala na zewnątrz i powolny powrót
const bump = (tb, a, up = 0.05, down = 0.9) => t => t <= tb ? 0 : a * (Math.exp(-(t - tb) / down) - Math.exp(-(t - tb) / up));
const PUSHES = [
  { cx: 540, cy: 860, w: t => 1.1 * Math.pow(1 - smooth(seg(t, 0, bt(4))), 1.6) },
  { cx: 540, cy: 860, w: bump(bt(4), 0.55) },
  { cx: 540, cy: 860, w: bump(bt(14), 1.1) },
  { cx: 810, cy: 390, w: bump(bt(30), 0.8) },
  { cx: 810, cy: 390, w: bump(bt(38), 1.0) },
];

export default {
  name: 'world', b0: 0, b1: 46.5,
  frame(S, L) {
    const { t, B, fx } = S;
    const back = L.back.g, hud = L.hud.g;
    const kick = kickPulse(t);
    // ---- poświaty: dryf jak floatGlow (15 s), mocniejsze przy uderzeniach
    const hit = pulse(t, bt(4), 0.5) + pulse(t, bt(14), 0.6) + pulse(t, bt(30), 0.5) + pulse(t, bt(38), 0.6);
    const d = k => [Math.sin(t * 0.42 + k) * 60, Math.cos(t * 0.33 + k * 2) * 50];
    const intro = lerp(0.35, 1, smooth(seg(t, 0, bt(4))));
    const g0 = d(0), g1 = d(2), g2 = d(4);
    S.glows[0] = [-60 + g0[0], -120 + g0[1], 1250, (0.15 + 0.1 * hit + 0.02 * kick) * intro];
    S.glows[1] = [1180 + g1[0], 1560 + g1[1], 1250, (0.15 + 0.1 * hit + 0.02 * kick) * intro];
    const [ex, ey] = eyePos(B);
    // żółta poświata idzie za okiem (jak "łuna" pod reflektorem)
    S.glows[2] = [lerp(560, ex, 0.6) + g2[0] * 0.5, lerp(940, ey, 0.6) + g2[1] * 0.5, 900, 0.07 + 0.08 * hit];

    // ---- gwiazdy: środek przepływu = oko
    drawStars(back, t, { pushes: PUSHES, alpha: intro });

    // ---- efekty kamery
    fx.zoom *= 1 + 0.01 * kick;
    const lvl = scatterLevel(t);
    for (const b of [14, 30, 38]) {
      const k = decay(t, bt(b), 0.18);
      fx.shakeX += Math.sin(t * 71 + b) * 26 * k; fx.shakeY += Math.cos(t * 63 + b) * 22 * k;
      fx.aberr += 26 * pulse(t, bt(b), 0.16);
      fx.ripple += 1.1 * decay(t, bt(b), 0.3);
      if (t > bt(b) && t < bt(b) + 0.8) { fx.rippleR = (t - bt(b)) * 2600; fx.rippleX = ex; fx.rippleY = ey; }
      fx.flash += 0.22 * pulse(t, bt(b), 0.07);
    }
    fx.aberr += 3 * lvl + 6 * kick;
    fx.focusX = ex; fx.focusY = ey;
    // wejście z czerni i wyjście
    fx.fade = Math.max(1 - smooth(seg(t, 0, 0.12)), smooth(seg(t, bt(45.4), bt(46.2))));

    // ---- wizjer: narożniki, REC, pasek farb (HUD, bez bloomu); poza strefą treści
    const vis = smooth(seg(t, bt(3.9), bt(4.6))) * (1 - smooth(seg(t, bt(45), bt(45.8))));
    if (vis > 0) {
      // "…i trochę Ciebie" (B11–B12.6): narożniki zaciskają się na środku kadru — oko namierza widza
      const lock = eOutExpo(seg(t, bt(11.0), bt(11.35))) * (1 - smooth(seg(t, bt(12.4), bt(12.9))));
      const m = 46 + 120 * lock, top = 150 + 170 * lock, bot = 1610 - 170 * lock, L_ = 44 + 16 * lock;
      const breathe = 5 * kick;
      hud.save();
      hud.globalAlpha = 0.45 * vis;
      hud.strokeStyle = WHITE; hud.lineWidth = 3;
      const corner = (x, y, sx, sy) => { hud.beginPath(); hud.moveTo(x, y + sy * L_); hud.lineTo(x, y); hud.lineTo(x + sx * L_, y); hud.stroke(); };
      corner(m - breathe, top - breathe, 1, 1); corner(W - m + breathe, top - breathe, -1, 1);
      corner(m - breathe, bot + breathe, 1, -1); corner(W - m + breathe, bot + breathe, -1, -1);
      hud.restore();
      // REC: kropka magenty mruga co takt
      const recOn = (Math.floor(t / (BEAT * 2)) % 2 === 0) ? 1 : 0.25;
      hud.save();
      hud.globalAlpha = vis * recOn;
      hud.fillStyle = M; hud.beginPath(); hud.arc(70, 200, 9, 0, TAU); hud.fill();
      hud.restore();
      text(hud, 'REC', 90, 209, { weight: 500, size: 26, spacing: 4, color: WHITE, alpha: 0.7 * vis });
      colorBar(hud, m + 22, bot - 40, 16, 0.75 * vis * (1 - lock));
      if (lock > 0.01) {
        const blink = Math.floor(t * 8) % 2 ? 1 : 0.55;
        hud.save(); hud.globalAlpha = lock; hud.strokeStyle = M; hud.lineWidth = 4;
        const cornerM = (x, y, sx, sy) => { hud.beginPath(); hud.moveTo(x, y + sy * 70); hud.lineTo(x, y); hud.lineTo(x + sx * 70, y); hud.stroke(); };
        cornerM(m - 14, top - 14, 1, 1); cornerM(W - m + 14, top - 14, -1, 1); cornerM(m - 14, bot + 14, 1, -1); cornerM(W - m + 14, bot + 14, -1, -1);
        hud.restore();
        text(hud, 'CEL NAMIERZONY: TY', W / 2, 262, { weight: 700, size: 38, spacing: 7, align: 'center', color: M, alpha: lock * blink });
      }
    }
  },
};

