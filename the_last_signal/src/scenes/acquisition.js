/**
 * acquisition.js — Chapter 00, and the gate into the whole experience.
 *
 * The site opens with no navigation and nothing to click. There is a point of
 * light, and it responds to you. The only way forward is to hold it — which is
 * also the only instruction the archive ever gives, and the reason the rest of
 * the site can afford to explain nothing.
 */

import { TELEMETRY, RECORD } from '../data/archive.js';
import { loop, PRIORITY } from '../core/loop.js';
import { clamp, damp, ease, lerp } from '../core/math.js';
import { scramble, jitterSeconds } from '../core/type.js';
import { capabilities } from '../core/capabilities.js';
import { scroll } from '../core/scroll.js';
import { pointer } from '../core/pointer.js';
import { Waveform } from '../ui/waveform.js';

const HOLD_SECONDS = 1.15;

export function createAcquisition({ stage, canvas, sound, cursor, onEnter }) {
  const gate = stage.querySelector('[data-acq-gate]');
  const button = stage.querySelector('[data-acq-hold]');
  const declareEl = stage.querySelector('[data-acq-declare]');
  const subEl = stage.querySelector('[data-acq-sub]');
  const promptEl = stage.querySelector('[data-acq-prompt]');
  const telemetryEl = stage.querySelector('[data-acq-telemetry]');
  const hintEl = stage.querySelector('[data-acq-hint]');
  const waveEl = stage.querySelector('[data-acq-wave]');

  const wave = new Waveform(waveEl, {
    color: 'rgba(226,226,222,0.55)',
    accent: 'rgba(255,158,66,0.7)',
    lineWidth: 1,
  });
  wave.jump({ noise: 0.55, amp: 0.45, freq: 3.4, lock: 0.2, level: 0.8 });

  /* ── Telemetry rows ─────────────────────────────────────────────────── */
  const rows = TELEMETRY.map((item, i) => {
    const li = document.createElement('li');
    li.className = 'telemetry-row';
    if (item.tone) li.dataset.tone = item.tone;
    li.style.setProperty('--i', i);
    li.innerHTML =
      `<span class="telemetry-key">${item.label}</span>` +
      `<span class="telemetry-rule" aria-hidden="true"></span>` +
      `<span class="telemetry-value" data-value>${item.value}</span>`;
    telemetryEl.appendChild(li);
    return { ...item, li, valueEl: li.querySelector('[data-value]') };
  });

  const state = {
    phase: 'dormant',
    t: 0,
    charge: 0,
    holding: false,
    expand: 0,
    entered: false,
    live: false,
    reveal: 0,
  };

  /* ── The hold gate ──────────────────────────────────────────────────── */
  function startHold() {
    if (state.phase !== 'gate' && state.phase !== 'charging') return;
    state.holding = true;
    state.phase = 'charging';
    gate.classList.add('is-charging');
    sound.ping('open');
  }

  function endHold() {
    if (state.phase !== 'charging') return;
    state.holding = false;
    if (state.charge < 1) gate.classList.remove('is-charging');
  }

  function enter() {
    if (state.entered) return;
    state.entered = true;
    state.phase = 'entering';
    state.holding = false;
    gate.classList.remove('is-charging');
    stage.classList.add('has-entered');
    document.documentElement.classList.add('has-entered');
    canvas.burst(0.85);
    sound.ping('lock');
    scroll.unlock();
    if (cursor) cursor.setProgress(0);
    onEnter && onEnter();
  }

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    startHold();
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startHold();
    }
  };
  const onKeyUp = (e) => {
    if (e.key === 'Enter' || e.key === ' ') endHold();
  };

  /*
   * The whole stage is the target, not just the button: the instruction is
   * "hold the signal", and the signal fills the screen. The button remains the
   * keyboard and screen-reader affordance for exactly the same action.
   */
  stage.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', endHold);
  window.addEventListener('pointercancel', endHold);
  button.addEventListener('keydown', onKeyDown);
  button.addEventListener('keyup', onKeyUp);

  /* Reduced motion: hold is still required, but it resolves quickly. */
  const holdDuration = capabilities.quiet ? 0.45 : HOLD_SECONDS;

  /* ── Opening timeline ───────────────────────────────────────────────── */
  function begin() {
    state.phase = 'acquiring';
    state.t = 0;
    scroll.lock();
  }

  function runOpening(dt) {
    state.t += dt;
    const t = state.t;
    const fast = capabilities.quiet;

    if (state.phase === 'acquiring') {
      if (t > (fast ? 0.2 : 1.5)) {
        scramble(declareEl, 'SIGNAL ACQUIRED', { duration: fast ? 0.01 : 0.9 });
        state.phase = 'declaring';
        state.t = 0;
      }
    } else if (state.phase === 'declaring') {
      if (t > (fast ? 0.5 : 2.6)) {
        declareEl.classList.add('is-swapping');
        scramble(declareEl, 'SOURCE NO LONGER EXISTS', { duration: fast ? 0.01 : 1.1 });
        subEl.classList.add('is-visible');
        state.phase = 'settling';
        state.t = 0;
      }
    } else if (state.phase === 'settling') {
      if (t > (fast ? 0.4 : 2.2)) {
        state.phase = 'gate';
        gate.classList.add('is-ready');
        promptEl.classList.add('is-visible');
        state.t = 0;
      }
    }
  }

  /* ── Frame ──────────────────────────────────────────────────────────── */
  function frame(dt) {
    if (state.phase === 'dormant') return;

    if (!state.entered) runOpening(dt);

    /* Charge integrates while held and bleeds away when released. */
    if (state.holding && state.phase === 'charging') {
      state.charge = clamp(state.charge + dt / holdDuration);
      if (state.charge >= 1) enter();
    } else if (!state.entered) {
      state.charge = Math.max(0, state.charge - dt * 1.9);
    }

    if (cursor && !state.entered) cursor.setProgress(state.charge);

    /* Expansion: a single restrained overshoot, then it settles into the field. */
    if (state.entered) {
      state.expand = damp(state.expand, 0, 0.0006, dt);
      if (state.expand < 0.001 && state.phase === 'entering') state.phase = 'entered';
    }
    if (state.phase === 'entering' && state.expand < 0.02 && state.t < 0.2) state.expand = 1;

    /* Telemetry: a few values are never quite still. */
    const time = loop.time;
    for (const row of rows) {
      if (!row.live) continue;
      if (row.live === 'signal') {
        row.valueEl.textContent = `${(RECORD.noiseFloorDbm + Math.sin(time * 0.9) * 0.4 + Math.sin(time * 3.1) * 0.15).toFixed(1)} dBm`;
      } else if (row.live === 'ra') {
        row.valueEl.textContent = `09h 27m ${jitterSeconds(RECORD.ra.s, time, 0.3)}s`;
      } else if (row.live === 'dec') {
        row.valueEl.textContent = `−54° 18′ ${jitterSeconds(RECORD.dec.s, time * 0.8, 0.25)}″`;
      }
    }

    wave.set({
      noise: state.entered ? 0.18 : 0.5 - state.charge * 0.35,
      amp: 0.32 + state.charge * 0.5 + sound.level * 0.2,
      lock: state.entered ? 1 : state.charge,
      level: 0.7 + sound.level * 0.5,
    });
  }

  const stopFrame = loop.add(frame, PRIORITY.SCENE);

  /* ── Chapter interface ──────────────────────────────────────────────── */
  return {
    begin,

    setLive(live) {
      state.live = live;
    },

    update(progress, weight) {
      canvas.addOpacity('core', weight);

      /*
       * The point of light grows from nothing during acquisition, then holds.
       * `uMass` rises as you approach it — the space around the signal tightens
       * when you get close, which is the entire premise of chapter 00.
       */
      const born = state.entered ? 1 : ease.outCubic(clamp(state.t / (capabilities.quiet ? 0.4 : 2.4)));
      const nearness = clamp(1 - Math.hypot(pointer.snx, pointer.sny) * 0.8);

      canvas.set('core', {
        uRadius: lerp(0.0012, 0.0062, born) * (1 + state.charge * 0.55) + progress * 0.004,
        uHold: state.entered ? 0 : state.charge,
        uExpand: state.expand * 0.42,
        uMass: (0.35 + nearness * 0.75) * (0.4 + born * 0.6),
        uField: lerp(0.15, 1.0, born) * (1 - progress * 0.35),
        uDust: 0.7 + progress * 0.6,
        uPulse: sound.level * 0.35,
        uProgress: progress,
        uCollapse: 0,
      });

      /* Content parallax: the opening statement leaves before the data does. */
      const out = ease.inOutCubic(clamp((progress - 0.12) / 0.5));
      declareEl.style.transform = `translate3d(0, ${(-out * 16).toFixed(2)}vh, 0)`;
      declareEl.style.opacity = (1 - out).toFixed(3);
      subEl.style.opacity = (1 - out * 1.4).toFixed(3);

      const revealTarget = state.entered ? clamp((progress - 0.06) / 0.34) : 0;
      state.reveal = damp(state.reveal, revealTarget, 0.02, 1 / 60);
      telemetryEl.style.setProperty('--reveal', state.reveal.toFixed(3));

      const leave = ease.inOutCubic(clamp((progress - 0.62) / 0.34));
      telemetryEl.style.opacity = (state.reveal * (1 - leave)).toFixed(3);
      telemetryEl.style.transform = `translate3d(0, ${(-leave * 8).toFixed(2)}vh, 0)`;

      if (hintEl) hintEl.style.opacity = (state.entered ? clamp(1 - progress * 6) : 0).toFixed(3);
    },

    destroy() {
      stopFrame();
      wave.destroy();
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', endHold);
      window.removeEventListener('pointercancel', endHold);
      button.removeEventListener('keydown', onKeyDown);
      button.removeEventListener('keyup', onKeyUp);
    },
  };
}
