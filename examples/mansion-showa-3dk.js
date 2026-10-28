// マンションの見本②(2026-10-28):昭和の古いマンション 3DK・中住戸・約60㎡・5階(築45年くらい)
// 北の共用廊下に鉄の玄関扉と面格子の小窓。南に和室2つ(続き間・襖)とバルコニー(コンクリートの手すり壁)
// 水まわり(浴室・洗面・トイレ)は床が 150 高い。部屋の中に大きな梁、天井は低め 2.3〜2.35m
// 座標はメートル(壁の中心線)で書いて、room() にはマスに直して渡す
//   x: 0        1.8  2.8   4.0  4.8 4.9          6.6
// z0   洋室            玄関  MB·PS   浴室
// z1.2                         トイレ
// z1.4                 廊下
// z1.7                               洗面
// z2.9 物入れ  DK(ダイニングキッチン)
// z3.7         DK
// z4.7 押入れA  DK             押入れB
// z5.5 和室A(寝室)    │襖│ 和室B(居間)
// z9.1 ───────── バルコニー(奥行 1.2m・コンクリートの手すり壁)─────────
const M = v => v / G;
const R = (id, name, x0, z0, x1, z1, o) => room(id, name, 0, M(x0), M(z0), M(x1), M(z1), o);
const A4 = l => ({ 0: { lib: l }, 1: { lib: l }, 2: { lib: l }, 3: { lib: l } });
const WA = { wood: 'wood_medium' }, SAO = { lib: 'sao', tone: 'ame', grain: 'itame' };
const OLDCEIL = { color: '#eee8da' }; // 昭和の化粧石膏ボード(少し黄ばんだ白)

// ---------- 北(共用廊下側) ----------
const you = R('you', '洋室(4.5畳)', 0, 0, 2.8, 2.9, { h: 2.35, floor: { lib: 'carpet_b' }, walls: A4('wp_beige'), ceiling: OLDCEIL });
const genkan = R('genkan', '玄関', 2.8, 0, 4.0, 1.4, { drop: 0.15, h: 2.5, floor: { lib: 'tile_g' }, walls: A4('wp_beige'), ceiling: OLDCEIL });
const mb = R('mb', 'MB', 4.0, 0, 4.9, 1.2, { closet: 'storage', h: 2.35, floor: { lib: 'concrete' }, walls: A4('concrete_w') }); // 共用廊下から開ける
const hall = R('hall', '廊下', 2.8, 1.4, 4.0, 2.9, { h: 2.35, floor: { lib: 'cf_wood' }, walls: A4('wp_beige'), ceiling: OLDCEIL });
// 水まわり:床を 150 上げる(下に配管を通すため。昭和のマンションによくある段差)
const wc = R('wc', 'トイレ', 4.0, 1.2, 4.9, 2.9, { drop: -0.15, h: 2.1, floor: { lib: 'cf_tile' }, walls: A4('wp_white'), ceiling: OLDCEIL });
const bath = R('bath', '浴室', 4.9, 0, 6.6, 1.7, { drop: -0.15, h: 2.1, floor: { lib: 'cf_hex' }, walls: A4('ub_beige'), ceiling: { lib: 'ub_ceil' }, trim: { crown: { on: false }, base: { on: false }, casing: { on: false }, door: { finish: 'white' } } });
const wash = R('wash', '洗面所', 4.9, 1.7, 6.6, 2.9, { drop: -0.15, h: 2.1, floor: { lib: 'cf_tile' }, walls: A4('wp_white'), ceiling: OLDCEIL });
const ycl = R('ycl', '物入れ', 0, 2.9, 1.8, 3.7, { closet: 'cl', floor: { lib: 'plywood' } });
// ---------- 真ん中:DK(窓のない、昔ながらのダイニングキッチン)と押入れ ----------
const dk = R('dk', 'DK(ダイニングキッチン)', 0, 2.9, 6.6, 5.5, { h: 2.35, floor: { lib: 'cf_wood' }, walls: A4('wp_beige'), ceiling: OLDCEIL,
  poly: [[1.86, 2.96], [6.54, 2.96], [6.54, 4.54], [4.74, 4.54], [4.74, 5.44], [1.86, 5.44], [1.86, 4.54], [0.06, 4.54], [0.06, 3.76], [1.86, 3.76]] });
