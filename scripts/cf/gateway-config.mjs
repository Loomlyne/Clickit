// Public gateway config (phase 02.1). NEXT_PUBLIC_* values are inlined into the
// Next bundle at build time and `.open-next/cloudflare/next-env.mjs` is empty,
// so the gateway in custom-worker.ts reads the Supabase URL, the auth cookie
// name and the JWKS URL from this generated file instead. Public values only:
// never a key, a secret or a token. scripts/cf/build-target.mjs writes it
// right after the build stamp.

export const GATEWAY_CONFIG_PATH = '.open-next/clickit-gateway-config.json'

/**
 * Same rule as supabase-js (SupabaseClient defaultStorageKey):
 * `sb-<first hostname label>-auth-token`.
 * @param {string} supabaseUrl
 * @returns {string}
 */
export function authCookieNameFor(supabaseUrl) {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ supabaseUrl: string, authCookieName: string, jwksUrl: string }}
 */
export function gatewayConfigFromEnv(env) {
  const raw = String(env?.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  if (!raw) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing: cannot write the gateway config')
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a URL: cannot write the gateway config')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be http(s): cannot write the gateway config')
  }
  const supabaseUrl = `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  return {
    supabaseUrl,
    authCookieName: authCookieNameFor(supabaseUrl),
    jwksUrl: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
  }
}
