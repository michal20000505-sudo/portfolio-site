// Pipeline WebGL: tło z shaderów → warstwa 2D "back" → 3D → 2D "front" → 2D "add" (screen)
// → kamera/fala/glitch/aberracja → bloom (dual Kawase) → HUD, błysk, winieta → akumulacja (motion blur) → wyjście z ziarnem.
import * as THREE from 'three';
import { W, H } from './core.js';

const VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */`
#define PI 3.14159265359
#define TAU 6.28318530718
const vec3 CC = vec3(0.0, 1.0, 1.0);
const vec3 MM = vec3(1.0, 0.0, 1.0);
const vec3 YY = vec3(1.0, 1.0, 0.0);
vec3 inkCol(float i) { i = mod(i, 3.0); return i < 1.0 ? CC : (i < 2.0 ? MM : YY); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float sdPoly(vec2 p, float r, float n) {
  float an = PI / n; vec2 acs = vec2(cos(an), sin(an));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs; p.y += clamp(-p.y, 0.0, r * acs.y);
  return length(p) * sign(p.x);
}
float sdRBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 screenB(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
`;

// ------------------------------------------------------------------ TŁO
const BG_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform int uModeA, uModeB;
uniform float uMix;
uniform vec4 uA0, uA1, uB0, uB1;
uniform sampler2D tAtlas;
uniform vec2 uAtlasGrid;
${COMMON}

float lineAA(float d, float w) { float aa = fwidth(d) * 1.2; return 1.0 - smoothstep(w, w + aa, abs(d)); }

// 1: wir z obróconych wielokątów, nieskończony zoom
vec3 pVortex(vec2 p, vec4 a, vec4 b) {
  float r = length(p);
  float K = 6.0;
  float lr = log(max(r, 1e-4)) * K + a.y;
  float i0 = floor(lr);
  vec3 col = vec3(0.0);
  for (int k = -1; k <= 6; k++) {
    float i = i0 + float(k);
    float s = exp((i - a.y) / K);
    float ang = i * a.z + a.w;
    float sides = b.x + (b.w > 0.5 ? mod(i, 3.0) : 0.0);
    float d = sdPoly(rot(ang) * p, s, sides);
    vec3 c = mod(i, 4.0) < 1.0 ? vec3(1.0) : inkCol(i + b.z);
    float ln = lineAA(d, b.y * s);
    col = max(col, c * ln);
    col += c * exp(-abs(d) / (s * 0.025)) * 0.03;
  }
  col *= smoothstep(0.1, 0.5, r);
  return col * a.x;
}

// 2: tunel z zaokrąglonych okien (przeglądarka/telefon)
vec3 pWindows(vec2 p, vec4 a, vec4 b) {
  float asp = b.x;
  float r = max(abs(p.x) / asp, abs(p.y));
  float K = 4.0;
  float lr = log(max(r, 1e-4)) * K + a.y;
  float i0 = floor(lr);
  vec3 col = vec3(0.0);
  for (int k = -1; k <= 3; k++) {
    float i = i0 + float(k);
    float s = exp((i - a.y) / K);
    vec2 q = rot(i * a.z + a.w) * p;
    float d = sdRBox(q, vec2(s * asp, s), s * b.y);
    bool accent = mod(i, 3.0) < 1.0;
    vec3 c = accent ? inkCol(floor(i / 3.0)) : vec3(0.55);
    col = max(col, c * lineAA(d, b.z * s) * (accent ? 1.0 : 0.6));
    // trzy kropki "okna" w rogu (C M Y)
    for (int j = 0; j < 3; j++) {
      vec2 dp = q - vec2(-s * asp + s * 0.09 + float(j) * s * 0.07, s - s * 0.08);
      col = max(col, inkCol(float(j)) * (1.0 - smoothstep(s * 0.018, s * 0.018 + fwidth(dp.x) * 1.5, length(dp))));
    }
  }
  col *= smoothstep(0.03, 0.3, r);
  return col * a.x;
}

