import appWorker from './sessionCookieRouter';
import type { Env } from './index';

const CATEGORY_INTEGRITY_MIGRATION = 'category-integrity-v71';
const initialized = new WeakMap<object, Promise<void>>();

function parseCategories(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map(item => String(item || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

async function liveCategories(db: any): Promise<string[]> {
  const { results } = await db.prepare(
    'SELECT name FROM categories ORDER BY createdAt ASC, rowid ASC'
  ).all();
  return (results || [])
    .map((row: any) => String(row?.name || '').trim())
    .filter(Boolean);
}

function sanitizeCategories(input: unknown, allowed: string[]): string[] {
  const allowedSet = new Set(allowed);
  return [...new Set(parseCategories(input))]
    .filter(name => allowedSet.has(name))
    .slice(0, 3);
}

async function ensureCategoryIntegrity(db: any) {
  if (!db) return;
  const key = db as object;
  if (!initialized.has(key)) {
    const task = (async () => {
      await db.prepare('CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY)').run();
      const migrated = await db.prepare('SELECT name FROM app_migrations WHERE name = ?')
        .bind(CATEGORY_INTEGRITY_MIGRATION)
        .first();
      if (migrated) return;

      // The categories table is the only source of truth. This one-time v71
      // reconciliation safely removes stale/deleted category names from old
      // track rows. A track with no valid category stays as an empty array.
      const allowed = await liveCategories(db);
      const { results: rows } = await db.prepare('SELECT id, categories FROM tracks').all();
      const statements: any[] = [];

      for (const row of rows || []) {
        const before = parseCategories((row as any).categories);
        const after = sanitizeCategories(before, allowed);
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          statements.push(
            db.prepare('UPDATE tracks SET categories = ? WHERE id = ?')
              .bind(JSON.stringify(after), (row as any).id)
          );
        }
      }

      statements.push(
        db.prepare('INSERT OR IGNORE INTO app_migrations(name) VALUES (?)')
          .bind(CATEGORY_INTEGRITY_MIGRATION)
      );
      await db.batch(statements);
    })();
    initialized.set(key, task);
    task.catch(() => initialized.delete(key));
  }
  await initialized.get(key);
}

async function sanitizeTrackWrite(request: Request, env: Env): Promise<Request> {
  if (!env.DB) return request;

  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const isCreate = url.pathname === '/api/tracks' && method === 'POST';
  const isUpdate = /^\/api\/tracks\/[^/]+$/.test(url.pathname) && method === 'PUT';
  if (!isCreate && !isUpdate) return request;
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return request;

  const body: any = await request.clone().json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return request;

  const hasCategories = Object.prototype.hasOwnProperty.call(body, 'categories');
  if (!isCreate && !hasCategories) return request;

  const allowed = await liveCategories(env.DB);
  body.categories = sanitizeCategories(body.categories, allowed);

  const headers = new Headers(request.headers);
  headers.set('Content-Type', 'application/json');
  headers.delete('Content-Length');
  return new Request(request, {
    headers,
    body: JSON.stringify(body)
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const categoryOrTrackRequest =
      url.pathname.startsWith('/api/categories') ||
      url.pathname === '/api/tracks' ||
      /^\/api\/tracks\/[^/]+$/.test(url.pathname);

    if (env.DB && categoryOrTrackRequest) {
      try {
        await ensureCategoryIntegrity(env.DB);
      } catch (error) {
        console.warn('Category integrity migration failed:', error);
      }
    }

    const nextRequest =
      method === 'POST' || method === 'PUT'
        ? await sanitizeTrackWrite(request, env)
        : request;

    return appWorker.fetch(nextRequest, env);
  }
};
