// Saving the YouTube key into Vault (06-16, D-15, D-20, G6): format check
// before any database call, rate limit 10 per admin per hour (fail closed),
// one set_youtube_key rpc, one audit row with the last 4 only. Fake key only.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  saveYouTubeApiKeyCore,
  youtubeKeySchema,
} from '../../src/lib/admin/youtube-key-save.ts'
import { runAdminAction, type AdminActionEnv } from '../../src/lib/admin/action-runner.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const KEY = 'AIza' + 'A'.repeat(31) + 'wxyz'
const ADMIN = 'admin-1'
// The fake stamps rows from 2026-01-01T00:00:00.001Z upward.
const NOW = new Date('2026-01-01T00:10:00.000Z')

type AuditCall = Record<string, unknown>

function setup(seedLimits: Array<Record<string, unknown>> = []) {
  const fake = createFakeSupabase({ rate_limits: seedLimits })
  const stored: string[] = []
  fake.registerRpc('set_youtube_key', (args: { p_key: string }) => {
    stored.push(args.p_key)
    return { data: args.p_key.slice(-4), error: null }
  })
  const auditCalls: AuditCall[] = []
  const audit = async (a: Parameters<typeof fake.auditWriter>[0]) => {
    auditCalls.push(a as AuditCall)
    return fake.auditWriter(a)
  }
  const deps = { audit, adminUserId: ADMIN, now: NOW }
  return { fake, stored, auditCalls, deps }
}

const rpcCalls = (fake: ReturnType<typeof createFakeSupabase>) =>
  fake.calls.filter((c) => c.op === 'rpc')
const limitCalls = (fake: ReturnType<typeof createFakeSupabase>) =>
  fake.calls.filter((c) => c.table === 'rate_limits')

function assertNoKey(value: unknown, label: string) {
  const text = JSON.stringify(value) ?? ''
  assert.ok(!text.includes(KEY), `${label} contains the key`)
  assert.ok(!text.includes(KEY.slice(0, 8)), `${label} contains the key prefix`)
}

test('youtubeKeySchema trims and accepts AIza + 35 characters of [0-9A-Za-z_-]', () => {
  assert.equal(youtubeKeySchema.parse(`  ${KEY}\n`), KEY)
  assert.ok(youtubeKeySchema.safeParse('AIza' + 'aZ09_-'.repeat(5) + 'abcde').success)
})

test('youtubeKeySchema refuses empty, 38 or 40 characters, an inner space, another prefix', () => {
  for (const bad of [
    '',
    '   ',
    'AIza' + 'A'.repeat(34),
    'AIza' + 'A'.repeat(36),
    'AIza' + 'A'.repeat(17) + ' ' + 'A'.repeat(17),
    'AIzb' + 'A'.repeat(35),
    'BIza' + 'A'.repeat(35),
    'AIza' + 'A'.repeat(34) + '!',
  ]) {
    assert.equal(youtubeKeySchema.safeParse(bad).success, false, JSON.stringify(bad))
  }
  assert.equal(youtubeKeySchema.safeParse(42).success, false)
  assert.equal(youtubeKeySchema.safeParse(null).success, false)
})

test('a bad format returns format_invalid with no rpc call and no rate-limit row', async () => {
  for (const bad of ['', 'AIza' + 'A'.repeat(34), 'not a key', 12345, undefined]) {
    const { fake, deps, auditCalls } = setup()
    const r = await saveYouTubeApiKeyCore(fake.client, deps, bad)
    assert.equal(r.success, false)
    assert.equal(r.wrote, false)
    assert.ok(!r.success && r.code === 'format_invalid')
    assert.equal(rpcCalls(fake).length, 0)
    assert.equal(limitCalls(fake).length, 0)
    assert.equal(auditCalls.length, 0)
  }
})

test('a valid key makes one set_youtube_key rpc and one audit row with last 4 only', async () => {
  const { fake, deps, stored, auditCalls } = setup()
  const r = await saveYouTubeApiKeyCore(fake.client, deps, `  ${KEY} `)
  assert.deepEqual(r, { success: true, wrote: true, data: { hasKey: true, last4: 'wxyz' } })
  assert.deepEqual(stored, [KEY])
  const rpcs = rpcCalls(fake)
  assert.equal(rpcs.length, 1)
  assert.equal(rpcs[0]!.table, 'set_youtube_key')
  assert.deepEqual(rpcs[0]!.patch, { p_key: KEY })
  assert.equal(auditCalls.length, 1)
  assert.deepEqual(auditCalls[0], {
    adminUserId: ADMIN,
    action: 'config_update',
    entity: 'app_config',
    entityId: '1',
    diff: { kind: 'youtube_key_changed', last4: 'wxyz' },
  })
  const rows = fake.auditRows()
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0]!.diff, { kind: 'youtube_key_changed', last4: 'wxyz' })
  assertNoKey(r, 'result')
  assertNoKey(auditCalls, 'audit args')
  assertNoKey(rows, 'audit rows')
})

test('rate limit: the 11th save by the same admin within an hour is refused before the rpc', async () => {
  const { fake, deps, stored } = setup()
  for (let i = 0; i < 10; i++) {
    const r = await saveYouTubeApiKeyCore(fake.client, deps, KEY)
    assert.equal(r.success, true, `save ${i + 1}`)
  }
  const r = await saveYouTubeApiKeyCore(fake.client, deps, KEY)
  assert.ok(!r.success && r.code === 'limited')
  assert.equal(r.wrote, false)
  assert.equal(stored.length, 10)
  const keys = new Set(fake.tables.rate_limits.map((row) => row.key))
  assert.deepEqual([...keys], [`youtube-key-save:${ADMIN}`])
  assertNoKey(r, 'limited result')
})

