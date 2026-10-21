// Weekly sweep of R2 uploads that were never finalised (Koss, Option B): minted
// upload keys only, older than 24 h, with no live reference. Dry run unless
// R2_UPLOAD_SWEEP_DELETE is exactly "on"; deletes go through deleteIfUnreferenced.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  UPLOAD_SWEEP_MAX_KEYS,
  UPLOAD_SWEEP_MIN_AGE_MS,
  mintedOriginalOf,
  runUploadSweep,
  sweepUnfinalisedUploads,
  uploadSweepDeleteEnabled,
  type SweepBucket,
} from '../../src/server/r2-upload-sweep.ts'
import { withVariantKeys, type MediaDeleteGuard } from '../../src/server/r2-delete.ts'
import { parseJsonc } from '../../scripts/cf/deploy-guard.mjs'

const NOW = Date.parse('2026-10-26T04:00:00.000Z')
const HOUR = 60 * 60 * 1000
const OLD = NOW - 48 * HOUR
const ORIGIN = 'https://media.clickitstory.ae'
const SHOW = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const USER = 'ffffffff-1111-4222-8333-444455556666'

const stamp = (ms: number, rand = 'abcdef12') => `${ms}-${rand}`

// One minted key per upload kind (src/server/upload-kinds.ts mintUploadKey).
const minted = (ms = OLD, rand = 'abcdef12') => ({
  artwork: `show-artwork/shows/${SHOW}/poster-${stamp(ms, rand)}.webp`,
  cast: `show-artwork/shows/${SHOW}/cast/${stamp(ms, rand)}.png`,
  siteImage: `site-assets/settings/og-${stamp(ms, rand)}.png`,
  socialIcon: `site-assets/settings/social-icons/${stamp(ms, rand)}.png`,
  avatar: `avatars/${USER}/avatar-${stamp(ms, rand)}.webp`,
  heroVideo: `site-assets/hero/video-mobile-${stamp(ms, rand)}.mp4`,
  preloader: `site-assets/preloader/video-${stamp(ms, rand)}.mp4`,
  showVideo: `site-assets/shows/${SHOW}/hero-desktop-${stamp(ms, rand)}.mp4`,
})

// The shapes the old Supabase upload code wrote (`-${Date.now()}`, no random part):
// the 86 copied objects look like these and must never be candidates.
const LEGACY = [
  `show-artwork/shows/${SHOW}/poster-1750000000000.webp`,
  `show-artwork/shows/${SHOW}/hero-mobile-1750000000000.webp`,
  `show-artwork/shows/${SHOW}/cast/1750000000000.png`,
  `site-assets/settings/og-1750000000000.png`,
  `site-assets/settings/social-icons/1750000000000.png`,
  `avatars/${USER}/avatar-1750000000000.webp`,
  `site-assets/hero-desktop-1750000000000.mp4`,
  `site-assets/preloader/video-1750000000000.mp4`,
  `site-assets/shows/${SHOW}/hero-desktop-1750000000000.mp4`,
  `show-artwork/shows/${SHOW}/poster.webp`,
  `site-assets/logo.svg`,
]

type Obj = { key: string; uploaded: Date | string }

function fakeBucket(objects: Obj[]) {
  const sorted = [...objects].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const listCalls: Array<{ cursor?: string; limit?: number }> = []
  const deleteCalls: string[][] = []
  const bucket: SweepBucket = {
    async list(options) {
      listCalls.push({ cursor: options.cursor, limit: options.limit })
      const start = options.cursor ? Number(options.cursor) : 0
      const limit = Math.min(options.limit ?? 1000, 1000)
      const page = sorted.slice(start, start + limit)
      const next = start + page.length
      const truncated = next < sorted.length
      return { objects: page, truncated, cursor: truncated ? String(next) : undefined }
    },
    async delete(keys) {
      deleteCalls.push(Array.isArray(keys) ? [...keys] : [keys])
    },
  }
  return { bucket, listCalls, deleteCalls }
}

function guardFor(urls: string[] | (() => Promise<{ urls: string[]; error: string | null }>)) {
  let reads = 0
  const guard: MediaDeleteGuard = {
    readReferences: async () => {
      reads += 1
      return typeof urls === 'function' ? urls() : { urls, error: null }
    },
    mediaOrigin: ORIGIN,
    label: '[test]',
  }
  return { guard, reads: () => reads }
}

const old = (key: string): Obj => ({ key, uploaded: new Date(OLD) })

