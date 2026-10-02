import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  let reloadingForUpdate = false;
  let updatePromptInProgress = false;
  const UPDATE_PROMPT_COOLDOWN_KEY = 'echostars_pwa_update_prompted_at_v1';
  const UPDATE_PROMPT_COOLDOWN_MS = 30 * 60 * 1000;

  const offerAppUpdate = (worker: ServiceWorker | null) => {
    if (!worker || !navigator.serviceWorker.controller || updatePromptInProgress) return;

    const lastPromptedAt = Number(localStorage.getItem(UPDATE_PROMPT_COOLDOWN_KEY) || 0);
    if (Date.now() - lastPromptedAt < UPDATE_PROMPT_COOLDOWN_MS) return;

    localStorage.setItem(UPDATE_PROMPT_COOLDOWN_KEY, String(Date.now()));
    updatePromptInProgress = true;
    const shouldUpdate = window.confirm('繁星回聲有新版本，是否現在自動更新？');
    updatePromptInProgress = false;

    if (shouldUpdate) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      if (registration.waiting) {
        offerAppUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            offerAppUpdate(worker);
          }
        });
      });
    }).catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
