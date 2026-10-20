'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { subscribeToNewsletter } from '@/app/actions/contact'
import {
  newsletterSignupSchema,
  type NewsletterSignupInput,
} from '@/lib/contact'
import {
  TurnstileField,
  useTurnstileToken,
} from '@/components/security/turnstile-field'
import { isCaptchaFailure } from '@/lib/turnstile-widget'

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
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
    captcha.setFailed(false)
    const result = await subscribeToNewsletter(data, captcha.token ?? undefined)
    // The token is single-use: whatever the outcome, a fresh one is needed.
    const refused = !result.ok && isCaptchaFailure(result.message)
    captcha.consume(refused)

    if (!result.ok) {
      if (result.code === 'validation' && result.fieldErrors?.email?.[0]) {
        setError('email', { message: result.fieldErrors.email[0] })
        return
      }

      // With the widget drawn, a captcha refusal shows under it (signed).
      setStatusMessage(
        needsToken && refused ? null : result.message || t('errSubscribe')
      )
      return
    }

    if (result.status === 'sent') {
      setStatusMessage(t('statusSent'))
    } else if (result.status === 'updated_preferences') {
      setStatusMessage(t('statusUpdated'))
    } else if (result.status === 'already_subscribed') {
      setStatusMessage(t('statusAlreadySubscribed'))
    } else {
      setStatusMessage(t('statusOfflineSaved'))
    }

    reset({
      email: data.email,
      source,
      interestSlug,
      interestTitle,
    })
  }

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
      <div
        className={
          compact
            ? 'flex items-center border-b border-[var(--line-2)]'
            : 'space-y-3'
        }
      >
        <input
          type="email"
          placeholder={t('placeholder')}
          className={
            compact
              ? 'flex-1 bg-transparent py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]'
              : 'min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]'
          }
          {...register('email')}
        />
        {compact && (
          <button
            type="submit"
            disabled={isSubmitting || awaitingToken}
            className="flex min-h-11 min-w-11 items-center justify-center px-2 py-3 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)] disabled:opacity-60"
            aria-label={buttonLabel || t('submitAria')}
          >
            <svg
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
        )}
      </div>
      {!compact && (
        <button
          type="submit"
          disabled={isSubmitting || awaitingToken}
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors hover:bg-white disabled:opacity-60"
        >
          {buttonLabel || t('defaultButton')}
        </button>
      )}
      <TurnstileField
        key={captcha.widgetKey}
        form="newsletter"
        onToken={captcha.setToken}
        failed={captcha.failed}
      />
      {errors.email?.message && (
        <p className="text-brand-red-safe text-xs">{t('invalidEmail')}</p>
      )}
      {statusMessage && (
        <p className="text-sm text-[var(--text-dim)]">{statusMessage}</p>
      )}
    </form>
  )
}
