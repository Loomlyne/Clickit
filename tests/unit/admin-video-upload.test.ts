import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { removeHeroVideoCore, saveVideoCore, setHeroVideoUrlCore } from '../../src/lib/admin/hero-video.ts'
import { MEDIA_SAVE_CONFLICT } from '../../src/server/media-references.ts'
import { rowVersion, type RowVersion } from '../../src/lib/admin/row-version.ts'
import {
  MB,
  NEW_KEY,
  NEW_MOBILE_KEY,
  NEW_PRELOADER_KEY,
  NEW_SHOW_KEY,
  OLD_KEY,
  OLD_URL,
  ORIGIN,
  SHOW_ID,
  SUPABASE_URL,
  appConfig,
  showRow,
  videoWorld,
} from './helpers/video-world.ts'

const FASTSTART_MESSAGE =
  'Video is not fast-start. Export it with fast start (moov at the beginning) and upload again.'

test('hero-desktop: range read of 4 MiB only, writes url + type, previous R2 key deleted after audit', async () => {
  const w = videoWorld()
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, true)
  assert.equal(r.data, `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.calls.readHead, [[NEW_KEY, 4 * 1024 * 1024]])
  assert.equal(appConfig(w).hero_video_url, `${ORIGIN}/${NEW_KEY}`)
  assert.equal(appConfig(w).hero_video_type, 'mp4')
  assert.deepEqual(w.calls.stage, [[OLD_KEY]])
  assert.deepEqual(w.log.slice(-3), ['update', 'audit', 'commit'])
  assert.deepEqual(w.calls.finalize[0], {
    kind: 'hero-video',
    slot: 'desktop',
    showId: null,
    userId: 'admin-1',
    key: NEW_KEY,
  })
})

test('a small video asks for its own size, never more than the object holds', async () => {
  const w = videoWorld({ headSize: 3000 })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, true)
  assert.deepEqual(w.calls.readHead, [[NEW_KEY, 3000]])
})

test('hero-mobile writes the mobile columns and leaves desktop alone', async () => {
  const w = videoWorld()
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_MOBILE_KEY, target: 'hero-mobile' })
  assert.equal(r.success, true)
  assert.equal(appConfig(w).hero_video_mobile_url, `${ORIGIN}/${NEW_MOBILE_KEY}`)
  assert.equal(appConfig(w).hero_video_mobile_type, 'mp4')
  assert.equal(appConfig(w).hero_video_url, OLD_URL)
  assert.deepEqual(w.calls.stage, [])
  assert.equal((w.fake.auditRows()[0]!.diff as Record<string, unknown>).slot, 'hero_mobile')
})

test('a previous Supabase Storage url is never deleted', async () => {
  const w = videoWorld({ heroUrl: SUPABASE_URL })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, true)
  assert.deepEqual(w.calls.stage, [])
  assert.deepEqual(w.calls.delete, [])
  assert.equal(w.log.includes('commit'), false)
  assert.equal(appConfig(w).hero_video_url, `${ORIGIN}/${NEW_KEY}`)
})

test('not fast-start: exact message, object deleted, no db call, no audit', async () => {
  const w = videoWorld({ layout: 'slow' })
  const before = w.fake.snapshot()
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, FASTSTART_MESSAGE)
  assert.deepEqual(w.calls.delete, [[NEW_KEY]])
  assert.ok(!w.log.includes('update'))
  assert.deepEqual(w.fake.snapshot(), before)
  assert.equal(w.fake.auditRows().length, 0)
  // Only the live-key read (01.1) runs; nothing is written.
  assert.deepEqual(w.fake.calls.filter((c) => c.op !== 'select'), [])
})

test('fast-start cannot be proven (no moov or mdat in the head): refused like not fast-start', async () => {
  const w = videoWorld({ layout: 'unknown' })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_PRELOADER_KEY, target: 'preloader' })
  assert.equal(r.success, false)
  assert.equal(r.error, FASTSTART_MESSAGE)
  assert.deepEqual(w.calls.delete, [[NEW_PRELOADER_KEY]])
})

test('not fast-start with a failed removal says the file could not be removed', async () => {
  const w = videoWorld({ layout: 'slow', deleteFails: true })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_SHOW_KEY, target: 'show', showId: SHOW_ID, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /not fast-start/)
  assert.match(r.error!, /The uploaded file could not be removed\./)
})

test('size over 50 MB (head): 01.1 message, object deleted, nothing read or written', async () => {
  const w = videoWorld({ headSize: 50 * MB + 1 })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Video must be under 50MB')
  assert.deepEqual(w.calls.delete, [[NEW_KEY]])
  assert.equal(w.calls.readHead.length, 0)
  // Only the live-key read (01.1) runs; nothing is written.
  assert.deepEqual(w.fake.calls.filter((c) => c.op !== 'select'), [])
})

test('size exactly 50 MB is accepted; a preloader over 20 MB is refused with the 20MB message', async () => {
  const ok = videoWorld({ headSize: 50 * MB })
  assert.equal((await saveVideoCore(ok.ports, ok.deps, { key: NEW_KEY, target: 'hero-desktop' })).success, true)
  const w = videoWorld({ headSize: 21 * MB })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_PRELOADER_KEY, target: 'preloader' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Video must be under 20MB')
  assert.deepEqual(w.calls.delete, [[NEW_PRELOADER_KEY]])
})

test('head says the object is gone or empty: refused', async () => {
  const gone = videoWorld({ headSize: null })
  const r = await saveVideoCore(gone.ports, gone.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Upload not found')
  const empty = videoWorld({ headSize: 0 })
  const r2 = await saveVideoCore(empty.ports, empty.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r2.success, false)
  assert.deepEqual(empty.calls.delete, [[NEW_KEY]])
})

test('range read returns nothing: refused and the object removed', async () => {
  const w = videoWorld({ readNull: true })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Could not verify uploaded video')
  assert.deepEqual(w.calls.delete, [[NEW_KEY]])
  // Only the live-key read (01.1) runs; nothing is written.
  assert.deepEqual(w.fake.calls.filter((c) => c.op !== 'select'), [])
})

test('hero without audio is refused (01.1 message); preloader and show do not need audio', async () => {
  const hero = videoWorld({ audio: false })
  const r = await saveVideoCore(hero.ports, hero.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /no audio track/)
  const mobile = videoWorld({ audio: false })
  const rm = await saveVideoCore(mobile.ports, mobile.deps, { key: NEW_MOBILE_KEY, target: 'hero-mobile' })
  assert.equal(rm.success, false)
  const pre = videoWorld({ audio: false })
  assert.equal((await saveVideoCore(pre.ports, pre.deps, { key: NEW_PRELOADER_KEY, target: 'preloader' })).success, true)
  const show = videoWorld({ audio: false })
  assert.equal(
    (await saveVideoCore(show.ports, show.deps, { key: NEW_SHOW_KEY, target: 'show', showId: SHOW_ID, variant: 'desktop' })).success,
    true
  )
})

test('finalize refusal is returned as is: nothing else runs, nothing is deleted by the core', async () => {
  const w = videoWorld({ finalizeError: 'File content does not match its declared type.' })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'File content does not match its declared type.')
  assert.deepEqual(w.log, ['finalize'])
})

test('media host not ready: refused before finalize touches anything', async () => {
  const w = videoWorld({ mediaOrigin: null })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Media host is not ready')
  assert.deepEqual(w.log, [])
})

test('a key that is not the shape for the target is refused and nothing is deleted', async () => {
  const w = videoWorld()
  // a mobile key sent as desktop, a preloader key sent as hero, another show id
  for (const [key, target] of [
    [NEW_MOBILE_KEY, 'hero-desktop'],
    [NEW_PRELOADER_KEY, 'hero-desktop'],
    [NEW_KEY, 'preloader'],
  ] as const) {
    const r = await saveVideoCore(w.ports, w.deps, { key, target })
    assert.equal(r.success, false, `${key} as ${target}`)
    assert.equal(r.error, 'Invalid upload key')
  }
  const other = await saveVideoCore(w.ports, w.deps, {
    key: NEW_SHOW_KEY.replace(SHOW_ID, '11111111-1111-4111-8111-111111111111'),
    target: 'show',
    showId: SHOW_ID,
    variant: 'desktop',
  })
  assert.equal(other.error, 'Invalid upload key')
  assert.deepEqual(w.calls.delete, [])
  // Only the live-key read (01.1) runs; nothing is written.
  assert.deepEqual(w.fake.calls.filter((c) => c.op !== 'select'), [])
})

test('invalid target, key and variant touch nothing', async () => {
  const w = videoWorld()
  assert.equal((await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'sidebar' })).error, 'Invalid video target.')
  assert.equal((await saveVideoCore(w.ports, w.deps, { key: '', target: 'hero-desktop' })).error, 'Invalid upload path')
  assert.equal((await saveVideoCore(w.ports, w.deps, { key: 'x'.repeat(301), target: 'hero-desktop' })).error, 'Invalid upload path')
  assert.equal((await saveVideoCore(w.ports, w.deps, { key: {}, target: 'hero-desktop' })).error, 'Invalid upload path')
  assert.equal(
    (await saveVideoCore(w.ports, w.deps, { key: NEW_SHOW_KEY, target: 'show', showId: SHOW_ID, variant: 'tablet' })).error,
    'Invalid hero variant.'
  )
  assert.deepEqual(w.log, [])
})

test('preloader writes preloader_video_url, audits it, deletes the previous R2 object', async () => {
  const oldKey = 'site-assets/preloader/video-1700000000000-cccccccc.mp4'
  const w = videoWorld({ preloaderUrl: `${ORIGIN}/${oldKey}` })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_PRELOADER_KEY, target: 'preloader' })
  assert.equal(r.success, true)
  assert.equal(appConfig(w).preloader_video_url, `${ORIGIN}/${NEW_PRELOADER_KEY}`)
  assert.equal(appConfig(w).hero_video_url, OLD_URL, 'hero columns untouched')
  assert.deepEqual(w.calls.stage, [[oldKey]])
  assert.deepEqual(w.log.slice(-3), ['update', 'audit', 'commit'])
  const audit = w.fake.auditRows()[0]!
  assert.equal(audit.action_type, 'upload')
  assert.equal((audit.diff as Record<string, unknown>).slot, 'preloader')
  assert.equal((audit.diff as Record<string, unknown>).previous_path, oldKey)
  assert.deepEqual(w.calls.finalize[0], {
    kind: 'preloader-video',
    slot: null,
    showId: null,
    userId: 'admin-1',
    key: NEW_PRELOADER_KEY,
  })
})

test('preloader forced audit failure restores the value, deletes the new object, keeps the old', async () => {
  const oldKey = 'site-assets/preloader/video-1700000000000-cccccccc.mp4'
  const w = videoWorld({ preloaderUrl: `${ORIGIN}/${oldKey}` })
  const before = w.fake.snapshot({ exclude: ['admin_audit_log'] })
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_PRELOADER_KEY, target: 'preloader' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.match(r.error!, /Could not write the audit record/)
  assert.deepEqual(w.fake.snapshot({ exclude: ['admin_audit_log'] }), before)
  assert.deepEqual(w.calls.delete, [[NEW_PRELOADER_KEY]])
  assert.equal(w.calls.rollback, 1)
  assert.equal(w.calls.commit, 0)
})

test('show target writes the show columns for its variant, with the type', async () => {
  const oldKey = `site-assets/shows/${SHOW_ID}/hero-desktop-1700000000000-dddddddd.mp4`
  const w = videoWorld({ showUrl: `${ORIGIN}/${oldKey}` })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_SHOW_KEY, target: 'show', showId: SHOW_ID, variant: 'desktop' })
  assert.equal(r.success, true)
  assert.equal(showRow(w).hero_video_url, `${ORIGIN}/${NEW_SHOW_KEY}`)
  assert.equal(showRow(w).hero_video_type, 'mp4')
  assert.equal(showRow(w).hero_video_mobile_url, null)
  assert.deepEqual(w.calls.stage, [[oldKey]])
  const audit = w.fake.auditRows()[0]!
  assert.equal((audit.diff as Record<string, unknown>).slot, 'show_desktop')
  assert.equal((audit.diff as Record<string, unknown>).show_id, SHOW_ID)
  assert.deepEqual(w.calls.finalize[0], {
    kind: 'show-video',
    slot: 'desktop',
    showId: SHOW_ID,
    userId: 'admin-1',
    key: NEW_SHOW_KEY,
  })
})

test('show mobile variant writes the mobile columns', async () => {
  const w = videoWorld()
  const key = `site-assets/shows/${SHOW_ID}/hero-mobile-1700000009999-bbbbbbbb.mp4`
  const r = await saveVideoCore(w.ports, w.deps, { key, target: 'show', showId: SHOW_ID, variant: 'mobile' })
  assert.equal(r.success, true)
  assert.equal(showRow(w).hero_video_mobile_url, `${ORIGIN}/${key}`)
  assert.equal(showRow(w).hero_video_mobile_type, 'mp4')
  assert.equal(showRow(w).hero_video_url, null)
})

test('show target refuses a non-uuid showId before anything runs', async () => {
  const w = videoWorld()
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_SHOW_KEY, target: 'show', showId: 'not-a-uuid', variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Invalid show id.')
  assert.deepEqual(w.log, [])
})

test('show forced audit failure restores the show row and deletes the new object', async () => {
  const oldKey = `site-assets/shows/${SHOW_ID}/hero-desktop-1700000000000-dddddddd.mp4`
  const w = videoWorld({ showUrl: `${ORIGIN}/${oldKey}` })
  const before = w.fake.snapshot({ exclude: ['admin_audit_log'] })
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_SHOW_KEY, target: 'show', showId: SHOW_ID, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.deepEqual(w.fake.snapshot({ exclude: ['admin_audit_log'] }), before)
  assert.deepEqual(w.calls.delete, [[NEW_SHOW_KEY]])
  assert.equal(w.calls.commit, 0)
})

test('show with commit false writes no row and deletes no previous object, but still audits the upload', async () => {
  const oldKey = `site-assets/shows/${SHOW_ID}/hero-desktop-1700000000000-dddddddd.mp4`
  const w = videoWorld({ showUrl: `${ORIGIN}/${oldKey}` })
  const before = w.fake.snapshot({ exclude: ['admin_audit_log'] })
  const r = await saveVideoCore(w.ports, w.deps, {
    key: NEW_SHOW_KEY,
    target: 'show',
    showId: SHOW_ID,
    variant: 'desktop',
    commit: false,
  })
  assert.equal(r.success, true)
  assert.equal(r.wrote, false)
  assert.equal(r.data, `${ORIGIN}/${NEW_SHOW_KEY}`)
  assert.deepEqual(w.fake.snapshot({ exclude: ['admin_audit_log'] }), before)
  assert.deepEqual(w.calls.stage, [])
  assert.equal(w.fake.auditRows().length, 1)
})

test('show with commit false and a failed audit deletes the new object', async () => {
  const w = videoWorld()
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await saveVideoCore(w.ports, w.deps, {
    key: NEW_SHOW_KEY,
    target: 'show',
    showId: SHOW_ID,
    variant: 'desktop',
    commit: false,
  })
  assert.equal(r.success, false)
  assert.deepEqual(w.calls.delete, [[NEW_SHOW_KEY]])
})

test('show that does not exist: refused, new object deleted', async () => {
  const w = videoWorld()
  const other = '22222222-2222-4222-8222-222222222222'
  const key = `site-assets/shows/${other}/hero-desktop-1700000009999-bbbbbbbb.mp4`
  const r = await saveVideoCore(w.ports, w.deps, { key, target: 'show', showId: other, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.deepEqual(w.calls.delete, [[key]])
  assert.equal(w.fake.auditRows().length, 0)
})

// Phase 01.1 review (PR #23, 974922f): a key that is already live is refused before
// finalize, so no refusal, failed write or failed audit can delete the live file.
const LIVE_MESSAGE = 'This file is already the live video; upload a new file instead.'
function assertUntouched(w: ReturnType<typeof videoWorld>) {
  assert.deepEqual(w.calls.finalize, [])
  assert.deepEqual(w.calls.delete, [])
  assert.deepEqual(w.calls.stage, [])
  assert.ok(!w.log.includes('update'))
  assert.equal(w.fake.auditRows().length, 0)
}

test('hero: the live key (either variant) is refused and never touched', async () => {
  const w = videoWorld({ heroUrl: `${ORIGIN}/${NEW_KEY}?v=1` })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.deepEqual(r, { success: false, error: LIVE_MESSAGE, wrote: false })
  assertUntouched(w)
  assert.equal(appConfig(w).hero_video_url, `${ORIGIN}/${NEW_KEY}?v=1`)
})

test('preloader: the live key is refused and never touched', async () => {
  const w = videoWorld({ preloaderUrl: `${ORIGIN}/${NEW_PRELOADER_KEY}` })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_PRELOADER_KEY, target: 'preloader' })
  assert.deepEqual(r, { success: false, error: LIVE_MESSAGE, wrote: false })
  assertUntouched(w)
})

test('show (commit true and commit false): the live key is refused and never touched', async () => {
  for (const commit of [true, false]) {
    const w = videoWorld({ showUrl: `${ORIGIN}/${NEW_SHOW_KEY}` })
    const r = await saveVideoCore(w.ports, w.deps, {
      key: NEW_SHOW_KEY,
      target: 'show',
      showId: SHOW_ID,
      variant: 'desktop',
      commit,
    })
    assert.deepEqual(r, { success: false, error: LIVE_MESSAGE, wrote: false })
    assertUntouched(w)
    assert.equal(showRow(w).hero_video_url, `${ORIGIN}/${NEW_SHOW_KEY}`)
  }
})

// ---- shared references: a replaced key the other variant still uses is kept ----

test('hero: a new desktop video keeps the old key while the mobile slot still uses it', async () => {
  for (const mobile of [OLD_URL, `${OLD_URL}?v=4`]) {
    const w = videoWorld({ heroMobileUrl: mobile })
    const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
    assert.equal(r.success, true)
    assert.equal(appConfig(w).hero_video_url, `${ORIGIN}/${NEW_KEY}`)
    assert.equal(appConfig(w).hero_video_mobile_url, mobile)
    assert.deepEqual(w.calls.stage, [])
    assert.deepEqual(w.calls.delete, [])
  }
})

test('hero: a new mobile video keeps the old key while desktop still uses it', async () => {
  const w = videoWorld({ heroMobileUrl: OLD_URL })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_MOBILE_KEY, target: 'hero-mobile' })
  assert.equal(r.success, true)
  assert.equal(appConfig(w).hero_video_url, OLD_URL)
  assert.deepEqual(w.calls.stage, [])
})

test('show: a new desktop video keeps the old key while the show mobile slot still uses it', async () => {
  const w = videoWorld({ showUrl: OLD_URL, showMobileUrl: OLD_URL })
  const r = await saveVideoCore(w.ports, w.deps, {
    key: NEW_SHOW_KEY,
    target: 'show',
    showId: SHOW_ID,
    variant: 'desktop',
  })
  assert.equal(r.success, true)
  assert.equal(showRow(w).hero_video_mobile_url, OLD_URL)
  assert.deepEqual(w.calls.stage, [])
})

test('show: a different key in the other slot does not stop the replaced key going', async () => {
  const w = videoWorld({ showUrl: OLD_URL, showMobileUrl: `${ORIGIN}/site-assets/shows/${SHOW_ID}/hero-mobile-1.mp4` })
  const r = await saveVideoCore(w.ports, w.deps, {
    key: NEW_SHOW_KEY,
    target: 'show',
    showId: SHOW_ID,
    variant: 'desktop',
  })
  assert.equal(r.success, true)
  assert.deepEqual(w.calls.stage, [[OLD_KEY]])
})

// ---- deferred items 21-23: cross-scope references, guarded deletes, compare-and-swap ----

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const err = console.error
  const warn = console.warn
  console.error = () => {}
  console.warn = () => {}
  try {
    return await fn()
  } finally {
    console.error = err
    console.warn = warn
  }
}
const deletedKeys = (w: ReturnType<typeof videoWorld>) => w.calls.delete.flat()

test('cross-scope share kept on replace: the old homepage hero video is also a show hero video', async () => {
  const w = videoWorld({ realStage: true, showUrl: `${OLD_URL}?v=2` })
  const r = await quiet(() => saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' }))
  assert.equal(r.success, true)
  assert.equal(r.mediaCleanupFailed, undefined)
  assert.equal(appConfig(w).hero_video_url, `${ORIGIN}/${NEW_KEY}`)
  assert.ok(!deletedKeys(w).includes(OLD_KEY), 'the show still plays the old file')
})

test('guarded replace with no other reference deletes the old key', async () => {
  const w = videoWorld({ realStage: true })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, true)
  assert.ok(deletedKeys(w).includes(OLD_KEY))
})

test('cross-scope share kept on remove: the hero video is also the preloader', async () => {
  const w = videoWorld({ realStage: true, preloaderUrl: OLD_URL })
  const r = await quiet(() => removeHeroVideoCore(w.ports, w.deps, { variant: 'desktop' }))
  assert.equal(r.success, true)
  assert.equal(appConfig(w).hero_video_url, null)
  assert.ok(!deletedKeys(w).includes(OLD_KEY))
})

test('remove: a failed reference read at commit deletes nothing and flags the cleanup', async () => {
  const w = videoWorld({ realStage: true })
  // Reads: target slot and sibling (app_config); then the commit-time reference read (shows first fails).
  w.fake.failOn({ table: 'shows', op: 'select', nth: 1 })
  const r = await quiet(() => removeHeroVideoCore(w.ports, w.deps, { variant: 'desktop' }))
  assert.equal(r.success, true)
  assert.equal(r.mediaCleanupFailed, true)
  assert.deepEqual(w.calls.delete, [])
})

test('a key live in ANOTHER scope is refused before finalize (a refusal would delete it)', async () => {
  // NEW_KEY (a hero desktop key) was pasted as a show hero video; re-sending it for the hero must not touch it.
  const w = videoWorld({ showUrl: `${ORIGIN}/${NEW_KEY}`, headSize: 60 * MB })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.deepEqual(r, { success: false, error: LIVE_MESSAGE, wrote: false })
  assert.deepEqual(w.calls.finalize, [])
  assert.deepEqual(w.calls.delete, [])
  assert.equal(showRow(w).hero_video_url, `${ORIGIN}/${NEW_KEY}`)
})

test('the cross-scope reference read fails before finalize: refused, nothing finalized or deleted', async () => {
  const w = videoWorld()
  w.fake.failOn({ table: 'profiles', op: 'select', nth: 1 })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.deepEqual(w.calls.finalize, [])
  assert.deepEqual(w.calls.delete, [])
  assert.equal(appConfig(w).hero_video_url, OLD_URL)
})

test('CAS conflict on save: another admin saved first; their value stays, the live key is not deleted, the fresh upload is', async () => {
  const theirs = `${ORIGIN}/site-assets/hero/video-1700000005555-cccccccc.mp4`
  const w = videoWorld({
    beforeWrite: (t) => {
      t.app_config![0]!.hero_video_url = theirs
    },
  })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.deepEqual(r, { success: false, error: MEDIA_SAVE_CONFLICT, wrote: false })
  assert.equal(appConfig(w).hero_video_url, theirs)
  assert.deepEqual(w.calls.delete, [[NEW_KEY]])
  assert.equal(w.calls.commit, 0)
  assert.equal(w.fake.auditRows().length, 0)
})

test('CAS conflict on remove and on a YouTube url: nothing changes, nothing is deleted', async () => {
  for (const run of [
    (w: ReturnType<typeof videoWorld>) => removeHeroVideoCore(w.ports, w.deps, { variant: 'desktop' }),
    (w: ReturnType<typeof videoWorld>) =>
      setHeroVideoUrlCore(w.ports, w.deps, { canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk', variant: 'desktop' }),
  ]) {
    const theirs = `${ORIGIN}/site-assets/hero/video-1700000005555-cccccccc.mp4`
    const w = videoWorld({ beforeWrite: (t) => void (t.app_config![0]!.hero_video_url = theirs) })
    const r = await run(w)
    assert.equal(r.success, false)
    assert.equal(r.error, MEDIA_SAVE_CONFLICT)
    assert.equal(appConfig(w).hero_video_url, theirs)
    assert.deepEqual(w.calls.delete, [])
    assert.equal(w.calls.commit, 0)
  }
})

test('CAS conflict on a show video save (commit true)', async () => {
  const w = videoWorld({ showUrl: OLD_URL, beforeWrite: (t) => void (t.shows![0]!.hero_video_url = null) })
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_SHOW_KEY, target: 'show', showId: SHOW_ID, variant: 'desktop' })
  assert.equal(r.error, MEDIA_SAVE_CONFLICT)
  assert.equal(showRow(w).hero_video_url, null)
  assert.deepEqual(w.calls.delete, [[NEW_SHOW_KEY]])
})

test('audit failure with a failed restore: the new video is KEPT because the row still plays it', async () => {
  const w = videoWorld()
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  w.fake.failOn({ table: 'app_config', op: 'update', nth: 2 })
  const r = await quiet(() => saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' }))
  assert.equal(r.success, false)
  assert.match(r.error!, /Restoring the previous hero setting also failed/)
  assert.equal(appConfig(w).hero_video_url, `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.calls.delete, [])
})

