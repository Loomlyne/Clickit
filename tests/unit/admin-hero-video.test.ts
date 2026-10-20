import assert from 'node:assert/strict'
import test from 'node:test'
import {
  removeHeroVideoCore,
  saveHeroVideoCore,
  setHeroVideoUrlCore,
} from '../../src/lib/admin/hero-video.ts'
import { MB, NEW_KEY, OLD_KEY, OLD_URL, appConfig, videoWorld, type WorldOpts } from './helpers/video-world.ts'

const YT = 'https://www.youtube.com/watch?v=abcdefghijk'
const NEW_PATH = NEW_KEY

// 02-16: the ports now read R2 (head, readHead, delete) instead of Supabase Storage
// (info, download, remove, mirrorUpload). Every 01.1 test keeps its assertion; the
// renames are listed in 02-16-SUMMARY.md.
const setup = (opts: WorldOpts = {}) => videoWorld(opts)
const cfg = appConfig

test('setHeroVideoUrlCore success: stage, update, audit, commit', async () => {
  const s = setup()
  const r = await setHeroVideoUrlCore(s.ports, s.deps, { canonicalUrl: YT, variant: 'desktop' })
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.deepEqual(s.log, ['stage', 'update', 'audit', 'commit'])
  const rows = s.fake.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'config_update')
  assert.equal(rows[0]!.entity_type, 'app_config')
  assert.deepEqual(rows[0]!.diff, {
    variant: 'desktop',
    keys: ['hero_video_url', 'hero_video_type'],
    previous_url: OLD_URL,
  })
  assert.equal(cfg(s).hero_video_url, YT)
  assert.equal(cfg(s).hero_video_type, 'youtube')
  assert.deepEqual(s.calls.stage, [[OLD_KEY]])
})

