import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const navbar = readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/mobileMenuHalfLayout.css', import.meta.url), 'utf8');

test('mobile hamburger drawer remains the existing React drawer', () => {
  assert.match(navbar, /Mobile Drawer Dropdown Menu/);
  assert.match(navbar, /md:hidden border-t/);
});

test('mobile hamburger drawer uses the right half of the viewport', () => {
  const combined = `${css}\n${layout}`;
  assert.match(combined, /@media \(max-width: 767px\)/);
  assert.match(combined, /width:\s*50vw\s*!important/);
  assert.match(combined, /max-width:\s*50vw\s*!important/);
  assert.match(combined, /right:\s*0\s*!important/);
});
