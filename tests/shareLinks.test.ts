import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import shareWorker, { romanizeSpeakerName } from '../worker/shareRouter';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

  function prepare(sql: string) {
    let values: any[] = [];
    const statement = {
      bind(...args: any[]) { values = args; return statement; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { meta: { changes: Number(result.changes) } };
      }
    };
    return statement;
  }

  return { sqlite, prepare };
}

async function jsonCall(env: any, path: string, method = 'GET', body?: unknown) {
  const response = await shareWorker.fetch(new Request(`https://test.example${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  }), env);
  return { response, data: await response.json().catch(() => null) };
}

function assets() {
  return {
    async fetch() {
      return new Response('<!doctype html><html><head><title>繁星回聲</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  };
}

test('speaker names use uppercase Hanyu Pinyin with surname pronunciation and hyphens', () => {
  assert.equal(romanizeSpeakerName('鍾宜宏'), 'ZHONG-YI-HONG');
  assert.equal(romanizeSpeakerName('曾繡珍'), 'ZENG-XIU-ZHEN');
  assert.equal(romanizeSpeakerName('李育瑞'), 'LI-YU-RUI');
});

test('public share slug is remembered per track and increments within the same romanized speaker name', async () => {
  const db = database();
  db.sqlite.prepare(`
    INSERT INTO tracks (id, title, speaker, audioUrl)
    VALUES (?, ?, ?, ?), (?, ?, ?, ?)
  `).run(
    't-one', '第一支', '鍾宜宏', '/one.mp3',
    't-two', '第二支', '鍾宜宏', '/two.mp3'
  );
  const env = { DB: db };

  const first = await jsonCall(env, '/api/tracks/t-one/share-slug', 'POST');
  assert.equal(first.response.status, 200);
  assert.equal(first.data.shareSlug, 'ZHONG-YI-HONG-001');

  const second = await jsonCall(env, '/api/tracks/t-two/share-slug', 'POST');
  assert.equal(second.data.shareSlug, 'ZHONG-YI-HONG-002');

  const again = await jsonCall(env, '/api/tracks/t-one/share-slug', 'POST');
  assert.equal(again.data.shareSlug, 'ZHONG-YI-HONG-001');
  db.sqlite.close();
});

test('public share route serves the app shell and old t-id routes stay retired', async () => {
  const db = database();
  db.sqlite.prepare(`
    INSERT INTO tracks (id, title, speaker, speakerAvatar, audioUrl, shareSlug)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('t-one', '分享測試', '鍾宜宏', '/cover.jpg', '/one.mp3', 'ZHONG-YI-HONG-001');

  const env = { DB: db, ASSETS: assets() };
  const valid = await shareWorker.fetch(new Request('https://test.example/share/ZHONG-YI-HONG-001'), env as any);
  assert.equal(valid.status, 200);
  const html = await valid.text();
  assert.match(html, /name="echostars-share-track" content="t-one"/);
  assert.match(html, /og:url" content="https:\/\/test\.example\/share\/ZHONG-YI-HONG-001"/);

  const legacy = await shareWorker.fetch(new Request('https://test.example/share/t-one'), env as any);
  assert.equal(legacy.status, 404);
  db.sqlite.close();
});

test('VIP links use NAME-S001 with a durable 4-digit default password and 4-12 digit custom password', async () => {
  const db = database();
  db.sqlite.prepare(`
    INSERT INTO tracks (
      id, title, speaker, speakerAvatar, audioUrl, isPrivateVip,
      uploaderEmail, vipDurationDays, vipToken
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    't-vip', '私秘測試', '李育瑞', '/cover.jpg', '/vip.mp3', 1,
    'yukidu@gmail.com', 0, 'vip_old-token'
  );
  const env = { DB: db, ASSETS: assets() };

  const prepared = await jsonCall(env, '/api/tracks/t-vip/vip-share', 'POST', {
    userEmail: 'yukidu@gmail.com'
  });
  assert.equal(prepared.response.status, 200);
  assert.equal(prepared.data.shareSlug, 'LI-YU-RUI-S001');
  assert.match(prepared.data.password, /^\d{4}$/);
  assert.equal(
    db.sqlite.prepare('SELECT shareSlug FROM tracks WHERE id = ?').get('t-vip')?.shareSlug,
    'LI-YU-RUI-S001'
  );
  assert.equal(db.sqlite.prepare('SELECT vipToken FROM tracks WHERE id = ?').get('t-vip')?.vipToken, null);

  const custom = await jsonCall(env, '/api/tracks/t-vip/vip-share', 'POST', {
    userEmail: 'yukidu@gmail.com',
    password: '12345678'
  });
  assert.equal(custom.response.status, 200);
  assert.equal(custom.data.password, '12345678');
  assert.equal(custom.data.url, 'https://test.example/share/LI-YU-RUI-S001?12345678');

  const invalid = await jsonCall(env, '/api/tracks/t-vip/vip-share', 'POST', {
    userEmail: 'yukidu@gmail.com',
    password: '12ab'
  });
  assert.equal(invalid.response.status, 400);

  const valid = await shareWorker.fetch(
    new Request('https://test.example/share/LI-YU-RUI-S001?12345678'),
    env as any
  );
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get('Cache-Control'), 'no-store');
  assert.match(valid.headers.get('X-Robots-Tag') || '', /noindex/);
  const html = await valid.text();
  assert.match(html, /name="echostars-share-track" content="t-vip"/);
  assert.match(html, /sq_unlocked_vip_tracks/);
  assert.match(html, /og:url" content="https:\/\/test\.example\/share\/LI-YU-RUI-S001\?12345678"/);

  const wrong = await shareWorker.fetch(
    new Request('https://test.example/share/LI-YU-RUI-S001?0000'),
    env as any
  );
  assert.equal(wrong.status, 403);

  const oldLongToken = await shareWorker.fetch(
    new Request('https://test.example/share/LI-YU-RUI-S001?vipToken=vip_old-token&trackId=t-vip'),
    env as any
  );
  assert.equal(oldLongToken.status, 403);

  const reset = await jsonCall(env, '/api/tracks/t-vip/vip-share/reset', 'POST', {
    userEmail: 'yukidu@gmail.com',
    durationDays: 0
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.data.shareSlug, 'LI-YU-RUI-S001');
  assert.match(reset.data.password, /^\d{4}$/);
  assert.notEqual(reset.data.password, '12345678');
  assert.equal(reset.data.url, `https://test.example/share/LI-YU-RUI-S001?${reset.data.password}`);

  const oldPasswordAfterReset = await shareWorker.fetch(
    new Request('https://test.example/share/LI-YU-RUI-S001?12345678'),
    env as any
  );
  assert.equal(oldPasswordAfterReset.status, 403);

  db.sqlite.close();
});
