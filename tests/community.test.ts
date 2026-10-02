import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { communityApi } from '../worker/community';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NumerologyGrid } from '../src/components/NumerologyGrid';
import worker from '../worker/index';
import { commentThreads } from '../src/utils/comments';

const demo = [{ id: 't-test', title: '測試音檔', speaker: '講者', audioUrl: '/test.mp3', likes: 0, durationSeconds: 600, ratings: {}, likedBy: [] }];
function database(legacy = false) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  if (legacy) {
    for (const column of ['residence', 'birthday', 'approvedRank', 'rankAuditType', 'canUpload', 'playCount', 'googleAvatar', 'avatarUploadCount', 'avatarUploadMonth', 'profileEditCount', 'profileEditMonth', 'zodiac', 'talentNumber', 'lifeNumber']) sqlite.exec(`ALTER TABLE users DROP COLUMN ${column}`);
    sqlite.exec('ALTER TABLE playback_memories DROP COLUMN lastListenDate');
    sqlite.exec('ALTER TABLE playback_memories DROP COLUMN finishDate');
  }
  function prepare(sql: string) {
    let values: any[] = [];
    const statement = {
      bind(...args: any[]) { values = args; return statement; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; }
    };
    return statement;
  }
  return { sqlite, prepare, async batch(statements: any[]) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }};
}
async function call(db: any, path: string, method = 'GET', body?: any) {
  const response = await communityApi(new Request('https://test.example' + path, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) }), { DB: db }, demo);
  assert.ok(response);
  return { status: response.status, data: await response.json() as any };
}

test('legacy schema is upgraded; edited profile and custom photo survive repeated Google login', async () => {
  const db = database(true);
  const first = await call(db, '/api/users/google-sync', 'POST', { email: 'member@example.com', name: 'Google 名稱', avatar: 'https://lh3.googleusercontent.com/first' });
  assert.equal(first.status, 200);
  assert.equal(first.data.user.avatar, 'https://lh3.googleusercontent.com/first');
  const id = first.data.user.id;
  const update = await call(db, '/api/users/' + id, 'PUT', { name: '自訂名字', phone: '0912345678', center: '高雄', residence: '臺南', birthday: '1999-09-09', avatar: 'data:image/png;base64,custom', avatarUploadCount: 1, profileEditCount: 2 });
  assert.equal(update.status, 200);
  const login = await call(db, '/api/users/google-sync', 'POST', { email: 'MEMBER@example.com', name: 'Google 名稱', avatar: 'https://lh3.googleusercontent.com/new' });
  assert.equal(login.data.user.id, id);
  assert.equal(login.data.user.name, '自訂名字');
  assert.equal(login.data.user.phone, '0912345678');
  assert.equal(login.data.user.center, '高雄');
  assert.equal(login.data.user.birthday, '1999-09-09');
  assert.equal(login.data.user.avatar, 'data:image/png;base64,custom');
  assert.equal(login.data.user.profileEditCount, 2);
  const profile = await call(db, '/api/users/profile?email=member%40example.com');
  assert.equal(profile.data.user.residence, '臺南');
  db.sqlite.close();
});

test('Google default photo updates while edited member name stays saved', async () => {
  const db = database();
  const first = await call(db, '/api/users/google-sync', 'POST', { email: 'photo@example.com', name: '原名', avatar: 'https://lh3.googleusercontent.com/old' });
  await call(db, '/api/users/' + first.data.user.id, 'PUT', { name: '新名' });
  const second = await call(db, '/api/users/google-sync', 'POST', { email: 'photo@example.com', name: '原名', avatar: 'https://lh3.googleusercontent.com/new' });
  assert.equal(second.data.user.name, '新名');
  assert.equal(second.data.user.avatar, 'https://lh3.googleusercontent.com/new');
  db.sqlite.close();
});

test('track likes return the frontend contract and persist cancellation across requests', async () => {
  const db = database();
  assert.equal((await call(db, '/api/tracks')).data.length, 1);
  const like = await call(db, '/api/tracks/t-test/like', 'POST', { identifier: 'a@example.com' });
  assert.deepEqual(like.data, { likes: 1, hasLiked: true, likedBy: ['a@example.com'] });
  assert.equal((await call(db, '/api/tracks')).data[0].likes, 1);
  const cancel = await call(db, '/api/tracks/t-test/like', 'POST', { identifier: 'a@example.com' });
  assert.equal(cancel.data.hasLiked, false);
  assert.equal(cancel.data.likes, 0);
  db.sqlite.close();
});

