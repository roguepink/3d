// 素材(床・壁紙・生地)を、画像ファイルなしで その場で描く。
import * as THREE from 'three';

// 色の名前 → 色コード
export const COLORS = {
  '白':'#f4f4f0','オフホワイト':'#f1ede4','アイボリー':'#f3ecd8','ベージュ':'#d9c7a6','グレー':'#9a9da4','ライトグレー':'#c8cbd0','チャコール':'#4a4d54','黒':'#2a2a2e',
  '茶':'#7a5235','こげ茶':'#4b3221','キャメル':'#b8865a','赤':'#b53a3a','ワイン':'#7a2a3a','ピンク':'#e8a7b8','オレンジ':'#e2873a','黄':'#e6c84a',
  '緑':'#4e8a5a','深緑':'#2f5e45','オリーブ':'#7f8c4a','ミント':'#a9d9c7','青':'#3f6fb5','水色':'#9ec9ea','紺':'#2a3a66','紫':'#7a5a9a','ラベンダー':'#c3b2dc','ターコイズ':'#3aa6a6','生成り':'#ebe3cf',
};
export const COLOR_ALIASES = { 'しろ':'白','ホワイト':'白','くろ':'黒','ブラック':'黒','あか':'赤','レッド':'赤','あお':'青','ブルー':'青','みどり':'緑','グリーン':'緑','きいろ':'黄','黄色':'黄','イエロー':'黄','ちゃいろ':'茶','茶色':'茶','ブラウン':'茶','灰色':'グレー','はいいろ':'グレー','ねずみ色':'グレー','むらさき':'紫','パープル':'紫','だいだい':'オレンジ','ももいろ':'ピンク','桃色':'ピンク','ネイビー':'紺','こん':'紺','みずいろ':'水色','ライトブルー':'水色','きなり':'生成り','ダークグレー':'チャコール','濃いグレー':'チャコール','薄いグレー':'ライトグレー','ダークブラウン':'こげ茶','焦げ茶':'こげ茶','ダークグリーン':'深緑','モスグリーン':'深緑','クリーム':'アイボリー','ゴールド':'黄' };

export function colorByName(name) {
  if (!name) return null;
  const k = COLOR_ALIASES[name] || name;
  return COLORS[k] || null;
}

