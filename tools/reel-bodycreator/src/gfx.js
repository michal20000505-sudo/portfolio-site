// Pipeline WebGL: tło (zdjęcie / klatka wideo ze studia + złota poświata) → 2D "back" → 3D → 2D "front" → 2D "add" (screen)
// → kamera/fala/aberracja → bloom (dual Kawase) → HUD, błysk, winieta → akumulacja (motion blur) → wyjście z ziarnem.
import * as THREE from 'three';
import { W, H } from './core.js';

const VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */`
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;

// ------------------------------------------------------------------ TŁO
// dwa gniazda obrazu (zdjęcie albo klatka klipu), każde: [waga, zoom, fokus x, fokus y] + [jasność, nasycenie, proporcje obrazu, kontrast]
const BG_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform sampler2D tA, tB;
uniform vec4 uA0, uA1, uB0, uB1;
uniform vec4 uGlow;        // x, y (px od góry), promień, siła
uniform vec3 uGlowCol;
uniform vec3 uBase;
${COMMON}
vec3 plate(sampler2D t, vec4 a0, vec4 a1) {
  float fa = uRes.x / uRes.y, ia = a1.z;
  vec2 sc = fa > ia ? vec2(1.0, ia / fa) : vec2(fa / ia, 1.0);
  sc /= a0.y;
  vec2 c = vec2(a0.z, 1.0 - a0.w);
  c = clamp(c, sc * 0.5, 1.0 - sc * 0.5);
  vec3 col = texture2D(t, c + (vUv - 0.5) * sc).rgb;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, a1.y);
  col = (col - 0.5) * a1.w + 0.5;
  return max(col, 0.0) * a1.x;
}
void main() {
  vec3 col = uBase;
  if (uA0.x > 0.001) col = mix(col, plate(tA, uA0, uA1), uA0.x);
  if (uB0.x > 0.001) col = mix(col, plate(tB, uB0, uB1), uB0.x);
  vec2 frag = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float d = length((frag - uGlow.xy) * vec2(1.0, 0.8)) / uGlow.z;
  col += uGlowCol * uGlow.w * exp(-d * d * 2.2);
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ KOMPOZYCJA
const TONE = /* glsl */`
uniform float uTone3D, uExposure;
vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
vec3 lin2srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 tone3D(vec3 c) {
  // 0: wartości ekranowe, 1: liniowe → sRGB (telefon + karty; karty oddają sRGB→liniowe, więc wychodzą 1:1), 2: ACES
  if (uTone3D > 1.5) return lin2srgb(aces(c * uExposure));
  if (uTone3D > 0.5) return lin2srgb(clamp(c, 0.0, 1.0));
  return clamp(c, 0.0, 1.0);
}`;
const COMP_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tBG, tBack, t3D, tFront, tAdd;
${TONE}
void main() {
  vec3 col = texture2D(tBG, vUv).rgb;
  vec4 b = texture2D(tBack, vUv);
  col = col * (1.0 - b.a) + b.rgb * b.a;
  vec4 d = texture2D(t3D, vUv);
  if (d.a > 0.0005) {
    vec3 c = tone3D(d.rgb / d.a);
    col = col * (1.0 - d.a) + c * d.a;
  }
  vec4 f = texture2D(tFront, vUv);
  col = col * (1.0 - f.a) + f.rgb * f.a;
  vec4 ad = texture2D(tAdd, vUv);
  col = 1.0 - (1.0 - col) * (1.0 - ad.rgb * ad.a);
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ FX: kamera, fala uderzeniowa, aberracja
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
${COMMON}
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  if (uRipple > 0.001) {
    vec2 dp = px - uRippleC;
    float dist = length(dp);
    float k = exp(-pow((dist - uRippleR) / 80.0, 2.0)) * uRipple;
    px += dp / max(dist, 1.0) * k * 22.0;
  }
  vec2 uv = px / uRes;
  vec2 radial = (uv - 0.5) * vec2(1.0, uRes.y / uRes.x);
  vec2 o = radial * (1.2 + uAberr) / uRes;
  float r = texture2D(tComp, uv + o).r;
  float g = texture2D(tComp, uv).g;
  float b = texture2D(tComp, uv - o).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}`;

