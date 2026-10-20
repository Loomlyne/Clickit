import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PRELOADER_VIDEO_LIMIT,
  PRELOADER_VIDEO_TOO_LARGE,
  HERO_VIDEO_TOO_LARGE,
  verifyUploadedVideoSize,
} from '../../src/lib/admin/media-guards.ts'
import {
  parseShowVideoUploadPath,
  savePreloaderVideoCore,
  saveShowVideoUploadCore,
  type VideoUploadPorts,
} from '../../src/lib/admin/video-uploads.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const MB = 1024 * 1024
const OLD_PATH = 'preloader/video-1000.mp4'
const OLD_URL = `https://cdn.test/site-assets/${OLD_PATH}?v=1`
const NEW_PATH = 'preloader/video-2000.mp4'
const SHOW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOW_PATH = `shows/${SHOW}/hero-mobile-3000.mp4`

type Opts = {
  infoSize?: number
  blobSize?: number
  mirrorThrows?: boolean
  commitResult?: boolean
  rollbackResult?: boolean
}

function setup(opts: Opts = {}) {
  const fake = createFakeSupabase({ app_config: [{ id: 1, preloader_video_url: OLD_URL }] })
  const log: string[] = []
  const calls = { remove: [] as string[][], cleanup: [] as string[][], staged: [] as string[][], mirror: 0 }
  const db = {
    from: (t: string) => {
      const b = fake.client.from(t)
      if (t === 'app_config') {
        const orig = b.update.bind(b)
        b.update = (p: unknown) => {
          log.push('update')
          return orig(p)
        }
      }
      return b
    },
  } as never
  const ports: VideoUploadPorts = {
    db,
    storage: {
      info: async () => {
        log.push('info')
        return { data: { size: opts.infoSize ?? 5 * MB }, error: null }
      },
      download: async () => {
        log.push('download')
        return { data: { size: opts.blobSize ?? 5 * MB } as unknown as Blob, error: null }
      },
      remove: async (paths) => {
        log.push('remove')
        calls.remove.push(paths)
        return { error: null }
      },
      publicUrl: (p) => `https://cdn.test/site-assets/${p}`,
    },
    media: {
      mirrorUpload: async () => {
        log.push('mirror')
        calls.mirror += 1
        if (opts.mirrorThrows) throw new Error('r2 down')
      },
      cleanup: async (paths) => {
        log.push('cleanup')
        calls.cleanup.push(paths)
      },
      stageDeletion: async (paths) => {
        log.push('stage')
        calls.staged.push(paths)
        return {
          commit: async () => (log.push('commit'), opts.commitResult ?? true),
          rollback: async () => (log.push('rollback'), opts.rollbackResult ?? true),
        }
      },
    },
    storagePathFromUrl: (u) => (u && u.includes('/site-assets/') ? u.split('/site-assets/')[1]!.split('?')[0]! : null),
    now: () => 4242,
  }
  const deps = {
    adminUserId: 'admin-1',
    audit: async (e: Parameters<typeof fake.auditWriter>[0]) => {
      log.push('audit')
      return fake.auditWriter(e)
    },
  }
  return { fake, ports, deps, log, calls }
}

const preloaderUrl = (s: ReturnType<typeof setup>) => s.fake.tables.app_config![0]!.preloader_video_url

test('verifyUploadedVideoSize honours the preloader limit', async () => {
  const removed: string[][] = []
  const storage = {
    info: async () => ({ data: { size: 21 * MB }, error: null }),
    remove: async (p: string[]) => (removed.push(p), { error: null }),
  }
  assert.deepEqual(await verifyUploadedVideoSize(storage, NEW_PATH, PRELOADER_VIDEO_LIMIT), {
    ok: false,
    error: PRELOADER_VIDEO_TOO_LARGE,
  })
  assert.deepEqual(removed, [[NEW_PATH]])
  // The default stays the 50MB hero limit.
  assert.deepEqual(await verifyUploadedVideoSize(storage, NEW_PATH), { ok: true, size: 21 * MB })
})

test('preloader success: pending audit, mirror, stage, update, commit, terminal audit', async () => {
  const s = setup()
  const r = await savePreloaderVideoCore(s.ports, s.deps, { path: NEW_PATH })
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(r.data, `https://cdn.test/site-assets/${NEW_PATH}?v=4242`)
  assert.deepEqual(s.log, ['info', 'download', 'audit', 'mirror', 'stage', 'update', 'commit', 'audit'])
  assert.equal(preloaderUrl(s), r.data)
  assert.deepEqual(s.calls.staged, [[OLD_PATH]])
  const rows = s.fake.auditRows()
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((x) => x.diff.outcome), ['pending', 'committed'])
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
  for (const row of rows) {
    assert.equal(row.action_type, 'upload')
    assert.equal(row.entity_type, 'storage')
    assert.equal(row.diff.slot, 'preloader')
    assert.equal(row.diff.path, NEW_PATH)
    assert.equal(row.diff.previous_path, OLD_PATH)
    assert.equal(row.diff.sizeMB, 5)
  }
})

test('preloader forged size (server info() over 20MB): refused, file removed, no audit, config unchanged', async () => {
  const s = setup({ infoSize: 21 * MB })
  const r = await savePreloaderVideoCore(s.ports, s.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, PRELOADER_VIDEO_TOO_LARGE)
  assert.deepEqual(s.calls.remove, [[NEW_PATH]])
  assert.equal(s.calls.mirror, 0)
  assert.equal(s.fake.auditRows().length, 0)
  assert.equal(preloaderUrl(s), OLD_URL)
})

