import assert from 'node:assert/strict'
import test from 'node:test'
import { finalizeImageUploadCore, type ImageUploadPorts } from '../../src/lib/admin/image-upload.ts'
import { adminImageDb } from '../../src/lib/admin/image-db.ts'
import { liveKeysForUrl } from '../../src/server/r2-keys.ts'
import { MEDIA_SAVE_CONFLICT, readMediaReferenceUrls, type ReferenceDb } from '../../src/server/media-references.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const ORIGIN = 'https://media.test'
const SHOW = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OTHER_SHOW = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'
const CAST = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const CAST2 = '7c9e6679-7425-40de-944b-e07fc1f90ae8'
const CAST3 = '7c9e6679-7425-40de-944b-e07fc1f90ae9'
const NEW_KEY = `show-artwork/shows/${SHOW}/poster-1760000000000-abcdef01.webp`
const OLD_KEY = `show-artwork/shows/${SHOW}/poster-1750000000000-12345678.webp`

const tables = () => ({
  shows: [
    { id: SHOW, poster_url: `${ORIGIN}/${OLD_KEY}`, card_image_url: 'card-old', hero_url: 'hero-old' },
    { id: OTHER_SHOW, poster_url: 'other-poster', card_image_url: null },
  ],
  app_config: [
    {
      id: 1,
      og_image_url: 'og-old',
      favicon_url: 'fav-old',
      admin_user_id: 'admin-1',
      footer_content: {
        social: [
          { platform: 'x', url: 'https://x.com/a', iconUrl: `${ORIGIN}/site-assets/settings/social-icons/1750000000000-12345678.png` },
          { platform: 'ig', url: 'https://instagram.com/a', iconUrl: '' },
          'junk',
        ],
      },
    },
  ],
  show_cast: [
    { id: CAST, show_id: SHOW, name: 'A', image_url: null },
    { id: CAST2, show_id: SHOW, name: 'B', image_url: `${ORIGIN}/show-artwork/shows/${SHOW}/cast/1750000000000-12345678.png` },
    { id: CAST3, show_id: OTHER_SHOW, name: 'C', image_url: 'other-cast' },
  ],
  profiles: [],
})

function ports(fake: ReturnType<typeof createFakeSupabase>, auditError?: string): ImageUploadPorts {
  const deleted: string[][] = []
  const p: ImageUploadPorts = {
    finalize: async (i) => ({ ok: true, key: i.key, variants: [...i.variantKeys] }),
    db: adminImageDb(fake.client as never),
    media: { delete: async (k) => void deleted.push(k) },
    audit: async (e) => (auditError ? { error: auditError } : fake.auditWriter(e)),
    mediaOrigin: ORIGIN,
    references: () => readMediaReferenceUrls(fake.client as ReferenceDb),
    previousR2Keys: (u) => (u?.startsWith(`${ORIGIN}/`) ? [u.slice(ORIGIN.length + 1)] : []),
    liveKeys: (u) => liveKeysForUrl(u, ORIGIN),
  }
  return Object.assign(p, { deleted })
}

const writeCalls = (fake: ReturnType<typeof createFakeSupabase>) =>
  fake.calls.filter((c) => c.op === 'update' || c.op === 'insert' || c.op === 'delete')

test('artwork finalize changes only the slot column of that show, plus one audit row', async () => {
  const fake = createFakeSupabase(tables())
  const before = fake.snapshot({ exclude: ['admin_audit_log'] })
  const res = await finalizeImageUploadCore(ports(fake), {
    kind: 'artwork',
    slot: 'poster',
    showId: SHOW,
    key: NEW_KEY,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'show-artwork', showId: SHOW, column: 'poster_url' },
    live: { type: 'show-artwork', showId: SHOW, columns: ['poster_url'] },
  })
  assert.equal(res.success, true)
  const after = fake.snapshot({ exclude: ['admin_audit_log'] })
  const expected = structuredClone(before)
  expected.shows![0]!.poster_url = `${ORIGIN}/${NEW_KEY}`
  assert.deepEqual(after, expected)
  const writes = writeCalls(fake)
  assert.equal(writes.filter((w) => w.table === 'shows').length, 1)
  assert.equal(writes.filter((w) => w.table === 'admin_audit_log').length, 1)
  assert.equal(writes.length, 2)
  assert.equal(fake.auditRows().length, 1)
})

