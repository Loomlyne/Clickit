import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  findLegacyAnonKey,
  findPublishableKey,
  judgeKeys,
  judgeCaptchaProbe,
  redact,
  parseArgs,
  run,
} from '../../scripts/cutover/keys-check.mjs'

// No literal key in this file: every token below is built at run time from
// encoded JSON parts and a fake signature, and the publishable shape is joined
// from pieces. Nothing here is a credential.
const REF = 'lajguozmtissnnfccmej'
const b64u = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (payload: Record<string, unknown>) =>
  [b64u({ alg: 'HS256', typ: 'JWT' }), b64u(payload), Buffer.from('fake-signature-bytes').toString('base64url')].join('.')
const anon = (ref = REF) => jwt({ iss: 'supabase', ref, role: 'anon', exp: 2_000_000_000 })
const serviceRole = (ref = REF) => jwt({ iss: 'supabase', ref, role: 'service_role', exp: 2_000_000_000 })
const publishable = (tail = 'Ab12_cd-34EfGh56IjKl') => ['sb', 'publishable', tail].join('_')
const secretShape = (tail = 'Zz99Yy88Xx77Ww66') => ['sb', 'secret', tail].join('_')

// ---- findLegacyAnonKey

test('findLegacyAnonKey returns the anon token for the project ref', () => {
  const key = anon()
  const found = findLegacyAnonKey([`x=1;const k="${key}";y=2`], REF)
  assert.equal(found, key)
})

test('findLegacyAnonKey ignores service_role and other-project tokens', () => {
  const texts = [`a="${serviceRole()}"`, `b="${anon('otherprojectrefxxxxxx')}"`]
  assert.equal(findLegacyAnonKey(texts, REF), null)
})

test('findLegacyAnonKey picks the right token among several in one text', () => {
  const key = anon()
  const text = `"${serviceRole()}" ... "${anon('otherprojectrefxxxxxx')}" ... "${key}"`
  assert.equal(findLegacyAnonKey([text], REF), key)
})

test('findLegacyAnonKey returns null for no token, for junk and for undecodable payloads', () => {
  assert.equal(findLegacyAnonKey([], REF), null)
  assert.equal(findLegacyAnonKey(['no tokens here'], REF), null)
  const junk = [b64u({ alg: 'x' }), '!!!notbase64json!!!', 'sig'].join('.')
  assert.equal(findLegacyAnonKey([junk], REF), null)
  const notJson = [b64u({ alg: 'x' }), Buffer.from('plain text, not json').toString('base64url'), 'sig'].join('.')
  assert.equal(findLegacyAnonKey([notJson], REF), null)
})

// ---- findPublishableKey

test('findPublishableKey returns the first publishable-shaped string', () => {
  const first = publishable()
  const second = publishable('Second0123456789')
  assert.equal(findPublishableKey([`x "${first}" y "${second}"`]), first)
})

test('findPublishableKey never matches the secret shape and returns null when absent', () => {
  assert.equal(findPublishableKey([`k="${secretShape()}"`]), null)
  assert.equal(findPublishableKey(['nothing']), null)
  assert.equal(findPublishableKey([]), null)
})

// ---- judgeKeys

test('judgeKeys legacy-on: both 200 passes', () => {
  assert.equal(judgeKeys({ expect: 'legacy-on', legacy: 200, publishable: 200 }).ok, true)
})

test('judgeKeys legacy-off: legacy 401 and publishable 200 passes', () => {
  assert.equal(judgeKeys({ expect: 'legacy-off', legacy: 401, publishable: 200 }).ok, true)
})

test('judgeKeys legacy-off: legacy 200 fails (key still alive)', () => {
  const r = judgeKeys({ expect: 'legacy-off', legacy: 200, publishable: 200 })
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x: string) => x.includes('legacy')))
})

test('judgeKeys legacy-on: legacy 401 fails', () => {
  assert.equal(judgeKeys({ expect: 'legacy-on', legacy: 401, publishable: 200 }).ok, false)
})

test('judgeKeys: a publishable status other than 200 always fails', () => {
  assert.equal(judgeKeys({ expect: 'legacy-on', legacy: 200, publishable: 401 }).ok, false)
  assert.equal(judgeKeys({ expect: 'legacy-off', legacy: 401, publishable: 500 }).ok, false)
})

