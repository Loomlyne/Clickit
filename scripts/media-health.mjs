#!/usr/bin/env node

/**
 * Media health check for www.clickitstory.ae.
 *
 * Fetches the live home page plus three content pages, collects every
 * public media URL they reference (direct or wrapped in /_next/image), and
 * HEADs each one. Exits 1 if any media URL is not 200.
 *
 *   npm run media:health
 *   npm run media:health -- --media-origin https://clickit-media.<sub>.workers.dev --verify-bytes
 *
 * --media-origin  rewrite media.clickitstory.ae URLs to another origin (prove
 *                 the Worker on workers.dev before DNS points at it)
 * --verify-bytes  GET each URL and compare its SHA-256 with the Supabase original
 * --site          site origin to crawl (default https://www.clickitstory.ae)
 * --page          page path to crawl; repeatable (replaces the default pages)
 * --timeout       per-request timeout in seconds (default 30; raise for --verify-bytes)
 * --expect-source r2|supabase  fail any media URL whose x-media-source header differs
 *                 (default: not checked)
 * --json          print the result as JSON
 */

import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const DEFAULT_SITE = 'https://www.clickitstory.ae'
export const DEFAULT_PAGES = [
  '/en',
  '/en/watch',
  '/en/portfolio',
  '/en/series/last-call',
]
export const MEDIA_HOST = 'media.clickitstory.ae'
export const SUPABASE_ORIGIN = 'https://lajguozmtissnnfccmej.supabase.co'
const PUBLIC_BUCKETS = new Set(['show-artwork', 'site-assets', 'avatars'])
const CONCURRENCY = 6
const DEFAULT_TIMEOUT_MS = 30_000

function decodeEntities(value) {
  return value
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/')
}

