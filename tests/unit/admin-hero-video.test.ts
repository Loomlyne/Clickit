import assert from 'node:assert/strict'
import test from 'node:test'
import {
  removeHeroVideoCore,
  saveHeroVideoCore,
  setHeroVideoUrlCore,
  type HeroVideoPorts,
} from '../../src/lib/admin/hero-video.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const MB = 1024 * 1024
const OLD_PATH = 'hero/video-1000.mp4'
const OLD_URL = `https://cdn.test/site-assets/${OLD_PATH}?v=1`
const NEW_PATH = 'hero/video-2000.mp4'
const YT = 'https://www.youtube.com/watch?v=abcdefghijk'

const baseConfig = () => ({
  id: 1,
  hero_video_url: OLD_URL,
  hero_video_type: 'mp4',
  hero_video_mobile_url: null,
  hero_video_mobile_type: null,
  hero_video_muted: true,
})

type Opts = {
  infoSize?: number
  blobSize?: number
  audio?: boolean
  removeFails?: boolean
  commitResult?: boolean
  stageRollbackResult?: boolean
}

function setup(opts: Opts = {}) {
  const fake = createFakeSupabase({ app_config: [baseConfig()] })
  const log: string[] = []
  const calls = { remove: [] as string[][], cleanup: [] as string[][], download: 0, commit: 0, rollback: 0 }
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
  const ports: HeroVideoPorts = {
    db,
    storage: {
      info: async () => {
        log.push('info')
        return { data: { size: opts.infoSize ?? 10 * MB }, error: null }
      },
      download: async () => {
        log.push('download')
        calls.download += 1
        const size = opts.blobSize ?? 10 * MB
        return {
          data: { size, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Blob,
          error: null,
        }
      },
      remove: async (paths) => {
        log.push('remove')
        calls.remove.push(paths)
        return { error: opts.removeFails ? { message: 'rm boom' } : null }
      },
      publicUrl: (p) => `https://cdn.test/site-assets/${p}`,
    },
    media: {
      mirrorUpload: async () => {
        log.push('mirrorUpload')
      },
      cleanup: async (paths) => {
        log.push('cleanup')
        calls.cleanup.push(paths)
      },
      stageDeletion: async () => {
        log.push('stage')
        return {
          commit: async () => {
            log.push('commit')
            calls.commit += 1
            return opts.commitResult ?? true
          },
          rollback: async () => {
            log.push('rollback')
            calls.rollback += 1
            return opts.stageRollbackResult ?? true
          },
        }
      },
    },
    hasAudioTrack: () => opts.audio ?? true,
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

const cfg = (f: ReturnType<typeof setup>['fake']) => f.tables.app_config![0]!

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
  assert.equal(cfg(s.fake).hero_video_url, YT)
  assert.equal(cfg(s.fake).hero_video_type, 'youtube')
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
  assert.deepEqual(rows[0]!.diff, { variant: 'desktop', previous_path: OLD_PATH })
  assert.equal(cfg(s.fake).hero_video_url, null)
  assert.equal(cfg(s.fake).hero_video_type, null)
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
  const s = setup({ infoSize: 60 * MB })
  const before = s.fake.snapshot()
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.match(r.error!, /Video must be under 50MB/)
  assert.deepEqual(s.calls.remove, [[NEW_PATH]])
  assert.equal(s.calls.download, 0)
  assert.deepEqual(s.fake.snapshot(), before)
  assert.equal(s.fake.auditRows().length, 0)
})

test('saveHeroVideoCore oversize downloaded blob refused after ok info', async () => {
  const s = setup({ infoSize: 10 * MB, blobSize: 60 * MB })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /Video must be under 50MB/)
  assert.deepEqual(s.calls.remove, [[NEW_PATH]])
  assert.ok(!s.log.includes('update'))
})

test('saveHeroVideoCore oversize blob with failed removal says so', async () => {
  const s = setup({ blobSize: 60 * MB, removeFails: true })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /could not be removed/)
})

test('saveHeroVideoCore no audio track refused; removal failure appended', async () => {
  const s = setup({ audio: false })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.match(r.error!, /no audio track/)
  assert.deepEqual(s.calls.remove, [[NEW_PATH]])
  const s2 = setup({ audio: false, removeFails: true })
  const r2 = await saveHeroVideoCore(s2.ports, s2.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.match(r2.error!, /The uploaded file could not be removed\./)
})

test('saveHeroVideoCore success: info, download, mirror, stage, update, audit, commit', async () => {
  const s = setup()
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, true)
  assert.deepEqual(s.log, ['info', 'download', 'mirrorUpload', 'stage', 'update', 'audit', 'commit'])
  assert.equal(r.data, `https://cdn.test/site-assets/${NEW_PATH}?v=4242`)
  const row = cfg(s.fake)
  assert.equal(row.hero_video_url, r.data)
  assert.equal(row.hero_video_type, 'mp4')
  assert.equal(row.hero_video_muted, true)
  const audit = s.fake.auditRows()[0]!
  assert.equal(audit.action_type, 'upload')
  assert.equal(audit.entity_type, 'storage')
  assert.equal((audit.diff as Record<string, unknown>).slot, 'hero_desktop')
  assert.equal((audit.diff as Record<string, unknown>).path, NEW_PATH)
  assert.equal((audit.diff as Record<string, unknown>).previous_path, OLD_PATH)
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
  assert.deepEqual(s.calls.cleanup, [[NEW_PATH]])
  assert.equal(s.calls.commit, 0)
})

test('saveHeroVideoCore config update failure cleans new upload and rolls back', async () => {
  const s = setup()
  s.fake.failOn({ table: 'app_config', op: 'update', nth: 1 })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, false)
  assert.deepEqual(s.calls.cleanup, [[NEW_PATH]])
  assert.equal(s.calls.rollback, 1)
  assert.equal(s.calls.commit, 0)
  assert.equal(s.fake.auditRows().length, 0)
})

test('saveHeroVideoCore bad path and bad variant touch no storage', async () => {
  const s = setup()
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: 'hero/../x.mp4', variant: 'desktop' })
  assert.equal(r.success, false)
  assert.equal(r.error, 'Invalid upload path')
  const r2 = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'tablet' })
  assert.equal(r2.error, 'Invalid hero variant.')
  assert.deepEqual(s.log, [])
})

test('saveHeroVideoCore commit false after audit gives mediaCleanupFailed', async () => {
  const s = setup({ commitResult: false })
  const r = await saveHeroVideoCore(s.ports, s.deps, { path: NEW_PATH, variant: 'desktop' })
  assert.equal(r.success, true)
  assert.equal(r.mediaCleanupFailed, true)
})