test('judgeKeys: a missing key fails with a reason naming it', () => {
  const noLegacy = judgeKeys({ expect: 'legacy-off', legacy: null, publishable: 200 })
  assert.equal(noLegacy.ok, false)
  assert.ok(noLegacy.reasons.some((x: string) => /legacy/.test(x) && /not found/.test(x)))
  const noPub = judgeKeys({ expect: 'legacy-on', legacy: 200, publishable: undefined })
  assert.equal(noPub.ok, false)
  assert.ok(noPub.reasons.some((x: string) => /publishable/.test(x) && /not found/.test(x)))
})

test('judgeKeys refuses an unknown expectation', () => {
  assert.throws(() => judgeKeys({ expect: 'maybe', legacy: 200, publishable: 200 }), /legacy-on or legacy-off/)
})

// ---- judgeCaptchaProbe

test('judgeCaptchaProbe off: 400 invalid login credentials passes', () => {
  assert.equal(judgeCaptchaProbe({ expect: 'off', status: 400, body: 'Invalid login credentials' }).ok, true)
})

test('judgeCaptchaProbe off: a captcha refusal fails', () => {
  const body = '{"code":400,"error_code":"captcha_failed","msg":"captcha protection: request disallowed (no captcha_token found)"}'
  assert.equal(judgeCaptchaProbe({ expect: 'off', status: 400, body }).ok, false)
})

test('judgeCaptchaProbe on: a captcha 400 passes, a plain wrong-login fails', () => {
  const body = '{"code":400,"msg":"captcha protection: request disallowed (no captcha_token found)"}'
  assert.equal(judgeCaptchaProbe({ expect: 'on', status: 400, body }).ok, true)
  const plain = judgeCaptchaProbe({ expect: 'on', status: 400, body: '{"msg":"Invalid login credentials"}' })
  assert.equal(plain.ok, false)
  assert.ok(plain.reasons.some((x: string) => /captcha/.test(x)))
})

test('judgeCaptchaProbe: other statuses (429, 500) never pass, unknown expectation throws', () => {
  assert.equal(judgeCaptchaProbe({ expect: 'on', status: 429, body: 'captcha' }).ok, false)
  assert.equal(judgeCaptchaProbe({ expect: 'off', status: 500, body: 'Invalid login credentials' }).ok, false)
  assert.throws(() => judgeCaptchaProbe({ expect: 'x', status: 400, body: '' }), /on or off/)
})

// ---- redact

test('redact shows at most 8 characters and the length, never the rest', () => {
  const key = anon()
  const shown = redact(key)
  assert.ok(shown.startsWith(key.slice(0, 8)))
  assert.ok(shown.includes(String(key.length)))
  assert.ok(!shown.includes(key.slice(0, 20)))
  assert.equal(redact(''), '(empty)')
  assert.equal(redact(undefined), '(none)')
})

// ---- parseArgs

test('parseArgs: needs --expect, --captcha-probe or --extract-only', () => {
  assert.throws(() => parseArgs([]), /--expect|--captcha-probe|--extract-only/)
  assert.equal(parseArgs(['--expect', 'legacy-on']).expect, 'legacy-on')
  assert.equal(parseArgs(['--captcha-probe', 'off']).captchaProbe, 'off')
  assert.equal(parseArgs(['--extract-only']).extractOnly, true)
})

test('parseArgs: validates values, https worker site, IP and refuses unknown flags', () => {
  assert.throws(() => parseArgs(['--expect', 'maybe']), /legacy-on\|legacy-off/)
  assert.throws(() => parseArgs(['--captcha-probe', 'maybe']), /off\|on/)
  assert.throws(() => parseArgs(['--expect', 'legacy-on', '--worker-site', 'http://x.example']), /https/)
  assert.throws(() => parseArgs(['--expect', 'legacy-on', '--legacy-ip', 'host.example']), /IP/)
  assert.throws(() => parseArgs(['--expect', 'legacy-on', '--token', 'x']), /unknown argument/)
  assert.throws(() => parseArgs(['--extract-only', '--captcha-probe', 'off']), /extract-only/)
  const a = parseArgs(['--expect', 'legacy-off', '--legacy-ip', '216.198.79.1', '--worker-site', 'https://clickit.example.workers.dev'])
  assert.equal(a.legacyIp, '216.198.79.1')
  assert.equal(a.workerSite, 'https://clickit.example.workers.dev')
  assert.equal(parseArgs(['--expect', 'legacy-on']).workerSite, 'https://www.clickitstory.ae')
})

// ---- run (injected request and fetch, no network)

