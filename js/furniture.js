// 家具(ベッド・机・椅子・ソファ・タンスなど)。形(styles)と部分ごとの色(parts)を選べる
// 作り方の決まりは kit.js の「形と部分ごとの色」を見る。向き:正面(足もと・座る側)が +z、背中が -z
import * as THREE from 'three';
import { box, cyl, sph, rbox, std, fabric, pm, styleOf, emissive, light, BLACK, METAL, WARM } from './kit.js';

// ---- ベッド ----
// 部分:掛けふとん(it.color と布の柄)/ わく / シーツ / まくら
function pillows(g, it, w, y, z, mat) {
  const n = w > 1.15 ? 2 : 1, pw = n === 2 ? w * 0.42 : Math.min(0.6, w * 0.62);
  for (let i = 0; i < n; i++) g.add(rbox(pw, 0.11, 0.38, 0.05, mat, n === 2 ? (i ? 1 : -1) * w * 0.23 : 0, y + 0.055, z));
}
// マットレス+掛けふとん+まくら。y0 = マットレスの下の高さ
function bedding(g, it, w, d, y0, th = 0.2, zOff = 0) {
  const sheet = pm(it, 'sheet', .95), pil = pm(it, 'pillow', .95), cov = fabric(it, 1, 1);
  g.add(rbox(w, th, d, 0.035, sheet, 0, y0 + th / 2, zOff));
  const cl = d * 0.68, cz = zOff + d / 2 - cl / 2 + 0.02;
  g.add(rbox(w + 0.05, 0.075, cl, 0.035, cov, 0, y0 + th + 0.03, cz));
  // 横に垂れる部分
  for (const sx of [-1, 1]) g.add(rbox(0.03, Math.min(0.2, th + 0.04), cl - 0.04, 0.012, cov, sx * (w / 2 + 0.02), y0 + th - Math.min(0.2, th + 0.04) / 2 + 0.05, cz));
  pillows(g, it, w, y0 + th, zOff - d / 2 + 0.26, pil);
}
function bedBuild(it) {
  const g = new THREE.Group(), w = it.w, d = it.d, h = it.h, s = styleOf(it).id, fr = pm(it, 'frame', .5), dark = std('#3a3632', .6);
  const head = (hh, t = 0.05) => g.add(box(w + 0.04, hh, t, fr, 0, hh / 2, -d / 2 + t / 2));
  if (s === 'futon') { bedding(g, it, w, d, 0, 0.08); return g; }
  if (s === 'lowbed') { g.add(box(w + 0.1, 0.12, d + 0.04, fr, 0, 0.06, 0.02)); head(Math.max(0.35, h)); bedding(g, it, w - 0.04, d - 0.08, 0.12, 0.2, 0.04); return g; }
  if (s === 'storage') {
    g.add(box(w, 0.32, d - 0.06, fr, 0, 0.16, 0.03)); head(h);
    const dr = std('#00000022', .5); for (let i = 0; i < 2; i++) { const z = -d / 2 + 0.35 + i * (d - 0.5) / 2 + (d - 0.5) / 4; g.add(box(0.005, 0.22, (d - 0.6) / 2, std('#00000033', .6), w / 2 + 0.001, 0.15, z)); g.add(box(0.012, 0.02, 0.18, pm(it, 'frame', .4), w / 2 + 0.008, 0.24, z)); } void dr;
    bedding(g, it, w - 0.04, d - 0.12, 0.32, 0.2, 0.04); return g;
  }
  if (s === 'bunk') {
    const post = 0.06; for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(post, h, post, fr, x * (w / 2 - post / 2), h / 2, z * (d / 2 - post / 2)));
    for (const y of [0.22, h * 0.62]) { for (const sx of [-1, 1]) g.add(box(0.03, 0.12, d - post * 2, fr, sx * (w / 2 - 0.03), y, 0)); for (const sz of [-1, 1]) g.add(box(w - post * 2, 0.12, 0.03, fr, 0, y, sz * (d / 2 - 0.03))); bedding(g, it, w - 0.1, d - 0.1, y + 0.03, 0.12); }
    // 上の段の柵(はしごの所はあける)
    const ty = h * 0.62 + 0.3; g.add(box(0.03, 0.04, d - post * 2, fr, -w / 2 + 0.03, ty, 0)); g.add(box(0.03, 0.04, d * 0.55, fr, w / 2 - 0.03, ty, -d * 0.2)); for (const sz of [-1, 1]) g.add(box(w - post * 2, 0.04, 0.03, fr, 0, ty, sz * (d / 2 - 0.03)));
    // はしご(足もと側の右)
    const lx = w / 2 + 0.02, lz = d / 2 - 0.35; for (const dz of [-0.17, 0.17]) g.add(box(0.03, h * 0.62 + 0.3, 0.03, fr, lx, (h * 0.62 + 0.3) / 2, lz + dz)); for (let k = 1; k <= 4; k++) g.add(box(0.03, 0.025, 0.34, fr, lx, k * (h * 0.62) / 4.6, lz));
    return g;
  }
  if (s === 'medical') {
    const metal = pm(it, 'frame', .35, .5), plastic = std('#e8eaec', .4);
    g.add(box(w - 0.1, 0.1, d - 0.2, metal, 0, 0.42, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.add(cyl(0.02, 0.02, 0.36, metal, x * (w / 2 - 0.1), 0.22, z * (d / 2 - 0.15), 10)); const cw = cyl(0.05, 0.05, 0.03, std(BLACK, .6), x * (w / 2 - 0.1), 0.05, z * (d / 2 - 0.15), 16); cw.rotation.z = Math.PI / 2; g.add(cw); }
    g.add(box(w, 0.75, 0.04, plastic, 0, 0.6, -d / 2 + 0.02)); g.add(box(w, 0.55, 0.04, plastic, 0, 0.5, d / 2 - 0.02));
    // 背もたれを起こしたマットレス
    const sheet = pm(it, 'sheet', .95), cov = fabric(it, 1, 1), back = d * 0.36, th = 0.12, y0 = 0.47;
    g.add(box(w - 0.12, th, d - back - 0.08, sheet, 0, y0 + th / 2, back / 2 + 0.0)); const bk = new THREE.Group(); bk.position.set(0, y0, -d / 2 + 0.04 + back); bk.rotation.x = 0.55; const bm = box(w - 0.12, th, back, sheet, 0, th / 2, -back / 2); bk.add(bm); const pl = rbox(0.55, 0.1, 0.35, 0.04, pm(it, 'pillow', .95), 0, th + 0.05, -back + 0.22); bk.add(pl); g.add(bk);
    g.add(rbox(w - 0.06, 0.06, d * 0.52, 0.03, cov, 0, y0 + th + 0.03, d / 2 - d * 0.26 - 0.06));
    for (const sx of [-1, 1]) { g.add(box(0.025, 0.25, d * 0.42, std('#d6d9dc', .3, .4), sx * (w / 2 - 0.02), y0 + 0.3, -d * 0.12)); }
    return g;
  }
  // 脚つきのふつうのベッド(シングル・セミダブル・ダブル・すのこ・子ども用)
  const legH = s === 'sunoko' ? 0.22 : s === 'kids' ? 0.15 : 0.12, railH = 0.16, y0 = legH + railH - 0.04;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, legH + railH, 0.06, fr, x * (w / 2 - 0.03), (legH + railH) / 2, z * (d / 2 - 0.03)));
  for (const sx of [-1, 1]) g.add(box(0.03, railH, d - 0.06, fr, sx * (w / 2 - 0.015), legH + railH / 2, 0)); g.add(box(w, railH, 0.03, fr, 0, legH + railH / 2, d / 2 - 0.015));
  if (s === 'sunoko') { for (let i = 0; i < 4; i++) g.add(box(w + 0.04, 0.07, 0.03, fr, 0, legH + railH + 0.1 + i * 0.1, -d / 2 + 0.015)); for (const sx of [-1, 1]) g.add(box(0.05, h, 0.05, fr, sx * (w / 2 - 0.005), h / 2, -d / 2 + 0.025)); }
  else head(h);
  if (s === 'double') g.add(box(w + 0.04, 0.42, 0.04, fr, 0, 0.21, d / 2 - 0.02));
  bedding(g, it, w - 0.06, d - 0.08, y0, s === 'kids' ? 0.15 : 0.2, 0.01);
  if (s === 'kids') { const ty = y0 + 0.32; for (const sx of [-1, 1]) { g.add(box(0.03, 0.03, d * 0.6, fr, sx * (w / 2 - 0.015), ty, -d * 0.15)); for (let k = 0; k < 5; k++) g.add(box(0.025, ty - y0, 0.025, fr, sx * (w / 2 - 0.015), (ty + y0) / 2, -d * 0.45 + k * d * 0.15)); } }
  return g;
}

