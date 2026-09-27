// S3 — LOGO (B12.7–B16): połówki znaku B i C wjeżdżają z boków jak talerze i uderzają o siebie na B13
// (iskry na styku, fala, wstrząs w poziomie), potem napis BODY CREATOR, podpis, pigułka CTA jak na stronie i adres.
import {
  W, H, CX, CY, BEAT, bt, rt, GOLD, GOLD_HI, ICE, ASH, SLATE, OBSIDIAN, clamp, lerp, seg, TAU,
  eOutExpo, eInExpo, eOutBack, eInOutCubic, eOutCubic, eInQuint, decay, pulse, spring, text, canvas2d,
} from '../core.js';
import { IMG, META, pill, dust, makeBurst, drawBurst, shockRing, clipFrame, CLIP, bgEntry } from '../common.js';

const HIT = 13.0;
const S_L = 880 / 2136;                    // skala logo: napis BODY CREATOR = 880 px
const TOP = 545;                           // góra znaku BC w kadrze
const LX = lx => CX + (lx - 1439) * S_L;
const LY = ly => TOP + (ly - 229) * S_L;
const SPARKS = makeBurst(13, 70, 1300, [0.3, 0.85]);
const SPARKS2 = makeBurst(14, 40, 900, [0.25, 0.6]);
let sweepC, sweepG;

function part(g, key, dx = 0, dy = 0, alpha = 1, clip = null) {
  const p = META.logo.parts[key];
  const img = IMG['logo_' + key];
  g.save();
  g.globalAlpha = alpha;
  if (clip) { g.beginPath(); g.rect(...clip); g.clip(); }
  g.drawImage(img, LX(p.x) + dx, LY(p.y) + dy, p.w * S_L, p.h * S_L);
  g.restore();
}

