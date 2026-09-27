// 01 — rezerwacja online (B10–B26). Widżet z rezerwacja.html w pionie: akordeon trzech kroków
// (Usługa → Termin → Twoje dane), kafelki, warianty z czasem i ceną, pasek dni, wolne godziny, formularz.
// Potem karta "Twoja rezerwacja" wjeżdża na wierzch, przycisk → potwierdzenie, a termin jako blok
// wlatuje do grafiku stacji (tak działa strona: rezerwacja trafia prosto do kalendarza stacji).
import {
  W, H, bt, RED, RED_HI, INK, MUTED, DIM, S1, S2, S3, BORDER, BORDER_ACC, OK,
  clamp, lerp, seg, keys, pulse, eOutExpo, eInExpo, eOutCubic, eInOutCubic, eOutBack, eInOutQuint, spring, text, setFont, rrect, rad,
} from '../core.js';
import { ENV, Panel, icon, label, card, cardShadow, stepNum, checkMark, button, tap } from '../common.js';
import { CH } from '../director.js';
import { slideX } from './world.js';

const PW = 940, PH = 780, PX = 70, PY = 530;           // widżet: lewy górny róg treści w kadrze
const CARD = '#141110', CARD_B = '#2a2322', TILE = '#1b1817', TILE_B = '#2a2524', ACT_BG = '#2a0d0c';
const E = {                                            // zdarzenia (beaty) — te same w music.py
  tapTile: 11.25, subs: 11.5, tapSub: 12.75, close1: 13.25, open2: 13.5, days: 13.6, tapDay: 14.25, slots: 14.5, tapSlot: 15.5,
  close2: 16.0, open3: 16.25, fill: [16.75, 17.0, 17.25, 17.5], consent: 18.0, summary: 18.5, press: 19.5, done: 20.0,
  fly: 21.0, land: 22.0, claim: 22.5,
};
const SUBS = [
  ['OSOBOWY', 'do 3.5t', '20 MIN', '149 zł'], ['OSOBOWY Z LPG/CNG', '+ badanie instalacji gazu', '30 MIN', '245 zł'],
  ['OKRESOWE TAXI (BEZ LPG)', 'osobowe + badanie taxi', '20 MIN', '213 zł'], ['OKRESOWE TAXI + LPG', 'taxi + badanie instalacji gazu', '30 MIN', '309 zł'],
];
const DAYS = [['PON', '5'], ['WT', '6'], ['ŚR', '7'], ['CZW', '8'], ['PT', '9'], ['SOB', '10'], ['NIEDZ', '11']];
const SLOTS = ['09:00', '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:20', '11:40', '12:00', '12:20', '12:40', '13:00', '13:20', '13:40'];
const TAKEN = new Set(['09:20', '10:00', '11:40', '12:40']);
const FIELDS = [
  ['Imię i nazwisko', 'Jan Kowalski', 0, 0, 2], ['Telefon', '600 000 000', 0, 1, 1], ['Nr rejestracyjny', 'DW 12345', 1, 1, 1], ['Marka i model', 'BMW M3', 0, 2, 2],
];

let steps, summary, chip, sched;
const ts = b => bt(b);

// ------------------------------------------------------------------ geometria akordeonu (wysokości kroków w czasie)
function layout(t) {
  const h1 = keys(t, [[ts(E.subs), 396], [ts(E.subs + 0.5), 690, eOutExpo], [ts(E.close1), 690], [ts(E.close1 + 0.45), 104, eInOutQuint]]);
  const h2 = keys(t, [[ts(E.open2), 104], [ts(E.open2 + 0.5), 612, eInOutQuint], [ts(E.close2), 612], [ts(E.close2 + 0.45), 104, eInOutQuint]]);
  const h3 = keys(t, [[ts(E.open3), 104], [ts(E.open3 + 0.5), 560, eInOutQuint]]);
  const scroll = keys(t, [[ts(E.open3), 0], [ts(E.open3 + 0.55), 118, eInOutQuint]]);
  return { h: [h1, h2, h3], y: [0, h1 + 16, h1 + h2 + 32].map(y => y - scroll) };
}

