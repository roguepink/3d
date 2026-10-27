// アングル(カメラの位置)を保存して、いつでも同じ見え方に戻す・撮る
// 映画の画像生成で「毎回同じ部屋の見え方」を使うため。保存先は project.settings.angles(家といっしょに保存・リンクにも入る)
import * as THREE from 'three';
import { shareOrDownload } from './store.js';
import { clampIntoRoom, baseOf } from './house.js';

const $ = s => document.querySelector(s);
const list = app => { const st = app.project.settings = app.project.settings || {}; return st.angles = st.angles || []; };

// 今の見え方を記録する
export function current(app, name) {
  const s3 = app.s3;
  if (app.mode === 'walk') { const c = s3.camera.position; return { name, mode: 'walk', x: c.x, z: c.z, floorY: app.walk.floorY, eye: app.walk.eye, yaw: app.walk.yaw, pitch: app.walk.pitch, zoom: s3.zoom }; }
  const p = s3.orbitCam.position, t = s3.orbit.target; return { name, mode: 'orbit', p: [p.x, p.y, p.z], t: [t.x, t.y, t.z], level: app.levelView ?? null };
}
// その見え方にする(すぐ描けるように、カメラも直接動かす)
export function go(app, a) {
  const s3 = app.s3; if (app.selectedId) app.select(null);
  if (a.mode === 'walk') {
    if (app.mode !== 'walk') app.setMode('walk'); app.walk.floorY = a.floorY || 0; app.walk.eye = a.eye || 1.5; app.walk.yaw = a.yaw; app.walk.pitch = a.pitch || 0; if (a.zoom) app.setZoom(a.zoom, true);
    s3.camera.position.set(a.x, (a.floorY || 0) + (a.eye || 1.5), a.z); s3.camera.rotation.order = 'YXZ'; s3.camera.rotation.set(a.pitch || 0, a.yaw, 0);
  } else {
    if (app.mode !== 'orbit') app.setMode('orbit'); if (a.level !== undefined && app.levelView !== a.level) { app.levelView = a.level; app._lvAll = a.level === null; app.applyLevels(); }
    s3.orbitCam.position.set(...a.p); s3.orbit.target.set(...a.t); s3.orbit.update();
  }
  app.applyCeilingVisibility();
}
// 部屋を5方向から:真上+4つの角から部屋の真ん中を見る(目の高さ 1.5m)
export function autoAngles(app, room) {
  const b = baseOf(room), cx = room.x + room.w / 2, cz = room.z + room.d / 2, out = [];
  const big = Math.max(room.w, room.d); out.push({ name: room.name + ' 真上から', mode: 'orbit', p: [cx, b + big * 1.25 + 2.4, cz + big * 0.12], t: [cx, b, cz], level: room.level || 0 });
  const corners = [['北西', room.x, room.z], ['北東', room.x + room.w, room.z], ['南東', room.x + room.w, room.z + room.d], ['南西', room.x, room.z + room.d]];
  for (const [nm, x0, z0] of corners) { let [x, z] = clampIntoRoom(room, x0 + Math.sign(cx - x0) * 0.35, z0 + Math.sign(cz - z0) * 0.35, 0.3); const yaw = Math.atan2(-(cx - x), -(cz - z)); out.push({ name: room.name + ' ' + nm + 'の角から', mode: 'walk', x, z, floorY: b, eye: 1.5, yaw, pitch: -0.12, zoom: 1 }); }
  return out;
}
// 1つの見え方を、決まった大きさで描いて canvas にする
function renderAt(app, a, W, H) {
  go(app, a); const s3 = app.s3, R = s3.renderer, cam = s3.activeCamera(); const old = new THREE.Vector2(); R.getSize(old);
  R.setSize(W, H, false); for (const c of [s3.camera, s3.orbitCam]) { c.aspect = W / H; c.clearViewOffset(); c.updateProjectionMatrix(); } s3.applyFov();
  if (a.mode === 'orbit') cam.lookAt(...a.t); s3.scene.updateMatrixWorld(); R.render(s3.scene, cam);
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(R.domElement, 0, 0, W, H);
  s3.resize(); return c;
}
function hideHelpers(app, on) { if (app.selHelper) app.selHelper.visible = !on && !!app.selectedId; if (app.pinMesh) app.pinMesh.visible = !on && !!app.pin; if (app.labels) app.labels.visible = !on && app.mode === 'orbit'; }

