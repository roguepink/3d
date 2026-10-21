// 見本の家:木造2階建ての 3LDK(延床 約31坪)。尺モジュール(910mm)で、1階・2階とも 8,190×6,370(芯々)
// 1階:LDK(約19帖)・パントリー・玄関・廊下・トイレ・洗面脱衣室・浴室(ユニットバス1616)・階段(折り返し・回り段)
// 2階:主寝室(約10帖)・子供部屋(約8帖・約6帖)・ホール・トイレ・収納・納戸
// 階高 2,900(1階の床→2階の床)、天井高 2,400、浴室の天井 2,200、階段は14段上がり(1段 約207mm)
import { newItem } from './items.js';

const G = 0.91, T = 0.06; // 尺のマス、壁の半分の厚み(壁の中心から内側の面まで)
const W0 = { lib: 'wp_white' };
// 壁の中心線の座標(マス数)から、内側の寸法の部屋を作る
function room(id, name, level, x0, z0, x1, z1, o = {}) {
  const x = x0 * G + T, z = z0 * G + T, w = (x1 - x0) * G - T * 2, d = (z1 - z0) * G - T * 2;
  return { id, name, level, x, z, w, d, h: 2.4, poly: [[x, z], [x + w, z], [x + w, z + d], [x, z + d]], floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: { 0: W0, 1: W0, 2: W0, 3: W0 }, openings: [], parts: [], ...o };
}
// 辺の番号:0=北(奥) 1=東(右) 2=南(手前) 3=西(左)。s は開口の端の位置(家の座標の小さいほう)、w は幅
const SIDE = { N: 0, E: 1, S: 2, W: 3 };
function uOf(r, side, s, w) { const e = SIDE[side]; if (e === 0) return s - r.x; if (e === 1) return s - r.z; if (e === 2) return r.x + r.w - (s + w); return r.z + r.d - (s + w); }
let seq = 0;
function opening(r, side, s, w, props) { const o = { id: 'd' + (++seq), edge: SIDE[side], u: uOf(r, side, s, w), w, h: 2.0, type: 'door', ...props }; r.openings.push(o); return o; }
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
// 2つの部屋をつなぐ開口(a が持ち主、b は同じ穴)
function link(a, side, b, s, w, props = {}) { const o = opening(a, side, s, w, props); const t = { id: 'd' + (++seq), edge: SIDE[OPP[side]], u: uOf(b, OPP[side], s, w), w, h: o.h, type: o.type, twin: o.id }; if (props.twinSill !== undefined) t.sill = props.twinSill; delete o.twinSill; b.openings.push(t); return o; }
function win(r, side, s, w, h, sill, props = {}) { return opening(r, side, s, w, { type: 'window', h, sill, ...props }); }

