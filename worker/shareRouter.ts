import { pinyin } from 'pinyin-pro';
import appWorker, { type Env } from './index';
import { shareMetadata } from '../shared/shareMetadata';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*'
};

const schemaReady = new WeakMap<object, Promise<void>>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function ensureShareSchema(db: any) {
  if (!db) return;
  const key = db as object;
  if (!schemaReady.has(key)) {
    const promise = (async () => {
      const { results } = await db.prepare('PRAGMA table_info(tracks)').all();
      if (!results?.length) throw new Error('Missing database table: tracks');
      if (!results.some((row: any) => row.name === 'shareSlug')) {
        try {
          await db.prepare('ALTER TABLE tracks ADD COLUMN shareSlug TEXT').run();
        } catch (error) {
          const check = await db.prepare('PRAGMA table_info(tracks)').all();
          if (!check.results.some((row: any) => row.name === 'shareSlug')) throw error;
        }
      }
      await db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS tracks_share_slug_unique
        ON tracks(shareSlug)
        WHERE shareSlug IS NOT NULL AND shareSlug <> ''
      `).run();
    })();
    schemaReady.set(key, promise);
    promise.catch(() => schemaReady.delete(key));
  }
  await schemaReady.get(key);
}

export function romanizeSpeakerName(name: string) {
  const source = String(name || '').trim();
  if (!source) return 'SPEAKER';

  const syllables = pinyin(source, {
    toneType: 'none',
    type: 'array',
    surname: 'head',
    traditional: true,
    nonZh: 'consecutive',
    v: false
  }) as string[];

  const tokens = syllables.flatMap(part =>
    String(part)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ü/gi, 'u')
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean)
  );

  return tokens.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'SPEAKER';
}

async function assignShareSlug(db: any, trackId: string) {
  await ensureShareSchema(db);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const track: any = await db.prepare(
      'SELECT id, speaker, shareSlug FROM tracks WHERE id = ?'
    ).bind(trackId).first();
    if (!track) return { error: '音檔不存在', status: 404 } as const;
    if (String(track.shareSlug || '').trim()) {
      return { shareSlug: String(track.shareSlug).trim() } as const;
    }

    const base = romanizeSpeakerName(track.speaker || 'SPEAKER');
    const { results } = await db.prepare(
      'SELECT shareSlug FROM tracks WHERE shareSlug LIKE ?'
    ).bind(`${base}-%`).all();
    const used = new Set<number>();
    for (const row of results || []) {
      const match = String((row as any).shareSlug || '').match(new RegExp(`^${base}-(\\d{3})$`));
      if (match) used.add(Number(match[1]));
    }

    let sequence = 1;
    while (used.has(sequence)) sequence += 1;
    if (sequence > 999) return { error: '此講者分享序號已達 999 筆上限', status: 409 } as const;
    const shareSlug = `${base}-${String(sequence).padStart(3, '0')}`;

    try {
      await db.prepare(`
        UPDATE tracks
        SET shareSlug = ?
        WHERE id = ? AND (shareSlug IS NULL OR TRIM(shareSlug) = '')
      `).bind(shareSlug, trackId).run();
      const saved: any = await db.prepare('SELECT shareSlug FROM tracks WHERE id = ?').bind(trackId).first();
      if (String(saved?.shareSlug || '').trim()) return { shareSlug: String(saved.shareSlug).trim() } as const;
    } catch (error) {
      const message = String((error as Error)?.message || error || '');
      if (/unique|constraint/i.test(message)) continue;
      throw error;
    }
  }

  return { error: '分享序號建立失敗，請重試', status: 409 } as const;
}

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function serveSharePage(request: Request, env: Env, slug: string) {
  if (!env.DB) return new Response('分享服務暫時無法使用', { status: 503 });
  await ensureShareSchema(env.DB);
  const track: any = await env.DB.prepare(
    'SELECT id, title, speaker, speakerAvatar, shareSlug FROM tracks WHERE shareSlug = ?'
  ).bind(slug).first();
  if (!track) return new Response('分享連結不存在', { status: 404 });
  if (!env.ASSETS) return new Response('網站建置未完成', { status: 503 });

  const url = new URL(request.url);
  const shellRequest = new Request(new URL('/index.html', url.origin), {
    method: 'GET',
    headers: { Accept: 'text/html' }
  });
  const shell = await env.ASSETS.fetch(shellRequest);
  if (!shell.ok) return new Response('網站建置未完成', { status: 503 });

  const metadataHtml = shareMetadata(await shell.text(), track, url.origin, slug);
  const html = metadataHtml.replace(
    '</head>',
    `<meta name="echostars-share-track" content="${escapeAttribute(String(track.id))}"></head>`
  );
  const headers = new Headers(shell.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=60');
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.delete('Content-Encoding');
  return new Response(html, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    const slugApi = path.match(/^\/api\/tracks\/([^/]+)\/share-slug$/);
    if (slugApi) {
      if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
      try {
        const trackId = decodeURIComponent(slugApi[1]);
        const result = await assignShareSlug(env.DB, trackId);
        if ('error' in result) return json({ error: result.error }, result.status);
        return json({
          success: true,
          shareSlug: result.shareSlug,
          url: `${url.origin}/share/${result.shareSlug}`
        });
      } catch (error) {
        console.error('Share slug allocation failed:', error);
        return json({ error: '建立分享連結失敗' }, 500);
      }
    }

    if (path.startsWith('/share/') && method === 'GET') {
      const slug = decodeURIComponent(path.slice('/share/'.length)).trim();
      // Legacy /share/t-... links are intentionally retired. Only the new
      // uppercase passport-style name + three-digit sequence is accepted.
      if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/.test(slug)) {
        return new Response('分享連結不存在', { status: 404 });
      }
      try {
        return await serveSharePage(request, env, slug);
      } catch (error) {
        console.error('Share page failed:', error);
        return new Response('分享頁載入失敗', { status: 500 });
      }
    }

    return appWorker.fetch(request, env);
  }
};
