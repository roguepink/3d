// 描画の土台:レンダラー・光・空・カメラ・当たり判定
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.quality = 'normal'; this.applyQuality();
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200); this.camera.position.set(0, 1.5, 0);
    this.orbitCam = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.orbit = new OrbitControls(this.orbitCam, canvas); this.orbit.enabled = false; this.orbit.enableDamping = true; this.orbit.maxPolarAngle = Math.PI / 2 - 0.02;
    // 環境(反射用)
    const pmrem = new THREE.PMREMGenerator(r); this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; s.environment = this.envTex; s.environmentIntensity = 0.55;
    // 空・地面
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color('#6fa8e0') }, bottom: { value: new THREE.Color('#dfeaf4') }, mix: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(normalize(vP).y*1.6+0.1,0.,1.); gl_FragColor = vec4(mix(bottom, top, pow(t,0.6)),1.); }' }));
    s.add(this.sky);
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ color: '#8fae6e', roughness: 1 })); this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.02; this.ground.receiveShadow = true; s.add(this.ground);
    // 光
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.6); this.sun.position.set(6, 10, 4); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50; this.sun.shadow.mapSize.set(1536, 1536); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02;
    s.add(this.sun); s.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#6b6050', 0.9); s.add(this.hemi);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.15); s.add(this.ambient);
    this.garden = new THREE.Group(); s.add(this.garden); this.placeGarden(2, 2, 4);
    s.fog = new THREE.Fog('#dfeaf4', 25, 110);
    this.houseGroup = new THREE.Group(); s.add(this.houseGroup);
    this.itemGroup = new THREE.Group(); s.add(this.itemGroup);
    this.helperGroup = new THREE.Group(); s.add(this.helperGroup);
    this.pickables = []; this.raycaster = new THREE.Raycaster(); this.raycaster.far = 60;
    this.night = false; this.mode = 'walk';
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock(); this.onFrame = null; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    this.frames = 0; this.fpsT = performance.now(); this.fps = 60;
  }
  applyQuality() {
    const dpr = window.devicePixelRatio || 1;
    const scale = this.quality === 'low' ? Math.min(dpr, 1) : this.quality === 'high' ? Math.min(dpr, 3) : Math.min(dpr, 1.75);
    this.renderer.setPixelRatio(scale); this.renderer.shadowMap.enabled = this.quality !== 'low';
    this.scene && this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  resize() { const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight; this.renderer.setSize(w, h, false); for (const c of [this.camera, this.orbitCam]) { c.aspect = w / h; c.updateProjectionMatrix(); } }
  setNight(on) {
    this.night = on; const u = this.sky.material.uniforms;
    if (on) { u.top.value.set('#0b1230'); u.bottom.value.set('#2a2f4a'); this.sun.intensity = 0.0; this.hemi.intensity = 0.12; this.ambient.intensity = 0.05; this.scene.environmentIntensity = 0.18; this.ground.material.color.set('#2d3a2a'); this.renderer.toneMappingExposure = 1.05; this.scene.fog.color.set('#1a2038'); }
    else { u.top.value.set('#6fa8e0'); u.bottom.value.set('#dfeaf4'); this.sun.intensity = 2.6; this.hemi.intensity = 0.9; this.ambient.intensity = 0.15; this.scene.environmentIntensity = 0.55; this.ground.material.color.set('#8fae6e'); this.renderer.toneMappingExposure = 1.0; this.scene.fog.color.set('#dfeaf4'); }
  }
  // 家のまわりに、生け垣と木を置く(窓から外を見たときの景色)
  placeGarden(cx, cz, radius) {
    const g = this.garden; while (g.children.length) g.remove(g.children[0]);
    const hedge = new THREE.MeshStandardMaterial({ color: '#4f7f3f', roughness: 1 }), trunk = new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 1 }), leaf = new THREE.MeshStandardMaterial({ color: '#5f9a4a', roughness: .95 }), fence = new THREE.MeshStandardMaterial({ color: '#cfc3b0', roughness: .9 });
    const R = radius + 6; let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, a2 = (i + 1) / 24 * Math.PI * 2; const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, x2 = cx + Math.cos(a2) * R, z2 = cz + Math.sin(a2) * R; const len = Math.hypot(x2 - x, z2 - z);
      const h = new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 1.3 + rnd() * 0.3, 0.7), hedge); h.position.set((x + x2) / 2, 0.65, (z + z2) / 2); h.rotation.y = -Math.atan2(z2 - z, x2 - x); h.castShadow = true; h.receiveShadow = true; g.add(h);
      const f = new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 1.7, 0.08), fence); f.position.set(cx + Math.cos((a + a2) / 2) * (R + 0.6), 0.85, cz + Math.sin((a + a2) / 2) * (R + 0.6)); f.rotation.y = h.rotation.y; f.receiveShadow = true; g.add(f); }
    for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, r = R + 2 + rnd() * 6, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, th = 2.2 + rnd() * 2;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, th, 8), trunk); t.position.set(x, th / 2, z); t.castShadow = true; g.add(t);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.9 + rnd() * 0.7, 12, 9), leaf); c.position.set(x + (rnd() - .5) * 1.2, th + 0.3 + k * 0.6 + rnd() * 0.3, z + (rnd() - .5) * 1.2); c.castShadow = true; g.add(c); } }
  }
  setSunTarget(cx, cz, radius) { this.placeGarden(cx, cz, radius); this.sun.target.position.set(cx, 0, cz); this.sun.position.set(cx + radius * 0.8, radius * 1.6 + 4, cz + radius * 0.6); const sc = this.sun.shadow.camera; const r = radius + 2; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.far = radius * 4 + 20; sc.updateProjectionMatrix(); }
  activeCamera() { return this.mode === 'walk' ? this.camera : this.orbitCam; }
  // 画面の点(0..1)からの当たり判定
  pick(nx, ny, objects = this.pickables) {
    this.raycaster.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.activeCamera());
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits.find(h => (h.object.visible || h.object.userData.ghost) && h.object.userData.kind !== 'pano') || null;
  }
  pickAll(nx, ny, objects) { this.raycaster.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.activeCamera()); return this.raycaster.intersectObjects(objects, true); }
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.onFrame) this.onFrame(dt);
    if (this.mode !== 'walk') this.orbit.update();
    this.renderer.render(this.scene, this.activeCamera());
    this.frames++; const now = performance.now(); if (now - this.fpsT > 1000) { this.fps = this.frames * 1000 / (now - this.fpsT); this.frames = 0; this.fpsT = now; }
  }
  screenshot() { this.renderer.render(this.scene, this.activeCamera()); return new Promise(res => this.canvas.toBlob(res, 'image/jpeg', 0.92)); }
}