function stepHead(g, n, y, title, sub, state, doneP, recap, recapP) {
  stepNum(g, n, 58, y + 52, state, doneP);
  const dim = state === 'locked' ? 0.45 : 1;
  text(g, title, 106, y + 64, { family: 'cond', weight: 900, size: 36, spacing: 36 * 0.06, color: INK, alpha: dim });
  setFont(g, { family: 'cond', weight: 900, size: 36, spacing: 36 * 0.06 });
  const tw = g.measureText(title).width;
  if (recapP > 0) {
    text(g, sub, 106 + tw + 12, y + 64, { family: 'body', weight: 400, size: 27, color: MUTED, alpha: 1 - recapP });
    text(g, recap, 106 + tw + 12 + 20 * (1 - eOutExpo(recapP)), y + 64, { family: 'body', weight: 500, size: 27, color: INK, alpha: eOutExpo(recapP) });
    const bx = PW - 36 - 96;
    rrect(g, bx, y + 32, 96, 42, 5); g.strokeStyle = CARD_B; g.lineWidth = 2; g.globalAlpha = eOutExpo(recapP); g.stroke(); g.globalAlpha = 1;
    text(g, 'ZMIEŃ', bx + 48, y + 61, { family: 'cond', weight: 800, size: 20, spacing: 2, align: 'center', color: MUTED, alpha: eOutExpo(recapP) });
  } else text(g, sub, 106 + tw + 12, y + 64, { family: 'body', weight: 400, size: 27, color: MUTED, alpha: dim });
}

function tile(g, x, y, w, h, ic, title, act) {
  rrect(g, x, y, w, h, 8);
  g.fillStyle = act > 0 ? `rgba(42,13,12,${act})` : TILE; g.fill();
  if (act < 1) { g.fillStyle = TILE; g.globalAlpha = 1 - act; g.fill(); g.globalAlpha = 1; }
  g.lineWidth = 2; g.strokeStyle = act > 0.5 ? RED : TILE_B; g.stroke();
  icon(g, ic, x + 44, y + h / 2, 34, RED);
  text(g, title, x + 82, y + h / 2 + 10, { family: 'cond', weight: 800, size: 28, spacing: 1, color: INK });
}

