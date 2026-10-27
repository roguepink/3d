// 水まわり(キッチン・トイレ・洗面台)。形(styles)と部分ごとの色(parts:扉・天板・取っ手など)を選べる
// 作り方の決まりは kit.js の「形と部分ごとの色」を見る。向き:正面(人が立つ側)が +z、壁側が -z
import * as THREE from 'three';
import { box, cyl, rbox, std, pm, styleOf, emissive, light, METAL } from './kit.js';

const GAP = 0.004, TH = 0.02, INNER = '#34332f';
const shade = op => std('#0c0c0c', .6, 0, { transparent: true, opacity: op });
const glass = () => std('#16161a', .12, .3);
const mirrorMat = () => std('#eef2f6', .05, .9);
const led = () => emissive('#fff6e6', 1.3);
// kit の rbox は角の丸み分だけ幅・高さが大きくなるので、外の寸法どおりにする
const rb = (w, h, d, r, ...a) => rbox(w - 2 * r, h - 2 * r, d, r, ...a);

// 扉・引き出しの1枚(表面が z)。取っ手 hd:'top' 'bottom'=横の棒 / 'l' 'r'=縦の棒(上より) / 'lb' 'rb'=縦の棒(下より) / ''=なし
function front(g, mat, hm, x, y, w, h, z, hd) {
  g.add(box(w - GAP, h - GAP, TH, mat, x, y, z - TH / 2)); if (!hd) return;
  if (hd === 'top' || hd === 'bottom') { g.add(box(Math.min(w * 0.62, 0.6), 0.013, 0.018, hm, x, y + (hd === 'top' ? 1 : -1) * (h / 2 - 0.035), z + 0.009)); return; }
  const s = hd[0] === 'l' ? -1 : 1, hh = Math.min(0.2, h * 0.45), dy = hd[1] === 'b' ? -(h / 2 - hh / 2 - 0.05) : (h > 0.45 ? h / 2 - hh / 2 - 0.06 : 0);
  g.add(box(0.013, hh, 0.018, hm, x + s * (w / 2 - 0.035), y + dy, z + 0.009));
}
// レバー1つの水栓(根もとが x,y,z、口は +z へ)
function faucet(g, hm, x, y, z, tall = 0.24, reach = 0.17) {
  g.add(cyl(0.024, 0.028, 0.03, hm, x, y + 0.015, z, 16)); g.add(cyl(0.017, 0.019, tall, hm, x, y + tall / 2, z, 14));
  const sp = cyl(0.012, 0.014, reach, hm, x, y + tall - 0.015, z + reach / 2, 12); sp.rotation.x = Math.PI / 2 - 0.12; g.add(sp);
  g.add(box(0.016, 0.012, 0.09, hm, x, y + tall + 0.012, z - 0.03));
}
// ---- システムキッチン ----
// 部分:扉 / 天板 / 取っ手・水栓 / シンク / レンジフード
function kmats(it) { return { door: pm(it, 'door', .45), top: pm(it, 'top', .3), hm: pm(it, 'metal', .3, .8), sink: pm(it, 'sink', .3, .8), hood: pm(it, 'hood', .35, .5), inner: std(INNER, .85) }; }
// 1つのユニットの前の面。k:'d3' 引き出し3段 / 'sink' 2段 / 'hob' グリル+2段 / 'door' 開き扉 / 'doors' 両開き / 'panel' 取っ手なしの板 / 'blank' なし
function modFront(g, M, k, x, w, y0, y1, z) {
  const H = y1 - y0; if (k === 'blank') return;
  if (k === 'door' || k === 'panel') { front(g, M.door, M.hm, x, (y0 + y1) / 2, w, H, z, k === 'door' ? 'r' : ''); return; }
  if (k === 'doors') { for (const s of [-1, 1]) front(g, M.door, M.hm, x + s * w / 4, (y0 + y1) / 2, w / 2, H, z, s < 0 ? 'r' : 'l'); return; }
  let hs = k === 'sink' ? [0.4] : k === 'hob' ? [0.19, 0.33] : [0.25, 0.36]; hs = hs.map(f => f * H); hs.push(H - hs.reduce((a, b) => a + b, 0));
  let y = y1; hs.forEach((h, i) => { if (k === 'hob' && i === 0) { g.add(box(w - 0.06, h - 0.012, TH, glass(), x, y - h / 2, z - TH / 2)); g.add(box(w * 0.5, 0.013, 0.018, M.hm, x, y - 0.03, z + 0.009)); } else front(g, M.door, M.hm, x, y - h / 2, w, h, z, 'top'); y -= h; });
}
function sinkAt(g, M, x, z, H, mw, D) {
  const sw = Math.min(0.78, mw - 0.1), sd = Math.min(0.46, D - 0.2);
  g.add(box(sw, 0.004, sd, M.sink, x, H + 0.002, z)); g.add(box(sw - 0.05, 0.003, sd - 0.05, shade(.32), x, H + 0.0045, z)); g.add(cyl(0.045, 0.045, 0.003, std('#555a60', .3, .8), x + sw * 0.25, H + 0.006, z + 0.05, 16));
  faucet(g, M.hm, x - sw * 0.15, H, z - sd / 2 - 0.045, 0.28, 0.2);
}
function hobAt(g, M, x, z, H, mw) {
  const hw = Math.min(0.6, mw - 0.1); g.add(box(hw, 0.008, 0.5, glass(), x, H + 0.004, z)); const ring = std('#4a4a52', .3, .3);
  for (const [dx, dz, r] of [[-0.17, 0.06, 0.1], [0.17, 0.06, 0.1], [0, -0.13, 0.08]]) { g.add(cyl(r, r, 0.002, ring, x + dx * hw / 0.6, H + 0.009, z + dz, 28)); g.add(cyl(r - 0.012, r - 0.012, 0.002, glass(), x + dx * hw / 0.6, H + 0.0095, z + dz, 28)); }
  g.add(box(hw * 0.6, 0.002, 0.04, std('#2f3a46', .3, .2), x, H + 0.009, z + 0.21));
}
// 下の台1列(長さ L・奥行 D・高さ H・正面 +z)。mods:[{w,k}] を左から並べる。o.ends=[左の側板,右の側板]、o.noTop=天板なし
function baseRun(M, L, D, H, mods, o = {}) {
  const r = new THREE.Group(), [e0, e1] = o.ends || [1, 1], fz = D / 2 - 0.015;
  r.add(box(L - 0.03, 0.1, D - 0.09, M.door, 0, 0.05, -0.045)); r.add(box(L - 0.01, H - 0.14, D - 0.035, M.inner, 0, 0.1 + (H - 0.14) / 2, -0.0175));
  if (!o.noTop) r.add(box(L, 0.04, D, M.top, 0, H - 0.02, 0));
  if (e0) r.add(box(0.02, H - 0.04, D - 0.015, M.door, -L / 2 + 0.01, (H - 0.04) / 2, -0.0075)); if (e1) r.add(box(0.02, H - 0.04, D - 0.015, M.door, L / 2 - 0.01, (H - 0.04) / 2, -0.0075));
  const xa = -L / 2 + (e0 ? 0.02 : 0), xb = L / 2 - (e1 ? 0.02 : 0), sc = (xb - xa) / mods.reduce((a, m) => a + m.w, 0); let x = xa;
  for (const m of mods) { const mw = m.w * sc, cx = x + mw / 2; modFront(r, M, m.k, cx, mw, 0.1, H - 0.04, fz); if (m.k === 'sink') sinkAt(r, M, cx, 0.01, H, mw, D); if (m.k === 'hob') hobAt(r, M, cx, 0.01, H, mw); m.x = cx; m.mw = mw; x += mw; }
  return r;
}
// シンクとコンロの並び。左から [収納, シンク, 調理台, コンロ, 収納]
function layout(L, sink = true, hob = true) {
  const out = [], rest = Math.max(0, L - (sink ? 0.9 : 0) - (hob ? 0.75 : 0));
  const fill = len => { if (len < 0.01) return; if (len < 0.2) { out.push({ w: len, k: 'panel' }); return; } const n = Math.ceil(len / 0.6 - 0.01); for (let i = 0; i < n; i++) out.push({ w: len / n, k: len / n < 0.36 ? 'door' : 'd3' }); };
  const [a, b, c] = rest < 0.6 ? [0, rest, 0] : [rest * 0.25, rest * 0.5, rest * 0.25];
  fill(a); if (sink) out.push({ w: 0.9, k: 'sink' }); fill(b); if (hob) out.push({ w: 0.75, k: 'hob' }); fill(c); return out;
}
const hobX = mods => { const m = mods.find(q => q.k === 'hob'); return m ? m.x : null; };
// 吊り戸棚(壁 zb から前へ dep、高さ y0〜y1)。xa〜xb のうち、skip=[x0,x1] はあける(フードの所)
function wallCabs(g, M, xa, xb, zb, y0, y1, dep, skip) {
  const segs = skip ? [[xa, skip[0]], [skip[1], xb]] : [[xa, xb]], h = y1 - y0, fz = zb + dep;
  for (const [a, b] of segs) {
    const L = b - a; if (L < 0.15) continue; const cx = (a + b) / 2;
    g.add(box(L - 0.01, h - 0.02, dep - TH, M.inner, cx, (y0 + y1) / 2, zb + (dep - TH) / 2)); g.add(box(L, 0.018, dep - TH, M.door, cx, y0 + 0.009, zb + (dep - TH) / 2)); g.add(box(L, 0.018, dep - TH, M.door, cx, y1 - 0.009, zb + (dep - TH) / 2));
    for (const s of [-1, 1]) g.add(box(0.018, h, dep - TH, M.door, cx + s * (L / 2 - 0.009), (y0 + y1) / 2, zb + (dep - TH) / 2));
    const n = Math.max(1, Math.round(L / 0.45)), dw = L / n; for (let i = 0; i < n; i++) front(g, M.door, M.hm, a + dw * (i + 0.5), (y0 + y1) / 2, dw, h, fz, n === 1 ? 'rb' : i % 2 ? 'lb' : 'rb');
    g.add(box(L - 0.12, 0.008, 0.025, led(), cx, y0 - 0.004, fz - 0.06));
  }
}
// 壁付けのレンジフード(スリム型)。上が吊り戸棚にそろう。cab=false なら天井まで幕板
function wallHood(g, M, x, zb, y0, y1, w, cab) {
  const dep = 0.6; g.add(box(w, y1 - y0, dep, M.hood, x, (y0 + y1) / 2, zb + dep / 2)); g.add(box(w - 0.05, 0.004, dep - 0.08, std('#202024', .6), x, y0 - 0.002, zb + dep / 2 - 0.02));
  g.add(box(w * 0.4, 0.006, 0.02, led(), x, y0 - 0.004, zb + dep - 0.06)); if (!cab) g.add(box(w * 0.55, 2.4 - y1, 0.3, M.hood, x, (2.4 + y1) / 2, zb + 0.15));
  light(g, '#fff6e8', 1.5, x, y0 - 0.12, zb + 0.45);
}
// 天井から下げるフード(ペニンシュラ・アイランド)
function ceilHood(g, M, x, z, w) { g.add(box(w, 0.32, 0.6, M.hood, x, 1.82, z)); g.add(box(w - 0.05, 0.004, 0.52, std('#202024', .6), x, 1.658, z)); g.add(box(0.32, 0.42, 0.32, M.hood, x, 2.19, z)); g.add(box(w * 0.4, 0.006, 0.02, led(), x, 1.656, z + 0.25)); light(g, '#fff6e8', 1.5, x, 1.55, z); }
// 天井から下げる吊り戸棚(両面から開く)
function ceilCabs(g, M, xa, xb, z, skip) { const dep = 0.36; for (const [a, b] of skip ? [[xa, skip[0]], [skip[1], xb]] : [[xa, xb]]) { const L = b - a; if (L < 0.2) continue; g.add(box(L, 0.42, dep, M.door, (a + b) / 2, 2.0, z)); const n = Math.max(1, Math.round(L / 0.45)), dw = L / n; for (let i = 0; i < n; i++) for (const s of [-1, 1]) { const ff = new THREE.Group(); front(ff, M.door, M.hm, 0, 0, dw, 0.42, 0.001, i % 2 ? 'lb' : 'rb'); ff.position.set(a + dw * (i + 0.5), 2.0, z + s * dep / 2); if (s < 0) ff.rotation.y = Math.PI; g.add(ff); } } }
// キッチンパネル(壁付けの台の後ろの壁)
const kpanel = (g, x, w, zb, H) => g.add(box(w, 1.45 - H + 0.75, 0.006, std('#f1f0ec', .25), x, H + (1.45 - H + 0.75) / 2, zb + 0.003));

