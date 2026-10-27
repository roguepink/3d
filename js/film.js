// 映画づくり用(ペタル・人の目印)。画像生成の「配置の見本」に使う
// ペタル:CRASH に出てくるロボット(2026-10-27 ノブさんの許可で公開)。白い丸い体・黒い画面の顔・紫のヘッドホン・胸に光る桜
// 人の目印:だれだか分からない人形(立つ・座る・寝るなど)。向きは顔が +z
import * as THREE from 'three';
import { std, emissive, rbox, pm, partVal, styleOf } from './kit.js';

function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
function ball(r, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = mesh(new THREE.SphereGeometry(r, 28, 20), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; }
// a から b へのカプセル(腕・脚)
function limb(a, b, r, mat) { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L), 6, 14), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const glow = (v, k = 2) => emissive(v, k);

// ---- ペタル ----(ここでの長さは「座った高さ = 1」の割合。最後に it.h に合わせて縮める)
function petal(it) {
  const g = new THREE.Group(), body = pm(it, 'body', .32), acc = pm(it, 'phones', .45), face = std('#121216', .12, .2), sole = std('#d9d9de', .5);
  const eye = glow(partVal(it, 'eyes'), 0.9), heart = glow(partVal(it, 'heart'), 0.75), stand = styleOf(it).id === 'stand';
  const by = stand ? 0.47 : 0.29, hy = by + 0.46;
  g.add(ball(0.2, body, 0, by, 0, 1, 1.18, 0.92));
  if (stand) for (const sx of [-1, 1]) { g.add(limb(V(sx * 0.085, by - 0.12, 0), V(sx * 0.09, 0.07, 0.01), 0.068, body)); g.add(ball(0.075, body, sx * 0.09, 0.05, 0.045, 1, 0.65, 1.35)); g.add(ball(0.06, sole, sx * 0.09, 0.012, 0.05, 1, 0.2, 1.3)); }
  else for (const sx of [-1, 1]) { g.add(limb(V(sx * 0.1, 0.08, -0.02), V(sx * 0.11, 0.075, 0.2), 0.072, body)); const ft = ball(0.078, body, sx * 0.115, 0.085, 0.25, 1, 1.05, 0.7); g.add(ft); g.add(ball(0.06, sole, sx * 0.115, 0.085, 0.293, 1, 1, 0.15)); }
  for (const sx of [-1, 1]) g.add(limb(V(sx * 0.19, by + 0.1, 0), V(sx * 0.23, by - 0.08, 0.05), 0.052, body));
  // 頭・顔の画面・目・口
  g.add(ball(0.3, body, 0, hy, 0, 1.06, 0.92, 0.95));
  g.add(rbox(0.44, 0.35, 0.07, 0.075, body, 0, hy - 0.005, 0.238)); g.add(rbox(0.4, 0.31, 0.07, 0.07, face, 0, hy - 0.005, 0.252));
  for (const sx of [-1, 1]) { const e = ball(0.03, eye, sx * 0.08, hy + 0.012, 0.289, 1, 1.4, 0.3); g.add(e); const tip = mesh(new THREE.ConeGeometry(0.022, 0.045, 14), eye); tip.position.set(sx * 0.08, hy + 0.057, 0.289); tip.scale.z = 0.3; g.add(tip); }
  const smile = mesh(new THREE.TorusGeometry(0.032, 0.0055, 6, 18, Math.PI * 0.8), eye); smile.position.set(0, hy - 0.055, 0.29); smile.rotation.z = Math.PI + Math.PI * 0.1; g.add(smile);
  // ヘッドホン
  const band = mesh(new THREE.TorusGeometry(0.32, 0.032, 10, 40, Math.PI), acc); band.position.set(0, hy, -0.02); band.scale.set(1.0, 0.92, 1.6); g.add(band);
  for (const sx of [-1, 1]) { const cup = mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.075, 28), acc); cup.rotation.z = Math.PI / 2; cup.position.set(sx * 0.315, hy - 0.01, -0.02); g.add(cup); const pad = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 24), std('#3a2f4e', .6)); pad.rotation.z = Math.PI / 2; pad.position.set(sx * 0.36, hy - 0.01, -0.02); g.add(pad); }
  // 胸の桜(5枚の花びら・光る)
  const cz = 0.182, cy = by + 0.02; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const p = ball(0.026, heart, Math.sin(a) * 0.036, cy + Math.cos(a) * 0.036, cz, 1, 1.45, 0.25); p.rotation.z = -a; g.add(p); }
  g.add(ball(0.012, emissive('#ffd2c8', 2), 0, cy, cz + 0.004, 1, 1, 0.3));
  const H = stand ? 1.3 : 1.06, k = it.h / H; g.scale.setScalar(k); const out = new THREE.Group(); out.add(g); g.position.y = it.opts.lift || 0; return out;
}

