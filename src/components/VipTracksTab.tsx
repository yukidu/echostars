import { ThemedSelect } from './ThemedSelect';
import React, { useState } from 'react';
import {
  Crown,
  Key,
  Calendar,
  Clock,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Play,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle
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

type ShareTrack = Track & { shareSlug?: string };

export const VipTracksTab: React.FC<VipTracksTabProps> = ({
  tracks,
  currentUser,
  isAdmin,
  onUpdateTrack,
  onDeleteTrack,
  onEditTrack,
  onPlayTrack
}) => {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [resettingTrackId, setResettingTrackId] = useState<string | null>(null);
  const [newDurationDays, setNewDurationDays] = useState<number>(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preparingShareTrackId, setPreparingShareTrackId] = useState<string | null>(null);
  const [shareSlugs, setShareSlugs] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanEmail = currentUser?.email?.toLowerCase().trim();
  const isSuperAdmin =
    isAdmin ||
    cleanEmail === 'yukidu@gmail.com' ||
    currentUser?.role === '超級管理員' ||
    currentUser?.id === 'u-admin';

  const vipTracks = tracks.filter(t => {
    if (!t.isPrivateVip) return false;
    if (isSuperAdmin) return true;
    return (
      (t.uploaderEmail && cleanEmail && t.uploaderEmail.toLowerCase().trim() === cleanEmail) ||
      (t.uploaderId && currentUser?.id && t.uploaderId === currentUser.id)
    );
  });

  const myVipCount = vipTracks.length;

  const getKnownShareSlug = (track: Track) => {
    const fromTrack = String((track as ShareTrack).shareSlug || '').trim();
    if (fromTrack) return fromTrack;
    const fromState = shareSlugs[track.id];
    if (fromState) return fromState;
    try {
      return localStorage.getItem(`echostars_share_slug_${track.id}`) || '';
    } catch {
      return '';
    }
  };

  const ensureShareSlug = async (track: Track) => {
    const existing = getKnownShareSlug(track);
    if (existing) return existing;

    const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/share-slug`, {
      method: 'POST'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.shareSlug) {
      throw new Error(data?.error || '建立分享網址失敗');
    }

    const slug = String(data.shareSlug);
    setShareSlugs(prev => ({ ...prev, [track.id]: slug }));
    try {
      localStorage.setItem(`echostars_share_slug_${track.id}`, slug);
    } catch {}
    return slug;
  };

  const buildVipShareUrl = (track: Track, slug: string) => {
    const token = String(track.vipToken || '').trim();
    if (!token) throw new Error('此音檔尚未建立 VIP Token，請先重置連結。');
    const query = new URLSearchParams({ vipToken: token, trackId: track.id });
    return `${window.location.origin}/share/${encodeURIComponent(slug)}?${query.toString()}`;
  };

  const handleCopyLink = async (t: Track) => {
    setPreparingShareTrackId(t.id);
    setErrorMsg(null);
    try {
      const slug = await ensureShareSlug(t);
      const shareUrl = buildVipShareUrl(t, slug);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedToken(t.id);
      setSuccessMsg(`已成功複製《${t.title}》專屬 VIP 聆聽連結！`);
      setTimeout(() => setCopiedToken(null), 3000);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '複製失敗，請稍後重試');
    } finally {
      setPreparingShareTrackId(null);
    }
  };

  const handleResetToken = async (track: Track) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/tracks/${track.id}/reset-vip-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: newDurationDays, userEmail: currentUser?.email })
      });
      if (res.ok) {
        const data = await res.json();
        if (onUpdateTrack) {
          await onUpdateTrack(track.id, {
            isPrivateVip: true,
            vipToken: data.vipToken,
            vipExpiresAt: data.vipExpiresAt,
            vipDurationDays: data.vipDurationDays
          }, { persist: false });
        }
        setResettingTrackId(null);
        setSuccessMsg(`《${track.title}》VIP 專屬連結已重置成功！網址名稱不變，舊 Token 已失效。`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || '重置失敗');
      }
    } catch {
      setErrorMsg('網路連線異常，重置失敗');
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
      setSuccessMsg('音檔已成功刪除！');
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
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-300" />
            <h3 className="font-black text-sm sm:text-base">私秘 VIP 音檔專屬管理專區</h3>
            {isSuperAdmin ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/25 text-white font-extrabold">最高權限 · 全站總覽</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-extrabold">貢獻者專區</span>
            )}
          </div>
          <p className="text-[11px] text-white/85 leading-relaxed">
            私秘 VIP 音檔僅供持有專屬連結者瀏覽收聽；分享網址使用「講者英文大寫-三位數序號」，Token 與有效期限仍保留。
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur-xs px-3.5 py-2 rounded-2xl text-center shrink-0 border border-white/20">
          <span className="text-[10px] text-white/80 block font-semibold">{isSuperAdmin ? '全站私秘 VIP 總數' : '個人 VIP 音檔配額'}</span>
          <div className="text-xl sm:text-2xl font-black font-mono">{isSuperAdmin ? `${myVipCount} 首` : `${myVipCount} / 10 首`}</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {vipTracks.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-1.5">
            <Lock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
            <p className="font-bold">目前尚無私秘 VIP 音檔</p>
            <p className="text-[11px]">於「上傳音檔」勾選「私秘VIP」即可發布專屬 VIP 音檔，並在此重置或複製連結。</p>
          </div>
        ) : (
          vipTracks.map(t => {
            const isExpired = t.vipExpiresAt ? Date.now() > t.vipExpiresAt : false;
            const remainingDays = t.vipExpiresAt ? Math.max(0, Math.ceil((t.vipExpiresAt - Date.now()) / (86400 * 1000))) : null;
            const expiryDateStr = t.vipExpiresAt
              ? new Date(t.vipExpiresAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '永久有效';
            const knownSlug = getKnownShareSlug(t);
            const prettyShareUrl = knownSlug && t.vipToken
              ? buildVipShareUrl(t, knownSlug)
              : `${window.location.origin}/share/（首次複製時自動建立）`;

            return (
              <div key={t.id} className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-slate-800 shadow-2xs hover:border-purple-300 dark:hover:border-purple-800 transition-all space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <img src={t.speakerAvatar} alt={t.title} className="w-11 h-11 rounded-2xl object-cover ring-2 ring-purple-100 dark:ring-purple-900 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{t.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-0.5"><Crown className="w-3 h-3" /><span>私秘VIP</span></span>
                        {isExpired ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /><span>已過期失效</span></span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5"><Unlock className="w-3 h-3" /><span>有效中 ({remainingDays !== null ? `剩餘 ${remainingDays} 天` : '永久'})</span></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">主講：{t.speaker} ({t.speakerRank}) · 系列：{t.series}</p>
                      {isSuperAdmin && t.uploaderEmail && <p className="text-[10px] text-slate-400 mt-0.5">上傳者：{t.uploaderEmail}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onPlayTrack && <button type="button" onClick={() => onPlayTrack(t)} className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer" title="試聽播放"><Play className="w-3.5 h-3.5" /></button>}
                    <button type="button" onClick={() => onEditTrack(t)} className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 font-bold text-xs cursor-pointer">編輯</button>
                    {confirmDeleteId === t.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950 p-1 rounded-xl border border-rose-200 dark:border-rose-900">
                        <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold">確認刪除？</span>
                        <button type="button" disabled={isSubmitting} onClick={() => handleDelete(t.id)} className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[10px]">確定</button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-1.5 py-0.5 text-slate-500 text-[10px]">取消</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(t.id)} className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer" title="刪除此音檔"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <Key className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="font-bold text-purple-900 dark:text-purple-200">專屬 VIP 連結 Token：</span>
                        <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 font-mono text-[11px] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">{t.vipToken || '未生成'}</code>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /><span>有效期限：{expiryDateStr}</span>{remainingDays !== null && !isExpired && <span className="font-bold text-purple-600 dark:text-purple-400">(還剩 {remainingDays} 天)</span>}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate" title={prettyShareUrl}>{prettyShareUrl}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" disabled={preparingShareTrackId === t.id} onClick={() => handleCopyLink(t)} className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50 ${copiedToken === t.id ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`} title="複製護照式命名的 VIP 專屬分享網址">
                        {copiedToken === t.id ? <Check className="w-3.5 h-3.5" /> : preparingShareTrackId === t.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedToken === t.id ? '已複製連結' : preparingShareTrackId === t.id ? '建立網址中' : '複製專屬連結'}</span>
                      </button>

                      <button type="button" onClick={() => { setResettingTrackId(resettingTrackId === t.id ? null : t.id); setNewDurationDays(t.vipDurationDays || 7); }} className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors" title="重新產生 Token 並更新有效天數；漂亮網址名稱保持不變"><RefreshCw className="w-3 h-3" /><span>重置連結</span></button>
                    </div>
                  </div>

                  {resettingTrackId === t.id && (
                    <div className="pt-2 border-t border-purple-200/80 dark:border-purple-900/60 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-purple-900 dark:text-purple-200">重新設定有效天數：</span>
                        <ThemedSelect value={newDurationDays} onChange={e => setNewDurationDays(Number(e.target.value))} className="px-2.5 py-1 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden">
                          <option value={3}>3 天後失效</option>
                          <option value={7}>7 天後失效 (預設)</option>
                          <option value={14}>14 天後失效</option>
                          <option value={30}>30 天後失效</option>
                          <option value={0}>永久有效 (無期限)</option>
                        </ThemedSelect>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setResettingTrackId(null)} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer">取消</button>
                        <button type="button" disabled={isSubmitting} onClick={() => handleResetToken(t)} className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs disabled:opacity-50 cursor-pointer">{isSubmitting ? '重置中...' : '確認重置連結'}</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
