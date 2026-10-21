// Signed email link tokens (D-32 newsletter confirm, D-35 unsubscribe; RESEARCH
// Pattern 5). Pure: no imports, WebCrypto only, so it runs on workerd and Node.
//
// Token = base64url("kind.id.exp") + "." + base64url(HMAC-SHA256(secret, thatBase64Payload)).
// - The kind is inside the signed payload, so a token minted for one use cannot be
//   replayed for another (a confirm link is not an unsubscribe link).
// - Confirm links carry an expiry (7 days); unsubscribe links carry none (RFC 8058).
// - The signature is checked with the WebCrypto HMAC verify call (constant time); signatures
//   are never compared as strings.
// - Never log a token: it is a bearer credential for one action.

export const LINK_KINDS = ['unsub_digest', 'newsletter_confirm'] as const
export type LinkKind = (typeof LINK_KINDS)[number]

export const NEWSLETTER_CONFIRM_TTL_DAYS = 7

export type VerifyLinkResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'unavailable' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    // Canonical form only: refuse encodings with stray trailing bits.
    return toBase64Url(out) === text ? out : null
  } catch {
    return null
  }
}

function usableSecret(secret: unknown): string | null {
  return typeof secret === 'string' && secret.trim() !== '' ? secret : null
}

function importKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

export async function signLinkToken(input: {
  kind: LinkKind
  id: string
  expSec: number | null
  secret: string
}): Promise<string> {
  const secret = usableSecret(input.secret)
  if (!secret) throw new Error('link secret is not configured')
  if (!(LINK_KINDS as readonly string[]).includes(input.kind)) throw new Error('unknown link kind')
  if (typeof input.id !== 'string' || !UUID_RE.test(input.id)) throw new Error('link id must be a uuid')
  let exp = 0
  if (input.expSec !== null) {
    if (!Number.isSafeInteger(input.expSec) || input.expSec <= 0) throw new Error('invalid expiry')
    exp = input.expSec
  }
  if (input.kind === 'newsletter_confirm' && exp === 0) {
    throw new Error('confirm links must expire')
  }
  const payload = toBase64Url(encoder.encode(`${input.kind}.${input.id}.${exp}`))
  const key = await importKey(secret, 'sign')
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`
}

export async function verifyLinkToken(
  token: string,
  expectedKind: LinkKind,
  secret: string,
  nowSec: number,
): Promise<VerifyLinkResult> {
  const usable = usableSecret(secret)
  if (!usable) return { ok: false, reason: 'unavailable' }
  const invalid = { ok: false, reason: 'invalid' } as const
  try {
    if (typeof token !== 'string' || token.length > 512 || !TOKEN_RE.test(token)) return invalid
    const [payloadB64, sigB64] = token.split('.')
    const sig = fromBase64Url(sigB64)
    if (!sig) return invalid
    const key = await importKey(usable, 'verify')
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sig as BufferSource,
      encoder.encode(payloadB64),
    )
    if (!valid) return invalid

    const payloadBytes = fromBase64Url(payloadB64)
    if (!payloadBytes) return invalid
    const parts = decoder.decode(payloadBytes).split('.')
    if (parts.length !== 3) return invalid
    const [kind, id, expText] = parts
    if (kind !== expectedKind) return invalid
    if (!UUID_RE.test(id)) return invalid
    if (!/^\d{1,15}$/.test(expText)) return invalid
    const exp = Number(expText)
    if (kind === 'newsletter_confirm' && exp === 0) return invalid
    if (exp > 0 && nowSec > exp) return { ok: false, reason: 'expired' }
    return { ok: true, id }
  } catch {
    return invalid
  }
}
