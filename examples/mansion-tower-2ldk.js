// マンションの見本①(2026-10-28):タワーマンション 2LDK・中住戸・約69㎡・30階
// 内廊下(北)から入り、窓は南の1面だけ(床から 2.3m のハイサッシ・FIX窓)。間口 8.8m・奥行 7.9m のワイドスパン
// 窓側に 洋室1・LDK・洋室2 が並び、水まわり・収納・玄関は内側。窓側の角に 900 角の柱。窓の上は梁なし(逆梁・アウトフレーム)
// 座標はメートル(壁の中心線)で書いて、room() にはマスに直して渡す
//   x: 0      1.8 1.9 2.7    3.5     4.9      6.2 6.3          8.8
// z0   浴室        洗面          玄関    SIC        物入れ(パントリー)
// z0.9                                 トイレ
// z1.0                                           K(キッチン)
// z1.3                         廊下
// z2.4 CL1    廊下(洋室1へ)                 D
// z3.2 洋室1                    LDK
// z4.0                                           CL2
// z4.8                                           洋室2
// z7.9 ─────────────── バルコニー(奥行 1.8m・ガラスの手すり) ───────────────
const M = v => v / G;
const R = (id, name, x0, z0, x1, z1, o) => room(id, name, 0, M(x0), M(z0), M(x1), M(z1), o);
const WP = { lib: 'wp_white' }, WG = { lib: 'wp_greige' }, WALLS = (a, b, c, d) => ({ 0: a, 1: b, 2: c, 3: d });
const CH = 2.55; // 天井高(タワーマンションの居室)

// ---------- 水まわり・玄関(内側。窓なし) ----------
const bath = R('bath', '浴室', 0, 0, 1.9, 2.4, { h: 2.2, floor: { lib: 'ub_floor_g' }, ceiling: { lib: 'ub_ceil' }, walls: WALLS({ lib: 'ub_stone' }, { lib: 'ub_white' }, { lib: 'ub_white' }, { lib: 'ub_white' }), trim: { crown: { on: false }, base: { on: false }, casing: { on: false }, door: { finish: 'white' } } });
const wash = R('wash', '洗面脱衣室', 1.9, 0, 3.5, 2.4, { h: 2.3, floor: { lib: 'cf_tile_g' } });
const genkan = R('genkan', '玄関', 3.5, 0, 4.9, 1.3, { drop: 0.12, h: 2.42, floor: { lib: 'tile_k' }, walls: WALLS(WP, WP, WG, WP) });
const sic = R('sic', 'シューズクローク', 4.9, 0, 6.3, 0.9, { closet: 'sic', drop: 0.12, h: 2.42, floor: { lib: 'tile_k' } });
const wc = R('wc', 'トイレ', 4.9, 0.9, 6.3, 2.4, { h: 2.3, floor: { lib: 'cf_marble' }, walls: WALLS(WP, { lib: 'wp_dark' }, WP, WP) });
// 廊下(L字):玄関から南へ、途中で西へ曲がって洋室1へ。天井は 2.3(配管を通す下がり天井)
const hall = R('hall', '廊下', 1.8, 1.3, 4.9, 3.2, { h: 2.3, floor: { lib: 'grayoak' }, poly: [[3.56, 1.36], [4.84, 1.36], [4.84, 3.14], [1.86, 3.14], [1.86, 2.46], [3.56, 2.46]] });
const pantry = R('pantry', 'パントリー', 6.3, 0, 8.8, 1.0, { closet: 'storage', floor: { lib: 'grayoak' } });
const cl1 = R('cl1', 'クローゼット', 0, 2.4, 1.8, 3.2, { closet: 'cl', floor: { lib: 'grayoak' } });
// ---------- 窓側:洋室1・LDK・洋室2 ----------
const you1 = R('you1', '洋室1(主寝室)', 0, 3.2, 2.7, 7.9, { h: CH, floor: { lib: 'grayoak' }, walls: WALLS(WP, { lib: 'wp_blue' }, WP, WP) });
// LDK(L字):窓側のリビング・ダイニング(間口 3.4m)と、内側のキッチン(ペニンシュラ)
const ldk = R('ldk', 'LDK', 2.7, 1.0, 8.8, 7.9, { h: CH, floor: { lib: 'grayoak' }, walls: WALLS(WP, WP, WP, WG),
  poly: [[6.36, 1.06], [8.74, 1.06], [8.74, 3.94], [6.14, 3.94], [6.14, 7.84], [2.76, 7.84], [2.76, 3.26], [4.96, 3.26], [4.96, 2.46], [6.36, 2.46]] });
