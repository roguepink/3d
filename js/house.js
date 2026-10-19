// 部屋のデータ → 壁・床・天井・窓・ドアの3D
import * as THREE from 'three';
import { surfaceMaterial } from './textures.js';
import { mergeGroup } from './merge.js';

export const WALL_T = 0.12;      // 壁の厚み
export const SIDES = ['N', 'E', 'S', 'W'];
export const SIDE_NAME = { N: '奥の壁', E: '右の壁', S: '手前の壁', W: '左の壁' };

export function wallLength(room, side) { return (side === 'N' || side === 'S') ? room.w : room.d; }

// 壁の向き(部屋の内側へ向く法線)と、壁に沿う「横向き」ベクトル
export function wallFrame(room, side) {
  switch (side) {
    case 'N': return { origin: new THREE.Vector3(room.x, 0, room.z), along: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(0, 0, 1), rotY: 0 };
    case 'S': return { origin: new THREE.Vector3(room.x + room.w, 0, room.z + room.d), along: new THREE.Vector3(-1, 0, 0), normal: new THREE.Vector3(0, 0, -1), rotY: Math.PI };
    case 'E': return { origin: new THREE.Vector3(room.x + room.w, 0, room.z), along: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(-1, 0, 0), rotY: -Math.PI / 2 };
    case 'W': return { origin: new THREE.Vector3(room.x, 0, room.z + room.d), along: new THREE.Vector3(0, 0, -1), normal: new THREE.Vector3(1, 0, 0), rotY: Math.PI / 2 };
  }
}
// 開口の pos(壁の最小座標側からの距離) → 内側から見た「左からの距離」
export function posToLocal(room, side, pos, w) { const L = wallLength(room, side); return (side === 'N' || side === 'E') ? pos : L - pos - w; }
export function localToPos(room, side, local, w) { return posToLocal(room, side, local, w); }
// 壁の上の位置(内側から見て左から u メートル、床から v メートル) → ワールド座標
export function wallPoint(room, side, u, v, out = 0) {
  const f = wallFrame(room, side);
  return f.origin.clone().addScaledVector(f.along, u).add(new THREE.Vector3(0, v, 0)).addScaledVector(f.normal, out);
}
// ワールド座標 → その壁の(u, v)
export function wallUV(room, side, p) {
  const f = wallFrame(room, side); const d = p.clone().sub(f.origin);
  return { u: d.dot(f.along), v: d.y };
}

const matWood = new THREE.MeshStandardMaterial({ color: '#efece6', roughness: .6 });
const matFrame = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: .5 });
const matDoor = new THREE.MeshStandardMaterial({ color: '#b78b5e', roughness: .55 });
const matKnob = new THREE.MeshStandardMaterial({ color: '#c9b37a', roughness: .3, metalness: .8 });
const matGlass = new THREE.MeshStandardMaterial({ color: '#dbe9f6', roughness: .04, metalness: .15, transparent: true, opacity: .16, side: THREE.DoubleSide, envMapIntensity: .6, depthWrite: false });
const matCap = new THREE.MeshStandardMaterial({ color: '#d9d9d9', roughness: .9 });
const matSash = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: .4, metalness: .6 });

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

