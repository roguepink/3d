// 和の家具・道具(ちゃぶ台・座布団・仏壇・掘りごたつ・柱時計・黒電話 など)。昭和の和風の家を作るため
// 書き方は furniture.js と同じ(styles / parts / params / build)
// ねらい:映える古民家ではなく、昭和〜平成に暮らしてきた普通の家。色は使い込んだ木(濃い茶・あめ色)と くすんだ布
// 向き:正面が +z。床の物は y=0 から上。壁の物(kind:'wall')は y=中心、背中が z=0 で +z が部屋側。天井の物は y=0 が天井で下へ
import * as THREE from 'three';
import { std, box, cyl, sph, emissive, rbox, pm, partVal, styleOf, fabric, light, WARM } from './kit.js';

// ---- 共通 ----
const C4 = [[-1, -1], [1, -1], [-1, 1], [1, 1]], UP = new THREE.Vector3(0, 1, 0);
const LIFT = ['lift', '床からの高さ(ちゃぶ台・たんすの上など)', 0, 1.2, 'mm'];
const ell = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = sph(r, mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
// a から b へ渡す棒(round=true で丸棒)
function rod(g, mat, a, b, t, round = false) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va), len = dir.length();
  const m = round ? cyl(t / 2, t / 2, len, mat, 0, 0, 0, 8) : box(t, len, t, mat); m.position.copy(va.add(vb).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(UP, dir.normalize()); g.add(m); return m;
}
// 形の見本の大きさで作って、置いた大きさに合わせてのばす(lift で持ち上げる)
function fit(inner, it, sw, sh, sd) { const g = new THREE.Group(); inner.scale.set(it.w / sw, it.h / sh, it.d / sd); inner.position.y = it.opts.lift || 0; g.add(inner); return g; }
function fitStyle(inner, it) { const s = styleOf(it).size; return fit(inner, it, s[0], s[1], s[2]); }
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
// 絵を描いた材質(掛け軸の絵・掘りごたつの暗がり など)
const texCache = new Map();
function paint(key, w, h, draw, rough = .85, extra = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, ...extra }); texCache.set(key, m); return m;
}
// 板(正面 +z を向いた薄い面)
function plane(w, h, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z); }
// 床に寝かせた面(上を向く)
function floorPlane(w, d, mat, y = 0.002) { const m = mesh(new THREE.PlaneGeometry(w, d), mat, 0, y, 0); m.rotation.x = -Math.PI / 2; m.castShadow = false; return m; }
// 四角いすそ(こたつ布団のたれ):上の半分の大きさ (tx,tz) から下 (bx,bz) へ、ふっくら広がる
function skirt(tx, tz, bx, bz, y0, y1, mat) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 4, 4, true, Math.PI / 4), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) + 0.5, e = 1 - (1 - t) * (1 - t) * 0.6 - t * 0.4 * (1 - t); const k = Math.min(1, Math.max(0, e)); p.setXYZ(i, Math.sign(p.getX(i)) * (bx + (tx - bx) * Math.pow(t, 0.55)), y0 + (y1 - y0) * t, Math.sign(p.getZ(i)) * (bz + (tz - bz) * Math.pow(t, 0.55))); void k; }
  geo.computeVertexNormals(); const m = mesh(geo, mat); m.material = mat; return m;
}
const dbl = (color, rough = .8, extra = {}) => std(color, rough, 0, { side: THREE.DoubleSide, ...extra });
const GLASS = () => std('#cfdde0', .08, 0, { transparent: true, opacity: 0.28 });
const MIRROR = () => std('#d4dde2', .04, .95);

// ---- ちゃぶ台・座卓 ----
// 部分:天板 / 脚・幕板
function chabudaiBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, top = pm(it, 'top', .45), leg = pm(it, 'legs', .5), dark = std('#2a1d14', .7);
  if (s === 'round') {
    const r = Math.min(w, d) / 2, th = 0.025; g.add(cyl(r, r - 0.004, th, top, 0, h - th / 2, 0, 40));
    g.add(cyl(r * 0.86, r * 0.86, 0.045, leg, 0, h - th - 0.0225, 0, 32));
    for (const [x, z] of C4) { const lx = x * r * 0.42, lz = z * r * 0.42; g.add(box(0.035, h - th - 0.04, 0.035, leg, lx, (h - th - 0.04) / 2, lz)); g.add(box(0.05, 0.012, 0.05, dark, lx, h - th - 0.05, lz)); }
    // 折りたたみの横木
    for (const sx of [-1, 1]) g.add(box(0.025, 0.03, r * 0.84, leg, sx * r * 0.42, h - th - 0.08, 0));
  } else if (s === 'tenban') {
    g.add(box(w, h, d, top, 0, h / 2, 0)); g.add(box(w - 0.02, 0.004, d - 0.02, std('#3a2a1e', .5), 0, h + 0.001, 0));
  } else {
    const th = 0.03, ap = 0.05, ins = 0.05; g.add(box(w, th, d, top, 0, h - th / 2, 0));
    g.add(box(w - ins * 2 + 0.03, ap, d - ins * 2 + 0.03, leg, 0, h - th - ap / 2, 0));
    for (const [x, z] of C4) { const lw = 0.055; g.add(box(lw, h - th, lw, leg, x * (w / 2 - ins), (h - th) / 2, z * (d / 2 - ins))); }
  }
  const out = new THREE.Group(); g.position.y = it.opts.lift || 0; out.add(g); return out;
}

// ---- こたつ ----
// 部分:こたつ布団(布) / 天板 / わく・脚
function kotatsuFuton(g, it, w, d, y, floorY = 0) {
  const cov = fabric(it, 1, 1);
  g.add(rbox(w + 0.12, 0.05, d + 0.12, 0.02, cov, 0, y, 0));
  g.add(skirt(w / 2 + 0.06, d / 2 + 0.06, w / 2 + 0.36, d / 2 + 0.36, floorY, y, cov));
}
function kotatsuBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, top = pm(it, 'top', .4), fr = pm(it, 'frame', .5), futon = !!it.opts.futon;
  const th = 0.03;
  if (s === 'hori') {
    // 掘りごたつ:畳に切った穴の木の縁+中の暗がり(下に下がって見えるように、ふちが明るく真ん中が暗い絵)+上に天板
    const rim = 0.07, ow = w, od = d, iw = ow - rim * 2, id = od - rim * 2;
    for (const sz of [-1, 1]) g.add(box(ow, 0.018, rim, fr, 0, 0.009, sz * (od / 2 - rim / 2)));
    for (const sx of [-1, 1]) g.add(box(rim, 0.018, id, fr, sx * (ow / 2 - rim / 2), 0.009, 0));
    const pit = paint('horiPit', 256, 256, (c, W, H) => {
      c.fillStyle = '#070605'; c.fillRect(0, 0, W, H);
      // 内側の壁(手前と奥で明るさを変える)
      const band = 46; const grd = (x0, y0, x1, y1, a, b) => { const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
      c.fillStyle = grd(0, 0, 0, band, '#4a3a2c', '#100c09'); c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W - band, band); c.lineTo(band, band); c.fill();
      c.fillStyle = grd(0, H, 0, H - band, '#2e241b', '#0b0907'); c.beginPath(); c.moveTo(0, H); c.lineTo(W, H); c.lineTo(W - band, H - band); c.lineTo(band, H - band); c.fill();
      c.fillStyle = grd(0, 0, band, 0, '#3a2d22', '#0d0a08'); c.beginPath(); c.moveTo(0, 0); c.lineTo(band, band); c.lineTo(band, H - band); c.lineTo(0, H); c.fill();
      c.fillStyle = grd(W, 0, W - band, 0, '#3a2d22', '#0d0a08'); c.beginPath(); c.moveTo(W, 0); c.lineTo(W - band, band); c.lineTo(W - band, H - band); c.lineTo(W, H); c.fill();
      // 底のヒーターの網(うっすら)
      c.strokeStyle = 'rgba(90,80,70,.35)'; c.lineWidth = 2; for (let i = 0; i <= 6; i++) { const t = 100 + i * 9; c.beginPath(); c.moveTo(t, 100); c.lineTo(t, 154); c.stroke(); c.beginPath(); c.moveTo(100, t); c.lineTo(154, t); c.stroke(); }
    }, .95);
    g.add(floorPlane(iw, id, pit, 0.004));
    // 天板:ふちに乗るわく+板
    const tw = iw * 0.86, td = id * 0.84;
    // 脚は穴の中へ下りていく(下は暗がりに消える)
    for (const [x, z] of C4) g.add(box(0.045, h - th - 0.004, 0.045, fr, x * (tw / 2 - 0.04), 0.004 + (h - th - 0.004) / 2, z * (td / 2 - 0.04)));
    g.add(box(tw - 0.06, 0.05, td - 0.06, fr, 0, h - th - 0.025, 0));
    if (futon) { kotatsuFuton(g, it, tw - 0.06, td - 0.06, h - th - 0.02, 0.0); }
    g.add(box(tw, th, td, top, 0, h - th / 2 + (futon ? 0.02 : 0), 0));
    return g;
  }
  // 家具調こたつ
  const ap = 0.07, lw = 0.065;
  for (const [x, z] of C4) g.add(box(lw, h - th, lw, fr, x * (w / 2 - lw / 2 - 0.01), (h - th) / 2, z * (d / 2 - lw / 2 - 0.01)));
  g.add(box(w - 0.02, ap, d - 0.02, fr, 0, h - th - ap / 2, 0));
  g.add(box(0.3, 0.06, 0.3, std('#2a2522', .6), 0, h - th - ap - 0.03, 0)); g.add(box(0.26, 0.004, 0.26, emissive('#6a2a14', it.opts.heat ? 1.2 : 0.05), 0, h - th - ap - 0.061, 0));
  if (futon) kotatsuFuton(g, it, w - 0.02, d - 0.02, h - th - 0.02);
  g.add(box(w, th, d, top, 0, h - th / 2 + (futon ? 0.02 : 0), 0));
  return g;
}

// ---- 座布団 ----
// 部分:側地(布) / 房。柄は形「柄(かすり)」で、色は側地の色
function kasuri(color) {
  const m = paint('kasuri' + color, 128, 128, (c, W, H) => { c.fillStyle = color; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(235,228,212,.55)';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 32 + (y % 2) * 16 + 8, cy = y * 32 + 12; c.fillRect(cx - 7, cy - 1.5, 14, 3); c.fillRect(cx - 1.5, cy - 7, 3, 14); }
    c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 60; i++) c.fillRect((i * 37) % W, (i * 53) % H, 2, 1); }, .95);
  m.map.repeat.set(5, 5); return m;
}
function zabutonBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, tas = pm(it, 'tassel', .8);
  const cov = s === 'gara' ? kasuri(partVal(it, 'cover')) : fabric(it, 1, 1);
  g.add(rbox(w, h * 0.7, d, Math.min(0.025, h * 0.33), cov, 0, h * 0.35, 0));
  g.add(ell(1, cov, 0, h * 0.6, 0, w * 0.44, h * 0.4, d * 0.44));
  for (const [x, z] of C4) { g.add(ell(0.012, tas, x * (w / 2 - 0.004), h * 0.36, z * (d / 2 - 0.004), 1, 0.8, 1)); g.add(cyl(0.004, 0.009, 0.035, tas, x * (w / 2 + 0.008), h * 0.32, z * (d / 2 + 0.008), 6)); }
  g.add(cyl(0.012, 0.012, 0.008, tas, 0, h - 0.002, 0, 10));
  return g;
}

// ---- 座椅子・脇息 ----
// 部分:座面・背(布) / わく
function zaisuBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, seat = fabric(it, 1, 1), fr = pm(it, 'frame', .5);
  if (s === 'kyousoku') {
    // 脇息:ひじを置く台(上に布の当て)
    g.add(rbox(0.6, 0.06, 0.16, 0.025, seat, 0, 0.29, 0)); g.add(box(0.56, 0.025, 0.12, fr, 0, 0.255, 0));
    for (const sx of [-1, 1]) { g.add(box(0.04, 0.22, 0.05, fr, sx * 0.2, 0.135, 0)); g.add(box(0.12, 0.025, 0.2, fr, sx * 0.2, 0.0125, 0)); }
    return fitStyle(g, it);
  }
  g.add(rbox(0.5, 0.09, 0.48, 0.035, seat, 0, 0.045 + 0.01, 0.1)); g.add(box(0.48, 0.012, 0.46, fr, 0, 0.006, 0.1));
  const bk = new THREE.Group(); bk.position.set(0, 0.05, -0.12); bk.rotation.x = -0.38; bk.add(box(0.46, 0.5, 0.02, fr, 0, 0.27, -0.045)); bk.add(rbox(0.48, 0.52, 0.08, 0.035, seat, 0, 0.28, 0)); bk.add(rbox(0.4, 0.12, 0.06, 0.03, seat, 0, 0.5, 0.04)); g.add(bk);
  if (s === 'hiji') for (const sx of [-1, 1]) { g.add(rbox(0.07, 0.07, 0.4, 0.03, seat, sx * 0.27, 0.2, 0.08)); g.add(box(0.05, 0.15, 0.05, fr, sx * 0.27, 0.09, 0.2)); g.add(box(0.05, 0.15, 0.05, fr, sx * 0.27, 0.09, -0.05)); }
  return fitStyle(g, it);
}

