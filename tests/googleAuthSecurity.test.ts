import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authRouter = readFileSync(new URL('../worker/authRouter.ts', import.meta.url), 'utf8');
const learningRouter = readFileSync(new URL('../worker/learningCardRouter.ts', import.meta.url), 'utf8');
const playbackRouter = readFileSync(new URL('../worker/playbackOwnerRouter.ts', import.meta.url), 'utf8');
const sessionCookieRouter = readFileSync(new URL('../worker/sessionCookieRouter.ts', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../src/googleIdentityBridge.ts', import.meta.url), 'utf8');
const recovery = readFileSync(new URL('../src/shareAuthRecovery.ts', import.meta.url), 'utf8');
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

test('first-party session cookie is secure and never placed in a share URL', () => {
  assert.match(sessionCookieRouter, /HttpOnly/);
  assert.match(sessionCookieRouter, /Secure/);
  assert.match(sessionCookieRouter, /SameSite=Lax/);
  assert.match(sessionCookieRouter, /SESSION_COOKIE = 'echostars_session'/);
  assert.match(sessionCookieRouter, /path === '\/api\/auth\/logout'/);
  assert.match(sessionCookieRouter, /requestWithCookieSession/);
  assert.doesNotMatch(recovery, /searchParams\.set\([^)]*(?:auth|token|session)/i);
  assert.doesNotMatch(recovery, /location\.href\s*=.*(?:authToken|session)/i);
});

test('share entry can restore a verified member session and only then falls back to Google', () => {
  assert.match(recovery, /originalFetch\('\/api\/auth\/session'/);
  assert.match(recovery, /credentials:\s*'include'/);
  assert.match(recovery, /storeRecoveredSession/);
  assert.match(recovery, /window\.location\.reload\(\)/);
  assert.match(recovery, /SHARE_PATH/);
  assert.match(recovery, /auto_select:\s*true/);
  assert.match(recovery, /identity\.prompt\(\)/);
  assert.match(recovery, /renderGoogleFallback/);
});

test('sensitive write routes bind identity to the verified session', () => {
  assert.match(authRouter, /uploaderEmail:\s*user\.email/);
  assert.match(authRouter, /uploaderId:\s*user\.id/);
  assert.match(authRouter, /actorEmail:\s*user\.email/);
  assert.match(authRouter, /userEmail:\s*user\.email/);
  assert.match(authRouter, /只有超級管理員可執行此操作/);
});

test('wrapper order preserves learning/auth security while adding cookie continuity', () => {
  assert.match(wrangler, /main = "worker\/sessionCookieRouter\.ts"/);
  assert.match(sessionCookieRouter, /import appWorker from '\.\/playbackOwnerRouter'/);
  assert.match(playbackRouter, /import learningWorker from '\.\/learningCardRouter'/);
  assert.match(learningRouter, /import authWorker from '\.\/authRouter'/);
  const recoveryIndex = index.indexOf('/src/shareAuthRecovery.ts');
  const bridgeIndex = index.indexOf('/src/googleIdentityBridge.ts');
  const mainIndex = index.indexOf('/src/main.tsx');
  assert.ok(recoveryIndex >= 0 && bridgeIndex > recoveryIndex && mainIndex > bridgeIndex);
});

test('no Google OAuth client secret is embedded in the auth implementation', () => {
  assert.doesNotMatch(authRouter, /client[_-]?secret/i);
  assert.doesNotMatch(learningRouter, /client[_-]?secret/i);
  assert.doesNotMatch(sessionCookieRouter, /client[_-]?secret/i);
  assert.doesNotMatch(bridge, /client[_-]?secret/i);
  assert.doesNotMatch(recovery, /client[_-]?secret/i);
});
