// 部屋のデータ → 壁・床・天井・窓・ドア・柱型・袖壁・梁 の3D
// 部屋の形は多角形(poly: [[x,z],...] 絶対座標)。壁は多角形の「辺(edge)」。開口は辺の番号(edge)と、辺の始点からの距離(u)。
import * as THREE from 'three';
import { surfaceMaterial, trimMaterial } from './textures.js';
import { mergeGroup } from './merge.js';

export const WALL_T = 0.12;      // 壁の厚み
export const SIDES = ['N', 'E', 'S', 'W'];
export const SIDE_NAME = { N: '奥の壁', E: '右の壁', S: '手前の壁', W: '左の壁' };
const SIDE_IDX = { N: 0, E: 1, S: 2, W: 3 };
const COMPASS_NORMAL = { N: [0, 1], E: [-1, 0], S: [0, -1], W: [1, 0] }; // 内向きの法線

// ---------- 多角形の道具 ----------
export function rectPoly(x, z, w, d) { return [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]; }
export function polyArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; a += x1 * z2 - x2 * z1; } return a / 2; }
export function pointInPoly(px, pz, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / ((zj - zi) || 1e-12) + xi)) inside = !inside; } return inside; }
export function polyBounds(poly) { const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity }; for (const [x, z] of poly) { b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x); b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z); } return b; }
export function polyCentroid(poly) { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; }
export function distSeg(px, pz, x0, z0, x1, z1) { const dx = x1 - x0, dz = z1 - z0; const l2 = dx * dx + dz * dz || 1e-9; let t = ((px - x0) * dx + (pz - z0) * dz) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz)); }
function distToPolyEdges(px, pz, poly) { let d = Infinity; for (let i = 0; i < poly.length; i++) { const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length]; d = Math.min(d, distSeg(px, pz, x0, z0, x1, z1)); } return d; }

// 部屋のデータを最新の形にそろえる(古い保存の N/E/S/W・pos も読めるように)
export function normalizeRoom(room) {
  if (!room.poly || room.poly.length < 3) room.poly = rectPoly(room.x || 0, room.z || 0, room.w || 3.6, room.d || 2.7);
  // 時計回り(x右・z下の画面座標で面積が正)にそろえる
  if (polyArea(room.poly) < 0) room.poly.reverse();
  syncBounds(room);
  room.openings = room.openings || []; room.parts = room.parts || []; room.walls = room.walls || {};
  for (const k of SIDES) if (room.walls[k] !== undefined) { room.walls[SIDE_IDX[k]] = room.walls[k]; delete room.walls[k]; }
  for (const o of room.openings) {
    if (o.edge === undefined && o.side) { o.edge = SIDE_IDX[o.side]; const L = edgeFrame(room, o.edge).L; o.u = (o.side === 'N' || o.side === 'E') ? o.pos : L - o.pos - o.w; delete o.side; delete o.pos; }
    if (o.edge === undefined) o.edge = 0; if (o.u === undefined) o.u = 0;
    if (o.bay === 'trap' && o.bayDepth === 0.45 && Math.abs(o.w - 1.69) < 1e-6) { const L = edgeFrame(room, o.edge).L; const nw = Math.min(2.03, L - 0.2); o.u = Math.max(0.1, o.u - (nw - o.w) / 2); o.w = nw; o.bayDepth = 0.23; }
  }
  return room;
}
// 仕上げ(廻り縁・巾木・枠)の既定。h は mm
export const TRIM_DEFAULT = { crown: { on: true, h: 35, finish: 'white' }, base: { on: true, h: 60, finish: 'white' }, casing: { on: true, w: 20, finish: 'white' }, door: { finish: 'white' } };
export function roomTrim(room) { const t = room.trim || {}; if (t.casing && t.casing.w === 55) t.casing.w = 20; const d = TRIM_DEFAULT; return { crown: { ...d.crown, ...(t.crown || {}) }, base: { ...d.base, ...(t.base || {}) }, casing: { ...d.casing, ...(t.casing || {}) }, door: { ...d.door, ...(t.door || {}) } }; }
export function syncBounds(room) { const b = polyBounds(room.poly); room.x = b.minX; room.z = b.minZ; room.w = b.maxX - b.minX; room.d = b.maxZ - b.minZ; return room; }
export function isRect(room) { const p = room.poly; if (p.length !== 4) return false; for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; if (Math.abs(a[0] - b[0]) > 1e-6 && Math.abs(a[1] - b[1]) > 1e-6) return false; } return true; }

