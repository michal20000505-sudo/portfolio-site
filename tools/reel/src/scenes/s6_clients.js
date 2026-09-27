// S6 — ZAUFALI MI (B48–B56, drop B): kalejdoskopowy tunel z prac, nazwy klientów na każdy beat,
// orbitujące kształty CMY; na końcu wszystko zapada się w punkt.
import * as THREE from 'three';
import {
  W, H, CX, CY, BEAT, S16, bt, C, M, Y, INK, GREY, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eOutBack, eInOutCubic, eInCubic, decay, pulse, hash,
  inkText, inkOff, fitSize, canvas2d, drawCover, polyPath,
} from '../core.js';
import { IMG, ENV, tapeLabel, bgEntry, shockRings, makeBurst, drawBurst } from '../common.js';

const B0 = 48;
const ATLAS = ['web_sscar', 'poster_foodpoint', 'game_boss2', 'web_sentracker_trc01', 'card_sudbal', 'poster_gromart', 'game_hivefleetwave', 'web_fault_08', 'poster_digicamo'];
const NAMES = ['LAVAZZA', 'AIMCONTROLLERS', 'PGV', 'POL-VENDING', 'AORA VENDING', 'GROM ART'];
let atlasTex;
const burst = makeBurst(123, 220, 2600);

export default {
  name: 'clients', b0: 48, b1: 56, pre: 0, post: 0.02,
  async load() {
    const [c, g] = canvas2d(2100, 2100);
    ATLAS.forEach((n, i) => drawCover(g, IMG[n], (i % 3) * 700, Math.floor(i / 3) * 700, 700, 700, 0.5, 0.35));
    atlasTex = new THREE.CanvasTexture(c);
    atlasTex.colorSpace = THREE.NoColorSpace;
    atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
    atlasTex.generateMipmaps = true;
    atlasTex.anisotropy = 8;
  },
  frame(S, Ls) {
    const { t, B } = S, L = B - B0, fx = S.fx;
    const front = Ls.front.g, add = Ls.add.g;
    ENV.pipeline.bg.u.tAtlas.value = atlasTex;
    // ---- tło: tunel kalejdoskopu, "wypluwa" się z punktu na B48, zapada na końcu
    const collapse = eInExpo(seg(L, 7.35, 8));
    let depth = 1.1 * (t - bt(B0)) + 5 * (1 - eOutExpo(seg(L, 0, 1.2)));
    for (let b = 1; b < 8; b++) depth += 0.55 * eOutExpo(seg(L, b, b + 0.45));
    let spin = 0.35 * (t - bt(B0));
    for (let b = 0; b < 8; b++) spin += rad(22) * eOutBack(seg(L, b, b + 0.5), 1.4) * (b % 2 ? -1 : 1);
    const inten = eOutExpo(seg(L, 0, 0.25)) * (1 - collapse);
    const zoom = lerp(0.3, 0.19, eOutExpo(seg(L, 0, 1)));
    S.bgs.push(bgEntry(7, [0.9 * inten, depth, 6, spin], [Math.floor(L) * 2, 0.8, zoom, 0]));
    // ---- satelity: trzy wielokąty krążące wokół napisu, zamieniają się miejscami na beatach
    let orb = 0.6 * t;
    for (let b = 0; b < 8; b++) orb += rad(120) * eOutBack(seg(L, b, b + 0.45), 1.5);
    const oR = 410 * eOutBack(seg(L, 0.05, 0.6), 1.3) * (1 - collapse);
    for (let k = 0; k < 3; k++) {
      const a = orb + k * TAU / 3;
      const x = CX + Math.cos(a) * oR, y = CY + Math.sin(a) * oR * 1.25;
      const sides = [3, 4, 6][(k + Math.floor(L)) % 3];
      const r = 46 * (1 + 0.25 * pulse(t, bt(B0 + Math.floor(L)), 0.12));
      front.lineWidth = 5; front.strokeStyle = INK[k];
      polyPath(front, x, y, r, sides, t * (k % 2 ? 2 : -2)); front.stroke();
      front.fillStyle = INK[k]; front.globalAlpha = 0.25; front.fill(); front.globalAlpha = 1;
    }
    // ---- napisy
    const sc = 1 - collapse;
    front.save();
    front.translate(CX, CY); front.scale(Math.max(sc, 0.001), Math.max(sc, 0.001)); front.translate(-CX, -CY);
    if (L < 1) {
      const tb = bt(B0);
      tapeLabel(front, 'ZAUFALI MI', CX, CY, { size: 150, reveal: eOutExpo(seg(t, tb, tb + 0.2)), inks: inkOff(30 * decay(t, tb, 0.1), 0.6, 1), skew: -0.08 });
    } else {
      // mała etykieta nad nazwą
      tapeLabel(front, 'ZAUFALI MI:', CX, CY - 175, { size: 46, reveal: 1, bg: '#ffffff', fg: '#050505' });
      if (L < 7) {
        const i = Math.min(5, Math.floor(L) - 1);
        const tb = bt(B0 + 1 + i);
        const name = NAMES[i];
        const size = fitSize(front, name, 700, 860, 170, -0.01);
        tapeLabel(front, name, CX, CY + 10, { size, reveal: eOutExpo(seg(t, tb, tb + 0.14)), inks: inkOff(28 * decay(t, tb, 0.08), 0.8, i), skew: -0.08 });
        front.fillStyle = INK[i % 3];
        const uw = 200 * eOutExpo(seg(t, tb + 0.03, tb + 0.3));
        front.fillRect(CX - uw / 2, CY + 105, uw, 8);
      } else {
        const tb = bt(B0 + 7);
        const rv = eOutExpo(seg(t, tb, tb + 0.2));
        tapeLabel(front, '…ORAZ WIELU', CX, CY - 20, { size: 70, reveal: rv, skew: -0.08 });
        tapeLabel(front, 'KLIENTÓW PRYWATNYCH', CX, CY + 78, { size: 70, reveal: eOutExpo(seg(t, tb + 0.06, tb + 0.26)), skew: -0.08 });
      }
    }
    front.restore();
    // ---- wybuch na wejściu (po ciszy)
    shockRings(add, t, bt(B0), CX, CY, 1300, 0.8, 12);
    drawBurst(add, burst, t, bt(B0), CX, CY, { drag: 4, r0: 20 });
    fx.flash += 0.42 * pulse(t, bt(B0), 0.1);
    fx.ripple = Math.max(fx.ripple, 1.0 * decay(t, bt(B0), 0.35));
    if (L < 2) { fx.rippleR = (t - bt(B0)) * 2600; fx.rippleY = CY; }
    fx.aberr += 30 * pulse(t, bt(B0), 0.15);
    for (let b = 1; b < 8; b++) fx.aberr += 9 * pulse(t, bt(B0 + b), 0.08);
    fx.glitch += 0.4 * pulse(t, bt(B0), 0.06) + 0.12 * [1, 2, 3, 4, 5, 6].reduce((s, b) => s + pulse(t, bt(B0 + b), 0.04), 0);
    fx.glitchSeed = Math.floor(t * 40);
    fx.zoom *= 1 + 0.06 * decay(t, bt(B0), 0.3) + 0.5 * collapse;
  },
};
