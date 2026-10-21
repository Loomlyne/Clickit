import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEpisodeCore,
  createSeasonCore,
  deleteSeasonCore,
  updateEpisodeCore,
  updateSeasonCore,
} from '../../src/lib/admin/season-episode-writes.ts'
import type { VerifyOutcome } from '../../src/lib/admin/youtube-verify.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const S2 = id('b')
const SE1 = id('c')
const SE2 = id('d')
const E1 = id('e', 1)
const E2 = id('e', 2)
const E3 = id('e', 3) // archived, holds number 3
// updated_at as PostgREST returns it; every season/episode update call passes it (item 8).
const V0 = '2026-10-20T10:00:00.000001+00:00'

const ep = (eid: string, num: number, archived = false, season = SE1, show = S1): Row => ({
  id: eid,
  show_id: show,
  season_id: season,
  title: `Episode ${num}`,
  title_ar: `حلقة ${num}`,
  description: `Description ${num}`,
  description_ar: `وصف ${num}`,
  episode_number: num,
  youtube_video_id: null,
  duration: 600,
  status: 'draft',
  publish_at: null,
  archived,
  updated_at: V0,
})

function world(archiveAll = false) {
  return createFakeSupabase({
    shows: [
      { id: S1, title: 'Show 1', season_count: 1, episode_count: 2 },
      { id: S2, title: 'Show 2', season_count: 1, episode_count: 0 },
    ],
    seasons: [
      { id: SE1, show_id: S1, title: 'Season 1', title_ar: 'الموسم 1', season_number: 1, episode_count: 2, updated_at: V0 },
      { id: SE2, show_id: S2, title: 'Other', title_ar: 'آخر', season_number: 1, episode_count: 0, updated_at: V0 },
    ],
    episodes: [ep(E1, 1, archiveAll), ep(E2, 2, archiveAll), ep(E3, 3, true)],
  }, { updatedAtTables: ['seasons', 'episodes'] })
}

function deps(f: ReturnType<typeof world>) {
  const fills: Array<[unknown, unknown]> = []
  return {
    fills,
    audit: f.auditWriter,
    adminUserId: 'admin-1',
    fillArabic: async (en: string | null | undefined, ar: string | null | undefined) => {
      fills.push([en, ar])
      return (ar ?? '').trim() ? (ar as string) : `ar-${en}`
    },
  }
}

const row = (f: ReturnType<typeof world>, table: string, rid: string) =>
  f.snapshot()[table]!.find((r) => r.id === rid)
const dbOps = (f: ReturnType<typeof world>, table: string, op: string) =>
  f.calls.filter((c) => c.table === table && c.op === op)
const newEp = (over: Record<string, unknown> = {}) => ({
  show_id: S1,
  season_id: SE1,
  title: 'New ep',
  description: 'New description',
  episode_number: 4,
  status: 'draft',
  ...over,
})

test('updateSeasonCore: archived, bad number and empty title are refused, season unchanged', async () => {
  for (const bad of [{ archived: true }, { season_number: 0 }, { title: '' }]) {
    const f = world()
    const before = f.snapshot()
    const res = await updateSeasonCore(f.client, deps(f), SE1, bad, V0)
    assert.equal(res.success, false)
    assert.equal(res.wrote, false)
    assert.deepEqual(f.snapshot(), before)
    assert.equal(dbOps(f, 'seasons', 'update').length, 0)
  }
})

test('updateSeasonCore: show_id of another show is refused', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await updateSeasonCore(f.client, deps(f), SE1, { title: 'X', show_id: S2 }, V0)
  assert.equal(res.success, false)
  assert.equal(res.error, 'Season belongs to a different show.')
  assert.deepEqual(f.snapshot(), before)
})

test('updateSeasonCore: a title-only edit keeps the existing Arabic title', async () => {
  const f = world()
  const d = deps(f)
  const res = await updateSeasonCore(f.client, d, SE1, { title: 'New' }, V0)
  assert.equal(res.success, true)
  assert.equal(d.fills.length, 0)
  assert.equal(row(f, 'seasons', SE1)!.title, 'New')
  assert.equal(row(f, 'seasons', SE1)!.title_ar, 'الموسم 1')
})

test('updateSeasonCore: a blank title_ar is filled from the title', async () => {
  const f = world()
  const d = deps(f)
  const res = await updateSeasonCore(f.client, d, SE1, { title: 'New', title_ar: '' }, V0)
  assert.equal(res.success, true)
  assert.deepEqual(d.fills, [['New', null]])
  assert.equal(row(f, 'seasons', SE1)!.title_ar, 'ar-New')
})

