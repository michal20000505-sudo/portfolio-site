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
    stempel: {
        name: 'Stempel', kind: 'nova', icon: 'stamp', price: 40,
        dmg: 34, rate: .55, radius: 3.2, knock: 3,
        l3: { radius: .25 }, l3text: '+25% promienia',
        evo: 'Pieczęć', evoText: 'Podwójne uderzenie i płonący odcisk na arkuszu.',
        desc: 'Co chwilę uderza w arkusz wokół Ciebie i odpycha tłum.',
    },
    linijka: {
        name: 'Linijka', kind: 'boomerang', icon: 'ruler', price: 40,
        dmg: 20, rate: 1.1, count: 1, speed: 17, range: 9, size: .32, spread: .35,
        l3: { count: 1 }, l3text: '+1 linijka',
        evo: 'Ekierka', evoText: 'Większe linijki, które wracają dwa razy szybciej.',
        desc: 'Leci, tnie wszystko po drodze i wraca do ręki.',
    },
    aerograf: {
        name: 'Aerograf', kind: 'cone', icon: 'airbrush', price: 44,
        dmg: 34, range: 5, angle: .5, // dmg = obrażenia na sekundę
        l3: { range: 1.5 }, l3text: '+1,5 zasięgu',
        evo: 'Kompresor', evoText: 'Szerszy strumień i podwójna szansa na efekty tuszu.',
        desc: 'Strumień farby z bliska. Tusze działają w nim najmocniej.',
    },
    pinezki: {
        name: 'Pinezki', kind: 'mine', icon: 'pin', price: 38,
        dmg: 42, rate: .9, count: 1, radius: 2.1, max: 8,
        l3: { count: 1 }, l3text: '+1 pinezka naraz',
        evo: 'Pole minowe', evoText: 'Wybuch rozrzuca 4 mniejsze pinezki.',
        desc: 'Zostawiasz za sobą pułapki, które wybuchają pod wrogami.',
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
        if (d.l3.radius) s.radius = d.radius * (1 + d.l3.radius);
    }
    if (s.evo) {
        if (id === 'rotograf') { s.pierce = (s.pierce || 0) + 2; s.rate *= 1.25; }
        if (id === 'walki') { s.count += 2; s.radius *= 1.25; s.dmg *= 1.2; }
        if (id === 'dron') { s.count += 2; s.rate *= 1.2; }
        if (id === 'gilotyna') s.count = 3;
        if (id === 'linijka') { s.size *= 1.4; s.speed *= 1.35; s.dmg *= 1.2; }
        if (id === 'aerograf') s.angle *= 1.5;
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
// rarity: 0 zwykła, 1 rzadka, 2 epicka. max: ile razy można wziąć (sklep liczy się do tego samego limitu).
// Każda karta statystyk ma limit: bez niego obrażenia i szybkostrzelność rosły bez końca i późne fale
// robiły się łatwiejsze od wczesnych. filler: karty na zapchanie puli, gdy limity się wyczerpią (bez sklepu).
// apply(g) dostaje obiekt gry; dla kart broni/tuszu logika jest w game.js.
export const RARITY = [
    { name: 'Zwykła', color: '#e8e8e8' },
    { name: 'Rzadka', color: '#00ffff' },
    { name: 'Epicka', color: '#ff00ff' },
];

export const CARDS = [
    { id: 'dmg', name: 'Ostre pióro', icon: 'dmg', rarity: 0, desc: '+10% obrażeń wszystkich broni.', max: 8, apply: s => { s.dmg += .1; } },
    { id: 'rate', name: 'Szybki druk', icon: 'rate', rarity: 0, desc: '+8% szybkostrzelności.', max: 6, apply: s => { s.rate += .08; } },
    { id: 'hp', name: 'Gruby karton', icon: 'heart', rarity: 0, desc: '+15 maks. zdrowia i leczenie o 15.', max: 8, apply: (s, g) => { s.maxHp += 15; g.heal(15); } },
    { id: 'speed', name: 'Lekki papier', icon: 'boot', rarity: 0, desc: '+7% szybkości ruchu.', max: 5, apply: s => { s.speed += .07; } },
    { id: 'magnet', name: 'Chłonny papier', icon: 'magnet', rarity: 0, desc: '+35% zasięgu zbierania kropli.', max: 4, apply: s => { s.magnet *= 1.35; } },
    { id: 'crit', name: 'Precyzja', icon: 'crit', rarity: 0, desc: '+5% szansy na trafienie krytyczne.', max: 6, apply: s => { s.crit += .05; } },
    { id: 'regen', name: 'Schnięcie', icon: 'regen', rarity: 0, desc: '+0,4 zdrowia na sekundę.', max: 5, apply: s => { s.regen += .4; } },
    { id: 'armor', name: 'Laminat', icon: 'armor', rarity: 0, desc: '+1,5 pancerza (mniej obrażeń od każdego trafienia).', max: 5, apply: s => { s.armor += 1.5; } },
    { id: 'area', name: 'Rozlew', icon: 'area', rarity: 0, desc: '+12% obszaru wybuchów, chmur, wirów i wałków.', max: 5, apply: s => { s.area += .12; } },
    { id: 'velocity', name: 'Ciśnienie', icon: 'velocity', rarity: 0, desc: '+15% prędkości pocisków i +10% zasięgu.', max: 3, apply: s => { s.projSpeed += .15; s.range += .1; } },
    { id: 'multi', name: 'Druga głowica', icon: 'multi', rarity: 1, desc: '+1 pocisk dla broni strzelających.', max: 3, apply: s => { s.projectiles += 1; } },
    { id: 'pierce', name: 'Przebitka', icon: 'pierce', rarity: 1, desc: 'Pociski przebijają +1 wroga.', max: 3, apply: s => { s.pierce += 1; } },
    { id: 'ricochet', name: 'Rykoszet', icon: 'ricochet', rarity: 1, desc: 'Pociski odbijają się do kolejnego wroga.', max: 2, apply: s => { s.ricochet += 1; } },
    { id: 'critdmg', name: 'Pełne krycie', icon: 'critdmg', rarity: 1, desc: '+30% obrażeń krytycznych.', max: 4, apply: s => { s.critMult += .3; } },
    { id: 'lifesteal', name: 'Wsiąkanie', icon: 'drop', rarity: 1, desc: '1,5% zadanych obrażeń wraca jako zdrowie (leczenie z kart maks. 5/s).', max: 3, apply: s => { s.lifesteal += .015; } },
    { id: 'dash', name: 'Poślizg', icon: 'dash', rarity: 1, desc: '-20% czasu odnowienia dasha.', max: 3, apply: s => { s.dashCd *= .8; } },
    { id: 'luck', name: 'Dobry nakład', icon: 'luck', rarity: 1, desc: 'Lepsze karty i +15% farby z kropli.', max: 3, apply: s => { s.luck += 1; s.income += .15; } },
    { id: 'double', name: 'Podwójny nadruk', icon: 'double', rarity: 2, desc: '15% szansy, że strzał wyleci podwójnie.', max: 2, apply: s => { s.doubleShot += .15; } },
    { id: 'trail', name: 'Smuga ognia', icon: 'trail', rarity: 2, desc: 'Dash zostawia płonący tusz.', max: 1, apply: s => { s.trail = true; } },
    { id: 'execute', name: 'Cięcie na spad', icon: 'execute', rarity: 2, desc: 'Trafienie dobija wrogów poniżej 10% zdrowia (bez bossów).', max: 1, apply: s => { s.execute = .1; } },
    { id: 'splash', name: 'Rozprysk', icon: 'splash', rarity: 2, desc: 'Zabici wrogowie pryskają farbą i ranią sąsiadów.', max: 1, apply: s => { s.splash = true; } },
    { id: 'bold', name: 'Pogrubienie', icon: 'bold', rarity: 2, desc: '+25% obrażeń i większe pociski.', max: 1, apply: s => { s.dmg += .25; s.size += .25; } },
    { id: 'thorns', name: 'Kolce', icon: 'thorns', rarity: 0, desc: 'Wróg, który Cię dotknie, dostaje 30 obrażeń (rośnie z falą).', max: 3, apply: s => { s.thorns += 30; } },
    { id: 'killheal', name: 'Karmienie farbą', icon: 'feed', rarity: 0, desc: 'Każde zabójstwo leczy 1 zdrowia (leczenie z kart maks. 5/s).', max: 2, apply: s => { s.killHeal += 1; } },
    { id: 'combo', name: 'Seria', icon: 'combo', rarity: 0, desc: '+1% obrażeń za każde 10 combo (maks. +30%) i dłuższe combo.', max: 1, apply: s => { s.comboDmg = true; } },
    { id: 'shield', name: 'Folia ochronna', icon: 'shield', rarity: 1, desc: 'Folia blokuje jedno trafienie i odnawia się co 14 s (kolejna karta: szybciej).', max: 3, apply: s => { s.shieldCd = s.shieldCd ? s.shieldCd * .7 : 14; } },
    { id: 'bounty', name: 'Nakład premium', icon: 'bounty', rarity: 1, desc: 'Elity i bossowie zostawiają podwójne krople, +10% farby.', max: 1, apply: s => { s.bounty = true; s.income += .1; } },
    { id: 'dashnova', name: 'Uderzenie dasha', icon: 'nova', rarity: 1, desc: 'Koniec dasha wywołuje falę uderzeniową.', max: 1, apply: s => { s.dashNova = true; } },
    { id: 'critbolt', name: 'Iskra', icon: 'bolt', rarity: 1, desc: 'Trafienia krytyczne razią piorunem 2 pobliskich wrogów.', max: 1, apply: s => { s.critBolt = true; } },
    { id: 'slowaura', name: 'Gęsta farba', icon: 'slow', rarity: 1, desc: 'Wrogowie w promieniu 3,5 wokół Ciebie są wolniejsi o 25%.', max: 1, apply: s => { s.slowAura = true; } },
    { id: 'adrenaline', name: 'Ostatnia kopia', icon: 'adrenaline', rarity: 1, desc: 'Poniżej 40% zdrowia: +30% obrażeń i szybkostrzelności.', max: 1, apply: s => { s.adrenaline = true; } },
    { id: 'inkpower', name: 'Pigment', icon: 'pigment', rarity: 1, desc: 'Efekty tuszów są o 30% silniejsze i częstsze.', max: 2, apply: s => { s.inkPower += .3; } },
    { id: 'revive', name: 'Drugi nakład', icon: 'revive', rarity: 2, desc: 'Raz w przebiegu wracasz do gry z połową zdrowia.', max: 1, apply: s => { s.revive = 1; } },
    { id: 'dash2', name: 'Podwójny dash', icon: 'dash2', rarity: 2, desc: 'Dwa dashe pod rząd, zanim trzeba czekać.', max: 1, apply: s => { s.dashCharges = 2; } },
    { id: 'paint', name: 'Zapas farby', icon: 'ink', rarity: 0, filler: true, desc: 'Farba do sklepu: 12 ml + 4 ml za każdą falę.', apply: (s, g) => { g.money += 12 + g.wave * 4; } },
    { id: 'patch', name: 'Łatka', icon: 'medkit', rarity: 0, filler: true, desc: 'Leczy 35 zdrowia.', apply: (s, g) => { g.heal(35); } },
];
// Leczenie z kart (Wsiąkanie + Karmienie farbą) razem, na sekundę.
export const HEAL_CAP = 5;

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
    zszywacz:   { name: 'Zszywacz',   hp: 42,  speed: 3.2, r: .55, dmg: 16, xp: 2, score: 24, from: 5,  weight: 2.6, color: '#2d2f38' },
    igla:       { name: 'Igła',       hp: 30,  speed: 2.7, r: .42, dmg: 18, xp: 3, score: 30, from: 7,  weight: 2,  color: '#00607f', ranged: true },
    kopiarka:   { name: 'Kopiarka',   hp: 130, speed: 1.6, r: .85, dmg: 14, xp: 5, score: 45, from: 9,  weight: 1.4, color: '#50545c', heavy: true },
    widmo:      { name: 'Widmo',      hp: 44,  speed: 4.3, r: .5,  dmg: 15, xp: 3, score: 34, from: 14, weight: 1.8, color: '#8e8e9a' },
    gabka:      { name: 'Gąbka',      hp: 160, speed: 2.0, r: .8,  dmg: 12, xp: 5, score: 50, from: 16, weight: 1.2, color: '#3a6b2f' },
    dziurkacz:  { name: 'Dziurkacz',  hp: 70,  speed: 2.4, r: .6,  dmg: 12, xp: 3, score: 36, from: 11, weight: 2,   color: '#4b2a6b', ranged: true },
    toner:      { name: 'Toner',      hp: 55,  speed: 3.4, r: .55, dmg: 11, xp: 3, score: 32, from: 13, weight: 2,   color: '#0e0e11' },
    korektor:   { name: 'Korektor',   hp: 90,  speed: 2.3, r: .6,  dmg: 10, xp: 4, score: 45, from: 18, weight: 1.3, color: '#d8d5cc' },
    ryza:       { name: 'Ryza',       hp: 300, speed: 1.5, r: 1.0, dmg: 24, xp: 8, score: 80, from: 22, weight: 1.2, color: '#a39c86', heavy: true },
    kartka:     { name: 'Kartka',     hp: 18,  speed: 5.6, r: .38, dmg: 9,  xp: 1, score: 6,  from: 99, weight: 0,   color: '#7d7866' },
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
    { id: 'ksero', name: 'KSERO', title: 'Kopiuje wszystko', hp: 3000, r: 1.6, speed: 1.9, dmg: 26, score: 3800, xp: 85, color: '#50545c' },
    { id: 'krajarka', name: 'KRAJARKA', title: 'Cięcie na wymiar', hp: 3400, r: 1.5, speed: 2.6, dmg: 30, score: 4600, xp: 100, color: '#2a2c33' },
    { id: 'laminarka', name: 'LAMINARKA', title: 'Gorąca folia', hp: 3900, r: 1.6, speed: 2.0, dmg: 32, score: 5500, xp: 115, color: '#2e3036' },
    { id: 'rotacja', name: 'ROTACJA', title: 'Nakład bez końca', hp: 4600, r: 1.9, speed: 1.7, dmg: 34, score: 6500, xp: 130, color: '#23262d' },
];