// ---------------------------------------------------------------- key shape

test('every minted upload key maps to itself; legacy (copied Supabase) shapes never match', () => {
  for (const key of Object.values(minted())) assert.equal(mintedOriginalOf(key), key, key)
  for (const key of LEGACY) assert.equal(mintedOriginalOf(key), null, key)
  for (const key of ['', 'nope', 'show-artwork/../x.webp', `show-artwork/shows/${SHOW}/poster-1-aa.webp`]) {
    assert.equal(mintedOriginalOf(key), null, key)
  }
})

test('a variant maps to its minted original; variants of legacy keys and odd variant paths never match', () => {
  const key = minted().artwork
  for (const w of [640, 1280, 1920]) {
    assert.equal(mintedOriginalOf(`_v/${w}/webp/${key}`), key)
    assert.equal(mintedOriginalOf(`_v/${w}/avif/${key}`), key)
  }
  assert.equal(mintedOriginalOf(`_v/999/webp/${key}`), null)
  assert.equal(mintedOriginalOf(`_v/640/png/${key}`), null)
  assert.equal(mintedOriginalOf(`_v/640/webp/_v/640/webp/${key}`), null)
  for (const legacy of LEGACY) assert.equal(mintedOriginalOf(`_v/640/webp/${legacy}`), null, legacy)
})

// ---------------------------------------------------------------- age

test('age: only originals whose objects and key stamp are all older than 24 h', async () => {
  const fresh = minted(NOW - 1 * HOUR, '11111111').artwork
  const justOld = minted(NOW - 25 * HOUR, '22222222').artwork
  const freshUpload = minted(OLD, '33333333').artwork // old stamp, but the object landed 1 h ago
  const freshVariant = minted(OLD, '44444444').artwork // original old, a variant landed 1 h ago
  const badDate = minted(OLD, '55555555').artwork
  const edge = minted(NOW - UPLOAD_SWEEP_MIN_AGE_MS, '66666666').artwork // exactly 24 h: kept
  const { bucket } = fakeBucket([
    { key: fresh, uploaded: new Date(NOW - 1 * HOUR) },
    { key: justOld, uploaded: new Date(NOW - 25 * HOUR) },
    { key: freshUpload, uploaded: new Date(NOW - 1 * HOUR) },
    old(freshVariant),
    { key: `_v/640/webp/${freshVariant}`, uploaded: new Date(NOW - 1 * HOUR) },
    { key: badDate, uploaded: 'not a date' },
    { key: edge, uploaded: new Date(NOW - UPLOAD_SWEEP_MIN_AGE_MS) },
  ])
  const { guard } = guardFor([])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: false, nowMs: NOW })
  assert.equal(r.error, null)
  assert.deepEqual(r.candidateKeys, [justOld])
  assert.equal(r.minted, 6)
  assert.equal(r.aged, 1)
})

test('only minted originals become candidates; a lone old variant brings its original key', async () => {
  const keys = minted()
  const orphanVariantOriginal = minted(OLD, '77777777').cast
  const { bucket } = fakeBucket([
    ...Object.values(keys).map(old),
    ...LEGACY.map(old),
    ...LEGACY.map((k) => old(`_v/640/webp/${k}`)),
    old(`_v/1280/webp/${keys.artwork}`),
    old(`_v/640/webp/${orphanVariantOriginal}`),
  ])
  const { guard } = guardFor([])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: false, nowMs: NOW })
  assert.deepEqual(r.candidateKeys, [...Object.values(keys), orphanVariantOriginal].sort())
  assert.equal(r.examined, Object.values(keys).length + LEGACY.length * 2 + 2)
})

// ---------------------------------------------------------------- references

test('a referenced upload is kept, in any url form; the rest are candidates', async () => {
  const keys = minted()
  const { bucket } = fakeBucket(Object.values(keys).map(old))
  const { guard } = guardFor([
    `${ORIGIN}/${keys.artwork}?v=2`,
    `https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/${keys.avatar}`,
    `{"iconUrl":"${ORIGIN}/${keys.socialIcon}"}`,
  ])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: false, nowMs: NOW })
  assert.equal(r.referenced, 3)
  assert.deepEqual(
    r.candidateKeys,
    Object.values(keys)
      .filter((k) => k !== keys.artwork && k !== keys.avatar && k !== keys.socialIcon)
      .sort()
  )
})

