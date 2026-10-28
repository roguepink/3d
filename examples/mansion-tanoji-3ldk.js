// マンションの見本 1:田の字型 3LDK・中住戸(8階)。間口 6.4m × 奥行 11.3m(壁芯 約72㎡)+ バルコニー 奥行 1.9m
// 北 = 共用廊下(玄関・アルコーブ・面格子の窓)、南 = バルコニー。東西は となりの住戸との境の壁(戸境壁)なので窓はない
// 座標は m。M(m) でマス数に直して room に渡す。部屋の内側は壁芯から 60mm 内側
//
//   x: 0        1.6   2.6    3.9   4.8        6.4
// z0  ┌─ 洋室1 ──────┬ポーチ┬── 洋室2 ──────┐
//     │              ├玄関─┤                │
// 3.2 ├ WIC ┬物入───┤     ├── CL2 ────────┤
// 3.8 │     ├トイレ─┤廊下 ├── 洗面脱衣 ────┤
// 5.3 ├─────┴──────┴─────┤PS ┬ 浴室 ─────┤ 5.5
//     │  LDK(キッチンは北側・対面)│パントリー│        │ 6.2
//     │                       ├────┴ CL3 ───┤ 7.5
//     │                       │   洋室3      │ 8.2
// 11.3└───────────────────────┴──────────────┘
//     └──────── バルコニー(奥行 1.9m)────────┘ 13.2
const M = v => v / G;
const R = (id, name, x0, z0, x1, z1, o = {}) => room(id, name, 0, M(x0), M(z0), M(x1), M(z1), o);
const CH = 2.45; // 天井高
const CF = { 0: W0, 1: W0, 2: W0, 3: W0 };
const CON = { 0: { lib: 'concrete_w' }, 1: { lib: 'concrete_w' }, 2: { lib: 'concrete_w' }, 3: { lib: 'concrete_w' } };
const WET = { floor: { lib: 'cf_tile' }, h: 2.3 };

// ---------- 部屋 ----------
const porch = R('porch', 'ポーチ(アルコーブ)', 2.6, 0, 3.9, 0.9, { drop: 0.15, h: CH + 0.15, floor: { lib: 'concrete' }, walls: CON, outdoor: { rail: 'steel', h: 1.1 } });
const genkan = R('genkan', '玄関', 2.6, 0.9, 3.9, 2.1, { drop: 0.12, h: CH + 0.12, floor: { lib: 'tile_g' } });
const hall = R('hall', '廊下', 2.6, 2.1, 3.9, 5.3, { h: CH });
const yo1 = R('yo1', '洋室1', 0, 0, 2.6, 3.2, { h: CH });
const wic = R('wic', 'WIC', 0, 3.2, 1.6, 5.3, { closet: 'wic', h: CH });
const mono = R('mono', '物入れ', 1.6, 3.2, 2.6, 3.8, { closet: 'storage', h: CH });
const wc = R('wc', 'トイレ', 1.6, 3.8, 2.6, 5.3, { floor: { lib: 'cf_marble' }, h: 2.3, walls: { 0: { lib: 'wp_greige' }, 1: W0, 2: W0, 3: W0 } });
const yo2 = R('yo2', '洋室2', 3.9, 0, 6.4, 3.2, { h: CH });
const cl2 = R('cl2', 'クローゼット', 3.9, 3.2, 6.4, 3.9, { closet: 'cl', h: CH });
const wash = R('wash', '洗面脱衣室', 3.9, 3.9, 6.4, 5.5, WET);
const bath = R('bath', '浴室', 4.8, 5.5, 6.4, 7.5, { h: 2.2, floor: { lib: 'ub_floor_g' }, ceiling: { lib: 'ub_ceil' }, walls: { 0: { lib: 'ub_white' }, 1: { lib: 'ub_white' }, 2: { lib: 'ub_wood' }, 3: { lib: 'ub_white' } }, trim: { crown: { on: false }, base: { on: false }, casing: { on: false }, door: { finish: 'white' } } });
const ps = R('ps', 'PS(配管)', 3.9, 5.5, 4.8, 6.2, { closet: 'storage', h: CH, floor: { lib: 'plywood' } });
const pantry = R('pantry', 'パントリー', 3.9, 6.2, 4.8, 7.5, { closet: 'storage', h: CH });
const cl3 = R('cl3', 'クローゼット', 4.8, 7.5, 6.4, 8.2, { closet: 'cl', h: CH });
const yo3 = R('yo3', '洋室3', 3.9, 7.5, 6.4, 11.3, { h: CH, poly: [[3.96, 7.56], [4.74, 7.56], [4.74, 8.26], [6.34, 8.26], [6.34, 11.24], [3.96, 11.24]] });
const ldk = R('ldk', 'LDK', 0, 5.3, 3.9, 11.3, { h: CH, walls: { 0: W0, 1: { lib: 'wp_greige' }, 2: W0, 3: W0 } });
const bal = R('bal', 'バルコニー', 0, 11.3, 6.4, 13.2, { drop: 0.15, h: 2.6, floor: { lib: 'concrete' }, walls: CON, outdoor: { rail: 'concrete', h: 1.1 } });

