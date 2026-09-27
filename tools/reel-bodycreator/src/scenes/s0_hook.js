// S0 — HOOK (B0–B2): zdjęcie studia odsłonięte ukośnym cięciem (kąt skrzydeł z logo), "TWOJE MIEJSCE" z maski,
// litery "TRENINGU" spadają jak talerze na 32-kach. Od B1.55 kamera odjeżdża: cały kadr okazuje się ekranem telefonu,
// a napis zmniejsza się i ląduje dokładnie na nagłówku strony (pozycje z capture.js).
import {
  W, H, CX, CY, BEAT, S16, bt, GOLD, GOLD_HI, ICE, OBSIDIAN, clamp, lerp, seg,
  eOutExpo, eInExpo, eOutCubic, eInOutCubic, decay, pulse, drop, text, fitSize, measure, setFont, drawCover, rrect,
} from '../core.js';
import { IMG, META, goldLabel, dust, makeBurst, drawBurst, slashPath, SLASH } from '../common.js';
import { PH, PULL0, PULL1, S_FULL, screenRect } from '../phone.js';

const L1 = 'TWOJE MIEJSCE', L2 = 'TRENINGU';
const X0 = 80, LABEL_Y = 1088, Y1 = 1212, Y2 = 1378, MAXW = 920;
const DROP_B = 0.375, DROP_STEP = 1 / 8, FALL = 0.09;  // litery: lądowanie pierwszej (beat), odstęp (32-ka), czas spadania (s)
let lay = null;
const PUFFS = Array.from({ length: 8 }, (_, i) => makeBurst(100 + i, 9, 520, [0.22, 0.5], [-2.9, -0.25]));

// układ napisu: w px kadru na starcie (ekran = cały kadr) i na stronie (CSS) — oba w układzie ekranu telefonu
function layout(g) {
  const k0 = PH.K * S_FULL;
  const r0 = { y: CY - PH.SH * S_FULL / 2 };
  const toCss = (x, y) => [x / k0, (y - r0.y) / k0 - PH.SB];
  const em = 2 / 27.3;                                  // odstęp liter z CSS strony (2px przy 27.3px)
  const s1 = fitSize(g, L1, 900, MAXW, 140, em), s2 = fitSize(g, L2, 900, MAXW, 200, em);
  const ht = META.site.heroTitle;
  const asc = 0.96875;                                  // wznoszenie Inter (1984/2048): góra pola tekstu → linia bazowa
  return {
    em,
    a1: { p: toCss(X0, Y1), size: s1 / k0 }, a2: { p: toCss(X0, Y2), size: s2 / k0 },
    b1: { p: [ht.line1.x, ht.line1.y + ht.fontSize * asc], size: ht.fontSize },
    b2: { p: [ht.line2.x, ht.line2.y + ht.fontSize * asc], size: ht.fontSize },
  };
}

