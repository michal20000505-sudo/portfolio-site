// S1 — spis treści (B6–B10): "Twoja stacja online" i cztery wiersze w stylu .nav-index-item strony
// (numer | treść | strzałka), wchodzą na ósemkach; B9.5 tapnięcie w "Rezerwację online" → rozdział 01.
import { W, bt, RED, INK, MUTED, BORDER, clamp, lerp, seg, eOutExpo, eInExpo, eOutCubic, text } from '../core.js';
import { icon, label, rule, tap } from '../common.js';
import { CH, CHAPTERS } from '../director.js';
import { rise, slideX } from './world.js';

const ROW0 = 552, ROWH = 172;

export default {
  name: 'toc', b0: CH.toc - 0.4, b1: CH.booking + 0.3,
  frame(S, L) {
    const { t, B } = S;
    const g = L.front.g;
    const sx = slideX(B, CH.toc, CH.booking);
    g.save();
    g.translate(sx, 0);
    const k0 = seg(t, bt(CH.toc - 0.15), bt(CH.toc + 0.5));
    label(g, 'sscar.pl', 72, 330, { size: 26, color: RED, alpha: eOutExpo(k0) });
    rise(g, 'TWOJA STACJA ONLINE', 70, 428, { family: 'cond', weight: 900, size: 92, spacing: 92 * 0.02, color: INK, stagger: 0.4 }, seg(t, bt(CH.toc - 0.1), bt(CH.toc + 0.8)));
    rule(g, 72, 462, seg(t, bt(CH.toc + 0.3), bt(CH.toc + 1.1)));
    // wybór pierwszego wiersza (B9.0–B9.5): wcięcie jak :hover na stronie, reszta przygasa
    const pick = eOutCubic(seg(t, bt(9.25), bt(9.6)));
    CHAPTERS.forEach((ch, i) => {
      const b = CH.toc + 0.5 + i * 0.5;
      const k = seg(t, bt(b), bt(b + 0.6));
      if (k <= 0) return;
      const y = ROW0 + i * ROWH;
      const e = eOutExpo(k);
      const sel = i === 0 ? pick : 0, dim = i === 0 ? 1 : 1 - 0.55 * pick;
      g.save();
      g.globalAlpha = dim;
      g.fillStyle = BORDER;
      g.fillRect(70, y, 940 * e, 2);
      if (i === 3) g.fillRect(70, y + ROWH, 940 * eOutExpo(seg(t, bt(b + 0.2), bt(b + 0.8))), 2);
      if (sel > 0) {
        g.fillStyle = `rgba(189,0,1,${0.10 * sel})`;
        g.fillRect(70, y + 2, 940, ROWH - 2);
      }
      const ix = 24 * sel;
      g.translate(40 * (1 - e) + ix, 0);
      text(g, ch.n, 78, y + 80, { family: 'cond', weight: 900, size: 50, italic: true, color: RED, alpha: e });
      rise(g, ch.title.toUpperCase(), 176, y + 82, { family: 'cond', weight: 900, size: 60, spacing: 60 * 0.03, color: INK, stagger: 0.3 }, k);
      text(g, ch.toc, 178, y + 130, { family: 'body', weight: 400, size: 32, color: MUTED, alpha: eOutExpo(seg(t, bt(b + 0.15), bt(b + 0.75))) });
      icon(g, 'arrow', 972 + 10 * sel, y + 86, 36, RED, e);
      g.restore();
    });
    g.restore();
    tap(g, 760 + sx, ROW0 + 86, t, bt(9.5));
  },
};
