// Orkiestracja: czas → aktywne sceny → warstwy 2D + 3D + tło → pipeline.
import { W, H, BEAT, DUR, bt, canvas2d, clamp, seg, decay, pulse, hash, eInExpo, eOutExpo } from './core.js';
import { Pipeline } from './gfx.js';
import { drawHud, ENV } from './common.js';
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

const BG0 = { mode: 0, a0: [0, 0, 0, 0], a1: [0, 0, 0, 0] };
function state(t) {
  return {
    t, B: t / BEAT, bgs: [], list3d: [],
    bgA: BG0, bgB: BG0, bgMix: 0,
    fx: {
      zoom: 1, rot: 0, shakeX: 0, shakeY: 0, focusX: W / 2, focusY: H / 2,
      aberr: 0, aberrDX: 1, aberrDY: 0.45, ripple: 0, rippleR: 0, rippleX: W / 2, rippleY: H / 2,
      glitch: 0, glitchSeed: 0, glitch3d: 0, bloom: 0.8, bloomThresh: 0.45, bloomW: [0.5, 0.0, 0.3, 1.0], flash: 0, flashCol: [1, 1, 1], fade: 0, vignette: 1,
      tone3d: 0, exposure: 1.1,
    },
  };
}

// globalne akcenty na stopach (poza breakdownem i końcówką)
function beatFx(S) {
  const t = S.t, fx = S.fx;
  const b = Math.floor(S.B);
  let p = 0;
  for (let k = b - 1; k <= b; k++) {
    if (k < 0 || (k >= 40 && k < 48) || k >= 61) continue;
    p += pulse(t, bt(k), 0.11);
  }
  fx.zoom *= 1 + 0.012 * p;
  fx.aberr += 3.5 * p;
}

function resolveBG(S) {
  const list = S.bgs.filter(e => e.w > 0.001).sort((a, b) => b.w - a.w);
  if (!list.length) return;
  S.bgA = list[0];
  if (list.length > 1) {
    S.bgB = list[1];
    S.bgMix = list[1].w / (list[0].w + list[1].w);
  }
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
  drawHud(layers.hud.g, S);
  resolveBG(S);
  P.renderSub(S, layers, weight, acc);
}

// nagrywanie: klatka f przy fps, z sub subklatkami w oknie migawki (shutter = ułamek klatki)
window.renderFrame = (f, fps = 60, sub = 4, shutter = 0.5) => {
  P.clearAcc();
  for (let s = 0; s < sub; s++) {
    const off = sub === 1 ? 0 : ((s + 0.5) / sub - 0.5) * shutter;
    renderSub(clamp((f + off) / fps, 0, DUR - 1e-4), 1 / sub, true);
  }
  P.output(0.032, f % 997);
};
window.renderAt = t => { P.clearAcc(); renderSub(t, 1, true); P.output(0.032, 1); };

const params = new URLSearchParams(location.search);
(async () => {
  await Promise.all([
    document.fonts.load('700 120px "Space Grotesk"', 'ĘĄĆŁŃÓŚŹŻ'),
    document.fonts.load('500 30px "Space Grotesk"', 'ĘĄĆŁŃÓŚŹŻ'),
    document.fonts.load('300 30px "Space Grotesk"', 'ĘĄĆŁŃÓŚŹŻ'),
  ]);
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
