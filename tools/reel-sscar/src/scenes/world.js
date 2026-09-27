// Świat: tło (czerń strony, siatka, czerwona poświata), puls kamery na stopie, przejścia między rozdziałami,
// stały nagłówek rozdziału (numer jak licznik kilometrów + tytuł + podtytuł + czerwona kreska), wejście i wyjście.
import { W, H, BEAT, bt, RED, RED_HI, INK, MUTED, clamp, lerp, seg, pulse, eOutExpo, eInExpo, eInOutCubic, eInOutSine, eOutBack, spring, text, setFont, keys, eInOutQuint } from '../core.js';
import { CH, CHAPTERS, kickPulse, hitPulse, chapterAt } from '../director.js';
import { rule } from '../common.js';

// przejścia (B): whip pan — obraz ucieka w bok z rozmyciem kierunkowym
export const WHIPS = [
  { b: 6.0, dir: -1, d: 0.5 },          // intro → spis
  { b: 10.0, dir: -1, d: 0.45 },        // spis → rezerwacja
  { b: 26.0, dir: -1, d: 0.5 },
  { b: 46.0, dir: -1, d: 0.5 },
  { b: 58.0, dir: -1, d: 0.45 },
  { b: 64.0, dir: -1, d: 0.5 },
];
// przesunięcie treści rozdziału przy przejściu: stara treść wyjeżdża w lewo, nowa wjeżdża z prawej
export function slideX(B, b0, b1) {
  // wejście: B ∈ [b0 − 0.25, b0 + 0.35] → z +W do 0; wyjście: [b1 − 0.25, b1 + 0.1] → z 0 do −W
  const inK = eOutExpo(clamp((B - (b0 - 0.2)) / 0.55));
  const outK = eInExpo(clamp((B - (b1 - 0.3)) / 0.35));
  return (1 - inK) * W * 0.9 - outK * W * 0.9;
}
export function whipStretch(B) {
  let s = 0;
  for (const w of WHIPS) {
    const d = (B - w.b) / w.d;
    if (d > -0.6 && d < 0.8) s += Math.exp(-Math.pow(d / 0.28, 2)) * 150 * w.dir;
  }
  return s;
}

// licznik: cyfra "przewija się" w pionie jak w liczniku kilometrów
function odoDigit(g, from, to, x, y, size, k, color) {
  const h = size * 1.02;
  g.save();
  g.beginPath(); g.rect(x - 4, y - size * 0.86, size * 0.62, size * 1.0); g.clip();
  if (k <= 0 || from === to) text(g, to, x, y, { family: 'cond', weight: 900, size, italic: true, color });
  else {
    text(g, from, x, y - h * k, { family: 'cond', weight: 900, size, italic: true, color, alpha: 1 - k * 0.5 });
    text(g, to, x, y + h * (1 - k), { family: 'cond', weight: 900, size, italic: true, color });
  }
  g.restore();
}
// tekst "wschodzi" literami spod maski (od lewej, z opóźnieniem na literę)
export function rise(g, str, x, y, o, p, out = 0) {
  if (p <= 0) return;
  setFont(g, o);
  const size = o.size, sp = o.spacing || 0;
  let cx = x;
  if (o.align === 'center') cx = x - (g.measureText(str).width - sp) / 2;
  if (o.align === 'right') cx = x - (g.measureText(str).width - sp);
  const n = str.length, st = o.stagger ?? 0.35;
  g.save();
  g.beginPath(); g.rect(0, y - size * 1.05, W, size * 1.35); g.clip();
  for (let i = 0; i < n; i++) {
    const ch = str[i];
    setFont(g, o);
    const cw = g.measureText(ch).width;
    const ki = clamp((p * (1 + st) - st * i / Math.max(1, n - 1)));
    const ko = clamp((out * (1 + st) - st * i / Math.max(1, n - 1)));
    const e = eOutExpo(ki), eo = eInExpo(ko);
    if (e > 0 && eo < 1) text(g, ch, cx, y + size * 1.1 * (1 - e) - size * 1.1 * eo, { ...o, align: 'left', spacing: 0, alpha: (o.alpha ?? 1) });
    cx += cw;
  }
  g.restore();
}

