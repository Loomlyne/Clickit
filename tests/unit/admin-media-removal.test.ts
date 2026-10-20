// Deferred items 21-23: remove/clear actions (removeSiteImage, removePreloaderVideo,
// deleteCastMember) write compare-and-swap and delete the R2 key only when no live value
// anywhere still uses it. Pure core, fake Supabase, fake R2.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { removeMediaCore, type MediaRemovalTarget } from '../../src/lib/admin/media-removal.ts'
import { MEDIA_SAVE_CONFLICT } from '../../src/server/media-references.ts'
import { rowVersion, type RowVersion } from '../../src/lib/admin/row-version.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const ORIGIN = 'https://media.test'
const SHOW = '0b9f2a0e-1111-4222-8333-444455556666'
const CAST = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const CAST2 = '7c9e6679-7425-40de-944b-e07fc1f90ae8'
const OG = 'site-assets/settings/og-1750000000000-12345678.jpg'
const PRE = 'site-assets/preloader/video-1750000000000-12345678.mp4'
const PORTRAIT = `show-artwork/shows/${SHOW}/cast/1750000000000-12345678.png`
const variantsOf = (k: string) => [640, 1280, 1920].flatMap((w) => [`_v/${w}/webp/${k}`, `_v/${w}/avif/${k}`])

const OG_TARGET: MediaRemovalTarget = {
  kind: 'clear-column',
  table: 'app_config',
  id: 1,
  column: 'og_image_url',
  notFound: 'Could not load site config',
}
const PRELOADER_TARGET: MediaRemovalTarget = { ...OG_TARGET, column: 'preloader_video_url' }
const CAST_TARGET: MediaRemovalTarget = {
  kind: 'delete-row',
  table: 'show_cast',
  id: CAST,
  column: 'image_url',
  notFound: 'Cast member not found',
}

function world(over: { app?: Record<string, unknown>; shows?: unknown[]; cast?: unknown[] } = {}) {
  const fake = createFakeSupabase({
    app_config: [
      {
        id: 1,
        og_image_url: `${ORIGIN}/${OG}?v=2`,
        auth_image_url: null,
        preloader_video_url: `${ORIGIN}/${PRE}`,
        hero_video_url: null,
        footer_content: { social: [] },
        ...over.app,
      },
    ],
    shows: (over.shows as never) ?? [{ id: SHOW, poster_url: null }],
    show_cast: (over.cast as never) ?? [
      { id: CAST, show_id: SHOW, name: 'A', image_url: `${ORIGIN}/${PORTRAIT}` },
      { id: CAST2, show_id: SHOW, name: 'B', image_url: null },
    ],
    profiles: [],
    shorts: [],
  })
  const deleted: string[][] = []
  const ports = {
    db: fake.client as never,
    media: {
      delete: async (keys: string[]) => {
        deleted.push(keys)
      },
    },
    mediaOrigin: ORIGIN,
  }
  return { fake, ports, deleted, cfg: () => fake.tables.app_config![0]! }
}

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

test('clearing an unshared site image clears the column and deletes the key and its variants', async () => {
  const w = world()
  const r = await removeMediaCore(w.ports, OG_TARGET, '[t]')
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(w.cfg().og_image_url, null)
  assert.deepEqual(w.deleted, [[OG, ...variantsOf(OG)]])
})

test('same-scope share on remove: og and auth image hold the same file, the file stays', async () => {
  const w = world({ app: { auth_image_url: `${ORIGIN}/${OG}` } })
  const r = await quiet(() => removeMediaCore(w.ports, OG_TARGET, '[t]'))
  assert.equal(r.success, true)
  assert.equal(w.cfg().og_image_url, null)
  assert.deepEqual(w.deleted, [])
})

test('cross-scope share on remove: a show poster uses the same file, the file stays', async () => {
  const w = world({ shows: [{ id: SHOW, poster_url: `https://proj.supabase.co/storage/v1/object/public/${OG}` }] })
  const r = await quiet(() => removeMediaCore(w.ports, OG_TARGET, '[t]'))
  assert.equal(r.success, true)
  assert.deepEqual(w.deleted, [])
})

test('preloader removal keeps the file while the hero video uses it', async () => {
  const w = world({ app: { hero_video_url: `${ORIGIN}/${PRE}` } })
  const r = await quiet(() => removeMediaCore(w.ports, PRELOADER_TARGET, '[t]'))
  assert.equal(r.success, true)
  assert.equal(w.cfg().preloader_video_url, null)
  assert.deepEqual(w.deleted, [])
})