test('updateSeasonCore: success writes one update season audit row with before/after', async () => {
  const f = world()
  const res = await updateSeasonCore(f.client, deps(f), SE1, { title: 'New', show_id: S1 }, V0)
  assert.equal(res.success, true)
  assert.equal(res.wrote, true)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'update')
  assert.equal(rows[0]!.entity_type, 'season')
  assert.equal(rows[0]!.entity_id, SE1)
  assert.equal(rows[0]!.diff.before.title, 'Season 1')
  assert.equal(rows[0]!.diff.after.title, 'New')
  assert.equal(dbOps(f, 'seasons', 'update')[0]!.patch.show_id, undefined)
})

test('deleteSeasonCore: malformed ids are refused', async () => {
  const f = world()
  const res = await deleteSeasonCore(f.client, deps(f), 'x', S1)
  assert.equal(res.success, false)
  assert.equal(res.error, 'Invalid season id.')
  assert.equal(dbOps(f, 'seasons', 'delete').length, 0)
})

test('deleteSeasonCore: a mismatched showId is refused and nothing is deleted', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await deleteSeasonCore(f.client, deps(f), SE1, S2)
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.deepEqual(f.snapshot(), before)
  assert.equal(dbOps(f, 'seasons', 'delete').length, 0)
})

test('deleteSeasonCore: a season with an active episode is refused, no audit row, nothing deleted', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await deleteSeasonCore(f.client, deps(f), SE1, S1)
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(res.error, 'Archive every episode in this season before deleting it.')
  assert.deepEqual(f.snapshot(), before)
  assert.equal(dbOps(f, 'seasons', 'delete').length, 0)
  assert.equal(f.auditRows().length, 0)
})

test('deleteSeasonCore: success writes pending before the delete, committed after, and recomputes counts', async () => {
  const f = world(true)
  const res = await deleteSeasonCore(f.client, deps(f), SE1, S1)
  assert.equal(res.success, true)
  assert.equal(res.wrote, true)
  assert.equal(row(f, 'seasons', SE1), undefined)
  const rows = f.auditRows().filter((r) => r.entity_type === 'season')
  assert.equal(rows.length, 2)
  assert.equal(rows[0]!.diff.outcome, 'pending')
  assert.equal(rows[1]!.diff.outcome, 'committed')
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
  assert.equal(rows[1]!.diff.title, 'Season 1')
  assert.equal(rows[1]!.diff.season_number, 1)
  assert.equal(rows[1]!.diff.show_id, S1)
  assert.deepEqual([...rows[1]!.diff.episode_ids].sort(), [E1, E2, E3].sort())
  const auditIdx = f.calls.findIndex((c) => c.table === 'admin_audit_log' && c.op === 'insert')
  const delIdx = f.calls.findIndex((c) => c.table === 'seasons' && c.op === 'delete')
  assert.ok(auditIdx >= 0 && auditIdx < delIdx)
  const s = row(f, 'shows', S1)!
  assert.equal(s.season_count, 0)
  // Every episode was archived first, so none is counted.
  assert.equal(s.episode_count, 0)
})

test('deleteSeasonCore: failed pending audit row deletes nothing', async () => {
  const f = world(true)
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const res = await deleteSeasonCore(f.client, deps(f), SE1, S1)
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(dbOps(f, 'seasons', 'delete').length, 0)
  assert.ok(row(f, 'seasons', SE1))
})

test('deleteSeasonCore: forced delete failure keeps the season and writes pending then failed', async () => {
  const f = world(true)
  f.failOn({ table: 'seasons', op: 'delete', nth: 1 })
  const res = await deleteSeasonCore(f.client, deps(f), SE1, S1)
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.equal((res.data as { showId?: string }).showId, S1)
  assert.ok(row(f, 'seasons', SE1))
  const rows = f.auditRows().filter((r) => r.entity_type === 'season')
  assert.equal(rows.length, 2)
  assert.equal(rows[0]!.diff.outcome, 'pending')
  assert.equal(rows[1]!.diff.outcome, 'failed')
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
  assert.equal(rows[1]!.diff.failed_step, 'delete-season')
  assert.match(rows[1]!.diff.error, /forced failure/)
  assert.deepEqual(rows[1]!.diff.undone, [])
  assert.deepEqual(rows[1]!.diff.left_in_place, [])
})

