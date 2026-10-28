// 部屋のデータ → 壁・床・天井・窓・ドア・柱型・袖壁・梁 の3D
// 部屋の形は多角形(poly: [[x,z],...] 絶対座標)。壁は多角形の「辺(edge)」。開口は辺の番号(edge)と、辺の始点からの距離(u)。
import * as THREE from 'three';
import { surfaceMaterial, trimMaterial, ceilSpec, ceilPanelMaterial } from './textures.js';
import { mergeGroup } from './merge.js';
import { buildStair, stairHeights } from './stairs.js';

// ---------- 2階建て ----------
// 部屋の level(0=1階, 1=2階)。階高(1階の床→2階の床)は project.settings.floorH(既定 2.9m)
let FLOOR_H = 2.9;
export function setFloorH(v) { FLOOR_H = (v > 2 && v < 5) ? v : 2.9; }
export function floorH() { return FLOOR_H; }
export function levelOf(r) { return (r && r.level) || 0; }
// 玄関の土間のように1段下がる部屋は drop(m)だけ床を下げる
export function baseOf(r) { return r ? levelOf(r) * FLOOR_H - (r.drop || 0) : 0; }
export function hasUpper(rooms) { return rooms.some(r => levelOf(r) > 0); }
// 部屋がその階に見えるか(階段は1階と2階の両方)
export function onLevel(r, level) { return levelOf(r) === level || (r.stair && level === levelOf(r) + 1); }
const STEP_MAX = 0.3; // 1歩で上り下りできる高さ

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
  if (room.stair) room.h = FLOOR_H + (room.stair.upperH || 2.4);
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
const matSteelDoor = new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: .45, metalness: .35 }); // マンションの玄関(鉄の扉)
const matRail = new THREE.MeshStandardMaterial({ color: '#8d9296', roughness: .35, metalness: .7 });       // 手すり・面格子(アルミ)
const matRailGlass = new THREE.MeshStandardMaterial({ color: '#cfe0e8', roughness: .1, metalness: .1, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false });
const matFound = new THREE.MeshStandardMaterial({ color: '#9c9a95', roughness: .95 });
const matBathDoor = new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: .35 });
const matFrost = new THREE.MeshStandardMaterial({ color: '#dfe6ea', roughness: .25, metalness: .05 });
const matKnob = new THREE.MeshStandardMaterial({ color: '#c9b37a', roughness: .3, metalness: .8 });
const matGlass = new THREE.MeshStandardMaterial({ color: '#dbe9f6', roughness: .04, metalness: .15, transparent: true, opacity: .16, side: THREE.DoubleSide, envMapIntensity: .6, depthWrite: false });
const matCap = new THREE.MeshStandardMaterial({ color: '#d9d9d9', roughness: .9 });
const matSash = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: .4, metalness: .6 });
// 外側の面は、となりの部屋の壁の面と同じ位置に重なるので、少し奥に描く(ちらつき防止)
const matOuter = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .9, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });

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

