/** Only objects uploaded through this application's R2 route are eligible for deletion. */
export function uploadedAudioKey(audioUrl: string, origin: string): string | null {
  try {
    const url = new URL(audioUrl, origin);
    if (url.origin !== origin || !url.pathname.startsWith('/api/r2/file/')) return null;
    const key = decodeURIComponent(url.pathname.slice('/api/r2/file/'.length));
    if (!key.startsWith('uploads/') || key.split('/').some(p=>p==='..') || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(key)) return null;
    return key;
  } catch { return null; }
}
