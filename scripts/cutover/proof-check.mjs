#!/usr/bin/env node
// Outside-in proof that a hostname is served by the Worker (or still by the old host).
// GET/HEAD to public pages only, no secret, no write.
//
//   node scripts/cutover/proof-check.mjs --expect worker --resolve-ip 104.21.29.215
//   node scripts/cutover/proof-check.mjs --expect vercel --vercel-ip 216.198.79.1
//   node scripts/cutover/proof-check.mjs --expect worker --site https://clickit.<sub>.workers.dev
//
// Checks (one PASS/FAIL line each; exit 1 on any FAIL):
//   site   GET <site><site-path>   (default /en; --expect worker: 200, server cloudflare, cf-ray,
//                                    x-clickit-runtime workers, no x-vercel-id/x-vercel-cache;
//                                    --expect vercel: 200 and x-vercel-id present)
//   cert   certificate of the answering edge, at least --min-cert-days left
//   apex   GET <apex>/en            301 to exactly https://www.clickitstory.ae/en, server cloudflare
//   http   GET http://<apex>/       301 to https
//   media  GET <media>/             404 from cloudflare
//   --vercel-ip: extra line with the certificate notAfter the old host serves for www
//                (the DNS rollback ceiling).

import { isIP } from 'node:net'
import { fileURLToPath } from 'node:url'
import { pinnedRequest } from './http-pin.mjs'

export const USAGE = `proof-check: is www served by the Worker? (GET only, no secret)
  --expect worker|vercel   required
  --site <https url>       default https://www.clickitstory.ae
  --site-path <path>       page to GET on the site, default /en (use a path that answers 200)
  --apex <https url>       default https://clickitstory.ae
  --media <https url>      default https://media.clickitstory.ae
  --resolve-ip <ip>        pin only the site host to this IP (no DNS change)
  --vercel-ip <ip>         also read the old host's certificate for www (rollback ceiling)
  --min-cert-days <n>      default 14
  --help`

export const WWW_EN_URL = 'https://www.clickitstory.ae/en'
export const RUNTIME_MARKER = 'x-clickit-runtime'
const DAY_MS = 86_400_000

function headerOf(headers, name) {
  if (!headers) return null
  if (typeof headers.get === 'function') return headers.get(name)
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return Array.isArray(value) ? value.join(', ') : value ?? null
  }
  return null
}

const present = (headers, name) => {
  const v = headerOf(headers, name)
  return v !== null && v !== undefined && String(v) !== ''
}

const verdict = (reasons) => ({ ok: reasons.length === 0, reasons })

/** @param {'worker'|'vercel'} expect */
export function judgeSite(expect, response) {
  if (expect !== 'worker' && expect !== 'vercel') throw new Error('expect must be worker or vercel')
  const reasons = []
  const { status, headers } = response
  if (status !== 200) reasons.push(`status ${status}, expected 200`)
  if (expect === 'vercel') {
    if (!present(headers, 'x-vercel-id')) reasons.push('x-vercel-id missing')
    return verdict(reasons)
  }
  const server = headerOf(headers, 'server')
  if (String(server ?? '').toLowerCase() !== 'cloudflare') reasons.push(`server ${server ?? '-'}, expected cloudflare`)
  if (!present(headers, 'cf-ray')) reasons.push('cf-ray missing')
  if (present(headers, 'x-vercel-id')) reasons.push('x-vercel-id present (old host answered)')
  if (present(headers, 'x-vercel-cache')) reasons.push('x-vercel-cache present (old host answered)')
  const marker = headerOf(headers, RUNTIME_MARKER)
  if (marker !== 'workers') reasons.push(`${RUNTIME_MARKER} ${marker ?? 'missing'}, expected workers`)
  return verdict(reasons)
}

/** Apex must send visitors to the exact www URL for the /en probe. */
export function judgeApex(response, { expectedLocation = WWW_EN_URL, requireCloudflare = false } = {}) {
  const reasons = []
  if (response.status !== 301) reasons.push(`status ${response.status}, expected 301`)
  const location = headerOf(response.headers, 'location')
  if (location !== expectedLocation) reasons.push(`location ${location ?? 'missing'}, expected ${expectedLocation}`)
  if (requireCloudflare) {
    const server = headerOf(response.headers, 'server')
    if (String(server ?? '').toLowerCase() !== 'cloudflare') reasons.push(`server ${server ?? '-'}, expected cloudflare`)
  }
  return verdict(reasons)
}

/** http://<apex>/ must answer 301 to an https URL on the apex or www host. */
export function judgeHttpRedirect(response, apexHost) {
  const reasons = []
  if (response.status !== 301) reasons.push(`status ${response.status}, expected 301`)
  const location = headerOf(response.headers, 'location')
  let ok = false
  try {
    const target = new URL(location ?? '')
    ok = target.protocol === 'https:' && (target.hostname === apexHost || target.hostname === `www.${apexHost}`)
  } catch {
    ok = false
  }
  if (!ok) reasons.push(`location ${location ?? 'missing'}, expected an https URL on ${apexHost} or www.${apexHost}`)
  return verdict(reasons)
}

