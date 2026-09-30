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
  visitor,
  currentUser
}) => {
  const [guestNameInput, setGuestNameInput] = useState(visitor.fullName);
  const [copied, setCopied] = useState(false);
  const [excitement] = useState(() => getRandomExcitement());

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${currentHost}?track=${track.id}`;

  const categoryName = track.categories?.[0] || track.category || '演講';
  const finalUserName = currentUser ? currentUser.name : (guestNameInput.trim() || visitor.fullName);
  const shareText = `「${finalUserName}特別有感！分享給你這部${categoryName}錄音檔，我聽了${excitement}：${track.speaker}《${track.title}》 ${shareUrl}」`;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-rose-100/60 dark:border-slate-800 my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-300">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                分享此音檔給學習夥伴
              </h3>
              <p className="text-xs text-slate-400">
                自動生成溫馨推薦文案，支援點擊直達播放
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Unauthenticated guest nickname prompt */}
          {!currentUser && (
            <div className="bg-amber-50/80 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-200/70 dark:border-amber-900">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                請輸入您的暱稱 (分享文案將顯示您的名字)：
              </label>
              <input
                type="text"
                value={guestNameInput}
                onChange={e => setGuestNameInput(e.target.value)}
                placeholder="例：爽朗的海豚 / 美玲"
                className="w-full px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm outline-hidden text-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          {/* Preview Card */}
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1.5">
              分享訊息預覽 (含20組隨機興奮形容詞)：
            </span>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans select-all">
              {shareText}
            </div>
          </div>

          {/* OG Link Card Visual */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs flex items-center gap-3 p-3">
            <img
              src={track.speakerAvatar}
              alt={track.speaker}
              className="w-14 h-14 rounded-xl object-cover shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                OG標題: {categoryName}
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                {track.speaker}《{track.title}》
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{shareUrl}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleCopy}
              className="py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 shadow-2xs active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600">已複製專屬連結！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>複製分享文案</span>
                </>
              )}
            </button>

            <button
              onClick={handleNativeShare}
              className="py-3 px-4 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
            >
              <Smartphone className="w-4 h-4" />
              <span>呼叫原生分享選單</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
