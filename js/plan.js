// 間取り(上から見た図)の編集:部屋を動かす・形を変える(角を動かす/足す/斜めに)・柱型/袖壁/梁・ドアや窓
import { WALL_T, wallLength, houseBounds, neighborAcross, edgeFrame, edgeName, normalizeRoom, isRect, resizeRect, translateRoom, insertVertex, removeVertex, chamferVertex, syncBounds, partBox, distSeg } from './house.js';
import { catalogEntry } from './items.js';

export class PlanEditor {
  constructor(app, canvas) {
    this.app = app; this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.tool = 'select'; this.sel = null; this.scale = 60; this.ox = 0; this.oy = 0; this.drag = null; this.pointers = new Map();
    canvas.addEventListener('pointerdown', e => this.down(e)); canvas.addEventListener('pointermove', e => this.move(e)); canvas.addEventListener('pointerup', e => this.up(e)); canvas.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
    document.getElementById('plAddRoom').onclick = () => this.app.openNewRoom();
    document.getElementById('plDoor').onclick = () => this.setTool(this.tool === 'door' ? 'select' : 'door');
    document.getElementById('plWindow').onclick = () => this.setTool(this.tool === 'window' ? 'select' : 'window');
    document.getElementById('plVertex').onclick = () => this.setTool(this.tool === 'vertex' ? 'select' : 'vertex');
    document.getElementById('plColumn').onclick = () => this.addPartHere('column');
    document.getElementById('plWing').onclick = () => this.addPartHere('wall');
    document.getElementById('plBeam').onclick = () => this.addPartHere('beam');
    document.getElementById('plDel').onclick = () => this.deleteSel();
    window.addEventListener('resize', () => { if (this.visible) this.draw(); });
  }
  setTool(t) { this.tool = t; for (const [id, name] of [['plDoor', 'door'], ['plWindow', 'window'], ['plVertex', 'vertex']]) document.getElementById(id).classList.toggle('on', t === name); this.info(t === 'door' ? '壁をタップすると、そこにドアが付きます(となりの部屋ともつながります)' : t === 'window' ? '壁をタップすると、そこに窓が付きます' : t === 'vertex' ? '壁の線をタップすると、そこに角(曲がり目)ができます。角は引っぱって動かせます' : null); }
  show() { this.visible = true; this.fit(); this.draw(); }
  hide() { this.visible = false; }
  fit() { const r = this.canvas.getBoundingClientRect(); const b = houseBounds(this.app.project.rooms); const w = b.maxX - b.minX + 2, h = b.maxZ - b.minZ + 2; this.scale = Math.min((r.width - 40) / w, (r.height * 0.55) / h, 120); this.ox = r.width / 2 - ((b.minX + b.maxX) / 2) * this.scale; this.oy = r.height * 0.45 - ((b.minZ + b.maxZ) / 2) * this.scale; }
  toPx(x, z) { return [x * this.scale + this.ox, z * this.scale + this.oy]; }
  toM(px, py) { return [(px - this.ox) / this.scale, (py - this.oy) / this.scale]; }
  zoomAt(px, py, k) { const r = this.canvas.getBoundingClientRect(); px -= r.left; py -= r.top; const [mx, mz] = this.toM(px, py); this.scale = Math.max(15, Math.min(300, this.scale * k)); this.ox = px - mx * this.scale; this.oy = py - mz * this.scale; this.draw(); }
  selRoom() { return this.sel ? this.sel.room : (this.app.currentRoom() || this.app.project.rooms[0]); }
  addPartHere(kind) { const r = this.selRoom(); if (!r) { this.app.toast('先に部屋を作ってください'); return; } const id = this.app.addPart(r, kind, { x: r.x + r.w / 2, z: r.z + r.d / 2 }); this.sel = { kind: 'part', room: r, part: r.parts.find(p => p.id === id) }; this.info(null); this.draw(); }
  info(html) { const el = document.getElementById('planInfo'); if (html === null) { html = this.sel ? this.selInfo() : '部屋をタップすると選べます。引っぱると動きます。黄色の●(角)を引っぱると形が変わります。'; } el.innerHTML = html; this.bindInfo(); }
  selInfo() {
    const s = this.sel; if (!s) return '';
    if (s.kind === 'room') { const r = s.room; return `<b>${r.name}</b> ${r.w.toFixed(1)}m × ${r.d.toFixed(1)}m(約${(Math.abs(polyAreaOf(r.poly)) / 1.62).toFixed(1)}畳)・天井${r.h.toFixed(2)}m・角${r.poly.length}つ<div class="row"><button data-act="rename">名前</button><button data-act="size">${isRect(r) ? '広さ・高さ' : '天井の高さ'}</button><button data-act="stand">👣 ここに立つ</button></div>`; }
    if (s.kind === 'vertex') { const [x, z] = s.room.poly[s.index]; return `<b>角</b>(${s.room.name})位置 ${x.toFixed(2)}, ${z.toFixed(2)}<div class="row"><button data-act="chamfer">◢ この角を斜めに</button><button data-act="colhere">▮ ここに柱型</button><button data-act="delv" class="danger">角を消す</button></div>`; }
    if (s.kind === 'opening') { const o = s.opening; return `<b>${o.type === 'window' ? '窓' : 'ドア'}</b>(${s.room.name}の${edgeName(s.room, o.edge)})幅${o.w.toFixed(2)}m 高さ${o.h.toFixed(2)}m${o.type === 'window' ? ' 床から' + (o.sill ?? 0.9).toFixed(2) + 'm' : ''}<div class="row"><button data-act="osize">大きさ</button>${o.type === 'door' ? '<button data-act="swing">開き具合</button>' : ''}</div>`; }
    if (s.kind === 'part') { const p = s.part; const name = { column: '柱型', wall: '袖壁', beam: '梁(下がり天井)' }[p.type]; const b = partBox(p); return `<b>${name}</b>(${s.room.name})${p.type === 'wall' ? `長さ${b.L.toFixed(2)}m 高さ${(p.h || s.room.h).toFixed(2)}m 厚み${(p.t || WALL_T).toFixed(2)}m` : p.type === 'beam' ? `${p.w.toFixed(2)}×${p.d.toFixed(2)}m 下がり${(p.drop || .3).toFixed(2)}m` : `${p.w.toFixed(2)}×${p.d.toFixed(2)}m`}<div class="row"><button data-act="psize">大きさ・高さ</button>${p.type !== 'beam' ? '<button data-act="prot">⟳ 90°回す</button>' : ''}</div>`; }
    return '';
  }
  bindInfo() {
    for (const b of document.querySelectorAll('#planInfo [data-act]')) b.onclick = async () => {
      const s = this.sel, app = this.app, act = b.dataset.act; const redo = () => { this.fixTwins(); app.rebuildHouse(); app.rebuildItems(); app.touched(); this.draw(); this.info(null); };
      if (act === 'rename') { const n = prompt('部屋の名前', s.room.name); if (n) { s.room.name = n; app.touched(); this.draw(); this.info(null); } }
      if (act === 'size') { app.snapshot(); if (isRect(s.room)) { const w = parseFloat(prompt('横(m)', s.room.w)); const d = parseFloat(prompt('奥行(m)', s.room.d)); if (w > 0.5 && d > 0.5) resizeRect(s.room, Math.round(w * 20) / 20, Math.round(d * 20) / 20); } const h = parseFloat(prompt('天井の高さ(m)', s.room.h)); if (h > 1.5) { s.room.h = h; for (const it of app.project.items) if (it.roomId === s.room.id && catalogEntry(it.type).kind === 'ceiling') it.y = h; } redo(); }
      if (act === 'stand') { const r = s.room; app.s3.camera.position.set(r.x + r.w / 2, 1.5, r.z + r.d * 0.75); app.walk.yaw = 0; app.setMode('walk'); }
      if (act === 'chamfer') { app.snapshot(); const len = parseFloat(prompt('斜めにする長さ(m)', '0.8')); if (len > 0.1) { chamferVertex(s.room, s.index, len); this.sel = { kind: 'room', room: s.room }; redo(); } }
      if (act === 'colhere') { const [x, z] = s.room.poly[s.index]; app.addPart(s.room, 'column', { x, z }); this.sel = { kind: 'room', room: s.room }; this.draw(); this.info(null); }
      if (act === 'delv') { app.snapshot(); if (removeVertex(s.room, s.index)) { this.sel = { kind: 'room', room: s.room }; redo(); } else app.toast('角は3つより減らせません'); }
      if (act === 'osize') { const o = s.opening; const w = parseFloat(prompt('幅(m)', o.w)); const h = parseFloat(prompt('高さ(m)', o.h)); if (w > 0.3) o.w = w; if (h > 0.3) o.h = h; if (o.type === 'window') { const sill = parseFloat(prompt('床からの高さ(m)', o.sill ?? 0.9)); if (sill >= 0) o.sill = sill; } this.syncTwin(s.room, o); app.rebuildHouse(); app.touched(); this.draw(); this.info(null); }
      if (act === 'swing') { const o = s.opening; o.open = ((o.open ?? 0.9) + 0.5) % 1.5; if (o.open > 1) o.open = 0; app.rebuildHouse(); app.touched(); }
      if (act === 'psize') { const p = s.part; app.snapshot(); if (p.type === 'wall') { const L = parseFloat(prompt('長さ(m)', partBox(p).L)); const h = parseFloat(prompt('高さ(m)(天井までなら' + s.room.h + ')', p.h || s.room.h)); const t = parseFloat(prompt('厚み(m)', p.t || WALL_T)); if (L > 0.1) { const b = partBox(p); const dx = p.x2 - p.x1, dz = p.z2 - p.z1; const l0 = Math.hypot(dx, dz) || 1; p.x2 = p.x1 + dx / l0 * L; p.z2 = p.z1 + dz / l0 * L; void b; } if (h > 0.2) p.h = h; if (t > 0.03) p.t = t; } else { const w = parseFloat(prompt('横(m)', p.w)); const d = parseFloat(prompt('奥行(m)', p.d)); if (w > 0.05) p.w = w; if (d > 0.05) p.d = d; if (p.type === 'beam') { const dr = parseFloat(prompt('下がり(m)', p.drop || .3)); if (dr > 0.05) p.drop = dr; } } app.rebuildHouse(); app.touched(); this.draw(); this.info(null); }
      if (act === 'prot') { const p = s.part; app.snapshot(); if (p.type === 'wall') { const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2; const dx = p.x2 - p.x1, dz = p.z2 - p.z1; p.x1 = cx + dz / 2; p.z1 = cz - dx / 2; p.x2 = cx - dz / 2; p.z2 = cz + dx / 2; } else { const cx = p.x + p.w / 2, cz = p.z + p.d / 2; [p.w, p.d] = [p.d, p.w]; p.x = cx - p.w / 2; p.z = cz - p.d / 2; } app.rebuildHouse(); app.touched(); this.draw(); this.info(null); }
    };
  }
  clampOpenings(room) { room.openings = (room.openings || []).filter(o => { const L = wallLength(room, o.edge); if (o.u + o.w > L - 0.05) o.u = Math.max(0.05, L - o.w - 0.05); return o.u >= 0 && o.w < L; }); }
  syncTwin(room, o) { for (const r of this.app.project.rooms) for (const t of (r.openings || [])) if (t.twin === o.id || o.twin === t.id) { t.w = o.w; t.h = o.h; } }
  openingSeg(r, o) { const f = edgeFrame(r, o.edge); const a = f.origin.clone().addScaledVector(f.along, o.u), b = f.origin.clone().addScaledVector(f.along, o.u + o.w); return [a.x, a.z, b.x, b.z]; }
  // 当たり判定
  hit(px, py) {
    const [mx, mz] = this.toM(px, py), rooms = this.app.project.rooms, tol = 14 / this.scale;
    const selRoom = this.sel && this.sel.room;
    // 選んでいる部屋の角(頂点)
    if (selRoom) for (let i = 0; i < selRoom.poly.length; i++) { const [x, z] = selRoom.poly[i]; if (Math.hypot(mx - x, mz - z) < tol * 1.2) return { kind: 'vertex', room: selRoom, index: i }; }
    // 袖壁の端
    if (selRoom) for (const p of selRoom.parts || []) if (p.type === 'wall') { if (Math.hypot(mx - p.x2, mz - p.z2) < tol) return { kind: 'wallend', room: selRoom, part: p, end: 2 }; if (Math.hypot(mx - p.x1, mz - p.z1) < tol) return { kind: 'wallend', room: selRoom, part: p, end: 1 }; }
    // 柱型・梁の角(大きさ)
    if (selRoom) for (const p of selRoom.parts || []) if (p.type !== 'wall' && Math.hypot(mx - (p.x + p.w), mz - (p.z + p.d)) < tol) return { kind: 'partcorner', room: selRoom, part: p };
    // 開口
    for (const r of rooms) for (const o of (r.openings || [])) { const [x0, z0, x1, z1] = this.openingSeg(r, o); if (distSeg(mx, mz, x0, z0, x1, z1) < tol) return { kind: 'opening', room: r, opening: o }; }
    // 部品
    for (const r of rooms) for (const p of (r.parts || [])) { const b = partBox(p); const c = Math.cos(b.rot), s = Math.sin(b.rot); const dx = mx - b.cx, dz = mz - b.cz; const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) <= b.w / 2 + tol * .5 && Math.abs(lz) <= b.d / 2 + tol * .5) return { kind: 'part', room: r, part: p }; }
    // 四角い部屋の右下の角(大きさ変更)
    for (const r of rooms) if (isRect(r) && Math.hypot(mx - (r.x + r.w), mz - (r.z + r.d)) < tol * 1.3) return { kind: 'corner', room: r };
    // 壁
    for (const r of rooms) for (let e = 0; e < r.poly.length; e++) { const f = edgeFrame(r, e); const d = distSeg(mx, mz, f.A[0], f.A[1], f.B[0], f.B[1]); if (d < tol) { const u = (mx - f.A[0]) * f.along.x + (mz - f.A[1]) * f.along.z; return { kind: 'wall', room: r, edge: e, u: Math.max(0, Math.min(f.L, u)) }; } }
    for (const r of rooms) if (pointIn(mx, mz, r.poly)) return { kind: 'room', room: r };
    return null;
  }
  down(e) {
    try { this.canvas.setPointerCapture(e.pointerId); } catch {} const rect = this.canvas.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; this.pointers.set(e.pointerId, { x: px, y: py });
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ox: this.ox, oy: this.oy }; this.drag = null; return; }
    const h = this.hit(px, py); const app = this.app;
    if (this.tool === 'door' || this.tool === 'window') { if (h && (h.kind === 'wall' || h.kind === 'opening')) { if (h.kind === 'opening') { this.sel = h; this.info(null); this.draw(); return; } const w = this.tool === 'door' ? 0.8 : 1.65, L = wallLength(h.room, h.edge); if (L < w + 0.3) { app.toast('この壁は短すぎます'); return; } const u = Math.max(0.1, Math.min(L - w - 0.1, h.u - w / 2)); const o = app.addOpening(h.room, { edge: h.edge, type: this.tool, u, w, h: this.tool === 'door' ? 2.0 : (L > 2.5 ? 1.8 : 1.1), sill: this.tool === 'window' ? (L > 2.5 ? 0.4 : 0.9) : 0, open: 0.9 }); this.sel = { kind: 'opening', room: h.room, opening: o }; this.setTool('select'); this.info(null); this.draw(); } else app.toast('壁の線をタップしてください'); return; }
    if (this.tool === 'vertex') { if (h && h.kind === 'wall') { app.snapshot(); const f = edgeFrame(h.room, h.edge); const x = f.A[0] + f.along.x * h.u, z = f.A[1] + f.along.z * h.u; insertVertex(h.room, h.edge, Math.round(x * 20) / 20, Math.round(z * 20) / 20); this.sel = { kind: 'vertex', room: h.room, index: h.edge + 1 }; this.setTool('select'); this.fixTwins(); app.rebuildHouse(); app.touched(); this.info(null); this.draw(); } else app.toast('壁の線をタップしてください'); return; }
    if (h && h.kind === 'vertex') { this.sel = h; app.snapshot(); this.drag = { kind: 'vertex', room: h.room, index: h.index, sx: px, sy: py, p0: [...h.room.poly[h.index]] }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'wallend') { this.sel = { kind: 'part', room: h.room, part: h.part }; app.snapshot(); this.drag = { kind: 'wallend', part: h.part, end: h.end, sx: px, sy: py, p0: h.end === 2 ? [h.part.x2, h.part.z2] : [h.part.x1, h.part.z1] }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'partcorner') { this.sel = { kind: 'part', room: h.room, part: h.part }; app.snapshot(); this.drag = { kind: 'partcorner', part: h.part, sx: px, sy: py, w0: h.part.w, d0: h.part.d }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'part') { this.sel = h; app.snapshot(); const p = h.part; this.drag = { kind: 'part', part: p, sx: px, sy: py, p0: p.type === 'wall' ? [p.x1, p.z1, p.x2, p.z2] : [p.x, p.z], moved: false }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'corner') { this.sel = { kind: 'room', room: h.room }; app.snapshot(); this.drag = { kind: 'resize', room: h.room, sx: px, sy: py, w0: h.room.w, d0: h.room.d }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'opening') { this.sel = h; app.snapshot(); this.drag = { kind: 'opening', room: h.room, opening: h.opening, sx: px, sy: py, u0: h.opening.u }; this.info(null); this.draw(); return; }
    if (h && (h.kind === 'room' || h.kind === 'wall')) { this.sel = { kind: 'room', room: h.room }; this.drag = { kind: 'room', room: h.room, sx: px, sy: py, x0: h.room.x, z0: h.room.z, lastX: h.room.x, lastZ: h.room.z, moved: false }; this.info(null); this.draw(); return; }
    this.sel = null; this.drag = { kind: 'pan', sx: px, sy: py, ox: this.ox, oy: this.oy }; this.info(null); this.draw();
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return; const rect = this.canvas.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; this.pointers.set(e.pointerId, { x: px, y: py });
    if (this.pointers.size === 2 && this.pinch) { const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const k = d / this.pinch.d; const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; const [mx, mz] = [(this.pinch.cx - this.pinch.ox) / this.pinch.scale, (this.pinch.cy - this.pinch.oy) / this.pinch.scale]; this.scale = Math.max(15, Math.min(300, this.pinch.scale * k)); this.ox = cx - mx * this.scale; this.oy = cy - mz * this.scale; this.draw(); return; }
    const d = this.drag; if (!d) return; const dx = (px - d.sx) / this.scale, dz = (py - d.sy) / this.scale; const snap = v => Math.round(v * 20) / 20;
    if (d.kind === 'pan') { this.ox = d.ox + (px - d.sx); this.oy = d.oy + (py - d.sy); this.draw(); return; }
    if (d.kind === 'vertex') { const r = d.room; let nx = snap(d.p0[0] + dx), nz = snap(d.p0[1] + dz); // となりの角と そろえる
      const n = r.poly.length, A = r.poly[(d.index - 1 + n) % n], B = r.poly[(d.index + 1) % n]; for (const q of [A, B]) { if (Math.abs(nx - q[0]) < 0.12) nx = q[0]; if (Math.abs(nz - q[1]) < 0.12) nz = q[1]; }
      r.poly[d.index] = [nx, nz]; syncBounds(r); this.draw(); return; }
    if (d.kind === 'wallend') { const p = d.part; const nx = snap(d.p0[0] + dx), nz = snap(d.p0[1] + dz); if (d.end === 2) { p.x2 = nx; p.z2 = nz; } else { p.x1 = nx; p.z1 = nz; } this.draw(); return; }
    if (d.kind === 'partcorner') { const p = d.part; p.w = Math.max(0.05, snap(d.w0 + dx)); p.d = Math.max(0.05, snap(d.d0 + dz)); this.draw(); return; }
    if (d.kind === 'part') { const p = d.part; if (Math.hypot(px - d.sx, py - d.sy) > 4) d.moved = true; if (!d.moved) return; if (p.type === 'wall') { p.x1 = snap(d.p0[0] + dx); p.z1 = snap(d.p0[1] + dz); p.x2 = snap(d.p0[2] + dx); p.z2 = snap(d.p0[3] + dz); } else { p.x = snap(d.p0[0] + dx); p.z = snap(d.p0[1] + dz); } this.draw(); return; }
    if (d.kind === 'room') { if (Math.hypot(px - d.sx, py - d.sy) > 6) d.moved = true; if (!d.moved) return; let nx = Math.round((d.x0 + dx) * 10) / 10, nz = Math.round((d.z0 + dz) * 10) / 10; const r = d.room; const sn = 0.25;
      for (const o of this.app.project.rooms) { if (o === r) continue; for (const [a, b] of [[nx, o.x + o.w + WALL_T], [nx + r.w + WALL_T, o.x], [nx, o.x], [nx + r.w, o.x + o.w]]) if (Math.abs(a - b) < sn) nx += b - a; for (const [a, b] of [[nz, o.z + o.d + WALL_T], [nz + r.d + WALL_T, o.z], [nz, o.z], [nz + r.d, o.z + o.d]]) if (Math.abs(a - b) < sn) nz += b - a; }
      const ddx = nx - d.lastX, ddz = nz - d.lastZ; if (ddx || ddz) { translateRoom(r, ddx, ddz); d.lastX = nx; d.lastZ = nz; for (const it of this.app.project.items) if (it.roomId === r.id) { it.x += ddx; it.z += ddz; } } this.draw(); return; }
    if (d.kind === 'resize') { const r = d.room; resizeRect(r, Math.max(0.8, Math.round((d.w0 + dx) * 10) / 10), Math.max(0.8, Math.round((d.d0 + dz) * 10) / 10)); this.draw(); return; }
    if (d.kind === 'opening') { const o = d.opening, r = d.room; const f = edgeFrame(r, o.edge); const delta = dx * f.along.x + dz * f.along.z; o.u = Math.max(0.05, Math.min(f.L - o.w - 0.05, d.u0 + delta)); this.draw(); return; }
  }
  up(e) {
    this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = null; const d = this.drag; this.drag = null; if (!d) return; const app = this.app;
    const redo = () => { this.fixTwins(); app.rebuildHouse(); app.rebuildItems(); app.touched(); this.info(null); this.draw(); };
    if (d.kind === 'room' && d.moved) redo();
    if (d.kind === 'resize') { this.clampOpenings(d.room); for (const it of app.project.items) if (it.roomId === d.room.id) { const r = d.room; it.x = Math.min(r.x + r.w - 0.1, it.x); it.z = Math.min(r.z + r.d - 0.1, it.z); } redo(); }
    if (d.kind === 'vertex') { this.clampOpenings(d.room); redo(); }
    if (d.kind === 'wallend' || d.kind === 'partcorner' || (d.kind === 'part' && d.moved)) { app.rebuildHouse(); app.touched(); this.info(null); this.draw(); }
    if (d.kind === 'opening') { const o = d.opening; for (const r of app.project.rooms) for (const t of (r.openings || [])) if (t.twin === o.id) { const nb = neighborAcross(d.room, o.edge, o.u, o.w, [r]); if (nb) t.u = nb.u; } app.rebuildHouse(); app.touched(); }
  }
  // 部屋を動かしたあと、共有ドアの相手側を合わせ直す(離れたら相手側を消す)
  fixTwins() {
    const rooms = this.app.project.rooms; for (const r of rooms) normalizeRoom(r);
    for (const r of rooms) r.openings = (r.openings || []).filter(o => !o.twin);
    for (const r of rooms) for (const o of (r.openings || [])) { if (o.type !== 'door') continue; const nb = neighborAcross(r, o.edge, o.u, o.w, rooms); if (nb) nb.room.openings.push({ id: 't' + o.id, edge: nb.edge, type: 'door', u: nb.u, w: o.w, h: o.h, twin: o.id }); }
  }
  deleteSel() {
    const s = this.sel; if (!s) { this.app.toast('消すものを先にタップしてください'); return; } const app = this.app;
    if (s.kind === 'opening') { app.removeOpening(s.room, s.opening.id); this.sel = null; this.info(null); this.draw(); return; }
    if (s.kind === 'part') { app.snapshot(); s.room.parts = s.room.parts.filter(p => p !== s.part); app.rebuildHouse(); app.touched(); this.sel = { kind: 'room', room: s.room }; this.info(null); this.draw(); return; }
    if (s.kind === 'vertex') { app.snapshot(); if (removeVertex(s.room, s.index)) { this.sel = { kind: 'room', room: s.room }; this.fixTwins(); app.rebuildHouse(); app.touched(); this.info(null); this.draw(); } else app.toast('角は3つより減らせません'); return; }
    if (s.kind === 'room') { if (!confirm(`${s.room.name}を消しますか?(中のものも消えます)`)) return; const p = app.project; p.rooms = p.rooms.filter(r => r !== s.room); p.items = p.items.filter(i => i.roomId !== s.room.id); this.fixTwins(); this.sel = null; app.load(p); app.setMode('plan'); }
  }
  draw() {
    const c = this.canvas, g = this.ctx, rect = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) { c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#1b1e26'; g.fillRect(0, 0, rect.width, rect.height);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; const [mx0, mz0] = this.toM(0, 0), [mx1, mz1] = this.toM(rect.width, rect.height);
    for (let x = Math.floor(mx0); x <= mx1; x++) { const [px] = this.toPx(x, 0); g.beginPath(); g.moveTo(px, 0); g.lineTo(px, rect.height); g.stroke(); }
    for (let z = Math.floor(mz0); z <= mz1; z++) { const [, pz] = this.toPx(0, z); g.beginPath(); g.moveTo(0, pz); g.lineTo(rect.width, pz); g.stroke(); }
    const rooms = this.app.project.rooms, s = this.scale;
    for (const r of rooms) {
      normalizeRoom(r); const selected = this.sel && this.sel.room === r; const path = () => { g.beginPath(); r.poly.forEach(([x, z], i) => { const [px, pz] = this.toPx(x, z); if (i === 0) g.moveTo(px, pz); else g.lineTo(px, pz); }); g.closePath(); };
      path(); g.fillStyle = selected ? '#3a3f55' : '#2a2e3a'; g.fill();
      path(); g.strokeStyle = '#e8e8e8'; g.lineWidth = Math.max(3, WALL_T * s); g.lineJoin = 'miter'; g.stroke();
      // 中のもの
      for (const it of this.app.project.items) { if (it.roomId !== r.id) continue; const e = catalogEntry(it.type); if (!e) continue; const [ix, iz] = this.toPx(it.x, it.z); g.save(); g.translate(ix, iz); g.rotate(-(it.rot || 0)); g.fillStyle = e.cat === '照明' ? 'rgba(255,220,120,.7)' : e.kind === 'wall' ? 'rgba(120,180,255,.7)' : 'rgba(200,200,200,.45)'; const iw = it.w * s, id = (e.kind === 'wall' ? 0.08 : it.d) * s; g.fillRect(-iw / 2, e.kind === 'wall' ? 0 : -id / 2, iw, id); g.restore(); }
      // 柱型・袖壁・梁
      for (const p of (r.parts || [])) { const b = partBox(p); const [cx, cz] = this.toPx(b.cx, b.cz); const psel = this.sel && this.sel.kind === 'part' && this.sel.part === p; g.save(); g.translate(cx, cz); g.rotate(-b.rot); if (p.type === 'beam') { g.setLineDash([6, 4]); g.strokeStyle = psel ? '#ffcf4d' : 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.strokeRect(-b.w * s / 2, -b.d * s / 2, b.w * s, b.d * s); g.setLineDash([]); } else { g.fillStyle = psel ? '#ffcf4d' : '#e8e8e8'; g.fillRect(-b.w * s / 2, -b.d * s / 2, b.w * s, b.d * s); } g.restore();
        if (selected) { if (p.type === 'wall') { for (const [x, z] of [[p.x1, p.z1], [p.x2, p.z2]]) { const [hx, hz] = this.toPx(x, z); g.fillStyle = '#ffcf4d'; g.beginPath(); g.arc(hx, hz, 6, 0, 7); g.fill(); } } else { const [hx, hz] = this.toPx(p.x + p.w, p.z + p.d); g.fillStyle = '#ffcf4d'; g.fillRect(hx - 5, hz - 5, 10, 10); } } }
      // 開口
      for (const o of (r.openings || [])) { const [x0, z0, x1, z1] = this.openingSeg(r, o); const [ax, ay] = this.toPx(x0, z0), [bx, by] = this.toPx(x1, z1); const osel = this.sel && this.sel.kind === 'opening' && this.sel.opening === o; g.strokeStyle = osel ? '#ffcf4d' : o.type === 'window' ? '#7fc4ff' : '#c9955a'; g.lineWidth = Math.max(4, WALL_T * s + 2); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        if (o.type === 'door' && !o.twin) { const f = edgeFrame(r, o.edge); g.strokeStyle = osel ? '#ffcf4d' : 'rgba(201,149,90,.8)'; g.lineWidth = 1.5; const rr = o.w * s; const a0 = Math.atan2(-f.along.z, f.along.x), a1 = Math.atan2(-f.normal.z, f.normal.x); g.beginPath(); g.arc(ax, ay, rr, -a0, -a1, (a1 - a0 + Math.PI * 2) % (Math.PI * 2) > Math.PI); g.stroke(); } }
      // 角(選んでいる部屋)
      if (selected) for (let i = 0; i < r.poly.length; i++) { const [x, z] = r.poly[i]; const [hx, hz] = this.toPx(x, z); const vsel = this.sel.kind === 'vertex' && this.sel.index === i; g.fillStyle = vsel ? '#fff' : '#ffcf4d'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hz, vsel ? 9 : 7, 0, 7); g.fill(); g.stroke(); }
      // 名前
      const [cxm, czm] = polyCenter(r.poly); const [x, y] = this.toPx(cxm, czm); g.fillStyle = '#fff'; g.font = `bold ${Math.max(12, Math.min(18, s * 0.25))}px sans-serif`; g.textAlign = 'center'; g.fillText(r.name, x, y); g.font = `${Math.max(10, Math.min(13, s * 0.2))}px sans-serif`; g.fillStyle = '#c9cdd8'; g.fillText(`${r.w.toFixed(1)}×${r.d.toFixed(1)}m`, x, y + 16);
      if (selected && isRect(r)) { const [hx, hz] = this.toPx(r.x + r.w, r.z + r.d); g.fillStyle = '#ffcf4d'; g.fillRect(hx - 8, hz - 8, 16, 16); }
    }
    const cam = this.app.s3.camera.position, [cx, cy] = this.toPx(cam.x, cam.z), yaw = this.app.walk.yaw; g.save(); g.translate(cx, cy); g.rotate(-yaw); g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.restore();
    g.fillStyle = '#9aa0ae'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('↑ 奥(北)', 12, 20 + 80);
  }
}
function pointIn(px, pz, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / ((zj - zi) || 1e-12) + xi)) inside = !inside; } return inside; }
function polyAreaOf(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; a += x1 * z2 - x2 * z1; } return a / 2; }
function polyCenter(poly) { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; }