// ---------- ニッチ(壁のくぼみ) ----------
// 奥・左右・上は壁紙の巻き込み。下だけ板(厚み30mm)を左右20mm・部屋側20mm出す(出窓と同じ考え)
function buildNiche(og, o, h, wallMat, boardMat, roomId, pick) {
  const D = Math.min(o.depth || 0.1, WALL_T - 0.015), w = h.w, y0 = h.sill, H = h.h, EAR = 0.02;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat); back.position.set(0, y0 + H / 2, -D); og.add(back);
  for (const sx of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat); sd.rotation.y = -sx * Math.PI / 2; sd.position.set(sx * w / 2, y0 + H / 2, -D / 2); og.add(sd); }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, D), wallMat); top.rotation.x = Math.PI / 2; top.position.set(0, y0 + H, -D / 2); og.add(top);
  const bd = box(w + EAR * 2, 0.03, D + EAR, boardMat); bd.position.set(0, y0 - 0.015, -D / 2 + EAR / 2); og.add(bd);
  for (const m of [back, bd]) { m.userData = { kind: 'niche', roomId, openingId: o.id }; pick.push(m); } for (const m of og.children) if (m.isMesh) m.receiveShadow = true;
}
// ---------- クローゼット・押入れの戸 ----------
// style: fold(折れ戸) / slide(引き違い) / fusuma(襖)。open 0=閉 1=開。戸は部屋側(収納の外)の面にそろえる
const matCloset = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: .5 });
const matFusuma = new THREE.MeshStandardMaterial({ color: '#efe7d3', roughness: .85 });
const matFusumaFrame = new THREE.MeshStandardMaterial({ color: '#3a2a1d', roughness: .5 });
const matPull = new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: .35, metalness: .6 });
// 戸のどこ(枠・取っ手・レール)をタップしても、その戸の開け閉めになるようにする
function buildClosetDoor(og, o, h, ctx) {
  const dg = new THREE.Group(); og.add(dg); buildClosetDoorParts(dg, o, h, ctx);
  dg.traverse(m => { if (m.isMesh) { m.userData = { kind: 'closetdoor', roomId: ctx.roomId, edge: ctx.edge, openingId: o.id, keep: true }; if (!ctx.pick.includes(m)) ctx.pick.push(m); } });
}
// ---------- 和の引き戸(障子・木製のガラス戸・玄関の格子戸) ----------
// style: shoji(障子)/ glassdoor(木の枠のガラス戸。縁側など)/ koshi(格子戸。玄関)。枚数 panels(既定:幅1m未満は1枚、2.4m以上は4枚、ほかは2枚)
export const WA_SLIDE = ['shoji', 'glassdoor', 'koshi', 'sash']; // sash=アルミの掃き出し窓(マンションのバルコニーへ)
export function isSlideStyle(st) { return st === 'slide' || st === 'fusuma' || WA_SLIDE.includes(st); }
const matShoji = new THREE.MeshStandardMaterial({ color: '#f5efe0', roughness: .9, emissive: '#4a4232', emissiveIntensity: .22, side: THREE.DoubleSide });
function waPanel(style, pw, H, t, wood) {
  const g = new THREE.Group(), fr = 0.03, add = (w, hh, d, m, x, y, z = 0) => { const b = box(w, hh, d, m); b.position.set(x, y, z); g.add(b); return b; };
  add(pw, fr, t, wood, 0, H - fr / 2); add(pw, fr * 1.6, t, wood, 0, fr * 0.8); add(fr, H, t, wood, -pw / 2 + fr / 2, H / 2); add(fr, H, t, wood, pw / 2 - fr / 2, H / 2);
  const iw = pw - fr * 2, yb = fr * 1.6, y1 = H - fr;
  if (style === 'sash') { g.clear(); const f = .045; add(pw, f, t, matSash, 0, H - f / 2); add(pw, f, t, matSash, 0, f / 2); add(f, H, t, matSash, -pw / 2 + f / 2, H / 2); add(f, H, t, matSash, pw / 2 - f / 2, H / 2); const gl = add(pw - f * 2, H - f * 2, .004, matGlass, 0, H / 2); gl.castShadow = false; add(.012, .14, .02, matSash, pw / 2 - .07, 1.0, t / 2 + .01); return g; }
  if (style === 'fusuma') { g.clear(); add(pw, H, t, matFusuma, 0, H / 2); for (const [bw, bh, x, y] of [[pw, 0.03, 0, H - 0.015], [pw, 0.03, 0, 0.015], [0.022, H, -pw / 2 + 0.011, H / 2], [0.022, H, pw / 2 - 0.011, H / 2]]) add(bw, bh, t + 0.006, matFusumaFrame, x, y);
    for (const zz of [t / 2 + 0.004, -t / 2 - 0.004]) { const q = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 16), matFusumaFrame); q.rotation.x = Math.PI / 2; q.position.set(pw / 2 - 0.08, 0.95, zz); g.add(q); } return g; }
  if (style === 'shoji') { const ko = 0.24, y0 = yb + ko; add(iw, ko, t * 0.6, wood, 0, yb + ko / 2); add(iw, y1 - y0, 0.004, matShoji, 0, (y0 + y1) / 2); const ny = Math.max(4, Math.round((y1 - y0) / 0.3));
    for (let i = 1; i < 3; i++) add(0.012, y1 - y0, t * 0.5, wood, -iw / 2 + iw * i / 3, (y0 + y1) / 2); for (let j = 0; j < ny; j++) add(iw, j ? 0.012 : 0.02, t * 0.5, wood, 0, y0 + (y1 - y0) * j / ny); }
  else if (style === 'glassdoor') { const ko = 0.3, y0 = yb + ko; add(iw, ko, t * 0.6, wood, 0, yb + ko / 2); const gl = add(iw, y1 - y0, 0.004, matGlass, 0, (y0 + y1) / 2); gl.castShadow = false; for (const k of [0, 1 / 3, 2 / 3]) add(iw, 0.028, t * 0.7, wood, 0, y0 + (y1 - y0) * k); }
  else { add(iw, y1 - yb, 0.004, matFrost, 0, (yb + y1) / 2, -t * 0.25); const n = Math.max(6, Math.round(iw / 0.045)); for (let i = 0; i < n; i++) add(0.014, y1 - yb, t * 0.45, wood, -iw / 2 + iw * (i + 0.5) / n, (yb + y1) / 2, t * 0.2); for (const k of [0.3, 0.62]) add(iw, 0.025, t * 0.7, wood, 0, yb + (y1 - yb) * k, t * 0.2); }
  return g;
}
function buildWaSlideParts(og, o, h, ctx) {
  const style = o.style, open = Math.max(0, Math.min(1, o.open || 0)), w = h.w, H = h.h - 0.01, t = 0.03, zf = -WALL_T + 0.022;
  const wood = style === 'sash' ? matSash : style === 'fusuma' ? trimMaterial(o.finish || 'wood_medium') : trimMaterial(o.finish || (style === 'koshi' ? 'wood_walnut' : 'wood_medium')); const n = o.panels || (w < 1.0 ? 1 : w >= 2.4 ? 4 : 2);
  if (n === 1) { const p = waPanel(style, w + 0.03, H, t, wood); p.position.set(-open * (w - 0.08), 0, zf - 0.02); og.add(p); const rail = box(w * 2, 0.012, 0.05, wood); rail.position.set(-w / 2, 0.006, zf - 0.02); og.add(rail); return; }
  const pw = w / n + 0.02, back = zf, front = zf - 0.035;
  for (let i = 0; i < n; i++) { const cx = -w / 2 + w / n * (i + 0.5); let z = back, dx = 0;
    if (n === 2) { if (i === 1) { z = front; dx = -open * (w - pw); } }
    else if (i === 1 || i === 2) { z = front; dx = (i === 1 ? -1 : 1) * open * (w / n); }
    else if (n > 4 && i % 2) { z = front; dx = -open * (w / n); }
    const p = waPanel(style, pw, H, t, wood); p.position.set(cx + dx, 0, z); og.add(p); }
  const rail = box(w, 0.012, 0.075, wood); rail.position.set(0, 0.006, zf - 0.018); og.add(rail);
}
function buildClosetDoorParts(og, o, h, ctx) {
  const style = o.style || 'fold', open = Math.max(0, Math.min(1, o.open || 0)), w = h.w, H = h.h - 0.01, t = 0.03, zf = -WALL_T + 0.022;
  const tag = m => { m.userData = { kind: 'closetdoor', roomId: ctx.roomId, edge: ctx.edge, openingId: o.id, keep: true }; ctx.pick.push(m); return m; };
  if (WA_SLIDE.includes(style) || (style === 'fusuma' && (o.panels > 2 || (!o.panels && h.w >= 2.4)))) { buildWaSlideParts(og, o, h, ctx); return; }
  if ((style === 'slide' || style === 'fusuma') && w < 1.0) {
    // 片引き戸(トイレなど):1枚を壁にそって横へ引く
    const pw = w + 0.03, mat = style === 'fusuma' ? matFusuma : matCloset; const g = new THREE.Group(); g.position.set(-open * (w - 0.08), 0, zf - 0.02); const p = tag(box(pw, H, t, mat)); p.position.y = H / 2; g.add(p);
    for (const zz of [t / 2 + 0.004, -t / 2 - 0.004]) { const q = box(0.015, 0.25, 0.012, matPull); q.position.set(w / 2 - 0.07, 0.95, zz); g.add(q); } og.add(g);
    const rail = box(w * 2, 0.012, 0.05, ctx.frame); rail.position.set(-w / 2, H + 0.004, zf - 0.02); og.add(rail); return;
  }
  if (style === 'slide' || style === 'fusuma') {
    const pw = w / 2 + 0.02, mat = style === 'fusuma' ? matFusuma : matCloset;
    const panel = (cx, z) => { const g = new THREE.Group(); g.position.set(cx, 0, z); const p = tag(box(pw, H, t, mat)); p.position.y = H / 2; g.add(p);
      if (style === 'fusuma') { for (const [bw, bh, x, y] of [[pw, 0.03, 0, H - 0.015], [pw, 0.03, 0, 0.015], [0.022, H, -pw / 2 + 0.011, H / 2], [0.022, H, pw / 2 - 0.011, H / 2]]) { const b = box(bw, bh, t + 0.006, matFusumaFrame); b.position.set(x, y, 0); g.add(b); } }
      return g; };
    // 左の戸は奥のレール、右の戸は手前のレール。開くと右の戸が左へ重なる
    const L = panel(-w / 2 + pw / 2, zf + 0.0), R = panel(w / 2 - pw / 2 - open * (w - pw), zf - 0.035); og.add(L); og.add(R);
    for (const [g, sx] of [[L, 1], [R, -1]]) { const pull = style === 'fusuma' ? new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 16), matFusumaFrame) : box(0.012, 0.3, 0.012, matPull); if (style === 'fusuma') pull.rotation.x = Math.PI / 2; for (const zz of [t / 2 + 0.004, -t / 2 - 0.004]) { const q = pull.clone(); q.position.set(sx * (pw / 2 - 0.08), 0.95, zz); g.add(q); } }
    const rail = box(w, 0.012, 0.075, ctx.frame); rail.position.set(0, 0.006, zf - 0.018); og.add(rail);
  } else {
    // 折れ戸:幅 1m までは2枚1組を片側へ、それより広いと2組を両側へたたむ
    const pairs = w > 1.0 ? 2 : 1, a = w / (pairs * 2), th = open * 1.3;
    for (let p = 0; p < pairs; p++) {
      const sdir = pairs === 1 ? -1 : (p === 0 ? -1 : 1), x0 = sdir * w / 2, d = -sdir;
      const A = new THREE.Group(); A.position.set(x0, 0, zf); A.rotation.y = d * th; const la = tag(box(a + 0.002, H, t, matCloset)); la.position.set(d * a / 2, H / 2, 0); A.add(la); og.add(A);
      const B = new THREE.Group(); B.position.set(x0 + d * a * Math.cos(th), 0, zf - a * Math.sin(th)); B.rotation.y = -d * th; const lb = tag(box(a + 0.002, H, t, matCloset)); lb.position.set(d * a / 2, H / 2, 0); B.add(lb);
      const knob = box(0.012, 0.22, 0.02, matPull); knob.position.set(d * (a - 0.05), 0.95, -t / 2 - 0.01); B.add(knob); og.add(B);
    }
    const rail = box(w, 0.012, 0.05, ctx.frame); rail.position.set(0, H + 0.004, zf); og.add(rail);
  }
}
// ---------- クローゼット・押入れの中 ----------
// cl:枕棚(床から1,800)+ハンガーパイプ(1,700)/ wic:L字に枕棚とパイプ / oshiire:中段(780)+枕棚(1,800)/ sic:可動棚 / storage:棚
const matShelf = new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: .6 });
const matPly = new THREE.MeshStandardMaterial({ color: '#d9c39d', roughness: .7 });
const MATS = {}; const mat = c => MATS[c] || (MATS[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .9 }));
// 服の形(正面から見た形を薄く押し出す)。上の真ん中がハンガーのフック。幅はおよそ肩幅 450
const GARMENTS = ['tee', 'shirt', 'jacket', 'tee', 'shirt', 'dress'];
const garmentGeo = {};
function garmentShape(kind) {
  const s = new THREE.Shape(), W = kind === 'jacket' ? 0.24 : 0.22; // 半分の幅
  if (kind === 'tee') { s.moveTo(-0.06, 0); s.lineTo(-W, -0.04); s.lineTo(-W - 0.08, -0.16); s.lineTo(-W + 0.02, -0.21); s.lineTo(-W + 0.03, -0.14); s.lineTo(-W + 0.03, -0.66); s.lineTo(W - 0.03, -0.66); s.lineTo(W - 0.03, -0.14); s.lineTo(W - 0.02, -0.21); s.lineTo(W + 0.08, -0.16); s.lineTo(W, -0.04); s.lineTo(0.06, 0); s.quadraticCurveTo(0, -0.05, -0.06, 0); }
  else if (kind === 'dress') { s.moveTo(-0.05, 0); s.lineTo(-0.15, -0.02); s.lineTo(-0.16, -0.3); s.lineTo(-0.27, -1.0); s.lineTo(0.27, -1.0); s.lineTo(0.16, -0.3); s.lineTo(0.15, -0.02); s.lineTo(0.05, 0); s.quadraticCurveTo(0, -0.06, -0.05, 0); }
  else { const L = kind === 'jacket' ? 0.78 : 0.74; // 長袖(袖はからだの横に下がる)
    s.moveTo(-0.05, 0); s.lineTo(-W, -0.035); s.lineTo(-W - 0.04, -0.12); s.lineTo(-W - 0.05, -0.6); s.lineTo(-W + 0.02, -0.62); s.lineTo(-W + 0.03, -0.2); s.lineTo(-W + 0.03, -L); s.lineTo(W - 0.03, -L); s.lineTo(W - 0.03, -0.2); s.lineTo(W - 0.02, -0.62); s.lineTo(W + 0.05, -0.6); s.lineTo(W + 0.04, -0.12); s.lineTo(W, -0.035); s.lineTo(0.05, 0); s.lineTo(0, -0.06); s.lineTo(-0.05, 0); }
  return s;
}
const matHanger = new THREE.MeshStandardMaterial({ color: '#b08a5e', roughness: .5 });
function garment(kind, color) {
  if (!garmentGeo[kind]) { const g = new THREE.ExtrudeGeometry(garmentShape(kind), { depth: kind === 'jacket' ? 0.035 : 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 }); g.translate(0, -0.03, -0.0125); garmentGeo[kind] = g; }
  const grp = new THREE.Group(); const m = new THREE.Mesh(garmentGeo[kind], mat(color)); m.castShadow = true; grp.add(m);
  // ハンガー(肩の木の棒+フック)と、ワイシャツのえり
  // ハンガーの肩は、両側に約11°下がる
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.012, 0.02), matHanger); arm.position.set(sx * 0.1, -0.035 - 0.02, 0); arm.rotation.z = -sx * 0.19; grp.add(arm); }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 4, 10, Math.PI * 1.4), matPull); hook.position.y = 0.0; hook.rotation.z = -0.4; grp.add(hook);
  if (kind === 'shirt') { const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), mat('#ffffff')); col.position.set(0, -0.05, 0.004); grp.add(col); }
  grp.userData.keep = false; return grp;
}
const CLOTHES = ['#3d4a5c', '#b9a789', '#6d7f6a', '#e2ddd3', '#8a5a4a', '#2f2f33', '#a7b4c2'];
export function closetDoorEdge(room) { const o = (room.openings || []).find(x => x.type === 'closet') || (room.openings || []).find(x => x.type !== 'window' && x.type !== 'niche'); return o ? o.edge : 0; }
function buildClosetInside(room, group) {
  const kind = room.closet, de = closetDoorEdge(room), f = edgeFrame(room, de), L = f.L;
  let depth = 0; for (const [x, z] of room.poly) depth = Math.max(depth, (x - f.A[0]) * f.normal.x + (z - f.A[1]) * f.normal.z);
  const put = (lu, ly, ls, u, y, sd, mat) => { const m = box(lu, ly, ls, mat); m.position.copy(wallPoint(room, de, u, y, sd)); m.rotation.y = f.rotY; m.userData = { kind: 'closetin', roomId: room.id, mergeKey: 'closetin' }; group.add(m); return m; };
  const pipe = (u0, u1, s, y) => { const len = u1 - u0; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, len, 10), matPull); c.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(c); g.position.copy(wallPoint(room, de, (u0 + u1) / 2, y, s)); g.rotation.y = f.rotY; group.add(g);
    // 掛けてある服(少しだけ)
    // 掛けてある服:Tシャツ・ワイシャツ・ジャケット・ワンピースの形を、ハンガーごと
    let k = 0; for (let u = u0 + 0.12; u < u1 - 0.1; u += 0.075 + ((k * 37) % 4) * 0.015, k++) { if (k % 5 === 4) continue; const kind = GARMENTS[(k * 7 + 3) % GARMENTS.length]; const col = kind === 'shirt' ? ['#f4f4f2', '#cfe0f0', '#f4f4f2'][k % 3] : kind === 'jacket' ? ['#2f3542', '#5a4a3f', '#3c4a3a'][k % 3] : CLOTHES[k % CLOTHES.length];
      const gg = garment(kind, col); gg.position.copy(wallPoint(room, de, u, y - 0.02, s)); gg.rotation.y = f.rotY + Math.PI / 2 + (((k * 53) % 7) - 3) * 0.02; group.add(gg); } };
  // 入り口(ドア・開口)の前には棚もパイプも付けない。人が通る所をふさがないため(ノブさん 2026-10-28)
  const gaps = []; for (const o of room.openings || []) { if (o.type === 'window' || o.type === 'niche') continue; const ff = edgeFrame(room, o.edge); const p0 = ff.origin.clone().addScaledVector(ff.along, o.u), p1 = ff.origin.clone().addScaledVector(ff.along, o.u + o.w);
    const loc = p => [(p.x - f.A[0]) * f.along.x + (p.z - f.A[1]) * f.along.z, (p.x - f.A[0]) * f.normal.x + (p.z - f.A[1]) * f.normal.z]; const a = loc(p0), b = loc(p1);
    if (o.edge === de) continue; const side = Math.abs(a[0] - b[0]) < 0.05; // 横の壁の入り口は、その奥行きの所を端から端まで通路として空ける
    gaps.push({ u0: side ? -1 : Math.min(a[0], b[0]) - 0.1, u1: side ? L + 1 : Math.max(a[0], b[0]) + 0.1, s0: Math.min(a[1], b[1]) - 0.1, s1: Math.max(a[1], b[1]) + 0.1, side, su: a[0] }); }
  // u の範囲 [u0,u1] のうち、奥行き s の所にある入り口をよけた区間
  const freeU = (u0, u1, s0, s1) => { let segs = [[u0, u1]]; for (const g of gaps) { if (g.s1 < s0 || g.s0 > s1) continue; segs = segs.flatMap(([a, b]) => (g.u1 <= a || g.u0 >= b) ? [[a, b]] : [[a, Math.max(a, g.u0)], [Math.min(b, g.u1), b]]); } return segs.filter(([a, b]) => b - a > 0.3); };
  const blockedSide = (u, s0, s1) => gaps.some(g => g.side && Math.abs(g.su - u) < 0.1 && !(g.s1 < s0 || g.s0 > s1));
  const freeS = (u, s0, s1) => { let segs = [[s0, s1]]; for (const g of gaps) { if (!g.side) continue; segs = segs.flatMap(([a, b]) => (g.s1 <= a || g.s0 >= b) ? [[a, b]] : [[a, Math.max(a, g.s0)], [Math.min(b, g.s1), b]]); } return segs.filter(([a, b]) => b - a > 0.3); };
  const pipeSide = (s0, s1, u, y) => { const len = s1 - s0; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, len, 10), matPull); c.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(c); g.position.copy(wallPoint(room, de, u, y, (s0 + s1) / 2)); g.rotation.y = f.rotY; group.add(g); };
  if (kind === 'cl' || kind === 'wic') {
    const sd = Math.min(0.4, depth * 0.5), ps = depth - Math.min(0.33, depth / 2);
    for (const [a, b] of freeU(0, L, depth - sd - 0.1, depth)) { put(b - a, 0.022, sd, (a + b) / 2, 1.8, depth - sd / 2, matShelf); pipe(a + 0.03, b - 0.03, ps, 1.7); }
    if (kind === 'wic' && depth > 1.2 && !blockedSide(0, 0.75, depth - sd)) { put(sd, 0.022, depth - sd - 0.75, sd / 2, 1.8, (depth - sd - 0.75) / 2 + 0.75, matShelf); pipeSide(0.75, depth - sd, 0.33, 1.7); }
  } else if (kind === 'oshiire') {
    put(L, 0.03, depth - 0.02, L / 2, 0.765, depth / 2 + 0.01, matPly); put(L, 0.06, 0.04, L / 2, 0.75, 0.04, matPly); put(L, 0.02, 0.45, L / 2, 1.8, depth - 0.225, matPly); // 枕棚は奥行450
    // 布団(中段の上)
    const fw = Math.min(1.0, L * 0.55); for (let i = 0; i < 4; i++) put(fw, 0.1, Math.min(0.7, depth - 0.1), fw / 2 + 0.05, 0.83 + i * 0.105, depth / 2 + 0.02, mat(['#f2efe6', '#c9d6e3', '#efe3cf', '#e6e9ee'][i]));
  } else if (kind === 'sic' || kind === 'storage') {
    const ys = kind === 'sic' ? [0.12, 0.42, 0.72, 1.02, 1.32, 1.62, 1.92] : [0.4, 0.9, 1.4, 1.9];
    // 通路を450以上残す:奥行きが浅ければ棚も浅く。入口の幅がせまいシューズクロークは、長い側の壁に棚を付ける
    const narrow = kind === 'sic' && L < 1.2 && depth > 1.0; const sd = narrow ? Math.min(0.32, L - 0.45) : Math.max(0.25, Math.min(kind === 'sic' ? 0.35 : 0.45, depth - 0.5));
    const segs = freeU(0, L, depth - sd - 0.1, depth);
    if (narrow) { if (!blockedSide(L, 0, depth)) for (const y of ys) put(sd, 0.02, depth - 0.1, L - sd / 2, y, depth / 2 + 0.05, matShelf); } else if (segs.length) { for (const y of ys) for (const [a, b] of segs) put(b - a, 0.02, sd, (a + b) / 2, y, depth - sd / 2, matShelf); }
    else if (L - 0.45 >= 0.25) { // 奥に入り口があって奥の棚が付けられない(通り抜けの納戸など):入り口のない横の壁に、通路450を残して棚
      const sw = Math.min(0.35, L - 0.45), useU0 = !gaps.some(g => g.side && g.su < 0.1); const uc = useU0 ? sw / 2 : L - sw / 2;
      for (const [a, b] of freeS(uc, 0.1, depth - 0.05)) for (const y of ys) put(sw, 0.02, b - a, uc, y, (a + b) / 2, matShelf); }
    // 靴(シューズインクローゼットの棚に少しだけ)
    if (kind === 'sic') { let k = 0; const shoe = (u, s, y, rot) => put(rot ? 0.26 : 0.2, 0.08 + (k % 3) * 0.04, rot ? 0.2 : 0.26, u, y + 0.05 + (k % 3) * 0.02, s, mat(['#2f2f33', '#7a5b45', '#e9e6df', '#4b5a73'][k % 4]));
      for (const y of ys.slice(0, 5)) { if (narrow) for (let s2 = 0.25; s2 < depth - 0.15; s2 += 0.26, k++) { if ((k * 7) % 5 === 0) continue; shoe(L - sd / 2, s2, y, true); } else for (let u = 0.12; u < L - 0.15; u += 0.26, k++) { if ((k * 7) % 5 === 0) continue; shoe(u + 0.1, depth - 0.18, y, false); } } }
  }
}
// 梁の見付(見える幅):木を見せるときは梁そのものの幅、クロス巻き込みは 下地13mm+石膏ボード12mm を両側に足す
export const BEAM_BOARD = 0.012, BEAM_FURRING = 0.013;
export function beamVisibleWidth(part) { const core = part.core || 0.15; return part.finish === 'wood' ? core : core + 2 * (BEAM_BOARD + BEAM_FURRING); }
export function wallSpec(room, e) { return (room.walls && (room.walls[e] !== undefined ? room.walls[e] : room.walls[String(e)])) || { lib: 'wp_white' }; }

