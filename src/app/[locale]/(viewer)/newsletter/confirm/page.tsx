import type { Metadata } from 'next'
import { AlertCircle, CheckCircle2, MailCheck } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { LinkActionForm, type LinkPanel } from '@/components/email-pages/link-action-form'
import { newsletterPagePreview } from '@/server/email/public-links-store'

import { confirmNewsletter } from './actions'

// Public button page (D-32, UI-SPEC 6.11). GET never confirms anything: a mail
// scanner opening the link must not consent for the person. The server action does.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('emailPages')
  return {
    title: `${t('nlConfirmTitle')} | Clickit Story`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

const greenIcon = 'text-[var(--color-brand-green-safe)]'

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const [t, tAuth, tCommon, query] = await Promise.all([
    getTranslations('emailPages'),
    getTranslations('auth'),
    getTranslations('common'),
    searchParams,
  ])
  const token = typeof query.t === 'string' ? query.t : ''

  const state = await newsletterPagePreview(token)

  const goTo = { label: t('goToClickit'), href: '/browse' }
  const done: LinkPanel = {
    icon: <CheckCircle2 className={greenIcon} />,
    title: t('nlDoneTitle'),
    body: t('nlDoneBody'),
    cta: goTo,
  }
  const already: LinkPanel = { ...done, title: t('nlAlreadyTitle') }
  const expired: LinkPanel = {
    icon: <AlertCircle />,
    title: t('nlExpiredTitle'),
    body: t('nlExpiredBody'),
    cta: goTo,
  }
  const invalid: LinkPanel = {
    icon: <AlertCircle />,
    title: t('unsubInvalidTitle'),
    body: t('unsubInvalidBody'),
    cta: { label: tAuth('backToSignIn'), href: '/auth' },
  }
  // Cannot verify right now (secret or database not reachable): do not claim "invalid".
  const unavailable: LinkPanel = { ...invalid, title: tCommon('error') }

  const panel =
    state === 'ready'
      ? {
          icon: <MailCheck />,
          title: t('nlConfirmTitle'),
          body: t('nlConfirmBody'),
          button: t('nlConfirmButton'),
          pending: tCommon('loading'),
        }
      : undefined

  return (
    <LinkActionForm
      token={token}
      action={confirmNewsletter}
      errorText={tCommon('error')}
      idle={panel}
      initial={state === 'ready' ? undefined : state}
      outcomes={{ done, already, expired, invalid, unavailable }}
    />
  )
}
