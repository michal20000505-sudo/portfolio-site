// S1 — STRONA (B1.55–B8): telefon 3D ze stroną przewijaną na beatach; z ekranu "wyskakują" prawdziwe elementy strony:
// B3 oferta (karty w coverflow), B4.5 zespół (4 trenerów), B6 opinie (5 gwiazdek). B7.25 tapnięcie w "Darmowa konsultacja"
// i nurkowanie kamery w złotą kartę → formularz.
import * as THREE from 'three';
import {
  W, H, CX, CY, BEAT, S16, bt, rt, GOLD, GOLD_HI, ICE, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eOutBack, eInOutCubic, eOutCubic, eInCubic, decay, pulse, text, fitSize, star,
} from '../core.js';
import { pixelCam, wx, wy, cardMesh, shadowMesh, goldLabel, touch, dust, clipFrame, CLIP, bgEntry, makeBurst, drawBurst } from '../common.js';
import {
  PH, PULL1, TAP_B, DIVE0, DIVE1, POPS, popWeight, buildPhone, phonePose, applyPose, drawScreen, pageLayout, scrollInit, scrollAt,
  elemRect, cssToFrame, screenUniforms, phone,
} from '../phone.js';

let scene, cam;
const POP_CARDS = [];
const M4 = new THREE.Matrix4(), T4 = new THREE.Matrix4(), S4 = new THREE.Matrix4();
const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), Q0 = new THREE.Quaternion(), Q1 = new THREE.Quaternion(), SC0 = new THREE.Vector3(), SC1 = new THREE.Vector3();
const EUL = new THREE.Euler();

// karta: element strony, który wyskakuje z ekranu (home = jego miejsce na stronie) albo wyłania się zza innej karty (from)
function popCard(img, width, o) {
  const mesh = cardMesh(img, width, o.round ?? 16);
  mesh.renderOrder = o.order ?? 20 + POP_CARDS.length;
  mesh.material.depthTest = false;
  const sh = shadowMesh(mesh.userData.w, mesh.userData.h);
  sh.renderOrder = 10;
  sh.material.depthTest = false;
  scene.add(sh, mesh);
  const c = { mesh, sh, ...o };
  POP_CARDS.push(c);
  return c;
}

// macierz "domu" elementu: prostokąt CSS strony na powierzchni ekranu (przy bieżącym przewinięciu)
function homeMatrix(out, r, scroll, cardW) {
  const lx = (r.x + r.w / 2 - PH.CSS_W / 2) * PH.K;
  const ly = -((PH.SB + r.y + r.h / 2 - scroll) - PH.CSS_H / 2) * PH.K;
  T4.makeTranslation(lx, ly, PH.DEPTH / 2 + 2);
  S4.makeScale(r.w * PH.K / cardW, r.w * PH.K / cardW, 1);
  out.copy(phone().group.matrixWorld).multiply(T4).multiply(S4);
  return out;
}
function targetMatrix(out, g) {
  EUL.set(rad(g.rx || 0), rad(g.ry || 0), rad(g.rz || 0));
  Q1.setFromEuler(EUL);
  out.compose(P1.set(wx(g.x), wy(g.y), g.z), Q1, SC1.set(1, 1, 1));
  return out;
}

const HM = new THREE.Matrix4(), TM = new THREE.Matrix4();
function placeCard(c, B, t, scroll) {
  const { mesh, sh } = c;
  const bIn = c.b0, bOut = c.b1;
  const eIn = seg(B, bIn, bIn + (c.inDur ?? 0.34));
  const eOut = eInOutCubic(seg(B, bOut, bOut + (c.outDur ?? 0.26)));
  const e = eOutBack(eIn, 1.15) * (1 - eOut);
  const vis = B >= bIn && eOut < 1;
  mesh.visible = sh.visible = vis;
  if (!vis) return 0;
  if (c.home) homeMatrix(HM, c.home, scroll, mesh.userData.w);
  else {   // wyłania się zza karty-matki
    HM.copy(c.from.mesh.matrixWorld);
    T4.makeTranslation(0, 0, -6); S4.makeScale(0.92, 0.92, 1);
    HM.multiply(T4).multiply(S4);
  }
  // lekkie unoszenie się na miejscu docelowym
  const g = { ...c.target };
  g.y += 7 * Math.sin(t * 2.2 + c.target.x * 0.01);
  g.ry = (g.ry || 0) + 2.5 * Math.sin(t * 1.3 + c.target.y * 0.01);
  targetMatrix(TM, g);
  HM.decompose(P0, Q0, SC0);
  TM.decompose(P1, Q1, SC1);
  const ep = clamp(e, -0.1, 1.1);
  P0.lerp(P1, ep);
  P0.z += Math.sin(Math.PI * clamp(eIn)) * 90 * (1 - eOut);      // łuk: najpierw odrywa się od ekranu
  Q0.slerp(Q1, clamp(eOutCubic(eIn) * (1 - eOut)));
  SC0.lerp(SC1, clamp(ep));
  mesh.position.copy(P0); mesh.quaternion.copy(Q0); mesh.scale.copy(SC0);
  mesh.updateMatrixWorld(true);
  // cień: za kartą, przesunięty w dół
  sh.position.copy(P0).add(new THREE.Vector3(0, -28, -30).applyQuaternion(Q0));
  sh.quaternion.copy(Q0); sh.scale.copy(SC0);
  sh.material.opacity = 0.55 * clamp(e);
  const u = mesh.material.uniforms;
  u.uOpacity.value = c.home ? 1 : clamp(eIn * 3) * (1 - eOut);
  // połysk przelatuje po karcie tuż po wyskoku
  u.uShinePos.value = lerp(-0.4, 1.9, seg(B, bIn + 0.08, bIn + 0.75));
  u.uShine.value = 0.22;
  u.uBright.value = c.dim ?? 1;
  return clamp(e);
}

