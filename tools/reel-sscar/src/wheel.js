// Laboratorium geometrii ze strony sscar.pl/geometria-3d.html przeniesione do three.js.
// Bryła (opona z blokami bieżnika, kuta felga 5×2, nawiercana tarcza, czerwony zacisk, kolumna McPhersona,
// wahacz), materiały i shader (PBR z trzema lampami, odbicia studyjnych softboxów, cień, tone mapping
// L/(L+0,8)) oraz kinematyka (camber, zbieżność, caster, skręt wokół pochylonej osi sworznia) są przepisane
// 1:1 z kodu strony. Różnice: tekstury boku opony w 4× większej rozdzielczości (zbliżenia w intro),
// mapa cienia 2048 zamiast 1024, obrót koła wokół osi (toczenie) i opcjonalne czerwone światło konturowe.
//
// Układ (jak na stronie): X+ = na zewnątrz auta, Y+ = w górę, Z+ = kierunek jazdy. Koło przednie lewe,
// punkt styku z jezdnią w (0,0,0), środek koła w (0,R,0), jednostka = promień opony (≈ 320 mm).
import * as THREE from 'three';
import { W, H, clamp } from './core.js';

// ------------------------------------------------------------------ stałe strony
export const R = 1.0, HW = 0.30, TW = 0.22;
const SAI = 15 * Math.PI / 180;
const KP_OFF = Math.tan(SAI);
const KP_TOP_T = 1.52;
const EX_CAMBER = 2.6, EX_TOE = 28;
const R_REAL_MM = 320;
export const SPEC = { camber: [-0.5, 0.5], toe: [-0.6, 0.6], caster: [3.0, 8.0], press: [2.0, 2.4] };
export const FACTORY = { camber: -0.3, toe: 0.2, caster: 4.5, steer: 0, press: 2.2 };
export const VIEWS = {
  iso: { yaw: Math.PI + 0.80, pitch: 0.38, dist: 4.45 },
  camber: { yaw: Math.PI, pitch: 0.09, dist: 4.45 },
  toe: { yaw: Math.PI, pitch: 1.34, dist: 4.40 },
  caster: { yaw: Math.PI * 1.5, pitch: 0.09, dist: 4.45 },
};

// profil kontaktowy do kinematyki (jak PROF na stronie): [x (× HW), r, rodzaj 0 ścianka / 1 bieżnik / 2 rowek]
const PROF = [
  [-0.70, 0.620, 0], [-1.02, 0.820, 0], [-0.99, 0.940, 0],
  [-0.88, 0.992, 1], [-0.66, 0.999, 1],
  [-0.60, 0.964, 2], [-0.44, 0.964, 2],
  [-0.38, 1.000, 1], [-0.06, 1.002, 1],
  [0.00, 0.966, 2], [0.14, 0.966, 2],
  [0.20, 1.002, 1], [0.48, 1.000, 1],
  [0.54, 0.964, 2], [0.70, 0.964, 2],
  [0.76, 0.995, 1], [0.88, 0.988, 1],
  [0.99, 0.940, 0], [1.02, 0.820, 0], [0.70, 0.620, 0],
];
const NP = PROF.length, NS = 96;
const MV = [];
for (let s = 0; s < NS; s++) {
  const a = s / NS * Math.PI * 2, col = [];
  for (let p = 0; p < NP; p++) col.push([PROF[p][0] * HW, PROF[p][1] * Math.cos(a), PROF[p][1] * Math.sin(a)]);
  MV.push(col);
}

