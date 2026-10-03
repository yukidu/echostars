import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const learningCardSource = readFileSync(new URL('../src/utils/memberLearningCardExport.ts', import.meta.url), 'utf8');
const canvasExportSource = readFileSync(new URL('../src/utils/canvasExport.ts', import.meta.url), 'utf8');
const learningRouterSource = readFileSync(new URL('../worker/learningCardRouter.ts', import.meta.url), 'utf8');
const jpegPolicySource = readFileSync(new URL('../src/jpegExportPolicy.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('learning card uses the dedicated 1280px JPEG export module', () => {
  assert.match(canvasExportSource, /exportMemberLearningCard/);
  assert.match(learningCardSource, /JPEG_EXPORT_WIDTH/);
  assert.match(learningCardSource, /JPEG_EXPORT_QUALITY/);
  assert.match(learningCardSource, /個人學習卡/);
  assert.match(learningCardSource, /會員註冊日期/);
  assert.match(learningCardSource, /已 \$\{joinedDays\} 天/);
  assert.doesNotMatch(learningCardSource, /紀錄排序：本人有心得優先/);
  assert.doesNotMatch(learningCardSource, /姓名：\$\{resolved\.name\}/);
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
  assert.doesNotMatch(learningCardSource, /short\(`\$\{track\.speaker\}/);
});

test('learning-card backend canonicalizes duplicate identity rows and repairs completed progress', () => {
  assert.match(learningRouterSource, /mergePlaybackRows/);
  assert.match(learningRouterSource, /summarizePlaybackRecords/);
  assert.match(learningRouterSource, /progressPercent = 100/);
  assert.match(learningRouterSource, /MAX\(COALESCE\(playback_memories\.progressPercent, 0\), excluded\.progressPercent\)/);
  assert.match(learningRouterSource, /LOWER\(TRIM\(userIdentifier\)\) IN/);
});

test('all large JPEG canvas exports are normalized to 1280px width at 95 percent quality', () => {
  assert.match(jpegPolicySource, /JPEG_EXPORT_WIDTH = 1280/);
  assert.match(jpegPolicySource, /JPEG_EXPORT_QUALITY = 0\.95/);
  assert.match(jpegPolicySource, /imageSmoothingQuality = 'high'/);
  assert.match(jpegPolicySource, /HTMLCanvasElement\.prototype\.toBlob/);
  assert.match(jpegPolicySource, /HTMLCanvasElement\.prototype\.toDataURL/);
  assert.match(jpegPolicySource, /MIN_LARGE_EXPORT_CANVAS_WIDTH = 700/);
});

test('JPEG export policy is loaded globally before the React application', () => {
  const policyIndex = indexSource.indexOf('/src/jpegExportPolicy.ts');
  const mainIndex = indexSource.indexOf('/src/main.tsx');
  assert.ok(policyIndex >= 0, 'JPEG export policy script missing');
  assert.ok(mainIndex >= 0, 'React entry script missing');
  assert.ok(policyIndex < mainIndex, 'JPEG export policy must load before the React app');
});

test('PWA cache is bumped for the learning-card accuracy fix', () => {
  assert.match(swSource, /echostars-shell-v45/);
});
