/**
 * canvas.js — SignalCanvas.
 *
 * One WebGL2 surface for the whole site. Scenes never touch the context; they
 * write plain values into a layer's uniform bag and this module decides what
 * gets drawn, in what order, at what cost. A layer at zero opacity costs one
 * float comparison per frame.
 */

import { Renderer, Pass } from './renderer.js';
import { signalCoreFrag } from './shaders/signalCore.js';
import { sourceFrag } from './shaders/source.js';
import { streamVert, streamFrag, streamFieldFrag } from './shaders/stream.js';
import { filmFrag } from './shaders/film.js';
import { capabilities } from '../core/capabilities.js';
import { pointer } from '../core/pointer.js';
import { loop, PRIORITY } from '../core/loop.js';

/** Yield to the compositor so the loading sequence stays animated while we compile. */
const breathe = () => new Promise((r) => setTimeout(r, 0));

class Layer {
  constructor(pass, defaults, drawCount = 3) {
    this.pass = pass;
    this.uniforms = { ...defaults };
    this.drawCount = drawCount;
    this.opacity = 0;
  }
  set(values) {
    Object.assign(this.uniforms, values);
  }
}

export class SignalCanvas {
  constructor(canvasEl) {
    this.el = canvasEl;
    this.renderer = null;
    this.layers = {};
    this.order = [];
    this.time = 0;
    this.interference = 0;
    this._unsubscribe = null;
  }

  /** @param {(step:string, fraction:number)=>void} onProgress */
  async init(onProgress = () => {}) {
    this.renderer = new Renderer(this.el);

    const steps = [
      ['CARRIER FIELD', () => this.#addField()],
      ['SOURCE RECONSTRUCTION', () => this.#addSource()],
      ['SIGNAL CORE', () => this.#addCore()],
      ['TRANSMISSION GEOMETRY', () => this.#addStream()],
      ['EMULSION', () => this.#addFilm()],
    ];

    for (let i = 0; i < steps.length; i++) {
      const [label, build] = steps[i];
      onProgress(label, i / steps.length);
      build();
      await breathe();
    }
    onProgress('READY', 1);

    this._onResize = () => this.renderer.resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    this._offCapabilities = capabilities.onChange(this._onResize);
    this._unsubscribe = loop.add(this.render.bind(this), PRIORITY.RENDER);
    return this;
  }

  #register(name, layer) {
    this.layers[name] = layer;
    this.order.push(name);
    return layer;
  }

  #addField() {
    this.#register(
      'field',
      new Layer(new Pass(this.renderer, { fragment: streamFieldFrag }), {
        uTravel: 0, uAudio: 0,
      })
    );
  }

  #addSource() {
    this.#register(
      'source',
      new Layer(new Pass(this.renderer, { fragment: sourceFrag }), {
        uState: 0, uRadius: 0.22, uOct: capabilities.tier === 'high' ? 5 : 4, uDrift: 1,
      })
    );
  }

  #addCore() {
    const pass = new Pass(this.renderer, { fragment: signalCoreFrag });
    const defaults = {
      uRadius: 0.006, uHold: 0, uExpand: 0, uMass: 0.9,
      uField: 1, uDust: 1, uPulse: 0, uCollapse: 0, uProgress: 0,
    };
    // Two layers, one program: acquisition and afterlight are the same optics.
    this.#register('core', new Layer(pass, defaults));
    this.#register('afterlight', new Layer(pass, { ...defaults, uCollapse: 1, uField: 0.6 }));
  }

  #addStream() {
    const count = capabilities.streamCount;
    this.#register(
      'stream',
      new Layer(
        new Pass(this.renderer, { vertex: streamVert, fragment: streamFrag, mode: 'points', count }),
        { uCount: count, uTravel: 0, uAmp: 1, uAudio: 0, uSpread: 0.85, uGrab: 0, uFocus: 0 },
        count
      )
    );
  }

  #addFilm() {
    this.#register(
      'film',
      new Layer(new Pass(this.renderer, { fragment: filmFrag }), {
        uGrain: 0.022, uInterference: 0,
      })
    );
  }

  set(name, values) {
    const layer = this.layers[name];
    if (layer) layer.set(values);
  }

  setOpacity(name, value) {
    const layer = this.layers[name];
    if (layer) layer.opacity = value;
  }

  /**
   * Chapters contribute light additively within a frame, so two of them
   * crossfading both get a say without either stamping on the other.
   */
  addOpacity(name, value) {
    const layer = this.layers[name];
    if (layer) layer.opacity = Math.min(1, layer.opacity + value);
  }

  /**
   * Cleared once per frame, before any chapter writes. Without this the
   * contributions ratchet: a layer raised in chapter 02 would still be lit in
   * chapter 05, because a dormant chapter never runs to lower it again.
   */
  resetOpacities() {
    for (let i = 0; i < this.order.length; i++) {
      const name = this.order[i];
      if (name !== 'film') this.layers[name].opacity = 0;
    }
  }

  /** Kicked at chapter boundaries; decays on its own. */
  burst(amount = 0.55) {
    this.interference = Math.max(this.interference, amount);
  }

  render(dt) {
    const r = this.renderer;
    if (!r || r.lost) return;

    // Reduced motion keeps a slow clock so the image is not frozen dead, but no
    // element completes a visible cycle at this rate.
    this.time += dt * (capabilities.quiet ? 0.08 : 1);
    this.interference = Math.max(0, this.interference - dt * 1.6);

    r.resize();
    r.clear();
    r.additive();

    const w = r.width;
    const h = r.height;
    const motion = capabilities.motion;

    this.layers.film.uniforms.uInterference = this.interference;

    for (let i = 0; i < this.order.length; i++) {
      const layer = this.layers[this.order[i]];
      if (layer.opacity <= 0.002) continue;

      const pass = layer.pass.use();
      pass.set('uRes', w, h);
      pass.set('uTime', this.time);
      pass.set('uOpacity', layer.opacity);
      pass.set('uMotion', motion);
      pass.set('uPointer', pointer.snx, pointer.sny);
      pass.set('uDpr', r.dpr);

      const u = layer.uniforms;
      for (const key in u) pass.set(key, u[key]);

      pass.draw(layer.drawCount);
    }
  }

  dispose() {
    if (this._unsubscribe) this._unsubscribe();
    if (this._offCapabilities) this._offCapabilities();
    window.removeEventListener('resize', this._onResize);
    if (this.renderer) this.renderer.dispose();
    this.layers = {};
    this.order = [];
  }
}
