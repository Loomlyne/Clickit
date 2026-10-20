import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCronRequest,
  supabaseCleanupEnabled,
  CRON_EXPRESSIONS_FOR_PHASE_3,
} from '../../src/server/scheduled.ts'

test('buildCronRequest maps the daily cron to publish-scheduled with the Bearer secret', () => {
  const req = buildCronRequest('0 1 * * *', 's')
  assert.ok(req)
  assert.equal(req.method, 'GET')
  assert.equal(req.url, 'https://self.invalid/api/cron/publish-scheduled')
  assert.equal(req.headers.get('authorization'), 'Bearer s')
})

test('buildCronRequest maps the weekly cron to cleanup-media', () => {
  const req = buildCronRequest('0 4 * * 1', 'abc')
  assert.ok(req)
  assert.equal(new URL(req.url).pathname, '/api/cron/cleanup-media')
  assert.equal(req.headers.get('authorization'), 'Bearer abc')
})

test('buildCronRequest returns null for an unknown cron string', () => {
  assert.equal(buildCronRequest('* * * * *', 's'), null)
  assert.equal(buildCronRequest('', 's'), null)
  assert.equal(buildCronRequest('constructor', 's'), null)
})

test('buildCronRequest returns null for a missing, empty or blank secret', () => {
  assert.equal(buildCronRequest('0 1 * * *', ''), null)
  assert.equal(buildCronRequest('0 1 * * *', '   '), null)
  assert.equal(buildCronRequest('0 1 * * *', undefined), null)
  assert.equal(buildCronRequest('0 1 * * *', null), null)
})

test('buildCronRequest trims the secret like cronAuthOk does', () => {
  const req = buildCronRequest('0 1 * * *', '  s\n')
  assert.equal(req?.headers.get('authorization'), 'Bearer s')
})

test('CRON_EXPRESSIONS_FOR_PHASE_3 lists exactly the two mapped crons', () => {
  assert.deepEqual([...CRON_EXPRESSIONS_FOR_PHASE_3].sort(), ['0 1 * * *', '0 4 * * 1'])
  for (const cron of CRON_EXPRESSIONS_FOR_PHASE_3) {
    assert.ok(buildCronRequest(cron, 's'), cron)
  }
})

test('supabaseCleanupEnabled is false on the Worker by default', () => {
  assert.equal(supabaseCleanupEnabled({ CLICKIT_RUNTIME: 'workers' }), false)
})

test('supabaseCleanupEnabled is true on the Worker only with the explicit flag "on"', () => {
  assert.equal(
    supabaseCleanupEnabled({ CLICKIT_RUNTIME: 'workers', CLEANUP_SUPABASE_ORIGINALS: 'on' }),
    true,
  )
  for (const v of ['ON', 'true', '1', 'yes', '', ' on']) {
    assert.equal(
      supabaseCleanupEnabled({ CLICKIT_RUNTIME: 'workers', CLEANUP_SUPABASE_ORIGINALS: v }),
      false,
      v,
    )
  }
})

test('supabaseCleanupEnabled is false when no runtime is declared (fail closed)', () => {
  assert.equal(supabaseCleanupEnabled({}), false)
  assert.equal(supabaseCleanupEnabled({ CLICKIT_RUNTIME: '' }), false)
})

test('supabaseCleanupEnabled keeps today behaviour (true) on an explicit node runtime only', () => {
  assert.equal(supabaseCleanupEnabled({ VERCEL: '1' }), false)
  assert.equal(supabaseCleanupEnabled({ CLICKIT_RUNTIME: 'node' }), true)
})

test('supabaseCleanupEnabled ignores VERCEL=1 on the workers runtime', () => {
  assert.equal(supabaseCleanupEnabled({ CLICKIT_RUNTIME: 'workers', VERCEL: '1' }), false)
})
