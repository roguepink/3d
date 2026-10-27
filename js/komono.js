// 小物(時計・本・写真立て・カレンダー・日用品など)。部屋に生活感を足す
// 書き方は furniture.js と同じ(styles / parts / params / build)
// 向き:正面が +z。壁の物(kind:'wall')は y=中心、z=0 が壁、+z が部屋側。
// 机や棚の上に置く物は opts.lift(床からの高さ)だけ持ち上げる。
// 多くの物は「形の見本の大きさ(styles の size)」で作って、置いた大きさに合わせてのばす(fit)。
import * as THREE from 'three';
import { std, box, cyl, sph, emissive, rbox, pm, partVal, styleOf, light, CATALOG } from './kit.js';
import { finishById } from './textures.js';

// ---- 共通の小さな道具 ----
const LIFT = ['lift', '床からの高さ(机・棚の上など)', 0, 1.2, 'mm'];
// 決まった種からの乱数(毎回同じ並びになる)
function rng(seed) { let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
// 色の id('w_oak' など)→ '#rrggbb'(絵に描くとき用)
function hexOf(v) { if (!v) return '#cccccc'; if (v[0] === '#') return v; const f = finishById(v); return f ? (f.color || (f.wood && f.wood.base) || '#cccccc') : '#cccccc'; }
// 見本の大きさで作って、置いた大きさにのばす。lift=true なら床からの高さぶん上げる
function fit(inner, it, lift = false) {
  const st = styleOf(it), [sw, sh, sd] = (st && st.size) || CATALOG[it.type].size, g = new THREE.Group();
  inner.scale.set(it.w / sw, it.h / sh, it.d / sd); if (lift) inner.position.y = (it.opts && it.opts.lift) || 0; g.add(inner); return g;
}
// 絵(canvas)の材質。同じ絵は使い回す
const texCache = new Map();
function canvasMat(key, W, H, draw, opt = {}) {
  if (texCache.has(key)) return texCache.get(key);
  let m;
  try {
    const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    m = opt.glow ? new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: t, emissiveIntensity: opt.glow, roughness: .3 })
      : new THREE.MeshStandardMaterial({ map: t, roughness: opt.rough ?? .75, transparent: !!opt.transparent });
  } catch (e) { m = std(opt.fallback || '#dddddd', .7); }
  texCache.set(key, m); return m;
}
const plane = (w, h, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); return m; };
const circ = (r, mat, x = 0, y = 0, z = 0, seg = 32) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, seg), mat); m.position.set(x, y, z); return m; };
// 前(+z)を向いた円盤
const disc = (r, t, mat, x = 0, y = 0, z = 0, seg = 28) => { const m = cyl(r, r, t, mat, x, y, z, seg); m.rotation.x = Math.PI / 2; return m; };
const ell = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = sph(r, mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
// a から b へ渡す丸棒
const UP = new THREE.Vector3(0, 1, 0);
function rod(g, mat, a, b, r, seg = 8) { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va), len = dir.length(); const m = cyl(r, r, len, mat, 0, 0, 0, seg); m.position.copy(va.add(vb).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(UP, dir.normalize()); g.add(m); return m; }
// 落ち着いた色(本・服・メモなど)
const CALM = ['#2f3d5c', '#8a9a82', '#a8392f', '#c79a3c', '#e9e2cf', '#6b4a33', '#7d93a8', '#3f5546', '#d4aaa3', '#4b4e54', '#b8afa3', '#8f6b43'];

// ---- 時計の文字盤(絵)と針 ----
function faceMat(face, mark, square) {
  return canvasMat(`face|${face}|${mark}|${square}`, 256, 256, (x, W) => {
    const c = W / 2; x.fillStyle = face; x.fillRect(0, 0, W, W); x.strokeStyle = mark; x.fillStyle = mark;
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, big = i % 5 === 0, r1 = c * 0.93, r0 = c * (big ? 0.8 : 0.88); x.lineWidth = big ? 7 : 2.5; x.beginPath(); x.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); x.lineTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); x.stroke(); }
    x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [n, a] of [[12, 0], [3, 90], [6, 180], [9, 270]]) { const r = Math.PI * a / 180; x.fillText(String(n), c + Math.sin(r) * c * 0.62, c - Math.cos(r) * c * 0.62 + 2); }
    void square;
  });
}
// 10時8分ごろを指す針(cy = 中心の高さ、z = 文字盤の前)
function hands(g, r, cx, cy, z, mat, sec = true) {
  const hand = (len, wd, ang, m, zz) => { const p = new THREE.Group(); p.position.set(cx, cy, zz); p.rotation.z = -ang; p.add(box(wd, len, 0.002, m, 0, len * 0.38, 0)); g.add(p); };
  hand(r * 0.62, r * 0.07, (10 + 8 / 60) / 12 * Math.PI * 2, mat, z + 0.002); hand(r * 0.92, r * 0.05, 8 / 60 * Math.PI * 2, mat, z + 0.0045);
  if (sec) hand(r * 0.95, r * 0.018, 38 / 60 * Math.PI * 2, std('#b0392e', .5), z + 0.007);
  g.add(disc(r * 0.06, 0.006, mat, cx, cy, z + 0.006, 12));
}
// 7セグの数字の絵(デジタル時計・日めくり用ではなく、光る数字用)
function digitalMat(col) {
  return canvasMat(`digi|${col}`, 256, 96, (x, W, H) => {
    x.fillStyle = '#050506'; x.fillRect(0, 0, W, H); x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 8;
    const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    const dig = (n, ox) => { const w = 34, h = 64, t = 7, oy = 16; const s = { a: [ox + t, oy, w - 2 * t, t], b: [ox + w - t, oy + t, t, h / 2 - t * 1.5], c: [ox + w - t, oy + h / 2 + t / 2, t, h / 2 - t * 1.5], d: [ox + t, oy + h - t, w - 2 * t, t], e: [ox, oy + h / 2 + t / 2, t, h / 2 - t * 1.5], f: [ox, oy + t, t, h / 2 - t * 1.5], g: [ox + t, oy + h / 2 - t / 2, w - 2 * t, t] }; for (const k of SEG[n]) x.fillRect(...s[k]); };
    dig(0, 30); dig(7, 76); x.fillRect(124, 36, 7, 7); x.fillRect(124, 58, 7, 7); dig(3, 142); dig(0, 188);
  }, { glow: 1.5 });
}