// 辺の向き:始点 A、終点 B、along(A→B)、normal(部屋の内側へ)、rotY(壁の向き)、L(長さ)
const frameCache = new WeakMap();
export function edgeFrame(room, e) {
  const n = room.poly.length; e = ((e % n) + n) % n;
  const A = room.poly[e], B = room.poly[(e + 1) % n]; const dx = B[0] - A[0], dz = B[1] - A[1]; const L = Math.hypot(dx, dz) || 1e-6;
  const ax = dx / L, az = dz / L; let nx = -az, nz = ax; // 90度回した候補
  const mx = (A[0] + B[0]) / 2 + nx * 0.02, mz = (A[1] + B[1]) / 2 + nz * 0.02; if (!pointInPoly(mx, mz, room.poly)) { nx = -nx; nz = -nz; }
  const rotY = Math.atan2(nx, nz);
  return { e, A, B, origin: new THREE.Vector3(A[0], 0, A[1]), along: new THREE.Vector3(ax, 0, az), normal: new THREE.Vector3(nx, 0, nz), rotY, L };
}
export function edgeCount(room) { return room.poly.length; }
export function wallLength(room, e) { return edgeFrame(room, e).L; }
// 壁の上の位置(内側から見て左から u メートル、床から v メートル、壁から out メートル手前) → ワールド座標
export function wallPoint(room, e, u, v, out = 0) { const f = edgeFrame(room, e); return f.origin.clone().addScaledVector(f.along, u).add(new THREE.Vector3(0, v, 0)).addScaledVector(f.normal, out); }
export function wallUV(room, e, p) { const f = edgeFrame(room, e); const d = p.clone().sub(f.origin); return { u: d.dot(f.along), v: d.y, s: d.dot(f.normal) }; }
// 向き(rot)から、壁沿いの向きと内向きの法線を出す(柱や袖壁に付けたものにも使える)
export function frameFromRot(rot) { return { along: new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot)), normal: new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)) }; }
// 壁の呼び名(四角い部屋なら 奥・右・手前・左)
export function edgeCompass(room, e) { const f = edgeFrame(room, e); const nx = f.normal.x, nz = f.normal.z; if (Math.abs(nx) < 0.3 && Math.abs(nz) < 0.3) return null; if (Math.abs(nz) >= Math.abs(nx)) return nz > 0 ? 'N' : 'S'; return nx < 0 ? 'E' : 'W'; }
export function edgeName(room, e) {
  const f = edgeFrame(room, e); const nx = f.normal.x, nz = f.normal.z; const diag = Math.abs(Math.abs(nx) - Math.abs(nz)) < 0.5;
  const c = edgeCompass(room, e); let base = diag ? '斜めの壁' : (c ? SIDE_NAME[c] : '壁');
  const same = []; for (let i = 0; i < room.poly.length; i++) { const fi = edgeFrame(room, i); const ni = fi.normal; const di = Math.abs(Math.abs(ni.x) - Math.abs(ni.z)) < 0.5; if (di === diag && (diag || edgeCompass(room, i) === c)) same.push(i); }
  if (same.length > 1) base += `(${same.indexOf(e) + 1})`;
  return base;
}
// 「右の壁」などの方角 → その部屋の辺。候補が複数なら from に近いもの
export function edgeForCompass(room, side, from) {
  const want = COMPASS_NORMAL[side]; if (!want) return null; let best = null, bd = Infinity;
  for (let i = 0; i < room.poly.length; i++) { const f = edgeFrame(room, i); const dot = f.normal.x * want[0] + f.normal.z * want[1]; if (dot < 0.5) continue; const m = f.origin.clone().addScaledVector(f.along, f.L / 2); const d = from ? Math.hypot(m.x - from.x, m.z - from.z) - dot : -dot; if (d < bd) { bd = d; best = i; } }
  return best;
}
export function nearestEdge(room, p) { let best = 0, bd = Infinity; for (let i = 0; i < room.poly.length; i++) { const [x0, z0] = room.poly[i], [x1, z1] = room.poly[(i + 1) % room.poly.length]; const d = distSeg(p.x, p.z, x0, z0, x1, z1); if (d < bd) { bd = d; best = i; } } return best; }
export function edgeDistance(room, e, x, z) { const f = edgeFrame(room, e); return (x - f.A[0]) * f.normal.x + (z - f.A[1]) * f.normal.z; }
export function insideRoom(room, x, z) { return pointInPoly(x, z, room.poly); }
// 多角形の中に収める(外なら中心へ寄せる)
export function clampIntoRoom(room, x, z, margin = 0.1) {
  if (pointInPoly(x, z, room.poly) && distToPolyEdges(x, z, room.poly) >= margin) return [x, z];
  const [cx, cz] = polyCentroid(room.poly); let lo = 0, hi = 1; if (!pointInPoly(cx, cz, room.poly)) return [x, z];
  for (let i = 0; i < 18; i++) { const t = (lo + hi) / 2; const px = x + (cx - x) * t, pz = z + (cz - z) * t; if (pointInPoly(px, pz, room.poly) && distToPolyEdges(px, pz, room.poly) >= margin) hi = t; else lo = t; }
  return [x + (cx - x) * hi, z + (cz - z) * hi];
}

// ---------- 柱型・袖壁・梁 ----------
export function partBox(part) { // 平面上の向き付き長方形 {cx, cz, w, d, rot}
  if (part.type === 'wall') { const dx = part.x2 - part.x1, dz = part.z2 - part.z1; const L = Math.hypot(dx, dz) || 0.01; return { cx: (part.x1 + part.x2) / 2, cz: (part.z1 + part.z2) / 2, w: L, d: part.t || WALL_T, rot: Math.atan2(-dz, dx), L }; }
  return { cx: part.x + part.w / 2, cz: part.z + part.d / 2, w: part.w, d: part.d, rot: 0 };
}
export function pointInPart(px, pz, part, margin = 0) { const b = partBox(part); const c = Math.cos(b.rot), s = Math.sin(b.rot); const dx = px - b.cx, dz = pz - b.cz; const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= b.w / 2 + margin && Math.abs(lz) <= b.d / 2 + margin; }

// ---------- 材質 ----------
const matWood = new THREE.MeshStandardMaterial({ color: '#efece6', roughness: .6 });
const matFrame = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: .5 });
const matDoor = new THREE.MeshStandardMaterial({ color: '#b78b5e', roughness: .55 });
const matKnob = new THREE.MeshStandardMaterial({ color: '#c9b37a', roughness: .3, metalness: .8 });
const matGlass = new THREE.MeshStandardMaterial({ color: '#dbe9f6', roughness: .04, metalness: .15, transparent: true, opacity: .16, side: THREE.DoubleSide, envMapIntensity: .6, depthWrite: false });
const matCap = new THREE.MeshStandardMaterial({ color: '#d9d9d9', roughness: .9 });
const matSash = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: .4, metalness: .6 });
const matOuter = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .9, side: THREE.BackSide });

function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; }

