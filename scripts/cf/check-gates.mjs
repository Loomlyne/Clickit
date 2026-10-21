// PLAT-02 black-box gate checks against any base URL (preview, workers.dev, later www).
// GET only, redirect: "manual", no writes. A cookie file holds one line, the Cookie
// header value; its content is read, sent, and never printed.
//
// Usage:
//   node scripts/cf/check-gates.mjs --base http://127.0.0.1:8787
//   node scripts/cf/check-gates.mjs --base https://clickit.<sub>.workers.dev \
//        [--admin-cookie-file <path>] [--viewer-cookie-file <path>] [--expect-coming-soon]
//
// Checks (one PASS/FAIL line each, exit 1 on any FAIL):
//   /en and /ar answer 200 (or redirect to /<locale>/coming-soon with --expect-coming-soon)
//   / redirects to a locale
//   signed out: /en/profile, /en/my-list, /en/design-system redirect to /en/auth
//               (to /en/coming-soon with --expect-coming-soon), /en/admin redirects to /en/auth
//   /api/cron/* without the secret answers 401
//   dev routes (DEV_ROUTES, today /api/dev/r2-put) answer 404 (403 only on a loopback base,
//     where LOCAL_DEV=1 may be set); the probe is a tokenless PUT, which can never write
//   --admin-cookie-file:  /en/admin answers 200
//   --viewer-cookie-file: /en/admin does not answer 200 (redirect or 403)
//   --expect-coming-soon: a non-allowlisted page (/en/watch) redirects to /en/coming-soon

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const USAGE = `check-gates: black-box gate checks (GET only)
  --base <url>                 required, e.g. http://127.0.0.1:8787
  --admin-cookie-file <path>   file with the Cookie header of an admin session (never printed)
  --viewer-cookie-file <path>  file with the Cookie header of a non-admin session (never printed)
  --expect-coming-soon         the site is in coming-soon mode
  --help`

export function parseArgs(argv) {
  const out = { base: null, adminCookieFile: null, viewerCookieFile: null, expectComingSoon: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--base') out.base = next()
    else if (a === '--admin-cookie-file') out.adminCookieFile = next()
    else if (a === '--viewer-cookie-file') out.viewerCookieFile = next()
    else if (a === '--expect-coming-soon') out.expectComingSoon = true
    else throw new Error(`unknown argument ${a}`)
  }
  return out
}

export function normalizeBase(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('--base must be an absolute http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('--base must be http or https')
  return url.origin
}

/** Pathname of a redirect Location relative to base, or null when not a redirect. */
export function redirectPath(status, location, base) {
  if (status < 300 || status >= 400 || !location) return null
  try {
    return new URL(location, base).pathname
  } catch {
    return null
  }
}

function readCookie(path) {
  const text = readFileSync(path, 'utf8').trim()
  if (text === '') throw new Error(`cookie file ${path} is empty`)
  return text
}

/** Local-preview-only routes. They must be invisible (404) on workers.dev and production. */
export const DEV_ROUTES = Object.freeze([{ path: '/api/dev/r2-put/gate-check/probe.bin', method: 'PUT' }])

/** Loopback base: LOCAL_DEV=1 may be set there, which turns the 404 into a 403 for a tokenless call. */
export function isLoopbackBase(base) {
  try {
    const u = new URL(base)
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost'
  } catch {
    return false
  }
}

async function get(base, path, cookie, method = 'GET') {
  const res = await fetch(`${base}${path}`, {
    method,
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  })
  await res.arrayBuffer().catch(() => undefined)
  return { status: res.status, location: res.headers.get('location') }
}

export async function run(opts, log = console.log) {
  const base = normalizeBase(opts.base)
  const adminCookie = opts.adminCookieFile ? readCookie(opts.adminCookieFile) : null
  const viewerCookie = opts.viewerCookieFile ? readCookie(opts.viewerCookieFile) : null
  let failures = 0
  const report = (ok, name, detail) => {
    if (!ok) failures++
    log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  }
  const gateTarget = (locale) => (opts.expectComingSoon ? `/${locale}/coming-soon` : `/${locale}/auth`)

  for (const loc of ['en', 'ar']) {
    const r = await get(base, `/${loc}`)
    if (opts.expectComingSoon) {
      report(redirectPath(r.status, r.location, base) === `/${loc}/coming-soon`, `GET /${loc} redirects to coming-soon`, `status ${r.status}`)
    } else {
      report(r.status === 200, `GET /${loc} answers 200`, `status ${r.status}`)
    }
  }

  {
    const r = await get(base, '/')
    const p = redirectPath(r.status, r.location, base)
    report(p !== null && /^\/(en|ar)(\/|$)/.test(p), 'GET / redirects to a locale', `status ${r.status}, to ${p ?? 'none'}`)
  }

  for (const path of ['/en/profile', '/en/my-list', '/en/design-system']) {
    const r = await get(base, path)
    const p = redirectPath(r.status, r.location, base)
    report(p === gateTarget('en'), `signed out ${path} redirects to ${gateTarget('en')}`, `status ${r.status}, to ${p ?? 'none'}`)
  }
  {
    // /admin is on the coming-soon allowlist, so it goes to sign-in either way.
    const r = await get(base, '/en/admin')
    const p = redirectPath(r.status, r.location, base)
    report(p === '/en/auth', 'signed out /en/admin redirects to /en/auth', `status ${r.status}, to ${p ?? 'none'}`)
  }

  for (const path of ['/api/cron/publish-scheduled', '/api/cron/cleanup-media']) {
    const r = await get(base, path)
    report(r.status === 401, `${path} without the secret answers 401`, `status ${r.status}`)
  }

  for (const route of DEV_ROUTES) {
    const r = await get(base, route.path, null, route.method)
    const allowed = isLoopbackBase(base) ? [404, 403] : [404]
    report(allowed.includes(r.status), `${route.method} ${route.path.split('/').slice(0, 4).join('/')} dev route is not reachable`, `status ${r.status}`)
  }

  if (opts.expectComingSoon) {
    const r = await get(base, '/en/watch')
    report(redirectPath(r.status, r.location, base) === '/en/coming-soon', 'non-allowlisted /en/watch redirects to /en/coming-soon', `status ${r.status}`)
  }

  if (adminCookie) {
    const r = await get(base, '/en/admin', adminCookie)
    report(r.status === 200, 'admin session: /en/admin answers 200', `status ${r.status}`)
  }
  if (viewerCookie) {
    const r = await get(base, '/en/admin', viewerCookie)
    report(r.status !== 200 && (r.status === 403 || redirectPath(r.status, r.location, base) !== null), 'viewer session: /en/admin is refused', `status ${r.status}`)
  }

  log(failures === 0 ? 'ALL PASS' : `${failures} FAIL`)
  return failures
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
  if (!opts.base) {
    console.error('--base is required')
    console.error(USAGE)
    process.exit(2)
  }
  try {
    const failures = await run(opts)
    process.exit(failures === 0 ? 0 : 1)
  } catch (err) {
    console.error(`check-gates error: ${err.message}`)
    process.exit(2)
  }
}
