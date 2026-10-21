// Gateway session verifier (plan 02.1-01 Task 1, D-12, D-40 cookie cases).
// Valid ES256 session => user; any auth cookie that fails a check => bypass;
// no auth cookie or only the PKCE code-verifier => anon. Cookie presence alone
// never makes user.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createSessionVerifier,
  decodeSessionCookie,
  readAuthCookie,
  type Jwks,
} from '../../src/server/gateway/session.ts'
import {
  base64CookieValue,
  base64UrlFromString,
  chunkCookie,
  claims,
  cookieHeader,
  generateTestKey,
  sessionJson,
  signJwt,
  type TestKey,
} from './helpers/es256.ts'

const NAME = 'sb-127-auth-token'
const JWKS_URL = 'http://127.0.0.1:55321/auth/v1/.well-known/jwks.json'
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0)
const IN_ONE_HOUR = Math.floor(NOW / 1000) + 3600

const key = await generateTestKey('kid-main')
const other = await generateTestKey('kid-other')

function setup(opts: { fetchThrows?: boolean; maxCookieBytes?: number } = {}) {
  let clock = NOW
  const calls: string[] = []
  const jwks: Jwks = { keys: [key.publicJwk] }
  const verifier = createSessionVerifier({
    jwksUrl: JWKS_URL,
    fetchJwks: async (url) => {
      calls.push(url)
      if (opts.fetchThrows) throw new Error('network down')
      return jwks
    },
    now: () => clock,
    maxCookieBytes: opts.maxCookieBytes,
  })
  return {
    verifier,
    calls,
    advance(ms: number) {
      clock += ms
    },
  }
}

async function plainCookie(k: TestKey, payload = claims(IN_ONE_HOUR), signOpts = {}): Promise<string> {
  const token = await signJwt(k, payload, signOpts)
  return cookieHeader([{ name: NAME, value: base64CookieValue(sessionJson(token)) }])
}

test('no cookie header or unrelated cookies give anon', async () => {
  const { verifier, calls } = setup()
  assert.equal((await verifier.classify(null, NAME)).cls, 'anon')
  assert.equal((await verifier.classify('', NAME)).cls, 'anon')
  assert.equal((await verifier.classify('NEXT_LOCALE=ar', NAME)).cls, 'anon')
  assert.equal(calls.length, 0, 'anon never fetches the JWKS')
})

test('a forged sb-x=1 cookie gives anon (name never matches the configured name)', async () => {
  const { verifier } = setup()
  const verdict = await verifier.classify('sb-x=1', NAME)
  assert.equal(verdict.cls, 'anon')
  assert.equal((await verifier.classify('sb-x-auth-token=1; NEXT_LOCALE=en', NAME)).cls, 'anon')
})

test('only the PKCE code-verifier cookie gives anon', async () => {
  const { verifier } = setup()
  const verdict = await verifier.classify(`${NAME}-code-verifier=abc`, NAME)
  assert.equal(verdict.cls, 'anon')
  assert.match(verdict.reason, /verifier/)
  assert.deepEqual(readAuthCookie(`${NAME}-code-verifier=abc`, NAME), { present: false, value: null, verifierOnly: true })
})

test('a valid ES256 session in base64- form under the plain name gives user', async () => {
  const { verifier } = setup()
  const verdict = await verifier.classify(`NEXT_LOCALE=en; ${await plainCookie(key)}`, NAME)
  assert.deepEqual(verdict, { cls: 'user', reason: 'verified' })
})

test('the same session split into .0 and .1 chunks gives user', async () => {
  const { verifier } = setup()
  const token = await signJwt(key, claims(IN_ONE_HOUR))
  const chunks = chunkCookie(NAME, base64CookieValue(sessionJson(token, 4000)))
  assert.ok(chunks.length >= 2, 'fixture must actually chunk')
  assert.equal(chunks[0].name, `${NAME}.0`)
  const header = cookieHeader([...chunks].reverse())
  assert.equal((await verifier.classify(header, NAME)).cls, 'user')
})

test('a legacy raw JSON session gives user', async () => {
  const { verifier } = setup()
  const token = await signJwt(key, claims(IN_ONE_HOUR))
  const header = cookieHeader([{ name: NAME, value: sessionJson(token) }])
  assert.equal((await verifier.classify(header, NAME)).cls, 'user')
})

