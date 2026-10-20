import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  finalizeImageUploadCore,
  type ImageTarget,
  type ImageUploadPorts,
} from '../../src/lib/admin/image-upload.ts'

const ORIGIN = 'https://media.test'
const SHOW = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const USER = '9b2c1f6e-5d3a-4c8e-8f10-2a7d6b9c0e11'
const NEW_KEY = `show-artwork/shows/${SHOW}/poster-1760000000000-abcdef01.webp`
const NEW_V = `_v/640/webp/${NEW_KEY}`
const OLD_KEY = `show-artwork/shows/${SHOW}/poster-1750000000000-12345678.webp`
const OLD_R2_URL = `${ORIGIN}/${OLD_KEY}`
const OLD_SUPABASE_URL = 'https://proj.supabase.co/storage/v1/object/public/show-artwork/shows/x/poster-1.webp'

const ARTWORK_TARGET: ImageTarget = { type: 'show-artwork', showId: SHOW, column: 'poster_url' }

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
}

function setup(opts: Opts = {}) {
  const log: string[] = []
  const writes: Array<{ target: ImageTarget; url: string | null }> = []
  const audits: unknown[] = []
  const deletes: string[][] = []
  let value: string | null = 'previous' in opts ? (opts.previous ?? null) : OLD_R2_URL
  let deleteCalls = 0

  const ports: ImageUploadPorts = {
    finalize: async (input) => {
      log.push('finalize')
      if (opts.finalizeOk === false) return { ok: false, error: opts.finalizeError ?? 'Invalid upload key' }
      return { ok: true, key: input.key, variants: [...input.variantKeys] }
    },
    db: {
      readCurrent: async () => {
        log.push('read')
        return opts.readError ? { error: opts.readError, url: null } : { error: null, url: value }
      },
      write: async (target, url) => {
        log.push('write')
        if (opts.writeError) return opts.writeError
        writes.push({ target, url })
        value = url
        return null
      },
      restore: async (target, previous) => {
        log.push('restore')
        if (opts.restoreError) return opts.restoreError
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
    previousR2Keys: (url) => {
      if (!url || !url.startsWith(`${ORIGIN}/`)) return []
      const k = url.slice(ORIGIN.length + 1).split('?')[0]!
      return [k, `_v/640/webp/${k}`]
    },
  }
  return { ports, log, writes, audits, deletes, current: () => value }
}

const input = (over: Partial<Parameters<typeof finalizeImageUploadCore>[1]> = {}) => ({
  kind: 'artwork' as const,
  slot: 'poster',
  showId: SHOW,
  key: NEW_KEY,
  variantKeys: [NEW_V],
  target: ARTWORK_TARGET as ImageTarget | null,
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
  assert.deepEqual(w.log, ['finalize', 'read', 'write', 'audit', 'delete'])
  assert.equal(w.current(), `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.deletes, [[OLD_KEY, `_v/640/webp/${OLD_KEY}`]])
})

test('previous value is a Supabase Storage URL: nothing is deleted for it', async () => {
  const w = setup({ previous: OLD_SUPABASE_URL })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [])
  assert.deepEqual(w.log, ['finalize', 'read', 'write', 'audit'])
})

test('previous value empty: nothing is deleted', async () => {
  const w = setup({ previous: null })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [])
})

test('previous value is the same key: it is never deleted', async () => {
  const w = setup({ previous: `${ORIGIN}/${NEW_KEY}` })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, true)
  assert.deepEqual(w.deletes, [])
})

test('finalize refused: no db call, no audit, error returned', async () => {
  const w = setup({ finalizeOk: false, finalizeError: 'SVG images are not allowed' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.equal(res.error, 'SVG images are not allowed')
  assert.equal(res.wrote, false)
  assert.deepEqual(w.log, ['finalize'])
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
  assert.deepEqual(w.log, ['finalize', 'read', 'write', 'audit', 'restore', 'delete'])
})

test('audit failure and restore failure: both reported, new object still removed', async () => {
  const w = setup({ auditError: 'audit insert failed', restoreError: 'restore denied' })
  const res = await finalizeImageUploadCore(w.ports, input())
  assert.equal(res.success, false)
  assert.match(res.error ?? '', /restore denied/)
  assert.deepEqual(w.deletes, [[NEW_KEY, NEW_V]])
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
    userId: USER,
  })
  assert.equal(res.success, true)
  assert.deepEqual(w.log, ['finalize', 'read', 'write'])
})

test('no target (cast image before the member exists): finalize and audit only, url returned, no db write', async () => {
  const w = setup()
  const res = await finalizeImageUploadCore(w.ports, input({ kind: 'cast-image', slot: null, target: null }))
  assert.equal(res.success, true)
  assert.equal(res.data, `${ORIGIN}/${NEW_KEY}`)
  assert.deepEqual(w.log, ['finalize', 'audit'])
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

test('image-upload.ts stays a pure core: no next/, server-only or @/ imports', () => {
  const src = readFileSync('src/lib/admin/image-upload.ts', 'utf8')
  assert.ok(!/from\s+['"](next\/|server-only|@\/)/.test(src))
  assert.ok(!/import\s+['"]server-only['"]/.test(src))
})