// 壁(穴あき)のジオメトリ。UV は 0..1(写真用)。壁の長さ L, 高さ H
function wallGeometry(L, H, holes) {
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(L, 0); shape.lineTo(L, H); shape.lineTo(0, H); shape.closePath();
  for (const h of holes) {
    const x0 = Math.max(0.001, h.u), x1 = Math.min(L - 0.001, h.u + h.w), y0 = Math.max(0, h.sill), y1 = Math.min(H - 0.001, h.sill + h.h);
    if (x1 <= x0 || y1 <= y0) continue;
    const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); shape.holes.push(p);
  }
  const g = new THREE.ShapeGeometry(shape, 1);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / L, uv.getY(i) / H);
  uv.needsUpdate = true; g.computeVertexNormals(); return g;
}
// 床・天井(多角形)。UV は外接する長方形で 0..1
function slabGeometry(poly, flipZ) {
  const b = polyBounds(poly); const shape = new THREE.Shape(); poly.forEach(([x, z], i) => { const px = x, py = flipZ ? -z : z; if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py); }); shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 1); const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const x = pos.getX(i), y = pos.getY(i); const z = flipZ ? -y : y; uv.setXY(i, (x - b.minX) / ((b.maxX - b.minX) || 1), flipZ ? 1 - (z - b.minZ) / ((b.maxZ - b.minZ) || 1) : (z - b.minZ) / ((b.maxZ - b.minZ) || 1)); }
  uv.needsUpdate = true; g.computeVertexNormals(); return g;
}


// 出窓:窓が外へ張り出す。中は天板(カウンター)と天井板、外側にガラス(台形=ななめ45° / 角=箱型)
// og のローカル:x=壁にそって(窓の中心が0)、y=上、z=部屋の内側が+(壁の内面 z=0、外面 z=-WALL_T)
const matBayRoof = new THREE.MeshStandardMaterial({ color: '#6f747b', roughness: .7 });
function footprint(pts) { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => i ? sh.lineTo(x, z) : sh.moveTo(x, z)); sh.closePath(); return sh; }
function slab(pts, thick, mat, topY) { const g = new THREE.ExtrudeGeometry(footprint(pts), { depth: thick, bevelEnabled: false }); g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.y = topY; m.castShadow = true; m.receiveShadow = true; return m; }
function buildBay(og, o, h, ctx) {
  const trap = o.bay === 'trap'; const D = Math.max(0.12, o.bayDepth ?? (trap ? 0.23 : 0.45)), w = h.w, EAR = ctx.ear ?? 0.02, zo = -WALL_T, zf = -WALL_T - D;
  const wf = trap ? Math.max(0.4, w - 2 * D) : w; // 台形は両わきが45°、角(箱型)は正面が開口と同じ幅
  const inner = [[-w / 2 - EAR, EAR], [w / 2 + EAR, EAR], [w / 2 + EAR, zo], [w / 2, zo], [wf / 2, zf], [-wf / 2, zf], [-w / 2, zo], [-w / 2 - EAR, zo]];
  const outer = [[-w / 2, zo], [w / 2, zo], [wf / 2, zf], [-wf / 2, zf]];
  const y = h.sill + h.h / 2, fw = 0.04, sash = ctx.matSash;
  const bar = (L, H, T, x, yy, z, ang = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(L, H, T), sash); m.position.set(x, yy, z); m.rotation.y = ang; og.add(m); return m; };
  // 天板(左右・部屋側に20mm出す)と天井板
  og.add(ctx.tagTrim(slab(inner, 0.03, ctx.mFrame, h.sill)));
  og.add(slab(outer, 0.02, trap ? ctx.mFrame : ctx.wallMat, h.sill + h.h + 0.02));
  // 外側:天板の下の腰と、上の屋根
  og.add(slab(outer, 0.3, new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .9 }), h.sill - 0.03));
  og.add(slab(outer.map(([x, z]) => [x * 1.04, z - (z < zo ? 0.04 : 0)]), 0.06, matBayRoof, h.sill + h.h + 0.08));
  if (trap) {
    // 左右の斜めの窓(はめ殺し)
    for (const [[x1, z1], [x2, z2]] of [[[w / 2, zo], [wf / 2, zf]], [[-wf / 2, zf], [-w / 2, zo]]]) { const L = Math.hypot(x2 - x1, z2 - z1), mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, ang = Math.atan2(-(z2 - z1), x2 - x1);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(L, h.h), ctx.matGlass); gl.position.set(mx, y, mz); gl.rotation.y = ang; og.add(gl);
      bar(L, fw, 0.05, mx, h.sill + fw / 2, mz, ang); bar(L, fw, 0.05, mx, h.sill + h.h - fw / 2, mz, ang); }
    for (const [x, z] of [[-w / 2, zo], [w / 2, zo]]) bar(0.05, h.h, 0.05, x, y, z);
  } else {
    // 角(箱型):左右は壁。クロス巻き込み(壁と同じ仕上げ)
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, h.h + 0.02, D), ctx.wallMat); m.position.set(sx * (w / 2 + 0.05), y, (zo + zf) / 2); m.receiveShadow = true; og.add(m); }
  }
  // 正面:引き違いの2枚(内側と外側のレールに1枚ずつ、真ん中で少し重なる)
  const pw = wf / 2 + 0.025, rail = 0.025;
  for (const [i, sx] of [[0, -1], [1, 1]]) { const cx = sx * (wf / 2 - pw / 2), cz = zf + (i === 0 ? rail : -rail) * 0.5 + 0.01;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(pw - fw, h.h - fw), ctx.matGlass); gl.position.set(cx, y, cz); og.add(gl); if (i === 0) { gl.userData = { kind: 'window', roomId: ctx.roomId, edge: ctx.edge, openingId: o.id, keep: true }; ctx.pick.push(gl); }
    bar(pw, fw, 0.03, cx, h.sill + fw / 2, cz); bar(pw, fw, 0.03, cx, h.sill + h.h - fw / 2, cz); bar(fw, h.h, 0.03, cx - pw / 2 + fw / 2, y, cz); bar(fw, h.h, 0.03, cx + pw / 2 - fw / 2, y, cz); }
  // 正面の外枠
  bar(wf + 0.04, 0.03, 0.07, 0, h.sill + 0.015, zf + 0.01); bar(wf + 0.04, 0.03, 0.07, 0, h.sill + h.h - 0.015, zf + 0.01);
  for (const sx of [-1, 1]) bar(0.03, h.h, 0.07, sx * (wf / 2 + 0.005), y, zf + 0.01);
}

