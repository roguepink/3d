// 家のデータをリンクにする / リンクから開く
// 形式:https://roguepink.github.io/3d/#p=<データ>
//   データ = 家の JSON を deflate-raw で縮めて、base64url(+ → -、/ → _、= なし)にしたもの
// 「#」より後ろはサーバーに送られないので、家のデータはネットのどこにも保存されない(お客さんの図面でも安心)
// Mac 側では ~/.claude/skills/oheya-house/scripts/build.py が同じ形式でリンクを作る

const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
async function pipe(bytes, stream) { const res = new Response(new Blob([bytes]).stream().pipeThrough(stream)); return new Uint8Array(await res.arrayBuffer()); }

// 写真(assets)は大きいのでリンクには入れない
export async function projectToLink(project, base = location.origin + location.pathname) {
  const json = JSON.stringify({ ...project, assets: {} });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return base + '#p=' + b64u(packed);
}
export async function linkToProject(hash) {
  const m = /[#&]p=([A-Za-z0-9_-]+)/.exec(hash || ''); if (!m) return null;
  const raw = await pipe(unb64u(m[1]), new DecompressionStream('deflate-raw'));
  const p = JSON.parse(new TextDecoder().decode(raw)); if (!p || !Array.isArray(p.rooms)) throw new Error('家のデータではありません');
  p.assets = p.assets || {}; p.items = p.items || []; return p;
}
