// 置けるもの(カーテン・照明・家具など)のカタログと3Dの作り方
import * as THREE from 'three';
import { surfaceMaterial } from './textures.js';
import { mergeGroup } from './merge.js';

const stdCache = new Map();
export function std(color, rough = .6, metal = 0, extra = {}) {
  const k = color + '|' + rough + '|' + metal + '|' + JSON.stringify(extra); if (stdCache.has(k)) return stdCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); stdCache.set(k, m); return m;
}
const WOOD = '#b98a5a', DARKWOOD = '#6b4a33', METAL = '#c8ccd2', BLACK = '#2a2a2e', GOLD = '#d4b065', WHITE = '#f4f4f2';
function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function sph(r, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function emissive(color, intensity = 2) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .4 }); }
function fabric(item, w, h) { if (item.userTex && item._assets && item._assets[item.userTex]) return surfaceMaterial('fabric', { user: item.userTex, size: item.texSize || 0.5 }, { w, h }, item._assets); return surfaceMaterial('fabric', { lib: item.fabric || 'plain', color: item.color || '#e8e2d6' }, { w, h }, item._assets || {}); }

// ひだのあるカーテンの布
function pleatedPanel(pw, h, pitch, amp, mat) {
  const segX = Math.max(8, Math.round(pw / pitch * 6)), g = new THREE.PlaneGeometry(pw, h, segX, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); const t = (y + h / 2) / h; const a = amp * (0.6 + 0.4 * t); pos.setZ(i, a * Math.sin(x / pitch * Math.PI * 2) + a * 0.3 * Math.sin(x / pitch * Math.PI * 6 + 1)); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}

function light(group, color, intensity, x, y, z, opts = {}) {
  const l = new THREE.PointLight(color, intensity, opts.distance || 0, 2); l.position.set(x, y, z); l.castShadow = false;
  l.shadow.mapSize.set(256, 256); l.shadow.bias = -0.002; l.shadow.radius = 4; group.add(l); group.userData.lights = (group.userData.lights || []).concat(l); return l;
}
const WARM = '#ffe2b8', DAYLIGHT = '#fff6e8';

