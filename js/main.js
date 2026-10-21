// おへや3D 本体:画面と3Dをつなぐ
import * as THREE from 'three';
import { Scene3D } from './scene3d.js';
import { WalkControls } from './controls.js';
import { buildHouse, walkable, groundAt, baseOf, levelOf, setFloorH, floorH, hasUpper, onLevel, roomAt, houseBounds, edgeFrame, wallPoint, wallUV, wallLength, edgeName, edgeForCompass, nearestEdge, edgeDistance, frameFromRot, clampIntoRoom, insideRoom, neighborAcross, normalizeRoom, shapePoly, chamferVertex, isRect, resizeRect, WALL_T, MODULES, ROOM_PRESETS, ROOM_SHAPES, shapeIconSVG, mm, mmRaw, joOf, innerOf, shinShin, roomJo, roomTrim } from './house.js';
import { CATALOG, CATEGORIES, EQUIP_CATEGORIES, newItem, buildItem, catalogEntry, typeByWord } from './items.js';
import { SURFACE_LIB, COLORS, colorByName, swatchCanvas, clearMaterialCache, libEntry, TRIM_FINISHES, trimMaterial, trimFinish } from './textures.js';
import { demoProject } from './demo.js';
import { saveProject, loadProject, listProjects, deleteProject, download, shareOrDownload } from './store.js';
import { parseCommand } from './commands.js';
import { openPhotoWizard } from './photo.js';
import { PlanEditor } from './plan.js';
import * as AI from './ai.js';
import { stairLayout as stairLayoutOf, STAIR_CELLS, stairKindName } from './stairs.js';
import { thumbnail } from './thumbs.js';

const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => 'o' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