// 乱数(同じ種なら同じ絵になる)
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function hex(c) { return typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0'); }
function shade(h, amt) { const c = new THREE.Color(h); c.offsetHSL(0, 0, amt); return '#' + c.getHexString(); }
function noise(g, w, h, r, alpha, dark = true) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * alpha * 255; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

const texCache = new Map();
function canvasTexture(key, size, draw, opts = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = size; c.height = opts.height || size;
  const g = c.getContext('2d');
  draw(g, c.width, c.height, rng(hashStr(key)));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t); t.userData.canvas = c;
  return t;
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// 木の床
function drawWood(g, w, h, r, { base = '#c9a06a', dark = '#8d6a3f', plankW = 0.12, tile = 1.8, gloss = false, grainAlpha = 0.25 }) {
  const ppm = w / tile; // 1mあたりのピクセル
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const pw = plankW * ppm, rows = Math.ceil(h / pw);
  for (let i = 0; i < rows; i++) {
    const y = i * pw; let x = -r() * w * 0.7;
    while (x < w) {
      const len = (0.6 + r() * 1.2) * ppm; const c = new THREE.Color(base); c.offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.08, (r() - 0.5) * 0.10);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x, y, len, pw);
      // 木目
      g.strokeStyle = dark; g.lineWidth = 1;
      for (let k = 0; k < 10; k++) { g.globalAlpha = grainAlpha * r(); g.beginPath(); const yy = y + r() * pw; g.moveTo(x, yy); for (let s = 0; s <= 6; s++) g.lineTo(x + len * s / 6, yy + Math.sin(s + r() * 3) * pw * 0.08); g.stroke(); }
      g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.strokeRect(x + .5, y + .5, len, pw);
      x += len;
    }
  }
  noise(g, w, h, r, 0.08);
}
// タイル
function drawTile(g, w, h, r, { base = '#e9e7e2', grout = '#b9b5ae', size = 0.6, tile = 1.2, mottle = 0.06 }) {
  const ppm = w / tile, n = Math.max(1, Math.round(tile / size)), s = w / n;
  g.fillStyle = grout; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const c = new THREE.Color(base); c.offsetHSL(0, 0, (r() - 0.5) * mottle);
    g.fillStyle = '#' + c.getHexString(); const gw = Math.max(2, s * 0.012);
    g.fillRect(i * s + gw, j * s + gw, s - gw * 2, s - gw * 2);
    // うっすら模様
    g.globalAlpha = 0.08; for (let k = 0; k < 14; k++) { g.fillStyle = r() > .5 ? '#fff' : '#000'; g.beginPath(); g.ellipse(i * s + r() * s, j * s + r() * s, s * (0.05 + r() * .2), s * (0.02 + r() * .08), r() * 6, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
  noise(g, w, h, r, 0.05);
}
// じゅうたん・布
function drawCarpet(g, w, h, r, { base = '#c8b89a', alpha = 0.35 }) {
  g.fillStyle = base; g.fillRect(0, 0, w, h); noise(g, w, h, r, alpha);
  g.globalAlpha = .12; for (let i = 0; i < 4000; i++) { g.fillStyle = r() > .5 ? '#fff' : '#000'; g.fillRect(r() * w, r() * h, 2, 1); } g.globalAlpha = 1;
}
// 織り(カーテン生地)
function drawWeave(g, w, h, r, { base = '#ffffff', contrast = 0.12, pitch = 4 }) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += pitch) for (let x = 0; x < w; x += pitch) {
    const on = ((x / pitch + y / pitch) % 2) === 0; g.fillStyle = on ? `rgba(0,0,0,${contrast})` : `rgba(255,255,255,${contrast})`; g.fillRect(x, y, pitch, pitch);
  }
  noise(g, w, h, r, 0.06);
}
function drawStripe(g, w, h, r, { base = '#f2f2f2', line = '#9fb4d8', ratio = 0.5, count = 8 }) {
  drawWeave(g, w, h, r, { base, contrast: .06 });
  const sw = w / count; g.fillStyle = line; g.globalAlpha = .85; for (let i = 0; i < count; i++) g.fillRect(i * sw, 0, sw * ratio, h); g.globalAlpha = 1;
}
function drawCheck(g, w, h, r, { base = '#f5f0e6', line = '#b8503a', count = 6 }) {
  drawWeave(g, w, h, r, { base, contrast: .06 });
  const sw = w / count; g.fillStyle = line; g.globalAlpha = .45; for (let i = 0; i < count; i++) { g.fillRect(i * sw, 0, sw * .5, h); g.fillRect(0, i * sw, w, sw * .5); } g.globalAlpha = 1;
}
function drawFloral(g, w, h, r, { base = '#f6f1e8', line = '#7a9a6a', dot = '#d88aa0' }) {
  drawWeave(g, w, h, r, { base, contrast: .05 });
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = r() * h, s = w * (0.03 + r() * 0.03);
    g.strokeStyle = line; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + s * 2); g.quadraticCurveTo(x + s, y + s, x, y); g.stroke();
    g.fillStyle = dot; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * s * .5, y + Math.sin(a) * s * .5, s * .35, s * .22, a, 0, 7); g.fill(); }
    g.fillStyle = '#f1d060'; g.beginPath(); g.arc(x, y, s * .18, 0, 7); g.fill();
  }
}
function drawLace(g, w, h, r) {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;
  const s = w / 8; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(i * s + s / 2, j * s + s / 2, s * .42, 0, 7); g.stroke(); g.beginPath(); g.arc(i * s + s / 2, j * s + s / 2, s * .2, 0, 7); g.stroke(); }
}
// 六角タイル柄
function drawHex(g, w, h, r, { base, line }) { g.fillStyle = base; g.fillRect(0, 0, w, h); noise(g, w, h, r, .02); g.strokeStyle = line; g.lineWidth = Math.max(1, w / 400); const R = w / 12, dx = R * 1.5, dy = R * Math.sqrt(3); for (let i = -1; i < 10; i++) for (let j = -1; j < 8; j++) { const cx = i * dx, cy = j * dy + (i % 2 ? dy / 2 : 0); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); } }
// テラゾー(小石を混ぜた柄)
function drawTerrazzo(g, w, h, r, { base }) { g.fillStyle = base; g.fillRect(0, 0, w, h); const cs = ['#b7aea2', '#8d8a86', '#d9cfc2', '#6f6c69', '#c9b9a5']; for (let i = 0; i < 900; i++) { g.fillStyle = cs[i % cs.length]; g.beginPath(); const x = r() * w, y = r() * h, s = (0.003 + r() * 0.01) * w; g.ellipse(x, y, s, s * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill(); } }
// 浴室のパネル:つるっとした面に、900mm ごとの細いつなぎ目(grid=true なら横にも)
function drawBathPanel(g, w, h, r, { base, seam, grid = false, tile = 1.8, step = 0.9 }) { g.fillStyle = base; g.fillRect(0, 0, w, h); noise(g, w, h, r, 0.015); const n = Math.round(tile / step), s = w / n; g.fillStyle = seam; for (let i = 0; i < n; i++) g.fillRect(i * s, 0, Math.max(1, w / 512), h); if (grid) for (let j = 0; j < n; j++) g.fillRect(0, j * s, w, Math.max(1, w / 512)); }
// 浴室の床:すべり止めの小さな点
function drawDots(g, w, h, r, { base, dot }) { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = dot; const n = 36, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.beginPath(); g.arc((i + .5 + (j % 2) * .5) * s, (j + .5) * s, s * .22, 0, Math.PI * 2); g.fill(); } g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h / 2 - 1, w, 2); g.fillRect(w / 2 - 1, 0, 2, h); }
function drawPlain(g, w, h, r, { base = '#f4f4f0', alpha = 0.05 }) { g.fillStyle = base; g.fillRect(0, 0, w, h); noise(g, w, h, r, alpha); }
function drawBrick(g, w, h, r, { base = '#b5604a', mortar = '#d9d2c6', tile = 1.2 }) {
  g.fillStyle = mortar; g.fillRect(0, 0, w, h); const bw = w / tile * 0.21, bh = w / tile * 0.065, rows = Math.ceil(h / bh);
  for (let j = 0; j < rows; j++) { const off = (j % 2) * bw / 2; for (let x = -bw; x < w + bw; x += bw) { const c = new THREE.Color(base); c.offsetHSL(0, (r() - .5) * .1, (r() - .5) * .14); g.fillStyle = '#' + c.getHexString(); g.fillRect(x + off + 2, j * bh + 2, bw - 4, bh - 4); } }
  noise(g, w, h, r, 0.1);
}
function drawPanel(g, w, h, r, { base = '#d8b98a', tile = 1.2 }) {
  drawWood(g, w, h, r, { base, dark: shade(base, -0.25), plankW: 0.1, tile }); // 縦板にするため回して使う
}
function drawTatami(g, w, h, r) {
  g.fillStyle = '#b6b476'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(70,80,30,.35)'; g.lineWidth = 1; for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  // 2枚の畳(縁)
  g.fillStyle = '#2b2e3a'; g.fillRect(0, 0, w, 6); g.fillRect(0, h / 2 - 3, w, 6); g.fillRect(0, h - 6, w, 6); g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
  noise(g, w, h, r, 0.06);
}
function drawConcrete(g, w, h, r) { g.fillStyle = '#9d9d9b'; g.fillRect(0, 0, w, h); noise(g, w, h, r, 0.18); g.globalAlpha = .1; for (let i = 0; i < 40; i++) { g.fillStyle = r() > .5 ? '#fff' : '#000'; g.beginPath(); g.ellipse(r() * w, r() * h, w * r() * .15, w * r() * .08, r() * 6, 0, 7); g.fill(); } g.globalAlpha = 1; }
function drawMarble(g, w, h, r, { base = '#f1f0ec', vein = '#8e8f96' }) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.strokeStyle = vein; for (let i = 0; i < 14; i++) { g.globalAlpha = .18 + r() * .3; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 12; k++) { x += (r() - .5) * w * .3; y += (r() - .5) * h * .3; g.lineTo(x, y); } g.stroke(); }
  g.globalAlpha = 1; noise(g, w, h, r, 0.04);
}

