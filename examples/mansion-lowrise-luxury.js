// マンションの見本(2026-10-28):都内(港区・渋谷区あたり)の低層レジデンス。4階建ての3階・角住戸
// 3LDK + 書斎 + WIC + シューズクローク。間口 11.4m × 奥行 11.4m(壁芯 約130㎡)+ L字の広いテラス(南 2.7m・東 2.6m)
// 1つの階に3戸。北 = 内廊下(エレベーターホールから玄関へ。窓なし)、西 = となりの住戸との境の壁(窓なし)、南と東 = 外(窓)
// 構造:低層のラーメン構造。南と東はアウトフレーム(柱と梁をテラス側の外に出す)なので、窓の上に梁が出ない
// 座標は m(壁の中心線)。M(m) でマス数に直して room に渡す。部屋の内側は壁芯から 60mm 内側
//
//   x: 0       2.6  3.6       5.2  6.0 6.4  7.6   9.0          11.4         14.0
// z0  ┌ 浴室 ───┬WC2┬── 玄関(土間)─┬ SIC ┬── 洋室2 ────────────┐
// 1.8 │(柱をよけ │   ├──────────────┴─────┤                       │← 東の窓
// 2.1 ├ パウダー ┤   │  玄関ホール       │        ┌ CL2 ───────┤
// 2.4 │(洗面2つ) ├─廊├───────────┬───────┤廊      ├────────────┤
// 3.0 │          │ 下│           │ WC1   │下├──── 洋室3 ─ CL3 ┤
// 3.4 │          │   │   書斎    ├───────┤  │                   │← 東の窓
// 4.1 ├ WIC ─────┤   │           │パントリー│                   │
// 6.0 ├──────────┴───┼───────────┴───────┴──┴───────────────────┼──────────┐
//     │  主寝室        │  LDK(キッチン・ダイニング・リビング)    │ テラス(東)│
// 11.4└───────────────┴────────────────────────────────────────────┘           │
//     └──────────────────────── テラス(南・奥行 2.7m)─────────────────────────┘ 14.1
// 2026-10-28 専門家の見直しで直したこと:洋室3 のベッドとドア、パウダーの洗濯機、ダイニングの位置(掃き出しの前を空ける)、
//   冷蔵庫 850・アイランド上の照明・2台目のエアコン、テラスの梁(下端 2.45)と階高 3.4、柱の大きさと北の中柱、
//   来客トイレを広げ戸を東の廊下へ・手洗い、浴室を広げ引き戸に、洗面 1.8m、WIC の戸、クローゼット 2.4m、主寝室のエアコン・目隠し
const M = v => v / G;
const R = (id, name, x0, z0, x1, z1, o = {}) => room(id, name, 0, M(x0), M(z0), M(x1), M(z1), o);
const WP = { lib: 'wp_white' }, WG = { lib: 'wp_greige' }, WALLS = (a, b, c, d) => ({ 0: a, 1: b, 2: c, 3: d });
const CON = WALLS({ lib: 'concrete_w' }, { lib: 'concrete_w' }, { lib: 'concrete_w' }, { lib: 'concrete_w' });
const CH = 2.75;   // LDK の天井高
const BH = 2.6;    // 寝室・洋室の天井高
const HH = 2.4;    // 玄関ホール・廊下(下がり天井)
const MARBLE = { lib: 'marble' };

// ---------- 玄関まわり ----------
const genkan = R('genkan', '玄関(土間)', 3.6, 0, 6.0, 1.8, { drop: 0.12, h: HH + 0.12, floor: { lib: 'tile_k' }, walls: WALLS(WP, WP, WP, WG) });
const sic = R('sic', 'シューズクローク', 6.0, 0, 7.6, 1.8, { closet: 'sic', drop: 0.12, h: HH + 0.12, floor: { lib: 'tile_k' } });
// 玄関ホール(上がり框の先)+ 主寝室へ向かう廊下(西)+ 洋室2・3・LDK へ向かう廊下(東)
const hall = R('hall', '玄関ホール・廊下', 2.6, 1.8, 7.6, 6.0, { h: HH, floor: MARBLE, walls: WALLS(WP, WP, WG, WP),
  poly: [[2.66, 2.46], [3.66, 2.46], [3.66, 1.86], [7.54, 1.86], [7.54, 5.94], [6.46, 5.94], [6.46, 3.34], [3.54, 3.34], [3.54, 5.94], [2.66, 5.94]] });
