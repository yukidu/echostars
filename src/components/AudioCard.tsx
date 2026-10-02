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
  onTogglePlay?: (anchor?: HTMLElement) => void;
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
    : (!track.requiredRank || track.requiredRank === '無' || track.requiredRank === '公開'
      ? '公開'
      : track.requiredRank);

  // Requirement 18: 名字與獎銜連在一起顯示，顏色字體一致
  const speakerDisplay = `${track.speaker}${track.speakerRank || ''}`;
  const displayDuration =
    Number.isFinite(Number(track.durationSeconds)) && Number(track.durationSeconds) > 0
      ? `約 ${Math.max(1, Math.round(Number(track.durationSeconds) / 60))} 分鐘`
      : (track.duration || '時間待確認');

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePlay) onTogglePlay(e.currentTarget);
  };

  return (
    <div
      onClick={onClick}
      className={`audio-card group relative w-full rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border transition-all duration-200 cursor-pointer overflow-hidden py-2.5 pl-2.5 pr-0 sm:py-3 sm:pl-3 sm:pr-0 shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
        isCurrentTrack
          ? 'border-[var(--color-primary,#c06c84)] dark:border-rose-600 ring-2 ring-rose-200/70 dark:ring-rose-950'
          : 'border-rose-100/70 dark:border-slate-800 hover:border-rose-200 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Left: large portrait + progress + duration + access level */}
        <div className="shrink-0 w-28 sm:w-32">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-black/20 dark:bg-slate-800 shadow-sm">
            <img
              src={track.speakerAvatar}
              alt={track.speaker}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {/* Semi-transparent center play/pause control */}
            <button
              type="button"
              onClick={handlePlayClick}
              className="absolute inset-0 m-auto z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/35 hover:bg-black/50 backdrop-blur-[1px] text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
              title={isPlaying ? '暫停播放' : '開始播放'}
              aria-label={isPlaying ? '暫停播放' : '開始播放'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white text-white" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white text-white ml-0.5" />
              )}
            </button>

            {/* Listening progress: always one line, compact font. */}
            {isCompleted ? (
              <div className="absolute top-0 inset-x-0 bg-emerald-600/95 text-white text-[8px] sm:text-[9px] font-bold text-center px-1 py-1 whitespace-nowrap overflow-hidden flex items-center justify-center gap-0.5 z-30 shadow-2xs leading-none">
                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                <span className="whitespace-nowrap">[已聽完]</span>
              </div>
            ) : hasListened2Min ? (
              <div className="absolute top-0 inset-x-0 bg-blue-600/95 text-white text-[8px] sm:text-[9px] font-bold text-center px-1 py-1 font-mono z-30 shadow-2xs whitespace-nowrap overflow-hidden leading-none">
                [已聽 {Math.round(progressRatio * 100)}%]
              </div>
            ) : null}

            {/* Access level sits inside the portrait at the bottom. */}
            <div
              className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-center gap-0.5 bg-black/35 px-1 py-1 text-[8px] sm:text-[9px] font-black text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] whitespace-nowrap overflow-hidden"
              title={`收聽權限：${displayRequiredRank}`}
            >
              {displayRequiredRank !== '公開' && <Lock className="w-2.5 h-2.5 shrink-0" />}
              <span className="truncate">{displayRequiredRank}</span>
            </div>
          </div>

          {/* Duration moved below portrait */}
          <div className="mt-1.5 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span>{displayDuration}</span>
          </div>

        </div>

        {/* Right: all remaining card information. Right padding intentionally 0. */}
        <div className="flex-1 min-w-0 flex flex-col self-stretch pr-0">
          <div className="pr-0">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug break-words line-clamp-3 group-hover:text-[var(--color-primary,#c06c84)] dark:group-hover:text-rose-400 transition-colors">
              {track.title}
            </h3>

            <p className="font-bold text-sm sm:text-base text-slate-700 dark:text-slate-200 mt-1 truncate">
              {speakerDisplay}
            </p>

            <div className="flex flex-nowrap items-center gap-1 mt-1.5 w-full overflow-hidden">
              {categories.slice(0, 3).map((cat, idx) => (
                <span
                  key={idx}
                  className="inline-flex w-fit max-w-[33%] shrink-0 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md border text-center truncate whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--color-light-pill, #fae8ed)',
                    color: 'var(--color-primary, #c06c84)',
                    borderColor: 'var(--theme-border-subtle, #f1e7ea)'
                  }}
                  title={cat}
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-2.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-4 border-t border-slate-100 dark:border-slate-800 pr-0">
            {/* Enlarged rating row */}
            <div
              className="flex items-center flex-nowrap gap-[2px] min-w-0"
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
                      className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="text-sm font-black text-slate-700 dark:text-slate-300 ml-1 tabular-nums whitespace-nowrap">
                {(track.rating || 0).toFixed(1)}
                <span className="text-slate-400 font-semibold ml-1">({track.ratingCount || 0})</span>
              </span>
            </div>

            {/* Enlarged feedback + likes row */}
            <div className="flex items-center gap-3 sm:gap-4 text-sm text-slate-600 dark:text-slate-400 sm:ml-auto">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  if (onOpenCommentPreview) onOpenCommentPreview();
                }}
                className="reaction-button inline-flex items-center gap-1.5 hover:text-rose-600 dark:hover:text-rose-400 transition-colors py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                title="點擊預覽心得"
              >
                <MessageSquare className="w-5 h-5 text-slate-400 shrink-0" />
                <span>心得 {track.commentsCount}</span>
              </button>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  if (onToggleLike) onToggleLike();
                }}
                className="reaction-button inline-flex items-center gap-1.5 hover:scale-105 transition-transform py-1 font-bold"
                title="點擊切換喜愛"
                aria-label={hasLiked ? '收回按讚' : '按讚'}
                aria-pressed={hasLiked}
              >
                <Heart
                  className="w-5 h-5 transition-colors shrink-0"
                  style={{
                    color: hasLiked ? 'var(--color-primary, #c06c84)' : undefined,
                    fill: hasLiked ? 'var(--color-primary, #c06c84)' : 'none'
                  }}
                />
                <span
                  style={{
                    color: hasLiked ? 'var(--color-primary, #c06c84)' : undefined,
                    fontWeight: 'bold'
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
