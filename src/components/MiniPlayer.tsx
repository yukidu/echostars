import React from 'react';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';
import { Track, PlayerDisplayMode } from '../types';
import { formatTime, formatRemainingTime } from '../utils/audio';
import { PlayerControls3States } from './PlayerControls3States';

interface MiniPlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  playerMode: PlayerDisplayMode;
  onSetPlayerMode: (mode: PlayerDisplayMode) => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (seconds: number) => void;
  onChangeSpeed: (speed: number) => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  playerMode,
  onSetPlayerMode,
  onTogglePlay,
  onSeek,
  onSkip,
  onChangeSpeed
}) => {
  const safeDuration = duration > 0 ? duration : (track.durationSeconds || 600);
  const primaryCategory = track.categories?.[0] || track.category || '事業';

  // 1. STATE 1: 縮小懸浮球 (Floating mini bubble with rotating photo)
  // Requirement 14: 記憶播放器狀態，維持浮動狀態，不會因點擊或切換而強制跳回底部播放器
  if (playerMode === 'bubble') {
    return (
      <div className="fixed bottom-5 right-4 z-[70] animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-rose-200/80 dark:border-slate-700 shadow-2xl rounded-full p-2 pl-2.5 pr-3.5 flex items-center gap-2.5 hover:shadow-rose-500/15 transition-all group/bubble">
          {/* Rotating Photo when playing (Clicking photo toggles play/pause) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className="relative cursor-pointer group shrink-0 focus:outline-hidden"
            title={isPlaying ? '點擊照片暫停' : '點擊照片播放'}
          >
            <div
              className={`w-11 h-11 rounded-full overflow-hidden shadow-md ring-2 ring-rose-400 dark:ring-rose-500 ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}
              style={{
                '--spin-duration': `${8 / Math.max(0.2, playbackRate)}s`
              } as React.CSSProperties}
            >
              <img
                src={track.speakerAvatar}
                alt={track.speaker}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Play/Pause overlay on photo */}
            <div className="absolute inset-0 bg-black/35 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white text-white" />
              ) : (
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
              )}
            </div>
          </button>

          {/* Info & Time - Clicking expands detail view */}
          <div
            onClick={() => onSetPlayerMode('expanded')}
            className="max-w-[130px] sm:max-w-[170px] select-none min-w-0 cursor-pointer"
            title="點擊展開詳細播放視窗"
          >
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover/bubble:text-rose-600 transition-colors">
              {track.title}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {track.speaker}{track.speakerRank ? ` · ${track.speakerRank}` : ''}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {formatTime(currentTime)} / {formatTime(safeDuration)}
            </p>
          </div>

          {/* 3-State Controls in Bubble */}
          <div className="shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
            <PlayerControls3States
              currentMode={playerMode}
              onSetMode={onSetPlayerMode}
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. STATE 2: 底部播放器 (Bottom bar player - Requirement 10: 永遠置頂 z-50)
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-rose-100/70 dark:border-slate-800 shadow-2xl transition-all">
      {/* Top Thin Scrubber Bar (Zero extra vertical padding) */}
      <div className="relative w-full h-1 group cursor-pointer bg-slate-200 dark:bg-slate-800">
        <input
          type="range"
          min={0}
          max={safeDuration}
          value={currentTime}
          onChange={e => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div
          className="h-full relative pointer-events-none transition-all duration-100"
          style={{
            width: `${Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))}%`,
            backgroundColor: 'var(--color-primary, #c06c84)'
          }}
        >
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[var(--color-primary,#c06c84)] ring-2 ring-white shadow-xs opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 py-1.5 sm:px-5 flex items-center justify-between gap-2">
        {/* Left: Thumbnail, Title, Speaker & Time (Clicking opens expanded DetailView) */}
        <div
          className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
          onClick={() => onSetPlayerMode('expanded')}
          title="點擊展開詳細播放器"
        >
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full overflow-hidden shadow-2xs ring-1 ring-white/40 ${
              isPlaying ? 'animate-spin-slow' : ''
            }`}
            style={{
              '--spin-duration': `${8 / Math.max(0.2, playbackRate)}s`
            } as React.CSSProperties}
          >
            <img
              src={track.speakerAvatar}
              alt={track.speaker}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
              {track.title}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
              {/* Requirement 4: 底部播放器，演講者後面要接著顯示「獎銜」，一樣字體格式 */}
              <span className="truncate max-w-[110px] sm:max-w-[160px] font-sans">
                {track.speaker}{track.speakerRank ? ` · ${track.speakerRank}` : ''}
              </span>
              <span>•</span>
              <span className="text-[var(--color-primary,#c06c84)] font-bold">
                {formatTime(currentTime)} / {formatTime(safeDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Playback Controls (-10s, Play/Pause, +10s with 10 inside icons - Requirement 16) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => onSkip(-10)}
            title="倒轉 10 秒"
            className="relative w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="absolute text-[8px] font-black font-mono leading-none">10</span>
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-white flex items-center justify-center shadow-xs active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => onSkip(10)}
            title="快進 10 秒"
            className="relative w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            <span className="absolute text-[8px] font-black font-mono leading-none">10</span>
          </button>
        </div>

        {/* Right: Speed pills (Mobile: 1X, 1.5X, 2X; Desktop: full) + 3-state control */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Small screens: 1X, 1.5X, 2X (Requirement 16) */}
          <div className="flex sm:hidden items-center gap-0.5 text-[9px]">
            {[1.0, 1.5, 2.0].map(s => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all ${
                  playbackRate === s
                    ? 'bg-[var(--color-primary,#c06c84)] text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                {s}X
              </button>
            ))}
          </div>

          {/* Larger screens: all speeds (Requirement 8: 刪除2.5X播放速度選項) */}
          <div className="hidden sm:flex items-center gap-1 text-[10px]">
            {[0.7, 1.0, 1.25, 1.5, 2.0].map(s => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-1.5 py-0.5 rounded font-mono font-semibold transition-all ${
                  playbackRate === s
                    ? 'bg-[var(--color-primary,#c06c84)] text-white font-bold shadow-2xs'
                    : 'text-slate-400 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                {s}X
              </button>
            ))}
          </div>

          {/* Persistent 3-State Controls in Top-Right Position */}
          <PlayerControls3States
            currentMode={playerMode}
            onSetMode={onSetPlayerMode}
          />
        </div>
      </div>
    </div>
  );
};
