/* ET9 3D car for Mark 2 — one model, many views.
   Built on three.js r170 (MIT). The model file is Adi's own purchased ET9 exterior.
   Usage: const v = await ET9.mount(el, { view: 'qc' | 'ty' | 'side' | 'hero', orbit: true, onPick })
          v.set({ open: {dfl, dfr, drl, drr, frunk, boot}, port, wins: {fl, fr, rl, rr}, mir: 'fold'|'out',
                  shade: {l, r}, lights: 'on'|'auto'|'off', lift: mm, spin: true, warn: 'fl'|null }) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';

const BASE = new URL('.', import.meta.url).href;
const EASE = t => 1 - Math.pow(1 - t, 3);          // close to the HMI's cubic-bezier(.2,.8,.2,1)

export const PAINTS = {
  ceramic:  { name: 'Midnight Ceramic Blue', c: '#1d2540', m: .55, r: .3 },
  lavender: { name: 'Lavender silver',       c: '#b8b1d2', m: .7,  r: .3 },
  cloud:    { name: 'Cloud White',           c: '#e8e7ec', m: .05, r: .28 },
  black:    { name: 'Deep Black',            c: '#18171d', m: .5,  r: .26 },
  moon:     { name: 'New Moon Silver',       c: '#a3a5ac', m: .85, r: .3 },
  southern: { name: 'Southern Star Blue',    c: '#33548c', m: .6,  r: .3 },
  gold:     { name: 'Sunlight Gold',         c: '#b89c6c', m: .8,  r: .3 },
};
const storedPaint = () => { try { return localStorage.getItem('nio-paint'); } catch (e) { return null; } };
let paintKey = PAINTS[storedPaint()] ? storedPaint() : 'ceramic';

/* ---------- shared materials ---------- */
const M = {
  paint: new THREE.MeshPhysicalMaterial({ clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#191722', metalness: .1, roughness: .05, envMapIntensity: 1.4, transparent: true, opacity: .9 }),
  roof: new THREE.MeshPhysicalMaterial({ color: '#1d1a28', metalness: .1, roughness: .04, envMapIntensity: 1.5, transparent: true, opacity: .62, depthWrite: false }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .05, transparent: true, opacity: .18, depthWrite: false }),
  redLens: new THREE.MeshPhysicalMaterial({ color: '#5a1018', roughness: .1, transparent: true, opacity: .85 }),
  head: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1 }),
  tail: new THREE.MeshStandardMaterial({ color: '#3a0a10', emissive: '#ff2236', emissiveIntensity: 1 }),
  cabin: new THREE.MeshStandardMaterial({ color: '#2a2534', roughness: .9 }),
  fabric: new THREE.MeshStandardMaterial({ color: '#cfc9dc', roughness: .95, side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ color: '#7fcf96', transparent: true, opacity: 0, depthWrite: false }),
};
M.paintD = M.paint.clone(); M.paintD.side = THREE.DoubleSide;
function applyPaint() { const p = PAINTS[paintKey]; [M.paint, M.paintD].forEach(m => { m.color.set(p.c); m.metalness = p.m; m.roughness = p.r; m.needsUpdate = true; }); }
applyPaint();

