// ========================================================================
// Mechaniczne oko — proceduralny obserwator (Three.js)
// Samodzielna gałka-mechanizm: wielowarstwowa tęczówka z niezależnie
// obracających się pierścieni, przysłona irysowa, zębatki, soczewki
// ogniskujące, mechaniczne powieki. Śledzi kursor (desktop) albo żyje
// własnym życiem (mobile). Stany: idle / tracking / focused / bored /
// sleeping / startled / recalibrating.
// ========================================================================

const wrap = document.getElementById('mech-eye');
if (wrap && window.WebGLRenderingContext) init().catch(() => wrap.remove());

async function init() {
    const THREE = await import('three');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isMobile = !finePointer;
    // Degradacja: mniej segmentów na urządzeniach dotykowych / słabych GPU
    const LOD = (isMobile || navigator.hardwareConcurrency <= 4) ? 0.6 : 1;

    const CYAN = 0x00ffff;
    const MAGENTA = 0xff00ff;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (e) { wrap.remove(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    camera.position.set(0, 0, 6.6);

    // ---- światła: neutralny klucz, cyjan od frontu (sygnał), magenta z tyłu (ambient) ----
    scene.add(new THREE.HemisphereLight(0xffffff, 0x101014, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 3, 4);
    scene.add(key);
    const cyanFill = new THREE.PointLight(CYAN, 3, 10, 2);
    cyanFill.position.set(0.8, -0.5, 3);
    scene.add(cyanFill);
    const magentaRim = new THREE.PointLight(MAGENTA, 10, 12, 2);
    magentaRim.position.set(-2.5, 1.5, -2.5);
    scene.add(magentaRim);

    // ---- proceduralna tekstura: szczotkowany metal + nity + linie paneli ----
    function brushedMetalTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 512;
        const g = c.getContext('2d');
        g.fillStyle = '#3a3d42';
        g.fillRect(0, 0, 512, 512);
        // szczotkowanie: poziome smugi o losowej jasności
        for (let i = 0; i < 1400; i++) {
            const y = Math.random() * 512;
            const l = 40 + Math.random() * 200;
            const b = 46 + Math.random() * 26;
            g.strokeStyle = `rgba(${b + 10},${b + 12},${b + 16},${0.25 + Math.random() * 0.3})`;
            g.beginPath();
            g.moveTo(Math.random() * 512, y);
            g.lineTo(Math.random() * 512 + l, y);
            g.stroke();
        }
        // linie paneli serwisowych
        g.strokeStyle = 'rgba(12,13,15,0.85)';
        g.lineWidth = 2;
        [90, 210, 330, 440].forEach(y => {
            g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
        });
        [128, 320].forEach(x => {
            g.beginPath(); g.moveTo(x, 90); g.lineTo(x, 210); g.stroke();
        });
        // nity wzdłuż linii
        g.fillStyle = 'rgba(18,19,22,0.9)';
        for (let i = 0; i < 26; i++) {
            const x = (i * 97 + 30) % 512;
            const y = [90, 210, 330, 440][i % 4] + (i % 2 ? 8 : -8);
            g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(140,145,155,0.5)';
            g.beginPath(); g.arc(x - 1, y - 1, 1.2, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(18,19,22,0.9)';
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 1);
        return tex;
    }

    const metalTex = brushedMetalTexture();
    const matHull = new THREE.MeshStandardMaterial({ map: metalTex, color: 0x9aa0aa, metalness: 0.85, roughness: 0.42 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x14151a, metalness: 0.7, roughness: 0.5 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x596070, metalness: 0.9, roughness: 0.32 });
    const matBlade = new THREE.MeshStandardMaterial({ color: 0x2a2d34, metalness: 0.88, roughness: 0.38, side: THREE.DoubleSide });
    const matGlowPupil = new THREE.MeshStandardMaterial({ color: 0x001a1a, emissive: CYAN, emissiveIntensity: 2.2 });
    const matGlowSoft = new THREE.MeshStandardMaterial({ color: 0x001111, emissive: CYAN, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
    const matLens = new THREE.MeshStandardMaterial({ color: 0x0b2b2e, metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });

    // ================= GAŁKA =================
    const eye = new THREE.Group();      // obraca się (patrzenie)
    const rig = new THREE.Group();      // recoil / drgnięcia całości
    rig.add(eye);
    scene.add(rig);

    const seg = Math.round(48 * LOD), seg2 = Math.round(32 * LOD);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg2), matHull);
    eye.add(ball);

    // tylny "port serwisowy" + przewody
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.25, Math.round(24 * LOD)), matDark);
    port.rotation.x = Math.PI / 2;
    port.position.z = -1.0;
    eye.add(port);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, metalness: 0.4, roughness: 0.7 });
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(Math.cos(a) * 0.22, Math.sin(a) * 0.22, -1.08),
            new THREE.Vector3(Math.cos(a) * 0.5, Math.sin(a) * 0.5 - 0.15, -1.5),
            new THREE.Vector3(Math.cos(a) * 0.4, Math.sin(a) * 0.4 - 0.55, -1.9)
        ]);
        eye.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.035, 6), cableMat));
    }

    // ---- jarzmo gimbala: oko obraca się wewnątrz nieruchomego mocowania ----
    const yoke = new THREE.Group();
    rig.add(yoke);
    const yokeArc = new THREE.Mesh(
        new THREE.TorusGeometry(1.22, 0.05, Math.round(10 * LOD), seg, Math.PI * 1.25), matSteel);
    // kolejność eulera XYZ: najpierw spin łuku w jego płaszczyźnie (Z), potem
    // przełożenie do płaszczyzny pionowej (Y) — przerwa łuku wypada z przodu
    yokeArc.rotation.z = -Math.PI * 0.625;
    yokeArc.rotation.y = Math.PI / 2;
    yoke.add(yokeArc);
    // sworznie gimbala (góra/dół)
    [1, -1].forEach(s => {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, Math.round(16 * LOD)), matDark);
        pin.position.y = s * 1.24;
        yoke.add(pin);
        const pinCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6), matSteel);
        pinCap.position.y = s * 1.27;
        yoke.add(pinCap);
    });

    // radiator na porcie serwisowym (żeberka chłodzące)
    {
        const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.02, 0.16), matDark, 5);
        const m = new THREE.Matrix4();
        for (let i = 0; i < 5; i++) {
            m.makeTranslation(0, -0.16 + i * 0.08, -1.2);
            fins.setMatrixAt(i, m);
        }
        eye.add(fins);
    }

    // ---- przedni zespół optyczny — wysunięty tubus obiektywu ----
    const optics = new THREE.Group();
    optics.position.z = 0.68;
    eye.add(optics);

    // tubus łączący kulę z mechanizmem
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.92, 0.62, seg, 1, true), matHull);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.10;
    optics.add(barrel);

    // szczeliny wentylacyjne na obwodzie tubusa
    {
        const vents = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.09, 0.16), matDark, 18);
        const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            e.set(0, 0, a); q.setFromEuler(e);
            m.compose(new THREE.Vector3(Math.cos(a) * 0.89, Math.sin(a) * 0.89, 0.02), q, sc);
            vents.setMatrixAt(i, m);
        }
        optics.add(vents);
    }

    // kołnierz zewnętrzny na wylocie tubusa
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.80, 0.10, Math.round(14 * LOD), seg), matSteel);
    bezel.position.z = 0.40;
    optics.add(bezel);

    // diody statusowe na kołnierzu (cyjan ×2 + żółta interpunkcja ruchu)
    const matLedCyan = new THREE.MeshStandardMaterial({ color: 0x002222, emissive: CYAN, emissiveIntensity: 1.5 });
    const matLedYellow = new THREE.MeshStandardMaterial({ color: 0x222200, emissive: 0xffff00, emissiveIntensity: 1.2 });
    const leds = [];
    [[Math.PI * 0.25, matLedCyan], [Math.PI * 0.75, matLedCyan], [Math.PI * 1.5, matLedYellow]].forEach(([a, mat]) => {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), mat.clone());
        led.position.set(Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0.50);
        led.userData.phase = a * 3;
        optics.add(led);
        leds.push(led);
    });
    // śruby na kołnierzu
    const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6);
    const bolts = new THREE.InstancedMesh(boltGeo, matDark, 8);
    {
        const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            m.compose(new THREE.Vector3(Math.cos(a) * 0.80, Math.sin(a) * 0.80, 0.51), q, new THREE.Vector3(1, 1, 1));
            bolts.setMatrixAt(i, m);
        }
    }
    optics.add(bolts);

    // czarna misa za mechanizmem
    const backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.6, 0.3, seg), matDark);
    backplate.rotation.x = Math.PI / 2;
    backplate.position.z = 0.02;
    optics.add(backplate);

    // pomocnik: pierścień znaczników (instanced boxy po okręgu)
    function tickRing(count, radius, w, h, d, mat, z) {
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), mat, count);
        const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            e.set(0, 0, a); q.setFromEuler(e);
            m.compose(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z), q, s);
            inst.setMatrixAt(i, m);
        }
        return inst;
    }

    // RING A — podziałka kalibracyjna (wolny obrót + oscylacja)
    const ringA = new THREE.Group();
    ringA.add(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.035, 8, seg), matHull));
    ringA.add(tickRing(Math.round(48 * LOD), 0.66, 0.012, 0.07, 0.075, matDark, 0));
    ringA.position.z = 0.30;
    optics.add(ringA);

    // RING B — wieniec zębaty (kontr-rotacja)
    const ringB = new THREE.Group();
    ringB.add(new THREE.Mesh(new THREE.TorusGeometry(0.545, 0.045, 8, seg), matSteel));
    ringB.add(tickRing(Math.round(40 * LOD), 0.585, 0.05, 0.045, 0.09, matSteel, 0));
    ringB.position.z = 0.36;
    optics.add(ringB);

    // RING C — pierścień serwo (ruch skokowy, sakkadowy)
    const ringC = new THREE.Group();
    for (let i = 0; i < 6; i++) {
        const arc = new THREE.Mesh(
            new THREE.CylinderGeometry(0.46, 0.46, 0.07, Math.round(10 * LOD), 1, true, (i / 6) * Math.PI * 2 + 0.09, Math.PI / 3 - 0.18),
            matBlade
        );
        arc.rotation.x = Math.PI / 2;
        ringC.add(arc);
    }
    ringC.add(tickRing(12, 0.46, 0.02, 0.02, 0.1, matGlowSoft, 0));
    ringC.position.z = 0.42;
    optics.add(ringC);

    // RING D — cienki świetlny pierścień dawkujący (przerywana obwódka)
    const ringD = new THREE.Group();
    ringD.add(tickRing(24, 0.74, 0.05, 0.014, 0.02, matGlowSoft, 0));
    ringD.position.z = 0.34;
    optics.add(ringD);

    // promieniste szprychy łączące wieniec z pierścieniem serwo
    const spokes = new THREE.Group();
    {
        const spokeGeo = new THREE.BoxGeometry(0.10, 0.022, 0.022);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
            const sp = new THREE.Mesh(spokeGeo, matSteel);
            sp.position.set(Math.cos(a) * 0.505, Math.sin(a) * 0.505, 0);
            sp.rotation.z = a;
            spokes.add(sp);
        }
    }
    spokes.position.z = 0.39;
    optics.add(spokes);

    // małe zębatki między pierścieniami (widoczna przekładnia)
    function smallGear(teeth, r) {
        const gr = new THREE.Group();
        gr.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, Math.round(16 * LOD)), matSteel));
        const t = new THREE.InstancedMesh(new THREE.BoxGeometry(0.028, 0.028, 0.04), matSteel, teeth);
        const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < teeth; i++) {
            const a = (i / teeth) * Math.PI * 2;
            e.set(0, 0, a); q.setFromEuler(e);
            m.compose(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0), q, s);
            t.setMatrixAt(i, m);
        }
        gr.children[0].rotation.x = Math.PI / 2;
        gr.add(t);
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 8), matDark);
        axle.rotation.x = Math.PI / 2;
        gr.add(axle);
        return gr;
    }
    const gears = [];
    [[0.60, 0.25, 1.7], [-0.58, -0.30, -2.2], [0.10, -0.63, 1.3]].forEach(([x, y, speed]) => {
        const g = smallGear(10, 0.055);
        g.position.set(x, y, 0.42);
        g.userData.speed = speed;
        optics.add(g);
        gears.push(g);
    });

    // ---- PRZYSŁONA IRYSOWA — 12 listków sterujących "źrenicą" ----
    const IRIS_R = 0.44;       // promień okręgu sworzni
    const blades = [];
    const irisGroup = new THREE.Group();
    irisGroup.position.z = 0.46;
    optics.add(irisGroup);
    {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.30, 0.02, 0.58, -0.10);
        shape.quadraticCurveTo(0.34, 0.16, 0.10, 0.13);
        shape.quadraticCurveTo(0.02, 0.08, 0, 0);
        const bladeGeo = new THREE.ShapeGeometry(shape, 6);
        for (let i = 0; i < 12; i++) {
            const pivot = new THREE.Group();
            const a = (i / 12) * Math.PI * 2;
            pivot.position.set(Math.cos(a) * IRIS_R, Math.sin(a) * IRIS_R, (i % 2) * 0.008);
            pivot.rotation.z = a + Math.PI; // listek celuje do środka
            const blade = new THREE.Mesh(bladeGeo, matBlade);
            pivot.add(blade);
            irisGroup.add(pivot);
            blades.push(pivot);
        }
    }

    // ---- źrenica-sensor + skanujący refleks ----
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.33, seg2), matGlowPupil);
    pupil.position.z = 0.44;
    optics.add(pupil);
    const pupilRing = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.365, seg2), matGlowSoft);
    pupilRing.position.z = 0.443;
    optics.add(pupilRing);
    const pupilLight = new THREE.PointLight(CYAN, 1.6, 3.5, 2);
    pupilLight.position.z = 1.1;
    optics.add(pupilLight);
    const scanline = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.02),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    scanline.position.z = 0.446;
    optics.add(scanline);

    // ---- stos soczewek (ogniskowanie = przesuw w osi Z) ----
    const lensStack = new THREE.Group();
    lensStack.position.z = 0.54;
    optics.add(lensStack);
    const lens1 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, seg2), matLens);
    lens1.rotation.x = Math.PI / 2;
    lensStack.add(lens1);
    const lens2 = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.02, seg2), matLens);
    lens2.rotation.x = Math.PI / 2;
    lens2.position.z = 0.10;
    lensStack.add(lens2);
    const lensRim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 8, seg2), matSteel);
    lensStack.add(lensRim);

    // Mrugnięcie = migawka: pełne domknięcie przysłony irysowej (bez powiek —
    // wielkie czasze wyglądały, jakby pojawiały się znikąd i okalały oko).

    // ---- akcesoria per podstrona (data-variant na #mech-eye) ----
    const variant = wrap.dataset.variant || '';

    if (variant === 'painter') {
        // czapka malarska (beret) + pędzel za "uchem"
        const matFabric = new THREE.MeshStandardMaterial({ color: 0x1d1e24, metalness: 0.05, roughness: 0.95 });
        const beret = new THREE.Group();
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.82, seg2, Math.round(14 * LOD)), matFabric);
        cap.scale.set(1.15, 0.42, 1.1);
        beret.add(cap);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 8), matFabric);
        stem.position.y = 0.36;
        beret.add(stem);
        // plamy farby CMYK na berecie
        const splatterCols = [CYAN, MAGENTA, 0xffff00, MAGENTA, CYAN];
        splatterCols.forEach((col, i) => {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (i % 3) * 0.02, 8, 6),
                new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.6 }));
            const a = i * 2.4;
            s.position.set(Math.cos(a) * 0.5, 0.30, Math.sin(a) * 0.45);
            s.scale.y = 0.35;
            beret.add(s);
        });
        beret.position.set(0.12, 0.92, -0.10);
        beret.rotation.z = -0.30;
        beret.rotation.x = 0.12;
        eye.add(beret);

        // pędzel wetknięty pod jarzmo jak ołówek za ucho
        const brush = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 10),
            new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.8 }));
        brush.add(handle);
        const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, 0.16, 10), matSteel);
        ferrule.position.y = -0.48;
        brush.add(ferrule);
        const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 10),
            new THREE.MeshStandardMaterial({ color: 0x2e2317, roughness: 0.9 }));
        bristles.rotation.x = Math.PI;
        bristles.position.y = -0.64;
        brush.add(bristles);
        const paintTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
            new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 0.5 }));
        paintTip.position.y = -0.74;
        paintTip.scale.y = 0.5;
        brush.add(paintTip);
        brush.position.set(-1.26, 0.40, 0.05);
        brush.rotation.z = 0.85;
        brush.rotation.x = -0.18;
        yoke.add(brush); // na jarzmie gimbala: nie obraca sie z galka, wiec nie koliduje
    }

    if (variant === 'pilot') {
        // hełm pilota myśliwca (à la rebeliancki X-wing): jasna kopuła,
        // osłony uszu, grzebień z wlotem, bursztynowy wizjer, pasek
        // malowana skorupa: baza off-white + rysy eksploatacyjne + szwy paneli
        function paintedHelmetTexture() {
            const c = document.createElement('canvas');
            c.width = c.height = 512;
            const g = c.getContext('2d');
            g.fillStyle = '#d4d6d8';
            g.fillRect(0, 0, 512, 512);
            // przetarcia i smugi
            for (let i = 0; i < 260; i++) {
                const b = 165 + Math.random() * 60;
                g.strokeStyle = `rgba(${b},${b},${b + 4},${0.10 + Math.random() * 0.18})`;
                g.lineWidth = 1 + Math.random() * 2.5;
                const x = Math.random() * 512, y = Math.random() * 512;
                g.beginPath();
                g.moveTo(x, y);
                g.lineTo(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 24);
                g.stroke();
            }
            // szwy paneli
            g.strokeStyle = 'rgba(90,94,100,0.55)';
            g.lineWidth = 2;
            [150, 360].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); });
            [96, 256, 416].forEach(x => { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, 360); g.stroke(); });
            // pasy eskadry (magenta) wokół kopuły
            g.fillStyle = 'rgba(255,0,255,0.75)';
            g.fillRect(0, 168, 512, 14);
            g.fillStyle = 'rgba(35,37,43,0.9)';
            g.fillRect(0, 186, 512, 5);
            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
        }
        const matHelmet = new THREE.MeshStandardMaterial({ map: paintedHelmetTexture(), color: 0xf2f3f4, metalness: 0.12, roughness: 0.55 });
        const matHelmetPlain = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.15, roughness: 0.55 });
        const matHelmetDark = new THREE.MeshStandardMaterial({ color: 0x23252b, metalness: 0.3, roughness: 0.6 });
        const matDecal = new THREE.MeshStandardMaterial({ color: MAGENTA, emissive: MAGENTA, emissiveIntensity: 0.15, roughness: 0.6 });
        const matVisor = new THREE.MeshStandardMaterial({
            color: 0xe8b431, metalness: 0.25, roughness: 0.06,
            emissive: 0x2a1c04, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false
        });
        const helmet = new THREE.Group();

        // kopuła schodząca nisko na boki i tył
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(1.24, seg, Math.round(18 * LOD), 0, Math.PI * 2, 0, Math.PI * 0.55), matHelmet);
        helmet.add(dome);
        // dolny rant kopuły
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.235 * Math.sin(Math.PI * 0.55), 0.045, 8, seg), matHelmetDark);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 1.24 * Math.cos(Math.PI * 0.55);
        helmet.add(rim);

        // osłony uszu (jak w hełmie z referencji)
        [1, -1].forEach(sgn => {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.52, Math.round(20 * LOD), Math.round(12 * LOD)), matHelmet);
            ear.scale.set(0.32, 1.0, 0.78);
            ear.position.set(sgn * 1.10, -0.18, -0.05);
            helmet.add(ear);
            // panel na osłonie ucha (dekal eskadry)
            const pad = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.14), matDecal);
            pad.position.set(sgn * 1.27, -0.15, 0.02);
            helmet.add(pad);
        });

        // grzebień: podłużna listwa przez środek kopuły
        const crest = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.07, 8, seg, Math.PI * 0.52), matHelmet);
        crest.rotation.y = Math.PI / 2;
        crest.rotation.z = Math.PI * 0.26;
        crest.scale.x = 0.55; // wąska listwa, nie rurka
        helmet.add(crest);
        // blok wlotu powietrza na froncie grzebienia (skośny, z żaluzjami)
        const vent = new THREE.Group();
        vent.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.30), matHelmet));
        for (let i = 0; i < 3; i++) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.028, 0.02), matHelmetDark);
            slat.position.set(0, -0.035 + i * 0.045, 0.15);
            vent.add(slat);
        }
        vent.position.set(0, 0.98, 0.72);
        vent.rotation.x = -0.6;
        helmet.add(vent);

        // bursztynowy wizjer: półprzezroczysta czasza nad obiektywem
        const visor = new THREE.Mesh(
            new THREE.SphereGeometry(1.34, seg2, Math.round(12 * LOD),
                Math.PI * 0.24, Math.PI * 0.52,   // wycinek frontowy
                Math.PI * 0.30, Math.PI * 0.16),  // pas nad obiektywem (czoło)
            matVisor);
        visor.position.z = 0.40;
        visor.scale.set(1.06, 1, 1);
        helmet.add(visor);
        // ciemna listwa mocowania wizjera przy kopule
        const visorRail = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.035, 6, seg, Math.PI * 0.62), matHelmetDark);
        visorRail.rotation.set(Math.PI * 0.42, 0, Math.PI * 0.19);
        visorRail.position.z = 0.10;
        helmet.add(visorRail);

        // dekal eskadry na czole kopuły
        const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, Math.round(18 * LOD)), matDecal);
        emblem.rotation.x = Math.PI * 0.30;
        emblem.position.set(-0.42, 0.78, 0.86);
        helmet.add(emblem);

        // pasek podbródkowy pod gałką
        const strap = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.035, 6, seg, Math.PI * 0.62), matHelmetDark);
        strap.rotation.z = Math.PI + Math.PI * 0.19; // łuk zwisający pod spodem
        strap.rotation.y = Math.PI / 2;
        helmet.add(strap);

        // pody łączności na osłonach uszu + antena
        [1, -1].forEach(sgn => {
            const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.07, Math.round(18 * LOD)), matHelmetDark);
            pod.rotation.z = Math.PI / 2;
            pod.position.set(sgn * 1.36, -0.18, -0.05);
            helmet.add(pod);
            const podLight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x003333, emissive: CYAN, emissiveIntensity: 1.2 }));
            podLight.position.set(sgn * 1.41, -0.18, -0.05);
            helmet.add(podLight);
        });
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.7, 6), matHelmetDark);
        antenna.position.set(1.28, 0.28, -0.42);
        antenna.rotation.z = -0.35;
        antenna.rotation.x = 0.25;
        helmet.add(antenna);
        const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), matDecal);
        antennaTip.position.set(1.40, 0.60, -0.50);
        helmet.add(antennaTip);

        // wysięgnik mikrofonu spod lewej osłony ucha
        {
            const micCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-1.18, -0.42, 0.12),
                new THREE.Vector3(-1.10, -0.78, 0.55),
                new THREE.Vector3(-0.72, -0.92, 0.95)
            ]);
            const micArm = new THREE.Mesh(new THREE.TubeGeometry(micCurve, 10, 0.024, 6), matHelmetDark);
            helmet.add(micArm);
            const micPod = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matHelmetDark);
            micPod.scale.set(1, 0.7, 1.3);
            micPod.position.set(-0.72, -0.92, 0.95);
            helmet.add(micPod);
        }

        // rama wizjera: górna i dolna listwa
        const visorTopRail = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.028, 6, seg, Math.PI * 0.54), matHelmetDark);
        visorTopRail.rotation.set(Math.PI * 0.26, 0, Math.PI * 0.23);
        visorTopRail.position.z = 0.36;
        helmet.add(visorTopRail);
        const visorBotRail = new THREE.Mesh(new THREE.TorusGeometry(1.30, 0.024, 6, seg, Math.PI * 0.50), matHelmetDark);
        visorBotRail.rotation.set(Math.PI * 0.36, 0, Math.PI * 0.25);
        visorBotRail.position.z = 0.40;
        helmet.add(visorBotRail);

        // nity wokół dolnego rantu kopuły
        {
            const rimR = 1.235 * Math.sin(Math.PI * 0.55);
            const rimY = 1.24 * Math.cos(Math.PI * 0.55);
            const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 6, 5), matHelmetDark, 14);
            const m = new THREE.Matrix4();
            for (let i = 0; i < 14; i++) {
                const a = (i / 14) * Math.PI * 2;
                m.makeTranslation(Math.cos(a) * rimR, rimY + 0.07, Math.sin(a) * rimR);
                rivets.setMatrixAt(i, m);
            }
            helmet.add(rivets);
        }

        // emblemat: biała podkładka + znak eskadry
        const emblemBase = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, Math.round(18 * LOD)), matHelmetPlain);
        emblemBase.rotation.x = Math.PI * 0.30;
        emblemBase.position.set(-0.42, 0.77, 0.85);
        helmet.add(emblemBase);

        // klamra na pasku podbródkowym
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.08), matSteel);
        buckle.position.set(0, -1.13, 0.28);
        buckle.rotation.x = 0.4;
        helmet.add(buckle);

        helmet.position.set(0, 0.06, -0.26);
        eye.add(helmet);
    }

    // ========================================================
    // STANY I ANIMACJA
    // ========================================================
    const S = {
        state: 'idle',
        // cel patrzenia (radiany) i aktualna pozycja
        lookX: 0, lookY: 0, curX: 0, curY: 0,
        lookSpeed: 6,
        aperture: 0.55, apertureTarget: 0.55,   // 0 = zamknięta, 1 = szeroko
        blink: 0, blinkTarget: 0,               // 0 = otwarte powieki, 1 = zamknięte
        focus: 0, focusTarget: 0,               // wysuw soczewek
        recoil: 0, recoilTarget: 0,
        ringSpeed: 1, ringSpeedTarget: 1,       // mnożnik pracy mechanizmu
        servoAngle: 0, servoTarget: 0,
        pupilPulse: 0,
        nextBlink: 2 + Math.random() * 4,
        nextServo: 1,
        idleTimer: 0,
        wanderTimer: 0,
        recalTimer: 0,
        sleepDrift: 0,
        speedAvg: 0,
        lastPointer: null,
        // prędkości sprężyn (płynne, krytycznie tłumione ruchy)
        velX: 0, velY: 0, servoVel: 0,
        // lot po ekranie (px, środek oka)
        fx: 0, fy: 0, fvx: 0, fvy: 0, ftx: 0, fty: 0, flightTimer: 0
    };

    // sprężyna: zwraca nową [pozycję, prędkość]; damping <1 daje lekki overshoot
    function spring(pos, vel, target, dt, freq, damping) {
        const f = 1 + 2 * dt * damping * freq;
        const ff = freq * freq;
        const det = 1 / (f + dt * dt * ff);
        const newPos = (pos * f + dt * vel + dt * dt * ff * target) * det;
        const newVel = (vel + dt * ff * (target - pos)) * det;
        return [newPos, newVel];
    }

    // ---- lot po ekranie (element w tle, powolny dryf między punktami) ----
    const eyeSize = () => wrap.clientWidth || 140;
    function pickFlightTarget() {
        const m = eyeSize() * 0.7;
        S.ftx = m + Math.random() * (window.innerWidth - m * 2);
        S.fty = m + Math.random() * (window.innerHeight - m * 2);
        S.flightTimer = 9 + Math.random() * 10;
    }
    S.fx = window.innerWidth * 0.8;
    S.fy = window.innerHeight * 0.72;
    pickFlightTarget();

    const LOOK_MAX_X = 0.55, LOOK_MAX_Y = 0.42;

    function setState(s) {
        if (S.state === s) return;
        S.state = s;
        switch (s) {
            case 'tracking': S.ringSpeedTarget = 1; S.apertureTarget = 0.55; S.focusTarget = 0; S.lookSpeed = 6; break;
            case 'focused': S.ringSpeedTarget = 1.6; S.apertureTarget = 0.85; S.focusTarget = 1; break;
            case 'bored': S.ringSpeedTarget = 0.45; S.apertureTarget = 0.45; S.focusTarget = 0; S.lookSpeed = 2.5; break;
            case 'sleeping': S.ringSpeedTarget = 0.08; S.apertureTarget = 0.12; S.blinkTarget = 0.8; break;
            case 'startled': S.ringSpeedTarget = 2.4; S.apertureTarget = 0.15; S.recoilTarget = 1; break;
            case 'recalibrating': S.ringSpeedTarget = 5; S.recalTimer = 0.9; S.apertureTarget = 0.3; break;
            default: S.ringSpeedTarget = 1; S.apertureTarget = 0.55; S.focusTarget = 0; S.lookSpeed = 6;
        }
        if (s !== 'sleeping') S.blinkTarget = 0;
        if (s !== 'startled') S.recoilTarget = 0;
    }

    function blinkOnce(double) {
        S.blinkTarget = 1;
        setTimeout(() => { if (S.state !== 'sleeping') S.blinkTarget = 0; }, 130);
        if (double) setTimeout(() => {
            S.blinkTarget = 1;
            setTimeout(() => { if (S.state !== 'sleeping') S.blinkTarget = 0; }, 130);
        }, 340);
    }

    // cel patrzenia z pozycji ekranowej (px) względem środka oka
    function lookAtScreen(px, py) {
        const r = wrap.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const nx = (px - cx) / (window.innerWidth * 0.5);
        const ny = (py - cy) / (window.innerHeight * 0.5);
        S.lookX = THREE.MathUtils.clamp(nx, -1, 1) * LOOK_MAX_X;
        S.lookY = THREE.MathUtils.clamp(-ny, -1, 1) * LOOK_MAX_Y;
    }

    // ---- zdarzenia: desktop ----
    if (finePointer && !reducedMotion) {
        let lastT = performance.now();
        window.addEventListener('mousemove', e => {
            const now = performance.now();
            const dt = Math.max(now - lastT, 1) / 1000;
            lastT = now;
            if (S.lastPointer) {
                const dx = e.clientX - S.lastPointer.x, dy = e.clientY - S.lastPointer.y;
                const sp = Math.hypot(dx, dy) / dt; // px/s
                S.speedAvg = S.speedAvg * 0.9 + sp * 0.1;
            }
            S.lastPointer = { x: e.clientX, y: e.clientY };
            S.idleTimer = 0;

            if (S.state === 'sleeping' || S.state === 'bored' || S.state === 'idle') {
                setState('tracking');
                blinkOnce(true); // przebudzenie: podwójne mrugnięcie + rozruch
                S.ringSpeedTarget = 2.5;
                setTimeout(() => { if (S.state === 'tracking') S.ringSpeedTarget = 1; }, 900);
            }
            // rozkalibrowanie przy szaleńczym machaniu
            if (S.speedAvg > 7500 && S.state !== 'recalibrating') setState('recalibrating');

            // wzdrygnięcie gdy kursor tuż przy oku
            const r = wrap.getBoundingClientRect();
            const near = e.clientX > r.left - 30 && e.clientX < r.right + 30 &&
                         e.clientY > r.top - 30 && e.clientY < r.bottom + 30;
            if (near && S.state !== 'startled' && S.state !== 'recalibrating') setState('startled');
            else if (!near && S.state === 'startled') setState('tracking');

            if (S.state === 'tracking' || S.state === 'focused' || S.state === 'startled') {
                lookAtScreen(e.clientX, e.clientY);
            }
        }, { passive: true });

        window.addEventListener('mousedown', () => {
            blinkOnce(false);
            S.aperture = Math.max(0.1, S.aperture - 0.25); // skurcz + powrót sprężynowy
        }, { passive: true });

        // fokus na elementach interaktywnych → zoom soczewek, szeroka przysłona
        document.addEventListener('mouseover', e => {
            if (e.target.closest && e.target.closest('a, button, [role="button"]')) {
                if (S.state === 'tracking') setState('focused');
            }
        }, { passive: true });
        document.addEventListener('mouseout', e => {
            if (S.state === 'focused' && e.target.closest && e.target.closest('a, button, [role="button"]')) {
                setState('tracking');
            }
        }, { passive: true });
    }

    // ---- zdarzenia: wspólne (scroll, dotyk) ----
    if (!reducedMotion) {
        let lastScroll = window.scrollY;
        window.addEventListener('scroll', () => {
            const dy = window.scrollY - lastScroll;
            lastScroll = window.scrollY;
            S.idleTimer = 0;
            if (S.state === 'sleeping') { setState(isMobile ? 'idle' : 'tracking'); blinkOnce(false); }
            // oko zerka w kierunku przewijania
            S.lookY = THREE.MathUtils.clamp(S.lookY - dy * 0.004, -LOOK_MAX_Y, LOOK_MAX_Y);
            S.wanderTimer = Math.max(S.wanderTimer, 0.7);
        }, { passive: true });

        window.addEventListener('touchstart', e => {
            const t = e.touches[0];
            if (!t) return;
            S.idleTimer = 0;
            if (S.state === 'sleeping') { setState('idle'); blinkOnce(true); }
            lookAtScreen(t.clientX, t.clientY);
            blinkOnce(false);
            S.apertureTarget = 0.8;
            setTimeout(() => { if (S.state === 'idle') S.apertureTarget = 0.55; }, 600);
            S.wanderTimer = 1.5;
        }, { passive: true });

        // gyroskop tylko tam, gdzie nie wymaga zgody (Android); iOS pomijamy
        if (isMobile && typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission !== 'function') {
            window.addEventListener('deviceorientation', e => {
                if (e.gamma == null || S.state === 'sleeping') return;
                S.lookX += (THREE.MathUtils.clamp(e.gamma / 45, -1, 1) * 0.15 - S.lookX * 0.05) * 0.02;
            }, { passive: true });
        }
    }

    // ---- pętla ----
    const clock = new THREE.Clock();
    let raf = 0, visible = true, pageVisible = !document.hidden;
    const lerp = (a, b, t) => a + (b - a) * t;

    function tick() {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;

        // --- zegary stanów ---
        S.idleTimer += dt;
        S.speedAvg *= Math.exp(-dt * 2.5);
        if (finePointer) {
            if (S.state === 'tracking' && S.idleTimer > 7) setState('bored');
            if (S.state === 'bored' && S.idleTimer > 20) setState('sleeping');
        } else {
            if (S.state !== 'sleeping' && S.idleTimer > 45) setState('sleeping');
        }
        if (S.state === 'recalibrating') {
            S.recalTimer -= dt;
            // chaotyczne zerkanie podczas rekalibracji
            if (Math.random() < dt * 8) {
                S.lookX = (Math.random() * 2 - 1) * LOOK_MAX_X * 0.45;
                S.lookY = (Math.random() * 2 - 1) * LOOK_MAX_Y * 0.45;
            }
            if (S.recalTimer <= 0) {
                S.speedAvg = 0;
                setState(finePointer ? 'tracking' : 'idle');
                blinkOnce(true);
            }
        }

        // --- autonomiczne rozglądanie (tylko bez śledzenia kursora) ---
        const wandering = isMobile
            ? (S.state !== 'sleeping')
            : (S.state === 'idle' || S.state === 'bored');
        if (wandering) {
            S.wanderTimer -= dt;
            if (S.wanderTimer <= 0) {
                S.lookX = (Math.random() * 2 - 1) * LOOK_MAX_X * 0.8;
                S.lookY = (Math.random() * 2 - 1) * LOOK_MAX_Y * 0.7;
                S.wanderTimer = 2.5 + Math.random() * 4; // rzadko i spokojnie
                if (Math.random() < 0.25) S.servoTarget += (Math.random() < 0.5 ? 1 : -1) * 0.5;
            }
        }
        if (S.state === 'sleeping') {
            // powolne "oddychanie" mechanizmu we śnie
            S.sleepDrift += dt;
            S.lookY = -0.25 + Math.sin(S.sleepDrift * 0.5) * 0.03;
            S.lookX = Math.sin(S.sleepDrift * 0.3) * 0.05;
        }

        // --- mruganie planowe ---
        S.nextBlink -= dt;
        if (S.nextBlink <= 0 && S.state !== 'sleeping') {
            blinkOnce(Math.random() < 0.2);
            S.nextBlink = 3 + Math.random() * 5;
        }

        // --- ruch gałki: sprężyna (sakkada = wyższa częstotliwość + lekki overshoot) ---
        const dist = Math.hypot(S.lookX - S.curX, S.lookY - S.curY);
        const freq = dist > 0.25 ? 11 : S.lookSpeed;
        const damp = dist > 0.25 ? 0.78 : 1; // sakkada delikatnie przestrzeliwuje
        [S.curX, S.velX] = spring(S.curX, S.velX, S.lookX, dt, freq, damp);
        [S.curY, S.velY] = spring(S.curY, S.velY, S.lookY, dt, freq, damp);
        eye.rotation.y = S.curX + Math.sin(t * 0.9) * 0.008; // mikro-drift żywości
        eye.rotation.x = -S.curY + Math.cos(t * 0.7) * 0.006;

        // recoil (wzdrygnięcie): gałka cofa się w głąb
        S.recoil = lerp(S.recoil, S.recoilTarget, 1 - Math.exp(-8 * dt));
        rig.position.z = -S.recoil * 0.45;

        // --- przysłona (mrugnięcie domyka ją do zera jak migawka) ---
        S.aperture = lerp(S.aperture, S.apertureTarget, 1 - Math.exp(-10 * dt));
        const effAperture = S.aperture * (1 - S.blink);
        const bladeAngle = -0.10 - effAperture * 0.85;
        blades.forEach((p, i) => {
            p.children[0].rotation.z = bladeAngle + Math.sin(t * 2 + i) * 0.006;
        });

        // --- mrugnięcie (zamykanie szybkie, otwieranie łagodne) ---
        const blinkRate = S.blinkTarget > S.blink ? 26 : 9;
        S.blink = lerp(S.blink, S.blinkTarget, 1 - Math.exp(-blinkRate * dt));

        // --- praca mechanizmu (nigdy nie zamiera w pełni) ---
        S.ringSpeed = lerp(S.ringSpeed, S.ringSpeedTarget, 1 - Math.exp(-3 * dt));
        const rs = S.ringSpeed;
        ringA.rotation.z += dt * 0.12 * rs + Math.sin(t * 0.8) * 0.0006 * rs; // wolno + oscylacja
        ringB.rotation.z -= dt * 0.30 * rs;                                   // kontra
        gears.forEach(g => { g.rotation.z += dt * g.userData.speed * rs; });

        // pierścień serwo: ruch skokowy z zatrzaskiem
        S.nextServo -= dt * rs;
        if (S.nextServo <= 0) {
            S.servoTarget += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 18);
            S.nextServo = 0.8 + Math.random() * 2;
        }
        [S.servoAngle, S.servoVel] = spring(S.servoAngle, S.servoVel, S.servoTarget, dt, 9, 0.6); // zatrzask z drgnięciem
        ringC.rotation.z = S.servoAngle;
        spokes.rotation.z = -S.servoAngle * 0.5; // przekładnia szprych kontruje serwo
        ringD.rotation.z += dt * 0.05 * rs;

        // --- soczewki: zoom przy fokusowaniu ---
        S.focus = lerp(S.focus, S.focusTarget, 1 - Math.exp(-6 * dt));
        lens2.position.z = 0.10 + S.focus * 0.09 + Math.sin(t * 1.3) * 0.004;
        lensRim.rotation.z += dt * 0.4 * rs * (1 + S.focus * 2);

        // --- źrenica: puls + refleks skanujący ---
        matGlowPupil.emissiveIntensity = 1.9 + Math.sin(t * 2.2) * 0.35 + S.focus * 0.8 - S.blink * 1.2;
        pupilLight.intensity = (1.4 + S.focus) * (1 - S.blink * 0.9);
        scanline.rotation.z += dt * (0.7 + S.focus * 2.5) * rs;
        scanline.material.opacity = 0.25 + Math.sin(t * 3.1) * 0.12;
        const pupilScale = Math.max(0.06, 0.35 + effAperture * 0.75 - S.blink * 0.32);
        pupil.scale.setScalar(pupilScale);
        pupilRing.scale.setScalar(pupilScale);

        // --- diody statusowe: sekwencyjne pulsowanie ---
        leds.forEach((led, i) => {
            led.material.emissiveIntensity = 0.5 + Math.max(0, Math.sin(t * 1.8 + led.userData.phase + i * 2.1)) * 1.4;
        });

        // --- oddech mechanizmu: sub-piksowe unoszenie całości ---
        rig.position.y = Math.sin(t * 0.7) * 0.02;
        yoke.rotation.z = Math.sin(t * 0.4) * 0.015;

        // --- lot po ekranie: powolna sprężyna do celu + sinusoidalny dryf ---
        if (finePointer && S.lastPointer && S.state !== 'sleeping') {
            // dryf za kursorem z zachowaniem dystansu (offset w stronę środka ekranu)
            const p = S.lastPointer;
            const offX = (p.x < window.innerWidth / 2 ? 1 : -1) * 170;
            const offY = (p.y < window.innerHeight / 2 ? 1 : -1) * 130;
            S.ftx = p.x + offX;
            S.fty = p.y + offY;
        } else {
            S.flightTimer -= dt;
            if (S.flightTimer <= 0) pickFlightTarget();
        }
        const driftX = Math.sin(t * 0.31) * 24 + Math.sin(t * 0.13 + 2) * 16;
        const driftY = Math.cos(t * 0.23) * 20 + Math.sin(t * 0.17 + 5) * 14;
        [S.fx, S.fvx] = spring(S.fx, S.fvx, S.ftx + driftX, dt, 0.35, 1);
        [S.fy, S.fvy] = spring(S.fy, S.fvy, S.fty + driftY, dt, 0.35, 1);
        const half = eyeSize() / 2;
        S.fx = THREE.MathUtils.clamp(S.fx, half, window.innerWidth - half);
        S.fy = THREE.MathUtils.clamp(S.fy, half, window.innerHeight - half);
        // przechył w kierunku lotu (banking)
        const bank = THREE.MathUtils.clamp(-S.fvx * 0.0016, -0.18, 0.18) + Math.sin(t * 30) * S.recoil * 0.01;
        rig.rotation.z += (bank - rig.rotation.z) * Math.min(1, dt * 2);
        if (!wrap.dataset.noflight) {
            wrap.style.transform = `translate3d(${(S.fx - half).toFixed(1)}px, ${(S.fy - half).toFixed(1)}px, 0)`;
        }

        renderer.render(scene, camera);
    }

    // ---- rozmiar ----
    function resize() {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(wrap);
    resize();

    // ---- pauza gdy niewidoczne (karta lub element poza ekranem) ----
    function updateRunning() {
        const shouldRun = visible && pageVisible && !reducedMotion;
        if (shouldRun && !raf) { clock.start(); clock.getDelta(); tick(); }
        else if (!shouldRun && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        updateRunning();
    }).observe(wrap);
    document.addEventListener('visibilitychange', () => {
        pageVisible = !document.hidden;
        updateRunning();
    });

    // reduced-motion: jedna statyczna klatka w rogu, mechanizm zatrzymany
    if (reducedMotion) {
        wrap.style.transform = `translate3d(${window.innerWidth - eyeSize() - 24}px, ${window.innerHeight - eyeSize() - 24}px, 0)`;
        blades.forEach(p => { p.children[0].rotation.z = -0.10 - 0.55 * 0.85; });
        renderer.render(scene, camera);
    } else {
        setState(finePointer ? 'idle' : 'idle');
        updateRunning();
    }
    wrap.classList.add('ready');
}
