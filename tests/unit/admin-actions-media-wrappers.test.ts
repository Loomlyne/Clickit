import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runAdminAction, type AdminActionEnv } from '../../src/lib/admin/action-runner.ts'
import {
  removeHeroVideoCore,
  saveHeroVideoCore,
  setHeroVideoUrlCore,
  type HeroVideoPorts,
} from '../../src/lib/admin/hero-video.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const MB = 1024 * 1024
const NEW_PATH = 'hero/video-2000.mp4'
const OLD_URL = 'https://cdn.test/site-assets/hero/video-1000.mp4?v=1'

function world(opts: { infoSize?: number } = {}) {
  const fake = createFakeSupabase({
    app_config: [
      {
        id: 1,
        hero_video_url: OLD_URL,
        hero_video_type: 'mp4',
        hero_video_mobile_url: null,
        hero_video_mobile_type: null,
      },
    ],
  })
  const touched = { ports: 0 }
  const ports: HeroVideoPorts = {
    db: fake.client,
    storage: {
      info: async () => ((touched.ports += 1), { data: { size: opts.infoSize ?? 10 * MB }, error: null }),
      download: async () => (
        (touched.ports += 1),
        {
          data: { size: 10 * MB, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Blob,
          error: null,
        }
      ),
      remove: async () => ((touched.ports += 1), { error: null }),
      publicUrl: (p) => `https://cdn.test/site-assets/${p}`,
    },
    media: {
      mirrorUpload: async () => void (touched.ports += 1),
      cleanup: async () => void (touched.ports += 1),
      stageDeletion: async () => ({
        commit: async () => true,
        rollback: async () => true,
      }),
    },
    hasAudioTrack: () => true,
    storagePathFromUrl: (u) => (u ? u.split('/site-assets/')[1]!.split('?')[0]! : null),
    now: () => 1,
  }
  return { fake, ports, touched }
}

function env(f: ReturnType<typeof createFakeSupabase>, admin = true): AdminActionEnv {
  return {
    assertAdmin: async () => {
      if (!admin) throw new Error('Unauthorized')
      return { id: 'admin-1' }
    },
    createDb: () => f.client,
    audit: f.auditWriter,
    logError: () => {},
  }
}

const spyReval = () => {
  const calls: unknown[] = []
  return { calls, revalidate: (r: unknown) => void calls.push(r) }
}

test('saveHeroVideoUpload path, forced audit failure: failed, revalidated once, config restored', async () => {
  const w = world()
  const before = w.fake.snapshot({ exclude: ['admin_audit_log'] })
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const spy = spyReval()
  const res = await runAdminAction(
    env(w.fake),
    (ctx) =>
      saveHeroVideoCore(w.ports, { audit: ctx.audit, adminUserId: ctx.adminUserId }, { path: NEW_PATH, variant: 'desktop' }),
    { fallbackError: 'Upload failed', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(spy.calls.length, 1)
  assert.deepEqual(w.fake.snapshot({ exclude: ['admin_audit_log'] }), before)
})

test('setHeroVideoUrl path, not admin: no db call, no port call, no revalidate', async () => {
  const w = world()
  const spy = spyReval()
  const res = await runAdminAction(
    env(w.fake, false),
    (ctx) =>
      setHeroVideoUrlCore(
        w.ports,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk', variant: 'desktop' }
      ),
    { fallbackError: 'Failed to save URL', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(w.fake.calls.length, 0)
  assert.equal(w.touched.ports, 0)
  assert.equal(spy.calls.length, 0)
})

test('removeHeroVideo path success: revalidated once, one audit row', async () => {
  const w = world()
  const spy = spyReval()
  const res = await runAdminAction(
    env(w.fake),
    (ctx) => removeHeroVideoCore(w.ports, { audit: ctx.audit, adminUserId: ctx.adminUserId }, { variant: 'desktop' }),
    { fallbackError: 'Failed to remove video', revalidate: spy.revalidate }
  )
  assert.equal(res.success, true)
  assert.equal(spy.calls.length, 1)
  assert.equal(w.fake.auditRows().length, 1)
})

test('saveHeroVideoUpload path, forged size: refused, not revalidated', async () => {
  const w = world({ infoSize: 60 * MB })
  const spy = spyReval()
  const res = await runAdminAction(
    env(w.fake),
    (ctx) =>
      saveHeroVideoCore(w.ports, { audit: ctx.audit, adminUserId: ctx.adminUserId }, { path: NEW_PATH, variant: 'desktop' }),
    { fallbackError: 'Upload failed', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(spy.calls.length, 0)
})

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function bodyOf(name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `${name} not found`)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

test('source scan: hero actions go through the runner and their core', () => {
  for (const [name, core] of [
    ['saveHeroVideoUpload', 'saveHeroVideoCore('],
    ['setHeroVideoUrl', 'setHeroVideoUrlCore('],
    ['removeHeroVideo', 'removeHeroVideoCore('],
  ] as const) {
    const b = bodyOf(name)
    assert.ok(b.includes('runAdminAction('), `${name} lacks runAdminAction(`)
    assert.ok(b.includes(core), `${name} lacks ${core}`)
  }
  const create = bodyOf('createHeroVideoUpload')
  assert.ok(create.includes('parseHeroVariant('))
  assert.ok(create.includes('checkHeroVideoSize('))
})

test('source scan: image uploads use checkImageUpload and the ticker is strict', () => {
  assert.ok(bodyOf('uploadSiteImage').includes('checkImageUpload('))
  assert.ok(bodyOf('uploadSocialIcon').includes('checkImageUpload('))
  const ticker = bodyOf('updateTopTicker')
  assert.ok(ticker.includes('fillTickerArabic('))
  assert.ok(ticker.includes('translateBatchToArabicStrict'))
})

test('source scan: removed code is gone', () => {
  assert.ok(!src.includes('sanitizeSvgUpload'))
  assert.ok(!src.includes('image/svg+xml'))
  assert.ok(!src.includes('hero_video_muted: false'))
  assert.ok(!src.includes('translateBatchToArabic('))
  assert.ok(!src.includes('function isHeroVideoUploadPath'))
})
