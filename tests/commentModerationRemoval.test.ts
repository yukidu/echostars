import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detailed = readFileSync(new URL('../src/components/CommentsSection.tsx', import.meta.url), 'utf8');
const quick = readFileSync(new URL('../src/components/CommentPreviewModal.tsx', import.meta.url), 'utf8');
const vip = readFileSync(new URL('../src/components/VipTracksTab.tsx', import.meta.url), 'utf8');

test('comment forms do not block text with the retired moderation word list', () => {
  for (const source of [detailed, quick]) {
    assert.doesNotMatch(source, /const\s+toxicWords\s*=/);
    assert.doesNotMatch(source, /智慧審核未通過/);
    assert.doesNotMatch(source, /Cloudflare Workers AI 智慧審核/);
    assert.match(source, /maxLength=\{2000\}/);
  }
});

test('comment submit buttons describe sending rather than moderation', () => {
  assert.doesNotMatch(detailed, /審核中\.\.\./);
  assert.match(detailed, /送出中\.\.\./);
  assert.match(quick, /送出中/);
});

test('VIP links use the short S-sequence plus numeric password contract', () => {
  assert.match(vip, /\/vip-share/);
  assert.match(vip, /\/share\/\$\{encodeURIComponent\(access\.shareSlug\)\}\?\$\{access\.password\}/);
  assert.match(vip, /\^\\d\{4,12\}\$/);
  assert.doesNotMatch(vip, /searchParams\.set\(['"](?:vipToken|trackId)['"]/);
  assert.doesNotMatch(vip, /[?&](?:vipToken|trackId)=/);
});
