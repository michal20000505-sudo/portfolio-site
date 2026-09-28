/* ==========================================================================
   OVERPRINT: dane gry (bronie, tusze, karty, przeciwnicy, bossowie, ikony)
   Wszystko, co da się zbalansować bez dotykania logiki, siedzi tutaj.
   ========================================================================== */

export const ARENA = 30;           // połowa boku arkusza (świat: -30…30 w X i Z)
export const MAX_WEAPONS = 3;

// Czcionki drukarskie na arkuszu: przeszkody (środek x/z, połowa boku, litera).
export const OBSTACLES = [
    { x: -13, z: -11, h: 1.2, letter: 'O' }, { x: 13, z: -11, h: 1.2, letter: 'V' },
    { x: -13, z: 11, h: 1.2, letter: 'E' }, { x: 13, z: 11, h: 1.2, letter: 'R' },
    { x: 0, z: -20, h: 1.2, letter: 'P' }, { x: 0, z: 20, h: 1.2, letter: 'I' },
    { x: -21, z: 0, h: 1.2, letter: 'N' }, { x: 21, z: 0, h: 1.2, letter: 'T' },
].map(o => ({ ...o, hw: 1.2, hd: 1.2 }));
export const INK_SLOTS = 2;

// --- kolory farb (druk, nie ekran) -------------------------------------------
export const INK = {
    C: '#00aeef', M: '#ec008c', Y: '#ffd200', K: '#161616',
    blue: '#3a3fc4', red: '#ef3a2d', green: '#17b35a', none: '#1b1b1f',
};

// Mieszanie tuszów w jednej broni: posortowana para → efekt.
export const MIXES = {
    '':   { id: 'none',  name: 'Bez tuszu',         color: INK.none,  desc: 'Czysty czarny druk.' },
    C:    { id: 'chill', name: 'Cyan: chłód',       color: INK.C,     desc: 'Spowalnia; 4 ładunki zamrażają wroga.', power: 1 },
    CC:   { id: 'chill', name: 'Cyan ×2: mróz',     color: INK.C,     desc: 'Mocne spowolnienie, zamrożenie po 2 ładunkach.', power: 2 },
    M:    { id: 'burn',  name: 'Magenta: ogień',    color: INK.M,     desc: 'Podpala: obrażenia rozłożone w czasie.', power: 1 },
    MM:   { id: 'burn',  name: 'Magenta ×2: żar',   color: INK.M,     desc: 'Silniejsze i dłuższe podpalenie.', power: 2 },
    Y:    { id: 'shock', name: 'Yellow: wyładowanie', color: INK.Y,   desc: 'Szansa na piorun przeskakujący na kolejnych wrogów.', power: 1 },
    YY:   { id: 'shock', name: 'Yellow ×2: burza',  color: INK.Y,     desc: 'Częstsze pioruny, więcej przeskoków.', power: 2 },
    CM:   { id: 'void',  name: 'Blue: próżnia',     color: INK.blue,  desc: 'Trafienia otwierają wiry, które wciągają i mielą wrogów.', power: 1 },
    MY:   { id: 'blast', name: 'Red: wybuch',       color: INK.red,   desc: 'Zabici wrogowie wybuchają, trafienia czasem też.', power: 1 },
    CY:   { id: 'toxin', name: 'Green: toksyna',    color: INK.green, desc: 'Trujące chmury, które przechodzą na kolejnych wrogów.', power: 1 },
};
export const mixKey = inks => [...inks].sort().join('');
export const mixOf = inks => MIXES[mixKey(inks)] || MIXES[''];

