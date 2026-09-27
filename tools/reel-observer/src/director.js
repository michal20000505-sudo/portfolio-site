// Reżyseria oka: gdzie jest, gdzie patrzy, kiedy mruga, mówi, rozpada się i składa — wszystko w beatach muzyki (120 BPM).
// music.py korzysta z tych samych zdarzeń (stopy, rozpady, lądowania części, słowa dymków).
import {
  W, H, BEAT, bt, clamp, lerp, seg, TAU, keys, spring, pulse, decay, hash, noise1,
  eOutExpo, eInOutCubic, eOutCubic, eOutBack, eInCubic, smooth,
} from './core.js';

// ------------------------------------------------------------------ siatka muzyki
export const KICKS = [4, 6, 8, 10, ...Array.from({ length: 30 }, (_, i) => 14 + i), 44];
export const CLAPS = [5, 7, 9, ...Array.from({ length: 15 }, (_, i) => 15 + 2 * i)];
export function kickPulse(t, tau = 0.11) {
  let p = 0;
  const b = t / BEAT;
  for (const k of KICKS) { if (k > b) break; if (b - k < 1.5) p += pulse(t, bt(k), tau); }
  return p;
}
export function clapPulse(t, tau = 0.1) {
  let p = 0;
  const b = t / BEAT;
  for (const k of CLAPS) { if (k > b) break; if (b - k < 1.5) p += pulse(t, bt(k), tau); }
  return p;
}

// ------------------------------------------------------------------ rozpady (d = 0 złożone, 1 = rozrzucone)
// Lądowania części są zapisane w beatach: rangi 0–4 (obudowa → mechanizm → pancerz → osłony → optyka).
// pull: czas przyciągania części w beatach.
export const SCATTER = [
  // intro: części startują rozrzucone i wirują do środka; ostatnia (optyka) ląduje tuż przed B4
  { intro: true, b0: 0, amp: 1.05, swirl: 2.4, land: [2.0, 2.5, [3.0, 0.125], 3.75, 3.875], pull: [3.0, 2.4, 1.4, 1.0, 0.9] },
  // drop (B14): wybuch, lot w rozsypce w prawy dół, składanie kaskadą 32-ek do B16
  { b0: 14, amp: 0.95, swirl: 0.9, land: [15.25, 15.375, [15.5, 0.0625], 15.875, 16.0], pull: [1.0, 0.9, 0.75, 0.6, 0.5] },
  // cennik (B30): wybuch, płyty CMYK spadają, oko składa się na B33
  { b0: 30, amp: 0.85, swirl: 1.2, land: [32.5, 32.625, [32.75, 0.0625], 32.9375, 33.0], pull: [1.2, 1.0, 0.8, 0.6, 0.5] },
  // outro (B38): wybuch i złożenie na środku
  { b0: 38, amp: 0.95, swirl: 1.6, land: [39.0, 39.125, [39.25, 0.0625], 39.4375, 39.5], pull: [1.0, 0.9, 0.7, 0.6, 0.5] },
];
// moment lądowania części p w zdarzeniu ev (beaty)
function landBeat(ev, p) {
  const l = ev.land[p.rank];
  if (Array.isArray(l)) return l[0] + l[1] * (p.armorIndex ?? 0);
  return l;
}
const burst = tau => tau <= 0 ? 0 : (1 - Math.exp(-tau * 8.5)) * (1 + 0.14 * tau);
// wyrzut w stronę widza zależny od części (część ma losowe rnd)
export function scatterAt(t, p) {
  for (let i = SCATTER.length - 1; i >= 0; i--) {
    const ev = SCATTER[i];
    const tb = bt(ev.b0);
    if (t < tb && !ev.intro) continue;
    const tl = bt(landBeat(ev, p));
    // przyciąganie (w beatach); po wybuchu zawsze zostaje chwila na lot w rozsypce
    const pull = ev.intro ? ev.pull[p.rank] * BEAT : Math.min(ev.pull[p.rank] * BEAT, (tl - tb) * 0.55);
    if (t >= tl + 0.2) return 0;
    const jit = ev.intro ? 0 : 0.03 * p.rnd[1];
    const hold = ev.intro ? ev.amp * (1 + 0.06 * Math.sin(t * 1.3 + p.rnd[2] * 6)) : ev.amp * burst(t - tb - jit);
    const tp = tl - pull;
    if (t < tp) return hold;
    const from = ev.intro ? ev.amp * (1 + 0.06 * Math.sin(tp * 1.3 + p.rnd[2] * 6)) : ev.amp * burst(tp - tb - jit);
    if (t < tl) {
      const x = (t - tp) / pull;
      return from * (1 - Math.pow(x, 2.6));
    }
    // po lądowaniu: małe dobicie (magnetyczne "klik")
    const u = (t - tl) / 0.2;
    return -0.045 * Math.sin(u * Math.PI) * (1 - u);
  }
  return 0;
}
export function swirlAt(t) {
  for (let i = SCATTER.length - 1; i >= 0; i--) if (t >= bt(SCATTER[i].b0) || SCATTER[i].intro) return SCATTER[i].swirl;
  return 0;
}
// w trakcie którego rozpadu jesteśmy (do efektów tła): level 0..1 "ile oka jest rozsypane", t0 — początek zdarzenia
export function scatterInfo(t) {
  for (const ev of SCATTER) {
    const tb = bt(ev.b0), tl = bt(ev.land[4]);
    if (t >= (ev.intro ? 0 : tb) && t < tl + 0.2) {
      const up = ev.intro ? 1 : eOutExpo(seg(t, tb, tb + 0.3));
      const down = 1 - smooth(seg(t, tl - 0.6, tl));
      return { level: up * down, t0: ev.intro ? -1.5 : tb, ev };
    }
  }
  return { level: 0, t0: 0, ev: null };
}
export const scatterLevel = t => scatterInfo(t).level;

