import learningWorker from './learningCardRouter';
import type { Env } from './index';
import {
  mergePlaybackRows,
  summarizePlaybackRecords,
  type CanonicalPlaybackRecord,
  type TrackProgressMeta
} from '../shared/learningProgress';

const ownershipSchemaReady = new WeakMap<object, Promise<void>>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function ensureOwnershipSchema(db: any) {
  if (!db) return;
  const key = db as object;
  if (!ownershipSchemaReady.has(key)) {
    const task = (async () => {
      const table = await db.prepare('PRAGMA table_info(playback_memories)').all();
      const columns = table.results || [];
      if (!columns.some((row: any) => row.name === 'memberId')) {
        try {
          await db.prepare('ALTER TABLE playback_memories ADD COLUMN memberId TEXT').run();
        } catch (error) {
          const check = await db.prepare('PRAGMA table_info(playback_memories)').all();
          if (!check.results?.some((row: any) => row.name === 'memberId')) throw error;
        }
      }

      await db.prepare(`
        CREATE TABLE IF NOT EXISTS playback_identity_aliases (
          alias TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          aliasType TEXT NOT NULL,
          source TEXT NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `).run();
      await db.prepare('CREATE INDEX IF NOT EXISTS playback_memories_member ON playback_memories(memberId)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS playback_alias_member ON playback_identity_aliases(memberId)').run();

      const now = Date.now();
      await db.batch([
        db.prepare(`
          INSERT OR IGNORE INTO playback_identity_aliases(alias, memberId, aliasType, source, updatedAt)
          SELECT LOWER(TRIM(email)), id, 'email', 'users', ?
          FROM users
          WHERE email IS NOT NULL AND TRIM(email) <> ''
        `).bind(now),
        db.prepare(`
          INSERT OR IGNORE INTO playback_identity_aliases(alias, memberId, aliasType, source, updatedAt)
          SELECT LOWER(TRIM(id)), id, 'userId', 'users', ?
          FROM users
          WHERE id IS NOT NULL AND TRIM(id) <> ''
        `).bind(now),
        // A historical device id is safe to claim only when every member-authored
        // comment made from that device belongs to the same account.
        db.prepare(`
          INSERT OR IGNORE INTO playback_identity_aliases(alias, memberId, aliasType, source, updatedAt)
          SELECT LOWER(TRIM(c.deviceId)), MIN(u.id), 'device', 'comment', ?
          FROM comments c
          JOIN users u ON LOWER(TRIM(c.authorEmail)) = LOWER(TRIM(u.email))
          WHERE c.deviceId IS NOT NULL AND TRIM(c.deviceId) <> ''
            AND c.authorEmail IS NOT NULL AND TRIM(c.authorEmail) <> ''
          GROUP BY LOWER(TRIM(c.deviceId))
          HAVING COUNT(DISTINCT u.id) = 1
        `).bind(now)
      ]);

      // Non-destructive backfill. Rows that can be proven to belong to a member
      // gain a stable owner; unknown anonymous device rows remain untouched.
      await db.prepare(`
        UPDATE playback_memories
        SET memberId = (
          SELECT a.memberId
          FROM playback_identity_aliases a
          WHERE LOWER(TRIM(playback_memories.userIdentifier)) = a.alias
             OR LOWER(SUBSTR(TRIM(playback_memories.key), 1, LENGTH(a.alias) + 1)) = a.alias || '_'
          ORDER BY CASE WHEN LOWER(TRIM(playback_memories.userIdentifier)) = a.alias THEN 0 ELSE 1 END
          LIMIT 1
        )
        WHERE (memberId IS NULL OR TRIM(memberId) = '')
          AND EXISTS (
            SELECT 1
            FROM playback_identity_aliases a
            WHERE LOWER(TRIM(playback_memories.userIdentifier)) = a.alias
               OR LOWER(SUBSTR(TRIM(playback_memories.key), 1, LENGTH(a.alias) + 1)) = a.alias || '_'
          )
      `).run();
    })();
    ownershipSchemaReady.set(key, task);
    task.catch(() => ownershipSchemaReady.delete(key));
  }
  await ownershipSchemaReady.get(key);
}

