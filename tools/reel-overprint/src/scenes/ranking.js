// B44–B52: koniec nakładu → wynik nabija się → nick → ZAPISZ → B48 tablica wyników, nowy wpis wskakuje na #1.
// Wygląd jak w grze (.over-main, .lb): panel #0d0d0f, wiersze na czerni, numery miejsc w farbach Y/C/M.
import { W, H, bt, seg, raw, clamp, lerp, eOutExpo, eInCubic, eOutBack, pulse, text, rrect, INK_K, INK_C, INK_M, INK_Y, PAPER, CYAN, WHITE, MUTED, BLACK } from '../core.js';
import { RIG, panel, label, sticker, tap, glowText } from '../common.js';
import { OPEN } from '../shots.js';

const NICK = 'KLEKSOLOG';
const SCORE = 48750;
const ROWS = [
  ['TUSZOŻERCA', 'Fala 21 · Tuba 5 [MY] · Wałki 4 [C]', 41220],
  ['RAKLA_PRO', 'Fala 20 · Promień 5 [CM] · Dron 3', 38900],
  ['CMYK', 'Fala 18 · Gilotyna 5 [Y] · Stempel 4', 33450],
  ['KLEKS99', 'Fala 17 · Rotograf 5 [C] · Pinezki 3', 29800],
  ['PIKSEL', 'Fala 15 · Rozpylacz 4 [M]', 24100],
  ['OFFSET', 'Fala 13 · Linijka 4 [Y]', 19750],
];
const fmt = n => Math.round(n).toLocaleString('pl-PL').replace(/ /g, ' ');
const RK = [INK_Y, INK_C, INK_M];

function row(g, x, y, w, h, rank, name, sub, pts, { hi = 0, alpha = 1 } = {}) {
  g.save(); g.globalAlpha *= alpha;
  rrect(g, x, y, w, h, 18);
  g.fillStyle = BLACK; g.fill();
  if (hi > 0) { g.lineWidth = 4; g.strokeStyle = CYAN; g.globalAlpha *= hi; g.stroke(); g.globalAlpha /= hi; }
  text(g, String(rank), x + 34, y + h / 2 + 2, { size: 42, weight: 700, color: RK[rank - 1] || MUTED, baseline: 'middle' });
  text(g, name, x + 100, y + h / 2 - 14, { size: 40, weight: 700, color: hi > 0 ? CYAN : WHITE, baseline: 'middle' });
  text(g, sub, x + 100, y + h / 2 + 26, { size: 23, weight: 400, color: MUTED, baseline: 'middle' });
  text(g, fmt(pts), x + w - 30, y + h / 2 + 2, { size: 40, weight: 700, color: WHITE, align: 'right', baseline: 'middle' });
  g.restore();
}

