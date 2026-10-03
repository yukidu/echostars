import { ThemedSelect } from './ThemedSelect';
import React, { useEffect, useState } from 'react';
import {
  Crown,
  Key,
  Clock,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Play,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Save
} from 'lucide-react';
import { Track, UserProfile } from '../types';

interface VipTracksTabProps {
  tracks: Track[];
  currentUser?: UserProfile | null;
  isAdmin?: boolean;
  onUpdateTrack?: (trackId: string, updates: Partial<Track>, options?: { persist?: boolean }) => Promise<void> | void;
  onDeleteTrack: (trackId: string) => Promise<void>;
  onEditTrack: (track: Track) => void;
  onPlayTrack?: (track: Track) => void;
}

type VipShareAccess = {
  shareSlug: string;
  password: string;
};

export const VipTracksTab: React.FC<VipTracksTabProps> = ({
  tracks,
  currentUser,
  isAdmin,
  onUpdateTrack,
  onDeleteTrack,
  onEditTrack,
  onPlayTrack
}) => {
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [resettingTrackId, setResettingTrackId] = useState<string | null>(null);
  const [newDurationDays, setNewDurationDays] = useState<number>(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preparingShareTrackId, setPreparingShareTrackId] = useState<string | null>(null);
  const [vipAccess, setVipAccess] = useState<Record<string, VipShareAccess>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanEmail = currentUser?.email?.toLowerCase().trim();
  const isSuperAdmin =
    isAdmin ||
    cleanEmail === 'yukidu@gmail.com' ||
    currentUser?.role === '超級管理員' ||
    currentUser?.id === 'u-admin';
  const actorEmail = cleanEmail || (isSuperAdmin ? 'yukidu@gmail.com' : '');

  const vipTracks = tracks.filter(t => {
    if (!t.isPrivateVip) return false;
    if (isSuperAdmin) return true;
    return (
      (t.uploaderEmail && cleanEmail && t.uploaderEmail.toLowerCase().trim() === cleanEmail) ||
      (t.uploaderId && currentUser?.id && t.uploaderId === currentUser.id)
    );
  });

  const myVipCount = vipTracks.length;
  const vipTracksKey = vipTracks.map(track => track.id).join('|');

  const buildVipShareUrl = (access: VipShareAccess) =>
    `${window.location.origin}/share/${encodeURIComponent(access.shareSlug)}?${access.password}`;

  const requestVipShare = async (track: Track, password?: string) => {
    const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/vip-share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: actorEmail,
        ...(password === undefined ? {} : { password })
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.shareSlug || !data?.password) {
      throw new Error(data?.error || '建立 VIP 分享網址失敗');
    }
    const access = { shareSlug: String(data.shareSlug), password: String(data.password) };
    setVipAccess(prev => ({ ...prev, [track.id]: access }));
    setPasswordDrafts(prev => ({ ...prev, [track.id]: access.password }));
    return access;
  };

  useEffect(() => {
    let cancelled = false;
    if (!actorEmail || vipTracks.length === 0) return;

    const missing = vipTracks.filter(track => !vipAccess[track.id]);
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async track => {
        try {
          const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/vip-share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: actorEmail })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data?.shareSlug || !data?.password) return null;
          return {
            trackId: track.id,
            access: { shareSlug: String(data.shareSlug), password: String(data.password) }
          };
        } catch {
          return null;
        }
      })
    ).then(results => {
      if (cancelled) return;
      const nextAccess: Record<string, VipShareAccess> = {};
      const nextDrafts: Record<string, string> = {};
      for (const item of results) {
        if (!item) continue;
        nextAccess[item.trackId] = item.access;
        nextDrafts[item.trackId] = item.access.password;
      }
      if (Object.keys(nextAccess).length) {
        setVipAccess(prev => ({ ...prev, ...nextAccess }));
        setPasswordDrafts(prev => ({ ...prev, ...nextDrafts }));
      }
    });

    return () => { cancelled = true; };
  }, [actorEmail, vipTracksKey]);

  const handleCopyLink = async (track: Track) => {
    setPreparingShareTrackId(track.id);
    setErrorMsg(null);
    try {
      const access = vipAccess[track.id] || await requestVipShare(track);
      const shareUrl = buildVipShareUrl(access);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedTrackId(track.id);
      setSuccessMsg(`已複製《${track.title}》VIP 專屬連結`);
      setTimeout(() => setCopiedTrackId(null), 2500);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '複製失敗，請稍後重試');
    } finally {
      setPreparingShareTrackId(null);
    }
  };

  const handleSavePassword = async (track: Track) => {
    const password = String(passwordDrafts[track.id] || '').trim();
    if (!/^\d{4,12}$/.test(password)) {
      setErrorMsg('密碼只能使用 4–12 位純數字');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await requestVipShare(track, password);
      setSuccessMsg(`《${track.title}》密碼已更新，分享網址已同步`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '密碼更新失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetLink = async (track: Track) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/vip-share/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: newDurationDays, userEmail: actorEmail })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.shareSlug || !data?.password) {
        throw new Error(data?.error || '重置失敗');
      }
      const access = { shareSlug: String(data.shareSlug), password: String(data.password) };
      setVipAccess(prev => ({ ...prev, [track.id]: access }));
      setPasswordDrafts(prev => ({ ...prev, [track.id]: access.password }));
      if (onUpdateTrack) {
        await onUpdateTrack(track.id, {
          isPrivateVip: true,
          vipExpiresAt: data.vipExpiresAt,
          vipDurationDays: data.vipDurationDays
        }, { persist: false });
      }
      setResettingTrackId(null);
      setSuccessMsg(`《${track.title}》已重置：網址名稱不變，已產生新的 4 位數密碼`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '重置失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (trackId: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onDeleteTrack(trackId);
      setConfirmDeleteId(null);
      setSuccessMsg('音檔已成功刪除');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setErrorMsg('刪除失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5 text-xs">
      {successMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-300" />
            <h3 className="font-black text-sm sm:text-base">私秘 VIP 音檔專屬管理專區</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/25 text-white font-extrabold">
              {isSuperAdmin ? '最高權限 · 全站總覽' : '貢獻者專區'}
            </span>
          </div>
          <p className="text-[11px] text-white/85 leading-relaxed">
            VIP 網址格式：講者英文大寫-S三位數序號?數字密碼，例如 LI-YU-RUI-S001?1234。預設 4 位數，可自訂 4–12 位純數字。
          </p>
        </div>
        <div className="bg-white/15 px-3.5 py-2 rounded-2xl text-center shrink-0 border border-white/20">
          <span className="text-[10px] text-white/80 block font-semibold">{isSuperAdmin ? '全站私秘 VIP 總數' : '個人 VIP 音檔配額'}</span>
          <div className="text-xl sm:text-2xl font-black font-mono">{isSuperAdmin ? `${myVipCount} 首` : `${myVipCount} / 10 首`}</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {vipTracks.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-1.5">
            <Lock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
            <p className="font-bold">目前尚無私秘 VIP 音檔</p>
          </div>
        ) : vipTracks.map(track => {
          const isExpired = track.vipExpiresAt ? Date.now() > track.vipExpiresAt : false;
          const remainingDays = track.vipExpiresAt ? Math.max(0, Math.ceil((track.vipExpiresAt - Date.now()) / 86400000)) : null;
          const expiryDateStr = track.vipExpiresAt
            ? new Date(track.vipExpiresAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '永久有效';
          const access = vipAccess[track.id];
          const prettyShareUrl = access ? buildVipShareUrl(access) : '正在建立短網址…';
          const draft = passwordDrafts[track.id] ?? access?.password ?? '';
          const passwordValid = /^\d{4,12}$/.test(draft);
          const passwordChanged = Boolean(access && draft !== access.password);

          return (
            <div key={track.id} className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <img src={track.speakerAvatar} alt={track.title} className="w-11 h-11 rounded-2xl object-cover ring-2 ring-purple-100 dark:ring-purple-900 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{track.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-0.5"><Crown className="w-3 h-3" />私秘VIP</span>
                      {isExpired ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />已過期</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5"><Unlock className="w-3 h-3" />有效中 ({remainingDays !== null ? `剩餘 ${remainingDays} 天` : '永久'})</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">主講：{track.speaker} ({track.speakerRank}) · 系列：{track.series}</p>
                    {isSuperAdmin && track.uploaderEmail && <p className="text-[10px] text-slate-400 mt-0.5">上傳者：{track.uploaderEmail}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onPlayTrack && <button type="button" onClick={() => onPlayTrack(track)} className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" title="試聽播放"><Play className="w-3.5 h-3.5" /></button>}
                  <button type="button" onClick={() => onEditTrack(track)} className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs">編輯</button>
                  {confirmDeleteId === track.id ? (
                    <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950 p-1 rounded-xl border border-rose-200 dark:border-rose-900">
                      <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold">確認刪除？</span>
                      <button type="button" disabled={isSubmitting} onClick={() => handleDelete(track.id)} className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[10px]">確定</button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-1.5 py-0.5 text-slate-500 text-[10px]">取消</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteId(track.id)} className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600" title="刪除此音檔"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-2.5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />有效期限：{expiryDateStr}</p>
                    <p className="text-[11px] text-purple-800 dark:text-purple-200 font-mono break-all" title={prettyShareUrl}>{prettyShareUrl}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Key className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span className="font-bold text-purple-900 dark:text-purple-200">連結密碼</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={12}
                        value={draft}
                        onChange={event => {
                          const value = event.target.value.replace(/\D/g, '').slice(0, 12);
                          setPasswordDrafts(prev => ({ ...prev, [track.id]: value }));
                        }}
                        placeholder="4–12 位數字"
                        className="w-36 px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 font-mono font-bold tracking-wider outline-hidden"
                      />
                      <button
                        type="button"
                        disabled={!passwordValid || !passwordChanged || isSubmitting}
                        onClick={() => handleSavePassword(track)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center gap-1 disabled:opacity-40"
                      >
                        <Save className="w-3 h-3" />儲存密碼
                      </button>
                      {!passwordValid && draft && <span className="text-[10px] text-rose-600 dark:text-rose-300">限 4–12 位純數字</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!access || preparingShareTrackId === track.id}
                      onClick={() => handleCopyLink(track)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 ${copiedTrackId === track.id ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                    >
                      {copiedTrackId === track.id ? <Check className="w-3.5 h-3.5" /> : preparingShareTrackId === track.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedTrackId === track.id ? '已複製' : '複製專屬連結'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResettingTrackId(resettingTrackId === track.id ? null : track.id);
                        setNewDurationDays(track.vipDurationDays || 7);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center gap-1"
                      title="保留 S001 網址名稱，重新產生 4 位數密碼"
                    >
                      <RefreshCw className="w-3 h-3" />重置連結
                    </button>
                  </div>
                </div>

                {resettingTrackId === track.id && (
                  <div className="pt-2 border-t border-purple-200/80 dark:border-purple-900/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-purple-900 dark:text-purple-200">有效天數：</span>
                      <ThemedSelect value={newDurationDays} onChange={event => setNewDurationDays(Number(event.target.value))} className="px-2.5 py-1 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-xs font-bold">
                        <option value={3}>3 天</option>
                        <option value={7}>7 天</option>
                        <option value={14}>14 天</option>
                        <option value={30}>30 天</option>
                        <option value={0}>永久有效</option>
                      </ThemedSelect>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setResettingTrackId(null)} className="px-2.5 py-1 text-xs text-slate-500">取消</button>
                      <button type="button" disabled={isSubmitting} onClick={() => handleResetLink(track)} className="px-3 py-1 rounded-xl bg-purple-600 text-white font-bold text-xs disabled:opacity-50">
                        {isSubmitting ? '重置中…' : '產生新 4 位密碼'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