// ------------------------------------------------------------------ macierze 3×3 (wierszami, jak na stronie)
export function rotAxis(ax, ay, az, ang) {
  const l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  ax /= l; ay /= l; az /= l;
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay,
    t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax,
    t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c];
}
export function mmul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
export function mv(m, p, o = [0, 0, 0]) {
  const x = p[0], y = p[1], z = p[2];
  o[0] = m[0] * x + m[1] * y + m[2] * z; o[1] = m[3] * x + m[4] * y + m[5] * z; o[2] = m[6] * x + m[7] * y + m[8] * z;
  return o;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ------------------------------------------------------------------ kinematyka (transform() + recompute() ze strony)
export class Kin {
  constructor() { this.S = { ...FACTORY }; this.update(); }
  toeRad() { return Math.atan((this.S.toe / 2) / 400); }
  update() {
    const S = this.S;
    const gam = -S.camber * EX_CAMBER * Math.PI / 180;
    const tau = -this.toeRad() * EX_TOE;
    const eps = S.caster * Math.PI / 180;
    const del = -S.steer * Math.PI / 180;
    const kpDir = this.kpDir = [-Math.cos(eps) * Math.sin(SAI), Math.cos(eps) * Math.cos(SAI), -Math.sin(eps)];
    const Mstatic = mmul(rotAxis(0, 0, 1, gam), rotAxis(0, 1, 0, tau));
    const Rst = rotAxis(kpDir[0], kpDir[1], kpDir[2], del);
    this.Mtot = mmul(Rst, Mstatic);
    this.kpT = [KP_OFF * (Rst[0] - 1), KP_OFF * Rst[3], KP_OFF * Rst[6]];
    let minY = 1e9, base = 1e9;
    const w = [0, 0, 0], tmp = [0, 0, 0];
    let cx = 0, cz = 0, cn = 0;
    const pts = [];
    for (let s = 0; s < NS; s++) for (let p = 0; p < NP; p++) {
      if (PROF[p][2] === 0) continue;
      mv(this.Mtot, MV[s][p], w);
      const y = w[1] + R + this.kpT[1];
      if (y < minY) minY = y;
      pts.push([w[0] + this.kpT[0], y, w[2] + this.kpT[2]]);
      mv(Mstatic, MV[s][p], tmp);
      if (tmp[1] + R < base) base = tmp[1] + R;
    }
    this.liftMM = (S.steer !== 0 ? base - minY : 0) * R_REAL_MM;
    this.groundShift = -minY;
    for (const q of pts) if (q[1] + this.groundShift < 0.02) { cx += q[0]; cz += q[2]; cn++; }
    this.contact = cn ? [cx / cn, 0, cz / cn] : [0, 0, 0];
    this.kpTop = this.axisPt(KP_TOP_T);
    this.kpBot = this.axisPt(-0.52);
    this.recompute();
  }
  axisPt(t) { const d = this.kpDir; return [-KP_OFF + d[0] * t, R + this.groundShift + d[1] * t, d[2] * t]; }
  // model zużycia opony (rozkład nacisku po szerokości bieżnika i tempo ścierania)
  recompute(NU = 56) {
    const S = this.S, infl = S.press - 2.2;
    const loadU = this.loadU = new Array(NU), wearU = this.wearU = new Array(NU);
    let sum = 0;
    for (let i = 0; i < NU; i++) {
      const u = -1 + 2 * (i + 0.5) / NU;
      const p = (1 + 0.85 * infl * (1 - 2 * u * u)) * (1 - 0.30 * S.camber * u);
      loadU[i] = p < 0.02 ? 0.02 : p;
      sum += loadU[i];
    }
    const mean = sum / NU;
    for (let i = 0; i < NU; i++) loadU[i] /= mean;
    const td = Math.abs(this.toeRad() * 180 / Math.PI), dir = S.toe > 0 ? 1 : -1;
    let wmax = 0;
    for (let i = 0; i < NU; i++) {
      const u = -1 + 2 * (i + 0.5) / NU;
      const scrub = 2.4 * td * (1 - 0.7 * dir * u);
      wearU[i] = Math.pow(loadU[i], 1.3) + (scrub < 0 ? 0 : scrub);
      if (wearU[i] > wmax) wmax = wearU[i];
    }
    const life = clamp(100 / wmax, 4, 100);
    this.model = {
      life, kmLeft: 50000 * life / 100, toeDeg: td,
      trailMM: R_REAL_MM * Math.tan(S.caster * Math.PI / 180),
    };
  }
  outOfSpec(k) { const sp = SPEC[k]; return sp ? this.S[k] < sp[0] - 1e-9 || this.S[k] > sp[1] + 1e-9 : false; }
}

// ------------------------------------------------------------------ kamera (rzut identyczny z proj() strony)
// eye/target w świecie, FOC w px, (cx, cy) = punkt, w który trafia oś kamery (w px kadru 1080×1920)
export class WheelCam {
  constructor() {
    this.cam = new THREE.Camera();
    this.cam.matrixAutoUpdate = false;
    this.cam.matrixWorldAutoUpdate = false;
    this.V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.eye = [0, 0.52, 4.45];
    this.foc = 1000; this.cx = W / 2; this.cy = H / 2;
  }
  // widok jak na stronie: yaw/pitch/dist wokół punktu (0, 0,52·R, 0)
  orbit(yaw, pitch, dist, target = [0, R * 0.52, 0], roll = 0) {
    let V = mmul(rotAxis(1, 0, 0, pitch), rotAxis(0, 1, 0, yaw));
    if (roll) V = mmul(rotAxis(0, 0, 1, roll), V);
    const back = [V[6], V[7], V[8]];                     // trzeci wiersz = oś "do kamery"
    this.V = V;
    this.eye = [target[0] + back[0] * dist, target[1] + back[1] * dist, target[2] + back[2] * dist];
    return this;
  }
  lookAt(eye, target, roll = 0) {
    const z = norm(sub(eye, target));
    let x = norm(cross([0, 1, 0], z));
    let y = cross(z, x);
    if (roll) {
      const c = Math.cos(roll), s = Math.sin(roll);
      [x, y] = [[x[0] * c + y[0] * s, x[1] * c + y[1] * s, x[2] * c + y[2] * s], [y[0] * c - x[0] * s, y[1] * c - x[1] * s, y[2] * c - x[2] * s]];
    }
    this.V = [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
    this.eye = eye.slice();
    return this;
  }
  frame(foc, cx, cy) { this.foc = foc; this.cx = cx; this.cy = cy; return this; }
  apply(near = 0.05, far = 40) {
    const V = this.V, e = this.eye;
    const t = [-(V[0] * e[0] + V[1] * e[1] + V[2] * e[2]), -(V[3] * e[0] + V[4] * e[1] + V[5] * e[2]), -(V[6] * e[0] + V[7] * e[1] + V[8] * e[2])];
    const c = this.cam;
    c.matrixWorldInverse.set(V[0], V[1], V[2], t[0], V[3], V[4], V[5], t[1], V[6], V[7], V[8], t[2], 0, 0, 0, 1);
    c.matrixWorld.copy(c.matrixWorldInverse).invert();
    const f = this.foc, w = W, h = H;
    c.projectionMatrix.set(2 * f / w, 0, 1 - 2 * this.cx / w, 0, 0, 2 * f / h, 2 * this.cy / h - 1, 0,
      0, 0, -(far + near) / (far - near), -2 * far * near / (far - near), 0, 0, -1, 0);
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    return this;
  }
  // punkt świata → piksele kadru [x, y, głębokość]
  proj(p) {
    const V = this.V, e = this.eye;
    const d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]];
    const x = V[0] * d[0] + V[1] * d[1] + V[2] * d[2], y = V[3] * d[0] + V[4] * d[1] + V[5] * d[2], z = V[6] * d[0] + V[7] * d[1] + V[8] * d[2];
    const dd = Math.max(0.05, -z);
    return [this.cx + this.foc * x / dd, this.cy - this.foc * y / dd, dd];
  }
}

