/**
 * main.js — assembly.
 *
 * Nothing here draws anything. It decides what this device can support, builds
 * the parts that make sense for it, wires them to the chapter controller, and
 * gets out of the way. The WebGL module is imported dynamically so a machine
 * that cannot run it never downloads or parses it.
 */

import { capabilities, syncDocumentFlags, unbindCapabilities } from './core/capabilities.js';
import { loop, PRIORITY } from './core/loop.js';
import { scroll } from './core/scroll.js';
import { initPointer } from './core/pointer.js';
import { ChapterController } from './core/chapters.js';
import { clamp, damp, lerp } from './core/math.js';
import { jitterSeconds } from './core/type.js';
import { RECORD, CHAPTERS } from './data/archive.js';

import { ExperienceLoader } from './ui/loader.js';
import { CustomCursor } from './ui/cursor.js';
import { ArchiveNavigation } from './ui/nav.js';
import { SoundController } from './ui/sound.js';

import { createAcquisition } from './scenes/acquisition.js';
import { createSource } from './scenes/source.js';
import { createTransmission } from './scenes/transmission.js';
import { createFragments } from './scenes/fragments.js';
import { createDecoding } from './scenes/decoding.js';
import { createAfterlight } from './scenes/afterlight.js';

/**
 * Stands in for SignalCanvas when WebGL is unavailable or has been declined.
 * Every scene keeps working; it simply has nowhere to send its uniforms. The
 * CSS `.no-webgl` state provides a static optical background in its place.
 */
class NullCanvas {
  constructor() {
    this.layers = new Proxy({}, { get: () => ({ opacity: 0 }) });
  }
  set() {}
  setOpacity() {}
  addOpacity() {}
  resetOpacities() {}
  burst() {}
  dispose() {}
}

const $ = (sel, root = document) => root.querySelector(sel);

