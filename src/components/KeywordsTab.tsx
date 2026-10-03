import React, { useState, useMemo } from 'react';
import {
  Tag,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  TrendingUp,
  BarChart2,
  Music,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Track } from '../types';

interface KeywordsTabProps {
  userEmail?: string;
  tracks: Track[];
  onUpdateTrack?: (
    trackId: string,
    updates: Partial<Track>,
    options?: { persist?: boolean }
  ) => Promise<void> | void;
  onEditTrack?: (track: Track) => void;
}

export const KeywordsTab: React.FC<KeywordsTabProps> = ({
  tracks,
  userEmail,
  onUpdateTrack,
  onEditTrack
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKwOld, setEditingKwOld] = useState<string | null>(null);
  const [editingKwNew, setEditingKwNew] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedKw, setExpandedKw] = useState<string | null>(null);
  const [confirmDeleteKw, setConfirmDeleteKw] = useState<string | null>(null);

  // Quick Add Keyword to a selected Track
  const [selectedTrackIdForAdd, setSelectedTrackIdForAdd] = useState<string>('');
  const [newKeywordToAdd, setNewKeywordToAdd] = useState('');
  const [isAddingNewKw, setIsAddingNewKw] = useState(false);

  // Aggregate keywords across all tracks
  const keywordStats = useMemo(() => {
    const map = new Map<string, { count: number; tracks: Track[] }>();
    tracks.forEach(track => {
      if (Array.isArray(track.keywords)) {
        track.keywords.forEach(kw => {
          const trimmed = kw.trim();
          if (!trimmed) return;
          const entry = map.get(trimmed) || { count: 0, tracks: [] };
          entry.count += 1;
          entry.tracks.push(track);
          map.set(trimmed, entry);
        });
      }
    });

    return Array.from(map.entries())
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        tracks: data.tracks
      }))
      .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
  }, [tracks]);

  // High-level statistics
  const totalUniqueKeywords = keywordStats.length;
  const totalAppliedKeywords = keywordStats.reduce((acc, curr) => acc + curr.count, 0);
  const tracksWithKeywords = tracks.filter(t => Array.isArray(t.keywords) && t.keywords.length > 0).length;
  const coveragePercent = tracks.length > 0 ? Math.round((tracksWithKeywords / tracks.length) * 100) : 0;
  const avgKeywordsPerTrack = tracks.length > 0 ? (totalAppliedKeywords / tracks.length).toFixed(1) : '0';

  // Top 10 Keywords
  const top10Keywords = useMemo(() => {
    return keywordStats.slice(0, 10);
  }, [keywordStats]);

  const maxTopCount = top10Keywords.length > 0 ? top10Keywords[0].count : 1;

  // Filtered keywords by search query
  const filteredKeywords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return keywordStats;
    return keywordStats.filter(k =>
      k.keyword.toLowerCase().includes(q) ||
      k.tracks.some(t => t.title.toLowerCase().includes(q) || t.speaker.toLowerCase().includes(q))
    );
  }, [keywordStats, searchQuery]);

  // Rename Keyword globally
  const handleRenameKeyword = async (oldKw: string, newKw: string) => {
    const trimmed = newKw.trim();
    if (!trimmed || trimmed === oldKw) {
      setEditingKwOld(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/keywords/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldKeyword: oldKw, newKeyword: trimmed, userEmail })
      });

      if (res.ok) {
        const saved = await res.json();
        // Synchronously update local tracks and propagate
        tracks.forEach(t => {
          if (Array.isArray(t.keywords) && t.keywords.includes(oldKw)) {
            const nextKws = t.keywords.map(k => (k === oldKw ? trimmed : k));
            const uniqueKws = Array.from(new Set(nextKws));
            if (onUpdateTrack) {
              onUpdateTrack(t.id, { keywords: uniqueKws, keywordMeta: saved.tracks?.find((row: any) => row.id === t.id)?.keywordMeta || t.keywordMeta }, { persist: false });
            }
          }
        });

        setEditingKwOld(null);
        setSuccessMessage(`關鍵字「${oldKw}」已成功修改為「${trimmed}」，並自動同步連動至音檔詳細資訊頁面！`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || '修改失敗，請稍後再試');
      }
    } catch {
      setErrorMessage('網路異常，修改失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Keyword globally
  const handleDeleteKeyword = async (kw: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/keywords/delete?keyword=${encodeURIComponent(kw)}&userEmail=${encodeURIComponent(userEmail || '')}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const saved = await res.json();
        tracks.forEach(t => {
          if (Array.isArray(t.keywords) && t.keywords.includes(kw)) {
            const nextKws = t.keywords.filter(k => k !== kw);
            if (onUpdateTrack) {
              onUpdateTrack(t.id, { keywords: nextKws, keywordMeta: saved.tracks?.find((row: any) => row.id === t.id)?.keywordMeta || {} }, { persist: false });
            }
          }
        });

        setConfirmDeleteKw(null);
        setSuccessMessage(`關鍵字「${kw}」已成功刪除，相關音檔標記已全數移除！`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || '刪除失敗，請稍後再試');
      }
    } catch {
      setErrorMessage('網路異常，刪除失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add keyword to a track
  const handleAddKeywordToTrack = async () => {
    const trimmed = newKeywordToAdd.trim();
    if (!trimmed || !selectedTrackIdForAdd) return;

    const targetTrack = tracks.find(t => t.id === selectedTrackIdForAdd);
    if (!targetTrack) return;

    const currentKeywords = targetTrack.keywords || [];
    if (currentKeywords.includes(trimmed)) {
      setErrorMessage(`該音檔已包含「${trimmed}」關鍵字！`);
      return;
    }
    if (currentKeywords.length >= 20) {
      setErrorMessage('該音檔已達 20 組關鍵字上限！');
      return;
    }

    setIsAddingNewKw(true);
    try {
      const res = await fetch(`/api/tracks/${targetTrack.id}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: trimmed, userEmail })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '儲存失敗，請稍後再試');
      }
      if (res.ok) {
        const data = await res.json();
        if (onUpdateTrack) {
          onUpdateTrack(
            targetTrack.id,
            { keywords: data.keywords || [...currentKeywords, trimmed], keywordMeta: data.keywordMeta },
            { persist: false }
          );
        }
        setNewKeywordToAdd('');
        setSuccessMessage(`已成功為《${targetTrack.title}》新增關鍵字「${trimmed}」！`);
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '儲存失敗，請稍後再試');
    } finally {
      setIsAddingNewKw(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Alert Notices */}
      {successMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-bold">{errorMessage}</span>
        </div>
      )}

      {/* SECTION 1: 網友關鍵字 統計數據分析 (Statistical Analytics) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
            <BarChart2 className="w-4 h-4 text-amber-500" />
            <span>網友關鍵字 統計數據分析</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            即時彙整全站音檔標籤數據
          </span>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-semibold mb-0.5">
              總關鍵字總數
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-900 dark:text-amber-200">
                {totalUniqueKeywords}
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400">組</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/60">
            <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-semibold mb-0.5">
              標籤引用總次數
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-rose-900 dark:text-rose-200">
                {totalAppliedKeywords}
              </span>
              <span className="text-[11px] text-rose-700 dark:text-rose-400">次標記</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60">
            <span className="text-[10px] text-blue-700 dark:text-blue-400 block font-semibold mb-0.5">
              音檔標記覆蓋率
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-blue-900 dark:text-blue-200">
                {coveragePercent}%
              </span>
              <span className="text-[10px] text-slate-500">
                ({tracksWithKeywords}/{tracks.length})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold mb-0.5">
              平均每首標記數
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-900 dark:text-emerald-200">
                {avgKeywordsPerTrack}
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400">個/首</span>
            </div>
          </div>
        </div>

        {/* Top 10 Keywords Popularity Bar Chart */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
              <span>熱門關鍵字排行榜 (Top 10)</span>
            </span>
            <span className="text-[10px] text-slate-400">
              按關聯音檔數量降冪排列
            </span>
          </div>

          {top10Keywords.length === 0 ? (
            <p className="text-slate-400 py-3 text-center">尚無任何關鍵字數據</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {top10Keywords.map((item, idx) => {
                const percent = Math.round((item.count / maxTopCount) * 100);
                return (
                  <div
                    key={item.keyword}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 font-mono ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-900'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-800'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          #{item.keyword}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        {item.count} 首音檔
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: 關鍵字直接編輯與管理 (Direct Keyword Management) */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-end">
          {/* Search Box */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋關鍵字或音檔名稱..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400 text-xs"
            />
          </div>
        </div>


        {/* Keywords Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredKeywords.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                沒有找到符合條件的網友關鍵字
              </div>
            ) : (
              filteredKeywords.map(item => {
                const isEditing = editingKwOld === item.keyword;
                const isExpanded = expandedKw === item.keyword;
                const isConfirmingDelete = confirmDeleteKw === item.keyword;

                return (
                  <div key={item.keyword} className="p-3 sm:p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors space-y-2.5">
                    {/* Requirement 8 (v2.7): 重新設計排版以適合手機小螢幕觀看 */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editingKwNew}
                          onChange={e => setEditingKwNew(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (e.nativeEvent.isComposing || (e as any).isComposing || e.keyCode === 229) {
                                return;
                              }
                              e.preventDefault();
                              handleRenameKeyword(item.keyword, editingKwNew);
                            }
                            if (e.key === 'Escape') setEditingKwOld(null);
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-xl border border-amber-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1 min-w-0 outline-hidden focus:ring-1 focus:ring-amber-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={isSubmitting || !editingKwNew.trim()}
                          onClick={() => handleRenameKeyword(item.keyword, editingKwNew)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                          title="儲存並連動所有音檔"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>儲存</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingKwOld(null)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs shrink-0 cursor-pointer"
                          title="取消"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Top: Keyword badge + Track count */}
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800 font-bold text-xs truncate max-w-full">
                            <span className="text-amber-500">#</span>
                            <span className="truncate">{item.keyword}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px] font-semibold shrink-0">
                            已關聯 {item.count} 首音檔
                          </span>
                        </div>

                        {/* Bottom on mobile, Right on desktop: Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setExpandedKw(isExpanded ? null : item.keyword)}
                            className="px-2.5 py-1 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            {isExpanded ? '收合音檔' : '檢視音檔'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingKwOld(item.keyword);
                              setEditingKwNew(item.keyword);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:bg-rose-100 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-rose-200/60 dark:border-rose-900/60"
                            title="直接編輯並同步連動"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>直接編輯</span>
                          </button>

                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-xl border border-rose-300">
                              <span className="text-[10px] text-rose-800 dark:text-rose-200 font-bold">確定刪除？</span>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleDeleteKeyword(item.keyword)}
                                className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 cursor-pointer"
                              >
                                確定
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKw(null)}
                                className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 text-[10px] cursor-pointer"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteKw(item.keyword)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="刪除此關鍵字"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Expandable list of associated tracks */}
                    {isExpanded && (
                      <div className="pt-2 pl-3 border-l-2 border-amber-300 dark:border-amber-700 space-y-1.5 animate-in fade-in">
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          包含「#{item.keyword}」標籤的音檔清單：
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {item.tracks.map(t => (
                            <div
                              key={t.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs"
                            >
                              <Music className="w-3 h-3 text-amber-500" />
                              <span className="font-bold text-slate-800 dark:text-slate-100 max-w-[160px] truncate">
                                {t.title}
                              </span>
                              <span className="text-[10px] text-slate-400">· {t.speaker}</span>
                              {onEditTrack && (
                                <button
                                  type="button"
                                  onClick={() => onEditTrack(t)}
                                  className="text-[10px] text-rose-600 hover:underline ml-1"
                                >
                                  編輯音檔
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
