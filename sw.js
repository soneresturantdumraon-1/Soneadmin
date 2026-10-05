const CACHE_NAME = 'sone-admin-v1';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './sonelogo1.png',
  './sonfront.png',
  './sonein.png'
];

self.addEventListener('install', event => {
  event.waitUntil( caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)) );
});

self.addEventListener('activate', event => {
  event.waitUntil( caches.keys().then(keys => Promise.all(keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); }))) );
});

self.addEventListener('fetch', event => {
  event.respondWith( caches.match(event.request).then(res => res || fetch(event.request)) );
});