test('another key with an unknown kid gives bypass; no JWKS refetch within 60 s', async () => {
  const { verifier, calls, advance } = setup()
  const header = await plainCookie(other)
  const first = await verifier.classify(header, NAME)
  assert.equal(first.cls, 'bypass')
  assert.match(first.reason, /kid/)
  assert.equal(calls.length, 1)
  advance(30_000)
  assert.equal((await verifier.classify(header, NAME)).cls, 'bypass')
  assert.equal(calls.length, 1, 'unknown kid within 60 s must not refetch')
  advance(31_000)
  assert.equal((await verifier.classify(header, NAME)).cls, 'bypass')
  assert.equal(calls.length, 2, 'unknown kid after 60 s refetches once')
})

test('another key carrying the known kid gives bypass (bad signature)', async () => {
  const { verifier } = setup()
  const verdict = await verifier.classify(await plainCookie(other, claims(IN_ONE_HOUR), { kid: key.kid }), NAME)
  assert.equal(verdict.cls, 'bypass')
  assert.match(verdict.reason, /signature/)
})

test('an expired token with a valid signature gives bypass (injected clock)', async () => {
  const { verifier, advance } = setup()
  const header = await plainCookie(key, claims(Math.floor(NOW / 1000) + 60))
  assert.equal((await verifier.classify(header, NAME)).cls, 'user')
  advance(61_000)
  const verdict = await verifier.classify(header, NAME)
  assert.equal(verdict.cls, 'bypass')
  assert.match(verdict.reason, /expired/)
})

