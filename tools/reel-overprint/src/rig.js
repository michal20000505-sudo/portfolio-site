// Silnik gry OVERPRINT (shooter/*.js ze strony, bez zmian) sterowany czasem reelsa.
// Rig = View + Game na własnym płótnie w niskiej rozdzielczości. Ujęcie (shot) ustawia scenariusz: fala,
// bronie, tusze, wrogowie, ruch gracza, zdarzenia (ULT, dash) i kamerę. Symulacja idzie stałymi krokami,
// więc przy nagrywaniu (subklatki rosnąco) każda klatka to kilka kroków; skok wstecz = start ujęcia od nowa.
import { View } from '../../../shooter/render.js?v=20260928c';
import { Game } from '../../../shooter/game.js?v=20260928c';
import { seedRandom, rnd, clamp } from './core.js';

Math.random = rnd;          // gra losuje przez Math.random: z ziarnem każde ujęcie wygląda tak samo przy każdym renderze

const SIN_E = Math.sin(Math.PI / 3);
const OVS = 2;              // nakładka 2D gry (liczby obrażeń) w 2× niskiej rozdzielczości

class RView extends View {
  resize() { if (this.lw) this.frame(); }
  setFrame(lw, lh, V) { this.lw = lw; this.lh = lh; this.V = V; this.frame(); }
  frame() {
    const { lw, lh } = this;
    this.low = { w: lw, h: lh };
    this.renderer.setSize(lw, lh, false);
    this.rt.setSize(lw, lh);
    this.post.uniforms.uRes.value.set(lw, lh);
    this.dpr = 1;
    this.css = { w: lw * OVS, h: lh * OVS };
    this.overlay.width = this.css.w; this.overlay.height = this.css.h;
    this.setV(this.V);
  }
  setV(V) {
    this.V = V;
    const a = this.lw / this.lh, c = this.camera;
    c.left = -V * a / 2; c.right = V * a / 2; c.top = V / 2; c.bottom = -V / 2;
    c.updateProjectionMatrix();
  }
}

const audio = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });

export class Rig {
  /** px: ile pikseli wyjścia na piksel gry; w, h: rozmiar kadru; hRef: wysokość, do której odnosi się V ujęcia
   *  (kadr może być wyższy niż ekran — np. telefon, który najeżdża na cały kadr) */
  constructor(px = 4, w = 1080, h = 1920, hRef = h) {
    this.px = px; this.M = 3;
    this.vk = h / hRef;
    this.lw = Math.ceil(w / px) + this.M * 2;
    this.lh = Math.ceil(h / px) + this.M * 2;
    const cv = document.createElement('canvas'), ov = document.createElement('canvas');
    this.view = new RView(cv, ov);
    this.view.quality = 'high';
    this.view.applyQuality();
    this.view.setFrame(this.lw, this.lh, 30 * this.vk);
    this.edges = new Set();
    const self = this;
    this.input = {
      touch: true, pad: null, mouse: { x: 0, y: 0, down: false, seen: false }, edges: this.edges,
      poll() {}, release() {}, clearEdges() { self.edges.clear(); },
      consume(n) { const had = self.edges.has(n); self.edges.delete(n); return had; },
      move() { return self.shot?.move ? self.shot.move(self.game, self.lt, self) : { x: 0, z: 0 }; },
      aim() { return self.shot?.aim ? self.shot.aim(self.game, self.lt, self) : { mode: 'auto', fire: true }; },
    };
    const hooks = {
      levelUp: () => { this.game.pendingLevels = 0; this.game.state = 'play'; },
      shop: () => this.game.nextWave(),
      over() {}, pause() {}, toast() {}, wave() {}, boss() {}, bossDead() {}, waveClear() {},
    };
    this.game = new Game(this.view, audio, this.input, hooks);
    this.game.settings.numbers = true;
    this.game.settings.shake = true;
    this.game.hurt = () => {};                          // gracz w reelsie nie obrywa (bez czerwonych błysków)
    // wstrząs gry → do kamery reelsa (płynny, bez skoków o piksel)
    this.shake = 0;
    this.view.shake = a => { this.shake = Math.min(1.2, this.shake + a); };
    // przesunięcie płyt z gry słabsze (w grze liczone w pikselach niskiej rozdzielczości): reels dokłada własne na beatach
    const mis = this.view.misregister.bind(this.view);
    this.view.misregister = px => mis(px * .22);
    // arkusz: bez dławienia wysyłki tekstury zegarem przeglądarki
    const paper = this.view.paper, upd = paper.update.bind(paper);
    let clock = 0;
    paper.update = dt => upd(dt, (clock += 1000));
    const r = this.view.renderer;
    this.glRender = r.render.bind(r);
    this.noRender = () => {};
    r.render = this.noRender;
    this.shot = null; this.lt = 0;
  }

  load(shot) {
    this.shot = shot;
    seedRandom(shot.seed || 1);
    const g = this.game, v = this.view;
    g.start();
    v.rings.length = 0; v.beams.length = 0; v.flashAmt = 0; v.misreg = 0;
    this.edges.clear();
    this.shake = 0;
    g.settings.numbers = true;
    v.setV((shot.V ? (typeof shot.V === 'function' ? shot.V(0) : shot.V) : 30) * this.vk);
    shot.setup?.(g, this);
    this.lt = -(shot.pre ?? 1);
    this.evDone = new Set();
    v.follow(g.player.x, g.player.z, 0, undefined, true);
    const cam = shot.cam?.(g, this.lt, this);
    if (cam) v.target.set(cam.x, 0, cam.z);
  }

