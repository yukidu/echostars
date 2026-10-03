import { createRemoteJWKSet, jwtVerify } from 'jose';
import appWorker from './shareRouter';
import type { Env } from './index';

const GOOGLE_CLIENT_ID = '400699489182-lb412nhvj4s6t1qr5ovkg40hc646dq79.apps.googleusercontent.com';
const SUPER_ADMIN_EMAIL = 'yukidu@gmail.com';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const authSchemaReady = new WeakMap<object, Promise<void>>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isSuperAdmin(user: any) {
  return normalizeEmail(user?.email) === SUPER_ADMIN_EMAIL;
}

function canUpload(user: any) {
  return isSuperAdmin(user) || Boolean(user?.canUpload) || Boolean(user?.isContributor);
}

async function ensureAuthSchema(db: any) {
  if (!db) return;
  const key = db as object;
  if (!authSchemaReady.has(key)) {
    const promise = (async () => {
      const { results } = await db.prepare('PRAGMA table_info(users)').all();
      if (!results?.length) throw new Error('Missing database table: users');
      if (!results.some((row: any) => row.name === 'googleSubject')) {
        try {
          await db.prepare('ALTER TABLE users ADD COLUMN googleSubject TEXT').run();
        } catch (error) {
          const check = await db.prepare('PRAGMA table_info(users)').all();
          if (!check.results.some((row: any) => row.name === 'googleSubject')) throw error;
        }
      }
      await db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_unique
        ON users(googleSubject)
        WHERE googleSubject IS NOT NULL AND googleSubject <> ''
      `).run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          tokenHash TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          expiresAt INTEGER NOT NULL,
          createdAt INTEGER NOT NULL
        )
      `).run();
      await db.prepare('CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(userId)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expiresAt)').run();
    })();
    authSchemaReady.set(key, promise);
    promise.catch(() => authSchemaReady.delete(key));
  }
  await authSchemaReady.get(key);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function createSession(db: any, userId: string) {
  await ensureAuthSchema(db);
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = bytesToBase64Url(raw);
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db.batch([
    db.prepare('DELETE FROM auth_sessions WHERE expiresAt <= ?').bind(now),
    db.prepare('INSERT INTO auth_sessions (tokenHash, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)')
      .bind(tokenHash, userId, expiresAt, now)
  ]);
  return { token, expiresAt };
}

async function sessionUser(request: Request, env: Env) {
  if (!env.DB) return null;
  const match = request.headers.get('Authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]{30,})$/i);
  if (!match) return null;
  await ensureAuthSchema(env.DB);
  const tokenHash = await hashToken(match[1]);
  const row: any = await env.DB.prepare(`
    SELECT u.*, s.expiresAt AS __sessionExpiresAt
    FROM auth_sessions s
    JOIN users u ON u.id = s.userId
    WHERE s.tokenHash = ?
    LIMIT 1
  `).bind(tokenHash).first();
  if (!row) return null;
  if (Number(row.__sessionExpiresAt || 0) <= Date.now()) {
    await env.DB.prepare('DELETE FROM auth_sessions WHERE tokenHash = ?').bind(tokenHash).run().catch(() => undefined);
    return null;
  }
  if (row.isBlocked) return null;
  return row;
}

async function verifyGoogleCredential(credential: string) {
  if (!credential || credential.split('.').length !== 3) throw new Error('缺少 Google 身分憑證');
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    audience: GOOGLE_CLIENT_ID,
    issuer: ['https://accounts.google.com', 'accounts.google.com']
  });
  const email = normalizeEmail(payload.email);
  const subject = String(payload.sub || '').trim();
  if (!email || !subject || payload.email_verified !== true) {
    throw new Error('Google 帳號尚未完成 Email 驗證');
  }
  return {
    email,
    subject,
    name: String(payload.name || email.split('@')[0]),
    avatar: String(payload.picture || '')
  };
}

function jsonRequest(request: Request, body: unknown, urlOverride?: URL) {
  const headers = new Headers(request.headers);
  headers.set('Content-Type', 'application/json');
  headers.delete('Content-Length');
  return new Request(urlOverride || request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(body)
  });
}

async function requestBody(request: Request) {
  return request.clone().json().catch(() => ({} as any)) as Promise<any>;
}

