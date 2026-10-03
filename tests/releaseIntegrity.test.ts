import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('v71 is the single current PWA cache version', () => {
  assert.match(sw, /const CACHE_NAME = 'echostars-shell-v71'/);
  const testsDir = new URL('./', import.meta.url);
  for (const file of readdirSync(testsDir).filter(name => name.endsWith('.test.ts') && name !== 'releaseIntegrity.test.ts')) {
    const source = readFileSync(new URL(file, testsDir), 'utf8');
    assert.doesNotMatch(source, /echostars-shell-v\d+/, `${file} must not pin an old PWA cache version`);
  }
});

test('service worker never caches API responses or personalized share HTML as app shell', () => {
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /cacheableNavigation = navigation && \(url\.pathname === '\/' \|\| url\.pathname === '\/index\.html'\)/);
  assert.doesNotMatch(sw, /cacheableNavigation[\s\S]*url\.pathname\.startsWith\('\/share\/'\)/);
});

test('Cloudflare release build runs the project verification gate', () => {
  assert.equal(pkg.scripts.verify, 'npm run lint && npm test && npm run build');
  assert.match(wrangler, /\[build\][\s\S]*command = "npm run verify"/);
});

test('preview configuration stays isolated from production storage bindings', () => {
  assert.match(wrangler, /previews = \{ \}/);
});
