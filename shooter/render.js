/* ==========================================================================
   OVERPRINT: render (Three.js)
   Pixel-art 3D: scena renderuje się do małego celu (ok. 15 px na jednostkę
   świata), post-shader dokłada obrysy z głębi, dithering, błysk i „misregister”
   (przesunięcie kanałów jak przy złym pasowaniu druku), a przeglądarka
   powiększa obraz bez wygładzania. Kamera ortograficzna pod kątem 60°,
   przyciągana do siatki pikseli, żeby obraz nie migotał przy ruchu.
   ========================================================================== */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, ENEMIES, INK, OBSTACLES } from './data.js';

const ELEV = THREE.MathUtils.degToRad(60);
const SIN_E = Math.sin(ELEV), COS_E = Math.cos(ELEV);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const colorCache = new Map();
export function C(hex) {
    let c = colorCache.get(hex);
    if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
    return c;
}
const WHITE = C('#ffffff');

function gradientMap() {
    const t = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
}

// --- pula instancji: jedna siatka, wiele obiektów ------------------------------------
class Pool {
    constructor(scene, geo, mat, max, { shadow = true } = {}) {
        const mesh = this.mesh = new THREE.InstancedMesh(geo, mat, max);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.castShadow = shadow;
        mesh.count = 0;
        this.max = max; this.n = 0;
        scene.add(mesh);
    }
    begin() { this.n = 0; }
    push(x, y, z, ry, sx, sy, sz, color, rx = 0, rz = 0) {
        if (this.n >= this.max) return;
        _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
        _p.set(x, y, z); _s.set(sx, sy, sz);
        _m.compose(_p, _q, _s);
        this.mesh.setMatrixAt(this.n, _m);
        this.mesh.setColorAt(this.n, color);
        this.n++;
    }
    end() {
        const m = this.mesh;
        m.count = this.n;
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
    }
}

// --- arkusz: podłoga z farbą (mieszanie subtraktywne: multiply) ---------------------------
class Paper {
    constructor(size) {
        this.size = size;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d');
        this.k = size / (ARENA * 2);
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.NearestFilter;
        this.dirty = false; this.lastUpload = 0; this.fadeTimer = 0;
        this.reset();
    }
    reset() {
        const x = this.ctx, N = this.size, k = this.k;
        x.globalCompositeOperation = 'source-over';
        x.globalAlpha = 1;
        x.fillStyle = '#f1ede4';
        x.fillRect(0, 0, N, N);
        // włókna papieru
        for (let i = 0; i < N * 3; i++) {
            x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.5)';
            x.fillRect(Math.random() * N, Math.random() * N, 1 + Math.random() * 2, 1);
        }
        // niebieska siatka "non-photo" co 3 jednostki: daje poczucie ruchu
        x.strokeStyle = 'rgba(80,170,215,.22)'; x.lineWidth = Math.max(1, k * .05);
        for (let u = -ARENA; u <= ARENA; u += 3) {
            const p = (u + ARENA) * k;
            x.beginPath(); x.moveTo(p, 0); x.lineTo(p, N); x.stroke();
            x.beginPath(); x.moveTo(0, p); x.lineTo(N, p); x.stroke();
        }
        x.fillStyle = 'rgba(80,170,215,.35)';
        for (let u = -ARENA; u <= ARENA; u += 3) for (let v = -ARENA; v <= ARENA; v += 3) {
            x.fillRect((u + ARENA) * k - k * .08, (v + ARENA) * k - k * .08, k * .16, k * .16);
        }
        // znaczniki cięcia w rogach
        x.strokeStyle = '#111'; x.lineWidth = Math.max(1, k * .07);
        const m = 1.2 * k, L = 2.2 * k;
        for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [N - m, m, -1, 1], [m, N - m, 1, -1], [N - m, N - m, -1, -1]]) {
            x.beginPath(); x.moveTo(cx - sx * L * .3, cy); x.lineTo(cx + sx * L, cy); x.stroke();
            x.beginPath(); x.moveTo(cx, cy - sy * L * .3); x.lineTo(cx, cy + sy * L); x.stroke();
        }
        // pasery na środkach krawędzi
        for (const [cx, cy] of [[N / 2, m * 1.1], [N / 2, N - m * 1.1], [m * 1.1, N / 2], [N - m * 1.1, N / 2]]) {
            x.beginPath(); x.arc(cx, cy, k * .55, 0, Math.PI * 2); x.stroke();
            x.beginPath(); x.moveTo(cx - k, cy); x.lineTo(cx + k, cy); x.moveTo(cx, cy - k); x.lineTo(cx, cy + k); x.stroke();
        }
        // pasek kontrolny CMYK
        const bar = ['#00aeef', '#ec008c', '#ffd200', '#161616', 'rgba(0,174,239,.5)', 'rgba(236,0,140,.5)', 'rgba(255,210,0,.5)', 'rgba(22,22,22,.5)'];
        const bw = k * 1.3;
        bar.forEach((c, i) => { x.fillStyle = c; x.fillRect(N - m * 1.6 - (bar.length - i) * bw, N - m * .9, bw * .92, k * .7); });
        x.fillStyle = 'rgba(17,17,17,.75)';
        x.font = `700 ${Math.round(k * .7)}px "Space Grotesk", sans-serif`;
        x.textBaseline = 'middle';
        x.fillText('OVERPRINT  ·  ARKUSZ Nº 001  ·  m-jaro.pl', m * 2.2, m * .9);
        this.dirty = true;
    }
    // Plama: nieregularny kleks + satelity, opcjonalnie rozciągnięty w kierunku (dx, dz).
    splat(wx, wz, color, r, alpha = .8, dx = 0, dz = 0) {
        const x = this.ctx, k = this.k;
        const cx = (wx + ARENA) * k, cy = (wz + ARENA) * k, R = r * k;
        if (cx < -R || cy < -R || cx > this.size + R || cy > this.size + R) return;
        x.globalCompositeOperation = 'multiply';
        x.globalAlpha = alpha;
        x.fillStyle = color;
        x.beginPath();
        const pts = 12;
        for (let i = 0; i <= pts; i++) {
            const a = i / pts * Math.PI * 2, rr = R * (.72 + Math.random() * .4);
            const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
            i ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.fill();
        const sat = 3 + (Math.random() * 5 | 0);
        for (let i = 0; i < sat; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = R * (1.1 + Math.random() * 1.3);
            let px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
            if (dx || dz) { const t = Math.random() * 2.5; px += dx * R * t; py += dz * R * t; }
            x.beginPath(); x.arc(px, py, R * (.08 + Math.random() * .2), 0, Math.PI * 2); x.fill();
        }
        x.globalAlpha = 1;
        x.globalCompositeOperation = 'source-over';
        this.dirty = true;
    }
    // Pas farby (np. ślad rakli).
    stroke(x1, z1, x2, z2, color, width, alpha = .6) {
        const x = this.ctx, k = this.k;
        x.globalCompositeOperation = 'multiply';
        x.globalAlpha = alpha; x.strokeStyle = color; x.lineCap = 'round';
        x.lineWidth = width * k;
        x.beginPath(); x.moveTo((x1 + ARENA) * k, (z1 + ARENA) * k); x.lineTo((x2 + ARENA) * k, (z2 + ARENA) * k); x.stroke();
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        this.dirty = true;
    }
    // Farba powoli wsiąka, żeby arena nie zrobiła się czarna po 20 minutach.
    update(dt, now) {
        this.fadeTimer += dt;
        if (this.fadeTimer > 1) {
            this.fadeTimer = 0;
            const x = this.ctx;
            x.globalAlpha = .012; x.fillStyle = '#f1ede4';
            x.fillRect(0, 0, this.size, this.size);
            x.globalAlpha = 1;
            this.dirty = true;
        }
        if (this.dirty && now - this.lastUpload > 90) {
            this.texture.needsUpdate = true;
            this.dirty = false; this.lastUpload = now;
        }
    }
}

