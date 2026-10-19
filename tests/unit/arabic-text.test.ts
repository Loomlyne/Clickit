import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasArabicScript,
  acceptArabicTranslation,
  translateBatchStrictCore,
} from '../../src/lib/arabic-text.ts'

test('hasArabicScript', () => {
  assert.equal(hasArabicScript('مرحبا'), true)
  assert.equal(hasArabicScript('Hello'), false)
  assert.equal(hasArabicScript('Episode 3 - الحلقة'), true)
})

test('acceptArabicTranslation', () => {
  assert.equal(acceptArabicTranslation('Hello', 'Hello'), null)
  assert.equal(acceptArabicTranslation('Hello', 'مرحبا'), 'مرحبا')
  assert.equal(acceptArabicTranslation('Hello', '  '), null)
})

const resp = (translations: string[], ok = true) =>
  ({ ok, json: async () => ({ data: { translations: translations.map((translatedText) => ({ translatedText })) } }) }) as unknown as Response

test('no api key: all null, no fetch', async () => {
  let called = 0
  const out = await translateBatchStrictCore(['a', '', 'b'], {
    apiKey: undefined,
    fetchImpl: (async () => { called++; return resp([]) }) as typeof fetch,
  })
  assert.deepEqual(out, [null, null, null])
  assert.equal(called, 0)
})

test('failures give null', async () => {
  const notOk = await translateBatchStrictCore(['a', 'b'], { apiKey: 'k', fetchImpl: (async () => resp([], false)) as typeof fetch })
  assert.deepEqual(notOk, [null, null])
  const throws = await translateBatchStrictCore(['a', 'b'], { apiKey: 'k', fetchImpl: (async () => { throw new Error('x') }) as typeof fetch })
  assert.deepEqual(throws, [null, null])
})

test('English echo is null; Arabic maps to original positions', async () => {
  let body: { q: string[] } | undefined
  const fetchImpl = (async (_u: unknown, init: RequestInit) => {
    body = JSON.parse(init.body as string)
    return resp(['مرحبا', 'b'])
  }) as typeof fetch
  const out = await translateBatchStrictCore(['a', '', 'b'], { apiKey: 'k', fetchImpl })
  assert.deepEqual(body?.q, ['a', 'b'])
  assert.deepEqual(out, ['مرحبا', null, null])
})