function drawSteps(g, t) {
  const L = layout(t);
  g.save();
  g.beginPath(); g.rect(-4, -4, PW + 8, PH + 8); g.clip();
  // ---- krok 1: usługa
  let y = L.y[0], h = L.h[0];
  const c1 = seg(t, ts(E.close1), ts(E.close1 + 0.4));
  card(g, 0, y, PW, h, { fill: CARD, border: c1 < 1 ? BORDER_ACC : CARD_B });
  g.save(); g.beginPath(); g.rect(0, y, PW, h); g.clip();
  stepHead(g, 1, y, 'USŁUGA', 'Wybierz, co chcesz zrobić', 'active', eOutExpo(seg(t, ts(E.close1 + 0.1), ts(E.close1 + 0.5))), 'Badanie techniczne · Osobowy', seg(t, ts(E.close1 + 0.15), ts(E.close1 + 0.6)));
  if (c1 < 1) {
    g.globalAlpha = 1 - c1;
    label(g, 'Rodzaj usługi', 36, y + 142, { size: 21 });
    const act = eOutExpo(seg(t, ts(E.tapTile), ts(E.tapTile + 0.2)));
    tile(g, 36, y + 160, 426, 92, 'clipboard', 'BADANIE TECHNICZNE', act);
    tile(g, 478, y + 160, 426, 92, 'search', 'SPRAWDZENIE PRZED ZAKUPEM', 0);
    tile(g, 36, y + 268, 426, 92, 'snow', 'SERWIS KLIMATYZACJI', 0);
    // warianty (po wyborze usługi)
    const sk = seg(t, ts(E.subs), ts(E.subs + 0.6));
    if (sk > 0) {
      label(g, 'Badanie techniczne', 36, y + 412, { size: 21, alpha: eOutExpo(sk) });
      SUBS.forEach(([ti, meta, dur, price], i) => {
        const kk = eOutExpo(seg(t, ts(E.subs + 0.1 + i * 0.125), ts(E.subs + 0.6 + i * 0.125)));
        if (kk <= 0) return;
        const x = 36 + (i % 2) * 442, yy = y + 432 + Math.floor(i / 2) * 118 + 30 * (1 - kk);
        const sel = i === 0 ? eOutExpo(seg(t, ts(E.tapSub), ts(E.tapSub + 0.2))) : 0;
        g.save(); g.globalAlpha *= kk;
        rrect(g, x, yy, 426, 104, 8); g.fillStyle = sel > 0.5 ? ACT_BG : TILE; g.fill();
        g.lineWidth = 2; g.strokeStyle = sel > 0.5 ? RED : TILE_B; g.stroke();
        const ts_ = ti.length > 18 ? 25 : 28;
        text(g, ti, x + 24, yy + 44, { family: 'cond', weight: 800, size: ts_, spacing: 1, color: INK });
        text(g, meta, x + 24, yy + 80, { family: 'body', weight: 400, size: 22, color: MUTED });
        text(g, dur, x + 402, yy + 40, { family: 'cond', weight: 700, size: 21, spacing: 2, align: 'right', color: MUTED });
        text(g, price, x + 402, yy + 78, { family: 'cond', weight: 900, size: 32, align: 'right', color: INK });
        g.restore();
      });
    }
    g.globalAlpha = 1;
  }
  g.restore();

  // ---- krok 2: termin
  y = L.y[1]; h = L.h[1];
  const st2 = t < ts(E.open2) ? 'locked' : 'active';
  const c2 = seg(t, ts(E.close2), ts(E.close2 + 0.4));
  card(g, 0, y, PW, h, { fill: CARD, border: st2 === 'active' && c2 < 1 ? BORDER_ACC : CARD_B });
  g.save(); g.beginPath(); g.rect(0, y, PW, h); g.clip();
  g.globalAlpha = st2 === 'locked' ? 0.55 : 1;
  stepHead(g, 2, y, 'TERMIN', 'Dzień i godzina', st2, eOutExpo(seg(t, ts(E.close2 + 0.1), ts(E.close2 + 0.5))), 'środa, 7 października, godz. 10:40', seg(t, ts(E.close2 + 0.15), ts(E.close2 + 0.6)));
  g.globalAlpha = 1;
  if (st2 === 'active' && c2 < 1) {
    g.globalAlpha = 1 - c2;
    label(g, 'Wybierz dzień', 36, y + 142, { size: 21 });
    const dw = (PW - 72 - 6 * 12) / 7;
    DAYS.forEach(([d, n], i) => {
      const kk = eOutExpo(seg(t, ts(E.days + i * 0.0625), ts(E.days + 0.5 + i * 0.0625)));
      if (kk <= 0) return;
      const x = 36 + i * (dw + 12) + 60 * (1 - kk), yy = y + 160;
      const sel = i === 2 ? eOutExpo(seg(t, ts(E.tapDay), ts(E.tapDay + 0.15))) : 0, off = i === 6;
      g.save(); g.globalAlpha *= kk * (off ? 0.35 : 1);
      rrect(g, x, yy, dw, 122, 8);
      g.fillStyle = TILE; g.fill();
      if (sel > 0) { g.fillStyle = `rgba(189,0,1,${sel})`; g.fill(); }
      g.lineWidth = 2; g.strokeStyle = sel > 0.5 ? RED : TILE_B; g.stroke();
      text(g, d, x + dw / 2, yy + 32, { family: 'cond', weight: 600, size: 20, spacing: 2, align: 'center', color: sel > 0.5 ? INK : MUTED });
      text(g, n, x + dw / 2, yy + 80, { family: 'cond', weight: 900, size: 46, align: 'center', color: INK });
      text(g, 'PAŹ', x + dw / 2, yy + 108, { family: 'cond', weight: 600, size: 18, spacing: 2, align: 'center', color: sel > 0.5 ? INK : MUTED });
      g.restore();
    });
    const sk = seg(t, ts(E.slots), ts(E.slots + 0.3));
    if (sk > 0) {
      label(g, 'Wolne godziny', 36, y + 336, { size: 21, alpha: eOutExpo(sk) });
      const sw = (PW - 72 - 4 * 12) / 5;
      SLOTS.forEach((s, i) => {
        const kk = eOutExpo(seg(t, ts(E.slots + i * 0.03125), ts(E.slots + 0.4 + i * 0.03125)));
        if (kk <= 0) return;
        const x = 36 + (i % 5) * (sw + 12), yy = y + 354 + Math.floor(i / 5) * 78 + 16 * (1 - kk);
        const taken = TAKEN.has(s), sel = s === '10:40' ? eOutExpo(seg(t, ts(E.tapSlot), ts(E.tapSlot + 0.15))) : 0;
        g.save(); g.globalAlpha *= kk * (taken ? 0.32 : 1);
        rrect(g, x, yy, sw, 66, 7);
        g.fillStyle = TILE; g.fill();
        if (sel > 0) { g.fillStyle = `rgba(189,0,1,${sel})`; g.fill(); }
        g.lineWidth = 2; g.strokeStyle = sel > 0.5 ? RED : TILE_B; g.stroke();
        text(g, s, x + sw / 2, yy + 44, { family: 'cond', weight: 800, size: 31, align: 'center', color: INK });
        if (taken) { g.fillStyle = MUTED; g.fillRect(x + 36, yy + 34, sw - 72, 2); }
        g.restore();
      });
    }
    g.globalAlpha = 1;
  }
  g.restore();

  // ---- krok 3: dane
  y = L.y[2]; h = L.h[2];
  const st3 = t < ts(E.open3) ? 'locked' : 'active';
  card(g, 0, y, PW, h, { fill: CARD, border: st3 === 'active' ? BORDER_ACC : CARD_B });
  g.save(); g.beginPath(); g.rect(0, y, PW, h); g.clip();
  g.globalAlpha = st3 === 'locked' ? 0.55 : 1;
  stepHead(g, 3, y, 'TWOJE DANE', 'Kontakt i pojazd', st3, 0, '', 0);
  g.globalAlpha = 1;
  if (st3 === 'active') {
    const fw = (PW - 72 - 16) / 2;
    FIELDS.forEach(([lab, val, col, row, span], i) => {
      const x = 36 + col * (fw + 16), yy = y + 124 + row * 122, w = span === 2 ? PW - 72 : fw;
      const kf = seg(t, ts(E.fill[i]), ts(E.fill[i] + 0.22));
      const focus = pulse(t, ts(E.fill[i]), 0.3);
      label(g, lab, x, yy + 22, { size: 20, color: MUTED });
      text(g, '*', x + (setFont(g, { family: 'cond', weight: 700, size: 20, spacing: 2.4 }), g.measureText(lab.toUpperCase()).width) + 6, yy + 22, { family: 'cond', weight: 700, size: 20, color: RED });
      rrect(g, x, yy + 36, w, 70, 7);
      g.fillStyle = '#0b0908'; g.fill();
      g.lineWidth = 2; g.strokeStyle = focus > 0.05 ? `rgba(189,0,1,${0.4 + 0.6 * focus})` : TILE_B; g.stroke();
      const n = Math.round(val.length * kf);
      if (n > 0) text(g, val.slice(0, n), x + 22, yy + 82, { family: 'body', weight: 500, size: 30, color: INK });
      else text(g, 'np. ' + (i === 0 ? 'Jan Kowalski' : i === 1 ? '600 000 000' : i === 2 ? 'DW 12345' : 'Volkswagen Golf'), x + 22, yy + 82, { family: 'body', weight: 400, size: 28, color: DIM });
    });
    // zgoda RODO
    const cy = y + 124 + 3 * 122 + 20;
    const ck = eOutExpo(seg(t, ts(E.consent), ts(E.consent + 0.2)));
    rrect(g, 36, cy, 34, 34, 5);
    g.fillStyle = ck > 0 ? `rgba(189,0,1,${ck})` : '#0b0908'; g.fill();
    g.lineWidth = 2; g.strokeStyle = ck > 0.5 ? RED : TILE_B; g.stroke();
    checkMark(g, 53, cy + 17, 26, seg(t, ts(E.consent), ts(E.consent + 0.25)), INK, 3.5);
    text(g, 'Zapoznałem(-am) się z informacją o przetwarzaniu danych.', 88, cy + 26, { family: 'body', weight: 400, size: 24, color: MUTED });
  }
  g.restore();
  g.restore();
  // krawędzie "okna" akordeonu wygaszone (zamiast twardego cięcia)
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const fb = g.createLinearGradient(0, PH - 110, 0, PH + 4);
  fb.addColorStop(0, 'rgba(0,0,0,0)'); fb.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fb; g.fillRect(-20, PH - 110, PW + 40, 140);
  const sc = layout(t).y[0];
  if (sc < 0) {
    const ft = g.createLinearGradient(0, -4, 0, 26);
    ft.addColorStop(0, 'rgba(0,0,0,1)'); ft.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ft; g.fillRect(-20, -20, PW + 40, 46);
  }
  g.restore();
}

