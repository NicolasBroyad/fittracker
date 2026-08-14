const CACHE_NAME = 'registro-peso-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/auth.js',
  '/js/chart-modal.js',
  '/js/chart.js',
  '/js/config.js',
  '/js/derived.js',
  '/js/export.js',
  '/js/goal.js',
  '/js/main.js',
  '/js/modal.js',
  '/js/render.js',
  '/js/routines-derived.js',
  '/js/routines-render.js',
  '/js/routines-state.js',
  '/js/routines-storage.js',
  '/js/routines.js',
  '/js/seed-data.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/theme.js',
  '/js/utils.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first para los archivos propios de la app (mismo origen);
// todo lo demás (Supabase, CDN de supabase-js) pasa directo a la red.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
