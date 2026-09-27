// S0 — intro (B0–B6): czerwona linia otwiera kadr jak migawka; zbliżenie na toczącą się oponę z laboratorium
// geometrii (napis SSCAR PERFORMANCE na boku); B4 uderzenie: odjazd kamery na cały zespół koła, logo SSCAR
// i podpis; B5 skręt koła (kinematyka strony); B6 whip pan do spisu treści.
import { W, H, bt, RED, RED_GLOW, INK, MUTED, clamp, lerp, seg, pulse, eOutExpo, eInExpo, eOutCubic, eInOutCubic, eInOutSine, keys, text, canvas2d } from '../core.js';
import { ENV, IMG, label, rule } from '../common.js';
import { CH } from '../director.js';
import { rise, slideX } from './world.js';

// prędkość toczenia (rad/s) → kąt przez całkowanie (deterministycznie)
const omega = t => {
  if (t < bt(1)) return 1.6;
  if (t < bt(3.4)) return 1.6 + 0.4 * seg(t, bt(1), bt(3.4));
  if (t < bt(4)) return lerp(2.0, 14, eInExpo(seg(t, bt(3.4), bt(4))));
  return 14 * Math.pow(1 - eOutCubic(seg(t, bt(4), bt(5.6))), 1);
};
function spinAt(t) {
  const n = 240, dt = t / n;
  let a = 0;
  for (let i = 0; i < n; i++) a += omega((i + 0.5) * dt) * dt;
  return -a;
}

// logo z przesuwanym połyskiem (połysk tylko na pikselach logo)
const [lc, lg] = canvas2d(1600, 300);
export function drawLogo(g, cx, cy, w, alpha = 1, sweep = -1, glow = 0) {
  const img = IMG.logo, h = w * img.height / img.width;
  if (alpha <= 0) return;
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, lc.width, lc.height);
  const lw = Math.min(1580, Math.ceil(w)), lh = lw * img.height / img.width;
  lg.drawImage(img, 10, 10, lw, lh);
  if (sweep > -0.5 && sweep < 1.5) {
    lg.globalCompositeOperation = 'source-atop';
    const x = 10 + lw * sweep;
    const gr = lg.createLinearGradient(x - 160, 0, x + 160, lh);
    gr.addColorStop(0, 'rgba(255,240,235,0)');
    gr.addColorStop(0.5, 'rgba(255,240,235,0.85)');
    gr.addColorStop(1, 'rgba(255,240,235,0)');
    lg.fillStyle = gr;
    lg.fillRect(0, 0, lc.width, lc.height);
  }
  g.save();
  g.globalAlpha = alpha;
  if (glow > 0) { g.shadowColor = `rgba(255,40,30,${0.6 * glow})`; g.shadowBlur = 60 * glow; }
  g.drawImage(lc, 10, 10, lw, lh, cx - w / 2, cy - h / 2, w, h);
  g.restore();
}

