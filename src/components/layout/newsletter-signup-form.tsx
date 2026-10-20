'use client'

import { useId, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { subscribeToNewsletter } from '@/app/actions/contact'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  newsletterSignupSchema,
  type NewsletterSignupInput,
} from '@/lib/contact'

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
  const [statusOk, setStatusOk] = useState(false)
  const errorId = useId()
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
    const result = await subscribeToNewsletter(data)

    if (!result.ok) {
      if (result.code === 'validation' && result.fieldErrors?.email?.[0]) {
        setError('email', { message: result.fieldErrors.email[0] })
        return
      }

      setStatusOk(false)
      setStatusMessage(result.message || t('errSubscribe'))
      return
    }

    setStatusOk(true)
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
            disabled={isSubmitting}
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
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          {emailField}
          <Button type="submit" disabled={isSubmitting}>
            {buttonLabel || t('defaultButton')}
          </Button>
        </div>
      )}
      {errors.email?.message && (
        <p id={errorId} role="alert" className="text-brand-red-safe text-xs">
          {t('invalidEmail')}
        </p>
      )}
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-[var(--text-dim)] empty:hidden"
      >
        {statusMessage && statusOk && (
          <CheckIcon aria-hidden className="size-4 shrink-0 text-[var(--primary)]" />
        )}
        {statusMessage}
      </p>
    </form>
  )
}
