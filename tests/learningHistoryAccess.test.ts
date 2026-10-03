import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideLearningHistoryScope,
  decidePublicLearningHistoryTarget,
  learningIdentityAliases
} from '../shared/learningHistoryAccess';

const admin = {
  id: 'u-admin',
  email: 'yukidu@gmail.com',
  role: '超級管理員'
};

const memberA = { id: 'u-a', email: 'a@example.com', role: '會員' };
const memberB = { id: 'u-b', email: 'b@example.com', role: '會員' };
const memberC = { id: 'u-c', email: 'c@example.com', role: '會員' };

test('public visitor viewing B and C resolves each selected member aliases', () => {
  const scopeB = decidePublicLearningHistoryTarget('b@example.com', memberB);
  const scopeC = decidePublicLearningHistoryTarget('c@example.com', memberC);
  assert.equal(scopeB.ok, true);
  assert.equal(scopeC.ok, true);
  if (!scopeB.ok || !scopeC.ok) return;

  assert.deepEqual(scopeB.aliases, ['b@example.com', 'u-b']);
  assert.deepEqual(scopeC.aliases, ['c@example.com', 'u-c']);
  assert.notDeepEqual(scopeB.aliases, scopeC.aliases);
  assert.notDeepEqual(scopeB.aliases, learningIdentityAliases(admin));
});

test('public member lookup may use member id and still resolves email plus id', () => {
  const scope = decidePublicLearningHistoryTarget('u-b', memberB);
  assert.equal(scope.ok, true);
  if (!scope.ok) return;
  assert.deepEqual(scope.aliases, ['b@example.com', 'u-b']);
});

test('public lookup rejects a missing or mismatched target', () => {
  const missing = decidePublicLearningHistoryTarget('b@example.com', null);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);

  const mismatched = decidePublicLearningHistoryTarget('c@example.com', memberB);
  assert.equal(mismatched.ok, false);
  if (!mismatched.ok) assert.equal(mismatched.status, 404);
});

test('authenticated self-service scope still resolves only the actor for destructive actions', () => {
  const scope = decideLearningHistoryScope(memberA, 'a@example.com', null, false);
  assert.equal(scope.ok, true);
  if (!scope.ok) return;
  assert.deepEqual(scope.aliases, ['a@example.com', 'u-a']);
  assert.equal(scope.isOwn, true);
});

test('administrator cannot clear another member history through the self-service delete route', () => {
  const scope = decideLearningHistoryScope(admin, 'b@example.com', memberB, false);
  assert.equal(scope.ok, false);
  if (scope.ok) return;
  assert.equal(scope.status, 403);
});
