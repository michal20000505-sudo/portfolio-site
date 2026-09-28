// Reżyseria: rozdziały i zdarzenia w beatach (128 BPM). Te same liczby są w music.py.
import { bt, pulse } from './core.js';

export const CH = { hook: 0, waves: 4, weapons: 12, inks: 24, bosses: 32, upgrades: 40, rank: 44, site: 52, outro: 64, end: 72 };

// stopy (puls kamery): groove B4–B52 z przerwami, strona w połówkach, outro
export const KICKS = [];
for (let b = 4; b < 52; b++) {
  if (b === 31 || b === 43 || b === 47) continue;          // przerwy przed ULT, rankingiem i dropem tablicy
  if (b >= 44 && b < 47 && b % 2) continue;                 // ranking: połówki
  KICKS.push(b);
}
for (let b = 52; b < 62; b += 2) KICKS.push(b);
for (let b = 64; b < 70; b++) KICKS.push(b);
// mocne uderzenia (błysk, przesunięcie płyt)
export const HITS = [0, 4, 12, 24, 32, 36, 40, 48, 52, 64];

export function kickPulse(t, tau = .1) {
  let v = 0;
  for (const b of KICKS) { const d = t - bt(b); if (d >= 0 && d < .5) v = Math.max(v, pulse(t, bt(b), tau)); }
  return v;
}
export function hitPulse(t, tau = .28) {
  let v = 0;
  for (const b of HITS) v = Math.max(v, pulse(t, bt(b), tau));
  return v;
}

// bronie w montażu B12–B24: po jednej na beat
export const WEAPON_ORDER = ['rapidograf', 'rozpylacz', 'rotograf', 'gilotyna', 'tuba', 'walki', 'dron', 'promien', 'stempel', 'linijka', 'aerograf', 'pinezki'];