test('setHeroVideoUrlCore forced audit failure restores config and rolls back', async () => {
  const s = setup()
  const before = s.fake.snapshot()
  s.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await setHeroVideoUrlCore(s.ports, s.deps, { canonicalUrl: YT, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.equal(r.error, 'Could not write the audit record; the hero video was not changed.')
  assert.deepEqual(s.fake.snapshot(), before)
  assert.equal(s.calls.rollback, 1)
  assert.equal(s.calls.commit, 0)
})

test('setHeroVideoUrlCore forced audit failure and restore failure names both', async () => {
  const s = setup()
  s.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  s.fake.failOn({ table: 'app_config', op: 'update', nth: 2 })
  const r = await setHeroVideoUrlCore(s.ports, s.deps, { canonicalUrl: YT, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /Could not write the audit record/)
  assert.match(r.error!, /Restoring the previous hero setting also failed/)
  assert.equal(s.calls.rollback, 1)
  assert.equal(s.calls.commit, 0)
})

test('setHeroVideoUrlCore config failure rolls back, no audit', async () => {
  const s = setup()
  s.fake.failOn({ table: 'app_config', op: 'update', nth: 1 })
  const r = await setHeroVideoUrlCore(s.ports, s.deps, { canonicalUrl: YT, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(s.calls.rollback, 1)
  assert.equal(s.calls.commit, 0)
  assert.equal(s.fake.auditRows().length, 0)
})

test('setHeroVideoUrlCore commit false after audit reports mediaCleanupFailed', async () => {
  const s = setup({ commitResult: false })
  const r = await setHeroVideoUrlCore(s.ports, s.deps, { canonicalUrl: YT, variant: 'desktop' })
  assert.equal(r.success, true)
  assert.equal(r.mediaCleanupFailed, true)
})

test('setHeroVideoUrlCore invalid variant refused', async () => {
  const s = setup()
  const r = await setHeroVideoUrlCore(s.ports, s.deps, { canonicalUrl: YT, variant: 'tablet' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Invalid hero variant.')
  assert.deepEqual(s.log, [])
})

test('removeHeroVideoCore success: stage, update null, audit, commit', async () => {
  const s = setup()
  const r = await removeHeroVideoCore(s.ports, s.deps, { variant: 'desktop' })
  assert.equal(r.success, true)
  assert.deepEqual(s.log, ['stage', 'update', 'audit', 'commit'])
  const rows = s.fake.auditRows()
  assert.equal(rows[0]!.action_type, 'remove_media')
  assert.deepEqual(rows[0]!.diff, { variant: 'desktop', previous_path: OLD_KEY })
  assert.equal(cfg(s).hero_video_url, null)
  assert.equal(cfg(s).hero_video_type, null)
})

test('removeHeroVideoCore forced audit failure restores config, no commit', async () => {
  const s = setup()
  const before = s.fake.snapshot()
  s.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await removeHeroVideoCore(s.ports, s.deps, { variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.ok(r.error)
  assert.deepEqual(s.fake.snapshot(), before)
  assert.equal(s.calls.rollback, 1)
  assert.equal(s.calls.commit, 0)
})

test('saveHeroVideoCore forged size: server size wins, object removed, never downloaded', async () => {
  const s = setup({ headSize: 60 * MB })
  const before = s.fake.snapshot()
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.match(r.error!, /Video must be under 50MB/)
  assert.deepEqual(s.calls.delete, [[NEW_PATH]])
  // never read: no range read of the file, let alone the whole file
  assert.equal(s.calls.readHead.length, 0)
  assert.deepEqual(s.fake.snapshot(), before)
  assert.equal(s.fake.auditRows().length, 0)
})

test('saveHeroVideoCore oversize head refused even when finalize said ok', async () => {
  // was "oversize downloaded blob refused after ok info": there is no download any more,
  // the second size proof is head() after finalize.
  const s = setup({ headSize: 60 * MB })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /Video must be under 50MB/)
  assert.deepEqual(s.calls.delete, [[NEW_PATH]])
  assert.ok(!s.log.includes('update'))
})

test('saveHeroVideoCore oversize blob with failed removal says so', async () => {
  const s = setup({ headSize: 60 * MB, deleteFails: true })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /could not be removed/)
})

test('saveHeroVideoCore no audio track refused; removal failure appended', async () => {
  const s = setup({ audio: false })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /no audio track/)
  assert.deepEqual(s.calls.delete, [[NEW_PATH]])
  const s2 = setup({ audio: false, deleteFails: true })
  const r2 = await saveHeroVideoCore(s2.ports, s2.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.match(r2.error!, /The uploaded file could not be removed\./)
})

test('saveHeroVideoCore success: finalize, head, readHead, stage, update, audit, commit', async () => {
  // was "success: info, download, mirror, stage, update, audit, commit"
  const s = setup()
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, true)
  assert.deepEqual(s.log, ['finalize', 'head', 'readHead', 'stage', 'update', 'audit', 'commit'])
  assert.equal(r.data, `https://media.test/${NEW_PATH}`)
  const row = cfg(s)
  assert.equal(row.hero_video_url, r.data)
  assert.equal(row.hero_video_type, 'mp4')
  assert.equal(row.hero_video_muted, true)
  const audit = s.fake.auditRows()[0]!
  assert.equal(audit.action_type, 'upload')
  assert.equal(audit.entity_type, 'storage')
  assert.equal((audit.diff as Record<string, unknown>).slot, 'hero_desktop')
  assert.equal((audit.diff as Record<string, unknown>).path, NEW_PATH)
  assert.equal((audit.diff as Record<string, unknown>).previous_path, OLD_KEY)
  assert.deepEqual(s.calls.stage, [[OLD_KEY]])
})

test('saveHeroVideoCore forced audit failure restores config, rolls back, cleans new upload', async () => {
  const s = setup()
  const before = s.fake.snapshot()
  s.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.deepEqual(s.fake.snapshot(), before)
  assert.equal(s.calls.rollback, 1)
  assert.deepEqual(s.calls.delete, [[NEW_PATH]])
  assert.equal(s.calls.commit, 0)
})

test('saveHeroVideoCore config update failure cleans new upload and rolls back', async () => {
  const s = setup()
  s.fake.failOn({ table: 'app_config', op: 'update', nth: 1 })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.deepEqual(s.calls.delete, [[NEW_PATH]])
  assert.equal(s.calls.rollback, 1)
  assert.equal(s.calls.commit, 0)
  assert.equal(s.fake.auditRows().length, 0)
})

test('saveHeroVideoCore bad path and bad variant touch no storage', async () => {
  const s = setup()
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: 42, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Invalid upload path')
  const r2 = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'tablet' })
  assert.equal(r2.error, 'Invalid hero variant.')
  assert.deepEqual(s.log, [])
  // a key that is not the minted hero shape is refused by finalize and nothing is deleted
  const r3 = await saveHeroVideoCore(s.ports, s.deps, { path: 'site-assets/hero/../x.mp4', variant: 'desktop' })
  assert.equal(r3.success, false)
  assert.equal(r3.error, 'Invalid upload key')
  assert.deepEqual(s.calls.delete, [])
  assert.ok(!s.log.includes('update'))
})

test('saveHeroVideoCore commit false after audit gives mediaCleanupFailed', async () => {
  const s = setup({ commitResult: false })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, true)
  assert.equal(r.mediaCleanupFailed, true)
})
