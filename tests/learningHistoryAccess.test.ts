import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideLearningHistoryScope,
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

test('member viewing self resolves only that member aliases', () => {
  const scope = decideLearningHistoryScope(memberA, 'a@example.com');
  assert.equal(scope.ok, true);
  if (!scope.ok) return;
  assert.deepEqual(scope.aliases, ['a@example.com', 'u-a']);
  assert.equal(scope.isOwn, true);
});

test('admin viewing B and C resolves different target aliases instead of admin aliases', () => {
  const scopeB = decideLearningHistoryScope(admin, 'b@example.com', memberB);
  const scopeC = decideLearningHistoryScope(admin, 'c@example.com', memberC);
  assert.equal(scopeB.ok, true);
  assert.equal(scopeC.ok, true);
  if (!scopeB.ok || !scopeC.ok) return;

  assert.deepEqual(scopeB.aliases, ['b@example.com', 'u-b']);
  assert.deepEqual(scopeC.aliases, ['c@example.com', 'u-c']);
  assert.notDeepEqual(scopeB.aliases, scopeC.aliases);
  assert.notDeepEqual(scopeB.aliases, learningIdentityAliases(admin));
  assert.notDeepEqual(scopeC.aliases, learningIdentityAliases(admin));
  assert.equal(scopeB.isOwn, false);
  assert.equal(scopeC.isOwn, false);
});

test('ordinary member cannot query another member even when target exists', () => {
  const scope = decideLearningHistoryScope(memberA, 'b@example.com', memberB);
  assert.equal(scope.ok, false);
  if (scope.ok) return;
  assert.equal(scope.status, 403);
});

test('administrator cannot clear another member history through the self-service delete route', () => {
  const scope = decideLearningHistoryScope(admin, 'b@example.com', memberB, false);
  assert.equal(scope.ok, false);
  if (scope.ok) return;
  assert.equal(scope.status, 403);
});

test('requested id may be member id and still resolves the same target aliases', () => {
  const scope = decideLearningHistoryScope(admin, 'u-b', memberB);
  assert.equal(scope.ok, true);
  if (!scope.ok) return;
  assert.deepEqual(scope.aliases, ['b@example.com', 'u-b']);
});
