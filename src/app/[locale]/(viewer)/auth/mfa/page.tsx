import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { MfaEnrol } from '@/components/auth/mfa-enrol'
import { MfaVerify } from '@/components/auth/mfa-verify'
import { redirect } from '@/i18n/navigation'
import { getSafeAuthNextPath } from '@/lib/auth-navigation'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_MFA_MAX_AGE_HOURS } from '@/server/admin-access'
import { getAdminStatus } from '@/server/auth-guards'
import { mfaStep } from '@/server/auth/mfa-core'

// AUTH-06 / D-18 (Q7 = A, URL per research F10): the full-page authenticator
// step shown before any admin screen. It lives under the public /auth/* path,
// so the admin layout (the gate) cannot loop. This page decides only where to
// send the visitor; every action re-checks the admin itself.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: `${t('mfaOverline')} | Clickit Story`,
    robots: { index: false, follow: false },
  }
}

export default async function AdminMfaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ next?: string | string[] }>
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const rawNext = Array.isArray(query?.next) ? query.next[0] : query?.next
  const next = getSafeAuthNextPath(rawNext, '/admin')

  const status = await getAdminStatus()
  if (!status.signedIn) {
    // Back through sign-in; the admin layout then sends the admin here again.
    return redirect({ href: { pathname: '/auth', query: { next } }, locale })
  }
  if (!status.isAdmin) return redirect({ href: '/watch', locale })
  if (status.mfa === 'ok') return redirect({ href: next, locale })

  const supabase = await createClient()
  const [factors, claims] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.getClaims(),
  ])
  // listFactors failing: fall back to the gate's own factor answer.
  const verifiedTotp = factors.error
    ? status.mfa === 'needs_code'
      ? 1
      : 0
    : (factors.data?.totp.length ?? 0)

  if (mfaStep({ verifiedTotp }) === 'enrol') {
    return <MfaEnrol next={next} />
  }

  // aal2 but the TOTP entry is older than the limit: say why we ask again.
  const stale = claims.data?.claims.aal === 'aal2' && status.mfa === 'needs_code'
  return <MfaVerify next={next} stale={stale} staleHours={ADMIN_MFA_MAX_AGE_HOURS} />
}
