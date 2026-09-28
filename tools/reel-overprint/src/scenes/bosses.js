// B32–B40: pięciu bossów; czterech po beacie, KRAJARKA dostaje cztery beaty walki.
import { W, H, bt, seg, clamp, eOutExpo, eInCubic, scramble, text, INK_K, PAPER, CYAN, INK_M, MUTED } from '../core.js';
import { RIG, sticker, label, printText } from '../common.js';
import { BOSS_SHOTS } from '../shots.js';
import { BOSSES } from '../../../../shooter/data.js?v=20260928c';

const STARTS = [32, 33, 34, 35, 36];

export default {
  b0: 32, b1: 40,
  frame(S, L) {
    const B = S.B, t = S.t;
    let i = 0;
    STARTS.forEach((b, j) => { if (B >= b) i = j; });
    const rig = RIG.main;
    rig.seek(BOSS_SHOTS[i], t - bt(STARTS[i]));
    rig.draw(L.game.g, 0, 0, W, H);
    S.shake = rig.shake * .7;

    const g = L.front.g;
    const lb = B - STARTS[i];
    const def = BOSSES[i];
    const out = eInCubic(seg(B, 39.7, 40));
    // ---------------------------------------------------------------- nagłówek
    sticker(g, ['5 BOSSÓW'], W / 2 - 120, 300 - out * 500, { size: 110, k: eOutExpo(seg(B, 32, 32.25)), rot: -.03, mis: 3, fill: INK_K, color: PAPER });
    sticker(g, ['CO PIĄTĄ FALĘ'], W / 2 + 150, 440 - out * 500, { size: 58, k: eOutExpo(seg(B, 32.5, 32.75)), rot: .03, mis: 2 });

    // ---------------------------------------------------------------- pas z nazwą bossa (jak plansza przed walką)
    const k = eOutExpo(seg(lb, 0, .28));
    const big = i === 4;
    const y = big ? 1330 : 1300, bh = big ? 300 : 250;
    g.save();
    g.translate((1 - k) * -W * .9 - out * W, 0);
    g.translate(W / 2, y); g.rotate(-.045); g.translate(-W / 2, -y);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-40, y - bh / 2 + 16, W + 80, bh);
    g.fillStyle = INK_K; g.fillRect(-40, y - bh / 2, W + 80, bh);
    g.fillStyle = INK_M; g.fillRect(-40, y - bh / 2, W + 80, 10);
    label(g, `Boss ${i + 1} / 5 · fala ${(i + 1) * 5}`, 70, y - bh / 2 + 58, { size: 26, color: CYAN });
    const name = scramble(def.name, lb * 60 / 128, 0, .18, i + 3);
    const size = big ? 168 : 140;
    g.save(); g.globalCompositeOperation = 'screen';
    const mis = 4 + (1 - k) * 18;
    text(g, name, 64 - mis, y + size * .42, { size, weight: 700, color: '#00aeef', spacing: -size * .03 });
    text(g, name, 64 + mis, y + size * .42 - mis * .4, { size, weight: 700, color: '#ec008c', spacing: -size * .03 });
    g.restore();
    text(g, name, 64, y + size * .42, { size, weight: 700, color: PAPER, spacing: -size * .03 });
    g.restore();
    // podtytuł na kartce pod pasem
    sticker(g, [def.title.toUpperCase()], W - 330 + out * W, y + bh / 2 + 70, { size: 50, k: eOutExpo(seg(lb, .15, .4)), rot: .02, mis: 2 });
  },
};
