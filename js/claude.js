// Claude(Anthropic の API)で家を作る。鍵はこの端末の中(localStorage)にだけ保存し、どこにも書かない。
// 使うときだけ読み込む(ふだんのアプリの重さは変わらない)。
// 流れ:言葉・図面・写真 → Claude が「家の書き方」(builder.js の部品で書いた JS)を返す → 組み立て → 自動チェック → だめなら Claude に直させる
import { buildFromSource, audit } from './builder.js';
import { CATALOG } from './items.js';

const KEY = 'oheya-claude-key';
export const MODEL = 'claude-opus-5-5';
// 料金の目安(1M トークンあたりのドル)。表示用の概算
const PRICE = { in: 4, out: 20 }, YEN = 150;
export function getKey() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function setKey(k) { try { k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY); } catch {} }
export function hasKey() { return !!getKey(); }
export function yenOf(usage) { const u = usage || {}; return ((u.input_tokens || 0) * PRICE.in + ((u.cache_read_input_tokens || 0) * PRICE.in * 0.1) + (u.output_tokens || 0) * PRICE.out) / 1e6 * YEN; }

// Claude に送る(返事は少しずつ届く:onText で途中の文字数を知らせる)
export async function ask({ system, messages, effort = 'high', onText }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': getKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    // fallbacks:"default" … 安全のための判定で断られたときは、別のモデルで自動でやり直す
    body: JSON.stringify({ model: MODEL, max_tokens: 64000, stream: true, fallbacks: 'default', output_config: { effort }, system, messages }),
  });
  if (!res.ok) { let msg = 'HTTP ' + res.status; try { const j = await res.json(); msg = (j.error && j.error.message) || msg; } catch {} const e = new Error(msg); e.status = res.status; throw e; }
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', text = '', stop = null; const usage = {};
  for (;;) {
    const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2); const line = chunk.split('\n').find(l => l.startsWith('data:')); if (!line) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === 'message_start' && ev.message && ev.message.usage) Object.assign(usage, ev.message.usage);
      else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { text += ev.delta.text; onText && onText(text.length); }
      else if (ev.type === 'message_delta') { if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason; if (ev.usage) Object.assign(usage, ev.usage); }
      else if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'AIの返事が途中で止まりました');
    }
  }
  if (stop === 'refusal') throw new Error('この内容は、AIが作るのを断りました');
  return { text, stop, usage };
}

