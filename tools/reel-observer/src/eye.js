// OBSERVER 01 w reelsie: ten sam model co na stronie (eye-observer-model.js), to samo środowisko studyjne i światła
// co w eye-observer.js; tone mapping ACES (ekspozycja 1.08) liczy kompozycja w gfx.js.
// Wszystko jest funkcją parametrów podanych na klatkę — bez własnego zegara, więc render jest deterministyczny.
//
// Kadrowanie jak w intrze strony (setFraming): kamera widzi oko tak, jakby patrzyła przez kwadrat o boku `size`
// w punkcie (x, y) ekranu — oko zawsze patrzy "na wprost", niezależnie od miejsca w kadrze. `dist` to odległość
// kamery (8.7 = jak na stronie); większa spłaszcza perspektywę rozrzuconych części, mniejsza ją pogłębia.
import * as THREE from 'three';
import { buildObserver } from '../../../eye-observer-model.js';
import { W, H, rng, rad } from './core.js';

// kopia studioEnvironment() z eye-observer.js (tam nie jest eksportowana)
function studioEnvironment(renderer) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#929fa8'); gradient.addColorStop(.45, '#343b40'); gradient.addColorStop(.7, '#13191f'); gradient.addColorStop(1, '#050709');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#fff1dc'; ctx.beginPath(); ctx.roundRect(95, 80, 180, 145, 55); ctx.fill();
  ctx.fillStyle = '#f0f6ff'; ctx.beginPath(); ctx.roundRect(640, 50, 65, 225, 30); ctx.fill();
  ctx.fillStyle = '#86bed6'; ctx.fillRect(820, 190, 90, 170);
  ctx.fillStyle = '#fffaf3'; ctx.fillRect(435, 30, 210, 35);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer), target = pmrem.fromEquirectangular(texture);
  pmrem.dispose(); texture.dispose(); return target;
}

// połowa wysokości płaszczyzny modelu widoczna w kadrze oka na stronie (kamera z = 8.7, fov 32°)
const HALF = 8.7 * Math.tan(rad(16));