// ------------------------------------------------------------------ pozycja i rozmiar (kwadrat kadru oka, px) + odległość kamery
const POS = [
  [0, [540, 860, 1000, 13]],
  [10.5, [540, 860, 1000, 13]],
  [11.0, [540, 930, 1720, 7.4], eOutExpo],         // "…i trochę Ciebie": najazd na widza
  [12.35, [540, 930, 1720, 7.4]],
  [13.1, [540, 860, 1000, 13], eInOutCubic],
  [14.2, [540, 860, 1000, 13]],
  [15.5, [790, 1180, 560, 12], eInOutCubic],        // w rozsypce przenosi się pod nagłówek
  [21.8, [790, 1180, 560, 12]],
  [22.7, [810, 390, 500, 12], eInOutCubic],         // lot na górę: prace
  [38.2, [810, 390, 500, 12]],
  [39.5, [540, 830, 680, 12], eInOutCubic],         // outro: środek
];
export function eyePos(B) { return keys(B, POS); }

// ------------------------------------------------------------------ kierunek patrzenia: sprężyny (zwroty z przestrzeleniem)
// [beat, yaw, pitch] — dodatni pitch: w dół, dodatni yaw: w prawo
const LOOK = [
  [0, 0, 0],
  [4.5, -0.62, 0.12], [5.0, 0.66, -0.1], [5.5, 0.0, 0.02],          // po włączeniu: "gdzie ja jestem?"
  [8.5, -0.28, 0.16], [10.5, 0, 0],                                 // zerka na dymek, potem prosto w widza
  [14.0, 0, 0],
  [16.25, -0.55, -0.5], [18.0, -0.2, -0.46], [19.0, -0.45, 0.28],   // patrzy na nagłówek, na dymek
  [20.0, 0, 0],
  [22.0, 0.0, 0.0],
  ...Array.from({ length: 8 }, (_, i) => [22 + i, -0.35 + 0.1 * Math.sin(i * 1.7), 0.5]),   // karty prac: w dół-lewo, co beat
  [30, 0, 0],
  [33.0, -0.55, 0.45], [33.5, -0.4, 0.62], [34.0, -0.55, 0.8], [34.5, -0.4, 0.95], // płyty cennika od góry do dołu
  [35.5, -0.3, 1.0], [36.5, 0, 0.05],
  [38, 0, 0],
  [40.0, 0.0, 0.34], [40.75, 0.0, -0.6], [42.25, -0.25, 0.62], [43.25, 0.0, 0.0],   // dymek, przycisk, e-mail, widz
];
function lookAt(t) {
  let yaw = LOOK[0][1], pitch = LOOK[0][2];
  for (let i = 1; i < LOOK.length; i++) {
    const [b, y, p] = LOOK[i];
    const tb = bt(b);
    if (t < tb) break;
    const s = spring((t - tb) * 2.2, 9.5, 5.2);
    yaw += (y - LOOK[i - 1][1]) * s;
    pitch += (p - LOOK[i - 1][2]) * s;
  }
  return [yaw, pitch];
}

