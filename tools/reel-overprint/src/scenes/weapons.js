// B12–B24: dwanaście broni, po jednej na beat (wszystkie na 5. poziomie, z ewolucją i tuszem).
import { W, H, bt, seg, clamp, eOutExpo, eOutBack, eInCubic, scramble, text, INK_K, INK_C, PAPER, CYAN, WHITE, MUTED } from '../core.js';
import { RIG, icon, panel, label, sticker } from '../common.js';
import { WEAPON_SHOTS } from '../shots.js';
import { WEAPONS } from '../../../../shooter/data.js?v=20260928c';

const B0 = 12;

export default {
  b0: B0, b1: 24,
  frame(S, L) {
    const B = S.B, t = S.t;
    const i = Math.min(11, Math.floor(B - B0));
    const shot = WEAPON_SHOTS[i];
    const rig = RIG.main;
    rig.seek(shot, t - bt(B0 + i));
    rig.draw(L.game.g, 0, 0, W, H);
    S.shake = rig.shake * .6;

    const g = L.front.g;
    const lb = B - (B0 + i);                              // czas w beacie tej broni
    const def = WEAPONS[shot.id];
    // ---------------------------------------------------------------- nagłówek: "12 BRONI"
    const kHead = eOutExpo(seg(B, B0, B0 + .25));
    const out = eInCubic(seg(B, 23.7, 24));
    sticker(g, ['12 BRONI'], W / 2 - 150, 330 - out * 500, { size: 104, k: kHead, rot: -.03, mis: 3, fill: INK_K, color: PAPER });
    sticker(g, ['KAŻDA EWOLUUJE'], W / 2 + 140, 468 - out * 500, { size: 60, k: eOutExpo(seg(B, B0 + 1, B0 + 1.25)), rot: .025, mis: 2 });

    // ---------------------------------------------------------------- karta broni (styl UI gry)
    const k = eOutExpo(seg(lb, 0, .3));
    const x = 70, w = W - 140, y = 1235, h = 250;
    g.save();
    g.translate(0, (1 - k) * 60 + out * 500);
    g.globalAlpha = clamp(k * 2);
    panel(g, x, y, w, h, { r: 26, stroke: '#333' });
    // ikona pikselowa w kafelku papieru
    const pop = 1 + (1 - eOutBack(seg(lb, 0, .35))) * .5;
    g.save();
    g.translate(x + 40 + 85, y + h / 2); g.scale(pop, pop);
    g.fillStyle = PAPER; g.fillRect(-85, -85, 170, 170);
    g.imageSmoothingEnabled = false;
    g.drawImage(icon(def.icon, 14, INK_K, INK_C), -63, -63);
    g.restore();
    const tx = x + 250;
    label(g, `Broń ${String(i + 1).padStart(2, '0')} / 12`, tx, y + 62, { size: 26, color: MUTED });
    text(g, scramble(def.name.toUpperCase(), lb * BEAT_S, 0, .14, i), tx - 3, y + 146, { size: 86, weight: 700, color: WHITE, spacing: -2 });
    label(g, `Ewolucja: ${def.evo}`, tx, y + 202, { size: 26, color: CYAN });
    g.restore();
  },
};
const BEAT_S = 60 / 128;
