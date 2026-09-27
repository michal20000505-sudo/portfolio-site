// S5 — zakończenie (B38–B46): logo "MJ." (kropka w cyjanie jak na stronie) spada literami na beaty,
// kropka pojawia się w chwili złożenia oka; pod logo przycisk m-jaro.pl w stylu strony (obrys cyjan).
import { W, BEAT, bt, C, M, Y, WHITE, GREY, clamp, lerp, seg, TAU, pulse, decay, eOutExpo, eOutBack, eInCubic, text, setFont, rrect, scramble } from '../core.js';
import { shock } from '../common.js';

const LOGO_Y = 400, LOGO_S = 250;

export default {
  name: 'outro', b0: 38, b1: 46.5,
  frame(S, L) {
    const { t, B, fx } = S;
    const g = L.front.g, add = L.add.g;
    setFont(g, 700, LOGO_S, -LOGO_S * 0.04);
    const wM = g.measureText('M').width, wJ = g.measureText('J').width, wD = g.measureText('.').width;
    const total = wM + wJ + wD;
    const x0 = W / 2 - total / 2;
    const glyphs = [['M', x0, 38.5, WHITE], ['J', x0 + wM, 39.0, WHITE], ['.', x0 + wM + wJ, 39.5, C]];
    for (const [ch, x, b, col] of glyphs) {
      const tb = bt(b);
      const e = seg(t, tb - 0.22, tb);
      if (e <= 0) continue;
      const y = LOGO_Y - 700 * (1 - e * e);
      const sq = t >= tb ? 1 - 0.12 * Math.exp(-(t - tb) * 12) * Math.cos((t - tb) * 40) : 1;
      g.save();
      g.translate(x, y); g.scale(2 - sq, sq);
      // pasery przy uderzeniu
      const off = 16 * decay(t, tb, 0.12);
      if (off > 0.5) {
        g.globalCompositeOperation = 'lighter';
        text(g, ch, -off, 0, { weight: 700, size: LOGO_S, spacing: -LOGO_S * 0.04, color: C, alpha: 0.8 });
        text(g, ch, off, 0, { weight: 700, size: LOGO_S, spacing: -LOGO_S * 0.04, color: M, alpha: 0.8 });
        g.globalCompositeOperation = 'source-over';
      }
      text(g, ch, 0, 0, { weight: 700, size: LOGO_S, spacing: -LOGO_S * 0.04, color: col });
      g.restore();
      shock(add, t, tb, x + (ch === '.' ? wD / 2 : 60), LOGO_Y, 420, 0.45, 7, ch === '.' ? [C, C, C] : [C, M, Y]);
      fx.zoom *= 1 + 0.02 * pulse(t, tb, 0.1);
      fx.shakeY += 18 * decay(t, tb, 0.08) * Math.sin(t * 80);
    }
    // przycisk m-jaro.pl (obrys cyjan, jak button-primary strony) — wypełnia się cyjanem na B42
    const pb = bt(40.5), e = eOutBack(seg(t, pb, pb + 0.35), 1.6);
    if (e > 0) {
      const bw = 420, bh = 92, bx = W / 2 - bw / 2, by = 470;
      const fill = eOutExpo(seg(t, bt(42), bt(42) + 0.3)) * (1 - seg(t, bt(43.6), bt(44.2)));
      g.save();
      g.translate(W / 2, by + bh / 2); g.scale(e, e); g.translate(-W / 2, -(by + bh / 2));
      rrect(g, bx, by, bw, bh, 33);
      g.fillStyle = `rgba(0,255,255,${fill})`; g.fill();
      g.strokeStyle = C; g.lineWidth = 3; g.stroke();
      text(g, scramble('M-JARO.PL', t, pb, 0.35, 11), W / 2, by + bh / 2 + 15, { weight: 500, size: 42, spacing: 5, align: 'center', color: fill > 0.5 ? '#050505' : C });
      g.restore();
      if (fill > 0) {
        add.save(); add.globalCompositeOperation = 'lighter';
        const gr = add.createRadialGradient(W / 2, by + bh / 2 + 30, 0, W / 2, by + bh / 2 + 30, 320);
        gr.addColorStop(0, `rgba(0,255,255,${0.25 * fill})`); gr.addColorStop(1, 'rgba(0,255,255,0)');
        add.fillStyle = gr; add.fillRect(W / 2 - 320, by - 280, 640, 700);
        add.restore();
      }
    }
  },
};
