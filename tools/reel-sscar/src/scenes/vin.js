// 03 — dekoder VIN / DAM (B46–B58). VIN wpada znak po znaku jak na tablicy klapkowej (32-ki), "Sprawdź VIN",
// podział na sekcje WMI / VDS / VIS, potem karta ze zdjęciem BMW M3 F80 z hali SSCAR i wynikiem dekodowania
// w stylu opisów z ich postów na Facebooku. Na koniec dekoder DAM/ORGA: 12468 → 28 grudnia 2010
// (ta sama formuła co dekoder.html: 8 listopada 1976 + liczba dni).
// VIN przykładowy, poprawny (cyfra kontrolna), dekodowany przez vPIC NHTSA jak na stronie: BMW M3 2015, 3.0 R6, 425 KM, Regensburg.
import {
  W, bt, RED, RED_HI, INK, MUTED, DIM, clamp, lerp, seg, pulse, rad, eOutExpo, eInExpo, eOutBack, eInOutCubic, eOutCubic, spring,
  hash, text, setFont, rrect, drawCover,
} from '../core.js';
import { ENV, IMG, Panel, icon, label, card, cardShadow, button, tap } from '../common.js';
import { CH } from '../director.js';
import { slideX } from './world.js';

export const VIN = 'WBS3C9C56FP736918';
const DAM = '12468';
export const VE = { flap: 46.5, press: 48.75, decode: 49.25, br: [49.25, 49.75, 50.25], card: 50.75, spec: 51.0, damSwap: 53.75, damFlap: 54.25, damPress: 55.0, damRes: 55.25 };
const X0 = 70, CW = 940 / 17, IY = 596, IH = 100;
const FLAP = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

let m3card;

function flapCell(g, x, y, w, h, ch, t, tLock, seed) {
  const d = t - tLock;
  const pre = t < tLock - 0.25;                  // pusta klapka
  rrect(g, x + 2, y, w - 4, h, 6);
  g.fillStyle = '#0b0908'; g.fill();
  const flash = pulse(t, tLock, 0.15);
  g.lineWidth = 2; g.strokeStyle = flash > 0.02 ? `rgba(226,32,32,${0.4 + 0.6 * flash})` : '#2a2524'; g.stroke();
  if (pre) return;
  let c = ch, dy = 0;
  if (d < 0) c = FLAP[Math.floor(hash(seed, Math.floor(t * 40)) * FLAP.length)];
  else dy = -6 * Math.exp(-d / 0.05) * Math.cos(d * 60);
  g.save();
  g.beginPath(); g.rect(x + 2, y, w - 4, h); g.clip();
  text(g, c, x + w / 2, y + h * 0.7 + dy, { family: 'cond', weight: 800, size: 58, align: 'center', color: d < 0 ? MUTED : INK });
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x + 4, y + h / 2 - 1, w - 8, 2);     // szczelina klapki
}

function bracket(g, x0, x1, y, k, code, val, sub) {
  if (k <= 0) return;
  const e = eOutExpo(k);
  const mid = (x0 + x1) / 2, half = (x1 - x0) / 2 * e;
  g.strokeStyle = RED_HI; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(mid - half, y - 14); g.lineTo(mid - half, y); g.lineTo(mid + half, y); g.lineTo(mid + half, y - 14);
  g.stroke();
  const tk = eOutExpo(clamp(k * 1.4 - 0.3));
  label(g, code, x0 + 4, y + 40, { size: 22, color: RED_HI, alpha: tk });
  text(g, val, x0 + 4, y + 82 + 12 * (1 - tk), { family: 'cond', weight: 900, size: 38, color: INK, alpha: tk });
  text(g, sub, x0 + 4, y + 114, { family: 'body', weight: 500, size: 22, color: MUTED, alpha: tk });
}

