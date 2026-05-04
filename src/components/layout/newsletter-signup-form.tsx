'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { subscribeToNewsletter } from '@/app/actions/contact'
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
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
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

      setStatusMessage(result.message || (isArabic ? 'تعذّر الاشتراك حالياً.' : 'Could not subscribe right now.'))
      return
    }

    if (result.status === 'sent') {
      setStatusMessage(isArabic ? 'تم الاشتراك بنجاح.' : 'You are subscribed.')
    } else if (result.status === 'updated_preferences') {
      setStatusMessage(isArabic ? 'تم تحديث تفضيلاتك.' : 'Your update reminder is set.')
    } else if (result.status === 'already_subscribed') {
      setStatusMessage(isArabic ? 'أنت مشترك بالفعل.' : 'You are already subscribed.')
    } else {
      setStatusMessage(
        isArabic
          ? 'تم حفظ اشتراكك، لكن البريد غير مفعّل حالياً.'
          : 'Your signup was saved, but email delivery is offline right now.'
      )
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
      <input type="hidden" value={interestSlug || ''} {...register('interestSlug')} />
      <input type="hidden" value={interestTitle || ''} {...register('interestTitle')} />
      <div className={compact ? 'flex items-center border-b border-[var(--line-2)]' : 'space-y-3'}>
        <input
          type="email"
          placeholder={isArabic ? 'بريدك الإلكتروني' : 'your@email.com'}
          className={compact
            ? 'flex-1 bg-transparent py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-mute)] outline-none'
            : 'min-h-11 w-full rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-mute)] outline-none'}
          {...register('email')}
        />
        {compact && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-11 min-w-11 items-center justify-center px-2 py-3 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)] disabled:opacity-60"
            aria-label={buttonLabel || (isArabic ? 'الاشتراك في النشرة' : 'Submit newsletter signup')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        )}
      </div>
      {!compact && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-white disabled:opacity-60"
        >
          {buttonLabel || (isArabic ? 'اشترِك للحصول على التحديثات' : 'Get updates')}
        </button>
      )}
      {errors.email?.message && (
        <p className="text-xs text-brand-red-safe">
          {isArabic ? 'أدخل بريداً إلكترونياً صالحاً.' : 'Enter a valid email address.'}
        </p>
      )}
      {statusMessage && (
        <p className="text-sm text-[var(--text-dim)]">
          {statusMessage}
        </p>
      )}
    </form>
  )
}
