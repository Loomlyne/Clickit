#!/usr/bin/env node
// Outside proof, with no secret, that the old (legacy) Supabase anon key is dead after the
// close step and that the new publishable key works. Also a side-effect-free probe of the
// CAPTCHA switch.
//
// The repo is public. Keys are found in the public bundles at run time, held in local
// variables, sent only in an apikey header, and printed only through redact(). Nothing is
// stored. This script never reads a key from the environment, a file or the Keychain.
//
//   node scripts/cutover/keys-check.mjs --expect legacy-on  --worker-site https://clickit.<sub>.workers.dev
//   node scripts/cutover/keys-check.mjs --expect legacy-off --legacy-ip 216.198.79.1
//   node scripts/cutover/keys-check.mjs --captcha-probe off|on
//   node scripts/cutover/keys-check.mjs --extract-only      (public GETs only, nothing sent to the API)
//
// Flow: GET the old host's page (pinned to --legacy-ip when given) and the /_next/static
// chunks it references (max 40), find the anon token of this project; GET the Worker site
// and its chunks, find the publishable key; one apikey-only REST read per key; judge.
// --captcha-probe: one password grant for a non-existent .invalid address with no captcha
// token. A wrong login writes nothing and sends no mail.

import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { fileURLToPath } from 'node:url'
import { pinnedRequest } from './http-pin.mjs'

export const PROJECT_REF = 'lajguozmtissnnfccmej'
export const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
export const REST_PROBE_URL = `${SUPABASE_URL}/rest/v1/shows?select=id&limit=1`
export const TOKEN_URL = `${SUPABASE_URL}/auth/v1/token?grant_type=password`
export const OLD_HOST_SITE = 'https://www.clickitstory.ae'
const MAX_CHUNKS = 40
const MAX_REDIRECTS = 5
const CHUNK_MAX_BYTES = 6 * 1024 * 1024

export const USAGE = `keys-check: legacy key off / new key on, and the CAPTCHA switch (no secret needed)
  --expect legacy-on|legacy-off   judge the REST status of the legacy and the publishable key
  --legacy-ip <ip>                fetch the old host's bundle from this IP (frozen deployment)
  --worker-site <https url>       where the publishable key is found, default ${OLD_HOST_SITE}
  --captcha-probe off|on          one password grant without a captcha token; expect the switch off or on
  --extract-only                  find the keys in the public bundles, send nothing to the API
  --help`

// ---------------------------------------------------------------- pure helpers

const TOKEN_SHAPE = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
const PUBLISHABLE_SHAPE = /sb_publishable_[A-Za-z0-9_-]+/

function decodePayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** The anon token of the given project ref found in any of the texts, or null. */
export function findLegacyAnonKey(texts, ref) {
  for (const text of texts) {
    for (const match of String(text).matchAll(TOKEN_SHAPE)) {
      const payload = decodePayload(match[0])
      if (payload && payload.role === 'anon' && payload.ref === ref) return match[0]
    }
  }
  return null
}

/** The first publishable-shaped key in the texts, or null. The secret shape never matches. */
export function findPublishableKey(texts) {
  for (const text of texts) {
    const match = String(text).match(PUBLISHABLE_SHAPE)
    if (match) return match[0]
  }
  return null
}

/** Only the first 8 characters and the length, for every log line. */
export function redact(key) {
  if (key === undefined || key === null) return '(none)'
  if (key === '') return '(empty)'
  return `${String(key).slice(0, 8)}... (${String(key).length} chars)`
}

const verdict = (reasons) => ({ ok: reasons.length === 0, reasons })
const missing = (status) => status === null || status === undefined

/**
 * @param {{ expect: 'legacy-on'|'legacy-off', legacy?: number|null, publishable?: number|null }} input
 * Statuses are REST statuses; null/undefined means the key was not found.
 */
export function judgeKeys({ expect, legacy, publishable }) {
  if (expect !== 'legacy-on' && expect !== 'legacy-off') throw new Error('expect must be legacy-on or legacy-off')
  const reasons = []
  if (missing(legacy)) reasons.push('legacy anon key not found in the old host bundle')
  else if (expect === 'legacy-on' && legacy !== 200) reasons.push(`legacy key answered ${legacy}, expected 200 (legacy-on)`)
  else if (expect === 'legacy-off' && legacy !== 401) reasons.push(`legacy key answered ${legacy}, expected 401 (legacy-off)`)
  if (missing(publishable)) reasons.push('publishable key not found in the Worker bundle')
  else if (publishable !== 200) reasons.push(`publishable key answered ${publishable}, expected 200`)
  return verdict(reasons)
}

