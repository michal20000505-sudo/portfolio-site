/* ==========================================================================
   OVERPRINT: symulacja
   Stany: menu (tło z kleksami) → play ⇄ levelup / shop / pause → dying → over.
   Gra nie wie nic o DOM; UI dostaje zdarzenia przez obiekt hooks.
   ========================================================================== */

import {
    ARENA, OBSTACLES, MAX_WEAPONS, INK_SLOTS, INK, WEAPONS, weaponStats, mixOf, CARDS, RARITY,
    ENEMIES, AFFIXES, BOSSES, scaling, waveQuota, waveDuration, aliveCap, xpForLevel, PRICES, levelText,
} from './data.js?v=20260928d';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.random() * arr.length | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CELL = 2, GN = Math.ceil(ARENA * 2 / CELL);

function newStats() {
    return {
        maxHp: 100, dmg: 1, rate: 1, projectiles: 0, pierce: 0, ricochet: 0, area: 1,
        crit: .05, critMult: 1.8, speed: 1, magnet: 2.4, armor: 0, regen: 0, lifesteal: 0,
        dashCd: 1, luck: 0, income: 1, doubleShot: 0, trail: false, execute: 0, splash: false,
        size: 1, projSpeed: 1, range: 1,
        thorns: 0, killHeal: 0, comboDmg: false, shieldCd: 0, bounty: false, dashNova: false,
        critBolt: false, slowAura: false, adrenaline: false, inkPower: 0, revive: 0, dashCharges: 1,
    };
}

