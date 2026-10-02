import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Download, LoaderCircle } from 'lucide-react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' | string; platform?: string }>;
}

declare global {
  interface Window {
    __ECHOSTARS_INSTALL_PROMPT__?: InstallEvent | null;
  }
}

const INSTALLED_HINT_KEY = 'echostars_pwa_installed_hint_v2';

const readInstalledHint = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(INSTALLED_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

const writeInstalledHint = (value: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (value) localStorage.setItem(INSTALLED_HINT_KEY, '1');
    else localStorage.removeItem(INSTALLED_HINT_KEY);
  } catch {
    // localStorage may be unavailable in private/restricted browsing modes.
  }
};

let promptEvent: InstallEvent | null =
  typeof window !== 'undefined'
    ? (window.__ECHOSTARS_INSTALL_PROMPT__ || null)
    : null;

let installed =
  typeof window !== 'undefined' &&
  (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    readInstalledHint()
  );

let revision = 0;
const listeners = new Set<() => void>();
const publish = () => {
  revision += 1;
  listeners.forEach(fn => fn());
};

const capturePrompt = (event: InstallEvent) => {
  event.preventDefault();
  promptEvent = event;
  window.__ECHOSTARS_INSTALL_PROMPT__ = event;
  installed = false;
  writeInstalledHint(false);
  publish();
};

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
    writeInstalledHint(true);
    promptEvent = null;
    window.__ECHOSTARS_INSTALL_PROMPT__ = null;
    publish();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
    if (event.matches) {
      installed = true;
      writeInstalledHint(true);
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

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone && !installed) {
      installed = true;
      writeInstalledHint(true);
      publish();
    }

    const earlyPrompt = window.__ECHOSTARS_INSTALL_PROMPT__;
    if (earlyPrompt && earlyPrompt !== promptEvent) {
      capturePrompt(earlyPrompt);
    }
  }, []);

  const handleInstall = async () => {
    if (isInstalling || installed) return;

    // This is deliberately the same proven flow used by the afternoon build:
    // use the real BeforeInstallPromptEvent captured by Chromium and call it
    // directly from the user's click. No synthetic prompt and no timeout gate.
    const event = promptEvent || window.__ECHOSTARS_INSTALL_PROMPT__;
    if (!event) {
      // Keep the permanent menu item visible, but do not show the old false
      // "unsupported" error. A valid Chromium install event will be captured
      // as soon as the browser publishes it.
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.ready.then(registration => registration.update()).catch(() => {});
      }
      return;
    }

    setIsInstalling(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;

      if (choice.outcome === 'accepted') {
        installed = true;
        writeInstalledHint(true);
      }

      promptEvent = null;
      window.__ECHOSTARS_INSTALL_PROMPT__ = null;
      publish();
    } catch (error) {
      console.warn('PWA native install prompt failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <button
      type="button"
      title={installed ? '繁星回聲已安裝' : '安裝繁星回聲 App'}
      aria-label={installed ? '繁星回聲已安裝' : '安裝到桌面'}
      onClick={handleInstall}
      className={
        className ||
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
      }
    >
      {isInstalling ? (
        <LoaderCircle className="w-4 h-4 animate-spin" />
      ) : installed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Download className="w-4 h-4" />
      )}

      <span>安裝到桌面</span>

      {installed && (
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          已安裝
        </span>
      )}
    </button>
  );
}
