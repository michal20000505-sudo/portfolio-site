/**
 * loader.js — ExperienceLoader.
 *
 * The loading screen is the first scene, not a delay before it. It shows the
 * receiver acquiring the carrier: a frequency sweep that lands on 1420.405 MHz,
 * a noise floor that settles, coordinates that resolve, and a waveform that
 * stops thrashing as the archive comes up.
 *
 * Each step gates on *real* work — shader compilation reports into
 * `setProgress` — and on a minimum dwell time, so a fast machine still sees the
 * sequence and a slow one is never lied to.
 */

import { Waveform } from './waveform.js';
import { loop, PRIORITY } from '../core/loop.js';
import { clamp, ease, lerp } from '../core/math.js';
import { scramble } from '../core/type.js';
import { capabilities } from '../core/capabilities.js';
import { RECORD } from '../data/archive.js';

/** [label, dwell seconds, real-progress threshold to pass] */
const STEPS = [
  ['SEARCHING FREQUENCY', 1.05, 0.0],
  ['NOISE FLOOR', 0.75, 0.0],
  ['COORDINATE LOCK', 0.95, 0.2],
  ['SOURCE VERIFICATION', 0.85, 0.6],
  ['ARCHIVE RECONSTRUCTION', 0.9, 1.0],
];

export class ExperienceLoader {
  constructor(root) {
    this.root = root;
    this.real = 0;
    this.realLabel = '';
    this.step = 0;
    this.stepTime = 0;
    this.t = 0;
    this.done = false;
    this._resolve = null;
  }

  mount() {
    this.freqEl = this.root.querySelector('[data-load-freq]');
    this.floorEl = this.root.querySelector('[data-load-floor]');
    this.stateEl = this.root.querySelector('[data-load-state]');
    this.coordEl = this.root.querySelector('[data-load-coord]');
    this.barEl = this.root.querySelector('[data-load-bar]');
    this.listEl = this.root.querySelector('[data-load-steps]');

    this.rows = STEPS.map(([label]) => {
      const li = document.createElement('li');
      li.className = 'load-step';
      li.innerHTML =
        `<span class="load-step-label">${label}</span>` +
        `<span class="load-step-state" aria-hidden="true">····</span>`;
      this.listEl.appendChild(li);
      return { li, state: li.querySelector('.load-step-state') };
    });

    this.wave = new Waveform(this.root.querySelector('[data-load-wave]'), {
      color: 'rgba(226,226,222,0.9)',
      accent: 'rgba(255,158,66,0.85)',
    });
    this.wave.jump({ noise: 1, amp: 0.85, freq: 2.4, lock: 0, level: 1 });

    this._stop = loop.add(this.update.bind(this), PRIORITY.UI);
    return this;
  }

  /** Called by SignalCanvas as programs compile. */
  setProgress(label, fraction) {
    this.real = clamp(fraction);
    this.realLabel = label;
  }

  /** Resolves once every step has both dwelled and cleared its real threshold. */
  run() {
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.stepTime += dt;

    const [, dwell, threshold] = STEPS[Math.min(this.step, STEPS.length - 1)];
    const settled = clamp(this.stepTime / dwell);
    const overall = clamp((this.step + settled) / STEPS.length);

    /* Frequency sweep — converges on the hydrogen line, overshooting once. */
    const sweep = ease.inOutExpo(clamp(overall * 1.15));
    const wobble = (1 - sweep) * Math.sin(this.t * 11.0) * 1.6;
    const freq = lerp(1401.2, RECORD.frequencyMHz, sweep) + wobble;
    if (this.freqEl) this.freqEl.textContent = `${freq.toFixed(3)} MHz`;

    /* Noise floor drops as the receiver settles. */
    const floor = lerp(-71.5, RECORD.noiseFloorDbm, ease.outQuart(overall)) + (1 - overall) * Math.sin(this.t * 7.3) * 3.2;
    if (this.floorEl) this.floorEl.textContent = `${floor.toFixed(1)} dBm`;

    /* Signal-strength bar: information, not a percentage. */
    if (this.barEl) this.barEl.style.setProperty('--level', overall.toFixed(4));

    /* The trace stabilises as the carrier is acquired. */
    this.wave.set({
      noise: 1 - ease.outCubic(overall) * 0.94,
      amp: lerp(0.85, 0.42, overall),
      freq: lerp(2.4, 4.6, overall),
      lock: overall,
      level: 1,
    });

    if (this.stateEl && this.step >= 3) this.stateEl.classList.add('is-visible');

    /* Advance when this step has both had its time and cleared real work. */
    if (settled >= 1 && this.real >= threshold - 1e-6) {
      this.#completeStep(this.step);
      this.step++;
      this.stepTime = 0;
      if (this.step >= STEPS.length) this.#finish();
    }
  }

  #completeStep(i) {
    const row = this.rows[i];
    if (!row || row.li.dataset.done) return;
    row.li.dataset.done = 'true';
    row.li.classList.add('is-done');
    row.state.textContent = 'OK';

    if (i === 2 && this.coordEl) {
      const { ra, dec } = RECORD;
      scramble(
        this.coordEl,
        `${String(ra.h).padStart(2, '0')}h ${ra.m}m ${ra.s.toFixed(1)}s  ${dec.d}° ${dec.m}′ ${dec.s.toFixed(1)}″`,
        { duration: 0.7 }
      );
    }
    if (i === 3 && this.stateEl) {
      scramble(this.stateEl.querySelector('[data-load-status]'), RECORD.sourceStatus, { duration: 0.6 });
    }
  }

  #finish() {
    this.done = true;
    if (this._resolve) this._resolve();
  }

  /**
   * Hand over to the opening scene. The waveform collapses toward the centre
   * and the panel dissolves — the point of light is already burning behind it,
   * so there is nothing to cut to.
   */
  outro() {
    return new Promise((resolve) => {
      this.root.classList.add('is-leaving');
      this.wave.set({ amp: 0.02, noise: 0, level: 0.1, lock: 1 });
      const duration = capabilities.quiet ? 240 : 1500;
      setTimeout(() => {
        this.root.hidden = true;
        this.destroy();
        resolve();
      }, duration);
    });
  }

  destroy() {
    if (this._stop) this._stop();
    if (this.wave) this.wave.destroy();
    this.wave = null;
  }
}
