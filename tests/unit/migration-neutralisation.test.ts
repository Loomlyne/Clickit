import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  PHASE1_NEUTRALISATION,
  scanSql,
} from '../../scripts/migration-guard.mjs'

function abs(rel: string): string {
  return fileURLToPath(new URL(`../../${rel}`, import.meta.url))
}

function read(rel: string): string {
  return readFileSync(abs(rel), 'utf8')
}

const PATHS = Object.keys(PHASE1_NEUTRALISATION)

test('the allow-list holds exactly the five neutralised migrations', () => {
  assert.equal(PATHS.length, 5)
})

for (const path of PATHS) {
  test(`neutralised ${path} scans clean`, () => {
    const result = scanSql(read(path))
    assert.deepEqual(result.findings, [])
  })

  test(`blob of ${path} equals the allow-list "to" entry`, () => {
    const entry = PHASE1_NEUTRALISATION[path as keyof typeof PHASE1_NEUTRALISATION]
    assert.match(String(entry.to), /^[0-9a-f]{40}$/)
    assert.notEqual(entry.to, entry.from)
    const blob = execFileSync('git', ['hash-object', abs(path)], {
      encoding: 'utf8',
    }).trim()
    assert.equal(blob, entry.to)
  })
}

test('seed.sql guards first, holds 15 shows and no Mon-Fri string', () => {
  const sql = read('supabase/seed.sql')
  const refusal = sql.indexOf('seed.sql refuses to run')
  const firstInsert = sql.indexOf('INSERT INTO')
  assert.ok(refusal > -1)
  assert.ok(firstInsert > refusal)
  assert.equal((sql.match(/INSERT INTO public\.shows/g) ?? []).length, 15)
  assert.ok(!sql.includes("'Mon-Fri'"))
})

test('config.toml enables the local seed from seed.sql', () => {
  const toml = read('supabase/config.toml')
  const section = toml.split(/^\[db\.seed\]$/m)[1]?.split(/^\[/m)[0] ?? ''
  assert.match(section, /^enabled = true$/m)
  assert.ok(section.includes('sql_paths = ["./seed.sql"]'))
})

test('the seed migration keeps app_config and no fake shows', () => {
  const sql = read('supabase/migrations/20260401000003_seed_data.sql')
  assert.ok(sql.includes('ON CONFLICT (id) DO NOTHING'))
  assert.ok(!/insert into public\.shows/i.test(sql))
})
