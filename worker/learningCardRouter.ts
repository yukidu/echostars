import authWorker from './authRouter';
import type { Env } from './index';
import {
  mergePlaybackRows,
  summarizePlaybackRecords,
  type CanonicalPlaybackRecord,
  type TrackProgressMeta
} from '../shared/learningProgress';
import {
  canInspectOtherLearningHistory,
  decideLearningHistoryScope,
  learningIdentityAliases,
  normalizeLearningIdentity,
  type LearningHistoryScopeDecision
} from '../shared/learningHistoryAccess';

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

      // Legacy rows did not always preserve the first date. Fill only missing data.
      await db.prepare(`
        UPDATE playback_memories
        SET firstListenDate = COALESCE(NULLIF(firstListenDate, ''), NULLIF(lastListenDate, ''), NULLIF(finishDate, ''))
        WHERE firstListenDate IS NULL OR TRIM(firstListenDate) = ''
      `).run();

      // Repair old rows that were already marked complete but later had their
      // progress/currentTime overwritten by a replay from the beginning.
      await db.prepare(`
        UPDATE playback_memories
        SET
          completed = 1,
          progressPercent = 100,
          currentTime = CASE
            WHEN COALESCE(duration, 0) > 0 THEN MAX(COALESCE(currentTime, 0), duration)
            ELSE COALESCE(currentTime, 0)
          END
        WHERE
          (completed = 1 OR (finishDate IS NOT NULL AND TRIM(finishDate) <> ''))
          AND (
            COALESCE(progressPercent, 0) < 100
            OR (COALESCE(duration, 0) > 0 AND COALESCE(currentTime, 0) < duration)
            OR completed <> 1
          )
      `).run();

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

      await db.prepare('CREATE INDEX IF NOT EXISTS playback_memories_user ON playback_memories(userIdentifier)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS playback_memories_track ON playback_memories(trackId)').run();

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

// Older playback rows sometimes kept the correct member identity only in the
// primary key (`<identity>_<trackId>`) while userIdentifier was blank or used an
// earlier format. Match both representations so historical progress can never
// disappear after a schema/router upgrade.
function playbackIdentityFilter(aliases: string[]) {
  const clauses: string[] = [];
  const bindings: string[] = [];
  for (const alias of aliases) {
    clauses.push(`(
      LOWER(TRIM(userIdentifier)) = ?
      OR LOWER(SUBSTR(TRIM(key), 1, LENGTH(?) + 1)) = ?
    )`);
    bindings.push(alias, alias, `${alias}_`);
  }
  return {
    where: clauses.length ? clauses.join(' OR ') : '0',
    bindings
  };
}

async function resolveHistoryScope(
  request: Request,
  requestedId: string,
  env: Env,
  allowAdminTarget: boolean
): Promise<LearningHistoryScopeDecision> {
  const actor = await authenticatedUser(request, env);
  const initial = decideLearningHistoryScope(actor, requestedId, null, allowAdminTarget);
  if (initial.ok || initial.status !== 404) return initial;

  // A 404 from the pure decision at this point means a privileged viewer is
  // requesting another member. Resolve that member explicitly instead of ever
  // falling back to the current session identity.
  if (!env.DB || !actor || !canInspectOtherLearningHistory(actor)) return initial;
  const requested = normalizeLearningIdentity(requestedId);
  const target: any = await env.DB.prepare(`
    SELECT id, email, role, isAdminUser
    FROM users
    WHERE LOWER(TRIM(id)) = ? OR LOWER(TRIM(email)) = ?
    LIMIT 1
  `).bind(requested, requested).first();

  return decideLearningHistoryScope(actor, requestedId, target, allowAdminTarget);
}

async function trackMetaMap(db: any, trackIds: string[]) {
  const ids = [...new Set(trackIds.filter(Boolean))];
  if (!ids.length) return {} as Record<string, TrackProgressMeta>;
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db.prepare(`
    SELECT id, title, speaker, speakerRank, durationSeconds
    FROM tracks
    WHERE id IN (${placeholders})
  `).bind(...ids).all();
  const map: Record<string, TrackProgressMeta> = {};
  for (const row of results || []) map[String((row as any).id)] = row as TrackProgressMeta;
  return map;
}

async function canonicalRecords(env: Env, aliases: string[]): Promise<Record<string, CanonicalPlaybackRecord>> {
  if (!env.DB || !aliases.length) return {};
  await ensureLearningSchema(env.DB);
  const filter = playbackIdentityFilter(aliases);
  const { results } = await env.DB.prepare(`
    SELECT * FROM playback_memories
    WHERE ${filter.where}
    ORDER BY COALESCE(lastPlayedAt, 0) ASC
  `).bind(...filter.bindings).all();

  const rows = results || [];
  const meta = await trackMetaMap(env.DB, rows.map((row: any) => String(row.trackId || '')));
  const merged = mergePlaybackRows(rows as any[], meta);
  for (const [trackId, record] of Object.entries(merged)) {
    record.isDeleted = !meta[trackId] || record.isDeleted;
  }
  return merged;
}

async function historyResponse(request: Request, requestedId: string, env: Env) {
  if (!env.DB || !requestedId) return json({});
  const scope = await resolveHistoryScope(request, requestedId, env, true);
  if (!scope.ok) return json({ error: scope.error }, scope.status);
  return json(await canonicalRecords(env, scope.aliases));
}

