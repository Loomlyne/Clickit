// PLAT-03 check: an edit becomes visible on the page within 10 seconds.
//
// Two modes.
//
// REST mode (local Supabase only):
//   SUPABASE_SERVICE_ROLE_KEY=<local key> node scripts/cf/check-revalidate.mjs \
//       --base http://127.0.0.1:8787 --supabase-url http://127.0.0.1:55321 [--cookie-file <path>]
//   Creates a probe show (slug cf-revalidate-probe) in the LOCAL database, changes its title
//   through the REST API, polls <base>/en/series/cf-revalidate-probe every second for up to
//   10 s, prints PASS with the elapsed ms when the new title appears, FAIL otherwise, and
//   deletes the probe show. A REST edit does not call revalidatePath, so this mode proves
//   the cache lifetime of the page, not the admin action.
//   Refuses any --supabase-url other than http://127.0.0.1:55321 (never live).
//   The service role key is read from SUPABASE_SERVICE_ROLE_KEY and never printed.
//
// --via-admin-action mode (read-only GET polling, writes nothing):
//   node scripts/cf/check-revalidate.mjs --via-admin-action --base <url> \
//       --expect <string> [--path </en/series/slug>] [--cookie-file <path>]
//   The operator edits in the admin UI; the script polls --path (default the probe show
//   page) until the page body contains --expect, up to 10 s. --cookie-file holds one line,
//   the Cookie header value, sent but never printed. Safe against workers.dev.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:55321'
export const PROBE_SLUG = 'cf-revalidate-probe'
export const DEADLINE_MS = 10_000

export const USAGE = `check-revalidate: edit visible within 10 s (PLAT-03)
REST mode (local Supabase only):
  SUPABASE_SERVICE_ROLE_KEY=<local key> node scripts/cf/check-revalidate.mjs \\
      --base <url> --supabase-url ${LOCAL_SUPABASE_URL} [--cookie-file <path>]
  Creates and edits a probe show (${PROBE_SLUG}) in the local database, polls the page, deletes it.
--via-admin-action mode (GET only, writes nothing, ok against workers.dev):
  node scripts/cf/check-revalidate.mjs --via-admin-action --base <url> --expect <string> \\
      [--path </en/series/${PROBE_SLUG}>] [--cookie-file <path>]
  You edit in the admin UI; the script polls --path until the page contains --expect.
Cookie files hold one line, the Cookie header value; never printed.`

export function parseArgs(argv) {
  const out = { base: null, supabaseUrl: null, viaAdminAction: false, path: null, expect: null, cookieFile: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--base') out.base = next()
    else if (a === '--supabase-url') out.supabaseUrl = next()
    else if (a === '--via-admin-action') out.viaAdminAction = true
    else if (a === '--path') out.path = next()
    else if (a === '--expect') out.expect = next()
    else if (a === '--cookie-file') out.cookieFile = next()
    else throw new Error(`unknown argument ${a}`)
  }
  return out
}

/** True only for the exact local stack URL (a trailing slash is tolerated). */
export function isLocalSupabaseUrl(raw) {
  return typeof raw === 'string' && raw.replace(/\/+$/, '') === LOCAL_SUPABASE_URL
}

function baseOrigin(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('--base must be an absolute http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('--base must be http or https')
  return url.origin
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pollFor({ base, path, expect, cookie, now = Date.now, wait = sleep }) {
  const started = now()
  for (;;) {
    let body = ''
    try {
      const res = await fetch(`${base}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} })
      body = res.status === 200 ? await res.text() : (await res.arrayBuffer(), '')
    } catch {
      body = ''
    }
    const elapsed = now() - started
    if (body.includes(expect)) return { ok: true, elapsed }
    if (elapsed >= DEADLINE_MS) return { ok: false, elapsed }
    await wait(1000)
  }
}

function cookieFrom(path) {
  if (!path) return null
  const text = readFileSync(path, 'utf8').trim()
  if (text === '') throw new Error(`cookie file ${path} is empty`)
  return text
}

async function viaAdminAction(opts, log) {
  if (!opts.expect) throw new Error('--via-admin-action needs --expect <string>')
  const base = baseOrigin(opts.base)
  const path = opts.path ?? `/en/series/${PROBE_SLUG}`
  if (!path.startsWith('/')) throw new Error('--path must start with /')
  const result = await pollFor({ base, path, expect: opts.expect, cookie: cookieFrom(opts.cookieFile) })
  log(result.ok ? `PASS expected text visible after ${result.elapsed} ms` : `FAIL expected text not visible within ${DEADLINE_MS} ms`)
  return result.ok ? 0 : 1
}

async function restMode(opts, log) {
  if (!isLocalSupabaseUrl(opts.supabaseUrl)) {
    throw new Error(`refused: --supabase-url must be exactly ${LOCAL_SUPABASE_URL} (local only, never live)`)
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (use the local stack key)')
  const base = baseOrigin(opts.base)
  const cookie = cookieFrom(opts.cookieFile)
  const rest = `${LOCAL_SUPABASE_URL}/rest/v1/shows`
  const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=minimal' }

  const remove = () => fetch(`${rest}?slug=eq.${PROBE_SLUG}`, { method: 'DELETE', headers })
  await remove() // clear a leftover probe from an earlier aborted run
  const created = await fetch(rest, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'probe initial', slug: PROBE_SLUG, genre: 'probe', status: 'now-streaming' }),
  })
  if (!created.ok) throw new Error(`could not create the probe show (HTTP ${created.status})`)
  try {
    const marker = `probe-${Date.now()}`
    const updated = await fetch(`${rest}?slug=eq.${PROBE_SLUG}`, { method: 'PATCH', headers, body: JSON.stringify({ title: marker }) })
    if (!updated.ok) throw new Error(`could not update the probe show (HTTP ${updated.status})`)
    const result = await pollFor({ base, path: `/en/series/${PROBE_SLUG}`, expect: marker, cookie })
    log(result.ok ? `PASS new title visible after ${result.elapsed} ms` : `FAIL new title not visible within ${DEADLINE_MS} ms`)
    return result.ok ? 0 : 1
  } finally {
    await remove().catch(() => undefined)
  }
}

export async function run(opts, log = console.log) {
  if (!opts.base) throw new Error('--base is required')
  return opts.viaAdminAction ? viaAdminAction(opts, log) : restMode(opts, log)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    console.error(USAGE)
    process.exit(2)
  }
  if (opts.help) {
    console.log(USAGE)
    process.exit(0)
  }
  try {
    process.exit(await run(opts))
  } catch (err) {
    console.error(`check-revalidate error: ${err.message}`)
    process.exit(2)
  }
}
