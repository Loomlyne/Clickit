import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ConfirmExpiredCard, ConfirmLinkForm } from '@/components/auth/confirm-link-form'
import { expiredRetryHref, parseConfirmParams } from '@/server/auth/confirm-core'

// AUTH-04 / D-12, D-13 (UI-SPEC 6.3): the target of every auth email link
// (token_hash + type). GET only reads the query and shows one button; mail
// scanners prefetch links, so the token is spent only by the confirmLink action
// when the visitor presses it (T-05-23-01). The token is in the URL: no
// Referer leaves this page and it is never indexed (T-05-23-02).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: `${t('confirmSignupTitle')} | Clickit Story`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

type Query = { token_hash?: string | string[]; type?: string | string[]; next?: string | string[] }

export default async function ConfirmLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Query>
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const parsed = parseConfirmParams(query)

  if (!parsed.ok) {
    return (
      <ConfirmExpiredCard
        retryHref={expiredRetryHref(parsed.type, parsed.next)}
        recovery={parsed.type === 'recovery'}
      />
    )
  }

  return (
    <ConfirmLinkForm
      tokenHash={parsed.tokenHash}
      type={parsed.type}
      next={parsed.next}
      locale={locale === 'ar' ? 'ar' : 'en'}
    />
  )
}
