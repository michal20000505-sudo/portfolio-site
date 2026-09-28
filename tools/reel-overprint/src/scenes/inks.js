// B24–B31: trzy soczewki z grą (C chłód, M ogień, Y pioruny) → zlewają się w farbę i nachodzą na siebie jak
// w druku: C+M = próżnia, M+Y = wybuch, C+Y = toksyna, środek = K → czerń zalewa kadr → B31 ULT.
import { W, H, bt, seg, clamp, lerp, keys, eOutExpo, eInExpo, eInOutCubic, eOutBack, eInCubic, pulse, TAU, text, INK_C, INK_M, INK_Y, INK_K, PAPER, INK_BLUE, INK_RED, INK_GREEN } from '../core.js';
import { RIG, paper, sticker, label, printText, cropMarks } from '../common.js';
import { INK_SHOTS, ULT } from '../shots.js';

const B0 = 24;
const R = 285;
const LENS = [
  { key: 'c', ink: INK_C, name: 'CHŁÓD', sub: 'Cyan', b: 24, p0: [300, 790], p1: [540 - 134, 960 - 78] },
  { key: 'm', ink: INK_M, name: 'OGIEŃ', sub: 'Magenta', b: 24.5, p0: [780, 880], p1: [540 + 134, 960 - 78] },
  { key: 'y', ink: INK_Y, name: 'PIORUNY', sub: 'Yellow', b: 25, p0: [470, 1290], p1: [540, 960 + 156] },
];
const MIX = [
  { name: 'PRÓŻNIA', sub: 'C + M', col: INK_BLUE, b: 27.5, at: [540, 810] },
  { name: 'WYBUCH', sub: 'M + Y', col: INK_RED, b: 28, at: [670, 1036] },
  { name: 'TOKSYNA', sub: 'C + Y', col: INK_GREEN, b: 28.5, at: [410, 1036] },
];

export default {
  b0: B0, b1: 32,
  frame(S, L) {
    const B = S.B, t = S.t;
    // ---------------------------------------------------------------- B31: ULT (gra na pełnym kadrze)
    if (B >= 31) {
      const rig = RIG.main;
      rig.seek(ULT, t - bt(31));
      rig.draw(L.game.g, 0, 0, W, H);
      S.shake = rig.shake;
      const u = pulse(t, bt(31), .2);
      S.fx.flash += u * .3;
      sticker(L.front.g, ['C + M + Y = K'], W / 2, 420, { size: 96, k: eOutExpo(seg(B, 31.05, 31.3)), rot: -.03, mis: 4, fill: INK_K, color: PAPER });
      sticker(L.front.g, ['SUPERCIOS „OVERPRINT”'], W / 2 + 30, 560, { size: 54, k: eOutExpo(seg(B, 31.3, 31.5)), rot: .03, mis: 2 });
      return;
    }
    const g = L.back.g;
    paper(g, 0, -B * 20);
    cropMarks(g, 60, 80, '#111', 1);
    const merge = eInOutCubic(seg(B, 26.8, 27.6));      // soczewki → krążki farby
    const fillK = eOutExpo(seg(B, 26.9, 27.4));
    const flood = eInExpo(seg(B, 29.6, 31));            // czerń z środka zalewa kadr

    const m = L.mid.g;
    for (const [i, s] of LENS.entries()) {
      const k = eOutBack(seg(B, s.b, s.b + .3), 1.3);
      if (k <= 0) continue;
      const [x, y] = [lerp(s.p0[0], s.p1[0], merge), lerp(s.p0[1], s.p1[1], merge)];
      const r = R * k * (1 - .06 * merge);
      // gra w soczewce
      if (fillK < 1) {
        const rig = RIG[s.key];
        rig.seek(INK_SHOTS[s.key], t - bt(s.b) + .3);
        m.save();
        m.globalAlpha = 1 - fillK;
        m.beginPath(); m.arc(x, y, r, 0, TAU); m.clip();
        rig.draw(m, x - 360, y - 360, 720, 720);
        m.restore();
        m.save(); m.globalAlpha = 1 - fillK;
        m.lineWidth = 14; m.strokeStyle = s.ink;
        m.beginPath(); m.arc(x, y, r, 0, TAU); m.stroke();
        m.restore();
        // podpis soczewki
        const kl = eOutExpo(seg(B, s.b + .15, s.b + .4)) * (1 - merge);
        if (kl > 0) sticker(L.front.g, [s.name], x + (i === 1 ? 40 : -40), y + r + 20, { size: 64, k: kl, rot: i % 2 ? .03 : -.03, mis: 2, sub: s.sub + ' · ' + ['spowalnia i zamraża', 'podpala', 'razi piorunem'][i] });
      }
      // krążek farby (multiply: nachodzące farby mieszają się jak w druku)
      if (fillK > 0) {
        const f = L.front.g;
        f.save();
        f.globalCompositeOperation = 'multiply';
        f.globalAlpha = fillK;
        f.fillStyle = s.ink;
        f.beginPath(); f.arc(x, y, r, 0, TAU); f.fill();
        f.restore();
      }
    }
    const f = L.front.g;
    // podpisy mieszanin
    for (const mx of MIX) {
      const k = eOutExpo(seg(B, mx.b, mx.b + .22));
      if (k <= 0) continue;
      f.save();
      f.globalAlpha = k * (1 - flood);
      f.translate(mx.at[0], mx.at[1]); f.scale(.8 + .2 * k, .8 + .2 * k);
      text(f, mx.name, 0, 0, { size: 42, weight: 700, color: PAPER, align: 'center', baseline: 'middle', spacing: -1 });
      label(f, mx.sub, 0, 38, { size: 22, color: PAPER, align: 'center' });
      f.restore();
    }
    // środek: K
    const kK = eOutBack(seg(B, 29, 29.25));
    if (kK > 0 && flood < .3) {
      f.save(); f.translate(540, 960); f.scale(kK, kK);
      text(f, 'K', 0, 8, { size: 120, weight: 700, color: PAPER, align: 'center', baseline: 'middle' });
      f.restore();
    }
    // nagłówek
    const out = eInCubic(seg(B, 29.5, 30));
    sticker(f, ['MIESZAJ TUSZE'], W / 2 - 60, 250 - out * 400, { size: 104, k: eOutExpo(seg(B, 24, 24.25)), rot: -.03, mis: 3, fill: INK_K, color: PAPER });
    sticker(f, ['C + M + Y = K'], W / 2, 1560, { size: 92, k: eOutExpo(seg(B, 29, 29.25)) * (1 - eInCubic(seg(B, 30.4, 30.8))), rot: .025, mis: 3 });
    // zalanie czernią
    if (flood > 0) {
      f.save();
      f.fillStyle = INK_K;
      f.beginPath(); f.arc(540, 960, 60 + flood * 1900, 0, TAU); f.fill();
      f.restore();
    }
  },
};
