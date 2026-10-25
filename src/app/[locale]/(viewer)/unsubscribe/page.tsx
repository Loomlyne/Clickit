import type { Metadata } from 'next'
import { AlertCircle, BellOff, CheckCircle2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { LinkActionForm, type LinkPanel } from '@/components/email-pages/link-action-form'
import { unsubscribePagePreview } from '@/server/email/public-links-store'

import { confirmUnsubscribe } from './actions'

// Public button page (D-35, UI-SPEC 6.10). GET never changes anything: it only reads
// to pick the state. The write is the button's server action.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('emailPages')
  return {
    title: `${t('unsubTitle')} | Clickit Story`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

const greenIcon = 'text-[var(--color-brand-green-safe)]'

export default async function UnsubscribePage({
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

  const state = await unsubscribePagePreview(token)

  const done: LinkPanel = {
    icon: <CheckCircle2 className={greenIcon} />,
    title: t('unsubDoneTitle'),
    body: t('unsubDoneBody'),
    cta: { label: t('goToClickit'), href: '/browse' },
  }
  const invalid: LinkPanel = {
    icon: <AlertCircle />,
    title: t('unsubInvalidTitle'),
    body: t('unsubInvalidBody'),
    cta: { label: tAuth('backToSignIn'), href: '/auth' },
  }

  // Cannot verify right now (secret or database not reachable): say so, do not claim "invalid".
  const unavailable: LinkPanel = { ...invalid, title: tCommon('error') }

  const panel =
    state === 'ready'
      ? {
          icon: <BellOff />,
          title: t('unsubTitle'),
          body: t('unsubBody'),
          button: t('unsubscribe'),
          pending: t('unsubscribing'),
          secondary: { label: t('unsubKeep'), href: '/' },
        }
      : undefined
  const initial =
    state === 'ready' ? undefined : state === 'done' ? 'done' : state === 'invalid' ? 'invalid' : 'unavailable'

  return (
    <LinkActionForm
      token={token}
      action={confirmUnsubscribe}
      errorText={tCommon('error')}
      idle={panel}
      initial={initial}
      outcomes={{ done, invalid, unavailable }}
    />
  )
}
