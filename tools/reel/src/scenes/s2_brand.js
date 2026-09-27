// S2 — BRANDING & PRINT (B16–B24): plakaty drukowane płytami C→M→Y→K na 16tkach (raster + paser),
// kolaż, potem "MARKI, KTÓRE / KRZYCZĄ / Z EKRANU" z orbitą wizytówek.
import * as THREE from 'three';
import {
  W, H, CX, BEAT, S16, bt, C, M, Y, INK, GREY, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eOutBack, eInOutCubic, eInCubic, eOutCubic, decay, pulse, hash,
  inkText, inkOff, measure, setFont,
} from '../core.js';
import { IMG, pixelCam, wx, wy, imagePlane, sectionTitle, tapeLabel, bgEntry, shockRings } from '../common.js';

const B0 = 16;
const PRINT = [CX, 1040];
const POSTERS = [
  { img: 'poster_foodpoint', h: 1000, slot: [300, 760, -8, 0.4] },
  { img: 'poster_gromart', h: 880, slot: [790, 740, 7, 0.43] },
  { img: 'poster_dunajewska', h: 880, slot: [280, 1340, 6, 0.42] },
  { img: 'poster_digicamo', h: 740, slot: [800, 1330, -6, 0.46] },
];
const CARDS = ['card_pirog', 'card_sudbal', 'card_kowalik', 'card_bucz', 'card_render2'];
const PLATE_DIR = [[-1, 0.4], [1, -0.6], [0.3, 1], [-0.5, -1]];

let scene, cam, posters = [], cards = [], cardGroup;

function plateTime(p, j) { return bt(B0 + p) + j * S16; }

