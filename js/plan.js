// 間取り(上から見た図)の編集:部屋を動かす・形を変える(角を動かす/足す/斜めに)・柱型/袖壁/梁・ドアや窓
// 寸法は mm で表示・入力。グリッド(尺 910 / メーター 1000)や壁の面、90°に「吸いつき」、それ以上動かせばなめらかに外れる。
import { WALL_T, wallLength, houseBounds, neighborAcross, edgeFrame, edgeName, normalizeRoom, isRect, resizeRect, translateRoom, insertVertex, removeVertex, chamferVertex, syncBounds, partBox, distSeg, nearestEdge, MODULES, mm, mmRaw, roomJo, shinShin, snapTo, gridCandidates, wallFaces, snapAngle, levelOf, baseOf, floorH, onLevel, hasUpper } from './house.js';
import { stairLayout, STAIR_KINDS, STAIR_STYLES, STAIR_CELLS, stairKindName } from './stairs.js';
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
    document.getElementById('plNiche').onclick = () => this.setTool(this.tool === 'niche' ? 'select' : 'niche');
    document.getElementById('plColumn').onclick = () => this.addPartHere('column');
    document.getElementById('plWing').onclick = () => this.addPartHere('wall');
    document.getElementById('plBeam').onclick = () => this.addPartHere('beam');
    document.getElementById('plDel').onclick = () => this.deleteSel();
    this.level = 0; for (const b of document.querySelectorAll('#plLevels button')) b.onclick = () => this.setLevel(+b.dataset.lv);
    document.getElementById('plStair').onclick = () => { const st = this.app.project.rooms.find(r => r.stair); if (st) { this.sel = { kind: 'room', room: st }; this.info(null); this.draw(); this.app.toast('階段を選びました。下の欄で種類を変えられます', 2200); } else { const r = this.app.addStair(); if (r) { this.sel = { kind: 'room', room: r }; this.fit(); this.info(null); this.draw(); } } };
    window.addEventListener('resize', () => { if (this.visible) this.draw(); });
  }
  grid() { return MODULES[this.app.module()] || MODULES.shaku; }
  setTool(t) { this.tool = t; for (const [id, name] of [['plDoor', 'door'], ['plWindow', 'window'], ['plVertex', 'vertex'], ['plNiche', 'niche']]) document.getElementById(id).classList.toggle('on', t === name); this.info(t === 'door' ? '壁をタップすると、そこにドアが付きます(となりの部屋ともつながります)' : t === 'window' ? '壁をタップすると、そこに窓が付きます' : t === 'niche' ? '壁をタップすると、そこにニッチ(壁のくぼみ)ができます' : t === 'vertex' ? '壁の線をタップすると、そこに角(曲がり目)ができます。角は引っぱって動かせます' : null); }
  show() { this.visible = true; this.level = this.app.walkLevel(); this.levelButtons(); this.fit(); this.draw(); }
  // 1階・2階の切りかえ(階段は両方の階に出る)
  setLevel(lv) { this.level = lv; if (this.sel && !onLevel(this.sel.room, lv)) { this.sel = null; } this.levelButtons(); this.info(null); this.draw(); }
  levelButtons() { const up = hasUpper(this.app.project.rooms) || this.app.project.rooms.some(r => r.stair); const el = document.getElementById('plLevels'); el.classList.toggle('hidden', !up); for (const b of el.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.lv === this.level); }
  visRooms() { return this.app.project.rooms.filter(r => onLevel(r, this.level)); }
  // 階段の部屋の開口は、その高さの階でだけ見せる
  opVis(r, o) { if (!r.stair) return true; const y = baseOf(r) + (o.type === 'window' ? (o.sill ?? 0.9) : (o.sill || 0)); return Math.floor((y + 0.3) / floorH()) === this.level; }
  hide() { this.visible = false; }
  fit() { const r = this.canvas.getBoundingClientRect(); const b = houseBounds(this.app.project.rooms); const w = b.maxX - b.minX + 2, h = b.maxZ - b.minZ + 2; this.scale = Math.min((r.width - 40) / w, (r.height * 0.5) / h, 120); this.ox = r.width / 2 - ((b.minX + b.maxX) / 2) * this.scale; this.oy = r.height * 0.42 - ((b.minZ + b.maxZ) / 2) * this.scale; }
  toPx(x, z) { return [x * this.scale + this.ox, z * this.scale + this.oy]; }
  toM(px, py) { return [(px - this.ox) / this.scale, (py - this.oy) / this.scale]; }
  zoomAt(px, py, k) { const r = this.canvas.getBoundingClientRect(); px -= r.left; py -= r.top; const [mx, mz] = this.toM(px, py); this.scale = Math.max(15, Math.min(400, this.scale * k)); this.ox = px - mx * this.scale; this.oy = py - mz * this.scale; this.draw(); }
  selRoom() { return this.sel ? this.sel.room : (this.app.currentRoom() || this.app.project.rooms[0]); }
  addPartHere(kind) { const r = this.selRoom(); if (!r) { this.app.toast('先に部屋を作ってください'); return; } const id = this.app.addPart(r, kind, { x: r.x + r.w / 2, z: r.z + r.d / 2 }); this.sel = { kind: 'part', room: r, part: r.parts.find(p => p.id === id) }; this.info(null); this.draw(); }
  tolM() { return 12 / this.scale; } // 吸いつく距離(画面で12px)

  // ---------- 吸いつき(スナップ) ----------
  snapCands(room, axis) { const g = this.grid().half; const out = []; for (const r of this.app.project.rooms) { const f = wallFaces(r); out.push(...(axis === 'x' ? f.xs : f.zs)); } return { out, g }; }
  snapCoord(v, room, axis, extra = []) { const { out, g } = this.snapCands(room, axis); return snapTo(v, [...out, ...extra, ...gridCandidates(v, g)], this.tolM()); }
  // 箱(柱型・梁)の位置:左右・上下どちらかの面が吸いつく
  snapBox(x, z, w, d, room) {
    const sx = this.snapCoord(x, room, 'x'), sx2 = this.snapCoord(x + w, room, 'x'); if (sx !== x) x = sx; else if (sx2 !== x + w) x = sx2 - w;
    const sz = this.snapCoord(z, room, 'z'), sz2 = this.snapCoord(z + d, room, 'z'); if (sz !== z) z = sz; else if (sz2 !== z + d) z = sz2 - d;
    return [x, z];
  }

  // ---------- 情報欄(寸法の表示と入力) ----------
  info(html) { const el = document.getElementById('planInfo'); if (html === null) { html = this.sel ? this.selInfo() : '部屋をタップすると選べます。引っぱると動きます。黄色の●(角)を引っぱると形が変わります。寸法はこの欄で直せます(mm)。'; } el.innerHTML = html; this.bindInfo(); document.getElementById('plModule').textContent = `${this.grid().name}・方眼 ${mm(this.grid().half)}mm`; }
  field(k, label, valueMm, step = 5) { return `<label>${label}<input type="number" step="${step}" data-k="${k}" value="${Math.round(valueMm)}"></label>`; }
  selInfo() {
    const s = this.sel; if (!s) return ''; const r = s.room;
    if (s.kind === 'room') {
      let dims = `<div class="dims">${isRect(r) ? this.field('rw', '横 芯々(mm)', mmRaw(shinShin(r.w))) + this.field('rd', '奥行 芯々(mm)', mmRaw(shinShin(r.d))) : ''}${r.stair ? '' : this.field('rh', '天井高(mm)', mmRaw(r.h), 10)}</div>`;
      if (!isRect(r)) dims += `<div class="dims">${r.poly.map((_, e) => this.field('e' + e, `${edgeName(r, e)} 内法`, mmRaw(wallLength(r, e)))).join('')}</div>`;
      return `<b>${r.name}</b> 内法 ${mm(r.w)}×${mm(r.d)}mm${isRect(r) ? `(芯々 ${mm(shinShin(r.w))}×${mm(shinShin(r.d))})` : ''}・約${roomJo(r)}帖・角${r.poly.length}つ${dims}<div class="row"><button data-act="rename">名前</button><button data-act="stand">👣 ここに立つ</button></div>${r.stair ? this.stairInfo(r) : this.roomTypeInfo(r)}`;
    }
    if (s.kind === 'vertex') { const [x, z] = r.poly[s.index]; return `<b>角</b>(${r.name})<div class="dims">${this.field('vx', '横の位置(mm)', mmRaw(x))}${this.field('vz', '奥行の位置(mm)', mmRaw(z))}</div><div class="row"><button data-act="chamfer">◢ この角を斜めに</button><button data-act="colhere">▮ ここに柱型</button><button data-act="delv" class="danger">角を消す</button></div>`; }
    if (s.kind === 'opening') { const o = s.opening; const nm = { window: '窓', door: (o.style === 'slide' || o.style === 'fusuma') ? '引き戸' : 'ドア', open: '出入り口(戸なし)', closet: '収納の戸', niche: 'ニッチ' }[o.type] || 'ドア'; const hasSill = o.type === 'window' || o.type === 'niche';
      return `<b>${nm}</b>(${r.name}の${edgeName(r, o.edge)})<div class="dims">${this.field('ow', '幅(mm)', mmRaw(o.w))}${this.field('oh', '高さ(mm)', mmRaw(o.h))}${hasSill ? this.field('os', '床から(mm)', mmRaw(o.sill ?? (o.type === 'niche' ? 1.0 : 0.9))) : ''}${o.type === 'niche' ? this.field('odp', '奥行(mm)', mmRaw(o.depth || 0.1)) : ''}${this.field('ou', '壁の左端から(mm)', mmRaw(o.u))}</div>${o.type === 'door' ? this.doorInfo(r, o) : o.type === 'closet' ? this.closetInfo(r, o) : o.type === 'window' ? this.bayInfo(o) : o.type === 'niche' ? '<div class="note">奥・左右・上は壁紙の巻き込み、下だけ板(左右20mm出し)</div>' : ''}`; }
    if (s.kind === 'part') { const p = s.part; const b = partBox(p); const name = { column: '柱型', wall: '袖壁(腰壁)', beam: '梁(下がり天井)' }[p.type];
      const dims = p.type === 'wall' ? this.field('pl', '長さ(mm)', mmRaw(b.L)) + this.field('pt', '厚み(mm)', mmRaw(p.t || WALL_T)) + this.field('ph', '高さ(mm)', mmRaw(p.h || r.h), 10)
        : p.type === 'beam' ? this.field('pw', '横(mm)', mmRaw(p.w)) + this.field('pd', '奥行(mm)', mmRaw(p.d)) + this.field('pdrop', '下がり(mm)', mmRaw(p.drop || .3), 10)
        : this.field('pw', '横(mm)', mmRaw(p.w)) + this.field('pd', '奥行(mm)', mmRaw(p.d));
      return `<b>${name}</b>(${r.name})<div class="dims">${dims}</div><div class="row">${p.type !== 'beam' ? '<button data-act="prot">⟳ 90°回す</button>' : ''}<button data-act="pdel" class="danger">消す</button></div>`; }
    return '';
  }
  // ドアの持ち主(実際のドアがある側)。となりの部屋から選んだときは、左右と内外が逆に見える
  doorOwner(room, o) { if (!o.twin) return { owner: o, flip: false }; for (const r of this.app.project.rooms) for (const t of (r.openings || [])) if (t.id === o.twin) return { owner: t, flip: true }; return { owner: o, flip: false }; }
  doorInfo(room, o) {
    const { owner, flip } = this.doorOwner(room, o); const swing = (owner.swing === 'out') !== flip ? 'out' : 'in'; const hinge = (owner.hinge === 'right') !== flip ? 'right' : 'left'; const open = owner.open ?? 0.9;
    const chip = (act, val, label, on) => `<button class="chip text${on ? ' on' : ''}" data-act="${act}" data-v="${val}">${label}</button>`;
    return `<div class="door-set"><div><span>開く向き</span>${chip('dswing', 'in', '内開き(この部屋へ)', swing === 'in')}${chip('dswing', 'out', '外開き(向こうへ)', swing === 'out')}</div>
      <div><span>丁番の位置</span>${chip('dhinge', 'left', '左', hinge === 'left')}${chip('dhinge', 'right', '右', hinge === 'right')}<small>この部屋の中から ドアを見て</small></div>
      <div><span>開き具合</span>${chip('dopen', '0', '閉める', open < 0.05)}${chip('dopen', '0.5', '半分', open > 0.3 && open < 0.7)}${chip('dopen', '1', '全開', open > 0.85)}</div></div>`;
  }
  // 収納の戸:折れ戸・引き違い・襖、開け閉め
  closetInfo(r, o) { const own = o.twin ? this.doorOwner(r, o).owner : o; const chip = (act, v, label, on) => `<button class="chip text${on ? ' on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`;
    return `<div class="lbl">戸の種類</div><div class="chips">${chip('cstyle', 'fold', '折れ戸', (own.style || 'fold') === 'fold')}${chip('cstyle', 'slide', '引き違い', own.style === 'slide')}${chip('cstyle', 'fusuma', '襖(ふすま)', own.style === 'fusuma')}</div><div class="chips">${chip('copen', '0', '閉める', !(own.open > 0.5))}${chip('copen', '1', '開ける', own.open > 0.5)}</div>`; }
  roomTypeInfo(r) { const chip = (v, label) => `<button class="chip text${(r.closet || '') === v ? ' on' : ''}" data-act="rtype" data-v="${v}">${label}</button>`;
    return `<div class="lbl">部屋の使い方</div><div class="chips">${chip('', 'ふつうの部屋')}${chip('cl', 'クローゼット')}${chip('wic', 'ウォークイン')}${chip('oshiire', '押入れ')}${chip('sic', 'シューズクローク')}${chip('storage', '納戸・物入れ')}</div>`; }
  bayInfo(o) { const chip = (v, label) => `<button class="chip text${(o.bay || 'none') === v ? ' on' : ''}" data-act="obay" data-v="${v}">${label}</button>`;
    return `<div class="door-set"><div><span>出窓</span>${chip('none', 'ふつうの窓')}${chip('trap', '台形の出窓')}${chip('box', '角(箱型)の出窓')}</div></div>${o.bay ? `<div class="dims">${this.field('obd', '出幅(mm)', mmRaw(o.bayDepth ?? (o.bay === 'trap' ? 0.23 : 0.45)))}</div>` : ''}`; }
  bindInfo() {
    const app = this.app, s = this.sel;
    const redo = () => { this.fixTwins(); app.rebuildHouse(); app.rebuildItems(); app.touched(); this.draw(); this.info(null); };
    for (const inp of document.querySelectorAll('#planInfo input[data-k]')) inp.onchange = () => {
      const v = parseFloat(inp.value); if (!Number.isFinite(v)) return; const m = v / 1000; const k = inp.dataset.k; app.snapshot();
      if (k === 'rw' || k === 'rd') { const w = k === 'rw' ? Math.max(0.6, m - WALL_T) : s.room.w, d = k === 'rd' ? Math.max(0.6, m - WALL_T) : s.room.d; resizeRect(s.room, w, d); this.clampOpenings(s.room); redo(); return; }
      if (k === 'fh') { app.project.settings.floorH = Math.max(2.4, Math.min(4, m)); app.load(app.project); app.setMode('plan'); return; }
      if (k === 'rh') { s.room.h = Math.max(1.8, m); for (const it of app.project.items) if (it.roomId === s.room.id && catalogEntry(it.type).kind === 'ceiling') it.y = s.room.h; redo(); return; }
      if (k[0] === 'e') { const e = parseInt(k.slice(1)); const f = edgeFrame(s.room, e); const n = s.room.poly.length; const B = s.room.poly[(e + 1) % n]; const L = Math.max(0.1, m); B[0] = f.A[0] + f.along.x * L; B[1] = f.A[1] + f.along.z * L; syncBounds(s.room); this.clampOpenings(s.room); redo(); return; }
      if (k === 'vx' || k === 'vz') { const p = s.room.poly[s.index]; if (k === 'vx') p[0] = m; else p[1] = m; syncBounds(s.room); this.clampOpenings(s.room); redo(); return; }
      if (k[0] === 'o') { const o = s.opening; const L = wallLength(s.room, o.edge); if (k === 'ow') o.w = Math.max(0.3, Math.min(L - 0.1, m)); if (k === 'oh') o.h = Math.max(0.3, Math.min(s.room.h - 0.05, m)); if (k === 'os') o.sill = Math.max(0, m); if (k === 'obd') o.bayDepth = Math.max(0.12, Math.min(0.9, m)); if (k === 'odp') o.depth = Math.max(0.03, Math.min(0.105, m)); if (k === 'ou') o.u = m; o.u = Math.max(0.05, Math.min(L - o.w - 0.05, o.u)); if ((o.type === 'window' || o.type === 'niche') && o.sill + o.h > s.room.h) o.sill = Math.max(0, s.room.h - o.h - 0.05); this.syncTwin(s.room, o); app.rebuildHouse(); app.touched(); this.draw(); this.info(null); return; }
      if (k[0] === 'p') { const p = s.part; if (k === 'pl') { const dx = p.x2 - p.x1, dz = p.z2 - p.z1; const l0 = Math.hypot(dx, dz) || 1; const L = Math.max(0.05, m); p.x2 = p.x1 + dx / l0 * L; p.z2 = p.z1 + dz / l0 * L; } if (k === 'pt') p.t = Math.max(0.03, m); if (k === 'ph') p.h = Math.max(0.2, Math.min(s.room.h, m)); if (k === 'pw') p.w = Math.max(0.05, m); if (k === 'pd') p.d = Math.max(0.05, m); if (k === 'pdrop') p.drop = Math.max(0.05, Math.min(s.room.h - 1.6, m)); app.rebuildHouse(); app.touched(); this.draw(); this.info(null); return; }
    };
    for (const b of document.querySelectorAll('#planInfo [data-act]')) b.onclick = async () => {
      const act = b.dataset.act;
      if (act === 'rename') { const n = prompt('部屋の名前', s.room.name); if (n) { s.room.name = n; app.touched(); this.draw(); this.info(null); } }
      if (act === 'stand') { const r = s.room; app.walk.floorY = r.stair ? baseOf(r) : baseOf(r); app.s3.camera.position.set(r.x + r.w / 2, app.walk.floorY + 1.5, r.z + r.d * 0.75); app.walk.yaw = 0; app.setMode('walk'); }
      if (act === 'cstyle' || act === 'copen') { const own = s.opening.twin ? this.doorOwner(s.room, s.opening).owner : s.opening; app.snapshot(); if (act === 'cstyle') own.style = b.dataset.v; else own.open = +b.dataset.v; app.rebuildHouse(); app.touched(); this.draw(); this.info(null); }
      if (act === 'rtype') { app.setRoomType(s.room, b.dataset.v); this.draw(); this.info(null); }
      if (act === 'skind' || act === 'sstyle' || act === 'sdir' || act === 'sflip' || act === 'sfit') { app.stairEdit(s.room, act, b.dataset.v); this.fit(); this.draw(); this.info(null); }
      if (act === 'chamfer') { app.snapshot(); const len = parseFloat(prompt('斜めにする長さ(mm)', '800')) / 1000; if (len > 0.05) { chamferVertex(s.room, s.index, len); this.sel = { kind: 'room', room: s.room }; redo(); } }
      if (act === 'colhere') { const [x, z] = s.room.poly[s.index]; app.addPart(s.room, 'column', { x, z }); this.sel = { kind: 'room', room: s.room }; this.draw(); this.info(null); }
      if (act === 'delv') { app.snapshot(); if (removeVertex(s.room, s.index)) { this.sel = { kind: 'room', room: s.room }; redo(); } else app.toast('角は3つより減らせません'); }
      if (act === 'obay') { const o = s.opening; app.snapshot(); const v = b.dataset.v; if (v === 'none') delete o.bay; else { o.bay = v; o.bayDepth = v === 'trap' ? 0.23 : 0.45; } app.rebuildHouse(); app.touched(); this.draw(); this.info(null); app.toast(v === 'none' ? 'ふつうの窓にしました' : '出窓にしました', 1500); }
      if (act === 'dswing' || act === 'dhinge' || act === 'dopen') { const { owner, flip } = this.doorOwner(s.room, s.opening); const v = b.dataset.v; app.snapshot();
        if (act === 'dswing') owner.swing = ((v === 'out') !== flip) ? 'out' : 'in';
        if (act === 'dhinge') owner.hinge = ((v === 'right') !== flip) ? 'right' : 'left';
        if (act === 'dopen') owner.open = parseFloat(v);
        app.rebuildHouse(); app.touched(); this.draw(); this.info(null); app.toast({ dswing: v === 'in' ? '内開きにしました' : '外開きにしました', dhinge: v === 'left' ? '丁番を左にしました' : '丁番を右にしました', dopen: v === '0' ? '閉めました' : v === '1' ? '全開にしました' : '半分開けました' }[act], 1500); }
      if (act === 'prot') { const p = s.part; app.snapshot(); if (p.type === 'wall') { const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2; const dx = p.x2 - p.x1, dz = p.z2 - p.z1; p.x1 = cx + dz / 2; p.z1 = cz - dx / 2; p.x2 = cx - dz / 2; p.z2 = cz + dx / 2; } else { const cx = p.x + p.w / 2, cz = p.z + p.d / 2; [p.w, p.d] = [p.d, p.w]; p.x = cx - p.w / 2; p.z = cz - p.d / 2; } app.rebuildHouse(); app.touched(); this.draw(); this.info(null); }
      if (act === 'pdel') this.deleteSel();
    };
  }
  clampOpenings(room) { room.openings = (room.openings || []).filter(o => { const L = wallLength(room, o.edge); if (o.u + o.w > L - 0.05) o.u = Math.max(0.05, L - o.w - 0.05); return o.u >= 0 && o.w < L; }); }
  syncTwin(room, o) { for (const r of this.app.project.rooms) for (const t of (r.openings || [])) if (t.twin === o.id || o.twin === t.id) { t.w = o.w; t.h = o.h; } }
  openingSeg(r, o) { const f = edgeFrame(r, o.edge); const a = f.origin.clone().addScaledVector(f.along, o.u), b = f.origin.clone().addScaledVector(f.along, o.u + o.w); return [a.x, a.z, b.x, b.z]; }

  // ---------- 当たり判定 ----------
  hit(px, py) {
    const [mx, mz] = this.toM(px, py), rooms = this.visRooms(), tol = 14 / this.scale;
    const selRoom = this.sel && this.sel.room;
    if (selRoom) for (let i = 0; i < selRoom.poly.length; i++) { const [x, z] = selRoom.poly[i]; if (Math.hypot(mx - x, mz - z) < tol * 1.2) return { kind: 'vertex', room: selRoom, index: i }; }
    if (selRoom) for (const p of selRoom.parts || []) if (p.type === 'wall') { if (Math.hypot(mx - p.x2, mz - p.z2) < tol) return { kind: 'wallend', room: selRoom, part: p, end: 2 }; if (Math.hypot(mx - p.x1, mz - p.z1) < tol) return { kind: 'wallend', room: selRoom, part: p, end: 1 }; }
    if (selRoom) for (const p of selRoom.parts || []) if (p.type !== 'wall' && Math.hypot(mx - (p.x + p.w), mz - (p.z + p.d)) < tol) return { kind: 'partcorner', room: selRoom, part: p };
    for (const r of rooms) for (const o of (r.openings || [])) { if (!this.opVis(r, o)) continue; const [x0, z0, x1, z1] = this.openingSeg(r, o); if (distSeg(mx, mz, x0, z0, x1, z1) < tol) return { kind: 'opening', room: r, opening: o }; }
    for (const r of rooms) for (const p of (r.parts || [])) { const b = partBox(p); const c = Math.cos(b.rot), s = Math.sin(b.rot); const dx = mx - b.cx, dz = mz - b.cz; const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) <= b.w / 2 + tol * .5 && Math.abs(lz) <= b.d / 2 + tol * .5) return { kind: 'part', room: r, part: p }; }
    for (const r of rooms) if (isRect(r) && Math.hypot(mx - (r.x + r.w), mz - (r.z + r.d)) < tol * 1.3) return { kind: 'corner', room: r };
    for (const r of rooms) for (let e = 0; e < r.poly.length; e++) { const f = edgeFrame(r, e); const d = distSeg(mx, mz, f.A[0], f.A[1], f.B[0], f.B[1]); if (d < tol) { const u = (mx - f.A[0]) * f.along.x + (mz - f.A[1]) * f.along.z; return { kind: 'wall', room: r, edge: e, u: Math.max(0, Math.min(f.L, u)) }; } }
    for (const r of rooms) if (pointIn(mx, mz, r.poly)) return { kind: 'room', room: r };
    return null;
  }
  down(e) {
    try { this.canvas.setPointerCapture(e.pointerId); } catch {} const rect = this.canvas.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; this.pointers.set(e.pointerId, { x: px, y: py });
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ox: this.ox, oy: this.oy }; this.drag = null; return; }
    const h = this.hit(px, py); const app = this.app;
    if (this.tool === 'niche') { if (h && h.kind === 'wall') { const L = wallLength(h.room, h.edge); if (L < 0.6) { app.toast('この壁は短すぎます'); return; } const w = 0.35; const u = Math.max(0.1, Math.min(L - w - 0.1, h.u - w / 2)); const o = app.addOpening(h.room, { edge: h.edge, type: 'niche', u, w, h: 0.5, sill: 1.0, depth: 0.1 }); this.sel = { kind: 'opening', room: h.room, opening: o }; this.setTool('select'); this.info(null); this.draw(); } else app.toast('壁の線をタップしてください'); return; }
    if (this.tool === 'door' || this.tool === 'window') { if (h && (h.kind === 'wall' || h.kind === 'opening')) { if (h.kind === 'opening') { this.sel = h; this.info(null); this.draw(); return; } const w = this.tool === 'door' ? 0.8 : 1.65, L = wallLength(h.room, h.edge); if (L < w + 0.3) { app.toast('この壁は短すぎます'); return; } const u = Math.max(0.1, Math.min(L - w - 0.1, h.u - w / 2)); const o = app.addOpening(h.room, { edge: h.edge, type: this.tool, u, w, h: this.tool === 'door' ? 2.0 : (L > 2.5 ? 1.8 : 1.1), sill: this.tool === 'window' ? (L > 2.5 ? 0.4 : 0.9) : 0, open: 0.9 }); this.sel = { kind: 'opening', room: h.room, opening: o }; this.setTool('select'); this.info(null); this.draw(); } else app.toast('壁の線をタップしてください'); return; }
    if (this.tool === 'vertex') { if (h && h.kind === 'wall') { app.snapshot(); const f = edgeFrame(h.room, h.edge); const x = f.A[0] + f.along.x * h.u, z = f.A[1] + f.along.z * h.u; insertVertex(h.room, h.edge, Math.round(x * 1000) / 1000, Math.round(z * 1000) / 1000); this.sel = { kind: 'vertex', room: h.room, index: h.edge + 1 }; this.setTool('select'); this.fixTwins(); app.rebuildHouse(); app.touched(); this.info(null); this.draw(); } else app.toast('壁の線をタップしてください'); return; }
    if (h && h.kind === 'vertex') { this.sel = h; app.snapshot(); this.drag = { kind: 'vertex', room: h.room, index: h.index, sx: px, sy: py, p0: [...h.room.poly[h.index]] }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'wallend') { this.sel = { kind: 'part', room: h.room, part: h.part }; app.snapshot(); this.drag = { kind: 'wallend', room: h.room, part: h.part, end: h.end, sx: px, sy: py, p0: h.end === 2 ? [h.part.x2, h.part.z2] : [h.part.x1, h.part.z1] }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'partcorner') { this.sel = { kind: 'part', room: h.room, part: h.part }; app.snapshot(); this.drag = { kind: 'partcorner', room: h.room, part: h.part, sx: px, sy: py, w0: h.part.w, d0: h.part.d }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'part') { this.sel = h; app.snapshot(); const p = h.part; this.drag = { kind: 'part', room: h.room, part: p, sx: px, sy: py, p0: p.type === 'wall' ? [p.x1, p.z1, p.x2, p.z2] : [p.x, p.z], moved: false }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'corner') { this.sel = { kind: 'room', room: h.room }; app.snapshot(); this.drag = { kind: 'resize', room: h.room, sx: px, sy: py, w0: h.room.w, d0: h.room.d }; this.info(null); this.draw(); return; }
    if (h && h.kind === 'opening') { this.sel = h; app.snapshot(); this.drag = { kind: 'opening', room: h.room, opening: h.opening, sx: px, sy: py, u0: h.opening.u }; this.info(null); this.draw(); return; }
    if (h && (h.kind === 'room' || h.kind === 'wall')) { this.sel = { kind: 'room', room: h.room }; this.drag = { kind: 'room', room: h.room, sx: px, sy: py, x0: h.room.x, z0: h.room.z, lastX: h.room.x, lastZ: h.room.z, moved: false }; this.info(null); this.draw(); return; }
    this.sel = null; this.drag = { kind: 'pan', sx: px, sy: py, ox: this.ox, oy: this.oy }; this.info(null); this.draw();
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return; const rect = this.canvas.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; this.pointers.set(e.pointerId, { x: px, y: py });
    if (this.pointers.size === 2 && this.pinch) { const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const k = d / this.pinch.d; const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; const [mx, mz] = [(this.pinch.cx - this.pinch.ox) / this.pinch.scale, (this.pinch.cy - this.pinch.oy) / this.pinch.scale]; this.scale = Math.max(15, Math.min(400, this.pinch.scale * k)); this.ox = cx - mx * this.scale; this.oy = cy - mz * this.scale; this.draw(); return; }
    const d = this.drag; if (!d) return; const dx = (px - d.sx) / this.scale, dz = (py - d.sy) / this.scale; const r1 = v => Math.round(v * 1000) / 1000; const tol = this.tolM();
    if (d.kind === 'pan') { this.ox = d.ox + (px - d.sx); this.oy = d.oy + (py - d.sy); this.draw(); return; }
    if (d.kind === 'vertex') { const r = d.room; const n = r.poly.length, A = r.poly[(d.index - 1 + n) % n], B = r.poly[(d.index + 1) % n];
      // 吸いつき:となりの角と まっすぐ(90°)、壁の面、グリッド
      let nx = this.snapCoord(r1(d.p0[0] + dx), r, 'x', [A[0], B[0]]), nz = this.snapCoord(r1(d.p0[1] + dz), r, 'z', [A[1], B[1]]);
      r.poly[d.index] = [nx, nz]; syncBounds(r); this.draw(); return; }
    if (d.kind === 'wallend') { const p = d.part; const fixed = d.end === 2 ? [p.x1, p.z1] : [p.x2, p.z2]; let nx = r1(d.p0[0] + dx), nz = r1(d.p0[1] + dz);
      // 角度:いちばん近い壁に対して 0/90/180/270° に吸いつく。長さは 5mm きざみ、壁の面に届きそうなら面まで
      const ne = nearestEdge(d.room, { x: fixed[0], z: fixed[1] }); const f = edgeFrame(d.room, ne); const base = Math.atan2(-(f.along.z), f.along.x); let ang = Math.atan2(-(nz - fixed[1]), nx - fixed[0]); const len0 = Math.hypot(nx - fixed[0], nz - fixed[1]); const snapped = snapAngle(ang, base, 7); const snappedNow = snapped !== ang; ang = snapped; let len = Math.round(len0 * 200) / 200;
      nx = fixed[0] + Math.cos(ang) * len; nz = fixed[1] - Math.sin(ang) * len;
      if (snappedNow) { const ax = Math.abs(Math.cos(ang)) > 0.5; const sv = ax ? this.snapCoord(nx, d.room, 'x') : this.snapCoord(nz, d.room, 'z'); if (ax && sv !== nx) nx = sv; if (!ax && sv !== nz) nz = sv; }
      if (d.end === 2) { p.x2 = nx; p.z2 = nz; } else { p.x1 = nx; p.z1 = nz; } this.draw(); return; }
    if (d.kind === 'partcorner') { const p = d.part; let x2 = this.snapCoord(r1(p.x + d.w0 + dx), d.room, 'x'), z2 = this.snapCoord(r1(p.z + d.d0 + dz), d.room, 'z'); p.w = Math.max(0.05, x2 - p.x); p.d = Math.max(0.05, z2 - p.z); this.draw(); return; }
    if (d.kind === 'part') { const p = d.part; if (Math.hypot(px - d.sx, py - d.sy) > 4) d.moved = true; if (!d.moved) return;
      if (p.type === 'wall') { let x1 = r1(d.p0[0] + dx), z1 = r1(d.p0[1] + dz); const sx = this.snapCoord(x1, d.room, 'x'), sz = this.snapCoord(z1, d.room, 'z'); const vx = d.p0[2] - d.p0[0], vz = d.p0[3] - d.p0[1]; x1 = sx; z1 = sz; p.x1 = x1; p.z1 = z1; p.x2 = x1 + vx; p.z2 = z1 + vz; }
      else { const [x, z] = this.snapBox(r1(d.p0[0] + dx), r1(d.p0[1] + dz), p.w, p.d, d.room); p.x = x; p.z = z; }
      this.draw(); return; }
    if (d.kind === 'room') { if (Math.hypot(px - d.sx, py - d.sy) > 6) d.moved = true; if (!d.moved) return; let nx = r1(d.x0 + dx), nz = r1(d.z0 + dz); const r = d.room; const g = this.grid().half;
      const cx = [], cz = []; for (const o of this.app.project.rooms) { if (o === r) continue; cx.push(o.x + o.w + WALL_T, o.x - r.w - WALL_T, o.x, o.x + o.w - r.w); cz.push(o.z + o.d + WALL_T, o.z - r.d - WALL_T, o.z, o.z + o.d - r.d); }
      nx = snapTo(nx, [...cx, ...gridCandidates(nx, g)], tol); nz = snapTo(nz, [...cz, ...gridCandidates(nz, g)], tol);
      const ddx = nx - d.lastX, ddz = nz - d.lastZ; if (ddx || ddz) { translateRoom(r, ddx, ddz); d.lastX = nx; d.lastZ = nz; for (const it of this.app.project.items) if (it.roomId === r.id) { it.x += ddx; it.z += ddz; } } this.draw(); return; }
    if (d.kind === 'resize') { const r = d.room; const w = this.snapCoord(r1(r.x + d.w0 + dx), r, 'x') - r.x, dd = this.snapCoord(r1(r.z + d.d0 + dz), r, 'z') - r.z; resizeRect(r, Math.max(0.6, w), Math.max(0.6, dd)); this.draw(); return; }
    if (d.kind === 'opening') { const o = d.opening, r = d.room; const f = edgeFrame(r, o.edge); const delta = dx * f.along.x + dz * f.along.z; let u = r1(d.u0 + delta);
      // 開口の端が 芯のグリッドに吸いつく(まっすぐな壁のとき)
      const ax = Math.abs(f.along.x) > 0.95 ? 'x' : Math.abs(f.along.z) > 0.95 ? 'z' : null; if (ax) { const g = this.grid().half; const c0 = ax === 'x' ? f.A[0] : f.A[1]; const dir = ax === 'x' ? f.along.x : f.along.z; const w1 = c0 + dir * u, w2 = c0 + dir * (u + o.w); const cands = v => [...gridCandidates(v, g), ...gridCandidates(v + WALL_T / 2, g).map(c => c - WALL_T / 2)]; const s1 = snapTo(w1, cands(w1), tol), s2 = snapTo(w2, cands(w2), tol); if (s1 !== w1) u = (s1 - c0) / dir; else if (s2 !== w2) u = (s2 - c0) / dir - o.w; }
      o.u = Math.max(0.05, Math.min(f.L - o.w - 0.05, u)); this.draw(); return; }
  }
  up(e) {
    this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = null; const d = this.drag; this.drag = null; if (!d) return; const app = this.app;
    const redo = () => { this.fixTwins(); app.rebuildHouse(); app.rebuildItems(); app.touched(); this.info(null); this.draw(); };
    if (d.kind === 'room' && d.moved) redo();
    if (d.kind === 'resize') { this.clampOpenings(d.room); for (const it of app.project.items) if (it.roomId === d.room.id) { const r = d.room; it.x = Math.min(r.x + r.w - 0.1, it.x); it.z = Math.min(r.z + r.d - 0.1, it.z); } redo(); }
    if (d.kind === 'vertex') { this.clampOpenings(d.room); redo(); }
    if (d.kind === 'wallend' || d.kind === 'partcorner' || (d.kind === 'part' && d.moved)) { app.rebuildHouse(); app.touched(); this.info(null); this.draw(); }
    if (d.kind === 'opening') { const o = d.opening; for (const r of app.project.rooms) for (const t of (r.openings || [])) if (t.twin === o.id) { const nb = neighborAcross(d.room, o.edge, o.u, o.w, [r]); if (nb) t.u = nb.u; } app.rebuildHouse(); app.touched(); this.info(null); }
  }
  fixTwins() {
    const rooms = this.app.project.rooms; for (const r of rooms) normalizeRoom(r);
    for (const r of rooms) r.openings = (r.openings || []).filter(o => !o.twin);
    for (const r of rooms) for (const o of (r.openings || [])) { if (o.type !== 'door' && o.type !== 'open' && o.type !== 'closet') continue; const y = baseOf(r) + (o.sill || 0); const nb = neighborAcross(r, o.edge, o.u, o.w, rooms, { y }); if (nb) { const t = { id: 't' + o.id, edge: nb.edge, type: o.type, u: nb.u, w: o.w, h: o.h, twin: o.id }; const sl = y - baseOf(nb.room); if (sl > 0.05) t.sill = sl; nb.room.openings.push(t); } }
  }
  deleteSel() {
    const s = this.sel; if (!s) { this.app.toast('消すものを先にタップしてください'); return; } const app = this.app;
    if (s.kind === 'opening') { app.removeOpening(s.room, s.opening.id); this.sel = null; this.info(null); this.draw(); return; }
    if (s.kind === 'part') { app.snapshot(); s.room.parts = s.room.parts.filter(p => p !== s.part); app.rebuildHouse(); app.touched(); this.sel = { kind: 'room', room: s.room }; this.info(null); this.draw(); return; }
    if (s.kind === 'vertex') { app.snapshot(); if (removeVertex(s.room, s.index)) { this.sel = { kind: 'room', room: s.room }; this.fixTwins(); app.rebuildHouse(); app.touched(); this.info(null); this.draw(); } else app.toast('角は3つより減らせません'); return; }
    if (s.kind === 'room') { if (!confirm(`${s.room.name}を消しますか?(中のものも消えます)`)) return; app.snapshot(); const p = app.project; p.rooms = p.rooms.filter(r => r !== s.room); p.items = p.items.filter(i => i.roomId !== s.room.id); this.fixTwins(); this.sel = null; app.load(p); app.setMode('plan'); }
  }

  // 階段:段の線と、上る向きの矢印
  drawStair(g, r) {
    const L = stairLayout(r, floorH()); const s = this.scale; g.save(); g.lineWidth = 1;
    for (const st of L.steps) { if (st.k === 0) continue; g.beginPath(); st.pts.forEach(([x, z], i) => { const [px, pz] = this.toPx(x, z); i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.closePath(); g.fillStyle = `rgba(201,160,106,${0.18 + 0.5 * st.k / L.n})`; g.fill(); g.strokeStyle = 'rgba(255,255,255,.45)'; g.stroke(); }
    const cs = L.steps.filter(st => st.k > 0 && st.k < L.n).map(st => { let x = 0, z = 0; for (const p of st.pts) { x += p[0]; z += p[1]; } return this.toPx(x / st.pts.length, z / st.pts.length); });
    if (cs.length > 1) { g.strokeStyle = '#ffcf4d'; g.lineWidth = 2; g.beginPath(); cs.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); const [ax, ay] = cs[cs.length - 1], [bx, by] = cs[cs.length - 2]; const a = Math.atan2(ay - by, ax - bx); g.fillStyle = '#ffcf4d'; g.beginPath(); g.moveTo(ax + Math.cos(a) * 8, ay + Math.sin(a) * 8); g.lineTo(ax + Math.cos(a + 2.5) * 8, ay + Math.sin(a + 2.5) * 8); g.lineTo(ax + Math.cos(a - 2.5) * 8, ay + Math.sin(a - 2.5) * 8); g.closePath(); g.fill(); const [sx, sy] = cs[0]; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('上り', sx, sy + 4); }
    g.restore();
  }
  stairInfo(r) {
    const st = r.stair, L = stairLayout(r, floorH()); const chip = (act, v, label, on) => `<button class="chip text${on ? ' on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`;
    const kinds = STAIR_KINDS.map(([k, n]) => chip('skind', k, n, (st.kind || 'u_winder') === k)).join(''); const styles = STAIR_STYLES.map(([k, n]) => chip('sstyle', k, n, (st.style || 'box') === k)).join('');
    const cells = STAIR_CELLS[st.kind || 'u_winder'], G = this.grid().grid; const rec = `${mm(cells[0] * G)}×${mm(cells[1] * G)}`;
    const warn = L.warn.length ? `<div class="warn">⚠ ${L.warn.join('・')}(この広さだと急です。<button data-act="sfit">おすすめの広さ ${rec} にする</button>)</div>` : '';
    return `<div class="stair-info"><div class="lbl">階段の形</div><div class="chips">${kinds}</div><div class="lbl">つくり</div><div class="chips">${styles}</div>
      <div class="row"><button data-act="sdir">↻ 上る向きを回す</button><button data-act="sflip">⇆ 左右を反対に</button></div>
      <div class="note">1段の高さ ${mm(L.rise)}mm × ${L.n}段・足をのせる奥行き ${L.kind === 'spiral' ? '内側から300mmの所で' : 'いちばん狭い所'} ${mm(L.tread)}mm・幅 ${mm(L.width)}mm</div>${warn}
      <div class="dims">${this.field('fh', '階の高さ 1階の床→2階の床(mm)', mmRaw(floorH()), 10)}</div></div>`;
  }
  // ---------- 描画 ----------
  dimLabel(g, x, y, text, bg = 'rgba(0,0,0,.6)') { g.font = '11px sans-serif'; const w = g.measureText(text).width + 8; g.fillStyle = bg; g.fillRect(x - w / 2, y - 8, w, 16); g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y); g.textBaseline = 'alphabetic'; }
  draw() {
    const c = this.canvas, g = this.ctx, rect = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) { c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#1b1e26'; g.fillRect(0, 0, rect.width, rect.height);
    // 方眼(芯のグリッド:半グリッドは薄く、1グリッドは濃く)
    const G = this.grid(); const half = G.half; const off = -WALL_T / 2; const [mx0, mz0] = this.toM(0, 0), [mx1, mz1] = this.toM(rect.width, rect.height);
    if (half * this.scale > 6) { for (let k = Math.floor((mx0 - off) / half); k * half + off <= mx1; k++) { const major = Math.abs((k * half) / G.grid - Math.round((k * half) / G.grid)) < 1e-6; g.strokeStyle = major ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.05)'; g.lineWidth = 1; const [px] = this.toPx(k * half + off, 0); g.beginPath(); g.moveTo(px, 0); g.lineTo(px, rect.height); g.stroke(); }
      for (let k = Math.floor((mz0 - off) / half); k * half + off <= mz1; k++) { const major = Math.abs((k * half) / G.grid - Math.round((k * half) / G.grid)) < 1e-6; g.strokeStyle = major ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.05)'; g.lineWidth = 1; const [, pz] = this.toPx(0, k * half + off); g.beginPath(); g.moveTo(0, pz); g.lineTo(rect.width, pz); g.stroke(); } }
    const rooms = this.visRooms(), s = this.scale;
    // ほかの階の部屋は、うすい点線で(上下をそろえる目安)
    if (hasUpper(this.app.project.rooms)) for (const r of this.app.project.rooms) { if (onLevel(r, this.level)) continue; g.beginPath(); r.poly.forEach(([x, z], i) => { const [px, pz] = this.toPx(x, z); if (i === 0) g.moveTo(px, pz); else g.lineTo(px, pz); }); g.closePath(); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.stroke(); g.setLineDash([]); }
    for (const r of rooms) {
      normalizeRoom(r); const selected = this.sel && this.sel.room === r; const path = () => { g.beginPath(); r.poly.forEach(([x, z], i) => { const [px, pz] = this.toPx(x, z); if (i === 0) g.moveTo(px, pz); else g.lineTo(px, pz); }); g.closePath(); };
      path(); g.fillStyle = selected ? '#3a3f55' : r.closet ? '#30283a' : '#2a2e3a'; g.fill();
      if (r.closet) { g.save(); path(); g.clip(); g.strokeStyle = 'rgba(199,166,242,.25)'; g.lineWidth = 1; const b0 = this.toPx(r.x, r.z), b1 = this.toPx(r.x + r.w, r.z + r.d); for (let k = b0[0] - (b1[1] - b0[1]); k < b1[0]; k += 8) { g.beginPath(); g.moveTo(k, b1[1]); g.lineTo(k + (b1[1] - b0[1]), b0[1]); g.stroke(); } g.restore(); }
      if (r.stair) this.drawStair(g, r);
      path(); g.strokeStyle = '#e8e8e8'; g.lineWidth = Math.max(3, WALL_T * s); g.lineJoin = 'miter'; g.stroke();
      for (const it of this.app.project.items) { if (it.roomId !== r.id) continue; const e = catalogEntry(it.type); if (!e) continue; const [ix, iz] = this.toPx(it.x, it.z); g.save(); g.translate(ix, iz); g.rotate(-(it.rot || 0)); g.fillStyle = e.cat === '照明' ? 'rgba(255,220,120,.7)' : e.kind === 'wall' ? 'rgba(120,180,255,.7)' : 'rgba(200,200,200,.45)'; const iw = it.w * s, id = (e.kind === 'wall' ? 0.08 : it.d) * s; g.fillRect(-iw / 2, e.kind === 'wall' ? 0 : -id / 2, iw, id); g.restore(); }
      for (const p of (r.parts || [])) { const b = partBox(p); const [cx, cz] = this.toPx(b.cx, b.cz); const psel = this.sel && this.sel.kind === 'part' && this.sel.part === p; g.save(); g.translate(cx, cz); g.rotate(-b.rot); if (p.type === 'beam') { g.setLineDash([6, 4]); g.strokeStyle = psel ? '#ffcf4d' : 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.strokeRect(-b.w * s / 2, -b.d * s / 2, b.w * s, b.d * s); g.setLineDash([]); } else { g.fillStyle = psel ? '#ffcf4d' : '#e8e8e8'; g.fillRect(-b.w * s / 2, -b.d * s / 2, b.w * s, b.d * s); } g.restore();
        if (selected) { if (p.type === 'wall') { for (const [x, z] of [[p.x1, p.z1], [p.x2, p.z2]]) { const [hx, hz] = this.toPx(x, z); g.fillStyle = '#ffcf4d'; g.beginPath(); g.arc(hx, hz, 6, 0, 7); g.fill(); } } else { const [hx, hz] = this.toPx(p.x + p.w, p.z + p.d); g.fillStyle = '#ffcf4d'; g.fillRect(hx - 5, hz - 5, 10, 10); } }
        if (psel) { if (p.type === 'wall') { this.dimLabel(g, cx, cz - 14, `${mm(b.L)} × 厚${mm(p.t || WALL_T)}`); } else { this.dimLabel(g, cx, cz - b.d * s / 2 - 10, mm(p.w)); this.dimLabel(g, cx + b.w * s / 2 + 22, cz, mm(p.d)); } } }
      for (const o of (r.openings || [])) { if (!this.opVis(r, o)) continue; const [x0, z0, x1, z1] = this.openingSeg(r, o); const [ax, ay] = this.toPx(x0, z0), [bx, by] = this.toPx(x1, z1); const osel = this.sel && this.sel.kind === 'opening' && this.sel.opening === o; if (o.type === 'niche') { const f = edgeFrame(r, o.edge); const dd = (o.depth || 0.1) * s; g.fillStyle = osel ? '#ffcf4d' : '#9fdc9a'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(bx - f.normal.x * dd, by - f.normal.z * dd); g.lineTo(ax - f.normal.x * dd, ay - f.normal.z * dd); g.closePath(); g.fill(); continue; }
        g.strokeStyle = osel ? '#ffcf4d' : o.type === 'window' ? '#7fc4ff' : o.type === 'closet' ? '#c7a6f2' : '#c9955a'; g.lineWidth = Math.max(4, WALL_T * s + 2); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        if (o.type === 'door' && !o.twin && (o.style === 'slide' || o.style === 'fusuma')) { const f = edgeFrame(r, o.edge); const off = 4; g.strokeStyle = osel ? '#ffcf4d' : '#e3c08f'; g.lineWidth = 2; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(ax + f.normal.x * off * k, ay + f.normal.z * off * k); g.lineTo(bx + f.normal.x * off * k, by + f.normal.z * off * k); g.stroke(); } }
        else if (o.type === 'door' && !o.twin) { const f = edgeFrame(r, o.edge); const right = o.hinge === 'right', out = o.swing === 'out'; const [hx, hy] = right ? [bx, by] : [ax, ay]; const cd = right ? [-f.along.x, -f.along.z] : [f.along.x, f.along.z]; const nd = out ? [-f.normal.x, -f.normal.z] : [f.normal.x, f.normal.z]; const rr = o.w * s; const sA = Math.atan2(cd[1], cd[0]), sN = Math.atan2(nd[1], nd[0]); const acw = ((sN - sA + Math.PI * 4) % (Math.PI * 2)) > Math.PI;
          g.strokeStyle = osel ? '#ffcf4d' : 'rgba(201,149,90,.8)'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.arc(hx, hy, rr, sA, sN, acw); g.stroke(); g.setLineDash([]);
          const t = (o.open ?? 0.9) * Math.PI / 2; const lx = cd[0] * Math.cos(t) + nd[0] * Math.sin(t), lz = cd[1] * Math.cos(t) + nd[1] * Math.sin(t); g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + lx * rr, hy + lz * rr); g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(hx, hy, 3.5, 0, 7); g.fill(); }
        if (o.bay) { const f = edgeFrame(r, o.edge); const bd = o.bayDepth ?? (o.bay === 'trap' ? 0.23 : 0.45); const D = bd + WALL_T, wf = o.bay === 'trap' ? Math.max(0.4, o.w - 2 * bd) : o.w; const c0 = o.u + o.w / 2; const P = (u, out) => { const q = f.origin.clone().addScaledVector(f.along, u).addScaledVector(f.normal, -out); return this.toPx(q.x, q.z); }; const pts = [P(o.u, WALL_T), P(c0 - wf / 2, D), P(c0 + wf / 2, D), P(o.u + o.w, WALL_T)]; g.strokeStyle = osel ? '#ffcf4d' : '#7fc4ff'; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
        if (osel) { const f = edgeFrame(r, o.edge); const [lx, lz] = this.toPx((x0 + x1) / 2 + f.normal.x * 0.3, (z0 + z1) / 2 + f.normal.z * 0.3); this.dimLabel(g, lx, lz, `幅 ${mm(o.w)}`); } }
      // 選んでいる部屋:角と、各辺の内法寸法
      if (selected) { for (let e = 0; e < r.poly.length; e++) { const f = edgeFrame(r, e); if (f.L * s < 28) continue; const [lx, lz] = this.toPx(f.A[0] + f.along.x * f.L / 2 + f.normal.x * (14 / s), f.A[1] + f.along.z * f.L / 2 + f.normal.z * (14 / s)); this.dimLabel(g, lx, lz, mm(f.L), 'rgba(0,0,0,.45)'); }
        for (let i = 0; i < r.poly.length; i++) { const [x, z] = r.poly[i]; const [hx, hz] = this.toPx(x, z); const vsel = this.sel.kind === 'vertex' && this.sel.index === i; g.fillStyle = vsel ? '#fff' : '#ffcf4d'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hz, vsel ? 9 : 7, 0, 7); g.fill(); g.stroke(); } }
      const [cxm, czm] = polyCenter(r.poly); const [x, y] = this.toPx(cxm, czm); g.fillStyle = '#fff'; g.font = `bold ${Math.max(12, Math.min(18, s * 0.25))}px sans-serif`; g.textAlign = 'center'; const small = Math.min(r.w, r.d) * s < 80; if (small) g.font = `bold ${Math.max(10, Math.min(13, s * 0.2))}px sans-serif`; { const maxW = r.w * s - 6; let fs = parseFloat(g.font) || 12; while (fs > 8 && g.measureText(r.name).width > maxW) { fs -= 1; g.font = `bold ${fs}px sans-serif`; } } g.fillText(r.name, x, y); if (!small || selected) { g.font = `${Math.max(10, Math.min(13, s * 0.2))}px sans-serif`; g.fillStyle = '#c9cdd8'; g.fillText(`${mm(r.w)}×${mm(r.d)}・約${roomJo(r)}帖`, x, y + 16); }
      if (selected && isRect(r)) { const [hx, hz] = this.toPx(r.x + r.w, r.z + r.d); g.fillStyle = '#ffcf4d'; g.fillRect(hx - 8, hz - 8, 16, 16); }
    }
    const cam = this.app.s3.camera.position, [cx, cy] = this.toPx(cam.x, cam.z), yaw = this.app.walk.yaw; if (this.app.walkLevel() === this.level) { g.save(); g.translate(cx, cy); g.rotate(-yaw); g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = '#9aa0ae'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(`↑ 奥(北)  寸法は内法(うちのり)mm${hasUpper(this.app.project.rooms) ? (this.level ? '  ・2階' : '  ・1階') : ''}`, 12, 100);
  }
}
function pointIn(px, pz, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / ((zj - zi) || 1e-12) + xi)) inside = !inside; } return inside; }
function polyCenter(poly) { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; }