// 家を作るときの決まり(Claude への説明)。見本の家の書き方(demo.js)もいっしょに渡す
async function systemPrompt() {
  let example = '';
  try { const src = await (await fetch('./js/demo.js', { cache: 'no-cache' })).text(); const a = src.indexOf('export function demoProject() {') + 'export function demoProject() {'.length, b = src.lastIndexOf('return { v: 1');
    example = src.slice(a, b).split('\n').filter(l => !/^\s*(seq = 0; const FH|const rooms = \[|const items = \[\];|const add = \(type|const H = Math\.PI)/.test(l)).join('\n') + "\n  return { name: '見本の家', floorH: FH, camera: { x: 7.5, z: 7.0, yaw: Math.PI / 3.2, gy: 0 } };"; } catch {}
  const types = Object.entries(CATALOG).map(([k, v]) => `${k}(${v.name}${v.size ? ' ' + v.size.map(n => Math.round(n * 1000)).join('×') : ''}${v.styles ? ' 形 style:' + v.styles.map(t => t.id + '=' + t.name).join('/') : ''}${v.parts ? ' 部分の色 parts:' + v.parts.slice(1).map(p => p.key + '=' + p.name).join('/') : ''})`).join(', ');
  return `あなたは日本の木造住宅の一級建築士とインテリアコーディネーターです。住宅インテリアの3Dアプリ「おへや3D」の家を、決められた書き方の JavaScript で作ります。
返事は \`\`\`js で始まるコードのかたまり1つだけ。説明の文は書かない。コードは「関数の中身」だけ(import や関数の宣言は書かない)。最後に return { name, floorH: FH, camera: { x, z, yaw, gy: 0 } } を返す。

使える部品:
- 座標 x=東 z=南(z=0 が北) 単位 m。G=0.91(尺のマス) T=0.06(壁の半分) H=Math.PI/2 P=Math.PI FH=2.9(階高) W0={lib:'wp_white'}
- room(id, 名前, 階0/1, x0, z0, x1, z1, opts):壁の中心線の位置をマス数で(0.5刻み可)。部屋の内側は中心線から60mm内側。opts: floor:{lib}, walls:{0:北,1:東,2:南,3:西 の {lib}}, h(天井高 既定2.4), poly(L字など。内側の座標・時計回り), closet:'cl'|'wic'|'oshiire'|'sic'|'storage', drop:0.15 と h:2.55(玄関の土間), stair:{kind:'u_winder',style:'box',dir:'N'|'S'|'E'|'W',flip:false,finish:'wood_natural'}(階段は level 0 に1つ・2×2マス)
- link(a, 'N'|'E'|'S'|'W', b, s, w, props):a の壁に開口を作り b とつなぐ。s は開口の端(北南の壁は x、東西の壁は z の小さいほう)。props:ドア {swing:'in'|'out',hinge:'left'|'right',open}、引き戸 {style:'slide'}、戸なし {type:'open'}、収納の戸 {type:'closet',style:'fold'|'slide'|'fusuma'}(a=収納)、玄関の框 {type:'open',sill:0.15,twinSill:0,h:2.2}(a=玄関)、階段の1階の上り口 {type:'open',h:2.4}、2階の出口 {type:'open',sill:FH,twinSill:0}
- win(r, side, s, w, h, sill):外に面した壁だけ。niche(r, side, s, w, h, sill)
- add(type, roomId, x, y, z, rot, over):床の物 y=0、壁の物 y=中心の高さ、天井の物 y=天井高。rot 0=南向き P=北 H=東 -H=西。over で {w,h,d,color,opts,style,parts}。style は形(下の一覧)、parts は部分の色 {key:'#rrggbb' か 色見本の id(w_natural 木目ナチュラル・w_walnut・f_white・f_navy・s_white 白い天板・m_steel ステンレスなど)}
- beam(room, x, z, w, d, {finish:'cross'})
置ける物の種類(type): ${types}

設計の決まり:各階、外形の中にすき間を作らない(部屋・廊下・収納で埋める)。2階建ては1階と2階の外形をそろえる。収納は壁に埋め込み、となりの部屋で交互に使う形を基本に。カーテンは窓のある所だけ(中心を窓にそろえ幅は左右約150広く)。トイレの便器は入口から遠い壁、座って右にペーパーホルダー(床700)、左にタオルリング(1,100)。洗面所に洗面台・洗濯機・タオル掛け。浴室は2×2マスに unitbath。キッチンの前の通路850以上。ドアの開く範囲に家具を置かない。2階にバルコニーがなければ掃き出し窓にしない。床はフラット(段差は玄関の土間だけ)。図面や写真があれば、その寸法・配置を最優先にし、読めない所は一般的な値にする。

見本(この書き方とそっくり同じ部品を使う。補助関数の定義部分は不要):
${example}`;
}

const pickCode = t => { const m = t.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/); return (m ? m[1] : t).trim(); };

// 家を作る。files は {dataUrl, type}(画像 / PDF)。progress(文) で途中の様子を知らせる
export async function makeHouse({ text, files = [], prevSource = null, progress = () => {} }) {
  const system = await systemPrompt(); const content = [];
  for (const f of files) { const b64 = f.dataUrl.split(',')[1]; if (f.type === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }); else content.push({ type: 'image', source: { type: 'base64', media_type: f.dataUrl.slice(5, f.dataUrl.indexOf(';')), data: b64 } }); }
  content.push({ type: 'text', text: prevSource ? `今の家の書き方:\n\`\`\`js\n${prevSource}\n\`\`\`\nこれを次のように直してください:${text}` : `次の家を作ってください:${text || '(図面・写真のとおり)'}` });
  const messages = [{ role: 'user', content }]; let total = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 }; let last = null;
  for (let round = 0; round < 3; round++) {
    progress(round ? `AIが直しています(${round}回目)…` : 'AIが考えています…');
    const r = await ask({ system, messages, effort: round ? 'medium' : 'high', onText: n => progress(`AIが家を書いています… ${n.toLocaleString()}字`) });
    for (const k of Object.keys(total)) total[k] += r.usage[k] || 0; const code = pickCode(r.text);
    let project = null, problems = [];
    try { project = await buildFromSource(code); const a = audit(project); problems = [...a.curtains, ...a.doors, ...a.items, ...a.overlaps]; last = { project, audit: a, source: code }; }
    catch (e) { problems = ['組み立てられませんでした:' + e.message]; }
    if (!problems.length) return { ...last, usage: total, yen: yenOf(total) };
    progress('チェックで見つかった所を直してもらいます…');
    messages.push({ role: 'assistant', content: r.text }, { role: 'user', content: `自動チェックで次の問題が見つかりました。直した書き方を、コードのかたまり1つで返してください:\n- ${problems.slice(0, 20).join('\n- ')}` });
  }
  if (last) return { ...last, usage: total, yen: yenOf(total), warn: true };
  throw new Error('家をうまく作れませんでした。言い方を変えるか、図面を送ってみてください');
}
