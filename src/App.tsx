/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ChevronDown, Check, X, ShieldAlert, UploadCloud, Mic, ArrowDown, ArrowUp, Hash } from 'lucide-react';
import {
  Track,
  Comment,
  UserProfile,
  CategoryType,
  SortField,
  SortDirection,
  SortType,
  RANK_ORDER,
  AmwayRank,
  PlayerDisplayMode,
  SPEAKER_RANK_OPTIONS
} from './types';
import {
  LIGHT_PALETTES,
  DARK_THEME,
  getRandomLightPalette,
  applyThemeToDom
} from './utils/theme';
import { getOrCreateVisitor, VisitorIdentity } from './utils/visitor';
import {
  getStoredPlayback,
  saveStoredPlayback,
  AudioMemory
} from './utils/audio';
import {
  recordOfflineTrack,
  handleTrackProgressOffline,
  purgeStaleOfflineTracks
} from './utils/offlineAudio';

import { Navbar, NavTab } from './components/Navbar';
import { AudioCard } from './components/AudioCard';
import { MiniPlayer } from './components/MiniPlayer';
import { DetailView } from './components/DetailView';
import { UploadModal } from './components/UploadModal';
import { AdminModal } from './components/AdminModal';
import { ProfileModal } from './components/ProfileModal';
import { ShareModal } from './components/ShareModal';
import { BwExportModal } from './components/BwExportModal';
import { StatisticsView } from './components/StatisticsView';
import { CommentPreviewModal } from './components/CommentPreviewModal';
import { MemberPreviewModal } from './components/MemberPreviewModal';
import { NotificationsView } from './components/NotificationsView';
import { TwinklingStars } from './components/TwinklingStars';
import { ChangelogModal } from './components/ChangelogModal';

const DEFAULT_CATEGORIES: string[] = [
  '全部',
  '事業',
  '心態思維',
  '營養',
  '安麗產品',
  '影集',
  '未分類'
];

const SORT_OPTIONS: SortType[] = [
  '最新上傳',
  '評價最高',
  '留言最多',
  '按讚最多',
  '演講者'
];

