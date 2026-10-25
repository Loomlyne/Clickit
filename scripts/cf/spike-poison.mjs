// Spike (c), plan 02.1-01, D-03c and D-40. THROWAWAY: deleted in plan 02.1-06.
// Through the gateway probe (/spike-probe/gw/<path>, custom-worker.ts):
//   1. header variants per route, each compared byte for byte with the baseline
//      (a cache keyed on the path must not see a header change the body);
//   2. session classification (x-spike-class) for forged, foreign-key, expired,
//      verifier-only and valid (plain and re-chunked) auth cookies;
//   3. two different anon requests (baseline, forged cookie, verifier-only) must
//      give byte-identical HTML;
//   4. RTL: /ar pages carry lang="ar" dir="rtl", /en pages lang="en" dir="ltr".
// GET only, redirect manual. Cookie and token values are never printed: only
// lengths and sha256 prefixes. The session cookie file (local preview only)
// holds one line, the auth cookie VALUE (`base64-...` or raw JSON); keep it
// outside the repo with mode 600.
//
// Usage:
//   node scripts/cf/spike-poison.mjs --mode probe --base http://127.0.0.1:8787 \
//        --routes /spike-probe/a,/en/portfolio,/ar/portfolio \
//        [--session-cookie-file <path>] [--cookie-name sb-127-auth-token] \
//        [--gateway-config .open-next/clickit-gateway-config.json] [--session-route /spike-probe/a]
// Prints one JSON summary. Exit 1 when any assertion fails.

import { createHash, webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const subtle = webcrypto.subtle

export const USAGE = `spike-poison: cache-poisoning and session-class probe through /spike-probe/gw (GET only)
  --mode probe                 the only mode
  --base <url>                 required, e.g. http://127.0.0.1:8787
  --routes <list>              required, comma-separated paths (sent as /spike-probe/gw<path>)
  --session-cookie-file <path> optional, local preview only: one line, the auth cookie value (never printed)
  --cookie-name <name>         auth cookie name (default: authCookieName from --gateway-config)
  --gateway-config <path>      default .open-next/clickit-gateway-config.json
  --session-route <path>       route used for the session cases (default /spike-probe/a)
  --help`

export function parseArgs(argv) {
  const out = {
    mode: null,
    base: null,
    routes: [],
    sessionCookieFile: null,
    cookieName: null,
    gatewayConfig: '.open-next/clickit-gateway-config.json',
    sessionRoute: '/spike-probe/a',
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--mode') out.mode = next()
    else if (a === '--base') out.base = new URL(next()).origin
    else if (a === '--routes') out.routes = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--session-cookie-file') out.sessionCookieFile = next()
    else if (a === '--cookie-name') out.cookieName = next()
    else if (a === '--gateway-config') out.gatewayConfig = next()
    else if (a === '--session-route') out.sessionRoute = next()
    else throw new Error(`unknown argument ${a}`)
  }
  return out
}

export const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

/** Header variants compared with the baseline. `anon: true` ones must be identical (D-40). */
export const HEADER_VARIANTS = Object.freeze([
  { name: 'baseline-repeat', headers: {}, anon: true },
  { name: 'accept-language:ar', headers: { 'accept-language': 'ar' } },
  { name: 'cookie:NEXT_LOCALE=ar;sb-x=1', headers: { cookie: 'NEXT_LOCALE=ar; sb-x=1' }, anon: true },
  { name: 'user-agent:mobile', headers: { 'user-agent': MOBILE_UA } },
  { name: 'x-forwarded-host:evil.example', headers: { 'x-forwarded-host': 'evil.example' }, hostile: true },
  { name: 'forwarded:host=evil.example', headers: { forwarded: 'host=evil.example' }, hostile: true },
  { name: 'next-url:/en/watch', headers: { 'next-url': '/en/watch' }, hostile: true },
])

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16)