// ---- 掛け時計 ----
function wallClockBuild(it) {
  const st = styleOf(it), s = st.id, [W, H] = st.size, g = new THREE.Group(), rim = pm(it, 'rim', .5, .1), hand = std(hexOf(partVal(it, 'hand')), .5), face = faceMat(hexOf(partVal(it, 'face')), hexOf(partVal(it, 'hand')), s === 'square');
  if (s === 'square') { g.add(box(W, H, 0.04, rim, 0, 0, 0.02)); g.add(plane(W - 0.03, H - 0.03, face, 0, 0, 0.0405)); hands(g, (W - 0.03) / 2, 0, 0, 0.041, hand); return fit(g, it); }
  if (s === 'pendulum') {
    const brass = std('#c9a45a', .3, .85), cy = H / 2 - 0.15;
    g.add(box(W, H - 0.04, 0.08, rim, 0, 0, 0.04)); g.add(box(W + 0.03, 0.03, 0.09, rim, 0, H / 2 - 0.015, 0.045)); g.add(box(W + 0.02, 0.025, 0.088, rim, 0, -H / 2 + 0.0125, 0.044));
    g.add(disc(0.104, 0.006, brass, 0, cy, 0.083, 32)); g.add(circ(0.095, face, 0, cy, 0.0865)); hands(g, 0.095, 0, cy, 0.087, hand, false);
    // 下の窓と振り子
    const wy = -0.1, wh = 0.25, ww = 0.17; g.add(plane(ww, wh, std('#2c221a', .8), 0, wy, 0.0805));
    const p = new THREE.Group(); p.position.set(0, wy + wh / 2 - 0.01, 0.083); p.rotation.z = 0.12; p.add(box(0.008, 0.18, 0.003, brass, 0, -0.09, 0)); p.add(disc(0.032, 0.006, brass, 0, -0.18, 0.001, 24)); g.add(p);
    for (const [bw, bh, bx, by] of [[ww + 0.024, 0.012, 0, wy + wh / 2 + 0.006], [ww + 0.024, 0.012, 0, wy - wh / 2 - 0.006], [0.012, wh, -ww / 2 - 0.006, wy], [0.012, wh, ww / 2 + 0.006, wy]]) g.add(box(bw, bh, 0.01, rim, bx, by, 0.084));
    g.add(plane(ww, wh, new THREE.MeshStandardMaterial({ color: '#dfe8ec', roughness: .05, metalness: .3, transparent: true, opacity: .18 }), 0, wy, 0.0885));
    return fit(g, it);
  }
  const r = W / 2, fr = s === 'wood' ? r * 0.78 : r - 0.014;
  g.add(disc(r, 0.04, rim, 0, 0, 0.02, 40)); g.add(circ(fr, face, 0, 0, 0.0412, 40)); hands(g, fr, 0, 0, 0.0415, hand);
  if (s === 'wood') g.add(disc(fr + 0.006, 0.002, std('#3b2a1e', .7), 0, 0, 0.0398, 40));
  return fit(g, it);
}

// ---- 置き時計 ----
function deskClockBuild(it) {
  const st = styleOf(it), s = st.id, g = new THREE.Group(), body = pm(it, 'body', .45, .1), hcol = hexOf(partVal(it, 'hand')), hand = std(hcol, .5), face = faceMat(hexOf(partVal(it, 'face')), hcol, false), chrome = std('#d6d9dc', .2, .9);
  if (s === 'digital') {
    g.add(rbox(0.16, 0.075, 0.07, 0.014, body, 0, 0.0375, 0)); g.add(plane(0.13, 0.049, digitalMat(hcol), 0, 0.039, 0.0352));
    return fit(g, it, true);
  }
  if (s === 'wood') {
    const gold = std('#c9a45a', .3, .85);
    g.add(box(0.14, 0.02, 0.08, body, 0, 0.01, 0)); g.add(box(0.118, 0.16, 0.064, body, 0, 0.1, 0)); g.add(box(0.13, 0.02, 0.074, body, 0, 0.19, 0));
    g.add(disc(0.05, 0.005, gold, 0, 0.125, 0.0335, 28)); g.add(circ(0.045, face, 0, 0.125, 0.0365)); hands(g, 0.045, 0, 0.125, 0.037, hand, false);
    g.add(box(0.07, 0.035, 0.002, std('#2c221a', .7), 0, 0.048, 0.033)); return fit(g, it, true);
  }
  // 目覚まし(ベル2つ)
  const cy = 0.07, r = 0.05;
  g.add(disc(r, 0.045, body, 0, cy, 0, 32)); const bz = new THREE.Mesh(new THREE.TorusGeometry(r - 0.002, 0.004, 6, 32), chrome); bz.position.set(0, cy, 0.0225); g.add(bz); g.add(circ(r - 0.006, face, 0, cy, 0.0268)); hands(g, r - 0.006, 0, cy, 0.027, hand);
  const bellG = new THREE.SphereGeometry(0.026, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(bellG, chrome); b.position.set(sx * 0.036, cy + 0.052, 0); b.rotation.z = -sx * 0.55; b.castShadow = true; g.add(b);
    g.add(cyl(0.004, 0.006, 0.026, chrome, sx * 0.03, 0.0095, 0, 8));
  }
  g.add(box(0.006, 0.02, 0.006, chrome, 0, cy + 0.058, 0)); g.add(sph(0.007, chrome, 0, cy + 0.07, 0));
  return fit(g, it, true);
}

// ---- 本 ----
const PAGE = '#efe8d6';
// 寝かせた本(背が -x)。y0 = 下の高さ。ページが3方に白く見える
function flatBook(g, w, t, d, mat, x, y0, z, ry = 0) {
  const b = new THREE.Group(); b.position.set(x, y0, z); b.rotation.y = ry;
  b.add(box(w, t, d - 0.006, mat, 0, t / 2, 0)); b.add(box(w - 0.004, t * 0.8, d - 0.002, std(PAGE, .9), 0.0025, t / 2, 0)); g.add(b); return b;
}
// 立てた本(背が +z)
function standBook(g, t, H, D, mat, x, zFront, label) {
  const z = zFront - D / 2; g.add(box(t, H - 0.006, D, mat, x, H / 2, z)); g.add(box(t * 0.8, H - 0.002, D - 0.004, std(PAGE, .9), x, (H - 0.002) / 2, z - 0.0025));
  if (label) g.add(box(t * 0.86, 0.014, 0.001, std('#e3d6b8', .6), x, H * 0.78, zFront + 0.0005));
}
function pageLinesMat() {
  return canvasMat('pagelines', 128, 192, (x, W, H) => { x.fillStyle = PAGE; x.fillRect(0, 0, W, H); x.fillStyle = '#9d978a'; for (let i = 0; i < 17; i++) { const len = i % 6 === 5 ? 0.5 : 0.82; x.fillRect(W * 0.1, H * 0.08 + i * H * 0.05, W * len, 2.2); } });
}
function booksBuild(it) {
  const st = styleOf(it), s = st.id, [SW, SH, SD] = st.size, g = new THREE.Group(), first = pm(it, 'cover', .7), R = rng('books' + s);
  const col = () => std(CALM[Math.floor(R() * CALM.length)], .75);
  if (s === 'open') {
    g.add(box(SW, 0.006, SD, first, 0, 0.003, 0)); const lines = pageLinesMat();
    for (const sx of [-1, 1]) {
      const b = new THREE.Group(); b.position.set(sx * (SW / 4 - 0.004), 0.006, 0); b.rotation.z = sx * 0.05;
      b.add(box(SW / 2 - 0.012, 0.016, SD - 0.012, std(PAGE, .9), 0, 0.008, 0)); const pl = plane(SW / 2 - 0.03, SD - 0.035, lines, 0, 0.0165, 0); pl.rotation.x = -Math.PI / 2; b.add(pl); g.add(b);
    }
    return fit(g, it, true);
  }
  if (s === 'row') {
    const em = pm(it, 'end', .4, .6), ed = 0.12, x0 = -SW / 2, x1 = SW / 2;
    for (const sx of [-1, 1]) { g.add(box(0.004, 0.15, ed, em, sx * (SW / 2 - 0.002), 0.075, 0)); g.add(box(0.07, 0.003, ed, em, sx * (SW / 2 - 0.035), 0.0015, 0)); }
    let x = x0 + 0.006, i = 0;
    while (true) { const t = 0.016 + R() * 0.026; if (x + t > x1 - 0.006) break; const H = SH * (0.68 + R() * 0.32), D = 0.12 + R() * 0.05; standBook(g, t, H, D, i === 1 ? first : col(), x + t / 2, SD / 2 - 0.005, R() < 0.55); x += t + 0.0008; i++; }
    return fit(g, it, true);
  }
  // 平積み
  const n = 7, ts = []; for (let i = 0; i < n; i++) ts.push(0.016 + R() * 0.026); const k = SH / ts.reduce((a, b) => a + b, 0); let y = 0;
  for (let i = 0; i < n; i++) { const t = ts[i] * k, w = SW * (0.95 - i * 0.04 - R() * 0.12), d = SD * (0.95 - i * 0.035 - R() * 0.12); flatBook(g, w, t, d, i === 0 ? first : col(), (R() - 0.5) * 0.02, y, (R() - 0.5) * 0.015, (R() - 0.5) * 0.25 + (i % 2 ? Math.PI : 0)); y += t; }
  return fit(g, it, true);
}