/** Every distinct media URL in an HTML page, query string kept. */
export function extractMediaUrls(html) {
  const found = new Set()
  const text = decodeEntities(html)

  const direct = /https:\/\/media\.clickitstory\.ae\/[^\s"'<>()\\,]+/g
  for (const match of text.matchAll(direct)) found.add(match[0])

  const encoded = /https%3A%2F%2Fmedia\.clickitstory\.ae%2F[^\s"'<>&()\\,]+/gi
  for (const match of text.matchAll(encoded)) {
    try {
      found.add(decodeURIComponent(match[0]))
    } catch {
      // Malformed escape in the page: ignore that occurrence.
    }
  }

  return [...found].filter((raw) => {
    try {
      const url = new URL(raw)
      const bucket = url.pathname.split('/')[1]
      return url.host === MEDIA_HOST && PUBLIC_BUCKETS.has(bucket)
    } catch {
      return false
    }
  })
}

export function rewriteOrigin(raw, mediaOrigin) {
  if (!mediaOrigin) return raw
  const url = new URL(raw)
  const target = new URL(mediaOrigin)
  url.protocol = target.protocol
  url.host = target.host
  return url.toString()
}

export function supabaseOriginalUrl(raw) {
  const url = new URL(raw)
  return `${SUPABASE_ORIGIN}/storage/v1/object/public${url.pathname}`
}

/**
 * Verdict on the x-media-source header of one result. Without an expectation it
 * never fails (default behaviour unchanged).
 * @param {{ source?: string|null }} result
 * @param {'r2'|'supabase'|null|undefined} expected
 */
export function sourceVerdict(result, expected) {
  if (!expected) return { ok: true, reason: null }
  const actual = result.source ?? null
  if (actual === expected) return { ok: true, reason: null }
  return { ok: false, reason: `x-media-source ${actual ?? 'missing'}, expected ${expected}` }
}

export function parseArgs(argv) {
  const options = {
    site: DEFAULT_SITE,
    pages: [],
    mediaOrigin: null,
    expectSource: null,
    verifyBytes: false,
    json: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--site') options.site = argv[++index]
    else if (arg === '--page') options.pages.push(argv[++index])
    else if (arg === '--media-origin') options.mediaOrigin = argv[++index]
    else if (arg === '--expect-source') {
      const value = argv[++index]
      if (value !== 'r2' && value !== 'supabase') throw new Error('--expect-source must be r2|supabase')
      options.expectSource = value
    } else if (arg === '--verify-bytes') options.verifyBytes = true
    else if (arg === '--json') options.json = true
    else if (arg === '--timeout') options.timeoutMs = Number(argv[++index]) * 1000
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (options.pages.length === 0) options.pages = DEFAULT_PAGES
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout must be a positive number of seconds')
  }
  return options
}

async function timedFetch(url, timeoutMs, init = {}) {
  return fetch(url, {
    ...init,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'clickit-media-health/1', ...init.headers },
  })
}

async function sha256(response) {
  const bytes = new Uint8Array(await response.arrayBuffer())
  return {
    hash: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.byteLength,
  }
}

async function checkUrl(raw, options) {
  const target = rewriteOrigin(raw, options.mediaOrigin)
  const result = { url: raw, checked: target, status: 0, ok: false }
  try {
    if (!options.verifyBytes) {
      const response = await timedFetch(target, options.timeoutMs, { method: 'HEAD' })
      result.status = response.status
      result.contentType = response.headers.get('content-type')
      result.source = response.headers.get('x-media-source')
      result.ok = response.status === 200
      return applySourceVerdict(result, options)
    }

    const [served, original] = await Promise.all([
      timedFetch(target, options.timeoutMs),
      timedFetch(supabaseOriginalUrl(raw), options.timeoutMs),
    ])
    result.status = served.status
    result.contentType = served.headers.get('content-type')
    result.source = served.headers.get('x-media-source')
    const [servedBytes, originalBytes] = await Promise.all([
      sha256(served),
      sha256(original),
    ])
    result.size = servedBytes.size
    result.bytesMatch =
      original.status === 200 && servedBytes.hash === originalBytes.hash
    result.ok = served.status === 200 && result.bytesMatch
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  return applySourceVerdict(result, options)
}

function applySourceVerdict(result, options) {
  const verdict = sourceVerdict(result, options.expectSource)
  if (!verdict.ok) {
    result.ok = false
    result.reason = verdict.reason
  }
  return result
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

export async function runMediaHealth(options) {
  const pages = []
  const urls = new Set()
  for (const path of options.pages) {
    const pageUrl = new URL(path, options.site).toString()
    try {
      const response = await timedFetch(pageUrl, options.timeoutMs)
      const html = await response.text()
      const found = extractMediaUrls(html)
      found.forEach((url) => urls.add(url))
      pages.push({ page: pageUrl, status: response.status, media: found.length })
    } catch (error) {
      pages.push({
        page: pageUrl,
        status: 0,
        media: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const results = await mapLimit([...urls].sort(), CONCURRENCY, (url) =>
    checkUrl(url, options)
  )
  const failed = results.filter((result) => !result.ok)
  const pageFailures = pages.filter((page) => page.status !== 200)
  return {
    checkedAt: new Date().toISOString(),
    site: options.site,
    mediaOrigin: options.mediaOrigin ?? `https://${MEDIA_HOST}`,
    verifyBytes: options.verifyBytes,
    pages,
    total: results.length,
    passed: results.length - failed.length,
    failed,
    ok: failed.length === 0 && pageFailures.length === 0 && results.length > 0,
    results,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const report = await runMediaHealth(options)

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    for (const page of report.pages) {
      console.log(`page ${page.status} ${page.page} (${page.media} media)`)
    }
    for (const result of report.results) {
      const bytes =
        result.bytesMatch === undefined
          ? ''
          : result.bytesMatch
            ? ' bytes=match'
            : ' bytes=MISMATCH'
      console.log(
        `${result.ok ? 'ok  ' : 'FAIL'} ${result.status} ${result.source ?? '-'}${bytes} ${result.checked}${result.error ? ` (${result.error})` : ''}${result.reason ? ` (${result.reason})` : ''}`
      )
    }
    console.log(
      `\n${report.passed}/${report.total} media URLs ok via ${report.mediaOrigin}${report.ok ? '' : ' — FAILED'}`
    )
  }

  process.exitCode = report.ok ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
