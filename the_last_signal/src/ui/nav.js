/**
 * nav.js — ArchiveNavigation.
 *
 * Not a menu: a measuring rail. A hairline runs the height of the viewport, a
 * tick shows where in the transmission you currently are, and each chapter is a
 * mark on the scale. On narrow screens the same rail lies down along the bottom
 * edge, keeping the idea and dropping the labels.
 */

import { CHAPTERS } from '../data/archive.js';
import { loop, PRIORITY } from '../core/loop.js';
import { proximity } from '../core/pointer.js';
import { capabilities } from '../core/capabilities.js';
import { clamp, damp } from '../core/math.js';

export class ArchiveNavigation {
  constructor(root, controller) {
    this.root = root;
    this.controller = controller;
    this.items = [];
    this.magnetics = [];
  }

  mount() {
    const list = this.root.querySelector('[data-nav-list]');
    this.tick = this.root.querySelector('[data-nav-tick]');
    this.fill = this.root.querySelector('[data-nav-fill]');
    this.readout = this.root.querySelector('[data-nav-readout]');

    CHAPTERS.forEach((chapter, i) => {
      const li = document.createElement('li');
      li.className = 'nav-item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-link';
      button.dataset.cursor = 'enter';
      button.dataset.cursorLabel = chapter.title.toLowerCase();
      button.setAttribute('aria-label', `Chapter ${chapter.index} — ${chapter.title}`);
      button.innerHTML =
        `<span class="nav-index">${chapter.index}</span>` +
        `<span class="nav-title">${chapter.title}</span>` +
        `<span class="nav-rule" aria-hidden="true"></span>`;

      button.addEventListener('click', () => this.controller.goTo(i));
      li.appendChild(button);
      list.appendChild(li);

      this.items.push({ button, chapter, li });
      this.magnetics.push({ el: button, x: 0, y: 0 });
    });

    this._stop = loop.add(this.update.bind(this), PRIORITY.UI);
    this._off = this.controller.onActiveChange((index) => this.setActive(index));
    this.setActive(0);
    return this;
  }

  setActive(index) {
    this.items.forEach((item, i) => {
      const current = i === index;
      item.button.classList.toggle('is-current', current);
      item.button.setAttribute('aria-current', current ? 'step' : 'false');
    });
    if (this.readout) {
      const c = CHAPTERS[index];
      this.readout.textContent = `${c.index} · ${c.title.toUpperCase()}`;
    }
  }

  update(dt) {
    const total = this.controller.chapters.length;
    const p = clamp(this.controller.x / total);

    if (this.tick) this.tick.style.setProperty('--pos', p.toFixed(4));
    if (this.fill) this.fill.style.setProperty('--fill', p.toFixed(4));

    // Magnetic labels — only where a pointer exists to be magnetic toward.
    if (!capabilities.hover || capabilities.quiet) return;
    for (let i = 0; i < this.magnetics.length; i++) {
      const m = this.magnetics[i];
      const { amount, dx, dy } = proximity(m.el, 130);
      const pull = amount * amount;
      m.x = damp(m.x, dx * pull * 0.22, 0.002, dt);
      m.y = damp(m.y, dy * pull * 0.16, 0.002, dt);
      m.el.style.transform = `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0)`;
      m.el.style.setProperty('--near', pull.toFixed(3));
    }
  }

  destroy() {
    if (this._stop) this._stop();
    if (this._off) this._off();
    this.items = [];
    this.magnetics = [];
  }
}