const cl2 = R('cl2', 'クローゼット', 6.2, 4.0, 8.8, 4.8, { closet: 'cl', floor: { lib: 'grayoak' } });
const you2 = R('you2', '洋室2', 6.2, 4.8, 8.8, 7.9, { h: CH, floor: { lib: 'grayoak' }, walls: WALLS(WP, WP, WP, WP) });
// バルコニー(奥行 1.8m・ガラスの手すり。上は上の階のバルコニー)
const bal = R('bal', 'バルコニー', 0, 7.9, 8.8, 9.7, { h: 2.5, floor: { lib: 'concrete' }, walls: WALLS({ lib: 'concrete_w' }, { lib: 'concrete_w' }, { lib: 'concrete_w' }, { lib: 'concrete_w' }), ceiling: { color: '#d9d7d2' }, outdoor: { rail: 'glass', h: 1.15 } });

// ---------- 柱・梁・下がり天井 ----------
col(you1, 0.06, 6.94, 0.9, 0.9);   // 窓側の西の角の柱(900角の出っぱり)
col(you2, 7.84, 6.94, 0.9, 0.9);   // 窓側の東の角の柱
col(bath, 0.06, 0.06, 0.45, 0.45); // 廊下側の角の柱(浴室の角。ユニットバスの外)
col(pantry, 8.29, 0.06, 0.45, 0.45);
// 戸境(となりの家との壁)に沿う大梁。窓の上には梁を出さない
beam(you1, 0.06, 3.26, 0.35, 3.68, { drop: 0.3, core: 0.35 });
beam(you2, 8.39, 4.86, 0.35, 2.08, { drop: 0.3, core: 0.35 });
soffit(ldk, 6.36, 1.06, 2.38, 2.88, 0.25);  // キッチンの上の下がり天井(換気のダクト)
soffit(ldk, 2.76, 3.26, 2.2, 0.45, 0.25);   // 廊下からLDKへ入る所の下がり天井

// ---------- 出入り口 ----------
opening(genkan, 'N', 3.8, 0.85, { style: 'steel', h: 2.0, swing: 'out', hinge: 'left', open: 0 }); // 玄関(内廊下へ)
link(genkan, 'S', hall, 3.62, 1.16, { type: 'open', sill: 0.12, twinSill: 0, h: 2.2 });            // 上がり框
link(sic, 'W', genkan, 0.12, 0.65, { type: 'open', h: 2.0 });                                     // 土間からシューズクロークへ
link(wash, 'E', hall, 1.5, 0.7, { swing: 'in', hinge: 'left', open: 0.8 });
link(bath, 'E', wash, 0.3, 0.75, { swing: 'in', hinge: 'right', open: 0.85, style: 'bath' });
link(wc, 'W', hall, 1.5, 0.7, { swing: 'in', hinge: 'right', open: 0 });
link(ldk, 'N', hall, 3.7, 0.9, { swing: 'in', hinge: 'left', open: 0.85 });
link(you1, 'N', hall, 1.9, 0.7, { swing: 'in', hinge: 'right', open: 0.85 });
link(cl1, 'S', you1, 0.12, 1.6, { type: 'closet', style: 'fold', open: 0 });
link(pantry, 'S', ldk, 6.5, 1.6, { type: 'closet', style: 'slide', open: 0 });
link(cl2, 'S', you2, 6.32, 2.36, { type: 'closet', style: 'fold', open: 0 });
link(you2, 'W', ldk, 5.0, 1.8, { style: 'slide', open: 0.5 }); // 洋室2とLDKの間は引き戸(開ければLDKが広く使える)
// ---------- 窓(南の1面だけ。床から 2.3m のハイサッシ) ----------
link(ldk, 'S', bal, 2.85, 1.6, { style: 'sash', h: 2.3, open: 0 });      // バルコニーへの掃き出し(アルミ)
link(ldk, 'S', bal, 4.5, 1.55, { type: 'window', h: 2.25, sill: 0.05, twinSill: 0.05, fix: true }); // FIX窓(はめ殺し)。バルコニー側の壁にも穴をあけるので link で書く
link(you1, 'S', bal, 1.02, 1.55, { type: 'window', h: 2.2, sill: 0.1, twinSill: 0.1 });                                    // 洋室1 のハイサッシ
link(you2, 'S', bal, 6.3, 1.5, { type: 'window', h: 2.2, sill: 0.1, twinSill: 0.1 });                                     // 洋室2 のハイサッシ

