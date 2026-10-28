// 見本の家:木造2階建ての 4LDK(3LDK+和室)。総2階・延床 約36坪(119.2㎡)。尺モジュール(910mm)で、1階・2階とも 8,190×7,280(芯々 9×8マス)
// 1階:LDK(約18帖・南)・和室(4.5帖・南西、押入れ1間)・玄関(土間を1段下げる)+シューズインクローゼット・ホール・物入れ・トイレ・洗面脱衣室・浴室(1坪)・階段(折り返し・回り段)
// 2階:主寝室(8帖・南西、WIC 1.5坪)・子供部屋1(6帖・南東)・子供部屋2(6帖・北東)・トイレ(1階のトイレの真上)・ホール・収納3か所
// 子供部屋1と子供部屋2の間は、奥行き1マスの収納の帯を2つに分け、北半分は子供部屋2から、南半分(東)は子供部屋1から使う(交互の背中合わせ)
// 階高 2,900、天井高 2,400、浴室の天井 2,200。玄関とシューズインクローゼットは 150 下げた土間(天井は 1階の床から 2,400 のまま)
import { newItem } from './items.js';

const G = 0.91, T = 0.06; // 尺のマス、壁の半分の厚み(壁の中心から内側の面まで)
const W0 = { lib: 'wp_white' };
// 壁の中心線の座標(マス数)から、内側の寸法の部屋を作る
function room(id, name, level, x0, z0, x1, z1, o = {}) {
  const x = x0 * G + T, z = z0 * G + T, w = (x1 - x0) * G - T * 2, d = (z1 - z0) * G - T * 2;
  const poly = o.poly || [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]; const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
  const { poly: _p, ...rest } = o; return { id, name, level, x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), h: 2.4, poly, floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: { 0: W0, 1: W0, 2: W0, 3: W0 }, openings: [], parts: [], ...rest };
}
// 辺の番号:0=北(奥) 1=東(右) 2=南(手前) 3=西(左)。s は開口の端の位置(家の座標の小さいほう)、w は幅
const SIDE = { N: 0, E: 1, S: 2, W: 3 };
// 辺を探す(L字の部屋のように同じ向きの辺が2本あるときは、near(となりの部屋の側)に近い辺)
function edgeOf(r, side, s, w, near) {
  const P = r.poly, n = P.length; let best = null;
  for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], dx = bx - ax, dz = bz - az; const ns = side === 'N' || side === 'S';
    const ok = side === 'N' ? dx > 0 && Math.abs(dz) < 1e-6 : side === 'E' ? dz > 0 && Math.abs(dx) < 1e-6 : side === 'S' ? dx < 0 && Math.abs(dz) < 1e-6 : dz < 0 && Math.abs(dx) < 1e-6; if (!ok) continue;
    const lo = ns ? Math.min(ax, bx) : Math.min(az, bz), hi = ns ? Math.max(ax, bx) : Math.max(az, bz); if (s < lo - 1e-6 || s + w > hi + 1e-6) continue;
    const line = ns ? az : ax; const score = near === undefined ? ({ N: line, S: -line, W: line, E: -line })[side] : Math.abs(line - near);
    if (!best || score < best.score) best = { e: i, score, u: side === 'N' ? s - ax : side === 'E' ? s - az : side === 'S' ? ax - (s + w) : az - (s + w) }; }
  if (!best) throw new Error(`${r.name} の ${side} に開口が入りません(${s})`); return best;
}
const nearOf = (b, side) => ({ N: b.z + b.d + 0.12, S: b.z - 0.12, E: b.x - 0.12, W: b.x + b.w + 0.12 })[side];
let seq = 0;
function opening(r, side, s, w, props, near) { const f = edgeOf(r, side, s, w, near); const o = { id: 'd' + (++seq), edge: f.e, u: f.u, w, h: 2.0, type: 'door', ...props }; r.openings.push(o); return o; }
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
// 2つの部屋をつなぐ開口(a が持ち主、b は同じ穴)
function link(a, side, b, s, w, props = {}) { const o = opening(a, side, s, w, props, nearOf(b, side)); const fb = edgeOf(b, OPP[side], s, w, nearOf(a, OPP[side])); const t = { id: 'd' + (++seq), edge: fb.e, u: fb.u, w, h: o.h, type: o.type, twin: o.id }; if (props.twinSill !== undefined) t.sill = props.twinSill; delete o.twinSill; b.openings.push(t); return o; }
function win(r, side, s, w, h, sill, props = {}) { return opening(r, side, s, w, { type: 'window', h, sill, ...props }); }
// 壁のニッチ(奥行き約100mm)
function niche(r, side, s, w, h, sill) { return opening(r, side, s, w, { type: 'niche', h, sill, depth: 0.1 }); }

