/**
 * loop.js — exactly one requestAnimationFrame for the whole site.
 *
 * Modules subscribe with a priority so ordering is explicit: input is sampled
 * before scroll is integrated, scroll before scenes, scenes before render.
 */

export const PRIORITY = {
  INPUT: 0,
  SCROLL: 10,
  CHAPTERS: 20,
  SCENE: 30,
  RENDER: 40,
  UI: 50,
};

const subscribers = [];
let rafId = null;
let last = 0;
let running = false;
let elapsed = 0;

function tick(now) {
  rafId = requestAnimationFrame(tick);
  // Clamp dt so a backgrounded tab does not fling every spring across the screen.
  const dt = Math.min((now - last) / 1000, 1 / 20) || 1 / 60;
  last = now;
  elapsed += dt;
  for (let i = 0; i < subscribers.length; i++) {
    subscribers[i].fn(dt, elapsed);
  }
}

export const loop = {
  add(fn, priority = PRIORITY.SCENE) {
    const entry = { fn, priority };
    subscribers.push(entry);
    subscribers.sort((a, b) => a.priority - b.priority);
    return () => {
      const i = subscribers.indexOf(entry);
      if (i >= 0) subscribers.splice(i, 1);
    };
  },

  start() {
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(tick);
  },

  stop() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  },

  get time() {
    return elapsed;
  },

  get running() {
    return running;
  },
};

/** Pause the whole experience when the tab is hidden — saves battery, avoids dt spikes. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});
