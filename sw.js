// オフラインでも開けるように、アプリの部品と three.js を保存しておく
const VER = 'oheya3d-v1';
const SHELL = ['./', './index.html', './style.css', './manifest.webmanifest', './js/main.js', './js/scene3d.js', './js/controls.js', './js/house.js', './js/items.js', './js/textures.js', './js/demo.js', './js/store.js', './js/commands.js', './js/photo.js', './js/plan.js', './js/ai.js', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  if (u.hostname === 'cdn.jsdelivr.net') { e.respondWith(caches.open(VER).then(async c => { const hit = await c.match(e.request); if (hit) return hit; const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; })); return; }
  if (u.origin === location.origin) { e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(VER).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then(h => h || caches.match('./index.html')))); }
});
