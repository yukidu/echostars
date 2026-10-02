import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  // PWA updates are intentionally silent:
  // the browser downloads/activates the newest worker in the background,
  // and the new app version is picked up on the user's next natural reload/reopen.
  // Never interrupt playback or browsing with an update confirmation dialog.
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