// ---- 各アイテム ----
export const CATALOG = {
  curtain: { name: 'カーテン', emoji: '🪟', cat: '窓まわり', kind: 'wall', size: [1.8, 2.0, 0.15], color: '#d9cdb8', fabric: 'plain', opts: { open: 0.3, lace: true, pleat: 1.5, box: false },
    words: ['カーテン', 'ドレープ', 'かーてん'], params: [['open', '開き具合', 0, 1], ['pleat', 'ヒダの多さ', 1, 2.5], ['lace', 'レースも', 'bool'], ['box', 'カーテンボックス', 'bool']],
    build(it) {
      const g = new THREE.Group(), w = it.w, h = it.h, open = it.opts.open ?? .3;
      const rail = box(w + 0.1, 0.03, 0.03, std(METAL, .35, .7), 0, h / 2 + 0.02, 0.1); g.add(rail);
      const br1 = box(0.02, 0.02, 0.1, std(METAL, .35, .7), -w / 2, h / 2 + 0.02, 0.05); g.add(br1); const br2 = br1.clone(); br2.position.x = w / 2; g.add(br2);
      const pleat = it.opts.pleat ?? 1.5; const pw = Math.max(0.12, (w / 2) * (1 - open * 0.88)), pitch = (0.18 / pleat) * (1 - open * 0.55), mat = fabric(it, pw, h);
      const amp = 0.03 + 0.012 * pleat; const L = pleatedPanel(pw, h - 0.03, pitch, amp, mat); L.position.set(-w / 2 + pw / 2, -0.015, 0.1); g.add(L);
      const R = pleatedPanel(pw, h - 0.03, pitch, amp, mat); R.position.set(w / 2 - pw / 2, -0.015, 0.1); g.add(R);
      if (open > 0.45) { const band = std(it.opts.tasselColor || '#c9b48a', .7); for (const sx of [-1, 1]) { const tb = new THREE.Mesh(new THREE.TorusGeometry(pw * 0.42 + 0.02, 0.012, 8, 24), band); tb.position.set(sx * (w / 2 - pw / 2), -h * 0.12, 0.1); tb.rotation.x = Math.PI / 2; tb.scale.z = 0.5; tb.castShadow = true; g.add(tb); const hook = box(0.02, 0.06, 0.03, std(METAL, .4, .6), sx * (w / 2 - 0.01), -h * 0.12, 0.015); g.add(hook); } }
      if (it.opts.box) { const bm = std(it.opts.boxColor || WHITE, .6); g.add(box(w + 0.2, 0.12, 0.02, bm, 0, h / 2 + 0.06, 0.19)); g.add(box(w + 0.2, 0.02, 0.2, bm, 0, h / 2 + 0.11, 0.1)); g.add(box(0.02, 0.12, 0.2, bm, -w / 2 - 0.09, h / 2 + 0.06, 0.1)); g.add(box(0.02, 0.12, 0.2, bm, w / 2 + 0.09, h / 2 + 0.06, 0.1)); }
      if (it.opts.lace) { const lm = surfaceMaterial('fabric', { lib: 'lace' }, { w, h }); const lace = pleatedPanel(w - 0.04, h - 0.04, 0.1, 0.02, lm); lace.position.set(0, -0.02, 0.05); lace.castShadow = false; g.add(lace); const rail2 = rail.clone(); rail2.position.z = 0.05; g.add(rail2); }
      return g;
    } },
  lace: { name: 'レースカーテン', emoji: '🤍', cat: '窓まわり', kind: 'wall', size: [1.8, 2.0, 0.08], color: '#ffffff', fabric: 'lace', opts: {}, words: ['レース', 'れーす'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h; g.add(box(w + 0.1, 0.03, 0.03, std(METAL, .35, .7), 0, h / 2 + 0.02, 0.05)); const m = surfaceMaterial('fabric', { lib: 'lace' }, { w, h }); const p = pleatedPanel(w - 0.04, h - 0.04, 0.1, 0.02, m); p.position.set(0, -0.02, 0.05); p.castShadow = false; g.add(p); return g; } },
  roller: { name: 'ロールスクリーン', emoji: '📜', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.08], color: '#efe9dc', fabric: 'plain', opts: { down: 0.8 }, words: ['ロールスクリーン', 'ロール', 'スクリーン'], params: [['down', '下ろし具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .8; g.add(box(w + 0.06, 0.07, 0.07, std(WHITE, .5), 0, h / 2 - 0.035, 0.045));
      const sh = Math.max(0.05, h * down); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, sh), fabric(it, w, sh)); s.position.set(0, h / 2 - 0.07 - sh / 2, 0.075); s.castShadow = true; s.receiveShadow = true; g.add(s);
      g.add(box(w, 0.03, 0.02, std(WHITE, .5), 0, h / 2 - 0.07 - sh, 0.075)); return g; } },
  shade: { name: 'シェード', emoji: '🪭', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.1], color: '#d8cdb9', fabric: 'linen', opts: { down: 0.7 }, words: ['シェード', 'ローマンシェード', 'プレーンシェード'], params: [['down', '下ろし具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .7; g.add(box(w + 0.06, 0.06, 0.08, std(WHITE, .5), 0, h / 2 - 0.03, 0.05));
      const mat = fabric(it, w, h); const sh = Math.max(0.08, h * down), flat = Math.max(0, sh - 0.25); if (flat > 0.02) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, flat), mat); p.position.set(0, h / 2 - 0.06 - flat / 2, 0.09); p.castShadow = true; p.receiveShadow = true; g.add(p); }
      const folds = 3 + Math.round((1 - down) * 4); const fh = (sh - flat) / folds; for (let i = 0; i < folds; i++) { const f = box(w, fh * 0.95, 0.03 + i * 0.012, mat, 0, h / 2 - 0.06 - flat - fh * (i + 0.5), 0.09 + (0.03 + i * 0.012) / 2); g.add(f); } return g; } },
  pleats: { name: 'プリーツスクリーン', emoji: '🗂️', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.06], color: '#efe6d2', fabric: 'plain', opts: { down: 0.8 }, words: ['プリーツスクリーン', 'プリーツ', 'ハニカム'], params: [['down', '下ろし具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .8; g.add(box(w + 0.04, 0.04, 0.05, std(WHITE, .5), 0, h / 2 - 0.02, 0.04));
      const sh = Math.max(0.05, h * down), pitch = 0.025, n = Math.max(2, Math.round(sh / pitch)); const geo = new THREE.PlaneGeometry(w, sh, 1, n); const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const row = Math.floor(i / 2); pos.setZ(i, (row % 2) * 0.02); } geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, fabric(it, w, sh)); m.position.set(0, h / 2 - 0.04 - sh / 2, 0.03); m.castShadow = true; m.receiveShadow = true; g.add(m); g.add(box(w, 0.02, 0.03, std(WHITE, .5), 0, h / 2 - 0.04 - sh, 0.04)); return g; } },
  shoji: { name: '障子', emoji: '🎎', cat: '窓まわり', kind: 'wall', size: [1.7, 1.8, 0.06], color: '#b98a5a', opts: { open: 0 }, words: ['障子', 'しょうじ'], params: [['open', '開き具合', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, open = it.opts.open ?? 0, wood = std(it.color, .6), paper = new THREE.MeshStandardMaterial({ color: '#fbf7ee', roughness: 1, transparent: true, opacity: .9, side: THREE.DoubleSide, emissive: '#fff6e6', emissiveIntensity: .15 });
      g.add(box(w + 0.1, 0.05, 0.08, wood, 0, h / 2 + 0.025, 0.04)); g.add(box(w + 0.1, 0.04, 0.08, wood, 0, -h / 2 - 0.02, 0.04));
      const pw = w / 2, panels = [[-pw / 2 + open * pw * 0.96, 0.02], [pw / 2, 0.05]];
      for (const [px, pz] of panels) { const pg = new THREE.Group(); pg.position.set(px, 0, pz); g.add(pg); const sheet = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.04, h - 0.04), paper); sheet.position.z = 0.012; pg.add(sheet);
        pg.add(box(0.03, h, 0.025, wood, -pw / 2 + 0.015, 0, 0.012)); pg.add(box(0.03, h, 0.025, wood, pw / 2 - 0.015, 0, 0.012)); pg.add(box(pw, 0.03, 0.025, wood, 0, h / 2 - 0.015, 0.012)); pg.add(box(pw, 0.03, 0.025, wood, 0, -h / 2 + 0.015, 0.012));
        const cols = 3, rows = Math.max(4, Math.round(h / 0.3)); for (let i = 1; i < cols; i++) pg.add(box(0.012, h - 0.04, 0.012, wood, -pw / 2 + pw * i / cols, 0, 0.02)); for (let j = 1; j < rows; j++) pg.add(box(pw - 0.04, 0.012, 0.012, wood, 0, -h / 2 + h * j / rows, 0.02)); }
      return g; } },
  blind: { name: 'ブラインド(横型)', emoji: '🎚️', cat: '窓まわり', kind: 'wall', size: [1.7, 1.9, 0.06], color: '#f2f2f0', opts: { down: 0.9, tilt: 0.35 }, words: ['ブラインド', '横型ブラインド', 'アルミブラインド', 'よこがた'], params: [['down', '下ろし具合', 0, 1], ['tilt', '羽の角度', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, down = it.opts.down ?? .9, tilt = (it.opts.tilt ?? .35) * 1.3;
      g.add(box(w + 0.04, 0.05, 0.05, std(it.color, .5), 0, h / 2 - 0.025, 0.04));
      const pitch = 0.025, n = Math.max(1, Math.floor(h * down / pitch)); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, 0.0015, 0.025), std(it.color, .4, .3), n); im.castShadow = true; im.receiveShadow = true;
      const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { o.position.set(0, h / 2 - 0.06 - i * pitch, 0.04); o.rotation.set(tilt, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im);
      g.add(box(w, 0.02, 0.025, std(it.color, .5), 0, h / 2 - 0.06 - n * pitch, 0.04)); return g; } },
  vblind: { name: 'ブラインド(縦型)', emoji: '🏛️', cat: '窓まわり', kind: 'wall', size: [1.8, 2.0, 0.1], color: '#ece7dc', fabric: 'plain', opts: { tilt: 0.3 }, words: ['縦型ブラインド', 'バーチカル', 'たて型', '縦型'], params: [['tilt', '羽の角度', 0, 1]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, tilt = (it.opts.tilt ?? .3) * 1.4; g.add(box(w + 0.04, 0.05, 0.06, std(WHITE, .5), 0, h / 2 - 0.025, 0.05));
      const pitch = 0.08, n = Math.max(1, Math.floor(w / pitch)); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.089, h - 0.07, 0.002), fabric(it, 0.09, h), n); im.castShadow = true; im.receiveShadow = true;
      const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { o.position.set(-w / 2 + pitch / 2 + i * pitch, -0.035, 0.05); o.rotation.set(0, tilt, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im); return g; } },

  ceilingLight: { name: 'シーリングライト', emoji: '💡', cat: '照明', kind: 'ceiling', size: [0.5, 0.1, 0.5], range: { w: [0.3, 0.7] }, color: '#ffffff', opts: { on: true, power: 1 }, words: ['シーリングライト', 'シーリング', '天井の電気', '天井の照明', '天井灯', '電気', 'ライト', '照明'], params: [['power', '明るさ', 0.2, 2], ['warm', '電球色(オレンジ)', 'bool'], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), r = it.w / 2, on = it.opts.on !== false; g.add(cyl(r * .3, r * .3, 0.03, std(WHITE, .5), 0, -0.015, 0));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(r * .92, r, 0.09, 40), on ? emissive(it.opts.warm ? '#ffe9c4' : '#fff8ea', 1.1) : std('#e9e9e6', .6)); shade.position.y = -0.075; g.add(shade);
      const rim = cyl(r, r, 0.02, std(WHITE, .4), 0, -0.11, 0, 40); g.add(rim); if (on) { const l = light(g, it.opts.warm ? WARM : DAYLIGHT, 8 * (it.opts.power ?? 1), 0, -0.55, 0); l.castShadow = true; } return g; } },
  pendant: { name: 'ペンダントライト', emoji: '🔆', cat: '照明', kind: 'ceiling', size: [0.35, 0.8, 0.35], range: { w: [0.12, 0.6] }, color: '#3b3b3f', opts: { on: true, drop: 0.7, power: 1 }, words: ['ペンダント', 'ペンダントライト', '吊り下げ', 'つりさげ'], params: [['drop', '下げる長さ', 0.3, 1.5], ['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), r = it.w / 2, drop = it.opts.drop ?? .7, on = it.opts.on !== false; g.add(cyl(0.05, 0.05, 0.02, std(it.color, .5, .3), 0, -0.01, 0)); g.add(cyl(0.003, 0.003, drop, std(BLACK, .6), 0, -drop / 2, 0, 8));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(r * .45, r, r * 0.9, 32, 1, true), std(it.color, .45, .2, { side: THREE.DoubleSide })); shade.position.y = -drop - r * .45; g.add(shade);
      const bulb = sph(0.03, on ? emissive('#fff2d6', 3) : std('#eee', .3), 0, -drop - r * .5, 0); g.add(bulb); if (on) { const l = light(g, WARM, 6 * (it.opts.power ?? 1), 0, -drop - r * .6, 0); l.castShadow = true; } return g; } },
  chandelier: { name: 'シャンデリア', emoji: '✨', cat: '照明', kind: 'ceiling', size: [0.7, 0.8, 0.7], range: { w: [0.4, 1.1] }, color: GOLD, opts: { on: true, arms: 6, power: 1 }, words: ['シャンデリア', 'しゃんでりあ'], params: [['arms', '灯の数', 3, 12], ['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), r = it.w / 2, on = it.opts.on !== false, n = Math.round(it.opts.arms ?? 6), gold = std(it.color, .25, .9), crystal = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, metalness: 0, transmission: .9, thickness: .02, transparent: true, opacity: .7 });
      g.add(cyl(0.04, 0.04, 0.02, gold, 0, -0.01, 0)); g.add(cyl(0.008, 0.008, 0.45, gold, 0, -0.235, 0, 8)); g.add(sph(0.06, gold, 0, -0.5, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .55, 0.012, 10, 48), gold); ring.rotation.x = Math.PI / 2; ring.position.y = -0.5; g.add(ring);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(cx * r * .6, -0.68, cz * r * .6), new THREE.Vector3(cx * r, -0.5, cz * r));
        const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.008, 8), gold); arm.castShadow = true; g.add(arm);
        g.add(cyl(0.025, 0.03, 0.02, gold, cx * r, -0.49, cz * r)); g.add(cyl(0.012, 0.012, 0.1, std('#fff6e4', .5), cx * r, -0.43, cz * r, 10));
        g.add(sph(0.028, on ? emissive('#ffe9c0', 3.5) : std('#eee', .3), cx * r, -0.35, cz * r));
        for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), crystal); c.position.set(cx * r * (0.55 + k * 0.15), -0.55 - k * 0.06, cz * r * (0.55 + k * 0.15)); c.scale.y = 2; g.add(c); } }
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), crystal); c.position.set(Math.cos(a) * r * .55, -0.56 - (k % 2) * 0.04, Math.sin(a) * r * .55); c.scale.y = 2.2; g.add(c); }
      if (on) { const l = light(g, '#ffe6bd', 12 * (it.opts.power ?? 1), 0, -0.6, 0); l.castShadow = true; } return g; } },
  wallLight: { name: 'ブラケット(壁の電気)', emoji: '🕯️', cat: '照明', kind: 'wall', size: [0.2, 0.3, 0.2], range: { w: [0.1, 0.4], h: [0.15, 0.5] }, color: '#2f3036', opts: { on: true, power: 1 }, words: ['ブラケット', '壁の電気', '壁掛けの電気', '壁掛け照明', '壁のライト', '壁付け', '壁掛け', '壁の照明'], params: [['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), on = it.opts.on !== false; g.add(box(0.1, 0.16, 0.02, std(it.color, .4, .4), 0, 0, 0.01)); g.add(cyl(0.008, 0.008, 0.12, std(it.color, .4, .4), 0, 0.02, 0.07).rotateX(Math.PI / 2));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.14, 24, 1, true), std('#f3eee4', .7, 0, { side: THREE.DoubleSide })); shade.position.set(0, 0.07, 0.13); g.add(shade);
      g.add(sph(0.025, on ? emissive('#fff0d0', 3) : std('#eee', .3), 0, 0.07, 0.13)); if (on) light(g, WARM, 3 * (it.opts.power ?? 1), 0, 0.12, 0.2); return g; } },
  downlight: { name: 'ダウンライト', emoji: '🔦', cat: '照明', kind: 'ceiling', size: [0.1, 0.02, 0.1], range: { w: [0.075, 0.15] }, color: '#ffffff', opts: { on: true, power: 1 }, words: ['ダウンライト', 'スポット', 'スポットライト'], params: [['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), on = it.opts.on !== false; g.add(cyl(0.06, 0.06, 0.01, std(WHITE, .5), 0, -0.005, 0)); g.add(cyl(0.045, 0.045, 0.004, on ? emissive('#fff3dd', 2.5) : std('#ddd', .5), 0, -0.011, 0));
      if (on) { const s = new THREE.SpotLight(WARM, 10 * (it.opts.power ?? 1), 0, 0.75, 0.6, 2); s.position.set(0, -0.02, 0); s.target.position.set(0, -2.5, 0); g.add(s); g.add(s.target); g.userData.lights = [s]; } return g; } },
  floorLamp: { name: 'フロアランプ', emoji: '🛋️', cat: '照明', kind: 'floor', size: [0.35, 1.5, 0.35], color: '#f1ead9', opts: { on: true, power: 1 }, words: ['フロアランプ', 'スタンド', 'スタンドライト', 'フロアライト'], params: [['power', '明るさ', 0.2, 2], ['on', '点ける', 'bool']],
    build(it) { const g = new THREE.Group(), h = it.h, on = it.opts.on !== false; g.add(cyl(0.14, 0.14, 0.02, std(BLACK, .4, .5), 0, 0.01, 0)); g.add(cyl(0.012, 0.012, h - 0.3, std(BLACK, .4, .5), 0, (h - 0.3) / 2, 0, 10));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(it.w * .4, it.w / 2, 0.3, 28, 1, true), std(it.color, .8, 0, { side: THREE.DoubleSide })); shade.position.y = h - 0.15; g.add(shade);
      g.add(sph(0.03, on ? emissive('#fff0d0', 3) : std('#eee', .3), 0, h - 0.15, 0)); if (on) light(g, WARM, 4 * (it.opts.power ?? 1), 0, h - 0.15, 0); return g; } },

  rug: { name: 'ラグ・絨毯', emoji: '🧶', cat: '敷物', kind: 'floor', size: [2.0, 0.015, 1.4], color: '#b8a58c', fabric: 'linen', opts: { round: false }, words: ['ラグ', '絨毯', 'じゅうたん', 'カーペット', 'マット'], params: [['round', '丸い形', 'bool']],
    build(it) { const g = new THREE.Group(); const m = fabric(it, it.w, it.d); m.roughness = 1; let r; if (it.opts.round) r = cyl(it.w / 2, it.w / 2, 0.015, m, 0, 0.0075, 0, 48); else r = box(it.w, 0.015, it.d, m, 0, 0.0075, 0); r.castShadow = false; g.add(r); return g; } },

  counter: { name: 'カウンター', emoji: '🍸', cat: '家具', kind: 'floor', size: [1.8, 1.0, 0.55], color: WOOD, opts: { base: '#f1efe9' }, words: ['カウンター', 'カウンターテーブル', 'キッチンカウンター'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w - 0.06, it.h - 0.05, it.d - 0.1, std(it.opts.base || '#f1efe9', .6), 0, (it.h - 0.05) / 2, -0.04)); g.add(box(it.w, 0.04, it.d, std(it.color, .35), 0, it.h - 0.02, 0)); g.add(box(it.w - 0.1, 0.08, it.d - 0.16, std(BLACK, .7), 0, 0.04, -0.06)); return g; } },
  desk: { name: '机', emoji: '🖥️', cat: '家具', kind: 'floor', size: [1.2, 0.72, 0.6], color: WOOD, opts: {}, words: ['机', 'デスク', 'つくえ', '勉強机', 'ワークデスク'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d; g.add(box(w, 0.03, d, std(it.color, .4), 0, h - 0.015, 0)); const leg = std(BLACK, .4, .6); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.04, h - 0.03, 0.04, leg, x * (w / 2 - 0.05), (h - 0.03) / 2, z * (d / 2 - 0.05))); g.add(box(w - 0.1, 0.1, 0.02, leg, 0, h - 0.1, -d / 2 + 0.06)); return g; } },
  table: { name: 'ダイニングテーブル', emoji: '🍽️', cat: '家具', kind: 'floor', size: [1.4, 0.72, 0.8], color: WOOD, opts: { chairs: 4 }, words: ['テーブル', 'ダイニングテーブル', '食卓', 'ダイニング'], params: [['chairs', '椅子の数', 0, 6]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, wood = std(it.color, .45); g.add(box(w, 0.04, d, wood, 0, h - 0.02, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, h - 0.04, 0.06, wood, x * (w / 2 - 0.08), (h - 0.04) / 2, z * (d / 2 - 0.08)));
      const n = Math.round(it.opts.chairs ?? 4); const spots = []; const per = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const sideZ = i < per ? 1 : -1, k = i < per ? i : i - per, cnt = i < per ? per : n - per; spots.push([(k + 0.5) / cnt * w - w / 2, sideZ * (d / 2 + 0.3), sideZ > 0 ? Math.PI : 0]); }
      for (const [x, z, ry] of spots) { const c = chairGroup(std(it.color, .5)); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); } return g; } },
  lowtable: { name: 'ローテーブル', emoji: '🫖', cat: '家具', kind: 'floor', size: [1.0, 0.4, 0.55], color: DARKWOOD, opts: {}, words: ['ローテーブル', 'ちゃぶ台', '座卓', 'センターテーブル', 'コーヒーテーブル'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .4); g.add(box(w, 0.035, d, m, 0, h - 0.0175, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.05, h - 0.035, 0.05, m, x * (w / 2 - 0.06), (h - 0.035) / 2, z * (d / 2 - 0.06))); return g; } },
  chair: { name: '椅子', emoji: '🪑', cat: '家具', kind: 'floor', size: [0.45, 0.85, 0.45], color: WOOD, opts: {}, words: ['椅子', 'いす', 'チェア'], build(it) { const g = new THREE.Group(); g.add(chairGroup(std(it.color, .5))); return g; } },
  sofa: { name: 'ソファ', emoji: '🛋️', cat: '家具', kind: 'floor', size: [1.9, 0.8, 0.9], color: '#8c8f98', fabric: 'linen', opts: { seats: 3 }, words: ['ソファ', 'ソファー', '長椅子'], params: [['seats', '人数', 1, 4]],
    build(it) { const g = new THREE.Group(), w = it.w, d = it.d, m = fabric(it, 1, 1), dark = std(BLACK, .5, .3); g.add(box(w, 0.1, d, dark, 0, 0.1, 0)); g.add(box(w, 0.3, d, m, 0, 0.3, 0)); g.add(box(w, 0.45, 0.22, m, 0, 0.6, -d / 2 + 0.11));
      g.add(box(0.18, 0.5, d, m, -w / 2 + 0.09, 0.45, 0)); g.add(box(0.18, 0.5, d, m, w / 2 - 0.09, 0.45, 0));
      const n = Math.round(it.opts.seats ?? 3), cw = (w - 0.36) / n; for (let i = 0; i < n; i++) { const cx = -w / 2 + 0.18 + cw * (i + .5); g.add(box(cw - 0.02, 0.14, d - 0.32, m, cx, 0.52, 0.06)); g.add(box(cw - 0.03, 0.4, 0.14, m, cx, 0.75, -d / 2 + 0.28)); } return g; } },
  bed: { name: 'ベッド', emoji: '🛏️', cat: '家具', kind: 'floor', size: [1.45, 0.9, 2.05], color: '#e9e4d8', fabric: 'linen', opts: {}, words: ['ベッド', '寝床', 'べっど'],
    build(it) { const g = new THREE.Group(), w = it.w, d = it.d, wood = std(WOOD, .5), m = fabric(it, 1, 1); g.add(box(w, 0.25, d, wood, 0, 0.125, 0)); g.add(box(w, 0.9, 0.05, wood, 0, 0.45, -d / 2 + 0.025)); g.add(box(w - 0.06, 0.22, d - 0.1, std('#f6f4ee', .9), 0, 0.36, 0.02));
      g.add(box(w - 0.06, 0.06, d * 0.62, m, 0, 0.5, d * 0.2)); g.add(box(w * .4, 0.1, 0.4, std('#ffffff', .9), -w * .24, 0.52, -d / 2 + 0.35)); g.add(box(w * .4, 0.1, 0.4, std('#ffffff', .9), w * .24, 0.52, -d / 2 + 0.35)); return g; } },
  shelf: { name: '棚', emoji: '📚', cat: '家具', kind: 'floor', size: [0.8, 1.8, 0.3], color: WOOD, opts: { boards: 5 }, words: ['棚', '本棚', 'シェルフ', 'ラック', '収納'], params: [['boards', '段数', 2, 8]],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .5), n = Math.round(it.opts.boards ?? 5); g.add(box(0.02, h, d, m, -w / 2 + 0.01, h / 2, 0)); g.add(box(0.02, h, d, m, w / 2 - 0.01, h / 2, 0)); g.add(box(w, h, 0.01, m, 0, h / 2, -d / 2 + 0.005));
      for (let i = 0; i < n; i++) { const y = 0.02 + i * (h - 0.04) / (n - 1); g.add(box(w - 0.04, 0.02, d, m, 0, y, 0)); if (i < n - 1) for (let k = 0; k < 4; k++) { const c = ['#c5553f', '#4a6fa5', '#e0c060', '#6a9a6a', '#8b6b9a'][(i * 3 + k) % 5]; g.add(box(0.035 + (k % 2) * 0.01, 0.2 + (k % 3) * 0.03, d * .7, std(c, .7), -w / 2 + 0.1 + k * 0.06, y + 0.12, 0)); } } return g; } },
  tvboard: { name: 'テレビ台', emoji: '📺', cat: '家具', kind: 'floor', size: [1.6, 0.45, 0.4], color: DARKWOOD, opts: { tv: true }, words: ['テレビ台', 'テレビボード', 'tvボード'], params: [['tv', 'テレビも', 'bool']],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .4); g.add(box(w, h, d, m, 0, h / 2, 0)); g.add(box(w - 0.04, 0.01, 0.005, std(BLACK, .5), 0, h / 2, d / 2 + 0.002));
      if (it.opts.tv !== false) { g.add(box(w * .7, w * .7 * .56, 0.03, std('#111', .15, .5), 0, h + w * .7 * .28 + 0.05, 0)); g.add(box(0.3, 0.05, 0.2, std(BLACK, .4, .5), 0, h + 0.025, 0)); } return g; } },
  tv: { name: '壁掛けテレビ', emoji: '📺', cat: '壁かざり', kind: 'wall', size: [1.2, 0.68, 0.05], color: '#111111', opts: {}, words: ['テレビ', 'tv', 'モニター', '壁掛けテレビ'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.03, std('#0b0b0d', .15, .5), 0, 0, 0.02)); g.add(box(it.w - 0.02, it.h - 0.02, 0.005, std('#1a1d26', .1, .6), 0, 0, 0.038)); return g; } },
  picture: { name: '絵・額', emoji: '🖼️', cat: '壁かざり', kind: 'wall', size: [0.6, 0.45, 0.04], color: '#f0ece2', opts: {}, words: ['絵', '額', 'ポスター', '額縁', 'アート'],
    build(it) { const g = new THREE.Group(), fr = std(it.opts.frame || DARKWOOD, .5); g.add(box(it.w, it.h, 0.03, fr, 0, 0, 0.015)); let inner; if (it.opts.photo && it._assets && it._assets[it.opts.photo]) inner = surfaceMaterial('wall', { photo: it.opts.photo }, { w: it.w, h: it.h }, it._assets); else inner = std(it.color, .8); const p = new THREE.Mesh(new THREE.PlaneGeometry(it.w - 0.06, it.h - 0.06), inner); p.position.z = 0.031; g.add(p); if (!it.opts.photo) { const a = new THREE.Mesh(new THREE.CircleGeometry(Math.min(it.w, it.h) * .25, 24), std('#d9a066', .8)); a.position.set(it.w * .1, it.h * .05, 0.032); g.add(a); const b = new THREE.Mesh(new THREE.PlaneGeometry(it.w - 0.1, it.h * .2), std('#6a8a9a', .8)); b.position.set(0, -it.h * .3, 0.032); g.add(b); } return g; } },
  mirror: { name: '鏡', emoji: '🪞', cat: '壁かざり', kind: 'wall', size: [0.5, 1.2, 0.03], color: METAL, opts: {}, words: ['鏡', 'ミラー', 'かがみ'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.02, std(it.color, .3, .8), 0, 0, 0.01)); const m = new THREE.Mesh(new THREE.PlaneGeometry(it.w - 0.04, it.h - 0.04), new THREE.MeshStandardMaterial({ color: '#e8f0ff', roughness: 0.02, metalness: 1 })); m.position.z = 0.021; g.add(m); return g; } },
  clock: { name: '時計', emoji: '🕰️', cat: '壁かざり', kind: 'wall', size: [0.3, 0.3, 0.04], range: { w: [0.2, 0.5], h: [0.2, 0.5] }, color: '#f4f4f2', opts: {}, words: ['時計', 'とけい'],
    build(it) { const g = new THREE.Group(), r = it.w / 2; g.add(cyl(r, r, 0.03, std(DARKWOOD, .5), 0, 0, 0.015).rotateX(Math.PI / 2)); g.add(cyl(r - 0.02, r - 0.02, 0.005, std(it.color, .6), 0, 0, 0.032).rotateX(Math.PI / 2)); g.add(box(0.012, r * .6, 0.004, std(BLACK, .5), 0, r * .3, 0.036)); const m = box(0.012, r * .8, 0.004, std(BLACK, .5), 0, 0, 0.037); m.rotation.z = -Math.PI / 3; m.position.set(r * .35, r * .2, 0.037); g.add(m); return g; } },
  // ---- 設備(別画面「設備」から置く) ----
  outlet: { name: 'コンセント(2口)', emoji: '🔌', cat: '電気', equip: true, kind: 'wall', size: [0.07, 0.12, 0.012], range: { w: [0.05, 0.15], h: [0.07, 0.25] }, attachY: 0.25, color: '#f4f4f2', opts: {}, words: ['コンセント', 'こんせんと'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.008, std(it.color, .5), 0, 0, 0.004)); const dark = std('#3a3a3e', .4); for (const dy of [0.018, -0.018]) { g.add(box(0.004, 0.012, 0.004, dark, -0.007, dy, 0.009)); g.add(box(0.004, 0.012, 0.004, dark, 0.007, dy, 0.009)); } return g; } },
  switch: { name: 'スイッチ', emoji: '🔘', cat: '電気', equip: true, kind: 'wall', size: [0.07, 0.12, 0.015], range: { w: [0.05, 0.15], h: [0.07, 0.25] }, attachY: 1.2, color: '#f4f4f2', opts: {}, words: ['スイッチ', 'すいっち', '電気のスイッチ'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.008, std(it.color, .5), 0, 0, 0.004)); g.add(box(it.w * 0.6, it.h * 0.55, 0.008, std('#ffffff', .4), 0, 0, 0.012)); g.add(box(it.w * 0.6, 0.004, 0.006, std('#cfd3d8', .4), 0, 0, 0.016)); return g; } },
  intercom: { name: 'インターホン', emoji: '📟', cat: '電気', equip: true, kind: 'wall', size: [0.10, 0.17, 0.03], range: { w: [0.08, 0.2], h: [0.12, 0.3] }, attachY: 1.4, color: '#f4f4f2', opts: {}, words: ['インターホン', 'ドアホン', 'いんたーほん'],
    build(it) { const g = new THREE.Group(); g.add(box(it.w, it.h, 0.025, std(it.color, .5), 0, 0, 0.0125)); g.add(box(it.w * 0.76, it.h * 0.42, 0.004, std('#1d2733', .2, .3), 0, it.h * 0.18, 0.027)); g.add(box(it.w * 0.3, 0.012, 0.004, std('#8fb4d8', .5), 0, -it.h * 0.25, 0.027)); return g; } },
  smoke: { name: '火災警報器', emoji: '🚨', cat: '電気', equip: true, kind: 'ceiling', size: [0.10, 0.035, 0.10], range: { w: [0.08, 0.15] }, color: '#f4f4f2', opts: {}, words: ['火災警報器', '火災報知器', '警報器', '煙感知器'],
    build(it) { const g = new THREE.Group(); g.add(cyl(it.w / 2, it.w / 2 * 0.9, 0.03, std(it.color, .5), 0, -0.015, 0, 24)); g.add(cyl(0.006, 0.006, 0.004, std('#d33', .4), 0, -0.032, 0.02, 8)); return g; } },
  aircon: { name: 'エアコン(壁掛け)', emoji: '❄️', cat: '空調・換気', equip: true, kind: 'wall', size: [0.80, 0.29, 0.23], range: { w: [0.7, 1.0], h: [0.25, 0.35], d: [0.2, 0.3] }, attachY: 'top', color: '#f6f6f3', opts: {}, words: ['エアコン', 'クーラー', '冷房', '暖房機'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d; g.add(box(w, h, d * 0.85, std(it.color, .35), 0, 0, d * 0.425)); g.add(box(w * 0.98, h * 0.5, 0.01, std(it.color, .25), 0, h * 0.2, d * 0.85 + 0.005)); g.add(box(w * 0.9, 0.03, 0.02, std('#4a4f57', .4), 0, -h * 0.32, d * 0.82)); g.add(box(0.03, 0.006, 0.004, std('#5fd36a', .3), w * 0.38, -h * 0.1, d * 0.86)); return g; } },
  register: { name: '給気口(レジスター)', emoji: '⭕', cat: '空調・換気', equip: true, kind: 'wall', size: [0.15, 0.15, 0.03], range: { w: [0.1, 0.25] }, attachY: 2.0, color: '#f4f4f2', opts: {}, words: ['給気口', 'レジスター', '吸気口', '換気口', '通気口'],
    build(it) { const g = new THREE.Group(), r = it.w / 2; const m = std(it.color, .5); g.add(cyl(r, r, 0.012, m, 0, 0, 0.006).rotateX(Math.PI / 2)); g.add(cyl(r * 0.8, r * 0.8, 0.02, m, 0, 0, 0.02).rotateX(Math.PI / 2)); g.add(cyl(r * 0.84, r * 0.84, 0.006, std('#55585e', .5), 0, 0, 0.012).rotateX(Math.PI / 2)); return g; } },
  ventfan: { name: '換気扇', emoji: '🌀', cat: '空調・換気', equip: true, kind: 'wall', size: [0.25, 0.25, 0.04], range: { w: [0.15, 0.4], h: [0.15, 0.4] }, attachY: 2.0, color: '#f4f4f2', opts: {}, words: ['換気扇', 'かんきせん'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h; g.add(box(w, h, 0.03, std(it.color, .5), 0, 0, 0.015)); const n = 6, pitch = (h - 0.03) / n; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w - 0.03, pitch * 0.5, 0.01, 1, 1, 1), std('#dcdfe3', .5), n); const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { o.position.set(0, -h / 2 + 0.015 + pitch * (i + .5), 0.034); o.rotation.set(0.5, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im); return g; } },
  washstand: { name: '洗面台', emoji: '🚰', cat: '水まわり', equip: true, kind: 'floor', size: [0.75, 1.85, 0.55], range: { w: [0.6, 1.2], h: [1.6, 2.1], d: [0.45, 0.65] }, color: '#f6f6f3', opts: { mirror: true }, words: ['洗面台', '洗面化粧台', '洗面', 'せんめん'], params: [['mirror', '鏡の棚', 'bool']],
    build(it) { const g = new THREE.Group(), w = it.w, d = it.d, cab = std(it.color, .5), white = std('#ffffff', .3), metal = std(METAL, .3, .8); g.add(box(w, 0.78, d - 0.05, cab, 0, 0.39, -0.025)); g.add(box(0.004, 0.6, 0.004, std('#999', .4), 0, 0.42, d / 2 - 0.025)); g.add(box(w, 0.04, d, white, 0, 0.80, 0)); const bowl = cyl(0.22, 0.17, 0.12, white, 0, 0.78, 0.02, 32); bowl.scale.z = 0.75; g.add(bowl); g.add(cyl(0.012, 0.012, 0.18, metal, 0, 0.9, -d / 2 + 0.1, 10)); const sp = cyl(0.01, 0.01, 0.12, metal, 0, 0.99, -d / 2 + 0.16, 8); sp.rotation.x = Math.PI / 2; g.add(sp);
      if (it.opts.mirror !== false) { g.add(box(w, 0.7, 0.14, cab, 0, 1.45, -d / 2 + 0.07)); const mir = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, 0.62), new THREE.MeshStandardMaterial({ color: '#e8f0ff', roughness: 0.02, metalness: 1 })); mir.position.set(0, 1.45, -d / 2 + 0.141); g.add(mir); g.add(box(w - 0.1, 0.03, 0.06, emissive('#fff6e8', 1.2), 0, 1.83, -d / 2 + 0.1)); light(g, '#fff4e4', 1.5, 0, 1.75, 0.1); } return g; } },
  toilet: { name: 'トイレ(便器)', emoji: '🚽', cat: '水まわり', equip: true, kind: 'floor', size: [0.42, 0.80, 0.75], range: { w: [0.36, 0.5], h: [0.7, 1.0], d: [0.6, 0.85] }, color: '#f8f8f6', opts: {}, words: ['トイレ', '便器', 'べんき', 'といれ'],
    build(it) { const g = new THREE.Group(), w = it.w, d = it.d, m = std(it.color, .25); g.add(box(w, 0.42, 0.18, m, 0, 0.6, -d / 2 + 0.09)); g.add(box(w - 0.04, 0.02, 0.14, std('#eee', .3), 0, 0.82, -d / 2 + 0.09)); const bowl = cyl(0.19, 0.14, 0.38, m, 0, 0.19, 0.08, 28); bowl.scale.z = 1.25; g.add(bowl); const seat = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.03, 10, 32), m); seat.rotation.x = Math.PI / 2; seat.scale.z = 1.25; seat.position.set(0, 0.4, 0.08); g.add(seat); const lid = box(0.36, 0.02, 0.1, m, 0, 0.41, -d / 2 + 0.22); g.add(lid); g.add(box(0.06, 0.02, 0.01, std(METAL, .3, .8), w * 0.3, 0.83, -d / 2 + 0.16)); return g; } },
  kitchen: { name: 'システムキッチン', emoji: '🍳', cat: '水まわり', equip: true, kind: 'floor', size: [2.55, 0.85, 0.65], range: { w: [1.5, 3.0], h: [0.8, 0.95], d: [0.6, 0.75] }, color: '#e9e3d8', opts: { hood: true }, words: ['キッチン', 'システムキッチン', '台所', '流し台'], params: [['hood', 'レンジフード', 'bool']],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, cab = std(it.color, .45), top = std('#f2f2ef', .3), steel = std('#bfc5cc', .25, .9); g.add(box(w, h - 0.04, d - 0.04, cab, 0, (h - 0.04) / 2, -0.02)); g.add(box(w - 0.1, 0.08, d - 0.1, std(BLACK, .7), 0, 0.04, -0.06)); g.add(box(w, 0.04, d, top, 0, h - 0.02, 0));
      for (let i = 1; i < Math.round(w / 0.45); i++) g.add(box(0.004, h - 0.2, 0.004, std('#999', .5), -w / 2 + i * (w / Math.round(w / 0.45)), h / 2 - 0.05, d / 2 - 0.02));
      const sx = -w * 0.25; g.add(box(0.72, 0.03, 0.42, steel, sx, h - 0.015, 0)); g.add(box(0.66, 0.16, 0.36, std('#9aa0a6', .3, .8), sx, h - 0.1, 0)); g.add(cyl(0.012, 0.012, 0.25, steel, sx, h + 0.1, -d / 2 + 0.08, 10)); const sp = cyl(0.01, 0.01, 0.18, steel, sx, h + 0.22, -d / 2 + 0.17, 8); sp.rotation.x = Math.PI / 2; g.add(sp);
      const cx = w * 0.28; g.add(box(0.6, 0.012, 0.5, std('#1a1a1d', .15, .4), cx, h + 0.006, 0)); for (const [dx, dz] of [[-0.17, 0.1], [0.17, 0.1], [0, -0.12]]) g.add(cyl(0.09, 0.09, 0.006, std('#2c2c30', .3), cx + dx, h + 0.014, dz, 24));
      if (it.opts.hood !== false) { g.add(box(0.6, 0.45, 0.5, std('#d9dcdf', .35, .5), cx, 1.75, -d / 2 + 0.25)); g.add(box(0.3, 0.6, 0.3, std('#d9dcdf', .35, .5), cx, 2.25, -d / 2 + 0.15)); light(g, '#fff6e8', 1.5, cx, 1.5, 0); } return g; } },
  bathtub: { name: '浴槽', emoji: '🛁', cat: '水まわり', equip: true, kind: 'floor', size: [1.6, 0.6, 0.75], range: { w: [1.2, 1.8], h: [0.5, 0.7], d: [0.65, 0.9] }, color: '#f6f6f3', opts: {}, words: ['浴槽', 'バスタブ', 'お風呂', '風呂', 'ふろ'],
    build(it) { const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .25); g.add(box(w, h, d, m, 0, h / 2, 0)); g.add(box(w - 0.16, 0.02, d - 0.16, std('#cfe6f2', .1, .1), 0, h - 0.12, 0)); const rim = box(w, 0.03, d, m, 0, h - 0.015, 0); g.add(rim); g.add(box(w - 0.16, 0.2, d - 0.16, std('#dde3e8', .2), 0, h - 0.11, 0)); g.add(cyl(0.015, 0.015, 0.12, std(METAL, .3, .8), -w * 0.4, h + 0.04, -d / 2 + 0.1, 10)); return g; } },
  // ユニットバス(1616など)。浴槽は奥(-z)、洗い場は手前、水栓・鏡・カウンターは洗い場の左の壁。壁・天井・床の色は部屋の「床・壁」で変える
  unitbath: { name: 'ユニットバス(浴槽と水栓のセット)', emoji: '🛀', cat: '水まわり', equip: true, kind: 'floor', size: [1.6, 2.0, 1.6], range: { w: [1.2, 2.0], h: [1.9, 2.3], d: [1.2, 2.4] }, color: '#f6f6f3', opts: { mirror: true, counter: true }, words: ['ユニットバス', 'システムバス', '浴室セット', 'お風呂のセット'], params: [['mirror', '鏡', 'bool'], ['counter', 'カウンター', 'bool']],
    build(it) {
      const g = new THREE.Group(), w = it.w, d = it.d, m = std(it.color, .2), metal = std(METAL, .2, .9), white = std('#fbfbfa', .3);
      const tD = Math.min(0.8, d * 0.5), tH = 0.52, z0 = -d / 2 + tD / 2, t = 0.07;
      // 浴槽:前の面(エプロン)・奥・左右と、中の底・お湯
      g.add(box(w - 0.02, tH, t, m, 0, tH / 2, z0 + tD / 2 - t / 2)); g.add(box(w - 0.02, tH, t, m, 0, tH / 2, z0 - tD / 2 + t / 2));
      g.add(box(t, tH, tD, m, -w / 2 + 0.01 + t / 2, tH / 2, z0)); g.add(box(t, tH, tD, m, w / 2 - 0.01 - t / 2, tH / 2, z0));
      g.add(box(w - 0.02 - t * 2, 0.06, tD - t * 2, std('#eef2f4', .2), 0, 0.03, z0));
      const water = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02 - t * 2, tH - 0.2, tD - t * 2), new THREE.MeshStandardMaterial({ color: '#a9d6ea', roughness: .05, metalness: .1, transparent: true, opacity: .55 })); water.position.set(0, (tH - 0.2) / 2 + 0.06, z0); g.add(water);
      g.add(box(w - 0.3, 0.004, 0.004, std('#d8d8d4', .4), 0, tH * 0.55, z0 + tD / 2 + 0.001));
      // 水栓・シャワー(洗い場の左の壁)
      const wz = z0 + tD / 2 + (d - tD) / 2, xw = -w / 2;
      g.add(box(0.07, 0.07, 0.26, metal, xw + 0.035, 0.8, wz)); g.add(cyl(0.012, 0.012, 0.12, metal, xw + 0.1, 0.77, wz, 10));
      const bar = cyl(0.012, 0.012, 0.9, metal, xw + 0.035, 1.35, wz + 0.28, 10); g.add(bar);
      const head = cyl(0.045, 0.045, 0.025, metal, xw + 0.08, 1.75, wz + 0.28, 16); head.rotation.z = Math.PI / 2.4; g.add(head);
      if (it.opts.counter !== false) { g.add(box(0.17, 0.03, 0.75, white, xw + 0.085, 0.74, wz)); g.add(box(0.12, 0.02, 0.4, white, xw + 0.06, 1.05, wz - 0.15)); }
      if (it.opts.mirror !== false) { const mi = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.8), std('#dfe7ec', .03, 1)); mi.rotation.y = Math.PI / 2; mi.position.set(xw + 0.006, 1.32, wz - 0.12); g.add(mi); }
      // タオル掛け(手前の壁)
      const tb = cyl(0.01, 0.01, 0.5, metal, 0.2, 1.1, d / 2 - 0.04, 8); tb.rotation.z = Math.PI / 2; g.add(tb);
      return g;
    } },
  // 作りつけのクローゼット(天井近くまでの扉。折れ戸の継ぎ目と取っ手)
  closet: { name: 'クローゼット', emoji: '🚪', cat: '家具', kind: 'floor', size: [1.7, 2.3, 0.6], range: { w: [0.8, 3.6], h: [1.8, 2.4], d: [0.45, 0.9] }, color: '#f1efea', opts: {}, words: ['クローゼット', '押入れ', '押し入れ', '物入れ', 'くろーぜっと'],
    build(it) {
      const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .45), metal = std(METAL, .3, .8), line = std('#cfcac0', .6);
      g.add(box(w, h, d - 0.02, std('#e8e5df', .7), 0, h / 2, -0.01)); g.add(box(w, 0.05, 0.03, m, 0, h - 0.025, d / 2 - 0.015));
      const n = Math.max(2, Math.round(w / 0.45)), lw = w / n, dh = h - 0.07;
      for (let i = 0; i < n; i++) { const x = -w / 2 + lw * (i + 0.5); g.add(box(lw - 0.006, dh, 0.025, m, x, dh / 2 + 0.01, d / 2 - 0.0125)); if (i % 2 === 1) g.add(box(0.012, 0.25, 0.02, metal, x - lw / 2 + 0.04, 1.0, d / 2 + 0.01)); if (i > 0) g.add(box(0.004, dh, 0.004, line, x - lw / 2, dh / 2 + 0.01, d / 2 + 0.001)); }
      return g;
    } },
  // 洗濯機(縦型)と洗濯パン
  washer: { name: '洗濯機', emoji: '🫧', cat: '水まわり', equip: true, kind: 'floor', size: [0.6, 1.0, 0.6], range: { w: [0.5, 0.75], h: [0.85, 1.1], d: [0.5, 0.75] }, color: '#f4f4f2', opts: {}, words: ['洗濯機', 'せんたくき', 'ランドリー'],
    build(it) {
      const g = new THREE.Group(), w = it.w, h = it.h, d = it.d, m = std(it.color, .3);
      g.add(box(w + 0.04, 0.06, d + 0.04, std('#e9eaec', .5), 0, 0.03, 0));
      g.add(box(w - 0.02, h - 0.08, d - 0.04, m, 0, 0.06 + (h - 0.08) / 2, 0.01));
      const lid = box(w - 0.06, 0.02, d * 0.62, std('#d8dde2', .15, .1), 0, h - 0.01, 0.04); g.add(lid);
      g.add(box(w - 0.06, 0.1, 0.06, std('#e0e3e6', .3), 0, h - 0.04, -d / 2 + 0.06));
      return g;
    } },
  plant: { name: '観葉植物', emoji: '🪴', cat: 'みどり', kind: 'floor', size: [0.6, 1.4, 0.6], color: '#4e8a5a', opts: {}, words: ['観葉植物', '植物', 'グリーン', '木', '鉢'],
    build(it) { const g = new THREE.Group(), h = it.h, r = it.w / 2; g.add(cyl(r * .4, r * .32, h * .22, std('#b9b1a6', .8), 0, h * .11, 0)); g.add(cyl(r * .38, r * .38, 0.01, std('#3b2a1a', 1), 0, h * .22, 0)); g.add(cyl(0.02, 0.03, h * .5, std('#6b4a2a', .9), 0, h * .45, 0, 8));
      const leaf = std(it.color, .7); const seed = (it.id || '').length; for (let i = 0; i < 9; i++) { const a = i * 2.4 + seed, rr = r * (0.3 + (i % 3) * 0.25), y = h * (0.55 + (i % 4) * 0.11); const s = sph(r * (0.28 + (i % 2) * 0.1), leaf, Math.cos(a) * rr, y, Math.sin(a) * rr); s.scale.set(1.2, 0.7, 1); g.add(s); } return g; } },
};