// ---------- 和室(真壁の柱・長押・欄間・床の間) ----------
// room.wa = { wood:'wood_medium'(柱・長押・枠の色), hashira:true(柱を見せる), nageshi:true(長押), kamoi:1.8(鴨居の高さ) }
function waTrim(wa) { const w = wa.wood || 'wood_medium'; return { crown: { on: true, h: 40, finish: w }, base: { on: true, h: 30, finish: w }, casing: { on: true, w: 25, finish: w }, door: { finish: w } }; }
function findOpening(project, id) { for (const r of project.rooms || []) for (const x of r.openings || []) if (x.id === id) return x; return null; }
function ranmaH(op) { return op && op.ranma ? (typeof op.ranma === 'number' ? op.ranma : 0.35) : 0; }
// 欄間の穴:戸の上(鴨居 90mm の上)。持ち主(twin でない側)の o.ranma を見る
function ranmaHole(hh, H, project) { const o = hh.op; if (o.type === 'window' || o.type === 'niche') return null; const own = o.twin ? findOpening(project, o.twin) : o; const rh0 = ranmaH(own); if (!rh0) return null;
  const sill = hh.sill + hh.h + 0.09, rh = Math.min(rh0, H - sill - 0.08); return rh >= 0.1 ? { u: hh.u, w: hh.w, sill, h: rh, op: { type: 'ranma' } } : null; }
