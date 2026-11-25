/* ET9 3D car for Mark 2 — one model, many views.
   Built on three.js r170 (MIT). The model file is Adi's own purchased ET9 exterior.
   Usage: const v = await ET9.mount(el, { view: 'qc' | 'ty' | 'side' | 'hero', orbit: true, onPick })
          v.set({ open: {dfl, dfr, drl, drr, frunk, boot}, port, wins: {fl, fr, rl, rr}, mir: 'fold'|'out',
                  shade: {l, r}, lights: 'on'|'auto'|'off', lift: mm, spin: true, warn: 'fl'|null }) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  paint: new THREE.MeshPhysicalMaterial({ clearcoat: 1, clearcoatRoughness: .06 }),
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
  const src = g.scene.clone(true); src.updateMatrixWorld(true);
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
  ['l', 'r'].forEach(s => { const m = pivot('mir-' + s, (s === 'l' ? 1 : -1) * .975, 1.16, .84); P.doors['df' + s].attach(m); P.mirrors[s] = m; });
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
  return { car, body, P };
}

/* ---------- scenes: a lavender Japanese garden (Home, lock screen) and five drive-mode worlds (Driving) ---------- */
const C = c => new THREE.Color(c);
function gradCanvas() { const c = document.createElement('canvas'); c.width = 2; c.height = 256; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t }; }
function paintGrad(G, top, mid, bot) { const x = G.c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(.62, '#' + mid.getHexString()); g.addColorStop(1, '#' + bot.getHexString()); x.fillStyle = g; x.fillRect(0, 0, 2, 256); G.t.needsUpdate = true; }
const lerpPal = (cur, tar, k) => { let moving = false; Object.keys(tar).forEach(n => { if (!(tar[n] instanceof THREE.Color)) return; const a = cur[n]; const d = Math.abs(a.r - tar[n].r) + Math.abs(a.g - tar[n].g) + Math.abs(a.b - tar[n].b); if (d > .002) { a.lerp(tar[n], k); moving = true; } else a.copy(tar[n]); }); return moving; };
const palOf = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' && v[0] === '#' ? C(v) : v]));

