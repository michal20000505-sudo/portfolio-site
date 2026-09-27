// 04 — baza klimatyzacji (B58–B64). Wyszukiwarka czynnika z klima.html: marka → model → rocznik,
// wynik z bazy strony (2770 rekordów): BMW M3 (F80), 2014 –, R134a, 550 g, olej PAG ISO 46,
// cena jak liczy strona: 150 zł + 0,50 zł/g → od 150 zł do 425 zł.
import { W, bt, RED, RED_HI, INK, MUTED, DIM, clamp, lerp, seg, pulse, eOutExpo, eInExpo, eOutCubic, eInOutCubic, hash, text, setFont, rrect } from '../core.js';
import { icon, label, card, cardShadow, tap } from '../common.js';
import { CH } from '../director.js';
import { slideX } from './world.js';

export const KE = { sel: [58.5, 59.0, 59.5], title: 60.0, rows: [60.25, 60.5, 60.75], price: 61.0 };
const SELECTS = [
  ['Marka', 'BMW', ['Audi', 'Alfa Romeo', 'BMW', 'Citroën', 'Dacia', 'Fiat', 'Ford']],
  ['Model', 'M3 (F80)', ['3 Series (F30)', '3 Series (F80)', 'M2 (F87)', 'M3 (F80)', 'M4 (F82)', 'M5 (F90)']],
  ['Rocznik / silnik', '2014 –', ['2014 –']],
];
const X = 70, Y0 = 548;

function select(g, x, y, w, lab, val, opts, t, tSel) {
  label(g, lab, x, y, { size: 21 });
  const by = y + 14, bh = 72;
  const k = seg(t, tSel - 0.05, tSel + 0.35);
  const focus = pulse(t, tSel, 0.35);
  rrect(g, x, by, w, bh, 7);
  g.fillStyle = '#0b0908'; g.fill();
  g.lineWidth = 2; g.strokeStyle = focus > 0.03 ? `rgba(189,0,1,${0.35 + 0.65 * focus})` : '#2a2524'; g.stroke();
  g.save();
  g.beginPath(); g.rect(x + 2, by + 2, w - 60, bh - 4); g.clip();
  if (t < tSel - 0.05) text(g, lab === 'Marka' ? 'Wybierz markę…' : 'Najpierw wybierz ' + (lab === 'Model' ? 'markę' : 'model'), x + 24, by + 48, { family: 'body', weight: 500, size: 29, color: DIM });
  else {
    // lista przewija się i zatrzymuje na wartości (jak rozwinięty select)
    const idx = opts.indexOf(val);
    const pos = lerp(Math.max(0, idx - 3), idx, eOutCubic(k));
    for (let i = 0; i < opts.length; i++) {
      const dy = (i - pos) * 54;
      if (Math.abs(dy) > 76) continue;
      text(g, opts[i], x + 24, by + 48 + dy, { family: 'body', weight: i === idx ? 600 : 500, size: 30, color: i === idx && k > 0.9 ? INK : MUTED, alpha: 1 - Math.abs(dy) / 76 });
    }
  }
  g.restore();
  // strzałka selecta
  g.fillStyle = MUTED;
  g.beginPath(); g.moveTo(x + w - 42, by + 32); g.lineTo(x + w - 28, by + 32); g.lineTo(x + w - 35, by + 41); g.closePath(); g.fill();
}

export default {
  name: 'klima', b0: CH.klima - 0.4, b1: CH.outro + 0.3,
  frame(S, L) {
    const { t, B } = S;
    const g = L.front.g;
    const sx = slideX(B, CH.klima, CH.outro);
    g.save();
    g.translate(sx, 0);
    SELECTS.forEach(([lab, val, opts], i) => {
      const k = eOutExpo(seg(t, bt(CH.klima + 0.05 + i * 0.1), bt(CH.klima + 0.55 + i * 0.1)));
      if (k <= 0) return;
      g.save(); g.globalAlpha = k; g.translate(0, 24 * (1 - k));
      select(g, X, Y0 + i * 112, 940, lab, val, opts, t, bt(KE.sel[i]));
      g.restore();
    });
    // ---- wynik
    const tk = eOutExpo(seg(t, bt(KE.title), bt(KE.title + 0.5)));
    const RY = Y0 + 3 * 112 + 22;
    if (tk > 0) {
      g.fillStyle = '#2a2322'; g.fillRect(X, RY - 6, 940 * tk, 2);
      text(g, 'BMW M3 (F80)', X, RY + 50, { family: 'cond', weight: 900, size: 44, spacing: 1, color: INK, alpha: tk });
      setFont(g, { family: 'cond', weight: 900, size: 44, spacing: 1 });
      text(g, '(2014 –)', X + g.measureText('BMW M3 (F80)').width + 14, RY + 50, { family: 'body', weight: 400, size: 26, color: MUTED, alpha: tk });
      const rows = [['Czynnik chłodniczy', 'R134a', true], ['Ilość czynnika', '550 g', false], ['Typ oleju', 'PAG ISO 46', false]];
      rows.forEach(([a, b, acc], i) => {
        const k = eOutExpo(seg(t, bt(KE.rows[i]), bt(KE.rows[i] + 0.4)));
        const y = RY + 104 + i * 52;
        g.fillStyle = '#1f1a19'; g.fillRect(X, y + 20, 940 * k, 1.5);
        text(g, a, X, y, { family: 'body', weight: 500, size: 31, color: MUTED, alpha: k });
        text(g, b, X + 940 + 20 * (1 - k), y + 3, { family: 'cond', weight: 900, size: acc ? 48 : 40, italic: acc, color: acc ? RED_HI : INK, align: 'right', alpha: k });
      });
    }
    // ---- cena serwisu (price-highlight strony)
    const pk = seg(t, bt(KE.price), bt(KE.price + 0.45));
    if (pk > 0) {
      const e = eOutExpo(pk), y = RY + 104 + 3 * 52 + 22;
      label(g, 'Serwis w SSCAR', X, y, { size: 22, color: MUTED, alpha: e });
      const sc = 1 + 0.08 * pulse(t, bt(KE.price), 0.15);
      g.save();
      g.translate(X + 940, y + 8); g.scale(sc, sc);
      setFont(g, { family: 'cond', weight: 900, size: 64 });
      const w2 = g.measureText('425 zł').width;
      text(g, '425 zł', 0, 0, { family: 'cond', weight: 900, size: 64, color: INK, align: 'right', alpha: e });
      text(g, 'do', -w2 - 14, 0, { family: 'body', weight: 500, size: 28, color: MUTED, align: 'right', alpha: e });
      setFont(g, { family: 'body', weight: 500, size: 28 });
      const w3 = g.measureText('do').width;
      text(g, '150 zł', -w2 - 28 - w3, 0, { family: 'cond', weight: 900, size: 64, color: INK, align: 'right', alpha: e });
      setFont(g, { family: 'cond', weight: 900, size: 64 });
      const w4 = g.measureText('150 zł').width;
      text(g, 'od', -w2 - 42 - w3 - w4, 0, { family: 'body', weight: 500, size: 28, color: MUTED, align: 'right', alpha: e });
      g.restore();
    }
    g.restore();
    SELECTS.forEach((s, i) => tap(g, 820 + sx, Y0 + i * 112 + 50, t, bt(KE.sel[i])));
  },
};
