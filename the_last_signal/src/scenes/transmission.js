/**
 * transmission.js — Chapter 02. TransmissionScene.
 *
 * The signal stops being a metaphor and becomes an object you move through.
 * Scroll drives the camera along the ribbon; the transport underneath drives
 * what the ribbon is *carrying*. Both are real controls — the timeline scrubs,
 * the bands change the spectrum, and the geometry answers to the cursor.
 */

import { TRANSMISSION_TOKENS, TRANSMISSION_BANDS } from '../data/archive.js';
import { loop, PRIORITY } from '../core/loop.js';
import { clamp, damp, lerp, mulberry32, smoothstep } from '../core/math.js';
import { capabilities } from '../core/capabilities.js';
import { pointer } from '../core/pointer.js';
import { Waveform } from '../ui/waveform.js';

const DURATION = 702; // 11:42 — the full recovered length of the transmission.

const clock = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function createTransmission({ stage, canvas, sound }) {
  const tokenLayer = stage.querySelector('[data-tx-tokens]');
  const playBtn = stage.querySelector('[data-tx-play]');
  const timeline = stage.querySelector('[data-tx-timeline]');
  const elapsedEl = stage.querySelector('[data-tx-elapsed]');
  const totalEl = stage.querySelector('[data-tx-total]');
  const bandList = stage.querySelector('[data-tx-bands]');
  const meterEl = stage.querySelector('[data-tx-meter]');
  const freqEl = stage.querySelector('[data-tx-freq]');

  totalEl.textContent = clock(DURATION);

  const wave = new Waveform(stage.querySelector('[data-tx-wave]'), {
    mode: 'bars',
    color: 'rgba(214,216,220,0.32)',
    accent: 'rgba(255,158,66,0.9)',
  });
  wave.jump({ noise: 0.4, amp: 0.9, freq: 3.0, lock: 0, level: 0.3 });

  /* ── Bands ──────────────────────────────────────────────────────────── */
  let band = 1;
  const bandButtons = TRANSMISSION_BANDS.map((b, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'band';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(i === band));
    btn.dataset.cursor = 'decode';
    btn.dataset.cursorLabel = 'tune';
    btn.innerHTML =
      `<span class="band-hz">${b.hz.toFixed(1)}</span>` +
      `<span class="band-label">${b.label}</span>`;
    btn.addEventListener('click', () => selectBand(i));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectBand((band + 1) % TRANSMISSION_BANDS.length);
        bandButtons[band].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectBand((band - 1 + TRANSMISSION_BANDS.length) % TRANSMISSION_BANDS.length);
        bandButtons[band].focus();
      }
    });
    li.appendChild(btn);
    bandList.appendChild(li);
    return btn;
  });

  function selectBand(i) {
    band = i;
    bandButtons.forEach((b, k) => {
      b.setAttribute('aria-checked', String(k === i));
      b.classList.toggle('is-on', k === i);
      b.tabIndex = k === i ? 0 : -1;
    });
    freqEl.textContent = `${TRANSMISSION_BANDS[i].hz.toFixed(3)} MHz`;
    sound.ping('decode');
    canvas.burst(0.22);
  }
  selectBand(band);

  /* ── Transport ──────────────────────────────────────────────────────── */
  const transport = { playing: false, position: 0, level: 0 };

  function setPlaying(next) {
    transport.playing = next;
    playBtn.setAttribute('aria-pressed', String(next));
    playBtn.classList.toggle('is-playing', next);
    playBtn.querySelector('[data-tx-play-label]').textContent = next ? 'Pause' : 'Play';
    if (next) sound.ping('decode');
  }

  playBtn.addEventListener('click', () => setPlaying(!transport.playing));

  timeline.addEventListener('input', () => {
    transport.position = Number(timeline.value) / 1000;
    elapsedEl.textContent = clock(transport.position * DURATION);
  });

  /* ── Floating tokens ────────────────────────────────────────────────── */
  const rand = mulberry32(0x7a11);
  const tokens = TRANSMISSION_TOKENS.map((token, i) => {
    const el = document.createElement('span');
    el.className = 'tx-token';
    el.dataset.kind = token.kind;
    el.textContent = token.t;
    el.setAttribute('aria-hidden', 'true');
    // Keep the middle band clear: the transport lives there.
    const angle = rand() * Math.PI * 2;
    const radius = lerp(0.20, 0.46, rand());
    const side = rand() > 0.5 ? 1 : -1;
    tokenLayer.appendChild(el);
    return {
      el,
      at: (i + 0.5) / TRANSMISSION_TOKENS.length,
      x: Math.cos(angle) * radius * side,
      y: Math.sin(angle) * radius * 0.82,
      spin: (rand() - 0.5) * 8,
    };
  });

  /* ── Pointer grab ───────────────────────────────────────────────────── */
  let grab = 0;
  const smooth = { travel: 0, amp: 1, audio: 0, focus: 0 };

  function frame(dt) {
    if (transport.playing) {
      transport.position += dt / DURATION;
      if (transport.position >= 1) transport.position -= 1;
      timeline.value = String(Math.round(transport.position * 1000));
      elapsedEl.textContent = clock(transport.position * DURATION);
    }

    /*
     * Level: from the analyser when sound is on, from a synthesised envelope
     * when it is off. The picture never depends on the visitor accepting audio.
     */
    const gate = transport.playing ? 1 : 0.18;
    const src = sound.enabled ? sound.level : sound.level * 0.85;
    transport.level = damp(transport.level, src * gate, 0.02, dt);
    if (meterEl) meterEl.style.setProperty('--level', transport.level.toFixed(3));
  }

  const stopFrame = loop.add(frame, PRIORITY.SCENE);

  return {
    setLive(live) {
      if (!live && transport.playing) setPlaying(false);
    },

    update(progress, weight, dt) {
      canvas.addOpacity('stream', weight);
      canvas.addOpacity('field', weight * 0.9);

      /* Travel: scroll is the camera, the transport adds a slow forward creep. */
      const travelTarget = progress * 2.2 + transport.position * 0.35;
      smooth.travel = damp(smooth.travel, travelTarget, 0.0001, dt);

      /* The ribbon opens up in the middle of the chapter and closes at both ends. */
      const openness = smoothstep(0.0, 0.22, progress) * (1 - smoothstep(0.80, 1.0, progress));
      smooth.amp = damp(smooth.amp, 0.35 + openness * 1.05 + band * 0.06, 0.01, dt);
      smooth.audio = damp(smooth.audio, transport.level, 0.02, dt);

      /* Cursor distortion — strongest while pressed, and never while scrolling fast. */
      const wants = capabilities.touch ? (pointer.down ? 0.85 : 0) : 0.35 + (pointer.down ? 0.55 : 0);
      grab = damp(grab, wants * weight, 0.004, dt);

      canvas.set('stream', {
        uTravel: smooth.travel,
        uAmp: smooth.amp,
        uAudio: smooth.audio,
        uSpread: capabilities.narrow ? 1.05 : 1.65,
        uGrab: grab,
        uFocus: smooth.focus,
      });
      canvas.set('field', { uTravel: smooth.travel * 0.4, uAudio: smooth.audio });

      wave.set({
        noise: band === 3 ? 0.7 : band === 0 ? 0.12 : 0.3,
        amp: 0.5 + smooth.audio * 0.8,
        freq: 2.0 + band * 1.4,
        level: 0.4 + smooth.audio,
      });

      /* ── Tokens fly past ── */
      for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i];
        const d = progress - tk.at;
        const window_ = 0.085;
        const local = clamp((d + window_) / (window_ * 2));
        const visible = Math.sin(local * Math.PI);
        if (visible <= 0.002) {
          if (tk.el.style.opacity !== '0') tk.el.style.opacity = '0';
          continue;
        }
        // Depth: far and small on approach, close and large as it passes.
        const z = lerp(0.35, 1.85, local);
        const blur = (1 - visible) * 5;
        tk.el.style.opacity = (visible * 0.92).toFixed(3);
        tk.el.style.transform =
          `translate3d(${(tk.x * 50).toFixed(2)}vw, ${(tk.y * 44).toFixed(2)}vh, 0) ` +
          `translate(-50%, -50%) scale(${z.toFixed(3)}) rotate(${(tk.spin * (1 - local)).toFixed(2)}deg)`;
        tk.el.style.filter = capabilities.tier === 'high' ? `blur(${blur.toFixed(2)}px)` : 'none';
      }

      /* The transport fades in once you are inside the signal. */
      const ui = clamp((progress - 0.14) / 0.16) * (1 - clamp((progress - 0.84) / 0.14));
      stage.style.setProperty('--ui', ui.toFixed(3));
      stage.querySelector('[data-tx-panel]').style.pointerEvents = ui > 0.6 ? 'auto' : 'none';
    },

    destroy() {
      stopFrame();
      wave.destroy();
      tokens.forEach((t) => t.el.remove());
      bandButtons.forEach((b) => b.remove());
    },
  };
}
