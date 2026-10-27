// オフラインでも開けるように、アプリの部品と three.js を保存しておく。
// 部品はいつもネットの最新を先に見る(更新したらそのまま反映)。つながらないときだけ控えを使う。
const VER = 'oheya3d-v11';
const SHELL = ['./', './index.html', './style.css', './manifest.webmanifest', './version.json', './js/main.js', './js/scene3d.js', './js/controls.js', './js/house.js', './js/items.js', './js/textures.js', './js/demo.js', './js/store.js', './js/commands.js', './js/photo.js', './js/plan.js', './js/ai.js', './js/merge.js', './js/thumbs.js', './js/stairs.js', './js/plants.js', './js/link.js', './js/builder.js', './js/claude.js', './js/kit.js', './js/furniture.js', './js/wet.js', './js/film.js', './js/komono.js', './js/wafu.js', './js/angles.js', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  if (u.hostname === 'cdn.jsdelivr.net') { e.respondWith(caches.open(VER).then(async c => { const hit = await c.match(e.request); if (hit) return hit; const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; })); return; }
  if (u.origin !== location.origin) return;
  // 控えは「?v=…」を外した名前で1つだけ持つ(古い版がたまらないように)
  const key = u.origin + u.pathname;
  e.respondWith(fetch(e.request.mode === 'navigate' ? new Request(u.href, { cache: 'no-cache' }) : new Request(e.request, { cache: 'no-cache' })).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(VER).then(c => c.put(key, copy)); }
    return r;
  }).catch(() => caches.match(key).then(h => h || caches.match(e.request, { ignoreSearch: true })).then(h => h || caches.match('./index.html'))));
});
