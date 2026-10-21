import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseJsonc } from '../../scripts/cf/deploy-guard.mjs'
import { CRON_ROUTES } from '../../src/server/cron-schedule.ts'
import { CRON_EXPRESSIONS_FOR_PHASE_3 } from '../../src/server/scheduled.ts'

// Drift guard (03-01): env.production in wrangler.jsonc must mirror the top
// level (the workers.dev target) for every non-inheritable key, because
// wrangler does not inherit those into an environment.

type Json = Record<string, unknown>
const raw = readFileSync('wrangler.jsonc', 'utf8')
const top = parseJsonc(raw) as Json
const env = ((top.env as Json | undefined)?.production ?? {}) as Json

const ZONE_ID = 'd8fa01b24f24653a29a0a56431072dc2'
const NON_INHERITABLE = [
  'r2_buckets',
  'd1_databases',
  'durable_objects',
  'services',
  'kv_namespaces',
  'queues',
  'analytics_engine_datasets',
  'hyperdrive',
  'vectorize',
  'ai',
  'browser',
  'send_email',
  'dispatch_namespaces',
  'mtls_certificates',
]

test('env.production exists and keeps the same Worker name as the top level', () => {
  assert.ok(top.env && (top.env as Json).production, 'env.production declared')
  assert.equal(top.name, 'clickit')
  assert.equal(env.name, 'clickit')
})

test('env.production routes: one www route by zone_id', () => {
  assert.deepEqual(env.routes, [{ pattern: 'www.clickitstory.ae/*', zone_id: ZONE_ID }])
})

test('env.production crons equal CRON_EXPRESSIONS_FOR_PHASE_3; the top level stays empty', () => {
  const crons = (env.triggers as { crons: string[] } | undefined)?.crons
  assert.ok(Array.isArray(crons))
  assert.deepEqual([...crons].sort(), [...CRON_EXPRESSIONS_FOR_PHASE_3].sort())
  assert.deepEqual([...crons].sort(), ['0 1 * * *', '0 4 * * 1', '30 1 * * *'])
  for (const c of crons) assert.ok(Object.hasOwn(CRON_ROUTES, c), `${c} is a CRON_ROUTES key`)
  assert.deepEqual((top.triggers as { crons: string[] }).crons, [])
})

test('R2_UPLOAD_SWEEP_DELETE matches the top level and is off or on; ai binding copied', () => {
  const topVars = top.vars as Record<string, string>
  const envVars = env.vars as Record<string, string>
  assert.equal(envVars.R2_UPLOAD_SWEEP_DELETE, topVars.R2_UPLOAD_SWEEP_DELETE)
  assert.ok(['off', 'on'].includes(envVars.R2_UPLOAD_SWEEP_DELETE))
  assert.deepEqual(env.ai, top.ai)
  assert.ok(top.ai, 'top level has the ai binding')
})

test('every non-inheritable key present at the top level is copied unchanged', () => {
  let checked = 0
  for (const key of NON_INHERITABLE) {
    if (top[key] === undefined) continue
    checked += 1
    assert.deepEqual(env[key], top[key], `${key} matches the top level`)
  }
  assert.ok(checked >= 5, 'at least services, r2, d1, durable objects and ai are compared')
})

test('vars equal the top-level vars plus exactly RESEND_FROM_EMAIL', () => {
  const topVars = top.vars as Record<string, string>
  const envVars = env.vars as Record<string, string>
  assert.deepEqual(envVars, {
    ...topVars,
    RESEND_FROM_EMAIL: 'Clickit Story <no-reply@clickitstory.ae>',
  })
  assert.deepEqual(Object.keys(envVars).filter((k) => !(k in topVars)), ['RESEND_FROM_EMAIL'])
})

test('workers_dev kept, previews off, no LOCAL_DEV or CLEANUP_SUPABASE_ORIGINALS', () => {
  assert.equal(env.workers_dev, true)
  assert.equal(env.preview_urls, false)
  const envVars = env.vars as Record<string, string>
  assert.equal('LOCAL_DEV' in envVars, false)
  assert.equal('CLEANUP_SUPABASE_ORIGINALS' in envVars, false)
})

test('no all-zero d1 database_id', () => {
  const dbs = (env.d1_databases ?? []) as Array<{ database_id: string }>
  assert.ok(dbs.length > 0)
  for (const db of dbs) assert.doesNotMatch(db.database_id, /^[0-]+$/)
})
