const CACHE_NAME = 'sone-admin-v3';
const URLS_TO_CACHE = ['./index.html', './manifest.json', './sonelogo1.png', './sonelogo.png', './sonfront.png'];

self.addEventListener('install', event => { 
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))); 
    self.skipWaiting();
});
self.addEventListener('activate', event => { 
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); }))));
    self.clients.claim();
});
self.addEventListener('fetch', event => { 
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request))); 
});