// karta z M3: zdjęcie z hali + wynik w stylu opisów SSCAR (prawa strona, cienka linia, ikony)
const MW = 940, MH = 440;
function drawM3(g, t) {
  cardShadow(g, 0, 0, MW, MH, 14, 0.75, 60, 26);
  g.save();
  rrect(g, 0, 0, MW, MH, 14); g.clip();
  drawCover(g, IMG.m3_hall, 0, 0, MW, MH, 0.42, 0.5, 1.02 + 0.03 * seg(t, bt(VE.card), bt(VE.damSwap)));
  const gr = g.createLinearGradient(MW * 0.3, 0, MW, 0);
  gr.addColorStop(0, 'rgba(9,7,6,0)'); gr.addColorStop(0.55, 'rgba(9,7,6,0.72)'); gr.addColorStop(1, 'rgba(9,7,6,0.9)');
  g.fillStyle = gr; g.fillRect(0, 0, MW, MH);
  const gb = g.createLinearGradient(0, MH * 0.55, 0, MH);
  gb.addColorStop(0, 'rgba(9,7,6,0)'); gb.addColorStop(1, 'rgba(9,7,6,0.65)');
  g.fillStyle = gb; g.fillRect(0, 0, MW, MH);
  g.restore();
  rrect(g, 0, 0, MW, MH, 14); g.lineWidth = 2; g.strokeStyle = '#342a28'; g.stroke();
  const R0 = MW - 36;
  const k = i => eOutExpo(seg(t, bt(VE.spec + i * 0.25), bt(VE.spec + 0.5 + i * 0.25)));
  text(g, 'BMW M3', R0 + 30 * (1 - k(0)), 118, { family: 'cond', weight: 900, size: 76, align: 'right', color: INK, alpha: k(0) });
  g.fillStyle = INK; g.globalAlpha = k(0); g.fillRect(R0 - 400 * k(0), 142, 400 * k(0), 3); g.globalAlpha = 1;
  const rows = [['2015', 'calDays'], ['R6 / 3.0 L / 425 KM', 'gauge'], ['SEDAN', 'car'], ['REGENSBURG, NIEMCY', 'pin']];
  rows.forEach(([s, ic], i) => {
    const kk = k(i + 1);
    const y = 206 + i * 56;
    text(g, s, R0 - 50 + 24 * (1 - kk), y, { family: 'cond', weight: 800, size: 40, align: 'right', color: INK, alpha: kk });
    icon(g, ic, R0 - 16, y - 13, 30, INK, kk);
  });
  label(g, 'Wynik dekodowania', 36, MH - 30, { size: 20, color: 'rgba(242,237,236,0.7)' });
}

