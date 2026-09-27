// Outro (B64–B76): logo SSCAR, zdjęcie stacji przy Polanowickiej (godziny i telefon na zdjęciu),
// adres strony, przycisk "Zarezerwuj online", adres stacji. B72 akord końcowy, B74.6–B76 wyciemnienie.
import { W, bt, RED, RED_HI, INK, MUTED, clamp, lerp, seg, pulse, rad, eOutExpo, eInExpo, eOutBack, eInOutCubic, text, setFont, rrect, drawCover } from '../core.js';
import { ENV, IMG, Panel, icon, label, card, cardShadow, button, rule, tap } from '../common.js';
import { CH } from '../director.js';
import { drawLogo } from './intro.js';
import { rise } from './world.js';

export const OE = { logo: 64, photo: 64.25, url: 65.0, button: 66.0, press: 67.0, addr: 67.5, hours: 68.0, final: 72 };
const PW = 940, PH = 440;
let photo;

function drawPhoto(g, t) {
  cardShadow(g, 0, 0, PW, PH, 14, 0.75, 70, 30);
  g.save();
  rrect(g, 0, 0, PW, PH, 14); g.clip();
  drawCover(g, IMG.stacja, 0, 0, PW, PH, 0.5, 0.42, 1.04 + 0.08 * seg(t, bt(OE.photo), bt(76)));
  const gb = g.createLinearGradient(0, PH * 0.45, 0, PH);
  gb.addColorStop(0, 'rgba(9,7,6,0)'); gb.addColorStop(1, 'rgba(9,7,6,0.88)');
  g.fillStyle = gb; g.fillRect(0, 0, PW, PH);
  g.restore();
  rrect(g, 0, 0, PW, PH, 14); g.lineWidth = 2; g.strokeStyle = '#342a28'; g.stroke();
  const hk = eOutExpo(seg(t, bt(OE.hours), bt(OE.hours + 0.6)));
  label(g, 'Godziny otwarcia', 36, PH - 98, { size: 21, color: 'rgba(242,237,236,0.75)', alpha: hk });
  text(g, 'PON–PT 7:00–20:00 · SOB 8:00–14:00', 36 + 20 * (1 - hk), PH - 50, { family: 'cond', weight: 800, size: 38, spacing: 1, color: INK, alpha: hk });
  const pk = eOutExpo(seg(t, bt(OE.hours + 0.3), bt(OE.hours + 0.9)));
  icon(g, 'phone', PW - 250, PH - 62, 26, RED_HI, pk);
  text(g, '796 995 620', PW - 36, PH - 50, { family: 'cond', weight: 800, size: 38, spacing: 1, color: INK, align: 'right', alpha: pk });
}

export default {
  name: 'outro', b0: CH.outro - 0.3, b1: CH.end,
  load() { photo = new Panel(ENV.uiTop, PW, PH, { pad: 90 }); },
  frame(S, L) {
    const { t, B, fx } = S;
    const g = L.front.g;
    const fin = pulse(t, bt(OE.final), 0.6);
    // ---- logo
    const lk = eOutExpo(seg(t, bt(OE.logo), bt(OE.logo + 0.5)));
    if (lk > 0) {
      drawLogo(g, 540, 348, 700 * lerp(1.22, 1, lk), clamp(lk * 1.5), lerp(-0.3, 1.3, seg(t, bt(OE.logo + 0.3), bt(OE.logo + 1.3))), pulse(t, bt(OE.logo), 0.5) + 0.8 * fin);
      if (fin > 0.02) drawLogo(g, 540, 348, 700, 0.0001, lerp(-0.3, 1.3, seg(t, bt(OE.final), bt(OE.final + 1.2))), 0);
    }
    const sk = seg(t, bt(OE.logo + 0.35), bt(OE.logo + 1.1));
    rise(g, 'STACJA KONTROLI POJAZDÓW · DW/126/P', 540, 468, { family: 'cond', weight: 700, size: 30, spacing: 30 * 0.16, color: MUTED, align: 'center', stagger: 0.5 }, sk);
    // ---- zdjęcie stacji
    const pk = seg(t, bt(OE.photo), bt(OE.photo + 0.8));
    if (pk > 0) {
      const e = eOutExpo(pk);
      photo.draw(gg => drawPhoto(gg, t));
      photo.place({ x: 540, y: 505 + PH / 2 + 60 * (1 - e), z: -400 * (1 - e), rx: rad(-16) * (1 - e), opacity: clamp(pk * 2), sheen: 0.8 * (1 - e * 0.5), sheenPos: lerp(-0.3, 1.4, seg(t, bt(OE.photo), bt(OE.photo + 1.4))) });
    }
    // ---- adres strony + przycisk
    const uk = seg(t, bt(OE.url), bt(OE.url + 0.7));
    rise(g, 'sscar.pl', 540, 1068, { family: 'cond', weight: 900, size: 132, spacing: 2, color: INK, align: 'center', stagger: 0.35 }, uk);
    const bk = eOutBack(seg(t, bt(OE.button), bt(OE.button + 0.4)), 1.6);
    if (bk > 0) {
      g.save();
      g.translate(540, 1138); g.scale(bk, bk);
      button(g, -300, -46, 600, 92, 'Zarezerwuj online', { icon: 'calendar', size: 34, press: pulse(t, bt(OE.press), 0.12), glow: 0.4 + 0.8 * pulse(t, bt(OE.press), 0.5) + 0.6 * fin, color: INK });
      g.restore();
    }
    tap(g, 700, 1138, t, bt(OE.press));
    // ---- adres
    const ak = eOutExpo(seg(t, bt(OE.addr), bt(OE.addr + 0.6)));
    if (ak > 0) {
      setFont(g, { family: 'body', weight: 500, size: 30 });
      const s = 'ul. Polanowicka 82, Wrocław';
      const w = g.measureText(s).width;
      icon(g, 'pin', 540 - w / 2 - 22, 1224, 26, RED_HI, ak);
      text(g, s, 540 + 14, 1234, { family: 'body', weight: 500, size: 30, color: MUTED, align: 'center', alpha: ak });
    }
    fx.bloom += 0.25 * fin;
  },
};