// ---- 仏壇 ----
// 部分:本体 / 中(金色)。扉は opts.open で開け閉め。宗派を決めない、控えめな形
function butsudanBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, body = pm(it, 'body', .35), gold = pm(it, 'inner', .35, .75), blk = std('#141110', .3), dark = std('#1c120c', .7), kn = std('#b08a3e', .3, .8);
  const ue = s === 'uwaoki', W = ue ? 0.42 : 0.55, H = ue ? 0.62 : 1.4, D = ue ? 0.34 : 0.5;
  const y0 = ue ? 0.05 : 0.6, top = H - 0.05, fz = D / 2;
  // 下:台(引き出し+開き戸)
  if (!ue) {
    g.add(box(W, 0.06, D, body, 0, 0.03, 0)); g.add(box(W - 0.02, y0 - 0.06, D - 0.02, body, 0, 0.06 + (y0 - 0.06) / 2, -0.01));
    g.add(box(W - 0.06, 0.1, 0.012, body, 0, y0 - 0.07, fz - 0.014)); g.add(box(0.06, 0.012, 0.012, kn, 0, y0 - 0.07, fz - 0.004));
    for (const sx of [-1, 1]) { g.add(box((W - 0.07) / 2, y0 - 0.22, 0.012, body, sx * (W - 0.06) / 4, 0.06 + (y0 - 0.22) / 2 + 0.02, fz - 0.014)); g.add(box(0.008, 0.04, 0.012, kn, sx * 0.025, 0.3, fz - 0.004)); }
  } else { g.add(box(W, y0, D, body, 0, y0 / 2, 0)); g.add(box(0.06, 0.01, 0.01, kn, 0, y0 / 2, fz + 0.005)); }
  // 上:本体の箱(前があいている)
  const ih = top - y0, t = 0.025;
  g.add(box(W, t, D, body, 0, y0 + t / 2, 0)); g.add(box(W + 0.03, 0.05, D + 0.03, body, 0, top + 0.025, 0.005));
  for (const sx of [-1, 1]) g.add(box(t, ih, D, body, sx * (W / 2 - t / 2), y0 + ih / 2, 0));
  g.add(box(W - t * 2, ih, t, dark, 0, y0 + ih / 2, -D / 2 + t / 2)); g.add(box(W - t * 2, t, D, body, 0, top - t / 2, 0));
  // 中:金色の段・奥の板・位牌風の板・小さな道具
  const iw = W - t * 2 - 0.01, st = [0.32, 0.22, 0.12].map(k => k * (ue ? 0.5 : 1));
  g.add(box(iw * 0.9, ih * 0.62, 0.008, gold, 0, y0 + t + ih * 0.42, -D / 2 + t + 0.004));
  for (let i = 0; i < 3; i++) { const sh = ih * (0.1 + i * 0.1), sd = D * (0.55 - i * 0.14); g.add(box(iw, sh, sd, i ? gold : dark, 0, y0 + t + sh / 2, -D / 2 + t + sd / 2)); }
  const ty = y0 + t + ih * 0.3, tz = -D / 2 + t + D * 0.06; void st;
  for (const x of [-0.06, 0.06].map(v => v * (ue ? 0.7 : 1))) { const ph = ih * 0.2, pw = ih * 0.055; g.add(box(pw, ph, 0.008, blk, x, ty + ph / 2 + 0.01, tz)); g.add(box(pw * 1.3, 0.012, 0.025, gold, x, ty + 0.006, tz)); g.add(box(pw * 0.8, 0.012, 0.01, gold, x, ty + ph + 0.016, tz)); }
  // いちばん前の段:香炉・ろうそく立て・花立て(小さく)
  const fy = y0 + t + ih * 0.1, fzz = -D / 2 + t + D * 0.42, k = ue ? 0.6 : 1;
  g.add(cyl(0.03 * k, 0.025 * k, 0.03 * k, gold, 0, fy + 0.015 * k, fzz)); for (const sx of [-1, 1]) { g.add(cyl(0.006 * k, 0.012 * k, 0.07 * k, gold, sx * iw * 0.25, fy + 0.035 * k, fzz)); g.add(cyl(0.014 * k, 0.011 * k, 0.05 * k, gold, sx * iw * 0.4, fy + 0.025 * k, fzz)); g.add(ell(0.02 * k, std('#6f7f4c', .8), sx * iw * 0.4, fy + 0.07 * k, fzz, 1, 1.2, 1)); }
  // 扉(両開き、外側の端が蝶番)
  const open = it.opts.open !== false, dw = (W - 0.01) / 2, dh = ih;
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * (W / 2 - 0.004), y0, fz + 0.008); piv.rotation.y = open ? sx * 1.75 : 0;
    const door = new THREE.Group(); door.position.x = -sx * dw / 2; piv.add(door);
    door.add(box(dw, dh, 0.014, body, 0, dh / 2, 0)); door.add(box(dw * 0.7, dh * 0.8, 0.004, std('#2a1a10', .4), 0, dh / 2, 0.008)); door.add(box(dw * 0.5, dh * 0.6, 0.004, gold, 0, dh / 2, -0.008));
    door.add(box(0.008, 0.05, 0.01, kn, -sx * (dw / 2 - 0.02), dh * 0.5, 0.012));
    g.add(piv);
  }
  g.position.y = it.opts.lift || 0; const sz = styleOf(it).size; g.scale.set(it.w / sz[0], it.h / sz[1], it.d / sz[2]); const out = new THREE.Group(); out.add(g); return out;
}

// ---- 茶だんす・水屋だんす・整理だんす ----
// 部分:本体 / 戸・引き出しの前 / 取っ手
function dishes(g, x0, x1, y, z, seed) {
  const pl = std('#efeae0', .3), cup = std('#d9cdb8', .4), blue = std('#5a6d8a', .4);
  let x = x0 + 0.03; let i = seed;
  while (x < x1 - 0.17) { const k = i++ % 4;
    if (k === 0) { for (let j = 0; j < 4; j++) g.add(cyl(0.07, 0.06, 0.012, pl, x + 0.07, y + 0.006 + j * 0.013, z)); x += 0.16; }
    else if (k === 1) { g.add(cyl(0.035, 0.028, 0.06, cup, x + 0.035, y + 0.03, z)); g.add(cyl(0.035, 0.028, 0.06, blue, x + 0.035, y + 0.03, z - 0.08)); x += 0.08; }
    else if (k === 2) { g.add(cyl(0.05, 0.035, 0.05, blue, x + 0.05, y + 0.025, z)); x += 0.11; }
    else { g.add(cyl(0.03, 0.04, 0.12, std('#7b5a3a', .5), x + 0.04, y + 0.06, z - 0.03)); x += 0.09; }
  }
}
function slideDoors(g, w, y0, y1, z, mat, kn, glass) {
  const dw = w / 2 + 0.01, h = y1 - y0;
  for (const sx of [-1, 1]) { const dz = z + (sx > 0 ? 0 : 0.014), x = sx * (w / 4 - 0.005);
    if (glass) { const fr = 0.022; g.add(box(dw, fr, 0.016, mat, x, y0 + fr / 2, dz)); g.add(box(dw, fr, 0.016, mat, x, y1 - fr / 2, dz)); for (const ex of [-1, 1]) g.add(box(fr, h, 0.016, mat, x + ex * (dw / 2 - fr / 2), (y0 + y1) / 2, dz)); g.add(box(dw - fr * 2, h - fr * 2, 0.004, glass, x, (y0 + y1) / 2, dz)); }
    else { g.add(box(dw, h, 0.016, mat, x, (y0 + y1) / 2, dz)); }
    g.add(box(0.012, Math.min(0.06, h * 0.3), 0.004, kn, x - sx * (dw / 2 - 0.04), (y0 + y1) / 2, dz + 0.01));
  }
}
function waDrawers(g, x, y0, y1, z, w, n, front, kn, ring) {
  const hh = (y1 - y0) / n; for (let i = 0; i < n; i++) { const cy = y0 + hh * (i + .5); g.add(box(w - 0.008, hh - 0.008, 0.016, front, x, cy, z));
    if (ring) for (const sx of (w > 0.45 ? [-1, 1] : [0])) { const ox = x + sx * w * 0.25; g.add(box(0.06, 0.03, 0.004, kn, ox, cy + 0.008, z + 0.01)); const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 4, 12, Math.PI), kn); r.rotation.z = Math.PI; r.position.set(ox, cy + 0.0, z + 0.014); g.add(r); }
    else g.add(box(0.05, 0.012, 0.012, kn, x, cy, z + 0.012)); }
}
function tansuBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, body = pm(it, 'body', .45), front = pm(it, 'front', .45), kn = pm(it, 'knob', .35, .7), back = std('#d8c9ac', .7), glass = GLASS();
  const z = d / 2 - 0.008, iw = w - 0.04;
  g.add(box(w - 0.03, 0.05, d - 0.03, body, 0, 0.025, -0.01)); g.add(box(w + 0.02, 0.03, d + 0.01, body, 0, h - 0.015, 0.0));
  // 中が詰まった段 / ガラス戸の段(横板と奥の板だけ)
  const solid = (ya, yb) => g.add(box(w, yb - ya, d - 0.02, body, 0, (ya + yb) / 2, -0.01));
  const hollow = (ya, yb) => { for (const sx of [-1, 1]) g.add(box(0.02, yb - ya, d - 0.02, body, sx * (w / 2 - 0.01), (ya + yb) / 2, -0.01)); g.add(box(w, yb - ya, 0.015, body, 0, (ya + yb) / 2, -d / 2 + 0.0075)); };
  if (s === 'seiri') {
    solid(0.05, h - 0.03);
    const y0 = 0.06, y1 = h - 0.04, top = y1 - (y1 - y0) * 0.17;
    for (const sx of [-1, 1]) waDrawers(g, sx * iw / 4, top, y1, z, iw / 2, 1, front, kn, true);
    waDrawers(g, 0, y0, top, z, iw, 4, front, kn, true);
    return g;
  }
  // ガラス戸の中(奥の板と棚と食器)
  const glassBox = (ya, yb) => { g.add(box(iw, yb - ya - 0.004, 0.01, back, 0, (ya + yb) / 2, -d / 2 + 0.022)); const mid = (ya + yb) / 2; g.add(box(iw, 0.015, d - 0.08, body, 0, mid, -0.02)); dishes(g, -iw / 2, iw / 2, ya + 0.005, 0.0, 1); dishes(g, -iw / 2, iw / 2, mid + 0.008, 0.0, 3); };
  if (s === 'cha') {
    const a = 0.06, b = h * 0.42, c = h * 0.55, e = h - 0.04;
    solid(0.05, c); hollow(c, h - 0.03); g.add(box(w, 0.015, d - 0.02, body, 0, c, -0.01));
    slideDoors(g, iw, a, b, z - 0.014, front, kn, null);
    waDrawers(g, 0, b + 0.005, c - 0.005, z, iw, 1, front, kn, false); for (const x of [-iw / 3, iw / 3]) g.add(box(0.006, c - b - 0.01, 0.018, body, x, (b + c) / 2, z + 0.002));
    glassBox(c, e); slideDoors(g, iw, c + 0.005, e, z - 0.014, front, kn, glass);
  } else {
    // 水屋だんす:下の引き戸・引き出しの段・ガラス戸・いちばん上の小さい戸(天袋)
    const a = 0.06, b = h * 0.34, c = h * 0.45, e = h * 0.88, f = h - 0.035;
    solid(0.05, c + 0.02); hollow(c + 0.02, e); solid(e, h - 0.03);
    slideDoors(g, iw, a, b, z - 0.014, front, kn, null);
    for (const sx of [-1, 1]) waDrawers(g, sx * iw / 4, b + 0.005, c - 0.005, z, iw / 2, 1, front, kn, false);
    glassBox(c + 0.02, e - 0.01); slideDoors(g, iw, c + 0.02, e - 0.01, z - 0.014, front, kn, glass);
    g.add(box(w, 0.02, d - 0.01, body, 0, e, -0.005));
    slideDoors(g, iw, e + 0.012, f, z - 0.014, front, kn, null);
  }
  return g;
}