// ------------------------------------------------------------------ shader (FS strony + opcjonalne światło konturowe)
const VS = /* glsl */`
uniform mat4 lightMatrix;
varying vec3 vWorld, vNormal, vLocal, vLocalNormal;
varying vec4 vShadow;
void main(){
  vec4 p = modelMatrix * vec4(position, 1.0);
  vWorld = p.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vLocal = position; vLocalNormal = normal;
  vShadow = lightMatrix * p;
  gl_Position = projectionMatrix * viewMatrix * p;
}`;
const FS = /* glsl */`
precision highp float;
varying vec3 vWorld, vNormal, vLocal, vLocalNormal;
varying vec4 vShadow;
uniform vec3 color, wheelCenter, rimDir, rimCol, sweepDir;
uniform float roughness, metallic, kind, shadowTexel, opacity, sweep, floorFade;
uniform vec2 fadeY;                 // wygaszenie ku górze kadru (px od góry: start, koniec)
uniform mat3 wheelInverse;
uniform sampler2D sidewall, shadowMap, emblem;
const float PI = 3.14159265;
float noise(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
float shadow(){
  vec3 p = vShadow.xyz / vShadow.w * 0.5 + 0.5;
  if(p.x<0.0 || p.x>1.0 || p.y<0.0 || p.y>1.0 || p.z>1.0) return 1.0;
  float lit = 0.0;
  for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++){
    float d = texture2D(shadowMap, p.xy + vec2(float(i),float(j))*shadowTexel*1.2).r;
    lit += p.z-0.0018 <= d ? 1.0 : 0.0;
  }
  return lit/25.0;
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
  vec3 e = env+vec3(2.8,2.6,2.35)*a+vec3(1.3,1.6,2.0)*b+vec3(0.9,0.95,1.1)*c;
  // przesuwany pas światła (przejazd softboxa po felgach w intro)
  if (sweep > 0.0) e += vec3(3.2, 3.0, 2.8) * sweep * pow(max(dot(r, sweepDir), 0.0), mix(160.0, 12.0, rough));
  return e;
}
float topFade(){
  if (fadeY.y <= 0.0) return 1.0;
  float y = ${H.toFixed(1)} - gl_FragCoord.y;
  return smoothstep(fadeY.x, fadeY.y, y);
}
void main(){
  vec3 n=normalize(vNormal), v=normalize(cameraPosition-vWorld);
  if(!gl_FrontFacing) n=-n;
  vec3 base=pow(color,vec3(2.2));
  float rough=roughness, metal=metallic;
  float radius=length(vLocal.yz);
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
  if(kind>3.5){
    vec3 q=wheelInverse*(vWorld-wheelCenter);
    float contact=exp(-pow(q.x/0.40,2.0)-pow(q.z/0.52,2.0));
    float broad=exp(-pow(q.x/0.85,2.0)-pow(q.z/1.1,2.0));
    vec2 grid=abs(fract(vWorld.xz/0.4+0.5)-0.5);
    float line=1.0-smoothstep(0.003,0.015,min(grid.x,grid.y));
    float edge=1.0-smoothstep(1.5*floorFade,3.6*floorFade,length(vWorld.xz));
    vec3 floorCol=vec3(0.034,0.036,0.042)+line*0.012*edge;
    floorCol*=1.0-0.48*contact-0.13*broad;
    floorCol*=0.56+0.44*sh;
    gl_FragColor=vec4(pow(floorCol,vec3(1.0/2.2))*edge*0.96*opacity, edge*0.96*opacity)*topFade();
    return;
  }
  vec3 light=lamp(n,v,normalize(vec3(0.7,1.0,0.65)),vec3(4.2,3.95,3.65),base,metal,rough)*(0.35+0.65*sh);
  light+=lamp(n,v,normalize(vec3(-0.8,0.65,-0.7)),vec3(2.15,2.55,3.2),base,metal,rough);
  light+=lamp(n,v,normalize(vec3(0.4,0.2,-1.0)),vec3(1.2,1.3,1.5),base,metal,rough);
  light+=lamp(n,v,rimDir,rimCol,base,metal,rough);
  vec3 f=fresnel(max(dot(n,v),0.0),mix(vec3(0.04),base,metal));
  float reflectionWeight=(kind>0.5 && kind<1.5) ? 0.14 : (0.9-rough*0.3);
  light+=environment(reflect(-v,n),rough)*f*reflectionWeight;
  light+=base*(1.0-metal)*vec3(0.22,0.24,0.28)*(0.7+0.3*n.y);
  light*=0.80+0.20*smoothstep(0.0,1.1,vWorld.y);
  light=light/(light+vec3(0.8));
  gl_FragColor=vec4(pow(light,vec3(1.0/2.2))*opacity, opacity)*topFade();
}`;

