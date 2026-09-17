/* ============================================================================
   SYMULATOR GEOMETRII — model 3D w sekcji "Design 3D"
   ----------------------------------------------------------------------------
   Ta sama proceduralna bryła koła i zawieszenia, którą zbudowałem do
   laboratorium geometrii na sscar.pl/geometria-3d.html: czysty WebGL, zero
   bibliotek, modeli i tekstur z sieci — opona, felga, tarcza, zacisk i kolumna
   McPhersona powstają z kodu, a napisy na boku opony malowane są na canvasie.

   Tutaj bryła stoi w pozie fabrycznej (camber −0,3°, zbieżność +0,2 mm,
   caster 4,5°), na tym samym podeście co pozostałe viewery, i powoli się
   obraca. Panel sterowania i kinematyka suwaków zostały na stronie SSCAR.

   Układ: X+ = na zewnątrz auta, Y+ = w górę, Z+ = kierunek jazdy.
   Jednostka = promień opony (1,0 ≈ 320 mm).
   ========================================================================== */
(function () {
    'use strict';

    var wrap = document.getElementById('vizWheel');
    if (!wrap || !window.WebGLRenderingContext) return;

    /* ------------------------------------------------------------ stałe --- */
    var R = 1.0;                        /* promień opony                         */
    var HW = 0.30;                      /* połowa szerokości opony               */
    var SAI = 15 * Math.PI / 180;       /* pochylenie osi sworznia (stałe)       */
    var KP_OFF = Math.tan(SAI);         /* oś sworznia mija środek koła          */
    var EX_CAMBER = 2.6, EX_TOE = 28;   /* przerysowanie kątów, jak w symulatorze */
    var POSE = { camber: -0.3, toe: 0.2, caster: 4.5 };   /* ustawienia fabryczne */

    var PED_R = 1.78, PED_H = 0.17;     /* podest — jak w viewerach three.js      */
    var DX = 0.35;                      /* bryła bliżej środka podestu: koło nie
                                           wychodzi poza rant, wahacze mieszczą się */

    /* ------------------------------------------------- wektory i macierze -- */
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function norm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function rotAxis(ax, ay, az, ang) {
        var l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
        ax /= l; ay /= l; az /= l;
        var c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
        return [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay,
                t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax,
                t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c];
    }
    function mmul(a, b) {
        var r = new Array(9);
        for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++)
            r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
        return r;
    }
    function mv(m, p) {
        return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
                m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
                m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
    }

    /* -------------------------------------------------------------- poza -- */
    /* Przekrój opony [x (× HW), r, rodzaj] — 0 ścianka, 1 bieżnik, 2 rowek.
       Tutaj służy już tylko do posadzenia koła na podeście. */
    var PROF = [
        [-0.70, 0.620, 0], [-1.02, 0.820, 0], [-0.99, 0.940, 0],
        [-0.88, 0.992, 1], [-0.66, 0.999, 1],
        [-0.60, 0.964, 2], [-0.44, 0.964, 2],
        [-0.38, 1.000, 1], [-0.06, 1.002, 1],
        [0.00, 0.966, 2], [0.14, 0.966, 2],
        [0.20, 1.002, 1], [0.48, 1.000, 1],
        [0.54, 0.964, 2], [0.70, 0.964, 2],
        [0.76, 0.995, 1], [0.88, 0.988, 1],
        [0.99, 0.940, 0], [1.02, 0.820, 0], [0.70, 0.620, 0]
    ];

    var gam = -POSE.camber * EX_CAMBER * Math.PI / 180;               /* camber    */
    var tau = -Math.atan((POSE.toe / 2) / 400) * EX_TOE;              /* zbieżność */
    var eps = POSE.caster * Math.PI / 180;                            /* caster    */
    var kpDir = [-Math.cos(eps) * Math.sin(SAI), Math.cos(eps) * Math.cos(SAI), -Math.sin(eps)];
    var Mtot = mmul(rotAxis(0, 0, 1, gam), rotAxis(0, 1, 0, tau));    /* skręt = 0 */

    /* Koło stoi na podeście: bryła schodzi tak, by bieżnik dotknął y = 0. */
    var groundShift = (function () {
        var minY = 1e9, s, p, w;
        for (s = 0; s < 96; s++) {
            var a = s / 96 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            for (p = 0; p < PROF.length; p++) {
                if (PROF[p][2] === 0) continue;
                w = mv(Mtot, [PROF[p][0] * HW, PROF[p][1] * ca, PROF[p][1] * sa]);
                if (w[1] + R < minY) minY = w[1] + R;
            }
        }
        return -minY;
    })();
    function axisPt(t) { return [-KP_OFF + kpDir[0] * t, R + groundShift + kpDir[1] * t, kpDir[2] * t]; }
    var kpBot = axisPt(-0.52);

    /* ===================================================== renderer WebGL == */
    function createRenderer(canvas) {
        var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
        if (!gl) return null;

        var VS = `
            attribute vec3 position;
            attribute vec3 normal;
            uniform mat4 model, projection, lightMatrix;
            varying vec3 vWorld, vNormal, vLocal, vLocalNormal;
            varying vec4 vShadow;
            void main(){
                vec4 p = model * vec4(position, 1.0);
                vWorld = p.xyz;
                vNormal = normalize(mat3(model) * normal);
                vLocal = position; vLocalNormal = normal;
                vShadow = lightMatrix * p;
                gl_Position = projection * p;
            }`;

        var FS = `
            precision highp float;
            varying vec3 vWorld, vNormal, vLocal, vLocalNormal;
            varying vec4 vShadow;
            uniform vec3 color, eye, wheelCenter;
            uniform float roughness, metallic, kind, shadowTexel, pedestal;
            uniform mat3 wheelInverse;
            uniform sampler2D sidewall, shadowMap, emblem;
            const float PI = 3.14159265;
            float noise(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
            float unpackDepth(vec4 v){return dot(v,vec4(1.0/(256.0*256.0*256.0),1.0/(256.0*256.0),1.0/256.0,1.0));}
            float shadow(){
                vec3 p = vShadow.xyz / vShadow.w * 0.5 + 0.5;
                if(p.x<0.0 || p.x>1.0 || p.y<0.0 || p.y>1.0 || p.z>1.0) return 1.0;
                float lit = 0.0;
                for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){
                    float d=unpackDepth(texture2D(shadowMap,p.xy+vec2(float(i),float(j))*shadowTexel*1.5));
                    lit += p.z-0.0025 <= d ? 1.0 : 0.0;
                }
                return lit/9.0;
            }
            vec3 fresnel(float c,vec3 f){return f+(1.0-f)*pow(1.0-c,5.0);}
            vec3 lamp(vec3 n,vec3 v,vec3 l,vec3 radiance,vec3 base,float metal,float rough){
                vec3 h=normalize(v+l);
                float nl=max(dot(n,l),0.0), nv=max(dot(n,v),0.001), nh=max(dot(n,h),0.0);
                float a=rough*rough, a2=a*a;
                float den=nh*nh*(a2-1.0)+1.0;
                float D=a2/(PI*den*den+0.0001);
                float k=(rough+1.0)*(rough+1.0)/8.0;
                float G=nv/(nv*(1.0-k)+k)*nl/(nl*(1.0-k)+k);
                vec3 F=fresnel(max(dot(h,v),0.0),mix(vec3(0.04),base,metal));
                vec3 spec=D*G*F/max(4.0*nv*nl,0.001);
                return ((1.0-F)*(1.0-metal)*base/PI+spec)*radiance*nl;
            }
            vec3 environment(vec3 r,float rough){
                vec3 env=mix(vec3(0.055,0.06,0.075),vec3(0.24,0.27,0.31),smoothstep(-0.3,0.9,r.y));
                float a=pow(max(dot(r,normalize(vec3(0.8,0.8,0.4))),0.0),mix(80.0,6.0,rough));
                float b=pow(max(dot(r,normalize(vec3(-0.7,0.6,-0.7))),0.0),mix(110.0,9.0,rough));
                float c=pow(max(dot(r,normalize(vec3(0.1,0.3,-1.0))),0.0),mix(65.0,5.0,rough));
                return env+vec3(2.8,2.6,2.35)*a+vec3(1.3,1.6,2.0)*b+vec3(0.9,0.95,1.1)*c;
            }
            void main(){
                vec3 n=normalize(vNormal), v=normalize(eye-vWorld);
                if(!gl_FrontFacing) n=-n;
                vec3 base=pow(color,vec3(2.2));
                float rough=roughness, metal=metallic;
                float radius=length(vLocal.yz);
                /* rant podestu — świeci własnym cyjanem, jak w pozostałych viewerach */
                if(kind>4.5){
                    float f=pow(1.0-max(dot(n,v),0.0),2.0);
                    gl_FragColor=vec4(min(color*(0.82+0.5*f),vec3(1.0)),1.0);
                    return;
                }
                if(kind>0.5 && kind<1.5){
                    float grain=noise(floor(vLocal*1500.0));
                    base*=0.91+grain*0.18;
                    if(abs(vLocalNormal.x)>0.45){
                        vec2 uv=vec2(-vLocal.z*sign(vLocal.x),vLocal.y)*0.5+0.5;
                        float lettering=texture2D(sidewall,uv).a;
                        base=mix(base,vec3(0.058,0.060,0.065),lettering*0.85);
                        rough=mix(rough,0.52,lettering);
                    }
                }
                if(kind>1.5 && kind<2.5 && abs(vLocalNormal.x)>0.7){
                    float angle=atan(vLocal.z,vLocal.y);
                    float nearest=1.0;
                    for(int i=0;i<3;i++){
                        float ring=0.335+float(i)*0.062;
                        float a=angle+float(i)*0.085;
                        float da=(fract(a/(2.0*PI)*24.0+0.5)-0.5)*2.0*PI/24.0;
                        nearest=min(nearest,length(vec2(radius-ring,da*ring)));
                    }
                    if(nearest<0.009) discard;
                    base*=mix(0.24,1.0,smoothstep(0.009,0.014,nearest));
                    base*=0.98+0.02*sin(radius*1400.0);
                }
                if(kind>2.5 && kind<3.5){
                    vec4 decal=texture2D(emblem,vec2(-vLocal.z/0.23+0.5,vLocal.y/0.23+0.5));
                    base=mix(base,pow(decal.rgb,vec3(2.2)),decal.a);
                }
                float sh=shadow();
                /* blat podestu: cień kontaktowy koła i poświata od cyjanowego rantu */
                if(kind>3.5){
                    vec3 q=wheelInverse*(vWorld-wheelCenter);
                    float contact=exp(-pow(q.x/0.40,2.0)-pow(q.z/0.52,2.0));
                    float broad=exp(-pow(q.x/0.85,2.0)-pow(q.z/1.1,2.0));
                    float rad=length(vWorld.xz)/pedestal;
                    vec3 top=vec3(0.014,0.011,0.016);
                    top*=1.0-0.52*contact-0.15*broad;
                    top*=0.55+0.45*sh;
                    top+=vec3(0.0,0.030,0.033)*pow(smoothstep(0.72,1.0,rad),3.0);
                    gl_FragColor=vec4(pow(top,vec3(1.0/2.2)),1.0);
                    return;
                }
                vec3 light=lamp(n,v,normalize(vec3(0.7,1.0,0.65)),vec3(4.2,3.95,3.65),base,metal,rough)*(0.35+0.65*sh);
                light+=lamp(n,v,normalize(vec3(-0.8,0.65,-0.7)),vec3(2.15,2.55,3.2),base,metal,rough);
                light+=lamp(n,v,normalize(vec3(0.4,0.2,-1.0)),vec3(1.2,1.3,1.5),base,metal,rough);
                vec3 f=fresnel(max(dot(n,v),0.0),mix(vec3(0.04),base,metal));
                float reflectionWeight=(kind>0.5 && kind<1.5) ? 0.14 : (0.9-rough*0.3);
                light+=environment(reflect(-v,n),rough)*f*reflectionWeight;
                light+=base*(1.0-metal)*vec3(0.22,0.24,0.28)*(0.7+0.3*n.y);
                light*=0.80+0.20*smoothstep(0.0,1.1,vWorld.y);
                light=light/(light+vec3(0.8));
                gl_FragColor=vec4(pow(light,vec3(1.0/2.2)),1.0);
            }`;

        var DEPTH_VS = 'attribute vec3 position; uniform mat4 model, projection; void main(){gl_Position=projection*model*vec4(position,1.0);}';
        var DEPTH_FS = `precision highp float; void main(){
            vec4 e=fract(gl_FragCoord.z*vec4(256.0*256.0*256.0,256.0*256.0,256.0,1.0));
            e-=e.xxyz*vec4(0.0,1.0/256.0,1.0/256.0,1.0/256.0);
            gl_FragColor=e;
        }`;

        function shader(type, src) {
            var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
            return sh;
        }
        function program(vs, fs) {
            var p = gl.createProgram(), v = shader(gl.VERTEX_SHADER, vs), f = shader(gl.FRAGMENT_SHADER, fs);
            gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
            gl.deleteShader(v); gl.deleteShader(f);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
            var out = { p: p, a: {}, u: {} };
            ['position', 'normal'].forEach(function (k) { out.a[k] = gl.getAttribLocation(p, k); });
            ['model', 'projection', 'lightMatrix', 'color', 'eye', 'roughness', 'metallic', 'kind', 'pedestal',
             'sidewall', 'emblem', 'shadowMap', 'shadowTexel', 'wheelCenter', 'wheelInverse'].forEach(function (k) {
                out.u[k] = gl.getUniformLocation(p, k);
            });
            return out;
        }
        var main = program(VS, FS), depth = program(DEPTH_VS, DEPTH_FS);

        /* ---------------------------------------------- macierze 4×4 (GL) -- */
        function identity() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
        function matrixMultiply(a, b) {
            var o = new Array(16);
            for (var col = 0; col < 4; col++) for (var row = 0; row < 4; row++) {
                o[col * 4 + row] = 0; for (var k = 0; k < 4; k++) o[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
            } return o;
        }
        function frameMatrix(x, y, z, p) { return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1]; }
        function scaleVector(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
        function localPoint(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
        function directionMatrix(a, b, r) {
            var d = sub(b, a), length = Math.hypot(d[0], d[1], d[2]), y = norm(d);
            var x = norm(cross(y, Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1])), z = cross(x, y);
            return frameMatrix(scaleVector(x, r), scaleVector(y, length), scaleVector(z, r), a);
        }

        var materials = {
            rubber: { color: [0.135, 0.145, 0.158], rough: .73, metal: 0, kind: 1 },
            tread: { color: [0.16, 0.17, 0.18], rough: .84, metal: 0, kind: 1 },
            silver: { color: [0.79, 0.82, 0.86], rough: .24, metal: .92, kind: 0 },
            machined: { color: [0.88, 0.90, 0.94], rough: .18, metal: .97, kind: 0 },
            graphite: { color: [0.25, 0.28, 0.33], rough: .3, metal: .86, kind: 0 },
            steel: { color: [0.54, 0.57, 0.61], rough: .38, metal: .82, kind: 0 },
            disc: { color: [0.62, 0.64, 0.67], rough: .36, metal: .9, kind: 2 },
            red: { color: [0.66, 0.035, 0.028], rough: .27, metal: .25, kind: 0 },
            black: { color: [0.11, 0.12, 0.14], rough: .38, metal: .5, kind: 0 },
            cap: { color: [0.13, 0.15, 0.18], rough: .26, metal: .55, kind: 3 },
            podium: { color: [0.2, 0.2, 0.2], rough: 1, metal: 0, kind: 4 },
            podiumSide: { color: [0.075, 0.075, 0.08], rough: .9, metal: .05, kind: 0 },
            rimGlow: { color: [0.0, 1.0, 1.0], rough: .4, metal: 0, kind: 5 }
        };
        function builder() { return { groups: {} }; }
        function vertex(b, key, p, n) {
            var a = b.groups[key] || (b.groups[key] = []);
            a.push(p[0], p[1], p[2], n[0], n[1], n[2]);
        }
        function triangle(b, key, a, c, d, na, nc, nd) {
            var n = na || norm(cross(sub(c, a), sub(d, a)));
            /* Gładkie normalne muszą zgadzać się z nawinięciem trójkąta —
               inaczej dwustronny shader odwraca światło na klockach bieżnika. */
            if (na && dot(cross(sub(c, a), sub(d, a)), na) < 0) {
                var swap = c; c = d; d = swap; swap = nc; nc = nd; nd = swap;
            }
            vertex(b, key, a, n); vertex(b, key, c, nc || n); vertex(b, key, d, nd || n);
        }
        function quad(b, key, a, c, d, e, na, nc, nd, ne) {
            triangle(b, key, a, c, d, na, nc, nd); triangle(b, key, a, d, e, na, nd, ne);
        }
        function bake(b) {
            return Object.keys(b.groups).map(function (key) {
                var data = new Float32Array(b.groups[key]), buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
                return { buffer: buffer, count: data.length / 6, material: materials[key] };
            });
        }
        function polar(x, r, a) { return [x, r * Math.cos(a), r * Math.sin(a)]; }
        /* Bryła obrotowa wokół osi koła, z opcjonalnie gładkimi normalnymi. */
        function lathe(b, key, profile, segments, smooth, start, extent) {
            start = start || 0; extent = extent === undefined ? Math.PI * 2 : extent;
            for (var p = 0; p < profile.length - 1; p++) {
                function normalAt(j, a) {
                    var lo = smooth ? Math.max(0, j - 1) : p, hi = smooth ? Math.min(profile.length - 1, j + 1) : p + 1;
                    var dx = profile[hi][0] - profile[lo][0], dr = profile[hi][1] - profile[lo][1];
                    return norm([dr, -dx * Math.cos(a), -dx * Math.sin(a)]);
                }
                for (var i = 0; i < segments; i++) {
                    var a = start + extent * i / segments, c = start + extent * (i + 1) / segments;
                    var p0 = polar(profile[p][0], profile[p][1], a), p1 = polar(profile[p + 1][0], profile[p + 1][1], a);
                    var p2 = polar(profile[p + 1][0], profile[p + 1][1], c), p3 = polar(profile[p][0], profile[p][1], c);
                    quad(b, key, p0, p1, p2, p3, normalAt(p, a), normalAt(p + 1, a), normalAt(p + 1, c), normalAt(p, c));
                }
            }
        }
        function ring(b, key, x, r, t) {
            var profile = [];
            for (var i = 0; i <= 12; i++) { var a = i / 12 * Math.PI * 2; profile.push([x + Math.cos(a) * t, r + Math.sin(a) * t]); }
            lathe(b, key, profile, 144, true);
        }
        function transformed(b, m, fn) {
            var temp = builder(); fn(temp);
            Object.keys(temp.groups).forEach(function (key) {
                var a = temp.groups[key]; for (var i = 0; i < a.length; i += 6) {
                    var p = localPoint(m, a.slice(i, i + 3));
                    var n = norm([m[0] * a[i + 3] + m[4] * a[i + 4] + m[8] * a[i + 5], m[1] * a[i + 3] + m[5] * a[i + 4] + m[9] * a[i + 5], m[2] * a[i + 3] + m[6] * a[i + 4] + m[10] * a[i + 5]]);
                    vertex(b, key, p, n);
                }
            });
        }
        /* Oś tokarki z X na Y — podest i wszystkie walce stoją pionowo. */
        var UPRIGHT = [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1];
        function cylinder(b, key, a, c, r, segments) {
            var m = directionMatrix(a, c, r);
            transformed(b, matrixMultiply(m, UPRIGHT), function (t) { lathe(t, key, [[0, 0], [0, 1], [1, 1], [1, 0]], segments || 24, false); });
        }
        function tubePath(b, key, points, r, sides) {
            var rings = [], normals = [];
            for (var i = 0; i < points.length; i++) {
                var tangent = norm(sub(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]));
                var u = norm(cross(tangent, [0, 1, 0])), v = cross(tangent, u), row = [], nr = [];
                for (var j = 0; j < sides; j++) {
                    var a = j / sides * Math.PI * 2, n = [u[0] * Math.cos(a) + v[0] * Math.sin(a), u[1] * Math.cos(a) + v[1] * Math.sin(a), u[2] * Math.cos(a) + v[2] * Math.sin(a)];
                    row.push([points[i][0] + n[0] * r, points[i][1] + n[1] * r, points[i][2] + n[2] * r]); nr.push(n);
                } rings.push(row); normals.push(nr);
            }
            for (var k = 0; k < rings.length - 1; k++) for (var j = 0; j < sides; j++) {
                var next = (j + 1) % sides;
                quad(b, key, rings[k][j], rings[k + 1][j], rings[k + 1][next], rings[k][next], normals[k][j], normals[k + 1][j], normals[k + 1][next], normals[k][next]);
            }
        }

        /* --------------------------------------------------- bryła koła --- */
        var wheel = builder();
        /* Ciągły, zaokrąglony karkas. Klocki bieżnika siedzą na nim osobno,
           więc między nimi zostają prawdziwe rowki. */
        var profile = [[-.26, .635], [-.286, .67], [-.319, .72], [-.336, .79], [-.338, .84], [-.326, .89], [-.304, .936], [-.274, .968], [-.242, .976], [.242, .976], [.274, .968], [.304, .936], [.326, .89], [.338, .84], [.336, .79], [.319, .72], [.286, .67], [.26, .635]];
        lathe(wheel, 'rubber', profile, 160, true);
        [-1, 1].forEach(function (side) {
            ring(wheel, 'rubber', side * .327, .752, .003);
            ring(wheel, 'rubber', side * .339, .825, .002);
            ring(wheel, 'rubber', side * .294, .942, .0025);
            ring(wheel, 'rubber', side * .283, .674, .006);
        });
        function treadBlock(x0, x1, a0, a1, shift) {
            var slices = 4, bevel = .003;
            function pt(x, a, inset) { var r = .999 - .024 * Math.pow(x / .29, 4) - inset; return polar(x, r, a + shift * x); }
            for (var i = 0; i < slices; i++) {
                var a = a0 + (a1 - a0) * i / slices, c = a0 + (a1 - a0) * (i + 1) / slices;
                var q0 = pt(x0 + bevel, a, 0), q1 = pt(x1 - bevel, a, 0), q2 = pt(x1 - bevel, c, 0), q3 = pt(x0 + bevel, c, 0);
                quad(wheel, 'tread', q0, q1, q2, q3, [0, Math.cos(a), Math.sin(a)], [0, Math.cos(a), Math.sin(a)], [0, Math.cos(c), Math.sin(c)], [0, Math.cos(c), Math.sin(c)]);
                quad(wheel, 'rubber', pt(x0, a, .019), pt(x0, c, .019), q3, q0);
                quad(wheel, 'rubber', q1, q2, pt(x1, c, .019), pt(x1, a, .019));
            }
            quad(wheel, 'rubber', pt(x0, a0, .019), pt(x1, a0, .019), pt(x1 - bevel, a0, 0), pt(x0 + bevel, a0, 0));
            quad(wheel, 'rubber', pt(x0 + bevel, a1, 0), pt(x1 - bevel, a1, 0), pt(x1, a1, .019), pt(x0, a1, .019));
        }
        var ribs = [[-.284, -.191], [-.170, -.069], [-.049, .049], [.069, .170], [.191, .284]];
        ribs.forEach(function (rib, row) {
            for (var i = 0; i < 64; i++) {
                var start = (i + row * .32) / 64 * Math.PI * 2, gap = .009;
                var end = start + Math.PI * 2 / 64 - gap, mid = (start + end) / 2;
                treadBlock(rib[0], rib[1], start, mid - .0014, row < 2 ? .22 : -.22);
                treadBlock(rib[0], rib[1], mid + .0014, end, row < 2 ? .22 : -.22);
            }
        });
        /* Pusta obręcz, zawinięty rant wewnętrzny, toczony rant zewnętrzny. */
        lathe(wheel, 'graphite', [[-.278, .635], [-.28, .664], [-.24, .678], [.229, .678], [.245, .655], [.22, .626], [-.245, .621], [-.278, .635]], 144, false);
        lathe(wheel, 'machined', [[.215, .627], [.264, .634], [.278, .65], [.264, .676], [.246, .68], [.239, .664], [.249, .65], [.235, .64], [.215, .627]], 160, true);
        ring(wheel, 'silver', -.278, .647, .013);
        /* Felga kuta, pięć par wklęsłych ramion — każde to fazowany graniastosłup. */
        function spoke(a, r0, r1, offset, w0, w1) {
            var p0 = [r0 * Math.cos(a), r0 * Math.sin(a)], p1 = [r1 * Math.cos(a + offset), r1 * Math.sin(a + offset)];
            var d = norm([0, p1[0] - p0[0], p1[1] - p0[1]]), perp = [-d[2], d[1]];
            var outline = [[p0[0] + perp[0] * w0, p0[1] + perp[1] * w0], [p1[0] + perp[0] * w1, p1[1] + perp[1] * w1], [p1[0] - perp[0] * w1, p1[1] - perp[1] * w1], [p0[0] - perp[0] * w0, p0[1] - perp[1] * w0]];
            var cy = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2, front = [], edge = [], back = [];
            outline.forEach(function (p) {
                var rad = Math.hypot(p[0], p[1]), x = .10 + .16 * Math.pow(rad / .66, 1.4);
                edge.push([x - .008, p[0], p[1]]); back.push([x - .07, p[0], p[1]]);
                front.push([x, cy + (p[0] - cy) * .94, cz + (p[1] - cz) * .88]);
            });
            quad(wheel, 'silver', front[0], front[1], front[2], front[3]);
            quad(wheel, 'graphite', back[3], back[2], back[1], back[0]);
            for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; quad(wheel, 'machined', edge[i], edge[j], front[j], front[i]); quad(wheel, 'graphite', back[i], back[j], edge[j], edge[i]); }
        }
        for (var i = 0; i < 5; i++) {
            var a = i / 5 * Math.PI * 2 + .12;
            spoke(a, .13, .34, 0, .057, .043);
            spoke(a, .29, .664, -.15, .028, .032);
            spoke(a, .29, .664, .15, .028, .032);
        }
        lathe(wheel, 'graphite', [[.035, 0], [.035, .176], [.10, .19], [.16, .166], [.174, .106], [.174, 0]], 96, true);
        lathe(wheel, 'cap', [[.177, 0], [.177, .093]], 96, false);
        ring(wheel, 'machined', .176, .096, .005);
        for (var i = 0; i < 5; i++) {
            var a = i / 5 * Math.PI * 2 + .12 + Math.PI / 5, loc = polar(0, .143, a);
            transformed(wheel, frameMatrix([1, 0, 0], [0, 1, 0], [0, 0, 1], loc), function (t) {
                lathe(t, 'black', [[.143, 0], [.143, .03], [.162, .03], [.162, 0]], 32, false);
                lathe(t, 'machined', [[.16, 0], [.16, .019], [.178, .019], [.183, .014], [.183, 0]], 6, false);
            });
        }
        /* Tarcza wentylowana i nawiercana — otwory wycina shader materiału. */
        lathe(wheel, 'disc', [[-.045, .235], [-.045, .513], [-.039, .524], [-.023, .524], [-.023, .506], [-.012, .506], [-.012, .524], [.003, .524], [.01, .513], [.01, .235], [-.045, .235]], 144, false);
        lathe(wheel, 'graphite', [[-.09, 0], [-.09, .23], [.004, .25], [.018, .23], [.045, .17], [.045, 0]], 96, false);
        for (var i = 0; i < 10; i++) {
            var pt = polar(0, .218, i / 10 * Math.PI * 2);
            cylinder(wheel, 'steel', [.018, pt[1], pt[2]], [.028, pt[1], pt[2]], .013, 8);
        }
        /* Czterotłoczkowy zacisk obejmuje tarczę, chowając się za ramionami felgi. */
        lathe(wheel, 'red', [[-.105, .382], [-.122, .40], [-.122, .523], [-.10, .55], [.062, .55], [.09, .523], [.09, .412], [.065, .382], [-.105, .382]], 36, true, .92, 1.30);
        [.92, 2.22].forEach(function (a) {
            quad(wheel, 'red', polar(-.105, .39, a), polar(.062, .39, a), polar(.062, .54, a), polar(-.105, .54, a));
        });
        for (var i = 0; i < 3; i++) {
            var a = 1.19 + i * .35, pt = polar(0, .47, a);
            cylinder(wheel, 'red', [.085, pt[1], pt[2]], [.103, pt[1], pt[2]], .047, 24);
        }
        /* Wentyl z metalowym kapturkiem na wewnętrznej krawędzi rantu. */
        cylinder(wheel, 'black', polar(.235, .575, 2.45), polar(.30, .605, 2.45), .012, 14);
        cylinder(wheel, 'steel', polar(.30, .605, 2.45), polar(.315, .613, 2.45), .013, 12);
        var wheelMesh = bake(wheel);

        /* ---------------------------------------------- kolumna i wahacze -- */
        var suspension = builder();
        cylinder(suspension, 'graphite', [0, .03, 0], [0, 1.16, 0], .06, 40);
        cylinder(suspension, 'machined', [0, 1.04, 0], [0, 1.52, 0], .024, 32);
        cylinder(suspension, 'red', [0, .87, 0], [0, 1.03, 0], .064, 40);
        cylinder(suspension, 'black', [0, 1.07, 0], [0, 1.11, 0], .174, 48);
        cylinder(suspension, 'steel', [0, 1.10, 0], [0, 1.125, 0], .157, 48);
        cylinder(suspension, 'black', [0, 1.45, 0], [0, 1.49, 0], .164, 48);
        cylinder(suspension, 'graphite', [0, 1.49, 0], [0, 1.53, 0], .19, 48);
        var coil = [];
        for (var i = 0; i <= 320; i++) {
            var t = i / 320, angle = t * Math.PI * 2 * 4.5;
            coil.push([Math.cos(angle) * .14, 1.135 + t * .30, Math.sin(angle) * .14]);
        }
        tubePath(suspension, 'red', coil, .018, 10);
        for (var i = 0; i < 3; i++) {
            var a = i / 3 * Math.PI * 2;
            cylinder(suspension, 'machined', [Math.cos(a) * .125, 1.53, Math.sin(a) * .125], [Math.cos(a) * .125, 1.557, Math.sin(a) * .125], .019, 6);
        }
        /* Zwrotnica kończy się przegubem kulowym i łączy z piastą. */
        cylinder(suspension, 'steel', [0, -.48, 0], [0, .15, 0], .073, 24);
        cylinder(suspension, 'black', [0, -.54, 0], [0, -.45, 0], .092, 24);
        var suspensionMesh = bake(suspension);
        var unit = builder(); cylinder(unit, 'steel', [0, 0, 0], [0, 1, 0], 1, 24); var armMesh = bake(unit);
        var joint = builder(); cylinder(joint, 'black', [0, 0, 0], [0, 1, 0], 1, 32); var jointMesh = bake(joint);

        /* ------------------------------------------------------- podest --- */
        var ped = builder();
        transformed(ped, UPRIGHT, function (t) {
            lathe(t, 'podium', [[0, 0], [0, PED_R]], 96, false);
            lathe(t, 'podiumSide', [[0, PED_R], [-PED_H * .35, PED_R], [-PED_H, PED_R * .96], [-PED_H, 0]], 96, false);
            ring(t, 'rimGlow', 0, PED_R, .015);
        });
        var pedestalMesh = bake(ped);

        /* ------------------------------------------------------ tekstury -- */
        function texture(source) {
            var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.generateMipmap(gl.TEXTURE_2D); return t;
        }
        var texCanvas = document.createElement('canvas'); texCanvas.width = texCanvas.height = 1024;
        var tx = texCanvas.getContext('2d'); tx.fillStyle = '#b8bdc7';
        function arcText(text, radius, center, size) {
            tx.font = '700 ' + size + 'px Arial, sans-serif';
            var widths = Array.from(text).map(function (ch) { return tx.measureText(ch).width + 3; }), total = widths.reduce(function (a, b) { return a + b; }, 0);
            var angle = center - total / radius / 2;
            Array.from(text).forEach(function (ch, i) {
                var half = widths[i] / radius / 2; angle += half;
                tx.save(); tx.translate(512 + Math.sin(angle) * radius, 512 - Math.cos(angle) * radius); tx.rotate(angle);
                tx.textAlign = 'center'; tx.textBaseline = 'middle'; tx.fillText(ch, 0, 0); tx.restore(); angle += half;
            });
        }
        arcText('SSCAR  PERFORMANCE', 423, 0, 30);
        arcText('205/55 R16  ·  RADIAL TUBELESS', 421, Math.PI, 17);
        arcText('ROTATION  ›', 457, 1.60, 13);
        arcText('SPORT CONTACT', 387, -1.62, 13);
        for (var i = 0; i < 72; i++) {
            var a = i / 72 * Math.PI * 2;
            tx.save(); tx.translate(512, 512); tx.rotate(a); tx.fillRect(-1, -469, 2, 8); tx.restore();
        }
        var tireTexture = texture(texCanvas);
        var logo = document.createElement('canvas'); logo.width = logo.height = 256; var lg = logo.getContext('2d');
        lg.fillStyle = '#e5e9ef'; lg.font = 'italic 900 74px Arial'; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillText('SS', 128, 116);
        lg.fillStyle = '#db3028'; lg.fillRect(72, 162, 112, 8); var logoTexture = texture(logo);

        /* ---------------------------------------------------- mapa cieni -- */
        var shadowSize = 1024, shadowTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowSize, shadowSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var shadowFB = gl.createFramebuffer(), shadowDepth = gl.createRenderbuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
        gl.bindRenderbuffer(gl.RENDERBUFFER, shadowDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadowSize, shadowSize);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowDepth);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Shadow framebuffer unavailable');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        var lightEye = [3.5, 6, 3.25], lightTarget = [-.25, 1, 0];
        var lz = norm(sub(lightEye, lightTarget)), lx = norm(cross([0, 1, 0], lz)), ly = cross(lz, lx);
        var lightView = [lx[0], ly[0], lz[0], 0, lx[1], ly[1], lz[1], 0, lx[2], ly[2], lz[2], 0, -dot(lx, lightEye), -dot(ly, lightEye), -dot(lz, lightEye), 1];
        var lightProjection = [1 / 2.6, 0, 0, 0, 0, 1 / 2.6, 0, 0, 0, 0, -2 / 12, 0, 0, 0, -1, 1];
        var lightMatrix = matrixMultiply(lightProjection, lightView);

        /* -------------------------------------------------------- kamera -- */
        var CAM = { yaw: 0.62, pitch: 0.28, dist: 7.5, target: [0, 0.86, 0], fov: 34 };
        function perspective(aspect) {
            var f = 1 / Math.tan(CAM.fov * Math.PI / 360), near = 0.1, far = 30;
            return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
        }
        function eyePos() {
            var cp = Math.cos(CAM.pitch);
            return [CAM.target[0] + CAM.dist * Math.sin(CAM.yaw) * cp,
                    CAM.target[1] + CAM.dist * Math.sin(CAM.pitch),
                    CAM.target[2] + CAM.dist * Math.cos(CAM.yaw) * cp];
        }
        function lookAt(eye, target) {
            var z = norm(sub(eye, target)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
            return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
        }
        /* Bryła kręci się wokół osi podestu; DX stawia ją na jego środku. */
        function spinMatrix(rot) {
            var c = Math.cos(rot), s = Math.sin(rot);
            return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, c * DX, 0, -s * DX, 1];
        }

        function draw(mesh, m, p) {
            gl.uniformMatrix4fv(p.u.model, false, new Float32Array(m));
            mesh.forEach(function (part) {
                gl.bindBuffer(gl.ARRAY_BUFFER, part.buffer);
                gl.enableVertexAttribArray(p.a.position); gl.vertexAttribPointer(p.a.position, 3, gl.FLOAT, false, 24, 0);
                if (p.a.normal >= 0) { gl.enableVertexAttribArray(p.a.normal); gl.vertexAttribPointer(p.a.normal, 3, gl.FLOAT, false, 24, 12); }
                if (p === main) {
                    var mat = part.material;
                    gl.uniform3fv(p.u.color, mat.color); gl.uniform1f(p.u.roughness, mat.rough);
                    gl.uniform1f(p.u.metallic, mat.metal); gl.uniform1f(p.u.kind, mat.kind);
                }
                gl.drawArrays(gl.TRIANGLES, 0, part.count);
            });
        }

        /* Bryła to ~84 tys. trójkątów. Cień odświeżamy co drugą klatkę —
           przy obrocie 0,28 rad/s jedna klatka opóźnienia jest niewidoczna,
           a przepustowość geometrii spada o połowę. */
        var pass = 0;

        function render(w, h, rot) {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
                canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            }
            var eye = eyePos();
            var vp = matrixMultiply(perspective(w / h), lookAt(eye, CAM.target));
            var spin = spinMatrix(rot);

            var wheelLocal = [Mtot[0], Mtot[3], Mtot[6], 0, Mtot[1], Mtot[4], Mtot[7], 0, Mtot[2], Mtot[5], Mtot[8], 0, 0, R + groundShift, 0, 1];
            var up = kpDir, right = norm(cross(up, [0, 0, 1])), back = cross(right, up);
            var a1 = [-1.38, kpBot[1] + .04, .55], a2 = [-1.38, kpBot[1] + .04, -.48];
            var hub = localPoint(wheelLocal, [-.12, 0, 0]);
            var pieces = [
                { mesh: wheelMesh, m: wheelLocal },
                { mesh: suspensionMesh, m: frameMatrix(right, up, back, axisPt(0)) }
            ];
            [[kpBot, a1, .057], [kpBot, a2, .062], [a1, a2, .065], [axisPt(0), hub, .098]].forEach(function (v) {
                pieces.push({ mesh: armMesh, m: directionMatrix(v[0], v[1], v[2]) });
            });
            [a1, a2].forEach(function (p) {
                pieces.push({ mesh: jointMesh, m: directionMatrix([p[0], p[1], p[2] - .055], [p[0], p[1], p[2] + .055], .095) });
            });
            pieces.forEach(function (p) { p.m = matrixMultiply(spin, p.m); });

            var center = localPoint(spin, [0, R + groundShift, 0]);
            var spun = mmul(rotAxis(0, 1, 0, rot), Mtot);

            gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
            if (pass++ % 2 === 0) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, shadowSize, shadowSize);
                gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(depth.p);
                gl.uniformMatrix4fv(depth.u.projection, false, new Float32Array(lightMatrix));
                pieces.forEach(function (p) { draw(p.mesh, p.m, depth); });
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(main.p);
            gl.uniformMatrix4fv(main.u.projection, false, new Float32Array(vp));
            gl.uniformMatrix4fv(main.u.lightMatrix, false, new Float32Array(lightMatrix));
            gl.uniform3fv(main.u.eye, eye); gl.uniform3fv(main.u.wheelCenter, center);
            gl.uniformMatrix3fv(main.u.wheelInverse, false, new Float32Array(spun));
            gl.uniform1f(main.u.shadowTexel, 1 / shadowSize);
            gl.uniform1f(main.u.pedestal, PED_R);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tireTexture); gl.uniform1i(main.u.sidewall, 0);
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowTexture); gl.uniform1i(main.u.shadowMap, 1);
            gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, logoTexture); gl.uniform1i(main.u.emblem, 2);
            draw(pedestalMesh, identity(), main);
            pieces.forEach(function (p) { draw(p.mesh, p.m, main); });
        }
        return { render: render };
    }

    /* ========================================================= animacja === */
    function start() {
        var canvas = document.createElement('canvas');
        wrap.appendChild(canvas);
        var studio = null;
        try { studio = createRenderer(canvas); }
        catch (e) { studio = null; }
        if (!studio) { canvas.remove(); return; }

        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var AUTO_SPEED = reduceMotion ? 0 : 0.28;      /* rad/s — pełny obrót ~22 s */
        var rot = -0.95, vel = AUTO_SPEED, dragging = false, lastX = 0;
        var w = 0, h = 0, raf = 0, last = 0, visible = false;

        function frame(now) {
            raf = 0;
            var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
            last = now;
            if (!dragging) {
                /* rozpęd z przeciągnięcia płynnie wraca do powolnego auto-obrotu */
                vel += (AUTO_SPEED - vel) * Math.min(1, dt * 1.6);
                rot += vel * dt;
            }
            if (w && h) {
                studio.render(w, h, rot);
                wrap.classList.add('ready');
            }
            if (reduceMotion && !dragging && Math.abs(vel) < 0.005) return;
            if (visible) raf = requestAnimationFrame(frame);
        }
        function wake() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

        /* clientWidth, nie getBoundingClientRect: karta wjeżdża na animacji
           .reveal, a transform zafałszowałby rozmiar bufora. */
        new ResizeObserver(function () {
            if (!wrap.clientWidth || !wrap.clientHeight) return;
            w = wrap.clientWidth; h = wrap.clientHeight;
            if (visible) wake();
        }).observe(wrap);

        canvas.addEventListener('pointerdown', function (e) {
            dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); wake();
        });
        canvas.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            var dx = e.clientX - lastX; lastX = e.clientX;
            rot += dx * 0.0065; vel = dx * 0.0065 * 60; wake();
        });
        var endDrag = function () { dragging = false; };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);

        /* Renderuj tylko wtedy, gdy viewer jest na ekranie. */
        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            if (visible) wake();
            else if (raf) { cancelAnimationFrame(raf); raf = 0; }
        }, { rootMargin: '80px' }).observe(wrap);
    }

    /* Bryła powstaje dopiero, gdy sekcja zbliża się do ekranu, i to w wolnej
       chwili przeglądarki — budowa siatek zajmuje ~80 ms i nie może wpaść
       w środek przewijania. */
    var idle = window.requestIdleCallback
        ? function (fn) { window.requestIdleCallback(fn, { timeout: 1500 }); }
        : function (fn) { setTimeout(fn, 50); };
    var section = document.getElementById('skills') || wrap;
    var boot = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        boot.disconnect();
        idle(start);
    }, { rootMargin: '600px' });
    boot.observe(section);
})();