export function buildRoom(room, project, group) {
  const assets = project.assets || {};
  const H = room.h, pick = [];
  const roomGroup = new THREE.Group(); roomGroup.name = 'room:' + room.id; roomGroup.userData.roomId = room.id;
  // 床
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), surfaceMaterial('floor', room.floor, { w: room.w, h: room.d }, assets));
  floor.rotation.x = -Math.PI / 2; floor.position.set(room.x + room.w / 2, 0, room.z + room.d / 2); floor.receiveShadow = true;
  floor.userData = { kind: 'floor', roomId: room.id, keep: true }; roomGroup.add(floor); pick.push(floor);
  // 天井
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), surfaceMaterial('wall', room.ceiling || { color: '#f7f7f4' }, { w: room.w, h: room.d }, assets));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(room.x + room.w / 2, H, room.z + room.d / 2); ceil.receiveShadow = true;
  ceil.userData = { kind: 'ceiling', roomId: room.id, keep: true }; roomGroup.add(ceil); pick.push(ceil);
  // 壁
  for (const side of SIDES) {
    const L = wallLength(room, side), f = wallFrame(room, side);
    const ops = (room.openings || []).filter(o => o.side === side);
    const holes = ops.map(o => ({ u: posToLocal(room, side, o.pos, o.w), w: o.w, sill: o.type === 'window' ? (o.sill ?? 0.9) : 0, h: o.h, op: o }));
    const spec = (room.walls && room.walls[side]) || { lib: 'wp_white' };
    const wall = new THREE.Mesh(wallGeometry(L, H, holes), surfaceMaterial('wall', spec, { w: L, h: H }, assets));
    wall.position.copy(f.origin); wall.rotation.y = f.rotY; wall.receiveShadow = true; wall.castShadow = false;
    wall.userData = { kind: 'wall', roomId: room.id, side, keep: true }; roomGroup.add(wall); pick.push(wall);
    // 壁の上端(全体を上から見たとき用)
    const cap = box(L + WALL_T * 2, 0.02, WALL_T, matCap); cap.castShadow = false;
    cap.position.copy(wallPoint(room, side, L / 2, H + 0.01, -WALL_T / 2)); cap.rotation.y = f.rotY; roomGroup.add(cap);
    // 外側の壁(厚みの外の面。外から見たときだけ見える)
    const outer = new THREE.Mesh(wallGeometry(L, H, holes), new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .9, side: THREE.BackSide }));
    outer.position.copy(wallPoint(room, side, 0, 0, -WALL_T)); outer.rotation.y = f.rotY; outer.receiveShadow = true; outer.userData.keep = true; roomGroup.add(outer);
    // 廻り縁(天井との境の細い縁)
    const crown = box(L, 0.035, 0.02, matWood); crown.castShadow = false; crown.position.copy(wallPoint(room, side, L / 2, H - 0.0175, 0.01)); crown.rotation.y = f.rotY; roomGroup.add(crown);
    // 巾木(ドアのところは切る)
    const doors = holes.filter(h => h.op.type !== 'window').sort((a, b) => a.u - b.u);
    let u0 = 0; const segs = [];
    for (const d of doors) { if (d.u > u0) segs.push([u0, d.u]); u0 = d.u + d.w; } if (u0 < L) segs.push([u0, L]);
    for (const [a, b] of segs) { const bb = box(b - a, 0.06, 0.012, matWood); bb.position.copy(wallPoint(room, side, (a + b) / 2, 0.03, 0.006)); bb.rotation.y = f.rotY; roomGroup.add(bb); }
    // 開口の枠・窓・ドア
    for (const h of holes) {
      const o = h.op, cu = h.u + h.w / 2, isWin = o.type === 'window';
      const og = new THREE.Group(); og.position.copy(wallPoint(room, side, cu, 0, 0)); og.rotation.y = f.rotY; roomGroup.add(og);
      // 壁の厚み分の側面(ジャンブ)。相手の部屋と共有のドアは片方だけ
      if (!o.twin) {
        const jd = WALL_T + 0.02;
        const jl = box(0.03, h.h, jd, matFrame); jl.position.set(-h.w / 2 - 0.015, h.sill + h.h / 2, -WALL_T / 2 + 0.01); og.add(jl);
        const jr = jl.clone(); jr.position.x = h.w / 2 + 0.015; og.add(jr);
        const jt = box(h.w + 0.06, 0.03, jd, matFrame); jt.position.set(0, h.sill + h.h + 0.015, -WALL_T / 2 + 0.01); og.add(jt);
        if (isWin) { const js = box(h.w + 0.06, 0.03, jd + 0.03, matFrame); js.position.set(0, h.sill - 0.015, -WALL_T / 2 + 0.02); og.add(js); }
      }
      // 部屋側の枠(ケーシング)
      { const cw = 0.055, cd = 0.014; const cl = box(cw, h.h + (isWin ? cw * 2 : cw), cd, matFrame); cl.position.set(-h.w / 2 - cw / 2, h.sill + h.h / 2 + (isWin ? 0 : cw / 2), cd / 2); og.add(cl); const cr = cl.clone(); cr.position.x = h.w / 2 + cw / 2; og.add(cr);
        const ct = box(h.w + cw * 2, cw, cd, matFrame); ct.position.set(0, h.sill + h.h + cw / 2, cd / 2); og.add(ct); if (isWin) { const cb = box(h.w + cw * 2, cw, cd * 2.2, matFrame); cb.position.set(0, h.sill - cw / 2, cd); og.add(cb); } }
      if (isWin) {
        const sillBoard = box(h.w + 0.16, 0.025, 0.09, matFrame); sillBoard.position.set(0, h.sill - 0.0125, 0.045); og.add(sillBoard);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(h.w, h.h), matGlass); glass.position.set(0, h.sill + h.h / 2, -WALL_T / 2); og.add(glass);
        glass.userData = { kind: 'window', roomId: room.id, side, openingId: o.id, keep: true }; pick.push(glass);
        // サッシ(縦の中桟 + 枠)
        const fw = 0.04;
        const s1 = box(fw, h.h, 0.05, matSash); s1.position.set(0, h.sill + h.h / 2, -WALL_T / 2); og.add(s1);
        const s2 = box(h.w, fw, 0.05, matSash); s2.position.set(0, h.sill + fw / 2, -WALL_T / 2); og.add(s2);
        const s3 = s2.clone(); s3.position.y = h.sill + h.h - fw / 2; og.add(s3);
        const s4 = box(fw, h.h, 0.05, matSash); s4.position.set(-h.w / 2 + fw / 2, h.sill + h.h / 2, -WALL_T / 2); og.add(s4);
        const s5 = s4.clone(); s5.position.x = h.w / 2 - fw / 2; og.add(s5);
      } else if (o.type === 'door' && !o.twin) {
        // ドア本体(開き具合 open 0..1)
        const leaf = new THREE.Group(); leaf.position.set(-h.w / 2, 0, -WALL_T / 2); og.add(leaf);
        const door = box(h.w - 0.01, h.h - 0.01, 0.04, matDoor); door.position.set((h.w - 0.01) / 2, (h.h - 0.01) / 2, 0); leaf.add(door);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), matKnob); knob.position.set(h.w - 0.08, 1.0, 0.04); leaf.add(knob);
        const knob2 = knob.clone(); knob2.position.z = -0.04; leaf.add(knob2);
        leaf.rotation.y = -(o.open ?? 0.9) * Math.PI / 2; // 部屋の内側へ開く
        door.userData = { kind: 'door', roomId: room.id, side, openingId: o.id }; pick.push(door);
      }
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

