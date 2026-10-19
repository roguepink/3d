// 日本語の指示 → やること(ルールで解釈。AIの鍵があれば分からないときだけAIへ)
import { typeByWord, CATALOG, catalogEntry } from './items.js';
import { colorByName, COLORS, COLOR_ALIASES, SURFACE_LIB } from './textures.js';

const z2h = s => s.replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[、。,.!！?？「」\s]/g, m => (m === '．' ? '.' : ' '));
const SIDE_WORDS = { '正面': 'front', '奥': 'front', '前の壁': 'front', '向かい': 'front', '右': 'right', '左': 'left', '後ろ': 'back', 'うしろ': 'back', '手前': 'back', '北': 'N', '南': 'S', '東': 'E', '西': 'W' };

// 見ている向きから、「右の壁」などを N/E/S/W に直す
export function relativeSide(word, app) {
  const r = SIDE_WORDS[word]; if (!r) return null; if ('NESW'.includes(r)) return r;
  const yaw = app ? app.walk.yaw : 0; const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
  const facing = Math.abs(dz) >= Math.abs(dx) ? (dz < 0 ? 'N' : 'S') : (dx > 0 ? 'E' : 'W');
  const order = ['N', 'E', 'S', 'W'], i = order.indexOf(facing);
  return { front: facing, right: order[(i + 1) % 4], back: order[(i + 2) % 4], left: order[(i + 3) % 4] }[r];
}
function findColor(t) { let best = null, bl = 0; for (const n of [...Object.keys(COLORS), ...Object.keys(COLOR_ALIASES)]) if (t.includes(n) && n.length > bl) { best = n; bl = n.length; } return best ? { name: best, hex: colorByName(best) } : null; }
function findFabric(t) { for (const [k, id] of [['レース', 'lace'], ['リネン', 'linen'], ['麻', 'linen'], ['ベルベット', 'velvet'], ['ストライプ', 'stripe'], ['しま', 'stripe'], ['縞', 'stripe'], ['チェック', 'check'], ['格子', 'check'], ['花柄', 'floral'], ['花', 'floral'], ['無地', 'plain']]) if (t.includes(k)) return id; return null; }
function findSize(t) { const m = t.match(/(\d+(?:\.\d+)?)\s*(m|メートル|cm|センチ|センチメートル)/); if (!m) return null; let v = parseFloat(m[1]); if (/cm|センチ/.test(m[2])) v /= 100; return v; }
function findCount(t) { const m = t.match(/(\d+)\s*(つ|個|こ|本|枚|台|脚|灯)/); if (m) return Math.min(12, parseInt(m[1])); for (const [w, n] of [['ひとつ', 1], ['ふたつ', 2], ['二つ', 2], ['2つ', 2], ['みっつ', 3], ['三つ', 3], ['よっつ', 4], ['四つ', 4]]) if (t.includes(w)) return n; return null; }
function findSideWord(t) { for (const w of Object.keys(SIDE_WORDS).sort((a, b) => b.length - a.length)) if (t.includes(w + 'の壁') || t.includes(w + '側') || t.includes(w + 'に') || t.includes(w + 'へ')) return w; return null; }

function floorSpec(t, color) {
  const pick = id => ({ lib: id });
  if (/ウォールナット|濃い|ダーク|こげ茶|焦げ茶/.test(t) && /フローリング|床|木/.test(t)) return pick('walnut');
  if (/白木|白いフローリング|明るいフローリング|白いゆか/.test(t)) return pick('whiteash');
  if (/ヘリンボーン/.test(t)) return pick('herring');
  if (/クッションフロア|クッション/.test(t)) return /石|ストーン/.test(t) ? pick('cf_stone') : pick('cf_wood');
  if (/フローリング|木の床|板/.test(t)) return pick('oak');
  if (/テラコッタ/.test(t)) return pick('tile_t');
  if (/タイル/.test(t)) return /グレー|灰|黒/.test(t) ? pick('tile_g') : pick('tile_w');
  if (/大理石|マーブル/.test(t)) return pick('marble');
  if (/畳|たたみ|和室/.test(t)) return pick('tatami');
  if (/カーペット|絨毯|じゅうたん/.test(t)) return color ? { lib: 'carpet_b', color: color.hex } : (/グレー|灰/.test(t) ? pick('carpet_g') : pick('carpet_b'));
  if (/モルタル|コンクリ/.test(t)) return pick('concrete');
  if (color) return { lib: 'carpet_b', color: color.hex };
  return null;
}
function wallSpec(t, color) {
  const pick = id => ({ lib: id });
  if (/白レンガ|白いレンガ/.test(t)) return pick('brick_w'); if (/レンガ|煉瓦/.test(t)) return pick('brick');
  if (/木|板|パネル|ウッド/.test(t) && !/木目調の壁紙/.test(t)) return pick('panel');
  if (/コンクリ|モルタル/.test(t)) return pick('concrete_w'); if (/漆喰|しっくい|塗り壁/.test(t)) return pick('plaster');
  if (/織物|布/.test(t)) return pick('wp_tex'); if (/ストライプ|しま|縞/.test(t)) return pick('wp_stripe'); if (/花柄|花/.test(t)) return pick('wp_floral');
  if (/ネイビー|紺/.test(t)) return pick('wp_navy'); if (/ブルーグレー|青み/.test(t)) return pick('wp_blue'); if (/グリーン|緑/.test(t) && !color) return pick('wp_green');
  if (color) return { color: color.hex };
  if (/壁紙|クロス|白/.test(t)) return pick('wp_white');
  return null;
}

