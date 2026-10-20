import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  MAX_IN_FLIGHT,
  buildVerifyReport,
  evaluateRow,
  main,
  requestFor,
  runVerify,
} from '../../scripts/media/verify-media-host.mjs'
import { checkVerifyReport } from '../../scripts/cf/deploy-guard.mjs'

const ORIGIN = 'https://clickit-media.example.workers.dev'
const reply = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers })

const original = {
  role: 'original',
  srcBucket: 'show-artwork',
  srcKey: 'dir/poster one.png',
  dstKey: 'show-artwork/dir/poster one.png',
  dstSize: 5000,
  contentType: 'image/png',
}
const variant = {
  role: 'variant',
  srcBucket: 'show-artwork',
  srcKey: 'dir/poster one.png',
  dstKey: '_v/640/avif/show-artwork/dir/poster one.png',
  dstSize: 800,
  contentType: 'image/avif',
  variantWidth: 640,
  variantFormat: 'avif',
}
const video = {
  role: 'video-remux',
  srcBucket: 'site-assets',
  srcKey: 'hero.mp4',
  dstKey: 'site-assets/hero.mp4',
  dstSize: 90000,
  contentType: 'video/mp4',
}
const svg = {
  role: 'original',
  srcBucket: 'site-assets',
  srcKey: 'logo.svg',
  dstKey: 'site-assets/logo.svg',
  dstSize: 42,
  contentType: 'image/svg+xml',
}
const kept = {
  role: 'original-kept',
  srcBucket: 'site-assets',
  srcKey: 'hero.mp4',
  dstKey: '_orig/site-assets/hero.mp4',
  dstSize: 91000,
  contentType: 'video/mp4',
}

test('02-08 verify: an original passes on HEAD 200 with matching content-length and an etag', () => {
  assert.deepEqual(
    evaluateRow(original, reply(200, { 'content-length': '5000', etag: '"abc"' })),
    { ok: true, reason: null }
  )
})

test('02-08 verify: wrong length, 404 and a missing etag fail with a reason', () => {
  const wrongLength = evaluateRow(original, reply(200, { 'content-length': '4999', etag: '"abc"' }))
  assert.equal(wrongLength.ok, false)
  assert.match(String(wrongLength.reason), /content-length/)
  const notFound = evaluateRow(original, reply(404))
  assert.equal(notFound.ok, false)
  assert.match(String(notFound.reason), /404/)
  const noEtag = evaluateRow(original, reply(200, { 'content-length': '5000' }))
  assert.equal(noEtag.ok, false)
  assert.match(String(noEtag.reason), /etag/)
})

test('02-08 verify: a variant row asks for ?w= with the matching Accept and checks type and Vary', () => {
  const req = requestFor(variant, ORIGIN)
  assert.equal(req.method, 'GET')
  assert.equal(req.url, `${ORIGIN}/show-artwork/dir/poster%20one.png?w=640`)
  assert.equal(req.headers.Accept, 'image/avif')

  assert.equal(
    evaluateRow(variant, reply(200, { 'content-type': 'image/avif', vary: 'Accept', 'content-length': '800' })).ok,
    true
  )
  const wrongType = evaluateRow(variant, reply(200, { 'content-type': 'image/png', vary: 'Accept' }))
  assert.equal(wrongType.ok, false)
  assert.match(String(wrongType.reason), /content-type/)
  const noVary = evaluateRow(variant, reply(200, { 'content-type': 'image/avif' }))
  assert.equal(noVary.ok, false)
  assert.match(String(noVary.reason), /Vary/)
})

