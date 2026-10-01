import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Share2, Download, X, Loader2 } from 'lucide-react';
import { Track, Comment, UserProfile } from '../types';
import {
  exportRatedTracksImage,
  exportTrackCommentsImage,
  shareOrDownloadImage
} from '../utils/canvasExport';

interface BwExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'comments' | 'rated';
  currentTrack?: Track;
  comments: Comment[];
  ratedTracks: { track: Track; rating: number }[];
  currentUser: UserProfile;
}

export const BwExportModal: React.FC<BwExportModalProps> = ({
  isOpen,
  onClose,
  mode: initialMode,
  currentTrack,
  comments,
  ratedTracks,
  currentUser
}) => {
  const [mode, setMode] = useState<'comments' | 'rated'>(initialMode);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    const generate = async () => {
      let blob: Blob;
      if (mode === 'comments' && currentTrack) {
        blob = await exportTrackCommentsImage(currentTrack, comments);
      } else {
        blob = await exportRatedTracksImage(
          ratedTracks,
          currentUser.name,
          currentUser.rank
        );
      }

      if (isMounted) {
        setCurrentBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setIsGenerating(false);
      }
    };

    generate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, currentTrack, comments, ratedTracks, currentUser]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!currentBlob) return;
    const filename =
      mode === 'comments'
        ? `聲藏講堂_${currentTrack?.title || '演講'}_留言全覽.jpg`
        : `聲藏講堂_${currentUser.name}_評價精選清單.jpg`;

    await shareOrDownloadImage(currentBlob, filename, '聲藏講堂黑白極簡分享圖');
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-rose-100/60 dark:border-slate-800 my-6">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                黑白極簡匯出分享圖
              </h3>
              <p className="text-xs text-slate-400">
                前端原生排版，高對比長圖，專屬會員學習卡
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

        {/* Mode Switcher */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {currentTrack && (
            <button
              onClick={() => setMode('comments')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'comments'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              本曲留言全覽圖 ({comments.length} 則)
            </button>
          )}

          <button
            onClick={() => setMode('rated')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'rated'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            我的評價清單 ({ratedTracks.length} 首)
          </button>
        </div>

        {/* Canvas Preview Area */}
        <div className="p-5 max-h-[50vh] overflow-y-auto bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
          {isGenerating ? (
            <div className="py-20 flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-slate-700 dark:text-slate-300" />
              <p className="text-xs">正在前端繪製黑白高對比分享圖...</p>
            </div>
          ) : previewUrl ? (
            <div className="shadow-xl rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 max-w-sm">
              <img src={previewUrl} alt="分享預覽" className="w-full h-auto" />
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            關閉
          </button>
          <button
            onClick={handleShare}
            disabled={isGenerating || !currentBlob}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            <span>呼叫原生分享 / 儲存圖片</span>
          </button>
        </div>
      </div>
    </div>
  );
};
