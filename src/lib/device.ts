import { headers } from 'next/headers'

/**
 * Server-side viewport detection via User-Agent + client hints.
 *
 * Used to render only one media variant (desktop OR mobile) in responsive
 * heroes, avoiding the default behavior of rendering both and letting CSS hide
 * one — which still causes the browser to download both videos.
 *
 * Prefers the `Sec-CH-UA-Mobile` client hint when present; falls back to a
 * User-Agent regex. Neither method is perfect — user agents can lie and client
 * hints require a browser opt-in — but for optimization-not-security this is
 * the right tradeoff.
 */
export async function getIsMobile(): Promise<boolean> {
  const h = await headers()
  const chUaMobile = h.get('sec-ch-ua-mobile')
  if (chUaMobile === '?1') return true
  if (chUaMobile === '?0') return false
  const ua = h.get('user-agent') ?? ''
  return /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/.test(ua)
}
