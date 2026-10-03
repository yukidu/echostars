import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const learningCardSource = readFileSync(new URL('../src/utils/memberLearningCardExport.ts', import.meta.url), 'utf8');
const canvasExportSource = readFileSync(new URL('../src/utils/canvasExport.ts', import.meta.url), 'utf8');
const learningRouterSource = readFileSync(new URL('../worker/learningCardRouter.ts', import.meta.url), 'utf8');
const shareModalSource = readFileSync(new URL('../src/components/ShareModal.tsx', import.meta.url), 'utf8');
const jpegPolicySource = readFileSync(new URL('../src/jpegExportPolicy.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('learning card is exported by the dedicated 1280px high-quality module', () => {
  assert.match(canvasExportSource, /exportMemberLearningCard/);
  assert.match(learningCardSource, /JPEG_EXPORT_WIDTH/);
  assert.match(learningCardSource, /JPEG_EXPORT_QUALITY/);
  assert.match(learningCardSource, /個人學習卡/);
  assert.match(learningCardSource, /會員註冊日期/);
  assert.match(learningCardSource, /初次認識安麗/);
  assert.match(learningCardSource, /留在安麗/);
});

test('learning card uses a larger grid and only talent/life rings are colored', () => {
  assert.match(learningCardSource, /cell = 58/);
  assert.match(learningCardSource, /#65a30d/);
  assert.match(learningCardSource, /#dc2626/);
  assert.doesNotMatch(learningCardSource, /#fbbf24/);
  assert.doesNotMatch(learningCardSource, /#9333ea/);
  assert.match(learningCardSource, /birthday \? \[\{ color: '#000000'/);
  assert.match(learningCardSource, /zodiac \? \[\{ color: '#000000'/);
});

test('learning records prioritize comments, then recency, cap at 50 and render two columns', () => {
  assert.match(learningCardSource, /ac !== bc/);
  assert.match(learningCardSource, /timestamp\(b\.record\) - timestamp\(a\.record\)/);
  assert.match(learningCardSource, /\.slice\(0, 50\)/);
  assert.match(learningCardSource, /i \+= 2/);
  assert.match(learningCardSource, /track\.speaker/);
  assert.match(learningCardSource, /track\.speakerRank/);
  assert.match(learningCardSource, /record\.firstListenDate/);
});

test('first-listen date and member share counts are durably recorded', () => {
  assert.match(learningRouterSource, /firstListenDate/);
  assert.match(learningRouterSource, /playback_first_listen_date/);
  assert.match(learningRouterSource, /CREATE TABLE IF NOT EXISTS share_events/);
  assert.match(learningRouterSource, /member-learning-card-stats/);
  assert.match(shareModalSource, /\/api\/share-events/);
  assert.match(shareModalSource, /recordShareEvent\(\)/);
});

test('all large JPEG canvas exports are normalized to 1280px width at 97 percent quality', () => {
  assert.match(jpegPolicySource, /JPEG_EXPORT_WIDTH = 1280/);
  assert.match(jpegPolicySource, /JPEG_EXPORT_QUALITY = 0\.97/);
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

test('PWA cache is bumped for the learning-card redesign', () => {
  assert.match(swSource, /echostars-shell-v44/);
});
