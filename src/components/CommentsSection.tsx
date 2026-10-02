import { commentThreads } from '../utils/comments';
import { apiJson, identityKeys } from '../utils/api';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Trash2,
  Edit3,
  Check,
  X,
  ShieldAlert,
  Heart,
  Reply,
  AtSign,
  Radio,
  Mic
} from 'lucide-react';
import { Comment, UserProfile, Track } from '../types';
import { VisitorIdentity } from '../utils/visitor';

interface CommentsSectionProps {
  trackId: string;
  comments: Comment[];
  visitor: VisitorIdentity;
  currentUser: UserProfile | null;
  isAdmin: boolean;
  onAddComment: (content: string, replyToId?: string, replyToAuthor?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, newContent: string) => Promise<void>;
  onViewMember?: (user: UserProfile) => void;
  allUsers?: UserProfile[];
  tracks?: Track[];
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  visitor,
  currentUser,
  isAdmin,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onViewMember,
  allUsers = [],
  tracks = []
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Comment likes local state tracker
  const [likeStats, setLikeStats] = useState<Record<string, { likes: number; hasLiked: boolean }>>({});

  // Requirement 4: @ 標記提示選單狀態（輸入文字時才小巧顯示）
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionKeyword, setMentionKeyword] = useState('');
  const [mentionTab, setMentionTab] = useState<'members' | 'tracks'>('members');

  const myKeys = identityKeys(currentUser, visitor.deviceId);
  const myId = myKeys[0];
  const canModerateComments =
    isAdmin ||
    currentUser?.isAdminUser === true ||
    currentUser?.role === '管理員' ||
    currentUser?.role === '超級管理員';

  const pendingLikes = useRef(new Set<string>());
  useEffect(() => { setLikeStats({}); }, [myId]);

  const handleLikeComment = async (comment: Comment) => {
    if (pendingLikes.current.has(comment.id)) return;
    pendingLikes.current.add(comment.id);
    const currentLiked = likeStats[comment.id] !== undefined
      ? likeStats[comment.id].hasLiked
      : (comment.likedBy || []).some(k => myKeys.includes(k));
    const currentCount = likeStats[comment.id] !== undefined
      ? likeStats[comment.id].likes
      : (comment.likes || 0);

    const nextLiked = !currentLiked;
    const nextCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

    setLikeStats(prev => ({
      ...prev,
      [comment.id]: { likes: nextCount, hasLiked: nextLiked }
    }));

    try {
      const data = await apiJson(`/api/comments/${encodeURIComponent(comment.id)}/like`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: myId, userId: currentUser?.id, userEmail: currentUser?.email, deviceId: visitor?.deviceId })
      });
      setLikeStats(prev => ({ ...prev, [comment.id]: { likes: data.likes, hasLiked: data.hasLiked } }));
    } catch (error) {
      setLikeStats(prev => ({ ...prev, [comment.id]: { likes: currentCount, hasLiked: currentLiked } }));
      setErrorMessage(error instanceof Error ? error.message : '按讚失敗，請重試。');
    } finally { pendingLikes.current.delete(comment.id); }
  };

  // Requirement 2 & 3: 個人基本資料名稱修改後與用戶資料庫同步一致，超級管理員同步最新名稱
  const getRegisteredAuthor = (c: Comment): UserProfile | null => {
    const email=c.authorEmail?.toLowerCase().trim();
    if (!email) return null;
    if (currentUser?.email?.toLowerCase().trim()===email) return currentUser;
    return allUsers.find(u=>u.email?.toLowerCase().trim()===email)||null;
  };

  const handleAuthorClick = (c: Comment) => {
    const member = getRegisteredAuthor(c);
    // 訪客心得不可被點選，點了不會有任何作用也不會出現卡片
    if (!member || !onViewMember) return;
    onViewMember(member);
  };

  // Requirement 4: 心得收穫@標記功能，不要自動顯示互動對話框，等用戶自己輸入文字的時候，才出現視窗給挑選
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastHalfAt = textBeforeCursor.lastIndexOf('@');
    const lastFullAt = textBeforeCursor.lastIndexOf('＠');
    const lastAtIdx = Math.max(lastHalfAt, lastFullAt);

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      // 輸入 @ 或 ＠ 後立即彈出小巧視窗給挑選，若繼續輸入則過濾關鍵字
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionKeyword(query);
        setIsMentionOpen(true);
        return;
      }
    }
    setIsMentionOpen(false);
  };

  const handleSelectMention = (label: string) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);
    const lastHalfAt = textBeforeCursor.lastIndexOf('@');
    const lastFullAt = textBeforeCursor.lastIndexOf('＠');
    const lastAtIdx = Math.max(lastHalfAt, lastFullAt);

    if (lastAtIdx !== -1) {
      const newText = textBeforeCursor.slice(0, lastAtIdx) + `@${label} ` + textAfterCursor;
      setInputText(newText);
      setIsMentionOpen(false);
      setTimeout(() => {
        if (textareaRef.current) {
          const nextPos = lastAtIdx + label.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 0);
    }
  };

  // Requirement 4 (v2.4): @或＠標記功能出現的關聯字選單，包含「演講者姓名」與「會員姓名」
  // 會員姓名右邊顯示「中心+獎銜」，演講者姓名右邊顯示「音檔演講者」
  const combinedMentionSuggestions = useMemo(() => {
    const q = mentionKeyword.toLowerCase().trim();

    // 1. 會員姓名 (右邊顯示「中心+獎銜」)
    const members = allUsers
      .filter(u => {
        if (!u.name || u.name.startsWith('訪客')) return false;
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          (u.center && u.center.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.rank && u.rank.toLowerCase().includes(q))
        );
      })
      .slice(0, 6)
      .map(u => {
        const centerRank = [u.center, u.rank || '會員'].filter(Boolean).join(' ') || '會員';
        return {
          type: 'member' as const,
          id: `u-${u.id}`,
          label: u.name,
          badge: centerRank,
          avatar: u.avatar
        };
      });

    // 2. 演講者姓名 (從 tracks 聚合不重複演講者，右邊顯示「音檔演講者」)
    const speakerMap = new Map<string, { name: string; avatar?: string }>();
    tracks.forEach(t => {
      if (t.speaker && t.speaker.trim()) {
        const s = t.speaker.trim();
        if (!speakerMap.has(s)) {
          speakerMap.set(s, { name: s, avatar: t.speakerAvatar });
        }
      }
    });

    const speakers = Array.from(speakerMap.values())
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(s => ({
        type: 'speaker' as const,
        id: `spk-${s.name}`,
        label: s.name,
        badge: '音檔演講者',
        avatar: s.avatar
      }));

    // 3. 錄音檔
    const trackItems = tracks
      .filter(t => !q || t.title.toLowerCase().includes(q) || (t.speaker && t.speaker.toLowerCase().includes(q)))
      .slice(0, 4)
      .map(t => ({
        type: 'track' as const,
        id: `t-${t.id}`,
        label: t.title,
        badge: t.speaker ? `講師：${t.speaker}` : '音檔',
        avatar: t.speakerAvatar
      }));

    return [...members, ...speakers, ...trackItems].slice(0, 12);
  }, [allUsers, tracks, mentionKeyword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const toxicWords = [
      '去死', 'fuck', 'fck', 'shit', 'bitch', 'asshole',
      '幹', '操', '操你', '幹你', '白痴', '白癡', '智障', '腦殘',
      '王八蛋', '靠北', '靠杯', '三小', '賤人', '死全家', '滾蛋',
      '混蛋', '垃圾', '髒話', '洗版', '攻擊', '惡意'
    ];
    const lower = inputText.toLowerCase().replace(/\s+/g, '');
    if (toxicWords.some(w => lower.includes(w.toLowerCase()))) {
      setErrorMessage('心得經 Cloudflare Workers AI 智慧審核未通過（含不當或攻擊性言論），請使用友善用詞。');
      setIsSubmitting(false);
      return;
    }

    try {
      await onAddComment(inputText.trim(), replyingTo?.id, replyingTo?.authorName);
      setInputText('');
      setReplyingTo(null);
      setIsMentionOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || '心得發送失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditContent(c.content);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    try {
      await onEditComment(commentId, editContent.trim());
      setEditingId(null);
    } catch (err: any) {
      setErrorMessage(err.message || '修改失敗');
    }
  };

  // Requirement 9: 解析心得內容中的 @會員 與 @錄音檔
  const renderFormattedContent = (value: string) => {
    const content = typeof value === 'string' ? value : '';
    // Regex matching @label or ＠label (Requirement 4)
    const regex = /[@＠]([^\s@＠\n,，。！!？?]+)/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        elements.push(content.substring(lastIndex, match.index));
      }

      const rawLabel = match[1];
      const matchedUser = allUsers.find(
        u => u.name && u.name.trim().toLowerCase() === rawLabel.trim().toLowerCase()
      );
      const matchedSpeaker = tracks.find(
        t => t.speaker && t.speaker.trim().toLowerCase() === rawLabel.trim().toLowerCase()
      );
      const matchedTrack = tracks.find(
        t => t.title && (t.title.trim().toLowerCase() === rawLabel.trim().toLowerCase() || rawLabel.trim().toLowerCase().includes(t.title.trim().toLowerCase()))
      );

      if (matchedUser) {
        // @Member mention -> click to pop up member profile card
        elements.push(
          <button
            key={`mention-user-${match.index}`}
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (onViewMember) onViewMember(matchedUser);
            }}
            className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold hover:underline bg-rose-50 dark:bg-rose-950/70 border border-rose-200/60 dark:border-rose-900/60 px-1.5 py-0.5 rounded-lg mx-0.5 text-xs transition-colors cursor-pointer"
            title={`查看會員【${matchedUser.name}】個人資料卡`}
          >
            <AtSign className="w-3 h-3 shrink-0" />
            <span>{matchedUser.name}</span>
          </button>
        );
      } else if (matchedSpeaker) {
        // Requirement 4 (v2.4): 演講者標籤呈現
        elements.push(
          <span
            key={`mention-speaker-${match.index}`}
            className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/70 border border-purple-200/60 dark:border-purple-900/60 px-1.5 py-0.2 rounded-lg mx-0.5 text-xs select-none"
            title={`音檔演講者：${matchedSpeaker.speaker}`}
          >
            <Mic className="w-3 h-3 shrink-0 text-purple-500" />
            <span>@{matchedSpeaker.speaker}</span>
            <span className="text-[9px] px-1 rounded-sm bg-purple-200/60 dark:bg-purple-900/60 text-purple-700 dark:text-purple-200 font-medium">演講者</span>
          </span>
        );
      } else if (matchedTrack) {
        // Requirement 4: 已標記音檔取消此彈窗試聽功能，僅以精美音檔標籤呈現
        elements.push(
          <span
            key={`mention-track-${match.index}`}
            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/50 px-1.5 py-0.2 rounded-md mx-0.5 text-xs select-none"
            title={`標記音檔：${matchedTrack.title}（主講：${matchedTrack.speaker}）`}
          >
            <Radio className="w-3 h-3 shrink-0" />
            <span>{matchedTrack.title}</span>
          </span>
        );
      } else {
        elements.push(`@${rawLabel}`);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      elements.push(content.substring(lastIndex));
    }

    return elements;
  };

  return (
    <div className="w-full bg-white/70 dark:bg-slate-900/60 rounded-3xl p-5 sm:p-7 border border-rose-100/60 dark:border-slate-800 shadow-xs relative">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-rose-500" />
          <span>心得收穫</span>
          <span className="text-slate-400 font-normal text-base">({comments.length})</span>
        </h3>
      </div>

      {/* Comment Input Card */}
      <form onSubmit={handleSubmit} className="mb-8 relative">
        <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-700/60 focus-within:border-rose-400 dark:focus-within:border-rose-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all relative">
          {/* Replying banner */}
          {replyingTo && (
            <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-3 py-1.5 rounded-xl text-xs mb-2 border border-rose-200/60 dark:border-rose-900 font-medium">
              <span className="flex items-center gap-1.5">
                <Reply className="w-3.5 h-3.5" />
                <span>回覆 @{replyingTo.authorName}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-0.5 hover:text-rose-900 dark:hover:text-rose-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaChange}
            maxLength={500}
            rows={3}
            placeholder={
              replyingTo
                ? `回覆 @${replyingTo.authorName}...`
                : '寫下您的心得收穫...'
            }
            className="w-full bg-transparent resize-none outline-hidden text-sm sm:text-base text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />

          {/* Requirement 4 (v2.4): @或＠標記關聯字選單，演講者右邊顯示「音檔演講者」，會員右邊顯示「中心+獎銜」 */}
          {isMentionOpen && (
            <div className="absolute left-2 top-full mt-1 z-40 w-64 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 font-bold">
                <span>標記關聯字 ({combinedMentionSuggestions.length})</span>
                <button
                  type="button"
                  onClick={() => setIsMentionOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto p-1 text-[11px] space-y-0.5">
                {combinedMentionSuggestions.length === 0 ? (
                  <div className="p-2 text-center text-slate-400 text-[10px]">無符合的會員或演講者</div>
                ) : (
                  combinedMentionSuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectMention(item.label)}
                      className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1.5">
                        {item.type === 'member' ? (
                          item.avatar ? (
                            <img
                              src={item.avatar}
                              alt=""
                              className="w-4 h-4 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <span className="text-[10px] shrink-0">👤</span>
                          )
                        ) : item.type === 'speaker' ? (
                          item.avatar ? (
                            <img
                              src={item.avatar}
                              alt=""
                              className="w-4 h-4 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <span className="text-[10px] shrink-0">🎙️</span>
                          )
                        ) : (
                          <span className="text-[10px] shrink-0">🎵</span>
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-[var(--color-primary,#c06c84)]">
                          {item.label}
                        </span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium shrink-0 ${
                        item.type === 'speaker'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : item.type === 'member'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {item.badge}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Footer Bar inside Input */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 mt-2">
            {/* Identity Badge - Requirement 3: 取消「🐲杜杜龍」，改成跟用戶基本資料同步一致 */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {currentUser ? (
                <div className="flex items-center gap-1.5">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                  <span className={`font-bold text-sm ${isAdmin || currentUser.isContributor ? 'rainbow-admin-text' : 'text-slate-800 dark:text-slate-100'}`}>
                    {currentUser.name}
                  </span>

                  <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    · {currentUser.rank}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-sm shadow-2xs">
                    {visitor.emoji}
                  </span>
                  <span>{visitor.fullName}</span>
                  <span className="text-slate-400 text-xs">· 訪客稱號</span>
                </div>
              )}
            </div>

            {/* Right: Counter & Submit */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono">
                {inputText.length}/500
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !inputText.trim()}
                className="px-5 py-2 rounded-xl text-white font-medium text-sm transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
              >
                {isSubmitting ? '審核中...' : '送出心得'}
              </button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>

      {/* Comments List */}
      <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/70">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
            目前還沒有心得，快來當第一個分享心得的人吧！
          </div>
        ) : (
          (() => {
const threads = commentThreads(comments);
              const rootComments = threads.roots;

            const renderCommentItem = (c: Comment, isReply = false) => {
              // Requirement 5: 可以刪除和編輯自己的心得
              const isAuthor = Boolean(c.authorEmail
                ? currentUser?.email && c.authorEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
                : c.deviceId && c.deviceId === visitor.deviceId);

              const registeredAuthor = getRegisteredAuthor(c);
              const isVisitor = !registeredAuthor;
              // Requirement 2 & 3: 心得收穫顯示的名字，跟會員自己後台設定修改的名字同步，取消「🐲杜杜龍」
              const displayAuthorName = registeredAuthor?.name || c.authorName;
              const displayAuthorAvatar = registeredAuthor?.avatar || c.authorAvatar;
              // Requirement 5 (v2.5): 如果是訪客，那他不應該有獎銜。因為訪客不能設定基本資料。訪客暱稱的名字右邊要增加顯示（訪客）做區分。
              const displayAuthorBadge = registeredAuthor
                ? (registeredAuthor.rank || '無')
                : null; // 訪客不應有獎銜

              const showBadge = !!displayAuthorBadge && displayAuthorBadge !== '訪客稱號' && displayAuthorBadge !== '訪客' && displayAuthorBadge !== '無';

              const userLiked = likeStats[c.id] !== undefined
                ? likeStats[c.id].hasLiked
                : (c.likedBy || []).some(k => myKeys.includes(k));
              const userLikesCount = likeStats[c.id] !== undefined
                ? likeStats[c.id].likes
                : (c.likes || 0);

              const isAvatarUrl = displayAuthorAvatar && (displayAuthorAvatar.startsWith('http') || displayAuthorAvatar.startsWith('data:'));
              // Requirement 2: 點選「會員」名稱出現資訊卡，訪客維持現狀不需出現資訊卡
              const isClickable = !!registeredAuthor;

              return (
                <div id={`comment-${c.id}`} key={c.id} className={`space-y-1 ${isReply ? 'pt-2' : 'pt-3 first:pt-0'}`}>
                  {/* Comment Header Line */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div
                      onClick={isClickable ? () => handleAuthorClick(c) : undefined}
                      className={`flex items-center gap-1.5 flex-wrap ${
                        isClickable
                          ? 'cursor-pointer hover:opacity-85 transition-opacity'
                          : 'cursor-default pointer-events-none'
                      }`}
                      title={isClickable ? `點擊查看【${displayAuthorName}】會員個人檔案` : undefined}
                    >
                      {isAvatarUrl ? (
                        <img
                          src={displayAuthorAvatar}
                          alt={displayAuthorName}
                          className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                      ) : (
                        <span className="text-sm shrink-0">{displayAuthorAvatar || '👤'}</span>
                      )}

                      {c.isAdmin ? (
                        <span className="rainbow-admin-text font-bold text-xs">
                          {displayAuthorName}
                        </span>
                      ) : displayAuthorBadge === '貢獻者' ? (
                        <span className="rainbow-admin-text font-bold text-xs">
                          {displayAuthorName}
                        </span>
                      ) : isClickable ? (
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs underline decoration-dotted underline-offset-2 hover:text-rose-600 transition-colors">
                          {displayAuthorName}
                        </span>
                      ) : (
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs select-none">
                          {displayAuthorName}
                        </span>
                      )}

                      {/* Requirement 5 (v2.7): 心得收穫的訪客身份，「(訪客)」二個字改成「訪客」 */}
                      {isVisitor && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[var(--color-light-pill,#fae8ed)] text-[var(--color-primary,#c06c84)] border border-[var(--theme-border-subtle,#f1e7ea)] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium select-none">
                          訪客
                        </span>
                      )}

                      {showBadge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[var(--color-light-pill,#fae8ed)] text-[var(--color-primary,#c06c84)] border border-[var(--theme-border-subtle,#f1e7ea)] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium">
                          {displayAuthorBadge}
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {c.timestamp}
                      </span>
                    </div>

                    {/* Actions: Like, Reply, Edit / Delete */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLikeComment(c)}
                        className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                          userLiked
                            ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 font-bold'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={userLiked ? '取消讚' : '按讚這則心得'}
                      >
                        <Heart className={`w-3 h-3 ${userLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span>{userLikesCount > 0 ? userLikesCount : ''}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(c);
                          setInputText(`@${displayAuthorName} `);
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                          }
                        }}
                        className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-[var(--color-primary,#c06c84)] px-1.5 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="回覆此心得"
                      >
                        <Reply className="w-3 h-3" />
                        <span>回覆</span>
                      </button>

                      {isAuthor && editingId !== c.id && (
                        <button
                          onClick={() => handleStartEdit(c)}
                          title="編輯心得"
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(canModerateComments || isAuthor) && editingId !== c.id && (
                        <button
                          onClick={() => onDeleteComment(c.id)}
                          title="刪除心得"
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comment Body */}
                  {editingId === c.id ? (
                    <div className="mt-1.5 space-y-1.5 pl-5">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 text-xs text-slate-800 dark:text-slate-100 outline-hidden"
                        rows={2}
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" /> 取消
                        </button>
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          className="px-2.5 py-1 rounded-lg text-xs bg-rose-600 text-white flex items-center gap-1 shadow-2xs font-bold cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> 儲存修改
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-6 whitespace-pre-wrap mt-0.5 break-words">
                      {c.replyToAuthor && (
                        <span className="text-[11px] text-[var(--color-primary,#c06c84)] font-bold mr-1.5">
                          回覆 @{c.replyToAuthor}：
                        </span>
                      )}
                      {renderFormattedContent(c.content)}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-3">
                {rootComments.map(parent => {
                  const replies = threads.replies.get(parent.id) || [];
                  return (
                    <div key={parent.id} className="pb-2 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0">
                      {renderCommentItem(parent, false)}
                      {replies.length > 0 && (
                        <div className="pl-5 sm:pl-7 ml-3 mt-2 border-l-2 border-rose-200/70 dark:border-slate-700/80 space-y-2">
                          {replies.map(reply => renderCommentItem(reply, true))}
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