// 3: rastr CMY pod kątami 15°/75°/0° (rozeta druku)
float htField(vec2 c, float t, float k, vec4 b) {
  float v = 0.5 + 0.5 * sin(length(c - vec2(0.18 * sin(t * 0.4), 0.3 * cos(t * 0.3))) * 9.0 - t * 1.6 + k * 2.09);
  v *= 0.55 + 0.45 * vnoise(c * 3.0 + vec2(t * 0.2, -t * 0.15) + k * 7.0);
  float ring = exp(-pow((length(c - b.zw) - b.x) / 0.07, 2.0)) * b.y;
  return clamp(v * 0.75 + ring, 0.0, 1.0);
}
vec3 pHalftone(vec2 p, vec4 a, vec4 b) {
  vec3 col = vec3(0.0);
  float cell = a.y / uRes.x;
  float angs[3];
  angs[0] = radians(15.0); angs[1] = radians(75.0); angs[2] = 0.0;
  for (int k = 0; k < 3; k++) {
    mat2 R = rot(angs[k]);
    vec2 q = R * p / cell;
    vec2 id = floor(q) + 0.5;
    vec2 cpos = (transpose(R) * id) * cell;
    float v = htField(cpos, a.z, float(k), b);
    float rr = sqrt(v) * 0.62;
    float d = length(q - id) - rr;
    float m = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
    col = screenB(col, inkCol(float(k)) * m);
  }
  return col * a.x;
}

// 4: mora z koncentrycznych okręgów + obracające się promienie
vec3 pMoire(vec2 p, vec4 a, vec4 b) {
  float t = a.z;
  vec2 c1 = vec2(sin(t * 0.9), cos(t * 0.7)) * 0.09 * a.w;
  vec2 c2 = vec2(cos(t * 0.6 + 1.0), sin(t * 0.8)) * 0.09 * a.w;
  float f = a.y;
  float l1 = 1.0 - smoothstep(0.18, 0.18 + fwidth(length(p - c1) * f) * 2.0, abs(fract(length(p - c1) * f) - 0.5));
  float l2 = 1.0 - smoothstep(0.18, 0.18 + fwidth(length(p - c2) * f) * 2.0, abs(fract(length(p - c2) * f) - 0.5));
  float ang = atan(p.y, p.x);
  float rays = 1.0 - smoothstep(0.1, 0.1 + fwidth(ang * b.x / TAU) * 2.0, abs(fract(ang * b.x / TAU + t * 0.05) - 0.5));
  vec3 col = screenB(CC * l1 * 0.85, MM * l2 * 0.85);
  col = screenB(col, YY * rays * 0.25 * b.y);
  col *= smoothstep(0.0, 0.25, length(p));
  return col * a.x;
}

// 5: warp — smugi gwiazd w nadświetlnej
vec3 pWarp(vec2 p, vec4 a, vec4 b) {
  float r = length(p);
  float ang = atan(p.y, p.x) / TAU + 0.5;
  vec3 col = vec3(0.0);
  for (int L = 0; L < 3; L++) {
    float lanes = 140.0 + float(L) * 90.0;
    float lx = ang * lanes;
    float li = floor(lx);
    float h = hash11(li * 1.37 + float(L) * 17.0);
    float lf = fract(lx) - 0.5;
    float z = fract(h * 7.31 + a.y * (0.55 + h * 0.9));
    float r1 = 0.035 / max(1.0 - z, 0.02);
    float r0 = 0.035 / max(1.0 - max(z - a.z * (0.4 + h), 0.0), 0.02);
    float along = smoothstep(r0 - 0.002, r0 + 0.01, r) * (1.0 - smoothstep(r1 - 0.004, r1, r));
    float px = abs(lf) * TAU * r / lanes * uRes.x;
    float wid = 1.0 - smoothstep(0.6, 1.8, px);
    vec3 c = h > 0.82 ? inkCol(li) : vec3(1.0);
    col += c * along * wid * (0.35 + 0.65 * z) * step(h, a.w);
  }
  col += vec3(0.6, 0.9, 1.0) * exp(-r * 9.0) * b.y;
  return col * a.x;
}