function kitchenBuild(it) {
  const g = new THREE.Group(), w = it.w, d = it.d, H = it.h, s = styleOf(it).id, M = kmats(it), wall = !!it.opts.wall, hood = it.opts.hood !== false;
  const D = Math.min(0.65, d), WY0 = 1.5, WY1 = 2.2, HW = 0.75;
  // 壁付けの1列(I型・カップボード付きの手前)
  const wallRun = (L, zc, mods) => { const r = baseRun(M, L, D, H, mods); r.position.z = zc; g.add(r); return r; };
  const upper = (xa, xb, hx) => { const sk = hood && hx !== null ? [hx - HW / 2, hx + HW / 2] : null; if (wall) wallCabs(g, M, xa, xb, -d / 2, WY0, WY1, 0.375, sk); if (hood && hx !== null) wallHood(g, M, hx, -d / 2, wall ? 1.6 : 1.65, wall ? WY1 : 2.0, HW, wall); };
  if (s === 'i' || s === 'cup') {
    const mods = layout(w); wallRun(w, -d / 2 + D / 2, mods); kpanel(g, 0, w, -d / 2, H); upper(-w / 2, w / 2, hobX(mods));
    if (s === 'cup') {
      // 背面のカップボード(下は引き出し・右に背の高い収納・上に吊り戸棚)。後ろが +z
      const cd = Math.min(0.45, d - D - 0.6), cu = new THREE.Group(), tw = Math.min(0.6, w * 0.3), lw = w - tw;
      const lo = baseRun(M, lw, cd, H, Array.from({ length: Math.max(1, Math.round(lw / 0.6)) }, () => ({ w: 1, k: 'd3' })), { ends: [1, 0] }); lo.position.x = -w / 2 + lw / 2; cu.add(lo);
      const tx = w / 2 - tw / 2, TT = 2.2; cu.add(box(tw - 0.01, TT - 0.13, cd - TH, M.inner, tx, 0.1 + (TT - 0.13) / 2, -TH / 2)); cu.add(box(tw - 0.03, 0.1, cd - 0.09, M.door, tx, 0.05, -0.045)); for (const sx of [-1, 1]) cu.add(box(0.02, TT, cd, M.door, tx + sx * (tw / 2 - 0.01), TT / 2, 0)); cu.add(box(tw, 0.02, cd, M.door, tx, TT - 0.01, 0));
      front(cu, M.door, M.hm, tx, 0.1 + 0.62, tw - 0.04, 1.24, cd / 2, 'lb'); front(cu, M.door, M.hm, tx, 1.34 + (TT - 1.34) / 2, tw - 0.04, TT - 1.34, cd / 2, 'lb');
      if (wall) wallCabs(cu, M, -w / 2, -w / 2 + lw, -cd / 2, 1.45, TT, 0.35);
      cu.add(box(lw, 1.45 - H, 0.006, std('#f1f0ec', .25), -w / 2 + lw / 2, (H + 1.45) / 2, -cd / 2 + 0.003));
      cu.add(box(w, TT, 0.012, M.door, 0, TT / 2, -cd / 2 - 0.006));
      cu.rotation.y = Math.PI; cu.position.z = d / 2 - cd / 2 - 0.012; g.add(cu);
    }
    return g;
  }
  if (s === 'l') {
    // 長い辺は奥の壁(-z)、短い辺は左の壁(-x)。角はデッドスペース
    const lm = layout(w - D, false, true); const r = baseRun(M, w, D, H, [{ w: D, k: 'blank' }, ...lm], { ends: [0, 1] }); r.position.z = -d / 2 + D / 2; g.add(r);
    const sl = d - D, sm = layout(sl, true, false); const r2 = baseRun(M, sl, D, H, sm, { ends: [1, 0] }); r2.rotation.y = Math.PI / 2; r2.position.set(-w / 2 + D / 2, 0, -d / 2 + D + sl / 2); g.add(r2);
    kpanel(g, 0, w, -d / 2, H); const kp2 = box(sl + D, 1.45 - H + 0.75, 0.006, std('#f1f0ec', .25), -w / 2 + 0.003, H + (1.45 - H + 0.75) / 2, -d / 2 + (sl + D) / 2); kp2.rotation.y = Math.PI / 2; g.add(kp2);
    upper(-w / 2, w / 2, hobX(lm) === null ? null : hobX(lm) + 0); return g;
  }
  // ペニンシュラ(片側が壁)とアイランド。人は +z 側に立つ。向こう側(-z)はダイニング
  const isl = s === 'island', mods = layout(w - 0.04), r = baseRun(M, w - 0.04, D, H, mods, { noTop: true }); r.position.z = d / 2 - D / 2 - 0.02; g.add(r);
  const back = d - D - 0.02;
  if (isl) {
    // 向こう側にも浅い収納。天板は四方に少し出す
    if (back > 0.22) { const bm = Array.from({ length: Math.max(1, Math.round((w - 0.04) / 0.5)) }, () => ({ w: 1, k: 'doors' })); const r2 = baseRun(M, w - 0.04, back - 0.02, H, bm, { noTop: true }); r2.rotation.y = Math.PI; r2.position.z = -d / 2 + (back - 0.02) / 2 + 0.02; g.add(r2); }
    g.add(box(w, 0.04, d, M.top, 0, H - 0.02, 0));
  } else {
    // 腰壁(天板より 200 高い)と、その手前の天板
    const kh = H + 0.2, kt = 0.12; g.add(box(w, kh, kt, M.door, 0, kh / 2, -d / 2 + kt / 2)); g.add(box(w, 0.025, kt + 0.02, M.top, 0, kh + 0.0125, -d / 2 + kt / 2));
    if (back - kt > 0.01) g.add(box(w - 0.04, H - 0.04, back - kt, M.inner, 0, (H - 0.04) / 2, -d / 2 + kt + (back - kt) / 2));
    for (const sx of [-1, 1]) g.add(box(0.02, H - 0.04, d - kt, M.door, sx * (w / 2 - 0.01), (H - 0.04) / 2, -d / 2 + kt + (d - kt) / 2));
    g.add(box(w, 0.04, d - kt, M.top, 0, H - 0.02, -d / 2 + kt + (d - kt) / 2));
  }
  const hx = hobX(mods), zc = d / 2 - D / 2 - 0.02;
  if (wall) ceilCabs(g, M, -w / 2 + 0.1, w / 2 - 0.1, isl ? 0 : -d / 2 + 0.3, hood && hx !== null ? [hx - 0.5, hx + 0.5] : null);
  if (hood && hx !== null) ceilHood(g, M, hx, zc - 0.05, 0.9);
  return g;
}