// --- bronie ---------------------------------------------------------------------
// dmg: obrażenia, rate: strzały/s, count: pociski, spread: rozrzut (rad),
// speed: prędkość pocisku, range: zasięg. l3: bonus na 3. poziomie, evo: poziom 5.
export const WEAPONS = {
    rapidograf: {
        name: 'Rapidograf', kind: 'bullet', icon: 'pen', price: 0,
        dmg: 14, rate: 3.2, count: 1, spread: .05, speed: 25, range: 17, size: .17, pierce: 0,
        l3: { count: 1 }, l3text: '+1 pocisk',
        evo: 'Kreślarz', evoText: 'Co 4. strzał to wachlarz 7 pocisków.',
        desc: 'Precyzyjne pióro. Równe tempo, dobry zasięg.',
    },
    rozpylacz: {
        name: 'Rozpylacz', kind: 'bullet', icon: 'spray', price: 34,
        dmg: 8, rate: 1.2, count: 6, spread: .52, speed: 21, range: 8.5, size: .15, pierce: 0, knock: 2.4,
        l3: { count: 2 }, l3text: '+2 śruciny',
        evo: 'Flak', evoText: 'Śruciny wybuchają przy trafieniu.',
        desc: 'Śrutówka. Z bliska rozrywa grupy wrogów.',
    },
    rotograf: {
        name: 'Rotograf', kind: 'bullet', icon: 'smg', price: 38,
        dmg: 5.5, rate: 10, count: 1, spread: .14, speed: 27, range: 14, size: .12, pierce: 0,
        l3: { pierce: 1 }, l3text: '+1 przebicie',
        evo: 'Offset', evoText: '+2 przebicia i +25% szybkostrzelności.',
        desc: 'Maszyna rotacyjna. Ściana pocisków.',
    },
    gilotyna: {
        name: 'Gilotyna', kind: 'rail', icon: 'rail', price: 46,
        dmg: 58, rate: .75, count: 1, spread: 0, range: 26, width: .5,
        l3: { dmg: .25 }, l3text: '+25% obrażeń',
        evo: 'Trójcięcie', evoText: 'Tnie trzema promieniami naraz.',
        desc: 'Natychmiastowe cięcie przez całą linię wrogów.',
    },
    tuba: {
        name: 'Tuba', kind: 'rocket', icon: 'rocket', price: 44,
        dmg: 30, rate: .9, count: 1, spread: .2, speed: 13, range: 18, size: .26, radius: 2.4,
        l3: { count: 1 }, l3text: '+1 rakieta',
        evo: 'Kaseta', evoText: 'Wybuch rozrzuca 4 mniejsze bomby.',
        desc: 'Rakiety z farbą. Obszarowe wybuchy.',
    },
    walki: {
        name: 'Wałki', kind: 'orbit', icon: 'roller', price: 36,
        dmg: 13, count: 2, radius: 2.3, spin: 3.1, tick: .45,
        l3: { count: 1 }, l3text: '+1 wałek',
        evo: 'Walcarka', evoText: '+2 wałki, większy promień i obrażenia.',
        desc: 'Wałki drukarskie krążą wokół Ciebie.',
    },
    dron: {
        name: 'Dron', kind: 'drone', icon: 'drone', price: 42,
        dmg: 9, rate: 2.4, count: 1, speed: 22, range: 12, size: .13,
        l3: { count: 1 }, l3text: '+1 dron',
        evo: 'Rój', evoText: '+2 drony i szybszy ogień.',
        desc: 'Niezależny pomocnik. Sam wybiera cele.',
    },
    promien: {
        name: 'Promień', kind: 'laser', icon: 'laser', price: 48,
        dmg: 40, range: 11, width: .34, // dmg = obrażenia na sekundę
        l3: { range: 2.5 }, l3text: '+2,5 zasięgu',
        evo: 'Pryzmat', evoText: 'Promień rozszczepia się na trzy.',
        desc: 'Ciągła wiązka. Topi wszystko na linii.',
    },
};

