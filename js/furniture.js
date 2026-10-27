// 家具(ベッド・机・椅子・ソファ・タンスなど)。形(styles)と部分ごとの色(parts)を選べる
// 作り方の決まりは kit.js の「形と部分ごとの色」を見る。向き:正面(足もと・座る側)が +z、背中が -z
import * as THREE from 'three';
import { box, cyl, sph, rbox, std, fabric, pm, styleOf, emissive, light, BLACK, METAL, WARM } from './kit.js';

// ---- ベッド ----
// 部分:掛けふとん(it.color と布の柄)/ わく / シーツ / まくら
function pillows(g, it, w, y, z, mat) {
  const n = w > 1.15 ? 2 : 1, pw = n === 2 ? w * 0.42 : Math.min(0.6, w * 0.62);
  for (let i = 0; i < n; i++) g.add(rbox(pw, 0.11, 0.38, 0.05, mat, n === 2 ? (i ? 1 : -1) * w * 0.23 : 0, y + 0.055, z));
}
// マットレス+掛けふとん+まくら。y0 = マットレスの下の高さ
function bedding(g, it, w, d, y0, th = 0.2, zOff = 0) {
  const sheet = pm(it, 'sheet', .95), pil = pm(it, 'pillow', .95), cov = fabric(it, 1, 1);
  g.add(rbox(w, th, d, 0.035, sheet, 0, y0 + th / 2, zOff));
  const cl = d * 0.68, cz = zOff + d / 2 - cl / 2 + 0.02;
  g.add(rbox(w + 0.05, 0.075, cl, 0.035, cov, 0, y0 + th + 0.03, cz));
  // 横に垂れる部分
  for (const sx of [-1, 1]) g.add(rbox(0.03, Math.min(0.2, th + 0.04), cl - 0.04, 0.012, cov, sx * (w / 2 + 0.02), y0 + th - Math.min(0.2, th + 0.04) / 2 + 0.05, cz));
  pillows(g, it, w, y0 + th, zOff - d / 2 + 0.26, pil);
}
function bedBuild(it) {
  const g = new THREE.Group(), w = it.w, d = it.d, h = it.h, s = styleOf(it).id, fr = pm(it, 'frame', .5), dark = std('#3a3632', .6);
  const head = (hh, t = 0.05) => g.add(box(w + 0.04, hh, t, fr, 0, hh / 2, -d / 2 + t / 2));
  if (s === 'futon') { bedding(g, it, w, d, 0, 0.08); return g; }
  if (s === 'lowbed') { g.add(box(w + 0.1, 0.12, d + 0.04, fr, 0, 0.06, 0.02)); head(Math.max(0.35, h)); bedding(g, it, w - 0.04, d - 0.08, 0.12, 0.2, 0.04); return g; }
  if (s === 'storage') {
    g.add(box(w, 0.32, d - 0.06, fr, 0, 0.16, 0.03)); head(h);
    const dr = std('#00000022', .5); for (let i = 0; i < 2; i++) { const z = -d / 2 + 0.35 + i * (d - 0.5) / 2 + (d - 0.5) / 4; g.add(box(0.005, 0.22, (d - 0.6) / 2, std('#00000033', .6), w / 2 + 0.001, 0.15, z)); g.add(box(0.012, 0.02, 0.18, pm(it, 'frame', .4), w / 2 + 0.008, 0.24, z)); } void dr;
    bedding(g, it, w - 0.04, d - 0.12, 0.32, 0.2, 0.04); return g;
  }
  if (s === 'bunk') {
    const post = 0.06; for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(post, h, post, fr, x * (w / 2 - post / 2), h / 2, z * (d / 2 - post / 2)));
    for (const y of [0.22, h * 0.62]) { for (const sx of [-1, 1]) g.add(box(0.03, 0.12, d - post * 2, fr, sx * (w / 2 - 0.03), y, 0)); for (const sz of [-1, 1]) g.add(box(w - post * 2, 0.12, 0.03, fr, 0, y, sz * (d / 2 - 0.03))); bedding(g, it, w - 0.1, d - 0.1, y + 0.03, 0.12); }
    // 上の段の柵(はしごの所はあける)
    const ty = h * 0.62 + 0.3; g.add(box(0.03, 0.04, d - post * 2, fr, -w / 2 + 0.03, ty, 0)); g.add(box(0.03, 0.04, d * 0.55, fr, w / 2 - 0.03, ty, -d * 0.2)); for (const sz of [-1, 1]) g.add(box(w - post * 2, 0.04, 0.03, fr, 0, ty, sz * (d / 2 - 0.03)));
    // はしご(足もと側の右)
    const lx = w / 2 + 0.02, lz = d / 2 - 0.35; for (const dz of [-0.17, 0.17]) g.add(box(0.03, h * 0.62 + 0.3, 0.03, fr, lx, (h * 0.62 + 0.3) / 2, lz + dz)); for (let k = 1; k <= 4; k++) g.add(box(0.03, 0.025, 0.34, fr, lx, k * (h * 0.62) / 4.6, lz));
    return g;
  }
  if (s === 'medical') {
    const metal = pm(it, 'frame', .35, .5), plastic = std('#e8eaec', .4);
    g.add(box(w - 0.1, 0.1, d - 0.2, metal, 0, 0.42, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.add(cyl(0.02, 0.02, 0.36, metal, x * (w / 2 - 0.1), 0.22, z * (d / 2 - 0.15), 10)); const cw = cyl(0.05, 0.05, 0.03, std(BLACK, .6), x * (w / 2 - 0.1), 0.05, z * (d / 2 - 0.15), 16); cw.rotation.z = Math.PI / 2; g.add(cw); }
    g.add(box(w, 0.75, 0.04, plastic, 0, 0.6, -d / 2 + 0.02)); g.add(box(w, 0.55, 0.04, plastic, 0, 0.5, d / 2 - 0.02));
    // 背もたれを起こしたマットレス
    const sheet = pm(it, 'sheet', .95), cov = fabric(it, 1, 1), back = d * 0.36, th = 0.12, y0 = 0.47;
    g.add(box(w - 0.12, th, d - back - 0.08, sheet, 0, y0 + th / 2, back / 2 + 0.0)); const bk = new THREE.Group(); bk.position.set(0, y0, -d / 2 + 0.04 + back); bk.rotation.x = 0.55; const bm = box(w - 0.12, th, back, sheet, 0, th / 2, -back / 2); bk.add(bm); const pl = rbox(0.55, 0.1, 0.35, 0.04, pm(it, 'pillow', .95), 0, th + 0.05, -back + 0.22); bk.add(pl); g.add(bk);
    g.add(rbox(w - 0.06, 0.06, d * 0.52, 0.03, cov, 0, y0 + th + 0.03, d / 2 - d * 0.26 - 0.06));
    for (const sx of [-1, 1]) { g.add(box(0.025, 0.25, d * 0.42, std('#d6d9dc', .3, .4), sx * (w / 2 - 0.02), y0 + 0.3, -d * 0.12)); }
    return g;
  }
  // 脚つきのふつうのベッド(シングル・セミダブル・ダブル・すのこ・子ども用)
  const legH = s === 'sunoko' ? 0.22 : s === 'kids' ? 0.15 : 0.12, railH = 0.16, y0 = legH + railH - 0.04;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, legH + railH, 0.06, fr, x * (w / 2 - 0.03), (legH + railH) / 2, z * (d / 2 - 0.03)));
  for (const sx of [-1, 1]) g.add(box(0.03, railH, d - 0.06, fr, sx * (w / 2 - 0.015), legH + railH / 2, 0)); g.add(box(w, railH, 0.03, fr, 0, legH + railH / 2, d / 2 - 0.015));
  if (s === 'sunoko') { for (let i = 0; i < 4; i++) g.add(box(w + 0.04, 0.07, 0.03, fr, 0, legH + railH + 0.1 + i * 0.1, -d / 2 + 0.015)); for (const sx of [-1, 1]) g.add(box(0.05, h, 0.05, fr, sx * (w / 2 - 0.005), h / 2, -d / 2 + 0.025)); }
  else head(h);
  if (s === 'double') g.add(box(w + 0.04, 0.42, 0.04, fr, 0, 0.21, d / 2 - 0.02));
  bedding(g, it, w - 0.06, d - 0.08, y0, s === 'kids' ? 0.15 : 0.2, 0.01);
  if (s === 'kids') { const ty = y0 + 0.32; for (const sx of [-1, 1]) { g.add(box(0.03, 0.03, d * 0.6, fr, sx * (w / 2 - 0.015), ty, -d * 0.15)); for (let k = 0; k < 5; k++) g.add(box(0.025, ty - y0, 0.025, fr, sx * (w / 2 - 0.015), (ty + y0) / 2, -d * 0.45 + k * d * 0.15)); } }
  return g;
}