// 2つの部屋が壁を共有しているか(ドアでつなぐときに使う)。戻り: 相手の部屋と側
export function neighborAcross(room, side, pos, w, rooms) {
  const eps = WALL_T + 0.05;
  for (const o of rooms) {
    if (o.id === room.id) continue;
    if (side === 'E' && Math.abs(o.x - (room.x + room.w)) < eps && pos + w > o.z && pos < o.z + o.d) return { room: o, side: 'W' };
    if (side === 'W' && Math.abs((o.x + o.w) - room.x) < eps && pos + w > o.z && pos < o.z + o.d) return { room: o, side: 'E' };
    if (side === 'S' && Math.abs(o.z - (room.z + room.d)) < eps && pos + w > o.x && pos < o.x + o.w) return { room: o, side: 'N' };
    if (side === 'N' && Math.abs((o.z + o.d) - room.z) < eps && pos + w > o.x && pos < o.x + o.w) return { room: o, side: 'S' };
  }
  return null;
}
// 歩ける範囲か(部屋の中 または ドアの通り道)
export function walkable(p, rooms, margin = 0.25) {
  for (const r of rooms) {
    if (p.x > r.x + margin && p.x < r.x + r.w - margin && p.z > r.z + margin && p.z < r.z + r.d - margin) return true;
  }
  for (const r of rooms) for (const o of (r.openings || [])) {
    if (o.type === 'window') continue;
    const reach = WALL_T + margin + 0.1, m = 0.12;
    if (o.side === 'N' && p.x > r.x + o.pos + m && p.x < r.x + o.pos + o.w - m && p.z > r.z - reach && p.z < r.z + reach) return true;
    if (o.side === 'S' && p.x > r.x + o.pos + m && p.x < r.x + o.pos + o.w - m && p.z > r.z + r.d - reach && p.z < r.z + r.d + reach) return true;
    if (o.side === 'W' && p.z > r.z + o.pos + m && p.z < r.z + o.pos + o.w - m && p.x > r.x - reach && p.x < r.x + reach) return true;
    if (o.side === 'E' && p.z > r.z + o.pos + m && p.z < r.z + o.pos + o.w - m && p.x > r.x + r.w - reach && p.x < r.x + r.w + reach) return true;
  }
  return false;
}
export function roomAt(p, rooms) { return rooms.find(r => p.x >= r.x - 0.01 && p.x <= r.x + r.w + 0.01 && p.z >= r.z - 0.01 && p.z <= r.z + r.d + 0.01) || null; }
export function houseBounds(rooms) {
  const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity, maxH: 0 };
  for (const r of rooms) { b.minX = Math.min(b.minX, r.x); b.minZ = Math.min(b.minZ, r.z); b.maxX = Math.max(b.maxX, r.x + r.w); b.maxZ = Math.max(b.maxZ, r.z + r.d); b.maxH = Math.max(b.maxH, r.h); }
  if (!rooms.length) Object.assign(b, { minX: 0, minZ: 0, maxX: 4, maxZ: 4, maxH: 2.4 });
  return b;
}
