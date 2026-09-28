// B64–B72: gra trwa w tle, arkusz z logo wbija się na B64 (płyty C, M, Y na szesnastkach), "ZAGRAJ ZA DARMO",
// adres jak przycisk strony, MJ. i wyciemnienie na końcu.
import { W, H, bt, seg, raw, clamp, lerp, eOutExpo, eOutBack, eInCubic, pulse, text, rrect, measure, INK_K, INK_C, PAPER, CYAN, WHITE, BLACK, MUTED } from '../core.js';
import { RIG, logo, label, printText, cmykBar, regMark, tap, paper } from '../common.js';
import { FINALE } from '../shots.js';

export default {
  b0: 64, b1: 72,
  frame(S, L) {
    const B = S.B, t = S.t;
    const rig = RIG.main;
    rig.seek(FINALE, t - bt(62.1));
    rig.draw(L.game.g, 0, 0, W, H);
    S.shake = 0;                                       // finał spokojny: bez wstrząsu z gry
    // gra przygasa pod arkuszem
    const dim = eOutExpo(seg(B, 64, 64.4));
    const m = L.mid.g;
    m.fillStyle = `rgba(5,5,5,${.55 * dim})`; m.fillRect(0, 0, W, H);

    // ---------------------------------------------------------------- arkusz
    const g = L.front.g;
    const k = eOutExpo(seg(B, 64, 64.3));
    const push = 1 + (B - 64) * .008;
    const cw = 940, ch = 760, cx = W / 2, cy = 820;
    g.save();
    g.translate(cx, cy + (1 - k) * 900); g.rotate(-.025 * k - (1 - k) * .2); g.scale(push, push);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-cw / 2 + 18, -ch / 2 + 24, cw, ch);
    g.save();
    g.beginPath(); g.rect(-cw / 2, -ch / 2, cw, ch); g.clip();
    g.translate(-cw / 2, -ch / 2);
    paper(g, 0, 0);
    g.restore();
    // znaczniki
    regMark(g, 0, -ch / 2 + 44, 12, '#111', seg(B, 64.6, 64.8));
    const plates = [64.05, 64.25, 64.45].map(b => seg(B, b, b + .2));
    const kReg = Math.min(...plates.map(eOutExpo));
    logo(g, 'OVERPRINT', 0, -ch / 2 + 190, 168, { k: .1 + .9 * kReg, alpha: plates.map(p => p > 0 ? 1 : 0), drift: seg(B, 65, 72) * .4 });
    label(g, 'Arkusz Nº 001', -cw / 2 + 60, -ch / 2 + 320, { size: 26, color: '#222', alpha: seg(B, 64.7, 64.9) });
    cmykBar(g, cw / 2 - 60 - 4 * 28 * 1.18, -ch / 2 + 298, 28, seg(B, 64.7, 64.95));
    // hasło
    const k1 = eOutExpo(seg(B, 65, 65.25)), k2 = eOutExpo(seg(B, 65.5, 65.75));
    g.save(); g.globalAlpha = clamp(k1 * 2);
    printText(g, 'ZAGRAJ', -cw / 2 + 56, -ch / 2 + 480 + (1 - k1) * 40, 128, { mis: 3 + (1 - k1) * 16, spacing: -.03 });
    g.restore();
    g.save(); g.globalAlpha = clamp(k2 * 2);
    printText(g, 'ZA DARMO', -cw / 2 + 56, -ch / 2 + 610 + (1 - k2) * 40, 128, { mis: 3 + (1 - k2) * 16, spacing: -.03 });
    g.restore();
    label(g, 'PC · telefon · bez instalacji', -cw / 2 + 62, -ch / 2 + 690, { size: 28, color: '#333', alpha: seg(B, 66, 66.3) });
    g.restore();

    // ---------------------------------------------------------------- adres jak przycisk strony (ramka w cyjanie)
    const kb = eOutBack(seg(B, 66.5, 66.8), 1.4);
    if (kb > 0) {
      const str = 'm-jaro.pl/shooter.html';
      const size = 52, bw = measure(g, str, { size, weight: 700 }) + 110, bh = 128, by = 1300;
      const press = pulse(t, bt(68), .12);
      g.save();
      g.translate(W / 2, by); g.scale(kb * (1 - press * .04), kb * (1 - press * .04));
      rrect(g, -bw / 2, -bh / 2, bw, bh, 22);
      g.fillStyle = press > .1 ? CYAN : BLACK; g.fill();
      g.lineWidth = 4; g.strokeStyle = CYAN; g.stroke();
      text(g, str, 0, 3, { size, weight: 700, color: press > .1 ? BLACK : CYAN, align: 'center', baseline: 'middle' });
      g.restore();
      tap(g, W / 2 + 180, by + 10, raw(B, 67.9, 68.4), WHITE);
    }
    // ---------------------------------------------------------------- MJ.
    const kj = eOutExpo(seg(B, 67, 67.3));
    if (kj > 0) {
      g.save(); g.globalAlpha = kj; g.translate(0, (1 - kj) * 30);
      const y = 1475;
      text(g, 'MJ', W / 2 - 170, y, { size: 64, weight: 700, color: WHITE, spacing: -2 });
      const mw = measure(g, 'MJ', { size: 64, weight: 700, spacing: -2 });
      g.fillStyle = CYAN; g.fillRect(W / 2 - 170 + mw + 4, y - 12, 13, 13);
      text(g, 'Michał Jarosiński', W / 2 - 50, y - 26, { size: 30, weight: 500, color: WHITE });
      label(g, 'Gra i strona od zera', W / 2 - 50, y + 8, { size: 20, color: MUTED });
      g.restore();
    }
    // wyciemnienie
    S.fx.fade = Math.max(S.fx.fade, eInCubic(seg(B, 71.2, 72)));
  },
};
