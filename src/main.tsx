import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  let reloadForUpdate = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First-time SW activation is silent. Later controller changes mean a new
    // app version has already been downloaded and activated.
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloadForUpdate) return;

    const shouldReload = window.confirm('繁星回聲有新版本，是否現在重新開啟套用更新？');
    if (shouldReload) {
      reloadForUpdate = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
