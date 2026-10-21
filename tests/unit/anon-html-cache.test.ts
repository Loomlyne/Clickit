// Anonymous HTML cache in front of OpenNext (debug cpu-en-home, 2026-10-21).
// Signed-out GETs of the public landing pages are answered from a 120 s copy
// (Cache API, then R2) so the Worker skips the proxy and the Next render.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  ANON_HTML_TTL_SECONDS,
  CACHE_STATUS_HEADER,
  anonCacheTarget,
  isStorable,
  renderedCookieLocale,
  serveWithAnonHtmlCache,
  type AnonCacheDeps,
} from '../../src/server/anon-html-cache.ts'

const BASE = 'https://clickit.clickitstory.workers.dev'
const V = 'd43fd90-2026-10-21T13:00:20.857Z'

function req(path: string, headers: Record<string, string> = {}, method = 'GET') {
  return new Request(`${BASE}${path}`, { method, headers })
}

function arHtml(body: string) {
  const r = html(body)
  r.headers.append('set-cookie', 'NEXT_LOCALE=ar; Path=/; SameSite=lax')
  return r
}

function html(body = '<html>page</html>', extra: Record<string, string> = {}, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
      ...extra,
    },
  })
}

function fakeEdge() {
  const store = new Map<string, Response>()
  return {
    store,
    async match(key: string) {
      const r = store.get(key)
      return r ? r.clone() : undefined
    },
    async put(key: string, response: Response) {
      store.set(key, response)
    },
  }
}

function fakeR2() {
  const store = new Map<string, string>()
  return {
    store,
    async get(key: string) {
      const v = store.get(key)
      return v === undefined ? null : { text: async () => v }
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
  }
}

function setup(now = 1_000_000) {
  const edge = fakeEdge()
  const r2 = fakeR2()
  const pending: Promise<unknown>[] = []
  const clock = { t: now }
  const deps: AnonCacheDeps = {
    edge,
    r2,
    version: V,
    now: () => clock.t,
    waitUntil: (p) => void pending.push(p),
  }
  let renders = 0
  const renderWith = (make: () => Response) => async () => {
    renders++
    return make()
  }
  return { edge, r2, deps, clock, pending, renderWith, renders: () => renders, flush: () => Promise.all(pending) }
}

test('targets the signed-out public pages in both locales', () => {
  for (const p of ['/en', '/ar', '/en/portfolio', '/ar/portfolio', '/en/about', '/ar/support', '/en/privacy', '/ar/terms']) {
    assert.ok(anonCacheTarget(req(p), V), p)
  }
})

test('leaves every other path to the normal render', () => {
  for (const p of ['/', '/en/', '/en/auth', '/en/watch', '/en/admin', '/en/browse', '/en/coming-soon', '/fr/portfolio', '/en/portfolio/x', '/api/health', '/en/legal/terms']) {
    assert.equal(anonCacheTarget(req(p), V), null, p)
  }
})

test('bypasses signed-in visitors, router and action requests, other methods', () => {
  assert.equal(anonCacheTarget(req('/en/portfolio', { cookie: 'sb-abc-auth-token=x' }), V), null)
  assert.equal(anonCacheTarget(req('/en/portfolio', { cookie: 'NEXT_LOCALE=en; sb-abc-auth-token.0=x' }), V), null)
  for (const h of ['rsc', 'next-router-prefetch', 'next-router-state-tree', 'next-router-segment-prefetch', 'next-action']) {
    assert.equal(anonCacheTarget(req('/en/portfolio', { [h]: '1' }), V), null, h)
  }
  assert.equal(anonCacheTarget(req('/en/portfolio', {}, 'HEAD'), V), null)
  assert.equal(anonCacheTarget(req('/en/portfolio', {}, 'POST'), V), null)
  assert.equal(anonCacheTarget(req('/en/portfolio'), ''), null)
})

test('locale and analytics cookies do not bypass; campaign params share the key', () => {
  const plain = anonCacheTarget(req('/en/portfolio'), V)
  const withCookie = anonCacheTarget(req('/en/portfolio', { cookie: 'NEXT_LOCALE=ar; _ga=1' }), V)
  const withUtm = anonCacheTarget(req('/en/portfolio?utm_source=ig&fbclid=1&gclid=2'), V)
  assert.deepEqual(withCookie, plain)
  assert.deepEqual(withUtm, plain)
  assert.equal(anonCacheTarget(req('/en/portfolio?_rsc=abc'), V), null)
  assert.equal(anonCacheTarget(req('/en/portfolio?q=1'), V), null)
})

test('keys carry the build version and the locale', () => {
  const a = anonCacheTarget(req('/en/portfolio'), V)!
  const b = anonCacheTarget(req('/en/portfolio'), 'other-build')!
  const c = anonCacheTarget(req('/ar/portfolio'), V)!
  assert.notEqual(a.edgeKey, b.edgeKey)
  assert.notEqual(a.r2Key, b.r2Key)
  assert.notEqual(a.edgeKey, c.edgeKey)
  assert.ok(a.r2Key.startsWith('anon-html/'))
  assert.ok(a.edgeKey.startsWith(`${BASE}/__anon-html/`))
  assert.equal(c.locale, 'ar')
})

test('mobile and desktop visitors get separate copies (the hero renders one media variant)', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15'
  const desktop = anonCacheTarget(req('/en/portfolio', { 'user-agent': mac }), V)!
  const mobile = anonCacheTarget(req('/en/portfolio', { 'user-agent': iphone }), V)!
  const hint = anonCacheTarget(req('/en/portfolio', { 'user-agent': mac, 'sec-ch-ua-mobile': '?1' }), V)!
  assert.notEqual(desktop.edgeKey, mobile.edgeKey)
  assert.notEqual(desktop.r2Key, mobile.r2Key)
  assert.equal(hint.edgeKey, mobile.edgeKey)
  assert.match(mobile.r2Key, /\/mobile\/en\/portfolio$/)
  assert.match(desktop.r2Key, /\/desktop\/en\/portfolio$/)
})

