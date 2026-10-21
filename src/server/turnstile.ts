// Turnstile server-side verification (PLAT-05, T-02-16, T-02-17).
// Every failure refuses. The reason strings are fixed codes plus Cloudflare's
// first error code; they never contain the secret, the token or a raw error
// message. No logging in this file.

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const MAX_TOKEN_LENGTH = 2048
const DEFAULT_TIMEOUT_MS = 5000

export type TurnstileResult = { ok: true } | { ok: false; reason: string }

export async function verifyTurnstileToken(input: {
  token: string | null | undefined
  secret: string | null | undefined
  ip?: string | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<TurnstileResult> {
  const secret = typeof input.secret === 'string' ? input.secret.trim() : ''
  if (secret === '') return { ok: false, reason: 'missing-secret' }
  const token = typeof input.token === 'string' ? input.token.trim() : ''
  if (token === '') return { ok: false, reason: 'missing-token' }
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'token-too-long' }

  const body = new URLSearchParams({ secret, response: token })
  if (typeof input.ip === 'string' && input.ip !== '') body.set('remoteip', input.ip)

  const doFetch = input.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  let response: Response
  try {
    response = await doFetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    })
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'network-error' }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) return { ok: false, reason: `http-${response.status}` }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    return { ok: false, reason: 'bad-response' }
  }
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'bad-response' }
  const record = data as { success?: unknown; 'error-codes'?: unknown }
  if (record.success === true) return { ok: true }
  const codes = record['error-codes']
  const first = Array.isArray(codes) && typeof codes[0] === 'string' ? codes[0] : null
  return { ok: false, reason: first ? `rejected:${first}` : 'rejected' }
}