// Mnożniki trudności na fali w. Od 12. fali HP rośnie dodatkowo o 3% na falę, a obrażenia mają
// składnik kwadratowy: karty mają limity, więc późne fale mają być coraz trudniejsze, nie łatwiejsze.
export const scaling = w => ({
    hp: (1 + .22 * (w - 1) + .016 * (w - 1) ** 2) * (1 + Math.max(0, w - 12) * .03),
    dmg: 1 + .09 * (w - 1) + .002 * (w - 1) ** 2,
    speed: 1 + Math.min(.5, .02 * (w - 1)),
});
export const waveQuota = w => Math.round(26 + w * 9 + w ** 1.5);
export const waveDuration = w => Math.min(38, 15 + w * 1.1);
export const aliveCap = (w, low) => Math.min(low ? 160 : 250, 70 + w * 7);
export const eliteChance = w => w >= 5 ? Math.min(.3, .03 + w * .007) : 0;

// Poziomy gracza: im dalej, tym wolniej (w późnych falach wrogów jest dużo, więc kropli też).
export const xpForLevel = l => Math.round(6 + l * 5 + l ** 1.7);

// Ceny w sklepie (farba, ml). Farby z fali przybywa szybciej niż fal, więc ceny rosną z falą mocniej
// niż na starcie: na początku drożej o kilka ml, od ok. 10. fali wyraźnie drożej.
export const PRICES = {
    weapon: (id, w) => WEAPONS[id].price + w * 9,
    upgrade: (level, w) => 18 * level + w * 6,
    ink: w => 24 + w * 7,
    heal: w => 14 + w * 3,
    maxhp: w => 30 + w * 7,
    reroll: n => 4 + n * 4,
    stat: w => 22 + w * 7,
};
export const MAXHP_BUYS = 6;   // ile razy można kupić „Gruby karton+” w sklepie

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
    stamp:    ['...###...', '...###...', '....#....', '....#....', '.#######.', '.#######.', '.+++++++.', '.........', '+.+.+.+.+'],
    ruler:    ['........#', '.......##', '......#+#', '.....#+##', '....#+#..', '...#+##..', '..#+#....', '.#+##....', '###......'],
    airbrush: ['.........', '..##.....', '.####....', '#######++', '.####..+.', '..##...++', '...#.....', '..###....', '.........'],
    pin:      ['.........', '..#####..', '..#####..', '...###...', '.#######.', '....#....', '....#....', '....+....', '.........'],
    thorns:   ['#...#...#', '.#.###.#.', '..#####..', '.#######.', '###+#+###', '.#######.', '..#####..', '.#.###.#.', '#...#...#'],
    feed:     ['.##...##.', '####.####', '#########', '.#######.', '..#####..', '...###...', '....#....', '..+...+..', '.+++.+++.'],
    combo:    ['.........', '#.#.#.#.#', '#.#.#.#.#', '#.#.#.#.#', '#.#.#.#.#', '#.#.#.#.+', '#.#.#.#++', '#.#.#.+++', '.........'],
    shield:   ['.#######.', '#+++++++#', '#+#####+#', '#+#...#+#', '#+#...#+#', '.#+#.#+#.', '..#+#+#..', '...#+#...', '....#....'],
    bounty:   ['...###...', '..#+++#..', '.#+###+#.', '.#+#....', '.#+###+#.', '....#+#..', '.#+###+#.', '..#+++#..', '...###...'],
    nova:     ['+...+...+', '.+..#..+.', '..+###+..', '..#####..', '+#######+', '..#####..', '..+###+..', '.+..#..+.', '+...+...+'],
    bolt:     ['.....##..', '....##...', '...##....', '..######.', '....##...', '...##....', '..##.....', '.##......', '.#.......'],
    slow:     ['.++++++..', '+......+.', '+.####.+.', '+.#..#.+.', '+.####.+.', '+......+.', '.++++++..', '.........', '.........'],
    adrenaline: ['.........', '.........', '#...#....', '.#.#.#...', '..#...#.#', '.......#.', '.........', '..+++++..', '.........'],
    pigment:  ['.........', '.##.##.##', '.##.##.##', '.........', '.++.##.++', '.++.##.++', '.........', '.##.++.##', '.##.++.##'],
    revive:   ['...###...', '..#...#..', '.#.....#.', '.#..+..#.', '.#.+++.#.', '.#..+..#.', '..#...#..', '...###...', '.........'],
    dash2:    ['.........', '..###.###', '+####+###', '.#####+##', '+####+###', '..###.###', '.........', '.........', '.........'],
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