// 6: fala obracających się kafli
vec3 pTiles(vec2 p, vec4 a, vec4 b) {
  float cell = a.y / uRes.x;
  vec2 id = floor(p / cell);
  vec2 f = fract(p / cell) - 0.5;
  vec2 cp = (id + 0.5) * cell;
  float d0 = length(cp) * b.x - a.z + (b.y > 0.5 ? (cp.x + cp.y) * 3.0 : 0.0);
  float stepi = floor(d0);
  float ang = PI * 0.5 * (stepi + smoothstep(0.0, 1.0, fract(d0) * 1.6 - 0.3));
  vec2 q = rot(ang) * f;
  float s = 0.27 + 0.08 * sin(d0 * 3.14159);
  float d = sdRBox(q, vec2(s), 0.02);
  float ln = 1.0 - smoothstep(0.035, 0.035 + fwidth(d) * 1.5, abs(d));
  vec3 c = mod(stepi, 4.0) < 1.0 ? vec3(0.8) : inkCol(stepi);
  vec3 col = c * ln + c * (1.0 - smoothstep(-0.01, 0.01, d)) * 0.12;
  return col * a.x;
}

// 7: kalejdoskopowy tunel z prac
vec3 pKaleido(vec2 p, vec4 a, vec4 b) {
  float r = length(p);
  float ang = atan(p.y, p.x) + a.w;
  float segA = TAU / a.z;
  float fa = mod(ang, segA);
  fa = abs(fa - segA * 0.5);
  float u = fa / (segA * 0.5);
  float v = b.z / max(r, 0.001) + a.y;
  float ring = floor(v);
  float fv = fract(v);
  float n = uAtlasGrid.x * uAtlasGrid.y;
  float idx = mod(ring + b.x, n);
  vec2 cellId = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));
  vec2 cuv = vec2(0.08 + u * 0.84, 0.06 + fv * 0.88);
  vec2 auv = (cellId + cuv) / uAtlasGrid;
  auv.y = 1.0 - auv.y;
  // pochodne z ciągłych współrzędnych — fract() nie psuje wyboru mipmapy na granicach pierścieni
  vec2 cont = vec2(0.84 * u, -0.88 * v) / uAtlasGrid;
  vec3 img = textureGrad(tAtlas, auv, dFdx(cont), dFdy(cont)).rgb;
  float edge = smoothstep(0.0, 0.05, fv) * (1.0 - smoothstep(0.95, 1.0, fv));
  vec3 lineC = inkCol(ring) * (1.0 - smoothstep(0.0, 0.025, fv)) * 1.1;
  vec3 col = img * edge * b.y + lineC;
  col *= smoothstep(0.05, 0.36, r);
  return col * a.x;
}

// 8: spokojne tło outro — poświaty + gwiazdy
vec3 pGlow(vec2 p, vec4 a, vec4 b) {
  float t = a.y;
  vec3 col = vec3(0.0);
  col += CC * 0.10 * exp(-length(p - vec2(-0.32 + 0.05 * sin(t * 0.7), 0.45)) * 2.4);
  col += MM * 0.09 * exp(-length(p - vec2(0.35, -0.35 + 0.05 * cos(t * 0.6))) * 2.4);
  col += YY * 0.045 * exp(-length(p - vec2(0.1 * sin(t * 0.4), -0.75)) * 2.6);
  for (int L = 0; L < 2; L++) {
    float sc = 34.0 + float(L) * 22.0;
    vec2 q = p * sc + vec2(0.0, t * (0.3 + float(L) * 0.2));
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash21(id + float(L) * 13.0);
    vec2 o = vec2(hash21(id + 3.1), hash21(id + 7.7)) - 0.5;
    float d = length(f - o * 0.7);
    float tw = 0.5 + 0.5 * sin(t * 3.0 + h * 40.0);
    col += vec3(1.0) * step(0.86, h) * (1.0 - smoothstep(0.0, 0.06, d)) * (0.35 + 0.65 * tw) * 0.8;
  }
  return col * a.x;
}