const wc1 = R('wc1', 'トイレ1(来客用)', 5.2, 3.4, 6.4, 5.0, { h: 2.4, floor: MARBLE, walls: WALLS(WP, WP, { lib: 'wp_dark' }, WP) });
const pantry = R('pantry', 'パントリー', 5.2, 5.0, 6.4, 6.0, { closet: 'storage', h: 2.4 });
const study = R('study', '書斎', 3.6, 3.4, 5.2, 6.0, { h: 2.5, floor: { lib: 'walnut' }, walls: WALLS(WP, { lib: 'wp_navy' }, WP, WP) });

// ---------- 主寝室まわり(西):浴室・パウダールーム・WIC・トイレ2 ----------
const bath = R('bath', '浴室', 0, 0, 2.6, 2.1, { h: 2.3, floor: { lib: 'ub_floor_g' }, ceiling: { lib: 'ub_ceil' }, walls: WALLS({ lib: 'ub_stone' }, { lib: 'ub_white' }, { lib: 'ub_white' }, { lib: 'ub_stone' }), trim: { crown: { on: false }, base: { on: false }, casing: { on: false }, door: { finish: 'white' } } });
const powder = R('powder', 'パウダールーム', 0, 2.1, 2.6, 4.1, { h: 2.4, floor: { lib: 'stone' }, walls: WALLS(WP, WP, WP, WG) });
const wic = R('wic', 'WIC', 0, 4.1, 2.6, 6.0, { closet: 'wic', h: 2.4 });
const wc2 = R('wc2', 'トイレ2', 2.6, 0, 3.6, 2.4, { h: 2.4, floor: MARBLE, walls: WALLS(WG, WP, WP, WP) });
const master = R('master', '主寝室', 0, 6.0, 3.6, 11.4, { h: BH, floor: { lib: 'walnut' }, walls: WALLS(WP, WP, WP, WG) });

// ---------- 洋室2・洋室3(東の窓)----------
const yo2 = R('yo2', '洋室2', 7.6, 0, 11.4, 3.0, { h: BH, floor: { lib: 'oak' }, poly: [[7.66, 0.06], [11.34, 0.06], [11.34, 2.24], [8.94, 2.24], [8.94, 2.94], [7.66, 2.94]] });
const cl2 = R('cl2', 'クローゼット', 9.0, 2.3, 11.4, 3.0, { closet: 'cl', h: BH });
const cl3 = R('cl3', 'クローゼット', 9.0, 3.0, 11.4, 3.7, { closet: 'cl', h: BH });
const yo3 = R('yo3', '洋室3', 7.6, 3.0, 11.4, 6.0, { h: BH, floor: { lib: 'oak' }, walls: WALLS(WP, WP, WP, { lib: 'wp_blue' }), poly: [[7.66, 3.06], [8.94, 3.06], [8.94, 3.76], [11.34, 3.76], [11.34, 5.94], [7.66, 5.94]] });

// ---------- LDK(南東の角。南と東の2面が大きな窓)----------
const ldk = R('ldk', 'LDK', 3.6, 6.0, 11.4, 11.4, { h: CH, floor: MARBLE, walls: WALLS({ lib: 'wp_tex' }, WP, WP, WP) });

// ---------- テラス(L字。南 2.7m・東 2.6m。上は4階の床)----------
const terrace = R('terrace', 'テラス', 0, 6.0, 14.0, 14.1, { h: 3.2, floor: { lib: 'tile_g' }, walls: CON, ceiling: { color: '#dcdad5' }, outdoor: { rail: 'glass', h: 1.1 },
  poly: [[11.46, 6.06], [13.94, 6.06], [13.94, 14.04], [0.06, 14.04], [0.06, 11.46], [11.46, 11.46]] });