test('alg HS256 and alg none give bypass', async () => {
  const { verifier, calls } = setup()
  assert.equal((await verifier.classify(await plainCookie(key, claims(IN_ONE_HOUR), { alg: 'HS256' }), NAME)).cls, 'bypass')
  assert.equal((await verifier.classify(await plainCookie(key, claims(IN_ONE_HOUR), { alg: 'none' }), NAME)).cls, 'bypass')
  const head = base64UrlFromString(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = base64UrlFromString(JSON.stringify(claims(IN_ONE_HOUR)))
  const unsigned = cookieHeader([{ name: NAME, value: base64CookieValue(sessionJson(`${head}.${body}.`)) }])
  assert.equal((await verifier.classify(unsigned, NAME)).cls, 'bypass')
  assert.equal(calls.length, 0, 'a non-ES256 header is refused before any JWKS fetch')
})

test('a missing kid gives bypass', async () => {
  const { verifier } = setup()
  const verdict = await verifier.classify(await plainCookie(key, claims(IN_ONE_HOUR), { kid: null }), NAME)
  assert.equal(verdict.cls, 'bypass')
  assert.match(verdict.reason, /kid/)
})

test('a missing or empty sub gives bypass', async () => {
  const { verifier } = setup()
  const noSub = claims(IN_ONE_HOUR)
  delete noSub.sub
  assert.equal((await verifier.classify(await plainCookie(key, noSub), NAME)).cls, 'bypass')
  assert.equal((await verifier.classify(await plainCookie(key, claims(IN_ONE_HOUR, '')), NAME)).cls, 'bypass')
  assert.equal((await verifier.classify(await plainCookie(key, claims(IN_ONE_HOUR, 42)), NAME)).cls, 'bypass')
})

test('a missing exp gives bypass', async () => {
  const { verifier } = setup()
  const payload = claims(IN_ONE_HOUR)
  delete payload.exp
  assert.equal((await verifier.classify(await plainCookie(key, payload), NAME)).cls, 'bypass')
})

test('malformed base64 and malformed JSON give bypass', async () => {
  const { verifier } = setup()
  assert.equal((await verifier.classify(`${NAME}=base64-%%%not*base64`, NAME)).cls, 'bypass')
  assert.equal((await verifier.classify(`${NAME}=base64-${base64UrlFromString('{not json')}`, NAME)).cls, 'bypass')
  assert.equal((await verifier.classify(`${NAME}=${encodeURIComponent('{"access_token":')}`, NAME)).cls, 'bypass')
  assert.equal((await verifier.classify(`${NAME}=1`, NAME)).cls, 'bypass', 'right name with junk is bypass, never anon')
  const noToken = cookieHeader([{ name: NAME, value: base64CookieValue(JSON.stringify({ refresh_token: 'r' })) }])
  assert.equal((await verifier.classify(noToken, NAME)).cls, 'bypass')
})

test('a JWT that is not three parts, or has a malformed part, gives bypass', async () => {
  const { verifier } = setup()
  const token = await signJwt(key, claims(IN_ONE_HOUR))
  const [h, p, s] = token.split('.')
  for (const bad of [`${h}.${p}`, `${h}.${p}.${s}.${s}`, `${h}.${p}.`, `!!.${p}.${s}`, `${h}.%%.${s}`, `${h}.${p}.${s.slice(0, 20)}`]) {
    const header = cookieHeader([{ name: NAME, value: base64CookieValue(sessionJson(bad)) }])
    assert.equal((await verifier.classify(header, NAME)).cls, 'bypass', bad.slice(-12))
  }
})

test('a cookie over maxCookieBytes gives bypass', async () => {
  const { verifier } = setup({ maxCookieBytes: 256 })
  const verdict = await verifier.classify(await plainCookie(key), NAME)
  assert.equal(verdict.cls, 'bypass')
  assert.match(verdict.reason, /large/)
  const defaults = setup()
  const token = await signJwt(key, claims(IN_ONE_HOUR))
  const huge = cookieHeader(chunkCookie(NAME, base64CookieValue(sessionJson(token, 20_000))))
  assert.equal((await defaults.verifier.classify(huge, NAME)).cls, 'bypass', 'default cap is 16 KB')
})

test('a JWKS fetch that throws gives bypass, never user', async () => {
  const { verifier, calls } = setup({ fetchThrows: true })
  const verdict = await verifier.classify(await plainCookie(key), NAME)
  assert.equal(verdict.cls, 'bypass')
  assert.match(verdict.reason, /jwks/)
  assert.equal(calls[0], JWKS_URL)
})

test('the JWKS is fetched once per TTL across many calls', async () => {
  const { verifier, calls, advance } = setup()
  const header = await plainCookie(key)
  for (let i = 0; i < 20; i++) assert.equal((await verifier.classify(header, NAME)).cls, 'user')
  assert.equal(calls.length, 1)
  advance(599_000)
  assert.equal((await verifier.classify(header, NAME)).cls, 'user')
  assert.equal(calls.length, 1)
  advance(2_000)
  assert.equal((await verifier.classify(header, NAME)).cls, 'user')
  assert.equal(calls.length, 2, 'refetched after the 10 min TTL')
})

test('concurrent first calls share one JWKS fetch', async () => {
  const { verifier, calls } = setup()
  const header = await plainCookie(key)
  const verdicts = await Promise.all(Array.from({ length: 5 }, () => verifier.classify(header, NAME)))
  assert.ok(verdicts.every((v) => v.cls === 'user'))
  assert.equal(calls.length, 1)
})

test('readAuthCookie: plain name first, then .0..N until a gap; whitespace and = in values', () => {
  assert.deepEqual(readAuthCookie(` a=1 ;${NAME}=x=y== ; b=2`, NAME), { present: true, value: 'x=y==', verifierOnly: false })
  assert.deepEqual(readAuthCookie(`${NAME}.0=ab; ${NAME}.1=cd; ${NAME}.3=zz`, NAME), {
    present: true,
    value: 'abcd',
    verifierOnly: false,
  })
  assert.deepEqual(readAuthCookie(`${NAME}.1=cd`, NAME), { present: false, value: null, verifierOnly: false })
  assert.deepEqual(readAuthCookie(`${NAME}=plain; ${NAME}.0=chunk`, NAME), { present: true, value: 'plain', verifierOnly: false })
  assert.deepEqual(readAuthCookie(`${NAME}=%E0%A4%A`, NAME), { present: true, value: '%E0%A4%A', verifierOnly: false })
  assert.deepEqual(readAuthCookie(null, NAME), { present: false, value: null, verifierOnly: false })
})

test('decodeSessionCookie: base64- and raw JSON; null on anything else', () => {
  const json = JSON.stringify({ access_token: 'a.b.c' })
  assert.deepEqual(decodeSessionCookie(base64CookieValue(json)), { accessToken: 'a.b.c' })
  assert.deepEqual(decodeSessionCookie(json), { accessToken: 'a.b.c' })
  assert.equal(decodeSessionCookie('base64-***'), null)
  assert.equal(decodeSessionCookie('not json'), null)
  assert.equal(decodeSessionCookie('[]'), null)
  assert.equal(decodeSessionCookie(JSON.stringify({ access_token: '' })), null)
  assert.equal(decodeSessionCookie(JSON.stringify({ access_token: 7 })), null)
})