// ---------- 家具・設備 ----------
// 玄関・廊下
add('downlight', 'genkan', 4.2, 2.42, 0.65, 0); add('switch', 'genkan', 4.84, 1.2, 0.95, -H); add('intercom', 'genkan', 3.56, 1.45, 0.9, H);
add('downlight', 'sic', 5.6, 2.42, 0.45, 0);
add('downlight', 'hall', 4.2, 2.3, 1.9, 0); add('downlight', 'hall', 4.2, 2.3, 2.8, 0); add('downlight', 'hall', 2.6, 2.3, 2.8, 0);
add('wallArt', 'hall', 4.84, 1.5, 2.8, -H);
// 浴室・洗面・トイレ
add('unitbath', 'bath', 0.95, 0, 1.2, H, { w: 2.0, d: 1.6, color: '#f6f6f3' }); add('downlight', 'bath', 0.95, 2.2, 1.2, 0);
add('washstand', 'wash', 2.36, 0, 0.335, 0, { w: 0.75, style: 'three' }); add('washer', 'wash', 3.08, 0, 0.4, 0);
add('towelbar', 'wash', 3.44, 1.0, 0.75, -H, { w: 0.3 }); add('ceilingLight', 'wash', 2.7, 2.3, 1.2, 0, { w: 0.35 }); add('switch', 'wash', 3.44, 1.2, 2.3, -H);
add('toilet', 'wc', 5.89, 0, 1.65, -H, { style: 'tankless' }); add('paperholder', 'wc', 5.44, 0.7, 0.96, 0); add('towelring', 'wc', 5.6, 1.1, 2.34, P);
add('downlight', 'wc', 5.6, 2.3, 1.65, 0);
// LDK:キッチン(ペニンシュラ。人は東側に立ってダイニングを向く)
add('kitchen', 'ldk', 6.81, 0, 2.335, H, { style: 'peninsula', w: 2.55, d: 0.9 });
add('fridge', 'ldk', 8.39, 0, 1.45, -H); add('counter', 'ldk', 8.515, 0, 2.9, -H, { w: 1.6, d: 0.45, h: 0.9 });
add('downlight', 'ldk', 7.6, 2.3, 1.8, 0); add('downlight', 'ldk', 7.6, 2.3, 2.9, 0);
add('pendant', 'ldk', 4.45, CH, 4.3, 0, { color: '#2f2f33', opts: { on: true, drop: 0.75, power: 1 } });
add('table', 'ldk', 4.45, 0, 4.3, 0, { w: 1.4 });
add('chair', 'ldk', 4.1, 0, 3.75, 0); add('chair', 'ldk', 4.8, 0, 3.75, 0); add('chair', 'ldk', 4.1, 0, 4.85, P); add('chair', 'ldk', 4.8, 0, 4.85, P);
// LDK:リビング(テレビは西の壁、ソファは東を背に)
add('tvboard', 'ldk', 2.99, 0, 6.4, H, { w: 1.6 }); add('sofa', 'ldk', 5.6, 0, 6.4, -H, { color: '#8c95a3', w: 1.8 });
add('lowtable', 'ldk', 4.35, 0, 6.4, H); add('rug', 'ldk', 4.45, 0, 6.4, H, { w: 2.0, d: 1.6, color: '#bfae94' });
add('ceilingLight', 'ldk', 4.45, CH, 6.3, 0, { w: 0.6 }); add('aircon', 'ldk', 2.76, 2.25, 5.3, H);
add('monstera', 'ldk', 3.2, 0, 7.45, 0, { w: 0.8, h: 1.1, d: 0.8 });
add('curtain', 'ldk', 5.275, 1.18, 7.84, P, { w: 1.85, h: 2.34, color: '#d6d0c4', opts: { open: 0.4, lace: true } });
add('switch', 'ldk', 4.7, 1.2, 3.26, 0);
// 洋室1(主寝室)
add('bed', 'you1', 1.64, 0, 4.95, -H, { w: 1.4 }); add('chest', 'you1', 1.6, 0, 6.6, P, { w: 0.8 });
add('ceilingLight', 'you1', 1.35, CH, 5.0, 0, { w: 0.5 }); add('aircon', 'you1', 2.64, 2.25, 6.2, -H); add('switch', 'you1', 2.64, 1.2, 3.6, -H);
add('curtain', 'you1', 1.795, 1.155, 7.84, P, { w: 1.75, h: 2.3, color: '#6c7a9c', fabric: 'linen', opts: { open: 0.3, lace: true } });
add('downlight', 'cl1', 0.9, 2.4, 2.8, 0);
// 洋室2
add('bed', 'you2', 7.74, 0, 5.7, -H, { w: 0.97 }); add('desk', 'you2', 6.9, 0, 7.5, P, { w: 1.0 }); add('chair', 'you2', 6.9, 0, 6.95, 0);
add('ceilingLight', 'you2', 7.5, CH, 5.9, 0, { w: 0.45 }); add('switch', 'you2', 6.26, 1.2, 4.95, H);
add('curtain', 'you2', 7.05, 1.155, 7.84, P, { w: 1.7, h: 2.3, color: '#b9c9a5', opts: { open: 0.3, lace: true } });
add('downlight', 'cl2', 7.5, 2.4, 4.4, 0); add('downlight', 'pantry', 7.5, 2.4, 0.5, 0);
// バルコニー
add('chair', 'bal', 5.0, 0, 8.8, 0); add('chair', 'bal', 5.7, 0, 8.8, 0); add('umbellata', 'bal', 8.3, 0, 8.4, 0, { w: 0.6, h: 1.2, d: 0.6 });

return { name: 'タワーマンション 2LDK(30階・中住戸)', floorH: 2.9, storey: 30, camera: { x: 5.9, z: 3.7, yaw: 2.53, gy: 0 } };
