// Dry-run and checksum reports for the R2 media copy (D-03). Reports hold
// keys, sizes, hashes and counts only: no env values, no file contents.
// Pure builders plus one small writer; nothing imported from src/.

import { createHash } from 'node:crypto'
import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const REPORT_VERSION = 1

/**
 * Same identity the deploy guard compares (scripts/cf/build-target.mjs
 * loadManifestInfo): sha256 of the manifest file bytes plus the length of its
 * objects list. Read at call time; the count is never hard-coded.
 * @param {string} path
 */
export function manifestFileInfo(path) {
  const bytes = readFileSync(path)
  const parsed = JSON.parse(bytes.toString('utf8'))
  const list = Array.isArray(parsed) ? parsed : (parsed.objects ?? parsed.entries ?? parsed.items)
  if (!Array.isArray(list)) throw new Error('media manifest has no objects list')
  return {
    manifestSha256: createHash('sha256').update(bytes).digest('hex'),
    manifestObjectCount: list.length,
  }
}

function addTo(map, key, bytes) {
  const current = map.get(key) ?? { count: 0, bytes: 0 }
  current.count += 1
  current.bytes += bytes
  map.set(key, current)
}

/**
 * @param {{
 *   manifest: any,
 *   manifestSha256: string,
 *   manifestObjectCount: number,
 *   referencedNotInManifest?: Array<{ bucket: string, key: string, url: string, columns: string[] }>,
 *   generatedAt: string,
 * }} input
 */
export function buildDryRunReport(input) {
  const byType = new Map()
  const skipped = []
  const problems = []
  let plannedVariants = 0
  let remuxPlanned = 0
  const objects = input.manifest.objects.map((object) => {
    const analysis = object.analysis ?? {}
    const size = analysis.size ?? object.source?.size ?? 0
    const contentType = analysis.contentType ?? object.source?.contentType ?? 'unknown'
    addTo(byType, contentType, size)
    const planned = analysis.plannedVariants ?? []
    plannedVariants += planned.length
    if (analysis.willRemux) remuxPlanned += 1
    if (analysis.skipReason) skipped.push({ key: object.destinationKey, reason: analysis.skipReason })
    if (analysis.error) problems.push({ key: object.destinationKey, error: analysis.error })
    return {
      key: object.destinationKey,
      contentType,
      size,
      sha256: analysis.sha256 ?? null,
      width: analysis.width ?? null,
      pages: analysis.pages ?? null,
      faststart: analysis.faststart ?? null,
      willRemux: Boolean(analysis.willRemux),
      durationSeconds: analysis.durationSeconds ?? null,
      bitRate: analysis.bitRate ?? null,
      plannedVariants: planned,
      skipReason: analysis.skipReason ?? null,
      error: analysis.error ?? null,
    }
  })
  const skippedByReason = {}
  for (const { reason } of skipped) skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1
  return {
    kind: 'dry-run',
    version: REPORT_VERSION,
    generatedAt: input.generatedAt,
    manifestSha256: input.manifestSha256,
    manifestObjectCount: input.manifestObjectCount,
    sourceOrigin: input.manifest.sourceOrigin,
    destinationBucket: input.manifest.destinationBucket,
    totals: {
      objects: objects.length,
      bytes: objects.reduce((n, o) => n + o.size, 0),
      byType: Object.fromEntries(byType),
      plannedVariants,
      remuxPlanned,
      skipped: skipped.length,
      skippedByReason,
    },
    objects,
    skipped,
    problems,
    referencedNotInManifest: input.referencedNotInManifest ?? [],
  }
}

/**
 * One row per R2 object written or verified.
 * @param {{
 *   rows: any[],
 *   failures: Array<{ key: string, error: string }>,
 *   manifestSha256: string,
 *   manifestObjectCount: number,
 *   bucket: string,
 *   startedAt: string,
 *   finishedAt: string,
 *   specVersion: string,
 * }} input
 */
