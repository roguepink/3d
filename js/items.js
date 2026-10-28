// 置けるもの(カーテン・照明・家具など)のカタログと3Dの作り方
import * as THREE from 'three';
import { surfaceMaterial } from './textures.js';
import { CATALOG, std, WOOD, DARKWOOD, METAL, BLACK, GOLD, WHITE, box, cyl, sph, emissive, fabric, light, WARM, DAYLIGHT, chairGroup, applyStyle, styleOf } from './kit.js';
export { CATALOG };
import { mergeGroup } from './merge.js';
import { PLANTS } from './plants.js';
import { FURNITURE, gadgetRow } from './furniture.js';
import { WET } from './wet.js';
import { FILM } from './film.js';
import { KOMONO } from './komono.js';
import { WAFU } from './wafu.js';

// ひだのあるカーテンの布
function pleatedPanel(pw, h, pitch, amp, mat) {
  const segX = Math.max(8, Math.round(pw / pitch * 6)), g = new THREE.PlaneGeometry(pw, h, segX, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); const t = (y + h / 2) / h; const a = amp * (0.6 + 0.4 * t); pos.setZ(i, a * Math.sin(x / pitch * Math.PI * 2) + a * 0.3 * Math.sin(x / pitch * Math.PI * 6 + 1)); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}


// ---- カーテンのひだ ----
// f=生地の倍率(窓の幅の何倍の生地を使うか)、pitch=山と山の間隔(m)、head=上のつまみの山の数
// 調べた目安:3つ山は2〜2.5倍・約11cm、2つ山/1つ山は1.5倍、フラット1.0〜1.3倍、ハトメ1.3〜1.5倍・約17cm、ウェーブは形状記憶でそろった波
export const PLEATS = {
  mitsu: { f: 2.0, pitch: 0.115, head: 3 }, futatsu: { f: 1.5, pitch: 0.13, head: 2 }, hitotsu: { f: 1.5, pitch: 0.12, head: 1 },
  wave: { f: 2.0, pitch: 0.12, head: 0, even: true }, hatome: { f: 1.5, pitch: 0.17, head: 0, ring: true, even: true },
  flat: { f: 1.2, pitch: 0.24, head: 0 }, gather: { f: 2.0, pitch: 0.05, head: 0, fine: true },
};
// レールの色:[id, 名前, 色, 金属か]
export const RAIL_COLORS = [['silver', 'シルバー', '#c9ccd0', 1], ['white', 'ホワイト', '#f2f2ef', 0], ['black', 'ブラック', '#2a2a2c', 1], ['bronze', 'ブロンズ', '#6b5a48', 1], ['gold', 'ゴールド', '#c8a85a', 1], ['wood_n', '木目(ナチュラル)', '#b88a5a', 0], ['wood_d', '木目(ダーク)', '#5a3e2b', 0]];
export const LACE_TYPES = [['lace_voile', 'ボイル(よく透ける)'], ['lace_plain', '無地(ふつう)'], ['lace_mirror', 'ミラー(昼は見えにくい)'], ['lace_shaz', '遮像(いちばん見えにくい)'], ['lace_stripe', 'ストライプ'], ['lace_leaf', 'リーフ柄'], ['lace_geo', '幾何柄'], ['lace_dot', '小花柄'], ['lace', '輪の柄']];
// 片側の布を作る。外側の端(sx*half)を固定して、内側へ広がる。tie のときは yTie でしぼる
function curtainPanel({ sx, half, top, bot, pw, fab, P, tie, yTie, wTie, mat }) {
  const n = Math.max(3, Math.round(half / P.pitch)); // 山の数(閉めたときの間隔で決まる。開けても数は同じ)
  const L = fab / n; // 1つの波に使う生地の長さ
  const wB = pw * 0.85;
  const widthAt = y => { if (!tie) return pw; if (y >= yTie) { const t = (top - y) / Math.max(0.01, top - yTie); return pw + (wTie - pw) * Math.pow(t, 1.25); } const t = (yTie - y) / Math.max(0.01, yTie - bot); return wTie + (wB - wTie) * (1 - Math.pow(1 - t, 2.2)); };
  const ampAt = wy => { const p = wy / n; return Math.min(Math.max(0.004, 1.35 * p / Math.PI * Math.sqrt(Math.max(0, L / p - 1))), L / 4.2, 0.12); };
  // 横の行:上(つまみ)は細かく、下は粗く
  const ys = [top, top - 0.012, top - 0.03, top - 0.05, top - 0.075, top - 0.1, top - 0.13, top - 0.17, top - 0.22];
  for (let y = top - 0.3; y > bot + 0.01; y -= tie ? 0.06 : 0.12) ys.push(y);
  if (tie) { for (const d of [-0.05, -0.025, 0, 0.025, 0.05]) ys.push(yTie + d); }
  ys.push(bot); ys.sort((a, b) => b - a); const rows = ys.filter((y, k) => k === 0 || Math.abs(y - ys[k - 1]) > 0.004);
  const cols = Math.min(420, Math.max(24, n * (P.fine ? 6 : 10)));
  const pos = [], uv = [], idx = [];
  for (let r = 0; r < rows.length; r++) {
    const y = rows[r], wy = widthAt(y), a = ampAt(wy), fromTop = top - y, tt = (y - bot) / (top - bot);
    for (let c = 0; c <= cols; c++) {
      const v = c / cols, ph = v * n * Math.PI * 2;
      // ふつうの波(下にいくほど少しふくらむ。形状記憶とハトメはそろった波)
      let z = Math.sin(ph) * a * (P.even ? 1 : 0.65 + 0.35 * (1 - tt)) + (P.even ? 0 : a * 0.18 * Math.sin(ph * 3 + 1.3));
      if (P.fine) z = Math.sin(ph) * a * 0.8 + 0.012 * Math.sin(v * 9 * Math.PI);
      if (P.head && fromTop < 0.2) {
        // つまみ(山)の部分:山の間は平ら、つまんだ所に head 個の小さな山
        const f = ((v * n) % 1 + 1) % 1, cl = 0.3, k = Math.min(1, fromTop / 0.2), blend = k * k * (3 - 2 * k);
        let hz = -a * 0.15; if (f > 0.5 - cl / 2 && f < 0.5 + cl / 2) { const q = (f - (0.5 - cl / 2)) / cl; hz = 0.012 + Math.abs(Math.sin(q * Math.PI * P.head)) * 0.016 * (1.2 - 0.2 * P.head / 3); }
        z = hz * (1 - blend) + z * blend;
      }
      const x = sx * (half - v * wy);
      // まとめたとき:結んだ所は奥(壁側)へ少し寄る
      let zz = 0.1 + z; if (tie) { const near = Math.max(0, 1 - Math.abs(y - yTie) / 0.5); zz -= 0.02 * near; }
      pos.push(x, y, zz); uv.push(sx > 0 ? 1 - v : v, tt);
    }
  }
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols; c++) { const a0 = r * (cols + 1) + c, b0 = a0 + 1, c0 = a0 + cols + 1, d0 = c0 + 1; idx.push(a0, c0, b0, b0, c0, d0); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m;
}



