// 描く回数を減らすため、同じ材質の部品をひとつにまとめる(スマホで軽くなる)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// root の中の 普通のメッシュを、材質ごとにまとめる(InstancedMesh・光・userData.keep は残す)
export function mergeGroup(root, filter) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(); const remove = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material) || (filter && !filter(o))) return;
    const g = o.geometry; if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    if (g.index === null && buckets.size === 0) { /* 非インデックスでも可 */ }
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const geo = g.index ? g.toNonIndexed() : g.clone(); geo.applyMatrix4(m);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    const key = o.material.uuid + '|' + (o.userData.mergeKey || ''); if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: o.castShadow, recv: o.receiveShadow, ud: o.userData });
    buckets.get(key).geos.push(geo); remove.push(o);
  });
  if (remove.length < 2) return root;
  for (const o of remove) o.parent && o.parent.remove(o);
  for (const [, b] of buckets) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.userData = { ...b.ud }; root.add(mesh);
  }
  // 空になったグループを掃除
  const empties = []; root.traverse(o => { if (o !== root && o.isGroup && o.children.length === 0 && !o.userData.lights) empties.push(o); }); for (const e of empties) e.parent && e.parent.remove(e);
  return root;
}