function buildRanma(og, o, hh, H, wood) {
  const rh0 = ranmaH(o); if (!rh0 || o.type === 'window' || o.type === 'niche') return; const y0 = hh.sill + hh.h, sill = y0 + 0.09, rh = Math.min(rh0, H - sill - 0.08); if (rh < 0.1) return; const w = hh.w, zc = -WALL_T / 2;
  const add = (bw, bh, bd, m, x, y, z = zc) => { const b = box(bw, bh, bd, m); b.position.set(x, y, z); og.add(b); return b; };
  add(w + 0.04, 0.09, WALL_T + 0.012, wood, 0, y0 + 0.045);                        // 鴨居
  add(w, 0.02, WALL_T, wood, 0, sill + rh + 0.01); for (const sx of [-1, 1]) add(0.02, rh + 0.02, WALL_T, wood, sx * (w / 2 + 0.01), sill + rh / 2); // 欄間の枠
  if (o.ranmaStyle === 'shoji') { add(w, rh, 0.004, matShoji, 0, sill + rh / 2); const n = Math.max(3, Math.round(w / 0.3)); for (let i = 1; i < n; i++) add(0.012, rh, 0.02, wood, -w / 2 + w * i / n, sill + rh / 2); add(w, 0.012, 0.02, wood, 0, sill + rh / 2); }
  else { const n = Math.max(6, Math.round(w / 0.06)); for (let i = 0; i < n; i++) add(0.018, rh, 0.03, wood, -w / 2 + w * (i + 0.5) / n, sill + rh / 2); add(w, 0.02, 0.035, wood, 0, sill + rh * 0.5); }
}
// 床の間の口:床柱(o.toko = 'left' | 'right' の側)と落とし掛け。床框は sill(段)で作る(kamachi で色)
const matTokobashira = new THREE.MeshStandardMaterial({ color: '#b48a5e', roughness: .42 });
function buildToko(og, o, hh, H) {
  const side = o.toko === 'right' ? 1 : -1, w = hh.w; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, H, 14), matTokobashira); post.castShadow = true; post.receiveShadow = true; post.position.set(side * (w / 2 + 0.045), H / 2, -0.03); og.add(post);
  const ot = box(w + 0.03, 0.05, 0.045, trimMaterial('wood_walnut')); ot.position.set(0, hh.sill + hh.h + 0.025, -0.005); og.add(ot);
}
// 真壁の柱(角と、開口の両わき、間は 1,820 以内ごと)と長押
function buildWaWall(room, e, f, L, H, holes, wood, group) {
  const wa = room.wa, pw = 0.105, out = 0.015 - pw / 2, tag = (m, k) => { m.userData = { kind: 'trim', part: k, roomId: room.id, mergeKey: k }; group.add(m); return m; };
  const spans = holes.map(x => [x.u, x.u + x.w, x.op]);
  if (wa.hashira !== false) {
    const anchors = [pw / 2, L - pw / 2]; for (const [a, b, op] of spans) { if (op.toko) continue; anchors.push(a - pw / 2, b + pw / 2); }
    const A = [...new Set(anchors.filter(u => u >= pw / 2 - 1e-6 && u <= L - pw / 2 + 1e-6).map(u => Math.round(u * 1000) / 1000))].sort((a, b) => a - b), us = [];
    for (let i = 0; i < A.length; i++) { us.push(A[i]); if (i < A.length - 1) { const gap = A[i + 1] - A[i], k = Math.ceil(gap / 1.82 - 1e-6); for (let j = 1; j < k; j++) us.push(A[i] + gap * j / k); } }
    for (const u of us) { if (spans.some(([a, b]) => u + pw / 2 > a + 1e-3 && u - pw / 2 < b - 1e-3)) continue; if (us.some(v => v < u && u - v < pw * 0.9)) continue;
      const m = tag(box(pw, H, pw, wood), 'hashira'); m.position.copy(wallPoint(room, e, u, H / 2, out)); m.rotation.y = f.rotY; }
  }
  if (wa.nageshi !== false) { const ky = wa.kamoi || 1.8, y = ky + 0.045; if (H < ky + 0.3) return; const cut = spans.filter(([a, b, op]) => { const top = (op.type === 'window' || op.type === 'niche' ? (op.sill ?? 0.9) : (op.sill || 0)) + op.h; const bot = op.type === 'window' || op.type === 'niche' ? (op.sill ?? 0.9) : (op.sill || 0); return top > ky + 0.02 && bot < ky + 0.09; }).sort((p, q) => p[0] - q[0]);
    let u0 = 0; const segs = []; for (const [a, b] of cut) { if (a > u0) segs.push([u0, a]); u0 = Math.max(u0, b); } if (u0 < L) segs.push([u0, L]);
    for (const [a, b] of segs) { if (b - a < 0.05) continue; const m = tag(box(b - a, 0.09, 0.04, wood), 'nageshi'); m.position.copy(wallPoint(room, e, (a + b) / 2, y, 0.035)); m.rotation.y = f.rotY; } }
}