// ---- トイレ(便器) ----
// 部分:便器(陶器)/ 便座とフタ。座る人は +z を向く(背中が -z の壁)。和式は 金かくし が -z
function bowlGeo() { return new THREE.LatheGeometry([[0.11, 0], [0.115, 0.04], [0.105, 0.12], [0.12, 0.2], [0.155, 0.28], [0.182, 0.35], [0.19, 0.385], [0.16, 0.39], [0.14, 0.37]].map(([x, y]) => new THREE.Vector2(x, y)), 28); }
function toiletBuild(it) {
  const g = new THREE.Group(), w = it.w, d = it.d, h = it.h, s = styleOf(it).id, cer = pm(it, 'body', .15), seat = pm(it, 'seat', .3), met = std(METAL, .25, .9);
  if (s === 'washiki') {
    const sx = w / 0.4, cz = d / 2 - 0.29; const rim = cyl(0.2, 0.2, 0.05, cer, 0, 0.025, cz, 32); rim.scale.set(sx, 1, 1.45); g.add(rim);
    const inn = cyl(0.165, 0.165, 0.004, shade(.2), 0, 0.052, cz + 0.02, 32); inn.scale.set(sx, 1, 1.4); g.add(inn); const hole = cyl(0.07, 0.07, 0.004, shade(.35), 0, 0.054, cz + 0.12, 20); hole.scale.z = 1.3; g.add(hole);
    const hm = cer.clone(); hm.side = THREE.DoubleSide; const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.18, 24, 1, true, Math.PI / 2, Math.PI), hm); hood.scale.x = sx; hood.position.set(0, 0.14, cz - 0.12); hood.castShadow = true; g.add(hood);
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.012, 6, 24, Math.PI), cer); top.rotation.set(Math.PI / 2, 0, Math.PI); top.scale.x = sx; top.position.set(0, 0.23, cz - 0.12); g.add(top);
    // 水を流す管(フラッシュバルブ)。壁から
    const pz = -d / 2 + 0.03, py = Math.max(0.6, h - 0.1); g.add(cyl(0.016, 0.016, py - 0.12, met, 0, 0.12 + (py - 0.12) / 2, pz, 12)); const pp = cyl(0.016, 0.016, 0.05, met, 0, 0.12, pz + 0.025, 12); pp.rotation.x = Math.PI / 2; g.add(pp);
    g.add(rb(0.07, 0.13, 0.07, 0.015, met, 0, py + 0.03, pz + 0.01)); g.add(box(0.1, 0.012, 0.012, met, 0.06, py + 0.02, pz + 0.05)); return g;
  }
  const sx = w / 0.42, bl = 0.262, cz = d / 2 - bl; const bowl = new THREE.Mesh(bowlGeo(), cer); bowl.scale.set(sx, 1, 1.38); bowl.position.z = cz; bowl.castShadow = true; g.add(bowl);
  // 後ろの胴(タンクの下・床まで)
  const bz0 = -d / 2 + 0.02, bz1 = cz - bl + 0.1; g.add(rb(0.3 * sx, 0.38, bz1 - bz0, 0.05, cer, 0, 0.19, (bz0 + bz1) / 2));
  // 便座とフタ(閉じた形)
  const ring = cyl(0.192, 0.192, 0.026, seat, 0, 0.398, cz + 0.005, 32); ring.scale.set(sx, 1, 1.36); g.add(ring); const lid = cyl(0.184, 0.188, 0.022, seat, 0, 0.422, cz + 0.01, 32); lid.scale.set(sx, 1, 1.33); g.add(lid);
  if (s === 'tankless') {
    // タンクなし。後ろの台(温水洗浄の本体)が低く一体
    const tz0 = -d / 2 + 0.02, tz1 = cz - bl + 0.06; g.add(rb(0.38 * sx, h - 0.33, tz1 - tz0, 0.06, seat, 0, 0.33 + (h - 0.33) / 2, (tz0 + tz1) / 2)); g.add(box(0.12, 0.004, 0.05, std('#7aa6c8', .3), 0.1 * sx, h + 0.001, (tz0 + tz1) / 2)); return g;
  }
  // 温水洗浄の本体(便座の後ろ)
  g.add(rb(0.38 * sx, 0.07, 0.15, 0.025, seat, 0, 0.42, cz - bl - 0.03)); g.add(box(0.03, 0.05, 0.14, seat, 0.205 * sx, 0.43, cz - bl + 0.12));
  // タンク
  const tt = s === 'handwash' ? h - 0.16 : h, tw = Math.min(0.42, w) * 0.95, td = 0.2, tz = -d / 2 + td / 2 + 0.005;
  g.add(rb(tw, tt - 0.47, td, 0.035, cer, 0, 0.47 + (tt - 0.47) / 2, tz)); g.add(rb(tw + 0.012, 0.03, td + 0.012, 0.012, cer, 0, tt - 0.01, tz));
  g.add(box(0.07, 0.014, 0.02, met, -tw / 2 + 0.07, tt - 0.07, tz + td / 2 + 0.008));
  if (s === 'handwash') {
    // フタの上に手洗いの くぼみと 弓なりの吐水口
    const hb = cyl(0.12, 0.12, 0.003, shade(.22), 0, tt + 0.006, tz + 0.01, 24); hb.scale.set(sx, 1, 0.6); g.add(hb); g.add(cyl(0.015, 0.015, 0.003, shade(.4), 0, tt + 0.008, tz + 0.02, 12));
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.011, 8, 16, Math.PI), met); arc.rotation.y = Math.PI / 2; arc.position.set(0, tt + 0.005, tz - 0.01); arc.scale.y = 1.9; g.add(arc);
  }
  return g;
}