// ---- 共通 ----
const C4 = [[-1, -1], [1, -1], [-1, 1], [1, 1]], UP = new THREE.Vector3(0, 1, 0);
// a から b へ渡す棒(round=true で丸棒)
function rod(g, mat, a, b, t, round = false) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va), len = dir.length();
  const m = round ? cyl(t / 2, t / 2, len, mat, 0, 0, 0, 10) : box(t, len, t, mat); m.position.copy(va.add(vb).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(UP, dir.normalize()); g.add(m); return m;
}
// 形の見本の大きさ(sw,sh,sd)で作って、置いた大きさに合わせてのばす
function fit(inner, it, sw, sh, sd) { const g = new THREE.Group(); inner.scale.set(it.w / sw, it.h / sh, it.d / sd); g.add(inner); return g; }
const ell = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = sph(r, mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
const DARK = '#232428';

// ---- 机の上(パソコン・スタンドライト) ----
function pcSet(g, x, y, zb, zf, monY, laptop) {
  const blk = std(DARK, .5, .2), scr = std('#16222f', .25, 0, { emissive: '#2c4a68', emissiveIntensity: .7 });
  if (laptop) { const z = (zb + zf) / 2 + 0.02; g.add(box(0.34, 0.018, 0.24, blk, x, y + 0.009, z)); g.add(box(0.3, 0.003, 0.11, std('#3a3b40', .7), x, y + 0.019, z + 0.04));
    const lid = new THREE.Group(); lid.position.set(x, y + 0.018, z - 0.12); lid.rotation.x = -0.28; lid.add(box(0.34, 0.23, 0.012, blk, 0, 0.115, 0)); lid.add(box(0.31, 0.2, 0.002, scr, 0, 0.115, 0.007)); g.add(lid); return; }
  const my = monY ?? y, mz = zb + 0.1; g.add(box(0.22, 0.012, 0.16, blk, x, my + 0.006, mz)); g.add(box(0.04, 0.16, 0.025, blk, x, my + 0.09, mz - 0.03));
  g.add(box(0.58, 0.34, 0.03, blk, x, my + 0.13 + 0.17, mz)); g.add(box(0.555, 0.315, 0.002, scr, x, my + 0.13 + 0.17, mz + 0.016));
  g.add(box(0.44, 0.022, 0.14, blk, x, y + 0.011, zf - 0.14)); g.add(rbox(0.06, 0.03, 0.1, 0.012, blk, x + 0.3, y + 0.015, zf - 0.14));
}
function deskLamp(g, x, y, z, side, tall = 0.4) {
  const m = std('#ecebe6', .4, .2), on = emissive('#fff2d6', 2.2), dx = -side * 0.22;
  g.add(cyl(0.065, 0.075, 0.025, m, x, y + 0.0125, z, 20)); rod(g, m, [x, y + 0.02, z], [x + dx * 0.25, y + tall, z + 0.04], 0.018, true);
  rod(g, m, [x + dx * 0.25, y + tall, z + 0.04], [x + dx, y + tall * 0.85, z + 0.08], 0.016, true);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.075, 0.11, 20, 1, true), std('#ecebe6', .4, .2, { side: THREE.DoubleSide })); sh.position.set(x + dx, y + tall * 0.85 - 0.05, z + 0.08); sh.castShadow = true; g.add(sh);
  g.add(sph(0.025, on, x + dx, y + tall * 0.85 - 0.07, z + 0.08)); light(g, WARM, 1.2, x + dx, y + tall * 0.85 - 0.12, z + 0.08, { distance: 2.5 });
}
// 引き出しを縦に n 段(正面 z)
function drawers(g, x, y0, y1, z, w, n, front, knob, ring = false) {
  const hh = (y1 - y0) / n; for (let i = 0; i < n; i++) { const cy = y0 + hh * (i + .5); g.add(box(w - 0.01, hh - 0.01, 0.018, front, x, cy, z + 0.009));
    if (ring) { g.add(box(0.07, 0.035, 0.004, knob, x, cy, z + 0.02)); g.add(box(0.055, 0.007, 0.012, knob, x, cy - 0.01, z + 0.026)); } else g.add(box(Math.min(0.14, w * 0.35), 0.016, 0.02, knob, x, cy + hh * 0.15, z + 0.028)); }
}

