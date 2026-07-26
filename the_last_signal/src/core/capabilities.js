/**
 * capabilities.js — one honest read of what this device can do.
 *
 * Everything downstream (particle counts, pixel ratio, whether the GL canvas is
 * created at all, whether motion runs) asks this module rather than sniffing
 * user agents on its own.
 */

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarseQuery = window.matchMedia('(pointer: coarse)');
const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const narrowQuery = window.matchMedia('(max-width: 860px)');

/** Probe for WebGL2 once, then throw the probe context away immediately. */
function probeWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return { ok: false, renderer: null };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return { ok: true, renderer };
  } catch (e) {
    return { ok: false, renderer: null };
  }
}

const probe = probeWebGL();

/** Coarse three-step performance tier. Deliberately conservative. */
function detectTier() {
  if (!probe.ok) return 'none';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const software = /swiftshader|llvmpipe|software|basic render/i.test(probe.renderer || '');
  if (software) return 'low';
  if (coarseQuery.matches) return cores >= 8 && mem >= 4 ? 'medium' : 'low';
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

const listeners = new Set();

export const capabilities = {
  webgl: probe.ok,
  renderer: probe.renderer,
  tier: detectTier(),
  reducedMotion: reducedQuery.matches,
  /** User can override the OS preference in both directions via the MOTION toggle. */
  motionOverride: null,
  touch: coarseQuery.matches,
  hover: hoverQuery.matches,
  narrow: narrowQuery.matches,

  /** True when animation should be suppressed. */
  get quiet() {
    return this.motionOverride === null ? this.reducedMotion : this.motionOverride === 'reduced';
  },

  /** Global amplitude multiplier for autonomous (non-user-driven) motion. */
  get motion() {
    return this.quiet ? 0.14 : 1;
  },

  /** Device pixel ratio, capped per tier — the single biggest perf lever. */
  get dpr() {
    const cap = this.tier === 'high' ? 2 : this.tier === 'medium' ? 1.5 : 1;
    return Math.min(window.devicePixelRatio || 1, cap);
  },

  /** Particle budget for the transmission stream. */
  get streamCount() {
    if (this.tier === 'high') return this.narrow ? 42000 : 120000;
    if (this.tier === 'medium') return this.narrow ? 20000 : 52000;
    return 12000;
  },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  emit() {
    listeners.forEach((fn) => fn(this));
  },
};

function bind(query, apply) {
  const handler = (e) => {
    apply(e);
    capabilities.emit();
  };
  // Safari < 14 only supports the deprecated form.
  if (query.addEventListener) query.addEventListener('change', handler);
  else query.addListener(handler);
  return () => {
    if (query.removeEventListener) query.removeEventListener('change', handler);
    else query.removeListener(handler);
  };
}

export const unbindCapabilities = (() => {
  const offs = [
    bind(reducedQuery, (e) => { capabilities.reducedMotion = e.matches; }),
    bind(coarseQuery, (e) => { capabilities.touch = e.matches; }),
    bind(hoverQuery, (e) => { capabilities.hover = e.matches; }),
    bind(narrowQuery, (e) => { capabilities.narrow = e.matches; }),
  ];
  return () => offs.forEach((off) => off());
})();

/** Reflect capability state onto <html> so CSS can respond without JS queries. */
export function syncDocumentFlags() {
  const root = document.documentElement;
  root.classList.toggle('has-webgl', capabilities.webgl);
  root.classList.toggle('no-webgl', !capabilities.webgl);
  root.classList.toggle('is-quiet', capabilities.quiet);
  root.classList.toggle('is-touch', capabilities.touch);
  root.classList.toggle('can-hover', capabilities.hover);
  root.dataset.tier = capabilities.tier;
}
