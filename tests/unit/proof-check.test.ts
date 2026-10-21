import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  judgeSite,
  judgeApex,
  judgeCert,
  judgeHttpRedirect,
  judgeMedia,
  parseArgs,
  run,
} from '../../scripts/cutover/proof-check.mjs'

type Res = { status: number; headers: Record<string, string>; certificate?: unknown }

const workerHeaders = {
  server: 'cloudflare',
  'cf-ray': '9f1c2d3e4f5a6b7c-MRS',
  'x-clickit-runtime': 'workers',
  'content-type': 'text/html',
}
const proxiedOldHostHeaders = {
  server: 'cloudflare',
  'cf-ray': '9f1c2d3e4f5a6b7c-MRS',
  'x-vercel-id': 'fra1::abcde-1234567890-abcdef123456',
  'x-vercel-cache': 'MISS',
}
const worker = (over: Partial<Res> = {}): Res => ({ status: 200, headers: { ...workerHeaders }, ...over })
const without = (h: Record<string, string>, key: string) => {
  const copy = { ...h }
  delete copy[key]
  return copy
}

// ---- judgeSite

test('judgeSite worker: passes on 200, cloudflare, cf-ray, marker, no old-host ids', () => {
  assert.equal(judgeSite('worker', worker()).ok, true)
})

test('judgeSite worker: Cloudflare proxying the old host is not a Worker answer', () => {
  const r = judgeSite('worker', { status: 200, headers: { ...workerHeaders, ...proxiedOldHostHeaders } })
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x: string) => x.includes('x-vercel-id')))
})

test('judgeSite worker: x-vercel-cache alone fails', () => {
  const r = judgeSite('worker', { status: 200, headers: { ...workerHeaders, 'x-vercel-cache': 'HIT' } })
  assert.equal(r.ok, false)
})

test('judgeSite worker: missing marker, cf-ray, wrong server or status each fail', () => {
  assert.equal(judgeSite('worker', worker({ headers: without(workerHeaders, 'x-clickit-runtime') })).ok, false)
  assert.equal(judgeSite('worker', worker({ headers: without(workerHeaders, 'cf-ray') })).ok, false)
  assert.equal(judgeSite('worker', worker({ headers: { ...workerHeaders, server: 'Vercel' } })).ok, false)
  assert.equal(judgeSite('worker', worker({ status: 500 })).ok, false)
  assert.equal(judgeSite('worker', worker({ headers: { ...workerHeaders, 'x-clickit-runtime': 'vercel' } })).ok, false)
})

test('judgeSite worker: header names are case-insensitive and Headers objects work', () => {
  const h = new Headers({ Server: 'cloudflare', 'CF-Ray': 'abc-MRS', 'X-Clickit-Runtime': 'workers' })
  assert.equal(judgeSite('worker', { status: 200, headers: h }).ok, true)
})

test('judgeSite vercel: passes only with x-vercel-id present and 200', () => {
  assert.equal(judgeSite('vercel', { status: 200, headers: proxiedOldHostHeaders }).ok, true)
  assert.equal(judgeSite('vercel', { status: 200, headers: workerHeaders }).ok, false)
  assert.equal(judgeSite('vercel', { status: 503, headers: proxiedOldHostHeaders }).ok, false)
})

test('judgeSite refuses an unknown expectation', () => {
  assert.throws(() => judgeSite('both', worker()), /worker or vercel/)
})

// ---- judgeApex

test('judgeApex: 301 to the exact www /en URL passes', () => {
  const r = judgeApex({ status: 301, headers: { location: 'https://www.clickitstory.ae/en', server: 'cloudflare' } })
  assert.equal(r.ok, true)
})

test('judgeApex: wrong status, wrong or relative location fail', () => {
  assert.equal(judgeApex({ status: 302, headers: { location: 'https://www.clickitstory.ae/en' } }).ok, false)
  assert.equal(judgeApex({ status: 301, headers: { location: 'https://www.clickitstory.ae/' } }).ok, false)
  assert.equal(judgeApex({ status: 301, headers: { location: 'http://www.clickitstory.ae/en' } }).ok, false)
  assert.equal(judgeApex({ status: 301, headers: { location: '/en' } }).ok, false)
  assert.equal(judgeApex({ status: 301, headers: {} }).ok, false)
})

test('judgeApex: requireCloudflare also wants server cloudflare', () => {
  const ok = { status: 301, headers: { location: 'https://www.clickitstory.ae/en', server: 'cloudflare' } }
  const noServer = { status: 301, headers: { location: 'https://www.clickitstory.ae/en', server: 'nginx' } }
  assert.equal(judgeApex(ok, { requireCloudflare: true }).ok, true)
  assert.equal(judgeApex(noServer, { requireCloudflare: true }).ok, false)
  assert.equal(judgeApex(noServer).ok, true)
})

// ---- judgeHttpRedirect and judgeMedia