const oshA = R('oshA', '押入れ', 0, 4.6, 1.8, 5.5, { closet: 'oshiire', floor: { lib: 'plywood' } });
const oshB = R('oshB', '押入れ', 4.8, 4.6, 6.6, 5.5, { closet: 'oshiire', floor: { lib: 'plywood' } });
// ---------- 南:和室2つ(続き間) ----------
const waA = R('waA', '和室(寝室)', 0, 5.5, 3.3, 9.1, { h: 2.3, floor: { lib: 'tatami_old' }, walls: A4('sunakabe_b'), ceiling: SAO, wa: WA });
const waB = R('waB', '和室(居間)', 3.3, 5.5, 6.6, 9.1, { h: 2.3, floor: { lib: 'tatami_old' }, walls: A4('sunakabe_g'), ceiling: SAO, wa: WA });
const bal = R('bal', 'バルコニー', 0, 9.1, 6.6, 10.3, { h: 2.4, floor: { lib: 'concrete' }, walls: A4('concrete_w'), ceiling: { color: '#d4d0c8' }, outdoor: { rail: 'concrete', h: 1.1 } });

// ---------- 柱・梁 ----------
col(waA, 0.06, 8.39, 0.35, 0.65);  // 南の角の柱(700角くらい。となりの家との境にまたがるので、室内に出るのは半分)
col(waB, 6.19, 8.39, 0.35, 0.65);
col(you, 0.06, 0.06, 0.35, 0.6);   // 北の角の柱
col(bath, 6.19, 0.06, 0.35, 0.6);  // 北東の角の柱
col(oshA, 0.06, 4.66, 0.35, 0.6); col(oshB, 6.19, 4.66, 0.35, 0.6); // 真ん中の柱(押入れの中)
// 大きな梁:真ん中の柱を結ぶ東西の梁(DK)、和室どうしの境(襖の上。下端 1.8 で鴨居の高さとそろう)、洋室の南
beam(dk, 1.86, 4.54, 2.88, 0.4, { drop: 0.5, core: 0.4 }); // 真ん中の柱どうしをつなぐ東西の大梁(DK の南を横切る。下端 1.85)
soffit(dk, 4.55, 2.96, 0.5, 0.45, 0.25); // レンジフードのダクトを北へ通す下がり天井
beam(waB, 3.36, 5.56, 0.3, 3.48, { drop: 0.5, core: 0.3, cross: { lib: 'sunakabe_g' } });
beam(you, 0.06, 2.44, 2.68, 0.4, { drop: 0.45, core: 0.4, cross: { lib: 'wp_beige' } }); // 洋室の南の梁(物入れの上)

