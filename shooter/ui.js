/* ==========================================================================
   OVERPRINT: interfejs (DOM)
   Ekrany: menu, HUD, karty poziomu, wybór slotu tuszu, sklep, pauza,
   instrukcja, ranking, koniec gry. Stan strony trzyma klasa body.state-*.
   ========================================================================== */

import { WEAPONS, RARITY, MIXES, mixKey, INK, PRICES, levelText, iconURL, MAX_WEAPONS, INK_SLOTS } from './data.js?v=20260928c';

const $ = id => document.getElementById(id);
const icons = new Map();
const icon = (name, color = '#161616', accent = '#00aeef') => {
    const k = name + color + accent;
    if (!icons.has(k)) icons.set(k, iconURL(name, color, accent));
    return icons.get(k);
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.floor(n).toLocaleString('pl-PL');
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const INK_HEX = { C: INK.C, M: INK.M, Y: INK.Y };
const SCREENS = ['menu', 'levelup', 'inkpick', 'shop', 'pause', 'help', 'board', 'over'];

// Komentarze oka do kart (co karta naprawdę robi w grze, własnymi słowami).
const CARD_EYE = {
    stat: 'Karta na stałe zmienia statystyki postaci do końca przebiegu.',
    upgrade: 'Ulepszenie broni, którą już masz. Poziom 5 to ewolucja.',
    weapon: 'Nowa broń w wolnym slocie. Strzela razem z pozostałymi.',
    ink: 'Darmowy tusz. Po wyborze wskażesz broń i slot.',
};

export class UI {
    constructor(game, view, audio, input, board) {
        this.g = game; this.v = view; this.audio = audio; this.input = input; this.board = board;
        this.state = 'menu';
        this.hudCache = {};
        this.best = 0;
        try { this.best = +localStorage.getItem('overprint-best') || 0; } catch { /* ok */ }
        $('best').querySelector('strong').textContent = fmt(this.best);
        try { $('name').value = localStorage.getItem('overprint-name') || ''; } catch { /* ok */ }
        document.body.classList.toggle('touch', input.touch);
        // po wejściu płyty "łapią pasery", potem tylko lekko pływają
        setTimeout(() => $('logo').classList.add('loop'), 1900);
        this.bind();
    }

    // --- stan ekranu -------------------------------------------------------------------------------------
    setState(s) {
        this.state = s;
        const b = document.body;
        b.className = b.className.replace(/\bstate-\S+/g, '').trim() + ' state-' + s;
        b.classList.toggle('touch', this.input.touch);
        for (const id of SCREENS) $(id).classList.toggle('on', id === s || (s === 'settings' && id === 'pause'));
        const fighting = s === 'play' || s === 'dying';
        this.input.enabled = fighting;
        // klawisze wciśnięte na kartach czy w sklepie nie mogą odpalić dasha ani pauzy po powrocie
        this.input.clearEdges();
        if (!fighting) this.input.release();
        // Oko komentuje tylko spokojne ekrany; w walce, kartach, sklepie i na końcu gry
        // jest za gęsto, żeby zaparkowało obok treści, więc się chowa.
        const eye = s === 'menu' || s === 'help' || s === 'board' || s === 'pause';
        dispatchEvent(new Event(eye ? 'observer:resume' : 'observer:suspend'));
    }

    bind() {
        const g = this.g, a = this.audio;
        const click = (id, fn) => $(id).addEventListener('click', e => { a.play('click'); fn(e); });
        click('btn-play', () => this.startRun());
        click('btn-again', () => this.startRun());
        click('btn-help', () => this.setState('help'));
        click('btn-help-close', () => this.setState('menu'));
        click('btn-board', () => { this.setState('board'); this.loadBoard('board', 'all'); });
        click('btn-board-close', () => this.setState('menu'));
        click('btn-settings', () => this.openSettings(true));
        click('btn-settings-close', () => this.closePause());
        click('btn-pause', () => this.pause());
        click('btn-resume', () => this.closePause());
        click('btn-restart', () => this.startRun());
        click('btn-quit', () => this.toMenu());
        click('btn-menu', () => this.toMenu());
        click('btn-next', () => this.nextWave());
        click('btn-reroll', () => this.reroll());
        click('btn-heal', () => this.buyHeal());
        click('btn-download', () => this.download());
        click('ink-cancel', () => this.inkCancel?.());
        click('menu-sound', () => {
            const on = a.volume.master > 0;
            a.setVolume('master', on ? 0 : .8);
            $('menu-sound').textContent = on ? 'Dźwięk: wył.' : 'Dźwięk: wł.';
        });
        $('menu-sound').textContent = a.volume.master > 0 ? 'Dźwięk: wł.' : 'Dźwięk: wył.';

        // przyciski dotykowe
        const hold = (id, edge) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.input.edges.add(edge); });
        hold('btn-dash', 'dash');
        hold('btn-ult', 'ult');

        // ustawienia
        $('vol-music').value = a.volume.music;
        $('vol-sfx').value = a.volume.sfx;
        $('vol-music').addEventListener('input', e => a.setVolume('music', +e.target.value));
        $('vol-sfx').addEventListener('input', e => { a.setVolume('sfx', +e.target.value); a.play('pickup', 4); });
        $('quality').addEventListener('click', e => {
            const q = e.target.closest('button')?.dataset.q;
            if (!q) return;
            this.v.setQuality(q);
            this.userQuality = true;
            this.syncSettings();
        });
        const toggle = (id, key) => $(id).addEventListener('click', () => { g.settings[key] = !g.settings[key]; g.saveSettings(); this.syncSettings(); });
        toggle('opt-numbers', 'numbers');
        toggle('opt-shake', 'shake');
        this.syncSettings();

        // zakładki rankingu
        document.querySelectorAll('.tabs').forEach(t => t.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            t.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
            this.loadBoard(t.dataset.board, b.dataset.period);
        }));

        $('save-form').addEventListener('submit', e => { e.preventDefault(); this.save(); });

        addEventListener('keydown', e => {
            if (e.target instanceof HTMLInputElement) return;
            const s = this.state;
            if (e.code === 'Enter' || e.code === 'NumpadEnter') {
                if (s === 'menu') this.startRun();
                else if (s === 'shop') this.nextWave();
            }
            if (s === 'levelup' && /^Digit[123]$/.test(e.code)) this.pickCard(+e.code.slice(5) - 1);
            if (s === 'over' && e.code === 'KeyR') this.startRun();
            if (e.code === 'Escape') {
                if (s === 'pause') this.closePause();
                else if (s === 'help' || s === 'board') this.setState('menu');
                else if (s === 'inkpick') this.inkCancel?.();
            }
        });
        document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
        addEventListener('blur', () => { if (this.state === 'play' && !this.input.touch) this.pause(); });
    }

    syncSettings() {
        const g = this.g;
        $('opt-numbers').classList.toggle('on', g.settings.numbers);
        $('opt-shake').classList.toggle('on', g.settings.shake);
        $('quality').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.q === this.v.quality));
    }

    // --- przebieg --------------------------------------------------------------------------------------------
    startRun() {
        this.audio.unlock();
        this.audio.startMusic();
        this.board.startRun();
        this.saved = false;
        this.hudCache = {};
        $('toast').innerHTML = '';
        $('bossbar').classList.remove('on');
        this.g.start();
        this.setState('play');
        if (this.input.touch) {
            document.body.classList.add('first-run');
            setTimeout(() => document.body.classList.remove('first-run'), 6000);
        }
    }
    toMenu() {
        this.g.toMenu();
        this.setState('menu');
        $('bossbar').classList.remove('on');
    }
    pause() {
        if (this.state !== 'play') return;
        this.g.state = 'pause';
        this.audio.muffle(true);
        this.openSettings(false);
    }
    openSettings(fromMenu) {
        this.settingsFromMenu = fromMenu;
        $('pause-actions').style.display = fromMenu ? 'none' : '';
        $('pause-title').textContent = fromMenu ? 'Ustawienia' : 'Pauza';
        $('btn-settings-close').style.display = fromMenu ? '' : 'none';
        this.syncSettings();
        this.setState('pause');
    }
    closePause() {
        if (this.settingsFromMenu) { this.setState('menu'); return; }
        this.g.state = 'play';
        this.audio.muffle(false);
        this.setState('play');
    }

    // --- hooki gry --------------------------------------------------------------------------------------------
    hooks() {
        return {
            wave: (n, boss) => this.toast(boss ? `Fala ${n} · boss` : `Fala ${n}`, '', true),
            boss: e => {
                $('boss-name').textContent = e.name;
                $('boss-title').textContent = e.title;
                $('bossbar').classList.add('on');
                this.toast(e.name, 'light');
            },
            bossDead: e => { $('bossbar').classList.remove('on'); this.toast(`${e.name} zniszczona`, 'small light'); },
            waveClear: (n, bonus, clean) => this.toast(clean ? `Czysta odbitka +${fmt(bonus)}` : `Fala ${n} zaliczona +${fmt(bonus)}`, 'small light'),
            toast: (t) => this.toast(t, 'small light'),
            levelUp: cards => this.openLevelUp(cards),
            shop: () => this.openShop(),
            pause: () => this.pause(),
            over: s => this.openOver(s),
        };
    }

    toast(text, cls = '', big = false) {
        const box = $('toast');
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.textContent = text;
        box.appendChild(el);
        while (box.children.length > 3) box.firstChild.remove();
        setTimeout(() => el.remove(), 2300);
        if (big) this.audio.play('wave');
    }

    // --- karty poziomu ----------------------------------------------------------------------------------------
    openLevelUp(cards) {
        this.cards = cards;
        $('lv-title').textContent = `Poziom ${this.g.level - this.g.pendingLevels + 1}`;
        const box = $('cards');
        box.innerHTML = '';
        cards.forEach((c, i) => {
            const r = RARITY[c.rarity];
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `card r${c.rarity}`;
            b.dataset.eyeTitle = c.name;
            b.dataset.eye = CARD_EYE[c.kind];
            const accent = c.kind === 'ink' ? INK_HEX[c.color] : c.rarity === 2 ? '#ec008c' : c.rarity === 1 ? '#00aeef' : '#8a8a90';
            b.innerHTML = `
                <div class="card-art"><span class="num">${i + 1}</span><img alt="" src="${icon(c.icon, c.kind === 'ink' ? INK_HEX[c.color] : '#161616', accent)}"></div>
                <div class="card-body">
                    <span class="rarity" style="color:${r.color}">${c.kind === 'upgrade' ? 'Ulepszenie' : c.kind === 'weapon' ? 'Broń' : c.kind === 'ink' ? 'Tusz' : r.name}</span>
                    <h3>${esc(c.name)}</h3>
                    <p>${esc(c.desc)}</p>
                </div>`;
            b.addEventListener('click', () => this.pickCard(i));
            box.appendChild(b);
        });
        this.setState('levelup');
        this.cardLock = performance.now() + 350; // chroni przed przypadkowym kliknięciem w trakcie strzelania
    }
    pickCard(i) {
        const c = this.cards?.[i];
        if (!c || performance.now() < this.cardLock) return;
        this.audio.play('buy');
        if (c.kind === 'ink') {
            this.openInkPicker(c.color, false, placed => { this.afterCard(); });
            return;
        }
        this.g.applyCard(c);
        this.afterCard();
    }
    afterCard() {
        this.cards = null;
        this.g.levelDone();
        if (this.g.state === 'play') this.setState('play');
    }

    // --- wybór slotu dla tuszu ----------------------------------------------------------------------------------
    openInkPicker(color, cancelable, done) {
        const g = this.g, prev = this.state;
        $('ink-title').innerHTML = `<span class="ink-swatch" style="background:${INK_HEX[color]}"></span>Tusz ${color}`;
        $('ink-hint').textContent = 'Kliknij pusty slot albo podmień tusz. Dwa różne tusze w jednej broni mieszają się w nowy efekt.';
        const list = $('ink-list');
        list.innerHTML = '';
        g.weapons.forEach((w, i) => {
            const row = document.createElement('div');
            row.className = 'ink-row panel';
            row.dataset.eyeTitle = WEAPONS[w.id].name;
            row.dataset.eye = 'Obok slotów widzisz, jaki efekt da mieszanka po włożeniu tego tuszu.';
            const slots = [];
            for (let s = 0; s < INK_SLOTS; s++) {
                const cur = w.inks[s];
                const next = [...w.inks]; next[s] = color;
                const mix = MIXES[mixKey(next.filter(Boolean))];
                slots.push(`<button type="button" class="slot ${cur ? 'filled' : ''}" data-s="${s}" style="${cur ? `background:${INK_HEX[cur]}` : ''}" title="${esc(mix.name)}" aria-label="Slot ${s + 1}: ${cur ? 'podmień ' + cur : 'pusty'}, efekt: ${esc(mix.name)}">${cur || '+'}</button>`);
            }
            const after = MIXES[mixKey([...w.inks.filter(Boolean).slice(0, w.inks.length >= INK_SLOTS ? 1 : 2), color])];
            row.innerHTML = `<img alt="" src="${icon(WEAPONS[w.id].icon, '#ffffff', w.mix.color)}"><div><div class="nm">${WEAPONS[w.id].name}</div><div class="mx">Teraz: ${esc(w.mix.name)} · po: ${esc(after.name)}</div></div><div class="slots">${slots.join('')}</div>`;
            row.querySelectorAll('.slot').forEach(b => b.addEventListener('click', () => {
                g.setInk(i, +b.dataset.s, color);
                this.audio.play('buy');
                done(true);
            }));
            list.appendChild(row);
        });
        $('ink-cancel').textContent = cancelable ? 'Anuluj' : 'Pomiń tusz';
        this.inkCancel = () => {
            this.inkCancel = null;
            if (cancelable) { this.setState(prev); if (prev === 'shop') this.renderShop(); }
            else done(false);
        };
        this.setState('inkpick');
    }

    // --- sklep ---------------------------------------------------------------------------------------------------
    openShop() {
        const g = this.g;
        g.rerolls = 0;
        this.offers = g.rollShop();
        $('shop-sub').textContent = `Fala ${g.wave} zaliczona${g.waveNoHit ? ' · czysta odbitka' : ''}`;
        $('shop-title').textContent = (g.wave + 1) % 5 === 0 ? 'Przed bossem' : 'Przerwa w druku';
        this.setState('shop');
        this.renderShop();
    }
    renderShop() {
        const g = this.g, w = g.wave;
        $('shop-money').textContent = fmt(g.money);
        // bronie gracza
        const box = $('shop-weapons');
        box.innerHTML = '';
        g.weapons.forEach((wp, i) => {
            const d = WEAPONS[wp.id];
            const price = PRICES.upgrade(wp.level, w);
            const el = document.createElement('div');
            el.className = 'wcard';
            el.dataset.eyeTitle = `${d.name}, poziom ${wp.level}`;
            el.dataset.eye = wp.level < 5 ? `Następny poziom: ${levelText(wp.id, wp.level + 1)}` : `Ewolucja ${d.evo}: ${d.evoText}`;
            const slots = Array.from({ length: INK_SLOTS }, (_, s) => {
                const c = wp.inks[s];
                return `<span class="slot ${c ? 'filled' : ''}" style="${c ? `background:${INK_HEX[c]}` : ''}">${c || ''}</span>`;
            }).join('');
            el.innerHTML = `
                <img alt="" src="${icon(d.icon, '#161616', wp.mix.id === 'none' ? '#8a8a90' : wp.mix.color)}">
                <div>
                    <div class="top"><span class="nm">${d.name}</span><span class="pips ${wp.level >= 5 ? 'evo' : ''}">${[1, 2, 3, 4, 5].map(l => `<i class="${l <= wp.level ? 'on' : ''}"></i>`).join('')}</span></div>
                    <div class="meta">${wp.level >= 5 ? `Ewolucja: ${d.evo}` : levelText(wp.id, wp.level + 1)}<br>Tusz: ${esc(wp.mix.name)}</div>
                    <div class="acts">
                        ${wp.level < 5 ? `<button class="btn small" data-up="${i}" type="button" ${g.canAfford(price) ? '' : 'disabled'}>Ulepsz <span class="price">${price}</span></button>` : ''}
                        ${g.weapons.length > 1 ? `<button class="btn small" data-sell="${i}" type="button">Sprzedaj +${Math.floor(wp.spent * .4 + 5)}</button>` : ''}
                        <span class="slots">${slots}</span>
                    </div>
                </div>`;
            box.appendChild(el);
        });
        for (let i = g.weapons.length; i < MAX_WEAPONS; i++) {
            const el = document.createElement('div');
            el.className = 'wcard';
            el.style.opacity = '.45';
            el.innerHTML = `<img alt="" src="${icon('ink', '#bdbdbd', '#bdbdbd')}"><div><div class="nm">Wolny slot</div><div class="meta">Kup broń z oferty obok.</div></div>`;
            box.appendChild(el);
        }
        box.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => {
            const i = +b.dataset.up, price = PRICES.upgrade(g.weapons[i].level, w);
            if (!g.canAfford(price)) return this.audio.play('deny');
            g.pay(price); g.weapons[i].spent += price;
            g.upgradeWeapon(i);
            this.audio.play('buy');
            this.renderShop();
        }));
        box.querySelectorAll('[data-sell]').forEach(b => b.addEventListener('click', () => {
            g.sellWeapon(+b.dataset.sell);
            this.audio.play('buy');
            this.renderShop();
        }));

        // oferta
        const ob = $('offers');
        ob.innerHTML = '';
        this.offers.forEach((o, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            const blocked = o.kind === 'weapon' && g.weapons.length >= MAX_WEAPONS;
            b.className = 'offer' + (o.sold ? ' sold' : '') + (!g.canAfford(o.price) ? ' poor' : '');
            b.dataset.eyeTitle = `${o.name}: ${o.price} ml`;
            b.dataset.eye = o.kind === 'weapon' ? (blocked ? 'Masz już cztery bronie. Sprzedaj jedną, żeby zrobić miejsce.' : o.desc) : o.kind === 'ink' ? 'Po zakupie wskażesz broń i slot. Tusz działa przy każdym trafieniu tej broni.' : o.desc;
            const kind = { weapon: 'Broń', ink: 'Tusz', stat: 'Ulepszenie', maxhp: 'Zdrowie' }[o.kind];
            const col = o.kind === 'ink' ? INK_HEX[o.color] : '#161616';
            b.innerHTML = `
                <div class="o-top"><img alt="" src="${icon(o.icon, col, o.kind === 'ink' ? col : '#00aeef')}"><div><div class="kind">${kind}</div><div class="nm">${esc(o.name)}</div></div></div>
                <p>${esc(blocked ? 'Brak wolnego slotu. ' + o.desc : o.desc)}</p>
                <span class="price">${o.sold ? 'Kupione' : o.price}</span>`;
            if (blocked && !o.sold) b.style.opacity = '.5';
            b.addEventListener('click', () => this.buyOffer(i));
            ob.appendChild(b);
        });
        const heal = PRICES.heal(w);
        const full = g.player.hp >= g.stats.maxHp - .5;
        $('btn-heal').innerHTML = full ? 'Zdrowie pełne' : `Apteczka +40% <span class="price">${heal}</span>`;
        $('btn-heal').disabled = full || !g.canAfford(heal);
        const rr = PRICES.reroll(g.rerolls);
        $('btn-reroll').innerHTML = `Losuj <span class="price">${rr}</span>`;
        $('btn-reroll').disabled = !g.canAfford(rr);

        const s = g.stats;
        const pct = v => `${Math.round(v * 100)}%`;
        $('statline').innerHTML = [
            ['Zdrowie', `${Math.ceil(g.player.hp)}/${s.maxHp}`], ['Obrażenia', pct(s.dmg)], ['Szybkostrz.', pct(s.rate)],
            ['Kryt.', `${Math.round(s.crit * 100)}% ×${s.critMult.toFixed(1)}`], ['Pancerz', s.armor], ['Ruch', pct(s.speed)],
            ['Pociski', `+${s.projectiles}`], ['Przebicie', `+${s.pierce}`],
        ].map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
    }
    buyOffer(i) {
        const g = this.g, o = this.offers[i];
        if (!o || o.sold) return;
        if (!g.canAfford(o.price)) return this.audio.play('deny');
        if (o.kind === 'weapon' && g.weapons.length >= MAX_WEAPONS) return this.audio.play('deny');
        if (o.kind === 'ink') {
            this.openInkPicker(o.color, true, () => {
                g.pay(o.price);
                o.sold = true;
                this.inkCancel = null;
                this.setState('shop');
                this.renderShop();
            });
            return;
        }
        if (g.buyOffer(o)) { o.sold = true; this.audio.play('buy'); }
        this.renderShop();
    }
    buyHeal() {
        const g = this.g, p = PRICES.heal(g.wave);
        if (!g.canAfford(p)) return this.audio.play('deny');
        g.pay(p);
        g.heal(g.stats.maxHp * .4);
        this.audio.play('buy');
        this.renderShop();
    }
    reroll() {
        const g = this.g, p = PRICES.reroll(g.rerolls);
        if (!g.canAfford(p)) return this.audio.play('deny');
        g.pay(p);
        g.rerolls++;
        this.offers = g.rollShop();
        this.audio.play('buy');
        this.renderShop();
    }
    nextWave() {
        if (this.state !== 'shop') return;
        this.g.nextWave();
        this.setState('play');
    }

    // --- koniec gry ---------------------------------------------------------------------------------------------
    openOver(s) {
        this.summary = s;
        const newBest = s.score > this.best;
        if (newBest) { this.best = s.score; try { localStorage.setItem('overprint-best', s.score); } catch { /* ok */ } $('best').querySelector('strong').textContent = fmt(s.score); }
        $('over-title').textContent = newBest && s.score > 0 ? `Nowy rekord · fala ${s.wave}` : `Fala ${s.wave}`;
        $('final-score').textContent = fmt(s.score);
        $('over-stats').innerHTML = [
            ['Zabójstwa', fmt(s.kills)], ['Czas', fmtTime(s.time)], ['Poziom', s.level],
            ['Max combo', s.bestCombo], ['Bossowie', s.bosses], ['Fala', s.wave],
        ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
        $('over-build').textContent = s.build;
        this.print = this.v.exportPrint(`Wynik ${fmt(s.score)} · fala ${s.wave} · ${fmt(s.kills)} zabójstw · ${fmtTime(s.time)}`);
        $('print-img').src = this.print.toDataURL('image/jpeg', .85);
        $('save-msg').textContent = '';
        $('save-msg').className = 'save-msg';
        $('btn-save').disabled = false;
        $('name').disabled = false;
        this.myId = null;
        this.setState('over');
        this.audio.muffle(true);
        document.querySelector('[data-board="over"] button[data-period="all"]').click();
        if (!this.input.touch) setTimeout(() => $('name').focus(), 300);
    }
    async save() {
        if (this.saved) return;
        const name = $('name').value.trim().replace(/\s+/g, ' ');
        const msg = $('save-msg');
        if (!/^[\p{L}\p{N} _\-.!?]{2,16}$/u.test(name)) {
            msg.textContent = 'Nick: 2–16 znaków (litery, cyfry, spacja, _ - . ! ?).';
            msg.className = 'save-msg err';
            return;
        }
        try { localStorage.setItem('overprint-name', name); } catch { /* ok */ }
        $('btn-save').disabled = true;
        msg.textContent = 'Zapisuję…'; msg.className = 'save-msg';
        const r = await this.board.submit(name, this.summary);
        if (r.error) {
            msg.textContent = r.error; msg.className = 'save-msg err';
            $('btn-save').disabled = false;
            return;
        }
        this.saved = true;
        this.myId = r.id;
        $('name').disabled = true;
        msg.className = 'save-msg ok';
        msg.textContent = r.online
            ? `Zapisane! Miejsce ${r.rank} w rankingu${r.rankWeek ? `, ${r.rankWeek} w tym tygodniu` : ''}.`
            : `Zapisane na tym urządzeniu (miejsce ${r.rank}). Ranking online jest teraz niedostępny.`;
        this.audio.play('levelup');
        const tab = document.querySelector('[data-board="over"] button.on');
        this.loadBoard('over', tab?.dataset.period || 'all');
    }
    download() {
        if (!this.print) return;
        this.print.toBlob(b => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = `overprint-${this.summary.score}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }, 'image/png');
    }

    async loadBoard(where, period) {
        const list = $(where === 'board' ? 'board-list' : 'over-list');
        const note = $(where === 'board' ? 'board-note' : 'over-note');
        list.innerHTML = '<li class="empty">Ładuję…</li>';
        const r = await this.board.top(period);
        note.textContent = r.online ? '' : 'Ranking online niedostępny, pokazuję wyniki z tego urządzenia.';
        if (!r.entries.length) { list.innerHTML = '<li class="empty">Jeszcze nikt tu nie jest. Bądź pierwszy.</li>'; return; }
        list.innerHTML = r.entries.map((e, i) => `
            <li class="${e.id === this.myId ? 'me' : ''}">
                <span class="rk">${i + 1}</span>
                <span class="who"><b>${esc(e.name)}</b><span>${esc(e.build || '')}</span></span>
                <span class="pts">${fmt(e.score)}<small>fala ${e.wave} · ${fmtTime(e.time || 0)}</small></span>
            </li>`).join('');
        list.querySelector('.me')?.scrollIntoView({ block: 'nearest' });
    }

    // --- HUD (co klatkę, zapis do DOM tylko przy zmianie) ------------------------------------------------------------
    set(key, el, prop, val) {
        if (this.hudCache[key] === val) return;
        this.hudCache[key] = val;
        if (prop === 'text') el.textContent = val;
        else if (prop === 'html') el.innerHTML = val;
        else el.style[prop] = val;
    }
    hud() {
        const g = this.g, p = g.player;
        if (!p) return;
        const s = g.stats;
        const q = document.querySelector.bind(document);
        this.set('hp', $('hp-bar').lastElementChild, 'transform', `scaleX(${Math.max(0, p.hp / s.maxHp).toFixed(3)})`);
        this.set('hpT', $('hp-text'), 'text', `${Math.ceil(Math.max(0, p.hp))} / ${s.maxHp}`);
        if (this.hudCache.maxHp !== s.maxHp) { this.hudCache.maxHp = s.maxHp; const segHp = 20 * Math.ceil(s.maxHp / 300); $('hp-bar').style.setProperty('--seg', `${(segHp * 100 / s.maxHp).toFixed(2)}%`); }
        // opóźniony pasek utraconego zdrowia
        this.lag = Math.max(p.hp / s.maxHp, (this.lag ?? 1) - .008);
        this.set('hpLag', $('hp-bar').firstElementChild, 'transform', `scaleX(${this.lag.toFixed(3)})`);
        this.set('xp', $('xp-bar').firstElementChild, 'transform', `scaleX(${Math.min(1, g.xp / g.xpNext).toFixed(3)})`);
        this.set('lvl', $('lvl-text'), 'text', String(g.level));
        this.set('wave', $('wave-text'), 'text', String(g.wave));
        const left = g.quota - g.spawned + g.drops.length + g.enemies.filter(e => !e.boss).length;
        this.set('left', $('wave-left'), 'text', g.waveClearT >= 0 ? '· czysto' : `· ${left} wrogów`);
        this.set('waveBar', $('wave-bar').firstElementChild, 'transform', `scaleX(${(1 - left / Math.max(1, g.quota)).toFixed(3)})`);
        if (g.boss) this.set('boss', $('boss-hp').firstElementChild, 'transform', `scaleX(${Math.max(0, g.boss.hp / g.boss.maxHp).toFixed(3)})`);
        this.set('score', $('score-text'), 'text', fmt(g.score));
        const m = g.comboMult();
        this.set('combo', $('combo-text'), 'text', g.combo > 1 ? `COMBO ${g.combo} · ×${m.toFixed(2).replace(/\.?0+$/, '')}` : 'COMBO ×1');
        this.set('hot', $('combo-text'), 'color', m > 1 ? '#ffd200' : '');
        this.set('money', $('money-text'), 'text', fmt(g.money));

        // umiejętności
        const dash = p.dashStock > 0 ? 0 : Math.max(0, p.dashCdT / (1.1 * s.dashCd));
        this.set('dash', q('#btn-dash .fill'), 'transform', `scaleY(${dash.toFixed(3)})`);
        const dashLabel = (s.dashCharges || 1) > 1 ? `DASH ×${p.dashStock}` : 'DASH';
        if (this.hudCache.dashLabel !== dashLabel) { this.hudCache.dashLabel = dashLabel; q('#btn-dash span').firstChild.textContent = dashLabel; }
        this.set('shield', $('hp-bar'), 'outline', p.shieldReady ? '2px solid #00ffff' : '');
        const unlocked = g.ultUnlocked;
        const ready = unlocked && g.ult.charge >= g.ult.need;
        const ult = $('btn-ult');
        const cls = `chip skill ult${unlocked ? '' : ' locked'}${ready ? ' ready' : ''}`;
        if (this.hudCache.ultCls !== cls) { this.hudCache.ultCls = cls; ult.className = cls; }
        this.set('ultFill', q('#btn-ult .fill'), 'transform', `scaleY(${unlocked ? (g.ult.charge / g.ult.need).toFixed(3) : 0})`);

        // bronie
        const sig = g.weapons.map(w => w.id + w.level + w.inks.join('')).join('|');
        if (this.hudCache.weapons !== sig) {
            this.hudCache.weapons = sig;
            const html = [];
            for (let i = 0; i < MAX_WEAPONS; i++) {
                const w = g.weapons[i];
                if (!w) { html.push('<div class="chip wslot empty"><img alt=""><div class="pips"><i></i></div></div>'); continue; }
                const d = WEAPONS[w.id];
                html.push(`<div class="chip wslot" title="${d.name}">
                    <img alt="${d.name}" src="${icon(d.icon, '#ffffff', w.mix.id === 'none' ? '#8a8a90' : w.mix.color)}">
                    <div class="pips ${w.level >= 5 ? 'evo' : ''}">${[1, 2, 3, 4, 5].map(l => `<i class="${l <= w.level ? 'on' : ''}"></i>`).join('')}</div>
                    <div class="inks">${Array.from({ length: INK_SLOTS }, (_, s) => `<i style="${w.inks[s] ? `background:${INK_HEX[w.inks[s]]};border-color:transparent` : ''}"></i>`).join('')}</div>
                </div>`);
            }
            $('weapons').innerHTML = html.join('');
        }
    }
}