// ---- 鏡台 ----
// 部分:本体 / かけ布(opts.cover で鏡にかける)
function kyoudaiBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, body = pm(it, 'body', .4), kn = std('#b08a3e', .3, .8), mir = MIRROR(), cov = pm(it, 'cover', .9);
  const sz = styleOf(it).size, W = sz[0], H = sz[1], D = sz[2];
  const bh = s === 'ichimen' ? 0.42 : 0.34;
  g.add(box(W, bh, D, body, 0, bh / 2, 0)); g.add(box(W + 0.02, 0.02, D + 0.01, body, 0, bh + 0.01, 0));
  const dr = s === 'ichimen' ? 3 : 2; for (let i = 0; i < dr; i++) { const hh = (bh - 0.04) / dr, cy = 0.02 + hh * (i + 0.5); g.add(box(W - 0.04, hh - 0.01, 0.012, body, 0, cy, D / 2 + 0.002)); g.add(box(0.05, 0.012, 0.012, kn, 0, cy, D / 2 + 0.012)); }
  const my = bh + 0.02, mh = H - my - 0.02, mw = s === 'ichimen' ? W * 0.8 : W * 0.56, mz = -D / 2 + 0.08;
  // 鏡の柱と鏡
  for (const sx of [-1, 1]) g.add(box(0.03, mh * 0.55, 0.03, body, sx * (mw / 2 + 0.015), my + mh * 0.275, mz));
  const fr = (x, y, ww, hh, rot = 0, pz = mz) => { const p = new THREE.Group(); p.position.set(x, y, pz); p.rotation.y = rot; p.add(box(ww, hh, 0.025, body)); const m = box(ww - 0.03, hh - 0.03, 0.004, mir, 0, 0, 0.014); p.add(m); return p; };
  const cy = my + mh * 0.48;
  g.add(fr(0, cy, mw, mh * 0.92));
  if (s !== 'ichimen') { const sw = mw / 2; for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * mw / 2, 0, mz); p.rotation.y = -sx * 0.6; p.add(fr(sx * sw / 2, cy, sw, mh * 0.92 * 0.9, 0, 0)); g.add(p); } }
  if (it.opts.cover) {
    // かけ布:鏡の上からふわっとかぶせる
    const cw = s === 'ichimen' ? mw + 0.08 : mw * 1.75, ch = mh * 0.96;
    const c = rbox(cw, ch, 0.12, 0.05, cov, 0, my + ch / 2 + 0.01, mz + 0.01); g.add(c);
    g.add(ell(1, cov, 0, my + ch, mz + 0.01, cw * 0.48, 0.04, 0.07));
    g.add(box(cw * 0.9, 0.004, 0.003, std('#e9dcc0', .8), 0, my + ch * 0.15, mz + 0.072));
  }
  return fitStyle(g, it);
}

// ---- 衣桁 ----
// 部分:わく / 布(opts.cloth で着物を掛ける)
function ikouBuild(it) {
  const g = new THREE.Group(), fr = pm(it, 'frame', .35), W = 1.4, H = 1.5;
  for (const sx of [-1, 1]) { const x = sx * 0.55; g.add(box(0.05, 0.05, 0.42, fr, x, 0.025, 0)); g.add(box(0.035, H - 0.06, 0.035, fr, x, 0.05 + (H - 0.06) / 2, 0)); }
  g.add(box(W, 0.04, 0.04, fr, 0, H - 0.02, 0)); for (const sx of [-1, 1]) { const tip = box(0.08, 0.03, 0.04, fr, sx * (W / 2 + 0.02), H + 0.0, 0); tip.rotation.z = sx * 0.35; g.add(tip); }
  g.add(box(1.1, 0.03, 0.03, fr, 0, H * 0.62, 0)); g.add(box(1.1, 0.03, 0.03, fr, 0, 0.18, 0));
  if (it.opts.cloth) {
    const col = partVal(it, 'cloth');
    const mat = paint('kimono' + col, 128, 256, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(240,230,210,.35)'; c.lineWidth = 2;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const cx = x * 32 + (y % 2) * 16, cy = y * 32 + 16; c.beginPath(); c.moveTo(cx, cy - 10); c.lineTo(cx + 9, cy); c.lineTo(cx, cy + 10); c.lineTo(cx - 9, cy); c.closePath(); c.stroke(); }
    }, .9, { side: THREE.DoubleSide });
    // 着物の形(袖を広げた T の形)を、上の棒の前とうしろに
    const sh = new THREE.Shape(); const sw = 0.68, bw = 0.32, top = H - 0.03, sl = 0.48, bot = 0.12;
    sh.moveTo(-sw, top); sh.lineTo(sw, top); sh.lineTo(sw, top - sl); sh.lineTo(bw, top - sl); sh.lineTo(bw + 0.02, bot); sh.lineTo(-bw - 0.02, bot); sh.lineTo(-bw, top - sl); sh.lineTo(-sw, top - sl); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh); const uv = geo.attributes.uv, p = geo.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + sw) / (sw * 2) * 1.2, p.getY(i) / H * 2);
    for (const zz of [0.03, -0.03]) { const m = mesh(geo, mat, 0, 0, zz); g.add(m); }
    g.add(box(sw * 2, 0.02, 0.07, mat, 0, top + 0.005, 0));
    // 衿(えり):首から斜めに下りる白い線
    const eri = std('#e8dcc4', .8); for (const sx of [-1, 1]) { const e = box(0.035, 0.5, 0.004, eri, sx * 0.07, top - 0.24, 0.034); e.rotation.z = -sx * 0.28; g.add(e); }
  }
  return fitStyle(g, it);
}

// ---- 柱時計(振り子のボンボン時計) ----
// 部分:木のわく / 文字盤。壁の物:背中が z=0
function clockFace(color) {
  return paint('clockface' + color, 256, 256, (c, W, H) => { c.fillStyle = color; c.fillRect(0, 0, W, H); c.strokeStyle = '#2a2420'; c.fillStyle = '#2a2420';
    c.lineWidth = 3; c.beginPath(); c.arc(W / 2, H / 2, W * 0.46, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; c.beginPath(); c.arc(W / 2, H / 2, W * 0.36, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = W * (i % 5 ? 0.43 : 0.38), r1 = W * 0.45; c.lineWidth = i % 5 ? 1 : 4; c.beginPath(); c.moveTo(W / 2 + Math.sin(a) * r0, H / 2 - Math.cos(a) * r0); c.lineTo(W / 2 + Math.sin(a) * r1, H / 2 - Math.cos(a) * r1); c.stroke(); }
    // 針(10時8分ごろ)
    const hand = (a, len, wd) => { c.lineWidth = wd; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.sin(a) * len, H / 2 - Math.cos(a) * len); c.stroke(); };
    hand(-Math.PI / 3 + 0.07, W * 0.22, 6); hand(Math.PI * 0.27, W * 0.33, 4); c.beginPath(); c.arc(W / 2, H / 2, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(120,90,40,.12)'; c.fillRect(0, 0, W, H); }, .6);
}
function hashiraBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, wood = pm(it, 'case', .35), face = clockFace(partVal(it, 'face')), brass = std('#b58f45', .3, .85), dark = std('#22180f', .6), glass = GLASS();
  const D = 0.13, hy = 0.17, r = 0.115;
  // 頭(文字盤のまわり)
  if (s === 'kaku') { g.add(box(0.3, 0.3, D, wood, 0, hy, D / 2)); g.add(box(0.33, 0.03, D + 0.02, wood, 0, hy + 0.165, D / 2 + 0.005)); }
  else { const ring = cyl(0.145, 0.145, D, wood, 0, hy, D / 2, s === 'hakkaku' ? 8 : 32); ring.rotation.x = Math.PI / 2; if (s === 'hakkaku') ring.rotation.y = Math.PI / 8; g.add(ring); }
  const bez = cyl(r + 0.012, r + 0.012, 0.012, brass, 0, hy, D + 0.004, 32); bez.rotation.x = Math.PI / 2; g.add(bez);
  const fc = mesh(new THREE.CircleGeometry(r, 32), face, 0, hy, D + 0.011); g.add(fc);
  for (const sx of [-1, 1]) { const k = cyl(0.006, 0.006, 0.004, brass, sx * 0.045, hy - 0.045, D + 0.013, 8); k.rotation.x = Math.PI / 2; g.add(k); }
  // 胴(振り子の窓)
  const by = -0.12, bh = 0.34; g.add(box(0.24, bh, D - 0.01, wood, 0, by, (D - 0.01) / 2)); g.add(box(0.27, 0.03, D + 0.005, wood, 0, by - bh / 2 - 0.01, D / 2));
  g.add(box(0.17, bh - 0.06, 0.004, dark, 0, by, D - 0.008));
  const pd = new THREE.Group(); pd.position.set(0, by + bh / 2 - 0.04, D - 0.002); pd.rotation.z = 0.12; pd.add(box(0.006, 0.2, 0.003, brass, 0, -0.1, 0)); const bob = cyl(0.035, 0.035, 0.006, brass, 0, -0.2, 0, 24); bob.rotation.x = Math.PI / 2; pd.add(bob); g.add(pd);
  g.add(box(0.15, bh - 0.08, 0.003, glass, 0, by, D + 0.006));
  for (const sx of [-1, 1]) g.add(box(0.02, bh, 0.016, wood, sx * 0.095, by, D));
  return fitStyle(g, it);
}

// ---- 黒電話・電話台 ----
// 部分:電話 / 台
function kurodenwa(g, mat, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); const wh = std('#e9e5da', .4), dk = std('#0b0b0b', .3);
  p.add(rbox(0.2, 0.05, 0.22, 0.015, mat, 0, 0.025, 0));
  const top = rbox(0.18, 0.07, 0.16, 0.03, mat, 0, 0.075, -0.02); p.add(top);
  // ダイヤル(前の斜めの面)
  const dial = new THREE.Group(); dial.position.set(0, 0.075, 0.07); dial.rotation.x = -0.75; p.add(dial);
  const d0 = cyl(0.058, 0.06, 0.012, mat, 0, 0, 0, 24); dial.add(d0); const d1 = cyl(0.05, 0.05, 0.004, wh, 0, 0.007, 0, 24); dial.add(d1);
  for (let i = 0; i < 10; i++) { const a = -0.6 + i / 10 * Math.PI * 1.65; dial.add(cyl(0.008, 0.008, 0.006, dk, Math.cos(a) * 0.037, 0.009, Math.sin(a) * 0.037, 8)); }
  dial.add(cyl(0.016, 0.016, 0.006, wh, 0, 0.01, 0, 12));
  // 受話器
  const hs = new THREE.Group(); hs.position.set(0, 0.13, -0.03); p.add(hs);
  hs.add(box(0.15, 0.024, 0.03, mat, 0, 0.01, 0)); for (const sx of [-1, 1]) { const c = cyl(0.03, 0.026, 0.045, mat, sx * 0.09, 0, 0, 14); c.rotation.z = Math.PI / 2; hs.add(c); }
  for (const sx of [-1, 1]) p.add(box(0.03, 0.02, 0.05, mat, sx * 0.06, 0.112, -0.03));
  g.add(p);
}
function denwaBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, ph = pm(it, 'phone', .22), wood = pm(it, 'stand', .45), kn = std('#b08a3e', .3, .8);
  if (s === 'phone') { kurodenwa(g, ph, 0, 0, 0); return fitStyle(g, it); }
  const W = 0.42, H = 0.7, D = 0.32;
  g.add(box(W, 0.025, D, wood, 0, H - 0.0125, 0)); g.add(box(W - 0.02, 0.08, D - 0.03, wood, 0, H - 0.065, -0.005)); g.add(box(0.05, 0.01, 0.01, kn, 0, H - 0.065, D / 2 - 0.015));
  for (const [x, z] of C4) g.add(box(0.035, H - 0.025, 0.035, wood, x * (W / 2 - 0.03), (H - 0.025) / 2, z * (D / 2 - 0.03)));
  g.add(box(W - 0.04, 0.02, D - 0.04, wood, 0, 0.12, 0)); g.add(box(W - 0.04, 0.02, D - 0.04, wood, 0, 0.36, 0));
  // 下の段に電話帳、上にレースの敷物
  g.add(box(0.21, 0.07, 0.28, std('#c8b98c', .9), -0.06, 0.165, 0)); g.add(box(0.2, 0.05, 0.27, std('#d8d2c2', .9), -0.06, 0.225, 0));
  g.add(box(0.14, 0.12, 0.2, std('#8a3b2e', .8), 0.1, 0.43, -0.02));
  const lace = ell(1, std('#f2efe6', .9), 0, H + 0.002, 0, 0.17, 0.002, 0.14); g.add(lace);
  kurodenwa(g, ph, 0, H + 0.004, 0.0);
  return fitStyle(g, it);
}

