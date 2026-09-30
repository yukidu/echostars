import React from 'react';
import { CircleDot, RectangleHorizontal, Maximize2 } from 'lucide-react';
import { PlayerDisplayMode } from '../types';

interface PlayerControls3StatesProps {
  currentMode: PlayerDisplayMode;
  onSetMode: (mode: PlayerDisplayMode) => void;
  className?: string;
}

export const PlayerControls3States: React.FC<PlayerControls3StatesProps> = ({
  currentMode,
  onSetMode,
  className = ''
}) => {
  return (
    <div
      className={`flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs ${className}`}
      title="播放器狀態切換 (縮小懸浮球 / 底部播放器 / 展開詳細介面)"
    >
      {/* 1. 縮小懸浮球 */}
      <button
        type="button"
        onClick={() => onSetMode('bubble')}
        title="1. 縮小懸浮球 (迷你旋轉浮動球)"
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          currentMode === 'bubble'
            ? 'text-white shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700'
        }`}
        style={currentMode === 'bubble' ? { backgroundColor: 'var(--color-primary, #c06c84)' } : undefined}
      >
        <CircleDot className="w-3.5 h-3.5" />
      </button>

      {/* 2. 底部播放器 */}
      <button
        type="button"
        onClick={() => onSetMode('bar')}
        title="2. 底部播放器 (吸附底端播放條)"
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          currentMode === 'bar'
            ? 'text-white shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700'
        }`}
        style={currentMode === 'bar' ? { backgroundColor: 'var(--color-primary, #c06c84)' } : undefined}
      >
        <RectangleHorizontal className="w-3.5 h-3.5" />
      </button>

      {/* 3. 展開詳細介面 */}
      <button
        type="button"
        onClick={() => onSetMode('expanded')}
        title="3. 展開詳細介面 (全功能大介面)"
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          currentMode === 'expanded'
            ? 'text-white shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700'
        }`}
        style={currentMode === 'expanded' ? { backgroundColor: 'var(--color-primary, #c06c84)' } : undefined}
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