export default {
  name: 'hook', b0: 0, b1: 2.12, pre: 0, post: 0,
  async load() {},
  frame(S, Ls) {
    const { t, B, tr } = S, fx = S.fx;
    const g = Ls.front.g, add = Ls.add.g;
    if (!lay) lay = layout(g);
    const r = screenRect(Math.min(B, PULL1), tr);
    const k = PH.K * r.s;
    const css = (x, y) => [r.x + x * k, r.y + (PH.SB + y) * k];
    const u = eInOutCubic(seg(B, PULL0, PULL1 - 0.12));   // napis dolatuje przed lądowaniem telefonu, potem jedzie z ekranem
    const photoA = 1 - eInOutCubic(seg(B, 1.6, 1.84));
    // ------------------------------------------------ zdjęcie studia (w obrysie ekranu)
    if (photoA > 0) {
      g.save();
      rrect(g, r.x, r.y, r.w, r.h, (PH.R - PH.BEZ) * r.s);
      g.clip();
      g.globalAlpha = photoA;
      const vy = r.y + PH.SB * k, vh = r.h - PH.SB * k;
      g.fillStyle = OBSIDIAN; g.fillRect(r.x, r.y, r.w, r.h);
      g.filter = 'brightness(0.9) saturate(1.05) contrast(1.06)';
      drawCover(g, IMG.studio, r.x, vy, r.w, vh, 0.17, 0.42, 1.0 + 0.07 * eOutCubic(seg(t, 0, bt(PULL1))));
      g.filter = 'none';
      // przyciemnienie pod napisem i u góry (czytelność, spokój — "The Iron Sanctuary")
      const gr = g.createLinearGradient(0, r.y + (PH.SB + 280) * k, 0, r.y + (PH.SB + 560) * k);
      gr.addColorStop(0, 'rgba(10,10,10,0)'); gr.addColorStop(0.55, 'rgba(10,10,10,0.78)'); gr.addColorStop(1, 'rgba(10,10,10,0.92)');
      g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
      const gt = g.createLinearGradient(0, r.y, 0, r.y + (PH.SB + 160) * k);
      gt.addColorStop(0, 'rgba(10,10,10,0.75)'); gt.addColorStop(1, 'rgba(10,10,10,0)');
      g.fillStyle = gt; g.fillRect(r.x, r.y, r.w, r.h);
      // odsłonięcie ukośnym cięciem: na klatce 0 zdjęcie jest już w ~40% odsłonięte (pierwsza klatka to też miniatura),
      // czarne pole po prawej od krawędzi + szeroki złoty pas z miękkim śladem (bez stroboskopu przy motion blur)
      const rv = eOutCubic(seg(t, -0.07, 0.2));
      if (rv < 1) {
        const e = lerp(-420, W + 900, rv);
        g.globalAlpha = 1;
        g.fillStyle = OBSIDIAN;
        g.beginPath();
        g.moveTo(e - H / 2 * SLASH, 0); g.lineTo(W + 2000, 0); g.lineTo(W + 2000, H); g.lineTo(e + H / 2 * SLASH, H);
        g.closePath(); g.fill();
        const k = H / 2 * SLASH;
        const trail = g.createLinearGradient(e - 260, 0, e, 0);
        trail.addColorStop(0, 'rgba(245,202,0,0)'); trail.addColorStop(1, 'rgba(245,202,0,0.55)');
        g.fillStyle = trail;
        g.save(); g.transform(1, 0, SLASH, 1, -SLASH * H / 2, 0); g.fillRect(e - 260, 0, 260, H); g.restore();
        g.fillStyle = GOLD;
        slashPath(g, e, 96); g.fill();
        g.fillStyle = GOLD_HI;
        g.globalAlpha = 0.7;
        slashPath(g, e - 34, 30); g.fill();
        g.globalAlpha = 1;
      }
      g.restore();
    }
    // ------------------------------------------------ napisy
    const out = seg(B, 2.0, 2.09);                       // oddanie napisu zrzutowi strony pod spodem
    const lineAt = (a, b) => {
      const p = [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u)];
      const size = lerp(a.size, b.size, u);
      const [x, y] = css(p[0], p[1]);
      return { x, y, size: size * k, sp: size * k * lay.em };
    };
    const A1 = lineAt(lay.a1, lay.b1), A2 = lineAt(lay.a2, lay.b2);
    if (out < 1) {
      // etykieta
      const la = seg(t, bt(0.15), bt(0.55)) * (1 - seg(B, PULL0, PULL0 + 0.15));
      if (la > 0) {
        const [lx, ly] = css(lay.a1.p[0], lay.a1.p[1] - (Y1 - LABEL_Y) / (PH.K * S_FULL));
        goldLabel(g, 'STUDIO TRENINGU PERSONALNEGO', lx, ly, { size: 26 * r.s / S_FULL, reveal: la, lines: false, align: 'left' });
      }
      // "TWOJE MIEJSCE" — słowa z maski od dołu
      const alpha = 1 - out;
      const words = L1.split(' ');
      setFont(g, 900, A1.size, A1.sp);
      let wx0 = A1.x;
      words.forEach((w, i) => {
        const ti = 0.02 + i * 0.09;
        const e = eOutExpo(seg(t, ti, ti + 0.42));
        g.save();
        g.beginPath(); g.rect(0, A1.y - A1.size * 0.95, W, A1.size * 1.2); g.clip();
        text(g, w, wx0, A1.y + (1 - e) * A1.size * 1.1, { weight: 900, size: A1.size, spacing: A1.sp, color: ICE, alpha });
        g.restore();
        setFont(g, 900, A1.size, A1.sp);
        wx0 += g.measureText(w + ' ').width;
      });
      // "TRENINGU" — litery wpadają z maski (spod pierwszej linii) i lądują jak talerze
      setFont(g, 900, A2.size, A2.sp);
      let px = A2.x;
      const capTop = A2.y - A2.size * 0.76;
      g.save();
      g.beginPath(); g.rect(0, capTop - 4, W, A2.size * 1.2); g.clip();
      for (let i = 0; i < L2.length; i++) {
        const ch = L2[i];
        const ti = bt(DROP_B + i * DROP_STEP) - FALL;      // start spadania; lądowanie dokładnie na 32-ce
        const x = (t - ti) / FALL;
        const cw = (setFont(g, 900, A2.size, A2.sp), g.measureText(ch).width);
        if (x > 0) {
          const y = A2.y - (1 - drop(x)) * A2.size * 0.8;
          text(g, ch, px, y, { weight: 900, size: A2.size, spacing: A2.sp, color: GOLD, alpha });
        }
        px += cw;
      }
      g.restore();
      px = A2.x;
      for (let i = 0; i < L2.length; i++) {
        const cw = (setFont(g, 900, A2.size, A2.sp), g.measureText(L2[i]).width);
        drawBurst(add, PUFFS[i], t, bt(DROP_B + i * DROP_STEP), px + cw * 0.45, A2.y + 4, { r0: 6, grav: 900, drag: 7 });
        px += cw;
      }
      // przebłysk światła po napisie (B1.3–B1.62)
      const sw = seg(t, bt(1.3), bt(1.58));
      if (sw > 0 && sw < 1) {
        const bx = lerp(-300, W + 300, eInOutCubic(sw));
        for (const [L, A, col] of [[L1, A1, ICE], [L2, A2, GOLD]]) {
          const grd = g.createLinearGradient(bx - 160, A.y - A.size, bx + 160, A.y);
          grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,248,220,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
          text(g, L, A.x, A.y, { weight: 900, size: A.size, spacing: A.sp, color: grd, alpha: 0.85 });
        }
      }
    }
    dust(add, tr, 0.7 * (1 - seg(B, PULL0, PULL1)));
    // ------------------------------------------------ kamera: uderzenie na B0, drobne tąpnięcia przy lądowaniu liter
    fx.shakeY += 24 * decay(t, 0, 0.06) * Math.sin(t * 90);
    fx.zoom *= 1 + 0.035 * pulse(t, 0, 0.14);
    fx.flash += 0.14 * pulse(t, 0.0, 0.07);
    fx.flashCol = [1, 0.94, 0.8];
    for (let i = 0; i < L2.length; i++) fx.shakeY += 3.5 * decay(t, bt(DROP_B + i * DROP_STEP), 0.03);
    fx.aberr += 4 * pulse(t, 0, 0.08);
  },
};
