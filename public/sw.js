const CACHE_NAME = 'echostars-shell-v15';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('echostars-shell-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    (url.pathname.startsWith('/api/') && url.pathname !== '/api/tracks')
  ) return;

  const navigation = event.request.mode === 'navigate';
  const staticAsset =
    url.pathname === '/api/tracks' ||
    url.pathname.startsWith('/assets/') ||
    APP_SHELL.includes(url.pathname);

  if (!navigation && !staticAsset) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(navigation ? '/index.html' : event.request, response.clone());
      }
      return response;
    } catch {
      return (
        (await caches.match(event.request)) ||
        (navigation ? await caches.match('/index.html') : undefined) ||
        new Response('目前無法連線，請恢復網路後重試。', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
      );
    }
  })());
});