export default {
  name: 'brand', b0: 16, b1: 24, pre: 0, post: 0.02,
  async load() {
    scene = new THREE.Scene();
    cam = pixelCam(30);
    for (const P of POSTERS) {
      const aspect = IMG[P.img].width / IMG[P.img].height;
      const m = imagePlane(P.img, P.h * aspect, { round: 0.004 });
      m.material.uniforms.uCells.value = 58;
      posters.push(m);
      scene.add(m);
    }
    cardGroup = new THREE.Group();
    scene.add(cardGroup);
    for (const c of CARDS) {
      const m = imagePlane(c, 330, { round: 0.03 });
      m.material.uniforms.uBackDim.value = 0.5;
      cards.push(m);
      cardGroup.add(m);
    }
  },
  frame(S, Ls) {
    const { t, B } = S, L = B - B0, fx = S.fx;
    const front = Ls.front.g, add = Ls.add.g;
    // ---------------- plakaty
    let lastStamp = -1;
    posters.forEach((m, p) => {
      const u = m.material.uniforms;
      const P = POSTERS[p];
      const visible = L >= p - 0.2;
      m.visible = visible;
      if (!visible) return;
      // wejście
      let x = PRINT[0], y = PRINT[1], rz = 0, ry = 0, sc = 1, z = 60;
      if (p === 0) ry = rad(-90) * (1 - eOutExpo(seg(L, 0, 0.4)));
      else {
        const e = eOutExpo(seg(L, p - 0.16, p + 0.2));
        y = lerp(2500, PRINT[1], e); rz = rad(12) * (1 - e);
      }
      // druk
      let plates = 0;
      for (let j = 0; j < 4; j++) {
        const tj = plateTime(p, j);
        plates += seg(t, tj, tj + 0.03);
        const off = 0.04 * (1 - eOutExpo(seg(t, tj, tj + S16 * 0.95))) + 0.012 * pulse(t, bt(B0 + 4), 0.1);
        u.uOff.value[j].set(PLATE_DIR[j][0] * off, PLATE_DIR[j][1] * off);
        if (t >= tj) lastStamp = Math.max(lastStamp, tj);
      }
      u.uPlates.value = plates;
      u.uHalftone.value = 1 - eInOutCubic(seg(L, p + 0.5, p + 0.95));
      // do kolażu
      const mv = eInOutCubic(seg(L, p + 1, p + 1.4));
      const [sx, sy, srot, ss] = P.slot;
      x = lerp(x, sx, mv); y = lerp(y, sy, mv); rz = lerp(rz, rad(srot), mv); sc = lerp(sc, ss, mv); z = lerp(z, -p * 8, mv);
      // przygaszenie pod hasłem + ucieczka na koniec
      const dim = seg(L, 3.9, 4.3);
      sc *= lerp(1, 0.92, dim);
      const ex = eInExpo(seg(L, 7.45, 8));
      const ang = Math.atan2(y - 1040, x - CX);
      x += Math.cos(ang) * 900 * ex; y += Math.sin(ang) * 900 * ex; rz += rad(40) * ex * (p % 2 ? 1 : -1);
      m.position.set(wx(x), wy(y), z);
      m.rotation.set(0, ry, rz);
      m.scale.setScalar(sc * (1 + 0.02 * pulse(t, plateTime(p, 3), 0.1)));
      u.uBright.value = lerp(1, 0.42, dim);
    });
    // ---------------- wizytówki na orbicie
    const ce = seg(L, 3.95, 4.6);
    cardGroup.visible = ce > 0;
    cardGroup.position.set(0, wy(1045), -200);
    cardGroup.rotation.set(rad(16), 0, rad(-8));
    let spin = 1.1 * t;
    for (let b = 4; b < 8; b++) spin += rad(40) * eOutBack(seg(L, b, b + 0.5), 1.6);
    cards.forEach((m, i) => {
      const a = i * TAU / CARDS.length + spin;
      const e = eOutBack(seg(L, 4 + i * 0.07, 4.5 + i * 0.07), 1.5);
      const R = 600 * e * (1 + 0.9 * eInExpo(seg(L, 7.4, 8)));
      m.position.set(Math.sin(a) * R, 40 * Math.sin(a * 2 + t), Math.cos(a) * R);
      m.rotation.set(0, a, 0);
      m.scale.setScalar(Math.max(0.001, e));
      m.material.uniforms.uBright.value = 0.95;
    });
    S.list3d.push({ scene, camera: cam });
    S.fx.tone3d = 0;
    // ---------------- tło: raster CMY z pulsem przy każdej płycie
    const ps = lastStamp > 0 ? lastStamp : bt(B0);
    const pc = (1040 - 960) / W;
    S.bgs.push(bgEntry(3, [0.23 + 0.1 * pulse(t, ps, 0.1), 24, t, 0], [(t - ps) * 1.6, 0.9 * decay(t, ps, 0.3), 0, -pc]));
    // ---------------- tytuł
    sectionTitle(front, S, { num: '02', label: 'BRANDING & PRINT', lines: ['BRANDING'], b0: B0 + 0.15, bOut: B0 + 3.85, y: 240, size: 150 });
    // ---------------- hasło
    const out = eInExpo(seg(L, 7.5, 7.85));
    const lines = [
      { txt: 'MARKI, KTÓRE', b: 4, y: 865, size: 96 },
      { txt: 'KRZYCZĄ', b: 5, y: 1048, size: 205, loud: true },
      { txt: 'Z EKRANU', b: 6, y: 1232, size: 96 },
    ];
    for (const ln of lines) {
      if (L < ln.b - 0.02) continue;
      const tb = bt(B0 + ln.b);
      const rv = eOutExpo(seg(t, tb, tb + 0.22));
      const yy = ln.y - out * 60;
      if (!ln.loud) {
        tapeLabel(front, ln.txt, CX, yy, { size: ln.size, reveal: rv * (1 - out), inks: inkOff(22 * decay(t, tb, 0.09), 0.5, ln.b), skew: -0.08 });
      } else {
        // KRZYCZĄ — żółta taśma, litery drżą na 32kach, puls na 16tkach
        const s16 = Math.floor((t - tb) / (S16 / 2));
        const sc = 1 + 0.045 * pulse(t, tb + Math.floor((t - tb) / S16) * S16, 0.05) * (L < 7.5 ? 1 : 0);
        const w = measure(front, ln.txt, 700, ln.size, -4) + 70, h = ln.size * 0.78 + 34;
        front.save();
        front.translate(CX, yy); front.scale(sc, sc); front.transform(1, 0, -0.12, 1, 0, 0);
        front.beginPath(); front.rect(-w / 2, -h / 2 - 40, w * rv * (1 - out), h + 120); front.clip();
        front.fillStyle = Y; front.fillRect(-w / 2, -h / 2, w, h);
        setFont(front, 700, ln.size, -4);
        front.textAlign = 'left'; front.textBaseline = 'alphabetic';
        let xx = -w / 2 + 35;
        [...ln.txt].forEach((ch, i) => {
          const jx = (hash(i, s16) - 0.5) * 14, jy = (hash(i + 9, s16) - 0.5) * 16;
          front.fillStyle = '#050505';
          front.fillText(ch, xx + jx, ln.size * 0.36 + jy);
          xx += front.measureText(ch).width - 4;
        });
        front.restore();
      }
    }
    // ---------------- akcenty
    for (let p = 0; p < 4; p++) {
      for (let j = 0; j < 4; j++) fx.aberr += 3 * pulse(t, plateTime(p, j), 0.05);
      shockRings(Ls.add.g, t, plateTime(p, 3), PRINT[0], PRINT[1], 700, 0.5, 4);
    }
    fx.aberr += 16 * pulse(t, bt(B0 + 5), 0.1);
    fx.glitch += 0.3 * pulse(t, bt(B0 + 5), 0.05);
    fx.ripple = Math.max(fx.ripple, 0.6 * decay(t, bt(B0 + 5), 0.25));
    if (L >= 5) { fx.rippleR = (t - bt(B0 + 5)) * 2000; fx.rippleY = 1048; }
    fx.glitchSeed = Math.floor(t * 40);
  },
};
