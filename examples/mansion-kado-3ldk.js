// マンションの見本 2:角部屋 3LDK(8階)。間口 7.0m × 奥行 10.8m(壁芯 約75.6㎡)+ L字のバルコニー(南 1.8m・東へ回り込む)。天井高 2.5m
// 北 = 共用廊下(玄関・面格子の窓)、東 = 建物の端(窓がとれる)、南 = バルコニー。西だけ となりの住戸との境の壁(窓なし)
// 座標は m。M(m) でマス数に直して room に渡す。部屋の内側は壁芯から 60mm 内側
//
//   x: 0       1.8  2.6    3.9  5.0         7.0        8.6
// z0  ┌─ 洋室2 ──────┬ポーチ┬── 洋室1(主寝室)──┐
//     │              ├玄関─┤                     │← 東の窓
// 3.2 ├─ CL2 ────────┤     │                     │
// 3.4 │              │廊下 ├トイレ┬── WIC ──────┤
// 3.9 ├─ 洗面脱衣 ───┤     │      │             │
// 4.7 │              │     ├ PS ──┤             │
// 5.3 │              ├─────┴──────┴─────────────┤
// 5.4 ├ 浴室 ┬パントリー┤  LDK(キッチンは北東・対面)│← 東の小窓
// 7.5 ├CL3 ─┴────────┤                         ├──┐ 7.5
// 8.15│   洋室3       │                         │東の│
// 10.8└───────────────┴─────────────────────────┘バル│
//     └──────────── バルコニー(南)───────────────────┘ 12.6
const M = v => v / G;
const R = (id, name, x0, z0, x1, z1, o = {}) => room(id, name, 0, M(x0), M(z0), M(x1), M(z1), o);
const CH = 2.5;
const CON = { 0: { lib: 'concrete_w' }, 1: { lib: 'concrete_w' }, 2: { lib: 'concrete_w' }, 3: { lib: 'concrete_w' } };
const WET = { floor: { lib: 'cf_tile' }, h: 2.3 };

// ---------- 部屋 ----------
const porch = R('porch', 'ポーチ(アルコーブ)', 2.6, 0, 3.9, 0.9, { drop: 0.15, h: CH + 0.15, floor: { lib: 'concrete' }, walls: CON, outdoor: { rail: 'steel', h: 1.1 } });
const genkan = R('genkan', '玄関', 2.6, 0.9, 3.9, 2.1, { drop: 0.12, h: CH + 0.12, floor: { lib: 'tile_g' } });
const hall = R('hall', '廊下', 2.6, 2.1, 3.9, 5.3, { h: CH });
const yo2 = R('yo2', '洋室2', 0, 0, 2.6, 3.2, { h: CH });
const cl2 = R('cl2', 'クローゼット', 0, 3.2, 2.6, 3.9, { closet: 'cl', h: CH });
const wash = R('wash', '洗面脱衣室', 0, 3.9, 2.6, 5.4, WET);
const bath = R('bath', '浴室', 0, 5.4, 1.8, 7.5, { h: 2.2, floor: { lib: 'ub_floor_g' }, ceiling: { lib: 'ub_ceil' }, walls: { 0: { lib: 'ub_white' }, 1: { lib: 'ub_white' }, 2: { lib: 'ub_white' }, 3: { lib: 'ub_wood' } }, trim: { crown: { on: false }, base: { on: false }, casing: { on: false }, door: { finish: 'white' } } });
const pantry = R('pantry', 'パントリー', 1.8, 5.4, 2.6, 7.5, { closet: 'storage', h: CH });
const cl3 = R('cl3', 'クローゼット', 0, 7.5, 1.8, 8.15, { closet: 'cl', h: CH });
const yo3 = R('yo3', '洋室3', 0, 7.5, 2.6, 10.8, { h: CH, poly: [[0.06, 8.21], [1.86, 8.21], [1.86, 7.56], [2.54, 7.56], [2.54, 10.74], [0.06, 10.74]] });
const yo1 = R('yo1', '洋室1(主寝室)', 3.9, 0, 7.0, 3.4, { h: CH, walls: { 0: W0, 1: W0, 2: W0, 3: { lib: 'wp_greige' } } });
const wc = R('wc', 'トイレ', 3.9, 3.4, 5.0, 4.7, { floor: { lib: 'cf_marble' }, h: 2.3, walls: { 0: W0, 1: W0, 2: { lib: 'wp_greige' }, 3: W0 } });
const ps = R('ps', 'PS(配管)', 3.9, 4.7, 5.0, 5.3, { closet: 'storage', h: CH, floor: { lib: 'plywood' } });
const wic = R('wic', 'WIC', 5.0, 3.4, 7.0, 5.3, { closet: 'wic', h: CH });
const ldk = R('ldk', 'LDK', 2.6, 5.3, 7.0, 10.8, { h: CH, walls: { 0: W0, 1: W0, 2: W0, 3: { lib: 'wp_greige' } } });
const bal = R('bal', 'バルコニー', 0, 7.5, 8.6, 12.6, { drop: 0.15, h: 2.6, floor: { lib: 'concrete' }, walls: CON, outdoor: { rail: 'glass', h: 1.1 },
  poly: [[7.06, 7.56], [8.54, 7.56], [8.54, 12.54], [0.06, 12.54], [0.06, 10.86], [7.06, 10.86]] });

