import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync(new URL('../worker/playbackOwnerRouter.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('playback memories use stable memberId ownership with legacy aliases kept only for recovery', () => {
  assert.match(schema, /memberId TEXT/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS playback_identity_aliases/);
  assert.match(router, /WHERE memberId = \? OR \$\{legacy\.where\}/);
  assert.match(router, /INSERT INTO playback_memories[\s\S]*memberId/);
});

test('public history resolves the selected member and is independent from the viewer session', () => {
  const section = router.match(/async function publicHistory[\s\S]*?\n}\n\nasync function resolveMemberForWrite/)?.[0] || '';
  assert.match(section, /resolveMember\(env\.DB, requestedId\)/);
  assert.match(section, /canonicalRecordsForMember\(env, member\)/);
  assert.doesNotMatch(section, /authenticatedUser\(/);
});

test('legacy device ownership is recovered only when one device maps to one member', () => {
  assert.match(router, /HAVING COUNT\(DISTINCT u\.id\) = 1/);
  assert.match(router, /NOT EXISTS \([\s\S]*other\.authorEmail[\s\S]*<> \?/);
});

test('backfill is non-destructive and only fills missing memberId', () => {
  assert.match(router, /UPDATE playback_memories[\s\S]*SET memberId =/);
  assert.match(router, /WHERE \(memberId IS NULL OR TRIM\(memberId\) = ''\)/);
  assert.doesNotMatch(router, /DELETE FROM playback_memories/);
});

test('future playback writes canonicalize registered email or id to users.id', () => {
  assert.match(router, /const direct = await resolveMember\(env\.DB, identifier\)/);
  assert.match(router, /const memberId = member\?\.id \? String\(member\.id\) : ''/);
  assert.match(router, /const key = `\$\{identifier\}_\$\{trackId\}`/);
});

test('worker entry point is the canonical playback owner router', () => {
  assert.match(wrangler, /main = "worker\/playbackOwnerRouter\.ts"/);
});
