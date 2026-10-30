// npm run seed:local-admin [-- --second-factor]
//
// LOCAL STACK ONLY. Creates (or resets) the local UAT admin with a verified
// TOTP factor, for local UAT and the e2e admin specs (Phase 6 contract items 4
// and 8). Replaces Phase 6's /Users/koss/.clickit-checks/phase06-uat-admin.cjs.
//
// What it does, in order:
//   1. Reads API_URL, ANON_KEY, SERVICE_ROLE_KEY from `supabase status -o env`
//      (the local stack of this repo) and refuses any non-local URL.
//   2. Applies M2 to the local stack only: the file from resolveM2Source()
//      (supabase/migrations/*_phase5_m2_admin_aal2.sql once PR 2 has landed,
//      else supabase/pending/m2_admin_aal2.sql), through `docker exec` into
//      supabase_db_Clickit (never a URL). M2 is idempotent (create or replace,
//      drop policy if exists + create policy). A landed migration is also
//      recorded in supabase_migrations.schema_migrations so `migration up`
//      does not run it again.
//      Choice: local M2 instead of pointing app_config.admin_user_id at the
//      seed user, so local behaves like live after M2: local admin pages need
//      an admins row AND a TOTP-verified (aal2) session, exactly like live
//      after 05-37.
//   3. Finds or creates uat-admin@clickit.local (email confirmed, new random
//      password each run), removes its old factors (local only), enrols and
//      verifies a TOTP factor, upserts its public.admins row ('UAT Admin') and
//      completes its profile.
//      The seeded admin is the local seed only, never the live test account in
//      live app_config.admin_user_id (D-16). M1 leaves admins empty, so this
//      script is the only local writer of an admins row.
//   4. Ensures one archived show 'UAT Archived Show' (slug uat-archived-show).
//   5. Self-check: a password-only (aal1) session must read 0 rows of that
//      show through RLS, a password + TOTP (aal2) session must read 1 row.
//   6. Writes ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOTP_SECRET (and
//      ADMIN_TOTP_SECRET_2 with --second-factor) to
//      /Users/koss/.clickit-checks/local-admin.env (mode 600, outside the
//      repo). stdout carries only the M2 source path, 'local M2 applied' and
//      the env file path; never a password, secret or code.
//
// Phase 6 and later UAT use this seed instead of phase06-uat-admin.cjs; after
// sign-in the admin enters the TOTP code (scripts/lib/totp.mjs) at /auth/mfa.
import { execFileSync } from 'node:child_process'
import { randomBytes, randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
  LOCAL_DB_CONTAINER,
  assertLocalSupabaseUrl,
  localDbExecArgs,
  migrationVersionOf,
  resolveM2Source,
  runSupabaseCli,
  writePrivateEnvFile,
} from './lib/local-only.mjs'
import { totp } from './lib/totp.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = '/Users/koss/.clickit-checks/local-admin.env'
const ADMIN_EMAIL = 'uat-admin@clickit.local'
const ADMIN_NAME = 'UAT Admin'
const UAT_SHOW = { slug: 'uat-archived-show', title: 'UAT Archived Show' }

function fail(message) {
  console.error(message)
  process.exit(1)
}

function check(result, what) {
  if (result.error) fail(`${what} failed: ${result.error.message}`)
  return result.data
}

