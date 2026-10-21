/**
 * Mobile or desktop from request headers: the `Sec-CH-UA-Mobile` client hint
 * when present, else a User-Agent regex. Pure, so the server render
 * (src/lib/device.ts) and the Worker's anonymous HTML cache key
 * (src/server/anon-html-cache.ts) always agree.
 */
export function isMobileFromHeaders(h: { get(name: string): string | null }): boolean {
  const chUaMobile = h.get('sec-ch-ua-mobile')
  if (chUaMobile === '?1') return true
  if (chUaMobile === '?0') return false
  const ua = h.get('user-agent') ?? ''
  return /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/.test(ua)
}