// Statystyki broni na danym poziomie (1–5).
export function weaponStats(id, level) {
    const d = WEAPONS[id];
    const s = { ...d, level, evo: level >= 5 };
    s.dmg = d.dmg * (1 + .25 * (level - 1));
    if (d.rate) s.rate = d.rate * (1 + .1 * (level - 1));
    if (level >= 3 && d.l3) {
        if (d.l3.count) s.count = d.count + d.l3.count;
        if (d.l3.pierce) s.pierce = (d.pierce || 0) + d.l3.pierce;
        if (d.l3.dmg) s.dmg *= 1 + d.l3.dmg;
        if (d.l3.range) s.range = d.range + d.l3.range;
    }
    if (s.evo) {
        if (id === 'rotograf') { s.pierce = (s.pierce || 0) + 2; s.rate *= 1.25; }
        if (id === 'walki') { s.count += 2; s.radius *= 1.25; s.dmg *= 1.2; }
        if (id === 'dron') { s.count += 2; s.rate *= 1.2; }
        if (id === 'gilotyna') s.count = 3;
    }
    return s;
}
export function levelText(id, nextLevel) {
    const d = WEAPONS[id];
    if (nextLevel === 3) return d.l3text + ', +25% obrażeń';
    if (nextLevel === 5) return 'EWOLUCJA: ' + d.evo + '. ' + d.evoText;
    return '+25% obrażeń, +10% szybkostrzelności';
}

// --- karty poziomu --------------------------------------------------------------
// rarity: 0 zwykła, 1 rzadka, 2 epicka. max: ile razy można wziąć.
// apply(g) dostaje obiekt gry; dla kart broni/tuszu logika jest w game.js.
export const RARITY = [
    { name: 'Zwykła', color: '#e8e8e8' },
    { name: 'Rzadka', color: '#00ffff' },
    { name: 'Epicka', color: '#ff00ff' },
];