// --- tekstury znaczników (pierścień, dysk w paski, prostokąt w paski) -----------------------
function markTexture(kind) {
    const c = document.createElement('canvas'), S = 64;
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
    if (kind === 'ring') {
        x.lineWidth = 5; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2); x.stroke();
    } else if (kind === 'disc') {
        x.globalAlpha = .35; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.lineWidth = 3; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2); x.stroke();
        x.save(); x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); x.clip();
        x.globalAlpha = .55; x.lineWidth = 4;
        for (let i = -S; i < S * 2; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); }
        x.restore();
    } else if (kind === 'rect') {
        x.globalAlpha = .3; x.fillRect(0, 0, S, S);
        x.globalAlpha = .7; x.lineWidth = 6;
        for (let i = -S; i < S * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); }
        x.globalAlpha = 1; x.fillRect(0, 0, 4, S); x.fillRect(S - 4, 0, 4, S);
    } else if (kind === 'soft') {
        const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    return t;
}

function letterTexture(letter) {
    const c = document.createElement('canvas'), S = 64;
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#6d727a'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#9aa0a8'; x.fillRect(3, 3, S - 6, S - 6);
    // czcionka drukarska jest lustrzanym odbiciem litery
    x.translate(S, 0); x.scale(-1, 1);
    x.fillStyle = '#1b1c20';
    x.font = '700 50px "Space Grotesk", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(letter, S / 2, S / 2 + 3);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    return t;
}

