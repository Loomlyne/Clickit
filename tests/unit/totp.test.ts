import assert from 'node:assert/strict'
import { test } from 'node:test'

import { base32Decode, totp } from '../../scripts/lib/totp.mjs'

// RFC 6238 Appendix B, SHA-1 secret "12345678901234567890" in base32.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

test('RFC 6238 T=59 gives 287082 (6 digits)', () => {
  assert.equal(totp(SECRET, 59000), '287082')
})

test('RFC 6238 T=59 gives 94287082 (8 digits)', () => {
  assert.equal(totp(SECRET, 59000, 30, 8), '94287082')
})

test('RFC 6238 T=1111111109 gives 081804 (leading zero kept)', () => {
  assert.equal(totp(SECRET, 1111111109000), '081804')
})

test('RFC 6238 T=1234567890 gives 005924', () => {
  assert.equal(totp(SECRET, 1234567890000), '005924')
})

test('RFC 6238 T=2000000000 gives 279037', () => {
  assert.equal(totp(SECRET, 2000000000000), '279037')
})

test('base32Decode ignores trailing padding and lowercase', () => {
  const plain = base32Decode(SECRET)
  assert.equal(plain.toString('utf8'), '12345678901234567890')
  assert.deepEqual(base32Decode(SECRET.toLowerCase() + '===='), plain)
})

test('base32Decode rejects invalid characters without echoing the input', () => {
  const bad = 'GEZDG-SECRET-1!'
  assert.throws(
    () => base32Decode(bad),
    (err: unknown) =>
      err instanceof Error &&
      err.message === 'totp: invalid base32 secret' &&
      !err.message.includes(bad),
  )
  assert.throws(() => totp('not*valid', 59000), /invalid base32 secret/)
})

test('totp uses the current time by default and returns 6 digits', () => {
  assert.match(totp(SECRET), /^\d{6}$/)
})