// ---- 写真立て ----
// 写真のかわりの「色のぼかし」(人は描かない)
function blurMat(seed) {
  return canvasMat('blur|' + seed, 128, 128, (x, W, H) => {
    const R = rng('photo' + seed), sky = ['#a9c4d8', '#e8c9a8', '#c9d6e2', '#d8b7a8'][Math.floor(R() * 4)], land = ['#7e9a6c', '#5f7d8c', '#a89a72', '#6f8a7a'][Math.floor(R() * 4)];
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky); gr.addColorStop(0.55, sky); gr.addColorStop(0.62, land); gr.addColorStop(1, land); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) { const cx = R() * W, cy = H * (0.3 + R() * 0.6), r = W * (0.15 + R() * 0.3), c = CALM[Math.floor(R() * CALM.length)]; const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, c + 'aa'); rg.addColorStop(1, c + '00'); x.fillStyle = rg; x.fillRect(0, 0, W, H); }
  }, { rough: .35 });
}
function photoFrame(g, fr, gw, gh, x, z, ry, tilt, seed, leg) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.set(-tilt, ry, 0, 'YXZ'); g.add(p);
  p.add(box(gw, gh, 0.014, fr, 0, gh / 2, 0)); p.add(plane(gw - 0.022, gh - 0.022, std('#f4f1ea', .8), 0, gh / 2, 0.0072)); p.add(plane(gw - 0.04, gh - 0.04, blurMat(seed), 0, gh / 2, 0.0074));
  if (leg) { const L = new THREE.Group(); L.position.set(0, gh * 0.65, -0.007); L.rotation.x = 0.5; L.add(box(0.014, gh * 0.69, 0.005, fr, 0, -gh * 0.345, -0.003)); p.add(L); }
}
function photoBuild(it) {
  const st = styleOf(it), s = st.id, [SW, SH, SD] = st.size, g = new THREE.Group(), fr = pm(it, 'frame', .5);
  if (s === 'double') { const gw = SW / 2 - 0.006; for (const sx of [-1, 1]) photoFrame(g, fr, gw, SH, sx * (SW / 4), sx * 0 + 0.01, -sx * 0.28, 0, 'd' + sx, false); return fit(g, it, true); }
  photoFrame(g, fr, SW, SH, 0, SD * 0.3, 0, 0.14, s, true); return fit(g, it, true);
}

