import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Old long VIP links (?vipToken=...&trackId=...) are retired. Strip those
// parameters before React starts so the legacy client-side unlock path can no
// longer be used from a normal page URL.
if (!window.location.pathname.startsWith('/share/')) {
  const legacyUrl = new URL(window.location.href);
  if (legacyUrl.searchParams.has('vipToken') || legacyUrl.searchParams.has('trackId')) {
    legacyUrl.searchParams.delete('vipToken');
    legacyUrl.searchParams.delete('trackId');
    const query = legacyUrl.searchParams.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${legacyUrl.pathname}${query ? `?${query}` : ''}${legacyUrl.hash}`
    );
  }
}

// Share pages embed the real track id in HTML metadata. Temporarily expose it
// through the existing ?track bootstrap contract, then restore the exact
// original query string. The exact restoration matters for VIP links whose
// password is intentionally a bare query such as ?1234 rather than ?p=1234.
const embeddedShareTrack = document
  .querySelector<HTMLMetaElement>('meta[name="echostars-share-track"]')
  ?.content.trim();
const originalShareSearch = window.location.pathname.startsWith('/share/')
  ? window.location.search
  : '';
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
    if (window.location.pathname.startsWith('/share/')) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${originalShareSearch}${window.location.hash}`
      );
    }
  }, 1000);
}
