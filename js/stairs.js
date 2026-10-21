// 階段:1階と2階をつなぐ。階段の部屋(room.stair あり)は1階の床から2階の天井までの吹き抜け。
// 形は「正規の向き」(u=横、v=上る向き。v=0 が上り口の辺)で作ってから、部屋の向き(dir)・左右反転(flip)で置く。
// 寸法の目安(建築基準法):蹴上げ 230 以下・踏面 150 以上・幅 750 以上。住宅の実際は蹴上げ 約200〜210・踏面 約210〜250。
import * as THREE from 'three';

export const STAIR_KINDS = [
  ['u_winder', '折り返し(回り段)', 'いちばん多い形。1,820×1,820 に収まる'],
  ['u_landing', '折り返し(踊り場)', '平らな踊り場で安全。1,820×2,730'],
  ['l_winder', 'L字(回り段)', '途中で90°曲がる。1,820×2,730'],
  ['l_landing', 'L字(踊り場)', '曲がり角が平らな踊り場。1,820×2,730'],
  ['straight', 'まっすぐ', '曲がらない(鉄砲階段)。910×3,640'],
  ['spiral', 'らせん', 'ぐるっと回って上る。1,820×1,820'],
];
export const STAIR_STYLES = [['box', '箱階段'], ['open', 'オープン(すけている)']];
// 種類ごとの広さ(芯々のマス数:[横, 上る向き])
export const STAIR_CELLS = { u_winder: [2, 2], u_landing: [2, 3], l_winder: [2, 3], l_landing: [2, 3], straight: [1, 4], spiral: [2, 2] };
export function stairKindName(k) { const e = STAIR_KINDS.find(x => x[0] === k); return e ? e[1] : k; }
// 段数(14段が基本)。折り返しの回り段は、前と後の踏面をそろえるため、残りの段が偶数になるようにする(2.9m なら15段・193mm)
export function stairRisers(FH, kind) { let n = Math.max(10, Math.round(FH / 0.205)); if (kind === 'u_winder' && (n - 1 - 6) % 2) n++; return n; }

function inPoly(px, pz, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) ins = !ins; } return ins; }
function bbox(poly) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, z] of poly) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); } return { x: a, z: b, w: c - a, d: d - b }; }

// 正規の座標 → 部屋の座標
function makeXf(room) {
  const b = bbox(room.poly), s = room.stair, dir = s.dir || 'S';
  const W = (dir === 'E' || dir === 'W') ? b.d : b.w, D = (dir === 'E' || dir === 'W') ? b.w : b.d;
  const fl = u => s.flip ? W - u : u;
  const to = ([u0, v]) => { const u = fl(u0); switch (dir) { case 'N': return [b.x + b.w - u, b.z + v]; case 'E': return [b.x + b.w - v, b.z + b.d - u]; case 'W': return [b.x + v, b.z + u]; default: return [b.x + u, b.z + b.d - v]; } };
  return { W, D, to };
}
// 点 P から角度 a の向きへ伸ばした線が、長方形 [0,W]×[v0,v1] の外周に当たる点
function rayHit(P, a, r) { const dx = Math.cos(a), dy = Math.sin(a); let t = Infinity; if (dx > 1e-9) t = Math.min(t, (r.u1 - P[0]) / dx); if (dx < -1e-9) t = Math.min(t, (r.u0 - P[0]) / dx); if (dy > 1e-9) t = Math.min(t, (r.v1 - P[1]) / dy); if (dy < -1e-9) t = Math.min(t, (r.v0 - P[1]) / dy); return [P[0] + dx * t, P[1] + dy * t]; }
// 扇形(a0→a1)と長方形の重なり(回り段・らせんの段)
function sector(P, a0, a1, r) {
  const pts = [P.slice(), rayHit(P, a0, r)]; const corners = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1); const cs = [];
  for (const c of corners) { let ang = Math.atan2(c[1] - P[1], c[0] - P[0]); for (const k of [-2, 0, 2]) { const aa = ang + k * Math.PI; if (aa > lo + 1e-6 && aa < hi - 1e-6) cs.push([aa, c]); } }
  cs.sort((x, y) => a1 > a0 ? x[0] - y[0] : y[0] - x[0]); for (const [, c] of cs) pts.push(c.slice());
  pts.push(rayHit(P, a1, r)); return pts;
}
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