export function firstDiff(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

/** 200 bytes around an offset, as text, for naming the cause of a difference. */
export function around(buf, offset) {
  const start = Math.max(0, offset - 100)
  return buf.subarray(start, offset + 100).toString('utf8')
}

/** lang and dir of the <html> tag. */
export function htmlLangDir(text) {
  const tag = /<html\b[^>]*>/i.exec(text)?.[0] ?? ''
  return {
    lang: /\blang="([^"]*)"/i.exec(tag)?.[1] ?? null,
    dir: /\bdir="([^"]*)"/i.exec(tag)?.[1] ?? null,
  }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

/** Access token of an auth cookie value (`base64-` + base64url JSON, or raw JSON); null when unreadable. */
export function accessTokenOf(value) {
  try {
    const json = value.startsWith('base64-') ? Buffer.from(value.slice(7), 'base64url').toString('utf8') : value
    const token = JSON.parse(json)?.access_token
    return typeof token === 'string' ? token : null
  } catch {
    return null
  }
}

export function jwtParts(token) {
  const [h, p] = token.split('.')
  return {
    header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(p, 'base64url').toString('utf8')),
  }
}

/** An ES256 token signed by a freshly generated key (never in the JWKS). */
export async function foreignToken(kid) {
  const { privateKey } = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid }))
  const payload = b64url(
    JSON.stringify({ sub: '00000000-0000-4000-8000-000000000000', role: 'authenticated', iat: now, exp: now + 3600 }),
  )
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, Buffer.from(`${header}.${payload}`))
  return `${header}.${payload}.${b64url(sig)}`
}

export const cookieValueFor = (token) => `base64-${b64url(JSON.stringify({ access_token: token, token_type: 'bearer' }))}`

/** Split a cookie value into `<name>.0` and `<name>.1` (the reader reassembles any split). */
export function chunked(name, value) {
  const mid = Math.ceil(value.length / 2)
  return `${name}.0=${value.slice(0, mid)}; ${name}.1=${value.slice(mid)}`
}

async function get(base, path, headers) {
  const res = await fetch(new URL(path, base), { headers, redirect: 'manual' })
  return {
    status: res.status,
    location: res.headers.get('location'),
    cls: res.headers.get('x-spike-class'),
    reason: res.headers.get('x-spike-reason'),
    body: Buffer.from(await res.arrayBuffer()),
  }
}

const gw = (route) => `/spike-probe/gw${route.startsWith('/') ? route : `/${route}`}`

async function headerVariants(base, route) {
  const baseline = await get(base, gw(route), {})
  const variants = []
  for (const v of HEADER_VARIANTS) {
    const r = await get(base, gw(route), v.headers)
    const offset = firstDiff(baseline.body, r.body)
    const same = offset === -1 && r.status === baseline.status
    variants.push({
      variant: v.name,
      identical: same,
      status: r.status,
      cls: r.cls,
      ...(same
        ? {}
        : {
            offset,
            baselineSha: sha(baseline.body),
            variantSha: sha(r.body),
            baselineAround: offset >= 0 ? around(baseline.body, offset) : '',
            variantAround: offset >= 0 ? around(r.body, offset) : '',
          }),
      mustMatch: Boolean(v.anon),
      hostile: Boolean(v.hostile),
    })
  }
  return { baseline, variants }
}