// 和室の天井の立体の部材:竿縁(一方向の細い竿)・網代と格天井(格子)。天井と同じく、上から見る画面では隠れる(kind:'ceiling')
const ceilMats = new Map();
function scanPoly(poly, axis, c) { const xs = []; for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; const p1 = axis === 'z' ? z1 : x1, p2 = axis === 'z' ? z2 : x2, q1 = axis === 'z' ? x1 : z1, q2 = axis === 'z' ? x2 : z2; if ((p1 <= c && p2 > c) || (p2 <= c && p1 > c)) xs.push(q1 + (c - p1) / (p2 - p1) * (q2 - q1)); } xs.sort((a, b) => a - b); const out = []; for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]); return out; }
function buildCeil3D(room, H, group) {
  const cs = ceilSpec(room.ceiling); if (!cs || !cs.type.d3) return; const d3 = cs.type.d3, T = cs.tone;
  const col = d3.bamboo ? '#b7a467' : T.sao; if (!ceilMats.has(col)) ceilMats.set(col, new THREE.MeshStandardMaterial({ color: col, roughness: d3.bamboo ? .4 : .55 })); const mat = ceilMats.get(col);
  const tag = (o, k = 'ceil3d') => { o.castShadow = false; o.receiveShadow = true; o.userData = { kind: 'ceiling', roomId: room.id, mergeKey: k }; group.add(o); return o; };
  const bar = (axis, a, e, c, w, d, y, m = mat) => { const len = e - a; if (len < .03) return; const o = d3.bamboo ? new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, len, 10), m) : box(axis === 'z' ? len : w, d, axis === 'z' ? w : len, m);
    if (d3.bamboo) o.rotation[axis === 'z' ? 'z' : 'x'] = Math.PI / 2; o.position.set(axis === 'z' ? (a + e) / 2 : c, y, axis === 'z' ? c : (a + e) / 2); tag(o); };
  const b = polyBounds(room.poly), rect = isRect(room);
  // 折上げ:まわり cove(m) を斜めに下げる。中の平らな所が格天井
  const cove = rect && d3.cove ? d3.cove : 0, rise = d3.rise || 0; const R = { minX: b.minX + cove, maxX: b.maxX - cove, minZ: b.minZ + cove, maxZ: b.maxZ - cove };
  if (cove) {
    const cmat = ceilPanelMaterial({ ...room.ceiling, lib: cs.lib }); const lo = H - rise;
    const quad = (p) => { const geo = new THREE.BufferGeometry(); const v = [...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]]; geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); geo.computeVertexNormals(); const o = new THREE.Mesh(geo, cmat); tag(o, 'cove'); };
    const O = [[b.minX, lo, b.minZ], [b.maxX, lo, b.minZ], [b.maxX, lo, b.maxZ], [b.minX, lo, b.maxZ]], I = [[R.minX, H, R.minZ], [R.maxX, H, R.minZ], [R.maxX, H, R.maxZ], [R.minX, H, R.maxZ]];
    for (let k = 0; k < 4; k++) quad([O[k], O[(k + 1) % 4], I[(k + 1) % 4], I[k]]);
    // 折上げの下の回り縁(壁ぞい)と、上の回り縁(中の枠)
    const cr = .05; bar('z', b.minX, b.maxX, b.minZ + cr / 2, cr, .06, lo - .03); bar('z', b.minX, b.maxX, b.maxZ - cr / 2, cr, .06, lo - .03); bar('x', b.minZ, b.maxZ, b.minX + cr / 2, cr, .06, lo - .03); bar('x', b.minZ, b.maxZ, b.maxX - cr / 2, cr, .06, lo - .03);
  }
  const y = H - d3.d / 2;
  if (d3.kind === 'sao') {
    // 竿縁:板と直角に、一方向にだけ通す(吹寄せは2本ずつ)。dir='x' なら90°回す
    const axis = cs.dir === 'x' ? 'x' : 'z', lo = axis === 'z' ? b.minZ : b.minX, hi = axis === 'z' ? b.maxZ : b.maxX, L = hi - lo, n = Math.max(1, Math.round(L / d3.step)), st = L / n;
    for (let i = 1; i < n; i++) { const c0 = lo + st * i; for (const c of d3.pair ? [c0 - d3.pair / 2, c0 + d3.pair / 2] : [c0]) for (const [a, e] of scanPoly(room.poly, axis, c)) bar(axis, a, e, c, d3.w, d3.d, y); }
    return;
  }
  // 格子:網代の枠・格天井の格縁。rim=壁ぞいにも格縁、panel=マスに鏡板、sub=小組(マスの中の細い格子)
  const nx = Math.max(1, Math.round((R.maxX - R.minX) / d3.step)), nz = Math.max(1, Math.round((R.maxZ - R.minZ) / d3.step)), sx = (R.maxX - R.minX) / nx, sz = (R.maxZ - R.minZ) / nz;
  const lineZ = (c, w, d, yy) => { for (const [a, e] of (cove ? [[R.minX, R.maxX]] : scanPoly(room.poly, 'z', c))) bar('z', a, e, c, w, d, yy); };
  const lineX = (c, w, d, yy) => { for (const [a, e] of (cove ? [[R.minZ, R.maxZ]] : scanPoly(room.poly, 'x', c))) bar('x', a, e, c, w, d, yy); };
  for (let i = d3.rim ? 0 : 1; i <= (d3.rim ? nz : nz - 1); i++) lineZ(Math.min(R.maxZ - d3.w / 2, Math.max(R.minZ + d3.w / 2, R.minZ + sz * i)), d3.w, d3.d, y);
  for (let i = d3.rim ? 0 : 1; i <= (d3.rim ? nx : nx - 1); i++) lineX(Math.min(R.maxX - d3.w / 2, Math.max(R.minX + d3.w / 2, R.minX + sx * i)), d3.w, d3.d, y);
  if (d3.sub) { const sw = .012, sd = .016, yy = H - sd / 2; for (let i = 0; i < nz; i++) for (let k = 1; k < d3.sub; k++) lineZ(R.minZ + sz * (i + k / d3.sub), sw, sd, yy); for (let i = 0; i < nx; i++) for (let k = 1; k < d3.sub; k++) lineX(R.minX + sx * (i + k / d3.sub), sw, sd, yy); }
  if (cs.type.panel) {
    // 鏡板:マスごとに1枚(木目の向きを交互に変えて、同じ板が並んで見えないように)
    const pm = ceilPanelMaterial({ ...room.ceiling, lib: cs.lib });
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const cx = R.minX + sx * (i + .5), cz = R.minZ + sz * (j + .5); if (!pointInPoly(cx, cz, room.poly)) continue;
      const o = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), pm); o.rotation.x = Math.PI / 2; o.rotation.z = ((i * 7 + j * 3) % 2) ? Math.PI : 0; o.position.set(cx, H - .002, cz); tag(o, 'panel'); }
  }
}