export const CARDS = [
    { id: 'dmg', name: 'Ostre pióro', icon: 'dmg', rarity: 0, desc: '+12% obrażeń wszystkich broni.', apply: s => { s.dmg += .12; } },
    { id: 'rate', name: 'Szybki druk', icon: 'rate', rarity: 0, desc: '+10% szybkostrzelności.', apply: s => { s.rate += .1; } },
    { id: 'hp', name: 'Gruby karton', icon: 'heart', rarity: 0, desc: '+20 maks. zdrowia i leczenie o 20.', apply: (s, g) => { s.maxHp += 20; g.heal(20); } },
    { id: 'speed', name: 'Lekki papier', icon: 'boot', rarity: 0, desc: '+8% szybkości ruchu.', max: 6, apply: s => { s.speed += .08; } },
    { id: 'magnet', name: 'Chłonny papier', icon: 'magnet', rarity: 0, desc: '+35% zasięgu zbierania kropli.', max: 5, apply: s => { s.magnet *= 1.35; } },
    { id: 'crit', name: 'Precyzja', icon: 'crit', rarity: 0, desc: '+6% szansy na trafienie krytyczne.', max: 8, apply: s => { s.crit += .06; } },
    { id: 'regen', name: 'Schnięcie', icon: 'regen', rarity: 0, desc: '+0,5 zdrowia na sekundę.', max: 6, apply: s => { s.regen += .5; } },
    { id: 'armor', name: 'Laminat', icon: 'armor', rarity: 0, desc: '+2 pancerza (mniej obrażeń od każdego trafienia).', max: 6, apply: s => { s.armor += 2; } },
    { id: 'area', name: 'Rozlew', icon: 'area', rarity: 0, desc: '+15% obszaru wybuchów, chmur, wirów i wałków.', max: 6, apply: s => { s.area += .15; } },
    { id: 'velocity', name: 'Ciśnienie', icon: 'velocity', rarity: 0, desc: '+15% prędkości pocisków i +10% zasięgu.', max: 4, apply: s => { s.projSpeed += .15; s.range += .1; } },
    { id: 'multi', name: 'Druga głowica', icon: 'multi', rarity: 1, desc: '+1 pocisk dla broni strzelających.', max: 4, apply: s => { s.projectiles += 1; } },
    { id: 'pierce', name: 'Przebitka', icon: 'pierce', rarity: 1, desc: 'Pociski przebijają +1 wroga.', max: 4, apply: s => { s.pierce += 1; } },
    { id: 'ricochet', name: 'Rykoszet', icon: 'ricochet', rarity: 1, desc: 'Pociski odbijają się do kolejnego wroga.', max: 3, apply: s => { s.ricochet += 1; } },
    { id: 'critdmg', name: 'Pełne krycie', icon: 'critdmg', rarity: 1, desc: '+40% obrażeń krytycznych.', max: 5, apply: s => { s.critMult += .4; } },
    { id: 'lifesteal', name: 'Wsiąkanie', icon: 'drop', rarity: 1, desc: '2% zadanych obrażeń wraca jako zdrowie (maks. 6/s).', max: 4, apply: s => { s.lifesteal += .02; } },
    { id: 'dash', name: 'Poślizg', icon: 'dash', rarity: 1, desc: '-20% czasu odnowienia dasha.', max: 3, apply: s => { s.dashCd *= .8; } },
    { id: 'luck', name: 'Dobry nakład', icon: 'luck', rarity: 1, desc: 'Lepsze karty i +15% farby z kropli.', max: 4, apply: s => { s.luck += 1; s.income += .15; } },
    { id: 'double', name: 'Podwójny nadruk', icon: 'double', rarity: 2, desc: '20% szansy, że strzał wyleci podwójnie.', max: 3, apply: s => { s.doubleShot += .2; } },
    { id: 'trail', name: 'Smuga ognia', icon: 'trail', rarity: 2, desc: 'Dash zostawia płonący tusz.', max: 1, apply: s => { s.trail = true; } },
    { id: 'execute', name: 'Cięcie na spad', icon: 'execute', rarity: 2, desc: 'Trafienie dobija wrogów poniżej 12% zdrowia (bez bossów).', max: 1, apply: s => { s.execute = .12; } },
    { id: 'splash', name: 'Rozprysk', icon: 'splash', rarity: 2, desc: 'Zabici wrogowie pryskają farbą i ranią sąsiadów.', max: 1, apply: s => { s.splash = true; } },
    { id: 'bold', name: 'Pogrubienie', icon: 'bold', rarity: 2, desc: '+30% obrażeń i większe pociski.', max: 2, apply: s => { s.dmg += .3; s.size += .25; } },
];

// --- przeciwnicy -------------------------------------------------------------------
// from: fala, od której się pojawia; weight: udział w losowaniu.
export const ENEMIES = {
    kleks:      { name: 'Kleks',      hp: 22,  speed: 3.5, r: .5,  dmg: 10, xp: 1, score: 10, from: 1,  weight: 10, color: '#1c1c22' },
    kropla:     { name: 'Kropla',     hp: 10,  speed: 4.4, r: .33, dmg: 7,  xp: 1, score: 5,  from: 99, weight: 0,  color: '#2a2a33' },
    smuga:      { name: 'Smuga',      hp: 13,  speed: 6.3, r: .4,  dmg: 8,  xp: 1, score: 12, from: 3,  weight: 5,  color: '#141418' },
    plujka:     { name: 'Plujka',     hp: 32,  speed: 2.9, r: .5,  dmg: 10, xp: 2, score: 20, from: 4,  weight: 3,  color: '#7a0047', ranged: true },
    walec:      { name: 'Walec',      hp: 140, speed: 1.75, r: .95, dmg: 20, xp: 5, score: 50, from: 6, weight: 2,  color: '#3c4046', heavy: true },
    dzielnik:   { name: 'Dzielnik',   hp: 56,  speed: 3.0, r: .7,  dmg: 12, xp: 3, score: 30, from: 8,  weight: 3,  color: '#262630' },
    pecherz:    { name: 'Pęcherz',    hp: 26,  speed: 4.5, r: .55, dmg: 32, xp: 2, score: 25, from: 10, weight: 2.5, color: '#f2c200' },
    tarczownik: { name: 'Tarczownik', hp: 74,  speed: 2.7, r: .65, dmg: 12, xp: 3, score: 35, from: 12, weight: 2,  color: '#22262e' },
};

