import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Download, LoaderCircle, X } from 'lucide-react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' | string; platform?: string }>;
}

type RelatedApp = {
  platform?: string;
  id?: string;
  url?: string;
};

type InstallNavigator = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
};

declare global {
  interface Window {
    __ECHOSTARS_INSTALL_PROMPT__?: InstallEvent | null;
  }
}

let promptEvent: InstallEvent | null =
  typeof window !== 'undefined'
    ? (window.__ECHOSTARS_INSTALL_PROMPT__ || null)
    : null;

let installed =
  typeof window !== 'undefined' &&
  (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as InstallNavigator).standalone === true
  );

let revision = 0;
const listeners = new Set<() => void>();
const publish = () => {
  revision += 1;
  listeners.forEach(fn => fn());
};

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as InstallNavigator).standalone === true
  );

const capturePrompt = (event: InstallEvent) => {
  event.preventDefault();
  promptEvent = event;
  window.__ECHOSTARS_INSTALL_PROMPT__ = event;
  installed = false;
  publish();
};

async function detectInstalledPwa() {
  if (isStandalone()) {
    if (!installed) {
      installed = true;
      publish();
    }
    return true;
  }

  const installNavigator = navigator as InstallNavigator;
  if (typeof installNavigator.getInstalledRelatedApps === 'function') {
    try {
      const apps = await installNavigator.getInstalledRelatedApps();
      const hasInstalledPwa = apps.some(app => app.platform === 'webapp');
      if (hasInstalledPwa && !installed) {
        installed = true;
        publish();
      }
      return hasInstalledPwa;
    } catch (error) {
      console.warn('Installed PWA detection failed:', error);
    }
  }

  return false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    capturePrompt(event as InstallEvent);
  });

  window.addEventListener('echostars-install-prompt-ready', () => {
    const event = window.__ECHOSTARS_INSTALL_PROMPT__;
    if (event) capturePrompt(event);
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    promptEvent = null;
    window.__ECHOSTARS_INSTALL_PROMPT__ = null;
    publish();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
    if (event.matches) {
      installed = true;
      publish();
    }
  });
}

export function InstallAppButton({
  className = ''
}: {
  compact?: boolean;
  className?: string;
}) {
  useSyncExternalStore(
    fn => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => revision,
    () => 0
  );

  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstaller, setShowInstaller] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  const readyEvent =
    promptEvent ||
    (typeof window !== 'undefined' ? window.__ECHOSTARS_INSTALL_PROMPT__ || null : null);

  useEffect(() => {
    // Old versions stored an installed hint that could become stale after the user
    // uninstalled the app outside the website. It must never block this button.
    try {
      localStorage.removeItem('echostars_pwa_installed_hint_v1');
      localStorage.removeItem('echostars_pwa_installed_hint_v2');
    } catch {
      // Ignore restricted storage modes.
    }

    void detectInstalledPwa();

    const earlyPrompt = window.__ECHOSTARS_INSTALL_PROMPT__;
    if (earlyPrompt && earlyPrompt !== promptEvent) {
      capturePrompt(earlyPrompt);
    }
  }, []);

  useEffect(() => {
    if (!showInstaller || !installed) return;
    setIsPreparing(false);
  }, [showInstaller]);

  const runNativePrompt = async (event: InstallEvent) => {
    setIsInstalling(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;

      promptEvent = null;
      window.__ECHOSTARS_INSTALL_PROMPT__ = null;

      if (choice.outcome === 'accepted') {
        installed = true;
      }
      publish();
      setShowInstaller(false);
    } catch (error) {
      console.warn('PWA native install prompt failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const prepareInstall = async () => {
    if (isPreparing) return;
    setIsPreparing(true);

    try {
      if (await detectInstalledPwa()) return;

      if ('serviceWorker' in navigator) {
        const registration =
          (await navigator.serviceWorker.getRegistration('/')) ||
          (await navigator.serviceWorker.register('/sw.js'));
        await registration.update().catch(() => {});
        await navigator.serviceWorker.ready.catch(() => registration);
      }

      const event = promptEvent || window.__ECHOSTARS_INSTALL_PROMPT__;
      if (event) {
        publish();
      }
    } catch (error) {
      console.warn('PWA install preparation failed:', error);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleInstall = async () => {
    if (isInstalling) return;

    const event = promptEvent || window.__ECHOSTARS_INSTALL_PROMPT__;
    if (event && !installed) {
      // Fast path: same proven one-click native install flow used by the
      // afternoon build. prompt() is called directly inside the user click.
      await runNativePrompt(event);
      return;
    }

    if (installed || await detectInstalledPwa()) {
      publish();
      return;
    }

    // Never fail silently. If Chromium has not emitted beforeinstallprompt yet,
    // open a tiny readiness panel and prepare the SW/installability state.
    setShowInstaller(true);
    void prepareInstall();
  };

  return (
    <>
      <button
        type="button"
        title={installed ? '繁星回聲已安裝' : readyEvent ? '安裝繁星回聲 App' : '準備安裝繁星回聲 App'}
        aria-label={installed ? '繁星回聲已安裝' : '安裝到桌面'}
        onClick={handleInstall}
        className={
          className ||
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        }
      >
        {isInstalling || isPreparing ? (
          <LoaderCircle className="w-4 h-4 animate-spin" />
        ) : installed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Download className="w-4 h-4" />
        )}

        <span>安裝到桌面</span>

        {installed ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已安裝
          </span>
        ) : readyEvent ? (
          <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            可安裝
          </span>
        ) : (
          <span className="ml-auto text-[10px] font-bold text-slate-400 dark:text-slate-500">
            準備安裝
          </span>
        )}
      </button>

      {showInstaller && !installed && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[1px]"
          onClick={() => setShowInstaller(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="安裝繁星回聲"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                安裝繁星回聲
              </h3>
              <button
                type="button"
                onClick={() => setShowInstaller(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {readyEvent ? (
              <button
                type="button"
                onClick={() => void runNativePrompt(readyEvent)}
                disabled={isInstalling}
                className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary,#c06c84)' }}
              >
                {isInstalling ? '開啟系統安裝中…' : '安裝'}
              </button>
            ) : (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                <LoaderCircle className="w-4 h-4 animate-spin" />
                正在準備系統安裝…
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