// ---- 壁の額・ポスター・コルクボード ----
function abstractMat(accent, kind) {
  return canvasMat(`abs|${kind}|${accent}`, 192, 256, (x, W, H) => {
    const R = rng('abs' + kind); x.fillStyle = kind === 'poster' ? '#ece6da' : '#f1ece2'; x.fillRect(0, 0, W, H);
    if (kind === 'poster') {
      x.fillStyle = accent; x.beginPath(); x.arc(W * 0.55, H * 0.36, W * 0.3, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2f3d5c'; x.fillRect(0, H * 0.58, W, H * 0.06); x.fillStyle = '#8a9a82'; x.fillRect(0, H * 0.64, W, H * 0.04);
      x.fillStyle = '#4b4e54'; x.fillRect(W * 0.1, H * 0.76, W * 0.62, 10); for (let i = 0; i < 4; i++) x.fillRect(W * 0.1, H * 0.83 + i * 9, W * (0.35 + R() * 0.4), 3);
    } else {
      x.fillStyle = '#d9cfbf'; x.fillRect(W * 0.08, H * 0.1, W * 0.84, H * 0.5); x.fillStyle = accent; x.fillRect(W * 0.18, H * 0.2, W * 0.42, H * 0.55);
      x.fillStyle = '#2f3d5c'; x.fillRect(W * 0.5, H * 0.45, W * 0.34, H * 0.36); x.fillStyle = '#8a9a82'; x.beginPath(); x.arc(W * 0.7, H * 0.25, W * 0.12, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#3a3b40'; x.lineWidth = 3; x.beginPath(); x.moveTo(W * 0.1, H * 0.88); x.bezierCurveTo(W * 0.4, H * 0.7, W * 0.6, H * 0.98, W * 0.9, H * 0.8); x.stroke();
    }
  });
}
function corkMat() {
  return canvasMat('cork', 128, 96, (x, W, H) => { const R = rng('cork'); x.fillStyle = '#c49a6c'; x.fillRect(0, 0, W, H); for (let i = 0; i < 900; i++) { x.fillStyle = R() < 0.5 ? '#a87d52' : '#d8b385'; x.fillRect(R() * W, R() * H, 1 + R() * 1.5, 1 + R() * 1.5); } });
}
const pin = (g, col, x, y, z) => { g.add(cyl(0.006, 0.006, 0.006, std(col, .4), x, y, z, 10).rotateX(Math.PI / 2)); };
function wallArtBuild(it) {
  const st = styleOf(it), s = st.id, [W, H] = st.size, g = new THREE.Group(), fr = pm(it, 'frame', .5), acc = hexOf(partVal(it, 'art'));
  if (s === 'poster') {
    g.add(box(W, H, 0.002, std('#ece6da', .85), 0, 0, 0.001)); g.add(plane(W, H, abstractMat(acc, 'poster'), 0, 0, 0.0021));
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pin(g, '#b0392e', sx * (W / 2 - 0.015), sy * (H / 2 - 0.015), 0.005);
    return fit(g, it);
  }
  if (s === 'cork') {
    g.add(box(W, H, 0.022, fr, 0, 0, 0.011)); g.add(plane(W - 0.04, H - 0.04, corkMat(), 0, 0, 0.0222));
    const R = rng('memo'), cols = ['#f3e2a0', '#f4f1ea', '#a9c4d8', '#d4aaa3', '#bfe3c0'];
    const spots = [[-0.19, 0.1], [-0.05, 0.12], [0.13, 0.09], [-0.15, -0.09], [0.02, -0.08]];
    spots.forEach(([mx, my], i) => { const sz = 0.075 + R() * 0.03, m = box(sz, sz * (i === 2 ? 1.3 : 1), 0.001, std(cols[i], .85), mx * W / 0.6, my * H / 0.45, 0.023); m.rotation.z = (R() - 0.5) * 0.25; g.add(m); pin(g, i % 2 ? '#2f6db0' : '#b0392e', mx * W / 0.6, my * H / 0.45 + sz * 0.38, 0.026); });
    const ph = plane(0.1, 0.075, blurMat('cork'), 0.19 * W / 0.6, -0.07 * H / 0.45, 0.0235); ph.rotation.z = 0.08; g.add(ph); pin(g, '#c79a3c', 0.19 * W / 0.6, -0.035 * H / 0.45, 0.026);
    return fit(g, it);
  }
  g.add(box(W, H, 0.03, fr, 0, 0, 0.015)); g.add(plane(W - 0.05, H - 0.05, std('#f6f3ec', .85), 0, 0, 0.0305)); g.add(plane(W - 0.15, H - 0.17, abstractMat(acc, 'frame'), 0, 0.01, 0.031));
  return fit(g, it);
}

// ---- カレンダー ----
function himekuriMat(red) {
  return canvasMat(`hime|${red}`, 128, 160, (x, W, H) => {
    x.fillStyle = '#fbf9f4'; x.fillRect(0, 0, W, H); x.fillStyle = red; x.fillRect(0, 0, W, 22); x.fillStyle = '#ffffff'; x.font = 'bold 14px sans-serif'; x.textAlign = 'center'; x.fillText('10', W / 2, 16);
    x.fillStyle = '#2a2a2d'; x.font = 'bold 84px sans-serif'; x.textBaseline = 'middle'; x.fillText('28', W / 2, H * 0.55);
    x.fillStyle = '#8d9095'; x.fillRect(W * 0.3, H * 0.86, W * 0.4, 5); x.fillRect(W * 0.2, H * 0.92, W * 0.6, 3);
  });
}
function monthMat(red) {
  return canvasMat(`month|${red}`, 192, 288, (x, W, H) => {
    const R = rng('month'); x.fillStyle = '#fbf9f4'; x.fillRect(0, 0, W, H);
    const top = H * 0.5, gr = x.createLinearGradient(0, 0, 0, top); gr.addColorStop(0, '#c9d6e2'); gr.addColorStop(0.6, '#e8dcc8'); gr.addColorStop(0.62, '#8a9a82'); gr.addColorStop(1, '#6f8a7a'); x.fillStyle = gr; x.fillRect(8, 8, W - 16, top - 8);
    for (let i = 0; i < 4; i++) { const cx = 8 + R() * (W - 16), cy = top * (0.5 + R() * 0.4), r = 20 + R() * 30; const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, '#c79a3c88'); rg.addColorStop(1, '#c79a3c00'); x.fillStyle = rg; x.fillRect(8, 8, W - 16, top - 8); }
    x.fillStyle = '#2a2a2d'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.fillText('10', W / 2, top + 26);
    const gx = 12, gy = top + 40, cw = (W - 24) / 7, ch = (H - gy - 10) / 5; x.font = '11px sans-serif'; x.textBaseline = 'top';
    x.strokeStyle = '#d9d2c2'; x.lineWidth = 1; for (let r = 0; r <= 5; r++) { x.beginPath(); x.moveTo(gx, gy + r * ch); x.lineTo(W - gx, gy + r * ch); x.stroke(); }
    let d = 1; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { if (r === 0 && c < 3) continue; if (d > 31) break; x.fillStyle = c === 0 ? red : c === 6 ? '#2f6db0' : '#3a3b40'; x.fillText(String(d++), gx + c * cw + cw / 2, gy + r * ch + 3); }
  });
}
function calendarBuild(it) {
  const st = styleOf(it), s = st.id, [W, H] = st.size, g = new THREE.Group(), base = pm(it, 'base', .7), red = hexOf(partVal(it, 'accent'));
  if (s === 'month') {
    g.add(box(W, H, 0.004, std('#f4f1ea', .85), 0, 0, 0.002)); g.add(box(W, H, 0.002, base, 0, 0, 0.005)); g.add(plane(W, H, monthMat(red), 0, 0, 0.0061));
    g.add(box(W * 0.9, 0.008, 0.004, std('#8d9095', .4, .6), 0, H / 2 - 0.006, 0.008)); g.add(cyl(0.004, 0.004, 0.012, std('#c8ccd2', .3, .8), 0, H / 2 + 0.008, 0.006, 8).rotateX(Math.PI / 2));
    return fit(g, it);
  }
  g.add(box(W, H, 0.008, base, 0, 0, 0.004)); const pw = W * 0.8, ph = H * 0.6, py = -H / 2 + 0.015 + ph / 2;
  g.add(box(pw, ph, 0.012, std('#fbf9f4', .9), 0, py, 0.014)); g.add(plane(pw, ph, himekuriMat(red), 0, py, 0.0202));
  g.add(box(pw + 0.006, 0.012, 0.016, std('#3a3b40', .5), 0, py + ph / 2, 0.014));
  g.add(plane(W * 0.7, H * 0.18, abstractMat(red, 'poster'), 0, H / 2 - H * 0.15, 0.0081));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0015, 6, 14), std('#c8ccd2', .3, .8)); ring.position.set(0, H / 2 + 0.004, 0.004); g.add(ring);
  return fit(g, it);
}

// ---- 日用品(机の上の小物) ----
function remoteMat() {
  return canvasMat('remote', 48, 160, (x, W, H) => { x.fillStyle = '#26272b'; x.fillRect(0, 0, W, H); x.fillStyle = '#b0392e'; x.beginPath(); x.arc(W * 0.72, 14, 6, 0, 7); x.fill(); x.fillStyle = '#5a5c62'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { x.beginPath(); x.arc(W * (0.24 + c * 0.26), 48 + r * 15, 4.5, 0, 7); x.fill(); } x.fillStyle = '#6a6d74'; x.beginPath(); x.arc(W / 2, 122, 12, 0, 7); x.fill(); x.fillStyle = '#26272b'; x.beginPath(); x.arc(W / 2, 122, 5, 0, 7); x.fill(); });
}
function zakkaBuild(it) {
  const st = styleOf(it), s = st.id, g = new THREE.Group(), body = pm(it, 'body', .45), sub = pm(it, 'sub', .45);
  if (s === 'mug') {
    g.add(cyl(0.042, 0.04, 0.095, body, -0.012, 0.0475, 0, 24)); g.add(cyl(0.037, 0.037, 0.001, std('#4a3020', .2), -0.012, 0.0955, 0, 20));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0395, 0.0028, 6, 24), body); rim.rotation.x = Math.PI / 2; rim.position.set(-0.012, 0.095, 0); g.add(rim);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0055, 6, 12, Math.PI), body); h.rotation.z = -Math.PI / 2; h.position.set(0.03, 0.05, 0); h.castShadow = true; g.add(h);
  } else if (s === 'tissue') {
    g.add(box(0.24, 0.085, 0.12, body, 0, 0.0425, 0)); g.add(box(0.22, 0.002, 0.1, sub, 0, 0.0855, 0)); g.add(box(0.13, 0.002, 0.02, std('#d8d2c6', .9), 0, 0.087, 0));
    g.add(ell(0.035, std('#fbfbf8', .95), 0, 0.1, 0, 1.4, 0.75, 0.22)); g.add(ell(0.03, std('#fbfbf8', .95), 0.02, 0.095, 0.004, 1.1, 0.6, 0.2));
  } else if (s === 'remote') {
    g.add(box(0.048, 0.016, 0.175, body, 0, 0.008, 0)); const p = plane(0.042, 0.168, remoteMat(), 0, 0.0162, 0); p.rotation.x = -Math.PI / 2; g.add(p);
  } else if (s === 'phone') {
    g.add(box(0.075, 0.008, 0.155, body, 0, 0.004, 0)); const p = plane(0.069, 0.149, std('#121316', .12, .3), 0, 0.0081, 0); p.rotation.x = -Math.PI / 2; g.add(p);
  } else if (s === 'pens') {
    g.add(cyl(0.035, 0.033, 0.1, body, 0, 0.05, 0, 20)); g.add(cyl(0.031, 0.031, 0.001, std('#1d1d20', .9), 0, 0.1005, 0, 16));
    const cols = ['#2a2a2d', '#2f6db0', '#b0392e', '#c79a3c', '#e9e2cf']; [[-0.012, -0.008, 0.16, -0.12, 0.1], [0.01, 0.006, 0.165, 0.14, 0.08], [0.0, 0.014, 0.15, 0.03, -0.16], [-0.014, 0.01, 0.145, -0.16, -0.06], [0.014, -0.012, 0.155, 0.12, 0.15]].forEach(([x, z, top, tx, tz], i) => rod(g, std(cols[i], .5), [x, 0.01, z], [x + tx * 0.25, top, z + tz * 0.25], i === 3 ? 0.0045 : 0.0038, 6));
  } else if (s === 'mirror') {
    g.add(cyl(0.065, 0.07, 0.014, body, 0, 0.007, 0, 28)); g.add(cyl(0.006, 0.006, 0.14, body, 0, 0.08, -0.012, 10));
    const m = new THREE.Group(); m.position.set(0, 0.22, 0); m.rotation.x = -0.1; m.add(disc(0.092, 0.014, body, 0, 0, 0, 32)); m.add(circ(0.084, std('#e3eaee', .04, .95), 0, 0, 0.0072, 32)); g.add(m);
  } else if (s === 'headphones') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.008, 6, 20, Math.PI), body); band.position.set(0, 0.075, 0); band.castShadow = true; g.add(band);
    for (const sx of [-1, 1]) {
      g.add(box(0.008, 0.03, 0.012, sub, sx * 0.072, 0.06, 0));
      g.add(cyl(0.042, 0.042, 0.026, body, sx * 0.07, 0.044, 0, 22).rotateZ(Math.PI / 2)); g.add(cyl(0.036, 0.036, 0.012, sub, sx * 0.052, 0.044, 0, 18).rotateZ(Math.PI / 2));
    }
  }
  return fit(g, it, true);
}

