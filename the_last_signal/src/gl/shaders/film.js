import { FRAG_HEADER } from './lib.js';

/**
 * film — the last pass over every chapter.
 *
 * Grain, halation and interference. It is additive and very quiet: the job is
 * to put an emulsion and an aperture between the viewer and the image, so the
 * page reads as something recorded rather than something rendered.
 *
 * `uInterference` spikes at chapter boundaries — the archive struggling to hold
 * the signal is the only justification for tearing the image, so it happens
 * only there.
 */
export const filmFrag = /* glsl */ `${FRAG_HEADER}
uniform float uGrain;
uniform float uInterference;

void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  /*
   * Emulsion: two grain scales, held for several frames rather than re-rolled
   * every one. A fresh noise field at 60 Hz reads as electronic static, and on a
   * background this dark it modulates the image by roughly its own magnitude.
   * Film exposes ~12–24 discrete frames a second; so does this.
   */
  /* The frame counter is wrapped: an unbounded offset would grow until
     hash12's fract() runs out of float32 mantissa and the noise degenerates
     into a few repeating states. */
  float f1 = mod(floor(uTime * 12.0), 32.0);
  float f2 = mod(floor(uTime * 6.0), 32.0);
  float g1 = hash12(gl_FragCoord.xy + f1 * 41.0);
  float g2 = hash12(floor(gl_FragCoord.xy / 2.6) + f2 * 17.0);
  float grain = (g1 * 0.62 + g2 * 0.38 - 0.5);

  /*
   * Weighted toward the edges of the frame, away from the centre where the
   * subject sits against near-black — grain over the darkest part of the image
   * is the part the eye reads as flicker.
   */
  float edgeBias = smoothstep(0.15, 0.95, length(p));
  vec3 col = vec3(grain) * uGrain * (0.45 + edgeBias * 0.55);
  col.b *= 1.12;
  col.r *= 0.94;

  /* Horizontal displacement bursts while the archive re-locks the carrier. */
  if (uInterference > 0.001){
    float lineSeed = floor(vUv.y * 220.0) + floor(uTime * 22.0) * 37.0;
    float lineNoise = hash11(lineSeed);
    float strike = step(1.0 - uInterference * 0.55, lineNoise);
    float shift = (hash11(lineSeed + 5.1) - 0.5) * uInterference;
    col += mix(SILVER, SPECTRAL, hash11(lineSeed + 9.7)) * strike * abs(shift) * 0.55;
    /* A single bright scan sweeping down, so the burst has direction. */
    float sweep = exp(-pow((vUv.y - fract(uTime * 0.35)) * 26.0, 2.0));
    col += WARM * sweep * uInterference * 0.10;
  }

  /* Halation ring around the frame edge — light scattering in the lens barrel. */
  float edge = smoothstep(0.62, 1.05, length(p * vec2(0.9, 1.0)));
  col += AMBER * edge * 0.012;

  float a = clamp(length(col) * 2.0, 0.0, 1.0) * uOpacity;
  fragColor = vec4(max(col, vec3(0.0)) * uOpacity, a);
}`;
