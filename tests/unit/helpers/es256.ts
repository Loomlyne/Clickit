// ES256 test fixtures for the gateway session verifier (plan 02.1-01).
// Generates P-256 key pairs with Web Crypto, signs JWTs (raw r||s, which is
// what Web Crypto produces and what JWT ES256 uses) and builds Supabase auth
// cookies in the @supabase/ssr 0.10.0 shapes: `base64-` + base64url(JSON),
// chunked `.0/.1` by the 3180 encodeURIComponent-length rule, and legacy raw
// JSON. Test-only: nothing here is a real key or a real session.

export type TestKey = {
  kid: string
  privateKey: CryptoKey
  publicJwk: JsonWebKey & { kid: string; alg: string }
}

const ES256 = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const

/** Same chunk size as @supabase/ssr utils/chunker.js MAX_CHUNK_SIZE. */
export const SSR_MAX_CHUNK_SIZE = 3180

export function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlFromString(text: string): string {
  return base64UrlFromBytes(new TextEncoder().encode(text))
}

export async function generateTestKey(kid: string): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey(ES256, true, ['sign', 'verify'])) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return {
    kid,
    privateKey: pair.privateKey,
    publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, kid, alg: 'ES256', use: 'sig', key_ops: ['verify'], ext: true },
  }
}

export type SignOptions = {
  /** Override the header alg (the signature is still ES256 over the given header). */
  alg?: string
  /** Override or drop the header kid (null drops it). */
  kid?: string | null
}

export async function signJwt(key: TestKey, payload: Record<string, unknown>, options: SignOptions = {}): Promise<string> {
  const header: Record<string, unknown> = { alg: options.alg ?? 'ES256', typ: 'JWT' }
  const kid = options.kid === undefined ? key.kid : options.kid
  if (kid !== null) header.kid = kid
  const head = base64UrlFromString(JSON.stringify(header))
  const body = base64UrlFromString(JSON.stringify(payload))
  const signature = new Uint8Array(
    await crypto.subtle.sign(SIGN, key.privateKey, new TextEncoder().encode(`${head}.${body}`)),
  )
  return `${head}.${body}.${base64UrlFromBytes(signature)}`
}

/** A Supabase-shaped JWT payload; `expSeconds` is absolute epoch seconds. */
export function claims(expSeconds: number, sub: unknown = '00000000-0000-4000-8000-000000000001'): Record<string, unknown> {
  const out: Record<string, unknown> = {
    aud: 'authenticated',
    exp: expSeconds,
    iat: expSeconds - 3600,
    role: 'authenticated',
    session_id: '00000000-0000-4000-8000-0000000000aa',
  }
  if (sub !== undefined) out.sub = sub
  return out
}

/** The JSON session @supabase/ssr stores; `padding` grows it past one chunk. */
export function sessionJson(accessToken: string, padding = 0): string {
  return JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 0,
    refresh_token: 'test-refresh-fixture',
    user: { id: '00000000-0000-4000-8000-000000000001', user_metadata: { note: 'x'.repeat(padding) } },
  })
}

/** `base64-` + base64url(JSON), the default @supabase/ssr encoding. */
export function base64CookieValue(json: string): string {
  return `base64-${base64UrlFromString(json)}`
}

/** @supabase/ssr createChunks: split by the encodeURIComponent length. */
export function chunkCookie(name: string, value: string, chunkSize = SSR_MAX_CHUNK_SIZE): Array<{ name: string; value: string }> {
  let encoded = encodeURIComponent(value)
  if (encoded.length <= chunkSize) return [{ name, value }]
  const pieces: string[] = []
  while (encoded.length > 0) {
    let head = encoded.slice(0, chunkSize)
    const lastEscape = head.lastIndexOf('%')
    if (lastEscape > chunkSize - 3) head = head.slice(0, lastEscape)
    pieces.push(decodeURIComponent(head))
    encoded = encoded.slice(head.length)
  }
  return pieces.map((piece, i) => ({ name: `${name}.${i}`, value: piece }))
}

/** A Cookie request header; values are URI-encoded as the `cookie` serializer does. */
export function cookieHeader(pairs: Array<{ name: string; value: string }>): string {
  return pairs.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join('; ')
}
