/**
 * type.js — typography as a moving object.
 *
 * Deliberately small: character resolution, numeric counters and masked line
 * reveals. Everything respects reduced motion by jumping straight to the
 * resolved state — the information is never withheld, only the movement is.
 */

import { loop, PRIORITY } from './loop.js';
import { clamp, ease, mulberry32 } from './math.js';
import { capabilities } from './capabilities.js';

const GLYPHS = '▚▞▛▙◤◥╱╲┤├┼╳ᛜᚦᚨᚱ⟟⏃⌇⏁△▽0123456789';
const rand = mulberry32(0x5c1a);

const pick = () => GLYPHS[Math.floor(rand() * GLYPHS.length)];

/**
 * Resolve `el` to `text`, character by character, left to right with a soft
 * front. Returns a cancel function.
 */
export function scramble(el, text, { duration = 1.1, delay = 0 } = {}) {
  if (capabilities.quiet) {
    el.textContent = text;
    return () => {};
  }
  let t = -delay;
  const n = text.length;
  const stop = loop.add((dt) => {
    t += dt;
    if (t < 0) return;
    const k = clamp(t / duration);
    const front = ease.outQuart(k) * n;
    let out = '';
    for (let i = 0; i < n; i++) {
      if (i < front - 3) out += text[i];
      else if (i < front + 2 && text[i] !== ' ') out += pick();
      else out += k >= 1 ? text[i] : ' ';
    }
    el.textContent = k >= 1 ? text : out;
    if (k >= 1) stop();
  }, PRIORITY.UI);
  return stop;
}

/** Animated numeric counter with locale grouping. */
export function counter(el, to, { from = 0, duration = 2.2, decimals = 0, suffix = '', prefix = '' } = {}) {
  const format = (v) =>
    prefix +
    v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix;
  if (capabilities.quiet) {
    el.textContent = format(to);
    return () => {};
  }
  let t = 0;
  const stop = loop.add((dt) => {
    t += dt;
    const k = clamp(t / duration);
    el.textContent = format(from + (to - from) * ease.outQuint(k));
    if (k >= 1) stop();
  }, PRIORITY.UI);
  return stop;
}

/**
 * Wrap each line of a heading in a mask so it can rise from behind an edge.
 * Uses Range measurement rather than word splitting, so real line breaks —
 * including ones the browser decides on — are respected.
 */
export function maskLines(el, { force = false } = {}) {
  if (el.dataset.masked === 'true' && !force) return Array.from(el.querySelectorAll('.line-inner'));
  if (force) el.dataset.masked = '';
  const source = el.textContent.replace(/\s+/g, ' ').trim();
  const words = source.split(/\s+/);
  el.textContent = '';
  const probes = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w + (i < words.length - 1 ? ' ' : '');
    el.appendChild(s);
    return s;
  });

  const lines = [];
  let currentTop = null;
  probes.forEach((s) => {
    const top = Math.round(s.getBoundingClientRect().top);
    if (currentTop === null || Math.abs(top - currentTop) > 2) {
      currentTop = top;
      lines.push([]);
    }
    lines[lines.length - 1].push(s.textContent);
  });

  el.textContent = '';
  const inners = lines.map((words2) => {
    const line = document.createElement('span');
    line.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line-inner';
    inner.textContent = words2.join('');
    line.appendChild(inner);
    el.appendChild(line);
    return inner;
  });
  el.dataset.masked = 'true';
  return inners;
}

/**
 * Drive masked lines from a 0…1 progress value. Lines are staggered and use
 * different easing per line so the reveal never reads as a single block move.
 */
export function revealLines(inners, progress, { stagger = 0.13 } = {}) {
  const n = inners.length;
  for (let i = 0; i < n; i++) {
    const local = clamp((progress - i * stagger) / Math.max(1 - (n - 1) * stagger, 0.2));
    const e = ease.outQuint(local);
    inners[i].style.transform = `translate3d(0, ${(1 - e) * 108}%, 0)`;
    inners[i].style.opacity = (0.25 + e * 0.75).toFixed(3);
  }
}

/** Live coordinate jitter — the receiver is never perfectly still. */
export function jitterSeconds(base, t, amplitude = 0.4) {
  const v = base + Math.sin(t * 0.7) * amplitude * 0.6 + Math.sin(t * 2.3 + 1.1) * amplitude * 0.4;
  return v.toFixed(1).padStart(4, '0');
}