// ------------------------------------------------------------------ mrugnięcia (przysłona 12 listków)
const BLINKS = [7.0, 12.5, 12.8, 19.5, 26.5, 36.0, 44.5];
function blinkAt(t) {
  let v = 0;
  for (const b of BLINKS) {
    const ph = t - bt(b);
    if (ph < 0 || ph > 0.42) continue;
    const slow = b === 44.5 ? 1.8 : 1;     // mrugnięcie na koniec: wolniejsze, "puszczenie oczka"
    const q = ph / slow;
    if (q > 0.42) continue;
    v = Math.max(v, q < 0.14 ? Math.sin(q / 0.14 * Math.PI / 2) : Math.cos((q - 0.14) / 0.28 * Math.PI / 2));
  }
  return v;
}

// ------------------------------------------------------------------ dymki (komentarze oka)
// Słowa wchodzą co 16-tkę; `hl` — słowa w kolorze farby. Pozycja panelu: x, y (lewy górny), szerokość.
export const CAPTIONS = [
  { b0: 4.75, b1: 8.25, label: 'OBSERVER 01', lines: ['Cześć! Jestem OBSERVER 01.'], hl: { 'OBSERVER': 0, '01.': 0 }, box: [90, 1250, 900] },
  { b0: 8.5, b1: 13.25, label: 'OBSERVER 01', lines: ['Pilnuję portfolio Michała…', '…i trochę Ciebie.'], lineB: [8.75, 11.0], hl: { 'Ciebie.': 1 }, box: [90, 1250, 900] },
  { b0: 16.25, b1: 21.5, label: 'MICHAŁ JAROSIŃSKI', lines: ['Projektuje strony,', 'marki i grafiki.', 'Od 2014 roku.'], hl: { '2014': 2 }, box: [56, 990, 520] },
  { b0: 23.0, b1: 29.5, label: 'WYBRANE PRACE', lines: ['Strony, gra na Steam, eksperymenty.', 'Tu mrugam najrzadziej.'], hl: { 'najrzadziej.': 0 }, box: [60, 1245, 960] },
  { b0: 33.25, b1: 37.5, label: 'CENNIK', lines: ['Ceny od razu na stronie.', 'Bez mrużenia oka.'], hl: { 'mrużenia': 1 }, box: [60, 1245, 960] },
  { b0: 40.0, b1: 46.5, label: 'KONTAKT', lines: ['Napisz do Michała.', 'Ja popilnuję skrzynki.'], hl: { 'skrzynki.': 0 }, box: [120, 1135, 840],
    email: { b: 42.0, parts: [['graf.m.jar', 0], ['@', 1], ['gmail.com', 2]] } },
];
const WORD_STEP = 0.25;   // beatu na słowo (16-tka)
// czasy wejścia słów (beaty) — do "mówienia" oka i do dźwięków w music.py; lineB: własny start linii
export function wordBeats(cap) {
  const out = [];
  let b = cap.b0 + 0.25;
  cap.lines.forEach((line, li) => {
    if (cap.lineB) b = cap.lineB[li];
    line.split(' ').forEach((w, wi) => { out.push({ w, li, wi, b }); b += WORD_STEP; });
  });
  return out;
}
CAPTIONS.forEach(c => { c.words = wordBeats(c); });
function talkAt(t) {
  let v = 0;
  for (const c of CAPTIONS) {
    if (t < bt(c.b0) - 0.1 || t > bt(c.b1)) continue;
    for (const w of c.words) {
      const ph = t - bt(w.b);
      if (ph < 0 || ph > 0.22) continue;
      v = Math.max(v, Math.sin(ph / 0.22 * Math.PI) * (0.35 + 0.1 * hash(w.wi, w.li)));
    }
  }
  return v;
}