// ---------- 柱型(西=戸境の柱 450×700、東=建物の角の柱 700×700、東西の壁の中ほどにも1本ずつ) ----------
col(yo2, 0.06, 0.06, 0.45, 0.7); col(yo3, 0.06, 10.04, 0.45, 0.7);
col(yo1, 6.24, 0.06, 0.7, 0.7); col(ldk, 6.24, 10.04, 0.7, 0.7);
col(wic, 6.49, 4.54, 0.45, 0.7); col(wash, 0.06, 4.64, 0.45, 0.7);
// ---------- 梁型 ----------
// 外まわりの梁:窓・掃き出し窓の上が 500 下がる(梁の下 = 窓の上 2,000)
const BO = { drop: 0.5, core: 0.25 };
beam(yo2, 0.51, 0.06, 2.03, 0.25, BO); beam(yo1, 3.96, 0.06, 2.28, 0.25, BO);
beam(yo1, 6.69, 0.76, 0.25, 2.58, BO); beam(wic, 6.69, 3.46, 0.25, 1.08, BO);
beam(ldk, 6.69, 5.36, 0.25, 4.68, BO); beam(ldk, 2.66, 10.49, 3.58, 0.25, BO);
beam(yo3, 0.51, 10.49, 2.03, 0.25, BO);
// 戸境の梁:西の壁ぞいに柱から柱まで(壁から 120 出て 500 下がる)
const BS = { drop: 0.5, core: 0.12 };
beam(yo2, 0.06, 0.76, 0.12, 2.38, BS); beam(cl2, 0.06, 3.26, 0.12, 0.58, BS); beam(wash, 0.06, 3.96, 0.12, 0.68, BS); beam(yo3, 0.06, 8.21, 0.12, 1.83, BS);
// 小梁:洋室3との境(300 下がる)
beam(ldk, 2.66, 5.36, 0.12, 5.13, { drop: 0.3, core: 0.12 });
// ---------- 下がり天井(キッチンの上だけ。レンジフードの排気は東の外壁へ直接出す) ----------
soffit(ldk, 4.39, 5.36, 2.3, 2.4, 0.2);

// ---------- 出入り口 ----------
link(genkan, 'N', porch, 2.95, 0.85, { style: 'steel', h: 2.0, swing: 'out', hinge: 'left', open: 0 });
link(genkan, 'S', hall, 2.7, 1.1, { type: 'open', sill: 0.12, twinSill: 0, h: 2.2 });
link(yo2, 'E', hall, 2.3, 0.75, { swing: 'in', hinge: 'left', open: 0 });
link(yo1, 'W', hall, 2.3, 0.75, { swing: 'in', hinge: 'right', open: 0 });
link(wash, 'E', hall, 4.05, 0.75, { style: 'slide', open: 0 });
link(wc, 'W', hall, 3.5, 0.65, { style: 'slide', open: 0 });
link(wash, 'S', bath, 0.6, 0.7, { swing: 'in', hinge: 'left', open: 0, style: 'bath' });
link(ldk, 'N', hall, 2.75, 0.8, { swing: 'in', hinge: 'left', open: 0.3 });
link(cl2, 'N', yo2, 0.4, 1.8, { type: 'closet', style: 'fold', open: 0 });
link(wic, 'N', yo1, 5.3, 0.75, { type: 'closet', style: 'slide', open: 0 });
link(pantry, 'E', ldk, 5.6, 0.7, { type: 'closet', style: 'slide', open: 0 });
link(cl3, 'S', yo3, 0.2, 1.4, { type: 'closet', style: 'fold', open: 0 });
link(ldk, 'W', yo3, 7.6, 0.8, { style: 'slide', open: 0 });
link(ldk, 'S', bal, 3.0, 3.1, { style: 'sash', h: 2.0, open: 0 });  // 南の掃き出し(4枚)
link(ldk, 'E', bal, 8.0, 1.7, { style: 'sash', h: 2.0, open: 0 });  // 東の掃き出し(角部屋の2面採光)
link(yo3, 'S', bal, 0.6, 1.6, { style: 'sash', h: 2.0, open: 0 });
// ---------- 窓 ----------
win(yo2, 'N', 0.6, 1.1, 1.1, 0.9, { grille: true });
win(yo1, 'N', 4.2, 1.1, 1.1, 0.9, { grille: true });
win(yo1, 'E', 1.0, 1.2, 1.1, 0.9);        // 主寝室の東の窓(角部屋)
win(ldk, 'E', 6.13, 0.6, 1.0, 1.0);       // キッチンの小窓(通路の正面)
link(ps, 'N', wc, 4.2, 0.45, { type: 'closet', style: 'slide', open: 0 }); // PS の点検口