async function handleGoogleLogin(request: Request, env: Env) {
  if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
  try {
    const body = await requestBody(request);
    const identity = await verifyGoogleCredential(String(body.credential || ''));
    await ensureAuthSchema(env.DB);

    const subjectOwner: any = await env.DB.prepare(
      'SELECT id, email FROM users WHERE googleSubject = ? LIMIT 1'
    ).bind(identity.subject).first();
    if (subjectOwner && normalizeEmail(subjectOwner.email) !== identity.email) {
      return json({ error: '此 Google 帳號的 Email 已變更，請聯絡管理員重新綁定。' }, 409);
    }

    const emailOwner: any = await env.DB.prepare(
      'SELECT id, googleSubject FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1'
    ).bind(identity.email).first();
    if (emailOwner?.googleSubject && String(emailOwner.googleSubject) !== identity.subject) {
      return json({ error: '此 Email 已綁定另一個 Google 帳號。' }, 409);
    }

    const verifiedRequest = new Request(new URL('/api/users/google-sync', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: identity.email,
        name: identity.name,
        avatar: identity.avatar
      })
    });
    const response = await appWorker.fetch(verifiedRequest, env);
    const data: any = await response.clone().json().catch(() => ({}));
    if (!response.ok || !data?.user?.id) return response;

    await env.DB.prepare(
      'UPDATE users SET googleSubject = ? WHERE id = ? AND (googleSubject IS NULL OR googleSubject = ? OR googleSubject = \'\')'
    ).bind(identity.subject, data.user.id, identity.subject).run();

    const saved: any = await env.DB.prepare('SELECT googleSubject FROM users WHERE id = ?').bind(data.user.id).first();
    if (String(saved?.googleSubject || '') !== identity.subject) {
      return json({ error: 'Google 帳號綁定衝突，請聯絡管理員。' }, 409);
    }

    const session = await createSession(env.DB, data.user.id);
    return json({
      ...data,
      authToken: session.token,
      sessionExpiresAt: session.expiresAt
    });
  } catch (error) {
    console.warn('Google credential verification failed:', error);
    return json({ error: 'Google 登入驗證失敗，請重新選擇 Google 帳號。' }, 401);
  }
}

function protectedRoute(path: string, method: string) {
  if (method === 'POST' && path === '/api/r2/upload') return true;
  if (path === '/api/tracks' && method === 'POST') return true;
  if (/^\/api\/tracks\/[^/]+$/.test(path) && method === 'PUT') return true;
  if (/^\/api\/tracks\/[^/]+\/vip-share(?:\/reset)?$/.test(path) && method === 'POST') return true;
  if (/^\/api\/users\/[^/]+$/.test(path) && method === 'PUT') return true;
  if (/^\/api\/users\/[^/]+\/(?:contributor|admin-role|block|audit-rank)$/.test(path) && method === 'PUT') return true;
  if (path === '/api/admin/users/batch' && method === 'PUT') return true;
  if (/^\/api\/keywords(?:\/|$)/.test(path) && method !== 'GET') return true;
  if (path === '/api/categories/order' && method === 'PUT') return true;
  return false;
}

