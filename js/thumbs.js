// 「置く」一覧用に、各アイテムの小さな見本画像をその場で描く
import * as THREE from 'three';
import { CATALOG, newItem, buildItem } from './items.js';
const cache = new Map(); let R = null, scene = null, cam = null;
function setup() {
  if (R) return; const c = document.createElement('canvas'); c.width = 192; c.height = 128;
  R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#ffffff', '#776655', 1.6)); const d = new THREE.DirectionalLight('#fff4e6', 2.2); d.position.set(2, 4, 3); scene.add(d); const d2 = new THREE.DirectionalLight('#dfe8ff', 0.8); d2.position.set(-3, 2, -2); scene.add(d2);
  cam = new THREE.PerspectiveCamera(32, 1.5, 0.05, 50);
}
export function thumbnail(type, style) {
  const ck = type + '|' + (style || ''); if (cache.has(ck)) return cache.get(ck);
  try {
    setup(); const c = CATALOG[type]; const it = newItem(type, style ? { style } : {}); it.x = it.y = it.z = 0;
    const g = buildItem(it, {}); g.position.set(0, 0, 0); g.rotation.y = 0; g.traverse(o => { if (o.isLight) o.visible = false; }); scene.add(g);
    // 壁のものは、壁の板も添える
    let wall = null; if (c.kind === 'wall') { wall = new THREE.Mesh(new THREE.PlaneGeometry(it.w + 0.6, it.h + 0.5), new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 1 })); wall.position.z = -0.01; scene.add(wall); }
    if (c.kind === 'ceiling') { wall = new THREE.Mesh(new THREE.PlaneGeometry(it.w + 1.2, it.w + 1.2), new THREE.MeshStandardMaterial({ color: '#f2f1ed', roughness: 1 })); wall.rotation.x = Math.PI / 2; wall.position.y = 0.001; scene.add(wall); }
    if (c.kind === 'floor') { wall = new THREE.Mesh(new THREE.PlaneGeometry(it.w * 2 + 1, it.d * 2 + 1), new THREE.MeshStandardMaterial({ color: '#d9c7a6', roughness: 1 })); wall.rotation.x = -Math.PI / 2; wall.position.y = -0.002; scene.add(wall); }
    const box = new THREE.Box3().setFromObject(g); const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()); const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
    const dist = r / Math.tan(cam.fov / 2 * Math.PI / 180) * 1.05;
    if (c.kind === 'wall') cam.position.set(center.x + dist * 0.35, center.y + dist * 0.15, center.z + dist * 0.95);
    else if (c.kind === 'ceiling') cam.position.set(center.x + dist * 0.5, center.y - dist * 0.55, center.z + dist * 0.75);
    else cam.position.set(center.x + dist * 0.75, center.y + dist * 0.55, center.z + dist * 0.75);
    cam.lookAt(center); cam.updateProjectionMatrix(); R.render(scene, cam); const url = R.domElement.toDataURL('image/png');
    scene.remove(g); if (wall) scene.remove(wall); cache.set(ck, url); return url;
  } catch (e) { console.warn('thumb', type, e); cache.set(ck, null); return null; }
}
