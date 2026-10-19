// AI(Google Gemini)は 任意。鍵は端末の中(localStorage)にだけ保存。
import { CATALOG } from './items.js';
import { SURFACE_LIB } from './textures.js';
const KEY = 'oheya-gemini-key';
export function getKey() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function setKey(k) { try { k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY); } catch {} }
export function hasKey() { return !!getKey(); }
const MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

async function generate(parts, schemaHint) {
  let lastErr = null;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getKey() },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }) });
      if (!res.ok) { lastErr = new Error('HTTP ' + res.status); if (res.status === 404 || res.status === 400) continue; throw lastErr; }
      const j = await res.json(); const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text).join('') || '';
      const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('AIに届きませんでした');
}

// 自由な言い方の指示 → 構造化した命令
export async function aiCommand(text, app) {
  const types = Object.entries(CATALOG).map(([k, v]) => `${k}=${v.name}`).join(', ');
  const floors = SURFACE_LIB.floor.map(e => `${e.id}=${e.name}`).join(', '), walls = SURFACE_LIB.wall.map(e => `${e.id}=${e.name}`).join(', ');
  const room = app.currentRoom(); const items = app.project.items.filter(i => !room || i.roomId === room.id).map(i => i.type);
  const prompt = `あなたは3D部屋アプリの指示解釈係です。ユーザーの日本語の指示を、次のJSONの1つに変換してください。説明は不要、JSONのみ。
種類(type): ${types}
床の素材(lib): ${floors}
壁の素材(lib): ${walls}
色は #rrggbb で。
形式の例:
{"action":"add","type":"curtain","color":"#b53a3a","count":1,"where":"here|window|center|null","side":"N|E|S|W|null"}
{"action":"change","type":"curtain","color":"#..","opts":{"open":0..1,"on":true/false,"power":0.2..2},"scale":1.2}
{"action":"remove","type":"sofa"}  {"action":"removeAll","type":null}
{"action":"surface","target":"floor|wall|ceiling","spec":{"lib":"oak"} または {"color":"#fff"},"all":true/false}
{"action":"night","on":true}  {"action":"lights","on":false}  {"action":"window","side":"N"}  {"action":"door","side":"E"}
{"action":"move","type":"sofa","dir":"left|right|fwd|back|up|down|rotl","steps":3}
{"action":"info","text":"ユーザーへの短い返事(質問や雑談のとき)"}
今の部屋: ${room ? `${room.name} ${room.w}m×${room.d}m` : 'なし'}。今ある物: ${items.join(',') || 'なし'}。
指示: 「${text}」`;
  const j = await generate([{ text: prompt }]); return j && j.action ? j : null;
}

// 写真 → 部屋の見立て
export async function aiRoomFromPhoto(dataUrl) {
  const floors = SURFACE_LIB.floor.map(e => `${e.id}=${e.name}`).join(', '), walls = SURFACE_LIB.wall.map(e => `${e.id}=${e.name}`).join(', ');
  const prompt = `この室内写真から、部屋を3Dで作るための情報をJSONで推定してください。説明は不要。
{"name":"部屋の呼び名","width":横幅m(数値),"depth":奥行m,"height":天井高m,"floor":{"lib":"${'oak など'}"} ,"floorName":"床の説明","wall":{"lib":"wp_white"} または {"color":"#rrggbb"},"wallName":"壁の説明",
"windows":[{"side":"N|E|S|W","center":0..1(その壁の左からの位置の割合),"w":幅m,"h":高さm,"sill":床からの高さm}],
"backWall":[[x,y],[x,y],[x,y],[x,y]] (写真の中で正面に写っている壁の四隅 左上,右上,右下,左下 を 0..1 の割合で。壁全体が写っていなければ null),
"note":"ひとこと(日本語)"}
床の素材は ${floors} から、壁は ${walls} から選ぶか色で。正面の壁を N、右を E、左を W、手前を S とします。日本の住宅の一般的な寸法(天井2.4m前後)を参考に。`;
  const b64 = dataUrl.split(',')[1]; const mime = (dataUrl.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
  const j = await generate([{ text: prompt }, { inlineData: { mimeType: mime, data: b64 } }]);
  if (j && j.backWall && !(Array.isArray(j.backWall) && j.backWall.length === 4)) j.backWall = null; return j;
}
