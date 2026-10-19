// 間取り(上から見た図)の編集:部屋を動かす・広さを変える・ドアや窓を付ける
import { SIDES, SIDE_NAME, WALL_T, wallLength, houseBounds, neighborAcross } from './house.js';
import { catalogEntry } from './items.js';

export class PlanEditor {
  constructor(app, canvas) {
    this.app = app; this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.tool = 'select'; this.sel = null; this.scale = 60; this.ox = 0; this.oy = 0; this.drag = null; this.pointers = new Map();
    canvas.addEventListener('pointerdown', e => this.down(e)); canvas.addEventListener('pointermove', e => this.move(e)); canvas.addEventListener('pointerup', e => this.up(e)); canvas.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
    document.getElementById('plAddRoom').onclick = () => this.app.openNewRoom();
    document.getElementById('plDoor').onclick = () => this.setTool(this.tool === 'door' ? 'select' : 'door');
    document.getElementById('plWindow').onclick = () => this.setTool(this.tool === 'window' ? 'select' : 'window');
    document.getElementById('plDel').onclick = () => this.deleteSel();
    window.addEventListener('resize', () => { if (this.visible) this.draw(); });
  }
  setTool(t) { this.tool = t; document.getElementById('plDoor').classList.toggle('on', t === 'door'); document.getElementById('plWindow').classList.toggle('on', t === 'window'); this.info(t === 'door' ? '壁をタップすると、そこにドアが付きます(となりの部屋ともつながります)' : t === 'window' ? '壁をタップすると、そこに窓が付きます' : null); }
  show() { this.visible = true; this.fit(); this.draw(); }
  hide() { this.visible = false; }
  fit() { const r = this.canvas.getBoundingClientRect(); const b = houseBounds(this.app.project.rooms); const w = b.maxX - b.minX + 2, h = b.maxZ - b.minZ + 2; this.scale = Math.min((r.width - 40) / w, (r.height * 0.55) / h, 120); this.ox = r.width / 2 - ((b.minX + b.maxX) / 2) * this.scale; this.oy = r.height * 0.45 - ((b.minZ + b.maxZ) / 2) * this.scale; }
  toPx(x, z) { return [x * this.scale + this.ox, z * this.scale + this.oy]; }
  toM(px, py) { return [(px - this.ox) / this.scale, (py - this.oy) / this.scale]; }
  zoomAt(px, py, k) { const r = this.canvas.getBoundingClientRect(); px -= r.left; py -= r.top; const [mx, mz] = this.toM(px, py); this.scale = Math.max(15, Math.min(300, this.scale * k)); this.ox = px - mx * this.scale; this.oy = py - mz * this.scale; this.draw(); }
  info(html) { const el = document.getElementById('planInfo'); if (html === null) { html = this.sel ? this.selInfo() : '部屋をタップすると選べます。引っぱると動きます。角の■で広さを変えます。'; } el.innerHTML = html; this.bindInfo(); }
  selInfo() {
    const s = this.sel; if (!s) return '';
    if (s.kind === 'room') { const r = s.room; return `<b>${r.name}</b> ${r.w.toFixed(1)}m × ${r.d.toFixed(1)}m(約${(r.w * r.d / 1.62).toFixed(1)}畳)・天井${r.h.toFixed(2)}m<div class="row"><button data-act="rename">名前</button><button data-act="size">広さ・高さ</button><button data-act="stand">👣 ここに立つ</button></div>`; }
    if (s.kind === 'opening') { const o = s.opening; return `<b>${o.type === 'window' ? '窓' : 'ドア'}</b>(${s.room.name}の${SIDE_NAME[o.side]})幅${o.w.toFixed(2)}m 高さ${o.h.toFixed(2)}m${o.type === 'window' ? ' 床から' + (o.sill ?? 0.9).toFixed(2) + 'm' : ''}<div class="row"><button data-act="osize">大きさ</button>${o.type === 'door' ? '<button data-act="swing">開き具合</button>' : ''}</div>`; }
    return '';
  }
  bindInfo() {
    for (const b of document.querySelectorAll('#planInfo [data-act]')) b.onclick = async () => {
      const s = this.sel, app = this.app, act = b.dataset.act;
      if (act === 'rename') { const n = prompt('部屋の名前', s.room.name); if (n) { s.room.name = n; app.touched(); this.draw(); this.info(null); } }
      if (act === 'size') { const w = parseFloat(prompt('横(m)', s.room.w)); const d = parseFloat(prompt('奥行(m)', s.room.d)); const h = parseFloat(prompt('天井の高さ(m)', s.room.h)); if (w > 0.5) s.room.w = Math.round(w * 20) / 20; if (d > 0.5) s.room.d = Math.round(d * 20) / 20; if (h > 1.5) s.room.h = h; this.clampOpenings(s.room); app.rebuildHouse(); app.touched(); this.draw(); this.info(null); }
      if (act === 'stand') { const r = s.room; app.s3.camera.position.set(r.x + r.w / 2, 1.5, r.z + r.d * 0.75); app.walk.yaw = 0; app.setMode('walk'); }
      if (act === 'osize') { const o = s.opening; const w = parseFloat(prompt('幅(m)', o.w)); const h = parseFloat(prompt('高さ(m)', o.h)); if (w > 0.3) o.w = w; if (h > 0.3) o.h = h; if (o.type === 'window') { const sill = parseFloat(prompt('床からの高さ(m)', o.sill ?? 0.9)); if (sill >= 0) o.sill = sill; } this.syncTwin(s.room, o); app.rebuildHouse(); app.touched(); this.draw(); this.info(null); }
      if (act === 'swing') { const o = s.opening; o.open = ((o.open ?? 0.9) + 0.5) % 1.5; if (o.open > 1) o.open = 0; app.rebuildHouse(); app.touched(); }
    };
  }
  clampOpenings(room) { room.openings = (room.openings || []).filter(o => { const L = wallLength(room, o.side); if (o.pos + o.w > L - 0.05) o.pos = Math.max(0.05, L - o.w - 0.05); return o.pos >= 0 && o.w < L; }); }
  syncTwin(room, o) { for (const r of this.app.project.rooms) for (const t of (r.openings || [])) if (t.twin === o.id || o.twin === t.id) { t.w = o.w; t.h = o.h; } }
  // 当たり判定
  hit(px, py) {
    const [mx, mz] = this.toM(px, py), rooms = this.app.project.rooms, tol = 14 / this.scale;
    // 開口
    for (const r of rooms) for (const o of (r.openings || [])) { const [x0, z0, x1, z1] = this.openingSeg(r, o); if (distSeg(mx, mz, x0, z0, x1, z1) < tol) return { kind: 'opening', room: r, opening: o }; }
    // 角(大きさ変更)
    for (const r of rooms) if (Math.hypot(mx - (r.x + r.w), mz - (r.z + r.d)) < tol * 1.3) return { kind: 'corner', room: r };
    // 壁
    for (const r of rooms) for (const side of SIDES) { const [x0, z0, x1, z1] = this.wallSeg(r, side); const d = distSeg(mx, mz, x0, z0, x1, z1); if (d < tol) { const L = wallLength(r, side); const u = (side === 'N' || side === 'S') ? mx - r.x : mz - r.z; return { kind: 'wall', room: r, side, pos: Math.max(0, Math.min(L, u)) }; } }
    for (const r of rooms) if (mx >= r.x && mx <= r.x + r.w && mz >= r.z && mz <= r.z + r.d) return { kind: 'room', room: r };
    return null;
  }
  wallSeg(r, side) { return { N: [r.x, r.z, r.x + r.w, r.z], S: [r.x, r.z + r.d, r.x + r.w, r.z + r.d], W: [r.x, r.z, r.x, r.z + r.d], E: [r.x + r.w, r.z, r.x + r.w, r.z + r.d] }[side]; }
  openingSeg(r, o) { if (o.side === 'N') return [r.x + o.pos, r.z, r.x + o.pos + o.w, r.z]; if (o.side === 'S') return [r.x + o.pos, r.z + r.d, r.x + o.pos + o.w, r.z + r.d]; if (o.side === 'W') return [r.x, r.z + o.pos, r.x, r.z + o.pos + o.w]; return [r.x + r.w, r.z + o.pos, r.x + r.w, r.z + o.pos + o.w]; }
  down(e) {
    this.canvas.setPointerCapture(e.pointerId); const rect = this.canvas.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; this.pointers.set(e.pointerId, { x: px, y: py });
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ox: this.ox, oy: this.oy }; this.drag = null; return; }
    const h = this.hit(px, py);
    if (this.tool === 'door' || this.tool === 'window') { if (h && (h.kind === 'wall' || h.kind === 'opening')) { if (h.kind === 'opening') { this.sel = h; this.info(null); this.draw(); return; } const w = this.tool === 'door' ? 0.8 : 1.65, L = wallLength(h.room, h.side); if (L < w + 0.3) { this.app.toast('この壁は短すぎます'); return; } const pos = Math.max(0.1, Math.min(L - w - 0.1, h.pos - w / 2)); const o = this.app.addOpening(h.room, { side: h.side, type: this.tool, pos, w, h: this.tool === 'door' ? 2.0 : (L > 2.5 ? 1.8 : 1.1), sill: this.tool === 'window' ? (L > 2.5 ? 0.4 : 0.9) : 0, open: 0.9 }); this.sel = { kind: 'opening', room: h.room, opening: o }; this.setTool('select'); this.info(null); this.draw(); } else this.app.toast('壁の線をタップしてください'); return; }
    if (h && h.kind === 'corner') { this.sel = { kind: 'room', room: h.room }; this.drag = { kind: 'resize', room: h.room, sx: px, sy: py, w0: h.room.w, d0: h.room.d }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'opening') { this.sel = h; this.drag = { kind: 'opening', room: h.room, opening: h.opening, sx: px, sy: py, pos0: h.opening.pos }; this.info(null); this.draw(); return; }
    if (h && (h.kind === 'room' || h.kind === 'wall')) { this.sel = { kind: 'room', room: h.room }; this.drag = { kind: 'room', room: h.room, sx: px, sy: py, x0: h.room.x, z0: h.room.z, moved: false }; this.info(null); this.draw(); return; }
    this.sel = null; this.drag = { kind: 'pan', sx: px, sy: py, ox: this.ox, oy: this.oy }; this.info(null); this.draw();
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return; const rect = this.canvas.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; this.pointers.set(e.pointerId, { x: px, y: py });
    if (this.pointers.size === 2 && this.pinch) { const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const k = d / this.pinch.d; const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; const [mx, mz] = [(this.pinch.cx - this.pinch.ox) / this.pinch.scale, (this.pinch.cy - this.pinch.oy) / this.pinch.scale]; this.scale = Math.max(15, Math.min(300, this.pinch.scale * k)); this.ox = cx - mx * this.scale; this.oy = cy - mz * this.scale; this.draw(); return; }
    const d = this.drag; if (!d) return; const dx = (px - d.sx) / this.scale, dz = (py - d.sy) / this.scale;
    if (d.kind === 'pan') { this.ox = d.ox + (px - d.sx); this.oy = d.oy + (py - d.sy); this.draw(); return; }
    if (d.kind === 'room') { if (Math.hypot(px - d.sx, py - d.sy) > 6) d.moved = true; if (!d.moved) return; let nx = Math.round((d.x0 + dx) * 10) / 10, nz = Math.round((d.z0 + dz) * 10) / 10; const r = d.room; const snap = 0.25;
      for (const o of this.app.project.rooms) { if (o === r) continue; for (const [a, b] of [[nx, o.x + o.w + WALL_T], [nx + r.w + WALL_T, o.x], [nx, o.x], [nx + r.w, o.x + o.w]]) if (Math.abs(a - b) < snap) nx += b - a; for (const [a, b] of [[nz, o.z + o.d + WALL_T], [nz + r.d + WALL_T, o.z], [nz, o.z], [nz + r.d, o.z + o.d]]) if (Math.abs(a - b) < snap) nz += b - a; }
      const ddx = nx - r.x, ddz = nz - r.z; if (ddx || ddz) { r.x = nx; r.z = nz; for (const it of this.app.project.items) if (it.roomId === r.id) { it.x += ddx; it.z += ddz; } } this.draw(); return; }
    if (d.kind === 'resize') { const r = d.room; r.w = Math.max(0.8, Math.round((d.w0 + dx) * 10) / 10); r.d = Math.max(0.8, Math.round((d.d0 + dz) * 10) / 10); this.draw(); return; }
    if (d.kind === 'opening') { const o = d.opening, r = d.room; const L = wallLength(r, o.side); const delta = (o.side === 'N' || o.side === 'S') ? dx : dz; o.pos = Math.max(0.05, Math.min(L - o.w - 0.05, d.pos0 + delta)); this.draw(); return; }
  }
  up(e) {
    this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = null; const d = this.drag; this.drag = null; if (!d) return; const app = this.app;
    if (d.kind === 'room' && d.moved) { this.fixTwins(); app.rebuildHouse(); app.rebuildItems(); app.touched(); this.info(null); }
    if (d.kind === 'resize') { this.clampOpenings(d.room); for (const it of app.project.items) if (it.roomId === d.room.id) { const r = d.room; it.x = Math.min(r.x + r.w - 0.1, it.x); it.z = Math.min(r.z + r.d - 0.1, it.z); } this.fixTwins(); app.rebuildHouse(); app.rebuildItems(); app.touched(); this.info(null); }
    if (d.kind === 'opening') { const o = d.opening; for (const r of app.project.rooms) for (const t of (r.openings || [])) if (t.twin === o.id) { const src = d.room; t.pos = (o.side === 'E' || o.side === 'W') ? src.z + o.pos - r.z : src.x + o.pos - r.x; } app.rebuildHouse(); app.touched(); }
  }
  // 部屋を動かしたあと、共有ドアの相手側を合わせ直す(離れたら相手側を消す)
  fixTwins() {
    const rooms = this.app.project.rooms;
    for (const r of rooms) r.openings = (r.openings || []).filter(o => !o.twin);
    for (const r of rooms) for (const o of (r.openings || [])) { if (o.type !== 'door') continue; const nb = neighborAcross(r, o.side, o.pos, o.w, rooms); if (nb) { const r2 = nb.room; const pos2 = (o.side === 'E' || o.side === 'W') ? r.z + o.pos - r2.z : r.x + o.pos - r2.x; r2.openings.push({ id: 't' + o.id, side: nb.side, type: 'door', pos: pos2, w: o.w, h: o.h, twin: o.id }); } }
  }
  deleteSel() {
    const s = this.sel; if (!s) { this.app.toast('消すものを先にタップしてください'); return; }
    if (s.kind === 'opening') { this.app.removeOpening(s.room, s.opening.id); this.sel = null; this.info(null); this.draw(); return; }
    if (s.kind === 'room') { if (!confirm(`${s.room.name}を消しますか?(中のものも消えます)`)) return; const p = this.app.project; p.rooms = p.rooms.filter(r => r !== s.room); p.items = p.items.filter(i => i.roomId !== s.room.id); this.fixTwins(); this.sel = null; this.app.load(p); this.app.setMode('plan'); }
  }
  draw() {
    const c = this.canvas, g = this.ctx, rect = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) { c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#1b1e26'; g.fillRect(0, 0, rect.width, rect.height);
    // 方眼(1m)
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; const [mx0, mz0] = this.toM(0, 0), [mx1, mz1] = this.toM(rect.width, rect.height);
    for (let x = Math.floor(mx0); x <= mx1; x++) { const [px] = this.toPx(x, 0); g.beginPath(); g.moveTo(px, 0); g.lineTo(px, rect.height); g.stroke(); }
    for (let z = Math.floor(mz0); z <= mz1; z++) { const [, pz] = this.toPx(0, z); g.beginPath(); g.moveTo(0, pz); g.lineTo(rect.width, pz); g.stroke(); }
    const rooms = this.app.project.rooms, s = this.scale;
    for (const r of rooms) {
      const [x, y] = this.toPx(r.x, r.z), w = r.w * s, h = r.d * s; const selected = this.sel && this.sel.room === r && this.sel.kind === 'room';
      g.fillStyle = selected ? '#3a3f55' : '#2a2e3a'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#e8e8e8'; g.lineWidth = Math.max(3, WALL_T * s); g.strokeRect(x, y, w, h);
      // 中のもの
      for (const it of this.app.project.items) { if (it.roomId !== r.id) continue; const e = catalogEntry(it.type); if (!e) continue; const [ix, iz] = this.toPx(it.x, it.z); g.save(); g.translate(ix, iz); g.rotate(-(it.rot || 0)); g.fillStyle = e.cat === '照明' ? 'rgba(255,220,120,.7)' : e.kind === 'wall' ? 'rgba(120,180,255,.7)' : 'rgba(200,200,200,.45)'; const iw = it.w * s, id = (e.kind === 'wall' ? 0.08 : it.d) * s; g.fillRect(-iw / 2, e.kind === 'wall' ? 0 : -id / 2, iw, id); g.restore(); }
      // 開口
      for (const o of (r.openings || [])) { const [x0, z0, x1, z1] = this.openingSeg(r, o); const [ax, ay] = this.toPx(x0, z0), [bx, by] = this.toPx(x1, z1); const osel = this.sel && this.sel.kind === 'opening' && this.sel.opening === o; g.strokeStyle = osel ? '#ffcf4d' : o.type === 'window' ? '#7fc4ff' : '#c9955a'; g.lineWidth = Math.max(4, WALL_T * s + 2); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        if (o.type === 'door') { g.strokeStyle = osel ? '#ffcf4d' : 'rgba(201,149,90,.8)'; g.lineWidth = 1.5; const rr = o.w * s; const inward = { N: Math.PI / 2, S: -Math.PI / 2, W: 0, E: Math.PI }[o.side]; g.beginPath(); g.arc(ax, ay, rr, inward - ((o.side === 'N' || o.side === 'W') ? Math.PI / 2 : 0), inward + ((o.side === 'N' || o.side === 'W') ? 0 : Math.PI / 2)); g.stroke(); } }
      // 名前
      g.fillStyle = '#fff'; g.font = `bold ${Math.max(12, Math.min(18, s * 0.25))}px sans-serif`; g.textAlign = 'center'; g.fillText(r.name, x + w / 2, y + h / 2); g.font = `${Math.max(10, Math.min(13, s * 0.2))}px sans-serif`; g.fillStyle = '#c9cdd8'; g.fillText(`${r.w.toFixed(1)}×${r.d.toFixed(1)}m`, x + w / 2, y + h / 2 + 16);
      // 角のつまみ
      if (selected) { g.fillStyle = '#ffcf4d'; g.fillRect(x + w - 8, y + h - 8, 16, 16); }
    }
    // 自分の位置
    const cam = this.app.s3.camera.position, [cx, cy] = this.toPx(cam.x, cam.z), yaw = this.app.walk.yaw; g.save(); g.translate(cx, cy); g.rotate(-yaw); g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.restore();
    // 方角
    g.fillStyle = '#9aa0ae'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('↑ 奥(北)', 12, rect.height * 0.42 - 6);
  }
}
function distSeg(px, py, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0; const l2 = dx * dx + dy * dy || 1e-9; let t = ((px - x0) * dx + (py - y0) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)); }
