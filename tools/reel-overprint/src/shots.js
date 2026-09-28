// Scenariusze ujęć z gry. Czas lokalny ujęcia (lt) liczony od początku sceny w reelsie; pre = rozbieg przed kadrem.
import { bt, keys, eInOutCubic, eOutExpo, eInOutQuint, rnd, clamp } from './core.js';
import { kite, ring, arm, endless, boss } from './rig.js';
import { WEAPON_ORDER } from './director.js';

const follow = (sx = 0, sz = 0) => g => ({ x: g.player.x + sx, z: g.player.z + sz });
// kamera za graczem, ale kadr nie wychodzi poza arkusz (za krawędzią widać czarny stół maszyny)
const inside = (V = 30) => g => ({ x: clamp(g.player.x, -30 + V * .3, 30 - V * .3), z: clamp(g.player.z + .3, -30 + V * .62, 30 - V * .62) });

// deszcz kropel-wrogów wokół gracza (spadają z góry jak w grze)
function rain(g, n, r0, r1, types, wave) {
  const p = g.player;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = r0 + rnd() * (r1 - r0);
    const x = clamp(p.x + Math.cos(a) * d, -28, 28), z = clamp(p.z + Math.sin(a) * d, -28, 28);
    if (g.inObstacle(x, z, .8)) continue;
    g.drops.push({ x, z, t: -rnd() * .5, dur: .7, type: types[i % types.length], elite: false });
  }
  g.spawned += n;
}

// ---------------------------------------------------------------- HOOK + FALE (B0–B12, jedno długie ujęcie)
// B3: krople spadają na arkusz, B4: ULT (trzy farby naraz), B4–B12: fala za falą, kamera odjeżdża.
export const OPEN = {
  seed: 11, pre: .6,
  V: lt => keys(lt, [[bt(2.6), 15], [bt(4), 19, eInOutCubic], [bt(7.6), 22], [bt(8.2), 34, eOutExpo], [bt(12), 38]]),
  setup(g) {
    g.player.x = 1; g.player.z = 5;
    arm(g, [['rapidograf', 5, 'Y'], ['rozpylacz', 4, 'M'], ['walki', 4, 'C'], ['tuba', 4, 'MY']]);
    g.stats.area = 1.25; g.stats.maxHp = g.player.hp = 400;
    endless(g, 14);
    g.spawnTimer = 99;                                 // spawn włączamy zdarzeniami
    for (let i = 0; i < 16; i++) g.v.splat(-14 + rnd() * 30, -10 + rnd() * 30, ['#00aeef', '#ec008c', '#ffd200'][i % 3], .4 + rnd() * 1.2, .35);
  },
  events: [
    [bt(2.9), g => rain(g, 34, 3.5, 8, ['kleks', 'kleks', 'smuga', 'plujka', 'dzielnik'], 14)],
    [bt(3.4), g => rain(g, 30, 5, 10, ['kleks', 'walec', 'smuga', 'pecherz'], 14)],
    [bt(4) - .02, g => { g.ult.charge = 999; g.input.edges.add('ult'); }],
    [bt(4.6), g => { g.spawnTimer = .1; g.interval = .05; }],
    [bt(6), g => rain(g, 40, 7, 13, ['kleks', 'smuga', 'walec', 'dzielnik', 'tarczownik', 'zszywacz'], 16)],
    [bt(8), g => { rain(g, 70, 9, 17, ['kleks', 'smuga', 'walec', 'plujka', 'igla', 'kopiarka', 'pecherz'], 18); g.interval = .03; }],
    [bt(10), g => rain(g, 60, 10, 18, ['kleks', 'smuga', 'widmo', 'gabka', 'zszywacz', 'walec'], 20)],
  ],
  // przed ULT gracz stoi pośrodku (kadr na logo), potem kiting
  move: (g, lt) => lt < bt(4.3) ? { x: 0, z: 0 } : kite(g, { cx: 2, cz: 4, dashRate: .006 }),
  aim: (g, lt) => ({ mode: 'auto', fire: lt > bt(3.6) }),
  cam: follow(0, .4),
  after(g) { g.player.hp = g.stats.maxHp; },
};