function gardenScene(scene) {
  const PAL = {
    day:   palOf({ top: '#dcd0ee', mid: '#f1d9ea', bot: '#f3ecf6', fog: '#efe4f3', floor: '#e6dcef', sky: '#fbeef7', gnd: '#c7b9de', petal: '#f3c3dd', torii: '#b67aa2', mtn: '#cdc0e2', mtn2: '#bcaed9', bloom: '#efbfdc', trunk: '#6d5a78', snow: '#fbf8fd', glow: '#ffe3f1' }),
    night: palOf({ top: '#17131f', mid: '#33253f', bot: '#2a2233', fog: '#271f30', floor: '#241e2e', sky: '#5b4970', gnd: '#191421', petal: '#b98ab0', torii: '#7c4569', mtn: '#2f2741', mtn2: '#272036', bloom: '#7a4f74', trunk: '#3a2f43', snow: '#8e86a6', glow: '#ff9fd1' }),
  };
  const cur = Object.fromEntries(Object.entries(PAL.day).map(([k, v]) => [k, v.clone()]));
  let tar = PAL.day, L = 1, LT = 1;
  const G = gradCanvas(); scene.background = G.t; scene.fog = new THREE.Fog(cur.fog, 14, 46);
  const hemi = new THREE.HemisphereLight(cur.sky, cur.gnd, 1.1); scene.add(hemi);
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: cur.floor, roughness: .32, metalness: .12 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; scene.add(floor);
  // a pale stone ring for the car to stand on
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.55, 3.7, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .35 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .001; scene.add(ring);
  // far mountains, one Fuji-like peak with a snow cap behind the car
  const mtnM = mat(cur.mtn), mtn2M = mat(cur.mtn2), snowM = mat(cur.snow);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = 34 + (i % 3) * 3, h = 5 + (i * 7 % 5);
    const m = new THREE.Mesh(new THREE.ConeGeometry(7 + (i % 4), h, 6), i % 2 ? mtnM : mtn2M); m.position.set(Math.cos(a) * r, h / 2 - .2, Math.sin(a) * r); scene.add(m); }
  const fuji = new THREE.Group(); fuji.position.set(16, 0, -27); scene.add(fuji);
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 14, 11, 40, 1, true), mtn2M); b.position.y = 5.5; fuji.add(b);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.6, 3.6, 40), snowM); cap.position.y = 9.25; fuji.add(cap); }
  // a lacquered torii, left of the car
  const toriiM = new THREE.MeshStandardMaterial({ color: cur.torii, roughness: .45 }), torii = new THREE.Group(); torii.position.set(1.2, 0, -11.5); torii.rotation.y = -.72; scene.add(torii);
  [-1.6, 1.6].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, 4.2, 16), toriiM); p.position.set(x, 2.1, 0); torii.add(p); });
  { const k = new THREE.Mesh(new THREE.BoxGeometry(4.8, .26, .42), toriiM); k.position.y = 4.32; torii.add(k);
    const k2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, .14, .3), toriiM); k2.position.y = 4.08; torii.add(k2);
    const n = new THREE.Mesh(new THREE.BoxGeometry(3.9, .18, .2), toriiM); n.position.y = 3.35; torii.add(n); }
  // cherry trees in lavender-pink bloom
  const bloomM = new THREE.MeshStandardMaterial({ color: cur.bloom, roughness: .8, emissive: cur.bloom, emissiveIntensity: .08 }), trunkM = mat(cur.trunk);
  [[-7.5, -9, 1.1], [10.5, -4.5, .9], [-11, 3.5, 1], [8.5, 9.5, .8], [-3, -14, 1.2], [14, -14, 1.1]].forEach(([x, z, s]) => {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); scene.add(t);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.12, .22, 2.4, 8), trunkM); tr.position.y = 1.2; tr.rotation.z = .08; t.add(tr);
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.75 + (i % 3) * .25, 1), bloomM); b.position.set(Math.cos(i * 2.4) * .9, 2.5 + (i % 3) * .35, Math.sin(i * 2.4) * .9); t.add(b); } });
  // drifting petals
  const N = 260, pg = new THREE.PlaneGeometry(.07, .05), petalM = new THREE.MeshBasicMaterial({ color: cur.petal, side: THREE.DoubleSide, transparent: true, opacity: .9 });
  const petals = new THREE.InstancedMesh(pg, petalM, N), PS = [], dummy = new THREE.Object3D(); scene.add(petals);
  const spawn = p => { const a = Math.random() * Math.PI * 2, rr = 1.2 + Math.random() * 4.6; p.x = Math.cos(a) * rr; p.z = Math.sin(a) * rr; return p; };   // only around the car, never in front of the lens
  for (let i = 0; i < N; i++) PS.push({ ...spawn({}), y: Math.random() * 4.5, s: .25 + Math.random() * .35, ph: Math.random() * 9, r: Math.random() * 6 });
  return {
    theme(dark) { tar = dark ? PAL.night : PAL.day; LT = dark ? 0 : 1; },
    update(dt, now) {
      let moving = lerpPal(cur, tar, Math.min(1, dt * 2.5));
      if (Math.abs(LT - L) > .002) { L += (LT - L) * Math.min(1, dt * 2.5); moving = true; } else L = LT;
      scene.environmentIntensity = .3 + .6 * L; hemi.intensity = .4 + .7 * L; ring.material.opacity = .1 + .25 * L;
      if (moving || !G.done) { paintGrad(G, cur.top, cur.mid, cur.bot); G.done = true; scene.fog.color.copy(cur.fog); hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.gnd);
        floor.material.color.copy(cur.floor); mtnM.color.copy(cur.mtn); mtn2M.color.copy(cur.mtn2); snowM.color.copy(cur.snow); toriiM.color.copy(cur.torii);
        bloomM.color.copy(cur.bloom); bloomM.emissive.copy(cur.bloom); trunkM.color.copy(cur.trunk); petalM.color.copy(cur.petal); }
      const t = now / 1000;
      PS.forEach((p, i) => { p.y -= p.s * dt; p.x += Math.sin(t * .7 + p.ph) * .25 * dt; p.z += Math.cos(t * .5 + p.ph) * .12 * dt;
        if (p.y < 0) { p.y = 4.2 + Math.random() * .6; spawn(p); }
        dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(t * p.s * 2 + p.r, t * .8 + p.ph, p.r); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix); });
      petals.instanceMatrix.needsUpdate = true; return true;
    },
  };
}