// ---- 机 ----
// 部分:天板 / わく・脚
function deskBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, top = pm(it, 'top', .45), fr = pm(it, 'frame', .45, .35), knob = std('#9a9da2', .35, .7);
  let ty = Math.min(0.72, h), ax = 0, aw = w, zb = -d / 2, zf = d / 2, monY = null, laptop = false, lampH = 0.4;
  const leg = (x, z, t = 0.045) => g.add(box(t, ty - 0.03, t, fr, x, (ty - 0.03) / 2, z));
  if (s === 'low') {
    ty = h; g.add(box(w, 0.03, d, top, 0, ty - 0.015, 0)); for (const [x, z] of C4) g.add(box(0.045, ty - 0.03, 0.045, fr, x * (w / 2 - 0.04), (ty - 0.03) / 2, z * (d / 2 - 0.04)));
    g.add(box(w * 0.45, 0.07, d - 0.08, fr, 0, ty - 0.065, -0.02)); g.add(box(w * 0.45 - 0.01, 0.06, 0.016, top, 0, ty - 0.065, d / 2 - 0.06)); g.add(box(0.1, 0.012, 0.015, knob, 0, ty - 0.065, d / 2 - 0.045));
    lampH = 0.38;
  } else if (s === 'lshape') {
    const md = Math.min(0.6, d * 0.55), rw = Math.min(0.55, w * 0.42);
    g.add(box(w, 0.03, md, top, 0, ty - 0.015, -d / 2 + md / 2)); g.add(box(rw, 0.03, d - md, top, -w / 2 + rw / 2, ty - 0.015, -d / 2 + md + (d - md) / 2));
    for (const [x, z] of [[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + md - 0.04], [-w / 2 + 0.04, d / 2 - 0.04], [-w / 2 + rw - 0.04, d / 2 - 0.04]]) leg(x, z, 0.05);
    g.add(box(w - 0.1, 0.25, 0.015, fr, 0, ty - 0.18, -d / 2 + 0.03)); g.add(box(0.015, 0.25, d - 0.1, fr, -w / 2 + 0.03, ty - 0.18, 0));
    ax = rw / 2; aw = w - rw; zf = -d / 2 + md;
  } else {
    g.add(box(w, 0.03, d, top, 0, ty - 0.015, 0));
    if (s === 'study' || s === 'gakushu') {
      const pw = Math.min(0.4, w * 0.38), hd = Math.min(0.26, d * 0.45), hh = h - ty, px = w / 2 - pw / 2;
      g.add(box(pw - 0.02, ty - 0.03, d - 0.03, fr, px, (ty - 0.03) / 2, -0.015)); drawers(g, px, 0.04, ty - 0.04, d / 2 - 0.03, pw - 0.03, s === 'gakushu' ? 3 : 3, fr, knob);
      g.add(box(0.025, ty - 0.03, d - 0.03, fr, -w / 2 + 0.0125, (ty - 0.03) / 2, -0.015)); g.add(box(w - pw - 0.02, 0.4, 0.015, fr, -pw / 2, ty - 0.23, -d / 2 + 0.02));
      if (hh > 0.15) {
        for (const sx of [-1, 1]) g.add(box(0.02, hh, hd, fr, sx * (w / 2 - 0.01), ty + hh / 2, -d / 2 + hd / 2));
        g.add(box(w, 0.022, hd, fr, 0, h - 0.011, -d / 2 + hd / 2)); g.add(box(w - 0.04, 0.02, hd, fr, 0, ty + hh * 0.52, -d / 2 + hd / 2)); g.add(box(w - 0.04, hh, 0.012, fr, 0, ty + hh / 2, -d / 2 + 0.006));
        if (s === 'gakushu') {
          g.add(box(w * 0.5, 0.012, 0.05, emissive('#f2f7ff', 1.2), 0, ty + hh * 0.52 - 0.016, -d / 2 + hd - 0.04)); g.add(box(w * 0.32, hh * 0.38, 0.008, std('#c9a46e', .95), -w / 4, ty + hh * 0.26, -d / 2 + 0.016));
          g.add(box(w * 0.92 - pw * 0.0, 0.004, d - hd - 0.06, std('#3d7a5c', .35), 0, ty + 0.002, -d / 2 + hd + (d - hd) / 2 - 0.01));
          for (let i = 0; i < 5; i++) g.add(box(0.03 + (i % 2) * 0.01, 0.2 - (i % 3) * 0.02, 0.17, std(['#a8392f', '#2f3d5c', '#c79a3c', '#3f5546', '#ece6da'][i], .7), w / 2 - 0.08 - i * 0.045, ty + hh * 0.52 + 0.012 + (0.2 - (i % 3) * 0.02) / 2, -d / 2 + 0.1));
        }
        laptop = true; lampH = Math.min(0.38, hh * 0.52 - 0.06);
      }
      ax = -pw * 0.25; aw = w - pw * 0.5; zb = -d / 2 + (hh > 0.15 ? hd : 0);
    } else if (s === 'pc') {
      for (const [x, z] of C4) leg(x * (w / 2 - 0.04), z * (d / 2 - 0.04), 0.04);
      for (const sx of [-1, 1]) g.add(box(0.03, 0.03, d - 0.08, fr, sx * (w / 2 - 0.04), 0.08, 0));
      const ry = Math.min(h - 0.02, ty + 0.12); for (const sx of [-1, 1]) g.add(box(0.02, ry - ty, 0.24, top, sx * (w / 2 - 0.01), ty + (ry - ty) / 2, -d / 2 + 0.12)); g.add(box(w, 0.02, 0.24, top, 0, ry + 0.01, -d / 2 + 0.12));
      g.add(box(0.28, 0.02, d - 0.1, fr, w / 2 - 0.2, 0.1, 0)); g.add(box(0.02, ty - 0.13, d - 0.1, fr, w / 2 - 0.34, 0.1 + (ty - 0.13) / 2, 0));
      g.add(box(w * 0.55, 0.018, d * 0.5, top, -0.08, ty - 0.1, 0.03)); for (const sx of [-1, 1]) g.add(box(0.02, 0.07, d * 0.5, fr, -0.08 + sx * w * 0.275, ty - 0.06, 0.03));
      monY = ry + 0.02; if (it.opts.pc) g.add(box(0.19, 0.42, 0.42, std(DARK, .5, .2), w / 2 - 0.2, 0.11 + 0.21, 0));
    } else {
      for (const [x, z] of C4) leg(x * (w / 2 - 0.05), z * (d / 2 - 0.05), 0.04);
      g.add(box(w - 0.1, 0.08, 0.02, fr, 0, ty - 0.08, -d / 2 + 0.05)); for (const sx of [-1, 1]) g.add(box(0.02, 0.06, d - 0.1, fr, sx * (w / 2 - 0.05), ty - 0.07, 0));
    }
  }
  if (it.opts.pc) pcSet(g, ax, ty, zb, zf, monY, laptop);
  if (it.opts.lamp) deskLamp(g, ax - aw / 2 + 0.1, ty, zb + 0.1, -1, lampH);
  return g;
}