// ---------- 柱型・梁型・下がり天井 ----------
// 柱は住戸の角だけ。南と東の柱はアウトフレーム(テラス側の外)なので、室内の窓まわりに柱が出ない
col(bath, 0.06, 0.06, 0.6, 0.6);             // 北西の角(内廊下・戸境)。浴室は柱をよけた特注サイズ
col(sic, 6.06, 0.06, 0.6, 0.5);              // 北の中ほど(内廊下側。柱の間を 6m に)
col(yo2, 10.74, 0.06, 0.6, 0.6);             // 北東の角
col(wic, 0.06, 5.34, 0.6, 0.6);              // 西の中ほど(戸境)。WIC の中に隠す
// z 6.0 の通りの大梁は、廊下・WIC の天井(2.4)の中に納まるので見えない
col(terrace, 0.06, 11.46, 0.6, 0.7);         // 南西(アウトフレーム)
col(terrace, 3.3, 11.46, 0.6, 0.7);          // 主寝室と LDK の境(アウトフレーム)
col(terrace, 11.46, 11.46, 0.7, 0.7);        // 南東の角(アウトフレーム)
col(terrace, 11.46, 6.06, 0.7, 0.6);         // 東の中ほど(アウトフレーム)
// 梁:戸境(西)の大梁は主寝室の壁ぎわに。南・東の梁はテラス側(外)に出す
soffit(master, 0.06, 6.06, 0.6, 5.28, 0.3);   // 戸境の大梁を、ベッドの頭の上の下がり天井として見せる
beam(terrace, 0.66, 11.46, 10.8, 0.45, { drop: 0.75, core: 0.45 });
beam(terrace, 11.46, 6.66, 0.45, 4.8, { drop: 0.75, core: 0.45 });
// 下がり天井:キッチンの上(レンジフードのダクト。天井 2.4)
soffit(ldk, 3.66, 6.06, 3.3, 2.6, CH - 2.4);

// ---------- 出入り口 ----------
opening(genkan, 'N', 4.3, 1.0, { style: 'steel', h: 2.3, swing: 'out', hinge: 'left', open: 0 });     // 玄関扉(幅 1.0・高さ 2.3)
link(genkan, 'S', hall, 3.75, 2.1, { type: 'open', sill: 0.12, twinSill: 0, h: 2.3 });                // 上がり框(幅 2.1)
link(sic, 'W', genkan, 0.8, 0.8, { type: 'open', h: 2.2 });                                           // 土間からシューズクロークへ
link(sic, 'S', hall, 6.65, 0.75, { type: 'open', sill: 0.12, twinSill: 0, h: 2.2 });                  // シューズクロークからホールへ(通り抜け)
link(wc1, 'E', hall, 3.5, 0.7, { style: 'slide', open: 0, h: 2.3 });   // 戸は東の廊下側(玄関から見えない)
link(study, 'W', hall, 3.6, 0.75, { swing: 'in', hinge: 'left', open: 0 });
link(wc2, 'S', hall, 2.75, 0.7, { style: 'slide', open: 0, h: 2.3 });
link(powder, 'E', hall, 3.25, 0.75, { style: 'slide', open: 0, h: 2.3 });
link(bath, 'S', powder, 0.75, 0.8, { style: 'slide', open: 0 });   // 浴室は引き戸
link(powder, 'S', wic, 1.75, 0.75, { style: 'slide', open: 0, h: 2.3 });                                       // パウダー ↔ WIC(通り抜け)
link(wic, 'S', master, 0.75, 0.8, { style: 'slide', open: 0, h: 2.3 });                                        // WIC ↔ 主寝室
link(master, 'N', hall, 2.7, 0.8, { swing: 'in', hinge: 'right', open: 0, h: 2.3 });
link(yo2, 'W', hall, 2.12, 0.75, { swing: 'in', hinge: 'left', open: 0, h: 2.3 });
link(yo3, 'W', hall, 5.12, 0.75, { swing: 'in', hinge: 'right', open: 0, h: 2.3 });
link(cl2, 'N', yo2, 9.15, 2.1, { type: 'closet', style: 'fold', open: 0 });
link(cl3, 'S', yo3, 9.15, 2.1, { type: 'closet', style: 'fold', open: 0 });
link(pantry, 'S', ldk, 5.5, 0.8, { type: 'closet', style: 'slide', open: 0 });
link(ldk, 'N', hall, 6.6, 0.85, { style: 'slide', open: 0.6, h: 2.3 });              // 廊下の突き当たりから LDK へ(引き戸)                   // 廊下の突き当たりから LDK へ
// ---------- 窓(南と東。床から 2.4m のハイサッシと FIX)----------
link(ldk, 'S', terrace, 3.85, 1.2, { type: 'window', h: 2.35, sill: 0.05, twinSill: 0.05, fix: true });
link(ldk, 'S', terrace, 5.15, 2.4, { style: 'sash', h: 2.4, open: 0 });                               // ダイニングからテラスへ
link(ldk, 'S', terrace, 7.75, 1.7, { type: 'window', h: 2.35, sill: 0.05, twinSill: 0.05, fix: true });
link(ldk, 'S', terrace, 9.55, 1.65, { type: 'window', h: 2.35, sill: 0.05, twinSill: 0.05, fix: true });
link(ldk, 'E', terrace, 6.6, 1.8, { style: 'sash', h: 2.4, open: 0 });                                // リビングから東のテラスへ
link(ldk, 'E', terrace, 8.55, 1.6, { type: 'window', h: 2.35, sill: 0.05, twinSill: 0.05, fix: true });
link(ldk, 'E', terrace, 10.25, 0.95, { type: 'window', h: 2.35, sill: 0.05, twinSill: 0.05, fix: true });
link(master, 'S', terrace, 0.8, 2.2, { style: 'sash', h: 2.4, open: 0 });
win(yo2, 'E', 0.75, 1.4, 2.0, 0.4);
win(yo3, 'E', 3.85, 1.5, 2.0, 0.4);