const DRIVE = {   // sky top / middle / horizon, fog, ground, road, line colour, speed (m/s shown), scenery
  Comfort: { top: '#d9cfee', mid: '#f0dde9', bot: '#f5ecf2', fog: '#efe4f0', ground: '#ddd2e6', road: '#a9a1b8', line: '#ffffff', v: 11, kind: 'lamps' },
  Eco:     { top: '#cfe6dd', mid: '#e7f2ea', bot: '#f2f7f1', fog: '#e6f0e8', ground: '#c9dfc8', road: '#a7aea9', line: '#ffffff', v: 8, kind: 'trees' },
  Sport:   { top: '#120f1c', mid: '#2c1d38', bot: '#4a2240', fog: '#2a1a33', ground: '#1d1824', road: '#2a2532', line: '#ff4f8b', v: 22, kind: 'neon' },
  Snow:    { top: '#d7e1f0', mid: '#eaf0f8', bot: '#f6f8fc', fog: '#eef2f8', ground: '#f4f6fb', road: '#c3cad6', line: '#ffffff', v: 6, kind: 'pines' },
  Custom:  { top: '#e2dcf2', mid: '#efecf7', bot: '#f6f4fa', fog: '#efecf6', ground: '#e8e4f2', road: '#c9c2db', line: '#8d7fd6', v: 11, kind: 'grid' },
};
function driveScene(scene) {
  const P = Object.fromEntries(Object.entries(DRIVE).map(([k, o]) => [k, palOf(o)]));
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
  const std = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, emissive: c, emissiveIntensity: e });
  add('lamps', () => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 4.2, 8), std('#8d84a3')); p.position.y = 2.1; g.add(p);
    const a = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .9), std('#8d84a3')); a.position.set(0, 4.15, .4); g.add(a);
    const b = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), std('#ffe9c9', 1.4)); b.position.set(0, 4.05, .82); g.add(b); return g; }, 9, [-7.2, -7]);
  add('trees', i => { const g = new THREE.Group(), s = .8 + Math.random() * .7; g.scale.setScalar(s);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, 1.6, 6), std('#7b6a5c')); t.position.y = .8; g.add(t);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), std(i % 3 ? '#8fc49a' : '#a7d4a2')); c.position.y = 2.2; g.add(c); return g; }, 26, [-18, -7.5]);
  add('neon', i => { const g = new THREE.Group(); const h = 2.5 + Math.random() * 5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(.12, h, .12), std(i % 2 ? '#ff3d7f' : '#9b5cff', 2.2)); b.position.y = h / 2; g.add(b); return g; }, 34, [-16, -7]);
  add('pines', i => { const g = new THREE.Group(), s = .9 + Math.random() * .9; g.scale.setScalar(s);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .8, 6), std('#6b5d58')); t.position.y = .4; g.add(t);
    [0, 1, 2].forEach(k => { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - k * .3, 1.3, 7), std(k === 2 ? '#ffffff' : '#7f9c95')); c.position.y = 1.1 + k * .75; g.add(c); }); return g; }, 30, [-20, -7.5]);
  add('grid', () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.9, .9, .9), new THREE.MeshStandardMaterial({ color: '#cfc6ec', roughness: .3, metalness: .2 })); b.position.y = .45 + Math.random() * 2; b.rotation.set(Math.random(), Math.random(), 0); g.add(b); return g; }, 10, [-16, -8]);
  const grid = new THREE.GridHelper(160, 160, '#b9addf', '#d6cfec'); grid.material.transparent = true; grid.material.opacity = 0; grid.position.y = .002; scene.add(grid);
  // falling snow
  const SN = 700, sg = new THREE.BufferGeometry(), sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = -18 + Math.random() * 24; sp[i * 3 + 1] = Math.random() * 7; sp[i * 3 + 2] = (Math.random() - .5) * 30; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: .07, transparent: true, opacity: 0, depthWrite: false })); scene.add(snow);
  return {
    mode(m) { if (!P[m]) return; mode = m; vT = P[m].v; },
    speed: () => v,
    update(dt) {
      const tar = P[mode], k = Math.min(1, dt * 2.2);
      lerpPal(cur, tar, k); paintGrad(G, cur.top, cur.mid, cur.bot); scene.fog.color.copy(cur.fog); ground.material.color.copy(cur.ground); road.material.color.copy(cur.road); edgeM.color.copy(cur.line);
      v += (vT - v) * k; off += v * dt;
      rt.offset.y = -(off / 160 * 16) % 1;
      edgeM.opacity += ((mode === 'Sport' ? .9 : 0) - edgeM.opacity) * k;
      grid.material.opacity += ((mode === 'Custom' ? .7 : 0) - grid.material.opacity) * k; grid.position.z = -(off % 1);
      snow.material.opacity += ((mode === 'Snow' ? .9 : 0) - snow.material.opacity) * k;
      if (snow.material.opacity > .01) { for (let i = 0; i < SN; i++) { sp[i * 3 + 1] -= dt * 1.1; sp[i * 3 + 2] -= dt * v * .85; if (sp[i * 3 + 1] < 0) sp[i * 3 + 1] += 7; if (sp[i * 3 + 2] < -15) sp[i * 3 + 2] += 30; } sg.attributes.position.needsUpdate = true; }
      Object.entries(sets).forEach(([kind, g]) => { const on = tar.kind === kind ? 1 : 0; g.userData.k += (on - g.userData.k) * k; const s = g.userData.k;
        g.visible = s > .01; g.scale.set(1, Math.max(.001, s), 1);
        if (g.visible) g.userData.items.forEach(o => { o.position.z -= v * dt; if (o.position.z < -L / 2) o.position.z += L; }); });
      return true;
    },
  };
}