export const AFFIXES = [
    { id: 'fast', name: 'Szybki', color: '#ffd200' },
    { id: 'armored', name: 'Pancerny', color: '#00aeef' },
    { id: 'regen', name: 'Regenerujący', color: '#ec008c' },
];

export const BOSSES = [
    { id: 'rakla', name: 'RAKLA', title: 'Zgarniacz farby', hp: 1500, r: 1.5, speed: 2.1, dmg: 26, score: 1500, xp: 40, color: '#2b2b33' },
    { id: 'prasa', name: 'PRASA', title: 'Sto ton nacisku', hp: 2100, r: 1.7, speed: 1.8, dmg: 30, score: 2200, xp: 55, color: '#34383f' },
    { id: 'rozmaz', name: 'ROZMAZ', title: 'Żywa plama', hp: 2600, r: 1.4, speed: 2.4, dmg: 24, score: 3000, xp: 70, color: '#16161c' },
];

// Mnożniki trudności na fali w.
export const scaling = w => ({
    hp: 1 + .19 * (w - 1) + .011 * (w - 1) ** 2,
    dmg: 1 + .07 * (w - 1),
    speed: 1 + Math.min(.35, .015 * (w - 1)),
});
export const waveQuota = w => Math.round(22 + w * 8 + w ** 1.45);
export const waveDuration = w => Math.min(40, 16 + w * 1.2);
export const aliveCap = (w, low) => Math.min(low ? 150 : 230, 60 + w * 6);

// Poziomy gracza.
export const xpForLevel = l => Math.round(6 + l * 4.5 + l ** 1.55);

// Ceny w sklepie (farba, ml).
export const PRICES = {
    weapon: (id, w) => WEAPONS[id].price + w * 5,
    upgrade: (level, w) => 16 * level + w * 3,
    ink: w => 22 + w * 4,
    heal: w => 12 + w * 2,
    maxhp: w => 26 + w * 4,
    reroll: n => 3 + n * 3,
    stat: w => 20 + w * 4,
};