// ---- 各アイテム ----
// 天井カセットの形:パネル(厚み約35)、真ん中は吸い込み口(細かい格子)、長い辺に吹き出し口(羽根)
function cassette(it, dirs) {
  const g = new THREE.Group(), w = it.w, d = it.d, m = std(it.color, .35), dark = std('#3a3c40', .6), grille = std(it.color === '#2b2b2e' ? '#444' : '#dcdcd8', .6);
  g.add(box(w, 0.035, d, m, 0, -0.0175, 0));
  const sl = 0.06, gi = dirs === 2 ? d - sl * 2 - 0.12 : d - sl - 0.14; const gz = dirs === 2 ? 0 : -sl / 2;
  g.add(box(w - 0.16, 0.004, gi, m, 0, -0.036, gz)); const fine = std('#c8c8c4', .6); for (let i = -12; i <= 12; i++) g.add(box(0.002, 0.002, gi - 0.02, fine, i * (w - 0.2) / 24, -0.0385, gz)); void grille;
  const slots = dirs === 2 ? [-1, 1] : [1]; for (const sd of slots) { const z = sd * (d / 2 - 0.04 - sl / 2); g.add(box(w - 0.12, 0.006, sl, dark, 0, -0.037, z)); const vane = box(w - 0.14, 0.004, sl * 0.9, m, 0, -0.041, z); vane.rotation.x = sd * 0.35; g.add(vane); }
  return g;
}
Object.assign(CATALOG, {
  curtain: { name: 'カーテン', emoji: '🪟', cat: '窓まわり', kind: 'wall', size: [1.8, 2.0, 0.15], color: '#d9cdb8', fabric: 'plain', opts: { rail: 'double', hang: 'drape', railColor: 'silver', open: 0.3, lace: true, laceType: 'lace_plain', tie: false, tieH: 0.7, box: false },
    words: ['カーテン', 'ドレープ', 'かーてん', '2倍ひだ', '3つ山', '2つ山', 'ハトメ', 'ウェーブ', 'タッセル'],
    styles: [
      { id: 'mitsu', name: '3つ山・2倍ひだ(基本)', words: ['2倍ひだ', '3つ山', '三つ山'] },
      { id: 'futatsu', name: '2つ山・1.5倍ひだ', words: ['1.5倍ひだ', '2つ山', '二つ山'] },
      { id: 'hitotsu', name: '1つ山(ワンプリーツ)・1.5倍', words: ['1つ山', 'ワンプリーツ'] },
      { id: 'wave', name: 'ウェーブ(形状記憶)・2倍', words: ['ウェーブ', '形状記憶'] },
      { id: 'hatome', name: 'ハトメ(リング)・1.5倍', words: ['ハトメ', 'アイレット'] },
      { id: 'flat', name: 'フラット(ひだなし)・1.2倍', words: ['フラット', 'ひだなし'] },
      { id: 'gather', name: 'ギャザー・2倍', words: ['ギャザー'] },
    ],
    params: [['rail', 'カーテンレール', 'choice', [['double', 'ダブル(ドレープ+レース)'], ['single', 'シングル(1枚だけ)']]], ['hang', 'シングルで掛けるもの', 'choice', [['drape', 'ドレープ(厚手)'], ['lace', 'レース']]], ['railColor', 'レールの色', 'choice', RAIL_COLORS.map(r => [r[0], r[1]])], ['open', '開き具合', 0, 1], ['tie', 'タッセルでまとめる', 'bool'], ['tieH', 'ふさかけの高さ(すその上から)', 0.2, 1.8, 'mm'], ['lace', 'レースも', 'bool'], ['laceType', 'レースの種類', 'choice', LACE_TYPES], ['box', 'カーテンボックス', 'bool']],
    build(it) {
      const g = new THREE.Group(), w = it.w, h = it.h, P = PLEATS[styleOf(it).id] || PLEATS.mitsu, tie = !!it.opts.tie, open = it.opts.open ?? .3;
      const rc = RAIL_COLORS.find(r => r[0] === it.opts.railColor) || RAIL_COLORS[0], metal = std(rc[2], rc[3] ? .35 : .55, rc[3] ? .7 : 0);
      const single = it.opts.rail === 'single', laceOnly = single && it.opts.hang === 'lace'; // シングルでレースだけ:レースを開け閉め・タッセルもレース
      const laceMat = surfaceMaterial('fabric', { lib: it.opts.laceType || 'lace_plain' }, { w, h });
      if (P.ring) { // ハトメ:ポール(棒)に通す
        const pole = cyl(0.012, 0.012, w + 0.16, metal, 0, h / 2 + 0.02, 0.1, 12); pole.rotation.z = Math.PI / 2; g.add(pole);
        for (const sx of [-1, 1]) { g.add(sph(0.02, metal, sx * (w / 2 + 0.09), h / 2 + 0.02, 0.1)); g.add(box(0.015, 0.015, 0.1, metal, sx * (w / 2 + 0.02), h / 2 + 0.02, 0.05)); }
      } else {
        const rail = box(w + 0.1, 0.03, 0.03, metal, 0, h / 2 + 0.02, 0.1); g.add(rail);
        const br1 = box(0.02, 0.02, 0.1, metal, -w / 2, h / 2 + 0.02, 0.05); g.add(br1); const br2 = br1.clone(); br2.position.x = w / 2; g.add(br2);
      }
      const half = w / 2, fab = half * P.f; // 片側の生地の幅(ひだを伸ばした長さ)
      const top = h / 2 - (P.ring ? 0.0 : 0.015), bot = -h / 2 + 0.01;
      const pw = tie ? half * 0.55 : Math.max(0.1, half * (1 - open * 0.88)); // レールの上で布がしめる幅
      const tieH = Math.min(h - 0.35, Math.max(0.15, it.opts.tieH ?? h * 0.35)), yTie = bot + tieH, wTie = Math.min(0.16, Math.max(0.09, fab * 0.075));
      const mat = laceOnly ? laceMat : fabric(it, half, h);
      for (const sx of [-1, 1]) {
        const panel = curtainPanel({ sx, half, top, bot, pw, fab, P, tie, yTie, wTie, mat }); g.add(panel);
        if (P.ring) { const n = Math.max(3, Math.round(half / P.pitch)); for (let k = 0; k <= n; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 16), metal); ring.position.set(sx * (half - k * pw / n), h / 2 + 0.02, 0.1); g.add(ring); } }
        if (tie) {
          // タッセル(カーテンと同じ生地の帯):まとめた布を巻いて、壁のふさかけに掛ける
          const cx = sx * (half - wTie / 2), zf = 0.1 + 0.07, zb = 0.012;
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 28, 1, true), laceOnly ? std('#f6f4ef', .9, 0, { transparent: true, opacity: .8, side: THREE.DoubleSide }) : mat); band.scale.set(wTie + 0.035, 1, zf - zb); band.position.set(cx, yTie, (zf + zb) / 2); band.castShadow = true; g.add(band);
          const edge = laceOnly ? std('#f4f2ec', .9, 0, { transparent: true, opacity: .85 }) : std(it.color || '#d9cdb8', .8); for (const dy of [-0.03, 0.03]) { const e2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 28), edge); e2.rotation.x = Math.PI / 2; e2.scale.set(wTie + 0.035, zf - zb, 1); e2.position.set(cx, yTie + dy, (zf + zb) / 2); g.add(e2); }
          // ふさかけ(壁の金具)
          const hx = sx * (half + 0.02); g.add(cyl(0.018, 0.018, 0.012, std('#b8a27a', .35, .6), hx, yTie, 0.006, 12).rotateX(Math.PI / 2)); g.add(box(0.012, 0.012, 0.05, std('#b8a27a', .35, .6), hx, yTie, 0.03));
        }
      }
      if (it.opts.box) { const bm = std(it.opts.boxColor || WHITE, .6); g.add(box(w + 0.2, 0.12, 0.02, bm, 0, h / 2 + 0.06, 0.19)); g.add(box(w + 0.2, 0.02, 0.2, bm, 0, h / 2 + 0.11, 0.1)); g.add(box(0.02, 0.12, 0.2, bm, -w / 2 - 0.09, h / 2 + 0.06, 0.1)); g.add(box(0.02, 0.12, 0.2, bm, w / 2 + 0.09, h / 2 + 0.06, 0.1)); }
      if (it.opts.lace && !single) { const lace = pleatedPanel(w - 0.04, h - 0.04, 0.1, 0.02, laceMat); lace.position.set(0, -0.02, 0.05); lace.castShadow = false; g.add(lace); g.add(box(w + 0.1, 0.03, 0.03, metal, 0, h / 2 + 0.02, 0.05)); }
      return g;
    } },
  lace: { name: 'レースカーテン', emoji: '🤍', cat: '窓まわり', kind: 'wall', size: [1.8, 2.0, 0.08], color: '#ffffff', fabric: 'lace', opts: { laceType: 'lace_plain' }, words: ['レース', 'れーす', 'ミラーレース', '遮像レース', 'ボイル'], params: [['laceType', 'レースの種類', 'choice', LACE_TYPES]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h; g.add(box(w + 0.1, 0.03, 0.03, std(METAL, .35, .7), 0, h / 2 + 0.02, 0.05)); const m = surfaceMaterial('fabric', { lib: it.opts.laceType || 'lace_plain' }, { w, h }); const p = pleatedPanel(w - 0.04, h - 0.04, 0.1, 0.02, m); p.position.set(0, -0.02, 0.05); p.castShadow = false; g.add(p); return g; } },
  roller: { name: 'ロールスクリーン', emoji: '📜', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.08], color: '#efe9dc', fabric: 'plain', opts: { down: 0.8 }, words: ['ロールスクリーン', 'ロール', 'スクリーン'], params: [['down', '下ろし具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .8; g.add(box(w + 0.06, 0.07, 0.07, std(WHITE, .5), 0, h / 2 - 0.035, 0.045));
      const sh = Math.max(0.05, h * down); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, sh), fabric(it, w, sh)); s.position.set(0, h / 2 - 0.07 - sh / 2, 0.075); s.castShadow = true; s.receiveShadow = true; g.add(s);
      g.add(box(w, 0.03, 0.02, std(WHITE, .5), 0, h / 2 - 0.07 - sh, 0.075)); return g; } },
  shade: { name: 'シェード', emoji: '🪭', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.1], color: '#d8cdb9', fabric: 'linen', opts: { down: 0.7 }, words: ['シェード', 'ローマンシェード', 'プレーンシェード'], params: [['down', '下ろし具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .7; g.add(box(w + 0.06, 0.06, 0.08, std(WHITE, .5), 0, h / 2 - 0.03, 0.05));
      const mat = fabric(it, w, h); const sh = Math.max(0.08, h * down), flat = Math.max(0, sh - 0.25); if (flat > 0.02) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, flat), mat); p.position.set(0, h / 2 - 0.06 - flat / 2, 0.09); p.castShadow = true; p.receiveShadow = true; g.add(p); }
      const folds = 3 + Math.round((1 - down) * 4); const fh = (sh - flat) / folds; for (let i = 0; i < folds; i++) { const f = box(w, fh * 0.95, 0.03 + i * 0.012, mat, 0, h / 2 - 0.06 - flat - fh * (i + 0.5), 0.09 + (0.03 + i * 0.012) / 2); g.add(f); } return g; } },
  pleats: { name: 'プリーツスクリーン', emoji: '🗂️', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.06], color: '#efe6d2', fabric: 'plain', opts: { down: 0.8 }, words: ['プリーツスクリーン', 'プリーツ', 'ハニカム'], params: [['down', '下ろし具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .8; g.add(box(w + 0.04, 0.04, 0.05, std(WHITE, .5), 0, h / 2 - 0.02, 0.04));
      const sh = Math.max(0.05, h * down), pitch = 0.025, n = Math.max(2, Math.round(sh / pitch)); const geo = new THREE.PlaneGeometry(w, sh, 1, n); const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const row = Math.floor(i / 2); pos.setZ(i, (row % 2) * 0.02); } geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, fabric(it, w, sh)); m.position.set(0, h / 2 - 0.04 - sh / 2, 0.03); m.castShadow = true; m.receiveShadow = true; g.add(m); g.add(box(w, 0.02, 0.03, std(WHITE, .5), 0, h / 2 - 0.04 - sh, 0.04)); return g; } },
  shoji: { name: '障子', emoji: '🎎', cat: '窓まわり', kind: 'wall', size: [1.7, 1.8, 0.06], color: '#b98a5a', opts: { open: 0 }, words: ['障子', 'しょうじ'], params: [['open', '開き具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, open = it.opts.open ?? 0, wood = std(it.color, .6), paper = new THREE.MeshStandardMaterial({ color: '#fbf7ee', roughness: 1, transparent: true, opacity: .9, side: THREE.DoubleSide, emissive: '#fff6e6', emissiveIntensity: .15 });
      g.add(box(w + 0.1, 0.05, 0.08, wood, 0, h / 2 + 0.025, 0.04)); g.add(box(w + 0.1, 0.04, 0.08, wood, 0, -h / 2 - 0.02, 0.04));
      const pw = w / 2, panels = [[-pw / 2 + open * pw * 0.96, 0.02], [pw / 2, 0.05]];
      for (const [px, pz] of panels) { const pg = new THREE.Group(); pg.position.set(px, 0, pz); g.add(pg); const sheet = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.04, h - 0.04), paper); sheet.position.z = 0.012; pg.add(sheet);
        pg.add(box(0.03, h, 0.025, wood, -pw / 2 + 0.015, 0, 0.012)); pg.add(box(0.03, h, 0.025, wood, pw / 2 - 0.015, 0, 0.012)); pg.add(box(pw, 0.03, 0.025, wood, 0, h / 2 - 0.015, 0.012)); pg.add(box(pw, 0.03, 0.025, wood, 0, -h / 2 + 0.015, 0.012));
        const cols = 3, rows = Math.max(4, Math.round(h / 0.3)); for (let i = 1; i < cols; i++) pg.add(box(0.012, h - 0.04, 0.012, wood, -pw / 2 + pw * i / cols, 0, 0.02)); for (let j = 1; j < rows; j++) pg.add(box(pw - 0.04, 0.012, 0.012, wood, 0, -h / 2 + h * j / rows, 0.02)); }
      return g; } },
  blind: { name: 'ブラインド(横型)', emoji: '🎚️', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.06], color: '#f2f2f0', opts: { down: 0.9, tilt: 0.35 }, words: ['ブラインド', '横型ブラインド', 'アルミブラインド', 'よこがた'], params: [['down', '下ろし具合', 0, 1], ['tilt', '羽の角度', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .9, tilt = (it.opts.tilt ?? .35) * 1.3;
      g.add(box(w + 0.04, 0.05, 0.05, std(it.color, .5), 0, h / 2 - 0.025, 0.04));
      const pitch = 0.025, n = Math.max(1, Math.floor(h * down / pitch)); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, 0.0015, 0.025), std(it.color, .4, .3), n); im.castShadow = true; im.receiveShadow = true;
      const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { o.position.set(0, h / 2 - 0.06 - i * pitch, 0.04); o.rotation.set(tilt, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im);
      g.add(box(w, 0.02, 0.025, std(it.color, .5), 0, h / 2 - 0.06 - n * pitch, 0.04)); return g; } },
  vblind: { name: 'ブラインド(縦型)', emoji: '🏛️', cat: '窓まわり', kind: 'wall', size: [1.8, 2.0, 0.1], color: '#ece7dc', fabric: 'plain', opts: { tilt: 0.3 }, words: ['縦型ブラインド', 'バーチカル', 'たて型', '縦型'], params: [['tilt', '羽の角度', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, tilt = (it.opts.tilt ?? .3) * 1.4; g.add(box(w + 0.04, 0.05, 0.06, std(WHITE, .5), 0, h / 2 - 0.025, 0.05));
      const pitch = 0.08, n = Math.max(1, Math.floor(w / pitch)); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.089, h - 0.07, 0.002), fabric(it, 0.09, h), n); im.castShadow = true; im.receiveShadow = true;
      const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { o.position.set(-w / 2 + pitch / 2 + i * pitch, -0.035, 0.05); o.rotation.set(0, tilt, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im); return g; } },

  ceilingLight: { name: 'シーリングライト', emoji: '💡', cat: '照明', kind: 'ceiling', size: [0.5, 0.1, 0.5], range: { w: [0.3, 0.7] }, color: '#ffffff', opts: { on: true, power: 1 }, words: ['シーリングライト', 'シーリング', '天井の電気', '天井の照明', '天井灯', '電気', 'ライト', '照明'], params: [['power', '明るさ', 0.2, 2], ['warm', '電球色(オレンジ)', 'bool'], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), r = it.w / 2, on = it.opts.on !== false; g.add(cyl(r * .3, r * .3, 0.03, std(WHITE, .5), 0, -0.015, 0));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(r * .92, r, 0.09, 40), on ? emissive(it.opts.warm ? '#ffe9c4' : '#fff8ea', 1.1) : std('#e9e9e6', .6)); shade.position.y = -0.075; g.add(shade);
      const rim = cyl(r, r, 0.02, std(WHITE, .4), 0, -0.11, 0, 40); g.add(rim); if (on) { const l = light(g, it.opts.warm ? WARM : DAYLIGHT, 8 * (it.opts.power ?? 1), 0, -0.55, 0); l.castShadow = true; } return g; } },
  pendant: { name: 'ペンダントライト', emoji: '🔆', cat: '照明', kind: 'ceiling', size: [0.35, 0.8, 0.35], range: { w: [0.12, 0.6] }, color: '#3b3b3f', opts: { on: true, drop: 0.7, power: 1 }, words: ['ペンダント', 'ペンダントライト', '吊り下げ', 'つりさげ'], params: [['drop', '下げる長さ(天井から)', 0.15, 1.1, 'mm'], ['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), r = it.w / 2, drop = it.opts.drop ?? .7, on = it.opts.on !== false; g.add(cyl(0.05, 0.05, 0.02, std(it.color, .5, .3), 0, -0.01, 0)); g.add(cyl(0.003, 0.003, drop, std(BLACK, .6), 0, -drop / 2, 0, 8));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(r * .45, r, r * 0.9, 32, 1, true), std(it.color, .45, .2, { side: THREE.DoubleSide })); shade.position.y = -drop - r * .45; g.add(shade);
      const bulb = sph(0.03, on ? emissive('#fff2d6', 3) : std('#eee', .3), 0, -drop - r * .5, 0); g.add(bulb); if (on) { const l = light(g, WARM, 6 * (it.opts.power ?? 1), 0, -drop - r * .6, 0); l.castShadow = true; } return g; } },
  chandelier: { name: 'シャンデリア', emoji: '✨', cat: '照明', kind: 'ceiling', size: [0.7, 0.8, 0.7], range: { w: [0.4, 1.1] }, color: GOLD, opts: { on: true, arms: 6, power: 1 }, words: ['シャンデリア', 'しゃんでりあ'], params: [['arms', '灯の数', 3, 12], ['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), r = it.w / 2, on = it.opts.on !== false, n = Math.round(it.opts.arms ?? 6), gold = std(it.color, .25, .9), crystal = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, metalness: 0, transmission: .9, thickness: .02, transparent: true, opacity: .7 });
      g.add(cyl(0.04, 0.04, 0.02, gold, 0, -0.01, 0)); g.add(cyl(0.008, 0.008, 0.45, gold, 0, -0.235, 0, 8)); g.add(sph(0.06, gold, 0, -0.5, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .55, 0.012, 10, 48), gold); ring.rotation.x = Math.PI / 2; ring.position.y = -0.5; g.add(ring);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(cx * r * .6, -0.68, cz * r * .6), new THREE.Vector3(cx * r, -0.5, cz * r));
        const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.008, 8), gold); arm.castShadow = true; g.add(arm);
        g.add(cyl(0.025, 0.03, 0.02, gold, cx * r, -0.49, cz * r)); g.add(cyl(0.012, 0.012, 0.1, std('#fff6e4', .5), cx * r, -0.43, cz * r, 10));
        g.add(sph(0.028, on ? emissive('#ffe9c0', 3.5) : std('#eee', .3), cx * r, -0.35, cz * r));
        for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), crystal); c.position.set(cx * r * (0.55 + k * 0.15), -0.55 - k * 0.06, cz * r * (0.55 + k * 0.15)); c.scale.y = 2; g.add(c); } }
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), crystal); c.position.set(Math.cos(a) * r * .55, -0.56 - (k % 2) * 0.04, Math.sin(a) * r * .55); c.scale.y = 2.2; g.add(c); }
      if (on) { const l = light(g, '#ffe6bd', 12 * (it.opts.power ?? 1), 0, -0.6, 0); l.castShadow = true; } return g; } },
  wallLight: { name: 'ブラケット(壁の電気)', emoji: '🕯️', cat: '照明', kind: 'wall', size: [0.2, 0.3, 0.2], range: { w: [0.1, 0.4], h: [0.15, 0.5] }, color: '#2f3036', opts: { on: true, power: 1 }, words: ['ブラケット', '壁の電気', '壁掛けの電気', '壁掛け照明', '壁のライト', '壁付け', '壁掛け', '壁の照明'], params: [['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), on = it.opts.on !== false; g.add(box(0.1, 0.16, 0.02, std(it.color, .4, .4), 0, 0, 0.01)); g.add(cyl(0.008, 0.008, 0.12, std(it.color, .4, .4), 0, 0.02, 0.07).rotateX(Math.PI / 2));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.14, 24, 1, true), std('#f3eee4', .7, 0, { side: THREE.DoubleSide })); shade.position.set(0, 0.07, 0.13); g.add(shade);
      g.add(sph(0.025, on ? emissive('#fff0d0', 3) : std('#eee', .3), 0, 0.07, 0.13)); if (on) light(g, WARM, 3 * (it.opts.power ?? 1), 0, 0.12, 0.2); return g; } },
  downlight: { name: 'ダウンライト', emoji: '🔦', cat: '照明', kind: 'ceiling', size: [0.1, 0.02, 0.1], range: { w: [0.075, 0.15] }, color: '#ffffff', opts: { on: true, power: 1 }, words: ['ダウンライト', 'スポット', 'スポットライト'], params: [['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), on = it.opts.on !== false; g.add(cyl(0.06, 0.06, 0.01, std(WHITE, .5), 0, -0.005, 0)); g.add(cyl(0.045, 0.045, 0.004, on ? emissive('#fff3dd', 2.5) : std('#ddd', .5), 0, -0.011, 0));
      if (on) { const s = new THREE.SpotLight(WARM, 10 * (it.opts.power ?? 1), 0, 0.75, 0.6, 2); s.position.set(0, -0.02, 0); s.target.position.set(0, -2.5, 0); g.add(s); g.add(s.target); g.userData.lights = [s]; } return g; } },
  floorLamp: { name: 'フロアランプ', emoji: '🛋️', cat: '照明', kind: 'floor', size: [0.35, 1.5, 0.35], color: '#f1ead9', opts: { on: true, power: 1 }, words: ['フロアランプ', 'スタンド', 'スタンドライト', 'フロアライト'], params: [['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), h = it.h, on = it.opts.on !== false; g.add(cyl(0.14, 0.14, 0.02, std(BLACK, .4, .5), 0, 0.01, 0)); g.add(cyl(0.012, 0.012, h - 0.3, std(BLACK, .4, .5), 0, (h - 0.3) / 2, 0, 10));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(it.w * .4, it.w / 2, 0.3, 28, 1, true), std(it.color, .8, 0, { side: THREE.DoubleSide })); shade.position.y = h - 0.15; g.add(shade);
      g.add(sph(0.03, on ? emissive('#fff0d0', 3) : std('#eee', .3), 0, h - 0.15, 0)); if (on) light(g, WARM, 4 * (it.opts.power ?? 1), 0, h - 0.15, 0); return g; } },

  rug: { name: 'ラグ・絨毯', emoji: '🧶', cat: '敷物', kind: 'floor', size: [2.0, 0.015, 1.4], color: '#b8a58c', fabric: 'linen', opts: { round: false }, words: ['ラグ', '絨毯', 'じゅうたん', 'カーペット', 'マット'], params: [['round', '丸い形', 'bool']],
    build(it) { const g = new THREE.Group(); const m = fabric(it, it.w, it.d); m.roughness = 1; let r; if (it.opts.round) r = cyl(it.w / 2, it.w / 2, 0.015, m, 0, 0.0075, 0, 48); else r = box(it.w, 0.015, it.d, m, 0, 0.0075, 0); r.castShadow = false; g.add(r); return g; } },

  counter: { name: 'カウンター', emoji: '🍸', cat: '家具', kind: 'floor', size: [1.8, 1.0, 0.55], color: WOOD, opts: { base: '#f1efe9' }, words: ['カウンター', 'カウンターテーブル', 'キッチンカウンター'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w - 0.06, it.h - 0.05, it.d - 0.1, std(it.opts.base || '#f1efe9', .6), 0, (it.h - 0.05) / 2, -0.04)); g.add(box(it.w, 0.04, it.d, std(it.color, .35), 0, it.h - 0.02, 0)); g.add(box(it.w - 0.1, 0.08, it.d - 0.16, std(BLACK, .7), 0, 0.04, -0.06)); return g; } },
  table: { name: 'ダイニングテーブル', emoji: '🍽️', cat: '家具', kind: 'floor', size: [1.4, 0.72, 0.8], color: WOOD, opts: { chairs: 4 }, words: ['テーブル', 'ダイニングテーブル', '食卓', 'ダイニング'], params: [['chairs', '椅子の数', 0, 6]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, wood = std(it.color, .45); g.add(box(w, 0.04, d, wood, 0, h - 0.02, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, h - 0.04, 0.06, wood, x * (w / 2 - 0.08), (h - 0.04) / 2, z * (d / 2 - 0.08)));
      const n = Math.round(it.opts.chairs ?? 4); const spots = []; const per = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const sideZ = i < per ? 1 : -1, k = i < per ? i : i - per, cnt = i < per ? per : n - per; spots.push([(k + 0.5) / cnt * w - w / 2, sideZ * (d / 2 + 0.3), sideZ > 0 ? Math.PI : 0]); }
      for (const [x, z, ry] of spots) { const c = chairGroup(std(it.color, .5)); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); } return g; } },
  lowtable: { name: 'ローテーブル', emoji: '🫖', cat: '家具', kind: 'floor', size: [1.0, 0.4, 0.55], color: DARKWOOD, opts: {}, words: ['ローテーブル', 'センターテーブル', 'コーヒーテーブル'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .4); g.add(box(w, 0.035, d, m, 0, h - 0.0175, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.05, h - 0.035, 0.05, m, x * (w / 2 - 0.06), (h - 0.035) / 2, z * (d / 2 - 0.06))); return g; } },
  shelf: { name: '棚', emoji: '📚', cat: '家具', kind: 'floor', size: [0.8, 1.8, 0.3], color: WOOD, opts: { boards: 5 }, words: ['棚', '本棚', 'シェルフ', 'ラック', '収納'], params: [['boards', '段数', 2, 8], ['gadgets', 'ゲーム機を並べる(本のかわりに)', 'bool'], ['led', '光る帯', 'bool']],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .5), n = Math.round(it.opts.boards ?? 5); g.add(box(0.02, h, d, m, -w / 2 + 0.01, h / 2, 0)); g.add(box(0.02, h, d, m, w / 2 - 0.01, h / 2, 0)); g.add(box(w, h, 0.01, m, 0, h / 2, -d / 2 + 0.005));
      for (let i = 0; i < n; i++) { const y = 0.02 + i * (h - 0.04) / (n - 1); g.add(box(w - 0.04, 0.02, d, m, 0, y, 0)); if (i < n - 1 && it.opts.gadgets) gadgetRow(g, -w / 2 + 0.02, w / 2 - 0.02, y + 0.01, 0, it.id + i, Math.min(1.6, Math.max(0.8, (h - 0.04) / (n - 1) / 0.2))); if (i > 0 && it.opts.led) { const col = it.opts.ledColor || '#4fe0e6'; g.add(box(w - 0.06, 0.01, 0.012, emissive(col, 2.6), 0, y - 0.016, d / 2 - 0.012)); if (i % 2) light(g, col, 1.2, 0, y - 0.1, d / 2 + 0.1, { distance: 1.8 }); } if (i < n - 1 && !it.opts.gadgets) for (let k = 0; k < 4; k++) { const c = ['#c5553f', '#4a6fa5', '#e0c060', '#6a9a6a', '#8b6b9a'][(i * 3 + k) % 5]; g.add(box(0.035 + (k % 2) * 0.01, 0.2 + (k % 3) * 0.03, d * .7, std(c, .7), -w / 2 + 0.1 + k * 0.06, y + 0.12, 0)); } } return g; } },
  tvboard: { name: 'テレビ台', emoji: '📺', cat: '家具', kind: 'floor', size: [1.6, 0.45, 0.4], color: DARKWOOD, opts: { tv: true }, words: ['テレビ台', 'テレビボード', 'tvボード'], params: [['tv', 'テレビも', 'bool']],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .4); g.add(box(w, h, d, m, 0, h / 2, 0)); g.add(box(w - 0.04, 0.01, 0.005, std(BLACK, .5), 0, h / 2, d / 2 + 0.002));
      if (it.opts.tv !== false) { g.add(box(w * .7, w * .7 * .56, 0.03, std('#111', .15, .5), 0, h + w * .7 * .28 + 0.05, 0)); g.add(box(0.3, 0.05, 0.2, std(BLACK, .4, .5), 0, h + 0.025, 0)); } return g; } },
  tv: { name: '壁掛けテレビ', emoji: '📺', cat: '壁かざり', kind: 'wall', size: [1.2, 0.68, 0.05], color: '#111111', opts: {}, words: ['テレビ', 'tv', 'モニター', '壁掛けテレビ'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.03, std('#0b0b0d', .15, .5), 0, 0, 0.02)); g.add(box(it.w - 0.02, it.h - 0.02, 0.005, std('#1a1d26', .1, .6), 0, 0, 0.038)); return g; } },
  picture: { name: '絵・額', emoji: '🖼️', cat: '壁かざり', kind: 'wall', size: [0.6, 0.45, 0.04], color: '#f0ece2', opts: {}, words: ['絵', '額', 'ポスター', '額縁', 'アート'],
    build(it) { const g = new THREE.Group(), fr = std(it.opts.frame || DARKWOOD, .5); g.add(box(it.w, it.h, 0.03, fr, 0, 0, 0.015)); let inner; if (it.opts.photo && it._assets && it._assets[it.opts.photo]) inner = surfaceMaterial('wall', { photo: it.opts.photo }, { w: it.w, h: it.h }, it._assets); else inner = std(it.color, .8); const p = new THREE.Mesh(new THREE.PlaneGeometry(it.w - 0.06, it.h - 0.06), inner); p.position.z = 0.031; g.add(p); if (!it.opts.photo) { const a = new THREE.Mesh(new THREE.CircleGeometry(Math.min(it.w, it.h) * .25, 24), std('#d9a066', .8)); a.position.set(it.w * .1, it.h * .05, 0.032); g.add(a); const b = new THREE.Mesh(new THREE.PlaneGeometry(it.w - 0.1, it.h * .2), std('#6a8a9a', .8)); b.position.set(0, -it.h * .3, 0.032); g.add(b); } return g; } },
  mirror: { name: '鏡', emoji: '🪞', cat: '壁かざり', kind: 'wall', size: [0.5, 1.2, 0.03], color: METAL, opts: {}, words: ['鏡', 'ミラー', 'かがみ'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.02, std(it.color, .3, .8), 0, 0, 0.01)); const m = new THREE.Mesh(new THREE.PlaneGeometry(it.w - 0.04, it.h - 0.04), new THREE.MeshStandardMaterial({ color: '#e8f0ff', roughness: 0.02, metalness: 1 })); m.position.z = 0.021; g.add(m); return g; } },
  clock: { name: '時計', emoji: '🕰️', cat: '壁かざり', kind: 'wall', size: [0.3, 0.3, 0.04], range: { w: [0.2, 0.5], h: [0.2, 0.5] }, color: '#f4f4f2', opts: {}, words: ['時計', 'とけい'],
    build(it) { const g = new THREE.Group(), r = it.w / 2; g.add(cyl(r, r, 0.03, std(DARKWOOD, .5), 0, 0, 0.015).rotateX(Math.PI / 2)); g.add(cyl(r - 0.02, r - 0.02, 0.005, std(it.color, .6), 0, 0, 0.032).rotateX(Math.PI / 2)); g.add(box(0.012, r * .6, 0.004, std(BLACK, .5), 0, r * .3, 0.036)); const m = box(0.012, r * .8, 0.004, std(BLACK, .5), 0, 0, 0.037); m.rotation.z = -Math.PI / 3; m.position.set(r * .35, r * .2, 0.037); g.add(m); return g; } },
  // ---- 設備(別画面「設備」から置く) ----
  outlet: { name: 'コンセント(2口)', emoji: '🔌', cat: '電気', equip: true, kind: 'wall', size: [0.07, 0.12, 0.012], range: { w: [0.05, 0.15], h: [0.07, 0.25] }, attachY: 0.25, color: '#f4f4f2', opts: {}, words: ['コンセント', 'こんせんと'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.008, std(it.color, .5), 0, 0, 0.004)); const dark = std('#3a3a3e', .4); for (const dy of [0.018, -0.018]) { g.add(box(0.004, 0.012, 0.004, dark, -0.007, dy, 0.009)); g.add(box(0.004, 0.012, 0.004, dark, 0.007, dy, 0.009)); } return g; } },
  switch: { name: 'スイッチ', emoji: '🔘', cat: '電気', equip: true, kind: 'wall', size: [0.07, 0.12, 0.015], range: { w: [0.05, 0.15], h: [0.07, 0.25] }, attachY: 1.2, color: '#f4f4f2', opts: {}, words: ['スイッチ', 'すいっち', '電気のスイッチ'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.008, std(it.color, .5), 0, 0, 0.004)); g.add(box(it.w * 0.6, it.h * 0.55, 0.008, std('#ffffff', .4), 0, 0, 0.012)); g.add(box(it.w * 0.6, 0.004, 0.006, std('#cfd3d8', .4), 0, 0, 0.016)); return g; } },
  intercom: { name: 'インターホン', emoji: '📟', cat: '電気', equip: true, kind: 'wall', size: [0.10, 0.17, 0.03], range: { w: [0.08, 0.2], h: [0.12, 0.3] }, attachY: 1.4, color: '#f4f4f2', opts: {}, words: ['インターホン', 'ドアホン', 'いんたーほん'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.025, std(it.color, .5), 0, 0, 0.0125)); g.add(box(it.w * 0.76, it.h * 0.42, 0.004, std('#1d2733', .2, .3), 0, it.h * 0.18, 0.027)); g.add(box(it.w * 0.3, 0.012, 0.004, std('#8fb4d8', .5), 0, -it.h * 0.25, 0.027)); return g; } },
  smoke: { name: '火災警報器', emoji: '🚨', cat: '電気', equip: true, kind: 'ceiling', size: [0.10, 0.035, 0.10], range: { w: [0.08, 0.15] }, color: '#f4f4f2', opts: {}, words: ['火災警報器', '火災報知器', '警報器', '煙感知器'],
    build(it) { const g = new THREE.Group(); g.add(cyl(it.w / 2, it.w / 2 * 0.9, 0.03, std(it.color, .5), 0, -0.015, 0, 24)); g.add(cyl(0.006, 0.006, 0.004, std('#d33', .4), 0, -0.032, 0.02, 8)); return g; } },
  aircon: { palette: true, name: 'エアコン(壁掛け)', emoji: '❄️', cat: '空調・換気', equip: true, kind: 'wall', size: [0.80, 0.29, 0.23], range: { w: [0.7, 1.0], h: [0.25, 0.35], d: [0.2, 0.3] }, attachY: 'top', color: '#f6f6f3', opts: {}, words: ['エアコン', 'クーラー', '冷房', '暖房機'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d; g.add(box(w, h, d * 0.85, std(it.color, .35), 0, 0, d * 0.425)); g.add(box(w * 0.98, h * 0.5, 0.01, std(it.color, .25), 0, h * 0.2, d * 0.85 + 0.005)); g.add(box(w * 0.9, 0.03, 0.02, std('#4a4f57', .4), 0, -h * 0.32, d * 0.82)); g.add(box(0.03, 0.006, 0.004, std('#5fd36a', .3), w * 0.38, -h * 0.1, d * 0.86)); return g; } },
  register: { name: '給気口(レジスター)', emoji: '⭕', cat: '空調・換気', equip: true, kind: 'wall', size: [0.15, 0.15, 0.03], range: { w: [0.1, 0.25] }, attachY: 2.0, color: '#f4f4f2', opts: {}, words: ['給気口', 'レジスター', '吸気口', '換気口', '通気口'],
    build(it) { const g = new THREE.Group(), r = it.w / 2; const m = std(it.color, .5); g.add(cyl(r, r, 0.012, m, 0, 0, 0.006).rotateX(Math.PI / 2)); g.add(cyl(r * 0.8, r * 0.8, 0.02, m, 0, 0, 0.02).rotateX(Math.PI / 2)); g.add(cyl(r * 0.84, r * 0.84, 0.006, std('#55585e', .5), 0, 0, 0.012).rotateX(Math.PI / 2)); return g; } },
  ventfan: { name: '換気扇', emoji: '🌀', cat: '空調・換気', equip: true, kind: 'wall', size: [0.25, 0.25, 0.04], range: { w: [0.15, 0.4], h: [0.15, 0.4] }, attachY: 2.0, color: '#f4f4f2', opts: {}, words: ['換気扇', 'かんきせん'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h; g.add(box(w, h, 0.03, std(it.color, .5), 0, 0, 0.015)); const n = 6, pitch = (h - 0.03) / n; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w - 0.03, pitch * 0.5, 0.01, 1, 1, 1), std('#dcdfe3', .5), n); const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { o.position.set(0, -h / 2 + 0.015 + pitch * (i + .5), 0.034); o.rotation.set(0.5, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im); return g; } },
  bathtub: { name: '浴槽', emoji: '🛁', cat: '水まわり', equip: true, kind: 'floor', size: [1.6, 0.6, 0.75], range: { w: [0.75, 1.8], h: [0.5, 0.75], d: [0.6, 0.9] }, color: '#f6f6f3', opts: {}, words: ['浴槽', 'バスタブ', 'お風呂', '風呂', 'ふろ'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .25); g.add(box(w, h, d, m, 0, h / 2, 0)); g.add(box(w - 0.16, 0.02, d - 0.16, std('#cfe6f2', .1, .1), 0, h - 0.12, 0)); const rim = box(w, 0.03, d, m, 0, h - 0.015, 0); g.add(rim); g.add(box(w - 0.16, 0.2, d - 0.16, std('#dde3e8', .2), 0, h - 0.11, 0)); g.add(cyl(0.015, 0.015, 0.12, std(METAL, .3, .8), -w * 0.4, h + 0.04, -d / 2 + 0.1, 10)); return g; } },
  // ユニットバス(1616など)。浴槽は奥(-z)、洗い場は手前、水栓・鏡・カウンターは洗い場の左の壁。壁・天井・床の色は部屋の「床・壁」で変える
  unitbath: { name: 'ユニットバス(浴槽と水栓のセット)', emoji: '🛀', cat: '水まわり', equip: true, kind: 'floor', size: [1.6, 2.0, 1.6], range: { w: [1.2, 2.0], h: [1.9, 2.3], d: [1.2, 2.4] }, color: '#f6f6f3', opts: { mirror: true, counter: true }, words: ['ユニットバス', 'システムバス', '浴室セット', 'お風呂のセット'], params: [['mirror', '鏡', 'bool'], ['counter', 'カウンター', 'bool']],
    build(it) {
      const g = new THREE.Group(), w = it.w, d = it.d, m = std(it.color, .2), metal = std(METAL, .2, .9), white = std('#fbfbfa', .3);
      const tD = Math.min(0.8, d * 0.5), tH = 0.52, z0 = -d / 2 + tD / 2, t = 0.07;
      // 浴槽:前の面(エプロン)・奥・左右と、中の底・お湯
      g.add(box(w - 0.02, tH, t, m, 0, tH / 2, z0 + tD / 2 - t / 2)); g.add(box(w - 0.02, tH, t, m, 0, tH / 2, z0 - tD / 2 + t / 2));
      g.add(box(t, tH, tD, m, -w / 2 + 0.01 + t / 2, tH / 2, z0)); g.add(box(t, tH, tD, m, w / 2 - 0.01 - t / 2, tH / 2, z0));
      g.add(box(w - 0.02 - t * 2, 0.06, tD - t * 2, std('#eef2f4', .2), 0, 0.03, z0));
      const water = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02 - t * 2, tH - 0.2, tD - t * 2), new THREE.MeshStandardMaterial({ color: '#a9d6ea', roughness: .05, metalness: .1, transparent: true, opacity: .55 })); water.position.set(0, (tH - 0.2) / 2 + 0.06, z0); g.add(water);
      g.add(box(w - 0.3, 0.004, 0.004, std('#d8d8d4', .4), 0, tH * 0.55, z0 + tD / 2 + 0.001));
      // 水栓・シャワー(洗い場の左の壁)
      const wz = z0 + tD / 2 + (d - tD) / 2, xw = -w / 2;
      g.add(box(0.07, 0.07, 0.26, metal, xw + 0.035, 0.8, wz)); g.add(cyl(0.012, 0.012, 0.12, metal, xw + 0.1, 0.77, wz, 10));
      const bar = cyl(0.012, 0.012, 0.9, metal, xw + 0.035, 1.35, wz + 0.28, 10); g.add(bar);
      const head = cyl(0.045, 0.045, 0.025, metal, xw + 0.08, 1.75, wz + 0.28, 16); head.rotation.z = Math.PI / 2.4; g.add(head);
      if (it.opts.counter !== false) { g.add(box(0.17, 0.03, 0.75, white, xw + 0.085, 0.74, wz)); g.add(box(0.12, 0.02, 0.4, white, xw + 0.06, 1.05, wz - 0.15)); }
      if (it.opts.mirror !== false) { const mi = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.8), std('#dfe7ec', .03, 1)); mi.rotation.y = Math.PI / 2; mi.position.set(xw + 0.006, 1.32, wz - 0.12); g.add(mi); }
      // タオル掛け(手前の壁)
      const tb = cyl(0.01, 0.01, 0.5, metal, 0.2, 1.1, d / 2 - 0.04, 8); tb.rotation.z = Math.PI / 2; g.add(tb);
      return g;
    } },
  // 作りつけのクローゼット(天井近くまでの扉。折れ戸の継ぎ目と取っ手)
  closet: { name: 'クローゼット', emoji: '🚪', cat: '家具', kind: 'floor', size: [1.7, 2.3, 0.6], range: { w: [0.8, 3.6], h: [1.8, 2.4], d: [0.45, 0.9] }, color: '#f1efea', opts: {}, words: ['クローゼット', '押入れ', '押し入れ', '物入れ', 'くろーぜっと'],
    build(it) {
      const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .45), metal = std(METAL, .3, .8), line = std('#cfcac0', .6);
      g.add(box(w, h, d - 0.02, std('#e8e5df', .7), 0, h / 2, -0.01)); g.add(box(w, 0.05, 0.03, m, 0, h - 0.025, d / 2 - 0.015));
      const n = Math.max(2, Math.round(w / 0.45)), lw = w / n, dh = h - 0.07;
      for (let i = 0; i < n; i++) { const x = -w / 2 + lw * (i + 0.5); g.add(box(lw - 0.006, dh, 0.025, m, x, dh / 2 + 0.01, d / 2 - 0.0125)); if (i % 2 === 1) g.add(box(0.012, 0.25, 0.02, metal, x - lw / 2 + 0.04, 1.0, d / 2 + 0.01)); if (i > 0) g.add(box(0.004, dh, 0.004, line, x - lw / 2, dh / 2 + 0.01, d / 2 + 0.001)); }
      return g;
    } },
  // 天井埋込カセット形エアコン(住宅用)。1方向:パネル 1,200×460、2方向:1,050×560(ダイキン・パナソニックのハウジングエアコンの大きさ)
  cassette1: { name: '天井エアコン(1方向)', emoji: '❄️', cat: '空調・換気', equip: true, kind: 'ceiling', size: [1.2, 0.04, 0.46], range: { w: [0.9, 1.3], d: [0.4, 0.6] }, color: '#f4f4f2', palette: true, opts: {}, words: ['天井エアコン', '天井埋込', 'カセットエアコン', '天井カセット'],
    build(it) { return cassette(it, 1); } },
  cassette2: { name: '天井エアコン(2方向)', emoji: '❄️', cat: '空調・換気', equip: true, kind: 'ceiling', size: [1.05, 0.04, 0.56], range: { w: [0.9, 1.3], d: [0.45, 0.7] }, color: '#f4f4f2', palette: true, opts: {}, words: ['天井エアコン2方向', '2方向カセット', 'ダブルフロー'],
    build(it) { return cassette(it, 2); } },
  // 冷蔵庫(3〜4人家族で 幅650・高さ1,800・奥行700 くらい)
  fridge: { name: '冷蔵庫', emoji: '🧊', cat: '水まわり', equip: true, kind: 'floor', size: [0.65, 1.8, 0.7], range: { w: [0.5, 0.9], h: [1.2, 1.9], d: [0.6, 0.75] }, color: '#e9e9e7', opts: {}, words: ['冷蔵庫', 'れいぞうこ'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .3, .1), metal = std(METAL, .25, .8); g.add(box(w, h, d - 0.02, m, 0, h / 2, -0.01)); for (const [y0, y1] of [[0.05, 0.62], [0.65, h - 0.02]]) { g.add(box(w - 0.01, y1 - y0, 0.02, m, 0, (y0 + y1) / 2, d / 2 - 0.01)); g.add(box(0.015, Math.min(0.4, (y1 - y0) * 0.6), 0.025, metal, w / 2 - 0.05, (y0 + y1) / 2, d / 2 + 0.01)); } return g; } },
  // 洗濯機(縦型)と洗濯パン
  washer: { name: '洗濯機', emoji: '🫧', cat: '水まわり', equip: true, kind: 'floor', size: [0.6, 1.0, 0.6], range: { w: [0.5, 0.75], h: [0.85, 1.1], d: [0.5, 0.75] }, color: '#f4f4f2', opts: {}, words: ['洗濯機', 'せんたくき', 'ランドリー'],
    build(it) {
      const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .3);
      g.add(box(w + 0.04, 0.06, d + 0.04, std('#e9eaec', .5), 0, 0.03, 0));
      g.add(box(w - 0.02, h - 0.08, d - 0.04, m, 0, 0.06 + (h - 0.08) / 2, 0.01));
      const lid = box(w - 0.06, 0.02, d * 0.62, std('#d8dde2', .15, .1), 0, h - 0.01, 0.04); g.add(lid);
      g.add(box(w - 0.06, 0.1, 0.06, std('#e0e3e6', .3), 0, h - 0.04, -d / 2 + 0.06));
      return g;
    } },
  // 靴箱(下駄箱)。ふつうはカウンター型(高さ900)。トール型は天井近くまで、浮かせると足もとに靴が置ける
  shoebox: { name: '靴箱(下駄箱)', emoji: '👞', cat: '家具', kind: 'floor', size: [1.2, 0.9, 0.38], range: { w: [0.6, 2.7], h: [0.8, 2.4], d: [0.3, 0.45] }, color: '#d8c6a6', opts: { tall: false, float: false }, words: ['靴箱', '下駄箱', 'くつばこ', 'げたばこ', 'シューズボックス'], params: [['tall', 'トール型(天井近くまで)', 'bool'], ['float', '床から浮かせる', 'bool']],
    build(it) {
      const g = new THREE.Group(), w = it.w, d = it.d, m = std(it.color, .5), top = std('#cdb894', .4), metal = std(METAL, .3, .8);
      const H = it.opts.tall ? Math.max(it.h, 2.0) : it.h, y0 = it.opts.float ? 0.3 : 0.06, bh = H - y0 - (it.opts.tall ? 0 : 0.03);
      if (!it.opts.float) g.add(box(w - 0.02, y0, d - 0.06, std('#3b3833', .8), 0, y0 / 2, -0.02));
      g.add(box(w, bh, d - 0.02, std('#e2dccf', .7), 0, y0 + bh / 2, -0.01));
      const n = Math.max(2, Math.round(w / 0.45)), lw = w / n; for (let i = 0; i < n; i++) { const x = -w / 2 + lw * (i + .5); g.add(box(lw - 0.005, bh - 0.006, 0.02, m, x, y0 + bh / 2, d / 2 - 0.01)); g.add(box(0.012, 0.12, 0.02, metal, x + (i % 2 ? -1 : 1) * (lw / 2 - 0.04), y0 + (it.opts.tall ? 1.0 : bh - 0.12), d / 2 + 0.01)); }
      if (!it.opts.tall) g.add(box(w + 0.02, 0.03, d + 0.01, top, 0, y0 + bh + 0.015, 0));
      return g;
    } },
  // トイレ・洗面所の小物
  paperholder: { name: 'ペーパーホルダー', emoji: '🧻', cat: '水まわり', equip: true, kind: 'wall', size: [0.15, 0.12, 0.1], attachY: 0.7, color: '#c9c9c6', opts: {}, words: ['ペーパーホルダー', 'トイレットペーパー', '紙巻器', 'ペーパー'],
    build(it) { const g = new THREE.Group(), m = std(it.color, .25, .7); g.add(box(it.w, 0.05, 0.012, m, 0, 0.02, 0.006)); const roll = cyl(0.055, 0.055, 0.11, std('#fbfbf9', .9), 0, -0.01, 0.065, 20); roll.rotation.z = Math.PI / 2; g.add(roll); g.add(box(it.w + 0.01, 0.006, 0.1, m, 0, 0.05, 0.06)); return g; } },
  towelring: { name: 'タオルリング', emoji: '⭕', cat: '水まわり', equip: true, kind: 'wall', size: [0.2, 0.25, 0.08], attachY: 1.1, color: '#c9c9c6', opts: {}, words: ['タオルリング', 'タオル輪'],
    build(it) { const g = new THREE.Group(), m = std(it.color, .25, .8); const base = cyl(0.022, 0.022, 0.03, m, 0, 0.08, 0.015, 12); base.rotation.x = Math.PI / 2; g.add(base); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.007, 8, 24), m); ring.position.set(0, 0.0, 0.05); g.add(ring); g.add(box(0.16, 0.3, 0.02, std('#efe9df', .95), 0, -0.1, 0.05)); return g; } },
  towelbar: { name: 'タオル掛け', emoji: '🧺', cat: '水まわり', equip: true, kind: 'wall', size: [0.6, 0.05, 0.08], range: { w: [0.3, 0.9] }, attachY: 1.0, color: '#c9c9c6', opts: {}, words: ['タオル掛け', 'タオルかけ', 'タオルバー'],
    build(it) { const g = new THREE.Group(), m = std(it.color, .25, .8), w = it.w; const bar = cyl(0.009, 0.009, w, m, 0, 0, 0.06, 10); bar.rotation.z = Math.PI / 2; g.add(bar); for (const sx of [-1, 1]) { const b = cyl(0.012, 0.012, 0.06, m, sx * w / 2, 0, 0.03, 10); b.rotation.x = Math.PI / 2; g.add(b); } g.add(box(w * 0.7, 0.45, 0.025, std('#e9e1d3', .95), 0, -0.2, 0.06)); return g; } },
  // ニッチ:置くと壁のくぼみ(開口)になる
  niche: { name: 'ニッチ(壁のくぼみ)', emoji: '▭', cat: '壁かざり', kind: 'wall', size: [0.35, 0.5, 0.1], opening: true, color: '#ffffff', opts: {}, words: ['ニッチ', 'にっち', '飾り棚のくぼみ'], build() { return new THREE.Group(); } },
  plant: { name: '観葉植物(丸い木)', emoji: '🪴', cat: 'みどり', kind: 'floor', size: [0.6, 1.4, 0.6], color: '#4e8a5a', opts: {}, words: ['観葉植物', '植物', 'グリーン', '木', '鉢'],
    build(it) { const g = new THREE.Group(), h = it.h, r = it.w / 2; g.add(cyl(r * .4, r * .32, h * .22, std('#b9b1a6', .8), 0, h * .11, 0)); g.add(cyl(r * .38, r * .38, 0.01, std('#3b2a1a', 1), 0, h * .22, 0)); g.add(cyl(0.02, 0.03, h * .5, std('#6b4a2a', .9), 0, h * .45, 0, 8));
      const leaf = std(it.color, .7); const seed = (it.id || '').length; for (let i = 0; i < 9; i++) { const a = i * 2.4 + seed, rr = r * (0.3 + (i % 3) * 0.25), y = h * (0.55 + (i % 4) * 0.11); const s = sph(r * (0.28 + (i % 2) * 0.1), leaf, Math.cos(a) * rr, y, Math.sin(a) * rr); s.scale.set(1.2, 0.7, 1); g.add(s); } return g; } },
});

