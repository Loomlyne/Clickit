import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Only accept `next` values that are same-origin, path-only redirects.
 * Rejects: `//attacker.com`, `http://attacker.com`, `javascript:...`, `\\attacker.com`.
 * This prevents the OAuth callback from being used as an open-redirect phishing
 * vector — an attacker otherwise hands the user a link like
 *   /auth/callback?code=X&next=//attacker.com
 * and the browser interprets the concatenation as a protocol-relative URL.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/'
  // Must start with a single `/` and must not start with `//` or `/\\`.
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession failed', error)
  }

  return NextResponse.redirect(`${origin}/auth?error=Could not verify your identity`)
}
