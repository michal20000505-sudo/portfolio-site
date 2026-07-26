import { FRAG_HEADER } from './lib.js';

/**
 * source — Chapter 01. The star, in four states.
 *
 * `uState` runs 0 → 3 continuously with scroll:
 *   0 observed       — seen through 4,812 years of dust, soft, veiled, late
 *   1 reconstructed  — extinction removed, granulation resolved, measured
 *   2 collapse       — the core fails, the photosphere falls, the shock leaves
 *   3 origin         — everything reduced to the point the message left from
 *
 * The granulation is sampled on a projected hemisphere rather than on the flat
 * disc, so convection cells compress toward the limb. That single detail is
 * what stops it reading as a texture on a circle.
 */
export const sourceFrag = /* glsl */ `${FRAG_HEADER}
uniform float uState;   // 0..3
uniform float uRadius;
uniform float uOct;     // octave budget, lowered on weaker devices
uniform float uDrift;   // parallax from pointer

void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  int oct = int(uOct);

  /* State weights. Windows overlap so no transition is ever a cut. */
  float wObs = 1.0 - smoothstep(0.15, 0.95, uState);
  float wRec = smoothstep(0.15, 0.95, uState) - smoothstep(1.15, 1.95, uState);
  float wCol = smoothstep(1.15, 1.95, uState) - smoothstep(2.25, 2.85, uState);
  float wOrg = smoothstep(2.25, 2.85, uState);

  /* Collapse timeline, local to its own window. */
  float kc = clamp((uState - 1.35) / 1.15, 0.0, 1.0);
  float implode = smoothstep(0.0, 0.52, kc);
  float rebound = smoothstep(0.46, 0.68, kc) * (1.0 - smoothstep(0.68, 1.0, kc));

  vec2 centre = vec2(uPointer.x * aspect * 0.5, uPointer.y * 0.5) * 0.035 * uDrift;
  centre.x -= 0.055 * (1.0 - wOrg);

  float R = uRadius * (1.0 - implode * 0.82) * (1.0 + rebound * 0.30);
  R = mix(R, uRadius * 0.045, wOrg);

  vec2 q = p - centre;
  float d = length(q);
  float r = d / max(R, 1e-4);

  vec3 col = vec3(0.0);

  /* ── Photosphere ─────────────────────────────────────────────────── */
  if (r < 1.35){
    float z = sqrt(max(0.0, 1.0 - min(r, 1.0) * min(r, 1.0)));
    vec3 sp = vec3(q / max(R, 1e-4), z);
    sp.xz = rot(uTime * 0.021 * uMotion) * sp.xz;   // slow axial rotation

    /* Two scales of convection: supergranulation under fine granulation. */
    float coarse = warped(sp * 2.1 + vec3(0.0, 0.0, uTime * 0.020 * uMotion), 1.7, oct);
    float fine = fbm(sp * 8.4 + vec3(0.0, 0.0, uTime * 0.055 * uMotion), oct - 1);
    float gran = coarse * 0.72 + fine * 0.34;

    /* Sharpness is the visual argument between "observed" and "reconstructed". */
    float contrast = mix(0.42, 1.35, wRec + wCol * 0.8);
    gran = (gran - 0.02) * contrast;

    float limb = pow(max(z, 0.0), mix(0.62, 0.36, wRec));
    float body = smoothstep(1.02, 0.965, r);

    float lum = (0.62 + gran) * limb * body;

    /* During implosion the surface loses its heat from the inside out. */
    lum *= 1.0 - implode * smoothstep(0.9, 0.0, r) * 0.85;

    vec3 surface = stellarRamp(clamp(lum * 1.15, 0.0, 1.0));
    surface = mix(surface, mix(surface, SPECTRAL, 0.30), wRec * 0.35);
    col += surface * lum * mix(1.0, 1.55, wRec);

    /* Dark lanes between cells, deepened once extinction is removed. */
    col -= vec3(0.10, 0.06, 0.03) * smoothstep(0.15, -0.35, gran) * body * wRec;
  }

  /* ── Corona ──────────────────────────────────────────────────────── */
  {
    float ang = atan(q.y, q.x);
    float fil = ridged(vec3(cos(ang) * 2.3, sin(ang) * 2.3, r * 1.15 - uTime * 0.045 * uMotion), oct - 1);
    float falloff = exp(-max(r - 0.94, 0.0) * mix(3.4, 2.1, wRec));
    float halo = falloff * (0.30 + fil * 0.75) * smoothstep(0.55, 1.0, r);
    col += mix(AMBER, WARM, 0.45) * halo * 0.34 * (1.0 - wOrg * 0.75);
    col += SPECTRAL * halo * 0.10 * wRec;
  }

  /* ── Shock front ─────────────────────────────────────────────────── */
  {
    float shockR = kc * 2.6;
    float front = exp(-pow(abs(d - shockR * R * 1.4) / max(R * 0.22, 1e-4), 2.0));
    float energy = wCol * (1.0 - smoothstep(0.55, 1.0, kc));
    col += mix(STELLAR, AMBER, 0.35) * front * energy * 2.1;
    /* Dispersion: the leading edge arrives colour-separated. */
    col.b += front * energy * 0.55;
    col.r += exp(-pow(abs(d - shockR * R * 1.32) / max(R * 0.24, 1e-4), 2.0)) * energy * 0.7;
  }

  /* ── Measurement overlay — only while the star is being reconstructed ── */
  if (wRec > 0.01){
    float ringA = exp(-pow(abs(r - 1.0) * 190.0, 2.0));
    float ringB = exp(-pow(abs(r - 1.31) * 150.0, 2.0)) * 0.5;
    float ang = atan(q.y, q.x);
    float ticks = step(0.955, abs(cos(ang * 12.0))) * exp(-pow(abs(r - 1.31) * 40.0, 2.0));
    float crosshair = min(exp(-abs(q.x) * 620.0), 1.0) * step(abs(q.y), R * 1.5)
                    + min(exp(-abs(q.y) * 620.0), 1.0) * step(abs(q.x), R * 1.5);
    col += SILVER * (ringA * 0.55 + ringB + ticks * 0.9 + crosshair * 0.22) * wRec * 0.75;
  }

  /* ── Origin point ────────────────────────────────────────────────── */
  if (wOrg > 0.01){
    float psf = pointSpread(d, R * 0.9);
    col += stellarRamp(clamp(psf, 0.0, 1.0)) * psf * wOrg * 1.4;
    col += WARM * spikes(q, R * 1.6, 0.085) * wOrg;
    /* Ghost chain along the optical axis — real lenses do this. */
    for (int i = 1; i <= 3; i++){
      float fi = float(i);
      vec2 g = mix(q, -q, fi * 0.28);
      float gd = length(g - centre * fi * 0.4);
      col += mix(SPECTRAL, AMBER, fi / 3.0) * exp(-pow(gd * (7.0 + fi * 2.0), 2.0)) * 0.055 * wOrg;
    }
  }

  /* ── Foreground extinction — the reason chapter 01.1 looks the way it does ── */
  {
    float veil = warped(vec3(p * 1.35 + vec2(uTime * 0.006 * uMotion, 0.0), uTime * 0.008 * uMotion), 1.2, 4);
    veil = smoothstep(-0.35, 0.75, veil);
    float amount = wObs * 0.72 + 0.06;
    col *= mix(1.0, mix(0.34, 1.0, veil), amount);
    col += mix(SPECTRAL, SILVER, 0.5) * veil * 0.020 * amount;
  }

  float vig = 1.0 - smoothstep(0.40, 1.05, length(p * vec2(0.86, 1.0)));
  col *= 0.24 + 0.76 * vig;

  col = fringe(col, d, 0.05 + wCol * 0.09);
  col = tonemap(col * 1.08);
  col = dither(col, gl_FragCoord.xy);

  float a = clamp(max(max(col.r, col.g), col.b) * 2.6, 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * uOpacity, a);
}`;