test('deleteSeasonCore: count failure after the delete is reported truthfully', async () => {
  const f = world(true)
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const res = await deleteSeasonCore(f.client, deps(f), SE1, S1)
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.match(res.error ?? '', /Season deleted, but the show counts could not be updated/)
  const rows = f.auditRows().filter((r) => r.entity_type === 'season')
  assert.equal(rows.length, 2)
  assert.equal(rows[1]!.diff.outcome, 'failed')
  assert.equal(rows[1]!.diff.failed_step, 'recompute-counts')
  assert.deepEqual(rows[1]!.diff.left_in_place, [{ step: 'delete-season', error: 'no undo defined' }])
})

test('createSeasonCore: success inserts, counts and audits', async () => {
  const f = world()
  const res = await createSeasonCore(f.client, deps(f), {
    show_id: S1,
    title: 'Season 2',
    season_number: 2,
  })
  assert.equal(res.success, true)
  assert.equal((res.data as { showId?: string }).showId, S1)
  assert.equal(row(f, 'shows', S1)!.season_count, 2)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'create')
  assert.equal(rows[0]!.entity_type, 'season')
})

test('createSeasonCore: count failure removes the inserted season', async () => {
  const f = world()
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const res = await createSeasonCore(f.client, deps(f), {
    show_id: S1,
    title: 'Season 2',
    season_number: 2,
  })
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.equal(f.snapshot().seasons!.length, 2)
})

test('createEpisodeCore: a season of another show is refused, nothing written', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await createEpisodeCore(f.client, deps(f), newEp({ season_id: SE2 }))
  assert.equal(res.success, false)
  assert.equal(res.error, 'Season does not belong to this show.')
  assert.equal(res.wrote, false)
  assert.deepEqual(f.snapshot(), before)
})

test('createEpisodeCore: insert failure restores the bumped archived episode and audits the failure', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'insert', nth: 1 })
  const res = await createEpisodeCore(f.client, deps(f), newEp({ episode_number: 3 }))
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.equal(row(f, 'episodes', E3)!.episode_number, 3)
  assert.equal(f.snapshot().episodes!.length, 3)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.outcome, 'failed')
})

test('createEpisodeCore: a failed bump attempts no insert', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'update', nth: 1 })
  const res = await createEpisodeCore(f.client, deps(f), newEp({ episode_number: 3 }))
  assert.equal(res.success, false)
  assert.match(res.error ?? '', /forced failure/)
  assert.equal(dbOps(f, 'episodes', 'insert').length, 0)
})

test('createEpisodeCore: success counts exclude archived episodes and writes an audit row', async () => {
  const f = world()
  const res = await createEpisodeCore(f.client, deps(f), newEp({ episode_number: 3 }))
  assert.equal(res.success, true)
  assert.equal(row(f, 'episodes', E3)!.episode_number, 4)
  assert.equal(row(f, 'seasons', SE1)!.episode_count, 3)
  assert.equal(row(f, 'shows', S1)!.episode_count, 3)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'create')
  assert.equal(rows[0]!.entity_type, 'episode')
})

test('updateEpisodeCore: archived, unknown column and bad status are refused, wrote false', async () => {
  for (const bad of [{ archived: true }, { status: 'live' }, { episode_count: 2 }]) {
    const f = world()
    const before = f.snapshot()
    const res = await updateEpisodeCore(f.client, deps(f), E1, bad, V0)
    assert.equal(res.success, false)
    assert.equal(res.wrote, false)
    assert.deepEqual(f.snapshot(), before)
  }
})

test('updateEpisodeCore: a different season_id is refused', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await updateEpisodeCore(f.client, deps(f), E1, { season_id: SE2 }, V0)
  assert.equal(res.success, false)
  assert.match(res.error ?? '', /different season/)
  assert.deepEqual(f.snapshot(), before)
})

test('updateEpisodeCore: a number held only by an archived episode bumps it', async () => {
  const f = world()
  const res = await updateEpisodeCore(f.client, deps(f), E1, { episode_number: 3 }, V0)
  assert.equal(res.success, true)
  assert.equal(row(f, 'episodes', E1)!.episode_number, 3)
  assert.equal(row(f, 'episodes', E3)!.episode_number, 4)
})

test('updateEpisodeCore: a number held by a visible episode is refused', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await updateEpisodeCore(f.client, deps(f), E1, { episode_number: 2 }, V0)
  assert.equal(res.success, false)
  assert.match(res.error ?? '', /already exists/)
  assert.deepEqual(f.snapshot(), before)
})