test('judgeHttpRedirect: 301 to an https location on the apex or www passes', () => {
  assert.equal(judgeHttpRedirect({ status: 301, headers: { location: 'https://clickitstory.ae/' } }, 'clickitstory.ae').ok, true)
  assert.equal(judgeHttpRedirect({ status: 301, headers: { location: 'https://www.clickitstory.ae/' } }, 'clickitstory.ae').ok, true)
  assert.equal(judgeHttpRedirect({ status: 301, headers: { location: 'http://clickitstory.ae/' } }, 'clickitstory.ae').ok, false)
  assert.equal(judgeHttpRedirect({ status: 200, headers: {} }, 'clickitstory.ae').ok, false)
  assert.equal(judgeHttpRedirect({ status: 301, headers: { location: 'https://evil.example/' } }, 'clickitstory.ae').ok, false)
})

test('judgeMedia: 404 from cloudflare passes, anything else fails', () => {
  assert.equal(judgeMedia({ status: 404, headers: { server: 'cloudflare' } }).ok, true)
  assert.equal(judgeMedia({ status: 200, headers: { server: 'cloudflare' } }).ok, false)
  assert.equal(judgeMedia({ status: 404, headers: { server: 'AmazonS3' } }).ok, false)
})

// ---- judgeCert

const NOW = Date.parse('2026-10-21T12:00:00Z')

test('judgeCert: under 14 days fails and reports the days left', () => {
  const r = judgeCert({ validTo: 'Nov 1 12:00:00 2026 GMT', now: NOW, minDays: 14 })
  assert.equal(r.ok, false)
  assert.equal(r.daysLeft, 11)
  assert.match(r.reason, /11 days/)
})

test('judgeCert: 14 days or more passes', () => {
  const r = judgeCert({ validTo: 'Jan 18 10:00:00 2027 GMT', now: NOW, minDays: 14 })
  assert.equal(r.ok, true)
  assert.equal(r.daysLeft, 88)
  assert.equal(judgeCert({ validTo: 'Nov 4 12:00:00 2026 GMT', now: NOW, minDays: 14 }).ok, true)
})

test('judgeCert: an expired, missing or unreadable date fails', () => {
  assert.equal(judgeCert({ validTo: 'Oct 1 12:00:00 2026 GMT', now: NOW, minDays: 14 }).ok, false)
  assert.equal(judgeCert({ validTo: undefined, now: NOW, minDays: 14 }).ok, false)
  assert.equal(judgeCert({ validTo: 'not a date', now: NOW, minDays: 14 }).ok, false)
})

// ---- parseArgs

test('parseArgs: defaults and the required --expect', () => {
  const a = parseArgs(['--expect', 'worker'])
  assert.equal(a.expect, 'worker')
  assert.equal(a.site, 'https://www.clickitstory.ae')
  assert.equal(a.sitePath, '/en')
  assert.equal(a.apex, 'https://clickitstory.ae')
  assert.equal(a.media, 'https://media.clickitstory.ae')
  assert.equal(a.minCertDays, 14)
  assert.equal(a.resolveIp, null)
  assert.equal(a.vercelIp, null)
})

test('parseArgs: rejects a missing or unknown --expect', () => {
  assert.throws(() => parseArgs([]), /--expect/)
  assert.throws(() => parseArgs(['--expect', 'both']), /worker\|vercel/)
})

test('parseArgs: --site, --apex and --media must be https', () => {
  assert.throws(() => parseArgs(['--expect', 'worker', '--site', 'http://www.clickitstory.ae']), /https/)
  assert.throws(() => parseArgs(['--expect', 'worker', '--site', 'not a url']), /https/)
  assert.throws(() => parseArgs(['--expect', 'worker', '--media', 'http://media.clickitstory.ae']), /https/)
  assert.equal(parseArgs(['--expect', 'worker', '--site', 'https://clickit.example.workers.dev']).site, 'https://clickit.example.workers.dev')
})

test('parseArgs: --site-path needs a single leading slash', () => {
  assert.equal(parseArgs(['--expect', 'vercel', '--site-path', '/en/portfolio']).sitePath, '/en/portfolio')
  assert.throws(() => parseArgs(['--expect', 'vercel', '--site-path', 'en']), /--site-path/)
  assert.throws(() => parseArgs(['--expect', 'vercel', '--site-path', '//evil.example/x']), /--site-path/)
})

test('parseArgs: --resolve-ip and --vercel-ip must be IP addresses, unknown flags are refused', () => {
  assert.equal(parseArgs(['--expect', 'worker', '--resolve-ip', '104.21.29.215']).resolveIp, '104.21.29.215')
  assert.equal(parseArgs(['--expect', 'vercel', '--vercel-ip', '216.198.79.1']).vercelIp, '216.198.79.1')
  assert.throws(() => parseArgs(['--expect', 'worker', '--resolve-ip', 'example.com']), /IP/)
  assert.throws(() => parseArgs(['--expect', 'worker', '--bogus']), /unknown argument/)
  assert.throws(() => parseArgs(['--expect', 'worker', '--min-cert-days', 'x']), /min-cert-days/)
})

// ---- run (injected request, no network)

type Call = { url: string; ip?: string | null }