// ---- ハンガーラック・コート掛け ----
// 上着(フックの位置 x,y,z から下がる。ry で向き、+z 側にふくらむ)
function coat(g, mat, x, y, z, ry, len) {
  const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
  const b = cyl(0.1, 0.15, len, mat, 0, -0.06 - len / 2, 0.08, 10); b.scale.z = 0.42; c.add(b);
  c.add(ell(0.11, mat, 0, -0.07, 0.08, 1.05, 0.4, 0.45));
  for (const sx of [-1, 1]) { const sl = cyl(0.035, 0.04, len * 0.72, mat, sx * 0.125, -0.08 - len * 0.36, 0.08, 8); sl.rotation.z = sx * 0.08; c.add(sl); }
  c.add(box(0.06, 0.035, 0.03, mat, 0, -0.03, 0.03));
}
// シャツ(ハンガーにかかった形。幅は z 方向)
function shirt(g, mat, hang, x, yBar, len, wide) {
  const c = new THREE.Group(); c.position.set(x, yBar, 0); g.add(c);
  const hk = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0025, 4, 10, Math.PI * 1.3), hang); hk.rotation.y = Math.PI / 2; hk.position.y = 0.0; c.add(hk);
  c.add(box(0.006, 0.006, 0.4, hang, 0, -0.07, 0)); rod(c, hang, [0, -0.02, 0], [0, -0.07, 0.19], 0.003, 4); rod(c, hang, [0, -0.02, 0], [0, -0.07, -0.19], 0.003, 4);
  c.add(box(0.035, len, wide, mat, 0, -0.08 - len / 2, 0)); c.add(box(0.036, 0.05, wide + 0.04, mat, 0, -0.1, 0));
  for (const sz of [-1, 1]) { const sl = box(0.034, len * 0.55, 0.07, mat, 0, -0.08 - len * 0.29, sz * (wide / 2 + 0.03)); sl.rotation.x = sz * 0.12; c.add(sl); }
}
function coatRackBuild(it) {
  const st = styleOf(it), s = st.id, [SW, SH, SD] = st.size, g = new THREE.Group(), fr = pm(it, 'frame', .45, .2), c1 = pm(it, 'coat', .9), c2 = pm(it, 'coat2', .9);
  if (s === 'rack') {
    const hx = SW / 2 - 0.02, ty = SH - 0.05;
    for (const sx of [-1, 1]) { g.add(box(0.025, ty - 0.06, 0.025, fr, sx * hx, 0.06 + (ty - 0.06) / 2, 0)); g.add(box(0.03, 0.03, SD - 0.04, fr, sx * hx, 0.07, 0)); for (const sz of [-1, 1]) g.add(cyl(0.025, 0.025, 0.02, std('#2a2a2d', .6), sx * hx, 0.026, sz * (SD / 2 - 0.04), 12).rotateZ(Math.PI / 2)); }
    g.add(cyl(0.013, 0.013, SW, fr, 0, ty, 0, 10).rotateZ(Math.PI / 2)); g.add(box(SW - 0.04, 0.02, 0.02, fr, 0, 0.13, 0));
    const R = rng('rack'), hang = std('#d6d9dc', .3, .7), n = 6;
    for (let i = 0; i < n; i++) { const x = -hx + 0.1 + i * (2 * hx - 0.2) / (n - 1) + (R() - 0.5) * 0.03, m = i === 0 ? c1 : i === 3 ? c2 : std(CALM[Math.floor(R() * CALM.length)], .9); shirt(g, m, hang, x, ty, 0.55 + R() * 0.45, 0.36 + R() * 0.06); }
    return fit(g, it);
  }
  g.add(cyl(0.17, 0.2, 0.03, fr, 0, 0.015, 0, 28)); g.add(cyl(0.018, 0.02, SH - 0.06, fr, 0, (SH - 0.06) / 2 + 0.02, 0, 12)); g.add(sph(0.03, fr, 0, SH - 0.04, 0));
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, ax = Math.sin(a), az = Math.cos(a); rod(g, fr, [0, SH - 0.2, 0], [ax * 0.13, SH - 0.1, az * 0.13], 0.008); g.add(sph(0.012, fr, ax * 0.13, SH - 0.1, az * 0.13)); }
  coat(g, c1, Math.sin(Math.PI / 4) * 0.1, SH - 0.13, Math.cos(Math.PI / 4) * 0.1, Math.PI / 4, 0.85); coat(g, c2, -Math.sin(Math.PI / 4) * 0.1, SH - 0.13, -Math.cos(Math.PI / 4) * 0.1, Math.PI * 1.25, 0.7);
  // 帽子
  const hat = std('#6b4a33', .85); g.add(cyl(0.11, 0.11, 0.008, hat, 0, SH - 0.06, 0, 20)); g.add(cyl(0.07, 0.075, 0.08, hat, 0, SH - 0.016, 0, 16));
  return fit(g, it);
}