/* ---------- geometry helpers ---------- */
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
// split a mesh's triangles (by world-space centroid) into new meshes; returns {key: Mesh}; triangles that match no key stay
function splitMesh(mesh, keyOf) {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index ? g.index.array : [...Array(pos.count).keys()];
  const mw = mesh.matrixWorld, buckets = {}, rest = [];
  for (let i = 0; i < idx.length; i += 3) {
    tmp.fromBufferAttribute(pos, idx[i]).applyMatrix4(mw); tmp2.fromBufferAttribute(pos, idx[i + 1]).applyMatrix4(mw); tmp3.fromBufferAttribute(pos, idx[i + 2]).applyMatrix4(mw);
    const c = tmp.add(tmp2).add(tmp3).multiplyScalar(1 / 3), k = keyOf(c);
    (k ? (buckets[k] = buckets[k] || []) : rest).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const out = {};
  Object.entries(buckets).forEach(([k, arr]) => {
    const ng = new THREE.BufferGeometry(); Object.entries(g.attributes).forEach(([n, a]) => ng.setAttribute(n, a)); ng.setIndex(arr);
    const m = new THREE.Mesh(ng, mesh.material); m.matrix.copy(mw); m.matrixAutoUpdate = false; m.matrix.decompose(m.position, m.quaternion, m.scale); m.matrixAutoUpdate = true;
    out[k] = m;
  });
  if (Object.keys(out).length) { const ng = new THREE.BufferGeometry(); Object.entries(g.attributes).forEach(([n, a]) => ng.setAttribute(n, a)); ng.setIndex(rest); mesh.geometry = ng; }
  return out;
}
const SMOOTH = new WeakMap();
function smoothGeo(g) { if (!SMOOTH.has(g)) { const n = toCreasedNormals(g, Math.PI / 2.6); SMOOTH.set(g, n); } return SMOOTH.get(g); }
function pivot(name, x, y, z) { const p = new THREE.Group(); p.name = name; p.position.set(x, y, z); return p; }

/* ---------- build one prepared car from the loaded file ---------- */
const DOOR_SRC = new Set([27, 39, 40, 41, 72, 44]), MIRROR = new Set([0, 45, 46]), HOOD = new Set([22]), BOOT = new Set([30, 50]);
const ROOFG = 29, GLASS_SIDE = 40;
const WZ = 1.62;                               // wheel centres, ±z
function doorKey(c) {
  if (Math.abs(c.x) < .5 || c.y < .3) return null; const s = c.x > 0 ? 'l' : 'r';
  if (c.z > -.165 && c.z < 1.05) return 'df' + s;
  if (c.z > -1.31 && c.z <= -.165) return 'dr' + s;
  return null;
}
function cornerOf(b) {
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  if (Math.abs(c.x) < .7 || s.y > .9 || b.max.y > .82 || Math.abs(Math.abs(c.z) - WZ) > .45) return null;
  return (c.z > 0 ? 'f' : 'r') + (c.x > 0 ? 'l' : 'r');
}

let rawP;
function loadRaw() { return rawP || (rawP = new GLTFLoader().loadAsync(BASE + 'model/et9.glb').then(g => {
  g.scene.traverse(o => { if (!o.isMesh) return; const a = g.parser.associations.get(o) || g.parser.associations.get(o.parent); o.userData.mi = a && a.meshes != null ? a.meshes : -1; });
  return g; })); }

async function buildCar() {
  const g = await loadRaw();
  const src = g.scene.clone(true); src.position.set(0, -.012740254402160645, -.016318082809448242); src.updateMatrixWorld(true);
  const list = [];
  src.traverse(o => { if (o.isMesh) list.push({ o, mi: o.userData.mi }); });
  // materials
  list.forEach(({ o }) => {
    const n = (o.material.name || '').toLowerCase();
    if (n === 'car paint' || n === 'car_paint') o.material = M.paint;
    else if (n.startsWith('glassblack.001')) o.material = M.roof;
    else if (n.startsWith('glassblack')) o.material = M.glass;
    else if (n === 'glassred') o.material = M.redLens;
    else if (n === 'glass_headlight77') o.material = M.lens;
    else if (n === 'front_white_light') o.material = M.head;
    else if (n === 'back_red_light') o.material = M.tail;
  });
  const car = new THREE.Group(), body = new THREE.Group(); car.add(body); body.name = 'body';
  const P = { wheels: {}, doors: {}, panes: {}, mirrors: {} };
  // wheels: hub (moves with nothing; body moves over it) + spin
  ['fl', 'fr', 'rl', 'rr'].forEach(k => { const x = k[1] === 'l' ? .88 : -.88, z = k[0] === 'f' ? WZ : -WZ;
    const hub = pivot('hub-' + k, x, .4, z), spin = new THREE.Group(); hub.add(spin); car.add(hub); P.wheels[k] = { hub, spin }; });
  // doors and mirrors
  ['dfl', 'dfr', 'drl', 'drr'].forEach(k => { const s = k[2] === 'l' ? 1 : -1, z = k[1] === 'f' ? 1.02 : -.17;
    const d = pivot(k, s * .99, .8, z); body.add(d); P.doors[k] = d;
    const pane = new THREE.Group(); pane.name = 'pane-' + k; d.add(pane); P.panes[k] = pane; });
  ['l', 'r'].forEach(s => { const m = pivot('mir-' + s, (s === 'l' ? 1 : -1) * .962, 1.16, .875); P.doors['df' + s].attach(m); P.mirrors[s] = m; });
  P.frunk = pivot('frunk', 0, 1.1, 1.28); body.add(P.frunk);
  P.boot = pivot('boot', 0, 1.31, -2.2); body.add(P.boot);
  const box = new THREE.Box3();
  list.forEach(({ o, mi }) => {
    box.setFromObject(o); const corner = cornerOf(box);
    if (corner) { const w = P.wheels[corner], brake = [3, 16, 17, 18].includes(mi); (brake ? w.hub : w.spin).attach(o); return; }
    if (MIRROR.has(mi)) { Object.entries(splitMesh(o, c => c.x > 0 ? 'l' : 'r')).forEach(([s, m]) => P.mirrors[s].attach(m)); o.removeFromParent(); return; }
    if (HOOD.has(mi)) { P.frunk.attach(o); return; }
    if (BOOT.has(mi)) { P.boot.attach(o); return; }
    if (DOOR_SRC.has(mi)) {
      const parts = splitMesh(o, doorKey);
      Object.entries(parts).forEach(([k, m]) => (mi === GLASS_SIDE ? P.panes[k] : P.doors[k]).attach(m));
      if (mi === 27 || mi === 39) { o.removeFromParent(); return; }
    }
    if (mi === ROOFG) P.roofGlass = o;
    body.attach(o);
  });
  // window glass stays clean below the belt line: clip each pane at the door's sill
  P.paneMat = M.glass.clone(); P.paneMat.side = THREE.DoubleSide; P.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.115); P.paneMat.clippingPlanes = [P.clip];
  Object.values(P.panes).forEach(p => p.traverse(o => { if (o.isMesh) o.material = P.paneMat; }));
  // dark cabin, so open windows and the glass roof show an interior, not the far side of the car
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, .7, 2.7), M.cabin); cab.position.set(0, .92, -.38); body.add(cab);
  // two sunshades under the roof glass (left / right), they roll back towards the rear
  P.shades = {};
  ['l', 'r'].forEach(s => { const g2 = new THREE.PlaneGeometry(.6, 1.72); g2.rotateX(-Math.PI / 2); g2.translate(0, 0, -.86);
    const sh = new THREE.Mesh(g2, M.fabric); sh.position.set((s === 'l' ? 1 : -1) * .31, 1.47, .22); body.add(sh); P.shades[s] = sh; });
  // dark matte liners in the wheel arches, so no light inner panels show around the tyres
  { const linM = new THREE.MeshStandardMaterial({ color: '#141218', roughness: .95, side: THREE.DoubleSide });
    Object.values(P.wheels).forEach(w => { const g = new THREE.CylinderGeometry(.47, .47, .3, 40, 1, true, Math.PI * .04, Math.PI * .92); g.rotateZ(Math.PI / 2);   // top half only: never shows under the tyre
      const m = new THREE.Mesh(g, linM); m.position.copy(w.hub.position); m.position.x *= .93; body.add(m); }); }
  // a soft, blurred hint of the cabin (seats, console) under the glass roof: seen when the sunshades open, no detail
  { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#4a4458'; x.fillRect(0, 0, 256, 512); x.filter = 'blur(10px)';
    const seat = (cx, cy, w, h) => { x.fillStyle = '#b9b2cc'; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, 18); x.fill(); x.fillStyle = '#d6d0e3'; x.beginPath(); x.roundRect(cx - w / 2 + 8, cy + h / 2 - 34, w - 16, 26, 10); x.fill(); };
    x.fillStyle = '#2c2836'; x.fillRect(0, 0, 256, 70);                       // dashboard
    seat(76, 168, 82, 118); seat(180, 168, 82, 118);                         // front seats
    x.fillStyle = '#6a6380'; x.beginPath(); x.roundRect(112, 120, 32, 160, 12); x.fill();   // console
    seat(76, 340, 86, 124); seat(180, 340, 86, 124);                         // rear seats
    x.fillStyle = '#3a3546'; x.fillRect(0, 440, 256, 72);                     // boot floor
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.7), new THREE.MeshBasicMaterial({ map: t })); pl.rotation.x = -Math.PI / 2; pl.rotation.z = Math.PI; pl.position.set(0, 1.275, -.38); body.add(pl); }
  // charge port flap on the left rear quarter (green glow when open)
  const flapG = new THREE.BoxGeometry(.012, .13, .16); flapG.translate(0, 0, -.08);
  P.port = pivot('port', .975, 1.0, -2.06); const flap = new THREE.Mesh(flapG, M.paint); P.port.add(flap); body.add(P.port);
  P.portGlow = new THREE.Mesh(new THREE.CircleGeometry(.16, 32), M.glow.clone()); P.portGlow.rotation.y = Math.PI / 2; P.portGlow.position.set(.99, 1.0, -2.14); body.add(P.portGlow);
  // a soft red pool under a tyre that is losing pressure (tyres are hidden when seen from straight above)
  P.wglow = {};
  { const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const x2 = c2.getContext('2d'), g3 = x2.createRadialGradient(64, 64, 2, 64, 64, 64);
    g3.addColorStop(0, 'rgba(255,60,80,1)'); g3.addColorStop(1, 'rgba(255,60,80,0)'); x2.fillStyle = g3; x2.fillRect(0, 0, 128, 128); const tex = new THREE.CanvasTexture(c2);
    Object.entries(P.wheels).forEach(([k, w]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(w.hub.position.x * 1.12, .004, w.hub.position.z); m.name = 'wglow'; car.add(m); P.wglow[k] = m; }); }
  // soft contact shadow
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const cx = sc.getContext('2d');
  const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(40,30,70,.5)'); gr.addColorStop(1, 'rgba(40,30,70,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 6.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = .002; sh.name = 'shadow'; car.add(sh);
  // lights you can see: halos at the lamps, a pool of light on the road ahead / behind, amber hazard flashers
  const soft = softTex(), poolT = softTex([[0, 1], [.5, .45], [1, 0]]);
  const halo = (c, x, y, z, sc, parent = body) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: c, transparent: true, opacity: 0, depthWrite: false })); sp.position.set(x, y, z); sp.scale.set(sc, sc, 1); sp.name = 'fx'; parent.add(sp); return sp; };
  const pool = (c, x, z, w, l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: poolT, color: c, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, .006, z); m.name = 'fx'; car.add(m); return m; };
  P.fx = { head: [halo('#fff5d6', .72, .8, 2.52, 1.2), halo('#fff5d6', -.72, .8, 2.52, 1.2)], tail: [halo('#ff2f48', .74, 1.05, -2.78, .95), halo('#ff2f48', -.74, 1.05, -2.78, .95)],
    haz: [halo('#ffa524', .88, .78, 2.44, .9), halo('#ffa524', -.88, .78, 2.44, .9), halo('#ffa524', .9, 1.04, -2.66, .9), halo('#ffa524', -.9, 1.04, -2.66, .9)],
    hazPool: [pool('#ffa524', .9, 2.5, 1.6, 1.6), pool('#ffa524', -.9, 2.5, 1.6, 1.6), pool('#ffa524', .9, -2.75, 1.6, 1.6), pool('#ffa524', -.9, -2.75, 1.6, 1.6)],
    headPool: pool('#fff0c4', 0, 4.9, 3.6, 4.8), tailPool: pool('#ff3048', 0, -3.35, 2.8, 1.5) };
  car.traverse(o => { if (o.isMesh && o.name !== 'shadow' && o.name !== 'wglow' && o.name !== 'fx' && !o.material.transparent) o.castShadow = true;
    if (o.isMesh && o.material === M.paint && !o.userData.creased) { o.geometry = smoothGeo(o.geometry); o.userData.creased = true; } });
  return { car, body, P };
}

