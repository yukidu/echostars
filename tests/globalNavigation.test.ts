import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../src/globalNavigationPolicy.ts', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('main navigation is fixed to the viewport on every page', () => {
  assert.match(policy, /header\.sticky\.top-0/);
  assert.match(policy, /position: fixed !important/);
  assert.match(policy, /top: 0 !important/);
  assert.match(policy, /left: 0 !important/);
  assert.match(policy, /right: 0 !important/);
});

test('page reserves the navbar height so fixed navigation does not cover content', () => {
  assert.match(policy, /--echostars-main-nav-height: 4rem/);
  assert.match(policy, /--echostars-main-nav-height: 72px/);
  assert.match(policy, /padding-top: var\(--echostars-main-nav-height\)/);
});

test('global navigation policy is loaded by every app entry', () => {
  assert.match(index, /\/src\/globalNavigationPolicy\.ts/);
});

test('PWA shell cache advances for global fixed navigation release', () => {
  assert.match(sw, /echostars-shell-v59/);
});