async function authorizeAndRewrite(request: Request, env: Env, user: any) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === '/api/admin/users/batch' || /^\/api\/users\/[^/]+\/(?:contributor|admin-role|block)$/.test(path) || /^\/api\/keywords\/(?:rename|delete)$/.test(path) || path === '/api/categories/order') {
    if (!isSuperAdmin(user)) return json({ error: '只有超級管理員可執行此操作' }, 403);
  }

  if (/^\/api\/users\/[^/]+\/audit-rank$/.test(path)) {
    const mayAudit = isSuperAdmin(user) || Boolean(user.isAdminUser) || user.role === '獎銜審核員' || user.role === '管理員';
    if (!mayAudit) return json({ error: '沒有獎銜審核權限' }, 403);
  }

  if ((path === '/api/r2/upload' && method === 'POST') || (path === '/api/tracks' && method === 'POST')) {
    if (!canUpload(user)) return json({ error: '沒有上傳音檔權限' }, 403);
    return request;
  }

  const trackWrite = path.match(/^\/api\/tracks\/([^/]+)$/);
  if (trackWrite && method === 'PUT') {
    if (!canUpload(user)) return json({ error: '沒有修改音檔權限' }, 403);
    if (!isSuperAdmin(user) && env.DB) {
      const track: any = await env.DB.prepare('SELECT uploaderEmail FROM tracks WHERE id = ?')
        .bind(decodeURIComponent(trackWrite[1])).first();
      if (!track || normalizeEmail(track.uploaderEmail) !== normalizeEmail(user.email)) {
        return json({ error: '只能修改自己上傳的音檔' }, 403);
      }
    }
    const body = await requestBody(request);
    return jsonRequest(request, { ...body, userEmail: user.email, uploaderEmail: body.uploaderEmail || user.email });
  }

  const userWrite = path.match(/^\/api\/users\/([^/]+)$/);
  if (userWrite && method === 'PUT') {
    const targetId = decodeURIComponent(userWrite[1]);
    if (!isSuperAdmin(user) && targetId !== String(user.id)) return json({ error: '只能修改自己的基本資料' }, 403);
    const body = await requestBody(request);
    if (isSuperAdmin(user)) return jsonRequest(request, body);

    const safeKeys = new Set([
      'name', 'avatar', 'phone', 'amwayId', 'center', 'rank', 'joinReason', 'stayReason',
      'sponsor', 'platinumUpline', 'diamondUpline', 'birthDate', 'birthday', 'notes',
      'residence', 'zodiac', 'talentNumber', 'lifeNumber', 'profileEditCount', 'profileEditMonth',
      'avatarUploadCount', 'avatarUploadMonth', 'rankUpdatedAt'
    ]);
    const safe: any = {};
    for (const [key, value] of Object.entries(body || {})) if (safeKeys.has(key)) safe[key] = value;

    if (safe.rank !== undefined && String(safe.rank) !== String(user.rank || '')) {
      safe.rankAuditStatus = 'pending';
      safe.rankApproved = false;
      safe.rankAuditType = user.rank ? 'rank_change' : 'new_register';
      safe.rankUpdatedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    }
    return jsonRequest(request, safe);
  }

  if (/^\/api\/tracks\/[^/]+\/vip-share(?:\/reset)?$/.test(path) && method === 'POST') {
    const body = await requestBody(request);
    return jsonRequest(request, { ...body, userEmail: user.email });
  }

  if (/^\/api\/users\/[^/]+\/(?:contributor|admin-role|block|audit-rank)$/.test(path) && method === 'PUT') {
    const body = await requestBody(request);
    return jsonRequest(request, { ...body, actorEmail: user.email, userEmail: user.email });
  }

  if (path === '/api/admin/users/batch' && method === 'PUT') {
    const body = await requestBody(request);
    return jsonRequest(request, { ...body, actorEmail: user.email });
  }

  if (/^\/api\/keywords(?:\/|$)/.test(path) && method !== 'GET') {
    if (method === 'DELETE') {
      url.searchParams.set('userEmail', user.email);
      url.searchParams.set('userId', user.id);
      const body = await requestBody(request);
      return jsonRequest(request, { ...body, userEmail: user.email, userId: user.id }, url);
    }
    const body = await requestBody(request);
    return jsonRequest(request, { ...body, userEmail: user.email, userId: user.id });
  }

  return request;
}

async function sanitizeCommentIdentity(request: Request, env: Env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const commentPost = (url.pathname === '/api/comments' || /^\/api\/tracks\/[^/]+\/comments$/.test(url.pathname)) && method === 'POST';
  const commentWrite = /^\/api\/comments\/[^/]+$/.test(url.pathname) && ['PUT', 'DELETE'].includes(method);
  if (!commentPost && !commentWrite) return request;

  const body = await requestBody(request);
  const user = await sessionUser(request, env);
  if (commentPost) {
    if (user) {
      return jsonRequest(request, {
        ...body,
        authorEmail: user.email,
        authorName: user.name || body.authorName || '會員',
        authorAvatar: user.avatar || body.authorAvatar || '👤',
        isAdmin: isSuperAdmin(user) || Boolean(user.isAdminUser) || user.role === '管理員'
      });
    }
    return jsonRequest(request, { ...body, authorEmail: '', isAdmin: false });
  }

  if (String(body.userEmail || '').trim()) {
    if (!user) return json({ error: '登入已過期，請重新使用 Google 登入' }, 401);
    return jsonRequest(request, { ...body, userEmail: user.email });
  }
  return request;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (path === '/api/users/google-sync' && method === 'POST') {
      return handleGoogleLogin(request, env);
    }

    if (path === '/api/auth/session' && method === 'GET') {
      const user = await sessionUser(request, env);
      if (!user) return json({ authenticated: false }, 401);
      const { __sessionExpiresAt, googleSubject, ...publicUser } = user;
      return json({ authenticated: true, user: publicUser, sessionExpiresAt: __sessionExpiresAt });
    }

    let nextRequest = request;
    if (protectedRoute(path, method)) {
      const user = await sessionUser(request, env);
      if (!user) return json({ error: '登入已過期，請重新使用 Google 登入' }, 401);
      const authorized = await authorizeAndRewrite(request, env, user);
      if (authorized instanceof Response) return authorized;
      nextRequest = authorized;
    } else {
      const sanitized = await sanitizeCommentIdentity(request, env);
      if (sanitized instanceof Response) return sanitized;
      nextRequest = sanitized;
    }

    return appWorker.fetch(nextRequest, env);
  }
};
