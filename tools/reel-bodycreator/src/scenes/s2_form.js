// S2 — FORMULARZ (B7.85–B13): złota karta z nurkowania rozcina się ukośnie i odsłania formularz w stylu strony.
// Palec wypełnia 3 pola (pisanie na 32-kach), zaznacza zgodę, tapnięcie "wyślij" → przycisk zwija się w kółko ze spinnerem
// → B12 "GOTOWE!" (ptaszek, iskry, fala). Nagłówek jak tablica wyników: "3 POLA." → "WYŚLIJ." → "GOTOWE!".
import {
  W, H, CX, CY, BEAT, S16, bt, rt, GOLD, GOLD_HI, GOLD_DEEP, ICE, ASH, SLATE, OBSIDIAN, ANTHRACITE, clamp, lerp, seg, TAU,
  eOutExpo, eInExpo, eOutBack, eInBack, eInOutCubic, eOutCubic, eInCubic, decay, pulse, spring, text, fitSize, measure, setFont, rrect,
} from '../core.js';
import { goldLabel, pill, touch, dust, makeBurst, drawBurst, shockRing, slashPath, SLASH, clipFrame, CLIP, bgEntry } from '../common.js';

const CARD = { x: 70, y: 575, w: 940, h: 905, r: 36 };
const FIELDS = [
  { label: 'IMIĘ *', ph: 'Jan', val: 'Ania', tap: 8.5, span: 0.28 },
  { label: 'NUMER TELEFONU *', ph: '600 123 456', val: '512 345 678', tap: 9.0, span: 0.42 },
  { label: 'ADRES E-MAIL *', ph: 'jan@gmail.com', val: 'ania@gmail.com', tap: 9.5, span: 0.42 },
];
const FX0 = 110, FW = 860, FH = 108;
const fieldY = i => 668 + i * 196;          // góra pola
const CONSENT_Y = 1262, CHECK_B = 10.0;
const BTN = { x: CX, y: 1398, w: 860, h: 116 }, SUBMIT_B = 11.0, SUCCESS_B = 12.0;
const CIRCLE = { x: CX, y: 985, r: 136 };
const BURST = makeBurst(7, 60, 1500, [0.4, 1.0]);

function titleWord(B) {
  if (B < SUBMIT_B) return 0;
  if (B < SUCCESS_B) return 1;
  return 2;
}
const WORDS = [['3 POLA.', ICE], ['WYŚLIJ.', ICE], ['GOTOWE!', GOLD]];

// nagłówek-tablica: stare słowo odjeżdża w górę, nowe wjeżdża od dołu (maska)
function scoreboard(g, t, B, alpha) {
  const y = 470;
  const size = 150;
  const changes = [8.0, SUBMIT_B, SUCCESS_B];
  const cur = titleWord(B);
  g.save();
  g.beginPath(); g.rect(0, y - size * 0.95, W, size * 1.2); g.clip();
  for (let i = Math.max(0, cur - 1); i <= cur; i++) {
    const tin = bt(changes[i]) + (i === 0 ? 0.08 : 0), tout = i < 2 ? bt(changes[i + 1]) : 1e9;
    const ein = eOutExpo(seg(t, tin, tin + 0.38)), eout = eInCubic(seg(t, tout - 0.02, tout + 0.12));
    if (ein <= 0 || eout >= 1) continue;
    const [w, col] = WORDS[i];
    const s = fitSize(g, w, 900, 940, size, 0.01);
    const dy = (1 - ein) * size * 1.15 - eout * size * 1.15;
    text(g, w, CX, y + dy, { weight: 900, size: s, spacing: s * 0.01, align: 'center', color: col, alpha,
      shadow: i === 2 ? 'rgba(247,181,0,0.45)' : null, shadowBlur: 40 });
  }
  g.restore();
}

