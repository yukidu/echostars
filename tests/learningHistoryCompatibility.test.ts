import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routerSource = readFileSync(new URL('../worker/learningCardRouter.ts', import.meta.url), 'utf8');

test('learning history matches legacy identities stored only in playback key', () => {
  assert.match(routerSource, /function playbackIdentityFilter/);
  assert.match(routerSource, /LOWER\(TRIM\(userIdentifier\)\) = \?/);
  assert.match(routerSource, /LOWER\(SUBSTR\(TRIM\(key\), 1, LENGTH\(\?\) \+ 1\)\) = \?/);
  assert.match(routerSource, /bindings\.push\(alias, alias, `\$\{alias\}_`\)/);
});

test('canonical history and history deletion use the same legacy-compatible filter', () => {
  const uses = routerSource.match(/playbackIdentityFilter\(aliases\)/g) || [];
  assert.ok(uses.length >= 2, 'history reads and deletes must use the same identity compatibility filter');
  assert.match(routerSource, /SELECT \* FROM playback_memories[\s\S]*WHERE \$\{filter\.where\}/);
  assert.match(routerSource, /DELETE FROM playback_memories WHERE \$\{filter\.where\}/);
});
