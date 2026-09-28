// Pipeline WebGL: warstwy 2D (back → game → mid → front → add[screen]) → kamera, rozmycie kierunkowe,
// przesunięcie płyt C/M/Y (misregistration jak w druku) → bloom (dual Kawase) → HUD, błysk, zaciemnienie
// → akumulacja subklatek (motion blur) → ziarno.
import * as THREE from 'three';
import { W, H } from './core.js';

const VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */`
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;

const COMP = /* glsl */`
uniform sampler2D tBack, tGame, tMid, tFront, tAdd;
uniform vec3 uBase;
vec3 composite(vec2 uv, float wb, float wg, float wm, float wf, float wa) {
  vec3 col = uBase;
  vec4 b = texture2D(tBack, uv);  col = mix(col, b.rgb * wb, b.a);
  vec4 g = texture2D(tGame, uv);  col = mix(col, g.rgb * wg, g.a);
  vec4 m = texture2D(tMid, uv);   col = mix(col, m.rgb * wm, m.a);
  vec4 f = texture2D(tFront, uv); col = mix(col, f.rgb * wf, f.a);
  vec4 a = texture2D(tAdd, uv);
  col = 1.0 - (1.0 - col) * (1.0 - a.rgb * a.a * wa);
  return col;
}`;
const COMP_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
${COMP}
void main() { gl_FragColor = vec4(composite(vUv, 1.0, 1.0, 1.0, 1.0, 1.0), 1.0); }`;