export default {
  name: 'end', b0: 12.7, b1: 16, pre: 0, post: 0,
  async load() {
    [sweepC, sweepG] = canvas2d(W, 420);
  },
  frame(S, Ls) {
    const { t, B, tr } = S, fx = S.fx;
    const g = Ls.front.g, add = Ls.add.g;
    const tH = bt(HIT);
    // tło: ściana studia z logo, bardzo ciemno + złota poświata
    const bgA = seg(B, 12.9, 13.2);
    S.bgs.push(bgEntry(clipFrame('wall', tr - rt(12.9) + 1.0), CLIP.wall.aspect, 0.28 * bgA, { zoom: 1.2 - 0.03 * (tr - rt(HIT)), fx: 0.5, fy: 0.28, bright: 0.6, sat: 0, contrast: 1.15 }));
    fx.glow = Math.max(fx.glow, 0.13 * bgA * (1 + 0.5 * decay(t, tH, 0.35))); fx.glowY = 690; fx.glowR = 820;
    // ------------------------------------------------ znak: B z lewej, C z prawej — przyspieszają i uderzają na B13
    const slide = eInQuint(seg(t, tH - 0.26, tH));
    const recoil = t > tH ? Math.exp(-(t - tH) / 0.06) * Math.sin((t - tH) * 55) * 12 : 0;
    const dB = (1 - slide) * -760 - recoil, dC = (1 - slide) * 760 + recoil;
    const inA = seg(t, tH - 0.26, tH - 0.2);
    if (inA > 0) {
      part(g, 'b', dB, 0, inA);
      part(g, 'c', dC, 0, inA);
    }
    // przebłysk po znaku (B14.4) — pas światła przycięty do kształtu liter
    const sw = seg(t, bt(14.4), bt(14.4) + 0.45);
    if (sw > 0 && sw < 1) {
      const sg = sweepG;
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.globalCompositeOperation = 'source-over';
      sg.clearRect(0, 0, W, 420);
      for (const key of ['b', 'c']) {
        const p = META.logo.parts[key];
        sg.drawImage(IMG['logo_' + key], LX(p.x), LY(p.y) - (TOP - 60), p.w * S_L, p.h * S_L);
      }
      sg.globalCompositeOperation = 'source-in';
      const bx = lerp(-200, W + 200, eInOutCubic(sw));
      const grd = sg.createLinearGradient(bx - 150, 0, bx + 150, 300);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,250,225,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      sg.fillStyle = grd; sg.fillRect(0, 0, W, 420);
      g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(sweepC, 0, TOP - 60); g.restore();
    }
    // iskry na styku połówek + fala
    const seamX = LX(1409), seamY = LY(229 + 307);
    for (let k = 0; k < 3; k++) drawBurst(add, SPARKS.slice(k * 23, k * 23 + 23), t, tH, seamX, seamY + (k - 1) * 90, { r0: 8, grav: 700, drag: 3.6 });
    drawBurst(add, SPARKS2, t, tH + 0.02, seamX, LY(843), { r0: 4, grav: 900, drag: 4 });
    shockRing(add, t, tH, seamX, seamY, 760, 0.8, 9);
    // ------------------------------------------------ napis i podpis
    const wE = eOutExpo(seg(t, tH + 0.08, tH + 0.5));
    if (wE > 0) {
      const p = META.logo.parts.word;
      const half = p.w * S_L / 2 * wE;
      part(g, 'word', 0, (1 - wE) * 18, clamp(wE * 1.5), [CX - half, 0, half * 2, H]);
    }
    const tE = eOutExpo(seg(t, tH + 0.25, tH + 0.65));
    if (tE > 0) part(g, 'tag', 0, (1 - tE) * 12, tE);
    // ------------------------------------------------ CTA: pigułka jak .btn-primary + adres strony
    const cE = seg(t, bt(14.0), bt(14.0) + 0.4);
    if (cE > 0) {
      const s = lerp(0.6, 1, eOutBack(cE, 2.2));
      g.save(); g.translate(CX, 1180); g.scale(s, s); g.translate(-CX, -1180);
      pill(g, CX, 1180, 760, 118, 'DARMOWA KONSULTACJA', { size: 36, alpha: clamp(cE * 3), glow: 0.5 + 0.5 * decay(t, bt(14.0), 0.4) });
      g.restore();
    }
    const uE = eOutExpo(seg(t, bt(14.25), bt(14.25) + 0.45));
    if (uE > 0) {
      text(g, 'bodycreator.com.pl', CX, 1336 + (1 - uE) * 24, { weight: 700, size: 50, align: 'center', color: ICE, alpha: uE, spacing: 0.5 });
      text(g, 'WROCŁAW · SOŁTYSOWICE', CX, 1398 + (1 - uE) * 24, { weight: 600, size: 24, align: 'center', color: SLATE, alpha: uE * 0.95, spacing: 6 });
    }
    dust(add, tr, 0.85 * bgA, { rise: 30 });
    // ------------------------------------------------ kamera
    fx.shakeX += 22 * decay(t, tH, 0.06) * Math.sin((t - tH) * 75);
    fx.shakeY += 6 * decay(t, tH, 0.05) * Math.sin((t - tH) * 95);
    fx.zoom *= (1 + 0.03 * pulse(t, tH, 0.14)) * (1 + 0.025 * eOutCubic(seg(t, tH, bt(16))));
    fx.focusY = lerp(fx.focusY, 900, seg(B, 12.9, 13.1));
    fx.flash += 0.09 * pulse(t, tH, 0.06);
    fx.flashCol = [1, 0.92, 0.7];
    fx.ripple += 0.8 * decay(t, tH, 0.2) * seg(t, tH, tH + 0.02);
    fx.rippleR = 60 + 1500 * (t - tH); fx.rippleX = seamX; fx.rippleY = seamY;
    fx.aberr += 4 * pulse(t, tH, 0.1);
    fx.bloom = 0.45; fx.bloomThresh = 0.7;
    fx.fade = Math.max(fx.fade, eInOutCubic(seg(t, bt(16) - 0.22, bt(16) - 0.02)));
  },
};