// ---------- 家具・設備 ----------
// LDK(内側 x 2.66〜6.94、z 5.36〜10.74)。キッチンは北東の角・対面(東の壁に付けたペニンシュラ)
add('kitchen', 'ldk', 5.665, 0, 7.21, P, { style: 'peninsula', w: 2.55, d: 0.9 });
add('counter', 'ldk', 5.295, 0, 5.585, 0, { w: 1.8, d: 0.45, h: 0.9, color: 'f_white' }); // 背面の収納
add('fridge', 'ldk', 6.59, 0, 5.71, 0); // 冷蔵庫はキッチンの奥(東の端)
add('table', 'ldk', 3.79, 0, 7.21, 0, { w: 1.2, d: 0.75 }); // ペニンシュラに横並びのダイニング
add('pendant', 'ldk', 3.79, CH, 7.21, 0, { w: 0.3 });
add('sofa', 'ldk', 5.4, 0, 9.4, -H, { w: 1.6, d: 0.85 });
add('lowtable', 'ldk', 4.1, 0, 9.4, H, { w: 0.9, d: 0.45 });
add('rug', 'ldk', 4.1, 0, 9.4, H, { w: 1.8, d: 1.6, color: '#c9bba3' });
add('tvboard', 'ldk', 2.86, 0, 9.4, H, { w: 1.5 });
add('aircon', 'ldk', 2.66, 2.25, 10.0, H); // 配管は南の壁から外へ
add('ceilingLight', 'ldk', 4.3, CH, 9.2, 0, { w: 0.55 });
add('downlight', 'ldk', 3.3, CH, 6.0, 0); add('downlight', 'ldk', 5.0, CH - 0.2, 6.3, 0); add('downlight', 'ldk', 6.0, CH - 0.2, 6.3, 0);
add('curtain', 'ldk', 4.55, 1.005, 10.47, P, { w: 3.4, h: 1.99, color: '#d8ccb6', opts: { open: 0.35, lace: true } });
add('curtain', 'ldk', 6.67, 1.005, 8.85, -H, { w: 2.0, h: 1.99, color: '#d8ccb6', opts: { open: 0.35, lace: true } });
add('roller', 'ldk', 6.67, 1.5, 6.43, -H, { w: 0.7, h: 1.0 });
add('intercom', 'ldk', 3.65, 1.4, 5.36, 0); add('switch', 'ldk', 2.66, 1.2, 5.5, H); add('smoke', 'ldk', 4.6, CH, 8.4, 0);
add('monstera', 'ldk', 6.5, 0, 9.85, 0, { w: 0.6, h: 0.9, d: 0.6 });
// 洋室1・主寝室(内側 x 3.96〜6.94、z 0.06〜3.34)
add('bed', 'yo1', 4.96, 0, 1.4, H, { w: 1.4 }); // 頭は西(廊下側)の壁
add('aircon', 'yo1', 5.8, 1.84, 0.06, 0); // 北の壁・梁の下。室外機は共用廊下側
add('ceilingLight', 'yo1', 5.3, CH, 1.7, 0, { w: 0.5 }); add('switch', 'yo1', 3.96, 1.2, 3.12, H); add('smoke', 'yo1', 5.3, CH, 2.6, 0);
add('curtain', 'yo1', 4.75, 1.375, 0.32, 0, { w: 1.5, h: 1.25, color: '#6c7a9c', fabric: 'linen', opts: { open: 0.25, lace: true } });
add('curtain', 'yo1', 6.68, 1.375, 1.6, -H, { w: 1.5, h: 1.25, color: '#6c7a9c', fabric: 'linen', opts: { open: 0.25 } });
add('downlight', 'wic', 5.9, CH, 4.3, 0);
// 洋室2(内側 x 0.06〜2.54、z 0.06〜3.14)
add('bed', 'yo2', 1.06, 0, 1.75, H, { w: 1.0 });
add('desk', 'yo2', 1.15, 0, 0.29, 0, { w: 1.0, d: 0.45 }); add('chair', 'yo2', 1.15, 0, 0.8, P);
add('aircon', 'yo2', 2.1, 1.84, 0.06, 0);
add('ceilingLight', 'yo2', 1.3, CH, 1.7, 0, { w: 0.45 }); add('switch', 'yo2', 2.54, 1.2, 3.12, -H); add('smoke', 'yo2', 1.3, CH, 2.6, 0);
add('curtain', 'yo2', 1.15, 1.375, 0.32, 0, { w: 1.5, h: 1.25, color: '#b9c9a5', opts: { open: 0.3 } });
// 洋室3(内側 x 0.06〜2.54、z 8.21〜10.74)
add('bed', 'yo3', 1.06, 0, 9.2, H, { w: 1.0 });
add('aircon', 'yo3', 2.54, 2.25, 9.95, -H); // 配管は南の壁から外へ
add('ceilingLight', 'yo3', 1.3, CH, 9.3, 0, { w: 0.45 }); add('switch', 'yo3', 2.54, 1.2, 8.55, -H); add('smoke', 'yo3', 1.3, CH, 8.8, 0);
add('curtain', 'yo3', 1.4, 1.005, 10.47, P, { w: 1.9, h: 1.99, color: '#cbb89a', opts: { open: 0.3, lace: true } });
// 玄関・廊下
add('shoebox', 'genkan', 2.84, 0, 1.5, H, { w: 1.0, d: 0.35, h: 2.3, opts: { tall: true, float: true } }); // 天井までの下駄箱
add('downlight', 'genkan', 3.3, CH + 0.12, 1.5, 0); add('switch', 'hall', 3.84, 1.2, 2.2, -H);
add('downlight', 'hall', 3.25, CH, 2.9, 0); add('downlight', 'hall', 3.25, CH, 4.5, 0); add('smoke', 'hall', 3.25, CH, 3.7, 0);
add('umbrellaStand', 'porch', 3.6, 0, 0.3, 0);
// トイレ(内側 x 3.96〜4.94、z 3.46〜4.64)。便器は南の壁を背に北向き。座って右(東)にペーパー、左(西)にタオルリング
add('toilet', 'wc', 4.45, 0, 4.265, P); add('paperholder', 'wc', 4.94, 0.7, 3.79, -H); add('towelring', 'wc', 3.96, 1.1, 4.35, H);
add('downlight', 'wc', 4.45, 2.3, 4.0, 0); add('ventfan', 'wc', 4.45, 2.15, 4.64, P);
// 洗面脱衣室(内側 x 0.06〜2.54、z 3.96〜5.34)
add('washstand', 'wash', 0.7, 0, 4.235, 0, { w: 0.75 }); add('washer', 'wash', 1.6, 0, 4.28, 0, { w: 0.64, d: 0.64 });
add('shelf', 'wash', 2.25, 0, 4.15, 0, { w: 0.5, h: 1.8, d: 0.35, color: 'f_white' });
add('towelbar', 'wash', 2.54, 1.0, 5.15, -H, { w: 0.35 });
add('ceilingLight', 'wash', 1.3, 2.3, 4.65, 0, { w: 0.35 }); add('switch', 'hall', 2.66, 1.2, 3.95, H);
// 浴室(内側 x 0.06〜1.74、z 5.46〜7.44)1618
add('unitbath', 'bath', 0.9, 0, 6.45, 0, { w: 1.6, d: 1.8 }); add('downlight', 'bath', 0.9, 2.2, 6.45, 0);
add('downlight', 'pantry', 2.2, CH, 6.45, 0);
// バルコニー
add('plant', 'bal', 8.2, 0, 8.0, 0, { w: 0.5, h: 0.9, d: 0.5 });

return { name: 'マンション 角部屋 3LDK(約75㎡)', storey: 8, camera: { x: 3.3, z: 10.1, yaw: -0.7, gy: 0 } };