// ---- 家具調テレビ(ブラウン管・脚つき) ----
// 部分:木の箱 / 画面のまわり。opts.on で映る、opts.doors で扉を閉める、opts.ant で室内アンテナ
function kaguTVBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, wood = pm(it, 'case', .4), bez = pm(it, 'bezel', .4), dark = std('#1d1f22', .3), silver = std('#b8b8b2', .35, .7), grille = paint('tvgrille', 64, 64, (c, W, H) => { c.fillStyle = '#3a2c22'; c.fillRect(0, 0, W, H); c.fillStyle = '#c9b58e'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2); }, .9);
  const W = 1.0, H = 0.95, D = 0.5, y0 = 0.2, on = !!it.opts.on, doors = !!it.opts.doors;
  for (const [x, z] of C4) rod(g, wood, [x * (W / 2 - 0.08), y0, z * (D / 2 - 0.08)], [x * (W / 2 - 0.05), 0, z * (D / 2 - 0.05)], 0.035, true);
  g.add(box(W, H - y0, D, wood, 0, y0 + (H - y0) / 2, 0)); g.add(box(W + 0.02, 0.025, D + 0.02, wood, 0, H - 0.0125, 0));
  const sx = -0.12, sy = y0 + (H - y0) * 0.52, sw = 0.6, sh = 0.47, fz = D / 2;
  g.add(box(sw + 0.06, sh + 0.06, 0.01, bez, sx, sy, fz + 0.005));
  const scr = rbox(sw, sh, 0.04, 0.05, on ? emissive('#8fa6b4', 0.7) : std('#2a3034', .12, .1), sx, sy, fz); g.add(scr);
  // 右の操作部:チャンネルのつまみ・音量・スピーカー
  const cx = W / 2 - 0.15; g.add(box(0.2, sh + 0.06, 0.012, dark, cx, sy, fz + 0.006));
  const ch = cyl(0.045, 0.045, 0.03, silver, cx, sy + 0.14, fz + 0.025, 20); ch.rotation.x = Math.PI / 2; g.add(ch); g.add(box(0.012, 0.07, 0.012, dark, cx, sy + 0.14, fz + 0.042));
  for (const k of [0, 1]) { const v = cyl(0.022, 0.022, 0.025, silver, cx - 0.04 + k * 0.08, sy + 0.04, fz + 0.02, 14); v.rotation.x = Math.PI / 2; g.add(v); }
  g.add(plane(0.16, 0.16, grille, cx, sy - 0.12, fz + 0.013));
  g.add(box(W - 0.08, 0.08, 0.01, grille, 0, y0 + 0.06, fz + 0.005));
  if (doors) for (const k of [-1, 1]) { g.add(box(W / 2 - 0.01, sh + 0.12, 0.02, wood, k * (W / 4), sy, fz + 0.03)); g.add(box(0.012, 0.08, 0.012, std('#b08a3e', .3, .8), k * 0.025, sy, fz + 0.046)); }
  if (it.opts.ant) { g.add(cyl(0.06, 0.07, 0.04, dark, 0.2, H + 0.02, -0.05, 16)); for (const k of [-1, 1]) rod(g, silver, [0.2, H + 0.04, -0.05], [0.2 + k * 0.28, H + 0.5, -0.1], 0.006, true); }
  if (on && !doors) light(g, '#b8c8ff', 0.6, sx, sy, fz + 0.5, { distance: 2.5 });
  return fitStyle(g, it);
}

// ---- 石油ストーブ ----
// 部分:本体。opts.on で火が点く、opts.kettle で上にやかん
function stoveBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, body = pm(it, 'body', .45, .3), metal = std('#7a7a76', .35, .8), blk = std('#2a2826', .5, .4), on = !!it.opts.on;
  const fire = on ? emissive('#ff8a3a', 1.6) : std('#3a3430', .6);
  let topY;
  if (s === 'hansha') {
    const W = 0.45, H = 0.5, D = 0.3; topY = H;
    g.add(box(W, 0.12, D, body, 0, 0.06, 0)); for (const sx of [-1, 1]) g.add(box(0.03, H - 0.12, D, body, sx * (W / 2 - 0.015), 0.12 + (H - 0.12) / 2, 0));
    g.add(box(W, 0.03, D, body, 0, H - 0.015, 0)); g.add(box(W - 0.06, H - 0.15, 0.02, std('#d8d6d0', .15, .9), 0, 0.12 + (H - 0.15) / 2, -D / 2 + 0.01));
    g.add(cyl(0.05, 0.06, 0.22, fire, 0, 0.12 + 0.12, -0.03, 16)); g.add(cyl(0.065, 0.065, 0.02, blk, 0, 0.36, -0.03, 16));
    for (let i = 0; i < 8; i++) g.add(box(W - 0.06, 0.005, 0.005, metal, 0, 0.14 + i * 0.042, D / 2 - 0.01));
    g.add(box(0.12, 0.04, 0.01, blk, W / 2 - 0.1, 0.06, D / 2 + 0.003));
    if (on) light(g, '#ff9a4a', 1.5, 0, 0.3, 0.3, { distance: 2.5 });
  } else {
    const R = 0.22; topY = 0.56;
    g.add(cyl(R, R, 0.16, body, 0, 0.08, 0, 32)); g.add(cyl(R * 0.98, R, 0.02, blk, 0, 0.01, 0, 32));
    g.add(cyl(0.14, 0.14, 0.3, fire, 0, 0.16 + 0.15, 0, 24));
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.add(cyl(0.004, 0.004, 0.32, metal, Math.cos(a) * 0.19, 0.32, Math.sin(a) * 0.19, 4)); }
    g.add(cyl(0.2, 0.2, 0.03, body, 0, 0.47, 0, 32)); g.add(cyl(0.21, 0.21, 0.02, blk, 0, topY - 0.08, 0, 32));
    g.add(cyl(0.12, 0.12, 0.06, metal, 0, topY - 0.04, 0, 24));
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.007, 6, 20, Math.PI), metal); hoop.position.set(0, 0.5, 0); g.add(hoop);
    g.add(box(0.08, 0.04, 0.02, blk, 0.12, 0.08, R - 0.005));
    if (on) light(g, '#ff9a4a', 1.5, 0, 0.35, 0.35, { distance: 2.5 });
  }
  if (it.opts.kettle) { const k = std('#b9bcbe', .25, .9), ky = topY + (s === 'hansha' ? 0 : -0.01); g.add(ell(1, k, 0, ky + 0.06, 0, 0.11, 0.07, 0.11)); g.add(cyl(0.11, 0.11, 0.02, k, 0, ky + 0.01, 0, 20)); g.add(cyl(0.02, 0.02, 0.02, blk, 0, ky + 0.135, 0, 10));
    rod(g, k, [0.08, ky + 0.06, 0], [0.17, ky + 0.13, 0], 0.018, true); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.006, 6, 16, Math.PI), blk); hd.position.set(0, ky + 0.12, 0); hd.rotation.y = Math.PI / 2; g.add(hd); }
  return fitStyle(g, it);
}

// ---- 扇風機(昔の羽根の) ----
// 部分:本体 / 羽根
function senpukiBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, body = pm(it, 'body', .4), blade = std(partVal(it, 'blade'), .3, 0, { transparent: true, opacity: 0.7 }), wire = std('#c8c8c2', .3, .8), btn = ['#6f8fa8', '#e0d6c0', '#e0d6c0', '#c86a4a'];
  const desk = s === 'desk', ph = desk ? 0.3 : 0.72;
  g.add(rbox(0.32, 0.06, 0.28, 0.025, body, 0, 0.03, 0.01)); for (let i = 0; i < 4; i++) g.add(box(0.035, 0.018, 0.04, std(btn[i], .5), -0.06 + i * 0.04, 0.065, 0.1));
  g.add(cyl(0.022, 0.026, ph - 0.12, body, 0, 0.06 + (ph - 0.12) / 2, -0.02, 12));
  const head = new THREE.Group(); head.position.set(0, ph, -0.02); head.rotation.x = -0.12; g.add(head);
  head.add(ell(0.07, body, 0, 0, -0.07, 1, 1, 1.3)); head.add(cyl(0.02, 0.02, 0.05, body, 0, 0.07, -0.08, 8));
  const R = 0.16, fz = 0.05;
  for (let i = 0; i < 4; i++) { const b = ell(1, blade, Math.cos(i * Math.PI / 2 + 0.3) * R * 0.5, Math.sin(i * Math.PI / 2 + 0.3) * R * 0.5, fz, R * 0.42, R * 0.28, 0.006); b.rotation.z = i * Math.PI / 2 + 0.3; head.add(b); }
  const hub = cyl(0.03, 0.03, 0.03, body, 0, 0, fz + 0.01, 14); hub.rotation.x = Math.PI / 2; head.add(hub);
  // かご(前とうしろの輪と、前の放射状の線)
  for (const z of [fz + 0.04, fz - 0.03]) { const r = new THREE.Mesh(new THREE.TorusGeometry(R + 0.01, 0.003, 4, 36), wire); r.position.z = z; head.add(r); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rod(head, wire, [0, 0, fz + 0.065], [Math.cos(a) * (R + 0.01), Math.sin(a) * (R + 0.01), fz + 0.04], 0.003, true); }
  const badge = cyl(0.025, 0.025, 0.006, std('#3a5a7a', .4), 0, 0, fz + 0.068, 14); badge.rotation.x = Math.PI / 2; head.add(badge);
  return fitStyle(g, it);
}

// ---- 和の照明(天井から) ----
// 部分:わく・笠。opts.on で点く、opts.drop で下げる長さ
function walightBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, fr = pm(it, 'frame', .45), on = it.opts.on !== false, drop = it.opts.drop ?? 0.5, pw = it.opts.power ?? 1, cord = std('#2a2622', .6);
  g.add(cyl(0.04, 0.04, 0.02, std('#e8e2d4', .6), 0, -0.01, 0, 12)); g.add(cyl(0.003, 0.003, drop, cord, 0, -drop / 2, 0, 6));
  if (s === 'washi') {
    // 和紙の四角い笠:木のわく+和紙(点くと明るく)
    const w = it.w, h = Math.min(0.32, w * 0.65), y = -drop - h / 2, paper = on ? emissive('#ffe2b3', 0.9) : std('#efe6d2', .9);
    g.add(box(w - 0.01, h - 0.01, w - 0.01, paper, 0, y, 0));
    for (const [x, z] of C4) g.add(box(0.016, h + 0.01, 0.016, fr, x * w / 2, y, z * w / 2));
    for (const yy of [y - h / 2, y + h / 2]) { for (const sz of [-1, 1]) { g.add(box(w + 0.016, 0.014, 0.016, fr, 0, yy, sz * w / 2)); g.add(box(0.016, 0.014, w + 0.016, fr, sz * w / 2, yy, 0)); } }
    for (const k of [-1, 1]) for (const sz of [-1, 1]) { g.add(box(0.006, h, 0.006, fr, k * w / 6, y, sz * w / 2)); g.add(box(0.006, h, 0.006, fr, sz * w / 2, y, k * w / 6)); }
    g.add(box(w * 0.5, 0.012, 0.012, fr, 0, y + h / 2 + 0.06, 0)); rod(g, cord, [0, -drop, 0], [w * 0.22, y + h / 2 + 0.06, 0], 0.003, true); rod(g, cord, [0, -drop, 0], [-w * 0.22, y + h / 2 + 0.06, 0], 0.003, true);
    if (on) { const l = light(g, WARM, 6 * pw, 0, y - h * 0.6, 0); l.castShadow = true; }
  } else if (s === 'keikou') {
    // 丸い蛍光灯:乳白の笠の下に輪の蛍光管、引きひも
    const r = it.w / 2, y = -drop;
    const sh = mesh(new THREE.CylinderGeometry(r * 0.25, r, 0.12, 32, 1, true), dbl('#efeee6', .5), 0, y - 0.06, 0); g.add(sh);
    g.add(cyl(r * 0.26, r * 0.26, 0.04, std('#d8d6cc', .5), 0, y, 0, 16));
    const tube = on ? emissive('#f4f7ff', 1.6) : std('#f0f0ec', .4);
    for (const rr of [r * 0.62, r * 0.42]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.014, 8, 36), tube); t.rotation.x = Math.PI / 2; t.position.y = y - 0.1; g.add(t); }
    g.add(cyl(0.02, 0.025, 0.03, std('#f4f2ec', .5), 0, y - 0.11, 0, 10)); g.add(cyl(0.0015, 0.0015, 0.3, cord, 0, y - 0.27, 0, 4)); g.add(cyl(0.008, 0.012, 0.04, std('#c9a04a', .5), 0, y - 0.43, 0, 8));
    if (on) { const l = light(g, '#f2f5ff', 8 * pw, 0, y - 0.3, 0); l.castShadow = true; }
  } else {
    // 裸電球(ソケットだけ)
    const y = -drop; g.add(cyl(0.017, 0.017, 0.05, std('#2a2622', .5), 0, y - 0.025, 0, 10)); g.add(cyl(0.012, 0.014, 0.02, std('#b8b4a8', .3, .8), 0, y - 0.06, 0, 10));
    g.add(sph(0.03, on ? emissive('#ffd9a0', 3) : std('#f0ece4', .2, 0, { transparent: true, opacity: .7 }), 0, y - 0.095, 0)); g.add(cyl(0.0015, 0.0015, 0.25, cord, 0.02, y - 0.17, 0, 4));
    if (on) { const l = light(g, '#ffd2a0', 4 * pw, 0, y - 0.15, 0); l.castShadow = true; }
  }
  return g;
}