// ---- 椅子 ----
// 部分:座面・背(布の色と柄)/ わく・脚。形の見本の大きさで作って、置いた大きさにのばす
function starBase(g, fr, r, y = 0.07) {
  const cas = std(DARK, .6); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, cx = Math.sin(a) * r, cz = Math.cos(a) * r; rod(g, fr, [0, y + 0.01, 0], [cx, y - 0.01, cz], 0.035); g.add(sph(0.027, cas, cx, 0.027, cz)); }
  g.add(cyl(0.045, 0.045, 0.05, fr, 0, y + 0.02, 0, 16));
}
function chairBuild(it) {
  const st = styleOf(it), s = st.id, [sw, sh, sd] = st.size, g = new THREE.Group(), seat = fabric(it, 1, 1), fr = pm(it, 'frame', .5, .35), blk = std(DARK, .55, .1), chrome = std('#cfd3d8', .25, .9);
  if (s === 'dining') {
    for (const [x, z] of C4) g.add(cyl(0.016, 0.022, 0.41, fr, x * 0.19, 0.205, z * 0.2, 12));
    g.add(box(0.42, 0.04, 0.42, fr, 0, 0.395, 0.0)); g.add(rbox(0.46, 0.09, 0.47, 0.03, seat, 0, 0.455, 0.02));
    for (const sx of [-1, 1]) rod(g, fr, [sx * 0.19, 0.4, -0.2], [sx * 0.19, 0.62, -0.225], 0.03);
    const bk = new THREE.Group(); bk.position.set(0, 0.48, -0.19); bk.rotation.x = -0.09; bk.add(rbox(0.44, 0.4, 0.07, 0.03, seat, 0, 0.2, 0)); g.add(bk);
  } else if (s === 'office' || s === 'gaming') {
    const gm = s === 'gaming', sy = gm ? 0.5 : 0.47; starBase(g, fr, gm ? 0.31 : 0.27); g.add(cyl(0.025, 0.025, sy - 0.12, chrome, 0, 0.06 + (sy - 0.12) / 2, 0, 12)); g.add(box(0.2, 0.04, 0.2, fr, 0, sy - 0.07, 0));
    g.add(rbox(gm ? 0.5 : 0.5, 0.09, gm ? 0.5 : 0.47, 0.035, seat, 0, sy - 0.02, 0.03)); rod(g, fr, [0, sy - 0.06, -0.06], [0, sy + 0.1, -0.24], 0.05);
    for (const sx of [-1, 1]) { const ax = sx * (gm ? 0.3 : 0.27); g.add(box(0.03, 0.2, 0.05, fr, ax, sy + 0.06, -0.03)); g.add(rbox(0.07, 0.03, 0.25, 0.012, blk, ax, sy + 0.17, 0.0)); }
    const bk = new THREE.Group(); bk.position.set(0, sy + 0.03, -0.2); bk.rotation.x = -0.1; g.add(bk);
    if (!gm) bk.add(rbox(0.46, 0.42, 0.07, 0.035, seat, 0, 0.24, -0.03));
    else {
      for (const sx of [-1, 1]) { g.add(rbox(0.07, 0.1, 0.46, 0.03, blk, sx * 0.235, sy + 0.02, 0.03)); bk.add(rbox(0.08, 0.6, 0.12, 0.03, blk, sx * 0.21, 0.32, 0.01)); }
      bk.add(rbox(0.36, 0.66, 0.08, 0.03, seat, 0, 0.35, -0.01)); bk.add(rbox(0.5, 0.1, 0.1, 0.035, blk, 0, 0.68, -0.01));
      bk.add(rbox(0.24, 0.11, 0.08, 0.04, blk, 0, 0.6, 0.06)); bk.add(rbox(0.3, 0.12, 0.09, 0.04, blk, 0, 0.13, 0.06));
    }
  } else if (s === 'stool' || s === 'bar') {
    const bar = s === 'bar', top = bar ? 0.75 : 0.45, r0 = bar ? 0.13 : 0.12, r1 = bar ? 0.18 : 0.16;
    for (const [x, z] of C4) rod(g, fr, [x * r0 * 0.707, top - 0.05, z * r0 * 0.707], [x * r1 * 0.707, 0, z * r1 * 0.707], bar ? 0.024 : 0.032, true);
    const rr = r0 + (r1 - r0) * (bar ? 0.66 : 0.6), ring = new THREE.Mesh(new THREE.TorusGeometry(rr, bar ? 0.01 : 0.008, 6, 28), fr); ring.rotation.x = Math.PI / 2; ring.position.y = top * (bar ? 0.34 : 0.4); g.add(ring);
    g.add(cyl(0.175, 0.175, 0.03, fr, 0, top - 0.045, 0, 28)); g.add(cyl(0.17, 0.175, 0.035, seat, 0, top - 0.0175, 0, 28));
  } else if (s === 'zaisu') {
    g.add(rbox(0.48, 0.1, 0.46, 0.04, seat, 0, 0.05, 0.11)); for (const sx of [-1, 1]) g.add(box(0.02, 0.07, 0.24, fr, sx * 0.235, 0.05, -0.1));
    const bk = new THREE.Group(); bk.position.set(0, 0.04, -0.1); bk.rotation.x = -0.42; bk.add(box(0.44, 0.5, 0.02, fr, 0, 0.27, -0.05)); bk.add(rbox(0.46, 0.52, 0.09, 0.04, seat, 0, 0.28, 0.0)); g.add(bk);
  } else {
    // 木の椅子
    for (const [x, z] of C4) { const back = z < 0; g.add(box(0.035, back ? 0.85 : 0.405, 0.035, fr, x * 0.2, (back ? 0.85 : 0.405) / 2, z * 0.2)); }
    g.add(box(0.44, 0.03, 0.44, fr, 0, 0.42, 0)); for (const y of [0.6, 0.7, 0.8]) g.add(box(0.37, y > 0.75 ? 0.06 : 0.04, 0.02, fr, 0, y, -0.2));
    for (const sx of [-1, 1]) g.add(box(0.02, 0.02, 0.37, fr, sx * 0.2, 0.15, 0)); g.add(box(0.37, 0.02, 0.02, fr, 0, 0.12, 0.2)); g.add(rbox(0.38, 0.03, 0.36, 0.012, seat, 0, 0.45, 0.03));
  }
  return fit(g, it, sw, sh, sd);
}

// ---- ソファ ----
// 部分:張り地(布の色と柄)/ 脚・わく / クッション
function sofaBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, cov = fabric(it, 1, 1), lg = pm(it, 'legs', .5, .3), cu = pm(it, 'cushion', .9);
  const pillow = (x, y, z, rz, sz = 0.42) => { const p = rbox(sz, sz, 0.13, 0.05, cu, x, y, z); p.rotation.set(-0.28, 0, rz); g.add(p); };
  if (s === 'bed') {
    const ah = Math.min(h - 0.15, 0.58); for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.025); for (const sz of [-1, 1]) g.add(box(0.05, ah, 0.05, lg, x, ah / 2, sz * (d / 2 - 0.025))); g.add(box(0.05, 0.05, d, lg, x, ah - 0.025, 0)); for (const y of [0.12, 0.3]) g.add(box(0.03, 0.06, d - 0.05, lg, x, y, 0)); }
    g.add(box(w - 0.1, 0.03, d - 0.08, lg, 0, 0.23, 0)); g.add(rbox(w - 0.12, 0.15, d - 0.26, 0.05, cov, 0, 0.32, 0.11));
    const bk = new THREE.Group(); bk.position.set(0, 0.27, -d / 2 + 0.17); bk.rotation.x = -0.24; bk.add(rbox(w - 0.12, Math.max(0.3, h - 0.32), 0.15, 0.05, cov, 0, Math.max(0.3, h - 0.32) / 2, 0)); g.add(bk);
    for (const sx of [-1, 1]) pillow(sx * (w / 2 - 0.4), 0.6, -d / 2 + 0.33, sx * 0.08);
    return g;
  }
  const low = s === 'low', one = s === 'one', legH = low ? 0 : 0.12, armW = one ? 0.17 : low ? 0.14 : 0.19, armH = Math.min(h - 0.06, low ? 0.4 : 0.62), seatTop = low ? 0.32 : 0.44, cth = 0.14, bt = 0.19;
  const sd = s === 'couch' ? Math.min(0.95, d * 0.62) : d, cw = s === 'couch' ? Math.min(0.78, w * 0.34) : 0, n = one ? 1 : (s === 'two' || low) ? 2 : s === 'couch' ? 2 : 3;
  const bh = seatTop - cth - legH, base = (x0, x1, z0, z1) => g.add(rbox(x1 - x0, bh, z1 - z0, 0.02, cov, (x0 + x1) / 2, legH + bh / 2, (z0 + z1) / 2));
  base(-w / 2 + 0.02, w / 2 - 0.02, -d / 2, -d / 2 + sd); if (cw) base(w / 2 - armW - cw, w / 2 - 0.02, -d / 2 + sd - 0.05, d / 2);
  const bkT = h - 0.1; g.add(rbox(w, bkT - legH, bt, 0.05, cov, 0, legH + (bkT - legH) / 2, -d / 2 + bt / 2));
  for (const sx of [-1, 1]) { const ad = cw && sx > 0 ? d : sd; g.add(rbox(armW, armH - legH, ad, 0.05, cov, sx * (w / 2 - armW / 2), legH + (armH - legH) / 2, -d / 2 + ad / 2)); }
  const x0 = -w / 2 + armW, x1 = w / 2 - armW - cw, cwid = (x1 - x0) / n, sdep = sd - bt, bkh = Math.max(0.2, h - seatTop - 0.01);
  const seatC = (cx, wd, z0, z1) => g.add(rbox(wd - 0.015, cth, z1 - z0 - 0.01, 0.04, cov, cx, seatTop - cth / 2, (z0 + z1) / 2 + 0.005));
  const backC = (cx, wd) => { const b = rbox(wd - 0.03, bkh, 0.18, 0.08, cov, cx, seatTop + bkh / 2 - 0.02, -d / 2 + bt + 0.1); b.rotation.x = -0.12; g.add(b); };
  for (let i = 0; i < n; i++) { const cx = x0 + cwid * (i + .5); seatC(cx, cwid, -d / 2 + bt, -d / 2 + sd); backC(cx, cwid); }
  if (cw) { seatC(x1 + cw / 2, cw, -d / 2 + bt, d / 2); backC(x1 + cw / 2, cw); }
  if (!low) { const lp = [[-w / 2 + 0.07, -d / 2 + 0.07], [w / 2 - 0.07, -d / 2 + 0.07], [-w / 2 + 0.07, -d / 2 + sd - 0.07], [w / 2 - 0.07, (cw ? d / 2 : -d / 2 + sd) - 0.07]]; if (cw) lp.push([x1 + 0.07, d / 2 - 0.07]); for (const [x, z] of lp) g.add(cyl(0.022, 0.016, legH, lg, x, legH / 2, z, 12)); }
  const pz = -d / 2 + bt + 0.2, py = seatTop + (low ? 0.17 : 0.2), ps = low ? 0.36 : 0.42;
  if (one) pillow(0, py, pz, 0.05, 0.38); else { pillow(x0 + 0.26, py, pz, -0.1, ps); pillow((cw ? x1 + cw : x1) - 0.26, py, pz, 0.1, ps); }
  return g;
}