// ---- 洗面台 ----
// 部分:扉 / 天板 / ボウル / 取っ手・水栓。鏡は opts.mirror === false でなし
function washBuild(it) {
  const g = new THREE.Group(), w = it.w, d = it.d, h = it.h, s = styleOf(it).id, door = pm(it, 'door', .45), top = pm(it, 'top', .25), bowl = pm(it, 'bowl', .15), hm = pm(it, 'metal', .2, .9), inner = std(INNER, .85);
  const mir = it.opts.mirror !== false, zb = -d / 2;
  const sideP = (y0, y1, z0, z1) => { for (const sx of [-1, 1]) g.add(box(0.018, y1 - y0, z1 - z0, door, sx * (w / 2 - 0.009), (y0 + y1) / 2, (z0 + z1) / 2)); };
  if (s === 'counter') {
    // ホテル風:カウンターに置き型ボウル。下は壁に付けた引き出し、床はあける
    const ch = 0.7, cd = d, n = w >= 1.45 ? 2 : 1;
    g.add(box(w, 0.04, cd, top, 0, ch - 0.02, 0));
    const uh = 0.24, uy = ch - 0.04 - uh / 2; g.add(box(w - 0.04, uh, cd - 0.06, inner, 0, uy, -0.03)); for (const sx of [-1, 1]) g.add(box(0.02, uh, cd - 0.04, door, sx * (w / 2 - 0.03), uy, -0.02));
    const cols = w > 1.0 ? 2 : 1, cw = (w - 0.08) / cols; for (let i = 0; i < cols; i++) front(g, door, hm, -w / 2 + 0.04 + cw * (i + 0.5), uy, cw, uh, cd / 2 - 0.02, 'top');
    const prof = [[0.001, 0], [0.11, 0], [0.17, 0.03], [0.2, 0.09], [0.205, 0.135], [0.19, 0.135], [0.18, 0.09], [0.15, 0.045], [0.08, 0.025], [0.001, 0.025]].map(([x, y]) => new THREE.Vector2(x, y)); const geo = new THREE.LatheGeometry(prof, 32);
    for (let i = 0; i < n; i++) { const bx = n === 1 ? 0 : (i ? 1 : -1) * w * 0.25, bm = new THREE.Mesh(geo, bowl); bm.scale.z = 0.82; bm.position.set(bx, ch, 0.04); bm.castShadow = true; g.add(bm); g.add(cyl(0.02, 0.02, 0.003, std('#888c90', .3, .8), bx, ch + 0.027, 0.04, 12)); faucet(g, hm, bx, ch, zb + 0.06, 0.34, 0.2); }
    if (mir) { const my0 = ch + 0.42, my1 = Math.max(my0 + 0.5, h), mw = w - 0.06; g.add(box(mw - 0.02, my1 - my0 - 0.02, 0.015, led(), 0, (my0 + my1) / 2, zb + 0.008)); g.add(box(mw, my1 - my0, 0.012, mirrorMat(), 0, (my0 + my1) / 2, zb + 0.022)); light(g, '#fff4e4', 1.5, 0, my1 - 0.1, zb + 0.35); }
    return g;
  }
  // 床に置く台(一面鏡・三面鏡・吊り戸棚つき・引き出し)
  const ch = 0.8, fz = d / 2 - 0.02, y0 = 0.08, y1 = ch - 0.05;
  g.add(box(w - 0.06, 0.08, d - 0.1, door, 0, 0.04, -0.05)); g.add(box(w - 0.02, ch - 0.08 - 0.05, d - 0.04, inner, 0, (y0 + y1) / 2, -0.02 - 0.0)); sideP(0, ch - 0.05, zb, fz);
  const iw = w - 0.036, ix = -w / 2 + 0.018;
  if (s === 'drawer') { const cols = w > 1.25 ? 2 : 1, cw = iw / cols; for (let i = 0; i < cols; i++) { const cx = ix + cw * (i + 0.5), hh = y1 - y0, h1 = hh * 0.36; front(g, door, hm, cx, y1 - h1 / 2, cw, h1, fz, 'top'); front(g, door, hm, cx, y0 + (hh - h1) / 2, cw, hh - h1, fz, 'top'); } }
  else { const dw2 = w >= 1.0 ? iw - 0.4 : iw; for (const sx of [-1, 1]) front(g, door, hm, ix + dw2 / 2 + sx * dw2 / 4, (y0 + y1) / 2, dw2 / 2, y1 - y0, fz, sx < 0 ? 'r' : 'l');
    if (w >= 1.0) { let y = y1; for (const f of [0.28, 0.33, 0.39]) { const hh = (y1 - y0) * f; front(g, door, hm, ix + dw2 + 0.2, y - hh / 2, 0.4, hh, fz, 'top'); y -= hh; } } }
  // 一体の天板とボウル・後ろの立ち上がり
  g.add(box(w, 0.05, d, top, 0, ch - 0.025, 0)); g.add(box(w, 0.07, 0.02, top, 0, ch + 0.035, zb + 0.01));
  const bx = w >= 1.0 && s !== 'drawer' ? -0.2 : 0, bw = Math.min(0.52, w - 0.16), bd = Math.min(0.36, d - 0.18), bz = 0.03;
  const bo = cyl(bw / 2, bw / 2, 0.004, bowl, bx, ch + 0.002, bz, 32); bo.scale.z = bd / bw; g.add(bo); const sh = cyl(bw / 2 - 0.03, bw / 2 - 0.03, 0.003, shade(.26), bx, ch + 0.0045, bz + 0.01, 32); sh.scale.z = (bd - 0.04) / (bw - 0.06); g.add(sh);
  g.add(cyl(0.02, 0.02, 0.003, std('#888c90', .3, .8), bx, ch + 0.006, bz + 0.03, 12)); faucet(g, hm, bx, ch, zb + 0.07, 0.2, 0.15);
  if (!mir) return g;
  // 鏡まわり(壁 zb から前へ)
  const cab = s === 'cabinet', mt = cab ? h - 0.45 : h, m0 = Math.max(ch + 0.22, mt - 0.8), md = 0.15, mz = zb + md;
  g.add(box(w, mt - m0, md - 0.01, door, 0, (m0 + mt) / 2, zb + (md - 0.01) / 2));
  const lh = 0.07; g.add(box(w - 0.04, lh, 0.006, led(), 0, mt - 0.02 - lh / 2, mz - 0.007));
  const ma = m0 + 0.04, mb = mt - lh - 0.04;
  if (s === 'three') { const pw = (w - 0.04) / 3; for (let i = 0; i < 3; i++) g.add(box(pw - 0.006, mb - ma, 0.006, mirrorMat(), -w / 2 + 0.02 + pw * (i + 0.5), (ma + mb) / 2, mz - 0.007)); }
  else g.add(box(w - 0.04, mb - ma, 0.006, mirrorMat(), 0, (ma + mb) / 2, mz - 0.007));
  light(g, '#fff4e4', 1.5, 0, mt - 0.1, zb + 0.35);
  if (cab) { const c0 = mt + 0.03, cd2 = 0.3; g.add(box(w - 0.01, h - c0 - 0.01, cd2 - TH, inner, 0, (c0 + h) / 2, zb + (cd2 - TH) / 2)); g.add(box(w, 0.018, cd2 - TH, door, 0, c0 + 0.009, zb + (cd2 - TH) / 2)); for (const sx of [-1, 1]) { g.add(box(0.018, h - c0, cd2 - TH, door, sx * (w / 2 - 0.009), (c0 + h) / 2, zb + (cd2 - TH) / 2)); front(g, door, hm, sx * w / 4, (c0 + h) / 2, w / 2, h - c0, zb + cd2, sx < 0 ? 'rb' : 'lb'); } }
  return g;
}