// ---- 和風のシーリングライト(天井にぴったり付く) ----
// 部分:わく(木)。和紙の面が光る。組子は面の下に細い木の格子
function waceilBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, fr = pm(it, 'frame', .5), on = it.opts.on !== false, pw = it.opts.power ?? 1, w = it.w;
  const warm = it.opts.warm !== false, paper = on ? emissive(warm ? '#ffe6bd' : '#fbf6ea', 1.0) : std('#eee6d4', .9);
  if (s === 'maru') {
    // 丸形:木のふち+和紙
    const r = w / 2, hh = 0.11; g.add(cyl(r * 0.35, r * 0.35, 0.02, std('#e8e2d4', .6), 0, -0.01, 0, 24));
    g.add(cyl(r - 0.01, r - 0.01, hh - 0.02, paper, 0, -hh / 2 - 0.01, 0, 48));
    for (const yy of [-0.02, -hh]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 48), fr); t.rotation.x = Math.PI / 2; t.position.y = yy; g.add(t); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(box(0.008, hh - 0.02, 0.008, fr, Math.cos(a) * r, -hh / 2 - 0.01, Math.sin(a) * r)); }
    g.add(box(r * 1.9, 0.006, 0.008, fr, 0, -hh - 0.004, 0)); g.add(box(0.008, 0.006, r * 1.9, fr, 0, -hh - 0.004, 0));
  } else {
    // 角形:木のわく+和紙の箱。kumiko は面に組子、usu は薄型
    const hh = s === 'usu' ? 0.07 : 0.13, y = -hh / 2 - 0.01; g.add(box(w * 0.4, 0.02, w * 0.4, std('#e8e2d4', .6), 0, -0.01, 0));
    g.add(box(w - 0.012, hh - 0.012, w - 0.012, paper, 0, y, 0));
    for (const [x, z] of C4) g.add(box(0.022, hh + 0.004, 0.022, fr, x * w / 2, y, z * w / 2));
    for (const yy of [y - hh / 2, y + hh / 2]) for (const sz of [-1, 1]) { g.add(box(w + 0.022, 0.018, 0.02, fr, 0, yy, sz * w / 2)); g.add(box(0.02, 0.018, w + 0.022, fr, sz * w / 2, yy, 0)); }
    if (s !== 'usu') for (const sz of [-1, 1]) for (const k of [-1, 0, 1]) { g.add(box(0.006, hh, 0.006, fr, k * w / 4, y, sz * w / 2)); g.add(box(0.006, hh, 0.006, fr, sz * w / 2, y, k * w / 4)); }
    const by = y - hh / 2 - 0.004, n = s === 'kumiko' ? 6 : 3;
    for (let k = 1; k < n; k++) { const p = -w / 2 + k * w / n; g.add(box(w, 0.006, 0.007, fr, 0, by, p)); g.add(box(0.007, 0.006, w, fr, p, by, 0)); }
    if (s === 'kumiko') { // 麻の葉ふうに、ます目ごとに斜めの組子
      const c = w / n, len = c * Math.SQRT2 * 0.98; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = -w / 2 + (i + .5) * c, cz = -w / 2 + (j + .5) * c; for (const a of [Math.PI / 4, -Math.PI / 4]) { const b2 = box(len, 0.005, 0.005, fr, cx, by - 0.001, cz); b2.rotation.y = a; g.add(b2); } }
    }
  }
  if (on) { const l = light(g, warm ? WARM : '#fff4e2', 8 * pw, 0, -0.5, 0); l.castShadow = true; }
  return g;
}

// ---- 布団 ----
// 部分:掛け布団(布) / 敷布団 / 枕(そばがら)
function futonBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, kake = fabric(it, 1, 1), shiki = pm(it, 'shiki', .95), mk = pm(it, 'makura', .95), w = it.w, h = it.h, d = it.d;
  if (s === 'tatamu') {
    // たたんで積んだ:敷布団(三つ折り)の上に掛け布団、いちばん上に枕
    const sh = h * 0.42, kh = h * 0.38; g.add(rbox(w, sh, d, 0.05, shiki, 0, sh / 2, 0)); g.add(box(w - 0.02, 0.006, d * 0.98, std('#cfc6b2', .95), 0, sh * 0.33, 0)); g.add(box(w - 0.02, 0.006, d * 0.98, std('#cfc6b2', .95), 0, sh * 0.66, 0));
    g.add(rbox(w + 0.03, kh, d + 0.02, 0.07, kake, 0, sh + kh / 2, 0));
    const m = cyl(0.065, 0.065, w * 0.45, mk, 0, sh + kh + 0.05, 0, 14); m.rotation.z = Math.PI / 2; m.scale.set(1, 1, 1); g.add(m);
    return g;
  }
  // 敷いた布団:敷布団・掛け布団(上を少し折り返す)・枕
  const st = 0.07; g.add(rbox(w, st, d, 0.03, shiki, 0, st / 2, 0));
  const kl = d * 0.74, kz = d / 2 - kl / 2 + 0.03; g.add(rbox(w + 0.04, 0.09, kl, 0.04, kake, 0, st + 0.045, kz));
  g.add(rbox(w + 0.02, 0.05, 0.18, 0.025, shiki, 0, st + 0.11, kz - kl / 2 + 0.1));
  const m = cyl(0.07, 0.07, 0.45, mk, 0, st + 0.06, -d / 2 + 0.2, 14); m.rotation.z = Math.PI / 2; m.scale.set(1, 1, 0.8); g.add(m);
  return g;
}

// ---- 掛け軸 ----
// 部分:表装の布 / 軸先。絵はだれの作でもない、山と霞の色の面(sansui)か、墨の線(sho)
function jikuArt(kind) {
  return paint('jiku' + kind, 128, 320, (c, W, H) => {
    c.fillStyle = '#e6dcc2'; c.fillRect(0, 0, W, H); const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(120,90,40,.10)'); gr.addColorStop(1, 'rgba(120,90,40,.22)'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    if (kind === 'sansui') {
      const mt = (y, amp, col, seed) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, y - Math.abs(Math.sin(x / W * 3.1 + seed)) * amp - Math.sin(x / 17 + seed) * 4); c.lineTo(W, H); c.fill(); };
      mt(110, 60, 'rgba(110,118,120,.45)', 0.6); c.fillStyle = 'rgba(240,235,220,.6)'; c.fillRect(0, 120, W, 30);
      mt(190, 50, 'rgba(70,78,76,.55)', 2.1); c.fillStyle = 'rgba(240,235,220,.55)'; c.fillRect(0, 200, W, 24);
      mt(270, 30, 'rgba(50,55,50,.6)', 4.0); c.fillStyle = 'rgba(160,60,40,.7)'; c.fillRect(W - 22, 30, 10, 10);
    } else {
      c.strokeStyle = 'rgba(25,22,20,.88)'; c.lineCap = 'round';
      const st = (pts, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); };
      // 草書のように流れる線(字としては読めない)
      const cv = (w, ...p) => { c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i + 5 < p.length + 1; i += 6) c.bezierCurveTo(p[i], p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5]); c.stroke(); };
      cv(8, 44, 40, 90, 30, 96, 70, 60, 84, 30, 98, 70, 120, 74, 140); cv(6, 74, 140, 80, 160, 40, 170, 56, 190); cv(9, 70, 176, 100, 186, 86, 220, 62, 236, 40, 252, 78, 262, 72, 284); cv(4, 40, 120, 52, 128, 48, 140, 42, 146);
      c.fillStyle = 'rgba(160,60,40,.75)'; c.fillRect(W - 30, 270, 12, 12);
    }
  }, .9);
}
function kakejikuBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, cloth = pm(it, 'cloth', .85), tip = pm(it, 'tip', .4), gold = std('#a88a4a', .5, .3), W = 0.5, H = 1.7;
  // 背中が z=0、y は真ん中
  g.add(box(W, H - 0.04, 0.006, cloth, 0, 0, 0.003));
  g.add(plane(W * 0.72, H * 0.52, jikuArt(s), 0, -0.04, 0.0075));
  for (const y of [H * 0.26 - 0.04 + 0.012, -H * 0.26 - 0.04 - 0.012]) g.add(box(W * 0.72, 0.02, 0.002, gold, 0, y, 0.008));
  g.add(box(W, 0.04, 0.022, std('#3a2a1e', .5), 0, H / 2 - 0.02, 0.012));
  const ax = cyl(0.014, 0.014, W + 0.02, std('#3a2a1e', .5), 0, -H / 2 + 0.01, 0.016, 10); ax.rotation.z = Math.PI / 2; g.add(ax);
  for (const sx of [-1, 1]) { const t = cyl(0.02, 0.02, 0.04, tip, sx * (W / 2 + 0.03), -H / 2 + 0.01, 0.016, 10); t.rotation.z = Math.PI / 2; g.add(t); g.add(box(0.025, H * 0.22, 0.002, cloth, sx * 0.08, H / 2 - 0.04 - H * 0.11, 0.009)); }
  rod(g, std('#6a5a3a', .8), [0, H / 2 + 0.12, 0.006], [-0.1, H / 2 - 0.01, 0.008], 0.004, true); rod(g, std('#6a5a3a', .8), [0, H / 2 + 0.12, 0.006], [0.1, H / 2 - 0.01, 0.008], 0.004, true);
  return fitStyle(g, it);
}

// ---- 花瓶に花 ----
// 部分:花瓶 / 花。lift で棚や床の間の上へ
function flower(g, x, y, z, col, leaf, r = 0.022) { g.add(ell(r, col, x, y, z, 1, 0.7, 1)); g.add(ell(r * 0.4, std('#e8c060', .7), x, y + r * 0.5, z)); }
function kabinBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, vase = pm(it, 'vase', .35), fl = pm(it, 'flower', .7), stem = std('#4f6b3a', .8), leaf = std('#566f3e', .7);
  if (s === 'suiban') {
    // 水盤に生け花(低い)
    g.add(cyl(0.16, 0.13, 0.05, vase, 0, 0.025, 0, 24)); g.add(cyl(0.15, 0.15, 0.002, std('#3a4a50', .1), 0, 0.045, 0, 24));
    const pts = [[-0.02, 0.42, 0.0, -0.18, 0.0], [0.04, 0.3, 0.02, 0.15, 0.04], [0, 0.18, 0.05, 0.02, 0.1]];
    for (const [x, hh, z, lx, lz] of pts) { rod(g, stem, [x, 0.05, z], [x + lx, hh, z + lz], 0.006, true); flower(g, x + lx, hh, z + lz, fl, leaf, 0.028); }
    for (let i = 0; i < 4; i++) { const l = ell(0.05, leaf, -0.04 + i * 0.03, 0.09, 0.03 - i * 0.02, 0.3, 1, 0.08); l.rotation.z = -0.6 + i * 0.4; g.add(l); }
  } else if (s === 'ichirin') {
    g.add(cyl(0.022, 0.035, 0.16, vase, 0, 0.08, 0, 14)); g.add(cyl(0.012, 0.022, 0.03, vase, 0, 0.175, 0, 12));
    rod(g, stem, [0, 0.18, 0], [0.04, 0.36, 0.01], 0.004, true); flower(g, 0.04, 0.36, 0.01, fl, leaf, 0.02); const l = ell(0.035, leaf, 0.02, 0.26, 0, 0.3, 1, 0.08); l.rotation.z = -0.5; g.add(l);
  } else {
    // 壺の花瓶に枝もの
    g.add(ell(0.11, vase, 0, 0.12, 0, 1, 1.1, 1)); g.add(cyl(0.05, 0.07, 0.08, vase, 0, 0.25, 0, 18)); g.add(cyl(0.065, 0.05, 0.03, vase, 0, 0.3, 0, 18));
    const br = [[-0.22, 0.62, 0.02], [0.18, 0.7, -0.03], [0.05, 0.52, 0.12], [-0.08, 0.48, -0.1], [0.26, 0.5, 0.06]];
    for (const [x, y, z] of br) { rod(g, std('#4a3a2a', .8), [0, 0.3, 0], [x, y, z], 0.008, true); for (let k = 0; k < 3; k++) flower(g, x * (0.6 + k * 0.2), y - 0.12 + k * 0.06, z * (0.6 + k * 0.2) + 0.01, fl, leaf, 0.02); }
  }
  return fitStyle(g, it);
}