async function authenticatedUser(request: Request, env: Env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization) return null;
  const response = await learningWorker.fetch(new Request(new URL('/api/auth/session', request.url), {
    method: 'GET',
    headers: { Authorization: authorization }
  }), env);
  if (!response.ok) return null;
  const data: any = await response.json().catch(() => ({}));
  return data?.user || null;
}

async function resolveMember(db: any, requestedId: string) {
  const requested = normalize(requestedId);
  if (!requested) return null;
  return db.prepare(`
    SELECT id, email, name
    FROM users
    WHERE LOWER(TRIM(id)) = ? OR LOWER(TRIM(email)) = ?
    LIMIT 1
  `).bind(requested, requested).first();
}

async function aliasesForMember(db: any, member: any) {
  const aliases = new Set<string>();
  const id = normalize(member?.id);
  const email = normalize(member?.email);
  if (id) aliases.add(id);
  if (email) aliases.add(email);

  const stored = await db.prepare(`
    SELECT alias FROM playback_identity_aliases WHERE memberId = ?
  `).bind(String(member.id || '')).all();
  for (const row of stored.results || []) {
    const alias = normalize((row as any).alias);
    if (alias) aliases.add(alias);
  }

  // Read-time recovery catches devices that became attributable after this
  // Worker isolate initialized, without requiring a write on every profile view.
  if (email) {
    const commentDevices = await db.prepare(`
      SELECT LOWER(TRIM(c.deviceId)) AS alias
      FROM comments c
      JOIN users u ON LOWER(TRIM(c.authorEmail)) = LOWER(TRIM(u.email))
      WHERE LOWER(TRIM(c.authorEmail)) = ?
        AND c.deviceId IS NOT NULL AND TRIM(c.deviceId) <> ''
      GROUP BY LOWER(TRIM(c.deviceId))
      HAVING COUNT(DISTINCT u.id) = 1
    `).bind(email).all();
    for (const row of commentDevices.results || []) {
      const alias = normalize((row as any).alias);
      if (alias) aliases.add(alias);
    }
  }

  return [...aliases];
}