// 階段の形を作る。戻り: { steps:[{pts(部屋の座標), y, solid}], rail:[[x,y,z]], rise, n, tread(最小の踏面), width, ports, warn }
const cache = new Map();
export function stairLayout(room, FH) {
  const s = room.stair; const key = JSON.stringify([room.poly, s, FH]); if (cache.has(key)) return cache.get(key);
  const { W, D, to } = makeXf(room); const kind = s.kind || 'u_winder';
  const N = stairRisers(FH, kind), T = N - 1, rise = FH / N; const steps = [], railC = [], cores = []; let minTread = Infinity, width = W; const ports = [];
  const add = (pts, k, solid = true, tread) => { steps.push({ c: pts, k, solid }); if (tread !== undefined) minTread = Math.min(minTread, tread); };
  const off = 0.05;
  if (kind === 'straight') {
    const t = Math.min(0.25, D / T), v0 = D - T * t;
    if (v0 > 0.01) add(rect(0, 0, W, v0), 0, false);
    for (let j = 1; j <= T; j++) { const a = v0 + (j - 1) * t, b = v0 + j * t; add(rect(0, a, W, b), j, true, t); railC.push([off, (a + b) / 2, j]); }
    ports.push({ level: 0, a: [0, 0], b: [W, 0] }, { level: 1, a: [0, D], b: [W, D] });
  } else if (kind === 'l_winder' || kind === 'l_landing') {
    const f = Math.min(W / 2, D / 2, 1.0); width = f; const L1 = D - f, L2 = W - f, nc = kind === 'l_winder' ? 3 : 1;
    let n1 = Math.max(1, Math.round((T - nc) * L1 / (L1 + L2))), n2 = T - nc - n1; if (n2 < 1) { n2 = 1; n1 = T - nc - 1; }
    const t1 = L1 / n1, t2 = L2 / n2; let k = 0;
    for (let j = 1; j <= n1; j++) { const a = (j - 1) * t1, b = j * t1; add(rect(0, a, f, b), ++k, true, t1); railC.push([off, (a + b) / 2, k]); }
    const P = [f, D - f], R = { u0: 0, v0: D - f, u1: f, v1: D };
    if (nc === 1) { add(rect(0, D - f, f, D), ++k, true, f); railC.push([off, D - f / 2, k]); railC.push([f / 2, D - off, k]); }
    else for (let i = 0; i < 3; i++) { const a0 = Math.PI - i * Math.PI / 6, a1 = Math.PI - (i + 1) * Math.PI / 6; add(sector(P, a0, a1, R), ++k, true, 0.3 * Math.PI / 6); const m = rayHit(P, (a0 + a1) / 2, R); const dd = Math.hypot(m[0] - P[0], m[1] - P[1]); railC.push([P[0] + (m[0] - P[0]) * (dd - off) / dd, P[1] + (m[1] - P[1]) * (dd - off) / dd, k]); }
    for (let j = 1; j <= n2; j++) { const a = f + (j - 1) * t2, b = f + j * t2; add(rect(a, D - f, b, D), ++k, true, t2); railC.push([(a + b) / 2, D - off, k]); }
    add(rect(f, 0, W, D - f), 0, false);
    if (W - f > 0.3 && D - f > 0.3) cores.push([f, 0, f, D - f], [f, D - f, W, D - f]); // 段の内側(落ちないように)
    ports.push({ level: 0, a: [0, 0], b: [f, 0] }, { level: 1, a: [W, D - f], b: [W, D] });
  } else if (kind === 'u_winder' || kind === 'u_landing') {
    const f = W / 2; width = f; const band = Math.min(f, D * 0.5), L = D - band, nc = kind === 'u_winder' ? 6 : 1;
    let n1 = Math.ceil((T - nc) / 2), n2 = T - nc - n1; const t1 = L / n1, t2 = L / Math.max(1, n2); let k = 0;
    for (let j = 1; j <= n1; j++) { const a = (j - 1) * t1, b = j * t1; add(rect(0, a, f, b), ++k, true, t1); railC.push([off, (a + b) / 2, k]); }
    const P = [f, L], R = { u0: 0, v0: L, u1: W, v1: D };
    if (nc === 1) { add(rect(0, L, W, D), ++k, true, band); railC.push([off, L + band / 2, k], [off, D - off, k], [W - off, D - off, k], [W - off, L + band / 2, k]); }
    else for (let i = 0; i < 6; i++) { const a0 = Math.PI - i * Math.PI / 6, a1 = Math.PI - (i + 1) * Math.PI / 6; add(sector(P, a0, a1, R), ++k, true); const m = rayHit(P, (a0 + a1) / 2, R); const dd = Math.hypot(m[0] - P[0], m[1] - P[1]); railC.push([P[0] + (m[0] - P[0]) * (dd - off) / dd, P[1] + (m[1] - P[1]) * (dd - off) / dd, k]); }
    for (let j = 1; j <= n2; j++) { const b = L - (j - 1) * t2, a = L - j * t2; add(rect(f, a, W, b), ++k, true, t2); railC.push([W - off, (a + b) / 2, k]); }
    // 回り段の踏面は、せまい側から 300mm の所で測る
    if (nc === 6) minTread = Math.min(minTread, 0.3 * Math.PI / 6);
    cores.push([f, 0, f, L]); // 上りと下りの間の壁(建築基準法:階段の両側に壁か手すり)
    ports.push({ level: 0, a: [0, 0], b: [f, 0] }, { level: 1, a: [f, 0], b: [W, 0] });
  } else if (kind === 'spiral') {
    // 1段の角度は、内側から300mmの所の踏面が 155mm になるように(約30°)。1周より少し多く回って、2階の出口は上り口の右どなり
    const C = [W / 2, D / 2], R = { u0: 0, v0: 0, u1: W, v1: D }, sw = 0.155 / 0.3; width = Math.min(W, D) / 2;
    add(sector(C, -Math.PI, -Math.PI / 2, R), 0, false);
    for (let j = 1; j <= T; j++) { const a0 = -Math.PI / 2 + (j - 1) * sw, a1 = -Math.PI / 2 + j * sw; add(sector(C, a0, a1, R), j, false); const am = (a0 + a1) / 2, rr = Math.min(W, D) / 2 - off; railC.push([C[0] + Math.cos(am) * rr, C[1] + Math.sin(am) * rr, j]); }
    const aEnd = -Math.PI / 2 + T * sw; add(sector(C, aEnd, aEnd + Math.PI / 2, R), N, false);
    minTread = 0.3 * sw;
    ports.push({ level: 0, a: [0, 0], b: [W / 2, 0] }, { level: 1, a: [W / 2, 0], b: [W, 0] });
  }
  const out = { steps: steps.map(st => ({ pts: st.c.map(to), y: st.k * rise, k: st.k, solid: st.solid })), rail: railC.map(([u, v, k]) => { const [x, z] = to([u, v]); return [x, k * rise + 0.8, z]; }), rise, n: N, tread: minTread, width, kind, cores: cores.map(([u0, v0, u1, v1]) => [to([u0, v0]), to([u1, v1])]), ports: ports.map(p => ({ level: p.level, a: to(p.a), b: to(p.b) })) };
  const w = []; if (rise > 0.23) w.push('1段が高すぎます'); if (out.tread < 0.15) w.push('足をのせる奥行きが足りません'); if (width < 0.75) w.push('幅がせまいです'); out.warn = w;
  cache.set(key, out); if (cache.size > 40) cache.delete(cache.keys().next().value); return out;
}
// その場所の段の高さ(部屋の床から)。床と段が重なる所(らせんの2階の出口の下など)は、両方返す
export function stairHeights(room, x, z, FH) {
  const L = stairLayout(room, FH); const ys = []; let covered = false;
  for (const st of L.steps) if (inPoly(x, z, st.pts)) { ys.push(st.y); if (st.solid) covered = true; }
  if (!covered && !ys.includes(0)) ys.push(0); return ys;
}

