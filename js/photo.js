// 写真・動画から部屋を作る:壁や床に写真を貼る(四隅を合わせてゆがみを直す)、パノラマ、動画から場面を切り出す、AIで広さを読む
import { wallLength, edgeName, edgeForCompass, normalizeRoom, edgeCount, rectPoly, wallPoint, edgeFrame } from './house.js';
import { clearMaterialCache } from './textures.js';
import { fileToDataUrl } from './main.js';
import * as AI from './ai.js';

const $ = s => document.querySelector(s);

// 4点 → 長方形 の射影変換(ホモグラフィ)を求める
function homography(src, dst) {
  // src[i] = [x,y] (写真の中の四隅), dst[i] = [u,v] (0..W, 0..H)。dst→src の変換行列を返す(逆写像で描く)
  const A = [], b = [];
  for (let i = 0; i < 4; i++) { const [u, v] = dst[i], [x, y] = src[i]; A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x); A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y); }
  // ガウスの消去法
  const n = 8; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c] || 1e-12; for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  const h = M.map((r, i) => r[n] / (r[i] || 1e-12)); return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
// 写真の四隅(TL,TR,BR,BL)から、まっすぐな長方形の絵(W×H)を作る
export function rectify(img, corners, W, H) {
  const src = document.createElement('canvas'); src.width = img.naturalWidth || img.width; src.height = img.naturalHeight || img.height; const sg = src.getContext('2d'); sg.drawImage(img, 0, 0); const sd = sg.getImageData(0, 0, src.width, src.height).data;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d'); const od = og.createImageData(W, H), d = od.data;
  const Hm = homography(corners, [[0, 0], [W, 0], [W, H], [0, H]]); const sw = src.width, sh = src.height;
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    const den = Hm[6] * u + Hm[7] * v + 1; const x = (Hm[0] * u + Hm[1] * v + Hm[2]) / den, y = (Hm[3] * u + Hm[4] * v + Hm[5]) / den;
    const xi = Math.max(0, Math.min(sw - 2, Math.floor(x))), yi = Math.max(0, Math.min(sh - 2, Math.floor(y))), fx = Math.max(0, Math.min(1, x - xi)), fy = Math.max(0, Math.min(1, y - yi));
    const i00 = (yi * sw + xi) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, o = (v * W + u) * 4;
    for (let k = 0; k < 3; k++) d[o + k] = sd[i00 + k] * (1 - fx) * (1 - fy) + sd[i10 + k] * fx * (1 - fy) + sd[i01 + k] * (1 - fx) * fy + sd[i11 + k] * fx * fy; d[o + 3] = 255;
  }
  og.putImageData(od, 0, 0); return out;
}
function loadImage(dataUrl) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; }); }