const MATS = {
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
  floor: { color: [0.2, 0.2, 0.2], rough: 1, metal: 0, kind: 4 },
};

// ------------------------------------------------------------------ budowa bryły (kod strony; builder → BufferGeometry)
function frameMatrix(x, y, z, p) { return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1]; }
function scaleVector(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
function matrixMultiply(a, b) {
  const o = new Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    o[col * 4 + row] = 0; for (let k = 0; k < 4; k++) o[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  }
  return o;
}
function localPoint(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
export function directionMatrix(a, b, r) {
  const d = sub(b, a), length = Math.hypot(d[0], d[1], d[2]), y = norm(d);
  const x = norm(cross(y, Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1])), z = cross(x, y);
  return frameMatrix(scaleVector(x, r), scaleVector(y, length), scaleVector(z, r), a);
}
function builder() { return { groups: {} }; }
function vertex(b, key, p, n) { const a = b.groups[key] || (b.groups[key] = []); a.push(p[0], p[1], p[2], n[0], n[1], n[2]); }
function triangle(b, key, a, c, d, na, nc, nd) {
  const n = na || norm(cross(sub(c, a), sub(d, a)));
  if (na && dot(cross(sub(c, a), sub(d, a)), na) < 0) { let s = c; c = d; d = s; s = nc; nc = nd; nd = s; }
  vertex(b, key, a, n); vertex(b, key, c, nc || n); vertex(b, key, d, nd || n);
}
function quad(b, key, a, c, d, e, na, nc, nd, ne) { triangle(b, key, a, c, d, na, nc, nd); triangle(b, key, a, d, e, na, nd, ne); }
function polar(x, r, a) { return [x, r * Math.cos(a), r * Math.sin(a)]; }
function lathe(b, key, profile, segments, smooth, start, extent) {
  start = start || 0; extent = extent === undefined ? Math.PI * 2 : extent;
  for (let p = 0; p < profile.length - 1; p++) {
    const normalAt = (j, a) => {
      const lo = smooth ? Math.max(0, j - 1) : p, hi = smooth ? Math.min(profile.length - 1, j + 1) : p + 1;
      const dx = profile[hi][0] - profile[lo][0], dr = profile[hi][1] - profile[lo][1];
      return norm([dr, -dx * Math.cos(a), -dx * Math.sin(a)]);
    };
    for (let i = 0; i < segments; i++) {
      const a = start + extent * i / segments, c = start + extent * (i + 1) / segments;
      const p0 = polar(profile[p][0], profile[p][1], a), p1 = polar(profile[p + 1][0], profile[p + 1][1], a);
      const p2 = polar(profile[p + 1][0], profile[p + 1][1], c), p3 = polar(profile[p][0], profile[p][1], c);
      quad(b, key, p0, p1, p2, p3, normalAt(p, a), normalAt(p + 1, a), normalAt(p + 1, c), normalAt(p, c));
    }
  }
}
function ring(b, key, x, r, t) {
  const profile = [];
  for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; profile.push([x + Math.cos(a) * t, r + Math.sin(a) * t]); }
  lathe(b, key, profile, 144, true);
}
function transformed(b, m, fn) {
  const temp = builder(); fn(temp);
  for (const key of Object.keys(temp.groups)) {
    const a = temp.groups[key];
    for (let i = 0; i < a.length; i += 6) {
      const p = localPoint(m, a.slice(i, i + 3));
      const n = norm([m[0] * a[i + 3] + m[4] * a[i + 4] + m[8] * a[i + 5], m[1] * a[i + 3] + m[5] * a[i + 4] + m[9] * a[i + 5], m[2] * a[i + 3] + m[6] * a[i + 4] + m[10] * a[i + 5]]);
      vertex(b, key, p, n);
    }
  }
}
const REMAP = [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1];
function cylinder(b, key, a, c, r, segments) {
  transformed(b, matrixMultiply(directionMatrix(a, c, r), REMAP), t => { lathe(t, key, [[0, 0], [0, 1], [1, 1], [1, 0]], segments || 24, false); });
}
function tubePath(b, key, points, r, sides) {
  const rings = [], normals = [];
  for (let i = 0; i < points.length; i++) {
    const tangent = norm(sub(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]));
    const u = norm(cross(tangent, [0, 1, 0])), v = cross(tangent, u), row = [], nr = [];
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2, n = [u[0] * Math.cos(a) + v[0] * Math.sin(a), u[1] * Math.cos(a) + v[1] * Math.sin(a), u[2] * Math.cos(a) + v[2] * Math.sin(a)];
      row.push([points[i][0] + n[0] * r, points[i][1] + n[1] * r, points[i][2] + n[2] * r]); nr.push(n);
    }
    rings.push(row); normals.push(nr);
  }
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < sides; j++) {
    const next = (j + 1) % sides;
    quad(b, key, rings[k][j], rings[k + 1][j], rings[k + 1][next], rings[k][next], normals[k][j], normals[k + 1][j], normals[k + 1][next], normals[k][next]);
  }
}