// ------------------------------------------------------------------ karta "Twoja rezerwacja"
const SW = 860, SH = 700;
function drawSummary(g, t) {
  cardShadow(g, 0, 0, SW, SH, 12, 0.7, 70, 30);
  card(g, 0, 0, SW, SH, { fill: '#171312', border: '#3a2c2a', r: 12 });
  text(g, 'TWOJA REZERWACJA', 44, 84, { family: 'cond', weight: 900, size: 38, spacing: 38 * 0.08, color: INK });
  g.fillStyle = '#2a2322'; g.fillRect(44, 118, SW - 88, 2);
  const rows = [['Usługa', 'Badanie techniczne'], ['Szczegóły', 'Osobowy'], ['Dzień', 'środa, 7 października'], ['Godzina', '10:40']];
  rows.forEach(([a, b], i) => {
    const k = eOutExpo(seg(t, ts(E.summary + 0.15 + i * 0.125), ts(E.summary + 0.6 + i * 0.125)));
    const y = 180 + i * 66;
    text(g, a, 44, y, { family: 'body', weight: 400, size: 30, color: MUTED, alpha: k });
    text(g, b, SW - 44 + 30 * (1 - k), y, { family: 'body', weight: 700, size: 31, color: INK, align: 'right', alpha: k });
  });
  g.fillStyle = '#2a2322'; g.fillRect(44, 424, SW - 88, 2);
  text(g, 'Czas trwania', 44, 490, { family: 'body', weight: 400, size: 30, color: MUTED });
  text(g, '20 min', SW - 44, 494, { family: 'cond', weight: 900, size: 46, color: RED_HI, align: 'right' });
  // przycisk → potwierdzenie
  const press = pulse(t, ts(E.press), 0.12) * (t < ts(E.done) ? 1 : 0.3);
  const done = eOutExpo(seg(t, ts(E.done), ts(E.done + 0.35)));
  const bx = 44, by = 540, bw = SW - 88, bh = 100;
  if (done < 1) button(g, bx, by, bw, bh, 'Zarezerwuj termin', { press, size: 36, glow: 0.6 * pulse(t, ts(E.press), 0.4), color: INK });
  if (done > 0) {
    g.save();
    g.globalAlpha = done;
    rrect(g, bx, by, bw, bh, 8); g.fillStyle = RED; g.fill();
    const cx = bx + bw / 2 - 170;
    g.beginPath(); g.arc(cx, by + bh / 2, 26, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    checkMark(g, cx, by + bh / 2, 26, seg(t, ts(E.done + 0.05), ts(E.done + 0.35)), RED, 5);
    text(g, 'TERMIN ZAREZERWOWANY', cx + 44, by + bh / 2 + 13, { family: 'cond', weight: 800, size: 36, spacing: 3, color: INK });
    g.restore();
  }
  text(g, 'Wolisz przez telefon? Zadzwoń: ', SW / 2 - 90, 684, { family: 'body', weight: 400, size: 24, color: MUTED, align: 'center' });
  text(g, '796 995 620', SW / 2 + 110, 684, { family: 'cond', weight: 800, size: 26, color: RED_HI });
}

// ------------------------------------------------------------------ grafik stacji (panel obsługi)
const GW = 940, GH = 610, T0 = 9 * 60, ROWS = 9, RH = 46, GY = 170;
function drawSchedule(g, t) {
  card(g, 0, 0, GW, GH, { fill: CARD, border: CARD_B, r: 12 });
  label(g, 'Grafik stacji', 40, 62, { size: 22, color: RED });
  text(g, 'ŚRODA, 7 PAŹDZIERNIKA', 40, 112, { family: 'cond', weight: 900, size: 42, spacing: 42 * 0.03, color: INK });
  const cols = [[150, 'PRZEGLĄDY'], [548, 'KLIMATYZACJA']];
  for (const [x, n] of cols) text(g, n, x, GY - 18, { family: 'cond', weight: 700, size: 20, spacing: 2.4, color: MUTED });
  for (let i = 0; i <= ROWS; i++) {
    const y = GY + i * RH;
    g.fillStyle = i % 3 === 0 ? '#2a2322' : '#1d1918';
    g.fillRect(130, y, GW - 170, i % 3 === 0 ? 2 : 1);
    if (i % 3 === 0 && i < ROWS) text(g, `${String(9 + i / 3).padStart(2, '0')}:00`, 40, y + 20, { family: 'cond', weight: 700, size: 22, color: MUTED });
  }
  const ev = (col, from, dur, title, sub) => {
    const x = cols[col][0] - 8, y = GY + (from - T0) / 20 * RH + 3, h = dur / 20 * RH - 6, w = 370;
    rrect(g, x, y, w, h, 6); g.fillStyle = '#231e1d'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#342c2b'; g.stroke();
    text(g, title, x + 16, y + 30, { family: 'cond', weight: 800, size: 23, spacing: 1, color: '#c9c3c1' });
    if (h > 60) text(g, sub, x + 16, y + 58, { family: 'body', weight: 400, size: 19, color: MUTED });
  };
  ev(0, 9 * 60, 20, '09:00 · BADANIE TECHNICZNE', '');
  ev(0, 9 * 60 + 20, 30, '09:20 · OSOBOWY Z LPG', '');
  ev(0, 10 * 60, 20, '10:00 · BADANIE TECHNICZNE', '');
  ev(0, 11 * 60 + 40, 20, '11:40 · MOTOCYKL', '');
  ev(1, 9 * 60 + 40, 50, '09:40 · SERWIS KLIMATYZACJI', 'czynnik R1234yf');
  ev(1, 11 * 60, 50, '11:00 · SERWIS KLIMATYZACJI', 'czynnik R134a');
  // miejsce na nowy termin (podświetla się przed lądowaniem)
  const glow = seg(t, ts(E.fly + 0.3), ts(E.land)) * (1 - seg(t, ts(E.land), ts(E.land + 0.3)));
  if (glow > 0) {
    rrect(g, 142, GY + (10 * 60 + 40 - T0) / 20 * RH + 3, 370, RH - 6, 6);
    g.setLineDash([8, 6]); g.lineWidth = 2; g.strokeStyle = `rgba(226,32,32,${glow})`; g.stroke(); g.setLineDash([]);
  }
}
export const SLOT_Y = GY + (10 * 60 + 40 - T0) / 20 * RH + 3;
function drawChip(g, t) {
  const land = pulse(t, ts(E.land), 0.35);
  rrect(g, 0, 0, 370, 40, 6);
  g.fillStyle = RED; g.fill();
  if (land > 0) { g.lineWidth = 3; g.strokeStyle = `rgba(255,220,210,${land})`; g.stroke(); }
  text(g, '10:40 · BADANIE TECHNICZNE', 16, 29, { family: 'cond', weight: 800, size: 22, spacing: 1, color: INK });
}

export default {
  name: 'booking', b0: CH.booking - 0.4, b1: CH.lab + 0.3,
  load() {
    const UI = ENV.ui;
    steps = new Panel(UI, PW, PH, { pad: 20 });
    summary = new Panel(UI, SW, SH, { pad: 90 });
    sched = new Panel(UI, GW, GH, { pad: 20 });
    chip = new Panel(UI, 370, 40, { pad: 16 });
  },
  frame(S, L) {
    const { t, B } = S;
    const sx = slideX(B, CH.booking, CH.lab);
    // ---- widżet z krokami: wjazd w 3D (obrót wokół pionu), potem cofa się, gdy wjeżdża podsumowanie
    const inK = eOutExpo(seg(t, bt(CH.booking - 0.15), bt(CH.booking + 0.8)));
    const back = eInOutCubic(seg(t, ts(E.summary), ts(E.summary + 0.5)));
    const swap = eInOutCubic(seg(t, ts(E.fly - 0.25), ts(E.fly + 0.25)));
    if (swap < 1) {
      steps.draw(g => drawSteps(g, t));
      steps.place({
        x: PX + PW / 2 + sx, y: PY + PH / 2 + 40 * back, z: -260 * (1 - inK) - 240 * back, ry: rad(-24) * (1 - inK), rx: rad(4) * back,
        opacity: clamp(inK * 1.5) * (1 - swap), bright: 1 - 0.55 * back, sheen: 0.8 * (1 - inK), sheenPos: lerp(-0.3, 1.4, inK), ox: -PW / 2,
      });
    }
    // ---- grafik stacji (zastępuje widżet)
    if (swap > 0) {
      sched.draw(g => drawSchedule(g, t));
      sched.place({ x: PX + GW / 2 + sx, y: PY + GH / 2, z: -300 * (1 - swap), rx: rad(10) * (1 - swap), opacity: swap });
    }
    // ---- karta podsumowania: wjeżdża od dołu przed widżet, po potwierdzeniu kurczy się w blok terminu
    const sIn = eOutExpo(seg(t, ts(E.summary), ts(E.summary + 0.6)));
    const shrink = eInOutQuint(seg(t, ts(E.fly), ts(E.fly + 0.45)));
    if (sIn > 0 && shrink < 1) {
      summary.draw(g => drawSummary(g, t));
      summary.place({
        x: 540 + sx, y: lerp(1500, 930, sIn) + lerp(0, 60, shrink), z: 120 * sIn * (1 - shrink), rx: rad(-18) * (1 - sIn),
        s: lerp(1, 0.45, shrink), opacity: 1 - eInExpo(shrink), sheen: 0.7 * pulse(t, ts(E.done), 0.5), sheenPos: lerp(-0.2, 1.3, seg(t, ts(E.done), ts(E.done + 0.6))),
      });
    }
    // ---- blok terminu: z karty do slotu 10:40 w kolumnie przeglądów
    const fly = seg(t, ts(E.fly + 0.15), ts(E.land));
    if (fly > 0) {
      chip.draw(g => drawChip(g, t));
      const e = eInOutQuint(fly);
      const x1 = PX + 142 + 185, y1 = PY + SLOT_Y + 20;
      const x0 = 540, y0 = 990;
      const arc = Math.sin(Math.PI * e) * 140;
      const land = spring((t - ts(E.land)) * 2.2, 12, 8);
      chip.place({
        x: lerp(x0, x1, e) + sx, y: lerp(y0, y1, e) - arc, z: 300 * Math.sin(Math.PI * e) + 12 * (1 - land) * (t > ts(E.land) ? 1 : 0),
        rz: rad(-8) * Math.sin(Math.PI * e), s: lerp(1.8, 1, e) * (1 + 0.06 * pulse(t, ts(E.land), 0.18)), opacity: clamp(fly * 4), order: 2,
      });
    }
    // ---- tapnięcia (warstwa nad panelami)
    const g = L.front.g;
    const lay = layout(t);
    const tp = (lx, ly, b) => tap(g, PX + lx + sx, PY + ly, t, ts(b));
    tp(250, lay.y[0] + 206, E.tapTile);
    tp(250, lay.y[0] + 484, E.tapSub);
    const dw = (PW - 72 - 6 * 12) / 7;
    tp(36 + 2 * (dw + 12) + dw / 2, lay.y[1] + 220, E.tapDay);
    const sw = (PW - 72 - 4 * 12) / 5;
    tp(36 + 0 * (sw + 12) + sw / 2, lay.y[1] + 354 + 78 + 33, E.tapSlot);
    tp(53, lay.y[2] + 124 + 3 * 122 + 37, E.consent);
    tap(g, 540 + sx, 930 - SH / 2 + 590, t, ts(E.press));
    // ---- hasło po wylądowaniu
    const ck = seg(t, ts(E.claim), ts(E.claim + 0.9));
    if (ck > 0 && B < CH.lab + 0.3) {
      g.save(); g.translate(sx, 0);
      const e = eOutExpo(ck);
      text(g, 'Od razu w grafiku stacji.', 72, 1222 + 30 * (1 - e), { family: 'cond', weight: 900, size: 60, spacing: 1, color: INK, alpha: e });
      g.restore();
    }
  },
};