test('preloader downloaded blob over the limit: refused and removed', async () => {
  const s = setup({ infoSize: 5 * MB, blobSize: 25 * MB })
  const r = await savePreloaderVideoCore(s.ports, s.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.error, PRELOADER_VIDEO_TOO_LARGE)
  assert.deepEqual(s.calls.remove, [[NEW_PATH]])
  assert.equal(s.fake.auditRows().length, 0)
})

test('preloader invalid path: refused before any storage call', async () => {
  const s = setup()
  for (const path of ['hero/video-1.mp4', 'preloader/video-1.mp4/../x', 42]) {
    const r = await savePreloaderVideoCore(s.ports, s.deps, { path })
    assert.equal(r.success, false)
    assert.equal(r.error, 'Invalid upload path')
  }
  assert.deepEqual(s.log, [])
})

test('preloader failed pending audit row: nothing mirrored or written', async () => {
  const s = setup()
  s.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await savePreloaderVideoCore(s.ports, s.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, 'Could not write the audit record; the video was not saved.')
  assert.equal(s.calls.mirror, 0)
  assert.equal(s.log.includes('update'), false)
  assert.equal(preloaderUrl(s), OLD_URL)
})

test('preloader config write failure: previous media restored, new media cleaned, pending then failed', async () => {
  const s = setup()
  s.fake.failOn({ table: 'app_config', op: 'update', nth: 1 })
  const r = await savePreloaderVideoCore(s.ports, s.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.equal(preloaderUrl(s), OLD_URL)
  assert.ok(s.log.includes('rollback'))
  assert.equal(s.log.includes('commit'), false)
  assert.deepEqual(s.calls.cleanup, [[NEW_PATH]])
  assert.deepEqual(s.fake.auditRows().map((x) => x.diff.outcome), ['pending', 'failed'])
})

test('preloader mirror failure: no config write, pending then failed', async () => {
  const s = setup({ mirrorThrows: true })
  const r = await savePreloaderVideoCore(s.ports, s.deps, { path: NEW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.error, 'r2 down')
  assert.equal(s.log.includes('update'), false)
  assert.equal(preloaderUrl(s), OLD_URL)
  assert.deepEqual(s.fake.auditRows().map((x) => x.diff.outcome), ['pending', 'failed'])
})

test('preloader previous-media cleanup failure is flagged and recorded, the save stands', async () => {
  const s = setup({ commitResult: false })
  const r = await savePreloaderVideoCore(s.ports, s.deps, { path: NEW_PATH })
  assert.equal(r.success, true)
  assert.equal(r.mediaCleanupFailed, true)
  assert.equal(s.fake.auditRows()[1]!.diff.media_cleanup_failed, true)
})

test('show video path parser', () => {
  assert.deepEqual(parseShowVideoUploadPath(SHOW_PATH), { showId: SHOW, variant: 'mobile' })
  assert.equal(parseShowVideoUploadPath(`shows/${SHOW}/hero-tablet-1.mp4`), null)
  assert.equal(parseShowVideoUploadPath(`shows/not-a-uuid/hero-mobile-1.mp4`), null)
  assert.equal(parseShowVideoUploadPath(null), null)
})

test('show video success: verified, pending audit, mirror, terminal audit; no config write', async () => {
  const s = setup()
  const r = await saveShowVideoUploadCore(s.ports, s.deps, { path: SHOW_PATH })
  assert.equal(r.success, true)
  assert.equal(r.data, `https://cdn.test/site-assets/${SHOW_PATH}`)
  assert.deepEqual(s.log, ['info', 'download', 'audit', 'mirror', 'audit'])
  const rows = s.fake.auditRows()
  assert.deepEqual(rows.map((x) => x.diff.outcome), ['pending', 'committed'])
  assert.equal(rows[0]!.diff.slot, 'show_hero_mobile')
  assert.equal(rows[0]!.diff.show_id, SHOW)
  assert.equal(rows[0]!.entity_type, 'storage')
})

test('show video forged size (server info() over 50MB): refused, removed, no audit', async () => {
  const s = setup({ infoSize: 51 * MB })
  const r = await saveShowVideoUploadCore(s.ports, s.deps, { path: SHOW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, HERO_VIDEO_TOO_LARGE)
  assert.deepEqual(s.calls.remove, [[SHOW_PATH]])
  assert.equal(s.calls.mirror, 0)
  assert.equal(s.fake.auditRows().length, 0)
})

test('show video under 50MB but over the preloader limit passes', async () => {
  const s = setup({ infoSize: 30 * MB, blobSize: 30 * MB })
  const r = await saveShowVideoUploadCore(s.ports, s.deps, { path: SHOW_PATH })
  assert.equal(r.success, true)
})

test('show video mirror failure: pending then failed, error returned', async () => {
  const s = setup({ mirrorThrows: true })
  const r = await saveShowVideoUploadCore(s.ports, s.deps, { path: SHOW_PATH })
  assert.equal(r.success, false)
  assert.equal(r.error, 'r2 down')
  assert.deepEqual(s.fake.auditRows().map((x) => x.diff.outcome), ['pending', 'failed'])
})

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function bodyOf(name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `${name} export missing`)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

test('source scan: preloader and show video saves go through the runner and their core', () => {
  for (const [name, core] of [
    ['savePreloaderVideoUpload', 'savePreloaderVideoCore('],
    ['saveShowVideoUpload', 'saveShowVideoUploadCore('],
  ] as const) {
    const body = bodyOf(name)
    assert.ok(body.includes('runAdminAction('), `${name} lacks runAdminAction(`)
    assert.ok(body.includes(core), `${name} lacks ${core}`)
    assert.equal(body.includes('.download('), false, `${name} still downloads directly`)
  }
})
