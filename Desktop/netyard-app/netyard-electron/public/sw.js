const CACHE = 'netyard-v1';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','manifest.json']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if(e.request.url.includes('/api/')) return; e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))); });
