// Test and local-seed helper only. Never imported by app code.
// Secrets passed in are never logged.
// RFC 6238 TOTP (HMAC-SHA1) using node:crypto. Appendix B vector:
// secret "12345678901234567890", T=59s -> 94287082 (8 digits) => 287082 (6 digits).
import { createHmac } from 'node:crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Decode(secret) {
  const clean = String(secret).toUpperCase().replace(/[=\s]/g, '')
  let bits = ''
  for (const c of clean) {
    const idx = B32.indexOf(c)
    if (idx < 0) throw new Error('totp: invalid base32 secret')
    bits += idx.toString(2).padStart(5, '0')
  }
  const out = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    out.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(out)
}

export function totp(secretBase32, nowMs = Date.now(), step = 30, digits = 6) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / step)))
  const h = createHmac('sha1', base32Decode(secretBase32))
    .update(counter)
    .digest()
  const o = h[h.length - 1] & 0xf
  const bin =
    ((h[o] & 0x7f) << 24) |
    (h[o + 1] << 16) |
    (h[o + 2] << 8) |
    h[o + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}
