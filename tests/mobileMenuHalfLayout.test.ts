import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/mobileMenuHalfLayout.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('mobile menu layout policy is loaded after the base stylesheet', () => {
  const base = main.indexOf("import './index.css';");
  const menu = main.indexOf("import './mobileMenuHalfLayout.css';");
  assert.ok(base >= 0);
  assert.ok(menu > base);
});

test('mobile drawer stays right aligned and half width', () => {
  assert.match(css, /width:\s*50vw\s*!important/);
  assert.match(css, /max-width:\s*50vw\s*!important/);
  assert.match(css, /margin-left:\s*auto\s*!important/);
  assert.match(css, /max-height:\s*calc\(100dvh - 64px\)/);
});

test('menu labels wrap as whole Chinese words instead of one-character columns', () => {
  assert.match(css, /word-break:\s*keep-all/);
  assert.match(css, /white-space:\s*normal\s*!important/);
  assert.match(css, /font-size:\s*0\.875rem\s*!important/);
});

test('install status is positioned under the install label', () => {
  assert.match(css, /button\[aria-label="繁星回聲已安裝"\]/);
  assert.match(css, /button\[aria-label="安裝到桌面"\]/);
  assert.match(css, /grid-template-rows:\s*auto auto/);
  assert.match(css, /span:nth-of-type\(2\)/);
  assert.match(css, /grid-row:\s*2/);
});

test('PWA shell cache advances for mobile menu layout fix', () => {
  assert.match(sw, /echostars-shell-v69/);
});
