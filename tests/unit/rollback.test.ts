import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  pickWwwRecord,
  buildRollbackPatch,
  describeRecord,
  KEYCHAIN_SERVICE,
  ZONE_ID,
} from '../../scripts/cutover/rollback-core.mjs'
import { parseArgs, run, USAGE } from '../../scripts/cutover/rollback.mjs'

// Fixtures are public record shapes only. The fake token below is not a credential.
const FAKE_TOKEN = 'fake-token-for-tests-0123456789'

type Rec = { id: string; type: string; name: string; content: string; proxied: boolean }
const www = (over: Partial<Rec> = {}): Rec => ({
  id: 'rec-www-1',
  type: 'CNAME',
  name: 'www.clickitstory.ae',
  content: 'ba211fb55cf67415.vercel-dns-017.com',
  proxied: true,
  ...over,
})
const apexA: Rec = { id: 'rec-apex', type: 'A', name: 'clickitstory.ae', content: '172.67.171.221', proxied: true }

test('constants name the Keychain item and the zone', () => {
  assert.equal(KEYCHAIN_SERVICE, 'clickit-cf-dns-edit')
  assert.equal(ZONE_ID, 'd8fa01b24f24653a29a0a56431072dc2')
})

test('pickWwwRecord returns the one www CNAME that points at the Vercel target', () => {
  assert.equal(pickWwwRecord([apexA, www()]).id, 'rec-www-1')
  assert.equal(pickWwwRecord([www({ name: 'WWW.ClickitStory.ae', content: 'Ba211fb55cf67415.vercel-dns-017.com.' })]).id, 'rec-www-1')
})

test('pickWwwRecord throws on zero matches and on more than one', () => {
  assert.throws(() => pickWwwRecord([]), /no www/i)
  assert.throws(() => pickWwwRecord([apexA]), /no www/i)
  assert.throws(() => pickWwwRecord([www(), www({ id: 'rec-www-2' })]), /more than one|exactly one/i)
})

test('pickWwwRecord refuses a target that is not Vercel (after the final retarget)', () => {
  assert.throws(() => pickWwwRecord([www({ content: 'clickit.example.workers.dev' })]), /not a vercel/i)
  assert.throws(() => pickWwwRecord([www({ content: 'evil-vercel-dns-017.com.attacker.example' })]), /not a vercel/i)
})

test('buildRollbackPatch returns exactly the grey toggle', () => {
  const patch = buildRollbackPatch(www({ proxied: true }))
  assert.deepEqual(patch, { proxied: false })
  assert.deepEqual(Object.keys(patch), ['proxied'])
})

test('buildRollbackPatch refuses a record that is already grey', () => {
  assert.throws(() => buildRollbackPatch(www({ proxied: false })), /already grey/)
})

test('describeRecord reports name, type, target class and proxied, and carries no secret', () => {
  assert.deepEqual(describeRecord(www()), {
    name: 'www.clickitstory.ae',
    type: 'CNAME',
    target: 'vercel',
    proxied: true,
  })
  assert.equal(describeRecord(www({ content: 'clickitstory.ae' })).target, 'cloudflare-zone')
  assert.equal(describeRecord(www({ content: 'other.example.net' })).target, 'other')
  assert.ok(!JSON.stringify(describeRecord(www())).includes('token'))
})

test('parseArgs accepts the four modes and refuses anything that could carry a token', () => {
  assert.equal(parseArgs([]).mode, 'dry-run')
  assert.equal(parseArgs(['--execute']).mode, 'execute')
  assert.equal(parseArgs(['--show']).mode, 'show')
  assert.equal(parseArgs(['--verify-token']).mode, 'verify-token')
  assert.equal(parseArgs(['--help']).help, true)
  assert.throws(() => parseArgs(['--token', FAKE_TOKEN]), /unknown/)
  assert.throws(() => parseArgs(['--execute', '--show']), /one mode/i)
  assert.match(USAGE, /--execute/)
})

// ---- run() with a fake Keychain and a fake Cloudflare API (no network, no Keychain)

function fakeWorld(initial: Rec[]) {
  const records = initial.map((r) => ({ ...r }))
  const calls: { method: string; path: string; body: unknown; auth: string | undefined }[] = []
  const fetchFn = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => {
    const method = init.method ?? 'GET'
    const u = new URL(url)
    calls.push({
      method,
      path: u.pathname + u.search,
      body: init.body ? JSON.parse(init.body) : undefined,
      auth: init.headers?.Authorization,
    })
    const json = (result: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, errors: [], result }) })
    if (u.pathname === '/client/v4/user/tokens/verify') return json({ status: 'active' })
    if (method === 'GET' && u.pathname === `/client/v4/zones/${ZONE_ID}/dns_records`) {
      return json(records.filter((r) => r.type === u.searchParams.get('type') && r.name === u.searchParams.get('name')))
    }
    const m = /dns_records\/([^/]+)$/.exec(u.pathname)
    if (method === 'PATCH' && m) {
      const rec = records.find((r) => r.id === m[1])!
      Object.assign(rec, JSON.parse(init.body!))
      return json(rec)
    }
    return { ok: false, status: 404, json: async () => ({ success: false, errors: [{ message: 'not found' }] }) }
  }
  return { records, calls, fetchFn }
}