function buildWheel() {
  const wheel = builder();
  const profile = [[-.26, .635], [-.286, .67], [-.319, .72], [-.336, .79], [-.338, .84], [-.326, .89], [-.304, .936], [-.274, .968], [-.242, .976], [.242, .976], [.274, .968], [.304, .936], [.326, .89], [.338, .84], [.336, .79], [.319, .72], [.286, .67], [.26, .635]];
  lathe(wheel, 'rubber', profile, 160, true);
  for (const side of [-1, 1]) {
    ring(wheel, 'rubber', side * .327, .752, .003);
    ring(wheel, 'rubber', side * .339, .825, .002);
    ring(wheel, 'rubber', side * .294, .942, .0025);
    ring(wheel, 'rubber', side * .283, .674, .006);
  }
  function treadBlock(x0, x1, a0, a1, shift) {
    const slices = 4, bevel = .003;
    const pt = (x, a, inset) => { const r = .999 - .024 * Math.pow(x / .29, 4) - inset; return polar(x, r, a + shift * x); };
    for (let i = 0; i < slices; i++) {
      const a = a0 + (a1 - a0) * i / slices, c = a0 + (a1 - a0) * (i + 1) / slices;
      const q0 = pt(x0 + bevel, a, 0), q1 = pt(x1 - bevel, a, 0), q2 = pt(x1 - bevel, c, 0), q3 = pt(x0 + bevel, c, 0);
      quad(wheel, 'tread', q0, q1, q2, q3, [0, Math.cos(a), Math.sin(a)], [0, Math.cos(a), Math.sin(a)], [0, Math.cos(c), Math.sin(c)], [0, Math.cos(c), Math.sin(c)]);
      quad(wheel, 'rubber', pt(x0, a, .019), pt(x0, c, .019), q3, q0);
      quad(wheel, 'rubber', q1, q2, pt(x1, c, .019), pt(x1, a, .019));
    }
    quad(wheel, 'rubber', pt(x0, a0, .019), pt(x1, a0, .019), pt(x1 - bevel, a0, 0), pt(x0 + bevel, a0, 0));
    quad(wheel, 'rubber', pt(x0 + bevel, a1, 0), pt(x1 - bevel, a1, 0), pt(x1, a1, .019), pt(x0, a1, .019));
  }
  const ribs = [[-.284, -.191], [-.170, -.069], [-.049, .049], [.069, .170], [.191, .284]];
  ribs.forEach((rib, row) => {
    for (let i = 0; i < 64; i++) {
      const start = (i + row * .32) / 64 * Math.PI * 2, gap = .009;
      const end = start + Math.PI * 2 / 64 - gap, mid = (start + end) / 2;
      treadBlock(rib[0], rib[1], start, mid - .0014, row < 2 ? .22 : -.22);
      treadBlock(rib[0], rib[1], mid + .0014, end, row < 2 ? .22 : -.22);
    }
  });
  lathe(wheel, 'graphite', [[-.278, .635], [-.28, .664], [-.24, .678], [.229, .678], [.245, .655], [.22, .626], [-.245, .621], [-.278, .635]], 144, false);
  lathe(wheel, 'machined', [[.215, .627], [.264, .634], [.278, .65], [.264, .676], [.246, .68], [.239, .664], [.249, .65], [.235, .64], [.215, .627]], 160, true);
  ring(wheel, 'silver', -.278, .647, .013);
  function spoke(a, r0, r1, offset, w0, w1) {
    const p0 = [r0 * Math.cos(a), r0 * Math.sin(a)], p1 = [r1 * Math.cos(a + offset), r1 * Math.sin(a + offset)];
    const d = norm([0, p1[0] - p0[0], p1[1] - p0[1]]), perp = [-d[2], d[1]];
    const outline = [[p0[0] + perp[0] * w0, p0[1] + perp[1] * w0], [p1[0] + perp[0] * w1, p1[1] + perp[1] * w1], [p1[0] - perp[0] * w1, p1[1] - perp[1] * w1], [p0[0] - perp[0] * w0, p0[1] - perp[1] * w0]];
    const cy = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2, front = [], edge = [], back = [];
    for (const p of outline) {
      const rad = Math.hypot(p[0], p[1]), x = .10 + .16 * Math.pow(rad / .66, 1.4);
      edge.push([x - .008, p[0], p[1]]); back.push([x - .07, p[0], p[1]]);
      front.push([x, cy + (p[0] - cy) * .94, cz + (p[1] - cz) * .88]);
    }
    quad(wheel, 'silver', front[0], front[1], front[2], front[3]);
    quad(wheel, 'graphite', back[3], back[2], back[1], back[0]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(wheel, 'machined', edge[i], edge[j], front[j], front[i]); quad(wheel, 'graphite', back[i], back[j], edge[j], edge[i]); }
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + .12;
    spoke(a, .13, .34, 0, .057, .043);
    spoke(a, .29, .664, -.15, .028, .032);
    spoke(a, .29, .664, .15, .028, .032);
  }
  lathe(wheel, 'graphite', [[.035, 0], [.035, .176], [.10, .19], [.16, .166], [.174, .106], [.174, 0]], 96, true);
  lathe(wheel, 'cap', [[.177, 0], [.177, .093]], 96, false);
  ring(wheel, 'machined', .176, .096, .005);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + .12 + Math.PI / 5, loc = polar(0, .143, a);
    transformed(wheel, frameMatrix([1, 0, 0], [0, 1, 0], [0, 0, 1], loc), t => {
      lathe(t, 'black', [[.143, 0], [.143, .03], [.162, .03], [.162, 0]], 32, false);
      lathe(t, 'machined', [[.16, 0], [.16, .019], [.178, .019], [.183, .014], [.183, 0]], 6, false);
    });
  }
  lathe(wheel, 'disc', [[-.045, .235], [-.045, .513], [-.039, .524], [-.023, .524], [-.023, .506], [-.012, .506], [-.012, .524], [.003, .524], [.01, .513], [.01, .235], [-.045, .235]], 144, false);
  lathe(wheel, 'graphite', [[-.09, 0], [-.09, .23], [.004, .25], [.018, .23], [.045, .17], [.045, 0]], 96, false);
  for (let i = 0; i < 10; i++) {
    const pt = polar(0, .218, i / 10 * Math.PI * 2);
    cylinder(wheel, 'steel', [.018, pt[1], pt[2]], [.028, pt[1], pt[2]], .013, 8);
  }
  cylinder(wheel, 'black', polar(.235, .575, 2.45), polar(.30, .605, 2.45), .012, 14);
  cylinder(wheel, 'steel', polar(.30, .605, 2.45), polar(.315, .613, 2.45), .013, 12);
  // zacisk: osobny builder (na stronie był w tej samej bryle; tu stoi w miejscu, gdy koło się toczy)
  const caliper = builder();
  lathe(caliper, 'red', [[-.105, .382], [-.122, .40], [-.122, .523], [-.10, .55], [.062, .55], [.09, .523], [.09, .412], [.065, .382], [-.105, .382]], 36, true, .92, 1.30);
  for (const a of [.92, 2.22]) quad(caliper, 'red', polar(-.105, .39, a), polar(.062, .39, a), polar(.062, .54, a), polar(-.105, .54, a));
  for (let i = 0; i < 3; i++) {
    const a = 1.19 + i * .35, pt = polar(0, .47, a);
    cylinder(caliper, 'red', [.085, pt[1], pt[2]], [.103, pt[1], pt[2]], .047, 24);
  }
  return { wheel, caliper };
}
function buildSuspension() {
  const s = builder();
  cylinder(s, 'graphite', [0, .03, 0], [0, 1.16, 0], .06, 40);
  cylinder(s, 'machined', [0, 1.04, 0], [0, 1.52, 0], .024, 32);
  cylinder(s, 'red', [0, .87, 0], [0, 1.03, 0], .064, 40);
  cylinder(s, 'black', [0, 1.07, 0], [0, 1.11, 0], .174, 48);
  cylinder(s, 'steel', [0, 1.10, 0], [0, 1.125, 0], .157, 48);
  cylinder(s, 'black', [0, 1.45, 0], [0, 1.49, 0], .164, 48);
  cylinder(s, 'graphite', [0, 1.49, 0], [0, 1.53, 0], .19, 48);
  const coil = [];
  for (let i = 0; i <= 320; i++) { const t = i / 320, a = t * Math.PI * 2 * 4.5; coil.push([Math.cos(a) * .14, 1.135 + t * .30, Math.sin(a) * .14]); }
  tubePath(s, 'red', coil, .018, 10);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; cylinder(s, 'machined', [Math.cos(a) * .125, 1.53, Math.sin(a) * .125], [Math.cos(a) * .125, 1.557, Math.sin(a) * .125], .019, 6); }
  cylinder(s, 'steel', [0, -.48, 0], [0, .15, 0], .073, 24);
  cylinder(s, 'black', [0, -.54, 0], [0, -.45, 0], .092, 24);
  return s;
}