// ---------- 柱型(住戸の四すみ。外の壁の面にそろえ、部屋の中へ 350×550 出っぱる) ----------
col(yo1, 0.06, 0.06, 0.35, 0.55); col(yo2, 5.99, 0.06, 0.35, 0.55);
col(ldk, 0.06, 10.69, 0.35, 0.55); col(yo3, 5.99, 10.69, 0.35, 0.55);
// ---------- 梁型(外まわりの梁。窓・掃き出し窓の上が 450 下がる)、戸境の梁(LDK の西の壁ぞい) ----------
beam(yo1, 0.41, 0.06, 2.13, 0.25, { drop: 0.45, core: 0.25 }); beam(yo2, 3.96, 0.06, 2.03, 0.25, { drop: 0.45, core: 0.25 });
beam(ldk, 0.41, 10.99, 3.43, 0.25, { drop: 0.45, core: 0.25 }); beam(yo3, 3.96, 10.99, 2.03, 0.25, { drop: 0.45, core: 0.25 });
beam(ldk, 0.06, 5.36, 0.12, 5.33, { drop: 0.5, core: 0.12 });
// ---------- 下がり天井(キッチンのレンジフードのダクトが、廊下の天井を通って共用廊下へ出る) ----------
soffit(hall, 2.66, 2.16, 1.18, 3.08, 0.2); soffit(genkan, 2.66, 0.96, 1.18, 1.08, 0.2);
soffit(ldk, 0.18, 5.36, 3.66, 2.4, 0.2);

// ---------- 出入り口 ----------
link(genkan, 'N', porch, 2.95, 0.85, { style: 'steel', h: 2.0, swing: 'out', hinge: 'left', open: 0 }); // 鉄の玄関ドア(外開き)
link(genkan, 'S', hall, 2.7, 1.1, { type: 'open', sill: 0.12, twinSill: 0, h: 2.2 }); // 上がり框
link(yo1, 'E', hall, 2.3, 0.75, { swing: 'in', hinge: 'right', open: 0 });
link(yo2, 'W', hall, 2.3, 0.75, { swing: 'in', hinge: 'left', open: 0 });
link(mono, 'E', hall, 3.28, 0.44, { type: 'closet', style: 'slide', open: 0 });
link(wc, 'E', hall, 4.45, 0.7, { style: 'slide', open: 0 });
link(wash, 'W', hall, 4.05, 0.75, { style: 'slide', open: 0 });
link(wash, 'S', bath, 5.1, 0.7, { swing: 'in', hinge: 'right', open: 0, style: 'bath' });
link(ldk, 'N', hall, 2.85, 0.8, { swing: 'in', hinge: 'right', open: 0.3 });
link(wic, 'N', yo1, 0.3, 0.75, { type: 'closet', style: 'slide', open: 0 });
link(cl2, 'N', yo2, 4.25, 1.8, { type: 'closet', style: 'fold', open: 0 });
link(cl3, 'S', yo3, 5.0, 1.2, { type: 'closet', style: 'fold', open: 0 });
link(pantry, 'W', ldk, 6.45, 0.7, { type: 'closet', style: 'slide', open: 0 });
link(ldk, 'E', yo3, 7.75, 1.2, { style: 'slide', open: 0.3 }); // 洋室3 は LDK から引き戸(開ければ LDK とひと続き)
link(ldk, 'S', bal, 0.7, 2.6, { style: 'sash', h: 2.0, open: 0 }); // 掃き出し窓(4枚)
link(yo3, 'S', bal, 4.2, 1.65, { style: 'sash', h: 2.0, open: 0 });
// ---------- 窓(北の共用廊下側は面格子) ----------
win(yo1, 'N', 0.75, 1.2, 1.1, 0.9, { grille: true });
win(yo2, 'N', 4.6, 1.2, 1.1, 0.9, { grille: true });