test('02-08 verify: a video row needs 206 and content-range bytes 0-1023/<size>', () => {
  const req = requestFor(video, ORIGIN)
  assert.equal(req.method, 'GET')
  assert.equal(req.headers.Range, 'bytes=0-1023')
  assert.equal(evaluateRow(video, reply(206, { 'content-range': 'bytes 0-1023/90000' })).ok, true)
  assert.equal(evaluateRow(video, reply(200, { 'content-length': '90000' })).ok, false)
  const wrongRange = evaluateRow(video, reply(206, { 'content-range': 'bytes 0-1023/89999' }))
  assert.equal(wrongRange.ok, false)
  assert.match(String(wrongRange.reason), /content-range/)
  // A video smaller than the probe window ends at its last byte.
  assert.equal(
    evaluateRow({ ...video, dstSize: 500 }, reply(206, { 'content-range': 'bytes 0-499/500' })).ok,
    true
  )
})

test('02-08 verify: an SVG row needs sandbox in its content-security-policy', () => {
  const base = { 'content-length': '42', etag: '"s"' }
  assert.equal(
    evaluateRow(svg, reply(200, { ...base, 'content-security-policy': "default-src 'none'; sandbox" })).ok,
    true
  )
  const missing = evaluateRow(svg, reply(200, base))
  assert.equal(missing.ok, false)
  assert.match(String(missing.reason), /sandbox/)
})

test('02-08 verify: _orig/ rows are never requested and are counted separately', async () => {
  const requested: string[] = []
  const report = await runVerify({
    origin: ORIGIN,
    copyReport: { manifestSha256: 'h', rows: [original, kept], failures: [] },
    manifest: { manifestSha256: 'h', manifestObjectCount: 1 },
    fetchImpl: (async (url: string) => {
      requested.push(url)
      return url.endsWith('/x')
        ? reply(404)
        : reply(200, { 'content-length': '5000', etag: '"a"' })
    }) as unknown as typeof fetch,
  })
  assert.ok(requested.every((url) => !url.includes('_orig')))
  assert.equal(report.originalsKeptNotRequested, 1)
  assert.equal(report.originalsChecked, 1)
  assert.deepEqual(report.failures, [])
})

test('02-08 verify: the report has the fields the deploy guard consumes and passes checkVerifyReport', async () => {
  const report = await runVerify({
    origin: ORIGIN,
    copyReport: { manifestSha256: 'hash', rows: [original, variant], failures: [] },
    manifest: { manifestSha256: 'hash', manifestObjectCount: 1 },
    fetchImpl: (async (url: string) => {
      if (url.endsWith('/not-a-bucket/x')) return reply(404)
      if (url.includes('?w=')) {
        return reply(200, { 'content-type': 'image/avif', vary: 'Accept', 'content-length': '800' })
      }
      return reply(200, { 'content-length': '5000', etag: '"a"' })
    }) as unknown as typeof fetch,
    now: () => new Date('2026-10-20T10:00:00Z'),
  })
  for (const field of ['manifestSha256', 'manifestObjectCount', 'originalsChecked', 'variantsChecked', 'failures', 'origin', 'finishedAt']) {
    assert.ok(field in report, field)
  }
  assert.equal(report.originalsChecked, 1)
  assert.equal(report.variantsChecked, 1)
  assert.equal(report.origin, ORIGIN)
  assert.equal(report.finishedAt, '2026-10-20T10:00:00.000Z')
  assert.deepEqual(checkVerifyReport(report, { manifestSha256: 'hash', manifestObjectCount: 1 }), {
    ok: true,
    reasons: [],
  })
})

test('02-08 verify: failures list keys, a changed manifest and a short copy report are caught', () => {
  const report = buildVerifyReport({
    copyReport: { manifestSha256: 'old', rows: [], failures: [] },
    manifest: { manifestSha256: 'new', manifestObjectCount: 3 },
    origin: ORIGIN,
    results: [{ row: original, ok: false, reason: 'boom' }],
    negative: { ok: true, reason: null },
    finishedAt: '2026-10-20T10:00:00.000Z',
  })
  const keys = report.failures.map((f: { key: string }) => f.key)
  assert.ok(keys.includes('show-artwork/dir/poster one.png'))
  assert.ok(report.failures.some((f: { reason: string }) => /manifest changed/.test(f.reason)))
  assert.ok(report.failures.some((f: { reason: string }) => /covers 1 originals, manifest has 3/.test(f.reason)))
  assert.equal(
    checkVerifyReport(report, { manifestSha256: 'new', manifestObjectCount: 3 }).ok,
    false
  )
})

