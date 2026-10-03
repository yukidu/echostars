import appWorker from './playbackOwnerRouter';
import type { Env } from './index';

const SESSION_COOKIE = 'echostars_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{30,}$/;

function bearerToken(request: Request) {
  const match = request.headers.get('Authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]{30,})$/i);
  return match?.[1] || '';
}

function cookieToken(request: Request) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return TOKEN_PATTERN.test(value) ? value : '';
  }
  return '';
}

function sessionTokens(request: Request) {
  return [...new Set([bearerToken(request), cookieToken(request)].filter(Boolean))];
}

function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}; Priority=High`;
}

function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Priority=High`;
}

function requestWithCookieSession(request: Request) {
  if (bearerToken(request)) return request;
  const token = cookieToken(request);
  if (!token) return request;
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return new Request(request, { headers });
}

function withSetCookie(response: Response, cookie: string) {
  const headers = new Headers(response.headers);
  headers.set('Set-Cookie', cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function logout(request: Request, env: Env) {
  const tokens = sessionTokens(request);
  if (env.DB && tokens.length) {
    try {
      const hashes = await Promise.all(tokens.map(hashToken));
      await env.DB.batch(
        hashes.map(hash => env.DB.prepare('DELETE FROM auth_sessions WHERE tokenHash = ?').bind(hash))
      );
    } catch (error) {
      console.warn('Session logout cleanup failed:', error);
    }
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearedSessionCookie()
    }
  });
}

async function sessionResponse(request: Request, env: Env) {
  const token = bearerToken(request) || cookieToken(request);
  const delegated = requestWithCookieSession(request);
  const response = await appWorker.fetch(delegated, env);

  if (!response.ok || !token) {
    return response.ok ? response : withSetCookie(response, clearedSessionCookie());
  }

  const data: any = await response.clone().json().catch(() => null);
  if (!data || data.authenticated !== true || !data.user) {
    return withSetCookie(response, sessionCookie(token));
  }

  // The existing frontend already understands a bearer token stored with the
  // cached member. Returning the same verified first-party session token here
  // lets a browser context recovered from the HttpOnly cookie immediately join
  // the existing authenticated fetch path without introducing a second auth model.
  const body = JSON.stringify({ ...data, authToken: token });
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('Set-Cookie', sessionCookie(token));
  return new Response(body, { status: response.status, headers });
}

async function googleLoginResponse(request: Request, env: Env) {
  const response = await appWorker.fetch(request, env);
  if (!response.ok) return response;
  const data: any = await response.clone().json().catch(() => null);
  const token = String(data?.authToken || '');
  if (!TOKEN_PATTERN.test(token)) return response;
  return withSetCookie(response, sessionCookie(token));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (path === '/api/auth/logout' && method === 'POST') {
      return logout(request, env);
    }

    if (path === '/api/users/google-sync' && method === 'POST') {
      return googleLoginResponse(request, env);
    }

    if (path === '/api/auth/session' && method === 'GET') {
      return sessionResponse(request, env);
    }

    // Same-origin cookies are automatically attached by browsers. Convert the
    // cookie to the already-established Authorization contract before the
    // existing routers see the request. This keeps all current permission
    // checks unchanged while allowing session continuity beyond localStorage.
    return appWorker.fetch(requestWithCookieSession(request), env);
  }
};