// ---- タンス ----
// 部分:本体 / 引き出しの前板 / 取っ手
function chestBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, body = pm(it, 'body', .5), front = pm(it, 'front', .5), kn = pm(it, 'knob', .35, .7), z = d / 2 - 0.018;
  const base = s === 'wa' ? 0.05 : 0.06; g.add(box(w - 0.04, base, d - 0.04, body, 0, base / 2, -0.01)); g.add(box(w, h - base - 0.025, d - 0.018, body, 0, base + (h - base - 0.025) / 2, -0.009)); g.add(box(w + 0.02, 0.025, d + 0.01, body, 0, h - 0.0125, 0.005));
  const y0 = base + 0.02, y1 = h - 0.045, iw = w - 0.04;
  if (s === 'wide') { for (const sx of [-1, 1]) drawers(g, sx * iw / 4, y0, y1, z, iw / 2, 2, front, kn); }
  else if (s === 'wa') {
    const r1 = y0 + (y1 - y0) * 0.5, r2 = y0 + (y1 - y0) * 0.78; drawers(g, 0, y0, r1, z, iw, 3, front, kn, true);
    for (const sx of [-1, 1]) { g.add(box(iw / 2 - 0.01, r2 - r1 - 0.01, 0.018, front, sx * iw / 4, (r1 + r2) / 2, z + 0.009)); g.add(box(0.012, 0.06, 0.012, kn, sx * 0.03, (r1 + r2) / 2, z + 0.024)); }
    for (const sx of [-1, 1]) drawers(g, sx * iw / 4, r2, y1, z, iw / 2, 1, front, kn, true);
    for (const sx of [-1, 1]) for (const y of [y0, y1]) g.add(box(0.05, 0.05, 0.004, kn, sx * (w / 2 - 0.03), y, d / 2 - 0.007));
  } else drawers(g, 0, y0, y1, z, iw, s === 'tall' ? 6 : 4, front, kn);
  return g;
}

// ---- ぬいぐるみ ----
// 部分:からだ(布の色と柄)/ リボン / 口もと。見本の大きさで作ってのばす
function plushBuild(it) {
  const st = styleOf(it), [sw, sh, sd] = st.size, rab = st.id === 'rabbit', g = new THREE.Group(), fur = fabric(it, 1, 1), rib = pm(it, 'ribbon', .6), mz = pm(it, 'muzzle', .9), eye = std('#151517', .2);
  // 見本は くま 0.28×0.37×0.3、うさぎ 0.26×0.5×0.3
  g.add(ell(0.1, fur, 0, 0.12, 0, 1, 1.15, 0.9)); g.add(ell(0.085, fur, 0, 0.27, 0.01));
  for (const sx of [-1, 1]) {
    if (rab) g.add(ell(0.03, fur, sx * 0.032, 0.41, -0.005, 0.75, 2.8, 0.55)); else { g.add(ell(0.03, fur, sx * 0.065, 0.335, 0, 1, 1, 0.6)); g.add(ell(0.017, mz, sx * 0.065, 0.335, 0.012, 1, 1, 0.4)); }
    g.add(ell(0.045, fur, sx * 0.06, 0.042, 0.085, 1, 0.85, 1.4)); g.add(ell(0.035, fur, sx * 0.1, 0.15, 0.035, 1, 1.6, 1)); g.add(sph(0.011, eye, sx * 0.03, 0.29, 0.078));
  }
  g.add(ell(0.036, mz, 0, 0.252, 0.075, 1.1, 0.85, 0.75)); g.add(sph(0.012, eye, 0, 0.265, 0.1)); g.add(ell(0.035, mz, 0, 0.12, 0.075, 1.3, 1.5, 0.5));
  for (const sx of [-1, 1]) g.add(ell(0.025, rib, sx * 0.03, 0.2, 0.085, 1.2, 0.8, 0.5)); g.add(sph(0.012, rib, 0, 0.2, 0.09));
  void sw; return fit(g, it, rab ? 0.26 : 0.28, rab ? 0.5 : 0.37, 0.3);
}

// ---- 床のクッション ----
function cushionBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, cov = fabric(it, 1, 1), btn = pm(it, 'button', .6);
  if (s === 'round') { g.add(ell(1, cov, 0, h / 2, 0, w / 2, h / 2, d / 2)); g.add(cyl(0.02, 0.02, 0.01, btn, 0, h - 0.003, 0, 12)); }
  else if (s === 'beads') { g.add(ell(1, cov, 0, h * 0.2, 0, w / 2, h * 0.2, d / 2)); g.add(ell(1, cov, 0, h * 0.5, -d * 0.05, w * 0.44, h * 0.5, d * 0.42)); }
  else if (s === 'square') { const p = rbox(w, h * 0.97, d * 0.75, Math.min(0.06, d * 0.3), cov, 0, h * 0.485, 0); p.rotation.x = -Math.asin(Math.min(0.3, (d * 0.25) / h)); g.add(p); }
  else { g.add(rbox(w, h, d, Math.min(0.03, h * 0.45), cov, 0, h / 2, 0)); g.add(sph(0.012, btn, 0, h - 0.004, 0)); for (const [x, z] of C4) g.add(ell(0.015, btn, x * (w / 2 - 0.005), h / 2, z * (d / 2 - 0.005), 1, 0.6, 1)); }
  return g;
}

// ---- ゴミ箱 ----
function trashBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, body = pm(it, 'body', .45), lid = pm(it, 'lid', .3, .8), dark = std('#2f3033', .9);
  if (s === 'pedal') { const r = Math.min(w, d) / 2 - 0.01; g.add(cyl(r, r * 0.95, h - 0.04, body, 0, (h - 0.04) / 2, 0, 28)); g.add(cyl(r + 0.004, r + 0.004, 0.025, lid, 0, h - 0.04, 0, 28)); const dm = ell(1, lid, 0, h - 0.03, 0, r, 0.03, r); g.add(dm); g.add(box(0.1, 0.02, 0.07, lid, 0, 0.02, d / 2 - 0.035)); return g; }
  if (s === 'bunbetsu') { const bw = w / 2 - 0.006; for (const sx of [-1, 1]) { const x = sx * (w / 4); g.add(box(bw, h - 0.05, d, body, x, (h - 0.05) / 2, 0)); g.add(box(bw + 0.004, 0.05, d + 0.004, lid, x, h - 0.025, 0)); g.add(box(bw * 0.6, 0.004, d * 0.4, dark, x, h, 0.02)); g.add(box(bw * 0.4, 0.06, 0.004, std(sx < 0 ? '#3d7fd0' : '#d0583d', .5), x, h * 0.6, d / 2 + 0.002)); } return g; }
  const r = Math.min(w, d) / 2; g.add(cyl(r, r * 0.82, h - 0.004, body, 0, (h - 0.004) / 2, 0, 28)); const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.004, 0.006, 6, 32), lid); rim.rotation.x = Math.PI / 2; rim.position.y = h - 0.006; g.add(rim); g.add(cyl(r - 0.008, r - 0.008, 0.002, dark, 0, h - 0.003, 0, 28));
  g.add(ell(1, std('#e9e7e1', .9), r * 0.15, h - 0.004, 0, r * 0.4, 0.025, r * 0.35)); return g;
}

