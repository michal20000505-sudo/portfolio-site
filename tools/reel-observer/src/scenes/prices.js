// S4 — cennik (B30–B38.5): cztery płyty drukarskie C, M, Y, K (jak kategorie na cennik.html) spadają jak stemple
// na kolejne beaty, drukują się rastrem swojej farby i dochodzą do pełnego obrazu; na B38 rozlatują się.
import * as THREE from 'three';
import { W, H, BEAT, bt, C, M, Y, WHITE, GREY, PAPER, clamp, lerp, seg, rad, TAU, pulse, decay, hash, eOutExpo, eInExpo, eOutBack, spring, text, rrect, canvas2d, setFont } from '../core.js';
import { pixelCam, wx, wy, cardMesh, canvasTex, sparks } from '../common.js';
import { PLATES, plateY } from './targets.js';

// dane z cennik.html (ceny netto, "od")
const DATA = [
  { ink: C, rgb: [0, 1, 1], tag: '01 · WEB', name: 'Strona / landing page', price: '900 zł', b: 30.5 },
  { ink: M, rgb: [1, 0, 1], tag: '02 · DESIGN', name: 'Logo wektorowe', price: '300 zł', b: 31 },
  { ink: Y, rgb: [1, 1, 0], tag: '03 · MOTION', name: 'Reklama animowana', price: '500 zł', b: 31.5 },
  { ink: PAPER, rgb: [1, 1, 1], tag: '04 · REKLAMA', name: 'Kampania Google / Meta', price: '600 zł', unit: '/ mies.', b: 32, strip: true },
];
const SC = 2;   // tekstury w 2× dla ostrości