export function wallSpec(room, e) { return (room.walls && (room.walls[e] !== undefined ? room.walls[e] : room.walls[String(e)])) || { lib: 'wp_white' }; }

export function buildRoom(room, project, group) {
  normalizeRoom(room);
  const assets = project.assets || {};
  const H = room.h, pick = [];
  const roomGroup = new THREE.Group(); roomGroup.name = 'room:' + room.id; roomGroup.userData.roomId = room.id;
  const trim = roomTrim(room); const matCrown = trimMaterial(trim.crown.finish), matBase = trimMaterial(trim.base.finish), matCase = trimMaterial(trim.casing.finish), matDoorFrame = trimMaterial(trim.door.finish);
  const crownH = Math.max(0.01, (trim.crown.h || 35) / 1000), baseH = Math.max(0.01, (trim.base.h || 60) / 1000), caseW = Math.max(0.02, (trim.casing.w || 55) / 1000);
  // 床
  const floor = new THREE.Mesh(slabGeometry(room.poly, true), surfaceMaterial('floor', room.floor, { w: room.w, h: room.d }, assets));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.userData = { kind: 'floor', roomId: room.id, keep: true }; roomGroup.add(floor); pick.push(floor);
  // 天井
  const ceil = new THREE.Mesh(slabGeometry(room.poly, false), surfaceMaterial('wall', room.ceiling || { color: '#f7f7f4' }, { w: room.w, h: room.d }, assets));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.receiveShadow = true;
  ceil.userData = { kind: 'ceiling', roomId: room.id, keep: true }; roomGroup.add(ceil); pick.push(ceil);
  // 壁(辺ごと)
  const n = room.poly.length;
  for (let e = 0; e < n; e++) {
    const f = edgeFrame(room, e), L = f.L;
    const ops = room.openings.filter(o => o.edge === e);
    const holes = ops.map(o => ({ u: o.u, w: o.w, sill: o.type === 'window' ? (o.sill ?? 0.9) : 0, h: o.h, op: o }));
    const wall = new THREE.Mesh(wallGeometry(L, H, holes), surfaceMaterial('wall', wallSpec(room, e), { w: L, h: H }, assets));
    wall.position.copy(f.origin); wall.rotation.y = f.rotY; wall.receiveShadow = true;
    wall.userData = { kind: 'wall', roomId: room.id, edge: e, keep: true }; roomGroup.add(wall); pick.push(wall);
    // 壁の上端(全体を上から見たとき用)
    const cap = box(L + WALL_T * 2, 0.02, WALL_T, matCap); cap.castShadow = false;
    cap.position.copy(wallPoint(room, e, L / 2, H + 0.01, -WALL_T / 2)); cap.rotation.y = f.rotY; roomGroup.add(cap);
    // 外側の面(外から見たときだけ見える)
    const outer = new THREE.Mesh(wallGeometry(L, H, holes), matOuter);
    outer.position.copy(wallPoint(room, e, 0, 0, -WALL_T)); outer.rotation.y = f.rotY; outer.receiveShadow = true; outer.userData.keep = true; roomGroup.add(outer);
    // 廻り縁(あり/なし・高さ・仕上げ)
    if (trim.crown.on) { const crown = box(L, crownH, Math.min(0.03, crownH * 0.6)); crown.material = matCrown; crown.castShadow = false; crown.userData = { kind: 'trim', part: 'crown', roomId: room.id, mergeKey: 'crown' }; crown.position.copy(wallPoint(room, e, L / 2, H - crownH / 2, Math.min(0.03, crownH * 0.6) / 2)); crown.rotation.y = f.rotY; roomGroup.add(crown); }
    // 巾木(ドアのところは切る)
    if (trim.base.on) { const doors = holes.filter(h => h.op.type !== 'window').sort((a, b) => a.u - b.u);
      let u0 = 0; const segs = [];
      for (const d of doors) { if (d.u > u0) segs.push([u0, d.u]); u0 = d.u + d.w; } if (u0 < L) segs.push([u0, L]);
      for (const [a, b] of segs) { const bb = box(b - a, baseH, 0.012); bb.material = matBase; bb.userData = { kind: 'trim', part: 'base', roomId: room.id, mergeKey: 'base' }; bb.position.copy(wallPoint(room, e, (a + b) / 2, baseH / 2, 0.006)); bb.rotation.y = f.rotY; roomGroup.add(bb); } }
    // 開口の枠・窓・ドア
    for (const h of holes) {
      const o = h.op, cu = h.u + h.w / 2, isWin = o.type === 'window';
      const og = new THREE.Group(); og.position.copy(wallPoint(room, e, cu, 0, 0)); og.rotation.y = f.rotY; roomGroup.add(og); const tagTrim = m => { m.userData = { kind: 'trim', part: isWin ? 'casing' : 'door', roomId: room.id, openingId: o.id, mergeKey: isWin ? 'casing' : 'door' }; return m; };
      // 箱型の出窓は、枠なし(三方クロス巻き込み)
      const casingOn = isWin ? (trim.casing.on && o.bay !== 'box') : true; const mFrame = isWin ? matCase : matDoorFrame; const wallMat = wall.material;
      const bay = isWin && (o.bay === 'trap' || o.bay === 'box'); const EAR = 0.02; // 窓台・出窓天板の左右の出(20mm)
      if (!o.twin) {
        // 壁の厚み分の側面(額縁)。窓で枠なしのときは、壁紙を巻き込む(クロス巻き込み)
        const jd = WALL_T; const jm = casingOn ? mFrame : wallMat; const jt0 = 0.02;
        const jl = tagTrim(box(jt0, h.h, jd, jm)); jl.position.set(-h.w / 2 - jt0 / 2, h.sill + h.h / 2, -WALL_T / 2); og.add(jl);
        const jr = jl.clone(); jr.position.x = h.w / 2 + jt0 / 2; og.add(jr);
        const jt = tagTrim(box(h.w + jt0 * 2, jt0, jd, jm)); jt.position.set(0, h.sill + h.h + jt0 / 2, -WALL_T / 2); og.add(jt);
        if (isWin && casingOn && !bay) { const js = tagTrim(box(h.w + jt0 * 2, jt0, jd, mFrame)); js.position.set(0, h.sill - jt0 / 2, -WALL_T / 2); og.add(js); }
      }
      // 部屋側の枠(四方枠・見付は設定値。下も上と同じで出っぱらない)。出窓は下が天板になる
      if (casingOn) { const cw = caseW, cd = 0.012; const cl = tagTrim(box(cw, h.h + (isWin ? (bay ? cw : cw * 2) : cw), cd, mFrame)); cl.position.set(-h.w / 2 - cw / 2, h.sill + h.h / 2 + (isWin ? (bay ? cw / 2 : 0) : cw / 2), cd / 2); og.add(cl); const cr = cl.clone(); cr.position.x = h.w / 2 + cw / 2; og.add(cr);
        const ct = tagTrim(box(h.w + cw * 2, cw, cd, mFrame)); ct.position.set(0, h.sill + h.h + cw / 2, cd / 2); og.add(ct);
        if (isWin && !bay) { const cb = tagTrim(box(h.w + cw * 2, cw, cd, mFrame)); cb.position.set(0, h.sill - cw / 2, cd / 2); og.add(cb); } }
      if (isWin && !casingOn && !bay) {
        // 枠なし(クロス巻き込み)でも、窓台だけはある:左右に 20mm ずつ出す
        const sb = tagTrim(box(h.w + EAR * 2, 0.03, WALL_T + EAR, mFrame)); sb.position.set(0, h.sill - 0.015, -WALL_T / 2 + EAR / 2); og.add(sb);
      }
      if (isWin && !bay) {
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(h.w, h.h), matGlass); glass.position.set(0, h.sill + h.h / 2, -WALL_T / 2); og.add(glass);
        glass.userData = { kind: 'window', roomId: room.id, edge: e, openingId: o.id, keep: true }; pick.push(glass);
        const fw = 0.04;
        const s1 = box(fw, h.h, 0.05, matSash); s1.position.set(0, h.sill + h.h / 2, -WALL_T / 2); og.add(s1);
        const s2 = box(h.w, fw, 0.05, matSash); s2.position.set(0, h.sill + fw / 2, -WALL_T / 2); og.add(s2);
        const s3 = s2.clone(); s3.position.y = h.sill + h.h - fw / 2; og.add(s3);
        const s4 = box(fw, h.h, 0.05, matSash); s4.position.set(-h.w / 2 + fw / 2, h.sill + h.h / 2, -WALL_T / 2); og.add(s4);
        const s5 = s4.clone(); s5.position.x = h.w / 2 - fw / 2; og.add(s5);
      } else if (bay) {
        buildBay(og, o, h, { mFrame, matGlass, matSash, matOuter, wallMat, roomId: room.id, edge: e, pick, tagTrim, ear: (casingOn ? caseW : 0) + 0.02 });
      } else if (o.type === 'door' && !o.twin) {
        // 丁番:部屋の内側から見て左(left)/右(right)。開く向き:内開き(in=この部屋側)/外開き(out)
        const sx = o.hinge === 'right' ? -1 : 1, sz = o.swing === 'out' ? -1 : 1;
        const leaf = new THREE.Group(); leaf.position.set(-sx * h.w / 2, 0, sz > 0 ? -0.022 : -WALL_T + 0.022); og.add(leaf);
        const door = box(h.w - 0.01, h.h - 0.01, 0.04, matDoor); door.position.set(sx * (h.w - 0.01) / 2, (h.h - 0.01) / 2, 0); leaf.add(door);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), matKnob); knob.position.set(sx * (h.w - 0.08), 1.0, 0.04); leaf.add(knob);
        const knob2 = knob.clone(); knob2.position.z = -0.04; leaf.add(knob2);
        for (let k = 0; k < 2; k++) { const hg = box(0.012, 0.1, 0.03, matKnob); hg.castShadow = false; hg.position.set(0, k ? h.h - 0.25 : 0.25, 0); leaf.add(hg); }
        leaf.rotation.y = -sx * sz * (o.open ?? 0.9) * Math.PI / 2;
        door.userData = { kind: 'door', roomId: room.id, edge: e, openingId: o.id }; pick.push(door);
      }
    }
  }
  // 柱型・袖壁・梁
  for (const part of room.parts) {
    const b = partBox(part); const ne = nearestEdge(room, new THREE.Vector3(b.cx, 0, b.cz)); const spec = wallSpec(room, ne);
    if (part.type === 'column') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(part.w, H, part.d), surfaceMaterial('wall', spec, { w: Math.max(part.w, part.d), h: H }, assets)); m.position.set(b.cx, H / 2, b.cz); m.castShadow = true; m.receiveShadow = true;
      m.userData = { kind: 'part', part: 'column', roomId: room.id, partId: part.id, keep: true }; roomGroup.add(m); pick.push(m);
      if (trim.base.on) { const bb = box(part.w + 0.024, baseH, part.d + 0.024, matBase); bb.position.set(b.cx, baseH / 2, b.cz); roomGroup.add(bb); }
    } else if (part.type === 'wall') {
      const h = part.h || H; const m = new THREE.Mesh(new THREE.BoxGeometry(b.L, h, b.d), surfaceMaterial('wall', spec, { w: b.L, h }, assets)); m.position.set(b.cx, h / 2, b.cz); m.rotation.y = b.rot; m.castShadow = true; m.receiveShadow = true;
      m.userData = { kind: 'part', part: 'wall', roomId: room.id, partId: part.id, keep: true }; roomGroup.add(m); pick.push(m);
      if (trim.base.on) { const bb = box(b.L + 0.024, baseH, b.d + 0.024, matBase); bb.position.set(b.cx, baseH / 2, b.cz); bb.rotation.y = b.rot; roomGroup.add(bb); }
      if (h < H - 0.05) { const top = box(b.L + 0.02, 0.03, b.d + 0.04, matWood); top.position.set(b.cx, h + 0.015, b.cz); top.rotation.y = b.rot; roomGroup.add(top); }
    } else if (part.type === 'beam') {
      const drop = part.drop || 0.3; const m = new THREE.Mesh(new THREE.BoxGeometry(part.w, drop, part.d), surfaceMaterial('wall', room.ceiling || { color: '#f7f7f4' }, { w: Math.max(part.w, part.d), h: drop }, assets)); m.position.set(b.cx, H - drop / 2, b.cz); m.castShadow = true; m.receiveShadow = true;
      m.userData = { kind: 'part', part: 'beam', roomId: room.id, partId: part.id, keep: true }; roomGroup.add(m); pick.push(m);
    }
  }
  if (room.pano && assets[room.pano]) {
    const tex = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace; const img = new Image(); img.onload = () => { tex.image = img; tex.needsUpdate = true; }; img.src = assets[room.pano].dataUrl;
    const R = Math.max(4, Math.max(room.w, room.d) * 1.5);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
    sphere.position.set(room.x + room.w / 2, 1.5, room.z + room.d / 2); sphere.rotation.y = room.panoRot || 0; sphere.userData = { kind: 'pano', roomId: room.id, keep: true }; roomGroup.add(sphere);
    roomGroup.traverse(o => { if (o !== sphere && o.isMesh) { o.visible = false; o.userData.ghost = true; } });
  }
  mergeGroup(roomGroup);
  group.add(roomGroup);
  return pick;
}

