/**
 * waveform.js — the one oscilloscope, used in three places.
 *
 * The loader, Chapter 00 and the transmission player all draw the same trace,
 * because they are all looking at the same carrier. Sharing the renderer is a
 * narrative decision as much as a technical one.
 */

import { loop, PRIORITY } from '../core/loop.js';
import { clamp, damp, mulberry32 } from '../core/math.js';
import { capabilities } from '../core/capabilities.js';

const rand = mulberry32(0x51a3);

export class Waveform {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{mode?:'trace'|'bars', color?:string, accent?:string, lineWidth?:number}} options
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = options.mode || 'trace';
    this.color = options.color || 'rgba(232,232,228,0.85)';
    this.accent = options.accent || 'rgba(255,168,84,0.9)';
    this.lineWidth = options.lineWidth || 1;

    /** Targets — set from outside; the class eases toward them. */
    this.target = { noise: 1, amp: 0.5, freq: 3.2, lock: 0, level: 0.5 };
    this.value = { ...this.target };

    this.t = 0;
    this.seeds = new Float32Array(96);
    for (let i = 0; i < this.seeds.length; i++) this.seeds[i] = rand() * 1000;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    this.resize();
    this._stop = loop.add(this.draw.bind(this), PRIORITY.UI);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  set(values) {
    Object.assign(this.target, values);
  }

  /** Snap immediately — used when the player scrubs. */
  jump(values) {
    Object.assign(this.target, values);
    Object.assign(this.value, values);
  }

  draw(dt) {
    const ctx = this.ctx;
    if (!ctx || !this.w) return;
    this.t += dt * (capabilities.quiet ? 0.2 : 1);

    for (const k in this.target) {
      this.value[k] = damp(this.value[k], this.target[k], 0.02, dt);
    }
    const { noise, amp, freq, lock, level } = this.value;

    ctx.clearRect(0, 0, this.w, this.h);
    const mid = this.h / 2;

    if (this.mode === 'bars') {
      const bars = Math.max(8, Math.floor(this.w / 5));
      const gap = this.w / bars;
      for (let i = 0; i < bars; i++) {
        const s = this.seeds[i % this.seeds.length];
        const carrier = Math.sin(i * 0.42 + this.t * freq) * 0.5 + 0.5;
        const grit = Math.sin(s + this.t * 9.1 + i) * 0.5 + 0.5;
        const v = (carrier * (1 - noise) + grit * noise) * amp * level;
        const height = Math.max(1, v * this.h * 0.9);
        ctx.fillStyle = i % 9 === 0 ? this.accent : this.color;
        ctx.globalAlpha = 0.25 + v * 0.75;
        ctx.fillRect(i * gap, mid - height / 2, Math.max(1, gap - 2), height);
      }
      ctx.globalAlpha = 1;
      return;
    }

    // Trace mode.
    const step = capabilities.tier === 'low' ? 3 : 2;
    ctx.lineWidth = this.lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Ghost of the previous state, one frame behind — reads as phosphor decay.
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      ctx.strokeStyle = pass === 0 ? this.accent : this.color;
      ctx.globalAlpha = pass === 0 ? 0.22 * (1 - lock) + 0.1 : 1;
      const shift = pass === 0 ? 0.12 : 0;
      for (let x = 0; x <= this.w; x += step) {
        const u = x / this.w;
        const carrier = Math.sin(u * Math.PI * 2 * freq + this.t * 2.4 + shift);
        const harmonic = Math.sin(u * Math.PI * 2 * freq * 2.7 - this.t * 1.1) * 0.28;
        const n =
          Math.sin(u * 811.0 + this.t * 21.0 + this.seeds[0]) *
          Math.sin(u * 331.0 - this.t * 13.0 + this.seeds[1]);
        const v = (carrier + harmonic * (1 - noise * 0.5)) * (1 - noise * 0.72) + n * noise;
        const y = mid - v * amp * level * mid * 0.86;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Lock indicator: a centre line that resolves as the carrier is acquired.
    if (lock > 0.01) {
      ctx.globalAlpha = lock * 0.35;
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(this.w * lock, mid);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  destroy() {
    if (this._stop) this._stop();
    window.removeEventListener('resize', this._onResize);
    this.ctx = null;
  }
}
