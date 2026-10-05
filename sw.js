const CACHE_NAME = 'sone-admin-v2';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['./index.html', './manifest.json', './sonelogo1.png']))); });
self.addEventListener('fetch', event => { event.respondWith(fetch(event.request).catch(() => caches.match(event.request))); });
