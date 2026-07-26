/**
 * renderer.js — a deliberately small WebGL2 layer.
 *
 * No scene graph, no matrices we don't need. Every pass draws either a
 * full-screen triangle or a procedural point cloud, with positions derived from
 * gl_VertexID, so there are no vertex buffers to allocate, upload or leak.
 *
 * Everything is emissive: the canvas clears to transparent black and passes
 * blend additively over the page background. That is why the star, the stream
 * and the grain composite like light rather than like layered images.
 */

import { capabilities } from '../core/capabilities.js';

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // Every pass writes premultiplied colour. Saying so stops the compositor
      // from attenuating the result by alpha a second time.
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      desynchronized: true,
    });
    if (!this.gl) throw new Error('WebGL2 unavailable');

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.passes = new Set();
    this.lost = false;

    this._onLost = (e) => {
      e.preventDefault();
      this.lost = true;
      document.documentElement.classList.add('gl-lost');
    };
    this._onRestored = () => {
      this.lost = false;
      document.documentElement.classList.remove('gl-lost');
      this.passes.forEach((p) => p.compile());
      this.resize(true);
    };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);

    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    this.resize(true);
  }

  resize(force = false) {
    const dpr = capabilities.dpr;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (!force && w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.gl.viewport(0, 0, w, h);
  }

  clear() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Light emitting over light — the default for every scene here.
   *
   * Straight ONE/ONE, not SRC_ALPHA/ONE: the shaders already output
   * `colour * alpha`, so asking the blender to multiply by alpha again would
   * square the attenuation and crush everything dim to black.
   */
  additive() {
    const gl = this.gl;
    gl.blendFunc(gl.ONE, gl.ONE);
  }

  /** Straight alpha — used only where a pass must occlude, e.g. the film mask. */
  normal() {
    const gl = this.gl;
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  dispose() {
    this.passes.forEach((p) => p.dispose());
    this.passes.clear();
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    const lose = this.gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    this.gl = null;
  }
}

export class Pass {
  /**
   * @param {Renderer} renderer
   * @param {{vertex?:string, fragment:string, mode?:'triangles'|'points', count?:number}} spec
   */
  constructor(renderer, spec) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    this.spec = { vertex: FULLSCREEN_VERT, mode: 'triangles', count: 3, ...spec };
    this.program = null;
    this.locations = new Map();
    this.compile();
    renderer.passes.add(this);
  }

  compile() {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    this.locations.clear();
    const vs = compileShader(gl, gl.VERTEX_SHADER, this.spec.vertex);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, this.spec.fragment);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    // Shaders can be flagged for deletion immediately; the program keeps them alive.
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${log}`);
    }
    this.program = program;
  }

  loc(name) {
    if (!this.locations.has(name)) {
      this.locations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.locations.get(name);
  }

  use() {
    this.gl.useProgram(this.program);
    return this;
  }

  /** Arity-dispatched uniform setter. `set('uRes', w, h)` → uniform2f. */
  set(name, a, b, c, d) {
    const gl = this.gl;
    const l = this.loc(name);
    if (l === null) return this;
    if (d !== undefined) gl.uniform4f(l, a, b, c, d);
    else if (c !== undefined) gl.uniform3f(l, a, b, c);
    else if (b !== undefined) gl.uniform2f(l, a, b);
    else if (typeof a === 'boolean') gl.uniform1i(l, a ? 1 : 0);
    else gl.uniform1f(l, a);
    return this;
  }

  draw(count = this.spec.count) {
    const gl = this.gl;
    gl.drawArrays(this.spec.mode === 'points' ? gl.POINTS : gl.TRIANGLES, 0, count);
    return this;
  }

  dispose() {
    if (this.program) this.gl.deleteProgram(this.program);
    this.program = null;
    this.locations.clear();
    this.renderer.passes.delete(this);
  }
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    const numbered = source
      .split('\n')
      .map((line, i) => `${String(i + 1).padStart(3)} | ${line}`)
      .join('\n');
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed:\n${log}\n${numbered}`);
  }
  return shader;
}
