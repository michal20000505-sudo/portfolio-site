/**
 * decoding.js — Chapter 04. DecoderInterface.
 *
 * Three controls, one correct alignment. Lock is the product of three Gaussians,
 * so partial credit is visible: the message does not appear at a threshold, it
 * comes up out of the noise as you get closer, character by character, in an
 * order that has nothing to do with reading direction.
 *
 * When it resolves, the site stops. The grain settles, the shaders dim, the mix
 * empties. Silence is the loudest thing available here and it is used once.
 */

import { DECODE } from '../data/archive.js';
import { Waveform } from '../ui/waveform.js';
import { loop, PRIORITY } from '../core/loop.js';
import { clamp, damp, ease, mulberry32 } from '../core/math.js';
import { capabilities } from '../core/capabilities.js';

const GLYPHS = '▚▞▛▙◤◥╱╲┤├┼╳ᛜᚦᚨᚱ⟟⏃⌇⏁△▽';
const HOLD_TO_UNLOCK = 8; // seconds of stillness with the decoded message

export function createDecoding({ stage, canvas, sound, onStillness, onUnlock }) {
  const controlsEl = stage.querySelector('[data-dec-controls]');
  const messageEl = stage.querySelector('[data-dec-message]');
  const lockEl = stage.querySelector('[data-dec-lock]');
  const statusEl = stage.querySelector('[data-dec-status]');
  const liveEl = stage.querySelector('[data-dec-live]');
  const hintEl = stage.querySelector('[data-dec-hint]');
  const noteEl = stage.querySelector('[data-dec-note]');
  const unlockEl = stage.querySelector('[data-dec-unlock]');

  const wave = new Waveform(stage.querySelector('[data-dec-wave]'), {
    color: 'rgba(226,226,222,0.7)',
    accent: 'rgba(255,158,66,0.85)',
  });
  wave.jump({ noise: 1, amp: 0.7, freq: 2.2, lock: 0, level: 1 });

  /* ── Controls ───────────────────────────────────────────────────────── */
  const controls = DECODE.controls.map((spec) => {
    const wrap = document.createElement('div');
    wrap.className = 'control';
    const id = `dec-${spec.id}`;
    wrap.innerHTML = `
      <div class="control-head">
        <label class="control-label" for="${id}">${spec.label}</label>
        <output class="control-value" for="${id}" data-out></output>
      </div>
      <div class="control-track">
        <input class="control-input" type="range" id="${id}"
               min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${spec.start}"
               data-cursor="decode" data-cursor-label="tune"
               aria-describedby="${id}-desc">
        <span class="control-fill" aria-hidden="true"></span>
        <span class="control-ticks" aria-hidden="true"></span>
      </div>
      <p class="control-hint" id="${id}-desc">${DECODE.hints[spec.id]}</p>`;
    controlsEl.appendChild(wrap);

    const input = wrap.querySelector('input');
    const out = wrap.querySelector('[data-out]');

    const format = (v) =>
      spec.id === 'alignment' ? v.toFixed(2) : spec.id === 'frequency' ? v.toFixed(1) : String(Math.round(v));

    const sync = () => {
      const v = Number(input.value);
      out.textContent = `${format(v)}${spec.unit ? ` ${spec.unit}` : ''}`;
      input.setAttribute('aria-valuetext', `${format(v)} ${spec.unit || ''}`.trim());
      wrap.style.setProperty('--v', ((v - spec.min) / (spec.max - spec.min)).toFixed(4));
    };

    input.addEventListener('input', () => {
      sync();
      touch();
      if (soundGate <= 0) { sound.ping('decode'); soundGate = 0.09; }
    });
    sync();

    return { spec, input, wrap, out };
  });

  /* ── Message ────────────────────────────────────────────────────────── */
  const text = DECODE.message;
  const chars = [];
  {
    // A fixed but scrambled resolution order: the sentence assembles itself.
    const order = Array.from({ length: text.length }, (_, i) => i);
    const rnd = mulberry32(0x1420);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const thresholds = new Array(text.length);
    order.forEach((idx, rank) => { thresholds[idx] = 0.18 + (rank / text.length) * 0.78; });

    /*
     * Characters resolve individually, but they are grouped per word: without
     * the wrapper each inline-block glyph is its own break opportunity and the
     * browser will happily split "LIGHT" across two lines. The one sentence the
     * whole site is built toward cannot be allowed to hyphenate itself.
     */
    let index = 0;
    const words = text.split(' ');
    words.forEach((word, w) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'msg-word';
      for (const ch of word) {
        const i = index++;
        const sp = document.createElement('span');
        sp.className = 'msg-char';
        sp.style.setProperty('--i', i);

        /*
         * Two layers per character. The ghost is the *final* letter, hidden but
         * in flow, so the cell is the width it will end up being. The noise
         * glyph is absolutely positioned on top and costs no space.
         *
         * Without this the scrambler reflows the whole chapter: none of these
         * glyphs exist in the display face, so each one resolves to a different
         * fallback font with a different advance width, and the line breaks —
         * and therefore the block height — change several times a second.
         */
        const ghost = document.createElement('i');
        ghost.className = 'msg-ghost';
        ghost.textContent = ch;
        const live = document.createElement('i');
        live.className = 'msg-live';
        live.textContent = GLYPHS[i % GLYPHS.length];
        live.setAttribute('aria-hidden', 'true');
        sp.append(ghost, live);

        wordEl.appendChild(sp);
        chars.push({ el: sp, live, ch, threshold: thresholds[i], resolved: false, seed: i });
      }
      messageEl.appendChild(wordEl);
      if (w < words.length - 1) {
        index++; // the space still consumes a threshold slot
        const gap = document.createElement('span');
        gap.className = 'msg-space';
        gap.textContent = ' ';
        messageEl.appendChild(gap);
      }
    });
    messageEl.setAttribute('aria-label', 'Decoded message');
  }

  /* ── State ──────────────────────────────────────────────────────────── */
  const state = {
    lock: 0,
    smoothLock: 0,
    locked: false,
    stillness: 0,
    sinceTouch: 0,
    sinceLock: 0,
    announced: false,
    hinted: 0,
  };
  let soundGate = 0;
  let glyphClock = 0;

  function touch() {
    state.sinceTouch = 0;
    if (state.locked) {
      // Moving away from the lock lets the message dissolve again.
      state.sinceLock = 0;
    }
  }

  function computeLock() {
    let product = 1;
    for (const c of controls) {
      const v = Number(c.input.value);
      const d = (v - c.spec.target) / c.spec.tolerance;
      const score = Math.exp(-d * d);
      c.wrap.style.setProperty('--score', score.toFixed(3));
      product *= score;
    }
    return clamp(product);
  }

  function frame(dt) {
    soundGate = Math.max(0, soundGate - dt);
    state.sinceTouch += dt;
    glyphClock += dt;

    state.lock = computeLock();
    state.smoothLock = damp(state.smoothLock, state.lock, 0.004, dt);
    const lock = state.smoothLock;

    /* Lock acquisition, with hysteresis so it cannot flicker. */
    if (!state.locked && lock > 0.965) {
      state.locked = true;
      state.sinceLock = 0;
      stage.classList.add('is-locked');
      sound.ping('lock');
      canvas.burst(0.4);
      if (liveEl) liveEl.textContent = `Carrier locked. Decoded message: ${text}`;
      state.announced = true;
    } else if (state.locked && lock < 0.72) {
      state.locked = false;
      stage.classList.remove('is-locked');
      state.sinceLock = 0;
      if (unlockEl) unlockEl.classList.remove('is-visible');
    }

    if (state.locked) state.sinceLock += dt;

    /*
     * Stillness. Everything on the page reads this: the shaders dim, the grain
     * settles, the mix empties. It ramps in over two seconds so the quiet
     * arrives rather than switching on.
     */
    const target = state.locked ? clamp(state.sinceLock / 2.0) : 0;
    state.stillness = damp(state.stillness, target, 0.0008, dt);
    onStillness && onStillness(state.stillness);

    /* Characters resolve individually against their own threshold. */
    const scrambleRate = glyphClock > 0.055;
    if (scrambleRate) glyphClock = 0;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const resolved = lock >= c.threshold;
      if (resolved !== c.resolved) {
        c.resolved = resolved;
        // The class swaps which layer is visible; neither move affects layout.
        c.el.classList.toggle('is-resolved', resolved);
        if (!resolved) c.live.textContent = GLYPHS[(i + 3) % GLYPHS.length];
      } else if (!resolved && scrambleRate && !capabilities.quiet) {
        c.live.textContent = GLYPHS[Math.floor((Math.random() * 0.999 + i) * 7) % GLYPHS.length];
      }
      // Characters near their threshold flicker between states.
      const edge = clamp(1 - Math.abs(lock - c.threshold) * 9);
      c.el.style.setProperty('--edge', edge.toFixed(3));
    }

    messageEl.style.setProperty('--lock', lock.toFixed(4));
    if (lockEl) lockEl.style.setProperty('--lock', lock.toFixed(4));
    if (statusEl) {
      statusEl.textContent = state.locked
        ? 'CARRIER LOCKED'
        : lock > 0.6 ? 'PARTIAL RESOLUTION'
        : lock > 0.25 ? 'ACQUIRING' : 'NO LOCK';
      statusEl.dataset.tone = state.locked ? 'ok' : lock > 0.25 ? 'warn' : 'none';
    }

    /* After a long unproductive search, the archive starts helping. */
    if (!state.locked && state.hinted < controls.length) {
      const elapsed = loop.time;
      const due = 34 + state.hinted * 16;
      if (elapsed > due) {
        controls[state.hinted].wrap.classList.add('show-hint');
        state.hinted++;
        if (hintEl) hintEl.classList.add('is-visible');
      }
    }

    /*
     * The hidden record. It is not a keyboard shortcut or a konami code — it is
     * given to whoever stays with the message after it resolves and does not
     * immediately reach for the next thing.
     */
    if (state.locked && state.sinceLock > HOLD_TO_UNLOCK && state.sinceTouch > HOLD_TO_UNLOCK) {
      if (unlockEl && !unlockEl.classList.contains('is-visible')) {
        unlockEl.classList.add('is-visible');
        onUnlock && onUnlock();
      }
    }

    wave.set({
      noise: 1 - lock * 0.97,
      amp: 0.28 + lock * 0.4,
      freq: 1.8 + lock * 3.0,
      lock,
      level: 1 - state.stillness * 0.75,
    });

    if (noteEl) noteEl.style.opacity = (state.stillness * 0.85).toFixed(3);
  }

  const stopFrame = loop.add(frame, PRIORITY.SCENE);

  return {
    setLive(live) {
      if (!live) {
        state.sinceLock = 0;
        state.stillness = 0;
        onStillness && onStillness(0);
      }
    },

    update(progress, weight) {
      /* The decoder is deliberately the least visually loud chapter. */
      const calm = 1 - state.stillness;
      canvas.addOpacity('field', weight * 0.42 * calm);
      canvas.addOpacity('core', weight * 0.30 * calm);
      if (weight > 0.5) {
        canvas.set('core', {
          uRadius: 0.0016 + state.smoothLock * 0.0022,
          uField: 0.5, uDust: 0.8,
          uMass: 0.3 + state.smoothLock * 0.5,
          uHold: 0, uExpand: 0, uPulse: state.smoothLock * 0.2,
          uProgress: 0, uCollapse: 0,
        });
        canvas.set('field', { uTravel: progress * 0.3, uAudio: 0.12 * calm });
      }

      const enter = ease.outQuart(clamp((progress - 0.04) / 0.16));
      const leave = ease.inOutCubic(clamp((progress - 0.86) / 0.14));
      stage.style.setProperty('--ui', (enter * (1 - leave)).toFixed(3));
      stage.style.setProperty('--still', state.stillness.toFixed(3));
    },

    destroy() {
      stopFrame();
      wave.destroy();
    },
  };
}