// ---- 傘立て ----
function umbrella(g, mat, x, z, ax, az, len, crook) {
  const u = new THREE.Group(); u.position.set(x, 0.02, z); u.rotation.set(ax, 0, az); g.add(u);
  const metal = std('#c8ccd2', .3, .8); u.add(cyl(0.004, 0.002, 0.04, metal, 0, 0.02, 0, 6));
  u.add(cyl(0.03, 0.007, len * 0.66, mat, 0, 0.04 + len * 0.33, 0, 8)); u.add(box(0.012, 0.03, 0.066, mat, 0, 0.04 + len * 0.5, 0));
  const top = 0.04 + len * 0.66; u.add(cyl(0.005, 0.005, len * 0.24, metal, 0, top + len * 0.12, 0, 6));
  const hdl = std('#3b2a1e', .6), hy = top + len * 0.24;
  if (crook) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), hdl); h.position.set(0.03, hy, 0); h.castShadow = true; u.add(h); u.add(cyl(0.008, 0.008, 0.02, hdl, 0.06, hy - 0.01, 0, 8)); }
  else u.add(cyl(0.013, 0.011, 0.1, hdl, 0, hy + 0.05, 0, 10));
}
function umbrellaBuild(it) {
  const st = styleOf(it), s = st.id, [SW, , SD] = st.size, g = new THREE.Group(), body = pm(it, 'body', .5, .2), dark = std('#1d1d20', .9), sh = 0.45;
  if (s === 'square') { const t = 0.012; for (const sx of [-1, 1]) { g.add(box(t, sh, SD, body, sx * (SW / 2 - t / 2), sh / 2, 0)); g.add(box(SW - 2 * t, sh, t, body, 0, sh / 2, sx * (SD / 2 - t / 2))); } g.add(box(SW, 0.02, SD, body, 0, 0.01, 0)); g.add(box(SW - 0.03, 0.002, SD - 0.03, dark, 0, sh - 0.12, 0)); }
  else { const r = Math.min(SW, SD) / 2; g.add(cyl(r, r * 0.92, sh, body, 0, sh / 2, 0, 28)); g.add(cyl(r - 0.012, r - 0.012, 0.002, dark, 0, sh - 0.002, 0, 24)); const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.005, 0.006, 6, 28), body); rim.rotation.x = Math.PI / 2; rim.position.y = sh; g.add(rim); }
  umbrella(g, pm(it, 'umb', .7), -0.03, -0.025, -0.1, 0.12, 0.82, true);
  umbrella(g, std('#8a9a82', .7), 0.035, -0.02, -0.12, -0.14, 0.78, false);
  umbrella(g, new THREE.MeshStandardMaterial({ color: '#e6ecee', roughness: .2, transparent: true, opacity: .6 }), 0.0, 0.035, 0.16, 0.04, 0.8, true);
  return fit(g, it);
}

// ---- 段ボール箱 ----
function cbox(g, w, h, d, x, y, z, ry, mat, tape) {
  const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
  b.add(box(w, h, d, mat, 0, h / 2, 0)); b.add(box(w + 0.002, 0.0015, 0.05, tape, 0, h + 0.0008, 0));
  for (const sx of [-1, 1]) b.add(box(0.0015, 0.07, 0.05, tape, sx * (w / 2 + 0.0008), h - 0.035, 0));
  b.add(box(w, 0.001, 0.002, std('#7a5a38', .9), 0, h + 0.0005, 0)); b.add(plane(Math.min(0.12, w * 0.3), Math.min(0.08, h * 0.3), std('#f4f1ea', .8), w * 0.22, h * 0.55, d / 2 + 0.001));
}
function cardboardBuild(it) {
  const st = styleOf(it), s = st.id, g = new THREE.Group(), m = pm(it, 'box', .9), tape = pm(it, 'tape', .4);
  if (s === 'stack') { cbox(g, 0.5, 0.32, 0.42, 0, 0, 0, 0, m, tape); cbox(g, 0.42, 0.24, 0.34, 0.02, 0.32, -0.01, 0.12, m, tape); cbox(g, 0.3, 0.16, 0.24, -0.03, 0.56, 0.02, -0.18, m, tape); return fit(g, it); }
  cbox(g, 0.45, 0.32, 0.35, 0, 0, 0, 0, m, tape); return fit(g, it);
}

// ---- ラジカセ ----
function radioBuild(it) {
  const g = new THREE.Group(), body = pm(it, 'body', .45, .2), sp = pm(it, 'sub', .9), dark = std('#1d1d20', .3), W = 0.4, H = 0.2, D = 0.11;
  g.add(box(W, H, D, body, 0, H / 2, 0));
  for (const sx of [-1, 1]) { g.add(disc(0.062, 0.004, sp, sx * 0.12, 0.1, D / 2 + 0.002, 24)); g.add(disc(0.025, 0.006, std('#4b4e54', .5), sx * 0.12, 0.1, D / 2 + 0.003, 16)); }
  g.add(box(0.11, 0.065, 0.004, dark, 0, 0.11, D / 2 + 0.002)); g.add(box(0.07, 0.025, 0.003, std('#c9b98f', .6), 0, 0.11, D / 2 + 0.004));
  for (let i = 0; i < 5; i++) g.add(box(0.016, 0.008, 0.02, std(i === 0 ? '#b0392e' : '#3a3b40', .5), -0.04 + i * 0.02, H + 0.004, 0.03));
  const hm = std('#3a3b40', .4, .6); rod(g, hm, [-0.15, H, 0], [-0.15, H + 0.04, 0], 0.006); rod(g, hm, [0.15, H, 0], [0.15, H + 0.04, 0], 0.006); rod(g, hm, [-0.15, H + 0.04, 0], [0.15, H + 0.04, 0], 0.008);
  return fit(g, it, true);
}

// ---- 壁のフック(バッグ・帽子) ----
function wallHookBuild(it) {
  const [W, H] = KOMONO.wallHook.size, g = new THREE.Group(), bd = pm(it, 'board', .5), bag = pm(it, 'bag', .9), metal = std('#2b2b2e', .4, .6), ty = H / 2 - 0.035;
  g.add(box(W, 0.07, 0.02, bd, 0, ty, 0.01));
  const hx = [-W * 0.3, 0, W * 0.3]; for (const x of hx) { rod(g, metal, [x, ty - 0.01, 0.02], [x, ty - 0.02, 0.07], 0.005); rod(g, metal, [x, ty - 0.02, 0.07], [x, ty + 0.005, 0.085], 0.005); }
  // トートバッグ(左のフック)
  const bx = hx[0], by = ty - 0.2; g.add(box(0.26, 0.3, 0.05, bag, bx, by - 0.08, 0.06));
  for (const sx of [-1, 1]) rod(g, bag, [bx + sx * 0.07, by + 0.07, 0.06], [bx, ty - 0.012, 0.072], 0.007);
  // 帽子(右のフック)
  const hat = pm(it, 'hat', .85), cx = hx[2], cy = ty - 0.1; const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hat); cap.rotation.x = Math.PI / 2; cap.position.set(cx, cy, 0.03); cap.castShadow = true; g.add(cap);
  const brim = cyl(0.06, 0.06, 0.006, hat, cx, cy - 0.07, 0.07, 16); brim.scale.z = 0.8; g.add(brim);
  return fit(g, it);
}