type ReqCall = { url: string; ip: string | null }
type FetchCall = { url: string; method: string; headers: Record<string, string>; body: string | null }

const LEGACY = anon()
const PUBLISHABLE = publishable()

function world() {
  const pages: Record<string, { status: number; headers?: Record<string, string>; body?: string }> = {
    // The old host: /en redirects, the page references one chunk that holds the legacy key.
    'https://www.clickitstory.ae/en': { status: 308, headers: { location: '/en/portfolio' } },
    'https://www.clickitstory.ae/en/portfolio': {
      status: 200,
      body: '<script src="/_next/static/chunks/app-1.js"></script><script src="/_next/static/chunks/app-2.js"></script>',
    },
    'https://www.clickitstory.ae/_next/static/chunks/app-1.js': { status: 200, body: 'no key here' },
    'https://www.clickitstory.ae/_next/static/chunks/app-2.js': { status: 200, body: `var c="${LEGACY}";` },
    // The Worker preview.
    'https://clickit.example.workers.dev/en': {
      status: 200,
      body: '<script src="/_next/static/chunks/w-1.js"></script>',
    },
    'https://clickit.example.workers.dev/_next/static/chunks/w-1.js': { status: 200, body: `k="${PUBLISHABLE}"` },
  }
  return pages
}

function harness(over: { legacyStatus?: number; publishableStatus?: number; pages?: ReturnType<typeof world>; authStatus?: number; authBody?: string } = {}) {
  const pages = over.pages ?? world()
  const reqCalls: ReqCall[] = []
  const fetchCalls: FetchCall[] = []
  const lines: string[] = []
  const request = async (url: string, o: { ip?: string | null } = {}) => {
    reqCalls.push({ url, ip: o.ip ?? null })
    const hit = pages[url]
    if (!hit) return { status: 404, headers: {}, body: '' }
    return { status: hit.status, headers: hit.headers ?? {}, body: hit.body ?? '', certificate: null }
  }
  const fetchFn = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => {
    fetchCalls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ?? null })
    if (url.includes('/auth/v1/token')) {
      return { status: over.authStatus ?? 400, text: async () => over.authBody ?? 'Invalid login credentials' }
    }
    const key = init.headers?.apikey
    const status = key === LEGACY ? (over.legacyStatus ?? 200) : (over.publishableStatus ?? 200)
    return { status, text: async () => (status === 200 ? '[{"id":"x"}]' : '{"message":"Invalid API key"}') }
  }
  return { reqCalls, fetchCalls, lines, deps: { request, fetch: fetchFn, out: (l: string) => lines.push(l) } }
}

const WORKER = 'https://clickit.example.workers.dev'

test('run legacy-on: finds both keys, one apikey-only REST read per key, passes', async () => {
  const h = harness()
  const code = await run(parseArgs(['--expect', 'legacy-on', '--worker-site', WORKER, '--legacy-ip', '216.198.79.1']), h.deps)
  assert.equal(code, 0)
  assert.equal(h.fetchCalls.length, 2)
  for (const c of h.fetchCalls) {
    assert.equal(c.method, 'GET')
    assert.equal(c.url, 'https://lajguozmtissnnfccmej.supabase.co/rest/v1/shows?select=id&limit=1')
    assert.deepEqual(Object.keys(c.headers), ['apikey'])
  }
  assert.deepEqual(h.fetchCalls.map((c) => c.headers.apikey).sort(), [LEGACY, PUBLISHABLE].sort())
  assert.ok(h.lines.some((l) => /legacy.*200/.test(l)))
  assert.ok(h.lines.some((l) => /publishable.*200/.test(l)))
  assert.ok(h.lines.at(-1)?.includes('ALL PASS'))
})

test('run: no output line carries a key, only redacted prefixes', async () => {
  const h = harness()
  await run(parseArgs(['--expect', 'legacy-on', '--worker-site', WORKER]), h.deps)
  const text = h.lines.join('\n')
  assert.ok(!text.includes(LEGACY))
  assert.ok(!text.includes(LEGACY.slice(0, 40)))
  assert.ok(!text.includes(PUBLISHABLE))
  assert.ok(!text.includes(PUBLISHABLE.slice(0, 20)))
})