test('ratings aggregate all visitors; legacy zero scores preserve existing ratings', async () => {
  const db = database();
  await call(db, '/api/tracks/t-test/rate', 'POST', { identifier: 'u-admin', score: 5 });
  const rated = await call(db, '/api/tracks/t-test/rate', 'POST', { identifier: 'other@example.com', score: 3 });
  assert.equal(rated.data.rating, 4);
  assert.equal(rated.data.ratingCount, 2);
  const cancel = await call(db, '/api/tracks/t-test/rate', 'POST', { identifier: 'other@example.com', score: 0 });
  assert.deepEqual(cancel.data.ratings, { 'u-admin': 5, 'other@example.com': 3 });
  assert.equal(cancel.data.ignoredZero, true);
  assert.equal(cancel.data.rating, 4);
  assert.equal(cancel.data.ratingCount, 2);
  const invalid = await call(db, '/api/tracks/t-test/rate', 'POST', { identifier: 'other', score: 9 });
  assert.equal(invalid.status, 400);
  db.sqlite.close();
});

test('comments are bound to URL track, return raw content, preserve replies and support like/edit/delete', async () => {
  const db = database();
  await call(db, '/api/tracks');
  const comment = await call(db, '/api/tracks/t-test/comments', 'POST', { authorName: '訪客', deviceId: 'd-1', content: '第一則留言' });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.content, '第一則留言');
  assert.equal(comment.data.trackId, 't-test');
  const reply = await call(db, '/api/tracks/t-test/comments', 'POST', { authorName: '訪客', deviceId: 'd-1', content: '回覆', replyToId: comment.data.id, replyToAuthor: '訪客' });
  assert.equal(reply.data.replyToId, comment.data.id);
  assert.equal((await call(db, '/api/tracks/another/comments')).data.length, 0);
  assert.equal((await call(db, '/api/tracks/t-test/comments')).data.length, 2);
  assert.equal((await call(db, '/api/tracks')).data[0].commentsCount, 2);
  const like = await call(db, '/api/comments/' + reply.data.id + '/like', 'POST', { identifier: 'd-1' });
  assert.equal(like.data.hasLiked, true);
  const edit = await call(db, '/api/comments/' + reply.data.id, 'PUT', { content: '修正回覆', deviceId: 'd-1' });
  assert.equal(edit.data.content, '修正回覆');
  await call(db, '/api/comments/' + comment.data.id, 'DELETE', { deviceId: 'd-1' });
  const remaining = (await call(db, '/api/tracks/t-test/comments')).data;
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].replyToId, null);
  assert.equal((await call(db, '/api/tracks')).data[0].commentsCount, 1);
  db.sqlite.close();
});

test('regular admins can delete visitor comments but not registered-member comments', async () => {
  const db = database();
  await call(db, '/api/tracks');
  await call(db, '/api/users/google-sync', 'POST', { email: 'admin@example.com', name: '管理員' });
  db.sqlite.exec("UPDATE users SET isAdminUser = 1, role = '管理員' WHERE email = 'admin@example.com'");

  const visitorComment = await call(db, '/api/tracks/t-test/comments', 'POST', {
    authorName: '訪客',
    deviceId: 'guest-device',
    content: '訪客心得'
  });
  const memberComment = await call(db, '/api/tracks/t-test/comments', 'POST', {
    authorName: '會員',
    authorEmail: 'member@example.com',
    deviceId: 'member-device',
    content: '會員心得'
  });

  assert.equal(
    (await call(db, '/api/comments/' + visitorComment.data.id, 'DELETE', { userEmail: 'admin@example.com' })).status,
    200
  );
  assert.equal(
    (await call(db, '/api/comments/' + memberComment.data.id, 'DELETE', { userEmail: 'admin@example.com' })).status,
    403
  );
  assert.equal(
    (await call(db, '/api/comments/' + memberComment.data.id, 'DELETE', { userEmail: 'member@example.com' })).status,
    200
  );
  db.sqlite.close();
});

