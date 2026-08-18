const CACHE_NAME = 'registro-peso-v17';
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
  '/js/phases.js',
  '/js/gym-render.js',
  '/js/home-render.js',
  '/js/main.js',
  '/js/modal.js',
  '/js/render.js',
  '/js/routines-derived.js',
  '/js/routines-dnd.js',
  '/js/routines-render.js',
  '/js/routines-state.js',
  '/js/routines-storage.js',
  '/js/routines.js',
  '/js/screens.js',
  '/js/seed-data.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/swipe-nav.js',
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

// El shell (navegación / index.html) va network-first: siempre trae la versión más nueva cuando
// hay conexión, y solo cae al cache si está offline. Evita quedar con un index.html viejo pidiendo
// archivos .js nuevos (o viceversa) — mezcla de versiones que rompía la carga en iOS standalone.
// El resto de los archivos propios (JS/CSS/íconos) sigue cache-first con revalidación en segundo
// plano; al estar todos versionados juntos bajo el mismo CACHE_NAME, alcanza con que el shell esté
// siempre fresco para que el resto se resuelva consistente.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isShell = event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  if (isShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

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
