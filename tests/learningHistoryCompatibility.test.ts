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
  const uses = routerSource.match(/playbackIdentityFilter\(/g) || [];
  assert.ok(uses.length >= 3, 'filter definition, history read and delete path must all remain wired');
  assert.match(routerSource, /const filter = playbackIdentityFilter\(aliases\)[\s\S]*SELECT \* FROM playback_memories[\s\S]*WHERE \$\{filter\.where\}/);
  assert.match(routerSource, /const filter = playbackIdentityFilter\(scope\.aliases\)[\s\S]*DELETE FROM playback_memories WHERE \$\{filter\.where\}/);
});
