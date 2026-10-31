import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXIT,
  extractActionRefs,
  extractChunkNames,
  isAllowedBase,
  isValidTag,
  readActionIds,
} from '../../scripts/cf/action-ids.mjs'

const ID = (c: string) => c.repeat(42)
const ref = (id: string, name: string) =>
  `(0,k.createServerReference)("${id}",k.callServer,void 0,k.findSourceMapURL,"${name}")`
const BASE = 'http://127.0.0.1:8796'
const AUTH_CHUNK = `${ref(ID('a'), 'signInAction')};${ref(ID('b'), 'signUpAction')}`
const SUPPORT_CHUNK = ref(ID('c'), 'submitSupportMessage')
const SETTINGS_CHUNK = ref(ID('d'), 'updateFeatureFlags')

type Reply = number | Error
type World = { pages: Record<string, { replies?: Reply[]; html?: string }>; chunks: Record<string, string> }

function world(w: World) {
  const calls: { url: string; cookie: string | undefined }[] = []
  const left = new Map(Object.entries(w.pages).map(([k, v]) => [k, [...(v.replies ?? [200])]]))
  const fetchImpl = async (input: string, init: { headers?: Record<string, string> }) => {
    const url = new URL(input)
    calls.push({ url: input, cookie: init.headers?.cookie })
    if (url.pathname.startsWith('/_next/')) {
      const body = w.chunks[url.pathname.slice('/_next/'.length)]
      return body === undefined ? new Response('', { status: 404 }) : new Response(body, { status: 200 })
    }
    const replies = left.get(url.pathname)
    if (!replies) return new Response('', { status: 404 })
    const reply = replies.length > 1 ? replies.shift()! : replies[0]
    if (reply instanceof Error) throw reply
    if (reply >= 300 && reply < 400) return new Response(null, { status: reply, headers: { location: '/en/auth' } })
    return new Response(reply === 200 ? (w.pages[url.pathname].html ?? '') : 'down', { status: reply })
  }
  const sleeps: number[] = []
  const sleep = async (ms: number) => {
    sleeps.push(ms)
  }
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch, sleep, sleeps }
}

const fullWorld = (over: Partial<World['pages']> = {}): World => ({
  pages: {
    '/en/auth': { html: '<script src="/_next/static/chunks/auth.js"></script>' },
    '/en/support': { html: '<script src="/_next/static/chunks/support.js"></script>' },
    '/en/admin/settings': { html: '<script src="/_next/static/chunks/settings.js"></script>' },
    ...over,
  } as World['pages'],
  chunks: {
    'static/chunks/auth.js': AUTH_CHUNK,
    'static/chunks/support.js': SUPPORT_CHUNK,
    'static/chunks/settings.js': `"static/chunks/lazy.js"`,
    'static/chunks/lazy.js': SETTINGS_CHUNK,
  },
})

const run = (w: ReturnType<typeof world>) =>
  readActionIds({
    base: BASE,
    pages: ['/en/auth', '/en/support'],
    adminPages: ['/en/admin/settings'],
    adminCookie: 'sb-x-auth-token=value',
    runTag: 'r1',
    fetchImpl: w.fetchImpl,
    sleep: w.sleep,
  })

test('returns only the four allowed names, following chunks found inside chunks', async () => {
  const w = world(fullWorld())
  const result = await run(w)
  assert.equal(result.exitCode, EXIT.OK)
  assert.deepEqual(Object.keys(result.names).sort(), ['signInAction', 'signUpAction', 'submitSupportMessage', 'updateFeatureFlags'])
  assert.equal(result.names.updateFeatureFlags.id, ID('d'))
})

test('a deleteShowPermanently reference in a chunk never appears in the output', async () => {
  const base = fullWorld()
  base.chunks['static/chunks/auth.js'] += `;${ref(ID('e'), 'deleteShowPermanently')}`
  const result = await run(world(base))
  assert.equal(result.exitCode, EXIT.OK)
  assert.doesNotMatch(JSON.stringify(result), /deleteShowPermanently/)
  assert.doesNotMatch(JSON.stringify(result), new RegExp(ID('e')))
})

test('the same name with two different ids is an error and no id is returned for it', async () => {
  const base = fullWorld()
  base.chunks['static/chunks/support.js'] += `;${ref(ID('f'), 'signInAction')}`
  const result = await run(world(base))
  assert.equal(result.exitCode, EXIT.CONFLICT)
  assert.deepEqual(result.conflicts, ['signInAction'])
  assert.equal(result.names.signInAction.id, undefined)
})

test('a missing name with every page ok is name-missing, exit 6, never guessed', async () => {
  const base = fullWorld()
  base.chunks['static/chunks/support.js'] = 'nothing here'
  const result = await run(world(base))
  assert.equal(result.exitCode, EXIT.NAME_MISSING)
  assert.deepEqual(result.names.submitSupportMessage, { status: 'name-missing' })
})