test('reference read failure: the value is cleared, nothing is deleted, cleanup flagged', async () => {
  const w = world()
  w.fake.failOn({ table: 'shows', op: 'select', nth: 1 })
  const r = await quiet(() => removeMediaCore(w.ports, OG_TARGET, '[t]'))
  assert.equal(r.success, true)
  assert.equal(r.mediaCleanupFailed, true)
  assert.equal(w.cfg().og_image_url, null)
  assert.deepEqual(w.deleted, [])
})

test('CAS conflict: the value changed after our read; error, their value kept, nothing deleted', async () => {
  const w = world()
  const theirs = `${ORIGIN}/site-assets/settings/og-1770000000000-99999999.jpg`
  const client = w.fake.client
  let reads = 0
  w.ports.db = {
    from: (t: string) => {
      const b = client.from(t)
      if (t === 'app_config') {
        const then = b.then.bind(b)
        b.then = (f: unknown, r: unknown) =>
          then((v: unknown) => {
            // The other admin saves right after our first read.
            if (++reads === 1) w.cfg().og_image_url = theirs
            return (f as (x: unknown) => unknown)(v)
          }, r as never)
      }
      return b
    },
  } as never
  const r = await removeMediaCore(w.ports, OG_TARGET, '[t]')
  assert.deepEqual(r, { success: false, error: MEDIA_SAVE_CONFLICT, wrote: false })
  assert.equal(w.cfg().og_image_url, theirs)
  assert.deepEqual(w.deleted, [])
})

test('a Supabase Storage url is never deleted (MEDIA-07), an empty value deletes nothing', async () => {
  for (const og of [`https://proj.supabase.co/storage/v1/object/public/${OG}`, null]) {
    const w = world({ app: { og_image_url: og } })
    const r = await removeMediaCore(w.ports, OG_TARGET, '[t]')
    assert.equal(r.success, true)
    assert.equal(w.cfg().og_image_url, null)
    assert.deepEqual(w.deleted, [])
  }
})

test('read failure or a missing row: error, nothing written or deleted', async () => {
  const w = world()
  w.fake.failOn({ table: 'app_config', op: 'select', nth: 1 })
  const r = await removeMediaCore(w.ports, OG_TARGET, '[t]')
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(w.cfg().og_image_url, `${ORIGIN}/${OG}?v=2`)
  const missing = await removeMediaCore(world().ports, { ...CAST_TARGET, id: '7c9e6679-7425-40de-944b-e07fc1f90aff' }, '[t]')
  assert.equal(missing.success, false)
  assert.equal(missing.error, 'Cast member not found')
})

test('deleting a cast member removes the row and its unshared portrait', async () => {
  const w = world()
  const r = await removeMediaCore(w.ports, CAST_TARGET, '[t]')
  assert.equal(r.success, true)
  assert.equal(w.fake.tables.show_cast!.length, 1)
  assert.deepEqual(w.deleted, [[PORTRAIT, ...variantsOf(PORTRAIT)]])
})

test('deleting a cast member keeps a portrait another member (or another show) still uses', async () => {
  const w = world({
    cast: [
      { id: CAST, show_id: SHOW, name: 'A', image_url: `${ORIGIN}/${PORTRAIT}` },
      { id: CAST2, show_id: 'another-show', name: 'B', image_url: `${ORIGIN}/${PORTRAIT}?v=5` },
    ],
  })
  const r = await quiet(() => removeMediaCore(w.ports, CAST_TARGET, '[t]'))
  assert.equal(r.success, true)
  assert.equal(w.fake.tables.show_cast!.length, 1)
  assert.deepEqual(w.deleted, [])
})

test('deleting a cast member whose image changed meanwhile: conflict, row kept, nothing deleted', async () => {
  const w = world()
  const client = w.fake.client
  let reads = 0
  w.ports.db = {
    from: (t: string) => {
      const b = client.from(t)
      if (t === 'show_cast') {
        const then = b.then.bind(b)
        b.then = (f: unknown, r: unknown) =>
          then((v: unknown) => {
            if (++reads === 1) w.fake.tables.show_cast![0]!.image_url = `${ORIGIN}/${PORTRAIT}?v=new`
            return (f as (x: unknown) => unknown)(v)
          }, r as never)
      }
      return b
    },
  } as never
  const r = await removeMediaCore(w.ports, CAST_TARGET, '[t]')
  assert.deepEqual(r, { success: false, error: MEDIA_SAVE_CONFLICT, wrote: false })
  assert.equal(w.fake.tables.show_cast!.length, 2)
  assert.deepEqual(w.deleted, [])
})

