// S2 — nagłówek strony (B14–B22.5): "CREATIVE / DESIGNER" z glitchem w farbach CMY (jak .hero-title strony),
// podtytuł "WEB DESIGN / BRANDING / ART DIRECTION"; na B21.8 strona "przewija się" w górę do prac.
import { W, BEAT, bt, C, M, Y, WHITE, GREY, clamp, lerp, seg, rad, pulse, decay, hash, eOutExpo, eInExpo, eOutBack, scramble, text, fitSize, setFont } from '../core.js';
import { HERO } from './targets.js';

function title(g, str, x, y, size, t, t0, S) {
  const e = eOutExpo(seg(t, t0, t0 + 0.35));
  if (e <= 0) return;
  const sc = lerp(1.9, 1, e);
  // pasery rozjechane przy uderzeniu, potem glitch co jakiś czas (tylko nagłówek — jak na stronie)
  const gl = pulse(t, bt(17), 0.08) + pulse(t, bt(17.75), 0.06) + pulse(t, bt(19.5), 0.08) + pulse(t, bt(20.25), 0.05);
  const off = 26 * (1 - e) + 3 + 14 * gl;
  g.save();
  g.translate(x, y); g.scale(sc, sc);
  g.globalAlpha = Math.min(1, e * 2);
  const o = { weight: 700, size, align: 'center', spacing: -size * 0.02 };
  g.globalCompositeOperation = 'lighter';
  text(g, str, -off, -off * 0.6, { ...o, color: C, alpha: 0.8 });
  text(g, str, off, off * 0.6, { ...o, color: M, alpha: 0.8 });
  g.globalCompositeOperation = 'source-over';
  if (gl > 0.05) {
    // przesunięte paski jak clip-path w glitch-anim strony
    for (let i = 0; i < 3; i++) {
      const hy = -size * 0.8 + hash(i, Math.floor(t * 30)) * size * 0.9, hh = 10 + 30 * hash(i + 5, Math.floor(t * 30));
      g.save(); g.beginPath(); g.rect(-W, hy, 2 * W, hh); g.clip();
      text(g, str, (hash(i + 9, Math.floor(t * 30)) - 0.5) * 60 * gl, 0, { ...o, color: WHITE });
      g.restore();
    }
  }
  text(g, str, 0, 0, { ...o, color: WHITE });
  g.restore();
}

export default {
  name: 'hero', b0: 14, b1: 22.8,
  frame(S, L) {
    const { t, B, fx } = S;
    const g = L.back.g;
    // wyjście: przewinięcie w górę (szybki zjazd strony)
    const out = eInExpo(seg(t, bt(21.5), bt(22.15)));
    const dy = -1900 * out;
    g.save();
    g.translate(0, dy);
    const size = HERO.size;
    title(g, 'CREATIVE', HERO.x, HERO.y1, size, t, bt(14.5), S);
    title(g, 'DESIGNER', HERO.x, HERO.y2, size, t, bt(15), S);
    // podtytuł: litery przewijają się jak w terminalu
    const sub = scramble('WEB DESIGN / BRANDING / ART DIRECTION', t, bt(15.5), 0.55, 3);
    text(g, sub, HERO.x, HERO.sub, { weight: 500, size: 30, align: 'center', spacing: 5, color: GREY });
    // cienka linia pod nagłówkiem, rysowana od środka
    const ul = eOutExpo(seg(t, bt(15.25), bt(15.8)));
    g.fillStyle = C; g.globalAlpha = 0.9;
    g.fillRect(HERO.x - 160 * ul, HERO.sub + 44, 320 * ul, 4);
    g.globalAlpha = 1;
    g.restore();
    // kamera: uderzenia napisów
    fx.zoom *= 1 + 0.03 * pulse(t, bt(14.5), 0.12) + 0.03 * pulse(t, bt(15), 0.12);
    fx.glitch += 0.5 * (pulse(t, bt(17), 0.06) + pulse(t, bt(19.5), 0.06));
    fx.glitchSeed = Math.floor(t * 30);
    fx.shakeY += 60 * Math.sin(out * Math.PI) * 0;   // (miejsce na dodatkowy wstrząs przy przewinięciu)
  },
};