test('deleted initial tracks are not recreated and missing records fail honestly', async () => {
  const db = database();
  await call(db, '/api/tracks');
  db.sqlite.exec('DELETE FROM tracks');
  assert.equal((await call(db, '/api/tracks')).data.length, 0);
  assert.equal((await call(db, '/api/tracks/t-test/like', 'POST', { identifier: 'd-1' })).status, 404);
  db.sqlite.close();
});

test('missing DB binding reports a service error instead of pretending to save', async () => {
  const response = await communityApi(new Request('https://test.example/api/users/google-sync', { method: 'POST' }), {}, demo);
  assert.equal(response?.status, 503);
});

test('many numerology rings stay within square SVG cells without deforming', () => {
  const html = renderToStaticMarkup(React.createElement(NumerologyGrid, { birthday: '1999-09-09' }));
  assert.equal((html.match(/viewBox="0 0 100 100"/g) || []).length, 9);
  const radii = [...html.matchAll(/<circle[^>]* r="([\d.]+)"/g)].map(match => Number(match[1]));
  assert.ok(radii.length > 9);
  assert.ok(radii.every(radius => radius >= 19 && radius <= 44));
  assert.ok(html.includes('先天數 6 圈') || html.includes('先天數 5 圈'));
});

test('Worker routes track comments into persistent API instead of a generic track update', async () => {
  const db = database(true);
  await call(db, '/api/tracks');
  const response = await worker.fetch(new Request('https://test.example/api/tracks'), { DB: db });
  const tracks: any = await response.json();
  assert.ok(tracks.length);
  const posted = await worker.fetch(new Request(`https://test.example/api/tracks/${tracks[0].id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '正式環境留言', deviceId: 'd-test' }) }), { DB: db });
  assert.equal(posted.status, 201);
  const comment: any = await posted.json();
  assert.equal(comment.trackId, tracks[0].id);
  const changed = await worker.fetch(new Request(`https://test.example/api/comments/${comment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '修改內容', deviceId: 'd-test' }) }), { DB: db });
  assert.equal((await changed.json() as any).content, '修改內容');
  db.sqlite.close();
});

test('nested and orphan replies are displayed exactly once', () => {
  const comments: any[] = [{ id: 'root' }, { id: 'reply', replyToId: 'root' }, { id: 'nested', replyToId: 'reply' }, { id: 'orphan', replyToId: 'deleted' }];
  const threads = commentThreads(comments as any);
  assert.deepEqual(threads.roots.map(c => c.id), ['root', 'orphan']);
  assert.deepEqual(threads.replies.get('root')?.map(c => c.id), ['reply', 'nested']);
});

test('v3 comment edits reject another author, including the administrator', async()=>{
 const db=database(); await call(db,'/api/tracks');
 const c=await call(db,'/api/tracks/t-test/comments','POST',{authorEmail:'writer@example.com',deviceId:'shared-device',content:'原文'});
 assert.equal((await call(db,'/api/comments/'+c.data.id,'PUT',{content:'改寫',userEmail:'yukidu@gmail.com',deviceId:'shared-device'})).status,403);
 assert.equal((await call(db,'/api/comments/'+c.data.id,'PUT',{content:'本人修正',userEmail:'writer@example.com'})).status,200);
 db.sqlite.close();
});
test('v3 keywords support add, rename and query-string delete',async()=>{
 const db=database();await call(db,'/api/tracks');
 assert.deepEqual((await call(db,'/api/tracks/t-test/keywords','POST',{keyword:'學習'})).data.keywords,['學習']);
 await call(db,'/api/keywords/rename','PUT',{oldKeyword:'學習',newKeyword:'成長'});
 assert.deepEqual((await call(db,'/api/tracks')).data[0].keywords,['成長']);
 assert.equal((await call(db,'/api/keywords/delete?keyword='+encodeURIComponent('成長'),'DELETE')).status,200);
 assert.deepEqual((await call(db,'/api/tracks')).data[0].keywords,[]);
 db.sqlite.close();
});
test('v3 rank approval persists only with an authorized auditor',async()=>{
 const db=database();
 await call(db,'/api/users/google-sync','POST',{email:'yukidu@gmail.com',name:'管理員'});
 const member=await call(db,'/api/users/google-sync','POST',{email:'member@example.com',name:'會員'});
 const route='/api/users/'+member.data.user.id+'/audit-rank';
 assert.equal((await call(db,route,'PUT',{auditorEmail:'member@example.com',rank:'白金'})).status,403);
 const approved=await call(db,route,'PUT',{auditorEmail:'yukidu@gmail.com',rank:'白金'});
 assert.equal(approved.status,200);assert.equal(approved.data.approvedRank,'白金');assert.equal(approved.data.rankAuditStatus,'approved');
 db.sqlite.close();
});

test('v3 offline cleanup deletes real cached URLs after 95 percent and 15 days',async()=>{
 const offline=await import('../src/utils/offlineAudio');
 const previous={window:globalThis.window,localStorage:globalThis.localStorage,caches:globalThis.caches};
 const memory=new Map<string,string>();const removed:string[]=[];
 Object.assign(globalThis,{window:{},localStorage:{getItem:(k:string)=>memory.get(k)||null,setItem:(k:string,v:string)=>memory.set(k,v)},caches:{open:async()=>({delete:async(url:string)=>{removed.push(url);return true;}})}});
 try{
  offline.saveOfflineRegistry({a:{trackId:'a',audioUrl:'https://audio.example/a.mp3',cachedAt:Date.now(),lastListenedAt:Date.now()}});
  offline.handleTrackProgressOffline('a',95,100);
  assert.ok(offline.getOfflineRegistry().a);
  offline.handleTrackProgressOffline('a',96,100);
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(removed,['https://audio.example/a.mp3']);
  offline.saveOfflineRegistry({b:{trackId:'b',audioUrl:'https://audio.example/b.mp3',cachedAt:0,lastListenedAt:Date.now()-16*86400000}});
  assert.equal(offline.purgeStaleOfflineTracks(),1);
  await Promise.resolve();await Promise.resolve();
  assert.equal(removed[1],'https://audio.example/b.mp3');
 }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete (globalThis as any)[key];else (globalThis as any)[key]=value;}}
});