export default {
  name: 'vin', b0: CH.vin - 0.4, b1: CH.klima + 0.3,
  load() { m3card = new Panel(ENV.uiTop, MW, MH, { pad: 90 }); },
  frame(S, L) {
    const { t, B } = S;
    const g = L.front.g;
    const sx = slideX(B, CH.vin, CH.klima);
    g.save();
    g.translate(sx, 0);
    const dam = eInOutCubic(seg(t, bt(VE.damSwap), bt(VE.damSwap + 0.5)));
    // ---- pole numeru: VIN (17 klapek) → DAM (5 klapek)
    const labIn = eOutExpo(seg(t, bt(CH.vin + 0.2), bt(CH.vin + 0.8)));
    label(g, 'Numer VIN — 17 znaków', X0, IY - 22 - 14 * dam, { size: 22, alpha: labIn * (1 - dam) });
    label(g, 'Kod DAM / ORGA', X0, IY - 22 + 14 * (1 - dam), { size: 22, alpha: dam });
    if (dam < 1) {
      g.save(); g.globalAlpha = 1 - dam;
      for (let i = 0; i < 17; i++) {
        const k = eOutExpo(seg(t, bt(CH.vin + 0.1 + i * 0.02), bt(CH.vin + 0.6 + i * 0.02)));
        if (k <= 0) continue;
        const col = Math.max(0, i - 0) ;
        flapCell(g, X0 + i * CW, IY + 30 * (1 - k) + 40 * dam * (i % 2 ? 1 : -1), CW, IH, VIN[i], t, bt(VE.flap + i * 0.125), i + 3);
      }
      g.restore();
    }
    if (dam > 0) {
      const dw = 132;
      for (let i = 0; i < 5; i++) {
        const k = eOutExpo(seg(t, bt(VE.damSwap + 0.2 + i * 0.06), bt(VE.damSwap + 0.7 + i * 0.06)));
        if (k <= 0) continue;
        flapCell(g, X0 + i * (dw + 10), IY + 30 * (1 - k), dw, IH, DAM[i], t, bt(VE.damFlap + i * 0.125), 40 + i);
      }
    }
    // ---- przycisk "Sprawdź VIN" / "Sprawdź datę" z ładowaniem
    const BY = IY + IH + 24;
    const bIn = eOutExpo(seg(t, bt(CH.vin + 0.5), bt(CH.vin + 1.1)));
    const bOut = eInExpo(seg(t, bt(VE.decode + 0.1), bt(VE.decode + 0.5)));
    const vinBtn = bIn * (1 - bOut);
    if (vinBtn > 0 && dam < 0.5) {
      g.save(); g.globalAlpha = vinBtn;
      const busy = t > bt(VE.press + 0.1) && t < bt(VE.decode + 0.1);
      button(g, X0, BY, 940, 84, busy ? ' ' : 'Sprawdź VIN', { press: pulse(t, bt(VE.press), 0.12), size: 32, icon: busy ? null : 'search' });
      if (busy) {
        g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round';
        const a = t * 14;
        g.beginPath(); g.arc(X0 + 470, BY + 42, 18, a, a + 4.2); g.stroke();
      }
      g.restore();
    }
    const damBtn = eOutExpo(seg(t, bt(VE.damSwap + 0.4), bt(VE.damSwap + 0.8))) * (1 - eInExpo(seg(t, bt(VE.damRes), bt(VE.damRes + 0.3))));
    if (damBtn > 0) {
      g.save(); g.globalAlpha = damBtn;
      button(g, X0, BY, 940, 84, 'Sprawdź datę', { press: pulse(t, bt(VE.damPress), 0.12), size: 32, icon: 'calDays' });
      g.restore();
    }
    // ---- sekcje VIN
    const brOut = eInExpo(seg(t, bt(VE.damSwap - 0.1), bt(VE.damSwap + 0.3)));
    if (brOut < 1) {
      g.save(); g.globalAlpha = 1 - brOut;
      const BRY = IY + IH + 22;
      const bk = i => seg(t, bt(VE.br[i]), bt(VE.br[i] + 0.6));
      bracket(g, X0 + 4, X0 + 3 * CW - 4, BRY, bk(0), 'WMI', 'BMW M', 'producent');
      bracket(g, X0 + 3 * CW + 4, X0 + 9 * CW - 4, BRY, bk(1), 'VDS', 'M3 · sedan', 'opis pojazdu');
      bracket(g, X0 + 9 * CW + 4, X0 + 17 * CW - 4, BRY, bk(2), 'VIS', '2015 · Regensburg', 'rok i zakład');
      g.restore();
    }
    // ---- wynik DAM
    const dr = seg(t, bt(VE.damRes), bt(VE.damRes + 0.5));
    if (dr > 0) {
      const e = eOutExpo(dr);
      const sh = pulse(t, bt(VE.damRes), 0.12) * 8;
      label(g, 'Data montażu pojazdu', X0, BY + 60, { size: 24, color: MUTED, alpha: e });
      text(g, '28 grudnia 2010', X0 - 4 + sh, BY + 170 + 20 * (1 - e), { family: 'cond', weight: 900, size: 128, italic: true, color: RED_HI, alpha: e });
      text(g, 'Dzień, w którym auto zjechało z taśmy.', X0, BY + 232, { family: 'body', weight: 500, size: 32, color: INK, alpha: eOutExpo(seg(t, bt(VE.damRes + 0.4), bt(VE.damRes + 0.9))) });
      text(g, 'Peugeot · Citroën · DS · Opel · Fiat · Toyota', X0, BY + 282, { family: 'body', weight: 400, size: 26, color: MUTED, alpha: eOutExpo(seg(t, bt(VE.damRes + 0.6), bt(VE.damRes + 1.1))) });
    }
    g.restore();
    // tapnięcia
    tap(g, 700 + sx, BY + 42, t, bt(VE.press));
    tap(g, 700 + sx, BY + 42, t, bt(VE.damPress));

    // ---- karta M3 (3D)
    const ck = seg(t, bt(VE.card), bt(VE.card + 0.7));
    const co = eInOutCubic(seg(t, bt(VE.damSwap - 0.15), bt(VE.damSwap + 0.4)));
    if (ck > 0 && co < 1) {
      const e = eOutExpo(ck);
      m3card.draw(gg => drawM3(gg, t));
      m3card.place({
        x: 540 + sx, y: 1062 + 120 * (1 - e) + 300 * co, z: -300 * (1 - e) - 200 * co, rx: rad(22) * (1 - e) + rad(-15) * co,
        opacity: clamp(ck * 2) * (1 - co), sheen: 0.8 * (1 - e * 0.4), sheenPos: lerp(-0.3, 1.4, seg(t, bt(VE.card), bt(VE.card + 1.3))),
      });
    }
  },
};
