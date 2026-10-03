import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('VIP share pages retry real audio playback after React selects the shared track', () => {
  assert.match(main, /meta\[name="echostars-share-vip"\]/);
  assert.match(main, /function startVipShareAutoplay\(\)/);
  assert.match(main, /if \(!isVipSharePage\) return;/);
  assert.match(main, /document\.querySelector<HTMLAudioElement>\('audio'\)/);
  assert.match(main, /audio\.play\(\)/);
  assert.match(main, /audio\.autoplay = true/);
  assert.match(main, /audio\.setAttribute\('playsinline', ''\)/);
  assert.match(main, /startVipShareAutoplay\(\);/);
});

test('blocked audible autoplay never leaves a fake playing animation', () => {
  assert.match(main, /NotAllowedError/);
  assert.match(main, /syncVipPlayerUiToActualPlayback/);
  assert.match(main, /點擊照片暫停/);
  assert.match(main, /點一下開始播放/);
  assert.match(main, /瀏覽器阻擋了自動播放/);
});

test('VIP autoplay fallback performs play directly inside the real click handler', () => {
  const clickHandler = main.match(/button\.addEventListener\('click', \(\) => \{([\s\S]*?)\n  \}\);/);
  assert.ok(clickHandler, 'VIP fallback click handler should exist');
  assert.match(clickHandler![1], /const playPromise = audio\.play\(\);/);
});
