import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../src/homeDensityPolicy.ts', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('home density policy only activates when the audio card grid is present', () => {
  assert.match(policy, /HOME_GRID_SELECTOR = '\.audio-card-grid'/);
  assert.match(policy, /classList\.toggle\(ROOT_CLASS, onHomePlaylist\)/);
});

test('homepage spacing and audio card vertical density are tightened', () => {
  assert.match(policy, /main > \.space-y-4 > \* \+ \*/);
  assert.match(policy, /margin-top: 0\.5rem !important/);
  assert.match(policy, /\.audio-card-grid/);
  assert.match(policy, /gap: 0\.35rem !important/);
  assert.match(policy, /\.audio-card h3/);
  assert.match(policy, /line-height: 1\.05 !important/);
  assert.match(policy, /\.audio-card \.reaction-button/);
  assert.match(policy, /padding-top: 0\.15rem !important/);
});

test('home density policy is loaded globally but scopes itself to the homepage', () => {
  assert.match(index, /\/src\/homeDensityPolicy\.ts/);
});

test('PWA shell cache advances for compact homepage release', () => {
  assert.match(sw, /echostars-shell-v60/);
});