test('updateEpisodeCore: forced update failure undoes the bump, audits the failure, reports wrote and showId', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'update', nth: 2 })
  const res = await updateEpisodeCore(f.client, deps(f), E1, { episode_number: 3 }, V0)
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.equal((res.data as { showId?: string }).showId, S1)
  assert.equal(row(f, 'episodes', E3)!.episode_number, 3)
  assert.equal(row(f, 'episodes', E1)!.episode_number, 1)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.outcome, 'failed')
  assert.equal(rows[0]!.diff.failed_step, 'update-episode')
})

test('updateEpisodeCore: success writes an update episode audit row and does not patch show_id/season_id', async () => {
  const f = world()
  const res = await updateEpisodeCore(f.client, deps(f), E1, {
    title: 'Renamed',
    show_id: S1,
    season_id: SE1,
  }, V0)
  assert.equal(res.success, true)
  assert.equal(row(f, 'episodes', E1)!.title, 'Renamed')
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'update')
  assert.equal(rows[0]!.entity_type, 'episode')
  assert.equal(rows[0]!.diff.before.title, 'Episode 1')
  assert.equal(rows[0]!.diff.after.title, 'Renamed')
  const patch = dbOps(f, 'episodes', 'update')[0]!.patch
  assert.equal(patch.show_id, undefined)
  assert.equal(patch.season_id, undefined)
})

test('updateEpisodeCore: a title-only edit keeps the existing Arabic title', async () => {
  const f = world()
  const d = deps(f)
  const res = await updateEpisodeCore(f.client, d, E1, { title: 'Renamed' }, V0)
  assert.equal(res.success, true)
  assert.equal(d.fills.length, 0)
  assert.equal(row(f, 'episodes', E1)!.title_ar, 'حلقة 1')
})

// ---------------------------------------------------------------------------
// YouTube verify on save (YT-03, 06-06)
// ---------------------------------------------------------------------------

type Verify = (raw: string, opts: { excludeEpisodeId?: string }) => Promise<VerifyOutcome>

function verifier(answer: (raw: string) => VerifyOutcome) {
  const calls: Array<[string, { excludeEpisodeId?: string }]> = []
  const verifyVideo: Verify = async (raw, opts) => {
    calls.push([raw, opts])
    return answer(raw)
  }
  return { calls, verifyVideo }
}

const okMeta = (videoId: string): VerifyOutcome => ({
  ok: true,
  meta: {
    videoId,
    title: 'T',
    description: 'D',
    channelTitle: 'C',
    thumbnailUrl: null,
    durationSeconds: 600,
    durationMinutes: 10,
  },
})

test('createEpisodeCore: a verify refusal writes nothing and returns the typed code', async () => {
  const f = world()
  const before = f.snapshot()
  const v = verifier(() => ({
    ok: false,
    code: 'video_duplicate',
    params: { show: 'Show 2', season: 1, episode: 3 },
  }))
  const res = await createEpisodeCore(
    f.client,
    { ...deps(f), verifyVideo: v.verifyVideo },
    newEp({ youtube_video_id: 'dupVideo001' })
  )
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(res.error, 'This video is already on Clickit: Show 2 · Season 1 · Episode 3.')
  assert.deepEqual(res.data, {
    showId: S1,
    youtubeError: { code: 'video_duplicate', params: { show: 'Show 2', season: 1, episode: 3 } },
  })
  assert.deepEqual(f.snapshot(), before)
  assert.equal(dbOps(f, 'episodes', 'insert').length, 0)
  assert.deepEqual(v.calls, [['dupVideo001', {}]])
})

test('createEpisodeCore: key missing blocks saving a new video link (fail closed)', async () => {
  const f = world()
  const v = verifier(() => ({ ok: false, code: 'key_missing' }))
  const res = await createEpisodeCore(
    f.client,
    { ...deps(f), verifyVideo: v.verifyVideo },
    newEp({ youtube_video_id: 'okVideo0001' })
  )
  assert.equal(res.success, false)
  assert.equal(res.data?.youtubeError?.code, 'key_missing')
  assert.equal(dbOps(f, 'episodes', 'insert').length, 0)
})

test('createEpisodeCore: a full URL is stored as the normalized 11-char id', async () => {
  const f = world()
  const v = verifier(() => okMeta('okVideo0001'))
  const res = await createEpisodeCore(
    f.client,
    { ...deps(f), verifyVideo: v.verifyVideo },
    newEp({ youtube_video_id: 'https://www.youtube.com/watch?v=okVideo0001&t=3' })
  )
  assert.equal(res.success, true, res.error)
  const created = res.data!.episode as Row
  assert.equal(row(f, 'episodes', created.id)!.youtube_video_id, 'okVideo0001')
})

