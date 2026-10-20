// Local-only upload shim (T-02-56). `opennextjs-cloudflare preview` has a local
// R2 with no S3 endpoint, so a presigned PUT cannot be exercised there. In
// preview the action hands out URLs to /api/dev/r2-put/<key> instead, and the
// route writes through the MEDIA binding. The shim answers only when ALL hold:
//   LOCAL_DEV === "1", Host is 127.0.0.1[:port], and an HMAC token bound to the
//   key and content type is valid and younger than 300 s.
// Anything else is 404 (hidden) or 403 (bad token). The secret is
// LOCAL_UPLOAD_SHIM_SECRET from the gitignored .dev.vars; it is never a wrangler
// secret or var. Pure: no imports; uses WebCrypto.

export const SHIM_TOKEN_TTL_MS = 300_000
export const SHIM_MIN_SECRET_LENGTH = 32
const MAX_FUTURE_SKEW_MS = 5_000
const HOST_RE = /^127\.0\.0\.1(?::([0-9]{1,5}))?$/

const encoder = new TextEncoder()

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

function unhex(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/.test(value)) return null
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

function message(ts: string, key: string, contentType: string) {
  return encoder.encode(`${ts}\n${key}\n${contentType}`)
}

export async function mintShimToken(
  key: string,
  contentType: string,
  secret: string,
  now: number = Date.now()
): Promise<string> {
  if (typeof secret !== 'string' || secret.length < SHIM_MIN_SECRET_LENGTH) {
    throw new Error('LOCAL_UPLOAD_SHIM_SECRET is missing or shorter than 32 characters')
  }
  const ts = String(Math.trunc(now))
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), message(ts, key, contentType))
  return `${ts}.${hex(mac)}`
}

export type ShimCheck = { ok: true } | { ok: false; status: 404 | 403 }

export async function checkShimRequest(input: {
  localDev: string | undefined
  host: string | null | undefined
  token: string | null | undefined
  key: string
  contentType: string
  secret: string | undefined
  now?: number
}): Promise<ShimCheck> {
  if (input.localDev !== '1') return { ok: false, status: 404 }
  const hostMatch = typeof input.host === 'string' ? HOST_RE.exec(input.host) : null
  if (!hostMatch || (hostMatch[1] !== undefined && Number(hostMatch[1]) > 65535)) return { ok: false, status: 404 }
  if (typeof input.secret !== 'string' || input.secret.length < SHIM_MIN_SECRET_LENGTH) {
    return { ok: false, status: 404 }
  }

  const token = typeof input.token === 'string' ? input.token : ''
  const dot = token.indexOf('.')
  const ts = dot > 0 ? token.slice(0, dot) : ''
  const mac = dot > 0 ? unhex(token.slice(dot + 1)) : null
  if (!/^[0-9]{10,16}$/.test(ts) || !mac) return { ok: false, status: 403 }

  const now = input.now ?? Date.now()
  const age = now - Number(ts)
  if (age > SHIM_TOKEN_TTL_MS || age < -MAX_FUTURE_SKEW_MS) return { ok: false, status: 403 }

  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(input.secret, 'verify'),
    mac,
    message(ts, input.key, input.contentType)
  )
  return valid ? { ok: true } : { ok: false, status: 403 }
}