for (const [label, source] of [
  ['an error', async () => ({ urls: [], error: 'shows read failed' })],
  ['a throw', async () => {
    throw new Error('network')
  }],
] as const) {
  test(`a reference read with ${label} deletes nothing, even with the flag on, and reports it`, async () => {
    const { bucket, deleteCalls } = fakeBucket(Object.values(minted()).map(old))
    const { guard } = guardFor(source as () => Promise<{ urls: string[]; error: string | null }>)
    const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: true, nowMs: NOW })
    assert.equal(deleteCalls.length, 0)
    assert.equal(r.candidates, 0)
    assert.deepEqual(r.candidateKeys, [])
    assert.equal(r.deleted, 0)
    assert.equal(typeof r.error, 'string')
  })
}

// ---------------------------------------------------------------- dry run and flag

test('the flag is on only for exactly "on"', () => {
  assert.equal(uploadSweepDeleteEnabled('on'), true)
  for (const v of ['off', 'ON', 'On', ' on', 'on ', 'true', '1', 'yes', '', undefined, null, 1, true]) {
    assert.equal(uploadSweepDeleteEnabled(v), false, String(v))
  }
})

test('dry run lists what it would delete and deletes nothing', async () => {
  const keys = Object.values(minted())
  const { bucket, deleteCalls } = fakeBucket(keys.map(old))
  const { guard, reads } = guardFor([])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: false, nowMs: NOW })
  assert.equal(r.mode, 'dry-run')
  assert.equal(deleteCalls.length, 0)
  assert.equal(r.candidates, keys.length)
  assert.deepEqual(r.candidateKeys, [...keys].sort())
  assert.equal(r.deleted, 0)
  assert.deepEqual(r.deletedKeys, [])
  assert.equal(reads(), 1)
})

test('flag on deletes exactly the candidates and their variants, re-checking references first', async () => {
  const keys = minted()
  const kept = keys.artwork
  const { bucket, deleteCalls } = fakeBucket([...Object.values(keys).map(old), ...LEGACY.map(old)])
  const { guard, reads } = guardFor([`${ORIGIN}/${kept}`])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: true, nowMs: NOW })
  const doomed = Object.values(keys).filter((k) => k !== kept).sort()
  assert.equal(r.mode, 'delete')
  assert.equal(r.error, null)
  assert.deepEqual(r.candidateKeys, doomed)
  assert.deepEqual(r.deletedKeys, doomed)
  assert.equal(r.deleted, doomed.length)
  assert.equal(reads(), 2, 'references read once to choose, once more right before the delete')
  const sent = deleteCalls.flat().sort()
  assert.deepEqual(sent, withVariantKeys(doomed).sort())
  for (const legacy of LEGACY) assert.ok(!sent.includes(legacy), legacy)
  assert.ok(!sent.some((k) => k.endsWith(kept)), 'the referenced upload and its variants stay')
})

test('a key that became live between the choice and the delete is kept', async () => {
  const keys = minted()
  let call = 0
  const { bucket, deleteCalls } = fakeBucket([old(keys.artwork), old(keys.cast)])
  const { guard } = guardFor(async () => {
    call += 1
    return { urls: call === 1 ? [] : [`${ORIGIN}/${keys.artwork}`], error: null }
  })
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: true, nowMs: NOW })
  assert.deepEqual(r.deletedKeys, [keys.cast])
  assert.ok(!deleteCalls.flat().some((k) => k.endsWith(keys.artwork)))
})

test('a failed R2 delete is reported, not thrown', async () => {
  const { bucket } = fakeBucket([old(minted().cast)])
  bucket.delete = async () => {
    throw new Error('r2 down')
  }
  const { guard } = guardFor([])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: true, nowMs: NOW })
  assert.equal(r.deleted, 0)
  assert.equal(typeof r.error, 'string')
})

// ---------------------------------------------------------------- pagination and cap

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => old(minted(OLD, i.toString(16).padStart(8, '0')).cast))

test('lists every page with the cursor until the listing ends', async () => {
  const { bucket, listCalls } = fakeBucket(many(2500))
  const { guard } = guardFor([])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: false, nowMs: NOW })
  assert.equal(r.examined, 2500)
  assert.equal(r.truncated, false)
  assert.equal(r.candidates, 2500)
  assert.deepEqual(
    listCalls.map((c) => c.cursor),
    [undefined, '1000', '2000']
  )
})