// ---- 卓上ライト ----
function deskLampBuild(it) {
  const g = new THREE.Group(), body = pm(it, 'body', .4, .4), shade = pm(it, 'shade', .5, .2), on = it.opts.on !== false;
  g.add(cyl(0.07, 0.075, 0.02, body, 0, 0.01, -0.03, 24)); rod(g, body, [0, 0.02, -0.03], [0, 0.27, -0.06], 0.007); g.add(sph(0.012, body, 0, 0.27, -0.06)); rod(g, body, [0, 0.27, -0.06], [0, 0.35, 0.07], 0.007);
  const sh = new THREE.Group(); sh.position.set(0, 0.34, 0.09); sh.rotation.x = 0.5; g.add(sh);
  sh.add(cyl(0.022, 0.065, 0.085, shade, 0, 0, 0, 20)); sh.add(cyl(0.0618, 0.0618, 0.002, std('#f1ede4', .9), 0, -0.042, 0, 20));
  if (on) { sh.add(sph(0.022, emissive('#ffe2b8', 2.2), 0, -0.035, 0)); light(g, '#ffe2b8', 0.9, 0, 0.27, 0.15, { distance: 1.6 }); }
  return fit(g, it, true);
}

export const KOMONO = {
  wallClock: { name: '掛け時計', emoji: '🕰️', cat: '壁かざり', kind: 'wall', size: [0.3, 0.3, 0.05], range: { w: [0.15, 0.8], h: [0.15, 1.2], d: [0.02, 0.15] }, color: 'f_black', opts: {}, words: ['掛け時計', '壁掛け時計', 'かけ時計', '壁の時計'],
    parts: [{ key: 'rim', name: '縁', pal: 'wood', def: 'f_black' }, { key: 'face', name: '文字盤', pal: 'color', def: '#f4f2ec' }, { key: 'hand', name: '針・数字', pal: 'color', def: '#2a2a2d' }],
    styles: [
      { id: 'round', name: '丸い掛け時計', size: [0.3, 0.3, 0.05], words: ['丸い時計', '丸い掛け時計'] },
      { id: 'square', name: '四角い掛け時計', size: [0.28, 0.28, 0.05], words: ['四角い時計', '四角い掛け時計'], parts: { rim: 'f_white', face: '#f7f6f2', hand: '#3a3b40' } },
      { id: 'wood', name: '木の縁の丸い時計', size: [0.36, 0.36, 0.05], words: ['木の時計', '木の縁', '木枠の時計'], parts: { rim: 'w_natural', face: '#f1ead8', hand: '#3b2a1e' } },
      { id: 'pendulum', name: '振り子つき掛け時計', size: [0.26, 0.56, 0.09], words: ['振り子', 'ふりこ', '振り子時計'], parts: { rim: 'w_walnut', face: '#f1ead8', hand: '#1d1d1f' } },
    ],
    build: wallClockBuild },
  deskClock: { name: '置き時計', emoji: '⏰', cat: '小物', kind: 'floor', size: [0.13, 0.16, 0.07], range: { w: [0.06, 0.5], h: [0.04, 0.6], d: [0.03, 0.3] }, color: '#7d93a8', opts: { lift: 0 }, words: ['置き時計', '目覚まし時計', '目覚まし', '卓上時計'],
    parts: [{ key: 'body', name: '本体', pal: 'door', def: '#7d93a8' }, { key: 'face', name: '文字盤', pal: 'color', def: '#f4f2ec' }, { key: 'hand', name: '針・数字', pal: 'color', def: '#2a2a2d' }],
    styles: [
      { id: 'alarm', name: '目覚まし(ベル2つ)', size: [0.13, 0.16, 0.07], words: ['目覚まし', 'ベル'] },
      { id: 'digital', name: '四角いデジタル時計', size: [0.16, 0.075, 0.07], words: ['デジタル', 'デジタル時計'], parts: { body: 'f_charcoal', hand: '#ffb35c' } },
      { id: 'wood', name: '木の置き時計', size: [0.14, 0.2, 0.08], words: ['木の置き時計', '木の時計'], parts: { body: 'w_medium', face: '#f1ead8', hand: '#2a2a2d' } },
    ],
    params: [LIFT], build: deskClockBuild },
  books: { name: '本', emoji: '📚', cat: '小物', kind: 'floor', size: [0.26, 0.2, 0.2], range: { w: [0.1, 1.2], h: [0.02, 0.5], d: [0.1, 0.4] }, color: '#2f3d5c', opts: { lift: 0 }, words: ['本', '本の山', '雑誌', '本を置いて'],
    parts: [{ key: 'cover', name: '本の色(1冊)', pal: 'color', def: '#2f3d5c' }, { key: 'end', name: 'ブックエンド', pal: 'metal', def: 'm_black' }],
    styles: [
      { id: 'stack', name: '平積みの本', size: [0.26, 0.2, 0.2], words: ['平積み', '積んだ本', '本の山'] },
      { id: 'row', name: '立てて並べた本(ブックエンド)', size: [0.42, 0.25, 0.18], words: ['並べた本', 'ブックエンド', '本を立てて'], parts: { cover: '#a8392f' } },
      { id: 'open', name: '開いた本', size: [0.34, 0.03, 0.24], words: ['開いた本', '読みかけ'], parts: { cover: '#6b4a33' } },
    ],
    params: [LIFT], build: booksBuild },
  photoFrame: { name: '写真立て', emoji: '🖼️', cat: '小物', kind: 'floor', size: [0.13, 0.18, 0.09], range: { w: [0.06, 0.6], h: [0.06, 0.6], d: [0.03, 0.25] }, color: 'w_natural', opts: { lift: 0 }, words: ['写真立て', 'フォトフレーム', '写真たて'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_natural' }],
    styles: [
      { id: 'tate', name: '写真立て(縦)', size: [0.13, 0.18, 0.09], words: ['縦の写真立て'] },
      { id: 'yoko', name: '写真立て(横)', size: [0.18, 0.135, 0.08], words: ['横の写真立て'], parts: { frame: 'f_white' } },
      { id: 'double', name: '2枚の写真立て', size: [0.28, 0.18, 0.1], words: ['2枚', '二枚', '2連', '二連'], parts: { frame: 'w_walnut' } },
    ],
    params: [LIFT], build: photoBuild },
  wallArt: { name: '壁の額・ポスター', emoji: '🖼️', cat: '壁かざり', kind: 'wall', size: [0.5, 0.65, 0.035], range: { w: [0.15, 2.0], h: [0.15, 2.0], d: [0.005, 0.08] }, color: 'w_walnut', opts: {}, words: ['ポスター', 'コルクボード', '額縁', 'アートの額', '壁の額'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_walnut' }, { key: 'art', name: '絵の色', pal: 'color', def: '#c79a3c' }],
    styles: [
      { id: 'frame', name: '額(抽象的な絵)', size: [0.5, 0.65, 0.035], words: ['額', '額縁', 'アート'] },
      { id: 'poster', name: 'ポスター(画びょう留め)', size: [0.42, 0.594, 0.008], words: ['ポスター', '画びょう'], parts: { art: '#a8392f' } },
      { id: 'cork', name: 'コルクボード(メモつき)', size: [0.6, 0.45, 0.03], words: ['コルクボード', 'メモ', '掲示板'], parts: { frame: 'w_natural' } },
    ],
    build: wallArtBuild },
  calendar: { name: 'カレンダー', emoji: '📅', cat: '壁かざり', kind: 'wall', size: [0.16, 0.26, 0.025], range: { w: [0.08, 0.8], h: [0.1, 1.0], d: [0.004, 0.05] }, color: 'w_light', opts: {}, words: ['カレンダー', '日めくり', '暦'],
    parts: [{ key: 'base', name: '台紙', pal: 'door', def: 'w_light' }, { key: 'accent', name: '日曜・飾りの色', pal: 'color', def: '#b0392e' }],
    styles: [
      { id: 'day', name: '日めくりカレンダー', size: [0.16, 0.26, 0.025], words: ['日めくり'] },
      { id: 'month', name: '月めくりカレンダー', size: [0.32, 0.48, 0.01], words: ['月めくり', '壁掛けカレンダー'], parts: { base: 'f_offwhite' } },
    ],
    build: calendarBuild },
  zakka: { name: '日用品(机の上)', emoji: '☕', cat: '小物', kind: 'floor', size: [0.12, 0.1, 0.085], range: { w: [0.03, 0.6], h: [0.005, 0.6], d: [0.03, 0.6] }, color: '#e9e2cf', opts: { lift: 0 }, words: ['マグカップ', 'ティッシュ', 'リモコン', 'スマホ', 'ペン立て', '卓上ミラー', 'ヘッドホン', '日用品'],
    parts: [{ key: 'body', name: '本体', pal: 'color', def: '#e9e2cf' }, { key: 'sub', name: 'もう一つの色', pal: 'color', def: '#3a3b40' }],
    styles: [
      { id: 'mug', name: 'マグカップ', size: [0.12, 0.1, 0.085], words: ['マグカップ', 'マグ', 'コーヒーカップ'] },
      { id: 'tissue', name: 'ティッシュ箱', size: [0.24, 0.11, 0.12], words: ['ティッシュ', 'ティッシュ箱'], parts: { body: '#f4f1ea', sub: '#8a9a82' } },
      { id: 'remote', name: 'リモコン', size: [0.05, 0.02, 0.18], words: ['リモコン'], parts: { body: '#2a2a2d' } },
      { id: 'phone', name: 'スマホ', size: [0.075, 0.009, 0.155], words: ['スマホ', 'スマートフォン', '携帯電話'], parts: { body: '#4b4e54' } },
      { id: 'pens', name: 'ペン立て', size: [0.08, 0.17, 0.08], words: ['ペン立て', '鉛筆立て'], parts: { body: '#6b4a33' } },
      { id: 'mirror', name: '卓上ミラー', size: [0.19, 0.32, 0.14], words: ['卓上ミラー', '卓上鏡', '手鏡'], parts: { body: '#d6d9dc' } },
      { id: 'headphones', name: 'ヘッドホン', size: [0.19, 0.16, 0.09], words: ['ヘッドホン', 'ヘッドフォン'], parts: { body: '#2a2a2d', sub: '#4b4e54' } },
    ],
    params: [LIFT], build: zakkaBuild },
  coatRack: { name: 'コート掛け・ハンガーラック', emoji: '🧥', cat: '家具', kind: 'floor', size: [0.5, 1.75, 0.5], range: { w: [0.3, 2.0], h: [0.8, 2.0], d: [0.3, 0.8] }, color: 'w_walnut', opts: {}, words: ['コート掛け', 'ポールハンガー', 'ハンガーラック', '洋服掛け', 'コートハンガー'],
    parts: [{ key: 'frame', name: 'わく・ポール', pal: 'wood', def: 'w_walnut' }, { key: 'coat', name: '上着の色', pal: 'color', def: '#3f4a5c' }, { key: 'coat2', name: 'もう一着の色', pal: 'color', def: '#b8afa3' }],
    styles: [
      { id: 'pole', name: 'ポールハンガー(上着2着)', size: [0.5, 1.75, 0.5], words: ['ポールハンガー', 'コート掛け', 'コートハンガー'] },
      { id: 'rack', name: 'キャスターつきハンガーラック', size: [1.0, 1.55, 0.45], words: ['ハンガーラック', 'キャスター', '洋服ラック'], parts: { frame: 'm_black', coat: '#e9e2cf', coat2: '#2f3d5c' } },
    ],
    build: coatRackBuild },
  umbrellaStand: { name: '傘立て', emoji: '☂️', cat: '小物', kind: 'floor', size: [0.26, 0.9, 0.26], range: { w: [0.15, 0.6], h: [0.3, 1.2], d: [0.15, 0.6] }, color: '#4b4e54', opts: {}, words: ['傘立て', 'かさ立て', '傘'],
    parts: [{ key: 'body', name: '傘立て', pal: 'color', def: '#4b4e54' }, { key: 'umb', name: '傘の色', pal: 'color', def: '#2f3d5c' }],
    styles: [
      { id: 'round', name: '丸い傘立て', size: [0.26, 0.9, 0.26], words: ['丸い傘立て'] },
      { id: 'square', name: '四角い傘立て', size: [0.24, 0.9, 0.24], words: ['四角い傘立て'], parts: { body: '#e9e2cf', umb: '#a8392f' } },
    ],
    build: umbrellaBuild },
  cardboard: { name: '段ボール箱', emoji: '📦', cat: '小物', kind: 'floor', size: [0.45, 0.32, 0.35], range: { w: [0.15, 1.2], h: [0.1, 1.5], d: [0.15, 1.0] }, color: '#c49a6c', opts: {}, words: ['段ボール', 'ダンボール', '段ボール箱', '引っ越しの箱'],
    parts: [{ key: 'box', name: '箱', pal: 'color', def: '#c49a6c' }, { key: 'tape', name: 'テープ', pal: 'color', def: '#d8c9a8' }],
    styles: [
      { id: 'one', name: '段ボール1箱', size: [0.45, 0.32, 0.35], words: ['段ボール1箱'] },
      { id: 'stack', name: '積んだ段ボール(3箱)', size: [0.5, 0.72, 0.42], words: ['積んだ段ボール', '引っ越し', '積んだ'] },
    ],
    build: cardboardBuild },
  radio: { name: 'ラジカセ', emoji: '📻', cat: '小物', kind: 'floor', size: [0.4, 0.25, 0.12], range: { w: [0.2, 0.8], h: [0.1, 0.5], d: [0.06, 0.3] }, color: '#c9cbcd', opts: { lift: 0 }, words: ['ラジカセ', 'ラジオ', 'カセット'],
    parts: [{ key: 'body', name: '本体', pal: 'color', def: '#c9cbcd' }, { key: 'sub', name: 'スピーカー', pal: 'color', def: '#2a2a2d' }],
    params: [LIFT], build: radioBuild },
  wallHook: { name: '壁のフック(バッグ・帽子)', emoji: '👜', cat: '壁かざり', kind: 'wall', size: [0.5, 0.5, 0.12], range: { w: [0.3, 1.2], h: [0.3, 0.8], d: [0.05, 0.25] }, color: 'w_natural', opts: {}, words: ['フック', '壁のフック', 'ウォールフック', 'バッグ掛け'],
    parts: [{ key: 'board', name: '板', pal: 'wood', def: 'w_natural' }, { key: 'bag', name: 'バッグ', pal: 'color', def: '#d8c8ad' }, { key: 'hat', name: '帽子', pal: 'color', def: '#3f5546' }],
    build: wallHookBuild },
  deskLamp: { name: '卓上ライト', emoji: '💡', cat: '照明', kind: 'floor', size: [0.16, 0.4, 0.26], range: { w: [0.1, 0.4], h: [0.2, 0.8], d: [0.12, 0.5] }, color: '#2a2a2d', opts: { lift: 0, on: true }, words: ['卓上ライト', 'デスクライト', 'デスクランプ', '机のライト', 'スタンドライト'],
    parts: [{ key: 'body', name: '本体', pal: 'color', def: '#2a2a2d' }, { key: 'shade', name: 'かさ', pal: 'color', def: '#2a2a2d' }],
    params: [LIFT, ['on', '点ける', 'bool']], build: deskLampBuild },
};
