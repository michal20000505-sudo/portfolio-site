// Orkiestracja: czas → aktywne sceny → warstwy 2D + 3D (strony, oko) + tło → pipeline.
import { W, H, BEAT, DUR, canvas2d, clamp } from './core.js';
import { Pipeline, LAYERS2D } from './gfx.js';
import { ENV, loadAssets } from './common.js';
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

function state(t) {
  return {
    t, B: t / BEAT, pages3d: [], eye3d: [],
    // poświaty strony: cyjan (lewy górny róg), magenta (prawy dół), żółć (środek, słabiej) — [x, y, promień, siła]
    glows: [[-60, -120, 1150, 0.15], [1180, 1560, 1150, 0.15], [560, 940, 800, 0.07]],
    fx: {
      zoom: 1, rot: 0, shakeX: 0, shakeY: 0, focusX: W / 2, focusY: H / 2,
      aberr: 0, ripple: 0, rippleR: 0, rippleX: W / 2, rippleY: H / 2, glitch: 0, glitchSeed: 0,
      // wagi bloomu: tło, back, strony, mid, oko, front, add
      bloom: 0.55, bloomThresh: 0.6, bloomW: [0.5, 0.45, 0.3, 0.8, 0.55, 0.3, 1.0], bloomTint: [1, 1, 1],
      flash: 0, flashCol: [1, 1, 1], fade: 0, vignette: 1, exposure: 1.08,
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
    g.clearRect(0, 0, W, H);
  }
  for (const sc of SCENES) {
    if (S.B >= sc.b0 - (sc.pre || 0) && S.B < sc.b1 + (sc.post || 0)) sc.frame(S, layers);
  }
  P.renderSub(S, layers, weight, acc);
}

// nagrywanie: klatka f przy fps, z sub subklatkami w oknie migawki (shutter = ułamek klatki)
window.renderFrame = (f, fps = 60, sub = 6, shutter = 0.5) => {
  P.clearAcc();
  for (let s = 0; s < sub; s++) {
    const off = sub === 1 ? 0 : ((s + 0.5) / sub - 0.5) * shutter;
    renderSub(clamp((f + off) / fps, 0, DUR - 1e-4), 1 / sub, true);
  }
  P.output(0.03, f % 997);
};
window.renderAt = t => { P.clearAcc(); renderSub(t, 1, true); P.output(0.03, 1); };

const params = new URLSearchParams(location.search);
(async () => {
  await Promise.all([300, 400, 500, 600, 700].map(w => document.fonts.load(`${w} 60px "Space Grotesk"`, 'ĘĄĆŁŃÓŚŹŻęąćłńóśźż')));
  await loadAssets();
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
      P.output(0.03, n++);
      if (!audio.ended) requestAnimationFrame(loop); else document.body.classList.remove('playing');
    };
    requestAnimationFrame(loop);
  };
})();