export class Game {
    constructor(view, audio, input, hooks) {
        this.v = view; this.audio = audio; this.input = input; this.hooks = hooks;
        this.settings = { numbers: true, shake: true };
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem('overprint-settings') || '{}')); } catch { /* ok */ }
        this.grid = Array.from({ length: GN * GN }, () => []);
        this.nextId = 1;
        this.clearWorld();
        this.state = 'menu';
        this.player = null;
        this.stats = newStats();
        this.demoT = 0;
    }

    saveSettings() { try { localStorage.setItem('overprint-settings', JSON.stringify(this.settings)); } catch { /* ok */ } }

    clearWorld() {
        this.enemies = []; this.bullets = []; this.ebullets = []; this.pickups = [];
        this.zones = []; this.marks = []; this.drops = []; this.timers = [];
        this.orbiters = []; this.drones = []; this.lasers = []; this.mines = [];
    }

    // --- nowy przebieg -----------------------------------------------------------------------------
    start() {
        this.clearWorld();
        this.v.paper.reset();
        this.v.particles.length = 0; this.v.numbers.length = 0;
        this.stats = newStats();
        this.cardsTaken = {};
        this.player = {
            x: 0, z: 3, vx: 0, vz: 0, r: .45, hp: 100, aimX: 0, aimZ: -1,
            iframes: 0, dashT: 0, dashCdT: 0, dashing: false, dashX: 0, dashZ: 0, trailT: 0,
            recoil: 0, hurtFlash: 0, dead: false, deadT: 0, healAcc: 0, stealWindow: 0,
            dashStock: 1, shieldReady: false, shieldT: 0,
        };
        this.dmgBonus = 1;
        this.weapons = [];
        this.addWeapon('rapidograf');
        this.wave = 0; this.score = 0; this.kills = 0; this.time = 0;
        this.combo = 0; this.comboT = 0; this.bestCombo = 0;
        this.money = 15; this.spent = 0;
        this.xp = 0; this.level = 1; this.xpNext = xpForLevel(1); this.pendingLevels = 0;
        this.ult = { charge: 0, need: 70 };
        this.rerolls = 0;
        this.hitstop = 0; this.timeScale = 1;
        this.pickupStreak = 0; this.pickupStreakT = 0;
        this.bossesKilled = 0;
        this.v.follow(0, 3, 0, undefined, true);
        this.state = 'play';
        this.startWave(1);
    }

    // --- bronie i tusze ------------------------------------------------------------------------------
    addWeapon(id) {
        if (this.weapons.length >= MAX_WEAPONS) return false;
        const w = { id, level: 1, inks: [], cd: 0, shots: 0, voidCd: 0, toxCd: 0, orbitA: 0, drones: [], spent: 0, laserTick: 0 };
        this.refreshWeapon(w);
        this.weapons.push(w);
        return true;
    }
    refreshWeapon(w) {
        w.stats = weaponStats(w.id, w.level);
        w.mix = mixOf(w.inks);
        w.procScale = w.stats.kind === 'laser' ? .3 : w.stats.kind === 'orbit' ? .8 : w.stats.kind === 'rail' ? 1.5
            : Math.min(1.6, Math.sqrt(3 / (w.stats.rate || 3)));
    }
    upgradeWeapon(i) {
        const w = this.weapons[i];
        if (!w || w.level >= 5) return false;
        w.level++;
        this.refreshWeapon(w);
        if (w.level === 5) this.hooks.toast?.(`EWOLUCJA: ${WEAPONS[w.id].evo}`, '#ff00ff');
        return true;
    }
    setInk(i, slot, color) {
        const w = this.weapons[i];
        if (!w) return;
        w.inks[slot] = color;
        w.inks = w.inks.filter(Boolean).slice(0, INK_SLOTS);
        this.refreshWeapon(w);
        const had = this.ultUnlocked;
        if (!had && this.ultReady()) this.hooks.toast?.('K odblokowane: OVERPRINT (Q)', '#ffffff');
    }
    sellWeapon(i) {
        const w = this.weapons[i];
        if (!w || this.weapons.length <= 1) return 0;
        const refund = Math.floor(w.spent * .4 + 5);
        this.weapons.splice(i, 1);
        this.money += refund;
        return refund;
    }
    inkSet() {
        const s = new Set();
        if (this.weapons) for (const w of this.weapons) for (const k of w.inks) s.add(k);
        return s;
    }
    ultReady() {
        const s = this.inkSet();
        this.ultUnlocked = s.has('C') && s.has('M') && s.has('Y');
        return this.ultUnlocked;
    }
    buildString() {
        return this.weapons.map(w => `${WEAPONS[w.id].name} ${w.level}${w.inks.length ? ' [' + w.inks.join('') + ']' : ''}`).join(' · ');
    }

    // --- karty poziomu --------------------------------------------------------------------------------
    rollCards() {
        const luck = this.stats.luck;
        const weightOf = r => r === 0 ? 1 : r === 1 ? .42 + luck * .1 : .13 + luck * .05;
        const pool = [];
        for (const c of CARDS) {
            if (c.max && (this.cardsTaken[c.id] || 0) >= c.max) continue;
            pool.push({ kind: 'stat', id: c.id, name: c.name, desc: c.desc, rarity: c.rarity, icon: c.icon, w: weightOf(c.rarity) });
        }
        this.weapons.forEach((w, i) => {
            if (w.level >= 5) return;
            const next = w.level + 1;
            pool.push({ kind: 'upgrade', index: i, name: `${WEAPONS[w.id].name} → poz. ${next}`, desc: levelText(w.id, next), rarity: next === 5 ? 2 : 0, icon: WEAPONS[w.id].icon, w: 1.3 });
        });
        if (this.weapons.length < MAX_WEAPONS) {
            const owned = new Set(this.weapons.map(w => w.id));
            const free = Object.keys(WEAPONS).filter(id => !owned.has(id));
            const id = pick(free);
            if (id) pool.push({ kind: 'weapon', id, name: `Nowa broń: ${WEAPONS[id].name}`, desc: WEAPONS[id].desc, rarity: 1, icon: WEAPONS[id].icon, w: .9 });
        }
        const inkColor = pick(['C', 'M', 'Y']);
        pool.push({ kind: 'ink', color: inkColor, name: `Tusz ${inkColor}`, desc: 'Darmowy nabój do slotu dowolnej broni.', rarity: 1, icon: 'ink', w: .55 });
        const out = [];
        for (let n = 0; n < 3 && pool.length; n++) {
            const total = pool.reduce((a, c) => a + c.w, 0);
            let r = Math.random() * total, i = 0;
            while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
            out.push(pool.splice(i, 1)[0]);
        }
        return out;
    }
    applyCard(card) {
        if (card.kind === 'stat') {
            const def = CARDS.find(c => c.id === card.id);
            def.apply(this.stats, this);
            this.cardsTaken[card.id] = (this.cardsTaken[card.id] || 0) + 1;
        } else if (card.kind === 'upgrade') this.upgradeWeapon(card.index);
        else if (card.kind === 'weapon') this.addWeapon(card.id);
    }
    levelDone() {
        this.pendingLevels--;
        if (this.pendingLevels > 0) this.hooks.levelUp(this.rollCards());
        else this.state = 'play';
    }

    // --- sklep -----------------------------------------------------------------------------------------
    rollShop() {
        const w = this.wave, offers = [];
        const owned = new Set(this.weapons.map(x => x.id));
        const freeW = Object.keys(WEAPONS).filter(id => !owned.has(id));
        const pool = [];
        for (const id of freeW) pool.push({ kind: 'weapon', id, name: WEAPONS[id].name, desc: WEAPONS[id].desc, icon: WEAPONS[id].icon, price: PRICES.weapon(id, w), w: 1 });
        for (const c of ['C', 'M', 'Y']) pool.push({ kind: 'ink', color: c, name: `Tusz ${c}`, desc: { C: 'Chłód i zamrażanie.', M: 'Podpalenie.', Y: 'Pioruny łańcuchowe.' }[c] + ' Wkładasz do slotu broni.', icon: 'ink', price: PRICES.ink(w), w: 1.1 });
        for (const c of CARDS) {
            if (c.rarity > 1 || (c.max && (this.cardsTaken[c.id] || 0) >= c.max) || c.id === 'luck') continue;
            pool.push({ kind: 'stat', id: c.id, name: c.name, desc: c.desc, icon: c.icon, price: Math.round(PRICES.stat(w) * (1 + c.rarity * .8)), rarity: c.rarity, w: .5 });
        }
        pool.push({ kind: 'maxhp', name: 'Gruby karton+', desc: '+25 maks. zdrowia.', icon: 'heart', price: PRICES.maxhp(w), w: .6 });
        for (let n = 0; n < 4 && pool.length; n++) {
            const total = pool.reduce((a, c) => a + c.w, 0);
            let r = Math.random() * total, i = 0;
            while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
            const o = pool.splice(i, 1)[0];
            offers.push(o);
        }
        return offers;
    }
    canAfford(p) { return Math.floor(this.money) >= p; }
    pay(p) { this.money -= p; this.spent += p; }
    buyOffer(o) {
        if (!this.canAfford(o.price)) return false;
        if (o.kind === 'weapon') { if (!this.addWeapon(o.id)) return false; this.weapons[this.weapons.length - 1].spent = o.price; }
        else if (o.kind === 'stat') { const def = CARDS.find(c => c.id === o.id); def.apply(this.stats, this); this.cardsTaken[o.id] = (this.cardsTaken[o.id] || 0) + 1; }
        else if (o.kind === 'maxhp') { this.stats.maxHp += 25; this.heal(25); }
        this.pay(o.price);
        return true;
    }

    heal(n) { const p = this.player; if (p) p.hp = Math.min(this.stats.maxHp, p.hp + n); }

    // --- fale ------------------------------------------------------------------------------------------
    startWave(n) {
        this.wave = n;
        const boss = n % 5 === 0;
        this.waveBoss = boss;
        this.quota = boss ? Math.round(waveQuota(n) * .45) : waveQuota(n);
        this.spawned = 0;
        this.spawnTimer = 1.2;
        this.interval = waveDuration(n) / this.quota;
        this.waveNoHit = true;
        this.waveClearT = -1;
        this.bossPending = boss ? 2.5 : -1;
        this.audio.intensity = boss ? 4 : Math.min(3, Math.floor((n - 1) / 2));
        this.audio.muffle(false);
        this.hooks.wave?.(n, boss);
    }
    nextWave() { this.state = 'play'; this.startWave(this.wave + 1); }

    spawnGroup() {
        const n = this.wave, p = this.player;
        const types = Object.entries(ENEMIES).filter(([, d]) => d.from <= n && d.weight > 0);
        const total = types.reduce((a, [, d]) => a + d.weight * (d.from === 1 ? Math.max(.35, 1 - n * .03) : 1), 0);
        let r = Math.random() * total, type = types[0][0];
        for (const [id, d] of types) { r -= d.weight * (d.from === 1 ? Math.max(.35, 1 - n * .03) : 1); if (r <= 0) { type = id; break; } }
        const size = type === 'walec' ? 1 : 2 + (Math.random() * Math.min(6, 2 + n / 3) | 0);
        let cx = 0, cz = 0;
        for (let tries = 0; tries < 12; tries++) {
            const a = Math.random() * Math.PI * 2, d = rand(11, 17);
            cx = clamp(p.x + Math.cos(a) * d, -ARENA + 2, ARENA - 2);
            cz = clamp(p.z + Math.sin(a) * d, -ARENA + 2, ARENA - 2);
            if (Math.hypot(cx - p.x, cz - p.z) > 8 && !this.inObstacle(cx, cz, 1.5)) break;
        }
        const eliteChance = n >= 5 ? .04 + n * .005 : 0;
        for (let i = 0; i < size && this.spawned < this.quota; i++) {
            const x = clamp(cx + rand(-1.6, 1.6), -ARENA + 1, ARENA - 1), z = clamp(cz + rand(-1.6, 1.6), -ARENA + 1, ARENA - 1);
            if (this.inObstacle(x, z, .8)) continue;
            this.drops.push({ x, z, t: rand(-.25, 0), dur: .7, type, elite: Math.random() < eliteChance });
            this.spawned++;
        }
    }

    spawnEnemy(type, x, z, elite = false, waveOverride) {
        const def = ENEMIES[type], sc = scaling(waveOverride || this.wave || 1);
        const e = {
            id: this.nextId++, type, x, z, hp: def.hp * sc.hp, maxHp: def.hp * sc.hp,
            speed: def.speed * sc.speed * rand(.92, 1.08), dmg: def.dmg * sc.dmg, r: def.r, scale: 1,
            fx: 0, fz: 1, kx: 0, kz: 0, flash: 0, slow: 0, slowT: 0, chill: 0, freezeT: 0,
            burnT: 0, burnDps: 0, burnAcc: 0, poisonT: 0, spawnT: .25, rollT: 0, roll: 0,
            cd: rand(1, 2.5), fuse: 0, heading: Math.random() * Math.PI * 2, windup: 0, dotShow: 0,
        };
        if (elite) {
            const a = pick(AFFIXES);
            e.elite = a.id; e.eliteColor = a.color;
            e.hp = e.maxHp = e.maxHp * 3.4;
            e.scale = 1.3; e.r = def.r * 1.3;
            if (a.id === 'fast') e.speed *= 1.45;
        }
        this.enemies.push(e);
        return e;
    }

    spawnBoss() {
        const cycle = Math.floor((this.wave / 5 - 1) / BOSSES.length);
        const def = BOSSES[(this.wave / 5 - 1) % BOSSES.length];
        const sc = scaling(this.wave);
        const p = this.player;
        let x = -p.x * .5, z = -p.z * .5 - 6;
        if (Math.hypot(x - p.x, z - p.z) < 9) z = p.z > 0 ? p.z - 12 : p.z + 12;
        const hp = def.hp * sc.hp * (1 + .5 * cycle) * 1.25;
        const e = {
            id: this.nextId++, boss: true, type: def.id, name: def.name, title: def.title,
            x: clamp(x, -ARENA + 4, ARENA - 4), z: clamp(z, -ARENA + 4, ARENA - 4), y: 12,
            hp, maxHp: hp, r: def.r, speed: def.speed * (1 + cycle * .12), dmg: def.dmg * sc.dmg, def, cycle,
            fx: 0, fz: 1, kx: 0, kz: 0, flash: 0, slow: 0, slowT: 0, chill: 0, freezeT: 0,
            burnT: 0, burnDps: 0, burnAcc: 0, poisonT: 0, spawnT: 0, scale: 1,
            st: 'enter', t: 0, n: 0, dotShow: 0, phaseOut: 0,
        };
        this.enemies.push(e);
        this.boss = e;
        this.audio.play('boss');
        this.v.shake(.8);
        this.hooks.boss?.(e);
    }

    // --- pomocnicze: siatka, przeszkody, geometria --------------------------------------------------------
    buildGrid() {
        for (const c of this.grid) c.length = 0;
        for (const e of this.enemies) {
            const i = clamp((e.x + ARENA) / CELL | 0, 0, GN - 1), j = clamp((e.z + ARENA) / CELL | 0, 0, GN - 1);
            this.grid[j * GN + i].push(e);
        }
    }
    near(x, z, r, out = []) {
        out.length = 0;
        const i0 = clamp((x - r + ARENA) / CELL | 0, 0, GN - 1), i1 = clamp((x + r + ARENA) / CELL | 0, 0, GN - 1);
        const j0 = clamp((z - r + ARENA) / CELL | 0, 0, GN - 1), j1 = clamp((z + r + ARENA) / CELL | 0, 0, GN - 1);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const e of this.grid[j * GN + i]) if (!e.dead) out.push(e);
        return out;
    }
    nearest(x, z, maxD, exclude) {
        let best = null, bd = maxD * maxD;
        for (const e of this.enemies) {
            if (e.dead || e.phaseOut > 0 || (exclude && exclude.has(e.id))) continue;
            const d = (e.x - x) ** 2 + (e.z - z) ** 2;
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }
    inObstacle(x, z, r = 0) {
        for (const o of OBSTACLES) if (Math.abs(x - o.x) < o.hw + r && Math.abs(z - o.z) < o.hd + r) return o;
        return null;
    }
    // Wypycha okrąg z przeszkód i poza krawędź arkusza.
    collide(ent, r) {
        for (const o of OBSTACLES) {
            const cx = clamp(ent.x, o.x - o.hw, o.x + o.hw), cz = clamp(ent.z, o.z - o.hd, o.z + o.hd);
            const dx = ent.x - cx, dz = ent.z - cz, d2 = dx * dx + dz * dz;
            if (d2 < r * r) {
                if (d2 > 1e-6) {
                    const d = Math.sqrt(d2);
                    ent.x = cx + dx / d * r; ent.z = cz + dz / d * r;
                    ent.bnx = dx / d; ent.bnz = dz / d;
                } else {
                    const px = o.hw - Math.abs(ent.x - o.x), pz = o.hd - Math.abs(ent.z - o.z);
                    if (px < pz) { const sx = Math.sign(ent.x - o.x || 1); ent.x = o.x + sx * (o.hw + r); ent.bnx = sx; ent.bnz = 0; }
                    else { const sz = Math.sign(ent.z - o.z || 1); ent.z = o.z + sz * (o.hd + r); ent.bnx = 0; ent.bnz = sz; }
                }
                ent.blocked = o;
            }
        }
        const m = ARENA - r;
        ent.x = clamp(ent.x, -m, m); ent.z = clamp(ent.z, -m, m);
    }
    // Długość promienia do pierwszej przeszkody (dla gilotyny i lasera).
    rayLength(x, z, dx, dz, max) {
        let best = max;
        for (const o of OBSTACLES) {
            let t0 = 0, t1 = best;
            for (const [p, d, lo, hi] of [[x, dx, o.x - o.hw, o.x + o.hw], [z, dz, o.z - o.hd, o.z + o.hd]]) {
                if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) { t0 = Infinity; break; } continue; }
                let a = (lo - p) / d, b = (hi - p) / d;
                if (a > b) [a, b] = [b, a];
                t0 = Math.max(t0, a); t1 = Math.min(t1, b);
                if (t0 > t1) break;
            }
            if (t0 <= t1 && t0 < best) best = t0;
        }
        // krawędź arkusza
        const tx = dx > 0 ? (ARENA - x) / dx : dx < 0 ? (-ARENA - x) / dx : Infinity;
        const tz = dz > 0 ? (ARENA - z) / dz : dz < 0 ? (-ARENA - z) / dz : Infinity;
        return Math.max(0, Math.min(best, tx, tz));
    }
    segHits(x, z, dx, dz, len, width, fn) {
        for (const e of this.enemies) {
            if (e.dead || e.phaseOut > 0) continue;
            const ex = e.x - x, ez = e.z - z, t = ex * dx + ez * dz;
            if (t < -e.r || t > len + e.r) continue;
            const px = ex - dx * t, pz = ez - dz * t;
            if (px * px + pz * pz < (e.r + width) ** 2) fn(e);
        }
    }

    // --- obrażenia --------------------------------------------------------------------------------------------
    damage(e, amount, o = {}) {
        if (e.dead || e.phaseOut > 0) return;
        let dmg = amount * this.dmgBonus;
        if (e.elite === 'armored') dmg *= .6;
        let crit = false;
        if (o.canCrit !== false && Math.random() < this.stats.crit) { crit = true; dmg *= this.stats.critMult; }
        if (this.stats.execute && !e.boss && o.source !== 'dot' && (e.hp - dmg) / e.maxHp < this.stats.execute) dmg = Math.max(dmg, e.hp);
        e.hp -= dmg;
        if (o.source !== 'dot') e.flash = .07;
        // wampiryzm z limitem na sekundę
        if (this.stats.lifesteal && this.player.stealWindow < 6) {
            const h = Math.min(dmg * this.stats.lifesteal, 6 - this.player.stealWindow);
            this.player.stealWindow += h; this.heal(h);
        }
        if (o.source === 'dot') {
            e.dotShow += dmg;
            if (e.dotShow >= 1 && Math.random() < .35) { this.v.number(e.x, e.z, e.dotShow, false, o.color); e.dotShow = 0; }
        } else this.v.number(e.x + rand(-.3, .3), e.z, dmg, crit, o.color && o.source !== 'bullet' ? o.color : null);
        if (o.knock && !e.boss && !ENEMIES[e.type]?.heavy) {
            const k = o.knock * (e.elite ? .5 : 1);
            e.kx += o.kx * k * 3; e.kz += o.kz * k * 3;
        }
        if (o.weapon && !o.noProc) this.applyInk(e, dmg, o.weapon, o.procScale ?? o.weapon.procScale);
        if (crit && o.source !== 'dot') this.audio.play('hit');
        if (crit && this.stats.critBolt && o.source !== 'chain' && o.source !== 'dot' && !e.dead && Math.random() < .5) this.chain(e, dmg * .4, 2);
        if (e.hp <= 0) this.kill(e, o);
    }

    applyInk(e, dmg, w, scale) {
        const mix = w.mix;
        if (!mix || mix.id === 'none' || e.dead) return;
        const pw = (mix.power || 1) * (1 + this.stats.inkPower), area = this.stats.area;
        scale *= 1 + this.stats.inkPower * .5;
        switch (mix.id) {
            case 'chill':
                e.slowT = 2; e.slow = Math.max(e.slow, .28 + .12 * pw);
                e.chill += pw * scale;
                if (e.chill >= 4) {
                    e.chill = 0; e.freezeT = e.boss ? .35 : 1.3;
                    this.audio.play('freeze');
                    this.v.burst(e.x, .8, e.z, INK.C, 6, 4, .14);
                }
                break;
            case 'burn':
                e.burnT = 2.4 + pw * .6;
                e.burnDps = Math.max(e.burnDps, dmg * .45 * pw);
                break;
            case 'shock':
                if (Math.random() < .22 * pw * scale) this.chain(e, dmg * .6, 2 + pw);
                break;
            case 'void':
                if (w.voidCd <= 0 && Math.random() < .12 * scale) {
                    w.voidCd = .55;
                    this.addZone({ kind: 'vortex', x: e.x, z: e.z, r: 3 * area, life: 1.7, dps: w.stats.dmg * this.stats.dmg * 1.4, color: INK.blue, pull: 8 });
                }
                break;
            case 'blast':
                if (Math.random() < .07 * scale) this.explode(e.x, e.z, 2.2 * area, dmg * .8 + 8, INK.red, { depth: 1 });
                break;
            case 'toxin':
                e.poisonT = 3;
                if (w.toxCd <= 0 && Math.random() < .15 * scale) {
                    w.toxCd = .5;
                    this.addZone({ kind: 'cloud', x: e.x, z: e.z, r: 2 * area, life: 3, dps: w.stats.dmg * this.stats.dmg * 1.1, color: INK.green, poison: true });
                }
                break;
        }
    }

    addZone(z) {
        if (this.zones.length > 16) this.zones.shift();
        z.t = 0; z.tick = 0; z.max = z.life;
        this.zones.push(z);
        if (z.kind !== 'fire') this.v.splat(z.x, z.z, z.color, z.r * .7, .25);
    }

    chain(from, dmg, n) {
        const seen = new Set([from.id]);
        let cur = from;
        for (let i = 0; i < n; i++) {
            const next = this.nearest(cur.x, cur.z, 5.5, seen);
            if (!next) break;
            seen.add(next.id);
            this.lightning(cur.x, cur.z, next.x, next.z);
            this.damage(next, dmg, { noProc: true, source: 'chain', color: INK.Y });
            cur = next;
        }
        this.audio.play('zap');
    }
    lightning(x1, z1, x2, z2) {
        // łamana: trzy odcinki z przesunięciem w bok
        const pts = [[x1, z1]];
        for (let k = 1; k < 4; k++) {
            const t = k / 4;
            pts.push([x1 + (x2 - x1) * t + rand(-.5, .5), z1 + (z2 - z1) * t + rand(-.5, .5)]);
        }
        pts.push([x2, z2]);
        for (let k = 0; k < pts.length - 1; k++) this.v.beam(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], INK.Y, .14, .16, .8);
    }

    explode(x, z, r, dmg, color, o = {}) {
        this.v.ring(x, z, color, r * .3, r, .3);
        this.v.burst(x, .5, z, color, 14, 7, .16, .3);
        this.v.splat(x, z, color, r * .55, .55);
        // Wybuchy z broni gracza (rakiety, miny, mieszanka Red) nie trzęsą ekranem: przy wielu naraz nic nie było widać.
        if (o.big) this.v.shake(.6);
        this.audio.play('explode');
        const list = this.near(x, z, r + 1.5, []);
        for (const e of list) {
            if (Math.hypot(e.x - x, e.z - z) < r + e.r) {
                const len = Math.hypot(e.x - x, e.z - z) || 1;
                this.damage(e, dmg, { source: 'explosion', color, knock: 1.5, kx: (e.x - x) / len, kz: (e.z - z) / len, depth: (o.depth || 0) + 1, weapon: o.weapon, noProc: true });
            }
        }
        const p = this.player;
        if (o.hurtPlayer && p && Math.hypot(p.x - x, p.z - z) < r + p.r) this.hurt(o.hurtPlayer, x, z);
    }

    kill(e, o = {}) {
        if (e.dead) return;
        e.dead = true;
        const def = e.boss ? e.def : ENEMIES[e.type];
        const p = this.player;
        const mult = this.comboMult();
        const pts = Math.round(def.score * (1 + .1 * (this.wave - 1)) * mult * (e.elite ? 3 : 1));
        this.score += pts;
        this.kills++;
        this.combo++; this.comboT = this.stats.comboDmg ? 4.5 : 3.2;
        if (this.stats.killHeal) this.heal(this.stats.killHeal);
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        if (this.ultReady()) this.ult.charge = Math.min(this.ult.need, this.ult.charge + (e.boss ? 30 : e.elite ? 4 : 1));
        // krople
        const xp = def.xp * (e.elite ? 4 : 1);
        const drops = (e.boss ? 14 : e.elite ? 3 : 1) * (this.stats.bounty && (e.boss || e.elite) ? 2 : 1);
        for (let i = 0; i < drops; i++) {
            const a = Math.random() * Math.PI * 2, s = drops > 1 ? rand(2, 6) : 0;
            this.addPickup(e.x, e.z, Math.max(1, Math.round(xp / drops)), Math.cos(a) * s, Math.sin(a) * s);
        }
        if (!e.boss && Math.random() < .012 + (e.elite ? .15 : 0)) this.pickups.push({ id: this.nextId++, x: e.x, z: e.z, value: 0, heart: true, vx: 0, vz: 0 });
        // farba
        const col = e.boss ? '#16161c' : def.color === '#f2c200' ? '#f2c200' : e.elite ? e.eliteColor : '#77777f';
        this.v.splat(e.x, e.z, col, e.r * (e.boss ? 3.2 : 1.5), e.boss ? .8 : .5, o.kx || 0, o.kz || 0);
        if (o.weapon && o.weapon.mix.id !== 'none') this.v.splat(e.x + rand(-.4, .4), e.z + rand(-.4, .4), o.weapon.mix.color, e.r * .8, .4);
        this.v.burst(e.x, .6, e.z, def.color, e.boss ? 60 : 9, e.boss ? 12 : 6, e.boss ? .3 : .15, .25);
        this.audio.play('kill');
        if (this.settings.shake && (e.boss || e.type === 'walec')) this.v.shake(e.boss ? 1.2 : .25);
        // efekty śmierci
        const depth = o.depth || 0;
        if (o.weapon?.mix.id === 'blast' && depth < 3) this.timers.push({ t: .05, fn: () => this.explode(e.x, e.z, 2.4 * this.stats.area, o.weapon.stats.dmg * this.stats.dmg * .9 + 10, INK.red, { depth: depth + 1 }) });
        if (this.stats.splash && depth < 2) this.timers.push({ t: .04, fn: () => this.explode(e.x, e.z, 1.9 * this.stats.area, e.maxHp * .2 + 6, '#555560', { depth: depth + 1 }) });
        if (e.poisonT > 0 && this.zones.length < 14) this.addZone({ kind: 'cloud', x: e.x, z: e.z, r: 1.5 * this.stats.area, life: 2, dps: 6 + this.wave * 1.5, color: INK.green, poison: true });
        if (e.type === 'dzielnik') {
            for (const s of [-1, 1]) {
                const k = this.spawnEnemy('kropla', e.x + e.fz * s * .6, e.z - e.fx * s * .6);
                k.spawnT = 0; k.kx = e.fz * s * 6; k.kz = -e.fx * s * 6;
            }
        }
        if (e.type === 'pecherz') this.timers.push({ t: .02, fn: () => this.explode(e.x, e.z, 2.4, e.dmg, '#f2c200', { hurtPlayer: e.dmg * .6, depth: depth + 1 }) });
        if (e.boss) {
            this.bossesKilled++;
            this.boss = null;
            this.hitstop = .25;
            this.v.flash('#ffffff', .6);
            this.v.misregister(10);
            for (let i = 0; i < 6; i++) this.timers.push({ t: i * .12, fn: () => this.explode(e.x + rand(-2, 2), e.z + rand(-2, 2), 3, 0, pick([INK.C, INK.M, INK.Y]), { big: true }) });
            this.hooks.bossDead?.(e);
        }
        if (e.boss || e.elite) this.hitstop = Math.max(this.hitstop, .06);
    }

    addPickup(x, z, value, vx = 0, vz = 0) {
        if (this.pickups.length > 260) {
            const d = this.pickups[(Math.random() * this.pickups.length) | 0];
            if (!d.heart) { d.value += value; return; }
        }
        this.pickups.push({ id: this.nextId++, x, z, value, vx, vz });
    }

    comboMult() { return 1 + Math.min(4, Math.floor(this.combo / 10) * .25); }

    hurt(dmg, sx, sz, src) {
        const p = this.player;
        if (!p || p.dead || p.iframes > 0) return;
        if (src && this.stats.thorns && !src.dead) this.damage(src, this.stats.thorns * (1 + .12 * (this.wave - 1)), { canCrit: false, source: 'thorns', color: '#ffffff' });
        if (p.shieldReady) {
            p.shieldReady = false; p.shieldT = this.stats.shieldCd; p.iframes = .6;
            this.v.ring(p.x, p.z, '#00ffff', .6, 2.4, .35);
            this.v.burst(p.x, .8, p.z, '#00ffff', 10, 5, .1);
            this.audio.play('shield');
            return;
        }
        const taken = Math.max(dmg * .3, dmg - this.stats.armor);
        p.hp -= taken;
        p.iframes = .75; p.hurtFlash = .15;
        this.combo = 0; this.waveNoHit = false;
        if (sx !== undefined) { const d = Math.hypot(p.x - sx, p.z - sz) || 1; p.vx += (p.x - sx) / d * 8; p.vz += (p.z - sz) / d * 8; }
        if (this.settings.shake) this.v.shake(.55);
        this.v.flash('#ff0055', .22);
        this.v.misregister(3);
        this.v.splat(p.x, p.z, '#ec008c', .5, .4);
        this.audio.play('hurt');
        this.hitstop = Math.max(this.hitstop, .07);
        if (p.hp <= 0) {
            if (this.stats.revive > 0) {
                // Drugi nakład: jeden powrót na przebieg
                this.stats.revive = 0;
                p.hp = this.stats.maxHp * .5; p.iframes = 2.2;
                this.ebullets.length = 0;
                this.explode(p.x, p.z, 6, 120 * scaling(this.wave).hp, '#00ffff', { big: true, depth: 3 });
                this.v.flash('#ffffff', .7); this.v.misregister(16);
                this.audio.play('ult');
                this.hooks.toast?.('Drugi nakład', '#ffffff');
            } else this.die();
        }
    }

    die() {
        const p = this.player;
        p.hp = 0; p.dead = true; p.deadT = 0;
        this.state = 'dying';
        this.v.burst(p.x, .8, p.z, '#26262c', 40, 10, .2, .5);
        this.v.burst(p.x, .8, p.z, '#00ffff', 20, 8, .12);
        for (const c of [INK.C, INK.M, INK.Y]) this.v.splat(p.x + rand(-.6, .6), p.z + rand(-.6, .6), c, 2.2, .7);
        this.v.flash('#ffffff', .5); this.v.misregister(14); this.v.shake(1);
        this.audio.play('death');
        this.audio.intensity = 0;
    }

    activateUlt() {
        const p = this.player;
        if (!this.ultReady() || this.ult.charge < this.ult.need || p.dead) return;
        this.ult.charge = 0;
        this.ult.need = Math.min(160, this.ult.need + 10);
        p.iframes = Math.max(p.iframes, 1.2);
        this.audio.play('ult');
        this.v.flash('#ffffff', .85); this.v.misregister(22); this.v.shake(1.2);
        this.hitstop = .12;
        const off = [[.9, 0], [-.5, .75], [-.5, -.75]];
        [INK.C, INK.M, INK.Y].forEach((c, i) => {
            this.v.splat(p.x + off[i][0], p.z + off[i][1], c, 5.5, .55);
            this.v.ring(p.x + off[i][0] * .4, p.z + off[i][1] * .4, c, 1, 22, .7 + i * .1);
        });
        this.ebullets.length = 0;
        const sc = scaling(this.wave);
        for (const e of this.enemies) {
            if (e.dead || Math.hypot(e.x - p.x, e.z - p.z) > 22) continue;
            const dmg = e.boss ? e.maxHp * .12 : 260 * sc.hp;
            this.timers.push({ t: Math.hypot(e.x - p.x, e.z - p.z) * .025, fn: () => this.damage(e, dmg, { source: 'ult', color: '#ffffff', canCrit: false }) });
        }
        this.hooks.toast?.('OVERPRINT', '#ffffff');
    }

    // =====================================================================================================
    update(rawDt) {
        const dt0 = Math.min(rawDt, 1 / 30);
        this.lasers.length = 0;
        if (this.state === 'menu') { this.updateDemo(dt0); return; }
        if (this.state === 'dying') {
            this.player.deadT += dt0;
            this.timeScale = .3;
            const dt = dt0 * this.timeScale;
            this.updateEnemies(dt); this.updateBullets(dt); this.updateTimers(dt);
            this.v.follow(this.player.x, this.player.z, dt0);
            if (this.player.deadT > 1.6) { this.state = 'over'; this.hooks.over(this.summary()); }
            return;
        }
        if (this.state !== 'play') return;

        let dt = dt0;
        if (this.hitstop > 0) { this.hitstop -= dt0; dt = dt0 * .08; }
        this.time += dt;

        this.buildGrid();
        this.updatePlayer(dt);
        this.updateWeapons(dt);
        this.updateEnemies(dt);
        this.updateBullets(dt);
        this.updateZones(dt);
        this.updateMines(dt);
        this.updateMarks(dt);
        this.updateDrops(dt);
        this.updatePickups(dt);
        this.updateTimers(dt);
        this.updateWave(dt);

        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;

        const p = this.player;
        const lead = { x: p.aimX * 1.6, z: p.aimZ * 1.2 };
        this.v.follow(p.x, p.z, dt0, this.aimMode === 'mouse' ? lead : { x: 0, z: 0 });

        if (this.pendingLevels > 0 && this.state === 'play' && !p.dead) {
            this.state = 'levelup';
            this.audio.play('levelup');
            this.hooks.levelUp(this.rollCards());
        }
    }

    updatePlayer(dt) {
        const p = this.player, s = this.stats, inp = this.input;
        inp.poll();
        const mv = inp.move();
        p.iframes -= dt; p.hurtFlash -= dt; p.recoil = Math.max(0, p.recoil - dt * 6);
        const low = p.hp < s.maxHp * .4;
        this.dmgBonus = (s.comboDmg ? 1 + Math.min(.3, Math.floor(this.combo / 10) * .01) : 1) * (s.adrenaline && low ? 1.3 : 1);
        this.rateBonus = s.adrenaline && low ? 1.3 : 1;
        if (s.shieldCd && !p.shieldReady) { p.shieldT -= dt; if (p.shieldT <= 0) p.shieldReady = true; }
        // ładunki dasha
        const maxDash = s.dashCharges || 1, dashCd = 1.1 * s.dashCd;
        if (p.dashStock < maxDash) {
            p.dashCdT -= dt;
            if (p.dashCdT <= 0) { p.dashStock++; p.dashCdT = p.dashStock < maxDash ? dashCd : 0; }
        }
        p.stealWindow = Math.max(0, p.stealWindow - dt * 6);
        if (s.regen) this.heal(s.regen * dt);

        if (inp.consume('dash') && p.dashStock > 0) {
            let dx = mv.x, dz = mv.z;
            if (Math.hypot(dx, dz) < .1) { dx = p.aimX; dz = p.aimZ; }
            const l = Math.hypot(dx, dz) || 1;
            p.dashX = dx / l; p.dashZ = dz / l;
            p.dashT = .17; p.dashing = true;
            p.dashStock--; if (p.dashCdT <= 0) p.dashCdT = dashCd;
            p.iframes = Math.max(p.iframes, .3);
            this.audio.play('dash');
            this.v.burst(p.x, .3, p.z, '#cfcfcf', 6, 3, .12);
        }
        if (inp.consume('ult')) this.activateUlt();
        if (inp.consume('pause')) { this.hooks.pause?.(); }

        const speed = 6.3 * s.speed;
        if (p.dashT > 0) {
            p.dashT -= dt;
            p.vx = p.dashX * 23; p.vz = p.dashZ * 23;
            if (s.trail) {
                p.trailT -= dt;
                if (p.trailT <= 0) { p.trailT = .05; this.addZone({ kind: 'fire', x: p.x, z: p.z, r: .9 * s.area, life: 2.4, dps: 18 + this.wave * 4, color: INK.M, burn: true }); }
            }
            if (p.dashT <= 0) {
                p.dashing = false;
                if (s.dashNova) this.explode(p.x, p.z, 2.6 * s.area, 22 + this.wave * 6, '#ffffff', { depth: 3 });
            }
        } else {
            const k = 1 - Math.exp(-dt * 16);
            p.vx += (mv.x * speed - p.vx) * k;
            p.vz += (mv.z * speed - p.vz) * k;
        }
        p.x += p.vx * dt; p.z += p.vz * dt;
        this.collide(p, p.r);

        // celowanie
        const aim = inp.aim();
        this.aimMode = aim.mode;
        let fire = aim.fire;
        if (aim.mode === 'mouse') {
            const g = this.v.screenToGround(aim.x, aim.y);
            const dx = g.x - p.x, dz = g.z - p.z, l = Math.hypot(dx, dz);
            if (l > .2) { p.aimX = dx / l; p.aimZ = dz / l; }
        } else if (aim.mode === 'dir') {
            const l = Math.hypot(aim.x, aim.z);
            p.aimX = aim.x / l; p.aimZ = aim.z / l;
        } else {
            const t = this.boss && Math.hypot(this.boss.x - p.x, this.boss.z - p.z) < 13 && this.boss.phaseOut <= 0 ? this.boss : this.nearest(p.x, p.z, this.straggle ? 20 : 14);
            if (t) {
                const dx = t.x - p.x, dz = t.z - p.z, l = Math.hypot(dx, dz) || 1;
                const k = 1 - Math.exp(-dt * 18);
                p.aimX += (dx / l - p.aimX) * k; p.aimZ += (dz / l - p.aimZ) * k;
                const n = Math.hypot(p.aimX, p.aimZ) || 1; p.aimX /= n; p.aimZ /= n;
            } else {
                fire = false;
                if (Math.hypot(mv.x, mv.z) > .2) { const l = Math.hypot(mv.x, mv.z); p.aimX = mv.x / l; p.aimZ = mv.z / l; }
            }
        }
        this.firing = fire;
    }

    updateWeapons(dt) {
        const p = this.player, s = this.stats;
        this.orbiters.length = 0;
        this.drones.length = 0;
        for (const w of this.weapons) {
            const st = w.stats;
            w.voidCd -= dt; w.toxCd -= dt;
            if (st.kind === 'orbit') { this.updateOrbit(w, dt); continue; }
            if (st.kind === 'drone') { this.updateDrones(w, dt); continue; }
            if (st.kind === 'laser') { if (this.firing) this.fireLaser(w, dt); continue; }
            if (st.kind === 'cone') { if (this.firing) this.fireCone(w, dt); continue; }
            if (st.kind === 'nova') { this.updateNova(w, dt); continue; }
            if (st.kind === 'mine') { this.updateMinelayer(w, dt); continue; }
            w.cd -= dt;
            if (!this.firing) { w.cd = Math.max(w.cd, 0); continue; }
            const rate = st.rate * s.rate * this.rateBonus;
            let guard = 0;
            while (w.cd <= 0 && guard++ < 4) {
                w.cd += 1 / rate;
                this.fire(w);
                if (s.doubleShot && Math.random() < s.doubleShot) this.timers.push({ t: .06, fn: () => this.fire(w, .09) });
            }
        }
    }

    fire(w, extraAngle = 0) {
        const p = this.player, s = this.stats, st = w.stats;
        if (p.dead) return;
        const base = Math.atan2(p.aimZ, p.aimX) + extraAngle;
        const ox = p.x + p.aimX * .7, oz = p.z + p.aimZ * .7;
        w.shots++;
        p.recoil = 1;
        const col = w.mix.color;
        if (st.kind === 'rail') {
            const n = st.count;
            for (let i = 0; i < n; i++) {
                const a = base + (i - (n - 1) / 2) * .13;
                const dx = Math.cos(a), dz = Math.sin(a);
                const len = this.rayLength(ox, oz, dx, dz, st.range * s.range);
                const dmg = st.dmg * s.dmg;
                this.segHits(ox, oz, dx, dz, len, st.width * s.size, e => this.damage(e, dmg, { weapon: w, knock: 1, kx: dx, kz: dz, source: 'rail' }));
                this.v.beam(ox, oz, ox + dx * len, oz + dz * len, col === INK.none ? '#ffffff' : col, .5 * s.size, .2);
                this.v.beam(ox, oz, ox + dx * len, oz + dz * len, '#ffffff', .18, .12);
                this.v.paper.stroke(ox, oz, ox + dx * len, oz + dz * len, col === INK.none ? '#9a9aa0' : col, .12, .35);
                this.v.burst(ox + dx * len, .6, oz + dz * len, col, 5, 5, .12);
            }
            this.audio.play('rail');
            return;
        }
        if (st.kind === 'boomerang') {
            const n = st.count + Math.floor(s.projectiles / 2);
            const sp = st.speed * s.projSpeed, out = (st.range * s.range) / sp;
            for (let i = 0; i < n; i++) {
                const a = base + (i - (n - 1) / 2) * st.spread;
                this.bullets.push({
                    id: this.nextId++, x: ox, z: oz, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, life: out * 2 + 2.5,
                    dmg: st.dmg * s.dmg, size: st.size * s.size, color: col, w, hit: [], kind: 'boomerang', knock: .8,
                    t: 0, outT: out, speed: sp, back: false, spin: 0,
                });
            }
            this.audio.play('boomerang');
            return;
        }
        let n = st.count + s.projectiles * (w.id === 'rozpylacz' ? 2 : 1);
        let spread = st.spread;
        let fan = n > 1 && w.id !== 'rozpylacz' ? .11 : 0;
        if (st.evo && w.id === 'rapidograf' && w.shots % 4 === 0) { n += 6; fan = .12; }
        const speed = (st.speed || 20) * s.projSpeed;
        const life = (st.range * s.range) / speed;
        for (let i = 0; i < n; i++) {
            let a = base;
            if (w.id === 'rozpylacz') a += (n > 1 ? (i / (n - 1) - .5) * spread : 0) + rand(-.05, .05);
            else a += (i - (n - 1) / 2) * fan + rand(-spread, spread) * .5;
            const sp = w.id === 'rozpylacz' ? speed * rand(.85, 1.1) : speed;
            this.bullets.push({
                id: this.nextId++, x: ox, z: oz, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, life: w.id === 'rozpylacz' ? life * rand(.8, 1.05) : life,
                dmg: st.dmg * s.dmg, size: (st.size || .15) * s.size, pierce: (st.pierce || 0) + s.pierce, ric: s.ricochet,
                color: col, w, hit: [], kind: st.kind, flak: st.evo && w.id === 'rozpylacz', knock: st.knock || .6,
                radius: (st.radius || 0) * s.area, cluster: st.evo && w.id === 'tuba',
            });
        }
        this.v.burst(ox, .6, oz, '#ffffff', 1, 2, .08);
        this.audio.play(w.id === 'rozpylacz' ? 'shotgun' : w.id === 'rotograf' ? 'smg' : w.id === 'tuba' ? 'rocket' : 'shoot');
    }

    fireLaser(w, dt) {
        const p = this.player, s = this.stats, st = w.stats;
        const beams = st.evo ? [-.3, 0, .3] : [0];
        w.laserTick -= dt;
        const tick = w.laserTick <= 0;
        if (tick) w.laserTick = .1;
        const base = Math.atan2(p.aimZ, p.aimX);
        const col = w.mix.id === 'none' ? '#00ffff' : w.mix.color;
        for (const off of beams) {
            const a = base + off, dx = Math.cos(a), dz = Math.sin(a);
            const ox = p.x + dx * .7, oz = p.z + dz * .7;
            const len = this.rayLength(ox, oz, dx, dz, st.range * s.range);
            this.lasers.push({ x1: ox, z1: oz, x2: ox + dx * len, z2: oz + dz * len, width: st.width * s.size, color: col });
            if (tick) {
                const dmg = st.dmg * s.dmg * .1 * (off ? .6 : 1);
                this.segHits(ox, oz, dx, dz, len, st.width * s.size, e => this.damage(e, dmg, { weapon: w, source: 'laser', color: col }));
                if (Math.random() < .5) this.v.splat(ox + dx * len, oz + dz * len, col === '#00ffff' ? INK.C : col, .25, .3);
                this.v.burst(ox + dx * len, .6, oz + dz * len, col, 1, 3, .08);
            }
        }
        p.recoil = Math.max(p.recoil, .4);
        this.audio.play('laser');
    }

    // Aerograf: stożek farby przed graczem
    fireCone(w, dt) {
        const p = this.player, s = this.stats, st = w.stats;
        const range = st.range * s.range, half = st.angle / 2;
        const col = w.mix.id === 'none' ? '#3a3a42' : w.mix.color;
        const base = Math.atan2(p.aimZ, p.aimX);
        this.v.spray(p.x + p.aimX * .6, p.z + p.aimZ * .6, base, half, range, col, 3);
        w.laserTick -= dt;
        if (w.laserTick <= 0) {
            w.laserTick = .1;
            const dmg = st.dmg * s.dmg * .1;
            for (const e of this.near(p.x, p.z, range + 1.5)) {
                const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
                if (d > range + e.r) continue;
                let da = Math.atan2(dz, dx) - base;
                da = Math.atan2(Math.sin(da), Math.cos(da));
                if (Math.abs(da) > half + e.r / Math.max(d, .5)) continue;
                this.damage(e, dmg, { weapon: w, source: 'cone', color: col, procScale: st.evo ? .7 : .35, knock: .25, kx: dx / (d || 1), kz: dz / (d || 1) });
            }
            if (Math.random() < .6) {
                const a = base + rand(-half, half), d = rand(1, range);
                this.v.splat(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, col === '#3a3a42' ? '#8a8a92' : col, rand(.2, .5), .35);
            }
        }
        p.recoil = Math.max(p.recoil, .3);
        this.audio.play('spray');
    }

    // Stempel: rytmiczne uderzenie wokół gracza, gdy ktoś jest w zasięgu
    updateNova(w, dt) {
        const p = this.player, s = this.stats, st = w.stats;
        w.cd -= dt * this.rateBonus;
        if (w.cd > 0) return;
        const R = st.radius * s.area;
        if (!this.nearest(p.x, p.z, R + 1.2)) { w.cd = .15; return; }
        w.cd = 1 / (st.rate * s.rate);
        const slam = (r, mult) => {
            const col = w.mix.id === 'none' ? '#26262c' : w.mix.color;
            this.v.ring(p.x, p.z, col, .4, r, .3);
            this.v.ring(p.x, p.z, '#ffffff', .2, r * .7, .22);
            this.v.splat(p.x, p.z, col === '#26262c' ? '#9a9aa2' : col, r * .45, .3);
            this.v.burst(p.x, .2, p.z, col, 10, 7, .14);
            this.audio.play('stamp');
            for (const e of this.near(p.x, p.z, r + 1.5)) {
                const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
                if (d > r + e.r) continue;
                this.damage(e, st.dmg * s.dmg * mult, { weapon: w, source: 'nova', knock: st.knock, kx: dx / d, kz: dz / d });
            }
        };
        slam(R, 1);
        if (st.evo) {
            this.timers.push({ t: .22, fn: () => { if (!this.player.dead) slam(R * 1.35, .7); } });
            this.addZone({ kind: 'fire', x: p.x, z: p.z, r: R * .6, life: 2.2, dps: st.dmg * s.dmg * .6, color: INK.M, burn: true });
        }
    }

    // Pinezki: pułapki zostawiane za graczem
    updateMinelayer(w, dt) {
        const p = this.player, s = this.stats, st = w.stats;
        w.cd -= dt * this.rateBonus;
        if (w.cd > 0) return;
        const mine = this.mines.filter(m => m.w === w).length;
        if (mine >= st.max * st.count) { w.cd = .2; return; }
        w.cd = 1 / (st.rate * s.rate);
        for (let i = 0; i < st.count; i++) {
            const a = Math.random() * Math.PI * 2, d = st.count > 1 ? rand(.4, 1.2) : 0;
            this.mines.push({ id: this.nextId++, x: p.x - p.aimX * .6 + Math.cos(a) * d, z: p.z - p.aimZ * .6 + Math.sin(a) * d, w, arm: .45, life: 24, color: w.mix.id === 'none' ? '#26262c' : w.mix.color, small: false });
        }
        this.audio.play('mine');
    }
    updateMines(dt) {
        const s = this.stats;
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.arm -= dt; m.life -= dt;
            let boom = m.life <= 0;
            if (!boom && m.arm <= 0) for (const e of this.near(m.x, m.z, 1.8)) if (Math.hypot(e.x - m.x, e.z - m.z) < e.r + .6) { boom = true; break; }
            if (!boom) continue;
            this.mines.splice(i, 1);
            const st = m.w.stats, r = st.radius * s.area * (m.small ? .6 : 1), dmg = st.dmg * s.dmg * (m.small ? .45 : 1);
            this.explode(m.x, m.z, r, dmg, m.color, { weapon: m.w, depth: 1 });
            if (m.w.mix.id !== 'none') for (const e of this.near(m.x, m.z, r + 1)) if (Math.hypot(e.x - m.x, e.z - m.z) < r + e.r) this.applyInk(e, dmg, m.w, 1);
            if (st.evo && !m.small) for (let k = 0; k < 4; k++) {
                const a = k / 4 * Math.PI * 2 + rand(-.3, .3), d = rand(1.4, 2.4);
                this.mines.push({ id: this.nextId++, x: clamp(m.x + Math.cos(a) * d, -ARENA + 1, ARENA - 1), z: clamp(m.z + Math.sin(a) * d, -ARENA + 1, ARENA - 1), w: m.w, arm: .3, life: 10, color: m.color, small: true });
            }
        }
    }

    updateOrbit(w, dt) {
        const p = this.player, s = this.stats, st = w.stats;
        w.orbitA += st.spin * dt;
        const R = st.radius * s.area, n = st.count;
        const col = w.mix.id === 'none' ? '#d8d8dc' : w.mix.color;
        const buf = [];
        for (let i = 0; i < n; i++) {
            const a = w.orbitA + i / n * Math.PI * 2;
            const x = p.x + Math.cos(a) * R, z = p.z + Math.sin(a) * R;
            this.orbiters.push({ x, z, a: -a, color: col, scale: st.evo ? 1.25 : 1 });
            for (const e of this.near(x, z, 1.6, buf)) {
                if (e.rollT > 0) continue;
                if (Math.hypot(e.x - x, e.z - z) < e.r + .5) {
                    e.rollT = st.tick;
                    const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
                    this.damage(e, st.dmg * s.dmg, { weapon: w, knock: 1.4, kx: (e.x - p.x) / d, kz: (e.z - p.z) / d, source: 'orbit' });
                    this.v.splat(x, z, col === '#d8d8dc' ? '#9a9aa0' : col, .3, .35);
                }
            }
        }
    }

    updateDrones(w, dt) {
        const p = this.player, s = this.stats, st = w.stats;
        while (w.drones.length < st.count) w.drones.push({ cd: Math.random() * .4, x: p.x, z: p.z });
        const t = this.time;
        w.drones.forEach((d, i) => {
            const a = t * 1.2 + i / st.count * Math.PI * 2;
            const tx = p.x + Math.cos(a) * 1.7, tz = p.z + Math.sin(a) * 1.7;
            const k = 1 - Math.exp(-dt * 8);
            d.x += (tx - d.x) * k; d.z += (tz - d.z) * k;
            this.drones.push({ x: d.x, z: d.z, i });
            d.cd -= dt;
            if (d.cd > 0) return;
            const e = this.nearest(d.x, d.z, st.range * s.range);
            if (!e) return;
            d.cd = 1 / (st.rate * s.rate);
            const dx = e.x - d.x, dz = e.z - d.z, l = Math.hypot(dx, dz) || 1;
            const sp = st.speed * s.projSpeed;
            this.bullets.push({
                id: this.nextId++, x: d.x, z: d.z, vx: dx / l * sp, vz: dz / l * sp, life: st.range * s.range / sp,
                dmg: st.dmg * s.dmg, size: st.size * s.size, pierce: s.pierce, ric: s.ricochet, color: w.mix.color, w, hit: [], kind: 'bullet', knock: .3,
            });
            this.audio.play('drone');
        });
    }

    // --- wrogowie --------------------------------------------------------------------------------------------
    updateEnemies(dt) {
        const p = this.player;
        const buf = [];
        // Maruderzy: po ostatnim zrzucie kilku ostatnich wrogów przyspiesza i dostaje strzałki na ekranie,
        // żeby fala nie utknęła na jednym kleksie za czcionką.
        this.straggle = this.spawned >= this.quota && this.drops.length === 0 && !this.boss && this.enemies.length <= 4;
        for (const e of this.enemies) {
            if (e.dead) continue;
            e.flash -= dt; e.slowT -= dt; e.freezeT -= dt; e.rollT -= dt;
            if (e.slowT <= 0) e.slow = 0;
            // podpalenie
            if (e.burnT > 0) {
                e.burnT -= dt; e.burnAcc += dt;
                if (e.burnAcc >= .25) { e.burnAcc = 0; this.damage(e, e.burnDps * .25, { source: 'dot', canCrit: false, color: INK.M }); if (Math.random() < .3) this.v.burst(e.x, .9, e.z, INK.M, 1, 2, .1); }
                if (e.burnT <= 0) e.burnDps = 0;
            }
            e.poisonT -= dt;
            if (e.dead) continue;
            if (e.elite === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .025 * dt);
            if (e.boss) { this.updateBoss(e, dt); continue; }
            if (e.spawnT > 0) { e.spawnT -= dt; continue; }

            const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz) || 1;
            const nx = dx / dist, nz = dz / dist;
            let mul = (1 - e.slow) * (this.straggle ? 1.9 : 1);
            if (e.freezeT > 0) mul = 0;
            let mx = nx, mz = nz;
            const T = e.type;
            if (T === 'smuga') {
                const wv = Math.sin(this.time * 4 + e.id) * .5;
                mx = nx - nz * wv; mz = nz + nx * wv;
            } else if (T === 'plujka') {
                if (dist < 5.5) { mx = -nx; mz = -nz; } else if (dist < 8) { const sd = e.id % 2 ? 1 : -1; mx = -nz * sd * .6; mz = nx * sd * .6; }
                e.cd -= dt * (e.freezeT > 0 ? 0 : 1);
                if (e.windup > 0) {
                    e.windup -= dt; mul *= .1;
                    if (e.windup <= 0) {
                        const sp = 7.5 + this.wave * .05;
                        const n = e.elite ? 3 : 1;
                        for (let i = 0; i < n; i++) {
                            const a = Math.atan2(nz, nx) + (i - (n - 1) / 2) * .25;
                            this.ebullets.push({ id: this.nextId++, x: e.x + nx * .6, z: e.z + nz * .6, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, r: .28, dmg: e.dmg, life: 4 });
                        }
                        this.audio.play('enemyShot');
                    }
                } else if (e.cd <= 0 && dist < 13) { e.cd = rand(1.6, 2.3); e.windup = .35; }
            } else if (T === 'walec') {
                const want = Math.atan2(nx, nz);
                let d = want - e.heading;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                e.heading += clamp(d, -1.3 * dt, 1.3 * dt);
                mx = Math.sin(e.heading); mz = Math.cos(e.heading);
                e.roll += e.speed * mul * dt / .9;
            } else if (T === 'pecherz') {
                if (e.fuse > 0) {
                    mul = 0; e.fuse -= dt;
                    if (e.fuse <= 0) { this.kill(e, {}); continue; }
                } else if (dist < 1.9) { e.fuse = .65; this.audio.play('spawn'); }
            } else if (T === 'zszywacz') {
                // podchodzi, celuje (widoczna linia) i wystrzeliwuje się prosto
                e.cd -= dt;
                if (e.st === 'aim') {
                    mul = 0; e.stT -= dt; e.fx = e.lx; e.fz = e.lz;
                    if (e.stT <= 0) { e.st = 'lunge'; e.stT = .42; this.audio.play('lunge'); }
                } else if (e.st === 'lunge') {
                    mx = e.lx; mz = e.lz; mul = 5.2 * (e.freezeT > 0 ? 0 : 1); e.stT -= dt;
                    if (Math.random() < .5) this.v.burst(e.x, .3, e.z, '#8a8a92', 1, 2, .1);
                    if (e.stT <= 0) { e.st = ''; e.cd = rand(1.8, 2.6); }
                } else if (e.cd <= 0 && dist < 7.5 && e.freezeT <= 0) {
                    e.st = 'aim'; e.stT = .6; e.lx = nx; e.lz = nz;
                    this.marks.push({ kind: 'rect', x: e.x + nx * 4.5, z: e.z + nz * 4.5, ry: Math.atan2(nx, nz), w: 1.2, len: 9, t: 0, dur: .6, color: '#ff1f5a' });
                }
            } else if (T === 'igla') {
                // snajper: trzyma dystans, celuje laserem, strzela szybką igłą
                if (dist < 9) { mx = -nx; mz = -nz; } else if (dist < 13) { const sd = e.id % 2 ? 1 : -1; mx = -nz * sd * .5; mz = nx * sd * .5; }
                e.cd -= dt * (e.freezeT > 0 ? 0 : 1);
                if (e.windup > 0) {
                    e.windup -= dt; mul *= .05; e.fx = e.lx; e.fz = e.lz;
                    if (e.windup <= 0) {
                        const sp = 21;
                        this.ebullets.push({ id: this.nextId++, x: e.x + e.lx * .6, z: e.z + e.lz * .6, vx: e.lx * sp, vz: e.lz * sp, r: .2, dmg: e.dmg, life: 2.2, color: '#00607f' });
                        this.audio.play('snipe');
                    }
                } else if (e.cd <= 0 && dist < 18) {
                    e.cd = rand(3, 3.8); e.windup = .85; e.lx = nx; e.lz = nz;
                    this.marks.push({ kind: 'rect', x: e.x + nx * 10, z: e.z + nz * 10, ry: Math.atan2(nx, nz), w: .22, len: 20, t: 0, dur: .85, color: '#00aeef' });
                }
            } else if (T === 'kopiarka') {
                // powoli idzie i drukuje krople
                e.cd -= dt;
                if (e.cd <= 0 && this.enemies.length < aliveCap(this.wave, this.v.quality === 'low')) {
                    e.cd = rand(4, 5.5);
                    for (const sd of [-1, 1]) {
                        const k = this.spawnEnemy('kropla', e.x - e.fz * sd * .9, e.z + e.fx * sd * .9);
                        k.spawnT = .15;
                    }
                    e.flash = .12;
                    this.v.burst(e.x, 1, e.z, '#ffffff', 6, 4, .12);
                    this.audio.play('spawn');
                }
            } else if (T === 'widmo') {
                // znika i pojawia się tuż obok gracza
                e.cd -= dt;
                if (e.phaseOut > 0) {
                    mul = 0; e.phaseOut -= dt;
                    if (e.phaseOut <= 0) { e.x = e.tx; e.z = e.tz; this.v.ring(e.x, e.z, '#8e8e9a', .3, 2, .3); this.audio.play('teleport'); e.spawnT = .12; }
                } else if (e.cd <= 0 && dist > 3 && e.freezeT <= 0) {
                    e.cd = rand(3.5, 5);
                    for (let tries = 0; tries < 8; tries++) {
                        const a = Math.random() * Math.PI * 2;
                        e.tx = clamp(p.x + Math.cos(a) * 3.6, -ARENA + 1, ARENA - 1); e.tz = clamp(p.z + Math.sin(a) * 3.6, -ARENA + 1, ARENA - 1);
                        if (!this.inObstacle(e.tx, e.tz, .8)) break;
                    }
                    e.phaseOut = .5;
                    this.marks.push({ kind: 'disc', x: e.tx, z: e.tz, r: .9, t: 0, dur: .5, color: '#8e8e9a' });
                    this.v.splat(e.x, e.z, '#b8b8c2', .6, .3);
                }
            } else if (T === 'gabka') {
                // leczy wrogów wokół siebie
                e.cd -= dt;
                if (e.cd <= 0) {
                    e.cd = 1.2;
                    let healed = false;
                    for (const o of this.near(e.x, e.z, 4.5)) {
                        if (o.boss || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.z - e.z) > 4.2) continue;
                        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o === e ? .03 : .07));
                        healed = true;
                    }
                    if (healed) { this.v.ring(e.x, e.z, INK.green, .5, 4.2, .45); this.audio.play('heal'); }
                }
            }
            if (this.stats.slowAura && dist < 3.5) mul *= .75;
            if (this.straggle && T !== 'walec') { mx = nx; mz = nz; }
            e.kx *= Math.exp(-dt * 8); e.kz *= Math.exp(-dt * 8);
            e.x += (mx * e.speed * mul + e.kx) * dt;
            e.z += (mz * e.speed * mul + e.kz) * dt;
            if (T === 'walec') { e.fx = mx; e.fz = mz; } else if (mul > 0) { e.fx = nx; e.fz = nz; }

            // rozpychanie się
            for (const o of this.near(e.x, e.z, 1.8, buf)) {
                if (o === e || o.boss) continue;
                const ox = e.x - o.x, oz = e.z - o.z, d2 = ox * ox + oz * oz, rr = e.r + o.r;
                if (d2 < rr * rr && d2 > 1e-5) {
                    const d = Math.sqrt(d2), push = (rr - d) * .5;
                    const heavyE = T === 'walec', heavyO = o.type === 'walec';
                    const wE = heavyE && !heavyO ? .15 : 1, wO = heavyO && !heavyE ? .15 : 1;
                    e.x += ox / d * push * wE; e.z += oz / d * push * wE;
                    o.x -= ox / d * push * wO; o.z -= oz / d * push * wO;
                }
            }
            e.blocked = null;
            this.collide(e, e.r);
            // Omijanie przeszkody: ślizg wzdłuż ściany (styczna do normalnej odepchnięcia).
            // Kierunek jest "lepki", dopóki wróg nie wyjdzie zza czcionki; bez tego wróg ustawiony
            // dokładnie na linii z graczem drgał w miejscu i blokował koniec fali.
            if (e.blocked && mul > 0) {
                const tx = -e.bnz, tz = e.bnx;
                if (!e.slide) e.slide = Math.sign(tx * nx + tz * nz) || (e.id % 2 ? 1 : -1);
                e.x += tx * e.slide * e.speed * mul * dt; e.z += tz * e.slide * e.speed * mul * dt;
                e.slideT = .6;
            } else if (e.slide && (e.slideT -= dt) <= 0) e.slide = 0;
            // kontakt z graczem
            if (!p.dead && dist < e.r + p.r && e.spawnT <= 0 && T !== 'pecherz' && !(e.phaseOut > 0)) this.hurt(e.dmg, e.x, e.z, e);
        }
        // sprzątanie
        let j = 0;
        for (let i = 0; i < this.enemies.length; i++) if (!this.enemies[i].dead) this.enemies[j++] = this.enemies[i];
        this.enemies.length = j;
    }

    // --- bossowie ---------------------------------------------------------------------------------------------
    updateBoss(e, dt) {
        const p = this.player;
        e.t += dt;
        e.phaseOut = Math.max(0, e.phaseOut - dt);
        const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz) || 1;
        const nx = dx / dist, nz = dz / dist;
        const slow = e.freezeT > 0 ? .3 : 1 - e.slow * .5;
        const enraged = e.hp < e.maxHp * .5;
        const shoot = (a, sp, r = .32) => this.ebullets.push({ id: this.nextId++, x: e.x + Math.cos(a) * e.r, z: e.z + Math.sin(a) * e.r, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, r, dmg: e.dmg * .6, life: 6 });

        if (e.st === 'enter') {
            e.y = Math.max(0, 12 - e.t * 14);
            if (e.y <= 0) {
                e.y = 0; e.st = 'walk'; e.t = 0;
                this.v.shake(1); this.audio.play('slam');
                this.v.ring(e.x, e.z, '#161616', 1, 6, .5);
                this.v.splat(e.x, e.z, '#16161c', 3.5, .7);
            }
            return;
        }
        const face = () => { e.fx = nx; e.fz = nz; };
        const walk = sp => { e.x += nx * sp * slow * dt; e.z += nz * sp * slow * dt; face(); };

        if (e.type === 'rakla') {
            if (e.st === 'walk') {
                walk(e.speed);
                if (e.t > (enraged ? 1.8 : 2.8)) {
                    e.st = 'aim'; e.t = 0;
                    e.cx = nx; e.cz = nz;
                    const len = this.rayLength(e.x, e.z, nx, nz, 34);
                    e.chargeLen = len;
                    this.marks.push({ kind: 'rect', x: e.x + nx * len / 2, z: e.z + nz * len / 2, ry: Math.atan2(nx, nz), w: 4.2, len, t: 0, dur: .95 });
                }
            } else if (e.st === 'aim') {
                e.fx = e.cx; e.fz = e.cz;
                if (e.t > .95) { e.st = 'charge'; e.t = 0; e.sx = e.x; e.sz = e.z; this.audio.play('dash'); }
            } else if (e.st === 'charge') {
                const sp = 24 * slow;
                const px = e.x, pz = e.z;
                e.x += e.cx * sp * dt; e.z += e.cz * sp * dt;
                this.v.paper.stroke(px, pz, e.x, e.z, '#8a8a92', 3.6, .05);
                // gracz na drodze rakli
                const rx = p.x - e.x, rz = p.z - e.z, along = rx * e.cx + rz * e.cz, lat = Math.abs(rx * -e.cz + rz * e.cx);
                if (Math.abs(along) < 1 && lat < 2.3) this.hurt(e.dmg, e.x, e.z);
                for (const o of this.near(e.x, e.z, 3)) if (!o.boss) { o.kx += -e.cz * 10 * Math.sign(( o.x - e.x) * -e.cz + (o.z - e.z) * e.cx || 1); o.kz += e.cx * 10; }
                if (Math.hypot(e.x - e.sx, e.z - e.sz) >= e.chargeLen - 1.5 || this.inObstacle(e.x + e.cx * 1.8, e.z + e.cz * 1.8, 0)) {
                    e.st = 'recover'; e.t = 0; e.n++;
                    this.v.shake(.6); this.audio.play('slam');
                    this.v.burst(e.x, .5, e.z, '#2b2b33', 20, 8, .2, .4);
                }
            } else if (e.st === 'recover') {
                if (e.t > .7) {
                    if (e.n % 2 === 0) { e.st = 'spray'; e.t = 0; e.volley = 0; }
                    else { e.st = 'walk'; e.t = 0; }
                }
            } else if (e.st === 'spray') {
                face();
                if (e.t > .35 * e.volley) {
                    const k = enraged ? 15 : 11, base = Math.atan2(nz, nx);
                    for (let i = 0; i < k; i++) shoot(base + (i / (k - 1) - .5) * 1.8 + (e.volley % 2 ? .08 : 0), 8);
                    this.audio.play('enemyShot');
                    e.volley++;
                    if (e.volley >= 3) { e.st = 'walk'; e.t = 0; }
                }
            }
        } else if (e.type === 'prasa') {
            if (e.st === 'walk') {
                walk(e.speed);
                if (e.t > (enraged ? 1.5 : 2.4)) {
                    e.st = 'rise'; e.t = 0;
                    e.tx = clamp(p.x + p.vx * .5, -ARENA + 2, ARENA - 2); e.tz = clamp(p.z + p.vz * .5, -ARENA + 2, ARENA - 2);
                    e.ox = e.x; e.oz = e.z;
                    this.marks.push({ kind: 'disc', x: e.tx, z: e.tz, r: 3.6, t: 0, dur: 1.1 });
                }
            } else if (e.st === 'rise') {
                const k = Math.min(1, e.t / 1.1);
                e.x = e.ox + (e.tx - e.ox) * k; e.z = e.oz + (e.tz - e.oz) * k;
                e.y = Math.sin(k * Math.PI) * 7;
                e.phaseOut = k > .1 && k < .9 ? .05 : 0;
                if (k >= 1) {
                    e.y = 0; e.st = 'land'; e.t = 0; e.n++;
                    this.v.shake(1); this.audio.play('slam');
                    this.v.ring(e.x, e.z, '#ffd200', 1, 5, .4);
                    this.v.splat(e.x, e.z, '#34383f', 3.4, .5);
                    if (Math.hypot(p.x - e.x, p.z - e.z) < 3.6 + p.r) this.hurt(e.dmg * 1.1, e.x, e.z);
                    const k2 = enraged ? 24 : 18;
                    for (let i = 0; i < k2; i++) shoot(i / k2 * Math.PI * 2 + e.n * .1, 6.5);
                    for (const o of this.near(e.x, e.z, 5)) if (!o.boss) { const d = Math.hypot(o.x - e.x, o.z - e.z) || 1; o.kx += (o.x - e.x) / d * 14; o.kz += (o.z - e.z) / d * 14; }
                    if (e.n % 2 === 0) for (let i = 0; i < 3; i++) this.drops.push({ x: clamp(e.x + rand(-5, 5), -ARENA + 1, ARENA - 1), z: clamp(e.z + rand(-5, 5), -ARENA + 1, ARENA - 1), t: -i * .15, dur: .7, type: 'kleks' });
                }
            } else if (e.st === 'land') {
                if (e.t > (enraged ? .5 : .9)) {
                    // wściekła prasa skacze dwa razy pod rząd
                    e.st = 'walk'; e.t = enraged && e.n % 2 === 1 ? 99 : 0;
                }
            }
        } else if (e.type === 'rozmaz') {
            // krąży wokół gracza w odległości ok. 7
            const want = 7.5, tang = e.id % 2 ? 1 : -1;
            if (e.phaseOut <= 0 && e.st !== 'vanish') {
                const radial = (dist - want) * .8;
                e.x += (nx * radial - nz * tang * 1.4) * e.speed * slow * dt * .6;
                e.z += (nz * radial + nx * tang * 1.4) * e.speed * slow * dt * .6;
            }
            face();
            if (e.st === 'walk') {
                if (e.t > 1.4) { e.st = pick(['spiral', 'burst', 'vanish']); if (e.st === e.last) e.st = 'spiral'; e.last = e.st; e.t = 0; e.a = Math.random() * 6; e.k = 0; }
            } else if (e.st === 'spiral') {
                e.k += dt;
                const every = enraged ? .07 : .095;
                while (e.k > every) {
                    e.k -= every;
                    e.a += .27;
                    const arms = enraged ? 3 : 2;
                    for (let i = 0; i < arms; i++) shoot(e.a + i / arms * Math.PI * 2, 5.6, .28);
                }
                if (e.t > 3.2) { e.st = 'walk'; e.t = 0; }
            } else if (e.st === 'burst') {
                if (e.t > .45 * e.k) {
                    const base = Math.atan2(nz, nx);
                    for (let i = 0; i < 5; i++) shoot(base + (i - 2) * .16, 9.5, .3);
                    this.audio.play('enemyShot');
                    e.k++;
                    if (e.k > (enraged ? 5 : 3)) { e.st = 'walk'; e.t = 0; }
                }
            } else if (e.st === 'vanish') {
                if (e.t < .01) { e.phaseOut = .8; this.v.splat(e.x, e.z, '#16161c', 2, .5); }
                if (e.t > .75 && !e.moved) {
                    e.moved = true;
                    const a = Math.random() * Math.PI * 2;
                    e.x = clamp(p.x + Math.cos(a) * 8, -ARENA + 3, ARENA - 3); e.z = clamp(p.z + Math.sin(a) * 8, -ARENA + 3, ARENA - 3);
                    this.v.ring(e.x, e.z, '#ec008c', .5, 4, .4);
                }
                if (e.t > .85) {
                    const k = enraged ? 28 : 20;
                    for (let i = 0; i < k; i++) shoot(i / k * Math.PI * 2, 6);
                    e.st = 'walk'; e.t = 0; e.moved = false;
                }
            }
        }
        if (e.type === 'ksero') this.updateKsero(e, dt, { nx, nz, dist, slow, enraged, shoot, face, walk });
        if (e.type === 'krajarka') this.updateKrajarka(e, dt, { nx, nz, dist, slow, enraged, shoot, face, walk });
        e.kx *= Math.exp(-dt * 8); e.kz *= Math.exp(-dt * 8);
        this.collide(e, Math.min(e.r, 1.3));
        // kontakt
        if (!p.dead && e.phaseOut <= 0 && (e.y || 0) < 1 && dist < e.r + p.r) this.hurt(e.dmg, e.x, e.z, e);
    }

    // KSERO: wachlarze kartek, obracający się laser skanera, klony
    updateKsero(e, dt, { nx, nz, slow, enraged, shoot, face, walk }) {
        const p = this.player;
        if (e.st === 'walk') {
            walk(e.speed);
            if (e.t > (enraged ? 1.6 : 2.4)) {
                e.n++;
                e.st = e.n % 3 === 0 ? 'clone' : e.n % 3 === 1 ? 'sheets' : 'scanAim';
                e.t = 0; e.k = 0;
                if (e.st === 'scanAim') {
                    e.a = Math.atan2(nz, nx) - 1.1;
                    e.dir = Math.random() < .5 ? 1 : -1;
                    if (e.dir < 0) e.a += 2.2;
                }
            }
        } else if (e.st === 'sheets') {
            face();
            if (e.t > .4 * e.k) {
                const k = enraged ? 11 : 9, base = Math.atan2(nz, nx);
                for (let i = 0; i < k; i++) shoot(base + (i / (k - 1) - .5) * 1.6 + (e.k % 2 ? .09 : 0), 5.5, .45);
                this.audio.play('enemyShot');
                e.k++;
                if (e.k >= 3) { e.st = 'walk'; e.t = 0; }
            }
        } else if (e.st === 'scanAim' || e.st === 'scan') {
            const beams = enraged ? 2 : 1, len = 15;
            if (e.st === 'scan') e.a += e.dir * dt * (enraged ? 1.5 : 1.15);
            for (let b = 0; b < beams; b++) {
                const a = e.a + b * Math.PI, dx = Math.cos(a), dz = Math.sin(a);
                const x2 = e.x + dx * len, z2 = e.z + dz * len;
                if (e.st === 'scanAim') this.lasers.push({ x1: e.x, z1: e.z, x2, z2, width: .08, color: '#ec008c' });
                else {
                    this.lasers.push({ x1: e.x, z1: e.z, x2, z2, width: .5, color: '#ec008c' });
                    const rx = p.x - e.x, rz = p.z - e.z, t = rx * dx + rz * dz;
                    if (t > 0 && t < len && Math.abs(rx * -dz + rz * dx) < .55 + p.r) this.hurt(e.dmg, e.x + dx * t, e.z + dz * t);
                    if (Math.random() < .3) this.v.paper.stroke(e.x, e.z, x2, z2, '#ec008c', .08, .05);
                }
            }
            if (e.st === 'scanAim' && e.t > .9) { e.st = 'scan'; e.t = 0; this.audio.play('laserBoss'); }
            if (e.st === 'scan' && e.t > 3.6) { e.st = 'walk'; e.t = 0; }
        } else if (e.st === 'clone') {
            if (e.t < .01) {
                e.flash = .2;
                const n = enraged ? 3 : 2;
                for (let i = 0; i < n; i++) {
                    const a = i / n * Math.PI * 2 + rand(0, 1);
                    this.drops.push({ x: clamp(e.x + Math.cos(a) * 3.5, -ARENA + 2, ARENA - 2), z: clamp(e.z + Math.sin(a) * 3.5, -ARENA + 2, ARENA - 2), t: -i * .12, dur: .7, type: 'kopiarka' });
                }
                this.v.ring(e.x, e.z, '#ffffff', 1, 5, .5);
                this.audio.play('spawn');
            }
            if (e.t > 1) { e.st = 'walk'; e.t = 0; }
        }
    }

    // KRAJARKA: cięcia przez cały arkusz z ostrzeżeniem, potem szarże
    updateKrajarka(e, dt, { nx, nz, slow, enraged, shoot, face, walk }) {
        const p = this.player;
        if (e.st === 'walk') {
            walk(e.speed);
            e.spin = (e.spin || 0) + dt * 3;
            if (e.t > (enraged ? 1.2 : 1.8)) {
                e.n++;
                e.t = 0;
                if (e.n % 2 === 1) {
                    e.st = 'cuts';
                    e.cuts = [];
                    const k = enraged ? 5 : 3;
                    for (let i = 0; i < k; i++) {
                        const ry = pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
                        const x = i === 0 ? p.x : clamp(p.x + rand(-9, 9), -ARENA + 2, ARENA - 2);
                        const z = i === 0 ? p.z : clamp(p.z + rand(-9, 9), -ARENA + 2, ARENA - 2);
                        const cut = { x, z, ry, len: 70, w: 1.5, delay: i * .18 };
                        e.cuts.push(cut);
                        this.marks.push({ kind: 'rect', x, z, ry, w: 1.5, len: 70, t: -cut.delay, dur: 1.05 + cut.delay, color: '#ff1f5a' });
                    }
                } else { e.st = 'dash'; e.k = 0; }
            }
        } else if (e.st === 'cuts') {
            e.spin += dt * 10;
            for (const c of e.cuts) {
                if (c.done || e.t < 1.05 + c.delay) continue;
                c.done = true;
                const sx = Math.sin(c.ry), cz = Math.cos(c.ry);
                this.v.paper.stroke(c.x - sx * 35, c.z - cz * 35, c.x + sx * 35, c.z + cz * 35, '#2a2c33', .18, .6);
                this.v.beam(c.x - sx * 35, c.z - cz * 35, c.x + sx * 35, c.z + cz * 35, '#ffffff', .5, .18, .4);
                for (let i = 0; i < 8; i++) { const t = rand(-20, 20); this.v.burst(c.x + sx * t, .3, c.z + cz * t, '#c9c9cf', 3, 5, .1); }
                const dx = p.x - c.x, dz = p.z - c.z;
                if (Math.abs(dx * cz - dz * sx) < c.w / 2 + p.r) this.hurt(e.dmg * 1.1, p.x - cz, p.z + sx);
                if (this.settings.shake) this.v.shake(.35);
                this.audio.play('cut');
            }
            if (e.cuts.every(c => c.done) && e.t > 1.5) { e.st = 'walk'; e.t = 0; }
        } else if (e.st === 'dash') {
            e.spin += dt * 14;
            if (!e.dashing) {
                if (e.t > .15) {
                    e.cx = nx; e.cz = nz;
                    e.dashing = true; e.t = 0;
                    const len = this.rayLength(e.x, e.z, nx, nz, 16);
                    e.chargeLen = len;
                    this.marks.push({ kind: 'rect', x: e.x + nx * len / 2, z: e.z + nz * len / 2, ry: Math.atan2(nx, nz), w: 3, len, t: 0, dur: .6 });
                }
            } else if (e.t > .6) {
                const sp = 22 * slow, px = e.x, pz = e.z;
                e.x += e.cx * sp * dt; e.z += e.cz * sp * dt;
                this.v.paper.stroke(px, pz, e.x, e.z, '#8a8a92', 2.2, .06);
                const rx = p.x - e.x, rz = p.z - e.z;
                if (Math.hypot(rx, rz) < e.r + p.r + .4) this.hurt(e.dmg, e.x, e.z, e);
                if (e.t > .6 + e.chargeLen / 22 || this.inObstacle(e.x + e.cx * 1.6, e.z + e.cz * 1.6, 0)) {
                    e.dashing = false; e.k++; e.t = 0;
                    this.audio.play('slam'); this.v.shake(.4);
                    const k = enraged ? 16 : 10;
                    for (let i = 0; i < k; i++) shoot(i / k * Math.PI * 2, 6);
                    if (e.k >= (enraged ? 3 : 2)) { e.st = 'walk'; e.t = 0; }
                }
            }
        }
    }

    // --- pociski ----------------------------------------------------------------------------------------------
    updateBullets(dt) {
        const buf = [];
        const bl = this.bullets;
        for (let i = bl.length - 1; i >= 0; i--) {
            const b = bl[i];
            b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
            let dead = false;
            if (b.kind === 'boomerang') {
                b.t += dt; b.spin += dt * 16;
                if (!b.back && b.t >= b.outT) { b.back = true; b.hit.length = 0; }
                if (b.back) {
                    const p = this.player, dx = p.x - b.x, dz = p.z - b.z, l = Math.hypot(dx, dz) || 1;
                    const k = Math.min(1, dt * 9);
                    b.vx += (dx / l * b.speed * 1.15 - b.vx) * k; b.vz += (dz / l * b.speed * 1.15 - b.vz) * k;
                    if (l < .9) b.life = 0;
                }
            }
            if (b.life <= 0) {
                if (b.kind === 'rocket') this.rocketBoom(b);
                dead = true;
            } else if (b.kind !== 'boomerang' && (Math.abs(b.x) > ARENA || Math.abs(b.z) > ARENA || this.inObstacle(b.x, b.z, 0))) {
                if (b.kind === 'rocket') this.rocketBoom(b);
                else { this.v.splat(b.x - b.vx * dt, b.z - b.vz * dt, b.color === INK.none ? '#8a8a90' : b.color, .18, .5); this.v.burst(b.x, .6, b.z, b.color, 2, 3, .07); }
                dead = true;
            } else {
                for (const e of this.near(b.x, b.z, 2.2, buf)) {
                    if (e.phaseOut > 0 || b.hit.includes(e.id)) continue;
                    const rr = e.r + b.size + .12;
                    if ((e.x - b.x) ** 2 + (e.z - b.z) ** 2 > rr * rr) continue;
                    const sp = Math.hypot(b.vx, b.vz) || 1, kx = b.vx / sp, kz = b.vz / sp;
                    b.hit.push(e.id);
                    // tarcza z przodu
                    if (e.type === 'tarczownik' && -(kx * e.fx + kz * e.fz) > .45) {
                        this.damage(e, b.dmg * .12, { canCrit: false, source: 'bullet' });
                        this.v.burst(b.x, .7, b.z, '#ffffff', 3, 4, .08);
                        this.audio.play('hit');
                        if (b.kind === 'boomerang') continue;
                        dead = true; break;
                    }
                    if (b.kind === 'rocket') { this.rocketBoom(b); dead = true; break; }
                    this.damage(e, b.dmg, { weapon: b.w, knock: b.knock, kx, kz, source: 'bullet' });
                    this.v.burst(b.x, .6, b.z, b.color, 2, 3, .08);
                    if (Math.random() < .5) this.v.splat(e.x + kx * e.r, e.z + kz * e.r, b.color === INK.none ? '#8a8a90' : b.color, .22, .45, kx, kz);
                    if (b.kind === 'boomerang') continue;
                    if (b.flak) this.explode(b.x, b.z, 1.1 * this.stats.area, b.dmg * .4, '#ffffff', { depth: 2 });
                    if (b.pierce > 0) { b.pierce--; continue; }
                    if (b.ric > 0) {
                        b.ric--;
                        const t = this.nearest(b.x, b.z, 8, new Set(b.hit));
                        if (t) { const dx = t.x - b.x, dz = t.z - b.z, l = Math.hypot(dx, dz) || 1; b.vx = dx / l * sp; b.vz = dz / l * sp; b.life = Math.max(b.life, l / sp + .1); continue; }
                    }
                    dead = true; break;
                }
            }
            if (dead) { bl[i] = bl[bl.length - 1]; bl.pop(); }
        }
        // pociski wrogów
        const p = this.player, eb = this.ebullets;
        for (let i = eb.length - 1; i >= 0; i--) {
            const b = eb[i];
            b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
            let dead = b.life <= 0 || Math.abs(b.x) > ARENA || Math.abs(b.z) > ARENA;
            if (!dead && this.inObstacle(b.x, b.z, 0)) { dead = true; this.v.splat(b.x, b.z, '#ec008c', .25, .45); }
            if (!dead && p && !p.dead && (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < (b.r + p.r * .75) ** 2) {
                if (p.iframes <= 0) { this.hurt(b.dmg, b.x - b.vx, b.z - b.vz); dead = true; }
            }
            if (dead) { eb[i] = eb[eb.length - 1]; eb.pop(); }
        }
    }
    rocketBoom(b) {
        const r = b.radius || 2.4;
        this.explode(b.x, b.z, r, b.dmg, b.color === INK.none ? '#2b2b33' : b.color, { weapon: b.w });
        // tusz rakiety działa na wszystkich w wybuchu
        if (b.w && b.w.mix.id !== 'none') for (const e of this.near(b.x, b.z, r + 1)) if (Math.hypot(e.x - b.x, e.z - b.z) < r + e.r) this.applyInk(e, b.dmg, b.w, 1);
        if (b.cluster) for (let i = 0; i < 4; i++) {
            const a = i / 4 * Math.PI * 2 + rand(-.3, .3), d = rand(1.6, 2.6);
            this.timers.push({ t: .15 + i * .05, fn: () => this.explode(b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, r * .6, b.dmg * .45, '#2b2b33', { depth: 2 }) });
        }
    }

    // --- strefy, znaczniki, zrzuty, krople, timery -------------------------------------------------------------
    updateZones(dt) {
        const buf = [];
        for (let i = this.zones.length - 1; i >= 0; i--) {
            const z = this.zones[i];
            z.t += dt; z.life -= dt; z.tick -= dt;
            if (z.life <= 0) { this.zones.splice(i, 1); continue; }
            const tick = z.tick <= 0;
            if (tick) z.tick = .25;
            for (const e of this.near(z.x, z.z, z.r + 1.5, buf)) {
                const dx = z.x - e.x, dz = z.z - e.z, d = Math.hypot(dx, dz);
                if (d > z.r + e.r) continue;
                if (z.pull && !e.boss && d > .3) { e.kx += dx / d * z.pull * dt * 6; e.kz += dz / d * z.pull * dt * 6; }
                if (z.poison) e.poisonT = Math.max(e.poisonT, .6);
                if (z.burn) { e.burnT = Math.max(e.burnT, 1); e.burnDps = Math.max(e.burnDps, z.dps * .5); }
                if (tick) this.damage(e, z.dps * .25, { source: 'dot', canCrit: false, color: z.color });
            }
            if (z.kind === 'vortex' && Math.random() < .5) this.v.burst(z.x + rand(-z.r, z.r), .3, z.z + rand(-z.r, z.r), z.color, 1, 1, .1);
        }
    }
    updateMarks(dt) {
        for (let i = this.marks.length - 1; i >= 0; i--) { const m = this.marks[i]; m.t += dt; if (m.t >= m.dur) this.marks.splice(i, 1); }
    }
    updateDrops(dt) {
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.t += dt;
            if (d.t < d.dur) continue;
            this.drops.splice(i, 1);
            const e = this.spawnEnemy(d.type, d.x, d.z, d.elite);
            this.v.splat(d.x, d.z, ENEMIES[d.type].color === '#f2c200' ? '#f2c200' : '#8a8a92', e.r * 1.3, .35);
            this.v.burst(d.x, .3, d.z, ENEMIES[d.type].color, 4, 4, .1);
            this.audio.play('spawn');
        }
    }
    updatePickups(dt) {
        const p = this.player, s = this.stats, vac = this.vacuum > 0;
        this.vacuum -= dt;
        this.pickupStreakT -= dt;
        if (this.pickupStreakT <= 0) this.pickupStreak = 0;
        const pk = this.pickups;
        for (let i = pk.length - 1; i >= 0; i--) {
            const d = pk[i];
            d.x += d.vx * dt; d.z += d.vz * dt;
            const dx = p.x - d.x, dz = p.z - d.z, dist = Math.hypot(dx, dz) || 1;
            if (vac || dist < s.magnet) {
                const sp = vac ? 26 : 16;
                const k = 1 - Math.exp(-dt * 10);
                d.vx += (dx / dist * sp - d.vx) * k; d.vz += (dz / dist * sp - d.vz) * k;
            } else { d.vx *= Math.exp(-dt * 5); d.vz *= Math.exp(-dt * 5); }
            if (dist < p.r + .4) {
                if (d.heart) { this.heal(25); this.v.number(p.x, p.z, 25, false, '#ff2d55'); this.audio.play('buy'); }
                else {
                    this.xp += d.value;
                    this.money += d.value * s.income;
                    this.pickupStreak++; this.pickupStreakT = .6;
                    this.audio.play('pickup', this.pickupStreak);
                    while (this.xp >= this.xpNext) { this.xp -= this.xpNext; this.level++; this.xpNext = xpForLevel(this.level); this.pendingLevels++; }
                }
                pk[i] = pk[pk.length - 1]; pk.pop();
            }
        }
    }
    updateTimers(dt) {
        for (let i = this.timers.length - 1; i >= 0; i--) {
            const t = this.timers[i];
            t.t -= dt;
            if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
        }
    }

    updateWave(dt) {
        if (this.bossPending > 0) { this.bossPending -= dt; if (this.bossPending <= 0) this.spawnBoss(); }
        if (this.spawned < this.quota) {
            this.spawnTimer -= dt;
            const cap = aliveCap(this.wave, this.v.quality === 'low');
            if (this.spawnTimer <= 0 && this.enemies.length + this.drops.length < cap) {
                const before = this.spawned;
                this.spawnGroup();
                this.spawnTimer = this.interval * Math.max(1, this.spawned - before);
            }
        } else if (this.waveClearT === -1 && this.enemies.length === 0 && this.drops.length === 0 && this.bossPending <= 0) {
            // fala czysta: bonus, krople lecą do gracza, potem sklep
            this.waveClearT = 0;
            const bonus = 100 * this.wave * (this.waveNoHit ? 2 : 1);
            this.score += bonus;
            this.vacuum = 3;
            this.audio.play('wave');
            this.hooks.waveClear?.(this.wave, bonus, this.waveNoHit);
        }
        if (this.waveClearT >= 0) {
            this.waveClearT += dt;
            if ((this.waveClearT > 1.3 && this.pickups.every(d => d.heart)) || this.waveClearT > 3.5) {
                this.waveClearT = -99;
                this.pickups.length = 0;
                this.state = 'shop';
                this.audio.muffle(true);
                this.hooks.shop();
            }
        }
    }

    summary() {
        return {
            score: Math.round(this.score), wave: this.wave, kills: this.kills, time: Math.round(this.time),
            level: this.level, bestCombo: this.bestCombo, build: this.buildString(), bosses: this.bossesKilled,
        };
    }

    // --- tło menu: kleksy wędrują po arkuszu -----------------------------------------------------------------
    updateDemo(dt) {
        this.demoT += dt;
        if (!this.demoInit) {
            this.demoInit = true;
            this.clearWorld();
            for (let i = 0; i < 16; i++) {
                const e = this.spawnEnemy(pick(['kleks', 'kleks', 'smuga', 'plujka', 'walec', 'pecherz', 'dzielnik']), rand(-20, 20), rand(-20, 20), false, 1);
                e.spawnT = 0; e.tx = rand(-22, 22); e.tz = rand(-22, 22);
            }
            for (let i = 0; i < 26; i++) this.v.splat(rand(-24, 24), rand(-24, 24), pick([INK.C, INK.M, INK.Y, '#77777f']), rand(.6, 2.6), rand(.25, .55));
        }
        for (const e of this.enemies) {
            const dx = e.tx - e.x, dz = e.tz - e.z, d = Math.hypot(dx, dz);
            if (d < 1) { e.tx = rand(-22, 22); e.tz = rand(-22, 22); continue; }
            const sp = Math.min(e.speed, 3) * .6;
            e.x += dx / d * sp * dt; e.z += dz / d * sp * dt;
            e.fx = dx / d; e.fz = dz / d;
            if (e.type === 'walec') { e.heading = Math.atan2(e.fx, e.fz); e.roll += sp * dt / .9; }
            e.blocked = null; this.collide(e, e.r);
            if (e.blocked) { e.tx = rand(-22, 22); e.tz = rand(-22, 22); }
        }
        if (Math.random() < dt * .7) {
            const e = pick(this.enemies);
            this.v.splat(e.x, e.z, pick([INK.C, INK.M, INK.Y]), rand(.5, 1.4), .45);
            this.v.burst(e.x, .6, e.z, pick([INK.C, INK.M, INK.Y]), 5, 4, .12);
        }
        const t = this.demoT * .06;
        this.v.follow(Math.cos(t) * 10, Math.sin(t * 1.3) * 8, dt);
    }
    toMenu() {
        this.state = 'menu';
        this.demoInit = false;
        this.player = null;
        this.boss = null;
        this.v.paper.reset();
        this.audio.intensity = 0;
        this.audio.muffle(false);
    }
}

export { RARITY };
