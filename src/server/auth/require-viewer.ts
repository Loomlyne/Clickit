import 'server-only'
import type { User } from '@supabase/supabase-js'
import { redirect } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { viewerAccess } from './viewer-access'

// AUTH-01 / D-01: every walled viewer page calls this on the server before it
// renders, so the wall does not rest on the proxy alone. getUser() asks the
// Auth server (not the cookie claims). Pages pass their own path (for dynamic
// routes the concrete one, e.g. `/series/${slug}`), never a query-string
// value, so `next` stays a same-site path (D-04). The redirect throws Next's
// control-flow signal: a caller that wraps this in try/catch must call
// unstable_rethrow(e) first.
export async function requireViewer(
  locale: string,
  pathWithoutLocale: string
): Promise<{ userId: string; user: User }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const decision = viewerAccess(pathWithoutLocale, user?.id ?? null)
  // Only walled pages call this. Should a public path ever call it signed
  // out, there is no viewer to return, so it goes to sign-in too.
  if (decision.action === 'auth' || !user) {
    const next = decision.action === 'auth' ? decision.next : pathWithoutLocale
    return redirect({ href: `/auth?next=${encodeURIComponent(next)}`, locale })
  }
  return { userId: user.id, user }
}
