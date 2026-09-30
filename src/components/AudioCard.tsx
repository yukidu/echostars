import React from 'react';
import { Star, MessageSquare, Heart, Clock, ChevronRight, Lock, CheckCircle2, Play, Pause } from 'lucide-react';
import { Track } from '../types';
import { AudioMemory } from '../utils/audio';

interface AudioCardProps {
  track: Track;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  canAccess: boolean;
  progressMemory?: AudioMemory | null;
  liveCurrentTime?: number;
  liveDuration?: number;
  userRating?: number;
  hasLiked?: boolean;
  isVipUnlocked?: boolean;
  onClick: () => void;
  onTogglePlay?: () => void;
  onRate?: (score: number) => void;
  onToggleLike?: () => void;
  onSeek?: (seconds: number) => void;
  onOpenCommentPreview?: () => void;
}

export const AudioCard: React.FC<AudioCardProps> = ({
  track,
  isPlaying,
  isCurrentTrack,
  canAccess,
  progressMemory,
  liveCurrentTime,
  liveDuration,
  userRating = 0,
  hasLiked = false,
  isVipUnlocked = true,
  onClick,
  onTogglePlay,
  onRate,
  onToggleLike,
  onSeek,
  onOpenCommentPreview
}) => {
  const categories = track.categories && track.categories.length > 0
    ? track.categories
    : track.category ? [track.category] : ['未分類'];

  // Requirement 10 & 14: Progress badges calculation & accurate duration/time
  const safeDuration = (liveDuration && liveDuration > 0)
    ? liveDuration
    : (progressMemory && progressMemory.duration > 0)
    ? progressMemory.duration
    : (track.durationSeconds || 600);
  const currentTime = liveCurrentTime !== undefined
    ? liveCurrentTime
    : (progressMemory?.currentTime || 0);
  const progressRatio = safeDuration > 0 ? currentTime / safeDuration : 0;
  const isCompleted = progressMemory?.completed || progressRatio >= 0.95;
  const hasListened2Min = currentTime >= 120 && !isCompleted;

  // Requirement 11 (v2.7): 私秘VIP音檔一律顯示鎖頭+「私秘VIP」
  const displayRequiredRank = track.isPrivateVip
    ? '私秘VIP'
    : (track.requiredRank === '無' ? '公開' : track.requiredRank);

  // Requirement 18: 名字與獎銜連在一起顯示，顏色字體一致
  const speakerDisplay = `${track.speaker}${track.speakerRank || ''}`;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track.isPrivateVip && !isVipUnlocked) {
      alert('此音檔為私秘VIP專屬，請聯絡上傳者給您專屬連結');
      return;
    }
    if (onTogglePlay) onTogglePlay();
  };

  return (
    <div
      onClick={onClick}
      className={`group relative w-full rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border transition-all duration-200 cursor-pointer overflow-hidden p-1.5 sm:p-2 shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
        isCurrentTrack
          ? 'border-[var(--color-primary,#c06c84)] dark:border-rose-600 ring-2 ring-rose-200/70 dark:ring-rose-950'
          : 'border-rose-100/70 dark:border-slate-800 hover:border-rose-200 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-2.5">
        {/* Left Column: Speaker Cover Photo + (Requirement 19) Duration under Photo */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="relative w-15 h-15 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-black/20 dark:bg-slate-800 shadow-2xs">
            <img
              src={track.speakerAvatar}
              alt={track.speaker}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {/* Center Play/Pause Triangle Button (Requirement 11: 必須點擊照片中間三角形按鈕才能播放/暫停) */}
            <button
              type="button"
              onClick={handlePlayClick}
              className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 z-20 group-hover:scale-105"
              title={isPlaying ? '暫停播放' : '開始播放'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-white text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
              )}
            </button>

            {/* Playing wave animation */}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <div className="flex items-end gap-0.5 h-4 mb-3">
                  <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s] h-3.5" />
                  <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                  <span className="w-1 bg-white rounded-full animate-bounce h-2.5" />
                </div>
              </div>
            )}

            {/* Requirement 14: 已聽完和已聽進度，顯示位子在專輯封面大頭照的上面，節省空間 */}
            {isCompleted ? (
              <div className="absolute top-0 inset-x-0 bg-emerald-600/95 text-white text-[9px] font-bold text-center py-0.5 truncate flex items-center justify-center gap-0.5 z-10 shadow-2xs">
                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                <span>[已聽完]</span>
              </div>
            ) : hasListened2Min ? (
              <div className="absolute top-0 inset-x-0 bg-blue-600/95 text-white text-[9px] font-bold text-center py-0.5 font-mono z-10 shadow-2xs">
                [已聽 {Math.round(progressRatio * 100)}%]
              </div>
            ) : null}

            {/* Bottom: Required Permission Badge (Requirement 11 v2.7: 權限顯示鎖頭圖案+私秘VIP) */}
            <div className="absolute bottom-0 inset-x-0 bg-black/75 backdrop-blur-[1px] text-amber-300 text-[9px] font-bold text-center py-0.5 px-0.5 truncate flex items-center justify-center gap-0.5 z-10">
              {(!canAccess || track.isPrivateVip) && <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
              <span className="truncate">{displayRequiredRank}</span>
            </div>
          </div>

          {/* Requirement 19: 小時鐘圖案錄音時間長度顯示功能，位置改在封面頭像的下方顯示 */}
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            <Clock className="w-2.5 h-2.5 text-slate-400" />
            <span className="truncate">{track.duration}</span>
          </div>
        </div>

        {/* Center: Information */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
          {/* Row 1: Title (Requirement 4: 縮小邊框間距，標題顯示更長，太長換行顯示) */}
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug break-words line-clamp-3 group-hover:text-[var(--color-primary,#c06c84)] dark:group-hover:text-rose-400 transition-colors">
              {track.title}
            </h3>

            {/* Row 2: Speaker + Rank (Requirement 18: 格式字體顏色一致，不需括弧) */}
            <p className="font-bold text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
              {speakerDisplay}
            </p>

            {/* Row 3: Requirement 19 & 11: 分類標籤顯示位置在演講者下方，顏色連動主色系 */}
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md border"
                  style={{
                    backgroundColor: 'var(--color-light-pill, #fae8ed)',
                    color: 'var(--color-primary, #c06c84)',
                    borderColor: 'var(--theme-border-subtle, #f1e7ea)'
                  }}
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Row 4: Ratings, Comments, Likes - Requirement 15 (v2.7): 嚴格單行排列，避免評分後整列變成二行 */}
          <div className="flex items-center flex-nowrap gap-1 sm:gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 pt-1 mt-auto whitespace-nowrap overflow-hidden min-w-0 select-none">
            {/* 5-Star Interactive Rating */}
            <div
              className="flex items-center flex-nowrap gap-[1px] shrink-0"
              onClick={e => e.stopPropagation()}
              title="點擊星星評分，點擊同星級可取消"
            >
              {[1, 2, 3, 4, 5].map(starNum => {
                const isRated = (userRating || 0) > 0;
                const isFilled = isRated && (userRating || 0) >= starNum;
                return (
                  <button
                    key={starNum}
                    type="button"
                    onClick={() => onRate && onRate(userRating === starNum ? 0 : starNum)}
                    className="p-0 hover:scale-125 transition-transform shrink-0"
                  >
                    <Star
                      className={`w-3 h-3 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 ml-0.5 tabular-nums shrink-0">
                {userRating && userRating > 0 ? userRating.toFixed(1) : '-'}
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-700 shrink-0 text-[10px]">|</span>

            {/* Comments Popup */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (onOpenCommentPreview) onOpenCommentPreview();
              }}
              className="flex items-center flex-nowrap gap-0.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors px-1 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              title="點擊預覽留言"
            >
              <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="text-[10px] font-medium shrink-0">{track.commentsCount}</span>
            </button>

            <span className="text-slate-300 dark:text-slate-700 shrink-0 text-[10px]">|</span>

            {/* Likes */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (onToggleLike) onToggleLike();
              }}
              className="flex items-center flex-nowrap gap-0.5 hover:scale-105 transition-transform shrink-0 px-1 py-0.5"
              title="點擊切換喜愛"
            >
              <Heart
                className="w-3 h-3 transition-colors shrink-0"
                style={{
                  color: hasLiked ? 'var(--color-primary, #c06c84)' : undefined,
                  fill: hasLiked ? 'var(--color-primary, #c06c84)' : 'none'
                }}
              />
              <span
                className="text-[10px] font-medium shrink-0"
                style={{
                  color: hasLiked ? 'var(--color-primary, #c06c84)' : undefined,
                  fontWeight: hasLiked ? 'bold' : 'normal'
                }}
              >
                {track.likes}
              </span>
            </button>
          </div>
        </div>

        {/* Requirement 4: 刪除每一張音檔卡右邊的箭頭符號 */}
      </div>
    </div>
  );
};
