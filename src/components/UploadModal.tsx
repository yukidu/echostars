import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileAudio,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
  Link,
  FileText,
  Youtube,
  Edit2,
  Check,
  Tag,
  Crown
} from 'lucide-react';
import { Track, CategoryType, AmwayRank, RANK_ORDER, ExternalLinkItem, UserProfile, SPEAKER_RANK_OPTIONS, GAR_ELIGIBLE_RANKS } from '../types';
import { parseID3Tags } from '../utils/id3Parser';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTrack: Track) => void;
  currentUser: UserProfile | null;
  isAdmin: boolean;
  trackToEdit?: Track | null;
  onCategoriesUpdated?: () => void;
  tracks?: Track[];
}

const ALL_CATEGORIES: CategoryType[] = [
  '事業',
  '心態思維',
  '營養',
  '安麗產品',
  '影集',
  '未分類'
];

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  isAdmin,
  trackToEdit,
  onCategoriesUpdated,
  tracks = []
}) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');

  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [baseSpeakerRank, setBaseSpeakerRank] = useState<string>('無');
  const [isGarRank, setIsGarRank] = useState(false);

  const speakerRank = React.useMemo(() => {
    if (baseSpeakerRank === '無') return '無';
    if (isGarRank && GAR_ELIGIBLE_RANKS.includes(baseSpeakerRank)) {
      return `GAR${baseSpeakerRank}`;
    }
    return baseSpeakerRank;
  }, [baseSpeakerRank, isGarRank]);

  const handleBaseRankChange = (newRank: string) => {
    setBaseSpeakerRank(newRank);
    if (!GAR_ELIGIBLE_RANKS.includes(newRank)) {
      setIsGarRank(false);
    }
  };
  const [selectedCategories, setSelectedCategories] = useState<CategoryType[]>(['事業']);
  const [series, setSeries] = useState('');
  const [speechDate, setSpeechDate] = useState(new Date().toISOString().split('T')[0].replace(/-/g, '/'));
  const [seriesOrder, setSeriesOrder] = useState('第 1 集');
  const [requiredRank, setRequiredRank] = useState<AmwayRank>('無');
  const [description, setDescription] = useState('');
  // Requirement 6 & 12: 私秘 VIP 音檔，預設永久有效
  const [isPrivateVip, setIsPrivateVip] = useState(false);
  const [vipDurationDays, setVipDurationDays] = useState<number>(0);

  // Named external links (新增自訂名稱)
  const [externalVideos, setExternalVideos] = useState<ExternalLinkItem[]>([
    { name: '', url: '' }
  ]);
  const [externalPpts, setExternalPpts] = useState<ExternalLinkItem[]>([
    { name: '', url: '' }
  ]);
  const [externalFiles, setExternalFiles] = useState<ExternalLinkItem[]>([
    { name: '', url: '' }
  ]);

  const [isParsingId3, setIsParsingId3] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Requirement 8: 分類標籤動態管理 (新增、修改、刪除)
  const [categoryList, setCategoryList] = useState<string[]>(ALL_CATEGORIES);
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCatOld, setEditingCatOld] = useState<string | null>(null);
  const [editingCatNew, setEditingCatNew] = useState('');
  const [isCatLoading, setIsCatLoading] = useState(false);

  // Requirement 1: 網友關鍵字 (最多 20 組)
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [dbKeywords, setDbKeywords] = useState<string[]>([]);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCategoryList(data);
        }
      }
    } catch {
      // fallback
    }
  };

  const loadDbKeywords = async () => {
    try {
      const res = await fetch('/api/keywords');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDbKeywords(data);
        }
      }
    } catch {
      // fallback
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadDbKeywords();
    }
  }, [isOpen]);

  const handleAddKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) return;
    if (keywords.length >= 20) {
      setErrorMessage('每首音檔最多只能設定 20 個網友關鍵字！');
      return;
    }
    setErrorMessage(null);
    setKeywords(prev => [...prev, trimmed]);
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  const handleCreateCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCatInput.trim() || isCatLoading) return;
    setIsCatLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatInput.trim() })
      });
      if (res.ok) {
        const addedName = newCatInput.trim();
        setNewCatInput('');
        await loadCategories();
        // auto select newly created category if under limit (max 3)
        if (selectedCategories.length < 3) {
          setSelectedCategories(prev => [...prev, addedName as CategoryType]);
        }
        if (onCategoriesUpdated) onCategoriesUpdated();
      }
    } finally {
      setIsCatLoading(false);
    }
  };

  const handleUpdateCategory = async (oldName: string) => {
    if (!editingCatNew.trim() || editingCatNew.trim() === oldName || isCatLoading) {
      setEditingCatOld(null);
      return;
    }
    setIsCatLoading(true);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: editingCatNew.trim() })
      });
      if (res.ok) {
        const updated = editingCatNew.trim();
        setSelectedCategories(prev => prev.map(c => (c === oldName ? (updated as CategoryType) : c)));
        setEditingCatOld(null);
        await loadCategories();
        if (onCategoriesUpdated) onCategoriesUpdated();
      }
    } finally {
      setIsCatLoading(false);
    }
  };

  const handleDeleteCategoryTag = async (catName: string) => {
    setIsCatLoading(true);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(catName)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSelectedCategories(prev => {
          const next = prev.filter(c => c !== catName);
          return next.length > 0 ? next : (['未分類'] as CategoryType[]);
        });
        await loadCategories();
        if (onCategoriesUpdated) onCategoriesUpdated();
      }
    } finally {
      setIsCatLoading(false);
    }
  };

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // When trackToEdit changes or modal opens, initialize fields
  React.useEffect(() => {
    if (trackToEdit) {
      setTitle(trackToEdit.title || '');
      setSpeaker(trackToEdit.speaker || '');
      const rawRank = (trackToEdit.speakerRank || '無').trim();
      const hasGar = rawRank.startsWith('GAR');
      const cleanRank = hasGar ? rawRank.replace(/^GAR/, '').trim() : rawRank;
      const matched = (SPEAKER_RANK_OPTIONS as readonly string[]).includes(cleanRank) ? cleanRank : '無';
      setBaseSpeakerRank(matched);
      setIsGarRank(hasGar && GAR_ELIGIBLE_RANKS.includes(matched));
      setSelectedCategories(trackToEdit.categories && trackToEdit.categories.length > 0 ? trackToEdit.categories.slice(0, 3) : ['事業']);
      setKeywords(Array.isArray(trackToEdit.keywords) ? [...trackToEdit.keywords] : []);
      setSeries(trackToEdit.series || '');
      setSpeechDate(trackToEdit.speechDate || '');
      setSeriesOrder(trackToEdit.seriesOrder || '第 1 集');
      setRequiredRank(trackToEdit.requiredRank || '無');
      setDescription(trackToEdit.description || '');
      setIsPrivateVip(Boolean(trackToEdit.isPrivateVip));
      setVipDurationDays(trackToEdit.vipDurationDays !== undefined ? trackToEdit.vipDurationDays : 0);
      setCoverPreview(trackToEdit.speakerAvatar || '');
      setExternalVideos(trackToEdit.externalVideos && trackToEdit.externalVideos.length > 0 ? trackToEdit.externalVideos : [{ name: '', url: '' }]);
      setExternalPpts(trackToEdit.externalPpts && trackToEdit.externalPpts.length > 0 ? trackToEdit.externalPpts : [{ name: '', url: '' }]);
      setExternalFiles(trackToEdit.externalFiles && trackToEdit.externalFiles.length > 0 ? trackToEdit.externalFiles : [{ name: '', url: '' }]);
      setAudioFile(null);
    } else {
      setTitle('');
      setSpeaker('');
      setBaseSpeakerRank('無');
      setIsGarRank(false);
      setSelectedCategories(['事業']);
      setKeywords([]);
      setSeries('');
      setSpeechDate(new Date().toISOString().split('T')[0].replace(/-/g, '/'));
      setSeriesOrder('第 1 集');
      setRequiredRank('無');
      setDescription('');
      setIsPrivateVip(false);
      setVipDurationDays(0);
      setCoverPreview('');
      setExternalVideos([{ name: '', url: '' }]);
      setExternalPpts([{ name: '', url: '' }]);
      setExternalFiles([{ name: '', url: '' }]);
      setAudioFile(null);
    }
  }, [trackToEdit, isOpen]);

  if (!isOpen) return null;

  // Unmodifiable today upload date
  const today = new Date();
  const todayUploadDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

  const toggleCategory = (cat: CategoryType) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return; // at least 1
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
      setErrorMessage(null);
    } else {
      if (selectedCategories.length >= 3) {
        setErrorMessage('分類標籤限制最多只能選 3 個！');
        return;
      }
      setErrorMessage(null);
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleAudioSelected = async (file: File) => {
    if (file.size === 0) {
      setErrorMessage('無效檔案：檔案大小為 0 byte，已被系統阻擋！');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage('音檔大小不可超過 100MB！');
      return;
    }

    setErrorMessage(null);
    setAudioFile(file);

    setIsParsingId3(true);
    try {
      const id3 = await parseID3Tags(file);
      if (id3.title && !title) setTitle(id3.title);
      if (id3.artist && !speaker) setSpeaker(id3.artist);
      if (id3.album && !series) setSeries(id3.album);
      if (id3.year && !speechDate) setSpeechDate(id3.year);
      if (id3.track && !seriesOrder) setSeriesOrder(`第 ${id3.track} 集`);
      if (id3.pictureUrl && !coverPreview) {
        setCoverPreview(id3.pictureUrl);
      }
    } catch {
      // ignore
    } finally {
      setIsParsingId3(false);
    }
  };

  const handleCoverSelected = (file: File) => {
    if (file.size === 0) {
      setErrorMessage('封面檔案大小為 0 byte！');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('封面圖檔不可超過 10MB！');
      return;
    }
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile && !trackToEdit) {
      setErrorMessage('請務必提供音訊檔案！');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('請填寫演講主題！');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadStatusText('準備上傳中...');

    try {
      let finalAudioUrl = trackToEdit?.audioUrl || '';

      // Direct upload audio file to Cloudflare R2
      if (audioFile) {
        setUploadStatusText('正在直傳音訊至 Cloudflare R2 儲存桶...');
        const audioFormData = new FormData();
        audioFormData.append('file', audioFile);
        audioFormData.append('title', title.trim());
        audioFormData.append('speaker', speaker.trim());
        audioFormData.append('speakerRank', speakerRank.trim());
        audioFormData.append('fileType', 'audio');
        const uploadAudioRes = await fetch('/api/r2/upload', {
          method: 'POST',
          body: audioFormData
        });

        if (!uploadAudioRes.ok) {
          const errData = await uploadAudioRes.json().catch(() => ({}));
          throw new Error(errData.error || `音檔直傳 R2 失敗 (HTTP ${uploadAudioRes.status})`);
        }

        const uploadAudioData = await uploadAudioRes.json();
        if (!uploadAudioData.url) {
          throw new Error('R2 伺服器未回傳檔案存取網址');
        }
        finalAudioUrl = uploadAudioData.url;
      }

      let finalCoverUrl =
        trackToEdit?.speakerAvatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80';

      // Direct upload cover file to Cloudflare R2
      if (coverFile) {
        setUploadStatusText('正在上傳講師封面至 Cloudflare R2...');
        const coverFormData = new FormData();
        coverFormData.append('file', coverFile);
        coverFormData.append('title', title.trim());
        coverFormData.append('speaker', speaker.trim());
        coverFormData.append('speakerRank', speakerRank.trim());
        coverFormData.append('fileType', 'cover');
        const uploadCoverRes = await fetch('/api/r2/upload', {
          method: 'POST',
          body: coverFormData
        });
        if (uploadCoverRes.ok) {
          const uploadCoverData = await uploadCoverRes.json();
          if (uploadCoverData.url) {
            finalCoverUrl = uploadCoverData.url;
          }
        }
      } else if (coverPreview && !coverPreview.startsWith('blob:')) {
        finalCoverUrl = coverPreview;
      }

      setUploadStatusText('正在儲存錄音檔資訊至雲端資料庫...');

      const cleanVideos = externalVideos.filter(v => v.url.trim());
      const cleanPpts = externalPpts.filter(p => p.url.trim());
      const cleanFiles = externalFiles.filter(f => f.url.trim());

      const payload = {
        title: title.trim(),
        speaker: speaker.trim() || '特邀講師',
        speakerRank: speakerRank.trim() || '無',
        speakerAvatar: finalCoverUrl,
        categories: selectedCategories.slice(0, 3),
        keywords: keywords.slice(0, 20),
        series: series.trim() || '精選演講系列',
        speechDate: speechDate.trim() || todayUploadDate,
        requiredRank,
        seriesOrder: seriesOrder.trim() || '第 1 集',
        description: description.trim() || '豐富心智、啟發事業行動的講師音檔分享。',
        audioUrl: finalAudioUrl,
        uploaderId: trackToEdit ? trackToEdit.uploaderId : currentUser?.id,
        uploaderEmail: trackToEdit ? trackToEdit.uploaderEmail : (currentUser?.email || (isAdmin ? 'yukidu@gmail.com' : 'contributor')),
        userEmail: currentUser?.email || (isAdmin ? 'yukidu@gmail.com' : ''),
        externalVideos: cleanVideos,
        externalPpts: cleanPpts,
        externalFiles: cleanFiles,
        durationSeconds: trackToEdit?.durationSeconds || 600,
        isPrivateVip,
        vipDurationDays: isPrivateVip ? vipDurationDays : 0,
        vipToken: trackToEdit?.vipToken
      };

      const url = trackToEdit ? `/api/tracks/${trackToEdit.id}` : '/api/tracks';
      const method = trackToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '伺服器處理失敗');
      }

      const resData = await res.json();
      const trackObj = (resData && typeof resData === 'object' && ('track' in resData)) ? resData.track : resData;
      const normalizedTrack = {
        ...trackObj,
        ratings: (trackObj && typeof trackObj.ratings === 'object' && trackObj.ratings !== null) ? trackObj.ratings : {},
        likedBy: Array.isArray(trackObj?.likedBy) ? trackObj.likedBy : [],
        categories: Array.isArray(trackObj?.categories) && trackObj.categories.length > 0 ? trackObj.categories : (selectedCategories.length > 0 ? selectedCategories.slice(0, 3) : ['未分類']),
        keywords: Array.isArray(trackObj?.keywords) ? trackObj.keywords : (keywords.length > 0 ? keywords.slice(0, 20) : []),
        rating: typeof trackObj?.rating === 'number' ? trackObj.rating : 5.0,
        ratingCount: typeof trackObj?.ratingCount === 'number' ? trackObj.ratingCount : 1,
        commentsCount: typeof trackObj?.commentsCount === 'number' ? trackObj.commentsCount : 0,
        likes: typeof trackObj?.likes === 'number' ? trackObj.likes : 0,
        playCount: typeof trackObj?.playCount === 'number' ? trackObj.playCount : 0
      };
      onSuccess(normalizedTrack);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || '上傳失敗，請檢查網路連線');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-rose-100/60 dark:border-slate-800 my-6">
        {/* Header - Requirement 20: 統一底色與麥克風相同色 */}
        <div
          className="p-4 sm:p-5 flex items-center justify-between text-white"
          style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {trackToEdit ? `修改錄音檔《${trackToEdit.title}》` : '上傳講師音檔 (Cloudflare R2 直傳)'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Audio Drag and Drop Area */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              音訊檔案 * (上限 100MB，防護 0 byte)
            </label>
            <div
              onClick={() => audioInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleAudioSelected(e.dataTransfer.files[0]);
              }}
              className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                audioFile
                  ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-rose-300 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mp3,audio/m4a,audio/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) handleAudioSelected(e.target.files[0]);
                }}
              />
              {audioFile ? (
                <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-bold text-xs">{audioFile.name}</p>
                    <p className="text-[11px] opacity-75">
                      {(audioFile.size / 1024 / 1024).toFixed(2)} MB • 直傳 Cloudflare R2
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500">
                  <FileAudio className="w-6 h-6 text-rose-400 mb-1" />
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    點擊選取或拖曳音訊檔至此
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    支援 MP3、M4A 格式 (自動抓取 ID3 標籤)
                  </p>
                </div>
              )}
            </div>
            {isParsingId3 && (
              <p className="text-rose-600 mt-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                正在自動解析 ID3 標籤與講者資訊...
              </p>
            )}
          </div>

          {/* 2. Cover Photo Area */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              主講者封面照片 (上限 10MB)
            </label>
            <div className="flex items-center gap-3">
              <div
                onClick={() => coverInputRef.current?.click()}
                className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-rose-400 bg-slate-50 dark:bg-slate-800 shrink-0"
              >
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.[0]) handleCoverSelected(e.target.files[0]);
                  }}
                />
                {coverPreview ? (
                  <img src={coverPreview} alt="預覽封面" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {coverFile ? coverFile.name : '未選擇照片 (使用預設精美頭像)'}
                </p>
                <p className="text-slate-400">
                  直傳 Cloudflare R2 covers/ 空間
                </p>
              </div>
            </div>
          </div>

          {/* 3. Categories Selection (Requirement 5: 限制最多只能選三個) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                分類標籤 (最多可選 3 個，已選 {selectedCategories.length}/3)
              </label>
              <span className="text-[10px] text-slate-400">
                點擊標籤選取；右側按鈕可編輯或刪除標籤
              </span>
            </div>

            {/* Existing Categories List with Inline Edit & Delete */}
            <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
              {categoryList.map(cat => {
                const isSelected = selectedCategories.includes(cat as CategoryType);
                const isEditing = editingCatOld === cat;

                if (isEditing) {
                  return (
                    <div
                      key={cat}
                      className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-rose-300 shadow-2xs"
                    >
                      <input
                        type="text"
                        value={editingCatNew}
                        onChange={e => setEditingCatNew(e.target.value)}
                        className="text-xs px-1 py-0.5 w-20 bg-transparent text-slate-900 dark:text-white outline-hidden font-bold"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateCategory(cat)}
                        className="p-1 rounded-md bg-emerald-500 text-white"
                        title="確認儲存"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatOld(null)}
                        className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        title="取消"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat}
                    className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat as CategoryType)}
                      className="cursor-pointer"
                    >
                      {isSelected ? `✓ ${cat}` : `+ ${cat}`}
                    </button>

                    {/* Edit Tag Name */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCatOld(cat);
                        setEditingCatNew(cat);
                      }}
                      className={`p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 ${
                        isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="修改標籤名稱"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>

                    {/* Delete Tag */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategoryTag(cat);
                      }}
                      className={`p-0.5 rounded-md hover:bg-rose-600/30 ${
                        isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                      }`}
                      title="刪除此標籤"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Add New Category Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
                placeholder="輸入新標籤名稱 (例如: 心態、營養、產品故事)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden focus:border-rose-400"
              />
              <button
                type="button"
                disabled={isCatLoading || !newCatInput.trim()}
                onClick={() => handleCreateCategory()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-rose-600 dark:hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1 transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增標籤</span>
              </button>
            </div>
          </div>

          {/* 3.5 網友關鍵字 (Requirement 1: 最多設定20個關鍵字，自動抓取資料庫紀錄供直接點選) */}
          <div className="space-y-2 p-3 rounded-2xl bg-amber-50/60 dark:bg-slate-800/60 border border-amber-200/70 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <label className="font-bold text-slate-800 dark:text-slate-100">
                  網友關鍵字 (已設 {keywords.length}/20)
                </label>
              </div>
              <span className="text-[10px] text-slate-400">
                每首音檔最多 20 組關鍵字
              </span>
            </div>

            {/* Current Track Selected Keywords */}
            <div className="flex flex-wrap gap-1.5 min-h-7 items-center">
              {keywords.length === 0 ? (
                <span className="text-slate-400 text-xs italic">尚未設定關鍵字，可從下方直接點選或自訂輸入新增</span>
              ) : (
                keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold text-xs border border-amber-300 dark:border-amber-800 shadow-2xs"
                  >
                    <span>#{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Input to Add Custom Keyword */}
            <div className="flex items-center gap-2 pt-1">
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
                }}
                disabled={keywords.length >= 20}
                placeholder={keywords.length >= 20 ? '已達 20 個關鍵字上限' : '輸入新關鍵字後按 Enter 或點新增...'}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-hidden focus:border-amber-400 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!newKeywordInput.trim() || keywords.length >= 20}
                onClick={() => handleAddKeyword(newKeywordInput)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>加入關鍵字</span>
              </button>
            </div>

            {/* Previously used keywords in Database for 1-click addition */}
            {dbKeywords.length > 0 && (
              <div className="pt-2 border-t border-amber-100 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 font-semibold">
                  點選曾被使用的熱門關鍵字直接帶入：
                </span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {dbKeywords.map((kw, i) => {
                    const isAdded = keywords.includes(kw);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => isAdded ? handleRemoveKeyword(kw) : handleAddKeyword(kw)}
                        disabled={!isAdded && keywords.length >= 20}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          isAdded
                            ? 'bg-amber-500 text-white font-bold'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:border-amber-400 disabled:opacity-40'
                        }`}
                      >
                        {isAdded ? `✓ #${kw}` : `+ #${kw}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Text Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                演講主題 (title) *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例：把目標變成業績的關鍵心法"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                演講人 (TPE1)
              </label>
              <input
                type="text"
                value={speaker}
                onChange={e => setSpeaker(e.target.value)}
                placeholder="例：陳志豪"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  講師獎銜
                </label>
                {speakerRank !== '無' && (
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-900/60">
                    目前標記：{speakerRank}
                  </span>
                )}
              </div>
              <select
                value={baseSpeakerRank}
                onChange={e => handleBaseRankChange(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400 font-medium cursor-pointer"
              >
                {SPEAKER_RANK_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {/* 執行專才鑽石包含之後的獎銜，出現「GAR全球獎銜」勾選選項 */}
              {GAR_ELIGIBLE_RANKS.includes(baseSpeakerRank) && (
                <label className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/30 border border-amber-300/80 dark:border-amber-800/60 cursor-pointer shadow-2xs hover:brightness-95 transition-all">
                  <input
                    type="checkbox"
                    checked={isGarRank}
                    onChange={e => setIsGarRank(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 accent-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                      GAR全球獎銜
                    </span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                      (勾選後儲存與檔案名稱將加上 GAR，顯示為：GAR{baseSpeakerRank})
                    </span>
                  </div>
                </label>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                系列 (TALB)
              </label>
              <input
                type="text"
                value={series}
                onChange={e => setSeries(e.target.value)}
                placeholder="例：事業進階系列"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                演講日期 (TDRC)
              </label>
              <input
                type="text"
                value={speechDate}
                onChange={e => setSpeechDate(e.target.value)}
                placeholder="YYYY/MM/DD"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                系列順序 (TRCK)
              </label>
              <input
                type="text"
                value={seriesOrder}
                onChange={e => setSeriesOrder(e.target.value)}
                placeholder="例：第 1 集"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400"
              />
            </div>

            {/* 新需求: 獎銜＝閱讀瀏覽權限 */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                瀏覽權限最低門檻獎銜（含該獎銜以上皆可收聽）
              </label>
              <select
                value={requiredRank}
                onChange={e => setRequiredRank(e.target.value as AmwayRank)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:border-rose-400"
              >
                {RANK_ORDER.map(r => (
                  <option key={r} value={r}>
                    {r === '無' ? '無 (公開，訪客也能收聽)' : `${r} 以上`}
                  </option>
                ))}
              </select>
            </div>

            {/* Requirement 6: 私秘VIP 獨立選項 */}
            <div className="col-span-1 sm:col-span-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-white to-amber-50/70 dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900 border-2 border-purple-200 dark:border-purple-900/60 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPrivateVip}
                    onChange={e => {
                      const cleanEmail = currentUser?.email?.toLowerCase().trim();
                      const isOwner = isAdmin || cleanEmail === 'yukidu@gmail.com';
                      const myVipTracksCount = tracks ? tracks.filter(t => t.isPrivateVip && (t.uploaderEmail === cleanEmail || t.uploaderId === currentUser?.id)).length : 0;
                      if (e.target.checked && !isOwner && myVipTracksCount >= 10 && !trackToEdit?.isPrivateVip) {
                        setErrorMessage('每位貢獻者上限最多上傳 10 個私秘 VIP 音檔，您目前已達上限 (10/10)。');
                        return;
                      }
                      setErrorMessage(null);
                      setIsPrivateVip(e.target.checked);
                    }}
                    className="w-4 h-4 text-purple-600 rounded-md border-purple-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="font-extrabold text-sm text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>私秘 VIP 專屬音檔</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold">
                      獨立限定
                    </span>
                  </span>
                </label>

                <span className="text-[11px] font-mono font-bold text-purple-700 dark:text-purple-300">
                  {isAdmin || currentUser?.email === 'yukidu@gmail.com' ? '超級管理員 (無上限)' : `貢獻者配額：${tracks ? tracks.filter(t => t.isPrivateVip && (t.uploaderEmail === currentUser?.email || t.uploaderId === currentUser?.id)).length : 0}/10 首`}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                勾選「私秘VIP」後，只有擁有專屬 VIP 連結者方可瀏覽與聆聽該音檔（訪客未登入持有連結亦可直接收聽）。此音檔同時也會顯示在首頁清單。
              </p>

              {isPrivateVip && (
                <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40 flex flex-wrap items-center gap-3 text-xs animate-in fade-in">
                  <label className="font-bold text-purple-900 dark:text-purple-200 shrink-0">
                    專屬連結有效天數：
                  </label>
                  <select
                    value={vipDurationDays}
                    onChange={e => setVipDurationDays(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold outline-hidden"
                  >
                    <option value={0}>永久有效 (預設)</option>
                    <option value={3}>3 天後失效</option>
                    <option value={7}>7 天後失效</option>
                    <option value={14}>14 天後失效</option>
                    <option value={30}>30 天後失效</option>
                  </select>
                  <span className="text-[10px] text-slate-400">
                    發布後可至「後台管理中心 &gt; 私秘VIP」重置連結或隨時刪除
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                今天上傳日期 (系統自動產生，不可修改)
              </label>
              <input
                type="text"
                value={todayUploadDate}
                disabled
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* 5. 外部影片連結（可多個，自訂名稱） */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Youtube className="w-3.5 h-3.5 text-red-500" />
                <span>外部影片連結（可多個，可自訂名稱）</span>
              </label>
              <button
                type="button"
                onClick={() => setExternalVideos([...externalVideos, { name: '', url: '' }])}
                className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5 text-[11px]"
              >
                <Plus className="w-3 h-3" /> 新增影片
              </button>
            </div>
            {externalVideos.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="自訂連結名稱 (例: 產品示範精華)"
                  value={v.name}
                  onChange={e => {
                    const next = [...externalVideos];
                    next[i].name = e.target.value;
                    setExternalVideos(next);
                  }}
                  className="w-1/3 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <input
                  type="text"
                  placeholder="YouTube 網址 (https://...)"
                  value={v.url}
                  onChange={e => {
                    const next = [...externalVideos];
                    next[i].url = e.target.value;
                    setExternalVideos(next);
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                {externalVideos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setExternalVideos(externalVideos.filter((_, idx) => idx !== i))}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 6. 外部 PPT 簡報連結（可多個，自訂名稱） */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>外部 PPT 簡報檔連結（可多個，可自訂名稱）</span>
              </label>
              <button
                type="button"
                onClick={() => setExternalPpts([...externalPpts, { name: '', url: '' }])}
                className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5 text-[11px]"
              >
                <Plus className="w-3 h-3" /> 新增 PPT
              </button>
            </div>
            {externalPpts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="自訂 PPT 名稱 (例: 事業商機簡報檔)"
                  value={p.name}
                  onChange={e => {
                    const next = [...externalPpts];
                    next[i].name = e.target.value;
                    setExternalPpts(next);
                  }}
                  className="w-1/3 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <input
                  type="text"
                  placeholder="簡報連結 (https://docs.google.com/... 或雲端)"
                  value={p.url}
                  onChange={e => {
                    const next = [...externalPpts];
                    next[i].url = e.target.value;
                    setExternalPpts(next);
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                {externalPpts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setExternalPpts(externalPpts.filter((_, idx) => idx !== i))}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">
              內容簡介
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="輸入演講重點與摘要..."
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden resize-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 rounded-xl text-white font-bold shadow-md active:scale-95 disabled:opacity-50 transition-all"
              style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
            >
              {isUploading
                ? (uploadStatusText || (trackToEdit ? '儲存修改中...' : '直傳 Cloudflare R2 中...'))
                : (trackToEdit ? '儲存錄音檔修改' : '確認發佈錄音檔')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
