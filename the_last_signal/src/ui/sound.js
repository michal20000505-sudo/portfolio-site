/**
 * sound.js — SoundController.
 *
 * Every sound on this site is synthesised in the browser. There are no audio
 * files to load, replace or licence, and the mix responds to the chapter you
 * are in rather than looping indifferently underneath it.
 *
 * Nothing is created until the visitor asks for it: no AudioContext exists
 * before the toggle is pressed, so there is nothing to autoplay.
 */

import { loop, PRIORITY } from '../core/loop.js';
import { clamp, damp } from '../core/math.js';

/** Per-chapter target gains. Chapter 04 is deliberately the quietest place. */
const MIX = [
  /* 00 acquisition  */ { bed: 0.55, air: 0.30, carrier: 0.10, res: 0.55 },
  /* 01 source       */ { bed: 0.85, air: 0.16, carrier: 0.04, res: 0.75 },
  /* 02 transmission */ { bed: 0.60, air: 0.42, carrier: 0.55, res: 0.35 },
  /* 03 fragments    */ { bed: 0.42, air: 0.22, carrier: 0.08, res: 0.90 },
  /* 04 decoding     */ { bed: 0.30, air: 0.34, carrier: 0.30, res: 0.12 },
  /* 05 afterlight   */ { bed: 0.38, air: 0.06, carrier: 0.00, res: 0.30 },
];

