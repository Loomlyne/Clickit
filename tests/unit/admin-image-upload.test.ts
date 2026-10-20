import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  finalizeImageUploadCore,
  type ImageTarget,
  type ImageUploadPorts,
  type LiveScope,
} from '../../src/lib/admin/image-upload.ts'
import { MEDIA_SAVE_CONFLICT } from '../../src/server/media-references.ts'

const ORIGIN = 'https://media.test'
const SHOW = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const USER = '9b2c1f6e-5d3a-4c8e-8f10-2a7d6b9c0e11'
const NEW_KEY = `show-artwork/shows/${SHOW}/poster-1760000000000-abcdef01.webp`
const NEW_V = `_v/640/webp/${NEW_KEY}`
const OLD_KEY = `show-artwork/shows/${SHOW}/poster-1750000000000-12345678.webp`
const OLD_R2_URL = `${ORIGIN}/${OLD_KEY}`
const OLD_SUPABASE_URL = 'https://proj.supabase.co/storage/v1/object/public/show-artwork/shows/x/poster-1.webp'

const ARTWORK_TARGET: ImageTarget = { type: 'show-artwork', showId: SHOW, column: 'poster_url' }
const ARTWORK_LIVE: LiveScope = { type: 'show-artwork', showId: SHOW, columns: ['poster_url', 'card_image_url'] }
const PROFILE_LIVE: LiveScope = { type: 'profile', userId: USER }

type Opts = {
  previous?: string | null
  finalizeOk?: boolean
  finalizeError?: string
  origin?: string | null
  readError?: string
  writeError?: string
  restoreError?: string
  auditError?: string | null
  noAudit?: boolean
  deleteFails?: boolean | 'first'
  /** Other live urls in the scope besides the target's current value. */
  live?: Array<string | null>
  liveError?: string
  /** Live urls in OTHER scopes (site OG image, another show, a profile...). */
  elsewhere?: string[]
  /** The cross-scope reference read fails: 'always', or only once the target was written. */
  referencesError?: 'always' | 'after-write'
  /** Another admin saved this value into the target between our read and our write. */
  concurrent?: string | null
}

function setup(opts: Opts = {}) {
  const log: string[] = []
  const writes: Array<{ target: ImageTarget; url: string | null }> = []
  const audits: unknown[] = []
  const deletes: string[][] = []
  const finalizeInputs: Array<{ key: string; liveKeys?: readonly string[] }> = []
  const liveScopes: LiveScope[] = []
  let value: string | null = 'previous' in opts ? (opts.previous ?? null) : OLD_R2_URL
  let deleteCalls = 0
  let written = false

  const ports: ImageUploadPorts = {
    finalize: async (input) => {
      log.push('finalize')
      finalizeInputs.push(input)
      if (opts.finalizeOk === false) return { ok: false, error: opts.finalizeError ?? 'Invalid upload key' }
      return { ok: true, key: input.key, variants: [...input.variantKeys] }
    },
    db: {
      readLive: async (scope) => {
        log.push('live')
        liveScopes.push(scope)
        if (opts.liveError) return { urls: [], error: opts.liveError }
        return { urls: [value, ...(opts.live ?? [])], error: null }
      },
      readCurrent: async () => {
        log.push('read')
        return opts.readError ? { error: opts.readError, url: null } : { error: null, url: value }
      },
      write: async (target, url, expected) => {
        log.push('write')
        if (opts.writeError) return opts.writeError
        if ('concurrent' in opts) value = opts.concurrent ?? null
        // Compare-and-swap, as the real port: only while the column still holds what we read.
        if (value !== expected) return MEDIA_SAVE_CONFLICT
        writes.push({ target, url })
        value = url
        written = true
        return null
      },
      restore: async (target, previous, expected) => {
        log.push('restore')
        if (opts.restoreError) return opts.restoreError
        if (value !== expected) return MEDIA_SAVE_CONFLICT
        writes.push({ target, url: previous })
        value = previous
        return null
      },
    },
    media: {
      delete: async (keys) => {
        log.push('delete')
        deleteCalls += 1
        deletes.push(keys)
        if (opts.deleteFails === true || (opts.deleteFails === 'first' && deleteCalls === 1)) {
          throw new Error('r2 down')
        }
      },
    },
    audit: opts.noAudit
      ? null
      : async (entry) => {
          log.push('audit')
          audits.push(entry)
          return { error: opts.auditError ?? null }
        },
    mediaOrigin: 'origin' in opts ? (opts.origin ?? null) : ORIGIN,
    // Every live url in every scope, read fresh each time (the target's value included).
    references: async () => {
      if (opts.referencesError === 'always' || (opts.referencesError === 'after-write' && written)) {
        return { urls: [], error: 'refs down' }
      }
      const urls = [value, ...(opts.live ?? []), ...(opts.elsewhere ?? [])].filter((u): u is string => !!u)
      return { urls, error: null }
    },
    previousR2Keys: (url) => {
      if (!url || !url.startsWith(`${ORIGIN}/`)) return []
      const k = url.slice(ORIGIN.length + 1).split('?')[0]!
      return [k, `_v/640/webp/${k}`]
    },
    liveKeys: (url) => {
      if (!url || !url.startsWith(`${ORIGIN}/`)) return []
      const k = url.slice(ORIGIN.length + 1).split('?')[0]!
      return [k, `_v/640/webp/${k}`, `_v/1280/webp/${k}`]
    },
  }
  return { ports, log, writes, audits, deletes, finalizeInputs, liveScopes, current: () => value }
}

