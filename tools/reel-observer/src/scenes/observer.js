// OBSERVER 01: model 3D oka (reżyseria w director.js), snop światła na oglądany element, dymki-komentarze
// z linią odniesienia od oka (jak opis części na rysunku technicznym) i słowami wchodzącymi w rytm.
import {
  W, H, BEAT, bt, C, M, Y, WHITE, GREY, clamp, lerp, seg, TAU, pulse, decay, hash,
  eOutExpo, eOutBack, eInCubic, eOutCubic, smooth, rrect, setFont, text,
} from '../core.js';
import { ENV, beam, ring, shock, sparks } from '../common.js';
import { Eye } from '../eye.js';
import { eyeParams, CAPTIONS, scatterLevel, kickPulse } from '../director.js';
import { beamTarget } from './targets.js';

let eye;
const INKS = [C, M, Y];

// ------------------------------------------------------------------ dymek
const FS_MAX = 60, PAD = 36, LABEL = 24;
// rozmiar tekstu: największy (do 60 px), przy którym najdłuższa linia mieści się w panelu
function layoutCaption(g, cap) {
  if (cap.layout) return cap.layout;
  const [bx, by, bw] = cap.box;
  let fs = FS_MAX;
  setFont(g, 500, 100, -0.5);
  const widest = Math.max(...cap.lines.map(l => g.measureText(l).width));
  fs = Math.min(FS_MAX, Math.floor((bw - 2 * PAD) / widest * 100));
  setFont(g, 500, fs, -0.5);
  const space = g.measureText(' ').width;
  const lines = cap.lines.map(line => {
    let x = 0;
    return line.split(' ').map(w => { const ww = g.measureText(w).width; const o = { w, x, ww }; x += ww + space; return o; });
  });
  const lh = Math.round(fs * 1.24);
  const h = PAD + LABEL + 22 + (lines.length + (cap.email ? 1.25 : 0)) * lh + PAD - 14;
  cap.layout = { lines, x: bx, y: by, w: bw, h, fs, lh };
  return cap.layout;
}

