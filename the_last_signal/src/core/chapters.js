/**
 * chapters.js — ChapterController.
 *
 * The document is a stack of empty spacers that exist only to create scroll
 * distance. All visible content lives in fixed full-viewport stages whose state
 * is derived from the smoothed scroll position. Chapters overlap in a
 * partition-of-unity crossfade, so at no point is the screen empty.
 *
 * Continuous position `x` reads as "chapter index + progress through it":
 * x = 2.34 means 34% into chapter 02.
 */

import { CHAPTERS } from '../data/archive.js';
import { scroll } from './scroll.js';
import { loop, PRIORITY } from './loop.js';
import { clamp, crossfadeWeight } from './math.js';
import { capabilities } from './capabilities.js';

const OVERLAP = 0.09;

export class ChapterController {
  constructor() {
    this.chapters = CHAPTERS.map((c) => ({
      ...c,
      top: 0,
      height: 1,
      weight: 0,
      progress: 0,
      live: false,
      stage: null,
      segment: null,
      scene: null,
    }));
    this.x = 0;
    this.active = 0;
    this.listeners = new Set();
    this._unsubscribe = null;
  }

  mount(trackEl) {
    this.track = trackEl;
    this.chapters.forEach((c) => {
      const segment = document.createElement('div');
      segment.className = 'track-seg';
      segment.dataset.chapter = c.id;
      trackEl.appendChild(segment);
      c.segment = segment;
      c.stage = document.querySelector(`.stage[data-chapter="${c.id}"]`);
    });
    this.measure();
    this._unsubscribe = loop.add(this.update.bind(this), PRIORITY.CHAPTERS);
    window.addEventListener('resize', this._onResize = () => this.measure(), { passive: true });
    return this;
  }

  /** Register a scene module. It receives `update(progress, weight, dt)`. */
  attach(id, scene) {
    const chapter = this.chapters.find((c) => c.id === id);
    if (chapter) chapter.scene = scene;
    return this;
  }

  measure() {
    const vh = window.innerHeight;
    let offset = 0;
    this.chapters.forEach((c) => {
      const units = capabilities.narrow ? c.mobile : c.length;
      c.height = Math.round(units * vh);
      c.top = offset;
      offset += c.height;
      if (c.segment) c.segment.style.height = `${c.height}px`;
    });
    this.total = offset;
    scroll.measure();
  }

  /** Absolute document Y at a given continuous chapter position. */
  yAt(index, progress = 0) {
    const c = this.chapters[clamp(index, 0, this.chapters.length - 1)];
    return c.top + c.height * progress;
  }

  update(dt) {
    const y = scroll.state.smooth;

    // Locate the chapter containing `y`, then express position continuously.
    let x = 0;
    for (let i = 0; i < this.chapters.length; i++) {
      const c = this.chapters[i];
      if (y < c.top + c.height || i === this.chapters.length - 1) {
        x = i + clamp((y - c.top) / c.height);
        break;
      }
    }
    this.x = x;

    const active = clamp(Math.floor(x), 0, this.chapters.length - 1);
    const activeChanged = active !== this.active;
    this.active = active;

    for (let i = 0; i < this.chapters.length; i++) {
      const c = this.chapters[i];
      const weight = clamp(crossfadeWeight(x, i, OVERLAP));
      const progress = clamp(x - i);
      c.weight = weight;
      c.progress = progress;

      const live = weight > 0.002;
      if (live !== c.live) {
        c.live = live;
        if (c.stage) {
          c.stage.classList.toggle('is-live', live);
          // Keep dormant chapters out of the tab order and the a11y tree.
          if (live) c.stage.removeAttribute('inert');
          else c.stage.setAttribute('inert', '');
        }
        if (c.scene && c.scene.setLive) c.scene.setLive(live);
      }

      if (c.stage) {
        c.stage.style.setProperty('--w', weight.toFixed(4));
        c.stage.style.setProperty('--p', progress.toFixed(4));
      }
      if (live && c.scene && c.scene.update) c.scene.update(progress, weight, dt);
    }

    if (activeChanged) this.listeners.forEach((fn) => fn(active, this.chapters[active]));
  }

  onActiveChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  goTo(index) {
    // Land a little inside the chapter so its opening beat plays.
    return scroll.to(this.yAt(index, 0.06), 1.6);
  }

  destroy() {
    if (this._unsubscribe) this._unsubscribe();
    window.removeEventListener('resize', this._onResize);
    this.chapters.forEach((c) => c.scene && c.scene.destroy && c.scene.destroy());
    this.listeners.clear();
  }
}
