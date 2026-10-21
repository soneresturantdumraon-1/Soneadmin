// Sone owner - network-first (hamesha naya code), offline par cache se
const CACHE = 'sone-owner-v2';
const ASSETS = ["./", "index.html", "app.js", "app.css", "ios.css", "sone.js", "config.js", "manifest.json", "sonelogo.png", "icon-192.png", "staff.js", "pos.js", "menu-seed.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('./'))));
});
