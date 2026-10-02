import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Download, LoaderCircle } from 'lucide-react';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed' | string;
  platform?: string;
};

interface InstallEvent extends Event {
  prompt(): Promise<InstallChoice | void>;
  userChoice: Promise<InstallChoice>;
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

let promptEvent: InstallEvent | null = null;
let installed =
  typeof window !== 'undefined' &&
  (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as InstallNavigator).standalone === true
  );

let revision = 0;
const listeners = new Set<() => void>();
const promptWaiters = new Set<(event: InstallEvent | null) => void>();

const publish = () => {
  revision += 1;
  listeners.forEach(fn => fn());
};

const resolvePromptWaiters = (event: InstallEvent | null) => {
  promptWaiters.forEach(resolve => resolve(event));
  promptWaiters.clear();
};

const isStandaloneMode = () =>
  typeof window !== 'undefined' &&
  (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as InstallNavigator).standalone === true
  );

async function refreshInstalledState() {
  if (typeof navigator === 'undefined') return installed;

  if (isStandaloneMode()) {
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
      if (hasInstalledPwa !== installed) {
        installed = hasInstalledPwa;
        publish();
      }
      return hasInstalledPwa;
    } catch {
      // This API is optional/experimental; fall back to display-mode + install events.
    }
  }

  return installed;
}

function waitForNativeInstallPrompt(timeoutMs = 1500) {
  if (promptEvent) return Promise.resolve(promptEvent);

  return new Promise<InstallEvent | null>(resolve => {
    const resolver = (event: InstallEvent | null) => {
      window.clearTimeout(timer);
      resolve(event);
    };
    const timer = window.setTimeout(() => {
      promptWaiters.delete(resolver);
      resolve(null);
    }, timeoutMs);
    promptWaiters.add(resolver);
  });
}

function getUnsupportedInstallMessage() {
  if (typeof navigator === 'undefined') {
    return '目前瀏覽器沒有提供原生 App 安裝介面。';
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR/i.test(ua);

  if (isIOS) {
    return 'iPhone／iPad 系統目前不允許網站程式碼直接啟動安裝視窗。';
  }

  if (isMac && isSafari) {
    return 'Mac Safari 目前不允許網站程式碼直接啟動「加入 Dock」；Chrome／Edge 可使用此按鈕直接安裝。';
  }

  return '目前瀏覽器尚未提供原生 App 安裝事件，請稍後再試。';
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event as InstallEvent;
    resolvePromptWaiters(promptEvent);
    publish();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    promptEvent = null;
    resolvePromptWaiters(null);
    publish();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
    installed = event.matches;
    publish();
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
    void refreshInstalledState();
  }, []);

  const handleInstall = async () => {
    if (isInstalling) return;

    setIsInstalling(true);
    try {
      if (await refreshInstalledState()) return;

      const event = promptEvent || await waitForNativeInstallPrompt();
      if (!event) {
        window.alert(getUnsupportedInstallMessage());
        return;
      }

      promptEvent = null;
      publish();

      const promptResult = await event.prompt();
      const choice =
        promptResult && typeof promptResult === 'object' && 'outcome' in promptResult
          ? promptResult
          : await event.userChoice;

      if (choice.outcome === 'accepted') {
        installed = true;
        publish();
      } else {
        await refreshInstalledState();
      }
    } catch (error) {
      console.warn('Native PWA installation failed:', error);
      window.alert(getUnsupportedInstallMessage());
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

      {!installed && isInstalling && (
        <span className="ml-auto text-[10px] font-bold text-slate-400 dark:text-slate-500">
          準備安裝
        </span>
      )}
    </button>
  );
}
