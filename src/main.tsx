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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
