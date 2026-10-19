// 歩き回る操作:左半分で歩く(ジョイスティック)、右半分で見回す。PC はキーボード W A S D と マウス。スマホの傾きも。
import * as THREE from 'three';

export class WalkControls {
  constructor(camera, dom, opts = {}) {
    this.camera = camera; this.dom = dom; this.yaw = 0; this.pitch = 0; this.speed = 1.6; this.eye = 1.5;
    this.move = new THREE.Vector2(); this.keys = {}; this.enabled = true; this.canWalk = opts.canWalk || (() => true);
    this.onTap = opts.onTap || null; this.onDragItem = opts.onDragItem || null; this.hitTest = opts.hitTest || (() => null); this.onZoom = opts.onZoom || null; this.active = new Map(); this.pinchZ = null;
    dom.addEventListener('wheel', e => { if (!this.enabled || !this.onZoom) return; e.preventDefault(); this.onZoom(e.deltaY < 0 ? 1.08 : 1 / 1.08, true); }, { passive: false });
    this.joy = { active: false, id: null, cx: 0, cy: 0 }; this.look = { active: false, id: null, x: 0, y: 0, moved: 0, t0: 0 };
    this.drag = { active: false, id: null };
    this.gyro = { on: false, q: new THREE.Quaternion(), screen: 0, base: null };
    this.joyEl = opts.joyEl; this.knobEl = opts.knobEl;
    dom.addEventListener('pointerdown', e => this.down(e)); dom.addEventListener('pointermove', e => this.moveEv(e)); dom.addEventListener('pointerup', e => this.up(e)); dom.addEventListener('pointercancel', e => this.up(e));
    window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; this.keys[e.code] = true; }); window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    dom.addEventListener('contextmenu', e => e.preventDefault());
    this.pinch = { d: 0 };
  }
  down(e) {
    if (this.enabled) { this.active.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.active.size === 2 && this.onZoom) { const [a, b] = [...this.active.values()]; this.pinchZ = { d0: Math.hypot(a.x - b.x, a.y - b.y), ids: [...this.active.keys()] }; if (this.look.active) this.look.active = false; if (this.joy.active) { this.joy.active = false; this.move.set(0, 0); this.placeJoy(0, 0, false, true); } this.drag.active = false; return; } }
    if (!this.enabled) { this.tapOnly = { x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, id: e.pointerId }; return; } const w = this.dom.clientWidth;
    this.dom.setPointerCapture && this.dom.setPointerCapture(e.pointerId);
    // 選んだアイテムの上なら引っぱって動かす
    if (this.onDragItem && !this.joy.active && !this.look.active) { const h = this.hitTest(e.clientX / this.dom.clientWidth, e.clientY / this.dom.clientHeight); if (h && h.itemId && h.selected) { this.drag = { active: true, id: e.pointerId, itemId: h.itemId }; this.onDragItem('start', e, h); return; } }
    if (e.pointerType === 'touch' && e.clientX < w * 0.45 && e.clientY > this.dom.clientHeight * 0.45 && !this.joy.active) { this.joy = { active: true, id: e.pointerId, cx: e.clientX, cy: e.clientY, t0: performance.now() }; this.placeJoy(e.clientX, e.clientY, true); return; }
    if (!this.look.active) { this.look = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t0: performance.now(), sx: e.clientX, sy: e.clientY }; }
  }
  moveEv(e) {
    if (this.active.has(e.pointerId)) this.active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinchZ) { if (this.active.size >= 2) { const [a, b] = [...this.active.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (this.pinchZ.d0 > 10) { this.onZoom(d / this.pinchZ.d0, false, this.pinchZ); } } return; }
    if (this.tapOnly && e.pointerId === this.tapOnly.id) { this.tapOnly.moved += Math.abs(e.clientX - this.tapOnly.x) + Math.abs(e.clientY - this.tapOnly.y); this.tapOnly.x = e.clientX; this.tapOnly.y = e.clientY; return; }
    if (this.drag.active && e.pointerId === this.drag.id) { this.onDragItem('move', e); return; }
    if (this.joy.active && e.pointerId === this.joy.id) { const dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy, R = 50; const l = Math.hypot(dx, dy), k = l > R ? R / l : 1; this.move.set(dx * k / R, -dy * k / R); this.placeJoy(this.joy.cx + dx * k, this.joy.cy + dy * k, false); return; }
    if (this.look.active && e.pointerId === this.look.id) { const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y; this.look.x = e.clientX; this.look.y = e.clientY; this.look.moved += Math.abs(dx) + Math.abs(dy); const k = 0.0045 * (e.pointerType === 'mouse' ? 0.7 : 1); this.yaw -= dx * k; this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - dy * k)); }
  }
  up(e) {
    this.active.delete(e.pointerId); if (this.pinchZ) { if (this.active.size < 2) { this.pinchZ = null; if (this.onZoom) this.onZoom(1, false, null); } return; }
    if (this.tapOnly && e.pointerId === this.tapOnly.id) { const t = this.tapOnly; this.tapOnly = null; if (t.moved < 8 && performance.now() - t.t0 < 400 && this.onTap) this.onTap(e.clientX / this.dom.clientWidth, e.clientY / this.dom.clientHeight, e); return; }
    if (this.drag.active && e.pointerId === this.drag.id) { this.onDragItem('end', e); this.drag = { active: false, id: null }; return; }
    if (this.joy.active && e.pointerId === this.joy.id) { const quick = performance.now() - this.joy.t0 < 250 && Math.hypot(e.clientX - this.joy.cx, e.clientY - this.joy.cy) < 8; this.joy.active = false; this.move.set(0, 0); this.placeJoy(0, 0, false, true); if (quick && this.onTap) this.onTap(e.clientX / this.dom.clientWidth, e.clientY / this.dom.clientHeight, e); return; }
    if (this.look.active && e.pointerId === this.look.id) { const tap = this.look.moved < 8 && performance.now() - this.look.t0 < 400; this.look.active = false; if (tap && this.onTap) this.onTap(e.clientX / this.dom.clientWidth, e.clientY / this.dom.clientHeight, e); }
  }
  placeJoy(x, y, start, reset) {
    if (!this.joyEl) return; if (reset) { this.joyEl.style.left = ''; this.joyEl.style.top = ''; this.joyEl.style.bottom = ''; this.knobEl.style.transform = ''; return; }
    if (start) { this.joyEl.style.left = (x - 60) + 'px'; this.joyEl.style.top = (y - 60 - this.joyEl.parentElement.getBoundingClientRect().top) + 'px'; this.joyEl.style.bottom = 'auto'; }
    else this.knobEl.style.transform = `translate(${x - this.joy.cx}px, ${y - this.joy.cy}px)`;
  }
  setGyro(on) {
    if (on && !this.gyro.on) {
      const start = () => { this.gyro.on = true; this.gyro.base = null; window.addEventListener('deviceorientation', this._gyroHandler = ev => this.onGyro(ev), true); };
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') start(); }).catch(() => {});
      else start();
    } else if (!on && this.gyro.on) { this.gyro.on = false; window.removeEventListener('deviceorientation', this._gyroHandler, true); }
    return this.gyro.on;
  }
  onGyro(ev) {
    if (ev.alpha == null) return; const z = THREE.MathUtils.degToRad(ev.alpha), x = THREE.MathUtils.degToRad(ev.beta), y = THREE.MathUtils.degToRad(ev.gamma);
    const orient = THREE.MathUtils.degToRad((screen.orientation && screen.orientation.angle) || window.orientation || 0);
    const e = new THREE.Euler(x, z, -y, 'YXZ'); const q = new THREE.Quaternion().setFromEuler(e).multiply(new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient));
    const eu = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    if (this.gyro.base == null) this.gyro.base = eu.y - this.yaw;
    this.yaw = eu.y - this.gyro.base; this.pitch = Math.max(-1.3, Math.min(1.3, eu.x));
  }
  update(dt) {
    if (!this.enabled) return;
    let f = this.move.y, s = this.move.x;
    if (this.keys.KeyW || this.keys.ArrowUp) f += 1; if (this.keys.KeyS || this.keys.ArrowDown) f -= 1; if (this.keys.KeyA || this.keys.ArrowLeft) s -= 1; if (this.keys.KeyD || this.keys.ArrowRight) s += 1;
    if (this.keys.KeyQ) this.yaw += dt * 1.5; if (this.keys.KeyE) this.yaw -= dt * 1.5;
    const sp = this.speed * (this.keys.ShiftLeft ? 2 : 1);
    if (f || s) {
      const dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const step = dir.multiplyScalar(f * sp * dt).add(right.multiplyScalar(s * sp * dt));
      const p = this.camera.position.clone().add(step);
      if (this.canWalk(p)) this.camera.position.copy(p);
      else { const px = this.camera.position.clone(); px.x += step.x; if (this.canWalk(px)) this.camera.position.copy(px); else { const pz = this.camera.position.clone(); pz.z += step.z; if (this.canWalk(pz)) this.camera.position.copy(pz); } }
    }
    this.camera.position.y = this.eye;
    this.camera.rotation.set(0, 0, 0); this.camera.rotation.order = 'YXZ'; this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
  }
  lookAt(x, z) { const dx = x - this.camera.position.x, dz = z - this.camera.position.z; this.yaw = Math.atan2(-dx, -dz); this.pitch = 0; }
}
