/**
 * lib.js — GLSL shared by every pass.
 *
 * ⚠ Never use a backtick inside the GLSL below, not even in a comment. Every
 * shader lives in a JS template literal, so one stray backtick closes it and
 * the whole renderer silently falls back to the no-WebGL path. Open
 * `shader-check.html` after editing any shader; it compiles all of them and
 * prints the exact failing line.
 *
 * Injected verbatim after the `#version` and precision lines. Kept in one place
 * so noise, colour and tonemapping are identical across scenes; that
 * consistency is what makes the chapters read as one optical system rather than
 * as separate demos.
 */

export const LIB = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718

/* ── Hashing ─────────────────────────────────────────────────────────── */
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

/*
 * Deliberately NOT sin-based.
 *
 * The usual fract(sin(dot(p, k)) * 43758.5) collapses once p gets large: by
 * the fifth FBM octave the argument reaches ~90,000, where a float32 ULP is
 * 0.005 — multiplied by 43758 that is ±236, so nothing survives. The result is
 * high octaves made of pure noise that reshuffles whenever the coordinate
 * shifts, which reads as a surface that boils. This form uses only fract and
 * dot and stays well conditioned.
 */
vec3 hash33(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return -1.0 + 2.0 * fract((p.xxy + p.yxx) * p.zyx);
}

/* ── Gradient noise ──────────────────────────────────────────────────── */

/*
 * Corner gradient, with the lattice wrapped to a fixed period. Keeps the hash
 * argument small no matter how far the FBM has scaled the coordinate up. The
 * period is far larger than anything on screen, so the tiling is never visible.
 */
vec3 latticeGrad(vec3 cell, vec3 offset){
  return hash33(mod(cell + offset, 1024.0));
}

float gnoise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(latticeGrad(i, vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
                     dot(latticeGrad(i, vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
                 mix(dot(latticeGrad(i, vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
                     dot(latticeGrad(i, vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
             mix(mix(dot(latticeGrad(i, vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
                     dot(latticeGrad(i, vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
                 mix(dot(latticeGrad(i, vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
                     dot(latticeGrad(i, vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

float fbm(vec3 p, int octaves){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= octaves) break;
    s += a * gnoise(p);
    /* Small per-octave offsets. Large ones push the coordinate far enough that
       even a well-behaved hash starts losing precision. */
    p = p * 2.02 + vec3(1.7, 0.9, 0.4);
    a *= 0.5;
  }
  return s;
}

/* Ridged multifractal — the filament structure in the corona. */
float ridged(vec3 p, int octaves){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= octaves) break;
    float n = 1.0 - abs(gnoise(p));
    s += a * n * n;
    p = p * 2.13 + vec3(0.7, 1.9, 1.1);
    a *= 0.5;
  }
  return s;
}

/* Domain warp — two evaluations, enough for convincing convection. */
float warped(vec3 p, float amount, int octaves){
  vec3 q = vec3(fbm(p, 3), fbm(p + vec3(5.2, 1.3, 2.8), 3), fbm(p + vec3(1.7, 9.2, 4.4), 3));
  return fbm(p + amount * q, octaves);
}

/* ── Geometry ────────────────────────────────────────────────────────── */
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/* ── Optics ──────────────────────────────────────────────────────────── */

/* Airy-like point spread: a hard core, a soft skirt, faint diffraction rings. */
float pointSpread(float d, float radius){
  float core = exp(-pow(d / max(radius, 1e-5), 1.35) * 3.4);
  float skirt = radius / (radius + d * d * 46.0);
  float rings = 0.045 * exp(-d * 9.0) * (0.5 + 0.5 * cos(d / max(radius, 1e-5) * 7.4));
  return core + skirt * 0.45 + max(rings, 0.0);
}

/* Four-arm diffraction spikes from the secondary-mirror spider. */
float spikes(vec2 p, float radius, float strength){
  float a = 0.0;
  a += exp(-abs(p.y) / (radius * 0.05)) * exp(-abs(p.x) * 2.4);
  a += exp(-abs(p.x) / (radius * 0.05)) * exp(-abs(p.y) * 2.4);
  vec2 q = rot(0.7853) * p;
  a += 0.35 * exp(-abs(q.y) / (radius * 0.045)) * exp(-abs(q.x) * 3.2);
  a += 0.35 * exp(-abs(q.x) / (radius * 0.045)) * exp(-abs(q.y) * 3.2);
  return a * strength;
}

/* Gravitational lensing: bend sample coordinates around a mass at c. */
vec2 lens(vec2 p, vec2 c, float mass){
  vec2 d = p - c;
  float r2 = max(dot(d, d), 1e-4);
  return p - d * (mass / r2) * 0.06;
}

/* ── Colour ──────────────────────────────────────────────────────────── */
const vec3 AMBER    = vec3(1.000, 0.596, 0.259);
const vec3 WARM     = vec3(1.000, 0.886, 0.749);
const vec3 STELLAR  = vec3(1.000, 0.976, 0.945);
const vec3 SPECTRAL = vec3(0.604, 0.541, 0.902);
const vec3 SILVER   = vec3(0.741, 0.757, 0.784);
const vec3 ALERT    = vec3(0.855, 0.192, 0.157);

/* t = 0 at the cool limb, 1 in the core. */
vec3 stellarRamp(float t){
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(AMBER * 0.55, AMBER, smoothstep(0.0, 0.28, t));
  c = mix(c, WARM, smoothstep(0.24, 0.66, t));
  c = mix(c, STELLAR, smoothstep(0.66, 1.0, t));
  return c;
}

/* Filmic curve. Highlights roll off instead of clipping to a flat white disc. */
vec3 tonemap(vec3 x){
  x = max(vec3(0.0), x);
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

/*
 * Dither. On a palette this close to black, 8-bit quantisation produces visible
 * rings; a sub-LSB noise floor removes them.
 *
 * Fixed per pixel, deliberately not animated. Re-rolling it every frame turns a
 * banding fix into a second layer of full-screen static on top of the grain.
 */
vec3 dither(vec3 c, vec2 fc){
  float n = hash12(fc);
  return c + (n - 0.5) * (1.0 / 220.0);
}

/* Lateral chromatic aberration, strongest toward the frame edge. */
vec3 fringe(vec3 c, float r, float amount){
  return vec3(c.r * (1.0 + amount * r), c.g, c.b * (1.0 - amount * r * 0.7));
}
`;

/** Prefix every fragment shader identically. */
export const FRAG_HEADER = /* glsl */ `#version 300 es
precision highp float;
${LIB}
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uOpacity;
uniform float uProgress;
uniform vec2 uPointer;
uniform float uMotion;
`;
