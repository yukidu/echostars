import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../src/uploadModalPresentationPolicy.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('upload modal top controls use cover, audio, VIP order', () => {
  assert.match(policy, /data-upload-cover-label/);
  assert.match(policy, /grid-column: 1 \/ 3/);
  assert.match(policy, /data-upload-audio/);
  assert.match(policy, /grid-column: 3 \/ 5/);
  assert.match(policy, /data-upload-vip/);
  assert.match(policy, /grid-column: 5 \/ 7/);
});

test('mobile upload controls preserve cover, audio, VIP sequence', () => {
  assert.match(policy, /data-upload-cover-label[^}]*[\s\S]*grid-row: 2/);
  assert.match(policy, /data-upload-cover-selected[^}]*[\s\S]*grid-row: 3/);
  assert.match(policy, /data-upload-audio[^}]*[\s\S]*grid-row: 4/);
  assert.match(policy, /data-upload-vip[^}]*[\s\S]*grid-row: 5/);
});

test('keyword presentation removes check, hash and plus prefixes', () => {
  assert.match(policy, /replace\(\/\^#\\s\*\//);
  assert.match(policy, /replace\(\/\^\[✓\+\]\\s\*#/);
  assert.match(policy, /data-upload-keyword-add/);
  assert.match(policy, /\[data-upload-keyword-add="1"\] > svg/);
});

test('presentation policy is loaded before React and PWA cache is bumped', () => {
  const policyIndex = indexHtml.indexOf('/src/uploadModalPresentationPolicy.ts');
  const mainIndex = indexHtml.indexOf('/src/main.tsx');
  assert.ok(policyIndex >= 0);
  assert.ok(mainIndex >= 0);
  assert.ok(policyIndex < mainIndex);
  assert.match(serviceWorker, /echostars-shell-v51/);
});