// ------------------------------------------------------------------ tekstury (napisy na boku opony, emblemat) — ×4
function sidewallCanvas(S = 4096) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const tx = c.getContext('2d'), k = S / 1024;
  tx.fillStyle = '#b8bdc7';
  const arcText = (text, radius, center, size) => {
    tx.font = '700 ' + size * k + 'px Arial, sans-serif';
    const widths = Array.from(text).map(ch => tx.measureText(ch).width + 3 * k), total = widths.reduce((a, b) => a + b, 0);
    let angle = center - total / (radius * k) / 2;
    Array.from(text).forEach((ch, i) => {
      const half = widths[i] / (radius * k) / 2; angle += half;
      tx.save(); tx.translate(S / 2 + Math.sin(angle) * radius * k, S / 2 - Math.cos(angle) * radius * k); tx.rotate(angle);
      tx.textAlign = 'center'; tx.textBaseline = 'middle'; tx.fillText(ch, 0, 0); tx.restore(); angle += half;
    });
  };
  arcText('SSCAR  PERFORMANCE', 423, 0, 30);
  arcText('205/55 R16  ·  RADIAL TUBELESS', 421, Math.PI, 17);
  arcText('ROTATION  ›', 457, 1.60, 13);
  arcText('SPORT CONTACT', 387, -1.62, 13);
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; tx.save(); tx.translate(S / 2, S / 2); tx.rotate(a); tx.fillRect(-1 * k, -469 * k, 2 * k, 8 * k); tx.restore(); }
  return c;
}
function emblemCanvas(S = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const lg = c.getContext('2d'), k = S / 256;
  lg.fillStyle = '#e5e9ef'; lg.font = 'italic 900 ' + 74 * k + 'px Arial'; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillText('SS', 128 * k, 116 * k);
  lg.fillStyle = '#db3028'; lg.fillRect(72 * k, 162 * k, 112 * k, 8 * k);
  return c;
}
function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = true;
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 16;
  return t;
}

