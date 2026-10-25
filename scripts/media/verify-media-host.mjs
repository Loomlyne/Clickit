#!/usr/bin/env node
// Verifies every object from a copy report against the media Worker origin
// (D-03, MEDIA-04/05/06). Read-only: GET and HEAD against the public host, no
// R2 access, no secrets. Writes .tmp/r2-media-reports/verify-<timestamp>.json
// in the shape scripts/cf/deploy-guard.mjs checkVerifyReport consumes:
//   { manifestSha256, manifestObjectCount, originalsChecked, variantsChecked,
//     failures, origin, finishedAt }
//
//   node scripts/media/verify-media-host.mjs --origin https://clickit-media.<sub>.workers.dev \
//     --report .tmp/r2-media-reports/copy-<timestamp>.json [--manifest <path>]

import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAllowedMediaOrigin } from '../cf/deploy-guard.mjs'
import { manifestFileInfo } from './report.mjs'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_MANIFEST_PATH = resolve(PROJECT_ROOT, '.tmp/r2-media-manifest.json')
const DEFAULT_REPORT_DIR = resolve(PROJECT_ROOT, '.tmp/r2-media-reports')
export const MAX_IN_FLIGHT = 4
const RANGE_END = 1023
const REQUEST_TIMEOUT_MS = 30_000

function encodePath(bucketKey) {
  return bucketKey.split('/').map(encodeURIComponent).join('/')
}

function isVideo(row) {
  return String(row.contentType ?? '').toLowerCase().startsWith('video/')
}

function isSvg(row) {
  return String(row.contentType ?? '').toLowerCase().startsWith('image/svg+xml')
}

/** Rows that are checked against the host (everything except _orig/). */
export function isServedRow(row) {
  return row.role !== 'original-kept'
}

/**
 * The request that proves one row.
 * @param {any} row  copy report row
 * @param {string} origin  https media origin
 * @returns {{ url: string, method: 'GET' | 'HEAD', headers: Record<string, string> }}
 */
export function requestFor(row, origin) {
  const base = new URL(origin).origin
  if (row.role === 'variant') {
    const path = encodePath(`${row.srcBucket}/${row.srcKey}`)
    return {
      url: `${base}/${path}?w=${row.variantWidth}`,
      method: 'GET',
      headers: { Accept: `image/${row.variantFormat}` },
    }
  }
  const url = `${base}/${encodePath(row.dstKey)}`
  if (isVideo(row)) return { url, method: 'GET', headers: { Range: `bytes=0-${RANGE_END}` } }
  return { url, method: 'HEAD', headers: {} }
}

/**
 * @param {any} row  copy report row (not an _orig/ row)
 * @param {{ status: number, headers: { get(name: string): string | null } }} response
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function evaluateRow(row, response) {
  const fail = (reason) => ({ ok: false, reason })
  const header = (name) => response.headers.get(name)

  if (row.role === 'variant') {
    if (response.status !== 200) return fail(`variant returned HTTP ${response.status}`)
    const expected = `image/${row.variantFormat}`
    if (String(header('content-type') ?? '').split(';')[0].trim().toLowerCase() !== expected) {
      return fail(`variant content-type is ${header('content-type') ?? 'missing'}, expected ${expected}`)
    }
    if (!/\baccept\b/i.test(header('vary') ?? '')) return fail('variant response has no Vary: Accept')
    const length = header('content-length')
    if (length !== null && Number(length) !== row.dstSize) {
      return fail(`variant content-length ${length} differs from ${row.dstSize}`)
    }
    return { ok: true, reason: null }
  }

  if (isVideo(row)) {
    if (response.status !== 206) return fail(`video range request returned HTTP ${response.status}, expected 206`)
    const end = Math.min(RANGE_END, row.dstSize - 1)
    const expected = `bytes 0-${end}/${row.dstSize}`
    if (header('content-range') !== expected) {
      return fail(`video content-range is ${header('content-range') ?? 'missing'}, expected ${expected}`)
    }
    return { ok: true, reason: null }
  }

  if (response.status !== 200) return fail(`HEAD returned HTTP ${response.status}`)
  if (Number(header('content-length')) !== row.dstSize || header('content-length') === null) {
    return fail(`content-length ${header('content-length') ?? 'missing'} differs from ${row.dstSize}`)
  }
  if (!header('etag')) return fail('response has no etag')
  if (isSvg(row) && !/\bsandbox\b/i.test(header('content-security-policy') ?? '')) {
    return fail('svg response has no sandbox in content-security-policy')
  }
  return { ok: true, reason: null }
}

/**
 * @param {{
 *   copyReport: any,
 *   manifest: { manifestSha256: string, manifestObjectCount: number },
 *   origin: string,
 *   results: Array<{ row: any, ok: boolean, reason: string | null }>,
 *   negative?: { ok: boolean, reason: string | null } | null,
 *   finishedAt: string,
 * }} input
 */
