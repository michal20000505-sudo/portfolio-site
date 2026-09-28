// B52–B64: strona portfolio w telefonie (prawdziwe zrzuty m-jaro.pl): hero → "Wybrane prace" → karta OVERPRINT
// → tapnięcie "Zagraj za darmo" → gry.html → karta OVERPRINT → menu gry → GRAJ → najazd w ekran i gra na cały kadr.
import { W, H, bt, seg, raw, clamp, lerp, keys, eOutExpo, eInOutExpo, eInOutCubic, eInCubic, eOutCubic, pulse, hash, scramble, TAU, rrect,
  BLACK, WHITE, CYAN, MAGENTA, MUTED } from '../core.js';
import { RIG, IMG, JSONS, label, glowText, tap } from '../common.js';
import { FINALE } from '../shots.js';

const SW = 620, SH = SW * 844 / 390;                // ekran telefonu (390 × 844 css)
const K = SW / 1170;                                 // piksele zrzutu (DPR 3) → ekran
const SY = 370;
const FILL = W / SW;                                 // skala telefonu, przy której ekran wypełnia kadr
const CAP = [
  [52, 'm-jaro.pl', 'Na mojej stronie'],
  [54.5, 'Portfolio · Wybrane prace', 'Obok SPACEFIGHTERA'],
  [58, 'Zakładka Gry', 'Wybierasz grę'],
  [60, 'Bez instalacji', 'Klik i grasz'],
];

// tło strony: czerń, poświaty w farbach, gwiazdy
function backdrop(g, B) {
  g.fillStyle = BLACK; g.fillRect(0, 0, W, H);
  for (const [x, y, r, c, a] of [[140, 520, 700, '255,0,255', .16], [960, 1300, 760, '0,255,255', .11], [540, 1900, 700, '255,255,0', .05]]) {
    const gr = g.createRadialGradient(x, y + Math.sin(B * .7 + x) * 40, 0, x, y, r);
    gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 1) * W, y = ((hash(i, 2) * H - B * 30 * (.3 + hash(i, 3))) % H + H) % H;
    g.globalAlpha = .25 + .6 * hash(i, 4);
    g.fillStyle = [WHITE, CYAN, MAGENTA, '#ffff00'][i % 4];
    const s = 2 + hash(i, 5) * 3; g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1;
}

// wirtualna strona: hero (2532 px) + pas od "Wybrane prace" (site_strip)
function page(g, scroll) {
  const hero = IMG.site_hero, strip = IMG.site_strip;
  g.drawImage(hero, 0, -scroll * K, SW, hero.height * K);
  g.drawImage(strip, 0, (hero.height - scroll) * K, SW, strip.height * K);
}