/** The bare media host has no page: 404 from Cloudflare. */
export function judgeMedia(response) {
  const reasons = []
  if (response.status !== 404) reasons.push(`status ${response.status}, expected 404`)
  const server = headerOf(response.headers, 'server')
  if (String(server ?? '').toLowerCase() !== 'cloudflare') reasons.push(`server ${server ?? '-'}, expected cloudflare`)
  return verdict(reasons)
}

/** @param {{ validTo?: string, now: number|Date, minDays: number }} input */
export function judgeCert({ validTo, now, minDays }) {
  const end = typeof validTo === 'string' ? Date.parse(validTo) : NaN
  if (Number.isNaN(end)) return { ok: false, daysLeft: null, reason: `certificate notAfter unreadable (${validTo ?? 'missing'})` }
  const daysLeft = Math.floor((end - Number(now)) / DAY_MS)
  if (daysLeft < minDays) {
    return { ok: false, daysLeft, reason: `certificate valid for ${daysLeft} days, need at least ${minDays}` }
  }
  return { ok: true, daysLeft, reason: `notAfter ${validTo}, ${daysLeft} days left` }
}

function httpsUrl(flag, raw) {
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
    site: 'https://www.clickitstory.ae',
    sitePath: '/en',
    apex: 'https://clickitstory.ae',
    media: 'https://media.clickitstory.ae',
    resolveIp: null,
    vercelIp: null,
    minCertDays: 14,
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
      if (v !== 'worker' && v !== 'vercel') throw new Error('--expect must be worker|vercel')
      out.expect = v
    } else if (a === '--site') out.site = httpsUrl(a, next())
    else if (a === '--site-path') {
      const v = next()
      if (!v.startsWith('/') || v.startsWith('//')) throw new Error('--site-path must start with a single /')
      out.sitePath = v
    } else if (a === '--apex') out.apex = httpsUrl(a, next())
    else if (a === '--media') out.media = httpsUrl(a, next())
    else if (a === '--resolve-ip' || a === '--vercel-ip') {
      const v = next()
      if (isIP(v) === 0) throw new Error(`${a} must be an IP address`)
      if (a === '--resolve-ip') out.resolveIp = v
      else out.vercelIp = v
    } else if (a === '--min-cert-days') {
      const n = Number(next())
      if (!Number.isInteger(n) || n < 0) throw new Error('--min-cert-days must be a whole number')
      out.minCertDays = n
    } else throw new Error(`unknown argument ${a}`)
  }
  if (!out.help && out.expect === null) throw new Error('--expect worker|vercel is required')
  return out
}

/**
 * Runs every check. `deps` injects the request function, the clock and the output
 * so tests need no network.
 * @returns {Promise<number>} exit code
 */
export async function run(opts, deps = {}) {
  const request = deps.request ?? pinnedRequest
  const now = deps.now ?? Date.now
  const out = deps.out ?? ((line) => console.log(line))
  let failed = 0

  const line = (ok, name, detail) => {
    if (!ok) failed += 1
    out(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`)
  }
  const report = (name, v, okDetail) => line(v.ok, name, v.ok ? okDetail : v.reasons.join('; '))
  const attempt = async (name, fn) => {
    try {
      await fn()
    } catch (error) {
      line(false, name, error instanceof Error ? error.message : String(error))
    }
  }

  const siteUrl = `${opts.site}${opts.sitePath}`
  await attempt('site', async () => {
    const res = await request(siteUrl, { ip: opts.resolveIp })
    report('site', judgeSite(opts.expect, res), `${opts.expect} answer (status ${res.status})`)
    const cert = judgeCert({ validTo: res.certificate?.validTo, now: now(), minDays: opts.minCertDays })
    line(cert.ok, 'cert', cert.ok ? cert.reason : cert.reason)
  })

  await attempt('apex', async () => {
    const res = await request(`${opts.apex}/en`, {})
    report('apex', judgeApex(res, { requireCloudflare: true }), `301 to ${headerOf(res.headers, 'location')}`)
  })

  await attempt('http', async () => {
    const apexHost = new URL(opts.apex).hostname
    const res = await request(`http://${apexHost}/`, {})
    report('http', judgeHttpRedirect(res, apexHost), `301 to ${headerOf(res.headers, 'location')}`)
  })

  await attempt('media', async () => {
    const res = await request(`${opts.media}/`, {})
    report('media', judgeMedia(res), 'bare host answers 404 from cloudflare')
  })

  if (opts.vercelIp) {
    await attempt('rollback', async () => {
      const res = await request(siteUrl, { ip: opts.vercelIp })
      const end = res.certificate?.validTo
      const cert = judgeCert({ validTo: end, now: now(), minDays: 0 })
      if (!cert.ok) {
        line(false, 'rollback', cert.reason)
        return
      }
      const ceiling = new Date(Date.parse(end) - 14 * DAY_MS).toISOString().slice(0, 10)
      line(
        true,
        'rollback',
        `old host certificate for www notAfter ${end} (${cert.daysLeft} days); rollback ceiling ${ceiling} (notAfter minus 14 days)`,
      )
    })
  }

  if (failed > 0) {
    out(`proof-check ${opts.expect}: ${failed} FAILED`)
    return 1
  }
  out(`proof-check ${opts.expect}: ALL PASS`)
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
