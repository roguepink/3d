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
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
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
  return paint('kasuri' + color, 128, 128, (c, W, H) => { c.fillStyle = color; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(235,228,212,.55)';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 32 + (y % 2) * 16 + 8, cy = y * 32 + 12; c.fillRect(cx - 7, cy - 1.5, 14, 3); c.fillRect(cx - 1.5, cy - 7, 3, 14); }
    c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 60; i++) c.fillRect((i * 37) % W, (i * 53) % H, 2, 1); }, .95);
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
  while (x < x1 - 0.06) { const k = i++ % 4;
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
  g.add(box(w - 0.03, 0.05, d - 0.03, body, 0, 0.025, -0.01)); g.add(box(w, h - 0.08, d - 0.02, body, 0, 0.05 + (h - 0.08) / 2, -0.01)); g.add(box(w + 0.02, 0.03, d + 0.01, body, 0, h - 0.015, 0.0));
  if (s === 'seiri') {
    const y0 = 0.06, y1 = h - 0.04, top = y1 - (y1 - y0) * 0.17;
    for (const sx of [-1, 1]) waDrawers(g, sx * iw / 4, top, y1, z, iw / 2, 1, front, kn, true);
    waDrawers(g, 0, y0, top, z, iw, 4, front, kn, true);
    return g;
  }
  // ガラス戸の中(奥の板と棚と食器)
  const glassBox = (ya, yb) => { g.add(box(iw, yb - ya - 0.004, 0.01, back, 0, (ya + yb) / 2, -d / 2 + 0.03)); const mid = (ya + yb) / 2; g.add(box(iw, 0.015, d - 0.08, body, 0, mid, -0.02)); dishes(g, -iw / 2, iw / 2, ya + 0.005, 0.0, 1); dishes(g, -iw / 2, iw / 2, mid + 0.008, 0.0, 3); };
  if (s === 'cha') {
    const a = 0.06, b = h * 0.42, c = h * 0.55, e = h - 0.04;
    slideDoors(g, iw, a, b, z - 0.014, front, kn, null);
    waDrawers(g, 0, b + 0.005, c - 0.005, z, iw, 1, front, kn, false); for (const x of [-iw / 3, iw / 3]) g.add(box(0.006, c - b - 0.01, 0.018, body, x, (b + c) / 2, z + 0.002));
    glassBox(c, e); slideDoors(g, iw, c + 0.005, e, z - 0.014, front, kn, glass);
  } else {
    // 水屋だんす:下の引き戸・引き出しの段・ガラス戸・いちばん上の小さい戸(天袋)
    const a = 0.06, b = h * 0.34, c = h * 0.45, e = h * 0.88, f = h - 0.035;
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
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,30,20,.35)'); c.fillStyle = gr; c.fillRect(0, h * 0.75, w, h * 0.25); }, .9, { side: THREE.DoubleSide });
    // 着物の形(袖を広げた T の形)を、上の棒の前とうしろに
    const sh = new THREE.Shape(); const sw = 0.68, bw = 0.32, top = H - 0.03, sl = 0.48, bot = 0.12;
    sh.moveTo(-sw, top); sh.lineTo(sw, top); sh.lineTo(sw, top - sl); sh.lineTo(bw, top - sl); sh.lineTo(bw + 0.02, bot); sh.lineTo(-bw - 0.02, bot); sh.lineTo(-bw, top - sl); sh.lineTo(-sw, top - sl); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh); const uv = geo.attributes.uv, p = geo.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + sw) / (sw * 2) * 1.2, p.getY(i) / H * 2);
    for (const zz of [0.03, -0.03]) { const m = mesh(geo, mat, 0, 0, zz); g.add(m); }
    g.add(box(sw * 2, 0.02, 0.07, mat, 0, top + 0.005, 0));
    g.add(box(0.06, top - bot - 0.1, 0.004, std('#e8dcc4', .8), -0.06, (top + bot) / 2 - 0.05, 0.033));
  }
  return fitStyle(g, it);
}

