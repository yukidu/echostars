import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canvasExportSource = readFileSync(new URL('../src/utils/canvasExport.ts', import.meta.url), 'utf8');
const jpegPolicySource = readFileSync(new URL('../src/jpegExportPolicy.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('learning-card numerology export includes talent and life-number rings like the web grid', () => {
  assert.match(canvasExportSource, /talentDigits\.filter/);
  assert.match(canvasExportSource, /talentCount/);
  assert.match(canvasExportSource, /isLifeNum/);
  assert.match(canvasExportSource, /#84cc16/);
  assert.match(canvasExportSource, /#ef4444/);
  assert.match(canvasExportSource, /#fbbf24/);
  assert.match(canvasExportSource, /#9333ea/);
});

test('all large JPEG canvas exports are normalized to 1280px width at 97 percent quality', () => {
  assert.match(jpegPolicySource, /JPEG_EXPORT_WIDTH = 1280/);
  assert.match(jpegPolicySource, /JPEG_EXPORT_QUALITY = 0\.97/);
  assert.match(jpegPolicySource, /imageSmoothingQuality = 'high'/);
  assert.match(jpegPolicySource, /HTMLCanvasElement\.prototype\.toBlob/);
  assert.match(jpegPolicySource, /HTMLCanvasElement\.prototype\.toDataURL/);
  assert.match(jpegPolicySource, /MIN_LARGE_EXPORT_CANVAS_WIDTH = 700/);
});

test('JPEG export policy is loaded globally before the React application', () => {
  const policyIndex = indexSource.indexOf('/src/jpegExportPolicy.ts');
  const mainIndex = indexSource.indexOf('/src/main.tsx');
  assert.ok(policyIndex >= 0, 'JPEG export policy script missing');
  assert.ok(mainIndex >= 0, 'React entry script missing');
  assert.ok(policyIndex < mainIndex, 'JPEG export policy must load before the React app');
});

test('PWA cache is bumped for the export rendering change', () => {
  assert.match(swSource, /echostars-shell-v41/);
});
