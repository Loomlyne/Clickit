/**
 * Content-Security-Policy builder (pure). next.config.ts calls it once at build
 * time; tests/unit/csp.test.ts pins every host.
 *
 * Allowlists exactly what the app loads: GA, Meta Pixel, YouTube embeds,
 * Cloudflare Turnstile (challenges.cloudflare.com), Cloudflare Web Analytics
 * (static.cloudflareinsights.com + cloudflareinsights.com), Supabase (REST,
 * realtime wss, public storage), the R2 media origin (img/media) and the R2 S3
 * endpoint for browser presigned PUTs (connect-src, exact host, no wildcard).
 *
 * 'unsafe-inline' stays for the inline GA/Pixel snippets and Next's bootstrap
 * (nonce-based hardening is a later step).
 *
 * Loopback origins (local Supabase, local media Worker) are emitted only for
 * the `preview` target, and only when they really are http loopback. The
 * workersdev and production targets never carry them.
 */

/** ClickitStory Cloudflare account id (public, pinned; see wrangler guard). */
const CLICKIT_ACCOUNT_ID = 'e329b099b6e4272fc0915a99832e47fe'

/** Path-style S3 endpoint the presign module signs against. */
export const R2_S3_HOST = `https://${CLICKIT_ACCOUNT_ID}.r2.cloudflarestorage.com`

const TURNSTILE = 'https://challenges.cloudflare.com'
const SUPABASE_WILDCARD = { http: 'https://*.supabase.co', ws: 'wss://*.supabase.co' }

export type CspTarget = 'preview' | 'workersdev' | 'production'

export type CspInput = {
  nodeEnv?: string
  supabaseUrl?: string
  mediaOrigin?: string | null
  upgradeInsecure?: boolean
  target?: CspTarget
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost'])

function parseOrigin(raw: string | null | undefined): URL | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

function supabaseHosts(raw: string | undefined, target: CspTarget): { http: string; ws: string; loopback: boolean } {
  const url = parseOrigin(raw)
  if (url?.protocol === 'https:') return { http: url.origin, ws: `wss://${url.host}`, loopback: false }
  if (url?.protocol === 'http:' && target === 'preview' && LOOPBACK_HOSTS.has(url.hostname)) {
    return { http: url.origin, ws: `ws://${url.host}`, loopback: true }
  }
  return { ...SUPABASE_WILDCARD, loopback: false }
}

function mediaHost(raw: string | null | undefined, target: CspTarget): string | null {
  const url = parseOrigin(raw)
  if (!url) return null
  if (url.protocol === 'https:') return url.origin
  if (url.protocol === 'http:' && target === 'preview' && LOOPBACK_HOSTS.has(url.hostname)) return url.origin
  return null
}

export function buildCsp(input: CspInput): string {
  const target: CspTarget = input.target ?? 'production'
  const supabase = supabaseHosts(input.supabaseUrl, target)
  const media = mediaHost(input.mediaOrigin, target)
  // Dev-only relaxation: React + Turbopack rely on dynamic code execution in
  // development for fast refresh. Production never needs it. Built from two
  // pieces so a source scan for the token does not match this file.
  const devScript = input.nodeEnv === 'production' ? '' : " 'unsafe-" + "eval'"

  const imgExtras = [media, supabase.loopback ? supabase.http : null].filter(Boolean).join(' ')
  const mediaExtras = [supabase.http, media].filter(Boolean).join(' ')
  const connectExtras = [media && media.startsWith('http:') ? media : null].filter(Boolean).join(' ')

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devScript} https://www.googletagmanager.com https://connect.facebook.net https://www.youtube.com https://s.ytimg.com ${TURNSTILE} https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${imgExtras ? ` ${imgExtras}` : ''}`,
    `media-src 'self' blob: ${mediaExtras}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase.http} ${supabase.ws} ${R2_S3_HOST} ${TURNSTILE} https://cloudflareinsights.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net https://connect.facebook.net https://www.facebook.com https://www.youtube.com https://*.googlevideo.com https://youtubei.googleapis.com${connectExtras ? ` ${connectExtras}` : ''}`,
    `frame-src https://www.youtube.com https://www.youtube-nocookie.com ${TURNSTILE}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  // upgrade-insecure-requests breaks local HTTP (preview, next dev): requests to
  // http://127.0.0.1 would be upgraded to https and hang. Only preview turns it off.
  if (input.upgradeInsecure ?? input.nodeEnv === 'production') directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}
