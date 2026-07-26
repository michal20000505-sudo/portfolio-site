/**
 * source.js — Chapter 01. SourceScene.
 *
 * Scroll moves the star through four states. The chapter's one editorial
 * statement is set large and is *occluded by the star*: the same numbers that
 * position the object in the shader drive a radial mask on the type, so the
 * sentence genuinely passes behind it rather than sitting on top with a
 * blend mode that would break the moment anything creates a stacking context.
 */

import { SOURCE_STATES } from '../data/archive.js';
import { clamp, damp, ease, lerp } from '../core/math.js';
import { maskLines, revealLines, counter } from '../core/type.js';
import { capabilities } from '../core/capabilities.js';
import { pointer } from '../core/pointer.js';

/** Hold each state, then move decisively between them. */
function stepped(p, transitions) {
  const x = clamp(p) * transitions;
  const i = Math.min(Math.floor(x), transitions - 1);
  const f = x - i;
  return i + ease.inOutCubic(clamp((f - 0.22) / 0.56));
}

export function createSource({ stage, canvas, sound }) {
  const statementEl = stage.querySelector('[data-src-statement]');
  const captionEls = SOURCE_STATES.map((s) => {
    const el = document.createElement('div');
    el.className = 'source-caption';
    el.innerHTML =
      `<p class="caption-index">${s.index}</p>` +
      `<h3 class="caption-label">${s.label}</h3>` +
      `<p class="caption-note">${s.note}</p>`;
    stage.querySelector('[data-src-captions]').appendChild(el);
    return el;
  });

  const readouts = {
    radius: stage.querySelector('[data-src-radius]'),
    temp: stage.querySelector('[data-src-temp]'),
    mass: stage.querySelector('[data-src-mass]'),
    epoch: stage.querySelector('[data-src-epoch]'),
  };
  const yearsEl = stage.querySelector('[data-src-years]');

  let lines = null;
  let countedYears = false;
  const smooth = { state: 0, statement: 0 };

  /**
   * Screen-space position and size of the star, derived from exactly the same
   * expressions the fragment shader uses. Keeping these in step is what makes
   * the mask believable.
   */
  function starGeometry(uState) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const aspect = W / H;
    const drift = capabilities.quiet ? 0 : 1;

    const wOrg = ease.linear(clamp((uState - 2.25) / 0.6));
    const kc = clamp((uState - 1.35) / 1.15);
    const implode = clamp((kc - 0.0) / 0.52);
    const implodeS = implode * implode * (3 - 2 * implode);
    const reb = clamp((kc - 0.46) / 0.22);
    const rebound = reb * reb * (3 - 2 * reb) * (1 - clamp((kc - 0.68) / 0.32));

    const base = capabilities.narrow ? 0.30 : 0.22;
    let R = base * (1 - implodeS * 0.82) * (1 + rebound * 0.3);
    R = lerp(R, base * 0.045, wOrg);

    let cxUnits = pointer.snx * aspect * 0.5 * 0.035 * drift - 0.055 * (1 - wOrg);
    const cyUnits = pointer.sny * 0.5 * 0.035 * drift;

    return {
      x: (cxUnits / aspect + 0.5) * W,
      y: (1 - (cyUnits + 0.5)) * H,
      r: R * H,
      radius: R,
      wOrg,
    };
  }

  /* Line masks are measured, so they have to be re-measured when reflow happens. */
  let remaskTimer = null;
  const onResize = () => {
    if (!lines) return;
    clearTimeout(remaskTimer);
    remaskTimer = setTimeout(() => {
      lines = maskLines(statementEl, { force: true });
    }, 200);
  };
  window.addEventListener('resize', onResize, { passive: true });

  return {
    setLive(live) {
      if (live && !lines) lines = maskLines(statementEl);
    },

    update(progress, weight, dt) {
      canvas.addOpacity('source', weight);

      const uState = stepped(progress, 3);
      smooth.state = damp(smooth.state, uState, 0.001, dt);

      const geo = starGeometry(smooth.state);

      canvas.set('source', {
        uState: smooth.state,
        uRadius: geo.radius,
        uDrift: capabilities.quiet ? 0 : 1,
        uOct: capabilities.tier === 'high' ? 5 : capabilities.tier === 'medium' ? 4 : 3,
      });

      /* Keep a whisper of the signal core alive behind the star. */
      canvas.addOpacity('core', weight * 0.14);
      if (weight > 0.6) {
        canvas.set('core', { uRadius: 0.0008, uField: 0.5, uDust: 0.5, uMass: 0.25, uHold: 0, uExpand: 0, uProgress: 0, uCollapse: 0, uPulse: 0 });
      }

      /* ── Captions: one visible at a time, crossfading with the state ── */
      for (let i = 0; i < captionEls.length; i++) {
        const d = Math.abs(smooth.state - i);
        const vis = clamp(1 - d * 1.9);
        const el = captionEls[i];
        el.style.opacity = vis.toFixed(3);
        el.style.transform = `translate3d(0, ${((1 - vis) * 22 * Math.sign(smooth.state - i || 1)).toFixed(2)}px, 0)`;
        el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
        el.setAttribute('aria-hidden', vis > 0.5 ? 'false' : 'true');
      }

      /* ── The statement ── */
      const statementProgress = clamp((progress - 0.30) / 0.30);
      const statementOut = clamp((progress - 0.74) / 0.16);
      smooth.statement = damp(smooth.statement, statementProgress * (1 - statementOut), 0.0008, dt);
      if (lines) revealLines(lines, smooth.statement);
      statementEl.style.opacity = clamp(smooth.statement * 1.4).toFixed(3);

      /* The star cuts a hole in the sentence. */
      stage.style.setProperty('--star-x', `${geo.x.toFixed(1)}px`);
      stage.style.setProperty('--star-y', `${geo.y.toFixed(1)}px`);
      stage.style.setProperty('--star-r', `${(geo.r * 1.04).toFixed(1)}px`);
      stage.style.setProperty('--star-feather', `${(geo.r * 0.34 + 24).toFixed(1)}px`);

      if (!countedYears && progress > 0.34 && yearsEl) {
        countedYears = true;
        counter(yearsEl, 4812, { duration: 2.6 });
        sound.ping('fragment');
      }

      /* ── Live measurements, tied to the state ── */
      const t = smooth.state;
      if (readouts.radius) {
        const r = lerp(lerp(1.00, 0.98, clamp(t)), 0.04, clamp((t - 1.4) / 1.2));
        readouts.radius.textContent = `${(r * 41.2).toFixed(2)} R☉`;
      }
      if (readouts.temp) {
        const k = t < 1 ? lerp(3980, 4210, t) : t < 2 ? lerp(4210, 91400, clamp(t - 1)) : lerp(91400, 640, clamp(t - 2));
        readouts.temp.textContent = `${Math.round(k).toLocaleString('en-US')} K`;
      }
      if (readouts.mass) {
        readouts.mass.textContent = `${lerp(18.4, 1.9, clamp((t - 1.6) / 1.0)).toFixed(1)} M☉`;
      }
      if (readouts.epoch) {
        const labels = ['T − 71 h', 'T − 71 h', 'T + 0 s', 'T + 9 min'];
        readouts.epoch.textContent = labels[Math.min(3, Math.round(t))];
      }

      stage.style.setProperty('--state', smooth.state.toFixed(3));
    },

    destroy() {
      clearTimeout(remaskTimer);
      window.removeEventListener('resize', onResize);
      captionEls.forEach((el) => el.remove());
    },
  };
}
