import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildCronRequest,
  runCron,
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

// ------------------------------------------- runCron (review item 5: failures reject)

function recorder() {
  const lines: { level: 'log' | 'error'; text: string }[] = []
  return {
    lines,
    log: (...a: unknown[]) => lines.push({ level: 'log', text: a.map(String).join(' ') }),
    error: (...a: unknown[]) => lines.push({ level: 'error', text: a.map(String).join(' ') }),
  }
}

test('runCron resolves and logs the status on an OK response, calling the route in-process', async () => {
  const log = recorder()
  const seen: Request[] = []
  await runCron('0 1 * * *', 'secret-value', async (req) => {
    seen.push(req)
    return new Response(null, { status: 200 })
  }, log)
  assert.equal(seen.length, 1)
  assert.equal(new URL(seen[0].url).pathname, '/api/cron/publish-scheduled')
  assert.equal(seen[0].headers.get('authorization'), 'Bearer secret-value')
  assert.equal(log.lines.length, 1)
  assert.equal(log.lines[0].level, 'log')
  assert.match(log.lines[0].text, /\/api\/cron\/publish-scheduled.*200/)
})

test('runCron rejects on a non-OK response and still logs it', async () => {
  for (const status of [401, 500, 503]) {
    const log = recorder()
    await assert.rejects(
      runCron('0 4 * * 1', 's', async () => new Response(null, { status }), log),
      (err: Error) => err.message.includes(String(status)) && err.message.includes('/api/cron/cleanup-media'),
    )
    assert.equal(log.lines.length, 1)
    assert.equal(log.lines[0].level, 'error')
    assert.match(log.lines[0].text, new RegExp(String(status)))
  }
})

test('runCron rejects when the route throws, logs the message and never the secret', async () => {
  const log = recorder()
  await assert.rejects(
    runCron('0 1 * * *', 'secret-value', async () => {
      throw new Error('boom')
    }, log),
    (err: Error) => err.message.includes('/api/cron/publish-scheduled') && !err.message.includes('secret-value'),
  )
  assert.equal(log.lines.length, 1)
  assert.equal(log.lines[0].level, 'error')
  assert.match(log.lines[0].text, /boom/)
  assert.equal(log.lines.some((l) => l.text.includes('secret-value')), false)
})

test('runCron rejects (without calling anything) for an unknown cron or a missing secret', async () => {
  for (const [cron, secret] of [['* * * * *', 's'], ['0 1 * * *', ''], ['0 1 * * *', undefined]] as const) {
    const log = recorder()
    let called = false
    await assert.rejects(
      runCron(cron, secret, async () => {
        called = true
        return new Response(null)
      }, log),
    )
    assert.equal(called, false)
    assert.equal(log.lines[0]?.level, 'error')
  }
})

test('custom-worker scheduled() awaits runCron so a failure fails the cron invocation', () => {
  const src = readFileSync('custom-worker.ts', 'utf8')
  const body = src.slice(src.indexOf('async scheduled('))
  assert.match(body, /await runCron\(event\.cron, env\.CRON_SECRET, \(request\) => handler\.fetch\(request, env, ctx\)\)/)
  // No fire-and-forget: a waitUntil'd promise would hide the rejection from the cron status.
  assert.equal(/waitUntil/.test(body), false)
  assert.equal(/catch\s*\(/.test(body), false)
})
