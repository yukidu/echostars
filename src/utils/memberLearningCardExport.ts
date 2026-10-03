import { Track, UserProfile, UserListeningRecord } from '../types';
import { calculateNumerology } from './numerology';
import { JPEG_EXPORT_QUALITY, JPEG_EXPORT_WIDTH } from '../jpegExportPolicy';

type Item = { track: Track; record: UserListeningRecord };
type RuntimeRecord = UserListeningRecord & { currentTime?: number; updatedAt?: number };
type Stats = { completedCount: number; unfinishedCount: number; listenedHours: number; commentCount: number; shareCount: number };

const font = '"PingFang TC", "Microsoft JhengHei", sans-serif';
const short = (value: unknown, n: number) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
};
const date = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  const m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}` : text;
};
const timestamp = (record: UserListeningRecord) => {
  const runtime = record as RuntimeRecord;
  if (Number(runtime.updatedAt) > 0) return Number(runtime.updatedAt);
  const m = String(record.lastListenDate || record.finishDate || record.firstListenDate || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : 0;
};

function fallbackStats(items: Item[]): Stats {
  let completedCount = 0, unfinishedCount = 0, listenedSeconds = 0, commentCount = 0;
  for (const { track, record } of items) {
    const done = Boolean(record.completed) || Number(record.progressPercent || 0) >= 95;
    done ? completedCount++ : unfinishedCount++;
    if (record.comment?.trim()) commentCount++;
    const runtime = record as RuntimeRecord;
    const duration = Math.max(0, Number(record.duration) || Number(track.durationSeconds) || 0);
    const current = Math.max(0, Number(runtime.currentTime) || 0);
    listenedSeconds += current > 0 ? (duration > 0 ? Math.min(current, duration) : current) : duration * Math.min(100, Math.max(0, Number(record.progressPercent) || 0)) / 100;
  }
  return { completedCount, unfinishedCount, listenedHours: Math.round(listenedSeconds / 360) / 10, commentCount, shareCount: 0 };
}

async function loadStats(items: Item[]): Promise<Stats> {
  const fallback = fallbackStats(items);
  try {
    const response = await fetch('/api/member-learning-card-stats', { cache: 'no-store' });
    if (!response.ok) return fallback;
    const data = await response.json();
    return {
      completedCount: Number(data.completedCount) || 0,
      unfinishedCount: Number(data.unfinishedCount) || 0,
      listenedHours: Number(data.listenedHours) || 0,
      commentCount: Number(data.commentCount) || 0,
      shareCount: Number(data.shareCount) || 0
    };
  } catch { return fallback; }
}

function drawGrid(ctx: CanvasRenderingContext2D, user: UserProfile, x: number, y: number, w: number, h: number) {
  const numerology = user.birthday ? calculateNumerology(user.birthday) : null;
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
  ctx.font = `bold 13px ${font}`; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('生命靈數九宮格', x + w / 2, y + 19);
  const layout = [[1,4,7],[2,5,8],[3,6,9]], cell = 58;
  const sx = x + (w - cell * 3) / 2, sy = y + 38;
  layout.forEach((row, r) => row.forEach((num, c) => {
    const cx = sx + c * cell, cy = sy + r * cell, mx = cx + cell / 2, my = cy + cell / 2;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(cx, cy, cell, cell);
    if (!numerology) { ctx.font = `bold 16px ${font}`; ctx.fillStyle = '#cbd5e1'; ctx.fillText(String(num), mx, my + 1); return; }
    const birth = numerology.digitCounts[num] || 0;
    const birthday = num === numerology.birthdayNumber;
    const zodiac = num === numerology.zodiacNumber;
    const talent = numerology.talentDigits.filter(d => d === num).length;
    const life = num === numerology.lifeNumber;
    const rings: Array<{ color: string; width: number }> = [
      ...Array.from({ length: birth }, () => ({ color: '#000000', width: 1.2 })),
      ...(birthday ? [{ color: '#000000', width: 1.2 }] : []),
      ...(zodiac ? [{ color: '#000000', width: 1.2 }] : []),
      ...Array.from({ length: talent }, () => ({ color: '#65a30d', width: 1.7 })),
      ...(life ? [{ color: '#dc2626', width: 2 }] : [])
    ];
    rings.forEach((ring, i) => {
      const radius = rings.length === 1 ? 18 : Math.min(22, 10 + i * (12 / Math.max(1, rings.length - 1)));
      ctx.beginPath(); ctx.arc(mx, my, radius, 0, Math.PI * 2); ctx.strokeStyle = ring.color; ctx.lineWidth = rings.length > 9 ? Math.min(1, ring.width) : ring.width; ctx.stroke();
    });
    ctx.font = `bold 16px ${font}`; ctx.fillStyle = rings.length ? '#000' : '#cbd5e1'; ctx.fillText(String(num), mx, my + 1);
  }));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawRecord(ctx: CanvasRenderingContext2D, item: Item, no: number, x: number, y: number, w: number) {
  const { track, record } = item;
  const hasComment = Boolean(record.comment?.trim()), h = hasComment ? 116 : 96;
  const rank = track.speakerRank && !['無','公開'].includes(track.speakerRank) ? track.speakerRank : '';
  const title = short(`${track.speaker}${rank} ${track.title}`.trim(), 28);
  const done = record.finishDate || record.completed || Number(record.progressPercent) >= 95;
  ctx.strokeStyle = '#d6d6d6'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h - 4);
  ctx.font = `bold 12.5px ${font}`; ctx.fillStyle = '#000'; ctx.fillText(`${no}. ${title}`, x + 10, y + 20);
  ctx.font = `10.5px ${font}`; ctx.fillStyle = '#333';
  ctx.fillText(`首次：${date(record.firstListenDate)}   最近：${date(record.lastListenDate)}   ${done ? '已聽完' : '未聽完'}`, x + 10, y + 40);
  const rating = record.rating && record.rating > 0 ? '★'.repeat(Math.min(5, Math.max(0, Math.round(record.rating)))) : '未評價';
  ctx.fillText(`進度：${Math.round(Number(record.progressPercent) || 0)}%   評價：${rating}`, x + 10, y + 60);
  if (hasComment) { ctx.fillStyle = '#555'; ctx.fillText(`心得：${short(record.comment, 36)}`, x + 10, y + 82); }
  return h;
}

export async function exportMemberLearningCard(user: UserProfile, items: Item[]): Promise<Blob> {
  const calc = calculateNumerology(user.birthday || '');
  const resolved = { ...user, zodiac: calc?.zodiac, talentNumber: calc?.talentNumber, lifeNumber: calc?.lifeNumber };
  const records = [...items].sort((a, b) => {
    const ac = Boolean(a.record.comment?.trim()), bc = Boolean(b.record.comment?.trim());
    return ac !== bc ? (bc ? 1 : -1) : timestamp(b.record) - timestamp(a.record);
  }).slice(0, 50);
  const stats = await loadStats(items);

  const W = 800, pad = 32, gap = 14, startY = 430, footer = 48, colW = (W - pad * 2 - gap) / 2;
  let rowsH = records.length ? 0 : 72;
  for (let i = 0; i < records.length; i += 2) rowsH += Math.max(records[i].record.comment?.trim() ? 116 : 96, records[i + 1]?.record.comment?.trim() ? 116 : records[i + 1] ? 96 : 0) + 10;
  const H = startY + rowsH + footer, scale = JPEG_EXPORT_WIDTH / W;
  const canvas = document.createElement('canvas'); canvas.width = JPEG_EXPORT_WIDTH; canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.scale(scale, scale);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, W - 28, H - 28); ctx.fillStyle = '#000'; ctx.fillRect(28, 28, W - 56, 4);

  const titleRank = resolved.rank && resolved.rank !== '無' ? ` ${resolved.rank}` : '';
  ctx.font = `bold 25px ${font}`; ctx.fillStyle = '#000'; ctx.fillText(`${resolved.name}${titleRank} 個人學習卡`, pad, 62);
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#666'; ctx.fillText(`繁星回聲 • 個人學習進度  |  匯出日期：${date(new Date().toISOString())}`, pad, 82);

  const py = 96, ph = 220, leftW = 470, rx = pad + leftW + gap, rw = W - pad * 2 - leftW - gap, lx = pad + 12;
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.strokeRect(pad, py, leftW, ph);
  ctx.font = `bold 14px ${font}`; ctx.fillStyle = '#111'; ctx.fillText(`姓名：${resolved.name}   |   獎銜：${resolved.rank || '無'}`, lx, py + 28);
  ctx.font = `12px ${font}`;
  ctx.fillText(`會員編號：${resolved.amwayId || '-'}   |   中心：${resolved.center || '無'}   |   會員註冊日期：${date(resolved.registerDate)}`, lx, py + 56);
  ctx.fillText(`推薦人：${short(resolved.sponsor, 12)}   上手白金：${short(resolved.platinumUpline, 12)}   上手鑽石：${short(resolved.diamondUpline, 12)}`, lx, py + 84);
  ctx.fillText(`居住地區：${resolved.residence || '-'}   |   星座：${resolved.zodiac || '-'}   |   天賦數：${resolved.talentNumber || '-'}   |   命數：${resolved.lifeNumber || '-'}`, lx, py + 112);
  ctx.fillText(`初次認識安麗：${short(resolved.joinReason, 16)}   |   留在安麗：${short(resolved.stayReason, 16)}`, lx, py + 142);
  ctx.font = `11px ${font}`; ctx.fillStyle = '#555'; ctx.fillText('紀錄排序：本人有心得優先，其次依最近聆聽日期。', lx, py + 184);
  drawGrid(ctx, resolved, rx, py, rw, ph);

  const sy = 328, sh = 68; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.strokeRect(pad, sy, W - pad * 2, sh);
  ctx.font = `bold 13px ${font}`; ctx.fillStyle = '#000'; ctx.fillText('個人學習數據統計', pad + 12, sy + 21);
  ctx.font = `12px ${font}`; ctx.fillText(`已聽完：${stats.completedCount} 部   |   未聽完：${stats.unfinishedCount} 部   |   累計實際聆聽：約 ${stats.listenedHours.toFixed(1)} 小時`, pad + 12, sy + 43);
  ctx.fillText(`本人留言（含回覆）：${stats.commentCount} 篇   |   分享錄音檔：${stats.shareCount} 次`, pad + 410, sy + 43);

  ctx.font = `bold 15px ${font}`; ctx.fillText(`聆聽錄音學習紀錄（最近 ${records.length} 則${items.length > 50 ? `／全部 ${items.length} 則` : ''}）`, pad, 418);
  if (!records.length) { ctx.font = 'italic 13px sans-serif'; ctx.fillStyle = '#888'; ctx.fillText('尚無已聆聽的音檔紀錄', pad, startY + 30); }
  else {
    let y = startY;
    for (let i = 0; i < records.length; i += 2) {
      const leftH = drawRecord(ctx, records[i], i + 1, pad, y, colW);
      const rightH = records[i + 1] ? drawRecord(ctx, records[i + 1], i + 2, pad + colW + gap, y, colW) : 0;
      y += Math.max(leftH, rightH) + 10;
    }
  }
  ctx.font = `bold 11px ${font}`; ctx.fillStyle = '#333'; ctx.fillText('繁星回聲 • 個人學習卡', pad, H - 22);
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', JPEG_EXPORT_QUALITY));
}
