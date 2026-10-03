import type { Track } from '../types';
export function keywordRanking(tracks: Track[]) {
  const stats = new Map<string, { count: number; createdAt: number }>();
  for (const track of tracks) for (const name of new Set([...(track.keywords || []), ...(track.tags || [])])) {
    const prev = stats.get(name) || { count: 0, createdAt: 0 };
    stats.set(name, { count: prev.count + 1, createdAt: Math.max(prev.createdAt, track.keywordMeta?.[name]?.createdAt || 0) });
  }
  return [...stats.keys()].sort((a, b) => stats.get(b)!.count - stats.get(a)!.count || stats.get(b)!.createdAt - stats.get(a)!.createdAt || a.localeCompare(b, 'zh-Hant'));
}