function chairGroup(mat) {
  const g = new THREE.Group(); g.add(box(0.42, 0.04, 0.42, mat, 0, 0.44, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.035, 0.42, 0.035, mat, x * 0.18, 0.21, z * 0.18)); g.add(box(0.42, 0.42, 0.03, mat, 0, 0.67, -0.19)); return g;
}

export const CATEGORIES = ['窓まわり', '照明', '敷物', '家具', '壁かざり', 'みどり'];
export const EQUIP_CATEGORIES = ['電気', '空調・換気', '水まわり'];
export function catalogEntry(type) { return CATALOG[type] || null; }

let seq = 0;
export function newItem(type, over = {}) {
  const c = CATALOG[type]; if (!c) return null;
  const it = { id: 'i' + Date.now().toString(36) + (seq++).toString(36), type, roomId: null, x: 0, y: 0, z: 0, rot: 0, w: c.size[0], h: c.size[1], d: c.size[2], color: c.color, fabric: c.fabric || null, opts: { ...(c.opts || {}) } };
  return Object.assign(it, over);
}

// アイテム → 3D(位置・向きは呼び出し側で)
export function buildItem(it, assets) {
  const c = CATALOG[it.type]; if (!c) return null;
  it._assets = assets; const g = c.build(it); delete it._assets;
  g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); mergeGroup(g);
  g.name = 'item:' + it.id; g.userData.itemId = it.id; g.traverse(o => { if (o.isMesh) o.userData.itemId = it.id; });
  g.position.set(it.x, it.y, it.z); g.rotation.y = it.rot || 0;
  return g;
}
// 言葉 → 種類
export function typeByWord(text) {
  let best = null, bestLen = 0;
  for (const [type, c] of Object.entries(CATALOG)) for (const w of c.words) if (text.includes(w) && w.length > bestLen) { best = type; bestLen = w.length; }
  return best;
}