export function buildHouse(project) {
  const group = new THREE.Group(); group.name = 'house'; let pick = [];
  for (const r of project.rooms) pick = pick.concat(buildRoom(r, project, group));
  return { group, pick };
}

// 壁を共有している相手の部屋(ドアでつなぐときに使う)。戻り: { room, edge, u }(相手側の辺と位置)
export function neighborAcross(room, e, u, w, rooms) {
  const f = edgeFrame(room, e); const P1 = f.origin.clone().addScaledVector(f.along, u), P2 = f.origin.clone().addScaledVector(f.along, u + w);
  for (const o of rooms) {
    if (o.id === room.id) continue; normalizeRoom(o);
    for (let j = 0; j < o.poly.length; j++) {
      const g = edgeFrame(o, j); if (g.along.dot(f.along) > -0.98) continue;
      const dist = Math.abs(P1.clone().sub(g.origin).dot(g.normal)); if (dist > WALL_T + 0.06) continue;
      const t1 = P1.clone().sub(g.origin).dot(g.along), t2 = P2.clone().sub(g.origin).dot(g.along); const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
      if (hi < 0.02 || lo > g.L - 0.02) continue;
      return { room: o, edge: j, u: Math.max(0, lo) };
    }
  }
  return null;
}
// 歩ける範囲か(部屋の中(壁から margin 以上) または ドアの通り道。柱型・袖壁の中はだめ)
export function walkable(p, rooms, margin = 0.25) {
  let ok = false;
  for (const r of rooms) {
    if (!r.poly) normalizeRoom(r);
    if (pointInPoly(p.x, p.z, r.poly) && distToPolyEdges(p.x, p.z, r.poly) >= margin) { ok = true; break; }
  }
  if (!ok) for (const r of rooms) for (const o of r.openings || []) {
    if (o.type === 'window') continue; const f = edgeFrame(r, o.edge); const d = new THREE.Vector3(p.x, 0, p.z).sub(f.origin); const t = d.dot(f.along), s = d.dot(f.normal); const reach = WALL_T + margin + 0.1, m = 0.12;
    if (t > o.u + m && t < o.u + o.w - m && s > -reach && s < reach) { ok = true; break; }
  }
  if (!ok) return false;
  for (const r of rooms) for (const part of r.parts || []) { if (part.type === 'beam') continue; if (pointInPart(p.x, p.z, part, margin * 0.8)) return false; }
  return true;
}
export function roomAt(p, rooms) { return rooms.find(r => (r.poly || normalizeRoom(r).poly) && pointInPoly(p.x, p.z, r.poly)) || rooms.find(r => p.x >= r.x - 0.01 && p.x <= r.x + r.w + 0.01 && p.z >= r.z - 0.01 && p.z <= r.z + r.d + 0.01) || null; }
export function houseBounds(rooms) {
  const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity, maxH: 0 };
  for (const r of rooms) { b.minX = Math.min(b.minX, r.x); b.minZ = Math.min(b.minZ, r.z); b.maxX = Math.max(b.maxX, r.x + r.w); b.maxZ = Math.max(b.maxZ, r.z + r.d); b.maxH = Math.max(b.maxH, r.h); }
  if (!rooms.length) Object.assign(b, { minX: 0, minZ: 0, maxX: 4, maxZ: 4, maxH: 2.4 });
  return b;
}