function harness(initial: Rec[], env: Record<string, string> = {}) {
  const world = fakeWorld(initial)
  const lines: string[] = []
  let keychainReads = 0
  const deps = {
    getToken: async () => {
      keychainReads++
      return FAKE_TOKEN
    },
    fetchFn: world.fetchFn,
    out: (s: string) => lines.push(s),
    env,
  }
  return { world, lines, deps, reads: () => keychainReads }
}

test('run dry-run reads but never writes, and says what it would do', async () => {
  const h = harness([www()])
  const code = await run({ mode: 'dry-run' }, h.deps)
  assert.equal(code, 0)
  assert.ok(h.lines.some((l) => l.includes('would set www proxied=false (currently true)')))
  assert.ok(h.world.calls.every((c) => c.method === 'GET'))
  assert.equal(h.world.records[0].proxied, true)
})

test('run --execute sends exactly one PATCH with {proxied:false}, then reads back', async () => {
  const h = harness([www(), apexA])
  const code = await run({ mode: 'execute' }, h.deps)
  assert.equal(code, 0)
  const patches = h.world.calls.filter((c) => c.method === 'PATCH')
  assert.equal(patches.length, 1)
  assert.deepEqual(patches[0].body, { proxied: false })
  assert.equal(patches[0].path, `/client/v4/zones/${ZONE_ID}/dns_records/rec-www-1`)
  assert.equal(patches[0].auth, `Bearer ${FAKE_TOKEN}`)
  assert.equal(h.world.records[0].proxied, false)
  assert.equal(h.world.records[1].proxied, true) // apex untouched
  assert.equal(h.world.calls[h.world.calls.length - 1].method, 'GET') // read-back after the PATCH
})

test('run never prints the token', async () => {
  const h = harness([www()])
  await run({ mode: 'execute' }, h.deps)
  await run({ mode: 'show' }, h.deps)
  await run({ mode: 'verify-token' }, h.deps)
  assert.ok(h.lines.length > 0)
  assert.ok(h.lines.every((l) => !l.includes(FAKE_TOKEN)))
})

test('run --execute on an already grey record writes nothing and fails', async () => {
  const h = harness([www({ proxied: false })])
  const code = await run({ mode: 'execute' }, h.deps)
  assert.equal(code, 1)
  assert.equal(h.world.calls.filter((c) => c.method !== 'GET').length, 0)
})

test('run --execute exits 1 when the read-back is still proxied', async () => {
  const h = harness([www()])
  const real = h.world.fetchFn
  h.deps.fetchFn = async (url: string, init?: { method?: string }) => {
    const res = await real(url, init as never)
    if (init?.method === 'PATCH') {
      h.world.records[0].proxied = true // the PATCH silently did nothing
    }
    return res
  }
  assert.equal(await run({ mode: 'execute' }, h.deps), 1)
})

test('run refuses when CLOUDFLARE_API_TOKEN is set, without touching Keychain or the API', async () => {
  const h = harness([www()], { CLOUDFLARE_API_TOKEN: 'x' })
  const code = await run({ mode: 'execute' }, h.deps)
  assert.equal(code, 1)
  assert.equal(h.reads(), 0)
  assert.equal(h.world.calls.length, 0)
})

test('run --verify-token reports active', async () => {
  const h = harness([])
  assert.equal(await run({ mode: 'verify-token' }, h.deps), 0)
  assert.ok(h.lines.includes('token active'))
})

test('rollback.mjs source: one PATCH, no other write verbs, no logged secrets, no orange toggle', () => {
  const src = readFileSync('scripts/cutover/rollback.mjs', 'utf8')
  const core = readFileSync('scripts/cutover/rollback-core.mjs', 'utf8')
  assert.equal((src.match(/method: 'PATCH'/g) ?? []).length, 1)
  assert.equal((src.match(/method: '(POST|PUT|DELETE)'/g) ?? []).length, 0)
  assert.equal((src.match(/console\.(log|error)\([^)]*token/g) ?? []).length, 0)
  assert.equal((src.match(/proxied: true/g) ?? []).length + (core.match(/proxied: true/g) ?? []).length, 0)
  assert.ok(src.includes('find-generic-password'))
})