test('site image finalize changes only the one app_config column', async () => {
  const fake = createFakeSupabase(tables())
  const before = fake.snapshot({ exclude: ['admin_audit_log'] })
  const res = await finalizeImageUploadCore(ports(fake), {
    kind: 'site-image',
    slot: 'og',
    key: 'site-assets/settings/og-1760000000000-abcdef01.jpg',
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'app-config', column: 'og_image_url' },
    live: { type: 'app-config', columns: ['og_image_url'] },
  })
  assert.equal(res.success, true)
  const expected = structuredClone(before)
  expected.app_config![0]!.og_image_url = `${ORIGIN}/site-assets/settings/og-1760000000000-abcdef01.jpg`
  assert.deepEqual(fake.snapshot({ exclude: ['admin_audit_log'] }), expected)
})

test('cast finalize writes only that member; a member of another show is not found', async () => {
  const fake = createFakeSupabase(tables())
  const key = `show-artwork/shows/${SHOW}/cast/1760000000000-abcdef01.png`
  const input = {
    kind: 'cast-image',
    slot: null,
    showId: SHOW,
    key,
    variantKeys: [],
    userId: 'admin-1',
    live: { type: 'show-cast', showId: SHOW } as const,
  }
  const wrongShow = await finalizeImageUploadCore(ports(fake), {
    ...input,
    target: { type: 'cast', castId: CAST, showId: OTHER_SHOW },
  })
  assert.equal(wrongShow.success, false)
  assert.equal(writeCalls(fake).length, 0)

  const ok = await finalizeImageUploadCore(ports(fake), {
    ...input,
    target: { type: 'cast', castId: CAST, showId: SHOW },
  })
  assert.equal(ok.success, true)
  assert.equal(fake.tables.show_cast![0]!.image_url, `${ORIGIN}/${key}`)
  assert.equal(writeCalls(fake).filter((w) => w.table === 'show_cast').length, 1)
})

test('audit failure restores the previous slot value in the database', async () => {
  const fake = createFakeSupabase(tables())
  const res = await finalizeImageUploadCore(ports(fake, 'audit down'), {
    kind: 'artwork',
    slot: 'poster',
    showId: SHOW,
    key: NEW_KEY,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'show-artwork', showId: SHOW, column: 'poster_url' },
    live: { type: 'show-artwork', showId: SHOW, columns: ['poster_url'] },
  })
  assert.equal(res.success, false)
  assert.equal(fake.tables.shows![0]!.poster_url, `${ORIGIN}/${OLD_KEY}`)
  assert.equal(fake.auditRows().length, 0)
})

test('an unknown show is refused before anything is written', async () => {
  const fake = createFakeSupabase(tables())
  const p = ports(fake)
  const res = await finalizeImageUploadCore(p, {
    kind: 'artwork',
    slot: 'poster',
    showId: '3f2504e0-4f89-41d3-9a0c-0305e82c3399',
    key: NEW_KEY,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'show-artwork', showId: '3f2504e0-4f89-41d3-9a0c-0305e82c3399', column: 'poster_url' },
    live: { type: 'show-artwork', showId: '3f2504e0-4f89-41d3-9a0c-0305e82c3399', columns: ['poster_url'] },
  })
  assert.equal(res.success, false)
  assert.equal(writeCalls(fake).length, 0)
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [[NEW_KEY]])
})

// ---- live scope reads (01.1 review: a re-sent live key is refused before finalize) ----

test('show-artwork scope reads every listed column of that show, read-only', async () => {
  const fake = createFakeSupabase(tables())
  const db = adminImageDb(fake.client as never)
  const r = await db.readLive({ type: 'show-artwork', showId: SHOW, columns: ['poster_url', 'card_image_url', 'hero_url', 'logo_url'] })
  assert.deepEqual(r, { urls: [`${ORIGIN}/${OLD_KEY}`, 'card-old', 'hero-old', null], error: null })
  assert.equal(writeCalls(fake).length, 0)
})

test('show-artwork scope of a show that does not exist yet has nothing live', async () => {
  const fake = createFakeSupabase(tables())
  const r = await adminImageDb(fake.client as never).readLive({
    type: 'show-artwork',
    showId: '3f2504e0-4f89-41d3-9a0c-0305e82c3399',
    columns: ['poster_url'],
  })
  assert.deepEqual(r, { urls: [], error: null })
})

