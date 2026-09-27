// Reżyseria: podział na rozdziały i zdarzenia w beatach (120 BPM). Te same liczby są w music.py.
import { bt, pulse, clamp } from './core.js';

export const CH = { intro: 0, toc: 6, booking: 10, lab: 26, vin: 46, klima: 58, outro: 64, end: 76 };

export const CHAPTERS = [
  { n: '01', b: CH.booking, title: 'Rezerwacja online', tag: 'Usługa, dzień, godzina. Bez dzwonienia.', toc: 'Termin bez dzwonienia i bez kolejki', icon: 'calendar' },
  { n: '02', b: CH.lab, title: 'Geometria 3D', tag: 'Ustaw kąty i zobacz, co dzieje się z oponą.', toc: 'Interaktywne laboratorium geometrii', icon: 'wheel' },
  { n: '03', b: CH.vin, title: 'Dekoder VIN / DAM', tag: 'Marka, model, rok i data montażu. Za darmo.', toc: 'Co mówi numer nadwozia', icon: 'barcode' },
  { n: '04', b: CH.klima, title: 'Baza klimatyzacji', tag: 'Czynnik, ilość i cena serwisu — od ręki.', toc: 'Czynnik i cena dla Twojego auta', icon: 'snow' },
];

// stopy (do pulsu kamery): groove od B6 do B63, przerwy przed rozdziałami, klimatyzacja w połówkach
export const KICKS = [];
for (let b = 6; b < 64; b++) {
  if ([25, 45, 57].includes(b)) continue;
  if (b >= 58 && b % 2) continue;
  KICKS.push(b);
}
for (let b = 64; b < 72; b++) KICKS.push(b);
export const HITS = [4, 10, 26, 46, 58, 64, 72];

export function kickPulse(t, tau = 0.11) {
  let v = 0;
  for (const b of KICKS) { const d = t - bt(b); if (d >= 0 && d < 0.5) v = Math.max(v, pulse(t, bt(b), tau)); }
  return v;
}
export function hitPulse(t, tau = 0.3) {
  let v = 0;
  for (const b of HITS) v = Math.max(v, pulse(t, bt(b), tau));
  return v;
}
export const chapterAt = B => { let c = null; for (const ch of CHAPTERS) if (B >= ch.b) c = ch; return B >= CH.outro ? null : c; };
export const inRange = (B, a, b) => B >= a && B < b;
export const local = (B, a, b) => clamp((B - a) / (b - a));