const input = (over: Partial<Parameters<typeof finalizeImageUploadCore>[1]> = {}) => ({
  kind: 'artwork' as const,
  slot: 'poster',
  showId: SHOW,
  key: NEW_KEY,
  variantKeys: [NEW_V],
  target: ARTWORK_TARGET as ImageTarget | null,
  live: ARTWORK_LIVE,
  userId: 'admin-1',
  ...over,
})

test('happy path: finalize, write, audit, then delete the previous R2 key', async () => {
  const w = setup()
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.equal(res.data, `${ORIGIN}/${NEW_KEY}`)
  assert.equal(res.wrote, true)
  assert.equal(res.mediaCleanupFailed, undefined)
  assert.deepEqual(w.log, ['live', 'finalize', 'read', 'write', 'audit', 'delete'])
  assert.equal(w.current(), `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.deletes, [[OLD_KEY, `_v/640/webp/${OLD_KEY}`]])
})

test('previous value is a Supabase Storage URL: nothing is deleted for it', async () => {
  const w = setup({ previous: OLD_SUPABASE_URL })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [])
  assert.deepEqual(w.log, ['live', 'finalize', 'read', 'write', 'audit'])
})

test('previous value empty: nothing is deleted', async () => {
  const w = setup({ previous: null })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [])
})

// Phase 01.1 review (PR #23, 974922f), carried from the video core (9898ecb): a key that
// is already live is refused before finalize, so no refusal, failed write or failed audit
// can delete the live file.
const LIVE_MESSAGE = 'This file is already the live image; upload a new file instead.'
function assertUntouched(w: ReturnType<typeof setup>, liveUrl: string | null) {
  assert.deepEqual(w.log, ['live'])
  assert.deepEqual(w.finalizeInputs, [])
  assert.deepEqual(w.deletes, [])
  assert.deepEqual(w.writes, [])
  assert.equal(w.audits.length, 0)
  assert.equal(w.current(), liveUrl)
}

test('previous value is the same key: refused as live, nothing finalized, written or deleted', async () => {
  const w = setup({ previous: `${ORIGIN}/${NEW_KEY}?v=2` })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.deepEqual(res, { success: false, error: LIVE_MESSAGE, wrote: false })
  assertUntouched(w, `${ORIGIN}/${NEW_KEY}?v=2`)
})

test('a live key with a write that would fail and an audit that would fail is still never deleted', async () => {
  for (const fail of [{ writeError: 'permission denied' }, { auditError: 'audit down' }]) {
    const w = setup({ previous: `${ORIGIN}/${NEW_KEY}`, ...fail })
    const res = await finalizeImageUploadCore(w.ports, input())
    assert.deepEqual(res, { success: false, error: LIVE_MESSAGE, wrote: false })
    assertUntouched(w, `${ORIGIN}/${NEW_KEY}`)
  }
})

test('a finalize that would refuse is never reached for a live key (its refusal deletes)', async () => {
  const w = setup({ previous: `${ORIGIN}/${NEW_KEY}`, finalizeOk: false, finalizeError: 'Image must be under 10MB' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.error, LIVE_MESSAGE)
  assertUntouched(w, `${ORIGIN}/${NEW_KEY}`)
})

test('the key live in another column of the same scope is refused too', async () => {
  const w = setup({ live: [`${ORIGIN}/${NEW_KEY}`] })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.error, LIVE_MESSAGE)
  assertUntouched(w, OLD_R2_URL)
  assert.deepEqual(w.liveScopes, [ARTWORK_LIVE])
})

test('a sent variant key that is live is refused, even when the original key is new', async () => {
  const w = setup({ live: [`${ORIGIN}/${OLD_KEY}`] })
  const res = await finalizeImageUploadCore(w.ports, input({ variantKeys: [`_v/1280/webp/${OLD_KEY}`] }))
  assert.equal(res.error, LIVE_MESSAGE)
  assertUntouched(w, OLD_R2_URL)
})

test('reading the live scope fails: refused with that error, nothing finalized or deleted', async () => {
  const w = setup({ liveError: 'db down', writeError: 'x', auditError: 'y' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.deepEqual(res, { success: false, error: 'db down', wrote: false })
  assertUntouched(w, OLD_R2_URL)
})

test('commit false (no target): a key live in the scope is refused and nothing is deleted', async () => {
  for (const extra of [{}, { auditError: 'audit down' }, { finalizeOk: false }]) {
    const w = setup({ live: [`${ORIGIN}/${NEW_KEY}`], ...extra })
    const res = await finalizeImageUploadCore(w.ports, input({ target: null }))
    assert.deepEqual(res, { success: false, error: LIVE_MESSAGE, wrote: false })
    assertUntouched(w, OLD_R2_URL)
  }
})

test('social icon and cast without a member: their scopes are read and a live key is refused', async () => {
  const scopes: LiveScope[] = [{ type: 'social-icons' }, { type: 'show-cast', showId: SHOW }]
  for (const live of scopes) {
    const w = setup({ live: [`${ORIGIN}/${NEW_KEY}`], auditError: 'audit down' })
    const res = await finalizeImageUploadCore(w.ports, input({ kind: 'social-icon', slot: null, target: null, live }))
    assert.equal(res.error, LIVE_MESSAGE)
    assertUntouched(w, OLD_R2_URL)
    assert.deepEqual(w.liveScopes, [live])
  }
})

test('avatar: the live avatar key is refused and the profile is untouched', async () => {
  const key = `avatars/${USER}/avatar-1760000000000-abcdef01.webp`
  const w = setup({ previous: `${ORIGIN}/${key}`, noAudit: true, writeError: 'denied' })
  const res = await finalizeImageUploadCore(w.ports, {
    kind: 'avatar',
    slot: null,
    showId: null,
    key,
    variantKeys: [],
    target: { type: 'profile', userId: USER },
    live: PROFILE_LIVE,
    userId: USER,
  })
  assert.equal(res.error, LIVE_MESSAGE)
  assertUntouched(w, `${ORIGIN}/${key}`)
})

test('a new key goes on to finalize with the live keys, so finalize can refuse them too', async () => {
  const w = setup()
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.finalizeInputs[0]!.liveKeys, [OLD_KEY, `_v/640/webp/${OLD_KEY}`, `_v/1280/webp/${OLD_KEY}`])
})

test('finalize refused: no db call, no audit, error returned', async () => {
  const w = setup({ finalizeOk: false, finalizeError: 'SVG images are not allowed' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.equal(res.error, 'SVG images are not allowed')
  assert.equal(res.wrote, false)
  assert.deepEqual(w.log, ['live', 'finalize'])
  assert.deepEqual(w.writes, [])
})

test('no media origin: refused before finalize and before any db call', async () => {
  const w = setup({ origin: null })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.equal(res.error, 'Media host is not ready')
  assert.deepEqual(w.log, [])
})

test('db update error: new key and variants deleted, previous untouched', async () => {
  const w = setup({ writeError: 'permission denied' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.equal(res.error, 'permission denied')
  assert.equal(res.wrote, false)
  assert.deepEqual(w.deletes, [[NEW_KEY, NEW_V]])
  assert.equal(w.current(), OLD_R2_URL)
  assert.ok(!w.log.includes('audit'))
  assert.ok(!w.log.includes('restore'))
})

test('strict audit failure: previous value restored, new key and variants deleted, old key kept', async () => {
  const w = setup({ auditError: 'audit insert failed' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.match(res.error ?? '', /audit/i)
  assert.equal(w.current(), OLD_R2_URL)
  assert.deepEqual(w.deletes, [[NEW_KEY, NEW_V]])
  assert.deepEqual(w.log, ['live', 'finalize', 'read', 'write', 'audit', 'restore', 'delete'])
})

test('audit failure and restore failure: both reported, the new object is KEPT because the row still shows it', async () => {
  // Deferred item 21: before, the new object was deleted here while the column still held
  // its url (a broken live image). The cleanup now re-reads every reference first.
  const w = setup({ auditError: 'audit insert failed', restoreError: 'restore denied' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.match(res.error ?? '', /restore denied/)
  assert.equal(w.current(), `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.deletes, [])
})

