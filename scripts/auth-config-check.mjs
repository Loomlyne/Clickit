// node scripts/auth-config-check.mjs [--expect-hibp on|off]
//
// READ-ONLY check that live Supabase Auth (project lajguozmtissnnfccmej)
// matches the repo (D-41, research F13). Run in Koss's terminal with his
// personal access token in the environment:
//   SUPABASE_ACCESS_TOKEN=... node scripts/auth-config-check.mjs
// It sends one GET to the Management API (config/auth) and never writes:
// `supabase config push` would overwrite live and is never used.
//
// Compared: OTP expiry (G5), confirm email (autoconfirm off), secure email
// change, SMTP host/port/sender/admin address and password presence, minimum
// password length, TOTP enrol/verify, rate limits (G18 A), CAPTCHA, site URL,
// and the five templates and subjects against supabase/templates (production
// set, not supabase/templates/local). Templates are compared by SHA-256 and
// only short hashes are printed. Secrets are printed as (set)/(missing).
// The leaked-password flag is an info row unless --expect-hibp on|off is given
// (05-35 step 1: Free -> leave the flag out, Pro -> --expect-hibp on).
// Exit 0 when every row matches, 1 on any mismatch, 2 on usage/network errors.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT_REF = 'lajguozmtissnnfccmej'
export const TEMPLATE_NAMES = ['confirmation', 'magic_link', 'recovery', 'email_change', 'reauthentication']

// '(set)' = a secret that must be present; its value is never compared or printed.
export const EXPECTED_AUTH = {
  mailer_otp_exp: 900, // G5: 15 minutes
  mailer_autoconfirm: false, // Confirm email on
  mailer_secure_email_change_enabled: true,
  smtp_host: 'smtp.resend.com',
  smtp_port: '465',
  smtp_user: 'resend',
  smtp_pass: '(set)',
  smtp_admin_email: 'no-reply@clickitstory.ae',
  smtp_sender_name: 'Clickit Story',
  password_min_length: 8,
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
  rate_limit_email_sent: 200, // G18 A: emails per hour
  rate_limit_otp: 150, // G18 A: code requests and sign-ins per 5 min
  rate_limit_verify: 150, // G18 A: code checks per 5 min
  security_captcha_enabled: true,
  security_captcha_provider: 'turnstile', // D-37
  security_captcha_secret: '(set)',
  site_url: 'https://www.clickitstory.ae',
}

const SECRET_KEY_RE = /(_pass|_key|_secret|_secrets|_token)$/

export function sha256(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex')
}

function isSecretKey(key) {
  return SECRET_KEY_RE.test(key)
}

function present(v) {
  return v !== null && v !== undefined && String(v) !== ''
}

function same(live, expected) {
  if (typeof expected === 'number') return Number(live) === expected && present(live)
  if (typeof expected === 'boolean') return live === expected
  return String(live ?? '') === String(expected)
}

export function loadRepoTemplates(repoRoot) {
  const dir = path.join(repoRoot, 'supabase', 'templates')
  const subjects = JSON.parse(readFileSync(path.join(dir, 'subjects.json'), 'utf8'))
  const contents = {}
  for (const name of TEMPLATE_NAMES) contents[name] = readFileSync(path.join(dir, `${name}.html`), 'utf8')
  return { subjects, contents }
}

/**
 * Pure. Returns rows { key, ok, live, expected, info? }. Secret values are
 * shown as '(set)'/'(missing)', templates as the first 12 hex chars of SHA-256.
 */
export function compareAuthConfig(live, expected, templates, { expectHibp } = {}) {
  const rows = []
  for (const [key, want] of Object.entries(expected)) {
    const got = live?.[key]
    if (want === '(set)' || isSecretKey(key)) {
      const shown = present(got) ? '(set)' : '(missing)'
      rows.push({ key, ok: want === '(set)' ? shown === '(set)' : same(got, want), live: shown, expected: want === '(set)' ? '(set)' : '(hidden)' })
      continue
    }
    rows.push({ key, ok: same(got, want), live: got ?? null, expected: want })
  }

  const hibp = live?.password_hibp_enabled ?? null
  if (expectHibp === 'on' || expectHibp === 'off') {
    rows.push({ key: 'password_hibp_enabled', ok: hibp === (expectHibp === 'on'), live: hibp, expected: expectHibp === 'on' })
  } else {
    rows.push({ key: 'password_hibp_enabled', ok: true, info: true, live: hibp, expected: '(info: pass --expect-hibp on|off)' })
  }

  for (const name of TEMPLATE_NAMES) {
    const sKey = `mailer_subjects_${name}`
    const wantS = templates.subjects[name]
    const gotS = live?.[sKey]
    rows.push({ key: sKey, ok: present(wantS) && gotS === wantS, live: present(gotS) ? sha256(gotS).slice(0, 12) : '(missing)', expected: sha256(wantS).slice(0, 12) })

    const cKey = `mailer_templates_${name}_content`
    const wantC = templates.contents[name]
    const gotC = live?.[cKey]
    const wantH = sha256(wantC).slice(0, 12)
    const gotH = present(gotC) ? sha256(gotC).slice(0, 12) : '(missing)'
    rows.push({ key: cKey, ok: present(gotC) && sha256(gotC) === sha256(wantC), live: gotH, expected: wantH })
  }
  return rows
}

function printTable(rows) {
  const w = Math.max(...rows.map((r) => r.key.length))
  for (const r of rows) {
    const mark = r.info ? 'INFO' : r.ok ? 'ok  ' : 'DIFF'
    console.log(`${mark}  ${r.key.padEnd(w)}  live=${JSON.stringify(r.live)}  expected=${JSON.stringify(r.expected)}`)
  }
}

function parseArgs(argv) {
  const i = argv.indexOf('--expect-hibp')
  if (i === -1) return {}
  const v = argv[i + 1]
  if (v !== 'on' && v !== 'off') {
    console.error('usage: --expect-hibp on|off')
    process.exit(2)
  }
  return { expectHibp: v }
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    console.error('refusing: set SUPABASE_ACCESS_TOKEN in your terminal environment (personal access token; never in a file)')
    process.exit(2)
  }
  const opts = parseArgs(process.argv.slice(2))
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const templates = loadRepoTemplates(repoRoot)

  let res
  try {
    res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
  } catch (e) {
    console.error(`request failed: ${e?.message ?? e}`)
    process.exit(2)
  }
  if (!res.ok) {
    console.error(`Management API returned HTTP ${res.status} (check the token and project access)`)
    process.exit(2)
  }
  const live = await res.json()
  const rows = compareAuthConfig(live, EXPECTED_AUTH, templates, opts)
  printTable(rows)
  const diffs = rows.filter((r) => !r.ok).length
  console.log(diffs === 0 ? 'auth config matches the repo' : `auth config mismatches: ${diffs}`)
  process.exit(diffs === 0 ? 0 : 1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