function fakeRequest(responses: Record<string, Res>, calls: Call[]) {
  return async (url: string, opts: { ip?: string | null } = {}) => {
    calls.push({ url, ip: opts.ip ?? null })
    const hit = responses[url]
    if (!hit) throw new Error(`unexpected request ${url}`)
    return hit
  }
}

const cert = (validTo: string) => ({ validTo, issuer: 'CN=WE1', subjectaltname: 'DNS:*.clickitstory.ae' })

function workerWorld(validTo = 'Jan 18 10:00:00 2027 GMT') {
  return {
    'https://www.clickitstory.ae/en': { ...worker(), certificate: cert(validTo) },
    'https://clickitstory.ae/en': { status: 301, headers: { location: 'https://www.clickitstory.ae/en', server: 'cloudflare' } },
    'http://clickitstory.ae/': { status: 301, headers: { location: 'https://clickitstory.ae/', server: 'cloudflare' } },
    'https://media.clickitstory.ae/': { status: 404, headers: { server: 'cloudflare' } },
  } as Record<string, Res>
}

test('run: all checks pass for a Worker answer, pins only the site host', async () => {
  const calls: Call[] = []
  const lines: string[] = []
  const opts = parseArgs(['--expect', 'worker', '--resolve-ip', '104.21.29.215'])
  const code = await run(opts, { request: fakeRequest(workerWorld(), calls), now: () => NOW, out: (l: string) => lines.push(l) })
  assert.equal(code, 0)
  assert.equal(lines.at(-1), 'proof-check worker: ALL PASS')
  assert.equal(lines.filter((l) => l.startsWith('PASS')).length, 5)
  const site = calls.find((c) => c.url === 'https://www.clickitstory.ae/en')
  assert.equal(site?.ip, '104.21.29.215')
  for (const c of calls.filter((c) => c.url !== 'https://www.clickitstory.ae/en')) assert.equal(c.ip, null)
})

test('run: --site-path changes only the site probe, the apex probe stays /en', async () => {
  const world = workerWorld()
  world['https://www.clickitstory.ae/en/portfolio'] = world['https://www.clickitstory.ae/en']
  const calls: Call[] = []
  const lines: string[] = []
  const opts = parseArgs(['--expect', 'worker', '--site-path', '/en/portfolio'])
  const code = await run(opts, { request: fakeRequest(world, calls), now: () => NOW, out: (l: string) => lines.push(l) })
  assert.equal(code, 0)
  assert.ok(calls.some((c) => c.url === 'https://www.clickitstory.ae/en/portfolio'))
  assert.ok(calls.some((c) => c.url === 'https://clickitstory.ae/en'))
})

test('run: a short certificate fails the run with exit 1', async () => {
  const lines: string[] = []
  const opts = parseArgs(['--expect', 'worker'])
  const code = await run(opts, {
    request: fakeRequest(workerWorld('Nov 1 12:00:00 2026 GMT'), []),
    now: () => NOW,
    out: (l: string) => lines.push(l),
  })
  assert.equal(code, 1)
  assert.ok(lines.some((l) => l.startsWith('FAIL') && l.includes('cert')))
  assert.ok(!lines.some((l) => l.includes('ALL PASS')))
})

test('run: --expect vercel passes on an old-host answer and prints the old-host cert line', async () => {
  const world = workerWorld()
  world['https://www.clickitstory.ae/en'] = { status: 200, headers: proxiedOldHostHeaders, certificate: cert('Jan 18 10:00:00 2027 GMT') }
  const calls: Call[] = []
  const lines: string[] = []
  // The second site request is the one pinned to the old host's IP.
  const request = async (url: string, o: { ip?: string | null } = {}) => {
    calls.push({ url, ip: o.ip ?? null })
    if (url === 'https://www.clickitstory.ae/en' && o.ip === '216.198.79.1') {
      return { status: 200, headers: proxiedOldHostHeaders, certificate: cert('Dec 29 02:45:11 2026 GMT') }
    }
    return world[url]
  }
  const opts = parseArgs(['--expect', 'vercel', '--vercel-ip', '216.198.79.1'])
  const code = await run(opts, { request, now: () => NOW, out: (l: string) => lines.push(l) })
  assert.equal(code, 0)
  assert.equal(lines.at(-1), 'proof-check vercel: ALL PASS')
  const info = lines.find((l) => l.includes('rollback'))
  assert.ok(info, 'expected a rollback ceiling line')
  assert.match(info, /Dec 29 02:45:11 2026 GMT/)
  assert.match(info, /68 days/)
})

test('run: a request error is a FAIL line, not a crash', async () => {
  const lines: string[] = []
  const opts = parseArgs(['--expect', 'worker'])
  const code = await run(opts, {
    request: async () => {
      throw new Error('connect ECONNREFUSED')
    },
    now: () => NOW,
    out: (l: string) => lines.push(l),
  })
  assert.equal(code, 1)
  assert.ok(lines.some((l) => l.startsWith('FAIL') && l.includes('ECONNREFUSED')))
})
