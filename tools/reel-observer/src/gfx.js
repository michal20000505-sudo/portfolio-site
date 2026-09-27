// Pipeline WebGL: tło (czerń + trzy poświaty CMY jak na stronie) → 2D "back" → 3D strony/karty → 2D "mid" (snop światła)
// → oko OBSERVER 01 (3D, ACES jak w eye-observer.js) → 2D "front" → 2D "add" (screen)
// → kamera/fala/glitch/aberracja CMY → bloom (dual Kawase) → HUD, błysk, winieta → akumulacja (motion blur) → ziarno.
import * as THREE from 'three';
import { W, H } from './core.js';

const VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */`
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;

// ------------------------------------------------------------------ TŁO: trzy poświaty (cyjan, magenta, żółć) jak .ambient-glow strony
const BG_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec3 uBase;
uniform vec4 uG0, uG1, uG2;          // x, y (px od góry), promień, siła
uniform vec3 uC0, uC1, uC2;
${COMMON}
float glow(vec2 frag, vec4 g) {
  float d = length(frag - g.xy) / g.z;
  return g.w * smoothstep(1.0, 0.0, d) * smoothstep(1.0, 0.0, d);
}
void main() {
  vec2 frag = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec3 col = uBase;
  col += uC0 * glow(frag, uG0) + uC1 * glow(frag, uG1) + uC2 * glow(frag, uG2);
  col += (hash21(frag + 7.1) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ KOMPOZYCJA (wspólna dla obrazu i źródła bloomu)
const COMP = /* glsl */`
uniform sampler2D tBG, tBack, tPages, tMid, tEye, tFront, tAdd;
uniform float uExposure;
vec3 lin2srgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
// ACESFilmicToneMapping z three.js r160 (to samo, co renderer oka na stronie, ekspozycja 1.08)
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 acesThree(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
// w: wagi warstw (tło, back, strony, mid, oko, front, add) — 1 dla obrazu, mniej dla źródła bloomu
vec3 composite(vec2 uv, float w0, float w1, float w2, float w3, float w4, float w5, float w6) {
  vec3 col = texture2D(tBG, uv).rgb * w0;
  vec4 b = texture2D(tBack, uv);
  col = col * (1.0 - b.a) + b.rgb * b.a * w1;
  vec4 p = texture2D(tPages, uv);
  if (p.a > 0.0005) col = col * (1.0 - p.a) + lin2srgb(clamp(p.rgb / p.a, 0.0, 1.0)) * p.a * w2;
  vec4 m = texture2D(tMid, uv);
  col = col * (1.0 - m.a) + m.rgb * m.a * w3;
  vec4 e = texture2D(tEye, uv);
  if (e.a > 0.0005) col = col * (1.0 - e.a) + lin2srgb(acesThree(e.rgb / e.a)) * e.a * w4;
  vec4 f = texture2D(tFront, uv);
  col = col * (1.0 - f.a) + f.rgb * f.a * w5;
  vec4 a = texture2D(tAdd, uv);
  col = 1.0 - (1.0 - col) * (1.0 - a.rgb * a.a * w6);
  return col;
}`;
const COMP_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
${COMP}
void main() { gl_FragColor = vec4(composite(vUv, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0), 1.0); }`;

// ------------------------------------------------------------------ FX: kamera, fala, glitch, aberracja w farbach CMY
const FX_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tComp;
uniform vec2 uRes;
uniform float uZoom, uRot;
uniform vec2 uShake, uFocus;
uniform float uAberr;
uniform float uRipple, uRippleR;
uniform vec2 uRippleC;
uniform float uGlitch, uGlitchSeed;
${COMMON}
// obraz rozłożony na "farby" C, M, Y (baza liniowa: przy zerowym przesunięciu składa się dokładnie w oryginał)
vec3 inkC(vec3 c) { return vec3(0.0, 1.0, 1.0) * (c.g + c.b - c.r) * 0.5; }
vec3 inkM(vec3 c) { return vec3(1.0, 0.0, 1.0) * (c.r + c.b - c.g) * 0.5; }
vec3 inkY(vec3 c) { return vec3(1.0, 1.0, 0.0) * (c.r + c.g - c.b) * 0.5; }
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  if (uRipple > 0.001) {
    vec2 dp = px - uRippleC;
    float dist = length(dp);
    float k = exp(-pow((dist - uRippleR) / 90.0, 2.0)) * uRipple;
    px += dp / max(dist, 1.0) * k * 26.0;
  }
  if (uGlitch > 0.001) {
    float band = floor(px.y / 46.0);
    float r = hash21(vec2(band, uGlitchSeed));
    if (r < uGlitch * 0.7) px.x += (hash21(vec2(band * 1.7, uGlitchSeed + 3.1)) - 0.5) * 140.0 * uGlitch;
  }
  vec2 uv = px / uRes;
  vec2 radial = (uv - 0.5) * vec2(1.0, uRes.y / uRes.x);
  float a = 1.0 + uAberr;
  vec2 o = radial * a / uRes;
  vec3 c0 = texture2D(tComp, uv).rgb;
  vec3 col = c0;
  if (uAberr > 0.05) {
    vec3 cc = texture2D(tComp, uv + o * vec2(1.0, 0.35)).rgb;
    vec3 cm = texture2D(tComp, uv - o).rgb;
    vec3 cy = texture2D(tComp, uv + o * vec2(-0.2, 1.0)).rgb;
    col = max(inkC(cc) + inkM(cm) + inkY(cy), 0.0);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ BLOOM
const PRE_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec4 uW0;         // tło, back, strony, mid
uniform vec3 uW1;         // oko, front, add
uniform float uThresh;
uniform vec2 uRes, uShake, uFocus;
uniform float uZoom, uRot;
${COMP}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  vec3 col = composite(px / uRes, uW0.x, uW0.y, uW0.z, uW0.w, uW1.x, uW1.y, uW1.z);
  float l = max(col.r, max(col.g, col.b));
  gl_FragColor = vec4(col * smoothstep(uThresh, uThresh + 0.3, l), 1.0);
}`;
const DOWN_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uHalf;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - uHalf).rgb;
  s += texture2D(tSrc, vUv + uHalf).rgb;
  s += texture2D(tSrc, vUv + vec2(uHalf.x, -uHalf.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(uHalf.x, -uHalf.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;
const UP_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc, tAdd;
uniform vec2 uHalf;
void main() {
  vec2 h = uHalf;
  vec3 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`;

// ------------------------------------------------------------------ FINAŁ + AKUMULACJA + WYJŚCIE
const FINAL_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tFx, tBloom, tHud;
uniform float uBloom, uFlash, uFade, uVignette;
uniform vec3 uFlashCol, uBloomTint;
void main() {
  vec3 col = texture2D(tFx, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloomTint * uBloom;
  vec2 q = (vUv - 0.5) * vec2(1.0, 1.3);
  col *= mix(1.0, 1.0 - smoothstep(0.34, 0.98, length(q)) * 0.75, uVignette);
  vec4 h = texture2D(tHud, vUv);
  col = col * (1.0 - h.a) + h.rgb * h.a;
  col += uFlashCol * uFlash;
  col = mix(col, vec3(0.0196), uFade);
  gl_FragColor = vec4(col, 1.0);
}`;
const OUT_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uRes;
uniform float uGrain, uSeed;
${COMMON}
void main() {
  vec3 col = texture2D(tSrc, vUv).rgb;
  vec2 px = floor(vUv * uRes);
  float n = hash21(px + uSeed * 91.7) + hash21(px * 1.3 + uSeed * 17.3) - 1.0;
  col += n * uGrain * (0.3 + 0.7 * (1.0 - abs(dot(col, vec3(0.333)) - 0.5) * 2.0));
  col += (hash21(px * 0.71 + uSeed) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const LAYERS2D = ['back', 'mid', 'front', 'add', 'hud'];

export class Pipeline {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.autoClear = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.empty = new THREE.Scene();
    this.geo = new THREE.PlaneGeometry(2, 2);
    const HF = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    const MS = { type: THREE.HalfFloatType, samples: 4, depthBuffer: true };
    this.rtBG = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtPages = new THREE.WebGLRenderTarget(W, H, MS);
    this.rtEye = new THREE.WebGLRenderTarget(W, H, MS);
    this.rtComp = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtFx = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtFinal = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtAcc = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.down = [];
    this.up = [];
    let w = W, h = H;
    for (let i = 0; i < 6; i++) {
      w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
      this.down.push(new THREE.WebGLRenderTarget(w, h, HF));
      this.up.push(new THREE.WebGLRenderTarget(w, h, HF));
    }
    this.rtPre = new THREE.WebGLRenderTarget(W / 2, H / 2, HF);

    const mkTex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
    this.mkTex = mkTex;

    const res = new THREE.Vector2(W, H);
    const v4 = () => ({ value: new THREE.Vector4() }), v3 = (a = 0, b = 0, c = 0) => ({ value: new THREE.Vector3(a, b, c) });
    this.bg = this.pass(BG_FS, {
      uRes: { value: res }, uBase: v3(0.0196, 0.0196, 0.0196),
      uG0: v4(), uG1: v4(), uG2: v4(), uC0: v3(0, 1, 1), uC1: v3(1, 0, 1), uC2: v3(1, 1, 0),
    });
    const texU = () => ({
      tBG: { value: this.rtBG.texture }, tBack: { value: null }, tPages: { value: this.rtPages.texture }, tMid: { value: null },
      tEye: { value: this.rtEye.texture }, tFront: { value: null }, tAdd: { value: null }, uExposure: { value: 1.08 },
    });
    this.comp = this.pass(COMP_FS, texU());
    this.fx = this.pass(FX_FS, {
      tComp: { value: this.rtComp.texture }, uRes: { value: res }, uZoom: { value: 1 }, uRot: { value: 0 }, uShake: { value: new THREE.Vector2() },
      uFocus: { value: new THREE.Vector2(W / 2, H / 2) }, uAberr: { value: 0 },
      uRipple: { value: 0 }, uRippleR: { value: 0 }, uRippleC: { value: new THREE.Vector2(W / 2, H / 2) },
      uGlitch: { value: 0 }, uGlitchSeed: { value: 0 },
    });
    this.pre = this.pass(PRE_FS, {
      ...texU(), uW0: { value: new THREE.Vector4() }, uW1: { value: new THREE.Vector3() }, uThresh: { value: 0.5 },
      uRes: { value: res }, uShake: { value: new THREE.Vector2() }, uFocus: { value: new THREE.Vector2(W / 2, H / 2) }, uZoom: { value: 1 }, uRot: { value: 0 },
    });
    this.dn = this.pass(DOWN_FS, { tSrc: { value: null }, uHalf: { value: new THREE.Vector2() } });
    this.upP = this.pass(UP_FS, { tSrc: { value: null }, tAdd: { value: null }, uHalf: { value: new THREE.Vector2() } });
    this.fin = this.pass(FINAL_FS, {
      tFx: { value: this.rtFx.texture }, tBloom: { value: null }, tHud: { value: null },
      uBloom: { value: 0.6 }, uBloomTint: { value: new THREE.Vector3(1, 1, 1) }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Vector3(1, 1, 1) }, uFade: { value: 0 }, uVignette: { value: 1 },
    });
    this.acc = this.pass(FINAL_FS, null);
    this.accMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform float uWeight;
        void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }`,
      uniforms: { tSrc: { value: this.rtFinal.texture }, uWeight: { value: 0.25 } },
      depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.acc.mesh.material = this.accMat;
    this.out = this.pass(OUT_FS, { tSrc: { value: this.rtAcc.texture }, uRes: { value: res }, uGrain: { value: 0.03 }, uSeed: { value: 0 } });
  }

  pass(fs, uniforms) {
    const mat = uniforms ? new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false }) : null;
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return {
      u: uniforms, mesh, scene,
      run: target => { this.renderer.setRenderTarget(target); this.renderer.render(scene, this.cam); },
    };
  }

  render3D(target, list) {
    const r = this.renderer;
    r.setRenderTarget(target);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    for (const item of list) {
      r.clearDepth();
      if (item.before) item.before();
      r.render(item.scene, item.camera);
      if (item.after) item.after();
    }
    // render pustej sceny wymusza "resolve" bufora MSAA — inaczej zostaje obraz z poprzedniej klatki
    if (!list.length) r.render(this.empty, this.cam);
  }

  /** Jedna subklatka. S: stan z main.js (tło, warstwy, 3D, fx). */
  renderSub(S, layers, weight, accumulate) {
    const fx = S.fx;
    const b = this.bg.u;
    b.uG0.value.fromArray(S.glows[0]); b.uG1.value.fromArray(S.glows[1]); b.uG2.value.fromArray(S.glows[2]);
    this.bg.run(this.rtBG);
    this.render3D(this.rtPages, S.pages3d);
    this.render3D(this.rtEye, S.eye3d);
    for (const k of LAYERS2D) layers[k].tex.needsUpdate = true;
    for (const p of [this.comp.u, this.pre.u]) {
      p.tBack.value = layers.back.tex; p.tMid.value = layers.mid.tex; p.tFront.value = layers.front.tex; p.tAdd.value = layers.add.tex;
      p.uExposure.value = fx.exposure;
    }
    this.comp.run(this.rtComp);
    const f = this.fx.u;
    f.uZoom.value = fx.zoom; f.uRot.value = fx.rot; f.uShake.value.set(fx.shakeX, -fx.shakeY); f.uFocus.value.set(fx.focusX, H - fx.focusY);   // GL: oś Y w górę
    f.uAberr.value = fx.aberr;
    f.uRipple.value = fx.ripple; f.uRippleR.value = fx.rippleR; f.uRippleC.value.set(fx.rippleX, H - fx.rippleY);
    f.uGlitch.value = fx.glitch; f.uGlitchSeed.value = fx.glitchSeed;
    this.fx.run(this.rtFx);
    const pu = this.pre.u;
    pu.uW0.value.fromArray(fx.bloomW.slice(0, 4)); pu.uW1.value.fromArray(fx.bloomW.slice(4, 7)); pu.uThresh.value = fx.bloomThresh;
    pu.uZoom.value = fx.zoom; pu.uRot.value = fx.rot; pu.uShake.value.set(fx.shakeX, -fx.shakeY); pu.uFocus.value.set(fx.focusX, H - fx.focusY);
    this.pre.run(this.rtPre);
    let src = this.rtPre;
    for (let i = 0; i < this.down.length; i++) {
      this.dn.u.tSrc.value = src.texture;
      this.dn.u.uHalf.value.set(0.5 / src.width, 0.5 / src.height);
      this.dn.run(this.down[i]);
      src = this.down[i];
    }
    let lo = this.down[this.down.length - 1];
    for (let i = this.down.length - 2; i >= 0; i--) {
      this.upP.u.tSrc.value = lo.texture;
      this.upP.u.tAdd.value = this.down[i].texture;
      this.upP.u.uHalf.value.set(0.5 / lo.width, 0.5 / lo.height);
      this.upP.run(this.up[i]);
      lo = this.up[i];
    }
    const fi = this.fin.u;
    fi.tBloom.value = lo.texture; fi.tHud.value = layers.hud.tex;
    fi.uBloom.value = fx.bloom; fi.uBloomTint.value.fromArray(fx.bloomTint);
    fi.uFlash.value = fx.flash; fi.uFlashCol.value.fromArray(fx.flashCol); fi.uFade.value = fx.fade; fi.uVignette.value = fx.vignette;
    if (!accumulate) {
      this.fin.run(this.rtAcc);
      return;
    }
    this.fin.run(this.rtFinal);
    this.accMat.uniforms.uWeight.value = weight;
    this.acc.run(this.rtAcc);
  }

  clearAcc() {
    const r = this.renderer;
    r.setRenderTarget(this.rtAcc);
    r.setClearColor(0x000000, 1);
    r.clear(true, false, false);
  }

  output(grain, seed) {
    this.out.u.uGrain.value = grain;
    this.out.u.uSeed.value = seed;
    this.out.run(null);
  }
}
