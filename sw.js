/* Sone Restaurant – Service Worker (offline page ke saath) */
const VER = 'sone-v6';
const CORE = ['offline.html', 'favicon-192.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;           // Supabase, CDN, maps: seedha network

  // Page khulna: pehle network, na mile to Offline page
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).catch(() => caches.match('offline.html').then(x => x || new Response('Internet nahi hai', { status: 503 })))
    );
    return;
  }
  // Icons/images: cache se tez, peeche se update
  if (/\.(png|ico|jpg|jpeg|svg|webp|json)$/i.test(u.pathname)) {
    e.respondWith(
      caches.open(VER).then(c => c.match(r).then(hit => {
        const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});

// Notification par tap: app kholo / wapas laao
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
