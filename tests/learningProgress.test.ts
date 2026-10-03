import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePlaybackRows, summarizePlaybackRecords } from '../shared/learningProgress';

test('same member and track keeps completed 100 percent across legacy email/id rows', () => {
  const records = mergePlaybackRows([
    {
      trackId: 'track-a',
      userIdentifier: 'member@example.com',
      currentTime: 340,
      duration: 1000,
      progressPercent: 34,
      completed: 0,
      firstListenDate: '2026/10/01',
      lastListenDate: '2026/10/02',
      lastPlayedAt: 100
    },
    {
      trackId: 'track-a',
      userIdentifier: 'user-123',
      currentTime: 1000,
      duration: 1000,
      progressPercent: 100,
      completed: 1,
      firstListenDate: '2026/10/01',
      lastListenDate: '2026/10/03',
      finishDate: '2026/10/03',
      lastPlayedAt: 200
    },
    {
      trackId: 'track-a',
      userIdentifier: 'member@example.com',
      currentTime: 50,
      duration: 1000,
      progressPercent: 5,
      completed: 0,
      firstListenDate: '2026/10/01',
      lastListenDate: '2026/10/04',
      lastPlayedAt: 300
    }
  ], {
    'track-a': { id: 'track-a', title: 'A', speaker: '講者', durationSeconds: 1000 }
  });

  assert.equal(Object.keys(records).length, 1);
  assert.equal(records['track-a'].completed, true);
  assert.equal(records['track-a'].progressPercent, 100);
  assert.equal(records['track-a'].currentTime, 1000);
  assert.equal(records['track-a'].firstListenDate, '2026/10/01');
  assert.equal(records['track-a'].lastListenDate, '2026/10/04');
  assert.equal(records['track-a'].finishDate, '2026/10/03');
});

test('summary counts each track once and uses canonical highest progress', () => {
  const records = mergePlaybackRows([
    { trackId: 'a', userIdentifier: 'mail', duration: 600, currentTime: 600, progressPercent: 100, completed: 1 },
    { trackId: 'a', userIdentifier: 'id', duration: 600, currentTime: 200, progressPercent: 33, completed: 0 },
    { trackId: 'b', userIdentifier: 'mail', duration: 1200, currentTime: 600, progressPercent: 50, completed: 0 }
  ]);
  const stats = summarizePlaybackRecords(records);

  assert.equal(stats.totalCount, 2);
  assert.equal(stats.completedCount, 1);
  assert.equal(stats.unfinishedCount, 1);
  assert.equal(stats.averageProgress, 75);
  assert.equal(stats.totalMinutes, 20);
  assert.equal(stats.listenedHours, 0.3);
});

test('finish date always makes a legacy row canonical 100 percent', () => {
  const records = mergePlaybackRows([
    {
      trackId: 'finished',
      duration: 1800,
      currentTime: 120,
      progressPercent: 7,
      completed: 0,
      finishDate: '2026/09/30'
    }
  ]);
  assert.equal(records.finished.completed, true);
  assert.equal(records.finished.progressPercent, 100);
  assert.equal(records.finished.currentTime, 1800);
});