test('the render and the cache key share one device detection', () => {
  assert.match(readFileSync('src/lib/device.ts', 'utf8'), /isMobileFromHeaders\(await headers\(\)\)/)
  assert.match(readFileSync('src/server/anon-html-cache.ts', 'utf8'), /isMobileFromHeaders\(request\.headers\)/)
})

test('renderedCookieLocale: the cookie the proxy set, else the visitor cookie, else en', () => {
  assert.equal(renderedCookieLocale(req('/ar/portfolio'), arHtml('x')), 'ar')
  assert.equal(renderedCookieLocale(req('/ar/portfolio', { cookie: 'NEXT_LOCALE=ar' }), html()), 'ar')
  assert.equal(renderedCookieLocale(req('/ar/portfolio'), html()), 'en')
  assert.equal(renderedCookieLocale(req('/en/portfolio', { cookie: 'NEXT_LOCALE=ar' }), html()), 'ar')
})

test('a render whose cookie locale was not the URL locale is served but not stored', async () => {
  const s = setup()
  // /ar with no cookie and no Set-Cookie: the cookie read fell back to en.
  const res = await serveWithAnonHtmlCache(req('/ar/portfolio'), s.deps, s.renderWith(() => html('<p>mixed</p>')))
  assert.equal(res.status, 200)
  assert.equal(await res.text(), '<p>mixed</p>')
  await s.flush()
  assert.equal(s.edge.store.size, 0)
  assert.equal(s.r2.store.size, 0)
  // The next /ar visitor whose render saw ar is stored.
  await serveWithAnonHtmlCache(req('/ar/portfolio', { cookie: 'NEXT_LOCALE=ar' }), s.deps, s.renderWith(() => html('<p>ar</p>')))
  await s.flush()
  assert.equal(s.r2.store.size, 1)
})

