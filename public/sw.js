// Offline support: pages are network-first (fresh when online, cached when
// not); build assets and images are cache-first since their URLs are hashed.
const CACHE = 'arh-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/'])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then(hit => hit || caches.match('/'))
        )
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|ico|webp|svg|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        hit =>
          hit ||
          fetch(request).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
            return res;
          })
      )
    );
  }
});
