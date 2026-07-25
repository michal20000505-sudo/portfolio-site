// ========================================================================
// Mechaniczne oko — proceduralny obserwator (Three.js)
// Samodzielna gałka-mechanizm: wielowarstwowa tęczówka z niezależnie
// obracających się pierścieni, przysłona irysowa, zębatki, soczewki
// ogniskujące, mechaniczne powieki. Śledzi kursor (desktop) albo żyje
// własnym życiem (mobile). Stany: idle / tracking / focused / bored /
// sleeping / startled / recalibrating.
// ========================================================================

const wrap = document.getElementById('mech-eye');
if (wrap && window.WebGLRenderingContext) init().catch(err => {
    console.error('[mech-eye] inicjalizacja nieudana:', err);
    wrap.remove();
});

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

    const variant = wrap.dataset.variant || '';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    // ciasny kadr dla samej gałki, luźniejszy gdy dochodzą akcesoria wariantu
    camera.position.set(0, 0, variant ? 6.5 : 5.9);

    // ---- środowisko odbić (proceduralne) ----
    // Bez tego metalness > 0.5 renderuje się CZARNO: metal nie ma rozpraszania
    // Lamberta, odbija wyłącznie otoczenie. Mały equirect (chłodna kopuła +
    // softbox nad obiektem + kicki CMYK z boków) przepuszczony przez PMREM
    // daje jednocześnie odbicia i miękkie światło wypełniające.
    function studioEnvTexture() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 128;
        const g = c.getContext('2d');
        const sky = g.createLinearGradient(0, 0, 0, 128);
        sky.addColorStop(0.00, '#79839a');
        sky.addColorStop(0.40, '#242832');
        sky.addColorStop(0.52, '#12141a');
        sky.addColorStop(1.00, '#06070a');
        g.fillStyle = sky;
        g.fillRect(0, 0, 256, 128);
        // softbox: podłużne źródło nad obiektem — daje ostry pas na chromie
        const box = g.createRadialGradient(96, 13, 2, 96, 13, 34);
        box.addColorStop(0, '#ffffff');
        box.addColorStop(0.5, '#cdd4e0');
        box.addColorStop(1, 'rgba(205,212,224,0)');
        g.fillStyle = box;
        g.fillRect(56, 0, 84, 48);
        // kicki sygnaturowe: cyjan z prawej, magenta z lewej
        const kick = (x, y, r, col) => {
            const gr = g.createRadialGradient(x, y, 2, x, y, r);
            gr.addColorStop(0, col);
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr;
            g.fillRect(x - r, y - r, r * 2, r * 2);
        };
        kick(208, 70, 62, 'rgba(0,255,255,0.24)');
        kick(30, 56, 48, 'rgba(255,0,255,0.4)');
        const tex = new THREE.CanvasTexture(c);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }
    try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const src = studioEnvTexture();
        scene.environment = pmrem.fromEquirectangular(src).texture;
        src.dispose();
        pmrem.dispose();
    } catch (e) {
        // brak env = metale bez odbić; lepiej ciemniejsze oko niż żadne
        console.warn('[mech-eye] brak mapy środowiska:', e);
    }

    // ---- światła: env niesie wypełnienie, punktowe tylko modelują ----
    scene.add(new THREE.HemisphereLight(0xc8d4e8, 0x0a0b0e, 0.30));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(2.2, 3.2, 3.2);
    scene.add(key);
    const cyanFill = new THREE.PointLight(CYAN, 2.2, 9, 2);
    cyanFill.position.set(1.3, -0.7, 2.6);
    scene.add(cyanFill);
    // kontry zza gałki: odrywają sylwetkę od ciemnego tła strony
    const magentaRim = new THREE.PointLight(MAGENTA, 13, 9, 2);
    magentaRim.position.set(-2.3, 1.5, -1.7);
    scene.add(magentaRim);
    const cyanRim = new THREE.PointLight(CYAN, 9, 8, 2);
    cyanRim.position.set(2.4, -1.3, -1.5);
    scene.add(cyanRim);

    // ---- proceduralna tekstura: szczotkowany metal + nity + linie paneli ----
    function brushedMetalTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 512;
        const g = c.getContext('2d');
        g.fillStyle = '#8d94a0';
        g.fillRect(0, 0, 512, 512);
        // szczotkowanie: poziome smugi o losowej jasności
        for (let i = 0; i < 1400; i++) {
            const y = Math.random() * 512;
            const l = 40 + Math.random() * 200;
            const b = 128 + Math.random() * 52;
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
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(2, 1);
        return tex;
    }

    // ---- tekstury tęczówki ----
    // Misa tęczówki jest bryłą obrotową (LatheGeometry): u biegnie po obwodzie,
    // v wzdłuż profilu (v=0 przy źrenicy, v=1 przy rancie). Pionowe smugi w
    // canvasie stają się więc PROMIENISTYMI włóknami, a gradient w pionie —
    // rozjaśnieniem w głąb. Jedna tekstura zastępuje kilkadziesiąt siatek.
    function irisTextures() {
        const W = 512, H = 128;
        // pas włókien w skali szarości (baza dla koloru i emisji)
        const f = document.createElement('canvas');
        f.width = W; f.height = H;
        const gf = f.getContext('2d');
        gf.fillStyle = '#000';
        gf.fillRect(0, 0, W, H);
        for (let i = 0; i < 420; i++) {
            const x = Math.random() * W;
            const w = 0.8 + Math.random() * 3.2;
            const top = Math.random() * 78;          // różna długość włókna
            const b = Math.round(60 + Math.random() * 195);
            const grd = gf.createLinearGradient(0, top, 0, H);
            grd.addColorStop(0, `rgba(${b},${b},${b},0)`);
            grd.addColorStop(0.35, `rgba(${b},${b},${b},${0.35 + Math.random() * 0.45})`);
            grd.addColorStop(1, `rgba(${b},${b},${b},${0.5 + Math.random() * 0.5})`);
            gf.fillStyle = grd;
            gf.fillRect(x, top, w, H - top);
        }
        // kryza wokół źrenicy: jaśniejszy wieniec tuż przy otworze (v≈0 = dół)
        const coll = gf.createLinearGradient(0, H, 0, H * 0.72);
        coll.addColorStop(0, 'rgba(255,255,255,0.55)');
        coll.addColorStop(1, 'rgba(255,255,255,0)');
        gf.fillStyle = coll;
        gf.fillRect(0, H * 0.72, W, H * 0.28);

        // MAPA KOLORU: zimna stal podbita turkusem + ciemny pierścień limbalny
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = '#0e161b';
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.72;
        g.drawImage(f, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        const limbal = g.createLinearGradient(0, 0, 0, H * 0.34);   // v=1 = rant
        limbal.addColorStop(0, 'rgba(3,5,7,0.96)');
        limbal.addColorStop(1, 'rgba(3,5,7,0)');
        g.fillStyle = limbal;
        g.fillRect(0, 0, W, H * 0.34);

        // MAPA EMISJI: świeci od źrenicy w górę, wygaszona przy rancie
        const e = document.createElement('canvas');
        e.width = W; e.height = H;
        const ge = e.getContext('2d');
        ge.drawImage(f, 0, 0);
        ge.globalCompositeOperation = 'multiply';
        const depth = ge.createLinearGradient(0, H, 0, 0);
        depth.addColorStop(0.00, '#ffffff');
        depth.addColorStop(0.40, '#8a8a8a');
        depth.addColorStop(0.78, '#1c1c1c');
        depth.addColorStop(1.00, '#000000');
        ge.fillStyle = depth;
        ge.fillRect(0, 0, W, H);

        const mk = cv => {
            const t = new THREE.CanvasTexture(cv);
            t.colorSpace = THREE.SRGBColorSpace;
            t.wrapS = THREE.RepeatWrapping;
            return t;
        };
        return { map: mk(c), emissiveMap: mk(e) };
    }

    const metalTex = brushedMetalTexture();
    const irisTex = irisTextures();
    // Skorupa jaśnieje względem tęczówki — czytelność opiera się na trzech
    // poziomach walorowych: jasna gałka → ciemna tęczówka → czarna źrenica.
    const matHull = new THREE.MeshStandardMaterial({ map: metalTex, color: 0xdde2ea, metalness: 0.38, roughness: 0.36, envMapIntensity: 1.15 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x1b1d23, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.75 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0xaab3c2, metalness: 0.95, roughness: 0.21, envMapIntensity: 1.12 });
    const matBlade = new THREE.MeshStandardMaterial({ color: 0x1f232a, metalness: 0.45, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.42 });
    const matIris = new THREE.MeshStandardMaterial({
        map: irisTex.map, color: 0x9fb0bd, metalness: 0.5, roughness: 0.45,
        emissive: CYAN, emissiveMap: irisTex.emissiveMap, emissiveIntensity: 1.05,
        side: THREE.DoubleSide, envMapIntensity: 0.85
    });
    // źrenica: prawdziwa czerń, ale polerowana — łapie ostry refleks z env
    const matGlowPupil = new THREE.MeshStandardMaterial({ color: 0x02070a, metalness: 0.1, roughness: 0.55, emissive: CYAN, emissiveIntensity: 0.22, envMapIntensity: 0.5 });
    const matGlowSoft = new THREE.MeshStandardMaterial({ color: 0x001111, emissive: CYAN, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
    const matLens = new THREE.MeshStandardMaterial({ color: 0x0b2b2e, metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    // rogówka: czarna baza + metalness 1 + blending addytywne renderuje SAMO
    // odbicie środowiska — mokry refleks, który wędruje po gałce przy obrocie.
    // To on sprawia, że mechanizm czyta się jako oko, a nie jako obiektyw.
    const matCornea = new THREE.MeshStandardMaterial({
        color: 0xa8c0d0, metalness: 1, roughness: 0.145,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, envMapIntensity: 1.2
    });

    // ================= GAŁKA =================
    const eye = new THREE.Group();      // obraca się (patrzenie)
    const rig = new THREE.Group();      // recoil / drgnięcia całości
    rig.add(eye);
    scene.add(rig);

    const seg = Math.round(48 * LOD), seg2 = Math.round(32 * LOD);
    // Skorupa z WYCIĘTYM przednim biegunem: tęczówka ma siedzieć w oczodole,
    // wewnątrz bryły, a nie być do niej doklejona od frontu. Dopiero recesja
    // za rantem daje cień własny i głębię, po której oko czyta się jako oko.
    // 0.62 promienia gałki: tęczówka zajmuje ~57% szerokości bryły. Szerzej
    // (pierwotne 0.80) optyka zjada całą kulę i całość czyta się jak obiektyw.
    const SOCKET_R = 0.62;
    const socketTheta = Math.asin(SOCKET_R);       // kąt otwarcia oczodołu
    const ball = new THREE.Mesh(
        new THREE.SphereGeometry(1, seg, seg2, 0, Math.PI * 2, socketTheta, Math.PI - socketTheta), matHull);
    ball.rotation.x = Math.PI / 2;                 // biegun geometrii → oś patrzenia
    eye.add(ball);
    // ciemna wykładzina oczodołu — zasłania tło widziane przez wycięcie
    const socketLiner = new THREE.Mesh(
        new THREE.SphereGeometry(0.985, seg, seg2, 0, Math.PI * 2, socketTheta, Math.PI - socketTheta),
        new THREE.MeshStandardMaterial({ color: 0x0e1014, metalness: 0.5, roughness: 0.6, side: THREE.BackSide }));
    socketLiner.rotation.x = Math.PI / 2;
    eye.add(socketLiner);

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

    // ---- przedni zespół optyczny ----
    // Zasada kompozycji: MECHANIZM WYCHODZI Z OSI PATRZENIA. Pierścienie,
    // zębatki i podziałki siedzą na kołnierzu wokół tubusa, a nie na wprost
    // źrenicy — dzięki temu tęczówka zostaje czysta i oko czyta się jako oko,
    // a nie jako celownik HUD. W głąb: rant (chrom) → misa tęczówki →
    // przysłona → czarna źrenica, a nad wszystkim wypukła rogówka.
    // Układ w osi Z (lokalnie): rant 0.00 → misa −0.42 → listki −0.44 →
    // źrenica −0.60. Rogówka wybrzusza się do +0.32. Kołnierz mechanizmu
    // siedzi za rantem, na obrzeżu skorupy.
    const SOCKET_Z = Math.sqrt(1 - SOCKET_R * SOCKET_R);     // płaszczyzna rantu
    const optics = new THREE.Group();
    optics.position.z = SOCKET_Z;
    optics.scale.setScalar(SOCKET_R / 0.80);   // geometria optyki liczona dla r=0.80
    eye.add(optics);

    // Kołnierz mechanizmu jest OSOBNĄ grupą na skorupie, nie w grupie optyki:
    // maszyneria ma obrączkować oczodół, a nie leżeć na osi patrzenia.
    const collar = new THREE.Group();
    eye.add(collar);

    // stożkowa płyta czołowa: przechodzi z obrysu skorupy w rant oczodołu
    // i domyka szczelinę między maszynerią a kulą
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.635, 0.845, 0.23, seg, 1, true), matHull);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.665;
    collar.add(barrel);

    // szczeliny wentylacyjne na obrzeżu płyty
    {
        const vents = new THREE.InstancedMesh(new THREE.BoxGeometry(0.028, 0.075, 0.05), matDark, 18);
        const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            e.set(0, 0, a); q.setFromEuler(e);
            m.compose(new THREE.Vector3(Math.cos(a) * 0.815, Math.sin(a) * 0.815, 0.585), q, sc);
            vents.setMatrixAt(i, m);
        }
        collar.add(vents);
    }

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

    // RING A — podziałka kalibracyjna na kołnierzu (wolny obrót)
    const ringA = new THREE.Group();
    ringA.add(new THREE.Mesh(new THREE.TorusGeometry(0.775, 0.024, 8, seg), matHull));
    ringA.add(tickRing(Math.round(56 * LOD), 0.775, 0.012, 0.048, 0.05, matDark, 0));
    ringA.position.z = 0.628;
    collar.add(ringA);

    // RING B — wieniec zębaty (kontr-rotacja)
    const ringB = new THREE.Group();
    ringB.add(new THREE.Mesh(new THREE.TorusGeometry(0.715, 0.034, 8, seg), matSteel));
    ringB.add(tickRing(Math.round(44 * LOD), 0.748, 0.042, 0.034, 0.06, matSteel, 0));
    ringB.position.z = 0.688;
    collar.add(ringB);

    // RING C — pierścień serwo (ruch skokowy, sakkadowy)
    const ringC = new THREE.Group();
    for (let i = 0; i < 6; i++) {
        const arc = new THREE.Mesh(
            new THREE.CylinderGeometry(0.678, 0.678, 0.06, Math.round(12 * LOD), 1, true, (i / 6) * Math.PI * 2 + 0.09, Math.PI / 3 - 0.18),
            matBlade
        );
        arc.rotation.x = Math.PI / 2;
        ringC.add(arc);
    }
    ringC.add(tickRing(12, 0.678, 0.018, 0.018, 0.085, matGlowSoft, 0));
    ringC.position.z = 0.735;
    collar.add(ringC);

    // promieniste szprychy między wieńcem a serwo
    const spokes = new THREE.Group();
    {
        const spokeGeo = new THREE.BoxGeometry(0.085, 0.02, 0.02);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
            const sp = new THREE.Mesh(spokeGeo, matSteel);
            sp.position.set(Math.cos(a) * 0.700, Math.sin(a) * 0.700, 0);
            sp.rotation.z = a;
            spokes.add(sp);
        }
    }
    spokes.position.z = 0.712;
    collar.add(spokes);

    // małe zębatki zazębione z wieńcem (widoczna przekładnia)
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
    [[0.575, 0.500, 1.7], [-0.705, -0.245, -2.2], [0.130, -0.755, 1.3]].forEach(([x, y, speed]) => {
        const g = smallGear(10, 0.048);
        g.position.set(x, y, 0.668);
        g.userData.speed = speed;
        collar.add(g);
        gears.push(g);
    });

    // ---- rant: jasny chromowany pierścień obejmujący tęczówkę ----
    // Najjaśniejszy element bryły — to on rysuje sylwetkę oka na ciemnym tle
    // i oddziela mechanizm (na zewnątrz) od optyki (wewnątrz).
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.80, 0.072, Math.round(16 * LOD), seg), matSteel);
    bezel.position.z = 0.0;
    optics.add(bezel);

    // śruby na rancie
    const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6);
    const bolts = new THREE.InstancedMesh(boltGeo, matDark, 8);
    {
        const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            m.compose(new THREE.Vector3(Math.cos(a) * 0.800, Math.sin(a) * 0.800, 0.618), q, new THREE.Vector3(1, 1, 1));
            bolts.setMatrixAt(i, m);
        }
    }
    collar.add(bolts);

    // diody statusowe na kołnierzu (cyjan ×2 + żółta interpunkcja ruchu)
    const matLedCyan = new THREE.MeshStandardMaterial({ color: 0x002222, emissive: CYAN, emissiveIntensity: 1.5 });
    const matLedYellow = new THREE.MeshStandardMaterial({ color: 0x222200, emissive: 0xffff00, emissiveIntensity: 1.2 });
    const leds = [];
    [[Math.PI * 0.25, matLedCyan], [Math.PI * 0.75, matLedCyan], [Math.PI * 1.5, matLedYellow]].forEach(([a, mat]) => {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), mat.clone());
        led.position.set(Math.cos(a) * 0.735, Math.sin(a) * 0.735, 0.700);
        led.userData.phase = a * 3;
        collar.add(led);
        leds.push(led);
    });

    // RING D — jedyny świetlny pierścień: obwódka limbalna tuż pod rantem
    const ringD = new THREE.Group();
    ringD.add(tickRing(28, 0.745, 0.055, 0.016, 0.02, matGlowSoft, 0));
    ringD.position.z = -0.03;
    optics.add(ringD);

    // ---- MISA TĘCZÓWKI ----
    // Bryła obrotowa o schodkowym profilu: tarasy zwrócone do kamery łapią
    // softbox, pionowe ścianki — boczne kicki. Toczony wygląd i realna głębia
    // (0.42 jednostki) zamiast płaskiego krążka. Jedna siatka, jeden draw call.
    const IRIS_INNER = 0.42, IRIS_OUTER = 0.735, IRIS_DEPTH = 0.42;
    {
        const STEPS = 5;
        const dr = (IRIS_OUTER - IRIS_INNER) / STEPS, dz = IRIS_DEPTH / STEPS;
        const prof = [new THREE.Vector2(IRIS_INNER, 0)];
        let r = IRIS_INNER, z = 0;
        for (let i = 0; i < STEPS; i++) {
            r += dr; prof.push(new THREE.Vector2(r, z));          // taras
            z += dz; prof.push(new THREE.Vector2(r, z));          // podstopnica
        }
        const dish = new THREE.Mesh(new THREE.LatheGeometry(prof, seg), matIris);
        dish.rotation.x = Math.PI / 2;    // profil w Y → oś optyczna w Z
        dish.position.z = -IRIS_DEPTH;    // rant misy licuje z rantem oczodołu
        optics.add(dish);
    }
    // ścianka komory poniżej tęczówki — zamyka wnętrze i daje cień własny
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(IRIS_INNER, IRIS_INNER, 0.18, seg, 1, true), matDark);
    chamber.rotation.x = Math.PI / 2;
    chamber.position.z = -0.51;
    optics.add(chamber);

    // ---- PRZYSŁONA IRYSOWA — 12 listków ----
    // Pełni obie role naraz: rozwarcie = rozszerzanie źrenicy, pełne domknięcie
    // = mrugnięcie (migawka). Sworznie tuż za krawędzią misy, więc przy szeroko
    // otwartej przysłonie listki chowają się za ścianką komory.
    const IRIS_R = 0.455;      // promień okręgu sworzni
    const blades = [];
    const irisGroup = new THREE.Group();
    irisGroup.position.z = -0.44;
    optics.add(irisGroup);
    {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.25, 0.035, 0.50, -0.07);   // krawędź natarcia
        shape.quadraticCurveTo(0.32, 0.22, 0.10, 0.20);     // krawędź spływu
        shape.quadraticCurveTo(0.02, 0.11, 0, 0);
        const bladeGeo = new THREE.ShapeGeometry(shape, 6);
        for (let i = 0; i < 12; i++) {
            const pivot = new THREE.Group();
            const a = (i / 12) * Math.PI * 2;
            pivot.position.set(Math.cos(a) * IRIS_R, Math.sin(a) * IRIS_R, (i % 2) * 0.009);
            pivot.rotation.z = a + Math.PI; // listek celuje do środka
            const blade = new THREE.Mesh(bladeGeo, matBlade);
            blade.rotation.y = -0.14;   // lekki stożek: płaskie listki nie łapały światła
            pivot.add(blade);
            irisGroup.add(pivot);
            blades.push(pivot);
        }
    }

    // ---- źrenica: czarne dno komory z gorącą obwódką ----
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(IRIS_INNER, seg2), matGlowPupil);
    pupil.position.z = -0.60;
    optics.add(pupil);
    const matPupilRim = matGlowSoft.clone();
    matPupilRim.emissiveIntensity = 1.4;
    const pupilRing = new THREE.Mesh(new THREE.RingGeometry(IRIS_INNER * 0.82, IRIS_INNER, seg2), matPupilRim);
    pupilRing.position.z = -0.593;
    optics.add(pupilRing);
    const pupilLight = new THREE.PointLight(CYAN, 1.6, 3.5, 2);
    pupilLight.position.z = -0.18;  // wewnątrz komory: rozświetla misę od środka
    optics.add(pupilLight);
    const scanline = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.012),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    scanline.position.z = -0.30;
    optics.add(scanline);

    // ---- stos soczewek w komorze (ogniskowanie = przesuw w osi Z) ----
    const lensStack = new THREE.Group();
    lensStack.position.z = -0.56;
    optics.add(lensStack);
    const lens1 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, seg2), matLens);
    lens1.rotation.x = Math.PI / 2;
    lensStack.add(lens1);
    const lens2 = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, seg2), matLens);
    lens2.rotation.x = Math.PI / 2;
    lens2.position.z = 0.10;
    lensStack.add(lens2);
    const lensRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.016, 8, seg2), matSteel);
    lensStack.add(lensRim);

    // ---- ROGÓWKA ----
    // Wypukła czasza nad całą optyką. Renderuje wyłącznie odbicie środowiska
    // (patrz matCornea), więc przy obracaniu gałki refleks softboxu wędruje po
    // niej tak jak po mokrym oku. To najtańszy i najsilniejszy sygnał "to oko".
    {
        const R = 1.10, rimR = 0.76, rimZ = 0.02;
        const cornea = new THREE.Mesh(
            new THREE.SphereGeometry(R, seg, Math.round(16 * LOD), 0, Math.PI * 2, 0, Math.asin(rimR / R)),
            matCornea);
        cornea.rotation.x = Math.PI / 2;                          // biegun → +Z
        cornea.position.z = rimZ - Math.sqrt(R * R - rimR * rimR); // rant czaszy na rancie optyki
        cornea.renderOrder = 2;
        optics.add(cornea);
    }

    // Mrugnięcie = migawka: pełne domknięcie przysłony irysowej (bez powiek —
    // wielkie czasze wyglądały, jakby pojawiały się znikąd i okalały oko).

    // ---- akcesoria per podstrona (data-variant na #mech-eye) ----
    let pilotVisor = null; // pivot przyłbicy (animowana w pętli)

    if (variant === 'painter') {
        // czapka malarska (beret) + pędzel za "uchem"
        const matFabric = new THREE.MeshStandardMaterial({ color: 0x2b2d36, metalness: 0.05, roughness: 0.92, envMapIntensity: 0.4 });
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
        const matHelmet = new THREE.MeshStandardMaterial({ map: paintedHelmetTexture(), color: 0xb7bcc4, metalness: 0.1, roughness: 0.62, envMapIntensity: 0.55 });
        const matHelmetPlain = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.15, roughness: 0.6, envMapIntensity: 0.5 });
        const matHelmetDark = new THREE.MeshStandardMaterial({ color: 0x23252b, metalness: 0.3, roughness: 0.6 });
        const matDecal = new THREE.MeshStandardMaterial({ color: MAGENTA, emissive: MAGENTA, emissiveIntensity: 0.15, roughness: 0.6 });
        const matVisor = new THREE.MeshStandardMaterial({
            color: 0xe8b431, metalness: 0.25, roughness: 0.06,
            emissive: 0x2a1c04, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false
        });
        const helmet = new THREE.Group();

        // Kopuła MUSI kończyć się nad oczodołem. Tęczówka jest teraz cofnięta
        // w bryłę, więc każda czasza obejmująca gałkę wchodzi w zagłębienie i
        // zasłania oko od środka — hełm jest czapą na wierzchu, nie skorupą.
        const DOME_R = 1.16, DOME_THETA = Math.PI * 0.311;
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(DOME_R, seg, Math.round(18 * LOD), 0, Math.PI * 2, 0, DOME_THETA), matHelmet);
        helmet.add(dome);
        // dolny rant kopuły
        const DOME_RIM_R = (DOME_R - 0.005) * Math.sin(DOME_THETA);
        const DOME_RIM_Y = DOME_R * Math.cos(DOME_THETA);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(DOME_RIM_R, 0.045, 8, seg), matHelmetDark);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = DOME_RIM_Y;
        helmet.add(rim);

        // osłony uszu (jak w hełmie z referencji)
        [1, -1].forEach(sgn => {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.52, Math.round(20 * LOD), Math.round(12 * LOD)), matHelmet);
            ear.scale.set(0.32, 1.0, 0.78);
            ear.position.set(sgn * 1.02, -0.04, -0.14);
            helmet.add(ear);
            // panel na osłonie ucha (dekal eskadry)
            const pad = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.14), matDecal);
            pad.position.set(sgn * 1.19, -0.01, -0.07);
            helmet.add(pad);
        });

        // grzebień: podłużna listwa przez środek kopuły
        const crest = new THREE.Mesh(new THREE.TorusGeometry(1.19, 0.07, 8, seg, Math.PI * 0.36), matHelmet);
        crest.rotation.y = Math.PI / 2;
        crest.rotation.z = Math.PI * 0.32;
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
        vent.position.set(0, 0.86, 0.74);
        vent.rotation.x = -0.6;
        helmet.add(vent);

        // Przyłbica na zawiasach. KLUCZOWE: oś obrotu pokrywa się ze środkiem
        // sfery szyby, więc podnoszona ślizga się po kopule zamiast odlatywać
        // nad hełm po długim ramieniu (tak było, gdy pivot siedział na skroni).
        const HINGE_Y = 0.34;
        pilotVisor = new THREE.Group();
        pilotVisor.position.set(0, 0, 0.10);
        helmet.add(pilotVisor);

        // szyba: dwie warstwy dla głębi (zewnętrzna glossy + wewnętrzna przydymiona)
        const visorGeoArgs = [
            Math.PI * 0.24, Math.PI * 0.52,   // wycinek frontowy
            Math.PI * 0.30, Math.PI * 0.17    // pas na wysokości oczodołu
        ];
        const visorOuter = new THREE.Mesh(
            new THREE.SphereGeometry(1.21, seg2, Math.round(12 * LOD), ...visorGeoArgs),
            new THREE.MeshPhysicalMaterial({
                color: 0xe8b431, metalness: 0.1, roughness: 0.08,
                clearcoat: 1, clearcoatRoughness: 0.08,
                transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false
            }));
        const visorInner = new THREE.Mesh(
            new THREE.SphereGeometry(1.17, seg2, Math.round(12 * LOD), ...visorGeoArgs),
            new THREE.MeshStandardMaterial({
                color: 0x6b4a10, metalness: 0.2, roughness: 0.3,
                transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false
            }));
        [visorOuter, visorInner].forEach(v => {
            v.scale.set(1.05, 1, 1);
            pilotVisor.add(v);
        });

        // rama szyby: górna i dolna listwa jadą razem z przyłbicą
        const visorTopRail2 = new THREE.Mesh(new THREE.TorusGeometry(1.192, 0.028, 6, seg, Math.PI * 0.50), matHelmetDark);
        visorTopRail2.rotation.set(Math.PI * 0.275, 0, Math.PI * 0.25);
        pilotVisor.add(visorTopRail2);
        const visorBotRail2 = new THREE.Mesh(new THREE.TorusGeometry(1.184, 0.024, 6, seg, Math.PI * 0.46), matHelmetDark);
        visorBotRail2.rotation.set(Math.PI * 0.385, 0, Math.PI * 0.27);
        pilotVisor.add(visorBotRail2);

        // zawiasy na "skroniach" (widoczne pokrętła, oś obrotu przyłbicy)
        [1, -1].forEach(sgn => {
            const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, Math.round(14 * LOD)), matHelmetDark);
            hinge.rotation.z = Math.PI / 2;
            hinge.position.set(sgn * 1.13, 0.02, 0.10);
            helmet.add(hinge);
            const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 6), matSteel);
            knob.rotation.z = Math.PI / 2;
            knob.position.set(sgn * 1.17, 0.02, 0.10);
            helmet.add(knob);
        });

        // dekal eskadry na czole kopuły
        const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, Math.round(18 * LOD)), matDecal);
        emblem.rotation.x = Math.PI * 0.30;
        emblem.position.set(-0.40, 0.74, 0.79);
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
            pod.position.set(sgn * 1.28, -0.04, -0.14);
            helmet.add(pod);
            const podLight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x003333, emissive: CYAN, emissiveIntensity: 1.2 }));
            podLight.position.set(sgn * 1.33, -0.04, -0.14);
            helmet.add(podLight);
        });
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.7, 6), matHelmetDark);
        antenna.position.set(1.12, 0.42, -0.52);
        antenna.rotation.z = -0.35;
        antenna.rotation.x = 0.25;
        helmet.add(antenna);
        const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), matDecal);
        antennaTip.position.set(1.24, 0.74, -0.60);
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

        // nity wokół dolnego rantu kopuły
        {
            const rimR = DOME_RIM_R, rimY = DOME_RIM_Y;
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
        emblemBase.position.set(-0.40, 0.73, 0.78);
        helmet.add(emblemBase);

        // klamra na pasku podbródkowym
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.08), matSteel);
        buckle.position.set(0, -1.13, 0.28);
        buckle.rotation.x = 0.4;
        helmet.add(buckle);

        helmet.position.set(0, -0.05, -0.18);
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
        aperture: 0.66, apertureTarget: 0.66,   // 0 = zamknięta, 1 = szeroko
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
        fx: 0, fy: 0, fvx: 0, fvy: 0, ftx: 0, fty: 0, flightTimer: 0,
        // reflektor: podświetlany element interaktywny + dobór miejsca lotu
        spotEl: null, occTimer: 0, followX: 170, followY: 130,
        visorOpen: 1
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

    // Czy punkt na ekranie przykrywa treść (tekst/obraz/przycisk)?
    // elementsFromPoint pomija pointer-events:none, więc oko, kursor
    // i nakładki reflektora nie liczą się same do wyniku.
    const CONTENT_SEL = 'img, picture, video, figure, svg, canvas, h1, h2, h3, h4, h5, h6, p, li, a, button, input, textarea, blockquote, table';
    function contentAt(x, y) {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
        const els = document.elementsFromPoint(x, y);
        for (const el of els) {
            if (el.matches && el.matches(CONTENT_SEL)) return true;
        }
        return false;
    }
    // im mniej próbek trafia w treść, tym lepsze miejsce dla oka
    function occlusionScore(cx, cy) {
        const r = eyeSize() * 0.45;
        let score = 0;
        if (contentAt(cx, cy)) score++;
        if (contentAt(cx - r, cy)) score++;
        if (contentAt(cx + r, cy)) score++;
        if (contentAt(cx, cy - r)) score++;
        if (contentAt(cx, cy + r)) score++;
        return score;
    }

    function pickFlightTarget() {
        const m = eyeSize() * 0.7;
        // kilka losowych kandydatów; wybieramy najmniej zasłonięty
        let bestX = 0, bestY = 0, bestScore = Infinity;
        for (let i = 0; i < 6 && bestScore > 0; i++) {
            const x = m + Math.random() * (window.innerWidth - m * 2);
            const y = m + Math.random() * (window.innerHeight - m * 2);
            const sc = occlusionScore(x, y);
            if (sc < bestScore) { bestScore = sc; bestX = x; bestY = y; }
        }
        S.ftx = bestX;
        S.fty = bestY;
        S.flightTimer = 9 + Math.random() * 10;
    }
    S.fx = window.innerWidth * 0.8;
    S.fy = window.innerHeight * 0.72;
    pickFlightTarget();

    const LOOK_MAX_X = 0.55, LOOK_MAX_Y = 0.42;

    // ---- nakładki DOM: snop reflektora + plama światła + dymek ----
    let beamEl = null, spotGlowEl = null, hintEl = null;
    if (!wrap.dataset.noflight && !reducedMotion) {
        const style = document.createElement('style');
        style.textContent = `
            #eye-beam, #eye-spot-glow {
                position: fixed; top: 0; left: 0; pointer-events: none; z-index: -1;
                opacity: 0; transition: opacity 0.45s cubic-bezier(0.23, 1, 0.32, 1);
            }
            #eye-beam {
                height: 90px;
                transform-origin: left center;
                background: linear-gradient(90deg, rgba(0,255,255,0.16), rgba(0,255,255,0.05) 65%, transparent);
                clip-path: polygon(0 42%, 100% 0, 100% 100%, 0 58%);
            }
            #eye-spot-glow {
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0,255,255,0.14), rgba(0,255,255,0.05) 55%, transparent 70%);
            }
            #eye-hint {
                position: fixed; top: 0; left: 0; z-index: 950; pointer-events: none;
                background: #101014; border: 1px solid rgba(0,255,255,0.6); border-radius: 10px;
                padding: 9px 16px; font-family: 'Space Grotesk', system-ui, sans-serif;
                font-size: 0.85rem; font-weight: 500; letter-spacing: 0.04em; color: #fff;
                white-space: nowrap; opacity: 0; transform: translateY(6px);
                transition: opacity 0.5s cubic-bezier(0.23, 1, 0.32, 1), transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
            }
            #eye-hint.show { opacity: 1; transform: translateY(0); }
            #eye-hint::after {
                content: ''; position: absolute; left: 50%; bottom: -6px; margin-left: -6px;
                width: 10px; height: 10px; background: #101014;
                border-right: 1px solid rgba(0,255,255,0.6); border-bottom: 1px solid rgba(0,255,255,0.6);
                transform: rotate(45deg);
            }`;
        document.head.appendChild(style);
        beamEl = document.createElement('div');
        beamEl.id = 'eye-beam';
        spotGlowEl = document.createElement('div');
        spotGlowEl.id = 'eye-spot-glow';
        // przed #mech-eye, żeby snop rysował się pod okiem
        document.body.insertBefore(beamEl, wrap);
        document.body.insertBefore(spotGlowEl, wrap);
    }

    // dymek "kliknij mnie" na stronie głównej, raz na sesję, po 3 s
    const isIndex = /(?:^|\/)(?:index\.html)?$/.test(location.pathname);
    if (!wrap.dataset.noflight && !wrap.dataset.nolink && !reducedMotion &&
        isIndex && !sessionStorage.getItem('eyeHintShown')) {
        setTimeout(() => {
            sessionStorage.setItem('eyeHintShown', '1');
            hintEl = document.createElement('div');
            hintEl.id = 'eye-hint';
            hintEl.textContent = 'hej, możesz mnie kliknąć!';
            document.body.appendChild(hintEl);
            requestAnimationFrame(() => hintEl.classList.add('show'));
            const dismiss = () => {
                if (!hintEl) return;
                hintEl.classList.remove('show');
                setTimeout(() => { hintEl && hintEl.remove(); hintEl = null; }, 600);
                document.removeEventListener('click', dismiss);
            };
            setTimeout(dismiss, 8000);
            document.addEventListener('click', dismiss);
        }, 3000);
    }

    function setState(s) {
        if (S.state === s) return;
        S.state = s;
        wrap.dataset.eyeState = s; // stan czytelny dla strony (np. podgląd na oko.html)
        switch (s) {
            case 'tracking': S.ringSpeedTarget = 1; S.apertureTarget = 0.66; S.focusTarget = 0; S.lookSpeed = 6; break;
            case 'focused': S.ringSpeedTarget = 1.6; S.apertureTarget = 0.92; S.focusTarget = 1; break;
            case 'bored': S.ringSpeedTarget = 0.45; S.apertureTarget = 0.54; S.focusTarget = 0; S.lookSpeed = 2.5; break;
            case 'sleeping': S.ringSpeedTarget = 0.08; S.apertureTarget = 0.12; S.blinkTarget = 0.8; break;
            case 'startled': S.ringSpeedTarget = 2.4; S.apertureTarget = 0.15; S.recoilTarget = 1; break;
            case 'recalibrating': S.ringSpeedTarget = 5; S.recalTimer = 0.9; S.apertureTarget = 0.3; break;
            default: S.ringSpeedTarget = 1; S.apertureTarget = 0.66; S.focusTarget = 0; S.lookSpeed = 6;
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

        // fokus na elementach interaktywnych → zoom soczewek, szeroka przysłona,
        // szybszy dolot i reflektor na cel
        document.addEventListener('mouseover', e => {
            const el = e.target.closest && e.target.closest('a, button, [role="button"]');
            if (el) {
                if (S.state === 'tracking') setState('focused');
                S.spotEl = el;
            }
        }, { passive: true });
        document.addEventListener('mouseout', e => {
            if (e.target.closest && e.target.closest('a, button, [role="button"]')) {
                if (S.state === 'focused') setState('tracking');
                S.spotEl = null;
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
            S.apertureTarget = 0.9;
            setTimeout(() => { if (S.state === 'idle') S.apertureTarget = 0.66; }, 600);
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
        const bladeAngle = -0.05 - effAperture * 1.0;
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

        // --- tęczówka i źrenica ---
        // Nośnikiem "życia" jest teraz świecenie misy, a nie jasność źrenicy:
        // źrenica ma zostać czarną dziurą, inaczej oko czyta się jako dioda.
        const pulse = Math.sin(t * 2.2);
        matIris.emissiveIntensity = 0.95 + pulse * 0.14 + S.focus * 0.8 - S.blink * 0.62;
        matGlowPupil.emissiveIntensity = Math.max(0, 0.18 + pulse * 0.05 + S.focus * 0.3 - S.blink * 0.18);
        matPupilRim.emissiveIntensity = 1.1 + pulse * 0.35 + S.focus * 1.2 - S.blink * 0.9;
        pupilLight.intensity = (0.55 + S.focus * 0.8) * effAperture * 2 * (1 - S.blink * 0.9);
        scanline.rotation.z += dt * (0.7 + S.focus * 2.5) * rs;
        scanline.material.opacity = (0.09 + Math.sin(t * 3.1) * 0.05) * (1 - S.blink);
        // źrenica lekko "oddycha" — reszta rozwarcia to praca listków przysłony
        const pupilScale = 0.86 + effAperture * 0.14;
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
        let flightFreq = 0.35;
        if (S.spotEl && !document.contains(S.spotEl)) S.spotEl = null;
        if (S.spotEl && S.state !== 'sleeping') {
            // reflektor: szybszy dolot w pobliże elementu, po jego zewnętrznej stronie
            const r = S.spotEl.getBoundingClientRect();
            const ecx = r.left + r.width / 2, ecy = r.top + r.height / 2;
            let dx = S.fx - ecx, dy = S.fy - ecy;
            const dl = Math.hypot(dx, dy) || 1;
            const standoff = Math.max(r.width, r.height) / 2 + eyeSize() * 0.85;
            S.ftx = ecx + (dx / dl) * standoff;
            S.fty = ecy + (dy / dl) * standoff;
            flightFreq = 0.95; // "podlatuje nieco szybciej"
        } else if (finePointer && S.lastPointer && S.state !== 'sleeping') {
            // dryf za kursorem; okresowo wybieramy ćwiartkę najmniej zasłoniętą treścią
            const p = S.lastPointer;
            S.occTimer -= dt;
            if (S.occTimer <= 0) {
                S.occTimer = 0.5;
                let best = Infinity;
                for (const sx of [1, -1]) for (const sy of [1, -1]) {
                    const sc = occlusionScore(p.x + sx * 170, p.y + sy * 130);
                    if (sc < best) { best = sc; S.followX = sx * 170; S.followY = sy * 130; }
                }
            }
            S.ftx = p.x + S.followX;
            S.fty = p.y + S.followY;
        } else {
            S.flightTimer -= dt;
            if (S.flightTimer <= 0) pickFlightTarget();
        }
        const driftX = Math.sin(t * 0.31) * 24 + Math.sin(t * 0.13 + 2) * 16;
        const driftY = Math.cos(t * 0.23) * 20 + Math.sin(t * 0.17 + 5) * 14;
        [S.fx, S.fvx] = spring(S.fx, S.fvx, S.ftx + driftX, dt, flightFreq, 1);
        [S.fy, S.fvy] = spring(S.fy, S.fvy, S.fty + driftY, dt, flightFreq, 1);
        const half = eyeSize() / 2;
        S.fx = THREE.MathUtils.clamp(S.fx, half, window.innerWidth - half);
        S.fy = THREE.MathUtils.clamp(S.fy, half, window.innerHeight - half);
        // przechył w kierunku lotu (banking)
        const bank = THREE.MathUtils.clamp(-S.fvx * 0.0016, -0.18, 0.18) + Math.sin(t * 30) * S.recoil * 0.01;
        rig.rotation.z += (bank - rig.rotation.z) * Math.min(1, dt * 2);
        if (!wrap.dataset.noflight) {
            wrap.style.transform = `translate3d(${(S.fx - half).toFixed(1)}px, ${(S.fy - half).toFixed(1)}px, 0)`;
        }

        // --- przyłbica pilota: spoczywa podniesiona, opada we śnie ---
        if (pilotVisor) {
            // Pozycja spoczynkowa = PODNIESIONA. Opuszczona zakrywała tęczówkę,
            // czyli jedyny nośnik wyrazu; teraz opada dopiero na drzemkę.
            const wantOpen = (S.state === 'sleeping' && !wrap.dataset.visoropen) ? 0 : 1;
            S.visorOpen = lerp(S.visorOpen, wantOpen, 1 - Math.exp(-4 * dt));
            pilotVisor.rotation.x = -0.92 * S.visorOpen;
        }

        // --- reflektor: snop światła z oka na podświetlany element ---
        if (beamEl) {
            if (S.spotEl && S.state !== 'sleeping') {
                const r = S.spotEl.getBoundingClientRect();
                const ecx = r.left + r.width / 2, ecy = r.top + r.height / 2;
                const bdx = ecx - S.fx, bdy = ecy - S.fy;
                const dist = Math.hypot(bdx, bdy);
                beamEl.style.width = dist.toFixed(0) + 'px';
                beamEl.style.transform =
                    `translate3d(${S.fx.toFixed(1)}px, ${(S.fy - 45).toFixed(1)}px, 0) rotate(${Math.atan2(bdy, bdx)}rad)`;
                beamEl.style.opacity = '1';
                const gw = Math.max(r.width, r.height) * 1.5;
                spotGlowEl.style.width = spotGlowEl.style.height = gw.toFixed(0) + 'px';
                spotGlowEl.style.transform =
                    `translate3d(${(ecx - gw / 2).toFixed(1)}px, ${(ecy - gw / 2).toFixed(1)}px, 0)`;
                spotGlowEl.style.opacity = '1';
            } else {
                beamEl.style.opacity = '0';
                spotGlowEl.style.opacity = '0';
            }
        }

        // --- dymek podąża za okiem (nad nim, w granicach ekranu) ---
        if (hintEl) {
            const hw = hintEl.offsetWidth || 200;
            const hx = THREE.MathUtils.clamp(S.fx - hw / 2, 10, window.innerWidth - hw - 10);
            const hy = Math.max(10, S.fy - half - 52);
            hintEl.style.transform = `translate3d(${hx.toFixed(1)}px, ${hy.toFixed(1)}px, 0)` +
                (hintEl.classList.contains('show') ? '' : ' translateY(6px)');
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
        if (!raf) renderer.render(scene, camera);   // stoimy: odrysuj klatkę
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

    // reduced-motion: jedna statyczna klatka, mechanizm zatrzymany
    if (reducedMotion) {
        if (!wrap.dataset.noflight) {
            wrap.style.transform = `translate3d(${window.innerWidth - eyeSize() - 24}px, ${window.innerHeight - eyeSize() - 24}px, 0)`;
        }
        // pętla nie ruszy, więc ustawiamy ręcznie to, co normalnie liczy tick()
        blades.forEach(p => { p.children[0].rotation.z = -0.05 - 0.66; });
        matIris.emissiveIntensity = 0.95;
        matGlowPupil.emissiveIntensity = 0.18;
        matPupilRim.emissiveIntensity = 1.1;
        pupilLight.intensity = 0.73;
        renderer.render(scene, camera);
    } else {
        setState(finePointer ? 'idle' : 'idle');
        updateRunning();
    }
    wrap.dataset.eyeState = S.state;

    // ---- klikalne oko: wejście na podgląd (oko.html) ----
    // Oko jest w tle (pointer-events: none), więc klik łapiemy na dokumencie
    // i sprawdzamy, czy trafił w prostokąt oka poza elementami interaktywnymi.
    if (!wrap.dataset.nolink) {
        const overEye = e => {
            const r = wrap.getBoundingClientRect();
            return e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top && e.clientY <= r.bottom;
        };
        const interactive = e => e.target.closest &&
            e.target.closest('a, button, input, textarea, select, [role="button"], canvas, .viewer');
        document.addEventListener('click', e => {
            if (overEye(e) && !interactive(e)) {
                window.location.href = 'oko.html' + (variant ? '?variant=' + variant : '');
            }
        });
        // afordancja: kursor rośnie nad okiem jak nad linkiem
        const cursorEl = document.querySelector('.cursor');
        if (cursorEl && finePointer) {
            window.addEventListener('mousemove', e => {
                cursorEl.classList.toggle('eye-link', overEye(e) && !interactive(e));
            }, { passive: true });
        }
    }

    wrap.classList.add('ready');
}
