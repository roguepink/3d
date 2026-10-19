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
    const sc = this.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02;
    s.add(this.sun); s.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#6b6050', 0.9); s.add(this.hemi);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.15); s.add(this.ambient);
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
    if (on) { u.top.value.set('#0b1230'); u.bottom.value.set('#2a2f4a'); this.sun.intensity = 0.0; this.hemi.intensity = 0.12; this.ambient.intensity = 0.05; this.scene.environmentIntensity = 0.18; this.ground.material.color.set('#2d3a2a'); this.renderer.toneMappingExposure = 1.05; }
    else { u.top.value.set('#6fa8e0'); u.bottom.value.set('#dfeaf4'); this.sun.intensity = 2.6; this.hemi.intensity = 0.9; this.ambient.intensity = 0.15; this.scene.environmentIntensity = 0.55; this.ground.material.color.set('#8fae6e'); this.renderer.toneMappingExposure = 1.0; }
  }
  setSunTarget(cx, cz, radius) { this.sun.target.position.set(cx, 0, cz); this.sun.position.set(cx + radius * 0.8, radius * 1.6 + 4, cz + radius * 0.6); const sc = this.sun.shadow.camera; const r = radius + 2; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.far = radius * 4 + 20; sc.updateProjectionMatrix(); }
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