test('cleanup of the previous R2 key fails: ok result with mediaCleanupFailed', async () => {
  const w = setup({ deleteFails: true })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.equal(res.mediaCleanupFailed, true)
  assert.equal(w.current(), `${ORIGIN}/${NEW_KEY}`)
})

test('reading the current value fails: new object removed, nothing written', async () => {
  const w = setup({ readError: 'boom' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.equal(res.error, 'boom')
  assert.deepEqual(w.writes, [])
  assert.deepEqual(w.deletes, [[NEW_KEY, NEW_V]])
})

test('avatar: another user\'s key is refused by finalize and nothing is written', async () => {
  const w = setup({ finalizeOk: false, finalizeError: 'Invalid upload key', noAudit: true })
  const res = await finalizeImageUploadCore(w.ports, {
    kind: 'avatar',
    slot: null,
    showId: null,
    key: 'avatars/00000000-0000-4000-8000-000000000000/avatar-1760000000000-abcdef01.webp',
    variantKeys: [],
    target: { type: 'profile', userId: USER },
    live: PROFILE_LIVE,
    userId: USER,
  })
  assert.equal(res.success, false)
  assert.equal(res.error, 'Invalid upload key')
  assert.deepEqual(w.writes, [])
  assert.deepEqual(w.deletes, [])
})

test('avatar without an audit port: writes the profile, skips the audit', async () => {
  const w = setup({ noAudit: true, previous: null })
  const res = await finalizeImageUploadCore(w.ports, {
    kind: 'avatar',
    slot: null,
    showId: null,
    key: `avatars/${USER}/avatar-1760000000000-abcdef01.webp`,
    variantKeys: [],
    target: { type: 'profile', userId: USER },
    live: PROFILE_LIVE,
    userId: USER,
  })
  assert.equal(res.success, true)
  assert.deepEqual(w.log, ['live', 'finalize', 'read', 'write'])
})

test('no target (cast image before the member exists): finalize and audit only, url returned, no db write', async () => {
  const w = setup()
  const res = await finalizeImageUploadCore(w.ports, input({ kind: 'cast-image', slot: null, target: null }))
  assert.equal(res.success, true)
  assert.equal(res.data, `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.log, ['live', 'finalize', 'audit'])
  assert.deepEqual(w.writes, [])
  assert.deepEqual(w.deletes, [])
})

test('no target and audit failure: the new object is removed, nothing to restore', async () => {
  const w = setup({ auditError: 'nope' })
  const res = await finalizeImageUploadCore(w.ports, input({ target: null }))
  assert.equal(res.success, false)
  assert.deepEqual(w.deletes, [[NEW_KEY, NEW_V]])
  assert.ok(!w.log.includes('restore'))
})

test('a successful artwork finalize records exactly one write and one audit row', async () => {
  const w = setup()
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.equal(w.writes.length, 1)
  assert.deepEqual(w.writes[0], { target: ARTWORK_TARGET, url: `${ORIGIN}/${NEW_KEY}` })
  assert.equal(w.audits.length, 1)
  const a = w.audits[0] as { adminUserId: string; action: string; entity: string; diff: Record<string, unknown> }
  assert.equal(a.adminUserId, 'admin-1')
  assert.equal(a.action, 'upload')
  assert.equal(a.entity, 'storage')
  assert.equal(a.diff.key, NEW_KEY)
  assert.equal(a.diff.slot, 'poster')
})

test('audit rows carry the previous key so a restore can be traced', async () => {
  const w = setup()
  await finalizeImageUploadCore(w.ports, input())
  const a = w.audits[0] as { diff: Record<string, unknown> }
  assert.equal(a.diff.previous_url, OLD_R2_URL)
})

// ---- shared references: a replaced key another live value still uses is kept ----

test('the replaced key is kept while another column of the scope still uses it', async () => {
  for (const other of [OLD_R2_URL, `${OLD_R2_URL}?v=2`]) {
    const w = setup({ live: [other] })
    const res = await finalizeImageUploadCore(w.ports, input())
    assert.equal(res.success, true)
    assert.equal(res.mediaCleanupFailed, undefined)
    assert.equal(w.current(), `${ORIGIN}/${NEW_KEY}`)
    assert.deepEqual(w.deletes, [])
    assert.ok(!w.log.includes('delete'))
  }
})

test('the target\'s own value counts once: with no other reference the replaced key is deleted', async () => {
  const w = setup({ live: [null, `${ORIGIN}/show-artwork/shows/${SHOW}/card-1750000000000-99999999.webp`] })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [[OLD_KEY, `_v/640/webp/${OLD_KEY}`]])
})

test('avatar: the scope is the user\'s own value, so the replaced avatar is deleted', async () => {
  const oldAvatar = `avatars/${USER}/avatar-1750000000000-12345678.webp`
  const w = setup({ previous: `${ORIGIN}/${oldAvatar}`, noAudit: true })
  const res = await finalizeImageUploadCore(w.ports, {
    kind: 'avatar',
    slot: null,
    showId: null,
    key: `avatars/${USER}/avatar-1760000000000-abcdef01.webp`,
    variantKeys: [],
    target: { type: 'profile', userId: USER },
    live: PROFILE_LIVE,
    userId: USER,
  })
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [[oldAvatar, `_v/640/webp/${oldAvatar}`]])
})

// ---- deferred items 21-23: cross-scope references and compare-and-swap writes ----

test('cross-scope share kept on replace: the old poster is also the site OG image', async () => {
  for (const other of [OLD_R2_URL, `${OLD_R2_URL}?v=9`, `https://proj.supabase.co/storage/v1/object/public/${OLD_KEY}`]) {
    const w = setup({ elsewhere: [other] })
    const res = await finalizeImageUploadCore(w.ports, input())
    assert.equal(res.success, true)
    assert.equal(w.current(), `${ORIGIN}/${NEW_KEY}`)
    assert.deepEqual(w.deletes, [], other)
  }
})

test('variant keys of a still-referenced original are kept (a variant url stored elsewhere)', async () => {
  const w = setup({ elsewhere: [`${ORIGIN}/_v/1280/webp/${OLD_KEY}`] })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [])
})

test('reference read fails after the write: the image is saved, nothing is deleted, cleanup flagged', async () => {
  const w = setup({ referencesError: 'after-write' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.equal(res.mediaCleanupFailed, true)
  assert.equal(w.current(), `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.deletes, [])
})

test('a key live in ANOTHER scope is refused before finalize (its refusal would delete it)', async () => {
  for (const live of [`${ORIGIN}/${NEW_KEY}`, `${ORIGIN}/_v/640/webp/${NEW_KEY}`]) {
    const w = setup({ elsewhere: [live], finalizeOk: false })
    const res = await finalizeImageUploadCore(w.ports, input())
    assert.deepEqual(res, { success: false, error: LIVE_MESSAGE, wrote: false })
    assertUntouched(w, OLD_R2_URL)
  }
})

test('the cross-scope reference read fails before finalize: refused, nothing finalized or deleted', async () => {
  const w = setup({ referencesError: 'always' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.deepEqual(res, { success: false, error: 'refs down', wrote: false })
  assertUntouched(w, OLD_R2_URL)
})

test('CAS conflict: another admin saved first; their value stays, the live key is not deleted, only the fresh upload goes', async () => {
  const theirs = `${ORIGIN}/show-artwork/shows/${SHOW}/poster-1770000000000-99999999.webp`
  const w = setup({ concurrent: theirs })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.deepEqual(res, { success: false, error: MEDIA_SAVE_CONFLICT, wrote: false })
  assert.equal(w.current(), theirs)
  assert.deepEqual(w.writes, [])
  assert.deepEqual(w.deletes, [[NEW_KEY, NEW_V]])
  assert.equal(w.audits.length, 0)
})

test('CAS conflict when the column was empty and someone filled it: no overwrite', async () => {
  const w = setup({ previous: null, concurrent: OLD_R2_URL })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.error, MEDIA_SAVE_CONFLICT)
  assert.equal(w.current(), OLD_R2_URL)
  assert.deepEqual(w.deletes, [[NEW_KEY, NEW_V]])
})

test('image-upload.ts stays a pure core: no next/, server-only or @/ imports', () => {
  const src = readFileSync('src/lib/admin/image-upload.ts', 'utf8')
  assert.ok(!/from\s+['"](next\/|server-only|@\/)/.test(src))
  assert.ok(!/import\s+['"]server-only['"]/.test(src))
})