async function boot() {
  syncDocumentFlags();

  // The opening depends on starting at the top; a restored offset would skip it.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const stages = {};
  CHAPTERS.forEach((c) => { stages[c.id] = $(`.stage[data-chapter="${c.id}"]`); });

  const loader = new ExperienceLoader($('[data-loader]')).mount();
  scroll.lock();

  initPointer();
  scroll.init();
  loop.start();

  const cursor = new CustomCursor($('[data-cursor-root]')).mount();
  const sound = new SoundController();
  const controller = new ChapterController().mount($('[data-track]'));

  /* ── Visual layer ───────────────────────────────────────────────────── */
  let canvas = new NullCanvas();
  const glCanvasEl = $('[data-gl]');

  const glReady = (async () => {
    if (!capabilities.webgl) {
      loader.setProgress('NO RENDERER — TEXT ARCHIVE', 1);
      return;
    }
    try {
      const { SignalCanvas } = await import('./gl/canvas.js');
      const instance = new SignalCanvas(glCanvasEl);
      await instance.init((label, fraction) => loader.setProgress(label, fraction));
      canvas = instance;
    } catch (error) {
      // A shader that will not compile must not take the archive down with it.
      console.warn('[the last signal] renderer unavailable:', error);
      capabilities.webgl = false;
      syncDocumentFlags();
      glCanvasEl.hidden = true;
      loader.setProgress('RENDERER FAILED — TEXT ARCHIVE', 1);
    }
  })();

  /* ── Scenes ─────────────────────────────────────────────────────────── */
  // Scenes hold a reference to the canvas *getter*, so the null canvas can be
  // swapped for the real one once compilation finishes.
  const canvasRef = {
    get layers() { return canvas.layers; },
    set: (...a) => canvas.set(...a),
    setOpacity: (...a) => canvas.setOpacity(...a),
    addOpacity: (...a) => canvas.addOpacity(...a),
    resetOpacities: () => canvas.resetOpacities(),
    burst: (...a) => canvas.burst(...a),
  };

  // Between scroll integration and the chapters: every layer starts each frame
  // dark, and only the chapters currently on screen put light back into it.
  loop.add(() => canvasRef.resetOpacities(), PRIORITY.SCROLL + 5);

  let stillness = 0;

  const fragments = createFragments({ stage: stages.fragments, canvas: canvasRef, sound, cursor });

  const scenes = {
    acquisition: createAcquisition({
      stage: stages.acquisition,
      canvas: canvasRef,
      sound,
      cursor,
      onEnter: () => {
        document.body.classList.add('is-open');
        $('[data-chrome]').classList.add('is-visible');
      },
    }),
    source: createSource({ stage: stages.source, canvas: canvasRef, sound }),
    transmission: createTransmission({ stage: stages.transmission, canvas: canvasRef, sound }),
    fragments,
    decoding: createDecoding({
      stage: stages.decoding,
      canvas: canvasRef,
      sound,
      onStillness: (v) => { stillness = v; },
      onUnlock: () => fragments.unlock(),
    }),
    afterlight: createAfterlight({ stage: stages.afterlight, canvas: canvasRef, sound }),
  };

  Object.entries(scenes).forEach(([id, scene]) => controller.attach(id, scene));

  const nav = new ArchiveNavigation($('[data-nav]'), controller).mount();

  /* Jump link from the decoder to the newly unlocked record. */
  const unlockLink = $('[data-dec-unlock] button');
  if (unlockLink) unlockLink.addEventListener('click', () => controller.goTo(3));

  /* ── Chapter reactions ──────────────────────────────────────────────── */
  controller.onActiveChange((index) => {
    sound.setChapter(index);
    canvasRef.burst(0.35);
    document.documentElement.dataset.chapter = CHAPTERS[index].id;
  });

  /* ── Chrome: sound and motion ───────────────────────────────────────── */
  const soundBtn = $('[data-sound-toggle]');
  soundBtn.addEventListener('click', async () => {
    const on = soundBtn.getAttribute('aria-pressed') === 'true';
    if (on) sound.disable();
    else await sound.enable();
    soundBtn.setAttribute('aria-pressed', String(!on));
    soundBtn.querySelector('[data-sound-label]').textContent = !on ? 'Sound on' : 'Sound off';
  });

  const motionBtn = $('[data-motion-toggle]');
  const syncMotion = () => {
    const quiet = capabilities.quiet;
    motionBtn.setAttribute('aria-pressed', String(!quiet));
    motionBtn.querySelector('[data-motion-label]').textContent = quiet ? 'Motion reduced' : 'Motion full';
    syncDocumentFlags();
  };
  motionBtn.addEventListener('click', () => {
    capabilities.motionOverride = capabilities.quiet ? 'full' : 'reduced';
    capabilities.emit();
    syncMotion();
    controller.measure();
  });
  capabilities.onChange(syncMotion);
  syncMotion();

  /* ── Edge annotations ───────────────────────────────────────────────── */
  const clockEl = $('[data-hud-clock]');
  const coordEl = $('[data-hud-coord]');
  const driftEl = $('[data-hud-drift]');
  let smoothGrain = 0.055;

  loop.add((dt) => {
    const t = loop.time;

    if (clockEl) {
      const now = new Date();
      clockEl.textContent =
        `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:` +
        `${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;
    }
    if (coordEl) {
      coordEl.textContent = `09h 27m ${jitterSeconds(RECORD.ra.s, t * 0.6, 0.35)}s / −54° 18′ ${jitterSeconds(RECORD.dec.s, t * 0.45, 0.3)}″`;
    }
    if (driftEl) {
      const v = clamp(Math.abs(scroll.state.velocity) / 2600);
      driftEl.style.setProperty('--v', v.toFixed(3));
      driftEl.textContent = `DRIFT ${(v * 12.4).toFixed(2)} km s⁻¹`;
    }

    /* Grain settles as the decoded message is held — the film stops moving. */
    const targetGrain = lerp(capabilities.quiet ? 0.008 : 0.022, 0.004, stillness);
    smoothGrain = damp(smoothGrain, targetGrain, 0.02, dt);
    canvasRef.set('film', { uGrain: smoothGrain });
    canvasRef.setOpacity('film', capabilities.webgl ? lerp(1, 0.25, stillness) : 0);
    document.documentElement.style.setProperty('--stillness', stillness.toFixed(3));
  }, PRIORITY.UI);

  /* ── Hand over from the loader ──────────────────────────────────────── */
  await Promise.all([loader.run(), glReady]);
  await loader.outro();
  scenes.acquisition.begin();

  /* Cleanly release everything if the page is torn down (bfcache, SPA embed). */
  window.addEventListener('pagehide', () => {
    Object.values(scenes).forEach((s) => s.destroy && s.destroy());
    nav.destroy();
    cursor.destroy();
    sound.destroy();
    controller.destroy();
    canvas.dispose();
    unbindCapabilities();
    loop.stop();
  }, { once: true });
}

boot().catch((error) => {
  // Fail visibly but gracefully: reveal the plain archive rather than a blank page.
  console.error('[the last signal]', error);
  document.documentElement.classList.add('boot-failed');
  const loaderEl = document.querySelector('[data-loader]');
  if (loaderEl) loaderEl.hidden = true;
});
