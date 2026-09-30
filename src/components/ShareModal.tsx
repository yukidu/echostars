import React, { useState } from 'react';
import { Share2, Copy, Check, X, Smartphone } from 'lucide-react';
import { Track, UserProfile } from '../types';
import { VisitorIdentity, getRandomExcitement } from '../utils/visitor';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track;
  visitor: VisitorIdentity;
  currentUser: UserProfile | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  track,
  currentUser
}) => {
  const [copied, setCopied] = useState(false);
  const [excitement] = useState(() => getRandomExcitement());

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${currentHost}?track=${track.id}`;

  const categoryName = track.categories?.[0] || track.category || '演講';
  // Requirement 4: 如果未登入的訪客，則預覽訊息不顯示暱稱，取消輸入暱稱的框框
  const shareText = currentUser
    ? `「${currentUser.name}特別有感！分享給你這部${categoryName}錄音檔，我聽了${excitement}：${track.speaker}《${track.title}》 ${shareUrl}」`
    : `「特別有感！分享給你這部${categoryName}錄音檔，聽了${excitement}：${track.speaker}《${track.title}》 ${shareUrl}」`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: categoryName,
          text: shareText,
          url: shareUrl
        });
        onClose();
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    handleCopy();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-rose-100/60 dark:border-slate-800 my-auto">
        {/* Header - Fixed & Prominent Close Button (Requirement 4: 小螢幕裝置確保右上角 X 良好點擊) */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 sticky top-0 z-20 backdrop-blur-xs">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-300 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base truncate">
                分享此音檔給學習夥伴
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                自動生成溫馨推薦文案，支援點擊直達播放
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉視窗"
            title="關閉視窗"
            className="w-10 h-10 min-w-10 min-h-10 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 transition-colors shrink-0 cursor-pointer active:scale-90 shadow-2xs border border-slate-200 dark:border-slate-700 touch-manipulation z-30"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Preview Card */}
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1.5">
              分享訊息預覽 (含20組隨機興奮形容詞)：
            </span>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans select-all">
              {shareText}
            </div>
          </div>

          {/* OG Link Card Visual */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs flex items-center gap-3 p-3">
            <img
              src={track.speakerAvatar}
              alt={track.speaker}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 dark:text-rose-400">
                推薦分類: {categoryName}
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                {track.speaker}《{track.title}》
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{shareUrl}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600">已複製連結！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>複製分享文案</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
            >
              <Smartphone className="w-4 h-4" />
              <span>呼叫原生分享</span>
            </button>
          </div>

          {/* Bottom Close Button for extra mobile accessibility */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium cursor-pointer"
            >
              關閉視窗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