/* ---------- scenes: a lavender Japanese garden (Home, lock screen) and five drive-mode worlds (Driving) ---------- */
const C = c => new THREE.Color(c);
// mix two colours the way the eye sees it (in sRGB, not linear light)
const mixS = (a, b, t) => { const x = {}, y = {}; a.getRGB(x, THREE.SRGBColorSpace); b.getRGB(y, THREE.SRGBColorSpace); return new THREE.Color().setRGB(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t, THREE.SRGBColorSpace); };
const lerpPal = (cur, tar, k) => { let moving = false; Object.keys(tar).forEach(n => { if (!(tar[n] instanceof THREE.Color)) return; const a = cur[n]; const d = Math.abs(a.r - tar[n].r) + Math.abs(a.g - tar[n].g) + Math.abs(a.b - tar[n].b); if (d > .002) { a.lerp(tar[n], k); moving = true; } else a.copy(tar[n]); }); return moving; };
const palOf = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' && v[0] === '#' ? C(v) : v]));
/* ---------- shared helpers for the scenes: noise, a dithered sky with a sun glow, soft sprites ---------- */
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = c => '#' + c.getHexString();
const rgba = (c, a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
let NOISE = null;
function noiseTile() { if (NOISE) return NOISE; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const n = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; d.data[i + 3] = 7; } x.putImageData(d, 0, 0); return (NOISE = c); }
function gradCanvas() { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t }; }
// vertical gradient, optional sun glow (sun: {x, y, r, c, a} in 0..1 of the view), then a faint grain so the gradient never bands
function paintGrad(G, top, mid, bot, sun) { const x = G.c.getContext('2d'), W = 1024, H = 512, g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, hex(top)); g.addColorStop(.58, hex(mid)); g.addColorStop(1, hex(bot)); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (sun && sun.a > .01) { const r = x.createRadialGradient(sun.x * W, sun.y * H, 0, sun.x * W, sun.y * H, sun.r * W);
    r.addColorStop(0, rgba(sun.c, sun.a)); r.addColorStop(.35, rgba(sun.c, sun.a * .45)); r.addColorStop(1, rgba(sun.c, 0)); x.fillStyle = r; x.fillRect(0, 0, W, H); }
  x.fillStyle = x.createPattern(noiseTile(), 'repeat'); x.fillRect(0, 0, W, H); G.t.needsUpdate = true; }