// ---------------------------------------------------------------- MONTAŻ BRONI (B12–B24): po jednej broni na beat
const WEAPON_SETUP = {
  rapidograf: { ink: 'Y', types: ['kleks', 'smuga'], n: 22, r: [6, 12], extra: 10 },
  rozpylacz: { ink: 'M', types: ['kleks', 'kleks', 'smuga'], n: 46, r: [2.5, 7] },
  rotograf: { ink: 'C', types: ['kleks', 'smuga', 'dzielnik'], n: 44 },
  gilotyna: { ink: 'Y', types: ['kleks', 'walec', 'smuga'], n: 44 },
  tuba: { ink: 'MY', types: ['kleks', 'walec', 'dzielnik'], n: 50 },
  walki: { ink: 'C', types: ['kleks', 'smuga'], n: 46, r: [2, 6] },
  dron: { ink: 'M', types: ['kleks', 'smuga', 'plujka'], n: 44 },
  promien: { ink: 'CM', types: ['kleks', 'walec', 'smuga'], n: 46 },
  stempel: { ink: 'M', types: ['kleks', 'kleks', 'smuga'], n: 52, r: [1.8, 6] },
  linijka: { ink: 'Y', types: ['kleks', 'smuga'], n: 46 },
  aerograf: { ink: 'CY', types: ['kleks', 'kleks', 'smuga'], n: 50, r: [2, 6] },
  pinezki: { ink: 'MY', types: ['kleks', 'smuga', 'walec'], n: 50, r: [2.5, 8] },
};
export const WEAPON_SHOTS = WEAPON_ORDER.map((id, i) => {
  const o = WEAPON_SETUP[id];
  return {
    id, seed: 100 + i, pre: 1.5,
    V: lt => 15.5 - lt * 1.2,                           // powolny najazd przez cały beat
    setup(g) {
      arm(g, [[id, 5, o.ink]]);
      g.stats.area = 1.2;
      endless(g, 8);
      g.spawnTimer = 99;
      g.player.x = (i % 2 ? -3 : 3); g.player.z = 4;
      ring(g, o.types, o.n, ...(o.r || [3.5, 10]), { wave: 8 });
    },
    events: [[-.8, g => ring(g, o.types, o.extra ?? 30, 6, 11, { wave: 8 })]],
    move: g => kite(g, { cx: g.player.x + 3, cz: g.player.z, orbit: .5 }),
    cam: follow(0, .3),
    after(g) { g.player.hp = g.stats.maxHp; },
  };
});

// ---------------------------------------------------------------- TUSZE (B24–B31): trzy soczewki, każda z jedną farbą
const inkShot = (seed, weapon, inks, types, wave = 12) => ({
  seed, pre: 2.2, V: 13,
  setup(g) {
    arm(g, [[weapon, 5, inks]]);
    g.stats.inkPower = 1.2;
    endless(g, wave); g.spawnTimer = 99;
    ring(g, types, 60, 2.5, 8, { wave });
  },
  events: [[-1, g => ring(g, types, 40, 4, 9, { wave })], [1, g => ring(g, types, 40, 4, 9, { wave })], [2.5, g => ring(g, types, 40, 4, 9, { wave })]],
  move: g => kite(g, { orbit: .4 }),
  cam: follow(0, .2),
  after(g) { g.player.hp = g.stats.maxHp; },
});
export const INK_SHOTS = {
  c: inkShot(201, 'rotograf', 'CC', ['kleks', 'kleks', 'walec', 'dzielnik'], 18),
  m: inkShot(202, 'rozpylacz', 'MM', ['kleks', 'kleks', 'dzielnik']),
  y: inkShot(203, 'rapidograf', 'YY', ['kleks', 'smuga', 'dzielnik']),
};

// ULT na B31: C + M + Y = K
export const ULT = {
  seed: 301, pre: 1.6, V: lt => 21 + lt * 4,
  setup(g) {
    g.settings.numbers = false;
    arm(g, [['rotograf', 4, 'C'], ['rozpylacz', 4, 'M'], ['rapidograf', 4, 'Y'], ['walki', 3, 'CM']]);
    endless(g, 12); g.spawnTimer = 99;
    ring(g, ['kleks', 'smuga', 'walec', 'dzielnik', 'plujka'], 90, 3, 12, { wave: 12 });
  },
  events: [[-.5, g => ring(g, ['kleks', 'smuga', 'walec'], 60, 4, 11, { wave: 12 })], [.03, g => { g.ult.charge = 999; g.input.edges.add('ult'); }]],
  move: () => ({ x: 0, z: 0 }),
  cam: follow(0, .3),
  after(g) { g.player.hp = g.stats.maxHp; },
};

