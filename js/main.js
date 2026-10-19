// おへや3D 本体:画面と3Dをつなぐ
import * as THREE from 'three';
import { Scene3D } from './scene3d.js';
import { WalkControls } from './controls.js';
import { buildHouse, walkable, roomAt, houseBounds, edgeFrame, wallPoint, wallUV, wallLength, edgeName, edgeForCompass, nearestEdge, edgeDistance, frameFromRot, clampIntoRoom, insideRoom, neighborAcross, normalizeRoom, shapePoly, chamferVertex, isRect, resizeRect, WALL_T } from './house.js';
import { CATALOG, CATEGORIES, newItem, buildItem, catalogEntry, typeByWord } from './items.js';
import { SURFACE_LIB, COLORS, colorByName, swatchCanvas, clearMaterialCache, libEntry } from './textures.js';
import { demoProject } from './demo.js';
import { saveProject, loadProject, listProjects, deleteProject, download, shareOrDownload } from './store.js';
import { parseCommand } from './commands.js';
import { openPhotoWizard } from './photo.js';
import { PlanEditor } from './plan.js';
import * as AI from './ai.js';
import { thumbnail } from './thumbs.js';

const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => 'o' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

class App {
  constructor() {
    this.canvas = $('#gl'); this.s3 = new Scene3D(this.canvas);
    this.project = null; this.selectedId = null; this.pin = null; this.mode = 'walk'; this.dirty = false; this.itemGroups = new Map(); this.currentRoomId = null;
    this.walk = new WalkControls(this.s3.camera, this.canvas, { canWalk: p => this.project ? walkable(p, this.project.rooms) : true, onTap: (x, y, e) => this.onTap(x, y, e), joyEl: $('#joy'), knobEl: $('#joyKnob'),
      hitTest: (x, y) => { const h = this.hitAt(x, y); return h && h.itemId ? { itemId: h.itemId, selected: h.itemId === this.selectedId } : null; }, onDragItem: (ph, e, h) => this.dragItem(ph, e, h) });
    this.plan = new PlanEditor(this, $('#planCanvas'));
    this.selHelper = new THREE.Box3Helper(new THREE.Box3(), 0xffcf4d); this.selHelper.visible = false; this.s3.helperGroup.add(this.selHelper);
    this.pinMesh = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.09, 24), new THREE.MeshBasicMaterial({ color: 0xffcf4d, side: THREE.DoubleSide, depthTest: false })); this.pinMesh.visible = false; this.pinMesh.renderOrder = 10; this.s3.helperGroup.add(this.pinMesh);
    this.s3.onFrame = dt => this.frame(dt);
    this.bindUI(); this.initStart();
    window.app = this;
  }
  // ---------- 画面の部品 ----------
  toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.add('hidden'), ms); }
  dialog(html, buttons) { return new Promise(res => { const d = $('#dialog'); $('#dialogBody').innerHTML = html; const b = $('#dialogBtns'); b.innerHTML = ''; for (const btn of buttons) { const el = document.createElement('button'); el.textContent = btn.label; if (btn.primary) el.className = 'primary'; if (btn.danger) el.className = 'danger'; el.onclick = () => { d.classList.add('hidden'); res(btn.value !== undefined ? btn.value : btn.label); }; b.appendChild(el); } d.classList.remove('hidden'); }); }
  openSheet(id) { for (const s of $$('.sheet')) if (s.id !== id) s.classList.add('hidden'); $('#' + id).classList.remove('hidden'); }
  closeSheets() { for (const s of $$('.sheet')) s.classList.add('hidden'); }
  bindUI() {
    for (const b of $$('[data-close]')) b.onclick = () => $('#' + b.dataset.close).classList.add('hidden');
    for (const b of $$('#modes .mode')) b.onclick = () => this.setMode(b.dataset.mode);
    $('#btnHome').onclick = () => { $('#start').classList.remove('hidden'); this.refreshContinue(); };
    $('#btnMenu').onclick = () => this.openSheet('menu'); $('#btnUndo').onclick = () => this.undo();
    $('#btnAdd').onclick = () => this.openCatalog();
    $('#btnPhoto').onclick = () => { this.closeSheets(); openPhotoWizard(this); };
    $('#btnMaterial').onclick = () => this.openSurfaces();
    $('#btnDayNight').onclick = () => this.setDaytime({ day: 'evening', evening: 'night', night: 'day' }[this.project.settings.daytime || (this.project.settings.night ? 'night' : 'day')]);
    $('#btnShot').onclick = () => this.shot();
    $('#btnSend').onclick = () => this.runCommand($('#cmd').value);
    $('#cmd').addEventListener('keydown', e => { if (e.key === 'Enter') { this.runCommand($('#cmd').value); $('#cmd').blur(); } });
    $('#btnMic').onclick = () => this.mic();
    for (const b of $$('#edit [data-mv]')) b.onclick = () => this.editMove(b.dataset.mv);
    $('#mSave').onclick = () => this.saveAs();
    $('#mOpen').onclick = () => this.openList();
    $('#mExport').onclick = () => { const blob = new Blob([JSON.stringify(this.project)], { type: 'application/json' }); download(blob, (this.project.name || 'oheya') + '.json'); this.toast('ファイルに書き出しました'); };
    $('#mImport').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const p = JSON.parse(t); if (!p.rooms) throw 0; this.load(p); this.closeSheets(); this.toast('読み込みました'); } catch { this.toast('このファイルは読めませんでした'); } }); e.target.value = ''; };
    const gyro = () => { const on = this.walk.setGyro(!this.walk.gyro.on); setTimeout(() => { const now = this.walk.gyro.on; $('#mGyro').textContent = now ? '📱 傾きで見回す:ON(押すと止める)' : '📱 スマホを動かして見回す'; $('#btnGyro').classList.toggle('on', now); this.toast(now ? 'スマホを動かすと見回せます(もう一度押すと止まります)' : '傾き操作を止めました'); }, 300); void on; }; $('#mGyro').onclick = gyro; $('#btnGyro').onclick = () => { this.setMode('walk'); gyro(); };
    $('#mQuality').onclick = () => { const q = { normal: 'high', high: 'low', low: 'normal' }[this.s3.quality]; this.s3.quality = q; this.s3.applyQuality(); localStorage.setItem('oheya-quality', q); $('#mQuality').textContent = '🎚 画質:' + { low: 'かるい', normal: 'ふつう', high: 'きれい' }[q]; };
    $('#mAI').onclick = () => this.aiSettings();
    $('#mHelp').onclick = () => this.help();
    $('#mSpin').onclick = () => { this.closeSheets(); this.setMode('walk'); this.spin = 14; this.toast('ゆっくり一周します(14秒)。画面を録画すると紹介動画になります', 3500); };
    $('#mList').onclick = () => { this.closeSheets(); this.listItems(); };
    $('#mEye').onclick = () => { this.walk.eye = this.walk.eye > 1.3 ? 1.15 : 1.5; $('#mEye').textContent = this.walk.eye > 1.3 ? '👀 目の高さ:立っている(押すと座る)' : '👀 目の高さ:座っている(押すと立つ)'; this.toast(this.walk.eye > 1.3 ? '立った高さで見ています' : '座った高さで見ています(ソファからの眺め)'); };
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this._install = e; $('#mInstall').classList.remove('hidden'); });
    $('#mInstall').onclick = async () => { if (!this._install) return; this._install.prompt(); const r = await this._install.userChoice; if (r.outcome === 'accepted') { $('#mInstall').classList.add('hidden'); this.toast('ホーム画面に入れました'); } this._install = null; };
    $('#mShare').onclick = async () => { const url = location.origin + location.pathname; if (navigator.share) { try { await navigator.share({ title: 'おへや3D', text: '写真から部屋を3Dにして歩き回れるアプリ', url }); } catch {} } else { await navigator.clipboard.writeText(url); this.toast('アドレスをコピーしました'); } };
    $('#sDemo').onclick = () => { this.load(demoProject()); $('#start').classList.add('hidden'); this.firstHelp(); };
    $('#sNew').onclick = async () => { if (this.project && this.project.rooms.length) { const r = await this.dialog('<p>いまの家に部屋を足しますか? それとも新しく始めますか?</p>', [{ label: 'やめる', value: null }, { label: '新しく始める', value: 'new' }, { label: 'いまの家に足す', value: 'add', primary: true }]); if (!r) return; if (r === 'new') { this.load(this.blankProject()); } } $('#start').classList.add('hidden'); this.openNewRoom(); };
    $('#sPhoto').onclick = () => { $('#start').classList.add('hidden'); if (!this.project) this.load(this.blankProject()); openPhotoWizard(this); };
    $('#sContinue').onclick = async () => { const p = await loadProject('current'); if (p) { this.load(p); $('#start').classList.add('hidden'); } else this.toast('保存はまだありません'); };
    $('#nrMake').onclick = () => this.makeNewRoom();
    const presets = [['6畳', 2.7, 3.6], ['8畳', 3.6, 3.6], ['10畳', 3.6, 4.5], ['12畳', 3.6, 5.4], ['16畳LDK', 4.5, 6.3], ['トイレ', 0.9, 1.6], ['廊下', 0.9, 3.6]];
    for (const [n, w, d] of presets) { const b = document.createElement('button'); b.className = 'chip text'; b.textContent = n; b.onclick = () => { $('#nrW').value = w; $('#nrD').value = d; }; $('#roomPresets').appendChild(b); }
    this._shape = 'rect'; for (const [k, n] of [['rect', '長方形'], ['L', 'L字'], ['chamfer', '角を斜めに'], ['bay', '出窓つき'], ['column', '柱型つき']]) { const b = document.createElement('button'); b.className = 'chip text' + (k === 'rect' ? ' on' : ''); b.textContent = n; b.dataset.shape = k; b.onclick = () => { this._shape = k; for (const x of $$('#roomShapes .chip')) x.classList.toggle('on', x.dataset.shape === k); }; $('#roomShapes').appendChild(b); }
    const q = localStorage.getItem('oheya-quality'); if (q) { this.s3.quality = q; this.s3.applyQuality(); $('#mQuality').textContent = '🎚 画質:' + { low: 'かるい', normal: 'ふつう', high: 'きれい' }[q]; }
    window.addEventListener('beforeunload', () => { if (this.dirty && this.project) { try { localStorage.setItem('oheya-last', JSON.stringify(this.project)); } catch {} } });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  initStart() { this.refreshContinue(); if (location.hash === '#demo') { this.load(demoProject()); $('#start').classList.add('hidden'); } }
  async refreshContinue() { try { const list = await listProjects(); const cur = list.find(p => p.id === 'current'); $('#sContinueSub').textContent = cur ? new Date(cur.updated).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' の保存' : '保存なし'; } catch { } }
  blankProject() { return { v: 1, name: '部屋', rooms: [], items: [], assets: {}, settings: { night: false } }; }

  // ---------- 読み込み・組み立て ----------
  // いまの視点のまま組み立て直す
  reload() { const cam = { x: this.s3.camera.position.x, z: this.s3.camera.position.z, yaw: this.walk.yaw, pitch: this.walk.pitch }; const mode = this.mode; this.load(this.project); this.s3.camera.position.set(cam.x, 1.5, cam.z); this.walk.yaw = cam.yaw; this.walk.pitch = cam.pitch; this.setMode(mode); }
  load(p) {
    this.project = p; p.assets = p.assets || {}; p.items = p.items || []; p.settings = p.settings || {}; for (const r of (p.rooms || [])) normalizeRoom(r); this.selectedId = null; this.setPin(null);
    clearMaterialCache(); this.rebuildHouse(); this.rebuildItems(); this.setDaytime(p.settings.daytime || (p.settings.night ? 'night' : 'day'), true);
    const b = houseBounds(p.rooms); this.s3.setSunTarget((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 2);
    if (p.camera) { this.s3.camera.position.set(p.camera.x, 1.5, p.camera.z); this.walk.yaw = p.camera.yaw || 0; this.walk.pitch = 0; }
    else if (p.rooms[0]) { const r = p.rooms[0]; this.s3.camera.position.set(r.x + r.w / 2, 1.5, r.z + r.d * 0.8); this.walk.yaw = 0; this.walk.pitch = 0; }
    this.fitOrbit(); this.setMode(this.mode === 'plan' ? 'plan' : 'walk'); this.dirty = false; this.touched();
  }
  rebuildHouse() {
    const g = this.s3.houseGroup; while (g.children.length) g.remove(g.children[0]);
    const { group, pick } = buildHouse(this.project); g.add(group); this.housePick = pick;
    // 全体表示のときの部屋の名前
    this.labels = new THREE.Group(); this.labels.name = 'labels'; g.add(this.labels);
    for (const r of this.project.rooms) { const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); if (x.roundRect) x.roundRect(8, 8, 240, 64, 18); else x.rect(8, 8, 240, 64); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(r.name, 128, 42); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.position.set(r.x + r.w / 2, r.h + 0.5, r.z + r.d / 2); sp.scale.set(1.6, 0.5, 1); sp.renderOrder = 20; this.labels.add(sp); }
    this.applyCeilingVisibility();
  }
  rebuildItems() { const g = this.s3.itemGroup; while (g.children.length) g.remove(g.children[0]); this.itemGroups.clear(); for (const it of this.project.items) this.addItemMesh(it); this.updateShadowLights(); }
  addItemMesh(it) { let m = null; try { if (!it.opts) it.opts = {}; m = buildItem(it, this.project.assets); } catch (e) { console.warn('item build failed', it.type, e); } if (!m) return; this.s3.itemGroup.add(m); this.itemGroups.set(it.id, m); return m; }
  rebuildItem(it, keep) { if (!keep) this.snapshot(); const old = this.itemGroups.get(it.id); if (old) this.s3.itemGroup.remove(old); this.addItemMesh(it); this.updateShadowLights(); this.updateSelHelper(); this.touched(); }
  updateItemPose(it) { const m = this.itemGroups.get(it.id); if (m) { m.position.set(it.x, it.y, it.z); m.rotation.y = it.rot || 0; } this.updateSelHelper(); this.touched(); }
  updateShadowLights() {
    const cam = this.s3.camera.position; let n = 0;
    const cands = this.project.items.filter(it => ['ceilingLight', 'pendant', 'chandelier'].includes(it.type)).map(it => ({ it, d: Math.hypot(it.x - cam.x, it.z - cam.z) })).sort((a, b) => a.d - b.d);
    for (const { it } of cands) { const g = this.itemGroups.get(it.id); if (!g) continue; for (const l of g.userData.lights || []) { l.castShadow = n < (this.s3.quality === 'high' ? 2 : 1) && this.s3.quality !== 'low'; } n++; }
  }
  applyCeilingVisibility() { const hide = this.mode === 'orbit'; if (this.labels) this.labels.visible = hide; this.s3.houseGroup.traverse(o => { if (o.userData && o.userData.kind === 'ceiling') o.visible = !hide; }); this.s3.itemGroup.traverse(o => { if (o.userData && o.userData.itemId) { const it = this.item(o.userData.itemId); if (it && catalogEntry(it.type).kind === 'ceiling' && o.parent === this.s3.itemGroup) o.visible = true; } }); }
  // もどす(取り消し)用に、変える前の状態をとっておく
  snapshot() { if (!this.project) return; this._undo = (this._undo || []); this._undo.push(JSON.stringify({ ...this.project, assets: undefined })); if (this._undo.length > 30) this._undo.shift(); $('#btnUndo').disabled = false; }
  undo() { if (!this._undo || !this._undo.length) { this.toast('もどすものがありません'); return; } const assets = this.project.assets; const p = JSON.parse(this._undo.pop()); p.assets = assets; const cam = { x: this.s3.camera.position.x, z: this.s3.camera.position.z, yaw: this.walk.yaw }; const mode = this.mode; this.load(p); this.s3.camera.position.set(cam.x, 1.5, cam.z); this.walk.yaw = cam.yaw; this.setMode(mode); this.toast('ひとつ前にもどしました'); $('#btnUndo').disabled = !this._undo.length; }
  touched() { this.dirty = true; clearTimeout(this._save); this._save = setTimeout(() => { if (this.project && this.project.rooms.length) { this.project.camera = { x: this.s3.camera.position.x, z: this.s3.camera.position.z, yaw: this.walk.yaw }; saveProject(this.project, 'current').then(() => { this.dirty = false; }).catch(() => {}); } }, 1500); if (this.mode === 'plan') this.plan.draw(); }
  item(id) { return this.project.items.find(i => i.id === id) || null; }
  room(id) { return this.project.rooms.find(r => r.id === id) || null; }
  currentRoom() { return roomAt(this.s3.camera.position, this.project.rooms) || this.project.rooms[0] || null; }

  // ---------- モード ----------
  setMode(m) {
    this.mode = m; this.s3.mode = m === 'walk' ? 'walk' : 'orbit'; document.body.classList.toggle('plan-mode', m === 'plan'); document.body.classList.toggle('orbit-mode', m === 'orbit');
    for (const b of $$('#modes .mode')) b.classList.toggle('on', b.dataset.mode === m);
    this.walk.enabled = m === 'walk'; this.s3.orbit.enabled = m === 'orbit';
    $('#plan').classList.toggle('hidden', m !== 'plan'); if (m === 'plan') this.plan.show(); else this.plan.hide();
    if (m === 'orbit') this.fitOrbit(); this.applyCeilingVisibility(); this.closeSheets();
  }
  fitOrbit() { const b = houseBounds(this.project ? this.project.rooms : []); const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 3); this.s3.orbitCam.position.set(cx + size * 0.25, size * 1.15 + 2, cz + size * 1.0); this.s3.orbit.target.set(cx, 0.5, cz); this.s3.orbit.update(); }
  setNight(on, silent) { this.setDaytime(on ? 'night' : 'day', silent); }
  setDaytime(mode, silent) { this.project.settings.daytime = mode; this.project.settings.night = mode === 'night'; this.s3.setDaytime(mode); $('#btnDayNight').innerHTML = { day: '☀️<small>昼</small>', evening: '🌇<small>夕方</small>', night: '🌙<small>夜</small>' }[mode]; if (!silent) { this.toast({ day: '昼にしました', evening: '夕方にしました。西日が入ります', night: '夜にしました。照明の雰囲気が分かります' }[mode]); this.touched(); } }

  // ---------- 毎フレーム ----------
  frame(dt) {
    if (!this.project) return;
    if (this.spin) { this.walk.yaw += dt * (Math.PI * 2 / 14); this.spin -= dt; if (this.spin <= 0) { this.spin = 0; this.toast('一周しました'); } }
    this.walk.update(dt);
    if (this.mode === 'walk') { this._ct = (this._ct || 0) + dt; if (this._ct > 0.12) { this._ct = 0; this.center = this.hitAt(0.5, 0.5); $('#crosshair').classList.toggle('hit', !!(this.center && this.center.kind)); } }
    const r = roomAt(this.s3.camera.position, this.project.rooms); if (r && r.id !== this.currentRoomId) { this.currentRoomId = r.id; this.updateShadowLights(); }
    if (this.pinMesh.visible) { const s = this.pinMesh.position.distanceTo(this.s3.activeCamera().position) * 0.5 + 0.5; this.pinMesh.scale.setScalar(s); }
  }
  // 画面の位置 → 何に当たったか
  hitAt(nx, ny) {
    const h = this.s3.pick(nx, ny, [this.s3.houseGroup, this.s3.itemGroup]); if (!h) return null;
    const o = h.object; const n = h.face ? h.face.normal.clone().transformDirection(o.matrixWorld) : new THREE.Vector3(0, 1, 0);
    if (o.userData.itemId) return { kind: 'item', itemId: o.userData.itemId, point: h.point, normal: n, roomId: (this.item(o.userData.itemId) || {}).roomId, distance: h.distance };
    const u = o.userData; return { kind: u.kind, roomId: u.roomId, edge: u.edge, part: u.part, partId: u.partId, openingId: u.openingId, point: h.point, normal: n, distance: h.distance };
  }
  onTap(nx, ny, e) {
    if (this.mode !== 'walk') { if (this.mode === 'orbit') { const h = this.hitAt(nx, ny); if (h && h.kind === 'item') { this.select(h.itemId); this.setPin(null); } else if (h && h.kind) { this.select(null); this.setPin(h); this.toast('ここに置きます(＋置く)', 1500); } else { this.select(null); this.setPin(null); } } return; }
    const h = this.hitAt(nx, ny);
    if (h && h.kind === 'item') { this.select(h.itemId); return; }
    if (h && (h.kind === 'floor' || h.kind === 'wall' || h.kind === 'ceiling' || h.kind === 'window')) { this.select(null); this.setPin(h); this.toast('ここに置きます。「＋置く」で選ぶか、「ここにカーテン」と言ってください', 2200); return; }
    this.select(null); this.setPin(null);
  }
  setPin(h) { this.pin = h; this.pinMesh.visible = !!h; if (h) { this.pinMesh.position.copy(h.point).addScaledVector(h.normal, 0.01); this.pinMesh.lookAt(h.point.clone().add(h.normal)); } }
  target() { return this.pin || this.center || this.defaultTarget(); }
  defaultTarget() { const r = this.currentRoom(); if (!r) return null; const cam = this.s3.camera.position; const dir = new THREE.Vector3(-Math.sin(this.walk.yaw), 0, -Math.cos(this.walk.yaw)); const p = cam.clone().addScaledVector(dir, 1.5); p.y = 0; p.x = Math.min(r.x + r.w - 0.3, Math.max(r.x + 0.3, p.x)); p.z = Math.min(r.z + r.d - 0.3, Math.max(r.z + 0.3, p.z)); return { kind: 'floor', roomId: r.id, point: p, normal: new THREE.Vector3(0, 1, 0) }; }

  // ---------- 置く ----------
  openCatalog() {
    this.openSheet('catalog'); const tabs = $('#catTabs'), cards = $('#catCards'); tabs.innerHTML = ''; this._cat = this._cat || CATEGORIES[0];
    for (const c of CATEGORIES) { const b = document.createElement('button'); b.textContent = c; b.classList.toggle('on', c === this._cat); b.onclick = () => { this._cat = c; this.openCatalog(); }; tabs.appendChild(b); }
    cards.innerHTML = '';
    for (const [type, e] of Object.entries(CATALOG)) { if (e.cat !== this._cat) continue; const b = document.createElement('button'); b.className = 'card sw'; const th = thumbnail(type); if (th) { const img = document.createElement('img'); img.src = th; img.alt = e.name; b.appendChild(img); } else b.textContent = e.emoji; const bb = document.createElement('b'); bb.textContent = e.name; b.appendChild(bb); b.onclick = () => { const it = this.place(type, this.target()); if (it) { this.closeSheets(); this.select(it.id); this.toast(e.name + 'を置きました。指で引っぱると動かせます'); } }; cards.appendChild(b); }
  }
  // 種類と場所から、置き場所を決めて置く
  place(type, t, over = {}) {
    const c = catalogEntry(type); if (!c || !this.project.rooms.length) { this.toast('先に部屋を作ってください'); return null; } this.snapshot();
    const it = newItem(type, over); const room = (t && t.roomId && this.room(t.roomId)) || this.currentRoom(); if (!room) return null; it.roomId = room.id; normalizeRoom(room);
    const p = t ? t.point.clone() : new THREE.Vector3(room.x + room.w / 2, 0, room.z + room.d / 2);
    const isWin = ['curtain', 'lace', 'roller', 'blind', 'vblind', 'shade', 'pleats', 'shoji'].includes(type);
    if (c.kind === 'wall') {
      const hitWall = !!(t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined);
      const hitPart = !!(t && t.kind === 'part' && t.normal && Math.abs(t.normal.y) < 0.5);
      let edge = null; if (over.side) edge = edgeForCompass(room, over.side, this.s3.camera.position); else if (hitWall) edge = t.edge; else if (!hitPart) edge = nearestEdge(room, p);
      // 高さの決め方(窓に合わせない場合)
      const defaultY = v => { const defY = { wallLight: 1.75, tv: 1.15, picture: 1.5, mirror: 1.25, clock: 1.9 }[type] ?? 1.4; if (isWin) { it.h = Math.min(it.h, room.h - 0.1); it.y = Number.isFinite(v) ? Math.min(room.h - it.h / 2, Math.max(it.h / 2, v)) : room.h - 0.05 - it.h / 2; if (type === 'curtain' || type === 'lace') { const tp = room.h - 0.06; it.h = tp - 0.02; it.y = (tp + 0.02) / 2; } } else it.y = Number.isFinite(v) ? Math.min(room.h - it.h / 2, Math.max(it.h / 2, v)) : defY; };
      if (edge !== null && edge !== undefined) {
        const f = edgeFrame(room, edge), L = f.L; let { u, v } = wallUV(room, edge, p); if (!hitWall) v = NaN; if (over.side) u = L / 2;
        const wins = room.openings.filter(o => o.edge === edge && o.type === 'window').map(o => ({ o, cu: o.u + o.w / 2 }));
        let win = null; if (isWin && wins.length) { wins.sort((a, b) => Math.abs(a.cu - u) - Math.abs(b.cu - u)); win = wins[0]; if (Math.abs(win.cu - u) > 2.5 && hitWall) win = null; }
        if (win) { const o = win.o, top = o.sill + o.h; u = win.cu; const keepW = over.w;
          if (type === 'curtain' || type === 'lace') { it.w = keepW || o.w + 0.4; const bot = 0.02; const tp = Math.min(room.h - 0.05, top + 0.18); it.h = tp - bot; it.y = (tp + bot) / 2; }
          else { it.w = keepW || o.w + 0.1; const tp = Math.min(room.h - 0.05, top + 0.12), bot = Math.max(0.05, o.sill - 0.06); it.h = tp - bot; it.y = (tp + bot) / 2; }
          if (over.h) { it.h = over.h; if (type === 'curtain' || type === 'lace') it.y = 0.02 + it.h / 2; } }
        else defaultY(v);
        it.w = Math.min(it.w, L - 0.02); u = Math.min(L - it.w / 2, Math.max(it.w / 2, u)); const wp = wallPoint(room, edge, u, 0, 0); it.x = wp.x; it.z = wp.z; it.rot = f.rotY; it.edge = edge;
      } else {
        // 柱型や袖壁の面に付ける
        it.rot = Math.atan2(t.normal.x, t.normal.z); it.x = p.x + t.normal.x * 0.004; it.z = p.z + t.normal.z * 0.004; it.edge = null; defaultY(p.y);
      }
    } else if (c.kind === 'ceiling') {
      let x = p.x, z = p.z; const n = (t && t.kind === 'part' && t.normal) ? t.normal : (t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined ? edgeFrame(room, t.edge).normal : null);
      if (n && Math.abs(n.y) < 0.5) { x += n.x * 1.0; z += n.z * 1.0; }
      [x, z] = clampIntoRoom(room, x, z, Math.min(0.5, it.w / 2 + 0.05)); it.x = x; it.z = z; it.y = room.h; it.rot = 0;
    } else {
      const n = (t && t.kind === 'part' && t.normal) ? t.normal : (t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined ? edgeFrame(room, t.edge).normal : null);
      if (n && Math.abs(n.y) < 0.5) p.addScaledVector(n, it.d / 2 + 0.02);
      let [x, z] = clampIntoRoom(room, p.x, p.z, Math.min(0.4, Math.min(it.w, it.d) / 2)); it.x = x; it.z = z; it.y = 0;
      const e = nearestEdge(room, new THREE.Vector3(it.x, 0, it.z)), f = edgeFrame(room, e), dist = edgeDistance(room, e, it.x, it.z);
      if (n && Math.abs(n.y) < 0.5 && type !== 'rug') it.rot = Math.atan2(n.x, n.z);
      else if (dist < 0.9 || type === 'rug') it.rot = type === 'rug' ? 0 : f.rotY; else { const cam = this.s3.camera.position; it.rot = Math.atan2(cam.x - it.x, cam.z - it.z); }
      if (type !== 'rug' && dist < it.d / 2 + 0.02) { const push = it.d / 2 + 0.02 - dist; it.x += f.normal.x * push; it.z += f.normal.z * push; }
    }
    this.project.items.push(it); this.addItemMesh(it); this.updateShadowLights(); this.setPin(null); this.touched(); return it;
  }

  // ---------- 選ぶ・直す ----------
  select(id) {
    this.selectedId = id; this.updateSelHelper(); if (!id) { $('#edit').classList.add('hidden'); return; }
    const it = this.item(id), c = catalogEntry(it.type); this.openSheet('edit'); $('#editName').textContent = c.name;
    const colors = $('#editColors'); colors.innerHTML = '';
    for (const [n, hex] of Object.entries(COLORS)) { const b = document.createElement('button'); b.className = 'chip' + (it.color === hex ? ' on' : ''); b.style.background = hex; b.title = n; b.onclick = () => { it.color = hex; this.rebuildItem(it); this.select(id); }; colors.appendChild(b); }
    const mats = $('#editMats'); mats.innerHTML = '';
    if (c.fabric !== undefined && c.fabric !== null && it.type !== 'lace') { for (const f of SURFACE_LIB.fabric) { const b = document.createElement('button'); b.className = 'card sw' + (it.fabric === f.id ? ' on' : ''); b.appendChild(swatchCanvas('fabric', f.id, f.tint ? it.color : null)); const bb = document.createElement('b'); bb.textContent = f.name; b.appendChild(bb); b.onclick = () => { it.fabric = f.id; it.userTex = null; this.rebuildItem(it); this.select(id); }; mats.appendChild(b); }
      for (const [aid, a] of Object.entries(this.project.assets)) { if (a.kind !== 'tile') continue; const b = document.createElement('button'); b.className = 'card sw' + (it.userTex === aid ? ' on' : ''); const img = document.createElement('img'); img.src = a.dataUrl; b.appendChild(img); const bb = document.createElement('b'); bb.textContent = a.name || '写真'; b.appendChild(bb); b.onclick = () => { it.userTex = aid; it.texSize = a.size || .5; it.fabric = null; this.rebuildItem(it); this.select(id); }; mats.appendChild(b); }
      const lab = document.createElement('label'); lab.className = 'filebtn'; lab.textContent = '📷 生地の写真'; const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = e => this.userTextureFor(e.target.files[0], 'fabric', it); lab.appendChild(inp); mats.appendChild(lab); }
    const params = $('#editParams'); params.innerHTML = '';
    for (const [key, name, a, b] of (c.params || [])) { const lab = document.createElement('label'); lab.textContent = name; if (a === 'bool') { const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!it.opts[key]; i.onchange = () => { it.opts[key] = i.checked; this.rebuildItem(it); }; lab.appendChild(i); } else { const i = document.createElement('input'); i.type = 'range'; i.min = a; i.max = b; i.step = (b - a) > 5 ? 1 : 0.01; i.value = it.opts[key] ?? a; i.oninput = () => { it.opts[key] = parseFloat(i.value); clearTimeout(this._pt); this._pt = setTimeout(() => this.rebuildItem(it, true), 60); }; lab.appendChild(i); } params.appendChild(lab); }
    const kind = c.kind; const sz = document.createElement('label'); sz.textContent = '幅 ' + it.w.toFixed(2) + 'm'; const si = document.createElement('input'); si.type = 'range'; si.min = 0.2; si.max = 6; si.step = 0.05; si.value = it.w; si.oninput = () => { it.w = parseFloat(si.value); sz.firstChild.textContent = '幅 ' + it.w.toFixed(2) + 'm'; clearTimeout(this._pt); this._pt = setTimeout(() => this.rebuildItem(it, true), 60); }; sz.appendChild(si); params.appendChild(sz);
    const hz = document.createElement('label'); hz.textContent = '高さ ' + it.h.toFixed(2) + 'm'; const hi = document.createElement('input'); hi.type = 'range'; hi.min = 0.05; hi.max = 3; hi.step = 0.05; hi.value = it.h; hi.oninput = () => { const old = it.h; it.h = parseFloat(hi.value); if (kind === 'wall' && ['curtain', 'lace', 'roller', 'blind', 'vblind', 'shade', 'pleats', 'shoji'].includes(it.type)) it.y += (it.h - old) / -2; hz.firstChild.textContent = '高さ ' + it.h.toFixed(2) + 'm'; clearTimeout(this._pt); this._pt = setTimeout(() => this.rebuildItem(it, true), 60); }; hz.appendChild(hi); params.appendChild(hz);
    if (kind === 'floor') { const dz = document.createElement('label'); dz.textContent = '奥行 ' + it.d.toFixed(2) + 'm'; const di = document.createElement('input'); di.type = 'range'; di.min = 0.2; di.max = 4; di.step = 0.05; di.value = it.d; di.oninput = () => { it.d = parseFloat(di.value); dz.firstChild.textContent = '奥行 ' + it.d.toFixed(2) + 'm'; clearTimeout(this._pt); this._pt = setTimeout(() => this.rebuildItem(it, true), 60); }; dz.appendChild(di); params.appendChild(dz); }
  }
  updateSelHelper() { const g = this.selectedId && this.itemGroups.get(this.selectedId); if (!g) { this.selHelper.visible = false; return; } this.selHelper.box.setFromObject(g, true); this.selHelper.visible = true; }
  editMove(op) {
    const it = this.item(this.selectedId); if (!it) return; const c = catalogEntry(it.type), room = this.room(it.roomId) || this.currentRoom(), step = 0.1;
    const yaw = this.walk.yaw; const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    if (op === 'del') { this.removeItem(it.id); return; }
    if (op === 'dup') { const n = newItem(it.type, { ...JSON.parse(JSON.stringify(it)), id: undefined }); n.id = newItem(it.type).id; if (c.kind === 'wall') { const f = frameFromRot(it.rot || 0); n.x += f.along.x * (it.w + 0.1); n.z += f.along.z * (it.w + 0.1); } else { n.x += 0.4; n.z += 0.4; } this.project.items.push(n); this.addItemMesh(n); this.select(n.id); this.touched(); return; }
    if (op === 'bigger' || op === 'smaller') { const k = op === 'bigger' ? 1.1 : 1 / 1.1; it.w *= k; if (c.kind === 'floor' || c.kind === 'ceiling') { it.d *= k; if (c.kind === 'floor') it.h *= k; } else it.h *= k; this.rebuildItem(it); this.select(it.id); return; }
    if (op === 'rotl' || op === 'rotr') { it.rot += (op === 'rotl' ? 1 : -1) * Math.PI / 12; this.updateItemPose(it); return; }
    if (c.kind === 'wall') { const f = frameFromRot(it.rot || 0); const along = f.along; const dir = { left: -1, right: 1, fwd: 0, back: 0 }[op]; if (dir) { it.x += along.x * dir * step; it.z += along.z * dir * step; } if (op === 'up') it.y += step; if (op === 'down') it.y -= step; if (op === 'fwd' || op === 'back') { this.toast('壁のものは、左右と上下に動かせます'); return; } this.updateItemPose(it); return; }
    const v = { fwd, back: fwd.clone().negate(), right, left: right.clone().negate() }[op]; if (v) { it.x += v.x * step; it.z += v.z * step; }
    if (op === 'up' && c.kind === 'floor') it.y += step; if (op === 'down' && c.kind === 'floor') it.y = Math.max(0, it.y - step);
    if ((op === 'up' || op === 'down') && c.kind === 'ceiling') { this.toast('天井のものは、前後左右に動かせます'); return; }
    this.updateItemPose(it);
  }
  removeItem(id) { const i = this.project.items.findIndex(x => x.id === id); if (i < 0) return; this.snapshot(); const g = this.itemGroups.get(id); if (g) this.s3.itemGroup.remove(g); this.itemGroups.delete(id); this.project.items.splice(i, 1); if (this.selectedId === id) this.select(null); this.touched(); }
  // 指で引っぱって動かす
  dragItem(phase, e, h) {
    const it = this.item(this.selectedId); if (!it) return; const c = catalogEntry(it.type), room = this.room(it.roomId) || this.currentRoom();
    const nx = e.clientX / this.canvas.clientWidth, ny = e.clientY / this.canvas.clientHeight;
    if (phase === 'start') { this._drag = { off: new THREE.Vector3(it.x - h.point.x, 0, it.z - h.point.z) }; return; }
    if (phase === 'end') { this.touched(); return; }
    if (c.kind === 'wall') { const hit = this.s3.pick(nx, ny, [this.s3.houseGroup]); if (!hit) return; const u = hit.object.userData; const r = this.room(u.roomId); if (!r) return; if (u.kind === 'part') { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null; if (!n || Math.abs(n.y) > 0.5) return; it.rot = Math.atan2(n.x, n.z); it.x = hit.point.x + n.x * 0.004; it.z = hit.point.z + n.z * 0.004; it.y = Math.min(r.h - it.h / 2, Math.max(it.h / 2, hit.point.y)); it.edge = null; it.roomId = r.id; this.updateItemPose(it); return; } if (!(u.kind === 'wall' || u.kind === 'window')) return; const f = edgeFrame(r, u.edge); const { u: uu, v } = wallUV(r, u.edge, hit.point); const L = f.L; const cu = Math.min(L - it.w / 2, Math.max(it.w / 2, uu)); const wp = wallPoint(r, u.edge, cu, 0, 0); it.x = wp.x; it.z = wp.z; it.y = Math.min(r.h - it.h / 2, Math.max(it.h / 2, v)); it.rot = f.rotY; it.edge = u.edge; it.roomId = r.id; this.updateItemPose(it); return; }
    const y = c.kind === 'ceiling' ? room.h : it.y; const ray = this.s3.raycaster; ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.s3.activeCamera()); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return;
    p.add(this._drag.off); const r2 = roomAt(p, this.project.rooms) || room; it.roomId = r2.id; const [cx, cz] = clampIntoRoom(r2, p.x, p.z, Math.min(0.3, Math.min(it.w, it.d) / 2)); it.x = cx; it.z = cz; this.updateItemPose(it);
  }

  // ---------- 床・壁・天井 ----------
  openSurfaces(forceTab) {
    this.openSheet('surfaces'); const t = this.pin || this.center; this._surfTarget = t && t.kind !== 'item' ? t : null;
    this._surfTab = forceTab || (t && t.kind === 'wall' ? '壁' : t && t.kind === 'ceiling' ? '天井' : this._surfTab || '床');
    const tabs = $('#surfTabs'); tabs.innerHTML = ''; for (const n of ['床', '壁', '天井']) { const b = document.createElement('button'); b.textContent = n; b.classList.toggle('on', n === this._surfTab); b.onclick = () => this.openSurfaces(n); tabs.appendChild(b); }
    const room = (t && t.roomId && this.room(t.roomId)) || this.currentRoom(); if (!room) return;
    const side = (t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined) ? t.edge : null;
    $('#surfHint').textContent = this._surfTab === '床' ? `${room.name}の床` : this._surfTab === '天井' ? `${room.name}の天井` : side !== null ? `${room.name}の${edgeName(room, side)}(見ている壁)。下の「全部の壁」で全部に。` : `${room.name}の壁。見ている壁がないので全部の壁に貼ります。`;
    const kind = this._surfTab === '床' ? 'floor' : 'wall';
    const apply = spec => { this.snapshot(); if (this._surfTab === '床') room.floor = spec; else if (this._surfTab === '天井') room.ceiling = spec; else { room.walls = room.walls || {}; if (this._allWalls || side === null) for (let e = 0; e < room.poly.length; e++) room.walls[e] = spec; else room.walls[side] = spec; } clearMaterialCache(); this.rebuildHouse(); this.touched(); this.toast('貼りかえました'); };
    const colors = $('#surfColors'); colors.innerHTML = '';
    if (room.pano) { const pb = document.createElement('button'); pb.className = 'chip text'; pb.textContent = '🌐 パノラマをはがす'; pb.onclick = () => { delete room.pano; this.rebuildHouse(); this.touched(); this.openSurfaces(this._surfTab); }; colors.appendChild(pb); const rb = document.createElement('button'); rb.className = 'chip text'; rb.textContent = '↻ パノラマを回す'; rb.onclick = () => { room.panoRot = ((room.panoRot || 0) + Math.PI / 8) % (Math.PI * 2); this.rebuildHouse(); this.touched(); }; colors.appendChild(rb); }
    if (this._surfTab === '壁') { const all = document.createElement('button'); all.className = 'chip text' + (this._allWalls ? ' on' : ''); all.textContent = '全部の壁'; all.onclick = () => { this._allWalls = !this._allWalls; this.openSurfaces(this._surfTab); }; colors.appendChild(all); }
    for (const [n, hex] of Object.entries(COLORS)) { const b = document.createElement('button'); b.className = 'chip'; b.style.background = hex; b.title = n; b.onclick = () => apply(kind === 'floor' ? { lib: 'carpet_b', color: hex } : { color: hex }); colors.appendChild(b); }
    const cards = $('#surfCards'); cards.innerHTML = '';
    for (const e of SURFACE_LIB[kind]) { const b = document.createElement('button'); b.className = 'card sw'; b.appendChild(swatchCanvas(kind, e.id)); const bb = document.createElement('b'); bb.textContent = e.name; b.appendChild(bb); b.onclick = () => apply({ lib: e.id }); cards.appendChild(b); }
    for (const [id, a] of Object.entries(this.project.assets)) { if (a.kind !== 'tile') continue; const b = document.createElement('button'); b.className = 'card sw'; const img = document.createElement('img'); img.src = a.dataUrl; b.appendChild(img); const bb = document.createElement('b'); bb.textContent = a.name || '写真'; b.appendChild(bb); b.onclick = () => apply({ user: id, size: a.size || 0.5 }); cards.appendChild(b); }
    $('#surfPhoto').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) this.userTextureFor(f, kind, null, apply); };
  }
  // 見本の写真 → 繰り返し模様として使う
  async userTextureFor(file, kind, it, apply) {
    const dataUrl = await fileToDataUrl(file, 1024); const size = await this.dialog('<p>この写真は、実物で どれくらいの大きさですか?(繰り返して貼ります)</p>', [{ label: '10cm', value: .1 }, { label: '30cm', value: .3 }, { label: '50cm', value: .5 }, { label: '1m', value: 1 }, { label: '2m', value: 2 }]);
    const id = 'a' + Date.now().toString(36); this.project.assets[id] = { dataUrl, name: file.name.replace(/\.[^.]+$/, '').slice(0, 12), size, kind: 'tile' };
    if (it) { it.fabric = null; it.userTex = id; it.texSize = size; this.rebuildItem(it); } else if (apply) apply({ user: id, size });
    this.touched();
  }

  // ---------- 言葉で指示 ----------
  mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { this.toast('この端末では声の入力が使えません。文字で入れてください'); return; }
    if (this._rec) { this._rec.stop(); return; }
    const r = this._rec = new SR(); r.lang = 'ja-JP'; r.interimResults = true; r.continuous = false; $('#btnMic').classList.add('on'); $('#cmd').placeholder = '聞いています…';
    r.onresult = ev => { let t = ''; for (const res of ev.results) t += res[0].transcript; $('#cmd').value = t; if (ev.results[ev.results.length - 1].isFinal) { this.runCommand(t); } };
    r.onend = () => { $('#btnMic').classList.remove('on'); $('#cmd').placeholder = '例:ここにカーテンをつけて／床をフローリングに'; this._rec = null; };
    r.onerror = () => { this.toast('聞き取れませんでした。もう一度どうぞ'); }; r.start();
  }
  async runCommand(text) {
    text = (text || '').trim(); if (!text) return; $('#cmd').value = '';
    let cmd = parseCommand(text, this);
    if ((!cmd || cmd.action === 'unknown') && AI.hasKey()) { this.toast('AIに聞いています…'); const r = await AI.aiCommand(text, this); if (r) cmd = r; }
    this.execute(cmd, text);
  }
  execute(cmd, text) {
    if (!cmd || cmd.action === 'unknown') { this.toast('うまく分かりませんでした。「ここにカーテンをつけて」「床をフローリングに」「壁を白に」「夜にして」などと言ってみてください', 4000); return; }
    const sel = this.item(this.selectedId); const t = this.target();
    const findItems = type => { const room = this.currentRoom(); return this.project.items.filter(i => i.type === type && (!room || i.roomId === room.id)); };
    const nearest = type => { const list = findItems(type); if (!list.length) return null; const p = (t && t.point) || this.s3.camera.position; list.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); return list[0]; };
    switch (cmd.action) {
      case 'add': { const over = {}; if (cmd.color) over.color = cmd.color; if (cmd.fabric) over.fabric = cmd.fabric; if (cmd.side) over.side = cmd.side; if (cmd.size) { over.w = cmd.size.w ?? undefined; if (cmd.size.h) over.h = cmd.size.h; } for (const k of Object.keys(over)) if (over[k] === undefined) delete over[k];
        let tt = t; const room = this.currentRoom(); if (cmd.where === 'window' && room) { const w = (room.openings || []).find(o => o.type === 'window'); if (w) tt = { kind: 'window', roomId: room.id, edge: w.edge, point: wallPoint(room, w.edge, w.u + w.w / 2, w.sill + w.h / 2, 0), normal: edgeFrame(room, w.edge).normal }; }
        else if (cmd.side && room) { const e = edgeForCompass(room, cmd.side, this.s3.camera.position); if (e !== null) tt = { kind: 'wall', roomId: room.id, edge: e, point: wallPoint(room, e, wallLength(room, e) / 2, 1.2, 0), normal: edgeFrame(room, e).normal }; delete over.side; }
        else if ((cmd.where === 'center' || (!cmd.where && !this.pin && catalogEntry(cmd.type).kind === 'ceiling')) && room) { tt = { kind: 'floor', roomId: room.id, point: new THREE.Vector3(room.x + room.w / 2, 0, room.z + room.d / 2), normal: new THREE.Vector3(0, 1, 0) }; }
        const n = cmd.count || 1; let last = null; for (let i = 0; i < n; i++) { last = this.place(cmd.type, tt, over); if (last && n > 1) { last.x += (i - (n - 1) / 2) * (last.w + 0.2) * Math.cos(last.rot || 0); last.z -= (i - (n - 1) / 2) * (last.w + 0.2) * Math.sin(last.rot || 0); this.updateItemPose(last); } }
        if (last) { this.select(last.id); this.toast(catalogEntry(cmd.type).name + 'を置きました'); if (this.mode === 'walk' && cmd.where !== 'here') this.walk.lookAt(last.x, last.z); } return; }
      case 'remove': { const it = cmd.type ? nearest(cmd.type) : sel; if (!it) { this.toast('消すものが見つかりません。先に指で選んでください'); return; } this.removeItem(it.id); this.toast('消しました'); return; }
      case 'removeAll': { const list = cmd.type ? findItems(cmd.type) : this.project.items.slice(); for (const i of list) this.removeItem(i.id); this.toast(list.length + 'こ消しました'); return; }
      case 'change': { const it = cmd.type ? (nearest(cmd.type) || sel) : sel; if (!it) { this.toast('どれを変えるか分かりません。指で選ぶか「カーテンを赤に」のように言ってください'); return; }
        if (cmd.color) it.color = cmd.color; if (cmd.fabric) it.fabric = cmd.fabric; if (cmd.opts) Object.assign(it.opts, cmd.opts); if (cmd.scale) { it.w *= cmd.scale; it.h *= cmd.scale; if (catalogEntry(it.type).kind === 'floor') it.d *= cmd.scale; } if (cmd.size) { if (cmd.size.w) it.w = cmd.size.w; if (cmd.size.h) it.h = cmd.size.h; }
        this.rebuildItem(it); this.select(it.id); this.toast(catalogEntry(it.type).name + 'を変えました'); return; }
      case 'move': { const it = cmd.type ? (nearest(cmd.type) || sel) : sel; if (!it) { this.toast('動かすものを先に選んでください'); return; } const c = catalogEntry(it.type); if (cmd.where === 'here' && t && t.point) { const keep = { color: it.color, fabric: it.fabric, opts: it.opts, w: it.w, h: it.h, d: it.d }; this.removeItem(it.id); const n = this.place(it.type, t, keep); if (n) this.select(n.id); this.toast('動かしました'); return; } for (let i = 0; i < (cmd.steps || 3); i++) this.editMove(cmd.dir); void c; return; }
      case 'surface': { const room = (t && t.roomId && this.room(t.roomId)) || this.currentRoom(); if (!room) return; const spec = cmd.spec; this.snapshot();
        if (cmd.target === 'floor') room.floor = spec; else if (cmd.target === 'ceiling') room.ceiling = spec; else { room.walls = room.walls || {}; const e = cmd.side ? edgeForCompass(room, cmd.side, this.s3.camera.position) : (t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined ? t.edge : null); if (e !== null && e !== undefined && !cmd.all) room.walls[e] = spec; else for (let i = 0; i < room.poly.length; i++) room.walls[i] = spec; }
        if (cmd.allRooms) for (const r of this.project.rooms) { normalizeRoom(r); if (cmd.target === 'floor') r.floor = spec; else if (cmd.target === 'ceiling') r.ceiling = spec; else for (let i = 0; i < r.poly.length; i++) (r.walls = r.walls || {})[i] = spec; }
        clearMaterialCache(); this.rebuildHouse(); this.touched(); this.toast({ floor: '床', ceiling: '天井', wall: '壁' }[cmd.target] + 'を貼りかえました'); return; }
      case 'night': this.setDaytime(cmd.mode || (cmd.on ? 'night' : 'day')); return;
      case 'lights': { for (const it of this.project.items) if (catalogEntry(it.type).cat === '照明' && (!cmd.type || it.type === cmd.type)) { it.opts.on = cmd.on; this.rebuildItem(it); } this.toast(cmd.on ? '照明をつけました' : '照明を消しました'); return; }
      case 'mode': this.setMode(cmd.mode); return;
      case 'window': case 'door': { const room = this.currentRoom(); if (!room) return; normalizeRoom(room); const edge = cmd.side ? edgeForCompass(room, cmd.side, this.s3.camera.position) : ((t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined) ? t.edge : nearestEdge(room, (t && t.point) || this.s3.camera.position)); if (edge === null) { this.toast('その向きの壁がありません'); return; }
        const L = wallLength(room, edge); const w = cmd.size?.w || (cmd.action === 'window' ? 1.65 : 0.8), h = cmd.size?.h || (cmd.action === 'window' ? 1.1 : 2.0);
        let u = (t && (t.kind === 'wall') && t.edge === edge) ? wallUV(room, edge, t.point).u : L / 2; u = Math.min(L - w / 2 - 0.1, Math.max(w / 2 + 0.1, u)) - w / 2;
        const spot = this.freeSpot(room, edge, u, w, cmd.action === 'door' && !cmd.side && !(t && t.kind === 'wall')); if (!spot) { this.toast('空いている壁がありません'); return; }
        this.addOpening(room, { edge: spot.edge, type: cmd.action, u: spot.u, w, h, sill: cmd.action === 'window' ? (cmd.sill ?? (h > 1.6 ? 0.3 : 0.9)) : 0, open: 0.9 }); this.toast((cmd.action === 'window' ? '窓' : 'ドア') + 'を' + edgeName(room, spot.edge) + 'に付けました'); return; }
      case 'part': { const room = this.currentRoom(); if (!room) return; this.addPart(room, cmd.part, (t && t.point) || null, cmd); return; }
      case 'chamfer': { const room = this.currentRoom(); if (!room) return; normalizeRoom(room); const pt = (t && t.point) || this.s3.camera.position; let bi = 0, bd = Infinity; room.poly.forEach(([x, z], i) => { const d = Math.hypot(x - pt.x, z - pt.z); if (d < bd) { bd = d; bi = i; } }); this.snapshot(); chamferVertex(room, bi, cmd.len || 0.8); this.plan.fixTwins(); this.reload(); this.toast('角を斜めにしました(間取りで角を動かせます)'); return; }
      case 'room': { this.openNewRoom(cmd); return; }
      case 'roomSize': { const room = this.currentRoom(); if (!room) return; this.snapshot(); if (cmd.w || cmd.d) { if (!isRect(room)) { this.toast('この部屋は四角ではないので、間取りで角を動かして広さを変えてください', 4000); return; } resizeRect(room, cmd.w || room.w, cmd.d || room.d); } if (cmd.h) room.h = cmd.h; this.plan.clampOpenings(room); for (const it of this.project.items) if (it.roomId === room.id) { it.x = Math.min(room.x + room.w - 0.1, it.x); it.z = Math.min(room.z + room.d - 0.1, it.z); if (catalogEntry(it.type).kind === 'ceiling') it.y = room.h; } this.plan.fixTwins(); this.reload(); this.toast(`${room.name}を ${room.w.toFixed(1)}×${room.d.toFixed(1)}m・天井${room.h.toFixed(2)}m にしました`); return; }
      case 'shot': this.shot(); return;
      case 'undo': this.undo(); return;
      case 'spin': this.setMode('walk'); this.spin = 14; this.toast('ゆっくり一周します(14秒)'); return;
      case 'list': this.listItems(); return;
      case 'eye': this.walk.eye = cmd.eye; this.toast(cmd.eye > 1.3 ? '立った高さで見ています' : '座った高さで見ています'); return;
      case 'help': this.help(); return;
      case 'info': this.toast(cmd.text, 5000); return;
    }
  }
  // 壁の空いている場所を探す(ほかの窓・ドアと重ならないように)。anyWall なら他の壁も試す
  freeSpot(room, edge, u, w, anyWall) {
    const tryWall = (e, want) => { const L = wallLength(room, e); if (L < w + 0.3) return null; const ops = room.openings.filter(o => o.edge === e).map(o => [o.u - 0.1, o.u + o.w + 0.1]).sort((a, b) => a[0] - b[0]);
      const fits = p => p >= 0.1 && p + w <= L - 0.1 && !ops.some(([a, b]) => p < b && p + w > a); if (want != null && fits(want)) return { edge: e, u: want };
      const cands = [L / 2 - w / 2]; let prev = 0.1; for (const [a, b] of ops) { cands.push(a - 0.1 - w, (prev + a) / 2 - w / 2); prev = b; } cands.push(prev + 0.1, L - 0.1 - w, (prev + L) / 2 - w / 2); for (const c of cands) if (fits(c)) return { edge: e, u: c }; return null; };
    const n = room.poly.length; const order = []; for (let k = 1; k < n; k++) order.push((edge + k) % n);
    return tryWall(edge, u) || (anyWall ? order.map(e => tryWall(e, null)).find(Boolean) || null : null);
  }
  // 柱型・袖壁・梁を足す
  addPart(room, kind, at, cmd = {}) {
    normalizeRoom(room); this.snapshot(); room.parts = room.parts || []; const id = uid(); const H = room.h;
    const pt = at ? new THREE.Vector3(at.x, 0, at.z) : new THREE.Vector3(room.x + room.w / 2, 0, room.z + room.d / 2);
    if (kind === 'column') {
      // いちばん近い角に、壁ぞいの柱型
      let bi = 0, bd = Infinity; room.poly.forEach(([x, z], i) => { const d = Math.hypot(x - pt.x, z - pt.z); if (d < bd) { bd = d; bi = i; } });
      const [cx, cz] = room.poly[bi]; const [mx, mz] = [room.x + room.w / 2, room.z + room.d / 2]; const w = cmd.size?.w || 0.45, d = cmd.size?.d || cmd.size?.w || 0.45;
      const x = cx + (mx > cx ? 0 : -w), z = cz + (mz > cz ? 0 : -d); room.parts.push({ id, type: 'column', x, z, w, d });
    } else if (kind === 'wall') {
      // 見ている壁から部屋の中へ直角に出る袖壁
      const e = nearestEdge(room, pt); const f = edgeFrame(room, e); const { u } = wallUV(room, e, pt); const len = cmd.size?.w || 0.9; const uu = Math.min(f.L - 0.1, Math.max(0.1, u));
      const a = f.origin.clone().addScaledVector(f.along, uu), b = a.clone().addScaledVector(f.normal, len); room.parts.push({ id, type: 'wall', x1: a.x, z1: a.z, x2: b.x, z2: b.z, h: cmd.size?.h || H });
    } else {
      // 部屋を横切る梁(見ている向きに直交)
      const horiz = room.w >= room.d; const bw = horiz ? room.w : 0.3, bdp = horiz ? 0.3 : room.d; const x = horiz ? room.x : Math.min(room.x + room.w - 0.3, Math.max(room.x, pt.x - 0.15)), z = horiz ? Math.min(room.z + room.d - 0.3, Math.max(room.z, pt.z - 0.15)) : room.z;
      room.parts.push({ id, type: 'beam', x, z, w: bw, d: bdp, drop: cmd.size?.h || 0.3 });
    }
    this.rebuildHouse(); this.touched(); this.toast({ column: '柱型を足しました(間取りで動かせます)', wall: '袖壁を足しました(間取りで動かせます)', beam: '梁(下がり天井)を足しました' }[kind]); return id;
  }
  addOpening(room, o) {
    this.snapshot(); o.id = o.id || uid(); room.openings = room.openings || []; room.openings.push(o);
    normalizeRoom(room); if (o.type === 'door') { const nb = neighborAcross(room, o.edge, o.u, o.w, this.project.rooms); if (nb) { const r2 = nb.room; r2.openings = r2.openings || []; r2.openings.push({ id: uid(), edge: nb.edge, type: 'door', u: nb.u, w: o.w, h: o.h, twin: o.id }); } }
    this.rebuildHouse(); this.touched(); return o;
  }
  removeOpening(room, id) { const o = (room.openings || []).find(x => x.id === id); if (!o) return; this.snapshot(); room.openings = room.openings.filter(x => x.id !== id); for (const r of this.project.rooms) r.openings = (r.openings || []).filter(x => x.twin !== id && x.id !== o.twin); this.rebuildHouse(); this.touched(); }

  // ---------- 部屋 ----------
  openNewRoom(pre) { this.openSheet('newroom'); if (pre && pre.size) { if (pre.size.w) $('#nrW').value = pre.size.w; if (pre.size.d) $('#nrD').value = pre.size.d; } if (pre && pre.name) $('#nrName').value = pre.name; if (pre && pre.shape) { this._shape = pre.shape; for (const x of $$('#roomShapes .chip')) x.classList.toggle('on', x.dataset.shape === pre.shape); } }
  makeNewRoom() {
    if (!this.project) this.project = this.blankProject(); const w = parseFloat($('#nrW').value) || 3.6, d = parseFloat($('#nrD').value) || 2.7, h = parseFloat($('#nrH').value) || 2.4; const name = $('#nrName').value || '部屋';
    const b = houseBounds(this.project.rooms); const x = this.project.rooms.length ? b.maxX + WALL_T : 0, z = this.project.rooms.length ? b.minZ : 0; if (this._shape === 'bay') { /* 出窓は北側にはみ出す */ }
    const shape = this._shape || 'rect'; const room = { id: 'r' + Date.now().toString(36), name, x, z, w, d, h, poly: shapePoly(shape, x, z, w, d), floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: {}, openings: [], parts: [] }; normalizeRoom(room);
    if (shape === 'column') room.parts.push({ id: uid(), type: 'column', x: x + w - 0.45, z, w: 0.45, d: 0.45 });
    if ($('#nrWin').checked) { let best = null, bl = 0; for (let e = 0; e < room.poly.length; e++) { const f = edgeFrame(room, e); if (f.normal.z > 0.7 && f.L > bl) { best = e; bl = f.L; } } if (best !== null) { const ww = Math.min(1.65, bl - 0.6); if (ww > 0.5) room.openings.push({ id: uid(), edge: best, type: 'window', u: (bl - ww) / 2, w: ww, h: bl > 2 ? 1.8 : 1.1, sill: bl > 2 ? 0.4 : 0.9 }); } }
    const first = !this.project.rooms.length; this.project.rooms.push(room); if (first) { this.project.name = name; this.project.items.push(newItem('ceilingLight', { roomId: room.id, x: x + w / 2, y: h, z: z + d / 2 })); }
    this.load(this.project); this.closeSheets(); this.s3.camera.position.set(x + w / 2, 1.5, z + d * 0.8); this.walk.yaw = 0; this.walk.pitch = 0;
    if (this._afterRoom) { const f = this._afterRoom; this._afterRoom = null; f(); return; }
    this.toast(first ? '部屋ができました。「＋置く」でカーテンや照明を置けます' : '部屋を足しました(右どなりに置きました。間取りで動かせます)');
  }

  // ---------- 保存など ----------
  async saveAs() { const name = prompt('名前を付けて保存', this.project.name || '部屋'); if (name == null) return; this.project.name = name; await saveProject(this.project, 'p_' + Date.now().toString(36)); await saveProject(this.project, 'current'); this.toast('保存しました:' + name); this.closeSheets(); }
  async openList() { const list = (await listProjects()).filter(p => p.id !== 'current'); if (!list.length) { this.toast('保存したものはまだありません(自動保存は「前回のつづき」から開けます)'); return; }
    const html = '<p>開くものを選んでください</p><div class="sel-list">' + list.map(p => `<button data-id="${p.id}"><span>${p.name}</span><small>${new Date(p.updated).toLocaleDateString('ja-JP')}</small></button>`).join('') + '</div>';
    const pr = this.dialog(html, [{ label: 'やめる', value: null }]); for (const b of $$('#dialogBody [data-id]')) b.onclick = async () => { $('#dialog').classList.add('hidden'); const p = await loadProject(b.dataset.id); if (p) { this.load(p); this.closeSheets(); this.toast('開きました:' + p.name); } }; await pr; }
  async shot() { this.closeSheets(); this.selHelper.visible = false; this.pinMesh.visible = false; const blob = await this.s3.screenshot(); this.updateSelHelper(); this.pinMesh.visible = !!this.pin; const r = await shareOrDownload(blob, 'oheya3d.jpg', 'おへや3D'); if (r === 'downloaded') this.toast('画像を保存しました'); }
  async aiSettings() {
    const cur = AI.getKey(); const html = `<p><b>AIの設定(任意)</b></p><p>Google の Gemini の鍵(APIキー)を入れると、自由な言い方の指示や、写真から部屋の広さを読み取る機能が使えます。鍵は この端末の中にだけ保存します。</p><input id="aiKey" type="password" placeholder="AIza… の鍵" value="${cur ? cur : ''}">`;
    const r = await this.dialog(html, [{ label: '消す', value: 'clear', danger: true }, { label: 'やめる', value: null }, { label: '保存', value: 'save', primary: true }]);
    if (r === 'save') { AI.setKey($('#aiKey').value.trim()); this.toast(AI.hasKey() ? 'AIの鍵を保存しました' : '鍵が空です'); } else if (r === 'clear') { AI.setKey(''); this.toast('鍵を消しました'); }
  }
  firstHelp() { try { if (localStorage.getItem('oheya-help-seen')) { this.toast('左側を指でなぞると歩けます。右側で見回せます。'); return; } localStorage.setItem('oheya-help-seen', '1'); } catch {} this.help(); }
  // 置いたものの寸法一覧(見積りの下書きに)
  listItems() {
    const colorName = hex => { let best = '', bd = 1e9; const c = new THREE.Color(hex || '#ffffff'); for (const [n, h] of Object.entries(COLORS)) { const d = new THREE.Color(h); const dist = (c.r - d.r) ** 2 + (c.g - d.g) ** 2 + (c.b - d.b) ** 2; if (dist < bd) { bd = dist; best = n; } } return best; };
    const lines = []; for (const r of this.project.rooms) { const its = this.project.items.filter(i => i.roomId === r.id); if (!its.length) continue; lines.push(`■ ${r.name}(${r.w.toFixed(1)}×${r.d.toFixed(1)}m・天井${r.h.toFixed(2)}m)`);
      for (const it of its) { const c = catalogEntry(it.type); const f = it.fabric ? ((SURFACE_LIB.fabric.find(x => x.id === it.fabric) || {}).name || '') : ''; const size = c.kind === 'floor' ? `幅${it.w.toFixed(2)}×奥行${it.d.toFixed(2)}×高さ${it.h.toFixed(2)}m` : c.kind === 'wall' ? `幅${it.w.toFixed(2)}×丈${it.h.toFixed(2)}m` : `直径${it.w.toFixed(2)}m`; lines.push(`・${c.name} ${size} ${colorName(it.color)}${f ? '・' + f : ''}`); }
      const wins = (r.openings || []).filter(o => o.type === 'window'); for (const o of wins) lines.push(`  窓(${edgeName(r, o.edge)}) 幅${o.w.toFixed(2)}×高さ${o.h.toFixed(2)}m 床から${(o.sill ?? 0.9).toFixed(2)}m`); for (const pt of (r.parts || [])) lines.push(pt.type === 'column' ? `  柱型 ${pt.w.toFixed(2)}×${pt.d.toFixed(2)}m` : pt.type === 'wall' ? `  袖壁 長さ${Math.hypot(pt.x2 - pt.x1, pt.z2 - pt.z1).toFixed(2)}m 高さ${(pt.h || r.h).toFixed(2)}m` : `  梁 下がり${(pt.drop || 0.3).toFixed(2)}m`); }
    const text = lines.join('\n') || 'まだ何も置いていません'; this.dialog(`<p><b>置いたものの一覧</b></p><textarea readonly style="height:220px">${text.replace(/</g, '&lt;')}</textarea>`, [{ label: 'とじる', value: null }, { label: 'コピー', value: 'copy' }, { label: '送る', value: 'share', primary: true }]).then(async r => { if (r === 'copy') { await navigator.clipboard.writeText(text); this.toast('コピーしました'); } if (r === 'share') { if (navigator.share) { try { await navigator.share({ title: 'おへや3D 一覧', text }); } catch {} } else { await navigator.clipboard.writeText(text); this.toast('コピーしました'); } } });
  }
  help() { this.dialog(`<p><b>使い方</b></p><p>👣 <b>歩く</b>:画面の左側を指でなぞると歩き、右側で見回します。PCは W A S D とマウス。</p><p>＋ <b>置く</b>:見ている場所(中央の○)に置きます。床をタップして場所を決めてから置いてもOK。</p><p>🎤 <b>言葉で</b>:「ここにカーテンをつけて」「床をフローリングに」「壁を白に」「シャンデリアを消して」「夜にして」「窓をつけて」など。</p><p>🧱 <b>床・壁</b>:見ている面の素材を変えます。見本帳の写真も貼れます。</p><p>📷 <b>写真</b>:部屋の写真を壁に貼って、本物そっくりの部屋を作ります。</p><p>📐 <b>間取り</b>:部屋を足して ドアでつなぐと、家全体を歩けます。</p><p>☰ メニュー:置いたものの寸法一覧(見積りの下書き)、ぐるっと一周見回す(紹介動画用)、昼・夕方・夜、立つ/座る、保存・書き出し。↶ でひとつ前にもどせます。</p><p>保存は自動です(「前回のつづき」)。</p>`, [{ label: 'とじる', primary: true }]); }
}

export function fileToDataUrl(file, max = 1600, quality = 0.88) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', quality)); URL.revokeObjectURL(img.src); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
}

try { new App(); document.body.classList.add('ready'); }
catch (e) { console.error(e); const el = document.querySelector('.start-inner'); if (el) el.insertAdjacentHTML('beforeend', `<p style="color:#ff6b6b;font-size:16px;line-height:1.6">3Dの準備に失敗しました。ブラウザを最新にするか、別のブラウザ(Chrome / Safari)で開いてみてください。<br><small>${String(e.message || e).replace(/</g, '&lt;')}</small></p>`); }
