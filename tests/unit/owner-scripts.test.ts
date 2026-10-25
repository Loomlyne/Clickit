import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  EXPECTED_AUTH,
  TEMPLATE_NAMES,
  compareAuthConfig,
  loadRepoTemplates,
  sha256,
} from '../../scripts/auth-config-check.mjs'
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

// ---------------------------------------------------------------------------
// auth-config-check: compareAuthConfig (pure; no network)
// ---------------------------------------------------------------------------


function liveFixture(templates: { subjects: Record<string, string>; contents: Record<string, string> }) {
  const live: Record<string, unknown> = { ...EXPECTED_AUTH }
  for (const k of Object.keys(live)) {
    if (live[k] === '(set)') live[k] = 're_live_secret_value_never_printed'
  }
  for (const name of TEMPLATE_NAMES) {
    live[`mailer_subjects_${name}`] = templates.subjects[name]
    live[`mailer_templates_${name}_content`] = templates.contents[name]
  }
  live.password_hibp_enabled = false
  return live
}

const repoTemplates = loadRepoTemplates(REPO)

function rowsOf(live: Record<string, unknown>, opts?: { expectHibp?: 'on' | 'off' }) {
  return compareAuthConfig(live, EXPECTED_AUTH, repoTemplates, opts) as Array<{
    key: string
    ok: boolean
    live: unknown
    expected: unknown
    info?: boolean
  }>
}

test('EXPECTED_AUTH holds the signed values (G5 OTP 900, G18 A rate limits, SMTP, TOTP, CAPTCHA)', () => {
  assert.equal(EXPECTED_AUTH.mailer_otp_exp, 900)
  assert.equal(EXPECTED_AUTH.mailer_autoconfirm, false)
  assert.equal(EXPECTED_AUTH.mailer_secure_email_change_enabled, true)
  assert.equal(EXPECTED_AUTH.smtp_host, 'smtp.resend.com')
  assert.equal(String(EXPECTED_AUTH.smtp_port), '465')
  assert.equal(EXPECTED_AUTH.smtp_sender_name, 'Clickit Story')
  assert.equal(EXPECTED_AUTH.smtp_admin_email, 'no-reply@clickitstory.ae')
  assert.equal(EXPECTED_AUTH.password_min_length, 8)
  assert.equal(EXPECTED_AUTH.mfa_totp_enroll_enabled, true)
  assert.equal(EXPECTED_AUTH.mfa_totp_verify_enabled, true)
  assert.equal(EXPECTED_AUTH.security_captcha_enabled, true)
  assert.equal(EXPECTED_AUTH.site_url, 'https://www.clickitstory.ae')
  assert.equal(EXPECTED_AUTH.rate_limit_email_sent, 200)
  assert.equal(EXPECTED_AUTH.rate_limit_otp, 150)
  assert.equal(EXPECTED_AUTH.rate_limit_verify, 150)
  assert.deepEqual([...TEMPLATE_NAMES].sort(), ['confirmation', 'email_change', 'magic_link', 'reauthentication', 'recovery'])
})

test('a live config equal to the repo gives all rows ok and never prints a secret', () => {
  const rows = rowsOf(liveFixture(repoTemplates))
  const bad = rows.filter((r) => !r.ok)
  assert.deepEqual(bad, [])
  // five templates + five subjects compared
  assert.equal(rows.filter((r) => r.key.startsWith('mailer_templates_')).length, 5)
  assert.equal(rows.filter((r) => r.key.startsWith('mailer_subjects_')).length, 5)
  const text = JSON.stringify(rows)
  assert.doesNotMatch(text, /re_live_secret_value_never_printed/)
  const pass = rows.find((r) => r.key === 'smtp_pass')
  assert.equal(pass?.live, '(set)')
  // template rows carry hashes, not content
  const tpl = rows.find((r) => r.key === 'mailer_templates_confirmation_content')
  assert.match(String(tpl?.live), /^[0-9a-f]{12}$/)
  assert.doesNotMatch(text, /<html/)
})

test('a missing secret shows (missing) and is not ok', () => {
  const live = liveFixture(repoTemplates)
  live.smtp_pass = null
  const row = rowsOf(live).find((r) => r.key === 'smtp_pass')
  assert.equal(row?.ok, false)
  assert.equal(row?.live, '(missing)')
})

test('OTP expiry 3600 makes the otp row not ok', () => {
  const live = liveFixture(repoTemplates)
  live.mailer_otp_exp = 3600
  const rows = rowsOf(live)
  const row = rows.find((r) => r.key === 'mailer_otp_exp')
  assert.equal(row?.ok, false)
  assert.equal(row?.live, 3600)
  assert.equal(rows.filter((r) => !r.ok).length, 1)
})

test('smtp_port compares as text (the API returns a string)', () => {
  const live = liveFixture(repoTemplates)
  live.smtp_port = '465'
  assert.ok(rowsOf(live).find((r) => r.key === 'smtp_port')?.ok)
  live.smtp_port = '587'
  assert.equal(rowsOf(live).find((r) => r.key === 'smtp_port')?.ok, false)
})

test('leaked-password flag: info row without --expect-hibp, compared with it', () => {
  const live = liveFixture(repoTemplates)
  live.password_hibp_enabled = false
  const info = rowsOf(live).find((r) => r.key === 'password_hibp_enabled')
  assert.equal(info?.ok, true)
  assert.equal(info?.info, true)
  assert.equal(rowsOf(live, { expectHibp: 'on' }).find((r) => r.key === 'password_hibp_enabled')?.ok, false)
  assert.equal(rowsOf(live, { expectHibp: 'off' }).find((r) => r.key === 'password_hibp_enabled')?.ok, true)
  live.password_hibp_enabled = true
  assert.equal(rowsOf(live, { expectHibp: 'on' }).find((r) => r.key === 'password_hibp_enabled')?.ok, true)
})

test('one changed character in a template makes only that template row not ok (SHA-256)', () => {
  const live = liveFixture(repoTemplates)
  const orig = String(live.mailer_templates_recovery_content)
  live.mailer_templates_recovery_content = orig.slice(0, -1) + (orig.endsWith('x') ? 'y' : 'x')
  const rows = rowsOf(live)
  const bad = rows.filter((r) => !r.ok)
  assert.deepEqual(
    bad.map((r) => r.key),
    ['mailer_templates_recovery_content'],
  )
  assert.equal(bad[0].expected, sha256(orig).slice(0, 12))
})

test('a changed subject makes that subject row not ok', () => {
  const live = liveFixture(repoTemplates)
  live.mailer_subjects_magic_link = 'Your code'
  const bad = rowsOf(live).filter((r) => !r.ok)
  assert.deepEqual(
    bad.map((r) => r.key),
    ['mailer_subjects_magic_link'],
  )
})
