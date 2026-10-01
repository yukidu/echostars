import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, MonitorDown, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallAppButtonProps {
  compact?: boolean;
  className?: string;
}

const isAppleMobile = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({ compact = false, className = '' }) => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showHelp) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowHelp(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showHelp]);

  const handleInstall = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
        return;
      } catch { setInstallPrompt(null); }
    }
    setShowHelp(true);
  };

  if (isInstalled) return null;

  return <>
    <button type="button" onClick={handleInstall} title="安裝到桌面" aria-label="安裝到桌面" className={className || (compact ? 'p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors' : 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors')}>
      {compact ? <MonitorDown className="w-4 h-4 sm:w-5 sm:h-5" /> : <Download className="w-4 h-4" />}
      {!compact && <span>安裝到桌面</span>}
    </button>
    {showHelp && createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
      <section role="dialog" aria-modal="true" aria-label="安裝繁星的回聲" className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-700" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-base text-slate-800 dark:text-slate-100">安裝繁星的回聲</h2><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">安裝後可從裝置桌面直接開啟，畫面也會以獨立 App 顯示。</p></div><button type="button" onClick={() => setShowHelp(false)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="關閉"><X className="w-5 h-5" /></button></div>
        {isAppleMobile() ? <ol className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200 list-decimal list-inside"><li>請用 Safari 開啟這個網站。</li><li>點選底部的分享按鈕 <Share className="inline w-4 h-4 align-text-bottom" />。</li><li>選擇「加入主畫面」，再按「加入」。</li></ol> : <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">請使用 Chrome 或 Edge，從網址列右側的安裝圖示，或瀏覽器選單中的「安裝繁星的回聲」完成安裝。</p>}
      </section>
    </div>, document.body)}
  </>;
};
