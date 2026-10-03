import { exportMemberLearningCard } from './memberLearningCardExport';

export {
  exportRatedTracksImage,
  exportTrackCommentsImage,
  exportTrackFullCardImage,
  shareOrDownloadImage,
  exportPersonalProfileCard,
  shareOrDownloadProfileCard
} from './canvasExportLegacy';

export async function exportMemberProfileAndListeningImage(
  ...args: Parameters<typeof exportMemberLearningCard>
): Promise<Blob> {
  const blob = await exportMemberLearningCard(...args);
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('個人學習紀錄圖卡產生失敗，請重新嘗試。');
  }
  return blob;
}
