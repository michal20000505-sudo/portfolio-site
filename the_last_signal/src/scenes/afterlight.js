/**
 * afterlight.js — Chapter 05. AfterlightScene.
 *
 * Everything the site built is taken apart: the ribbon is gone, the star is
 * gone, and what is left is the same point of light the visitor first held —
 * rendered by the same program, which is the argument.
 *
 * The reply is real input and goes nowhere. It is not stored, not sent, not
 * counted. It exists for as long as it takes to fall out of the frame, which is
 * roughly what the chapter is about.
 */

import { RECORD, CREDITS } from '../data/archive.js';
import { loop, PRIORITY } from '../core/loop.js';
import { clamp, damp, ease, lerp } from '../core/math.js';
import { counter, scramble } from '../core/type.js';
import { capabilities } from '../core/capabilities.js';

export function createAfterlight({ stage, canvas, sound }) {
  const form = stage.querySelector('[data-af-form]');
  const input = stage.querySelector('[data-af-input]');
  const submit = stage.querySelector('[data-af-submit]');
  const outbox = stage.querySelector('[data-af-outbox]');
  const arrivalEl = stage.querySelector('[data-af-arrival]');
  const arrivalYears = stage.querySelector('[data-af-years]');
  const creditsEl = stage.querySelector('[data-af-credits]');
  const countEl = stage.querySelector('[data-af-count]');

  CREDITS.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'credit-row';
    row.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    creditsEl.appendChild(row);
  });

  const outgoing = [];
  let sentCount = 0;
  let arrivalShown = false;

  function transmit(message) {
    const el = document.createElement('p');
    el.className = 'outgoing';
    el.textContent = message;
    el.setAttribute('aria-hidden', 'true');
    outbox.appendChild(el);

    outgoing.push({ el, t: 0, life: capabilities.quiet ? 3.2 : 9.0 });
    sentCount++;
    if (countEl) countEl.textContent = String(sentCount).padStart(2, '0');

    sound.ping('transmit');
    canvas.burst(0.3);

    // Announce for screen readers, then let the visual departure play out.
    const live = stage.querySelector('[data-af-live]');
    if (live) live.textContent = `Reply transmitted. Estimated arrival ${RECORD.responseArrivalYears.toLocaleString('en-US')} years.`;

    if (!arrivalShown) {
      arrivalShown = true;
      setTimeout(() => {
        arrivalEl.classList.add('is-visible');
        counter(arrivalYears, RECORD.responseArrivalYears, { duration: 3.4 });
      }, capabilities.quiet ? 200 : 1600);
    }
  }

  const onSubmit = (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) {
      input.classList.add('is-empty');
      setTimeout(() => input.classList.remove('is-empty'), 600);
      input.focus();
      return;
    }
    transmit(value.slice(0, 140));
    input.value = '';
    form.classList.add('has-sent');
  };
  form.addEventListener('submit', onSubmit);

  const onInput = () => {
    submit.disabled = input.value.trim().length === 0;
  };
  input.addEventListener('input', onInput);
  onInput();

  /* ── Frame: departing messages ──────────────────────────────────────── */
  function frame(dt) {
    for (let i = outgoing.length - 1; i >= 0; i--) {
      const m = outgoing[i];
      m.t += dt;
      const k = clamp(m.t / m.life);
      // Slow at first, then gone: distance does the work, not the easing curve.
      const e = ease.inOutQuint(k);
      const scale = lerp(1, 0.04, e);
      const y = -lerp(0, 46, e);
      const blur = capabilities.tier === 'high' ? lerp(0, 3.5, ease.inQuad(k)) : 0;
      m.el.style.transform = `translate3d(0, ${y.toFixed(2)}vh, 0) scale(${scale.toFixed(4)})`;
      m.el.style.opacity = (1 - ease.inQuad(k)).toFixed(3);
      m.el.style.filter = blur ? `blur(${blur.toFixed(2)}px)` : 'none';
      if (k >= 1) {
        m.el.remove();
        outgoing.splice(i, 1);
      }
    }
  }
  const stopFrame = loop.add(frame, PRIORITY.SCENE);

  let announced = false;
  const smooth = { collapse: 0 };

  return {
    setLive(live) {
      if (live && !announced) {
        announced = true;
        const line = stage.querySelector('[data-af-line]');
        if (line) scramble(line, 'The source is gone.', { duration: 1.0 });
      }
    },

    update(progress, weight, dt) {
      canvas.addOpacity('afterlight', weight);

      smooth.collapse = damp(smooth.collapse, progress, 0.002, dt);

      /*
       * The same optics as chapter 00, run backwards: the field thins, the mass
       * relaxes, and the point contracts until it is smaller than it began.
       */
      canvas.set('afterlight', {
        uRadius: lerp(0.0075, 0.0016, ease.inOutCubic(clamp(progress / 0.6))),
        uHold: 0,
        uExpand: 0,
        uMass: lerp(0.85, 0.12, progress),
        uField: lerp(0.9, 0.28, progress),
        uDust: lerp(1.1, 0.35, progress),
        uPulse: sound.level * 0.12,
        uProgress: clamp((progress - 0.55) / 0.45),
        uCollapse: 1,
      });

      const one = ease.outQuart(clamp((progress - 0.06) / 0.20));
      const two = ease.outQuart(clamp((progress - 0.26) / 0.20));
      const formIn = ease.outQuart(clamp((progress - 0.42) / 0.18));
      const creditsIn = ease.outQuart(clamp((progress - 0.74) / 0.20));

      stage.style.setProperty('--l1', one.toFixed(3));
      stage.style.setProperty('--l2', two.toFixed(3));
      stage.style.setProperty('--form', formIn.toFixed(3));
      stage.style.setProperty('--credits', creditsIn.toFixed(3));
      form.style.pointerEvents = formIn > 0.7 ? 'auto' : 'none';
      form.setAttribute('aria-hidden', formIn > 0.7 ? 'false' : 'true');
    },

    destroy() {
      stopFrame();
      form.removeEventListener('submit', onSubmit);
      input.removeEventListener('input', onInput);
      outgoing.forEach((m) => m.el.remove());
      outgoing.length = 0;
    },
  };
}
