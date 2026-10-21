// Test key and the last-test line (06-16, G6): one 1-unit videos.list call,
// a plain reason on failure, one audit row per test, and a newer key change
// resets the line to "Not tested yet". Fake YouTube client; no live call.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  readLastKeyTestCore,
  testYouTubeKeyCore,
} from '../../src/lib/admin/youtube-key-status.ts'
import {
  YouTubeApiError,
  type YouTubeClientLike,
  type YouTubeVideoResource,
} from '../../src/server/youtube/client.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const ADMIN = 'admin-1'

function fakeYouTube(fail?: Error) {
  const calls: string[][] = []
  const client: YouTubeClientLike = {
    async getPlaylist() {
      throw new Error('not used')
    },
    async listPlaylistItemsPage() {
      throw new Error('not used')
    },
    async getVideos(ids) {
      calls.push(ids)
      if (fail) throw fail
      return new Map<string, YouTubeVideoResource>()
    },
  }
  return { client, calls }
}

function setup(episodes: Array<Record<string, unknown>> = []) {
  const fake = createFakeSupabase({ episodes })
  const deps = { audit: fake.auditWriter, adminUserId: ADMIN }
  return { fake, deps }
}

test('a working key returns ok and writes one youtube_key_test audit row', async () => {
  const { fake, deps } = setup([
    { id: 'e1', youtube_video_id: 'archVideo01', archived: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'e2', youtube_video_id: 'liveVideo01', archived: false, created_at: '2025-01-02T00:00:00Z' },
    { id: 'e3', youtube_video_id: 'liveVideo02', archived: false, created_at: '2025-01-03T00:00:00Z' },
  ])
  const yt = fakeYouTube()
  const r = await testYouTubeKeyCore(fake.client, deps, yt.client)
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(yt.calls, [['liveVideo01']])
  const rows = fake.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'config_update')
  assert.equal(rows[0]!.entity_type, 'app_config')
  assert.equal(rows[0]!.entity_id, '1')
  assert.equal(rows[0]!.admin_user_id, ADMIN)
  assert.deepEqual(rows[0]!.diff, { kind: 'youtube_key_test', ok: true })
})

test('with no live episode the probe is a fixed well-formed 11-character id', async () => {
  const { fake, deps } = setup([
    { id: 'e1', youtube_video_id: 'archVideo01', archived: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'e2', youtube_video_id: null, archived: false, created_at: '2025-01-02T00:00:00Z' },
    { id: 'e3', youtube_video_id: '', archived: false, created_at: '2025-01-03T00:00:00Z' },
  ])
  const yt = fakeYouTube()
  assert.deepEqual(await testYouTubeKeyCore(fake.client, deps, yt.client), { ok: true })
  assert.equal(yt.calls.length, 1)
  assert.equal(yt.calls[0]!.length, 1)
  assert.match(yt.calls[0]![0]!, /^[A-Za-z0-9_-]{11}$/)
})

test('a failed episode read still probes with the fixed id', async () => {
  const { fake, deps } = setup()
  fake.failOn({ table: 'episodes', op: 'select', nth: 1 })
  const yt = fakeYouTube()
  assert.deepEqual(await testYouTubeKeyCore(fake.client, deps, yt.client), { ok: true })
  assert.match(yt.calls[0]![0]!, /^[A-Za-z0-9_-]{11}$/)
})

const CASES: Array<[Error, string]> = [
  [new YouTubeApiError('key_rejected', 400, 'keyInvalid'), 'rejected'],
  [new YouTubeApiError('api_not_allowed', 403, 'accessNotConfigured'), 'apiNotAllowed'],
  [new YouTubeApiError('quota', 403, 'quotaExceeded'), 'quota'],
  [new YouTubeApiError('network', null, null), 'network'],
  [new Error('socket hang up'), 'network'],
]

for (const [err, reason] of CASES) {
  test(`a client error (${err.message}) gives ok false, reason ${reason}, and an audit row`, async () => {
    const { fake, deps } = setup()
    const yt = fakeYouTube(err)
    const r = await testYouTubeKeyCore(fake.client, deps, yt.client)
    assert.deepEqual(r, { ok: false, reason })
    assert.equal(yt.calls.length, 1)
    const rows = fake.auditRows()
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0]!.diff, { kind: 'youtube_key_test', ok: false, reason })
  })
}