class App {
  constructor() {
    this.canvas = $('#gl'); this.s3 = new Scene3D(this.canvas);
    this.project = null; this.selectedId = null; this.pin = null; this.mode = 'walk'; this.dirty = false; this.itemGroups = new Map(); this.currentRoomId = null;
    this.walk = new WalkControls(this.s3.camera, this.canvas, { canWalk: p => this.project ? walkable(p, this.project.rooms, 0.25, this.walk.floorY) : true, ground: p => this.project ? groundAt(p, this.project.rooms, this.walk.floorY) : 0, onTap: (x, y, e) => this.onTap(x, y, e), joyEl: $('#joy'), knobEl: $('#joyKnob'),
      hitTest: (x, y) => { const h = this.hitAt(x, y); return h && h.itemId ? { itemId: h.itemId, selected: h.itemId === this.selectedId, point: h.point } : null; }, onDragItem: (ph, e, h) => this.dragItem(ph, e, h),
      onDoubleTap: (x, y, e) => this.onDoubleTap(x, y, e), onZoom: (k, step, pinch) => { if (step) { this.setZoom(this.s3.zoom * k); return; } if (pinch) { if (!pinch.z0) pinch.z0 = this.s3.zoom; this.setZoom(pinch.z0 * k, true); } else this.zoomLabel(true); } });
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
  openSheet(id) { for (const s of $$('.sheet')) if (s.id !== id) s.classList.add('hidden'); $('#' + id).classList.remove('hidden'); if (this.s3) setTimeout(() => this.updateInset(), 30); }
  closeSheets() { for (const s of $$('.sheet')) s.classList.add('hidden'); if (this.s3) this.updateInset(); }
  bindUI() {
    for (const b of $$('[data-close]')) b.onclick = () => $('#' + b.dataset.close).classList.add('hidden');
    for (const b of $$('#modes .mode')) b.onclick = () => this.setMode(b.dataset.mode);
    $('#btnHome').onclick = () => { $('#start').classList.remove('hidden'); this.refreshContinue(); };
    $('#btnMenu').onclick = () => this.openSheet('menu'); $('#btnUndo').onclick = () => this.undo(); $('#btnRedo').onclick = () => this.redo(); $('#plUndo').onclick = () => this.undo(); $('#plRedo').onclick = () => this.redo();
    $('#btnAdd').onclick = () => this.openCatalog(false); $('#btnEquip').onclick = () => this.openCatalog(true);
    $('#btnPhoto').onclick = () => { this.closeSheets(); openPhotoWizard(this); };
    $('#btnMaterial').onclick = () => this.openSurfaces();
    $('#btnDayNight').onclick = () => this.setDaytime({ day: 'evening', evening: 'night', night: 'day' }[this.project.settings.daytime || (this.project.settings.night ? 'night' : 'day')]);
    $('#btnShot').onclick = () => this.shot();
    $('#zoomIn').onclick = () => this.setZoom(this.s3.zoom * 1.25); $('#zoomOut').onclick = () => this.setZoom(this.s3.zoom / 1.25); $('#zoomReset').onclick = () => this.setZoom(1); this.zoomLabel();
    $('#btnSend').onclick = () => this.runCommand($('#cmd').value);
    $('#cmd').addEventListener('keydown', e => { if (e.key === 'Enter') { this.runCommand($('#cmd').value); $('#cmd').blur(); } });
    $('#btnMic').onclick = () => this.mic();
    for (const b of $$('#edit [data-mv]')) b.onclick = () => this.editMove(b.dataset.mv);
    for (const b of $$('#editTabs [data-etab]')) b.onclick = () => this.editTab(b.dataset.etab);
    { const grab = $('#editGrab'); let y0 = null, h0 = 0; grab.addEventListener('pointerdown', e => { y0 = e.clientY; h0 = $('#edit').getBoundingClientRect().height; try { grab.setPointerCapture(e.pointerId); } catch {} }); grab.addEventListener('pointermove', e => { if (y0 === null) return; const dy = y0 - e.clientY; if (Math.abs(dy) > 30) { this.editHeight(dy > 0 ? 'high' : 'low'); y0 = null; } }); grab.addEventListener('pointerup', e => { if (y0 !== null && Math.abs(y0 - e.clientY) < 8) this.editHeight($('#edit').classList.contains('high') ? 'low' : 'high'); y0 = null; }); }
    { const pk = $('#editPeek'); const on = e => { e.preventDefault(); try { pk.setPointerCapture(e.pointerId); } catch {} document.body.classList.add('peeking'); this.updateInset(); }; const off = () => { if (!document.body.classList.contains('peeking')) return; document.body.classList.remove('peeking'); this.updateInset(); }; pk.addEventListener('pointerdown', on); pk.addEventListener('pointerup', off); pk.addEventListener('pointercancel', off); pk.addEventListener('pointerleave', off); pk.addEventListener('contextmenu', e => e.preventDefault()); }
    $('#edit [data-close=edit]').onclick = () => this.select(null);
    if (window.ResizeObserver) new ResizeObserver(() => this.updateInset()).observe($('#edit'));
    window.addEventListener('resize', () => this.updateInset());
    $('#mSave').onclick = () => this.saveAs();
    $('#mOpen').onclick = () => this.openList();
    $('#mExport').onclick = () => { const blob = new Blob([JSON.stringify(this.project)], { type: 'application/json' }); download(blob, (this.project.name || 'oheya') + '.json'); this.toast('ファイルに書き出しました'); };
    $('#mImport').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const p = JSON.parse(t); if (!p.rooms) throw 0; this.load(p); this.closeSheets(); this.toast('読み込みました'); } catch { this.toast('このファイルは読めませんでした'); } }); e.target.value = ''; };
    const gyro = () => { const on = this.walk.setGyro(!this.walk.gyro.on); setTimeout(() => { const now = this.walk.gyro.on; $('#mGyro').textContent = now ? '📱 傾きで見回す:ON(押すと止める)' : '📱 スマホを動かして見回す'; $('#btnGyro').classList.toggle('on', now); this.toast(now ? 'スマホを動かすと見回せます(もう一度押すと止まります)' : '傾き操作を止めました'); }, 300); void on; }; $('#mGyro').onclick = gyro; $('#btnGyro').onclick = () => { this.setMode('walk'); gyro(); };
    $('#mQuality').onclick = () => { const q = { normal: 'high', high: 'low', low: 'normal' }[this.s3.quality]; this.s3.quality = q; this.s3.applyQuality(); localStorage.setItem('oheya-quality', q); $('#mQuality').textContent = '🎚 画質:' + { low: 'かるい', normal: 'ふつう', high: 'きれい' }[q]; };
    for (const b of $$('#levelBar button')) b.onclick = () => this.goLevel(b.dataset.lv === 'all' ? 'all' : +b.dataset.lv);
    $('#mAI').onclick = () => this.aiSettings();
    $('#mModule').onclick = () => { this.setModule(this.module() === 'shaku' ? 'meter' : 'shaku'); };
    $('#mHelp').onclick = () => this.help();
    $('#mSpin').onclick = () => { this.closeSheets(); this.setMode('walk'); this.spin = 14; this.toast('ゆっくり一周します(14秒)。画面を録画すると紹介動画になります', 3500); };
    $('#mList').onclick = () => { this.closeSheets(); this.listItems(); };
    $('#mEye').onclick = () => { this.walk.eye = this.walk.eye > 1.3 ? 1.15 : 1.5; $('#mEye').textContent = this.walk.eye > 1.3 ? '👀 目の高さ:立っている(押すと座る)' : '👀 目の高さ:座っている(押すと立つ)'; this.toast(this.walk.eye > 1.3 ? '立った高さで見ています' : '座った高さで見ています(ソファからの眺め)'); };
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this._install = e; $('#mInstall').classList.remove('hidden'); this.installNote(); });
    window.addEventListener('appinstalled', () => { this.toast('ホーム画面に入りました(アプリ一覧にも「おへや3D」が入ります)'); this.installNote(); }); this.installNote();
    $('#mInstall').onclick = async () => { if (!this._install) return; this._install.prompt(); const r = await this._install.userChoice; if (r.outcome === 'accepted') { $('#mInstall').classList.add('hidden'); this.toast('ホーム画面に入れました'); } this._install = null; };
    $('#mShare').onclick = async () => { const url = location.origin + location.pathname; if (navigator.share) { try { await navigator.share({ title: 'おへや3D', text: '写真から部屋を3Dにして歩き回れるアプリ', url }); } catch {} } else { await navigator.clipboard.writeText(url); this.toast('アドレスをコピーしました'); } };
    $('#sDemo').onclick = () => { this.load(demoProject()); $('#start').classList.add('hidden'); this.firstHelp(); };
    $('#sNew').onclick = async () => { if (this.project && this.project.rooms.length) { const r = await this.dialog('<p>いまの家に部屋を足しますか? それとも新しく始めますか?</p>', [{ label: 'やめる', value: null }, { label: '新しく始める', value: 'new' }, { label: 'いまの家に足す', value: 'add', primary: true }]); if (!r) return; if (r === 'new') { this.load(this.blankProject()); } } $('#start').classList.add('hidden'); this.openNewRoom(); };
    $('#sPhoto').onclick = () => { $('#start').classList.add('hidden'); if (!this.project) this.load(this.blankProject()); openPhotoWizard(this); };
    $('#sContinue').onclick = async () => { const p = await loadProject('current'); if (p) { this.load(p); $('#start').classList.add('hidden'); } else this.toast('保存はまだありません'); };
    $('#nrMake').onclick = () => this.makeNewRoom();
    for (const [k, info] of Object.entries(MODULES)) { const b = document.createElement('button'); b.className = 'chip text'; b.textContent = info.name; b.dataset.module = k; b.onclick = () => this.setModule(k); $('#roomModules').appendChild(b); }
    for (const id of ['nrW', 'nrD', 'nrH']) $('#' + id).addEventListener('input', () => this.updateRoomNote());
    this.fillPresets();
    this._shape = 'rect'; for (const [k, n, desc] of ROOM_SHAPES) { const b = document.createElement('button'); b.className = 'shape-chip' + (k === 'rect' ? ' on' : ''); b.dataset.shape = k; b.title = desc; b.innerHTML = `${shapeIconSVG(k)}<span>${n}</span>`; b.onclick = () => { this._shape = k; for (const x of $$('#roomShapes .shape-chip')) x.classList.toggle('on', x.dataset.shape === k); $('#shapeNote').textContent = desc; }; $('#roomShapes').appendChild(b); }
    const q = localStorage.getItem('oheya-quality'); if (q) { this.s3.quality = q; this.s3.applyQuality(); $('#mQuality').textContent = '🎚 画質:' + { low: 'かるい', normal: 'ふつう', high: 'きれい' }[q]; }
    window.addEventListener('beforeunload', () => { if (this.dirty && this.project) { try { localStorage.setItem('oheya-last', JSON.stringify(this.project)); } catch {} } });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  initStart() {
    this.refreshContinue(); this.watchUpdate();
    let resume = false; try { resume = sessionStorage.getItem('oheya-resume') === '1'; sessionStorage.removeItem('oheya-resume'); } catch {}
    if (resume) { loadProject('current').then(p => { if (p) { this.load(p); $('#start').classList.add('hidden'); this.toast('新しい版になりました'); } }).catch(() => {}); return; }
    if (location.hash === '#demo') { this.load(demoProject()); $('#start').classList.add('hidden'); } }
  // 新しい版が出たら知らせる(アプリを開きなおしたとき・画面に戻ったとき)
  watchUpdate() {
    const check = async () => {
      if (!window.OHEYA_VER || window.OHEYA_VER === 'x' || this._updBar) return;
      try { const j = await (await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })).json(); if (j && j.v && j.v !== window.OHEYA_VER) this.showUpdate(); } catch {}
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000); setTimeout(check, 60 * 1000);
  }
  showUpdate() {
    if (this._updBar) return; const b = document.createElement('button'); b.id = 'updBar'; b.type = 'button'; b.textContent = '🆕 新しい版があります(押すと更新)'; this._updBar = b;
    b.onclick = async () => { b.textContent = '更新しています…'; try { if (this.project && this.project.rooms.length) { await saveProject(this.project, 'current'); sessionStorage.setItem('oheya-resume', '1'); } } catch {} location.reload(); };
    document.body.appendChild(b);
  }
  async refreshContinue() { try { const list = await listProjects(); const cur = list.find(p => p.id === 'current'); $('#sContinueSub').textContent = cur ? new Date(cur.updated).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' の保存' : '保存なし'; } catch { } }
  blankProject() { return { v: 1, name: '部屋', rooms: [], items: [], assets: {}, settings: { night: false, module: this.module() } }; }
  module() { return (this.project && this.project.settings && this.project.settings.module) || localStorage.getItem('oheya-module') || 'shaku'; }
  setModule(m, silent) { if (this.project) this.project.settings.module = m; try { localStorage.setItem('oheya-module', m); } catch {} const info = MODULES[m]; $('#mModule').textContent = `📏 ${info.name}(${mm(info.grid)}mm)`; if (!silent) { this.toast(`${info.name}にしました。${info.note}`, 3500); this.touched(); if (this.mode === 'plan') this.plan.draw(); } this.fillPresets(); }

  // ---------- 読み込み・組み立て ----------
  // いまの視点のまま組み立て直す
  reload() { const cam = { x: this.s3.camera.position.x, z: this.s3.camera.position.z, yaw: this.walk.yaw, pitch: this.walk.pitch, gy: this.walk.floorY, lv: this.levelView }; const mode = this.mode; this.load(this.project); this.walk.floorY = cam.gy; this.levelView = cam.lv; this.s3.camera.position.set(cam.x, cam.gy + 1.5, cam.z); this.walk.yaw = cam.yaw; this.walk.pitch = cam.pitch; this.setMode(mode); }
  load(p) {
    this.project = p; p.assets = p.assets || {}; p.items = p.items || []; p.settings = p.settings || {}; setFloorH(p.settings.floorH || 2.9); for (const r of (p.rooms || [])) normalizeRoom(r); this.selectedId = null; this.setPin(null);
    clearMaterialCache(); this.rebuildHouse(); this.rebuildItems(); this.setDaytime(p.settings.daytime || (p.settings.night ? 'night' : 'day'), true);
    const b = houseBounds(p.rooms); this.s3.setSunTarget((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 2);
    if (p.camera) { this.walk.floorY = p.camera.gy || 0; this.s3.camera.position.set(p.camera.x, this.walk.floorY + 1.5, p.camera.z); this.walk.yaw = p.camera.yaw || 0; this.walk.pitch = 0; }
    else if (p.rooms[0]) { const r = p.rooms.find(x => !levelOf(x) && !x.stair) || p.rooms[0]; this.walk.floorY = baseOf(r); this.s3.camera.position.set(r.x + r.w / 2, this.walk.floorY + 1.5, r.z + r.d * 0.8); this.walk.yaw = 0; this.walk.pitch = 0; }
    this.levelView = null; this.applyLevels();
    this.fitOrbit(); this.setMode(this.mode === 'plan' ? 'plan' : 'walk'); this.setModule(this.module(), true); this.dirty = false; this.touched();
  }
  rebuildHouse() {
    const g = this.s3.houseGroup; while (g.children.length) g.remove(g.children[0]);
    const { group, pick } = buildHouse(this.project); g.add(group); this.housePick = pick;
    // 全体表示のときの部屋の名前
    this.labels = new THREE.Group(); this.labels.name = 'labels'; g.add(this.labels);
    for (const r of this.project.rooms) { const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); if (x.roundRect) x.roundRect(8, 8, 240, 64, 18); else x.rect(8, 8, 240, 64); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(r.name, 128, 42); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.position.set(r.x + r.w / 2, baseOf(r) + Math.min(r.h, 2.5) + 0.5, r.z + r.d / 2); sp.userData.level = levelOf(r); sp.scale.set(1.6, 0.5, 1); sp.renderOrder = 20; this.labels.add(sp); }
    this.applyCeilingVisibility();
  }
  rebuildItems() { const g = this.s3.itemGroup; while (g.children.length) g.remove(g.children[0]); this.itemGroups.clear(); for (const it of this.project.items) this.addItemMesh(it); this.updateShadowLights(); this.applyEquipVisibility(); }
  applyEquipVisibility() { for (const [id, g] of this.itemGroups) { const it = this.item(id); const e = it && catalogEntry(it.type); if (e && e.equip) g.visible = !this.hideEquip; } }
  addItemMesh(it) { let m = null; try { if (!it.opts) it.opts = {}; m = buildItem(it, this.project.assets); } catch (e) { console.warn('item build failed', it.type, e); } if (!m) return; m.position.y += this.base(it.roomId); this.s3.itemGroup.add(m); this.itemGroups.set(it.id, m); return m; }
  rebuildItem(it, keep) { if (!keep) this.snapshot(); const old = this.itemGroups.get(it.id); if (old) this.s3.itemGroup.remove(old); this.addItemMesh(it); this.updateShadowLights(); this.updateSelHelper(); this.touched(); }
  updateItemPose(it) { const m = this.itemGroups.get(it.id); if (m) { m.position.set(it.x, it.y + this.base(it.roomId), it.z); m.rotation.y = it.rot || 0; } this.updateSelHelper(); this.touched(); }
  updateShadowLights() {
    const cam = this.s3.camera.position; let n = 0;
    const lvNow = this.walkLevel(); const cands = this.project.items.filter(it => ['ceilingLight', 'pendant', 'chandelier'].includes(it.type) && (this.mode === 'orbit' || levelOf(this.room(it.roomId)) === lvNow)).map(it => ({ it, d: Math.hypot(it.x - cam.x, it.z - cam.z) })).sort((a, b) => a.d - b.d);
    for (const it of this.project.items) { const g = this.itemGroups.get(it.id); if (g) for (const l of g.userData.lights || []) l.castShadow = false; }
    for (const { it } of cands) { const g = this.itemGroups.get(it.id); if (!g) continue; for (const l of g.userData.lights || []) { l.castShadow = n < (this.s3.quality === 'high' ? 2 : 1) && this.s3.quality !== 'low'; } n++; }
  }
  applyCeilingVisibility() { const hide = this.mode === 'orbit'; if (this.labels) this.labels.visible = hide; this.s3.houseGroup.traverse(o => { if (o.userData && o.userData.kind === 'ceiling') o.visible = !hide; }); this.s3.itemGroup.traverse(o => { if (o.userData && o.userData.itemId) { const it = this.item(o.userData.itemId); if (it && catalogEntry(it.type).kind === 'ceiling' && o.parent === this.s3.itemGroup) o.visible = true; } }); }
  // もどす(取り消し)用に、変える前の状態をとっておく
  snapshot() { if (!this.project) return; this._undo = (this._undo || []); this._undo.push(JSON.stringify({ ...this.project, assets: undefined })); if (this._undo.length > 50) this._undo.shift(); this._redo = []; this.histButtons(); }
  histButtons() { const u = !(this._undo && this._undo.length), r = !(this._redo && this._redo.length); for (const id of ['btnUndo', 'plUndo']) { const b = $('#' + id); if (b) b.disabled = u; } for (const id of ['btnRedo', 'plRedo']) { const b = $('#' + id); if (b) b.disabled = r; } }
  _restore(json) { const assets = this.project.assets; const p = JSON.parse(json); p.assets = assets; const cam = { x: this.s3.camera.position.x, z: this.s3.camera.position.z, yaw: this.walk.yaw, pitch: this.walk.pitch, gy: this.walk.floorY, lv: this.levelView }; const mode = this.mode; this.load(p); this.walk.floorY = cam.gy; this.levelView = cam.lv; this.s3.camera.position.set(cam.x, cam.gy + 1.5, cam.z); this.walk.yaw = cam.yaw; this.walk.pitch = cam.pitch; this.setMode(mode); if (mode === 'plan') { this.plan.sel = null; this.plan.info(null); this.plan.draw(); } }
  undo() { if (!this._undo || !this._undo.length) { this.toast('もどすものがありません'); return; } (this._redo = this._redo || []).push(JSON.stringify({ ...this.project, assets: undefined })); this._restore(this._undo.pop()); this.toast('ひとつ前にもどしました'); this.histButtons(); }
  redo() { if (!this._redo || !this._redo.length) { this.toast('進むものがありません'); return; } (this._undo = this._undo || []).push(JSON.stringify({ ...this.project, assets: undefined })); this._restore(this._redo.pop()); this.toast('ひとつ進めました'); this.histButtons(); }
  touched() { this.dirty = true; clearTimeout(this._save); this._save = setTimeout(() => { if (this.project && this.project.rooms.length) { this.project.camera = { x: this.s3.camera.position.x, z: this.s3.camera.position.z, yaw: this.walk.yaw, gy: this.walk.floorY }; saveProject(this.project, 'current').then(() => { this.dirty = false; }).catch(() => {}); } }, 1500); if (this.mode === 'plan') this.plan.draw(); }
  item(id) { return this.project.items.find(i => i.id === id) || null; }
  room(id) { return this.project.rooms.find(r => r.id === id) || null; }
  currentRoom() { return roomAt(this.s3.camera.position, this.project.rooms, { gy: this.walk.floorY }) || this.project.rooms[0] || null; }
  base(roomId) { return baseOf(this.room(roomId)); }
  // いま歩いている階(階段の中は、近いほうの階)
  walkLevel() { return Math.max(0, Math.round(this.walk.floorY / floorH())); }
  // 見える階と照明:歩くときは今いる階の照明だけ点ける(下の階に光がもれないように)。全体表示は選んだ階まで見せる
  applyLevels() {
    if (!this.project) return; const upper = hasUpper(this.project.rooms); const lvWalk = this.walkLevel();
    const showTo = this.mode === 'orbit' && this.levelView != null ? this.levelView : 9;
    for (const g of this.s3.houseGroup.children) for (const rg of (g.children || [])) { if (rg.userData && rg.userData.level !== undefined) { const r = this.room(rg.userData.roomId); rg.visible = !r || levelOf(r) <= showTo || !!r.stair; } }
    for (const it of this.project.items) { const g = this.itemGroups.get(it.id); if (!g) continue; const r = this.room(it.roomId); const lv = levelOf(r); g.visible = lv <= showTo;
      const on = this.mode === 'orbit' ? lv <= showTo : (lv === lvWalk || !!(r && r.stair)); for (const l of g.userData.lights || []) l.visible = on; }
    const topLv = Math.min(showTo, Math.max(0, ...this.project.rooms.map(r => levelOf(r)))); if (this.labels) for (const sp of this.labels.children) sp.visible = sp.userData.level === topLv;
    const bar = $('#levelBar'); if (bar) { bar.classList.toggle('hidden', !(upper && this.mode !== 'plan')); for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', this.mode === 'orbit' ? String(this.levelView ?? 'all') === b.dataset.lv : String(lvWalk) === b.dataset.lv); }
    this._lvShown = lvWalk;
  }
  // 階を移る(階段の上り口・2階の出口の前へ)
  goLevel(lv) {
    if (this.mode === 'orbit') { this.levelView = lv === 'all' ? null : lv; this._lvAll = lv === 'all'; this.applyLevels(); this.fitOrbit(); return; }
    const rooms = this.project.rooms; const stair = rooms.find(r => r.stair); let spot = null;
    if (stair) { const exit = (stair.openings || []).find(o => o.type !== 'window' && Math.round((o.sill || 0) / floorH()) === lv); if (exit) { const f = edgeFrame(stair, exit.edge); const c = f.origin.clone().addScaledVector(f.along, exit.u + exit.w / 2).addScaledVector(f.normal, -(WALL_T + 0.7)); spot = { x: c.x, z: c.z, yaw: Math.atan2(f.normal.x, f.normal.z) + Math.PI }; } }
    if (!spot) { const r = rooms.find(x => levelOf(x) === lv && !x.stair); if (!r) { this.toast(lv ? '2階はまだありません' : '1階がありません'); return; } spot = { x: r.x + r.w / 2, z: r.z + r.d / 2, yaw: this.walk.yaw }; }
    this.walk.floorY = lv * floorH(); this.s3.camera.position.set(spot.x, this.walk.floorY + this.walk.eye, spot.z); this.walk.yaw = spot.yaw; this.walk.pitch = 0; this.setMode('walk'); this.applyLevels(); this.updateShadowLights(); this.toast(lv ? '2階に上がりました' : '1階に下りました');
  }

  // ---------- モード ----------
  setMode(m) {
    this.mode = m; this.s3.mode = m === 'walk' ? 'walk' : 'orbit'; document.body.classList.toggle('plan-mode', m === 'plan'); document.body.classList.toggle('orbit-mode', m === 'orbit');
    for (const b of $$('#modes .mode')) b.classList.toggle('on', b.dataset.mode === m);
    this.walk.enabled = m === 'walk'; this.s3.orbit.enabled = m === 'orbit';
    $('#plan').classList.toggle('hidden', m !== 'plan'); if (m === 'plan') this.plan.show(); else this.plan.hide();
    if (m === 'orbit') { if (this.levelView === undefined || this.levelView === null && !this._lvAll) this.levelView = hasUpper(this.project.rooms) ? this.walkLevel() : null; this.fitOrbit(); } this.applyCeilingVisibility(); this.applyLevels(); this.closeSheets();
  }
  fitOrbit() { const b = houseBounds(this.project ? this.project.rooms : []); const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 3); const asp = this.s3.orbitCam.aspect || 1, k = Math.max(1, 0.8 / asp); const ty = this.project && hasUpper(this.project.rooms) && this.levelView != null ? this.levelView * floorH() : 0; this.s3.orbitCam.position.set(cx + size * 0.25 * k, ty + (size * 1.15 + 2) * k, cz + size * 1.0 * k); this.s3.orbit.target.set(cx, ty + 0.5, cz); this.s3.orbit.update(); }
  setNight(on, silent) { this.setDaytime(on ? 'night' : 'day', silent); }
  setZoom(z, quiet) { const v = this.s3.setZoom(z); this.zoomLabel(); if (!quiet) { clearTimeout(this._zt); } return v; }
  zoomLabel(fade) { const z = this.s3.zoom; const txt = Math.abs(z - 1) < 0.03 ? '標準' : z > 1 ? `アップ ×${z.toFixed(1)}` : `広く ×${z.toFixed(2)}`; $('#zoomReset').textContent = txt; $('#zoomReset').classList.toggle('on', Math.abs(z - 1) >= 0.03); }
  setDaytime(mode, silent) { this.project.settings.daytime = mode; this.project.settings.night = mode === 'night'; this.s3.setDaytime(mode); $('#btnDayNight').innerHTML = { day: '☀️<small>昼</small>', evening: '🌇<small>夕方</small>', night: '🌙<small>夜</small>' }[mode]; if (!silent) { this.toast({ day: '昼にしました', evening: '夕方にしました。西日が入ります', night: '夜にしました。照明の雰囲気が分かります' }[mode]); this.touched(); } }

  // ---------- 毎フレーム ----------
  frame(dt) {
    if (!this.project) return;
    if (this._anim) this._anim(performance.now());
    if (this.spin) { this.walk.yaw += dt * (Math.PI * 2 / 14); this.spin -= dt; if (this.spin <= 0) { this.spin = 0; this.toast('一周しました'); } }
    this.walk.update(dt);
    if (this.mode === 'walk') { this._ct = (this._ct || 0) + dt; if (this._ct > 0.12) { this._ct = 0; this.center = this.hitAt(0.5, 0.5); $('#crosshair').classList.toggle('hit', !!(this.center && this.center.kind)); } }
    const r = this.currentRoom(); if (r && r.id !== this.currentRoomId) { this.currentRoomId = r.id; this.updateShadowLights(); } if (this.walkLevel() !== this._lvShown) this.applyLevels();
    if (this.pinMesh.visible) { const s = this.pinMesh.position.distanceTo(this.s3.activeCamera().position) * 0.5 + 0.5; this.pinMesh.scale.setScalar(s); }
  }
  // 画面の位置 → 何に当たったか
  hitAt(nx, ny) {
    const h = this.s3.pick(nx, ny, [this.s3.houseGroup, this.s3.itemGroup]); if (!h) return null;
    const o = h.object; const n = h.face ? h.face.normal.clone().transformDirection(o.matrixWorld) : new THREE.Vector3(0, 1, 0);
    // point は部屋の床からの高さ(2階の部屋でも 0 が床)。world は家全体の位置
    if (o.userData.itemId) { const rid = (this.item(o.userData.itemId) || {}).roomId; const pt = h.point.clone(); pt.y -= this.base(rid); return { kind: 'item', itemId: o.userData.itemId, point: pt, world: h.point, normal: n, roomId: rid, distance: h.distance }; }
    const u = o.userData; const pt = h.point.clone(); pt.y -= this.base(u.roomId); return { kind: u.kind, roomId: u.roomId, edge: u.edge, part: u.part, partId: u.partId, openingId: u.openingId, point: pt, world: h.point, normal: n, distance: h.distance };
  }
  onTap(nx, ny, e) {
    if (this.mode !== 'walk') { if (this.mode === 'orbit') { const h = this.hitAt(nx, ny); if (h && h.kind === 'item') { this.select(h.itemId); this.setPin(null); } else if (h && h.kind) { this.select(null); this.setPin(h); this.toast('ここに置きます(＋置く)', 1500); } else { this.select(null); this.setPin(null); } } return; }
    const h = this.hitAt(nx, ny);
    if (h && h.kind === 'item') { this.select(h.itemId); return; }
    if (h && (h.kind === 'floor' || h.kind === 'wall' || h.kind === 'ceiling' || h.kind === 'window')) { this.select(null); this.setPin(h); this.toast('ここに置きます。「＋置く」で選ぶか、「ここにカーテン」と言ってください', 2200); return; }
    this.select(null); this.setPin(null);
  }
  // ダブルタップ:何でも選んで直せる
  onDoubleTap(nx, ny) {
    const h = this.hitAt(nx, ny); if (!h) return; const room = h.roomId && this.room(h.roomId);
    if (h.kind === 'item') { this.select(h.itemId); this.toast('選びました。下の欄で大きさや位置を直せます', 1800); return; }
    if (h.kind === 'floor' || h.kind === 'wall' || h.kind === 'ceiling') { this.select(null); this.setPin(h); this.openSurfaces(h.kind === 'floor' ? '床' : h.kind === 'wall' ? '壁' : '天井'); return; }
    if (h.kind === 'trim') { this.select(null); this.setPin(null); this.openSurfaces('縁・枠'); setTimeout(() => { const idx = { crown: 0, base: 1, casing: 2, door: 3 }[h.part] ?? 0; const sec = document.querySelectorAll('#surfCards .trim-sec')[idx]; if (sec) { sec.classList.add('flash'); sec.scrollIntoView({ block: 'nearest' }); setTimeout(() => sec.classList.remove('flash'), 1600); } }, 50); return; }
    if ((h.kind === 'window' || h.kind === 'door') && room) { const o = (room.openings || []).find(x => x.id === h.openingId) || (room.openings || []).find(x => x.twin === h.openingId); if (!o) return; this.select(null); this.setMode('plan'); this.plan.sel = { kind: 'opening', room, opening: o }; this.plan.info(null); this.plan.draw(); this.toast('窓・ドアの寸法はここで直せます。「歩く」で戻ります', 2500); return; }
    if (h.kind === 'stair' && room) { this.select(null); this.setMode('plan'); this.plan.setLevel(levelOf(room)); this.plan.sel = { kind: 'room', room }; this.plan.info(null); this.plan.draw(); this.toast('階段の形・つくり・向きは、下の欄で変えられます。「歩く」で戻ります', 2600); return; }
    if (h.kind === 'part' && room) { const part = (room.parts || []).find(p => p.id === h.partId); if (!part) return; this.select(null); this.setMode('plan'); this.plan.sel = { kind: 'part', room, part }; this.plan.info(null); this.plan.draw(); this.toast('寸法はここで直せます。引っぱって動かせます。「歩く」で戻ります', 2500); return; }
  }
  setPin(h) { this.pin = h; this.pinMesh.visible = !!h; if (h) { const w = h.point.clone(); w.y += this.base(h.roomId); this.pinMesh.position.copy(w).addScaledVector(h.normal, 0.01); this.pinMesh.lookAt(w.clone().add(h.normal)); } }
  target() { return this.pin || this.center || this.defaultTarget(); }
  defaultTarget() { const r = this.currentRoom(); if (!r) return null; const cam = this.s3.camera.position; const dir = new THREE.Vector3(-Math.sin(this.walk.yaw), 0, -Math.cos(this.walk.yaw)); const p = cam.clone().addScaledVector(dir, 1.5); p.y = 0; p.x = Math.min(r.x + r.w - 0.3, Math.max(r.x + 0.3, p.x)); p.z = Math.min(r.z + r.d - 0.3, Math.max(r.z + 0.3, p.z)); return { kind: 'floor', roomId: r.id, point: p, normal: new THREE.Vector3(0, 1, 0) }; }

  // ---------- 置く ----------
  openCatalog(equip = false) {
    this.openSheet('catalog'); const tabs = $('#catTabs'), cards = $('#catCards'); tabs.innerHTML = ''; const cats = equip ? EQUIP_CATEGORIES : CATEGORIES; const key = equip ? '_ecat' : '_cat'; this[key] = cats.includes(this[key]) ? this[key] : cats[0];
    $('#catTitle').textContent = equip ? '設備を付ける' : '置くもの'; $('#catHint').textContent = equip ? '見ている壁や床に付けます。コンセントやスイッチは一般的な高さに自動で付きます(あとで上下に動かせます)。' : '選ぶと、見ている場所(画面の中央の○)に置きます。';
    for (const c of cats) { const b = document.createElement('button'); b.textContent = c; b.classList.toggle('on', c === this[key]); b.onclick = () => { this[key] = c; this.openCatalog(equip); }; tabs.appendChild(b); }
    if (equip) { const hb = document.createElement('button'); hb.textContent = this.hideEquip ? '👁 設備を見せる' : '🙈 設備を隠す'; hb.onclick = () => { this.hideEquip = !this.hideEquip; this.applyEquipVisibility(); this.openCatalog(true); }; tabs.appendChild(hb); }
    cards.innerHTML = '';
    for (const [type, e] of Object.entries(CATALOG)) { if (e.cat !== this[key] || !!e.equip !== equip) continue; const b = document.createElement('button'); b.className = 'card sw'; const th = thumbnail(type); if (th) { const img = document.createElement('img'); img.src = th; img.alt = e.name; b.appendChild(img); } else b.textContent = e.emoji; const bb = document.createElement('b'); bb.textContent = e.name; b.appendChild(bb); b.onclick = () => { const it = this.place(type, this.target()); if (it) { this.closeSheets(); this.select(it.id); this.toast(e.name + 'を置きました。指で引っぱると動かせます'); } }; cards.appendChild(b); }
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
      const defaultY = v => { if (c.attachY !== undefined) v = NaN; const defY = c.attachY === 'top' ? room.h - 0.05 - it.h / 2 : (typeof c.attachY === 'number' ? c.attachY : ({ wallLight: 1.75, tv: 1.15, picture: 1.5, mirror: 1.25, clock: 1.9 }[type] ?? 1.4)); if (isWin) { it.h = Math.min(it.h, room.h - 0.1); it.y = Number.isFinite(v) ? Math.min(room.h - it.h / 2, Math.max(it.h / 2, v)) : room.h - 0.05 - it.h / 2; if (type === 'curtain' || type === 'lace') { const tp = room.h - 0.06; it.h = tp - 0.02; it.y = (tp + 0.02) / 2; } } else it.y = Number.isFinite(v) ? Math.min(room.h - it.h / 2, Math.max(it.h / 2, v)) : defY; };
      if (edge !== null && edge !== undefined) {
        const f = edgeFrame(room, edge), L = f.L; let { u, v } = wallUV(room, edge, p); if (!hitWall) v = NaN; if (over.side) u = L / 2;
        const wins = room.openings.filter(o => o.edge === edge && o.type === 'window').map(o => ({ o, cu: o.u + o.w / 2 }));
        let win = null; if (isWin && wins.length) { wins.sort((a, b) => Math.abs(a.cu - u) - Math.abs(b.cu - u)); win = wins[0]; if (Math.abs(win.cu - u) > 2.5 && hitWall) win = null; }
        if (win) { const o = win.o, top = o.sill + o.h; u = win.cu; const keepW = over.w;
          if (type === 'curtain' || type === 'lace') { it.w = keepW || o.w + 0.4; const bot = 0.02; const tp = Math.min(room.h - 0.05, top + 0.18); it.h = tp - bot; it.y = (tp + bot) / 2; }
          else { it.w = keepW || o.w + 0.1; const tp = Math.min(room.h - 0.05, top + 0.12), bot = Math.max(0.05, o.sill - 0.06); it.h = tp - bot; it.y = (tp + bot) / 2; }
          if (over.h) { it.h = over.h; if (type === 'curtain' || type === 'lace') it.y = 0.02 + it.h / 2; } }
        else defaultY(v);
        if (!isWin) { for (const { o } of wins) { const inY = it.y > o.sill - 0.02 && it.y < o.sill + o.h + 0.02; const overlap = u + it.w / 2 > o.u - 0.03 && u - it.w / 2 < o.u + o.w + 0.03; if (inY && overlap) { const left = o.u - 0.05 - it.w / 2, right = o.u + o.w + 0.05 + it.w / 2; const cands = [left, right].filter(c => c - it.w / 2 >= 0.02 && c + it.w / 2 <= L - 0.02); if (cands.length) u = cands.sort((a, b) => Math.abs(a - u) - Math.abs(b - u))[0]; } } }
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
  select(id, opts = {}) {
    const prev = this.selectedId; this.selectedId = id; this.updateSelHelper(); if (!id) { $('#edit').classList.add('hidden'); this.updateInset(); this.restoreView(); return; }
    const it = this.item(id), c = catalogEntry(it.type); const wasOpen = !$('#edit').classList.contains('hidden'); this.openSheet('edit'); $('#editName').textContent = c.name; if (!wasOpen) this.editTab(this._etab || 'color', true);
    const colors = $('#editColors'); colors.innerHTML = '';
    for (const [n, hex] of Object.entries(COLORS)) { const b = document.createElement('button'); b.className = 'chip' + (it.color === hex ? ' on' : ''); b.style.background = hex; b.title = n; b.onclick = () => { it.color = hex; this.rebuildItem(it); this.select(id); }; colors.appendChild(b); }
    const mats = $('#editMats'); mats.innerHTML = '';
    if (c.fabric !== undefined && c.fabric !== null && it.type !== 'lace') { for (const f of SURFACE_LIB.fabric) { const b = document.createElement('button'); b.className = 'card sw' + (it.fabric === f.id ? ' on' : ''); b.appendChild(swatchCanvas('fabric', f.id, f.tint ? it.color : null)); const bb = document.createElement('b'); bb.textContent = f.name; b.appendChild(bb); b.onclick = () => { it.fabric = f.id; it.userTex = null; this.rebuildItem(it); this.select(id); }; mats.appendChild(b); }
      for (const [aid, a] of Object.entries(this.project.assets)) { if (a.kind !== 'tile') continue; const b = document.createElement('button'); b.className = 'card sw' + (it.userTex === aid ? ' on' : ''); const img = document.createElement('img'); img.src = a.dataUrl; b.appendChild(img); const bb = document.createElement('b'); bb.textContent = a.name || '写真'; b.appendChild(bb); b.onclick = () => { it.userTex = aid; it.texSize = a.size || .5; it.fabric = null; this.rebuildItem(it); this.select(id); }; mats.appendChild(b); }
      const lab = document.createElement('label'); lab.className = 'filebtn'; lab.textContent = '📷 生地の写真'; const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = e => this.userTextureFor(e.target.files[0], 'fabric', it); lab.appendChild(inp); mats.appendChild(lab); }
    const params = $('#editParams'); params.innerHTML = '';
    for (const [key, name, a, b] of (c.params || [])) { const lab = document.createElement('label'); lab.textContent = name; if (a === 'bool') { const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!it.opts[key]; i.onchange = () => { it.opts[key] = i.checked; this.rebuildItem(it); }; lab.appendChild(i); } else { const i = document.createElement('input'); i.type = 'range'; i.min = a; i.max = b; i.step = (b - a) > 5 ? 1 : 0.01; i.value = it.opts[key] ?? a; let armed = false; i.addEventListener('pointerdown', () => { if (!armed) { armed = true; this.snapshot(); } }); i.addEventListener('change', () => { armed = false; }); i.oninput = () => { it.opts[key] = parseFloat(i.value); clearTimeout(this._pt); this._pt = setTimeout(() => this.rebuildItem(it, true), 60); }; lab.appendChild(i); } params.appendChild(lab); }
    const kind = c.kind; const rng = c.range || {};
    this.setupMovePad(c); this.refreshPosNums();
    { const st = $('#editStep'); st.innerHTML = ''; const cur = this.moveStep || (c.equip ? 10 : 100); for (const v of [5, 10, 50, 100]) { const b = document.createElement('button'); b.className = 'chip text' + (v === cur ? ' on' : ''); b.textContent = v + 'mm'; b.onclick = () => { this.moveStep = v; this.select(id); }; st.appendChild(b); } }
    const sizeField = (key, label, def) => { const [mn, mx] = rng[key] || def; const lab = document.createElement('label'); lab.className = 'sizef'; const span = document.createElement('span'); span.textContent = label; lab.appendChild(span);
      const num = document.createElement('input'); num.type = 'number'; num.step = 5; num.min = Math.round(mn * 1000); num.max = Math.round(mx * 1000); num.value = Math.round(it[key] * 1000); num.className = 'mmin';
      const sl = document.createElement('input'); sl.type = 'range'; sl.min = mn; sl.max = mx; sl.step = (mx - mn) > 2 ? 0.01 : 0.005; sl.value = it[key];
      let armed = false; const arm = () => { if (!armed) { armed = true; this.snapshot(); } }; sl.addEventListener('pointerdown', arm); sl.addEventListener('keydown', arm); sl.addEventListener('change', () => { armed = false; }); num.addEventListener('focus', arm); num.addEventListener('blur', () => { armed = false; });
      const apply = v => { v = Math.min(mx, Math.max(mn, v)); const old = it[key]; it[key] = v; if (key === 'w' && kind === 'ceiling') it.d = v; if (key === 'h' && kind === 'wall' && ['curtain', 'lace', 'roller', 'blind', 'vblind', 'shade', 'pleats', 'shoji'].includes(it.type)) it.y += (v - old) / -2; sl.value = v; num.value = Math.round(v * 1000); clearTimeout(this._pt); this._pt = setTimeout(() => this.rebuildItem(it, true), 60); };
      sl.oninput = () => apply(parseFloat(sl.value)); num.onchange = () => apply((parseFloat(num.value) || 0) / 1000); lab.appendChild(num); lab.appendChild(sl); params.appendChild(lab); };
    sizeField('w', kind === 'ceiling' ? '直径 mm' : '幅 mm', [0.2, 6]);
    if (!(kind === 'ceiling' && c.range && !c.range.h)) sizeField('h', kind === 'wall' && ['curtain', 'lace', 'roller', 'blind', 'vblind', 'shade', 'pleats', 'shoji'].includes(it.type) ? '丈 mm' : '高さ mm', [0.05, 3]);
    if (kind === 'floor' || (kind === 'ceiling' && c.range && c.range.d)) sizeField('d', '奥行 mm', [0.2, 4]);
    // 色・素材タブが空の物はない(色は全部にある)。選んだ物に寄る
    setTimeout(() => { this.updateInset(); if (id !== prev && !opts.noFrame) this.frameItem(id); }, 30);
  }
  editTab(name, quiet) { this._etab = name; for (const b of $$('#editTabs [data-etab]')) b.classList.toggle('on', b.dataset.etab === name); for (const p of $$('#edit .epane')) p.classList.toggle('hidden', p.dataset.pane !== name); if (!quiet) setTimeout(() => this.updateInset(), 30); }
  editHeight(h) { $('#edit').classList.toggle('high', h === 'high'); $('#edit').classList.toggle('low', h !== 'high'); setTimeout(() => { this.updateInset(); if (this.selectedId) this.frameItem(this.selectedId, true); }, 230); }
  // 編集欄でおおわれていない部分を3Dの表示の中心にする
  updateInset() {
    if (this._dragging) return; // つかんで動かしている間は、画面をずらさない
    const ed = $('#edit'); const open = !ed.classList.contains('hidden') && !document.body.classList.contains('peeking');
    if (!open) { this.s3.setInset(null); $('#crosshair').classList.remove('hidden'); return; }
    const r = ed.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight; const top = 56;
    const side = r.left > W * 0.3; // 横向き・タブレットは右側の欄
    this.s3.setInset(side ? { left: 0, top, right: W - r.left, bottom: 0 } : { left: 0, top, right: 0, bottom: H - r.top });
    $('#crosshair').classList.add('hidden');
  }
  // 選んだ物が見える部分にちょうど収まるように、カメラを向けて寄る(閉じたら戻る)
  frameItem(id, keepSaved) {
    const g = this.itemGroups.get(id), it = this.item(id); if (!g || !it) return;
    const box = new THREE.Box3().setFromObject(g, true); const cw = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()); const gyI = this.base(it.roomId); const c = this.mode === 'walk' ? cw.clone().setY(cw.y - gyI) : cw;
    const vr = this.s3.visibleRect(); const cam = this.s3.camera;
    if (this.mode === 'walk') {
      if (!this._savedView) this._savedView = { x: cam.position.x, z: cam.position.z, yaw: this.walk.yaw, pitch: this.walk.pitch, eye: this.walk.eye, gy: this.walk.floorY };
      const vf = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * vr.h / vr.H), hf = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect * vr.w / vr.W);
      const r = Math.max(sz.x, sz.y, sz.z, 0.08) * 0.5; let d = Math.max(r / Math.tan(Math.min(vf, hf) / 2) * 1.5, 0.45); d = Math.min(d, 4);
      // 低い所の小さい物は、しゃがんで見る(目の高さを下げる)
      const eyeT = (c.y < 1.0 && r < 0.4) ? Math.max(0.85, Math.min(1.5, c.y + 0.35)) : this._savedView.eye; const hd = Math.sqrt(Math.max(d * d - (eyeT - c.y) ** 2, 0.3 * 0.3)); d = hd;
      // 目より高い物は、見上げすぎない距離まで下がる(天井の物は約35°、壁の高い所の物は約30°の見上げ)
      const ecK = catalogEntry(it.type).kind, rise = c.y - eyeT; if (rise > 0.15) d = Math.max(d, rise / Math.tan(ecK === 'ceiling' ? 0.62 : 0.52), 0.8);
      const ec = catalogEntry(it.type); let dir; const rm = this.room(it.roomId); const nearWall = rm && ec.kind === 'floor' && it.type !== 'rug' && edgeDistance(rm, nearestEdge(rm, new THREE.Vector3(it.x, 0, it.z)), it.x, it.z) < 1.0;
      if (ec.kind === 'wall' || nearWall) { dir = new THREE.Vector3(-Math.sin(it.rot || 0), 0, -Math.cos(it.rot || 0)); } else { dir = new THREE.Vector3(c.x - cam.position.x, 0, c.z - cam.position.z); if (dir.lengthSq() < 1e-4) dir.set(-Math.sin(this.walk.yaw), 0, -Math.cos(this.walk.yaw)); dir.normalize(); }
      // 正面から順に、角度と距離を少しずつ変えて、立てる場所を探す(柱や袖壁でふさがれていたら、ななめから見る)
      const rooms = this.project.rooms; let pos = null; const up = new THREE.Vector3(0, 1, 0);
      search: for (const a of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]) { const dr = dir.clone().applyAxisAngle(up, a); for (const k of [1, 0.85, 0.7, 1.2, 1.45, 0.55]) { const dd = d * k; const p = new THREE.Vector3(c.x - dr.x * dd, cam.position.y, c.z - dr.z * dd); if (walkable(p, rooms, 0.15, gyI)) { pos = p; break search; } } }
      if (!pos) pos = cam.position.clone();
      const to = new THREE.Vector3(c.x - pos.x, c.y - eyeT, c.z - pos.z); const yaw = Math.atan2(-to.x, -to.z), pitch = Math.max(-1.25, Math.min(1.25, Math.atan2(to.y, Math.hypot(to.x, to.z))));
      this.animateView({ x: pos.x, z: pos.z, yaw, pitch, eye: eyeT, gy: gyI });
    } else if (this.mode === 'orbit') {
      if (!this._savedOrbit) this._savedOrbit = { pos: this.s3.orbitCam.position.clone(), target: this.s3.orbit.target.clone() };
      const r = Math.max(sz.x, sz.y, sz.z, 0.3); const off = this.s3.orbitCam.position.clone().sub(this.s3.orbit.target).normalize().multiplyScalar(Math.max(1.6, r * 3.2)); this.s3.orbit.target.copy(c); this.s3.orbitCam.position.copy(c.clone().add(off)); this.s3.orbit.update();
    }
  }
  restoreView() {
    if (this._savedView && this.mode === 'walk') { const v = this._savedView; const cam = this.s3.camera; const moved = this._framedAt && Math.hypot(cam.position.x - this._framedAt.x, cam.position.z - this._framedAt.z) > 0.15; if (!moved) this.animateView(v); else this.walk.eye = v.eye; }
    if (this._savedOrbit && this.mode === 'orbit') { this.s3.orbitCam.position.copy(this._savedOrbit.pos); this.s3.orbit.target.copy(this._savedOrbit.target); this.s3.orbit.update(); }
    this._savedView = null; this._savedOrbit = null; this._framedAt = null;
  }
  animateView(to) { const cam = this.s3.camera; const from = { x: cam.position.x, z: cam.position.z, yaw: this.walk.yaw, pitch: this.walk.pitch, eye: this.walk.eye }; if (to.eye === undefined) to.eye = from.eye; let dyaw = to.yaw - from.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); const t0 = performance.now(), T = 450; this._anim = t => { const k = Math.min(1, (t - t0) / T), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; cam.position.x = from.x + (to.x - from.x) * e; cam.position.z = from.z + (to.z - from.z) * e; if (to.gy !== undefined && k >= 1) this.walk.floorY = to.gy; this.walk.yaw = from.yaw + dyaw * e; this.walk.pitch = from.pitch + (to.pitch - from.pitch) * e; this.walk.eye = from.eye + (to.eye - from.eye) * e; if (k >= 1) { this._anim = null; this._framedAt = { x: to.x, z: to.z }; } }; }
  updateSelHelper() { const g = this.selectedId && this.itemGroups.get(this.selectedId); if (!g) { this.selHelper.visible = false; return; } this.selHelper.box.setFromObject(g, true); this.selHelper.visible = true; }
  editMove(op) {
    const it = this.item(this.selectedId); if (!it) return; const c = catalogEntry(it.type), room = this.room(it.roomId) || this.currentRoom(), step = (this.moveStep || (c.equip ? 10 : 100)) / 1000;
    if (op === 'del') { this.removeItem(it.id); return; }
    if (op === 'dup') { this.snapshot(); const n = newItem(it.type, { ...JSON.parse(JSON.stringify(it)), id: undefined }); n.id = newItem(it.type).id; if (c.kind === 'wall') { const f = frameFromRot(it.rot || 0); n.x += f.along.x * (it.w + 0.1); n.z += f.along.z * (it.w + 0.1); } else { n.x += 0.4; n.z += 0.4; } this.project.items.push(n); this.addItemMesh(n); this.select(n.id); this.touched(); return; }
    if (op === 'bigger' || op === 'smaller') { const k = op === 'bigger' ? 1.1 : 1 / 1.1; const rng = c.range || {}; const cl = (key, v) => rng[key] ? Math.min(rng[key][1], Math.max(rng[key][0], v)) : v; it.w = cl('w', it.w * k); if (c.kind === 'floor' || c.kind === 'ceiling') { it.d = cl('d', it.d * k); if (c.kind === 'floor') it.h = cl('h', it.h * k); } else it.h = cl('h', it.h * k); this.rebuildItem(it); this.select(it.id); return; }
    if (op === 'rotl' || op === 'rotr') { if (c.kind === 'wall') return; this.snapshot(); it.rot += (op === 'rotl' ? 1 : -1) * Math.PI / 12; this.updateItemPose(it); this.refreshPosNums(); return; }
    // 十字の矢印:u上 d下 l左 r右(声の指示の fwd/back/up/down/left/right もここに合わせる)
    const m = { u: 'u', fwd: 'u', up: 'u', d: 'd', back: 'd', down: 'd', l: 'l', left: 'l', r: 'r', right: 'r' }[op]; if (!m) return;
    this.snapshot();
    if (c.kind === 'wall') {
      // 壁に付く物:▲▼=床からの高さ、◀▶=壁にそって(壁に向かって見たときの左右)
      const f = frameFromRot(it.rot || 0);
      if (m === 'u' || m === 'd') { const ny = it.y + (m === 'u' ? step : -step); it.y = Math.min(room.h - it.h / 2, Math.max(it.h / 2, ny)); }
      else { const s = m === 'r' ? 1 : -1; let nx = it.x + f.along.x * s * step, nz = it.z + f.along.z * s * step;
        if (it.edge !== null && it.edge !== undefined && room) { const L = wallLength(room, it.edge); const { u } = wallUV(room, it.edge, new THREE.Vector3(nx, 0, nz)); const cu = Math.min(L - it.w / 2, Math.max(it.w / 2, u)); const wp = wallPoint(room, it.edge, cu, 0, 0); nx = wp.x; nz = wp.z; }
        it.x = nx; it.z = nz; }
    } else {
      // 床・天井の物:▲=奥へ ▼=手前へ ◀▶=左右(いま見ている向きで)
      const yaw = this.walk.yaw; const fwd = this.mode === 'walk' ? new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)) : new THREE.Vector3().subVectors(this.s3.orbit.target, this.s3.orbitCam.position).setY(0).normalize(); const rmA = this.room(it.roomId) || room; if (rmA) { const ef = edgeFrame(rmA, nearestEdge(rmA, new THREE.Vector3(it.x, 0, it.z))); let best = null, bd = -2; for (const a of [ef.along, ef.along.clone().negate(), ef.normal, ef.normal.clone().negate()]) { const dt = a.dot(fwd); if (dt > bd) { bd = dt; best = a; } } fwd.copy(best); }
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const v = { u: fwd, d: fwd.clone().negate(), r: right, l: right.clone().negate() }[m]; let nx = it.x + v.x * step, nz = it.z + v.z * step;
      const r2 = roomAt(new THREE.Vector3(nx, 0, nz), this.project.rooms, { level: levelOf(room) }) || room; if (r2) { it.roomId = r2.id; [nx, nz] = clampIntoRoom(r2, nx, nz, Math.min(0.3, Math.min(it.w, it.d) / 2)); } it.x = nx; it.z = nz;
    }
    this.updateItemPose(it); this.refreshPosNums();
  }
  // 位置タブの数字(壁に付く物:床からの高さ・壁の左端から/床と天井の物:近い壁からの距離)
  refreshPosNums() {
    const it = this.item(this.selectedId); const box = $('#posNums'); if (!it || !box) return; const c = catalogEntry(it.type), room = this.room(it.roomId); box.innerHTML = '';
    const field = (label, val, onset) => { const lab = document.createElement('label'); lab.textContent = label; const inp = document.createElement('input'); inp.type = 'number'; inp.step = 5; inp.value = Math.round(val * 1000); inp.onchange = () => { const v = parseFloat(inp.value); if (!Number.isFinite(v)) return; this.snapshot(); onset(v / 1000); this.updateItemPose(it); this.refreshPosNums(); }; lab.appendChild(inp); box.appendChild(lab); };
    if (c.kind === 'wall') {
      field('床から(中心) mm', it.y, v => { it.y = Math.min(room.h - it.h / 2, Math.max(it.h / 2, v)); });
      if (room && it.edge !== null && it.edge !== undefined) { const L = wallLength(room, it.edge); const { u } = wallUV(room, it.edge, new THREE.Vector3(it.x, 0, it.z)); field('壁の左端から(中心) mm', u, v => { const cu = Math.min(L - it.w / 2, Math.max(it.w / 2, v)); const wp = wallPoint(room, it.edge, cu, 0, 0); it.x = wp.x; it.z = wp.z; }); }
    } else if (room) {
      const e = nearestEdge(room, new THREE.Vector3(it.x, 0, it.z)); const f = edgeFrame(room, e); const dist = edgeDistance(room, e, it.x, it.z);
      field(`${edgeName(room, e)}から(中心) mm`, dist, v => { const dv = v - edgeDistance(room, e, it.x, it.z); const [nx, nz] = clampIntoRoom(room, it.x + f.normal.x * dv, it.z + f.normal.z * dv, 0.05); it.x = nx; it.z = nz; });
    }
  }
  // 位置タブの見た目を、物の種類に合わせる
  setupMovePad(c) {
    const wall = c.kind === 'wall'; const L = (id, arrow, text) => { $('#' + id).innerHTML = `${arrow}<small>${text}</small>`; };
    if (wall) { L('mvU', '▲', '上へ'); L('mvD', '▼', '下へ'); L('mvL', '◀', '左へ'); L('mvR', '▶', '右へ'); $('#mvMode').textContent = '壁にそって'; $('#posHint').textContent = '壁に向かって見たときの上下・左右に動きます。指で引っぱっても動かせます。'; }
    else { L('mvU', '▲', '奥へ'); L('mvD', '▼', '手前へ'); L('mvL', '◀', '左へ'); L('mvR', '▶', '右へ'); $('#mvMode').textContent = c.kind === 'ceiling' ? '天井で' : '床の上で'; $('#posHint').textContent = 'いま見ている向きで、奥・手前・左右に動きます。指で引っぱっても動かせます。'; }
    $('#rotCol').classList.toggle('hidden', wall);
  }
  removeItem(id) { const i = this.project.items.findIndex(x => x.id === id); if (i < 0) return; this.snapshot(); const g = this.itemGroups.get(id); if (g) this.s3.itemGroup.remove(g); this.itemGroups.delete(id); this.project.items.splice(i, 1); if (this.selectedId === id) this.select(null); this.touched(); }
  // 指で引っぱって動かす
  dragItem(phase, e, h) {
    if (phase === 'grab') { this._dragging = true; this.select(h.itemId, { noFrame: true }); try { navigator.vibrate && navigator.vibrate(20); } catch {} this.toast('つかみました。指を動かすと動きます', 1500); phase = 'start'; }
    const it = this.item(this.selectedId); if (!it) return; const c = catalogEntry(it.type), room = this.room(it.roomId) || this.currentRoom();
    const nx = e.clientX / this.canvas.clientWidth, ny = e.clientY / this.canvas.clientHeight;
    if (phase === 'start') { this.snapshot(); const p0 = (h && h.point) || new THREE.Vector3(it.x, it.y, it.z); this._drag = { off: new THREE.Vector3(it.x - p0.x, 0, it.z - p0.z) }; return; }
    if (!this._drag) return;
    if (phase === 'end') { this.touched(); this.refreshPosNums(); if (this._dragging) { this._dragging = false; this.updateInset(); } return; }
    if (c.kind === 'wall') { const hit0 = this.s3.pick(nx, ny, [this.s3.houseGroup]); if (!hit0) return; const u = hit0.object.userData; const r = this.room(u.roomId); if (!r) return; const hit = { ...hit0, point: hit0.point.clone().setY(hit0.point.y - baseOf(r)) }; if (u.kind === 'part') { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null; if (!n || Math.abs(n.y) > 0.5) return; it.rot = Math.atan2(n.x, n.z); it.x = hit.point.x + n.x * 0.004; it.z = hit.point.z + n.z * 0.004; it.y = Math.min(r.h - it.h / 2, Math.max(it.h / 2, hit.point.y)); it.edge = null; it.roomId = r.id; this.updateItemPose(it); return; } if (!(u.kind === 'wall' || u.kind === 'window')) return; const f = edgeFrame(r, u.edge); const { u: uu, v } = wallUV(r, u.edge, hit.point); const L = f.L; const cu = Math.min(L - it.w / 2, Math.max(it.w / 2, uu)); const wp = wallPoint(r, u.edge, cu, 0, 0); it.x = wp.x; it.z = wp.z; it.y = Math.min(r.h - it.h / 2, Math.max(it.h / 2, v)); it.rot = f.rotY; it.edge = u.edge; it.roomId = r.id; this.updateItemPose(it); return; }
    const y = (c.kind === 'ceiling' ? room.h : it.y) + baseOf(room); const ray = this.s3.raycaster; ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.s3.activeCamera()); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return;
    p.add(this._drag.off); const r2 = roomAt(p, this.project.rooms, { level: levelOf(room) }) || room; it.roomId = r2.id; const [cx, cz] = clampIntoRoom(r2, p.x, p.z, Math.min(0.3, Math.min(it.w, it.d) / 2)); it.x = cx; it.z = cz; this.updateItemPose(it);
  }

  // ---------- 床・壁・天井 ----------
  openSurfaces(forceTab) {
    this.openSheet('surfaces'); const t = this.pin || this.center; this._surfTarget = t && t.kind !== 'item' ? t : null;
    this._surfTab = forceTab || (t && t.kind === 'wall' ? '壁' : t && t.kind === 'ceiling' ? '天井' : this._surfTab || '床');
    const tabs = $('#surfTabs'); tabs.innerHTML = ''; for (const n of ['床', '壁', '天井', '縁・枠']) { const b = document.createElement('button'); b.textContent = n; b.classList.toggle('on', n === this._surfTab); b.onclick = () => this.openSurfaces(n); tabs.appendChild(b); }
    const room = (t && t.roomId && this.room(t.roomId)) || this.currentRoom(); if (!room) return;
    const side = (t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined) ? t.edge : null;
    $('#surfHint').textContent = this._surfTab === '床' ? `${room.name}の床` : this._surfTab === '天井' ? `${room.name}の天井` : side !== null ? `${room.name}の${edgeName(room, side)}(見ている壁)。下の「全部の壁」で全部に。` : `${room.name}の壁。見ている壁がないので全部の壁に貼ります。`;
    $('#surfColors').classList.toggle('hidden', this._surfTab === '縁・枠'); $('#surfPhotoRow').classList.toggle('hidden', this._surfTab === '縁・枠'); $('#surfCards').className = this._surfTab === '縁・枠' ? 'trim-list' : 'cards';
    if (this._surfTab === '縁・枠') { this.renderTrim(room); return; }
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
  // 廻り縁・巾木・窓枠・ドア枠の設定
  renderTrim(room) {
    const t = roomTrim(room); room.trim = t; const box = $('#surfCards'); box.innerHTML = ''; $('#surfHint').textContent = `${room.name}の廻り縁・巾木・枠。寸法は mm。`;
    const commit = (msg) => { clearMaterialCache(); this.rebuildHouse(); this.touched(); if (msg) this.toast(msg); this.renderTrim(room); };
    const finishChips = (cur, onPick) => { const wrap = document.createElement('div'); wrap.className = 'row chips'; for (const f of TRIM_FINISHES) { const b = document.createElement('button'); b.className = 'chip' + (f.id === cur ? ' on' : ''); b.title = f.name; if (f.wood) { const m = trimMaterial(f.id); b.style.backgroundImage = `url(${m.map.image.toDataURL()})`; b.style.backgroundSize = 'cover'; } else b.style.background = f.color; b.onclick = () => { this.snapshot(); onPick(f.id); commit(f.name + 'にしました'); }; wrap.appendChild(b); } const nm = document.createElement('span'); nm.className = 'hint'; nm.textContent = trimFinish(cur).name; wrap.appendChild(nm); return wrap; };
    const section = (title, cfg, opts) => { const sec = document.createElement('div'); sec.className = 'trim-sec'; const head = document.createElement('div'); head.className = 'trim-head'; const h = document.createElement('b'); h.textContent = title; head.appendChild(h);
      if (opts.toggle) { const tg = document.createElement('button'); tg.className = 'chip text' + (cfg.on ? ' on' : ''); tg.textContent = cfg.on ? 'あり' : 'なし'; tg.onclick = () => { this.snapshot(); cfg.on = !cfg.on; commit(title + 'を' + (cfg.on ? 'あり' : 'なし') + 'にしました'); }; head.appendChild(tg); }
      if (opts.num) { const lab = document.createElement('label'); lab.className = 'mmlab'; lab.textContent = opts.num.label; const inp = document.createElement('input'); inp.type = 'number'; inp.step = 5; inp.min = opts.num.min; inp.max = opts.num.max; inp.value = cfg[opts.num.key]; inp.onchange = () => { const v = parseFloat(inp.value); if (!(v >= opts.num.min && v <= opts.num.max)) { this.toast(`${opts.num.min}〜${opts.num.max}mm の間で`); return; } this.snapshot(); cfg[opts.num.key] = v; commit(); }; lab.appendChild(inp); const u = document.createElement('span'); u.textContent = 'mm'; lab.appendChild(u); head.appendChild(lab); }
      sec.appendChild(head); if (opts.note) { const n = document.createElement('p'); n.className = 'hint'; n.textContent = opts.note; sec.appendChild(n); } sec.appendChild(finishChips(cfg.finish, id => { cfg.finish = id; })); box.appendChild(sec); };
    section('廻り縁(天井との境)', t.crown, { toggle: true, num: { key: 'h', label: '高さ', min: 10, max: 150 } });
    section('巾木(床との境)', t.base, { toggle: true, num: { key: 'h', label: '高さ', min: 20, max: 300 } });
    section('窓の枠', t.casing, { toggle: true, num: { key: 'w', label: '見付(幅)', min: 10, max: 120 }, note: t.casing.on ? '枠あり:四方枠(上下左右おなじ見付)。' : '枠なし:クロス巻き込み。窓台だけ左右に20mm出ます。' });
    section('ドアの枠', t.door, {});
    const row = document.createElement('div'); row.className = 'row';
    const b1 = document.createElement('button'); b1.textContent = '🎨 3つの仕上げを廻り縁に合わせる'; b1.onclick = () => { this.snapshot(); t.base.finish = t.crown.finish; t.casing.finish = t.crown.finish; t.door.finish = t.crown.finish; commit('仕上げをそろえました'); }; row.appendChild(b1);
    const b2 = document.createElement('button'); b2.textContent = '🏠 この設定を全部の部屋に'; b2.onclick = () => { this.snapshot(); for (const r of this.project.rooms) r.trim = JSON.parse(JSON.stringify(t)); commit('全部の部屋に同じ設定にしました'); }; row.appendChild(b2);
    const b3 = document.createElement('button'); b3.textContent = '↩ 標準にもどす'; b3.onclick = () => { this.snapshot(); delete room.trim; commit('標準(白・廻り縁35・巾木60・枠20)にもどしました'); }; row.appendChild(b3);
    box.appendChild(row);
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
      case 'move': { const it = cmd.type ? (nearest(cmd.type) || sel) : sel; if (!it) { this.toast('動かすものを先に選んでください'); return; } const c = catalogEntry(it.type); if (cmd.where === 'here' && t && t.point) { const keep = { color: it.color, fabric: it.fabric, opts: it.opts, w: it.w, h: it.h, d: it.d }; this.removeItem(it.id); const n = this.place(it.type, t, keep); if (n) this.select(n.id); this.toast('動かしました'); return; } { const keep = this.moveStep; this.moveStep = (this.moveStep || (c.equip ? 10 : 100)) * (cmd.steps || 3); this.selectedId = it.id; this.editMove(cmd.dir); this.moveStep = keep; } void c; return; }
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
      case 'roomSize': { const room = this.currentRoom(); if (!room) return; this.snapshot(); const g = MODULES[this.module()].half; const conv = v => { if (!v) return v; const k = v / g; const onGrid = Math.abs(k - Math.round(k)) * g < 0.006; return onGrid ? innerOf(v) : v; }; cmd = { ...cmd, w: conv(cmd.w), d: conv(cmd.d) }; if (cmd.w || cmd.d) { if (!isRect(room)) { this.toast('この部屋は四角ではないので、間取りで角を動かして広さを変えてください', 4000); return; } resizeRect(room, cmd.w || room.w, cmd.d || room.d); } if (cmd.h) room.h = cmd.h; this.plan.clampOpenings(room); for (const it of this.project.items) if (it.roomId === room.id) { it.x = Math.min(room.x + room.w - 0.1, it.x); it.z = Math.min(room.z + room.d - 0.1, it.z); if (catalogEntry(it.type).kind === 'ceiling') it.y = room.h; } this.plan.fixTwins(); this.reload(); this.toast(`${room.name}:内法 ${mm(room.w)}×${mm(room.d)}mm(芯々 ${mm(shinShin(room.w))}×${mm(shinShin(room.d))})・天井 ${mm(room.h)}mm`, 4000); return; }
      case 'shot': this.shot(); return;
      case 'undo': this.undo(); return;
      case 'trim': { const room = this.currentRoom(); if (!room) return; this.snapshot(); const rooms = cmd.allRooms ? this.project.rooms : [room]; for (const r of rooms) { const t = roomTrim(r); r.trim = t; const cfg = t[cmd.part]; if (cmd.on !== undefined && cmd.part !== 'door') cfg.on = cmd.on; if (cmd.h && cmd.part !== 'door') cfg[cmd.part === 'casing' ? 'w' : 'h'] = cmd.h; if (cmd.finish) cfg.finish = cmd.finish; if (cmd.same) { t.base.finish = t.crown.finish; t.casing.finish = t.crown.finish; t.door.finish = t.crown.finish; } } clearMaterialCache(); this.rebuildHouse(); this.touched(); const nm = { crown: '廻り縁', base: '巾木', casing: '窓の枠', door: 'ドアの枠' }[cmd.part]; this.toast(`${nm}を変えました${cmd.allRooms ? '(全部の部屋)' : ''}`); return; }
      case 'zoom': { if (cmd.reset) this.setZoom(1); else this.setZoom(this.s3.zoom * (cmd.k || 1)); this.toast(cmd.reset ? '標準の見え方にしました' : cmd.k > 1 ? '寄りました(アップ)' : '広く見えるようにしました'); return; }
      case 'redo': this.redo(); return;
      case 'spin': this.setMode('walk'); this.spin = 14; this.toast('ゆっくり一周します(14秒)'); return;
      case 'list': this.listItems(); return;
      case 'level': this.goLevel(cmd.level); return;
      case 'stair': { const st = this.project.rooms.find(r => r.stair); if (!st) { this.toast('階段がありません。間取りの「🪜階段」で作れます'); return; } if (cmd.kind) this.stairEdit(st, 'skind', cmd.kind); if (cmd.style) this.stairEdit(st, 'sstyle', cmd.style); return; }
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
  // ---------- 階段 ----------
  // 階段を足す:折り返し(回り段)1,820×1,820 と、上り口の前の1階ホール・2階の出口の前の2階ホールも作る(すぐ上り下りできるように)
  addStair() {
    const p = this.project; if (!p) return null; const G = MODULES[this.module()].grid; const b = houseBounds(p.rooms);
    const x = p.rooms.length ? b.maxX + WALL_T + 0.5 : 0, z = p.rooms.length ? b.minZ : 0; this.snapshot();
    const st = { id: 'st' + uid(), name: '階段', level: 0, x, z, w: 2 * G - WALL_T, d: 2 * G - WALL_T, h: 5, floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: {}, openings: [], parts: [], stair: { kind: 'u_winder', style: 'box', dir: 'S', flip: false, finish: 'wood_natural' } };
    st.poly = shapePoly('rect', x, z, st.w, st.d); normalizeRoom(st); p.rooms.push(st);
    const hall = lv => { const r = { id: 'h' + lv + uid(), name: lv ? 'ホール(2階)' : 'ホール', level: lv, x, z: z + st.d + WALL_T, w: st.w, d: G - WALL_T, h: 2.4, floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: {}, openings: [], parts: [] }; r.poly = shapePoly('rect', r.x, r.z, r.w, r.d); normalizeRoom(r); p.rooms.push(r); return r; };
    hall(0); hall(1); this.regenStairOpenings(st); this.load(p); this.setMode('plan'); this.toast('階段と、上り口・2階の出口の前のホールを作りました。引っぱって家につなげてください', 4000); return st;
  }
  // 階段の出入り口を作り直す(上り口=1階、出口=2階。前に部屋がある所だけ)
  regenStairOpenings(st) {
    const rooms = this.project.rooms, FH = floorH(); normalizeRoom(st);
    const lay = stairLayoutOf(st, FH); const keepWin = st.openings.filter(o => o.type === 'window'); const oldIds = new Set(st.openings.filter(o => o.type !== 'window').map(o => o.id));
    for (const r of rooms) r.openings = (r.openings || []).filter(o => !oldIds.has(o.twin)); st.openings = keepWin; let missing = 0;
    for (const port of lay.ports) {
      const mx = (port.a[0] + port.b[0]) / 2, mz = (port.a[1] + port.b[1]) / 2; let e = 0, bd = Infinity; for (let i = 0; i < st.poly.length; i++) { const f = edgeFrame(st, i); const d = Math.abs((mx - f.A[0]) * f.normal.x + (mz - f.A[1]) * f.normal.z); if (d < bd) { bd = d; e = i; } }
      const f = edgeFrame(st, e); const ua = (port.a[0] - f.A[0]) * f.along.x + (port.a[1] - f.A[1]) * f.along.z, ub = (port.b[0] - f.A[0]) * f.along.x + (port.b[1] - f.A[1]) * f.along.z;
      const u0 = Math.min(ua, ub) + 0.04, w = Math.min(Math.abs(ub - ua) - 0.08, 0.9); if (w < 0.5) continue; const sill = port.level * FH;
      const oh = sill ? 2.0 : 2.4; const o = { id: uid(), edge: e, type: 'open', u: u0, w, h: oh }; if (sill) o.sill = sill;
      const nb = neighborAcross(st, e, u0, w, rooms, { y: sill }); if (!nb) { missing++; continue; }
      st.openings.push(o); const t = { id: uid(), edge: nb.edge, type: 'open', u: nb.u, w, h: oh, twin: o.id }; const sl = sill - baseOf(nb.room); if (sl > 0.05) t.sill = sl; nb.room.openings.push(t);
    }
    return missing;
  }
  stairEdit(st, act, v) {
    this.snapshot(); const s = st.stair, G = MODULES[this.module()].grid;
    if (act === 'skind') s.kind = v; if (act === 'sstyle') s.style = v;
    if (act === 'sdir') s.dir = { S: 'W', W: 'N', N: 'E', E: 'S' }[s.dir || 'S']; if (act === 'sflip') s.flip = !s.flip;
    if (act === 'sfit') { const c = STAIR_CELLS[s.kind || 'u_winder']; const side = (s.dir === 'E' || s.dir === 'W'); resizeRect(st, (side ? c[1] : c[0]) * G - WALL_T, (side ? c[0] : c[1]) * G - WALL_T); }
    const miss = act === 'sstyle' ? 0 : this.regenStairOpenings(st); this.rebuildHouse(); this.rebuildItems(); this.applyLevels(); this.touched();
    this.toast(act === 'sstyle' ? (s.style === 'open' ? 'オープン階段にしました' : '箱階段にしました') : act === 'skind' ? `${stairKindName(s.kind)}にしました${miss ? '。上り口か出口の前に部屋がありません' : ''}` : miss ? '上り口か出口の前に部屋がありません。部屋を動かしてつなげてください' : '向きを変えました', 2600);
  }
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
  fillPresets() { const m = this.module(); for (const x of $$('#roomModules .chip')) x.classList.toggle('on', x.dataset.module === m); $('#moduleNote').textContent = MODULES[m].desc; const box = $('#roomPresets'); box.innerHTML = ''; for (const [n, w, d] of ROOM_PRESETS[m]) { const b = document.createElement('button'); b.className = 'chip text'; const jo = joOf(w * d / 1e6); b.innerHTML = m === 'shaku' ? `${n}<small> ${w.toLocaleString()}×${d.toLocaleString()}</small>` : `${n}<small> 約${jo}帖</small>`; b.onclick = () => { $('#nrW').value = w; $('#nrD').value = d; this.updateRoomNote(); }; box.appendChild(b); } this.updateRoomNote(); }
  updateRoomNote() { const w = parseFloat($('#nrW').value) || 0, d = parseFloat($('#nrD').value) || 0; const iw = w - 120, idd = d - 120; $('#nrNote').textContent = w > 200 && d > 200 ? `内法(うちのり) 約 ${iw.toLocaleString()}×${idd.toLocaleString()}mm・約${joOf(w * d / 1e6)}帖(壁芯 ${(w * d / 1e6).toFixed(2)}㎡、1帖=1.62㎡)` : ''; }
  openNewRoom(pre) { this.openSheet('newroom'); this.fillPresets(); if (pre && pre.size) { if (pre.size.w) $('#nrW').value = Math.round(pre.size.w * 1000) + 120; if (pre.size.d) $('#nrD').value = Math.round(pre.size.d * 1000) + 120; this.updateRoomNote(); } if (pre && pre.name) $('#nrName').value = pre.name; if (pre && pre.shape) { this._shape = pre.shape; for (const x of $$('#roomShapes .shape-chip')) x.classList.toggle('on', x.dataset.shape === pre.shape); const sh = ROOM_SHAPES.find(r => r[0] === pre.shape); if (sh) $('#shapeNote').textContent = sh[2]; } }
  makeNewRoom() {
    if (!this.project) this.project = this.blankProject(); const w = Math.max(0.6, ((parseFloat($('#nrW').value) || 3640) - 120) / 1000), d = Math.max(0.6, ((parseFloat($('#nrD').value) || 2730) - 120) / 1000), h = Math.max(1.8, (parseFloat($('#nrH').value) || 2400) / 1000); const name = $('#nrName').value || '部屋';
    const b = houseBounds(this.project.rooms); const x = this.project.rooms.length ? b.maxX + WALL_T : 0, z = this.project.rooms.length ? b.minZ : 0; if (this._shape === 'bay') { /* 出窓は北側にはみ出す */ }
    const shape = this._shape || 'rect'; const lv = this.mode === 'plan' ? this.plan.level : this.walkLevel(); const room = { id: 'r' + Date.now().toString(36), name, level: lv, x, z, w, d, h, poly: shapePoly(shape, x, z, w, d, MODULES[this.module()].half), floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: {}, openings: [], parts: [] }; normalizeRoom(room);
    if (shape === 'column') room.parts.push({ id: uid(), type: 'column', x: x + w - 0.45, z, w: 0.45, d: 0.45 });
    if (shape === 'bay') { const e0 = edgeForCompass(room, 'N') ?? 0; const L = wallLength(room, e0); const bw = Math.min(2.03, L - 0.6); room.openings.push({ id: uid(), edge: e0, type: 'window', u: (L - bw) / 2, w: bw, h: 1.17, sill: 0.9, bay: 'trap', bayDepth: 0.23 }); }
    else if ($('#nrWin').checked) { let best = null, bl = 0; for (let e = 0; e < room.poly.length; e++) { const f = edgeFrame(room, e); if (f.normal.z > 0.7 && f.L > bl) { best = e; bl = f.L; } } if (best !== null) { const ww = Math.min(1.65, bl - 0.6); if (ww > 0.5) room.openings.push({ id: uid(), edge: best, type: 'window', u: (bl - ww) / 2, w: ww, h: bl > 2 ? 1.8 : 1.1, sill: bl > 2 ? 0.4 : 0.9 }); } }
    const first = !this.project.rooms.length; this.project.rooms.push(room); if (first) { this.project.name = name; this.project.items.push(newItem('ceilingLight', { roomId: room.id, x: x + w / 2, y: h, z: z + d / 2 })); }
    this.load(this.project); this.closeSheets(); this.walk.floorY = baseOf(room); this.s3.camera.position.set(x + w / 2, this.walk.floorY + 1.5, z + d * 0.8); this.walk.yaw = 0; this.walk.pitch = 0;
    if (this._afterRoom) { const f = this._afterRoom; this._afterRoom = null; f(); return; }
    this.toast(first ? `部屋ができました(内法 ${mm(w)}×${mm(d)}mm)。「＋置く」でカーテンや照明を置けます` : '部屋を足しました(右どなりに置きました。間取りで動かせます)');
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
    const lines = []; for (const r of this.project.rooms) { const its = this.project.items.filter(i => i.roomId === r.id); if (!its.length) continue; lines.push(`■ ${r.name}(内法 ${mm(r.w)}×${mm(r.d)}mm・天井 ${mm(r.h)}mm・約${roomJo(r)}帖)`);
      for (const it of its) { const c = catalogEntry(it.type); const f = it.fabric ? ((SURFACE_LIB.fabric.find(x => x.id === it.fabric) || {}).name || '') : ''; const size = c.kind === 'floor' ? `幅${it.w.toFixed(2)}×奥行${it.d.toFixed(2)}×高さ${it.h.toFixed(2)}m` : c.kind === 'wall' ? `幅${it.w.toFixed(2)}×丈${it.h.toFixed(2)}m` : `直径${it.w.toFixed(2)}m`; lines.push(`・${c.name} ${size} ${colorName(it.color)}${f ? '・' + f : ''}`); }
      const wins = (r.openings || []).filter(o => o.type === 'window'); for (const o of wins) lines.push(`  窓(${edgeName(r, o.edge)}) 幅${o.w.toFixed(2)}×高さ${o.h.toFixed(2)}m 床から${(o.sill ?? 0.9).toFixed(2)}m`); for (const pt of (r.parts || [])) lines.push(pt.type === 'column' ? `  柱型 ${pt.w.toFixed(2)}×${pt.d.toFixed(2)}m` : pt.type === 'wall' ? `  袖壁 長さ${Math.hypot(pt.x2 - pt.x1, pt.z2 - pt.z1).toFixed(2)}m 高さ${(pt.h || r.h).toFixed(2)}m` : `  梁 下がり${(pt.drop || 0.3).toFixed(2)}m`); }
    const text = lines.join('\n') || 'まだ何も置いていません'; this.dialog(`<p><b>置いたものの一覧</b></p><textarea readonly style="height:220px">${text.replace(/</g, '&lt;')}</textarea>`, [{ label: 'とじる', value: null }, { label: 'コピー', value: 'copy' }, { label: '送る', value: 'share', primary: true }]).then(async r => { if (r === 'copy') { await navigator.clipboard.writeText(text); this.toast('コピーしました'); } if (r === 'share') { if (navigator.share) { try { await navigator.share({ title: 'おへや3D 一覧', text }); } catch {} } else { await navigator.clipboard.writeText(text); this.toast('コピーしました'); } } });
  }
  installNote() { const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; const el = $('#installNote'); if (!el) return; el.textContent = standalone ? '📲 いまはホーム画面のアプリとして開いています。' : this._install ? '📲 まだ入れていません。上のボタンで入れられます。' : '📲 ブラウザで開いています。「すでにインストールされています」と出るときは、スマホのアプリ一覧(全アプリ)に「おへや3D」が入っています。長押しでホーム画面に置けます。'; }
  help() { this.dialog(`<p><b>使い方</b></p><p>👣 <b>歩く</b>:画面の左側を指でなぞると歩き、右側で見回します。PCは W A S D とマウス。</p><p>✊ <b>つかむ</b>:置いた物を長押しすると、つかんで指で動かせます。ダブルタップで選ぶと、色・大きさ・位置を直せます。</p><p>＋ <b>置く</b>:見ている場所(中央の○)に置きます。床をタップして場所を決めてから置いてもOK。</p><p>🎤 <b>言葉で</b>:「ここにカーテンをつけて」「床をフローリングに」「壁を白に」「シャンデリアを消して」「夜にして」「窓をつけて」など。</p><p>🧱 <b>床・壁</b>:見ている面の素材を変えます。見本帳の写真も貼れます。</p><p>📷 <b>写真</b>:部屋の写真を壁に貼って、本物そっくりの部屋を作ります。</p><p>📐 <b>間取り</b>:部屋を足して ドアでつなぐと、家全体を歩けます。</p><p>☰ メニュー:置いたものの寸法一覧(見積りの下書き)、ぐるっと一周見回す(紹介動画用)、昼・夕方・夜、立つ/座る、保存・書き出し。↶ でひとつ前にもどせます。</p><p>保存は自動です(「前回のつづき」)。</p>`, [{ label: 'とじる', primary: true }]); }
}

function require_area(r) { let a = 0; const p = r.poly || []; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; }
export function fileToDataUrl(file, max = 1600, quality = 0.88) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', quality)); URL.revokeObjectURL(img.src); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
}

try { new App(); document.body.classList.add('ready'); try { sessionStorage.removeItem('oheya-retry'); } catch {} if (/[?&]r=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash); }
catch (e) { console.error(e); const el = document.querySelector('.start-inner'); if (el) el.insertAdjacentHTML('beforeend', `<p style="color:#ff6b6b;font-size:16px;line-height:1.6">3Dの準備に失敗しました。ブラウザを最新にするか、別のブラウザ(Chrome / Safari)で開いてみてください。<br><small>${String(e.message || e).replace(/</g, '&lt;')}</small></p>`); }
