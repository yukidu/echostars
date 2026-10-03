import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/components/AudioCard.css', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('track title uses palette primary color and remains the only bold text', () => {
  assert.match(css, /\.audio-card,\s*\.audio-card \*\s*\{[\s\S]*font-weight:\s*400 !important/);
  assert.match(css, /\.audio-card h3\s*\{[\s\S]*color:\s*var\(--color-primary,\s*#c06c84\) !important/);
  assert.match(css, /\.audio-card h3\s*\{[\s\S]*font-size:\s*1\.125rem !important/);
  assert.match(css, /\.audio-card h3\s*\{[\s\S]*font-weight:\s*900 !important/);
});

test('track title grows further on larger screens', () => {
  assert.match(css, /@media \(min-width:\s*640px\)[\s\S]*\.audio-card h3[\s\S]*font-size:\s*1\.25rem !important/);
});

test('PWA shell cache advances for audio-card typography release', () => {
  assert.match(sw, /echostars-shell-v61/);
});