export class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.nodes = null;
    /** 0…1 amplitude the visuals read. Simulated while sound is off. */
    this.level = 0;
    this.chapter = 0;
    this.chapterWeight = 1;
    this._targets = { ...MIX[0] };
    this._current = { bed: 0, air: 0, carrier: 0, res: 0 };
    this._nextResonance = 6;
    this._t = 0;
    this._stop = loop.add(this.update.bind(this), PRIORITY.UI);
    this._analyserData = null;
  }

  async enable() {
    if (this.enabled) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.#build();
    }
    await this.ctx.resume();
    this.enabled = true;
    this.#ramp(this.nodes.master.gain, 0.9, 2.4);
    document.documentElement.classList.add('sound-on');
  }

  disable() {
    if (!this.enabled || !this.ctx) return;
    this.enabled = false;
    this.#ramp(this.nodes.master.gain, 0, 1.1);
    document.documentElement.classList.remove('sound-on');
    // Keep the graph alive but silent: re-enabling should be instant.
    clearTimeout(this._suspendTimer);
    this._suspendTimer = setTimeout(() => {
      if (!this.enabled && this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    }, 1500);
  }

  toggle() {
    return this.enabled ? (this.disable(), false) : (this.enable(), true);
  }

  #ramp(param, value, seconds) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }

  #build() {
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0;

    // A gentle limiter keeps stacked layers from ever clipping.
    const shaper = ctx.createDynamicsCompressor();
    shaper.threshold.value = -18;
    shaper.knee.value = 24;
    shaper.ratio.value = 6;
    shaper.attack.value = 0.02;
    shaper.release.value = 0.4;

    master.connect(shaper);
    shaper.connect(ctx.destination);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    shaper.connect(analyser);
    this._analyserData = new Uint8Array(analyser.frequencyBinCount);

    /* ── Bed: two low sines a fifth apart, slowly detuning against each other ── */
    const bed = ctx.createGain();
    bed.gain.value = 0;
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.value = 140;
    bedFilter.Q.value = 0.5;
    bedFilter.connect(bed);
    bed.connect(master);

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 38.5;
    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 57.75;
    const bedMixA = ctx.createGain();
    bedMixA.gain.value = 0.55;
    const bedMixB = ctx.createGain();
    bedMixB.gain.value = 0.32;
    oscA.connect(bedMixA).connect(bedFilter);
    oscB.connect(bedMixB).connect(bedFilter);

    // Slow beating — the two tones drift in and out of phase over ~40 s.
    const drift = ctx.createOscillator();
    drift.type = 'sine';
    drift.frequency.value = 0.025;
    const driftAmount = ctx.createGain();
    driftAmount.gain.value = 0.42;
    drift.connect(driftAmount).connect(oscB.frequency);

    /* ── Air: filtered noise, the receiver listening to nothing ── */
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // One-pole lowpass → pink-ish noise, far easier to listen to than white.
      last = 0.98 * last + 0.02 * white;
      data[i] = last * 3.6;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 780;
    airFilter.Q.value = 1.1;
    const air = ctx.createGain();
    air.gain.value = 0;
    noise.connect(airFilter).connect(air).connect(master);

    const sweep = ctx.createOscillator();
    sweep.type = 'sine';
    sweep.frequency.value = 0.06;
    const sweepAmount = ctx.createGain();
    sweepAmount.gain.value = 460;
    sweep.connect(sweepAmount).connect(airFilter.frequency);

    /* ── Carrier: the transmission itself, amplitude-modulated ── */
    const carrier = ctx.createGain();
    carrier.gain.value = 0;
    const carrierOsc = ctx.createOscillator();
    carrierOsc.type = 'sine';
    carrierOsc.frequency.value = 218;
    const carrierAM = ctx.createGain();
    carrierAM.gain.value = 0.5;
    const am = ctx.createOscillator();
    am.type = 'sine';
    am.frequency.value = 5.6;
    const amDepth = ctx.createGain();
    amDepth.gain.value = 0.48;
    am.connect(amDepth).connect(carrierAM.gain);
    const carrierFilter = ctx.createBiquadFilter();
    carrierFilter.type = 'lowpass';
    carrierFilter.frequency.value = 900;
    carrierOsc.connect(carrierAM).connect(carrierFilter).connect(carrier).connect(master);

    /* ── Resonance bus: scheduled metallic events ── */
    const res = ctx.createGain();
    res.gain.value = 0;
    const resVerb = ctx.createBiquadFilter();
    resVerb.type = 'highpass';
    resVerb.frequency.value = 180;
    res.connect(resVerb).connect(master);

    [oscA, oscB, drift, noise, sweep, carrierOsc, am].forEach((n) => n.start());

    this.nodes = {
      master, analyser, bed, air, carrier, res,
      sources: [oscA, oscB, drift, noise, sweep, carrierOsc, am],
      airFilter, carrierFilter,
    };
  }

  /** A struck, decaying metallic tone. Two partials, inharmonic on purpose. */
  #resonance(gain = 0.3) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const base = 190 + Math.random() * 420;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);
    env.connect(this.nodes.res);

    [1, 2.41, 3.83].forEach((ratio, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = base * ratio;
      const g = ctx.createGain();
      g.gain.value = 1 / (i + 1.6);
      o.connect(g).connect(env);
      o.start(now);
      o.stop(now + 5.6);
      o.onended = () => { g.disconnect(); o.disconnect(); };
    });
    setTimeout(() => env.disconnect(), 6200);
  }

  /** Short interface tones. Kept quiet and rare. */
  ping(kind = 'decode') {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const spec = {
      decode: { f: 880, type: 'sine', dur: 0.14, gain: 0.05 },
      lock: { f: 1420, type: 'sine', dur: 1.6, gain: 0.10 },
      fragment: { f: 520, type: 'triangle', dur: 0.28, gain: 0.045 },
      transmit: { f: 294, type: 'sine', dur: 2.4, gain: 0.09 },
      open: { f: 132, type: 'sine', dur: 1.2, gain: 0.11 },
    }[kind] || { f: 660, type: 'sine', dur: 0.2, gain: 0.05 };

    const o = ctx.createOscillator();
    o.type = spec.type;
    o.frequency.setValueAtTime(spec.f, now);
    if (kind === 'transmit') o.frequency.exponentialRampToValueAtTime(spec.f * 0.5, now + spec.dur);
    if (kind === 'open') o.frequency.exponentialRampToValueAtTime(spec.f * 2.4, now + spec.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(spec.gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);
    o.connect(g).connect(this.nodes.master);
    o.start(now);
    o.stop(now + spec.dur + 0.05);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  setChapter(index, weight = 1) {
    this.chapter = clamp(index, 0, MIX.length - 1);
    this.chapterWeight = weight;
    this._targets = MIX[this.chapter];
  }

  update(dt) {
    this._t += dt;

    if (this.enabled && this.nodes) {
      for (const key of ['bed', 'air', 'carrier', 'res']) {
        this._current[key] = damp(this._current[key], this._targets[key], 0.06, dt);
        // Scale into a sane absolute range; these are not user-facing values.
        this.nodes[key].gain.value = this._current[key] * 0.32;
      }
      this._nextResonance -= dt * this._targets.res;
      if (this._nextResonance <= 0) {
        this.#resonance(0.16 + Math.random() * 0.2);
        this._nextResonance = 9 + Math.random() * 14;
      }
      const a = this.nodes.analyser;
      a.getByteFrequencyData(this._analyserData);
      let sum = 0;
      for (let i = 0; i < 32; i++) sum += this._analyserData[i];
      this.level = damp(this.level, clamp(sum / (32 * 190)), 0.02, dt);
    } else {
      // Silent, but the visuals still need a believable envelope to ride on.
      const sim =
        0.34 +
        0.20 * Math.sin(this._t * 0.83) +
        0.12 * Math.sin(this._t * 2.17 + 1.3) +
        0.08 * Math.sin(this._t * 5.41 + 0.4);
      this.level = damp(this.level, clamp(sim), 0.02, dt);
    }
  }

  destroy() {
    if (this._stop) this._stop();
    clearTimeout(this._suspendTimer);
    if (this.nodes) this.nodes.sources.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } });
    if (this.ctx) this.ctx.close();
    this.ctx = null;
    this.nodes = null;
  }
}
