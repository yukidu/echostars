import React from 'react';
import { Heart } from 'lucide-react';
import { calculateNumerology } from '../utils/numerology';

interface NumerologyGridProps {
  birthday: string;
}

export const NumerologyGrid: React.FC<NumerologyGridProps> = ({ birthday }) => {
  const result = calculateNumerology(birthday);
  if (!result) {
    return (
      <div className="text-xs text-slate-400 py-3 text-center border border-dashed rounded-xl border-slate-200 dark:border-slate-700">
        請輸入完整西元生日（例：1985-07-03）以自動繪製九宮格生命靈數圖
      </div>
    );
  }

  const { talentNumber, talentDigits, lifeNumber, zodiac, zodiacNumber, birthdayNumber, digitCounts } = result;

  // Layout: Column 1 (top to bottom): 1, 2, 3
  //         Column 2 (top to bottom): 4, 5, 6
  //         Column 3 (top to bottom): 7, 8, 9
  const gridLayout = [
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9]
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700 space-y-3">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            星座：<span className="text-rose-600 dark:text-rose-400 font-extrabold">{zodiac}</span>
            <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono font-extrabold border border-purple-300 dark:border-purple-800 text-[11px]" title={`星座數：${zodiacNumber} (紫色圈線)`}>
              {zodiacNumber}
            </span>
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            生日數：
            <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono font-extrabold border border-amber-300 dark:border-amber-700 text-[11px]" title={`生日數：${birthdayNumber} (出生日期相加至個位數，黃色圈線)`}>
              {birthdayNumber}
            </span>
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            天賦數：
            <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono font-extrabold border border-emerald-300 dark:border-emerald-800 text-[11px]">
              {talentNumber}
            </span>
          </span>
        </div>

        {/* Highlighted Life Number (Red Ring around number in the middle) */}
        <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-900 shadow-2xs">
          <span className="w-4 h-4 rounded-full border-2 border-red-500 flex items-center justify-center text-[10px] font-black text-red-600 font-mono">
            {lifeNumber}
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            加總命數：
          </span>
          <span className="text-sm font-black text-red-600 dark:text-red-400 font-mono">
            {lifeNumber}
          </span>
        </div>
      </div>

      {/* 
        九宮格生命靈數連線圖
        1. 先天數生日數字：黑圈線，出現幾次畫幾圈
        2. 生日數：黃色圈線
        3. 星座數：紫色圈線
        4. 天賦數：深綠圈線
        5. 加總命數：紅色圓圈包圍數字
      */}
      <div className="flex flex-col items-center">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[300px]">
          {gridLayout.map((row, rIdx) =>
            row.map(num => {
              const birthCount = digitCounts[num] || 0;
              const isLifeNum = num === lifeNumber;
              const isBirthdayNum = num === birthdayNumber;
              const isZodiacNum = num === zodiacNumber;
              const talentCount = talentDigits.filter(d => d === num).length;
              const hasAny = birthCount > 0 || isLifeNum || isBirthdayNum || isZodiacNum || talentCount > 0;

              // Total rings to calculate outer size
              let ringOffset = 0;

              return (
                <div
                  key={`${rIdx}-${num}`}
                  className={`aspect-square bg-white dark:bg-slate-900 rounded-2xl border p-2 flex flex-col items-center justify-center relative shadow-2xs transition-all overflow-hidden ${
                    hasAny
                      ? 'border-slate-300 dark:border-slate-600'
                      : 'border-slate-100 dark:border-slate-800 opacity-40'
                  }`}
                >
                  {/* Center: Number wrapped by concentric rings */}
                  <div className="relative flex items-center justify-center w-14 h-14">
                    {/* 1. 先天數生日數字 occurrence rings (黑色線條圈包在外面，幾次就幾圈) */}
                    {birthCount > 0 &&
                      Array.from({ length: birthCount }).map((_, i) => {
                        const size = 30 + ringOffset * 7;
                        ringOffset++;
                        return (
                          <span
                            key={`birth-${i}`}
                            title={`先天數生日包含 ${num} (${birthCount}次，黑圈線)`}
                            className="absolute rounded-full border-2 border-slate-900 dark:border-slate-200 pointer-events-none"
                            style={{
                              width: `${size}px`,
                              height: `${size}px`
                            }}
                          />
                        );
                      })}

                    {/* 2. 生日數 (黃色圈線，出生日期相加至個位數) */}
                    {isBirthdayNum && (() => {
                      const size = 30 + ringOffset * 7;
                      ringOffset++;
                      return (
                        <span
                          title={`生日數 ${num} (黃色圈線)`}
                          className="absolute rounded-full border-2 border-amber-400 dark:border-amber-300 bg-amber-400/10 pointer-events-none"
                          style={{
                            width: `${size}px`,
                            height: `${size}px`
                          }}
                        />
                      );
                    })()}

                    {/* 3. 星座數 (紫色圈線) */}
                    {isZodiacNum && (() => {
                      const size = 30 + ringOffset * 7;
                      ringOffset++;
                      return (
                        <span
                          title={`星座數 ${num} (${zodiac}，紫色圈線)`}
                          className="absolute rounded-full border-2 border-purple-600 dark:border-purple-400 bg-purple-500/10 pointer-events-none"
                          style={{
                            width: `${size}px`,
                            height: `${size}px`
                          }}
                        />
                      );
                    })()}

                    {/* 4. 天賦數 rings (深綠色線條圈包在外面) */}
                    {talentCount > 0 &&
                      Array.from({ length: talentCount }).map((_, i) => {
                        const size = 30 + ringOffset * 7;
                        ringOffset++;
                        return (
                          <span
                            key={`talent-${i}`}
                            title={`天賦數包含 ${num} (${talentCount}次，深綠圈線)`}
                            className="absolute rounded-full border-2 border-emerald-700 dark:border-emerald-400 bg-emerald-600/5 pointer-events-none"
                            style={{
                              width: `${size}px`,
                              height: `${size}px`
                            }}
                          />
                        );
                      })}

                    {/* 5. 加總命數 (紅色圓圈包圍數字在中間) */}
                    {isLifeNum && (() => {
                      const size = 30 + ringOffset * 7;
                      ringOffset++;
                      return (
                        <span
                          title={`加總命數 ${num} (紅色圓圈)`}
                          className="absolute rounded-full border-2 border-red-500 bg-red-500/10 pointer-events-none shadow-xs"
                          style={{
                            width: `${size}px`,
                            height: `${size}px`
                          }}
                        />
                      );
                    })()}

                    {/* Central Number itself */}
                    <span
                      className={`text-xl font-black font-mono leading-none z-10 ${
                        isLifeNum
                          ? 'text-red-600 dark:text-red-400 font-extrabold'
                          : hasAny
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {num}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-x-3.5 gap-y-2 text-[11px] text-slate-600 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 w-full flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-900 dark:border-slate-200 inline-block shrink-0" />
            <span>先天數生日數字 (黑色線圈，出現幾次畫幾圈)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 dark:border-amber-300 bg-amber-400/20 inline-block shrink-0" />
            <span>生日數 (黃色圈線，出生日期相加至個位數)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-600 dark:border-purple-400 bg-purple-500/20 inline-block shrink-0" />
            <span>星座數 (紫色圈線)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-700 dark:border-emerald-400 bg-emerald-600/20 inline-block shrink-0" />
            <span>天賦數 (深綠圈線)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-red-500 bg-red-500/20 inline-block shrink-0" />
            <span>加總命數 (紅色圓圈包圍數字)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