export function parseCommand(raw, app) {
  const t = z2h(raw || '').trim(); if (!t) return { action: 'unknown' };
  const color = findColor(t), fabric = findFabric(t), size = findSize(t), count = findCount(t), sideWord = findSideWord(t);
  const side = sideWord ? relativeSide(sideWord, app) : null;
  const all = /全部|すべて|全て|どの壁も|全体/.test(t);

  // 使い方・モード・撮影
  if (/使い方|ヘルプ|どうやって|何ができる/.test(t)) return { action: 'help' };
  if (/^(もどして|戻して|取り消し|とりけし|やっぱりやめ|アンドゥ|さっきのをやめ|元に戻)/.test(t)) return { action: 'undo' };
  if (/一覧|リスト|寸法を(出|教え|見せ)|サイズを(出|教え|見せ)/.test(t)) return { action: 'list' };
  if (/間取り/.test(t)) return { action: 'mode', mode: 'plan' };
  if (/全体を見|上から見|俯瞰|ドールハウス/.test(t)) return { action: 'mode', mode: 'orbit' };
  if (/歩き(たい|回|まわ)|歩く|中に入/.test(t)) return { action: 'mode', mode: 'walk' };
  if (/(写真|画像|スクショ|スクリーンショット)を?(撮|とっ|取っ|保存|作)/.test(t)) return { action: 'shot' };
  // 夜・昼
  if (/夕方|夕暮れ|夕日|西日|夕焼け|サンセット/.test(t)) return { action: 'night', mode: 'evening' };
  if (/夜に|夜の|ナイト|夜景|暗くして|日が暮れ/.test(t) && !/照明|電気|ライト|明かり/.test(t)) return { action: 'night', on: true };
  if (/昼に|昼の|朝に|明るい時間|日中|昼間/.test(t)) return { action: 'night', on: false };
  if (/座っ|すわっ|ソファから|低い目線/.test(t) && /見|目線|高さ/.test(t)) return { action: 'eye', eye: 1.15 };
  if (/立っ|たっ/.test(t) && /見|目線|高さ/.test(t)) return { action: 'eye', eye: 1.5 };
  // 部屋・窓・ドア
  if (/(部屋|へや|ルーム|リビング|寝室|和室|子供部屋|キッチン|廊下|玄関|トイレ)を?(作|つく|足|たし|増や|ふや|追加)/.test(t)) {
    const m = t.match(/(\d+(?:\.\d+)?)\s*(畳|帖|じょう)/); const jo = m ? parseFloat(m[1]) : null; const name = (t.match(/(リビング|寝室|和室|子供部屋|キッチン|廊下|玄関|トイレ|ダイニング|書斎)/) || [])[1];
    const sz = jo ? (jo <= 4.5 ? { w: 2.7, d: 2.7 } : jo <= 6 ? { w: 2.7, d: 3.6 } : jo <= 8 ? { w: 3.6, d: 3.6 } : jo <= 10 ? { w: 3.6, d: 4.5 } : jo <= 12 ? { w: 3.6, d: 5.4 } : { w: 4.5, d: 6.3 }) : null;
    return { action: 'room', size: sz, name };
  }
  if (/窓を?(つけ|付け|作|つく|足|たし|追加|開け|あけ|増や)/.test(t)) return { action: 'window', side, size: size ? { w: size } : null, sill: /掃き出し|はきだし|大きい窓|大きな窓/.test(t) ? 0.3 : (/小さい|小窓/.test(t) ? 1.2 : undefined) };
  if (/(ドア|扉|とびら|出入口|入口)を?(つけ|付け|作|つく|足|たし|追加|開け|あけ|増や)/.test(t)) return { action: 'door', side, size: size ? { w: size } : null };
  // 床・壁・天井
  const surf = t.match(/^(?:(この|その|こっちの|全部の|すべての|.+?の)?)?(床|ゆか|フロア|壁|かべ|天井|てんじょう)(?:を|は|も)(.+)$/);
  if (surf) {
    const target = /床|ゆか|フロア/.test(surf[2]) ? 'floor' : /天井/.test(surf[2]) ? 'ceiling' : 'wall'; const rest = surf[3];
    const spec = target === 'floor' ? floorSpec(rest, color) : target === 'ceiling' ? (color ? { color: color.hex } : (/木|板/.test(rest) ? { lib: 'panel' } : { color: '#f7f6f2' })) : wallSpec(rest, color);
    if (spec) return { action: 'surface', target, spec, side: target === 'wall' ? (side || (surf[1] && relativeSide(surf[1].replace(/の$/, ''), app))) : null, all: all || /全部の|すべての/.test(surf[1] || ''), allRooms: /家中|家じゅう|全部の部屋|どの部屋も/.test(t) };
  }
  if (/^(床|壁|天井)/.test(t) === false && /(床|ゆか)(を|に|は).*(フローリング|タイル|畳|カーペット|クッションフロア|大理石|モルタル)/.test(t)) { const spec = floorSpec(t, color); if (spec) return { action: 'surface', target: 'floor', spec }; }

  // 照明の点け消し(「電気をつけて」)
  const genericLight = /(電気|照明|明かり|あかり|ライト)/.test(t) && !/シーリング|ペンダント|シャンデリア|ブラケット|ダウン|フロア|スタンド|壁/.test(t);
  if (genericLight && /(つけ|点け|オン|点灯)/.test(t) && app && app.project.items.some(i => catalogEntry(i.type).cat === '照明')) return { action: 'lights', on: true };
  if (genericLight && /(消|けし|オフ|消灯)/.test(t)) return { action: 'lights', on: false };

  const type = typeByWord(t);
  const addVerb = /(置い|おい|つけ|付け|入れ|いれ|欲しい|ほしい|追加|足し|たし|かけ|掛け|敷い|しい|設置|飾|かざ|吊|つる|並べ|増や|ふや|ください|下さい|して|にして|がいい|お願い)/.test(t);
  const removeVerb = /(消し|けし|なくし|無くし|外し|はずし|取っ|とっ|削除|いらない|要らない|捨て|すて|どけ|撤去|取り除|片付|かたづ)/.test(t);
  const hereWord = /ここ|この場所|そこ|こっち/.test(t);
  const where = hereWord ? 'here' : /窓/.test(t) && type !== 'curtain' && type !== 'lace' && type !== 'roller' && type !== 'blind' && type !== 'vblind' ? 'window' : /窓/.test(t) ? 'window' : /真ん中|中央|まんなか/.test(t) ? 'center' : null;

  if (type) {
    const c = CATALOG[type];
    // 消す(照明は「消す」=消灯、「外す」=撤去)
    if (removeVerb) {
      if (c.cat === '照明' && /(消し|けし|消灯|オフ)/.test(t) && !/(外し|はずし|取っ|とっ|削除|撤去|なくし|いらない)/.test(t)) return { action: 'change', type, opts: { on: false } };
      return all ? { action: 'removeAll', type } : { action: 'remove', type };
    }
    // 直す(色・生地・開け閉め・明るさ・大きさ)
    const adj = {};
    if (/開け|あけ|オープン/.test(t)) adj.open = 1; if (/閉め|しめ|閉じ|とじ/.test(t)) adj.open = 0; if (/半分/.test(t)) adj.open = 0.5;
    if (/(上げ|あげ|巻き上|巻いて)/.test(t) && ['roller', 'blind'].includes(type)) adj.down = /全部|すべて/.test(t) ? 0 : 0.3; if (/(下ろ|おろ|下げ|さげ)/.test(t) && ['roller', 'blind'].includes(type)) adj.down = 1;
    if (/(つけ|点け|点灯|オン)/.test(t) && c.cat === '照明' && app && app.project.items.some(i => i.type === type)) adj.on = true;
    let scale = null; if (/もっと大き|大きく|おおきく|広げ/.test(t)) scale = 1.25; if (/もっと小さ|小さく|ちいさく|縮め/.test(t)) scale = 0.8;
    if (/電球色|オレンジの光|あたたかい光|暖かい光/.test(t) && c.cat === '照明') adj.warm = true; if (/昼白色|白い光|白っぽい光/.test(t) && c.cat === '照明') adj.warm = false; if (/明るく|あかるく/.test(t) && c.cat === '照明') adj.power = 1.6; if (/暗く|くらく/.test(t) && c.cat === '照明') adj.power = 0.5;
    const typePos = Math.max(...c.words.filter(w => t.includes(w)).map(w => t.indexOf(w) + w.length));
    const colorAfter = color && t.indexOf(color.name) >= typePos; const fabricAfter = fabric && t.indexOf(fabric === 'lace' ? 'レース' : '') >= typePos;
    const changeVerb = /(にして|に変え|にかえ|変更|直し|なおし|したい|色を|色に|にする)/.test(t);
    if (Object.keys(adj).length || scale || ((colorAfter || (fabric && fabricAfter) || (color && changeVerb)) && !hereWord && !/(置い|おい|追加|足し|たし|敷い|吊|設置)/.test(t))) {
      return { action: 'change', type, color: color ? color.hex : null, fabric: fabric && fabric !== 'lace' ? fabric : null, opts: Object.keys(adj).length ? adj : null, scale, size: size ? { w: size } : null };
    }
    // 動かす
    const mv = t.match(/(右|左|前|奥|手前|後ろ|上|下)(?:に|へ)(?:もう少し|少し|ちょっと|もっと)?(動か|ずら|寄せ|移動|よせ|うごか)/);
    if (mv) return { action: 'move', type, dir: { '右': 'right', '左': 'left', '前': 'fwd', '奥': 'fwd', '手前': 'back', '後ろ': 'back', '上': 'up', '下': 'down' }[mv[1]], steps: /少し|ちょっと/.test(t) ? 1 : 3 };
    if (hereWord && /(動か|移動|移し|うつし|持ってき|もってき)/.test(t)) return { action: 'move', type, where: 'here' };
    // 置く
    if (addVerb || t.length <= 12) {
      const sz = size ? { w: size } : null; const over = { action: 'add', type, color: color ? color.hex : null, fabric: fabric && !(type === 'lace' && fabric === 'lace') ? fabric : null, size: sz, count, where, side };
      if (/大き(い|め|な)/.test(t) && !size) over.size = { w: c.size[0] * 1.4, h: c.size[1] * (c.kind === 'floor' ? 1 : 1.15) }; if (/小さ(い|め|な)/.test(t) && !size) over.size = { w: c.size[0] * 0.7, h: c.size[1] * (c.kind === 'floor' ? 1 : 0.85) };
      return over;
    }
  }
  // 種類なしの操作(選んでいるものに対して)
  if (removeVerb && !type) return all ? { action: 'removeAll' } : { action: 'remove' };
  const mv = t.match(/(右|左|前|奥|手前|後ろ|上|下)(?:に|へ)(?:もう少し|少し|ちょっと|もっと)?(動か|ずら|寄せ|移動|よせ|うごか)?/);
  if (mv && /(動か|ずら|寄せ|移動|よせ|うごか)/.test(t)) return { action: 'move', dir: { '右': 'right', '左': 'left', '前': 'fwd', '奥': 'fwd', '手前': 'back', '後ろ': 'back', '上': 'up', '下': 'down' }[mv[1]], steps: /少し|ちょっと/.test(t) ? 1 : 3 };
  if (color && /(にして|に変え|色)/.test(t)) return { action: 'change', color: color.hex };
  if (/大きく|おおきく/.test(t)) return { action: 'change', scale: 1.25 }; if (/小さく|ちいさく/.test(t)) return { action: 'change', scale: 0.8 };
  if (/回(し|転)/.test(t)) return { action: 'move', dir: 'rotl', steps: /少し/.test(t) ? 1 : 2 };
  return { action: 'unknown', text: t };
}