const FX_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tComp;
uniform vec2 uRes, uShake, uFocus, uStretch;
uniform float uZoom, uRot, uAberr, uMis, uMisRot;
${COMMON}
vec3 samp(vec2 uv, vec2 o, vec2 mr, vec2 mg, vec2 mb) {
  // kanał R niesie farbę C, G → M, B → Y: przesunięcie kanału = przesunięcie płyty
  return vec3(texture2D(tComp, uv + o + mr).r, texture2D(tComp, uv + mg).g, texture2D(tComp, uv - o + mb).b);
}
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  vec2 uv = px / uRes;
  vec2 radial = (uv - 0.5) * vec2(1.0, uRes.y / uRes.x);
  vec2 o = radial * uAberr / uRes;
  vec2 mr = vec2(cos(uMisRot), sin(uMisRot)) * uMis / uRes;
  vec2 mg = vec2(cos(uMisRot + 2.094), sin(uMisRot + 2.094)) * uMis / uRes;
  vec2 mb = vec2(cos(uMisRot + 4.189), sin(uMisRot + 4.189)) * uMis / uRes;
  vec3 col;
  if (length(uStretch) > 0.5) {
    col = vec3(0.0);
    for (int i = 0; i < 24; i++) col += samp(uv + uStretch * (float(i) / 23.0 - 0.5) / uRes, o, mr, mg, mb);
    col /= 24.0;
  } else col = samp(uv, o, mr, mg, mb);
  gl_FragColor = vec4(col, 1.0);
}`;

const PRE_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec4 uW0; uniform float uW1;
uniform float uThresh, uZoom, uRot;
uniform vec2 uRes, uShake, uFocus;
${COMP}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  vec3 col = composite(px / uRes, uW0.x, uW0.y, uW0.z, uW0.w, uW1);
  float l = max(col.r, max(col.g, col.b));
  gl_FragColor = vec4(col * smoothstep(uThresh, uThresh + 0.25, l), 1.0);
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
const FINAL_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tFx, tBloom, tHud;
uniform float uBloom, uFlash, uFade, uVignette;
uniform vec3 uFlashCol, uFadeCol;
void main() {
  vec3 col = texture2D(tFx, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
  vec2 q = (vUv - 0.5) * vec2(1.0, 1.25);
  col *= mix(1.0, 1.0 - smoothstep(0.35, 0.95, length(q)) * 0.55, uVignette);
  vec4 h = texture2D(tHud, vUv);
  col = mix(col, h.rgb, h.a);
  col += uFlashCol * uFlash;
  col = mix(col, uFadeCol, uFade);
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

export const LAYERS2D = ['back', 'game', 'mid', 'front', 'add', 'hud'];
const hex3 = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

export class Pipeline {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.autoClear = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geo = new THREE.PlaneGeometry(2, 2);
    const HF = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtComp = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtFx = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtFinal = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtAcc = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.down = []; this.up = [];
    let w = W / 2, h = H / 2;
    this.rtPre = new THREE.WebGLRenderTarget(w, h, HF);
    for (let i = 0; i < 6; i++) {
      w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
      this.down.push(new THREE.WebGLRenderTarget(w, h, HF));
      this.up.push(new THREE.WebGLRenderTarget(w, h, HF));
    }
    this.mkTex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };

    const res = new THREE.Vector2(W, H);
    const v2 = () => ({ value: new THREE.Vector2() });
    const texU = () => ({ tBack: { value: null }, tGame: { value: null }, tMid: { value: null }, tFront: { value: null }, tAdd: { value: null }, uBase: { value: new THREE.Vector3() } });
    this.comp = this.pass(COMP_FS, texU());
    this.fx = this.pass(FX_FS, {
      tComp: { value: this.rtComp.texture }, uRes: { value: res }, uZoom: { value: 1 }, uRot: { value: 0 }, uShake: v2(), uFocus: v2(),
      uAberr: { value: 0 }, uStretch: v2(), uMis: { value: 0 }, uMisRot: { value: 0 },
    });
    this.pre = this.pass(PRE_FS, { ...texU(), uW0: { value: new THREE.Vector4() }, uW1: { value: 1 }, uThresh: { value: .8 }, uRes: { value: res }, uShake: v2(), uFocus: v2(), uZoom: { value: 1 }, uRot: { value: 0 } });
    this.dn = this.pass(DOWN_FS, { tSrc: { value: null }, uHalf: v2() });
    this.upP = this.pass(UP_FS, { tSrc: { value: null }, tAdd: { value: null }, uHalf: v2() });
    this.fin = this.pass(FINAL_FS, {
      tFx: { value: this.rtFx.texture }, tBloom: { value: null }, tHud: { value: null }, uBloom: { value: .5 },
      uFlash: { value: 0 }, uFlashCol: { value: new THREE.Vector3(1, 1, 1) }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Vector3() }, uVignette: { value: 1 },
    });
    this.acc = this.pass(FINAL_FS, null);
    this.accMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform float uWeight;
        void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }`,
      uniforms: { tSrc: { value: this.rtFinal.texture }, uWeight: { value: .25 } },
      depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.acc.mesh.material = this.accMat;
    this.out = this.pass(OUT_FS, { tSrc: { value: this.rtAcc.texture }, uRes: { value: res }, uGrain: { value: .03 }, uSeed: { value: 0 } });
  }

  pass(fs, uniforms) {
    const mat = uniforms ? new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false }) : null;
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return { u: uniforms, mesh, scene, run: target => { this.renderer.setRenderTarget(target); this.renderer.render(scene, this.cam); } };
  }

  renderSub(S, layers, weight, accumulate) {
    const fx = S.fx;
    for (const k of LAYERS2D) layers[k].tex.needsUpdate = true;
    for (const p of [this.comp.u, this.pre.u]) {
      p.tBack.value = layers.back.tex; p.tGame.value = layers.game.tex; p.tMid.value = layers.mid.tex; p.tFront.value = layers.front.tex; p.tAdd.value = layers.add.tex;
      p.uBase.value.fromArray(hex3(S.base));
    }
    this.comp.run(this.rtComp);
    const f = this.fx.u;
    f.uZoom.value = fx.zoom; f.uRot.value = fx.rot; f.uShake.value.set(fx.shakeX, -fx.shakeY); f.uFocus.value.set(fx.focusX, H - fx.focusY);
    f.uAberr.value = fx.aberr; f.uStretch.value.set(fx.stretchX, -fx.stretchY); f.uMis.value = fx.mis; f.uMisRot.value = fx.misRot;
    this.fx.run(this.rtFx);
    const pu = this.pre.u;
    pu.uW0.value.fromArray(fx.bloomW.slice(0, 4)); pu.uW1.value = fx.bloomW[4]; pu.uThresh.value = fx.bloomThresh;
    pu.uZoom.value = fx.zoom; pu.uRot.value = fx.rot; pu.uShake.value.set(fx.shakeX, -fx.shakeY); pu.uFocus.value.set(fx.focusX, H - fx.focusY);
    this.pre.run(this.rtPre);
    let src = this.rtPre;
    for (const d of this.down) {
      this.dn.u.tSrc.value = src.texture; this.dn.u.uHalf.value.set(.5 / src.width, .5 / src.height);
      this.dn.run(d); src = d;
    }
    let lo = this.down[this.down.length - 1];
    for (let i = this.down.length - 2; i >= 0; i--) {
      this.upP.u.tSrc.value = lo.texture; this.upP.u.tAdd.value = this.down[i].texture;
      this.upP.u.uHalf.value.set(.5 / lo.width, .5 / lo.height);
      this.upP.run(this.up[i]); lo = this.up[i];
    }
    const fi = this.fin.u;
    fi.tBloom.value = lo.texture; fi.tHud.value = layers.hud.tex; fi.uBloom.value = fx.bloom;
    fi.uFlash.value = fx.flash; fi.uFlashCol.value.fromArray(fx.flashCol); fi.uFade.value = fx.fade; fi.uFadeCol.value.fromArray(fx.fadeCol); fi.uVignette.value = fx.vignette;
    if (!accumulate) { this.fin.run(this.rtAcc); return; }
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
    this.out.u.uGrain.value = grain; this.out.u.uSeed.value = seed;
    this.out.run(null);
  }
}
