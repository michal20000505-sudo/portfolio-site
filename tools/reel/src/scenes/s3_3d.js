// S3 — DESIGN 3D (B24–B32): zestaw prezentowy (Body Creator) → kontroler custom.
// Skan: siatka (wireframe) → bryła, pierścienie-żyroskop C/M/Y, obroty "whip", plasterkowy glitch, "PRESS START".
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  W, H, CX, BEAT, S16, bt, C, M, Y, INK, GREY, clamp, lerp, seg, rad, TAU,
  eOutExpo, eInExpo, eInOutExpo, eOutBack, eInBack, eInOutCubic, eInCubic, decay, pulse, hash,
  inkText, inkOff, scramble,
} from '../core.js';
import { ENV, sectionTitle, tapeLabel, bgEntry, makeBurst, drawBurst } from '../common.js';

const B0 = 24;
let scene, cam, podium, rimTorus, rings = [], scanDisc, scanEdge;
const models = {};
const burst = makeBurst(31, 90, 1900);

function prepModel(gltf, sizeFactor) {
  const root = gltf.scene;
  let box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(3.4 / Math.max(size.x, size.z), 2.6 / size.y) * sizeFactor;
  root.scale.setScalar(s);
  box = new THREE.Box3().setFromObject(root);
  const ctr = box.getCenter(new THREE.Vector3());
  root.position.x -= ctr.x; root.position.z -= ctr.z; root.position.y -= box.min.y;
  box = new THREE.Box3().setFromObject(root);
  const clipSolid = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const clipWire = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const solid = new THREE.Group(); solid.add(root);
  const wire = new THREE.Group();
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.55, clippingPlanes: [clipWire], depthWrite: false });
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const cl = mats.map(m => { const c = m.clone(); c.clippingPlanes = [clipSolid]; c.envMapIntensity = 0.8; return c; });
    o.material = Array.isArray(o.material) ? cl : cl[0];
    const w = new THREE.Mesh(o.geometry, wireMat);
    o.updateWorldMatrix(true, false);
    w.matrixAutoUpdate = false;
    w.userData.src = o;
    wire.add(w);
  });
  const pivot = new THREE.Group();
  pivot.add(solid); pivot.add(wire);
  return { pivot, solid, wire, root, clipSolid, clipWire, minY: box.min.y, maxY: box.max.y };
}

// siatka musi iść za bryłą (te same macierze świata)
function syncWire(m) {
  m.pivot.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(m.wire.matrixWorld).invert();
  for (const w of m.wire.children) w.matrix.multiplyMatrices(inv, w.userData.src.matrixWorld);
}