test('a null client gives reason missing and makes no YouTube call', async () => {
  const { fake, deps } = setup()
  const r = await testYouTubeKeyCore(fake.client, deps, null)
  assert.deepEqual(r, { ok: false, reason: 'missing' })
  assert.equal(fake.calls.filter((c) => c.table === 'episodes').length, 0)
})

test('an audit failure is reported, not swallowed', async () => {
  const { fake, deps } = setup()
  fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await testYouTubeKeyCore(fake.client, deps, fakeYouTube().client)
  assert.equal(r.ok, true)
  assert.ok(typeof r.auditError === 'string' && r.auditError.length > 0)
})

function auditRow(created_at: string, diff: Record<string, unknown> | null, over: Record<string, unknown> = {}) {
  return {
    id: created_at,
    admin_user_id: ADMIN,
    action_type: 'config_update',
    entity_type: 'app_config',
    entity_id: '1',
    diff,
    created_at,
    ...over,
  }
}

test('readLastKeyTestCore returns the newest youtube_key_test row', async () => {
  const fake = createFakeSupabase({
    admin_audit_log: [
      auditRow('2026-10-20T10:00:00.000Z', { kind: 'youtube_key_changed', last4: 'abcd' }),
      auditRow('2026-10-20T11:00:00.000Z', { kind: 'youtube_key_test', ok: false, reason: 'quota' }),
      auditRow('2026-10-20T12:00:00.000Z', { kind: 'youtube_key_test', ok: true }),
      auditRow('2026-10-20T13:00:00.000Z', { keys: ['site_name'] }),
      auditRow('2026-10-20T14:00:00.000Z', null),
      auditRow('2026-10-20T15:00:00.000Z', { kind: 'youtube_key_test', ok: false, reason: 'rejected' }, { entity_type: 'episode' }),
    ],
  })
  assert.deepEqual(await readLastKeyTestCore(fake.client), {
    at: '2026-10-20T12:00:00.000Z',
    ok: true,
    reason: null,
  })
  const read = fake.calls.find((c) => c.table === 'admin_audit_log' && c.op === 'select')
  assert.ok(read)
  assert.deepEqual(
    read.filters.map((f) => [f.kind, f.col, (f as { value?: unknown }).value]),
    [
      ['eq', 'entity_type', 'app_config'],
      ['eq', 'action_type', 'config_update'],
    ]
  )
})

test('readLastKeyTestCore returns a failed test with its reason', async () => {
  const fake = createFakeSupabase({
    admin_audit_log: [
      auditRow('2026-10-20T11:00:00.000Z', { kind: 'youtube_key_test', ok: false, reason: 'apiNotAllowed' }),
    ],
  })
  assert.deepEqual(await readLastKeyTestCore(fake.client), {
    at: '2026-10-20T11:00:00.000Z',
    ok: false,
    reason: 'apiNotAllowed',
  })
})

test('a newer youtube_key_changed row resets the line to not tested (null)', async () => {
  const fake = createFakeSupabase({
    admin_audit_log: [
      auditRow('2026-10-20T11:00:00.000Z', { kind: 'youtube_key_test', ok: true }),
      auditRow('2026-10-20T12:00:00.000Z', { kind: 'youtube_key_changed', last4: 'wxyz' }),
    ],
  })
  assert.equal(await readLastKeyTestCore(fake.client), null)
})

test('readLastKeyTestCore returns null with no rows or on a read error', async () => {
  assert.equal(await readLastKeyTestCore(createFakeSupabase().client), null)
  const fake = createFakeSupabase({
    admin_audit_log: [auditRow('2026-10-20T11:00:00.000Z', { kind: 'youtube_key_test', ok: true })],
  })
  fake.failOn({ table: 'admin_audit_log', op: 'select', nth: 1 })
  assert.equal(await readLastKeyTestCore(fake.client), null)
})