// ---------- 出入り口 ----------
opening(genkan, 'N', 3.0, 0.8, { style: 'steel', h: 1.85, swing: 'out', hinge: 'right', open: 0 }); // 鉄の玄関扉(共用廊下へ)
link(genkan, 'S', hall, 2.92, 0.96, { type: 'open', sill: 0.15, twinSill: 0, h: 2.0 });           // 上がり框
opening(mb, 'N', 4.15, 0.6, { style: 'steel', h: 1.7, swing: 'out', hinge: 'left', open: 0 });       // MB の鉄扉(共用廊下側)
link(you, 'E', hall, 1.7, 0.75, { swing: 'in', hinge: 'right', open: 0.8 });
link(wc, 'W', hall, 1.55, 0.6, { swing: 'out', hinge: 'left', open: 0, sill: 0, twinSill: 0.15, h: 1.75 }); // トイレの戸(床が 150 高い)
link(hall, 'S', dk, 2.95, 0.8, { style: 'glassdoor', h: 1.9, open: 0.5 });                          // 廊下と DK の間のガラス戸
link(wash, 'S', dk, 5.85, 0.65, { style: 'slide', open: 0, sill: 0, twinSill: 0.15, h: 1.75 });     // 洗面所の引き戸(床が 150 高い)
link(bath, 'S', wash, 5.6, 0.65, { swing: 'in', hinge: 'left', open: 0.7, style: 'bath', h: 1.6 }); // 浴室の戸(浴室の床から)
link(ycl, 'N', you, 0.15, 1.5, { type: 'closet', style: 'slide', open: 0 });
link(oshA, 'S', waA, 0.12, 1.56, { type: 'closet', style: 'fusuma', h: 1.8, open: 0 });
link(oshB, 'S', waB, 4.92, 1.56, { type: 'closet', style: 'fusuma', h: 1.8, open: 0 });
link(dk, 'S', waA, 1.95, 1.2, { style: 'fusuma', h: 1.8, open: 0 });       // DK と和室(寝室)の襖
link(dk, 'S', waB, 3.45, 1.2, { style: 'fusuma', h: 1.8, open: 1 });       // DK と和室(居間)の襖(開けてある)
link(waA, 'E', waB, 5.7, 3.2, { style: 'fusuma', h: 1.8, panels: 4, open: 0 }); // 和室どうしの4枚襖
// ---------- 窓 ----------
win(you, 'N', 0.8, 1.6, 1.1, 0.9, { grille: true });   // 洋室の窓(共用廊下側・面格子)
win(bath, 'N', 5.3, 0.7, 0.6, 1.2, { grille: true });  // 浴室の小窓(共用廊下側・面格子)
link(waA, 'S', bal, 1.0, 1.8, { style: 'sash', h: 1.68, sill: 0.12, twinSill: 0.12, open: 0.3 });  // 和室からバルコニーへ(アルミの掃き出し)
link(waB, 'S', bal, 3.7, 1.8, { style: 'sash', h: 1.68, sill: 0.12, twinSill: 0.12, open: 0 }); // 昭和のサッシは内側に 120 の立ち上がり