// ---------- 家具・設備 ----------
// 玄関・シューズクローク・ホール
add('downlight', 'genkan', 4.8, HH + 0.12, 0.9, 0); add('downlight', 'genkan', 4.0, HH + 0.12, 0.9, 0);
add('mirror', 'genkan', 3.66, 1.3, 0.9, H, { w: 0.5, h: 1.4 });
add('chair', 'genkan', 3.95, 0, 0.55, 0, { style: 'stool', color: '#3d3a36' });   // 靴をはくときのベンチ代わり
add('downlight', 'sic', 6.8, HH + 0.12, 0.9, 0);
add('counter', 'hall', 4.8, 0, 3.115, P, { w: 1.2, d: 0.45, h: 0.85, color: 'w_walnut' });  // 正面の飾り台
add('wallArt', 'hall', 4.8, 1.55, 3.34, P, { w: 0.9, h: 0.6 });
add('wallLight', 'hall', 4.0, 1.9, 3.34, P); add('wallLight', 'hall', 6.0, 1.9, 3.34, P);
add('downlight', 'hall', 4.4, HH, 2.6, 0); add('downlight', 'hall', 6.2, HH, 2.6, 0); add('downlight', 'hall', 7.0, HH, 3.6, 0); add('downlight', 'hall', 7.0, HH, 5.0, 0);
add('downlight', 'hall', 3.1, HH, 3.4, 0); add('downlight', 'hall', 3.1, HH, 5.0, 0); add('smoke', 'hall', 7.0, HH, 4.3, 0);
add('switch', 'hall', 3.66, 1.2, 2.1, H);
add('picture', 'hall', 7.54, 1.5, 4.25, -H, { w: 0.5, h: 0.7 });
// トイレ1(来客用。内側 x 5.26〜6.34、z 3.46〜4.94)。便器は南の壁を背に北向き。座って右(東)にペーパー、左(西)にタオルリング
add('toilet', 'wc1', 5.9, 0, 4.59, P, { style: 'tankless' });
add('paperholder', 'wc1', 6.34, 0.7, 4.0, -H); add('towelring', 'wc1', 5.26, 1.1, 4.0, H);
add('counter', 'wc1', 5.8, 0, 3.6, 0, { w: 0.8, d: 0.25, h: 0.8, color: 'w_walnut' });   // 手洗いカウンター(奥行 250)
add('downlight', 'wc1', 5.9, 2.4, 4.2, 0);
add('downlight', 'pantry', 5.9, 2.4, 5.5, 0);
// 書斎(内側 x 3.66〜5.34、z 3.46〜5.94)
add('desk', 'study', 4.4, 0, 5.64, P, { w: 1.3, d: 0.6, color: 'w_walnut' });
add('chair', 'study', 4.4, 0, 5.0, 0, { style: 'office' });
add('shelf', 'study', 4.99, 0, 4.1, -H, { w: 1.0, h: 2.1, d: 0.3, color: 'w_walnut' });
add('books', 'study', 4.99, 1.05, 4.1, -H);
add('ventfan', 'study', 4.4, 2.45, 3.46, 0);
add('deskLamp', 'study', 4.0, 0.72, 5.7, P);
add('downlight', 'study', 4.4, 2.5, 4.2, 0); add('downlight', 'study', 4.4, 2.5, 5.2, 0); add('switch', 'study', 3.66, 1.2, 4.5, H);
// トイレ2(内側 x 2.66〜3.54、z 0.06〜2.34)。便器は北の壁を背に南向き。座って右(西)にペーパー、左(東)にタオルリング
add('toilet', 'wc2', 3.1, 0, 0.41, 0, { style: 'tankless' });
add('paperholder', 'wc2', 2.66, 0.7, 1.0, H); add('towelring', 'wc2', 3.54, 1.1, 1.0, -H);
add('downlight', 'wc2', 3.1, 2.4, 1.0, 0);
// 浴室(内側 x 0.06〜2.54、z 0.06〜2.04。北西の角に柱)
add('unitbath', 'bath', 1.6, 0, 1.05, 0, { w: 1.86, d: 1.96, color: '#f4f2ee' }); add('downlight', 'bath', 1.6, 2.3, 1.05, 0);
// パウダールーム(内側 x 0.06〜2.54、z 2.16〜4.04)。西の壁に洗面ボウル2つのカウンター(幅 1.8)
add('washstand', 'powder', 0.31, 0, 3.1, H, { style: 'counter', w: 1.8, d: 0.5 });
add('washer', 'powder', 2.17, 0, 2.53, 0, { w: 0.64, d: 0.64 });
add('towelbar', 'powder', 2.54, 1.0, 3.0, -H, { w: 0.4 });
add('downlight', 'powder', 1.2, 2.4, 2.7, 0); add('downlight', 'powder', 1.2, 2.4, 3.5, 0);
// WIC
add('downlight', 'wic', 1.3, 2.4, 5.05, 0);
// 主寝室(内側 x 0.06〜3.54、z 6.06〜11.34)。ベッドの頭は戸境の壁(西)
add('bed', 'master', 1.21, 0, 8.7, H, { w: 1.8, d: 2.1, color: '#ece6da', parts: { frame: 'w_walnut' } });
add('chest', 'master', 0.31, 0, 7.35, H, { w: 0.5, h: 0.55, d: 0.42, color: 'w_walnut' });
add('chest', 'master', 0.31, 0, 10.05, H, { w: 0.5, h: 0.55, d: 0.42, color: 'w_walnut' });
add('wallLight', 'master', 0.06, 1.2, 7.35, H); add('wallLight', 'master', 0.06, 1.2, 10.05, H);
add('rug', 'master', 1.6, 0, 8.7, H, { w: 2.6, d: 2.3, color: '#cfc4b2' });
add('sofa', 'master', 3.0, 0, 7.9, -H, { style: 'one', w: 0.85, d: 0.85, color: '#9a8f80' });
add('floorLamp', 'master', 3.25, 0, 7.15, 0);
add('aircon', 'master', 1.9, 2.25, 6.06, 0);   // 風がベッドに直接当たらない北の壁
add('downlight', 'master', 1.8, BH, 7.0, 0); add('downlight', 'master', 2.6, BH, 8.7, 0); add('downlight', 'master', 1.8, BH, 10.4, 0);
add('switch', 'master', 3.4, 1.2, 6.06, 0); add('smoke', 'master', 2.2, BH, 8.0, 0);
add('curtain', 'master', 1.9, 1.255, 11.34, P, { fit: true, w: 2.5, h: 2.49, color: '#8a8478', fabric: 'linen', opts: { mount: 'ceiling', open: 0.35, lace: true } });
// 洋室2(内側 x 7.66〜11.34、z 0.06〜2.94)
add('bed', 'yo2', 8.15, 0, 1.06, 0, { w: 0.97, d: 2.0 });
add('desk', 'yo2', 9.7, 0, 0.36, 0, { w: 1.0 });
add('chair', 'yo2', 9.7, 0, 0.9, P);
add('ceilingLight', 'yo2', 9.4, BH, 1.4, 0, { w: 0.45 }); add('aircon', 'yo2', 9.4, 2.25, 0.06, 0);
add('switch', 'yo2', 7.66, 1.2, 2.85, H); add('smoke', 'yo2', 9.4, BH, 1.0, 0);
add('curtain', 'yo2', 11.34, 1.255, 1.45, -H, { fit: true, w: 1.7, h: 2.49, color: '#b9c9a5', opts: { mount: 'ceiling', open: 0.3, lace: true } });
add('downlight', 'cl2', 10.2, BH, 2.65, 0);
// 洋室3(内側 x 7.66〜11.34、z 3.76〜5.94)
add('bed', 'yo3', 8.2, 0, 4.06, 0, { w: 0.97, d: 2.0 });
add('desk', 'yo3', 10.2, 0, 5.64, P, { w: 1.0 });
add('chair', 'yo3', 10.2, 0, 5.1, 0);
add('ceilingLight', 'yo3', 9.4, BH, 4.7, 0, { w: 0.45 }); add('aircon', 'yo3', 7.66, 2.25, 4.0, H);
add('switch', 'yo3', 7.66, 1.2, 5.75, H); add('smoke', 'yo3', 9.4, BH, 5.4, 0);
add('curtain', 'yo3', 11.34, 1.255, 4.6, -H, { fit: true, w: 1.8, h: 2.49, color: '#c9b9a0', opts: { mount: 'ceiling', open: 0.3, lace: true } });
add('downlight', 'cl3', 10.2, BH, 3.4, 0);
// LDK(内側 x 3.66〜11.34、z 6.06〜11.34)
// キッチン:北の壁に冷蔵庫と背面収納、前にアイランド(人は北側に立って南のダイニングを向く)
add('fridge', 'ldk', 4.105, 0, 6.41, 0, { w: 0.85, d: 0.7 });
add('counter', 'ldk', 4.85, 0, 6.36, 0, { w: 0.6, d: 0.6, h: 0.9, color: 'w_walnut' });
add('kitchen', 'ldk', 5.625, 0, 8.135, P, { style: 'island', w: 2.25, d: 0.95, parts: { door: 'w_walnut', top: 's_marble' } });
add('downlight', 'ldk', 4.4, 2.4, 7.1, 0); add('downlight', 'ldk', 5.6, 2.4, 7.1, 0); add('downlight', 'ldk', 6.6, 2.4, 7.1, 0);
add('downlight', 'ldk', 4.9, 2.4, 8.13, 0); add('downlight', 'ldk', 5.6, 2.4, 8.13, 0); add('downlight', 'ldk', 6.3, 2.4, 8.13, 0);
// ダイニング(テーブル 1.8m・6人。テラスへの掃き出しの前は通り道として空ける)
add('table', 'ldk', 4.85, 0, 10.2, 0, { w: 1.8, d: 0.9, color: 'w_walnut', opts: { chairs: 6 } });
add('pendant', 'ldk', 4.45, CH, 10.2, 0, { w: 0.3, color: '#b89a5e', opts: { on: true, drop: 0.95, power: 1 } });
add('pendant', 'ldk', 5.25, CH, 10.2, 0, { w: 0.3, color: '#b89a5e', opts: { on: true, drop: 0.95, power: 1 } });
add('wallArt', 'ldk', 3.66, 1.5, 9.9, H, { w: 1.0, h: 0.7 });
// リビング(テレビは北の壁、L字ソファは南を背に)
add('tvboard', 'ldk', 9.5, 0, 6.26, 0, { w: 2.2, d: 0.4, color: 'w_walnut' });
add('sofa', 'ldk', 9.45, 0, 9.35, P, { style: 'couch', w: 2.8, d: 1.6, color: '#d5cfc3', parts: { cushion: '#8a7f70', legs: 'm_black' } });
add('lowtable', 'ldk', 9.45, 0, 7.95, 0, { w: 1.2, d: 0.6, color: 's_marble' });
add('rug', 'ldk', 9.45, 0, 8.4, 0, { w: 3.0, d: 2.4, color: '#c9bca6' });
add('floorLamp', 'ldk', 11.05, 0, 6.35, 0);
add('strelitzia', 'ldk', 11.0, 0, 10.95, 0, { w: 0.7, h: 1.7, d: 0.7 });
add('downlight', 'ldk', 8.6, CH, 7.4, 0); add('downlight', 'ldk', 10.3, CH, 7.4, 0); add('downlight', 'ldk', 8.6, CH, 10.4, 0); add('downlight', 'ldk', 10.3, CH, 10.4, 0);
add('aircon', 'ldk', 7.66, CH - 0.45, 6.06, 0); add('cassette2', 'ldk', 10.3, CH, 10.4, 0);
add('intercom', 'ldk', 7.6, 1.45, 6.06, 0); add('switch', 'ldk', 7.55, 1.2, 6.06, 0); add('smoke', 'ldk', 8.0, CH, 9.0, 0);
// カーテン(ハイサッシと FIX:床+10 〜 窓の上+100)
const CUR = { color: '#e3ddd1', fabric: 'linen', opts: { open: 0.75, lace: true } };
add('curtain', 'ldk', 4.45, 1.255, 11.34, P, { fit: true, w: 1.5, h: 2.49, ...CUR , opts: { mount: 'ceiling' } });
add('curtain', 'ldk', 6.35, 1.255, 11.34, P, { fit: true, w: 2.7, h: 2.49, ...CUR , opts: { mount: 'ceiling' } });
add('curtain', 'ldk', 8.6, 1.255, 11.34, P, { fit: true, w: 2.0, h: 2.49, ...CUR , opts: { mount: 'ceiling' } });
add('curtain', 'ldk', 10.375, 1.255, 11.34, P, { fit: true, w: 1.9, h: 2.49, ...CUR , opts: { mount: 'ceiling' } });
add('curtain', 'ldk', 11.34, 1.255, 7.5, -H, { fit: true, w: 2.1, h: 2.49, ...CUR , opts: { mount: 'ceiling' } });
add('curtain', 'ldk', 11.34, 1.255, 9.35, -H, { fit: true, w: 1.9, h: 2.49, ...CUR , opts: { mount: 'ceiling' } });
add('curtain', 'ldk', 11.34, 1.255, 10.725, -H, { fit: true, w: 1.2, h: 2.49, ...CUR , opts: { mount: 'ceiling' } });
// テラス
add('table', 'terrace', 8.6, 0, 12.75, 0, { w: 1.4, d: 0.8, color: 'w_gray', opts: { chairs: 4 } });
add('sofa', 'terrace', 12.7, 0, 9.0, -H, { style: 'two', w: 1.5, d: 0.8, color: '#e0dbd2', parts: { cushion: '#7a8a7a' } });
add('olive', 'terrace', 13.5, 0, 13.6, 0, { w: 0.8, h: 1.8, d: 0.8 });
add('olive', 'terrace', 13.5, 0, 6.6, 0, { w: 0.7, h: 1.5, d: 0.7 });
add('umbellata', 'terrace', 1.0, 0, 13.6, 0, { w: 0.7, h: 1.5, d: 0.7 });
add('umbellata', 'terrace', 3.6, 0, 12.7, 0, { w: 0.9, h: 1.9, d: 0.9 });   // 主寝室とリビングの間の目隠し
add('plant', 'terrace', 5.0, 0, 13.7, 0, { w: 0.5, h: 0.8, d: 0.5 });

return { name: '都内の低層レジデンス 3LDK+書斎(3階・角住戸・約130㎡)', floorH: 3.4, storey: 3, camera: { x: 7.1, z: 6.7, yaw: -2.5, gy: 0 } };