function drawCaption(g, cap, t, eyeXY, eyeR) {
  const T0 = bt(cap.b0), T1 = bt(cap.b1);
  if (t < T0 - 0.05 || t > T1 + 0.25) return;
  const L = layoutCaption(g, cap);
  const open = eOutBack(seg(t, T0, T0 + 0.32), 1.4);
  const close = eInCubic(seg(t, T1 - 0.05, T1 + 0.22));
  const k = open * (1 - close);
  if (k <= 0.001) return;
  const { x, y, w, h } = L;
  // punkt zaczepienia na panelu: krawędź najbliższa oku
  const [ex, ey] = eyeXY;
  const ax = clamp(ex, x + 60, x + w - 60), ay = ey < y ? y : ey > y + h ? y + h : clamp(ey, y + 40, y + h - 40);
  const sideX = ex < x ? x : ex > x + w ? x + w : ax;
  const px = ey >= y && ey <= y + h ? sideX : ax;
  const py = ey >= y && ey <= y + h ? clamp(ey, y + 40, y + h - 40) : ay;
  // punkt na obrzeżu oka w stronę panelu
  const dx = px - ex, dy = py - ey, dl = Math.hypot(dx, dy) || 1;
  const rx = ex + dx / dl * eyeR, ry = ey + dy / dl * eyeR;

  g.save();
  // linia odniesienia: rysuje się od oka do panelu
  // (tylko gdy panel jest blisko oka — daleka linia przecinałaby treść)
  const lineK = eOutExpo(seg(t, T0, T0 + 0.25)) * (1 - close);
  if (lineK > 0 && dl > eyeR + 20 && dl < eyeR + 380) {
    g.strokeStyle = C; g.lineWidth = 3; g.globalAlpha = 0.9 * lineK;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(lerp(rx, px, lineK), lerp(ry, py, lineK)); g.stroke();
    g.fillStyle = C;
    g.beginPath(); g.arc(rx, ry, 7, 0, TAU); g.fill();
    ring(g, rx, ry, 7 + 26 * seg(t, T0, T0 + 0.5), 2, C, 0.8 * (1 - seg(t, T0, T0 + 0.5)));
  }
  // panel rośnie od punktu zaczepienia
  g.translate(px, py); g.scale(k, k); g.translate(-px, -py);
  g.globalAlpha = Math.min(1, k * 1.4);
  rrect(g, x, y, w, h, 26);
  g.fillStyle = 'rgba(5,5,5,0.88)'; g.fill();
  // ramka rysuje się dookoła (cyjan jak interakcje na stronie)
  const per = 2 * (w + h);
  g.setLineDash([per * eOutCubic(seg(t, T0 + 0.05, T0 + 0.5)), per]);
  g.strokeStyle = 'rgba(0,255,255,0.55)'; g.lineWidth = 2.5; g.stroke();
  g.setLineDash([]);
  // etykieta: trzy kwadraty farb + nazwa
  const lx = x + PAD, ly = y + PAD;
  INKS.forEach((col, i) => {
    const e = eOutBack(seg(t, T0 + 0.08 + i * 0.04, T0 + 0.3 + i * 0.04), 2);
    g.fillStyle = col; g.globalAlpha = e;
    g.fillRect(lx + i * 22, ly + 4, 14 * e, 14 * e);
  });
  g.globalAlpha = 1;
  const lab = cap.label;
  const nch = Math.floor(lab.length * seg(t, T0 + 0.1, T0 + 0.4));
  text(g, lab.slice(0, nch), lx + 78, ly + 19, { weight: 700, size: LABEL, spacing: 4, color: C });
  // słowa: wysuwają się spod linii bazowej, co 16-tkę; wyjście — do góry
  const FS = L.fs, LH = L.lh;
  const base0 = y + PAD + LABEL + 22 + FS * 0.92;
  const words = cap.words;
  L.lines.forEach((line, li) => {
    const by = base0 + li * LH;
    g.save();
    g.beginPath(); g.rect(x, by - FS * 1.05, w, FS * 1.4); g.clip();
    line.forEach((o, wi) => {
      const wb = words.find(q => q.li === li && q.wi === wi).b;
      const tw = bt(wb);
      const e = eOutExpo(seg(t, tw, tw + 0.3));
      if (e <= 0) return;
      const ex_ = eInCubic(seg(t, T1 - 0.2 + wi * 0.015, T1 - 0.02 + wi * 0.015));
      const yy = by + FS * 1.1 * (1 - e) - FS * 1.1 * ex_;
      const col = cap.hl[o.w] !== undefined ? INKS[cap.hl[o.w]] : WHITE;
      // chwilowe rozjechanie farb przy wejściu słowa
      const split = 10 * (1 - e);
      if (split > 0.5) {
        g.globalCompositeOperation = 'lighter';
        text(g, o.w, x + PAD + o.x - split, yy, { weight: 500, size: FS, spacing: -0.5, color: C, alpha: 0.7 });
        text(g, o.w, x + PAD + o.x + split, yy, { weight: 500, size: FS, spacing: -0.5, color: M, alpha: 0.7 });
        g.globalCompositeOperation = 'source-over';
      }
      text(g, o.w, x + PAD + o.x, yy, { weight: 500, size: FS, spacing: -0.5, color: col, alpha: Math.min(1, e * 1.5) });
    });
    g.restore();
  });
  // adres e-mail w farbach jak na stronie (graf.m.jar cyjan, @ magenta, gmail.com żółć)
  if (cap.email) {
    const tb = bt(cap.email.b), e = eOutExpo(seg(t, tb, tb + 0.35));
    const by = base0 + L.lines.length * LH + LH * 0.25;
    g.fillStyle = '#333'; g.fillRect(x + PAD, by - FS * 1.05, (w - 2 * PAD) * e, 2);
    let xx = x + PAD;
    cap.email.parts.forEach(([s, k], i) => {
      const e2 = eOutExpo(seg(t, tb + i * 0.06, tb + 0.3 + i * 0.06));
      text(g, s, xx, by + 14 * (1 - e2), { weight: 700, size: FS * 0.95, spacing: -0.5, color: INKS[k], alpha: e2 });
      setFont(g, 700, FS * 0.95, -0.5); xx += g.measureText(s).width;
    });
  }
  g.restore();
}