export function demoProject() {
  seq = 0; const FH = 2.9;
  // ---------- 1階(x 0〜9マス、z 0〜8マス) ----------
  //    x: 0  1  2  3  4  5  6  7  8
  // z0  玄 玄 ト ト 物 洗 洗 浴 浴
  // z1  玄 玄 ホ ホ ホ 洗 洗 浴 浴
  // z2  S  階 階 L  L  L  L  L  L
  // z3  S  階 階 L  L  L  L  L  L
  // z4  S  押 押 L  L  L  L  L  L
  // z5  和 和 和 L  L  L  L  L  L
  // z6  和 和 和 L  L  L  L  L  L
  // z7  和 和 和 L  L  L  L  L  L      (S=シューズインクローゼット)
  const genkan = room('genkan', '玄関', 0, 0, 0, 2, 2, { drop: 0.15, h: 2.55, floor: { lib: 'tile_g' } });
  const wc1 = room('wc1', 'トイレ', 0, 3, 0, 5, 1, { floor: { lib: 'cf_marble' }, walls: { 0: W0, 1: { lib: 'wp_tex' }, 2: W0, 3: W0 } });
  const wash = room('wash', '洗面脱衣室', 0, 5, 0, 7, 2, { floor: { lib: 'cf_tile' } });
  const bath = room('bath', '浴室', 0, 7, 0, 9, 2, { h: 2.2, floor: { lib: 'ub_floor_g' }, ceiling: { lib: 'ub_ceil' }, walls: { 0: { lib: 'ub_white' }, 1: { lib: 'ub_wood' }, 2: { lib: 'ub_white' }, 3: { lib: 'ub_white' } }, trim: { crown: { on: false }, base: { on: false }, casing: { on: false }, door: { finish: 'white' } } });
  // ホールはL字:玄関の東(框の幅1,700)から、トイレの南を通って洗面所・LDK・階段へ
  const hall1 = room('hall1', 'ホール', 0, 2, 0, 5, 2, { poly: [[2 * G + T, T], [3 * G - T, T], [3 * G - T, G + T], [5 * G - T, G + T], [5 * G - T, 2 * G - T], [2 * G + T, 2 * G - T]] });
  const sic = room('sic', 'シューズクローク', 0, 0, 2, 1, 4, { closet: 'sic', drop: 0.15, h: 2.55, floor: { lib: 'tile_g' } });
  const stair = room('stair', '階段', 0, 1, 2, 3, 4, { floor: { lib: 'oak' }, stair: { kind: 'u_winder', style: 'box', dir: 'N', flip: false, finish: 'wood_natural' } });
  const osh = room('osh', '押入れ', 0, 0, 4, 3, 5, { closet: 'oshiire', floor: { lib: 'plywood' } }); // 1間半
  const wa = room('wa', '和室', 0, 0, 5, 3, 8, { floor: { lib: 'tatami' }, walls: { 0: { lib: 'wp_warm' }, 1: { lib: 'wp_warm' }, 2: { lib: 'wp_warm' }, 3: { lib: 'wp_warm' } } });
  const ldk = room('ldk', 'LDK', 0, 3, 2, 9, 8, { walls: { 0: W0, 1: { lib: 'wp_greige' }, 2: W0, 3: W0 } });
  // 梁:2階の子供部屋1とWICの間の壁を受ける大きな梁(LDKの真ん中、南北に通す)。最初はクロス巻き込み・天井と同じ。木を見せる化粧梁にもできる
  // 梁の幅150(木の実寸)。クロス巻き込みは下地13+石膏ボード12を両側に足して見付200、天井から100下がる(梁の大部分は天井の中)
  ldk.parts.push({ id: 'beam1', type: 'beam', x: 6 * G - 0.1, z: ldk.z, w: 0.2, d: ldk.d, core: 0.15, drop: 0.1, finish: 'cross' }); // テレビの後ろ(東)をアクセントクロス
  // ---------- 2階 ----------
  //    x: 0  1  2  3  4  5  6  7  8
  // z0  収A 収A ト ト ホ 子2 子2 子2 子2
  // z1  収B ホ ホ ホ ホ 子2 子2 子2 子2
  // z2  収B 階 階 収C ホ 子2 子2 子2 子2
  // z3  収B 階 階 収C ホ c2 c2 c1 c1     (c2=子供部屋2のクローゼット、c1=子供部屋1のクローゼット)
  // z4  主 主 主 主 ホ ホ 子1 子1 子1
  // z5  主 主 主 主 W  W  子1 子1 子1
  // z6  主 主 主 主 W  W  子1 子1 子1
  // z7  主 主 主 主 W  W  子1 子1 子1     (W=主寝室のウォークインクローゼット)
  const stoA = room('stoA', '収納', 1, 0, 0, 3, 1, { closet: 'storage' });
  const wc2 = room('wc2', 'トイレ(2階)', 1, 3, 0, 5, 1, { floor: { lib: 'cf_hex' } }); // 1階のトイレの真上
  const hall2a = room('hall2a', 'ホール', 1, 1, 1, 4, 2);
  const hall2b = room('hall2b', '廊下', 1, 4, 1, 5, 4);
  const hall2c = room('hall2c', '廊下', 1, 4, 4, 6, 5);
  const stoB = room('stoB', '納戸', 1, 0, 1, 1, 4, { closet: 'storage' });
  const stoC = room('stoC', '物入れ', 1, 3, 2, 4, 4, { closet: 'storage' }); // 階段の横の残り
  const kid2 = room('kid2', '子供部屋2', 1, 5, 0, 9, 3, { floor: { lib: 'whiteash' }, walls: { 0: W0, 1: { lib: 'wp_green' }, 2: W0, 3: W0 } });
  const cl2 = room('cl2', 'クローゼット', 1, 5, 3, 7, 4, { closet: 'cl', floor: { lib: 'whiteash' } });
  const cl1 = room('cl1', 'クローゼット', 1, 7, 3, 9, 4, { closet: 'cl', floor: { lib: 'whiteash' } });
  const master = room('master', '主寝室', 1, 0, 4, 4, 8, { walls: { 0: { lib: 'wp_navy' }, 1: W0, 2: W0, 3: W0 } }); // ベッドの頭(北)をアクセントクロス
  const wic = room('wic', 'WIC', 1, 4, 5, 6, 8, { closet: 'wic' });
  const kid1 = room('kid1', '子供部屋1', 1, 6, 4, 9, 8, { floor: { lib: 'whiteash' }, walls: { 0: W0, 1: { lib: 'wp_blue' }, 2: W0, 3: W0 } });

  // ---------- 出入り口・窓(1階) ----------
  opening(genkan, 'N', 0.55, 0.9, { h: 2.1, swing: 'out', hinge: 'left', open: 0 }); // 玄関ドア(土間の床から)
  link(genkan, 'E', hall1, 0.1, 1.56, { type: 'open', sill: 0.15, twinSill: 0, h: 2.2 }); // 上がり框(幅いっぱい)
  link(sic, 'N', genkan, 0.1, 0.7, { type: 'open', h: 2.0 }); // 土間からシューズインクローゼットへ(どちらも土間なので段なし)
  link(ldk, 'N', hall1, 3.0, 0.8, { swing: 'in', hinge: 'left', open: 0.85 });
  link(wc1, 'S', hall1, 2.85, 0.7, { style: 'slide', open: 0 }); // 引き戸。入口は西の端、便器は入口から遠い東の壁
  link(wash, 'W', hall1, 1.0, 0.7, { swing: 'in', hinge: 'left', open: 0.8 });
  link(wash, 'E', bath, 0.95, 0.75, { swing: 'in', hinge: 'right', open: 0.85, style: 'bath' });
  link(stair, 'N', hall1, 1.88, 0.76, { type: 'open', h: 2.4 });                // 1階の上り口(北の辺の東半分)
  link(stair, 'N', hall2a, 1.0, 0.76, { type: 'open', sill: FH, twinSill: 0 });  // 2階の出口(北の辺の西半分)
  link(osh, 'S', wa, 0.13, 2.4, { type: 'closet', style: 'fusuma', open: 0 });   // 押入れ1間半(襖)
  link(wa, 'E', ldk, 4.66, 1.69, { style: 'slide', open: 0.5 });                  // 和室とLDKの間は引き違い戸(閉めれば客間)
  win(ldk, 'S', 4.0, 1.69, 2.0, 0.0); win(ldk, 'S', 6.25, 1.69, 2.0, 0.0); win(ldk, 'E', 3.6, 0.78, 1.1, 0.9);
  win(wa, 'S', 0.5, 1.69, 1.1, 0.9); win(wa, 'W', 5.3, 0.78, 1.1, 0.9);
  win(wash, 'N', 5.55, 0.6, 0.5, 1.5); win(bath, 'E', 0.65, 0.6, 0.4, 1.5); win(wc1, 'N', 3.4, 0.4, 0.5, 1.4);
  niche(genkan, 'S', 1.1, 0.5, 0.6, 1.0);   // 玄関:正面の飾りニッチ(W500×H600)
  niche(wc1, 'E', 0.205, 0.5, 0.4, 1.0);    // トイレ:便器の後ろのニッチ(W500×H400)
  // ---------- 出入り口・窓(2階) ----------
  link(hall2a, 'E', hall2b, 0.98, 0.77, { type: 'open', h: 2.4 });
  link(hall2b, 'S', hall2c, 3.72, 0.75, { type: 'open', h: 2.4 });
  link(wc2, 'S', hall2a, 2.85, 0.7, { style: 'slide', open: 0 });
  link(stoA, 'S', hall2a, 1.2, 1.3, { type: 'closet', style: 'fold', open: 0 });
  link(stoB, 'S', master, 0.1, 0.7, { type: 'closet', style: 'fold', open: 0 }); // 納戸は主寝室からも使える
  link(stoB, 'E', hall2a, 1.0, 0.7, { type: 'closet', style: 'fold', open: 0 });
  link(stoC, 'E', hall2b, 2.0, 1.5, { type: 'closet', style: 'slide', open: 0 });
  link(kid2, 'W', hall2b, 1.0, 0.7, { swing: 'in', hinge: 'left', open: 0.85 });
  link(cl2, 'N', kid2, 4.65, 1.3, { type: 'closet', style: 'fold', open: 0 });
  link(cl1, 'S', kid1, 6.5, 1.6, { type: 'closet', style: 'fold', open: 0 });
  link(master, 'E', hall2c, 3.75, 0.7, { swing: 'in', hinge: 'left', open: 0.85 });
  link(wic, 'W', master, 4.75, 0.7, { type: 'open', h: 2.0 });
  link(kid1, 'W', hall2c, 3.75, 0.7, { swing: 'in', hinge: 'right', open: 0.85 });
  // 2階はバルコニーなし → 掃き出し窓は付けない
  win(master, 'S', 0.8, 1.69, 1.1, 0.9); win(master, 'W', 5.6, 0.78, 1.1, 0.9);
  win(kid1, 'S', 6.2, 1.69, 1.1, 0.9); win(kid1, 'E', 4.2, 0.78, 1.1, 0.9);
  win(kid2, 'N', 6.6, 0.78, 1.1, 0.9); win(kid2, 'E', 0.3, 0.78, 1.1, 0.9);
  win(wc2, 'N', 3.4, 0.4, 0.5, 1.4);
  niche(hall2c, 'S', 3.85, 0.5, 0.6, 1.0);  // 2階の廊下のつきあたり(W500×H600)

  const rooms = [genkan, wc1, wash, bath, hall1, sic, stair, osh, wa, ldk, stoA, wc2, hall2a, hall2b, hall2c, stoB, stoC, kid2, cl2, cl1, master, wic, kid1];
  const items = [];
  const add = (type, roomId, x, y, z, rot, over = {}) => { const it = newItem(type, { roomId, x, y, z, rot, ...over }); if (it) items.push(it); return it; };
  const H = Math.PI / 2, P = Math.PI;
  // LDK(内側 x 2.79〜8.13、z 1.88〜7.22)
  add('kitchen', 'ldk', 6.8, 0, 2.205, 0, { w: 2.55 });                 // 壁付けI型(前の通路 865mm)
  add('table', 'ldk', 6.8, 0, 4.1, H, { w: 1.4 });                       // 縦向き(ソファとの間をあける)
  add('pendant', 'ldk', 6.8, 2.4, 3.75, 0, { color: '#2f2f33', opts: { on: true, drop: 0.7, power: 1 } }); add('pendant', 'ldk', 6.8, 2.4, 4.45, 0, { color: '#2f2f33', opts: { on: true, drop: 0.7, power: 1 } });
  add('downlight', 'ldk', 6.0, 2.4, 2.4, 0); add('downlight', 'ldk', 6.8, 2.4, 2.4, 0); add('downlight', 'ldk', 7.6, 2.4, 2.4, 0); // キッチンの手もと
  add('tvboard', 'ldk', 7.93, 0, 6.05, -H, { w: 1.6 }); add('sofa', 'ldk', 5.3, 0, 5.95, H, { color: '#8c95a3', w: 1.6 });
  add('lowtable', 'ldk', 6.5, 0, 6.05, H); add('rug', 'ldk', 6.4, 0, 6.05, H, { w: 2.0, d: 1.6, color: '#bfae94' });
  add('ceilingLight', 'ldk', 6.5, 2.4, 6.05, 0, { w: 0.6 }); add('downlight', 'ldk', 3.8, 2.4, 3.2, 0); add('downlight', 'ldk', 3.8, 2.4, 5.6, 0);
  add('fridge', 'ldk', 5.1, 0, 2.24, 0); // 冷蔵庫(キッチンの西どなり)
  add('monstera', 'ldk', 3.3, 0, 6.75, 0, { w: 0.9, h: 1.0, d: 0.9 }); add('umbellata', 'ldk', 3.25, 0, 4.2, 0, { w: 0.8, h: 1.6, d: 0.8 });
  // カーテン:掃き出し窓は床から10mm・窓の上+100mm、腰窓は窓台の下150mmまで、幅は窓より左右に約150mmずつ広く
  add('curtain', 'ldk', 4.845, 1.055, 7.22, P, { w: 1.99, h: 2.09, color: '#cbb89a', opts: { open: 0.35, lace: true } });
  add('curtain', 'ldk', 7.095, 1.055, 7.22, P, { w: 1.99, h: 2.09, color: '#cbb89a', opts: { open: 0.35, lace: true } });
  add('curtain', 'ldk', 8.13, 1.425, 3.99, -H, { w: 1.08, h: 1.35, color: '#cbb89a', opts: { open: 0.3 } });
  add('aircon', 'ldk', 2.79, 2.17, 3.0, H); add('switch', 'ldk', 3.95, 1.2, 1.88, 0);
  // 和室(内側 x 0.06〜2.67、z 4.61〜7.22)
  add('lowtable', 'wa', 1.365, 0, 5.915, 0, { color: '#6b4a33' }); add('ceilingLight', 'wa', 1.365, 2.4, 5.915, 0, { w: 0.45, opts: { on: true, warm: true, power: 1 } });
  add('shoji', 'wa', 1.345, 1.45, 7.22, P, { w: 1.69, h: 1.1 }); add('shoji', 'wa', 0.06, 1.45, 5.69, H, { w: 0.78, h: 1.1 }); add('switch', 'wa', 2.67, 1.2, 6.55, -H);
  add('downlight', 'osh', 1.365, 2.4, 4.095, 0);
  // 玄関(土間。高さは土間の床から)・シューズインクローゼット
  add('shoebox', 'genkan', 0.25, 0, 0.75, H, { opts: { tall: false, float: true } }); // 幅1,200の浮かせる靴箱(下に間接照明・スリッパ置き)
  add('downlight', 'genkan', 0.91, 2.55, 0.91, 0); add('switch', 'genkan', 1.6, 1.2, 0.06, 0);
  add('sansevieria', 'genkan', 1.6, 0, 0.25, 0, { w: 0.3 });
  add('downlight', 'sic', 0.455, 2.55, 2.73, 0);
  // ホール・物入れ・トイレ・洗面・浴室
  add('downlight', 'hall1', 2.27, 2.4, 0.9, 0); add('downlight', 'hall1', 3.9, 2.4, 1.365, 0); add('switch', 'hall1', 2.67, 1.2, 0.5, -H);
  add('toilet', 'wc1', 4.115, 0, 0.455, -H); add('paperholder', 'wc1', 3.64, 0.7, 0.06, 0); add('towelring', 'wc1', 4.0, 1.1, 0.85, P); // 座って右にペーパー(床700・便座の先+100)、左にタオルリング add('downlight', 'wc1', 3.64, 2.4, 0.455, 0);
  add('washstand', 'wash', 5.0, 0, 0.335, 0, { w: 0.75 }); add('washer', 'wash', 5.85, 0, 0.38, 0); add('towelbar', 'wash', 4.61, 1.0, 0.78, H, { w: 0.3 });
  add('ceilingLight', 'wash', 5.46, 2.4, 0.91, 0, { w: 0.35 }); add('switch', 'wash', 4.61, 1.2, 0.85, H);
  add('unitbath', 'bath', 7.28, 0, 0.91, -H, { w: 1.7, d: 1.7, color: '#f6f6f3' }); add('downlight', 'bath', 7.28, 2.2, 0.91, 0);
  add('wallLight', 'stair', 0.97, 3.1, 2.7, H); add('wallLight', 'stair', 2.67, FH + 1.9, 2.7, -H);
  // 2階 主寝室(内側 x 0.06〜3.58、z 3.70〜7.22)
  add('bed', 'master', 1.82, 0, 4.725, 0); add('ceilingLight', 'master', 1.82, 2.4, 5.46, 0, { w: 0.55 }); add('aircon', 'master', 0.06, 2.17, 4.4, H); add('switch', 'master', 3.58, 1.2, 4.62, -H);
  add('curtain', 'master', 1.645, 1.425, 7.22, P, { w: 1.99, h: 1.35, color: '#6c7a9c', fabric: 'linen', opts: { open: 0.25, lace: true } });
  add('curtain', 'master', 0.06, 1.425, 5.99, H, { w: 1.08, h: 1.35, color: '#6c7a9c', fabric: 'linen', opts: { open: 0.2 } });
  add('downlight', 'wic', 4.55, 2.4, 5.915, 0);
  // 子供部屋1(内側 x 5.52〜8.13、z 3.70〜7.22)
  add('bed', 'kid1', 7.105, 0, 6.5, -H, { w: 1.0 }); add('desk', 'kid1', 5.82, 0, 5.25, H, { w: 0.9 }); add('chair', 'kid1', 6.4, 0, 5.25, -H);
  add('ceilingLight', 'kid1', 6.825, 2.4, 5.46, 0, { w: 0.5 }); add('switch', 'kid1', 5.52, 1.2, 4.62, H); add('downlight', 'cl1', 7.28, 2.4, 3.185, 0);
  add('curtain', 'kid1', 7.045, 1.425, 7.22, P, { w: 1.99, h: 1.35, color: '#9fb2bd', opts: { open: 0.3, lace: true } });
  add('curtain', 'kid1', 8.13, 1.425, 4.59, -H, { w: 1.08, h: 1.35, color: '#9fb2bd', opts: { open: 0.3 } });
  // 子供部屋2(内側 x 4.61〜8.13、z 0.06〜2.67)
  add('bed', 'kid2', 7.07, 0, 2.1, -H, { w: 1.0 }); add('desk', 'kid2', 5.95, 0, 0.36, 0, { w: 1.0 }); add('chair', 'kid2', 5.95, 0, 0.95, P);
  add('ceilingLight', 'kid2', 6.37, 2.4, 1.365, 0, { w: 0.5 }); add('switch', 'kid2', 4.61, 1.2, 0.85, H); add('downlight', 'cl2', 5.46, 2.4, 3.185, 0);
  add('curtain', 'kid2', 6.99, 1.425, 0.06, 0, { w: 1.08, h: 1.35, color: '#b9c9a5', opts: { open: 0.3 } });
  add('curtain', 'kid2', 8.13, 1.425, 0.69, -H, { w: 1.08, h: 1.35, color: '#b9c9a5', opts: { open: 0.3 } });
  // 2階のトイレ・ホール・収納
  add('toilet', 'wc2', 4.115, 0, 0.455, -H); add('paperholder', 'wc2', 3.64, 0.7, 0.06, 0); add('towelring', 'wc2', 4.0, 1.1, 0.85, P); add('downlight', 'wc2', 3.64, 2.4, 0.455, 0);
  add('switch', 'hall2a', 2.75, 1.2, 0.97, 0);
  add('downlight', 'hall2a', 2.3, 2.4, 1.365, 0); add('downlight', 'hall2b', 4.095, 2.4, 1.4, 0); add('downlight', 'hall2b', 4.095, 2.4, 2.7, 0); add('downlight', 'hall2c', 4.55, 2.4, 4.095, 0);
  add('downlight', 'stoA', 1.365, 2.4, 0.455, 0); add('downlight', 'stoB', 0.455, 2.4, 2.275, 0); add('downlight', 'stoC', 3.185, 2.4, 2.73, 0);
  return { v: 1, name: '見本の家(4LDK・2階建て)', rooms, items, assets: {}, settings: { night: false, module: 'shaku', floorH: FH }, camera: { x: 7.4, z: 6.5, yaw: Math.PI / 3.2, gy: 0 } };
}

