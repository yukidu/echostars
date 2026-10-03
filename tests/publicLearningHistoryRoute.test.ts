import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routerSource = readFileSync(new URL('../worker/learningCardRouter.ts', import.meta.url), 'utf8');

test('public GET history resolves the requested member and never the viewer session', () => {
  const historySection = routerSource.match(/async function historyResponse[\s\S]*?\n}\n\nasync function deleteHistory/)?.[0] || '';
  assert.match(historySection, /resolvePublicHistoryScope\(requestedId, env\)/);
  assert.doesNotMatch(historySection, /authenticatedUser\(/);
});

test('public resolver looks up the requested registered member by email or user id', () => {
  const resolverSection = routerSource.match(/async function resolvePublicHistoryScope[\s\S]*?\n}\n\nasync function resolveHistoryScope/)?.[0] || '';
  assert.match(resolverSection, /FROM users/);
  assert.match(resolverSection, /LOWER\(TRIM\(id\)\) = \? OR LOWER\(TRIM\(email\)\) = \?/);
  assert.match(resolverSection, /decidePublicLearningHistoryTarget\(requestedId, target\)/);
});