// ---------- 家具・設備(昭和の暮らし) ----------
// 玄関・廊下
add('shoebox', 'genkan', 3.765, 0, 0.85, -H, { w: 0.9, d: 0.35, h: 0.9, color: '#8a6038', opts: { tall: false } }); add('hakimono', 'genkan', 3.2, 0, 0.75, P, { style: 'sandal' }); add('kasatate', 'genkan', 3.0, 0, 1.15, 0, { style: 'tsubo' });
add('walight', 'genkan', 3.4, 2.5, 0.7, 0, { style: 'hadaka' }); add('switch', 'hall', 2.86, 1.2, 1.55, H);
add('walight', 'hall', 3.4, 2.35, 2.2, 0, { style: 'hadaka' }); add('calendar', 'hall', 3.94, 1.4, 1.9, -H);
// 洋室(4.5畳:子ども部屋)
add('bed', 'you', 1.45, 0, 0.6, H, { w: 0.97 }); add('chest', 'you', 0.29, 0, 2.0, H, { w: 0.8 });
add('ceilingLight', 'you', 1.4, 2.35, 1.5, 0, { w: 0.45 }); add('radio', 'you', 2.5, 0.9, 0.5, -H);
add('curtain', 'you', 1.6, 1.375, 0.06, 0, { fit: true, w: 1.9, h: 1.35, color: '#c9a77a', fabric: 'check', opts: { mount: 'ceiling', open: 0.3 } });
// DK:壁付けの古いキッチン(扉は木目・天板はステンレス・高さ 800)と、食卓
add('kitchen', 'dk', 4.8, 0, 3.285, 0, { w: 2.1, h: 0.8, parts: { door: 'w_medium', top: 'm_steel' }, opts: { hood: true, wall: true } });
add('fridge', 'dk', 6.215, 0, 3.9, -H, { w: 0.6, color: '#e8e2cf' });
add('table', 'dk', 3.3, 0, 4.25, 0, { w: 1.2, d: 0.75, color: '#8a6038' });
add('chair', 'dk', 2.95, 0, 3.75, 0); add('chair', 'dk', 3.65, 0, 3.75, 0); add('chair', 'dk', 2.95, 0, 4.8, P); add('chair', 'dk', 3.65, 0, 4.8, P);
add('tansu', 'dk', 0.9, 0, 3.97, 0, { style: 'cha' }); add('denwa', 'dk', 1.65, 0, 4.4, -H, { style: 'dai' });
add('walight', 'dk', 3.3, 2.35, 4.2, 0, { style: 'keikou' }); add('hashiradokei', 'dk', 1.86, 1.75, 3.3, H, { style: 'maru' });
add('wakomono', 'dk', 3.3, 0.72, 4.25, 0, { style: 'kyusu' });
// 和室(寝室):布団・鏡台・整理だんす
add('wafuton', 'waA', 1.5, 0, 7.3, 0, { style: 'shiku' }); add('kyoudai', 'waA', 0.3, 0, 6.3, H, { style: 'sanmen' });
add('tansu', 'waA', 0.26, 0, 7.6, H, { style: 'seiri' }); add('walight', 'waA', 1.65, 2.3, 7.3, 0, { style: 'washi' });
// 和室(居間):ちゃぶ台・座布団・家具調テレビ・石油ストーブ・仏壇
add('chabudai', 'waB', 4.8, 0, 7.1, 0, { style: 'round' });
add('zabuton', 'waB', 4.8, 0, 6.45, 0, { style: 'kon' }); add('zabuton', 'waB', 4.15, 0, 7.1, 0, { style: 'gara' }); add('zabuton', 'waB', 5.45, 0, 7.1, 0, { style: 'murasaki' });
add('kaguTV', 'waB', 6.24, 0, 7.2, -H, { style: 'ashi' }); add('stove', 'waB', 5.9, 0, 8.1, 0, { style: 'hansha' });
add('wakomono', 'waB', 4.8, 0.33, 7.1, 0, { style: 'kyusu' });
add('walight', 'waB', 4.95, 2.3, 7.3, 0, { style: 'keikou' }); add('calendar', 'waB', 3.36, 1.4, 6.0, H);
// トイレ(和式)・洗面所・浴室(在来:タイルの床に置き型の浴槽)
add('toilet', 'wc', 4.45, 0, 2.465, P, { style: 'tank', parts: { body: 'c_ivory' } }); add('paperholder', 'wc', 4.84, 0.7, 1.99, -H); // 1980年ごろの洋式(アイボリー)。背中を南の壁に
add('walight', 'wc', 4.45, 2.1, 2.0, 0, { style: 'hadaka' });
add('washstand', 'wash', 5.235, 0, 2.3, H, { w: 0.6, style: 'one' }); add('towelbar', 'wash', 6.54, 1.0, 2.3, -H, { w: 0.3 });
add('bathtub', 'bath', 5.58, 0, 0.44, 0, { w: 1.2, d: 0.75, color: '#a9c9c4' }); add('ceilingLight', 'bath', 5.6, 2.1, 1.0, 0, { w: 0.3 });
// バルコニー:洗濯機はバルコニー(昭和のマンションの定番)
add('washer', 'bal', 0.5, 0, 9.6, 0); add('umbellata', 'bal', 6.1, 0, 9.6, 0, { w: 0.5, h: 0.8, d: 0.5 });

return { name: '昭和のマンション 3DK(5階・中住戸)', floorH: 2.7, storey: 5, camera: { x: 2.4, z: 3.3, yaw: -2.59, gy: 0 } };
