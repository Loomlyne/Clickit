import assert from 'node:assert/strict'
import test from 'node:test'
import { checkShimRequest, mintShimToken, SHIM_TOKEN_TTL_MS } from '../../src/server/dev-upload-shim.ts'

const SECRET = 'a'.repeat(40)
const KEY = 'show-artwork/shows/s/poster-1760000000000-abcdef12.png'
const CT = 'image/png'
const NOW = 1_760_000_000_000
const SIZE = 4096

async function ok(over: Record<string, unknown> = {}) {
  const token = await mintShimToken(KEY, CT, SIZE, SECRET, NOW)
  return checkShimRequest({
    localDev: '1',
    host: '127.0.0.1:8787',
    token,
    key: KEY,
    contentType: CT,
    contentLength: SIZE,
    secret: SECRET,
    now: NOW + 1000,
    ...over,
  } as never)
}

test('valid request on 127.0.0.1 with LOCAL_DEV=1 is ok', async () => {
  assert.deepEqual(await ok(), { ok: true })
  assert.deepEqual(await ok({ host: '127.0.0.1' }), { ok: true })
})

test('LOCAL_DEV unset or not "1" gives 404', async () => {
  for (const localDev of [undefined, '', '0', 'true', 'yes']) {
    assert.deepEqual(await ok({ localDev }), { ok: false, status: 404 }, String(localDev))
  }
})

test('any other host gives 404', async () => {
  for (const host of [
    'localhost:8787',
    '[::1]:8787',
    '127.0.0.2:8787',
    '127.0.0.1.evil.com',
    '127.0.0.1@evil.com',
    'clickit.example.workers.dev',
    'www.clickitstory.ae',
    '',
    undefined,
    '127.0.0.1:99999999',
  ]) {
    assert.deepEqual(await ok({ host }), { ok: false, status: 404 }, String(host))
  }
})

test('missing or short secret gives 404', async () => {
  assert.deepEqual(await ok({ secret: undefined }), { ok: false, status: 404 })
  assert.deepEqual(await ok({ secret: '' }), { ok: false, status: 404 })
  assert.deepEqual(await ok({ secret: 'short' }), { ok: false, status: 404 })
  assert.deepEqual(await ok({ secret: 'a'.repeat(31) }), { ok: false, status: 404 })
})

test('expired token (older than 300 s) gives 403', async () => {
  assert.equal(SHIM_TOKEN_TTL_MS, 300_000)
  assert.deepEqual(await ok({ now: NOW + 300_000 }), { ok: true })
  assert.deepEqual(await ok({ now: NOW + 300_001 }), { ok: false, status: 403 })
})

test('token minted in the future is refused', async () => {
  assert.deepEqual(await ok({ now: NOW - 60_000 }), { ok: false, status: 403 })
})

test('token for another key or content type gives 403', async () => {
  assert.deepEqual(await ok({ key: KEY.replace('poster', 'card') }), { ok: false, status: 403 })
  assert.deepEqual(await ok({ contentType: 'image/jpeg' }), { ok: false, status: 403 })
})

test('token signed with another secret gives 403', async () => {
  const token = await mintShimToken(KEY, CT, SIZE, 'b'.repeat(40), NOW)
  assert.deepEqual(await ok({ token }), { ok: false, status: 403 })
})

test('missing, malformed or tampered tokens give 403', async () => {
  const good = await mintShimToken(KEY, CT, SIZE, SECRET, NOW)
  for (const token of [undefined, '', 'x', 'abc.def', `${NOW}.zz`, `${NOW}.${'0'.repeat(64)}`, good + '0', good.slice(0, -2)]) {
    assert.deepEqual(await ok({ token }), { ok: false, status: 403 }, String(token))
  }
  const [ts, mac] = good.split('.')
  assert.deepEqual(await ok({ token: `${Number(ts) + 1}.${mac}` }), { ok: false, status: 403 })
})

test('mintShimToken refuses a short secret', async () => {
  await assert.rejects(mintShimToken(KEY, CT, SIZE, 'short', NOW))
})

test('token for another size gives 403 (the shim mirrors the signed Content-Length)', async () => {
  assert.deepEqual(await ok({ contentLength: SIZE + 1 }), { ok: false, status: 403 })
  assert.deepEqual(await ok({ contentLength: SIZE - 1 }), { ok: false, status: 403 })
})

test('mintShimToken refuses a size that is not a positive integer', async () => {
  for (const size of [0, -1, 1.5, Number.NaN]) {
    await assert.rejects(mintShimToken(KEY, CT, size, SECRET, NOW), String(size))
  }
})
