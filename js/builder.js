// 家を「言葉・図面・写真」から作るための道具(Claude Code の oheya-house スキルが使う)
// 間取りは 910mm のマス(尺モジュール)で書く。壁の中心線の位置をマスの数で書くと、内側の寸法の部屋になる。
// 使い方(ブラウザの中で):
//   const B = await import('./js/builder.js'); const p = await B.buildFromSource(`...家の書き方...`); const r = B.audit(p);
// 家の書き方(source)で使えるもの:G, T, H, P, FH, W0, room, link, opening, win, niche, add, beam
//   最後に return { name, floorH, camera } を返す(rooms は room() で作った順に自動で入る)
import { newItem, catalogEntry } from './items.js';
import { fitWindowItem, normalizeRoom, edgeFrame, groundAt, baseOf, setFloorH, pointInPoly } from './house.js';

const SIDE = { N: 0, E: 1, S: 2, W: 3 }, OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function makeHelpers(FH = 2.9) {
  const G = 0.91, T = 0.06, W0 = { lib: 'wp_white' }, H = Math.PI / 2, P = Math.PI; let seq = 0; const rooms = [], items = [];
  // 壁の中心線の位置(マス)から、内側の寸法の部屋を作る。opts.poly で L字なども書ける
  function room(id, name, level, x0, z0, x1, z1, o = {}) {
    const x = x0 * G + T, z = z0 * G + T, w = (x1 - x0) * G - T * 2, d = (z1 - z0) * G - T * 2;
    const poly = o.poly || [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]; const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]); const { poly: _p, ...rest } = o;
    const r = { id, name, level, x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), h: 2.4, poly, floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: { 0: W0, 1: W0, 2: W0, 3: W0 }, openings: [], parts: [], ...rest };
    rooms.push(r); return r;
  }
  // 辺を探す(同じ向きの辺が2本あるときは、near に近い辺)
  function edgeOf(r, side, s, w, near) {
    const Pl = r.poly, n = Pl.length; let best = null;
    for (let i = 0; i < n; i++) { const [ax, az] = Pl[i], [bx, bz] = Pl[(i + 1) % n], dx = bx - ax, dz = bz - az; const ns = side === 'N' || side === 'S';
      const ok = side === 'N' ? dx > 0 && Math.abs(dz) < 1e-6 : side === 'E' ? dz > 0 && Math.abs(dx) < 1e-6 : side === 'S' ? dx < 0 && Math.abs(dz) < 1e-6 : dz < 0 && Math.abs(dx) < 1e-6; if (!ok) continue;
      const lo = ns ? Math.min(ax, bx) : Math.min(az, bz), hi = ns ? Math.max(ax, bx) : Math.max(az, bz); if (s < lo - 1e-6 || s + w > hi + 1e-6) continue;
      const line = ns ? az : ax; const score = near === undefined ? ({ N: line, S: -line, W: line, E: -line })[side] : Math.abs(line - near);
      if (!best || score < best.score) best = { e: i, score, u: side === 'N' ? s - ax : side === 'E' ? s - az : side === 'S' ? ax - (s + w) : az - (s + w) }; }
    if (!best) throw new Error(`${r.name} の ${side} の壁に、位置 ${s.toFixed(2)} 幅 ${w} の開口が入りません`); return best;
  }
  const nearOf = (b, side) => ({ N: b.z + b.d + 0.12, S: b.z - 0.12, E: b.x - 0.12, W: b.x + b.w + 0.12 })[side];
  function opening(r, side, s, w, props = {}, near) { const f = edgeOf(r, side, s, w, near); const o = { id: 'd' + (++seq), edge: f.e, u: f.u, w, h: 2.0, type: 'door', ...props }; r.openings.push(o); return o; }
  // 2つの部屋をつなぐ開口(a が持ち主)。props: swing/hinge/open、type:'open'(戸なし)/'closet'(収納の戸 style fold|slide|fusuma)、style:'slide'(引き戸)、sill/twinSill(階段の2階の出口・玄関の框)
  function link(a, side, b, s, w, props = {}) { const o = opening(a, side, s, w, props, nearOf(b, side)); const fb = edgeOf(b, OPP[side], s, w, nearOf(a, OPP[side])); const t = { id: 'd' + (++seq), edge: fb.e, u: fb.u, w, h: o.h, type: o.type, twin: o.id }; if (props.twinSill !== undefined) t.sill = props.twinSill; delete o.twinSill; b.openings.push(t); return o; }
  const win = (r, side, s, w, h, sill, props = {}) => opening(r, side, s, w, { type: 'window', h, sill, ...props });
  const niche = (r, side, s, w, h, sill) => opening(r, side, s, w, { type: 'niche', h, sill, depth: 0.1 });
  const add = (type, roomId, x, y, z, rot = 0, over = {}) => { const it = newItem(type, { roomId, x, y, z, rot, ...over }); if (it) items.push(it); return it; };
  // 梁(部屋の中を通す)。core=木の幅、クロス巻き込みは見付 core+0.05
  const beam = (r, x, z, w, d, o = {}) => { r.parts.push({ id: 'b' + (++seq), type: 'beam', x, z, w, d, core: 0.15, drop: 0.1, finish: 'cross', ...o }); };
  // マンションの柱型(壁から出っぱる柱。x,z は左上の角)と、下がり天井(部屋の一部の天井を下げる。drop は下がる高さ)
  const col = (r, x, z, w, d) => { r.parts.push({ id: 'c' + (++seq), type: 'column', x, z, w, d }); };
  const soffit = (r, x, z, w, d, drop = .2) => { r.parts.push({ id: 'b' + (++seq), type: 'beam', x, z, w, d, core: Math.min(w, d), drop, finish: 'cross' }); };
  return { G, T, H, P, FH, W0, room, link, opening, win, niche, add, beam, col, soffit, rooms, items };
}

