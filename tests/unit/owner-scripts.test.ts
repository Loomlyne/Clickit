import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  assertLocalSupabaseUrl,
  localDbExecArgs,
  migrationVersionOf,
  resolveM2Source,
  writePrivateEnvFile,
} from '../../scripts/lib/local-only.mjs'

const REPO = resolve(import.meta.dirname, '../..')

// ---------------------------------------------------------------------------
// assertLocalSupabaseUrl
// ---------------------------------------------------------------------------

test('assertLocalSupabaseUrl accepts the local stack on 127.0.0.1 and localhost', () => {
  assert.equal(assertLocalSupabaseUrl('http://127.0.0.1:55321'), 'http://127.0.0.1:55321')
  assert.equal(assertLocalSupabaseUrl('http://localhost:55321'), 'http://localhost:55321')
  assert.equal(assertLocalSupabaseUrl('http://127.0.0.1:55321/'), 'http://127.0.0.1:55321')
})

test('assertLocalSupabaseUrl refuses live, any https URL and any other host', () => {
  for (const bad of [
    'https://lajguozmtissnnfccmej.supabase.co',
    'https://127.0.0.1:55321',
    'https://localhost:55321',
    'http://lajguozmtissnnfccmej.supabase.co',
    'http://127.0.0.1.example.com:55321',
    'http://10.0.0.5:55321',
    'http://user@evil.example:55321',
    '',
    undefined,
    'not a url',
  ]) {
    assert.throws(() => assertLocalSupabaseUrl(bad as string), /local/i, String(bad))
  }
})

// ---------------------------------------------------------------------------
// writePrivateEnvFile
// ---------------------------------------------------------------------------

test('writePrivateEnvFile writes KEY=value lines with mode 600', () => {
  const dir = mkdtempSync(join(tmpdir(), 'owner-scripts-'))
  try {
    const file = join(dir, 'a.env')
    writePrivateEnvFile(file, { A: '1' })
    assert.equal(readFileSync(file, 'utf8'), 'A=1\n')
    assert.equal(statSync(file).mode & 0o777, 0o600)
    // overwrite keeps 600
    writePrivateEnvFile(file, { A: '2', B: 'x' })
    assert.equal(readFileSync(file, 'utf8'), 'A=2\nB=x\n')
    assert.equal(statSync(file).mode & 0o777, 0o600)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('writePrivateEnvFile refuses a path inside the repo, a relative path and bad values', () => {
  assert.throws(() => writePrivateEnvFile(join(REPO, 'local-admin.env'), { A: '1' }), /inside the repo/)
  assert.throws(() => writePrivateEnvFile(join(REPO, 'scripts', 'x.env'), { A: '1' }), /inside the repo/)
  assert.throws(() => writePrivateEnvFile('local-admin.env', { A: '1' }), /absolute/)
  const dir = mkdtempSync(join(tmpdir(), 'owner-scripts-'))
  try {
    assert.throws(() => writePrivateEnvFile(join(dir, 'b.env'), { A: 'x\ny' }), /newline/)
    assert.throws(() => writePrivateEnvFile(join(dir, 'b.env'), { 'A B': 'x' }), /key/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// resolveM2Source
// ---------------------------------------------------------------------------

function fakeFs(migrations: string[] | null, pendingExists: boolean) {
  return {
    listDir: (dir: string) => {
      assert.equal(dir, join('/repo', 'supabase', 'migrations'))
      if (migrations === null) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return migrations
    },
    exists: (p: string) => pendingExists && p === join('/repo', 'supabase', 'pending', 'm2_admin_aal2.sql'),
  }
}

test('resolveM2Source prefers the landed migration (newest when several)', () => {
  const got = resolveM2Source(
    '/repo',
    fakeFs(
      [
        '20261021151843_phase5_m1b_email_outbox.sql',
        '20261101000000_phase5_m2_admin_aal2.sql',
        '20261102000000_phase5_m2_admin_aal2.sql',
        '20261103000000_phase5_m3_close_anon_youtube.sql',
      ],
      true,
    ),
  )
  assert.equal(got, join('/repo', 'supabase', 'migrations', '20261102000000_phase5_m2_admin_aal2.sql'))
})

test('resolveM2Source falls back to supabase/pending/m2_admin_aal2.sql', () => {
  const got = resolveM2Source('/repo', fakeFs(['20261021151843_phase5_m1b_email_outbox.sql'], true))
  assert.equal(got, join('/repo', 'supabase', 'pending', 'm2_admin_aal2.sql'))
  // a missing migrations folder is not fatal while the pending file exists
  assert.equal(resolveM2Source('/repo', fakeFs(null, true)), join('/repo', 'supabase', 'pending', 'm2_admin_aal2.sql'))
})

test('resolveM2Source throws the documented message when neither exists', () => {
  assert.throws(
    () => resolveM2Source('/repo', fakeFs(['20261021151843_phase5_m1b_email_outbox.sql'], false)),
    {
      message:
        'M2 source not found: neither supabase/migrations/*_phase5_m2_admin_aal2.sql nor supabase/pending/m2_admin_aal2.sql',
    },
  )
})

test('resolveM2Source on the real repo finds a file that exists', () => {
  const got = resolveM2Source(REPO)
  assert.match(got, /(supabase\/pending\/m2_admin_aal2\.sql|supabase\/migrations\/\d+_phase5_m2_admin_aal2\.sql)$/)
  assert.ok(statSync(got).isFile())
})

// ---------------------------------------------------------------------------
// localDbExecArgs and migrationVersionOf
// ---------------------------------------------------------------------------

test('localDbExecArgs targets supabase_db_Clickit with psql ON_ERROR_STOP as postgres/postgres', () => {
  const args = localDbExecArgs(join('/repo', 'supabase', 'pending', 'm2_admin_aal2.sql'))
  assert.ok(Array.isArray(args))
  assert.deepEqual(args.slice(0, 4), ['exec', '-i', 'supabase_db_Clickit', 'psql'])
  const joined = args.join(' ')
  assert.match(joined, /-v ON_ERROR_STOP=1/)
  assert.match(joined, /-U postgres/)
  assert.match(joined, /-d postgres/)
  assert.ok(args.includes('--single-transaction'))
  // no host flag (docker exec only) and no shell string
  assert.ok(!args.includes('-h') && !args.includes('--host'))
  for (const a of args) {
    assert.equal(typeof a, 'string')
    assert.doesNotMatch(a, /[;&|`$<>]/)
  }
})

test('localDbExecArgs refuses a non-sql or relative path', () => {
  assert.throws(() => localDbExecArgs('/repo/supabase/pending/m2_admin_aal2.txt'), /\.sql/)
  assert.throws(() => localDbExecArgs('supabase/pending/m2_admin_aal2.sql'), /absolute/)
})

test('migrationVersionOf returns version and name for a migration file, null for pending', () => {
  assert.deepEqual(migrationVersionOf('/repo/supabase/migrations/20261102000000_phase5_m2_admin_aal2.sql'), {
    version: '20261102000000',
    name: 'phase5_m2_admin_aal2',
  })
  assert.equal(migrationVersionOf('/repo/supabase/pending/m2_admin_aal2.sql'), null)
})
