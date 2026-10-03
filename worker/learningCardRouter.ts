import authWorker from './authRouter';
import type { Env } from './index';

const learningSchemaReady = new WeakMap<object, Promise<void>>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function ensureLearningSchema(db: any) {
  if (!db) return;
  const key = db as object;
  if (!learningSchemaReady.has(key)) {
    const promise = (async () => {
      const { results } = await db.prepare('PRAGMA table_info(playback_memories)').all();
      if (results?.length && !results.some((row: any) => row.name === 'firstListenDate')) {
        try {
          await db.prepare('ALTER TABLE playback_memories ADD COLUMN firstListenDate TEXT').run();
        } catch (error) {
          const check = await db.prepare('PRAGMA table_info(playback_memories)').all();
          if (!check.results.some((row: any) => row.name === 'firstListenDate')) throw error;
        }
      }

      // Legacy rows never stored a first-listen date. The true historic first
      // timestamp cannot be reconstructed, so use the oldest date that was
      // actually persisted on that row instead of continuing to export blanks.
      await db.prepare(`
        UPDATE playback_memories
        SET firstListenDate = COALESCE(NULLIF(firstListenDate, ''), NULLIF(lastListenDate, ''), NULLIF(finishDate, ''))
        WHERE firstListenDate IS NULL OR TRIM(firstListenDate) = ''
      `).run();

      // The existing playback UPSERT does not mention firstListenDate. This
      // trigger fills it exactly once on the first INSERT; later progress writes
      // never overwrite it.
      await db.prepare(`
        CREATE TRIGGER IF NOT EXISTS playback_first_listen_date
        AFTER INSERT ON playback_memories
        WHEN NEW.firstListenDate IS NULL OR TRIM(NEW.firstListenDate) = ''
        BEGIN
          UPDATE playback_memories
          SET firstListenDate = REPLACE(DATE('now', '+8 hours'), '-', '/')
          WHERE key = NEW.key;
        END
      `).run();

      await db.prepare(`
        CREATE TABLE IF NOT EXISTS share_events (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          userEmail TEXT NOT NULL,
          trackId TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        )
      `).run();
      await db.prepare('CREATE INDEX IF NOT EXISTS share_events_user ON share_events(userId, userEmail)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS share_events_created ON share_events(createdAt)').run();
    })();
    learningSchemaReady.set(key, promise);
    promise.catch(() => learningSchemaReady.delete(key));
  }
  await learningSchemaReady.get(key);
}

async function authenticatedUser(request: Request, env: Env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization) return null;
  const response = await authWorker.fetch(new Request(new URL('/api/auth/session', request.url), {
    method: 'GET',
    headers: { Authorization: authorization }
  }), env);
  if (!response.ok) return null;
  const data: any = await response.json().catch(() => ({}));
  return data?.user || null;
}

function playbackWhere() {
  return `(userIdentifier = ? OR userIdentifier = ? OR key LIKE ? OR key LIKE ?)`;
}

function playbackBindings(user: any) {
  const email = String(user?.email || '').trim().toLowerCase();
  const id = String(user?.id || '').trim();
  return [email, id, `${email}_%`, `${id}_%`];
}

async function historyResponse(id: string, env: Env) {
  if (!env.DB || !id) return json({});
  await ensureLearningSchema(env.DB);
  const { results } = await env.DB.prepare(`
    SELECT * FROM playback_memories
    WHERE userIdentifier = ? OR key LIKE ?
    ORDER BY COALESCE(lastPlayedAt, 0) DESC
  `).bind(id, `${id}_%`).all();

  const recordsMap: Record<string, any> = {};
  for (const row of results || []) {
    const r: any = row;
    recordsMap[String(r.trackId)] = {
      trackId: r.trackId,
      userIdOrDeviceId: r.userIdentifier,
      firstListenDate: r.firstListenDate || r.lastListenDate || r.finishDate || '',
      lastListenDate: r.lastListenDate || '',
      finishDate: r.finishDate || undefined,
      progressPercent: Number(r.progressPercent) || 0,
      completed: Boolean(r.completed) || Number(r.progressPercent) >= 95,
      currentTime: Number(r.currentTime) || 0,
      duration: Number(r.duration) || 0,
      clickCount: 1,
      isDeleted: Boolean(r.isDeleted),
      trackTitle: r.trackTitle || '',
      trackSpeaker: r.trackSpeaker || '',
      trackSpeakerRank: r.trackSpeakerRank || '',
      updatedAt: Number(r.lastPlayedAt) || 0
    };
  }
  return json(recordsMap);
}

async function memberStats(request: Request, env: Env) {
  if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
  const user = await authenticatedUser(request, env);
  if (!user) return json({ error: '請先登入會員' }, 401);
  await ensureLearningSchema(env.DB);

  const bindings = playbackBindings(user);
  const playback: any = await env.DB.prepare(`
    SELECT
      COUNT(*) AS totalCount,
      SUM(CASE WHEN completed = 1 OR progressPercent >= 95 THEN 1 ELSE 0 END) AS completedCount,
      SUM(CASE WHEN completed = 1 OR progressPercent >= 95 THEN 0 ELSE 1 END) AS unfinishedCount,
      SUM(CASE
        WHEN currentTime IS NULL OR currentTime < 0 THEN 0
        WHEN duration IS NOT NULL AND duration > 0 AND currentTime > duration THEN duration
        ELSE currentTime
      END) AS listenedSeconds
    FROM playback_memories
    WHERE ${playbackWhere()}
  `).bind(...bindings).first();

  const email = String(user.email || '').trim().toLowerCase();
  const comments: any = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM comments
    WHERE LOWER(TRIM(authorEmail)) = ?
  `).bind(email).first();

  const shares: any = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM share_events
    WHERE userId = ? OR LOWER(TRIM(userEmail)) = ?
  `).bind(String(user.id || ''), email).first();

  return json({
    completedCount: Number(playback?.completedCount) || 0,
    unfinishedCount: Number(playback?.unfinishedCount) || 0,
    listenedHours: Math.round(((Number(playback?.listenedSeconds) || 0) / 3600) * 10) / 10,
    commentCount: Number(comments?.count) || 0,
    shareCount: Number(shares?.count) || 0
  });
}

async function recordShare(request: Request, env: Env) {
  if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
  const user = await authenticatedUser(request, env);
  if (!user) return json({ error: '請先登入會員' }, 401);
  await ensureLearningSchema(env.DB);
  const body: any = await request.clone().json().catch(() => ({}));
  const trackId = String(body.trackId || '').trim();
  if (!trackId) return json({ error: '缺少音檔資料' }, 400);
  await env.DB.prepare(`
    INSERT INTO share_events (id, userId, userEmail, trackId, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    `share-${crypto.randomUUID()}`,
    String(user.id || ''),
    String(user.email || '').trim().toLowerCase(),
    trackId,
    Date.now()
  ).run();
  return json({ success: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (env.DB && (path === '/api/playback/record' || path.startsWith('/api/playback/history/'))) {
      await ensureLearningSchema(env.DB);
    }

    if (path.startsWith('/api/playback/history/') && method === 'GET') {
      const id = decodeURIComponent(path.slice('/api/playback/history/'.length));
      return historyResponse(id, env);
    }

    if (path === '/api/member-learning-card-stats' && method === 'GET') {
      return memberStats(request, env);
    }

    if (path === '/api/share-events' && method === 'POST') {
      return recordShare(request, env);
    }

    return authWorker.fetch(request, env);
  }
};
