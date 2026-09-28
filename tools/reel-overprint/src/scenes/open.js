// B0–B12: logo drukuje się trzema płytami na arkuszu → arkusz staje się areną → krople spadają → ULT na B4
// → fale bez końca, kamera odjeżdża, licznik fal.
import { W, H, bt, seg, clamp, lerp, keys, eOutExpo, eInCubic, eOutCubic, eInOutCubic, eOutBack, pulse, INK_K, BLACK } from '../core.js';
import { RIG, paper, cropMarks, regMark, cmykBar, logo, label, sticker, printText } from '../common.js';
import { OPEN } from '../shots.js';

const WAVES = [[8, '01'], [8.5, '05'], [9, '12'], [9.5, '19'], [10, '27'], [10.5, '38'], [11, '52'], [11.5, '99+']];

export default {
  b0: 0, b1: 12,
  frame(S, L) {
    const B = S.B, t = S.t, fx = S.fx;
    const rig = RIG.main;
    // ---------------------------------------------------------------- gra (od B2.6)
    if (B >= 2.6) {
      rig.seek(OPEN, t);
      rig.draw(L.game.g, 0, 0, W, H);
      S.shake = rig.shake;
    }
    // ---------------------------------------------------------------- arkusz z logo (B0–B3.6)
    if (B < 3.7) {
      const g = L.mid.g;
      const land = eOutExpo(seg(B, 0, .35));
      const fade = eInCubic(seg(B, 2.9, 3.6));
      const push = 1 + B * .018;                          // powolny najazd
      g.save();
      g.globalAlpha = 1 - fade;
      g.translate(W / 2, H / 2); g.scale(push * lerp(1.18, 1, land), push * lerp(1.18, 1, land)); g.translate(-W / 2, -H / 2);
      paper(g, B * 6, B * 14);
      cropMarks(g, 60, 80, '#111', seg(B, 1.4, 1.6));
      regMark(g, W / 2, 128, 16, '#111', seg(B, 1.45, 1.65));
      regMark(g, W / 2, H - 128, 16, '#111', seg(B, 1.5, 1.7));
      // trzy płyty wjeżdżają z trzech stron i łapią rejestr
      const ly = 760 - eInCubic(seg(B, 3.1, 3.7)) * 260;
      const plates = [0, .5, 1].map(b0 => seg(B, b0, b0 + .3));
      const kReg = Math.min(...plates.map(eOutExpo));
      logo(g, 'OVERPRINT', W / 2, ly, 176, { k: .15 + .85 * kReg, alpha: plates.map(p => p > 0 ? 1 : 0), drift: seg(B, 1.3, 3) * .6 });
      label(g, 'Arkusz Nº 001', 118, ly + 150, { size: 30, color: '#222', alpha: seg(B, 1.5, 1.7) });
      cmykBar(g, W - 118 - 4 * 34 * 1.18, ly + 124, 34, seg(B, 1.5, 1.75));
      g.restore();
      // naklejki
      const f = L.front.g;
      f.save(); f.globalAlpha = 1 - fade; f.translate(0, -eInCubic(seg(B, 3.1, 3.7)) * 420);
      sticker(f, ['DARMOWA GRA'], W / 2 - 40, 1060, { size: 98, k: eOutExpo(seg(B, 2, 2.22)), rot: -.035, mis: 3 });
      sticker(f, ['W PRZEGLĄDARCE'], W / 2 + 30, 1225, { size: 98, k: eOutExpo(seg(B, 2.5, 2.72)), rot: .025, mis: 3 });
      f.restore();
      // czerń przed pierwszym uderzeniem
      if (B < .04) S.fx.fade = 1;
    }
    // ---------------------------------------------------------------- B4: ULT
    const ult = pulse(t, bt(4), .16);
    fx.flash += ult * .25;
    fx.mis += ult * 10;
    fx.zoom *= 1 + ult * .05;

    // ---------------------------------------------------------------- B4.5–B7.6: "KLEKSY SPADAJĄ / BEZ KOŃCA."
    if (B >= 4.4 && B < 8.2) {
      const g = L.front.g;
      const out = eInCubic(seg(B, 7.5, 8));
      g.save(); g.translate(0, -out * 700);
      sticker(g, ['KLEKSY SPADAJĄ'], W / 2 - 30, 400, { size: 96, k: eOutExpo(seg(B, 4.5, 4.72)), rot: -.03, mis: 3 });
      sticker(g, ['BEZ KOŃCA.'], W / 2 + 90, 560, { size: 120, k: eOutExpo(seg(B, 6, 6.22)), rot: .03, mis: 4, fill: INK_K, color: '#f1ede4' });
      g.restore();
    }
    // ---------------------------------------------------------------- B8–B12: licznik fal
    if (B >= 7.9) {
      const g = L.front.g;
      let cur = null, i0 = 0;
      WAVES.forEach(([b, s], i) => { if (B >= b) { cur = s; i0 = i; } });
      const k = eOutExpo(seg(B, 8, 8.25));
      const hit = cur ? eOutExpo(seg(B, WAVES[i0][0], WAVES[i0][0] + .2)) : 0;
      const out = eInCubic(seg(B, 11.75, 12));
      g.save();
      g.globalAlpha = 1 - out;
      g.translate(W / 2, 470); g.rotate(-.02); g.scale(1 + out * .4, 1 + out * .4);
      // kartka licznika
      const w = 640, h = 380;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-w / 2 + 14, -h / 2 + 16, w, h * k);
      g.fillStyle = '#f1ede4'; g.fillRect(-w / 2, -h / 2, w, h * k);
      if (k > .6) {
        label(g, 'Fala', -w / 2 + 40, -h / 2 + 70, { size: 34, color: '#333' });
        cmykBar(g, w / 2 - 40 - 4 * 24 * 1.18, -h / 2 + 46, 24);
        if (cur) printText(g, cur, -w / 2 + 34, h / 2 - 48, 250 * (1 + (1 - hit) * .12), { mis: 3 + (1 - hit) * 14, spacing: -.04 });
      }
      g.restore();
      // podpis pod licznikiem
      if (B >= 10) sticker(g, ['ILE WYTRZYMASZ?'], W / 2 + 40, 760 - out * 600, { size: 70, k: eOutExpo(seg(B, 10, 10.22)), rot: .03, mis: 2, fill: INK_K, color: '#f1ede4', alpha: 1 - out });
    }
  },
};
