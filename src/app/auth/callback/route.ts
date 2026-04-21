import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { routing } from '@/i18n/routing'
import { LOCALE_COOKIE } from '@/lib/locale'

/**
 * Validate a caller-supplied `?next=` query value and return a same-origin,
 * locale-prefixed path safe to redirect to.
 *
 * Invariants (preserved from the pre-phase version):
 *   - Must start with a single `/` — rejects //attacker.com (protocol-relative)
 *   - Must not start with `/\\` — rejects /\\attacker.com (backslash trick)
 *   - Must not start with `//` — same
 *   - On any rejection: return `/${locale}` (safe default landing page)
 *
 * New invariant (Pitfall 4 / RTE-06):
 *   - If the validated path already starts with `/en/` or `/ar/`, keep it as-is.
 *   - Otherwise, prepend `/${locale}` so the redirect lands in the active
 *     locale segment. Handles the `/` root case: `/` → `/${locale}` (not
 *     `/${locale}/` — next-intl normalizes both).
 */
function safeNext(raw: string | null, locale: string): string {
  if (!raw) return `/${locale}`
  if (!raw.startsWith('/')) return `/${locale}`
  if (raw.startsWith('//') || raw.startsWith('/\\')) return `/${locale}`

  // Already carries a valid locale prefix? Keep it.
  for (const loc of routing.locales) {
    if (raw === `/${loc}` || raw.startsWith(`/${loc}/`)) {
      return raw
    }
  }

  // Plain path — prepend active locale. `/` becomes `/${locale}`.
  if (raw === '/') return `/${locale}`
  return `/${locale}${raw}`
}

/**
 * Resolve the active locale for this callback request. Order:
 *   1. NEXT_LOCALE cookie (set by the URL switcher in plan 13-05, and by
 *      next-intl on first successful locale-prefixed request).
 *   2. routing.defaultLocale ('en').
 */
function resolveLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && (routing.locales as readonly string[]).includes(cookie)) {
    return cookie
  }
  return routing.defaultLocale
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const locale = resolveLocale(request)
  const next = safeNext(searchParams.get('next'), locale)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession failed', error)
  }

  // Error path — land on the locale's auth screen, not bare /auth.
  return NextResponse.redirect(
    `${origin}/${locale}/auth?error=Could not verify your identity`
  )
}