// 1つ撮る(画像にして保存・共有)
export async function shootOne(app, a) {
  app.closeSheets(); hideHelpers(app, true); const c = renderAt(app, a, 1536, 1024); hideHelpers(app, false);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)); const res = await shareOrDownload(blob, (a.name || 'angle') + '.jpg', a.name); if (res === 'downloaded') app.toast('画像を保存しました');
}
// まとめて1枚(部屋の設定シート):3列で並べ、名前を書く
export async function shootSheet(app, angles, title) {
  if (!angles.length) { app.toast('先にアングルを保存してください'); return; }
  app.closeSheets(); hideHelpers(app, true); const W = 768, H = 512, cols = angles.length > 4 ? 3 : 2, rows = Math.ceil(angles.length / cols), pad = 16, head = 64, lab = 34;
  const out = document.createElement('canvas'); out.width = cols * W + (cols + 1) * pad; out.height = head + rows * (H + lab) + (rows + 1) * pad; const g = out.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#222'; g.font = 'bold 34px sans-serif'; g.textBaseline = 'middle'; g.fillText(title, pad, head / 2 + 4);
  angles.forEach((a, i) => { const c = renderAt(app, a, W, H), x = pad + (i % cols) * (W + pad), y = head + pad + Math.floor(i / cols) * (H + lab + pad); g.drawImage(c, x, y); g.fillStyle = '#333'; g.font = '24px sans-serif'; g.fillText(`${i + 1}. ${a.name}`, x + 4, y + H + lab / 2); });
  hideHelpers(app, false); go(app, angles[0]);
  const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.9)); const res = await shareOrDownload(blob, title + '.jpg', title); if (res === 'downloaded') app.toast('設定シートを保存しました');
}

// 欄を開く
export function openAngles(app) {
  app.openSheet('angles'); const box = $('#angList'), A = list(app); box.innerHTML = '';
  $('#angAdd').onclick = () => { app.snapshot(); const r = app.currentRoom(); A.push(current(app, (r ? r.name : '部屋') + ' ' + (A.length + 1))); app.touched(); openAngles(app); app.toast('今の見え方を保存しました'); };
  $('#angAuto').onclick = () => { const r = app.currentRoom(); if (!r) return; app.snapshot(); const add = autoAngles(app, r); for (const a of add) { const i = A.findIndex(o => o.name === a.name); if (i >= 0) A[i] = a; else A.push(a); } app.touched(); openAngles(app); app.toast(r.name + 'を5方向から保存しました'); };
  $('#angSheet').onclick = () => shootSheet(app, A, (app.project.name || '部屋') + ' 設定シート');
  if (!A.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'まだありません。「＋ 今の見え方」か「この部屋を5方向から」で作れます。'; box.appendChild(p); }
  A.forEach((a, i) => {
    const row = document.createElement('div'); row.className = 'angrow';
    const nm = document.createElement('input'); nm.type = 'text'; nm.value = a.name; nm.onchange = () => { a.name = nm.value.trim() || a.name; app.touched(); };
    const b = (t, title, f) => { const e = document.createElement('button'); e.textContent = t; e.title = title; e.onclick = f; row.appendChild(e); return e; };
    row.appendChild(nm);
    b('👁', 'この見え方にする', () => { app.closeSheets(); go(app, a); });
    b('📸', '撮る', () => shootOne(app, a));
    b('🗑', '消す', () => { app.snapshot(); A.splice(i, 1); app.touched(); openAngles(app); });
    box.appendChild(row);
  });
}
