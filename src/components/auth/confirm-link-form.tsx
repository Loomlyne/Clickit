'use client'

import { useActionState, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, Clock, KeyRound, Loader2, Mail, MailCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { confirmLink, type ConfirmLinkState } from '@/app/[locale]/(viewer)/auth/confirm/actions'
import { AuthAlert } from '@/components/auth/auth-alert'
import { AuthCardPage } from '@/components/auth/auth-card-page'
import { Button } from '@/components/ui/button'
import { getPathname, Link } from '@/i18n/navigation'
import { AUTH_LINK_MINUTES } from '@/lib/auth-code'

/** Same list as CONFIRM_TYPES in src/server/auth/confirm-core.ts (kept out of the client bundle). */
type LinkType = 'signup' | 'recovery' | 'email_change' | 'email' | 'magiclink'

const ICON = 'size-5'

const VARIANTS = {
  signup: { Icon: MailCheck, title: 'confirmSignupTitle', body: 'confirmSignupBody', button: 'finishSigningIn' },
  recovery: { Icon: KeyRound, title: 'confirmRecoveryTitle', body: 'confirmRecoveryBody', button: 'chooseNewPassword' },
  email_change: { Icon: Mail, title: 'confirmEmailChangeTitle', body: 'confirmEmailChangeBody', button: 'confirmNewEmail' },
} as const

function variantFor(type: LinkType) {
  if (type === 'recovery' || type === 'email_change') return VARIANTS[type]
  return VARIANTS.signup
}

/** Focus the card's only control when it appears or when the card swaps. */
function useFocusOnShow(key: string) {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [key])
  return ref
}

/**
 * Invalid, expired or already used link (UI-SPEC 6.3, last state). One message
 * for all three causes; recovery offers "Request a new link" (forgot screen).
 */
export function ConfirmExpiredCard({ retryHref, recovery }: { retryHref: string; recovery: boolean }) {
  const t = useTranslations('auth')
  const ref = useFocusOnShow('expired')
  return (
    <AuthCardPage
      icon={<AlertCircle className={`${ICON} text-[var(--color-brand-red-safe)]`} />}
      title={t('linkExpiredTitle')}
      subline={t('linkExpiredBody', { minutes: AUTH_LINK_MINUTES })}
    >
      <Button asChild size="lg" className="w-full">
        <Link ref={ref as React.Ref<HTMLAnchorElement>} href={retryHref}>
          {recovery ? t('requestNewLink') : t('backToSignIn')}
        </Link>
      </Button>
    </AuthCardPage>
  )
}

/**
 * The email-link button page (05-23; AUTH-04; D-12, D-13; UI-SPEC 6.3). GET
 * shows one button; pressing it posts the token to confirmLink, the only place
 * it is verified. After a sign-in the page does a full load into the
 * destination (the session just changed and the layout tree differs).
 */
export function ConfirmLinkForm({
  tokenHash,
  type,
  next,
  locale,
}: {
  tokenHash: string
  type: LinkType
  next: string
  locale: 'en' | 'ar'
}) {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')

  const [state, formAction, pending] = useActionState(
    async (prev: ConfirmLinkState, formData: FormData): Promise<ConfirmLinkState> => {
      try {
        return await confirmLink(prev, formData)
      } catch {
        // The server could not be reached: the token is not spent, so retry.
        return { status: 'retry' }
      }
    },
    { status: 'idle' }
  )

  const navigating = state.status === 'navigate'
  const destination = navigating ? state.destination : null

  useEffect(() => {
    if (!destination) return
    // Full load, not router.replace (05-25 lesson); replace keeps the spent link out of history.
    window.location.replace(getPathname({ href: destination, locale }))
  }, [destination, locale])

  const ref = useFocusOnShow(state.status)

  if (state.status === 'expired') {
    return <ConfirmExpiredCard retryHref={state.retryHref} recovery={state.recovery} />
  }

  if (state.status === 'pending_other' || state.status === 'email_changed') {
    const pendingOther = state.status === 'pending_other'
    return (
      <AuthCardPage
        icon={
          pendingOther ? (
            <Clock className={ICON} />
          ) : (
            <CheckCircle2 className={`${ICON} text-[var(--color-brand-green-safe)]`} />
          )
        }
        title={pendingOther ? t('pendingOtherTitle') : t('emailChangedTitle')}
        subline={pendingOther ? t('pendingOtherBody') : t('emailChangedBody')}
      >
        <Button asChild size="lg" variant={pendingOther ? 'outline' : 'default'} className="w-full">
          <Link ref={ref as React.Ref<HTMLAnchorElement>} href="/profile">
            {t('goToProfile')}
          </Link>
        </Button>
      </AuthCardPage>
    )
  }

  const variant = variantFor(type)
  const busy = pending || navigating

  return (
    <AuthCardPage icon={<variant.Icon className={ICON} />} title={t(variant.title)} subline={t(variant.body)}>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="locale" value={locale} />
        {state.status === 'retry' && !busy && <AuthAlert variant="error">{tErrors('networkError')}</AuthAlert>}
        <Button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy}
          aria-busy={busy}
        >
          {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
          {busy ? t('working') : t(variant.button)}
        </Button>
      </form>
    </AuthCardPage>
  )
}
