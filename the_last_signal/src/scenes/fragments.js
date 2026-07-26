/**
 * fragments.js — Chapter 03. FragmentArchive.
 *
 * A field, not a grid. Each recovered object sits where the curator put it, at
 * its own depth, and behaves according to what it is: the recording drifts, the
 * reconstruction resists being looked at, the verified sentence holds still.
 *
 * On narrow screens the field becomes a deliberate vertical sequence — the same
 * objects, re-curated for a column, rather than a wide layout squeezed.
 */

import { FRAGMENTS, HIDDEN_FRAGMENT } from '../data/archive.js';
import { paintFragment } from './visuals.js';
import { loop, PRIORITY } from '../core/loop.js';
import { clamp, damp, ease, lerp, noise1 } from '../core/math.js';
import { capabilities } from '../core/capabilities.js';
import { pointer } from '../core/pointer.js';
import { scroll } from '../core/scroll.js';

export function createFragments({ stage, canvas, sound, cursor }) {
  const field = stage.querySelector('[data-frag-field]');
  const focusEl = stage.querySelector('[data-frag-focus]');
  const focusArt = focusEl.querySelector('[data-focus-art]');
  const focusMeta = focusEl.querySelector('[data-focus-meta]');
  const focusClose = focusEl.querySelector('[data-focus-close]');
  const counterEl = stage.querySelector('[data-frag-count]');

  const cards = [];
  let focused = null;
  let lastFocusedTrigger = null;
  let hoverCue = 0;

  /* ── Card construction ──────────────────────────────────────────────── */
  function build(data, index) {
    const el = document.createElement('article');
    el.className = 'fragment';
    el.dataset.visual = data.visual;
    if (data.hidden) el.dataset.hidden = 'true';
    el.style.setProperty('--depth', data.depth.toFixed(3));
    el.style.setProperty('--rot', `${data.rot}deg`);
    el.style.setProperty('--fx', String(data.x));
    el.style.setProperty('--fy', String(data.y));
    el.style.setProperty('--i', index);

    el.innerHTML = `
      <button class="fragment-trigger" type="button"
              data-cursor="observe" data-cursor-label="open"
              aria-label="Fragment ${data.id} — ${data.title}. Open detail.">
        <span class="fragment-plate">
          <canvas class="fragment-art" aria-hidden="true"></canvas>
          <span class="fragment-scrim" aria-hidden="true"></span>
          <span class="fragment-marks" aria-hidden="true">
            <span class="mark mark-tl"></span><span class="mark mark-tr"></span>
            <span class="mark mark-bl"></span><span class="mark mark-br"></span>
          </span>
        </span>
        <span class="fragment-head">
          <span class="fragment-id">FRAGMENT ${data.id}</span>
          <span class="fragment-title">${data.title}</span>
        </span>
        <span class="fragment-meta" aria-hidden="true">
          <span class="meta-row"><span>Integrity</span><span class="meta-bar"><i style="--v:${data.integrity}"></i></span><span>${Math.round(data.integrity * 100)}%</span></span>
          <span class="meta-row"><span>Medium</span><span class="meta-rule"></span><span>${data.medium}</span></span>
          <span class="meta-row"><span>Status</span><span class="meta-rule"></span><span>${data.stamp}</span></span>
        </span>
      </button>`;

    field.appendChild(el);

    const card = {
      data,
      el,
      trigger: el.querySelector('.fragment-trigger'),
      art: el.querySelector('.fragment-art'),
      painted: false,
      hover: 0,
      near: 0,
      /** drag offset and its spring velocity */
      dx: 0, dy: 0, vx: 0, vy: 0,
      dragging: false,
      grabX: 0, grabY: 0,
      seed: 100 + index * 37,
    };

    bindCard(card);
    cards.push(card);
    return card;
  }

  function bindCard(card) {
    const { trigger, el } = card;

    trigger.addEventListener('pointerenter', () => {
      if (hoverCue <= 0) {
        sound.ping('fragment');
        hoverCue = 0.35;
      }
    });
    trigger.addEventListener('click', (e) => {
      // A drag that moved should not also count as a click.
      if (card.moved) { card.moved = false; return; }
      e.preventDefault();
      openFocus(card);
    });

    /* Dragging. The card resists, then springs back — it is an object on a table. */
    const onDown = (e) => {
      if (focused) return;
      card.dragging = true;
      card.moved = false;
      card.grabX = e.clientX - card.dx;
      card.grabY = e.clientY - card.dy;
      trigger.setPointerCapture(e.pointerId);
      trigger.dataset.cursor = 'drag';
      el.classList.add('is-dragging');
    };
    const onMove = (e) => {
      if (!card.dragging) return;
      const nx = e.clientX - card.grabX;
      const ny = e.clientY - card.grabY;
      if (Math.hypot(nx - card.dx, ny - card.dy) > 0.5) card.moved = true;
      card.dx = nx;
      card.dy = ny;
    };
    const onUp = (e) => {
      if (!card.dragging) return;
      card.dragging = false;
      try { trigger.releasePointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      trigger.dataset.cursor = 'observe';
      el.classList.remove('is-dragging');
    };

    trigger.addEventListener('pointerdown', onDown);
    trigger.addEventListener('pointermove', onMove);
    trigger.addEventListener('pointerup', onUp);
    trigger.addEventListener('pointercancel', onUp);
    card._unbind = () => {
      trigger.removeEventListener('pointerdown', onDown);
      trigger.removeEventListener('pointermove', onMove);
      trigger.removeEventListener('pointerup', onUp);
      trigger.removeEventListener('pointercancel', onUp);
    };
  }

  FRAGMENTS.forEach(build);

  /* ── Focus mode ─────────────────────────────────────────────────────── */
  function openFocus(card) {
    focused = card;
    lastFocusedTrigger = card.trigger;
    stage.classList.add('has-focus');
    focusEl.hidden = false;
    focusEl.setAttribute('aria-hidden', 'false');
    scroll.lock();
    sound.ping('open');
    canvas.burst(0.35);

    const d = card.data;
    focusMeta.innerHTML = `
      <p class="focus-id">FRAGMENT ${d.id}</p>
      <h3 class="focus-title">${d.title}</h3>
      <p class="focus-note">${d.note}</p>
      <dl class="focus-data">
        <div><dt>Integrity</dt><dd>${Math.round(d.integrity * 100)}%</dd></div>
        <div><dt>Medium</dt><dd>${d.medium}</dd></div>
        <div><dt>Duration</dt><dd>${d.duration}</dd></div>
        <div><dt>Status</dt><dd>${d.stamp}</dd></div>
      </dl>`;

    // Repaint at the larger size: the artwork is resolution-independent.
    requestAnimationFrame(() => {
      paintFragment(focusArt, d.visual, card.seed);
      focusClose.focus();
    });
  }

  function closeFocus() {
    if (!focused) return;
    focused = null;
    stage.classList.remove('has-focus');
    focusEl.setAttribute('aria-hidden', 'true');
    scroll.unlock();
    setTimeout(() => { if (!focused) focusEl.hidden = true; }, 500);
    if (lastFocusedTrigger) lastFocusedTrigger.focus();
  }

  focusClose.addEventListener('click', closeFocus);
  focusEl.addEventListener('pointerdown', (e) => {
    if (e.target === focusEl) closeFocus();
  });

  const onKey = (e) => {
    if (e.key === 'Escape' && focused) {
      e.preventDefault();
      closeFocus();
    }
    // Rudimentary focus containment while the plate is open.
    if (e.key === 'Tab' && focused) {
      const focusables = focusEl.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey);

  /* ── The hidden record ──────────────────────────────────────────────── */
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const card = build(HIDDEN_FRAGMENT, FRAGMENTS.length);
    paintFragment(card.art, HIDDEN_FRAGMENT.visual, 900);
    card.painted = true;
    card.el.classList.add('is-arriving');
    updateCount();
    sound.ping('lock');
    canvas.burst(0.5);
  }

  function updateCount() {
    if (counterEl) counterEl.textContent = String(cards.length).padStart(2, '0');
  }
  updateCount();

  /* ── Frame ──────────────────────────────────────────────────────────── */
  let chapterProgress = 0;

  function frame(dt) {
    hoverCue = Math.max(0, hoverCue - dt);
    const quiet = capabilities.quiet;
    const t = loop.time;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const el = card.el;

      /* Spring the drag offset home unless it is being held. */
      if (!card.dragging) {
        const k = 26, damping = 9;
        card.vx += (-card.dx * k - card.vx * damping) * dt;
        card.vy += (-card.dy * k - card.vy * damping) * dt;
        card.dx += card.vx * dt;
        card.dy += card.vy * dt;
        if (Math.abs(card.dx) < 0.05 && Math.abs(card.vx) < 0.05) { card.dx = 0; card.vx = 0; }
        if (Math.abs(card.dy) < 0.05 && Math.abs(card.vy) < 0.05) { card.dy = 0; card.vy = 0; }
      } else {
        card.vx = 0;
        card.vy = 0;
      }

      /* Proximity: cards lean toward the pointer before it reaches them. */
      let nearAmount = 0;
      let leanX = 0;
      let leanY = 0;
      if (capabilities.hover && !focused) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(pointer.sx - cx, pointer.sy - cy);
        nearAmount = clamp(1 - dist / 420);
        leanX = (pointer.sx - cx) * nearAmount * 0.045;
        leanY = (pointer.sy - cy) * nearAmount * 0.045;
      }
      card.near = damp(card.near, nearAmount, 0.004, dt);

      const isHover = el.matches(':hover') || el.contains(document.activeElement);
      card.hover = damp(card.hover, isHover && !focused ? 1 : 0, 0.002, dt);

      /* Slow organic float — every card on its own clock, none on a sine. */
      const driftX = quiet ? 0 : noise1(t * 0.11 + i * 3.7, i) * 9 * card.data.depth;
      const driftY = quiet ? 0 : noise1(t * 0.09 + i * 8.1, i + 40) * 11 * card.data.depth;

      /*
       * Depth parallax against the chapter's own scroll. On narrow screens the
       * field is a strip that moves as one, so individual parallax would only
       * fight it.
       */
      const parallax = capabilities.narrow ? 0 : (chapterProgress - 0.5) * lerp(-70, -190, card.data.depth);

      const lift = card.hover * 26 + card.near * 6;
      const scale = 1 + card.hover * 0.055 + card.near * 0.012;

      el.style.setProperty('--tx', `${(driftX + leanX + card.dx).toFixed(2)}px`);
      el.style.setProperty('--ty', `${(driftY + leanY + card.dy + parallax - lift).toFixed(2)}px`);
      el.style.setProperty('--scale', scale.toFixed(4));
      el.style.setProperty('--hover', card.hover.toFixed(3));
      el.style.setProperty('--near', card.near.toFixed(3));
      /* Velocity skew: the field has weight when you throw it. */
      el.style.setProperty('--skew', quiet ? '0deg' : `${clamp(scroll.state.velocity / 900, -1, 1) * 1.6 * card.data.depth}deg`);
    }
  }

  const stopFrame = loop.add(frame, PRIORITY.SCENE);

  /* Paint artwork only when the chapter is first approached. */
  function paintAll() {
    cards.forEach((card) => {
      if (card.painted) return;
      paintFragment(card.art, card.data.visual, card.seed);
      card.painted = true;
    });
  }

  let repaintTimer = null;
  const onResize = () => {
    clearTimeout(repaintTimer);
    repaintTimer = setTimeout(() => {
      cards.forEach((card) => { card.painted = false; });
      paintAll();
      if (focused) paintFragment(focusArt, focused.data.visual, focused.seed);
    }, 220);
  };
  window.addEventListener('resize', onResize, { passive: true });

  return {
    unlock,
    get unlocked() { return unlocked; },

    setLive(live) {
      if (live) paintAll();
      else if (focused) closeFocus();
    },

    update(progress, weight) {
      chapterProgress = progress;

      /*
       * Mobile: the field is a single vertical strip pulled through the
       * viewport by chapter progress. No nested scroller, so the page never
       * traps the gesture — the archive simply passes by.
       */
      if (capabilities.narrow) {
        const overflow = Math.max(0, field.scrollHeight - window.innerHeight);
        field.style.setProperty('--strip', `${(-overflow * progress).toFixed(1)}px`);
      } else if (field.style.getPropertyValue('--strip')) {
        field.style.removeProperty('--strip');
      }

      /* The GL layers step back so the material chapter can be read. */
      canvas.addOpacity('field', weight * 0.30);
      canvas.addOpacity('core', weight * 0.22);
      if (weight > 0.5) {
        canvas.set('core', {
          uRadius: 0.0014, uField: 0.75, uDust: 1.1, uMass: 0.35,
          uHold: 0, uExpand: 0, uPulse: 0, uProgress: 0, uCollapse: 0,
        });
        canvas.set('field', { uTravel: progress * 0.4, uAudio: 0.1 });
      }

      /* Entrance and exit of the whole field, eased apart from the parallax. */
      const enter = ease.outQuart(clamp(progress / 0.18));
      const leave = ease.inOutCubic(clamp((progress - 0.84) / 0.16));
      stage.style.setProperty('--field-in', (enter * (1 - leave)).toFixed(3));
    },

    destroy() {
      stopFrame();
      clearTimeout(repaintTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      cards.forEach((c) => { c._unbind(); c.el.remove(); });
      cards.length = 0;
    },
  };
}
