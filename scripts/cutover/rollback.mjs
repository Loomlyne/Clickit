// One-switch rollback for the www cutover (Phase 3, plan 03-03, D-04, D-07, D-16).
// Greys the www CNAME (proxied=false) so traffic returns to the frozen Vercel target.
//
// The Cloudflare token (Zone > DNS > Edit on clickitstory.ae only) is read from the macOS
// Keychain at run time and kept in memory: never printed, never written, never taken from argv
// or the environment. Nothing else in the zone is reachable from this tool, and there is no
// command to turn the record orange again (re-flipping is Koss's own step).
//
//   node scripts/cutover/rollback.mjs --verify-token   token is active?
//   node scripts/cutover/rollback.mjs --show           print the www record (no token, no id)
//   node scripts/cutover/rollback.mjs                  dry run: print what would change
//   node scripts/cutover/rollback.mjs --execute        one PATCH { proxied: false }, then read back

import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { KEYCHAIN_SERVICE, WWW_NAME, ZONE_ID, buildRollbackPatch, describeRecord, pickWwwRecord } from './rollback-core.mjs'

export const USAGE = `rollback: grey the www record (proxied=false) so traffic returns to Vercel
  (no flag)        dry run: print what would change, write nothing
  --execute        send one PATCH that sets only proxied=false, then read it back
  --show           print the www record (name, type, target class, proxied)
  --verify-token   check the Keychain credential is active
  --help
The credential is read from the macOS Keychain item "${KEYCHAIN_SERVICE}". It is never accepted
from argv or from CLOUDFLARE_API_TOKEN.`

const API = 'https://api.cloudflare.com/client/v4'
const TIMEOUT_MS = 15000

export function parseArgs(argv) {
  const out = { mode: 'dry-run', help: false }
  const modes = []
  for (const a of argv) {
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--execute') modes.push('execute')
    else if (a === '--show') modes.push('show')
    else if (a === '--verify-token') modes.push('verify-token')
    else throw new Error(`unknown argument ${a}`)
  }
  if (modes.length > 1) throw new Error('choose only one mode (--execute, --show or --verify-token)')
  if (modes.length === 1) out.mode = modes[0]
  return out
}

function readKeychain() {
  return new Promise((resolve, reject) => {
    execFile('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'], { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(new Error(`could not read Keychain item "${KEYCHAIN_SERVICE}"`))
      const value = String(stdout).trim()
      if (value === '') return reject(new Error(`Keychain item "${KEYCHAIN_SERVICE}" is empty`))
      resolve(value)
    })
  })
}

const defaultOut = (line) => console.log(line)
const defaultFail = (line) => console.error(line)

/** Returns the process exit code. deps: { getToken, fetchFn, out, fail, env } for tests. */
export async function run(opts, deps = {}) {
  const out = deps.out ?? defaultOut
  const fail = deps.fail ?? defaultFail
  const env = deps.env ?? process.env
  const fetchFn = deps.fetchFn ?? fetch
  const getToken = deps.getToken ?? readKeychain

  if (env.CLOUDFLARE_API_TOKEN) {
    fail('refusing to run: CLOUDFLARE_API_TOKEN is set. This tool reads its credential from the Keychain only.')
    return 1
  }

  let secret
  try {
    secret = await getToken()
  } catch (err) {
    fail(err.message)
    return 1
  }

  // The credential is passed only in the Authorization header below.
  async function cf(path, init = {}) {
    const res = await fetchFn(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    let body = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    if (!res.ok || !body || body.success !== true) {
      const detail = (body?.errors ?? []).map((e) => e.message).filter(Boolean).join('; ')
      throw new Error(`Cloudflare API ${path.split('?')[0]} failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`)
    }
    return body.result
  }

  const listWww = () => cf(`/zones/${ZONE_ID}/dns_records?type=CNAME&name=${WWW_NAME}`)
  const line = (rec) => {
    const d = describeRecord(rec)
    return `${d.name} ${d.type} target=${d.target} proxied=${d.proxied}`
  }

  try {
    if (opts.mode === 'verify-token') {
      const result = await cf('/user/tokens/verify')
      if (result?.status === 'active') {
        out('token active')
        return 0
      }
      out('token not active')
      return 1
    }

    const record = pickWwwRecord(await listWww())

    if (opts.mode === 'show') {
      out(line(record))
      return 0
    }

    if (opts.mode === 'dry-run') {
      buildRollbackPatch(record) // throws when already grey
      out(line(record))
      out(`would set www proxied=false (currently ${record.proxied}); run with --execute to apply`)
      return 0
    }

    // execute: exactly one write
    const patch = buildRollbackPatch(record)
    await cf(`/zones/${ZONE_ID}/dns_records/${record.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    const after = pickWwwRecord(await listWww())
    out(`after: ${line(after)}`)
    if (after.proxied !== false) {
      fail('read-back shows www is still proxied; rollback NOT applied')
      return 1
    }
    out('rollback applied: www is DNS only (grey)')
    return 0
  } catch (err) {
    fail(`rollback: ${err.message}`)
    return 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    console.error(USAGE)
    process.exit(1)
  }
  if (opts.help) {
    console.log(USAGE)
    process.exit(0)
  }
  process.exit(await run(opts))
}
