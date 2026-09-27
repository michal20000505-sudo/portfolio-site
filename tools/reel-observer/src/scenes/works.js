// S3 — wybrane prace (B22–B30.5): karuzela 8 kart w 3D, obraca się o jedną kartę na każdą stopę;
// karty "drukują się" rastrem CMY przy wejściu, oko skanuje przednią kartę linią światła; na B30 karty rozlatują się.
import * as THREE from 'three';
import { W, H, CX, CY, BEAT, bt, C, M, Y, WHITE, GREY, clamp, lerp, seg, rad, TAU, pulse, decay, hash, eOutExpo, eInExpo, eOutBack, eInOutCubic, spring, scramble, text } from '../core.js';
import { IMG, TEX, WORKS, pixelCam, wx, wy, cardMesh, coverCrop } from '../common.js';
import { CAROUSEL } from './targets.js';

const scene = new THREE.Scene();
const cam = pixelCam(30);
const ring = new THREE.Group();
scene.add(ring);
let cards = [];
const N = WORKS.length;
const STEP = TAU / N;

export default {
  name: 'works', b0: 21.9, b1: 31.2,
  load() {
    cards = WORKS.map(([key], i) => {
      const m = cardMesh(TEX[key], CAROUSEL.w, CAROUSEL.h, { radius: 22, cell: 10 });
      m.material.uniforms.uCrop.value.set(...coverCrop(IMG[key], CAROUSEL.w, CAROUSEL.h));
      const piv = new THREE.Group();
      piv.add(m);
      ring.add(piv);
      return { piv, m, i };
    });
  },
  frame(S, L) {
    const { t, B, fx } = S;
    // obrót: wjazd z rozpędu (B22–B23), potem jedna karta na beat (sprężyna z dobiciem)
    let a = -TAU * 0.75 * (1 - eOutExpo(seg(t, bt(21.8), bt(22.9))));
    for (let b = 23; b <= 29; b++) a += STEP * spring((t - bt(b)) * 2.6, 10, 6.5);
    const idx = clamp(Math.round(a / STEP), 0, N - 1);
    const wobble = Math.sin(t * 1.1) * 0.03;
    // pochylenie pierścienia; środek przesunięty tak, żeby przednia karta stała dokładnie w CAROUSEL
    const tilt = 0.1 + wobble * 0.5;
    ring.position.set(wx(CAROUSEL.x), wy(CAROUSEL.y) + CAROUSEL.R * Math.sin(tilt), -CAROUSEL.R * Math.cos(tilt));
    ring.rotation.set(tilt, -a, -0.04 + wobble);
    // wybuch (B30): karty rozlatują się promieniście, obracając się
    const ex = eOutExpo(seg(t, bt(30), bt(30) + 0.7));
    const intro = seg(t, bt(22.0), bt(23.0));
    for (const c of cards) {
      const ang = c.i * STEP;
      c.piv.position.set(Math.sin(ang) * CAROUSEL.R, 0, Math.cos(ang) * CAROUSEL.R);
      c.piv.rotation.set(0, ang, 0);
      c.m.position.set(0, 0, 0); c.m.rotation.set(0, 0, 0);
      if (ex > 0) {
        const r1 = hash(c.i, 3), r2 = hash(c.i, 4);
        c.m.position.set((r1 - 0.5) * 2600 * ex, (r2 - 0.3) * 2200 * ex, 1400 * ex * (0.4 + r1));
        c.m.rotation.set((r2 - 0.5) * 4 * ex, (r1 - 0.5) * 5 * ex, (r1 - r2) * 3 * ex);
      }
      const u = c.m.material.uniforms;
      // druk rastrem: C → M → Y po kolei, potem pełny obraz
      const tp = bt(21.85) + c.i * 0.045;
      u.uInk.value.set(eOutExpo(seg(t, tp, tp + 0.25)), eOutExpo(seg(t, tp + 0.06, tp + 0.31)), eOutExpo(seg(t, tp + 0.12, tp + 0.37)));
      u.uPrint.value = seg(t, tp + 0.3, tp + 0.7);
      const mis = 1 - seg(t, tp, tp + 0.6);
      u.uOffC.value.set(-18 * mis, -6 * mis); u.uOffM.value.set(16 * mis, 8 * mis); u.uOffY.value.set(4 * mis, -16 * mis);
      // przednia karta jasna, reszta przyciemniona
      const front = c.i === idx ? 1 : 0;
      const d = Math.abs(((c.i * STEP - a) % TAU + TAU + Math.PI) % TAU - Math.PI);
      u.uBright.value = lerp(1, 0.38, clamp(d / (STEP * 1.2)));
      u.uBorder.value.set(0, 1, 1, front * 0.9 * (1 - ex) + (1 - front) * 0.0);
      if (!front) u.uBorder.value.set(0.2, 0.2, 0.2, 1);
      // skan: linia schodzi w dół przez przednią kartę w każdym beacie
      const bb = Math.floor(B), ph = B - bb;
      u.uScan.value.set(front && B > 23 && B < 30 ? ph : 0, front && B > 23 && B < 30 ? 0.8 * (1 - ph * 0.6) : 0, 3.5, 0);
      u.uOpacity.value = 1 - seg(t, bt(30.4), bt(31.1));
    }
    S.pages3d.push({ scene, camera: cam });

    // ---- nagłówek sekcji (jak na stronie: mały nadtytuł + żółty tytuł)
    const g = L.back.g;
    const hIn = eOutExpo(seg(t, bt(22.3), bt(22.8))), hOut = eInExpo(seg(t, bt(30), bt(30.4)));
    if (hIn > 0 && hOut < 1) {
      g.save();
      g.globalAlpha = 1 - hOut;
      g.translate(-80 * (1 - hIn) - 300 * hOut, 0);
      text(g, scramble('PORTFOLIO — 2014 / 2025', t, bt(22.3), 0.4, 5), 70, 300, { weight: 500, size: 26, spacing: 6, color: GREY, alpha: hIn });
      text(g, 'Wybrane', 66, 395, { weight: 700, size: 92, spacing: -1, color: Y, alpha: hIn });
      text(g, 'Prace', 66, 488, { weight: 700, size: 92, spacing: -1, color: Y, alpha: hIn });
      g.fillStyle = '#333'; g.fillRect(70, 520, 260 * hIn, 3);
      g.restore();
      // podpis przedniej karty: numer, nazwa, kategoria — zmienia się z każdą kartą
      const [ , name, cat] = WORKS[idx];
      const tb = bt(Math.max(23, Math.round(a / STEP) + 22));
      const e = idx === 0 ? hIn : eOutExpo(seg(t, tb, tb + 0.25));
      const ly = CAROUSEL.y + CAROUSEL.h / 2 + 70;
      g.save();
      g.globalAlpha = (1 - hOut);
      text(g, String(idx + 1).padStart(2, '0'), 150, ly, { weight: 700, size: 34, color: C, alpha: e });
      g.fillStyle = '#444'; g.fillRect(212, ly - 26, 2, 30);
      text(g, name, 236, ly, { weight: 700, size: 40, spacing: 1, color: WHITE, alpha: e });
      text(g, scramble(cat, t, tb, 0.3, idx), 930, ly, { weight: 500, size: 24, spacing: 4, color: GREY, align: 'right', alpha: e });
      g.restore();
    }
    fx.zoom *= 1 + 0.012 * pulse(t, bt(22.9), 0.2);
  },
};