function legacyIdentityFilter(aliases: string[]) {
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

async function trackMetaMap(db: any, trackIds: string[]) {
  const ids = [...new Set(trackIds.filter(Boolean))];
  if (!ids.length) return {} as Record<string, TrackProgressMeta>;
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.prepare(`
    SELECT id, title, speaker, speakerRank, durationSeconds
    FROM tracks WHERE id IN (${placeholders})
  `).bind(...ids).all();
  const map: Record<string, TrackProgressMeta> = {};
  for (const row of result.results || []) map[String((row as any).id)] = row as TrackProgressMeta;
  return map;
}

async function canonicalRecordsForMember(env: Env, member: any): Promise<Record<string, CanonicalPlaybackRecord>> {
  if (!env.DB || !member?.id) return {};
  await ensureOwnershipSchema(env.DB);
  const aliases = await aliasesForMember(env.DB, member);
  const legacy = legacyIdentityFilter(aliases);
  const result = await env.DB.prepare(`
    SELECT * FROM playback_memories
    WHERE memberId = ? OR ${legacy.where}
    ORDER BY COALESCE(lastPlayedAt, 0) ASC
  `).bind(String(member.id), ...legacy.bindings).all();

  const rows = result.results || [];
  const meta = await trackMetaMap(env.DB, rows.map((row: any) => String(row.trackId || '')));
  const merged = mergePlaybackRows(rows as any[], meta);
  for (const [trackId, record] of Object.entries(merged)) {
    record.isDeleted = !meta[trackId] || record.isDeleted;
  }
  return merged;
}

async function publicHistory(requestedId: string, env: Env) {
  if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
  await ensureOwnershipSchema(env.DB);
  const member = await resolveMember(env.DB, requestedId);
  if (!member) return json({ error: '找不到指定會員' }, 404);
  return json(await canonicalRecordsForMember(env, member));
}

async function resolveMemberForWrite(request: Request, env: Env, identifier: string) {
  if (!env.DB) return null;
  const auth = await authenticatedUser(request, env);
  if (auth?.id) return auth;

  const direct = await resolveMember(env.DB, identifier);
  if (direct) return direct;

  const alias = normalize(identifier);
  if (!alias) return null;
  const row: any = await env.DB.prepare(`
    SELECT u.id, u.email, u.name
    FROM playback_identity_aliases a
    JOIN users u ON u.id = a.memberId
    WHERE a.alias = ?
    LIMIT 1
  `).bind(alias).first();
  return row || null;
}

async function recordPlayback(request: Request, env: Env) {
  if (!env.DB) return json({ error: '資料庫尚未連線' }, 503);
  await ensureOwnershipSchema(env.DB);
  const body: any = await request.clone().json().catch(() => ({}));
  const trackId = String(body.trackId || '').trim();
  const suppliedIdentifier = normalize(body.userIdOrDeviceId);
  if (!trackId || !suppliedIdentifier) return json({ error: '缺少必要參數 (trackId, userIdOrDeviceId)' }, 400);

  const member: any = await resolveMemberForWrite(request, env, suppliedIdentifier);
  const memberId = member?.id ? String(member.id) : '';
  const identifier = memberId || suppliedIdentifier;
  const key = `${identifier}_${trackId}`;

  const track: any = await env.DB.prepare(`
    SELECT id, title, speaker, speakerRank, durationSeconds
    FROM tracks WHERE id = ? LIMIT 1
  `).bind(trackId).first();
  if (!track) return json({ error: '找不到音檔' }, 404);

  const incomingDuration = Number(body.duration);
  const trackDuration = Number(track.durationSeconds);
  const duration = Number.isFinite(incomingDuration) && incomingDuration > 0
    ? incomingDuration
    : Number.isFinite(trackDuration) && trackDuration > 0 ? trackDuration : 600;
  const incomingCurrent = Number(body.currentTime);
  const currentTime = Math.min(duration, Math.max(0, Number.isFinite(incomingCurrent) ? incomingCurrent : 0));
  const rawProgress = Math.min(100, Math.max(0, (currentTime / Math.max(1, duration)) * 100));
  const completed = rawProgress >= 95;
  const progressPercent = completed ? 100 : Math.round(rawProgress * 10) / 10;
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const playedAt = Date.now();

  await env.DB.prepare(`
    INSERT INTO playback_memories (
      key, trackId, userIdentifier, memberId, currentTime, duration, progressPercent,
      lastPlayedAt, completed, trackTitle, trackSpeaker, trackSpeakerRank,
      firstListenDate, lastListenDate, finishDate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      memberId = COALESCE(NULLIF(excluded.memberId, ''), playback_memories.memberId),
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
    memberId || null,
    completed ? duration : currentTime,
    duration,
    progressPercent,
    playedAt,
    completed ? 1 : 0,
    String(track.title || ''),
    String(track.speaker || ''),
    String(track.speakerRank || ''),
    dateStr,
    dateStr,
    completed ? dateStr : null
  ).run();

  return json({
    success: true,
    owner: memberId || null,
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
  await ensureOwnershipSchema(env.DB);
  const url = new URL(request.url);
  const requested = url.searchParams.get('member') || '';
  let member: any = requested ? await resolveMember(env.DB, requested) : null;
  if (!member) member = await authenticatedUser(request, env);
  if (!member?.id) return json({ error: '找不到會員' }, 404);

  const records = await canonicalRecordsForMember(env, member);
  const summary = summarizePlaybackRecords(records);
  const email = normalize(member.email);
  const comments: any = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM comments WHERE LOWER(TRIM(authorEmail)) = ?
  `).bind(email).first();
  const shares: any = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM share_events
    WHERE userId = ? OR LOWER(TRIM(userEmail)) = ?
  `).bind(String(member.id), email).first();

  return json({
    ...summary,
    commentCount: Number(comments?.count) || 0,
    shareCount: Number(shares?.count) || 0
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (path === '/api/playback/record' && method === 'POST') {
      return recordPlayback(request, env);
    }

    if (path.startsWith('/api/playback/history/') && method === 'GET') {
      const requestedId = decodeURIComponent(path.slice('/api/playback/history/'.length));
      return publicHistory(requestedId, env);
    }

    if (path === '/api/member-learning-card-stats' && method === 'GET') {
      return memberStats(request, env);
    }

    return learningWorker.fetch(request, env);
  }
};
