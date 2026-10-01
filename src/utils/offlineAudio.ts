/**
 * Offline Audio Cache Management
 * Automatically caches listened audio metadata and purges files:
 * 1. If progress > 95% (completed), deletes from offline storage to save space
 * 2. If not listened for more than 15 days (15 days), automatically purges
 */

const OFFLINE_REGISTRY_KEY = 'sq_offline_audio_registry_v1';
const TWO_WEEKS_MS = 15 * 24 * 60 * 60 * 1000;

export interface OfflineTrackRecord {
  trackId: string;
  audioUrl?: string;
  cachedAt: number;
  lastListenedAt: number;
  completed?: boolean;
}

export function getOfflineRegistry(): Record<string, OfflineTrackRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OFFLINE_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveOfflineRegistry(registry: Record<string, OfflineTrackRecord>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // quota exceeded or private mode
  }
}

/**
 * Record a track as cached locally and update last listened timestamp
 */
export function recordOfflineTrack(trackId: string, audioUrl?: string) {
  const reg = getOfflineRegistry();
  reg[trackId] = {
    trackId,
    audioUrl: audioUrl || reg[trackId]?.audioUrl,
    cachedAt: reg[trackId]?.cachedAt || Date.now(),
    lastListenedAt: Date.now(),
    completed: false
  };
  saveOfflineRegistry(reg);
  if (audioUrl) void cacheAudio(trackId, audioUrl);
}

/**
 * Delete offline file if track is >95% completed
 */
export function handleTrackProgressOffline(trackId: string, currentTime: number, duration: number) {
  if (duration <= 0) return;
  const ratio = currentTime / duration;
  if (ratio > 0.95) {
    removeOfflineTrack(trackId);
  } else {
    // update last listened
    const reg = getOfflineRegistry();
    if (reg[trackId] && Date.now() - reg[trackId].lastListenedAt > 30000) {
      reg[trackId].lastListenedAt = Date.now();
      saveOfflineRegistry(reg);
    }
  }
}

/**
 * Remove an offline track from cache
 */
export function removeOfflineTrack(trackId: string) {
  const reg = getOfflineRegistry();
  pending.get(trackId)?.abort();
  pending.delete(trackId);
  if (reg[trackId]) {
    const audioUrl = reg[trackId].audioUrl;
    if (audioUrl && typeof caches !== "undefined") void caches.open(AUDIO_CACHE).then(cache => cache.delete(audioUrl)).catch(() => {});
    delete reg[trackId];
    saveOfflineRegistry(reg);
  }
}

/**
 * Clean up tracks not listened to for > 15 days (15 days)
 */
export function purgeStaleOfflineTracks(): number {
  const reg = getOfflineRegistry();
  const now = Date.now();
  let purgedCount = 0;

  for (const trackId of Object.keys(reg)) {
    const record = reg[trackId];
    if (now - record.lastListenedAt > TWO_WEEKS_MS || record.completed) {
      removeOfflineTrack(trackId);
      delete reg[trackId];
      purgedCount++;
    }
  }

  if (purgedCount > 0) {
    saveOfflineRegistry(reg);
  }
  return purgedCount;
}

const AUDIO_CACHE = 'echostars-audio-v3';
const pending = new Map<string, AbortController>();
async function cacheAudio(trackId: string, audioUrl: string) {
  if (typeof caches === 'undefined' || pending.has(trackId)) return;
  const controller = new AbortController();
  pending.set(trackId, controller);
  try {
    const cache = await caches.open(AUDIO_CACHE);
    if (await cache.match(audioUrl)) return;
    const response = await fetch(audioUrl, { signal: controller.signal });
    if (!response.ok || response.status === 206) return;
    const blob = await response.blob();
    if (controller.signal.aborted || !getOfflineRegistry()[trackId]) return;
    await cache.put(audioUrl, new Response(blob, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg' } }));
    if (controller.signal.aborted || !getOfflineRegistry()[trackId]) await cache.delete(audioUrl);
  } catch (error) {
    if (!controller.signal.aborted) console.warn('音檔離線保存未完成', error);
  } finally { if (pending.get(trackId) === controller) pending.delete(trackId); }
}
export async function getOfflineAudioUrl(audioUrl: string): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const response = await (await caches.open(AUDIO_CACHE)).match(audioUrl);
    return response ? URL.createObjectURL(await response.blob()) : null;
  } catch { return null; }
}