export default {
  b0: 52, b1: 64,
  frame(S, L) {
    const B = S.B, t = S.t;
    const site = JSONS.site, gry = JSONS.gry, menu = JSONS.game_menu;
    backdrop(L.back.g, B);
    S.fx.vignette = .8;

    // przewijanie (w pikselach zrzutu)
    const top = site.top, HERO = IMG.site_hero.height;
    const at = y => HERO + (y - top) * 3;             // css strony → wirtualna strona
    const sWork = at(site.work.y) - 120;
    const sBtn = at(site.playFree.y + site.playFree.h) + 150 - 2532;
    const scroll = keys(B, [[53.4, 0], [54.4, sWork, eInOutExpo], [55.4, sWork], [56.5, sBtn, eInOutExpo]]);
    const gryCard = gry.find(c => /shooter/.test(c.href));
    const sGry = keys(B, [[58.3, 0], [59.2, gryCard.y * 3 - 260, eInOutExpo]]);

    // telefon: wjazd, potem najazd w ekran (B62–B63.6)
    const kIn = eOutExpo(seg(B, 52, 52.5));
    const zoom = eInOutExpo(seg(B, 62.1, 63.5));
    const scale = lerp(.9 + .1 * kIn, FILL, zoom);
    const cx = W / 2, cy = lerp(SY + SH / 2 + (1 - kIn) * 600, H / 2, zoom);
    const g = L.mid.g;
    g.save();
    g.translate(cx, cy); g.scale(scale, scale); g.rotate((1 - kIn) * .08 + (1 - zoom) * -.012 * Math.sin(B * .8)); g.translate(-SW / 2, -SH / 2);
    // obudowa
    const bz = 18;
    rrect(g, -bz, -bz, SW + bz * 2, SH + bz * 2, 76);
    g.fillStyle = '#101012'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#333'; g.stroke();
    // ekran
    g.save();
    rrect(g, 0, 0, SW, SH, 60); g.clip();
    g.fillStyle = BLACK; g.fillRect(0, 0, SW, SH);
    const toGry = eInOutExpo(seg(B, 57.8, 58.3));
    const toMenu = eInOutExpo(seg(B, 60, 60.35));
    const toGame = seg(B, 62.05, 62.35);
    if (toGry < 1) { g.save(); g.translate(-toGry * SW * .35, 0); page(g, scroll); g.restore(); }
    if (toGry > 0 && toMenu < 1) {
      g.save(); g.translate((1 - toGry) * SW, 0);
      g.fillStyle = BLACK; g.fillRect(0, 0, SW, SH);
      g.drawImage(IMG.gry, 0, -sGry * K, SW, IMG.gry.height * K);
      g.restore();
    }
    if (toMenu > 0) {
      g.save(); g.globalAlpha = toMenu; g.translate(0, (1 - toMenu) * 120);
      g.drawImage(IMG.game_menu, 0, 0, SW, SH);
      g.restore();
    }
    if (toGame > 0) {
      // gra startuje w ekranie telefonu; ten sam rig gra dalej w finale
      const rig = RIG.main;
      rig.seek(FINALE, t - bt(62.1));
      g.save(); g.globalAlpha = toGame;
      // w skali, w której po najeździe piksel gry = piksel kadru (bez skoku przy przejściu do finału)
      g.scale(1 / FILL, 1 / FILL);
      rig.draw(g, 0, 0, SW * FILL, SH * FILL);
      g.restore();
      S.shake = rig.shake * toGame * zoom;
    }
    g.restore();
    // tapnięcia (w układzie ekranu)
    const btnY = (at(site.playFree.y + site.playFree.h / 2) - sBtn) * K;
    tap(g, SW / 2, btnY, raw(B, 57.3, 57.8), CYAN);
    // przycisk "Zagraj za darmo" pulsuje przed tapnięciem
    const pulseB = Math.max(0, Math.sin((B - 56.6) * Math.PI * 2)) * seg(B, 56.6, 56.8) * (1 - seg(B, 57.3, 57.4));
    if (pulseB > 0 && toGry < .5) {
      g.save(); g.globalAlpha = pulseB * .8; g.lineWidth = 5; g.strokeStyle = CYAN;
      const bx = site.playFree.x * 3 * K, bw = site.playFree.w * 3 * K, bh = site.playFree.h * 3 * K;
      rrect(g, bx - 8, btnY - bh / 2 - 8, bw + 16, bh + 16, 16); g.stroke();
      g.restore();
    }
    const gBtnY = ((gryCard.y + gryCard.h - 62) * 3 - sGry) * K;
    tap(g, SW / 2, gBtnY, raw(B, 59.5, 60), CYAN);
    const p = menu.play;
    tap(g, (p.x + p.w / 2) * 3 * K, (p.y + p.h / 2) * 3 * K, raw(B, 61.6, 62.1), CYAN);
    g.restore();

    // ---------------------------------------------------------------- podpisy nad telefonem
    const f = L.front.g;
    let ci = 0;
    CAP.forEach((c, i) => { if (B >= c[0]) ci = i; });
    const [b0, lab, head] = CAP[ci];
    const k = eOutExpo(seg(B, b0, b0 + .3));
    const out = eInCubic(seg(B, 61.9, 62.3));
    f.save(); f.globalAlpha = (1 - out); f.translate(0, -out * 200);
    label(f, lab, 80, 188 + (1 - k) * 20, { size: 30, color: CYAN, alpha: k });
    glowText(f, scramble(head, (B - b0) * 60 / 128, 0, .22, ci), 74, 290, 80, { mis: 3 + (1 - k) * 12, alpha: k });
    f.restore();
  },
};
