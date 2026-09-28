// Świat (rysowany na końcu, po scenach): puls kamery na stopach, przesunięcie płyt na mocnych uderzeniach, cięcia montażu, wstrząs z gry.
import { W, H, bt, pulse, noise1 } from '../core.js';
import { kickPulse, hitPulse } from '../director.js';

// cięcia: beat → siła szarpnięcia (rozmycie poziome + płyty)
const CUTS = [];
for (let b = 13; b < 24; b++) CUTS.push([b, b % 2 ? 1 : -1]);
for (const b of [32, 33, 34, 35, 36]) CUTS.push([b, b % 2 ? -1.4 : 1.4]);

export default {
  b0: 0, b1: 72,
  frame(S) {
    const t = S.t, fx = S.fx;
    const k = kickPulse(t), h = hitPulse(t);
    fx.zoom *= 1 + .016 * k + .03 * h;
    fx.mis += 9 * h + 2 * k;
    fx.misRot = Math.floor(S.B) * 1.7;
    let st = 0;
    for (const [b, dir] of CUTS) st += dir * pulse(t, bt(b), .05) * 120;
    fx.stretchX += st;
    fx.mis += Math.abs(st) * .08;
    // wstrząs gry (wybuchy, bossowie) → płynny szum kamery
    const sh = S.shake || 0;                       // sceny z grą wpisują tu wstrząs swojego rigu
    const a = sh * sh * 22;
    fx.shakeX += noise1(t * 22, 1) * a;
    fx.shakeY += noise1(t * 22, 2) * a;
  },
};