export function buildCopyReport(input) {
  const count = (predicate) => input.rows.filter(predicate).length
  const originals = count((r) => r.role === 'original' || r.role === 'video-remux')
  return {
    kind: 'copy',
    version: REPORT_VERSION,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    bucket: input.bucket,
    variantSpecVersion: input.specVersion,
    manifestSha256: input.manifestSha256,
    manifestObjectCount: input.manifestObjectCount,
    summary: {
      originals,
      variants: count((r) => r.role === 'variant'),
      remuxed: count((r) => r.role === 'video-remux'),
      originalsKept: count((r) => r.role === 'original-kept'),
      copiedOrWritten: count((r) => r.status !== 'skipped (identical)'),
      skippedIdentical: count((r) => r.status === 'skipped (identical)'),
      unverified: count((r) => r.verified !== true),
      failures: input.failures.length,
    },
    rows: input.rows,
    failures: input.failures,
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

/**
 * Short markdown: totals table, problems/failures, path of the JSON.
 * @param {any} report
 * @param {string} [jsonPath]
 */
export function renderReportMarkdown(report, jsonPath = '') {
  const lines = []
  if (report.kind === 'dry-run') {
    lines.push('# R2 media dry-run report', '')
    lines.push(`Manifest: ${report.manifestObjectCount} objects, sha256 ${report.manifestSha256}`)
    lines.push(`Source: ${report.sourceOrigin}, destination bucket: ${report.destinationBucket ?? 'unset'}`, '')
    lines.push('| Type | Objects | Size |', '| --- | ---: | ---: |')
    for (const [type, value] of Object.entries(report.totals.byType)) {
      lines.push(`| ${type} | ${value.count} | ${formatBytes(value.bytes)} |`)
    }
    lines.push(`| total | ${report.totals.objects} | ${formatBytes(report.totals.bytes)} |`, '')
    lines.push(`Planned variants: ${report.totals.plannedVariants}. Videos to remux (faststart): ${report.totals.remuxPlanned}.`, '')
    lines.push(`## Skipped for variants (${report.totals.skipped})`, '')
    for (const [reason, n] of Object.entries(report.totals.skippedByReason)) lines.push(`- ${n} x ${reason}`)
    if (report.totals.skipped === 0) lines.push('- none')
    lines.push('', `## Referenced in app_config but not in the manifest (${report.referencedNotInManifest.length})`, '')
    for (const ref of report.referencedNotInManifest) lines.push(`- ${ref.bucket}/${ref.key} (${ref.columns.join(', ')})`)
    if (report.referencedNotInManifest.length === 0) lines.push('- none')
    lines.push('', `## Analysis problems (${report.problems.length})`, '')
    for (const p of report.problems) lines.push(`- ${p.key}: ${p.error}`)
    if (report.problems.length === 0) lines.push('- none')
  } else {
    lines.push('# R2 media checksum report', '')
    lines.push(`Bucket: ${report.bucket}. Manifest: ${report.manifestObjectCount} objects, sha256 ${report.manifestSha256}`, '')
    lines.push('| Item | Count |', '| --- | ---: |')
    lines.push(`| originals | ${report.summary.originals} |`)
    lines.push(`| variants | ${report.summary.variants} |`)
    lines.push(`| remuxed videos | ${report.summary.remuxed} |`)
    lines.push(`| originals kept (_orig) | ${report.summary.originalsKept} |`)
    lines.push(`| copied or written | ${report.summary.copiedOrWritten} |`)
    lines.push(`| skipped (identical) | ${report.summary.skippedIdentical} |`)
    lines.push(`| unverified rows | ${report.summary.unverified} |`)
    lines.push(`| failures | ${report.summary.failures} |`, '')
    lines.push(`## Failures (${report.failures.length})`, '')
    for (const f of report.failures) lines.push(`- ${f.key}: ${f.error}`)
    if (report.failures.length === 0) lines.push('- none')
  }
  if (jsonPath) lines.push('', `Full detail: ${jsonPath}`)
  return `${lines.join('\n')}\n`
}

/**
 * Writes <prefix>-<timestamp>.json and .md; returns both paths.
 * @param {string} dir
 * @param {string} prefix
 * @param {any} report
 * @param {Date} [now]
 */
export async function writeReportFiles(dir, prefix, report, now = new Date()) {
  await fs.mkdir(dir, { recursive: true })
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const jsonPath = join(dir, `${prefix}-${stamp}.json`)
  const mdPath = join(dir, `${prefix}-${stamp}.md`)
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  await fs.writeFile(mdPath, renderReportMarkdown(report, jsonPath))
  return { jsonPath, mdPath }
}

const URL_PATTERN = /https?:\/\/[^\s"'<>\\)\]}]+/gi
const SUPABASE_PUBLIC_PREFIX = '/storage/v1/object/public/'
const MEDIA_HOST = /^(clickit-media\.[a-z0-9-]+\.workers\.dev|media\.clickitstory\.ae)$/

/**
 * Finds Supabase Storage public URLs and media-origin URLs inside any string
 * value (walks objects and arrays).
 * @param {Record<string, unknown>} row  one app_config row (only the columns that were selected)
 * @param {Set<string>} buckets  public buckets that count as media
 * @returns {Array<{ bucket: string, key: string, url: string, column: string }>}
 */
export function extractMediaReferences(row, buckets) {
  const found = []
  const visit = (value, column) => {
    if (typeof value === 'string') {
      for (const match of value.match(URL_PATTERN) ?? []) {
        const ref = parseMediaUrl(match.replace(/[.,;]+$/, ''), buckets)
        if (ref) found.push({ ...ref, column })
      }
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item, column)
    } else if (value && typeof value === 'object') {
      for (const item of Object.values(value)) visit(item, column)
    }
  }
  for (const [column, value] of Object.entries(row ?? {})) visit(value, column)
  return found
}

function parseMediaUrl(text, buckets) {
  let url
  try {
    url = new URL(text)
  } catch {
    return null
  }
  let path = null
  if (url.pathname.startsWith(SUPABASE_PUBLIC_PREFIX)) {
    path = url.pathname.slice(SUPABASE_PUBLIC_PREFIX.length)
  } else if (MEDIA_HOST.test(url.hostname)) {
    path = url.pathname.slice(1)
  }
  if (!path) return null
  let decoded
  try {
    decoded = path.split('/').map(decodeURIComponent).join('/')
  } catch {
    return null
  }
  const slash = decoded.indexOf('/')
  if (slash <= 0 || slash === decoded.length - 1) return null
  const bucket = decoded.slice(0, slash)
  if (!buckets.has(bucket)) return null
  return { bucket, key: decoded.slice(slash + 1), url: `${url.origin}${url.pathname}` }
}
