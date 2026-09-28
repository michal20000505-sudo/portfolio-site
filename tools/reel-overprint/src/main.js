// Orkiestracja: czas → aktywne sceny → warstwy 2D (z klatkami gry) → pipeline.
import { W, H, BEAT, DUR, canvas2d, clamp, BLACK } from './core.js';
import { Pipeline, LAYERS2D } from './gfx.js';
import { loadAssets } from './common.js';
import { SCENES } from './scenes/index.js';

const canvas = document.getElementById('c');
const P = new Pipeline(canvas);
const layers = {};
for (const k of LAYERS2D) {
  const [c, g] = canvas2d();
  layers[k] = { c, g, tex: P.mkTex(c) };
}

function state(t) {
  return {
    t, B: t / BEAT, base: BLACK,
    fx: {
      zoom: 1, rot: 0, shakeX: 0, shakeY: 0, focusX: W / 2, focusY: H / 2, aberr: 0, stretchX: 0, stretchY: 0, mis: 0, misRot: 0,
      // wagi bloomu: back, game, mid, front, add
      bloom: .45, bloomThresh: .86, bloomW: [.5, .35, .6, .6, 1],
      flash: 0, flashCol: [1, 1, 1], fade: 0, fadeCol: [.02, .02, .02], vignette: .6,
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
  for (const sc of SCENES) {
    if (S.B >= sc.b0 - (sc.pre || 0) && S.B < sc.b1 + (sc.post || 0)) sc.frame(S, layers);
  }
  P.renderSub(S, layers, weight, acc);
}

window.renderFrame = (f, fps = 60, sub = 6, shutter = .5) => {
  P.clearAcc();
  for (let s = 0; s < sub; s++) {
    const off = sub === 1 ? 0 : ((s + .5) / sub - .5) * shutter;
    renderSub(clamp((f + off) / fps, 0, DUR - 1e-4), 1 / sub, true);
  }
  P.output(.028, f % 997);
};
window.renderAt = t => { P.clearAcc(); renderSub(t, 1, true); P.output(.028, 1); };

const params = new URLSearchParams(location.search);
(async () => {
  await Promise.all([300, 400, 500, 700].map(w => document.fonts.load(`${w} 60px "Space Grotesk"`, 'ĘĄĆŁŃÓŚŹŻęąćłńóśźż')));
  await loadAssets();
  for (const sc of SCENES) if (sc.load) await sc.load();
  if (params.has('record')) { document.body.classList.add('rec'); window.ready = true; return; }
  window.renderAt(params.has('t') ? parseFloat(params.get('t')) : 0);
  window.ready = true;
  const audio = document.getElementById('music');
  document.getElementById('play').onclick = () => {
    document.body.classList.add('playing');
    audio.currentTime = params.has('t') ? parseFloat(params.get('t')) : 0;
    audio.play();
    let n = 0;
    const loop = () => {
      renderSub(audio.currentTime, 1, false);
      P.output(.028, n++);
      if (!audio.ended) requestAnimationFrame(loop); else document.body.classList.remove('playing');
    };
    requestAnimationFrame(loop);
  };
})();
