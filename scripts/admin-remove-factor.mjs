// node scripts/admin-remove-factor.mjs <email>
//
// Owner-only lost-phone procedure (D-20). Run in Koss's terminal with the
// service-role key in the environment, never from a file:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/admin-remove-factor.mjs someone@example.com
//
// It finds the user by exact (lowercase) email, lists the MFA factors
// (friendly name, type, status, created date), asks Koss to type the email
// again, then deletes every factor with auth.admin.mfa.deleteFactor and writes
// one public.admin_audit_log row (action_type mfa_unenrol, by: owner script).
//
// Effects (research F4): deleting a verified factor signs the admin out
// everywhere; the next admin sign-in shows the enrol page (/auth/mfa enrol)
// before any admin page opens. Prints counts only; never a key or secret.
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

import { createClient } from '@supabase/supabase-js'

function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page < 1000; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`listUsers failed: ${error.message}`)
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    fail('refusing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your terminal environment (never in a file)', 2)
  }
  const email = String(process.argv[2] ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) fail('usage: node scripts/admin-remove-factor.mjs <email>', 2)

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const user = await findUserByEmail(admin, email)
  if (!user) fail('no user with that email')

  const { data: fdata, error: ferr } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
  if (ferr) fail(`listFactors failed: ${ferr.message}`)
  const factors = fdata?.factors ?? []
  if (factors.length === 0) {
    console.log('no factors to delete')
    return
  }
  console.log(`factors for ${email}: ${factors.length}`)
  for (const f of factors) {
    console.log(`  - ${f.friendly_name ?? '(no name)'}  type=${f.factor_type}  status=${f.status}  created=${f.created_at}`)
  }

  const rl = createInterface({ input: stdin, output: stdout })
  const typed = (await rl.question('Type the email again to delete these factors: ')).trim().toLowerCase()
  rl.close()
  if (typed !== email) fail('email did not match; nothing deleted')

  let deleted = 0
  let failed = 0
  for (const f of factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
    if (error) {
      failed++
      console.error(`delete failed for one factor: ${error.message}`)
    } else {
      deleted++
    }
  }
  console.log(`deleted ${deleted} of ${factors.length} factors${failed ? `, ${failed} failed` : ''}`)

  // admin_user_id is NOT NULL and there is no separate actor column: it holds
  // the affected admin; diff.by marks the owner script as the one who acted.
  const { error: aerr } = await admin.from('admin_audit_log').insert({
    admin_user_id: user.id,
    action_type: 'mfa_unenrol',
    entity_type: 'admin_auth',
    entity_id: user.id,
    diff: { count: deleted, by: 'owner script' },
  })
  if (aerr) fail(`factors deleted, but the audit row is missing: ${aerr.message}`)
  console.log('audit row written: 1')
  if (failed) process.exit(1)
}

main().catch((e) => fail(`admin-remove-factor failed: ${e?.message ?? e}`))
