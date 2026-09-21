import * as THREE from 'three';

// OBSERVER / 01. All surfaces and moving parts are built here, independently
// of the demo page. +Z is the optical axis; dimensions are in model units.
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;

function canvasTexture(size, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    paint(canvas.getContext('2d'), size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

function seededRandom(seed = 1091) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function metalTexture() {
    return canvasTexture(1024, (ctx, n) => {
        const random = seededRandom();
        ctx.fillStyle = '#c9c5bd'; ctx.fillRect(0, 0, n, n);
        for (let i = 0; i < 32000; i++) {
            const a = random() * .13;
            ctx.fillStyle = `rgba(${random() > .5 ? '38,28,18' : '255,255,255'},${a})`;
            ctx.fillRect(random() * n, random() * n, random() * 2 + .4, random() * 3 + .4);
        }
        for (let i = 0; i < 650; i++) {
            const x = random() * n, y = random() * n;
            ctx.strokeStyle = `rgba(39,31,22,${random() * .17})`;
            ctx.lineWidth = .3 + random() * 1.1;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 30, y - random() * 9); ctx.stroke();
        }
        // Small clusters of worn paint, not a uniform noise layer.
        for (let i = 0; i < 210; i++) {
            const x = random() * n, y = random() * n;
            for (let j = 0; j < 18; j++) {
                ctx.fillStyle = `rgba(65,47,29,${random() * .48})`;
                ctx.fillRect(x + random() * 18, y + random() * 9, random() * 3.5, random() * 2.5);
            }
        }
    });
}

function irisTexture() {
    return canvasTexture(1024, (ctx, n) => {
        const r = n / 2, random = seededRandom(82);
        const gradient = ctx.createRadialGradient(r, r, 145, r, r, r);
        gradient.addColorStop(0, '#031b25'); gradient.addColorStop(.12, '#038091');
        gradient.addColorStop(.4, '#13b8ce'); gradient.addColorStop(.68, '#07677f');
        gradient.addColorStop(.93, '#07313d'); gradient.addColorStop(1, '#020c13');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, n, n);
        for (let i = 0; i < 480; i++) {
            const a = i / 480 * TAU, inner = 180 + random() * 130, outer = 375 + random() * 130;
            ctx.strokeStyle = i % 4 ? `rgba(80,227,248,${random() * .22})` : 'rgba(0,13,22,.45)';
            ctx.lineWidth = random() + .5;
            ctx.beginPath(); ctx.moveTo(r + Math.cos(a) * inner, r + Math.sin(a) * inner);
            ctx.lineTo(r + Math.cos(a + .008) * outer, r + Math.sin(a + .008) * outer); ctx.stroke();
        }
        for (let i = 0; i < 96; i++) {
            ctx.save(); ctx.translate(r, r); ctx.rotate(i / 96 * TAU);
            ctx.fillStyle = i % 3 ? 'rgba(80,238,255,.5)' : '#a0f6ff';
            ctx.fillRect(330 + (i % 4) * 12, -1, 32 + random() * 60, i % 4 ? 2 : 4);
            ctx.fillStyle = 'rgba(0,27,41,.45)'; ctx.fillRect(220, 2, 185, 3);
            ctx.fillStyle = `rgba(38,231,250,${.1 + random() * .35})`;
            ctx.fillRect(225 + random() * 20, -5, 112 + random() * 62, 4 + random() * 3);
            ctx.restore();
        }
    });
}