// --- post-shader ---------------------------------------------------------------------------------
const POST = {
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth;
        uniform vec2 uRes; uniform float uEdge; uniform vec4 uFlash; uniform float uMisreg;
        uniform float uHurt; uniform float uTime; uniform float uDither;
        varying vec2 vUv;
        float D(vec2 uv){ return texture2D(tDepth, uv).x; }
        float bayer(vec2 p){
            vec2 q = mod(floor(p), 4.0);
            int i = int(q.x + q.y * 4.0);
            float m[16];
            m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
            m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
            for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0 - 0.5;
            return 0.0;
        }
        void main(){
            vec2 px = 1.0 / uRes;
            vec3 c;
            if (uMisreg > 0.001) {
                vec2 o = vec2(uMisreg, uMisreg * 0.6) * px;
                c = vec3(texture2D(tColor, vUv + o).r, texture2D(tColor, vUv - o.yx).g, texture2D(tColor, vUv - o).b);
            } else c = texture2D(tColor, vUv).rgb;
            float d = D(vUv);
            float dn = max(max(D(vUv + vec2(px.x, 0.)), D(vUv - vec2(px.x, 0.))), max(D(vUv + vec2(0., px.y)), D(vUv - vec2(0., px.y))));
            float edge = step(0.0016, dn - d) * step(d, 0.9999);
            c = mix(c, c * 0.16, edge * uEdge);
            // do sRGB, potem dithering i kwantyzacja (w liniowej przestrzeni cienie by się rozsypały)
            c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
            c += bayer(gl_FragCoord.xy) * uDither;
            c = floor(c * 32.0 + 0.5) / 32.0;
            c = mix(c, uFlash.rgb, uFlash.a);
            vec2 v = vUv - 0.5;
            float vig = dot(v, v);
            c *= 1.0 - vig * 0.55;
            c = mix(c, vec3(0.9, 0.05, 0.35), uHurt * smoothstep(0.08, 0.3, vig) * (0.55 + 0.25 * sin(uTime * 6.0)));
            gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
};

// =================================================================================================
export class View {
    constructor(canvas, overlay) {
        this.canvas = canvas;
        this.overlay = overlay;
        this.octx = overlay.getContext('2d');
        this.quality = 'high';
        try { this.quality = localStorage.getItem('overprint-quality') || (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high'); } catch { /* ok */ }

        const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
        r.setPixelRatio(1);
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.BasicShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = C('#050505');
        this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 120);
        this.target = new THREE.Vector3();
        this.camPos = new THREE.Vector3();

        this.rt = new THREE.WebGLRenderTarget(2, 2, {
            minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
            depthTexture: new THREE.DepthTexture(2, 2),
        });
        this.post = new THREE.ShaderMaterial({
            ...POST,
            uniforms: {
                tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
                uRes: { value: new THREE.Vector2(2, 2) }, uEdge: { value: 1 },
                uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uMisreg: { value: 0 },
                uHurt: { value: 0 }, uTime: { value: 0 }, uDither: { value: .02 },
            },
            depthTest: false, depthWrite: false,
        });
        this.postScene = new THREE.Scene();
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
        quad.frustumCulled = false;
        this.postScene.add(quad);

        this.grad = gradientMap();
        this.toon = hex => new THREE.MeshToonMaterial({ color: hex, gradientMap: this.grad });

        // światła
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.35));
        const sun = this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
        sun.shadow.bias = -.0015;
        this.scene.add(sun, sun.target);

        this.buildWorld();
        this.buildPools();
        this.buildPlayer();

        this.particles = [];
        this.beams = [];
        this.rings = [];
        this.numbers = [];
        this.bossMeshes = new Map();
        this.shakeAmt = 0; this.flashAmt = 0; this.flashCol = [1, 1, 1]; this.misreg = 0;
        this.time = 0;

        this.applyQuality();
        this.resize();
        addEventListener('resize', () => this.resize());
    }

    setQuality(q) {
        this.quality = q;
        try { localStorage.setItem('overprint-quality', q); } catch { /* ok */ }
        this.applyQuality();
        this.resize();
    }
    applyQuality() {
        const q = this.quality;
        this.pxPerUnit = q === 'low' ? 11 : q === 'medium' ? 13.5 : 16;
        const shadows = q !== 'low';
        this.renderer.shadowMap.enabled = shadows;
        this.sun.castShadow = shadows;
        this.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
        if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
        this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
        this.maxParticles = q === 'low' ? 350 : q === 'medium' ? 700 : 1100;
    }

    resize() {
        const W = innerWidth, H = innerHeight, aspect = W / H;
        this.V = Math.max(19, 17.5 / aspect);                // widoczna wysokość w jednostkach
        const lowH = Math.round(this.V * this.pxPerUnit), lowW = Math.max(1, Math.round(lowH * aspect));
        this.low = { w: lowW, h: lowH };
        this.renderer.setSize(lowW, lowH, false);
        this.rt.setSize(lowW, lowH);
        this.post.uniforms.uRes.value.set(lowW, lowH);
        const cam = this.camera;
        cam.left = -this.V * aspect / 2; cam.right = this.V * aspect / 2;
        cam.top = this.V / 2; cam.bottom = -this.V / 2;
        cam.updateProjectionMatrix();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        this.dpr = dpr;
        this.overlay.width = Math.round(W * dpr); this.overlay.height = Math.round(H * dpr);
        this.css = { w: W, h: H };
    }

    // --- świat -----------------------------------------------------------------------------------
    buildWorld() {
        const q = matchMedia('(pointer: coarse)').matches ? 768 : 1024;
        this.paper = new Paper(q);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
            new THREE.MeshLambertMaterial({ map: this.paper.texture }));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        // stół maszyny pod arkuszem
        const bed = new THREE.Mesh(new THREE.BoxGeometry(ARENA * 2 + 14, 1, ARENA * 2 + 14), this.toon('#1a1b1f'));
        bed.position.y = -.52; bed.receiveShadow = true;
        this.scene.add(bed);
        // listwy docisku wzdłuż krawędzi arkusza
        const railMat = this.toon('#2b2d33');
        for (const [x, z, w, d] of [[0, -ARENA - .5, ARENA * 2 + 2, 1], [0, ARENA + .5, ARENA * 2 + 2, 1], [-ARENA - .5, 0, 1, ARENA * 2], [ARENA + .5, 0, 1, ARENA * 2]]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(w, .5, d), railMat);
            rail.position.set(x, .25, z); rail.castShadow = rail.receiveShadow = true;
            this.scene.add(rail);
        }
        // czcionki
        const side = this.toon('#80868f');
        for (const o of OBSTACLES) {
            const top = new THREE.MeshToonMaterial({ map: letterTexture(o.letter), gradientMap: this.grad });
            const box = new THREE.Mesh(new THREE.BoxGeometry(o.hw * 2, o.h, o.hd * 2), [side, side, top, side, side, side]);
            box.position.set(o.x, o.h / 2, o.z);
            box.castShadow = box.receiveShadow = true;
            this.scene.add(box);
        }
    }

    buildPools() {
        const S = this.scene;
        const basic = hex => new THREE.MeshBasicMaterial({ color: hex });
        const flat = hex => new THREE.MeshToonMaterial({ color: hex, gradientMap: this.grad, flatShading: true });
        this.pools = {};
        const P = (name, geo, mat, max, opt) => (this.pools[name] = new Pool(S, geo, mat, max, opt));

        // przeciwnicy: każdy typ ma swoją bryłę
        const blob = new THREE.IcosahedronGeometry(.5, 1);
        P('kleks', blob, flat('#ffffff'), 260);
        P('kropla', blob, flat('#ffffff'), 120);
        P('smuga', new THREE.IcosahedronGeometry(.42, 0), flat('#ffffff'), 120);
        const bottle = mergeGeometries([
            new THREE.CylinderGeometry(.42, .5, .8, 6).translate(0, 0, 0),
            new THREE.CylinderGeometry(.16, .2, .45, 6).rotateX(Math.PI / 2).translate(0, .15, .45),
        ]);
        P('plujka', bottle, flat('#ffffff'), 80);
        const roller = new THREE.CylinderGeometry(.9, .9, 1.5, 12).rotateZ(Math.PI / 2);
        P('walec', roller, flat('#ffffff'), 60);
        P('dzielnik', new THREE.DodecahedronGeometry(.7, 0), flat('#ffffff'), 80);
        P('pecherz', new THREE.SphereGeometry(.55, 10, 8), flat('#ffffff'), 80);
        const shield = mergeGeometries([
            new THREE.BoxGeometry(.8, .8, .7),
            new THREE.BoxGeometry(1.4, 1.1, .18).translate(0, .1, .5),
        ]);
        P('tarczownik', shield, flat('#ffffff'), 80);
        // oczy wrogów
        P('eyeW', new THREE.BoxGeometry(.2, .2, .08), basic('#ffffff'), 1600, { shadow: false });
        P('eyeP', new THREE.BoxGeometry(.1, .1, .05), basic('#ffffff'), 1600, { shadow: false });

        // pociski i przedmioty
        P('bullet', new THREE.IcosahedronGeometry(1, 0), basic('#ffffff'), 900);
        P('ebullet', new THREE.IcosahedronGeometry(1, 1), basic('#ffffff'), 700);
        P('rocket', new THREE.BoxGeometry(.22, .22, .6), flat('#ffffff'), 80);
        P('pickup', new THREE.OctahedronGeometry(.2, 0), flat('#ffffff'), 500);
        P('heart', mergeGeometries([new THREE.BoxGeometry(.5, .16, .16), new THREE.BoxGeometry(.16, .5, .16)]), basic('#ffffff'), 20);
        P('roller', new THREE.CylinderGeometry(.42, .42, .8, 10).rotateZ(Math.PI / 2), flat('#ffffff'), 24);
        P('drone', mergeGeometries([new THREE.BoxGeometry(.4, .16, .4), new THREE.BoxGeometry(.8, .05, .1), new THREE.BoxGeometry(.1, .05, .8)]), flat('#ffffff'), 12);
        P('drop', new THREE.SphereGeometry(.35, 8, 6), flat('#ffffff'), 120);
        P('particle', new THREE.BoxGeometry(1, 1, 1), flat('#ffffff'), 1200, { shadow: false });
        P('beam', new THREE.BoxGeometry(1, 1, 1), basic('#ffffff'), 220, { shadow: false });

        // płaskie znaczniki na podłodze (przezroczyste)
        const flatMat = kind => new THREE.MeshBasicMaterial({ map: markTexture(kind), transparent: true, depthWrite: false, color: '#ffffff' });
        const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        P('ring', plane, flatMat('ring'), 260, { shadow: false });
        P('disc', plane, flatMat('disc'), 120, { shadow: false });
        P('rect', plane, flatMat('rect'), 20, { shadow: false });
        P('soft', plane, flatMat('soft'), 200, { shadow: false });
        for (const k of ['ring', 'disc', 'rect', 'soft']) this.pools[k].mesh.renderOrder = 2;
    }

    buildPlayer() {
        const g = this.player = new THREE.Group();
        const mats = this.playerMats = [];
        const box = (w, h, d, hex, x, y, z, parent, basic = false) => {
            const mat = basic ? new THREE.MeshBasicMaterial({ color: hex }) : this.toon(hex);
            if (!basic) mats.push(mat);
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            m.position.set(x, y, z); m.castShadow = true;
            parent.add(m);
            return m;
        };
        this.legs = new THREE.Group(); g.add(this.legs);
        this.legL = box(.22, .36, .24, '#1a1a1e', -.2, .18, 0, this.legs);
        this.legR = box(.22, .36, .24, '#1a1a1e', .2, .18, 0, this.legs);
        this.torso = new THREE.Group(); g.add(this.torso);
        box(.82, .5, .7, '#12a4d6', 0, .6, 0, this.torso);
        box(.56, .3, .5, '#1d1f26', 0, 1, -.02, this.torso);
        box(.44, .1, .06, '#00ffff', 0, 1.02, .24, this.torso, true);
        this.cartridges = ['C', 'M', 'Y'].map((k, i) => box(.15, .3, .15, '#55555c', -.2 + i * .2, .72, -.4, this.torso, true));
        this.gun = box(.16, .16, .78, '#15151a', .45, .62, .28, this.torso);
        box(.1, .1, .1, '#00ffff', .45, .62, .68, this.torso, true);
        // pierścień pod graczem: od razu widać, gdzie jesteś w tłumie
        const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .74, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: '#00aeef', transparent: true, opacity: .9, depthWrite: false }));
        ring.position.y = .03; ring.renderOrder = 2;
        g.add(ring);
        this.aimTick = new THREE.Mesh(new THREE.PlaneGeometry(.16, .34).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: '#00aeef', depthWrite: false, transparent: true }));
        this.aimTick.position.y = .03; this.aimTick.renderOrder = 2;
        g.add(this.aimTick);
        g.visible = false;
        this.scene.add(g);
    }

    // --- efekty wywoływane przez grę ---------------------------------------------------------------
    shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
    flash(hex, a) { _c.set(hex); this.flashCol = [_c.r, _c.g, _c.b]; this.flashAmt = Math.max(this.flashAmt, a); }
    misregister(px) { this.misreg = Math.max(this.misreg, px); }
    splat(x, z, color, r, alpha, dx, dz) { this.paper.splat(x, z, color, r, alpha, dx, dz); }
    burst(x, y, z, hex, count, speed = 5, size = .12, paint = 0) {
        const room = this.maxParticles - this.particles.length;
        count = Math.min(count, room);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (.35 + Math.random() * .8);
            this.particles.push({
                x, y, z, vx: Math.cos(a) * s, vy: 2 + Math.random() * speed * .9, vz: Math.sin(a) * s,
                life: .5 + Math.random() * .6, size: size * (.6 + Math.random() * .8), color: hex,
                rx: Math.random() * 6, ry: Math.random() * 6, paint: Math.random() < paint,
            });
        }
    }
    beam(x1, z1, x2, z2, hex, width, life = .12, y = .6) { this.beams.push({ x1, z1, x2, z2, hex, width, life, max: life, y }); }
    ring(x, z, hex, r0, r1, life = .35) { this.rings.push({ x, z, hex, r0, r1, life, max: life }); }
    number(x, z, value, crit, hex) {
        if (this.numbers.length > 70) this.numbers.shift();
        this.numbers.push({ x, z, y: 1.2, value: Math.round(value), crit, hex, life: .75, vx: (Math.random() - .5) * 1.2 });
    }

    screenToGround(cx, cy) {
        const ndc = new THREE.Vector3(cx / this.css.w * 2 - 1, -(cy / this.css.h) * 2 + 1, 0);
        ndc.unproject(this.camera);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const t = -ndc.y / dir.y;
        return { x: ndc.x + dir.x * t, z: ndc.z + dir.z * t };
    }
    worldToScreen(x, y, z) {
        _p.set(x, y, z).project(this.camera);
        return { x: (_p.x + 1) / 2 * this.css.w, y: (1 - _p.y) / 2 * this.css.h };
    }

    // --- synchronizacja z grą i klatka -------------------------------------------------------------
    follow(x, z, dt, lead = { x: 0, z: 0 }, snap = false) {
        const tx = x + lead.x, tz = z + lead.z;
        if (snap) this.target.set(tx, 0, tz);
        else {
            const k = 1 - Math.exp(-dt * 7);
            this.target.x += (tx - this.target.x) * k;
            this.target.z += (tz - this.target.z) * k;
        }
    }

    render(game, dt) {
        this.time += dt;
        this.syncEntities(game, dt);
        this.paper.update(dt, performance.now());

        // kamera: przyciąganie do siatki pikseli + wstrząs
        const wpp = this.V / this.low.h;
        let tx = Math.round(this.target.x / wpp) * wpp;
        let tz = Math.round(this.target.z / (wpp / SIN_E)) * (wpp / SIN_E);
        if (this.shakeAmt > .01) {
            const s = this.shakeAmt * this.shakeAmt * .9;
            tx += (Math.random() - .5) * s; tz += (Math.random() - .5) * s;
        }
        this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.6);
        const cam = this.camera;
        cam.position.set(tx, SIN_E * 60, tz + COS_E * 60);
        cam.lookAt(tx, 0, tz);
        this.sun.position.set(tx - 14, 30, tz + 10);
        this.sun.target.position.set(tx, 0, tz);

        const u = this.post.uniforms;
        this.flashAmt = Math.max(0, this.flashAmt - dt * 3.2);
        this.misreg = Math.max(0, this.misreg - dt * 14);
        u.uFlash.value.set(...this.flashCol, this.flashAmt);
        u.uMisreg.value = this.misreg;
        u.uTime.value = this.time;
        u.uHurt.value = game.player && (game.state === 'play' || game.state === 'pause') ? Math.max(0, 1 - game.player.hp / (game.stats.maxHp * .3)) : 0;

        const r = this.renderer;
        r.setRenderTarget(this.rt);
        r.render(this.scene, cam);
        r.setRenderTarget(null);
        r.render(this.postScene, this.postCam);

        this.drawOverlay(game, dt);
    }

    syncEntities(g, dt) {
        const P = this.pools;
        for (const k in P) P[k].begin();
        const t = this.time;

        // gracz
        const p = g.player;
        this.player.visible = !!p && g.state !== 'menu' && !(p.dead && p.deadT > .15);
        if (p && this.player.visible) {
            this.player.position.set(p.x, 0, p.z);
            this.torso.rotation.y = Math.atan2(p.aimX, p.aimZ);
            this.aimTick.position.set(p.aimX * .95, .03, p.aimZ * .95);
            this.aimTick.rotation.y = Math.atan2(p.aimX, p.aimZ);
            const moving = Math.hypot(p.vx, p.vz) > .5;
            if (moving) this.legs.rotation.y = Math.atan2(p.vx, p.vz);
            const step = moving ? Math.sin(t * 16) * .14 : 0;
            this.legL.position.y = .18 + Math.max(0, step); this.legR.position.y = .18 + Math.max(0, -step);
            this.torso.position.y = moving ? Math.abs(Math.sin(t * 16)) * .05 : Math.sin(t * 2) * .02;
            this.gun.position.z = .28 - p.recoil * .18;
            const blink = p.iframes > 0 && !p.dashing && Math.floor(t * 20) % 2 === 0;
            this.player.visible = !blink;
            const hurt = p.hurtFlash > 0;
            for (const m of this.playerMats) m.emissive.setRGB(hurt ? .9 : 0, hurt ? .1 : 0, hurt ? .3 : 0);
            const inks = g.inkSet();
            this.cartridges.forEach((m, i) => m.material.color.set(inks.has('CMY'[i]) ? INK['CMY'[i]] : '#55555c'));
            this.player.scale.setScalar(p.dashing ? 1.08 : 1);
        }

        // wrogowie
        for (const e of g.enemies) {
            if (e.boss) { this.syncBoss(e, g); continue; }
            const def = ENEMIES[e.type];
            const pool = P[e.type];
            let col = C(e.elite ? e.eliteColor : def.color);
            if (e.flash > 0) col = WHITE;
            else if (e.freezeT > 0) col = C('#bff3ff');
            else {
                const tint = e.burnT > 0 && Math.floor(t * 12 + e.id) % 2 ? INK.M : e.poisonT > 0 ? INK.green : e.slowT > 0 ? INK.C : null;
                if (tint) col = _c.copy(col).lerp(C(tint), .45);
            }
            const ry = Math.atan2(e.fx, e.fz);
            const sc = e.scale || 1;
            const frozen = e.freezeT > 0;
            let sx = sc, sy = sc, sz = sc, y = def.r * sc, rx = 0;
            if (!frozen) {
                const ph = t * 9 + e.id;
                if (e.type === 'kleks' || e.type === 'kropla' || e.type === 'dzielnik') {
                    const b = Math.sin(ph); sy *= 1 + b * .14; sx *= 1 - b * .07; sz *= 1 - b * .07;
                    y = def.r * sc * (.86 + b * .14);
                } else if (e.type === 'smuga') { sz *= 1.7; sx *= .8; sy *= .8; y = .4; }
                else if (e.type === 'walec') { rx = e.roll; y = .9 * sc; }
                else if (e.type === 'pecherz') { const b = 1 + Math.sin(ph * (e.fuse > 0 ? 4 : 1)) * (e.fuse > 0 ? .12 : .05) + (e.fuse > 0 ? (.65 - e.fuse) * .5 : 0); sx *= b; sy *= b; sz *= b; }
                else if (e.type === 'plujka') { y = .4 * sc + Math.abs(Math.sin(ph * .7)) * .1; }
                else if (e.type === 'tarczownik') { y = .45 * sc; }
            }
            if (e.spawnT > 0) { const k = 1 - e.spawnT / .25; sx *= k; sy *= k * 1.4; sz *= k; }
            pool.push(e.x, y, e.z, ry, sx, sy, sz, col, rx);
            // oczy (walec ich nie ma, jest walcem)
            if (e.type !== 'walec') {
                const eh = e.type === 'plujka' ? .72 : e.type === 'tarczownik' ? .75 : y + def.r * sc * .25;
                const fwd = e.type === 'tarczownik' ? .62 : def.r * sc * .88;
                const sideOff = def.r * sc * .36;
                const ex = Math.sin(ry), ez = Math.cos(ry);
                const blinkS = (Math.floor(t * 2 + e.id * 1.7) % 9 === 0) ? .15 : 1;
                for (const sd of [-1, 1]) {
                    const px = e.x + ex * fwd + ez * sideOff * sd, pz = e.z + ez * fwd - ex * sideOff * sd;
                    P.eyeW.push(px, eh, pz, ry, sc, sc * blinkS, sc, e.type === 'pecherz' ? C('#161616') : WHITE);
                    P.eyeP.push(px + ex * .03, eh, pz + ez * .03, ry, sc, sc * blinkS, sc, e.type === 'pecherz' ? C('#f2c200') : C('#101010'));
                }
            }
            if (e.elite) P.ring.push(e.x, .03, e.z, t * 2, def.r * 3.4 * sc, 1, def.r * 3.4 * sc, C(e.eliteColor));
        }

        // pociski gracza
        for (const b of g.bullets) {
            const ry = Math.atan2(b.vx, b.vz), s = b.size;
            if (b.kind === 'rocket') P.rocket.push(b.x, .7, b.z, ry, 1, 1, 1, C(b.color));
            else P.bullet.push(b.x, .62, b.z, ry, s, s, s * 2.4, C(b.color));
        }
        for (const b of g.ebullets) {
            const pulse = 1 + Math.sin(t * 20 + b.id) * .15;
            P.ebullet.push(b.x, .6, b.z, 0, b.r * pulse, b.r * pulse, b.r * pulse, C(b.color || '#ff1f8e'));
        }
        // krople do zebrania
        for (const d of g.pickups) {
            const big = d.value >= 5;
            const y = .35 + Math.sin(t * 4 + d.id) * .1;
            if (d.heart) P.heart.push(d.x, .5 + Math.sin(t * 4) * .1, d.z, t * 2, 1, 1, 1, C('#ff2d55'));
            else P.pickup.push(d.x, y, d.z, t * 3 + d.id, big ? 1.5 : 1, big ? 2 : 1.4, big ? 1.5 : 1, C(big ? '#ec008c' : d.value >= 2 ? '#00aeef' : '#161616'));
        }
        // broń orbitalna i drony
        for (const o of g.orbiters) P.roller.push(o.x, .45, o.z, o.a, o.scale, o.scale, o.scale, C(o.color), t * 10);
        for (const d of g.drones) {
            P.drone.push(d.x, 1.6 + Math.sin(t * 5 + d.i) * .12, d.z, t * 14, 1, 1, 1, C('#1d1d22'));
            P.beam.push(d.x, 1.6, d.z, 0, .08, .08, .08, C('#00ffff'));
        }
        // lasery (w tej klatce)
        for (const l of g.lasers) {
            const dx = l.x2 - l.x1, dz = l.z2 - l.z1, len = Math.hypot(dx, dz);
            const w = l.width * (1 + Math.sin(t * 40) * .2);
            P.beam.push((l.x1 + l.x2) / 2, .62, (l.z1 + l.z2) / 2, Math.atan2(dx, dz), w, w, len, C(l.color));
            P.beam.push((l.x1 + l.x2) / 2, .62, (l.z1 + l.z2) / 2, Math.atan2(dx, dz), w * .4, w * .4, len, WHITE);
        }
        // strefy: chmury, ogień, wiry
        for (const z of g.zones) {
            const k = Math.min(1, z.t * 4) * Math.min(1, z.life * 2);
            const col = C(z.color);
            P.disc.push(z.x, .04, z.z, z.kind === 'vortex' ? -t * 5 : t * .5, z.r * 2 * k, 1, z.r * 2 * k, col);
            if (z.kind === 'vortex') P.ring.push(z.x, .06, z.z, 0, z.r * 1.4 * (1 - (t * 2 % 1) * .6), 1, z.r * 1.4 * (1 - (t * 2 % 1) * .6), col);
            else P.soft.push(z.x, .5, z.z, 0, z.r * 2.2 * k, 1, z.r * 2.2 * k, col);
        }
        // ostrzeżenia (bossy, wybuchy)
        for (const m of g.marks) {
            const k = 1 - m.t / m.dur;
            const col = C(m.color || '#ff1f5a');
            if (m.kind === 'rect') {
                P.rect.push(m.x, .05, m.z, m.ry, m.w, 1, m.len * Math.min(1, k * 3), col);
            } else {
                P.disc.push(m.x, .05, m.z, t, m.r * 2, 1, m.r * 2, col);
                P.ring.push(m.x, .07, m.z, 0, m.r * 2 * k, 1, m.r * 2 * k, col);
            }
        }
        // spadające krople-wrogowie
        for (const d of g.drops) {
            const k = d.t / d.dur, y = 13 * (1 - k) * (1 - k) + .3;
            P.drop.push(d.x, y, d.z, 0, .8, 1.5, .8, C(ENEMIES[d.type]?.color || '#1c1c22'));
            P.disc.push(d.x, .03, d.z, 0, .4 + k * 1.1, 1, .4 + k * 1.1, C('#161616'));
        }

        // cząsteczki
        const ps = this.particles;
        for (let i = ps.length - 1; i >= 0; i--) {
            const q = ps[i];
            q.life -= dt;
            q.vy -= 22 * dt;
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            if (q.y < q.size / 2) {
                q.y = q.size / 2; q.vy *= -.35; q.vx *= .6; q.vz *= .6;
                if (q.paint) { this.paper.splat(q.x, q.z, q.color, q.size * 1.4, .55); q.paint = false; }
            }
            if (q.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
            const s = q.size * Math.min(1, q.life * 4);
            P.particle.push(q.x, q.y, q.z, q.ry + q.life * 5, s, s, s, C(q.color), q.rx + q.life * 7);
        }
        // wiązki i fale uderzeniowe
        for (let i = this.beams.length - 1; i >= 0; i--) {
            const b = this.beams[i];
            b.life -= dt;
            if (b.life <= 0) { this.beams.splice(i, 1); continue; }
            const k = b.life / b.max, dx = b.x2 - b.x1, dz = b.z2 - b.z1, len = Math.hypot(dx, dz);
            const w = b.width * k;
            P.beam.push((b.x1 + b.x2) / 2, b.y, (b.z1 + b.z2) / 2, Math.atan2(dx, dz), w, w, len, C(b.hex));
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life -= dt;
            if (r.life <= 0) { this.rings.splice(i, 1); continue; }
            const k = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 3);
            P.ring.push(r.x, .08, r.z, 0, rad * 2, 1, rad * 2, C(r.hex));
        }

        for (const k in P) P[k].end();

        // usunięcie siatek bossów, których już nie ma
        for (const [id, mesh] of this.bossMeshes) {
            if (!g.enemies.some(e => e.id === id)) { this.scene.remove(mesh); this.bossMeshes.delete(id); }
        }
    }

    // --- bossowie: osobne modele -------------------------------------------------------------------
    makeBoss(type) {
        const g = new THREE.Group();
        const mats = [];
        const add = (geo, hex, x, y, z, basic) => {
            const mat = basic ? new THREE.MeshBasicMaterial({ color: hex }) : new THREE.MeshToonMaterial({ color: hex, gradientMap: this.grad });
            if (!basic) mats.push(mat);
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z); m.castShadow = true;
            g.add(m);
            return m;
        };
        if (type === 'rakla') {
            add(new THREE.BoxGeometry(4.2, .5, .7), '#2b2b33', 0, 1.1, 0);
            add(new THREE.BoxGeometry(4.4, .7, .25), '#111114', 0, .4, .35);
            add(new THREE.BoxGeometry(.3, 1.4, .3), '#44464e', -1.2, 1.6, -.1);
            add(new THREE.BoxGeometry(.3, 1.4, .3), '#44464e', 1.2, 1.6, -.1);
            add(new THREE.BoxGeometry(2.8, .25, .25), '#44464e', 0, 2.3, -.1);
            for (const sx of [-.6, .6]) { add(new THREE.BoxGeometry(.4, .4, .1), '#ffffff', sx, 1.15, .38, true); add(new THREE.BoxGeometry(.18, .18, .06), '#ec008c', sx, 1.15, .44, true); }
        } else if (type === 'prasa') {
            add(new THREE.BoxGeometry(3.2, .9, 3.2), '#34383f', 0, .45, 0);
            add(new THREE.BoxGeometry(2.6, .5, 2.6), '#23252b', 0, 1.15, 0);
            add(new THREE.CylinderGeometry(.5, .5, 1.6, 10), '#8a9099', 0, 2.2, 0);
            add(new THREE.BoxGeometry(3.4, .12, 3.4), '#ffd200', 0, .06, 0, true);
            for (const sx of [-.7, .7]) { add(new THREE.BoxGeometry(.55, .4, .1), '#ffffff', sx, 1.15, 1.32, true); add(new THREE.BoxGeometry(.25, .2, .06), '#161616', sx, 1.1, 1.38, true); }
        } else {
            add(new THREE.IcosahedronGeometry(1.4, 1), '#16161c', 0, 1.5, 0);
            g.userData.eyes = [];
            for (let i = 0; i < 4; i++) {
                const e = add(new THREE.SphereGeometry(.34, 8, 6), '#ffffff', 0, 1.6, 0, true);
                const p = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshBasicMaterial({ color: '#ec008c' }));
                p.position.z = .26; e.add(p);
                g.userData.eyes.push(e);
            }
        }
        g.userData.mats = mats;
        mats.forEach(m => m.flatShading = true);
        this.scene.add(g);
        return g;
    }
    syncBoss(e, game) {
        let g = this.bossMeshes.get(e.id);
        if (!g) { g = this.makeBoss(e.type); this.bossMeshes.set(e.id, g); }
        g.position.set(e.x, e.y || 0, e.z);
        g.rotation.y = Math.atan2(e.fx, e.fz);
        const f = e.flash > 0 ? .8 : 0;
        for (const m of g.userData.mats) m.emissive.setRGB(f, f, f);
        const t = this.time;
        if (e.type === 'rozmaz') {
            const body = g.children[0];
            const b = Math.sin(t * 3);
            body.scale.set(1 - b * .06, 1 + b * .1, 1 - b * .06);
            g.userData.eyes.forEach((eye, i) => {
                const a = t * 1.4 + i * Math.PI / 2;
                eye.position.set(Math.cos(a) * 1.9, 1.7 + Math.sin(t * 2 + i) * .3, Math.sin(a) * 1.9);
                const p = game.player;
                if (p) eye.lookAt(p.x, .6, p.z);
            });
            g.rotation.y = 0;
            g.visible = !(e.phaseOut > 0 && Math.floor(t * 30) % 2 === 0);
        }
        if (e.type === 'rakla') g.children[1].scale.y = 1 + Math.sin(t * 8) * .05;
    }

    // --- nakładka 2D: liczby obrażeń, celownik, wskaźnik bossa ---------------------------------------
    drawOverlay(game, dt) {
        const x = this.octx, d = this.dpr;
        x.setTransform(d, 0, 0, d, 0, 0);
        x.clearRect(0, 0, this.css.w, this.css.h);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        const live = game.state === 'play' || game.state === 'dying';
        if (!live && game.state !== 'levelup' && game.state !== 'shop' && game.state !== 'pause') this.numbers.length = 0;
        if (game.settings.numbers) {
            for (let i = this.numbers.length - 1; i >= 0; i--) {
                const n = this.numbers[i];
                n.life -= dt; n.y += dt * 2.2; n.x += n.vx * dt;
                if (n.life <= 0) { this.numbers.splice(i, 1); continue; }
                const s = this.worldToScreen(n.x, n.y, n.z);
                const size = (n.crit ? 22 : 15) * (n.life > .6 ? 1 + (n.life - .6) * 3 : 1);
                x.globalAlpha = Math.min(1, n.life * 3);
                x.font = `700 ${size.toFixed(0)}px "Space Grotesk", sans-serif`;
                x.lineWidth = 4; x.strokeStyle = '#050505';
                x.strokeText(n.value, s.x, s.y);
                x.fillStyle = n.hex || (n.crit ? '#ffd200' : '#ffffff');
                x.fillText(n.value + (n.crit ? '!' : ''), s.x, s.y);
            }
            x.globalAlpha = 1;
        } else this.numbers.length = 0;

        const p = game.player;
        if (game.state === 'play' || game.state === 'shopwait') {
            // wskaźnik bossa poza ekranem
            for (const e of game.enemies) {
                if (!e.boss && !game.straggle) continue;
                const s = this.worldToScreen(e.x, 1, e.z);
                const m = 34;
                if (s.x > m && s.y > m && s.x < this.css.w - m && s.y < this.css.h - m) continue;
                const cx = this.css.w / 2, cy = this.css.h / 2;
                const a = Math.atan2(s.y - cy, s.x - cx);
                const ex = Math.max(m, Math.min(this.css.w - m, s.x)), ey = Math.max(m, Math.min(this.css.h - m, s.y));
                x.save(); x.translate(ex, ey); x.rotate(a);
                const k = e.boss ? 1 : .7;
                x.fillStyle = e.boss ? '#ff00ff' : '#050505';
                x.beginPath(); x.moveTo(14 * k, 0); x.lineTo(-8 * k, -10 * k); x.lineTo(-8 * k, 10 * k); x.closePath(); x.fill();
                x.restore();
            }
            // celownik myszy
            if (game.aimMode === 'mouse' && game.input.mouse.seen && p && !p.dead) {
                const { x: mx, y: my } = game.input.mouse;
                const r = 9 + p.recoil * 5;
                x.strokeStyle = '#050505'; x.lineWidth = 4;
                const cross = () => {
                    x.beginPath();
                    x.moveTo(mx - r - 6, my); x.lineTo(mx - r + 2, my); x.moveTo(mx + r - 2, my); x.lineTo(mx + r + 6, my);
                    x.moveTo(mx, my - r - 6); x.lineTo(mx, my - r + 2); x.moveTo(mx, my + r - 2); x.lineTo(mx, my + r + 6);
                    x.stroke();
                    x.beginPath(); x.arc(mx, my, 1.5, 0, Math.PI * 2); x.stroke();
                };
                cross();
                x.strokeStyle = '#00ffff'; x.lineWidth = 2; cross();
            }
        }
    }

    exportPrint(stats) {
        const src = this.paper.canvas, N = src.width;
        const c = document.createElement('canvas');
        const pad = Math.round(N * .06), foot = Math.round(N * .16);
        c.width = N + pad * 2; c.height = N + pad * 2 + foot;
        const x = c.getContext('2d');
        x.fillStyle = '#050505'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(src, pad, pad);
        x.fillStyle = '#ffffff';
        x.textBaseline = 'top';
        const fs = Math.round(N * .045);
        x.font = `700 ${fs}px "Space Grotesk", sans-serif`;
        x.fillText('OVERPRINT', pad, N + pad * 1.4);
        x.font = `500 ${Math.round(fs * .55)}px "Space Grotesk", sans-serif`;
        x.fillStyle = '#9a9a9a';
        x.fillText(stats, pad, N + pad * 1.4 + fs * 1.25);
        x.fillStyle = '#00ffff';
        x.textAlign = 'right';
        x.fillText('m-jaro.pl/shooter.html', c.width - pad, N + pad * 1.4 + fs * .2);
        return c;
    }
}