// ---------- バルコニー(room.outdoor = { rail:'concrete'|'glass'|'steel', h:1.1, sky:false }) ----------
// ほかの部屋に面していない辺は「手すり壁」になり、その上は外(空)。sky:true なら天井(上の階のバルコニーの裏)もなし
function edgeIsOpen(room, e, project) { const f = edgeFrame(room, e); for (const t of [.2, .5, .8]) { const p = wallPoint(room, e, f.L * t, 0, -(WALL_T + .08)); if ((project.rooms || []).some(r => r !== room && levelOf(r) === levelOf(room) && pointInPoly(p.x, p.z, r.poly))) return false; } return true; }
function buildRail(og, L, hp, kind, roomId) {
  const add = (w, h, d, m, x, y, z) => { const b = box(w, h, d, m); b.position.set(x, y, z); og.add(b); return b; };
  if (kind === 'glass') { add(L, .012, .05, matRail, L / 2, hp - .006, -WALL_T / 2); const g = new THREE.Mesh(new THREE.PlaneGeometry(L, hp - .2), matRailGlass); g.position.set(L / 2, .1 + (hp - .2) / 2, -WALL_T / 2); og.add(g); for (let x = 0; x <= L + 1e-6; x += Math.max(.6, L / Math.round(L / 1.2))) add(.03, hp - .1, .03, matRail, Math.min(L - .015, Math.max(.015, x)), .05 + (hp - .1) / 2, -WALL_T / 2); }
  else if (kind === 'steel') { add(L, .035, .05, matRail, L / 2, hp - .02, -WALL_T / 2); add(L, .02, .03, matRail, L / 2, .12, -WALL_T / 2); for (let x = .05; x < L; x += .11) add(.015, hp - .15, .015, matRail, x, .12 + (hp - .15) / 2, -WALL_T / 2); }
  else add(L, .04, .06, matRail, L / 2, hp + .05, -WALL_T / 2 + .03); // コンクリートの手すり壁の上に、アルミの笠木と手すり
}