// Bevelled, extruded annular plate, with deliberate stepped ends like machined armor.
function plateGeometry(inner, outer, span, depth = .065, stepped = true) {
    const shape = new THREE.Shape();
    const half = span / 2;
    const point = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    shape.moveTo(...point(inner + .07, -half));
    shape.lineTo(...point(outer - .09, -half));
    shape.quadraticCurveTo(...point(outer, -half), ...point(outer, -half + .075));
    for (let i = 1; i <= 28; i++) {
        const a = -half + .075 + (span - .15) * i / 28;
        const radius = stepped && i > 19 ? outer - .075 : outer;
        shape.lineTo(...point(radius, a));
    }
    shape.quadraticCurveTo(...point(outer - .075, half), ...point(outer - .15, half));
    shape.lineTo(...point(inner + .06, half));
    shape.quadraticCurveTo(...point(inner, half), ...point(inner, half - .065));
    for (let i = 1; i <= 28; i++) shape.lineTo(...point(inner, half - .065 - (span - .13) * i / 28));
    shape.quadraticCurveTo(...point(inner, -half), ...point(inner + .07, -half));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .012, bevelSize: .013, bevelSegments: 2, curveSegments: 16, steps: 1 });
    // Planar texture mapping keeps scratches and dirt a consistent size on all armor.
    const uv = geometry.attributes.uv, p = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * .47 + .5, p.getY(i) * .47 + .5);
    return geometry;
}

