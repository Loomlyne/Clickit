// D-11 / Q17: leaked-password check against Have I Been Pwned (k-anonymity range API).
// Pure: no imports. Only the first 5 hex characters of the SHA-1 leave the server;
// Padded responses hide the response size. Nothing here logs anything.
//
// This module fails OPEN (null) on purpose: an HIBP outage must not block sign-up.
// Callers log `[auth/hibp] unavailable` with no password data and allow.
// That is the opposite polarity from Turnstile (src/server/turnstile.ts), which
// fails closed.

export const HIBP_TIMEOUT_MS = 3000

const RANGE_URL = 'https://api.pwnedpasswords.com/range/'

async function sha1Upper(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

// true = seen in a breach, false = not seen, null = unknown (timeout, network, non-200).
export async function isPwned(
  password: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = HIBP_TIMEOUT_MS,
): Promise<boolean | null> {
  const sha1 = await sha1Upper(password)
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  // The race also covers a fetch that ignores the abort signal.
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve(null)
    }, timeoutMs)
  })

  const lookup = (async (): Promise<boolean | null> => {
    const res = await fetchImpl(`${RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = await res.text()
    return body.split(/\r?\n/).some((line) => {
      const [s, count] = line.split(':')
      return s?.trim().toUpperCase() === suffix && Number(count) > 0
    })
  })().catch(() => null)

  try {
    return await Promise.race([lookup, timeout])
  } finally {
    clearTimeout(timer)
  }
}