test('category order rejects malformed and stale lists without writing, then preserves CRUD order', async () => {
  const db = database();
  let batches = 0;
  const batch = db.batch;
  db.batch = async statements => { batches++; return batch(statements); };
  const request = async (path: string, method = 'GET', body?: any) => {
    const response = await worker.fetch(new Request('https://test.example' + path, {
      method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    }), { DB: db });
    return { status: response.status, data: await response.json() as any };
  };
  const original = (await request('/api/categories')).data as string[];
  const reversed = [...original].reverse();
  for (const categories of [undefined, 'bad', [1], [''], [...original, original[0]], original.slice(1), [...original.slice(1), '不存在']]) {
    const result = await request('/api/categories/order', 'PUT', { categories });
    assert.ok(result.status === 400 || result.status === 409);
    assert.equal(batches, 0);
    assert.deepEqual((await request('/api/categories')).data, original);
  }
  assert.equal((await request('/api/categories/order', 'PUT', null)).status, 400);
  assert.equal((await request('/api/categories/order', 'PUT', [])).status, 400);
  assert.equal(batches, 0);
  const saved = await request('/api/categories/order', 'PUT', { categories: reversed.map(name => ` ${name} `) });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data.categories, reversed);
  assert.equal(batches, 1);
  assert.deepEqual((await request('/api/categories')).data, reversed);
  const added = await request('/api/categories', 'POST', { name: '測試分類' });
  assert.deepEqual(added.data.categories, [...reversed, '測試分類']);
  const renamed = await request('/api/categories/' + encodeURIComponent(reversed[0]), 'PUT', { newName: '改名分類' });
  assert.deepEqual(renamed.data.categories, ['改名分類', ...reversed.slice(1), '測試分類']);
  const removed = await request('/api/categories/' + encodeURIComponent('改名分類'), 'DELETE');
  assert.deepEqual(removed.data.categories, [...reversed.slice(1), '測試分類']);
  const legacy = await request('/api/categories/order', 'PUT', { order: removed.data.categories });
  assert.equal(legacy.status, 200);
  db.sqlite.close();
});