test('app-config scope reads the listed site image columns', async () => {
  const fake = createFakeSupabase(tables())
  const r = await adminImageDb(fake.client as never).readLive({ type: 'app-config', columns: ['og_image_url', 'favicon_url'] })
  assert.deepEqual(r, { urls: ['og-old', 'fav-old'], error: null })
})

test('show-cast scope reads every cast image of that show only', async () => {
  const fake = createFakeSupabase(tables())
  const r = await adminImageDb(fake.client as never).readLive({ type: 'show-cast', showId: SHOW })
  assert.equal(r.error, null)
  assert.deepEqual(r.urls, [null, `${ORIGIN}/show-artwork/shows/${SHOW}/cast/1750000000000-12345678.png`])
})

test('social-icons scope reads every icon url in footer_content.social', async () => {
  const fake = createFakeSupabase(tables())
  const r = await adminImageDb(fake.client as never).readLive({ type: 'social-icons' })
  assert.deepEqual(r, { urls: [`${ORIGIN}/site-assets/settings/social-icons/1750000000000-12345678.png`, ''], error: null })
})

test('a failed scope read is an error (the core then refuses and deletes nothing)', async () => {
  const fake = createFakeSupabase(tables())
  fake.failOn({ table: 'app_config', op: 'select', nth: 1 })
  const r = await adminImageDb(fake.client as never).readLive({ type: 'social-icons' })
  assert.equal(r.urls.length, 0)
  assert.ok(r.error)
})

test('a re-sent live cast image (commit false, no member) is refused against the real db port', async () => {
  const fake = createFakeSupabase(tables())
  const p = ports(fake)
  const key = `show-artwork/shows/${SHOW}/cast/1750000000000-12345678.png`
  const res = await finalizeImageUploadCore(p, {
    kind: 'cast-image',
    slot: null,
    showId: SHOW,
    key,
    variantKeys: [],
    userId: 'admin-1',
    target: null,
    live: { type: 'show-cast', showId: SHOW },
  })
  assert.equal(res.success, false)
  assert.equal(res.error, 'This file is already the live image; upload a new file instead.')
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [])
  assert.equal(writeCalls(fake).length, 0)
})

test('a poster replaced while the card still shows the same file: the old key is kept', async () => {
  const t = tables()
  t.shows[0]!.card_image_url = `${ORIGIN}/${OLD_KEY}?v=3`
  const fake = createFakeSupabase(t)
  const p = ports(fake)
  const res = await finalizeImageUploadCore(p, {
    kind: 'artwork',
    slot: 'poster',
    showId: SHOW,
    key: NEW_KEY,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'show-artwork', showId: SHOW, column: 'poster_url' },
    live: { type: 'show-artwork', showId: SHOW, columns: ['poster_url', 'card_image_url', 'hero_url'] },
  })
  assert.equal(res.success, true)
  assert.equal(fake.tables.shows![0]!.poster_url, `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [])
})

test('a cast image replaced while another member of the show uses it: kept', async () => {
  const t = tables()
  const shared = `${ORIGIN}/show-artwork/shows/${SHOW}/cast/1750000000000-12345678.png`
  t.show_cast[0]!.image_url = shared
  const fake = createFakeSupabase(t)
  const p = ports(fake)
  const res = await finalizeImageUploadCore(p, {
    kind: 'cast-image',
    slot: null,
    showId: SHOW,
    key: `show-artwork/shows/${SHOW}/cast/1760000000000-abcdef01.png`,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'cast', castId: CAST, showId: SHOW },
    live: { type: 'show-cast', showId: SHOW },
  })
  assert.equal(res.success, true)
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [])
})

// ---- deferred items 22-23: cross-scope references and compare-and-swap writes ----

test('a poster replaced while the site OG image still uses it (another scope): the old key is kept', async () => {
  const t = tables()
  t.app_config[0]!.og_image_url = `${ORIGIN}/${OLD_KEY}`
  const fake = createFakeSupabase(t)
  const p = ports(fake)
  const res = await finalizeImageUploadCore(p, {
    kind: 'artwork',
    slot: 'poster',
    showId: SHOW,
    key: NEW_KEY,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'show-artwork', showId: SHOW, column: 'poster_url' },
    live: { type: 'show-artwork', showId: SHOW, columns: ['poster_url'] },
  })
  assert.equal(res.success, true)
  assert.equal(fake.tables.shows![0]!.poster_url, `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [])
})

