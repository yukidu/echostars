
export interface DataCenterStats {
  totalCount: number;
  rankStats: Array<{ name: string; count: number }>;
  joinReasonStats: Array<{ name: string; count: number }>;
  stayReasonStats?: Array<{ name: string; count: number }>;
  zodiacStats: Array<{ name: string; count: number }>;
  lifeNumberStats: Array<{ num: number; count: number }>;
  residenceStats: Array<{ name: string; count: number }>;
  selectedCenters: string[];
}

export function exportDataCenterCsv(
  filterSummary: Record<string, string>,
  totalCount: number,
  stats: DataCenterStats
): Blob {
  const lines: string[] = [];

  lines.push('【繁星回聲 - 數據中心統計分析報表】');
  lines.push(`報表產生時間,${new Date().toLocaleString('zh-TW')}`);
  lines.push(`符合篩選總人數,${totalCount} 人`);
  lines.push('');

  lines.push('【篩選條件】');
  Object.entries(filterSummary).forEach(([k, v]) => {
    lines.push(`"${k}","${v}"`);
  });
  lines.push('');

  lines.push('【各階層獎銜人數（高獎銜在前）】');
  lines.push('獎銜,人數,百分比');
  stats.rankStats.forEach(r => {
    const pct = totalCount > 0 ? ((r.count / totalCount) * 100).toFixed(1) : '0';
    lines.push(`"${r.name}",${r.count},${pct}%`);
  });
  lines.push('');

  lines.push('【初次如何認識安麗？分佈】');
  lines.push('原因,人數,百分比');
  stats.joinReasonStats.forEach(j => {
    const pct = totalCount > 0 ? ((j.count / totalCount) * 100).toFixed(1) : '0';
    lines.push(`"${j.name}",${j.count},${pct}%`);
  });
  lines.push('');

  if (stats.stayReasonStats && stats.stayReasonStats.length > 0) {
    lines.push('【什麼原因留在安麗？分佈】');
    lines.push('原因,人數,百分比');
    stats.stayReasonStats.forEach(s => {
      const pct = totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : '0';
      lines.push(`"${s.name}",${s.count},${pct}%`);
    });
    lines.push('');
  }

  lines.push('【星座分佈】');
  lines.push('星座,人數,百分比');
  stats.zodiacStats.forEach(z => {
    const pct = totalCount > 0 ? ((z.count / totalCount) * 100).toFixed(1) : '0';
    lines.push(`"${z.name}",${z.count},${pct}%`);
  });
  lines.push('');

  lines.push('【生命靈數分佈（1-9號人）】');
  lines.push('靈數,人數,百分比');
  stats.lifeNumberStats.forEach(l => {
    const pct = totalCount > 0 ? ((l.count / totalCount) * 100).toFixed(1) : '0';
    lines.push(`"${l.num} 號人",${l.count},${pct}%`);
  });
  lines.push('');

  lines.push('【居住地區分佈】');
  lines.push('地區,人數,百分比');
  stats.residenceStats.forEach(res => {
    const pct = totalCount > 0 ? ((res.count / totalCount) * 100).toFixed(1) : '0';
    lines.push(`"${res.name}",${res.count},${pct}%`);
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
}

export async function exportDataCenterPdf(
  filterSummary: Record<string, string>,
  totalCount: number,
  stats: DataCenterStats
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const width = 1200;
  const padding = 50;

  // Calculate dynamic canvas height
  const headerHeight = 180;
  const filterSectionHeight = 120;
  const rankSectionHeight = 40 + Math.ceil(stats.rankStats.length / 2) * 32;
  const twoColHeight = Math.max(
    stats.joinReasonStats.length * 30 + 50,
    stats.zodiacStats.length * 30 + 50
  );
  const bottomTwoColHeight = Math.max(
    stats.lifeNumberStats.length * 30 + 50,
    stats.residenceStats.slice(0, 10).length * 30 + 50
  );
  const footerHeight = 80;

  const totalHeight = headerHeight + filterSectionHeight + rankSectionHeight + twoColHeight + bottomTwoColHeight + footerHeight;
  canvas.width = width;
  canvas.height = totalHeight;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, totalHeight - 40);

  // Top Accent Bar
  ctx.fillStyle = '#c06c84';
  ctx.fillRect(40, 40, width - 80, 8);

  // Title
  ctx.font = 'bold 36px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('繁星回聲 · 數據中心統計分析報告', padding, 95);

  ctx.font = '16px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`產出日期：${new Date().toLocaleString('zh-TW')}    |    白金以上專用權限報表`, padding, 130);

  // Total Count Badge Box
  ctx.fillStyle = '#fae8ed';
  ctx.beginPath();
  ctx.roundRect(width - padding - 220, 60, 220, 80, 16);
  ctx.fill();
  ctx.strokeStyle = '#c06c84';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '14px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#832742';
  ctx.fillText('符合條件總人數', width - padding - 200, 90);

  ctx.font = 'bold 32px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#c06c84';
  ctx.fillText(`${totalCount} 人`, width - padding - 200, 126);

  let currentY = 175;

  // Filters Box
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(padding, currentY, width - padding * 2, 90, 12);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 15px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('【目前套用之篩選條件】', padding + 16, currentY + 28);

  ctx.font = '13px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#475569';
  const filterEntries = Object.entries(filterSummary);
  const row1 = filterEntries.slice(0, 4).map(([k, v]) => `${k}：${v}`).join('   |   ');
  const row2 = filterEntries.slice(4).map(([k, v]) => `${k}：${v}`).join('   |   ');
  ctx.fillText(row1, padding + 16, currentY + 54);
  if (row2) {
    ctx.fillText(row2, padding + 16, currentY + 76);
  }

  currentY += 115;

  // Section 1: 各階層獎銜人數（高獎銜在前）
  ctx.font = 'bold 20px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('■ 各階層獎銜人數分佈（高階在最前）', padding, currentY);

  currentY += 20;

  const colWidth = (width - padding * 2 - 30) / 2;
  const nonZeroRanks = stats.rankStats;

  nonZeroRanks.forEach((r, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = padding + col * (colWidth + 30);
    const y = currentY + row * 30;

    const pct = totalCount > 0 ? r.count / totalCount : 0;
    const barWidth = Math.max(2, Math.round(colWidth * 0.45 * pct));

    // Rank label
    ctx.font = 'bold 13px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(r.name, x, y + 16);

    // Bar background
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(x + 120, y + 4, colWidth * 0.45, 14, 4);
    ctx.fill();

    // Bar fill
    if (r.count > 0) {
      ctx.fillStyle = '#c06c84';
      ctx.beginPath();
      ctx.roundRect(x + 120, y + 4, barWidth, 14, 4);
      ctx.fill();
    }

    // Count
    ctx.font = 'bold 13px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${r.count} 人 (${(pct * 100).toFixed(0)}%)`, x + 125 + colWidth * 0.45, y + 16);
  });

  currentY += Math.ceil(nonZeroRanks.length / 2) * 30 + 40;

  // Section 2: Two Columns (加入原因 & 星座)
  const leftColX = padding;
  const rightColX = padding + colWidth + 30;

  // Left Col Title: 加入原因
  ctx.font = 'bold 18px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('■ 加入安麗原因分佈', leftColX, currentY);

  // Right Col Title: 星座分佈
  ctx.fillText('■ 成員星座分佈', rightColX, currentY);

  currentY += 20;
  const startTwoColY = currentY;

  stats.joinReasonStats.forEach((j, i) => {
    const y = startTwoColY + i * 28;
    const pct = totalCount > 0 ? j.count / totalCount : 0;
    const barWidth = Math.max(2, Math.round((colWidth - 180) * pct));

    ctx.font = '13px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(j.name, leftColX, y + 15);

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(leftColX + 90, y + 4, colWidth - 180, 14, 4);
    ctx.fill();

    if (j.count > 0) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(leftColX + 90, y + 4, barWidth, 14, 4);
      ctx.fill();
    }

    ctx.font = '12px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${j.count} 人`, leftColX + colWidth - 80, y + 15);
  });

  stats.zodiacStats.forEach((z, i) => {
    const y = startTwoColY + i * 28;
    const pct = totalCount > 0 ? z.count / totalCount : 0;
    const barWidth = Math.max(2, Math.round((colWidth - 180) * pct));

    ctx.font = '13px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(z.name, rightColX, y + 15);

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(rightColX + 80, y + 4, colWidth - 180, 14, 4);
    ctx.fill();

    if (z.count > 0) {
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.roundRect(rightColX + 80, y + 4, barWidth, 14, 4);
      ctx.fill();
    }

    ctx.font = '12px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${z.count} 人`, rightColX + colWidth - 90, y + 15);
  });

  currentY = startTwoColY + Math.max(stats.joinReasonStats.length, stats.zodiacStats.length) * 28 + 35;

  // Section 3: Two Columns (生命靈數 1-9 & 居住地)
  ctx.font = 'bold 18px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('■ 生命靈數（1-9號人）分佈', leftColX, currentY);
  ctx.fillText('■ 居住地區分佈（前 10 區）', rightColX, currentY);

  currentY += 20;
  const startBottomY = currentY;

  stats.lifeNumberStats.forEach((l, i) => {
    const y = startBottomY + i * 28;
    const pct = totalCount > 0 ? l.count / totalCount : 0;
    const barWidth = Math.max(2, Math.round((colWidth - 180) * pct));

    ctx.font = '13px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`${l.num} 號人`, leftColX, y + 15);

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(leftColX + 80, y + 4, colWidth - 180, 14, 4);
    ctx.fill();

    if (l.count > 0) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(leftColX + 80, y + 4, barWidth, 14, 4);
      ctx.fill();
    }

    ctx.font = '12px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${l.count} 人`, leftColX + colWidth - 90, y + 15);
  });

  stats.residenceStats.slice(0, 10).forEach((res, i) => {
    const y = startBottomY + i * 28;
    const pct = totalCount > 0 ? res.count / totalCount : 0;
    const barWidth = Math.max(2, Math.round((colWidth - 180) * pct));

    ctx.font = '13px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(res.name, rightColX, y + 15);

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(rightColX + 80, y + 4, colWidth - 180, 14, 4);
    ctx.fill();

    if (res.count > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(rightColX + 80, y + 4, barWidth, 14, 4);
      ctx.fill();
    }

    ctx.font = '12px "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${res.count} 人`, rightColX + colWidth - 90, y + 15);
  });

  // Footer
  ctx.font = '13px "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('繁星回聲 數據中心 · 僅供白金以上領導人做為團隊輔導與成長規劃使用', padding, totalHeight - 40);

  // Convert canvas to image data and build PDF
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  return pdf.output('blob');
}

export async function shareOrDownloadDataCenterFile(
  blob: Blob,
  filename: string,
  title: string
): Promise<void> {
  const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'text/csv';
  const file = new File([blob], filename, { type: mimeType });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: '來自繁星回聲數據中心統計分析報告'
      });
      return;
    } catch {
      // User cancelled or share failed, fallback to download
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
