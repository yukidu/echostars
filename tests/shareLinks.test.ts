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

async function jsonCall(env: any, path: string, method = 'GET') {
  const response = await shareWorker.fetch(new Request(`https://test.example${path}`, { method }), env);
  return { response, data: await response.json().catch(() => null) };
}

test('speaker names use uppercase Hanyu Pinyin with surname pronunciation and hyphens', () => {
  assert.equal(romanizeSpeakerName('鍾宜宏'), 'ZHONG-YI-HONG');
  assert.equal(romanizeSpeakerName('曾繡珍'), 'ZENG-XIU-ZHEN');
});

test('share slug is remembered per track and increments within the same romanized speaker name', async () => {
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
  assert.equal(db.sqlite.prepare('SELECT shareSlug FROM tracks WHERE id = ?').get('t-one')?.shareSlug, 'ZHONG-YI-HONG-001');
  db.sqlite.close();
});

test('new share route serves the app shell with track bootstrap metadata and old t-id routes are retired', async () => {
  const db = database();
  db.sqlite.prepare(`
    INSERT INTO tracks (id, title, speaker, speakerAvatar, audioUrl, shareSlug)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('t-one', '分享測試', '鍾宜宏', '/cover.jpg', '/one.mp3', 'ZHONG-YI-HONG-001');

  const env = {
    DB: db,
    ASSETS: {
      async fetch() {
        return new Response('<!doctype html><html><head><title>繁星回聲</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  };

  const valid = await shareWorker.fetch(new Request('https://test.example/share/ZHONG-YI-HONG-001'), env as any);
  assert.equal(valid.status, 200);
  const html = await valid.text();
  assert.match(html, /name="echostars-share-track" content="t-one"/);
  assert.match(html, /og:url" content="https:\/\/test\.example\/share\/ZHONG-YI-HONG-001"/);
  assert.match(html, /<script type="module" src="\/assets\/app\.js"><\/script>/);

  const legacy = await shareWorker.fetch(new Request('https://test.example/share/t-one'), env as any);
  assert.equal(legacy.status, 404);
  db.sqlite.close();
});
