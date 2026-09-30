/**
 * Offline Audio Cache Management
 * Automatically caches listened audio metadata and purges files:
 * 1. If progress > 95% (completed), deletes from offline storage to save space
 * 2. If not listened for more than 2 weeks (14 days), automatically purges
 */

const OFFLINE_REGISTRY_KEY = 'sq_offline_audio_registry_v1';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export interface OfflineTrackRecord {
  trackId: string;
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
export function recordOfflineTrack(trackId: string) {
  const reg = getOfflineRegistry();
  reg[trackId] = {
    trackId,
    cachedAt: reg[trackId]?.cachedAt || Date.now(),
    lastListenedAt: Date.now(),
    completed: false
  };
  saveOfflineRegistry(reg);
}

/**
 * Delete offline file if track is >95% completed
 */
export function handleTrackProgressOffline(trackId: string, currentTime: number, duration: number) {
  if (duration <= 0) return;
  const ratio = currentTime / duration;
  if (ratio >= 0.95) {
    removeOfflineTrack(trackId);
  } else {
    // update last listened
    const reg = getOfflineRegistry();
    if (reg[trackId]) {
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
  if (reg[trackId]) {
    delete reg[trackId];
    saveOfflineRegistry(reg);
  }
}

/**
 * Clean up tracks not listened to for > 2 weeks (14 days)
 */
export function purgeStaleOfflineTracks(): number {
  const reg = getOfflineRegistry();
  const now = Date.now();
  let purgedCount = 0;

  for (const trackId of Object.keys(reg)) {
    const record = reg[trackId];
    if (now - record.lastListenedAt > TWO_WEEKS_MS || record.completed) {
      delete reg[trackId];
      purgedCount++;
    }
  }

  if (purgedCount > 0) {
    saveOfflineRegistry(reg);
  }
  return purgedCount;
}