// --- ikony pikselowe (9×9): # kolor główny, + akcent, . puste ---------------------
export const ICONS = {
    pen:      ['....++...', '...+##...', '..+###...', '..###....', '.###.....', '.##......', '##.......', '#........', '.........'],
    spray:    ['.........', '..#.#.#..', '...#.#...', '#.#####..', '.######++', '#.#####..', '...#.#...', '..#.#.#..', '.........'],
    smg:      ['.........', '.........', '.#######+', '#########', '###.#....', '##..#....', '##.......', '.........', '.........'],
    rail:     ['.........', '.........', '+++++++++', '#########', '+++++++++', '.........', '.........', '.........', '.........'],
    rocket:   ['.........', '......#..', '.....###.', '#######++', '.....###.', '......#..', '.........', '.........', '.........'],
    roller:   ['.........', '..#####..', '.#+++++#.', '.#+###+#.', '.#+###+#.', '.#+++++#.', '..#####..', '....#....', '....#....'],
    drone:    ['.........', '#.......#', '.#.....#.', '..#####..', '..#+#+#..', '..#####..', '.#.....#.', '#.......#', '.........'],
    laser:    ['.........', '.........', '.........', '##+++++++', '###++++++', '##+++++++', '.........', '.........', '.........'],
    dmg:      ['.......##', '......##.', '.....##..', '#...##...', '.#.##....', '..##.....', '.#.#.....', '#...#....', '.........'],
    rate:     ['.........', '.#...#...', '.##..##..', '.###.###.', '.####+###', '.###.###.', '.##..##..', '.#...#...', '.........'],
    heart:    ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
    boot:     ['.........', '..###....', '..###....', '..###....', '..####...', '..######.', '..######+', '.........', '.........'],
    magnet:   ['.........', '.###.###.', '.#+#.#+#.', '.#.#.#.#.', '.#.#.#.#.', '.#.###.#.', '..#####..', '.........', '.........'],
    crit:     ['....#....', '....#....', '..#####..', '..#+++#..', '###+#+###', '..#+++#..', '..#####..', '....#....', '....#....'],
    regen:    ['....#....', '...###...', '..#####..', '..##+##..', '..#+++#..', '..##+##..', '...###...', '.........', '.........'],
    armor:    ['.........', '.#######.', '.#+++++#.', '.#+++++#.', '.#+++++#.', '..#+++#..', '...#+#...', '....#....', '.........'],
    area:     ['#.......#', '.#.....#.', '...+++...', '..+###+..', '..+###+..', '..+###+..', '...+++...', '.#.....#.', '#.......#'],
    velocity: ['.........', '.........', '+.+.###..', '.+.+####.', '+.+######', '.+.+####.', '+.+.###..', '.........', '.........'],
    multi:    ['.........', '.....##..', '..####+..', '.........', '.....##..', '..####+..', '.........', '.........', '.........'],
    pierce:   ['.........', '...#.....', '...#.....', '###+#####', '...#.....', '...#.....', '.........', '.........', '.........'],
    ricochet: ['#........', '.#.......', '..#......', '...#...#.', '....#.#..', '.....+...', '.........', '.........', '.........'],
    critdmg:  ['.#######.', '#+++++++#', '#+#####+#', '#+#...#+#', '#+#####+#', '#+++++++#', '.#######.', '.........', '.........'],
    drop:     ['....#....', '...###...', '..#####..', '.###+###.', '.##+++##.', '.###+###.', '..#####..', '.........', '.........'],
    dash:     ['.........', '.....###.', '+.+.####.', '.+.#####.', '+.+.####.', '.....###.', '.........', '.........', '.........'],
    luck:     ['.........', '.##...##.', '.###.###.', '..#####..', '...###...', '..#####..', '.###.###.', '.##...##.', '.........'],
    double:   ['.........', '.###.###.', '.#+#.#+#.', '.###.###.', '.........', '.###.###.', '.#+#.#+#.', '.###.###.', '.........'],
    trail:    ['.........', '.......##', '.....+###', '...+++##.', '.+++++...', '+++......', '++.......', '.........', '.........'],
    execute:  ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '....+....', '...#.#...', '..#...#..', '.#.....#.', '#.......#'],
    splash:   ['#...#...#', '.#.....#.', '...###...', '#.#####.#', '..##+##..', '#.#####.#', '...###...', '.#.....#.', '#...#...#'],
    bold:     ['.........', '.######..', '.##..##..', '.#####...', '.##..##..', '.##..##+.', '.######+.', '.........', '.........'],
    ink:      ['....#....', '...###...', '..#####..', '.#######.', '.#######.', '.##+####.', '..#####..', '...###...', '.........'],
    medkit:   ['.........', '.#######.', '.#..+..#.', '.#.+++.#.', '.#..+..#.', '.#######.', '.........', '.........', '.........'],
    reroll:   ['.........', '..####...', '.#....#..', '#......#.', '#...####.', '#....##..', '.#...#...', '..###....', '.........'],
};

export function iconURL(name, color = '#ffffff', accent = '#00ffff', px = 4) {
    const rows = ICONS[name] || ICONS.ink;
    const c = document.createElement('canvas');
    c.width = c.height = 9 * px;
    const x = c.getContext('2d');
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '.') return;
        x.fillStyle = ch === '+' ? accent : color;
        x.fillRect(i * px, j * px, px, px);
    }));
    return c.toDataURL();
}