// ---- 人の目印 ----(身長 1.70m のときの関節の位置。最後に it.h に合わせる)
const POSE = {
  stand: { H: 1.7, hip: [0, 0.95, 0], neck: [0, 1.46, 0], head: [0, 1.6, 0.01], knee: [[0.1, 0.5, 0.02], [-0.1, 0.5, 0.02]], foot: [[0.11, 0.06, 0.04], [-0.11, 0.06, 0.04]], hand: [[0.27, 0.86, 0.04], [-0.27, 0.86, 0.04]], elbow: [[0.24, 1.12, -0.02], [-0.24, 1.12, -0.02]] },
  chair: { H: 1.3, hip: [0, 0.48, -0.05], neck: [0, 1.0, -0.08], head: [0, 1.15, -0.06], knee: [[0.11, 0.5, 0.38], [-0.11, 0.5, 0.38]], foot: [[0.12, 0.06, 0.42], [-0.12, 0.06, 0.42]], hand: [[0.2, 0.62, 0.3], [-0.2, 0.62, 0.3]], elbow: [[0.25, 0.72, 0.06], [-0.25, 0.72, 0.06]] },
  floor: { H: 0.92, hip: [0, 0.14, -0.1], neck: [0, 0.66, -0.15], head: [0, 0.8, -0.12], knee: [[0.17, 0.42, 0.25], [-0.17, 0.42, 0.25]], foot: [[0.12, 0.06, 0.45], [-0.12, 0.06, 0.45]], hand: [[0.2, 0.4, 0.3], [-0.2, 0.4, 0.3]], elbow: [[0.25, 0.4, 0.05], [-0.25, 0.4, 0.05]] },
  lie: { H: 0.25, hip: [0, 0.12, 0.05], neck: [0, 0.12, -0.5], head: [0, 0.13, -0.66], knee: [[0.1, 0.13, 0.5], [-0.1, 0.12, 0.5]], foot: [[0.11, 0.1, 0.95], [-0.11, 0.1, 0.95]], hand: [[0.27, 0.08, 0.1], [-0.27, 0.08, 0.1]], elbow: [[0.26, 0.09, -0.15], [-0.26, 0.09, -0.15]] },
};
function person(it) {
  const s = styleOf(it), P = POSE[s.pose], m = pm(it, 'body', .55), g = new THREE.Group(), v = a => V(...a);
  const sh = [V(0.19, 0, 0), V(-0.19, 0, 0)].map(o => v(P.neck).add(o).add(V(0, -0.06, 0))), hp = [V(0.1, 0, 0), V(-0.1, 0, 0)].map(o => v(P.hip).add(o));
  g.add(limb(v(P.hip).add(V(0, 0.08, 0)), v(P.neck).add(V(0, -0.1, 0)), 0.15, m)); g.add(limb(sh[0], sh[1], 0.06, m)); g.add(limb(hp[0], hp[1], 0.1, m));
  const head = v(P.head); g.add(ball(0.105, m, head.x, head.y, head.z, 0.9, 1.08, 1)); const dir = s.pose === 'lie' ? V(0, 1, 0) : V(0, 0, 1); const nose = ball(0.03, m, head.x + dir.x * 0.1, head.y + dir.y * 0.1, head.z + dir.z * 0.1); g.add(nose);
  g.add(limb(v(P.neck), head, 0.05, m));
  for (let i = 0; i < 2; i++) { g.add(limb(hp[i], v(P.knee[i]), 0.07, m)); g.add(limb(v(P.knee[i]), v(P.foot[i]), 0.055, m)); g.add(ball(0.05, m, P.foot[i][0], 0.04, P.foot[i][2] + (s.pose === 'lie' ? 0 : 0.07), 1, 0.7, 2)); g.add(limb(sh[i], v(P.elbow[i]), 0.045, m)); g.add(limb(v(P.elbow[i]), v(P.hand[i]), 0.04, m)); }
  const k = it.h / P.H; g.scale.setScalar(k); const out = new THREE.Group(); out.add(g); g.position.y = it.opts.lift || 0; return out;
}

const LIFT = ['lift', '床からの高さ(机・ベッドの上など)', 0, 1.2, 'mm'];
export const FILM = {
  petal: { name: 'ペタル', emoji: '🤖', cat: '映画用', kind: 'floor', size: [0.2, 0.3, 0.17], range: { w: [0.05, 1.2], h: [0.1, 1.8], d: [0.05, 1.2] }, color: '#f4f3f6', opts: { lift: 0 }, words: ['ペタル', 'ぺたる', 'ロボット'],
    parts: [{ key: 'body', name: 'からだ', pal: 'color', def: '#f4f3f6' }, { key: 'phones', name: 'ヘッドホン', pal: 'color', def: '#4a3b66' }, { key: 'eyes', name: '目の光', pal: 'color', def: '#b99cff' }, { key: 'heart', name: '胸の桜', pal: 'color', def: '#ff5a4f' }],
    styles: [{ id: 'sit', name: '座る', size: [0.2, 0.3, 0.17], words: ['座っている', '座る'] }, { id: 'stand', name: '立つ', size: [0.2, 0.37, 0.12], words: ['立っている', '立つ'] }],
    params: [LIFT], build: petal },
  person: { name: '人の目印', emoji: '🧍', cat: '映画用', kind: 'floor', size: [0.5, 1.7, 0.3], range: { w: [0.2, 1.0], h: [0.2, 2.0], d: [0.2, 2.0] }, color: '#b9bec6', opts: { lift: 0 }, words: ['人の目印', '人形', 'マネキン', '人'],
    parts: [{ key: 'body', name: 'からだ', pal: 'color', def: '#b9bec6' }],
    styles: [
      { id: 'stand', name: '立つ(大人)', pose: 'stand', size: [0.55, 1.7, 0.3], words: ['立っている人', '立つ人'] },
      { id: 'child', name: '立つ(子ども)', pose: 'stand', size: [0.4, 1.2, 0.22], words: ['子ども', '子供'], parts: { body: '#c9d6c2' } },
      { id: 'chair', name: '椅子に座る', pose: 'chair', size: [0.55, 1.3, 0.6], words: ['座っている人', '椅子に座る'] },
      { id: 'floor', name: '床に座る', pose: 'floor', size: [0.55, 0.92, 0.65], words: ['床に座る', '体育座り'] },
      { id: 'lie', name: '寝ている', pose: 'lie', size: [0.6, 0.25, 1.8], words: ['寝ている人', '横になる'], opts: { lift: 0.45 } },
    ],
    params: [LIFT], build: person },
};