export function openPhotoWizard(app, start) {
  app.openSheet('photo'); const box = $('#photoSteps'); const room = app.currentRoom();
  const menu = () => {
    box.innerHTML = `<div class="menu-list">
      <button data-go="wall">🧱 壁に写真を貼る<small style="display:block;color:#c9cdd8;font-size:13px">部屋の写真の壁の四隅を合わせると、本物の壁になります</small></button>
      <button data-go="floor">🟫 床に写真を貼る</button>
      <button data-go="pano">🌐 360°パノラマ写真から<small style="display:block;color:#c9cdd8;font-size:13px">スマホのパノラマ撮影の写真。見回すだけならいちばん本物っぽい</small></button>
      <button data-go="video">🎬 動画から場面を切り出す</button>
      <button data-go="try">🧪 写真なしで手順を試す<small style="display:block;color:#c9cdd8;font-size:13px">今の3Dの画面を写真の代わりにして、四隅合わせを体験</small></button>
      <button data-go="ai">🤖 AIに写真から部屋の広さを読ませる${AI.hasKey() ? '' : '<small style="display:block;color:#c9cdd8;font-size:13px">(メニュー → AIの設定 で鍵を入れると使えます)</small>'}</button>
    </div><p class="hint">写真はこの端末の中だけで処理します(AIを使うときだけ、その写真をGoogleに送ります)。</p>`;
    for (const b of box.querySelectorAll('[data-go]')) b.onclick = () => go(b.dataset.go);
  };
  const pickFile = (accept, capture) => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; if (capture) i.capture = 'environment'; i.onchange = () => res(i.files[0] || null); i.click(); });
  const go = async kind => {
    if (!app.project.rooms.length && kind !== 'ai') { app.toast('まず部屋の広さを決めてください。できたら写真の手順に進みます', 3500); app._afterRoom = () => openPhotoWizard(app, kind); app.openNewRoom(); return; }
    if (kind === 'wall' || kind === 'floor') { const f = await pickFile('image/*'); if (!f) return; const dataUrl = await fileToDataUrl(f, 2000, 0.9); cornerStep(kind, dataUrl); }
    if (kind === 'pano') { const f = await pickFile('image/*'); if (!f) return; const dataUrl = await fileToDataUrl(f, 4096, 0.85); const id = 'pano' + Date.now().toString(36); app.project.assets[id] = { dataUrl, kind: 'pano', name: 'パノラマ' }; const r = app.currentRoom(); r.pano = id; app.rebuildHouse(); app.touched(); app.closeSheets(); app.toast('パノラマを貼りました。見回してみてください。やめるときは 床・壁 → パノラマをはがす'); }
    if (kind === 'video') videoStep();
    if (kind === 'try') { app.closeSheets(); const blob = await app.s3.screenshot(); const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); app.openSheet('photo'); cornerStep('wall', dataUrl); }
    if (kind === 'ai') aiStep();
  };
  // 四隅を合わせる
  const cornerStep = async (kind, dataUrl, fromVideo, presetSide) => {
    const img = await loadImage(dataUrl); const r = app.currentRoom(); normalizeRoom(r); const t = app.center; const EDGES = [...Array(edgeCount(r)).keys()];
    let side = presetSide ?? ((t && (t.kind === 'wall' || t.kind === 'window') && t.edge !== undefined) ? t.edge : (edgeForCompass(r, 'N', app.s3.camera.position) ?? 0));
    const render = () => {
      const maxW = Math.min(box.clientWidth || 360, 520); const k = maxW / img.width; const w = Math.round(img.width * k), h = Math.round(img.height * k);
      box.innerHTML = `<div class="steps"><span class="on">1 四隅を合わせる</span><span>2 貼る</span></div>
        ${kind === 'wall' ? `<div class="row chips" id="sideChips">${EDGES.map(s => `<button class="chip text ${s === side ? 'on' : ''}" data-side="${s}">${edgeName(r, s)}</button>`).join('')}</div>` : `<p class="hint">床の、部屋いっぱいの四隅(左奥・右奥・右手前・左手前)に合わせてください。</p>`}
        <div class="corner-wrap" id="cw" style="width:${w}px;height:${h}px"><img src="${dataUrl}" style="width:${w}px;height:${h}px"><svg viewBox="0 0 ${w} ${h}"><polygon id="poly" fill="rgba(255,207,77,.18)" stroke="#ffcf4d" stroke-width="2"/></svg>
          ${['左上', '右上', '右下', '左下'].map((n, i) => `<div class="dot" data-i="${i}">${n[0]}${n[1] === '上' ? '↑' : '↓'}</div>`).join('')}</div>
        <p class="hint">黄色の●を、写真の中の${kind === 'wall' ? '壁' : '床'}の四隅へ指で動かしてください。(壁は、天井との境と床との境の角)</p>
        <div class="row"><button id="cornerBack">← もどる</button><button id="cornerOk" class="primary">この四隅で貼る</button></div>`;
      const pts = [[w * .12, h * .18], [w * .88, h * .18], [w * .88, h * .85], [w * .12, h * .85]]; const cw = box.querySelector('#cw'), poly = box.querySelector('#poly'), dots = Array.from(box.querySelectorAll('.dot'));
      const upd = () => { dots.forEach((d, i) => { d.style.left = pts[i][0] + 'px'; d.style.top = pts[i][1] + 'px'; }); poly.setAttribute('points', pts.map(p => p.join(',')).join(' ')); }; upd();
      let active = null; cw.addEventListener('pointerdown', e => { const rect = cw.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top; let best = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } }); active = best; try { cw.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); });
      cw.addEventListener('pointermove', e => { if (active == null) return; const rect = cw.getBoundingClientRect(); pts[active] = [Math.max(0, Math.min(w, e.clientX - rect.left)), Math.max(0, Math.min(h, e.clientY - rect.top))]; upd(); });
      cw.addEventListener('pointerup', () => { active = null; }); cw.addEventListener('pointercancel', () => { active = null; });
      for (const b of box.querySelectorAll('[data-side]')) b.onclick = () => { side = parseInt(b.dataset.side); for (const x of box.querySelectorAll('[data-side]')) x.classList.toggle('on', parseInt(x.dataset.side) === side); };
      box.querySelector('#cornerBack').onclick = () => fromVideo ? videoStep() : menu();
      box.querySelector('#cornerOk').onclick = () => {
        app.toast('ゆがみを直しています…'); setTimeout(() => {
          const corners = pts.map(p => [p[0] / k, p[1] / k]); let W, H; if (kind === 'wall') { const L = wallLength(r, side); W = 1280; H = Math.round(1280 * r.h / L); } else { W = 1280; H = Math.round(1280 * r.d / r.w); }
          H = Math.max(64, Math.min(2048, H)); const c = rectify(img, corners, W, H); const out = c.toDataURL('image/jpeg', 0.88); const id = 'ph' + Date.now().toString(36);
          app.project.assets[id] = { dataUrl: out, kind: 'photo', name: kind === 'wall' ? edgeName(r, side) + 'の写真' : '床の写真' };
          if (kind === 'wall') { r.walls = r.walls || {}; r.walls[side] = { photo: id }; } else r.floor = { photo: id };
          clearMaterialCache(); app.rebuildHouse(); app.touched(); app.closeSheets();
          if (kind === 'wall') { const f = edgeFrame(r, side); const mid = wallPoint(r, side, f.L / 2, 0, Math.min(3, Math.max(1.2, f.L * 0.6))); app.s3.camera.position.set(mid.x, 1.5, mid.z); app.walk.yaw = f.rotY + Math.PI; app.walk.pitch = 0;
            const next = (side + 1) % EDGES.length; const left = EDGES.filter(sd => !(r.walls && r.walls[sd] && r.walls[sd].photo));
            setTimeout(() => app.dialog(`<p>${edgeName(r, side)}に貼りました。</p><p>${left.length ? `まだ写真のない壁: ${left.map(sd => edgeName(r, sd)).join('・')}` : '全部の壁に写真が入りました!'}</p>`, [{ label: '床の写真も貼る', value: 'floor' }, { label: 'これで終わる', value: null }, ...(left.length ? [{ label: `${edgeName(r, left.includes(next) ? next : left[0])}を貼る`, value: 'next', primary: true }] : [])]).then(async v => { if (v === 'next') { const f2 = await pickFile('image/*'); if (!f2) return; app.openSheet('photo'); cornerStep('wall', await fileToDataUrl(f2, 2000, 0.9), false, left.includes(next) ? next : left[0]); } if (v === 'floor') { const f2 = await pickFile('image/*'); if (!f2) return; app.openSheet('photo'); cornerStep('floor', await fileToDataUrl(f2, 2000, 0.9)); } }), 200); }
          else app.toast('床に貼りました', 2500);
        }, 30);
      };
    };
    render();
  };
  // 動画から場面を選ぶ
  const videoStep = async () => {
    const f = await pickFile('video/*'); if (!f) return; const url = URL.createObjectURL(f);
    box.innerHTML = `<div class="steps"><span class="on">1 場面を選ぶ</span><span>2 四隅</span><span>3 貼る</span></div><video id="vid" src="${url}" playsinline muted preload="auto" style="width:100%"></video>
      <input id="vseek" type="range" min="0" max="1000" value="0" style="width:100%"><p class="hint" id="vtime">動画を読み込んでいます…</p>
      <div class="row"><button id="vBack">← もどる</button><button id="vWall" class="primary">この場面を壁に</button><button id="vFloor">床に</button></div>`;
    const v = box.querySelector('#vid'), seek = box.querySelector('#vseek'), vt = box.querySelector('#vtime');
    v.onloadedmetadata = () => { vt.textContent = `長さ ${v.duration.toFixed(1)}秒。つまみを動かして、壁がまっすぐ写っている場面を選んでください`; v.currentTime = Math.min(0.5, v.duration / 2); };
    seek.oninput = () => { if (v.duration) v.currentTime = v.duration * seek.value / 1000; };
    const grab = () => { const c = document.createElement('canvas'); const k = Math.min(1, 2000 / Math.max(v.videoWidth, v.videoHeight)); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.9); };
    box.querySelector('#vBack').onclick = () => { URL.revokeObjectURL(url); menu(); };
    box.querySelector('#vWall').onclick = () => { if (!v.videoWidth) return; cornerStep('wall', grab(), true); };
    box.querySelector('#vFloor').onclick = () => { if (!v.videoWidth) return; cornerStep('floor', grab(), true); };
  };
  // AIに読ませる
  const aiStep = async () => {
    if (!AI.hasKey()) { app.closeSheets(); app.aiSettings(); return; }
    const f = await pickFile('image/*'); if (!f) return; const dataUrl = await fileToDataUrl(f, 1280, 0.85);
    box.innerHTML = `<img src="${dataUrl}"><p class="hint">AIが写真を見て、部屋の広さ・床・壁・窓を読み取っています…(10秒ほど)</p>`;
    try {
      const est = await AI.aiRoomFromPhoto(dataUrl);
      if (!est) throw new Error('empty');
      box.innerHTML = `<img src="${dataUrl}"><p>AIの読み取り:横 <b>${est.width}m</b> × 奥行 <b>${est.depth}m</b>、天井 <b>${est.height}m</b>。床:${est.floorName || '-'}、壁:${est.wallName || '-'}。窓 ${(est.windows || []).length}つ。</p><p class="hint">${est.note || ''}</p>
        <div class="row"><button id="aiNo">やめる</button><button id="aiYes" class="primary">この部屋を作る</button></div><div class="row"><label><input type="checkbox" id="aiPaste" ${est.backWall ? 'checked' : ''}> 写真の正面の壁を、そのまま奥の壁に貼る</label></div>`;
      box.querySelector('#aiNo').onclick = menu;
      box.querySelector('#aiYes').onclick = async () => {
        const p = app.project; const b = p.rooms.length ? Math.max(...p.rooms.map(r => r.x + r.w)) + 0.12 : 0;
        const W = +est.width || 3.6, D = +est.depth || 3.6; const wallS = est.wall || { lib: 'wp_white' };
        const room = { id: 'r' + Date.now().toString(36), name: est.name || '部屋', x: b, z: 0, w: W, d: D, h: +est.height || 2.4, poly: rectPoly(b, 0, W, D), floor: est.floor || { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: { 0: wallS, 1: wallS, 2: wallS, 3: wallS }, openings: [], parts: [] }; normalizeRoom(room);
        for (const w of (est.windows || [])) { const side = ['N', 'E', 'S', 'W'].includes(w.side) ? w.side : 'N'; const edge = edgeForCompass(room, side) ?? 0; const L = wallLength(room, edge); const ww = Math.min(L - 0.4, +w.w || 1.6); room.openings.push({ id: 'ai' + Math.random().toString(36).slice(2, 7), edge, type: 'window', u: Math.max(0.1, Math.min(L - ww - 0.1, (+w.center || 0.5) * L - ww / 2)), w: ww, h: +w.h || 1.2, sill: (w.sill != null && !isNaN(+w.sill)) ? +w.sill : 0.9 }); }
        if (box.querySelector('#aiPaste').checked && est.backWall && est.backWall.length === 4) { const img = await loadImage(dataUrl); const corners = est.backWall.map(([nx, ny]) => [nx * img.width, ny * img.height]); const c = rectify(img, corners, 1280, Math.max(64, Math.round(1280 * room.h / room.w))); const id = 'ph' + Date.now().toString(36); p.assets[id] = { dataUrl: c.toDataURL('image/jpeg', 0.88), kind: 'photo', name: '奥の壁(AI)' }; room.walls[0] = { photo: id }; }
        p.rooms.push(room); if (!p.items.some(i => i.roomId === room.id)) { const { newItem } = await import('./items.js'); p.items.push(newItem('ceilingLight', { roomId: room.id, x: room.x + room.w / 2, y: room.h, z: room.z + room.d / 2 })); }
        app.load(p); app.s3.camera.position.set(room.x + room.w / 2, 1.5, room.z + room.d * 0.8); app.walk.yaw = 0; app.closeSheets(); app.toast('AIの読み取りで部屋を作りました。広さは 間取り で直せます', 4000);
      };
    } catch (e) { console.warn(e); box.innerHTML = `<p>AIの読み取りに失敗しました。${e.message || ''}</p><div class="row"><button id="aiNo">もどる</button></div>`; box.querySelector('#aiNo').onclick = menu; }
  };
  if (start) go(start); else menu();
}