// 素材カタログ
// size: 1枚の絵が実際の何メートル分か / rough: ざらつき(0つるつる〜1マット)
export const SURFACE_LIB = {
  floor: [
    { id: 'oak', bump: 0.006, name: 'フローリング(ナチュラル)', size: 1.8, rough: .55, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#c9a06a', dark: '#8d6a3f' }) },
    { id: 'walnut', bump: 0.006, name: 'フローリング(ウォールナット)', size: 1.8, rough: .5, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#6b4a33', dark: '#3b2616' }) },
    { id: 'whiteash', bump: 0.005, name: 'フローリング(白木)', size: 1.8, rough: .6, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#e4d6bd', dark: '#b9a78a', grainAlpha: .15 }) },
    { id: 'herring', bump: 0.006, name: 'ヘリンボーン', size: 1.2, rough: .5, draw: (g, w, h, r) => { drawWood(g, w, h, r, { base: '#b98a58', dark: '#7a5533', plankW: 0.08, tile: 1.2 }); g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4); g.globalAlpha = .5; g.drawImage(g.canvas, -w / 2, -h / 2); g.restore(); } },
    { id: 'cf_wood', bump: 0.003, name: 'クッションフロア(木目)', size: 1.8, rough: .35, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#d7b58a', dark: '#a88358', grainAlpha: .14 }) },
    { id: 'cf_stone', bump: 0.004, name: 'クッションフロア(石目)', size: 1.2, rough: .3, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#ddd8d0', grout: '#c5bfb6', size: .6, mottle: .08 }) },
    { id: 'tile_w', bump: 0.008, name: 'タイル(白 60cm)', size: 1.2, rough: .18, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#efede8', grout: '#c9c5bf', size: .6 }) },
    { id: 'tile_g', bump: 0.008, name: 'タイル(グレー 30cm)', size: 1.2, rough: .3, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#8f949a', grout: '#5d6166', size: .3 }) },
    { id: 'tile_t', bump: 0.01, name: 'テラコッタ', size: 1.2, rough: .7, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#c47a52', grout: '#9a6a52', size: .3, mottle: .12 }) },
    { id: 'marble', bump: 0.002, name: '大理石', size: 1.2, rough: .12, draw: (g, w, h, r) => drawMarble(g, w, h, r, {}) },
    { id: 'tatami', bump: 0.004, name: '畳', size: 1.8, rough: .8, draw: drawTatami },
    { id: 'carpet_b', bump: 0.006, name: 'カーペット(ベージュ)', size: 1, rough: .95, draw: (g, w, h, r) => drawCarpet(g, w, h, r, { base: '#c8b89a' }) },
    { id: 'carpet_g', bump: 0.006, name: 'カーペット(グレー)', size: 1, rough: .95, draw: (g, w, h, r) => drawCarpet(g, w, h, r, { base: '#8f9196' }) },
    { id: 'concrete', bump: 0.006, name: 'モルタル', size: 1.5, rough: .7, draw: drawConcrete },
    { id: 'grayoak', bump: 0.006, name: 'フローリング(グレー)', size: 1.8, rough: .55, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#a9a39a', dark: '#6f6a62', grainAlpha: .18 }) },
    { id: 'tile_k', bump: 0.008, name: 'タイル(黒 60cm)', size: 1.2, rough: .2, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#3a3c40', grout: '#5a5c60', size: .6, mottle: .05 }) },
    { id: 'carpet_w', bump: 0.006, name: 'カーペット(アイボリー)', size: 1, rough: .95, draw: (g, w, h, r) => drawCarpet(g, w, h, r, { base: '#e9e2d2' }) },
    { id: 'cf_tile', bump: 0.003, name: 'クッションフロア(タイル柄)', size: 1.2, rough: .3, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#e6e2da', grout: '#cfc9bf', size: .3, mottle: .04 }) },
    // 押入れの床:ベニヤ板(中段・枕棚と同じ色。板は910mm幅)
    { id: 'plywood', bump: 0.002, name: 'ベニヤ板(押入れ)', size: 1.82, rough: .7, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#d9c39d', dark: '#c4aa80', plankW: 0.91, tile: 1.82, grainAlpha: .1 }) },
    // 洗面所・トイレ向け:クッションフロア・塩ビタイル
    { id: 'cf_white', bump: 0.002, name: 'クッションフロア(白)', size: 1.2, rough: .35, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#f1f0ec', alpha: .03 }) },
    { id: 'cf_marble', bump: 0.002, name: 'クッションフロア(大理石柄)', size: 1.2, rough: .25, draw: (g, w, h, r) => { drawMarble(g, w, h, r, { base: '#f0eeea', vein: '#a8a9ad' }); g.fillStyle = 'rgba(0,0,0,.08)'; for (const k of [0, .5]) { g.fillRect(k * w, 0, 1.5, h); g.fillRect(0, k * h, w, 1.5); } } },
    { id: 'cf_hex', bump: 0.003, name: 'クッションフロア(六角タイル柄)', size: 0.9, rough: .35, draw: (g, w, h, r) => drawHex(g, w, h, r, { base: '#f2f1ed', line: '#c9c6bf' }) },
    { id: 'cf_tile_g', bump: 0.003, name: 'クッションフロア(タイル柄グレー)', size: 1.2, rough: .3, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#b9b7b2', grout: '#a3a19c', size: .3, mottle: .04 }) },
    { id: 'pvc_stone', bump: 0.004, name: '塩ビタイル(石目グレー)', size: 1.2, rough: .4, draw: (g, w, h, r) => drawTile(g, w, h, r, { base: '#a7a6a2', grout: '#8f8e8a', size: .45, mottle: .1 }) },
    { id: 'pvc_terrazzo', bump: 0.003, name: '塩ビタイル(テラゾー)', size: 1.0, rough: .35, draw: (g, w, h, r) => drawTerrazzo(g, w, h, r, { base: '#ebe7e0' }) },
    { id: 'ub_floor_g', bump: 0.006, name: '浴室の床(グレー)', size: 0.9, rough: .6, draw: (g, w, h, r) => drawDots(g, w, h, r, { base: '#9a9da1', dot: '#8a8d91' }) },
    { id: 'ub_floor_b', bump: 0.006, name: '浴室の床(ベージュ)', size: 0.9, rough: .6, draw: (g, w, h, r) => drawDots(g, w, h, r, { base: '#cdbfa8', dot: '#bcae97' }) },
    { id: 'ub_floor_w', bump: 0.006, name: '浴室の床(白)', size: 0.9, rough: .6, draw: (g, w, h, r) => drawDots(g, w, h, r, { base: '#e6e6e3', dot: '#d3d3cf' }) },
  ],
  wall: [
    { id: 'wp_white', name: '壁紙(白)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#f4f3ee', alpha: .06 }) },
    { id: 'wp_warm', name: '壁紙(オフホワイト)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#efe8da', alpha: .06 }) },
    { id: 'wp_gray', name: '壁紙(ライトグレー)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#d4d6d8', alpha: .06 }) },
    { id: 'wp_tex', bump: 0.004, name: '壁紙(織物調)', size: .6, rough: .95, draw: (g, w, h, r) => drawWeave(g, w, h, r, { base: '#ece8df', contrast: .07, pitch: 3 }) },
    { id: 'wp_stripe', name: '壁紙(ストライプ)', size: .6, rough: .9, draw: (g, w, h, r) => drawStripe(g, w, h, r, { base: '#f1efe8', line: '#dcd6c6', ratio: .5, count: 6 }) },
    { id: 'wp_blue', name: '壁紙(ブルーグレー)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#9fb2bd', alpha: .05 }) },
    { id: 'wp_green', name: '壁紙(グリーン)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#8fa88c', alpha: .05 }) },
    { id: 'wp_navy', name: '壁紙(ネイビー)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#35466a', alpha: .05 }) },
    { id: 'wp_floral', name: '壁紙(花柄)', size: .8, rough: .9, draw: (g, w, h, r) => drawFloral(g, w, h, r, { base: '#f6f1e8' }) },
    { id: 'panel', bump: 0.006, name: '木のパネル', size: 1.2, rough: .5, rotate: true, draw: (g, w, h, r) => drawPanel(g, w, h, r, {}) },
    { id: 'brick', bump: 0.012, name: 'レンガ', size: 1.2, rough: .9, draw: (g, w, h, r) => drawBrick(g, w, h, r, {}) },
    { id: 'brick_w', bump: 0.012, name: '白レンガ', size: 1.2, rough: .9, draw: (g, w, h, r) => drawBrick(g, w, h, r, { base: '#e8e4dc', mortar: '#cfcac0' }) },
    { id: 'concrete_w', bump: 0.006, name: 'コンクリート', size: 1.5, rough: .7, draw: drawConcrete },
    { id: 'plaster', bump: 0.004, name: '漆喰', size: 1, rough: .95, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#f6f4ee', alpha: .1 }) },
    { id: 'wp_beige', name: '壁紙(ベージュ)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#e3d6bf', alpha: .05 }) },
    { id: 'wp_greige', name: '壁紙(グレージュ)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#c9c0b4', alpha: .05 }) },
    { id: 'wp_pink', name: '壁紙(くすみピンク)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#dcbfc0', alpha: .05 }) },
    { id: 'wp_dark', name: '壁紙(ダークグレー)', size: 1, rough: .9, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#5a5e66', alpha: .05 }) },
    { id: 'wp_wood', bump: 0.004, name: '壁紙(木目調)', size: 1.2, rough: .7, rotate: true, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#d9c4a3', dark: '#b39a78', plankW: 0.15, tile: 1.2, grainAlpha: .12 }) },
    // 浴室のパネル(ユニットバスの壁・天井)。つなぎ目は 約900mm ごと
    { id: 'ub_white', name: '浴室パネル(白)', size: 1.8, rough: .3, draw: (g, w, h, r) => drawBathPanel(g, w, h, r, { base: '#f3f3f0', seam: '#d4d4d0' }) },
    { id: 'ub_beige', name: '浴室パネル(ベージュ)', size: 1.8, rough: .3, draw: (g, w, h, r) => drawBathPanel(g, w, h, r, { base: '#ebe1cf', seam: '#cfc3ae' }) },
    { id: 'ub_stone', bump: 0.002, name: '浴室パネル(石目グレー)', size: 1.8, rough: .25, draw: (g, w, h, r) => { drawMarble(g, w, h, r, { base: '#b9bbbd', vein: '#6f7276' }); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(w / 2 - 1, 0, 2, h); } },
    { id: 'ub_wood', bump: 0.003, name: '浴室パネル(木目)', size: 1.8, rough: .35, draw: (g, w, h, r) => drawWood(g, w, h, r, { base: '#a57a52', dark: '#6e4c2f', plankW: 0.9, grainAlpha: .2 }) },
    { id: 'ub_navy', name: '浴室パネル(ネイビー)', size: 1.8, rough: .3, draw: (g, w, h, r) => drawBathPanel(g, w, h, r, { base: '#2f3d58', seam: '#222d44' }) },
    { id: 'ub_black', name: '浴室パネル(黒)', size: 1.8, rough: .25, draw: (g, w, h, r) => drawBathPanel(g, w, h, r, { base: '#2b2b2d', seam: '#1a1a1c' }) },
    { id: 'ub_ceil', name: '浴室の天井(白)', size: 1.8, rough: .4, draw: (g, w, h, r) => drawBathPanel(g, w, h, r, { base: '#f7f7f5', seam: '#dededa', grid: true, step: 0.45 }) },
  ],
  fabric: [
    { id: 'plain', name: '無地', size: .25, rough: .85, tint: true, draw: (g, w, h, r) => drawWeave(g, w, h, r, { base: '#ffffff', contrast: .1 }) },
    { id: 'linen', name: 'リネン風', size: .3, rough: .95, tint: true, draw: (g, w, h, r) => { drawWeave(g, w, h, r, { base: '#ffffff', contrast: .16, pitch: 3 }); noise(g, w, h, r, .12); } },
    { id: 'velvet', name: 'ベルベット', size: .3, rough: .6, tint: true, draw: (g, w, h, r) => drawPlain(g, w, h, r, { base: '#ffffff', alpha: .08 }) },
    { id: 'stripe', name: 'ストライプ', size: .5, rough: .85, tint: false, draw: (g, w, h, r) => drawStripe(g, w, h, r, {}) },
    { id: 'check', name: 'チェック', size: .4, rough: .85, tint: false, draw: (g, w, h, r) => drawCheck(g, w, h, r, {}) },
    { id: 'floral', name: '花柄', size: .6, rough: .85, tint: false, draw: (g, w, h, r) => drawFloral(g, w, h, r, {}) },
    { id: 'lace', name: 'レース', size: .2, rough: .9, tint: false, lace: true, draw: drawLace },
  ],
};
export function libEntry(kind, id) { return (SURFACE_LIB[kind] || []).find(e => e.id === id) || null; }