export default {
  name: '3d', b0: 24, b1: 32, pre: 0.55, post: 0.02,
  async load() {
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(ENV.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0a0a, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3.5, 5.5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: 1, far: 15 });
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rimM = new THREE.PointLight(0xff00ff, 22, 14, 2); rimM.position.set(-3.2, 2.4, -3.2); scene.add(rimM);
    const rimC = new THREE.PointLight(0x00ffff, 14, 14, 2); rimC.position.set(3.4, 1.4, -2.6); scene.add(rimC);
    const fill = new THREE.PointLight(0xffffff, 5, 12, 2); fill.position.set(-1.5, 1.8, 4.5); scene.add(fill);
    podium = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.98, 0.16, 96), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 }));
    podium.position.y = -0.08; podium.receiveShadow = true; scene.add(podium);
    rimTorus = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.018, 12, 160), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 1.2 }));
    rimTorus.rotation.x = Math.PI / 2; scene.add(rimTorus);
    [0x00ffff, 0xff00ff, 0xffff00].forEach(c => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.013, 8, 220), new THREE.MeshBasicMaterial({ color: c }));
      rings.push(r); scene.add(r);
    });
    scanDisc = new THREE.Mesh(new THREE.CircleGeometry(2.3, 96), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    scanDisc.rotation.x = -Math.PI / 2; scene.add(scanDisc);
    scanEdge = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.012, 6, 160), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scanEdge.rotation.x = Math.PI / 2; scene.add(scanEdge);
    const loader = new GLTFLoader();
    const [gift, ctrl] = await Promise.all([loader.loadAsync('../../models/gift.glb'), loader.loadAsync('../../models/controller.glb')]);
    models.gift = prepModel(gift, 0.78);
    models.ctrl = prepModel(ctrl, 1.0);
    scene.add(models.gift.pivot, models.ctrl.pivot);
  },
  frame(S, Ls) {
    const { t, B } = S, L = B - B0, fx = S.fx;
    const front = Ls.front.g;
    // ---- przejście z brandingu: trzy ukośne pasy C/M/Y
    if (L < 0.55) {
      const u = seg(L, -0.55, 0.5);
      front.save();
      front.translate(CX, H / 2); front.rotate(rad(-24));
      INK.forEach((c, k) => {
        const e = eInOutCubic(clamp((u - k * 0.1) / 0.7));
        const x0 = lerp(-1700, 1700, e);
        front.fillStyle = c;
        front.fillRect(x0 - 1200, -1500, 1200, 3000);
      });
      front.restore();
      if (L < 0) return;
    }
    // ---- tło: mora
    S.bgs.push(bgEntry(4, [0.26, 52, t, 1.0], [36, 0.8, 0, 0]));
    // ---- kamera
    const dolly = eInExpo(seg(L, 6.9, 8));
    cam.position.set(0, lerp(3.1, 1.7, dolly), lerp(10.9, 5.0, dolly));
    cam.lookAt(0, lerp(0.95, 1.0, dolly), 0);
    // ---- modele
    const gift = models.gift, ctrl = models.ctrl;
    const gOn = L < 4.0, cOn = L >= 3.85;
    gift.pivot.visible = gOn; ctrl.pivot.visible = cOn;
    let whip = 0;
    if (gOn) {
      const sc = lerp(0.55, 1, eOutBack(seg(L, 0.0, 0.5), 1.6)) * (1 - eInBack(seg(L, 3.7, 4.0), 2.0));
      gift.pivot.scale.setScalar(Math.max(sc, 0.001));
      gift.pivot.rotation.y = -0.7 + 0.6 * (t - bt(B0)) + TAU * eInOutExpo(seg(L, 2, 3));
      const sy = lerp(gift.maxY + 0.15, gift.minY - 0.1, eInOutCubic(seg(L, 0.05, 1.7)));
      gift.clipSolid.constant = -sy; gift.clipWire.constant = sy;
      syncWire(gift);
      scanDisc.position.y = sy; scanEdge.position.y = sy;
      scanDisc.visible = scanEdge.visible = L < 1.75;
    }
    if (cOn) {
      const sc = lerp(0.3, 1, eOutBack(seg(L, 3.95, 4.45), 1.8));
      ctrl.pivot.scale.setScalar(sc);
      const free = 0.5 + 0.55 * (t - bt(B0 + 4)) + TAU * eInOutExpo(seg(L, 6, 7));
      ctrl.pivot.rotation.y = lerp(free, TAU + 0.62, eInOutCubic(seg(L, 6.95, 7.55)));
      ctrl.pivot.rotation.x = rad(-8) * dolly;
      const sy = lerp(ctrl.maxY + 0.15, ctrl.minY - 0.1, eInOutCubic(seg(L, 4.0, 5.0)));
      ctrl.clipSolid.constant = -sy; ctrl.clipWire.constant = sy;
      syncWire(ctrl);
      if (L >= 4) { scanDisc.position.y = sy; scanEdge.position.y = sy; scanDisc.visible = scanEdge.visible = L < 5.05; }
    }
    // ---- pierścienie-żyroskop
    let st = 0;
    for (let b = 0; b < 8; b++) st += eOutBack(seg(L, b, b + 0.45), 1.7);
    const rs = lerp(0.6, 1, eOutExpo(seg(L, 0, 0.8)));
    rings.forEach((r, i) => {
      r.position.y = 1.05;
      r.scale.setScalar(rs * (1 + 0.04 * pulse(t, bt(B0 + Math.floor(L)), 0.12)));
      const a = t * (0.5 + i * 0.22) + st * rad(90) * (i % 2 ? -1 : 1);
      if (i === 0) r.rotation.set(rad(72) + a * 0.2, a, 0);
      if (i === 1) r.rotation.set(a, rad(30), rad(60));
      if (i === 2) r.rotation.set(rad(-50), rad(20) + a * 0.6, a);
    });
    rimTorus.material.emissiveIntensity = 1.0 + 2.5 * pulse(t, bt(B0 + Math.floor(L)), 0.15);
    podium.rotation.y = t * 0.3;
    S.list3d.push({ scene, camera: cam });
    fx.tone3d = 2; fx.exposure = 1.15;
    fx.bloomW = [0.5, 0.35, 0.3, 1.0];
    // ---- plasterkowy glitch 3D
    fx.glitch3d = 0.8 * (pulse(t, bt(B0 + 3), 0.06) + pulse(t, bt(B0 + 3.5), 0.05) + pulse(t, bt(B0 + 6.5), 0.06) + pulse(t, bt(B0 + 7), 0.05));
    fx.glitchSeed = Math.floor(t * 30);
    // ---- wymiana modeli: rozbłysk cząsteczek
    drawBurst(Ls.add.g, burst, t, bt(B0 + 4), CX, 1080, { drag: 5, r0: 60 });
    fx.aberr += 14 * pulse(t, bt(B0 + 4), 0.09) + 10 * pulse(t, bt(B0 + 2), 0.08) + 10 * pulse(t, bt(B0 + 6), 0.08);
    // ---- teksty
    sectionTitle(front, S, { num: '03', label: 'PROJEKTOWANIE PRODUKTOWE', lines: ['DESIGN 3D'], b0: B0 + 0.35, bOut: B0 + 6.85, y: 240, size: 150 });
    const cap = (txt, sub, b0, b1, seed) => {
      if (L < b0 || L > b1 + 0.3) return;
      const tb = bt(B0 + b0), out = eInExpo(seg(L, b1, b1 + 0.25));
      const rv = eOutExpo(seg(t, tb, tb + 0.3)) * (1 - out);
      tapeLabel(front, txt, CX, 1405, { size: 64, reveal: rv, inks: inkOff(16 * decay(t, tb, 0.08), 0.5, seed) });
      front.globalAlpha = rv;
      inkText(front, scramble(sub, t, tb + 0.1, 0.35, seed), CX, 1492, { weight: 500, size: 24, color: GREY, spacing: 4 });
      front.globalAlpha = 1;
    };
    cap('ZESTAW PREZENTOWY', 'BODY CREATOR · OD KONCEPCJI DO WIZUALIZACJI', 0.45, 3.6, 3);
    cap('KONTROLER CUSTOM', 'AUTORSKI PROJEKT PRODUKTU', 4.4, 6.8, 5);
    // PRESS START
    if (L >= 7) {
      const blink = Math.floor((t - bt(B0 + 7)) / (BEAT / 4)) % 2 === 0 ? 1 : 0.25;
      inkText(front, 'PRESS START', CX, 1470, { weight: 700, size: 58, color: C, spacing: 12, alpha: blink, inks: inkOff(10 * pulse(t, bt(B0 + 7), 0.1), 0.5, 2) });
    }
    fx.flash += 0.5 * eInExpo(seg(L, 7.6, 8.0));
    fx.flashCol = [0.85, 1, 1];
  },
};
