// 置くものを作るための共通の部品(items.js・furniture.js・wet.js・film.js で使う)
// 形(styles)と部分ごとの色(parts)のしくみもここ。
import * as THREE from 'three';
import { surfaceMaterial, finishMaterial } from './textures.js';

// 置けるもの全部の一覧(items.js がここに足していく)
export const CATALOG = {};

const stdCache = new Map();
export function std(color, rough = .6, metal = 0, extra = {}) {
  const k = color + '|' + rough + '|' + metal + '|' + JSON.stringify(extra); if (stdCache.has(k)) return stdCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); stdCache.set(k, m); return m;
}
export const WOOD = '#b98a5a', DARKWOOD = '#6b4a33', METAL = '#c8ccd2', BLACK = '#2a2a2e', GOLD = '#d4b065', WHITE = '#f4f4f2';
export function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
export function sph(r, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
export function emissive(color, intensity = 2) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .4 }); }
export function fabric(item, w, h) { if (item.userTex && item._assets && item._assets[item.userTex]) return surfaceMaterial('fabric', { user: item.userTex, size: item.texSize || 0.5 }, { w, h }, item._assets); return surfaceMaterial('fabric', { lib: item.fabric || 'plain', color: item.color || '#e8e2d6' }, { w, h }, item._assets || {}); }


export function light(group, color, intensity, x, y, z, opts = {}) {
  const l = new THREE.PointLight(color, intensity, opts.distance || 0, 2); l.position.set(x, y, z); l.castShadow = false;
  l.shadow.mapSize.set(256, 256); l.shadow.bias = -0.002; l.shadow.radius = 4; group.add(l); group.userData.lights = (group.userData.lights || []).concat(l); return l;
}
export const WARM = '#ffe2b8', DAYLIGHT = '#fff6e8';

export function chairGroup(mat) {
  const g = new THREE.Group(); g.add(box(0.42, 0.04, 0.42, mat, 0, 0.44, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.035, 0.42, 0.035, mat, x * 0.18, 0.21, z * 0.18)); g.add(box(0.42, 0.42, 0.03, mat, 0, 0.67, -0.19)); return g;
}


// ---- 形(styles)と部分ごとの色(parts) ----
// カタログに styles:[{ id, name, size:[w,h,d], words:[...], opts:{...} }] と parts:[{ key, name, pal, def }] を書くと、
// 編集欄に「形」と「部分ごとの色」が出る。保存は it.style(形の id)と it.parts({key: 値})。
// 値は textures.js の FINISHES の id か '#rrggbb'。pal は PALETTES の名前(door / wood / top / metal / ceramic)か 'color'(ふつうの色)か 'fabric'(布の色と柄)。
// いちばん目の部分の色は it.color に入れる(古い保存や「青にして」の言葉とつながるように)。
export function styleOf(it) { const c = CATALOG[it.type]; if (!c || !c.styles) return null; return c.styles.find(s => s.id === it.style) || c.styles[0]; }
export function partVal(it, key) {
  const c = CATALOG[it.type]; const ps = (c && c.parts) || []; const p = ps.find(q => q.key === key); const st = styleOf(it);
  const sdef = st && st.parts && st.parts[key];
  if (ps[0] && ps[0].key === key) return it.color || sdef || (p && p.def);
  return (it.parts && it.parts[key]) || sdef || (p && p.def) || '#cccccc';
}
// 部分の材質。rough/metal は ふつうの色('#..')のときに使う
export function pm(it, key, rough = .5, metal = 0) { return finishMaterial(partVal(it, key), rough, metal); }
export function setPart(it, key, v) { const c = CATALOG[it.type]; if (c.parts && c.parts[0].key === key) it.color = v; else { it.parts = it.parts || {}; it.parts[key] = v; } }
// 形を切りかえる(大きさ・初めの設定もその形のものに)
export function applyStyle(it, styleId) {
  const c = CATALOG[it.type]; const st = c && c.styles && c.styles.find(s => s.id === styleId); if (!st) return;
  it.style = st.id; if (st.size) { it.w = st.size[0]; it.h = st.size[1]; it.d = st.size[2]; }
  if (st.opts) it.opts = { ...(c.opts || {}), ...st.opts };
}
// 言葉 → 形(「二段ベッド」など)
export function styleByWord(type, text) { const c = CATALOG[type]; if (!c || !c.styles) return null; let best = null, bl = 0; for (const s of c.styles) for (const w of (s.words || [])) if (text.includes(w) && w.length > bl) { best = s.id; bl = w.length; } return best; }
// 丸みのある箱(クッション・ふとん用)
export function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001); const s = new THREE.Shape(); const hw = w / 2 - r, hh = h / 2 - r;
  s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh); s.lineTo(w / 2, hh); s.quadraticCurveTo(w / 2, h / 2, hw, h / 2); s.lineTo(-hw, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh); s.lineTo(-w / 2, -hh); s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: 3, curveSegments: 4 }); g.translate(0, 0, -(d - r * 2) / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