export function buildObserver() {
    const root = new THREE.Group();
    const texture = metalTexture(), irisMap = irisTexture();
    // Armor UVs are in machining-space and intentionally extend beyond 0..1.
    // Repeat avoids clamping the majority of each plate to one texture column.
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    const materials = {
        armor: new THREE.MeshStandardMaterial({ map: texture, color: 0xf2efea, metalness: .58, roughness: .36, bumpMap: texture, bumpScale: .004 }),
        silver: new THREE.MeshStandardMaterial({ color: 0xb0b3b1, metalness: .94, roughness: .23 }),
        graphite: new THREE.MeshStandardMaterial({ color: 0x22292c, metalness: .82, roughness: .31 }),
        black: new THREE.MeshStandardMaterial({ color: 0x070d10, metalness: .48, roughness: .34 }),
        brass: new THREE.MeshStandardMaterial({ color: 0x92704a, metalness: .88, roughness: .28 }),
        cyan: new THREE.MeshStandardMaterial({ color: 0x26d7e8, emissive: 0x05caec, emissiveIntensity: 2.2, metalness: .2, roughness: .23 }),
        amber: new THREE.MeshStandardMaterial({ color: 0xffbb5b, emissive: 0xff9a2b, emissiveIntensity: 2, roughness: .25 }),
        iris: new THREE.MeshStandardMaterial({ map: irisMap, emissiveMap: irisMap, emissive: 0x43d7eb, emissiveIntensity: 1.25, metalness: .45, roughness: .22 }),
        pupil: new THREE.MeshPhysicalMaterial({ color: 0x010d15, metalness: .28, roughness: .055, clearcoat: 1, clearcoatRoughness: .025 }),
        lens: new THREE.MeshPhysicalMaterial({ color: 0x489baa, metalness: .05, roughness: .035, transparent: true, opacity: .12, clearcoat: 1, depthWrite: false }),
        shutter: new THREE.MeshStandardMaterial({ color: 0x4b575b, metalness: .72, roughness: .37, side: THREE.DoubleSide }),
    };
    const geometries = new Map();
    const geo = (key, create) => { if (!geometries.has(key)) geometries.set(key, create()); return geometries.get(key); };
    const mesh = (geometry, material, parent = root, x = 0, y = 0, z = 0) => {
        const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m;
    };
    const group = (parent = root, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const ring = (r, t, material, parent = root, z = 0, span = TAU, rotation = 0) => {
        const m = mesh(geo(`ring-${r}-${t}-${span}`, () => new THREE.TorusGeometry(r, t, 8, Math.max(16, Math.round(96 * span / TAU)), span)), material, parent, 0, 0, z);
        m.rotation.z = rotation; return m;
    };
    const cylinder = (r, length, material, parent, z = 0, r2 = r) => {
        const m = mesh(geo(`cyl-${r}-${r2}-${length}`, () => new THREE.CylinderGeometry(r, r2, length, 40)), material, parent, 0, 0, z);
        m.rotation.x = Math.PI / 2; return m;
    };
    const box = (x, y, z, material, parent, px = 0, py = 0, pz = 0) => mesh(geo(`box-${x}-${y}-${z}`, () => new THREE.BoxGeometry(x, y, z)), material, parent, px, py, pz);
    const instances = (geometry, material, transforms, parent) => {
        const m = new THREE.InstancedMesh(geometry, material, transforms.length);
        const dummy = new THREE.Object3D();
        transforms.forEach((t, i) => {
            dummy.position.set(...t.p); dummy.rotation.set(...(t.r || [0, 0, 0])); dummy.scale.setScalar(t.s || 1);
            dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
        });
        parent.add(m); return m;
    };
    function bolts(points, parent, size = 1) {
        instances(geo('bolt-seat', () => new THREE.TorusGeometry(.04, .012, 6, 12)), materials.black, points.map(p => ({ p, s: size })), parent);
        instances(geo('bolt-head', () => new THREE.CylinderGeometry(.027, .027, .014, 6)), materials.silver, points.map(p => ({ p: [p[0], p[1], p[2] + .005], r: [Math.PI / 2, 0, 0], s: size })), parent);
        instances(geo('bolt-slot', () => new THREE.BoxGeometry(.022, .007, .006)), materials.black, points.map(p => ({ p: [p[0], p[1], p[2] + .016], r: [0, 0, p[0] * 3], s: size })), parent);
    }
    function radialPoints(count, r, z, offset = 0) {
        return Array.from({ length: count }, (_, i) => [Math.cos(i / count * TAU + offset) * r, Math.sin(i / count * TAU + offset) * r, z]);
    }
    function gear(radius, count, parent, z, material = materials.graphite) {
        const g = group(parent, 0, 0, z);
        ring(radius, .035, material, g);
        instances(geo(`teeth-${radius}-${count}`, () => new THREE.BoxGeometry(.055, TAU * radius / count * .55, .055)), material,
            radialPoints(count, radius, 0).map((p, i) => ({ p, r: [0, 0, i / count * TAU] })), g);
        return g;
    }
    function label(text, width, height, parent, x, y, z, rotation = 0) {
        const map = canvasTexture(512, ctx => {
            ctx.clearRect(0, 0, 512, 512); ctx.fillStyle = '#202b2f';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 52px monospace';
            const lines = text.split('\n'); lines.forEach((line, i) => ctx.fillText(line, 256, 256 + (i - (lines.length - 1) / 2) * 64));
        });
        const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        const m = mesh(new THREE.PlaneGeometry(width, height), mat, parent, x, y, z); m.rotation.z = rotation; return m;
    }
    function cable(points, radius, parent, material = materials.black) {
        const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
        mesh(new THREE.TubeGeometry(curve, 56, radius, 7, false), material, parent);
        // Ribbed sheath and metal couplers follow the actual curve.
        const torus = geo(`cable-rib-${radius}`, () => new THREE.TorusGeometry(radius * 1.03, .005, 4, 8));
        const ribs = new THREE.InstancedMesh(torus, materials.graphite, 64), dummy = new THREE.Object3D();
        for (let i = 0; i < 64; i++) {
            const t = i / 63; dummy.position.copy(curve.getPoint(t)); dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(t));
            dummy.updateMatrix(); ribs.setMatrixAt(i, dummy.matrix);
        }
        parent.add(ribs);
        [.07, .86].forEach(t => {
            const c = cylinder(radius * 1.45, .075, materials.brass, parent);
            c.position.copy(curve.getPoint(t)); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(t));
        });
    }

    // Bend armor and its attached hardware together over a spherical chassis.
    // This prevents the flat washer silhouette of the previous prototype.
    function conformPanel(parent, inner = 1.05, radius = 1.7, amount = .85) {
        const offset = r => (Math.sqrt(Math.max(.03, radius * radius - r * r)) - Math.sqrt(radius * radius - inner * inner)) * amount;
        parent.children.forEach(object => {
            if (!object.isMesh) return;
            object.updateMatrix();
            if (object.isInstancedMesh) {
                const matrix = new THREE.Matrix4(), p = new THREE.Vector3();
                for (let i = 0; i < object.count; i++) {
                    object.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix); p.z += offset(Math.hypot(p.x, p.y)); matrix.setPosition(p); object.setMatrixAt(i, matrix);
                }
                object.instanceMatrix.needsUpdate = true;
            } else {
                const source = object.geometry;
                object.geometry = source.type === 'ExtrudeGeometry' ? subdivideSurface(source) : source.clone();
                object.geometry.computeVertexNormals();
                const originalNormals = object.geometry.attributes.normal.array.slice();
                const positions = object.geometry.attributes.position, p = new THREE.Vector3(), inverse = object.matrix.clone().invert();
                for (let i = 0; i < positions.count; i++) {
                    p.fromBufferAttribute(positions, i).applyMatrix4(object.matrix); p.z += offset(Math.hypot(p.x, p.y)); p.applyMatrix4(inverse); positions.setXYZ(i, p.x, p.y, p.z);
                }
                object.geometry.computeVertexNormals();
                if (source.type === 'ExtrudeGeometry') {
                    smoothNormals(object.geometry);
                    const normals = object.geometry.attributes.normal, n = new THREE.Vector3();
                    for (let i = 0; i < positions.count; i++) if (Math.abs(originalNormals[i * 3 + 2]) > .999) {
                        p.fromBufferAttribute(positions, i).applyMatrix4(object.matrix);
                        const height = Math.sqrt(Math.max(.03, radius * radius - p.x * p.x - p.y * p.y));
                        n.set(amount * p.x / height, amount * p.y / height, 1).normalize().multiplyScalar(Math.sign(originalNormals[i * 3 + 2]));
                        n.transformDirection(inverse); normals.setXYZ(i, n.x, n.y, n.z);
                    }
                }
                // Non-cached geometries have no other owner after bending.
                if (![...geometries.values()].includes(source)) source.dispose();
            }
        });
    }
    function subdivideSurface(geometry) {
        const positions = geometry.attributes.position, uvs = geometry.attributes.uv, out = [], tex = [];
        function split(a, b, c, depth) {
            const d = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
            const ab = d(a, b), bc = d(b, c), ca = d(c, a), max = Math.max(ab, bc, ca);
            if (max > .017 && depth < 6) {
                if (max === bc) [a, b, c] = [b, c, a]; else if (max === ca) [a, b, c] = [c, a, b];
                const m = a.map((v, i) => (v + b[i]) * .5);
                split(a, m, c, depth + 1); split(m, b, c, depth + 1);
            } else for (const p of [a, b, c]) { out.push(p[0], p[1], p[2]); tex.push(p[3], p[4]); }
        }
        const point = i => [positions.getX(i), positions.getY(i), positions.getZ(i), uvs.getX(i), uvs.getY(i)];
        for (let i = 0; i < positions.count; i += 3) split(point(i), point(i + 1), point(i + 2), 0);
        const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); result.setAttribute('uv', new THREE.Float32BufferAttribute(tex, 2)); return result;
    }
    function smoothNormals(geometry) {
        const normals = geometry.attributes.normal, p = geometry.attributes.position, shared = new Map();
        const key = i => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
        for (let i = 0; i < p.count; i++) {
            const k = key(i), n = shared.get(k) || new THREE.Vector3(); n.x += normals.getX(i); n.y += normals.getY(i); n.z += normals.getZ(i); shared.set(k, n);
        }
        shared.forEach(n => n.normalize());
        for (let i = 0; i < p.count; i++) { const n = shared.get(key(i)); normals.setXYZ(i, n.x, n.y, n.z); }
    }

    // The dark pressure vessel is behind the optics, never a sphere intersecting the lens.
    const chassis = group();
    const vessel = mesh(new THREE.SphereGeometry(1.32, 64, 40), materials.black, chassis, 0, 0, -.27);
    vessel.scale.z = .75;
    [-.78, -.45, -.1, .24].forEach((z, i) => ring(1.22 + Math.sin(i / 3 * Math.PI) * .16, .045, i % 2 ? materials.brass : materials.graphite, chassis, z));
    for (let i = 0; i < 8; i++) {
        const scale = mesh(new THREE.SphereGeometry(1.43, 18, 18, i / 8 * TAU + .045, TAU / 8 - .14, 1.19, 1.35), materials.armor, chassis, 0, 0, -.1);
        scale.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        const rib = group(chassis); rib.rotation.z = a;
        const arch = ring(1.3, .036, materials.silver, rib, -.1, 1.45, -.73);
        arch.rotation.y = Math.PI / 2;
        box(.1, .27, .19, materials.graphite, rib, 1.22, 0, .13);
        box(.12, .055, .23, materials.brass, rib, 1.28, 0, .2);
    }

    const mechanism = group(root, 0, 0, -.22);
    const drive = gear(1.23, 92, mechanism, .51);
    const innerDrive = gear(1.055, 84, mechanism, .68, materials.brass);
    ring(1.27, .025, materials.silver, mechanism, .58);
    ring(1.19, .016, materials.brass, mechanism, .65);
    ring(1.12, .034, materials.black, mechanism, .73);
    bolts(radialPoints(18, 1.205, .665, .07), mechanism, .7);
    const satellites = [];
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + .17 + Math.PI / 6, p = group(mechanism, Math.cos(a) * 1.3, Math.sin(a) * 1.3, .49);
        cylinder(.115, .12, materials.black, p); ring(.11, .014, materials.brass, p, .08);
        const cog = gear(.078, 14, p, .09, materials.silver); satellites.push(cog);
        cylinder(.034, .05, materials.graphite, p, .13);
    }

    // Independently suspended armor sectors: black edge, aged ceramic-metal face,
    // small counterbores, recessed light strips and readable industrial markings.
    const armor = [];
    const spans = [.78, .88, .74, .92, .83, .79];
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + .17;
        const panel = group(); panel.rotation.z = a;
        mesh(plateGeometry(1.02, 1.48, spans[i], .074), materials.graphite, panel, 0, 0, .62);
        mesh(plateGeometry(1.05, 1.46, spans[i] - .025, .047), materials.armor, panel, 0, 0, .7);
        ring(1.415, .007, materials.silver, panel, .771, spans[i] - .2, -spans[i] / 2 + .1);
        bolts([[-.29, 1.115], [.29, 1.37]].map(([angle, r]) => [Math.cos(angle) * r, Math.sin(angle) * r, .774]), panel, .8);
        const a0 = -.12;
        ring(1.075, .032, materials.black, panel, .77, .21, a0);
        ring(1.075, .011, i % 3 ? materials.amber : materials.cyan, panel, .796, .15, a0 + .03);
        if (i === 0 || i === 3) label('△', .27, .27, panel, 1.28, -.08, .78, -a);
        conformPanel(panel);
        armor.push({ node: panel, angle: a });
    }

    const optics = group(root, 0, 0, .79);
    optics.scale.setScalar(.91);
    // Nested stepped barrel; the empty centers are real geometry.
    const barrelProfile = [[.85, -.08], [.99, -.08], [1.01, 0], [.995, .055], [.94, .065], [.925, .11], [.875, .12], [.857, .06], [.85, -.08]];
    const barrel = mesh(new THREE.LatheGeometry(barrelProfile.map(p => new THREE.Vector2(...p)), 128), materials.silver, optics);
    barrel.rotation.x = Math.PI / 2;
    ring(.97, .012, materials.brass, optics, .04);
    ring(.887, .034, materials.black, optics, .11);
    ring(.861, .008, materials.cyan, optics, .117);
    ring(.835, .022, materials.graphite, optics, .085);
    const dataRing = group(optics, 0, 0, .115);
    instances(new THREE.BoxGeometry(.009, .028, .006), materials.cyan,
        radialPoints(128, .81, 0).map((p, i) => ({ p, r: [0, 0, i / 128 * TAU - Math.PI / 2], s: i % 4 ? .4 : .8 })), dataRing);
    ring(.786, .006, materials.brass, optics, .06);
    mesh(new THREE.CircleGeometry(.837, 96), materials.black, optics, 0, 0, -.005);
    ring(.688, .024, materials.graphite, optics, .058);
    ring(.673, .009, materials.silver, optics, .08);
    ring(.62, .006, materials.cyan, optics, .085);
    ring(.595, .02, materials.black, optics, .09);
    for (let i = 0; i < 3; i++) {
        ring(.765, .008, materials.cyan, optics, .081, .075, i * 2.1 + .3);
        ring(.727, .004, materials.silver, optics, .073, .7, i * 2.1);
    }
    const opticalPrint = canvasTexture(1024, ctx => {
        ctx.clearRect(0, 0, 1024, 1024); ctx.translate(512, 512);
        for (let i = 0; i < 96; i++) {
            ctx.save(); ctx.rotate(i / 96 * TAU);
            ctx.fillStyle = i % 4 ? '#146479' : '#57bfce';
            ctx.font = '11px monospace'; ctx.fillText(i % 3 ? '01' : 'II', 430, 0);
            ctx.restore();
        }
        ctx.strokeStyle = '#27515d'; ctx.lineWidth = 1;
        for (const r of [405, 449, 456]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
    });
    mesh(new THREE.PlaneGeometry(1.79, 1.79), new THREE.MeshBasicMaterial({ map: opticalPrint, transparent: true, depthWrite: false, opacity: .8 }), optics, 0, 0, .12);

    // Concave fiber-optic bowl: actual depth, not a flat fan of opaque blades.
    const irisGeometry = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
    const radialSteps = 14, angularSteps = 160;
    for (let j = 0; j <= radialSteps; j++) {
        const r = .265 + (.77 - .265) * j / radialSteps;
        const z = .025 + .09 * Math.pow((r - .265) / .505, 1.5);
        for (let i = 0; i <= angularSteps; i++) {
            const a = i / angularSteps * TAU, x = Math.cos(a) * r, y = Math.sin(a) * r;
            pos.push(x, y, z); uv.push(.5 + x / 1.54, .5 + y / 1.54);
            if (j < radialSteps && i < angularSteps) {
                const k = j * (angularSteps + 1) + i;
                idx.push(k, k + angularSteps + 1, k + 1, k + 1, k + angularSteps + 1, k + angularSteps + 2);
            }
        }
    }
    irisGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); irisGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    irisGeometry.setIndex(idx); irisGeometry.computeVertexNormals();
    const iris = mesh(irisGeometry, materials.iris, optics);
    iris.scale.setScalar(.76);
    ring(.744 * .76, .008, materials.silver, optics, .13 * .76);
    ring(.7 * .76, .005, materials.cyan, optics, .12 * .76);
    const pupil = group(optics, 0, 0, .105);
    const pupilDome = mesh(new THREE.SphereGeometry(.305, 64, 32), materials.pupil, pupil); pupilDome.scale.z = .58;
    ring(.31, .018, materials.graphite, pupil, -.02);
    ring(.327, .007, materials.cyan, pupil, -.026);
    const glass = mesh(new THREE.SphereGeometry(.78, 64, 32, 0, TAU, 0, Math.PI / 2), materials.lens, optics, 0, 0, .1);
    glass.rotation.x = Math.PI / 2; glass.scale.y = .17;

    // A twelve-leaf internal shutter. Each leaf follows its own radial frame.
    // Closing changes the shared circular opening all the way to zero; the leaves
    // overlap, and remain inside the barrel in every state.
    ring(.889, .029, materials.graphite, optics, .29);
    ring(.86, .006, materials.silver, optics, .294);
    const shutter = group(optics, 0, 0, .285), blades = [];
    for (let i = 0; i < 12; i++) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
        const indices = []; for (let j = 0; j < 6; j++) indices.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
        geometry.setIndex(indices);
        const blade = mesh(geometry, materials.shutter, shutter, 0, 0, i * .0008);
        const seamGeometry = new THREE.BufferGeometry(); seamGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const seam = new THREE.Line(seamGeometry, new THREE.LineBasicMaterial({ color: 0x839c9f, transparent: true, opacity: .55 }));
        seam.frustumCulled = false; blade.add(seam); blade.userData.seam = seam;
        blade.frustumCulled = false; blade.rotation.z = i * TAU / 12; blades.push(blade);
    }
    let previousOpening = -1;
    function setOpening(opening) {
        opening = clamp(opening, 0, 1);
        if (opening === previousOpening || (opening > 0 && opening < 1 && Math.abs(opening - previousOpening) < .0001)) return;
        previousOpening = opening;
        const inner = opening * .856;
        for (const blade of blades) {
            const p = blade.geometry.attributes.position;
            for (let j = 0; j <= 6; j++) {
                const a = j / 6 * (TAU / 12 + .032);
                const twist = (1 - opening) * .5;
                p.setXYZ(j * 2, Math.cos(a + twist) * inner, Math.sin(a + twist) * inner, 0);
                p.setXYZ(j * 2 + 1, Math.cos(a) * .88, Math.sin(a) * .88, -.006);
            }
            p.needsUpdate = true; blade.geometry.computeVertexNormals();
            const line = blade.userData.seam.geometry.attributes.position;
            line.setXYZ(0, p.getX(0), p.getY(0), .002); line.setXYZ(1, p.getX(1), p.getY(1), -.004); line.needsUpdate = true;
        }
        shutter.visible = opening < .999;
    }
    setOpening(1);

    const doors = [], actuators = [];
    for (const side of [-1, 1]) {
        // The side shields are curved thick shells, hinged to two-axis servo pods.
        const mount = group(root, side * 1.35, -.02, -.05); mount.rotation.y = side * Math.PI / 2;
        cylinder(.32, .25, materials.graphite, mount); cylinder(.27, .29, materials.brass, mount);
        ring(.25, .022, materials.silver, mount, .17); gear(.205, 30, mount, .185, materials.black);
        cylinder(.15, .04, materials.silver, mount, .2); bolts(radialPoints(8, .23, .2), mount, .58);
        const door = group(root, side * 1.4, 0, -.03); door.rotation.y = side * .5;
        const plate = group(door); plate.rotation.z = side < 0 ? Math.PI : 0;
        // Local annulus centre lies inside the body: the visible shield is a long crescent.
        const shell = group(plate, -1.12, 0, 0);
        mesh(plateGeometry(1.22, 1.69, 1.52, .085, false), materials.graphite, shell);
        mesh(plateGeometry(1.245, 1.675, 1.5, .05, false), materials.armor, shell, 0, 0, .095);
        ring(1.61, .007, materials.silver, shell, .158, 1.25, -.625);
        bolts([-.59, .59].map(a => [Math.cos(a) * 1.49, Math.sin(a) * 1.49, .16]), shell, 1);
        for (const a of [-.43, .43]) {
            ring(1.42, .044, materials.black, shell, .16, .23, a - .115);
            ring(1.42, .017, materials.cyan, shell, .194, .18, a - .09);
        }
        label(side < 0 ? 'OBSERVE\nLEARN\nCREATE\nTOGETHER' : 'BRIGHTER\nIDEAS\nAHEAD', .34, .4, shell, 1.45, 0, .16, side < 0 ? Math.PI : 0);
        conformPanel(shell, 1.245, 2.2, .65);
        doors.push({ node: door, side });
        const actuator = group(root, side * 1.24, -.49, .1); actuator.rotation.z = side * .6;
        cylinder(.065, .36, materials.silver, actuator); cylinder(.085, .18, materials.graphite, actuator, -.08);
        actuators.push(actuator);
        cable([[side * .93, -.83, .12], [side * 1.23, -1.41, .08], [side * 1.59, -1.34, -.13], [side * 1.47, -.64, -.28]], .037, root);
        cable([[side * .75, 1, -.2], [side * 1.3, 1.06, -.31], [side * 1.54, .59, -.2], [side * 1.42, .28, -.1]], .025, root);
    }

    const crown = group(root, 0, 1.28, -.13);
    for (const x of [-.55, .55]) {
        const piston = group(crown, x, -.025, 0); piston.rotation.x = Math.PI / 2;
        cylinder(.105, .24, materials.graphite, piston); cylinder(.066, .34, materials.silver, piston);
        ring(.11, .02, materials.brass, piston, .095);
    }
    const cap = group(crown, 0, -1.28, 0);
    mesh(plateGeometry(1.5, 1.72, 1.43, .17, false), materials.graphite, cap, 0, 0, -.02).rotation.z = Math.PI / 2;
    mesh(plateGeometry(1.51, 1.71, 1.4, .075, false), materials.armor, cap, 0, 0, .16).rotation.z = Math.PI / 2;
    ring(1.64, .018, materials.cyan, cap, .13, .27, .97);
    ring(1.58, .013, materials.cyan, cap, .13, .27, .97);
    bolts([[-.75, 1.48, .255], [.75, 1.48, .255]], cap, .85);
    conformPanel(cap, 1.5, 1.8, 1.3);

    const lower = group(root, 0, -1.52, .45); lower.rotation.x = .4;
    cylinder(.28, .2, materials.graphite, lower); ring(.28, .025, materials.brass, lower, .12);
    cylinder(.22, .07, materials.silver, lower, .14); cylinder(.16, .08, materials.black, lower, .19);
    ring(.142, .014, materials.cyan, lower, .235); ring(.08, .01, materials.silver, lower, .24);
    bolts(radialPoints(8, .23, .185), lower, .48);
    const chin = group(root, 0, 0, .07);
    mesh(plateGeometry(1.4, 1.57, .79, .07, false), materials.armor, chin, 0, 0, .1).rotation.z = -Math.PI / 2;
    label('01', .28, .24, root, .13, -1.3, .81, -.12);

    const home = new Map();
    [optics, crown, lower, chin, ...armor.map(p => p.node), ...doors.map(p => p.node)].forEach(n => home.set(n, n.position.clone()));
    function pose({ time = 0, motorTime = time, activity = 1, opening = 1, pupilSize = 1, spread = 0, excitement = 0, scanning = 0, sleeping = false, light = 1 }) {
        setOpening(opening);
        const speed = sleeping ? .08 : activity;
        drive.rotation.z = motorTime * .035;
        innerDrive.rotation.z = -motorTime * .047;
        satellites.forEach((g, i) => { g.rotation.z = motorTime * (i % 2 ? -.45 : .45); });
        dataRing.rotation.z = motorTime * .07;
        iris.rotation.z = Math.sin(time * .23) * .018;
        pupil.scale.setScalar(pupilSize * .76);
        const pulse = sleeping ? .16 : light * (1 + Math.sin(time * 1.7) * .035 + excitement * .35 + (scanning ? Math.sin(time * 8) * .1 : 0));
        materials.iris.emissiveIntensity = pulse * 1.15;
        materials.cyan.emissiveIntensity = pulse * 2;
        materials.amber.emissiveIntensity = sleeping ? .3 : 1.8;
        for (const { node, angle } of armor) {
            node.position.set(Math.cos(angle) * spread * .36, Math.sin(angle) * spread * .36, spread * .18);
        }
        for (const { node, side } of doors) {
            node.position.copy(home.get(node)); node.position.x += side * (spread * .57 + excitement * .065);
            node.rotation.y = side * (.5 + spread * .45 + Math.sin(time * .8) * .017 * speed + excitement * .11);
        }
        crown.position.copy(home.get(crown)); crown.position.y += spread * .4 + excitement * .04;
        lower.position.copy(home.get(lower)); lower.position.y -= spread * .3;
        chin.position.copy(home.get(chin)); chin.position.y -= spread * .2;
        optics.position.copy(home.get(optics)); optics.position.z += spread * .55;
        actuators.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (.6 + spread * .16 + excitement * .05); });
    }
    function dispose() {
        const geos = new Set(), mats = new Set(), textures = new Set();
        root.traverse(o => { if (o.geometry) geos.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); });
        mats.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); m.dispose(); });
        geos.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
    }
    return { root, optics, pupil, doors, armor, crown, lower, drive, blades, materials, pose, dispose,
        get opening() { return previousOpening; } };
}