test('503 three times then 200 is ok with all four tries recorded, 15 s apart', async () => {
  const w = world(fullWorld({ '/en/auth': { replies: [503, 503, 503, 200], html: '<a href="/_next/static/chunks/auth.js">' } }))
  const result = await run(w)
  assert.equal(result.exitCode, EXIT.OK)
  const page = result.pages.find((p: { page: string }) => p.page === '/en/auth')
  assert.equal(page.status, 'ok')
  assert.deepEqual(page.tries.map((t: { status: number }) => t.status), [503, 503, 503, 200])
  assert.deepEqual(w.sleeps, [15_000, 15_000, 15_000])
})

test('503 five times is page-failed, exit 5; its names are unresolved, not name-missing; each try keeps its status', async () => {
  const w = world(fullWorld({ '/en/auth': { replies: [503] } }))
  const result = await run(w)
  assert.equal(result.exitCode, EXIT.PAGE_FAILED)
  const page = result.pages.find((p: { page: string }) => p.page === '/en/auth')
  assert.equal(page.status, 'page-failed')
  assert.deepEqual(page.tries.map((t: { status: number }) => t.status), [503, 503, 503, 503, 503])
  assert.deepEqual(w.sleeps, [15_000, 15_000, 15_000, 15_000])
  assert.deepEqual(result.names.signInAction, { status: 'unresolved' })
  assert.deepEqual(result.names.signUpAction, { status: 'unresolved' })
  assert.equal(result.names.submitSupportMessage.status, 'found')
})

test('a network failure is retried and recorded the same way', async () => {
  const w = world(fullWorld({ '/en/support': { replies: [new TypeError('boom'), 200], html: '<a href="/_next/static/chunks/support.js">' } }))
  const result = await run(w)
  assert.equal(result.exitCode, EXIT.OK)
  const page = result.pages.find((p: { page: string }) => p.page === '/en/support')
  assert.equal(page.tries[0].status, null)
  assert.equal(page.tries[0].error, 'TypeError')
})

test('an admin page redirect is session-lost, exit 7, with no retry', async () => {
  const w = world(fullWorld({ '/en/admin/settings': { replies: [307] } }))
  const result = await run(w)
  assert.equal(result.exitCode, EXIT.SESSION_LOST)
  const page = result.pages.find((p: { page: string }) => p.page === '/en/admin/settings')
  assert.equal(page.status, 'session-lost')
  assert.equal(page.tries.length, 1)
  assert.deepEqual(w.sleeps, [])
})

test('only admin pages carry the cookie; chunks and public pages never do', async () => {
  const w = world(fullWorld())
  await run(w)
  for (const call of w.calls) {
    const admin = new URL(call.url).pathname === '/en/admin/settings'
    assert.equal(call.cookie, admin ? 'sb-x-auth-token=value' : undefined, call.url)
  }
})

test('page GETs carry a short sl tag, numbered per try', async () => {
  const w = world(fullWorld({ '/en/auth': { replies: [503, 200], html: '' } }))
  await run(w)
  const tags = w.calls.filter((c) => new URL(c.url).pathname === '/en/auth').map((c) => new URL(c.url).searchParams.get('sl'))
  assert.deepEqual(tags, ['r1-id-1', 'r1-id-2'])
})

test('following chunks stops at the cap and missing names then read as unresolved', async () => {
  const w = world(fullWorld())
  const result = await readActionIds({ base: BASE, pages: ['/en/auth'], runTag: 'r1', fetchImpl: w.fetchImpl, sleep: w.sleep, maxChunkFiles: 0 })
  assert.equal(result.chunks.truncated, true)
  assert.equal(result.names.signInAction.status, 'unresolved')
  assert.equal(result.exitCode, EXIT.PAGE_FAILED)
})

test('extract helpers read the chunk format and escaped flight data', () => {
  assert.deepEqual(extractActionRefs(ref(ID('a'), 'signInAction')), [{ id: ID('a'), name: 'signInAction' }])
  assert.deepEqual(extractActionRefs('createServerReference("short",k.a,"signInAction")'), [])
  assert.deepEqual(extractChunkNames('\\"/_next/static/chunks/abc-1.js\\" /_next/static/chunks/../evil.js'), ['static/chunks/abc-1.js'])
})

test('base allowlist and tag shape', () => {
  assert.equal(isAllowedBase('https://clickit.clickitstory.workers.dev'), true)
  assert.equal(isAllowedBase('http://127.0.0.1:8796'), true)
  assert.equal(isAllowedBase('https://www.clickitstory.ae'), false)
  assert.equal(isAllowedBase('https://clickitstory.ae'), false)
  assert.equal(isAllowedBase('https://clickit.clickitstory.workers.dev.evil.test'), false)
  assert.equal(isValidTag('r1-id-12'), true)
  assert.equal(isValidTag('r1-abcde-1'), false)
  assert.equal(isValidTag('r1-id-1234567890'), false)
})
