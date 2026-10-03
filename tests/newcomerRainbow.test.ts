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

test('newcomer border shows a simultaneous 45-degree seven-color gradient that flows left to right', () => {
  assert.match(css, /@keyframes newcomerRainbowFlow/);
  assert.match(css, /linear-gradient\(\s*45deg,/);
  for (const color of ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de']) {
    assert.ok(css.includes(color), `missing rainbow color ${color}`);
  }
  assert.match(css, /background-size:\s*200% 100%/);
  assert.match(css, /background-position:\s*100% 50%/);
  assert.match(css, /background-position:\s*0% 50%/);
  assert.match(css, /animation:\s*newcomerRainbowFlow 2\.4s linear infinite/);
});

test('newcomer keeps its original fill and paints only a true 1px rainbow border', () => {
  assert.match(css, /\.newcomer-rainbow-border\s*\{[\s\S]*background-image:\s*none !important;/);
  assert.match(css, /\.newcomer-rainbow-border::after/);
  assert.match(css, /inset:\s*0/);
  assert.match(css, /padding:\s*1px/);
  assert.match(css, /border-radius:\s*inherit/);
  assert.match(css, /-webkit-mask-composite:\s*xor/);
  assert.match(css, /mask-composite:\s*exclude/);
  assert.doesNotMatch(css, /\.newcomer-rainbow-border::before/);
  assert.doesNotMatch(css, /border-(?:width|style):/);
  assert.doesNotMatch(css, /border:\s*\d/);
});
