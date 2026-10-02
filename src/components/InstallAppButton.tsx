import React, { useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Download, MonitorSmartphone, Share2, X } from 'lucide-react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' | string }>;
}

let promptEvent: InstallEvent | null = null;
let installed =
  typeof window !== 'undefined' &&
  (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );

let revision = 0;
const listeners = new Set<() => void>();
const publish = () => {
  revision += 1;
  listeners.forEach(fn => fn());
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event as InstallEvent;
    publish();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    promptEvent = null;
    publish();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
    installed = event.matches;
    publish();
  });
}

function getInstallGuide() {
  if (typeof navigator === 'undefined') {
    return {
      title: '安裝到桌面',
      steps: ['請使用瀏覽器選單中的「安裝」或「加入主畫面」功能。']
    };
  }

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isWindows = /Windows/i.test(ua);

  if (isIOS) {
    return {
      title: 'iPhone / iPad 安裝方式',
      steps: [
        '使用 Safari 開啟「繁星回聲」。',
        '點選瀏覽器的「分享」按鈕。',
        '選擇「加入主畫面」，再按右上角「加入」。'
      ]
    };
  }

  if (isAndroid) {
    return {
      title: 'Android 安裝方式',
      steps: [
        '開啟瀏覽器右上角「⋮」選單。',
        '選擇「安裝應用程式」或「加入主畫面」。',
        '依畫面提示完成安裝。'
      ]
    };
  }

  if (isMac) {
    return {
      title: 'Mac 安裝方式',
      steps: [
        'Chrome / Edge：點網址列右側的安裝圖示，或開啟瀏覽器選單選擇「安裝繁星回聲」。',
        'Safari：可使用「檔案 > 加入 Dock」將網站加入桌面 App。'
      ]
    };
  }

  if (isWindows) {
    return {
      title: 'Windows 安裝方式',
      steps: [
        'Chrome / Edge：點網址列右側的安裝圖示。',
        '若沒有圖示，開啟瀏覽器「⋮」選單，選擇「應用程式 / 安裝繁星回聲」。'
      ]
    };
  }

  return {
    title: '安裝到桌面',
    steps: [
      '開啟瀏覽器選單。',
      '尋找「安裝應用程式」、「安裝繁星回聲」或「加入主畫面」。',
      '依畫面提示完成安裝。'
    ]
  };
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

  const [showGuide, setShowGuide] = useState(false);
  const guide = getInstallGuide();

  const handleInstall = async () => {
    const event = promptEvent;

    if (event && !installed) {
      // Native browser install prompt: fully local browser behavior, no Cloudflare request.
      promptEvent = null;
      publish();
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted') {
          installed = true;
          publish();
        } else {
          setShowGuide(true);
        }
      } catch {
        setShowGuide(true);
      }
      return;
    }

    // iOS/Safari, already-installed apps, and browsers without beforeinstallprompt
    // still keep the menu item visible and receive platform-specific instructions.
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        title="安裝到桌面"
        aria-label="安裝到桌面"
        onClick={handleInstall}
        className={
          className ||
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        }
      >
        <Download className="w-4 h-4" />
        <span>安裝到桌面</span>
        {installed && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已安裝
          </span>
        )}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[1px]"
          onClick={() => setShowGuide(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <MonitorSmartphone className="w-5 h-5 text-[var(--color-primary,#c06c84)] shrink-0" />
                <h3 id="install-guide-title" className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">
                  {installed ? '繁星回聲已安裝' : guide.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="關閉安裝說明"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {installed && (
                <div className="flex items-start gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>目前瀏覽器偵測到網站已使用獨立 App／桌面模式。此選單仍會固定保留。</span>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Share2 className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-200 list-decimal pl-4">
                  {guide.steps.map(step => (
                    <li key={step} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>

              <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
                安裝提示由瀏覽器與作業系統控制；此功能不會讀寫 D1、KV 或 R2，也不會增加 Cloudflare 寫入量。
              </p>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full rounded-xl px-3 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--color-primary,#c06c84)' }}
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