test('stores only 200 HTML or a 308 with a location, and only the locale cookie', () => {
  assert.equal(isStorable(html()), true)
  const withLocale = html('x')
  withLocale.headers.append('set-cookie', 'NEXT_LOCALE=ar; Path=/; SameSite=lax')
  assert.equal(isStorable(withLocale), true)
  const withSession = html('x')
  withSession.headers.append('set-cookie', 'sb-abc-auth-token=secret; Path=/')
  assert.equal(isStorable(withSession), false)
  assert.equal(isStorable(new Response(null, { status: 308, headers: { location: '/en/portfolio' } })), true)
  assert.equal(isStorable(new Response(null, { status: 307, headers: { location: '/en/coming-soon' } })), false)
  assert.equal(isStorable(new Response('{}', { headers: { 'content-type': 'application/json' } })), false)
  assert.equal(isStorable(html('err', {}, 500)), false)
})

test('a miss renders once and stores in both tiers; the next request is an edge hit', async () => {
  const s = setup()
  const first = await serveWithAnonHtmlCache(req('/en/portfolio'), s.deps, s.renderWith(() => html('<p>one</p>')))
  assert.equal(first.headers.get(CACHE_STATUS_HEADER), 'MISS')
  assert.equal(await first.text(), '<p>one</p>')
  await s.flush()
  assert.equal(s.edge.store.size, 1)
  assert.equal(s.r2.store.size, 1)

  s.clock.t += 5_000
  const second = await serveWithAnonHtmlCache(req('/en/portfolio'), s.deps, s.renderWith(() => html('<p>two</p>')))
  assert.equal(second.headers.get(CACHE_STATUS_HEADER), 'HIT-EDGE')
  assert.equal(await second.text(), '<p>one</p>')
  assert.equal(second.headers.get('age'), '5')
  assert.equal(second.headers.get('cache-control'), 'private, no-cache, no-store, max-age=0, must-revalidate')
  assert.equal(s.renders(), 1)
})

test('an R2 hit refills the edge copy without rendering', async () => {
  const s = setup()
  await serveWithAnonHtmlCache(req('/ar/portfolio'), s.deps, s.renderWith(() => arHtml('<p>ar</p>')))
  await s.flush()
  s.edge.store.clear()
  const res = await serveWithAnonHtmlCache(req('/ar/portfolio'), s.deps, s.renderWith(() => html('<p>new</p>')))
  assert.equal(res.headers.get(CACHE_STATUS_HEADER), 'HIT-R2')
  assert.equal(await res.text(), '<p>ar</p>')
  await s.flush()
  assert.equal(s.edge.store.size, 1)
  assert.equal(s.renders(), 1)
})

test(`a copy older than ${ANON_HTML_TTL_SECONDS} s is rendered again`, async () => {
  const s = setup()
  await serveWithAnonHtmlCache(req('/en/about'), s.deps, s.renderWith(() => html('<p>old</p>')))
  await s.flush()
  s.clock.t += ANON_HTML_TTL_SECONDS * 1000
  const res = await serveWithAnonHtmlCache(req('/en/about'), s.deps, s.renderWith(() => html('<p>fresh</p>')))
  assert.equal(res.headers.get(CACHE_STATUS_HEADER), 'MISS')
  assert.equal(await res.text(), '<p>fresh</p>')
  assert.equal(s.renders(), 2)
})

test('a session cookie from the render is never stored and reaches only its visitor', async () => {
  const s = setup()
  const res = await serveWithAnonHtmlCache(
    req('/en/portfolio'),
    s.deps,
    s.renderWith(() => {
      const r = html('<p>x</p>')
      r.headers.append('set-cookie', 'sb-abc-auth-token=secret; Path=/')
      return r
    }),
  )
  assert.equal(res.headers.get(CACHE_STATUS_HEADER), null)
  assert.match(res.headers.get('set-cookie') ?? '', /sb-abc-auth-token/)
  await s.flush()
  assert.equal(s.edge.store.size, 0)
  assert.equal(s.r2.store.size, 0)
})