// tytuł nad telefonem: złota etykieta + biały nagłówek (maska od dołu), jak nagłówki sekcji na stronie
function popTitle(g, t, label, title, b0, b1, outDur = 0.2) {
  const t0 = bt(b0), t1 = bt(b1);
  if (t < t0 - 0.02 || t > t1 + outDur + 0.05) return;
  const out = eInExpo(seg(t, t1, t1 + outDur));
  goldLabel(g, label, CX, 262 - 30 * out, { size: 25, reveal: seg(t, t0, t0 + 0.3), alpha: 1 - out });
  const size = fitSize(g, title, 900, 960, 68, 0.02);
  const words = title.split(' ');
  // słowa wjeżdżają z maski po kolei
  let wsum = 0;
  const ws = words.map(w => { g.font = `900 ${size}px Inter`; g.letterSpacing = size * 0.02 + 'px'; const m = g.measureText(w + ' ').width; wsum += m; return m; });
  let x = CX - wsum / 2;
  const base = 352;
  words.forEach((w, i) => {
    const ti = t0 + 0.04 + i * 0.04;
    const e = eOutExpo(seg(t, ti, ti + 0.3));
    g.save();
    g.beginPath(); g.rect(0, base - size * 1.0, W, size * 1.25); g.clip();
    text(g, w, x, base + (1 - e) * size * 1.1 - out * size * 1.2, { weight: 900, size, spacing: size * 0.02, color: ICE });
    g.restore();
    x += ws[i];
  });
}

const BURST_STARS = makeBurst(31, 26, 900, [0.3, 0.7]);