// ---- スタンドミラー ----
function mirrorBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, fr = pm(it, 'frame', .45, .2), glass = std('#e3eaee', .05, .9);
  if (s === 'oval') {
    const mw = w - 0.08, mh = h - 0.25, cy = 0.2 + mh / 2;
    for (const sx of [-1, 1]) { g.add(box(0.03, cy + 0.05, 0.03, fr, sx * (w / 2 - 0.015), (cy + 0.05) / 2, 0)); g.add(box(0.035, 0.03, d, fr, sx * (w / 2 - 0.015), 0.015, 0)); }
    const pv = new THREE.Group(); pv.position.set(0, cy, 0); pv.rotation.x = -0.08; g.add(pv);
    const disc = (rx, ry, t, m, z) => { const c = cyl(1, 1, t, m, 0, 0, z, 40); c.rotation.x = Math.PI / 2; c.scale.set(rx, 1, ry); pv.add(c); };
    disc(mw / 2, mh / 2, 0.025, fr, 0); disc(mw / 2 - 0.025, mh / 2 - 0.025, 0.004, glass, 0.014); for (const sx of [-1, 1]) pv.add(box(mw / 2 - 0.0, 0.012, 0.012, fr, sx * mw / 4 + sx * 0.02, 0, -0.01));
    return g;
  }
  const lean = s === 'lean', t = lean ? 0.04 : 0.03, a = Math.asin(Math.min(0.35, (d - t - 0.04) / h) * (lean ? 1 : 0.55)), L = (h - 0.01) / Math.cos(a), fz = d / 2 - t;
  const pv = new THREE.Group(); pv.position.set(0, 0.005, fz); pv.rotation.x = -a; g.add(pv);
  const fw = lean ? 0.06 : 0.035; pv.add(box(w, L, t, fr, 0, L / 2, 0)); pv.add(box(w - fw * 2, L - fw * 2, 0.004, glass, 0, L / 2, t / 2 + 0.002));
  if (!lean) { const ty = L * 0.6, top = [0, ty * Math.cos(a), fz - ty * Math.sin(a) - t / 2]; rod(g, fr, top, [0, 0.01, -d / 2 + 0.02], 0.025); }
  return g;
}

// ---- かご(本・雑貨) ----
function basketBuild(it) {
  const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, s = styleOf(it).id, m = pm(it, 'basket', .85), tint = std('#000000', .9, 0, { transparent: true, opacity: .2 }), in_ = std('#3b2e22', .9), fill = it.opts.fill !== false;
  const nb = Math.max(3, Math.round(h / 0.045));
  if (s === 'square') {
    g.add(box(w, h, d, m, 0, h / 2, 0)); for (let i = 1; i < nb; i++) g.add(box(w + 0.005, 0.01, d + 0.005, tint, 0, i * h / nb, 0)); g.add(box(w - 0.03, 0.002, d - 0.03, in_, 0, h + 0.001, 0)); g.add(box(w + 0.012, 0.018, d + 0.012, m, 0, h - 0.009, 0));
    for (const sx of [-1, 1]) g.add(box(0.004, 0.03, d * 0.35, std('#2a2018', .9), sx * (w / 2 + 0.002), h - 0.05, 0));
    if (fill) { const cols = ['#a8392f', '#2f3d5c', '#e9e2cf', '#3f5546', '#c79a3c', '#6b4a33']; let x = -w / 2 + 0.04; for (let i = 0; x < w * 0.15; i++) { const bt = 0.025 + (i % 3) * 0.008, bh = Math.min(h + 0.12, h * 0.75 + 0.06 + (i % 2) * 0.03); g.add(box(bt, bh, d * 0.62, std(cols[i % cols.length], .7), x + bt / 2, bh / 2 + 0.01, -0.01)); x += bt + 0.003; }
      g.add(cyl(0.035, 0.035, h * 0.6, std('#d9c7a6', .8), w / 2 - 0.08, h * 0.3 + 0.12, 0.02, 14)); g.add(ell(0.05, std('#c3b2dc', .9), w / 2 - 0.1, h - 0.01, -0.06, 1.2, 0.6, 1)); }
    return g;
  }
  const r = Math.min(w, d) / 2, rb = s === 'tall' ? r * 0.92 : r * 0.82; g.add(cyl(r, rb, h, m, 0, h / 2, 0, 28));
  for (let i = 1; i < nb; i++) { const rr = rb + (r - rb) * i / nb + 0.003; g.add(cyl(rr, rr, 0.01, tint, 0, i * h / nb, 0, 28)); }
  g.add(cyl(r - 0.012, r - 0.012, 0.002, in_, 0, h + 0.001, 0, 28)); const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 32), m); rim.rotation.x = Math.PI / 2; rim.position.y = h; g.add(rim);
  if (fill) { if (s === 'tall') { g.add(ell(1, std('#b9c4cf', .95), -r * 0.2, h + 0.02, 0, r * 0.65, 0.09, r * 0.7)); g.add(cyl(0.05, 0.05, r * 1.4, std('#e5d9c3', .95), r * 0.25, h + 0.03, 0, 14).rotateZ(Math.PI / 2)); }
    else { for (const [x, z, c] of [[-0.06, 0.03, '#e8e2d6'], [0.07, -0.04, '#b9cbd8'], [0.0, 0.08, '#e7c9c4']]) g.add(ell(1, std(c, .95), x * r * 5, h - 0.01, z * r * 4, r * 0.45, 0.05, r * 0.35)); } }
  return g;
}

