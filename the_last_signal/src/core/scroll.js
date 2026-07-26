/**
 * scroll.js — smooth scroll without hijacking the scrollbar.
 *
 * Native scrolling stays the source of truth, so the scrollbar, keyboard, screen
 * readers, find-in-page and momentum touch all behave exactly as the platform
 * intends. We only integrate a *smoothed* copy of the position and hand that to
 * the visual layer, which is entirely `position: fixed`. Nothing is transformed
 * out from under the browser.
 */

import { loop, PRIORITY } from './loop.js';
import { clamp, damp, ease } from './math.js';
import { capabilities } from './capabilities.js';

const state = {
  raw: 0,
  smooth: 0,
  velocity: 0,
  max: 1,
  progress: 0,
  /** −1 up, +1 down, smoothed — drives directional effects. */
  direction: 1,
  locked: false,
};

let tween = null;
let lockedAt = 0;

function measure() {
  state.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

function readRaw() {
  state.raw = window.scrollY || window.pageYOffset || 0;
}

function update(dt) {
  readRaw();

  if (tween) {
    tween.t += dt;
    const k = clamp(tween.t / tween.duration);
    window.scrollTo(0, tween.from + (tween.to - tween.from) * ease.inOutQuint(k));
    if (k >= 1) {
      tween.onDone && tween.onDone();
      tween = null;
    }
    readRaw();
  }

  const previous = state.smooth;
  // Reduced motion: no lag at all. The smoothed value *is* the real one.
  state.smooth = capabilities.quiet ? state.raw : damp(state.smooth, state.raw, 0.0016, dt);

  const instant = (state.smooth - previous) / Math.max(dt, 1e-4);
  state.velocity = damp(state.velocity, instant, 0.002, dt);
  if (Math.abs(state.velocity) > 12) state.direction = state.velocity > 0 ? 1 : -1;
  state.progress = clamp(state.smooth / state.max);
}

/** Cancel a programmatic scroll the moment the user takes over. */
function interrupt() {
  if (tween) {
    tween.onDone && tween.onDone();
    tween = null;
  }
}

const opts = { passive: true };
window.addEventListener('wheel', interrupt, opts);
window.addEventListener('touchstart', interrupt, opts);
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) interrupt();
});
window.addEventListener('resize', measure, opts);
window.addEventListener('orientationchange', measure, opts);

export const scroll = {
  state,

  init() {
    measure();
    readRaw();
    state.smooth = state.raw;
    loop.add(update, PRIORITY.SCROLL);
  },

  measure,

  /** Animated jump used by the archive index. Returns a promise for sequencing. */
  to(y, duration = 1.5) {
    return new Promise((resolve) => {
      measure();
      const to = clamp(y, 0, state.max);
      if (capabilities.quiet) {
        window.scrollTo(0, to);
        resolve();
        return;
      }
      tween = { from: state.raw, to, t: 0, duration, onDone: resolve };
    });
  },

  lock() {
    if (state.locked) return;
    state.locked = true;
    lockedAt = state.raw;
    document.documentElement.classList.add('is-locked');
  },

  unlock() {
    if (!state.locked) return;
    state.locked = false;
    document.documentElement.classList.remove('is-locked');
    window.scrollTo(0, lockedAt);
    measure();
  },
};
