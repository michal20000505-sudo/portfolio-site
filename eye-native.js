/*
 * Nowe oko natywne dla strony głównej.
 * Proceduralny model jest celowo osobnym modułem: eye.js pozostaje kopią
 * poprzedniego obserwatora i nadal obsługuje stronę oko.html.
 */
const wrap = document.getElementById('mech-eye');

if (wrap && window.WebGLRenderingContext) boot().catch(error => {
    console.error('[eye-native]', error);
    wrap.remove();
});

async function boot() {
    const THREE = await import('three');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const mobile = !finePointer;

    wrap.style.pointerEvents = 'auto';
    wrap.style.zIndex = '4';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Mechaniczne oko. Kliknij, aby otworzyć pełny podgląd.');

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.8));
    renderer.setSize(1, 1, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(29, 1, .1, 20);
    camera.position.set(0, 0, 5.9);

    // Małe, proceduralne studio, aby metal miał odbicia także bez dodatkowych plików.
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 256; envCanvas.height = 128;
    const envCtx = envCanvas.getContext('2d');
    const envGradient = envCtx.createLinearGradient(0, 0, 0, 128);
    envGradient.addColorStop(0, '#73808c'); envGradient.addColorStop(.44, '#1e2931'); envGradient.addColorStop(1, '#06090b');
    envCtx.fillStyle = envGradient; envCtx.fillRect(0, 0, 256, 128);
    envCtx.fillStyle = '#e5f2f1'; envCtx.fillRect(74, 8, 38, 50);
    envCtx.fillStyle = '#36c6cc'; envCtx.fillRect(205, 54, 24, 54);
    const env = new THREE.CanvasTexture(envCanvas);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(env).texture;
    env.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xcfe8ec, 0x0a1014, 1.5));
    const key = new THREE.DirectionalLight(0xf5ffff, 2.8); key.position.set(-2, 3, 4); scene.add(key);
    const cyan = new THREE.PointLight(0x20e1e5, 2.7, 7); cyan.position.set(2, -.8, 3); scene.add(cyan);
    const rim = new THREE.PointLight(0xff55c9, 3.4, 8); rim.position.set(-2, 1, -2); scene.add(rim);

    const mat = {
        shell: new THREE.MeshStandardMaterial({ color: 0xc6d0d3, metalness: .84, roughness: .28 }),
        darkShell: new THREE.MeshStandardMaterial({ color: 0x263740, metalness: .79, roughness: .32 }),
        edge: new THREE.MeshStandardMaterial({ color: 0x93aab2, metalness: .95, roughness: .2 }),
        black: new THREE.MeshStandardMaterial({ color: 0x071116, metalness: .5, roughness: .2 }),
        copper: new THREE.MeshStandardMaterial({ color: 0xb4835e, metalness: .9, roughness: .27 }),
        iris: new THREE.MeshStandardMaterial({ color: 0x37a4ae, emissive: 0x156d79, emissiveIntensity: .56, metalness: .48, roughness: .34 }),
        aperture: new THREE.MeshStandardMaterial({ color: 0x7ca0aa, emissive: 0x113c45, emissiveIntensity: .2, metalness: .72, roughness: .27, side: THREE.DoubleSide })
    };
    const root = new THREE.Group(); scene.add(root);
    const body = new THREE.Group(); root.add(body);
    const optics = new THREE.Group(); body.add(optics);
    const eye = new THREE.Group(); body.add(eye);
    const lids = new THREE.Group(); body.add(lids);
    const parts = [];
    const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
        const object = new THREE.Mesh(geometry, material);
        object.position.set(x, y, z); parent.add(object); return object;
    };
    const torus = (radius, tube, material, parent, z = 0, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(radius, tube, 10, 72, arc), material, parent, 0, 0, z);

    // Segmentowana skorupa, dzięki której nowy model jest czytelny także w małym rozmiarze.
    for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        const plate = mesh(new THREE.SphereGeometry(1.02, 16, 20, angle + .025, Math.PI / 6 - .05, .8, 1.84), i % 3 ? mat.shell : mat.darkShell, body);
        plate.rotation.x = Math.PI / 2;
        plate.userData.home = new THREE.Vector3(-Math.cos(angle + Math.PI / 12), Math.sin(angle + Math.PI / 12), -.1);
        parts.push(plate);
    }
    mesh(new THREE.SphereGeometry(.96, 32, 20), mat.black, body, 0, 0, -.02);
    torus(.82, .06, mat.edge, optics, .73);
    torus(.75, .025, mat.copper, optics, .86);
    torus(.69, .012, mat.iris, optics, .9);
    mesh(new THREE.CircleGeometry(.675, 72), mat.black, optics, 0, 0, .88);

    // Promienista tęczówka z wygrawerowanymi włóknami.
    const irisCanvas = document.createElement('canvas'); irisCanvas.width = irisCanvas.height = 256;
    const irisCtx = irisCanvas.getContext('2d');
    const irisGradient = irisCtx.createRadialGradient(128, 128, 25, 128, 128, 128);
    irisGradient.addColorStop(0, '#07151b'); irisGradient.addColorStop(.18, '#164e5a'); irisGradient.addColorStop(.64, '#4bbac0'); irisGradient.addColorStop(1, '#0d3541');
    irisCtx.fillStyle = irisGradient; irisCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 580; i++) {
        const a = i * Math.PI * 2 / 580;
        const wobble = Math.sin(i * 9.17) * .02;
        const inner = 45 + Math.abs(Math.sin(i * 12.6)) * 18;
        const outer = 106 + Math.abs(Math.sin(i * 3.7)) * 22;
        irisCtx.strokeStyle = i % 4 ? `rgba(174,244,239,${.08 + (i % 9) / 25})` : 'rgba(4,31,40,.7)';
        irisCtx.lineWidth = i % 5 ? .55 : 1.2;
        irisCtx.beginPath();
        irisCtx.moveTo(128 + Math.cos(a) * inner, 128 + Math.sin(a) * inner);
        irisCtx.lineTo(128 + Math.cos(a + wobble) * outer, 128 + Math.sin(a + wobble) * outer);
        irisCtx.stroke();
    }
    const irisTexture = new THREE.CanvasTexture(irisCanvas); irisTexture.colorSpace = THREE.SRGBColorSpace;
    mat.iris.map = irisTexture; mat.iris.emissiveMap = irisTexture;
    mesh(new THREE.RingGeometry(.28, .64, 96), mat.iris, eye, 0, 0, .93);
    torus(.29, .017, mat.copper, eye, .98);
    mesh(new THREE.CircleGeometry(.275, 64), mat.black, eye, 0, 0, .99);

    // Szerokie listki przysłony: są z przodu soczewki i kontrastują z tęczówką.
    const aperture = new THREE.Group(); optics.add(aperture);
    const apertureBlades = [];
    for (let i = 0; i < 9; i++) {
        const shape = new THREE.Shape();
        shape.moveTo(.25, -.02);
        shape.quadraticCurveTo(.34, -.18, .62, -.2);
        shape.lineTo(.69, .02);
        shape.quadraticCurveTo(.42, .1, .25, .1);
        shape.closePath();
        const pivot = new THREE.Group(); pivot.rotation.z = i * Math.PI * 2 / 9; pivot.position.z = 1.04 + i * .002; aperture.add(pivot);
        const blade = mesh(new THREE.ShapeGeometry(shape), mat.aperture, pivot);
        blade.rotation.z = -.08;
        apertureBlades.push({ pivot, blade });
    }
    torus(.28, .012, mat.copper, aperture, 1.065);

    // Mechaniczne powieki są półokrągłymi tarczami, bez prostokątnych płyt.
    function lidGeometry(side) {
        const radius = .76, segments = 48;
        const positions = [0, 0, 0];
        for (let i = 0; i <= segments; i++) {
            const a = side > 0 ? Math.PI * i / segments : Math.PI + Math.PI * i / segments;
            positions.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
        }
        const indices = [];
        for (let i = 0; i < segments; i++) indices.push(0, i + 1, i + 2);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        return geometry;
    }
    const lidTop = mesh(lidGeometry(1), mat.shell, lids, 0, .43, 1.22);
    const lidBottom = mesh(lidGeometry(-1), mat.shell, lids, 0, -.43, 1.22);
    torus(.77, .018, mat.copper, lids, 1.235);

    // Małe moduły boczne wzmacniają wrażenie zawieszenia.
    const gimbal = torus(1.16, .025, mat.edge, root, -.12, Math.PI * 1.55); gimbal.rotation.set(.2, -.35, .5);
    const gimbalGlow = torus(1.165, .01, mat.iris, root, -.11, .46); gimbalGlow.rotation.copy(gimbal.rotation);
    [-1, 1].forEach(side => {
        const pod = new THREE.Group(); pod.position.set(side * 1.05, -.2, -.1); root.add(pod);
        mesh(new THREE.CylinderGeometry(.11, .08, .25, 18), mat.black, pod).rotation.x = Math.PI / 2;
        mesh(new THREE.SphereGeometry(.042, 12, 8), mat.copper, pod, 0, 0, .14);
    });

    let width = 1, height = 1, eyeSize = 120;
    const pointer = { x: innerWidth * .8, y: innerHeight * .8, seen: false };
    const position = { x: innerWidth - 90, y: innerHeight - 90 };
    let targetPosition = { ...position }, nextDrift = 0, blinkAt = 4 + Math.random() * 3;
    let elapsed = 0, previous = 0, blinkStart = -10, apertureSize = .29;
    let hint = null, hintTimer = null, clicked = false;
    const clamp = THREE.MathUtils.clamp;

    function resize() {
        width = innerWidth; height = innerHeight;
        const rect = wrap.getBoundingClientRect();
        eyeSize = Math.max(76, Math.min(rect.width || 120, 160));
        renderer.setSize(eyeSize, eyeSize, false);
        camera.aspect = 1; camera.updateProjectionMatrix();
        if (!targetPosition.x || !targetPosition.y) targetPosition = { x: width - eyeSize / 2 - 28, y: height - eyeSize / 2 - 28 };
    }
    resize(); window.addEventListener('resize', resize, { passive: true });

    function showHint(text = 'hej, możesz mnie kliknąć!') {
        if (reduced || hint || sessionStorage.getItem('eyeHintShown')) return;
        sessionStorage.setItem('eyeHintShown', '1');
        hint = document.createElement('div'); hint.id = 'eye-hint'; hint.textContent = text; document.body.appendChild(hint);
        hintTimer = setTimeout(() => hint?.classList.add('show'), 30);
        setTimeout(() => { hint?.classList.remove('show'); setTimeout(() => hint?.remove(), 500); hint = null; }, 7200);
    }
    setTimeout(showHint, 2200);
    wrap.addEventListener('click', () => {
        clicked = true; blinkStart = elapsed; apertureSize = .18;
        wrap.classList.add('eye-active');
        if (hint) { hint.classList.remove('show'); hint = null; }
        setTimeout(() => wrap.classList.remove('eye-active'), 700);
    });
    wrap.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); wrap.click(); }
    });
    wrap.addEventListener('dblclick', () => { window.location.href = 'oko.html'; });
    window.addEventListener('mousemove', event => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.seen = true; }, { passive: true });

    function drift(t) {
        if (reduced || mobile) return;
        if (t < nextDrift) return;
        nextDrift = t + 8 + Math.random() * 5;
        const margin = eyeSize * .7;
        targetPosition = { x: clamp(width * (.67 + Math.random() * .25), margin, width - margin), y: clamp(height * (.48 + Math.random() * .35), margin, height - margin) };
    }
    function updateHint() {
        if (!hint) return;
        const rect = wrap.getBoundingClientRect();
        const hw = hint.offsetWidth || 205;
        hint.style.transform = `translate3d(${clamp(rect.left + rect.width / 2 - hw / 2, 12, width - hw - 12)}px,${Math.max(12, rect.top - 48)}px,0)`;
    }
    function tick(now) {
        requestAnimationFrame(tick);
        const dt = Math.min((now - (previous || now)) / 1000, .05); previous = now; elapsed += dt;
        drift(elapsed);
        const smooth = 1 - Math.exp(-dt * 2.8);
        position.x += (targetPosition.x - position.x) * smooth;
        position.y += (targetPosition.y - position.y) * smooth;
        wrap.style.transform = `translate3d(${position.x - eyeSize / 2}px,${position.y - eyeSize / 2}px,0)`;
        const lookX = pointer.seen ? clamp((pointer.x - position.x) / width * .9, -.35, .35) : -.13;
        const lookY = pointer.seen ? clamp((pointer.y - position.y) / height * .6, -.24, .24) : -.1;
        body.rotation.y += (lookX - body.rotation.y) * smooth;
        body.rotation.x += (lookY - body.rotation.x) * smooth;
        body.rotation.z += (-((targetPosition.x - position.x) * .001) - body.rotation.z) * smooth;
        const floating = reduced ? 0 : Math.sin(elapsed * 1.35) * .035;
        root.position.y = floating;
        gimbal.rotation.z = .5 + Math.sin(elapsed * .55) * .1;
        gimbalGlow.rotation.z = gimbal.rotation.z;
        aperture.rotation.z += (elapsed * .025 - aperture.rotation.z) * smooth;
        const asleep = !clicked && elapsed > 30 && !pointer.seen;
        if (elapsed > blinkAt && !asleep) { blinkStart = elapsed; blinkAt = elapsed + 3.8 + Math.random() * 4; }
        const phase = elapsed - blinkStart;
        const blink = phase < 0 || phase > .42 ? 0 : Math.sin(phase / .42 * Math.PI);
        const closed = asleep ? .97 : blink;
        const lidOffset = .43 - closed * .39;
        lidTop.position.y = lidOffset; lidBottom.position.y = -lidOffset;
        const desiredAperture = clicked ? .3 : asleep ? .12 : .29 + Math.sin(elapsed * .9) * .018;
        apertureSize += (desiredAperture - apertureSize) * (1 - Math.exp(-dt * 5));
        apertureBlades.forEach(({ pivot }) => { pivot.position.x = (apertureSize - .29) * .18; });
        mat.iris.emissiveIntensity = asleep ? .25 : 0.46 + Math.sin(elapsed * 2) * .06;
        updateHint();
        renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
    wrap.classList.add('ready');
}