// ---- はきもの(長靴・草履・つっかけ・下駄) ----
// 部分:色
function bootOne(g, mat, sole, x, z, rot, fallen) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = rot; g.add(b);
  const inner = new THREE.Group(); b.add(inner); if (fallen) { inner.rotation.z = -0.3; inner.rotation.x = 0.12; inner.position.set(-0.01, 0.0, 0); }
  inner.add(cyl(0.055, 0.05, 0.3, mat, 0, 0.18, -0.03, 14)); inner.add(rbox(0.1, 0.08, 0.26, 0.035, mat, 0, 0.045, 0.03)); inner.add(rbox(0.105, 0.02, 0.27, 0.01, sole, 0, 0.01, 0.03));
  inner.add(cyl(0.057, 0.057, 0.025, std('#1d1d1b', .4), 0, 0.33, -0.03, 14)); inner.add(cyl(0.047, 0.047, 0.004, std('#111', .9), 0, 0.344, -0.03, 14));
}
function hakimonoBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, m = pm(it, 'color', .55), sole = std('#2a2622', .8), wood = std('#b89a72', .7), hana = std('#3a2a3a', .6);
  if (s === 'nagagutsu') { bootOne(g, m, sole, -0.07, 0, 0.1, false); bootOne(g, m, sole, 0.1, 0.03, -0.35, true); }
  else {
    for (const sx of [-1, 1]) {
      const f = new THREE.Group(); f.position.set(sx * 0.07, 0, sx * 0.015); f.rotation.y = sx * -0.05; g.add(f);
      if (s === 'geta') { f.add(rbox(0.1, 0.025, 0.23, 0.01, wood, 0, 0.055, 0)); for (const z of [-0.06, 0.06]) f.add(box(0.09, 0.04, 0.025, wood, 0, 0.022, z)); }
      else if (s === 'zori') f.add(rbox(0.1, 0.022, 0.24, 0.012, std('#d9c9a0', .9), 0, 0.011, 0));
      else { f.add(rbox(0.1, 0.03, 0.25, 0.012, std('#3a3330', .7), 0, 0.015, 0)); f.add(rbox(0.105, 0.05, 0.1, 0.025, m, 0, 0.045, 0.05)); continue; }
      const top = s === 'geta' ? 0.07 : 0.024; rod(f, s === 'geta' ? hana : m, [0, top, 0.07], [-0.045, top + 0.02, -0.02], 0.012, true); rod(f, s === 'geta' ? hana : m, [0, top, 0.07], [0.045, top + 0.02, -0.02], 0.012, true);
    }
  }
  return fitStyle(g, it);
}

// ---- 下駄箱(和風の木の靴箱) ----
// 部分:本体 / 戸 / 取っ手。上に物を置ける高さ
function getabakoBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, body = pm(it, 'body', .45), door = pm(it, 'door', .45), kn = pm(it, 'knob', .35, .7), z = d / 2;
  g.add(box(w - 0.02, 0.06, d - 0.03, std('#2a2018', .7), 0, 0.03, -0.01)); g.add(box(w, h - 0.09, d - 0.01, body, 0, 0.06 + (h - 0.09) / 2, -0.005)); g.add(box(w + 0.03, 0.03, d + 0.02, body, 0, h - 0.015, 0.005));
  const n = Math.max(2, Math.round(w / 0.45)), dw = (w - 0.02) / n, y0 = 0.07, y1 = h - 0.04;
  for (let i = 0; i < n; i++) { const x = -w / 2 + 0.01 + dw * (i + 0.5);
    if (s === 'koushi') { g.add(box(dw - 0.008, y1 - y0, 0.014, door, x, (y0 + y1) / 2, z + 0.005)); for (let k = 1; k < 6; k++) g.add(box(0.01, y1 - y0 - 0.06, 0.008, body, x - dw / 2 + k * dw / 6, (y0 + y1) / 2, z + 0.014)); }
    else { const ym = y0 + (y1 - y0) * 0.5; for (const [a, b] of [[y0, ym], [ym, y1]]) { g.add(box(dw - 0.008, b - a - 0.008, 0.014, door, x, (a + b) / 2, z + 0.005)); g.add(box(dw * 0.6, (b - a) * 0.6, 0.004, body, x, (a + b) / 2, z + 0.013)); } }
    const kx = x + (i % 2 ? -1 : 1) * (dw / 2 - 0.035); g.add(box(0.012, 0.06, 0.014, kn, kx, (y0 + y1) / 2 + (s === 'koushi' ? 0 : 0.05), z + 0.02)); }
  return g;
}

// ---- 衝立 ----
// 部分:わく / 面
function tsuitateBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, fr = pm(it, 'frame', .45), W = 0.9, H = 1.2, ph = 0.95, py = 0.2;
  for (const sx of [-1, 1]) { g.add(rbox(0.06, 0.06, 0.35, 0.02, fr, sx * (W / 2 - 0.04), 0.03, 0)); }
  for (const sx of [-1, 1]) g.add(box(0.04, H - 0.06, 0.04, fr, sx * (W / 2 - 0.04), 0.06 + (H - 0.06) / 2, 0));
  g.add(box(W, 0.04, 0.045, fr, 0, H - 0.02, 0)); g.add(box(W - 0.08, 0.035, 0.035, fr, 0, py, 0));
  const pw = W - 0.12, pcy = py + 0.02 + ph / 2 - 0.02, pH = H - 0.04 - py - 0.02;
  if (s === 'shoji') {
    g.add(box(pw, pH, 0.006, std('#ede6d2', .95), 0, py + 0.02 + pH / 2, 0));
    for (let k = 1; k < 4; k++) g.add(box(0.012, pH, 0.016, fr, -pw / 2 + k * pw / 4, py + 0.02 + pH / 2, 0));
    for (let k = 1; k < 5; k++) g.add(box(pw, 0.012, 0.016, fr, 0, py + 0.02 + k * pH / 5, 0));
  } else if (s === 'ajiro') {
    const m = paint('ajiro', 128, 128, (c, W2, H2) => { c.fillStyle = '#9a7a52'; c.fillRect(0, 0, W2, H2); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { c.fillStyle = (x + y) % 2 ? 'rgba(60,40,20,.35)' : 'rgba(255,240,210,.15)'; c.save(); c.translate(x * 8 + 4, y * 8 + 4); c.rotate(((x + Math.floor(y / 2)) % 2) ? 0 : Math.PI / 2); c.fillRect(-4, -1.6, 8, 3.2); c.restore(); } }, .9);
    m.map.repeat.set(3, 3); g.add(box(pw, pH, 0.01, m, 0, py + 0.02 + pH / 2, 0));
  } else { g.add(box(pw, pH, 0.01, std('#e6dcc2', .9), 0, py + 0.02 + pH / 2, 0)); for (const zz of [0.0055, -0.0055]) { const p = plane(pw * 0.9, pH * 0.9, jikuArt('sansui'), 0, py + 0.02 + pH / 2, zz); if (zz < 0) p.rotation.y = Math.PI; g.add(p); } }
  void pcy; return fitStyle(g, it);
}

// ---- 傘立て(和) ----
// 部分:立て / 傘
function kasatateBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, m = pm(it, 'stand', .5), um = pm(it, 'umbrella', .6);
  if (s === 'take') { const bm = m; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.add(box(0.03, 0.5, 0.008, bm, Math.cos(a) * 0.11, 0.25, Math.sin(a) * 0.11).rotateY(-a + Math.PI / 2)); } for (const y of [0.08, 0.42]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.008, 4, 20), std('#5a4a30', .7)); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); } g.add(cyl(0.11, 0.11, 0.02, std('#2a2420', .7), 0, 0.01, 0, 16)); }
  else { g.add(cyl(0.12, 0.11, 0.5, m, 0, 0.25, 0, 20)); g.add(cyl(0.125, 0.125, 0.03, m, 0, 0.49, 0, 20)); g.add(cyl(0.1, 0.1, 0.004, std('#1a1614', .9), 0, 0.505, 0, 20)); }
  if (it.opts.umb) { const cols = [um, std('#2a2a2c', .6), std('#7a6a4a', .7)];
    [[0.03, 0.02, 0.12], [-0.04, -0.02, -0.1], [0.0, -0.05, 0.05]].forEach(([x, z, t], i) => { const u = new THREE.Group(); u.position.set(x, 0.03, z); u.rotation.z = t; u.rotation.x = -t * 0.5; g.add(u);
      u.add(cyl(0.006, 0.035, 0.62, cols[i], 0, 0.45, 0, 8)); u.add(cyl(0.004, 0.004, 0.2, std('#6a5a40', .6), 0, 0.85, 0, 6)); if (i < 2) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 5, 10, Math.PI), std('#4a3a28', .6)); h.position.set(0.03, 0.95, 0); h.rotation.z = Math.PI; u.add(h); } else u.add(cyl(0.012, 0.012, 0.03, std('#4a3a28', .6), 0, 0.96, 0, 8)); }); }
  return fitStyle(g, it);
}

// ---- 昭和の小物(急須と湯のみ・蚊取り線香・うちわ・新聞の束) ----
// 部分:色。lift でちゃぶ台(330)などの上へ
function wakomonoBuild(it) {
  const g = new THREE.Group(), s = styleOf(it).id, m = pm(it, 'color', .4);
  if (s === 'kyusu') {
    // お盆に急須・湯のみ2つ・茶托
    g.add(cyl(0.16, 0.15, 0.015, std('#3a2216', .35), 0, 0.0075, 0, 28));
    g.add(ell(0.055, m, -0.05, 0.065, -0.03, 1, 0.82, 1)); g.add(cyl(0.035, 0.04, 0.012, m, -0.05, 0.115, -0.03, 14)); g.add(sph(0.01, m, -0.05, 0.127, -0.03));
    rod(g, m, [-0.0, 0.06, -0.03], [0.04, 0.1, -0.03], 0.014, true); rod(g, m, [-0.1, 0.07, -0.03], [-0.17, 0.08, -0.03], 0.018, true);
    for (const [x, z] of [[0.07, 0.07], [-0.03, 0.09]]) { g.add(cyl(0.04, 0.04, 0.006, std('#4a2e1e', .4), x, 0.018, z, 16)); g.add(cyl(0.032, 0.026, 0.065, std('#d9cfb8', .35), x, 0.054, z, 16)); g.add(cyl(0.028, 0.028, 0.002, std('#7a8a4a', .2), x, 0.084, z, 14)); }
  } else if (s === 'katori') {
    // 豚の蚊やり+うずまきの線香
    g.add(ell(0.08, m, 0, 0.08, 0, 1.25, 0.95, 1)); const mouth = cyl(0.055, 0.055, 0.01, std('#1a1614', .9), 0, 0.08, 0.1, 18); mouth.rotation.x = Math.PI / 2; g.add(mouth);
    for (const sx of [-1, 1]) { g.add(cyl(0.015, 0.018, 0.03, m, sx * 0.05, 0.015, 0.03, 8)); g.add(cyl(0.015, 0.018, 0.03, m, sx * 0.05, 0.015, -0.04, 8)); const ear = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.035, 6), m); ear.position.set(sx * 0.045, 0.155, 0.04); g.add(ear); }
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.003, 4, 20), std('#3e5a34', .8)); coil.position.set(0, 0.08, 0.098); g.add(coil); const coil2 = coil.clone(); coil2.scale.setScalar(0.6); g.add(coil2);
  } else if (s === 'uchiwa') {
    const face = paint('uchiwa', 64, 64, (c, W, H) => { c.fillStyle = '#efe8d8'; c.fillRect(0, 0, W, H); c.fillStyle = '#4a6a9a'; c.beginPath(); c.arc(40, 26, 12, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(80,60,40,.4)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(32, 64); c.lineTo(i * 8, 0); c.stroke(); } }, .9, { side: THREE.DoubleSide });
    const disc = mesh(new THREE.CircleGeometry(0.12, 24), face, 0, 0.006, -0.04); disc.rotation.x = -Math.PI / 2; g.add(disc); g.add(box(0.016, 0.008, 0.14, std('#a88a5a', .6), 0, 0.006, 0.13));
  } else {
    // 新聞の束(ひもでしばる)
    const pp = std('#ddd6c4', .95), ln = std('#cfc6b0', .95);
    for (let i = 0; i < 8; i++) g.add(box(0.41, 0.022, 0.27, i % 2 ? ln : pp, (i % 3 - 1) * 0.006, 0.011 + i * 0.022, (i % 2) * 0.006));
    const tie = std('#d8cfa8', .9); g.add(box(0.425, 0.006, 0.006, tie, 0, 0.18, 0)); g.add(box(0.006, 0.006, 0.285, tie, 0, 0.18, 0));
    for (const sz of [-1, 1]) { g.add(box(0.006, 0.18, 0.006, tie, 0, 0.09, sz * 0.142)); g.add(box(0.006, 0.18, 0.006, tie, sz * 0.212, 0.09, 0)); }
  }
  return fitStyle(g, it);
}