// 3D の階段を作る(部屋のグループに足す)
export function buildStair(room, FH, group, mats) {
  const L = stairLayout(room, FH); const open = (room.stair.style === 'open') || L.kind === 'spiral';
  const shape = pts => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)); sh.closePath(); return sh; };
  for (const st of L.steps) {
    if (st.k === 0) continue; const top = st.y; const thick = open || !st.solid ? 0.04 : top;
    const g = new THREE.ExtrudeGeometry(shape(st.pts), { depth: thick, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, top - thick, 0);
    const m = new THREE.Mesh(g, [mats.tread, open ? mats.tread : mats.riser]); m.castShadow = true; m.receiveShadow = true;
    m.userData = { kind: 'stair', roomId: room.id, mergeKey: open ? 'stair-o' : 'stair' }; group.add(m);
  }
  // 段の内側の壁(箱階段は2階の天井まで、オープンは手すりの高さまで)
  for (const [a, b] of L.cores) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.05) continue; const hh = open ? Math.min(FH + 0.9, FH + (room.stair.upperH || 2.4)) : FH + (room.stair.upperH || 2.4); const t = open ? 0.04 : 0.1;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, hh, t), open ? mats.metal : mats.wall || mats.riser); m.position.set((a[0] + b[0]) / 2, hh / 2, (a[1] + b[1]) / 2); m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); m.castShadow = true; m.receiveShadow = true; m.userData = { kind: 'stair', roomId: room.id }; group.add(m); }
  // らせんの真ん中の柱
  if (L.kind === 'spiral') { const b = bbox(room.poly); const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, FH + 1, 16), mats.metal); col.position.set(b.x + b.w / 2, (FH + 1) / 2, b.z + b.d / 2); col.castShadow = true; col.userData = { kind: 'stair', roomId: room.id }; group.add(col); }
  // 手すり(段の先から 約800mm)
  if (L.rail.length > 1) {
    const path = new THREE.CurvePath(); const pts = L.rail.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 4, 0.018, 8, false), mats.rail); tube.castShadow = true; tube.userData = { kind: 'stair', roomId: room.id }; group.add(tube);
    const step = Math.max(1, Math.floor(pts.length / 6));
    for (let i = 0; i < pts.length; i += step) { const p = pts[i]; const br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), mats.metal); br.position.set(p.x, p.y - 0.04, p.z); group.add(br); }
    if (open) for (let i = 0; i < pts.length; i++) { const p = pts[i]; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 6), mats.metal); post.position.set(p.x, p.y - 0.4, p.z); group.add(post); }
  }
  return L;
}
