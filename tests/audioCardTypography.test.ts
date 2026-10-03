import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/components/AudioCard.css', import.meta.url), 'utf8');

test('track title uses palette primary color and remains the only bold text', () => {
  assert.match(css, /\.audio-card,\s*\.audio-card \*\s*\{[\s\S]*font-weight:\s*400 !important/);
  assert.match(css, /\.audio-card h3\s*\{[\s\S]*color:\s*var\(--color-primary,\s*#c06c84\) !important/);
  assert.match(css, /\.audio-card h3\s*\{[\s\S]*font-size:\s*1\.25rem !important/);
  assert.match(css, /\.audio-card h3\s*\{[\s\S]*font-weight:\s*900 !important/);
});

test('track title grows further on larger screens', () => {
  assert.match(css, /@media \(min-width:\s*640px\)[\s\S]*\.audio-card h3[\s\S]*font-size:\s*1\.375rem !important/);
});

test('like count text inherits the same feedback-row color without overriding the heart icon', () => {
  assert.match(css, /\.audio-card \.reaction-button\[aria-pressed\] span\s*\{[\s\S]*color:\s*inherit !important/);
  assert.doesNotMatch(css, /\.audio-card \.reaction-button\[aria-pressed\] svg/);
});