export const FURNITURE = {
  bed: { name: 'ベッド', emoji: '🛏️', cat: '家具', kind: 'floor', size: [0.97, 0.9, 2.0], range: { w: [0.6, 2.0], h: [0.1, 2.0], d: [1.4, 2.3] }, color: '#e9e4d8', fabric: 'linen', opts: {}, words: ['ベッド', '寝床', 'べっど', 'ふとん', '布団'],
    parts: [{ key: 'cover', name: '掛けふとん', pal: 'fabric', def: '#e9e4d8' }, { key: 'frame', name: 'わく', pal: 'wood', def: 'w_natural' }, { key: 'sheet', name: 'シーツ', pal: 'color', def: '#f6f4ee' }, { key: 'pillow', name: 'まくら', pal: 'color', def: '#ffffff' }],
    styles: [
      { id: 'single', name: 'シングル', size: [0.97, 0.9, 2.0], words: ['シングル'] },
      { id: 'semidouble', name: 'セミダブル', size: [1.2, 0.9, 2.0], words: ['セミダブル'] },
      { id: 'double', name: 'ダブル', size: [1.4, 1.0, 2.05], words: ['ダブル'] },
      { id: 'lowbed', name: 'ローベッド', size: [1.2, 0.55, 2.1], words: ['ローベッド', 'フロアベッド'], parts: { frame: 'w_walnut' } },
      { id: 'sunoko', name: 'すのこベッド', size: [0.97, 0.75, 2.0], words: ['すのこ'], parts: { frame: 'w_white' } },
      { id: 'storage', name: '収納付き', size: [0.97, 0.85, 2.0], words: ['収納ベッド', '収納付き', '引き出し'], parts: { frame: 'f_white' } },
      { id: 'bunk', name: '二段ベッド', size: [1.0, 1.6, 2.05], words: ['二段ベッド', '2段ベッド', '二段'], parts: { cover: '#9ec9ea' } },
      { id: 'kids', name: '子ども用', size: [0.85, 0.65, 1.6], words: ['子ども用ベッド', '子供用ベッド', 'キッズベッド'], parts: { cover: '#e8a7b8', frame: 'w_white' } },
      { id: 'futon', name: 'ふとん(床に敷く)', size: [1.0, 0.15, 2.1], words: ['ふとん', '布団', '敷布団'], parts: { cover: '#c3b2dc' } },
      { id: 'medical', name: '病院・介護ベッド', size: [0.95, 0.8, 2.1], words: ['病院のベッド', '介護ベッド', '電動ベッド'], parts: { cover: '#dfe9ee', frame: 'f_lgray' } },
    ],
    build: bedBuild },
  desk: { name: '机', emoji: '🖥️', cat: '家具', kind: 'floor', size: [1.2, 0.72, 0.6], range: { w: [0.6, 2.4], h: [0.3, 1.6], d: [0.4, 1.8] }, color: 'w_oak', opts: { pc: false, lamp: false }, words: ['机', 'デスク', 'つくえ', 'ワークデスク'],
    params: [['pc', 'パソコンをのせる', 'bool'], ['lamp', 'スタンドライト', 'bool']],
    parts: [{ key: 'top', name: '天板', pal: 'wood', def: 'w_oak' }, { key: 'frame', name: 'わく・脚', pal: 'wood', def: 'f_black' }],
    styles: [
      { id: 'plain', name: 'ふつうの机', size: [1.2, 0.72, 0.6], words: ['ふつうの机', 'ワークデスク'] },
      { id: 'study', name: '勉強机(棚・引き出しつき)', size: [1.0, 1.2, 0.6], words: ['勉強机', '棚付きの机', '棚つきの机'], parts: { top: 'w_light', frame: 'f_white' } },
      { id: 'lshape', name: 'L字デスク', size: [1.4, 0.72, 1.2], words: ['L字デスク', 'L字の机', 'エル字'], parts: { top: 'w_walnut', frame: 'f_black' } },
      { id: 'pc', name: 'パソコンデスク(モニター台つき)', size: [1.2, 0.86, 0.6], words: ['パソコンデスク', 'PCデスク', 'パソコン机'], opts: { pc: true }, parts: { top: 'w_gray', frame: 'f_black' } },
      { id: 'gakushu', name: '学習机(昔ながら)', size: [1.0, 1.25, 0.65], words: ['学習机', '学習デスク', '子どもの机', '子供の机'], opts: { pc: false, lamp: true }, parts: { top: 'w_medium', frame: 'w_medium' } },
      { id: 'low', name: 'ローデスク(床に座る)', size: [1.0, 0.36, 0.5], words: ['ローデスク', '座卓デスク', '低い机'], parts: { top: 'w_natural', frame: 'w_natural' } },
    ],
    build: deskBuild },
  chair: { name: '椅子', emoji: '🪑', cat: '家具', kind: 'floor', size: [0.45, 0.85, 0.45], color: '#c9b9a0', fabric: 'plain', opts: {}, words: ['椅子', 'いす', 'チェア'],
    parts: [{ key: 'seat', name: '座面・背', pal: 'fabric', def: '#c9b9a0' }, { key: 'frame', name: 'わく・脚', pal: 'wood', def: 'w_natural' }],
    styles: [
      { id: 'wood', name: '木の椅子', size: [0.45, 0.85, 0.45], words: ['木の椅子', '木製の椅子'] },
      { id: 'dining', name: 'ダイニングチェア(布張り)', size: [0.46, 0.88, 0.52], words: ['ダイニングチェア', '布張りの椅子', '食卓の椅子'], parts: { seat: '#8f9a8a', frame: 'w_walnut' } },
      { id: 'office', name: '事務椅子(キャスター)', size: [0.6, 0.95, 0.6], words: ['事務椅子', 'オフィスチェア', 'デスクチェア', 'キャスター'], parts: { seat: '#3d4450', frame: 'f_black' } },
      { id: 'gaming', name: 'ゲーミングチェア', size: [0.68, 1.3, 0.68], words: ['ゲーミングチェア', 'ゲーム用の椅子'], parts: { seat: '#b8323a', frame: 'f_black' } },
      { id: 'stool', name: 'スツール', size: [0.36, 0.45, 0.36], words: ['スツール', '丸椅子', '丸いす'], parts: { seat: '#d8c8ad', frame: 'w_oak' } },
      { id: 'bar', name: 'カウンタースツール(高い)', size: [0.4, 0.75, 0.4], words: ['カウンタースツール', 'バースツール', 'ハイスツール'], parts: { seat: '#4b4e54', frame: 'f_black' } },
      { id: 'zaisu', name: '座椅子', size: [0.5, 0.55, 0.7], words: ['座椅子', 'ざいす'], parts: { seat: '#7d6a5a', frame: 'f_black' } },
    ],
    build: chairBuild },
  sofa: { name: 'ソファ', emoji: '🛋️', cat: '家具', kind: 'floor', size: [1.9, 0.8, 0.9], range: { w: [0.7, 3.4], h: [0.5, 1.1], d: [0.7, 2.0] }, color: '#8c8f98', fabric: 'linen', opts: {}, words: ['ソファ', 'ソファー', '長椅子'],
    parts: [{ key: 'cover', name: '張り地', pal: 'fabric', def: '#8c8f98' }, { key: 'legs', name: '脚・わく', pal: 'wood', def: 'w_walnut' }, { key: 'cushion', name: 'クッション', pal: 'color', def: '#d9cfbf' }],
    styles: [
      { id: 'three', name: '3人がけ', size: [1.9, 0.8, 0.9], words: ['3人がけ', '三人掛け', '3人掛け', '3人用'] },
      { id: 'one', name: '1人がけ', size: [0.85, 0.8, 0.85], words: ['1人がけ', '一人掛け', '1人掛け', '1人用', 'ひとりがけ'], parts: { cover: '#b9a68a', cushion: '#6f7d6a' } },
      { id: 'two', name: '2人がけ', size: [1.5, 0.8, 0.85], words: ['2人がけ', '二人掛け', '2人掛け', '2人用'], parts: { cover: '#c9c2b4', cushion: '#c79a3c' } },
      { id: 'couch', name: 'L字(カウチ)', size: [2.4, 0.8, 1.55], words: ['L字ソファ', 'カウチソファ', 'カウチ', 'コーナーソファ'], parts: { cover: '#6f7480', cushion: '#e9e2cf', legs: 'm_black' } },
      { id: 'low', name: 'ローソファ', size: [1.6, 0.6, 0.85], words: ['ローソファ', '低いソファ', 'フロアソファ'], parts: { cover: '#a99d8c', cushion: '#d4aaa3' } },
      { id: 'bed', name: 'ソファベッド', size: [1.9, 0.85, 0.9], words: ['ソファベッド', 'ソファーベッド'], parts: { cover: '#3f4a5c', legs: 'w_natural', cushion: '#e8d9b8' } },
    ],
    build: sofaBuild },
  chest: { name: 'タンス・チェスト', emoji: '🗄️', cat: '家具', kind: 'floor', size: [0.8, 0.85, 0.45], color: 'w_natural', opts: {}, words: ['タンス', 'たんす', '箪笥', 'チェスト', '引き出し'],
    parts: [{ key: 'body', name: '本体', pal: 'wood', def: 'w_natural' }, { key: 'front', name: '引き出しの前', pal: 'wood', def: 'w_natural' }, { key: 'knob', name: '取っ手', pal: 'metal', def: 'm_steel' }],
    styles: [
      { id: 'chest4', name: 'チェスト(4段)', size: [0.8, 0.85, 0.45], words: ['チェスト', '4段'] },
      { id: 'tall', name: '背の高いタンス(6段)', size: [0.6, 1.2, 0.42], words: ['背の高いタンス', '6段', 'ハイチェスト'], parts: { body: 'f_white', front: 'f_white', knob: 'm_black' } },
      { id: 'wide', name: '横長の低いチェスト', size: [1.2, 0.6, 0.45], words: ['横長のチェスト', 'ローチェスト', '低いタンス'], parts: { body: 'w_walnut', front: 'w_walnut', knob: 'm_gold' } },
      { id: 'wa', name: '和だんす', size: [1.0, 1.3, 0.45], words: ['和だんす', '和箪笥', '桐たんす', '桐のたんす'], parts: { body: 'w_light', front: 'w_light', knob: 'm_black' } },
    ],
    build: chestBuild },
  plush: { name: 'ぬいぐるみ', emoji: '🧸', cat: '小物', kind: 'floor', size: [0.28, 0.37, 0.3], range: { w: [0.1, 1.2], h: [0.12, 1.5], d: [0.1, 1.2] }, color: '#b98a5a', fabric: 'velvet', opts: {}, words: ['ぬいぐるみ', 'くま', 'クマ', 'テディベア'],
    parts: [{ key: 'body', name: 'からだ', pal: 'fabric', def: '#b98a5a' }, { key: 'ribbon', name: 'リボン', pal: 'color', def: '#c0392b' }, { key: 'muzzle', name: '口もと・耳', pal: 'color', def: '#e8d3b5' }],
    styles: [
      { id: 'bear', name: 'くま(すわり)', size: [0.28, 0.37, 0.3], words: ['くま', 'クマ', 'テディベア'] },
      { id: 'bigbear', name: '大きいくま', size: [0.6, 0.8, 0.64], words: ['大きいくま', '大きなくま'], parts: { body: '#e3d6c0', ribbon: '#7d93a8' } },
      { id: 'rabbit', name: 'うさぎ', size: [0.26, 0.5, 0.3], words: ['うさぎ', 'ウサギ'], parts: { body: '#f1ece4', ribbon: '#d4aaa3', muzzle: '#efd4d4' } },
    ],
    build: plushBuild },
  floorCushion: { name: 'クッション(床)', emoji: '🟫', cat: '小物', kind: 'floor', size: [0.55, 0.08, 0.59], color: '#a8392f', fabric: 'plain', opts: {}, words: ['座布団', 'ざぶとん', 'フロアクッション', 'ビーズクッション', 'クッション'],
    parts: [{ key: 'cover', name: 'カバー', pal: 'fabric', def: '#a8392f' }, { key: 'button', name: 'ボタン・房', pal: 'color', def: '#c79a3c' }],
    styles: [
      { id: 'zabuton', name: '座布団', size: [0.55, 0.08, 0.59], words: ['座布団', 'ざぶとん'] },
      { id: 'round', name: '丸いフロアクッション', size: [0.55, 0.16, 0.55], words: ['丸いクッション', 'フロアクッション'], parts: { cover: '#8a9a82', button: '#3f5546' } },
      { id: 'beads', name: 'ビーズクッション', size: [0.65, 0.45, 0.65], words: ['ビーズクッション', '人をダメにする'], parts: { cover: '#c79a3c' } },
      { id: 'square', name: '四角いクッション(立てる)', size: [0.45, 0.45, 0.18], words: ['四角いクッション', '背もたれクッション'], parts: { cover: '#7d93a8' } },
    ],
    build: cushionBuild },
  trash: { name: 'ゴミ箱', emoji: '🗑️', cat: '小物', kind: 'floor', size: [0.26, 0.32, 0.26], color: '#f2f1ec', opts: {}, words: ['ゴミ箱', 'ごみ箱', 'くずかご', 'ダストボックス'],
    parts: [{ key: 'body', name: '本体', pal: 'color', def: '#f2f1ec' }, { key: 'lid', name: 'ふち・ふた', pal: 'metal', def: 'm_steel' }],
    styles: [
      { id: 'round', name: '丸いゴミ箱', size: [0.26, 0.32, 0.26], words: ['丸いゴミ箱', 'くずかご'] },
      { id: 'pedal', name: 'ふたつき(ペダル)', size: [0.3, 0.45, 0.32], words: ['ペダル', 'ふたつきゴミ箱', 'ふた付きゴミ箱'], parts: { body: '#c4c9ce', lid: 'm_chrome' } },
      { id: 'bunbetsu', name: '分別(2つ)', size: [0.5, 0.55, 0.32], words: ['分別', '分別ゴミ箱'], parts: { body: '#f4f4f2', lid: 'm_white' } },
    ],
    build: trashBuild },
  standMirror: { name: 'スタンドミラー', emoji: '🪞', cat: '家具', kind: 'floor', size: [0.4, 1.55, 0.4], range: { w: [0.25, 1.2], h: [0.6, 2.0], d: [0.15, 0.7] }, color: 'w_natural', opts: {}, words: ['スタンドミラー', '姿見', '全身鏡', '全身ミラー'],
    parts: [{ key: 'frame', name: 'わく', pal: 'wood', def: 'w_natural' }],
    styles: [
      { id: 'stand', name: 'スタンドミラー(うしろ脚)', size: [0.4, 1.55, 0.4], words: ['スタンドミラー', '姿見'] },
      { id: 'lean', name: '立てかけ大型ミラー', size: [0.7, 1.75, 0.3], words: ['立てかけミラー', '大きい鏡', 'ウォールミラー'], parts: { frame: 'f_black' } },
      { id: 'oval', name: '楕円のミラー(脚つき)', size: [0.5, 1.6, 0.45], words: ['楕円', 'だ円', 'オーバル'], parts: { frame: 'w_walnut' } },
    ],
    build: mirrorBuild },
  basket: { name: 'かご(本・雑貨)', emoji: '🧺', cat: '小物', kind: 'floor', size: [0.4, 0.25, 0.3], color: '#c4a274', opts: { fill: true }, words: ['かご', 'カゴ', 'バスケット', '洗濯かご'], params: [['fill', 'なかみを入れる', 'bool']],
    parts: [{ key: 'basket', name: 'かご', pal: 'color', def: '#c4a274' }],
    styles: [
      { id: 'square', name: '四角いかご(本・雑貨)', size: [0.4, 0.25, 0.3], words: ['本のかご', '雑貨のかご', '四角いかご'] },
      { id: 'round', name: '丸い洗濯かご', size: [0.45, 0.4, 0.45], words: ['洗濯かご', 'ランドリー'], parts: { basket: '#e9e2cf' } },
      { id: 'tall', name: '背の高いかご(ブランケット)', size: [0.38, 0.5, 0.38], words: ['ブランケット', '背の高いかご'], parts: { basket: '#8f6b43' } },
    ],
    build: basketBuild },
};