// ---------- すき間がないことの確認(マスの数。1マス = 0.91×0.91 = 0.8281㎡) ----------
// 外形 9×8 = 72マス(59.62㎡ = 18.0坪)/階。延床 144マス = 119.24㎡ = 36.1坪
// 1階:玄関 2×2=4 + トイレ 2×1=2 + 物入れ 1×1=1 + 洗面 2×2=4 + 浴室 2×2=4 + ホール 3×1=3
//      + シューズインクローゼット 1×3=3 + 階段 2×2=4 + 押入れ 2×1=2 + 和室 3×3=9 + LDK 6×6=36
//      = 4+2+1+4+4+3+3+4+2+9+36 = 72 = 9×8 ✓(行ごと:z0 2+2+1+2+2=9、z1 2+3+2+2=9、z2〜z4 1+2+6=9、z5〜z7 3+6=9)
// 2階:収納A 2×1=2 + トイレ 2×1=2 + 廊下(縦) 1×4=4 + 子供部屋2 4×3=12 + 納戸 1×3=3 + ホール 3×1=3 + 階段 2×2=4
//      + 物入れ 1×2=2 + クローゼット(子2) 2×1=2 + クローゼット(子1) 2×1=2 + 主寝室 4×4=16 + 廊下(横) 2×1=2
//      + WIC 2×3=6 + 子供部屋1 3×4=12
//      = 2+2+4+12+3+3+4+2+2+2+16+2+6+12 = 72 = 9×8 ✓(行ごと:z0 2+2+1+4=9、z1 1+3+1+4=9、z2 1+2+1+1+4=9、z3 1+2+1+1+2+2=9、z4 4+2+3=9、z5〜z7 4+2+3=9)
// 帖数(壁芯÷1.62):LDK 18.4帖、和室 4.6帖、主寝室 8.2帖、子供部屋 6.1帖×2、WIC 3.1帖、玄関 2.0帖+SIC 1.5帖