vec3 pattern(int mode, vec2 p, vec4 a, vec4 b) {
  if (mode == 1) return pVortex(p, a, b);
  if (mode == 2) return pWindows(p, a, b);
  if (mode == 3) return pHalftone(p, a, b);
  if (mode == 4) return pMoire(p, a, b);
  if (mode == 5) return pWarp(p, a, b);
  if (mode == 6) return pTiles(p, a, b);
  if (mode == 7) return pKaleido(p, a, b);
  if (mode == 8) return pGlow(p, a, b);
  return vec3(0.0);
}

void main() {
  vec2 frag = vUv * uRes;
  vec2 p = (frag - uRes * 0.5) / uRes.x;
  vec3 A = uMix < 0.999 ? pattern(uModeA, p, uA0, uA1) : vec3(0.0);
  vec3 B = uMix > 0.001 ? pattern(uModeB, p, uB0, uB1) : vec3(0.0);
  vec3 col = mix(A, B, uMix) + vec3(0.0196);
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ KOMPOZYCJA
const TONE = /* glsl */`
uniform float uTone3D, uExposure;
vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
vec3 lin2srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 tone3D(vec3 c) {
  // 0: wartości ekranowe (płaszczyzny z obrazami), 1: liniowe → sRGB, 2: ACES + sRGB (modele PBR)
  if (uTone3D > 1.5) return lin2srgb(aces(c * uExposure));
  if (uTone3D > 0.5) return lin2srgb(clamp(c, 0.0, 1.0));
  return clamp(c, 0.0, 1.0);
}`;
const COMP_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tBG, tBack, t3D, tFront, tAdd;
uniform float uGlitch3D, uGlitchSeed;
${TONE}
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main() {
  vec3 col = texture2D(tBG, vUv).rgb;
  vec4 b = texture2D(tBack, vUv);
  col = col * (1.0 - b.a) + b.rgb * b.a;
  vec2 uv3 = vUv;
  if (uGlitch3D > 0.001) {   // "plasterkowanie" samej warstwy 3D
    float band = floor(vUv.y * 22.0 + h11(floor(vUv.y * 5.0) + uGlitchSeed) * 3.0);
    uv3.x += (h11(band * 1.91 + uGlitchSeed) - 0.5) * 0.16 * uGlitch3D * step(0.35, h11(band + uGlitchSeed * 2.3));
  }
  vec4 d = texture2D(t3D, uv3);
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

// ------------------------------------------------------------------ FX: kamera, fala, glitch, aberracja
const FX_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tComp;
uniform vec2 uRes;
uniform float uZoom, uRot;
uniform vec2 uShake, uFocus;
uniform float uAberr;
uniform vec2 uAberrDir;
uniform float uRipple, uRippleR;
uniform vec2 uRippleC;
uniform float uGlitch, uGlitchSeed;
uniform float uKaleido;
${COMMON}
void main() {
  vec2 px = vUv * uRes;
  // kamera: zoom i obrót wokół punktu ogniskowego
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  // fala uderzeniowa
  if (uRipple > 0.001) {
    vec2 dp = px - uRippleC;
    float dist = length(dp);
    float k = exp(-pow((dist - uRippleR) / 70.0, 2.0)) * uRipple;
    px += dp / max(dist, 1.0) * k * 26.0;
  }
  // glitch w poziomych pasach
  if (uGlitch > 0.001) {
    float bandH = 18.0 + 90.0 * hash11(floor(px.y / 140.0) + uGlitchSeed);
    float band = floor(px.y / bandH);
    float h = hash11(band * 1.37 + uGlitchSeed);
    if (h > 0.55) px.x += (hash11(band * 2.71 + uGlitchSeed * 3.1) - 0.5) * 260.0 * uGlitch;
  }
  vec2 uv = px / uRes;
  vec2 radial = (uv - 0.5) * vec2(1.0, uRes.y / uRes.x);
  vec2 o = (uAberrDir * uAberr + radial * 3.0) / uRes;
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
uniform vec4 uW;          // wagi świecenia: back, 3D, front, add (tło = 1)
uniform float uThresh;
uniform vec2 uRes, uShake, uFocus;
uniform float uZoom, uRot;
${TONE}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec2 px = vUv * uRes;
  px = rot(-uRot) * (px - uFocus) / uZoom + uFocus - uShake;
  vec2 uv = px / uRes;
  vec3 col = texture2D(tBG, uv).rgb;
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
uniform float uBloom, uFlash, uFade, uVignette, uWeight;
uniform vec3 uFlashCol;
void main() {
  vec3 col = texture2D(tFx, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
  vec2 q = (vUv - 0.5) * vec2(1.0, 1.35);
  col *= mix(1.0, 1.0 - smoothstep(0.35, 0.95, length(q)) * 0.75, uVignette);
  vec4 h = texture2D(tHud, vUv);
  col = col * (1.0 - h.a) + h.rgb * h.a;
  col += uFlashCol * uFlash;
  col = mix(col, vec3(0.0196), uFade);
  gl_FragColor = vec4(col * uWeight, 1.0);
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
  col += n * uGrain * (0.35 + 0.65 * (1.0 - abs(dot(col, vec3(0.333)) - 0.5) * 2.0));
  col += (hash21(px * 0.71 + uSeed) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Pipeline {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.autoClear = false;
    r.localClippingEnabled = true;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // tekstury warstw 2D
    const mkTex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
    this.mkTex = mkTex;

    const res = new THREE.Vector2(W, H);
    this.bg = this.pass(BG_FS, {
      uRes: { value: res }, uTime: { value: 0 }, uModeA: { value: 0 }, uModeB: { value: 0 }, uMix: { value: 0 },
      uA0: { value: new THREE.Vector4() }, uA1: { value: new THREE.Vector4() }, uB0: { value: new THREE.Vector4() }, uB1: { value: new THREE.Vector4() },
      tAtlas: { value: null }, uAtlasGrid: { value: new THREE.Vector2(3, 3) },
    });
    this.comp = this.pass(COMP_FS, {
      tBG: { value: this.rtBG.texture }, tBack: { value: null }, t3D: { value: this.rt3D.texture }, tFront: { value: null }, tAdd: { value: null },
      uTone3D: { value: 0 }, uExposure: { value: 1.1 }, uGlitch3D: { value: 0 }, uGlitchSeed: { value: 0 },
    });
    this.fx = this.pass(FX_FS, {
      tComp: { value: this.rtComp.texture }, uRes: { value: res }, uZoom: { value: 1 }, uRot: { value: 0 }, uShake: { value: new THREE.Vector2() },
      uFocus: { value: new THREE.Vector2(W / 2, H / 2) }, uAberr: { value: 0 }, uAberrDir: { value: new THREE.Vector2(1, 0.4) },
      uRipple: { value: 0 }, uRippleR: { value: 0 }, uRippleC: { value: new THREE.Vector2(W / 2, H / 2) },
      uGlitch: { value: 0 }, uGlitchSeed: { value: 0 }, uKaleido: { value: 0 },
    });
    this.pre = this.pass(PRE_FS, {
      tBG: { value: this.rtBG.texture }, tBack: { value: null }, t3D: { value: this.rt3D.texture }, tFront: { value: null }, tAdd: { value: null },
      uW: { value: new THREE.Vector4(0.5, 0, 0.3, 1) }, uThresh: { value: 0.5 }, uTone3D: { value: 0 }, uExposure: { value: 1.1 },
      uRes: { value: res }, uShake: { value: new THREE.Vector2() }, uFocus: { value: new THREE.Vector2(W / 2, H / 2) }, uZoom: { value: 1 }, uRot: { value: 0 },
    });
    this.dn = this.pass(DOWN_FS, { tSrc: { value: null }, uHalf: { value: new THREE.Vector2() } });
    this.upP = this.pass(UP_FS, { tSrc: { value: null }, tAdd: { value: null }, uHalf: { value: new THREE.Vector2() } });
    this.fin = this.pass(FINAL_FS, {
      tFx: { value: this.rtFx.texture }, tBloom: { value: null }, tHud: { value: null },
      uBloom: { value: 0.9 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Vector3(1, 1, 1) }, uFade: { value: 0 }, uVignette: { value: 1 }, uWeight: { value: 1 },
    });
    this.acc = this.pass(FINAL_FS, null);  // podmieniane niżej
    this.accMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform float uWeight;
        void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }`,
      uniforms: { tSrc: { value: this.rtFinal.texture }, uWeight: { value: 0.25 } },
      depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.acc.mesh.material = this.accMat;
    this.out = this.pass(OUT_FS, { tSrc: { value: this.rtAcc.texture }, uRes: { value: res }, uGrain: { value: 0.035 }, uSeed: { value: 0 } });
  }

  pass(fs, uniforms) {
    const mat = uniforms ? new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false }) : null;
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    const u = uniforms;
    return {
      u, mesh, scene,
      run: target => { this.renderer.setRenderTarget(target); this.renderer.render(scene, this.cam); },
    };
  }

  /**
   * Jedna subklatka. S: stan z main.js (tło, warstwy, 3D, fx).
   */
  renderSub(S, layers, weight, accumulate) {
    const r = this.renderer;
    // tło
    const b = this.bg.u;
    b.uTime.value = S.t;
    b.uModeA.value = S.bgA.mode; b.uA0.value.fromArray(S.bgA.a0); b.uA1.value.fromArray(S.bgA.a1);
    b.uModeB.value = S.bgB.mode; b.uB0.value.fromArray(S.bgB.a0); b.uB1.value.fromArray(S.bgB.a1);
    b.uMix.value = S.bgMix;
    this.bg.run(this.rtBG);
    // 3D
    r.setRenderTarget(this.rt3D);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    for (const item of S.list3d) {
      r.clearDepth();
      if (item.before) item.before(r);
      if (item.custom) item.custom(r); else r.render(item.scene, item.camera);
    }
    // render pustej sceny wymusza "resolve" bufora MSAA — inaczej zostaje obraz z poprzedniej klatki
    if (!S.list3d.length) r.render(this.empty, this.cam);
    // warstwy 2D
    for (const k of ['back', 'front', 'add', 'hud']) layers[k].tex.needsUpdate = true;
    const c = this.comp.u;
    c.tBack.value = layers.back.tex; c.tFront.value = layers.front.tex; c.tAdd.value = layers.add.tex;
    c.uTone3D.value = S.fx.tone3d; c.uExposure.value = S.fx.exposure;
    c.uGlitch3D.value = S.fx.glitch3d; c.uGlitchSeed.value = S.fx.glitchSeed;
    this.comp.run(this.rtComp);
    // fx
    const f = this.fx.u, fx = S.fx;
    f.uZoom.value = fx.zoom; f.uRot.value = fx.rot; f.uShake.value.set(fx.shakeX, -fx.shakeY); f.uFocus.value.set(fx.focusX, H - fx.focusY);   // GL: oś Y w górę
    f.uAberr.value = fx.aberr; f.uAberrDir.value.set(fx.aberrDX, fx.aberrDY);
    f.uRipple.value = fx.ripple; f.uRippleR.value = fx.rippleR; f.uRippleC.value.set(fx.rippleX, H - fx.rippleY);
    f.uGlitch.value = fx.glitch; f.uGlitchSeed.value = fx.glitchSeed;
    this.fx.run(this.rtFx);
    // bloom
    const pu = this.pre.u;
    pu.tBack.value = layers.back.tex; pu.tFront.value = layers.front.tex; pu.tAdd.value = layers.add.tex;
    pu.uW.value.fromArray(fx.bloomW); pu.uThresh.value = fx.bloomThresh;
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
    fi.uBloom.value = fx.bloom; fi.uFlash.value = fx.flash; fi.uFlashCol.value.fromArray(fx.flashCol); fi.uFade.value = fx.fade; fi.uVignette.value = fx.vignette;
    fi.uWeight.value = 1;
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