// ---------------------------------------------------------------- BOSSOWIE (B32–B40)
const bossShot = (seed, wave, weapons, { pre = 5, V = 25, extra = [] } = {}) => ({
  seed, pre, V,
  setup(g) {
    arm(g, weapons);
    g.stats.maxHp = g.player.hp = 900;
    boss(g, wave);
    g.spawnTimer = 99;
    g.player.z = 6;
    ring(g, ['kleks', 'smuga', ...extra], 26, 5, 11, { wave });
  },
  move: g => kite(g, { orbit: .6, dashRate: .004 }),
  // kadr między graczem a bossem
  // kadr na bossa (z lekkim przesunięciem ku graczowi); boss w górnej połowie, bo dół zajmuje pas z nazwą
  cam: g => g.boss ? { x: g.boss.x * .72 + g.player.x * .28, z: g.boss.z * .72 + g.player.z * .28 + 3.2 } : { x: g.player.x, z: g.player.z + 3.2 },
  after(g) {
    g.player.hp = g.stats.maxHp;
    if (g.boss) g.boss.hp = Math.max(g.boss.hp, g.boss.maxHp * .45);
  },
});
export const BOSS_SHOTS = [
  bossShot(401, 5, [['rapidograf', 4, 'Y'], ['walki', 3, 'C']], { pre: 5.4 }),
  bossShot(402, 10, [['rozpylacz', 4, 'M'], ['dron', 3, 'Y']], { pre: 6.2 }),
  bossShot(403, 15, [['rotograf', 4, 'C'], ['tuba', 3, 'MY']], { pre: 6.8 }),
  bossShot(404, 20, [['promien', 4, 'CM'], ['walki', 4, 'Y']], { pre: 7.5, extra: ['kopiarka'] }),
  bossShot(405, 25, [['gilotyna', 5, 'Y'], ['tuba', 4, 'MY'], ['walki', 4, 'C'], ['dron', 4, 'M']], { pre: 4.2, V: lt => 24 + lt * .5 }),
];

// ---------------------------------------------------------------- TŁO KART, RANKINGU I FINAŁU
export const CALM = {
  seed: 501, pre: 2.5, V: 24,
  setup(g) {
    arm(g, [['rapidograf', 5, 'CY'], ['walki', 4, 'M'], ['dron', 4, 'Y'], ['aerograf', 4, 'CM']]);
    endless(g, 10); g.spawnTimer = 99;
    ring(g, ['kleks', 'smuga', 'walec', 'plujka'], 70, 4, 13, { wave: 10 });
  },
  events: [[1, g => ring(g, ['kleks', 'smuga', 'walec'], 60, 6, 13, { wave: 10 })], [3, g => ring(g, ['kleks', 'smuga', 'widmo'], 60, 6, 13, { wave: 10 })],
    [5, g => ring(g, ['kleks', 'smuga', 'walec'], 60, 6, 13, { wave: 10 })], [7, g => ring(g, ['kleks', 'smuga', 'widmo'], 60, 6, 13, { wave: 10 })]],
  move: g => kite(g, { cx: 0, cz: 4, orbit: 1.4, dashRate: .004 }),
  cam: inside(24),
  after(g) { g.player.hp = g.stats.maxHp; },
};
export const FINALE = {
  ...CALM, seed: 601, pre: 3,
  V: lt => keys(lt, [[0, 14], [bt(2), 26, eInOutQuint], [bt(10), 30]]),
  cam: inside(30),
  setup(g) {
    arm(g, [['gilotyna', 5, 'Y'], ['tuba', 5, 'MY'], ['walki', 5, 'C'], ['dron', 5, 'CM']]);
    g.stats.area = 1.3;
    endless(g, 18); g.spawnTimer = 99;
    ring(g, ['kleks', 'smuga', 'walec', 'plujka', 'zszywacz', 'kopiarka'], 110, 4, 15, { wave: 18 });
  },
  events: [[bt(1), g => ring(g, ['kleks', 'smuga', 'walec', 'widmo'], 80, 7, 15, { wave: 18 })], [bt(4), g => ring(g, ['kleks', 'smuga', 'walec', 'gabka'], 80, 7, 15, { wave: 18 })],
    [bt(8), g => ring(g, ['kleks', 'smuga', 'walec'], 80, 7, 15, { wave: 18 })], [bt(12), g => ring(g, ['kleks', 'smuga', 'walec'], 80, 7, 15, { wave: 18 })]],
};