// ユーザーが貼った写真(見本帳など)
export const userTextures = new Map(); // id -> {name, dataUrl, size}
export function textureFromDataUrl(id, dataUrl) {
  const key = 'user:' + id; if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const img = new Image(); img.onload = () => { t.image = img; t.needsUpdate = true; }; img.src = dataUrl;
  texCache.set(key, t); return t;
}
export function dropTexture(id) { texCache.delete('user:' + id); }

export function libTexture(kind, id) {
  const e = libEntry(kind, id); if (!e) return null;
  return canvasTexture(`${kind}:${id}`, kind === 'fabric' ? 256 : 512, e.draw);
}
// さわったときの見本の小さい絵
export function swatchCanvas(kind, id, color) {
  const t = libTexture(kind, id); const c = document.createElement('canvas'); c.width = 96; c.height = 58; const g = c.getContext('2d');
  if (t) g.drawImage(t.userData.canvas, 0, 0, c.width, c.height);
  const e = libEntry(kind, id); if (e && e.tint && color) { g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); }
  return c;
}

// 面の仕様 → マテリアル
// spec: { lib:'oak' } | { color:'#fff' } | { lib:'plain', color:'#..' } | { user:'id', size:0.5 } | { photo:'assetId' }
const matCache = new Map();
export function surfaceMaterial(kind, spec, dims = {}, assets = {}) {
  spec = spec || {};
  const key = JSON.stringify([kind, spec, dims.w, dims.h]);
  if (matCache.has(key)) return matCache.get(key);
  let mat;
  if (spec.photo && assets[spec.photo]) {
    const t = textureFromDataUrl(spec.photo, assets[spec.photo].dataUrl); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1);
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: .85, metalness: 0, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .35 });
  } else if (spec.user && assets[spec.user]) {
    const t = textureFromDataUrl(spec.user, assets[spec.user].dataUrl); const s = spec.size || assets[spec.user].size || .5;
    t.repeat.set((dims.w || 1) / s, (dims.h || 1) / s);
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: .8, metalness: 0 });
  } else {
    const e = libEntry(kind, spec.lib) || (kind === 'fabric' ? libEntry('fabric', 'plain') : null);
    if (e) {
      const t = libTexture(kind, e.id).clone(); t.needsUpdate = true;
      const s = e.size; t.repeat.set((dims.w || 1) / s, (dims.h || 1) / s); if (e.rotate) t.rotation = Math.PI / 2;
      const color = (e.tint || kind === 'fabric') && spec.color ? spec.color : (spec.color && kind !== 'fabric' ? spec.color : '#ffffff');
      mat = new THREE.MeshStandardMaterial({ map: t, color: e.tint ? (spec.color || '#ffffff') : color, roughness: e.rough, metalness: 0 });
      if (e.bump) { mat.bumpMap = t; mat.bumpScale = e.bump; }
      if (e.lace) { mat.transparent = true; mat.opacity = .55; mat.alphaMap = t; mat.side = THREE.DoubleSide; }
    } else {
      mat = new THREE.MeshStandardMaterial({ color: spec.color || '#f4f4f0', roughness: .9, metalness: 0 });
    }
  }
  if (kind === 'fabric') mat.side = THREE.DoubleSide;
  matCache.set(key, mat); return mat;
}
export function clearMaterialCache() { matCache.clear(); }

