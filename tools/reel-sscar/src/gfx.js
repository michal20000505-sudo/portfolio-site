// Pipeline WebGL: tło (czerń strony + siatka + czerwona poświata jak w hero sscar.pl, tło laboratorium)
// → 2D "back" → 3D interfejsu (panele, zdjęcia) → 2D "mid" → koło z laboratorium geometrii (3D)
// → 2D "front" → 2D "add" (screen) → kamera, aberracja → bloom (dual Kawase) → HUD, błysk, winieta
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

// ------------------------------------------------------------------ TŁO
const BG_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec3 uBase, uGlowCol;
uniform vec4 uG0, uG1;             // poświaty: x, y (px od góry), promień, siła
uniform vec4 uGrid;                // przesunięcie x, y (px), rozmiar oczka, siła
uniform float uGridZoom;
uniform vec4 uLab;                 // tło laboratorium: x, y, promień, siła (gradient #2d3038 → #0c0d10 ze strony)
uniform float uBeam;               // pozioma smuga za nagłówkiem
${COMMON}
float glow(vec2 frag, vec4 g) {
  float d = length((frag - g.xy) * vec2(1.0, 0.8)) / g.z;
  return g.w * exp(-d * d * 2.2);
}
void main() {
  vec2 frag = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec3 col = uBase;
  // siatka strony (body::before: cienkie linie co 40 px) — tu co uGrid.z, zanikająca ku brzegom
  vec2 gp = (frag - uRes * 0.5) / uGridZoom + uRes * 0.5 + uGrid.xy;
  vec2 gcell = abs(fract(gp / uGrid.z + 0.5) - 0.5) * uGrid.z;
  float line = 1.0 - smoothstep(0.35, 1.2, min(gcell.x, gcell.y) * uGridZoom);
  float fadeG = smoothstep(1.25, 0.2, length((frag - uRes * 0.5) / uRes.x));
  col += vec3(1.0, 0.94, 0.93) * line * uGrid.w * fadeG;
  col += uGlowCol * (glow(frag, uG0) + glow(frag, uG1));
  if (uLab.w > 0.0) {
    float d = length(frag - uLab.xy) / uLab.z;
    vec3 lab = mix(vec3(0.176, 0.188, 0.220), vec3(0.090, 0.098, 0.122), smoothstep(0.0, 0.48, d));
    lab = mix(lab, vec3(0.047, 0.051, 0.063), smoothstep(0.48, 1.0, d));
    float m = uLab.w * (1.0 - smoothstep(0.75, 1.35, d));
    col = mix(col, lab, m);
  }
  col += (hash21(frag + 7.1) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ KOMPOZYCJA (obraz i źródło bloomu); wszystko w wartościach ekranowych
const COMP = /* glsl */`
uniform sampler2D tBG, tBack, tUI, tMid, tWheel, tUI2, tFront, tAdd;
vec3 composite(vec2 uv, float w0, float w1, float w2, float w3, float w4, float w7, float w5, float w6) {
  vec3 col = texture2D(tBG, uv).rgb * w0;
  vec4 b = texture2D(tBack, uv);
  col = col * (1.0 - b.a) + b.rgb * b.a * w1;
  vec4 p = texture2D(tUI, uv);                   // mnożone alfa (render 3D)
  col = col * (1.0 - p.a) + p.rgb * w2;
  vec4 m = texture2D(tMid, uv);
  col = col * (1.0 - m.a) + m.rgb * m.a * w3;
  vec4 e = texture2D(tWheel, uv);
  col = col * (1.0 - e.a) + e.rgb * w4;
  vec4 q = texture2D(tUI2, uv);                  // panele nad kołem
  col = col * (1.0 - q.a) + q.rgb * w7;
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
void main() { gl_FragColor = vec4(composite(vUv, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0), 1.0); }`;

// ------------------------------------------------------------------ FX: kamera + aberracja chromatyczna (radialna, RGB)
const FX_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tComp;
uniform vec2 uRes;
uniform float uZoom, uRot;
uniform vec2 uShake, uFocus;
uniform float uAberr;
uniform vec2 uStretch;                // rozmycie kierunkowe (przejścia typu whip pan), px
${COMMON}
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  vec2 uv = px / uRes;
  vec2 radial = (uv - 0.5) * vec2(1.0, uRes.y / uRes.x);
  vec2 o = radial * uAberr / uRes;
  bool ab = uAberr > 0.05;
  vec3 col;
  if (length(uStretch) > 0.5) {
    // rozmycie kierunkowe (whip pan); aberracja liczona dla każdej próbki, żeby kanały rozmywały się razem
    col = vec3(0.0);
    for (int i = 0; i < 24; i++) {
      vec2 u2 = uv + uStretch * (float(i) / 23.0 - 0.5) / uRes;
      vec3 c = texture2D(tComp, u2).rgb;
      if (ab) { c.r = texture2D(tComp, u2 + o).r; c.b = texture2D(tComp, u2 - o).b; }
      col += c;
    }
    col /= 24.0;
  } else {
    col = texture2D(tComp, uv).rgb;
    if (ab) { col.r = texture2D(tComp, uv + o).r; col.b = texture2D(tComp, uv - o).b; }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ BLOOM
const PRE_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec4 uW0;         // tło, back, UI, mid
uniform vec4 uW1;         // koło, UI nad kołem, front, add
uniform float uThresh;
uniform vec2 uRes, uShake, uFocus;
uniform float uZoom, uRot;
${COMP}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  vec3 col = composite(px / uRes, uW0.x, uW0.y, uW0.z, uW0.w, uW1.x, uW1.y, uW1.z, uW1.w);
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
  vec2 q = (vUv - 0.5) * vec2(1.0, 1.25);
  col *= mix(1.0, 1.0 - smoothstep(0.32, 0.95, length(q)) * 0.7, uVignette);
  vec4 h = texture2D(tHud, vUv);
  col = col * (1.0 - h.a) + h.rgb * h.a;
  col += uFlashCol * uFlash;
  col = mix(col, vec3(0.0353, 0.0275, 0.0235), uFade);
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

const hex3 = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

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
    const MS = { type: THREE.HalfFloatType, samples: 8, depthBuffer: true };
    this.rtBG = new THREE.WebGLRenderTarget(W, H, HF);
    this.rtUI = new THREE.WebGLRenderTarget(W, H, MS);
    this.rtWheel = new THREE.WebGLRenderTarget(W, H, MS);
    this.rtUI2 = new THREE.WebGLRenderTarget(W, H, MS);
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
      uRes: { value: res }, uBase: v3(...hex3('#090706')), uGlowCol: v3(0.74, 0.0, 0.004),
      uG0: v4(), uG1: v4(), uGrid: v4(), uGridZoom: { value: 1 }, uLab: v4(), uBeam: { value: 0 },
    });
    const texU = () => ({
      tBG: { value: this.rtBG.texture }, tBack: { value: null }, tUI: { value: this.rtUI.texture }, tMid: { value: null },
      tWheel: { value: this.rtWheel.texture }, tUI2: { value: this.rtUI2.texture }, tFront: { value: null }, tAdd: { value: null },
    });
    this.comp = this.pass(COMP_FS, texU());
    this.fx = this.pass(FX_FS, {
      tComp: { value: this.rtComp.texture }, uRes: { value: res }, uZoom: { value: 1 }, uRot: { value: 0 }, uShake: { value: new THREE.Vector2() },
      uFocus: { value: new THREE.Vector2(W / 2, H / 2) }, uAberr: { value: 0 }, uStretch: { value: new THREE.Vector2() },
    });
    this.pre = this.pass(PRE_FS, {
      ...texU(), uW0: { value: new THREE.Vector4() }, uW1: { value: new THREE.Vector4() }, uThresh: { value: 0.5 },
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
      if (item.before) item.before();
      r.setRenderTarget(target);
      r.clearDepth();
      r.render(item.scene, item.camera);
      if (item.after) item.after();
    }
    // render pustej sceny wymusza "resolve" bufora MSAA — inaczej zostaje obraz z poprzedniej klatki
    if (!list.length) r.render(this.empty, this.cam);
  }

  /** Jedna subklatka. S: stan z main.js (tło, warstwy, 3D, fx). */
  renderSub(S, layers, weight, accumulate) {
    const fx = S.fx, bg = S.bg;
    const b = this.bg.u;
    b.uG0.value.fromArray(bg.glows[0]); b.uG1.value.fromArray(bg.glows[1]);
    b.uGrid.value.fromArray(bg.grid); b.uGridZoom.value = bg.gridZoom;
    b.uLab.value.fromArray(bg.lab);
    this.bg.run(this.rtBG);
    this.render3D(this.rtUI, S.ui3d);
    this.render3D(this.rtWheel, S.wheel3d);
    this.render3D(this.rtUI2, S.ui3dTop);
    for (const k of LAYERS2D) layers[k].tex.needsUpdate = true;
    for (const p of [this.comp.u, this.pre.u]) {
      p.tBack.value = layers.back.tex; p.tMid.value = layers.mid.tex; p.tFront.value = layers.front.tex; p.tAdd.value = layers.add.tex;
    }
    this.comp.run(this.rtComp);
    const f = this.fx.u;
    f.uZoom.value = fx.zoom; f.uRot.value = fx.rot; f.uShake.value.set(fx.shakeX, -fx.shakeY); f.uFocus.value.set(fx.focusX, H - fx.focusY);   // GL: oś Y w górę
    f.uAberr.value = fx.aberr;
    f.uStretch.value.set(fx.stretchX, -fx.stretchY);
    this.fx.run(this.rtFx);
    const pu = this.pre.u;
    pu.uW0.value.fromArray(fx.bloomW.slice(0, 4)); pu.uW1.value.fromArray(fx.bloomW.slice(4, 8)); pu.uThresh.value = fx.bloomThresh;
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