export class Eye {
  constructor(renderer, seed = 7) {
    this.scene = new THREE.Scene();
    this.env = studioEnvironment(renderer);
    this.scene.environment = this.env.texture;
    this.scene.add(new THREE.HemisphereLight(0xd8e5ed, 0x3a2f22, .8));
    const key = new THREE.DirectionalLight(0xffe6ca, 2.5); key.position.set(-3, 5, 4); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc3e5ff, 1.2); fill.position.set(4, 1, 2); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x59bfe2, 3); rim.position.set(2, 3, -3); this.scene.add(rim);
    // dodatkowe światło w kolorze farby (cennik: płyty C/M/Y odbijają się w pancerzu); domyślnie wyłączone
    this.tint = new THREE.PointLight(0xffffff, 0, 0, 2); this.tint.position.set(0, 0, 4); this.scene.add(this.tint);
    this.model = buildObserver();
    this.scene.add(this.model.root);
    this.camera = new THREE.PerspectiveCamera(32, 1, .1, 60);
    this.buildParts(seed);
  }

  // Części do rozpadu: grupy z wieloma elementami rozbijane na elementy (jak playAssembly na stronie),
  // ale płyty pancerza i osłony boczne lecą w całości, a kabel razem ze swoim oplotem i złączkami.
  buildParts(seed) {
    const m = this.model, root = m.root;
    const whole = new Set([...m.armor.map(a => a.node), ...m.doors.map(d => d.node)]);
    const kids = root.children, groups = [];
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      if (c.isMesh && c.geometry.type === 'TubeGeometry') { groups.push(kids.slice(i, i + 4)); i += 3; continue; }
      if (whole.has(c)) { groups.push([c]); continue; }
      if (c.isGroup && c.children.length > 3) { for (const cc of c.children) groups.push([cc]); continue; }
      groups.push([c]);
    }
    m.pose({ time: 0, opening: 1 });
    root.updateMatrixWorld(true);
    const R = rng(seed), rand = (a, b) => a + R() * (b - a);
    const box = new THREE.Box3(), inv = new THREE.Matrix4(), tmp = new THREE.Vector3();
    this.parts = groups.map((nodes, i) => {
      box.makeEmpty();
      for (const n of nodes) box.expandByObject(n);
      const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());   // w układzie root (root stoi w zerze)
      const parent = nodes[0].parent;
      inv.copy(parent.matrixWorld).invert();
      const cLocal = center.clone().applyMatrix4(inv);
      // kierunek na zewnątrz od środka oka + rozrzut; część leci też w stronę widza
      const out = new THREE.Vector3(center.x, center.y, 0);
      if (out.length() < .15) out.set(rand(-1, 1), rand(-1, 1), 0);
      out.normalize();
      const dir = new THREE.Vector3(out.x + rand(-.45, .45), out.y + rand(-.45, .45), rand(-.5, 1.1)).normalize();
      const dist = rand(3.2, 7.5) * (center.z > .6 ? 1.15 : 1);
      // przesunięcie w układzie rodzica (rodzic może być obrócony, np. żebra obudowy)
      const dirWorld = dir.clone().multiplyScalar(dist);
      const pq = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const offset = dirWorld.clone().applyQuaternion(pq);
      const axis = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      tmp.copy(center);
      return {
        nodes, cLocal, offset, axis, angle: rand(2.2, 5.5) * (R() < .5 ? -1 : 1),
        rnd: [R(), R(), R(), R()], center: center.clone(), size: box.isEmpty() ? .1 : box.getSize(new THREE.Vector3()).length(),
        saved: nodes.map(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() })),
      };
    });
    // kolejność składania: od środka (obudowa, mechanizm) do zewnątrz (pancerz, osłony, optyka na końcu)
    const rank = p => {
      const n = p.nodes[0];
      if (n === m.optics || p.nodes[0].parent === m.optics) return 4;
      if (whole.has(n)) return m.doors.some(d => d.node === n) ? 3 : 2;
      if (n === m.crown || n === m.lower) return 3;
      return p.center.z < .3 ? 0 : 1;
    };
    this.parts.forEach(p => {
      p.rank = rank(p);
      const ai = m.armor.findIndex(a => a.node === p.nodes[0]);
      if (ai >= 0) p.armorIndex = ai;
    });
  }

  /**
   * Ustawia oko na klatkę.
   * o: x, y, size (px), dist, yaw, pitch, roll, bob, pupil, opening, spread, excitement, light, motor, time, scanning, sleeping,
   *    scale (ściśnięcie [sx, sy]), scatter(part, i) → stopień rozpadu części (0 = złożone), spinScatter (dodatkowy obrót rozrzuconych części).
   */
  set(o) {
    this.o = o;
    const m = this.model;
    m.pose({
      time: o.time ?? 0, motorTime: o.motor ?? o.time ?? 0, activity: o.scanning ? 2.6 : 1,
      opening: o.opening ?? 1, pupilSize: o.pupil ?? 1, spread: o.spread ?? 0, excitement: o.excitement ?? 0,
      scanning: o.scanning ?? 0, sleeping: !!o.sleeping, light: o.light ?? 1,
    });
    const r = m.root;
    r.rotation.set(o.pitch ?? 0, o.yaw ?? 0, o.roll ?? 0);
    r.position.set(o.dx ?? 0, o.bob ?? 0, o.dz ?? 0);
    const [sx, sy] = o.scale || [1, 1];
    r.scale.set(sx, sy, (sx + sy) / 2);
    // kamera: kwadrat oka o boku size w (x, y)
    const cam = this.camera, dist = o.dist ?? 12;
    cam.fov = 2 * Math.atan(HALF / dist) * 180 / Math.PI;
    cam.aspect = 1;
    cam.near = Math.max(.05, dist * .02); cam.far = dist + 40;
    cam.position.set(0, .2 * dist / 8.7, dist);
    cam.lookAt(0, -.08, 0);
    cam.setViewOffset(o.size, o.size, -(o.x - o.size / 2), -(o.y - o.size / 2), W, H);
    cam.updateProjectionMatrix();
    if (o.tint) { this.tint.color.setRGB(...o.tint[0]); this.tint.intensity = o.tint[1]; this.tint.position.set(...(o.tint[2] || [0, 0, 4])); }
    else this.tint.intensity = 0;
  }

  // rozrzut części nakładany tylko na czas renderu (pose() nie resetuje statycznych węzłów)
  applyScatter() {
    const o = this.o;
    if (!o.scatter) return false;
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), off = new THREE.Vector3();
    let any = false;
    this.parts.forEach((p, i) => {
      const d = o.scatter(p, i);
      p.nodes.forEach((n, j) => { p.saved[j].p.copy(n.position); p.saved[j].q.copy(n.quaternion); });
      if (!d) return;
      any = true;
      const spin = d + (o.spinScatter ? o.spinScatter(p, i) : 0);
      q.setFromAxisAngle(p.axis, p.angle * spin);
      // wir: przesunięcie obrócone wokół osi optycznej proporcjonalnie do rozrzutu (spirala przy składaniu)
      const sw = (o.swirl || 0) * d * (0.7 + 0.6 * p.rnd[0]);
      const cs = Math.cos(sw), sn = Math.sin(sw);
      off.set(p.offset.x * cs - p.offset.y * sn, p.offset.x * sn + p.offset.y * cs, p.offset.z);
      for (const n of p.nodes) {
        // obrót wokół środka części, potem odlot
        v.copy(n.position).sub(p.cLocal).applyQuaternion(q).add(p.cLocal).addScaledVector(off, d);
        n.position.copy(v);
        n.quaternion.premultiply(q);
      }
    });
    this.scattered = any;
    return any;
  }
  restoreScatter() {
    for (const p of this.parts) p.nodes.forEach((n, j) => { n.position.copy(p.saved[j].p); n.quaternion.copy(p.saved[j].q); });
  }

  /** wpis do listy 3D pipeline'u */
  item() {
    return { scene: this.scene, camera: this.camera, before: () => this.applyScatter(), after: () => this.restoreScatter() };
  }

  /** środek źrenicy na ekranie (px) — do snopa światła i dymków */
  lensScreen() {
    const v = new THREE.Vector3(0, 0, 1.2);
    this.model.root.updateMatrixWorld(true);
    this.model.root.localToWorld(v);
    v.project(this.camera);
    return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
  }
}
