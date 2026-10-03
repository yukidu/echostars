import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authRouter = readFileSync(new URL('../worker/authRouter.ts', import.meta.url), 'utf8');
const learningRouter = readFileSync(new URL('../worker/learningCardRouter.ts', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../src/googleIdentityBridge.ts', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/components/ProfileModal.tsx', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Google identity is verified server-side instead of trusting a submitted email', () => {
  assert.match(authRouter, /jwtVerify\(credential, GOOGLE_JWKS/);
  assert.match(authRouter, /audience:\s*GOOGLE_CLIENT_ID/);
  assert.match(authRouter, /issuer:\s*\['https:\/\/accounts\.google\.com', 'accounts\.google\.com'\]/);
  assert.match(authRouter, /payload\.email_verified !== true/);
  assert.match(authRouter, /path === '\/api\/users\/google-sync'/);
  assert.match(authRouter, /String\(body\.credential \|\| ''\)/);
  assert.doesNotMatch(authRouter, /const email = body\.email/);
});

test('super admin is anchored to the single verified Google email', () => {
  assert.match(authRouter, /SUPER_ADMIN_EMAIL = 'yukidu@gmail\.com'/);
  assert.match(authRouter, /normalizeEmail\(user\?\.email\) === SUPER_ADMIN_EMAIL/);
});

test('browser uses Google Identity Services credential flow and authenticated API sessions', () => {
  assert.match(bridge, /google\.accounts\.id\.initialize/);
  assert.match(bridge, /google\.accounts\.id\.renderButton/);
  assert.match(bridge, /JSON\.stringify\(\{ credential \}\)/);
  assert.match(bridge, /headers\.set\('Authorization', `Bearer \$\{token\}`\)/);
  assert.doesNotMatch(bridge, /initTokenClient/);
  assert.match(profile, /initTokenClient/); // legacy UI code remains unreachable behind the migration bridge
});

test('sensitive write routes bind identity to the verified session', () => {
  assert.match(authRouter, /uploaderEmail:\s*user\.email/);
  assert.match(authRouter, /uploaderId:\s*user\.id/);
  assert.match(authRouter, /actorEmail:\s*user\.email/);
  assert.match(authRouter, /userEmail:\s*user\.email/);
  assert.match(authRouter, /只有超級管理員可執行此操作/);
});

test('learning-card wrapper remains outside the secure auth router and Google bridge loads before React', () => {
  assert.match(wrangler, /main = "worker\/learningCardRouter\.ts"/);
  assert.match(learningRouter, /import authWorker from '\.\/authRouter'/);
  assert.match(learningRouter, /return authWorker\.fetch\(request, env\)/);
  const bridgeIndex = index.indexOf('/src/googleIdentityBridge.ts');
  const mainIndex = index.indexOf('/src/main.tsx');
  assert.ok(bridgeIndex >= 0 && mainIndex > bridgeIndex);
});

test('no Google OAuth client secret is embedded in the auth implementation', () => {
  assert.doesNotMatch(authRouter, /client[_-]?secret/i);
  assert.doesNotMatch(learningRouter, /client[_-]?secret/i);
  assert.doesNotMatch(bridge, /client[_-]?secret/i);
});