function readLocalStatus() {
  let raw
  try {
    raw = runSupabaseCli(['status', '-o', 'env'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    fail('supabase status failed: is the local stack running?')
  }
  const env = {}
  for (const line of raw.split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (!m) continue
    env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  for (const k of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
    if (!env[k]) fail(`supabase status did not return ${k}`)
  }
  return env
}

function randomPassword() {
  // 20 chars: letters and digits, at least one of each class.
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789']
  const all = sets.join('')
  const chars = sets.map((s) => s[randomInt(s.length)])
  while (chars.length < 20) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

function applyLocalM2() {
  let source
  try {
    source = resolveM2Source(REPO_ROOT)
  } catch (e) {
    fail(e.message)
  }
  console.log(`local M2 source: ${path.relative(REPO_ROOT, source)}`)
  try {
    execFileSync('docker', localDbExecArgs(source), {
      input: readFileSync(source),
      stdio: ['pipe', 'ignore', 'pipe'],
    })
    const mig = migrationVersionOf(source)
    if (mig) {
      execFileSync(
        'docker',
        ['exec', '-i', LOCAL_DB_CONTAINER, 'psql', '-q', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres',
          '-v', `ver=${mig.version}`, '-v', `nm=${mig.name}`],
        {
          input: "insert into supabase_migrations.schema_migrations (version, name) values (:'ver', :'nm') on conflict do nothing;\n",
          stdio: ['pipe', 'ignore', 'pipe'],
        },
      )
    }
  } catch (e) {
    const detail = e.stderr ? String(e.stderr).trim().split('\n').slice(-3).join(' | ') : e.message
    fail(`local M2 apply failed: ${detail}`)
  }
  console.log('local M2 applied')
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page < 100; page++) {
    const data = check(await admin.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers')
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function signIn(url, anonKey, password) {
  const c = createClient(url, anonKey, clientOpts)
  check(await c.auth.signInWithPassword({ email: ADMIN_EMAIL, password }), 'password sign-in')
  return c
}

// GoTrue may refuse a TOTP code already used in the same 30 s step; wait for
// a fresh step when this factor was verified in the current one.
const lastStepUsed = new Map()
async function verifyTotp(client, factorId, secret) {
  const step = () => Math.floor(Date.now() / 30000)
  while (lastStepUsed.get(factorId) === step()) {
    await new Promise((r) => setTimeout(r, 1000))
  }
  const ch = check(await client.auth.mfa.challenge({ factorId }), 'mfa challenge')
  lastStepUsed.set(factorId, step())
  check(await client.auth.mfa.verify({ factorId, challengeId: ch.id, code: totp(secret) }), 'mfa verify')
}

async function enrolTotp(client) {
  const tag = randomBytes(2).toString('hex')
  const data = check(await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `UAT ${tag}` }), 'mfa enroll')
  await verifyTotp(client, data.id, data.totp.secret)
  return { id: data.id, secret: data.totp.secret }
}

async function countUatShow(client) {
  const data = check(await client.from('shows').select('id').eq('slug', UAT_SHOW.slug), 'select shows')
  return data.length
}

async function main() {
  const secondFactor = process.argv.includes('--second-factor')
  const env = readLocalStatus()
  let url
  try {
    url = assertLocalSupabaseUrl(env.API_URL)
  } catch (e) {
    fail(e.message)
  }

  applyLocalM2()

  const admin = createClient(url, env.SERVICE_ROLE_KEY, clientOpts)
  const password = randomPassword()

  let user = await findUserByEmail(admin, ADMIN_EMAIL)
  if (user) {
    check(await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true }), 'updateUser')
  } else {
    const data = check(
      await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { locale: 'en' },
      }),
      'createUser',
    )
    user = data.user
  }

  // Old factors go first (local only), so the env file always matches.
  const factors = check(await admin.auth.admin.mfa.listFactors({ userId: user.id }), 'listFactors')
  for (const f of factors.factors ?? []) {
    check(await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id }), 'deleteFactor')
  }

  const session = await signIn(url, env.ANON_KEY, password)
  const f1 = await enrolTotp(session)
  const f2 = secondFactor ? await enrolTotp(session) : null

  check(
    await admin.from('admins').upsert({ user_id: user.id, display_name: ADMIN_NAME }, { onConflict: 'user_id' }),
    'admins upsert',
  )

  const profile = check(
    await admin.from('profiles').select('id, display_name, onboarded_at').eq('id', user.id).maybeSingle(),
    'profile read',
  )
  const now = new Date().toISOString()
  if (!profile) {
    check(
      await admin.from('profiles').insert({ id: user.id, display_name: ADMIN_NAME, onboarded_at: now, locale: 'en' }),
      'profile insert',
    )
  } else if (!profile.display_name || !profile.onboarded_at) {
    check(
      await admin
        .from('profiles')
        .update({ display_name: profile.display_name || ADMIN_NAME, onboarded_at: profile.onboarded_at || now })
        .eq('id', user.id),
      'profile update',
    )
  }

  check(
    await admin.from('shows').upsert(
      {
        slug: UAT_SHOW.slug,
        title: UAT_SHOW.title,
        genre: 'UAT',
        description: '',
        status: 'draft',
        archived: true,
      },
      { onConflict: 'slug' },
    ),
    'archived show upsert',
  )

  // Self-check through RLS: aal1 sees 0 rows, aal2 sees 1 row.
  const aal1 = await signIn(url, env.ANON_KEY, password)
  const aal1Rows = await countUatShow(aal1)
  const aal2 = await signIn(url, env.ANON_KEY, password)
  await verifyTotp(aal2, f1.id, f1.secret)
  const aal2Rows = await countUatShow(aal2)
  if (aal1Rows !== 0 || aal2Rows !== 1) {
    fail(`local admin RLS check failed (aal1 ${aal1Rows} rows, aal2 ${aal2Rows} rows)`)
  }

  const values = { ADMIN_EMAIL, ADMIN_PASSWORD: password, ADMIN_TOTP_SECRET: f1.secret }
  if (f2) values.ADMIN_TOTP_SECRET_2 = f2.secret
  writePrivateEnvFile(ENV_FILE, values)
  console.log(`local admin ready: ${ENV_FILE}`)
}

main().catch((e) => fail(`seed:local-admin failed: ${e?.message ?? e}`))