function softTex(stops = [[0, 1], [.45, .55], [1, 0]], size = 128) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`)); x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function puffTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 26; i++) { const px = 30 + Math.random() * 68, py = 34 + Math.random() * 60, r = 14 + Math.random() * 28, g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function sunLight(color, pos, span = 32) { const s = new THREE.DirectionalLight(color, 2); s.position.set(...pos); s.castShadow = true;
  s.shadow.mapSize.set(2048, 2048); Object.assign(s.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 140 }); s.shadow.bias = -.0004; s.shadow.normalBias = .03; s.shadow.radius = 4; return s; }
// a grass blade: thin triangle, dark at the root, light at the tip
function bladeGeo(w = .022, h = 1) { const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w * .35, h * .55, 0, -w * .35, h * .55, 0, 0, h, 0], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute([.62, .62, .62, .62, .62, .62, .86, .86, .86, .86, .86, .86, 1, 1, 1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]); g.computeVertexNormals(); return g; }

/* Home: a ring of tall white arches around a stepped stage, light falling through the openings, lavender grass, white dunes and sky beyond */
function archScene(scene) {
  const PAL = {
    day:   palOf({ top: '#7fa9e3', mid: '#bcd3f2', bot: '#f1ecf6', fog: '#e8ebf6', wall: '#e2dfee', floor: '#d9d5e7', sky: '#eef2ff', gnd: '#cdc6e0', sun: '#ffd6de', glow: '#ffb9cb', grass: '#9f7fdc', grass2: '#c9b2f2' }),
    night: palOf({ top: '#0b1030', mid: '#202652', bot: '#47396a', fog: '#24264a', wall: '#4b4867', floor: '#2b2a42', sky: '#4f5a92', gnd: '#15131f', sun: '#a9b3ff', glow: '#ff9cc4', grass: '#5d43a0', grass2: '#8a68d0' }),
  };
  const cur = Object.fromEntries(Object.entries(PAL.day).map(([k, v]) => [k, v.clone()]));
  let tar = PAL.day, L = 1, LT = 1;
  const G = gradCanvas(); scene.background = G.t; scene.fog = new THREE.Fog(cur.fog, 30, 110);
  const hemi = new THREE.HemisphereLight(cur.sky, cur.gnd, 1.05); scene.add(hemi);
  const sun = sunLight(cur.sun, [19, 15.5, -27], 34); scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#fff4f0', .35); fill.position.set(-10, 6, 12); scene.add(fill);
  // ground: flat inside the ring, soft white dunes outside it
  const tg = new THREE.PlaneGeometry(260, 260, 180, 180); tg.rotateX(-Math.PI / 2);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      p.setY(i, -.78 + smooth(25, 46, r) * (fbm(x * .03, z * .03) * 7 - 1.5) * (1 + smooth(60, 120, r) * 1.5)); } tg.computeVertexNormals(); }
  const floorM = new THREE.MeshStandardMaterial({ color: cur.floor, roughness: .82 }), floor = new THREE.Mesh(tg, floorM); floor.receiveShadow = true; scene.add(floor);
  // round stage and three steps, slightly glossy
  const stageM = new THREE.MeshPhysicalMaterial({ color: cur.wall, roughness: .38, clearcoat: .35, clearcoatRoughness: .4 });
  const st = (r, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .26, 128), stageM); m.position.y = y; m.receiveShadow = true; m.castShadow = true; scene.add(m); };
  st(5.6, -.13); st(6.15, -.39); st(6.7, -.65);
  // colonnade: twelve panels on a circle, each with one tall arch; deep reveals catch the light
  const R = 21, N = 12, pw = 2 * R * Math.tan(Math.PI / N) + .04, ph = 10.5, aw = 1.95, ah = 4.6;
  const shape = new THREE.Shape(); shape.moveTo(-pw / 2, 0); shape.lineTo(pw / 2, 0); shape.lineTo(pw / 2, ph); shape.lineTo(-pw / 2, ph); shape.lineTo(-pw / 2, 0);
  const hole = new THREE.Path(); hole.moveTo(-aw, .02); hole.lineTo(-aw, ah); hole.absarc(0, ah, aw, Math.PI, 0, true); hole.lineTo(aw, .02); hole.lineTo(-aw, .02); shape.holes.push(hole);
  const wg = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 4, curveSegments: 48 });
  const wallM = new THREE.MeshStandardMaterial({ color: cur.wall, roughness: .92 });
  // a soft pink glow hugging each arch, like light bouncing off the reveals
  const glowT = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'); const W = 256, H = 512, cx = 128, r = 92, ay = 210;
    x.filter = 'blur(14px)'; x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 18; x.beginPath(); x.moveTo(cx - r, H); x.lineTo(cx - r, ay); x.arc(cx, ay, r, Math.PI, 0); x.lineTo(cx + r, H); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glowM = new THREE.MeshBasicMaterial({ map: glowT, color: cur.glow, transparent: true, opacity: .55, depthWrite: false, fog: false });
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + .26, p = new THREE.Group(); p.position.set(Math.sin(a) * R, -.78, Math.cos(a) * R); p.rotation.y = a + Math.PI; scene.add(p);
    const w = new THREE.Mesh(wg, wallM); w.position.z = -.8; w.castShadow = true; w.receiveShadow = true; p.add(w);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(aw * 2 * 1.39, (ah + aw) * 1.39 * 1.0), glowM); gl.position.set(0, (ah + aw) * .69 * 1.0 - .2, .9); p.add(gl); }
  // lavender grass: thousands of thin blades in soft drifts, swaying
  const B = 7000, grassM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide, emissive: cur.grass, emissiveIntensity: .18 });
  const grass = new THREE.InstancedMesh(bladeGeo(), grassM, B), d = new THREE.Object3D(), col = new THREE.Color(), GB = [];
  const drifts = [[-1.0, 8.6, 2.6, .7], [-.15, 8.8, 2.0, .55], [2.15, 9.3, 2.8, .9], [3.55, 10.1, 2.6, .9], [4.6, 8.9, 1.6, .6]];
  while (GB.length < B) { const [a, r, hl, hw] = drifts[GB.length % drifts.length], u = Math.random() * 2 - 1, v = Math.random() * 2 - 1, q = u * u + v * v; if (q > 1) continue;
    const ang = a + u * hl / r, rr = r + v * hw; GB.push({ x: Math.sin(ang) * rr, z: Math.cos(ang) * rr, h: (.28 + Math.random() * .5) * (1 - q * .55), ry: Math.random() * 6.3, lean: (Math.random() - .5) * .35, ph: Math.random() * 6.3, c: Math.random() }); }
  GB.forEach((b, i) => { col.copy(cur.grass).lerp(cur.grass2, b.c); grass.setColorAt(i, col); }); grass.receiveShadow = true; scene.add(grass);
  const sway = t => { for (let i = 0; i < B; i++) { const b = GB[i]; d.position.set(b.x, -.78, b.z); d.rotation.set(b.lean + Math.sin(t * 1.3 + b.ph + b.x * .3) * .07, b.ry, 0); d.scale.set(1, b.h, 1); d.updateMatrix(); grass.setMatrixAt(i, d.matrix); } grass.instanceMatrix.needsUpdate = true; };
  sway(0); let lastSway = 0;
  return {
    shadows: true,
    theme(dark) { tar = dark ? PAL.night : PAL.day; LT = dark ? 0 : 1; },
    update(dt, now) {
      let moving = lerpPal(cur, tar, Math.min(1, dt * 2.5));
      if (Math.abs(LT - L) > .002) { L += (LT - L) * Math.min(1, dt * 2.5); moving = true; } else L = LT;
      if (moving || !G.done) { G.done = true; paintGrad(G, cur.top, cur.mid, cur.bot, { x: .72, y: .58, r: .55, c: cur.glow, a: .55 * L + .25 });
        scene.fog.color.copy(cur.fog); hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.gnd); sun.color.copy(cur.sun); sun.intensity = .45 + 2.05 * L;
        wallM.color.copy(cur.wall); floorM.color.copy(cur.floor); stageM.color.copy(cur.wall); glowM.color.copy(cur.glow); glowM.opacity = .35 + .4 * (1 - L);
        grassM.emissive.copy(cur.grass); scene.environmentIntensity = .2 + .3 * L; hemi.intensity = .3 + .32 * L; fill.intensity = .08 + .18 * L; }
      if (now - lastSway > 33) { sway(now / 1000); lastSway = now; } return true;
    },
  };
}

/* Lock screen: rolling meadow at golden hour, pale rocks, far peaks with snow, pink clouds, a low sun casting long shadows (day) or a violet dusk (night) */
/* Lock screen: Adi's meadow HDRI (Poly Haven, CC0), projected onto the ground so the car stands in the grass; it also lights the car */
function meadowScene(scene) {
  const A = ASSETS || {};
  if (!A.meadowBg) return null;
  const sky = new GroundedSkybox(A.meadowBg, 1.9, 90, 128); sky.position.y = 1.9 - .01; sky.material.toneMapped = false; scene.add(sky);
  scene.environment = A.meadow; scene.environmentIntensity = .9;
  // the sun in this HDRI sits high, a little to the side: match it so the car's shadow falls the right way
  const el = (.5 - .12) * Math.PI, lon = (.426 - .5) * Math.PI * 2, sun = sunLight('#fff3e2', [Math.cos(el) * Math.cos(lon) * 30, Math.sin(el) * 30, Math.cos(el) * Math.sin(lon) * 30], 10);
  sun.intensity = 1.6; scene.add(sun); scene.add(sun.target);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.ShadowMaterial({ opacity: .32 })); catcher.rotation.x = -Math.PI / 2; catcher.position.y = .002; catcher.receiveShadow = true; scene.add(catcher);
  const day = new THREE.Color('#ffffff'), night = new THREE.Color('#5e5490'); let L = 1, LT = 1;
  return {
    shadows: true,
    theme(dark) { LT = dark ? 0 : 1; },
    update(dt) { if (Math.abs(LT - L) < .002) { if (L !== LT) { L = LT; } else return false; } else L += (LT - L) * Math.min(1, dt * 2.5);
      sky.material.color.copy(night).lerp(day, L).multiplyScalar(.32 + .68 * L); scene.environmentIntensity = .3 + .6 * L; sun.intensity = .3 + 1.3 * L; catcher.material.opacity = .15 + .17 * L; return true; },
  };
}

/* HDRI assets, loaded once and shared: the studio light set for the car's reflections, the meadow for the lock screen */
let ASSETS = null, assetsP = null;
function loadAssets() {
  return assetsP || (assetsP = (async () => {
    const r = shared(), pm = new THREE.PMREMGenerator(r), hl = new RGBELoader();
    const [st, mh, mj] = await Promise.all([hl.loadAsync(BASE + 'env/studio.hdr'), hl.loadAsync(BASE + 'env/meadow.hdr'), new THREE.TextureLoader().loadAsync(BASE + 'env/meadow.jpg')]);
    st.mapping = mh.mapping = THREE.EquirectangularReflectionMapping; mj.mapping = THREE.EquirectangularReflectionMapping; mj.colorSpace = THREE.SRGBColorSpace; mj.anisotropy = 8;
    ASSETS = { studio: pm.fromEquirectangular(st).texture, meadow: pm.fromEquirectangular(mh).texture, meadowBg: mj };
    st.dispose(); mh.dispose(); pm.dispose(); ENV = ASSETS.studio; return ASSETS;
  })().catch(e => { console.warn('HDRI not loaded, using the built-in studio', e); ASSETS = {}; return ASSETS; }));
}
/* everything the dashboard needs before the lock screen lets you in */
export function ready() { return Promise.all([loadRaw(), loadAssets()]); }

const DRIVE = {   // sky top / middle / horizon, fog, ground, road, line colour, speed (m/s shown), scenery
  Comfort: { top: '#d9cfee', mid: '#f0dde9', bot: '#f5ecf2', fog: '#efe4f0', ground: '#ddd2e6', road: '#a9a1b8', line: '#ffffff', v: 11, kind: 'lamps' },
  Eco:     { top: '#cfe6dd', mid: '#e7f2ea', bot: '#f2f7f1', fog: '#e6f0e8', ground: '#c9dfc8', road: '#a7aea9', line: '#ffffff', v: 8, kind: 'trees' },
  Sport:   { top: '#120f1c', mid: '#2c1d38', bot: '#4a2240', fog: '#2a1a33', ground: '#1d1824', road: '#2a2532', line: '#ff4f8b', v: 22, kind: 'neon' },
  Snow:    { top: '#d7e1f0', mid: '#eaf0f8', bot: '#f6f8fc', fog: '#eef2f8', ground: '#f4f6fb', road: '#c3cad6', line: '#ffffff', v: 6, kind: 'pines' },
  Custom:  { top: '#e2dcf2', mid: '#efecf7', bot: '#f6f4fa', fog: '#efecf6', ground: '#e8e4f2', road: '#c9c2db', line: '#8d7fd6', v: 11, kind: 'grid' },
};
function driveScene(scene) {
  const P = Object.fromEntries(Object.entries(DRIVE).map(([k, o]) => [k, palOf(o)]));
  // night: every world sinks into a blue-plum dusk; Sport is already night
  const NIGHT = C('#12101f'), NP = Object.fromEntries(Object.entries(P).map(([k, o]) => [k, Object.fromEntries(Object.entries(o).map(([n, c]) =>
    [n, c instanceof THREE.Color && n !== 'line' && k !== 'Sport' ? mixS(c, NIGHT, n === 'road' ? .72 : n === 'ground' ? .82 : n === 'bot' ? .7 : .84) : c]))]));
  let dark = false, nf = 0;
  const cur = palOf(Object.fromEntries(Object.entries(P.Comfort).map(([k, v]) => [k, v instanceof THREE.Color ? v.clone() : v])));
  let mode = 'Comfort', v = P.Comfort.v, vT = v, off = 0;
  const G = gradCanvas(); scene.background = G.t; scene.fog = new THREE.Fog(cur.fog, 10, 52);
  const hemi = new THREE.HemisphereLight('#ffffff', '#b8b0c8', .9); scene.add(hemi);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: cur.ground, roughness: .95 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.01; scene.add(ground);
  // road: white dashes on a grey texture, tinted per mode, scrolled to make the car drive
  const rc = document.createElement('canvas'); rc.width = 64; rc.height = 256; const rx = rc.getContext('2d');
  rx.fillStyle = '#8a8a8a'; rx.fillRect(0, 0, 64, 256); for (let i = 0; i < 1400; i++) { rx.fillStyle = `rgba(255,255,255,${Math.random() * .08})`; rx.fillRect(Math.random() * 64, Math.random() * 256, 1, 1); }
  rx.fillStyle = '#ffffff'; rx.fillRect(30, 0, 4, 120); rx.fillRect(2, 0, 3, 256); rx.fillRect(59, 0, 3, 256);
  const rt = new THREE.CanvasTexture(rc); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(1, 16); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 8;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 160), new THREE.MeshStandardMaterial({ map: rt, color: cur.road, roughness: .7 })); road.rotation.x = -Math.PI / 2; road.position.set(-1.6, 0, 0); scene.add(road);
  const edgeM = new THREE.MeshBasicMaterial({ color: cur.line, transparent: true, opacity: 0 });
  [-5.4, 2.2].forEach(x => { const e = new THREE.Mesh(new THREE.PlaneGeometry(.08, 160), edgeM); e.rotation.x = -Math.PI / 2; e.position.set(x, .004, 0); scene.add(e); });
  // scenery sets, all on the far side of the road; they slide past and wrap around
  const sets = {}, L = 120;
  const add = (kind, make, n, xr) => { const g = new THREE.Group(); g.userData = { k: kind === 'lamps' ? 1 : 0, items: [] }; scene.add(g); sets[kind] = g;
    for (let i = 0; i < n; i++) { const o = make(i); o.position.x = xr[0] + Math.random() * (xr[1] - xr[0]); o.position.z = -L / 2 + i / n * L + Math.random() * 3; g.add(o); g.userData.items.push(o); } };
  const dimmed = []; let dimL = -1; const sceneryDim = l => { if (Math.abs(l - dimL) < .004) return; dimL = l; dimmed.forEach(([m, c]) => m.color.copy(c).multiplyScalar(l)); };
  const std = (c, e = 0) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: .8, emissive: c, emissiveIntensity: e }); if (!e) dimmed.push([m, m.color.clone()]); return m; };
  // street lamps: pole on the far verge, arm over the road; at night the bulbs glow and throw warm pools on the road
  const lampHaloM = new THREE.SpriteMaterial({ map: softTex(), color: '#ffd9a6', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const lampPoolM = new THREE.MeshBasicMaterial({ map: softTex([[0, 1], [.5, .5], [1, 0]]), color: '#ffcf8f', transparent: true, opacity: 0, depthWrite: false });
  const bulbM = std('#ffe9c9', 1.4), poleM = std('#8d84a3');
  add('lamps', () => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 3.4, 8), poleM); p.position.y = 1.7; g.add(p);
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.5, .07, .07), poleM); a.position.set(.72, 3.35, 0); g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .2), bulbM); b.position.set(1.42, 3.28, 0); g.add(b);
    const h = new THREE.Sprite(lampHaloM); h.position.set(1.42, 3.2, 0); h.scale.set(2.4, 2.4, 1); g.add(h);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), lampPoolM); pl.rotation.x = -Math.PI / 2; pl.position.set(2.6, .012, 0); g.add(pl); return g; }, 10, [-7.3, -7.2]);
  add('trees', i => { const g = new THREE.Group(), s = .8 + Math.random() * .7; g.scale.setScalar(s);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, 1.6, 6), std('#7b6a5c')); t.position.y = .8; g.add(t);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), std(i % 3 ? '#8fc49a' : '#a7d4a2')); c.position.y = 2.2; g.add(c); return g; }, 26, [-18, -7.5]);
  add('neon', i => { const g = new THREE.Group(); const h = 2.5 + Math.random() * 5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(.12, h, .12), std(i % 2 ? '#ff3d7f' : '#9b5cff', 2.2)); b.position.y = h / 2; g.add(b); return g; }, 34, [-16, -7]);
  const ornM = ['#e0344b', '#ffc94d', '#6fa8ff', '#ffffff'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .9, roughness: .3 }));
  const starM = new THREE.MeshStandardMaterial({ color: '#ffd76a', emissive: '#ffd76a', emissiveIntensity: 1.6 }), deerM = std('#8a6a55'), antM = std('#d9cbb8');
  const deer = () => { const g = new THREE.Group(), b = (w, h, d, x, y, z, m = deerM) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); g.add(k); return k; };
    b(.28, .32, .95, 0, .78, 0); b(.14, .4, .14, 0, 1.08, .42).rotation.x = -.5; b(.16, .16, .3, 0, 1.3, .58);
    [[.09, .32], [-.09, .32], [.09, -.32], [-.09, -.32]].forEach(([x, z]) => b(.07, .62, .07, x, .31, z));
    [1, -1].forEach(sd => { b(.03, .3, .03, sd * .07, 1.5, .5, antM).rotation.z = -sd * .5; b(.03, .16, .03, sd * .14, 1.56, .54, antM).rotation.x = .6; }); g.rotation.y = Math.PI; return g; };
  add('pines', i => { if (i % 9 === 4) { const d = deer(); d.scale.setScalar(.9 + Math.random() * .25); return d; }
    const g = new THREE.Group(), s = .9 + Math.random() * .9; g.scale.setScalar(s);
    if (i % 4 === 1) { for (let k = 0; k < 9; k++) { const a = k * 2.3, y = .7 + (k % 3) * .62, r = (1.05 - (k % 3) * .3) * .82;
        const o = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), ornM[k % 4]); o.position.set(Math.cos(a) * r, y + .25, Math.sin(a) * r); g.add(o); }
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(.16), starM); st.position.y = 3.05; g.add(st); }
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .8, 6), std('#6b5d58')); t.position.y = .4; g.add(t);
    [0, 1, 2].forEach(k => { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - k * .3, 1.3, 7), std(k === 2 ? '#ffffff' : '#7f9c95')); c.position.y = 1.1 + k * .75; g.add(c); }); return g; }, 30, [-20, -7.5]);
  add('grid', () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.9, .9, .9), new THREE.MeshStandardMaterial({ color: '#cfc6ec', roughness: .3, metalness: .2 })); b.position.y = .45 + Math.random() * 2; b.rotation.set(Math.random(), Math.random(), 0); g.add(b); return g; }, 10, [-16, -8]);
  const sleigh = new THREE.Group(); sleigh.position.set(-24, 5.2, -40); scene.add(sleigh);
  { const red = new THREE.MeshStandardMaterial({ color: '#c8263c', roughness: .5 }), gold = new THREE.MeshStandardMaterial({ color: '#e8b64a', metalness: .6, roughness: .3 });
    const sb = new THREE.Mesh(new THREE.BoxGeometry(.7, .45, 1.2), red); sleigh.add(sb); const rn = new THREE.Mesh(new THREE.BoxGeometry(.75, .05, 1.5), gold); rn.position.y = -.3; sleigh.add(rn);
    const sa = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), red); sa.position.set(0, .45, -.1); sleigh.add(sa); const hd = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), new THREE.MeshStandardMaterial({ color: '#f3dccb' })); hd.position.set(0, .8, -.05); sleigh.add(hd);
    for (let k = 0; k < 4; k++) { const d = deer(); d.scale.setScalar(.55); d.rotation.y = 0; d.position.set((k % 2 ? .22 : -.22), -.35, 1.3 + Math.floor(k / 2) * 1.0); sleigh.add(d); } }
  sleigh.rotation.y = 0;
  const grid = new THREE.GridHelper(160, 160, '#b9addf', '#d6cfec'); grid.material.transparent = true; grid.material.opacity = 0; grid.position.y = .002; scene.add(grid);
  // falling snow
  const SN = 700, sg = new THREE.BufferGeometry(), sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = -18 + Math.random() * 24; sp[i * 3 + 1] = Math.random() * 7; sp[i * 3 + 2] = (Math.random() - .5) * 30; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: .07, transparent: true, opacity: 0, depthWrite: false })); scene.add(snow);
  return {
    mode(m) { if (!P[m]) return; mode = m; vT = P[m].v; },
    night: () => nf,
    theme(d) { dark = d; },
    speed: () => v,
    update(dt) {
      const tar = (dark ? NP : P)[mode], k = Math.min(1, dt * 2.2);
      if (lerpPal(cur, tar, k) || !G.done) { G.done = true; paintGrad(G, cur.top, cur.mid, cur.bot); }
      const lum = dark && mode !== 'Sport' ? .45 : 1; hemi.intensity += (.9 * lum - hemi.intensity) * k; scene.environmentIntensity = (scene.environmentIntensity ?? 1) + (.9 * lum - (scene.environmentIntensity ?? 1)) * k; scene.fog.color.copy(cur.fog); ground.material.color.copy(cur.ground); road.material.color.copy(cur.road); edgeM.color.copy(cur.line);
      v += (vT - v) * k; off += v * dt;
      rt.offset.y = -(off / 160 * 16) % 1;
      edgeM.opacity += ((mode === 'Sport' ? .9 : 0) - edgeM.opacity) * k;
      grid.material.opacity += ((mode === 'Custom' ? .7 : 0) - grid.material.opacity) * k; grid.position.z = -(off % 1);
      snow.material.opacity += ((mode === 'Snow' ? .9 : 0) - snow.material.opacity) * k;
      { const tt = (performance.now() / 1000) % 26; sleigh.visible = mode === 'Snow' && tt < 11; sleigh.position.z = -34 + tt * 6.5; sleigh.position.y = 5.2 + Math.sin(tt * 2.2) * .18; }
      if (snow.material.opacity > .01) { for (let i = 0; i < SN; i++) { sp[i * 3 + 1] -= dt * 1.1; sp[i * 3 + 2] -= dt * v * .85; if (sp[i * 3 + 1] < 0) sp[i * 3 + 1] += 7; if (sp[i * 3 + 2] < -15) sp[i * 3 + 2] += 30; } sg.attributes.position.needsUpdate = true; }
      nf += ((dark ? 1 : 0) - nf) * k; sceneryDim(1 - nf * .72); lampHaloM.opacity = nf; lampPoolM.opacity = nf * .6; bulbM.emissiveIntensity = 1.4 + nf * 2.5;
      Object.entries(sets).forEach(([kind, g]) => { const on = tar.kind === kind || (kind === 'lamps' && dark && mode !== 'Sport') ? 1 : 0; g.userData.k += (on - g.userData.k) * k; const s = g.userData.k;
        g.visible = s > .01; g.scale.set(1, Math.max(.001, s), 1);
        if (g.visible) g.userData.items.forEach(o => { o.position.z -= v * dt; if (o.position.z < -L / 2) o.position.z += L; }); });
      return true;
    },
  };
}

/* ---------- viewers ---------- */
const VIEWS = {   // camera position, target, field of view
  qc:   { p: [0, 16.2, -.001], t: [0, 0, .25], fov: 26, up: [0, 0, 1] },   // straight down, nose up (locked)
  qcwinL: { p: [6.9, 4.4, -9.4], t: [0, .55, .15], fov: 40, up: [0, 1, 0] },   // left windows: seen from the left rear
  qcwinR: { p: [-6.9, 4.4, -9.4], t: [0, .55, .15], fov: 40, up: [0, 1, 0] },  // right windows: seen from the right rear  // while the Windows menu is open: three-quarter rear view, so the glass is seen going down
  ty:   { p: [0, 15.5, -.001], t: [0, 0, -.05], fov: 26, up: [0, 0, 1] },   // straight down, nose up
  side: { p: [7.4, 1.05, .1], t: [-.4, .72, .1], fov: 27, ls: 2.4 },        // driver's side, whole car (ride height shown 2.4× so it reads)
  home: { p: [-4.9, 1.85, 8.6], t: [0, .72, 0], fov: 32, shift: [.17, .07] },   // front three-quarter; orbits the car itself, drawn right of centre (clear of the Next card)
  lock: { p: [7.3, 2.2, 7.7], t: [0, 1.45, .2], fov: 28 },                   // car in the lower half, under the clock
};
const viewers = new Set();
let loopOn = false;
function loop() {
  loopOn = true; let busy = false; const now = performance.now();
  viewers.forEach(v => { if (v.tick(now)) busy = true; });
  if (busy) requestAnimationFrame(loop); else loopOn = false;
}
const kick = () => { if (!loopOn) requestAnimationFrame(loop); };

/* One WebGL renderer for every view. Phones and tablets allow only a few WebGL contexts per page; past that the oldest
   are dropped. So each view keeps a plain 2D canvas and the shared renderer draws into it, one view at a time. */
const PR = Math.min(2, window.devicePixelRatio || 1);
let R = null, RW = 0, RH = 0, ENV = null;
function shared() {
  if (R) return R;
  R = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true });
  R.setPixelRatio(PR); R.localClippingEnabled = true; R.autoClear = false;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  ENV = studioEnv(R);
  return R;
}
/* a photo-studio light set baked into the reflection map: soft gradient dome, long overhead soft boxes and side strips.
   These are what draw the clean highlight lines along the paint and glass. */
function studioEnv(r) {
  const s = new THREE.Scene(), dome = new THREE.SphereGeometry(60, 48, 24), col = [], p = dome.attributes.position, c = new THREE.Color();
  const top = new THREE.Color('#f6f4fb'), hor = new THREE.Color('#b8b2c9'), bot = new THREE.Color('#2e2a39');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 60; if (y > 0) c.copy(hor).lerp(top, Math.pow(y, .6)); else c.copy(hor).lerp(bot, Math.pow(-y, .45)); col.push(c.r, c.g, c.b); }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, x, y, z, rx, ry, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 1.02), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  box(8, 36, 0, 22, 0, Math.PI / 2, 0, 5.5);                // long overhead soft box
  box(3, 30, -9, 18, 0, Math.PI / 2, 0, 3); box(3, 30, 9, 18, 0, Math.PI / 2, 0, 3);
  box(30, 2.2, 0, 7, -26, 0, 0, 3.2); box(30, 2.2, 0, 7, 26, 0, Math.PI, 3.2);    // horizon strips front and back
  box(2.2, 24, -28, 6, 0, 0, Math.PI / 2, 2.6); box(2.2, 24, 28, 6, 0, 0, -Math.PI / 2, 2.6);   // side strips
  const t = new THREE.PMREMGenerator(r).fromScene(s, .015).texture; return t;
}
function _unused() {
  return R;
}
function drawTo(ctx, scene, cam, w, h, clear = true) {
  const r = shared(), pw = Math.round(w * PR), ph = Math.round(h * PR);
  if (pw > RW || ph > RH) { RW = Math.max(RW, pw); RH = Math.max(RH, ph); r.setSize(RW / PR, RH / PR, false); }
  r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.setScissorTest(true); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
  if (ctx.canvas.width !== pw || ctx.canvas.height !== ph) { ctx.canvas.width = pw; ctx.canvas.height = ph; }
  if (clear) ctx.clearRect(0, 0, pw, ph); ctx.drawImage(r.domElement, 0, RH - ph, pw, ph, 0, 0, pw, ph);
}

let queue = Promise.resolve();
const turn = () => (queue = queue.then(() => new Promise(r => setTimeout(r, 16))));
export async function mount(el, opt = {}) {
  const cv = document.createElement('canvas'); cv.className = 'c3d'; el.appendChild(cv); const ctx = cv.getContext('2d');
  shared();
  const scene = new THREE.Scene();
  scene.environment = ENV;
  const key = new THREE.DirectionalLight('#ffffff', .9); key.position.set(3, 8, 4); scene.add(key);
  const V = VIEWS[opt.view || 'qc'], cam = new THREE.PerspectiveCamera(V.fov, 1, .1, 200); if (V.up) cam.up.set(...V.up);
  const LS = V.ls || 1.6;
  const tgt = new THREE.Vector3(...V.t), home = new THREE.Vector3(...V.p).sub(tgt);
  const sph = new THREE.Spherical().setFromVector3(home), sph0 = sph.clone();
  await loadAssets(); scene.environment = ENV;
  await turn();   // views are built one at a time, letting the page draw in between
  const { car, body, P } = await buildCar(); scene.add(car);
  await turn();
  const world = opt.scene === 'arches' ? archScene(scene) : opt.scene === 'meadow' ? (meadowScene(scene) || archScene(scene)) : opt.scene === 'drive' ? driveScene(scene) : null;
  if (world) { scene.environmentIntensity = .9; }
  // state, animated values
  const S = { door: { dfl: 0, dfr: 0, drl: 0, drr: 0 }, frunk: 0, boot: 0, port: 0, win: { fl: 0, fr: 0, rl: 0, rr: 0 }, mir: 0, shade: { l: 0, r: 0 }, lift: 0, head: .55, tail: .5, beam: 0, haz: 0, warn: {} };
  const LIN = { door: 1.3, frunk: 1.5, boot: 1.7, port: .8, mir: 1 };   // seconds for a full open or close, the same both ways
  const IO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const T = JSON.parse(JSON.stringify(S));
  const doorPaint = {}, dbl = new Map();
  Object.keys(P.doors).forEach(k => { doorPaint[k] = M.paint.clone(); doorPaint[k].side = THREE.DoubleSide;
    P.doors[k].traverse(o => { if (!o.isMesh) return; if (o.material === M.paint) o.material = doorPaint[k];
      else if (o.material.side !== THREE.DoubleSide) { if (!dbl.has(o.material)) { const m = o.material.clone(); m.side = THREE.DoubleSide; dbl.set(o.material, m); } o.material = dbl.get(o.material); } }); });
  [P.frunk, P.boot].forEach(g => g.traverse(o => { if (o.isMesh && o.material === M.paint) o.material = M.paintD; }));
  const tyreMats = {}; Object.entries(P.wheels).forEach(([k, w]) => w.spin.traverse(o => { if (o.isMesh && /tire/i.test(o.material.name || '')) { const m = tyreMats[k] || (tyreMats[k] = o.material.clone()); o.material = m; } }));
  let va = null, vname = opt.view || 'qc';
  let spin = !!opt.spin, wheelA = 0, last = performance.now(), dirty = true, W = 0, H = 0, t0 = performance.now();
  const step = (cur, tar, dt, rate) => { const d = tar - cur; return Math.abs(d) < .0005 ? tar : cur + d * Math.min(1, dt * rate); };
  function apply(now) {
    const D = { dfl: -1, drl: -1, dfr: 1, drr: 1 };
    Object.keys(P.doors).forEach(k => { P.doors[k].rotation.y = D[k] * IO(S.door[k]) * 1.0;
      doorPaint[k].copy(M.paint); doorPaint[k].side = THREE.DoubleSide; doorPaint[k].emissive.set('#d23a48'); doorPaint[k].emissiveIntensity = S.door[k] * .13; });
    const PW = { dfl: 'fl', dfr: 'fr', drl: 'rl', drr: 'rr' };
    Object.entries(P.panes).forEach(([k, p]) => { p.position.y = -S.win[PW[k]] * .4; });
    P.frunk.rotation.x = -IO(S.frunk) * .9;
    P.boot.rotation.x = IO(S.boot) * 1.1;
    P.port.rotation.y = IO(S.port) * 1.6; P.port.visible = S.port > .01; P.portGlow.material.opacity = S.port * .55;
    P.mirrors.l.rotation.y = IO(S.mir) * 1.02; P.mirrors.r.rotation.y = -IO(S.mir) * 1.02;
    ['l', 'r'].forEach(s => { P.shades[s].scale.z = 1 - S.shade[s] * .9; });
    // ride height (shown larger than life so it reads); when driving the body also floats a little on the air springs
    let bob = 0, pitch = 0;
    if (opt.scene === 'drive') { const t = (now - t0) / 1000, sp = world.speed() / 22; bob = (Math.sin(t * 1.9) * .004 + Math.sin(t * 5.3) * .0015 * sp); pitch = Math.sin(t * 1.3 + 1) * .0025 + Math.sin(t * 4.1) * .001 * sp; }
    body.position.y = S.lift / 1000 * LS + bob; body.rotation.x = pitch;
    P.clip.constant = -(1.115 + body.position.y);
    M.head.emissiveIntensity = S.head * 2.2 + S.beam * 1.6; M.tail.emissiveIntensity = S.tail * 2 + S.beam;
    { const hh = smooth(.1, 1, S.head) * .55 + S.beam * .45, blink = S.haz * Math.pow(Math.max(0, Math.sin(now / 1000 * Math.PI * 1.5)), .35);
      P.fx.head.forEach(h => h.material.opacity = hh); P.fx.tail.forEach(h => h.material.opacity = smooth(.1, 1, S.tail) * .5 + S.beam * .4);
      P.fx.headPool.material.opacity = S.beam * .6; P.fx.tailPool.material.opacity = S.beam * .3;
      if (beams) { const nt = world.night ? world.night() : 0; beams.mat.opacity = S.beam * nt * .6; P.fx.head.forEach(h => { h.material.opacity = hh * .45; h.scale.setScalar(.6); }); P.fx.headPool.material.opacity = S.beam * .35; }
      P.fx.haz.forEach(h => h.material.opacity = blink); P.fx.hazPool.forEach(h => h.material.opacity = blink * .45); }
    Object.entries(P.wglow).forEach(([k, m]) => { m.material.opacity = (S.warn[k] || 0) * (.6 + .3 * Math.sin(now / 260)); });
    Object.entries(tyreMats).forEach(([k, m]) => { m.emissive.set('#e0303f'); m.emissiveIntensity = (S.warn[k] || 0) * (.35 + .25 * Math.sin(now / 260)); });
  }
  function fxTint(dark) { P.fx.head.forEach(h => { h.material.color.set(dark ? '#fff7e2' : '#ffc94d'); h.scale.setScalar(dark ? 1.2 : 1.55); });
    P.fx.headPool.material.color.set(dark ? '#fff0c4' : '#ffd36a'); P.fx.tail.forEach(h => h.material.color.set(dark ? '#ff2f48' : '#ff1f3d')); }
  fxTint(false);
  // night driving: straight, soft beams reaching forward along the road (not a round glow)
  let beams = null;
  if (opt.scene === 'drive') { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    // a cone of light: narrow at the lamp, widening ahead, soft all round
    const gh = x.createLinearGradient(0, 0, 512, 0); gh.addColorStop(0, 'rgba(255,247,226,.55)'); gh.addColorStop(.08, 'rgba(255,246,222,.75)'); gh.addColorStop(.45, 'rgba(255,242,212,.32)'); gh.addColorStop(1, 'rgba(255,238,200,0)');
    x.filter = 'blur(14px)'; x.fillStyle = gh; x.beginPath(); x.moveTo(6, 58); x.lineTo(506, 12); x.lineTo(506, 116); x.lineTo(6, 70); x.closePath(); x.fill(); x.filter = 'none';
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const bm = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    beams = [.75, -.75].map(xx => { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), bm); m.rotation.set(0, -Math.PI / 2, -.05); m.position.set(xx, .5, 2.5 + 5); m.name = 'fx'; body.add(m); return m; });
    beams.mat = bm; }
  const proj = new THREE.Vector3();
  const v = {
    el, canvas: cv, P,
    tick(now) {
      const w = el.clientWidth, h = el.clientHeight; if (!w || !h || !cv.isConnected) return false;
      if (w !== W || h !== H) { W = w; H = h; cam.aspect = w / h; if (V.shift) cam.setViewOffset(w, h, -V.shift[0] * w, V.shift[1] * h, w, h); cam.updateProjectionMatrix(); dirty = true; if (opt.onResize) setTimeout(() => opt.onResize(v), 0); }
      const dt = Math.min(.05, (now - last) / 1000); last = now; let moving = false;
      const walk = (a, b, rate) => { Object.keys(b).forEach(k => { if (typeof b[k] === 'object') { moving = walk(a[k], b[k], rate) || moving; } else { const n = step(a[k], b[k], dt, rate); if (n !== a[k]) { a[k] = n; moving = true; } } }); return moving; };
      const lin = (a, b, dur) => { const d = b - a; if (!d) return a; const st = dt / dur; return Math.abs(d) <= st ? b : a + Math.sign(d) * st; };
      Object.keys(T).forEach(k => { if (k in LIN) { if (typeof T[k] === 'object') Object.keys(T[k]).forEach(j => { const n = lin(S[k][j], T[k][j], LIN[k]); if (n !== S[k][j]) { S[k][j] = n; moving = true; } });
          else { const n = lin(S[k], T[k], LIN[k]); if (n !== S[k]) { S[k] = n; moving = true; } } }
        else if (typeof T[k] === 'object') walk(S[k], T[k], 4.2); else { const n = step(S[k], T[k], dt, 4.2); if (n !== S[k]) { S[k] = n; moving = true; } } });
      if (S.haz > 0) moving = true;
      if (Object.values(S.warn).some(x => x > 0)) moving = true;
      if (world && world.update(dt, now)) moving = true;
      if (opt.scene === 'drive') { wheelA += dt * world.speed() / .4; Object.values(P.wheels).forEach(wh => wh.spin.rotation.x = wheelA); }
      else if (spin) { wheelA += dt * 6; Object.values(P.wheels).forEach(wh => wh.spin.rotation.x = wheelA); moving = true; }
      if (opt.drift) { sph.theta = sph0.theta + Math.sin((now - t0) / 7000) * .22; moving = true; }
      if (drag || inertia) { if (!drag) { sph.theta += vel * dt; vel *= Math.pow(.04, dt); if (Math.abs(vel) < .02) inertia = false; } moving = true; }
      else if (back) { const k = Math.min(1, dt * 3); sph.theta += (sph0.theta - sph.theta) * k; sph.phi += (sph0.phi - sph.phi) * k;
        if (Math.abs(sph.theta - sph0.theta) + Math.abs(sph.phi - sph0.phi) < 1e-4) { sph.theta = sph0.theta; sph.phi = sph0.phi; back = false; } moving = true; }
      if (va) { const k = Math.min(1, (now - va.t0) / 900), e = IO(k); tgt.lerpVectors(va.t1, va.t2, e); cam.up.lerpVectors(va.u1, va.u2, e).normalize();
        cam.fov = va.f1 + (va.f2 - va.f1) * e; cam.updateProjectionMatrix(); const pp = new THREE.Vector3().lerpVectors(va.p1, va.p2, e).sub(tgt); sph.setFromVector3(pp); sph0.copy(sph);
        if (k >= 1) { va = null; if (opt.onResize) setTimeout(() => opt.onResize(v), 0); } moving = true; }
      if (moving || dirty) { apply(now); cam.position.setFromSpherical(sph).add(tgt); cam.lookAt(tgt); drawTo(ctx, scene, cam, w, h); dirty = false; }
      return moving;
    },
    set(st) {
      if (st.open) ['dfl', 'dfr', 'drl', 'drr', 'frunk', 'boot'].forEach(k => { const o = st.open[k] ? 1 : 0; if (k.startsWith('d')) T.door[k] = o; else T[k] = o; });
      if ('port' in st) T.port = st.port ? 1 : 0;
      if (st.wins) Object.assign(T.win, st.wins);
      if ('mir' in st) T.mir = st.mir === 'fold' ? 1 : 0;
      if (st.shade) { T.shade.l = st.shade.l ? 1 : 0; T.shade.r = st.shade.r ? 1 : 0; }
      if ('lights' in st) { T.head = st.lights === 'on' ? 1 : st.lights === 'off' ? .08 : .55; T.tail = st.lights === 'off' ? .15 : st.lights === 'on' ? 1 : .5; T.beam = st.lights === 'on' ? 1 : 0; }
      if ('hazard' in st) T.haz = st.hazard ? 1 : 0;
      if ('lift' in st) T.lift = st.lift;
      if ('spin' in st) spin = !!st.spin;
      if ('warn' in st) { ['fl', 'fr', 'rl', 'rr'].forEach(k => T.warn[k] = st.warn === k ? 1 : 0); }
      if ('mode' in st && world && world.mode) world.mode(st.mode);
      if ('dark' in st && world && world.theme) world.theme(st.dark);
      if ('dark' in st) fxTint(st.dark);
      if ('view' in st && st.view !== vname && VIEWS[st.view]) { const N = VIEWS[st.view]; vname = st.view;
        va = { t0: performance.now(), p1: cam.position.clone(), p2: new THREE.Vector3(...N.p), t1: tgt.clone(), t2: new THREE.Vector3(...N.t), u1: cam.up.clone(), u2: new THREE.Vector3(...(N.up || [0, 1, 0])), f1: cam.fov, f2: N.fov }; }
      dirty = true; kick();
    },
    snap() { Object.assign(S, JSON.parse(JSON.stringify(T))); dirty = true; kick(); },
    render() { dirty = true; kick(); },
    reset() { back = true; inertia = false; kick(); },
    // where things are on screen (px inside the host): wheel centres and the car's outer edges
    layout() {
      cam.position.setFromSpherical(sph).add(tgt); cam.lookAt(tgt); cam.updateMatrixWorld(); const out = {};
      const to2d = p => { proj.copy(p).project(cam); return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H }; };
      Object.entries(P.wheels).forEach(([k, w]) => { out[k] = to2d(w.hub.getWorldPosition(new THREE.Vector3())); });
      out.left = to2d(new THREE.Vector3(1.02, 0, 0)).x; out.right = to2d(new THREE.Vector3(-1.02, 0, 0)).x;
      out.doors = { dfl: to2d(new THREE.Vector3(1.02, .9, 1.16)), dfr: to2d(new THREE.Vector3(-1.02, .9, 1.16)), drl: to2d(new THREE.Vector3(1.02, .9, -.06)), drr: to2d(new THREE.Vector3(-1.02, .9, -.06)) };   // just ahead of each hinge, clear of the opened door
      return out;
    },
  };
  // drag: 'spring' turns a little and springs back; 'free' spins all the way round and stays (double-tap resets)
  let drag = false, back = false, inertia = false, vel = 0, sx = 0, sy = 0, moved = 0, lt = 0;
  if (opt.orbit) {
    const free = opt.orbit === 'free';
    cv.addEventListener('pointerdown', e => { drag = true; back = false; inertia = false; vel = 0; sx = e.clientX; sy = e.clientY; moved = 0; lt = performance.now(); cv.setPointerCapture(e.pointerId); kick(); });
    cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - sx, dy = e.clientY - sy, n = performance.now(); sx = e.clientX; sy = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      sph.theta -= dx * .008; vel = -dx * .008 / Math.max(.008, (n - lt) / 1000); lt = n;
      sph.phi = free ? Math.min(1.5, Math.max(1.05, sph.phi - dy * .004)) : Math.min(1.45, Math.max(.15, sph.phi - dy * .006)); kick(); });
    const end = e => { if (!drag) return; drag = false;
      if (moved < 8) { vel = 0; if (opt.onPick) pick(e); } else if (free && performance.now() - lt < 80) { inertia = true; vel = Math.max(-6, Math.min(6, vel)); }
      if (!free) setTimeout(() => { back = true; kick(); }, 2200); kick(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', () => { drag = false; if (!free) back = true; kick(); });
    if (free) cv.addEventListener('dblclick', () => { inertia = false; sph.theta = sph0.theta + Math.round((sph.theta - sph0.theta) / (Math.PI * 2)) * Math.PI * 2; back = true; kick(); });
  } else if (opt.onPick) cv.addEventListener('click', pick);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const b = cv.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
    ray.setFromCamera(ndc, cam); const hit = ray.intersectObject(car, true).find(h => h.object.visible); if (!hit) return;
    let o = hit.object; while (o && o !== car) { const n = o.name || ''; if (/^d[fr][lr]$|^frunk$|^boot$|^port$/.test(n)) return opt.onPick(n); if (/^mir-/.test(n)) return opt.onPick('mir'); if (/^hub-/.test(n)) return opt.onPick('wheel-' + n.slice(4)); o = o.parent; }
    // otherwise go by where on the car the tap landed (from above you mostly see roof and glass)
    const p = car.worldToLocal(hit.point.clone()); p.y -= body.position.y;
    if (p.x > .8 && p.z < -1.85 && p.z > -2.35 && p.y > .8 && p.y < 1.2) return opt.onPick('port');
    if (opt.view === 'ty') { const k = (p.z > 0 ? 'f' : 'r') + (p.x > 0 ? 'l' : 'r'); return opt.onPick('wheel-' + k); }
    if (p.z > 1.3) return opt.onPick('frunk');
    if (p.z < -1.8) return opt.onPick('boot');
    const s = p.x > 0 ? 'l' : 'r';
    if (p.z > -.165 && p.z < 1.3) return opt.onPick('df' + s);
    return opt.onPick('dr' + s);
  }
  viewers.add(v); v.render();
  await turn();
  try { apply(performance.now()); cam.position.setFromSpherical(sph).add(tgt); cam.lookAt(tgt); cam.aspect = 1.6; cam.updateProjectionMatrix(); R.compile(scene, cam); } catch (e) {}   // build the shaders now, not on first view
  return v;
}

/* a still top-down picture of the car (map marker); px = pixels per metre. mask: white silhouette only (for the 2D drawings) */
export async function snapshot(px = 40, o = {}) {
  const { car, P } = await buildCar(); car.traverse(c => { if (c.name === 'shadow' || c.name === 'wglow') c.visible = false; });
  if (o.mask) { const white = new THREE.MeshBasicMaterial({ color: '#ffffff' }); car.traverse(c => { if (c.isMesh) c.material = white; });
    P.port.visible = false; P.portGlow.visible = false; Object.values(P.shades).forEach(s => s.visible = false); if (o.mirrors === false) Object.values(P.mirrors).forEach(m => m.visible = false); }
  const w = 2.3 * px / PR, h = 5.5 * px / PR, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const scene = new THREE.Scene(); shared(); scene.environment = ENV; scene.add(car);
  const l = new THREE.DirectionalLight('#ffffff', 1); l.position.set(2, 8, 3); scene.add(l);
  const cam = new THREE.OrthographicCamera(-1.15, 1.15, 2.75, -2.75, .1, 30); cam.up.set(0, 0, 1); cam.position.set(0, 12, -.1); cam.lookAt(0, 0, -.1);
  const tm = R.toneMapping; if (o.mask) R.toneMapping = THREE.NoToneMapping;
  drawTo(ctx, scene, cam, w, h); R.toneMapping = tm;
  return cv.toDataURL('image/png');
}

const paintHooks = new Set();
export function onPaint(f) { paintHooks.add(f); }
export function setPaint(k) {
  if (!PAINTS[k]) return; paintKey = k; try { localStorage.setItem('nio-paint', k); } catch (e) {}
  applyPaint(); viewers.forEach(v => v.render()); paintHooks.forEach(f => f(k));
}
export const paint = () => paintKey;
export const preload = () => loadRaw();

window.ET9 = { mount, setPaint, paint, PAINTS, preload, snapshot, onPaint, ready };
window.dispatchEvent(new Event('et9-ready'));
