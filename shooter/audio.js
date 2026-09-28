/* ==========================================================================
   OVERPRINT: dźwięk generowany w WebAudio (bez plików)
   Sfx: krótkie syntezy z limitem częstotliwości na rodzaj.
   Muzyka: sekwencer z wyprzedzeniem (lookahead), intensywność rośnie z falą.
   ========================================================================== */

const NOTE = n => 440 * 2 ** ((n - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.volume = { master: .8, sfx: .8, music: .55 };
        try {
            const saved = JSON.parse(localStorage.getItem('overprint-audio') || 'null');
            if (saved) Object.assign(this.volume, saved);
        } catch { /* brak dostępu do storage */ }
        this.last = {};
        this.intensity = 0;
        this.muffled = false;
    }

    // Kontekst tworzymy dopiero po geście użytkownika (wymóg przeglądarek).
    unlock() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.master = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 5;
        this.master.connect(comp).connect(ctx.destination);
        this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
        this.musicFilter = ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000;
        this.musicBus = ctx.createGain();
        this.musicBus.connect(this.musicFilter).connect(this.master);
        // bufor szumu, wspólny dla wszystkich perkusyjnych dźwięków
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolume();
    }

    setVolume(key, v) {
        this.volume[key] = v;
        this.applyVolume();
        try { localStorage.setItem('overprint-audio', JSON.stringify(this.volume)); } catch { /* ok */ }
    }
    applyVolume() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(this.volume.master, t, .05);
        this.sfxBus.gain.setTargetAtTime(this.volume.sfx * .9, t, .05);
        this.musicBus.gain.setTargetAtTime(this.volume.music * .5, t, .05);
    }
    muffle(on) {
        this.muffled = on;
        if (!this.ctx) return;
        this.musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, .15);
    }

    // --- prymitywy -----------------------------------------------------------------
    gate(key, ms) {
        const now = performance.now();
        if (now - (this.last[key] || 0) < ms) return false;
        this.last[key] = now;
        return true;
    }
    osc(type, f0, f1, dur, vol, when = 0, bus = this.sfxBus) {
        const c = this.ctx, t = c.currentTime + when;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(.0008, t + dur);
        o.connect(g).connect(bus);
        o.start(t); o.stop(t + dur + .02);
    }
    burst(dur, vol, type, f0, f1, q = 1, when = 0, bus = this.sfxBus) {
        const c = this.ctx, t = c.currentTime + when;
        const s = c.createBufferSource(); s.buffer = this.noise;
        s.playbackRate.value = .6 + Math.random() * .8;
        const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(.0008, t + dur);
        s.connect(f).connect(g).connect(bus);
        s.start(t, Math.random() * .5); s.stop(t + dur + .02);
    }

    // --- efekty -------------------------------------------------------------------------
    play(name, arg = 0) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const r = 1 + (Math.random() - .5) * .12;
        switch (name) {
            case 'shoot':
                if (!this.gate('shoot', 55)) return;
                this.osc('square', 900 * r, 300, .06, .05);
                this.burst(.05, .06, 'highpass', 3000, 1500);
                break;
            case 'shotgun':
                if (!this.gate('shotgun', 80)) return;
                this.burst(.18, .22, 'lowpass', 2600, 300, .7);
                this.osc('sine', 140, 50, .14, .18);
                break;
            case 'smg':
                if (!this.gate('smg', 45)) return;
                this.osc('square', 1300 * r, 500, .035, .035);
                break;
            case 'rail':
                this.osc('sawtooth', 2400, 120, .28, .09);
                this.burst(.3, .12, 'bandpass', 5000, 400, 3);
                break;
            case 'rocket':
                if (!this.gate('rocket', 70)) return;
                this.burst(.3, .1, 'bandpass', 600, 2400, 2);
                break;
            case 'laser':
                if (!this.gate('laser', 120)) return;
                this.osc('sawtooth', 190 * r, 170, .13, .025);
                break;
            case 'drone':
                if (!this.gate('drone', 70)) return;
                this.osc('triangle', 1700 * r, 900, .05, .03);
                break;
            case 'hit':
                if (!this.gate('hit', 35)) return;
                this.burst(.04, .07, 'bandpass', 2200 * r, 1200, 2);
                break;
            case 'kill':
                if (!this.gate('kill', 40)) return;
                this.burst(.16, .16, 'lowpass', 1800 * r, 180, 1.4);
                this.osc('sine', 260 * r, 70, .12, .12);
                break;
            case 'pickup':
                if (!this.gate('pickup', 30)) return;
                this.osc('sine', NOTE(76 + Math.min(arg, 14)), NOTE(76 + Math.min(arg, 14)) * 1.01, .07, .05);
                break;
            case 'levelup':
                [0, 4, 7, 12, 16].forEach((n, i) => this.osc('square', NOTE(69 + n), NOTE(69 + n), .14, .06, i * .06));
                break;
            case 'hurt':
                this.osc('sawtooth', 220, 60, .25, .16);
                this.burst(.2, .15, 'lowpass', 900, 100);
                break;
            case 'dash':
                this.burst(.2, .12, 'bandpass', 700, 3000, 1.8);
                break;
            case 'explode':
                if (!this.gate('explode', 60)) return;
                this.burst(.45, .3, 'lowpass', 1800, 60, .8);
                this.osc('sine', 110, 35, .35, .3);
                break;
            case 'zap':
                if (!this.gate('zap', 60)) return;
                this.osc('sawtooth', 3000 * r, 600, .08, .05);
                this.burst(.08, .06, 'highpass', 4000, 2000);
                break;
            case 'freeze':
                if (!this.gate('freeze', 90)) return;
                this.osc('triangle', 2600, 3400, .12, .04);
                break;
            case 'spawn':
                if (!this.gate('spawn', 90)) return;
                this.osc('sine', 500 * r, 160, .12, .035);
                break;
            case 'enemyShot':
                if (!this.gate('enemyShot', 90)) return;
                this.osc('sine', 420 * r, 190, .1, .05);
                break;
            case 'boss':
                [0, .05].forEach(d => this.osc('sawtooth', 55 + d * 100, 42, 1.4, .18, d));
                this.burst(1.2, .18, 'lowpass', 400, 60);
                break;
            case 'slam':
                this.osc('sine', 80, 28, .6, .45);
                this.burst(.5, .35, 'lowpass', 1200, 40);
                break;
            case 'ult':
                [0, 3, 7, 10, 15].forEach((n, i) => this.osc('sawtooth', NOTE(45 + n), NOTE(57 + n), 1.1, .07, i * .02));
                this.burst(1.2, .3, 'bandpass', 200, 5000, 1);
                break;
            case 'buy':
                this.osc('square', NOTE(79), NOTE(79), .06, .05);
                this.osc('square', NOTE(86), NOTE(86), .1, .05, .06);
                break;
            case 'deny':
                this.osc('square', 180, 150, .14, .06);
                break;
            case 'click':
                this.osc('triangle', 1400, 1100, .04, .04);
                break;
            case 'wave':
                [0, 7, 12].forEach((n, i) => this.osc('triangle', NOTE(62 + n), NOTE(62 + n), .3, .07, i * .09));
                break;
            case 'death':
                this.osc('sawtooth', 300, 30, 1.6, .2);
                this.burst(1.4, .25, 'lowpass', 2400, 50);
                break;
        }
    }

    // --- muzyka: A-moll, i–VI–III–VII -------------------------------------------------
    startMusic() {
        if (!this.ctx || this.seq) return;
        this.bpm = 124;
        this.step = 0;
        this.nextTime = this.ctx.currentTime + .1;
        this.seq = setInterval(() => this.schedule(), 25);
    }
    stopMusic() { clearInterval(this.seq); this.seq = null; }
    schedule() {
        const c = this.ctx, spb = 60 / this.bpm / 4; // szesnastki
        while (this.nextTime < c.currentTime + .12) {
            this.playStep(this.step, this.nextTime);
            this.nextTime += spb;
            this.step++;
        }
    }
    playStep(step, t) {
        const c = this.ctx, bus = this.musicBus, lvl = this.intensity;
        const s16 = step % 16, bar = Math.floor(step / 16) % 4;
        const roots = [45, 41, 48, 43]; // A F C G
        const root = roots[bar];
        const when = t - c.currentTime;
        // stopa
        if (s16 % 4 === 0) {
            const o = c.createOscillator(), g = c.createGain();
            o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
            g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .22);
            o.connect(g).connect(bus); o.start(t); o.stop(t + .25);
        }
        // hi-hat od fali 2
        if (lvl >= 1 && s16 % 4 === 2) this.burst(.04, .12, 'highpass', 8000, 7000, 1, when, bus);
        if (lvl >= 3 && s16 % 2 === 1) this.burst(.02, .05, 'highpass', 9000, 8000, 1, when, bus);
        // werbel od fali 4
        if (lvl >= 2 && (s16 === 4 || s16 === 12)) this.burst(.14, .22, 'bandpass', 1800, 900, .8, when, bus);
        // bas: ósemki z oktawą
        if (s16 % 2 === 0) {
            const n = root + (s16 % 8 === 6 ? 12 : 0);
            const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
            o.type = 'sawtooth'; o.frequency.value = NOTE(n);
            f.type = 'lowpass'; f.frequency.setValueAtTime(900 + lvl * 250, t); f.frequency.exponentialRampToValueAtTime(160, t + .16);
            g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
            o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + .2);
        }
        // arpeggio od fali 3
        if (lvl >= 2 && s16 % 2 === 1) {
            const chord = [0, 3, 7, 12, 7, 3, 10, 7];
            const n = root + 24 + chord[(s16 >> 1) % 8] + (bar === 1 || bar === 2 ? (chord[(s16 >> 1) % 8] === 3 ? 1 : 0) : 0);
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'square'; o.frequency.value = NOTE(n);
            g.gain.setValueAtTime(.035, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
            o.connect(g).connect(bus); o.start(t); o.stop(t + .12);
        }
        // pad na bossie
        if (lvl >= 4 && s16 === 0) {
            [0, 7, 15].forEach(iv => {
                const o = c.createOscillator(), g = c.createGain();
                o.type = 'sawtooth'; o.frequency.value = NOTE(root + 12 + iv); o.detune.value = (Math.random() - .5) * 14;
                g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.03, t + .3); g.gain.exponentialRampToValueAtTime(.0005, t + 1.9);
                o.connect(g).connect(bus); o.start(t); o.stop(t + 2);
            });
        }
    }
}