test('with no other reference anywhere, the replaced poster is deleted (real db port)', async () => {
  const fake = createFakeSupabase(tables())
  const p = ports(fake)
  const res = await finalizeImageUploadCore(p, {
    kind: 'artwork',
    slot: 'poster',
    showId: SHOW,
    key: NEW_KEY,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'show-artwork', showId: SHOW, column: 'poster_url' },
    live: { type: 'show-artwork', showId: SHOW, columns: ['poster_url'] },
  })
  assert.equal(res.success, true)
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [[OLD_KEY]])
})

test('write is compare-and-swap: only while the column still holds the value read before', async () => {
  const fake = createFakeSupabase(tables())
  const db = adminImageDb(fake.client as never)
  const poster = { type: 'show-artwork', showId: SHOW, column: 'poster_url' } as const
  assert.equal(await db.write(poster, 'x', 'not-what-is-there'), MEDIA_SAVE_CONFLICT)
  assert.equal(fake.tables.shows![0]!.poster_url, `${ORIGIN}/${OLD_KEY}`)
  assert.equal(await db.write(poster, 'x', `${ORIGIN}/${OLD_KEY}`), null)
  assert.equal(fake.tables.shows![0]!.poster_url, 'x')
  // restore is a CAS on the value we wrote
  assert.equal(await db.restore(poster, 'back', 'someone-else'), MEDIA_SAVE_CONFLICT)
  assert.equal(await db.restore(poster, `${ORIGIN}/${OLD_KEY}`, 'x'), null)
  assert.equal(fake.tables.shows![0]!.poster_url, `${ORIGIN}/${OLD_KEY}`)
})

test('CAS on an empty column uses IS NULL; app_config and cast targets are CAS too', async () => {
  const fake = createFakeSupabase(tables())
  const db = adminImageDb(fake.client as never)
  const card = { type: 'show-artwork', showId: OTHER_SHOW, column: 'card_image_url' } as const
  assert.equal(await db.write(card, 'c', 'was-something'), MEDIA_SAVE_CONFLICT)
  assert.equal(await db.write(card, 'c', null), null)
  assert.equal(fake.tables.shows![1]!.card_image_url, 'c')
  const og = { type: 'app-config', column: 'og_image_url' } as const
  assert.equal(await db.write(og, 'o', 'stale'), MEDIA_SAVE_CONFLICT)
  assert.equal(fake.tables.app_config![0]!.og_image_url, 'og-old')
  assert.equal(await db.write(og, 'o', 'og-old'), null)
  const cast = { type: 'cast', castId: CAST2, showId: SHOW } as const
  assert.equal(await db.write(cast, 'k', null), MEDIA_SAVE_CONFLICT)
  assert.equal(await db.write(cast, 'k', `${ORIGIN}/show-artwork/shows/${SHOW}/cast/1750000000000-12345678.png`), null)
  assert.equal(fake.tables.show_cast![1]!.image_url, 'k')
})

test('a concurrent save between read and write: conflict error, other value kept, nothing previously live deleted', async () => {
  const fake = createFakeSupabase(tables())
  const p = ports(fake)
  const theirs = `${ORIGIN}/show-artwork/shows/${SHOW}/poster-1770000000000-99999999.webp`
  // The other admin's save lands right after our read of the current value.
  const realDb = p.db
  p.db = {
    ...realDb,
    readCurrent: async (t) => {
      const r = await realDb.readCurrent(t)
      fake.tables.shows![0]!.poster_url = theirs
      return r
    },
  }
  const res = await finalizeImageUploadCore(p, {
    kind: 'artwork',
    slot: 'poster',
    showId: SHOW,
    key: NEW_KEY,
    variantKeys: [],
    userId: 'admin-1',
    target: { type: 'show-artwork', showId: SHOW, column: 'poster_url' },
    live: { type: 'show-artwork', showId: SHOW, columns: ['poster_url'] },
  })
  assert.equal(res.success, false)
  assert.equal(res.error, MEDIA_SAVE_CONFLICT)
  assert.equal(fake.tables.shows![0]!.poster_url, theirs)
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [[NEW_KEY]])
  assert.equal(fake.auditRows().length, 0)
})
