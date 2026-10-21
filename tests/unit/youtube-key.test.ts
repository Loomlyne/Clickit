// YouTube API key resolver (D-20): the key lives in Supabase Vault and is read
// only through the service-role RPC get_youtube_key. These tests cover the pure
// cores and scan the server wrapper so it never caches across requests, never
// reads an env var and never logs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  readYouTubeKeyMetaCore,
  resolveYouTubeApiKeyCore,
  YOUTUBE_KEY_FORMAT,
} from '../../src/server/youtube/key.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const VALID = 'AIza' + 'Ab0_-'.repeat(7) // 4 + 35 characters
const SECRET_ERROR = 'permission denied: AIzaSecretLeakCheck'

function rpcCalls(fake: ReturnType<typeof createFakeSupabase>, name: string) {
  return fake.calls.filter((c) => c.op === 'rpc' && c.table === name)
}

test('resolve: calls get_youtube_key once and returns the trimmed key', async () => {
  const fake = createFakeSupabase()
  fake.registerRpc('get_youtube_key', () => ({
    data: `  ${VALID}\n`,
    error: null,
  }))
  assert.equal(await resolveYouTubeApiKeyCore(fake.client), VALID)
  const calls = rpcCalls(fake, 'get_youtube_key')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].patch, undefined)
})

for (const [label, data] of [
  ['null data', null],
  ['blank string', '   '],
  ['empty string', ''],
  ['a number', 42],
  ['an object', { key: VALID }],
] as const) {
  test(`resolve: ${label} returns null`, async () => {
    const fake = createFakeSupabase()
    fake.registerRpc('get_youtube_key', () => ({ data, error: null }))
    assert.equal(await resolveYouTubeApiKeyCore(fake.client), null)
  })
}

test('resolve: an rpc error returns null without its text', async () => {
  const fake = createFakeSupabase()
  fake.registerRpc('get_youtube_key', () => ({
    data: VALID,
    error: { code: '42501', message: SECRET_ERROR },
  }))
  const out = await resolveYouTubeApiKeyCore(fake.client)
  assert.equal(out, null)
})

test('resolve: a missing function returns null', async () => {
  const fake = createFakeSupabase()
  assert.equal(await resolveYouTubeApiKeyCore(fake.client), null)
})

test('resolve: a thrown rpc never throws', async () => {
  const fake = createFakeSupabase()
  fake.registerRpc('get_youtube_key', () => ({ data: VALID, error: null }))
  fake.throwOn({ rpc: 'get_youtube_key', nth: 1 })
  assert.equal(await resolveYouTubeApiKeyCore(fake.client), null)
})

test('meta: maps a row (array or single object) to hasKey/last4/updatedAt', async () => {
  const row = { has_key: true, last4: 'abcd', updated_at: '2026-10-20T10:00:00Z' }
  for (const data of [[row], row]) {
    const fake = createFakeSupabase()
    fake.registerRpc('youtube_key_meta', () => ({ data, error: null }))
    assert.deepEqual(await readYouTubeKeyMetaCore(fake.client), {
      hasKey: true,
      last4: 'abcd',
      updatedAt: '2026-10-20T10:00:00Z',
    })
    assert.equal(rpcCalls(fake, 'youtube_key_meta').length, 1)
  }
})

const EMPTY = { hasKey: false, last4: null, updatedAt: null }

test('meta: no key, no row, an error or a throw maps to hasKey false', async () => {
  const cases: Array<(f: ReturnType<typeof createFakeSupabase>) => void> = [
    (f) =>
      f.registerRpc('youtube_key_meta', () => ({
        data: [{ has_key: false, last4: null, updated_at: null }],
        error: null,
      })),
    (f) => f.registerRpc('youtube_key_meta', () => ({ data: [], error: null })),
    (f) => f.registerRpc('youtube_key_meta', () => ({ data: null, error: null })),
    (f) =>
      f.registerRpc('youtube_key_meta', () => ({
        data: [{ has_key: true, last4: 'abcd', updated_at: null }],
        error: { message: SECRET_ERROR },
      })),
    () => {}, // function missing
    (f) => {
      f.registerRpc('youtube_key_meta', () => ({ data: [], error: null }))
      f.throwOn({ rpc: 'youtube_key_meta', nth: 1 })
    },
  ]
  for (const setup of cases) {
    const fake = createFakeSupabase()
    setup(fake)
    assert.deepEqual(await readYouTubeKeyMetaCore(fake.client), EMPTY)
  }
})

test('meta: odd field types are not passed through', async () => {
  const fake = createFakeSupabase()
  fake.registerRpc('youtube_key_meta', () => ({
    data: [{ has_key: true, last4: 1234, updated_at: 5 }],
    error: null,
  }))
  assert.deepEqual(await readYouTubeKeyMetaCore(fake.client), {
    hasKey: true,
    last4: null,
    updatedAt: null,
  })
})

test('format: AIza plus 35 characters from [0-9A-Za-z_-] only', () => {
  assert.equal(VALID.length, 39)
  assert.ok(YOUTUBE_KEY_FORMAT.test(VALID))
  assert.ok(YOUTUBE_KEY_FORMAT.test('AIza' + 'A'.repeat(35)))
  assert.ok(!YOUTUBE_KEY_FORMAT.test('AIza' + 'A'.repeat(34)))
  assert.ok(!YOUTUBE_KEY_FORMAT.test('AIza' + 'A'.repeat(36)))
  assert.ok(!YOUTUBE_KEY_FORMAT.test('AIza' + 'A'.repeat(34) + ' '))
  assert.ok(!YOUTUBE_KEY_FORMAT.test(' AIza' + 'A'.repeat(35)))
  assert.ok(!YOUTUBE_KEY_FORMAT.test('AIzb' + 'A'.repeat(35)))
  assert.ok(!YOUTUBE_KEY_FORMAT.test('aiza' + 'A'.repeat(35)))
  assert.ok(!YOUTUBE_KEY_FORMAT.test('AIza' + 'A'.repeat(34) + '.'))
})

test('source scan: server wrapper is per-request only, no env, no logging', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../src/server/youtube-key.ts', import.meta.url)),
    'utf8'
  )
  assert.match(src, /^import 'server-only'/)
  assert.match(src, /import \{ cache \} from 'react'/)
  assert.match(src, /rpc|resolveYouTubeApiKeyCore/)
  assert.match(src, /export const readYouTubeApiKey = cache\(/)
  assert.match(src, /export const readYouTubeKeyMeta = cache\(/)
  assert.match(src, /export async function hasYouTubeApiKey\(/)
  assert.doesNotMatch(src, /^\s*let\s/m)
  assert.doesNotMatch(src, /\bMap\b/)
  assert.doesNotMatch(src, /process\.env\.YOUTUBE_API_KEY/)
  assert.doesNotMatch(src, /getWorkerEnv/)
  assert.doesNotMatch(src, /console\./)
})

test('source scan: key core is pure and never logs', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../src/server/youtube/key.ts', import.meta.url)),
    'utf8'
  )
  assert.doesNotMatch(src, /server-only|from '@\//)
  assert.doesNotMatch(src, /console\./)
  assert.doesNotMatch(src, /process\.env/)
  assert.doesNotMatch(src, /^\s*let\s/m)
})
