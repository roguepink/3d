// 見本の家(リビング・寝室・廊下)
import { newItem } from './items.js';
export function demoProject() {
  const rooms = [
    { id: 'living', name: 'リビング', x: 0, z: 0, w: 5.4, d: 4.0, h: 2.45, floor: { lib: 'oak' }, ceiling: { color: '#f7f6f2' }, walls: { N: { lib: 'wp_white' }, E: { lib: 'wp_white' }, S: { lib: 'wp_white' }, W: { lib: 'wp_blue' } },
      openings: [ { id: 'o1', side: 'N', type: 'window', pos: 1.2, w: 2.6, h: 1.9, sill: 0.35 }, { id: 'o2', side: 'E', type: 'door', pos: 1.2, w: 0.85, h: 2.0, open: 0.8 }, { id: 'o3', side: 'W', type: 'window', pos: 1.3, w: 1.2, h: 1.1, sill: 0.95 } ],
      parts: [ { id: 'p1', type: 'column', x: 4.95, z: 0, w: 0.45, d: 0.45 }, { id: 'p2', type: 'wall', x1: 5.4, z1: 3.3, x2: 4.6, z2: 3.3, h: 1.1 }, { id: 'p3', type: 'beam', x: 0, z: 2.6, w: 5.4, d: 0.3, drop: 0.25 } ] },
    { id: 'bed', name: '寝室', x: 5.52, z: 0, w: 3.6, d: 4.0, h: 2.45, poly: [[5.52, 0], [8.42, 0], [9.12, 0.7], [9.12, 4.0], [5.52, 4.0]], floor: { lib: 'carpet_b' }, ceiling: { color: '#f7f6f2' }, walls: { 0: { lib: 'wp_navy' }, 1: { lib: 'wp_navy' }, 2: { lib: 'wp_warm' }, 3: { lib: 'wp_warm' }, 4: { lib: 'wp_warm' } },
      openings: [ { id: 'o4', edge: 4, type: 'door', u: 1.95, w: 0.85, h: 2.0, twin: 'o2' }, { id: 'o5', edge: 0, type: 'window', u: 0.7, w: 1.6, h: 1.2, sill: 0.9 }, { id: 'o6', edge: 3, type: 'door', u: 2.4, w: 0.8, h: 2.0, open: 0.0 } ] },
    { id: 'hall', name: '廊下', x: 5.52, z: 4.12, w: 3.6, d: 1.4, h: 2.4, floor: { lib: 'tile_w' }, ceiling: { color: '#f7f6f2' }, walls: { N: { lib: 'wp_white' }, E: { lib: 'wp_white' }, S: { lib: 'wp_white' }, W: { lib: 'wp_white' } },
      openings: [ { id: 'o7', side: 'N', type: 'door', pos: 0.4, w: 0.8, h: 2.0, twin: 'o6' } ] },
  ];
  const items = [];
  const add = (type, roomId, x, y, z, rot, over = {}) => { const it = newItem(type, { roomId, x, y, z, rot, ...over }); items.push(it); return it; };
  // リビング
  add('curtain', 'living', 2.5, 1.2, 0.0, 0, { w: 3.0, h: 2.3, color: '#cbb89a', opts: { open: 0.35, lace: true } });
  add('roller', 'living', 0.0, 1.55, 1.9, Math.PI / 2, { w: 1.4, h: 1.3, color: '#efe9dc', opts: { down: 0.6 } });
  add('ceilingLight', 'living', 2.7, 2.45, 2.0, 0, { w: 0.6 });
  add('sofa', 'living', 2.7, 0, 2.9, Math.PI, { color: '#8c95a3', w: 2.0 });
  add('lowtable', 'living', 2.7, 0, 1.9, 0, {});
  add('rug', 'living', 2.7, 0, 2.1, 0, { w: 2.4, d: 1.7, color: '#bfae94' });
  add('tvboard', 'living', 2.7, 0, 0.35, 0, { w: 1.6 });
  add('shelf', 'living', 4.9, 0, 0.5, -Math.PI / 2, {});
  add('plant', 'living', 0.45, 0, 3.5, 0, {});
  add('wallLight', 'living', 5.4, 1.8, 3.2, -Math.PI / 2, {});
  add('picture', 'living', 5.4, 1.5, 2.6, -Math.PI / 2, { w: 0.7, h: 0.5 });
  add('floorLamp', 'living', 4.9, 0, 3.5, 0, {});
  // 寝室
  add('bed', 'bed', 7.3, 0, 1.4, 0, {});
  add('curtain', 'bed', 7.32, 1.05, 0.0, 0, { w: 2.0, h: 2.0, color: '#6c7a9c', fabric: 'linen', opts: { open: 0.2, lace: true } });
  add('pendant', 'bed', 7.3, 2.45, 2.0, 0, { color: '#2f2f33', opts: { on: true, drop: 0.8, power: 1 } });
  add('rug', 'bed', 7.3, 0, 3.0, 0, { w: 1.6, d: 1.0, color: '#d9cdb8', opts: { round: true } });
  add('desk', 'bed', 8.6, 0, 3.1, -Math.PI / 2, { w: 1.0 });
  add('chair', 'bed', 8.0, 0, 3.1, Math.PI / 2, {});
  // 廊下
  add('downlight', 'hall', 6.4, 2.4, 4.8, 0, {}); add('downlight', 'hall', 8.2, 2.4, 4.8, 0, {});
  add('mirror', 'hall', 9.12, 1.3, 4.8, -Math.PI / 2, { w: 0.45, h: 1.1 });
  return { v: 1, name: '見本の家', rooms, items, assets: {}, settings: { night: false }, camera: { x: 2.7, z: 3.6, yaw: 0 } };
}