export default {
  name: 'site', b0: 1.55, b1: 8.0, pre: 0, post: 0,
  async load() {
    pageLayout();
    scrollInit();
    scene = new THREE.Scene();
    cam = pixelCam(30);
    buildPhone(scene);
    // oferta: główna karta + coverflow pozostałych wariantów
    // (karty boczne rysowane przed główną — ta zawsze leży na wierzchu; bez testu głębi liczy się kolejność)
    const main = popCard('el_service_0', 620, { home: elemRect('service0'), b0: POPS[0].b0, b1: POPS[0].b1, target: { x: CX, y: 1000, z: 330, rx: 2, ry: -4 }, order: 30 });
    const side = [
      ['el_service_1', { x: CX - 418, y: 975, z: 30, ry: 38 }, 0, 24],
      ['el_service_2', { x: CX + 418, y: 975, z: 30, ry: -38 }, 1, 23],
    ];
    for (const [img, target, k, order] of side) {
      popCard(img, 480, { from: main, b0: POPS[0].b0 + 0.125 + k * 0.125, b1: POPS[0].b1 - 0.06 + k * 0.03, target, inDur: 0.36, order, dim: 0.72 });
    }
    // zespół: siatka 2×2 rozsuwa się przed telefonem
    const TG = [[CX - 168, 770, -3, 6, -1.5], [CX + 168, 770, 3, -6, 1.5], [CX - 168, 1310, -3, 6, 1.2], [CX + 168, 1310, 3, -6, -1.2]];
    TG.forEach(([x, y, rx, ry, rz], i) => {
      popCard('el_team_' + i, 312, { home: elemRect('team' + i), b0: POPS[1].b0 + i * 0.125, b1: POPS[1].b1 + (3 - i) * 0.03, target: { x, y, z: 250, rx, ry, rz }, round: 16 });
    });
    // opinie
    popCard('el_review', 800, { home: elemRect('review'), b0: POPS[2].b0, b1: POPS[2].b1, target: { x: CX, y: 1085, z: 330, rx: 2, ry: 4 }, outDur: 0.22 });
  },
  frame(S, Ls) {
    const { t, B, tr } = S, fx = S.fx;
    const front = Ls.front.g, add = Ls.add.g, hud = Ls.hud.g;
    // tło: czarno-białe ujęcie ze studia + złota poświata z góry (jak podświetlone logo na ścianie)
    const inA = seg(B, 1.6, 2.0);
    S.bgs.push(bgEntry(clipFrame('rack', tr - rt(1.6)), CLIP.rack.aspect, 0.4 * inA * (1 - seg(B, 7.4, 7.9)), { zoom: 1.08 + 0.02 * tr, fx: 0.5, fy: 0.5, bright: 0.85, sat: 0, contrast: 1.15 }));
    fx.glow = Math.max(fx.glow, 0.13 * inA * (1 - seg(B, 7.4, 7.9)));
    fx.glowY = -120; fx.glowR = 1050;
    // strona na ekranie
    const scroll = scrollAt(B);
    const holes = [];
    // telefon
    const pose = phonePose(B, tr);
    applyPose(pose);
    const su = screenUniforms();
    su.uBright.value = (1 - 0.3 * popWeight(B)) * lerp(0.55, 1, seg(B, 1.8, 2.0));
    su.uShine.value = 0.05 + 0.06 * Math.sin(tr * 0.9);
    su.uShinePos.value = 0.6 + 0.5 * Math.sin(tr * 0.7);
    // wyskakujące karty
    for (const c of POP_CARDS) {
      const e = placeCard(c, B, tr, scroll);
      if (c.home && e > 0) holes.push({ r: c.home, a: clamp(e * 1.4), round: c.round ?? 16 });
    }
    // wciśnięta karta konsultacji
    const press = { r: elemRect('cta'), a: Math.exp(-Math.pow((B - TAP_B - 0.06) / 0.12, 2)) };
    drawScreen(t, B, { holes, press, heroNoTitle: B < PULL1 });
    S.list3d.push({ scene, camera: cam });
    fx.tone3d = 1;
    // tytuły nad telefonem
    popTitle(front, t, 'WARIANTY WSPÓŁPRACY', 'WYBIERZ SWOJĄ FORMĘ', POPS[0].b0, POPS[0].b1 + 0.05);
    popTitle(front, t, 'NASZ ZESPÓŁ', 'PROFESJONALIŚCI Z PASJĄ', POPS[1].b0, POPS[1].b1 + 0.05);
    popTitle(front, t, 'OPINIE KLIENTÓW', 'ŚREDNIA 5.0 W GOOGLE', POPS[2].b0, POPS[2].b1);
    popTitle(front, t, 'ZERO ZOBOWIĄZAŃ', 'DARMOWA KONSULTACJA', 7.0, DIVE0 - 0.04, 0.12);
    // gwiazdki opinii: zapalają się na 16-kach
    const sb = POPS[2].b0;
    for (let k = 0; k < 5; k++) {
      const tk = bt(sb + k / 8);
      const e = eOutBack(seg(t, tk, tk + 0.18), 2.2) * (1 - eInCubic(seg(t, bt(POPS[2].b1), bt(POPS[2].b1) + 0.12)));
      if (e <= 0) continue;
      const x = CX + (k - 2) * 92, y = 458;
      front.save();
      front.translate(x, y); front.scale(e, e); front.rotate((1 - e) * 0.6);
      front.shadowColor = 'rgba(247,181,0,0.7)'; front.shadowBlur = 26;
      star(front, 0, 0, 38); front.fillStyle = GOLD; front.fill();
      front.restore();
      drawBurst(add, BURST_STARS.slice(k * 5, k * 5 + 5), t, tk, x, y, { r0: 30, grav: 0 });
    }
    // dotyk: palec na złotej karcie, tapnięcie w B7.25
    const r = elemRect('cta');
    const [tx, ty] = cssToFrame(B, tr, r.x + r.w * 0.62, r.y + r.h * 0.55, scroll);
    touch(hud, t, tx, ty, { t0: bt(7.0), tTap: bt(TAP_B), t1: bt(DIVE0 + 0.08), r: 44 });
    // złoty pył
    dust(add, tr, 0.9 * inA * (1 - seg(B, 7.3, 7.7)));
    // akcenty kamery: lądowanie telefonu na dropie, pchnięcia na stopach, wyskoki
    fx.shakeY += 16 * decay(t, bt(PULL1), 0.05) * Math.sin((t - bt(PULL1)) * 70);
    fx.zoom *= 1 + 0.02 * pulse(t, bt(PULL1), 0.1);
    for (const p of POPS) {
      fx.zoom *= 1 + 0.012 * pulse(t, bt(p.b0), 0.12);
      fx.aberr += 3 * pulse(t, bt(p.b0), 0.08);
    }
    fx.bloom = 0.5; fx.bloomThresh = 0.62;
  },
};
