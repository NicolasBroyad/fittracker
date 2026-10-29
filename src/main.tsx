import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initApi } from './api';
import { App } from './app/App';
import './index.css';

initApi().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

// la 1.x cacheaba sus archivos en cachés propios ("fittracker-v1"...): ya no se usan
if ('caches' in window) {
  void caches.keys().then((keys) => keys.filter((k) => /^fittracker-v\d+$/.test(k)).forEach((k) => void caches.delete(k)));
}

// Actualizaciones: el navegador solo busca un service worker nuevo al cargar la página de cero. La
// PWA en el iPhone casi nunca se recarga (se retoma desde segundo plano), así que también se busca
// al volver a primer plano y cada hora. Si hay versión nueva, se instala y la página se recarga sola.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) =>
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => {
          if (navigator.onLine) void registration.update().catch(() => undefined);
        };
        setInterval(check, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      },
    }),
  );
}
