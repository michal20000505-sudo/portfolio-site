/* ==========================================================================
   OVERPRINT: sterowanie (klawiatura + mysz, dotyk z dwoma joystickami, pad)
   Kierunki w świecie: góra ekranu = -Z, prawo = +X.
   ========================================================================== */

const DEAD = .18;

export class Input {
    constructor(layer) {
        this.layer = layer;                 // element przechwytujący dotyk i mysz nad grą
        this.keys = new Set();
        this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, seen: false };
        this.autoFire = false;
        this.touch = matchMedia('(pointer: coarse)').matches;
        this.sticks = { move: null, aim: null }; // { id, ox, oy, x, y }
        this.edges = new Set();
        this.enabled = false;
        this.pad = null;

        addEventListener('keydown', e => {
            if (e.target instanceof HTMLInputElement) return;
            const k = e.code;
            if (!this.keys.has(k)) {
                if (k === 'Space' || k === 'ShiftLeft' || k === 'ShiftRight') this.edges.add('dash');
                if (k === 'KeyQ' || k === 'KeyE') this.edges.add('ult');
                if (k === 'Escape' || k === 'KeyP') this.edges.add('pause');
                if (k === 'KeyF') { this.autoFire = !this.autoFire; this.edges.add('autofire'); }
            }
            this.keys.add(k);
            if (this.enabled && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
        });
        addEventListener('keyup', e => this.keys.delete(e.code));
        addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.sticks.move = this.sticks.aim = null; this.drawSticks(); });

        layer.addEventListener('pointerdown', e => this.onDown(e));
        addEventListener('pointermove', e => this.onMove(e), { passive: true });
        addEventListener('pointerup', e => this.onUp(e));
        addEventListener('pointercancel', e => this.onUp(e));
        layer.addEventListener('contextmenu', e => e.preventDefault());

        addEventListener('gamepadconnected', e => { this.pad = e.gamepad.index; });

        // wizualizacja joysticków
        this.stickEls = {};
        for (const name of ['move', 'aim']) {
            const base = document.createElement('div');
            base.className = 'stick stick-' + name;
            base.innerHTML = '<i></i>';
            base.setAttribute('aria-hidden', 'true');
            document.body.appendChild(base);
            this.stickEls[name] = base;
        }
    }

    onDown(e) {
        if (!this.enabled) return;
        if (e.pointerType === 'mouse') {
            this.touch = false;
            if (e.button === 0) this.mouse.down = true;
            if (e.button === 2) this.edges.add('dash');
            this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.seen = true;
            return;
        }
        this.touch = true;
        const side = e.clientX < innerWidth * .5 ? 'move' : 'aim';
        if (this.sticks[side]) return;
        this.sticks[side] = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        this.layer.setPointerCapture?.(e.pointerId);
        this.drawSticks();
        e.preventDefault();
    }
    onMove(e) {
        if (e.pointerType === 'mouse') {
            this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.seen = true;
            return;
        }
        for (const name of ['move', 'aim']) {
            const s = this.sticks[name];
            if (!s || s.id !== e.pointerId) continue;
            const R = Math.min(64, innerWidth * .12);
            let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
            const len = Math.hypot(dx, dy);
            // Baza podąża za palcem, gdy ten ucieka dalej niż promień: bez „martwych” krawędzi.
            if (len > R) { s.ox += dx - dx / len * R; s.oy += dy - dy / len * R; dx = dx / len * R; dy = dy / len * R; }
            s.x = dx / R; s.y = dy / R;
            this.drawSticks();
        }
    }
    onUp(e) {
        if (e.pointerType === 'mouse') { if (e.button === 0) this.mouse.down = false; return; }
        for (const name of ['move', 'aim']) if (this.sticks[name]?.id === e.pointerId) this.sticks[name] = null;
        this.drawSticks();
    }
    drawSticks() {
        for (const name of ['move', 'aim']) {
            const s = this.sticks[name], el = this.stickEls[name];
            el.classList.toggle('on', !!s);
            if (!s) continue;
            el.style.transform = `translate3d(${s.ox}px, ${s.oy}px, 0)`;
            const R = Math.min(64, innerWidth * .12);
            el.firstChild.style.transform = `translate3d(${(s.x * R).toFixed(1)}px, ${(s.y * R).toFixed(1)}px, 0)`;
        }
    }
    release() {
        this.mouse.down = false;
        this.sticks.move = this.sticks.aim = null;
        this.keys.clear();
        this.drawSticks();
    }

    consume(name) { const had = this.edges.has(name); this.edges.delete(name); return had; }
    clearEdges() { this.edges.clear(); }

    readPad() {
        if (this.pad === null || !navigator.getGamepads) return null;
        const p = navigator.getGamepads()[this.pad];
        if (!p) return null;
        const b = i => p.buttons[i]?.pressed;
        const prev = this.padPrev || {};
        const now = { a: b(0) || b(4), ult: b(3) || b(5), start: b(9), rt: b(7) };
        if (now.a && !prev.a) this.edges.add('dash');
        if (now.ult && !prev.ult) this.edges.add('ult');
        if (now.start && !prev.start) this.edges.add('pause');
        this.padPrev = now;
        return { lx: p.axes[0] || 0, ly: p.axes[1] || 0, rx: p.axes[2] || 0, ry: p.axes[3] || 0, rt: now.rt };
    }

    // Ruch: wektor {x, z} o długości ≤ 1.
    move() {
        let x = 0, z = 0;
        const k = this.keys;
        if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
        if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
        if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
        if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
        const s = this.sticks.move;
        if (s) { x += s.x; z += s.y; }
        const pad = this.padState;
        if (pad && Math.hypot(pad.lx, pad.ly) > DEAD) { x += pad.lx; z += pad.ly; }
        const len = Math.hypot(x, z);
        if (len > 1) { x /= len; z /= len; }
        if (s && len < DEAD) return { x: 0, z: 0 };
        return { x, z };
    }

    // Celowanie: { mode: 'mouse' | 'dir' | 'auto', x, y } oraz czy strzelać.
    aim() {
        const pad = this.padState;
        if (pad && Math.hypot(pad.rx, pad.ry) > .3) return { mode: 'dir', x: pad.rx, z: pad.ry, fire: true };
        const s = this.sticks.aim;
        if (s && Math.hypot(s.x, s.y) > .25) return { mode: 'dir', x: s.x, z: s.y, fire: true };
        if (this.touch || this.pad !== null) return { mode: 'auto', fire: true };
        return { mode: 'mouse', x: this.mouse.x, y: this.mouse.y, fire: this.mouse.down || this.autoFire || this.keys.has('KeyJ') };
    }

    poll() { this.padState = this.readPad(); }
}
