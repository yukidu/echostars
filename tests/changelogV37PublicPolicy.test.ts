import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../src/changelogV37PublicPolicy.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('v3.7 public changelog removes implementation jargon and keeps user-facing meaning', () => {
  assert.match(policy, /version:\s*'v3\.7'/);
  assert.match(policy, /安裝到桌面更直覺/);
  assert.match(policy, /首頁排序與篩選重新整理/);
  assert.match(policy, /網站更新改為背景自動完成/);
  assert.doesNotMatch(policy, /beforeinstallprompt|skipWaiting|clients\.claim|100dvw|translateX|localStorage|Cloudflare D1|Workers KV/);
});

test('v3.7 public policy rewrites summary and all three visible changelog sections', () => {
  assert.match(policy, /PUBLIC_V37_CHANGELOG\.summary/);
  assert.match(policy, /replaceSection\(modal, '增加功能'/);
  assert.match(policy, /replaceSection\(modal, '修改功能'/);
  assert.match(policy, /replaceSection\(modal, '刪除功能'/);
});

test('public changelog policy is loaded before the main application policies', () => {
  const v37 = indexHtml.indexOf('/src/changelogV37PublicPolicy.ts');
  const jpeg = indexHtml.indexOf('/src/jpegExportPolicy.ts');
  assert.ok(v37 >= 0);
  assert.ok(jpeg > v37);
});

test('PWA shell cache advances for v3.7 public language release', () => {
  assert.match(sw, /echostars-shell-v65/);
});
