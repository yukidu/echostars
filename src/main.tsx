import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Share pages embed the real track id in HTML metadata. Temporarily expose it
// through the existing ?track bootstrap contract, then restore the clean
// /share/PASSPORT-NAME-001 address after React has captured the id.
const embeddedShareTrack = document
  .querySelector<HTMLMetaElement>('meta[name="echostars-share-track"]')
  ?.content.trim();
let removeBootstrapTrackParam = false;
if (embeddedShareTrack && window.location.pathname.startsWith('/share/')) {
  const bootstrapUrl = new URL(window.location.href);
  if (!bootstrapUrl.searchParams.get('track')) {
    bootstrapUrl.searchParams.set('track', embeddedShareTrack);
    window.history.replaceState(
      window.history.state,
      '',
      `${bootstrapUrl.pathname}${bootstrapUrl.search}${bootstrapUrl.hash}`
    );
    removeBootstrapTrackParam = true;
  }
}

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

if (removeBootstrapTrackParam && embeddedShareTrack) {
  window.setTimeout(() => {
    const cleanUrl = new URL(window.location.href);
    if (
      cleanUrl.pathname.startsWith('/share/') &&
      cleanUrl.searchParams.get('track') === embeddedShareTrack
    ) {
      cleanUrl.searchParams.delete('track');
      const query = cleanUrl.searchParams.toString();
      window.history.replaceState(
        window.history.state,
        '',
        `${cleanUrl.pathname}${query ? `?${query}` : ''}${cleanUrl.hash}`
      );
    }
  }, 1000);
}