export default {
  name: 'intro', b0: 0, b1: 6.6,
  frame(S, L) {
    const { t, B } = S;
    const rig = ENV.rig, K = rig.kin;
    // ---- koło
    rig.spin = spinAt(t);
    K.S = { camber: -0.3, toe: 0.2, caster: 4.5, press: 2.2, steer: 0 };
    // skręt koła po odjeździe kamery (B5–B5.9): w prawo i z powrotem
    K.S.steer = keys(B, [[4.9, 0], [5.35, 22, eInOutCubic], [5.95, 0, eInOutCubic]]);
    rig.showSusp = true;
    rig.fadeY = [0, 0];
    rig.floorFade = 1;
    const pull = eOutExpo(seg(t, bt(4), bt(4.9)));
    // zbliżenie (B1–B4): kamera przy boku opony, powolny najazd i przesuw
    const m = seg(t, bt(1), bt(4));
    const eyeM = [lerp(1.34, 1.16, m), lerp(0.70, 0.84, m), lerp(-1.12, -0.84, m)];
    const tgtM = [0.24, lerp(1.36, 1.46, m), lerp(-0.08, 0.02, m)];
    // plan ogólny: widok izometryczny strony, nisko w kadrze (nad nim logo)
    const yaw = Math.PI + 0.8 + 0.12 * eInOutSine(seg(t, bt(4), bt(6.5))), pitch = 0.3, dist = 4.45;
    const V = rig.view.orbit(yaw, pitch, dist);
    const eyeH = V.eye.slice(), tgtH = [0, 0.52, 0];
    const eye = eyeM.map((v, i) => lerp(v, eyeH[i], pull)), tgt = tgtM.map((v, i) => lerp(v, tgtH[i], pull));
    rig.view.lookAt(eye, tgt, lerp(-0.05, 0, pull));
    const sx = slideX(B, -10, CH.toc);
    rig.view.frame(lerp(1560, 1330, pull), 540 + sx, lerp(930, 1250, pull));
    rig.opacity = 1;
    rig.floorOpacity = pull;
    // światło: przejazd softboxa w zbliżeniu, czerwony kontur przy uderzeniu
    rig.sweep = Math.sin(Math.PI * seg(t, bt(1.4), bt(3.8))) * 1.2;
    const sa = lerp(-1.2, 1.2, seg(t, bt(1.4), bt(3.8)));
    rig.sweepDir.set(Math.sin(sa) * 0.8, 0.5, -Math.cos(sa) * 0.6).normalize();
    const rim = 2.4 * pulse(t, bt(4), 0.6) + 0.9 * clamp(1 - pull * 0.6) * seg(t, bt(1), bt(2));
    rig.rimCol.set(rim, rim * 0.05, rim * 0.03);
    rig.rimDir.set(-0.6, 0.35, 0.9).normalize();
    S.wheel3d.push(rig.item());
    S.bg.lab = [540 + sx, 1060, 1100, 0.55 * pull];

    // ---- migawka: czerwona linia rośnie od środka (B0–B0.6), potem rozsuwa się na dwie (B1–B1.7)
    const gF = L.front.g, gA = L.add.g;
    const grow = eOutExpo(seg(t, bt(0.05), bt(0.7)));
    const open = eInOutCubic(seg(t, bt(1), bt(1.75)));
    const o = open * (H / 2 + 20);
    if (open < 1) {
      gF.fillStyle = '#090706';
      gF.fillRect(0, 0, W, H / 2 - o);
      gF.fillRect(0, H / 2 + o, W, H / 2 - o + 1);
      const lw = W * grow;
      const la = 1 - open;
      for (const y of (open > 0 ? [H / 2 - o, H / 2 + o] : [H / 2])) {
        gA.fillStyle = `rgba(255,45,30,${la})`;
        gA.fillRect(W / 2 - lw / 2, y - 1.5, lw, 3);
        gA.fillStyle = `rgba(255,45,30,${0.25 * la})`;
        gA.fillRect(W / 2 - lw / 2, y - 7, lw, 14);
      }
    }

    // ---- logo + podpis (B4)
    const g = L.front.g;
    const lk = eOutExpo(seg(t, bt(4), bt(4.55)));
    if (lk > 0) {
      g.save();
      g.translate(sx, 0);
      const s = lerp(1.25, 1, lk);
      drawLogo(g, 540, 335, 800 * s, clamp(lk * 1.4), lerp(-0.3, 1.3, seg(t, bt(4.35), bt(5.3))), pulse(t, bt(4), 0.5));
      const sub = seg(t, bt(4.45), bt(5.2));
      rise(g, 'STACJA KONTROLI POJAZDÓW', 540, 492, { family: 'cond', weight: 700, size: 40, spacing: 40 * 0.16, color: INK, align: 'center', stagger: 0.5 }, sub);
      text(g, 'WROCŁAW · POLANOWICKA 82', 540, 544, { family: 'cond', weight: 600, size: 28, spacing: 28 * 0.2, color: MUTED, align: 'center', alpha: eOutExpo(seg(t, bt(4.9), bt(5.5))) });
      g.restore();
    }
  },
};