test('rate limit counts the last hour only and is per admin', async () => {
  const k = `youtube-key-save:${ADMIN}`
  const old = Array.from({ length: 10 }, (_, i) => ({
    id: `old-${i}`,
    key: k,
    created_at: '2025-12-31T23:09:59.000Z',
  }))
  const other = Array.from({ length: 10 }, (_, i) => ({
    id: `other-${i}`,
    key: 'youtube-key-save:admin-2',
    created_at: '2026-01-01T00:00:00.000Z',
  }))
  const { fake, deps } = setup([...old, ...other])
  const r = await saveYouTubeApiKeyCore(fake.client, deps, KEY)
  assert.equal(r.success, true)
})

test('rate limit fails closed when the ledger cannot be read', async () => {
  const { fake, deps, stored } = setup()
  fake.failOn({ table: 'rate_limits', op: 'select', nth: 1 })
  const r = await saveYouTubeApiKeyCore(fake.client, deps, KEY)
  assert.ok(!r.success && r.code === 'limited')
  assert.equal(stored.length, 0)
})

test('an rpc error returns save_failed with a fixed message and no audit row', async () => {
  const { fake, deps, auditCalls } = setup()
  fake.failOn({ rpc: 'set_youtube_key', nth: 1 })
  const r = await saveYouTubeApiKeyCore(fake.client, deps, KEY)
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.ok(!r.success && r.code === 'save_failed')
  assert.ok(!r.success && r.error === 'The key was not saved.')
  assert.equal(auditCalls.length, 0)
  assert.equal(fake.auditRows().length, 0)
  assertNoKey(r, 'rpc error result')
})

test('an rpc throw is caught as save_failed (nothing reaches the runner log)', async () => {
  const { fake, deps, auditCalls } = setup()
  fake.throwOn({ rpc: 'set_youtube_key', nth: 1 })
  const r = await saveYouTubeApiKeyCore(fake.client, deps, KEY)
  assert.ok(!r.success && r.code === 'save_failed')
  assert.equal(auditCalls.length, 0)
})

test('an rpc that echoes the key in its error never leaks it', async () => {
  const fake = createFakeSupabase({ rate_limits: [] })
  fake.registerRpc('set_youtube_key', (args: { p_key: string }) => ({
    data: null,
    error: { message: `bad value ${args.p_key}` },
  }))
  const r = await saveYouTubeApiKeyCore(
    fake.client,
    { audit: fake.auditWriter, adminUserId: ADMIN, now: NOW },
    KEY
  )
  assert.ok(!r.success && r.code === 'save_failed')
  assertNoKey(r, 'echo result')
})

test('an audit failure after a successful save returns success with auditError set', async () => {
  const { fake, deps, stored } = setup()
  fake.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await saveYouTubeApiKeyCore(fake.client, deps, KEY)
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.ok(r.success && typeof r.auditError === 'string' && r.auditError.length > 0)
  assert.ok(r.success && r.data.last4 === 'wxyz')
  assert.equal(stored.length, 1)
  assertNoKey(r, 'audit-failure result')
})

test('inside runAdminAction: logError never sees the key, even when the run throws', async () => {
  const { fake, deps } = setup()
  const logged: unknown[] = []
  const env: AdminActionEnv = {
    assertAdmin: async () => ({ id: ADMIN }),
    createDb: () => fake.client,
    audit: deps.audit,
    logError: (label, err) => logged.push([label, err instanceof Error ? err.message : err]),
  }
  fake.throwOn({ rpc: 'set_youtube_key', nth: 1 })
  const r1 = await runAdminAction(
    env,
    (ctx) => saveYouTubeApiKeyCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, now: NOW }, KEY),
    { fallbackError: 'The key was not saved.', revalidate: () => {} }
  )
  assert.equal(r1.success, false)
  const r2 = await runAdminAction(
    env,
    (ctx) => saveYouTubeApiKeyCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, now: NOW }, KEY),
    { fallbackError: 'The key was not saved.', revalidate: () => {} }
  )
  assert.equal(r2.success, true)
  assertNoKey([r1, r2], 'runner results')
  assertNoKey(logged, 'logError args')
})

test('non-admin: runAdminAction refuses before the core; no rpc and no insert', async () => {
  const { fake, deps } = setup()
  const logged: unknown[] = []
  const env: AdminActionEnv = {
    assertAdmin: async () => {
      throw new Error('Unauthorized')
    },
    createDb: () => fake.client,
    audit: deps.audit,
    logError: (label, err) => logged.push([label, err instanceof Error ? err.message : err]),
  }
  const r = await runAdminAction(
    env,
    (ctx) => saveYouTubeApiKeyCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, now: NOW }, KEY),
    { fallbackError: 'The key was not saved.', revalidate: () => {} }
  )
  assert.deepEqual(r, { success: false, error: 'Unauthorized' })
  assert.equal(fake.calls.length, 0)
  assert.equal(fake.auditRows().length, 0)
  assertNoKey(logged, 'logError args')
})