// ---------- 形のひな型・形の操作 ----------
// 部屋の形のひな型。g = モジュールの半グリッド(尺 0.455 / メーター 0.5)。切り欠きの寸法は g の倍数にそろえる
export const ROOM_SHAPES = [
  ['rect', '長方形', 'ふつうの四角い部屋'],
  ['L', 'L字', '角がひとつ欠けた形(LDKに多い)'],
  ['U', 'コの字', '手前の真ん中がへこんだ形'],
  ['T', '凸型', '奥に出っぱり(床の間・収納・カウンター)'],
  ['notch', '角欠け', '角に押入れや階段がくい込んだ形'],
  ['trap', '台形', '片側の壁が斜め'],
  ['Z', 'クランク', '段ちがいにずれた形'],
  ['chamfer', '角を斜めに', '角が斜めに切れた形'],
  ['bay', '出窓つき', '奥の壁に出窓(窓が外へ張り出す)'],
  ['column', '柱型つき', '角に柱の出っぱり'],
];
export function shapePoly(kind, x, z, w, d, g = 0.455) {
  const sn = (v, min = g) => Math.max(min, Math.round(v / g) * g); // g の倍数に
  const p = rectPoly(x, z, w, d);
  if (kind === 'L') { const cw = Math.min(sn(w * 0.45), w - g), cd = Math.min(sn(d * 0.45), d - g); return [[x, z], [x + w, z], [x + w, z + d - cd], [x + w - cw, z + d - cd], [x + w - cw, z + d], [x, z + d]]; }
  if (kind === 'U') { const ow = Math.min(sn(w * 0.4), w - 2 * g), od = Math.min(sn(d * 0.4), d - g); const a = (w - ow) / 2; return [[x, z], [x + w, z], [x + w, z + d], [x + w - a, z + d], [x + w - a, z + d - od], [x + a, z + d - od], [x + a, z + d], [x, z + d]]; }
  if (kind === 'T') { const aw = Math.min(sn(w * 0.4), w - g), ad = sn(Math.min(0.91, d * 0.3)); const s0 = (w - aw) / 2; return [[x, z], [x + s0, z], [x + s0, z - ad], [x + s0 + aw, z - ad], [x + s0 + aw, z], [x + w, z], [x + w, z + d], [x, z + d]]; }
  if (kind === 'notch') { const n = Math.min(sn(0.91), w - g, d - g); return [[x, z], [x + w - n, z], [x + w - n, z + n], [x + w, z + n], [x + w, z + d], [x, z + d]]; }
  if (kind === 'trap') { const t = Math.min(sn(w * 0.25), w - g); return [[x, z], [x + w - t, z], [x + w, z + d], [x, z + d]]; }
  if (kind === 'Z') { const sx = Math.min(sn(w * 0.4), w - g), sz = Math.min(sn(d * 0.4), d - g); return [[x, z], [x + w - sx, z], [x + w - sx, z + sz], [x + w, z + sz], [x + w, z + d], [x + sx, z + d], [x + sx, z + d - sz], [x, z + d - sz]]; }
  if (kind === 'chamfer') { const c = Math.min(1.0, w * 0.3, d * 0.3); return [[x, z], [x + w - c, z], [x + w, z + c], [x + w, z + d], [x, z + d]]; }
  return p;
}
// 形の小さな絵(SVG)
export function shapeIconSVG(kind) {
  const RW = 4.43, RD = 3.52; const pts = shapePoly(kind, 0, 0, RW, RD, 0.455);
  const bayQ = kind === 'bay' ? [[RW / 2 - 0.85, 0], [RW / 2 - 0.4, -0.45], [RW / 2 + 0.4, -0.45], [RW / 2 + 0.85, 0]] : null;
  const allP = bayQ ? [...pts, ...bayQ] : pts; const xs = allP.map(p => p[0]), zs = allP.map(p => p[1]); const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = 40, H = 30, pad = 3, k = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ)); const ox = (W - (maxX - minX) * k) / 2, oz = (H - (maxZ - minZ) * k) / 2;
  const P = ([px, pz]) => `${(ox + (px - minX) * k).toFixed(1)},${(oz + (pz - minZ) * k).toFixed(1)}`;
  const col = kind === 'column' ? `<rect x="${(ox + (RW - 0.6 - minX) * k).toFixed(1)}" y="${(oz + (0 - minZ) * k).toFixed(1)}" width="${(0.6 * k).toFixed(1)}" height="${(0.6 * k).toFixed(1)}" fill="currentColor"/>` : '';
  const bayS = bayQ ? `<polyline points="${bayQ.map(P).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 1.5"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polygon points="${pts.map(P).join(' ')}" fill="rgba(255,255,255,.12)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>${col}${bayS}</svg>`;
}
// 角を斜めに落とす(頂点 i を、両どなりの辺に沿って len だけ下がった2点に置きかえる)
export function chamferVertex(room, i, len = 0.6) {
  const n = room.poly.length, P = room.poly[i], A = room.poly[(i - 1 + n) % n], B = room.poly[(i + 1) % n];
  const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]); const ta = Math.min(len, la * 0.6), tb = Math.min(len, lb * 0.6);
  const p1 = [P[0] + (A[0] - P[0]) / la * ta, P[1] + (A[1] - P[1]) / la * ta], p2 = [P[0] + (B[0] - P[0]) / lb * tb, P[1] + (B[1] - P[1]) / lb * tb];
  room.poly.splice(i, 1, p1, p2); fixOpeningsAfterEdit(room, i, 1); syncBounds(room);
}
export function insertVertex(room, e, x, z) { room.poly.splice(e + 1, 0, [x, z]); fixOpeningsAfterEdit(room, e + 1, 0); syncBounds(room); }
export function removeVertex(room, i) { if (room.poly.length <= 3) return false; room.poly.splice(i, 1); fixOpeningsAfterEdit(room, i, -1); syncBounds(room); return true; }
// 頂点が増減したあと、開口の辺番号をずらす(消えた辺の開口は消す)
function fixOpeningsAfterEdit(room, at, delta) {
  if (delta === 0) { for (const o of room.openings) if (o.edge >= at) o.edge += 1; room.openings = room.openings.filter(o => o.u + o.w <= edgeFrame(room, o.edge).L + 0.01); return; }
  if (delta === 1) { room.openings = room.openings.filter(o => o.edge !== at - 1 && o.edge !== at); for (const o of room.openings) if (o.edge > at) o.edge += 1; return; }
  if (delta === -1) { room.openings = room.openings.filter(o => o.edge !== at && o.edge !== (at - 1 + room.poly.length + 1) % (room.poly.length + 1)); for (const o of room.openings) if (o.edge > at) o.edge -= 1; }
}
export function translateRoom(room, dx, dz) { for (const p of room.poly) { p[0] += dx; p[1] += dz; } for (const part of room.parts || []) { if (part.type === 'wall') { part.x1 += dx; part.x2 += dx; part.z1 += dz; part.z2 += dz; } else { part.x += dx; part.z += dz; } } syncBounds(room); }
// 四角い部屋の広さを変える(左上の角は固定)
export function resizeRect(room, w, d) { room.poly = rectPoly(room.x, room.z, w, d); syncBounds(room); room.openings = room.openings.filter(o => { const L = edgeFrame(room, o.edge).L; if (o.u + o.w > L - 0.05) o.u = Math.max(0.05, L - o.w - 0.05); return o.u >= 0 && o.w < L; }); }

