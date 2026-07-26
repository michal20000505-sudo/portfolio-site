/**
 * cursor.js — CustomCursor.
 *
 * Two elements: a dot that is exactly where the pointer is, and a ring that
 * lags behind it. The dot keeps the instrument precise; the ring carries the
 * state and the inertia. Elements declare what the cursor means near them with
 * `data-cursor="decode"` and an optional `data-cursor-label`.
 *
 * Never shown on touch devices — a cursor that cannot be moved is decoration.
 */

import { pointer } from '../core/pointer.js';
import { loop, PRIORITY } from '../core/loop.js';
import { capabilities } from '../core/capabilities.js';
import { clamp, damp } from '../core/math.js';

const LABELS = {
  observe: 'observe',
  hold: 'hold',
  decode: 'decode',
  drag: 'drag',
  enter: 'enter',
  transmit: 'transmit',
  close: 'close',
};

export class CustomCursor {
  constructor(root) {
    this.root = root;
    this.ring = root.querySelector('[data-cursor-ring]');
    this.dot = root.querySelector('[data-cursor-dot]');
    this.label = root.querySelector('[data-cursor-label-el]');
    this.state = 'default';
    this.scale = 1;
    this.targetScale = 1;
    this.press = 0;
    this.opacity = 0;
    this.progress = 0;
    this.targetProgress = 0;
    this._active = false;
    this._bound = false;
  }

  mount() {
    if (!capabilities.hover || capabilities.touch) {
      this.root.hidden = true;
      return this;
    }
    this.root.hidden = false;
    document.documentElement.classList.add('custom-cursor');

    this._onOver = (e) => {
      const el = e.target instanceof Element ? e.target.closest('[data-cursor]') : null;
      const next = el ? el.dataset.cursor : 'default';
      const text = el ? el.dataset.cursorLabel || LABELS[next] || '' : '';
      this.setState(next, text);
    };
    this._onDown = () => { this.press = 1; };
    this._onUp = () => { this.press = 0; };
    this._onLeave = () => { this._active = false; };
    this._onEnter = () => { this._active = true; };

    document.addEventListener('pointerover', this._onOver);
    document.addEventListener('pointerdown', this._onDown);
    document.addEventListener('pointerup', this._onUp);
    document.addEventListener('pointercancel', this._onUp);
    document.addEventListener('mouseleave', this._onLeave);
    document.addEventListener('mouseenter', this._onEnter);
    this._active = true;
    this._bound = true;

    this._stop = loop.add(this.update.bind(this), PRIORITY.UI);
    return this;
  }

  setState(state, label = '') {
    if (state === this.state && label === this._label) return;
    this.state = state;
    this._label = label;
    this.root.dataset.state = state;
    this.label.textContent = label;
    this.targetScale =
      state === 'default' ? 1 :
      state === 'hold' ? 2.4 :
      state === 'enter' ? 2.0 :
      state === 'drag' ? 1.7 :
      state === 'close' ? 1.5 : 1.55;
  }

  /** 0…1 arc drawn around the ring — used by the press-and-hold gate. */
  setProgress(v) {
    this.targetProgress = clamp(v);
  }

  update(dt) {
    if (!this._bound) return;
    const visible = this._active && pointer.seen ? 1 : 0;
    this.opacity = damp(this.opacity, visible, 0.001, dt);

    this.scale = damp(this.scale, this.targetScale * (1 - this.press * 0.22), 0.0004, dt);
    this.progress = damp(this.progress, this.targetProgress, 0.002, dt);

    // Velocity shear: the ring stretches along the direction of travel.
    const energy = capabilities.quiet ? 0 : clamp(pointer.energy, 0, 1);
    const angle = Math.atan2(pointer.vy, pointer.vx);
    const stretch = 1 + energy * 0.55;
    const squash = 1 - energy * 0.24;

    this.dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%)`;
    this.dot.style.opacity = this.opacity;

    this.ring.style.transform =
      `translate3d(${pointer.sx}px, ${pointer.sy}px, 0) translate(-50%, -50%) ` +
      `rotate(${angle}rad) scale(${(this.scale * stretch).toFixed(3)}, ${(this.scale * squash).toFixed(3)})`;
    this.ring.style.opacity = this.opacity * (0.35 + this.scale * 0.2);
    this.ring.style.setProperty('--arc', this.progress.toFixed(3));

    this.label.style.transform = `translate3d(${pointer.sx}px, ${pointer.sy}px, 0)`;
    this.label.style.opacity = this.opacity * (this._label ? 1 : 0);
  }

  destroy() {
    if (this._stop) this._stop();
    if (!this._bound) return;
    document.removeEventListener('pointerover', this._onOver);
    document.removeEventListener('pointerdown', this._onDown);
    document.removeEventListener('pointerup', this._onUp);
    document.removeEventListener('pointercancel', this._onUp);
    document.removeEventListener('mouseleave', this._onLeave);
    document.removeEventListener('mouseenter', this._onEnter);
    this._bound = false;
  }
}