export const WAFU = {
  chabudai: { name: 'ちゃぶ台・座卓', emoji: '🍵', cat: '和の家具', kind: 'floor', size: [0.75, 0.33, 0.75], range: { w: [0.4, 2.2], h: [0.02, 0.5], d: [0.4, 1.4] }, color: 'w_walnut', opts: { lift: 0 }, words: ['ちゃぶ台', 'ちゃぶだい', '座卓', '丸いちゃぶ台', '和室のテーブル'],
    parts: [{ key: 'top', name: '天板', pal: 'wood', def: 'w_walnut' }, { key: 'legs', name: '脚・幕板', pal: 'wood', def: 'w_walnut' }],
    styles: [
      { id: 'round', name: '丸いちゃぶ台(脚を折りたためる)', size: [0.75, 0.33, 0.75], words: ['丸いちゃぶ台', 'ちゃぶ台', '折りたたみちゃぶ台'] },
      { id: 'large', name: '座卓(大・長方形)', size: [1.5, 0.33, 0.9], words: ['座卓', '大きい座卓', '長い座卓'], parts: { top: 'w_walnut', legs: 'w_walnut' } },
      { id: 'mid', name: '座卓(中)', size: [1.2, 0.33, 0.75], words: ['中くらいの座卓', '小さい座卓'], parts: { top: 'w_medium', legs: 'w_walnut' } },
      { id: 'tenban', name: '掘りごたつ・こたつの天板(板だけ)', size: [0.9, 0.03, 0.9], words: ['天板', 'こたつの天板', '掘りごたつの天板'], parts: { top: 'w_medium' }, opts: { lift: 0 } },
    ],
    params: [LIFT], build: chabudaiBuild },
  kotatsu: { name: 'こたつ・掘りごたつ', emoji: '🟫', cat: '和の家具', kind: 'floor', size: [1.05, 0.39, 0.75], range: { w: [0.6, 2.2], h: [0.3, 0.5], d: [0.5, 1.6] }, color: '#6e4a3a', fabric: 'plain', opts: { futon: true, heat: false }, words: ['こたつ', '炬燵', '家具調こたつ', '掘りごたつ', '掘り炬燵', 'ほりごたつ'],
    parts: [{ key: 'futon', name: 'こたつ布団', pal: 'fabric', def: '#6e4a3a' }, { key: 'top', name: '天板', pal: 'wood', def: 'w_walnut' }, { key: 'frame', name: 'わく・脚', pal: 'wood', def: 'w_walnut' }],
    styles: [
      { id: 'kagu', name: '家具調こたつ', size: [1.05, 0.39, 0.75], words: ['家具調こたつ', 'こたつ', '炬燵'] },
      { id: 'hori', name: '掘りごたつ(床に掘ってある)', size: [1.3, 0.4, 1.0], words: ['掘りごたつ', '掘り炬燵', 'ほりごたつ'], opts: { futon: false, heat: false } },
    ],
    params: [['futon', 'こたつ布団をかける', 'bool'], ['heat', 'ヒーターを点ける(家具調)', 'bool']], build: kotatsuBuild },
  zabuton: { name: '座布団(和)', emoji: '🟪', cat: '和の家具', kind: 'floor', size: [0.55, 0.07, 0.59], range: { w: [0.4, 0.8], h: [0.03, 0.15], d: [0.4, 0.8] }, color: '#5b3f5c', fabric: 'plain', opts: {}, words: ['紫の座布団', '紺の座布団', '柄の座布団', '和の座布団', 'かすりの座布団'],
    parts: [{ key: 'cover', name: '側地', pal: 'fabric', def: '#5b3f5c' }, { key: 'tassel', name: '房', pal: 'color', def: '#8a6a3a' }],
    styles: [
      { id: 'murasaki', name: '紫(くすんだ色)', size: [0.55, 0.07, 0.59], words: ['紫の座布団'] },
      { id: 'kon', name: '紺', size: [0.55, 0.07, 0.59], words: ['紺の座布団'], parts: { cover: '#2e3850', tassel: '#6d5a3a' } },
      { id: 'gara', name: '柄(かすり)', size: [0.55, 0.07, 0.59], words: ['柄の座布団', 'かすりの座布団'], parts: { cover: '#33405a', tassel: '#7a3a34' } },
      { id: 'big', name: '大きい座布団(客用)', size: [0.63, 0.09, 0.68], words: ['客用の座布団', '大きい座布団'], parts: { cover: '#6a3a3a', tassel: '#c0a060' } },
    ],
    build: zabutonBuild },
  zaisu: { name: '座椅子・脇息', emoji: '🪑', cat: '和の家具', kind: 'floor', size: [0.52, 0.55, 0.7], range: { w: [0.3, 0.8], h: [0.2, 0.9], d: [0.15, 0.9] }, color: '#6a4a3e', fabric: 'plain', opts: {}, words: ['和の座椅子', '座椅子(和)', '脇息', 'きょうそく', 'ひじかけ座椅子'],
    parts: [{ key: 'seat', name: '座面・背', pal: 'fabric', def: '#6a4a3e' }, { key: 'frame', name: 'わく', pal: 'wood', def: 'w_black' }],
    styles: [
      { id: 'zaisu', name: '座椅子(背もたれ)', size: [0.52, 0.55, 0.7], words: ['和の座椅子'] },
      { id: 'hiji', name: '座椅子(ひじかけつき)', size: [0.62, 0.55, 0.7], words: ['ひじかけ座椅子'], parts: { seat: '#4f4a3a' } },
      { id: 'kyousoku', name: '脇息(ひじを置く台)', size: [0.6, 0.32, 0.2], words: ['脇息', 'きょうそく'], parts: { seat: '#5b3f5c', frame: 'w_walnut' } },
    ],
    build: zaisuBuild },
  butsudan: { name: '仏壇', emoji: '🪔', cat: '和の家具', kind: 'floor', size: [0.55, 1.4, 0.5], range: { w: [0.3, 1.2], h: [0.4, 2.0], d: [0.25, 0.8] }, color: 'w_walnut', opts: { open: true, lift: 0 }, words: ['仏壇', 'ぶつだん', '上置き仏壇', '小さい仏壇'],
    parts: [{ key: 'body', name: '本体', pal: 'wood', def: 'w_walnut' }, { key: 'inner', name: '中の飾り', pal: 'metal', def: 'm_gold' }],
    styles: [
      { id: 'dai', name: '台つき仏壇', size: [0.55, 1.4, 0.5], words: ['仏壇', '台つき仏壇'] },
      { id: 'uwaoki', name: '上置き(小さい・たんすの上)', size: [0.42, 0.62, 0.34], words: ['上置き仏壇', '小さい仏壇'], parts: { body: 'w_black' } },
    ],
    params: [['open', '扉を開ける', 'bool'], LIFT], build: butsudanBuild },
  tansu: { name: '茶だんす・水屋・整理だんす', emoji: '🗄️', cat: '和の家具', kind: 'floor', size: [0.9, 1.0, 0.4], range: { w: [0.5, 1.8], h: [0.5, 2.0], d: [0.3, 0.6] }, color: 'w_walnut', opts: {}, words: ['茶だんす', '茶箪笥', '水屋', '水屋だんす', '食器だんす', '整理だんす', '整理箪笥'],
    parts: [{ key: 'body', name: '本体', pal: 'wood', def: 'w_walnut' }, { key: 'front', name: '戸・引き出し', pal: 'wood', def: 'w_walnut' }, { key: 'knob', name: '取っ手', pal: 'metal', def: 'm_black' }],
    styles: [
      { id: 'cha', name: '茶だんす(ガラス戸)', size: [0.9, 1.0, 0.4], words: ['茶だんす', '茶箪笥'] },
      { id: 'mizuya', name: '水屋だんす(背が高い)', size: [1.0, 1.75, 0.45], words: ['水屋', '水屋だんす', '食器だんす'], parts: { front: 'w_medium' } },
      { id: 'seiri', name: '整理だんす(引き出し)', size: [0.9, 1.1, 0.45], words: ['整理だんす', '整理箪笥'], parts: { body: 'w_medium', front: 'w_medium', knob: 'm_black' } },
    ],
    build: tansuBuild },
  kyoudai: { name: '鏡台', emoji: '🪞', cat: '和の家具', kind: 'floor', size: [0.62, 1.15, 0.36], range: { w: [0.35, 1.0], h: [0.6, 1.8], d: [0.25, 0.6] }, color: 'w_walnut', opts: { cover: false }, words: ['鏡台', 'きょうだい', '三面鏡の鏡台', '和の鏡台'],
    parts: [{ key: 'body', name: '本体', pal: 'wood', def: 'w_walnut' }, { key: 'cover', name: 'かけ布', pal: 'color', def: '#5e3a40' }],
    styles: [
      { id: 'sanmen', name: '三面鏡(すわって使う)', size: [0.62, 1.15, 0.36], words: ['三面鏡の鏡台', '鏡台'] },
      { id: 'ichimen', name: '一面鏡(縦長)', size: [0.45, 1.45, 0.34], words: ['一面鏡の鏡台'], opts: { cover: true } },
    ],
    params: [['cover', '布のカバーをかける', 'bool']], build: kyoudaiBuild },
  ikou: { name: '衣桁(着物を掛ける)', emoji: '👘', cat: '和の家具', kind: 'floor', size: [1.4, 1.5, 0.42], range: { w: [0.8, 2.0], h: [1.0, 1.9], d: [0.3, 0.6] }, color: 'w_walnut', opts: { cloth: false }, words: ['衣桁', 'いこう', '着物掛け', '着物かけ'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_walnut' }, { key: 'cloth', name: '掛けた布', pal: 'color', def: '#4a5470' }],
    styles: [
      { id: 'empty', name: '何も掛けない', size: [1.4, 1.5, 0.42], words: ['衣桁'] },
      { id: 'cloth', name: '着物を掛ける', size: [1.4, 1.5, 0.42], words: ['着物掛け', '着物かけ'], opts: { cloth: true } },
    ],
    params: [['cloth', '着物を掛ける', 'bool']], build: ikouBuild },
  hashiradokei: { name: '柱時計(振り子)', emoji: '🕰️', cat: '和の家具', kind: 'wall', size: [0.3, 0.64, 0.13], range: { w: [0.2, 0.6], h: [0.4, 1.2], d: [0.08, 0.25] }, color: 'w_walnut', opts: {}, words: ['柱時計', 'はしらどけい', 'ボンボン時計', '昔の柱時計', '昔の時計'],
    parts: [{ key: 'case', name: '木のわく', pal: 'wood', def: 'w_walnut' }, { key: 'face', name: '文字盤', pal: 'color', def: '#efe6cf' }],
    styles: [
      { id: 'maru', name: '丸い顔', size: [0.3, 0.64, 0.13], words: ['柱時計', 'ボンボン時計'] },
      { id: 'hakkaku', name: '八角の顔', size: [0.3, 0.64, 0.13], words: ['八角時計'], parts: { case: 'w_black' } },
      { id: 'kaku', name: '四角い顔', size: [0.33, 0.66, 0.13], words: ['四角い柱時計'], parts: { case: 'w_medium' } },
    ],
    build: hashiraBuild },
  denwa: { name: '黒電話・電話台', emoji: '☎️', cat: '和の家具', kind: 'floor', size: [0.42, 0.85, 0.32], range: { w: [0.15, 0.8], h: [0.08, 1.2], d: [0.15, 0.6] }, color: '#151515', opts: { lift: 0 }, words: ['黒電話', 'くろでんわ', 'ダイヤル電話', '電話台', '昔の電話'],
    parts: [{ key: 'phone', name: '電話', pal: 'color', def: '#151515' }, { key: 'stand', name: '電話台', pal: 'wood', def: 'w_walnut' }],
    styles: [
      { id: 'dai', name: '電話台に黒電話', size: [0.42, 0.85, 0.32], words: ['電話台'] },
      { id: 'phone', name: '黒電話だけ', size: [0.21, 0.16, 0.23], words: ['黒電話', 'ダイヤル電話'] },
    ],
    params: [LIFT], build: denwaBuild },
  stove: { name: '石油ストーブ', emoji: '🔥', cat: '和の家具', kind: 'floor', size: [0.48, 0.56, 0.48], range: { w: [0.3, 0.7], h: [0.35, 0.8], d: [0.25, 0.7] }, color: '#b8b3a3', opts: { on: false, kettle: true }, words: ['石油ストーブ', 'ストーブ', '反射式ストーブ', '丸いストーブ', 'だるまストーブ'],
    parts: [{ key: 'body', name: '本体', pal: 'color', def: '#b8b3a3' }],
    styles: [
      { id: 'maru', name: '丸い(まわりが暖まる)', size: [0.48, 0.56, 0.48], words: ['丸いストーブ', '石油ストーブ'] },
      { id: 'hansha', name: '反射式(四角い)', size: [0.45, 0.5, 0.3], words: ['反射式ストーブ'], parts: { body: '#8c9488' } },
    ],
    params: [['on', '火を点ける', 'bool'], ['kettle', '上にやかん', 'bool']], build: stoveBuild },
  senpuki: { name: '扇風機(昔の)', emoji: '🌀', cat: '和の家具', kind: 'floor', size: [0.36, 0.9, 0.32], range: { w: [0.25, 0.5], h: [0.4, 1.2], d: [0.2, 0.45] }, color: '#e6e1d0', opts: {}, words: ['扇風機', 'せんぷうき', '昔の扇風機'],
    parts: [{ key: 'body', name: '本体', pal: 'color', def: '#e6e1d0' }, { key: 'blade', name: '羽根', pal: 'color', def: '#7fb0c4' }],
    styles: [
      { id: 'floor', name: '床置き(背の高い)', size: [0.36, 0.9, 0.32], words: ['扇風機'] },
      { id: 'desk', name: '卓上(低い)', size: [0.34, 0.5, 0.3], words: ['卓上扇風機', '小さい扇風機'], parts: { body: '#9fb8a8', blade: '#e8e4d8' } },
    ],
    build: senpukiBuild },
  walight: { name: '和の照明', emoji: '🏮', cat: '和の家具', kind: 'ceiling', size: [0.45, 0.85, 0.45], range: { w: [0.1, 0.7] }, color: 'w_walnut', opts: { on: true, drop: 0.5, power: 1 }, words: ['和紙の照明', '和風ペンダント', '和室の照明', '丸い蛍光灯', '蛍光灯', '裸電球', '引きひも'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_walnut' }],
    styles: [
      { id: 'washi', name: '和紙の四角い笠', size: [0.45, 0.85, 0.45], words: ['和紙の照明', '和風ペンダント', '和室の照明'] },
      { id: 'keikou', name: '丸い蛍光灯(引きひも)', size: [0.5, 0.95, 0.5], words: ['丸い蛍光灯', '蛍光灯', '引きひも'], opts: { on: true, drop: 0.35, power: 1 } },
      { id: 'hadaka', name: '裸電球', size: [0.1, 0.75, 0.1], words: ['裸電球'], opts: { on: true, drop: 0.6, power: 1 } },
    ],
    params: [['drop', '下げる長さ(天井から)', 0.1, 1.1, 'mm'], ['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']], build: walightBuild },
  waceil: { name: '和風シーリングライト', emoji: '🏮', cat: '照明', kind: 'ceiling', size: [0.55, 0.13, 0.55], range: { w: [0.35, 0.9] }, color: 'w_natural', opts: { on: true, power: 1, warm: true }, words: ['和風シーリング', '和風シーリングライト', '和室のシーリング', '和室の天井の照明', '組子の照明', '和紙のシーリング'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_natural' }],
    styles: [
      { id: 'kaku', name: '角形・木わく+和紙', words: ['和風シーリング', '和紙のシーリング'] },
      { id: 'kumiko', name: '組子(麻の葉ふう)', words: ['組子の照明', '組子'] },
      { id: 'usu', name: '薄型・木のふち', words: ['薄型の和風シーリング'] },
      { id: 'maru', name: '丸形・木のふち+和紙', words: ['丸い和風シーリング'] },
    ],
    params: [['power', '明るさ', 0.2, 2], ['warm', '電球色(オレンジ)', 'bool'], ['on', '点ける', 'bool']], build: waceilBuild },
  wafuton: { name: '布団(和室に敷く)', emoji: '🛏️', cat: '和の家具', kind: 'floor', size: [1.0, 0.2, 2.1], range: { w: [0.7, 1.6], h: [0.1, 0.9], d: [0.6, 2.3] }, color: '#6a4a58', fabric: 'plain', opts: {}, words: ['和室の布団', '敷いた布団', 'たたんだ布団', '布団を敷く', '布団を積む', 'せんべい布団'],
    parts: [{ key: 'kake', name: '掛け布団', pal: 'fabric', def: '#6a4a58' }, { key: 'shiki', name: '敷布団', pal: 'color', def: '#e3dac6' }, { key: 'makura', name: '枕', pal: 'color', def: '#ece6d6' }],
    styles: [
      { id: 'shiku', name: '敷いた布団(1組)', size: [1.0, 0.2, 2.1], words: ['敷いた布団', '布団を敷く'] },
      { id: 'tatamu', name: 'たたんで積んだ', size: [1.0, 0.55, 0.7], words: ['たたんだ布団', '布団を積む'], parts: { kake: '#4c5a6e' } },
    ],
    build: futonBuild },
  kakejiku: { name: '掛け軸', emoji: '🖼️', cat: '和の家具', kind: 'wall', size: [0.5, 1.7, 0.03], range: { w: [0.25, 1.0], h: [0.6, 2.2], d: [0.01, 0.06] }, color: '#6a6048', opts: {}, words: ['掛け軸', 'かけじく', '床の間の掛け軸', '山水画', '書の掛け軸'],
    parts: [{ key: 'cloth', name: '表装の布', pal: 'color', def: '#6a6048' }, { key: 'tip', name: '軸先', pal: 'color', def: '#2a1c14' }],
    styles: [
      { id: 'sansui', name: '山と霞の絵', size: [0.5, 1.7, 0.03], words: ['掛け軸', '山水画'] },
      { id: 'sho', name: '墨の書(読めない線)', size: [0.5, 1.7, 0.03], words: ['書の掛け軸'], parts: { cloth: '#4a5048' } },
    ],
    build: kakejikuBuild },
  kabin: { name: '花瓶に花(和)', emoji: '💐', cat: '和の家具', kind: 'floor', size: [0.5, 0.75, 0.3], range: { w: [0.08, 1.0], h: [0.1, 1.2], d: [0.08, 0.6] }, color: '#4a5a62', opts: { lift: 0 }, words: ['花瓶', '生け花', 'いけばな', '一輪挿し', '壺の花', '水盤'],
    parts: [{ key: 'vase', name: '花瓶', pal: 'ceramic', def: '#4a5a62' }, { key: 'flower', name: '花', pal: 'color', def: '#e8e2e6' }],
    styles: [
      { id: 'tsubo', name: '壺に枝もの', size: [0.5, 0.75, 0.3], words: ['花瓶', '壺の花'] },
      { id: 'suiban', name: '水盤の生け花', size: [0.4, 0.45, 0.32], words: ['生け花', 'いけばな', '水盤'], parts: { vase: '#3a3a36', flower: '#d8a040' } },
      { id: 'ichirin', name: '一輪挿し', size: [0.1, 0.38, 0.08], words: ['一輪挿し'], parts: { vase: 'c_ivory', flower: '#b8384a' } },
    ],
    params: [LIFT], build: kabinBuild },
  hakimono: { name: '長靴・草履・下駄', emoji: '🥾', cat: '和の家具', kind: 'floor', size: [0.42, 0.34, 0.36], range: { w: [0.15, 0.6], h: [0.03, 0.5], d: [0.2, 0.5] }, color: '#2f3a2e', opts: {}, words: ['長靴', 'ながぐつ', '草履', 'ぞうり', 'サンダル', 'つっかけ', '下駄', 'げた'],
    parts: [{ key: 'color', name: '色', pal: 'color', def: '#2f3a2e' }],
    styles: [
      { id: 'nagagutsu', name: '長靴(1足・置きっぱなし)', size: [0.42, 0.34, 0.36], words: ['長靴', 'ながぐつ'] },
      { id: 'zori', name: '草履', size: [0.25, 0.04, 0.27], words: ['草履', 'ぞうり'], parts: { color: '#6a3a3a' } },
      { id: 'sandal', name: 'つっかけ(サンダル)', size: [0.26, 0.07, 0.28], words: ['サンダル', 'つっかけ'], parts: { color: '#6a5a4a' } },
      { id: 'geta', name: '下駄', size: [0.25, 0.09, 0.26], words: ['下駄', 'げた'], parts: { color: '#3a2a3a' } },
    ],
    build: hakimonoBuild },
  getabako: { name: '下駄箱(和風・木)', emoji: '👞', cat: '和の家具', kind: 'floor', size: [0.9, 0.95, 0.35], range: { w: [0.5, 2.0], h: [0.6, 1.3], d: [0.25, 0.45] }, color: 'w_walnut', opts: {}, words: ['和風の下駄箱', '木の下駄箱', '昔の下駄箱', '和風の靴箱'],
    parts: [{ key: 'body', name: '本体', pal: 'wood', def: 'w_walnut' }, { key: 'door', name: '戸', pal: 'wood', def: 'w_medium' }, { key: 'knob', name: '取っ手', pal: 'metal', def: 'm_black' }],
    styles: [
      { id: 'hiraki', name: '開き戸(上下2段)', size: [0.9, 0.95, 0.35], words: ['和風の下駄箱', '木の下駄箱'] },
      { id: 'koushi', name: '格子の戸', size: [1.2, 0.95, 0.35], words: ['昔の下駄箱'], parts: { door: 'w_walnut' } },
    ],
    build: getabakoBuild },
  tsuitate: { name: '衝立', emoji: '🪟', cat: '和の家具', kind: 'floor', size: [0.9, 1.2, 0.35], range: { w: [0.5, 1.8], h: [0.6, 1.8], d: [0.2, 0.5] }, color: 'w_walnut', opts: {}, words: ['衝立', 'ついたて', '玄関の衝立'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_walnut' }],
    styles: [
      { id: 'shoji', name: '障子の衝立', size: [0.9, 1.2, 0.35], words: ['衝立', 'ついたて'] },
      { id: 'ajiro', name: '網代(編んだ板)', size: [0.9, 1.2, 0.35], words: ['網代'] },
      { id: 'e', name: '絵の衝立', size: [0.9, 1.2, 0.35], words: ['玄関の衝立', '絵の衝立'] },
    ],
    build: tsuitateBuild },
  kasatate: { name: '傘立て(和)', emoji: '☂️', cat: '和の家具', kind: 'floor', size: [0.25, 0.5, 0.25], range: { w: [0.15, 0.5], h: [0.3, 1.2], d: [0.15, 0.5] }, color: '#7a5a3e', opts: { umb: true }, words: ['和の傘立て', '陶器の傘立て', '竹の傘立て'],
    parts: [{ key: 'stand', name: '傘立て', pal: 'color', def: '#7a5a3e' }, { key: 'umbrella', name: '傘', pal: 'color', def: '#3a4a6a' }],
    styles: [
      { id: 'tsubo', name: '焼き物の筒', size: [0.25, 0.5, 0.25], words: ['陶器の傘立て', '和の傘立て'] },
      { id: 'take', name: '竹', size: [0.25, 0.5, 0.25], words: ['竹の傘立て'], parts: { stand: '#b8a070' } },
    ],
    params: [['umb', '傘をさしておく', 'bool']], build: kasatateBuild },
  wakomono: { name: '昭和の小物', emoji: '🍵', cat: '和の家具', kind: 'floor', size: [0.32, 0.13, 0.32], range: { w: [0.05, 0.8], h: [0.01, 0.5], d: [0.05, 0.6] }, color: '#5a4a3e', opts: { lift: 0 }, words: ['急須', 'きゅうす', '湯のみ', '湯呑み', '蚊取り線香', '蚊やり', 'うちわ', '新聞の束', '古新聞'],
    parts: [{ key: 'color', name: '色', pal: 'color', def: '#5a4a3e' }],
    styles: [
      { id: 'kyusu', name: '急須と湯のみ(お盆)', size: [0.32, 0.13, 0.32], words: ['急須', 'きゅうす', '湯のみ', '湯呑み'] },
      { id: 'katori', name: '蚊取り線香(豚の蚊やり)', size: [0.2, 0.18, 0.22], words: ['蚊取り線香', '蚊やり'], parts: { color: '#7a6a5a' } },
      { id: 'uchiwa', name: 'うちわ(置いた)', size: [0.24, 0.012, 0.36], words: ['うちわ'] },
      { id: 'shinbun', name: '新聞の束', size: [0.43, 0.19, 0.29], words: ['新聞の束', '古新聞'] },
    ],
    params: [LIFT], build: wakomonoBuild },
};
