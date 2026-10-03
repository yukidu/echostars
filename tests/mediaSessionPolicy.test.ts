import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../src/mediaSessionPolicy.ts', import.meta.url), 'utf8');
const miniPlayer = readFileSync(new URL('../src/components/MiniPlayer.tsx', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('mini player exposes current track metadata to the system media policy', () => {
  assert.match(miniPlayer, /data-echostars-media-session="1"/);
  assert.match(miniPlayer, /data-media-title=\{track\.title\}/);
  assert.match(miniPlayer, /data-media-artist=/);
  assert.match(miniPlayer, /data-media-artwork=\{track\.speakerAvatar \|\| '\/icon-512\.png'\}/);
});

test('media session publishes title, speaker, artwork and app album name', () => {
  assert.match(policy, /APP_TITLE = '繁星回聲'/);
  assert.match(policy, /mediaSession\.metadata/);
  assert.match(policy, /title,/);
  assert.match(policy, /artist,/);
  assert.match(policy, /album: APP_TITLE/);
  assert.match(policy, /artwork:/);
  assert.match(policy, /player\.dataset\.mediaArtwork/);
});

test('system playback controls support play pause and seeking', () => {
  assert.match(policy, /setActionHandler\('play'/);
  assert.match(policy, /setActionHandler\('pause'/);
  assert.match(policy, /seekbackward/);
  assert.match(policy, /seekforward/);
  assert.match(policy, /seekto/);
  assert.match(policy, /setPositionState/);
  assert.match(policy, /playbackState/);
});

test('media session module loads before React and PWA exposes monochrome icon', () => {
  const mediaIndex = indexHtml.indexOf('/src/mediaSessionPolicy.ts');
  const mainIndex = indexHtml.indexOf('/src/main.tsx');
  assert.ok(mediaIndex >= 0);
  assert.ok(mainIndex >= 0);
  assert.ok(mediaIndex < mainIndex);
  assert.match(manifest, /icon-monochrome\.svg/);
  assert.match(manifest, /"purpose": "monochrome"/);
  assert.match(serviceWorker, /echostars-shell-v53/);
  assert.match(serviceWorker, /icon-monochrome\.svg/);
});
