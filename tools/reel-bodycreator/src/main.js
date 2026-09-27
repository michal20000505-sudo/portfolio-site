// Orkiestracja: czas → aktywne sceny → warstwy 2D + 3D + tło → pipeline.
import { W, H, BEAT, DUR, bt, canvas2d, clamp, pulse, sceneBeat } from './core.js';
import { Pipeline } from './gfx.js';
import { ENV } from './common.js';
import { SCENES, loadScenes } from './scenes/index.js';

const canvas = document.getElementById('c');
const P = new Pipeline(canvas);
ENV.renderer = P.renderer;
ENV.pipeline = P;
const layers = {};
for (const k of ['back', 'front', 'add', 'hud']) {
  const [c, g] = canvas2d();
  layers[k] = { c, g, tex: P.mkTex(c) };
}

// tr: czas rzeczywisty (muzyka, pył, unoszenie się), t/B: czas sceny (zwalnia w przytrzymaniach)
function state(tr) {
  const B = sceneBeat(tr / BEAT);
  return {
    t: bt(B), B, tr, Br: tr / BEAT, bgs: [], list3d: [],
    bgA: null, bgB: null,
    fx: {
      zoom: 1, rot: 0, shakeX: 0, shakeY: 0, focusX: W / 2, focusY: H / 2,
      aberr: 0, ripple: 0, rippleR: 0, rippleX: W / 2, rippleY: H / 2,
      bloom: 0.5, bloomThresh: 0.62, bloomW: [0.4, 0.3, 0.32, 1.0], bloomBg: 0.6, bloomTint: [1, 0.9, 0.72],
      flash: 0, flashCol: [1, 1, 1], fade: 0, vignette: 1,
      glow: 0, glowX: W / 2, glowY: -150, glowR: 1000,
      tone3d: 1, exposure: 1,
    },
  };
}

// pchnięcia kamery na stopach w groove (B2–B7.5, B8–B11)
function beatFx(S) {
  // stopy grają na siatce rzeczywistej, tylko w odcinkach groove (sceny B2–B7.5 i B8–B11)
  const t = S.tr, fx = S.fx;
  const b = Math.floor(S.Br);
  let p = 0;
  for (let k = b - 1; k <= b; k++) {
    const sb = sceneBeat(k);
    if (sb < 2 || (sb > 7.2 && sb < 9) || sb > 11) continue;
    p += pulse(t, bt(k), 0.1);
  }
  fx.zoom *= 1 + 0.006 * p;
}

function resolveBG(S) {
  const list = S.bgs.filter(e => e.w > 0.001).sort((a, b) => b.w - a.w);
  S.bgA = list[0] || null;
  S.bgB = list[1] || null;
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
  beatFx(S);
  for (const sc of SCENES) {
    if (S.B >= sc.b0 - (sc.pre || 0) && S.B < sc.b1 + (sc.post || 0)) sc.frame(S, layers);
  }
  resolveBG(S);
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
  await Promise.all([400, 500, 600, 700, 800, 900].map(w => document.fonts.load(`${w} 60px Inter`, 'ĘĄĆŁŃÓŚŹŻęąćłńóśźż')));
  await loadScenes();
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
