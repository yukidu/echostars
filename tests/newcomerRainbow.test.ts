import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/components/AudioCard.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/AudioCard.css', import.meta.url), 'utf8');

test('only the 新人 category tag receives the rainbow border class', () => {
  assert.match(card, /const isNewcomer = cat\.trim\(\) === '新人';/);
  assert.match(card, /isNewcomer \? 'newcomer-rainbow-border' : ''/);
  assert.match(card, /borderColor: isNewcomer \? undefined : 'var\(--theme-border-subtle, #f1e7ea\)'/);
});

test('rainbow emphasis changes border color without changing border thickness', () => {
  assert.match(css, /@keyframes newcomerRainbowBorder/);
  assert.match(css, /border-color:/);
  assert.doesNotMatch(css, /border-(?:width|style):/);
  assert.doesNotMatch(css, /border:\s*\d/);
});