// ---------- 仕上げ材(廻り縁・巾木・窓枠・ドア枠) ----------
export const TRIM_FINISHES = [
  { id: 'white', name: '白', color: '#f4f4f2' }, { id: 'offwhite', name: 'オフホワイト', color: '#ece7dc' }, { id: 'lightgray', name: 'ライトグレー', color: '#c9ccd1' }, { id: 'gray', name: 'グレー', color: '#8e9298' }, { id: 'dark', name: 'ダークグレー', color: '#4a4d54' }, { id: 'black', name: '黒', color: '#2a2a2e' },
  { id: 'wood_light', name: '木目(ライト)', wood: { base: '#e3cfae', dark: '#bda080' } }, { id: 'wood_natural', name: '木目(ナチュラル)', wood: { base: '#caa36f', dark: '#8f6b43' } }, { id: 'wood_medium', name: '木目(ミディアム)', wood: { base: '#a97a4e', dark: '#6e4a2c' } }, { id: 'wood_walnut', name: '木目(ウォールナット)', wood: { base: '#6b4a33', dark: '#3b2616' } }, { id: 'wood_white', name: '木目(ホワイトウッド)', wood: { base: '#ece4d6', dark: '#cfc4b2' } },
];
export function trimFinish(id) { return TRIM_FINISHES.find(f => f.id === id) || TRIM_FINISHES[0]; }
const trimCache = new Map();
// 細い部材用の材質(木目は細かく繰り返す)
export function trimMaterial(id) {
  const f = trimFinish(id); if (trimCache.has(f.id)) return trimCache.get(f.id);
  let m;
  if (f.wood) { const t = canvasTexture('trim:' + f.id, 256, (g, w, h, r) => drawWood(g, w, h, r, { base: f.wood.base, dark: f.wood.dark, plankW: 0.6, tile: 0.6, grainAlpha: .22 })); t.repeat.set(1, 1); m = new THREE.MeshStandardMaterial({ map: t, roughness: .5, metalness: 0 }); }
  else m = new THREE.MeshStandardMaterial({ color: f.color, roughness: .55, metalness: 0 });
  trimCache.set(f.id, m); return m;
}
