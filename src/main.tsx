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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