// ------------------------------------------------------------------ BLOOM
const PRE_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tBG, tBack, t3D, tFront, tAdd;
uniform vec4 uW;          // wagi świecenia: back, 3D, front, add (tło = uBgW)
uniform float uThresh, uBgW;
uniform vec2 uRes, uShake, uFocus;
uniform float uZoom, uRot;
${TONE}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  vec2 uv = px / uRes;
  vec3 col = texture2D(tBG, uv).rgb * uBgW;
  vec4 b = texture2D(tBack, uv);
  col = col * (1.0 - b.a) + b.rgb * b.a * uW.x;
  vec4 d = texture2D(t3D, uv);
  if (d.a > 0.0005) col = col * (1.0 - d.a) + tone3D(d.rgb / d.a) * d.a * uW.y;
  vec4 f = texture2D(tFront, uv);
  col = col * (1.0 - f.a) + f.rgb * f.a * uW.z;
  vec4 a = texture2D(tAdd, uv);
  col = 1.0 - (1.0 - col) * (1.0 - a.rgb * a.a * uW.w);
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
  col *= mix(1.0, 1.0 - smoothstep(0.32, 0.95, length(q)) * 0.8, uVignette);
  vec4 h = texture2D(tHud, vUv);
  col = col * (1.0 - h.a) + h.rgb * h.a;
  col += uFlashCol * uFlash;
  col = mix(col, vec3(0.0), uFade);
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
    this.rtBG = new THREE.WebGLRenderTarget(W, H, HF);
    this.rt3D = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
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
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;

    const res = new THREE.Vector2(W, H);
    this.bg = this.pass(BG_FS, {
      uRes: { value: res }, tA: { value: this.black }, tB: { value: this.black },
      uA0: { value: new THREE.Vector4() }, uA1: { value: new THREE.Vector4(1, 1, 1, 1) }, uB0: { value: new THREE.Vector4() }, uB1: { value: new THREE.Vector4(1, 1, 1, 1) },
      uGlow: { value: new THREE.Vector4(W / 2, -200, 900, 0) }, uGlowCol: { value: new THREE.Vector3(0.96, 0.79, 0.0) }, uBase: { value: new THREE.Vector3(0.039, 0.039, 0.039) },
    });
    this.comp = this.pass(COMP_FS, {
      tBG: { value: this.rtBG.texture }, tBack: { value: null }, t3D: { value: this.rt3D.texture }, tFront: { value: null }, tAdd: { value: null },
      uTone3D: { value: 1 }, uExposure: { value: 1 },
    });
    this.fx = this.pass(FX_FS, {
      tComp: { value: this.rtComp.texture }, uRes: { value: res }, uZoom: { value: 1 }, uRot: { value: 0 }, uShake: { value: new THREE.Vector2() },
      uFocus: { value: new THREE.Vector2(W / 2, H / 2) }, uAberr: { value: 0 },
      uRipple: { value: 0 }, uRippleR: { value: 0 }, uRippleC: { value: new THREE.Vector2(W / 2, H / 2) },
    });
    this.pre = this.pass(PRE_FS, {
      tBG: { value: this.rtBG.texture }, tBack: { value: null }, t3D: { value: this.rt3D.texture }, tFront: { value: null }, tAdd: { value: null },
      uW: { value: new THREE.Vector4(0.5, 0.5, 0.6, 1) }, uThresh: { value: 0.5 }, uBgW: { value: 1 }, uTone3D: { value: 1 }, uExposure: { value: 1 },
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

  /** Jedna subklatka. S: stan z main.js (tło, warstwy, 3D, fx). */
  renderSub(S, layers, weight, accumulate) {
    const r = this.renderer;
    const fx = S.fx;
    // tło
    const b = this.bg.u;
    const slot = (e, t, a0, a1) => {
      if (!e) { a0.value.set(0, 1, 0.5, 0.5); return; }
      t.value = e.tex;
      a0.value.set(e.w, e.zoom ?? 1, e.fx ?? 0.5, e.fy ?? 0.5);
      a1.value.set(e.bright ?? 1, e.sat ?? 1, e.aspect, e.contrast ?? 1);
    };
    slot(S.bgA, b.tA, b.uA0, b.uA1);
    slot(S.bgB, b.tB, b.uB0, b.uB1);
    b.uGlow.value.set(fx.glowX, fx.glowY, fx.glowR, fx.glow);
    this.bg.run(this.rtBG);
    // 3D
    r.setRenderTarget(this.rt3D);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    for (const item of S.list3d) {
      r.clearDepth();
      r.render(item.scene, item.camera);
    }
    // render pustej sceny wymusza "resolve" bufora MSAA — inaczej zostaje obraz z poprzedniej klatki
    if (!S.list3d.length) r.render(this.empty, this.cam);
    // warstwy 2D
    for (const k of ['back', 'front', 'add', 'hud']) layers[k].tex.needsUpdate = true;
    const c = this.comp.u;
    c.tBack.value = layers.back.tex; c.tFront.value = layers.front.tex; c.tAdd.value = layers.add.tex;
    c.uTone3D.value = fx.tone3d; c.uExposure.value = fx.exposure;
    this.comp.run(this.rtComp);
    // fx
    const f = this.fx.u;
    f.uZoom.value = fx.zoom; f.uRot.value = fx.rot; f.uShake.value.set(fx.shakeX, -fx.shakeY); f.uFocus.value.set(fx.focusX, H - fx.focusY);   // GL: oś Y w górę
    f.uAberr.value = fx.aberr;
    f.uRipple.value = fx.ripple; f.uRippleR.value = fx.rippleR; f.uRippleC.value.set(fx.rippleX, H - fx.rippleY);
    this.fx.run(this.rtFx);
    // bloom
    const pu = this.pre.u;
    pu.tBack.value = layers.back.tex; pu.tFront.value = layers.front.tex; pu.tAdd.value = layers.add.tex;
    pu.uW.value.fromArray(fx.bloomW); pu.uThresh.value = fx.bloomThresh; pu.uBgW.value = fx.bloomBg;
    pu.uTone3D.value = fx.tone3d; pu.uExposure.value = fx.exposure;
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