export default {
  b0: 44, b1: 52,
  frame(S, L) {
    const B = S.B, t = S.t;
    S.base = '#050505';
    // tło: odbitka areny (farba z walki na arkuszu z gry), przygaszona
    const back = L.back.g;
    // arkusz po całym otwarciu (fale B4–B12): drugi rig dojeżdża do końca tego ujęcia raz i zostaje
    RIG.alt.seek(OPEN, bt(12));
    const pc = RIG.alt.view.paper.canvas;
    back.save();
    back.globalAlpha = .38;
    back.translate(W / 2, H / 2 - 100); back.rotate(-.06 + (B - 44) * .004);
    const s = 2.1 + (B - 44) * .02;
    back.drawImage(pc, -pc.width * s / 2, -pc.height * s / 2, pc.width * s, pc.height * s);
    back.restore();
    back.fillStyle = 'rgba(5,5,5,.35)'; back.fillRect(0, 0, W, H);
    S.fx.vignette = 1;

    const g = L.front.g;
    const x = 70, w = W - 140;
    // ---------------------------------------------------------------- ekran końca (B44–B48)
    if (B < 48.3) {
      const k = eOutExpo(seg(B, 44, 44.35));
      const out = eInCubic(seg(B, 47.8, 48.15));
      const y = 560 + (1 - k) * 200 - out * 900;
      g.save(); g.globalAlpha = clamp(k * 2) * (1 - out);
      panel(g, x, y, w, 860, { r: 26 });
      label(g, 'Koniec nakładu', x + 50, y + 80, { size: 26 });
      text(g, 'Fala 23', x + 46, y + 180, { size: 96, weight: 700, color: WHITE, spacing: -2 });
      label(g, 'Wynik', x + 50, y + 262, { size: 24 });
      const sc = SCORE * eOutExpo(seg(B, 44.4, 46));
      const bump = pulse(t, bt(46), .12);
      glowText(g, fmt(sc), x + 44, y + 400, 150 * (1 + bump * .06), { mis: 3 + bump * 12, spacing: -.03 });
      // statystyki
      [['612', 'zabici'], ['4', 'bossowie'], ['11:42', 'czas']].forEach(([v, l], i) => {
        const bx = x + 50 + i * 284, by = y + 450;
        rrect(g, bx, by, 264, 110, 16); g.fillStyle = BLACK; g.fill(); g.lineWidth = 2; g.strokeStyle = '#262626'; g.stroke();
        text(g, v, bx + 24, by + 56, { size: 44, weight: 700, color: WHITE });
        label(g, l, bx + 24, by + 92, { size: 20 });
      });
      // nick + zapisz
      const fy = y + 620, fw = w - 100 - 250;
      rrect(g, x + 50, fy, fw, 120, 18); g.fillStyle = BLACK; g.fill();
      const typing = seg(B, 46.1, 47.25);
      g.lineWidth = 3; g.strokeStyle = typing > 0 ? CYAN : '#333'; g.stroke();
      const n = Math.floor(typing * NICK.length + 1e-6);
      const str = NICK.slice(0, n);
      if (!n) text(g, 'Twój nick', x + 84, fy + 62, { size: 44, weight: 500, color: '#555', baseline: 'middle' });
      else text(g, str, x + 84, fy + 62, { size: 50, weight: 700, color: WHITE, baseline: 'middle', spacing: 2 });
      if (typing > 0 && Math.floor(B * 4) % 2 === 0) { const cw = n ? g.measureText(str).width + 8 : 0; g.fillStyle = CYAN; g.fillRect(x + 86 + cw, fy + 34, 5, 56); }
      const press = pulse(t, bt(47.5), .09);
      const bx = x + 50 + fw + 20, bw = 230;
      rrect(g, bx, fy, bw, 120, 18); g.fillStyle = press > .05 ? WHITE : CYAN; g.fill();
      text(g, 'Zapisz', bx + bw / 2, fy + 62, { size: 44, weight: 700, color: BLACK, align: 'center', baseline: 'middle' });
      tap(g, bx + bw / 2, fy + 60, raw(B, 47.45, 47.95), WHITE);
      g.restore();
    }
    // ---------------------------------------------------------------- ranking (B48–B52)
    if (B >= 47.95) {
      const k = eOutExpo(seg(B, 48, 48.3));
      const out = eInCubic(seg(B, 51.6, 52));
      const y = 480 + (1 - k) * 260;
      g.save(); g.globalAlpha = clamp(k * 2); g.translate(0, out * -200);
      panel(g, x, y, w, 1080, { r: 26 });
      text(g, 'Ranking', x + 46, y + 116, { size: 90, weight: 700, color: WHITE, spacing: -2 });
      // zakładki
      const tx = x + w - 360;
      rrect(g, tx, y + 50, 310, 76, 38); g.fillStyle = BLACK; g.fill();
      rrect(g, tx + 6, y + 56, 160, 64, 32); g.fillStyle = WHITE; g.fill();
      text(g, 'Zawsze', tx + 86, y + 90, { size: 28, weight: 700, color: BLACK, align: 'center', baseline: 'middle' });
      text(g, 'Tydzień', tx + 236, y + 90, { size: 28, weight: 500, color: MUTED, align: 'center', baseline: 'middle' });
      // wiersze: najpierw stara tablica, na B48.75 nowy wpis wchodzi na #1 i spycha resztę
      const rh = 124, ry = y + 170;
      const push = eOutExpo(seg(B, 48.75, 49.1));
      for (let i = 0; i < ROWS.length; i++) {
        const kr = eOutExpo(seg(B, 48.1 + i * .07, 48.4 + i * .07));
        if (kr <= 0) continue;
        const yy = ry + (i + push) * (rh + 10);
        if (yy > y + 1000) continue;
        row(g, x + 40 + (1 - kr) * 120, yy, w - 80, rh, i + 1 + (push > .5 ? 1 : 0), ...ROWS[i], { alpha: clamp(kr * 2) * clamp((y + 1000 - yy) / 80) });
      }
      if (push > 0) {
        const kin = eOutBack(seg(B, 48.85, 49.2), 1.4);
        const hi = .6 + .4 * Math.sin(t * 9);
        row(g, x + 40 - (1 - kin) * 700, ry, w - 80, rh, 1, NICK, 'Fala 23 · Gilotyna 5 [Y] · Tuba 5 [MY]', SCORE, { hi });
        const nw = eOutBack(seg(B, 49.3, 49.55), 2);
        if (nw > 0) {
          g.save(); g.translate(x + w - 90, ry - 12); g.rotate(.08); g.scale(nw, nw);
          rrect(g, -86, -26, 172, 52, 26); g.fillStyle = CYAN; g.fill();
          text(g, 'NOWY #1', 0, 2, { size: 26, weight: 700, color: BLACK, align: 'center', baseline: 'middle', spacing: 2 });
          g.restore();
        }
      }
      g.restore();
      sticker(g, ['ZAPISZ SIĘ W RANKINGU'], W / 2, 330, { size: 76, k: eOutExpo(seg(B, 49.4, 49.65)), rot: -.03, mis: 3, fill: INK_K, color: PAPER, alpha: 1 - out });
    }
    sticker(g, ['GRASZ O REKORD'], W / 2 - 40, 330, { size: 92, k: eOutExpo(seg(B, 44, 44.25)) * (1 - eInCubic(seg(B, 47.8, 48.1))), rot: -.03, mis: 3, fill: INK_K, color: PAPER });
  },
};
