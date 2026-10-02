import React from 'react';
import { Star, MessageSquare, Heart, Clock, Lock, CheckCircle2, Play, Pause } from 'lucide-react';
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
      className={`audio-card group relative w-full rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border transition-all duration-200 cursor-pointer overflow-hidden p-2.5 sm:p-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
        isCurrentTrack
          ? 'border-[var(--color-primary,#c06c84)] dark:border-rose-600 ring-2 ring-rose-200/70 dark:ring-rose-950'
          : 'border-rose-100/70 dark:border-slate-800 hover:border-rose-200 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-stretch gap-3 sm:gap-4">
        {/* Left: enlarged cover photo. Only listening progress stays over the image. */}
        <div className="shrink-0">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-black/20 dark:bg-slate-800 shadow-sm">
            <img
              src={track.speakerAvatar}
              alt={track.speaker}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            )}

            {/* Listening progress: force one line and shrink text to fit the larger cover. */}
            {isCompleted ? (
              <div className="absolute top-0 inset-x-0 bg-emerald-600/95 text-white text-[8px] sm:text-[9px] font-bold text-center px-1 py-1 whitespace-nowrap overflow-hidden flex items-center justify-center gap-0.5 z-10 shadow-2xs leading-none">
                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                <span className="whitespace-nowrap">[已聽完]</span>
              </div>
            ) : hasListened2Min ? (
              <div className="absolute top-0 inset-x-0 bg-blue-600/95 text-white text-[8px] sm:text-[9px] font-bold text-center px-1 py-1 font-mono z-10 shadow-2xs whitespace-nowrap overflow-hidden leading-none">
                [已聽 {Math.round(progressRatio * 100)}%]
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: all text and controls. */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug break-words line-clamp-3 group-hover:text-[var(--color-primary,#c06c84)] dark:group-hover:text-rose-400 transition-colors">
              {track.title}
            </h3>

            <p className="font-bold text-sm sm:text-base text-slate-700 dark:text-slate-200 mt-1 truncate">
              {speakerDisplay}
            </p>

            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.5 rounded-md border"
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

            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] sm:text-[11px]">
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-mono">
                <Clock className="w-3 h-3 shrink-0" />
                {track.duration}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300"
                title="收聽權限"
              >
                {(!canAccess || track.isPrivateVip) && <Lock className="w-3 h-3 shrink-0" />}
                {displayRequiredRank}
              </span>
              <button
                type="button"
                onClick={handlePlayClick}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-white shadow-2xs hover:brightness-105 active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                title={isPlaying ? '暫停播放' : '開始播放'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-white text-white" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                )}
                <span>{isPlaying ? '暫停' : '播放'}</span>
              </button>
            </div>
          </div>

          <div className="mt-auto pt-2.5 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
            {/* Row 1: rating only. Count format matches detail view: (number). */}
            <div
              className="flex items-center flex-nowrap gap-[1px] min-w-0"
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
                    aria-label={`評分 ${starNum} 星`}
                    aria-pressed={userRating === starNum}
                    className="rating-star p-0.5 hover:scale-125 transition-transform shrink-0"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 tabular-nums whitespace-nowrap">
                {(track.rating || 0).toFixed(1)}
                <span className="text-slate-400 font-normal ml-1">({track.ratingCount || 0})</span>
              </span>
            </div>

            {/* Row 2: feedback + likes. */}
            <div className="flex items-center gap-2.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  if (onOpenCommentPreview) onOpenCommentPreview();
                }}
                className="reaction-button inline-flex items-center gap-1 hover:text-rose-600 dark:hover:text-rose-400 transition-colors px-1 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title="點擊預覽心得"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold">心得 {track.commentsCount}</span>
              </button>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  if (onToggleLike) onToggleLike();
                }}
                className="reaction-button inline-flex items-center gap-1 hover:scale-105 transition-transform px-1 py-0.5"
                title="點擊切換喜愛"
                aria-label={hasLiked ? '收回按讚' : '按讚'}
                aria-pressed={hasLiked}
              >
                <Heart
                  className="w-3.5 h-3.5 transition-colors shrink-0"
                  style={{
                    color: hasLiked ? 'var(--color-primary, #c06c84)' : undefined,
                    fill: hasLiked ? 'var(--color-primary, #c06c84)' : 'none'
                  }}
                />
                <span
                  className="font-semibold"
                  style={{
                    color: hasLiked ? 'var(--color-primary, #c06c84)' : undefined,
                    fontWeight: hasLiked ? 'bold' : undefined
                  }}
                >
                  按讚 {track.likes}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