// ---- source scan of the three finalize actions (plan 02-16, task 2) ----
const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function bodyOf(name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `${name} not found`)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

test('source scan: the three video finalize actions run through the runner and saveVideoCore', () => {
  for (const name of ['finalizeHeroVideoUpload', 'finalizePreloaderVideoUpload', 'finalizeShowVideoUpload']) {
    const b = bodyOf(name)
    assert.ok(b.includes('runAdminAction('), `${name} lacks runAdminAction(`)
    assert.ok(b.includes('saveVideoCore('), `${name} lacks saveVideoCore(`)
    assert.ok(b.includes('videoPorts('), `${name} lacks videoPorts(`)
    assert.ok(b.includes('safeParse('), `${name} lacks zod input parsing`)
    assert.ok(!/FormData|File\b|arrayBuffer|Blob/.test(b), `${name} must not handle file bytes`)
  }
  assert.ok(bodyOf('finalizeShowVideoUpload').includes('commit'))
  assert.ok(/showId: z\.string\(\)\.regex\(UUID_RE/.test(src))
  assert.ok(/key: z\.string\(\)\.min\(1\)\.max\(300\)/.test(src))
})

test('source scan: the R2 video ports read a 4 MiB range through the MEDIA binding and never download', () => {
  const start = src.indexOf('async function videoPorts(')
  assert.notEqual(start, -1)
  const end = src.indexOf('\nexport ', start)
  const ports = src.slice(start, end)
  assert.ok(ports.includes('finalizeUploadedObject('))
  assert.ok(ports.includes('env.MEDIA'))
  assert.ok(ports.includes('range: { offset: 0, length: maxBytes }'))
  assert.ok(!ports.includes('download('))
  assert.ok(!ports.includes('storage.from('), 'no Supabase Storage call: Supabase originals are never deleted')
  assert.ok(ports.includes('r2KeysForUrl('))
})

test('source scan: the old create*/save* video actions are gone (plan 02-19)', () => {
  for (const name of [
    'createHeroVideoUpload',
    'saveHeroVideoUpload',
    'createPreloaderVideoUpload',
    'savePreloaderVideoUpload',
    'createShowVideoUpload',
    'saveShowVideoUpload',
  ]) {
    assert.ok(!src.includes(`export async function ${name}(`), `${name} is back`)
  }
})

// ---- Deferred item 23 residual (b): hero and preloader writes from the settings page also
// check the page's updated_at (one chain for every form on the app_config row) ----

const STAMP = '2026-10-20T16:43:24.123456+00:00'
const versionOf = (v: string): RowVersion => {
  const r = rowVersion(v)
  assert.ok(r.ok)
  return r.value
}

test('hero and preloader writes with a stale page updated_at: conflict, nothing live changed or deleted', async () => {
  const runs: Array<(w: ReturnType<typeof videoWorld>) => Promise<{ success: boolean; error?: string }>> = [
    (w) => saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' }),
    (w) => saveVideoCore(w.ports, w.deps, { key: NEW_PRELOADER_KEY, target: 'preloader' }),
    (w) => removeHeroVideoCore(w.ports, w.deps, { variant: 'desktop' }),
    (w) =>
      setHeroVideoUrlCore(w.ports, w.deps, { canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk', variant: 'desktop' }),
  ]
  for (const run of runs) {
    const w = videoWorld()
    appConfig(w).updated_at = STAMP
    const version = versionOf('2026-10-20T16:43:20.000001+00:00')
    w.ports.appConfigVersion = version
    const before = structuredClone(appConfig(w))
    const r = await run(w)
    assert.equal(r.success, false)
    assert.equal(r.error, MEDIA_SAVE_CONFLICT)
    assert.deepEqual(appConfig(w), before)
    assert.equal(w.calls.commit, 0)
    assert.ok(!w.calls.delete.flat().includes(OLD_KEY))
    assert.equal(version.next, null)
  }
})

test('hero write with the fresh page updated_at lands and reports the new value', async () => {
  const w = videoWorld()
  appConfig(w).updated_at = STAMP
  const version = versionOf(STAMP)
  w.ports.appConfigVersion = version
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_KEY, target: 'hero-desktop' })
  assert.equal(r.success, true, r.error)
  assert.equal(appConfig(w).hero_video_url, `${ORIGIN}/${NEW_KEY}`)
  assert.equal(typeof version.next, 'string')
  assert.equal(version.next, appConfig(w).updated_at)
})

test('the page version never applies to a show video (it belongs to the shows row)', async () => {
  const w = videoWorld({ showUrl: OLD_URL })
  w.ports.appConfigVersion = versionOf('2026-10-20T16:43:20.000001+00:00')
  const r = await saveVideoCore(w.ports, w.deps, { key: NEW_SHOW_KEY, target: 'show', showId: SHOW_ID, variant: 'desktop' })
  assert.equal(r.success, true, r.error)
  assert.equal(showRow(w).hero_video_url, `${ORIGIN}/${NEW_SHOW_KEY}`)
})