function geometryOf(b) {
  const out = {};
  for (const key of Object.keys(b.groups)) {
    const a = new Float32Array(b.groups[key]);
    const n = a.length / 6, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set(a.subarray(i * 6, i * 6 + 3), i * 3); nor.set(a.subarray(i * 6 + 3, i * 6 + 6), i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
    out[key] = g;
  }
  return out;
}
const mat4 = a => new THREE.Matrix4().fromArray(a);

// ------------------------------------------------------------------ zespół: bryły + cień + parametry sceny
export class WheelRig {
  constructor(renderer) {
    this.renderer = renderer;
    this.kin = new Kin();
    this.view = new WheelCam();
    this.scene = new THREE.Scene();
    this.spin = 0;                 // obrót koła wokół osi (toczenie), rad
    this.opacity = 1;
    this.floorOpacity = 1;
    this.floorFade = 1;
    this.showSusp = true;
    this.fadeY = [0, 0];
    this.sweep = 0; this.sweepDir = new THREE.Vector3(0, 0, 1);
    this.rimDir = new THREE.Vector3(-0.3, 0.4, 1).normalize(); this.rimCol = new THREE.Vector3(0, 0, 0);

    const SH = 2048;
    this.shadowRT = new THREE.WebGLRenderTarget(SH, SH, { depthBuffer: true, depthTexture: new THREE.DepthTexture(SH, SH, THREE.UnsignedIntType) });
    this.shadowRT.depthTexture.minFilter = this.shadowRT.depthTexture.magFilter = THREE.NearestFilter;
    const lightCam = this.lightCam = new THREE.OrthographicCamera(-2.6, 2.6, 2.6, -2.6, 0, 12);
    lightCam.position.set(3.5, 6, 3.25); lightCam.up.set(0, 1, 0); lightCam.lookAt(-.25, 1, 0); lightCam.updateMatrixWorld();
    this.lightMatrix = new THREE.Matrix4().multiplyMatrices(lightCam.projectionMatrix, lightCam.matrixWorldInverse);
    this.depthScene = new THREE.Scene();
    this.depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });

    const sidewall = texture(sidewallCanvas()), emblem = texture(emblemCanvas());
    const shared = {
      lightMatrix: { value: this.lightMatrix }, shadowMap: { value: this.shadowRT.depthTexture }, shadowTexel: { value: 1 / SH },
      sidewall: { value: sidewall }, emblem: { value: emblem },
      wheelCenter: { value: new THREE.Vector3() }, wheelInverse: { value: new THREE.Matrix3() },
      rimDir: { value: this.rimDir }, rimCol: { value: this.rimCol },
      sweep: { value: 0 }, sweepDir: { value: this.sweepDir }, floorFade: { value: 1 }, fadeY: { value: new THREE.Vector2(0, 0) },
    };
    this.shared = shared;
    this.mats = {};
    for (const [k, m] of Object.entries(MATS)) {
      this.mats[k] = new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide,
        uniforms: { ...shared, color: { value: new THREE.Vector3(...m.color) }, roughness: { value: m.rough }, metallic: { value: m.metal }, kind: { value: m.kind }, opacity: { value: 1 } },
        transparent: false, depthWrite: true,
      });
    }
    // podłoga: przezroczysta, z mnożonym alfa (kolor jest już pomnożony w shaderze)
    const fm = this.mats.floor;
    fm.transparent = true; fm.depthWrite = false;
    fm.blending = THREE.CustomBlending; fm.blendSrc = THREE.OneFactor; fm.blendDst = THREE.OneMinusSrcAlphaFactor;

    const mk = (geos, parent) => {
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      for (const [key, g] of Object.entries(geos)) {
        const m = new THREE.Mesh(g, this.mats[key]);
        m.frustumCulled = false;
        group.add(m);
      }
      parent.add(group);
      return group;
    };
    const { wheel, caliper } = buildWheel();
    const wheelG = geometryOf(wheel), caliperG = geometryOf(caliper), suspG = geometryOf(buildSuspension());
    const unit = builder(); cylinder(unit, 'steel', [0, 0, 0], [0, 1, 0], 1, 24);
    const joint = builder(); cylinder(joint, 'black', [0, 0, 0], [0, 1, 0], 1, 32);
    const unitG = geometryOf(unit), jointG = geometryOf(joint);
    const floorB = builder(); quad(floorB, 'floor', [-4, -.025, -4], [-4, -.025, 4], [4, -.025, 4], [4, -.025, -4], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.floor = mk(geometryOf(floorB), this.scene);
    this.floor.matrix.identity();
    this.gWheel = mk(wheelG, this.root);
    this.gCaliper = mk(caliperG, this.root);
    this.gSusp = mk(suspG, this.root);
    this.gArms = [0, 1, 2, 3].map(() => mk(unitG, this.root));
    this.gJoints = [0, 1].map(() => mk(jointG, this.root));
    // cień: te same bryły w scenie głębokości
    this.depthRoot = new THREE.Group();
    this.depthScene.add(this.depthRoot);
    this.depthPieces = [];
    for (const src of [this.gWheel, this.gCaliper, this.gSusp, ...this.gArms, ...this.gJoints]) {
      const g = new THREE.Group(); g.matrixAutoUpdate = false;
      for (const m of src.children) { const d = new THREE.Mesh(m.geometry, this.depthMat); d.frustumCulled = false; g.add(d); }
      this.depthRoot.add(g);
      this.depthPieces.push([src, g]);
    }
  }

  // ustawia macierze części wg kinematyki (render() strony)
  pose() {
    const K = this.kin;
    K.update();
    const M = K.Mtot;
    const center = [K.kpT[0], R + K.groundShift + K.kpT[1], K.kpT[2]];
    const wheelMatrix = [M[0], M[3], M[6], 0, M[1], M[4], M[7], 0, M[2], M[5], M[8], 0, center[0], center[1], center[2], 1];
    const spin = frameMatrix([1, 0, 0], [0, Math.cos(this.spin), Math.sin(this.spin)], [0, -Math.sin(this.spin), Math.cos(this.spin)], [0, 0, 0]);
    this.gWheel.matrix.copy(mat4(matrixMultiply(wheelMatrix, spin)));
    this.gCaliper.matrix.copy(mat4(wheelMatrix));
    const up = K.kpDir, right = norm(cross(up, [0, 0, 1])), back = cross(right, up);
    this.gSusp.matrix.copy(mat4(frameMatrix(right, up, back, K.axisPt(0))));
    this.gSusp.visible = this.showSusp;
    const a1 = [-1.38, K.kpBot[1] + .04, .55], a2 = [-1.38, K.kpBot[1] + .04, -.48];
    const hub = localPoint(wheelMatrix, [-.12, 0, 0]);
    [[K.kpBot, a1, .057], [K.kpBot, a2, .062], [a1, a2, .065], [K.axisPt(0), hub, .098]].forEach((v, i) => this.gArms[i].matrix.copy(mat4(directionMatrix(v[0], v[1], v[2]))));
    [a1, a2].forEach((p, i) => this.gJoints[i].matrix.copy(mat4(directionMatrix([p[0], p[1], p[2] - .055], [p[0], p[1], p[2] + .055], .095))));
    for (const [src, d] of this.depthPieces) { d.matrix.copy(src.matrix); d.visible = src.visible; }
    this.root.updateMatrixWorld(true);
    this.depthRoot.updateMatrixWorld(true);
    this.floor.updateMatrixWorld(true);
    const s = this.shared;
    s.wheelCenter.value.set(center[0], center[1], center[2]);
    s.wheelInverse.value.set(M[0], M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8]);
    s.sweep.value = this.sweep;
    s.floorFade.value = this.floorFade;
    s.fadeY.value.set(this.fadeY[0], this.fadeY[1]);
    for (const [k, m] of Object.entries(this.mats)) m.uniforms.opacity.value = k === 'floor' ? this.opacity * this.floorOpacity : this.opacity;
    const opaque = this.opacity >= 0.999;
    for (const [k, m] of Object.entries(this.mats)) {
      if (k === 'floor') continue;
      m.transparent = !opaque; m.depthWrite = true;
      m.blending = opaque ? THREE.NoBlending : THREE.CustomBlending;
      m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
    }
  }

  // element listy renderowania pipeline'u (cień liczony tuż przed właściwym renderem)
  item() {
    this.pose();
    this.view.apply();
    return {
      scene: this.scene, camera: this.view.cam,
      before: () => {
        const r = this.renderer, prev = r.getRenderTarget();
        r.setRenderTarget(this.shadowRT);
        r.setClearColor(0x000000, 1);
        r.clear(true, true, false);
        r.render(this.depthScene, this.lightCam);
        r.setRenderTarget(prev);
      },
    };
  }

  // odcisk opony na jezdni (drawPatch3D strony): paski szerokości bieżnika, długość ∝ nacisk, kolor ∝ ścieranie
  patchQuads(NU = 56) {
    const K = this.kin, out = [];
    for (let i = 0; i < NU; i++) {
      const u = -1 + 2 * (i + 0.5) / NU;
      const w = mv(K.Mtot, [-u * TW, -R, 0]);
      const half = 0.34 * clamp(K.loadU[i], 0, 2.4) / 2;
      if (half < 0.004) continue;
      const wu = TW / NU * 1.05, xw = w[0] + K.kpT[0], zc = w[2] + K.kpT[2];
      const q = [[xw - wu, 0.001, zc - half], [xw + wu, 0.001, zc - half], [xw + wu, 0.001, zc + half], [xw - wu, 0.001, zc + half]].map(p => this.view.proj(p));
      out.push({ q, t: clamp((K.wearU[i] - 0.85) / 1.5, 0, 1) });
    }
    return out;
  }
}
