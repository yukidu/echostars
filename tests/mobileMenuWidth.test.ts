import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const navbar = readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('mobile hamburger drawer remains the existing React drawer', () => {
  assert.match(navbar, /Mobile Drawer Dropdown Menu/);
  assert.match(navbar, /md:hidden border-t/);
});

test('mobile hamburger drawer uses the right half of the viewport', () => {
  assert.match(css, /Mobile hamburger drawer: keep it on the right/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /width:\s*50vw\s*!important/);
  assert.match(css, /max-width:\s*50vw\s*!important/);
  assert.match(css, /margin-left:\s*auto\s*!important/);
  assert.match(css, /margin-right:\s*0\s*!important/);
});

test('PWA shell cache advances for mobile menu width release', () => {
  assert.match(sw, /echostars-shell-v68/);
});
