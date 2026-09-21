import * as THREE from 'three';
import { buildObserver } from './eye-observer-model.js';

export const STATE_LABELS = {
    idle: 'Czuwanie', tracking: 'Śledzenie', curious: 'Rozglądanie', focused: 'Skupienie',
    typing: 'Czytanie', scrolling: 'Orientacja', startled: 'Zaskoczenie', scanning: 'Skanowanie',
    happy: 'Radość', confused: 'Zaciekawienie', sleeping: 'Sen', waking: 'Pobudka', greeting: 'Powitanie',
};
const clamp = THREE.MathUtils.clamp;
const damp = (a, b, rate, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-rate * dt));

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

/** Reusable renderer. Does not rely on #mech-eye or any homepage CSS.
 * Events: observerstate, observertelemetry, observererror (on the host).
 * dispose() removes all listeners, observers, animation frames and GPU resources.
 */
export class ObserverEye {
    constructor(host, options = {}) {
        if (!(host instanceof HTMLElement)) throw new TypeError('ObserverEye requires a host element.');
        this.host = host;
        // lookYaw/lookPitch: zakres odwracania się za kursorem (radiany).
        // lookRadius: dystans w pikselach, na którym oko osiąga pełne wychylenie.
        // 0 mierzy kursor względem własnego kadru (laboratorium); wartość dodatnia
        // jest potrzebna małemu oku lecącemu po stronie, bo jego kadr ma ~120 px.
        this.options = { tracking: true, autoBlink: true, reactions: true, paused: false, turntable: false, spread: 0, light: 1, sensitivity: 1, zoom: 1, lookYaw: .23, lookPitch: .16, lookRadius: 0, ...options };
        this.bank = 0; // przechył nadawany z zewnątrz (kierunek lotu)
        this.abort = new AbortController(); this.motion = matchMedia('(prefers-reduced-motion: reduce)');
        this.reduced = this.motion.matches;
        this.time = 0; this.motionTime = 0; this.lastActivity = 0; this.blinkStart = -10; this.nextBlink = 4.3;
        this.motorTime = 0; this.motorSpeed = 1;
        this.mode = 'idle'; this.signal = null; this.previous = null; this.lastReport = 0;
        this.pointer = { x: 0, y: 0, seen: false, lastX: 0, lastY: 0, lastAt: 0, shake: 0 };
        this.orientation = { x: .12, y: .38, z: 0 }; this.view = { x: .12, y: .38 }; this.drag = null;
        this.current = { pupil: 1, spread: 0, excitement: 0, opening: 1 };
        this.intersecting = true; this.contextLost = false; this.disposed = false;
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.35 : 1.75));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
        this.renderer.domElement.setAttribute('aria-hidden', 'true');
        host.appendChild(this.renderer.domElement);
        this.scene = new THREE.Scene(); this.environment = studioEnvironment(this.renderer); this.scene.environment = this.environment.texture;
        this.camera = new THREE.PerspectiveCamera(32, 1, .1, 50); this.camera.position.set(0, .2, 8.7); this.camera.lookAt(0, -.08, 0);
        this.scene.add(new THREE.HemisphereLight(0xd8e5ed, 0x3a2f22, .8));
        const key = new THREE.DirectionalLight(0xffe6ca, 2.5); key.position.set(-3, 5, 4); this.scene.add(key);
        const fill = new THREE.DirectionalLight(0xc3e5ff, 1.2); fill.position.set(4, 1, 2); this.scene.add(fill);
        const rim = new THREE.DirectionalLight(0x59bfe2, 3); rim.position.set(2, 3, -3); this.scene.add(rim);
        // Oko unosi się w pustce, bez podłogi, więc nie rzuca cienia ani łuny pod sobą.
        this.model = buildObserver(); this.scene.add(this.model.root);
        this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host);
        this.visibilityObserver = new IntersectionObserver(entries => { this.intersecting = entries[0].isIntersecting; this.syncLoop(); }); this.visibilityObserver.observe(host);
        this.bind(); this.resize(); this.setState('idle'); this.render(0); this.syncLoop();
        host.dataset.ready = 'true';
    }
    on(target, event, fn, options = {}) { target.addEventListener(event, fn, { ...options, signal: this.abort.signal }); }
    bind() {
        const wake = () => { this.lastActivity = this.time; if (this.mode === 'sleeping') this.trigger('waking', 1.6); };
        this.on(window, 'pointermove', e => {
            const now = performance.now(), dt = Math.max(16, now - this.pointer.lastAt);
            const distance = Math.hypot(e.clientX - this.pointer.lastX, e.clientY - this.pointer.lastY);
            this.pointer.shake = this.pointer.shake * .8 + (dt < 100 && distance / dt > 2.8 ? 1 : 0);
            if (this.options.reactions && this.pointer.shake > 3.2 && this.time - (this.lastStartle ?? -10) > 3) { this.trigger('startled', 1.5); this.lastStartle = this.time; this.pointer.shake = 0; }
            this.pointer.lastX = e.clientX; this.pointer.lastY = e.clientY; this.pointer.lastAt = now;
            this.lookAt(e.clientX, e.clientY); wake();
            if (this.drag) {
                this.view.y = clamp(this.drag.yaw + (e.clientX - this.drag.x) * .008, -Math.PI, Math.PI);
                this.view.x = clamp(this.drag.pitch + (e.clientY - this.drag.y) * .006, -.75, .75);
                this.drag.moved ||= Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 5;
                if (this.options.paused) { this.orientation.x = this.view.x; this.orientation.y = this.view.y; this.render(0); }
            }
        }, { passive: true });
        this.on(this.host, 'pointerdown', e => {
            if (e.button !== 0) return;
            this.drag = { x: e.clientX, y: e.clientY, yaw: this.view.y, pitch: this.view.x, moved: false };
            this.host.setPointerCapture(e.pointerId); this.host.classList.add('is-dragging'); wake();
        });
        this.on(this.host, 'pointerup', () => { if (this.drag && !this.drag.moved) { this.blink(); this.trigger('happy', 2); } this.drag = null; this.host.classList.remove('is-dragging'); });
        this.on(this.host, 'pointercancel', () => { this.drag = null; this.host.classList.remove('is-dragging'); });
        this.on(this.host, 'lostpointercapture', () => { this.drag = null; this.host.classList.remove('is-dragging'); });
        this.on(this.host, 'keydown', e => {
            const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Enter', ' '];
            if (!keys.includes(e.key)) return; e.preventDefault(); wake();
            if (e.key === 'ArrowLeft') this.view.y -= .15;
            if (e.key === 'ArrowRight') this.view.y += .15;
            if (e.key === 'ArrowUp') this.view.x = clamp(this.view.x - .12, -.75, .75);
            if (e.key === 'ArrowDown') this.view.x = clamp(this.view.x + .12, -.75, .75);
            if (e.key === 'Home') this.setView('reference');
            if (e.key === 'Enter' || e.key === ' ') { this.blink(); this.trigger('happy', 2); }
            if (this.options.paused || this.reduced) { this.orientation.x = this.view.x; this.orientation.y = this.view.y; }
            this.render(0);
        });
        this.on(document, 'pointerover', e => {
            if (!this.options.reactions || !(e.target instanceof Element)) return;
            const target = e.target.closest('a,button,input,textarea,select,[data-eye-interest]');
            if (target && !target.contains(e.relatedTarget)) this.focusElement(target);
        }, { passive: true });
        this.on(document, 'focusin', e => { wake(); if (this.options.reactions && e.target !== this.host) this.focusElement(e.target); });
        this.on(document, 'keydown', e => {
            const sleepToggle = e.target instanceof Element && e.target.closest('[data-action="sleeping"]') && ['Enter', ' '].includes(e.key);
            if (!sleepToggle && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) wake();
        });
        this.on(document, 'input', e => {
            if (!this.options.reactions || !e.target.matches('input:not([type=range]):not([type=checkbox]),textarea,[contenteditable=true]')) return;
            this.focusElement(e.target); this.trigger('typing', 1.6); wake();
        });
        this.on(document, 'click', e => {
            const sleepToggle = e.target instanceof Element && e.target.closest('[data-action="sleeping"]');
            if (!sleepToggle) wake();
            if (this.options.reactions && e.target instanceof Element && e.target.closest('[data-eye-reaction]')) this.trigger(e.target.closest('[data-eye-reaction]').dataset.eyeReaction, 2.5);
            else if (this.options.reactions && e.target instanceof Element && !this.host.contains(e.target) && !e.target.closest('button,a,input,textarea,select,label')) {
                this.lookAt(e.clientX, e.clientY); this.trigger('focused', 1.5);
            }
        }, { capture: true });
        this.on(window, 'scroll', () => {
            if (!this.options.reactions) return;
            this.scrollDirection = Math.sign(scrollY - (this.previousScroll || 0)); this.previousScroll = scrollY;
            this.trigger('scrolling', .65); wake();
        }, { passive: true });
        this.on(document, 'visibilitychange', () => { if (!document.hidden) { this.lastActivity = this.time; this.trigger('greeting', 2); } this.syncLoop(); });
        this.on(this.motion, 'change', e => { this.reduced = e.matches; this.render(0); });
        this.on(this.renderer.domElement, 'webglcontextlost', e => {
            e.preventDefault(); this.contextLost = true; this.syncLoop();
            this.host.dispatchEvent(new CustomEvent('observererror', { detail: { message: 'Utracono kontekst 3D. Odśwież podgląd, aby ponownie uruchomić oko.' } }));
        });
    }
    resize() {
        if (this.disposed) return;
        const { width, height } = this.host.getBoundingClientRect();
        this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
        this.camera.aspect = Math.max(.1, width / Math.max(1, height));
        this.camera.position.z = (this.camera.aspect < 1 ? 8.2 / this.camera.aspect : 8.7) / this.options.zoom;
        this.camera.updateProjectionMatrix(); this.render(0);
    }
    lookAt(x, y) {
        const rect = this.host.getBoundingClientRect(), radius = this.options.lookRadius;
        const halfX = Math.max(1, radius || rect.width / 2);
        const halfY = Math.max(1, radius ? radius * .72 : rect.height / 2);
        this.pointer.x = clamp((x - rect.left - rect.width / 2) / halfX, -1, 1);
        this.pointer.y = clamp((y - rect.top - rect.height / 2) / halfY, -1, 1);
        this.pointer.seen = true;
    }
    focusElement(element) {
        if (!(element instanceof Element)) return;
        const r = element.getBoundingClientRect(); this.lookAt(r.left + r.width / 2, r.top + r.height / 2);
        this.trigger('focused', 1.1);
    }
    trigger(state, duration = 2.5) {
        if (!Object.hasOwn(STATE_LABELS, state)) return;
        this.lastActivity = this.time;
        this.signal = { state, end: state === 'sleeping' ? Infinity : this.time + duration, start: this.time };
        if (state === 'startled' || state === 'waking') this.blink();
        this.setState(state); this.render(0);
    }
    blink() { this.blinkStart = this.time; this.nextBlink = this.time + 4.3; }
    setState(mode) {
        if (this.mode === mode && this.host.dataset.eyeState) return;
        this.mode = mode; this.host.dataset.eyeState = mode;
        this.host.dispatchEvent(new CustomEvent('observerstate', { detail: { state: mode, label: STATE_LABELS[mode], time: this.time } }));
    }
    setOptions(patch) {
        for (const key of ['tracking', 'autoBlink', 'reactions', 'paused', 'turntable']) if (key in patch) this.options[key] = !!patch[key];
        for (const [key, min, max] of [['spread', 0, 1], ['light', .2, 1.8], ['sensitivity', .2, 2], ['zoom', .75, 1.3]]) {
            if (Number.isFinite(Number(patch[key]))) this.options[key] = clamp(Number(patch[key]), min, max);
        }
        if ('zoom' in patch) this.resize();
        if (this.options.paused || this.reduced) this.current.spread = this.options.spread;
        this.render(0); this.syncLoop();
    }
    setView(view) {
        const views = { reference: [.12, .38], front: [0, 0], side: [.06, -1.15], back: [.1, Math.PI] };
        if (!views[view]) return;
        [this.view.x, this.view.y] = views[view];
        this.options.turntable = false; this.pointer.seen = false;
        if (this.options.paused || this.reduced) Object.assign(this.orientation, { x: this.view.x, y: this.view.y });
        this.render(0);
    }
    reset() {
        this.signal = null; this.lastActivity = this.time; this.pointer.seen = false;
        this.current = { pupil: 1, spread: 0, excitement: 0, opening: 1 };
        this.setOptions({ tracking: true, autoBlink: true, reactions: true, paused: false, turntable: false, spread: 0, light: 1, sensitivity: 1, zoom: 1 });
        this.setView('reference'); this.setState('idle');
    }
    syncLoop() {
        cancelAnimationFrame(this.frame); this.frame = null; this.previous = null;
        if (!this.disposed && !this.contextLost && !document.hidden && this.intersecting && !this.options.paused) this.frame = requestAnimationFrame(now => this.tick(now));
    }
    tick(now) {
        if (this.disposed || this.contextLost || this.options.paused) return;
        const dt = this.previous === null ? 0 : Math.min((now - this.previous) / 1000, .25); this.previous = now;
        this.time += dt; if (!this.reduced) this.motionTime += dt;
        if (this.signal && this.time >= this.signal.end) this.signal = null;
        const idle = this.time - this.lastActivity;
        this.setState(this.signal?.state || (idle > 28 && this.options.reactions ? 'sleeping' : idle > 8 && this.options.reactions ? 'curious' : this.pointer.seen && this.options.tracking ? 'tracking' : 'idle'));
        if (this.options.autoBlink && !this.reduced && this.time > this.nextBlink && this.mode !== 'sleeping') {
            this.blink(); this.nextBlink = this.time + 3.8 + (Math.sin(this.time * 13) + 1) * 1.7;
        }
        this.render(dt);
        if (this.time - this.lastReport > .2) { this.lastReport = this.time; this.host.dispatchEvent(new CustomEvent('observertelemetry', { detail: this.snapshot() })); }
        this.frame = requestAnimationFrame(t => this.tick(t));
    }
    render(dt) {
        if (this.disposed || this.contextLost) return;
        const t = this.motionTime, state = this.mode, sleeping = state === 'sleeping', reduced = this.reduced;
        const strength = this.options.sensitivity;
        let yaw = this.view.y, pitch = this.view.x, roll = 0, excitement = 0, pupil = 1;
        if (this.options.tracking && this.pointer.seen && !this.drag && !sleeping && !this.options.turntable) {
            yaw += this.pointer.x * this.options.lookYaw * strength;
            pitch += this.pointer.y * this.options.lookPitch * strength; // Positive X rotation points +Z down in screen space.
        }
        if (!reduced) {
            if (this.options.turntable && !this.drag) { this.view.y += dt * .2; yaw = this.view.y; }
            if (state === 'curious') { yaw += Math.sin(t * .55) * .26; pitch += Math.cos(t * .43) * .13; roll = Math.sin(t * .4) * .055; }
            if (state === 'scanning') { yaw += Math.sin(t * 2.3) * .22; pitch += Math.cos(t * 1.3) * .09; }
            if (state === 'happy' || state === 'greeting') { roll = Math.sin((this.time - (this.signal?.start || 0)) * 7) * .08; excitement = .8; }
            if (state === 'confused') { roll = .19; yaw += Math.sin(t * 3) * .04; }
            if (state === 'startled') { roll = Math.sin(t * 26) * .022; pitch -= .12; excitement = 1; }
            if (state === 'scrolling') { pitch += (this.scrollDirection || 1) * .16; roll = (this.scrollDirection || 1) * -.06; }
            roll += this.bank;
        }
        if (state === 'focused' || state === 'typing' || state === 'scanning') pupil = .8;
        if (state === 'happy' || state === 'greeting') pupil = 1.13;
        if (state === 'startled') pupil = .7;
        if (sleeping) { pitch = this.view.x + (reduced ? 0 : .14); pupil = .8; }
        const phase = this.time - this.blinkStart;
        const blink = !reduced && phase >= 0 && phase < .42 ? (phase < .14 ? Math.sin(phase / .14 * Math.PI / 2) : Math.cos((phase - .14) / .28 * Math.PI / 2)) : 0;
        const opening = sleeping ? 0 : 1 - blink;
        const rate = reduced ? 1000 : 7;
        this.current.pupil = damp(this.current.pupil, pupil, rate, dt);
        this.current.spread = damp(this.current.spread, this.options.spread, rate * .55, dt);
        this.current.excitement = damp(this.current.excitement, excitement, rate, dt);
        this.current.opening = sleeping || this.current.opening < .95 && blink === 0 ? damp(this.current.opening, opening, 12, dt) : opening;
        if (this.current.opening < .001) this.current.opening = 0;
        if (this.current.opening > .999) this.current.opening = 1;
        if (reduced) { this.current.opening = sleeping ? 0 : 1; this.current.pupil = pupil; }
        this.orientation.x = damp(this.orientation.x, pitch, rate, dt);
        this.orientation.y = damp(this.orientation.y, yaw, rate, dt);
        this.orientation.z = damp(this.orientation.z, roll, rate, dt);
        this.model.root.rotation.set(this.orientation.x, this.orientation.y, this.orientation.z);
        this.model.root.position.y = reduced ? 0 : Math.sin(t * 1.35) * .035 + this.current.excitement * Math.sin(t * 3.5) * .025;
        this.model.root.position.z = state === 'startled' && !reduced ? -.08 : 0;
        this.motorSpeed = damp(this.motorSpeed, sleeping ? .06 : state === 'scanning' ? 2.6 : 1, 3, dt);
        if (!reduced) this.motorTime += dt * this.motorSpeed;
        this.model.pose({ time: t, motorTime: this.motorTime, activity: state === 'scanning' ? 2.6 : 1, opening: this.current.opening, pupilSize: this.current.pupil, spread: this.current.spread,
            excitement: this.current.excitement, scanning: state === 'scanning' ? t : 0, sleeping, light: this.options.light });
        this.renderer.render(this.scene, this.camera);
    }
    snapshot() {
        return { state: this.mode, label: STATE_LABELS[this.mode], time: this.time, reducedMotion: this.reduced,
            opening: this.model.opening, pupil: this.current.pupil, spread: this.current.spread,
            yaw: this.orientation.y, pitch: this.orientation.x, drawCalls: this.renderer.info.render.calls,
            triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures,
            paused: this.options.paused, active: !!this.frame, ...{ width: this.renderer.domElement.width, height: this.renderer.domElement.height } };
    }
    async capture() {
        if (this.disposed || this.contextLost) throw new Error('Podgląd 3D jest niedostępny.');
        this.renderer.render(this.scene, this.camera);
        return new Promise((resolve, reject) => this.renderer.domElement.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nie udało się zapisać kadru.')), 'image/png'));
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true; cancelAnimationFrame(this.frame); this.frame = null;
        this.abort.abort(); this.resizeObserver.disconnect(); this.visibilityObserver.disconnect();
        this.model.dispose();
        this.environment.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
        delete this.host.dataset.ready; delete this.host.dataset.eyeState;
    }
}
