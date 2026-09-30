import React, { useState, useEffect } from 'react';
import {
  Star,
  MessageSquare,
  Heart,
  Share2,
  Play,
  Pause,
  Youtube,
  FileText,
  Lock,
  ExternalLink,
  Edit3,
  Edit2,
  Plus,
  Trash2,
  Check,
  X,
  Tag,
  Hash,
  Image as ImageIcon,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { Track, Comment, UserProfile, PlayerDisplayMode, ExternalLinkItem } from '../types';
import { formatTime, formatRemainingTime, AudioMemory } from '../utils/audio';
import { VisitorIdentity } from '../utils/visitor';
import { exportTrackFullCardImage, shareOrDownloadImage } from '../utils/canvasExport';
import { CommentsSection } from './CommentsSection';
import { TwinklingStars } from './TwinklingStars';
import { PlayerControls3States } from './PlayerControls3States';

interface DetailViewProps {
  track: Track;
  comments: Comment[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  visitor: VisitorIdentity;
  currentUser: UserProfile | null;
  isAdmin: boolean;
  userRating?: number;
  hasLiked: boolean;
  progressMemory?: AudioMemory | null;
  playerMode?: PlayerDisplayMode;
  onSetPlayerMode?: (mode: PlayerDisplayMode) => void;
  onBack?: () => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (seconds: number) => void;
  onRate: (score: number) => Promise<void>;
  onToggleLike: () => Promise<void>;
  onShare: () => void;
  onChangeSpeed: (rate: number) => void;
  onAddComment: (content: string, replyToId?: string, replyToAuthor?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, newContent: string) => Promise<void>;
  onOpenBwExport: (mode: 'comments' | 'rated') => void;
  onViewMember?: (user: UserProfile) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<Track>) => Promise<void>;
  onSelectKeyword?: (keyword: string) => void;
  onEditTrack?: (track: Track) => void;
  isVipUnlocked?: boolean;
  hasVipAccess?: boolean;
  onVipBlocked?: () => void;
  allUsers?: UserProfile[];
  tracks?: Track[];
}

export const DetailView: React.FC<DetailViewProps> = ({
  track,
  comments,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  visitor,
  currentUser,
  isAdmin,
  userRating,
  hasLiked,
  progressMemory,
  playerMode = 'expanded',
  onSetPlayerMode,
  onTogglePlay,
  onSeek,
  onSkip,
  onRate,
  onToggleLike,
  onShare,
  onChangeSpeed,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onOpenBwExport,
  onViewMember,
  onUpdateTrack,
  onSelectKeyword,
  onEditTrack,
  isVipUnlocked = true,
  hasVipAccess = true,
  onVipBlocked,
  allUsers = [],
  tracks = []
}) => {
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);

  // Requirement 5.9 (v2.7): 演講資訊與備註新增上傳者姓名
  const uploaderUser = allUsers.find(
    u => (track.uploaderEmail && u.email && u.email.toLowerCase().trim() === track.uploaderEmail.toLowerCase().trim()) ||
         (track.uploaderId && u.id === track.uploaderId)
  );
  const uploaderName = track.uploaderName || uploaderUser?.name || track.uploaderEmail?.split('@')[0] || track.uploadedBy || '管理員';

  // Requirement 11 (v2.7): 私秘VIP音檔未解鎖不能播放
  const effectiveVipUnlocked = isVipUnlocked && hasVipAccess;
  const handlePlayClick = () => {
    if (track.isPrivateVip && !effectiveVipUnlocked) {
      if (onVipBlocked) {
        onVipBlocked();
      } else {
        alert('此音檔為私秘VIP專屬，請聯絡上傳者給您專屬連結');
      }
      return;
    }
    onTogglePlay();
  };

  // Requirement 7: Local like state to fix jitter and guarantee instant reaction
  const [localLiked, setLocalLiked] = useState(hasLiked);
  const [localLikesCount, setLocalLikesCount] = useState(track.likes);

  useEffect(() => {
    setLocalLiked(hasLiked);
    setLocalLikesCount(track.likes);
  }, [hasLiked, track.likes, track.id]);

  const handleToggleLikeClick = async () => {
    const nextLiked = !localLiked;
    setLocalLiked(nextLiked);
    setLocalLikesCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
    await onToggleLike();
  };

  // Requirement 1: 網友關鍵字狀態
  const [trackKeywords, setTrackKeywords] = useState<string[]>(track.keywords || []);
  const [dbKeywords, setDbKeywords] = useState<string[]>([]);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [editingKeywordOld, setEditingKeywordOld] = useState<string | null>(null);
  const [editingKeywordNew, setEditingKeywordNew] = useState('');
  const [keywordError, setKeywordError] = useState<string | null>(null);

  useEffect(() => {
    setTrackKeywords(track.keywords || []);
  }, [track.id, track.keywords]);

  const loadDbKeywords = async () => {
    try {
      const res = await fetch('/api/keywords');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDbKeywords(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadDbKeywords();
  }, []);

  // Requirement 2: 超級管理員、貢獻者，可以在「最大化視窗」直接修改音檔的「演講資訊與備註」或編輯修改新增「連結」。（但是貢獻者只能修改編輯自己上傳的音檔）
  const isSuperAdmin = isAdmin || currentUser?.email === 'yukidu@gmail.com' || currentUser?.role === '超級管理員';
  const isUploader = currentUser && (track.uploaderId === currentUser.id || track.uploaderEmail === currentUser.email);
  const isContributorUploader = currentUser?.isContributor === true && isUploader;
  const canEditTrack = isSuperAdmin || isContributorUploader;

  // Permissions for keywords (Requirement 1):
  // 已登入會員的「所有人」都有權限可以新增關鍵字，前提是最多不能超過20組關鍵字。
  // 但是，只有「超級管理員、貢獻者」，才有權限可編輯或修改刪除關鍵字。
  const canAddKeywords = currentUser !== null && trackKeywords.length < 20;
  const canManageKeywords = isSuperAdmin || currentUser?.isContributor === true;

  const handleAddKeyword = async (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    if (trackKeywords.includes(trimmed)) {
      setKeywordError('此關鍵字已存在');
      return;
    }
    if (trackKeywords.length >= 20) {
      setKeywordError('此音檔網友關鍵字已達 20 組上限！');
      return;
    }
    setKeywordError(null);
    try {
      const res = await fetch(`/api/tracks/${track.id}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: trimmed })
      });
      if (res.ok) {
        const data = await res.json();
        setTrackKeywords(data.keywords || [...trackKeywords, trimmed]);
        setNewKeywordInput('');
        setIsAddingKeyword(false);
        loadDbKeywords();
        if (onUpdateTrack) {
          onUpdateTrack(track.id, { keywords: data.keywords });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setKeywordError(err.error || '新增失敗');
      }
    } catch {
      setKeywordError('網路連線異常，請稍後再試');
    }
  };

  const handleEditKeyword = async (oldKw: string, newKw: string) => {
    const trimmed = newKw.trim();
    if (!trimmed || trimmed === oldKw) {
      setEditingKeywordOld(null);
      return;
    }
    try {
      const res = await fetch(`/api/tracks/${track.id}/keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldKeyword: oldKw,
          newKeyword: trimmed,
          userEmail: currentUser?.email,
          userId: currentUser?.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTrackKeywords(data.keywords);
        setEditingKeywordOld(null);
        loadDbKeywords();
        if (onUpdateTrack) {
          onUpdateTrack(track.id, { keywords: data.keywords });
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteKeyword = async (kw: string) => {
    try {
      const res = await fetch(
        `/api/tracks/${track.id}/keywords/${encodeURIComponent(kw)}?userEmail=${encodeURIComponent(currentUser?.email || '')}&userId=${encodeURIComponent(currentUser?.id || '')}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        const data = await res.json();
        setTrackKeywords(data.keywords);
        loadDbKeywords();
        if (onUpdateTrack) {
          onUpdateTrack(track.id, { keywords: data.keywords });
        }
      }
    } catch {
      // ignore
    }
  };

  // Track Edit Mode states
  const [isEditingTrack, setIsEditingTrack] = useState(false);
  const [editTitle, setEditTitle] = useState(track.title || '');
  const [editDesc, setEditDesc] = useState(track.description || '');
  const [editSeries, setEditSeries] = useState(track.series || '');
  const [editSpeechDate, setEditSpeechDate] = useState(track.speechDate || '');
  const [editSeriesOrder, setEditSeriesOrder] = useState(track.seriesOrder || '第 1 集');
  const [editVideos, setEditVideos] = useState<ExternalLinkItem[]>(track.externalVideos || []);
  const [editPpts, setEditPpts] = useState<ExternalLinkItem[]>(track.externalPpts || []);
  const [editFiles, setEditFiles] = useState<ExternalLinkItem[]>(track.externalFiles || []);
  const [isSavingTrack, setIsSavingTrack] = useState(false);

  const handleStartEditTrack = () => {
    setEditTitle(track.title || '');
    setEditDesc(track.description || '');
    setEditSeries(track.series || '');
    setEditSpeechDate(track.speechDate || '');
    setEditSeriesOrder(track.seriesOrder || '第 1 集');
    setEditVideos(track.externalVideos ? track.externalVideos.map(v => ({ ...v })) : []);
    setEditPpts(track.externalPpts ? track.externalPpts.map(p => ({ ...p })) : []);
    setEditFiles(track.externalFiles ? track.externalFiles.map(f => ({ ...f })) : []);
    setIsEditingTrack(true);
  };

  const handleAddLinkItem = (type: 'video' | 'ppt' | 'file') => {
    if (type === 'video') {
      setEditVideos(prev => [...prev, { name: '', url: '' }]);
    } else if (type === 'ppt') {
      setEditPpts(prev => [...prev, { name: '', url: '' }]);
    } else {
      setEditFiles(prev => [...prev, { name: '', url: '' }]);
    }
  };

  const handleRemoveLinkItem = (type: 'video' | 'ppt' | 'file', index: number) => {
    if (type === 'video') {
      setEditVideos(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'ppt') {
      setEditPpts(prev => prev.filter((_, i) => i !== index));
    } else {
      setEditFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleLinkChange = (type: 'video' | 'ppt' | 'file', index: number, field: 'name' | 'url', val: string) => {
    if (type === 'video') {
      setEditVideos(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
    } else if (type === 'ppt') {
      setEditPpts(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
    } else {
      setEditFiles(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
    }
  };

  const handleSaveTrackInfo = async () => {
    if (!onUpdateTrack) return;
    setIsSavingTrack(true);
    try {
      const cleanVideos = editVideos.filter(v => v.url.trim());
      const cleanPpts = editPpts.filter(p => p.url.trim());
      const cleanFiles = editFiles.filter(f => f.url.trim());
      await onUpdateTrack(track.id, {
        title: editTitle.trim() || track.title,
        description: editDesc.trim(),
        series: editSeries.trim(),
        speechDate: editSpeechDate.trim(),
        seriesOrder: editSeriesOrder.trim(),
        externalVideos: cleanVideos,
        externalPpts: cleanPpts,
        externalFiles: cleanFiles
      });
      setIsEditingTrack(false);
    } finally {
      setIsSavingTrack(false);
    }
  };

  const [isExportingCard, setIsExportingCard] = useState(false);

  const handleExportCard = async () => {
    if (isExportingCard) return;
    setIsExportingCard(true);
    try {
      const blob = await exportTrackFullCardImage(track, comments);
      const filename = `繁星的回聲_${track.title}_完整資訊圖卡.jpg`;
      await shareOrDownloadImage(blob, filename, `《${track.title}》演講完整資訊圖卡`);
    } catch (err) {
      console.error('Failed to export track card image', err);
    } finally {
      setIsExportingCard(false);
    }
  };

  const safeDuration = duration > 0 ? duration : (track.durationSeconds || 600);

  // Requirement 11: 任何地方，五顆星星的評價按鈕，如果原地相同評價再點一次，代表取消不評價。
  const handleStarClick = async (score: number) => {
    if (isRatingSubmitting) return;
    setIsRatingSubmitting(true);
    try {
      const finalScore = userRating === score ? 0 : score;
      await onRate(finalScore);
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  const hasExternalResources =
    (track.externalVideos && track.externalVideos.length > 0) ||
    (track.externalPpts && track.externalPpts.length > 0);

  const categories = track.categories && track.categories.length > 0
    ? track.categories
    : track.category ? [track.category] : ['未分類'];

  return (
    <div className="max-w-2xl mx-auto px-3.5 py-3 sm:px-6 space-y-4 pb-28">
      {/* Requirement 5.7 (v2.7): 「網友關鍵字」往上移動到頁面的最上面 */}
      <div className="relative rounded-2xl p-3 sm:p-4 bg-white/80 dark:bg-slate-900/80 border border-amber-200/70 dark:border-slate-800 shadow-2xs backdrop-blur-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
            <Hash className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>網友關鍵字</span>
            <span className="text-[10px] text-slate-400 font-normal">
              ({trackKeywords.length}/20 組)
            </span>
          </div>
          {canAddKeywords && !isAddingKeyword && (
            <button
              type="button"
              onClick={() => {
                setIsAddingKeyword(true);
                setKeywordError(null);
              }}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>新增關鍵字</span>
            </button>
          )}
        </div>

        {/* Keywords Tag Chips List */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {trackKeywords.length === 0 ? (
            <span className="text-[11px] text-slate-400 italic">尚未設定網友關鍵字</span>
          ) : (
            trackKeywords.map((kw, idx) => {
              const isEditing = editingKeywordOld === kw;
              if (isEditing) {
                return (
                  <div key={idx} className="inline-flex items-center gap-1 bg-amber-50 dark:bg-slate-800 p-1 rounded-xl border border-amber-300">
                    <input
                      type="text"
                      value={editingKeywordNew}
                      onChange={e => setEditingKeywordNew(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (e.nativeEvent.isComposing || (e as any).isComposing || e.keyCode === 229) {
                            return;
                          }
                          e.preventDefault();
                          handleEditKeyword(kw, editingKeywordNew);
                        }
                        if (e.key === 'Escape') setEditingKeywordOld(null);
                      }}
                      className="px-2 py-0.5 text-xs rounded-lg border border-amber-400 bg-white dark:bg-slate-900 w-24 outline-hidden text-slate-800 dark:text-slate-100"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleEditKeyword(kw, editingKeywordNew)}
                      className="p-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 cursor-pointer"
                      title="儲存"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingKeywordOld(null)}
                      className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title="取消"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-50/90 dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-slate-700 shadow-2xs hover:border-amber-400 transition-all"
                >
                  {/* Requirement 5.11 (v2.7): 點選已新增的關鍵字，跳轉首頁篩選該關鍵字 */}
                  <button
                    type="button"
                    onClick={() => onSelectKeyword?.(kw)}
                    className="cursor-pointer hover:underline flex items-center gap-0.5"
                    title={`點擊篩選只顯示符合「${kw}」的音檔`}
                  >
                    <span className="text-amber-500 font-bold">#</span>
                    <span>{kw}</span>
                  </button>

                  {/* Edit / Delete actions for Super Admin & Contributor only */}
                  {canManageKeywords && (
                    <div className="flex items-center gap-0.5 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingKeywordOld(kw);
                          setEditingKeywordNew(kw);
                        }}
                        className="p-0.5 rounded-md hover:bg-amber-200 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 cursor-pointer"
                        title="修改關鍵字"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteKeyword(kw);
                        }}
                        className="p-0.5 rounded-md hover:bg-rose-200 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 cursor-pointer"
                        title="刪除關鍵字"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Inline Add Keyword Box - Requirement 5.10 (v2.7): 手機小裝置確保輸入框與 X 按鈕良好點擊而不被擠壓溢出 */}
        {isAddingKeyword && (
          <div className="mt-2.5 p-2 sm:p-2.5 rounded-2xl bg-amber-50/90 dark:bg-slate-800/90 border border-amber-200 dark:border-slate-700 space-y-2 animate-in fade-in max-w-full overflow-hidden">
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <input
                type="text"
                value={newKeywordInput}
                onChange={e => setNewKeywordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (e.nativeEvent.isComposing || (e as any).isComposing || e.keyCode === 229) {
                      return;
                    }
                    e.preventDefault();
                    handleAddKeyword(newKeywordInput);
                  }
                  if (e.key === 'Escape') {
                    setIsAddingKeyword(false);
                    setKeywordError(null);
                  }
                }}
                placeholder="輸入新關鍵字..."
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-hidden focus:border-amber-400"
              />
              <button
                type="button"
                disabled={!newKeywordInput.trim()}
                onClick={() => handleAddKeyword(newKeywordInput)}
                className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>加入</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingKeyword(false);
                  setKeywordError(null);
                }}
                className="shrink-0 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-rose-400 text-slate-500 hover:text-rose-600 dark:text-slate-300 cursor-pointer min-w-9 min-h-9 flex items-center justify-center touch-manipulation z-30 shadow-2xs"
                title="取消"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {keywordError && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 block font-medium">
                {keywordError}
              </span>
            )}

            {/* Suggested keywords from database to click directly */}
            {dbKeywords.filter(k => !trackKeywords.includes(k)).length > 0 && (
              <div className="pt-1 border-t border-amber-200/50 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 font-semibold">
                  資料庫曾使用過的關鍵字（點選直接加入）：
                </span>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {dbKeywords
                    .filter(k => !trackKeywords.includes(k))
                    .slice(0, 15)
                    .map((kw, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAddKeyword(kw)}
                        className="px-2 py-0.5 rounded-lg text-[10px] bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
                      >
                        +{kw}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Requirement 4: 詳細頁面介紹背景使用繁星閃爍特效 */}
      <div className="relative rounded-3xl p-4 sm:p-6 overflow-hidden bg-white/60 dark:bg-slate-900/60 border border-rose-100/70 dark:border-slate-800 shadow-sm backdrop-blur-xs">
        <TwinklingStars density="normal" className="opacity-80 dark:opacity-95" />

        {/* Main Speaker Avatar with Rotating animation when playing */}
        <div className="relative z-10 flex flex-col items-center text-center pt-1">
          <div className="relative mb-3">
            <div
              className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden shadow-xl ring-4 ring-rose-300/80 dark:ring-rose-800/80 bg-slate-100 dark:bg-slate-800 ${
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

            {/* Badge: Required permission (Requirement 11 v2.7: 私秘VIP顯示鎖頭+私秘VIP) */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xs text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md border border-amber-500/40 whitespace-nowrap flex items-center gap-1 z-10">
              {(track.isPrivateVip || track.requiredRank !== '無') && (
                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
              )}
              <span>{track.isPrivateVip ? '私秘VIP' : (track.requiredRank === '無' ? '公開' : track.requiredRank)}</span>
            </div>
          </div>

          {/* Category Pills (Requirement 11: 分類標籤顏色連動主色系) */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap justify-center mt-1">
            {categories.map((cat, idx) => (
              <span
                key={idx}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs"
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

          {/* Big Title */}
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug mb-1 max-w-lg">
            {track.title}
          </h1>

          {/* Speaker & Rank */}
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
            {track.speaker} · {track.speakerRank}
          </p>

          {/* Requirement 5.6 (v2.7): 評價、留言、按讚排列更緊密，五星靠更近，留言移到按讚前面 */}
          <div className="flex items-center justify-center gap-2 sm:gap-2.5 text-xs text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/60 py-1.5 px-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-2xs select-none">
            {/* Direct 5-star interactive rating */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(star => {
                const currentEffectiveRating = (userRating && userRating > 0) ? userRating : 0;
                const active = hoverRating > 0 ? star <= hoverRating : (currentEffectiveRating > 0 && star <= currentEffectiveRating);
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleStarClick(star)}
                    title={userRating === star ? '點擊此星星可取消評價' : `給予 ${star} 星評價`}
                    className="p-0 hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        active ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="font-bold text-slate-900 dark:text-slate-100 ml-1 text-xs tabular-nums">
                {(userRating && userRating > 0) ? userRating.toFixed(1) : (track.rating > 0 ? track.rating.toFixed(1) : '-')}
                <span className="text-slate-400 font-normal ml-0.5 text-[10px]">({track.ratingCount})</span>
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-600 text-[10px]">|</span>

            {/* Requirement 5.6: 留言按鈕順序往前移到按讚的前面 */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('comments-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="inline-flex items-center gap-1 hover:text-rose-600 transition-colors cursor-pointer text-xs"
              title="點擊前往下方留言區"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>{comments.length} 則留言</span>
            </button>

            <span className="text-slate-300 dark:text-slate-600 text-[10px]">|</span>

            {/* Interactive Heart */}
            <button
              onClick={handleToggleLikeClick}
              className="inline-flex items-center gap-1 transition-transform active:scale-95 cursor-pointer text-slate-500 text-xs"
              style={{
                color: localLiked ? 'var(--color-primary, #c06c84)' : undefined,
                fontWeight: localLiked ? 'bold' : 'normal'
              }}
              title={localLiked ? '已按讚，點擊收回讚' : '給予這部演講一個愛心按讚'}
            >
              <Heart
                className="w-3.5 h-3.5 transition-colors"
                style={{
                  color: localLiked ? 'var(--color-primary, #c06c84)' : undefined,
                  fill: localLiked ? 'var(--color-primary, #c06c84)' : 'none'
                }}
              />
              <span>{localLikesCount}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audio Player Card */}
      <div className="bg-white/90 dark:bg-slate-900/90 rounded-3xl p-4 sm:p-5 border border-rose-100/70 dark:border-slate-800 shadow-md space-y-3">
        {/* Progress Bar & Time */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.5}
            value={currentTime}
            onChange={e => onSeek(Number(e.target.value))}
            className="audio-scrubber w-full h-1.5"
          />
          <div className="flex justify-between items-center text-xs font-mono text-slate-500 dark:text-slate-400 px-0.5">
            <span>{formatTime(currentTime)} / {formatTime(safeDuration)}</span>
            <span className="text-[11px] text-slate-400">
              {Math.round((currentTime / safeDuration) * 100)}%
            </span>
          </div>
        </div>

        {/* Controls: Requirement 5.12: 刪除30秒按鈕，放大10秒符號 */}
        <div className="flex items-center justify-center gap-6 sm:gap-8 py-1.5">
          <button
            type="button"
            onClick={() => onSkip(-10)}
            title="倒退 10 秒"
            className="w-12 h-12 rounded-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all border border-slate-200/80 dark:border-slate-700 shadow-2xs cursor-pointer group"
          >
            <RotateCcw className="w-5 h-5 text-slate-700 dark:text-slate-200 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black -mt-0.5 font-mono">10</span>
          </button>

          <button
            type="button"
            onClick={handlePlayClick}
            title={isPlaying ? '暫停' : '播放'}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white text-white" />
            ) : (
              <Play className="w-7 h-7 fill-white text-white ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSkip(10)}
            title="快轉 10 秒"
            className="w-12 h-12 rounded-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all border border-slate-200/80 dark:border-slate-700 shadow-2xs cursor-pointer group"
          >
            <RotateCw className="w-5 h-5 text-slate-700 dark:text-slate-200 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black -mt-0.5 font-mono">10</span>
          </button>
        </div>

        {/* Speed Control Row (0.7x ~ 2.0x) */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {[0.7, 1.0, 1.25, 1.5, 2.0].map(rate => (
            <button
              key={rate}
              onClick={() => onChangeSpeed(rate)}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-semibold transition-all ${
                playbackRate === rate
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Requirement 5.5: 區塊標題改為「參考資料」，放在「演講資訊與備註」的上面 */}
      {hasExternalResources && (
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl p-4 border border-rose-100/60 dark:border-slate-800 shadow-xs space-y-2.5 text-xs">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-500" />
            <span>參考資料</span>
          </h3>
          <div className="space-y-1.5 pt-1">
            {track.externalVideos?.map((v, i) => (
              <a
                key={`v-${i}`}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-xl bg-red-50/60 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold transition-colors"
              >
                <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                <span className="truncate flex-1">{v.name || v.url}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </a>
            ))}
            {track.externalPpts?.map((p, i) => (
              <a
                key={`p-${i}`}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/60 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-semibold transition-colors"
              >
                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate flex-1">{p.name || p.url}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Description & Metadata Card */}
      <div className="relative bg-white/80 dark:bg-slate-900/80 rounded-2xl p-4 border border-rose-100/60 dark:border-slate-800 shadow-xs space-y-2.5 text-xs overflow-hidden">
        <TwinklingStars density="subtle" className="opacity-40 dark:opacity-60" />
        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              演講資訊與備註
            </h3>
            {/* Requirement 5.13: 按下編輯按鈕時，非原地編輯，改成跳轉「後台管理」 > 「編輯音檔」的相同視窗介面 */}
            {canEditTrack && (
              <button
                type="button"
                onClick={() => {
                  if (onEditTrack) {
                    onEditTrack(track);
                  } else {
                    handleStartEditTrack();
                  }
                }}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800 transition-all cursor-pointer shadow-2xs"
                title="跳轉編輯音檔視窗介面"
              >
                <Edit3 className="w-3.5 h-3.5 text-rose-500" />
                <span>編輯演講資訊與連結</span>
              </button>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {track.description || '無詳細說明'}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            {/* Requirement 5.9 (v2.7): 演講資訊與備註新增：上傳者的名字 */}
            <div>
              <span className="text-slate-400">上傳者：</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{uploaderName}</span>
            </div>
            <div>
              <span className="text-slate-400">系列：</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{track.series || '單曲'}</span>
            </div>
            <div>
              <span className="text-slate-400">演講日期：</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{track.speechDate || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400">上傳日期：</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{track.uploadDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Requirement 5.1, 5.2, 5.4 (v2.7): 「分享錄音」與「匯出圖卡」按鈕移到留言板的上面 */}
      <div className="flex items-center justify-end gap-2 pt-1 pb-1">
        <button
          type="button"
          onClick={onShare}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5 text-rose-500" />
          <span>分享錄音</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenBwExport('rated')}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-2xs hover:brightness-105 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>匯出圖卡</span>
        </button>
      </div>

      {/* Comments Section */}
      <div id="comments-section">
        <CommentsSection
          trackId={track.id}
          comments={comments}
          visitor={visitor}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onEditComment={onEditComment}
          onViewMember={onViewMember}
          allUsers={allUsers}
          tracks={tracks}
        />
      </div>
    </div>
  );
};