test('02-08 verify: an unknown bucket that does not return 404 is a failure', async () => {
  const report = await runVerify({
    origin: ORIGIN,
    copyReport: { manifestSha256: 'h', rows: [original], failures: [] },
    manifest: { manifestSha256: 'h', manifestObjectCount: 1 },
    fetchImpl: (async (url: string) =>
      url.endsWith('/not-a-bucket/x')
        ? reply(200)
        : reply(200, { 'content-length': '5000', etag: '"a"' })) as unknown as typeof fetch,
  })
  assert.equal(report.failures.length, 1)
  assert.equal(report.failures[0].key, '/not-a-bucket/x')
})

test('02-08 verify: at most 4 requests are in flight', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    ...original,
    dstKey: `show-artwork/p${i}.png`,
    srcKey: `p${i}.png`,
  }))
  let inFlight = 0
  let peak = 0
  const report = await runVerify({
    origin: ORIGIN,
    copyReport: { manifestSha256: 'h', rows, failures: [] },
    manifest: { manifestSha256: 'h', manifestObjectCount: 20 },
    concurrency: 50,
    fetchImpl: (async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return reply(200, { 'content-length': '5000', etag: '"a"' })
    }) as unknown as typeof fetch,
  })
  assert.ok(peak <= MAX_IN_FLIGHT, `peak ${peak}`)
  assert.equal(report.originalsChecked, 20)
})

test('02-08 verify: an http or foreign origin is refused by runVerify and by the CLI (exit 1)', async () => {
  await assert.rejects(
    runVerify({
      origin: 'http://127.0.0.1:8789',
      copyReport: { manifestSha256: 'h', rows: [], failures: [] },
      manifest: { manifestSha256: 'h', manifestObjectCount: 0 },
    }),
    /refused/
  )
  assert.equal(await main(['--origin', 'http://clickit-media.example.workers.dev', '--report', 'x.json']), 1)
  assert.equal(await main(['--origin', 'https://evil.example.com', '--report', 'x.json']), 1)
  assert.equal(await main(['--origin', ORIGIN, '--report', '/nonexistent.json']), 1)
  assert.equal(await main([]), 1)
})

test('02-08 verify: the CLI writes verify-<timestamp>.json, prints the ok line and exits 0', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'clickit-verify-'))
  try {
    const manifestPath = join(dir, 'manifest.json')
    await writeFile(manifestPath, JSON.stringify({ objects: [{ destinationKey: original.dstKey }] }))
    const { manifestFileInfo } = await import('../../scripts/media/report.mjs')
    const info = manifestFileInfo(manifestPath)
    const reportPath = join(dir, 'copy.json')
    await writeFile(
      reportPath,
      JSON.stringify({ manifestSha256: info.manifestSha256, rows: [original], failures: [] })
    )
    const lines: string[] = []
    const code = await main(
      ['--origin', ORIGIN, '--report', reportPath, '--manifest', manifestPath],
      {
        log: (line: string) => lines.push(line),
        reportDir: join(dir, 'reports'),
        fetchImpl: (async (url: string) =>
          url.endsWith('/x') ? reply(404) : reply(200, { 'content-length': '5000', etag: '"a"' })) as unknown as typeof fetch,
      }
    )
    assert.equal(code, 0)
    assert.match(lines[0], /^verify ok: 1 originals, 0 variants, 0 failures$/)
    const files = await readdir(join(dir, 'reports'))
    assert.equal(files.length, 1)
    assert.match(files[0], /^verify-.*\.json$/)
    const written = JSON.parse(await readFile(join(dir, 'reports', files[0]), 'utf8'))
    assert.equal(written.manifestObjectCount, 1)
    assert.deepEqual(written.failures, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