export default {
  name: 'world', b0: 0, b1: CH.end,
  frame(S, L) {
    const { t, B, fx, bg } = S;
    const kp = kickPulse(t), hp = hitPulse(t, 0.35);

    // ---- tło: poświata za nagłówkiem (jak radial w hero strony), oddycha na stopie
    const introGlow = B < CH.toc ? eOutExpo(seg(t, bt(3.6), bt(4.2))) : 1;
    bg.glows[0] = [540, B < CH.toc ? 1000 : 380, B < CH.toc ? 820 : 760, (0.13 + 0.05 * kp + 0.12 * hp) * introGlow];
    bg.glows[1] = [540, 1500, 900, B >= CH.outro ? 0.12 : 0.05];
    // siatka: przesuwa się z przejściami, lekko "zbliża" na stopie
    const whip = whipStretch(B);
    let gx = 0;
    for (const w of WHIPS) gx += -w.dir * 360 * eInOutQuint(clamp((B - w.b + w.d * 0.5) / w.d));
    bg.grid = [gx, -t * 6, 54, 0.03 * clamp(t / 0.8)];
    bg.gridZoom = 1 + 0.004 * kp;

    // ---- kamera: puls na stopie, uderzenia, whip pany
    // powolny najazd kamery w każdym rozdziale (zerowany na whip panie, którego nie widać pod rozmyciem)
    const SEGS = [[CH.toc, CH.booking], [CH.booking, CH.lab], [CH.lab, CH.vin], [CH.vin, CH.klima], [CH.klima, CH.outro], [CH.outro, CH.end]];
    let push = 0;
    for (const [a, b] of SEGS) if (B >= a - 0.05 && B < b - 0.05) push = eInOutSine(clamp((B - a) / (b - a)));
    fx.zoom = (1 + 0.022 * push) * (1 + 0.004 * kp + 0.012 * hp);
    fx.focusY = 820;
    fx.stretchX = whip;
    fx.aberr = Math.abs(whip) * 0.012 + 2.2 * hp;
    fx.bloom = 0.5 + 0.25 * hp;
    // wejście z czerni i wyjście
    fx.fade = Math.max(1 - clamp(t / 0.12), eInOutCubic(seg(t, bt(74.6), bt(75.9))));

    // ---- nagłówek rozdziału (B10–B64)
    if (B >= CH.booking - 0.3 && B < CH.outro + 0.3) drawHeader(S, L.front.g);
  },
};

function drawHeader(S, g) {
  const { t, B } = S;
  const ch = chapterAt(Math.min(Math.max(B, CH.booking), CH.outro - 0.001));
  const i = CHAPTERS.indexOf(ch);
  const prev = i > 0 ? CHAPTERS[i - 1] : null;
  // wejście pierwszego nagłówka (ze spisu treści) i zejście przed outro
  const enter = eOutExpo(seg(t, bt(CH.booking - 0.1), bt(CH.booking + 0.6)));
  const leave = eInExpo(seg(t, bt(CH.outro - 0.35), bt(CH.outro + 0.1)));
  if (enter <= 0 || leave >= 1) return;
  const X = 70, NY = 398, TY = 386, size = 118;
  g.save();
  g.translate(-W * 0.9 * leave, 0);
  // numer: 0 + cyfra rozdziału, druga cyfra przewija się
  const kRoll = prev ? spring((t - bt(ch.b - 0.08)) * 2.2, 9, 7) : 1;
  // numer oddycha na stopie (delikatna czerwona poświata)
  const kp = kickPulse(t, 0.14);
  g.shadowColor = `rgba(255,40,30,${0.5 * kp})`;
  g.shadowBlur = 30 * kp;
  text(g, '0', X, NY, { family: 'cond', weight: 900, size, italic: true, color: RED, alpha: enter });
  setFont(g, { family: 'cond', weight: 900, size, italic: true });
  const w0 = g.measureText('0').width;
  g.globalAlpha = enter;
  odoDigit(g, prev ? prev.n[1] : ch.n[1], ch.n[1], X + w0, NY, size, prev ? clamp(kRoll) : 1, RED);
  g.globalAlpha = 1;
  g.shadowBlur = 0; g.shadowColor = 'transparent';
  // tytuł i podtytuł: stary wychodzi w górę, nowy wschodzi literami
  const tx = X + 150;
  const pIn = prev ? seg(t, bt(ch.b - 0.05), bt(ch.b + 0.9)) : seg(t, bt(CH.booking), bt(CH.booking + 0.9));
  const pOut = seg(t, bt(ch.b - 0.35), bt(ch.b + 0.05));
  const tsize = 80;
  if (prev && pOut < 1) rise(g, prev.title.toUpperCase(), tx, TY, { family: 'cond', weight: 900, size: tsize, spacing: tsize * 0.02 }, 1, pOut);
  rise(g, ch.title.toUpperCase(), tx, TY, { family: 'cond', weight: 900, size: tsize, spacing: tsize * 0.02 }, pIn);
  const tagIn = eOutExpo(seg(t, bt(ch.b + 0.3), bt(ch.b + 1.1)));
  const tagOut = prev ? 0 : 0;
  if (prev) {
    const k = eInExpo(seg(t, bt(ch.b - 0.4), bt(ch.b)));
    if (k < 1 && B < ch.b) text(g, prev.tag, X + 2 - 40 * k, 458, { family: 'body', weight: 500, size: 33, color: MUTED, alpha: 1 - k });
  }
  if (B >= ch.b) text(g, ch.tag, X + 2 + 40 * (1 - tagIn), 458, { family: 'body', weight: 500, size: 33, color: MUTED, alpha: tagIn * (1 - tagOut) });
  rule(g, X + 2, 486, seg(t, bt(ch.b + 0.4), bt(ch.b + 1.2)));
  g.restore();
}
