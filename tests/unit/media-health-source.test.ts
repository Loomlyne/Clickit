import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { sourceVerdict, parseArgs, runMediaHealth } from '../../scripts/media-health.mjs'

// ---- pure verdict

test('sourceVerdict passes r2 when r2 is expected', () => {
  assert.equal(sourceVerdict({ source: 'r2' }, 'r2').ok, true)
})

test('sourceVerdict fails supabase and a missing header when r2 is expected, with the plan wording', () => {
  const sb = sourceVerdict({ source: 'supabase' }, 'r2')
  assert.equal(sb.ok, false)
  assert.equal(sb.reason, 'x-media-source supabase, expected r2')
  assert.equal(sourceVerdict({ source: null }, 'r2').ok, false)
  assert.equal(sourceVerdict({}, 'r2').ok, false)
  assert.match(sourceVerdict({}, 'r2').reason, /expected r2/)
})

test('sourceVerdict with expected supabase mirrors it, and no expectation never fails', () => {
  assert.equal(sourceVerdict({ source: 'supabase' }, 'supabase').ok, true)
  assert.equal(sourceVerdict({ source: 'r2' }, 'supabase').ok, false)
  assert.equal(sourceVerdict({ source: 'supabase' }, null).ok, true)
  assert.equal(sourceVerdict({}, undefined).ok, true)
})

// ---- flag parsing

test('parseArgs reads --expect-source r2|supabase and rejects other values', () => {
  assert.equal(parseArgs(['--expect-source', 'r2']).expectSource, 'r2')
  assert.equal(parseArgs(['--expect-source', 'supabase']).expectSource, 'supabase')
  assert.equal(parseArgs([]).expectSource, null)
  assert.throws(() => parseArgs(['--expect-source', 'cdn']), /r2\|supabase/)
  assert.throws(() => parseArgs(['--expect-source']), /r2\|supabase/)
})

test('parseArgs keeps the existing flags working', () => {
  const o = parseArgs(['--site', 'https://x.example', '--page', '/a', '--json', '--timeout', '5'])
  assert.equal(o.site, 'https://x.example')
  assert.deepEqual(o.pages, ['/a'])
  assert.equal(o.json, true)
  assert.equal(o.timeoutMs, 5000)
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument/)
})

// ---- end to end against a local server (no external network)

let server: http.Server
let origin = ''
let sourceHeader: string | null = 'r2'

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/en') {
      res.setHeader('content-type', 'text/html')
      res.end('<img src="https://media.clickitstory.ae/show-artwork/a.webp">')
      return
    }
    if (req.url?.startsWith('/show-artwork/')) {
      res.setHeader('content-type', 'image/webp')
      if (sourceHeader) res.setHeader('x-media-source', sourceHeader)
      res.end(req.method === 'HEAD' ? undefined : 'bytes')
      return
    }
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => {
  server.close()
})

function options(over: Record<string, unknown> = {}) {
  return { site: origin, pages: ['/en'], mediaOrigin: origin, verifyBytes: false, json: false, timeoutMs: 5000, ...over }
}

test('runMediaHealth with expectSource r2: an r2 answer passes', async () => {
  sourceHeader = 'r2'
  const report = await runMediaHealth(options({ expectSource: 'r2' }))
  assert.equal(report.ok, true)
  assert.equal(report.total, 1)
})

test('runMediaHealth with expectSource r2: a supabase answer fails with the reason', async () => {
  sourceHeader = 'supabase'
  const report = await runMediaHealth(options({ expectSource: 'r2' }))
  assert.equal(report.ok, false)
  assert.equal(report.failed.length, 1)
  assert.equal(report.failed[0].status, 200)
  assert.equal(report.failed[0].reason, 'x-media-source supabase, expected r2')
})

test('runMediaHealth with expectSource r2: a missing header fails', async () => {
  sourceHeader = null
  const report = await runMediaHealth(options({ expectSource: 'r2' }))
  assert.equal(report.ok, false)
  assert.match(report.failed[0].reason, /expected r2/)
})

test('runMediaHealth without expectSource behaves as before (status 200 is enough)', async () => {
  sourceHeader = 'supabase'
  const report = await runMediaHealth(options())
  assert.equal(report.ok, true)
  sourceHeader = null
  assert.equal((await runMediaHealth(options({ expectSource: null }))).ok, true)
})
