/**
 * pointer.js — one shared pointer model.
 *
 * The cursor, the shaders, the magnetic labels and the archive cards all read
 * the same smoothed values, so nothing drifts out of sync and only one set of
 * listeners is ever attached.
 */

import { loop, PRIORITY } from './loop.js';
import { clamp, damp } from './math.js';
import { capabilities } from './capabilities.js';

export const pointer = {
  /** Raw viewport pixels. */
  x: 0, y: 0,
  /** Smoothed pixels — what the visible cursor follows. */
  sx: 0, sy: 0,
  /** Normalised −1…1, origin at viewport centre, y up. */
  nx: 0, ny: 0,
  snx: 0, sny: 0,
  /** Pixels per second, smoothed. */
  vx: 0, vy: 0,
  speed: 0,
  /** 0…1 — speed mapped into a useful range for skew and distortion. */
  energy: 0,
  down: false,
  /** False until the first real pointer event, so nothing snaps from 0,0. */
  seen: false,
};

let lastX = 0;
let lastY = 0;

function set(x, y) {
  pointer.x = x;
  pointer.y = y;
  pointer.nx = (x / window.innerWidth) * 2 - 1;
  pointer.ny = 1 - (y / window.innerHeight) * 2;
  if (!pointer.seen) {
    pointer.seen = true;
    pointer.sx = lastX = x;
    pointer.sy = lastY = y;
    pointer.snx = pointer.nx;
    pointer.sny = pointer.ny;
  }
}

function onMove(e) {
  set(e.clientX, e.clientY);
}

function onDown(e) {
  set(e.clientX, e.clientY);
  pointer.down = true;
}

function onUp() {
  pointer.down = false;
}

function onLeave() {
  pointer.down = false;
  // Drift back toward centre rather than freezing at the edge.
  pointer.x = window.innerWidth / 2;
  pointer.y = window.innerHeight / 2;
  pointer.nx = 0;
  pointer.ny = 0;
}

function update(dt) {
  const follow = capabilities.quiet ? 1e-6 : 0.0009;
  pointer.sx = damp(pointer.sx, pointer.x, follow, dt);
  pointer.sy = damp(pointer.sy, pointer.y, follow, dt);
  pointer.snx = damp(pointer.snx, pointer.nx, capabilities.quiet ? 1e-6 : 0.004, dt);
  pointer.sny = damp(pointer.sny, pointer.ny, capabilities.quiet ? 1e-6 : 0.004, dt);

  const ix = (pointer.sx - lastX) / Math.max(dt, 1e-4);
  const iy = (pointer.sy - lastY) / Math.max(dt, 1e-4);
  lastX = pointer.sx;
  lastY = pointer.sy;
  pointer.vx = damp(pointer.vx, ix, 0.002, dt);
  pointer.vy = damp(pointer.vy, iy, 0.002, dt);
  pointer.speed = Math.hypot(pointer.vx, pointer.vy);
  pointer.energy = clamp(pointer.speed / 2200);
}

export function initPointer() {
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  pointer.x = window.innerWidth / 2;
  pointer.y = window.innerHeight / 2;
  pointer.sx = lastX = pointer.x;
  pointer.sy = lastY = pointer.y;
  loop.add(update, PRIORITY.INPUT);
}

/**
 * 0…1 falloff describing how close the pointer is to an element's centre.
 * Used for magnetic labels and proximity-reactive UI.
 */
export function proximity(el, radius = 180) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const d = Math.hypot(pointer.sx - cx, pointer.sy - cy);
  return { amount: clamp(1 - d / radius), dx: pointer.sx - cx, dy: pointer.sy - cy };
}