test('run: only the old-host fetches are pinned to --legacy-ip, redirects are followed', async () => {
  const h = harness()
  await run(parseArgs(['--expect', 'legacy-on', '--worker-site', WORKER, '--legacy-ip', '216.198.79.1']), h.deps)
  const oldHost = h.reqCalls.filter((c) => c.url.startsWith('https://www.clickitstory.ae/'))
  assert.ok(oldHost.length >= 3)
  assert.ok(oldHost.every((c) => c.ip === '216.198.79.1'))
  assert.ok(oldHost.some((c) => c.url.endsWith('/en/portfolio')), 'redirect target was fetched')
  const worker = h.reqCalls.filter((c) => c.url.startsWith(WORKER))
  assert.ok(worker.length >= 2)
  assert.ok(worker.every((c) => c.ip === null))
})

test('run legacy-off: legacy 401 and publishable 200 passes', async () => {
  const h = harness({ legacyStatus: 401 })
  const code = await run(parseArgs(['--expect', 'legacy-off', '--worker-site', WORKER]), h.deps)
  assert.equal(code, 0)
})

test('run legacy-off: legacy still 200 fails with exit 1', async () => {
  const h = harness({ legacyStatus: 200 })
  const code = await run(parseArgs(['--expect', 'legacy-off', '--worker-site', WORKER]), h.deps)
  assert.equal(code, 1)
  assert.ok(h.lines.some((l) => l.startsWith('FAIL')))
})

test('run: a key that is not in the bundles fails without any REST call for it', async () => {
  const pages = world()
  pages['https://www.clickitstory.ae/_next/static/chunks/app-2.js'] = { status: 200, body: 'nothing' }
  const h = harness({ pages })
  const code = await run(parseArgs(['--expect', 'legacy-off', '--worker-site', WORKER]), h.deps)
  assert.equal(code, 1)
  assert.ok(h.lines.some((l) => /legacy/.test(l) && /not found/.test(l)))
  assert.equal(h.fetchCalls.length, 1, 'only the publishable key was sent')
})

test('run --extract-only: finds keys from public pages and sends nothing to the API', async () => {
  const h = harness()
  const code = await run(parseArgs(['--extract-only', '--worker-site', WORKER]), h.deps)
  assert.equal(code, 0)
  assert.equal(h.fetchCalls.length, 0)
  assert.ok(h.lines.some((l) => /legacy key found/.test(l)))
  assert.ok(h.lines.some((l) => /publishable key found/.test(l)))
})

test('run --captcha-probe: one password grant for an .invalid address, no captcha token, no mail paths', async () => {
  const h = harness()
  const code = await run(parseArgs(['--captcha-probe', 'off', '--worker-site', WORKER]), h.deps)
  assert.equal(code, 0)
  assert.equal(h.fetchCalls.length, 1)
  const call = h.fetchCalls[0]
  assert.equal(call.method, 'POST')
  assert.equal(call.url, 'https://lajguozmtissnnfccmej.supabase.co/auth/v1/token?grant_type=password')
  assert.equal(call.headers.apikey, PUBLISHABLE)
  const body = JSON.parse(call.body ?? '{}')
  assert.match(body.email, /@example\.invalid$/)
  assert.ok(typeof body.password === 'string' && body.password.length >= 32)
  assert.ok(!('captcha_token' in body) && !('gotrue_meta_security' in body))
  assert.ok(!/signup|recover|otp|magiclink/.test(call.url))
  assert.ok(h.lines.at(-1)?.includes('ALL PASS'))
})

test('run --captcha-probe on: judges a captcha refusal, fails when the refusal is a plain wrong login', async () => {
  const on = harness({ authBody: '{"msg":"captcha protection: request disallowed (no captcha_token found)"}' })
  assert.equal(await run(parseArgs(['--captcha-probe', 'on', '--worker-site', WORKER]), on.deps), 0)
  const plain = harness()
  assert.equal(await run(parseArgs(['--captcha-probe', 'on', '--worker-site', WORKER]), plain.deps), 1)
})

// ---- static guards on the script source

test('keys-check.mjs source: no literal key, no disk write, no mail or signup path', () => {
  const src = readFileSync(new URL('../../scripts/cutover/keys-check.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /eyJ[A-Za-z0-9_-]{10,}\./)
  assert.doesNotMatch(src, /sb_(publishable|secret)_[A-Za-z0-9]{6,}/)
  assert.doesNotMatch(src, /writeFile|appendFile|createWriteStream/)
  assert.doesNotMatch(src, /\/(signup|recover|otp|magiclink)/)
  assert.doesNotMatch(src, /process\.env|security find-generic-password/, 'never reads a key from env or Keychain')
})
