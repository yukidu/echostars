import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const learningCardSource = readFileSync(new URL('../src/utils/memberLearningCardExport.ts', import.meta.url), 'utf8');
const canvasExportSource = readFileSync(new URL('../src/utils/canvasExport.ts', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/components/ProfileModal.tsx', import.meta.url), 'utf8');
const bwExportSource = readFileSync(new URL('../src/components/BwExportModal.tsx', import.meta.url), 'utf8');
const learningRouterSource = readFileSync(new URL('../worker/learningCardRouter.ts', import.meta.url), 'utf8');
const jpegPolicySource = readFileSync(new URL('../src/jpegExportPolicy.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('personal learning record export uses the dedicated 1280px JPEG module and rejects empty output', () => {
  assert.match(canvasExportSource, /exportMemberLearningCard/);
  assert.match(canvasExportSource, /export async function exportMemberProfileAndListeningImage/);
  assert.match(canvasExportSource, /blob instanceof Blob/);
  assert.match(canvasExportSource, /blob\.size <= 0/);
  assert.match(learningCardSource, /JPEG_EXPORT_WIDTH/);
  assert.match(learningCardSource, /JPEG_EXPORT_QUALITY/);
  assert.match(learningCardSource, /個人學習卡/);
  assert.match(learningCardSource, /會員註冊日期/);
  assert.match(learningCardSource, /已 \$\{joinedDays\} 天/);
  assert.doesNotMatch(learningCardSource, /紀錄排序：本人有心得優先/);
});

test('profile export loads canonical playback history before drawing and merges ratings/comments', () => {
  assert.match(profileSource, /if \(!currentUser \|\| isExportingCard\) return/);
  assert.match(profileSource, /\/api\/playback\/history\/\$\{encodeURIComponent\(idParam\)\}/);
  assert.match(profileSource, /track\.ratings/);
  assert.match(profileSource, /comments\.find/);
  assert.match(profileSource, /exportMemberProfileAndListeningImage\(currentUser, records\)/);
  assert.match(profileSource, /shareOrDownloadImage\(blob/);
});

test('exported numerology grid matches the web ring colors and is enlarged dynamically', () => {
  assert.match(learningCardSource, /#0f172a/);
  assert.match(learningCardSource, /#fbbf24/);
  assert.match(learningCardSource, /#9333ea/);
  assert.match(learningCardSource, /#84cc16/);
  assert.match(learningCardSource, /#ef4444/);
  assert.match(learningCardSource, /Math\.floor\(Math\.min\(\(w - 14\) \/ 3, \(h - 32\) \/ 3\)\)/);
});

test('learning record titles wrap instead of being truncated and cards use dynamic compact height', () => {
  assert.match(learningCardSource, /wrapText/);
  assert.match(learningCardSource, /titleLines\.length \* 17/);
  assert.doesNotMatch(learningCardSource, /track\.title\.length > 32/);
});

test('learning-card backend canonicalizes old identity aliases and preserves completed progress', () => {
  assert.match(learningRouterSource, /playbackIdentityFilter/);
  assert.match(learningRouterSource, /LOWER\(TRIM\(userIdentifier\)\) = \?/);
  assert.match(learningRouterSource, /LOWER\(SUBSTR\(TRIM\(key\)/);
  assert.match(learningRouterSource, /mergePlaybackRows/);
  assert.match(learningRouterSource, /summarizePlaybackRecords/);
  assert.match(learningRouterSource, /progressPercent = 100/);
  assert.match(learningRouterSource, /MAX\(COALESCE\(playback_memories\.progressPercent, 0\), excluded\.progressPercent\)/);
});

test('large JPEG canvas exports keep the shared 1280px / 95 percent quality policy', () => {
  assert.match(jpegPolicySource, /JPEG_EXPORT_WIDTH = 1280/);
  assert.match(jpegPolicySource, /JPEG_EXPORT_QUALITY = 0\.95/);
  assert.match(jpegPolicySource, /imageSmoothingQuality = 'high'/);
  assert.match(jpegPolicySource, /MIN_LARGE_EXPORT_CANVAS_WIDTH = 700/);
});

test('JPEG export policy loads before the bootstrap that mounts React', () => {
  const policyIndex = indexSource.indexOf('/src/jpegExportPolicy.ts');
  const bootstrapIndex = indexSource.indexOf('/src/categoryIntegrityBootstrap.ts');
  assert.ok(policyIndex >= 0, 'JPEG export policy script missing');
  assert.ok(bootstrapIndex >= 0, 'React bootstrap script missing');
  assert.ok(policyIndex < bootstrapIndex, 'JPEG export policy must load before the React bootstrap');
});

test('share-card modal releases preview URLs and surfaces generation failures', () => {
  assert.match(bwExportSource, /URL\.revokeObjectURL/);
  assert.match(bwExportSource, /setExportError/);
  assert.match(bwExportSource, /blob\.size <= 0/);
  assert.match(bwExportSource, /Failed to generate export preview/);
});