async function sessionCases(base, route, cookieName, sessionValue) {
  const cases = []
  const run = async (name, expect, headers, note) => {
    const r = await get(base, gw(route), headers)
    cases.push({ case: name, expect, cls: r.cls, reason: r.reason, status: r.status, pass: r.cls === expect, ...(note ?? {}) })
    return r
  }
  const none = await run('no-cookie', 'anon', {})
  const forged = await run('forged sb-x=1', 'anon', { cookie: 'sb-x=1' })
  const verifier = await run('verifier-only', 'anon', { cookie: `${cookieName}-code-verifier=spike-verifier` })
  const other = cookieValueFor(await foreignToken('spike-foreign-kid'))
  await run('foreign key, unknown kid', 'bypass', { cookie: `${cookieName}=${other}` }, { cookieLen: other.length })
  const anonBodiesIdentical = firstDiff(none.body, forged.body) === -1 && firstDiff(none.body, verifier.body) === -1

  if (!sessionValue) {
    for (const name of ['foreign key, known kid', 'real session expired (x-spike-now)', 'real session plain', 'real session chunked .0/.1']) {
      cases.push({ case: name, expect: name.startsWith('real session plain') || name.includes('chunked') ? 'user' : 'bypass', skipped: 'no --session-cookie-file', pass: null })
    }
    return { cases, anonBodiesIdentical, session: null }
  }
  const token = accessTokenOf(sessionValue)
  if (!token) {
    cases.push({ case: 'real session', expect: 'user', skipped: 'session cookie file unreadable', pass: false })
    return { cases, anonBodiesIdentical, session: { len: sessionValue.length, sha: sha(sessionValue) } }
  }
  const { header, payload } = jwtParts(token)
  const knownKid = cookieValueFor(await foreignToken(header.kid))
  await run('foreign key, known kid', 'bypass', { cookie: `${cookieName}=${knownKid}` })
  await run('real session expired (x-spike-now)', 'bypass', {
    cookie: `${cookieName}=${sessionValue}`,
    'x-spike-now': String((Number(payload.exp) + 3600) * 1000),
  })
  await run('real session plain', 'user', { cookie: `${cookieName}=${sessionValue}` })
  await run('real session chunked .0/.1', 'user', { cookie: chunked(cookieName, sessionValue) })
  return {
    cases,
    anonBodiesIdentical,
    session: { len: sessionValue.length, sha: sha(sessionValue), alg: header.alg, hasKid: Boolean(header.kid) },
  }
}

function cookieNameFrom(args) {
  if (args.cookieName) return args.cookieName
  const cfg = JSON.parse(readFileSync(args.gatewayConfig, 'utf8'))
  if (typeof cfg.authCookieName !== 'string') throw new Error('gateway config has no authCookieName')
  return cfg.authCookieName
}

async function main(argv) {
  let args
  try {
    args = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`${error.message}\n${USAGE}\n`)
    return 2
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  if (args.mode !== 'probe' || !args.base || args.routes.length === 0) {
    process.stderr.write(`--mode probe, --base and --routes are required\n${USAGE}\n`)
    return 2
  }
  const startedAt = new Date().toISOString()
  const cookieName = cookieNameFrom(args)
  const sessionValue = args.sessionCookieFile ? readFileSync(args.sessionCookieFile, 'utf8').trim() || null : null

  const routes = []
  for (const route of args.routes) {
    const { baseline, variants } = await headerVariants(args.base, route)
    const text = baseline.body.toString('utf8')
    const langDir = htmlLangDir(text)
    const want = route.startsWith('/ar') ? { lang: 'ar', dir: 'rtl' } : route.startsWith('/en') ? { lang: 'en', dir: 'ltr' } : null
    routes.push({
      route,
      baseline: { status: baseline.status, cls: baseline.cls, len: baseline.body.length, sha: sha(baseline.body), location: baseline.location },
      rtl: want ? { ...langDir, pass: langDir.lang === want.lang && langDir.dir === want.dir } : null,
      variants,
    })
  }
  const session = await sessionCases(args.base, args.sessionRoute, cookieName, sessionValue)

  const failures = []
  for (const r of routes) {
    for (const v of r.variants) {
      if (!v.identical && (v.mustMatch || v.hostile)) failures.push(`${r.route} ${v.variant}`)
    }
    if (r.rtl && !r.rtl.pass) failures.push(`${r.route} rtl`)
  }
  const otherDiffs = routes.flatMap((r) => r.variants.filter((v) => !v.identical && !v.mustMatch && !v.hostile).map((v) => `${r.route} ${v.variant}`))
  for (const c of session.cases) if (c.pass === false) failures.push(`session ${c.case}`)
  if (!session.anonBodiesIdentical) failures.push('anon bodies differ (no-cookie vs forged vs verifier-only)')

  const summary = {
    script: 'spike-poison',
    base: args.base,
    startedAt,
    endedAt: new Date().toISOString(),
    cookieName,
    failures,
    differencesToAttribute: otherDiffs,
    session,
    routes,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  return failures.length === 0 && otherDiffs.length === 0 ? 0 : 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (error) => {
      process.stderr.write(`spike-poison failed: ${error.message}\n`)
      process.exitCode = 2
    },
  )
}
