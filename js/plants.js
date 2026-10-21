// 観葉植物(いま人気の10種類)。高さ(h)・横の広がり(w・d)に合わせて形を作る。鉢の色 = item.color
// 葉は形(Shape)を少し反らせて作り、まとめて描く(merge)。同じ植物でも置くたびに少しずつ違う(id から乱数)
import * as THREE from 'three';

const cache = new Map();
function mat(color, rough = .6, extra = {}) { const k = color + rough + JSON.stringify(extra); if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, side: THREE.DoubleSide, ...extra })); return cache.get(k); }
function rng(seed) { let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
function cyl(rt, rb, h, m, seg = 10) { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.castShadow = true; c.receiveShadow = true; return c; }
// 2点を結ぶ枝・幹
function limb(a, b, r0, r1, m) { const d = new THREE.Vector3().subVectors(b, a); const c = cyl(r1, r0, d.length(), m, 8); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); return c; }

// 葉の形:付け根(0,0)から先(0,len)。kind: oval(だ円)/ heart(ハート)/ sword(剣)/ strap(帯)/ round(丸)
const geoCache = new Map();
function leafGeo(kind, len, wid, bend = 0.25) {
  const k = [kind, len.toFixed(3), wid.toFixed(3), bend].join('|'); if (geoCache.has(k)) return geoCache.get(k);
  const s = new THREE.Shape(), hw = wid / 2;
  if (kind === 'heart') { s.moveTo(0, 0); s.bezierCurveTo(hw * 0.9, -len * 0.12, hw * 1.15, len * 0.45, 0, len); s.bezierCurveTo(-hw * 1.15, len * 0.45, -hw * 0.9, -len * 0.12, 0, 0); }
  else if (kind === 'sword') { s.moveTo(-hw, 0); s.lineTo(hw, 0); s.quadraticCurveTo(hw * 1.05, len * 0.7, 0, len); s.quadraticCurveTo(-hw * 1.05, len * 0.7, -hw, 0); }
  else if (kind === 'strap') { s.moveTo(-hw * 0.6, 0); s.lineTo(hw * 0.6, 0); s.bezierCurveTo(hw * 1.1, len * 0.3, hw * 0.9, len * 0.8, 0, len); s.bezierCurveTo(-hw * 0.9, len * 0.8, -hw * 1.1, len * 0.3, -hw * 0.6, 0); }
  else if (kind === 'round') { s.moveTo(0, 0); s.bezierCurveTo(hw * 1.3, len * 0.05, hw * 1.3, len * 0.95, 0, len); s.bezierCurveTo(-hw * 1.3, len * 0.95, -hw * 1.3, len * 0.05, 0, 0); }
  else if (kind === 'monstera') {
    // 切れ込みのあるハート形(切れ込みは左右に3本ずつ、細い三角で表す)
    s.moveTo(0, 0); const pts = []; const N = 4;
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push(t); }
    s.bezierCurveTo(hw * 1.0, -len * 0.15, hw * 1.2, len * 0.5, 0, len); s.bezierCurveTo(-hw * 1.2, len * 0.5, -hw * 1.0, -len * 0.15, 0, 0);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const y = len * (0.25 + i * 0.2), x0 = sx * hw * 0.35, x1 = sx * hw * 1.1; const h = new THREE.Path(); h.moveTo(x0, y); h.lineTo(x1, y + len * 0.02); h.lineTo(x1, y + len * 0.075); h.lineTo(x0, y + len * 0.02); h.closePath(); s.holes.push(h); }
  }
  else { s.moveTo(0, 0); s.bezierCurveTo(hw * 1.3, len * 0.12, hw * 1.25, len * 0.72, 0, len); s.bezierCurveTo(-hw * 1.25, len * 0.72, -hw * 1.3, len * 0.12, 0, 0); }
  const g = new THREE.ShapeGeometry(s, 6); const p = g.attributes.position;
  // 先に向かって反らせる + 葉の真ん中を少し折る
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = y / len; p.setZ(i, -bend * len * t * t + Math.abs(x) * 0.25); }
  p.needsUpdate = true; g.computeVertexNormals(); geoCache.set(k, g); return g;
}
// 葉を置く:pos に付け根、yaw=向き、tilt=上向きからの傾き(0=真上、π/2=水平)
function leaf(group, geo, m, pos, yaw, tilt, roll = 0) { const me = new THREE.Mesh(geo, m); me.castShadow = true; const g = new THREE.Group(); g.position.copy(pos); g.rotation.order = 'YXZ'; g.rotation.set(tilt, yaw, roll); me.rotation.x = 0; g.add(me); group.add(g); return g; }
// 鉢:style = ceramic(陶器)/ basket(かご)/ terracotta(素焼き)/ cylinder(筒)/ concrete
function pot(group, style, r, h, color) {
  const m = mat(color, style === 'ceramic' ? .35 : style === 'basket' ? .95 : .8);
  if (style === 'basket') { const b = cyl(r, r * 0.85, h, m, 20); b.position.y = h / 2; group.add(b); for (let i = 1; i < 5; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (0.85 + 0.15 * i / 5) + 0.002, 0.004, 4, 24), mat('#8b6b45', .9)); ring.rotation.x = Math.PI / 2; ring.position.y = h * i / 5; group.add(ring); } }
  else if (style === 'terracotta') { const b = cyl(r, r * 0.72, h, m, 20); b.position.y = h / 2; group.add(b); const rim = cyl(r * 1.06, r * 1.06, h * 0.14, m, 20); rim.position.y = h - h * 0.07; group.add(rim); }
  else if (style === 'cylinder') { const b = cyl(r, r, h, m, 24); b.position.y = h / 2; group.add(b); }
  else { const b = cyl(r, r * 0.78, h, m, 24); b.position.y = h / 2; group.add(b); }
  const soil = cyl(r * 0.93, r * 0.93, 0.01, mat('#3a2a1b', 1), 16); soil.position.y = h - 0.02; group.add(soil);
  return h - 0.02;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = (name, emoji, size, color, words, build) => ({ name, emoji, cat: 'みどり', kind: 'floor', size, range: { w: [0.2, 1.8], h: [0.25, 2.6], d: [0.2, 1.8] }, color, opts: {}, words, build });

