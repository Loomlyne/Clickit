/**
 * Cloudflare Web Analytics beacon attributes. The token is a public site token
 * from the Cloudflare dashboard (NEXT_PUBLIC_CF_BEACON_TOKEN); with no token
 * nothing renders. SPA tracking is automatic, so `spa` is not set.
 */
export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'

const TOKEN_RE = /^[A-Za-z0-9_-]{1,128}$/

export function beaconAttributes(token: string | undefined | null): { src: string; 'data-cf-beacon': string } | null {
  const value = typeof token === 'string' ? token.trim() : ''
  if (!TOKEN_RE.test(value)) return null
  return { src: BEACON_SRC, 'data-cf-beacon': JSON.stringify({ token: value }) }
}