test('stops at the cap and reports truncation', async () => {
  assert.equal(UPLOAD_SWEEP_MAX_KEYS, 5000)
  const { bucket, listCalls } = fakeBucket(many(2500))
  const { guard } = guardFor([])
  const r = await sweepUnfinalisedUploads({ bucket, guard, deleteEnabled: false, nowMs: NOW, maxKeys: 1500 })
  assert.equal(r.examined, 1500)
  assert.equal(r.truncated, true)
  assert.equal(r.candidates, 1500)
  assert.deepEqual(listCalls.map((c) => c.limit), [1000, 500])
})

test('a truncated page without a cursor or a failed list deletes nothing', async () => {
  const keys = Object.values(minted())
  const noCursor = fakeBucket(keys.map(old))
  noCursor.bucket.list = async () => ({ objects: keys.map(old), truncated: true })
  const thrown = fakeBucket(keys.map(old))
  thrown.bucket.list = async () => {
    throw new Error('list failed')
  }
  for (const f of [noCursor, thrown]) {
    const { guard, reads } = guardFor([])
    const r = await sweepUnfinalisedUploads({ bucket: f.bucket, guard, deleteEnabled: true, nowMs: NOW })
    assert.equal(f.deleteCalls.length, 0)
    assert.equal(r.candidates, 0)
    assert.equal(typeof r.error, 'string')
    assert.equal(reads(), 0)
  }
})

// ---------------------------------------------------------------- runUploadSweep (cron entry)

test('runUploadSweep reads the flag from the Worker env: "on" deletes, anything else is a dry run', async () => {
  for (const [flag, mode] of [
    ['on', 'delete'],
    ['off', 'dry-run'],
    [undefined, 'dry-run'],
    ['ON', 'dry-run'],
  ] as const) {
    const { bucket, deleteCalls } = fakeBucket([old(minted().cast)])
    const { guard } = guardFor([])
    const r = await runUploadSweep({
      getEnv: async () => ({ MEDIA: bucket, R2_UPLOAD_SWEEP_DELETE: flag }),
      guard,
      nowMs: NOW,
    })
    assert.equal(r.mode, mode, String(flag))
    assert.equal(deleteCalls.length > 0, mode === 'delete', String(flag))
  }
})

test('runUploadSweep never throws: no env or no list binding comes back as an error result', async () => {
  const { guard } = guardFor([])
  const noEnv = await runUploadSweep({
    getEnv: async () => {
      throw new Error('no cloudflare context')
    },
    guard,
    nowMs: NOW,
  })
  assert.equal(noEnv.mode, 'dry-run')
  assert.equal(typeof noEnv.error, 'string')
  const noList = await runUploadSweep({ getEnv: async () => ({ MEDIA: {}, R2_UPLOAD_SWEEP_DELETE: 'on' }), guard, nowMs: NOW })
  assert.equal(typeof noList.error, 'string')
  assert.equal(noList.deleted, 0)
})

// ---------------------------------------------------------------- cron wiring

test('cleanup-media: prune, then the R2 upload sweep, then the Supabase sweep; every response reports it', () => {
  const route = readFileSync('src/app/api/cron/cleanup-media/route.ts', 'utf8')
  const run = route.slice(route.indexOf('async function runCleanup()'))
  const prune = run.indexOf('pruneRateLimits(admin, ')
  const sweep = run.indexOf('runUploadSweep(')
  assert.ok(sweep !== -1, 'runCleanup calls runUploadSweep')
  assert.ok(prune < sweep, 'prune first')
  assert.ok(sweep < run.indexOf('supabaseCleanupEnabled('), 'the sweep runs before the originals switch returns')
  assert.ok(sweep < run.indexOf("from('shows')"), 'the sweep runs before the Supabase sweep can fail')
  const responses = run.split('NextResponse.json(').slice(1)
  assert.ok(responses.length >= 3)
  for (const body of responses) assert.match(body.slice(0, body.indexOf(')')), /r2UploadSweep/)
  assert.match(run, /getWorkerEnv/)
  assert.match(run, /readMediaReferenceUrls\(/)
})

test('wrangler.jsonc ships the sweep flag off', () => {
  const config = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'))
  assert.equal(config.vars.R2_UPLOAD_SWEEP_DELETE, 'off')
  const text = readFileSync('wrangler.jsonc', 'utf8')
  const at = text.indexOf('"R2_UPLOAD_SWEEP_DELETE"')
  assert.match(text.slice(Math.max(0, at - 500), at), /Koss/, 'the comment above the var names Koss as the gate')
})
