// Gateway session verifier (phase 02.1, D-12). Pure: no Workers runtime import,
// no `@/` alias, Web Crypto only, so node:test runs it as it is.
//
// The gateway classifies every request before any render:
// - user:   the Supabase auth cookie holds a JWT that verifies like
//           auth-js getClaims(): alg exactly ES256, kid in the project JWKS,
//           ECDSA P-256 / SHA-256 signature over `<header>.<payload>`,
//           exp in the future and a non-empty sub;
// - bypass: an auth cookie is present but fails any of those checks (or the
//           JWKS cannot be fetched); the request goes to OpenNext, where the
//           proxy refreshes or clears the cookie;
// - anon:   no auth cookie, or only the PKCE `<name>-code-verifier`.
// Cookie presence alone never gives user.
//
// Cookie format (@supabase/ssr 0.10.0): name `sb-<first hostname label>-auth-token`;
// value `base64-` + base64url(JSON session) or legacy raw JSON; split into
// `<name>.0`, `<name>.1`, ... when long (the plain name is read first, then the
// chunks until the first gap).

export type SessionClass = 'user' | 'anon' | 'bypass'
export type SessionVerdict = { cls: SessionClass; reason: string }
export type Jwks = { keys: Array<JsonWebKey & { kid?: string; alg?: string }> }
export type JwksFetcher = (url: string) => Promise<Jwks>

const BASE64_PREFIX = 'base64-'
const BASE64URL = /^[A-Za-z0-9_-]+$/
const DEFAULT_JWKS_TTL_MS = 600_000 // auth-js JWKS_TTL
const DEFAULT_UNKNOWN_KID_REFETCH_MS = 60_000
const DEFAULT_MAX_COOKIE_BYTES = 16_384
const ES256_IMPORT = { name: 'ECDSA', namedCurve: 'P-256' } as const
const ES256_VERIFY = { name: 'ECDSA', hash: 'SHA-256' } as const
const P256_SIGNATURE_BYTES = 64

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Cookie header -> name/value map; the first occurrence of a name wins. */
function parseCookies(cookieHeader: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (!name || out.has(name)) continue
    let value = part.slice(eq + 1).trim()
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    out.set(name, safeDecode(value))
  }
  return out
}

export function readAuthCookie(
  cookieHeader: string | null,
  cookieName: string,
): { present: boolean; value: string | null; verifierOnly: boolean } {
  if (!cookieHeader) return { present: false, value: null, verifierOnly: false }
  const cookies = parseCookies(cookieHeader)
  const plain = cookies.get(cookieName)
  if (plain) return { present: true, value: plain, verifierOnly: false }
  const chunks: string[] = []
  for (let i = 0; ; i++) {
    const chunk = cookies.get(`${cookieName}.${i}`)
    if (!chunk) break
    chunks.push(chunk)
  }
  if (chunks.length > 0) return { present: true, value: chunks.join(''), verifierOnly: false }
  return { present: false, value: null, verifierOnly: cookies.has(`${cookieName}-code-verifier`) }
}

function bytesFromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL.test(text) || text.length % 4 === 1) return null
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function stringFromBase64Url(text: string): string | null {
  const bytes = bytesFromBase64Url(text)
  if (!bytes) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function decodeSessionCookie(value: string): { accessToken: string } | null {
  let json: string | null = value
  if (value.startsWith(BASE64_PREFIX)) json = stringFromBase64Url(value.slice(BASE64_PREFIX.length))
  if (json === null) return null
  const session = parseJsonObject(json)
  const token = session?.access_token
  return typeof token === 'string' && token.length > 0 ? { accessToken: token } : null
}

type ParsedJwt = {
  kid: string
  payload: Record<string, unknown>
  signed: Uint8Array<ArrayBuffer>
  signature: Uint8Array<ArrayBuffer>
}

function parseJwt(token: string): ParsedJwt | string {
  const parts = token.split('.')
  if (parts.length !== 3) return 'jwt-parts'
  const [rawHeader, rawPayload, rawSignature] = parts
  const headerText = stringFromBase64Url(rawHeader)
  const header = headerText === null ? null : parseJsonObject(headerText)
  if (!header) return 'jwt-header'
  if (header.alg !== 'ES256') return 'alg-not-es256'
  if (typeof header.kid !== 'string' || header.kid.length === 0) return 'no-kid'
  const payloadText = stringFromBase64Url(rawPayload)
  const payload = payloadText === null ? null : parseJsonObject(payloadText)
  if (!payload) return 'jwt-payload'
  const signature = bytesFromBase64Url(rawSignature)
  if (!signature || signature.length !== P256_SIGNATURE_BYTES) return 'jwt-signature-shape'
  return { kid: header.kid, payload, signed: new TextEncoder().encode(`${rawHeader}.${rawPayload}`) as Uint8Array<ArrayBuffer>, signature }
}

export function createSessionVerifier(opts: {
  jwksUrl: string
  fetchJwks: JwksFetcher
  now?: () => number // ms
  jwksTtlMs?: number // default 600_000 (auth-js JWKS_TTL)
  unknownKidRefetchMs?: number // default 60_000
  maxCookieBytes?: number // default 16_384; larger => bypass
}): { classify(cookieHeader: string | null, cookieName: string): Promise<SessionVerdict> } {
  const now = opts.now ?? (() => Date.now())
  const ttl = opts.jwksTtlMs ?? DEFAULT_JWKS_TTL_MS
  const unknownKidRefetch = opts.unknownKidRefetchMs ?? DEFAULT_UNKNOWN_KID_REFETCH_MS
  const maxBytes = opts.maxCookieBytes ?? DEFAULT_MAX_COOKIE_BYTES

  let jwks: Jwks | null = null
  let fetchedAt = Number.NEGATIVE_INFINITY
  let inflight: Promise<Jwks> | null = null
  const keys = new Map<string, Promise<CryptoKey>>()

  function refresh(): Promise<Jwks> {
    inflight ??= opts
      .fetchJwks(opts.jwksUrl)
      .then((fresh) => {
        if (!fresh || !Array.isArray(fresh.keys)) throw new Error('jwks has no keys array')
        jwks = fresh
        fetchedAt = now()
        keys.clear()
        return fresh
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  async function currentJwks(): Promise<Jwks> {
    if (jwks && now() - fetchedAt < ttl) return jwks
    return refresh()
  }

  async function jwkFor(kid: string): Promise<(JsonWebKey & { kid?: string; alg?: string }) | null> {
    let set = await currentJwks()
    let jwk = set.keys.find((k) => k.kid === kid)
    // Unknown kid: refetch at most once per unknownKidRefetchMs per isolate
    // (any fetch counts), so forged kids cannot amplify into subrequests.
    if (!jwk && now() - fetchedAt >= unknownKidRefetch) {
      set = await refresh()
      jwk = set.keys.find((k) => k.kid === kid)
    }
    return jwk ?? null
  }

  function cryptoKeyFor(kid: string, jwk: JsonWebKey): Promise<CryptoKey> {
    let key = keys.get(kid)
    if (!key) {
      const material: JsonWebKey = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }
      key = crypto.subtle.importKey('jwk', material, ES256_IMPORT, false, ['verify'])
      key.catch(() => keys.delete(kid))
      keys.set(kid, key)
    }
    return key
  }

  async function verifyToken(token: string): Promise<SessionVerdict> {
    const jwt = parseJwt(token)
    if (typeof jwt === 'string') return { cls: 'bypass', reason: jwt }
    let jwk: JsonWebKey & { alg?: string } | null
    try {
      jwk = await jwkFor(jwt.kid)
    } catch {
      return { cls: 'bypass', reason: 'jwks-unavailable' }
    }
    if (!jwk) return { cls: 'bypass', reason: 'unknown-kid' }
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || (jwk.alg !== undefined && jwk.alg !== 'ES256')) {
      return { cls: 'bypass', reason: 'jwk-not-es256' }
    }
    let valid: boolean
    try {
      const key = await cryptoKeyFor(jwt.kid, jwk)
      valid = await crypto.subtle.verify(ES256_VERIFY, key, jwt.signature, jwt.signed)
    } catch {
      return { cls: 'bypass', reason: 'verify-error' }
    }
    if (!valid) return { cls: 'bypass', reason: 'bad-signature' }
    const { exp, sub } = jwt.payload
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return { cls: 'bypass', reason: 'no-exp' }
    if (exp * 1000 <= now()) return { cls: 'bypass', reason: 'expired' }
    if (typeof sub !== 'string' || sub.length === 0) return { cls: 'bypass', reason: 'no-sub' }
    return { cls: 'user', reason: 'verified' }
  }

  async function classify(cookieHeader: string | null, cookieName: string): Promise<SessionVerdict> {
    try {
      const cookie = readAuthCookie(cookieHeader, cookieName)
      if (!cookie.present || cookie.value === null) {
        return { cls: 'anon', reason: cookie.verifierOnly ? 'verifier-only' : 'no-auth-cookie' }
      }
      if (cookie.value.length > maxBytes) return { cls: 'bypass', reason: 'cookie-too-large' }
      const session = decodeSessionCookie(cookie.value)
      if (!session) return { cls: 'bypass', reason: 'malformed-cookie' }
      return await verifyToken(session.accessToken)
    } catch {
      return { cls: 'bypass', reason: 'error' }
    }
  }

  return { classify }
}