// 家の書き方(文字)から、アプリの家のデータを作る
export async function buildFromSource(src, FH = 2.9) {
  const h = makeHelpers(FH); const names = ['G', 'T', 'H', 'P', 'FH', 'W0', 'room', 'link', 'opening', 'win', 'niche', 'add', 'beam', 'col', 'soffit'];
  const fn = new Function(...names, '"use strict";\n' + src); const out = (await fn(...names.map(n => h[n]))) || {};
  const floorH = out.floorH || FH; setFloorH(floorH);
  const p = { v: 1, name: out.name || '家', rooms: h.rooms, items: h.items, assets: {}, settings: { night: false, module: 'shaku', floorH, ...(out.storey ? { storey: out.storey } : {}), ...(out.wayo ? { wayo: out.wayo } : {}) }, camera: out.camera || null };
  for (const r of p.rooms) normalizeRoom(r);
  // fit:true の窓まわりの物は、窓と付け方(opts.mount)に合わせて幅・高さを自動で決める
  for (const it of p.items) if (it.fit) { delete it.fit; fitWindowItem(it, p.rooms.find(r => r.id === it.roomId)); }
  return p;
}

// 自動チェック:カーテンと窓、出入り口を通れるか、家具のはみ出し、部屋の重なりとすき間
export function audit(p) {
  setFloorH((p.settings && p.settings.floorH) || 2.9); const rooms = p.rooms, out = { curtains: [], doors: [], items: [], overlaps: [], gaps: [] };
  for (const r of rooms) normalizeRoom(r);
  const room = id => rooms.find(r => r.id === id);
  for (const it of p.items.filter(i => ['curtain', 'lace', 'shoji', 'roller', 'blind', 'vblind', 'shade', 'pleats'].includes(i.type))) { const r = room(it.roomId); if (!r) continue; let best = null; for (let e = 0; e < r.poly.length; e++) { const f = edgeFrame(r, e); const d = Math.abs((it.x - f.A[0]) * f.normal.x + (it.z - f.A[1]) * f.normal.z); if (!best || d < best.d) best = { e, d, f }; } const u = (it.x - best.f.A[0]) * best.f.along.x + (it.z - best.f.A[1]) * best.f.along.z; if (!r.openings.some(o => (o.type === 'window' || ['sash', 'glassdoor', 'shoji'].includes(o.style) || (o.twin && rooms.some(x => (x.openings || []).some(t => t.id === o.twin && ['sash', 'glassdoor', 'shoji'].includes(t.style))))) && o.edge === best.e && Math.abs(o.u + o.w / 2 - u) < 0.08)) out.curtains.push(`${r.name} の${it.type} に窓がない`); }
  for (const r of rooms) for (const o of r.openings) { if (o.type === 'window' || o.type === 'niche' || o.twin || o.type === 'closet') continue; const f = edgeFrame(r, o.edge); const c = f.origin.clone().addScaledVector(f.along, o.u + o.w / 2); const gy0 = baseOf(r) + (o.sill || 0);
    const A = c.clone().addScaledVector(f.normal, 0.32), B = c.clone().addScaledVector(f.normal, -0.44); let gy = groundAt(A, rooms, gy0) ?? groundAt(A, rooms, gy0 - 0.15) ?? groundAt(A, rooms, gy0 + 0.2); if (gy === null) { out.doors.push(`${r.name} の出入り口の手前に立てない`); continue; }
    const outside = !rooms.some(x => x !== r && pointInPoly(B.x, B.z, x.poly)); if (outside) continue;
    for (let t = 0; t <= 1.0001; t += 0.02) { const q = A.clone().lerp(B, t); const g = groundAt(q, rooms, gy); if (g === null) { out.doors.push(`${r.name} の出入り口を通れない`); break; } gy = g; } }
  for (const it of p.items) { const c = catalogEntry(it.type); if (!c || c.kind !== 'floor') continue; const r = room(it.roomId); if (!r) { out.items.push(`${it.type} の部屋がない`); continue; } const cs = Math.cos(it.rot || 0), sn = Math.sin(it.rot || 0), hw = it.w / 2, hd = it.d / 2;
    for (const [lx, lz] of [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) { const x = it.x + lx * cs + lz * sn, z = it.z - lx * sn + lz * cs; if (!pointInPoly(x, z, r.poly) && !(x >= r.x - 0.03 && x <= r.x + r.w + 0.03 && z >= r.z - 0.03 && z <= r.z + r.d + 0.03)) { out.items.push(`${r.name} の ${c.name} が壁からはみ出している`); break; } } }
  // 部屋の重なり・すき間(5cm ごとに調べる。壁の厚みの所は数えない)
  for (const lv of [...new Set(rooms.map(r => r.level || 0))]) {
    const rs = rooms.filter(r => (r.level || 0) === lv || (r.stair && lv === (r.level || 0) + 1)); if (!rs.length) continue;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const r of rs) { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); }
    let over = 0, gap = 0; const st = 0.05; for (let x = x0 + st / 2; x < x1; x += st) for (let z = z0 + st / 2; z < z1; z += st) { let n = 0; for (const r of rs) if (pointInPoly(x, z, r.poly)) n++; if (n > 1) over++; else if (n === 0) { let nearWall = false; for (const r of rs) { if (x > r.x - 0.14 && x < r.x + r.w + 0.14 && z > r.z - 0.14 && z < r.z + r.d + 0.14) { for (let i = 0; i < r.poly.length && !nearWall; i++) { const [ax, az] = r.poly[i], [bx, bz] = r.poly[(i + 1) % r.poly.length]; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((x - ax) * dx + (z - az) * dz) / l2; t = Math.max(0, Math.min(1, t)); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < 0.14) nearWall = true; } } if (nearWall) break; } if (!nearWall) gap++; } }
    if (over) out.overlaps.push(`${lv + 1}階で部屋が重なっている(約${(over * st * st).toFixed(2)}㎡)`); if (gap * st * st > 0.3) out.gaps.push(`${lv + 1}階に部屋のないすき間がある(約${(gap * st * st).toFixed(2)}㎡)`);
  }
  out.ok = !out.curtains.length && !out.doors.length && !out.items.length && !out.overlaps.length; return out;
}