export default function App() {
  // Navigation & View States
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Dynamic Categories (Requirement 5: 後台修改或刪除分類標籤後，首頁下拉選單同步更新)
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORIES);

  // Requirement 4 (v2.7): 自適應字體大小計算邏輯：當視窗寬度 < 360px 時，將 html 的 font-size 動態調整為 12px 或 13px，並透過 CSS 變數將此縮小比例應用於所有 UI 元件
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const root = document.documentElement;
      if (width < 320) {
        root.style.fontSize = '12px';
        root.style.setProperty('--ui-pad-scale', '0.78');
        root.style.setProperty('--ui-gap-scale', '0.78');
        root.style.setProperty('--ui-scale', '0.82');
      } else if (width < 360) {
        root.style.fontSize = '13px';
        root.style.setProperty('--ui-pad-scale', '0.86');
        root.style.setProperty('--ui-gap-scale', '0.86');
        root.style.setProperty('--ui-scale', '0.89');
      } else {
        root.style.fontSize = '';
        root.style.setProperty('--ui-pad-scale', '1');
        root.style.setProperty('--ui-gap-scale', '1');
        root.style.setProperty('--ui-scale', '1');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Requirement 11 (v2.7): 記憶已解鎖的私秘VIP音檔，支援經由專屬連結永久解鎖
  const [unlockedVipTracks, setUnlockedVipTracks] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sq_unlocked_vip_tracks');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const vipToken = params.get('vipToken');
      const trackId = params.get('trackId');
      if (vipToken && trackId) {
        setUnlockedVipTracks(prev => {
          if (prev.includes(trackId)) return prev;
          const next = [...prev, trackId];
          localStorage.setItem('sq_unlocked_vip_tracks', JSON.stringify(next));
          return next;
        });
      }
    }
  }, []);

  // Requirement 14: 記憶播放器狀態，如果是浮動播放器就一直維持浮動狀態
  const [savedPreferredMode, setSavedPreferredMode] = useState<PlayerDisplayMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sq_player_display_mode');
      if (stored === 'bubble' || stored === 'bar') return stored;
    }
    return 'bar';
  });

  const [playerMode, setPlayerModeState] = useState<PlayerDisplayMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sq_player_display_mode');
      if (stored === 'bubble' || stored === 'bar') return stored;
    }
    return 'bar';
  });

  const setPlayerMode = (mode: PlayerDisplayMode) => {
    setPlayerModeState(mode);
    if (mode === 'bubble' || mode === 'bar') {
      setSavedPreferredMode(mode);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sq_player_display_mode', mode);
      }
    }
  };

  // Theme States: Dynamic Light Theme & Fixed Dark Theme (Requirement 20: keep primary color)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sq_theme_dark') === 'true';
    }
    return false;
  });
  const [currentLightPalette, setCurrentLightPalette] = useState(() =>
    getRandomLightPalette()
  );

  useEffect(() => {
    applyThemeToDom(currentLightPalette, isDark);
  }, [isDark, currentLightPalette]);

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    localStorage.setItem('sq_theme_dark', String(nextDark));
  };

  const handleRandomPalette = () => {
    const nextPalette = getRandomLightPalette(currentLightPalette.id);
    setCurrentLightPalette(nextPalette);
  };

  // Visitor & User Authentication
  const [visitor, setVisitor] = useState<VisitorIdentity>(() => getOrCreateVisitor());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sq_current_user_v1');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
    }
    return null;
  });

  // Helper: Super Admin Check (Only yukidu@gmail.com)
  const isSuperAdminEmail = (email?: string | null) => {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    return clean === 'yukidu@gmail.com';
  };

  // Requirement 5, 10, 11 & 3: 超級管理員 (yukidu@gmail.com) 與 獎銜審核員
  const isSuperAdmin = isSuperAdminEmail(currentUser?.email) || currentUser?.role === '超級管理員' || currentUser?.id === 'u-admin';
  const isAdministrator =
    isSuperAdmin ||
    currentUser?.isAdminUser === true ||
    currentUser?.role === '獎銜審核員' ||
    currentUser?.role === '管理員';
  const isAdmin = isSuperAdmin;
  const canUpload = isSuperAdmin || currentUser?.isContributor === true;

  // Tracks, Comments, Users from Backend API
  const [tracks, setTracks] = useState<Track[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Requirement 6 (v2.4): 載入全站所有留言，確保首頁快速預覽留言被 @ 標記時即刻同步顯示於通知頁
  const fetchAllComments = async () => {
    try {
      const res = await fetch('/api/comments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllComments(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch all comments:', e);
    }
  };

  // Requirement 9, 10 & 12: 未審核通過名單總數 + 被 @ 標記提醒總數（用於通知鈴鐺徽章提醒）
  const pendingNotificationsCount = useMemo(() => {
    const userList = Array.isArray(allUsers) ? allUsers : [];
    const auditCount = userList.filter(u => u.rankAuditStatus === 'pending' || u.rankApproved === false).length;
    const myName = currentUser?.name?.trim().toLowerCase();
    const myEmail = currentUser?.email?.toLowerCase().trim();
    const activeCommentPool = Array.isArray(allComments) && allComments.length > 0 
      ? allComments 
      : (Array.isArray(comments) ? comments : []);
    let dismissed: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sq_dismissed_mentions');
        if (stored) dismissed = JSON.parse(stored);
      } catch {}
    }
    const mentionCount = (currentUser && myName)
      ? activeCommentPool.filter(c => {
          if (!c.content) return false;
          if (dismissed.includes(c.id)) return false;
          const lower = c.content.toLowerCase();
          const hasDirect = lower.includes(`@${myName}`) || lower.includes(`＠${myName}`);
          const isReply = c.replyToAuthor && c.replyToAuthor.toLowerCase().trim() === myName;
          const isSelf = (c.authorEmail && c.authorEmail.toLowerCase().trim() === myEmail) || (c.authorName && c.authorName.toLowerCase().trim() === myName);
          return (hasDirect || isReply) && !isSelf;
        }).length
      : 0;
    return auditCount + mentionCount;
  }, [allUsers, comments, allComments, currentUser]);

  // Filter & Search & Sort states (Requirement 18 & 19)
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [selectedSpeakerRank, setSelectedSpeakerRank] = useState<string>('全部');
  const [isSpeakerRankDropdownOpen, setIsSpeakerRankDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // 講師獎銜篩選指標清單 (標準清單 + 現有曲目獎銜 + GAR全球獎銜)
  const speakerRankFilterOptions = useMemo(() => {
    const presentRanks = new Set<string>();
    let hasGar = false;
    tracks.forEach(t => {
      const r = (t.speakerRank || '').trim();
      if (r && r !== '無') {
        presentRanks.add(r);
        if (r.startsWith('GAR')) hasGar = true;
      }
    });

    const list: string[] = ['全部'];
    if (hasGar) {
      list.push('GAR全球獎銜');
    }

    // Include standard options if present or in top list
    SPEAKER_RANK_OPTIONS.forEach(opt => {
      if (opt !== '無') {
        if (presentRanks.has(opt) || !list.includes(opt)) {
          if (!list.includes(opt)) list.push(opt);
        }
        if (presentRanks.has(`GAR${opt}`) && !list.includes(`GAR${opt}`)) {
          list.push(`GAR${opt}`);
        }
      }
    });

    presentRanks.forEach(r => {
      if (!list.includes(r)) list.push(r);
    });

    return list;
  }, [tracks]);

  // Requirement 6 (v2.8): 多組網友關鍵字交叉複合搜尋 (Selected Keywords Chips)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [showKeywordsDrawer, setShowKeywordsDrawer] = useState(false);

  // Collect all unique keywords across all tracks
  const allAvailableKeywords = useMemo(() => {
    const kwSet = new Set<string>();
    tracks.forEach(t => {
      (t.keywords || []).forEach((k: string) => { if (k && k.trim()) kwSet.add(k.trim()); });
      (t.tags || []).forEach((k: string) => { if (k && k.trim()) kwSet.add(k.trim()); });
    });
    return Array.from(kwSet).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [tracks]);

  // Requirement 8: 自動顯示相關的關鍵詞（包括：分類標籤、網友關鍵字、音檔詳細資料）
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // 1. 分類標籤
    const matchedCategories = categoryOptions
      .filter(cat => cat !== '全部' && (!q || cat.toLowerCase().includes(q)))
      .slice(0, 4);

    // 2. 網友關鍵字 (從所有音檔收集 keywords)
    const kwSet = new Set<string>();
    tracks.forEach(t => {
      (t.keywords || []).forEach((k: string) => { if (k && k.trim()) kwSet.add(k.trim()); });
      (t.tags || []).forEach((k: string) => { if (k && k.trim()) kwSet.add(k.trim()); });
    });
    const matchedKeywords = Array.from(kwSet)
      .filter(kw => !q || kw.toLowerCase().includes(q))
      .slice(0, 10);

    return {
      categories: matchedCategories,
      keywords: matchedKeywords
    };
  }, [categoryOptions, searchQuery, tracks]);

  // Requirement 11 (v2.7): 判定私秘VIP音檔是否已獲得授權解鎖
  const isTrackVipUnlocked = (track: Track): boolean => {
    if (!track.isPrivateVip) return true;
    if (isSuperAdmin) return true;
    if (currentUser && track.uploadedBy && (currentUser.email === track.uploadedBy || currentUser.name === track.uploadedBy)) return true;
    if (currentUser && track.uploaderEmail && currentUser.email === track.uploaderEmail) return true;
    return unlockedVipTracks.includes(track.id);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [sortField, setSortField] = useState<SortField>('時間');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [trackToEdit, setTrackToEdit] = useState<Track | null>(null);

  // Audio Playback Engine
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [selectedDetailTrack, setSelectedDetailTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [playbackMemories, setPlaybackMemories] = useState<Record<string, AudioMemory>>({});

  // Requirement 26: Fullscreen loading state when downloading/buffering audio
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Requirement 15: Floating comment preview popup modal & member preview modal
  const [commentPreviewTrack, setCommentPreviewTrack] = useState<Track | null>(null);
  const [previewMember, setPreviewMember] = useState<UserProfile | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isBwExportOpen, setIsBwExportOpen] = useState(false);
  const [bwExportMode, setBwExportMode] = useState<'comments' | 'rated'>('comments');
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [permissionAlert, setPermissionAlert] = useState<string | null>(null);

  // Requirement 5: 分類標籤同步函數 (後台增刪改後首頁下拉選單同步更新)
  const fetchCategories = async () => {
    try {
      const [cRes, tRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/tracks')
      ]);
      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData)) {
          const list = Array.from(new Set(['全部', ...cData]));
          setCategoryOptions(list);
          setSelectedCategory(prev => (list.includes(prev) ? prev : '全部'));
        }
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData)) {
          setTracks(tData);
        }
      }
    } catch (e) {
      console.error('Failed to sync categories:', e);
    }
  };

  // 任何情況下，只要按主選單的logo或網站名稱，就會返回到首頁播放清單的「全部分類」，清空搜尋條件
  const handleReturnToHomePlaylist = useCallback(() => {
    setCurrentTab('home');
    setSelectedDetailTrack(null);
    setSelectedCategory('全部');
    setSelectedSpeakerRank('全部');
    setIsSpeakerRankDropdownOpen(false);
    setSearchQuery('');
    setSelectedKeywords([]);
    setIsCategoryDropdownOpen(false);
    setIsSearchFocused(false);
    setShowKeywordsDrawer(false);
    setIsUploadOpen(false);
    setIsAdminOpen(false);
    setIsProfileOpen(false);
    setIsChangelogOpen(false);
    setIsShareOpen(false);
    setIsBwExportOpen(false);
    setCommentPreviewTrack(null);
    setPreviewMember(null);
    if (playerMode === 'expanded') {
      setPlayerMode(savedPreferredMode);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [playerMode, savedPreferredMode, setPlayerMode]);

  // 1. Fetch initial data and purge stale offline tracks (> 2 weeks or finished)
  useEffect(() => {
    purgeStaleOfflineTracks();

    async function loadData() {
      try {
        const [tracksRes, usersRes, catRes] = await Promise.all([
          fetch('/api/tracks'),
          fetch('/api/users'),
          fetch('/api/categories')
        ]);

        if (catRes.ok) {
          const cData = await catRes.json();
          if (Array.isArray(cData)) {
            const list = Array.from(new Set(['全部', ...cData]));
            setCategoryOptions(list);
          }
        }

        if (tracksRes.ok) {
          const tData = await tracksRes.json();
          if (Array.isArray(tData)) {
            setTracks(tData);

            const memories: Record<string, AudioMemory> = {};
            tData.forEach((t: Track) => {
              const m = getStoredPlayback(t.id);
              if (m) memories[t.id] = m;
            });
            setPlaybackMemories(memories);

            // Check URL query param ?track=t-1
            const urlParams = new URLSearchParams(window.location.search);
            const trackParam = urlParams.get('track');
            if (trackParam) {
              const found = tData.find((t: Track) => t.id === trackParam);
              if (found) {
                handlePlayTrack(found, 'expanded');
              }
            }
          }
        }

        if (usersRes.ok) {
          const uData = await usersRes.json();
          if (Array.isArray(uData)) {
            setAllUsers(uData);

            // Sync current user from Cloudflare D1 if logged in
            if (currentUser && currentUser.email) {
              const cleanCurrentEmail = currentUser.email.toLowerCase().trim();
              const matched = uData.find((u: UserProfile) => u.email?.toLowerCase().trim() === cleanCurrentEmail);
              if (matched) {
                const isOwner = isSuperAdminEmail(matched.email);
                const synced: UserProfile = {
                  ...currentUser,
                  ...matched,
                  role: isOwner ? '超級管理員' : matched.role,
                  isAdminUser: isOwner ? true : Boolean(matched.isAdminUser),
                  isContributor: isOwner ? true : Boolean(matched.isContributor),
                  canUpload: isOwner ? true : Boolean(matched.canUpload || matched.isContributor),
                  rankApproved: isOwner ? true : Boolean(matched.rankApproved),
                  rankAuditStatus: isOwner ? 'approved' : matched.rankAuditStatus
                };
                setCurrentUser(synced);
                localStorage.setItem('sq_current_user_v1', JSON.stringify(synced));
              }
            }
          }
        }

        // Fetch permanent playback history from Cloudflare D1 for current user or visitor
        const activeIdentifier = currentUser?.email || visitor?.deviceId;
        if (activeIdentifier) {
          try {
            const histRes = await fetch(`/api/playback/history/${encodeURIComponent(activeIdentifier)}`);
            if (histRes.ok) {
              const histData = await histRes.json();
              if (histData && typeof histData === 'object') {
                setPlaybackMemories(prev => ({ ...prev, ...histData }));
              }
            }
          } catch (e) {
            console.warn('Failed to load playback memories:', e);
          }
        }

        // Fetch all comments for mention notifications
        await fetchAllComments();
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Sync all comments when switching to notifications tab
  useEffect(() => {
    if (currentTab === 'notifications') {
      fetchAllComments();
    }
  }, [currentTab]);

  // Fetch comments when current track or selected detail track changes
  useEffect(() => {
    const targetTrack = selectedDetailTrack || currentTrack;
    if (!targetTrack) return;
    async function loadComments() {
      try {
        const res = await fetch(`/api/tracks/${targetTrack!.id}/comments`);
        if (res.ok) {
          const cData = await res.json();
          setComments(cData);
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
    loadComments();
  }, [currentTrack, selectedDetailTrack]);

  // Requirement 10, 11, 12: 權限判定 (超級管理員全通、管理員鑽石級權限、未審核通過前僅能看公開)
  const checkCanAccess = (track: Track): boolean => {
    if (isSuperAdmin) {
      return true;
    }
    const req = track.requiredRank || '無';
    if (req === '無' || req === '公開') return true;
    if (!currentUser) return false;

    // Requirement 11: 管理員具備「鑽石」瀏覽權限
    if (isAdministrator) {
      return true;
    }

    // Requirement 12: 必須通過「超級管理員或管理員」審核通過獎銜，才會正式生效。
    // 在「獎銜」尚未被審核之前，一律只能瀏覽「公開」的音檔。
    if (!currentUser.rankApproved) {
      return false;
    }

    const effectiveRank = currentUser.approvedRank || currentUser.rank || '無';
    const ranks = RANK_ORDER as readonly string[];
    const reqIdx = ranks.indexOf(req);
    let userIdx = ranks.indexOf(effectiveRank);

    if (effectiveRank.includes('鑽石') || effectiveRank.includes('皇冠') || effectiveRank.includes('大使')) {
      userIdx = 999;
    }
    if (userIdx === -1) return false;
    return userIdx >= reqIdx;
  };

  // 2. Play / Select Track with Memory Resume & Fullscreen Loading
  const handlePlayTrack = (track: Track, targetMode?: PlayerDisplayMode) => {
    // Requirement 11 (v2.7): 私秘VIP音檔播放守護
    if (track.isPrivateVip && !isTrackVipUnlocked(track)) {
      alert('此音檔為私秘VIP專屬，請聯絡上傳者給您專屬連結');
      return;
    }

    if (!checkCanAccess(track)) {
      setPermissionAlert(
        `此錄音檔權限為【${track.requiredRank === '無' ? '公開' : track.requiredRank} 級別以上】。請先登入綁定 Google 帳號或向管理員提升職級！`
      );
      return;
    }

    // Preserve user preferred player mode (Requirement 14)
    const effectiveMode = targetMode || (playerMode === 'expanded' ? savedPreferredMode : playerMode);

    if (currentTrack?.id === track.id) {
      setPlayerMode(effectiveMode);
      return;
    }

    setCurrentTrack(track);
    setPlayerMode(effectiveMode);

    // Requirement 3: 立即更新點擊播放次數並回傳後端記錄
    setTracks(prev =>
      prev.map(t => (t.id === track.id ? { ...t, playCount: (t.playCount || 0) + 1 } : t))
    );
    fetch(`/api/tracks/${track.id}/play`, { method: 'POST' }).catch(() => {});

    // Record to offline cache registry
    recordOfflineTrack(track.id);

    // Show huge loading overlay until audio starts playing
    setIsLoadingAudio(true);

    const saved = getStoredPlayback(track.id);
    const resumeTime = saved && !saved.completed ? saved.currentTime : 0;

    if (audioRef.current) {
      audioRef.current.src = track.audioUrl;
      audioRef.current.currentTime = resumeTime;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoadingAudio(false);
        })
        .catch(() => {
          setIsPlaying(true);
          setIsLoadingAudio(false);
        });
    }
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(true));
    }
  };

  // Seek
  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  // Seek on audio card in list view (Requirement 25)
  const handleSeekCard = (track: Track, seconds: number) => {
    if (currentTrack?.id === track.id) {
      handleSeek(seconds);
    } else {
      const safeDuration = track.durationSeconds || 600;
      saveStoredPlayback(track.id, seconds, safeDuration);
      setPlaybackMemories(prev => ({
        ...prev,
        [track.id]: {
          currentTime: seconds,
          duration: safeDuration,
          completed: seconds >= safeDuration * 0.95,
          listenedOver2Min: seconds >= 120,
          percentage: Math.min(100, Math.round((seconds / safeDuration) * 100))
        }
      }));
    }
  };

  // Skip (-30, -10, +10, +30)
  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      const safeDuration = duration > 0 ? duration : (currentTrack?.durationSeconds || 600);
      const nextTime = Math.max(0, Math.min(safeDuration, audioRef.current.currentTime + seconds));
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  // Change Playback Speed
  const handleChangeSpeed = (speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Audio Time Update Listener & Offline progress management
  const handleTimeUpdate = () => {
    if (!audioRef.current || !currentTrack) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || currentTrack.durationSeconds || 600;
    setCurrentTime(cur);
    setDuration(dur);

    // Save memory to LocalStorage & local state
    saveStoredPlayback(currentTrack.id, cur, dur);
    const mem = getStoredPlayback(currentTrack.id);
    if (mem) {
      setPlaybackMemories(prev => ({ ...prev, [currentTrack.id]: mem }));
    }

    // Offline space management: auto purge if >95% completed
    handleTrackProgressOffline(currentTrack.id, cur, dur);

    // Sync to backend periodically
    if (Math.floor(cur) % 15 === 0) {
      const idKey = currentUser ? currentUser.email : visitor.deviceId;
      fetch('/api/playback/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: currentTrack.id,
          userIdOrDeviceId: idKey,
          currentTime: cur,
          duration: dur
        })
      }).catch(() => {});
    }
  };

  // Rating Action (Requirement 11 & 12: clicking same score cancels rating, turning all 5 stars gray!)
  const handleRateTrack = async (trackId: string, score: number) => {
    const idKey = currentUser ? currentUser.email : visitor.deviceId;

    // 1. Optimistic instant local update
    const updateTrackRating = (t: Track, newRating: number, newCount: number) => {
      const nextRatings = { ...(t.ratings || {}) };
      if (score === 0) {
        delete nextRatings[idKey];
        if (currentUser) {
          delete nextRatings[currentUser.email];
          delete nextRatings[currentUser.id];
        }
        delete nextRatings[visitor.deviceId];
        delete nextRatings['u-admin'];
      } else {
        if (currentUser) {
          delete nextRatings[currentUser.id];
          delete nextRatings['u-admin'];
        }
        nextRatings[idKey] = score;
      }
      return {
        ...t,
        rating: newRating,
        ratingCount: newCount,
        ratings: nextRatings
      };
    };

    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      const hadRating = Boolean(t.ratings && (t.ratings[idKey] || (currentUser && t.ratings[currentUser.email])));
      const newCount = score === 0 ? Math.max(1, (t.ratingCount || 1) - (hadRating ? 1 : 0)) : ((t.ratingCount || 0) + (hadRating ? 0 : 1));
      return updateTrackRating(t, score > 0 ? score : t.rating, newCount);
    }));

    if (currentTrack?.id === trackId) {
      setCurrentTrack(prev => prev ? updateTrackRating(prev, score > 0 ? score : prev.rating, prev.ratingCount || 1) : null);
    }
    if (selectedDetailTrack?.id === trackId) {
      setSelectedDetailTrack(prev => prev ? updateTrackRating(prev, score > 0 ? score : prev.rating, prev.ratingCount || 1) : null);
    }

    try {
      const res = await fetch(`/api/tracks/${trackId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: idKey,
          score,
          userId: currentUser?.id,
          userEmail: currentUser?.email,
          deviceId: visitor.deviceId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTracks(prev => prev.map(t => t.id === trackId ? updateTrackRating(t, data.rating, data.ratingCount) : t));
        if (currentTrack?.id === trackId) {
          setCurrentTrack(prev => prev ? updateTrackRating(prev, data.rating, data.ratingCount) : null);
        }
        if (selectedDetailTrack?.id === trackId) {
          setSelectedDetailTrack(prev => prev ? updateTrackRating(prev, data.rating, data.ratingCount) : null);
        }
      }
    } catch (err) {
      console.error('Rate failed:', err);
    }
  };

  // Like Action Toggle
  const handleToggleLike = async (trackId: string) => {
    const idKey = currentUser ? currentUser.email : visitor.deviceId;

    try {
      const res = await fetch(`/api/tracks/${trackId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: idKey })
      });

      if (res.ok) {
        const data = await res.json();
        setTracks(prev =>
          prev.map(t =>
            t.id === trackId
              ? {
                  ...t,
                  likes: data.likes,
                  likedBy: data.hasLiked
                    ? [...(t.likedBy || []), idKey]
                    : (t.likedBy || []).filter(x => x !== idKey)
                }
              : t
          )
        );
        if (currentTrack?.id === trackId) {
          setCurrentTrack(prev =>
            prev
              ? {
                  ...prev,
                  likes: data.likes,
                  likedBy: data.hasLiked
                    ? [...(prev.likedBy || []), idKey]
                    : (prev.likedBy || []).filter(x => x !== idKey)
                }
              : null
          );
        }
      }
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  // Add Comment (Requirement 3 & 6: 支持最大化視窗與通知頁直接快速回覆留言)
  const handleAddComment = async (content: string, replyToId?: string, replyToAuthor?: string, trackIdOverride?: string) => {
    const targetTrackId = trackIdOverride || (selectedDetailTrack || currentTrack)?.id;
    if (!targetTrackId) return;

    const authorBadge = isSuperAdmin
      ? '超級管理員'
      : isAdministrator
      ? '管理員'
      : currentUser?.isContributor
      ? '貢獻者'
      : currentUser?.rank || '訪客稱號';

    const payload = {
      authorName: currentUser ? currentUser.name : visitor.fullName,
      authorAvatar: currentUser ? (currentUser.avatar || '👤') : visitor.emoji,
      authorBadge,
      authorEmail: currentUser?.email,
      deviceId: visitor.deviceId,
      isAdmin: isSuperAdmin,
      content,
      replyToId,
      replyToAuthor
    };

    const res = await fetch(`/api/tracks/${targetTrackId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '留言失敗');
    }

    const newComment = await res.json();
    setComments(prev => [newComment, ...prev]);
    setAllComments(prev => [newComment, ...prev]);
    fetchAllComments();

    setTracks(prev =>
      prev.map(t =>
        t.id === targetTrackId ? { ...t, commentsCount: (t.commentsCount || 0) + 1 } : t
      )
    );
    if (selectedDetailTrack && selectedDetailTrack.id === targetTrackId) {
      setSelectedDetailTrack(prev => prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : null);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    const targetTrack = selectedDetailTrack || currentTrack;
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      setAllComments(prev => prev.filter(c => c.id !== commentId));
      fetchAllComments();
      if (targetTrack) {
        setTracks(prev =>
          prev.map(t =>
            t.id === targetTrack.id
              ? { ...t, commentsCount: Math.max(0, (t.commentsCount || 1) - 1) }
              : t
          )
        );
        if (selectedDetailTrack && selectedDetailTrack.id === targetTrack.id) {
          setSelectedDetailTrack(prev => prev ? { ...prev, commentsCount: Math.max(0, (prev.commentsCount || 1) - 1) } : null);
        }
      }
    }
  };

  // Edit Comment
  const handleEditComment = async (commentId: string, newContent: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent })
    });
    if (res.ok) {
      setComments(prev =>
        prev.map(c => (c.id === commentId ? { ...c, content: newContent } : c))
      );
      setAllComments(prev =>
        prev.map(c => (c.id === commentId ? { ...c, content: newContent } : c))
      );
      fetchAllComments();
    }
  };

  // Requirement 2: 在「最大化視窗」直接修改音檔資訊、備註與相關學習連結
  const handleUpdateTrack = async (trackId: string, updates: Partial<Track>) => {
    try {
      const res = await fetch(`/api/tracks/${trackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, userEmail: currentUser?.email })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '儲存失敗');
        return;
      }
      const updated = await res.json();
      setTracks(prev => prev.map(t => (t.id === trackId ? updated : t)));
      if (currentTrack?.id === trackId) {
        setCurrentTrack(updated);
      }
      if (selectedDetailTrack?.id === trackId) {
        setSelectedDetailTrack(updated);
      }
    } catch (err) {
      console.error('Update track failed:', err);
      alert('更新失敗，請檢查網路連線。');
    }
  };

  // Requirement 11: 超級管理員指定或取消「管理員」身分
  const handleToggleAdminUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/admin-role`, { method: 'PUT' });
      if (res.ok) {
        const updated = await res.json();
        setAllUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
        if (currentUser?.id === userId) {
          setCurrentUser(updated);
          localStorage.setItem('sq_current_user_v1', JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.error('Failed to toggle admin role:', e);
    }
  };

  // Requirement 9, 11, 12, 3: 審核或修改獎銜 (獎銜審核員 / 超級管理員)
  const handleApproveRank = async (userId: string, rank?: AmwayRank) => {
    const auditorName = isSuperAdmin ? '超級管理員 (杜杜龍)' : (currentUser?.name ? `獎銜審核員 (${currentUser.name})` : '獎銜審核員審核');
    try {
      const res = await fetch(`/api/users/${userId}/audit-rank`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: rank ? 'modify_and_approve' : 'approve',
          rank,
          auditedBy: auditorName
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setAllUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
        if (currentUser?.id === userId) {
          setCurrentUser(updated);
          localStorage.setItem('sq_current_user_v1', JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.error('Approve rank failed:', e);
    }
  };

  // User Login & Google Bind Simulation (Yukidu is guaranteed Super Admin)
  const handleLoginWithGoogle = async (email = 'yukidu@gmail.com', name = '杜杜龍', avatarUrl?: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const isOwner = isSuperAdminEmail(cleanEmail);
    const existing = allUsers.find(u => u.email?.toLowerCase().trim() === cleanEmail);
    const profile: UserProfile = existing
      ? {
          ...existing,
          email: cleanEmail,
          name: existing.name || name,
          avatar: avatarUrl || existing.avatar,
          role: isOwner ? '超級管理員' : existing.role,
          isAdminUser: isOwner ? true : existing.isAdminUser,
          isContributor: isOwner ? true : existing.isContributor,
          canUpload: isOwner ? true : existing.canUpload,
          rank: isOwner ? (existing.rank || '鑽石級以上') : existing.rank,
          approvedRank: isOwner ? (existing.approvedRank || '鑽石級以上') : existing.approvedRank,
          rankApproved: isOwner ? true : existing.rankApproved,
          rankAuditStatus: isOwner ? 'approved' : existing.rankAuditStatus
        }
      : {
        id: isOwner ? 'u-admin' : `u-${Date.now()}`,
        email: cleanEmail,
        name,
        residence: '臺北',
        center: '南京',
        rank: isOwner ? '鑽石級以上' : '無',
        approvedRank: isOwner ? '鑽石級以上' : '無',
        rankApproved: isOwner,
        rankAuditStatus: isOwner ? 'approved' : 'pending',
        rankAuditType: 'new_register',
        role: isOwner ? '超級管理員' : '繁星家人',
        isAdminUser: isOwner,
        registerDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
        rankUpdatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        joinReason: '事業',
        avatar:
          avatarUrl ||
          (isOwner
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'),
        birthday: '1985-07-03',
        talentNumber: 33,
        lifeNumber: 6,
        playCount: 15,
        isBlocked: false,
        isContributor: isOwner,
        canUpload: isOwner,
        lastActive: '剛才'
      };

    setCurrentUser(profile);
    localStorage.setItem('sq_current_user_v1', JSON.stringify(profile));
    setAllUsers(prev => {
      const idx = prev.findIndex(u => u.email?.toLowerCase().trim() === cleanEmail || u.id === profile.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = profile;
        return next;
      }
      return [...prev, profile];
    });

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const syncedUser = {
            ...profile,
            ...data.user,
            role: isOwner ? '超級管理員' : data.user.role,
            isAdminUser: isOwner ? true : Boolean(data.user.isAdminUser),
            isContributor: isOwner ? true : Boolean(data.user.isContributor),
            canUpload: isOwner ? true : Boolean(data.user.canUpload)
          };
          setCurrentUser(syncedUser);
          localStorage.setItem('sq_current_user_v1', JSON.stringify(syncedUser));
          setAllUsers(prev => prev.map(u => (u.id === syncedUser.id || (u.email && u.email.toLowerCase().trim() === cleanEmail) ? syncedUser : u)));
        }
      }
    } catch (e) {
      console.warn('Sync user to D1 error:', e);
    }

    // Load permanent playback memories from Cloudflare D1
    try {
      const histRes = await fetch(`/api/playback/history/${encodeURIComponent(cleanEmail)}`);
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData && typeof histData === 'object') {
          setPlaybackMemories(prev => ({ ...prev, ...histData }));
        }
      }
    } catch (e) {
      console.warn('Sync playback memories error:', e);
    }

    setIsProfileOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sq_current_user_v1');
    setIsProfileOpen(false);
  };

  // Requirement 12: 會員初次設定或修改獎銜，自動標記待審核
  const handleUpdateProfile = (updatedProfile: Partial<UserProfile>) => {
    if (!currentUser) return;

    const isRankChanged = updatedProfile.rank && updatedProfile.rank !== currentUser.rank;
    const isOwner = isSuperAdminEmail(currentUser.email);

    let rankAuditFields: Partial<UserProfile> = {};
    if (isRankChanged && !isOwner) {
      rankAuditFields = {
        rankAuditStatus: 'pending',
        rankApproved: false,
        rankAuditType: currentUser.rank ? 'rank_change' : 'new_register',
        rankUpdatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };
    }

    const updated: UserProfile = {
      ...currentUser,
      ...updatedProfile,
      ...rankAuditFields
    };
    if (isOwner) {
      updated.role = '超級管理員';
      updated.isAdminUser = true;
      updated.isContributor = true;
      updated.canUpload = true;
      updated.rankApproved = true;
      updated.rankAuditStatus = 'approved';
    }

    setCurrentUser(updated);
    localStorage.setItem('sq_current_user_v1', JSON.stringify(updated));
    setAllUsers(prev => prev.map(u => (u.id === updated.id || (u.email && u.email.toLowerCase().trim() === updated.email?.toLowerCase().trim()) ? updated : u)));

    // Requirement 2: 個人基本資料名稱修改後，留言板即時同步跟著改
    if (updated.name || updated.avatar) {
      setComments(prev => prev.map(c => {
        const matchEmail = updated.email && c.authorEmail && c.authorEmail.toLowerCase().trim() === updated.email.toLowerCase().trim();
        const matchAdmin = c.isAdmin && (isOwner || updated.role === '超級管理員');
        const matchOldName = currentUser.name && c.authorName === currentUser.name;
        if (matchEmail || matchAdmin || matchOldName) {
          return {
            ...c,
            authorName: updated.name || c.authorName,
            authorAvatar: updated.avatar || c.authorAvatar
          };
        }
        return c;
      }));
    }

    fetch(`/api/users/${updated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updatedProfile, ...rankAuditFields, email: updated.email })
    }).catch(() => {});
  };

  // Admin Actions
  const handleToggleBlockUser = async (userId: string) => {
    const res = await fetch(`/api/users/${userId}/block`, { method: 'PUT' });
    if (res.ok) {
      const updated = await res.json();
      setAllUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
    }
  };

  const handleToggleContributor = async (userId: string) => {
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;
    const nextVal = !targetUser.isContributor;
    const res = await fetch(`/api/users/${userId}/contributor`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isContributor: nextVal, canUpload: nextVal })
    });
    if (res.ok) {
      const updated = await res.json();
      setAllUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
      if (currentUser?.id === userId) {
        setCurrentUser(prev => (prev ? { ...prev, isContributor: nextVal, canUpload: nextVal } : null));
      }
    }
  };

  const handleAdminUpdateUser = async (userId: string, profileData: Partial<UserProfile>) => {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });
    if (res.ok) {
      const updated = await res.json();
      setAllUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
      if (currentUser?.id === userId) {
        setCurrentUser(prev => (prev ? { ...prev, ...profileData } : null));
      }
    }
  };

  // Requirement 24: Batch Update Users
  const handleBatchUpdateUsers = async (userIds: string[], updates: Partial<UserProfile>) => {
    const res = await fetch('/api/admin/users/batch', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, updates })
    });
    if (res.ok) {
      setAllUsers(prev =>
        prev.map(u => (userIds.includes(u.id) ? { ...u, ...updates } : u))
      );
      if (currentUser && userIds.includes(currentUser.id)) {
        setCurrentUser(prev => (prev ? { ...prev, ...updates } : null));
      }
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    const userEmail = currentUser?.email || (isAdmin ? 'yukidu@gmail.com' : '');
    const res = await fetch(`/api/tracks/${trackId}?userEmail=${encodeURIComponent(userEmail)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      setTracks(prev => prev.filter(t => t.id !== trackId));
      if (currentTrack?.id === trackId) {
        setCurrentTrack(null);
      }
    }
  };

  // Requirement 19: 排序切換處理 (時間、評價、留言、按讚、演講人)，重複點選時遞增與遞減交替排序
  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection(field === '演講人' ? 'asc' : 'desc');
    }
  };

  // Filtered & Sorted Tracks List (Requirement 18 & 19 & Requirement 6: 多組網友關鍵字交叉複合搜尋)
  const filteredTracks = useMemo(() => {
    const trackList = Array.isArray(tracks) ? tracks : [];
    return trackList
      .filter(t => {
        if (selectedCategory !== '全部') {
          const matchPrimary = t.category === selectedCategory;
          const matchMultiple = t.categories && t.categories.includes(selectedCategory);
          if (!matchPrimary && !matchMultiple) return false;
        }

        // 講師獎銜篩選指標
        if (selectedSpeakerRank !== '全部') {
          const trackRank = (t.speakerRank || '').trim();
          if (selectedSpeakerRank === 'GAR全球獎銜') {
            if (!trackRank.startsWith('GAR')) return false;
          } else {
            const cleanRank = trackRank.replace(/^GAR/, '');
            if (trackRank !== selectedSpeakerRank && cleanRank !== selectedSpeakerRank) {
              return false;
            }
          }
        }

        // Multi-keyword intersection cross-search (Requirement 6)
        if (selectedKeywords.length > 0) {
          const allKeywords = [...(t.keywords || []), ...(t.tags || [])].map(k => k.toLowerCase().trim());
          const matchesAll = selectedKeywords.every(sk => {
            const clean = sk.toLowerCase().trim();
            return (
              allKeywords.some(k => k.includes(clean)) ||
              t.title.toLowerCase().includes(clean) ||
              (t.speaker || '').toLowerCase().includes(clean) ||
              (t.description || '').toLowerCase().includes(clean) ||
              (t.series || '').toLowerCase().includes(clean)
            );
          });
          if (!matchesAll) return false;
        }

        if (searchQuery.trim()) {
          const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
          const allKeywords = [...(t.keywords || []), ...(t.tags || [])].map(k => k.toLowerCase());
          const matchAllTokens = tokens.every(token => {
            return (
              t.title.toLowerCase().includes(token) ||
              t.speaker.toLowerCase().includes(token) ||
              (t.speakerRank || '').toLowerCase().includes(token) ||
              (t.series || '').toLowerCase().includes(token) ||
              (t.description || '').toLowerCase().includes(token) ||
              (t.remarks || '').toLowerCase().includes(token) ||
              (t.category || '').toLowerCase().includes(token) ||
              (t.categories || []).some(c => c.toLowerCase().includes(token)) ||
              allKeywords.some(k => k.includes(token))
            );
          });
          if (!matchAllTokens) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        switch (sortField) {
          case '時間': {
            diff = (a.uploadDate || '').localeCompare(b.uploadDate || '');
            break;
          }
          case '評價': {
            diff = (a.rating || 0) - (b.rating || 0);
            break;
          }
          case '留言': {
            diff = (a.commentsCount || 0) - (b.commentsCount || 0);
            break;
          }
          case '按讚': {
            diff = (a.likes || 0) - (b.likes || 0);
            break;
          }
          case '演講人': {
            diff = (a.speaker || '').localeCompare(b.speaker || '', 'zh-Hant');
            break;
          }
          default:
            diff = 0;
        }
        return sortDirection === 'desc' ? -diff : diff;
      });
  }, [tracks, selectedCategory, selectedSpeakerRank, selectedKeywords, searchQuery, sortField, sortDirection]);

  // Rated tracks by current user for BW export
  const userRatedTracks = useMemo(() => {
    if (!currentUser) return [];
    return (tracks || [])
      .map(t => {
        const tRatings = t?.ratings || {};
        return {
          track: t,
          rating: tRatings[currentUser.email] || tRatings[currentUser.id] || 0
        };
      })
      .filter(x => x.rating > 0);
  }, [tracks, currentUser]);

  const currentIdentifier = currentUser ? currentUser.email : visitor.deviceId;
  const currentRatings = currentTrack?.ratings || {};
  const currentTrackRating = (currentTrack && (
    currentRatings[currentIdentifier] ||
    (currentUser && (currentRatings[currentUser.email] || currentRatings[currentUser.id])) ||
    currentRatings[visitor.deviceId] ||
    (currentUser?.email === 'yukidu@gmail.com' ? currentRatings['u-admin'] : undefined)
  )) || 0;
  const hasLikedCurrent = Boolean(currentTrack?.likedBy && Array.isArray(currentTrack.likedBy) && currentTrack.likedBy.includes(currentIdentifier));

  return (
    <div className="min-h-screen flex flex-col antialiased selection:bg-rose-200 selection:text-rose-900">
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onWaiting={() => setIsLoadingAudio(true)}
        onCanPlay={() => setIsLoadingAudio(false)}
        onError={() => {
          setIsPlaying(false);
          setIsLoadingAudio(false);
        }}
      />

      {/* Requirement 26: 讀取中請稍候... 動態超巨大提示 */}
      {isLoadingAudio && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative flex items-center justify-center mb-6">
            <div className="w-32 h-32 rounded-full border-4 border-rose-400/30 animate-ping absolute" />
            <div className="w-28 h-28 rounded-full border-4 border-t-rose-500 border-r-rose-400 border-b-transparent border-l-transparent animate-spin" />
            <Mic className="w-12 h-12 text-white absolute" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-widest animate-pulse">
            讀取中請稍候...
          </h2>
          <p className="text-sm text-rose-200 mt-2 font-medium">
            正在下載音訊檔案並進行離線儲存
          </p>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={tab => {
          if (tab === 'home') {
            handleReturnToHomePlaylist();
          } else {
            setCurrentTab(tab);
            if (tab === 'stats') {
              setSelectedDetailTrack(null);
              if (playerMode === 'expanded') setPlayerMode(savedPreferredMode);
            } else if (tab === 'notifications') {
              setSelectedDetailTrack(null);
              if (playerMode === 'expanded') setPlayerMode(savedPreferredMode);
            } else if (tab === 'upload') {
              setIsUploadOpen(true);
            } else if (tab === 'admin') {
              setIsAdminOpen(true);
            } else if (tab === 'profile') {
              setIsProfileOpen(true);
            }
          }
        }}
        onLogoClick={handleReturnToHomePlaylist}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onRandomPalette={handleRandomPalette}
        currentUser={currentUser}
        isAdmin={isAdmin}
        canUpload={canUpload}
        pendingNotificationsCount={pendingNotificationsCount}
      />

      {/* Permission Alert Toast */}
      {permissionAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 shadow-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              <p className="font-bold">權限不足提示</p>
              <p className="mt-0.5">{permissionAlert}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => {
                    setPermissionAlert(null);
                    setIsProfileOpen(true);
                  }}
                  className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold text-xs"
                >
                  前往登入
                </button>
                <button
                  onClick={() => setPermissionAlert(null)}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-xs"
                >
                  關閉
                </button>
              </div>
            </div>
            <button
              onClick={() => setPermissionAlert(null)}
              className="p-1 text-amber-700 hover:text-amber-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-5 pb-28">
        {/* Requirement 16 & 9: 優先切換排行榜與公開通知分頁 */}
        {currentTab === 'stats' ? (
          <StatisticsView
            tracks={tracks}
            users={allUsers}
            comments={comments}
            onSelectTrack={(track: Track) => {
              setSelectedDetailTrack(track);
              setPlayerMode('expanded');
              setCurrentTab('home');
            }}
            onViewMember={user => setPreviewMember(user)}
          />
        ) : currentTab === 'notifications' ? (
          <NotificationsView
            users={allUsers}
            currentUser={currentUser}
            isAdmin={isSuperAdmin}
            isAdministrator={isAdministrator}
            onApproveRank={handleApproveRank}
            onViewMember={user => setPreviewMember(user)}
            comments={allComments.length > 0 ? allComments : comments}
            tracks={tracks}
            onSelectTrack={(t, commentId) => {
              handlePlayTrack(t, 'expanded');
              setCurrentTab('home');
              if (commentId) {
                setTimeout(() => {
                  const el = document.getElementById(`comment-${commentId}`) || document.getElementById('comments-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }, 450);
              }
            }}
            onAddComment={(trackId, content, replyToId, replyToAuthor) =>
              handleAddComment(content, replyToId, replyToAuthor, trackId)
            }
          />
        ) : (selectedDetailTrack || (currentTrack && playerMode === 'expanded')) ? (
          (() => {
            const activeTrack = selectedDetailTrack || currentTrack!;
            const isPlayingActive = isPlaying && currentTrack?.id === activeTrack.id;
            const activeRatings = activeTrack.ratings || {};
            const activeRating = activeRatings[currentIdentifier] ||
              (currentUser && (activeRatings[currentUser.email] || activeRatings[currentUser.id])) ||
              activeRatings[visitor.deviceId] ||
              (currentUser?.email === 'yukidu@gmail.com' ? activeRatings['u-admin'] : undefined) ||
              0;
            const hasLikedActive = Boolean(activeTrack.likedBy && Array.isArray(activeTrack.likedBy) && activeTrack.likedBy.includes(currentIdentifier));

            return (
              <DetailView
                track={activeTrack}
                comments={comments}
                isPlaying={isPlayingActive}
                currentTime={currentTrack?.id === activeTrack.id ? currentTime : 0}
                duration={currentTrack?.id === activeTrack.id && duration > 0 ? duration : (activeTrack.durationSeconds || 600)}
                playbackRate={playbackRate}
                visitor={visitor}
                currentUser={currentUser}
                isAdmin={isAdmin}
                userRating={activeRating}
                hasLiked={hasLikedActive}
                progressMemory={playbackMemories[activeTrack.id]}
                playerMode={playerMode}
                onSetPlayerMode={(m) => {
                  if (m !== 'expanded') {
                    setSelectedDetailTrack(null);
                  }
                  setPlayerMode(m);
                }}
                onTogglePlay={() => {
                  if (currentTrack?.id === activeTrack.id) {
                    handleTogglePlay();
                  } else {
                    handlePlayTrack(activeTrack, savedPreferredMode);
                  }
                }}
                onSeek={(sec) => {
                  if (currentTrack?.id === activeTrack.id) {
                    handleSeek(sec);
                  } else {
                    handleSeekCard(activeTrack, sec);
                  }
                }}
                onSkip={handleSkip}
                onRate={score => handleRateTrack(activeTrack.id, score)}
                onToggleLike={() => handleToggleLike(activeTrack.id)}
                onShare={() => setIsShareOpen(true)}
                onChangeSpeed={handleChangeSpeed}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onEditComment={handleEditComment}
                onOpenBwExport={mode => {
                  setBwExportMode(mode);
                  setIsBwExportOpen(true);
                }}
                onViewMember={user => setPreviewMember(user)}
                onUpdateTrack={handleUpdateTrack}
                isVipUnlocked={isTrackVipUnlocked(activeTrack)}
                onEditTrack={t => {
                  setTrackToEdit(t);
                  setIsUploadOpen(true);
                }}
                onSelectKeyword={kw => {
                  setSelectedDetailTrack(null);
                  setPlayerMode(savedPreferredMode);
                  setSearchQuery(kw);
                  setCurrentTab('home');
                }}
                allUsers={allUsers}
                tracks={tracks}
              />
            );
          })()
        ) : (
          /* List View (Home) */
          <div className="space-y-4">
            {/* Search Input Bar & Search Button (Requirement 9: 刪除上傳按鈕, Requirement 10: 增加搜尋按鈕) */}
            <div className="flex items-center gap-2">
              <div ref={searchContainerRef} className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setIsSearchFocused(false);
                  }}
                  placeholder="搜尋演講者、主題、系列或網友關鍵字..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-sm text-white placeholder:text-white/70 outline-hidden shadow-2xs transition-all border border-white/20 focus:ring-2 focus:ring-white/40"
                  style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchFocused(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/80 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Requirement 10 (v2.7): 搜尋建議選單僅顯示分類標籤與網友關鍵字，刪除音檔詳細資料 */}
                {isSearchFocused && (searchSuggestions.categories.length > 0 || searchSuggestions.keywords.length > 0) && (
                  <div
                    className="absolute left-0 right-0 top-full mt-2 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-rose-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100 max-h-96 overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* 分類標籤 */}
                    {searchSuggestions.categories.length > 0 && (
                      <div className="p-2.5">
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <span>🏷️</span>
                          <span>分類標籤</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {searchSuggestions.categories.map(cat => (
                            <button
                              key={`cat-${cat}`}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat);
                                setSearchQuery('');
                                setIsSearchFocused(false);
                              }}
                              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors cursor-pointer"
                            >
                              #{cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 網友關鍵字 */}
                    {searchSuggestions.keywords.length > 0 && (
                      <div className="p-2.5">
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <span>💬</span>
                          <span>網友關鍵字</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {searchSuggestions.keywords.map(kw => {
                            const isSelected = selectedKeywords.includes(kw);
                            return (
                              <button
                                key={`kw-${kw}`}
                                type="button"
                                onClick={() => {
                                  setSelectedKeywords(prev => isSelected ? prev.filter(k => k !== kw) : [...prev, kw]);
                                  setIsSearchFocused(false);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 font-bold'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700'
                                }`}
                              >
                                <span>🔍 {kw}</span>
                                {isSelected && <span className="text-[10px] text-amber-600 font-bold">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Requirement 10 (v2.7): 同一排增加「搜尋」按鈕 */}
              <button
                type="button"
                onClick={() => setIsSearchFocused(false)}
                className="px-3.5 sm:px-4 py-2.5 rounded-2xl text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs hover:brightness-105 shrink-0 active:scale-95 transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                title="執行搜尋"
              >
                <Search className="w-4 h-4" />
                <span>搜尋</span>
              </button>
            </div>

            {/* Requirement 6 (v2.8): 多組網友關鍵字交叉複合搜尋 (Selected Keywords Chips & Tag Drawer) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <button
                  type="button"
                  onClick={() => setShowKeywordsDrawer(prev => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 transition-colors cursor-pointer"
                >
                  <Hash className="w-3.5 h-3.5 text-amber-500" />
                  <span>網友關鍵字交叉篩選</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 font-mono">
                    {selectedKeywords.length > 0 ? `已選 ${selectedKeywords.length} 組` : `${allAvailableKeywords.length}組可選`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {showKeywordsDrawer ? '▲ 收起' : '▼ 點擊展開標籤庫'}
                  </span>
                </button>

                {selectedKeywords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedKeywords([])}
                    className="text-[11px] text-slate-400 hover:text-rose-500 underline cursor-pointer"
                  >
                    一鍵清除篩選 ({selectedKeywords.length})
                  </button>
                )}
              </div>

              {/* Expandable Keywords Tag Cloud Drawer for Multi-selection */}
              {showKeywordsDrawer && (
                <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-slate-800/80 border border-amber-200/70 dark:border-slate-700 animate-in fade-in space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>點選多組標籤可進行「交叉交集」篩選（音檔須同時符合所有勾選標籤）：</span>
                    <button
                      type="button"
                      onClick={() => setShowKeywordsDrawer(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {allAvailableKeywords.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">尚無網友關鍵字</span>
                    ) : (
                      allAvailableKeywords.map(kw => {
                        const isSelected = selectedKeywords.includes(kw);
                        return (
                          <button
                            key={`drawer-kw-${kw}`}
                            type="button"
                            onClick={() => {
                              setSelectedKeywords(prev =>
                                isSelected ? prev.filter(k => k !== kw) : [...prev, kw]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-2xs font-bold ring-2 ring-amber-400/50'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-amber-300'
                            }`}
                          >
                            <span>#{kw}</span>
                            {isSelected && <span className="text-[10px] font-bold">✓</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Selected Keyword Chips Indicator */}
              {selectedKeywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1 py-0.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                    <span>🎯 交集比對中：</span>
                  </span>
                  {selectedKeywords.map(kw => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 shadow-2xs"
                    >
                      <span>💬 {kw}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedKeywords(prev => prev.filter(k => k !== kw))}
                        className="hover:text-red-500 p-0.5 cursor-pointer"
                        title="移除此關鍵字"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Requirement 18, 19 & 20: 排序選項排成一列緊密排序，分類改成下拉式選單排在最右側，底色統一 */}
            <div className="relative flex items-center justify-between gap-1.5 pt-0.5">
              {/* Left: 5 Sort fields arranged in a tight row: 時間、評價、留言、按讚、演講人 */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                {(['時間', '評價', '留言', '按讚', '演講人'] as SortField[]).map(field => {
                  const isActive = sortField === field;
                  return (
                    <button
                      key={field}
                      onClick={() => handleSortClick(field)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-0.5 shadow-2xs ${
                        isActive
                          ? 'ring-2 ring-white/95 text-white brightness-110 font-black scale-102'
                          : 'text-white/85 hover:text-white hover:brightness-105 opacity-90 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                      title={`依${field}排序，重複點擊切換遞增/遞減`}
                    >
                      <span>{field}</span>
                      {isActive && (
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 rounded-full bg-white text-[var(--color-primary,#c06c84)] shrink-0 shadow-2xs">
                          {sortDirection === 'desc' ? (
                            <ArrowDown className="w-2.5 h-2.5 stroke-[3.5]" />
                          ) : (
                            <ArrowUp className="w-2.5 h-2.5 stroke-[3.5]" />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right: Dropdowns (分類選單與講師獎銜指標篩選) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 1. 講師獎銜篩選下拉選單 */}
                <div className="relative shrink-0">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setIsSpeakerRankDropdownOpen(prev => !prev);
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1 shadow-2xs hover:brightness-105 transition-all ${
                      selectedSpeakerRank !== '全部' ? 'ring-2 ring-amber-300' : ''
                    }`}
                    style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                    title="點擊依講師獎銜篩選"
                  >
                    <span className="truncate max-w-[70px] sm:max-w-none">
                      {selectedSpeakerRank === '全部' ? '全部獎銜' : selectedSpeakerRank}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/90 shrink-0" />
                  </button>

                  {isSpeakerRankDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsSpeakerRankDropdownOpen(false)}
                      />
                      <div
                        className="absolute right-0 top-full mt-1.5 z-40 w-44 max-h-64 overflow-y-auto rounded-2xl shadow-xl py-1 border border-white/20 animate-in fade-in zoom-in-95 text-white scrollbar-thin"
                        style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {speakerRankFilterOptions.map(rOpt => {
                          const isSelected = selectedSpeakerRank === rOpt;
                          return (
                            <button
                              key={rOpt}
                              onClick={() => {
                                setSelectedSpeakerRank(rOpt);
                                setIsSpeakerRankDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-white/25 text-white font-black'
                                  : 'text-white/90 hover:bg-white/15'
                              }`}
                            >
                              <span className="truncate">{rOpt === '全部' ? '全部獎銜' : rOpt}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white font-bold shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Category Dropdown */}
                <div className="relative shrink-0">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setIsCategoryDropdownOpen(prev => !prev);
                      setIsSpeakerRankDropdownOpen(false);
                    }}
                    className="px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1 shadow-2xs hover:brightness-105 transition-all"
                    style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                    title="點擊展開分類選單"
                  >
                    <span className="truncate max-w-[70px] sm:max-w-none">
                      {selectedCategory === '全部' ? '全部分類' : selectedCategory}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/90 shrink-0" />
                  </button>

                  {/* Dropdown Menu with click outside backdrop */}
                  {isCategoryDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsCategoryDropdownOpen(false)}
                      />
                      <div
                        className="absolute right-0 top-full mt-1.5 z-40 w-36 rounded-2xl shadow-xl py-1 overflow-hidden border border-white/20 animate-in fade-in zoom-in-95 text-white"
                        style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {categoryOptions.map(cat => {
                          const isSelected = selectedCategory === cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => {
                                setSelectedCategory(cat);
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-white/25 text-white font-black'
                                  : 'text-white/90 hover:bg-white/15'
                              }`}
                            >
                              <span>{cat}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white font-bold" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Audio Cards List - Requirement 14 (v2.7): 刪除包圍所有音檔的更大區塊框線，騰出更多版面空間 */}
            <div className="relative space-y-2 pt-1">
              {filteredTracks.length === 0 ? (
                <div className="text-center py-16 bg-white/60 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    找不到符合條件的演講音檔
                  </p>
                </div>
              ) : (
                filteredTracks.map(track => {
                  const isCurrent = currentTrack?.id === track.id;
                  const canAccess = checkCanAccess(track);
                  const isVipUnlocked = isTrackVipUnlocked(track);
                  const tRatings = track?.ratings || {};
                  const trackRating = tRatings[currentIdentifier] ||
                    (currentUser && (tRatings[currentUser.email] || tRatings[currentUser.id])) ||
                    tRatings[visitor.deviceId] ||
                    (currentUser?.email === 'yukidu@gmail.com' ? tRatings['u-admin'] : undefined) ||
                    0;
                  const hasLiked = Boolean(track?.likedBy && Array.isArray(track.likedBy) && track.likedBy.includes(currentIdentifier));

                  return (
                    <AudioCard
                      key={track.id}
                      track={track}
                      isPlaying={isPlaying && isCurrent}
                      isCurrentTrack={isCurrent}
                      canAccess={canAccess}
                      isVipUnlocked={isVipUnlocked}
                      progressMemory={playbackMemories[track.id]}
                      userRating={trackRating}
                      hasLiked={hasLiked}
                      onClick={() => {
                        // Requirement 8: 點擊資訊卡，不要播放音檔，「只會」最大化展開該曲目的詳細介面
                        setSelectedDetailTrack(track);
                        setPlayerMode('expanded');
                      }}
                      onTogglePlay={() => {
                        if (track.isPrivateVip && !isVipUnlocked) {
                          alert('此音檔為私秘VIP專屬，請聯絡上傳者給您專屬連結');
                          return;
                        }
                        if (isCurrent) {
                          handleTogglePlay();
                        } else {
                          handlePlayTrack(track, savedPreferredMode);
                        }
                      }}
                      onRate={score => handleRateTrack(track.id, score)}
                      onToggleLike={() => handleToggleLike(track.id)}
                      onSeek={seconds => handleSeekCard(track, seconds)}
                      onOpenCommentPreview={() => setCommentPreviewTrack(track)}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Page Footer - Requirement 2 (v2.7): 刪除右下角的v版本號 */}
        <footer className="mt-12 pt-6 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsChangelogOpen(true)}
              className="w-5 h-5 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="查看版本改版紀錄"
            >
              !
            </button>
            <span>繁星的回聲 · 全功能音頻知識管理與互動平台</span>
          </div>
        </footer>
      </main>

      {/* Requirement 1 (第9次更新) & Requirement 7 (第10次更新) & Requirement 1 (第13次更新): 
          按下「展開詳細介面最大化」，底部播放器和浮動播放器都要維持存在，且不會中斷播放。
          記憶用戶手動調整播放器的最後狀態，例如浮動播放器就一直維持浮動狀態，不會強制跳回底部播放器。 */}
      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          playerMode={playerMode === 'expanded' ? savedPreferredMode : playerMode}
          onSetPlayerMode={(m) => {
            if (m === 'expanded') {
              setSelectedDetailTrack(currentTrack);
              setCurrentTab('home');
            } else {
              setSelectedDetailTrack(null);
            }
            setPlayerMode(m);
          }}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onSkip={handleSkip}
          onChangeSpeed={handleChangeSpeed}
        />
      )}

      {/* Requirement 15: Comment Preview Modal */}
      <CommentPreviewModal
        isOpen={!!commentPreviewTrack}
        onClose={() => setCommentPreviewTrack(null)}
        track={commentPreviewTrack}
        currentUser={currentUser}
        visitor={visitor}
        isAdmin={isAdmin}
        allUsers={allUsers}
        tracks={tracks}
        onViewMember={user => setPreviewMember(user)}
        onCommentAdded={async () => {
          if (commentPreviewTrack) {
            setTracks(prev =>
              prev.map(t =>
                t.id === commentPreviewTrack.id
                  ? { ...t, commentsCount: (t.commentsCount || 0) + 1 }
                  : t
              )
            );
          }
          if (currentTrack) {
            try {
              const res = await fetch(`/api/tracks/${currentTrack.id}/comments`);
              if (res.ok) setComments(await res.json());
            } catch {}
          }
          await fetchAllComments();
        }}
      />

      {/* Upload Modal (Cloudflare R2 Direct Upload & Multi-Category & Edit Support) */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setTrackToEdit(null);
        }}
        currentUser={currentUser}
        isAdmin={isAdmin}
        trackToEdit={trackToEdit}
        tracks={tracks}
        onCategoriesUpdated={fetchCategories}
        onSuccess={rawTrack => {
          const trackData: any = (rawTrack as any)?.track || rawTrack;
          const normalizedTrack: Track = {
            id: trackData?.id || `t-${Date.now()}`,
            title: trackData?.title || '新上傳音檔',
            speaker: trackData?.speaker || '特邀講師',
            speakerRank: trackData?.speakerRank || '領袖',
            speakerAvatar: trackData?.speakerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
            categories: Array.isArray(trackData?.categories) && trackData.categories.length > 0 ? trackData.categories : ['未分類'],
            keywords: Array.isArray(trackData?.keywords) ? trackData.keywords : [],
            rating: typeof trackData?.rating === 'number' ? trackData.rating : 5.0,
            ratingCount: typeof trackData?.ratingCount === 'number' ? trackData.ratingCount : 1,
            commentsCount: typeof trackData?.commentsCount === 'number' ? trackData.commentsCount : 0,
            likes: typeof trackData?.likes === 'number' ? trackData.likes : 0,
            playCount: typeof trackData?.playCount === 'number' ? trackData.playCount : 0,
            duration: trackData?.duration || '約 10 分鐘',
            durationSeconds: trackData?.durationSeconds || 600,
            series: trackData?.series || '精選系列',
            speechDate: trackData?.speechDate || new Date().toISOString().split('T')[0],
            requiredRank: trackData?.requiredRank || '無',
            seriesOrder: trackData?.seriesOrder || '第 1 集',
            uploadDate: trackData?.uploadDate || new Date().toISOString().split('T')[0],
            description: trackData?.description || '暫無簡介',
            audioUrl: trackData?.audioUrl || '',
            likedBy: Array.isArray(trackData?.likedBy) ? trackData.likedBy : [],
            ratings: typeof trackData?.ratings === 'object' && trackData.ratings !== null ? trackData.ratings : {},
            externalVideos: Array.isArray(trackData?.externalVideos) ? trackData.externalVideos : [],
            externalPpts: Array.isArray(trackData?.externalPpts) ? trackData.externalPpts : [],
            externalFiles: Array.isArray(trackData?.externalFiles) ? trackData.externalFiles : [],
            ...trackData
          };

          if (trackToEdit) {
            setTracks(prev => prev.map(t => (t.id === normalizedTrack.id ? normalizedTrack : t)));
            if (currentTrack?.id === normalizedTrack.id) {
              setCurrentTrack(normalizedTrack);
            }
            setTrackToEdit(null);
          } else {
            setTracks(prev => [normalizedTrack, ...prev]);
            handlePlayTrack(normalizedTrack, savedPreferredMode);
          }
        }}
      />

      {/* Admin Management Modal (Requirement 4, 5, 17: 權限控制、正常進入修改視窗與刪除) */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        isAdmin={isAdmin}
        currentUser={currentUser}
        comments={comments}
        users={allUsers}
        tracks={tracks}
        onUpdateUserFull={handleAdminUpdateUser}
        onBatchUpdateUsers={handleBatchUpdateUsers}
        onToggleBlockUser={handleToggleBlockUser}
        onToggleContributor={handleToggleContributor}
        onToggleAdminUser={handleToggleAdminUser}
        onDeleteTrack={handleDeleteTrack}
        onEditTrack={track => {
          setTrackToEdit(track);
          setIsUploadOpen(true);
        }}
        onUpdateTrack={handleUpdateTrack}
        onSwitchToAdmin={() => handleLoginWithGoogle('yukidu@gmail.com', '杜杜龍')}
        onCategoriesUpdated={fetchCategories}
      />

      {/* Profile & Google Binding Modal (With Amway Fields & Numerology) */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        tracks={tracks}
        comments={comments}
        onLoginWithGoogle={handleLoginWithGoogle}
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
        onSelectTrack={t => handlePlayTrack(t, 'expanded')}
        onSelectCategory={cat => {
          setSelectedCategory(cat);
          setCurrentTab('home');
        }}
        onRateTrack={(trackId, score) => handleRateTrack(trackId, score)}
      />

      {/* Member Profile & Numerology Preview Modal (Clicking any comment author) */}
      <MemberPreviewModal
        isOpen={!!previewMember}
        onClose={() => setPreviewMember(null)}
        user={previewMember}
        tracks={tracks}
        comments={comments}
        allUsers={allUsers}
        currentUser={currentUser}
      />

      {/* Social Share Modal */}
      {currentTrack && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          track={currentTrack}
          visitor={visitor}
          currentUser={currentUser}
        />
      )}

      {/* Black & White Minimalist Canvas Share Modal - Requirement 4: 支援訪客與會員匯出圖卡 */}
      <BwExportModal
        isOpen={isBwExportOpen}
        onClose={() => setIsBwExportOpen(false)}
        mode={bwExportMode}
        currentTrack={currentTrack || selectedDetailTrack || undefined}
        comments={comments}
        ratedTracks={userRatedTracks}
        currentUser={currentUser || {
          id: 'guest',
          name: visitor.fullName || '學習夥伴',
          email: '',
          rank: '一般夥伴',
          avatar: visitor.emoji || '👤',
          playCount: 0,
          isBlocked: false,
          lastActive: '剛才'
        }}
      />

      {/* Requirement 3 (v2.8): 首頁播放清單和音檔詳細介紹畫面這二處，網頁左下角，新增：半透明浮動的向上箭頭按鈕，按了會回到頁面的最前面 */}
      {(currentTab === 'home' || selectedDetailTrack !== null || playerMode === 'expanded') && (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
            document.body.scrollTo({ top: 0, behavior: 'smooth' });
            const mainContainer = document.querySelector('main');
            if (mainContainer) mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
            const detailContainer = document.getElementById('detail-view-container');
            if (detailContainer) detailContainer.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="回到頁面最前面"
          title="回到頁面最前面"
          className="fixed bottom-16 sm:bottom-20 left-3.5 sm:left-5 z-40 w-11 h-11 rounded-full bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 shadow-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 hover:scale-105 touch-manipulation"
        >
          <ArrowUp className="w-5 h-5 text-[var(--color-primary,#c06c84)] stroke-[2.5]" />
        </button>
      )}

      {/* Version Changelog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
        currentUser={currentUser}
        isAdmin={isSuperAdmin}
      />
    </div>
  );
}