function plateCanvas(d) {
  const w = PLATES.w * SC, h = PLATES.h * SC;
  const [c, g] = canvas2d(w, h);
  g.scale(SC, SC);
  const W_ = PLATES.w, H_ = PLATES.h;
  g.fillStyle = '#1a1a1a'; rrect(g, 0, 0, W_, H_, 18); g.fill();
  g.save(); rrect(g, 0, 0, W_, H_, 18); g.clip();
  // pasek u góry: kolor płyty (K: pasek kontrolny C/M/Y/K jak na stronie)
  if (d.strip) [C, M, Y, PAPER].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * W_ / 4, 0, W_ / 4, 6); });
  else { g.fillStyle = d.ink; g.fillRect(0, 0, W_, 6); }
  // delikatne tło w kolorze farby od lewej
  const gr = g.createLinearGradient(0, 0, W_ * 0.6, 0);
  gr.addColorStop(0, `rgba(${d.rgb.map(v => v * 255).join(',')},0.09)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W_, H_);
  g.restore();
  g.strokeStyle = '#333'; g.lineWidth = 1.5; rrect(g, 0.75, 0.75, W_ - 1.5, H_ - 1.5, 18); g.stroke();
  // chip kategorii
  g.fillStyle = d.ink; g.fillRect(30, 34, 13, 13);
  text(g, d.tag, 54, 47, { weight: 700, size: 20, spacing: 3, color: d.ink });
  text(g, d.name, 30, 98, { weight: 500, size: 36, spacing: -0.3, color: WHITE });
  // cena: "od" + kwota w kolorze farby
  const px = W_ - 30;
  let x = px;
  if (d.unit) { text(g, d.unit, x, 96, { weight: 500, size: 22, spacing: 1, color: GREY, align: 'right' }); setFont(g, 500, 22, 1); x -= g.measureText(d.unit).width + 12; }
  text(g, d.price, x, 98, { weight: 700, size: 60, spacing: -1, color: d.ink, align: 'right' });
  setFont(g, 700, 60, -1); x -= g.measureText(d.price).width + 12;
  text(g, 'OD', x, 96, { weight: 500, size: 20, spacing: 2, color: GREY, align: 'right' });
  return c;
}

const scene = new THREE.Scene();
const cam = pixelCam(30);
let plates = [];

export default {
  name: 'prices', b0: 29.9, b1: 39.3,
  load() {
    plates = DATA.map((d, i) => {
      const m = cardMesh(canvasTex(plateCanvas(d)), PLATES.w, PLATES.h, { radius: 18, cell: 7 });
      m.material.uniforms.uBorder.value.set(0, 0, 0, 0);
      scene.add(m);
      return { m, d, i };
    });
  },
  frame(S, L) {
    const { t, B, fx } = S;
    const add = L.add.g;
    const ex = eOutExpo(seg(t, bt(38), bt(38) + 0.7));
    for (const p of plates) {
      const tb = bt(p.d.b), side = p.i % 2 ? 1 : -1;
      // stempel: nadlatuje z boku i z bliska (duży), uderza, lekkie dobicie
      const k = seg(t, tb - 0.24, tb);
      const e = k * k;
      const land = t >= tb ? 1 - Math.exp(-(t - tb) * 9) * Math.cos((t - tb) * 30) * 0.5 : 0;
      const cx = wx(PLATES.x + PLATES.w / 2), cy = wy(plateY(p.i) + PLATES.h / 2);
      const m = p.m;
      if (t < tb - 0.24) { m.visible = false; continue; }
      m.visible = true;
      const z = t < tb ? lerp(1100, 0, e) : 0;
      const sx = t < tb ? lerp(side * 900, 0, Math.sqrt(e)) : 0;
      m.position.set(cx + sx, cy + (t < tb ? lerp(-260, 0, e) : 0), z + (t >= tb ? -25 * (1 - land) : 0));
      m.rotation.set(t < tb ? lerp(-0.5, 0, e) : 0, t < tb ? side * lerp(0.9, 0, e) : 0, t < tb ? side * lerp(0.25, 0, e) : 0);
      if (ex > 0) {
        const r1 = hash(p.i, 13), r2 = hash(p.i, 14);
        m.position.x += (p.i % 2 ? 1 : -1) * 1800 * ex * (0.6 + r1);
        m.position.y += (r2 - 0.5) * 1400 * ex;
        m.position.z += 900 * ex * r2;
        m.rotation.set((r2 - 0.5) * 3 * ex, (r1 - 0.5) * 4 * ex, (p.i % 2 ? 1 : -1) * 1.5 * ex);
      }
      const u = m.material.uniforms;
      // druk: raster farby płyty tuż po uderzeniu, potem pełny obraz
      u.uInk.value.set(1, 1, 1);
      u.uPrint.value = eOutExpo(seg(t, tb + 0.05, tb + 0.45));
      const mis = 1 - seg(t, tb - 0.1, tb + 0.35);
      u.uOffC.value.set(-22 * mis, 0); u.uOffM.value.set(22 * mis, 6 * mis); u.uOffY.value.set(0, -20 * mis);
      u.uOpacity.value = 1 - seg(t, bt(38.4), bt(39.2));
      // podświetlenie płyty, na którą patrzy oko
      const look = B >= 33 && B < 36.4 && Math.min(3, Math.floor((B - 33) / 0.5)) === p.i ? 1 : 0;
      u.uBright.value = 1 + 0.12 * look;
      u.uBorder.value.set(...p.d.rgb, 0.8 * pulse(t, tb, 0.25) + 0.5 * look * (1 - ex));
      // błysk i iskry farby przy uderzeniu
      const flash = pulse(t, tb, 0.12);
      if (flash > 0.01) {
        add.save();
        add.globalCompositeOperation = 'lighter';
        add.globalAlpha = 0.5 * flash;
        add.fillStyle = p.d.ink;
        add.fillRect(PLATES.x - 10, plateY(p.i) + PLATES.h / 2 - 3, PLATES.w + 20, 6);
        add.restore();
      }
      sparks(add, t, tb, PLATES.x + (p.i % 2 ? PLATES.w : 0), plateY(p.i) + PLATES.h / 2, 14, { seed: p.i * 5 + 1, speed: 800, life: 0.4, cols: [p.d.ink, WHITE] });
      fx.shakeY += 14 * decay(t, tb, 0.08) * Math.sin(t * 90);
      fx.zoom *= 1 + 0.012 * pulse(t, tb, 0.1);
    }
    S.pages3d.push({ scene, camera: cam });

    // ---- nagłówek "CENNIK." z kropką zmieniającą farbę co beat
    const g = L.back.g;
    const hIn = eOutExpo(seg(t, bt(30.25), bt(30.8))), hOut = eInExpo(seg(t, bt(38), bt(38.4)));
    if (hIn > 0 && hOut < 1) {
      g.save();
      g.globalAlpha = 1 - hOut;
      g.translate(-120 * (1 - hIn) - 300 * hOut, 0);
      text(g, 'CENNIK', 66, 470, { weight: 700, size: 124, spacing: -2.5, color: WHITE, alpha: hIn });
      setFont(g, 700, 124, -2.5);
      const dw = g.measureText('CENNIK').width;
      const dotCol = [C, M, Y, WHITE][Math.max(0, Math.floor(B - 30)) % 4];
      g.fillStyle = dotCol; g.globalAlpha = hIn * (1 - hOut);
      g.fillRect(66 + dw + 4, 448, 22, 22);
      text(g, 'CENY NETTO · FAKTURA LUB UMOWA', 70, 540, { weight: 500, size: 24, spacing: 4, color: GREY, alpha: hIn });
      g.restore();
    }
  },
};
