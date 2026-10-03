import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync(new URL('../worker/categoryIntegrityRouter.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/categoryIntegrityBootstrap.ts', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('deleted categories are scrubbed from persisted tracks exactly once', () => {
  assert.match(router, /CATEGORY_INTEGRITY_MIGRATION = 'category-integrity-v57'/);
  assert.match(router, /SELECT id, categories FROM tracks/);
  assert.match(router, /filter\(name => allowedSet\.has\(name\)\)/);
  assert.match(router, /UPDATE tracks SET categories = \? WHERE id = \?/);
  assert.match(router, /INSERT OR IGNORE INTO app_migrations/);
});

test('future track writes can only persist live category names', () => {
  assert.match(router, /liveCategories\(env\.DB\)/);
  assert.match(router, /body\.categories = sanitizeCategories\(body\.categories, allowed\)/);
  assert.match(router, /return allowedSet\.has\('未分類'\) \? \['未分類'\] : \[\]/);
  assert.match(wrangler, /main = "worker\/categoryIntegrityRouter\.ts"/);
});

test('browser startup reconciles stale home cache before React mounts', () => {
  assert.match(bootstrap, /HOME_CACHE_KEY = 'echostars_home_cache_v3_3'/);
  assert.match(bootstrap, /cached\.savedAt = 0/);
  assert.match(bootstrap, /sanitizeTrackCategories/);
  assert.match(bootstrap, /await refreshLiveCategories\(\)/);
  assert.match(bootstrap, /await import\('\.\/main'\)/);
  assert.match(index, /categoryIntegrityBootstrap\.ts/);
  assert.doesNotMatch(index, /<script type="module" src="\/src\/main\.tsx"><\/script>/);
});

test('client track writes are also sanitized against the latest category list', () => {
  assert.match(bootstrap, /rewriteTrackWrite/);
  assert.match(bootstrap, /body\.categories = sanitizeTrackCategories\(body\.categories\)/);
  assert.match(bootstrap, /pathname\.startsWith\('\/api\/categories'\)/);
});

test('PWA shell cache advances for category integrity release', () => {
  assert.match(sw, /echostars-shell-v57/);
});
