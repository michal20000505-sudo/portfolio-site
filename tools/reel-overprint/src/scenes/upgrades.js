// B40–B44: nowy poziom → trzy karty (zrzuty z gry) → wybór → sklep między falami (oferty z gry) → zakup.
import { W, H, bt, seg, raw, clamp, lerp, eOutExpo, eInCubic, eOutBack, eInOutCubic, text, INK_K, PAPER, CYAN, WHITE, MUTED, BLACK } from '../core.js';
import { RIG, IMG, sticker, label, tap } from '../common.js';
import { CALM } from '../shots.js';

export default {
  b0: 40, b1: 44,
  frame(S, L) {
    const B = S.B, t = S.t;
    // tło: gra zwolniona i przygaszona (jak ekran wyboru w grze)
    const rig = RIG.main;
    rig.seek(CALM, (t - bt(40)) * .25);
    rig.draw(L.game.g, 0, 0, W, H);
    const m = L.mid.g;
    m.fillStyle = 'rgba(5,5,5,.72)'; m.fillRect(0, 0, W, H);
    S.fx.vignette = 1;

    const g = L.front.g;
    const out = eInCubic(seg(B, 43.7, 44));
    // ---------------------------------------------------------------- karty poziomu (B40–B42)
    const cardsOut = eInCubic(seg(B, 41.8, 42));
    if (B < 42.2) {
      const k0 = eOutExpo(seg(B, 40, 40.3));
      label(g, 'Nowy poziom · wybierz jedną kartę', 80, 560 - (1 - k0) * 40, { size: 28, color: MUTED, alpha: k0 * (1 - cardsOut) });
      text(g, 'Poziom 7', 76, 670 - (1 - k0) * 40, { size: 104, weight: 700, color: WHITE, alpha: k0 * (1 - cardsOut), spacing: -2 });
      // wachlarz trzech kart (jak karty w dłoni), obrót wokół punktu pod kadrem
      const cw = 430, ch = cw * 472 / 500, PX = W / 2, PY = 2350, RAD = 1250;
      const pick = eOutExpo(seg(B, 41.5, 41.8));
      for (let i = 2; i >= 0; i--) {
        const k = eOutBack(seg(B, 40.15 + i * .25, 40.5 + i * .25), 1.2);
        if (k <= 0) continue;
        let ang = (i - 1) * .27 * k, r = RAD, s = 1, a = 1, lift = 0;
        if (i === 0) { ang = lerp(ang, 0, pick); lift = 120 * pick; s = 1 + .22 * pick; }
        else { r -= pick * 900; a = 1 - pick; }
        a *= 1 - cardsOut;
        if (a <= 0) continue;
        g.save();
        g.globalAlpha = a;
        g.translate(PX, PY); g.rotate(ang); g.translate(0, -r - lift + (1 - k) * 500);
        g.scale(s, s);
        g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-cw / 2 + 14, -ch / 2 + 18, cw, ch);
        g.drawImage(IMG[`card_${i}`], -cw / 2, -ch / 2, cw, ch);
        if (i === 0 && pick > 0) {
          g.lineWidth = 6; g.strokeStyle = CYAN; g.globalAlpha = a * pick;
          g.strokeRect(-cw / 2 - 8, -ch / 2 - 8, cw + 16, ch + 16);
        }
        g.restore();
      }
      const c0 = { x: PX, y: PY - RAD - 120 };
      tap(g, c0.x + 20, c0.y + 40, raw(B, 41.4, 41.9), CYAN);
    }
    // ---------------------------------------------------------------- sklep (B42–B44)
    if (B >= 41.9) {
      const k0 = eOutExpo(seg(B, 42, 42.3));
      g.save(); g.translate(0, -out * 300); g.globalAlpha = 1 - out;
      label(g, 'Fala 7 zaliczona', 80, 560 - (1 - k0) * 40, { size: 28, color: MUTED, alpha: k0 });
      text(g, 'Przerwa w druku', 76, 670 - (1 - k0) * 40, { size: 96, weight: 700, color: WHITE, alpha: k0, spacing: -2 });
      // oferty 2 × 2 jak w sklepie gry
      const ow = 460, gap = 20, x0 = (W - 2 * ow - gap) / 2;
      for (let i = 0; i < 4; i++) {
        const im = IMG[`offer_${i}`];
        const oh = ow * 278 / 542;
        const x = x0 + (i % 2) * (ow + gap), y = 750 + Math.floor(i / 2) * (oh + gap);
        const k = eOutExpo(seg(B, 42.15 + i * .18, 42.45 + i * .18));
        if (k <= 0) continue;
        g.save();
        g.globalAlpha *= clamp(k * 2);
        g.translate(x + (1 - k) * 400, y);
        g.drawImage(im, 0, 0, ow, ow * im.height / im.width);
        // zakup pierwszej oferty
        const buy = eOutBack(seg(B, 43.25, 43.45), 2);
        if (i === 0 && buy > 0) {
          g.translate(ow - 130, oh / 2 + 20); g.rotate(-.12); g.scale(buy, buy);
          g.fillStyle = 'rgba(13,13,15,.85)'; g.fillRect(-120, -40, 240, 80);
          g.lineWidth = 5; g.strokeStyle = CYAN; g.strokeRect(-120, -40, 240, 80);
          text(g, 'KUPIONE', 0, 3, { size: 44, weight: 700, color: CYAN, align: 'center', baseline: 'middle', spacing: 3 });
        }
        g.restore();
      }
      tap(g, x0 + ow * .5, 750 + 110, raw(B, 43.1, 43.6), CYAN);
      g.restore();
    }
    // ---------------------------------------------------------------- naklejki
    sticker(g, ['34 ULEPSZENIA'], W / 2 - 60, 300 - out * 500, { size: 100, k: eOutExpo(seg(B, 40, 40.25)), rot: -.03, mis: 3 });
    sticker(g, ['+ SKLEP CO FALĘ'], W / 2 + 150, 1420 + out * 700, { size: 64, k: eOutExpo(seg(B, 42, 42.25)), rot: .03, mis: 2, fill: INK_K, color: PAPER });
  },
};
