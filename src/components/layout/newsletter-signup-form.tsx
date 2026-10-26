'use client'

import { useId, useState } from 'react'
import { CheckIcon, MailIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { subscribeToNewsletter } from '@/app/actions/contact'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  newsletterSignupSchema,
  type NewsletterSignupInput,
} from '@/lib/contact'
import {
  TurnstileField,
  useTurnstileToken,
} from '@/components/security/turnstile-field'
import { isCaptchaFailure } from '@/lib/turnstile-widget'

// The enqueue_email RPC caps confirm emails at 1 per address per 10 minutes (D-39).
const CONFIRM_RESEND_MINUTES = 10

type NewsletterSignupFormProps = {
  source: string
  interestSlug?: string
  interestTitle?: string
  defaultEmail?: string
  buttonLabel?: string
  compact?: boolean
}

export function NewsletterSignupForm({
  source,
  interestSlug,
  interestTitle,
  defaultEmail = '',
  buttonLabel,
  compact = true,
}: NewsletterSignupFormProps) {
  const t = useTranslations('newsletter')
  // Page language for the confirm email (D-32).
  const locale = useLocale() === 'ar' ? 'ar' : 'en'
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  // UI-SPEC 6.12: Mail for the pending states, accent Check only when already confirmed.
  const [statusIcon, setStatusIcon] = useState<'mail' | 'check' | null>(null)
  const errorId = useId()
  // Turnstile (PLAT-05): interaction-only, single-use token, submit disabled
  // until one exists.
  const captcha = useTurnstileToken()
  const { needsToken, awaitingToken } = captcha
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<NewsletterSignupInput>({
    resolver: zodResolver(newsletterSignupSchema),
    defaultValues: {
      email: defaultEmail,
      source,
      interestSlug,
      interestTitle,
    },
  })

  async function onSubmit(data: NewsletterSignupInput) {
    if (awaitingToken) return
    setStatusMessage(null)
    setStatusIcon(null)
    captcha.setFailed(false)
    const result = await subscribeToNewsletter(
      { ...data, locale },
      captcha.token ?? undefined
    )
    // The token is single-use: whatever the outcome, a fresh one is needed.
    const refused = !result.ok && isCaptchaFailure(result.message)
    captcha.consume(refused)

    if (!result.ok) {
      if (result.code === 'validation' && result.fieldErrors?.email?.[0]) {
        setError('email', { message: result.fieldErrors.email[0] })
        return
      }

      setStatusIcon(null)
      // With the widget drawn, a captcha refusal shows under it (signed).
      setStatusMessage(
        needsToken && refused ? null : result.message || t('errSubscribe')
      )
      return
    }

    // Never "subscribed" before the confirm click (D-32).
    if (result.status === 'pending_confirmation') {
      setStatusIcon('mail')
      setStatusMessage(t('statusPending'))
    } else if (result.status === 'pending_recent') {
      setStatusIcon('mail')
      setStatusMessage(
        t('statusPendingRecent', { minutes: CONFIRM_RESEND_MINUTES })
      )
    } else if (result.status === 'already_subscribed') {
      setStatusIcon('check')
      setStatusMessage(t('statusAlreadySubscribed'))
    } else {
      setStatusIcon(null)
      setStatusMessage(t('statusOfflineSaved'))
    }

    reset({
      email: data.email,
      source,
      interestSlug,
      interestTitle,
    })
  }

  const emailField = compact ? (
    <input
      type="email"
      autoComplete="email"
      aria-label={t('emailLabel')}
      aria-invalid={errors.email ? true : undefined}
      aria-describedby={errors.email ? errorId : undefined}
      placeholder={t('placeholder')}
      className="flex-1 bg-transparent py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
      {...register('email')}
    />
  ) : (
    <Input
      type="email"
      autoComplete="email"
      aria-label={t('emailLabel')}
      aria-invalid={errors.email ? true : undefined}
      aria-describedby={errors.email ? errorId : undefined}
      placeholder={t('placeholder')}
      {...register('email')}
    />
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
      <input type="hidden" value={source} {...register('source')} />
      <input
        type="hidden"
        value={interestSlug || ''}
        {...register('interestSlug')}
      />
      <input
        type="hidden"
        value={interestTitle || ''}
        {...register('interestTitle')}
      />
      {compact ? (
        <div className="flex items-center border-b border-[var(--line-2)]">
          {emailField}
          <button
            type="submit"
            disabled={isSubmitting || awaitingToken}
            className="flex min-h-11 min-w-11 items-center justify-center px-2 py-3 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)] disabled:opacity-60"
            aria-label={t('submitAria')}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          {emailField}
          <Button type="submit" disabled={isSubmitting || awaitingToken}>
            {buttonLabel || t('defaultButton')}
          </Button>
        </div>
      )}
      <TurnstileField
        key={captcha.widgetKey}
        form="newsletter"
        onToken={captcha.setToken}
        failed={captcha.failed}
      />
      {errors.email?.message && (
        <p id={errorId} role="alert" className="text-brand-red-safe text-xs">
          {t('invalidEmail')}
        </p>
      )}
      <div role="status">
        {statusMessage && (
          <p className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
            {statusIcon === 'mail' && (
              <MailIcon
                aria-hidden
                className="size-4 shrink-0 text-[var(--text-dim)]"
              />
            )}
            {statusIcon === 'check' && (
              <CheckIcon
                aria-hidden
                className="size-4 shrink-0 text-[var(--primary)]"
              />
            )}
            {statusMessage}
          </p>
        )}
      </div>
    </form>
  )
}