function checkMark(g, x, y, s, p, color, lw) {
  if (p <= 0) return;
  const pts = [[-0.42, 0.02], [-0.12, 0.32], [0.46, -0.3]];
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const L = (l1 + l2) * p;
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x + pts[0][0] * s, y + pts[0][1] * s);
  if (L <= l1) {
    const u = L / l1;
    g.lineTo(x + lerp(pts[0][0], pts[1][0], u) * s, y + lerp(pts[0][1], pts[1][1], u) * s);
  } else {
    g.lineTo(x + pts[1][0] * s, y + pts[1][1] * s);
    const u = (L - l1) / l2;
    g.lineTo(x + lerp(pts[1][0], pts[2][0], u) * s, y + lerp(pts[1][1], pts[2][1], u) * s);
  }
  g.stroke();
}

export default {
  name: 'form', b0: 7.85, b1: 13.05, pre: 0, post: 0,
  async load() {},
  frame(S, Ls) {
    const { t, B, tr } = S, fx = S.fx;
    const g = Ls.front.g, back = Ls.back.g, add = Ls.add.g, hud = Ls.hud.g;
    // tło: ściana z logo (czarno-biała, ledwo widoczna) + delikatna złota poświata
    const bgA = seg(B, 7.95, 8.2) * (1 - seg(B, 12.7, 13.0));
    S.bgs.push(bgEntry(clipFrame('wall', tr - rt(7.9)), CLIP.wall.aspect, 0.22 * bgA, { zoom: 1.15 + 0.03 * (tr - rt(8)), fx: 0.55, fy: 0.3, bright: 0.7, sat: 0, contrast: 1.1 }));
    fx.glow = Math.max(fx.glow, 0.09 * bgA); fx.glowY = -60; fx.glowR = 950;

    // ------------------------------------------------ wejście formularza
    const inE = t0 => eOutExpo(seg(t, t0, t0 + 0.45));
    const sent = eInOutCubic(seg(B, SUBMIT_B + 0.1, SUBMIT_B + 0.5));   // pola odjeżdżają po wysłaniu
    const exitAll = eInCubic(seg(B, 12.6, 12.95));
    // karta
    const ce = inE(bt(8.0));
    if (ce > 0 && sent < 1) {
      g.save();
      g.globalAlpha = ce * (1 - sent);
      g.translate(0, (1 - ce) * 140 - sent * 120);
      rrect(g, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
      g.fillStyle = ANTHRACITE; g.fill();
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.07)'; g.stroke();
      // pola
      FIELDS.forEach((f, i) => {
        const fe = inE(bt(8.06 + i * 0.125));
        if (fe <= 0) return;
        const y = fieldY(i) + (1 - fe) * 60;
        g.globalAlpha = fe * (1 - sent);
        text(g, f.label, FX0, y - 22, { weight: 700, size: 25, spacing: 1.5, color: ICE, alpha: fe * (1 - sent) });
        const focus = seg(t, bt(f.tap), bt(f.tap) + 0.1) * (1 - seg(t, bt(f.tap + 0.5), bt(f.tap + 0.5) + 0.1));
        if (focus > 0) {       // Focus Ring ze strony
          rrect(g, FX0 - 6, y - 6, FW + 12, FH + 12, 26);
          g.fillStyle = `rgba(242,201,76,${0.12 * focus})`; g.fill();
        }
        rrect(g, FX0, y, FW, FH, 20);
        g.fillStyle = '#161616'; g.fill();
        g.lineWidth = 2;
        g.strokeStyle = focus > 0 ? `rgba(245,202,0,${0.25 + 0.75 * focus})` : 'rgba(255,255,255,0.08)';
        g.stroke();
        // tekst: wpisywanie znak po znaku
        const t0 = bt(f.tap + 0.06), span = bt(f.span);
        const n = Math.min(f.val.length, Math.max(0, Math.floor((t - t0) / span * f.val.length + 1e-6) + (t >= t0 ? 1 : 0)));
        const tx = FX0 + 34, ty = y + FH / 2 + 15;
        if (n === 0) text(g, f.ph, tx, ty, { weight: 400, size: 40, color: '#5c5c5c', alpha: fe * (1 - sent) });
        else text(g, f.val.slice(0, n), tx, ty, { weight: 500, size: 42, color: ICE, alpha: fe * (1 - sent) });
        // kursor
        if (focus > 0.5 && Math.floor(t * 4) % 2 === 0 || (focus > 0.5 && n > 0 && n < f.val.length)) {
          const cw = measure(g, f.val.slice(0, n), 500, 42);
          g.fillStyle = GOLD; g.globalAlpha = fe;
          g.fillRect(tx + cw + 5, y + 28, 3.5, FH - 56);
        }
        // ptaszek "pole gotowe"
        const done = eOutBack(seg(t, t0 + span + 0.02, t0 + span + 0.2), 2.4);
        if (done > 0) {
          g.globalAlpha = fe * (1 - sent);
          checkMark(g, FX0 + FW - 50, y + FH / 2, 36 * done, 1, GOLD, 6);
        }
        g.globalAlpha = 1;
      });
      // zgoda
      const ke = inE(bt(8.44));
      if (ke > 0) {
        g.globalAlpha = ke * (1 - sent);
        const on = eOutBack(seg(t, bt(CHECK_B), bt(CHECK_B) + 0.16), 2);
        const cy = CONSENT_Y + (1 - ke) * 40;
        rrect(g, FX0, cy - 25, 50, 50, 11);
        g.fillStyle = on > 0 ? GOLD : '#161616'; g.fill();
        g.lineWidth = 2; g.strokeStyle = on > 0 ? GOLD : 'rgba(255,255,255,0.28)'; g.stroke();
        if (on > 0) checkMark(g, FX0 + 25, cy, 34, clamp(seg(t, bt(CHECK_B), bt(CHECK_B) + 0.14)), OBSIDIAN, 6);
        text(g, 'Wyrażam zgodę na przetwarzanie moich danych', FX0 + 74, cy - 5, { weight: 400, size: 25, color: '#b8b8b8', alpha: ke * (1 - sent) });
        text(g, 'osobowych w celu umówienia konsultacji.', FX0 + 74, cy + 27, { weight: 400, size: 25, color: '#b8b8b8', alpha: ke * (1 - sent) });
        g.globalAlpha = 1;
      }
      g.restore();
    }
    // ------------------------------------------------ przycisk → kółko ze spinnerem → ptaszek
    const be = inE(bt(8.5));
    if (be > 0 && exitAll < 1) {
      const morph = eInOutCubic(seg(B, SUBMIT_B + 0.06, SUBMIT_B + 0.42));
      const lift = eInOutCubic(seg(B, SUBMIT_B + 0.35, SUCCESS_B - 0.05));
      const hover = seg(B, 10.5, 10.9);
      const press = Math.exp(-Math.pow((B - SUBMIT_B - 0.05) / 0.08, 2));
      const bx = BTN.x, by = lerp(BTN.y + (1 - be) * 80, CIRCLE.y, lift);
      const hgt = lerp(BTN.h, CIRCLE.r * 2, lift);
      const wid = lerp(lerp(BTN.w, BTN.h, morph), CIRCLE.r * 2, lift);
      const pop = B >= SUCCESS_B ? spring(seg(t, bt(SUCCESS_B), bt(SUCCESS_B) + 0.6) * 1.0, 9, 6) : 1;
      const sc = (B >= SUCCESS_B ? lerp(1.18, 1, pop) : 1) * (1 - 0.05 * press) * (1 - exitAll);
      g.save();
      g.globalAlpha = be;
      g.translate(bx, by); g.scale(sc, sc); g.translate(-bx, -by);
      if (morph < 0.02) {
        pill(g, bx, by, wid, hgt, 'ZAPISUJĘ SIĘ NA KONSULTACJĘ', { size: 30, glow: 0.4 + 0.6 * hover, press });
      } else {
        g.shadowColor = `rgba(247,181,0,${0.5})`; g.shadowBlur = 50 + 40 * lift; g.shadowOffsetY = 10 * (1 - lift);
        rrect(g, bx - wid / 2, by - hgt / 2, wid, hgt, hgt / 2);
        g.fillStyle = GOLD; g.fill();
        g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
        // znikający napis
        const ta = 1 - seg(B, SUBMIT_B + 0.02, SUBMIT_B + 0.16);
        if (ta > 0) {
          g.save(); rrect(g, bx - wid / 2, by - hgt / 2, wid, hgt, hgt / 2); g.clip();
          text(g, 'ZAPISUJĘ SIĘ NA KONSULTACJĘ', bx - 18, by + 11, { weight: 700, size: 30, align: 'center', color: OBSIDIAN, alpha: ta * be });
          g.restore();
        }
        // spinner
        const sp = seg(B, SUBMIT_B + 0.3, SUBMIT_B + 0.4) * (1 - seg(B, SUCCESS_B - 0.04, SUCCESS_B));
        if (sp > 0) {
          const rr = hgt * 0.3;
          const a0 = (t - bt(SUBMIT_B)) * (9 + 14 * seg(B, SUBMIT_B, SUCCESS_B)) ;
          g.lineWidth = hgt * 0.065; g.lineCap = 'round';
          g.globalAlpha = sp * be * 0.22; g.strokeStyle = OBSIDIAN;          // tor spinnera
          g.beginPath(); g.arc(bx, by, rr, 0, TAU); g.stroke();
          g.globalAlpha = sp * be;
          g.beginPath(); g.arc(bx, by, rr, a0, a0 + 1.4 + 2.2 * (0.5 + 0.5 * Math.sin(t * 7))); g.stroke();
          g.globalAlpha = be;
        }
        // ptaszek
        if (B >= SUCCESS_B) checkMark(g, bx, by, hgt * 0.62, eOutCubic(seg(t, bt(SUCCESS_B), bt(SUCCESS_B) + 0.2)), OBSIDIAN, hgt * 0.1);
      }
      g.restore();
    }
    // iskry i fala na "GOTOWE!"
    drawBurst(add, BURST, t, bt(SUCCESS_B), CIRCLE.x, CIRCLE.y, { r0: CIRCLE.r * 0.9, grav: 500, drag: 4.2 });
    shockRing(add, t, bt(SUCCESS_B), CIRCLE.x, CIRCLE.y, 620, 0.7, 10);
    // ------------------------------------------------ nagłówek + podpis
    const headA = inE(bt(8.0)) * (1 - exitAll);
    goldLabel(g, 'DARMOWA KONSULTACJA', CX, 300 - exitAll * 40, { size: 26, reveal: seg(t, bt(8.05), bt(8.05) + 0.35), alpha: headA });
    scoreboard(g, t, B, headA);
    const subA = seg(t, bt(SUCCESS_B + 0.15), bt(SUCCESS_B + 0.15) + 0.14) * (1 - exitAll);
    if (subA > 0) text(g, 'Do zobaczenia w studio.', CX, 1250 + (1 - subA) * 30, { weight: 600, size: 46, align: 'center', color: ASH, alpha: subA });
    // ------------------------------------------------ palec
    const path = [[8.3, 330, fieldY(0) + FH / 2], [8.5, 330, fieldY(0) + FH / 2], [8.85, 420, fieldY(1) + FH / 2], [9.0, 420, fieldY(1) + FH / 2],
      [9.35, 470, fieldY(2) + FH / 2], [9.5, 470, fieldY(2) + FH / 2], [9.85, FX0 + 25, CONSENT_Y], [10.0, FX0 + 25, CONSENT_Y],
      [10.55, 700, BTN.y + 8], [SUBMIT_B, 640, BTN.y + 6]];
    let px = path[0][1], py = path[0][2];
    for (let i = 1; i < path.length; i++) {
      const u = eInOutCubic(seg(B, path[i - 1][0], path[i][0]));
      if (B >= path[i - 1][0]) { px = lerp(path[i - 1][1], path[i][1], u); py = lerp(path[i - 1][2], path[i][2], u); }
    }
    const taps = [...FIELDS.map(f => f.tap), CHECK_B, SUBMIT_B];
    const lastTap = taps.filter(b => b <= B + 0.001).pop() ?? -9;
    touch(hud, t, px, py, { t0: bt(8.28), tTap: bt(lastTap), t1: bt(SUBMIT_B + 0.18), r: 42 });
    // ------------------------------------------------ złoty panel z nurkowania rozcina się ukośnie (B8)
    const split = eInCubic(seg(t, bt(8.0) - 0.03, bt(8.0) + 0.2));
    if (B < 8.3) {
      const cover = seg(B, 7.92, 7.94);
      const d = split * 1400;
      const xl = y => CX + (y - CY) * SLASH;       // linia cięcia "\" przez środek kadru
      const Y0 = -3000, Y1 = H + 3000;
      g.save();
      g.globalAlpha = cover;
      for (const side of [-1, 1]) {
        g.save();
        g.translate(side * d, side * d * 0.45);
        g.beginPath();
        if (side < 0) { g.moveTo(-4000, Y0); g.lineTo(xl(Y0), Y0); g.lineTo(xl(Y1), Y1); g.lineTo(-4000, Y1); }
        else { g.moveTo(xl(Y0), Y0); g.lineTo(W + 4000, Y0); g.lineTo(W + 4000, Y1); g.lineTo(xl(Y1), Y1); }
        g.closePath();
        g.fillStyle = GOLD; g.fill();
        // błysk na krawędzi cięcia
        if (split > 0) {
          g.strokeStyle = GOLD_HI; g.lineWidth = 10 * (1 - split) + 2;
          g.beginPath(); g.moveTo(xl(Y0), Y0); g.lineTo(xl(Y1), Y1); g.stroke();
        }
        g.restore();
      }
      g.restore();
    }
    dust(add, tr, 0.35 * bgA);
    // ------------------------------------------------ kamera
    fx.shakeY += 14 * decay(t, bt(8.0), 0.05) * Math.sin((t - bt(8)) * 80);
    fx.zoom *= 1 + 0.02 * pulse(t, bt(8.0), 0.12);
    for (const b of [...FIELDS.map(f => f.tap), CHECK_B]) fx.zoom *= 1 + 0.004 * pulse(t, bt(b), 0.08);
    fx.zoom *= 1 + 0.012 * pulse(t, bt(SUBMIT_B), 0.1);
    // napięcie przed wysłaniem: powolny najazd
    fx.zoom *= 1 + 0.03 * eInCubic(seg(B, SUBMIT_B, SUCCESS_B));
    fx.focusY = lerp(fx.focusY, CIRCLE.y, seg(B, SUBMIT_B, SUCCESS_B));
    // sukces
    fx.shakeY += 18 * decay(t, bt(SUCCESS_B), 0.06) * Math.sin((t - bt(SUCCESS_B)) * 85);
    fx.flash += 0.1 * pulse(t, bt(SUCCESS_B), 0.07);
    fx.flashCol = [1, 0.92, 0.7];
    fx.ripple += 1.0 * decay(t, bt(SUCCESS_B), 0.22) * seg(t, bt(SUCCESS_B), bt(SUCCESS_B) + 0.02);
    fx.rippleR = 90 + 1400 * (t - bt(SUCCESS_B)); fx.rippleX = CIRCLE.x; fx.rippleY = CIRCLE.y;
    fx.aberr += 5 * pulse(t, bt(SUCCESS_B), 0.1);
    fx.bloom = 0.5; fx.bloomThresh = 0.66;
  },
};