export const FURNITURE = {
  bed: { name: 'ベッド', emoji: '🛏️', cat: '家具', kind: 'floor', size: [0.97, 0.9, 2.0], range: { w: [0.6, 2.0], h: [0.1, 2.0], d: [1.4, 2.3] }, color: '#e9e4d8', fabric: 'linen', opts: {}, words: ['ベッド', '寝床', 'べっど', 'ふとん', '布団'],
    parts: [{ key: 'cover', name: '掛けふとん', pal: 'fabric', def: '#e9e4d8' }, { key: 'frame', name: 'わく', pal: 'wood', def: 'w_natural' }, { key: 'sheet', name: 'シーツ', pal: 'color', def: '#f6f4ee' }, { key: 'pillow', name: 'まくら', pal: 'color', def: '#ffffff' }],
    styles: [
      { id: 'single', name: 'シングル', size: [0.97, 0.9, 2.0], words: ['シングル'] },
      { id: 'semidouble', name: 'セミダブル', size: [1.2, 0.9, 2.0], words: ['セミダブル'] },
      { id: 'double', name: 'ダブル', size: [1.4, 1.0, 2.05], words: ['ダブル'] },
      { id: 'lowbed', name: 'ローベッド', size: [1.2, 0.55, 2.1], words: ['ローベッド', 'フロアベッド'], parts: { frame: 'w_walnut' } },
      { id: 'sunoko', name: 'すのこベッド', size: [0.97, 0.75, 2.0], words: ['すのこ'], parts: { frame: 'w_white' } },
      { id: 'storage', name: '収納付き', size: [0.97, 0.85, 2.0], words: ['収納ベッド', '収納付き', '引き出し'], parts: { frame: 'f_white' } },
      { id: 'bunk', name: '二段ベッド', size: [1.0, 1.6, 2.05], words: ['二段ベッド', '2段ベッド', '二段'], parts: { cover: '#9ec9ea' } },
      { id: 'kids', name: '子ども用', size: [0.85, 0.65, 1.6], words: ['子ども用ベッド', '子供用ベッド', 'キッズベッド'], parts: { cover: '#e8a7b8', frame: 'w_white' } },
      { id: 'futon', name: 'ふとん(床に敷く)', size: [1.0, 0.15, 2.1], words: ['ふとん', '布団', '敷布団'], parts: { cover: '#c3b2dc' } },
      { id: 'medical', name: '病院・介護ベッド', size: [0.95, 0.8, 2.1], words: ['病院のベッド', '介護ベッド', '電動ベッド'], parts: { cover: '#dfe9ee', frame: 'f_lgray' } },
    ],
    build: bedBuild },
};