// ------------------------------------------------------------------ parametry oka na chwilę t
export function eyeParams(t) {
  const B = t / BEAT;
  const [x, y, size, dist] = eyePos(B);
  // prędkość pozioma (px/s) → przechył w kierunku lotu (jak eye.bank na stronie)
  const [x2] = eyePos(B + 0.02);
  const vx = (x2 - x) / (0.02 * BEAT);
  let [yaw, pitch] = lookAt(t);
  // żywy dryf głowy (jak "curious" na stronie, tylko delikatniej)
  yaw += noise1(t * 0.7, 3) * 0.07;
  pitch += noise1(t * 0.6, 5) * 0.05;
  let roll = clamp(-vx * 0.00045, -0.3, 0.3);
  const kick = kickPulse(t, 0.12), clap = clapPulse(t, 0.1);

  // włączenie (B4): światło z zera z przestrzeleniem, przysłona otwiera się jak migawka
  const on = seg(t, bt(3.9), bt(4.35));
  let light = lerp(0.12, 1, eOutExpo(on)) + 1.3 * pulse(t, bt(4), 0.25);
  let opening = t < bt(4) ? 0 : eOutBack(seg(t, bt(4), bt(4.5)), 2.2);
  opening = clamp(opening, 0, 1.08);
  // "mówienie": przysłona i źrenica pulsują ze słowami
  const talk = talkAt(t);
  opening *= 1 - talk;
  opening *= 1 - blinkAt(t);
  let pupil = 1 + 0.12 * talk + 0.1 * kick;
  // najazd "i trochę Ciebie": źrenica zwęża się, przysłona mruży
  const stare = seg(t, bt(11.0), bt(11.6)) * (1 - seg(t, bt(12.3), bt(12.6)));
  pupil = lerp(pupil, 0.55, eInOutCubic(stare));
  opening = Math.min(opening, lerp(1, 0.62, eInOutCubic(stare)));

  // radość / chichot: przechył tam i z powrotem, osłony boczne trzepoczą
  let excitement = 0;
  const happy = (b0, b1, amp = 0.12, f = 7) => {
    const k = seg(t, bt(b0), bt(b0) + 0.15) * (1 - seg(t, bt(b1) - 0.3, bt(b1)));
    if (k <= 0) return;
    roll += Math.sin((t - bt(b0)) * f) * amp * k;
    excitement = Math.max(excitement, 0.85 * k);
    pupil = Math.max(pupil, lerp(pupil, 1.13, k));
  };
  happy(4.1, 5.8, 0.14);
  happy(12.9, 13.9, 0.1, 13);        // chichot po "i trochę Ciebie"
  happy(33.1, 34.0, 0.08);
  happy(44.4, 46.5, 0.1);

  // wdech przed wybuchem: części lekko się rozchodzą i drżą
  let spread = 0.07 * kick + 0.04 * clap;
  for (const b of [14, 30, 38]) {
    const k = eInCubic(seg(t, bt(b - 0.75), bt(b)));
    if (t < bt(b)) { spread += 0.38 * k; roll += Math.sin(t * 90) * 0.02 * k; pupil += 0.25 * k; }
  }
  // skanowanie prac: iris pulsuje szybko
  const scanning = t > bt(22) && t < bt(30) ? t : 0;
  light *= 1 + 0.22 * kick;
  if (scanning) light *= 1.1;

  // obroty kół zębatych: zwykły bieg + zrywy przy włączeniu i wybuchach
  let motor = t;
  for (const [b, a] of [[4, 30], [14, 45], [22, 60], [30, 45], [38, 50]]) motor += a * (1 - Math.exp(-Math.max(0, t - bt(b)) / 0.5));

  // unoszenie (jak na stronie) + dołek na stopę; ściśnięcie przy stopie
  const bob = Math.sin(t * 1.35 * 2) * 0.05 - 0.05 * kick;
  const sq = 0.035 * kick;
  const scale = [1 + sq, 1 - sq];

  // piruet w locie na górę (B21.8–B22.7)
  yaw += TAU * eInOutCubic(seg(t, bt(21.8), bt(22.8)));
  // cennik: pancerz łapie kolor farby płyty, która właśnie uderzyła / na którą oko patrzy
  let tint = null;
  const INK = [[0, 1, 1], [1, 0, 1], [1, 1, 0], [1, 1, 1]];
  if (B >= 30.4 && B < 38) {
    let best = 0, col = INK[0];
    [30.5, 31, 31.5, 32].forEach((b, i) => { const k = pulse(t, bt(b), 0.35); if (k > best) { best = k; col = INK[i]; } });
    if (B >= 33 && B < 36.4) { const i = Math.min(3, Math.floor((B - 33) / 0.5)); best = Math.max(best, 0.6); col = INK[i]; }
    tint = [col, 24 * best, [-3.6, -3.0, 0.6]];     // z boku: kolor na krawędziach pancerza, nie na tęczówce
  }
  return {
    tint,
    x, y, size, dist, yaw, pitch, roll, bob, pupil, opening, spread, excitement, light, motor, time: t, scanning, scale,
    scatter: (p) => scatterAt(t, p),
    spinScatter: (p) => { const si = scatterInfo(t); return si.level * (t - si.t0) * (0.4 + 0.6 * p.rnd[3]) * 0.9; },
    swirl: swirlAt(t),
  };
}