export const WAFU = {
  chabudai: { name: 'ちゃぶ台・座卓', emoji: '🍵', cat: '和の家具', kind: 'floor', size: [0.75, 0.33, 0.75], range: { w: [0.4, 2.2], h: [0.02, 0.5], d: [0.4, 1.4] }, color: 'w_walnut', opts: { lift: 0 }, words: ['ちゃぶ台', 'ちゃぶだい', '座卓', '丸いちゃぶ台', '和室のテーブル'],
    parts: [{ key: 'top', name: '天板', pal: 'wood', def: 'w_walnut' }, { key: 'legs', name: '脚・幕板', pal: 'wood', def: 'w_walnut' }],
    styles: [
      { id: 'round', name: '丸いちゃぶ台(脚を折りたためる)', size: [0.75, 0.33, 0.75], words: ['丸いちゃぶ台', 'ちゃぶ台', '折りたたみちゃぶ台'] },
      { id: 'large', name: '座卓(大・長方形)', size: [1.5, 0.33, 0.9], words: ['座卓', '大きい座卓', '長い座卓'], parts: { top: 'w_walnut', legs: 'w_black' } },
      { id: 'mid', name: '座卓(中)', size: [1.2, 0.33, 0.75], words: ['中くらいの座卓', '小さい座卓'], parts: { top: 'w_medium', legs: 'w_walnut' } },
      { id: 'tenban', name: '掘りごたつ・こたつの天板(板だけ)', size: [0.9, 0.03, 0.9], words: ['天板', 'こたつの天板', '掘りごたつの天板'], parts: { top: 'w_medium' }, opts: { lift: 0 } },
    ],
    params: [LIFT], build: chabudaiBuild },
  kotatsu: { name: 'こたつ・掘りごたつ', emoji: '🟫', cat: '和の家具', kind: 'floor', size: [1.05, 0.39, 0.75], range: { w: [0.6, 2.2], h: [0.3, 0.5], d: [0.5, 1.6] }, color: '#7a5a48', fabric: 'plain', opts: { futon: true, heat: false }, words: ['こたつ', '炬燵', '家具調こたつ', '掘りごたつ', '掘り炬燵', 'ほりごたつ'],
    parts: [{ key: 'futon', name: 'こたつ布団', pal: 'fabric', def: '#7a5a48' }, { key: 'top', name: '天板', pal: 'wood', def: 'w_walnut' }, { key: 'frame', name: 'わく・脚', pal: 'wood', def: 'w_black' }],
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
  kyoudai: { name: '鏡台', emoji: '🪞', cat: '和の家具', kind: 'floor', size: [0.62, 1.15, 0.36], range: { w: [0.35, 1.0], h: [0.6, 1.8], d: [0.25, 0.6] }, color: 'w_walnut', opts: { cover: false }, words: ['鏡台', 'きょうだい', '三面鏡', '一面鏡'],
    parts: [{ key: 'body', name: '本体', pal: 'wood', def: 'w_walnut' }, { key: 'cover', name: 'かけ布', pal: 'color', def: '#7a3e48' }],
    styles: [
      { id: 'sanmen', name: '三面鏡(すわって使う)', size: [0.62, 1.15, 0.36], words: ['三面鏡', '鏡台'] },
      { id: 'ichimen', name: '一面鏡(縦長)', size: [0.45, 1.45, 0.34], words: ['一面鏡'], opts: { cover: true } },
    ],
    params: [['cover', '布のカバーをかける', 'bool']], build: kyoudaiBuild },
  ikou: { name: '衣桁(着物を掛ける)', emoji: '👘', cat: '和の家具', kind: 'floor', size: [1.4, 1.5, 0.42], range: { w: [0.8, 2.0], h: [1.0, 1.9], d: [0.3, 0.6] }, color: 'w_black', opts: { cloth: false }, words: ['衣桁', 'いこう', '着物掛け', '着物かけ'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_black' }, { key: 'cloth', name: '掛けた布', pal: 'color', def: '#4a5470' }],
    styles: [
      { id: 'empty', name: '何も掛けない', size: [1.4, 1.5, 0.42], words: ['衣桁'] },
      { id: 'cloth', name: '着物を掛ける', size: [1.4, 1.5, 0.42], words: ['着物掛け', '着物かけ'], opts: { cloth: true } },
    ],
    params: [['cloth', '着物を掛ける', 'bool']], build: ikouBuild },
};