/* ---------- viewers ---------- */
const VIEWS = {   // camera position, target, field of view
  qc:   { p: [0, 14.5, -.001], t: [0, 0, -.05], fov: 26, up: [0, 0, 1] },   // straight down, nose up (locked)
  ty:   { p: [0, 15.5, -.001], t: [0, 0, -.05], fov: 26, up: [0, 0, 1] },   // straight down, nose up
  side: { p: [7.4, 1.05, .1], t: [-.4, .72, .1], fov: 27, ls: 2.4 },        // driver's side, whole car (ride height shown 2.4× so it reads)
  home: { p: [-7.3, 2.0, 8.4], t: [-1.05, .95, -.7], fov: 30 },             // front three-quarter, like a showroom; car sits right of the Next card
  lock: { p: [8.2, 2.5, 8.6], t: [0, 1.55, .2], fov: 28 },                   // car in the lower half, under the clock
};
const viewers = new Set();
let loopOn = false;
function loop() {
  loopOn = true; let busy = false; const now = performance.now();
  viewers.forEach(v => { if (v.tick(now)) busy = true; });
  if (busy) requestAnimationFrame(loop); else loopOn = false;
}
const kick = () => { if (!loopOn) requestAnimationFrame(loop); };

export async function mount(el, opt = {}) {
  const cv = document.createElement('canvas'); cv.className = 'c3d'; el.appendChild(cv);
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: !!opt.keep });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.localClippingEnabled = true;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture;   // one per canvas: GPU textures can't be shared between canvases
  const key = new THREE.DirectionalLight('#ffffff', .9); key.position.set(3, 8, 4); scene.add(key);
  const V = VIEWS[opt.view || 'qc'], cam = new THREE.PerspectiveCamera(V.fov, 1, .1, 200); if (V.up) cam.up.set(...V.up);
  const LS = V.ls || 1.6;
  const tgt = new THREE.Vector3(...V.t), home = new THREE.Vector3(...V.p).sub(tgt);
  const sph = new THREE.Spherical().setFromVector3(home), sph0 = sph.clone();
  const { car, body, P } = await buildCar(); scene.add(car);
  const world = opt.scene === 'garden' ? gardenScene(scene) : opt.scene === 'drive' ? driveScene(scene) : null;
  if (world) { scene.environmentIntensity = .9; }
  // state, animated values
  const S = { door: { dfl: 0, dfr: 0, drl: 0, drr: 0 }, frunk: 0, boot: 0, port: 0, win: { fl: 0, fr: 0, rl: 0, rr: 0 }, mir: 0, shade: { l: 0, r: 0 }, lift: 0, head: .55, tail: .5, warn: {} };
  const T = JSON.parse(JSON.stringify(S));
  const doorPaint = {}, dbl = new Map();
  Object.keys(P.doors).forEach(k => { doorPaint[k] = M.paint.clone(); doorPaint[k].side = THREE.DoubleSide;
    P.doors[k].traverse(o => { if (!o.isMesh) return; if (o.material === M.paint) o.material = doorPaint[k];
      else if (o.material.side !== THREE.DoubleSide) { if (!dbl.has(o.material)) { const m = o.material.clone(); m.side = THREE.DoubleSide; dbl.set(o.material, m); } o.material = dbl.get(o.material); } }); });
  [P.frunk, P.boot].forEach(g => g.traverse(o => { if (o.isMesh && o.material === M.paint) o.material = M.paintD; }));
  const tyreMats = {}; Object.entries(P.wheels).forEach(([k, w]) => w.spin.traverse(o => { if (o.isMesh && /tire/i.test(o.material.name || '')) { const m = tyreMats[k] || (tyreMats[k] = o.material.clone()); o.material = m; } }));
  let spin = !!opt.spin, wheelA = 0, last = performance.now(), dirty = true, W = 0, H = 0, t0 = performance.now();
  const step = (cur, tar, dt, rate) => { const d = tar - cur; return Math.abs(d) < .0005 ? tar : cur + d * Math.min(1, dt * rate); };
  function apply(now) {
    const D = { dfl: -1, drl: -1, dfr: 1, drr: 1 };
    Object.keys(P.doors).forEach(k => { P.doors[k].rotation.y = D[k] * EASE(S.door[k]) * 1.0;
      doorPaint[k].copy(M.paint); doorPaint[k].side = THREE.DoubleSide; doorPaint[k].emissive.set('#d23a48'); doorPaint[k].emissiveIntensity = S.door[k] * .13; });
    const PW = { dfl: 'fl', dfr: 'fr', drl: 'rl', drr: 'rr' };
    Object.entries(P.panes).forEach(([k, p]) => { p.position.y = -S.win[PW[k]] * .4; });
    P.frunk.rotation.x = -EASE(S.frunk) * .9;
    P.boot.rotation.x = EASE(S.boot) * 1.1;
    P.port.rotation.y = EASE(S.port) * 1.6; P.port.visible = S.port > .01; P.portGlow.material.opacity = S.port * .55;
    P.mirrors.l.rotation.y = EASE(S.mir) * 1.15; P.mirrors.r.rotation.y = -EASE(S.mir) * 1.15;
    ['l', 'r'].forEach(s => { P.shades[s].scale.z = 1 - S.shade[s] * .9; });
    // ride height (shown larger than life so it reads); when driving the body also floats a little on the air springs
    let bob = 0, pitch = 0;
    if (opt.scene === 'drive') { const t = (now - t0) / 1000, sp = world.speed() / 22; bob = (Math.sin(t * 1.9) * .004 + Math.sin(t * 5.3) * .0015 * sp); pitch = Math.sin(t * 1.3 + 1) * .0025 + Math.sin(t * 4.1) * .001 * sp; }
    body.position.y = S.lift / 1000 * LS + bob; body.rotation.x = pitch;
    P.clip.constant = -(1.115 + body.position.y);
    M.head.emissiveIntensity = S.head * 2.2; M.tail.emissiveIntensity = S.tail * 2;
    Object.entries(P.wglow).forEach(([k, m]) => { m.material.opacity = (S.warn[k] || 0) * (.6 + .3 * Math.sin(now / 260)); });
    Object.entries(tyreMats).forEach(([k, m]) => { m.emissive.set('#e0303f'); m.emissiveIntensity = (S.warn[k] || 0) * (.35 + .25 * Math.sin(now / 260)); });
  }
  const proj = new THREE.Vector3();
  const v = {
    el, canvas: cv, P,
    tick(now) {
      const w = el.clientWidth, h = el.clientHeight; if (!w || !h || !cv.isConnected) return false;
      if (w !== W || h !== H) { W = w; H = h; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); dirty = true; if (opt.onResize) setTimeout(() => opt.onResize(v), 0); }
      const dt = Math.min(.05, (now - last) / 1000); last = now; let moving = false;
      const walk = (a, b, rate) => { Object.keys(b).forEach(k => { if (typeof b[k] === 'object') { moving = walk(a[k], b[k], rate) || moving; } else { const n = step(a[k], b[k], dt, rate); if (n !== a[k]) { a[k] = n; moving = true; } } }); return moving; };
      walk(S, T, 4.2);
      if (Object.values(S.warn).some(x => x > 0)) moving = true;
      if (world && world.update(dt, now)) moving = true;
      if (opt.scene === 'drive') { wheelA += dt * world.speed() / .4; Object.values(P.wheels).forEach(wh => wh.spin.rotation.x = wheelA); }
      else if (spin) { wheelA += dt * 6; Object.values(P.wheels).forEach(wh => wh.spin.rotation.x = wheelA); moving = true; }
      if (opt.drift) { sph.theta = sph0.theta + Math.sin((now - t0) / 7000) * .22; moving = true; }
      if (drag || inertia) { if (!drag) { sph.theta += vel * dt; vel *= Math.pow(.04, dt); if (Math.abs(vel) < .02) inertia = false; } moving = true; }
      else if (back) { const k = Math.min(1, dt * 3); sph.theta += (sph0.theta - sph.theta) * k; sph.phi += (sph0.phi - sph.phi) * k;
        if (Math.abs(sph.theta - sph0.theta) + Math.abs(sph.phi - sph0.phi) < 1e-4) { sph.theta = sph0.theta; sph.phi = sph0.phi; back = false; } moving = true; }
      if (moving || dirty) { apply(now); cam.position.setFromSpherical(sph).add(tgt); cam.lookAt(tgt); r.render(scene, cam); dirty = false; }
      return moving;
    },
    set(st) {
      if (st.open) ['dfl', 'dfr', 'drl', 'drr', 'frunk', 'boot'].forEach(k => { const o = st.open[k] ? 1 : 0; if (k.startsWith('d')) T.door[k] = o; else T[k] = o; });
      if ('port' in st) T.port = st.port ? 1 : 0;
      if (st.wins) Object.assign(T.win, st.wins);
      if ('mir' in st) T.mir = st.mir === 'fold' ? 1 : 0;
      if (st.shade) { T.shade.l = st.shade.l ? 1 : 0; T.shade.r = st.shade.r ? 1 : 0; }
      if ('lights' in st) { T.head = st.lights === 'on' ? 1 : st.lights === 'off' ? .08 : .55; T.tail = st.lights === 'off' ? .15 : st.lights === 'on' ? 1 : .5; }
      if ('lift' in st) T.lift = st.lift;
      if ('spin' in st) spin = !!st.spin;
      if ('warn' in st) { ['fl', 'fr', 'rl', 'rr'].forEach(k => T.warn[k] = st.warn === k ? 1 : 0); }
      if ('mode' in st && world && world.mode) world.mode(st.mode);
      if ('dark' in st && world && world.theme) world.theme(st.dark);
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
  return v;
}