/** @param {{ expect: 'off'|'on', status: number, body: string }} input */
export function judgeCaptchaProbe({ expect, status, body }) {
  if (expect !== 'on' && expect !== 'off') throw new Error('expect must be on or off')
  const text = String(body ?? '').toLowerCase()
  const reasons = []
  if (status !== 400) reasons.push(`status ${status}, expected 400`)
  if (expect === 'on') {
    if (!text.includes('captcha')) reasons.push('refusal does not mention captcha: the switch looks off')
  } else {
    if (text.includes('captcha')) reasons.push('refusal mentions captcha: the switch looks on')
    else if (!text.includes('invalid login credentials')) reasons.push('answer is not "Invalid login credentials"')
  }
  return verdict(reasons)
}

function httpsOrigin(flag, raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${flag} must be an https URL`)
  }
  if (url.protocol !== 'https:') throw new Error(`${flag} must be an https URL`)
  return url.origin
}

export function parseArgs(argv) {
  const out = {
    expect: null,
    legacyIp: null,
    workerSite: OLD_HOST_SITE,
    captchaProbe: null,
    extractOnly: false,
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
    else if (a === '--expect') {
      const v = next()
      if (v !== 'legacy-on' && v !== 'legacy-off') throw new Error('--expect must be legacy-on|legacy-off')
      out.expect = v
    } else if (a === '--legacy-ip') {
      const v = next()
      if (isIP(v) === 0) throw new Error('--legacy-ip must be an IP address')
      out.legacyIp = v
    } else if (a === '--worker-site') out.workerSite = httpsOrigin(a, next())
    else if (a === '--captcha-probe') {
      const v = next()
      if (v !== 'off' && v !== 'on') throw new Error('--captcha-probe must be off|on')
      out.captchaProbe = v
    } else if (a === '--extract-only') out.extractOnly = true
    else throw new Error(`unknown argument ${a}`)
  }
  if (!out.help) {
    if (out.extractOnly && out.captchaProbe) throw new Error('--extract-only sends nothing, it cannot be combined with --captcha-probe')
    if (out.extractOnly && out.expect) throw new Error('--extract-only sends nothing, it cannot be combined with --expect')
    if (!out.expect && !out.captchaProbe && !out.extractOnly) {
      throw new Error('one of --expect, --captcha-probe or --extract-only is required')
    }
  }
  return out
}

// ---------------------------------------------------------------- bundle search

function chunkPaths(html) {
  const text = String(html).replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&')
  const found = []
  const seen = new Set()
  for (const m of text.matchAll(/\/_next\/static\/[^\s"'<>\\()]+?\.js(?:\?[^\s"'<>\\()]*)?(?=["'\s<>\\)]|$)/g)) {
    if (!seen.has(m[0])) {
      seen.add(m[0])
      found.push(m[0])
    }
  }
  return found
}

/** GET following same-origin redirects only, carrying the same IP pin. */
async function fetchFollow(request, startUrl, ip) {
  let url = startUrl
  const origin = new URL(startUrl).origin
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await request(url, { ip, readBody: true, maxBytes: CHUNK_MAX_BYTES })
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const target = new URL(res.headers.location, url)
      if (target.origin !== origin) throw new Error(`redirect to another origin: ${target.origin}`)
      url = target.toString()
      continue
    }
    return { ...res, url }
  }
  throw new Error(`more than ${MAX_REDIRECTS} redirects from ${startUrl}`)
}

/**
 * Looks for a key on a site: the page first, then its chunks, stopping at the first hit.
 * @returns {Promise<{ key: string|null, where: string, files: number }>}
 */
async function findInSite({ origin, ip, find, request }) {
  const page = await fetchFollow(request, `${origin}/en`, ip)
  if (page.status !== 200) return { key: null, where: `${origin}/en answered ${page.status}`, files: 0 }
  const inPage = find([page.body ?? ''])
  if (inPage) return { key: inPage, where: new URL(page.url).pathname, files: 1 }
  const paths = chunkPaths(page.body ?? '').slice(0, MAX_CHUNKS)
  let files = 1
  for (const path of paths) {
    const res = await fetchFollow(request, new URL(path, page.url).toString(), ip)
    files += 1
    if (res.status !== 200) continue
    const hit = find([res.body ?? ''])
    if (hit) return { key: hit, where: path.split('?')[0], files }
  }
  return { key: null, where: `searched ${files} files`, files }
}

// ---------------------------------------------------------------- run

/**
 * `deps` injects the pinned request, fetch and output so tests need no network.
 * @returns {Promise<number>} exit code
 */
export async function run(opts, deps = {}) {
  const request = deps.request ?? pinnedRequest
  const doFetch = deps.fetch ?? fetch
  const out = deps.out ?? ((line) => console.log(line))
  let failed = 0
  const line = (ok, text) => {
    if (!ok) failed += 1
    out(`${ok ? 'PASS' : 'FAIL'} ${text}`)
  }

  // Keys stay in these locals. Any text that could echo one is scrubbed first.
  let legacyKey = null
  let publishableKey = null
  const scrub = (text) => {
    let safe = String(text)
    if (legacyKey) safe = safe.split(legacyKey).join(redact(legacyKey))
    if (publishableKey) safe = safe.split(publishableKey).join(redact(publishableKey))
    return safe.replace(/\s+/g, ' ').slice(0, 160)
  }

  const needLegacy = Boolean(opts.expect) || opts.extractOnly
  const labels = []
  if (opts.expect) labels.push(opts.expect)
  if (opts.captchaProbe) labels.push(`captcha-probe ${opts.captchaProbe}`)
  if (opts.extractOnly) labels.push('extract-only')

  try {
    if (needLegacy) {
      const found = await findInSite({
        origin: OLD_HOST_SITE,
        ip: opts.legacyIp,
        find: (texts) => findLegacyAnonKey(texts, PROJECT_REF),
        request,
      })
      legacyKey = found.key
      if (legacyKey) out(`PASS legacy key found: ${redact(legacyKey)} in ${found.where}`)
      else line(false, `legacy key not found (${found.where})`)
    }

    const foundPub = await findInSite({
      origin: opts.workerSite,
      ip: null,
      find: findPublishableKey,
      request,
    })
    publishableKey = foundPub.key
    if (publishableKey) out(`PASS publishable key found: ${redact(publishableKey)} in ${foundPub.where}`)
    else line(false, `publishable key not found (${foundPub.where})`)
  } catch (error) {
    line(false, `bundle search failed: ${scrub(error instanceof Error ? error.message : String(error))}`)
  }

  const restStatus = async (label, key) => {
    if (!key) return null
    try {
      const res = await doFetch(REST_PROBE_URL, {
        method: 'GET',
        headers: { apikey: key },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      })
      const body = res.status === 200 ? '' : await res.text()
      out(`INFO ${label} REST status: ${res.status}${body ? ` body: ${scrub(body)}` : ''}`)
      return res.status
    } catch (error) {
      line(false, `${label} REST read failed: ${scrub(error instanceof Error ? error.message : String(error))}`)
      return null
    }
  }

  if (opts.expect) {
    const legacy = await restStatus('legacy', legacyKey)
    const publishable = await restStatus('publishable', publishableKey)
    const v = judgeKeys({ expect: opts.expect, legacy, publishable })
    // Not-found keys were already reported as FAIL above; do not count them twice.
    const reasons = v.reasons.filter((r) => !/not found/.test(r))
    if (reasons.length === 0 && v.ok) line(true, `keys ${opts.expect}: legacy ${legacy}, publishable ${publishable}`)
    else for (const reason of reasons) line(false, `keys ${opts.expect}: ${reason}`)
  }

  if (opts.captchaProbe && publishableKey) {
    try {
      const res = await doFetch(TOKEN_URL, {
        method: 'POST',
        headers: { apikey: publishableKey, 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'captcha-probe@example.invalid', password: randomUUID() }),
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      })
      const body = await res.text()
      const v = judgeCaptchaProbe({ expect: opts.captchaProbe, status: res.status, body })
      if (v.ok) line(true, `captcha probe ${opts.captchaProbe}: status ${res.status}, body ${scrub(body)}`)
      else line(false, `captcha probe ${opts.captchaProbe}: ${v.reasons.join('; ')} (status ${res.status}, body ${scrub(body)})`)
    } catch (error) {
      line(false, `captcha probe failed: ${scrub(error instanceof Error ? error.message : String(error))}`)
    }
  }

  const label = labels.join(' + ')
  if (failed > 0) {
    out(`keys-check ${label}: ${failed} FAILED`)
    return 1
  }
  out(`keys-check ${label}: ALL PASS`)
  return 0
}

async function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    console.error(USAGE)
    process.exitCode = 1
    return
  }
  if (opts.help) {
    console.log(USAGE)
    return
  }
  process.exitCode = await run(opts)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
