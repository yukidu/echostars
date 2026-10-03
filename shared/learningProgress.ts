export type PlaybackRowLike = {
  trackId?: string;
  userIdentifier?: string;
  currentTime?: number | string | null;
  duration?: number | string | null;
  progressPercent?: number | string | null;
  completed?: boolean | number | string | null;
  firstListenDate?: string | null;
  lastListenDate?: string | null;
  finishDate?: string | null;
  lastPlayedAt?: number | string | null;
  updatedAt?: number | string | null;
  isDeleted?: boolean | number | null;
  trackTitle?: string | null;
  trackSpeaker?: string | null;
  trackSpeakerRank?: string | null;
};

export type TrackProgressMeta = {
  id: string;
  title?: string | null;
  speaker?: string | null;
  speakerRank?: string | null;
  durationSeconds?: number | string | null;
};

export type CanonicalPlaybackRecord = {
  trackId: string;
  userIdOrDeviceId: string;
  firstListenDate: string;
  lastListenDate: string;
  finishDate?: string;
  progressPercent: number;
  completed: boolean;
  currentTime: number;
  duration: number;
  clickCount: number;
  isDeleted: boolean;
  trackTitle: string;
  trackSpeaker: string;
  trackSpeakerRank: string;
  updatedAt: number;
};

const finite = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function dateStamp(value: unknown): number {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function earlierDate(a: string, b: string) {
  if (!a) return b;
  if (!b) return a;
  const at = dateStamp(a), bt = dateStamp(b);
  if (!at) return b;
  if (!bt) return a;
  return at <= bt ? a : b;
}

function laterDate(a: string, b: string) {
  if (!a) return b;
  if (!b) return a;
  const at = dateStamp(a), bt = dateStamp(b);
  if (!at) return b;
  if (!bt) return a;
  return at >= bt ? a : b;
}

export function resolvedDuration(row: PlaybackRowLike, meta?: TrackProgressMeta): number {
  const recorded = Math.max(0, finite(row.duration));
  const track = Math.max(0, finite(meta?.durationSeconds));
  // The HTMLAudioElement duration saved while listening is the closest value to
  // the actual media file. Fall back to the track metadata when old rows did not
  // persist a usable duration.
  return recorded > 0 ? recorded : track;
}

export function canonicalProgressPercent(row: PlaybackRowLike, meta?: TrackProgressMeta): number {
  if (Boolean(row.completed) || String(row.finishDate || '').trim()) return 100;
  const duration = resolvedDuration(row, meta);
  const stored = clamp(finite(row.progressPercent), 0, 100);
  const current = Math.max(0, finite(row.currentTime));
  const derived = duration > 0 ? clamp((current / duration) * 100, 0, 100) : 0;
  const best = Math.max(stored, derived);
  return best >= 95 ? 100 : Math.round(best * 10) / 10;
}

export function mergePlaybackRows(
  rows: PlaybackRowLike[],
  metaByTrack: Record<string, TrackProgressMeta> = {}
): Record<string, CanonicalPlaybackRecord> {
  const merged: Record<string, CanonicalPlaybackRecord> = {};

  for (const row of rows || []) {
    const trackId = String(row.trackId || '').trim();
    if (!trackId) continue;
    const meta = metaByTrack[trackId];
    const duration = resolvedDuration(row, meta);
    const progress = canonicalProgressPercent(row, meta);
    const completed = progress >= 100 || Boolean(row.completed) || Boolean(String(row.finishDate || '').trim());
    const first = String(row.firstListenDate || row.lastListenDate || row.finishDate || '').trim();
    const last = String(row.lastListenDate || row.finishDate || row.firstListenDate || '').trim();
    const finish = String(row.finishDate || '').trim();
    const updatedAt = Math.max(0, finite(row.lastPlayedAt) || finite(row.updatedAt));
    const recordedCurrent = Math.max(0, finite(row.currentTime));
    const progressCurrent = duration > 0 ? duration * progress / 100 : recordedCurrent;
    const currentTime = completed && duration > 0
      ? duration
      : Math.max(recordedCurrent, progressCurrent);

    const next: CanonicalPlaybackRecord = {
      trackId,
      userIdOrDeviceId: String(row.userIdentifier || '').trim(),
      firstListenDate: first,
      lastListenDate: last,
      finishDate: finish || undefined,
      progressPercent: completed ? 100 : progress,
      completed,
      currentTime,
      duration,
      clickCount: 1,
      isDeleted: Boolean(row.isDeleted),
      trackTitle: String(meta?.title || row.trackTitle || '演講錄音檔'),
      trackSpeaker: String(meta?.speaker || row.trackSpeaker || '繁星講師'),
      trackSpeakerRank: String(meta?.speakerRank || row.trackSpeakerRank || '無'),
      updatedAt
    };

    const old = merged[trackId];
    if (!old) {
      merged[trackId] = next;
      continue;
    }

    const mergedCompleted = old.completed || next.completed;
    const mergedDuration = Math.max(old.duration, next.duration);
    const mergedProgress = mergedCompleted ? 100 : Math.max(old.progressPercent, next.progressPercent);
    merged[trackId] = {
      trackId,
      userIdOrDeviceId: next.updatedAt >= old.updatedAt ? next.userIdOrDeviceId : old.userIdOrDeviceId,
      firstListenDate: earlierDate(old.firstListenDate, next.firstListenDate),
      lastListenDate: laterDate(old.lastListenDate, next.lastListenDate),
      finishDate: earlierDate(old.finishDate || '', next.finishDate || '') || undefined,
      progressPercent: mergedProgress,
      completed: mergedCompleted,
      currentTime: mergedCompleted && mergedDuration > 0
        ? mergedDuration
        : Math.max(old.currentTime, next.currentTime, mergedDuration * mergedProgress / 100),
      duration: mergedDuration,
      clickCount: Math.max(old.clickCount || 1, next.clickCount || 1),
      isDeleted: old.isDeleted && next.isDeleted,
      trackTitle: next.trackTitle || old.trackTitle,
      trackSpeaker: next.trackSpeaker || old.trackSpeaker,
      trackSpeakerRank: next.trackSpeakerRank || old.trackSpeakerRank,
      updatedAt: Math.max(old.updatedAt, next.updatedAt)
    };
  }

  return merged;
}

export function summarizePlaybackRecords(records: Record<string, CanonicalPlaybackRecord>) {
  const values = Object.values(records || {});
  let completedCount = 0;
  let unfinishedCount = 0;
  let listenedSeconds = 0;
  let progressTotal = 0;

  for (const record of values) {
    const progress = clamp(finite(record.progressPercent), 0, 100);
    if (record.completed || progress >= 95) completedCount += 1;
    else unfinishedCount += 1;
    progressTotal += record.completed ? 100 : progress;
    const duration = Math.max(0, finite(record.duration));
    if (duration > 0) listenedSeconds += duration * (record.completed ? 1 : progress / 100);
    else listenedSeconds += Math.max(0, finite(record.currentTime));
  }

  return {
    totalCount: values.length,
    completedCount,
    unfinishedCount,
    listenedSeconds,
    listenedHours: Math.round((listenedSeconds / 3600) * 10) / 10,
    totalMinutes: Math.round(listenedSeconds / 60),
    averageProgress: values.length ? Math.round(progressTotal / values.length) : 0
  };
}