// ---------- モジュール(尺 910 / メーター 1000)と寸法の表示 ----------
// 部屋の多角形は「内法(うちのり)」。壁の中心(芯)は内法から WALL_T/2 外側。芯々 = 内法 + WALL_T。
export const MODULES = {
  shaku: { name: '尺モジュール', badge: '一般的な住宅', grid: 0.91, half: 0.455, note: '910mm(3尺)の芯々グリッド。1間=1,820mm', desc: '一般的な住宅の寸法です' },
  meter: { name: 'メーターモジュール', badge: '一部のハウスメーカー', grid: 1.0, half: 0.5, note: '1,000mmの芯々グリッド。廊下や階段がゆったり', desc: '一部のハウスメーカーの寸法です' },
};
// 部屋のひな型(芯々 mm)。帖数は 不動産表示の基準(1畳=1.62㎡)で内法面積から
export const ROOM_PRESETS = {
  shaku: [ ['4.5畳', 2730, 2730], ['6畳', 2730, 3640], ['8畳', 3640, 3640], ['10畳', 3640, 4550], ['12畳', 3640, 5460], ['16畳', 4550, 5460], ['20畳', 5460, 5460], ['廊下', 910, 3640], ['トイレ', 910, 1820], ['洗面', 1820, 1820] ],
  meter: [ ['3,000×3,000', 3000, 3000], ['3,000×3,500', 3000, 3500], ['3,000×4,000', 3000, 4000], ['3,500×4,000', 3500, 4000], ['4,000×4,000', 4000, 4000], ['4,000×5,000', 4000, 5000], ['4,500×5,000', 4500, 5000], ['5,000×6,000', 5000, 6000], ['廊下', 1000, 4000], ['トイレ', 1000, 2000] ],
};
export const JO_M2 = 1.62; // 1畳(帖)あたりの面積(不動産の表示規約の基準)
export function mm(v) { return Math.round(v * 1000).toLocaleString('ja-JP'); }
export function mmRaw(v) { return Math.round(v * 1000); }
export function joOf(areaM2) { return (areaM2 / JO_M2).toFixed(1); }
// 帖数は 壁芯(へきしん)面積 ≒ 内法面積 + 周囲の長さ×壁厚/2 で出す(不動産の表示と同じ考え方)
export function wallCenterArea(room) { let per = 0; const p = room.poly; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); } return Math.abs(polyArea(p)) + per * WALL_T / 2 + 4 * (WALL_T / 2) ** 2; }
export function roomJo(room) { return joOf(wallCenterArea(room)); }
export function shinShin(inner) { return inner + WALL_T; }
export function innerOf(shin) { return shin - WALL_T; }
// 吸いつき:候補のどれかに近ければそこへ(近くなければそのまま)
export function snapTo(v, candidates, tol) { let best = v, bd = tol; for (const c of candidates) { const d = Math.abs(c - v); if (d < bd) { bd = d; best = c; } } return best; }
// 内法の座標が乗るべき線:芯グリッド(k*g − 0.06) の両側 → k*g と k*g − WALL_T
export function gridCandidates(v, grid, span = 2) { const k = Math.round(v / grid); const out = []; for (let i = -span; i <= span; i++) { out.push((k + i) * grid, (k + i) * grid - WALL_T); } return out; }
// 部屋の壁の内側の面(縦の壁→x、横の壁→z)
export function wallFaces(room) { const xs = [], zs = []; for (let e = 0; e < room.poly.length; e++) { const f = edgeFrame(room, e); if (Math.abs(f.along.x) < 0.05) xs.push(f.A[0]); if (Math.abs(f.along.z) < 0.05) zs.push(f.A[1]); } return { xs, zs }; }
// 角度の吸いつき(壁の向きに対して 0/90/180/270°)
export function snapAngle(a, base, tolDeg = 6) { const t = tolDeg * Math.PI / 180; for (let k = -4; k <= 4; k++) { const c = base + k * Math.PI / 2; let d = a - c; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < t) return c; } return a; }
