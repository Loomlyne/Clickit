import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PRELOADER_VIDEO_LIMIT,
  SHOW_VIDEO_LIMIT,
  parseShowVideoUploadPath,
  savePreloaderVideoCore,
  saveShowVideoCore,
  type VideoUploadPorts,
} from '../../src/lib/admin/video-uploads.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const MB = 1024 * 1024
const OLD_URL = 'https://cdn.test/site-assets/preloader/video-1000.mp4?v=1'
const NEW_PATH = 'preloader/video-2000.mp4'
const SHOW = 'aaaaaaaa-0000-4000-8000-000000000001'
const SHOW_PATH = `shows/${SHOW}/hero-desktop-3000.mp4`

function world(opts: { infoSize?: number; blobSize?: number } = {}) {
  const fake = createFakeSupabase({
    app_config: [{ id: 1, preloader_video_url: OLD_URL }],
  })
  const log = { removed: [] as string[][], mirrored: [] as string[], cleaned: [] as string[][], downloads: 0 }
  const ports: VideoUploadPorts = {
    db: fake.client,
    storage: {
      info: async () => ({ data: { size: opts.infoSize ?? 5 * MB }, error: null }),
      download: async () => (
        (log.downloads += 1),
        { data: { size: opts.blobSize ?? opts.infoSize ?? 5 * MB } as unknown as Blob, error: null }
      ),
      remove: async (p) => (log.removed.push(p), { error: null }),
      publicUrl: (p) => `https://cdn.test/site-assets/${p}`,
    },
    media: {
      mirrorUpload: async (p) => void log.mirrored.push(p),
      cleanup: async (p) => void log.cleaned.push(p),
    },
    storagePathFromUrl: (u) => (u ? u.split('/site-assets/')[1]!.split('?')[0]! : null),
    now: () => 7,
  }
  const deps = { audit: fake.auditWriter, adminUserId: 'admin-1' }
  return { fake, ports, deps, log }
}

const url = (f: ReturnType<typeof world>) =>
  f.fake.snapshot().app_config![0]!.preloader_video_url as string | null

test('limits: preloader 20MB, show 50MB', () => {
  assert.equal(PRELOADER_VIDEO_LIMIT.maxBytes, 20 * MB)
  assert.equal(SHOW_VIDEO_LIMIT.maxBytes, 50 * MB)
})

test('preloader: an invalid path is refused before any storage call', async () => {
  const w = world()
  const r = await savePreloaderVideoCore(w.ports, w.deps, { path: 'hero/video-1.mp4' })
  assert.deepEqual(r, { success: false, error: 'Invalid upload path', wrote: false })
  assert.equal(w.log.downloads, 0)
})

test('preloader forged size: storage info over 20MB is refused, file removed, never downloaded, no audit', async () => {
  const w = world({ infoSize: 21 * MB })
  const r = await savePreloaderVideoCore(w.ports, w.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Video must be under 20MB')
  assert.deepEqual(w.log.removed, [[NEW_PATH]])
  assert.equal(w.log.downloads, 0)
  assert.equal(w.fake.auditRows().length, 0)
  assert.equal(url(w), OLD_URL)
})

test('preloader: an oversize downloaded blob after an ok info is refused and removed', async () => {
  const w = world({ infoSize: 5 * MB, blobSize: 25 * MB })
  const r = await savePreloaderVideoCore(w.ports, w.deps, { path: NEW_PATH })
  assert.equal(r.error, 'Video must be under 20MB')
  assert.deepEqual(w.log.removed, [[NEW_PATH]])
  assert.equal(w.fake.auditRows().length, 0)
})

test('preloader success: pending then committed rows, config updated, previous file cleaned', async () => {
  const w = world()
  const r = await savePreloaderVideoCore(w.ports, w.deps, { path: NEW_PATH })
  assert.equal(r.success, true)
  assert.equal(r.data, `https://cdn.test/site-assets/${NEW_PATH}?v=7`)
  assert.equal(url(w), r.data)
  const rows = w.fake.auditRows()
  assert.deepEqual(rows.map((x) => x.diff.outcome), ['pending', 'committed'])
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
  assert.equal(rows[1]!.action_type, 'upload')
  assert.equal(rows[1]!.diff.slot, 'preloader')
  assert.equal(rows[1]!.diff.previous_path, 'preloader/video-1000.mp4')
  assert.deepEqual(w.log.mirrored, [NEW_PATH])
  assert.deepEqual(w.log.cleaned, [['preloader/video-1000.mp4']])
})

test('preloader: failed pending audit row changes nothing and drops the upload', async () => {
  const w = world()
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await savePreloaderVideoCore(w.ports, w.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, 'Could not write the audit record; the video was not saved.')
  assert.equal(url(w), OLD_URL)
  assert.deepEqual(w.log.mirrored, [])
  assert.deepEqual(w.log.removed, [[NEW_PATH]])
})

test('preloader: config write failure undoes the mirror and writes a failed terminal row', async () => {
  const w = world()
  w.fake.failOn({ table: 'app_config', op: 'update', nth: 1 })
  const r = await savePreloaderVideoCore(w.ports, w.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.equal(url(w), OLD_URL)
  assert.deepEqual(w.log.cleaned, [[NEW_PATH]])
  const rows = w.fake.auditRows()
  assert.deepEqual(rows.map((x) => x.diff.outcome), ['pending', 'failed'])
  assert.equal(rows[1]!.diff.failed_step, 'write-config')
  assert.deepEqual(rows[1]!.diff.undone, ['mirror-upload'])
})

test('show path parser: only shows/<uuid>/hero-<variant>-<ts>.mp4', () => {
  assert.deepEqual(parseShowVideoUploadPath(SHOW_PATH), { showId: SHOW, variant: 'desktop' })
  for (const bad of ['shows/x/hero-desktop-1.mp4', `shows/${SHOW}/hero-tablet-1.mp4`, `shows/${SHOW}/../hero-desktop-1.mp4`, 42])
    assert.equal(parseShowVideoUploadPath(bad), null)
})

test('show forged size: storage info over 50MB is refused, removed, no audit', async () => {
  const w = world({ infoSize: 60 * MB })
  const r = await saveShowVideoCore(w.ports, w.deps, { path: SHOW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Video must be under 50MB')
  assert.deepEqual(w.log.removed, [[SHOW_PATH]])
  assert.equal(w.log.downloads, 0)
  assert.equal(w.fake.auditRows().length, 0)
})

test('show success: mirrored, public url returned, pending and committed rows name the show', async () => {
  const w = world({ infoSize: 30 * MB })
  const r = await saveShowVideoCore(w.ports, w.deps, { path: SHOW_PATH })
  assert.equal(r.success, true)
  assert.equal(r.data, `https://cdn.test/site-assets/${SHOW_PATH}`)
  assert.deepEqual(w.log.mirrored, [SHOW_PATH])
  const rows = w.fake.auditRows()
  assert.deepEqual(rows.map((x) => x.diff.outcome), ['pending', 'committed'])
  assert.equal(rows[1]!.entity_id, SHOW)
  assert.equal(rows[1]!.diff.show_id, SHOW)
  assert.equal(rows[1]!.diff.slot, 'show_hero_desktop')
  assert.equal(rows[1]!.diff.sizeMB, 30)
})

test('show: failed pending audit row drops the upload, nothing mirrored', async () => {
  const w = world()
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await saveShowVideoCore(w.ports, w.deps, { path: SHOW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.deepEqual(w.log.mirrored, [])
  assert.deepEqual(w.log.removed, [[SHOW_PATH]])
})