export const PLANTS = {
  monstera: P('モンステラ', '🌿', [0.9, 1.0, 0.9], '#f2f0eb', ['モンステラ'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const ph = Math.min(0.32, h * 0.28), top = pot(g, 'ceramic', Math.min(0.2, rx * 0.45), ph, it.color);
    const lm = mat('#2f6b34', .45), st = mat('#4f7f3c', .7); const n = 7 + Math.floor(R() * 3), L = Math.min(rx, rz) * 0.75 + h * 0.12;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R() * 0.5, rise = top + (h - top) * (0.45 + R() * 0.4), out = 0.35 + R() * 0.55; const end = V(Math.sin(a) * rx * out * 0.7, rise, Math.cos(a) * rz * out * 0.7); g.add(limb(V(0, top, 0), end, 0.008, 0.006, st)); const ll = L * (0.7 + R() * 0.4); leaf(g, leafGeo('monstera', ll, ll * 0.9, 0.18), lm, end, a, 1.05 + R() * 0.4, (R() - .5) * 0.4); }
    return g; }),
  umbellata: P('フィカス・ウンベラータ', '🌳', [0.8, 1.6, 0.8], '#c9b48a', ['ウンベラータ', 'フィカス・ウンベラータ'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'basket', Math.min(0.2, rx * 0.4), Math.min(0.32, h * 0.2), it.color);
    const bark = mat('#8a7a64', .9), lm = mat('#79a84a', .55); const t1 = V(0.03, top + (h - top) * 0.45, 0), t2 = V(-0.02, top + (h - top) * 0.72, 0.02); g.add(limb(V(0, top, 0), t1, 0.022, 0.018, bark)); g.add(limb(t1, t2, 0.018, 0.012, bark));
    const tips = [t2]; for (let i = 0; i < 4; i++) { const a = i * 1.6 + R(); const e = V(Math.sin(a) * rx * 0.5, t1.y + (h - t1.y) * (0.45 + R() * 0.4), Math.cos(a) * rz * 0.5); g.add(limb(i < 2 ? t1 : t2, e, 0.01, 0.006, bark)); tips.push(e); }
    for (const tp of tips) for (let k = 0; k < 6; k++) { const a = R() * Math.PI * 2, ll = 0.17 + R() * 0.1 + h * 0.03; leaf(g, leafGeo('heart', ll, ll * 0.95, 0.15), lm, tp.clone().add(V(Math.sin(a) * 0.05, R() * 0.12 - 0.04, Math.cos(a) * 0.05)), a, 0.9 + R() * 0.6, (R() - .5) * 0.6); }
    return g; }),
  olive: P('オリーブ', '🫒', [0.7, 1.5, 0.7], '#c47a52', ['オリーブ', 'オリーブの木'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'terracotta', Math.min(0.18, rx * 0.4), Math.min(0.3, h * 0.2), it.color);
    const bark = mat('#7d7468', .95), lm = mat('#8c9a6c', .7), lm2 = mat('#a3ad86', .7); const t1 = V(0.02, top + (h - top) * 0.4, -0.01); g.add(limb(V(0, top, 0), t1, 0.02, 0.014, bark));
    const geo = leafGeo('oval', 0.075, 0.02, 0.1);
    for (let b = 0; b < 6; b++) { const a = b / 6 * Math.PI * 2 + R() * 0.6; const e = V(Math.sin(a) * rx * (0.5 + R() * 0.4), t1.y + (h - t1.y) * (0.35 + R() * 0.6), Math.cos(a) * rz * (0.5 + R() * 0.4)); g.add(limb(t1, e, 0.009, 0.004, bark));
      for (let k = 0; k < 46; k++) { const t = R(); const p = t1.clone().lerp(e, 0.35 + t * 0.65).add(V((R() - .5) * 0.12, (R() - .5) * 0.12, (R() - .5) * 0.12)); leaf(g, geo, k % 3 ? lm : lm2, p, R() * Math.PI * 2, 0.6 + R() * 1.2); } }
    return g; }),
  pachira: P('パキラ(編み込み)', '🌴', [0.7, 1.4, 0.7], '#2f2f33', ['パキラ'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'ceramic', Math.min(0.18, rx * 0.45), Math.min(0.3, h * 0.22), it.color);
    const bark = mat('#9a8a6a', .85), lm = mat('#3f7a3a', .5), st = mat('#5d8a45', .7); const th = top + (h - top) * 0.55;
    // 3本の幹をねじって編む
    for (let s = 0; s < 3; s++) { let prev = null; for (let i = 0; i <= 8; i++) { const t = i / 8, a = s * 2.094 + t * Math.PI * 2.2; const p = V(Math.cos(a) * 0.025, top + (th - top) * t, Math.sin(a) * 0.025); if (prev) g.add(limb(prev, p, 0.016, 0.014, bark)); prev = p; } }
    // 手のひらのような葉(小葉5枚)を、上に何組も
    const geo = leafGeo('oval', 0.14 + h * 0.03, 0.05 + h * 0.008, 0.12);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + R() * 0.4; const e = V(Math.sin(a) * rx * (0.5 + R() * 0.3), th + (h - th) * (0.25 + R() * 0.6), Math.cos(a) * rz * (0.5 + R() * 0.3)); g.add(limb(V(0, th, 0), e, 0.006, 0.004, st));
      for (let k = 0; k < 5; k++) leaf(g, geo, lm, e, a + (k - 2) * 0.55, 1.15 + Math.abs(k - 2) * 0.12); }
    return g; }),
  sansevieria: P('サンスベリア', '🌵', [0.35, 0.8, 0.35], '#f2f0eb', ['サンスベリア', 'サンセベリア', 'トラノオ'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'cylinder', Math.min(0.16, rx * 0.8), Math.min(0.26, h * 0.3), it.color);
    const m1 = mat('#33502f', .55), m2 = mat('#5f7d45', .55); const n = 9 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, d = R() * Math.min(rx, rz) * 0.4, len = (h - top) * (0.6 + R() * 0.45); leaf(g, leafGeo('sword', len, 0.045 + R() * 0.02, -0.04), i % 2 ? m1 : m2, V(Math.sin(a) * d, top, Math.cos(a) * d), a + Math.PI / 2 + R() * 0.6, 0.06 + R() * 0.2, (R() - .5) * 0.3); }
    return g; }),
  strelitzia: P('ストレリチア(オーガスタ)', '🪴', [0.9, 1.6, 0.9], '#9a9c9e', ['ストレリチア', 'オーガスタ', '極楽鳥花'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'concrete', Math.min(0.21, rx * 0.45), Math.min(0.34, h * 0.21), it.color);
    const lm = mat('#4c7a3d', .5), st = mat('#6b8f4f', .7); const n = 7 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const a = (i / n - 0.5) * Math.PI * 1.2 + (R() - .5) * 0.3 + (i % 2) * Math.PI, lean = 0.15 + R() * 0.35, sl = (h - top) * (0.45 + R() * 0.25); const end = V(Math.sin(a) * Math.sin(lean) * sl * (rx / 0.45) * 0.6, top + Math.cos(lean) * sl, Math.cos(a) * Math.sin(lean) * sl * (rz / 0.45) * 0.6); g.add(limb(V(0, top, 0), end, 0.012, 0.008, st)); const ll = (h - top) * 0.32 + R() * 0.08; leaf(g, leafGeo('oval', ll, ll * 0.38, 0.12), lm, end, a, lean + 0.25 + R() * 0.3, (R() - .5) * 0.5); }
    return g; }),
  elastica: P('ゴムの木(フィカス・エラスティカ)', '🌱', [0.6, 1.4, 0.6], '#2f2f33', ['ゴムの木', 'フィカス・エラスティカ', 'エラスティカ'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'cylinder', Math.min(0.17, rx * 0.5), Math.min(0.3, h * 0.22), it.color);
    const st = mat('#6a5a3f', .8), lm = mat('#22402a', .28); const stems = [V(0.02, h * 0.98, 0.01), V(-0.06, h * 0.82, 0.04)];
    for (const tip of stems) { g.add(limb(V(0, top, 0), tip, 0.014, 0.01, st)); const n = 9; for (let k = 0; k < n; k++) { const t = 0.35 + k / n * 0.65, p = V(0, top, 0).lerp(tip, t), a = k * 2.4 + R() * 0.4, ll = 0.2 + R() * 0.07 + h * 0.025; leaf(g, leafGeo('oval', ll, ll * 0.6, 0.06), lm, p, a, 0.75 + (1 - t) * 0.45 + R() * 0.2, (R() - .5) * 0.5); } }
    return g; }),
  everfresh: P('エバーフレッシュ', '🌳', [1.0, 1.6, 1.0], '#f2f0eb', ['エバーフレッシュ', 'アカサヤネムノキ'], it => {
    // 細い幹から枝を広げ、先に羽のような葉(小さな葉がたくさん並ぶ)が垂れる。ふんわりした丸い樹形
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'cylinder', Math.min(0.2, rx * 0.4), Math.min(0.36, h * 0.22), it.color);
    const bark = mat('#7a6a55', .9), lm = mat('#86b956', .65), lm2 = mat('#9fca6c', .65), rib = mat('#6f9a45', .8); const t1 = V(0.01, top + (h - top) * 0.38, 0); g.add(limb(V(0, top, 0), t1, 0.02, 0.014, bark));
    const geo = leafGeo('oval', 0.062, 0.02, 0.04); const cy = t1.y + (h - t1.y) * 0.55, cr = (h - t1.y) * 0.5;
    const branches = []; for (let b = 0; b < 6; b++) { const a = b / 6 * Math.PI * 2 + R() * 0.5; const e = V(Math.sin(a) * rx * 0.45, cy + (R() - 0.3) * cr * 0.7, Math.cos(a) * rz * 0.45); g.add(limb(t1, e, 0.01, 0.005, bark)); branches.push([e, a]); }
    for (let f = 0; f < 48; f++) { const [e, a0] = branches[f % branches.length]; const a = a0 + (R() - .5) * 1.8; const base = e.clone().add(V((R() - .5) * 0.25, (R() - .2) * 0.3, (R() - .5) * 0.25)); const L = (0.26 + R() * 0.14) * Math.max(0.7, Math.min(rx, rz) / 0.5); let prev = base;
      // 羽の軸は少し弓なりに垂れる
      for (let k = 1; k <= 9; k++) { const t = k / 9; const p = base.clone().add(V(Math.sin(a) * L * t * (rx / 0.5) * 0.8, -L * 0.45 * t * t + 0.03 * t, Math.cos(a) * L * t * (rz / 0.5) * 0.8)); g.add(limb(prev, p, 0.002, 0.0018, rib)); for (const sd of [-1, 1]) leaf(g, geo, k % 2 ? lm : lm2, p, a + sd * 1.25, 1.35 + t * 0.4, sd * 0.3); prev = p; } }
    return g; }),
  dracaena: P('幸福の木(ドラセナ)', '🎋', [0.6, 1.5, 0.6], '#b59b72', ['幸福の木', 'ドラセナ', 'マッサンゲアナ'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'basket', Math.min(0.18, rx * 0.5), Math.min(0.3, h * 0.2), it.color);
    const bark = mat('#8a6f52', .95), m1 = mat('#3f6e30', .5), m2 = mat('#9fb24a', .5); const hs = [0.95, 0.72, 0.55];
    hs.forEach((k, i) => { const a = i * 2.1; const base = V(Math.cos(a) * 0.04, top, Math.sin(a) * 0.04), tp = base.clone().setY(top + (h - top) * k * 0.62); g.add(limb(base, tp, 0.045, 0.04, bark)); const cap = cyl(0.041, 0.041, 0.01, mat('#c9b08a', .9)); cap.position.copy(tp); g.add(cap);
      for (let j = 0; j < 14; j++) { const ya = j / 14 * Math.PI * 2 + R() * 0.3, ll = (h - top) * 0.3 * (0.7 + R() * 0.5); leaf(g, leafGeo('strap', ll, 0.06, 0.35), j % 3 ? m1 : m2, tp.clone().add(V(0, 0.02 + R() * 0.05, 0)), ya, 0.5 + R() * 0.6); } });
    return g; }),
  gajumaru: P('ガジュマル', '🌲', [0.55, 0.7, 0.55], '#c47a52', ['ガジュマル', '多幸の木'], it => {
    const g = new THREE.Group(), R = rng(it.id), h = it.h, rx = it.w / 2, rz = it.d / 2; const top = pot(g, 'terracotta', Math.min(0.15, rx * 0.5), Math.min(0.2, h * 0.26), it.color);
    const bark = mat('#8f7a62', .9), lm = mat('#3e6e34', .4); const th = top + (h - top) * 0.38;
    // ふくらんだ幹と、地面へ伸びる根
    const trunk = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), bark); trunk.scale.set(1, 1.4, 1); trunk.position.set(0, top + 0.07, 0); g.add(trunk);
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + R() * 0.3; g.add(limb(V(Math.cos(a) * 0.09, top, Math.sin(a) * 0.09), V(Math.cos(a) * 0.02, th, Math.sin(a) * 0.02), 0.02, 0.014, bark)); }
    const geo = leafGeo('round', 0.06, 0.045, 0.05);
    for (let b = 0; b < 5; b++) { const a = b * 1.26 + R(); const e = V(Math.sin(a) * rx * 0.5, th + (h - th) * (0.4 + R() * 0.4), Math.cos(a) * rz * 0.5); g.add(limb(V(0, th, 0), e, 0.012, 0.006, bark));
      for (let k = 0; k < 26; k++) { const p = e.clone().add(V((R() - .5) * rx * 0.45, (R() - .3) * (h - th) * 0.35, (R() - .5) * rz * 0.45)); leaf(g, geo, lm, p, R() * Math.PI * 2, 0.5 + R() * 1.0); } }
    return g; }),
};