export function buildRoom(room, project, group) {
  normalizeRoom(room);
  const assets = project.assets || {};
  const H = room.h, pick = [];
  const roomGroup = new THREE.Group(); roomGroup.name = 'room:' + room.id; roomGroup.userData.roomId = room.id; roomGroup.userData.level = levelOf(room); roomGroup.position.y = baseOf(room);
  // 2階がある家の1階は、外側の壁を2階の床まで伸ばす(外から見たときのすき間をふさぐ)
  const outerH = (levelOf(room) === 0 && !room.stair && (project.rooms || []).some(r => levelOf(r) === 1 && r.x < room.x + room.w && r.x + r.w > room.x && r.z < room.z + room.d && r.z + r.d > room.z)) ? Math.max(H, FLOOR_H) : H;
  const trim = (room.wa && !room.trim) ? waTrim(room.wa) : roomTrim(room); const waWood = room.wa ? trimMaterial(room.wa.wood || 'wood_medium') : null; const matCrown = trimMaterial(trim.crown.finish), matBase = trimMaterial(trim.base.finish), matCase = trimMaterial(trim.casing.finish), matDoorFrame = trimMaterial(trim.door.finish);
  const crownH = Math.max(0.01, (trim.crown.h || 35) / 1000), baseH = Math.max(0.01, (trim.base.h || 60) / 1000), caseW = Math.max(0.02, (trim.casing.w || 55) / 1000);
  // 床
  const floor = new THREE.Mesh(slabGeometry(room.poly, true), surfaceMaterial('floor', room.floor, { w: room.w, h: room.d }, assets));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.userData = { kind: 'floor', roomId: room.id, keep: true }; roomGroup.add(floor); pick.push(floor);
  // 天井
  const ceil = new THREE.Mesh(slabGeometry(room.poly, false), surfaceMaterial('wall', room.ceiling || { color: '#f7f7f4' }, { w: room.w, h: room.d }, assets));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.receiveShadow = true;
  ceil.userData = { kind: 'ceiling', roomId: room.id, keep: true }; roomGroup.add(ceil); pick.push(ceil);
  if (room.outdoor && room.outdoor.sky) ceil.visible = false;
  buildCeil3D(room, H, roomGroup);
  // 壁(辺ごと)
  const n = room.poly.length;
  for (let e = 0; e < n; e++) {
    const f = edgeFrame(room, e), L = f.L;
    const ops = room.openings.filter(o => o.edge === e);
    const holes = ops.map(o => ({ u: o.u, w: o.w, sill: (o.type === 'window' || o.type === 'niche') ? (o.sill ?? (o.type === 'niche' ? 1.0 : 0.9)) : (o.sill || 0), h: o.h, op: o }));
    // 欄間(戸の上の飾りの窓)。となりの部屋の側(twin)も、持ち主の設定で穴をあける
    const wallHoles = holes.slice(); for (const x of holes) { const rh = ranmaHole(x, H, project); if (rh) wallHoles.push(rh); }
    const rail = room.outdoor && edgeIsOpen(room, e, project) ? (room.outdoor.rail || 'concrete') : null, hp = room.outdoor ? (room.outdoor.h || 1.1) : H, WH = rail ? (rail === 'concrete' ? hp : rail === 'glass' ? .1 : .12) : H;
    const wall = new THREE.Mesh(wallGeometry(L, WH, rail ? [] : wallHoles), surfaceMaterial('wall', wallSpec(room, e), { w: L, h: H }, assets));
    wall.position.copy(f.origin); wall.rotation.y = f.rotY; wall.receiveShadow = true;
    wall.userData = { kind: 'wall', roomId: room.id, edge: e, keep: true }; roomGroup.add(wall); pick.push(wall);
    // 壁の上端(全体を上から見たとき用)
    const cap = box(L + WALL_T * 2, 0.02, WALL_T - 0.006, matCap); cap.castShadow = false;
    cap.position.copy(wallPoint(room, e, L / 2, (rail ? WH : outerH) + 0.01, -WALL_T / 2)); cap.rotation.y = f.rotY; if (!rail && outerH >= FLOOR_H - 0.001) cap.position.y -= 0.022; roomGroup.add(cap); // 上に2階があるときは、ふたを2階の床の下へ(床から飛び出して白い線に見えていた)
    if (rail) { const rg = new THREE.Group(); rg.position.copy(f.origin); rg.rotation.y = f.rotY; roomGroup.add(rg); buildRail(rg, L, hp, rail, room.id); }
    // 外側の面(外から見たときだけ見える)
    const outer = new THREE.Mesh(wallGeometry(L, rail ? WH : outerH, rail ? [] : wallHoles.filter(h => h.op.type !== 'niche')), matOuter);
    outer.position.copy(wallPoint(room, e, 0, 0, -WALL_T)); outer.rotation.y = f.rotY; outer.receiveShadow = true; outer.userData.keep = true; roomGroup.add(outer);
    // 基礎(1階の外まわり:地面から床まで 約450mm)
    if (levelOf(room) === 0) { const fd = new THREE.Mesh(new THREE.PlaneGeometry(L + WALL_T * 2, 0.45), matFound); fd.position.copy(wallPoint(room, e, L / 2, -0.225, -WALL_T)); fd.rotation.y = f.rotY + Math.PI; fd.userData.keep = true; roomGroup.add(fd); }
    // 廻り縁(あり/なし・高さ・仕上げ)
    // バルコニーが家に面している辺は、家の外壁(窓のある壁)がそこにあるので、バルコニー側の壁は出さない(窓をふさがないように)
    if (room.outdoor && !rail) { wall.visible = false; outer.visible = false; cap.visible = false; }
    if (rail || room.outdoor) continue;
    if (trim.crown.on) { const crown = box(L, crownH, Math.min(0.03, crownH * 0.6)); crown.material = matCrown; crown.castShadow = false; crown.userData = { kind: 'trim', part: 'crown', roomId: room.id, mergeKey: 'crown' }; crown.position.copy(wallPoint(room, e, L / 2, H - crownH / 2, Math.min(0.03, crownH * 0.6) / 2)); crown.rotation.y = f.rotY; roomGroup.add(crown); }
    // 巾木(ドアのところは切る)
    if (trim.base.on) { const doors = holes.filter(h => h.op.type !== 'window' && h.sill < 0.1).sort((a, b) => a.u - b.u);
      let u0 = 0; const segs = [];
      for (const d of doors) { if (d.u > u0) segs.push([u0, d.u]); u0 = d.u + d.w; } if (u0 < L) segs.push([u0, L]);
      // 和室の畳の部屋は、立った巾木ではなく「畳寄せ」:壁ぎわの床に細い木(見える幅35mm・畳と同じ高さ)
      const yose = /tatami/.test((room.floor || {}).lib || ''), yoseMat = room.wa ? matBase : trimMaterial(room.yose || 'wood_natural');
      if (yose) { for (const [a, b] of segs) { const bb = box(b - a, 0.006, 0.035); bb.material = yoseMat; bb.userData = { kind: 'trim', part: 'base', roomId: room.id, mergeKey: 'base' }; bb.position.copy(wallPoint(room, e, (a + b) / 2, 0.0025, 0.0175)); bb.rotation.y = f.rotY; roomGroup.add(bb); } }
      else for (const [a, b] of segs) { const bb = box(b - a, baseH, 0.012); bb.material = matBase; bb.userData = { kind: 'trim', part: 'base', roomId: room.id, mergeKey: 'base' }; bb.position.copy(wallPoint(room, e, (a + b) / 2, baseH / 2, 0.006)); bb.rotation.y = f.rotY; roomGroup.add(bb); } }
    // 開口の枠・窓・ドア
    for (const h of holes) {
      const o = h.op, cu = h.u + h.w / 2, isWin = o.type === 'window';
      const og = new THREE.Group(); og.position.copy(wallPoint(room, e, cu, 0, 0)); og.rotation.y = f.rotY; roomGroup.add(og); const tagTrim = m => { m.userData = { kind: 'trim', part: isWin ? 'casing' : 'door', roomId: room.id, openingId: o.id, mergeKey: isWin ? 'casing' : 'door' }; return m; };
      if (o.type === 'niche') { buildNiche(og, o, h, wall.material, trimMaterial(o.finish || trim.casing.finish || 'white'), room.id, pick); continue; }
      if (!isWin) {
        // 上がり框(玄関の土間から上がる段):開口の下が床から少し上(150mmなど)のとき、木の框を付ける
        if (h.sill > 0.02 && h.sill < 0.45) { const km = trimMaterial(o.kamachi || 'wood_medium'); const fr = box(h.w, h.sill, 0.03, km); fr.position.set(0, h.sill / 2, 0.015); og.add(fr); const tp = box(h.w, 0.03, WALL_T + 0.05, km); tp.position.set(0, h.sill - 0.015, -WALL_T / 2 + 0.025); og.add(tp); }
        // 段差なし:壁の厚みの所も床でつなぐ。となりと床が違うときは、フローリングに合わせた見切りを入れる
        else if (h.sill <= 0.02 && !o.twin) { const nb = neighborAcross(room, e, o.u, o.w, project.rooms || [], { y: baseOf(room) }); const myF = room.floor || {}, nbF = nb ? (nb.room.floor || {}) : myF;
          if (nb && myF.lib === nbF.lib && myF.color === nbF.color) { const st = new THREE.Mesh(new THREE.PlaneGeometry(h.w, WALL_T), floor.material); st.rotation.x = -Math.PI / 2; st.position.set(0, 0.001, -WALL_T / 2); og.add(st); }
          else { // 段差は作らない(いつもフラット)。片方がフローリングでもう片方がクッションフロアなどのときだけ、フローリング色の見切り(床と同じ高さ)
            const isWood = f => /oak|walnut|ash|herring|grayoak/.test(f.lib || ''); const wood = isWood(myF) ? myF : isWood(nbF) ? nbF : null; const mm = wood ? surfaceMaterial('floor', wood, { w: 1, h: 1 }, assets) : floor.material;
            const st = new THREE.Mesh(new THREE.PlaneGeometry(h.w, WALL_T), mm); st.rotation.x = -Math.PI / 2; st.receiveShadow = true; st.position.set(0, 0.001, -WALL_T / 2); og.add(st); } }
      }
      // 箱型の出窓は、枠なし(三方クロス巻き込み)
      if (!o.twin) buildRanma(og, o, h, H, waWood || trimMaterial('wood_medium'));
      if (o.toko && !o.twin) buildToko(og, o, h, H);
      const casingOn = o.toko ? false : isWin ? (trim.casing.on && o.bay !== 'box') : true; const mFrame = isWin ? matCase : matDoorFrame; const wallMat = wall.material;
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
        if (!o.fix) { const s1 = box(fw, h.h, 0.05, matSash); s1.position.set(0, h.sill + h.h / 2, -WALL_T / 2); og.add(s1); }
        if (o.grille) { for (let x = -h.w / 2 + .06; x < h.w / 2 - .03; x += .1) { const gb = box(.02, h.h + .04, .02, matRail); gb.position.set(x, h.sill + h.h / 2, -WALL_T - .05); og.add(gb); } for (const yy of [h.sill - .01, h.sill + h.h + .01]) { const gb = box(h.w + .06, .03, .03, matRail); gb.position.set(0, yy, -WALL_T - .05); og.add(gb); } } // 面格子(共用廊下側の窓)
        const s2 = box(h.w, fw, 0.05, matSash); s2.position.set(0, h.sill + fw / 2, -WALL_T / 2); og.add(s2);
        const s3 = s2.clone(); s3.position.y = h.sill + h.h - fw / 2; og.add(s3);
        const s4 = box(fw, h.h, 0.05, matSash); s4.position.set(-h.w / 2 + fw / 2, h.sill + h.h / 2, -WALL_T / 2); og.add(s4);
        const s5 = s4.clone(); s5.position.x = h.w / 2 - fw / 2; og.add(s5);
      } else if (bay) {
        buildBay(og, o, h, { mFrame, matGlass, matSash, matOuter, wallMat, roomId: room.id, edge: e, pick, tagTrim, ear: (casingOn ? caseW : 0) + 0.02 });
      } else if ((o.type === 'closet' || (o.type === 'door' && isSlideStyle(o.style))) && !o.twin) {
        buildClosetDoor(og, o, h, { roomId: room.id, edge: e, pick, frame: matDoorFrame });
      } else if (o.type === 'door' && !o.twin) {
        // 丁番:部屋の内側から見て左(left)/右(right)。開く向き:内開き(in=この部屋側)/外開き(out)
        const sx = o.hinge === 'right' ? -1 : 1, sz = o.swing === 'out' ? -1 : 1;
        const leaf = new THREE.Group(); leaf.position.set(-sx * h.w / 2, 0, sz > 0 ? -0.022 : -WALL_T + 0.022); og.add(leaf);
        const door = box(h.w - 0.01, h.h - 0.01, o.style === 'steel' ? 0.05 : 0.04, o.style === 'bath' ? matBathDoor : o.style === 'steel' ? matSteelDoor : matDoor); door.position.set(sx * (h.w - 0.01) / 2, (h.h - 0.01) / 2, 0); leaf.add(door);
        // 浴室のドア:白い枠に、くもりガラスの面
        if (o.style === 'bath') { for (const zz of [0.021, -0.021]) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(h.w - 0.16, h.h * 0.62), matFrost); gl.position.set(sx * (h.w - 0.01) / 2, h.h * 0.55, zz); if (zz < 0) gl.rotation.y = Math.PI; leaf.add(gl); } }
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), matKnob); knob.position.set(sx * (h.w - 0.08), 1.0, 0.04); leaf.add(knob);
        const knob2 = knob.clone(); knob2.position.z = -0.04; leaf.add(knob2);
        for (let k = 0; k < 2; k++) { const hg = box(0.012, 0.1, 0.03, matKnob); hg.castShadow = false; hg.position.set(0, k ? h.h - 0.25 : 0.25, 0); leaf.add(hg); }
        leaf.rotation.y = -sx * sz * (o.open ?? 0.9) * Math.PI / 2;
        door.userData = { kind: 'door', roomId: room.id, edge: e, openingId: o.id }; pick.push(door);
      }
    }
    if (room.wa) buildWaWall(room, e, f, L, H, holes, waWood, roomGroup);
  }
  // クローゼット・押入れの中(枕棚・ハンガーパイプ・中段・棚)
  if (room.closet) buildClosetInside(room, roomGroup);
  // 階段
  if (room.stair) { const sg = new THREE.Group(); buildStair(room, FLOOR_H, sg, { tread: trimMaterial(room.stair.finish || 'wood_natural'), riser: trimMaterial(room.stair.riser || 'white'), rail: trimMaterial(room.stair.railFinish || 'wood_walnut'), metal: matSash, wall: surfaceMaterial('wall', wallSpec(room, 0), { w: 2, h: 2 }, assets) }); sg.traverse(o => { if (o.isMesh) { o.userData.roomId = room.id; o.userData.kind = 'stair'; pick.push(o); } }); roomGroup.add(sg); }
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
      // 梁:クロス巻き込み(既定は天井と同じ。梁だけ別の壁紙も選べる)/ 木をそのまま見せる化粧梁(木の色を選べる)
      const drop = part.drop || 0.1; const bmat = part.finish === 'wood' ? trimMaterial(part.wood || 'wood_medium') : surfaceMaterial('wall', part.cross || room.ceiling || { color: '#f7f7f4' }, { w: Math.max(part.w, part.d), h: drop }, assets); const m = new THREE.Mesh(new THREE.BoxGeometry(part.w, drop, part.d), bmat); m.position.set(b.cx, H - drop / 2, b.cz); m.castShadow = true; m.receiveShadow = true;
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
// opts.y:開口の下端の高さ(家全体の高さ)。階段の2階の出口などで、相手の階を決める
export function neighborAcross(room, e, u, w, rooms, opts) {
  const f = edgeFrame(room, e); const P1 = f.origin.clone().addScaledVector(f.along, u), P2 = f.origin.clone().addScaledVector(f.along, u + w);
  for (const o of rooms) {
    if (o.id === room.id) continue; normalizeRoom(o);
    if (opts && opts.y !== undefined) { const b = baseOf(o); if (opts.y < b - 0.3 || opts.y > b + o.h - 0.3) continue; } else if (!room.stair && !o.stair && levelOf(o) !== levelOf(room)) continue;
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
// 足もとの高さ(家全体の高さ)。歩けない所は null。gy は今立っている高さ
// 部屋の中(壁から margin 以上)・ドアの通り道・階段の段。1歩で STEP_MAX までしか上り下りしない。柱型・袖壁の中はだめ
export function groundAt(p, rooms, gy = 0, margin = 0.25) {
  // 足が届く高さ(今の高さ±1段)の中で、いちばん高い面に立つ(段の上・らせんの2階の出口など)
  let best = null; const take = y => { if (Math.abs(y - gy) <= STEP_MAX && (best === null || y > best)) best = y; };
  for (const r of rooms) {
    if (!r.poly) normalizeRoom(r); const b = baseOf(r);
    if (!r.stair && Math.abs(b - gy) > STEP_MAX) continue; if (r.closet === 'cl' || r.closet === 'oshiire') continue;
    if (!pointInPoly(p.x, p.z, r.poly) || distToPolyEdges(p.x, p.z, r.poly) < (r.stair ? Math.min(margin, 0.17) : margin)) continue;
    if (r.stair) { for (const y of stairHeights(r, p.x, p.z, FLOOR_H)) take(b + y); } else take(b);
  }
  if (best === null) for (const r of rooms) for (const o of r.openings || []) {
    if (o.type === 'window') continue; const sy = baseOf(r) + (o.sill || 0); if (Math.abs(sy - gy) > STEP_MAX) continue;
    const f = edgeFrame(r, o.edge); const d = new THREE.Vector3(p.x, 0, p.z).sub(f.origin); const t = d.dot(f.along), s = d.dot(f.normal); const reach = WALL_T + margin + 0.1, m = 0.12;
    if (t > o.u + m && t < o.u + o.w - m && s > -reach && s < reach) take(sy);
  }
  if (best === null) return null;
  for (const r of rooms) { if (Math.abs(baseOf(r) - best) > STEP_MAX && !r.stair) continue; for (const part of r.parts || []) { if (part.type === 'beam') continue; if (pointInPart(p.x, p.z, part, margin * 0.8)) return null; } }
  return best;
}
export function walkable(p, rooms, margin = 0.25, gy = 0) { return groundAt(p, rooms, gy, margin) !== null; }
// その場所の部屋。opt.level(その階で探す) / opt.gy(立っている高さに近い部屋)
export function roomAt(p, rooms, opt) {
  let list = rooms;
  if (opt && opt.level !== undefined) list = rooms.filter(r => levelOf(r) === opt.level || (r.stair && opt.level === levelOf(r) + 1));
  const inside = list.filter(r => (r.poly || normalizeRoom(r).poly) && pointInPoly(p.x, p.z, r.poly));
  if (inside.length > 1 && opt && opt.gy !== undefined) inside.sort((a, b) => (a.stair ? 0 : Math.abs(baseOf(a) - opt.gy)) - (b.stair ? 0 : Math.abs(baseOf(b) - opt.gy)));
  else if (inside.length > 1) inside.sort((a, b) => levelOf(a) - levelOf(b));
  return inside[0] || list.find(r => p.x >= r.x - 0.01 && p.x <= r.x + r.w + 0.01 && p.z >= r.z - 0.01 && p.z <= r.z + r.d + 0.01) || null;
}
export function houseBounds(rooms) {
  const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity, maxH: 0 };
  for (const r of rooms) { b.minX = Math.min(b.minX, r.x); b.minZ = Math.min(b.minZ, r.z); b.maxX = Math.max(b.maxX, r.x + r.w); b.maxZ = Math.max(b.maxZ, r.z + r.d); b.maxH = Math.max(b.maxH, baseOf(r) + r.h); }
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
