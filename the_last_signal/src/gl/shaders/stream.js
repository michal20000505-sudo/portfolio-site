import { LIB } from './lib.js';

/**
 * stream — Chapter 02. The transmission as a physical object.
 *
 * A twisting ribbon of encoded light that the camera travels *through*. Every
 * position is computed in the vertex shader from gl_VertexID, so there are no
 * attribute buffers: changing the particle count for a weaker device is a
 * single draw-call argument, not a re-upload.
 *
 * The ribbon carries structure, not just noise — periodic packet bursts, a
 * carrier envelope, and quantised data ticks — because a signal that looks
 * random cannot also look like language.
 */
export const streamVert = /* glsl */ `#version 300 es
precision highp float;
${LIB}

uniform vec2 uRes;
uniform float uTime;
uniform float uCount;
uniform float uTravel;    // 0..n, scroll-driven position along the ribbon
uniform float uAmp;       // envelope amplitude (signal energy)
uniform float uAudio;     // 0..1 level of the playing transmission
uniform float uSpread;    // ribbon width
uniform vec2 uPointer;    // NDC
uniform float uGrab;      // pointer distortion strength
uniform float uDpr;
uniform float uMotion;
uniform float uFocus;     // 0 = travelling, 1 = held still for reading

out vec3 vColor;
out float vAlpha;

const float DEPTH = 34.0;
const float NEAR = 0.55;
const float FOCAL = 1.15;

void main(){
  float fi = float(gl_VertexID);
  vec3 h = hash33(vec3(fi * 0.01731, fi * 0.00719, 3.77)) * 0.5 + 0.5;

  /* Wrapped so travel is endless, and negated so scrolling pulls the signal in. */
  float u = fract(fi / uCount - uTravel);

  /*
   * Depth is warped toward the camera. Distributed linearly, most of the budget
   * lands near the vanishing point where perspective crushes it into a bright
   * knot; this spends it on the stretch of tube the viewer is actually inside.
   */
  float depthPos = pow(u, 1.7) * DEPTH;
  float z = -(depthPos + NEAR);

  /* Centre curve — three incommensurate frequencies, so it never repeats visibly. */
  float s = depthPos + uTravel * 6.0;
  vec2 curve = vec2(
    sin(s * 0.41) * 0.44 + sin(s * 0.97 + 1.3) * 0.17,
    cos(s * 0.33 + 0.7) * 0.30 + sin(s * 0.71 + 2.1) * 0.12
  );

  /* Local frame: the ribbon twists as it travels. */
  float twist = s * 0.23 + uTime * 0.06 * uMotion;
  vec2 dir = vec2(cos(twist), sin(twist));
  vec2 nrm = vec2(-dir.y, dir.x);

  /* Carrier envelope — the ribbon breathes wide and narrow along its length. */
  float envelope = 0.55 + 0.45 * sin(s * 0.19 + uTime * 0.11 * uMotion);
  /* Packet bursts: short, dense, much brighter. This is where the data is. */
  float packet = smoothstep(0.86, 0.995, sin(s * 1.37) * 0.5 + 0.5);

  float across = (h.x * 2.0 - 1.0);
  float through = (h.y * 2.0 - 1.0);

  float width = uSpread * (0.42 + envelope * 0.75) * (1.0 + packet * 0.5);
  float thickness = uSpread * 0.12 * (1.0 + packet * 1.8);

  vec2 xy = curve
          + dir * across * width
          + nrm * through * thickness;

  /* Modulation: the waveform itself, riding the ribbon. */
  float mod1 = sin(s * 2.1 + uTime * 1.1 * uMotion + across * 2.4);
  float mod2 = sin(s * 5.3 - uTime * 0.7 * uMotion) * 0.4;
  xy += nrm * (mod1 + mod2) * uAmp * (0.06 + uAudio * 0.14) * (1.0 - uFocus * 0.7);

  float zc = z;
  vec2 proj = xy * FOCAL / (-zc);
  vec2 ndc = proj / vec2(uRes.x / uRes.y, 1.0);

  /*
   * Pointer distortion. Applied in screen space so the deformation tracks the
   * cursor exactly, and falls off fast enough that the rest of the ribbon holds
   * its shape — the signal reacts to being touched, it does not dissolve.
   */
  vec2 dp = ndc - uPointer;
  float dd = dot(dp, dp);
  float pull = exp(-dd * 7.0) * uGrab;
  ndc += normalize(dp + 1e-6) * pull * 0.22;
  ndc *= 1.0 - pull * 0.06;

  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = clamp((0.9 + packet * 2.6) * uDpr * 2.4 / (-zc), 1.0, 7.0);

  /*
   * Depth fades at both ends: nothing pops into or out of existence. The near
   * ramp is deliberately short — fading a tenth of the tube would leave only a
   * distant annulus visible, and the point of the chapter is being inside it.
   */
  /* Only the last fraction of a unit fades — anything longer erases exactly the
     stretch of tube that is wide enough to fill the frame. */
  float fadeNear = smoothstep(0.0, 0.14, depthPos);
  float fadeFar = 1.0 - smoothstep(DEPTH * 0.62, DEPTH, depthPos);
  vAlpha = fadeNear * fadeFar * (0.16 + h.z * 0.5) * (0.5 + envelope * 0.5);

  /* Quantised ticks read as encoding rather than dust. */
  float tick = step(0.972, fract(s * 6.0 + h.z * 3.0));
  vAlpha += tick * 0.55 * fadeNear * fadeFar;

  vec3 base = mix(AMBER, WARM, h.z);
  base = mix(base, SPECTRAL, smoothstep(0.72, 1.0, h.z) * 0.55);
  base = mix(base, STELLAR, packet * 0.7 + tick * 0.5);
  vColor = base * (0.8 + uAudio * 0.7 + pull * 1.4);
}`;

