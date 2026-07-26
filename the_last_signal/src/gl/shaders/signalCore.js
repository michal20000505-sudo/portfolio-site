import { FRAG_HEADER } from './lib.js';

/**
 * signalCore — Chapter 00 (Acquisition) and Chapter 05 (Afterlight).
 *
 * One point of light, the field behind it, and the way the field bends around
 * the point. The same program serves both chapters: acquisition drives it
 * outward, afterlight drives it back down to nothing. Reusing the program keeps
 * the optical signature identical at both ends of the story, which is the whole
 * argument of the last chapter.
 */
export const signalCoreFrag = /* glsl */ `${FRAG_HEADER}
uniform float uRadius;   // core scale
uniform float uHold;     // 0..1 press-and-hold charge
uniform float uExpand;   // 0..1 detonation into the next chapter
uniform float uMass;     // lensing strength
uniform float uField;    // background star density
uniform float uDust;     // interstellar medium
uniform float uPulse;    // signal waveform amplitude
uniform float uCollapse; // 1.0 in Afterlight: light contracts instead of blooming

/*
 * Sparse, magnitude-weighted stars. Scintillation is per-star, not global.
 *
 * soft is the squared core radius in *cell* units, derived by the caller from
 * that layer's density so every star is the same size on screen. Sizing the
 * core in cell units directly — as this did — gives the denser layer a core of
 * roughly one pixel, and a one-pixel star samples almost at random as the field
 * drifts under the lens. That is read as flicker, not as twinkling.
 */
float starField(vec2 p, float density, float soft, float t){
  vec2 g = p * density;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float acc = 0.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 o = vec2(float(x), float(y));
      vec2 h = hash22(id + o);
      if (h.x > 0.855){
        vec2 pos = o + (h - 0.5) * 0.82 - f;
        float d2 = dot(pos, pos);
        float mag = pow(hash12(id + o + 7.13), 3.2);
        /* Slow and shallow: a star that pulses hard is indistinguishable from
           one that is aliasing. */
        float tw = 0.88 + 0.12 * sin(t * 0.8 + h.y * TAU);
        acc += mag * tw * 2.9 * soft / (d2 + soft);
      }
    }
  }
  return acc;
}

/* Core radius as a fraction of viewport height — comfortably above one pixel. */
const float STAR_R = 0.0048;

void main(){
  vec2 res = uRes;
  float aspect = res.x / res.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  vec2 ptr = uPointer * vec2(aspect, 1.0) * 0.5;

  /* The core is not nailed to the centre — it leans toward the observer. */
  vec2 core = ptr * 0.055;
  core.y += sin(uTime * 0.31) * 0.004 * uMotion;

  float dCore = length(p - core);

  /*
   * Two masses bend the field: the signal, and — far more weakly — the cursor.
   * Proximity increases the signal's apparent mass, so the space around it
   * tightens as you approach.
   */
  float near = 1.0 - smoothstep(0.0, 0.5, length(ptr - core));
  float mass = uMass * (0.55 + 0.45 * near) * (1.0 + uExpand * 5.0);
  vec2 lensed = lens(p, core, mass);
  lensed = lens(lensed, ptr, uMass * 0.22);

  vec3 col = vec3(0.0);

  /* Interstellar medium: almost invisible, but it gives the void a depth cue. */
  float dust = warped(vec3(lensed * 1.9, uTime * 0.012 * uMotion), 1.5, 4);
  dust = smoothstep(-0.15, 0.85, dust);
  col += mix(SPECTRAL * 0.5, SILVER, 0.35) * dust * 0.030 * uDust;

  /*
   * Field stars, bent by the same lens. Each layer's softening is scaled by its
   * own effective density, so both render at the same on-screen size: the near
   * layer at 7.5, the far one at 12.0 on coordinates already scaled by 1.61.
   */
  float softA = STAR_R * 7.5;
  softA *= softA;
  float softB = STAR_R * 12.0 * 1.61;
  softB *= softB;

  float stars = starField(lensed, 7.5, softA, uTime * uMotion);
  col += mix(SILVER, WARM, 0.4) * stars * uField;
  col += SPECTRAL * starField(lensed * 1.61 + 31.7, 12.0, softB, uTime * 0.7 * uMotion) * uField * 0.35;

  /* Einstein ring — the field piling up on the far side of the mass. */
  float ring = exp(-pow(abs(dCore - 0.085 - uExpand * 0.5) * 34.0, 1.5));
  col += mix(WARM, SPECTRAL, 0.35) * ring * mass * 0.40;

  /*
   * The signal itself. Radius breathes with the carrier; the waveform is the
   * only thing in Chapter 00 that moves on its own.
   */
  float breath = 1.0 + 0.16 * sin(uTime * 2.05) * uMotion + uPulse * 0.5;
  float radius = uRadius * breath * (1.0 + uExpand * 14.0) * (1.0 - uCollapse * uProgress * 0.94);

  float psf = pointSpread(dCore, radius);
  vec3 coreCol = stellarRamp(clamp(psf * 0.6, 0.0, 1.0));
  col += coreCol * psf * (1.0 + uExpand * 2.2);

  /* Optical spikes — restrained, and only while there is enough light to make them. */
  col += WARM * spikes(p - core, radius, 0.10 * (1.0 + uExpand * 3.0)) * smoothstep(0.0, 0.02, radius);

  /* Charge ring: a thin arc that closes as the signal is held. */
  if (uHold > 0.001){
    float r = 0.062 + uHold * 0.006;
    float band = exp(-pow(abs(dCore - r) * 210.0, 2.0));
    vec2 rel = p - core;
    float ang = atan(rel.x, rel.y) / TAU;
    ang = fract(ang + 1.0);
    float arc = step(ang, uHold);
    col += STELLAR * band * arc * 0.85;
    /* The leading edge is brighter — it reads as something being written. */
    col += AMBER * band * exp(-abs(ang - uHold) * 120.0) * 1.6;
  }

  /* Shock front on release. */
  float shock = exp(-pow(abs(dCore - uExpand * 1.35) * 12.0, 2.0)) * uExpand * (1.0 - uExpand);
  col += mix(STELLAR, AMBER, 0.4) * shock * 3.2;

  /* Vignette — optical, not decorative: it is the aperture. */
  float vig = 1.0 - smoothstep(0.42, 1.02, length(p * vec2(0.82, 1.0)));
  col *= 0.30 + 0.70 * vig;

  col = fringe(col, dCore, 0.045 * (1.0 + uExpand * 2.0));
  col = tonemap(col * 1.06);
  col = dither(col, gl_FragCoord.xy);

  float a = clamp(max(max(col.r, col.g), col.b) * 2.4, 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * uOpacity, a);
}`;
