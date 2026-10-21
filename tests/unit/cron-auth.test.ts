import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timingSafeEqual } from 'node:crypto'
import { cronAuthOk, constantTimeDigestEqual } from '../../src/server/cron-auth.ts'

// Node has no crypto.subtle.timingSafeEqual; tests inject node:crypto's.
const cmp = (a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView) =>
  timingSafeEqual(
    ArrayBuffer.isView(a) ? a : new Uint8Array(a),
    ArrayBuffer.isView(b) ? b : new Uint8Array(b),
  )

test('correct Bearer secret is accepted', async () => {
  assert.equal(await cronAuthOk('Bearer s3cret', 's3cret', cmp), true)
})

test('secret is trimmed like the old route did', async () => {
  assert.equal(await cronAuthOk('Bearer s3cret', '  s3cret\n', cmp), true)
})

test('wrong secret is refused', async () => {
  assert.equal(await cronAuthOk('Bearer other', 's3cret', cmp), false)
})

test('secret differing only in the last character is refused', async () => {
  assert.equal(await cronAuthOk('Bearer s3cres', 's3cret', cmp), false)
})

test('header without the Bearer prefix is refused', async () => {
  assert.equal(await cronAuthOk('s3cret', 's3cret', cmp), false)
  assert.equal(await cronAuthOk('bearer s3cret', 's3cret', cmp), false)
  assert.equal(await cronAuthOk('Basic s3cret', 's3cret', cmp), false)
})

test('missing header is refused', async () => {
  assert.equal(await cronAuthOk(null, 's3cret', cmp), false)
  assert.equal(await cronAuthOk('', 's3cret', cmp), false)
})

test('undefined, empty or whitespace secret is refused even when the header matches', async () => {
  assert.equal(await cronAuthOk('Bearer ', undefined, cmp), false)
  assert.equal(await cronAuthOk('Bearer ', '', cmp), false)
  assert.equal(await cronAuthOk('Bearer ', '   ', cmp), false)
  assert.equal(await cronAuthOk('Bearer undefined', undefined, cmp), false)
})

test('comparator always receives two 32-byte buffers, whatever the input length', async () => {
  const seen: Array<[number, number]> = []
  const spy = (a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView) => {
    seen.push([a.byteLength, b.byteLength])
    return cmp(a, b)
  }
  await cronAuthOk('Bearer short', 'a-much-longer-secret-value-than-the-header', spy)
  await cronAuthOk('Bearer ' + 'x'.repeat(5000), 's', spy)
  await constantTimeDigestEqual('', 'abc', spy)
  assert.equal(seen.length, 3)
  for (const [a, b] of seen) {
    assert.equal(a, 32)
    assert.equal(b, 32)
  }
})

test('without an injected comparator and without subtle.timingSafeEqual, it refuses instead of falling back to ===', async () => {
  const subtle = crypto.subtle as unknown as { timingSafeEqual?: unknown }
  assert.equal(typeof subtle.timingSafeEqual, 'undefined', 'this test assumes Node has no subtle.timingSafeEqual')
  assert.equal(await cronAuthOk('Bearer s3cret', 's3cret'), false)
  assert.equal(await constantTimeDigestEqual('same', 'same'), false)
})

test('uses crypto.subtle.timingSafeEqual when the runtime provides it (workerd)', async () => {
  const subtle = crypto.subtle as unknown as { timingSafeEqual?: unknown }
  let calls = 0
  subtle.timingSafeEqual = function (a: ArrayBuffer, b: ArrayBuffer) {
    calls += 1
    return cmp(a, b)
  }
  try {
    assert.equal(await cronAuthOk('Bearer s3cret', 's3cret'), true)
    assert.equal(await cronAuthOk('Bearer nope', 's3cret'), false)
    assert.equal(calls, 2)
  } finally {
    delete subtle.timingSafeEqual
  }
})

test('a comparator that throws refuses (fail closed)', async () => {
  const boom = () => {
    throw new Error('boom')
  }
  assert.equal(await cronAuthOk('Bearer s3cret', 's3cret', boom), false)
})
