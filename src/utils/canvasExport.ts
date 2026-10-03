import { Track, UserProfile, UserListeningRecord } from '../types';
import { calculateNumerology } from './numerology';
import { JPEG_EXPORT_QUALITY, JPEG_EXPORT_WIDTH } from '../jpegExportPolicy';

export {
  exportRatedTracksImage,
  exportTrackCommentsImage,
  exportTrackFullCardImage,
  shareOrDownloadImage,
  exportPersonalProfileCard,
  shareOrDownloadProfileCard
} from './canvasExportLegacy';

/**
 * 個人學習卡匯出：維持原版排版比例，但直接以 1280px 實際寬度繪製，
 * 並讓九宮格圈線與網頁版一致：先天數、生日數、星座數、天賦數、命數。
 */
export async function exportMemberProfileAndListeningImage(
  user: UserProfile,
  records: Array<{ track: Track; record: UserListeningRecord }>
): Promise<Blob> {
  const calculated = calculateNumerology(user.birthday || '');
  user = {
    ...user,
    zodiac: calculated?.zodiac,
    talentNumber: calculated?.talentNumber,
    lifeNumber: calculated?.lifeNumber
  };

  const canvas = document.createElement('canvas');
  const logicalWidth = 800;
  const padding = 36;
  const topSectionHeight = 295;
  const footerHeight = 45;
  const itemsHeight = records.length === 0
    ? 60
    : records.reduce((acc, item) => acc + (item.record.comment ? 82 : 62), 0);
  const logicalHeight = topSectionHeight + itemsHeight + footerHeight;
  const renderScale = JPEG_EXPORT_WIDTH / logicalWidth;

  canvas.width = JPEG_EXPORT_WIDTH;
  canvas.height = Math.round(logicalHeight * renderScale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(renderScale, renderScale);

  const width = logicalWidth;
  const totalHeight = logicalHeight;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(14, 14, width - 28, totalHeight - 28);

  ctx.fillStyle = '#000000';
  ctx.fillRect(28, 28, width - 56, 4);

  ctx.font = 'bold 26px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('學員學習檔案卡', padding, 62);

  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText(`繁星回聲 • 學習與聆聽檔案  |  匯出日期：${new Date().toLocaleDateString('zh-TW')}`, padding, 82);

  const profileBoxY = 96;
  const profileBoxH = 175;
  const leftColW = 516;
  const rightColX = padding + leftColW + 14;
  const rightColW = width - padding * 2 - leftColW - 14;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(padding, profileBoxY, leftColW, profileBoxH);

  ctx.font = 'bold 14px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText(`姓名：${user.name}  |  獎銜：${user.rank || '無'}  |  編號：${user.amwayId || '-'}  |  中心：${user.center || '無'}`, padding + 12, profileBoxY + 26);

  ctx.font = '12px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#222222';
  ctx.fillText(`推薦人：${user.sponsor || '-'}   上手白金：${user.platinumUpline || '-'}   上手鑽石：${user.diamondUpline || '-'}`, padding + 12, profileBoxY + 54);
  ctx.fillText(`居住地區：${user.residence || '-'}   所屬中心：${user.center || '無'}`, padding + 12, profileBoxY + 78);

  ctx.fillStyle = '#444444';
  ctx.fillText(`所屬星座：${user.zodiac || '-'}   天賦數：${user.talentNumber || '-'}   主命數：${user.lifeNumber ? `${user.lifeNumber} 號人` : '-'}`, padding + 12, profileBoxY + 104);

  const cleanJoin = user.joinReason
    ? (user.joinReason.length > 28 ? user.joinReason.substring(0, 28) + '...' : user.joinReason)
    : '-';
  ctx.fillText(`初次認識安麗：${cleanJoin}`, padding + 12, profileBoxY + 130);

  const cleanStay = user.stayReason
    ? (user.stayReason.length > 28 ? user.stayReason.substring(0, 28) + '...' : user.stayReason)
    : '-';
  ctx.fillText(`留在安麗原因：${cleanStay}`, padding + 12, profileBoxY + 154);

  const numerology = user.birthday ? calculateNumerology(user.birthday) : null;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(rightColX, profileBoxY, rightColW, profileBoxH);

  ctx.font = 'bold 12px "PingFang TC", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('生命靈數九宮格', rightColX + rightColW / 2, profileBoxY + 14);

  const gridLayout = [
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9]
  ];
  const cellSize = 44;
  const gridStartX = rightColX + (rightColW - cellSize * 3) / 2;
  const gridStartY = profileBoxY + 28;

  gridLayout.forEach((row, rIdx) => {
    row.forEach((num, cIdx) => {
      const cellX = gridStartX + cIdx * cellSize;
      const cellY = gridStartY + rIdx * cellSize;
      const centerX = cellX + cellSize / 2;
      const centerY = cellY + cellSize / 2;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);

      if (numerology) {
        const birthCount = numerology.digitCounts[num] || 0;
        const isBirthdayNum = num === numerology.birthdayNumber;
        const isZodiacNum = num === numerology.zodiacNumber;
        const talentCount = numerology.talentDigits.filter(digit => digit === num).length;
        const isLifeNum = num === numerology.lifeNumber;

        const rings: Array<{ color: string; lineWidth: number }> = [
          ...Array.from({ length: birthCount }, () => ({ color: '#0f172a', lineWidth: 1.05 })),
          ...(isBirthdayNum ? [{ color: '#fbbf24', lineWidth: 1.35 }] : []),
          ...(isZodiacNum ? [{ color: '#9333ea', lineWidth: 1.35 }] : []),
          ...Array.from({ length: talentCount }, () => ({ color: '#84cc16', lineWidth: 1.45 })),
          ...(isLifeNum ? [{ color: '#ef4444', lineWidth: 1.8 }] : [])
        ];

        rings.forEach((ring, index) => {
          const radius = rings.length === 1
            ? 13
            : 9.5 + index * (9.5 / Math.max(1, rings.length - 1));
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.lineWidth = rings.length > 8 ? Math.min(ring.lineWidth, 0.95) : ring.lineWidth;
          ctx.strokeStyle = ring.color;
          ctx.stroke();
        });

        const hasAny = rings.length > 0;
        ctx.font = 'bold 14px "PingFang TC", sans-serif';
        ctx.fillStyle = isLifeNum ? '#dc2626' : hasAny ? '#0f172a' : '#cbd5e1';
        ctx.fillText(String(num), centerX, centerY + 1);
      } else {
        ctx.font = 'bold 14px "PingFang TC", sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(String(num), centerX, centerY + 1);
      }
    });
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = 'bold 15px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText(`已聆聽錄音檔學習進度清單（共 ${records.length} 部）`, padding, 290);

  let y = 302;
  if (records.length === 0) {
    ctx.font = 'italic 13px sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText('尚無已聆聽的音檔紀錄', padding, y + 25);
  } else {
    records.forEach((item, index) => {
      const { track, record } = item;
      const itemH = record.comment ? 82 : 62;

      ctx.font = 'bold 14px "PingFang TC", "Microsoft JhengHei", sans-serif';
      ctx.fillStyle = '#000000';
      const cleanTitle = track.title.length > 32 ? track.title.substring(0, 32) + '...' : track.title;
      ctx.fillText(`${index + 1}. 《${cleanTitle}》`, padding, y + 18);

      ctx.font = '11.5px sans-serif';
      ctx.fillStyle = '#333333';
      const finishText = record.finishDate ? `已聽完 (${record.finishDate})` : '未聽完';
      ctx.fillText(
        `主講：${track.speaker}${track.speakerRank ? `·${track.speakerRank}` : ''}  |  首次聆聽：${record.firstListenDate || '-'}  |  最近聆聽：${record.lastListenDate || '-'}  |  ${finishText}`,
        padding + 12,
        y + 36
      );

      ctx.font = '11.5px sans-serif';
      ctx.fillStyle = '#111111';
      const stars = record.rating && record.rating > 0
        ? '★'.repeat(record.rating) + '☆'.repeat(5 - record.rating) + ` (${record.rating}星)`
        : '未評價';
      ctx.fillText(
        `聆聽進度：${record.progressPercent || 0}%  |  點擊次數：${record.clickCount || 1}次  |  給予評價：${stars}`,
        padding + 12,
        y + 54
      );

      if (record.comment) {
        ctx.font = '11.5px "PingFang TC", "Microsoft JhengHei", sans-serif';
        ctx.fillStyle = '#555555';
        const cleanComment = record.comment.length > 42 ? record.comment.substring(0, 42) + '...' : record.comment;
        ctx.fillText(`學員心得：“ ${cleanComment} ”`, padding + 12, y + 72);
      }

      ctx.beginPath();
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 1;
      ctx.moveTo(padding, y + itemH - 4);
      ctx.lineTo(width - padding, y + itemH - 4);
      ctx.stroke();
      y += itemH;
    });
  }

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#333333';
  ctx.fillText('繁星回聲 • 學員學習檔案卡', padding, totalHeight - 22);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/jpeg', JPEG_EXPORT_QUALITY);
  });
}
