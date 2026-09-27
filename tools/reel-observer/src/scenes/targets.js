// Układ elementów, na które patrzy oko (wspólny dla scen i snopa światła).
import { bt, seg, smooth } from '../core.js';

export const HERO = { x: 540, y1: 560, y2: 700, sub: 810, size: 158 };
export const CAROUSEL = { x: 540, y: 850, w: 800, h: 450, R: 1080 };
export const PLATES = { x: 70, y: 610, w: 940, h: 128, gap: 18 };
export const plateY = i => PLATES.y + i * (PLATES.h + PLATES.gap);

const fade = (t, b0, b1, f = 0.2) => smooth(seg(t, bt(b0), bt(b0) + f)) * (1 - smooth(seg(t, bt(b1) - f, bt(b1))));

export function beamTarget(t) {
  const B = t / 0.5;
  if (B >= 16.25 && B < 19) return { x: HERO.x + (B < 18 ? -80 : 80), y: (HERO.y1 + HERO.y2) / 2 - 40, a: fade(t, 16.25, 19), w: 300, r: 420 };
  if (B >= 22.8 && B < 29.9) return { x: CAROUSEL.x, y: CAROUSEL.y, a: fade(t, 22.8, 29.9) * 0.9, w: 330, r: 460 };
  if (B >= 33 && B < 36.4) {
    const i = Math.min(3, Math.floor((B - 33) / 0.5));
    return { x: PLATES.x + PLATES.w * 0.62, y: plateY(i) + PLATES.h / 2, a: fade(t, 33, 36.4), w: 150, r: 260 };
  }
  return null;
}