export function buildVerifyReport(input) {
  const failures = []
  for (const result of input.results) {
    if (!result.ok) failures.push({ key: result.row.dstKey, reason: result.reason })
  }
  const served = input.results.map((result) => result.row)
  const originalsChecked = served.filter((r) => r.role === 'original' || r.role === 'video-remux').length
  const variantsChecked = served.filter((r) => r.role === 'variant').length

  if (input.copyReport.manifestSha256 !== input.manifest.manifestSha256) {
    failures.push({ key: '(manifest)', reason: 'manifest changed since the copy report was written' })
  }
  if (originalsChecked !== input.manifest.manifestObjectCount) {
    failures.push({
      key: '(manifest)',
      reason: `copy report covers ${originalsChecked} originals, manifest has ${input.manifest.manifestObjectCount}`,
    })
  }
  if ((input.copyReport.failures ?? []).length > 0) {
    failures.push({ key: '(copy report)', reason: `the copy itself reported ${input.copyReport.failures.length} failure(s)` })
  }
  if (input.negative && !input.negative.ok) {
    failures.push({ key: '/not-a-bucket/x', reason: input.negative.reason })
  }
  return {
    manifestSha256: input.manifest.manifestSha256,
    manifestObjectCount: input.manifest.manifestObjectCount,
    originalsChecked,
    variantsChecked,
    originalsKeptNotRequested: (input.copyReport.rows ?? []).filter((r) => r.role === 'original-kept').length,
    negativeChecked: Boolean(input.negative),
    failures,
    origin: new URL(input.origin).origin,
    finishedAt: input.finishedAt,
  }
}

async function request(fetchImpl, { url, method, headers }) {
  const response = await fetchImpl(url, {
    method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  // Headers are enough; do not download media bodies.
  await response.body?.cancel?.()
  return response
}

/**
 * Runs the checks, at most `concurrency` requests at a time.
 */
export async function runVerify({
  origin,
  copyReport,
  manifest,
  fetchImpl = fetch,
  concurrency = MAX_IN_FLIGHT,
  now = () => new Date(),
}) {
  if (!isAllowedMediaOrigin(origin)) {
    throw new Error('refused: origin must be https and a clickit-media[-r2].<sub>.workers.dev or media.clickitstory.ae host')
  }
  const rows = (copyReport.rows ?? []).filter(isServedRow)
  const results = new Array(rows.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const index = next++
      if (index >= rows.length) return
      const row = rows[index]
      try {
        const response = await request(fetchImpl, requestFor(row, origin))
        results[index] = { row, ...evaluateRow(row, response) }
      } catch (error) {
        results[index] = { row, ok: false, reason: `request failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, MAX_IN_FLIGHT)) }, worker))

  let negative
  try {
    const response = await request(fetchImpl, {
      url: `${new URL(origin).origin}/not-a-bucket/x`,
      method: 'GET',
      headers: {},
    })
    negative =
      response.status === 404
        ? { ok: true, reason: null }
        : { ok: false, reason: `unknown bucket returned HTTP ${response.status}, expected 404` }
  } catch (error) {
    negative = { ok: false, reason: `request failed: ${error instanceof Error ? error.message : String(error)}` }
  }

  return buildVerifyReport({ copyReport, manifest, origin, results, negative, finishedAt: now().toISOString() })
}

function readOption(argv, name) {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const log = deps.log ?? console.log
  const origin = readOption(argv, '--origin')
  const reportPath = readOption(argv, '--report')
  if (!origin || !reportPath) {
    console.error('usage: verify-media-host.mjs --origin <https origin> --report <copy report json> [--manifest <path>]')
    return 1
  }
  if (!isAllowedMediaOrigin(origin)) {
    console.error('refused: origin must be https and a clickit-media[-r2].<sub>.workers.dev or media.clickitstory.ae host')
    return 1
  }
  let copyReport
  let manifest
  try {
    copyReport = JSON.parse(await fs.readFile(resolve(PROJECT_ROOT, reportPath), 'utf8'))
    manifest = manifestFileInfo(resolve(PROJECT_ROOT, readOption(argv, '--manifest') ?? DEFAULT_MANIFEST_PATH))
  } catch (error) {
    console.error(`cannot read inputs: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
  const report = await runVerify({ origin, copyReport, manifest, fetchImpl: deps.fetchImpl })
  const reportDir = deps.reportDir ?? DEFAULT_REPORT_DIR
  await fs.mkdir(reportDir, { recursive: true })
  const path = resolve(reportDir, `verify-${report.finishedAt.replace(/[:.]/g, '-')}.json`)
  await fs.writeFile(path, `${JSON.stringify(report, null, 2)}\n`)
  if (report.failures.length > 0) {
    log(`verify FAILED: ${report.failures.length} failure(s)`)
    for (const failure of report.failures) log(`  ${failure.key}`)
    log(`Verify report: ${path}`)
    return 1
  }
  log(`verify ok: ${report.originalsChecked} originals, ${report.variantsChecked} variants, 0 failures`)
  log(`Verify report: ${path}`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  )
}