async function deleteHistory(request: Request, requestedId: string, env: Env) {
  if (!env.DB || !requestedId) return json({ error: '缺少使用者識別' }, 400);

  // Clearing history is intentionally self-only. Even administrators may view
  // a member for support, but cannot delete somebody else's learning history.
  const scope = await resolveHistoryScope(request, requestedId, env, false);
  if (!scope.ok) return json({ error: scope.error }, scope.status);
  if (!scope.aliases.length) return json({ success: true });

  await ensureLearningSchema(env.DB);
  const filter = playbackIdentityFilter(scope.aliases);
  const actor = await authenticatedUser(request, env);
  const statements = [
    env.DB.prepare(`DELETE FROM playback_memories WHERE ${filter.where}`).bind(...filter.bindings)
  ];
  if (actor) {
    statements.push(
      env.DB.prepare('UPDATE users SET playCount = 0 WHERE id = ? OR LOWER(TRIM(email)) = ?')
        .bind(String(actor.id || ''), normalizeLearningIdentity(actor.email))
    );
  }
  await env.DB.batch(statements);
  return json({ success: true });
}

async function recordPlayback(request: Request, env: Env) {
  if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
  await ensureLearningSchema(env.DB);
  const body: any = await request.clone().json().catch(() => ({}));
  const trackId = String(body.trackId || '').trim();
  const user = await authenticatedUser(request, env);
  const identifier = user
    ? (normalizeLearningIdentity(user.email) || normalizeLearningIdentity(user.id))
    : normalizeLearningIdentity(body.userIdOrDeviceId);
  if (!trackId || !identifier) return json({ error: '缺少必要參數 (trackId, userIdOrDeviceId)' }, 400);

  const track: any = await env.DB.prepare(`
    SELECT id, title, speaker, speakerRank, durationSeconds
    FROM tracks WHERE id = ? LIMIT 1
  `).bind(trackId).first();
  const incomingDuration = Number(body.duration);
  const trackDuration = Number(track?.durationSeconds);
  const duration = Number.isFinite(incomingDuration) && incomingDuration > 0
    ? incomingDuration
    : Number.isFinite(trackDuration) && trackDuration > 0 ? trackDuration : 600;
  const incomingCurrent = Number(body.currentTime);
  const currentTime = Math.min(duration, Math.max(0, Number.isFinite(incomingCurrent) ? incomingCurrent : 0));
  const rawProgress = Math.min(100, Math.max(0, (currentTime / Math.max(1, duration)) * 100));
  const completed = rawProgress >= 95;
  const progressPercent = completed ? 100 : Math.round(rawProgress);
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const key = `${identifier}_${trackId}`;
  const playedAt = Date.now();

  await env.DB.prepare(`
    INSERT INTO playback_memories (
      key, trackId, userIdentifier, currentTime, duration, progressPercent,
      lastPlayedAt, completed, trackTitle, trackSpeaker, trackSpeakerRank,
      firstListenDate, lastListenDate, finishDate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      currentTime = MAX(COALESCE(playback_memories.currentTime, 0), excluded.currentTime),
      duration = MAX(COALESCE(playback_memories.duration, 0), excluded.duration),
      progressPercent = MAX(COALESCE(playback_memories.progressPercent, 0), excluded.progressPercent),
      lastPlayedAt = excluded.lastPlayedAt,
      completed = CASE WHEN playback_memories.completed = 1 OR excluded.completed = 1 THEN 1 ELSE 0 END,
      trackTitle = COALESCE(NULLIF(excluded.trackTitle, ''), playback_memories.trackTitle),
      trackSpeaker = COALESCE(NULLIF(excluded.trackSpeaker, ''), playback_memories.trackSpeaker),
      trackSpeakerRank = COALESCE(NULLIF(excluded.trackSpeakerRank, ''), playback_memories.trackSpeakerRank),
      firstListenDate = COALESCE(NULLIF(playback_memories.firstListenDate, ''), excluded.firstListenDate),
      lastListenDate = excluded.lastListenDate,
      finishDate = CASE
        WHEN playback_memories.finishDate IS NOT NULL AND TRIM(playback_memories.finishDate) <> '' THEN playback_memories.finishDate
        WHEN excluded.completed = 1 THEN excluded.finishDate
        ELSE playback_memories.finishDate
      END
  `).bind(
    key,
    trackId,
    identifier,
    completed ? duration : currentTime,
    duration,
    progressPercent,
    playedAt,
    completed ? 1 : 0,
    String(track?.title || ''),
    String(track?.speaker || ''),
    String(track?.speakerRank || ''),
    dateStr,
    dateStr,
    completed ? dateStr : null
  ).run();

  return json({
    success: true,
    record: {
      trackId,
      userIdOrDeviceId: identifier,
      firstListenDate: dateStr,
      lastListenDate: dateStr,
      finishDate: completed ? dateStr : undefined,
      progressPercent,
      completed,
      currentTime: completed ? duration : currentTime,
      duration,
      updatedAt: playedAt
    }
  });
}

async function memberStats(request: Request, env: Env) {
  if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
  const user = await authenticatedUser(request, env);
  if (!user) return json({ error: '請先登入會員' }, 401);
  const aliases = learningIdentityAliases(user);
  const records = await canonicalRecords(env, aliases);
  const summary = summarizePlaybackRecords(records);
  const email = normalizeLearningIdentity(user.email);

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
    ...summary,
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
    normalizeLearningIdentity(user.email),
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

    if (path === '/api/playback/record' && method === 'POST') {
      return recordPlayback(request, env);
    }

    if (path.startsWith('/api/playback/history/')) {
      const requestedId = decodeURIComponent(path.slice('/api/playback/history/'.length));
      if (method === 'GET') return historyResponse(request, requestedId, env);
      if (method === 'DELETE') return deleteHistory(request, requestedId, env);
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