export const streamFrag = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
out vec4 fragColor;
uniform float uOpacity;

void main(){
  /* Soft round sprite. A square point sprite would read as pixels, not light. */
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float falloff = pow(1.0 - d, 1.7);
  float a = vAlpha * falloff * uOpacity;
  fragColor = vec4(vColor * a, a);
}`;

/**
 * The volume the ribbon travels through: a faint field of interference and
 * standing waves, drawn behind the points so the stream has somewhere to be.
 */
export const streamFieldFrag = /* glsl */ `#version 300 es
precision highp float;
${LIB}
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uOpacity;
uniform float uTravel;
uniform vec2 uPointer;
uniform float uAudio;
uniform float uMotion;

void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  /* Radial tunnel coordinates — depth without a depth buffer. */
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 tunnel = vec2(a / TAU * 4.0, log(max(r, 0.02)) * 1.6 + uTravel * 2.0);

  float f = fbm(vec3(tunnel * 2.2, uTime * 0.03 * uMotion), 4);
  float bands = 0.5 + 0.5 * sin(tunnel.y * 9.0 + f * 3.0);
  bands = pow(bands, 3.5);

  float depth = smoothstep(0.0, 0.85, r);
  vec3 col = mix(SPECTRAL, AMBER, 0.35) * bands * depth * 0.075;
  col += SILVER * smoothstep(0.4, 0.0, abs(f)) * 0.012;

  /* Interference where the cursor meets the field. */
  vec2 ptr = uPointer * vec2(aspect, 1.0) * 0.5;
  float dp = length(p - ptr);
  col += mix(WARM, SPECTRAL, 0.5) * exp(-dp * 5.5) * (0.5 + 0.5 * sin(dp * 60.0 - uTime * 4.0)) * 0.05;

  col *= 0.6 + uAudio * 0.8;
  col *= 1.0 - smoothstep(0.35, 1.05, r) * 0.75;

  col = tonemap(col);
  col = dither(col, gl_FragCoord.xy);
  float alpha = clamp(max(max(col.r, col.g), col.b) * 3.0, 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * uOpacity, alpha);
}`;