  step(d) {
    const s = this.shot, g = this.game, v = this.view;
    const t1 = this.lt + d;
    for (const [i, [te, fn]] of (s.events || []).entries()) {
      if (!this.evDone.has(i) && te <= t1) { this.evDone.add(i); fn(g, this); }
    }
    const dt = d * (typeof s.speed === 'function' ? s.speed(this.lt) : s.speed || 1);
    g.update(dt);
    this.lt = t1;
    s.after?.(g, this.lt, this);
    const cam = s.cam?.(g, this.lt, this);
    if (cam) v.target.set(cam.x, 0, cam.z);
    if (s.V) v.setV((typeof s.V === 'function' ? s.V(this.lt) : s.V) * this.vk);
    v.render(g, dt);
    this.shake = Math.max(0, this.shake - dt * 2.6);
  }

  /** Przesuwa ujęcie do czasu lokalnego lt (s od początku ujęcia). */
  seek(shot, lt) {
    if (this.shot !== shot || lt < this.lt - 1e-6) this.load(shot);
    while (this.lt < lt - 1e-7) this.step(Math.min(1 / 120, lt - this.lt));
  }

  /** Rysuje klatkę gry w prostokącie (x, y, w, h) płótna g; ruch kamery pod piksel dzięki marginesowi. */
  draw(ctx, x, y, w, h, { alpha = 1, overlay = true } = {}) {
    const v = this.view, r = v.renderer;
    r.render = this.glRender;
    v.render(this.game, 0);
    r.render = this.noRender;
    const wpp = v.V / v.low.h;
    const tx = Math.round(v.target.x / wpp) * wpp, tz = Math.round(v.target.z / (wpp / SIN_E)) * (wpp / SIN_E);
    const rx = (v.target.x - tx) / wpp, rz = (v.target.z - tz) / (wpp / SIN_E);
    const px = this.px, M = this.M;
    const dw = this.lw * px, dh = this.lh * px;
    const dx = x + (w - dw) / 2 - rx * px, dy = y + (h - dh) / 2 - rz * px;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(v.canvas, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = true;
    if (overlay) ctx.drawImage(v.overlay, dx, dy, dw, dh);
    ctx.restore();
    return { dx, dy, scale: px };
  }

  /** Pozycja punktu świata w pikselach kadru (np. do podpisów przy wrogach). */
  toFrame(wx, wy, wz, x, y, w, h) {
    const s = this.view.worldToScreen(wx, wy, wz);     // w pikselach nakładki (OVS × niska rozdzielczość)
    const k = this.px / OVS;
    return { x: x + (w - this.lw * this.px) / 2 + s.x * k, y: y + (h - this.lh * this.px) / 2 + s.y * k };
  }
}

// ------------------------------------------------------------------ gotowe klocki scenariuszy
const rand = (a, b) => a + rnd() * (b - a);

/** Bot: ucieka od wrogów i pocisków, krąży wokół punktu (cx, cz). */
export function kite(g, { cx = 0, cz = 0, orbit = 1, dashRate = 0 } = {}) {
  const p = g.player;
  let x = 0, z = 0;
  for (const e of g.enemies) {
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
    if (d < 8) { const w = (e.boss ? 3 : 1) / (d * d); x += dx / d * w; z += dz / d * w; }
  }
  for (const b of g.ebullets) {
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1;
    if (d < 4) { x += dx / d * 2 / (d * d); z += dz / d * 2 / (d * d); }
  }
  const ox = p.x - cx, oz = p.z - cz;
  x += (-oz * .012 - ox * .006) * orbit; z += (ox * .012 - oz * .006) * orbit;
  if (dashRate && rnd() < dashRate) g.input.edges.add('dash');
  const l = Math.hypot(x, z) || 1;
  return { x: x / l, z: z / l };
}

/** Pierścień wrogów wokół gracza (od razu na arkuszu, bez spadania). */
export function ring(g, types, n, r0, r1, { wave, elite = 0 } = {}) {
  const p = g.player;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rand(-.2, .2), d = rand(r0, r1);
    const x = clamp(p.x + Math.cos(a) * d, -28, 28), z = clamp(p.z + Math.sin(a) * d, -28, 28);
    if (g.inObstacle(x, z, .8)) continue;
    const e = g.spawnEnemy(types[i % types.length], x, z, rnd() < elite, wave);
    e.spawnT = 0;
  }
}

/** Uzbrojenie: [[id, poziom, 'tusze'], ...] */
export function arm(g, list) {
  g.weapons.length = 0;
  for (const [id, lvl = 1, inks = ''] of list) {
    g.addWeapon(id);
    const w = g.weapons[g.weapons.length - 1];
    w.level = lvl; w.inks = [...inks];
    g.refreshWeapon(w);
  }
  g.ultReady();
}

/** Fala bez końca: licznik spawnu nie kończy się sklepem. */
export function endless(g, wave) {
  g.startWave(wave);
  g.quota = 1e9;
  g.bossPending = -1;
  g.waveBoss = false;
}

export function boss(g, wave) {
  g.startWave(wave);
  g.quota = 1e9;
  g.bossPending = .01;
}
