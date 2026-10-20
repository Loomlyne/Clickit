import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runAdminAction, type AdminActionEnv } from '../../src/lib/admin/action-runner.ts'
import {
  removeHeroVideoCore,
  saveVideoCore,
  setHeroVideoUrlCore,
  type HeroVideoPorts,
} from '../../src/lib/admin/hero-video.ts'
import { NEW_KEY, videoWorld } from './helpers/video-world.ts'

const MB = 1024 * 1024
const NEW_PATH = NEW_KEY

function world(opts: { infoSize?: number } = {}) {
  const w = videoWorld({ headSize: opts.infoSize ?? 10 * MB })
  const touched = { ports: 0 }
  // count every R2 port call so the not-admin test can prove none was made
  const p = w.ports
  const wrap = <A extends unknown[], R>(fn: (...a: A) => R) => (...a: A): R => {
    touched.ports += 1
    return fn(...a)
  }
  const ports: HeroVideoPorts = {
    ...p,
    finalize: wrap(p.finalize),
    head: wrap(p.head),
    readHead: wrap(p.readHead),
    media: { delete: wrap(p.media.delete), stageDeletion: wrap(p.media.stageDeletion) },
  }
  return { fake: w.fake, ports, touched }
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

test('finalizeHeroVideoUpload path, forced audit failure: failed, revalidated once, config restored', async () => {
  const w = world()
  const before = w.fake.snapshot({ exclude: ['admin_audit_log'] })
  w.fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const spy = spyReval()
  const res = await runAdminAction(
    env(w.fake),
    (ctx) =>
      saveVideoCore(w.ports, { audit: ctx.audit, adminUserId: ctx.adminUserId }, { key: NEW_PATH, target: 'hero-desktop' }),
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

test('finalizeHeroVideoUpload path, forged size (server 50 MB check): refused, not revalidated', async () => {
  const w = world({ infoSize: 60 * MB })
  const spy = spyReval()
  const res = await runAdminAction(
    env(w.fake),
    (ctx) =>
      saveVideoCore(w.ports, { audit: ctx.audit, adminUserId: ctx.adminUserId }, { key: NEW_PATH, target: 'hero-desktop' }),
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
    ['finalizeHeroVideoUpload', 'saveVideoCore('],
    ['finalizePreloaderVideoUpload', 'saveVideoCore('],
    ['finalizeShowVideoUpload', 'saveVideoCore('],
    ['setHeroVideoUrl', 'setHeroVideoUrlCore('],
    ['removeHeroVideo', 'removeHeroVideoCore('],
  ] as const) {
    const b = bodyOf(name)
    assert.ok(b.includes('runAdminAction('), `${name} lacks runAdminAction(`)
    assert.ok(b.includes(core), `${name} lacks ${core}`)
  }
})

test('source scan: image finalizers run through the runner and the strict audit writer; the ticker is strict', () => {
  for (const name of [
    'finalizeArtworkUpload',
    'finalizeSiteImageUpload',
    'finalizeSocialIconUpload',
    'finalizeCastImageUpload',
  ]) {
    const b = bodyOf(name)
    assert.ok(b.includes('runAdminAction('), `${name} lacks runAdminAction(`)
    assert.ok(b.includes('finalizeImageUploadCore('), `${name} lacks the core`)
  }
  assert.ok(src.includes('audit: logAuditStrict'), 'image ports must audit with logAuditStrict')
  const ticker = bodyOf('updateTopTicker')
  assert.ok(ticker.includes('fillTickerArabic('))
  assert.ok(ticker.includes('translateBatchToArabicStrict'))
})

test('source scan: no admin media action takes a Supabase original or the old FormData path', () => {
  for (const name of ['removePreloaderVideo', 'removeSiteImage', 'deleteCastMember', 'deleteShowPermanently']) {
    const b = bodyOf(name)
    assert.ok(!b.includes('storage.from('), `${name} must not touch Supabase Storage`)
    assert.ok(!b.includes('stageMirroredPublicMediaDeletion'), `${name} still uses the old mirror`)
  }
  assert.ok(!src.includes('storage.from('), 'admin actions make no Supabase Storage call (MEDIA-07)')
})

test('source scan: removed code is gone', () => {
  assert.ok(!src.includes('sanitizeSvgUpload'))
  assert.ok(!src.includes('image/svg+xml'))
  assert.ok(!src.includes('hero_video_muted: false'))
  assert.ok(!src.includes('translateBatchToArabic('))
  assert.ok(!src.includes('function isHeroVideoUploadPath'))
})