/* a still top-down picture of the car (for the map's car marker); px = pixels per metre */
export async function snapshot(px = 40) {
  const { car } = await buildCar(); car.traverse(o => { if (o.name === 'shadow' || o.name === 'wglow') o.visible = false; });
  const w = Math.round(2.3 * px), h = Math.round(5.5 * px), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture; scene.add(car);
  const l = new THREE.DirectionalLight('#ffffff', 1); l.position.set(2, 8, 3); scene.add(l);
  const cam = new THREE.OrthographicCamera(-1.15, 1.15, 2.75, -2.75, .1, 30); cam.up.set(0, 0, 1); cam.position.set(0, 12, -.1); cam.lookAt(0, 0, -.1);
  r.render(scene, cam); const url = cv.toDataURL('image/png'); r.dispose(); r.forceContextLoss && r.forceContextLoss();
  return url;
}

const paintHooks = new Set();
export function onPaint(f) { paintHooks.add(f); }
export function setPaint(k) {
  if (!PAINTS[k]) return; paintKey = k; try { localStorage.setItem('nio-paint', k); } catch (e) {}
  applyPaint(); viewers.forEach(v => v.render()); paintHooks.forEach(f => f(k));
}
export const paint = () => paintKey;
export const preload = () => loadRaw();

window.ET9 = { mount, setPaint, paint, PAINTS, preload, snapshot, onPaint };
window.dispatchEvent(new Event('et9-ready'));