export const WET = {
  kitchen: { name: 'システムキッチン', emoji: '🍳', cat: '水まわり', equip: true, kind: 'floor', size: [2.55, 0.85, 0.65], range: { w: [1.5, 3.6], h: [0.8, 0.95], d: [0.6, 2.4] }, color: 'f_white', opts: { hood: true, wall: true },
    words: ['キッチン', 'システムキッチン', '台所', '流し台', 'だいどころ'], params: [['hood', 'レンジフード', 'bool'], ['wall', '吊り戸棚', 'bool']],
    parts: [{ key: 'door', name: '扉', pal: 'door', def: 'f_white' }, { key: 'top', name: '天板', pal: 'top', def: 's_white' }, { key: 'metal', name: '取っ手・水栓', pal: 'metal', def: 'm_steel' }, { key: 'sink', name: 'シンク', pal: 'top', def: 'm_steel' }, { key: 'hood', name: 'レンジフード', pal: 'metal', def: 'm_steel' }],
    styles: [
      { id: 'i', name: 'I型(壁付け)', size: [2.55, 0.85, 0.65], words: ['I型', 'i型', 'アイ型', '壁付け', '壁付'], opts: { hood: true, wall: true } },
      { id: 'l', name: 'L型', size: [2.55, 0.85, 1.65], words: ['L型', 'l型', 'エル型', 'L字'], opts: { hood: true, wall: true }, parts: { door: 'w_light' } },
      { id: 'peninsula', name: 'ペニンシュラ(対面)', size: [2.55, 0.85, 0.9], words: ['ペニンシュラ', '対面キッチン', '対面式', '対面'], opts: { hood: true, wall: false }, parts: { door: 'f_greige' } },
      { id: 'island', name: 'アイランド', size: [2.55, 0.85, 1.0], words: ['アイランド', '島型'], opts: { hood: true, wall: false }, parts: { door: 'w_walnut', top: 's_gray' } },
      { id: 'cup', name: 'I型+カップボード', size: [2.55, 0.85, 2.0], words: ['カップボード', '食器棚つき', '背面収納'], opts: { hood: true, wall: true }, parts: { door: 'w_oak' } },
    ],
    build: kitchenBuild },
  toilet: { name: 'トイレ(便器)', emoji: '🚽', cat: '水まわり', equip: true, kind: 'floor', size: [0.42, 0.80, 0.75], range: { w: [0.36, 0.5], h: [0.5, 1.1], d: [0.55, 0.85] }, color: '#f8f8f6', opts: {}, words: ['トイレ', '便器', 'べんき', 'といれ'],
    parts: [{ key: 'body', name: '便器', pal: 'ceramic', def: 'c_white' }, { key: 'seat', name: '便座とフタ', pal: 'color', def: '#f6f6f3' }],
    styles: [
      { id: 'tank', name: 'タンクあり', size: [0.42, 0.80, 0.75], words: ['タンク付き', 'タンクあり', 'ふつうのトイレ'] },
      { id: 'tankless', name: 'タンクレス', size: [0.40, 0.55, 0.70], words: ['タンクレス', 'タンクなし'] },
      { id: 'handwash', name: '手洗いつきタンク', size: [0.42, 1.0, 0.76], words: ['手洗い付き', '手洗いつき', '手洗い'] },
      { id: 'washiki', name: '和式', size: [0.40, 0.9, 0.62], words: ['和式', '和便器', 'しゃがむ'] },
    ],
    build: toiletBuild },
  washstand: { name: '洗面台', emoji: '🚰', cat: '水まわり', equip: true, kind: 'floor', size: [0.75, 1.85, 0.55], range: { w: [0.6, 1.8], h: [1.6, 2.3], d: [0.45, 0.65] }, color: '#f6f6f3', opts: { mirror: true }, words: ['洗面台', '洗面化粧台', '洗面', 'せんめん'], params: [['mirror', '鏡', 'bool']],
    parts: [{ key: 'door', name: '扉', pal: 'door', def: 'f_white' }, { key: 'top', name: '天板', pal: 'top', def: 's_white' }, { key: 'bowl', name: 'ボウル', pal: 'ceramic', def: 'c_white' }, { key: 'metal', name: '取っ手・水栓', pal: 'metal', def: 'm_chrome' }],
    styles: [
      { id: 'one', name: '一面鏡・開き扉', size: [0.75, 1.85, 0.55], words: ['一面鏡', '開き扉'] },
      { id: 'three', name: '三面鏡', size: [0.9, 1.85, 0.55], words: ['三面鏡'], parts: { door: 'f_lgray' } },
      { id: 'cabinet', name: '吊り戸棚つき', size: [0.75, 2.25, 0.55], words: ['吊り戸棚', '上に収納', 'トールキャビネット'], parts: { door: 'w_natural' } },
      { id: 'drawer', name: '引き出しタイプ', size: [0.75, 1.85, 0.55], words: ['引き出し', 'スライド収納'], parts: { door: 'f_navy' } },
      { id: 'counter', name: 'カウンター+置き型ボウル', size: [1.2, 1.9, 0.5], words: ['置き型ボウル', 'カウンター洗面', 'ホテル', 'ベッセル'], parts: { door: 'w_walnut', top: 'w_oak' } },
    ],
    build: washBuild },
};
