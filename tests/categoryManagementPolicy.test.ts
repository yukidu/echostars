import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../src/categoryManagementPolicy.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('upload/edit modal exposes category selection only', () => {
  assert.match(policy, /\.upload-modal-overlay button\[title="修改標籤名稱"\]/);
  assert.match(policy, /\.upload-modal-overlay button\[title="刪除此標籤"\]/);
  assert.match(policy, /input\[placeholder\^="輸入新標籤名稱"\]/);
  assert.match(policy, /僅可選取既有分類；新增、修改、刪除請至後台管理中心/);
});

test('admin category deletion requires a second click before React delete handler can run', () => {
  assert.match(policy, /DELETE_CONFIRM_WINDOW_MS = 6000/);
  assert.match(policy, /categoryDeleteConfirmUntil/);
  assert.match(policy, /event\.preventDefault\(\)/);
  assert.match(policy, /event\.stopImmediatePropagation\(\)/);
  assert.match(policy, /再次點擊確認刪除/);
  assert.match(policy, /if \(until > Date\.now\(\)\)[\s\S]*resetCategoryDeleteButton\(button\);[\s\S]*return;/);
});

test('category UI policy loads before the React bootstrap', () => {
  const policyIndex = indexHtml.indexOf('/src/categoryManagementPolicy.ts');
  const bootstrapIndex = indexHtml.indexOf('/src/categoryIntegrityBootstrap.ts');
  assert.ok(policyIndex >= 0);
  assert.ok(bootstrapIndex >= 0);
  assert.ok(policyIndex < bootstrapIndex);
});