// ------------------------------------------------------------------ celowniki
function dashedRing(g, x, y, r, n, fill, rot, w, col, a) {
  if (a <= 0.01) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w;
  for (let i = 0; i < n; i++) {
    const a0 = rot + i / n * TAU;
    g.beginPath(); g.arc(x, y, r, a0, a0 + TAU / n * fill); g.stroke();
  }
  g.restore();
}
function ticks(g, x, y, r, n, len, rot, col, a, w = 2) {
  if (a <= 0.01) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const an = rot + i / n * TAU, l = i % 5 === 0 ? len * 1.8 : len;
    g.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); g.lineTo(x + Math.cos(an) * (r + l), y + Math.sin(an) * (r + l));
  }
  g.stroke(); g.restore();
}
function bootHud(g, t, p, eye) {
  const T1 = bt(4.2);
  if (t > T1) return;
  const inK = smooth(seg(t, 0.05, 0.5)), outK = eInCubic(seg(t, bt(3.85), T1));
  const a = inK * (1 - outK);
  if (a <= 0.01) return;
  const x = p.x, y = p.y, sc = 1 - 0.35 * outK;
  dashedRing(g, x, y, 430 * sc, 48, 0.55, t * 0.35, 3, C, 0.55 * a);
  dashedRing(g, x, y, 478 * sc, 6, 0.12, -t * 0.6, 6, WHITE, 0.5 * a);
  ticks(g, x, y, 392 * sc, 120, 10, -t * 0.1, WHITE, 0.3 * a);
  // licznik: ile części już wylądowało
  let landed = 0;
  for (const part of eye.parts) if (p.scatter(part) <= 0.0001 && t > 0.3) landed++;
  const n = eye.parts.length;
  text(g, 'OBSERVER 01', x, 300, { weight: 700, size: 46, spacing: 12, align: 'center', color: WHITE, alpha: a });
  text(g, 'INICJALIZACJA · SKŁADANIE CZĘŚCI', x, 352, { weight: 500, size: 24, spacing: 5, align: 'center', color: GREY, alpha: a });
  const barW = 520, bx = x - barW / 2, by = 1390;
  g.save(); g.globalAlpha = a;
  g.fillStyle = '#222'; g.fillRect(bx, by, barW, 6);
  const k = landed / n;
  const grd = g.createLinearGradient(bx, 0, bx + barW, 0);
  grd.addColorStop(0, C); grd.addColorStop(0.5, M); grd.addColorStop(1, Y);
  g.fillStyle = grd; g.fillRect(bx, by, barW * k, 6);
  g.restore();
  text(g, `CZĘŚCI ${String(landed).padStart(2, '0')}/${n}`, bx, by - 22, { weight: 500, size: 26, spacing: 4, color: WHITE, alpha: a });
  text(g, `${Math.round(k * 100)}%`, bx + barW, by - 22, { weight: 700, size: 26, spacing: 2, align: 'right', color: C, alpha: a });
}
function reticle(g, t, p, t0, t1) {
  const a = smooth(seg(t, t0, t0 + 0.5)) * (1 - smooth(seg(t, t1 - 0.4, t1)));
  if (a <= 0.01) return;
  const r = p.size * 0.5 * (1 + 0.15 * (1 - eOutExpo(seg(t, t0, t0 + 0.6))));
  dashedRing(g, p.x, p.y, r, 36, 0.5, t * 0.25, 2.5, C, 0.4 * a);
  ticks(g, p.x, p.y, r + 16, 90, 8, -t * 0.08, WHITE, 0.22 * a);
  dashedRing(g, p.x, p.y, r + 52, 4, 0.08, -t * 0.4, 5, WHITE, 0.35 * a);
}

export default {
  name: 'observer', b0: 0, b1: 46.5,
  load() { eye = new Eye(ENV.renderer); },
  frame(S, L) {
    const { t, B } = S;
    const p = eyeParams(t);
    eye.set(p);
    S.eye3d.push(eye.item());
    const eyeR = p.size * 0.36;
    const [lx, ly] = eye.lensScreen();
    const lvl = scatterLevel(t);
    // snop światła na element, który oko ogląda
    const bt_ = beamTarget(t);
    if (bt_ && lvl < 0.5) beam(L.mid.g, lx, ly, bt_.x, bt_.y, { a: bt_.a * (1 - lvl * 2), w0: 14, w1: bt_.w ?? 240, glowR: bt_.r ?? 320 });
    // włączenie oka: błysk soczewki i fala w trzech farbach
    const add = L.add.g;
    shock(add, t, bt(4), lx, ly, 900, 0.7, 14);
    for (const b of [16, 33, 39.5]) shock(add, t, bt(b), lx, ly, 520, 0.5, 8);
    const flare = pulse(t, bt(4), 0.35) * 0.9 + 0.25 * pulse(t, bt(16), 0.2) + 0.25 * pulse(t, bt(33), 0.2) + 0.3 * pulse(t, bt(39.5), 0.2);
    if (flare > 0.01) {
      add.save();
      add.globalCompositeOperation = 'lighter';
      const r = p.size * 0.9;
      const gr = add.createRadialGradient(lx, ly, 0, lx, ly, r);
      gr.addColorStop(0, `rgba(160,255,255,${0.55 * flare})`); gr.addColorStop(0.25, `rgba(0,255,255,${0.2 * flare})`); gr.addColorStop(1, 'rgba(0,255,255,0)');
      add.fillStyle = gr; add.fillRect(lx - r, ly - r, 2 * r, 2 * r);
      // pozioma smuga (anamorficzny błysk)
      add.globalAlpha = 0.5 * flare;
      const hg = add.createLinearGradient(lx - 700, 0, lx + 700, 0);
      hg.addColorStop(0, 'rgba(0,255,255,0)'); hg.addColorStop(0.5, 'rgba(200,255,255,1)'); hg.addColorStop(1, 'rgba(0,255,255,0)');
      add.fillStyle = hg; add.fillRect(lx - 700, ly - 3, 1400, 6);
      add.restore();
    }
    // lądowanie ostatnich części: iskry przy soczewce
    for (const b of [16, 33, 39.5]) sparks(add, t, bt(b), lx, ly, 22, { seed: b * 7, speed: 1100, life: 0.45 });
    // wybuchy: snop iskier w trzech farbach z miejsca oka
    for (const b of [14, 30, 38]) sparks(add, t, bt(b), p.x, p.y, 46, { seed: b * 3, speed: 1900, life: 0.6, grav: 500 });
    // start: celownik "inicjalizacji" z licznikiem złożonych części; koniec: celownik wokół oka
    bootHud(L.front.g, t, p, eye);
    reticle(L.mid.g, t, p, bt(39.4), bt(45.6));
    // dymki
    const front = L.front.g;
    for (const cap of CAPTIONS) drawCaption(front, cap, t, [p.x, p.y], eyeR);
  },
};