test('source scan: the remove actions go through removeMediaCore; no unguarded R2 delete helper is left', () => {
  const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
  const bodyOf = (name: string) => {
    const start = src.indexOf(`export async function ${name}(`)
    assert.notEqual(start, -1, name)
    const next = src.indexOf('\nexport ', start + 10)
    return src.slice(start, next === -1 ? undefined : next)
  }
  for (const name of ['removeSiteImage', 'removePreloaderVideo', 'deleteCastMember']) {
    assert.ok(bodyOf(name).includes('removeMediaCore('), `${name} must use removeMediaCore`)
  }
  // Every staged or url delete in the app carries a reference guard (required argument).
  const del = readFileSync('src/server/r2-delete.ts', 'utf8')
  assert.ok(!/export async function deleteKeys/.test(del), 'raw deleteKeys must not be exported')
  for (const fn of ['stageR2Deletion', 'stageR2DeletionForUrl', 'deleteMediaForUrl', 'stageShowMedia']) {
    const m = new RegExp(`export (?:async )?function ${fn}\\(([^)]*)\\)`).exec(del)
    assert.ok(m && /guard: MediaDeleteGuard/.test(m[1]!), `${fn} must take a MediaDeleteGuard`)
  }
  // The video replace tail stages through the guarded stageR2Deletion.
  assert.match(src, /stageDeletion: async \(keys\) => stageR2Deletion\(/)
  // The cron's R2 mirror delete is guarded too.
  const cron = readFileSync('src/app/api/cron/cleanup-media/route.ts', 'utf8')
  assert.ok(cron.includes('readReferences: () => readMediaReferenceUrls('), 'cron must build a reference guard')
  assert.match(cron, /stageR2Deletion\([^;]*?,\s*guard\s*\)/, 'cron R2 delete must pass the guard')
  assert.ok(cron.includes('findLiveReferences('), 'cron orphans are re-checked against every reference')
})

// ---- Deferred item 23 residual (b): removing a site image or the preloader from the settings
// page also checks the page's updated_at (one chain for every form on that row) ----

const STAMP = '2026-10-20T16:43:24.123456+00:00'
const versionOf = (v: string): RowVersion => {
  const r = rowVersion(v)
  assert.ok(r.ok)
  return r.value
}

test('clear with a stale page updated_at: conflict, column kept, nothing deleted', async () => {
  for (const target of [OG_TARGET, PRELOADER_TARGET]) {
    const w = world({ app: { updated_at: STAMP } })
    const version = versionOf('2026-10-20T16:43:20.000001+00:00')
    const before = w.fake.snapshot()
    const r = await removeMediaCore({ ...w.ports, version }, target, '[t]')
    assert.deepEqual(r, { success: false, error: MEDIA_SAVE_CONFLICT, wrote: false })
    assert.deepEqual(w.fake.snapshot(), before)
    assert.deepEqual(w.deleted, [])
    assert.equal(version.next, null)
  }
})

test('clear with the fresh page updated_at: cleared, the new updated_at is reported', async () => {
  const fake = createFakeSupabase(
    {
      app_config: [{ id: 1, updated_at: STAMP, og_image_url: `${ORIGIN}/${OG}`, footer_content: { social: [] } }],
      shows: [],
      show_cast: [],
      profiles: [],
      shorts: [],
    },
    { updatedAtTables: ['app_config'] }
  )
  const deleted: string[][] = []
  const version = versionOf(STAMP)
  const r = await removeMediaCore(
    { db: fake.client as never, media: { delete: async (k: string[]) => void deleted.push(k) }, mediaOrigin: ORIGIN, version },
    OG_TARGET,
    '[t]'
  )
  assert.equal(r.success, true, r.error)
  assert.equal(fake.tables.app_config![0]!.og_image_url, null)
  assert.equal(version.next, fake.tables.app_config![0]!.updated_at)
  assert.notEqual(version.next, STAMP)
})