test('createEpisodeCore: no video id means no verify call', async () => {
  const f = world()
  const v = verifier(() => okMeta('x'))
  const res = await createEpisodeCore(f.client, { ...deps(f), verifyVideo: v.verifyVideo }, newEp())
  assert.equal(res.success, true)
  assert.equal(v.calls.length, 0)
})

test('createEpisodeCore: a verify that throws is returned as an error, nothing written', async () => {
  const f = world()
  const res = await createEpisodeCore(
    f.client,
    {
      ...deps(f),
      verifyVideo: async () => {
        throw new Error('lookup failed')
      },
    },
    newEp({ youtube_video_id: 'okVideo0001' })
  )
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(res.error, 'lookup failed')
  assert.equal(dbOps(f, 'episodes', 'insert').length, 0)
})

test('createEpisodeCore: a 23505 on the video index returns the duplicate message, not the number one', async () => {
  const f = world()
  // Race: another row takes the id after the verify said ok.
  f.tables.episodes!.push(ep(id('e', 90), 90, true, SE2, S2))
  f.tables.episodes!.at(-1)!.youtube_video_id = 'okVideo0001'
  const res = await createEpisodeCore(
    f.client,
    { ...deps(f), verifyVideo: verifier(() => okMeta('okVideo0001')).verifyVideo },
    newEp({ youtube_video_id: 'okVideo0001' })
  )
  assert.equal(res.success, false)
  assert.equal(res.error, 'This video is already on Clickit.')
  assert.equal(res.data?.youtubeError?.code, 'video_duplicate')
})

test('createEpisodeCore: without a verifyVideo dep the old path is unchanged', async () => {
  const f = world()
  const res = await createEpisodeCore(f.client, deps(f), newEp({ youtube_video_id: 'rawValue001' }))
  assert.equal(res.success, true)
  assert.equal(row(f, 'episodes', (res.data!.episode as Row).id)!.youtube_video_id, 'rawValue001')
})

test('updateEpisodeCore: verify runs only when the video id is present and changed', async () => {
  const f = world()
  f.tables.episodes!.find((e) => e.id === E1)!.youtube_video_id = 'storedVid01'
  const v = verifier((raw) => okMeta(raw.slice(-11)))
  const d = { ...deps(f), verifyVideo: v.verifyVideo }

  // Each save chains on the updated_at the previous one wrote (item 8).
  const at = () => row(f, 'episodes', E1)!.updated_at as string
  await updateEpisodeCore(f.client, d, E1, { title: 'Only title' }, at())
  await updateEpisodeCore(f.client, d, E1, { youtube_video_id: 'storedVid01' }, at())
  await updateEpisodeCore(f.client, d, E1, { youtube_video_id: 'https://youtu.be/storedVid01' }, at())
  assert.equal(v.calls.length, 0)
  assert.equal(row(f, 'episodes', E1)!.youtube_video_id, 'storedVid01')

  const res = await updateEpisodeCore(f.client, d, E1, { youtube_video_id: 'https://youtu.be/newVideo001' }, at())
  assert.equal(res.success, true, res.error)
  assert.deepEqual(v.calls, [['https://youtu.be/newVideo001', { excludeEpisodeId: E1 }]])
  assert.equal(row(f, 'episodes', E1)!.youtube_video_id, 'newVideo001')
})

test('updateEpisodeCore: a verify refusal leaves the episode unchanged with the typed code', async () => {
  const f = world()
  const before = f.snapshot()
  const v = verifier(() => ({ ok: false, code: 'video_private' }))
  const res = await updateEpisodeCore(f.client, { ...deps(f), verifyVideo: v.verifyVideo }, E1, {
    youtube_video_id: 'privVideo01',
    title: 'Changed',
  }, V0)
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.deepEqual(res.data, { showId: S1, youtubeError: { code: 'video_private' } })
  assert.deepEqual(f.snapshot(), before)
})

test('updateEpisodeCore: a 23505 on the video index returns the duplicate message', async () => {
  const f = world()
  f.tables.episodes!.find((e) => e.id === E2)!.youtube_video_id = 'takenVid001'
  const res = await updateEpisodeCore(
    f.client,
    { ...deps(f), verifyVideo: verifier(() => okMeta('takenVid001')).verifyVideo },
    E1,
    { youtube_video_id: 'takenVid001' },
    V0
  )
  assert.equal(res.success, false)
  assert.equal(res.error, 'This video is already on Clickit.')
  assert.equal(res.data?.youtubeError?.code, 'video_duplicate')
  assert.equal(row(f, 'episodes', E1)!.youtube_video_id, null)
})