test('stored copies never carry Set-Cookie; a hit sets the locale cookie only when it differs', async () => {
  const s = setup()
  await serveWithAnonHtmlCache(
    req('/ar/portfolio'),
    s.deps,
    s.renderWith(() => {
      const r = html('<p>ar</p>')
      r.headers.append('set-cookie', 'NEXT_LOCALE=ar; Path=/; SameSite=lax')
      return r
    }),
  )
  await s.flush()
  for (const v of s.r2.store.values()) assert.doesNotMatch(v.split('\n')[0], /set-cookie/i)
  for (const r of s.edge.store.values()) assert.equal(r.headers.get('set-cookie'), null)

  const fresh = await serveWithAnonHtmlCache(req('/ar/portfolio'), s.deps, s.renderWith(() => html()))
  assert.equal(fresh.headers.get('set-cookie'), 'NEXT_LOCALE=ar; Path=/; SameSite=lax')
  const same = await serveWithAnonHtmlCache(req('/ar/portfolio', { cookie: 'NEXT_LOCALE=ar' }), s.deps, s.renderWith(() => html()))
  assert.equal(same.headers.get('set-cookie'), null)
})

test('the locale-root 308 is stored and replayed with its location', async () => {
  const s = setup()
  const redirect = () => new Response(null, { status: 308, headers: { location: `${BASE}/en/portfolio` } })
  const first = await serveWithAnonHtmlCache(req('/en'), s.deps, s.renderWith(redirect))
  assert.equal(first.status, 308)
  await s.flush()
  const hit = await serveWithAnonHtmlCache(req('/en'), s.deps, s.renderWith(redirect))
  assert.equal(hit.status, 308)
  assert.equal(hit.headers.get('location'), `${BASE}/en/portfolio`)
  assert.equal(hit.headers.get(CACHE_STATUS_HEADER), 'HIT-EDGE')
  assert.equal(s.renders(), 1)
})

test('bypassed requests reach the render untouched', async () => {
  const s = setup()
  const original = html('<p>me</p>')
  const res = await serveWithAnonHtmlCache(req('/en/portfolio', { cookie: 'sb-abc-auth-token=x' }), s.deps, async () => original)
  assert.equal(res, original)
})

test('store failures never fail the request', async () => {
  const s = setup()
  const broken = {
    match: async () => {
      throw new Error('cache down')
    },
    put: async () => {
      throw new Error('cache down')
    },
  }
  const brokenR2 = {
    get: async () => {
      throw new Error('r2 down')
    },
    put: async () => {
      throw new Error('r2 down')
    },
  }
  const deps = { ...s.deps, edge: broken, r2: brokenR2 }
  const res = await serveWithAnonHtmlCache(req('/en/portfolio'), deps, s.renderWith(() => html('<p>ok</p>')))
  assert.equal(res.status, 200)
  assert.equal(await res.text(), '<p>ok</p>')
  await s.flush()
})

test('works with no stores at all (render every time)', async () => {
  const s = setup()
  const deps = { ...s.deps, edge: null, r2: null }
  const res = await serveWithAnonHtmlCache(req('/en/portfolio'), deps, s.renderWith(() => html('<p>ok</p>')))
  assert.equal(res.headers.get(CACHE_STATUS_HEADER), 'MISS')
})

test('the Worker entry runs the anonymous cache before OpenNext, keyed by the build stamp', () => {
  const src = readFileSync('custom-worker.ts', 'utf8')
  assert.match(src, /serveWithAnonHtmlCache\(/)
  assert.match(src, /clickit-build-stamp\.json/)
  assert.match(src, /NEXT_INC_CACHE_R2_BUCKET/)
  assert.match(src, /\(await loadOpenNext\(\)\)\.fetch\(request, env, ctx\)/)
  assert.match(src, /import\('\.\/\.open-next\/worker\.js'\)/)
  assert.doesNotMatch(src, /^import .*\.open-next\/worker\.js/m)
  assert.match(src, /export \{ DOQueueHandler \} from '\.\/\.open-next\/\.build\/durable-objects\/queue\.js'/)
})