export function demoProject() {
  seq = 0; const FH = 2.9;
  // ---------- 1階 ----------
  const bath = room('bath', '浴室', 0, 0, 0, 2, 2, { h: 2.2, floor: { lib: 'ub_floor_g' }, ceiling: { lib: 'ub_ceil' }, walls: { 0: { lib: 'ub_white' }, 1: { lib: 'ub_white' }, 2: { lib: 'ub_white' }, 3: { lib: 'ub_wood' } }, trim: { crown: { on: false }, base: { on: false }, casing: { on: false }, door: { finish: 'white' } } });
  const wash = room('wash', '洗面脱衣室', 0, 2, 0, 4, 2, { floor: { lib: 'cf_tile' } });
  const wc1 = room('wc1', 'トイレ', 0, 4, 0, 5, 2, { floor: { lib: 'cf_stone' }, walls: { 0: { lib: 'wp_tex' }, 1: W0, 2: W0, 3: W0 } });
  const stair = room('stair', '階段', 0, 5, 0, 7, 2, { floor: { lib: 'oak' }, stair: { kind: 'u_winder', style: 'box', dir: 'S', flip: false, finish: 'wood_natural' } });
  const genkan = room('genkan', '玄関', 0, 7, 0, 9, 2, { floor: { lib: 'tile_g' } });
  const pantry = room('pantry', 'パントリー', 0, 0, 2, 2, 3);
  const hall1 = room('hall1', '廊下', 0, 2, 2, 9, 3);
  const ldk = room('ldk', 'LDK', 0, 0, 3, 9, 7, { walls: { 0: W0, 1: { lib: 'wp_tex' }, 2: W0, 3: W0 } });
  // ---------- 2階 ----------
  const kid2 = room('kid2', '子供部屋2', 1, 0, 0, 4, 3, { floor: { lib: 'whiteash' }, walls: { 0: W0, 1: W0, 2: W0, 3: { lib: 'wp_green' } } });
  const sto = room('sto', '収納', 1, 4, 0, 5, 2);
  const wc2 = room('wc2', 'トイレ(2階)', 1, 7, 0, 8, 2, { floor: { lib: 'cf_stone' } });
  const nando = room('nando', '納戸', 1, 8, 0, 9, 2);
  const hall2 = room('hall2', 'ホール', 1, 4, 2, 9, 3);
  const master = room('master', '主寝室', 1, 0, 3, 5, 7, { walls: { 0: { lib: 'wp_navy' }, 1: W0, 2: W0, 3: W0 } });
  const kid1 = room('kid1', '子供部屋1', 1, 5, 3, 9, 7, { floor: { lib: 'whiteash' }, walls: { 0: W0, 1: { lib: 'wp_blue' }, 2: W0, 3: W0 } });

  // ---------- 出入り口・窓(1階) ----------
  link(wash, 'W', bath, 0.62, 0.75, { swing: 'in', hinge: 'right', open: 0.85, style: 'bath' });
  link(wash, 'S', hall1, 2.3, 0.75, { swing: 'in', hinge: 'left', open: 0.8 });
  link(wc1, 'S', hall1, 3.78, 0.65, { swing: 'out', hinge: 'right', open: 0.75 });
  link(stair, 'S', hall1, 4.65, 0.76, { type: 'open' });                    // 1階の上り口
  link(stair, 'S', hall2, 5.51, 0.76, { type: 'open', sill: FH, twinSill: 0 }); // 2階の出口
  link(genkan, 'S', hall1, 6.6, 1.3, { type: 'open', h: 2.2 });
  opening(genkan, 'N', 6.95, 0.9, { h: 2.1, swing: 'out', hinge: 'left', open: 0 }); // 玄関ドア
  link(ldk, 'N', hall1, 6.3, 0.8, { swing: 'in', hinge: 'right', open: 0.85 });
  link(pantry, 'S', ldk, 0.2, 0.7, { swing: 'in', hinge: 'left', open: 0.6 });
  win(ldk, 'S', 0.9, 1.69, 2.0, 0.0); win(ldk, 'S', 5.0, 1.69, 2.0, 0.0); win(ldk, 'E', 2.95, 0.78, 1.1, 0.9); win(ldk, 'W', 3.6, 0.78, 1.1, 0.9);
  win(wash, 'N', 2.4, 0.6, 0.6, 1.3); win(bath, 'N', 0.95, 0.6, 0.7, 1.2); win(wc1, 'N', 3.9, 0.4, 0.5, 1.4);
  win(stair, 'N', 5.4, 0.6, 0.9, FH + 0.7); // 階段の窓(2階の高さ)
  // ---------- 出入り口・窓(2階) ----------
  link(kid2, 'E', hall2, 1.92, 0.7, { swing: 'in', hinge: 'right', open: 0.85 });
  link(sto, 'S', hall2, 3.75, 0.7, { swing: 'in', hinge: 'left', open: 0.3 });
  link(wc2, 'S', hall2, 6.45, 0.65, { swing: 'out', hinge: 'right', open: 0.7 });
  link(nando, 'S', hall2, 7.36, 0.7, { swing: 'in', hinge: 'left', open: 0.3 });
  link(master, 'N', hall2, 3.76, 0.7, { swing: 'in', hinge: 'right', open: 0.85 });
  link(kid1, 'N', hall2, 4.7, 0.75, { swing: 'in', hinge: 'left', open: 0.85 });
  win(kid2, 'N', 1.0, 1.69, 1.1, 0.9); win(kid2, 'W', 0.9, 0.78, 1.1, 0.9);
  win(master, 'S', 1.4, 1.69, 2.0, 0.0); win(master, 'W', 4.2, 0.78, 1.1, 0.9);
  win(kid1, 'S', 5.7, 1.69, 1.1, 0.9); win(kid1, 'E', 4.3, 0.78, 1.1, 0.9);
  win(wc2, 'N', 6.6, 0.4, 0.5, 1.4);

  const rooms = [bath, wash, wc1, stair, genkan, pantry, hall1, ldk, kid2, sto, wc2, nando, hall2, master, kid1];
  const items = [];
  const add = (type, roomId, x, y, z, rot, over = {}) => { const it = newItem(type, { roomId, x, y, z, rot, ...over }); items.push(it); return it; };
  const H = Math.PI / 2, P = Math.PI;
  // LDK(内側 x 0.06〜8.13、z 2.79〜6.31)
  add('kitchen', 'ldk', 2.35, 0, 3.12, 0, { w: 2.55 });
  add('table', 'ldk', 2.35, 0, 4.5, 0, { w: 1.35 });
  add('chair', 'ldk', 2.0, 0, 4.0, 0); add('chair', 'ldk', 2.7, 0, 4.0, 0); add('chair', 'ldk', 2.0, 0, 5.0, P); add('chair', 'ldk', 2.7, 0, 5.0, P);
  add('pendant', 'ldk', 2.05, 2.4, 4.5, 0, { color: '#2f2f33', opts: { on: true, drop: 0.7, power: 1 } }); add('pendant', 'ldk', 2.65, 2.4, 4.5, 0, { color: '#2f2f33', opts: { on: true, drop: 0.7, power: 1 } });
  add('tvboard', 'ldk', 7.9, 0, 4.7, -H, { w: 1.6 }); add('sofa', 'ldk', 5.6, 0, 4.7, H, { color: '#8c95a3', w: 2.0 });
  add('lowtable', 'ldk', 6.6, 0, 4.7, H); add('rug', 'ldk', 6.6, 0, 4.7, H, { w: 2.2, d: 1.6, color: '#bfae94' });
  add('ceilingLight', 'ldk', 6.6, 2.4, 4.7, 0, { w: 0.6 }); add('plant', 'ldk', 7.8, 0, 6.0, 0);
  add('curtain', 'ldk', 1.745, 1.05, 6.31, P, { w: 2.0, h: 2.15, color: '#cbb89a', opts: { open: 0.35, lace: true } });
  add('curtain', 'ldk', 5.845, 1.05, 6.31, P, { w: 2.0, h: 2.15, color: '#cbb89a', opts: { open: 0.35, lace: true } });
  add('aircon', 'ldk', 8.13, 2.17, 5.9, -H); add('switch', 'ldk', 7.25, 1.2, 2.79, 0);
  // 1階の水まわり・廊下・玄関
  add('unitbath', 'bath', 0.91, 0, 0.91, H, { w: 1.7, d: 1.7, color: '#f6f6f3' });
  add('downlight', 'bath', 0.91, 2.2, 0.91, 0);
  add('washstand', 'wash', 3.305, 0, 0.62, -H, { w: 0.75 }); add('ceilingLight', 'wash', 2.73, 2.4, 1.0, 0, { w: 0.35 });
  add('toilet', 'wc1', 4.095, 0, 0.44, 0); add('downlight', 'wc1', 4.095, 2.4, 1.0, 0);
  add('downlight', 'hall1', 3.0, 2.4, 2.275, 0); add('downlight', 'hall1', 5.2, 2.4, 2.275, 0); add('downlight', 'hall1', 7.3, 2.4, 2.275, 0);
  add('shelf', 'genkan', 6.63, 0, 0.9, H, { w: 0.9 }); add('downlight', 'genkan', 7.3, 2.4, 0.9, 0); add('mirror', 'genkan', 8.13, 1.3, 1.0, -H, { w: 0.45, h: 1.1 });
  add('shelf', 'pantry', 0.9, 0, 2.05, 0, { w: 1.5 });
  add('wallLight', 'stair', 4.61, 2.1, 0.6, H); add('wallLight', 'stair', 6.31, FH + 1.9, 1.2, -H);
  // 2階
  add('bed', 'master', 2.0, 0, 3.85, 0); add('curtain', 'master', 2.245, 1.05, 6.31, P, { w: 2.0, h: 2.15, color: '#6c7a9c', fabric: 'linen', opts: { open: 0.25, lace: true } });
  add('ceilingLight', 'master', 2.25, 2.4, 4.6, 0, { w: 0.55 }); add('shelf', 'master', 4.25, 0, 5.4, -H, {}); add('aircon', 'master', 0.06, 2.17, 3.4, H);
  add('bed', 'kid1', 7.1, 0, 3.85, 0, { w: 1.0 }); add('desk', 'kid1', 5.2, 0, 5.8, H, { w: 1.0 }); add('chair', 'kid1', 5.75, 0, 5.8, -H);
  add('curtain', 'kid1', 6.545, 1.55, 6.31, P, { w: 2.0, h: 1.3, color: '#9fb2bd', opts: { open: 0.3, lace: true } }); add('ceilingLight', 'kid1', 6.37, 2.4, 4.6, 0, { w: 0.5 });
  add('bed', 'kid2', 0.75, 0, 1.35, H, { w: 1.0 }); add('desk', 'kid2', 3.0, 0, 0.45, 0, { w: 1.0 }); add('chair', 'kid2', 3.0, 0, 1.0, P);
  add('curtain', 'kid2', 1.845, 1.55, 0.06, 0, { w: 2.0, h: 1.3, color: '#b9c9a5', opts: { open: 0.3, lace: true } }); add('ceilingLight', 'kid2', 1.82, 2.4, 1.35, 0, { w: 0.5 });
  add('toilet', 'wc2', 6.825, 0, 0.44, 0); add('downlight', 'wc2', 6.825, 2.4, 1.0, 0);
  add('downlight', 'hall2', 4.6, 2.4, 2.275, 0); add('downlight', 'hall2', 7.2, 2.4, 2.275, 0);
  add('shelf', 'nando', 7.735, 0, 0.35, 0, { w: 0.8 });
  return { v: 1, name: '見本の家(3LDK・2階建て)', rooms, items, assets: {}, settings: { night: false, module: 'shaku', floorH: FH }, camera: { x: 7.6, z: 6.0, yaw: Math.PI / 3.2, gy: 0 } };
}