// いま人気の観葉植物(10種類)を足す
Object.assign(CATALOG, PLANTS);
// 家具(ベッド・机・椅子・ソファなど)・水まわり(キッチン・トイレ・洗面台)・映画用は別のファイル
Object.assign(CATALOG, FURNITURE, WET, FILM, KOMONO, WAFU);
export const CATEGORIES = ['窓まわり', '照明', '敷物', '家具', '小物', '壁かざり', '和の家具', 'みどり', '映画用'];
export const EQUIP_CATEGORIES = ['電気', '空調・換気', '水まわり'];
export function catalogEntry(type) { return CATALOG[type] || null; }

let seq = 0;
export function newItem(type, over = {}) {
  const c = CATALOG[type]; if (!c) return null;
  const it = { id: 'i' + Date.now().toString(36) + (seq++).toString(36), type, roomId: null, x: 0, y: 0, z: 0, rot: 0, w: c.size[0], h: c.size[1], d: c.size[2], color: c.color, fabric: c.fabric || null, opts: { ...(c.opts || {}) } };
  // 形のあるものは、その形の大きさ・設定から始める(over で大きさを決めていれば、そちらが勝つ)
  if (c.styles) { applyStyle(it, over.style || c.styles[0].id); it.parts = {}; const st = c.styles.find(s => s.id === it.style); if (st && st.parts && c.parts && st.parts[c.parts[0].key]) it.color = st.parts[c.parts[0].key]; }
  return Object.assign(it, over);
}

// アイテム → 3D(位置・向きは呼び出し側で)
export function buildItem(it, assets) {
  const c = CATALOG[it.type]; if (!c) return null;
  it._assets = assets; const g = c.build(it); delete it._assets;
  g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); mergeGroup(g);
  g.name = 'item:' + it.id; g.userData.itemId = it.id; g.traverse(o => { if (o.isMesh) o.userData.itemId = it.id; });
  g.position.set(it.x, it.y, it.z); g.rotation.y = it.rot || 0;
  return g;
}
// 言葉 → 種類
export function typeByWord(text) {
  let best = null, bestLen = 0;
  for (const [type, c] of Object.entries(CATALOG)) for (const w of c.words) if (text.includes(w) && w.length > bestLen) { best = type; bestLen = w.length; }
  return best;
}