// ---------- 家具・設備 ----------
// LDK(内側 x 0.06〜3.84、z 5.36〜11.24)。キッチンは北の端・対面(ペニンシュラ)
add('kitchen', 'ldk', 1.335, 0, 7.21, P, { style: 'peninsula', w: 2.55, d: 0.9 });
add('counter', 'ldk', 0.96, 0, 5.585, 0, { w: 1.8, d: 0.45, h: 0.9, color: 'f_white' }); // 背面の収納(カップボード)
add('fridge', 'ldk', 2.25, 0, 5.72, 0);
add('table', 'ldk', 1.45, 0, 8.45, 0, { w: 1.2, d: 0.75 });
add('pendant', 'ldk', 1.45, CH, 8.45, 0, { w: 0.3 });
add('sofa', 'ldk', 0.49, 0, 9.85, H, { w: 1.6, d: 0.85 });
add('lowtable', 'ldk', 1.6, 0, 9.85, H, { w: 0.9, d: 0.5 });
add('rug', 'ldk', 1.7, 0, 9.85, H, { w: 1.8, d: 1.4, color: '#c9bba3' });
add('tvboard', 'ldk', 3.64, 0, 9.9, -H, { w: 1.5 });
add('aircon', 'ldk', 3.84, 2.2, 9.9, -H);
add('ceilingLight', 'ldk', 2.0, CH, 9.85, 0, { w: 0.55 });
add('downlight', 'ldk', 0.8, CH - 0.2, 6.2, 0); add('downlight', 'ldk', 2.0, CH - 0.2, 6.2, 0); add('downlight', 'ldk', 3.2, CH - 0.2, 6.6, 0);
add('curtain', 'ldk', 2.0, 1.005, 10.97, P, { w: 2.9, h: 1.99, color: '#d8ccb6', opts: { open: 0.35, lace: true } });
add('intercom', 'ldk', 3.84, 1.4, 5.7, -H); add('switch', 'ldk', 2.75, 1.2, 5.36, 0); add('smoke', 'ldk', 2.0, CH, 8.6, 0);
add('monstera', 'ldk', 3.5, 0, 10.85, 0, { w: 0.6, h: 0.9, d: 0.6 });
// 洋室1(内側 x 0.06〜2.54、z 0.06〜3.14)
add('bed', 'yo1', 1.06, 0, 1.65, H, { w: 1.2 });
add('aircon', 'yo1', 2.54, 2.2, 1.0, -H);
add('ceilingLight', 'yo1', 1.3, CH, 1.6, 0, { w: 0.45 }); add('switch', 'yo1', 2.54, 1.2, 3.12, -H); add('smoke', 'yo1', 1.3, CH, 2.4, 0);
add('curtain', 'yo1', 1.35, 1.375, 0.32, 0, { w: 1.5, h: 1.25, color: '#9fb2bd', opts: { open: 0.3 } });
add('downlight', 'wic', 0.8, CH, 4.25, 0);
// 洋室2(内側 x 3.96〜6.34、z 0.06〜3.14)
add('bed', 'yo2', 5.34, 0, 1.75, -H, { w: 1.0 });
add('desk', 'yo2', 5.0, 0, 0.36, 0, { w: 1.0 }); add('chair', 'yo2', 5.0, 0, 0.9, P);
add('aircon', 'yo2', 3.96, 2.2, 1.0, H);
add('ceilingLight', 'yo2', 5.15, CH, 1.6, 0, { w: 0.45 }); add('switch', 'yo2', 3.96, 1.2, 3.12, H); add('smoke', 'yo2', 5.15, CH, 2.4, 0);
add('curtain', 'yo2', 5.2, 1.375, 0.32, 0, { w: 1.5, h: 1.25, color: '#b9c9a5', opts: { open: 0.3 } });
// 洋室3(内側 x 3.96〜6.34、z 8.26〜11.24)
add('bed', 'yo3', 5.34, 0, 9.75, -H, { w: 1.0 });
add('chest', 'yo3', 4.2, 0, 10.5, H);
add('aircon', 'yo3', 6.34, 2.2, 9.2, -H);
add('ceilingLight', 'yo3', 5.15, CH, 9.75, 0, { w: 0.45 }); add('switch', 'yo3', 3.96, 1.2, 9.05, H); add('smoke', 'yo3', 5.15, CH, 9.3, 0);
add('curtain', 'yo3', 5.025, 1.005, 10.97, P, { w: 1.95, h: 1.99, color: '#cbb89a', opts: { open: 0.3, lace: true } });
// 玄関・廊下(土間の物は土間の床から)
add('shoebox', 'genkan', 2.84, 0, 1.5, H, { w: 1.0, d: 0.35, opts: { tall: false, float: true } });
add('downlight', 'genkan', 3.3, CH - 0.2 + 0.12, 1.5, 0); add('switch', 'hall', 3.84, 1.2, 2.2, -H);
add('downlight', 'hall', 3.25, CH - 0.2, 2.9, 0); add('downlight', 'hall', 3.25, CH - 0.2, 4.5, 0); add('smoke', 'hall', 3.25, CH - 0.2, 3.7, 0);
add('umbrellaStand', 'porch', 3.6, 0, 0.3, 0);
// トイレ(内側 x 1.66〜2.54、z 3.86〜5.24)。便器は北の壁を背に。座って右(西)にペーパー、左(東)にタオルリング
add('toilet', 'wc', 2.1, 0, 4.235, 0); add('paperholder', 'wc', 1.66, 0.7, 4.75, H); add('towelring', 'wc', 2.54, 1.1, 4.2, -H);
add('downlight', 'wc', 2.1, 2.3, 4.6, 0); add('ventfan', 'wc', 2.1, 2.15, 3.86, 0);
// 洗面脱衣室(内側 x 3.96〜6.34、z 3.96〜5.44)
add('washstand', 'wash', 4.5, 0, 4.235, 0, { w: 0.75 }); add('washer', 'wash', 5.35, 0, 4.28, 0, { w: 0.64, d: 0.64 });
add('shelf', 'wash', 6.05, 0, 4.15, 0, { w: 0.5, h: 1.8, d: 0.35, color: 'f_white' });
add('towelbar', 'wash', 6.34, 1.0, 5.0, -H, { w: 0.4 });
add('ceilingLight', 'wash', 5.15, 2.3, 4.7, 0, { w: 0.35 }); add('switch', 'hall', 3.84, 1.2, 4.0, -H);
// 浴室(内側 x 4.86〜6.34、z 5.56〜7.44)1418
add('unitbath', 'bath', 5.6, 0, 6.5, 0, { w: 1.4, d: 1.8 }); add('downlight', 'bath', 5.6, 2.2, 6.5, 0);
add('downlight', 'pantry', 4.35, CH, 6.85, 0);
// バルコニー
add('plant', 'bal', 6.0, 0, 12.8, 0, { w: 0.5, h: 0.9, d: 0.5 });

return { name: 'マンション 田の字型 3LDK(中住戸・約72㎡)', storey: 8, camera: { x: 3.2, z: 10.6, yaw: 0.6, gy: 0 } };
