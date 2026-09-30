export interface AudioMemory {
  currentTime: number;
  duration: number;
  completed: boolean;
  listenedOver2Min: boolean;
  percentage: number;
}

const STORAGE_PLAYBACK_KEY = 'sq_audio_progress_v1';

export function getStoredPlayback(trackId: string): AudioMemory | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PLAYBACK_KEY}_${trackId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredPlayback(trackId: string, currentTime: number, duration: number) {
  if (!duration || duration <= 0) return;
  const completed = currentTime >= duration - 3;
  const listenedOver2Min = currentTime >= 120;
  const percentage = Math.min(100, Math.round((currentTime / duration) * 100));

  const mem: AudioMemory = {
    currentTime,
    duration,
    completed,
    listenedOver2Min,
    percentage
  };

  try {
    localStorage.setItem(`${STORAGE_PLAYBACK_KEY}_${trackId}`, JSON.stringify(mem));
  } catch {
    // ignore
  }
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function formatRemainingTime(current: number, total: number): string {
  const rem = Math.max(0, total - current);
  return `-${formatTime(rem)}`;
}
