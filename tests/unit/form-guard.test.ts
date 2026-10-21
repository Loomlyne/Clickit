import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardPublicForm, readCaptchaToken, TURNSTILE_FIELD } from '../../src/server/form-guard.ts'
import type { RateLimitStore } from '../../src/server/rate-limit-policy.ts'
import type { TurnstileResult } from '../../src/server/turnstile.ts'

const NOW = Date.parse('2026-10-20T10:00:00.000Z')
const IP = '203.0.113.5'

function fakeStore(overrides: Partial<RateLimitStore> = {}) {
  const calls = { count: [] as unknown[][], record: [] as unknown[][] }
  const store: RateLimitStore = {
    async count(...args) {
      calls.count.push(args)
      return 0
    },
    async record(...args) {
      calls.record.push(args)
    },
    ...overrides,
  }
  return { store, calls }
}

function fakeVerify(result: TurnstileResult) {
  const calls: Array<{ token: string | null | undefined; secret: string | null | undefined; ip?: string | null }> = []
  const verify = async (input: { token: string | null | undefined; secret: string | null | undefined; ip?: string | null }) => {
    calls.push(input)
    return result
  }
  return { verify, calls }
}

function input(over: Record<string, unknown> = {}) {
  const { store, calls } = fakeStore((over.storeOverrides as Partial<RateLimitStore>) ?? {})
  const v = fakeVerify((over.verifyResult as TurnstileResult) ?? { ok: true })
  return {
    calls,
    verifyCalls: v.calls,
    args: {
      token: 'tok' as string | null,
      secret: 'secret' as string | undefined,
      ip: IP as string | null,
      verify: v.verify,
      rateLimit: { key: 'support', limit: 5, windowMs: 3_600_000, store, now: () => NOW },
      ...(over.args as object),
    },
  }
}

test('empty token refuses with captcha and never touches the store', async () => {
  const { args, calls } = input({ args: { token: '' } })
  const result = await guardPublicForm(args)
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.error, 'captcha')
  assert.equal(calls.count.length, 0)
  assert.equal(calls.record.length, 0)
})

test('rejected token refuses with captcha and never touches the store', async () => {
  const { args, calls } = input({ verifyResult: { ok: false, reason: 'rejected:invalid-input-response' } })
  const result = await guardPublicForm(args)
  assert.deepEqual(result, { ok: false, error: 'captcha', reason: 'rejected:invalid-input-response' })
  assert.equal(calls.count.length, 0)
  assert.equal(calls.record.length, 0)
})

test('no client IP fails closed with unavailable', async () => {
  const { args, calls } = input({ args: { ip: null } })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'unavailable')
  assert.equal(calls.record.length, 0)
})

test('limit reached refuses with rate_limited', async () => {
  const { args, calls } = input({ storeOverrides: { count: async () => 5 } })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'rate_limited')
  assert.equal(calls.record.length, 0)
})

test('store error fails closed with unavailable', async () => {
  const { args } = input({
    storeOverrides: {
      count: async () => {
        throw new Error('db down')
      },
    },
  })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'unavailable')
})

test('record failure fails closed with unavailable', async () => {
  const { args } = input({
    storeOverrides: {
      record: async () => {
        throw new Error('insert failed')
      },
    },
  })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'unavailable')
})

test('valid token and free quota allows and records once', async () => {
  const { args, calls, verifyCalls } = input()
  const result = await guardPublicForm(args)
  assert.deepEqual(result, { ok: true })
  assert.equal(calls.record.length, 1)
  assert.deepEqual(calls.record[0], [IP, 'support'])
  assert.equal(verifyCalls.length, 1)
  assert.equal(verifyCalls[0].ip, IP)
  assert.equal(verifyCalls[0].secret, 'secret')
  assert.equal(verifyCalls[0].token, 'tok')
})

test('window is passed to the store as an ISO since-time', async () => {
  const { args, calls } = input()
  await guardPublicForm(args)
  assert.equal(calls.count[0][2], new Date(NOW - 3_600_000).toISOString())
})

test('missing secret refuses with captcha even when the verifier would accept', async () => {
  // The real verifier refuses a missing secret; the guard must also never skip
  // the check itself when the verifier is bypassed or buggy.
  const { args, calls, verifyCalls } = input({ args: { secret: undefined } })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'captcha')
  assert.equal(verifyCalls.length, 0)
  assert.equal(calls.count.length, 0)
})

test('blank secret refuses with captcha', async () => {
  const { args } = input({ args: { secret: '   ' } })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'captcha')
})

test('null token refuses with captcha', async () => {
  const { args } = input({ args: { token: null } })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'captcha')
})

test('verifier that throws refuses with captcha and never touches the store', async () => {
  const { args, calls } = input({
    args: {
      verify: async () => {
        throw new Error('boom')
      },
    },
  })
  const result = await guardPublicForm(args)
  assert.equal(result.ok === false && result.error, 'captcha')
  assert.equal(calls.count.length, 0)
})

test('readCaptchaToken reads strings and the cf-turnstile-response form field', () => {
  assert.equal(TURNSTILE_FIELD, 'cf-turnstile-response')
  assert.equal(readCaptchaToken('abc'), 'abc')
  const form = new FormData()
  form.set(TURNSTILE_FIELD, 'from-form')
  assert.equal(readCaptchaToken(form), 'from-form')
  assert.equal(readCaptchaToken(new FormData()), '')
  assert.equal(readCaptchaToken(undefined), '')
  assert.equal(readCaptchaToken(null), '')
  assert.equal(readCaptchaToken(42), '')
})
