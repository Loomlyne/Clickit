import assert from 'node:assert/strict'
import test from 'node:test'
import { finalizeImageUploadCore, type ImageUploadPorts } from '../../src/lib/admin/image-upload.ts'
import { adminImageDb } from '../../src/lib/admin/image-db.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const ORIGIN = 'https://media.test'
const SHOW = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OTHER_SHOW = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'
const CAST = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const NEW_KEY = `show-artwork/shows/${SHOW}/poster-1760000000000-abcdef01.webp`
const OLD_KEY = `show-artwork/shows/${SHOW}/poster-1750000000000-12345678.webp`

const tables = () => ({
  shows: [
    { id: SHOW, poster_url: `${ORIGIN}/${OLD_KEY}`, card_image_url: 'card-old', hero_url: 'hero-old' },
    { id: OTHER_SHOW, poster_url: 'other-poster', card_image_url: null },
  ],
  app_config: [{ id: 1, og_image_url: 'og-old', favicon_url: 'fav-old', admin_user_id: 'admin-1' }],
  show_cast: [{ id: CAST, show_id: SHOW, name: 'A', image_url: null }],
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
    previousR2Keys: (u) => (u?.startsWith(`${ORIGIN}/`) ? [u.slice(ORIGIN.length + 1)] : []),
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
  })
  assert.equal(res.success, false)
  assert.equal(writeCalls(fake).length, 0)
  assert.deepEqual((p as unknown as { deleted: string[][] }).deleted, [[NEW_KEY]])
})
