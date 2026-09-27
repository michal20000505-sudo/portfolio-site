// Orkiestracja: czas → aktywne sceny → warstwy 2D + 3D (panele, koło) + tło → pipeline.
import { W, H, BEAT, DUR, canvas2d, clamp } from './core.js';
import { Pipeline, LAYERS2D } from './gfx.js';
import { ENV, loadAssets, PanelLayer } from './common.js';
import { WheelRig } from './wheel.js';
import { SCENES } from './scenes/index.js';

const canvas = document.getElementById('c');
const P = new Pipeline(canvas);
ENV.renderer = P.renderer;
ENV.pipeline = P;
const layers = {};
for (const k of LAYERS2D) {
  const [c, g] = canvas2d();
  layers[k] = { c, g, tex: P.mkTex(c) };
}
const UI = ENV.ui = new PanelLayer();
const UI2 = ENV.uiTop = new PanelLayer();

function state(t) {
  return {
    t, B: t / BEAT, ui3d: [], wheel3d: [], ui3dTop: [],
    bg: {
      // poświaty: [x, y, promień, siła]; siatka: [przesunięcie x, y, oczko, siła]; tło laboratorium: [x, y, promień, siła]
      glows: [[540, 700, 900, 0.0], [540, 1400, 900, 0.0]], grid: [0, 0, 54, 0.028], gridZoom: 1, lab: [540, 900, 1200, 0],
    },
    fx: {
      zoom: 1, rot: 0, shakeX: 0, shakeY: 0, focusX: W / 2, focusY: H / 2, aberr: 0, stretchX: 0, stretchY: 0,
      // wagi bloomu: tło, back, UI, mid, koło, UI nad kołem, front, add
      bloom: 0.5, bloomThresh: 0.62, bloomW: [0.6, 0.5, 0.35, 0.8, 0.45, 0.35, 0.4, 1.0], bloomTint: [1, 0.92, 0.9],
      flash: 0, flashCol: [1, 1, 1], fade: 0, vignette: 1,
    },
  };
}

function renderSub(t, weight, acc) {
  const S = state(t);
  for (const L of Object.values(layers)) {
    const g = L.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
    g.shadowBlur = 0; g.shadowColor = 'transparent';
    g.clearRect(0, 0, W, H);
  }
  UI.hideAll(); UI2.hideAll();
  for (const sc of SCENES) {
    if (S.B >= sc.b0 - (sc.pre || 0) && S.B < sc.b1 + (sc.post || 0)) sc.frame(S, layers);
  }
  const ui = UI.item();
  if (ui) S.ui3d.push(ui);
  const ui2 = UI2.item();
  if (ui2) S.ui3dTop.push(ui2);
  P.renderSub(S, layers, weight, acc);
}

// nagrywanie: klatka f przy fps, z sub subklatkami w oknie migawki (shutter = ułamek klatki)
window.renderFrame = (f, fps = 60, sub = 6, shutter = 0.5) => {
  P.clearAcc();
  for (let s = 0; s < sub; s++) {
    const off = sub === 1 ? 0 : ((s + 0.5) / sub - 0.5) * shutter;
    renderSub(clamp((f + off) / fps, 0, DUR - 1e-4), 1 / sub, true);
  }
  P.output(0.028, f % 997);
};
window.renderAt = t => { P.clearAcc(); renderSub(t, 1, true); P.output(0.028, 1); };

const params = new URLSearchParams(location.search);
(async () => {
  const PL = 'ĘĄĆŁŃÓŚŹŻęąćłńóśźż';
  await Promise.all([
    ...[500, 600, 700, 800, 900].map(w => document.fonts.load(`${w} 60px "Barlow Condensed"`, PL)),
    ...[700, 800, 900].map(w => document.fonts.load(`italic ${w} 60px "Barlow Condensed"`, PL)),
    ...[400, 500, 600, 700].map(w => document.fonts.load(`${w} 60px "Barlow"`, PL)),
  ]);
  await loadAssets();
  ENV.rig = new WheelRig(P.renderer);
  for (const sc of SCENES) if (sc.load) await sc.load();
  if (params.has('record')) { document.body.classList.add('rec'); window.ready = true; return; }
  const t0 = params.has('t') ? parseFloat(params.get('t')) : 0;
  window.renderAt(t0);
  window.ready = true;
  const audio = document.getElementById('music');
  const btn = document.getElementById('play');
  btn.onclick = () => {
    document.body.classList.add('playing');
    audio.currentTime = 0;
    audio.play();
    let n = 0;
    const loop = () => {
      renderSub(audio.currentTime, 1, false);
      P.output(0.028, n++);
      if (!audio.ended) requestAnimationFrame(loop); else document.body.classList.remove('playing');
    };
    requestAnimationFrame(loop);
  };
})();
