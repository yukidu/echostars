import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const notes = readFileSync(new URL('../src/changelogReleaseNotes.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('v3.8 cumulative changelog covers recent user-facing releases', () => {
  assert.match(notes, /version:\s*'v3\.8'/);
  assert.match(notes, /date:\s*'2026\/10\/04'/);
  assert.match(notes, /跨平台系統媒體控制/);
  assert.match(notes, /分享頁登入恢復/);
  assert.match(notes, /會員學習進度整合/);
  assert.match(notes, /分類標籤改以後台管理中心為唯一管理入口/);
  assert.match(notes, /搜尋引擎與 AI 爬蟲防護/);
  assert.match(notes, /全站主選單改為固定置頂/);
  assert.match(notes, /首頁整體密度提高/);
  assert.match(notes, /「按讚數」文字改為與左側「心得數」完全相同/);
});

test('changelog release patch only intercepts GET changelog requests', () => {
  assert.match(notes, /method !== 'GET'/);
  assert.match(notes, /url\.pathname === '\/api\/changelog'/);
  assert.match(notes, /return nativeFetch\(\.\.\.args\)/);
});

test('release notes patch loads before the other runtime policies', () => {
  const notesIndex = indexHtml.indexOf('/src/changelogReleaseNotes.ts');
  const firstExistingPolicy = indexHtml.indexOf('/src/jpegExportPolicy.ts');
  assert.ok(notesIndex >= 0);
  assert.ok(firstExistingPolicy > notesIndex);
});

test('PWA shell cache advances for cumulative changelog release', () => {
  assert.match(sw, /echostars-shell-v64/);
});
